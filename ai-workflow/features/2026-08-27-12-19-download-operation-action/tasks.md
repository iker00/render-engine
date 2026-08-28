# Tasks: descarga de ficheros vía fetch autenticado desde `button`/`link`

Contrato de ejecución para la feature `2026-08-27-12-19-download-operation-action`. Sigue las decisiones D1–D9 de `design.md`. No reinterpretar alcance, orden ni estrategia: lo que no está escrito aquí explícitamente está fuera de la tarea.

Orden de implementación: T1 → T2 → T3 → T4 → T5 → T6 → T7. Cada tarea indica sus dependencias reales; T1, T2 y T3 no dependen entre sí y podrían implementarse en cualquier orden relativo, pero se numeran en este orden por claridad narrativa del plan.

---

## T1. Config: aceptar y validar `downloadOperation` en `button.props.action` y `link.props.action`

### Objetivo
Extender el contrato de configuración para que `button.props.action.type` y `link.props.action.type` acepten el nuevo valor `"downloadOperation"`, con el mismo shape de request que `executeOperation` (`operationName`, `query?`, `body?`, `headers?`) más `filename?: string`, y con soporte de `onSuccess`/`onError` (mismo catálogo y semántica que `executeOperation`). Cubre únicamente validación previa al render (tipos + Zod + cross-checks), no ejecución en runtime.

### Fuera de alcance
- Cualquier lógica de `fetch`, `Blob` o descarga en navegador (T3, T5).
- Resolución de `props.action.filename` como referencia dinámica (T5).
- Añadir `downloadOperation` a `RuntimeUiActionListEntry` (catálogo anidado de `onSuccess`/`onError` de otras acciones): decisión explícita D7, `downloadOperation` solo es válido como `action` de primer nivel de `button`/`link`, nunca como entrada encadenada.
- Cambios en `form.submitAction` (`downloadOperation` no es un tipo de submit válido).
- Deshabilitado del control durante la descarga (T6, T7).

### Dependencias
Ninguna.

### Interfaces
**Consume**: ninguno.

**Produce**:
- `DownloadOperationRuntimeUiAction` (tipo, `src/config/runtime-config-types.ts`):
  ```ts
  export interface DownloadOperationRuntimeUiAction extends RuntimeApiRequestParams {
    type: 'downloadOperation'
    operationName: string
    filename?: string
    onSuccess?: RuntimeUiActionListEntry[]
    onError?: RuntimeUiActionListEntry[]
  }
  ```
  — consumido por: T5, T6, T7.
- Ampliación de `ButtonLayoutNode['props']['action']` de `RuntimeUiAction` a `RuntimeUiAction | DownloadOperationRuntimeUiAction` (`src/config/runtime-config-types.ts`) — consumido por: T6.
- Ampliación de `LinkLayoutNode['props']['action']` de `NavigateToRuntimeUiAction | GoBackRuntimeUiAction` a `NavigateToRuntimeUiAction | GoBackRuntimeUiAction | DownloadOperationRuntimeUiAction` (`src/config/runtime-config-types.ts`) — consumido por: T7.

### Impacto esperado en archivos
Código:
- `src/config/runtime-config-types.ts`: nuevo tipo `DownloadOperationRuntimeUiAction`; ampliar `props.action` de `ButtonLayoutNode` y `LinkLayoutNode` como se describe arriba. **No** añadir `DownloadOperationRuntimeUiAction` a `RuntimeUiAction` ni a `RuntimeUiActionListEntry` (D7).
- `src/config/runtime-config-zod.ts`: nuevo `downloadOperationRuntimeUiActionSchema` (shape: `type: z.literal('downloadOperation')`, `operationName: nonEmptyStringSchema`, `query`/`body`/`headers` reutilizando `runtimeApiQuerySchema`/`runtimeApiBodySchema`/`runtimeApiHeadersSchema`, `filename: z.string().optional()`, `.strip()`); nuevo `downloadOperationWithLifecycleSchema = downloadOperationRuntimeUiActionSchema.extend({ onSuccess: runtimeUiActionListSchema, onError: runtimeUiActionListSchema })`. Añadir `downloadOperationWithLifecycleSchema` a la unión discriminada `buttonActionSchema`. Cambiar el `action` de `linkNodeSchema` de `z.discriminatedUnion('type', [navigateToButtonActionSchema, goBackButtonActionSchema])` a `z.discriminatedUnion('type', [navigateToButtonActionSchema, goBackButtonActionSchema, downloadOperationWithLifecycleSchema])`. **No** tocar `runtimeUiActionListEntrySchema` (debe seguir con exactamente los 7 tipos actuales).
- `src/config/validate-actions-visibility.ts`:
  - Nueva función exportada `validateDownloadOperationAction(rawAction: Record<string, unknown>, path: string, pageId: string): { status: 'ready'; action: DownloadOperationRuntimeUiAction } | { status: 'error'; error: RuntimeConfigError }`, que reutiliza `validateRuntimeApiRequestParams` (para `query`/`body`/`headers`) y `validateRuntimeUiActionLifecycleBlocks` (para `onSuccess`/`onError`), siguiendo el mismo patrón que `validateFormSubmitAction` para `executeOperation`. **No** modificar `validateRuntimeUiAction` (debe seguir reconociendo únicamente los 7 tipos actuales, para que `downloadOperation` sea estructuralmente imposible dentro de un `onSuccess`/`onError`).
  - `findInvalidActionTarget`: añadir dos ramas nuevas, una para `node.type === 'button' && node.props.action?.type === 'downloadOperation'` y otra para `node.type === 'link' && node.props.action?.type === 'downloadOperation'`, cada una comprobando `operationNames.has(node.props.action.operationName)` y devolviendo el mismo shape de error (`type: 'executeOperation'`) que ya usa la rama existente de `executeOperation` de `button` (mensaje `unknown operation "..."`, path `${nodePath}.props.action`).
- `src/config/validate-button-node.ts`: en el bloque que hoy llama a `validateRuntimeUiAction` para `parseResult.data.props.action`, añadir una rama previa: si `(parseResult.data.props.action as Record<string, unknown>).type === 'downloadOperation'`, llamar a `validateDownloadOperationAction` en su lugar; en cualquier otro caso, mantener el camino actual (`validateRuntimeUiAction` + `validateRuntimeUiActionLifecycleBlocks`) sin cambios.
- `src/config/validate-link-node.ts`: en el bloque de "Cross-validation (7): action.type must be navigateTo or goBack", ampliar la comprobación de tipo para aceptar también `'downloadOperation'` (`rawAction.type !== 'navigateTo' && rawAction.type !== 'goBack' && rawAction.type !== 'downloadOperation'`) y, si el tipo es `downloadOperation`, llamar a `validateDownloadOperationAction` en vez de `validateRuntimeUiAction`.
- `src/config/validate-form-request-params.ts`: extender `validateExecutionRequestParamsInCollection` con la regla `GET` sin `body` para `node.type === 'button' && node.props.action?.type === 'downloadOperation'` y para `node.type === 'link' && node.props.action?.type === 'downloadOperation'` (mismo patrón exacto que las ramas existentes de `executeOperation`, mensaje `GET operations do not support body.` en `${nodePath}.props.action.body`). Ampliar también la comprobación de `onSuccess`/`onError` que hoy solo aplica a `buttonAction?.type === 'executeOperation' || 'executeOperations'` para que incluya `'downloadOperation'`, y añadir una rama nueva equivalente para `node.type === 'link'` (hoy inexistente, porque `link` no tenía `onSuccess`/`onError` antes de esta feature).

Tests:
- `src/tests/config-validation/runtime-config-validation-buttons.test.ts` (ampliación).

Documentación:
- `ai-workflow/docs/app-features/nodes/button.md`, `ai-workflow/docs/app-features/nodes/link.md` (referencia, actualización real diferida a `update-app-documentation`).

### Tests
**Ficheros de test**:
- `src/tests/config-validation/runtime-config-validation-buttons.test.ts` (ampliación).

**Comportamiento cubierto**:
- `button.props.action.type: 'downloadOperation'` con `operationName` válido, sin `query`/`body`/`headers`/`filename`, se acepta.
- `button.props.action.type: 'downloadOperation'` con `query`, `body`, `headers` y `filename` declarados se acepta con el mismo shape que `executeOperation`.
- `link.props.action.type: 'downloadOperation'` se acepta con el mismo shape.
- `button`/`link` con `downloadOperation` y `onSuccess`/`onError` (listas con entradas `executeOperation`/`navigateTo`/etc., con `when` opcional) se aceptan.
- `button`/`link` con `downloadOperation.operationName` inexistente en `api` se rechaza antes del render (mismo formato de error que `executeOperation`).
- `button`/`link` con `downloadOperation` sobre una operación `api` con `method: 'GET'` y `body` declarado se rechaza con `GET operations do not support body.`.
- `button`/`link` con `downloadOperation.onSuccess`/`onError` conteniendo una entrada `executeOperation` con `body` sobre una operación `GET` se rechaza con el mismo mensaje.
- Una entrada `{ type: 'downloadOperation', ... }` dentro de la lista `onSuccess`/`onError` de **otra** acción (`executeOperation`, `executeOperations`, o del propio `downloadOperation`) se rechaza en bootstrap (no forma parte del catálogo anidado, D7).
- `downloadOperation` con `operationName` ausente o vacío se rechaza.
- `link.props.action.type: 'downloadOperation'` sin `href` (mutuamente excluyente con `action`, ya validado hoy) sigue funcionando sin regresión.

**Comandos durante la implementación**:
- `pnpm test --run src/tests/config-validation/runtime-config-validation-buttons.test.ts`

**Restricciones**: ninguna.

### Documentación afectada
`ai-workflow/docs/app-features/nodes/button.md`, `ai-workflow/docs/app-features/nodes/link.md`.

### Criterios de finalización
- `pnpm test --run src/tests/config-validation/runtime-config-validation-buttons.test.ts` en verde.
- `pnpm test` global sigue en verde (sin regresión sobre `executeOperation`/`executeOperations`/`navigateTo`/`goBack` existentes de `button` y `link`).
- Umbral de cobertura del proyecto no baja del 80%.

### Cierre de implementación
Código y tests de esta tarea completos y validados.

---

## T2. Refactor: extraer `runActionOutcomeWithLifecycle` compartido (resuelve D5)

### Objetivo
Extraer a `src/runtime/runtime-actions/runtime-ui-action-executor.ts` la orquestación "ejecutar → decidir éxito/error → `runRuntimeUiActionLifecycleList`" hoy duplicada en `button-layout-node.tsx` (`handleActionWithLifecycle`, para `executeOperation`/`executeOperations`) y `form-layout-node.tsx` (`handleSubmit`, para `executeOperation`/`executeOperations`). Refactor puro de comportamiento: no cambia ningún resultado observable existente. Habilita que `link` (T7) y `button` (T6) reutilicen la misma orquestación para `downloadOperation` sin una tercera/cuarta copia manual.

### Fuera de alcance
- Cualquier lógica de `downloadOperation` (T5, T6, T7).
- `resetOnSuccess` y la construcción de `hiddenFormFields`/`emptySubmitValues`/`fileInputSources` de `form`: siguen siendo responsabilidad de `form-layout-node.tsx`, que envuelve la llamada al helper compartido (D5).
- Cambiar el orden de ejecución, las condiciones de éxito/error (`allSuccess`/`anyError`), o el comportamiento cuando todas las operaciones de un `executeOperations` son omitidas por `when` (debe seguir tratándose como éxito).

### Dependencias
Ninguna.

### Interfaces
**Consume**: ninguno.

**Produce**:
- `runActionOutcomeWithLifecycle(execute: () => Promise<{ status: 'success' | 'error' }>, onSuccess: RuntimeUiActionListEntry[] | undefined, onError: RuntimeUiActionListEntry[] | undefined, handlers: RuntimeUiActionHandlers, readState: () => RuntimeState, iterationContext?: RuntimeIterationContext): Promise<{ status: 'success' | 'error' }>` (`src/runtime/runtime-actions/runtime-ui-action-executor.ts`) — consumido por: T6, T7.

### Impacto esperado en archivos
Código:
- `src/runtime/runtime-actions/runtime-ui-action-executor.ts`: nueva función exportada `runActionOutcomeWithLifecycle` (ver Produce). Internamente llama a `execute()`, luego a `runRuntimeUiActionLifecycleList(onSuccess ó onError según el resultado, handlers, readState, iterationContext)`, y devuelve el resultado de `execute()` tal cual.
- `src/runtime/nodes/button-layout-node.tsx`: reescribir `handleActionWithLifecycle` para construir un `execute: () => Promise<{status:'success'|'error'}>` por cada rama (`executeOperation` singular, `executeOperations` plural) y delegar en `runActionOutcomeWithLifecycle`, preservando exactamente la semántica actual (`allSuccess` vacío-o-completo cuenta como éxito).
- `src/runtime/nodes/form-layout-node.tsx`: reescribir las dos ramas de `handleSubmit` (`executeOperation`, `executeOperations`) de la misma forma; tras `await runActionOutcomeWithLifecycle(...)`, leer el `status` devuelto y solo entonces decidir `resetForm(node.id)` si `status === 'success' && node.resetOnSuccess`.

Tests:
- Ninguno nuevo.

Documentación:
- Ninguna.

### Tests
**Ficheros de test**: ninguno nuevo; cubierto por regresión de:
- `src/tests/runtime/runtime-button-lifecycle-actions.test.tsx` (existente)
- `src/tests/layout-renderer/layout-renderer-forms-multi-operation.test.tsx` (existente)
- `src/tests/layout-renderer/layout-renderer-forms.test.tsx` (existente)

**Comportamiento cubierto**:
- Ningún comportamiento nuevo. El refactor se considera correcto si las tres suites anteriores siguen en verde sin modificar sus aserciones.

**Comandos durante la implementación**:
- `pnpm test --run src/tests/runtime/runtime-button-lifecycle-actions.test.tsx`
- `pnpm test --run src/tests/layout-renderer/layout-renderer-forms-multi-operation.test.tsx`
- `pnpm test --run src/tests/layout-renderer/layout-renderer-forms.test.tsx`

**Restricciones**: no modificar las aserciones de estas suites para hacerlas pasar; si alguna falla, el refactor tiene un error de comportamiento, no el test.

### Documentación afectada
Ninguna.

### Criterios de finalización
- Las tres suites de regresión listadas en verde sin modificar sus aserciones.
- `pnpm test` global sigue en verde.
- Umbral de cobertura del proyecto no baja del 80%.

### Cierre de implementación
Código y tests de esta tarea completos y validados.

---

## T3. `src/queries/runtime-api-download.ts`: fetch binario contra el catálogo `api` (resuelve D1)

### Objetivo
Nuevo módulo hermano de `runtime-binary-fetch.ts` que ejecuta un `RuntimeApiRequest` ya construido (por `buildRuntimeApiRequest`, sin modificarlo) interpretando la respuesta como `Blob` + `Content-Disposition`, aceptando un body vacío en 2xx como descarga válida (a diferencia de `executeRuntimeBinaryFetch`, que rechaza blobs de tamaño 0).

### Fuera de alcance
- Construcción del `RuntimeApiRequest` (ya la hace `buildRuntimeApiRequest`/`buildInlineRuntimeApiRequest`, sin cambios).
- Parseo del valor de `Content-Disposition` para extraer un nombre de fichero (T5, D4): esta tarea solo expone el header crudo.
- Cualquier `dispatch` de estado o integración con `queries.*` (T4).
- Disparo del descargable en el navegador (`URL.createObjectURL`, anchor) (T5).

### Dependencias
Ninguna.

### Interfaces
**Consume**: ninguno (usa `RuntimeApiRequest` y `RuntimeApiError`, ya existentes en `src/queries/runtime-api-types.ts`, sin cambios).

**Produce**:
- `executeBuiltRuntimeApiDownloadRequest(options: ExecuteBuiltRuntimeApiDownloadRequestOptions): Promise<RuntimeApiDownloadResult>` (`src/queries/runtime-api-download.ts`) — consumido por: T4.
- tipo `RuntimeApiDownloadResult` (`src/queries/runtime-api-download-types.ts`):
  ```ts
  export type RuntimeApiDownloadResult =
    | { status: 'success'; blob: Blob; contentDisposition: string | null }
    | { status: 'error'; error: RuntimeApiError }
  ```
  — consumido por: T4, T5.

### Impacto esperado en archivos
Código:
- `src/queries/runtime-api-download-types.ts` (nuevo): `ExecuteBuiltRuntimeApiDownloadRequestOptions` (`{ request: RuntimeApiRequest; fetch?: typeof fetch }`) y `RuntimeApiDownloadResult` (ver Produce), importando `RuntimeApiError`/`RuntimeApiRequest` de `./runtime-api-types`.
- `src/queries/runtime-api-download.ts` (nuevo): `executeBuiltRuntimeApiDownloadRequest`, siguiendo el mismo patrón que `executeBuiltRuntimeApiRequest` (`runtime-api-executor.ts`) para el manejo de errores `network-error`/`http-error`, y el mismo patrón que `executeRuntimeBinaryFetch` (`runtime-binary-fetch.ts`) para leer `response.blob()` — pero **sin** el chequeo de `blob.size === 0` (D1: body vacío en 2xx es éxito, no error). En éxito, devuelve también `contentDisposition: response.headers.get('content-disposition')`. Re-exporta los tipos de `runtime-api-download-types.ts` (mismo patrón que `runtime-binary-fetch.ts` re-exporta `runtime-binary-fetch-types.ts`).

Tests:
- `src/tests/runtime/runtime-api-download.test.ts` (nuevo).

Documentación:
- `ai-workflow/docs/test-index.md` (fichero de test nuevo).

### Tests
**Ficheros de test**:
- `src/tests/runtime/runtime-api-download.test.ts` (nuevo).

**Comportamiento cubierto**:
- `fetch` exitoso (2xx) con body no vacío: devuelve `{status:'success', blob, contentDisposition}` con el `Blob` leído y el header `content-disposition` tal cual (o `null` si no está presente).
- `fetch` exitoso (2xx) con body vacío (`Content-Length: 0` o sin body): devuelve `{status:'success', blob}` con un `Blob` de tamaño 0, **sin** error (contraste explícito con `executeRuntimeBinaryFetch`).
- `fetch` que rechaza (error de red): devuelve `{status:'error', error:{code:'network-error', ...}}`.
- Respuesta con `!response.ok` (4xx/5xx): devuelve `{status:'error', error:{code:'http-error', ...}}`, sin leer el body.
- Fallo al leer `response.blob()` tras una respuesta `ok`: devuelve `{status:'error', error:{code:'network-error', ...}}`.
- El `init`/`url` pasados a `fetch` son exactamente los de `request.url`/`request.init` recibidos, sin reconstrucción.

**Comandos durante la implementación**:
- `pnpm test --run src/tests/runtime/runtime-api-download.test.ts`

**Restricciones**: mockear `fetch`/`Response` igual que hace `runtime-image-binary-fetch.test.ts` o `runtime-api-execution.test.ts`; no depender de un servidor real.

### Documentación afectada
`ai-workflow/docs/test-index.md`.

### Criterios de finalización
- `pnpm test --run src/tests/runtime/runtime-api-download.test.ts` en verde.
- Umbral de cobertura del proyecto no baja del 80%.

### Cierre de implementación
Código y tests de esta tarea completos y validados.

---

## T4. `runtime-state`: orquestación de `downloadOperation` sobre `queries.{operationName}` (resuelve D2)

### Objetivo
Nueva función `executeDownloadOperationWithSnapshot` en `runtime-state-query-execution.ts`, hermana de `executeQueryOperationWithSnapshot`, que construye el request con `buildRuntimeApiRequest` (reutilizado sin cambios), ejecuta el fetch binario con `executeBuiltRuntimeApiDownloadRequest` (T3), y sincroniza `queries.{operationName}` (`loading` → `success`/`error`) igual que cualquier otra operación. En éxito, `data` se fija a `null` (D8: un `Blob` no es JSON serializable ni referenciable). Expuesta como `executeDownloadOperation` en `useRuntimeStateActions()`.

### Fuera de alcance
- Resolución del nombre de fichero o disparo de la descarga en el navegador (T5).
- `hiddenFormFields`/`emptySubmitValues`/`fileInputSources`: `downloadOperation` no participa en submit de formulario, no los necesita.
- Cualquier cambio en `executeQueryOperationWithSnapshot`/`executeQueryOperation` existentes.

### Dependencias
T3 (consume `executeBuiltRuntimeApiDownloadRequest` y el tipo `RuntimeApiDownloadResult`).

### Interfaces
**Consume**:
- `executeBuiltRuntimeApiDownloadRequest(options: ExecuteBuiltRuntimeApiDownloadRequestOptions): Promise<RuntimeApiDownloadResult>` (de T3).
- tipo `RuntimeApiDownloadResult` (de T3).

**Produce**:
- `executeDownloadOperationWithSnapshot(options: { config: RuntimeConfig; dispatch: Dispatch<RuntimeStateAction>; operationName: string; snapshotState: RuntimeState; requestParams?: RuntimeApiRequestParams; iterationContext?: RuntimeIterationContext; fetchImplementation?: typeof fetch }): Promise<RuntimeApiDownloadResult>` (`src/runtime/runtime-state/runtime-state-query-execution.ts`) — sin consumidores directos fuera de esta tarea (uso interno del hook producido a continuación).
- `executeDownloadOperation(operationName: string, options?: { fetch?: typeof fetch; snapshotState?: RuntimeState; requestParams?: RuntimeApiRequestParams; iterationContext?: RuntimeIterationContext }): Promise<RuntimeApiDownloadResult | { status: 'skipped' }>`, expuesta por `useRuntimeStateActions()` (`src/runtime/runtime-state/use-runtime-state.ts`) — consumido por: T5, T6, T7.

### Impacto esperado en archivos
Código:
- `src/runtime/runtime-state/runtime-state-query-execution.ts`: nueva función exportada `executeDownloadOperationWithSnapshot`, mismo patrón que `executeQueryOperationWithSnapshot` (`dispatch({type:'queries/set-loading',...})` antes del fetch, `dispatch({type:'queries/set-success', payload:{queryName: operationName, data: null, requestSignature}})` en éxito — D8 fija `data: null` explícitamente —, `dispatch({type:'queries/set-error',...})` en error de construcción o de ejecución), pero sin los parámetros `hiddenFormFields`/`emptySubmitValues`/`fileInputSources`/`skipLoadingDispatch`, y llamando a `executeBuiltRuntimeApiDownloadRequest` (T3) en vez de `executeBuiltRuntimeApiRequest`.
- `src/runtime/runtime-state/use-runtime-state.ts`: dentro de `useRuntimeStateActions()`, nuevo `useCallback` `executeDownloadOperation` (mismo patrón que `executeQueryOperation`: early-return `{status:'skipped'}` si `editModeContext.active`, si no delega en `executeDownloadOperationWithSnapshot` con `snapshotState: options?.snapshotState ?? getLatestState()`), añadido al objeto devuelto por el `useMemo` final (y a su array de dependencias).

Tests:
- `src/tests/runtime-state/runtime-state-download-operation.test.tsx` (nuevo).

Documentación:
- `ai-workflow/docs/app-features/queries/execution.md` (referencia: nuevo disparador de `queries.{operationName}`, actualización real diferida a `update-app-documentation`).
- `ai-workflow/docs/test-index.md` (fichero de test nuevo).

### Tests
**Ficheros de test**:
- `src/tests/runtime-state/runtime-state-download-operation.test.tsx` (nuevo).

**Comportamiento cubierto**:
- `executeDownloadOperationWithSnapshot` despacha `queries/set-loading` antes del fetch y `queries/set-success` con `data: null` (nunca el `Blob`) tras un fetch exitoso, con el `requestSignature` del request construido.
- En error de construcción del request (`operation-not-found`, `request-build-failed`, `token-refresh-failed`), despacha `queries/set-error` con el código correspondiente **sin** invocar `fetch`.
- En error de red o HTTP del fetch binario, despacha `queries/set-error` con `code: 'network-error'`/`'http-error'` respectivamente.
- El valor de retorno de `executeDownloadOperationWithSnapshot` es exactamente el `RuntimeApiDownloadResult` de T3 (incluye `blob`/`contentDisposition` en éxito).
- `executeDownloadOperation` (hook) devuelve `{status:'skipped'}` sin dispatch ni fetch cuando `LayoutEditModeContext.active` es `true`.
- `executeDownloadOperation` sin `options.snapshotState` explícito usa el estado más reciente (`getLatestState()`), igual que `executeQueryOperation`.
- Dos instancias que invocan `executeDownloadOperation` con el mismo `operationName` actualizan el mismo slot `queries.{operationName}` (estado compartido, ya garantizado por el reducer existente; test de regresión, no de comportamiento nuevo del reducer).

**Comandos durante la implementación**:
- `pnpm test --run src/tests/runtime-state/runtime-state-download-operation.test.tsx`

**Restricciones**: reutilizar el harness de `src/tests/runtime-state/helpers.tsx` ya usado por `runtime-state-operations.test.tsx`.

### Documentación afectada
`ai-workflow/docs/app-features/queries/execution.md`, `ai-workflow/docs/test-index.md`.

### Criterios de finalización
- `pnpm test --run src/tests/runtime-state/runtime-state-download-operation.test.tsx` en verde.
- `pnpm test --run src/tests/runtime-state/runtime-state-operations.test.tsx` sigue en verde (sin regresión sobre `executeQueryOperation`).
- Umbral de cobertura del proyecto no baja del 80%.

### Cierre de implementación
Código y tests de esta tarea completos y validados.

---

## T5. `runtime-actions/runtime-download-action.ts`: resolución de nombre y disparo de descarga (resuelve D3, D4)

### Objetivo
Nuevo módulo que compone: ejecutar la descarga vía el handler inyectado (`executeDownloadOperation`, T4), resolver el nombre de fichero con la prioridad fijada en la spec (`Content-Disposition` → `props.action.filename` resuelto como referencia dinámica → fallback genérico `"download"`), y disparar la descarga real en el navegador (`Blob` → `URL.createObjectURL` → anchor temporal → click → revoke inmediato). Extiende `RuntimeUiActionHandlers` con `executeDownloadOperation` para que los nodos (T6, T7) puedan inyectarlo igual que el resto de handlers.

### Fuera de alcance
- Cualquier UI de `button`/`link` (deshabilitado durante la descarga, wiring de `onClick`): T6, T7.
- La orquestación de `onSuccess`/`onError` (`runActionOutcomeWithLifecycle`, T2): esta tarea solo produce la función `execute` que un llamador (T6/T7) le pasará; no la invoca aquí.
- Progreso de descarga, cancelación o reintentos (fuera de alcance de la spec).

### Dependencias
T1 (consume `DownloadOperationRuntimeUiAction`), T4 (consume `executeDownloadOperation`).

### Interfaces
**Consume**:
- `DownloadOperationRuntimeUiAction` (de T1).
- `executeDownloadOperation(operationName: string, options?: { fetch?: typeof fetch; snapshotState?: RuntimeState; requestParams?: RuntimeApiRequestParams; iterationContext?: RuntimeIterationContext }): Promise<RuntimeApiDownloadResult | { status: 'skipped' }>` (de T4).
- tipo `RuntimeApiDownloadResult` (de T3, reexportado por T4).

**Produce**:
- `resolveDownloadFilename(options: { contentDisposition: string | null; actionFilename: string | undefined; state: RuntimeState; surface: RuntimeReferenceSurface; iterationContext?: RuntimeIterationContext }): string` (`src/runtime/runtime-actions/runtime-download-action.ts`) — sin consumidores directos externos (uso interno de `runDownloadAction`, en esta misma tarea).
- `runDownloadAction(action: DownloadOperationRuntimeUiAction, handlers: RuntimeUiActionHandlers, state: RuntimeState, surface: RuntimeReferenceSurface, iterationContext?: RuntimeIterationContext): Promise<{ status: 'success' } | { status: 'error' }>` (`src/runtime/runtime-actions/runtime-download-action.ts`) — consumido por: T6, T7. El parámetro `surface` es el literal de `RuntimeReferenceSurface` que identifica el nodo llamador (`'button.props.action.filename'` desde T6, `'link.props.action.filename'` desde T7), y se reenvía tal cual a `resolveDownloadFilename` para que el diagnóstico de dev en consola apunte al nodo correcto — sigue el mismo patrón ya vigente en `RuntimeReferenceSurface`, que distingue siempre el literal por tipo de nodo (p. ej. `button.props.label` vs `link.props.label`), nunca comparte uno entre ambos.
- Ampliación de `RuntimeUiActionHandlers` (`src/runtime/runtime-actions/runtime-ui-action-executor.ts`) con el campo:
  ```ts
  executeDownloadOperation: (
    operationName: string,
    options?: { requestParams?: RuntimeApiRequestParams; iterationContext?: RuntimeIterationContext },
  ) => Promise<RuntimeApiDownloadResult | { status: 'skipped' }>
  ```
  (misma forma estrecha de opciones que ya usa el campo `executeQueryOperation` de esa interfaz, aunque la función real del hook acepte más opciones) — consumido por: T6, T7.

### Impacto esperado en archivos
Código:
- `src/runtime/runtime-actions/runtime-download-action.ts` (nuevo):
  - `resolveDownloadFilename`: parsea `contentDisposition` buscando un parámetro `filename` (con o sin comillas, case-insensitive); si no hay match o el valor tras trim es una cadena vacía, usa `actionFilename` (si está definido) resuelto con `resolveRuntimeTextReference(actionFilename, state, surface, { iterationContext })` (el `surface` recibido por parámetro, no un literal fijo); si el resultado es una cadena vacía o `actionFilename` es `undefined`, devuelve el literal `"download"` (D4). Función pura, sin acceso a DOM ni `fetch`.
  - `runDownloadAction`: llama a `handlers.executeDownloadOperation(action.operationName, { requestParams: { query: action.query, body: action.body, headers: action.headers }, iterationContext })`; si el resultado no es `{status:'success'}` (incluye `{status:'skipped'}` y `{status:'error'}`), devuelve `{status:'error'}`; si es éxito, llama a `resolveDownloadFilename` con `result.contentDisposition`/`action.filename`/`state`/`surface`/`iterationContext`, dispara la descarga (función interna no exportada `triggerBrowserDownload(blob, filename)`: `URL.createObjectURL(blob)` → `<a>` temporal con `href`/`download` → `click()` → `URL.revokeObjectURL(...)` inmediatamente después del click) y devuelve `{status:'success'}`.
- `src/runtime/runtime-actions/runtime-ui-action-executor.ts`: ampliar la interfaz `RuntimeUiActionHandlers` con el campo `executeDownloadOperation` (ver Produce). No tocar `executeRuntimeUiAction` ni `runRuntimeUiActionLifecycleList` (siguen sin conocer `downloadOperation`, D7).
- `src/runtime/runtime-references/runtime-reference-diagnostics.ts`: añadir **ambos** literales `'button.props.action.filename'` y `'link.props.action.filename'` a la unión `RuntimeReferenceSurface` (no solo el de `button`: el patrón vigente en este tipo distingue siempre por tipo de nodo).

Tests:
- `src/tests/runtime/runtime-download-action.test.ts` (nuevo).

Documentación:
- `ai-workflow/docs/test-index.md` (fichero de test nuevo).

### Tests
**Ficheros de test**:
- `src/tests/runtime/runtime-download-action.test.ts` (nuevo).

**Comportamiento cubierto**:
- `resolveDownloadFilename`: `contentDisposition` con `filename="reporte.pdf"` (con comillas) resuelve a `"reporte.pdf"`.
- `resolveDownloadFilename`: `contentDisposition` con `filename=informe.pdf` (sin comillas) resuelve igual.
- `resolveDownloadFilename`: `contentDisposition` presente pero sin parámetro `filename` parseable, con `actionFilename: "informe.pdf"` definido, resuelve a `"informe.pdf"`.
- `resolveDownloadFilename`: sin `contentDisposition` (`null`) y sin `actionFilename`, resuelve al fallback `"download"`.
- `resolveDownloadFilename`: `actionFilename` es una referencia dinámica (`"queries.report.data.name"`) que resuelve a un string no vacío: se usa ese valor.
- `resolveDownloadFilename`: `actionFilename` resuelve a cadena vacía (referencia no disponible): recurre al fallback `"download"`, nunca usa un nombre vacío.
- `resolveDownloadFilename`/`runDownloadAction`: el `surface` recibido por parámetro se reenvía tal cual a `resolveRuntimeTextReference` (verificable con un spy), sin fijar internamente un literal constante.
- `runDownloadAction`: en éxito, invoca `handlers.executeDownloadOperation` con `requestParams` construido desde `action.query`/`action.body`/`action.headers`, dispara `URL.createObjectURL`/click/`URL.revokeObjectURL` (mockeados) con el nombre resuelto, y devuelve `{status:'success'}`.
- `runDownloadAction`: si `handlers.executeDownloadOperation` devuelve `{status:'error'}`, no se llama a `URL.createObjectURL` y se devuelve `{status:'error'}`.
- `runDownloadAction`: si `handlers.executeDownloadOperation` devuelve `{status:'skipped'}` (modo edición), no se dispara descarga y se devuelve `{status:'error'}`.
- `runDownloadAction`: el blob URL se revoca (`URL.revokeObjectURL`) tras iniciar la descarga.

**Comandos durante la implementación**:
- `pnpm test --run src/tests/runtime/runtime-download-action.test.ts`

**Restricciones**: mockear `URL.createObjectURL`/`URL.revokeObjectURL` y la creación/click del anchor temporal (jsdom no descarga ficheros realmente); no depender de un DOM visible.

### Documentación afectada
`ai-workflow/docs/test-index.md`.

### Criterios de finalización
- `pnpm test --run src/tests/runtime/runtime-download-action.test.ts` en verde.
- Umbral de cobertura del proyecto no baja del 80%.

### Cierre de implementación
Código y tests de esta tarea completos y validados.

---

## T6. `button`: disparar `downloadOperation` con lifecycle y deshabilitado durante la descarga

### Objetivo
Integrar `downloadOperation` en `ButtonNode` (`button-layout-node.tsx`): al pulsar un botón con `action.type === 'downloadOperation'`, deshabilitar el botón, ejecutar la descarga (`runDownloadAction`, T5) orquestada con `onSuccess`/`onError` (`runActionOutcomeWithLifecycle`, T2), y reactivar el botón al terminar (éxito o error).

### Fuera de alcance
- Estilos visuales del estado deshabilitado (usar el atributo nativo `disabled`; sin nuevas clases Tailwind).
- Cualquier cambio en el comportamiento existente de `navigateTo`/`goBack`/`executeOperation`/`executeOperations`/`resetForm`/`openModal`/`closeModal` de `button` más allá de lo estrictamente necesario para añadir la rama `downloadOperation` (T2 ya cubrió el refactor compartido).
- `link` (T7).

### Dependencias
T1 (tipo de acción en `ButtonLayoutNode`), T2 (`runActionOutcomeWithLifecycle`), T5 (`runDownloadAction`, `RuntimeUiActionHandlers.executeDownloadOperation`).

### Interfaces
**Consume**:
- `runActionOutcomeWithLifecycle(...)` (de T2).
- `runDownloadAction(action, handlers, state, surface, iterationContext?): Promise<{status:'success'}|{status:'error'}>` (de T5).
- Campo `executeDownloadOperation` de `RuntimeUiActionHandlers` (de T5).
- `DownloadOperationRuntimeUiAction` y ampliación de `ButtonLayoutNode['props']['action']` (de T1).

**Produce**: ninguno.

### Impacto esperado en archivos
Código:
- `src/runtime/nodes/button-layout-node.tsx`:
  - Añadir `executeDownloadOperation` a la desestructuración de `useRuntimeStateActions()` y a `buildHandlers()`.
  - Nuevo estado local `const [isDownloading, setIsDownloading] = useState(false)`.
  - Nueva función `async function handleDownloadAction(downloadAction: DownloadOperationRuntimeUiAction)`: `setIsDownloading(true)`; construye `execute = () => runDownloadAction(downloadAction, buildHandlers(), readRuntimeState(), 'button.props.action.filename', iterationContext)`; llama a `await runActionOutcomeWithLifecycle(execute, downloadAction.onSuccess, downloadAction.onError, buildHandlers(), readRuntimeState, iterationContext)`; en un `finally`, `setIsDownloading(false)`.
  - En `handleClick`: si `isDownloading`, no hacer nada (guarda contra doble clic, FR8); si `action.type === 'downloadOperation'`, llamar a `handleDownloadAction(action)` y retornar antes de las ramas existentes.
  - En el JSX del `<button>`, añadir `disabled={isDownloading}`.

Tests:
- `src/tests/runtime/runtime-button-download-action.test.tsx` (nuevo).

Documentación:
- `ai-workflow/docs/app-features/nodes/button.md` (referencia).
- `ai-workflow/docs/test-index.md` (fichero de test nuevo).

### Tests
**Ficheros de test**:
- `src/tests/runtime/runtime-button-download-action.test.tsx` (nuevo).

**Comportamiento cubierto**:
- Click en un `button` con `action.type: 'downloadOperation'` dispara la descarga (mock de `fetch` + `URL.createObjectURL`) y, en éxito, ejecuta `onSuccess` si está declarado.
- En error del fetch (HTTP no-ok o red), ejecuta `onError` si está declarado y **no** dispara `URL.createObjectURL`.
- Mientras la descarga está en curso, el botón queda `disabled`; un segundo click no dispara un segundo `fetch`.
- Tras terminar (éxito o error), el botón vuelve a estar habilitado (`disabled` es `false`).
- `queries.{operationName}.status` refleja `loading` durante el fetch y `success`/`error` al terminar (consumible por otro nodo con `queryStateFeedback`, verificado leyendo el store).
- Dos instancias de `button` con el mismo `operationName` mantienen su propio `disabled` de forma independiente, mientras ambas reflejan el mismo `queries.{operationName}`.
- `downloadOperation` dentro de un `repeater`: `item.*` se resuelve en `query`/`body`/`headers` igual que `executeOperation` (reutiliza el mismo `iterationContext`).
- Sin `onSuccess`/`onError` declarados, el click dispara igualmente la descarga (no son obligatorios).

**Comandos durante la implementación**:
- `pnpm test --run src/tests/runtime/runtime-button-download-action.test.tsx`

**Restricciones**: reutilizar el harness de mocking de `fetch`/`Blob`/`URL.createObjectURL` ya usado por `runtime-image-binary-fetch.test.ts` o `layout-renderer-image-fetch.test.tsx` si aplica; no introducir un segundo patrón de mock.

### Documentación afectada
`ai-workflow/docs/app-features/nodes/button.md`, `ai-workflow/docs/test-index.md`.

### Criterios de finalización
- `pnpm test --run src/tests/runtime/runtime-button-download-action.test.tsx` en verde.
- `pnpm test --run src/tests/runtime/runtime-button-lifecycle-actions.test.tsx` sigue en verde.
- Umbral de cobertura del proyecto no baja del 80%.

### Cierre de implementación
Código y tests de esta tarea completos y validados.

---

## T7. `link`: añadir lifecycle y disparar `downloadOperation` con deshabilitado durante la descarga

### Objetivo
Integrar `downloadOperation` en `LinkNode` (`link-layout-node.tsx`): al pulsar un `link` con `action.type === 'downloadOperation'`, deshabilitar el control (vía `aria-disabled`, ya que `<a>` no tiene `disabled` nativo e ignorar el click mientras está activo), ejecutar la descarga orquestada con `onSuccess`/`onError` (primera vez que `link` gana esta capacidad de lifecycle), y reactivar el control al terminar.

### Fuera de alcance
- Estilos visuales del estado deshabilitado.
- `rel="noopener noreferrer"` u otros atributos del anchor (ya fuera de alcance del nodo `link` en general).
- Cualquier cambio en el comportamiento existente de `navigateTo`/`goBack` de `link` más allá de lo estrictamente necesario para añadir la rama `downloadOperation`.
- `button` (T6).

### Dependencias
T1 (tipo de acción en `LinkLayoutNode`), T2 (`runActionOutcomeWithLifecycle`), T5 (`runDownloadAction`, `RuntimeUiActionHandlers.executeDownloadOperation`).

### Interfaces
**Consume**:
- `runActionOutcomeWithLifecycle(...)` (de T2).
- `runDownloadAction(action, handlers, state, surface, iterationContext?): Promise<{status:'success'}|{status:'error'}>` (de T5).
- Campo `executeDownloadOperation` de `RuntimeUiActionHandlers` (de T5).
- `DownloadOperationRuntimeUiAction` y ampliación de `LinkLayoutNode['props']['action']` (de T1).

**Produce**: ninguno.

### Impacto esperado en archivos
Código:
- `src/runtime/nodes/link-layout-node.tsx`:
  - Añadir `executeDownloadOperation` y `readRuntimeState` a la desestructuración de `useRuntimeStateActions()`.
  - Nuevo estado local `const [isDownloading, setIsDownloading] = useState(false)`.
  - Nueva función `async function handleDownloadAction(downloadAction: DownloadOperationRuntimeUiAction)`, análoga a la de T6 (construye `handlers` inline con los 6 handlers existentes de `RuntimeUiActionHandlers` — `executeQueryOperation`, `goBackPage`, `navigateToPage`, `openModal`, `closeModal`, `resetForm` — más `executeDownloadOperation`; `setIsDownloading(true)`; `execute = () => runDownloadAction(downloadAction, handlers, readRuntimeState(), 'link.props.action.filename', iterationContext)`; `await runActionOutcomeWithLifecycle(execute, downloadAction.onSuccess, downloadAction.onError, handlers, readRuntimeState, iterationContext)`; `finally setIsDownloading(false)`).
  - En `resolvedActionHref` (el `useMemo` que llama a `resolveLinkActionHref`): si `action?.type === 'downloadOperation'`, devolver `undefined` en vez de llamar a `resolveLinkActionHref` (que solo tipa `navigateTo`/`goBack`); en cualquier otro caso, comportamiento actual sin cambios.
  - En el `onClick` del `<a>`: si `action.type === 'downloadOperation'`, `event.preventDefault()`, si `isDownloading` no hacer nada (FR8), si no llamar a `handleDownloadAction(action)`; en cualquier otro caso (`navigateTo`/`goBack`), comportamiento actual sin cambios (sigue usando `executeRuntimeUiAction` fire-and-forget, sin lifecycle).
  - Añadir `aria-disabled={action?.type === 'downloadOperation' && isDownloading ? true : undefined}` al `<a>`.

Tests:
- `src/tests/runtime/runtime-link-download-action.test.tsx` (nuevo).

Documentación:
- `ai-workflow/docs/app-features/nodes/link.md` (referencia).
- `ai-workflow/docs/test-index.md` (fichero de test nuevo).

### Tests
**Ficheros de test**:
- `src/tests/runtime/runtime-link-download-action.test.tsx` (nuevo).

**Comportamiento cubierto**:
- Click en un `link` con `action.type: 'downloadOperation'` dispara la descarga (mock de `fetch` + `URL.createObjectURL`) y, en éxito, ejecuta `onSuccess` si está declarado; en error, ejecuta `onError`.
- Mientras la descarga está en curso, el `<a>` lleva `aria-disabled="true"` y un segundo click no dispara un segundo `fetch`.
- Tras terminar (éxito o error), `aria-disabled` desaparece (o pasa a `undefined`/ausente).
- El `href` del `<a>` con `action.type: 'downloadOperation'` no lanza error de tipos ni intenta resolver `navigateTo`/`goBack` (queda sin atributo `href`, o `undefined`).
- `queries.{operationName}.status` refleja `loading`/`success`/`error` igual que en `button` (T6).
- `downloadOperation` dentro de un `repeater`: `item.*` se resuelve igual que en `button`.
- `link` con `action.type: 'navigateTo'`/`'goBack'` (sin `downloadOperation`) no sufre ninguna regresión: sigue sin lifecycle, sigue navegando igual que antes de esta feature.

**Comandos durante la implementación**:
- `pnpm test --run src/tests/runtime/runtime-link-download-action.test.tsx`

**Restricciones**: mismo patrón de mocking que T6 para `fetch`/`Blob`/`URL.createObjectURL`.

### Documentación afectada
`ai-workflow/docs/app-features/nodes/link.md`, `ai-workflow/docs/test-index.md`.

### Criterios de finalización
- `pnpm test --run src/tests/runtime/runtime-link-download-action.test.tsx` en verde.
- `pnpm test --run src/tests/runtime/runtime-button-navigation.test.tsx` sigue en verde (sin regresión de navegación de `link`/`button`).
- `pnpm test` global en verde y umbral de cobertura del proyecto no baja del 80%.

### Cierre de implementación
Código y tests de esta tarea completos y validados.

---

## Siguiente tarea
T1. Es la que desbloquea antes al resto (tipos consumidos por T5/T6/T7) y no tiene dependencias.
