# Spec: 0076 — fileManager node

## Objetivo

Añadir un nuevo nodo `fileManager` al catálogo del runtime que permite subir ficheros mediante arrastrar-y-soltar (DnD) o selector nativo, visualizar la lista de ficheros subidos con paginación client-side, eliminarlos individualmente y verlos o descargarlos. Cada operación de subida o borrado dispara una llamada API inmediata; el submit del formulario contenedor queda limpio de ficheros.

El nodo reemplaza el componente `FileUpload` existente adoptando su semántica de API como convención por defecto y permitiendo sobrescribir cada operación con entradas del catálogo `api` declarativo del runtime.

## Alcance

- Nuevo nodo `fileManager` del catálogo; standalone, puede aparecer dentro o fuera de un `form`.
- Cinco operaciones configurables: `getOperation`, `uploadOperation`, `deleteOperation`, `viewOperation`, `downloadOperation`. Cada una puede ser un string (entrada del catálogo `api`), `false` (deshabilitada) u omitida (comportamiento legacy por defecto).
- Zona de arrastrar-y-soltar con selector nativo de ficheros como fallback.
- Barra de progreso basada en conteo de ficheros y contador `subidos / total`.
- Lista de ficheros subidos con paginación client-side (`previousNext`) y botones de acción por fila.
- Validaciones client-side previas a la subida declaradas bajo `props.validations`, evaluadas por `runtime-form-validations` extendido para `File[]`.
- Normalización del nombre de fichero antes de subir.
- Precarga opcional: `getOperation` obtiene los ficheros existentes al montar.
- Los ficheros se envían como `multipart/form-data`; ese mecanismo queda encapsulado en `src/queries/`.
- Integración transversal estándar: `visibility`, `queryStateFeedback`, `layout.span`.

## Fuera de alcance

- Subida por partes (chunked upload).
- Preview de imagen en miniatura.
- Reordenación de ficheros.
- Edición de metadatos tras la subida.
- Validaciones remotas de tipo o tamaño antes de subir.
- Mensajes de validación personalizados (se usarán mensajes genéricos por regla).
- Envío de ficheros desde `button.props.action` o `form.submitAction`; el submit del formulario no incluye ficheros.
- Theming o colores configurables desde JSON.

## Contrato JSON

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

### Operaciones: modelo `string | false | omitida`

Cada operación sigue el mismo contrato:

| Valor | Comportamiento |
|---|---|
| `string` | Usa la entrada con ese nombre del catálogo `api`. |
| `false` | Deshabilitada: sin botón ni llamada. |
| Omitida | Comportamiento legacy por defecto (requiere `fieldName`). |

`fieldName` es obligatorio si alguna operación está omitida. Si todas las operaciones están declaradas como `string` o `false`, `fieldName` no es necesario.

### Props

| Prop | Tipo | Default | Descripción |
|---|---|---|---|
| `fieldName` | `string` | — | Discriminador legacy (`upload_multiple_field_name`). Obligatorio si alguna operación está omitida. |
| `fileField` | `string` | `"file"` | Nombre del campo en el FormData que lleva el binario del fichero (`$_FILES['file']` en PHP, etc.). |
| `listPath` | `string` | `"files"` | Ruta dot-notation sobre `data` de la respuesta para llegar al array de ficheros. |
| `fileIdField` | `string` | `"id"` | Campo del objeto fichero que actúa como identificador. |
| `fileNameField` | `string` | `"name"` | Campo del objeto fichero que se muestra como etiqueta en la lista. |
| `multiple` | `boolean` | `true` | Si `false`, solo se puede seleccionar o arrastrar un fichero a la vez. |
| `prefix` | `string` | — | Prefijo que se antepone al nombre del fichero antes de subir (`prefix_nombreOriginal`). |
| `acceptExtension` | `string[]` | — | Extensiones que se muestran como texto informativo en la zona DnD en estado de reposo (ej.: `[".pdf", ".jpg"]` → "Formatos aceptados: .pdf, .jpg"). No bloquea la subida. El bloqueo real lo ejerce `validations.accept` con MIME types. |
| `getOperation` | `string \| false` | omitida | Operación para obtener la lista de ficheros al montar. |
| `uploadOperation` | `string \| false` | omitida | Operación para subir ficheros. Si `false`, zona DnD permanentemente deshabilitada. |
| `deleteOperation` | `string \| false` | omitida | Operación para borrar un fichero. Si `false`, sin botón de eliminar. |
| `viewOperation` | `string \| false` | omitida | Operación cuyo endpoint se usa para construir la URL de visualización. Si `false`, sin botón Ver. |
| `downloadOperation` | `string \| false` | omitida | Operación cuyo endpoint se usa para construir la URL de descarga. Si `false`, sin botón Descargar. |
| `validations.accept` | `string[]` | — | MIME types permitidos. |
| `validations.maxFileSize` | `number` | — | Tamaño máximo por fichero en **MB** (ej.: `2` = 2 MB, `0.5` = 512 KB). |
| `validations.maxTotalSize` | `number` | — | Tamaño máximo acumulado del lote a subir en **MB**. |
| `validations.minFiles` | `number` | — | Mínimo de ficheros que deben estar subidos (informativo). |
| `validations.maxFiles` | `number` | — | Máximo de ficheros permitidos contando los ya presentes. |
| `validations.validFileNames` | `string[]` | — | Patrones regex. El nombre del fichero debe coincidir con al menos uno. |
| `pagination.pageSize` | `number` | `10` | Ítems por página en la lista. |

La validación de bootstrap rechaza el nodo si todas las operaciones están ausentes (omitidas o `false`) y no hay ninguna vía de interacción posible.

### Convención de respuesta

El nodo asume que las operaciones `getOperation`, `uploadOperation` y `deleteOperation` responden con el shape:

```json
{ "status": "OK", "files": [ { "id": 1, "name": "doc.pdf", "size": 204800 } ] }
{ "status": "ERROR", "message": "Descripción del error" }
```

`listPath`, `fileIdField` y `fileNameField` permiten adaptar este mapping cuando el backend usa nombres de campo distintos.

## Requisitos funcionales

### Inicialización y estado de lista

- Al montarse, si `getOperation` no es `false`, el nodo lo dispara y carga la lista desde `listPath` de la respuesta.
- Si `getOperation` es `false` o está omitida sin `fieldName`, el nodo arranca con lista vacía.
- Si `getOperation` falla, el nodo muestra error de carga; la zona DnD sigue disponible si `uploadOperation` está habilitada.
- El estado de `getOperation` se refleja en `queries.{getOperation}` y puede consumirse con `queryStateFeedback` en otros nodos.

### Zona DnD y selección

- El nodo renderiza una zona de arrastrar-y-soltar con indicador visual de estado: reposo, drag-over, subiendo, éxito, error.
- El nodo ofrece también un control alternativo para abrir el selector nativo de ficheros.
- Mientras hay una subida en curso, la zona DnD no acepta nuevos ficheros.
- Si `multiple: false`, solo se puede seleccionar un fichero a la vez.
- Si `uploadOperation` es `false`, la zona DnD se oculta de forma permanente.
- Si `validations.maxFiles` está configurado y la lista actual ya alcanza el límite, la zona DnD se deshabilita con mensaje informativo.

### Validaciones client-side (previas a la subida)

Las reglas de validación se evalúan mediante `runtime-form-validations`, extendido con tipos de regla que operan sobre `File[]`. Este diseño permite que un futuro nodo `fileInput` reutilice las mismas reglas sin nueva superficie.

- `validations.accept`: ficheros con MIME type no incluido se rechazan con error inline.
- `validations.maxFileSize`: ficheros que superen el límite individual se rechazan con error inline.
- `validations.maxTotalSize`: si el lote supera el límite acumulado, se rechaza el lote completo con error inline.
- `validations.maxFiles`: si la suma de ficheros ya en lista y ficheros a subir supera el límite, el lote se rechaza con error inline.
- `validations.validFileNames`: ficheros cuyo nombre no coincide con ningún patrón regex se rechazan con error inline.
- Nombre duplicado: ficheros cuyo nombre ya existe en la lista actual se rechazan con error inline.
- Fichero de 0 bytes: se rechaza con error inline.
- Los ficheros rechazados no llegan al servidor.
- Los errores de validación desaparecen al intentar una nueva selección o drop.

### Normalización del nombre de fichero

Antes de subir, el nombre del fichero pasa por normalización:

1. Sustituye caracteres inválidos en Windows (`\ / : * ? " < > |`) por `_`.
2. Elimina espacios y puntos al final del nombre.
3. Renombra a `archivo_N` si el nombre coincide con un nombre reservado de Windows (CON, PRN, AUX, NUL, COM1–9, LPT1–9).
4. Trunca el nombre base para que `nombre + extensión ≤ 255 caracteres`.
5. Si `prefix` está configurado, antepone `prefix_` al nombre ya normalizado.

### Subida (uploadOperation)

- Los ficheros que pasan todas las validaciones se suben de forma secuencial: una llamada a `uploadOperation` por fichero, en el orden en que fueron seleccionados o arrastrados.
- El fichero viaja en el FormData bajo el campo `fileField`. Los campos declarados en `body` de la operación en el catálogo `api` se añaden al mismo FormData como campos de texto.
- Durante la subida el nodo muestra una barra de progreso basada en conteo y un contador `subidos / total`. El progreso se calcula como `(ficheros completados / total a subir) * 100`.
- Tras cada llamada exitosa, la lista se actualiza con el array en `listPath` de la respuesta, y el contador y la barra avanzan.
- Si una llamada falla, la secuencia se detiene: los ficheros pendientes no se suben, se muestra error inline indicando qué fichero falló, y la barra queda en el progreso alcanzado.
- Al terminar la secuencia completa con éxito, la zona DnD muestra un mensaje de éxito con el número de ficheros subidos. Transcurridos unos segundos vuelve automáticamente al estado de reposo.
- El estado de `uploadOperation` se refleja en `queries.{uploadOperation}` y se sobreescribe con el resultado de cada llamada individual.

### Lista de ficheros

- La lista muestra cada fichero con el valor de `fileNameField` como etiqueta.
- Botones por fila según configuración: Ver (`viewOperation` no `false`), Descargar (`downloadOperation` no `false`), Eliminar (`deleteOperation` no `false`).
- Ver y Descargar son enlaces (`<a>`) cuya URL se construye desde el endpoint de la operación configurada con el identificador del fichero añadido como query param (`?{fileIdField}={fileId}`). No disparan una llamada fetch.
- La lista se pagina en cliente con `pagination.pageSize` ítems por página mediante controles `previousNext`.
- Una lista vacía muestra un estado de vacío informativo.

### Borrado (deleteOperation)

- Al pulsar Eliminar, el nodo dispara `deleteOperation` pasando el identificador del fichero.
- Mientras se procesa el borrado, el botón de ese fichero queda deshabilitado; el resto de la lista sigue operativa.
- Si la respuesta contiene el array actualizado en `listPath`, la lista se reemplaza con ese array.
- Si `listPath` no resuelve en la respuesta de `deleteOperation`, el fichero se elimina optimistamente de la lista local.
- Si `deleteOperation` falla, el fichero permanece en lista con error inline.
- El estado se refleja en `queries.{deleteOperation}`.

### Independencia del submit del formulario

- El nodo `fileManager` no escribe en `forms.*`.
- Su estado interno no participa en el submit del formulario contenedor.
- Otros nodos pueden referenciar `queries.{operationName}.data.*` como cualquier otra referencia del runtime.

## Requisitos no funcionales

- El envío `multipart/form-data` está encapsulado en `src/queries/`; ningún componente visual construye `FormData` directamente.
- La zona DnD expone atributos ARIA que identifiquen su rol y estado.
- El input nativo de ficheros está accesible por teclado (Tab + Enter / Space).

## Criterios de aceptación

1. Al montar con `getOperation` habilitada, la lista muestra los ficheros devueltos en `listPath`.
2. Arrastrar ficheros válidos los sube secuencialmente, actualiza la barra y el contador tras cada uno, y actualiza la lista con la respuesta de cada llamada.
3. Ficheros rechazados por cualquier validación no llegan al servidor; error inline en la zona DnD.
4. El nombre del fichero se normaliza antes de subir; si `prefix` está configurado, se antepone.
5. La lista se pagina en cliente con `pageSize` ítems por página.
6. Los botones Ver, Descargar y Eliminar aparecen solo cuando su operación correspondiente no es `false`.
7. El botón Eliminar dispara la operación y actualiza o reduce la lista.
8. Si `validations.maxFiles` se alcanza, la zona DnD queda deshabilitada.
9. Al completar la subida con éxito, aparece mensaje de éxito en la zona DnD y desaparece automáticamente.
10. Si alguna operación está omitida sin `fieldName` declarado, la validación de bootstrap rechaza el nodo.
11. El submit del formulario contenedor no incluye ficheros.
12. `queries.{getOperation}`, `queries.{uploadOperation}` y `queries.{deleteOperation}` reflejan el estado de cada operación de forma independiente.

## Casos límite

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
- Fichero cuyo nombre no coincide con `validFileNames` → rechazado por validación.
- `multiple: false` y `maxFiles: 1` con un fichero ya en lista → zona DnD deshabilitada.
- Todas las operaciones `false` → validación de bootstrap rechaza el nodo.
- `viewOperation` o `downloadOperation` omitidas con `fieldName` → URL de Ver/Descargar construida con la convención legacy.

## Áreas de producto afectadas

- Catálogo de nodos: nuevo nodo `fileManager`.
- Capa de queries: extensión del request builder para `multipart/form-data`.
- Validación de formularios: extensión de `runtime-form-validations` con reglas `accept`, `maxFileSize`, `maxTotalSize`, `minFiles`, `maxFiles`, `validFileNames` que operan sobre `File[]`.
- Validación de bootstrap: nuevo esquema para `fileManager`.

## Documentación probablemente afectada

- `ai-workflow/docs/app-features/nodes/index.md`: entrada para `fileManager`.
- Nueva ficha `ai-workflow/docs/app-features/nodes/file-manager.md`.
- `ai-workflow/docs/app-features/forms/validation-rules.md`: nuevas reglas de fichero.
- `ai-workflow/docs/current-state.md`: área "Subida de archivos" pasa de "fuera de v1" a "estable".

## Riesgos y preguntas abiertas

- **Extensión del request builder para `File[]`**: la fachada `executeQueryOperation` actual no acepta binary payload; la estrategia de detección y construcción de `FormData` (incluyendo cómo se mezclan `fileField` con los campos de `body` de la operación) es una decisión de diseño no trivial. → `requires_design: true`.
- **Paso del identificador del fichero a `deleteOperation`**: el nodo construye el payload de borrado con el `fileIdField` del fichero; cómo se expone ese valor dinámico a la fachada de ejecución sin abrir referencias ad hoc es parte del diseño técnico.
- **URL de Ver/Descargar en modo api catalog**: cuando `viewOperation`/`downloadOperation` son strings, el nodo usa el endpoint de esa operación para construir la URL del enlace. La convención exacta de construcción (query params, path params) se define en diseño.
