# 0048 — tasks

Contrato de ejecución secuencial para implementar la feature 0048 (el nodo `image` puede declarar `fetch` para obtener una imagen binaria desde un endpoint, gestionando la petición y el object URL de forma local al nodo, sin escribir en `queries.*`). Cada tarea es atómica, ordenada por dependencia y debe poder cerrarse en una sola pasada de implementación. La pasada de implementación debe seguir el orden exacto T1 → T2 → T3.

## Decisiones de planificación

Estas decisiones cierran los puntos abiertos por la spec antes de implementar:

- **Superficie nueva en `src/queries/`**: se añade una fachada `executeRuntimeBinaryFetch` que compone request, ejecuta `fetch` y devuelve el binario como `Blob`. No pasa por el catálogo `api`, no toca el store de `queries.*` y no escribe en `RuntimeState`. Es la única superficie de `src/queries/` consumida por el nodo `image` cuando `fetch` está declarado.
- **Semántica de referencias por campo**:
  - `fetch.url`: misma semántica que `image.props.src` — admite literal, referencia completa e interpolación parcial `{{...}}`. Reutiliza `resolveRuntimeVisibleValue` (o equivalente público) de `runtime-references/`.
  - `fetch.headers`: misma semántica que `api.headers` — referencia completa o literal en cada valor string. No admite interpolación parcial. Valores finales deben ser string.
  - `fetch.body`: misma semántica que `api.body` — árbol JSON serializable cuyas hojas string admiten referencia completa o literal. No admite interpolación parcial. `null` en raíz equivale a petición sin body.
- **Default de `fetch.method`**: el schema deja `method` ausente en el objeto validado cuando el config no lo declara (no normaliza a `'GET'` en validación). La fachada `executeRuntimeBinaryFetch` de T2 es la única responsable de aplicar el default `'GET'` al construir el `RequestInit`. Métodos admitidos coinciden con el catálogo actual de operaciones API y se reusa la tupla pública `supportedApiMethods` (ya exportada desde `src/config/runtime-config-zod.ts`: `'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'`) y el tipo `RuntimeApiMethod` (ya exportado desde `src/config/runtime-config-types.ts`).
- **Mutua exclusión**: el shape válido del nodo `image` es exactamente `{ src, alt }` o `{ fetch, alt }`. Cualquier combinación que declare `src` y `fetch` a la vez, `fetch` sin `fetch.url`, o ni `src` ni `fetch`, se rechaza en validación previa al render con diagnóstico trazable.
- **Ciclo de vida del nodo**: cuando `fetch` está declarado, el nodo dispara la petición al montar, ignora respuestas tardías si se desmonta antes, crea `URL.createObjectURL(blob)` solo si la respuesta es un Blob utilizable, y revoca el object URL al desmontar. Cada instancia es independiente; no hay caché entre instancias.
- **Render condicional**: mientras la petición está en curso o si falla (build, red, HTTP, blob no utilizable), el nodo no renderiza ningún `<img>`. El `alt` no se materializa fuera del `<img>`.

## Convenciones

- Cierre de implementación: código y tests propios de la tarea verdes.
- El umbral global del 80% de cobertura sobre `src/` (`pnpm test`) es gate de cierre de la pasada de implementación; no se replica por tarea (regla en `ai-workflow/standards/testing-rules.md`).
- La feature es aditiva: el modo actual `image` con `src` debe seguir comportándose exactamente igual cuando `fetch` no se declara.

---

## T1 — Extender contrato del nodo `image` con bloque `fetch` y mutua exclusión

- **ID**: T1
- **Estado**: completed
- **Objetivo**: Ampliar el contrato declarativo del nodo `image` para admitir un bloque opcional `fetch` mutuamente excluyente con `src`. El cambio debe quedar reflejado en (a) el tipo público `ImageLayoutNode`, (b) el esquema Zod `imageNodeSchema`, y (c) el validador `validateImageNode`, de forma que un config inválido se rechace en `validateRuntimeConfig` antes del render con un error trazable sobre la ruta exacta del nodo. La forma final aceptada para `image` es exactamente `{ src, alt }` o `{ fetch, alt }`, con `alt` siempre obligatorio. El bloque `fetch` lleva `url: string` obligatorio, `method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'`, `headers?: Record<string, string>` y `body?: RuntimeApiBodyValue | null` (mismo tipo ya soportado por la capa `api`). Las claves extra no soportadas dentro de `props.fetch` se descartan según la convención `strip` ya usada en el resto de schemas, y las claves extra a nivel de `props` siguen la misma convención. Esta tarea solo modifica el contrato y su validación; no implementa ninguna capacidad de red ni cambia el componente `ImageNode`.
- **Fuera de alcance**:
  - Cualquier ejecución HTTP, composición de request o helper en `src/queries/` (vive en T2).
  - Cualquier cambio en `src/runtime/nodes/image-layout-node.tsx` o introducción de hooks de ciclo de vida (vive en T3).
  - Cualquier cambio en `resolveRuntimeImageSource`/`resolveRuntimeImageAlt` o en `runtime-references/`.
  - Cualquier cambio en la semántica actual de `image` con `src`: el modo histórico debe seguir aceptándose y rechazándose exactamente igual que hoy.
  - Cualquier cambio en otros nodos del catálogo (`table`, `repeater`, etc.) o en su validación.
  - Cualquier cambio en `runtime-config-validation-image-table.test.ts` que no sea estrictamente necesario para mantener verdes los casos previos.
- **Dependencias**: ninguna.
- **Impacto esperado en archivos**:
  - Código:
    - `src/config/runtime-config-types.ts` — ampliar `ImageLayoutNode` para que `props` admita la unión `{ src: string; alt: string }` o `{ fetch: ImageFetchConfig; alt: string }`. Exportar el nuevo tipo `ImageFetchConfig` con `url: string`, `method?: RuntimeApiMethod`, `headers?: RuntimeApiHeaders`, `body?: RuntimeApiBodyValue | null`. Reutilizar literalmente los tipos públicos ya existentes en este mismo fichero (`RuntimeApiMethod`, `RuntimeApiHeaders`, `RuntimeApiBodyValue`); no introducir un alias nuevo ni duplicar la lista de métodos.
    - `src/config/runtime-config-zod.ts` — ampliar `imageNodeSchema` para aceptar la unión de `props` descrita. El bloque `fetch` debe validarse con un sub-schema (`imageFetchSchema`) que exija `url: nonEmptyStringSchema`, `method: z.enum(supportedApiMethods).optional()`, `headers: <flat string record>.optional()`, `body: <json body>.optional()`. La unión debe rechazar configs donde aparezcan `src` y `fetch` a la vez, donde `fetch` aparezca sin `url`, o donde no aparezca ni `src` ni `fetch`. Reusar `supportedApiMethods` y los sub-schemas ya definidos para `api.headers` y `api.body` (no introducir duplicados de método, headers o body).
    - `src/config/validate-layout-nodes.ts` — ajustar `validateImageNode` para que cualquier issue del nuevo `imageNodeSchema` produzca un `RuntimeConfigError` trazable en la ruta exacta del nodo (`pages[i].layout[…].props.fetch.url`, `pages[i].layout[…].props`, etc.) y reutilice las helpers existentes (`mapLeafNodeIssue`, `mapQueryStateFeedbackIssue`, `mapVisibilityIssue`) sin introducir un nuevo mecanismo de mapeo. El objeto `node` devuelto en `status: 'ready'` debe contener el `fetch` validado tal cual cuando aplica, o el `src` actual cuando aplica.
  - Tests:
    - `src/tests/config-validation/runtime-config-validation-image-fetch.test.ts` (nuevo).
  - Documentación: `ai-workflow/docs/app-features/nodes/image.md`, `ai-workflow/docs/app-features/config/structure.md` (impacto declarado; la actualización documental se hará vía `update-app-documentation` cuando el usuario la invoque).
- **Tests**:
  - Ficheros de test:
    - `src/tests/config-validation/runtime-config-validation-image-fetch.test.ts` (nuevo)
  - Comportamiento cubierto:
    - Acepta un nodo `image` con `props.fetch.url` literal y `props.alt` literal, sin `src`; el `node` devuelto conserva el `fetch` parseado y un `alt` igual al de entrada.
    - Acepta un nodo `image` con `props.fetch.url` como referencia completa (`queries.heroImage.data.url`).
    - Acepta un nodo `image` con `props.fetch.url` con interpolación parcial (`/media/{{item.id}}.png`).
    - Acepta un nodo `image` con `props.fetch` que incluya `method: 'POST'`, `headers: { authorization: 'queries.token.data' }` y `body: { id: 'item.id' }`; el resultado conserva esos campos.
    - Acepta un nodo `image` con `props.fetch` donde `method` se omite: el objeto validado conserva `fetch` sin la clave `method` (el schema no normaliza a `'GET'` ni añade el campo).
    - Acepta el contrato actual: nodo `image` con `props.src` literal y `props.alt`, sin `fetch`, sigue siendo válido con la misma forma que antes de la feature.
    - Acepta `queryStateFeedback` y `visibility` sobre un nodo `image` con `fetch`, igual que ya lo admite con `src`.
    - Rechaza con error trazable un nodo `image` con `props.fetch` y `props.src` declarados a la vez. El `code` del error y el `path` apuntan a `props` del nodo afectado.
    - Rechaza con error trazable un nodo `image` con `props.fetch` pero sin `props.fetch.url`. El `path` apunta a `props.fetch.url` o al primer issue equivalente.
    - Rechaza con error trazable un nodo `image` sin `props.src` ni `props.fetch` (comportamiento ya existente extendido al nuevo shape; el mensaje sigue siendo legible).
    - Rechaza con error trazable un nodo `image` con `props.fetch.url` vacío (string vacío).
    - Rechaza con error trazable un nodo `image` con `props.fetch.method` con un valor fuera del enum admitido (`'OPTIONS'`).
    - Rechaza con error trazable un nodo `image` con `props.fetch.headers` cuyo valor no es string (`{ authorization: 123 }`).
    - Rechaza con error trazable un nodo `image` sin `props.alt` aunque declare `fetch` (alt sigue siendo obligatorio).
    - Claves extra dentro de `props.fetch` se descartan del objeto validado sin invalidar el config (consistente con la convención `strip` actual del proyecto).
    - Una página con un `image` válido en modo `fetch` dentro de un `repeater.props.template` se acepta y conserva la forma esperada en el `node` devuelto.
  - Comandos durante la implementación:
    - `pnpm test --run src/tests/config-validation/runtime-config-validation-image-fetch.test.ts`
    - `pnpm test --run src/tests/config-validation/runtime-config-validation-image-table.test.ts`
  - Restricciones:
    - Reusar los helpers de `src/tests/config-validation/helpers.ts` (`createConfigWithLayout`, `createVisibilityRule`) en lugar de construir configs ad hoc.
    - No introducir nuevos mocks de Zod ni helpers de validación: el test debe ejercitar la fachada pública `validateRuntimeConfig` igual que el resto de la carpeta.
    - No añadir snapshots.
- **Documentación afectada**: `ai-workflow/docs/app-features/nodes/image.md`, `ai-workflow/docs/app-features/config/structure.md`.
- **Criterios de finalización**:
  - El tipo `ImageLayoutNode` admite ambas formas de `props` y exporta `ImageFetchConfig` reutilizando tipos existentes de la capa `api`.
  - `imageNodeSchema` rechaza las combinaciones inválidas listadas y acepta las válidas.
  - `validateImageNode` produce errores trazables sobre la ruta exacta del nodo en cada caso de rechazo, sin introducir un nuevo mecanismo de mapeo.
  - El test `runtime-config-validation-image-fetch.test.ts` cubre el comportamiento descrito y queda verde.
  - El test previo `runtime-config-validation-image-table.test.ts` sigue verde sin cambios funcionales.
- **Cierre de implementación**: T1 cierra cuando los dos ficheros de test indicados están verdes y `pnpm test` no rompe ninguna otra suite previa.

---

## T2 — Fachada `executeRuntimeBinaryFetch` en `src/queries/`

- **ID**: T2
- **Estado**: completed
- **Objetivo**: Añadir a `src/queries/` una fachada pública para ejecutar una petición HTTP binaria descrita inline (sin pasar por el catálogo `api` ni por el store de `queries.*`). La fachada acepta el shape `ImageFetchConfig` definido en T1, junto con el `RuntimeState` actual y un `iterationContext` opcional. Resuelve referencias en `url`, `headers` y `body` reusando `runtime-references/` y los helpers ya existentes en `src/queries/runtime-api-request.ts` (extrayéndolos a un módulo compartido si hace falta para no duplicar lógica). Ejecuta `fetch(url, init)` con un `fetch` inyectable, y devuelve un resultado tipado: en éxito, un `Blob` extraído de la respuesta; en error, un `RuntimeBinaryFetchError` con `code` perteneciente al conjunto `'request-build-failed' | 'network-error' | 'http-error' | 'invalid-binary-response'`. La fachada no toca `RuntimeState` ni dispatcha acciones; es una función pura sobre sus argumentos salvo por el `fetch` y la construcción del `Blob`.
- **Fuera de alcance**:
  - Cualquier cambio en la API pública existente de `executeRuntimeApiOperation`, `executeBuiltRuntimeApiRequest`, `buildRuntimeApiRequest` o sus tipos exportados que no sea estrictamente necesario para extraer helpers compartidos. Si se factorizan helpers, los tests de `runtime-api-execution` y `runtime-api-request` previos deben seguir verdes sin cambios.
  - Cualquier cambio en `runtime-references/`.
  - Cualquier integración con `RuntimeState` (no escribe en `queries.*`, no lee `pageEntry`, no dispatcha).
  - Cualquier uso desde un componente visual o hook (vive en T3).
  - Caché de respuestas, deduplicación entre instancias, reintentos automáticos, cancelación configurable o `AbortController` desde la fachada (T3 puede ignorar respuestas tardías por su cuenta sin que la fachada exponga cancelación).
  - Validación del shape de `ImageFetchConfig`: se asume que llega validado por T1.
- **Dependencias**: T1 cerrado (consume `ImageFetchConfig`).
- **Impacto esperado en archivos**:
  - Código:
    - `src/queries/runtime-binary-fetch.ts` (nuevo) — exporta `executeRuntimeBinaryFetch(options: ExecuteRuntimeBinaryFetchOptions): Promise<RuntimeBinaryFetchResult>`. Internamente: (a) resuelve `fetchConfig.url` con `resolveRuntimeImageSource(value, state, { iterationContext })` ya exportado desde `runtime-references/runtime-reference-resolver.ts` (reproduce literalmente la semántica `image.props.src`, incluida la interpolación parcial y la degradación a `null` cuando el resultado no es string no vacío); si el resultado es `null`, devuelve `{ status: 'error', error: { code: 'request-build-failed', message: <legible> } }`. La fachada no introduce una surface key nueva en `runtime-references/`. (b) resuelve `fetchConfig.headers` y `fetchConfig.body` reusando las funciones extraídas en `runtime-api-payload-resolver.ts`; ningún literal de mensaje de error de `runtime-api-request.ts` se duplica aquí. (c) construye `RequestInit` con `method` aplicando default `'GET'` si la clave está ausente en `fetchConfig`, `headers` y `body` (serializando JSON y añadiendo `content-type: application/json` si hay body y no existe content-type explícito en ningún casing; misma regla que `runtime-api-request`). (d) ejecuta `await fetch(url, init)`; sobre fallo de red devuelve `{ status: 'error', error: { code: 'network-error', message } }`; sobre `!response.ok` devuelve `{ status: 'error', error: { code: 'http-error', message } }`. (e) sobre `ok` llama `await response.blob()`; si el `Blob` resultante tiene `size === 0` o el `await` lanza, devuelve `{ status: 'error', error: { code: 'invalid-binary-response', message } }`; en caso normal devuelve `{ status: 'success', blob }`.
    - `src/queries/runtime-binary-fetch-types.ts` (nuevo) — define y exporta `ExecuteRuntimeBinaryFetchOptions { fetchConfig: ImageFetchConfig; state: RuntimeState; iterationContext?: RuntimeIterationContext; fetch?: typeof fetch }`, `RuntimeBinaryFetchError { code: 'request-build-failed' | 'network-error' | 'http-error' | 'invalid-binary-response'; message: string }` y `RuntimeBinaryFetchResult = { status: 'success'; blob: Blob } | { status: 'error'; error: RuntimeBinaryFetchError }`.
    - `src/queries/runtime-api-request.ts` — extraer las funciones internas `resolveHeaders`, `resolveBody`, `resolveJsonPayloadValue`, `resolvePayloadValue` y `isRuntimeApiBodyRuntimeValue` a un módulo nuevo `src/queries/runtime-api-payload-resolver.ts` (decisión cerrada: la factorización es obligatoria, no opcional). `buildRuntimeApiRequest` pasa a importarlas desde ese módulo. La firma y el comportamiento observable de `buildRuntimeApiRequest` y `executeRuntimeApiOperation` no cambian; los mensajes de error mantenidos siguen incluyendo `"The api operation \"${operationName}\""`.
    - `src/queries/runtime-api-payload-resolver.ts` (nuevo) — alberga las funciones extraídas y se vuelve la única implementación reusada tanto por `buildRuntimeApiRequest` como por `executeRuntimeBinaryFetch`. La firma de las funciones extraídas debe permitir parametrizar el prefijo de mensaje de error (p. ej. `'The api operation "X"'` para la capa `api` y `'The image fetch'` para la fachada binaria) sin romper los mensajes históricos.
    - `src/queries/runtime-api-executor.ts` — no se modifica para esta feature. El consumidor de T3 importa `executeRuntimeBinaryFetch` directamente desde `'../../queries/runtime-binary-fetch'`. No se añade barrel ni re-export.
  - Tests:
    - `src/tests/runtime/runtime-image-binary-fetch.test.ts` (nuevo).
  - Documentación: `ai-workflow/docs/app-features/nodes/image.md`, `ai-workflow/docs/architecture.md` (la frontera de red sigue en `src/queries/`; impacto declarado, actualización documental vía `update-app-documentation`).
- **Tests**:
  - Ficheros de test:
    - `src/tests/runtime/runtime-image-binary-fetch.test.ts` (nuevo)
  - Comportamiento cubierto:
    - Con `fetchConfig.url = '/media/hero.png'` literal y `fetch` mockeado para devolver `Response(new Blob([bytes], { type: 'image/png' }))`, la fachada llama a `fetch('/media/hero.png', { method: 'GET' })` y devuelve `{ status: 'success', blob }` donde `blob.size > 0`.
    - Con `fetchConfig.url = 'queries.heroImage.data.url'` y `state.queries.heroImage.data.url === '/cdn/x.png'`, la fachada llama a `fetch('/cdn/x.png', ...)`.
    - Con `fetchConfig.url = '/media/{{item.id}}.png'` y `iterationContext` que expone `item.id === '42'`, la fachada llama a `fetch('/media/42.png', ...)`.
    - Con `fetchConfig.method = 'POST'`, `fetchConfig.headers = { authorization: 'queries.token.data' }` (referencia resuelta a `'Bearer xyz'`) y `fetchConfig.body = { id: 'item.id' }` con `item.id === '42'`, el `init` enviado a `fetch` tiene `method: 'POST'`, `headers: { authorization: 'Bearer xyz', 'content-type': 'application/json' }` y `body: JSON.stringify({ id: '42' })`.
    - Cuando `fetchConfig.body` declara `content-type` explícito (en cualquier casing) en `headers`, el builder no sobrescribe el `content-type`.
    - Cuando `fetchConfig.url` no resuelve a un string no vacío (referencia ausente, resolución que devuelve string vacío), la fachada devuelve `{ status: 'error', error: { code: 'request-build-failed', message } }` y no llama a `fetch`.
    - Cuando un valor de `fetchConfig.headers` no resuelve a string (referencia ausente o tipo incompatible), la fachada devuelve `{ status: 'error', error: { code: 'request-build-failed' } }` y no llama a `fetch`.
    - Cuando un nodo string de `fetchConfig.body` no resuelve a un valor JSON utilizable, la fachada devuelve `{ status: 'error', error: { code: 'request-build-failed' } }` y no llama a `fetch`.
    - Cuando el `fetch` inyectado rechaza (network), la fachada devuelve `{ status: 'error', error: { code: 'network-error' } }`.
    - Cuando el `fetch` inyectado resuelve con `Response` cuyo `ok === false` (p. ej. status 500), la fachada devuelve `{ status: 'error', error: { code: 'http-error' } }`.
    - Cuando el `fetch` inyectado resuelve con `Response` cuyo `.blob()` resuelve a un `Blob` con `size === 0`, la fachada devuelve `{ status: 'error', error: { code: 'invalid-binary-response' } }`.
    - Cuando el `fetch` inyectado resuelve con `Response` cuyo `.blob()` rechaza, la fachada devuelve `{ status: 'error', error: { code: 'invalid-binary-response' } }`.
    - La fachada no muta el `state` recibido (verificable mediante igualdad estructural pre/post llamada sobre `state.queries`, `state.forms`, `state.navigation`).
  - Comandos durante la implementación:
    - `pnpm test --run src/tests/runtime/runtime-image-binary-fetch.test.ts`
    - `pnpm test --run src/tests/runtime/runtime-api-execution.test.ts`
  - Restricciones:
    - No tocar el comportamiento observable de `executeRuntimeApiOperation`. La extracción de helpers a `runtime-api-payload-resolver.ts` es obligatoria, pero los tests previos de la suite `runtime-api-execution` deben seguir verdes sin cambios.
    - Inyectar `fetch` siempre como dependencia explícita en los tests; no usar `vi.stubGlobal('fetch', …)` salvo que el resto de la suite ya lo haga consistentemente.
    - Reusar fabricadores de `Response` y `Blob` nativos de jsdom; no introducir un mock manual de `Response`.
    - No añadir snapshots.
- **Documentación afectada**: `ai-workflow/docs/app-features/nodes/image.md`, `ai-workflow/docs/architecture.md`.
- **Criterios de finalización**:
  - `executeRuntimeBinaryFetch` existe y devuelve los resultados tipados descritos.
  - La resolución de referencias delega en `runtime-references/` y los helpers ya usados por `buildRuntimeApiRequest` para `headers` y `body`.
  - El `RuntimeState` no se muta y no se escribe en `queries.*`.
  - El test `runtime-image-binary-fetch.test.ts` cubre el comportamiento descrito y queda verde.
  - `runtime-api-execution.test.ts` y `runtime-api-request.ts` mantienen su contrato y sus tests previos sin regresiones.
- **Cierre de implementación**: T2 cierra cuando los tests indicados están verdes y `pnpm test` no rompe ninguna otra suite previa.

---

## T3 — Consumir la fachada desde el nodo `image` con ciclo de vida del object URL

- **ID**: T3
- **Estado**: completed
- **Objetivo**: Conectar el componente `ImageNode` con la fachada de T2 cuando el config declare `props.fetch`, manteniendo el modo actual `props.src` intacto. El componente debe disparar la petición al montar, ignorar respuestas tardías si se desmonta antes, crear un object URL con `URL.createObjectURL(blob)` al recibir un `Blob` válido, revocarlo con `URL.revokeObjectURL(url)` al desmontar, y renderizar `<img src={objectUrl} alt={resolvedAlt}>` solo cuando la petición ha resuelto con éxito. Mientras la petición está en curso o si falla, el nodo no renderiza ningún `<img>`. Cada instancia del nodo gestiona su propio ciclo de petición de forma independiente, incluyendo varias instancias dentro de un `repeater` (con `iterationContext` propio por iteración). El componente no debe escribir en `RuntimeState`, no debe leer ni mutar `queries.*`, y debe consumir la fachada `executeRuntimeBinaryFetch` directamente (no a través de una acción declarativa ni del store).
- **Fuera de alcance**:
  - Cualquier cambio en el contrato Zod o en `validateImageNode` (vive en T1).
  - Cualquier cambio en `executeRuntimeBinaryFetch` o sus tipos (vive en T2).
  - Cualquier indicador visual de carga (spinner, placeholder) o de error: la spec excluye explícitamente esos estados.
  - Cualquier caché o memorización entre instancias del nodo `image`.
  - Reintentos automáticos o re-disparo ante cambios de `state` después del montaje. El alcance funcional es petición única al montaje.
  - Cualquier cambio en otros nodos del catálogo.
- **Dependencias**: T1 y T2 cerrados.
- **Impacto esperado en archivos**:
  - Código:
    - `src/runtime/nodes/use-image-fetch-source.ts` (nuevo) — exporta `useImageFetchSource(fetchConfig: ImageFetchConfig, iterationContext?: RuntimeIterationContext): { status: 'pending' | 'success' | 'error'; src: string | null }`. Internamente: (a) lee `state` con `useRuntimeState()`. (b) en un `useEffect` con `[]` (o equivalente que dispare una sola vez al montar) llama `executeRuntimeBinaryFetch({ fetchConfig, state, iterationContext })` sin pasar el parámetro `fetch`. La fachada de T2 hace fallback a `globalThis.fetch` cuando no se pasa, por lo que el hook no necesita capturar `window.fetch` manualmente. Los tests inyectan el `fetch` global con `vi.stubGlobal('fetch', …)`. (c) usa una bandera `isMounted` interna (no `AbortController`) para descartar el resultado si el componente se desmonta antes de que la promesa resuelva. (d) al recibir `status: 'success'` llama `URL.createObjectURL(blob)`, guarda la URL en estado local y la devuelve. (e) en el `useEffect` cleanup, revoca cualquier object URL pendiente con `URL.revokeObjectURL(url)`. (f) si la fachada devuelve `status: 'error'`, deja el estado en `'error'` y `src: null`. La snapshot del `state` usada para resolver referencias es la del momento del montaje; no se re-dispara la petición ante cambios posteriores del store.
    - `src/runtime/nodes/image-layout-node.tsx` — bifurcar el render según el shape de `node.props`: si declara `fetch`, usar el hook `useImageFetchSource(node.props.fetch, iterationContext)` para derivar `src`; si declara `src`, mantener el path actual con `resolveRuntimeImageSource`. En ambos casos, no renderizar `<img>` cuando `src === null` (pending o error en el modo `fetch`; resolución vacía en el modo `src`). En el modo `fetch`, resolver `alt` con `resolveRuntimeImageAlt` sobre el estado actual; el hook no se ocupa del `alt`.
  - Tests:
    - `src/tests/layout-renderer/layout-renderer-image-fetch.test.tsx` (nuevo).
  - Documentación: `ai-workflow/docs/app-features/nodes/image.md`, `ai-workflow/docs/current-state.md` (impacto declarado; actualización documental vía `update-app-documentation`).
- **Tests**:
  - Ficheros de test:
    - `src/tests/layout-renderer/layout-renderer-image-fetch.test.tsx` (nuevo)
  - Comportamiento cubierto:
    - Con un nodo `image` con `props.fetch.url` literal y un `fetch` global mockeado que devuelve un `Blob` válido, el primer render no contiene `<img>`; tras `await` de la promesa, aparece un único `<img>` cuyo `src` empieza por `blob:` y cuyo `alt` es el resuelto desde `props.alt`.
    - Mientras la promesa de `fetch` está en curso, no se renderiza ningún `<img>` para ese nodo.
    - Si el `fetch` global rechaza (network error), tras la resolución de la promesa el nodo sigue sin renderizar `<img>`.
    - Si el `fetch` global resuelve con `Response` de error HTTP, el nodo sigue sin renderizar `<img>`.
    - Si la respuesta es un `Blob` con `size === 0`, el nodo sigue sin renderizar `<img>`.
    - Al desmontar el nodo (cambio de página o `unmount` del render), `URL.revokeObjectURL` se llama con el object URL previamente creado (verificable con spy sobre `URL.revokeObjectURL` y/o sobre `URL.createObjectURL`).
    - Si el componente se desmonta antes de que la promesa de `fetch` resuelva, no se llama a `URL.createObjectURL` y no se intenta actualizar estado tras el unmount.
    - Dos instancias del nodo `image` con `fetch` declarado en la misma página disparan dos llamadas a `fetch` independientes; el éxito de una no condiciona a la otra; el fallo de una no impide a la otra renderizar.
    - Dentro de un `repeater` con dos items, dos instancias del nodo `image` con `props.fetch.url = '/media/{{item.id}}.png'` realizan dos llamadas a `fetch` distintas (`'/media/<id1>.png'` y `'/media/<id2>.png'`).
    - Un nodo `image` con `props.fetch` fuera de `repeater` se comporta igual que dentro de él pero sin contexto `item.*` (resolviendo solo referencias globales como `queries.*` o `params.*`).
    - El modo existente `image` con `props.src` y `props.alt` sigue renderizando exactamente como antes (regresión simple sobre el path histórico).
    - El nodo `image` con `fetch` no escribe en `RuntimeState`: tras el ciclo completo, el `state.queries` permanece estructuralmente igual al inicial.
  - Comandos durante la implementación:
    - `pnpm test --run src/tests/layout-renderer/layout-renderer-image-fetch.test.tsx`
    - `pnpm test --run src/tests/layout-renderer/layout-renderer-image-table.test.tsx`
  - Restricciones:
    - Reusar el harness ya establecido en `src/tests/layout-renderer/layout-renderer-image-table.test.tsx` y, si aplica, helpers comunes de `layout-renderer/`. No introducir un harness paralelo de render para esta feature.
    - Mockear `URL.createObjectURL` y `URL.revokeObjectURL` con `vi.spyOn(URL, …)` o equivalente; no introducir un polyfill nuevo de URL.
    - Inyectar el `fetch` global mediante `vi.stubGlobal('fetch', …)` y restaurarlo con `vi.unstubAllGlobals()` en `afterEach` (mismo patrón usado en `layout-renderer-image-table.test.tsx`). El hook no expone un parámetro `fetch`; la inyección es solo por stub global.
    - No añadir snapshots.
- **Documentación afectada**: `ai-workflow/docs/app-features/nodes/image.md`, `ai-workflow/docs/current-state.md`.
- **Criterios de finalización**:
  - `useImageFetchSource` existe, se monta una sola vez por instancia, gestiona el object URL y descarta resultados tardíos en unmount.
  - `ImageNode` consume el hook solo cuando `node.props.fetch` está declarado y mantiene intacto el path `props.src`.
  - El test `layout-renderer-image-fetch.test.tsx` cubre el comportamiento descrito y queda verde.
  - `layout-renderer-image-table.test.tsx` mantiene su contrato y sus tests previos sin regresiones.
  - `pnpm test` mantiene el umbral global del 80% en `functions`, `lines` y `statements` sobre `src/`.
- **Cierre de implementación**: T3 cierra cuando los tests indicados están verdes, no hay regresiones en otras suites de `src/tests/`, y `pnpm test` pasa el gate global de cobertura.

---

## Siguiente tarea a tomar

T1 (extender contrato del nodo `image` con bloque `fetch` y mutua exclusión).
