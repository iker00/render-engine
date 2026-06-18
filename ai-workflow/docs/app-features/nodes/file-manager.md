> Cuándo leer: nodo `fileManager` para subir, visualizar, descargar y eliminar ficheros, zona DnD o selector nativo, operaciones configurables, validaciones client-side, paginación de lista.
> Tamaño: largo.
> Relacionados: [[../forms/validation-rules.md]], [[../references/query-state-feedback.md]], [[../references/visibility.md]], [[../queries/state-model.md]], [[../queries/execution.md]].

# `fileManager`

## Objetivo

Nodo standalone que permite subir ficheros mediante arrastrar-y-soltar (DnD) o selector nativo, visualizar la lista de ficheros subidos con paginación client-side, eliminarlos individualmente y verlos o descargarlos. Cada operación dispara una llamada API inmediata; el nodo no participa en el submit del formulario contenedor (es independiente tanto dentro como fuera de un `form`).

El nodo reemplaza el componente `FileUpload` existente adoptando su semántica API como convención por defecto y permitiendo sobrescribir cada operación con entradas del catálogo `api` declarativo del runtime.

## Contrato (props)

| Prop | Tipo | Default | Obligatorio | Descripción |
|---|---|---|---|---|
| `fieldName` | `string` | — | Condicional | Discriminador legacy (`upload_multiple_field_name`). Obligatorio si alguna operación está omitida o es `false`. |
| `fileField` | `string` | `"file"` | No | Nombre del campo en el FormData que lleva el binario del fichero. |
| `listPath` | `string` | `"files"` | No | Ruta dot-notation sobre la respuesta para llegar al array de ficheros. Ej.: `"data.files"` resuelve `response.data.files`. |
| `fileIdField` | `string` | `"id"` | No | Campo del objeto fichero que actúa como identificador único. |
| `fileNameField` | `string` | `"name"` | No | Campo del objeto fichero que se muestra como etiqueta en la lista. |
| `multiple` | `boolean` | `true` | No | Si `false`, solo se puede seleccionar o arrastrar un fichero a la vez. |
| `prefix` | `string` | — | No | Prefijo que se antepone al nombre del fichero antes de subir (`prefix_nombreOriginal`). |
| `acceptExtension` | `string[]` | — | No | Extensiones que se muestran como texto informativo en la zona DnD (ej.: `[".pdf", ".jpg"]` → "Formatos aceptados: .pdf, .jpg"). No bloquea la subida; es solo informativo. |
| `getOperation` | `string \| false` | omitida | No | Operación para obtener la lista de ficheros al montar. `string`: nombre de entrada en catálogo `api`. `false`: deshabilitada. Omitida: comportamiento legacy (requiere `fieldName`). |
| `uploadOperation` | `string \| false` | omitida | No | Operación para subir ficheros. Si `false`, zona DnD permanentemente deshabilitada. |
| `deleteOperation` | `string \| false` | omitida | No | Operación para borrar un fichero. Si `false`, sin botón de eliminar. |
| `viewOperation` | `string \| false` | omitida | No | Operación cuyo endpoint se usa para construir URL de visualización. Si `false`, sin botón Ver. |
| `downloadOperation` | `string \| false` | omitida | No | Operación cuyo endpoint se usa para construir URL de descarga. Si `false`, sin botón Descargar. |
| `validations.accept` | `string[]` | — | No | MIME types permitidos (ej.: `["application/pdf", "image/jpeg"]`). |
| `validations.maxFileSize` | `number` | — | No | Tamaño máximo por fichero en **MB** (ej.: `2` = 2 MB, `0.5` = 512 KB). |
| `validations.maxTotalSize` | `number` | — | No | Tamaño máximo acumulado del lote a subir en **MB**. |
| `validations.minFiles` | `number` | — | No | Mínimo de ficheros que deben estar subidos (informativo). |
| `validations.maxFiles` | `number` | — | No | Máximo de ficheros permitidos contando los ya presentes. |
| `validations.validFileNames` | `string[]` | — | No | Patrones regex. El nombre del fichero debe coincidir con al menos uno (ej.: `["^FACT_\\d{4}\\.pdf$"]`). |
| `pagination.pageSize` | `number` | `10` | No | Ítems por página en la lista. |

### Modelo de operaciones: `string | false | omitida`

Cada operación sigue el mismo contrato:

| Valor | Comportamiento |
|---|---|
| `string` | Usa la entrada con ese nombre del catálogo `api`. |
| `false` | Deshabilitada: sin botón ni llamada. |
| Omitida | Comportamiento legacy por defecto (requiere `fieldName`). |

`fieldName` es obligatorio si alguna operación está omitida. Si todas las operaciones están declaradas como `string` o `false`, `fieldName` no es necesario.

### Ejemplo de contrato JSON

```json
{
  "type": "fileManager",
  "props": {
    "fieldName": "documentos",
    "fileField": "file",
    "listPath": "files",
    "fileIdField": "id",
    "fileNameField": "name",
    "multiple": true,
    "prefix": "EXP",
    "acceptExtension": [".pdf", ".jpg"],
    "getOperation": "getDocuments",
    "uploadOperation": "uploadDocuments",
    "deleteOperation": "deleteDocument",
    "viewOperation": "viewDocument",
    "downloadOperation": false,
    "validations": {
      "accept": ["application/pdf", "image/jpeg"],
      "maxFileSize": 2,
      "maxTotalSize": 10,
      "minFiles": 0,
      "maxFiles": 10,
      "validFileNames": ["^FACT_\\d{4}_\\d{3}\\.pdf$"]
    },
    "pagination": {
      "pageSize": 5
    }
  }
}
```

## Reglas de render

### Inicialización

- Al montarse, si `getOperation` no es `false`, el nodo dispara esa operación y carga la lista desde `listPath` de la respuesta.
- Si `getOperation` es `false` o está omitida sin `fieldName`, el nodo arranca con lista vacía.
- Si `getOperation` falla, el nodo muestra error de carga; la zona DnD sigue disponible si `uploadOperation` está habilitada.
- El estado de `getOperation` se refleja en `queries.{getOperation}` y puede consumirse con `queryStateFeedback` en otros nodos.

### Zona DnD y selección

- El nodo renderiza una zona de arrastrar-y-soltar con indicador visual de estado: reposo, drag-over, subiendo, éxito, error.
- Ofrece un control alternativo (botón) para abrir el selector nativo de ficheros como fallback.
- Mientras hay una subida en curso, la zona DnD no acepta nuevos ficheros.
- Si `multiple: false`, solo se puede seleccionar un fichero a la vez.
- Si `uploadOperation` es `false`, la zona DnD se oculta de forma permanente.
- Si `validations.maxFiles` está configurado y la lista actual ya alcanza el límite, la zona DnD se deshabilita con mensaje informativo.
- La zona DnD expone atributos ARIA que identifiquen su rol y estado.

### Validaciones client-side (previas a la subida)

Las reglas de validación se evalúan mediante `runtime-form-validations`, extendido con tipos que operan sobre `File[]`. Este diseño permite que un futuro nodo `fileInput` reutilice las mismas reglas.

- `validations.accept`: ficheros con MIME type no incluido se rechazan con error inline.
- `validations.maxFileSize`: ficheros que superen el límite individual se rechazan con error inline.
- `validations.maxTotalSize`: si el lote supera el límite acumulado, se rechaza el lote completo con error inline.
- `validations.maxFiles`: si la suma de ficheros ya en lista y ficheros a subir supera el límite, el lote se rechaza con error inline.
- `validations.validFileNames`: ficheros cuyo nombre no coincide con ningún patrón regex se rechazan con error inline.
- Nombre duplicado: ficheros cuyo nombre ya existe en la lista actual se rechazan con error inline.
- Fichero de 0 bytes: se rechaza con error inline.
- Los ficheros rechazados **no llegan al servidor**.
- Los errores de validación desaparecen al intentar una nueva selección o drop.

### Normalización del nombre de fichero

Antes de subir, el nombre del fichero pasa por normalización:

1. Sustituye caracteres inválidos en Windows (`\ / : * ? " < > |`) por `_`.
2. Elimina espacios y puntos al final del nombre.
3. Renombra a `archivo_N` si el nombre coincide con un nombre reservado de Windows (CON, PRN, AUX, NUL, COM1–9, LPT1–9).
4. Trunca el nombre base para que `nombre + extensión ≤ 255 caracteres`.
5. Si `prefix` está configurado, antepone `prefix_` al nombre ya normalizado.

Ejemplo: `archivo_original.pdf` con `prefix: "EXP"` se envía como `EXP_archivo_original.pdf`.

### Subida secuencial

- Los ficheros que pasan todas las validaciones se suben de forma secuencial: una llamada a `uploadOperation` por fichero, en el orden seleccionado.
- El fichero viaja en el FormData bajo el campo `fileField`. Los campos declarados en `body` de la operación en catálogo `api` se añaden al mismo FormData como campos de texto.
- Durante la subida el nodo muestra una barra de progreso basada en conteo y un contador `subidos / total`. El progreso se calcula como `(ficheros completados / total a subir) * 100`.
- Tras cada llamada exitosa, la lista se actualiza con el array en `listPath` de la respuesta, y el contador y la barra avanzan.
- Si una llamada falla, la secuencia se detiene: los ficheros pendientes no se suben, se muestra error inline indicando qué fichero falló, y la barra queda en el progreso alcanzado.
- Al terminar la secuencia completa con éxito, la zona DnD muestra un mensaje de éxito con el número de ficheros subidos. Transcurridos unos segundos vuelve automáticamente al estado de reposo.
- El estado de `uploadOperation` se refleja en `queries.{uploadOperation}` y se sobreescribe con el resultado de cada llamada individual.

### Lista de ficheros

- La lista muestra cada fichero con el valor de `fileNameField` como etiqueta.
- Botones por fila según configuración: Ver (`viewOperation` no `false`), Descargar (`downloadOperation` no `false`), Eliminar (`deleteOperation` no `false`).
- Ver y Descargar son enlaces (`<a>`) cuya URL se construye desde el endpoint de la operación configurada con el identificador del fichero añadido como query param (`?{fileIdField}={fileId}`). No disparan una llamada fetch.
- La lista se pagina en cliente con `pagination.pageSize` ítems por página mediante controles `previousNext` (anterior/siguiente).
- Una lista vacía muestra un estado de vacío informativo.

### Borrado

- Al pulsar Eliminar, el nodo dispara `deleteOperation` pasando el identificador del fichero.
- Mientras se procesa el borrado, el botón de ese fichero queda deshabilitado; el resto de la lista sigue operativa.
- Si la respuesta contiene el array actualizado en `listPath`, la lista se reemplaza con ese array.
- Si `listPath` no resuelve en la respuesta de `deleteOperation`, el fichero se elimina optimistamente de la lista local.
- Si `deleteOperation` falla, el fichero permanece en lista con error inline.
- El estado se refleja en `queries.{deleteOperation}`.

### Independencia del submit del formulario

- El nodo `fileManager` **no escribe en `forms.*`**.
- Su estado interno no participa en el submit del formulario contenedor.
- Otros nodos pueden referenciar `queries.{operationName}.data.*` como cualquier otra referencia del runtime.

## Convención de respuesta

El nodo asume que las operaciones responden con el shape:

```json
{ "status": "OK", "files": [ { "id": 1, "name": "doc.pdf", "size": 204800 } ] }
{ "status": "ERROR", "message": "Descripción del error" }
```

`listPath`, `fileIdField` y `fileNameField` permiten adaptar este mapping cuando el backend usa nombres de campo distintos.

## Validación específica en bootstrap

- Si todas las operaciones están ausentes (omitidas o `false`) y no hay ninguna vía de interacción posible, la validación de bootstrap rechaza el nodo.
- Si `getOperation` está omitida sin `fieldName` declarado, la validación de bootstrap rechaza el nodo.
- Si `uploadOperation` está omitida sin `fieldName` declarado, la validación de bootstrap rechaza el nodo.
- Si alguna operación `string` apunta a una entrada inexistente en `api`, la validación de bootstrap rechaza el nodo.
- Si `fileManager` aparece dentro de un `form` como hijo directo de un container dentro de form, la validación de bootstrap lo rechaza (el nodo es standalone).
- Si `fieldName` se repite en dos instancias de `fileManager` diferentes, el config completo se rechaza.

## Integración transversal

- `fileManager` soporta `visibility` según la convención del runtime; permanece completamente oculto cuando la visibilidad lo ordena.
- Soporta `queryStateFeedback` para el estado de `getOperation` (loading, error, etc.).
- Soporta `layout.span` para ocupar columnas en un grid `container`.

## Casos límite y comportamiento especial

- `getOperation` omitida sin `fieldName` → validación de bootstrap rechaza el nodo.
- `getOperation` falla → error de carga; zona DnD disponible si `uploadOperation` habilitada.
- `listPath` no resuelve en respuesta de `uploadOperation` → error tipado, lista no se actualiza.
- Fallo a mitad de secuencia (ej.: 2 de 5 subidos) → los 3 restantes no se intentan; lista refleja los 2 subidos; error inline del fichero fallido.
- `deleteOperation` falla → fichero permanece en lista; error inline.
- `deleteOperation` responde sin `listPath` resoluble → borrado optimista de la lista local.
- Borrado mientras hay subida en curso → ambas operaciones conviven; el botón del fichero en borrado queda deshabilitado; la zona DnD queda deshabilitada hasta que termina la subida.
- `validations.maxFiles` alcanzado → zona DnD deshabilitada; al borrar un fichero, vuelve a habilitarse.
- Fichero de 0 bytes → rechazado por validación.
- Nombre duplicado → rechazado por validación.
- `multiple: false` con un fichero ya en lista → zona DnD deshabilitada.
- Todas las operaciones `false` → validación de bootstrap rechaza el nodo.
- `viewOperation` o `downloadOperation` omitidas con `fieldName` → URL de Ver/Descargar construida con la convención legacy.

## Fuera de alcance (v1)

- Subida por partes (chunked upload).
- Preview de imagen en miniatura.
- Reordenación de ficheros.
- Edición de metadatos tras la subida.
- Validaciones remotas de tipo o tamaño previas a la subida.
- Mensajes de validación personalizados por regla.
- Envío de ficheros desde `button.props.action` o `form.submitAction`; el submit del formulario no incluye ficheros.
- Theming o colores configurables desde JSON.
