# 0047 — tasks

Contrato de ejecución secuencial para implementar la feature 0047 (pre-carga de datos fijos en queries vía `data-values`). Cada tarea es atómica, ordenada por dependencia y debe poder cerrarse en una sola pasada de implementación. La pasada de implementación debe seguir el orden exacto T1 → T2 → T3.

Convenciones:
- Cierre de implementación: código y tests propios de la tarea verdes.
- El umbral global del 80% de cobertura sobre `src/` (`pnpm test`) es gate de cierre de la pasada de implementación; no se replica por tarea (regla en `ai-workflow/standards/testing-rules.md`).
- La pre-carga es aditiva: no debe alterar el comportamiento existente del runtime cuando no hay `data-values` ni atributo presente.

---

## T1 — Lector de bootstrap `data-values` y código de error dedicado

- **ID**: T1
- **Estado**: completed
- **Objetivo**: Añadir una frontera de bootstrap simétrica a `readRuntimeConfig` que produzca los `dataValues` aplicables al arranque del runtime. Debe leer del atributo `dataset.values` del `rootElement` en producción y caer al fichero `src/dev/data-values.json` solo cuando no hay atributo y `isDevelopment === true`. Debe rechazar con un error de bootstrap legible cuando el JSON del atributo no parsea o cuando la raíz no es un objeto plano. Debe devolver `dataValues: {}` cuando no hay ninguna fuente disponible (sin error). Crear además el fichero versionado `src/dev/data-values.json` con contenido `{}` como punto de partida. La firma del lector y su contrato de error son la frontera pública que consumirán `App.tsx` y `dev-runtime.tsx` en T3.
- **Fuera de alcance**:
  - Aplicar los `dataValues` al estado del runtime (vive en T2).
  - Cablear el lector desde `App.tsx` o `dev-runtime.tsx` (vive en T3).
  - HMR del fichero `src/dev/data-values.json` (excluido por spec).
  - Validar que las claves correspondan a operaciones declaradas en `config.api` (excluido por spec).
  - Resolver referencias dinámicas dentro de los valores (los valores son JSON literales).
  - Cambiar el lector `readRuntimeConfig` o el shape de `RuntimeConfigResult`.
- **Dependencias**: ninguna.
- **Impacto esperado en archivos**:
  - Código:
    - `src/app/bootstrap/read-runtime-data-values.ts` (nuevo) — exporta `readRuntimeDataValues({ devDataValues, isDevelopment, rootElement }): RuntimeDataValuesResult`. Implementa la precedencia atributo > dev-file > vacío, el parseo JSON, y la validación de raíz como objeto plano (rechaza array, primitivo, `null`). Exporta el tipo `RuntimeDataValuesResult` con la unión `{ status: 'ready', source: 'data-values' | 'dev-data-values' | 'none', dataValues: Record<string, unknown> } | { status: 'error', error: RuntimeDataValuesError }` y el tipo `RuntimeDataValuesError` con shape `{ code: 'invalid-data-values-json' | 'invalid-data-values-shape', displayMode: 'always', message: string }`.
    - `src/dev/data-values.json` (nuevo) — fichero versionado con contenido literal `{}`.
  - Tests:
    - `src/tests/config-validation/read-runtime-data-values.test.ts` (nuevo).
  - Documentación: `ai-workflow/docs/app-features/development/local-config.md` (impacto declarado; la actualización documental se realizará a través de `update-app-documentation` cuando el usuario la invoque manualmente).
- **Tests**:
  - Ficheros de test:
    - `src/tests/config-validation/read-runtime-data-values.test.ts` (nuevo)
  - Comportamiento cubierto:
    - Devuelve `{ status: 'ready', source: 'data-values', dataValues }` cuando `rootElement.dataset.values` contiene `'{"searchUsers":[{"id":"1","name":"Juan"}]}'`, con `dataValues` igual al objeto parseado.
    - Devuelve `{ status: 'ready', source: 'dev-data-values', dataValues }` cuando no hay `dataset.values`, `isDevelopment === true` y `devDataValues = { searchUsers: [] }`.
    - Devuelve `{ status: 'ready', source: 'none', dataValues: {} }` cuando no hay `dataset.values` y `isDevelopment === false` (sin devDataValues utilizable).
    - Devuelve `{ status: 'ready', source: 'none', dataValues: {} }` cuando no hay `dataset.values`, `isDevelopment === true`, y `devDataValues` es `{}`.
    - El atributo tiene precedencia sobre `devDataValues` aunque ambos estén presentes en desarrollo (resultado `source: 'data-values'`).
    - Devuelve `{ status: 'error', error: { code: 'invalid-data-values-json', displayMode: 'always', message: <string no vacío> } }` cuando `dataset.values` no parsea como JSON.
    - Devuelve `{ status: 'error', error: { code: 'invalid-data-values-shape', ... } }` cuando la raíz parseada es un array (`'[1,2,3]'`).
    - Devuelve `{ status: 'error', error: { code: 'invalid-data-values-shape', ... } }` cuando la raíz parseada es un primitivo (`'"hello"'`, `'42'`, `'true'`).
    - Devuelve `{ status: 'error', error: { code: 'invalid-data-values-shape', ... } }` cuando la raíz parseada es `null` (`'null'`).
    - `dataValues = {}` desde el atributo es válido y devuelve `{ status: 'ready', source: 'data-values', dataValues: {} }`.
    - Una entrada con valor `null` (p. ej. `'{"a":null}'`) es válida y devuelve `dataValues = { a: null }`.
    - Una entrada con valor primitivo (`'{"a":"x"}'`, `'{"b":3}'`, `'{"c":true}'`) es válida y se conserva el valor primitivo.
    - El lector no modifica `dataValues`: el objeto devuelto se compara por igualdad estructural con el parseado.
  - Comandos durante la implementación:
    - `pnpm test --run src/tests/config-validation/read-runtime-data-values.test.ts`
  - Restricciones:
    - Reusar el estilo y los helpers de `src/tests/config-validation/read-runtime-config.test.ts` para construir el `rootElement` y poblar `dataset.values`. No introducir un harness nuevo de DOM en esta carpeta.
    - El mensaje del error debe ser legible (no string vacío) y mencionar `data-values` o la naturaleza del problema; no se exige una redacción literal específica.
- **Documentación afectada**: `ai-workflow/docs/app-features/development/local-config.md`.
- **Criterios de finalización**:
  - El fichero `src/app/bootstrap/read-runtime-data-values.ts` existe y exporta `readRuntimeDataValues`, `RuntimeDataValuesResult` y `RuntimeDataValuesError` con el contrato descrito.
  - El fichero `src/dev/data-values.json` existe en el repositorio y contiene exactamente `{}`.
  - Todos los comportamientos del sub-bloque tests están verdes.
- **Cierre de implementación**: T1 cierra cuando los tests del fichero indicado pasan y `pnpm test` no rompe ninguna otra suite previa.

---

## T2 — Pre-carga de queries en el estado inicial del runtime

- **ID**: T2
- **Estado**: completed
- **Objetivo**: Permitir que el estado inicial del runtime se construya con un mapa `dataValues` que pre-cargue entradas en `queries.{nombre}` con `status: 'success'`, `data: <valor>`, `error: null` y `requestSignature: null` antes del primer render. La pre-carga debe convivir con la semántica existente de queries: cualquier ejecución posterior con el mismo nombre (preload, `executeOperation`, acción de botón) debe transitar a `loading` y luego al resultado real, sobreescribiendo el dato pre-cargado. El reset de preload por `pageEntry` debe seguir aplicándose a estas queries como a cualquier otra.
- **Fuera de alcance**:
  - Leer `data-values` del DOM o del fichero de dev (vive en T1).
  - Cablear el `RuntimeStateProvider` desde `App.tsx` o `dev-runtime.tsx` (vive en T3).
  - Cambiar el shape de `RuntimeQueryState` o de `RuntimeState`.
  - Resolver referencias dentro de los valores de `data-values` (los valores son literales JSON).
  - Validar que las claves correspondan a operaciones declaradas en `config.api`.
  - Cambiar el reducer para acciones nuevas: la pre-carga ocurre en `createRuntimeState`, no añade tipos de acción.
- **Dependencias**: T1 cerrado (el tipo `Record<string, unknown>` consumido por `createRuntimeState` proviene conceptualmente del lector de T1; aunque T2 no importa el lector, comparte la forma de los datos).
- **Impacto esperado en archivos**:
  - Código:
    - `src/runtime/runtime-state/runtime-state-reducer.ts` — extender `createRuntimeState` para aceptar un segundo parámetro `options?: { dataValues?: Record<string, unknown> }`. Cuando `options.dataValues` es un objeto no vacío, inicializar el campo `queries` con una entrada por clave, con `{ status: 'success', data: value, error: null, requestSignature: null }`. Cuando `options.dataValues` es `undefined` o `{}`, comportamiento idéntico al actual (`queries: {}`).
    - `src/runtime/runtime-state/runtime-state-provider.tsx` — extender la prop de `RuntimeStateProvider` con `dataValues?: Record<string, unknown>`. Reenviarla a `createRuntimeStateFromBrowserHash` (renombrar internamente o ampliar la firma para aceptarla). `createRuntimeStateFromBrowserHash` debe pasar `dataValues` a `createRuntimeState`. El `initialState` expuesto vía contexto debe reflejar el estado pre-cargado.
  - Tests:
    - `src/tests/runtime-state/runtime-state-data-values.test.tsx` (nuevo).
  - Documentación: `ai-workflow/docs/app-features/queries/state-model.md` (impacto declarado; la actualización documental se realizará a través de `update-app-documentation`).
- **Tests**:
  - Ficheros de test:
    - `src/tests/runtime-state/runtime-state-data-values.test.tsx` (nuevo)
  - Comportamiento cubierto:
    - Con `RuntimeStateProvider config={c} dataValues={{ searchUsers: [{ id: '1', name: 'Juan' }] }}>`, en el primer render `useRuntimeState().queries.searchUsers` es `{ status: 'success', data: [{ id: '1', name: 'Juan' }], error: null, requestSignature: null }`.
    - Sin prop `dataValues`, el estado inicial mantiene `queries: {}` (regresión).
    - Con `dataValues = {}`, el estado inicial mantiene `queries: {}`.
    - Con una entrada de valor `null` (`{ a: null }`), `queries.a` queda en `{ status: 'success', data: null, error: null, requestSignature: null }`.
    - Con una entrada de valor primitivo (string/number/boolean), el primitivo se conserva en `data`.
    - Con varias entradas mezclando objeto, array, primitivo y `null`, todas quedan en `success` con su `data` respectivo y sin error.
    - Tras pre-cargar `searchUsers` y ejecutar `executeQueryOperation('searchUsers', ...)` con una `api.searchUsers` configurada y un `fetch` mockeado: la query transita a `status: 'loading'` y posteriormente al resultado real, sobreescribiendo los datos pre-cargados (`data` deja de ser el valor seed).
    - Tras pre-cargar `searchUsers` y navegar a una página cuyo `preloads` lo incluye, el estado de `searchUsers` se resetea a `loading` (y luego al resultado real); la pre-carga no sobrevive al ciclo de reset.
    - Una entrada de `dataValues` con nombre que no existe en `config.api` igualmente queda en `queries.{nombre}` con `status: 'success'` (no se valida la existencia de la operación).
    - Un consumidor de layout que referencia `queries.searchUsers.data` (por ejemplo un `list` con `items.source: 'queries.searchUsers.data'`) renderiza los datos pre-cargados en el primer render sin ejecutar ninguna llamada API.
    - `createRuntimeState(config)` (sin segundo parámetro) y `createRuntimeState(config, { dataValues: {} })` producen estados estructuralmente equivalentes.
  - Comandos durante la implementación:
    - `pnpm test --run src/tests/runtime-state/runtime-state-data-values.test.tsx`
  - Restricciones:
    - Reusar el patrón de fixtures de `src/tests/runtime-state/runtime-state-forms-queries.test.tsx` y `runtime-state-operations.test.tsx` (`RuntimeStateSnapshot`, `RuntimeStateProvider`, `useRuntimeStateActions`, `RuntimePage`) para evitar duplicar harness.
    - Para los casos de `executeQueryOperation`, mockear `fetch` con `vi.fn()` como en `runtime-state-operations.test.tsx` sin introducir un mock global nuevo.
    - No añadir snapshots de markup; afirmar sobre el `JSON.stringify(state)` o sobre selectores específicos del estado.
- **Documentación afectada**: `ai-workflow/docs/app-features/queries/state-model.md`.
- **Criterios de finalización**:
  - `createRuntimeState` admite el parámetro opcional y produce el estado pre-cargado según el contrato.
  - `RuntimeStateProvider` admite la prop `dataValues` y reenvía la pre-carga al estado inicial.
  - Las suites existentes que renderizan `RuntimeStateProvider` sin `dataValues` siguen verdes (regresión cero).
  - Los nuevos comportamientos del sub-bloque tests están verdes.
- **Cierre de implementación**: T2 cierra cuando los tests del fichero nuevo y los previos de `runtime-state/` siguen verdes.

---

## T3 — Cableado en `App` y `DevRuntime` y errores de bootstrap unificados

- **ID**: T3
- **Estado**: completed
- **Objetivo**: Conectar el lector de T1 con el estado pre-cargado de T2 en los dos puntos de arranque del runtime (`App.tsx` para producción y `dev-runtime.tsx` para desarrollo). El error del lector de `data-values` debe mostrarse a través del mismo `AppShell` que ya muestra los errores de `data-config`. La precedencia entre fuentes debe coincidir con la de `data-config`: atributo > fichero local de dev > vacío. Cuando `data-values` está ausente y `data-config` está listo, el runtime arranca normalmente sin entradas pre-cargadas.
- **Fuera de alcance**:
  - Cambiar la semántica de error de `data-config` o el shape de `RuntimeConfigError`.
  - Validar el contenido de `dataValues` contra `config.api`.
  - HMR del fichero `src/dev/data-values.json` (excluido por spec).
  - Mostrar varios errores simultáneamente: si tanto `data-config` como `data-values` están en error, prevalece el de `data-config` (los `data-values` no se aplican porque el runtime no llega a montar el provider).
  - Modificar el dev editor Monaco o el drawer para editar `data-values` en vivo.
- **Dependencias**: T1 y T2 cerradas.
- **Impacto esperado en archivos**:
  - Código:
    - `src/app/App.tsx` — importar `devDataValues` desde `'../dev/data-values.json'` (analogía exacta con `'../dev/config.json'`). Aceptar una prop opcional `devDataValuesOverride?: Record<string, unknown>` con el mismo patrón que `devConfigOverride`. Invocar `readRuntimeDataValues({ devDataValues: devDataValuesOverride ?? devDataValues as Record<string, unknown>, isDevelopment, rootElement })`. Pasar a `AppShell` siempre las tres piezas: `runtimeConfig`, `dataValues` (si el lector está ready), y `dataValuesError` (si el lector está en error). Si `runtimeConfig` está en error, `dataValuesError` se ignora aguas abajo (precedencia fijada en `AppShell`).
    - `src/app/app-shell.tsx` — aceptar dos props nuevas independientes de `runtimeConfig`: `dataValues?: Record<string, unknown>` (reenviada a `RuntimeStateProvider` cuando el shell pinta el árbol funcional) y `dataValuesError?: RuntimeDataValuesError` (rama de error). No se altera el tipo `RuntimeConfigResult`. Precedencia: si `runtimeConfig.status === 'error'`, se pinta el bloque de error existente con el `runtimeConfig.error` actual sin tocar `dataValuesError`; si `runtimeConfig.status === 'ready'` y `dataValuesError` está presente, se pinta el mismo bloque de error reutilizando literalmente el mismo markup (mismo `<main>`, misma `<section>`, mismo eyebrow con texto "Runtime config error", misma heading "Runtime configuration could not be loaded." y mismo `<p data-testid="runtime-error-message">` con `dataValuesError.message`), respetando `dataValuesError.displayMode`. Solo cuando ambos están ready se monta el `RuntimeStateProvider` con `dataValues`.
    - `src/dev-runtime/dev-runtime.tsx` — leer `dataValues` con el mismo `readRuntimeDataValues`, importando `devDataValuesJson` desde `'../dev/data-values.json'`. Si el lector devuelve error, renderizar `AppShell` con el error como hace hoy con `bootstrapResult.status === 'error'`. Si está ready, pasar `dataValues` a `RuntimeStateProvider` dentro de `DevRuntimeReady`. No conectar HMR ni el drawer al fichero `data-values.json`.
  - Tests:
    - `src/tests/app/app-bootstrap.test.tsx` (ampliación).
    - `src/tests/dev-runtime/dev-runtime.test.tsx` (ampliación).
  - Documentación: `ai-workflow/docs/app-features/development/local-config.md` y `ai-workflow/docs/app-features/queries/state-model.md` (impacto declarado; la actualización documental se realizará a través de `update-app-documentation`).
- **Tests**:
  - Ficheros de test:
    - `src/tests/app/app-bootstrap.test.tsx` (ampliación)
    - `src/tests/dev-runtime/dev-runtime.test.tsx` (ampliación)
  - Comportamiento cubierto:
    - En `App` con `rootElement.dataset.values = '{"searchUsers":[{"id":"1","name":"Juan"}]}'` y un `config` cuyo layout incluye un `list` con `items.source: 'queries.searchUsers.data'` proyectando `item.name`, el render inicial muestra "Juan" sin necesidad de esperar fetch alguno.
    - En `App` con `dataset.values` ausente y `isDevelopment={false}`, el render no muestra error y `queries` está vacío (la app arranca normalmente con `data-config`).
    - En `App` con `dataset.values` con JSON inválido (y `data-config` válido o `isDevelopment` con dev-config válido), el `AppShell` renderiza el mismo bloque de error que usa hoy para `data-config`: heading "Runtime configuration could not be loaded.", eyebrow con texto "Runtime config error", y `data-testid="runtime-error-message"` con el mensaje del error del lector de `data-values`.
    - En `App` con `dataset.values` cuya raíz es un array (`'[1,2,3]'`), el `AppShell` renderiza el mismo bloque de error con el `data-testid="runtime-error-message"` mostrando el mensaje del error de shape.
    - **Doble error (precedencia)**: en `App` con `dataset.config` inválido y `dataset.values` también inválido, el bloque de error muestra el `runtime-error-message` correspondiente al error de `data-config` (no al de `data-values`); el runtime no monta el `RuntimeStateProvider`.
    - **Error solo en `data-values`**: en `App` con `dataset.config` ausente y `isDevelopment={true}` (dev-config válido) y `dataset.values` con JSON inválido, el bloque de error muestra el `runtime-error-message` con el mensaje del error de `data-values`; el `RuntimeStateProvider` no se monta.
    - **Error solo en `data-config`**: en `App` con `dataset.config` inválido y `dataset.values` con un objeto válido (`'{"x":1}'`), el bloque de error muestra el `runtime-error-message` con el mensaje del error de `data-config`; las entradas de `data-values` no se aplican.
    - En `App` con `isDevelopment={true}`, sin `dataset.values`, pasando `devDataValuesOverride={{ greeting: 'hola' }}`, `queries.greeting` está pre-cargado y consumible desde el primer render.
    - En `App` con `dataset.values` y `devDataValuesOverride` presentes, prevalece el atributo (el dato del atributo es el visible).
    - En `DevRuntime`, sin `dataset.values`, las entradas que aporte un `devDataValuesJson` (vía el import por defecto, mockeable con `vi.mock('../dev/data-values.json', ...)` en el test) se pre-cargan y son consumibles.
    - En `DevRuntime`, con `dataset.values` con JSON inválido, se renderiza el bloque de error del `AppShell` (no se monta el `DevRuntimeReady`).
    - El test existente de `App` que verifica el arranque vacío sin `data-values` ni `dataset.values` (caso baseline) sigue verde sin cambios funcionales.
  - Comandos durante la implementación:
    - `pnpm test --run src/tests/app/app-bootstrap.test.tsx`
    - `pnpm test --run src/tests/dev-runtime/dev-runtime.test.tsx`
  - Restricciones:
    - Reusar la prop pattern de `devConfigOverride` / `rootElement` para `devDataValuesOverride` en `App`: misma firma estilística, mismo defaulting.
    - Para mockear el import del fichero `src/dev/data-values.json` en los tests de `DevRuntime`, usar `vi.mock('../../dev/data-values.json', () => ({ default: { ... } }))` consistente con cómo el resto del fichero ya organiza sus mocks.
    - El bloque de error reutilizado no debe duplicar markup: si hace falta refactor de `app-shell.tsx`, mantenerlo localizado al contrato de error y no cambiar el árbol DOM externo del shell ya en producción (los `data-testid` `runtime-app`, `runtime-shell-content`, `runtime-shell-frame`, `runtime-error-eyebrow`, `runtime-error-message` deben sobrevivir intactos).
    - No añadir nuevos modos de display: `displayMode: 'always'` para los códigos de error nuevos (definidos en T1) basta.
- **Documentación afectada**: `ai-workflow/docs/app-features/development/local-config.md`, `ai-workflow/docs/app-features/queries/state-model.md`, y potencialmente `ai-workflow/docs/current-state.md` si el área "Desarrollo local" o "Queries" cambia de estado vigente.
- **Criterios de finalización**:
  - `App` y `DevRuntime` leen `data-values` con la misma precedencia que `data-config`.
  - El error del lector de data-values se muestra por el mismo `AppShell` con la misma frontera visual.
  - El `RuntimeStateProvider` recibe `dataValues` y la pre-carga es visible en el primer render.
  - Los tests existentes de `app-bootstrap.test.tsx` y `dev-runtime.test.tsx` siguen verdes.
  - Los nuevos comportamientos del sub-bloque tests están verdes.
  - `pnpm test` pasa cumpliendo el umbral global de cobertura del 80% sobre `src/`.
- **Cierre de implementación**: T3 cierra cuando los tests indicados están verdes, la suite completa pasa y se respeta el umbral global de cobertura.

---

## Siguiente tarea sugerida
T1. Es la frontera de bootstrap sobre la que se apoyan T2 y T3, y no tiene dependencias previas. El orden recomendado de ejecución es T1 → T2 → T3.
