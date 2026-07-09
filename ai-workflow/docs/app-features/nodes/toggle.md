> Cuándo leer: nodo `toggle`, semántica booleana, `labelPosition`, validación `required` que exige `true`.
> Tamaño: corto.
> Relacionados: [[../forms/validation-rules.md]], [[../forms/defaults.md]], [[../forms/lifecycle.md]].

# `toggle`

## Contrato (`props`)
- `props.fieldId`: string obligatorio y único dentro del `form` contenedor.
- `props.label`: string obligatorio, literal, referencia dinámica completa o string visible interpolado con `{{...}}`.
- `props.labelPosition`: enum cerrado `top | inline`, default `top`.
    - `top`: label encima del control, siguiendo la disposición habitual de los demás campos del catálogo.
    - `inline`: label a la derecha del control en la misma línea.
- `props.defaultValue`: boolean literal (`true` o `false`) o referencia dinámica completa soportada por el runtime. Si no se declara, el valor inicial es `false`.
- `props.validations`: objeto opcional y ordenado por declaración.
    - `props.validations.required`: `true` o `{ value: true, message?: string }`. Para un toggle, `required` significa que el campo debe estar en `true` (activado) para pasar la validación. Un toggle en `false` con `required` falla la validación.

## Reglas de validación aplicables
- Solo `required`. Las reglas `minLength`, `maxLength`, `min`, `max`, `minSelections`, `maxSelections`, `pattern`, `email` y `url` se rechazan en config.

## Reglas de render
- Renderiza un `<button type="button" role="switch" aria-checked={value}>` con el valor booleano actual.
- Cuando hay error activo, incluye `aria-describedby="${formId}-${fieldId}-error"` apuntando al span de error. Cuando no hay error, el atributo `aria-describedby` no está presente.
- Click en el toggle alterna el valor entre `true` y `false`.

## Valor en store
- `forms.{formId}.{fieldId}.value` almacena `true` o `false` como boolean.

## Valor en payload
- Se serializa como boolean en `body`/`query` del submit.

## Integración transversal
- Soporta `visibility`, `queryStateFeedback` y `layout.span` como cualquier otro nodo de formulario.
- Solo es válido como descendiente de un `form`. Un toggle fuera de form rechaza el config antes del render.
- Puede aparecer dentro de `repeater.props.template` dentro de un `form`, con la misma semántica de contexto `item.*` que el resto de campos.

## Props no soportados
- No acepta `items`, `optionLayout`, `minSelections`, `maxSelections`, `minLength`, `maxLength`, `min`, `max`, `icon`, `iconPosition`, `placeholder`.

## Límites
- No existe variante visual más allá de `labelPosition`.
- No soporta `disabled` ni `readOnly`.
