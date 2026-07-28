# Spec: Runtime state provider decomposition

## Objetivo

Cerrar la parte todavía pendiente del hallazgo A-03 de la auditoría técnica del repo (2026-07-27).
`src/runtime/runtime-state/runtime-state-provider.tsx` tenía originalmente 1.258 líneas mezclando el provider de
React, hooks-fachada y planificación de preloads. Una feature de limpieza de lint no relacionada
(`fix/lint-errors-cleanup`) ya extrajo `useRuntimeState`/`useRuntimeStateActions`/`useRuntimeConfig`/
`useRuntimeCurrentPage` a `src/runtime/runtime-state/use-runtime-state.ts` y las funciones de ejecución de queries a
`src/runtime/runtime-state/runtime-state-query-execution.ts`, como efecto colateral de arreglar
`react-refresh/only-export-components`. Eso resolvió la mitad del hallazgo original.

Lo que queda hoy en `runtime-state-provider.tsx` (607 líneas, verificado) es el componente `RuntimeStateProvider` en
sí (5 efectos entrelazados: sync de hash inicial, listener `hashchange`/`popstate`, efecto que planifica preloads al
navegar, efecto que ejecuta los preloads planificados) más 10 funciones auxiliares puras sin JSX ni hooks
(`arePageParamsEqual`, `arePreloadNamesEqual`, `isMatchingPageEntryState`, `planPagePreloadExecution`,
`evaluatePreloadExecution`, `createPreloadPlanningSnapshot`, `deriveAggregatePageEntryStatus`,
`createPlannedPreloadBatchSignature`, `createRuntimeStateFromBrowserHash`, `replaceBrowserHash`).

Las primeras 8 de esas 10 funciones son el motor de decisión de qué preloads de página (`pages[].preloads`) disparar
y cuándo — lógica de negocio pura — pero viven encerradas dentro de un fichero de componente React y solo se
ejercitan hoy de forma indirecta, montando el provider completo, vía `src/tests/runtime/
runtime-page-entry-preloads.test.tsx` (1.893 líneas) y `src/tests/runtime-state/runtime-state-forms-queries.test.tsx`
(2.449 líneas). No tienen ningún test unitario propio.

Ya se investigó con el usuario si esto vuelve redundantes los tests de integración existentes: no. Verifican
comportamiento de React que una función pura y síncrona no puede ejercitar por sí sola (que el efecto dispare en el
momento correcto, que un re-render no duplique trabajo, condiciones de carrera con `Promise.all` y `fetch` mockeado
resolviendo en orden impredecible, interacción cruzada con el dominio de formularios en `goBack`). Los tests
unitarios nuevos cubren la lógica de decisión en aislado, complementando, no sustituyendo, la suite de integración
existente.

Es una reorganización puramente mecánica con adición de tests: mismas firmas de función, mismo comportamiento
runtime, sin cambio en preloads, navegación ni queries.

## Alcance

- Crear `src/runtime/runtime-global-preloads/plan-page-preloads.ts` con las 8 funciones de planificación de preloads
  por página (`arePageParamsEqual`, `arePreloadNamesEqual`, `isMatchingPageEntryState`, `planPagePreloadExecution`,
  `evaluatePreloadExecution`, `createPreloadPlanningSnapshot`, `deriveAggregatePageEntryStatus`,
  `createPlannedPreloadBatchSignature`), junto con los tipos locales que hoy solo existen para describir su
  contrato de entrada/salida (`PlannedPreloadReloadItem`, `PlannedPreloadBatch`), tal cual existen hoy en
  `runtime-state-provider.tsx`.
  - El nombre se elige en paralelo al fichero hermano ya existente `plan-global-preloads.ts` (mismo patrón:
    `plan-<ámbito>-preloads.ts`) para que ambos ficheros queden lado a lado con responsabilidades explícitas y no
    solapadas: `plan-global-preloads.ts` planifica el bloque raíz `preloads` (una vez por instancia de runtime,
    sin `pageEntry`); `plan-page-preloads.ts` planifica `pages[].preloads` (por `pageEntry`, con `entryId`/params).
    Ver Riesgos para la evaluación de solape y de ciclos de import.
  - Se exportan las 8 funciones (todas se consumen directamente desde `runtime-state-provider.tsx` hoy, no solo
    `planPagePreloadExecution`) y los dos tipos, y se re-exportan desde el barrel existente
    `src/runtime/runtime-global-preloads/index.ts`, siguiendo el mismo patrón que ya usan `planGlobalPreloads` y
    `useRuntimeGlobalPreloads`.
- Mover `replaceBrowserHash` a `src/runtime/runtime-navigation/browser-hash-navigation.ts`, con el mismo nombre y
  comportamiento. `runtime-state-provider.tsx` pasa a importarla desde ahí junto con
  `parseBrowserHashNavigationHash`.
- `createRuntimeStateFromBrowserHash` permanece en `runtime-state-provider.tsx`. Ver Riesgos para la justificación.
- `runtime-state-provider.tsx` actualiza sus imports para consumir las 8 funciones movidas desde
  `../runtime-global-preloads` y `replaceBrowserHash` desde `../runtime-navigation/browser-hash-navigation`, sin
  cambiar ninguna llamada ni ningún argumento.
- Añadir un fichero de test unitario nuevo, sin montar ningún componente de React ni usar `@testing-library/react`,
  para las 8 funciones movidas.

## Fuera de alcance

- Cualquier cambio de comportamiento observable de preloads, navegación o queries.
- Reorganizar `use-runtime-state.ts` ni `runtime-state-query-execution.ts` (ya resueltos por la feature de lint
  previa).
- Reorganizar o recortar los tests de integración existentes (`runtime-page-entry-preloads.test.tsx` y similares):
  quedan intactos, son complementarios, no redundantes.
- Cualquier cambio en `runtime-state-reducer.ts`, `runtime-state-types.ts`, `runtime-state-selectors.ts` ni
  `runtime-state-context.ts`. Nota: `runtime-state-reducer.ts` ya tiene hoy su propia función privada, no exportada,
  también llamada `arePageParamsEqual` (línea 670), con una lógica distinta (compara únicamente contra los params de
  la entrada de navegación actual). Es una duplicación de nombre preexistente, no introducida por esta feature; no
  hay colisión real porque ninguna de las dos se exporta hacia la otra, y no se toca por estar
  `runtime-state-reducer.ts` fuera de alcance.
- Mover `createRuntimeStateFromBrowserHash` fuera de `runtime-state-provider.tsx`.
- Rediseñar el mecanismo de planificación de preloads (por ejemplo cambiar cuándo se considera que una query
  necesita recarga); es puramente movimiento de código y adición de tests, no rediseño de la lógica.

## Requisitos funcionales

1. Las 8 funciones de planificación de preloads de página quedan definidas en
   `src/runtime/runtime-global-preloads/plan-page-preloads.ts`, exportadas, con idéntica firma y comportamiento que
   hoy.
2. `replaceBrowserHash` queda definida en `src/runtime/runtime-navigation/browser-hash-navigation.ts`, exportada,
   con idéntica firma y comportamiento que hoy.
3. `runtime-state-provider.tsx` deja de declarar las 8 funciones de planificación y `replaceBrowserHash`; solo
   contiene el componente `RuntimeStateProvider`, `createRuntimeStateFromBrowserHash` y los tipos/refs/efectos que
   dependen directamente de React.
4. Ningún consumidor observa cambio de comportamiento: mismos preloads disparados, mismo `pageEntry.status`, misma
   política de reevaluación por firma, misma navegación por hash.
5. Las 8 funciones movidas cuentan con tests unitarios propios que no montan React, cubriendo al menos:
   - `deriveAggregatePageEntryStatus`: agregado `loading` cuando al menos una query relevante está `loading`,
     `error` cuando ninguna está `loading` pero al menos una está `error`, `success` en el resto de casos.
   - `evaluatePreloadExecution` / `planPagePreloadExecution`: `shouldReload: false` cuando la firma de request
     efectiva coincide con la ya visible en `queries.{operationName}` (no-reload por firma sin cambios), y
     `shouldReload: true` cuando diverge o cuando el estado actual está en error con distinto `code`/`message`.
   - `createPreloadPlanningSnapshot`: las queries incluidas en `preloadNames` quedan reseteadas a
     `{ status: 'idle', data: null, error: null, requestSignature: null }` en el snapshot devuelto; las que no están
     incluidas conservan su estado original sin mutación.
   - `isMatchingPageEntryState`, `arePageParamsEqual`, `arePreloadNamesEqual`: casos de igualdad y desigualdad por
     `entryId`, `pageId`, `status`, params y orden/contenido de `preloadNames`.
   - `createPlannedPreloadBatchSignature`: misma firma para el mismo input, firma distinta si cambia cualquier
     campo relevante (`entryId`, `pageId`, `params`, `preloadNames`, `requestSignature`/`error` de alguna
     evaluación).

## Requisitos no funcionales

- `src/runtime/runtime-global-preloads/plan-page-preloads.ts` no importa nada de `runtime-state-provider.tsx` (la
  dirección de dependencia sigue siendo provider → `runtime-global-preloads/`, nunca al revés).
- No se introduce ningún ciclo de import nuevo entre `runtime-global-preloads/`, `runtime-state/` ni
  `runtime-navigation/` como consecuencia de este movimiento.
- La cobertura global de tests se mantiene en el umbral mínimo del 80% sobre `src/`.
- Los nuevos ficheros siguen `kebab-case` y las convenciones ya vigentes en `src/runtime/`.

## Criterios de aceptación

1. `grep -n "function arePageParamsEqual\|function arePreloadNamesEqual\|function isMatchingPageEntryState\|function planPagePreloadExecution\|function evaluatePreloadExecution\|function createPreloadPlanningSnapshot\|function deriveAggregatePageEntryStatus\|function createPlannedPreloadBatchSignature\|function replaceBrowserHash" src/runtime/runtime-state/runtime-state-provider.tsx` no devuelve ninguna coincidencia.
2. `grep -n "function createRuntimeStateFromBrowserHash" src/runtime/runtime-state/runtime-state-provider.tsx` sigue devolviendo una coincidencia (permanece donde estaba).
3. Las 8 funciones y sus 2 tipos de soporte están definidos y exportados desde
   `src/runtime/runtime-global-preloads/plan-page-preloads.ts`, y re-exportados desde
   `src/runtime/runtime-global-preloads/index.ts`.
4. `replaceBrowserHash` está definida y exportada desde `src/runtime/runtime-navigation/browser-hash-navigation.ts`.
5. `pnpm test` completa en verde, incluida la suite de integración existente
   (`runtime-page-entry-preloads.test.tsx`, `runtime-state-forms-queries.test.tsx`) sin cambiar ninguna aserción de
   comportamiento.
6. El nuevo fichero de test unitario para las 8 funciones de planificación no importa `@testing-library/react` ni
   monta ningún componente, y cubre al menos los casos listados en el requisito funcional 5.
7. `pnpm build` completa sin errores tras el movimiento.
8. El umbral global de cobertura del 80% sobre `src/` sigue cumpliéndose.

## Casos límite

- **`preloadNames.length === 0`**: `planPagePreloadExecution` debe seguir devolviendo `aggregateStatus: 'idle'` y
  `batchSignature: ''` cuando ninguna precarga de la página sobrevive al filtro `when` (sin regresión).
- **Error determinista de compose (`operation-not-found`, `request-build-failed`)**: `evaluatePreloadExecution`
  debe seguir marcando `shouldReload: true` solo cuando el estado actual no está ya en error con el mismo `code` y
  `message`.
- **`createPreloadPlanningSnapshot` con `preloadNames` vacío**: debe devolver el mismo objeto `state` sin clonar
  (comportamiento actual, no cambia).
- **Params con claves en distinto orden**: `arePageParamsEqual` compara por claves, no por orden de inserción; un
  test unitario debe cubrir explícitamente que el orden de las claves no afecta el resultado.

## Riesgos o preguntas abiertas

Ninguno bloqueante. Investigado y resuelto con datos concretos:

- **Solape de responsabilidad con `plan-global-preloads.ts`**: no existe. `plan-global-preloads.ts` planifica el
  bloque raíz `preloads` (una vez por instancia de runtime montada, sin `pageEntry`, sin `when`, sin reintentos
  acotados propios del bloque raíz). Las 8 funciones movidas planifican `pages[].preloads` (por `pageEntry`, con
  `entryId`, evaluación de `when`, reevaluación por firma al reentrar). Son mecanismos declarados como
  "complementarios y con ciclos de vida distintos" en `ai-workflow/docs/app-features/queries/preloads.md`. No hay
  redundancia real que justifique fusionar ambos ficheros.
- **Ciclo de import**: no se detecta ninguno. `runtime-global-preloads/` ya depende hoy de `queries/` y de tipos de
  `runtime-state/runtime-state-types.ts` (solo tipos); las 8 funciones movidas añaden una dependencia del mismo
  tipo hacia `config/runtime-config` (tipos), `queries/runtime-api-executor` (`buildRuntimeApiRequest`, ya usado
  por `plan-global-preloads.ts`) y `runtime-layout-visibility` (`matchesVisibilityRule`, función pura sin
  dependencia hacia `runtime-state-provider.tsx`). `runtime-state-provider.tsx` ya importa hoy de
  `runtime-global-preloads/` (para `planGlobalPreloads`/`useRuntimeGlobalPreloads`), así que la dirección de
  dependencia (provider → `runtime-global-preloads/`) no cambia, solo crece.
  `requires_design: false` se confirma con esta evidencia.
- **Nota de naming (no bloqueante)**: la carpeta destino se llama `runtime-global-preloads/`, un nombre que hoy
  describe solo el mecanismo del bloque raíz. Alojar ahí también la planificación de `pages[].preloads` (un
  mecanismo distinto) introduce una ligera tensión semántica en el nombre de la carpeta. No se renombra la carpeta
  en esta feature porque el usuario ya fijó esa ubicación como destino explícito y renombrarla ampliaría el alcance
  a un cambio transversal de imports no solicitado; queda como posible limpieza futura, no bloqueante.
- **`createRuntimeStateFromBrowserHash` permanece en el provider, no se mueve a `browser-hash-navigation.ts`**:
  evaluado y descartado. A diferencia de `replaceBrowserHash` (una función de una línea que solo lee/escribe el
  hash del navegador, cohesiva con el resto de `browser-hash-navigation.ts`), `createRuntimeStateFromBrowserHash`
  construye un `RuntimeState` completo: llama a `createRuntimeState` (del reducer), a `planGlobalPreloads` (de
  `runtime-global-preloads/`) y ensambla `navigation`/`pageEntry` iniciales. Moverla a
  `runtime-navigation/browser-hash-navigation.ts` invertiría la dirección de dependencia actual (hoy
  `browser-hash-navigation.ts` es una hoja que solo importa tipos de `config/runtime-config`; pasaría a depender de
  `runtime-state/` y `runtime-global-preloads/`), lo que no es una mejora de cohesión sino un desplazamiento del
  problema. Permanece en `runtime-state-provider.tsx`, donde ya se consume una única vez
  (`useState(() => createRuntimeStateFromBrowserHash(...))`); es la única de las 10 funciones originales que sigue
  sin test unitario propio tras esta feature, ya que no es el foco del hallazgo A-03 (que apunta específicamente a
  la lógica de planificación de preloads) y moverla o testearla de forma aislada excede el alcance mecánico
  acordado.

## Áreas de producto afectadas

- `src/runtime/runtime-state/` (pierde funciones internas, gana imports) y `src/runtime/runtime-global-preloads/`
  (gana un fichero nuevo). No es una feature de producto visible; no cambia comportamiento para el usuario final de
  la aplicación construida con el runtime.

## Documentación probablemente afectada

- `ai-workflow/docs/app-features/runtime/organization.md`: la línea sobre `src/runtime/runtime-state/` ("concentra
  el provider, reducer, tipos, selectors y acciones del estado compartido del runtime") sigue siendo cierta sin
  cambios; puede merecer una mención de que la planificación de `pages[].preloads` vive ahora en
  `runtime-global-preloads/` junto a la del bloque raíz.
- `ai-workflow/docs/test-index.md`: añadir la entrada del nuevo fichero de test unitario en la sección `runtime/`.
- `ai-workflow/docs/app-features/queries/preloads.md`: no debería requerir cambio de fondo (el comportamiento
  descrito no cambia), salvo que se considere útil mencionar la ubicación del módulo que implementa la
  planificación por página.
