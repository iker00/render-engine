> Cuándo leer: shape del estado de cada query (`status`/`data`/`error`), `requestSignature`, semántica de recarga, lectura desde el layout y degradaciones por consumidor.
> Tamaño: medio.
> Relacionados: [[execution.md]], [[preloads.md]], [[../references/reference-resolution.md]], [[../references/dynamic-strings.md]].

# Modelo de estado de queries

## Shape vigente
Cada query expone en v1:
- `status`: `idle | loading | success | error`
- `data`
- `error`

## Reglas estables
- las queries viven en `queries.{queryName}` dentro del store compartido por instancia
- una recarga puede pasar a `loading` conservando el último `data` válido
- el error se guarda con shape estable orientado a UI (`message` y `code` opcional)
- cada query conserva además la `requestSignature` efectiva de su último intento automático o manual
- un cambio de página no limpia por defecto el estado de queries
- excepción estable: cuando una nueva `pageEntry` arranca una tanda automática de `preloads`, solo las queries cuyos preloads realmente relanzan se resetean primero a `data: null`, `error: null`, `status: loading` y su nueva `requestSignature`

## Pre-carga de queries vía `data-values`

El runtime puede inicializar queries con datos fijos antes del primer render usando el mecanismo `data-values`:

- en producción: si el elemento raíz tiene el atributo `data-values`, el runtime parsea su contenido como un JSON de objeto plano, donde cada clave es un nombre de query
- en desarrollo: si no hay atributo `data-values`, el arranque carga automáticamente `src/dev/data-values.json` (si existe y contiene datos)
- cada entrada pre-cargada crea en `queries.{nombre}` el estado `{ status: 'success', data: <valor>, error: null, requestSignature: null }` antes del primer render
- el dato pre-cargado es inmediatamente consumible desde el layout sin esperar ninguna llamada API
- cualquier ejecución posterior de una operación con el mismo nombre (preload, `executeOperation`, acción de botón, submit) transita la query a `loading` y luego al resultado real, sobreescribiendo el dato pre-cargado siguiendo la semántica habitual
- las pre-cargas no afectan a queries que no están en el JSON de `data-values`; esas comienzan en `idle` como siempre

## Lectura desde el layout
Superficies del runtime que ya leen estado de queries directamente:
- `heading.props.text`
- `paragraph.props.text`
- `button.props.label`
- labels de `input`, `textarea`, `select`, `radioGroup` y `checkboxGroup`
- `image.props.src`
- `image.props.alt`
- strings visibles y `itemText` de `list`
- labels y values string de opciones de `select`, `radioGroup` y `checkboxGroup`
- `repeater.props.items.source`
- `list.props.items.source`
- `table.props.rows.source`
- celdas string de `table`
- `select.props.items.source`
- `visibility.reference`

## Referencias soportadas
- `queries.{queryName}`
- `queries.{queryName}.data`
- `queries.{queryName}.status`
- `queries.{queryName}.error`
- `queries.{queryName}.error.message`
- `queries.{queryName}.error.code`
- `queries.{queryName}.data.{segmentosAnidados}`

## Semántica estable de navegación anidada y degradación
- la navegación anidada solo se abre bajo `data` y bajo `error`
- una subruta puede alternar objetos y arrays dentro del valor actual de `data`
- los segmentos numéricos actúan como índice solo cuando el valor actual es un array
- si la query no existe, `data` todavía no está disponible, falta una clave, el índice queda fuera de rango o se intenta profundizar dentro de un primitivo, la referencia se trata como dato ausente
- `status` admite solo nivel top; `queries.{queryName}.status.*` es inválido
- `error` admite navegación limitada a `.message` y `.code`; rutas como `queries.searchUsers.error.token` siguen siendo inválidas
- cuando una query está en `error`, `error.message` contiene el texto del error y `error.code` su identificador tipado (`http-error`, `network-error`, `business-error-condition`, etc.). Si la query no está en error, ambos campos degradan a valor ausente
- `data` siempre es `null` cuando la query está en `error`, independientemente del ciclo anterior
- en superficies visibles interpolables, un string puede combinar literal y placeholders `{{queries.*}}`; solo los resultados escalares compatibles con texto (`string`, `number`, `boolean`) se muestran de forma visible, y objetos, arrays, `null`, `undefined` o referencias no resolubles degradan a string vacío solo para el placeholder afectado
- en `image`, `src` solo produce render cuando la resolución final es un string no vacío; referencias ausentes, no resolubles o con valor final no textual degradan a no render, y `alt` degrada a string vacío si no hay valor visible
- en `repeater`, una referencia válida cuyo valor runtime actual no es una colección utilizable degrada a cero iteraciones en vez de romper el render
- en `repeater` paginado, la colección completa ya resuelta desde `queries.*` se pagina en cliente después de aplicar la política de keys válidas y únicas; cambiar de página, seleccionar una página numerada o ampliar la ventana visible de `scroll` solo cambia estado local del consumidor y no ejecuta ni limpia queries
- en `list`, `select`, `radioGroup` y `checkboxGroup`, una referencia válida cuyo valor runtime actual no es una colección utilizable degrada a colección vacía en vez de romper render, validación o submit
- en proyecciones interpoladas de colecciones, `item.*` apunta al item local de cada entrada u opción (`repeater`, `list`, `select`, `radioGroup`, `checkboxGroup`); en `table`, el contexto de fila propio usa el namespace `row.*` en vez de `item.*` — dentro de celdas de `table`, `item.*` solo resuelve contra el `repeater` ancestro, si existe. `queries.*` puede combinarse con `item.*` o `row.*` dentro del mismo string visible
- en `table`, `props.rows.source` degrada a cero filas cuando la colección no existe o no es array, cada celda string reutiliza la misma normalización visible de `heading`, `paragraph` e `image`, y los filtros, la ordenación y la paginación locales procesan solo esas filas ya resueltas sin ejecutar red ni modificar `queries.*`
- cuando la colección contiene objetos y algún item no resuelve los datos mínimos requeridos por el consumidor, el runtime degrada solo ese item y conserva el resto de la colección
- en `visibility`, `queries.{queryName}` y `queries.{queryName}.error` pueden evaluarse con `isTruthy` e `isFalsy`; `queries.{queryName}.error.message` y `queries.{queryName}.error.code` admiten comparaciones literales; `queries.{queryName}.status` y las rutas anidadas bajo `data` también pueden usarse con comparaciones literales o numéricas según el operador
