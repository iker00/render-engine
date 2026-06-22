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
- un único mensaje visible por campo según la primera regla fallida en el orden declarado dentro de `props.validations`

## Qué valida realmente
- El runtime solo aplica validación declarativa local a nivel de formulario.
- La superficie declarativa vigente entra por `props.validations`; `props.required` ya no forma parte del contrato soportado.
- `required` conserva su semántica histórica, pero ahora vive dentro del mismo catálogo que el resto de reglas.
- No existe todavía validación remota, validación cruzada entre campos ni catálogo declarativo de mensajes personalizados efectivos en UI.
- La forma extendida de cada regla ya admite `message`, pero en esta iteración el runtime sigue mostrando mensajes por defecto.

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
- `select` simple y `radioGroup` `required` consideran inválido `''` aunque exista una opción placeholder visible en el caso de `select`.
- `select.multiple` y `checkboxGroup` `required` consideran inválido `[]`.
- `minLength` y `maxLength` solo aplican a `input` textuales y `textarea`, usando la longitud efectiva del string actual sin trim adicional.
- `min` y `max` solo aplican a `inputType: 'number'`, comparando contra el valor numérico efectivo del campo cuando existe.
- `minSelections` y `maxSelections` solo aplican a `select.multiple` y `checkboxGroup`, contando la selección efectiva después de normalizar el catálogo visible.

## Validaciones de ficheros (fileManager)

El nodo `fileManager` extiende `runtime-form-validations` con reglas específicas para ficheros `File[]` que se evalúan **previas a la subida**, con error inline en la zona DnD si alguna validación falla. Estas reglas **no escriben en `forms.*`**; el estado de error vive en el estado local del nodo.

| Regla | Aplica | Comportamiento |
|---|---|---|
| `accept` | `string[]` de MIME types | Ficheros con MIME type no incluido se rechazan. Ej.: `["application/pdf", "image/jpeg"]`. |
| `maxFileSize` | `number` en MB | Ficheros que superen el límite individual se rechazan. Ej.: `2` = máximo 2 MB por fichero. |
| `maxTotalSize` | `number` en MB | Si el lote total supera el límite, se rechaza el lote completo. Ej.: `10` = máximo 10 MB acumulados. |
| `minFiles` | `number` | Mínimo de ficheros que deben estar subidos (informativo; no bloquea submit del formulario contenedor). |
| `maxFiles` | `number` | Máximo de ficheros permitidos contando los ya presentes. Si se alcanza, la zona DnD se deshabilita. |
| `validFileNames` | `string[]` de regex | Ficheros cuyo nombre no coincide con ningún patrón regex se rechazan. Ej.: `["^FACT_\\d{4}\\.pdf$"]`. |

Validaciones implícitas adicionales:
- Fichero de 0 bytes: rechazado automáticamente.
- Nombre duplicado: rechazado si el nombre ya existe en la lista actual.

Los ficheros rechazados **no llegan al servidor**. Los errores desaparecen al intentar una nueva selección o drop.

## Errores y visibilidad
- Si un campo visible requerido falla, el runtime escribe `Required` en `forms.{formId}.{fieldId}.error` y bloquea el submit.
- Si varias reglas fallan a la vez, el runtime escribe solo el mensaje de la primera regla fallida según el orden declarado en `props.validations`.
- Si un `select` simple o un `radioGroup` pierde la opción correspondiente a su valor almacenado tras cambiar la colección efectiva, el runtime limpia ese valor a `''` y reutiliza ese mismo estado vacío para render, `required` y submit.
- Si un `select.multiple` o un `checkboxGroup` pierde parte de sus opciones seleccionadas al cambiar la colección efectiva, el runtime elimina solo los valores ya inválidos y reutiliza la colección restante en render, validación y submit.
- Cuando un campo con error vuelve a editarse, el runtime reevalúa localmente sus reglas visibles y solo limpia el error cuando el valor actual deja de incumplir la primera regla fallida.
- Un campo oculto por `visibility` o `queryStateFeedback` no bloquea el submit (ver [[lifecycle.md#Campos ocultos]]) y además cualquier referencia a ese campo en el payload se omite del wire format al ejecutar el submit.

## Qué no hace todavía
- No valida al cambiar de página ni por desmontaje del formulario.
- No rehidrata campos ni recalcula errores solo porque cambien `params.*`, `queries.*` o el catálogo dinámico de opciones mientras el formulario sigue montado.
- No expone un estado agregado de `isValid`, `isSubmitting` o `submitErrors` separado de `forms.*` y `queries.*`.
- No activa todavía `message` como copy visible personalizado por regla aunque el contrato ya reserve ese hueco.
