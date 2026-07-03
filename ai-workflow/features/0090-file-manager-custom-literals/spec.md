# Spec: literales personalizables de `fileManager`

## Objetivo

Permitir que todos los textos visibles (y los aria-labels de accesibilidad) que hoy `fileManager` muestra en español de
forma fija puedan personalizarse por configuración JSON, admitiendo tanto un texto fijo como una referencia
`translations.*` del catálogo de traducciones del proyecto, siguiendo la misma convención de literales ya usada por el
resto del catálogo de nodos (`button.props.label`, `input.props.label`, etc.).

Adicionalmente, corrige una inconsistencia existente: los mensajes de validación propios de fichero (`accept`,
`maxFileSize`, `maxTotalSize`, `maxFiles`, `validFileNames`), compartidos por `fileManager` y `fileInput`, ya admiten un
campo `message` de override pero hoy no resuelven `{{translations.*}}` dentro de ese `message` como sí hace el resto de
reglas de formulario.

## Alcance

### 1. Nuevo bloque `props.labels` en `fileManager`

Se añade un bloque opcional `labels` a `props`, con una clave independiente por cada literal enumerado en la tabla de la
sección siguiente. Reglas generales:

- Todas las claves son opcionales de forma independiente. Si una clave se omite, se usa el texto por defecto actual (el
  mismo que produce el componente hoy, sin cambios).
- El valor de cada clave admite las mismas formas ya soportadas por el resto de superficies de texto del catálogo (
  `reference-resolution.md`, `dynamic-strings.md`):
    - string literal fijo,
    - referencia completa `translations.{key}`,
    - string con interpolación parcial que combine texto fijo y uno o varios placeholders `{{...}}` (incluyendo
      `{{translations.key}}`),
    - escape `\` para forzar que una referencia completa se trate como literal.
- Los literales con parte dinámica (contador, nombre de fichero, límites numéricos) exponen además placeholders propios
  de ese literal, resueltos con el mismo motor central de interpolación. Un placeholder no reconocido en ese literal
  concreto degrada a string vacío, igual que el resto de superficies visibles ya documentadas.
- Un `labels` mal formado (tipo incorrecto en alguna clave) se rechaza en la validación de bootstrap, igual que el resto
  de props tipadas de `fileManager`.

### 2. Catálogo de literales cubiertos

| Clave en `labels`                 | Texto por defecto actual                                                 | Placeholders disponibles                    | Dónde se muestra                                                                  |
|-----------------------------------|--------------------------------------------------------------------------|---------------------------------------------|-----------------------------------------------------------------------------------|
| `dropzoneIdle`                    | `Arrastra los ficheros aquí o haz clic para seleccionar`                 | —                                           | Zona DnD en reposo                                                                |
| `dropzoneAcceptedFormats`         | `Formatos aceptados: {formatos}`                                         | `{{formats}}`                               | Zona DnD en reposo, solo si `acceptExtension` está configurado                    |
| `dropzoneUploading`               | `Subiendo ficheros...`                                                   | —                                           | Zona DnD durante la subida                                                        |
| `dropzoneProgress`                | `{completado}/{total} — {porcentaje}%`                                   | `{{completed}}`, `{{total}}`, `{{percent}}` | Contador de progreso durante la subida                                            |
| `dropzoneSuccess`                 | `¡Ficheros subidos correctamente!`                                       | `{{count}}`                                 | Zona DnD al terminar la subida con éxito                                          |
| `dropzoneMaxFilesReached`         | `Límite alcanzado`                                                       | `{{max}}`                                   | Zona DnD cuando `validations.maxFiles` ya se alcanzó                              |
| `dropzoneAriaLabel`               | `Drop zone for {fieldName}`                                              | `{{fieldName}}`                             | aria-label de la zona DnD (hoy en inglés; se mantiene igual si no se personaliza) |
| `listLoadError`                   | `Error al cargar los ficheros.`                                          | —                                           | Lista, cuando `getOperation` falla                                                |
| `listEmpty`                       | `No hay ficheros subidos.`                                               | —                                           | Lista vacía                                                                       |
| `paginationPrevious`              | `Anterior`                                                               | —                                           | Control de paginación de la lista                                                 |
| `paginationNext`                  | `Siguiente`                                                              | —                                           | Control de paginación de la lista                                                 |
| `rowViewLabel`                    | `Ver`                                                                    | —                                           | Texto visible del enlace Ver                                                      |
| `rowViewAriaLabel`                | `Ver fichero`                                                            | —                                           | aria-label del enlace Ver, URL disponible                                         |
| `rowViewUnavailableAriaLabel`     | `Ver no disponible`                                                      | —                                           | aria-label del enlace Ver, URL no resoluble                                       |
| `rowDownloadLabel`                | `Descargar`                                                              | —                                           | Texto visible del enlace Descargar                                                |
| `rowDownloadAriaLabel`            | `Descargar fichero`                                                      | —                                           | aria-label del enlace Descargar, URL disponible                                   |
| `rowDownloadUnavailableAriaLabel` | `Descargar no disponible`                                                | —                                           | aria-label del enlace Descargar, URL no resoluble                                 |
| `rowDeleteLabel`                  | `Eliminar`                                                               | —                                           | Texto visible del botón Eliminar                                                  |
| `rowDeleteAriaLabel`              | `Eliminar fichero`                                                       | —                                           | aria-label del botón Eliminar                                                     |
| `uploadFileError`                 | `Error al subir "{nombre}".`                                             | `{{fileName}}`                              | Error inline, falla la subida de un fichero concreto                              |
| `uploadListPathMissing`           | `La respuesta de la subida no incluye la lista actualizada de ficheros.` | —                                           | Error inline, `listPath` no resuelve tras subir                                   |
| `deleteError`                     | `Error al eliminar el fichero.`                                          | —                                           | Error inline, falla `deleteOperation`                                             |

Este catálogo es el conjunto cerrado de literales personalizables para v1. Cualquier texto no listado aquí sigue fijo
tal como está hoy.

### 3. Corrección del mecanismo de mensajes de validación de fichero

Las reglas `accept`, `maxFileSize`, `maxTotalSize`, `maxFiles` y `validFileNames` de `props.validations` (compartidas
por `fileManager` y `fileInput`) ya admiten hoy un campo `message` que sustituye al mensaje por defecto de esa regla.
Esta feature corrige el mecanismo compartido de resolución de ese `message` para que soporte `{{translations.key}}`
exactamente igual que el resto de reglas de validación de campos de formulario estándar (`required`, `minLength`, etc.,
ver `validation-rules.md`), incluyendo el placeholder `{{value}}` ya soportado y el fallback dev/producción ya vigente
para claves de traducción ausentes.

Al ser una corrección del mecanismo compartido, el efecto aplica por igual a `fileManager` y a `fileInput`, no solo a
los literales nuevos de `labels`.

## Fuera de alcance

- Cambiar el texto compartido de paginación (`Anterior`/`Siguiente`) fuera de `fileManager`; en `table` y `repeater`
  sigue fijo tal como está hoy.
- Cualquier cambio de theming, color o estilo visual del componente.
- Corregir de oficio la inconsistencia idiomática del valor por defecto actual del aria-label de la zona DnD (hoy en
  inglés); el valor por defecto no cambia salvo que se declare `labels.dropzoneAriaLabel`.
- Selector de idioma en runtime; se sigue usando exclusivamente el mecanismo existente de `data-lang` en el elemento
  raíz.
- Nuevas reglas de validación de fichero o nuevos literales fuera del catálogo cerrado de la sección anterior.
- Personalizar literales de otros nodos del catálogo distintos de `fileManager` (más allá de la corrección transversal
  del mecanismo de mensajes descrita en el punto 3, que ya existía como mecanismo compartido).

## Requisitos funcionales

- `fileManager` acepta el bloque opcional `props.labels` con las claves del catálogo de la sección "Alcance".
- Cada clave de `labels` omitida produce exactamente el texto por defecto actual (sin regresión de comportamiento para
  configuraciones existentes que no declaren `labels`).
- Cada clave de `labels` declarada como string literal fijo se muestra tal cual, sin interpretarse como referencia salvo
  que cumpla la forma completa de referencia soportada.
- Cada clave de `labels` declarada como `translations.{key}` o con interpolación parcial `{{translations.key}}` resuelve
  el valor activo según la cadena de fallback ya vigente (idioma activo → `es` → clave literal en desarrollo / string
  vacío en producción).
- Los placeholders propios de cada literal dinámico (tabla) se resuelven con el valor real en el momento del render; un
  placeholder no reconocido para ese literal produce string vacío sin romper el resto del texto.
- Las reglas `accept`, `maxFileSize`, `maxTotalSize`, `maxFiles` y `validFileNames` de `validations` resuelven
  `{{translations.key}}` dentro de su `message` de override, tanto en `fileManager` como en `fileInput`.
- La validación de bootstrap rechaza el nodo si alguna clave de `labels` tiene un tipo distinto de string.

## Requisitos no funcionales

- No se introduce ninguna dependencia nueva; se reutiliza el motor de interpolación y resolución de referencias ya
  existente en `runtime-references/`.
- El coste de resolución de `labels` no debe introducir renders adicionales perceptibles frente al comportamiento actual
  del componente.
- Se mantiene el umbral mínimo global de cobertura del 80% sobre `src/`.

## Criterios de aceptación

- Con `labels` omitido por completo, el render de `fileManager` es idéntico al actual en todos sus textos y
  aria-labels (incluida la zona DnD, lista, paginación, filas y errores inline).
- Con una clave de `labels` declarada como texto fijo, ese texto sustituye exactamente al literal por defecto
  correspondiente, sin interpolación.
- Con una clave de `labels` declarada como `translations.saludo`, el texto mostrado cambia según `data-lang` del
  elemento raíz y sigue la cadena de fallback documentada.
- Con `labels.dropzoneProgress` personalizado usando `{{completed}}`, `{{total}}` y `{{percent}}`, el texto mostrado
  durante una subida en curso refleja los valores reales de esos tres placeholders.
- Con `labels.uploadFileError` personalizado usando `{{fileName}}`, el error inline de un fichero concreto que falla al
  subir muestra el nombre real de ese fichero.
- Con una regla de `validations.accept` (u otra de la lista) declarando `message: "{{translations.tipoNoValido}}"`, el
  mensaje de error inline resuelve el valor de esa clave de traducción en vez de mostrar el placeholder sin resolver.
- Un `labels` con una clave de tipo no string (por ejemplo, un número) hace que la validación de bootstrap rechace el
  config con un error localizable en `fileManager.props.labels.{clave}`.

## Casos límite

- `labels.<clave>: ""` (string vacío): se muestra string vacío para ese literal, sin caer al texto por defecto.
- Clave de `translations.*` ausente en el catálogo: sigue el fallback ya vigente (idioma activo → `es` → clave literal
  en desarrollo / string vacío en producción).
- Placeholder no soportado en un literal sin placeholders definidos (por ejemplo, `{{value}}` dentro de
  `labels.listEmpty`): se sustituye por string vacío, conservando el resto del texto literal.
- `labels.dropzoneAcceptedFormats` personalizado sin que `acceptExtension` esté configurado: el literal no se muestra
  igual que hoy (la condición de aparición no cambia, solo el texto cuando sí aparece).
- Cambio de `data-lang` en caliente con `labels` apuntando a `translations.*`: el texto se re-resuelve igual que
  cualquier otra referencia `translations.*` ya soportada en el runtime.
- `message` vacío (`""`) en una regla de validación de fichero: se mantiene el comportamiento ya vigente (se muestra
  string vacío, no el mensaje por defecto), ahora también resolviendo cualquier `{{translations.*}}` que pudiera
  contener antes de aplicarse ese caso.

## Riesgos o preguntas abiertas

Ninguna pregunta bloqueante pendiente tras la fase de aclaración. La decisión técnica sobre cómo extender el motor de
interpolación central para soportar placeholders nombrados por literal (más allá del `{{value}}` único ya existente) y
cómo unificar la resolución de `message` de fileManager/fileInput con la de campos estándar sin duplicar lógica se deja
para `design.md`, dado que admite más de una estrategia razonable y toca varias capas (`src/config/`,
`src/runtime/nodes/file-manager/`, `runtime-form-validations`, `runtime-references/`).
