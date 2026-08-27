> Cuándo leer: estructura de `table`, `headers`, `rows` (manual o dinámico), `columns` con filtros y ordenación local, paginación local, render accesible.
> Tamaño: largo.
> Relacionados: [[../queries/state-model.md]], [[../references/dynamic-strings.md]], [[repeater.md]], [[link.md]], [[../development/dev-mode-editor.md]].

# `table`

## Contrato (`props`)
- `props.headers`: array ordenado obligatorio de strings no vacíos.
- `props.columns`: array opcional y parcial de columnas configuradas por `id`; las columnas ausentes siguen siendo pasivas.
  - `id`: string no vacío que debe coincidir exactamente con una cabecera visible de `props.headers`.
  - `filterable`: opcional y válido solo como `true`.
  - `filterPlaceholder`: string no vacío opcional, válido solo cuando la misma columna declara `filterable: true`.
  - `sortable`: opcional y válido solo como `true`.
- `props.rows`: obligatorio y exclusivo entre:
  - modo manual: `Array<Array<string | number | boolean | NodeObject>>`
  - modo dinámico: `{ source: 'queries.{queryName}.data' | 'queries.{queryName}.data.*' | 'item.*', cells: (string | NodeObject)[] }`
- Celdas-nodo (objetos con `type` y `props`):
  - tipos permitidos: `image`, `list`, `button`, `container`, `heading`, `paragraph`, `link`. Un `link` como celda tiene el mismo contrato que fuera de tabla (`props.href`/`props.action`, `props.label`/`children` — ver [[link.md]]), sin restricciones adicionales por estar dentro de una celda; en modo dinámico accede a `row.*` de su fila igual que cualquier otra celda-nodo.
  - `container` en celda puede declarar `children` solo con nodos del mismo subconjunto permitido, incluido otro `container` anidado.
  - validación: cada `NodeObject` se valida igual que un nodo declarado en el layout principal; violan `type`, `props`, `visibility`, `queryStateFeedback` o `layout` rechazan el config antes del render.
  - tipos prohibidos en celda: `modal`, formularios (`form`, `input`, `textarea`, `select`, `choice-groups`), `repeater`, `table`, cualquier otro.
  - anidar `container` recursivo en celda es válido bajo las mismas restricciones de tipo.
- `props.pagination`: opcional; cuando existe activa paginación local en cliente con el mismo shape cerrado de `repeater`.
- `props.pagination.enabled`: obligatorio y exactamente `true`.
- `props.pagination.pageSize`: obligatorio, entero, finito y mayor o igual que `1`.
- `props.pagination.controls`: opcional; si se omite, el runtime usa el default efectivo de controles anterior/siguiente.
- `props.pagination.controls.variant`: opcional y limitado a `previousNext | numbered | scroll`.
- cada fila manual y cada colección `cells` dinámica debe mantener correspondencia exacta con `headers`.
- las celdas string reutilizan la misma semántica de literal, referencia dinámica completa o string visible interpolado con `{{...}}`.

## Reglas de render
- Una celda `string | number | boolean` renderiza como texto visible.
  - en modo dinámico, resuelve referencias completas e interpolación parcial `{{row...}}` contra el dato de la fila actual (`row.*`) y su posición 1-based en la vista visible (`row.$index`).
  - en modo manual, resuelve `row.$index` pero no el resto de `row.*` (no hay dato subyacente que navegar); `row.$index` se recalcula sobre la vista visible tras filtros, ordenación y paginación local.
- Una celda con `NodeObject` se renderiza usando el renderer central (`LayoutNodeRenderer`):
  - en modo dinámico, el nodo accede a `row.*` (dato de la fila correspondiente) y a `row.$index`.
  - en modo manual, el nodo no tiene dato de fila que navegar más allá de `row.$index`.
  - si la `table` vive dentro del subárbol iterado de un `repeater`, el nodo también accede a `item.*` del `repeater` ancestro más cercano, en cualquiera de los dos modos, sin que `row` lo sombree.
  - dentro de una celda de `table` (cualquier modo), `item.*` ya no resuelve nunca como contexto de fila propio de la tabla: su único significado posible ahí es el del `repeater` ancestro, o queda sin resolver si no hay ninguno.
  - si el nodo tiene `visibility` oculta o `queryStateFeedback` produce estado oculto, la celda renderiza vacía sin romper la fila.
  - si el nodo tiene `queryStateFeedback` en otros estados (loading, error, empty), renderiza el feedback visual del nodo dentro de la celda.
- `table.props.columns` puede declarar una lista parcial de columnas por `id` contra `headers`; cada entrada activa filtros locales con `filterable: true`, ordenación local con `sortable: true`, o ambas capacidades, y las cabeceras no declaradas siguen siendo columnas pasivas.

## Filtros locales
- Los filtros de `table` se renderizan encima de la tabla, fuera de `thead`, como controles nativos `type="search"` con nombre accesible `Filtrar {header}`; el placeholder usa la cabecera o `filterPlaceholder`, varios filtros aplican semántica `AND`, la comparación ignora mayúsculas, minúsculas y tildes, y `Reiniciar filtros` aparece solo cuando hay filtros activos.
- Si una columna filtrable contiene celdas-nodo, esas celdas se tratan como string vacío: con un filtro activo, las filas cuya celda en esa columna sea un `NodeObject` quedan excluidas; con filtro inactivo todas las filas pasan.

## Ordenación local
- La ordenación de `table` solo aparece en columnas `sortable: true`, se activa desde la cabecera con nombre accesible `Ordenar {header}`, expone `aria-sort` y cicla por ascendente, descendente y sin ordenación sobre el valor visible final de la celda.
- Si una columna ordenable contiene celdas-nodo, esas celdas se tratan como string vacío en comparaciones: un `NodeObject` ordena equivalente a una cadena vacía sin cambiar el orden relativo de las filas equivalentes.

## Paginación local
- `table.props.pagination` reutiliza el mismo vocabulario local que `repeater`: `enabled: true`, `pageSize` y variante opcional `previousNext`, `numbered` o `scroll`; la paginación se aplica después de resolver filas, filtrar y ordenar, y vuelve a una posición inicial válida cuando cambia el resultado procesado o la configuración efectiva.
- Cambiar filtros, ordenación, página numerada, anterior/siguiente o ventana `scroll` de una `table` solo modifica estado local de esa instancia; no ejecuta red, no limpia `queries.*`, no modifica `pageEntry`, formularios ni navegación, y no comparte estado con otras tablas aunque lean la misma query.

## Pipeline de procesamiento
- Los filtros, la ordenación y la paginación de `table` son siempre locales: operan sobre las filas ya resueltas y los valores visibles finales, en el orden filas -> filtros -> ordenación -> paginación, sin ejecutar operaciones remotas ni modificar `queries.*`.
- Celdas-nodo del mismo modo que celdas string se procesan dentro del pipeline local; una celda `NodeObject` renderizada en una página resulta en el nodo embebido montado en el DOM solo para esa página visible, desmontándose al cambiar de página.

## Degradación
- En `table`, `props.rows.source` degrada a cero filas cuando la colección no existe o no es array, cada celda string reutiliza la misma normalización visible de `heading`, `paragraph` e `image`, cada celda-nodo se renderiza igual que en layout principal (respeta `visibility`, `queryStateFeedback`), y los filtros, la ordenación y la paginación locales procesan solo esas filas ya resueltas sin ejecutar red ni modificar `queries.*`.

## Validación específica
- `table.props.columns`, cuando existe, se interpreta como lista parcial por `id` contra `props.headers`; cada `id` debe existir una sola vez en `headers`, no puede duplicarse dentro de `columns` y debe activar al menos una capacidad con `filterable: true` o `sortable: true`.
- `table.props.columns[].filterable` y `table.props.columns[].sortable` solo aceptan el literal `true`; la ausencia desactiva esa capacidad y valores como `false` se rechazan.
- `table.props.columns[].filterPlaceholder` solo es válido en columnas filtrables y debe ser un string no vacío.
- `table.props.columns[]` no acepta claves extra, incluidas claves con apariencia remota como `mode`, `remote`, `query`, `params`, `request`, `sort`, `order`, `filters`, `total`, `cursor`, `limit`, `offset`, `page` o `hasNext`.
- Celdas-nodo (`NodeObject` en celda):
  - `type` debe ser uno de: `image`, `list`, `button`, `container`, `heading`, `paragraph`, `link`. Tipos prohibidos como `modal`, `form`, `input`, `repeater`, `table` rechazan el config antes del render con diagnóstico exacto de ruta. Un `link` como celda se valida con exactamente el mismo validador y los mismos diagnósticos que un `link` fuera de tabla (ver [[link.md#validación-previa-al-render]]).
  - `type` vacío o ausente rechaza antes del render.
  - cada `NodeObject` en celda se valida reutilizando el mismo validador que un nodo declarado en layout principal; violar `props`, `visibility`, `queryStateFeedback` o `layout` rechaza antes del render.
  - `container` en celda puede anidar `children` solo con tipos del mismo subconjunto permitido, recursivamente; violaciones en cualquier profundidad rechazan antes del render.
- Si un nodo `table` omite `headers` o `rows`, mezcla modo manual y dinámico, usa celdas fuera de `string | number | boolean | NodeObject`, declara un `source` fuera de `queries.{queryName}.data`, `queries.{queryName}.data.*` o `item.*`, o rompe la correspondencia exacta entre `headers` y celdas, el config completo se rechaza antes del render sobre la ruta exacta.
- Si `table.props.columns` existe, ids vacíos, inexistentes, duplicados, ambiguos por cabeceras repetidas, entradas sin `filterable: true` ni `sortable: true`, flags distintos de `true`, `filterPlaceholder` vacío o `filterPlaceholder` en una columna no filtrable se rechazan antes del render sobre la ruta exacta.
- Si `table.props.columns[]` incluye claves extra, incluidas claves con apariencia remota, el config completo se rechaza antes del render sobre la ruta exacta de la clave extra.
- Si `table.props.pagination` existe, debe declarar `enabled: true` y un `pageSize` entero, finito y mayor o igual que `1`; valores como `enabled: false`, `pageSize: 0`, decimales, infinitos o `pageSize` ausente se rechazan antes del render sobre la ruta exacta.
- Si `table.props.pagination.controls.variant` existe, debe ser `previousNext`, `numbered` o `scroll`; cualquier otra variante se rechaza antes del render.
- Si `table.props.pagination` o `table.props.pagination.controls` incluyen claves no soportadas, el config completo se rechaza antes del render sobre la ruta exacta de la clave extra.

## Límites del nodo
- `table` ya acepta:
  - celdas ricas con nodos `image`, `list`, `button`, `container`, `heading`, `paragraph` (feature 0049) y `link` (feature 0138).
  - filtros por columna, ordenación local de una sola columna, paginación local.
  - contexto `row.*` (dato de la fila actual) en celdas-nodo y celdas string en modo dinámico, y `row.$index` (posición 1-based dentro de la vista visible) en celdas-nodo y celdas string en ambos modos; cuando la `table` vive dentro de un `repeater`, `item.*` del `repeater` ancestro sigue disponible en sus celdas sin ser sombreado por `row` (feature table-row-references).
  - en el editor de desarrollo, selección y edición visual de celdas-nodo en modo Editor (breadcrumb, panel de propiedades, `container` anidado seleccionable a cualquier profundidad) y un widget dedicado para alta/baja/tipo de filas, columnas y celdas, incluidos `filterable`/`sortable`/`filterPlaceholder` por columna, sin depender de Monaco (feature 0138; checks de ordenación/filtro añadidos por feature dev-editor-table-column-filter-sort-toggles — ver [[../development/dev-mode-editor.md#selección-de-celdas-nodo-y-widget-de-filascolumnas-de-table-modo-editor]]).
- Siguen fuera de contrato: procesamiento remoto, cursores, totales de servidor, filtros globales, filtros por tipo/rango/operador, multiselección de filtros, ordenación múltiple, comparadores configurables, selector de tamaño de página, salto directo, selección de filas, edición inline, agrupación, virtualización, y nodos de formulario o `modal` como contenido de celda.
