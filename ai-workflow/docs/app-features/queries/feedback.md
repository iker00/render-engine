> Cuándo leer: estados visibles `idle | loading | error | empty | success`, heurística común de `empty`, integración con `queryStateFeedback`, casos funcionales soportados.
> Tamaño: medio.
> Relacionados: [[state-model.md]], [[../references/query-state-feedback.md]], [[../references/visibility.md]].

# Feedback visual por estado de query

## Contrato funcional
El layout ya puede declarar feedback visual local por nodo mediante `queryStateFeedback`, usando como fuente única de verdad el dominio compartido `queries.{queryName}`.

- estados visibles soportados: `idle`, `loading`, `error`, `empty` y `success`
- `idle` representa una query no lanzada todavía
- una query ausente del store también se trata como `idle`
- las respuestas declarables por estado son `show`, `hide` y `fallback`
- `fallback` reutiliza una colección local `LayoutNode[]`, con uno o varios nodos hermanos

## Semántica estable
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
- cuando el renderer sustituye un nodo por su fallback de estado `loading`, envuelve el contenido del fallback en un elemento contenedor con `role="status"`, de modo que los lectores de pantalla anuncien la carga en curso
- cuando el renderer sustituye un nodo por su fallback de estado `error`, envuelve el contenido del fallback en un elemento contenedor con `role="alert"`, de modo que sea anunciado automáticamente
- los estados `idle`, `empty` y `success` con modo `fallback` renderizan el contenido sin envoltorio ARIA adicional
- si el fallback de `loading` o `error` es una colección vacía (`fallback: []`), el wrapper con el rol correspondiente puede quedar vacío; esto es válido y no produce error

## Heurística común de `empty`
Se considera `empty`:
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

## Casos funcionales soportados
- mostrar un mensaje tipo "haz una búsqueda" antes de la primera ejecución de una query
- mostrar placeholder o contenido alternativo mientras carga una query
- mostrar un fallback local cuando una query falla
- mostrar un mensaje de "sin resultados" cuando la query resuelve vacía
- ocultar bloques hasta que exista un resultado útil
- hacer que varios nodos reaccionen de forma distinta al mismo `queryName`
- renderizar una `image` cuyo `src` o `alt` depende de `queries.*`, también dentro de `repeater`
- renderizar una `table` dinámica desde `queries.*`, conservando filas parciales y vaciando solo las celdas sin dato visible
- filtrar, ordenar y paginar localmente una `table` alimentada por `queries.*`, sin cambiar el estado de la query ni el feedback de `idle | loading | error | empty | success`
- reutilizar una misma query para alimentar a la vez varios `list` o `select` con proyecciones distintas por item
- combinar datos de `queries.*` con texto literal en headings, párrafos, botones, labels, imágenes, listas, opciones y celdas mediante placeholders visibles `{{...}}`
- mostrar u ocultar nodos o campos según `queries.{queryName}.status`, `queries.{queryName}.error` o una ruta anidada de `queries.{queryName}.data.*` sin lógica imperativa por pantalla
- paginar localmente un `repeater` alimentado por `queries.*` con controles `previousNext`, `numbered` o `scroll`, sin cambiar el estado de la query ni el feedback de `idle | loading | error | empty | success`
