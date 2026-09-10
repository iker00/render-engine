> Cuándo leer: `node.visibility` transversal — qué referencias admite, qué operadores soporta, cómo interactúa con `queryStateFeedback`, validación de shape, composición booleana de condiciones.
> Tamaño: corto.
> Relacionados: [[query-state-feedback.md]], [[reference-resolution.md]], [[../forms/lifecycle.md]].

# `visibility`

## Shape
Cualquier nodo soportado puede declarar opcionalmente una `visibility` que es una **condición simple** o un **grupo compuesto** de condiciones.

### Condición simple
Una condición simple especifica:
- `reference`: referencia runtime completa no vacía
- `operator`: `equals | notEquals | isTruthy | isFalsy | greaterThan | lessThan | arrayContains`
- `value`: obligatorio para `equals`, `notEquals`, `greaterThan`, `lessThan` y `arrayContains`
- `itemField`: (opcional, string) solo válido cuando `operator` es `arrayContains`; ruta de segmentos anidados (ej. `"user.code"`) que se resuelve dentro de cada elemento del array
- `negate`: (opcional, booleano) invierte el resultado de la condición

### Grupo compuesto
Un grupo de condiciones especifica:
- `operator`: `and | or`
- `conditions`: array no vacío de condiciones simples (cada una con `reference`, `operator`, `value?`, `negate?`)

No se admite anidamiento: un grupo solo puede contener condiciones simples, no otros grupos.

Este mismo shape se reutiliza en otros contextos del runtime para declarar condiciones:
- `submitAction.onSuccess[*].when` — condicionar la ejecución de una acción post-éxito
- `pages[].preloads[*].when` — condicionar la ejecución de una precarga
- `button.props.action.operations[*].when` (y equivalente en `form.submitAction`) — condicionar la ejecución de una operación individual dentro de `executeOperations`

## Referencias admitidas
- `params.{paramName}`
- `item`
- `item.{segmentosAnidados}`
- `row`
- `row.{segmentosAnidados}`
- `row.$index`
- `forms.{formId}.{fieldId}`
- `queries.{queryName}`
- `queries.{queryName}.data`
- `queries.{queryName}.data.{segmentosAnidados}`
- `queries.{queryName}.status`
- `queries.{queryName}.error`
- `queries.{queryName}.error.message`
- `queries.{queryName}.error.code`

## Reglas funcionales

### Visibilidad transversal y precedencia
- `visibility` es transversal a `container`, `heading`, `paragraph`, `list`, `image`, `table`, `button`, `form`, `input`, `textarea`, `select`, `radioGroup`, `checkboxGroup`, `modal`, `tabs`, `accordion`, `badge`, `alert`, `stat`, `divider`, `skeleton`, `fileManager`, `fileInput`, `toggle` y `hidden`.
- `shell.header.menu[*].visibility` (raíz o dentro de `children`) y `shell.header.actions[*].visibility` reutilizan el mismo contrato, con una excepción: no admiten `item.*`, al no existir contexto de iteración a nivel de shell. Ver [[../shell/header.md]].
- si un nodo no declara `visibility`, conserva su comportamiento visible previo.
- si un nodo declara a la vez `queryStateFeedback` y `visibility`, primero se resuelve `queryStateFeedback`; `visibility` (simple o grupo) solo se evalúa cuando el resultado visible restante sigue siendo el nodo original.

### Operadores de comparación (condición simple)
- `equals` y `notEquals` comparan contra un literal declarado ya validado, sin reinterpretar strings con forma de referencia runtime.
- `equals` y `notEquals` solo aceptan `string`, `number`, `boolean` o `null` como `value`.
- `isTruthy` e `isFalsy` no aceptan `value`.
- `greaterThan` y `lessThan` solo aceptan umbrales numéricos.
- `greaterThan` y `lessThan` comparan directamente números; si el valor observado es un array, usan `length`.
- strings, objetos, `null` y otros valores no comparables para `greaterThan` y `lessThan` degradan a no match en vez de abrir coerciones implícitas.
- una referencia válida pero ausente se trata como valor ausente: `isFalsy` la considera falsa, `isTruthy` no hace match y el resto de operadores no hace match.

### `arrayContains`
- `arrayContains` coincide si `reference` resuelve a un array y **al menos un elemento** (o su `itemField`, si se declara) es estrictamente igual a `value`.
- Sin `itemField`, la comparación es contra el elemento completo del array (soporta arrays de valores primitivos, ej. `["a", "b", "c"]`).
- Con `itemField`, cada elemento objeto del array se proyecta por esa ruta de segmentos anidados (ej. `itemField: "user.code"` navega `item.user.code` para cada `item`) y se compara el resultado contra `value`.
- Si `reference` no resuelve a un array (objeto no-array, string, número, booleano, `null` o ausente), la condición no coincide, sin coerciones implícitas — mismo criterio que `greaterThan`/`lessThan`.
- Un elemento cuyo `itemField` no resuelve (elemento no objeto, o falta el segmento) se ignora sin invalidar la evaluación del resto del array; equivale a que ese elemento no aporte coincidencia.
- Array vacío nunca coincide, independientemente de `itemField`.
- `value` admite `null`; coincide si algún elemento (o su `itemField`) es exactamente `null`.

### Negación de condición
- `negate: true` en una condición simple invierte el resultado de su evaluación.
- La negación aplica a cualquier operador y cualquier referencia, incluyendo los casos donde la referencia está ausente o el valor no es comparable.
- Una condición con `negate: true` sobre `isTruthy` con referencia ausente pasa de "no coincide" a "coincide".
- Una condición con `negate: true` sobre `greaterThan` con valor no comparable pasa de "no coincide" a "coincide".

### Composición booleana (grupo)
- Un grupo con `operator: "and"` coincide solo si **todas** sus condiciones coinciden (tras aplicar `negate` a cada una).
- Un grupo con `operator: "or"` coincide si **al menos una** de sus condiciones coincide (tras aplicar `negate` a cada una).
- Un grupo es válido solo si contiene al menos una condición simple; un array vacío de `conditions` es rechazado.
- Un grupo no puede contener otros grupos (anidamiento no soportado); solo condiciones simples.
- Un grupo con una sola condición se comporta igual que esa condición declarada suelta.

## Validación de shape

### Condición simple
- Si `visibility.reference` sale del alcance `params.{paramName}`, `item.*`, `row.*`, `forms.*` o `queries.*` soportado, el config completo se rechaza antes del render sobre la ruta exacta.
- `params.{paramName}` requiere exactamente un segmento dinámico: `params.userId` es válido; `params`, `params.user.id` o formas sin segmento siguen siendo inválidas.
- Si `visibility.operator` usa un valor fuera del catálogo soportado (`equals | notEquals | isTruthy | isFalsy | greaterThan | lessThan | arrayContains`), el config completo se rechaza antes del render.
- Si `visibility.operator` es `isTruthy` o `isFalsy` y declara `value`, el config completo se rechaza antes del render.
- Si `visibility.operator` es `equals`, `notEquals`, `greaterThan`, `lessThan` o `arrayContains` y omite `value`, el config completo se rechaza antes del render.
- Si `visibility.operator` es `equals`, `notEquals` o `arrayContains` y `value` no es un literal escalar (`string | number | boolean | null`), el config completo se rechaza antes del render.
- Si `visibility.operator` es `greaterThan` o `lessThan` y `value` no es numérico, el config completo se rechaza antes del render.
- Si `visibility.itemField` está presente y no es un string, el config completo se rechaza antes del render.
- Si `visibility.itemField` está presente y `visibility.operator` no es `arrayContains`, el config completo se rechaza antes del render.
- Si `visibility.negate` está presente y no es booleano, el config completo se rechaza antes del render.

### Grupo compuesto
- Si `visibility.operator` es `and` o `or`, `visibility` debe tener un array `conditions` no vacío.
- Si `visibility.conditions` es un array vacío, el config completo se rechaza antes del render.
- Si `visibility.operator` es `and` o `or` pero no se declare un `conditions`, el config completo se rechaza.
- Cada elemento dentro de `visibility.conditions` debe cumplir todas las reglas de validación de condición simple (referencia, operador, value, negate). Si alguno incumple, el config se rechaza señalando la ruta exacta dentro del grupo (ej: `visibility.conditions[0].reference`).
- Un elemento dentro de `visibility.conditions` que tenga forma de grupo (con `operator: "and" | "or"` y `conditions`) hace que el config se rechace, ya que el anidamiento no está soportado.
- Condición existente sin `negate` y sin `conditions` sigue siendo válida; la feature es retrocompatible.
