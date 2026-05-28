> Cuándo leer: estructura de `table`, `headers`, `rows` (manual o dinámico), `columns` con filtros y ordenación local, paginación local, render accesible.
> Tamaño: largo.
> Relacionados: [[../queries/state-model.md]], [[../references/dynamic-strings.md]], [[repeater.md]].

# `table`

## Contrato (`props`)
- `props.headers`: array ordenado obligatorio de strings no vacíos.
- `props.columns`: array opcional y parcial de columnas configuradas por `id`; las columnas ausentes siguen siendo pasivas.
  - `id`: string no vacío que debe coincidir exactamente con una cabecera visible de `props.headers`.
  - `filterable`: opcional y válido solo como `true`.
  - `filterPlaceholder`: string no vacío opcional, válido solo cuando la misma columna declara `filterable: true`.
  - `sortable`: opcional y válido solo como `true`.
- `props.rows`: obligatorio y exclusivo entre:
  - modo manual: `Array<Array<string | number | boolean>>`
  - modo dinámico: `{ source: 'queries.{queryName}.data' | 'queries.{queryName}.data.*' | 'item.*', cells: string[] }`
- `props.pagination`: opcional; cuando existe activa paginación local en cliente con el mismo shape cerrado de `repeater`.
- `props.pagination.enabled`: obligatorio y exactamente `true`.
- `props.pagination.pageSize`: obligatorio, entero, finito y mayor o igual que `1`.
- `props.pagination.controls`: opcional; si se omite, el runtime usa el default efectivo de controles anterior/siguiente.
- `props.pagination.controls.variant`: opcional y limitado a `previousNext | numbered | scroll`.
- cada fila manual y cada colección `cells` dinámica debe mantener correspondencia exacta con `headers`.
- las celdas string reutilizan la misma semántica de literal, referencia dinámica completa o string visible interpolado con `{{...}}`.

## Reglas de render
- `table.props` soporta `headers` como colección ordenada obligatoria y `rows` como unión exclusiva entre un modo manual `Array<Array<string | number | boolean>>` y un modo dinámico `{ source, cells }`; `source` reutiliza la misma familia de colecciones soportada por `list` y `select`, `cells` conserva el orden de columnas y cada celda string reutiliza la misma semántica visible compartida de literal, referencia completa o interpolación parcial.
- `table.props.columns` puede declarar una lista parcial de columnas por `id` contra `headers`; cada entrada activa filtros locales con `filterable: true`, ordenación local con `sortable: true`, o ambas capacidades, y las cabeceras no declaradas siguen siendo columnas pasivas.

## Filtros locales
- Los filtros de `table` se renderizan encima de la tabla, fuera de `thead`, como controles nativos `type="search"` con nombre accesible `Filtrar {header}`; el placeholder usa la cabecera o `filterPlaceholder`, varios filtros aplican semántica `AND`, la comparación ignora mayúsculas, minúsculas y tildes, y `Reiniciar filtros` aparece solo cuando hay filtros activos.

## Ordenación local
- La ordenación de `table` solo aparece en columnas `sortable: true`, se activa desde la cabecera con nombre accesible `Ordenar {header}`, expone `aria-sort` y cicla por ascendente, descendente y sin ordenación sobre el valor visible final de la celda.

## Paginación local
- `table.props.pagination` reutiliza el mismo vocabulario local que `repeater`: `enabled: true`, `pageSize` y variante opcional `previousNext`, `numbered` o `scroll`; la paginación se aplica después de resolver filas, filtrar y ordenar, y vuelve a una posición inicial válida cuando cambia el resultado procesado o la configuración efectiva.
- Cambiar filtros, ordenación, página numerada, anterior/siguiente o ventana `scroll` de una `table` solo modifica estado local de esa instancia; no ejecuta red, no limpia `queries.*`, no modifica `pageEntry`, formularios ni navegación, y no comparte estado con otras tablas aunque lean la misma query.

## Pipeline de procesamiento
- Los filtros, la ordenación y la paginación de `table` son siempre locales: operan sobre las filas ya resueltas y los valores visibles finales, en el orden filas -> filtros -> ordenación -> paginación, sin ejecutar operaciones remotas ni modificar `queries.*`.

## Degradación
- En `table`, `props.rows.source` degrada a cero filas cuando la colección no existe o no es array, cada celda string reutiliza la misma normalización visible de `heading`, `paragraph` e `image`, y los filtros, la ordenación y la paginación locales procesan solo esas filas ya resueltas sin ejecutar red ni modificar `queries.*`.

## Validación específica
- `table.props.columns`, cuando existe, se interpreta como lista parcial por `id` contra `props.headers`; cada `id` debe existir una sola vez en `headers`, no puede duplicarse dentro de `columns` y debe activar al menos una capacidad con `filterable: true` o `sortable: true`.
- `table.props.columns[].filterable` y `table.props.columns[].sortable` solo aceptan el literal `true`; la ausencia desactiva esa capacidad y valores como `false` se rechazan.
- `table.props.columns[].filterPlaceholder` solo es válido en columnas filtrables y debe ser un string no vacío.
- `table.props.columns[]` no acepta claves extra, incluidas claves con apariencia remota como `mode`, `remote`, `query`, `params`, `request`, `sort`, `order`, `filters`, `total`, `cursor`, `limit`, `offset`, `page` o `hasNext`.
- Si un nodo `table` omite `headers` o `rows`, mezcla modo manual y dinámico, usa celdas manuales fuera de `string | number | boolean`, declara un `source` fuera de `queries.{queryName}.data`, `queries.{queryName}.data.*` o `item.*`, o rompe la correspondencia exacta entre `headers` y celdas, el config completo se rechaza antes del render sobre la ruta exacta.
- Si `table.props.columns` existe, ids vacíos, inexistentes, duplicados, ambiguos por cabeceras repetidas, entradas sin `filterable: true` ni `sortable: true`, flags distintos de `true`, `filterPlaceholder` vacío o `filterPlaceholder` en una columna no filtrable se rechazan antes del render sobre la ruta exacta.
- Si `table.props.columns[]` incluye claves extra, incluidas claves con apariencia remota, el config completo se rechaza antes del render sobre la ruta exacta de la clave extra.
- Si `table.props.pagination` existe, debe declarar `enabled: true` y un `pageSize` entero, finito y mayor o igual que `1`; valores como `enabled: false`, `pageSize: 0`, decimales, infinitos o `pageSize` ausente se rechazan antes del render sobre la ruta exacta.
- Si `table.props.pagination.controls.variant` existe, debe ser `previousNext`, `numbered` o `scroll`; cualquier otra variante se rechaza antes del render.
- Si `table.props.pagination` o `table.props.pagination.controls` incluyen claves no soportadas, el config completo se rechaza antes del render sobre la ruta exacta de la clave extra.

## Límites del nodo
- `table` ya acepta filtros por columna, ordenación local de una sola columna y paginación local, pero siguen fuera de contrato el procesamiento remoto, cursores, totales de servidor, filtros globales, filtros por tipo/rango/operador, multiselección de filtros, ordenación múltiple, comparadores configurables, selector de tamaño de página, salto directo, selección de filas, acciones por fila, edición inline, agrupación y virtualización.
