> Cuándo leer: `node.visibility` transversal — qué referencias admite, qué operadores soporta, cómo interactúa con `queryStateFeedback`, validación de shape.
> Tamaño: corto.
> Relacionados: [[query-state-feedback.md]], [[reference-resolution.md]], [[../forms/lifecycle.md]].

# `visibility`

## Shape
Cualquier nodo soportado hoy puede declarar opcionalmente:
- `reference`: referencia runtime completa no vacía
- `operator`: `equals | notEquals | isTruthy | isFalsy | greaterThan | lessThan`
- `value`: obligatorio solo para `equals`, `notEquals`, `greaterThan` y `lessThan`

Este mismo shape se reutiliza en otros contextos del runtime para declarar condiciones:
- `submitAction.onSuccess[*].when` — condicionar la ejecución de una acción post-éxito
- `pages[].preloads[*].when` — condicionar la ejecución de una precarga
- `button.props.action.operations[*].when` (y equivalente en `form.submitAction`) — condicionar la ejecución de una operación individual dentro de `executeOperations`

## Referencias admitidas
- `item`
- `item.{segmentosAnidados}`
- `forms.{formId}.{fieldId}`
- `queries.{queryName}`
- `queries.{queryName}.data`
- `queries.{queryName}.data.{segmentosAnidados}`
- `queries.{queryName}.status`
- `queries.{queryName}.error`
- `queries.{queryName}.error.message`
- `queries.{queryName}.error.code`

## Reglas funcionales
- `visibility` es transversal a `container`, `heading`, `paragraph`, `list`, `image`, `table`, `button`, `form`, `input`, `textarea`, `select`, `radioGroup` y `checkboxGroup`.
- si un nodo no declara `visibility`, conserva su comportamiento visible previo.
- `equals` y `notEquals` comparan contra un literal declarado ya validado, sin reinterpretar strings con forma de referencia runtime.
- `equals` y `notEquals` solo aceptan `string`, `number`, `boolean` o `null` como `value`.
- `isTruthy` e `isFalsy` no aceptan `value`.
- `greaterThan` y `lessThan` solo aceptan umbrales numéricos.
- `greaterThan` y `lessThan` comparan directamente números; si el valor observado es un array, usan `length`.
- strings, objetos, `null` y otros valores no comparables para `greaterThan` y `lessThan` degradan a no match en vez de abrir coerciones implícitas.
- una referencia válida pero ausente se trata como valor ausente: `isFalsy` la considera falsa, `isTruthy` no hace match y el resto de operadores no hace match.
- si un nodo declara a la vez `queryStateFeedback` y `visibility`, primero se resuelve `queryStateFeedback`; `visibility` solo se evalúa cuando el resultado visible restante sigue siendo el nodo original.
- `visibility` no introduce `fallback`, condiciones múltiples ni composición booleana en esta versión.

## Validación de shape
- Si `visibility.reference` sale del alcance `item.*`, `forms.*` o `queries.*` soportado, el config completo se rechaza antes del render sobre la ruta exacta.
- Si `visibility.operator` usa un valor fuera del catálogo soportado, el config completo se rechaza antes del render.
- Si `visibility.operator` es `isTruthy` o `isFalsy` y declara `value`, el config completo se rechaza antes del render.
- Si `visibility.operator` es `equals`, `notEquals`, `greaterThan` o `lessThan` y omite `value`, el config completo se rechaza antes del render.
- Si `visibility.operator` es `equals` o `notEquals` y `value` no es un literal escalar (`string | number | boolean | null`), el config completo se rechaza antes del render.
- Si `visibility.operator` es `greaterThan` o `lessThan` y `value` no es numérico, el config completo se rechaza antes del render.
