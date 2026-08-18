# Design: Feature 0137 - navigation-scroll-position

## Contexto

El historial de navegación del runtime ya modela cada visita como una `pageEntry` con `entryId` estable
(`state.navigation.history`, `state.navigation.currentEntryIndex`, `state.pageEntry`). Dos vías alimentan ese estado:

- `navigateToPage` (acción `navigateTo`) despacha `navigation/navigate`, que en el reducer llama a
  `appendNavigationEntry`: si la entrada solicitada coincide con la activa, es no-op; en cualquier otro caso **siempre**
  crea un `entryId` nuevo con `getNextNavigationEntryId` (nunca busca hacia atrás en el historial). Esto es lo que ya
  garantiza, sin lógica adicional, que un `navigateTo` hacia una página ya visitada (criterio de aceptación 3) se trate
  como push y no como restauración.
- `syncFromBrowserHash` (listener de `hashchange`/`popstate` en `RuntimeStateProvider`) despacha
  `navigation/sync-from-browser`, que en el reducer llama a `synchronizeNavigationWithEntry`: primero comprueba no-op
  contra la entrada activa, luego **busca una entrada existente en el historial** por `pageId`+`params` y, si la
  encuentra, mueve `currentEntryIndex` a esa entrada reutilizando su `entryId`; solo si no encuentra coincidencia crea
  una entrada nueva. Este camino es el que procesa tanto el `goBack` declarativo (que internamente llama a
  `window.history.back()` y deja que el `popstate` real dispare la sincronización) como los controles nativos
  atrás/adelante del navegador, así como una entrada directa por URL o degradación a `initialPage`.

Es decir: el propio modelo de historial ya distingue de forma fiable "entrada nueva" de "entrada reactivada" a través
de si `entryId` es nuevo o reutilizado, sin depender de qué acción disparó el cambio. Este design se apoya en esa
distinción existente en lugar de introducir una nueva.

`pageEntry.status` (`idle | loading | success | error`) ya expresa el estado agregado de `preloads` de la entrada
activa, y ya se mantiene coherente con `entryId` (`page-entry/set-settled` ignora la acción si `entryId` no coincide
con la entrada activa). Este design reutiliza ese campo tal cual para la condición de espera del requisito 4, sin
tocar la política de `preloads`.

Precedentes de módulos de efecto ya montados como hijos de `RuntimeStateContext.Provider`, leyendo el contexto por su
cuenta en vez de recibir props internas del provider: `RuntimeDocumentTitleEffect`
(`src/runtime/runtime-document-title.tsx`). Precedentes de mecanismos que mantienen estado propio en `useRef` fuera
del reducer porque son puramente de coordinación/efecto y no datos consumibles por nodos o config:
`activePreloadBatchSignatureRef`, `completedPreloadEntryIdRef` y `plannedPreloadBatchRef` en
`runtime-state-provider.tsx`.

## Objetivos / No objetivos

### Objetivos
- Definir dónde vive el estado efímero de posiciones de scroll por `entryId`.
- Definir el mecanismo para distinguir push (scroll-to-top) de pop (restauración) sin introducir un concepto nuevo de
  navegación paralelo al ya existente.
- Definir cómo se coordina la restauración con el estado agregado `loading` de `pageEntry`.
- Definir cómo neutralizar el mecanismo nativo de scroll restoration del navegador para que no compita con el
  comportamiento del runtime.

### No objetivos
- No se diseña scroll restoration de contenedores internos (`shell.sidebar`, tablas, Monaco): fuera de alcance según
  spec.
- No se cambia la política de reevaluación de `preloads` por firma ni el modelo de `pageEntry`/`navigation` del
  reducer: se consume tal cual.
- No se introduce persistencia entre recargas ni entre sesiones.
- No se introduce animación ni easing.

## Decisiones

### 1. Detección push/pop: reutilizar el modelo de historial existente, no una señal nueva
Un `entryId` que aparece por primera vez en la sesión es push; un `entryId` que ya tuvo una posición de scroll
capturada previamente es pop. Esto se deriva de si el `Map` de posiciones (ver decisión 2) ya tiene una entrada para
ese `entryId`, no de qué tipo de acción de navegación se disparó.

**Por qué**: `appendNavigationEntry` y `synchronizeNavigationWithEntry` ya codifican exactamente la semántica que pide
la spec (push siempre entryId nuevo salvo no-op; pop siempre reutiliza entryId existente). Añadir una segunda fuente
de verdad (por ejemplo, marcar explícitamente en el reducer si una transición fue "push" o "pop") duplicaría una
distinción que el modelo de historial ya resuelve, y arriesgaría desincronizarse de él.

**Alternativa descartada**: marcar la acción de navegación con un campo explícito `origin: 'push' | 'pop'` en el
payload y propagarlo hasta `pageEntry`/`navigation`. Se descarta porque exigiría tocar el reducer y los tipos de
`RuntimeState` para una distinción que ya es derivable sin nueva superficie de estado compartido.

### 2. Ubicación del estado: ref local en un nuevo componente de efecto, no un dominio nuevo en `runtime-state`
Las posiciones de scroll capturadas por `entryId` viven en un `useRef<Map<number, number>>` dentro de un nuevo
componente de efecto `RuntimeScrollRestorationEffect`, montado como hijo de `RuntimeStateContext.Provider` junto a
`RuntimeDocumentTitleEffect`. No se añade un dominio `scroll` a `RuntimeState` ni al reducer.

**Por qué**: `architecture.md` reserva `runtime-state/` para estado compartido que nodos o config puedan consumir vía
fachada. La posición de scroll no es consumible por ningún nodo ni referencia declarativa (no hay `visibility`,
`queryStateFeedback` ni fuente de colección que dependa de ella; explícitamente fuera de alcance en la spec).
Es puramente un mecanismo de coordinación de efecto, igual que los refs de planificación de `preloads` ya existentes
en `runtime-state-provider.tsx`. Convertirla en estado de store forzaría un dispatch/render por cada captura sin que
ningún consumidor lea ese dato.

**Alternativa descartada**: nuevo dominio `scroll: Record<number, number>` en `RuntimeState`, gestionado por acciones
de reducer (`scroll/capture`, `scroll/consume`). Se descarta por el motivo anterior y porque añadiría re-renders del
árbol completo del runtime en cada cambio de `entryId` (captura) sin beneficio, ya que ningún nodo necesita leer esta
posición.

### 3. Captura de posición: cleanup de un `useLayoutEffect` indexado por `entryId` activo
`RuntimeScrollRestorationEffect` lee `entryId` de la entrada de navegación activa (mismo selector
`selectCurrentNavigationEntry` ya usado en el provider) vía `useRuntimeState()`. Un `useLayoutEffect` con
`[entryId]` como dependencia captura `window.scrollY` en su función de limpieza, que React ejecuta justo antes de que
el efecto se vuelva a ejecutar con el próximo `entryId` (es decir, en el instante en que la entrada deja de ser
activa, tal como pide el requisito 3 de la spec).

**Por qué**: es el punto natural donde React ya garantiza "justo antes de que cambie la entrada activa" sin necesitar
un listener adicional ni un `beforeunload`/`visibilitychange` propio.

**Riesgo residual**: si el componente se desmonta completamente (navegación fuera del runtime embebido, por ejemplo),
la limpieza también se ejecuta y captura una posición que nunca se consumirá; es inofensivo, el `Map` simplemente se
descarta con el componente.

### 4. Scroll-to-top de push: mismo efecto de layout, sin esperar a `preloads`
Dentro del mismo `useLayoutEffect` de la decisión 3, si el `entryId` activo no tiene posición capturada en el `Map`
(push), se aplica `window.scrollTo(0, 0)` de inmediato, sin condicionarlo al estado de `pageEntry`.

**Por qué**: el requisito 1 de la spec pide scroll-to-top instantáneo para toda `pageEntry` nueva, sin excepción por
estado de carga; el requisito 4 (esperar a `loading`) aplica explícitamente solo a la restauración por pop. Mantener
el push sin condición evita acoplar dos requisitos con matices distintos en una sola condición combinada.

### 5. Restauración de pop: segundo efecto gateado por `pageEntry.entryId` + `pageEntry.status`
Un segundo efecto (`useLayoutEffect`, dependencias `[entryId, pageEntry.entryId, pageEntry.status]`) se encarga solo
de la rama de restauración: si el `entryId` activo tiene una posición capturada en el `Map` (pop) y
`pageEntry.entryId === entryId` y `pageEntry.status !== 'loading'`, aplica `window.scrollTo(0, posiciónGuardada)`.
Mientras `pageEntry.status === 'loading'` para ese `entryId`, el efecto no hace nada y se reevalúa solo cuando
`pageEntry` cambie.

**Por qué**: separar captura/push (decisión 3-4) de restauración/pop evita que la condición de espera de `preloads`
retrase innecesariamente el caso push, y reutiliza `pageEntry.status` tal cual sin introducir un nuevo campo agregado
de "scroll listo".

**Riesgo residual (condición de carrera con navegaciones rápidas)**: si `entryId` cambia de nuevo antes de que
`pageEntry` alcance el `entryId` anterior, las dependencias del efecto cambian y React lo reejecuta solo para el
`entryId` final; el efecto nunca llega a aplicar una restauración para una entrada que ya dejó de ser la activa. Esto
satisface el caso límite de la spec ("prevalece el estado final de la entrada que termina activa") sin lógica
adicional de cancelación explícita.

### 6. Neutralizar `history.scrollRestoration` nativo
`RuntimeScrollRestorationEffect` fija `window.history.scrollRestoration = 'manual'` en un `useLayoutEffect` con
dependencias `[]` que se ejecuta en el primer render (antes de que pueda producirse cualquier `popstate` real), y
restaura el valor previo (`auto` en la inmensa mayoría de navegadores) en su función de limpieza al desmontar.

**Por qué**: sin este ajuste, el navegador reaplica su propia restauración de scroll grabada por historial en cada
`popstate` real (`goBack` de la app o controles nativos), lo que puede competir con `window.scrollTo` del paso 5 y
producir un salto doble visible. Es el riesgo que la spec señalaba explícitamente como pregunta abierta.

**Trade-off aceptado**: en modo embebido, `history` es el `history` real del documento host, compartido con el sitio
que aloja el runtime. Fijar `scrollRestoration` a `'manual'` mientras el runtime está montado altera ese
comportamiento nativo para todo el documento, no solo para las navegaciones internas del runtime. Se mitiga
restaurando el valor previo al desmontar, pero si el host también muta `scrollRestoration` de forma concurrente
mientras el runtime está montado, puede haber conflicto; se acepta como riesgo residual razonable dado que la spec
exige explícitamente coordinar este mecanismo y no hay señal de que el host dependa de scroll restoration nativo en
convivencia con un runtime embebido.

### 7. Ubicación y forma del módulo nuevo
Nuevo archivo `src/runtime/runtime-scroll-restoration.tsx`, exportando un componente `RuntimeScrollRestorationEffect`
(sin props, lee `useRuntimeState()` internamente), montado en `runtime-state-provider.tsx` junto a
`RuntimeDocumentTitleEffect`:

```tsx
<RuntimeStateContext.Provider value={contextValue}>
  <RuntimeDocumentTitleEffect />
  <RuntimeScrollRestorationEffect />
  {children}
</RuntimeStateContext.Provider>
```

**Por qué**: sigue el precedente directo de `runtime-document-title.tsx` (componente de efecto sin render visual que
consume el contexto compartido por su cuenta) en vez de convertir esto en un hook invocado desde dentro de
`RuntimeStateProvider`, lo que mantendría ese archivo (ya con varios efectos de coordinación) sin crecer más y aísla
el mecanismo en un módulo con una sola responsabilidad, testeable de forma aislada.

**Alternativa descartada**: hook `useRuntimeScrollRestoration(...)` invocado directamente dentro de
`RuntimeStateProvider`, al estilo de `useRuntimeTokenScheduler`/`useRuntimeGlobalPreloads`. Es un patrón igualmente
válido en este código base, pero esos dos hooks necesitan `dispatch`/`getLatestState` internos del provider porque
escriben en el store; este mecanismo no despacha ninguna acción de `runtime-state`, así que no necesita ese acceso
privilegiado y encaja mejor como componente consumidor de contexto público, igual que el título del documento.

## Riesgos y trade-offs

- **Orden de efectos dentro del mismo commit**: si en algún momento se cambiara para que la captura de scroll también
  dependiera de `pageEntry` (no es el caso de este diseño), habría que revisar el orden relativo con el efecto de
  planificación de `preloads` en `runtime-state-provider.tsx`. Con el diseño actual (decisión 3/4 dependen solo de
  `entryId`, decisión 5 depende también de `pageEntry`), no hay dependencia de orden entre archivos porque
  `RuntimeScrollRestorationEffect` solo lee estado ya comprometido por el reducer, no coordina con los refs internos
  del provider.
- **Memoria del `Map` de posiciones**: entradas de historial podadas por una navegación nueva tras un `goBack` (rama
  "adelante" descartada por `appendNavigationEntry`/`synchronizeNavigationWithEntry`, que recortan `history` a
  `currentEntryIndex + 1` antes de anexar) dejan una clave huérfana en el `Map`. Es coherente con el carácter efímero
  y en memoria del estado (spec, NFR), y el volumen esperado por sesión es insignificante; no se poda activamente.
- **`history.scrollRestoration` en modo embebido**: ver trade-off explícito en la decisión 6.
- **Test de integración con JSDOM**: `window.scrollTo` y `window.scrollY` requieren mockearse en el entorno de test
  existente; verificar si ya hay un mock compartido en la infraestructura de test o si esta feature necesita
  añadirlo. Detalle de implementación, no bloquea el diseño.

## Migración o despliegue

No aplica. No hay cambio de contrato de configuración ni de datos persistidos; es comportamiento nuevo puramente en
memoria de sesión, activo desde el primer despliegue sin flag ni migración.

## Preguntas abiertas

Ninguna bloqueante. Las dos preguntas técnicas que la spec dejaba abiertas (coordinación con
`history.scrollRestoration` nativo, y dónde vive el estado de posiciones) quedan resueltas en las decisiones 6 y 2
respectivamente.
