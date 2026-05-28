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
- `form.submitAction.type: executeOperation` reutiliza la misma fachada compartida desde el submit nativo del formulario.
- Cuando la acción o el submit ocurren dentro de un `repeater`, `query`, `body` y `headers` también pueden resolverse desde `item.*` para la iteración activa.
- La UI no construye manualmente URLs, query strings ni payloads JSON.

## Semántica de errores tipados
- si la operación no existe, el runtime deja `queries.{operationName}` en `status: error` con `code: operation-not-found` y no emite red
- si faltan datos para resolver referencias en `query`, `body` o `headers`, el runtime deja `status: error` con `code: request-build-failed` y no emite red
- si la llamada falla por red, el runtime usa `code: network-error`
- si la respuesta HTTP no es `ok`, el runtime usa `code: http-error`
- si la respuesta satisfactoria trae JSON inválido, el runtime usa `code: invalid-json-response`
- si la respuesta es satisfactoria pero no trae body consumible, incluido `204 No Content`, el runtime guarda `data: null`

## Composición y merge
- la composición final del request vive solo en `src/queries/`, no en botones, formularios ni otros nodos visuales
- `query` y `headers` combinan por clave la operación base y el override por ejecución, con precedencia del override
- `body` conserva el body base si no hay override; si ambas capas usan objetos JSON en raíz, el merge es superficial con precedencia del override; si alguna capa usa una raíz no objeto, el override sustituye el body base completo
- la combinación ocurre antes de resolver referencias y toda la ejecución usa un único snapshot del estado por disparo
- si el request efectivo lleva body serializado y no existe ya un `content-type` explícito en ninguna variante de casing, el builder añade `content-type: application/json`

## Reglas de payload
- `query` admite solo valores finales `string`, `number` y `boolean`
- `body` admite cualquier árbol JSON serializable
- `body: null` en la raíz equivale a una petición deliberada sin body serializado
- `headers` admite solo valores finales string
- referencias completas y strings escapados siguen la misma convención central del runtime
- la interpolación parcial `{{...}}` no aplica en `api.query`, `api.body`, `api.headers`, `preloads`, `button.props.action.*` ni `form.submitAction.*`; esos strings no vacían placeholders silenciosamente ni cambian la semántica de `request-build-failed`
- esa convención ya permite `params.{paramName}` en `api.query`, `api.body`, `api.headers`, `button.props.action.*` y `form.submitAction.*`

## Refetch y mutadoras (estado actual)
- Algunas acciones pueden necesitar relanzar queries después de éxito.
- Caso típico: borrar un item y recargar el listado.
- La intención funcional es soportar este patrón sin exigir lógica imperativa dispersa.

La base de estado y la red real ya están conectadas para ejecución por nombre, precargas automáticas al entrar en página, disparo declarativo desde `button.props.action` y submit declarativo desde `form.submitAction`. Siguen pendientes la orquestación automática de refetch y otros triggers más generales fuera de estas superficies actuales.
