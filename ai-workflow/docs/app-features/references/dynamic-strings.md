> Cuándo leer: interpolación parcial `{{...}}` en strings visibles, catálogo cerrado de superficies, semántica de placeholders no resolubles, sintaxis y catálogo de formatters (`| formatter[:arg]`).
> Tamaño: medio.
> Relacionados: [[reference-resolution.md]], [[../nodes/index.md]].

# Strings dinámicas con `{{...}}`

## Superficies que admiten interpolación parcial
- `heading.props.text`
- `paragraph.props.text`
- `button.props.label`
- `input.props.label`
- `input.props.placeholder`
- `textarea.props.label`
- `textarea.props.placeholder`
- `select.props.label`
- `select.props.placeholder`
- `radioGroup.props.label`
- `checkboxGroup.props.label`
- `image.props.src`
- `image.props.alt`
- strings visibles de `list.props.items`
- `list.props.items.itemText` en colecciones manuales o dinámicas de objetos
- `select.props.items.label` y `select.props.items.value` en colecciones manuales o dinámicas de objetos
- `radioGroup.props.items.label` y `radioGroup.props.items.value` en colecciones manuales o dinámicas de objetos
- `checkboxGroup.props.items.label` y `checkboxGroup.props.items.value` en colecciones manuales o dinámicas de objetos
- celdas string de `table` manual
- `table.props.rows.cells` en modo dinámico
- `api.endpoint` en el catálogo de operaciones (véase [[../config/api-catalog.md]] para semántica de placeholders no resolubles)
- `api.headers` valores (véase [[execution.md]] para semántica de error en headers)
- `button.props.action.headers` valores
- `form.submitAction.headers` valores
- `preloads[].headers` valores

## Semántica de placeholders

### En superficies visibles
- cada placeholder se resuelve con la misma capa central que las referencias completas
- espacios alrededor de la referencia dentro del placeholder se ignoran
- `string`, `number`, `boolean`, `0` y `false` producen texto visible
- objetos, arrays, `null`, `undefined`, referencias ausentes, inválidas, no soportadas o fuera de contrato producen string vacío solo para ese placeholder
- delimitadores no emparejados no rompen el render y conservan una salida estable
- `item` e `item.*` se resuelven contra la iteración de `repeater` cuando existe, o contra el item local de la proyección de colección que se está materializando
- `row` e `row.*` se resuelven contra el dato de la fila actual dentro de celdas de `table` (modo dinámico); `row.$index` resuelve la posición 1-based de la fila en la vista visible en celdas de `table` en cualquier modo. Dentro de esas mismas celdas, `item.*` deja de referirse a la fila propia y solo resuelve contra el `repeater` ancestro más cercano, si existe
- `params.*` conserva la frontera `params.{paramName}`; `params.user.id` queda fuera de contrato y produce string vacío dentro de un placeholder
- `translations.{key}` se resuelve aplicando la cadena de fallback del catálogo según el idioma activo declarado en `data-lang`

### En superficies de headers
- cada placeholder se resuelve con la misma capa central que las referencias completas
- espacios alrededor de la referencia dentro del placeholder se ignoran
- `string`, `number`, `boolean` producen texto serializado en el header
- objetos, arrays, `null`, `undefined`, referencias ausentes, inválidas, no soportadas o fuera de contrato producen `request-build-failed` (no string vacío como en superficies visibles)
- si un placeholder de un valor de header referencia un campo oculto del propio formulario, el header completo se omite del wire format
- delimitadores no emparejados se tratan como texto literal

## Superficies fuera de interpolación parcial
Las siguientes superficies usan solo referencias completas o literales y NO aplican interpolación parcial. Un string como `prefix-{{params.userId}}` se conserva como literal o queda sometido a la validación histórica del consumidor, pero no se reinterpreta como plantilla:
- `api.query`, `api.body`
- `button.props.action.query`, `button.props.action.body`, `button.props.action.params`
- `form.submitAction.query`, `form.submitAction.body`
- `navigateTo.params`
- `defaultValue` de campos de formulario
- `visibility.reference`
- `queryStateFeedback`
- `repeater.props.items.source` y `repeater.props.items.key`
- `list.props.items.source`, `select.props.items.source`, `radioGroup.props.items.source`, `checkboxGroup.props.items.source`
- cabeceras de `table`

## Reglas de placeholder vacío
- la interpolación parcial solo existe en el catálogo visible anterior y usa placeholders `{{referencia}}`
- cada placeholder no resoluble, inválido, ausente o no renderizable se sustituye por string vacío, conservando el texto literal que lo rodea
- objetos y arrays pueden recorrerse de izquierda a derecha con una única semántica central
- las referencias textuales no resolubles degradan a string vacío y mantienen diagnóstico de desarrollo coherente con la referencia original

## Formatters dentro del placeholder

### Sintaxis
- gramática: `{{ referencia | formatter [: arg] | formatter [: arg] | ... }}`
- los espacios alrededor de `|` y de `:` son opcionales; se ignoran igual que los espacios alrededor de la referencia
- el argumento, cuando aparece, es una única string entre comillas dobles (`"..."`) o un número (entero o con parte decimal, con `.` como separador; sin coma decimal, sin separador de miles)
- los formatters se aplican de izquierda a derecha sobre el valor ya resuelto de la referencia
- una cadena mal formada (nombre no identificador, `:` sin argumento, string sin cerrar, argumento con tipo no soportado por el formatter) hace la cadena no resoluble para ese placeholder
- un placeholder sin `|` mantiene exactamente el comportamiento anterior a la feature: se resuelve la referencia como referencia completa y se serializa igual que hoy

### Catálogo v1
- `number` — formatea un número finito en locale fijo `es-ES` con separación de miles. Argumento opcional numérico entero: número de decimales fijos (mínimos y máximos).
- `currency` — formatea un número finito como moneda en locale fijo `es-ES`. Argumento opcional string: código ISO 4217 (por ejemplo `"EUR"`, `"USD"`); por defecto `"EUR"`.
- `percent` — formatea un número finito como porcentaje en locale fijo `es-ES`. Argumento opcional numérico entero: número de decimales fijos.
- `date` — formatea una string ISO 8601 (date-only `YYYY-MM-DD` o date-time con `T` y offset opcional). Argumento obligatorio string: patrón con tokens `dd`, `MM`, `yyyy`, `HH`, `mm`, `ss`; cualquier otro carácter del patrón se conserva literal. Un input date-only se interpreta en UTC; un input date-time con offset explícito respeta ese offset y se formatea en hora local.
- `uppercase` — pasa a mayúsculas. Sin argumento.
- `lowercase` — pasa a minúsculas. Sin argumento.
- `capitalize` — capitaliza la primera letra. Sin argumento.
- `truncate` — trunca a un número de caracteres y añade `…` cuando el input excede ese límite. Argumento obligatorio numérico entero no negativo. `truncate:0` sobre texto no vacío produce `"…"`.
- `length` — devuelve el número de elementos de un `array` o el número de caracteres de un `string` (unidades UTF-16, mismo criterio que `truncate`), como entero en texto plano sin formato de locale. Sin argumento. Encadenable, por ejemplo `{{referencia | length | number}}` para aplicar formato de miles a un contador.

### Compatibilidad de valor de entrada por formatter
- `number`, `currency`, `percent` aceptan `number` finito o `string` que matchee `/^-?\d+(\.\d+)?$/`. Cualquier otro tipo (`NaN`, `Infinity`, string vacío, objetos, arrays, `null`, `undefined`) hace la cadena no resoluble.
- `date` acepta solo strings ISO 8601 (shape date-only o date-time con `T`) que parseen a `Date` válida. Cualquier otro shape o valor hace la cadena no resoluble.
- `uppercase`, `lowercase`, `capitalize`, `truncate` aceptan `string`, `number` finito o `boolean`. Objetos, arrays, `null`, `undefined`, `NaN`, `Infinity` hacen la cadena no resoluble.
- `length` acepta `array` (cualquier longitud, incluida vacía) o `string` (incluido vacío). Cualquier otro tipo (`object` plano, `number`, `boolean`, `null`, `undefined`, `NaN`, `Infinity`) hace la cadena no resoluble.

### Semántica de cadena no resoluble en superficies visibles
- Cuando la cadena de formatters no resuelve — nombre desconocido, argumento no válido para el formatter, valor de entrada incompatible o cualquier fallo intermedio en el encadenamiento — ese placeholder se sustituye por string vacío en la string resuelta, sin afectar al texto literal que lo rodea ni al resto de placeholders.
- Es la misma semántica que ya aplica a referencias no resolubles en superficies visibles: solo cae el placeholder concreto, nunca la string completa.
- En modo desarrollo se emite un `console.warn` con prefijo `[runtime-formatters]` indicando el placeholder afectado y el primer formatter que hizo fallar la cadena. En producción no se emite ningún log.

### Semántica de cadena no resoluble en superficies de headers
- Aplica a las cuatro superficies de headers listadas arriba (`api.headers`, `button.props.action.headers`, `form.submitAction.headers`, `preloads[].headers`).
- Cuando la cadena de formatters no resuelve — nombre desconocido, argumento no válido para el formatter, valor de entrada incompatible, gramática de argumento inválida o cualquier fallo intermedio del encadenamiento — la petición no se emite y se proyecta `request-build-failed`, igual que hoy hacen los placeholders no resolubles en valores de header. No hay degradación silenciosa: la única diferencia semántica frente a superficies visibles es que el fallo escala al nivel de la petición completa, no del placeholder.
- La omisión de header por campo oculto se sigue evaluando **antes** que la cadena de formatters. Un placeholder tipo `{{forms.f.hidden | uppercase}}`, donde `hidden` está declarado como campo oculto del formulario que dispara la petición, omite el header completo del wire format y nunca invoca la cadena. Esta regla preserva el contrato de omisión ya documentado en [[execution.md]].
- En modo desarrollo se emite el mismo `console.warn` con prefijo `[runtime-formatters]` que en superficies visibles, indicando el placeholder afectado y el primer formatter que hizo fallar la cadena, con el contexto de superficie `api.headers[<clave>]`. En producción no se emite ningún log.

### Semántica de cadena no resoluble en `api.endpoint`
- `api.endpoint` hereda el mismo contrato de fallo que las superficies de headers: cualquier cadena no resoluble (gramática inválida, nombre desconocido, argumento incompatible o fallo intermedio del encadenamiento) proyecta `request-build-failed` para la operación completa, sin emitir petición. En modo desarrollo se emite el mismo `console.warn` con prefijo `[runtime-formatters]` con el contexto de superficie `api.endpoint`. Los placeholders sin `|` mantienen exactamente el camino previo a la feature.
