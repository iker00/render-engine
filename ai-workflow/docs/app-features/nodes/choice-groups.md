> Cuándo leer: nodos `radioGroup` y `checkboxGroup`, semántica de opciones compartida con `select`, `optionLayout: vertical | inline`, comportamiento dentro de `repeater`.
> Tamaño: medio.
> Relacionados: [[select.md]], [[../forms/validation-rules.md]], [[../forms/defaults.md]].

# `radioGroup` y `checkboxGroup`

## `radioGroup` (selección simple)

### Contrato (`props`)
- `props.fieldId`: string obligatorio y único dentro del `form` contenedor.
- `props.label`: string obligatorio, literal, referencia dinámica completa o string visible interpolado con `{{...}}`.
- `props.tooltip`: string opcional, literal, referencia dinámica completa o string visible interpolado con `{{...}}`. Cuando resuelve a un string no vacío, se renderiza un icono de información (`HelpCircle`) junto al texto del `<legend>` con un tooltip flotante accesible (hover y focus). Cuando está ausente o resuelve a vacío, no se renderiza nada adicional.
- `props.optionLayout`: opcional, con catálogo cerrado `vertical | inline`; si no existe, el runtime conserva el layout vertical como default efectivo.
- `props.validations`: objeto opcional y ordenado por declaración.
  - `props.validations.required`: `true` o `{ value: true, message?: string }`.
- `props.defaultValue`: literal JSON simple o referencia dinámica completa soportada por el runtime.
- `props.items`: obligatorio con exactamente los mismos shapes soportados por `select` (ver [select.md](./select.md)).

### Reglas
- `radioGroup` reutiliza exactamente la misma semántica de opciones y selección simple que `select` simple.
- `radioGroup` `required` considera inválido `''`.
- El `<fieldset>` del grupo ya incluye `<legend>` con el texto del label. Cuando hay error activo, el `<fieldset>` incluye `aria-describedby="${formId}-${fieldId}-error"` apuntando al span de error, que lleva el mismo `id`. Cuando no hay error, el atributo `aria-describedby` no está presente.

## `checkboxGroup` (selección múltiple)

### Contrato (`props`)
- `props.fieldId`: string obligatorio y único dentro del `form` contenedor.
- `props.label`: string obligatorio, literal, referencia dinámica completa o string visible interpolado con `{{...}}`.
- `props.tooltip`: string opcional, literal, referencia dinámica completa o string visible interpolado con `{{...}}`. Cuando resuelve a un string no vacío, se renderiza un icono de información (`HelpCircle`) junto al texto del `<legend>` con un tooltip flotante accesible (hover y focus). Cuando está ausente o resuelve a vacío, no se renderiza nada adicional.
- `props.optionLayout`: opcional, con catálogo cerrado `vertical | inline`; si no existe, el runtime conserva el layout vertical como default efectivo.
- `props.validations`: objeto opcional y ordenado por declaración.
  - `props.validations.required`: `true` o `{ value: true, message?: string }`.
  - `props.validations.minSelections`: número o `{ value: number, message?: string }`.
  - `props.validations.maxSelections`: número o `{ value: number, message?: string }`.
- `props.defaultValue`: array escalar homogéneo o referencia dinámica completa soportada por el runtime.
- `props.items`: obligatorio con exactamente los mismos shapes soportados por `select`.

### Reglas
- `checkboxGroup` reutiliza exactamente la misma semántica de opciones y selección múltiple que `select.multiple`.
- `checkboxGroup` `required` considera inválido `[]`.
- `minSelections` y `maxSelections` aplican contando la selección efectiva después de normalizar el catálogo visible.
- El `<fieldset>` del grupo ya incluye `<legend>` con el texto del label. Cuando hay error activo, el `<fieldset>` incluye `aria-describedby="${formId}-${fieldId}-error"` apuntando al span de error, que lleva el mismo `id`. Cuando no hay error, el atributo `aria-describedby` no está presente.

## `optionLayout`
- `radioGroup.props.optionLayout` y `checkboxGroup.props.optionLayout` permiten declarar `vertical | inline` como decisión visual por nodo, sin alterar el shape de `items`, `defaultValue`, validación ni submit.
- `inline` reparte opciones en línea con `wrap`; si la prop no existe, ambos grupos mantienen el apilado vertical.
- `radioGroup` y `checkboxGroup` conservan controles nativos y texto alineado, sin convertir cada opción en una tarjeta con borde, con menor separación vertical entre opciones.

## Comportamiento ante opciones que cambian
- Si un `radioGroup` pierde la opción correspondiente a su valor almacenado tras cambiar la colección efectiva, el runtime limpia ese valor a `''`.
- Si un `checkboxGroup` pierde parte de sus opciones seleccionadas al cambiar la colección efectiva, el runtime elimina solo los valores ya inválidos.

## Semántica de valores
- Los valores numéricos de `radioGroup` y `checkboxGroup` se normalizan a string en runtime para compararse, almacenarse, renderizarse y enviarse.
- Dentro de un mismo `radioGroup` o `checkboxGroup`, todos los `value` efectivos siguen la misma política de homogeneidad de origen que `select`.

## Validación específica
- Si `radioGroup.props.items` o `checkboxGroup.props.items` mezclan `value` string y number dentro del mismo campo, el config completo se rechaza antes del render.
- Si `checkboxGroup` declara un `defaultValue` literal no array, el config completo se rechaza antes del render.
- Si `radioGroup` declara un `defaultValue` literal array, el config completo se rechaza antes del render.
- Si un `defaultValue` literal múltiple contiene miembros no escalares o mezcla strings y números, el config completo se rechaza antes del render.

## Soporte dentro de `repeater`
- Dentro de un `repeater`, `radioGroup` y `checkboxGroup` también pueden alimentar sus `items` desde `item.*`, compartiendo la misma semántica de opciones que `select`.

## Solo dentro de `form`
- Si `radioGroup` o `checkboxGroup` aparecen fuera de un subárbol `form`, el config completo se rechaza antes del render.
