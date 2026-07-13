# Spec: `fileInput` — campo de ficheros en formulario

## Objetivo

Añadir un nodo `fileInput` al catálogo de formularios que permita al usuario seleccionar uno o varios ficheros desde el dispositivo (incluida la cámara en móvil), previsualizarlos antes del submit y enviarlos como parte del payload `multipart/form-data` del formulario.

## Alcance

### Contrato JSON

| Prop | Tipo | Default | Obligatorio | Descripción |
|---|---|---|---|---|
| `multiple` | `boolean` | `true` | No | Si `false`, el selector limita la selección a un único fichero. |
| `capture` | `"environment" \| "user"` | — | No | Abre la cámara trasera (`environment`) o frontal (`user`) en móviles compatibles en vez del selector de ficheros. Ignorado en desktop. |
| `validations.accept` | `string[]` | — | No | MIME types permitidos. Se aplica como atributo HTML `accept` al `<input>` y como regla de validación client-side. |
| `validations.maxFileSize` | `number` | — | No | Tamaño máximo por fichero en MB. |
| `validations.maxTotalSize` | `number` | — | No | Tamaño máximo acumulado del lote seleccionado en MB. |
| `validations.minFiles` | `number` | — | No | Mínimo de ficheros que deben estar seleccionados para que el submit sea válido. |
| `validations.maxFiles` | `number` | — | No | Máximo de ficheros seleccionables. Si se alcanza, el selector queda deshabilitado. |
| `validations.validFileNames` | `string[]` | — | No | Patrones regex; el nombre del fichero debe coincidir con al menos uno. |
| `validations.required` | `boolean \| { value: boolean; message?: string }` | — | No | Al menos un fichero debe estar seleccionado al hacer submit. |

Todas las reglas de `validations` admiten la forma extendida con `message` (feature `0086`): `{ value: ..., message: "..." }`.

### Ejemplo de contrato JSON

```json
{
  "type": "fileInput",
  "props": {
    "multiple": true,
    "capture": "environment",
    "validations": {
      "required": true,
      "accept": ["image/jpeg", "image/png"],
      "maxFileSize": 5,
      "maxTotalSize": 20,
      "maxFiles": 4,
      "validFileNames": ["^IMG_\\d+\\.jpg$"]
    }
  }
}
```

### Comportamiento de render

- Renderiza un selector nativo de ficheros (botón/click). Sin zona drag-and-drop.
- Si `capture` está declarado, el `<input>` recibe el atributo `capture` correspondiente.
- Si `validations.accept` está declarado, el `<input>` recibe el atributo `accept` con los MIME types como string separado por comas, además de usarse como regla de validación client-side.
- Tras la selección, muestra preview inmediata:
  - **Imágenes**: miniatura visual usando `URL.createObjectURL`.
  - **Otros tipos**: lista de nombres de fichero con icono genérico de documento.
- El usuario puede eliminar ficheros de la lista antes del submit.
- Si `multiple: false`, solo puede haber un fichero en la lista en todo momento.
- Si `validations.maxFiles` se alcanza, el selector queda deshabilitado hasta que se elimine algún fichero.

### Validaciones

- Las reglas de fichero (`accept`, `maxFileSize`, `maxTotalSize`, `minFiles`, `maxFiles`, `validFileNames`) se evalúan **inmediatamente al seleccionar** ficheros, mostrando error inline.
- `required` y `minFiles` participan en la validación de submit: bloquean el submit si no se cumple el mínimo de ficheros.
- Los ficheros que no pasan validación se rechazan de la lista con error inline sin llegar al submit.
- Validaciones implícitas adicionales (sin prop):
  - Fichero de 0 bytes: rechazado automáticamente.
  - Nombre duplicado en la lista actual: rechazado automáticamente.
- Las reglas de fichero reutilizan la infraestructura ya existente en `runtime-form-validations`.

### Integración con el formulario

- El campo escribe su estado en `forms.{formId}.{fieldId}`.
- El valor interno es `File[]` (objetos de fichero seleccionados).
- Al hacer submit, si el formulario contiene algún `fileInput` con al menos un fichero seleccionado, el payload se serializa como `multipart/form-data`. El `fieldId` del campo actúa como clave en el FormData.
- Los campos de texto del mismo formulario se incluyen como partes de texto del mismo FormData.
- Un formulario sin `fileInput` con valor sigue enviando el request con la serialización habitual (JSON o query params), sin regresión.
- `resetOnSuccess: true` en el formulario limpia los ficheros seleccionados del campo.

### Integración transversal

- Soporta `visibility`: cuando oculto, el campo no participa en validación ni en el payload del submit.
- Soporta `queryStateFeedback`.
- Soporta `layout.span`.

## Fuera de alcance

- Zona drag-and-drop.
- Subida de ficheros antes del submit (eager upload / Opción A).
- Gestión de ficheros ya subidos (lista, borrado, descarga, visualización) — eso es `fileManager`.
- Normalización de nombre de fichero y prefijos.
- Preview de PDFs u otros formatos no imagen.
- Subida por partes (chunked upload).
- Validaciones remotas previas al submit.
- Theming configurable del campo desde JSON.

## Requisitos funcionales

1. El nodo `fileInput` solo puede declararse como campo dentro de un `form` (directo o anidado en containers dentro del form).
2. El selector nativo permite seleccionar uno o varios ficheros según `multiple`.
3. Si `capture` está declarado, el `<input>` recibe el atributo correspondiente; en dispositivos compatibles abre la cámara directamente.
4. `validations.accept` filtra el selector del sistema operativo mediante el atributo HTML `accept` Y valida los ficheros seleccionados en cliente.
5. Las validaciones de fichero se evalúan al seleccionar; los ficheros que fallan se rechazan con mensaje inline sin llegar al submit.
6. La preview aparece inmediatamente tras la selección: miniatura para imágenes, lista con icono y nombre para el resto.
7. El usuario puede eliminar ficheros de la lista antes del submit.
8. Al hacer submit con ficheros seleccionados, el payload se envía como `multipart/form-data` con los ficheros bajo el `fieldId` del campo.
9. Los campos de texto del mismo formulario se incluyen en el mismo FormData como partes de texto.
10. `required` bloquea el submit si no hay ficheros seleccionados.
11. `resetOnSuccess` limpia la selección del campo tras submit exitoso.

## Requisitos no funcionales

- Reutilizar las reglas de validación de fichero ya implementadas en `runtime-form-validations` sin duplicarlas.
- La preview de imágenes usa `URL.createObjectURL` con revocación adecuada al desmontar o al cambiar la selección, para evitar memory leaks.
- El cambio de serialización del submit a multipart no debe afectar a formularios sin `fileInput` con valor.

## Criterios de aceptación

1. Un `fileInput` dentro de un `form` renderiza un selector nativo de ficheros.
2. Al seleccionar una imagen aparece miniatura; al seleccionar otro tipo de fichero aparece su nombre en lista.
3. Un fichero con MIME type no incluido en `validations.accept` se rechaza con error inline antes del submit.
4. Un fichero que supera `maxFileSize` se rechaza con error inline antes del submit.
5. Al hacer submit de un formulario con `fileInput` con valor, la request se envía como `multipart/form-data` con el fichero bajo el `fieldId` del campo.
6. Los campos de texto del mismo formulario van como partes de texto del mismo FormData.
7. Con `required`, si no hay ficheros seleccionados al hacer submit, el submit no se emite y se muestra error inline.
8. Con `capture: "environment"`, en móvil el `<input>` recibe `capture="environment"` y abre la cámara directamente.
9. Con `capture` declarado y `validations.accept` sin ningún MIME de imagen o vídeo, la validación de bootstrap rechaza el nodo con diagnóstico claro.
10. `resetOnSuccess: true` limpia los ficheros seleccionados tras submit exitoso.
11. Un formulario sin `fileInput` (o con todos sus `fileInput` vacíos) sigue enviando la request con la serialización habitual, sin regresión.
12. El campo oculto por `visibility` no participa en la validación ni en el payload del submit.

## Casos límite

- `multiple: false` con fichero ya en lista: al abrir el selector y elegir otro, el fichero anterior se reemplaza.
- `capture` en desktop: ignorado; el input funciona como selector normal.
- `capture: "environment"` + `multiple: true`: muchos navegadores móviles limitan la captura a un único fichero aunque `multiple` esté activo. Comportamiento dependiente del navegador; documentado como limitación conocida, sin polyfill.
- Fichero de 0 bytes: rechazado automáticamente con error inline.
- Nombre duplicado en la lista: rechazado automáticamente con error inline.
- `validations.maxFiles` alcanzado: selector deshabilitado; al eliminar un fichero de la lista vuelve a habilitarse.
- `fileInput` con `visibility` oculto al hacer submit: campo omitido del payload por completo.
- Formulario con `fileInput` sin ficheros seleccionados y `required: false` al hacer submit: el campo no aporta entrada al FormData; si ningún otro `fileInput` del formulario tiene ficheros, el submit usa la serialización habitual.

## Áreas de producto afectadas

- **Catálogo de nodos de formulario**: `fileInput` como nuevo tipo de campo.
- **Validación de formularios**: reutilización de reglas de fichero en contexto de campo de formulario que participa en submit.
- **Submit de formulario**: cambio de serialización a multipart cuando hay `fileInput` con valor.
- **Validación de bootstrap**: nuevas reglas para `fileInput` y para la combinación `capture` + `accept`.

## Documentación probablemente afectada

- `app-features/nodes/` — nueva ficha `file-input.md`
- `app-features/forms/validation-rules.md` — extensión con reglas de fichero para `fileInput`
- `app-features/forms/submit.md` — comportamiento multipart
- `current-state.md` — actualizar área de formularios y subida de archivos

## Riesgos o preguntas abiertas

- **Serialización multipart en el submit**: el mecanismo exacto por el que el runtime detecta campos `fileInput` con valor y cambia la serialización es la decisión técnica más relevante de esta feature. Afecta a `src/queries/` (construcción del request) y a la capa de submit del runtime. Requiere diseño explícito antes de planificar. → `requires_design: true`
- **Limitación de `capture` + `multiple`**: comportamiento variable entre navegadores móviles; documentado como limitación conocida.
