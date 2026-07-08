> Cuándo leer: nodo `input`, catálogo de `inputType`, validaciones aplicables, `defaultValue`, gramática visual compartida.
> Tamaño: corto.
> Relacionados: [[../forms/validation-rules.md]], [[../forms/defaults.md]], [[../references/dynamic-strings.md]].

# `input`

## Contrato (`props`)
- `props.fieldId`: string obligatorio y único dentro del `form` contenedor.
- `props.label`: string obligatorio, literal, referencia dinámica completa o string visible interpolado con `{{...}}`.
- `props.placeholder`: string opcional, literal o string visible interpolado con `{{...}}`. Aparece como texto de ayuda cuando el campo está vacío, usando el atributo HTML nativo `placeholder`.
- `props.icon`: string opcional, nombre del icono Lucide React (ej. `"Mail"`, `"Search"`). Se renderiza visualmente dentro del campo a la izquierda del área de texto por defecto. Si el nombre no resuelve, se ignora silenciosamente. El icono es puramente decorativo: no afecta al valor, validación ni submit del formulario.
- `props.iconPosition`: string opcional, enum cerrado `"left" | "right"`, default `"left"`. Controla el posicionamiento del icono declarado con `props.icon`. Solo tiene efecto cuando `props.icon` está declarado y resuelve a un icono conocido; en caso contrario se ignora silenciosamente.
- `props.validations`: objeto opcional y ordenado por declaración.
  - `props.validations.required`: `true` o `{ value: true, message?: string }`.
  - `props.validations.minLength`: número o `{ value: number, message?: string }`, solo para `input` textuales.
  - `props.validations.maxLength`: número o `{ value: number, message?: string }`, solo para `input` textuales.
  - `props.validations.min`: número o `{ value: number, message?: string }`, solo para `inputType: 'number'`.
  - `props.validations.max`: número o `{ value: number, message?: string }`, solo para `inputType: 'number'`.
- `props.defaultValue`: literal JSON simple o referencia dinámica completa soportada por el runtime.
- `props.inputType`: `text | email | password | search | tel | url | number | date | datetime-local | time`.

## Reglas de render
- `input` cubre entrada de una sola línea con `inputType` acotado y ya soporta `text`, `email`, `password`, `search`, `tel`, `url`, `number`, `date`, `datetime-local` y `time`.
- `input` lee y escribe exclusivamente en `forms.{formId}.{fieldId}`; su label admite literal, referencia completa o interpolación parcial visible.
- `input` comparte borde sobrio, fondo blanco, foco por `ring` sobre el propio borde y ausencia de sombra propia en reposo, con padding y altura percibida más contenidos.
- El control `<input>` renderiza un `id` estable con el patrón `${formId}-${fieldId}`. Cuando hay error activo, incluye `aria-describedby="${formId}-${fieldId}-error"` apuntando al span de error, que lleva el mismo `id`. Cuando no hay error, el atributo `aria-describedby` no está presente.

## Comportamiento por validación
- `input` y `textarea` `required` consideran inválidos `''` y strings compuestos solo por espacios.
- `minLength` y `maxLength` solo aplican a `input` textuales y `textarea`, usando la longitud efectiva del string actual sin trim adicional.
- `min` y `max` solo aplican a `inputType: 'number'`, comparando contra el valor numérico efectivo del campo cuando existe.

## Validación específica
- Si `input.props.iconPosition` toma un valor fuera del enum cerrado (`"left" | "right"`), el config completo se rechaza antes del render con código `invalid-layout` y ruta exacta.

## Solo dentro de `form`
- Si `input` aparece fuera de un subárbol `form`, el config completo se rechaza antes del render.
