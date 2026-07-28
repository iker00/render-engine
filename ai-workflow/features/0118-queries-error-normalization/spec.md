# Spec: normalización de errores en `src/queries/` (rechazos de fetch sin capturar)

## Contexto de partida

Esta feature nace del hallazgo A-08 de la auditoría técnica del repo (2026-07-27): en ese momento solo existían 3
bloques `catch` en todo `src/` de producción, y se sospechaba que `src/queries/runtime-api-executor.ts` y
`src/queries/runtime-api-request.ts` podían dejar escapar una promesa de `fetch()` rechazada sin capturar,
especialmente dentro de los `Promise.all(...)` que orquestan varias queries en paralelo (preloads).

El código ha cambiado sustancialmente desde entonces (features 0114-0117 de refactor ya aplicadas). Esta spec se basa
en una investigación nueva del estado actual del código, no en la descripción original del hallazgo.

## Hallazgo técnico verificado

- **Bloques `catch` hoy en `src/` de producción: 13** (no 3), repartidos en 10 ficheros: `app/bootstrap/read-runtime-config.ts:49`,
  `app/bootstrap/read-runtime-data-values.ts:44`, `queries/runtime-binary-fetch.ts:60,85`,
  `queries/runtime-api-executor.ts:184,223`, `queries/runtime-file-base64-encoder.ts:34`,
  `config/validate-file-manager-nodes.ts:255`, `config/validate-form-field-validations.ts:246,266`,
  `runtime/runtime-form-validations.ts:333`, `dev-runtime/dev-runtime-monaco-editor.tsx:60`,
  `dev-runtime/dev-runtime.tsx:255`. El número stale de la auditoría original ya no refleja el código actual.
- **Puntos de llamada real a `fetch` en producción: exactamente 2**, ambos inyectados vía parámetro `fetch` con
  default al global (nunca una llamada literal `fetch(...)` sin abstraer):
  - `src/queries/runtime-api-executor.ts` → `executeBuiltRuntimeApiRequest` (línea 183), usado por
    `executeRuntimeApiOperation`, `executeInlineRuntimeApiOperation`, preloads por página, preloads globales, submit
    de formularios y refresco de tokens.
  - `src/queries/runtime-binary-fetch.ts` → `executeRuntimeBinaryFetch` (línea 59), usado para la carga de imágenes
    remotas (`image` node).
- **Ambos puntos ya envuelven la llamada a `fetch()` en `try/catch`** y normalizan un rechazo de red a
  `code: 'network-error'`. El hallazgo original ("un `fetch()` rechazado escapa sin capturar") **no aplica ya a la
  llamada de red en sí** — eso ya está bien defendido y cubierto por test (`src/tests/runtime/runtime-api-execution.test.ts`,
  caso "normalizes fetch failures... with stable error codes").
- **Gap real encontrado**: en `executeBuiltRuntimeApiRequest` (`src/queries/runtime-api-executor.ts`), tras un
  `fetch()` que resuelve con éxito (`response.ok`), la lectura del cuerpo `const responseText = await response.text()`
  (línea 211) **no está envuelta en `try/catch`**. Si la conexión se corta o el stream del cuerpo falla después de
  que las cabeceras ya llegaron (recorte de conexión a mitad de transferencia, `ERR_CONTENT_LENGTH_MISMATCH`, proxy
  que cierra el socket, etc.), `response.text()` rechaza con un `TypeError` que **no se captura** y se propaga como
  rechazo no manejado desde `executeBuiltRuntimeApiRequest` hacia arriba.
- Esto contrasta con el módulo hermano `src/queries/runtime-binary-fetch.ts`, donde la lectura equivalente del cuerpo
  (`response.blob()`, línea 84) **sí** está envuelta en `try/catch` y normaliza a `code: 'invalid-binary-response'`,
  con test explícito ya existente (`src/tests/runtime/runtime-image-binary-fetch.test.ts`, caso "returns
  invalid-binary-response when response.blob() rejects"). El patrón defensivo correcto ya existe en el proyecto; solo
  falta en la ruta JSON/API.
- **Consecuencias reales de ese rechazo no capturado**, verificadas leyendo cada punto de orquestación que depende de
  que `executeBuiltRuntimeApiRequest` nunca rechace:
  1. **Preloads por página** (`src/runtime/runtime-state/runtime-state-provider.tsx:297-318`): el `Promise.all` sobre
     `executeQueryOperationWithSnapshot` para el subconjunto de `reloadItems` de la tanda. Si una sola precarga
     rechaza en la lectura del cuerpo, el `.then()` agregado que dispatcha `page-entry/set-settled` nunca se ejecuta:
     `pageEntry.status` queda colgado en `loading` de forma indefinida, aunque el resto de precargas de la misma
     tanda ya hayan resuelto con éxito o error (cada una despacha su propio `queries/set-*` antes de que el
     `Promise.all` se resuelva, pero el agregado de página nunca cierra).
  2. **Submit de formulario con `executeOperations`** (`src/runtime/nodes/form-layout-node.tsx:267-296`): mismo
     patrón `Promise.all`. Un rechazo en una operación impide que `runOnSuccessActions`/`runOnErrorActions` y
     `resetOnSuccess` se evalúen nunca para el envío completo, aunque otras operaciones del mismo lote ya hayan
     tenido éxito.
  3. **Acciones de botón/enlace** `executeOperation`/`executeOperations`
     (`src/runtime/runtime-actions/runtime-ui-action-executor.ts:36-59`): se disparan con
     `void handlers.executeQueryOperation(...)`, sin `.catch`. Un rechazo se convierte en una promesa rechazada no
     manejada (sin handler global de `unhandledrejection` en el proyecto) y esa query concreta nunca recibe su
     `queries/set-error`: queda en `loading` para siempre de cara a cualquier `queryStateFeedback` que la consuma.
  4. **Preloads globales de aplicación** (`src/runtime/runtime-global-preloads/use-runtime-global-preloads.ts:48-50`):
     mismo patrón fire-and-forget (`void settleGlobalPreload(...)` por entrada). Un rechazo deja esa query sembrada
     en `loading` desde el arranque sin salir jamás de ese estado, y además **desactiva por completo la política de
     reintentos acotados** (`src/queries/runtime-api-retry.ts`): `runRuntimeApiRequestWithRetries` está
     explícitamente diseñado y testeado para propagar un rechazo de `attempt()` en vez de tratarlo como un resultado
     de error reintentable (`src/tests/runtime/runtime-api-retry.test.ts`, caso "propagates a synchronous rejection
     from attempt without transforming it into an error result"). El único mecanismo del runtime pensado para
     tolerar fallos queda anulado por este gap concreto.
  5. **Refresco automático de tokens** (`src/runtime/runtime-tokens/use-runtime-token-scheduler.ts`, función
     `runCycle`, invocada vía `void runCycle(...)`): un rechazo de `executeTokenRefresh` rompe la cadena recursiva de
     reprogramación — `scheduleNextCycle` para el siguiente ciclo nunca se llama tras un rechazo — por lo que el
     refresco periódico de ese token **se detiene silenciosamente para siempre**, no solo falla una vez.
- **Conclusión de la investigación**: el hallazgo original estaba parcialmente desactualizado (la llamada a `fetch()`
  en sí ya está bien defendida en ambos módulos) pero **sigue existiendo un riesgo real y concreto**, más preciso y
  más acotado de lo que describía la auditoría: un único paso sin capturar (`response.text()` tras un `fetch()`
  exitoso) en un único fichero (`runtime-api-executor.ts`), que al ser el punto de paso obligado de toda ejecución de
  operaciones `api`, se propaga a los cinco puntos de orquestación listados arriba. No se fabrica alcance adicional
  más allá de cerrar ese gap y su cobertura de test.

## Objetivo

Garantizar que la ejecución de una operación `api` en `src/queries/` (`executeBuiltRuntimeApiRequest` y todo lo que
lo envuelve) nunca produzca una promesa rechazada hacia sus llamadores: todo fallo — de red, de lectura del cuerpo de
la respuesta, de parseo JSON, de condición de error de negocio — debe resolver siempre en un `RuntimeApiExecutionResult`
tipado (`{ status: 'success' | 'error' }`), igual que ya ocurre para el resto de fallos ya cubiertos hoy.

## Alcance

- Envolver la lectura del cuerpo de la respuesta (`response.text()`) en `executeBuiltRuntimeApiRequest`
  (`src/queries/runtime-api-executor.ts`) en un manejo explícito de fallo, de forma que un rechazo en ese paso se
  normalice a un resultado `{ status: 'error', error: { code: ..., message: ... } }` en vez de propagar un rechazo de
  promesa.
- Decisión de código de error: reutilizar `code: 'network-error'` para este fallo (en vez de introducir un código
  nuevo en la taxonomía pública de `RuntimeApiError['code']`), porque desde la perspectiva de quien consume
  `queryStateFeedback` ambos fallos (fetch rechazado, lectura del cuerpo rechazada) son la misma categoría de fallo
  de transporte/infraestructura, y el mensaje de error sigue distinguiendo la causa en texto. Se prioriza no ampliar
  el contrato público de códigos, tal como pide el objetivo de esta feature. (`runtime-binary-fetch.ts` usa un
  código propio, `invalid-binary-response`, para su caso equivalente; no se replica ese patrón aquí para no crear dos
  convenciones distintas de nomenclatura de error dentro de la misma feature sin necesidad funcional que lo justifique.)
- Añadir un test explícito que cubra el caso "fetch resuelve con éxito pero `response.text()` rechaza", verificando
  que `executeRuntimeApiOperation`/`executeInlineRuntimeApiOperation`/`executeBuiltRuntimeApiRequest` resuelven con
  un resultado de error normalizado y no con una promesa rechazada. Este es el único caso de "operación de
  `queries/` sin cubrir" que la investigación encontró; el resto de operaciones de `src/queries/` (fetch rechazado,
  encoding de ficheros, fetch binario, reintentos) ya tienen su contraparte de test para el fallo async
  correspondiente.
- No se introduce ningún cambio de comportamiento para el resto de fallos ya normalizados (`network-error` de fetch,
  `http-error`, `invalid-json-response`, `business-error-condition`, `operation-not-found`, `request-build-failed`,
  `token-refresh-failed`): siguen exactamente igual.

## Fuera de alcance

- Cualquier cambio en `src/queries/runtime-binary-fetch.ts`: ya normaliza correctamente el fallo equivalente
  (`response.blob()` rechazado → `invalid-binary-response`) y ya tiene su test. No requiere ningún cambio.
- Cualquier cambio en `src/queries/runtime-file-base64-encoder.ts`: su único `Promise.all`
  (`encodeFilesToBase64Entries`) es seguro porque cada promesa individual (`encodeFileToBase64Entry`) ya está
  envuelta en `try/catch` y nunca rechaza. No requiere ningún cambio.
- Cualquier cambio arquitectónico en cómo se orquestan los `Promise.all` de preloads por página, preloads globales o
  submit de formulario (`runtime-state-provider.tsx`, `use-runtime-global-preloads.ts`, `form-layout-node.tsx`). Una
  vez que `executeBuiltRuntimeApiRequest` deja de poder rechazar, esos puntos de orquestación quedan protegidos sin
  necesidad de tocarlos: no hay ningún otro punto en esos ficheros que emita una promesa que pueda rechazar por causa
  de red/parseo.
- Añadir un manejador global de `window.onunhandledrejection` u otro mecanismo de red de seguridad a nivel de
  aplicación. Se descarta porque, una vez cerrado el gap puntual, no hay ninguna ruta conocida en `src/queries/` que
  pueda seguir generando un rechazo no capturado; añadir una red de seguridad adicional sin una causa real que la
  motive sería alcance no solicitado.
- Ampliar o modificar la taxonomía pública de `RuntimeApiError['code']` con códigos nuevos.
- Cualquier cambio en la política de reintentos acotados del `preloads` global (`runtime-api-retry.ts`): una vez que
  `attempt()` deja de poder rechazar en la práctica, la política ya vigente empieza a aplicarse también a este caso
  sin cambios en `runtime-api-retry.ts`.
- Tests de integración exhaustivos en cada uno de los 5 puntos de orquestación downstream (preloads por página,
  preloads globales, submit de formulario, acciones de botón/enlace, refresco de tokens) para el escenario
  "`response.text()` rechaza". El test a nivel de `src/queries/` ya verifica la garantía de contrato (nunca rechaza);
  replicar el mismo escenario en cada consumidor añadiría cobertura redundante sin valor adicional, dado que ninguno
  de esos consumidores tiene lógica propia de manejo de fallo entre ellos y `executeBuiltRuntimeApiRequest`.

## Requisitos funcionales

1. `executeBuiltRuntimeApiRequest` nunca devuelve una promesa rechazada por un fallo en la lectura del cuerpo de la
   respuesta: siempre resuelve a `{ status: 'success', ... }` o `{ status: 'error', error: {...} }`.
2. Si `response.text()` rechaza tras un `fetch()` exitoso con `response.ok`, el resultado normalizado es
   `{ status: 'error', error: { code: 'network-error', message: '...' } }`, con un mensaje que identifica el nombre
   de la operación afectada, siguiendo el mismo estilo de mensaje que el resto de errores de esta función.
3. `executeRuntimeApiOperation` y `executeInlineRuntimeApiOperation` heredan la misma garantía sin cambios propios,
   porque ambas delegan directamente en `executeBuiltRuntimeApiRequest`.
4. Ningún otro comportamiento de error ya normalizado hoy (`http-error`, `invalid-json-response`,
   `business-error-condition`, `operation-not-found`, `request-build-failed`, `token-refresh-failed`, el
   `network-error` ya existente para el `fetch()` inicial) cambia de código, de condición de disparo ni de mensaje.

## Requisitos no funcionales

- El cambio se mantiene localizado en `src/queries/runtime-api-executor.ts`; no se toca la fachada pública
  (`executeQueryOperation`, `executeInlineQueryOperation`, `executeRuntimeUiAction`) ni ningún fichero de
  `src/runtime/` para lograr la garantía de "nunca rechaza".
- No se introduce ninguna dependencia externa nueva.
- El umbral mínimo de cobertura del 80 % sobre `src/` se mantiene.

## Criterios de aceptación

1. Con un `fetch` mock que resuelve con una `Response` `ok` cuyo método `.text()` rechaza (por ejemplo, simulando un
   `TypeError` de stream cortado), `executeRuntimeApiOperation` resuelve (no rechaza) a
   `{ status: 'error', error: { code: 'network-error', message: <mensaje que referencia la operación> } }`.
2. El mismo escenario contra `executeInlineRuntimeApiOperation` y contra `executeBuiltRuntimeApiRequest` directamente
   produce el mismo resultado normalizado, no una promesa rechazada.
3. El test ya existente que cubre `fetch()` rechazado (`network-error` por fallo de red en la llamada inicial) sigue
   pasando sin cambios de aserción.
4. El resto de la suite de tests de `src/queries/` (`runtime-api-execution.test.ts`, `runtime-api-multipart.test.ts`,
   `runtime-api-file-encoding-preflight.test.tsx`, `runtime-api-token-refresh-failed.test.ts`,
   `runtime-api-retry.test.ts`, `runtime-image-binary-fetch.test.ts`, `runtime-file-base64-encoder.test.ts`) sigue en
   verde sin modificaciones de comportamiento.
5. El umbral global de cobertura del 80 % sobre `src/` se mantiene tras el cambio.

## Casos límite

- `response.ok` es `true`, `response.status` es `204`: comportamiento sin cambios (no se llega a `response.text()`,
  la función ya retorna `{ status: 'success', data: null }` antes).
- `response.text()` resuelve pero devuelve una cadena vacía: comportamiento sin cambios (`{ status: 'success', data: null }`).
- `response.text()` resuelve con contenido pero `JSON.parse` falla: comportamiento sin cambios (`invalid-json-response`,
  ya cubierto por `try/catch` existente en esa misma función).
- `response.text()` rechaza y la operación se ejecuta dentro de un `Promise.all` (preload por página, preloads
  globales, submit con `executeOperations`): con el fix, ese `Promise.all` ya no puede rechazar por esta causa,
  porque la promesa individual de esa operación siempre resuelve; el resto del lote sigue su curso normal sin
  necesidad de ningún cambio en el código de orquestación.

## Áreas de producto afectadas

- **Queries, ejecución y feedback**: cierre de un gap de robustez en la ejecución de operaciones `api`; no cambia
  ningún comportamiento documentado hoy en `queries/execution.md`, solo lo hace explícito y a prueba de un caso hasta
  ahora no cubierto.

## Documentación probablemente afectada

- `ai-workflow/docs/app-features/queries/execution.md`: la sección "Semántica de errores tipados" ya documenta
  `code: network-error` para "si la llamada falla por red"; conviene ampliar esa entrada para dejar explícito que
  cubre tanto el `fetch()` inicial como un fallo posterior en la lectura del cuerpo de la respuesta, para que la
  ficha siga siendo la fuente de verdad completa del contrato de errores.

## Riesgos o preguntas abiertas

Ninguna pregunta bloqueante. Decisión ya tomada y justificada arriba: reutilizar `network-error` en vez de introducir
un código nuevo. Si el usuario prefiriera un código distinto (por ejemplo, mirroring de `invalid-binary-response` con
algo como `invalid-response-body`), es un cambio de una sola constante de string sin impacto en el resto del alcance
ni en la dificultad de implementación; se deja anotado por si se quiere revisar antes de planificar tareas.
