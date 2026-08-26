> Cuándo leer: ejecución declarativa de operaciones `api`, semántica `executeOperation` desde botones o submit, request params por ejecución, errores tipados, merge entre operación base y override.
> Tamaño: medio.
> Relacionados: [[../config/api-catalog.md]], [[state-model.md]], [[preloads.md]], [[../forms/submit.md]], [[../nodes/button.md]].

# Ejecución de endpoints

## Fachada y disparadores
- Los endpoints se declaran en `api` y se invocan por nombre.
- `GET` usa query string cuando la operación la declara.
- `POST`, `PUT`, `PATCH` y `DELETE` pueden enviar body JSON.
- La fachada pública actual del runtime expone `executeQueryOperation(operationName, { requestParams? })` para ejecutar una operación declarada y escribir su resultado en `queries.{operationName}`.
- `button.props.action.type: executeOperation` reutiliza esa misma fachada compartida desde el árbol `layout`.
- `button.props.action.type: executeOperations` (plural) lanza en paralelo un array de operaciones, cada una con overrides opcionales de `query`, `body` y `headers` por operación. Cada operación actualiza `queries.{operationName}` de forma independiente.
- `form.submitAction.type: executeOperation` reutiliza la misma fachada compartida desde el submit nativo del formulario.
- `form.submitAction.type: executeOperations` (plural) lanza en paralelo un array de operaciones con la misma política de overrides que botones, y aplica `resetOnSuccess` de forma colectivo: el formulario solo se resetea si **todas** las operaciones terminan en éxito.
- Cuando la acción o el submit ocurren dentro de un `repeater`, `query`, `body` y `headers` también pueden resolverse desde `item.*` para la iteración activa.
- `autocomplete` (con `props.items` de shape dinámico `queries.{queryName}.data`/`.data.*`) dispara la misma fachada por su cuenta mientras el usuario escribe, con debounce fijo de `300ms` y gate por `props.minChars`: cuarta superficie de disparo, junto a `preloads`, botón y submit. El disparo vive en un módulo `runtime-*` dedicado (`runtime-search-trigger`), no en `runtime-actions/`, porque no es una acción declarada en el config sino consecuencia de la interacción del propio nodo. Detalle completo en [[../nodes/autocomplete.md#disparo-de-búsqueda-dinámica]].
- La UI no construye manualmente URLs, query strings ni payloads JSON.

## Semántica de errores tipados
- si la operación no existe, el runtime deja `queries.{operationName}` en `status: error` con `code: operation-not-found` y no emite red
- si faltan datos para resolver referencias en `query`, `body` o `headers`, el runtime deja `status: error` con `code: request-build-failed` y no emite red
- si un header referencia un token en estado de error (tras dos intentos de refresco fallidos), el runtime deja `status: error` con `code: token-refresh-failed` y no emite red. El mensaje de error no expone el valor del token.
- si la llamada falla por red, el runtime usa `code: network-error`. Cubre tanto el fallo del `fetch()` inicial como un fallo posterior al leer el cuerpo de la respuesta (por ejemplo, una conexión cortada a mitad de transferencia tras recibir cabeceras `ok`)
- si la respuesta HTTP no es `ok`, el runtime usa `code: http-error`
- si la respuesta satisfactoria trae JSON inválido, el runtime usa `code: invalid-json-response`
- si la respuesta es 200 con JSON válido pero `errorCondition` se cumple, el runtime usa `code: business-error-condition` (o el extraído de `errorCodePath`), y la query transita a `status: error` con `data: null`
- si la respuesta es satisfactoria pero no trae body consumible, incluido `204 No Content`, el runtime guarda `data: null`
- cuando una query transita a `status: error` por cualquier motivo, `data` se fija a `null`, incluso si existía un dato válido del ciclo anterior

## Composición y merge
- la composición final del request vive solo en `src/queries/`, no en botones, formularios ni otros nodos visuales
- `query` y `headers` combinan por clave la operación base y el override por ejecución, con precedencia del override
- `body` conserva el body base si no hay override; si ambas capas usan objetos JSON en raíz, el merge es superficial con precedencia del override; si alguna capa usa una raíz no objeto, el override sustituye el body base completo
- la combinación ocurre antes de resolver referencias y toda la ejecución usa un único snapshot del estado por disparo
- si el request efectivo lleva body serializado y no existe ya un `content-type` explícito en ninguna variante de casing, el builder añade `content-type: application/json`

## Reglas de payload
- Una operación `GET` nunca lleva body en la petición final, aunque `requestParams.body` reciba un valor (p. ej. desde el disparo de `autocomplete`, que aporta `requestParams.query` y `requestParams.body` a la vez sin conocer el método de la operación): el builder lo descarta antes de construir la petición, en vez de dejar que `fetch` lo rechace de forma silenciosa.
- `query` admite solo valores finales `string`, `number` y `boolean`
- `body` admite cualquier árbol JSON serializable
- `body: null` en la raíz equivale a una petición deliberada sin body serializado
- `headers` admite solo valores finales string
- referencias completas y strings escapados siguen la misma convención central del runtime
- la interpolación parcial `{{...}}` aplica en valores de `api.headers`, `button.props.action.headers`, `form.submitAction.headers` y `preloads[].headers`, con semántica de error `request-build-failed` (no string vacío como en superficies visibles)
- los placeholders de esos valores de header admiten cadenas de formatters (`{{ referencia | formatter[:arg] | ... }}`) con el catálogo y la gramática documentados en [[../references/dynamic-strings.md]]; una cadena no resoluble en un valor de header proyecta el mismo `request-build-failed` que un placeholder no resoluble sin formatter — los formatters no cambian la semántica de error de headers
- la interpolación parcial `{{...}}` NO aplica en `api.query`, `api.body`, `button.props.action.query`, `button.props.action.body` ni `form.submitAction.query`, `form.submitAction.body`; esos strings no interpolan placeholders
- referencias completas y `params.{paramName}` se admiten en todas las superficies de payload (`query`, `body`, `headers`)

## Omisión de campos ocultos en submit
- Cuando se ejecuta el submit (`form.submitAction`) de un formulario, cualquier clave del payload (`body`, `query`, `headers`) cuya referencia apunte a un campo **oculto por `visibility` o `queryStateFeedback`** se omite del wire format en lugar de causar error `request-build-failed`.
- La omisión aplica **solo a referencias a campos del propio formulario** que dispara el submit (namespace `forms.{formId}.{fieldId}` donde `formId` coincide).
- Referencias a otros formularios, `params.*`, `queries.*` o `item.*` que falten siguen siendo errores `request-build-failed` en cualquier contexto.
- La referencia en `endpoint` (path/template) a un campo oculto sigue siendo un error, aunque el campo sea del propio form. El path no admite omisión silenciosa.
- En `body` JSON anidado, cuando se omiten las claves: un objeto contenedor vacío se conserva como `{}`, no se poda.
- Este comportamiento ocurre **solo en submit**; operaciones disparadas desde `button.props.action` u otros contextos mantienen la semántica de error si la referencia es missing.

## Sustitución de valor vacío en submit para `select` (`emptySubmitValue`)
- Un `select` de selección simple puede declarar `props.emptySubmitValue` (literal escalar `string | number`, ver [[../nodes/select.md]]).
- Cuando el valor efectivo de ese campo es `''` en el momento del submit, cualquier referencia `forms.{formId}.{fieldId}` a ese campo en `body`/`query`/`headers` (de la operación `api` base o de `submitAction`) resuelve al valor configurado, normalizado a string, en vez de `''`.
- La sustitución ocurre solo al resolver el payload de submit del formulario que declara el campo; no cambia el valor efectivo almacenado en el store ni lo que ven `visibility`, `queryStateFeedback` o `defaultValue` de otros campos.
- Si el campo está oculto por `visibility`/`queryStateFeedback` en el momento del submit, la omisión de campos ocultos tiene prioridad: la clave se omite y `emptySubmitValue` no la reintroduce.
- Si el campo tiene un valor efectivo distinto de `''`, `emptySubmitValue` no tiene ningún efecto.

## Refetch y mutadoras (estado actual)
- Algunas acciones pueden necesitar relanzar queries después de éxito.
- Caso típico: borrar un item y recargar el listado.
- La intención funcional es soportar este patrón sin exigir lógica imperativa dispersa.

La base de estado y la red real ya están conectadas para ejecución por nombre, precargas automáticas al entrar en página, disparo declarativo desde `button.props.action` y submit declarativo desde `form.submitAction`. Siguen pendientes la orquestación automática de refetch y otros triggers más generales fuera de estas superficies actuales.
