> Cuándo leer: nodo `select`, selección simple o múltiple, shapes de `items` manuales o dinámicos, semántica de valor efectivo cuando cambia la colección.
> Tamaño: medio.
> Relacionados: [[choice-groups.md]], [[../forms/defaults.md]], [[../forms/validation-rules.md]], [[../references/dynamic-strings.md]].

# `select`

## Contrato (`props`)
- `props.fieldId`: string obligatorio y único dentro del `form` contenedor.
- `props.label`: string obligatorio, literal, referencia dinámica completa o string visible interpolado con `{{...}}`.
- `props.validations`: objeto opcional y ordenado por declaración.
  - `props.validations.required`: `true` o `{ value: true, message?: string }`.
  - `props.validations.minSelections`: número o `{ value: number, message?: string }`, solo cuando `props.multiple: true`.
  - `props.validations.maxSelections`: número o `{ value: number, message?: string }`, solo cuando `props.multiple: true`.
- `props.defaultValue`: literal escalar para selección simple, array escalar homogéneo para selección múltiple o referencia dinámica completa soportada por el runtime.
- `props.items`: obligatorio.
- `props.multiple`: boolean opcional; cuando vale `true`, el valor efectivo del campo pasa a ser una colección ordenada.

## Shapes de `items`
- shape histórico: array de `{ label, value }`, con `value` homogéneo `string` o `number` dentro del mismo campo.
- shape manual escalar: `{ values: Array<string | number> }`.
- shape manual objeto: `{ values: Array<object>, label: string, value: string }`, donde `label` y `value` aceptan ruta relativa histórica o interpolación parcial con `{{...}}`.
- shape dinámico escalar: `{ source: 'queries.{queryName}.data' | 'queries.{queryName}.data.*' | 'item.*', itemType: 'scalar' }`.
- shape dinámico objeto: `{ source: 'queries.{queryName}.data' | 'queries.{queryName}.data.*' | 'item.*', label: string, value: string }`, donde `label` y `value` aceptan ruta relativa histórica o interpolación parcial con `{{...}}`.

## Reglas de render
- `select` acepta tanto items históricos estáticos `{ label, value }` como colecciones manuales o dinámicas declaradas desde `queries.*`.
- `select.props.multiple` activa una semántica de selección múltiple basada en `string[]`, con el mismo orden estable del catálogo efectivo visible y la misma limpieza automática de valores ya inválidos.
- `select.props.multiple` mantiene una altura mínima suficiente para uso real, pero también más contenida que en la baseline previa.
- Sus labels y values string de opción pueden interpolarse parcialmente, se normalizan internamente a string los valores efectivos y el valor vigente queda vacío cuando ya no coincide con ninguna opción disponible.
- El control `<select>` renderiza un `id` estable con el patrón `${formId}-${fieldId}`. La asociación label↔control se realiza vía `<label>` wrapper implícito; el `<select>` no incluye `aria-label` redundante. Cuando hay error activo, incluye `aria-describedby="${formId}-${fieldId}-error"` apuntando al span de error, que lleva el mismo `id`. Cuando no hay error, el atributo `aria-describedby` no está presente.

## Semántica de valores
- Dentro de un mismo `select`, todos los `value` efectivos no interpolados deben ser homogéneos en origen (`string` o `number`) aunque en runtime se normalicen a string; cuando un `value` string se interpola, el resultado final entra como string efectivo.
- Los valores numéricos de `select` se normalizan a string en runtime para compararse, almacenarse, renderizarse y enviarse.
- Los valores interpolados de opción se normalizan como strings finales; `0` y `false` se conservan como `0` y `false`, y un placeholder no resoluble solo vacía su parte del string.
- `select` simple comparte la semántica de valor vacío `''` con `radioGroup`.
- `select.multiple` comparte la semántica de valor vacío `[]` y el mismo orden estable según el catálogo efectivo visible con `checkboxGroup`.

## Comportamiento ante opciones que cambian
- En `select` simple, si el valor efectivo no coincide con ninguna opción disponible en la colección resuelta, el campo queda vacío.
- En `select.multiple`, solo se conservan seleccionados los valores que sigan existiendo en la colección efectiva disponible.

## Comportamiento por validación
- `select` simple `required` considera inválido `''` aunque exista una opción placeholder visible.
- `select.multiple` `required` considera inválido `[]`.
- `minSelections` y `maxSelections` solo aplican a `select.multiple`, contando la selección efectiva después de normalizar el catálogo visible.

## Validación específica
- Si `select.props.items` mezclan `value` string y number dentro del mismo campo, el config completo se rechaza antes del render.
- Si un campo de selección múltiple (`select.props.multiple: true`) declara un `defaultValue` literal no array, el config completo se rechaza antes del render.
- Si un campo de selección simple declara un `defaultValue` literal array, el config completo se rechaza antes del render.
- Si un `defaultValue` literal múltiple contiene miembros no escalares o mezcla strings y números, el config completo se rechaza antes del render.

## Solo dentro de `form`
- Si `select` aparece fuera de un subárbol `form`, el config completo se rechaza antes del render.
