# Tasks: Feature 0137 - navigation-scroll-position

## Cómo usar este documento

Contrato de ejecución para `implement-task-test-first`. Las tareas se ejecutan en el orden `T1 → T2`. Ninguna tarea
puede empezar antes de que la anterior tenga su cierre de implementación marcado. Las decisiones técnicas citadas
(`Decisión N`) se refieren a `design.md`.

---

## T1 — Módulo de efecto de scroll: captura por `entryId`, scroll-to-top en push y neutralización de `history.scrollRestoration`

### Objetivo
Crear `RuntimeScrollRestorationEffect`, un componente de efecto sin render visual que:
- captura `window.scrollY` de la `pageEntry` activa en el instante en que deja de serlo (Decisión 3), indexado por
  `entryId` en un `Map` interno (`useRef<Map<number, number>>`, Decisión 2);
- aplica `window.scrollTo(0, 0)` de forma inmediata cuando la `pageEntry` activa tiene un `entryId` que no existe
  todavía en ese `Map` (push, Decisión 4), sin condicionarlo al estado de `preloads`;
- fija `window.history.scrollRestoration = 'manual'` al montar y restaura el valor previo al desmontar (Decisión 6).

Montar el componente en `RuntimeStateProvider` junto a `RuntimeDocumentTitleEffect`, para que el mecanismo esté vivo
en cualquier test o uso real que monte `RuntimeStateProvider` (Decisión 7). Esta tarea cierra el comportamiento de
push (requisito funcional 1 de `spec.md`) y dota de base la captura que consumirá T2 para la restauración por pop.
No implementa todavía la restauración de scroll al reactivar una entrada (eso es T2): en esta tarea, reactivar una
entrada ya visitada (pop) simplemente no dispara ningún `window.scrollTo`.

### Fuera de alcance
- La restauración de scroll al reactivar una `pageEntry` existente (pop) — se implementa en T2, mismo archivo.
- Cualquier condición de espera sobre `pageEntry.status`/`loading` — no aplica al camino push (Decisión 4) y la rama
  pop no existe todavía en esta tarea.
- Scroll de contenedores internos (`shell.sidebar`, tablas, Monaco): fuera de alcance de toda la feature.

### Dependencias
Ninguna. Primera tarea de la feature. Bloquea T2 (T2 extiende el mismo archivo y reutiliza el `Map` creado aquí).

### Impacto esperado en archivos
- Código a crear: `src/runtime/runtime-scroll-restoration.tsx` — exporta `RuntimeScrollRestorationEffect` (sin
  props), consumiendo `useRuntimeState()` de `src/runtime/runtime-state/use-runtime-state.ts` y
  `selectCurrentNavigationEntry` de `src/runtime/runtime-state/runtime-state-selectors.ts`, siguiendo el precedente
  de forma de `src/runtime/runtime-document-title.tsx` (componente de efecto puro, sin render visual, `return null`).
- Código a modificar: `src/runtime/runtime-state/runtime-state-provider.tsx` — importar
  `RuntimeScrollRestorationEffect` y montarlo como hijo de `RuntimeStateContext.Provider`, junto a
  `RuntimeDocumentTitleEffect` (líneas 322-326 actuales), sin tocar ninguna otra lógica del provider.
- Tests a crear: `src/tests/runtime/runtime-scroll-restoration.test.tsx`.
- Documentación a revisar: ninguna en esta tarea; el impacto documental agregado de la feature se declara en T2, que
  es la tarea que completa el comportamiento observable descrito en `spec.md`.

### Tests

**Ficheros de test**:
- `src/tests/runtime/runtime-scroll-restoration.test.tsx` (nuevo)

**Comportamiento cubierto**:
- Al montar `RuntimeStateProvider` (entrada inicial `entryId: 0`, primera vez que se ve ese `entryId`),
  `window.scrollTo` se invoca con `(0, 0)`.
- Al hacer `navigateTo` a una página distinta (nueva entrada, `entryId` nunca visto), `window.scrollTo` se invoca con
  `(0, 0)` de forma síncrona tras la navegación (criterio de aceptación 1 de `spec.md`).
- Al hacer `navigateTo` hacia una página ya visitada anteriormente (no `goBack`, misma página que una entrada
  previa pero con un `entryId` nuevo porque `navigateToPage` siempre crea entrada nueva salvo no-op), `window.scrollTo`
  se invoca de nuevo con `(0, 0)` — confirma que el push ignora si la página ya se visitó y solo mira el `entryId`
  (criterio de aceptación 3).
- Navegar dos veces seguidas a la misma página con los mismos params efectivos (no-op observable, no crea entrada
  nueva) no produce ninguna llamada adicional a `window.scrollTo` más allá de la que ya correspondía a la entrada
  activa (criterio de aceptación 6, requisito funcional 5).
- Un intento de `navigateTo` a una página inexistente no dispara ninguna llamada adicional a `window.scrollTo`
  (criterio de aceptación 7, requisito funcional 6): la entrada activa no cambia, por lo que el efecto no debe
  volver a ejecutarse.
- Tras `navigateTo` a una segunda página y volver a la primera mediante el `goBack` de la app (`goBackPage()`,
  reutiliza `entryId: 0`, ya presente en el `Map` de posiciones por haberse abandonado antes), `window.scrollTo` NO
  se invoca con `(0, 0)` en esa reactivación — confirma que la captura al abandonar una entrada (Decisión 3) marca
  correctamente ese `entryId` como ya visitado y que el push (Decisión 4) no interfiere con él.
- `window.history.scrollRestoration` pasa a `'manual'` mientras `RuntimeStateProvider` está montado y vuelve a su
  valor previo (`'auto'` en el entorno de test) tras desmontarlo.

**Comandos durante la implementación**:
```
pnpm test --run src/tests/runtime/runtime-scroll-restoration.test.tsx
```

**Restricciones**:
- Mockear `window.scrollTo` con `vi.spyOn(window, 'scrollTo').mockImplementation(() => {})` al inicio de cada test
  (o en un `beforeEach` del fichero) y restaurar con `vi.restoreAllMocks()`/`mockRestore()` en `afterEach`, siguiendo
  el mismo criterio de mock explícito por fichero que ya usa `setup.ts` para `ResizeObserver`. No depender del
  comportamiento real de scroll de `jsdom`.
- Para simular una posición de scroll "con la que el usuario abandona una entrada", sobrescribir la lectura de
  `window.scrollY` con `Object.defineProperty(window, 'scrollY', { value, configurable: true })` antes de disparar la
  navegación que abandona esa entrada; no asumir que `window.scrollTo` mockeado actualiza `window.scrollY`
  automáticamente en `jsdom`.
- Montar los escenarios con el patrón ya usado en `src/tests/runtime-state/runtime-state-navigation.test.tsx`
  (`render(<RuntimeStateProvider config={...}><NavigationControls /><RuntimePage /></RuntimeStateProvider>)`, con un
  componente de fixture local con botones que llamen a `navigateToPage`/`goBackPage` vía `useRuntimeStateActions()`).
  No montar `RuntimeScrollRestorationEffect` manualmente en el test: debe llegar ya activo a través de
  `RuntimeStateProvider` una vez completado el wiring de esta tarea.
- No cubrir en este fichero ningún escenario de restauración por pop con posición distinta de "no se llamó a
  `scrollTo(0,0)`"; la aserción positiva de restauración (`scrollTo(0, posiciónGuardada)`) es contrato de T2.

### Criterios de finalización
- `RuntimeScrollRestorationEffect` existe, está montado en `RuntimeStateProvider` y compila sin errores de tipos.
- Todos los tests listados arriba están escritos y en verde.
- El resto de la suite de tests existente sigue en verde tras montar el nuevo efecto en `RuntimeStateProvider`
  (ningún test previo que monte `RuntimeStateProvider` debía depender de que `window.scrollTo`/
  `history.scrollRestoration` quedaran intactos; si alguno lo hiciera, es una regresión a corregir dentro de esta
  misma tarea, no a posponer).

### Cierre de implementación
Código y tests de esta tarea completos, en verde, y sin regresiones en la suite existente.

---

## T2 — Restauración de scroll al reactivar una `pageEntry` (pop), gateada por `pageEntry.status`

### Objetivo
Añadir a `RuntimeScrollRestorationEffect` un segundo `useLayoutEffect`, con dependencias
`[entryId activo, pageEntry.entryId, pageEntry.status]`, que aplica `window.scrollTo(0, posiciónGuardada)` cuando:
- el `entryId` activo ya tiene una posición capturada en el `Map` de T1 (pop), y
- `pageEntry.entryId === entryId activo` (la `pageEntry` ya está sincronizada con esa entrada), y
- `pageEntry.status !== 'loading'`.

Mientras `pageEntry.status === 'loading'` para ese `entryId`, el efecto no aplica ninguna posición; se reevalúa solo
cuando `pageEntry` cambie (Decisión 5). Esta tarea cierra el requisito funcional 2, 3 (junto con T1) y 4 de
`spec.md`, y completa el comportamiento observable íntegro de la feature.

### Fuera de alcance
- Cualquier cambio a la lógica de push/captura ya cerrada en T1.
- Cualquier cambio a la política de relanzamiento de `preloads` o al reducer de `pageEntry`/`navigation`: esta tarea
  solo lee `pageEntry.status`, no lo modifica.
- Poda activa de entradas huérfanas del `Map` de posiciones (riesgo residual aceptado explícitamente en `design.md`).

### Dependencias
Depende de T1 (mismo archivo `src/runtime/runtime-scroll-restoration.tsx`, mismo `Map` de posiciones y mismo
componente ya wireado en `RuntimeStateProvider`). Última tarea de la feature: al cerrarse, `implementation.ready`
puede quedar en `true` sin tareas de código pendientes.

### Impacto esperado en archivos
- Código a modificar: `src/runtime/runtime-scroll-restoration.tsx` — añadir el segundo `useLayoutEffect` de
  restauración descrito arriba dentro de `RuntimeScrollRestorationEffect`. No se toca
  `runtime-state-provider.tsx` (el wiring ya existe desde T1).
- Tests a modificar: `src/tests/runtime/runtime-scroll-restoration.test.tsx` (ampliación; añade los `describe`/`it`
  de restauración a los ya existentes de T1 sin modificarlos).
- Documentación a revisar:
  - `ai-workflow/docs/app-features/navigation/navigate-actions.md`
  - `ai-workflow/docs/app-features/navigation/hash-navigation.md`
  - `ai-workflow/docs/app-features/navigation/index.md` (valorar si el volumen de contenido justifica un
    sub-documento dedicado, p. ej. `scroll-position.md`; si se crea, añadirlo también a la tabla de sub-documentos)
  - `ai-workflow/docs/current-state.md` (fila de "Navegación y páginas")
  - `ai-workflow/docs/test-index.md` (añadir la entrada de `runtime-scroll-restoration.test.tsx` bajo la sección
    `runtime/`, resumiendo la cobertura conjunta de T1+T2)

### Tests

**Ficheros de test**:
- `src/tests/runtime/runtime-scroll-restoration.test.tsx` (ampliación)

**Comportamiento cubierto**:
- Tras `navigateTo` a una segunda página con una posición de scroll simulada distinta de `0` en la primera, y volver
  mediante el `goBack` de la app (`goBackPage()`), `window.scrollTo` se invoca con `(0, posiciónSimulada)` (criterio
  de aceptación 2, requisito funcional 2).
- El mismo escenario disparando la reactivación mediante `window.history.back()` invocado directamente (sin pasar
  por el botón de `goBack` de la app, simulando el control nativo atrás/adelante del navegador vía el `popstate` real
  que ya gestiona `RuntimeStateProvider`) produce el mismo resultado (criterio de aceptación 4).
- Con una página cuyo `preloads` resuelve mediante una promesa controlada manualmente (mismo patrón de
  `fetch`/`Promise` diferida que `src/tests/runtime/runtime-page-entry-preloads.test.tsx`): tras reactivar por
  `goBack` una entrada cuya firma de `preloads` cambió y relanza, `window.scrollTo` no se invoca con la posición
  guardada mientras `pageEntry.status === 'loading'` para ese `entryId`, y se invoca con la posición correcta en
  cuanto `pageEntry.status` deja de estar en `loading` (criterio de aceptación 5, requisito funcional 4).
- Un `goBack` que actúa como no-op visible (entrada directa por URL sin historial previo en la sesión, sin cambio de
  `entryId`) no produce ninguna llamada a `window.scrollTo` (criterio de aceptación 7 aplicado a `goBack`, requisito
  funcional 7).
- Página cuyo contenido no permite scroll (posición simulada `0` en el momento de abandonar la entrada): la
  restauración sigue invocando `window.scrollTo(0, 0)` sin lanzar error (caso límite de `spec.md`, no-op visible).
- Regresión: los escenarios de push ya cubiertos en T1 (incluida la ausencia de `scrollTo(0,0)` al reactivar por
  pop) siguen en verde sin modificarlos.

**Comandos durante la implementación**:
```
pnpm test --run src/tests/runtime/runtime-scroll-restoration.test.tsx
```

**Restricciones**:
- Reutilizar exactamente el mismo patrón de mock de `window.scrollTo`/`window.scrollY` ya establecido en T1 dentro
  del mismo fichero; no introducir un segundo mecanismo de mock en paralelo.
- Para el escenario de `preloads` en curso, usar el mismo patrón de `Promise` diferida con `resolve` capturado que
  ya usa `src/tests/runtime/runtime-page-entry-preloads.test.tsx` (`vi.fn(() => new Promise<Response>((resolve) => {
  ... }))` + `vi.stubGlobal('fetch', fetchMock)`), y una función local `createJsonResponse` idéntica a la que ya
  replican varios ficheros de `src/tests/runtime/` (no importar una versión compartida nueva).
- No añadir un test dedicado a la condición de carrera de navegaciones muy rápidas descrita como caso límite en
  `spec.md`: el diseño (Decisión 5, riesgo residual) explica que se resuelve por la propia semántica de
  dependencias de `useLayoutEffect` sin lógica de cancelación adicional, y no hay una API pública nueva que
  verificar más allá de lo ya cubierto por los escenarios de arriba.

### Criterios de finalización
- El segundo `useLayoutEffect` de restauración está implementado tal como lo describe `design.md` (Decisión 5).
- Todos los tests de T1 y T2 en `runtime-scroll-restoration.test.tsx` están en verde.
- El umbral de cobertura global del proyecto (`pnpm test`) sigue cumpliéndose.
- El resto de la suite sigue en verde.

### Cierre de implementación
Código y tests de esta tarea completos, en verde, sin regresiones, y con el umbral de cobertura global del proyecto
intacto. Al cerrarse esta tarea, la feature completa queda implementada de principio a fin.

---

## Siguiente tarea a escoger
T1. No hay trabajo previo de esta feature en `src/`.
