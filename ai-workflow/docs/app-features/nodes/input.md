> Cuándo leer: nodo `input`, catálogo de `inputType`, validaciones aplicables, `defaultValue`, gramática visual compartida.
> Tamaño: corto.
> Relacionados: [[../forms/validation-rules.md]], [[../forms/defaults.md]], [[../references/dynamic-strings.md]].

# `input`

## Contrato (`props`)
- `props.fieldId`: string obligatorio y único dentro del `form` contenedor.
- `props.label`: string obligatorio, literal, referencia dinámica completa o string visible interpolado con `{{...}}`.
- `props.validations`: objeto opcional y ordenado por declaración.
  - `props.validations.required`: `true` o `{ value: true, message?: string }`.
  - `props.validations.minLength`: número o `{ value: number, message?: string }`, solo para `input` textuales.
  - `props.validations.maxLength`: número o `{ value: number, message?: string }`, solo para `input` textuales.
  - `props.validations.min`: número o `{ value: number, message?: string }`, solo para `inputType: 'number'`.
  - `props.validations.max`: número o `{ value: number, message?: string }`, solo para `inputType: 'number'`.
- `props.defaultValue`: literal JSON simple o referencia dinámica completa soportada por el runtime.
- `props.inputType`: `text | email | password | search | tel | url | number | date | datetime-local`.

## Reglas de render
- `input` cubre entrada de una sola línea con `inputType` acotado y ya soporta `text`, `email`, `password`, `search`, `tel`, `url`, `number`, `date` y `datetime-local`.
- `input` lee y escribe exclusivamente en `forms.{formId}.{fieldId}`; su label admite literal, referencia completa o interpolación parcial visible.
- `input` comparte borde sobrio, fondo blanco, foco por `ring` sobre el propio borde y ausencia de sombra propia en reposo, con padding y altura percibida más contenidos.

## Comportamiento por validación
- `input` y `textarea` `required` consideran inválidos `''` y strings compuestos solo por espacios.
- `minLength` y `maxLength` solo aplican a `input` textuales y `textarea`, usando la longitud efectiva del string actual sin trim adicional.
- `min` y `max` solo aplican a `inputType: 'number'`, comparando contra el valor numérico efectivo del campo cuando existe.

## Solo dentro de `form`
- Si `input` aparece fuera de un subárbol `form`, el config completo se rechaza antes del render.
