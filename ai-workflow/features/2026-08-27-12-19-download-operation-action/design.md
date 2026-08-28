# Design: Feature 2026-08-27-12-19 - download-operation-action

## Contexto

`button` y `link` ya delegan toda ejecución de red en la fachada compartida de `src/queries/`, nunca construyen `fetch` por su cuenta (`architecture.md`). El camino existente para "ejecutar una operación `api`" es JSON-only de punta a punta:

- `runtime-api-request.ts` (`buildRuntimeApiRequest`/`buildInlineRuntimeApiRequest`) resuelve `endpoint`, `query`, `body`, `headers` (con inyección de `tokens.*`, merge base/override, regla `GET` sin `body`) y produce un `RuntimeApiRequest` (`url` + `init`) ya listo para `fetch`.
- `runtime-api-executor.ts` (`executeBuiltRuntimeApiRequest`) hace el `fetch`, y siempre interpreta la respuesta como texto → JSON, evaluando `errorCondition`.
- `runtime-state-query-execution.ts` (`executeQueryOperationWithSnapshot`) envuelve lo anterior: `dispatch` de `queries/set-loading` antes del `fetch` y `queries/set-success`/`queries/set-error` después.
- `button-layout-node.tsx` (`handleActionWithLifecycle`) y `form-layout-node.tsx` (`handleSubmit`) duplican, cada uno por su lado, la orquestación "ejecutar operación(es) → decidir éxito/error → disparar `onSuccess`/`onError` vía `runRuntimeUiActionLifecycleList`" para `executeOperation`/`executeOperations`. `link-layout-node.tsx` hoy no tiene esa orquestación: solo llama a `executeRuntimeUiAction` de forma fire-and-forget para `navigateTo`/`goBack`.
- Ya existe un camino binario separado para blobs: `runtime-binary-fetch.ts` (`executeRuntimeBinaryFetch`), usado por `image.props.fetch`/`gallery`. Reutiliza `resolveHeaders`/`resolveBody` de `runtime-api-payload-resolver.ts` (mismo mecanismo de tokens que la fachada JSON) pero resuelve la URL como una referencia dinámica libre (`ImageFetchConfig.url` vía `resolveRuntimeImageSource`), no contra una entrada de `api` por nombre, y trata un blob de tamaño 0 como error (`invalid-binary-response`).

Ninguno de los dos caminos existentes sirve tal cual para `downloadOperation`: necesita resolver contra `api[operationName]` igual que `executeOperation` (método, merge de overrides, regla `GET` sin `body`, señalización en `queries.{operationName}`), pero interpretar la respuesta como `Blob` + `Content-Disposition`, no como JSON, y aceptar un body vacío como caso válido (descarga de fichero vacío, no error).

## Objetivos / No objetivos

### Objetivos
- Definir dónde vive la ejecución de red de `downloadOperation` sin duplicar resolución de headers/tokens/query/body ni la regla `GET` sin `body`.
- Definir cómo `downloadOperation` participa en `queries.{operationName}` con la misma fachada de estado que `executeOperation`.
- Resolver el riesgo señalado en la spec: factorizar o no la orquestación `onSuccess`/`onError`, dado que ahora la necesitan `button`, `form` (ya existente) y `link` (nuevo), más una cuarta variante de "operación" (`downloadOperation`, que no es `executeQueryOperation`).
- Decidir dónde vive el efecto de disparar la descarga en el navegador (`Blob` → `URL.createObjectURL` → anchor temporal → revoke) y la resolución de nombre de fichero.
- Decidir dónde vive el estado "en curso" por instancia que deshabilita el control (`button`/`link`) mientras dura la descarga.
- Fijar el nombre de fallback genérico de fichero.

### No objetivos
- No se diseña progreso de descarga, cancelación, reintentos ni deduplicación (fuera de alcance en la spec).
- No se unifica con `file-manager.downloadOperation` (mecanismo de URL sin `fetch`, explícitamente fuera de alcance).
- No se cambia el comportamiento de `executeOperation`/`executeOperations` existente más allá de la extracción de la orquestación compartida (decisión D5); su comportamiento observable no cambia.
- No se resuelve aquí el shape exacto de Zod ni las rutas de error de validación (`invalid-layout`); eso es detalle de planificación dentro de `src/config/`, ya cubierto por el punto de extensión documentado en `architecture.md` ("Nueva acción UI: extender el contrato de acción...").

## Decisiones

### D1. Nuevo módulo de fetch binario contra el catálogo `api`, reutilizando el request builder existente
`downloadOperation` reutiliza `buildRuntimeApiRequest`/`buildInlineRuntimeApiRequest` (`runtime-api-request.ts`) tal cual — mismo builder que usa `executeOperation`, sin tocarlo. Un nuevo módulo hermano de `runtime-binary-fetch.ts`, `src/queries/runtime-api-download.ts`, expone una función (p. ej. `executeBuiltRuntimeApiDownloadRequest({ request, fetch })`) que recibe el `RuntimeApiRequest` ya construido y:
- hace el `fetch`,
- en éxito HTTP, lee `Content-Disposition` de `response.headers` y consume el cuerpo con `response.blob()`,
- **no** rechaza un blob de tamaño 0 (a diferencia de `executeRuntimeBinaryFetch`): un body vacío en 2xx es una descarga válida de fichero vacío (caso límite explícito de la spec).

**Alternativa descartada**: extender `executeBuiltRuntimeApiRequest` con un parámetro `responseType: 'json' | 'blob'`. Se descarta porque mezclaría dos formas de interpretar la respuesta en la única función que usan todas las demás operaciones `api` (incluido `executeOperations`, `submitAction`, `preloads`, `autocomplete`), aumentando el radio de impacto de un cambio que solo necesita `downloadOperation`.

**Alternativa descartada**: reutilizar `executeRuntimeBinaryFetch` tal cual. Se descarta porque resuelve la URL como referencia libre (`ImageFetchConfig`), no contra `api[operationName]` (pierde el merge de overrides y la regla `GET` sin `body` que si aporta el request builder de `api`), y porque su regla de "blob vacío = error" contradice el caso límite de la spec.

### D2. Nueva función de orquestación en `runtime-state/`, hermana de `executeQueryOperationWithSnapshot`
`runtime-state-query-execution.ts` gana `executeDownloadOperationWithSnapshot`, con la misma forma que `executeQueryOperationWithSnapshot` (recibe `config`, `operationName`, `snapshotState`, `requestParams: {query, body, headers}`, `iterationContext`) pero:
- llama a `buildRuntimeApiRequest` + `executeBuiltRuntimeApiDownloadRequest` (D1) en vez de `executeBuiltRuntimeApiRequest`,
- en éxito, hace `dispatch({ type: 'queries/set-success', payload: { queryName: operationName, data: null, requestSignature } })` — ver D8 sobre `data: null`,
- en error, mismo `dispatch` de `queries/set-error` que ya existe, reutilizando los códigos de error existentes (D9).

No lleva `hiddenFormFields`/`emptySubmitValues`/`fileInputSources`: `downloadOperation` no vive dentro de un submit de formulario, solo en `button.props.action`/`link.props.action`.

Se expone como `executeDownloadOperation` en `useRuntimeStateActions()` (`use-runtime-state.ts`), paralelo a `executeQueryOperation`.

### D3. Nuevo módulo en `runtime-actions/` que compone ejecución + efecto de descarga
`downloadOperation` **es** una acción declarada en el config (a diferencia de `runtime-search-trigger`, que dispara una query como consecuencia de una interacción no declarada). Por tanto, según el punto de extensión de `architecture.md` ("Nueva acción UI: extender el contrato de acción, resolver parámetros en la capa común y delegar en handlers del provider"), su lógica de disparo vive en `runtime-actions/`, no en los nodos.

Nuevo módulo `runtime-actions/runtime-download-action.ts` expone una función (p. ej. `runDownloadAction(action, handlers, iterationContext)`) que:
1. llama a `handlers.executeDownloadOperation(action.operationName, { requestParams: {...}, iterationContext })` (D2),
2. en éxito, resuelve el nombre de fichero (D4) y dispara la descarga real: crea un blob URL con `URL.createObjectURL`, un `<a>` temporal fuera del DOM visible con el nombre resuelto, simula el click y revoca el blob URL inmediatamente después,
3. devuelve el resultado (`success`/`error`) para que el orquestador de lifecycle (D5) decida `onSuccess`/`onError`.

`RuntimeUiActionHandlers` (en `runtime-ui-action-executor.ts`) gana `executeDownloadOperation` junto a `executeQueryOperation`, siguiendo el mismo patrón de inyección de handlers ya usado por `goBackPage`/`navigateToPage`/etc.

### D4. Resolución de nombre de fichero como helper puro
Función pura, p. ej. `resolveDownloadFilename({ contentDisposition, actionFilename, state, iterationContext })` en `runtime-actions/` (o junto a D3), con la prioridad ya fijada en la spec: `Content-Disposition` → `props.action.filename` resuelto como referencia dinámica (mismo mecanismo que `button.props.label`, `resolveRuntimeTextReference`) → fallback genérico. Aislada del efecto de descarga para poder testearla sin DOM ni `fetch`.

**Fallback genérico**: literal fijo `"download"`. Se descarta derivarlo de `operationName` (p. ej. `reportDownload`) porque el nombre de operación es un identificador de config en `camelCase`, no pensado como nombre de fichero legible ni con extensión, y añadiría un caso más que testear sin aportar valor sobre un literal estable y predecible.

### D5. Factorización de la orquestación `onSuccess`/`onError` (resuelve el riesgo señalado en la spec)
Se extrae la orquestación duplicada de `button-layout-node.tsx` y `form-layout-node.tsx` a una función compartida nueva en `runtime-actions/runtime-ui-action-executor.ts`, p. ej.:

```ts
async function runActionOutcomeWithLifecycle(
  execute: () => Promise<{ status: 'success' | 'error' }>,
  onSuccess: RuntimeUiActionListEntry[] | undefined,
  onError: RuntimeUiActionListEntry[] | undefined,
  handlers: RuntimeUiActionHandlers,
  readState: () => RuntimeState,
  iterationContext?: RuntimeIterationContext,
)
```

Encapsula únicamente "ejecutar → decidir éxito/error → `runRuntimeUiActionLifecycleList`". Cada llamador construye su propio `execute`:
- `button`/`form` para `executeOperation`: `execute = () => executeQueryOperation(...)`.
- `button`/`form` para `executeOperations`: `execute` envuelve el `Promise.all` + `allSuccess`/`anyError` que ya existe hoy (se mueve tal cual, sin cambiar semántica).
- `button`/`link` para `downloadOperation`: `execute = () => runDownloadAction(...)` (D3).

Lo que **no** se mueve al helper compartido: `resetOnSuccess` y el `fileInputSources`/`hiddenFormFields`/`emptySubmitValues` de `form` siguen siendo responsabilidad de `form-layout-node.tsx`, envolviendo la llamada al helper — son detalles propios del submit, no de la orquestación de lifecycle en sí.

Con esto, `link` no duplica una tercera vez el patrón: gana lifecycle únicamente para `downloadOperation`, reutilizando el mismo helper que `button`.

**Alternativa descartada**: dejar la orquestación duplicada una tercera vez en `link` y una cuarta en el propio `downloadOperation` de `button`. Se descarta porque es exactamente el riesgo que la spec pide resolver explícitamente en design, y porque cuatro copias del mismo patrón (`button`×2, `form`×1, `link`×1) ya no es un caso aislado sino una convención implícita no factorizada.

### D6. Estado "en curso" por instancia vive en el componente del nodo, no en `runtime-state/`
El deshabilitado del control mientras la descarga está en curso (FR8) es **por instancia del nodo**, no por `operationName` global (dos botones con el mismo `operationName` se deshabilitan de forma independiente, según el caso límite de la spec). `queries.{operationName}` es estado compartido por diseño (`context.md`: "el estado de cada query o acción API es global"), así que no es el lugar correcto para esta bandera.

Decisión: `ButtonNode`/`LinkNode` mantienen un `useState<boolean>` local (`isDownloading` o similar) que se activa antes de llamar a `runDownloadAction` y se desactiva cuando el resultado (éxito o error) vuelve. `button` usa el atributo nativo `disabled`; `link` (sin `disabled` nativo en `<a>`) ignora el click mientras la bandera está activa y expone `aria-disabled="true"` para lectores de pantalla.

Para no triplicar esta guarda si en el futuro otra acción la necesitara, ambos nodos pueden compartir un hook pequeño local a `runtime/nodes/` (p. ej. `useActionInFlightGuard`), pero esto es un detalle de implementación, no una decisión de arquitectura bloqueante.

### D7. `downloadOperation` no se añade al catálogo anidado de `onSuccess`/`onError`
La spec (sección "Alcance") solo añade `downloadOperation` como valor de `button.props.action.type` y `link.props.action.type` de primer nivel. No lo menciona como entrada válida dentro de una lista `onSuccess`/`onError` de otra acción. Para no reabrir alcance, `downloadOperation` **no** se añade a `RuntimeUiActionListEntry` (el tipo que sí incluye hoy `executeOperation`/`executeOperations`/`navigateTo`/etc. como entradas encadenables). Solo es válido como `action` de nivel superior de un `button` o `link`.

Si en el futuro se quiere encadenar una descarga tras el éxito de otra operación, es una ampliación de alcance explícita, no una extensión silenciosa de este design.

### D8. `queries.{operationName}.data` se mantiene en `null` para `downloadOperation`
El `Blob` descargado no es JSON serializable ni tiene sentido como dato referenciable desde `queries.{operationName}.data.*` en otros nodos (la spec no pide eso; FR6 solo exige que `status` refleje `loading`/`success`/`error`). Se descarta guardar el `Blob` en el store compartido: rompería la expectativa de que `queries.*.data` es JSON consumible por referencias declarativas, y filtraría un objeto no serializable al estado central.

### D9. Reuso de los códigos de error existentes de `RuntimeApiError`, sin código nuevo
`downloadOperation` reutiliza `operation-not-found`, `request-build-failed`, `token-refresh-failed`, `network-error` (cubre también el fallo al leer el cuerpo como blob, igual que ya cubre "fallo posterior al leer el cuerpo de la respuesta" para JSON) y `http-error`. No se introduce un código nuevo tipo `invalid-binary-response` (el que sí usa `runtime-binary-fetch.ts` para blobs vacíos) porque, a diferencia del fetch de imágenes, un body vacío en 2xx **no** es un error para `downloadOperation` (D1) — ese código no tendría disparador real en este flujo, y mantener la taxonomía de errores idéntica a la de `executeOperation` simplifica los `when` de `onError`/`queryStateFeedback` que ya conocen esos códigos.

## Riesgos y trade-offs

- **`queryStateFeedback` y la heurística de `empty`**: `queries/feedback.md` deriva el estado visible `empty` quando una respuesta `success` trae `data` vacío (`null` incluido). Como D8 fija `data: null` en todo `downloadOperation` exitoso, un nodo que le enganche `queryStateFeedback` verá siempre la rama `empty`, nunca `success`. El campo crudo `queries.{operationName}.status` sigue siendo `'success'` (lo único que exige FR6), pero el estado visible derivado no distingue "descarga exitosa" de "sin resultados". Riesgo aceptado y documentado explícitamente aquí porque cambiar la heurística de `empty` es transversal a todo `queryStateFeedback` y está fuera del alcance de esta feature; si en el futuro se necesita feedback visual fino de éxito/error específico de una descarga, es una ampliación de alcance futura, no algo que deba resolver este design en silencio.
- **Nuevo patrón de "control deshabilitado durante la operación"**: hoy ningún botón/submit se deshabilita automáticamente mientras su operación está en curso (ni `executeOperation` ni `submitAction` lo hacen). `downloadOperation` introduce el primer caso de este comportamiento en el runtime. No se generaliza a `executeOperation`/`submitAction` porque no está pedido por la spec y cambiaría comportamiento visible existente sin acuerdo explícito.
- **Compatibilidad de navegador** de `URL.createObjectURL` + anchor temporal: riesgo bajo ya señalado en la spec como no bloqueante (mecanismo ya usado hoy por `image`/`gallery`, aunque no para forzar descarga).
- **Cuatro puntos de cambio coordinados** (D1–D5: `src/queries/`, `runtime-state/`, `runtime-actions/`, `runtime/nodes/`): el riesgo de esta feature no es una sola decisión difícil sino mantener consistentes cuatro capas ya existentes. Mitigado por seguir en cada capa el mismo patrón que ya usa `executeOperation`/`executeRuntimeBinaryFetch`, sin inventar una capa nueva.

## Migración o despliegue
No aplica. Cambio aditivo de config (nuevo valor de enum `action.type` en `button`/`link`) y de código interno; no hay datos persistidos que migrar ni despliegue coordinado más allá del release normal del runtime.

## Preguntas abiertas
Ninguna bloqueante para planificación. El único punto no cerrado (heurística `empty` de `queryStateFeedback` sobre `data: null`) está documentado como riesgo aceptado en la sección anterior, no como decisión pendiente.
