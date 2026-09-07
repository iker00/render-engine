> Cuándo leer: si la tarea toca la sintaxis de pipeline declarativo en superficies de origen de colecciones (`repeater.props.items.source`, `list.props.items.source`, `table.props.rows.source`, `select.props.items.source`, `radioGroup.props.items.source`, `checkboxGroup.props.items.source`) para filtrar, ordenar o recortar colecciones sin lógica backend.
> Tamaño: medio.
> Relacionados: [[reference-resolution.md]], [[../nodes/repeater.md]], [[../nodes/table.md]], [[../nodes/select.md]], [[../nodes/choice-groups.md]], [[../nodes/heading-paragraph-list.md]].

# Pipeline declarativo de colecciones

Sistema de transformación local de colecciones declarado directamente en las superficies de origen de datos: filtrado por criterios, ordenación por campos y recorte por rango de índices, encadenables sin backend.

## Sintaxis general

Forma sin llaves `{{ }}`:
```
referencia | operacion:arg1,arg2 | operacion:arg1,arg2 | ...
```

- **Referencia base**: comienza con el origen válido ya soportado por cada superficie (`queries.{queryName}.data`, `queries.{queryName}.data.*`, `item.*` donde corresponda).
- **Pipe `|`**: separador de operaciones; indica cadena de transformaciones aplicadas de izquierda a derecha.
- **Operación**: nombre + argumentos separados por `,` (sin espacios); su estructura varía según el tipo (ver "Catálogo de operaciones").
- **Sin pipe**: un valor sin `|` mantiene exactamente el comportamiento actual, sin cambios observables.

## Catálogo de operaciones

### `orderby:path,dir`

Ordena la colección por el valor en `path` según la dirección indicada.

- `path`: ruta relativa al item actual usando la misma semántica de segmentos anidados que referencias dinámicas (un segmento numérico se interpreta como índice solo si el valor actual es array; sobre objetos se trata como clave literal).
- `dir`: obligatorio y debe ser exactamente `asc` (ascendente) o `desc` (descendente).
- **Valores inexistentes o incompatibles**: items cuyo `path` no existe o cuyo tipo es incompatible con la comparación se tratan como valor mínimo estable. En `asc` aparecen al inicio; en `desc` al final. El orden relativo entre items igualmente afectados se preserva (estabilidad del sort).
- **Encadenamiento**: cada `orderby` adicional reordena el resultado del anterior. `orderby:a,asc | orderby:b,desc` produce orden final donde `b` es criterio principal y `a` es desempate.

Ejemplos:
- `queries.products.data | orderby:price,asc` — ordena por precio ascendente.
- `queries.products.data | orderby:category,asc | orderby:price,desc` — ordena por categoría, desempate por precio descendente.

### `filter:path,operador,valor`

Conserva solo los items cuyo valor en `path` cumple la comparación con `valor`.

- `path`: ruta relativa al item, misma semántica que `orderby`.
- `operador`: uno de: `eq`, `ne`, `gt`, `lt`, `gte`, `lte`, `contains`, `in`.
  - `eq`: igualdad tras normalizar tipos (string, número, boolean).
  - `ne`: desigualdad.
  - `gt`, `lt`, `gte`, `lte`: comparación numérica. Items con valor no numérico no matchean.
  - `contains`: coincidencia parcial. Si el valor en `path` es string, substring case-insensitive y tilde-insensitive (mismo criterio que filtro nativo de `table`). Si es array, comprueba que contenga un elemento igual a `valor`.
  - `in`: el valor en `path` coincide exactamente con alguno de los valores candidatos en una lista.
- `valor`: argumento de la comparación; forma según el operador:
  - **Literal escalar** (string entre comillas dobles o número): `"active"`, `123`, `"pending"`.
  - **Referencia dinámica** (`forms.*`, `params.*`, `queries.*`): sin llaves, por ejemplo `forms.filters.status`, `params.userId`.
  - **Lista literal** (solo en `filter:...,in,...`): array estilo JSON `["active","pending"]` o `[1,2,3]`.
  - **Lista dinámica** (solo en `filter:...,in,...`): referencia a un array existente, por ejemplo `forms.filters.selectedIds`.
- **Múltiples filtros**: se combinan en `AND` (un item debe pasar todos los `filter` del pipeline para conservarse).
- **Valor dinámico ausente**: si el `valor` es una referencia dinámica y aún no está resuelto (string vacío, `undefined`, query sin dato), ese `filter` concreto no se aplica — pasa todo. El resto del pipeline sigue evaluándose con normalidad.
- **Items que no matchean**: items cuyo `path` no existe o cuyo tipo es incompatible con el operador se tratan como no-match (se excluyen).

Ejemplos:
- `queries.orders.data | filter:status,eq,"pending"` — solo órdenes con estado "pending".
- `queries.users.data | filter:role,in,["admin","editor"]` — usuarios con rol "admin" o "editor".
- `queries.products.data | filter:price,gte,100` — productos con precio >= 100.
- `queries.orders.data | filter:status,eq,forms.searchForm.status` — filtra según valor de formulario reactivo.
- `queries.items.data | filter:name,contains,params.searchTerm` — busca por substring en parámetro URL.

### `slice:start,end`

Recorta la colección a un rango de índices, misma semántica que `Array.prototype.slice` de JavaScript.

- `start`: índice inicial (0-based); números negativos cuentan desde el final.
- `end`: índice final exclusivo; números negativos cuentan desde el final; se omite para indicar "hasta el final".
- **Fuera de rango**: los índices se clampean sin error; `slice:0,100` sobre un array de 10 elementos devuelve los 10 sin advertencia.
- **Negativos**: `slice:-5` obtiene los últimos 5 elementos; `slice:-10,-5` obtiene 5 elementos comenzando desde el décimo desde el final.

Ejemplos:
- `queries.products.data | slice:0,10` — primeros 10 elementos.
- `queries.results.data | orderby:score,desc | slice:0,5` — top 5 por score.
- `queries.items.data | slice:-3` — últimos 3 elementos.

## Argumentos de operaciones

### Literal escalar
String entre comillas dobles o número, exactamente como en literales de formatters de texto (`dynamic-strings.md`).
- String: `"active"`, `"text with spaces"`, `""` (string vacío).
- Número: `123`, `-5`, `0`.

### Referencia dinámica completa
Sin llaves, familias admitidas: `forms.*`, `params.*`, `queries.*`. No se admite `item.*`/`row.*` como argumento (no tiene sentido referenciar el propio item dentro del cálculo de la colección que lo va a contener).

Ejemplos de referencia válida:
- `forms.searchForm.status` — valor de un campo de formulario.
- `params.userId` — parámetro URL.
- `queries.categories.data` — array dinámico de una query.

### Lista (solo `filter:...,in,...`)
Dos formas distintas:

1. **Literal estilo JSON**: `["active", "pending"]`, `[1, 2, 3]`. La lista puede mezclar tipos, pero cada elemento debe ser un literal escalar (string o número).

2. **Referencia dinámica a un array**: `forms.filters.selectedStatuses`, `queries.validIds.data`. Debe resolver a un array en runtime.

## Reactividad

Cuando cualquier referencia dinámica usado como argumento de una operación cambia en runtime, el pipeline completo se re-evalúa automáticamente y la colección resultante se actualiza sin acción explícita del usuario — mismo criterio que ya aplican `visibility` e interpolación de texto reactiva a cambios de `forms`/`params`/`queries`.

No se crean suscripciones adicionales: la reactividad es una consecuencia directa de reutilizar el patrón de resolución "recalcular en cada render a partir del estado ya suscrito" que ya usa el sistema de referencias dinámicas.

## Interacción con la ordenación y filtros nativos de `table`

Cuando el pipeline se usa en `table.props.rows.source`:

1. El pipeline declarativo se resuelve primero, como parte de la resolución de la fuente de filas.
2. Las filas resultantes del pipeline alimentan el pipeline local nativo de `table` (filtros de columna → ordenación de columna → paginación).
3. El `filter` declarativo se combina en `AND` con los filtros nativos de columna: ambos aplican simultáneamente.
4. El `orderby` declarativo fija el orden inicial. Si ninguna columna `sortable` tiene un orden activo, las filas se muestran en el orden fijado por el `orderby` declarativo. En cuanto el usuario activa el orden de una columna `sortable`, ese orden nativo reemplaza el orden visible. Al desactivar el orden de la columna (ciclar al tercer estado "sin ordenación"), las filas vuelven al orden con el que llegaron al pipeline nativo — es decir, el orden ya fijado por el `orderby` declarativo.

## Degradación

### Errores de forma (bootstrap)
Rechazan el config completo antes del render, igual que errores en `items.source`/`rows.source` hoy:
- Pipe malformado (caracteres inválidos, delimitadores sin cerrar).
- Nombre de operación desconocido.
- Número o shape de argumentos incorrecto para una operación.
- `dir` distinto de `asc`/`desc` en `orderby`.
- Operador desconocido o no válido para el operador en `filter`.
- Forma de lista `[...]` en un operador distinto de `in`.
- Lista literal `[...]` con sintaxis inválida.

### Errores dependientes de datos (runtime)
Degradan de forma local sin romper el árbol ni el resto del pipeline:
- `path` inexistente en un item concreto: se trata como valor mínimo en `orderby` (no reordena); se trata como no-match en `filter` (se excluye).
- Tipo incompatible en una comparación (p. ej. `gt` sobre un string): se trata como valor mínimo en `orderby`; se trata como no-match en `filter`.
- Valor dinámico de `filter` aún sin dato: ese `filter` no se aplica, el resto del pipeline sigue normal (ver "Valor dinámico ausente").
- La referencia base resuelve a un valor que no es array (colección aún no cargada, `null`, objeto, etc.): el pipeline opera sobre colección vacía — mismo criterio que hoy cuando `items.source`/`rows.source` no resuelve a un array.

## Límites y fuera de alcance

- El pipeline opera siempre en cliente sobre datos ya resueltos en `queries.*`/`item.*`; no dispara red, no pagina en servidor, no modifica la operación `api` que produjo los datos.
- Qué referencias base son válidas por superficie no cambia: `repeater.props.items.source` sigue limitado a `queries.{queryName}.data`/`.data.*`, `table.props.rows.source` admite también `item.*`, etc. El pipeline no amplía qué origen es válido.
- Operadores de `filter` adicionales no listados (rangos combinados, expresiones regulares, comparadores personalizados).
- Ordenación multi-criterio en una sola operación (`orderby:a,asc;b,desc`); se consigue encadenando varias operaciones `orderby`.
- Sustitución de `props.pagination` de `repeater`/`table`: `slice` y la paginación local son mecanismos independientes y combinables.
- Cambio de comportamiento cuando no se usa pipeline: sin `|`, el comportamiento de todas las superficies afectadas queda idéntico.
- Interpolación de texto (`{{...}}`) en superficies visibles sigue usando solo el catálogo de formatters de texto ya documentado en `dynamic-strings.md`; el pipeline de colección vive solo en las superficies de `source`/`items` de origen de datos.
- Widget visual dedicado en el editor de desarrollo para componer el pipeline; en v1 se declara solo como texto plano en el JSON de configuración.
- `item.*`/`row.*` como valor de un argumento de `filter`.
