> Cuándo leer: nodo `textarea`, validaciones aplicables, `defaultValue`, gramática visual.
> Tamaño: corto.
> Relacionados: [[../forms/validation-rules.md]], [[../forms/defaults.md]], [[input.md]].

# `textarea`

## Contrato (`props`)
- `props.fieldId`: string obligatorio y único dentro del `form` contenedor.
- `props.label`: string obligatorio, literal, referencia dinámica completa o string visible interpolado con `{{...}}`.
- `props.placeholder`: string opcional, literal o string visible interpolado con `{{...}}`. Aparece como texto de ayuda cuando el campo está vacío, usando el atributo HTML nativo `placeholder`.
- `props.tooltip`: string opcional, literal, referencia dinámica completa o string visible interpolado con `{{...}}`. Cuando resuelve a un string no vacío, se renderiza un icono de información (`HelpCircle`) junto al texto del label con un tooltip flotante accesible (hover y focus). Cuando está ausente o resuelve a vacío, no se renderiza nada adicional.
- `props.validations`: objeto opcional y ordenado por declaración.
  - `props.validations.required`: `true` o `{ value: true, message?: string }`.
  - `props.validations.minLength`: número o `{ value: number, message?: string }`.
  - `props.validations.maxLength`: número o `{ value: number, message?: string }`.
- `props.defaultValue`: literal JSON simple o referencia dinámica completa soportada por el runtime.

## Reglas de render
- `textarea` cubre entrada multilínea.
- `textarea` lee y escribe exclusivamente en `forms.{formId}.{fieldId}`; su label admite literal, referencia completa o interpolación parcial visible.
- `textarea` conserva `resize-y` y una altura mínima útil, ahora más compacta en móvil base que en breakpoints mayores.
- Comparte borde sobrio, fondo blanco, foco por `ring` y ausencia de sombra con `input` y `select`.
- El control `<textarea>` renderiza un `id` estable con el patrón `${formId}-${fieldId}`. Cuando hay error activo, incluye `aria-describedby="${formId}-${fieldId}-error"` apuntando al span de error, que lleva el mismo `id`. Cuando no hay error, el atributo `aria-describedby` no está presente.

## Comportamiento por validación
- `textarea` `required` considera inválidos `''` y strings compuestos solo por espacios.
- `minLength` y `maxLength` aplican usando la longitud efectiva del string actual sin trim adicional.

## Solo dentro de `form`
- Si `textarea` aparece fuera de un subárbol `form`, el config completo se rechaza antes del render.
