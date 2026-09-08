# Tasks: preload-blocking-flag

> Contrato de ejecución. Cada tarea es autosuficiente para un subagente de implementación con contexto limpio. Orden estricto: T01 → T02 → T03 → T04 → T05.

Referencias:
- Spec: `spec.md`
- Design: `design.md` (decisiones D1–D7)

---

## T01 — Extender shape de precarga con `blocking` opcional

### Objetivo
Añadir el campo opcional `blocking: boolean` a nivel de entrada de precarga (sibling de `when`, no dentro de `requestParams`) en `pages[].preloads` y en el bloque raíz `preloads`, y exponerlo en el objeto normalizado interno como `RuntimePreloadConfig.blocking`. Comportamiento por defecto (ausente) equivalente a `blocking: false`.

### Fuera de alcance
- No implementar todavía la derivación de bloqueo ni el gate de render (T02–T05).
- No añadir un nuevo error semántico transversal: solo shape de campo.
- No añadir `when` al bloque raíz.

### Dependencias
Ninguna.

### Interfaces
- Consume: ninguno.
- Produce:
  - `RuntimePreloadConfig.blocking?: boolean` (campo opcional del tipo existente en `src/config/runtime-config-types.ts`) — consumido por: T02, T04, T05.

### Impacto esperado en archivos
- Código:
  - `src/config/runtime-config-types.ts` (modificar `RuntimePreloadConfig`)
  - `src/config/validate-preloads.ts` (aceptar `blocking` como key sibling de `when` dentro de `rawPreload`, validar como boolean con ruta canónica `<pathPrefix>[i].blocking`, propagar al `RuntimePreloadConfig` normalizado)
- Tests:
  - `src/tests/config-validation/runtime-config-validation-preloads.test.ts` (ampliación)
  - `src/tests/config-validation/runtime-config-validation-global-preloads.test.ts` (ampliación)
- Documentación afectada: `ai-workflow/docs/app-features/queries/preloads.md`, `ai-workflow/docs/app-features/config/structure.md`.

### Notas de implementación relevantes
- `validate-preloads.ts` cuenta hoy con `entries.length === 2 && !entries.some(([key]) => key === 'when')` como guard; ese guard debe extenderse para admitir hasta 3 keys donde los sibling keys permitidos son `when` y `blocking`.
- `blocking` no es válido en `rawPreload` como key genérica; solo se acepta la key literal `"blocking"`.
- Ruta canónica de error para valor inválido: `<pathPrefix>[i].blocking`, con el mismo mensaje-label del bloque (`The page at ...` para `pages[].preloads`, `The runtime config has an invalid layout at ...` para el bloque raíz).
- `blocking` sí se admite tanto en `pages[].preloads` como en el bloque raíz `preloads` (a diferencia de `when`, que sigue rechazado en el bloque raíz).
- El campo se omite en el objeto normalizado si el config no lo declara (no forzar `blocking: false`); los consumidores deben interpretar `undefined` como no bloqueante.

### Tests

#### Ficheros de test
- `src/tests/config-validation/runtime-config-validation-preloads.test.ts` (ampliación) — casos de `pages[].preloads`.
- `src/tests/config-validation/runtime-config-validation-global-preloads.test.ts` (ampliación) — casos del bloque raíz `preloads`.

#### Comportamiento cubierto
- Una entrada de `pages[].preloads` con `blocking: true` (junto a `getX: {}` y opcionalmente `when`) se valida y su `RuntimePreloadConfig` normalizado expone `blocking: true`.
- Una entrada con `blocking: false` se acepta y expone `blocking: false` normalizado.
- Una entrada sin `blocking` declarado se acepta y el `RuntimePreloadConfig` normalizado no incluye la clave `blocking`.
- Una entrada con `blocking` no booleano (string, número, null, objeto) rechaza el config con ruta canónica `pages[<idx>].preloads[<i>].blocking` y mensaje-label `The page at ...`.
- Una entrada del bloque raíz `preloads` con `blocking: true` se valida y expone `blocking: true` normalizado.
- Una entrada del bloque raíz `preloads` con `blocking` no booleano rechaza el config con ruta canónica `preloads[<i>].blocking` y mensaje-label `The runtime config has an invalid layout at ...`.
- La combinación válida `{ getX: {...}, when: {...}, blocking: true }` en `pages[].preloads` se acepta y expone ambas keys normalizadas.
- Una entrada con una key extra distinta de `when` y `blocking` (por ejemplo `foo`) sigue rechazándose como hasta ahora (regresión del guard existente).

#### Comandos durante la implementación
- `pnpm test --run src/tests/config-validation/runtime-config-validation-preloads.test.ts`
- `pnpm test --run src/tests/config-validation/runtime-config-validation-global-preloads.test.ts`

### Criterios de finalización
- El shape validado acepta `blocking?: boolean` en ambos bloques y lo rechaza con ruta canónica cuando el valor no es boolean.
- El `RuntimePreloadConfig` normalizado propaga el campo cuando está declarado y lo omite cuando no.
- Los tests ampliados están en verde.

### Cierre de implementación
Código de `runtime-config-types.ts`, `validate-preloads.ts` y sus tests ampliados están en verde con el nuevo shape.

---

## T02 — Primitivas puras del gate de bloqueo

### Objetivo
Introducir dos funciones puras compartidas por el gate de página y el gate de app-mount:
- una para derivar el subconjunto de `operationName` bloqueantes de una lista de `RuntimePreloadConfig`;
- otra para decidir si el gate está actualmente bloqueado dado ese subconjunto y el estado de `queries`.

### Fuera de alcance
- No integrar todavía las primitivas con `RuntimePage` ni con `AppShell` (T04, T05).
- No introducir componente visual (T03).
- No persistir el resultado en el store del runtime: el diseño (D2/D3) exige derivación pura por render.

### Dependencias
T01 (necesita `RuntimePreloadConfig.blocking`).

### Interfaces
- Consume:
  - `RuntimePreloadConfig.blocking?: boolean` (de T01).
- Produce:
  - `deriveBlockingPreloadNames(preloads: readonly RuntimePreloadConfig[]): string[]` — consumido por: T04, T05.
  - `isPreloadGateBlocked(blockingNames: readonly string[], queries: RuntimeState['queries']): boolean` — consumido por: T04, T05.

### Impacto esperado en archivos
- Código:
  - Nuevo módulo `src/runtime/runtime-global-preloads/preload-blocking-gate.ts` que exporte ambas funciones. Se coloca dentro de `runtime-global-preloads/` porque la carpeta ya alberga primitivas compartidas por precargas globales y de página (`plan-page-preloads.ts` ya vive ahí); no crear una carpeta nueva.
- Tests:
  - `src/tests/runtime/runtime-preload-blocking-gate.test.ts` (nuevo)
- Documentación afectada: `ai-workflow/docs/test-index.md` (añadir línea del nuevo fichero de test).

### Notas de implementación relevantes
- `deriveBlockingPreloadNames` recibe la lista ya filtrada por `when` (para `pages[].preloads` la lista efectiva de esa `pageEntry`; para el bloque raíz, `config.preloads` completo) y devuelve los `operationName` cuyo `blocking === true`, preservando el orden.
- `isPreloadGateBlocked` devuelve `true` si algún nombre del subconjunto tiene `queries[name]?.status === 'loading'`. Si el subconjunto está vacío, devuelve `false`. Si un nombre no existe en `queries`, se trata como no cargando (no bloquea): coherente con que `queries.*` se siembra en `loading` antes del primer render tanto para el bloque raíz (ya implementado por `runtime-state-provider.tsx`) como para `pages[].preloads` (ya implementado por la preparación de tanda).
- Ambas funciones son puras y no dependen de React ni del provider.

### Tests

#### Ficheros de test
- `src/tests/runtime/runtime-preload-blocking-gate.test.ts` (nuevo)

#### Comportamiento cubierto
- `deriveBlockingPreloadNames` devuelve `[]` para lista vacía.
- `deriveBlockingPreloadNames` devuelve `[]` cuando ninguna entrada tiene `blocking: true`.
- `deriveBlockingPreloadNames` devuelve solo los `operationName` con `blocking: true`, preservando el orden original.
- `deriveBlockingPreloadNames` trata `blocking: undefined` y `blocking: false` como no bloqueantes.
- `isPreloadGateBlocked` con lista de nombres vacía devuelve `false` sea cual sea el estado de queries.
- `isPreloadGateBlocked` devuelve `true` cuando al menos un nombre está en `status: 'loading'`.
- `isPreloadGateBlocked` devuelve `false` cuando todos los nombres declarados están en `status: 'success'`, todos en `status: 'error'`, o una mezcla success/error/idle sin ningún `loading`.
- `isPreloadGateBlocked` trata un nombre ausente de `queries` como no cargando (no bloquea).

#### Comandos durante la implementación
- `pnpm test --run src/tests/runtime/runtime-preload-blocking-gate.test.ts`

### Criterios de finalización
- Ambas funciones exportadas con las firmas declaradas en Produce.
- Los tests del nuevo fichero están en verde y cubren los comportamientos listados.

### Cierre de implementación
Módulo `preload-blocking-gate.ts` y sus tests en verde; sin cambios todavía en consumidores (T04, T05).

---

## T03 — Componente `RuntimeBlockingLoadingIndicator`

### Objetivo
Implementar el indicador de carga genérico, fijo y no configurable que se renderiza en el hueco del contenido bloqueado, tanto por el gate de página como por el gate de app-mount.

### Fuera de alcance
- No cablearlo todavía a los gates (T04, T05).
- No introducir configuración desde JSON: la spec deja fuera de alcance su personalización.
- No introducir un nuevo nodo del catálogo `src/runtime/nodes/`.

### Dependencias
Ninguna funcional; puede desarrollarse en paralelo con T02, pero secuencialmente después de T01 según el orden global.

### Interfaces
- Consume: ninguno.
- Produce:
  - `RuntimeBlockingLoadingIndicator(): JSX.Element` (componente React sin props) — consumido por: T04, T05.

### Impacto esperado en archivos
- Código:
  - Nuevo fichero `src/runtime/runtime-blocking-loading-indicator.tsx`.
- Tests:
  - `src/tests/runtime/runtime-blocking-loading-indicator.test.tsx` (nuevo)
- Documentación afectada: `ai-workflow/docs/test-index.md` (añadir línea del nuevo fichero de test).

### Notas de implementación relevantes
- Contenedor externo con `role="status"` y un texto legible por lectores de pantalla (puede ir en `sr-only`), consistente con el precedente `layout-node-renderer.tsx:87` (`<div role="status">{fallbackContent}</div>`) y con `ai-workflow/standards/accessibility.md` sección `loading`.
- El texto accesible puede ser un literal fijo en español (por ejemplo `"Cargando"`); no se resuelve contra `translations.*` en esta feature (fuera de alcance).
- Utilidades `Tailwind` locales para presentación visual. Reutilizar tokens ya existentes (`bg-app-surface`, `text-app-text`, etc.) para no introducir una API visual paralela.
- No aceptar `props`. No aceptar `children`. Sin estados internos ni efectos.
- `data-testid` estable para que los tests de T04/T05 puedan localizarlo sin acoplarse al DOM interno; sugerencia: `data-testid="runtime-blocking-loading-indicator"`.

### Tests

#### Ficheros de test
- `src/tests/runtime/runtime-blocking-loading-indicator.test.tsx` (nuevo)

#### Comportamiento cubierto
- Al renderizarse, expone un elemento con `role="status"` en el DOM.
- Contiene texto accesible legible por lectores de pantalla (comprobable con `getByRole('status')` y presencia de un nodo textual dentro).
- El elemento raíz aplica al menos una clase Tailwind del tema global (comprobable con contains de una utilidad estable, por ejemplo `bg-app-surface` o el token que se use).
- Es idempotente entre renders (dos renders consecutivos producen el mismo DOM observable).

#### Comandos durante la implementación
- `pnpm test --run src/tests/runtime/runtime-blocking-loading-indicator.test.tsx`

#### Restricciones
- No añadir snapshots: usar aserciones estructurales (`getByRole`, `getByTestId`, `toHaveClass`).

### Criterios de finalización
- Componente reutilizable disponible como export nombrado de `src/runtime/runtime-blocking-loading-indicator.tsx`.
- Tests unitarios en verde.

### Cierre de implementación
Fichero de componente y su test en verde; sin consumidores todavía (T04, T05).

---

## T04 — Gate de bloqueo en `RuntimePage` (precargas de página)

### Objetivo
Retrasar el render del árbol `layout` de la página activa cuando alguna precarga bloqueante de la tanda actual (`pageEntry.preloadNames`) sigue en `queries[name].status === 'loading'`. Mientras el gate está activo, el `<section>` de página se sigue montando de inmediato (para preservar foco y scroll-to-top ya documentados) y su contenido interno muestra `RuntimeBlockingLoadingIndicator` en lugar del `LayoutRenderer`. El gate solo aplica en el momento de creación de la tanda: una vez levantado para un `entryId` dado, no vuelve a activarse aunque una query bloqueante retorne a `loading` posteriormente.

### Fuera de alcance
- No tocar el gate de app-mount (T05).
- No modificar el contrato de `pageEntry.status`, la política de reintentos ni la preparación de tanda.
- No introducir un nuevo estado observable en el store del runtime: la decisión se deriva por render (D2).

### Dependencias
T01, T02, T03.

### Interfaces
- Consume:
  - `RuntimePreloadConfig.blocking?: boolean` (de T01).
  - `deriveBlockingPreloadNames(preloads: readonly RuntimePreloadConfig[]): string[]` (de T02).
  - `isPreloadGateBlocked(blockingNames: readonly string[], queries: RuntimeState['queries']): boolean` (de T02).
  - `RuntimeBlockingLoadingIndicator(): JSX.Element` (de T03).
- Produce: ninguno.

### Impacto esperado en archivos
- Código:
  - `src/runtime/runtime-page.tsx` (modificar el render dentro del `<section>` para alternar entre indicador y `LayoutRenderer` según el derivado)
- Tests:
  - `src/tests/runtime/runtime-page-entry-preloads.test.tsx` (ampliación) — es el fichero ya establecido para el ciclo de `pageEntry` con `preloads`.
- Documentación afectada: `ai-workflow/docs/app-features/queries/preloads.md`, `ai-workflow/docs/app-features/navigation/navigate-actions.md` (si el equipo decide reflejar la separación entre montaje del `<section>` y aparición del contenido).

### Notas de implementación relevantes
- Filtrado efectivo: el subconjunto bloqueante para la tanda actual se calcula desde las precargas del `page` activo (`page.preloads ?? []`) intersectado con `state.pageEntry.preloadNames` para respetar el filtrado ya aplicado por `when` (consistente con `plan-page-preloads.ts`). El orden puede seguir el de `page.preloads`.
- Latching por `entryId`: usar un `useRef<number | null>` (o `useRef<Set<number>>`) para recordar los `entryId` para los que el gate ya se ha levantado. Mientras el `entryId` activo no esté en el conjunto, `isPreloadGateBlocked` decide render. En cuanto devuelve `false` para el `entryId` activo, se marca como levantado y no vuelve a bloquear aunque una query bloqueante retorne a `loading`.
- El `<section>` se monta siempre (preservar foco programático y scroll-to-top ya documentados en `page-model.md` y `navigate-actions.md`). Solo cambia lo que va dentro del `<section>`.
- El caso `page === null` sigue devolviendo el `<section>` vacío existente y no evalúa gate.
- Precargas no bloqueantes de la misma tanda no afectan al gate y siguen ejecutándose en paralelo tal como hoy.
- Una tanda con `pageEntry.status === 'idle'` (todas las precargas omitidas por `when` o página sin precargas) tiene `blockingNames = []` y el gate nunca bloquea.
- La latching debe resetearse al cambiar de `entryId` (nuevo entry → volver a evaluar el gate desde cero).

### Tests

#### Ficheros de test
- `src/tests/runtime/runtime-page-entry-preloads.test.tsx` (ampliación)

#### Comportamiento cubierto
- Entrar en una página con dos precargas, una `blocking: true` y otra sin flag: mientras la bloqueante está en `loading`, el `<section>` está en el DOM pero no aparece el árbol de `layout` (comprobable por ausencia de un nodo del layout esperado); en su lugar aparece el `RuntimeBlockingLoadingIndicator` (`role="status"` dentro del `<section>`).
- Cuando la precarga bloqueante pasa a `success`, el gate se levanta y el árbol de `layout` se renderiza; el indicador desaparece.
- Cuando la precarga bloqueante pasa a `error`, el gate se levanta igualmente y el árbol de `layout` se renderiza; el nodo consumidor con `queryStateFeedback` para `error` refleja su feedback configurado.
- La precarga no bloqueante de la misma tanda ejecuta en paralelo y no retrasa el render: una vez levantado el gate, su estado se refleja por su propio `queryStateFeedback`, esté aún en `loading`, `success` o `error`.
- Entrar en una página sin ninguna precarga bloqueante (aunque tenga precargas normales) no muestra el indicador: el `layout` se renderiza de inmediato.
- Entrar en una página cuya única precarga tiene `blocking: true` pero se omite por su condición `when`: no aparece indicador, el `layout` se renderiza de inmediato.
- Reentrada a la misma página cuando la firma bloqueante ya está en `success` en `queries.*` (no se relanza el fetch, por reevaluación selectiva por firma): el `layout` se renderiza de inmediato, sin pasar por el indicador.
- Latching: una vez el gate se ha levantado para una `entryId`, forzar transitivamente a la query bloqueante a volver a `loading` dentro de la misma entrada no vuelve a ocultar el `layout`.
- El `<section>` (`data-testid="runtime-page"`) permanece montado durante el bloqueo (no se desmonta y remonta al levantarse el gate).

#### Comandos durante la implementación
- `pnpm test --run src/tests/runtime/runtime-page-entry-preloads.test.tsx`

### Criterios de finalización
- `RuntimePage` decide entre `RuntimeBlockingLoadingIndicator` y `LayoutRenderer` mediante las primitivas de T02 y el filtrado descrito arriba.
- Latching por `entryId` implementado correctamente.
- Todos los tests ampliados en verde.

### Cierre de implementación
Cambios en `runtime-page.tsx` y tests ampliados en verde; comportamiento observable para `pages[].preloads` conforme a la spec.

---

## T05 — Gate de bloqueo en app-mount (bloque raíz `preloads`)

### Objetivo
Retrasar el render inicial de `RuntimePage` cuando alguna precarga del bloque raíz `preloads` marcada `blocking: true` sigue en `queries[name].status === 'loading'` en el primer montaje del runtime. Mientras el gate está activo, en lugar de `RuntimePage` se muestra `RuntimeBlockingLoadingIndicator`. El resto del shell (`AppShellHeader`, `AppShellSidebar`) se sigue montando normalmente. El gate solo aplica al montaje inicial: una vez levantado, no vuelve a activarse aunque una query bloqueante retorne a `loading` posteriormente (por ejemplo, por ejecución manual concurrente ya soportada).

### Fuera de alcance
- No tocar el gate de página (T04) — ya cerrado en la tarea anterior.
- No modificar la política de reintentos de `runtime-global-preloads/` ni su siembra inicial de `queries.*` en `loading`.
- No condicionar el header/sidebar: solo se gatea el hueco de `RuntimePage`.

### Dependencias
T01, T02, T03. T04 recomendada antes para simplificar la coexistencia visual entre ambos gates.

### Interfaces
- Consume:
  - `RuntimePreloadConfig.blocking?: boolean` (de T01).
  - `deriveBlockingPreloadNames(preloads: readonly RuntimePreloadConfig[]): string[]` (de T02).
  - `isPreloadGateBlocked(blockingNames: readonly string[], queries: RuntimeState['queries']): boolean` (de T02).
  - `RuntimeBlockingLoadingIndicator(): JSX.Element` (de T03).
- Produce: ninguno.

### Impacto esperado en archivos
- Código:
  - `src/app/app-shell.tsx` (introducir un wrapper interno — inline o pequeño componente auxiliar en el mismo fichero — que decida entre renderizar `<RuntimePage />` o `<RuntimeBlockingLoadingIndicator />` según el derivado del bloque raíz). El wrapper debe vivir DENTRO de `<RuntimeStateProvider>` para acceder al estado; el resto del árbol del shell no cambia.
- Tests:
  - `src/tests/runtime/runtime-global-preloads.test.tsx` (ampliación) — es el fichero ya establecido para el comportamiento end-to-end del bloque raíz `preloads`.
- Documentación afectada: `ai-workflow/docs/app-features/queries/preloads.md`, `ai-workflow/docs/app-features/config/structure.md`.

### Notas de implementación relevantes
- El derivado es único por instancia de runtime: `deriveBlockingPreloadNames(config.preloads ?? [])`. Se evalúa una vez por render, no persiste.
- Latching por montaje del runtime: usar `useRef<boolean>` (o `useState<boolean>` con `setState` cuando se levanta) para memorizar que el gate ya se ha levantado una vez. Estado inicial: gate potencialmente activo. Cuando `isPreloadGateBlocked` devuelve `false` por primera vez, quedar levantado permanentemente.
- La siembra inicial de `queries.*` en `loading` para el bloque raíz ya la garantiza `RuntimeStateProvider` (`runtime-state-provider.tsx`); el gate puede confiar en que todos los nombres bloqueantes estarán en `loading` desde el primer render.
- Los dos gates (T04 y T05) coexisten sin coordinación adicional: el gate raíz decide si se monta `RuntimePage`; una vez montado, el gate de página decide si se muestra su `layout` o el indicador. Si ambos deberían activarse simultáneamente, el gate raíz gana en la práctica porque `RuntimePage` ni siquiera se monta. Esta interacción es exactamente lo que la spec describe.
- No modificar la firma de props de `AppShell` ni de `RuntimeStateProvider`. Todo el cambio queda contenido en el subárbol de `<RuntimeStateProvider>` dentro de `AppShell`.
- Reutilizar el mismo componente `RuntimeBlockingLoadingIndicator` de T03 en el hueco.

### Tests

#### Ficheros de test
- `src/tests/runtime/runtime-global-preloads.test.tsx` (ampliación)

#### Comportamiento cubierto
- Config con un bloque raíz `preloads` que incluye una entrada `blocking: true` y otra sin flag: en el primer render, el header y el sidebar del shell aparecen normalmente, pero en el hueco de la página se muestra `RuntimeBlockingLoadingIndicator` (`role="status"`) y no se monta `RuntimePage` (`data-testid="runtime-page"` ausente).
- Cuando la precarga bloqueante resuelve en `success`, `RuntimePage` pasa a montarse y el `RuntimeBlockingLoadingIndicator` desaparece; el `layout` de la página inicial se renderiza.
- Cuando la precarga bloqueante resuelve en `error` (agotados los reintentos del bloque raíz), el gate se levanta igualmente y `RuntimePage` se monta con el `layout` de la página inicial.
- Config con un bloque raíz `preloads` sin ninguna entrada `blocking: true`: el gate raíz nunca bloquea y `RuntimePage` se monta desde el primer render, aunque queries del bloque raíz sigan en `loading`.
- Config sin bloque raíz `preloads`: sin cambio de comportamiento respecto al estado actual; `RuntimePage` se monta desde el primer render.
- Latching: una vez el gate raíz se ha levantado (por éxito o error), forzar transitivamente a la query bloqueante a volver a `loading` (p. ej. simulando una ejecución manual concurrente sobre el mismo `operationName`) no vuelve a desmontar `RuntimePage`.
- Interacción con T04: config donde tanto el bloque raíz como `pages[initial].preloads` declaran precargas bloqueantes, con operaciones distintas. Mientras el gate raíz está activo, `RuntimePage` no se monta. Cuando el gate raíz se levanta, `RuntimePage` se monta y su propio gate de página decide si se muestra `layout` o su indicador según sus propias precargas bloqueantes.

#### Comandos durante la implementación
- `pnpm test --run src/tests/runtime/runtime-global-preloads.test.tsx`

### Criterios de finalización
- `AppShell` decide entre `<RuntimePage />` y `<RuntimeBlockingLoadingIndicator />` mediante las primitivas de T02 y la latching descrita.
- No hay regresiones observables en configs que no declaran ninguna precarga bloqueante en el bloque raíz.
- Todos los tests ampliados en verde y el conjunto global de tests sigue pasando el umbral de cobertura.

### Cierre de implementación
Cambios en `app-shell.tsx` y tests ampliados en verde; comportamiento observable para el bloque raíz `preloads` conforme a la spec.

---

## Siguiente tarea a escoger
T01. El resto sigue el orden secuencial estricto declarado arriba.
