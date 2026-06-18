# FileUpload — Documentación del componente

Componente React para subida de ficheros mediante arrastrar y soltar o selección desde el explorador. Incluye validación, paginación, soporte multiidioma y gestión de estado de subida.

---

## Tabla de contenidos

1. [Uso](#uso)
2. [Configuración (props)](#configuración-props)
3. [API — Llamadas al servidor](#api--llamadas-al-servidor)
4. [Validaciones](#validaciones)
5. [Arquitectura de componentes](#arquitectura-de-componentes)
6. [Hooks](#hooks)
7. [Traducciones](#traducciones)

---

## Uso

```jsx
import FileUpload from './src/components/file-upload/FileUpload.jsx'

<FileUpload initialConfig={{
    id: 'documentos',
    lang: 'es',
    accept: ['application/pdf', 'image/jpeg'],
    maxFiles: 5,
    totalFileSize: 10240,   // KB
    maxFileSize: 2048,      // KB por fichero
    regsXPage: 10,
    acceptExtension: ['.pdf', '.jpg'],
    validFileNamesMessage: ['FACT_2024_001.pdf', 'DOC_001.pdf'],
    validFileNames: ['^FACT_\\d{4}_\\d{3}\\.pdf$'],
    prefix: 'EXP',
}} />
```

---

## Configuración (props)

| Prop | Tipo | Obligatorio | Descripción |
|------|------|-------------|-------------|
| `id` | `string` | Sí | Nombre del campo. Se usa como `fieldName` en todas las peticiones al servidor |
| `lang` | `'es' \| 'eu'` | Sí | Idioma de la interfaz (castellano o euskera) |
| `accept` | `string[]` | No | MIME types permitidos, ej. `['application/pdf', 'image/png']` |
| `acceptExtension` | `string[]` | No | Extensiones mostradas en la zona de arrastre (solo informativo) |
| `maxFiles` | `number` | No | Número máximo de ficheros permitidos en total |
| `totalFileSize` | `number` | No | Tamaño máximo total en **KB** de todos los ficheros |
| `maxFileSize` | `number` | No | Tamaño máximo por fichero en **KB** |
| `regsXPage` | `number` | No | Registros por página en la lista de ficheros |
| `validFileNames` | `string[]` | No | Array de expresiones regulares. El nombre del fichero debe coincidir con al menos una |
| `validFileNamesMessage` | `string[]` | No | Ejemplos de nombres válidos mostrados al usuario en la zona de arrastre |
| `prefix` | `string` | No | Prefijo que se antepone al nombre del fichero antes de subirlo (`prefix_nombreOriginal`) |

---

## API — Llamadas al servidor

Todas las peticiones apuntan al endpoint `/subirFicheros.aspx`. La URL base se construye con `prepareUrl()`:

- **Desarrollo** (`NODE_ENV=development`): `http://localhost:3000`
- **Producción**: `{protocol}//{host}/{path-sin-ultimo-segmento}`

La constante `FILE_UPLOAD_URL` (en `src/constants/FileUploadConstants.js`) vale `/subirFicheros.aspx`.

---

### GET — Obtener ficheros existentes

Se lanza automáticamente al montar el componente para cargar los ficheros ya subidos.

```
GET /subirFicheros.aspx?upload_multiple_field_name={fieldName}
```

**Parámetros de query:**

| Parámetro | Valor |
|-----------|-------|
| `upload_multiple_field_name` | Valor de la prop `id` |

**Respuesta esperada:**

```json
{
  "status": "OK",
  "files": [
    { "id": 1748123456789, "name": "documento.pdf", "size": 1500000 },
    { "id": 1748123456790, "name": "imagen.jpg", "size": 305600 }
  ]
}
```

**En caso de error:**

```json
{
  "status": "ERROR",
  "message": "Descripción del error"
}
```

**Código que lo consume** — `src/hooks/useFileUpload.js:43-59`:

```js
const { status, files, message } = await getAllFiles(id)
if (status === RESPONSE_ERROR) {
    setErrors(message)
    return
}
setFiles(files)
```

---

### POST — Subir un fichero

Se llama una vez por cada fichero seleccionado, de forma **secuencial** (no en paralelo).

```
POST /subirFicheros.aspx
Content-Type: multipart/form-data
```

**Cuerpo (FormData):**

| Campo | Valor |
|-------|-------|
| `file` | El objeto `File` binario |
| `upload_multiple_field_name` | Valor de la prop `id` |

> El nombre del fichero se normaliza antes de enviarlo (ver [normalización de nombres](#normalización-de-nombres-de-fichero)).

**Respuesta esperada:**

```json
{
  "status": "OK",
  "message": "File uploaded successfully (simulated)",
  "file": { "id": 1748123456789, "name": "documento.pdf", "size": 204800 },
  "files": [ /* lista completa actualizada */ ]
}
```

**En caso de error:**

```json
{
  "status": "ERROR",
  "message": "Descripción del error"
}
```

**Código que lo consume** — `src/hooks/useFileUpload.js:160-175`:

```js
for (const file of uploadedFiles) {
    const newFile = new File([file], normalizeFileName(file.name, config.prefix ?? ''), { type: file.type })
    const response = await fileUpload(newFile, id)

    if (response.status === RESPONSE_OK) {
        setFiles(response.files)   // actualiza el estado con la lista completa
    } else {
        uploadingErrors.push(response.message)
    }
}
```

El estado de progreso se actualiza antes de cada subida individual:

```js
uploadingStatus.completed++
setUploading({ total, completed })
```

---

### POST — Eliminar un fichero

Se lanza al pulsar el botón "Eliminar" sobre un fichero de la lista.

```
POST /subirFicheros.aspx
Content-Type: multipart/form-data
```

**Cuerpo (FormData):**

| Campo | Valor |
|-------|-------|
| `upload_multiple_file_id` | `id` del fichero a eliminar |
| `upload_multiple_field_name` | Valor de la prop `id` |

**Respuesta esperada:**

```json
{
  "status": "OK",
  "message": "File deleted successfully",
  "files": [ /* lista completa sin el fichero eliminado */ ]
}
```

**En caso de error (fichero no encontrado):**

```json
{
  "status": "ERROR",
  "message": "File not found"
}
```

**Código que lo consume** — `src/hooks/useFileUpload.js:198-213`:

```js
const response = await fileDelete(fileId, id)

if (response.status === RESPONSE_ERROR) {
    setErrors([response.message])
    return
}

setFiles(response.files)
```

---

### GET — Construir URL de descarga/visualización

No es una petición en sí, sino la URL que se asigna a los botones "Ver" y "Descargar" del componente `File.jsx`.

```
GET /subirFicheros.aspx?upload_multiple_file_id={fileId}&upload_multiple_field_name={fieldName}
```

**Generada por** `getFileUrl(id, fieldName)` en `src/services/fileUploadsService.js:55-57`.

---

### Resumen de peticiones

| Acción | Método | Discriminante |
|--------|--------|---------------|
| Listar ficheros | `GET` | Query param `upload_multiple_field_name` |
| Subir fichero | `POST` | FormData contiene campo `file` |
| Eliminar fichero | `POST` | FormData contiene campo `upload_multiple_file_id` |
| Ver / Descargar | `GET` (enlace directo) | Query params `upload_multiple_file_id` + `upload_multiple_field_name` |

El servidor distingue subida de eliminación por la presencia del campo `file` o `upload_multiple_file_id` en el cuerpo de la petición POST.

---

## Validaciones

Las validaciones se ejecutan en el cliente **antes** de lanzar las peticiones. Los ficheros inválidos se excluyen de la subida; los válidos continúan.

### Validaciones globales (detienen toda la subida si fallan)

| Validación | Condición de error | Error mostrado |
|------------|--------------------|----------------|
| Máximo de ficheros | `(ficheros actuales + nuevos) > maxFiles` | `Se ha superado el número máximo de ficheros permitidos (N)` |
| Tamaño total | `(suma KB todos) > totalFileSize * 1024` | `El tamaño total de los ficheros no puede ser mayor de X` |

### Validaciones por fichero (excluyen el fichero concreto)

| Validación | Condición de error | Error mostrado |
|------------|--------------------|----------------|
| Nombre duplicado | Ya existe un fichero con el mismo nombre | `Ya se ha subido un fichero con el nombre "X"` |
| Tamaño máximo por fichero | `sizeToKb(file.size) > maxFileSize` | `El fichero X (Y) supera el tamaño permitido Z` |
| Fichero vacío | `sizeToKb(file.size) === 0` | `El fichero debe de tener más de 0 bytes` |
| Tipo MIME | `file.type` no está en `accept[]` | `El fichero X no es de un tipo válido` |
| Nombre con regex | El nombre no coincide con ningún patrón de `validFileNames[]` | `El nombre del fichero "X" no es válido` |

### Normalización de nombres de fichero

Antes de enviarse al servidor, el nombre pasa por `normalizeFileName(fileName, prefix)`:

1. Sustituye caracteres no válidos en Windows (`\ / : * ? " < > |`) por `_`
2. Elimina espacios y puntos finales
3. Antepone `prefix_` si se ha configurado la prop `prefix`
4. Renombra a `archivo_X` si el nombre coincide con un nombre reservado de Windows (CON, PRN, AUX, NUL, COM1-9, LPT1-9)
5. Trunca el nombre base para que `nombre + extensión ≤ 255 caracteres`

---

## Arquitectura de componentes

```
FileUpload
├── ErrorList          — lista de errores de validación / servidor
├── DragZone           — zona de arrastre y feedback visual
│   └── UploadingZone  — barra de progreso durante la subida
├── UploadedFilesTotals — contador de ficheros y tamaño total
├── FilesContainer     — lista paginada de ficheros
│   └── File           — fila individual con botones Ver / Descargar / Eliminar
└── Pagination         — controles de página
```

**Fichero de servicio:** `src/services/fileUploadsService.js`  
**Hook principal:** `src/hooks/useFileUpload.js`  
**Hook de paginación:** `src/hooks/usePagination.js`  
**Constantes:** `src/constants/FileUploadConstants.js`  
**Helpers:** `src/helpers/helpers.js`

---

## Hooks

### `useFileUpload(config)`

Gestiona todo el ciclo de vida de los ficheros.

**Estado que expone:**

| Estado | Tipo | Descripción |
|--------|------|-------------|
| `files` | `object[]` | Lista de ficheros subidos `{ id, name, size }` |
| `isUploading` | `boolean` | `true` mientras hay una subida en curso |
| `isHover` | `boolean` | `true` cuando se arrastra sobre la zona |
| `uploading` | `{ total, completed } \| null` | Progreso de la subida actual |
| `errors` | `string[]` | Mensajes de error acumulados |
| `showSuccess` | `boolean` | Visible 2 segundos tras subida correcta |
| `showError` | `boolean` | Visible 2 segundos si hubo errores |

**Flujo de `handleFileUpload`:**

```
evento (drop o input change)
    → extraer ficheros
    → validateFiles()
        → separar inválidos, acumular errores
    → subida secuencial de válidos
        → normalizeFileName()
        → fileUpload()  [POST]
        → actualizar files con la respuesta
    → mostrar éxito o error (auto-ocultar a los 2s)
```

### `usePagination(items, itemsPerPage)`

Calcula páginas y devuelve solo los ítems de la página actual. Se reajusta automáticamente si el total de ítems disminuye y la página actual queda fuera de rango.

---

## Traducciones

El componente soporta `es` (castellano) y `eu` (euskera) mediante el objeto `TRANSLATIONS` en `src/translations/translations.js`.

Los mensajes de error con variables se formatean con `sprintf` de la librería `sprintf-js`:

```js
sprintf(TRANSLATIONS[lang].errorMaxFiles, maxFiles)
// → "Se ha superado el número máximo de ficheros permitidos (5)"
```
