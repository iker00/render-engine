> Cuándo leer: nodo `fileInput`, selector de ficheros dentro de formulario, preview inmediata, validaciones client-side, serialización JSON+base64 en submit.
> Tamaño: medio.
> Relacionados: [[./form.md]], [[../forms/validation-rules.md]], [[../forms/submit.md]], [[../references/visibility.md]], [[../references/query-state-feedback.md]].

# `fileInput`

## Objetivo

Nodo de entrada de formulario que permite seleccionar uno o varios ficheros desde el dispositivo (incluida la cámara en móvil), previsualizar antes del submit y, si el campo está referenciado en el body de la operación de submit, enviarlos codificados en base64 dentro del JSON del payload. Soporta validaciones client-side de fichero (MIME type, tamaño, nombre) evaluadas inmediatamente al seleccionar, no en submit.

## Contrato (`props`)

| Prop | Tipo | Default | Obligatorio | Descripción |
|---|---|---|---|---|
| `fieldId` | string | — | **Sí** | Identificador único del campo dentro del formulario. Usado como clave en `forms.{formId}.{fieldId}` y como clave del array de ficheros en el body cuando el campo está referenciado. |
| `label` | string | — | **Sí** | Etiqueta del campo, literal, referencia dinámica o string visible interpolado. |
| `tooltip` | string | — | No | Texto de ayuda contextual, literal, referencia dinámica o string visible interpolado. Cuando resuelve a un string no vacío, se renderiza un icono de información (`HelpCircle`) junto al texto del label con un tooltip flotante accesible (hover y focus). Cuando está ausente o resuelve a vacío, no se renderiza nada adicional. |
| `multiple` | boolean | `true` | No | Si `false`, el selector limita la selección a un único fichero. |
| `capture` | `"environment" \| "user"` | — | No | Abre la cámara del dispositivo en móviles: `"environment"` (trasera) o `"user"` (frontal). Ignorado en desktop. Si declarado, `validations.accept` **debe** incluir al menos un MIME `image/*` o `video/*`. |
| `validations.required` | `boolean \| { value: boolean; message?: string }` | — | No | Al menos un fichero debe estar seleccionado al hacer submit. El campo `message` opcional soporta `{{translations.*}}` e interpolación. |
| `validations.accept` | `{ value: string[]; message?: string }` | — | No | MIME types permitidos (ej.: `{ value: ["image/jpeg", "image/png"] }`). Se aplica como atributo HTML `accept` y como regla de validación client-side. El campo `message` opcional soporta `{{translations.*}}` e interpolación. |
| `validations.maxFileSize` | `{ value: number; message?: string }` | — | No | Tamaño máximo por fichero en MB. El campo `message` opcional soporta `{{value}}`, `{{translations.*}}` e interpolación. |
| `validations.maxTotalSize` | `{ value: number; message?: string }` | — | No | Tamaño máximo acumulado del lote en MB. El campo `message` opcional soporta `{{value}}`, `{{translations.*}}` e interpolación. |
| `validations.minFiles` | `{ value: number; message?: string }` | — | No | Mínimo de ficheros que deben estar seleccionados para que el submit sea válido. El campo `message` opcional soporta `{{value}}`, `{{translations.*}}` e interpolación. |
| `validations.maxFiles` | `{ value: number; message?: string }` | — | No | Máximo de ficheros selectables. Si se alcanza, el selector queda deshabilitado. El campo `message` opcional soporta `{{value}}`, `{{translations.*}}` e interpolación. |
| `validations.validFileNames` | `{ value: string[]; message?: string }` | — | No | Patrones regex. El nombre del fichero debe coincidir con al menos uno. El campo `message` opcional soporta `{{translations.*}}` e interpolación. |

### Ejemplo de contrato JSON

```json
{
  "type": "fileInput",
  "props": {
    "fieldId": "documentos",
    "label": "Adjuntos requeridos",
    "multiple": true,
    "capture": "environment",
    "validations": {
      "required": { "value": true, "message": "Sube al menos un documento" },
      "accept": {
        "value": ["image/jpeg", "image/png", "application/pdf"],
        "message": "{{translations.accepted_formats}}"
      },
      "maxFileSize": { "value": 5, "message": "Máximo {{value}} MB por fichero" },
      "maxTotalSize": { "value": 20, "message": "Máximo 20 MB en total" },
      "maxFiles": { "value": 4, "message": "Máximo {{value}} ficheros" }
    }
  }
}
```

## Reglas de render

- `fileInput` renderiza un selector nativo de ficheros (`<input type="file">`) con atributos derivados de props.
- El selector incluye:
  - `multiple` cuando `props.multiple !== false` (default runtime `true`).
  - `capture` con el valor declarado (`"environment" | "user"`) cuando `props.capture` está declarado.
  - `accept` como string CSV con los MIME types cuando `props.validations.accept` está declarado (ej.: `"image/jpeg,image/png"`).
  - `disabled` cuando `props.validations.maxFiles` se alcanza (se rehabilita al eliminar un fichero).
- Tras seleccionar ficheros, el componente evalúa inmediatamente `props.validations` usando `evaluateFileManagerBatch`:
  - Rechaza ficheros que no pasen las reglas con mensaje inline por fichero.
  - Rechaza lotes completos si violan `maxTotalSize` o `maxFiles`.
  - Escribe el nuevo `value` (ficheros aceptados) en `forms.{formId}.{fieldId}.value` con `setFormFieldValue`.
  - Escribe el mensaje de error (si aplica) en `forms.{formId}.{fieldId}.error` con `setFormFieldError`.
- La preview aparece inmediatamente tras la selección:
  - **Imágenes** (`type` empieza por `image/`): miniatura visual usando `URL.createObjectURL`, revocada al desmontar o al actualizar la selección.
  - **Otros ficheros**: nombre + icono genérico de documento, sin imagen.
- El usuario puede eliminar ficheros de la lista antes del submit: actualiza `forms.{formId}.{fieldId}.value`.
- El nodo respeta `visibility`, `queryStateFeedback` y `layout.span` sin gestionar nada por su cuenta: el dispatcher central ya los aplica.
- El estilo usa exclusivamente utilidades Tailwind; no se introducen props visuales en JSON.

## Comportamiento por validación

- Las reglas de fichero (`accept`, `maxFileSize`, `maxTotalSize`, `maxFiles`, `validFileNames`) se evalúan **al seleccionar**, no en submit. Los ficheros que fallan se rechazan con error inline sin llegar al submit.
- Validaciones implícitas (sin prop):
  - Fichero de 0 bytes: rechazado automáticamente con error inline.
  - Nombre duplicado en la lista actual: rechazado automáticamente con error inline.
- `required` bloquea el submit si no hay ficheros seleccionados (semántica: `Array.isArray(value) && value.length > 0`).
- `minFiles` bloquea el submit si hay menos ficheros de los requeridos (ej.: `minFiles: 2` requiere ≥ 2 ficheros).

## Integración con formulario

- `fileInput` es descendiente válido de `form` (directo o anidado en containers dentro del form).
- Lee y escribe exclusivamente en `forms.{formId}.{fieldId}` con shape `File[]` (array de objetos File). La codificación a base64 ocurre en submit, no al seleccionar: la preview y el estado siguen operando sobre los `File` nativos sin cambios.
- `fileInput` se comporta como cualquier otro campo del formulario respecto a su inclusión en el payload: solo aporta clave al body si `submitAction.body`/`api.body` lo referencia explícitamente con `forms.{formId}.{fieldId}`. Un `fileInput` con ficheros seleccionados pero sin referencia no aporta ninguna clave, aunque el resto del formulario siga enviando con normalidad.
- Cuando la referencia está presente, resuelve siempre a un **array** de objetos `{ name, size, mime, data }` — uno por fichero seleccionado, en el mismo orden de selección — con independencia de `props.multiple`. Sin ficheros seleccionados, resuelve a `[]`.
  - `name`: `File.name` sin normalización adicional.
  - `size`: `File.size` en bytes.
  - `mime`: `File.type` reportado por el navegador (puede ser cadena vacía).
  - `data`: contenido binario del fichero en base64 estándar, sin el prefijo `data:<mime>;base64,`.
- El submit de un formulario con `fileInput` referenciado usa siempre la serialización habitual de la operación (`content-type: application/json` o query params, según corresponda) — nunca `multipart/form-data`. No existe modo dual ni flag para elegir el mecanismo de envío.
- La codificación a base64 ocurre de forma asíncrona como parte de la construcción del request en submit. Si la lectura de algún fichero falla en el navegador, la query transita a `status: error` con `code: request-build-failed` sin emitir la llamada de red, igual que otros fallos de construcción de request.
- `required` y `minFiles` se siguen evaluando en submit sobre `forms.{formId}.{fieldId}.value` (`File[]`), con independencia de si el campo está referenciado en el body.
- Un `fileInput` referenciado pero oculto por `visibility` en el momento del submit se omite del payload, siguiendo la misma semántica de omisión de campos ocultos ya vigente para el resto de campos.
- `resetOnSuccess: true` en el formulario limpia los ficheros seleccionados del campo (restaura `value: []`).
- Este comportamiento es exclusivo de `fileInput`. El nodo `fileManager` (subida standalone fuera de formulario) no se ve afectado: sigue enviando `multipart/form-data` contra sus operaciones configuradas.

## Validación específica

- Si `props.capture` está declarado y `props.validations.accept` no incluye ningún MIME que empiece por `image/` o `video/`, el config completo se rechaza antes del render con `code: 'invalid-layout'`.
- Si `fileInput` aparece fuera de un subárbol `form`, el config completo se rechaza antes del render.
- El `fieldId` debe ser único dentro del formulario contenedor (igual que `input`, `textarea`, `select`, etc.).

## Solo dentro de `form`

Si `fileInput` aparece fuera de un subárbol `form`, el config completo se rechaza antes del render con código `invalid-layout`.
