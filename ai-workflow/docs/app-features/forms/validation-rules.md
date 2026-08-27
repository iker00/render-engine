> Cuándo leer: reglas declarativas de validación local (`required`, `minLength`, `maxLength`, `min`, `max`, `minSelections`, `maxSelections`), cuándo valida, dónde vive el error, semántica por tipo de campo.
> Tamaño: medio.
> Relacionados: [[lifecycle.md]], [[submit.md]], [[../references/query-state-feedback.md]], [[../references/visibility.md]].

# Reglas de validación local

## Catálogo soportado
- `required`
- `minLength`
- `maxLength`
- `min`
- `max`
- `minSelections`
- `maxSelections`
- `pattern`
- `email`
- `url`
- un único mensaje visible por campo según la primera regla fallida en el orden declarado dentro de `props.validations`

## Qué valida realmente
- El runtime solo aplica validación declarativa local a nivel de formulario.
- La superficie declarativa vigente entra por `props.validations`; `props.required` ya no forma parte del contrato soportado.
- `required` conserva su semántica histórica, pero ahora vive dentro del mismo catálogo que el resto de reglas.
- No existe todavía validación remota ni validación cruzada entre campos.
- La forma extendida de cada regla admite `message` para mostrar un texto personalizado en lugar del mensaje por defecto.

## Cuándo valida
- La validación se ejecuta al hacer submit del `form`.
- Antes de validar, el runtime inicializa también cualquier campo visible del formulario que todavía no exista en store para que entre en la misma pasada de validación.
- Mientras el usuario edita, el runtime no reejecuta una pasada completa de validación del formulario: solo reevalúa localmente el campo con error y conserva, cambia o limpia ese error según la primera regla visible que siga fallando.

## Dónde vive el resultado
- Los errores viven solo en `forms.{formId}.{fieldId}.error`.
- El estado de error forma parte del mismo store local del formulario junto con `value`, `touched`, `dirty` y `defaultValue`.
- El runtime no crea un dominio paralelo de errores de formulario a nivel de página ni de submit.

## Semántica por tipo de campo
- `input` y `textarea` `required` consideran inválidos `''` y strings compuestos solo por espacios.
- `toggle` `required` exige que el valor sea `true` (activado). Un toggle en `false` con `required` falla la validación.
- `select` simple, `radioGroup` y `autocomplete` simple `required` consideran inválido `''` aunque exista una opción placeholder visible en el caso de `select`.
- `select.multiple`, `checkboxGroup` y `autocomplete` con `multiple: true` `required` consideran inválido `[]`.
- `minLength` y `maxLength` solo aplican a `input` textuales y `textarea`, usando la longitud efectiva del string actual sin trim adicional.
- `min` y `max` solo aplican a `inputType: 'number'`, comparando contra el valor numérico efectivo del campo cuando existe.
- `minSelections` y `maxSelections` solo aplican a `select.multiple`, `checkboxGroup` y `autocomplete` con `multiple: true`, contando la selección efectiva después de normalizar el catálogo visible.
- `pattern` solo aplica a `input` textuales (`inputType` text, email, password, search, tel, url) y `textarea`. Valida el valor contra una expresión regular JavaScript sin flags ni anclaje automático. Si el campo está vacío, `pattern` no falla. Si el pattern no compila como `RegExp` válido, el config se rechaza antes del render. Shape: `string` o `{ value: string, message?: string }`.
- `email` solo aplica a `input` textuales y `textarea`. Valida formato básico de email (presencia de `@`, al menos un carácter antes y después, dominio con al menos un punto). Si el campo está vacío, `email` no falla. Shape: `true` o `{ value: true, message?: string }`.
- `url` solo aplica a `input` textuales y `textarea`. Valida que el string sea parseable como URL válida con protocolo `http` o `https`. Si el campo está vacío, `url` no falla. Shape: `true` o `{ value: true, message?: string }`.
- `pattern`, `email` y `url` se rechazan en `input` con `inputType` `number`, `date`, `datetime-local`, `time` y en `select`, `radioGroup`, `checkboxGroup`, `toggle`, `autocomplete`.

## Validaciones de ficheros (fileManager y fileInput)

### fileManager

El nodo `fileManager` extiende `runtime-form-validations` con reglas específicas para ficheros `File[]` que se evalúan **previas a la subida**, con error inline en la zona DnD si alguna validación falla. Estas reglas **no escriben en `forms.*`**; el estado de error vive en el estado local del nodo.

| Regla | Aplica | Comportamiento |
|---|---|---|
| `accept` | `{ value: string[]; message?: string }` | Ficheros con MIME type no incluido se rechazan. Ej.: `{ value: ["application/pdf", "image/jpeg"] }`. El campo `message` es opcional y soporta `{{translations.*}}` e interpolación. |
| `maxFileSize` | `{ value: number; message?: string }` | Ficheros que superen el límite individual se rechazan. Ej.: `{ value: 2 }` = máximo 2 MB por fichero. El campo `message` es opcional y soporta `{{value}}`, `{{translations.*}}` e interpolación. |
| `maxTotalSize` | `{ value: number; message?: string }` | Si el lote total supera el límite, se rechaza el lote completo. Ej.: `{ value: 10 }` = máximo 10 MB acumulados. El campo `message` es opcional y soporta `{{value}}`, `{{translations.*}}` e interpolación. |
| `minFiles` | `number` | Mínimo de ficheros que deben estar subidos (informativo; no bloquea submit del formulario contenedor). |
| `maxFiles` | `{ value: number; message?: string }` | Máximo de ficheros permitidos contando los ya presentes. Si se alcanza, la zona DnD se deshabilita. El campo `message` es opcional y soporta `{{value}}`, `{{translations.*}}` e interpolación. |
| `validFileNames` | `{ value: string[]; message?: string }` | Ficheros cuyo nombre no coincide con ningún patrón regex se rechazan. Ej.: `{ value: ["^FACT_\\d{4}\\.pdf$"] }`. El campo `message` es opcional y soporta `{{translations.*}}` e interpolación. |

Validaciones implícitas adicionales:
- Fichero de 0 bytes: rechazado automáticamente.
- Nombre duplicado: rechazado si el nombre ya existe en la lista actual.

Los ficheros rechazados **no llegan al servidor**. Los errores desaparecen al intentar una nueva selección o drop.

### fileInput

El nodo `fileInput` como campo de formulario extiende también `runtime-form-validations` con las mismas reglas de fichero que `fileManager`, pero con semántica distinta:
- Las reglas se evalúan **al seleccionar ficheros**, con error inline si alguna validación falla.
- Los errores **escriben en `forms.{formId}.{fieldId}.error`**, como cualquier otro field node.
- Los ficheros rechazados no entran en la selección final (`forms.{formId}.{fieldId}.value`).
- Las reglas de fichero (`accept`, `maxFileSize`, `maxTotalSize`, `maxFiles`, `validFileNames`) se evalúan al seleccionar, **no en submit**. Si pasan al seleccionar, no se reevalúan en submit.
- `required` y `minFiles` se evalúan en submit (ver [[submit.md]]), no al seleccionar: controlan si hay la cantidad mínima de ficheros para que el submit sea válido.
- Todos los mensajes de validación reutilizan el sistema de mensajes personalizados descrito más arriba.

| Regla | Aplica | Comportamiento |
|---|---|---|
| `required` | `boolean \| { value: boolean; message?: string }` | Al menos un fichero debe estar seleccionado para que el submit sea válido. Bloquea submit. El campo `message` es opcional y soporta `{{translations.*}}` e interpolación. |
| `minFiles` | `{ value: number; message?: string }` | Mínimo de ficheros requeridos. Bloquea submit si no se alcanza. El campo `message` es opcional y soporta `{{value}}`, `{{translations.*}}` e interpolación. |
| `accept` | `{ value: string[]; message?: string }` | Ficheros con MIME type no incluido se rechazan al seleccionar. Ej.: `{ value: ["application/pdf", "image/jpeg"] }`. El campo `message` es opcional y soporta `{{translations.*}}` e interpolación. |
| `maxFileSize` | `{ value: number; message?: string }` | Ficheros que superen el límite individual se rechazan al seleccionar. Ej.: `{ value: 2 }` = máximo 2 MB por fichero. El campo `message` es opcional y soporta `{{value}}`, `{{translations.*}}` e interpolación. |
| `maxTotalSize` | `{ value: number; message?: string }` | Si el lote total supera el límite, se rechaza el lote completo al seleccionar. Ej.: `{ value: 10 }` = máximo 10 MB acumulados. El campo `message` es opcional y soporta `{{value}}`, `{{translations.*}}` e interpolación. |
| `maxFiles` | `{ value: number; message?: string }` | Máximo de ficheros selectables. Si se alcanza, el selector se deshabilita. El campo `message` es opcional y soporta `{{value}}`, `{{translations.*}}` e interpolación. |
| `validFileNames` | `{ value: string[]; message?: string }` | Ficheros cuyo nombre no coincide con ningún patrón regex se rechazan al seleccionar. Ej.: `{ value: ["^FACT_\\d{4}\\.pdf$"] }`. El campo `message` es opcional y soporta `{{translations.*}}` e interpolación. |

Validaciones implícitas adicionales:
- Fichero de 0 bytes: rechazado automáticamente al seleccionar.
- Nombre duplicado: rechazado si el nombre ya existe en la lista actual.

## Errores y visibilidad
- Si un campo visible requerido falla, el runtime escribe `Required` en `forms.{formId}.{fieldId}.error` y bloquea el submit.
- Si varias reglas fallan a la vez, el runtime escribe solo el mensaje de la primera regla fallida según el orden declarado en `props.validations`.
- Si un `select` simple o un `radioGroup` pierde la opción correspondiente a su valor almacenado tras cambiar la colección efectiva, el runtime limpia ese valor a `''` y reutiliza ese mismo estado vacío para render, `required` y submit.
- Si un `select.multiple` o un `checkboxGroup` pierde parte de sus opciones seleccionadas al cambiar la colección efectiva, el runtime elimina solo los valores ya inválidos y reutiliza la colección restante en render, validación y submit.
- Cuando un campo con error vuelve a editarse, el runtime reevalúa localmente sus reglas visibles y solo limpia el error cuando el valor actual deja de incumplir la primera regla fallida.
- Un campo oculto por `visibility` o `queryStateFeedback` no bloquea el submit (ver [[lifecycle.md#Campos ocultos]]) y además cualquier referencia a ese campo en el payload se omite del wire format al ejecutar el submit.

## Mensajes de error personalizados

Cada regla de validación puede declarar un campo `message` opcional que sustituye al mensaje por defecto del runtime. El mensaje se interpola antes de mostrarse:

- `{{value}}`: sustituido por el valor de la regla convertido a string. Si la regla no tiene un valor numérico significativo (ej. `required: { value: true }`), se interpola como string vacío.
- `{{translations.someKey}}`: resuelto mediante el catálogo de traducciones del proyecto, con fallback a clave literal en desarrollo / string vacío en producción.
- Cualquier otro placeholder no soportado (ej. `{{forms.someForm.someField}}`) se interpola como string vacío sin romper el resto del mensaje.

Si `message` no está declarado en una regla, el runtime muestra el mensaje por defecto:
- `required`: `"Required"`
- `minLength`: `"Must be at least N characters."`
- `maxLength`: `"Must be at most N characters."`
- `min`: `"Must be at least N."`
- `max`: `"Must be at most N."`
- `minSelections`: `"Select at least N options."`
- `maxSelections`: `"Select no more than N options."`
- `pattern`: `"Invalid format."`
- `email`: `"Invalid email address."`
- `url`: `"Invalid URL."`

Ejemplos:
```json
{
  "validations": {
    "minLength": { "value": 3, "message": "Mínimo {{value}} caracteres" },
    "required": { "value": true, "message": "Este campo es obligatorio" },
    "maxLength": { "value": 100, "message": "{{translations.max_length_error}}" }
  }
}
```

Casos límite:
- `message: ""` (string vacío): se muestra string vacío como error, no se usa el mensaje por defecto.
- `message: "{{value}}"` y `value: 0`: se interpola como `"0"` (el cero no se trata como vacío).
- `message: "{{value}} es requerido"` y `value: true`: se interpola como `" es requerido"` (boolean true produce string vacío).

## Validación condicional (`when`)

Cualquier regla de validación en su forma extendida (objeto con `value` y opcionalmente `message`) puede incluir un campo `when` que condiciona la evaluación de esa regla.

El shape de `when` es idéntico al shape de condición de `visibility`:
- `reference`: referencia runtime completa no vacía. Admite las mismas familias que `visibility`: `params.*`, `item.*`, `forms.*`, `queries.*`.
- `operator`: `equals | notEquals | isTruthy | isFalsy | greaterThan | lessThan`.
- `value`: obligatorio para `equals`, `notEquals`, `greaterThan`, `lessThan`; prohibido para `isTruthy`, `isFalsy`.

Comportamiento:
- Cuando `when` está presente y la condición se cumple, la regla se evalúa normalmente.
- Cuando `when` está presente y la condición no se cumple, la regla se omite como si no estuviera declarada.
- Cuando `when` no está presente, la regla se evalúa siempre (retrocompatibilidad).
- Si todas las reglas de un campo tienen `when` y ninguna condición se cumple, el campo pasa la validación como si no tuviera reglas.
- Una referencia válida pero ausente sigue la misma semántica que `visibility`: `isFalsy` la considera falsa, `isTruthy` no hace match, el resto de operadores no hace match.

La evaluación de `when` reutiliza la misma función de evaluación de condiciones que `visibility`, `submitAction.onSuccess[*].when`, `preloads[*].when` y `operations[*].when`.

Las formas cortas de las reglas no se modifican: `required: true` sigue funcionando sin `when`. Solo la forma extendida (`required: { value: true, when: {...} }`) admite condición.

`when` aplica a todas las reglas de validación: `required`, `minLength`, `maxLength`, `min`, `max`, `minSelections`, `maxSelections`, `pattern`, `email`, `url`.

Validación de shape de `when` en config:
- `when.reference` fuera del alcance soportado rechaza el config antes del render.
- `when.operator` fuera del catálogo rechaza el config.
- `when` con `isTruthy` o `isFalsy` y `value` declarado rechaza el config.
- `when` con `equals`, `notEquals`, `greaterThan` o `lessThan` y `value` omitido rechaza el config.
- `when` con `equals` o `notEquals` y `value` no escalar rechaza el config.
- `when` con `greaterThan` o `lessThan` y `value` no numérico rechaza el config.

## Qué no hace todavía
- No valida al cambiar de página ni por desmontaje del formulario.
- No rehidrata campos ni recalcula errores solo porque cambien `params.*`, `queries.*` o el catálogo dinámico de opciones mientras el formulario sigue montado.
- No expone un estado agregado de `isValid`, `isSubmitting` o `submitErrors` separado de `forms.*` y `queries.*`.
