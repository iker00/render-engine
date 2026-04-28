# Queries y feedback

## Objetivo
Coordinar llamadas API declaradas y exponer su estado para que la UI pueda reaccionar con carga, error, vacío o éxito.

## Modelo de estado
Cada query expone en v1:
- `status`: `idle | loading | success | error`
- `data`
- `error`

En el estado implementado hoy:
- las queries viven en `queries.{queryName}` dentro del store compartido por instancia
- una recarga puede pasar a `loading` conservando el último `data` válido
- el error se guarda con shape estable orientado a UI (`message` y `code` opcional)
- un cambio de página no limpia por defecto el estado de queries

## Lectura desde el layout
El runtime ya permite leer estado de queries desde superficies textuales concretas:
- `heading.props.text`
- `paragraph.props.text`

Referencias soportadas hoy:
- `queries.{queryName}`
- `queries.{queryName}.data`
- `queries.{queryName}.status`
- `queries.{queryName}.error`
- `queries.{queryName}.data.{segmentosAnidados}`

Semántica estable:
- la navegación anidada solo se abre bajo `data`
- una subruta puede alternar objetos y arrays dentro del valor actual de `data`
- los segmentos numéricos actúan como índice solo cuando el valor actual es un array
- si la query no existe, `data` todavía no está disponible, falta una clave, el índice queda fuera de rango o se intenta profundizar dentro de un primitivo, la referencia se trata como dato ausente
- `status` y `error` no admiten navegación adicional; rutas como `queries.searchUsers.error.message` siguen siendo inválidas
- en `heading` y `paragraph`, solo los resultados escalares compatibles con texto (`string`, `number`, `boolean`) se muestran de forma visible; objetos, arrays, `null`, `undefined` y referencias no resolubles degradan a string vacío

## Ejecución de endpoints
- Los endpoints se declaran en `api` y se invocan por nombre.
- `GET` usa query string cuando la operación la declara.
- `POST`, `PUT`, `PATCH` y `DELETE` pueden enviar body JSON.
- La fachada pública actual del runtime expone `executeQueryOperation(operationName)` para ejecutar una operación declarada y escribir su resultado en `queries.{operationName}`.
- La UI no construye manualmente URLs, query strings ni payloads JSON.

Semántica estable de ejecución:
- si la operación no existe, el runtime deja `queries.{operationName}` en `status: error` con `code: operation-not-found` y no emite red
- si faltan datos para resolver referencias en `query` o `body`, el runtime deja `status: error` con `code: request-build-failed` y no emite red
- si la llamada falla por red, el runtime usa `code: network-error`
- si la respuesta HTTP no es `ok`, el runtime usa `code: http-error`
- si la respuesta satisfactoria trae JSON inválido, el runtime usa `code: invalid-json-response`
- si la respuesta es satisfactoria pero no trae body consumible, incluido `204 No Content`, el runtime guarda `data: null`

Reglas de payload vigentes:
- `query` admite solo valores finales `string`, `number` y `boolean`
- `body` admite cualquier árbol JSON serializable
- `body: null` en la raíz equivale a una petición deliberada sin body serializado
- referencias completas y strings escapados siguen la misma convención central del runtime

## Precargas
- Las precargas se declaran a nivel de página.
- Se ejecutan al entrar en la página.
- La página puede depender de esos datos para mostrar su layout o bloques concretos.
- Cada entrada de página crea una tanda agregada con `entryId`, `pageId`, `preloadNames` y `status`.
- El agregado distingue `idle | loading | success | error`.
- `idle` representa explícitamente la entrada actual sin precargas que ejecutar.
- Las operaciones de una misma tanda se lanzan en paralelo.
- Si al menos una precarga falla, el agregado final queda en `error`, pero las queries exitosas conservan sus datos.
- El agregado es latest-only: una tanda antigua puede seguir cerrando sus queries individuales, pero no puede reescribir el resultado agregado de una entrada más reciente.
- Todas las precargas de una misma tanda resuelven sus referencias contra un snapshot común del estado al inicio de la entrada.

## Refetch y acciones mutadoras
- Algunas acciones pueden necesitar relanzar queries después de éxito.
- Caso típico: borrar un item y recargar el listado.
- La intención funcional es soportar este patrón sin exigir lógica imperativa dispersa.

La base de estado y la red real ya están conectadas para ejecución por nombre y para precargas automáticas al entrar en página, pero siguen pendientes los disparadores declarativos finales desde layout y la orquestación automática de refetch.

## Feedback visual
- El layout puede definir explícitamente qué mostrar en `loading`, `error` y estado vacío.
- Si no lo define, el runtime debe ofrecer un fallback genérico razonable.
- La UI no debe romperse por un error local recuperable.

Hoy está consolidado el almacenamiento del estado de feedback dentro del runtime y su lectura textual puntual mediante referencias; la representación visual declarativa completa de esos estados sigue pendiente.

## Casos funcionales previstos
- mostrar spinner o placeholder mientras carga una query
- mostrar mensaje de error de servidor
- mostrar mensaje de “sin resultados”
- ocultar bloques hasta que exista un resultado o un estado concreto
