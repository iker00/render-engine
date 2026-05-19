# Queries y feedback

## Objetivo
Coordinar llamadas API declaradas y exponer su estado para que la UI pueda reaccionar de forma textual, visual y estructural antes de la primera ejecución, durante la carga real, ante error, vacío o éxito.

## Modelo de estado
Cada query expone en v1:
- `status`: `idle | loading | success | error`
- `data`
- `error`

En el estado implementado hoy:
- las queries viven en `queries.{queryName}` dentro del store compartido por instancia
- una recarga puede pasar a `loading` conservando el último `data` válido
- el error se guarda con shape estable orientado a UI (`message` y `code` opcional)
- cada query conserva además la `requestSignature` efectiva de su último intento automático o manual
- un cambio de página no limpia por defecto el estado de queries
- excepción estable: cuando una nueva `pageEntry` arranca una tanda automática de `preloads`, solo las queries cuyos preloads realmente relanzan se resetean primero a `data: null`, `error: null`, `status: loading` y su nueva `requestSignature`

## Lectura desde el layout
El runtime ya permite leer estado de queries desde superficies textuales concretas:
- `heading.props.text`
- `paragraph.props.text`
- `repeater.props.items.source`
- `list.props.items.source`
- `select.props.items.source`
- `visibility.reference`

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
- en `repeater`, una referencia válida cuyo valor runtime actual no es una colección utilizable degrada a cero iteraciones en vez de romper el render
- en `list` y `select`, una referencia válida cuyo valor runtime actual no es una colección utilizable degrada a colección vacía en vez de romper render, validación o submit
- cuando la colección contiene objetos y algún item no resuelve los datos mínimos requeridos por el consumidor, el runtime degrada solo ese item y conserva el resto de la colección
- en `visibility`, `queries.{queryName}` y `queries.{queryName}.error` pueden evaluarse con `isTruthy` e `isFalsy`; `queries.{queryName}.status` y las rutas anidadas bajo `data` también pueden usarse con comparaciones literales o numéricas según el operador

## Ejecución de endpoints
- Los endpoints se declaran en `api` y se invocan por nombre.
- `GET` usa query string cuando la operación la declara.
- `POST`, `PUT`, `PATCH` y `DELETE` pueden enviar body JSON.
- La fachada pública actual del runtime expone `executeQueryOperation(operationName, { requestParams? })` para ejecutar una operación declarada y escribir su resultado en `queries.{operationName}`.
- `button.props.action.type: executeOperation` reutiliza esa misma fachada compartida desde el árbol `layout`.
- `form.submitAction.type: executeOperation` reutiliza la misma fachada compartida desde el submit nativo del formulario.
- Cuando la acción o el submit ocurren dentro de un `repeater`, `query`, `body` y `headers` también pueden resolverse desde `item.*` para la iteración activa.
- La UI no construye manualmente URLs, query strings ni payloads JSON.

Semántica estable de ejecución:
- si la operación no existe, el runtime deja `queries.{operationName}` en `status: error` con `code: operation-not-found` y no emite red
- si faltan datos para resolver referencias en `query`, `body` o `headers`, el runtime deja `status: error` con `code: request-build-failed` y no emite red
- si la llamada falla por red, el runtime usa `code: network-error`
- si la respuesta HTTP no es `ok`, el runtime usa `code: http-error`
- si la respuesta satisfactoria trae JSON inválido, el runtime usa `code: invalid-json-response`
- si la respuesta es satisfactoria pero no trae body consumible, incluido `204 No Content`, el runtime guarda `data: null`
- la composición final del request vive solo en `src/queries/`, no en botones, formularios ni otros nodos visuales
- `query` y `headers` combinan por clave la operación base y el override por ejecución, con precedencia del override
- `body` conserva el body base si no hay override; si ambas capas usan objetos JSON en raíz, el merge es superficial con precedencia del override; si alguna capa usa una raíz no objeto, el override sustituye el body base completo
- la combinación ocurre antes de resolver referencias y toda la ejecución usa un único snapshot del estado por disparo
- si el request efectivo lleva body serializado y no existe ya un `content-type` explícito en ninguna variante de casing, el builder añade `content-type: application/json`

Reglas de payload vigentes:
- `query` admite solo valores finales `string`, `number` y `boolean`
- `body` admite cualquier árbol JSON serializable
- `body: null` en la raíz equivale a una petición deliberada sin body serializado
- `headers` admite solo valores finales string
- referencias completas y strings escapados siguen la misma convención central del runtime
- esa convención ya permite `params.{paramName}` en `api.query`, `api.body`, `api.headers`, `button.props.action.*` y `form.submitAction.*`

## Precargas
- Las precargas se declaran a nivel de página.
- Se ejecutan al entrar en la página.
- La página puede depender de esos datos para mostrar su layout o bloques concretos.
- Cada preload declara hoy su `operationName` y puede añadir `query`, `body` y `headers` con la misma semántica de `executeOperation`.
- Cada entrada de página crea una tanda agregada con `entryId`, `pageId`, `params`, `preloadNames` y `status`.
- El agregado distingue `idle | loading | success | error`.
- `idle` representa explícitamente la entrada actual sin precargas que ejecutar.
- Antes de ejecutar una tanda, el runtime resuelve cada preload contra un snapshot común del estado ya preparado para esa entrada y deriva una firma estable de request a partir del método, endpoint, `query`, `body` y `headers` efectivos.
- Si una firma efectiva coincide con la firma ya visible en `queries.{operationName}`, ese preload no se relanza automáticamente ni abre una nueva carga artificial por sí solo.
- El arranque de una tanda con `preloads` prepara primero la nueva `pageEntry` en un único paso observable: limpia solo las queries incluidas en el subconjunto realmente relanzado y las deja directamente en `loading`.
- Esa preparación ocurre antes del primer render útil de la nueva entrada, así que cualquier consumidor de `queries.*` ve estado limpio o `loading`, nunca el `data` exitoso de otra entrada previa para esas mismas precargas.
- La preparación previa no introduce un paso visible por `idle` para esa nueva tanda.
- Las operaciones de una misma tanda se lanzan en paralelo.
- Si al menos una precarga falla, el agregado final queda en `error`, pero las queries exitosas conservan sus datos.
- El agregado es latest-only: una tanda antigua puede seguir cerrando sus queries individuales, pero no puede reescribir el resultado agregado de una entrada más reciente.
- Todas las precargas de una misma tanda resuelven sus referencias contra un snapshot común del estado ya preparado para esa entrada.
- Ese snapshot ya incluye los params efectivos de la entrada activa, leídos desde la URL canónica o desde navegación interna equivalente, por lo que una precarga puede reutilizar `params.*` sin lógica imperativa adicional.
- La comparación automática también puede reaccionar a cambios de `forms.*` o `queries.*` si esos valores alteran la request efectiva de un preload ya visible en la misma entrada.
- Esta política de limpieza fresca queda limitada al mecanismo automático de `pages[].preloads`; una ejecución manual de la misma operación sigue pudiendo recargar en `loading` conservando su último `data` válido.

## Refetch y acciones mutadoras
- Algunas acciones pueden necesitar relanzar queries después de éxito.
- Caso típico: borrar un item y recargar el listado.
- La intención funcional es soportar este patrón sin exigir lógica imperativa dispersa.

La base de estado y la red real ya están conectadas para ejecución por nombre, precargas automáticas al entrar en página, disparo declarativo desde `button.props.action` y submit declarativo desde `form.submitAction`. Siguen pendientes la orquestación automática de refetch y otros triggers más generales fuera de estas superficies actuales.

## Feedback visual
El layout ya puede declarar feedback visual local por nodo mediante `queryStateFeedback`, usando como fuente única de verdad el dominio compartido `queries.{queryName}`.

Contrato funcional estable:
- estados visibles soportados: `idle`, `loading`, `error`, `empty` y `success`
- `idle` representa una query no lanzada todavía
- una query ausente del store también se trata como `idle`
- las respuestas declarables por estado son `show`, `hide` y `fallback`
- `fallback` reutiliza una colección local `LayoutNode[]`, con uno o varios nodos hermanos

Semántica estable:
- si un nodo no declara `queryStateFeedback`, conserva su render normal sin cambios observables
- si declara el bloque pero omite un estado concreto, los defaults son `success -> show` y `idle/loading/error/empty -> hide`
- el renderer central decide si muestra el nodo original, lo oculta o lo sustituye por el fallback local
- la misma semántica visible se reutiliza también dentro del submit de formularios para decidir qué campos `required` cuentan como visibles
- si un nodo también declara `visibility`, `queryStateFeedback` mantiene prioridad y puede dejar resuelto `hide` o `fallback` antes de que `visibility` se evalúe
- varios nodos pueden reaccionar de forma distinta a la misma query sin colisionar entre sí
- `loading` representa solo una ejecución real en curso, incluso cuando existe `data` previo conservado
- una recarga que vuelve a `loading` con `data` previo conservado reactiva igualmente la rama `loading`
- en `preloads`, una reentrada o reevaluación automática limpia antes el `data` previo solo para la query afectada cuyo preload relanza, por lo que la rama `loading` se evalúa contra un estado vacío de esa request nueva
- tras una respuesta `success` vacía, el runtime entra en `empty` y no vuelve a tratar ese caso como `idle`

Heurística común de `empty`:
- `null` y `undefined`
- string vacío
- array vacío
- objeto sin claves

No se consideran `empty`:
- `0`
- `false`
- strings no vacíos
- arrays con elementos
- objetos con claves

## Casos funcionales soportados hoy
- mostrar un mensaje tipo “haz una búsqueda” antes de la primera ejecución de una query
- mostrar placeholder o contenido alternativo mientras carga una query
- mostrar un fallback local cuando una query falla
- mostrar un mensaje de “sin resultados” cuando la query resuelve vacía
- ocultar bloques hasta que exista un resultado útil
- hacer que varios nodos reaccionen de forma distinta al mismo `queryName`
- reutilizar una misma query para alimentar a la vez varios `list` o `select` con proyecciones distintas por item
- mostrar u ocultar nodos o campos según `queries.{queryName}.status`, `queries.{queryName}.error` o una ruta anidada de `queries.{queryName}.data.*` sin lógica imperativa por pantalla
