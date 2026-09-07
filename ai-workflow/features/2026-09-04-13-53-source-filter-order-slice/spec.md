# Spec — Pipeline declarativo de filtro, orden y slice sobre colecciones de origen

## Objetivo
Permitir declarar, dentro del propio valor de las superficies que hoy resuelven una colección de origen, una transformación local de esa colección (filtrar, ordenar, recortar) sin depender de que el backend la precalcule y sin introducir un nuevo tipo de nodo o superficie de configuración.

Hoy `repeater.props.items.source`, `list.props.items.source`, `table.props.rows.source`, `select.props.items.source`, `radioGroup.props.items.source` y `checkboxGroup.props.items.source` solo aceptan una referencia completa literal (`queries.{queryName}.data`, `queries.{queryName}.data.*` o, según nodo, `item.*`). Esta feature extiende esa gramática con un pipeline opcional de operaciones encadenables.

## Alcance

### Superficies afectadas
La nueva gramática de pipeline aplica como sufijo opcional de la referencia completa ya soportada en:
- `repeater.props.items.source`
- `list.props.items.source`
- `table.props.rows.source`
- `select.props.items.source` (dentro del shape dinámico `{ source, itemType, label?, value? }`)
- `radioGroup.props.items.source`
- `checkboxGroup.props.items.source`

La referencia base al inicio del pipeline sigue las mismas restricciones ya vigentes por superficie (por ejemplo, `repeater.props.items.source` sigue limitado a `queries.{queryName}.data`/`.data.*`, sin admitir `item.*`). Esta feature no amplía qué referencia raíz es válida por nodo: solo añade una transformación posterior sobre una referencia ya válida hoy.

### Sintaxis
Forma general, sin llaves `{{ }}`:
```
referencia | operacion:args | operacion:args | ...
```
- Sin llaves porque estas superficies nunca han admitido interpolación de texto: el resultado del pipeline sigue siendo el valor real (array), no un string.
- Encadenable: cualquier número de operaciones, aplicadas de izquierda a derecha, mismo criterio que ya usan los formatters de texto documentados en `references/dynamic-strings.md`.
- Un valor sin `|` mantiene exactamente el comportamiento actual: se resuelve como referencia completa, sin pipeline.

### Catálogo de operaciones (v1)
- **`orderby:path,dir`** — ordena la colección por el valor en `path`.
  - `path` usa la misma semántica de segmentos anidados que el resto de referencias del runtime (segmento numérico se interpreta como índice solo si el valor actual es array; si no, como clave literal).
  - `dir` es obligatorio y debe ser exactamente `asc` o `desc`.
- **`filter:path,operador,valor`** — conserva solo los elementos cuyo valor en `path` cumple la comparación.
  - Operadores soportados: `eq`, `ne`, `gt`, `lt`, `gte`, `lte`, `contains`, `in`.
  - `eq`/`ne`: igualdad/desigualdad tras normalizar tipos comparables (`string`/`number`/`boolean`).
  - `gt`/`lt`/`gte`/`lte`: comparación numérica.
  - `contains`: coincidencia parcial. Si el valor en `path` es `string`, substring ignorando mayúsculas/minúsculas/tildes (mismo criterio que el filtro nativo de `table`). Si es `array`, comprueba que contenga un elemento igual a `valor`.
  - `in`: el valor en `path` coincide exactamente con alguno de un conjunto de valores candidatos.
- **`slice:start,end`** — misma semántica que `Array.prototype.slice` de JS: índices 0-based, `end` exclusivo, admite índices negativos, clampa sin error para índices fuera de rango.

### Forma de los argumentos
- **Literal escalar**: string entre comillas dobles o número, mismo formato que los argumentos de los formatters de texto ya existentes.
- **Referencia dinámica completa**: familias `forms.*`, `params.*`, `queries.*`, sin llaves, como cualquier referencia completa hoy. No se admite `item.*`/`row.*` como valor de argumento (no tiene sentido referenciar el propio item/fila dentro del cálculo de la colección que lo va a contener).
- **Lista** (solo como tercer argumento de `filter` cuando el operador es `in`):
  - literal: array estilo JSON entre corchetes, por ejemplo `["active","pending"]` o `[1,2,3]`.
  - o una referencia dinámica completa a un array ya existente en runtime (`forms.*`/`params.*`/`queries.*`), por ejemplo `forms.filters.selectedStatuses`, en vez de una lista literal.

### Reactividad
Cuando cualquier referencia dinámica usada como argumento de `filter` cambia en runtime, el pipeline completo se re-evalúa automáticamente y la colección resultante se actualiza sin acción explícita del consumidor — mismo criterio que ya aplican `visibility` y la interpolación de texto reactiva a cambios de `forms`/`params`/`queries`.

### Valor dinámico ausente
Si el valor dinámico usado como tercer argumento de un `filter` aún no está resuelto (string vacío, `undefined`, o el `forms.*`/`params.*`/`queries.*` referenciado todavía no tiene dato), ese `filter` concreto no se aplica — pasa todo — mismo criterio que ya tiene el input de filtro nativo de `table` cuando está vacío. El resto del pipeline (otros `filter`, `orderby`, `slice`) sigue evaluándose con normalidad.

### Interacción con el filtro/orden nativo ya existente de `table`
- El pipeline declarativo se resuelve primero, como parte de la resolución de `table.props.rows.source`, antes de que el pipeline local nativo de `table` (filtros por columna → ordenación de columna → paginación) empiece a operar.
- El `filter` declarativo se combina en `AND` con los filtros nativos de columna: ambos actúan simultáneamente sobre las filas.
- El `orderby` declarativo fija el orden con el que las filas entran al pipeline nativo. El filtro nativo no reordena, solo excluye filas, así que mientras ninguna columna `sortable` tenga un orden activo, las filas visibles respetan el orden declarativo. En cuanto el usuario activa el orden de una columna `sortable`, ese orden nativo sustituye el criterio de comparación visible; al ciclar de vuelta al tercer estado ("sin ordenación"), las filas vuelven a mostrarse en el orden con el que llegaron al pipeline nativo — es decir, el orden ya fijado por el `orderby` declarativo, sin necesidad de ningún mecanismo adicional de "recordar" el orden previo.

### Semántica de degradación
- **Errores de forma (bootstrap)**: rechazan el config completo antes del render, igual que ya ocurre hoy con la validación de `items.source`/`rows.source` — pipe malformado, nombre de operación desconocido, número o shape de argumentos incorrecto para una operación, `dir` distinto de `asc`/`desc`, tercer argumento con forma de lista (`[...]`) en un operador distinto de `in`, o forma de lista inválida en `in`.
- **Errores dependientes de datos (runtime)**: degradan de forma local, sin romper el árbol ni el resto del pipeline — `path` inexistente en un item concreto, tipo incompatible en una comparación (por ejemplo `gt` sobre un valor no numérico), o valor dinámico de `filter` aún sin dato (ver "Valor dinámico ausente"). Un item cuyo `path` no existe o cuyo tipo es incompatible con el operador de `filter` se trata como no-match (se excluye); en `orderby`, un valor de `path` inexistente o de tipo incompatible se trata como valor mínimo/vacío estable, sin alterar el orden relativo entre items igualmente afectados.
- Si la referencia base del pipeline resuelve a un valor que no es array (colección aún no cargada, `null`, objeto, etc.), el pipeline completo opera sobre una colección vacía — mismo criterio que ya aplica hoy cuando `items.source`/`rows.source` no resuelve a un array.

## Fuera de alcance
- Cualquier procesamiento remoto: el pipeline opera siempre en cliente sobre datos ya resueltos en `queries.*`/`item.*`; no dispara red, no pagina en servidor, no modifica la operación `api` que produjo los datos.
- Ampliar qué referencias base son válidas por superficie (por ejemplo, seguir sin admitir `item.*` en `repeater.props.items.source`).
- Operadores de `filter` adicionales no listados en el catálogo v1 (rangos combinados, expresiones regulares, comparadores personalizados).
- Una forma compacta de ordenación multi-criterio en una sola operación (`orderby:campoA,asc;campoB,desc`); el efecto equivalente se consigue encadenando varias operaciones `orderby`.
- Sustituir `props.pagination` de `repeater`/`table`: `slice` y la paginación local son mecanismos independientes y combinables (el pipeline recorta antes; la paginación local pagina lo que quede).
- Cambiar el comportamiento de ninguna superficie cuando no se usa esta sintaxis: sin `|` en el valor, el comportamiento actual de todas las superficies afectadas queda idéntico.
- Extender esta sintaxis a superficies de interpolación de texto (`{{...}}` en `heading.props.text`, celdas de `table`, etc.); esas superficies siguen usando solo el catálogo de formatters de texto ya documentado.
- Un widget dedicado en el editor visual de desarrollo para componer el pipeline visualmente; en v1 se declara solo como texto plano en el JSON de configuración.
- `item.*`/`row.*` como valor de un argumento de `filter`.

## Requisitos funcionales
1. Las seis superficies listadas en el alcance deben aceptar, además de la referencia completa literal ya soportada, esa misma referencia seguida de cero o más operaciones de pipeline separadas por `|`.
2. El pipeline debe soportar `orderby`, `filter` (con los ocho operadores del catálogo) y `slice`, encadenables en cualquier orden y cualquier cantidad de veces.
3. El resultado del pipeline debe ser el valor real (array) que la superficie consumidora espera, no una representación en texto.
4. Los argumentos de las operaciones deben aceptar literal escalar (string entrecomillado o número), referencia dinámica completa (`forms.*`/`params.*`/`queries.*`) y, exclusivamente para el tercer argumento de `filter` con operador `in`, una lista literal estilo JSON o una referencia dinámica a un array.
5. El pipeline debe reevaluarse automáticamente cuando cambia cualquier referencia dinámica usada como argumento, sin acción explícita del usuario.
6. Un `filter` cuyo valor dinámico aún no está resuelto no debe excluir elementos: debe comportarse como si ese `filter` no estuviera declarado.
7. En `table.props.rows.source`, el resultado del pipeline declarativo debe alimentar el pipeline local nativo ya existente (filtros de columna → orden de columna → paginación), combinándose en `AND` con los filtros nativos y sirviendo como orden por defecto hasta que el usuario active el orden nativo de una columna.
8. Un valor de config sin `|` debe comportarse exactamente igual que hoy, sin ningún cambio observable.
9. Toda condición de "errores de forma" listada en la sección de degradación debe rechazar el config completo antes del render, con diagnóstico sobre la ruta exacta del `source` afectado.
10. Toda condición de "errores dependientes de datos" listada en la sección de degradación debe degradar de forma local sin romper el render del resto del árbol.

## Requisitos no funcionales
- El pipeline se ejecuta siempre en el cliente; no debe introducir ninguna llamada de red ni modificar el ciclo de vida de `queries.*`.
- La reevaluación reactiva del pipeline no debe dejar suscripciones colgantes ni fugas de memoria al desmontar el nodo consumidor.
- El coste de evaluar el pipeline debe mantenerse proporcional al tamaño de la colección de entrada, sin pasos adicionales de complejidad superior a la estrictamente necesaria para filtrar, ordenar y recortar (sin, por ejemplo, reordenar más de una vez cuando basta una).
- La cobertura de tests del proyecto debe mantenerse sobre el umbral mínimo global (80% sobre `src/`).

## Criterios de aceptación
- Un `repeater.props.items.source` con `queries.products.data | orderby:price,desc | slice:0,10` renderiza como máximo 10 items, ordenados de mayor a menor `price`, sin necesidad de que el backend devuelva los datos ya ordenados ni recortados.
- Un `table.props.rows.source` con `queries.orders.data | filter:status,eq,"pending"` muestra solo filas cuyo `status` sea `"pending"`, y ese filtro se sigue aplicando aunque el usuario active además un filtro nativo de columna sobre otro campo.
- Un `select.props.items` dinámico cuyo `source` es `queries.users.data | filter:role,in,["admin","editor"]` muestra solo las opciones cuyo `role` está en esa lista.
- Un pipeline con `filter:status,eq,forms.searchForm.status` se re-evalúa y actualiza la colección visible en cuanto cambia el valor de `forms.searchForm.status`, sin que el usuario tenga que disparar ninguna acción adicional.
- Con `forms.searchForm.status` vacío (`''`), el `filter` anterior no excluye ningún elemento: se muestra la colección completa (sujeta al resto de operaciones del pipeline, si las hay).
- Un `orderby:precio,asc` (nombre de campo con typo/inexistente en algunos items) no rompe el render: los items sin ese campo se ordenan de forma estable como valor mínimo, sin excepciones ni pantalla en blanco.
- Un pipeline con gramática inválida (por ejemplo `filter:status,unknown-op,"x"`, un operador no soportado) rechaza el config completo en bootstrap, igual que ya ocurre hoy con un `items.source` malformado.
- Un `repeater.props.items.source` sin `|` sigue comportándose exactamente igual que antes de esta feature (sin regresión).

## Casos límite
- Referencia base que resuelve a algo distinto de un array (`null`, objeto, `undefined`, query aún en `loading`): el pipeline opera sobre colección vacía, igual que hoy degrada `items.source`/`rows.source`.
- `filter` con operador numérico (`gt`/`lt`/`gte`/`lte`) sobre un campo cuyo valor no es numérico en algunos items: esos items no matchean (se excluyen), el resto del pipeline sigue evaluándose con normalidad.
- `in` con lista literal que mezcla tipos (`["active", 1]`) o con una referencia dinámica que no resuelve a un array: se trata como lista vacía (ningún valor coincide), sin romper el render.
- `slice` con índices fuera de rango o negativos: sigue exactamente la semántica de `Array.prototype.slice` (clampa, nunca lanza error).
- Varias operaciones `filter` encadenadas: se combinan en `AND` (un item debe pasar todos los `filter` del pipeline para conservarse).
- Varias operaciones `orderby` encadenadas: cada `orderby` reordena el resultado del anterior (el último `orderby` del pipeline determina el criterio de desempate menos prioritario; el primero es el más prioritario si son estables entre sí — ver nota de riesgo sobre estabilidad).
- `repeater` paginado o `table` con paginación local: el `slice` del pipeline recorta antes de que la paginación local reciba la colección, así que el tamaño total paginado ya refleja el recorte.
- `select.multiple`/`checkboxGroup` con una selección ya hecha cuyo valor deja de estar presente tras aplicar `filter`: se aplica el comportamiento ya documentado en `select.md`/`choice-groups.md` ante colecciones que cambian (se limpian los valores ya inválidos).
- Cambiar dinámicamente el valor de un `filter` mientras un `repeater`/`table` paginado no está en su primera página: la colección resultante cambia y, según el comportamiento ya documentado de paginación local, la posición vuelve al estado inicial válido.
- Pipeline declarado en `list.props.items` con shape dinámico objeto (`itemText`) y con shape dinámico escalar (`itemType: 'scalar'`): el pipeline aplica igual sobre el array resuelto en ambos shapes, antes de proyectar `itemText`/`itemType`.

## Riesgos o preguntas abiertas
- **Estabilidad de `orderby` encadenado**: la spec asume que cada `orderby` reordena el resultado ya ordenado del paso anterior usando un sort estable, de modo que encadenar `orderby:a,asc | orderby:b,desc` produce el efecto habitual de "b es el criterio principal, a es el desempate". Esto debe confirmarse como decisión de diseño técnico al escribir `design.md`, no es una decisión de producto pendiente.
- **Rendimiento sobre colecciones grandes**: el pipeline es siempre client-side y sin virtualización; para colecciones muy grandes (miles de items) el coste de filtrar/ordenar en cada re-evaluación reactiva podría ser perceptible. Sigue siendo coherente con el límite ya vigente del proyecto ("procesamiento remoto de tablas" fuera de v1 según `current-state.md`), pero es un límite conocido a documentar, no a resolver en esta feature.
- Esta feature introduce un tipo de pipeline nuevo (devuelve un valor real, no texto formateado) y reactivo sobre estado dinámico en seis superficies distintas: requiere decisiones técnicas explícitas antes de planificar tareas — ver `requires_design: true` en `status.yaml`. En concreto, `generate-feature-design` debe decidir dónde vive el nuevo módulo y cómo se integra con `runtime-collection-sources`, y evaluar si el nuevo pipeline puede reutilizar el parser/gramática de bajo nivel ya existente para `{{ referencia | formatter:arg }}` en `dynamic-strings.md` (tokenizado del pipe, parseo de literales entre comillas/número) como pieza de código compartida — manteniendo, eso sí, los catálogos de operaciones separados: los formatters de texto (`number`, `date`, `uppercase`, `length`...) siguen existiendo solo dentro de `{{...}}` en superficies visibles, y `filter`/`orderby`/`slice` siguen existiendo solo en las superficies de `source` de esta feature, sin combinarse entre sí en un mismo pipeline.

## Áreas de producto afectadas
- `references/` (nueva gramática de referencia; probablemente un sub-documento nuevo, dado el tamaño del contrato, distinto de `dynamic-strings.md` que sigue cubriendo solo interpolación de texto).
- `nodes/repeater.md`, `nodes/table.md`, `nodes/select.md`, `nodes/choice-groups.md`, `nodes/heading-paragraph-list.md` (sección `list`).

## Documentación probablemente afectada
- Un sub-documento nuevo bajo `ai-workflow/docs/app-features/references/` que documente el pipeline de colección (gramática, catálogo de operaciones, degradación), enlazado desde `references/index.md`.
- Actualización puntual de `nodes/repeater.md`, `nodes/table.md`, `nodes/select.md`, `nodes/choice-groups.md` y `nodes/heading-paragraph-list.md` para reflejar que sus superficies de `source`/`items` admiten el pipeline.
- `architecture.md` si el pipeline introduce un nuevo módulo (`src/config/`) al mismo nivel que `runtime-reference-syntax.ts` o `runtime-formatters` como punto de extensión estable.
