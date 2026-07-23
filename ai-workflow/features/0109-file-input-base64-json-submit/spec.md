# Spec: `fileInput` — serialización JSON con base64 en submit

## Objetivo

Sustituir la serialización `multipart/form-data` de `fileInput` en el submit del formulario por serialización JSON,
donde cada fichero seleccionado viaja como un objeto `{ name, size, mime, data }` con `data` en base64. El campo
`fileInput` deja de tratarse como caso especial de payload y pasa a comportarse como cualquier otro campo del
formulario: solo se incluye en el body si se referencia explícitamente con `forms.{formId}.{fieldId}`.

## Alcance

- Nodo `fileInput` únicamente. `fileManager` (subida standalone fuera de formulario) no se toca: sigue enviando
  `multipart/form-data` por fichero contra sus operaciones configuradas, sin cambios.
- Sustitución total del mecanismo de envío: `fileInput` deja de usar `multipart/form-data` en cualquier caso. No se
  introduce un flag ni un modo configurable para elegir entre multipart y base64.
- La codificación a base64 ocurre **en submit**, no al seleccionar el fichero. `forms.{formId}.{fieldId}.value` sigue
  siendo `File[]` como hoy; la preview de imagen sigue usando `URL.createObjectURL` sobre esos `File` nativos, sin
  cambios.
- El objeto por fichero en el body tiene el shape:
  ```json
  { "name": "factura.pdf", "size": 20480, "mime": "application/pdf", "data": "JVBERi0xLjQKJ..." }
  ```
    - `name`: nombre original del fichero (`File.name`), sin normalización adicional.
    - `size`: tamaño en bytes (`File.size`).
    - `mime`: MIME type reportado por el navegador (`File.type`).
    - `data`: contenido del fichero codificado en base64 estándar, sin el prefijo `data:<mime>;base64,`.
- El valor de un campo `fileInput` referenciado en el body resuelve siempre a un **array** de estos objetos (uno por
  fichero seleccionado), independientemente de `props.multiple`. Esto preserva la consistencia con el shape `File[]` ya
  usado en estado.
- Un `fileInput` deja de incluirse automáticamente en el payload del formulario. Como cualquier otro campo, solo viaja
  en el request si `submitAction.body` o `api.body` lo referencia explícitamente con `forms.{formId}.{fieldId}`.
- Consecuencia directa: un formulario con `fileInput` ya no fuerza que **todo** el formulario cambie de formato de
  serialización. El body sigue siendo JSON siempre (o query params/GET, según la operación), igual que cualquier
  formulario sin ficheros.

## Fuera de alcance

- Cualquier cambio en `fileManager` (nodo standalone de subida inmediata).
- Modo configurable o flag para elegir entre `multipart/form-data` y JSON+base64 en `fileInput`.
- Compatibilidad retroactiva con backends que ya esperan `multipart/form-data` desde `fileInput` — este cambio rompe
  deliberadamente ese contrato.
- Cambios en las reglas de validación client-side (`required`, `accept`, `maxFileSize`, `maxTotalSize`, `minFiles`,
  `maxFiles`, `validFileNames`, 0 bytes, nombre duplicado). Siguen evaluándose al seleccionar, sobre los objetos `File`
  nativos, antes de cualquier codificación.
- Cambios en la preview (miniatura de imagen, lista con icono para el resto).
- Compresión, redimensionado o transformación del fichero antes de codificar.
- Subida por partes (chunked) o streaming del base64.
- Límites de tamaño de body HTTP del lado servidor: quedan fuera del control del frontend: el runtime ya valida tamaño
  de fichero en cliente vía `maxFileSize`/`maxTotalSize`, pero no valida el tamaño final del body HTTP tras la
  codificación base64.
- Normalización de nombre de fichero (la que sí aplica `fileManager` con `prefix` y reglas de caracteres inválidos no
  aplica a `fileInput`, igual que hoy).

## Requisitos funcionales

1. Al resolver el body/query de un submit, una referencia `forms.{formId}.{fieldId}` que apunte a un campo `fileInput`
   resuelve a un array de objetos `{ name, size, mime, data }`, uno por cada fichero seleccionado en ese campo.
2. Si el campo `fileInput` referenciado no tiene ficheros seleccionados, la referencia resuelve a un array vacío `[]`.
3. `data` contiene el base64 estándar del contenido binario del fichero, sin prefijo `data:mime;base64,`.
4. La codificación de los ficheros a base64 ocurre como parte de la construcción del request en el momento del submit,
   de forma asíncrona, antes de emitir la llamada de red.
5. Un `fileInput` que no está referenciado en `submitAction.body` ni `api.body` no aporta ninguna clave al payload del
   submit, igual que cualquier otro campo de formulario no referenciado.
6. El submit de un formulario con `fileInput` deja de forzar `Content-Type: multipart/form-data`. El request usa la
   serialización JSON habitual (`content-type: application/json`) o query params, según la operación — sin distinción
   por la presencia de ficheros.
7. Las reglas de validación de fichero (`accept`, `maxFileSize`, `maxTotalSize`, `maxFiles`, `validFileNames`, 0 bytes,
   nombre duplicado) se siguen evaluando al seleccionar, sin cambios de comportamiento ni de mensaje.
8. `required` y `minFiles` se siguen evaluando en submit sobre `forms.{formId}.{fieldId}.value` (`File[]`), sin cambios
   de comportamiento, con independencia de si el campo está referenciado en el body.
9. La preview (miniatura de imagen vía `URL.createObjectURL`, lista con icono para el resto) no cambia: sigue operando
   sobre los `File` nativos en estado, no sobre el base64.
10. `resetOnSuccess: true` sigue limpiando `forms.{formId}.{fieldId}.value` a `[]` tras submit exitoso, igual que hoy.
11. Un campo `fileInput` oculto por `visibility` en el momento del submit se omite del payload si está referenciado,
    siguiendo la misma semántica de omisión de campos ocultos ya vigente para el resto de campos del formulario (sin
    convertirse en error `request-build-failed`).
12. Si la codificación a base64 de algún fichero falla (error de lectura del navegador), el runtime trata el fallo como
    un fallo de construcción del request: la query correspondiente transita a `status: error` con
    `code: request-build-failed` y no se emite la llamada de red, siguiendo la semántica ya vigente para otros fallos de
    construcción de request.

## Requisitos no funcionales

- La composición del request (incluida la codificación de ficheros) se mantiene en `src/queries/`; los nodos visuales no
  construyen el body ni codifican ficheros por su cuenta.
- No se introduce ninguna dependencia externa nueva para la codificación base64; se usa la API nativa del navegador.
- El cambio no debe alterar el comportamiento de formularios sin `fileInput`, ni el de operaciones disparadas desde
  `button.props.action` (que no tienen semántica de omisión de campos ocultos).

## Criterios de aceptación

1. Un `fileInput` referenciado en `submitAction.body` con un fichero seleccionado envía, en el body JSON del submit, un
   array con un objeto `{ name, size, mime, data }` bajo esa clave.
2. Con `props.multiple: true` y varios ficheros seleccionados, el array contiene un objeto por fichero, en el mismo
   orden de selección.
3. `data` decodificado desde base64 reproduce exactamente el contenido binario original del fichero.
4. Un `fileInput` con ficheros seleccionados pero **sin** referencia en `submitAction.body`/`api.body` no aporta ninguna
   clave al payload; el request se serializa igual que si el campo no existiera.
5. El submit de un formulario con `fileInput` referenciado usa `content-type: application/json` (o el comportamiento
   habitual de la operación), nunca `multipart/form-data`.
6. Un fichero rechazado por `validations.accept`/`maxFileSize`/etc. al seleccionar no llega nunca al array serializado (
   se rechaza antes, como hoy).
7. Con `required: true` y ningún fichero seleccionado, el submit se bloquea con error inline, sin emitir red — igual que
   hoy, independientemente de si el campo está referenciado en el body.
8. Un `fileInput` referenciado pero oculto por `visibility` en el momento del submit se omite del payload sin producir
   `request-build-failed`.
9. `resetOnSuccess: true` limpia la selección tras un submit exitoso, igual que hoy.
10. Un formulario sin ningún `fileInput` referenciado mantiene exactamente el mismo comportamiento de submit que antes
    de esta feature (sin regresión).

## Casos límite

- `fileInput` referenciado con selección vacía (`[]`) y `required: false`: el body incluye un array vacío `[]` bajo esa
  clave, sin bloquear el submit.
- `props.multiple: false` con un fichero seleccionado: el body sigue enviando un array de un elemento, no el objeto
  suelto, por consistencia con el shape `File[]` de estado.
- Fichero de 0 bytes: sigue rechazado en selección por la validación implícita existente; nunca llega a codificarse.
- Fallo de lectura del navegador al codificar (`FileReader`/API de lectura falla): la query transita a `status: error`
  con `code: request-build-failed`, sin red emitida, igual que otros fallos de construcción de request.
- `fileInput` dentro de un `repeater`: fuera de alcance porque `fileInput` ya requiere estar dentro de un `form`, y la
  combinación `repeater` + `form` + `fileInput` no está soportada hoy (sin cambios introducidos por esta feature).
- Tamaño de body resultante: la codificación base64 incrementa el tamaño del payload en red respecto al binario
  original (~33%); las validaciones `maxFileSize`/`maxTotalSize` siguen operando sobre el tamaño real del fichero (
  `File.size`), no sobre el tamaño ya codificado.

## Áreas de producto afectadas

- **Submit de formulario**: cambio del mecanismo de serialización cuando el formulario contiene `fileInput`; elimina el
  caso especial multipart.
- **Composición de requests (`src/queries/`)**: la construcción del body para operaciones con referencias a `fileInput`
  incluye ahora un paso de codificación asíncrona.
- **Modelo de inclusión de campos en el body**: `fileInput` pasa a seguir la misma regla de referencia explícita que el
  resto de campos, dejando de ser un caso especial de inclusión automática.

## Documentación probablemente afectada

- `app-features/nodes/file-input.md` — sección "Integración con formulario": reemplazar la descripción de serialización
  multipart por el nuevo shape JSON+base64 y el modelo de referencia explícita.
- `app-features/forms/submit.md` — eliminar la sección "Serialización multipart/form-data" y documentar el nuevo
  comportamiento de `fileInput` como campo estándar referenciable.
- `current-state.md` — la fila "Subida de archivos" pasa a apuntar también a esta feature como última relevante para
  `fileInput` (sin cambiar el estado de `fileManager`).

## Riesgos o preguntas abiertas

- **Ruptura de contrato con backends existentes**: cualquier integración de backend ya construida contra el
  `multipart/form-data` actual de `fileInput` deja de funcionar tras este cambio, ya que no se mantiene compatibilidad
  ni modo dual. Es una decisión de producto ya asumida (sustitución total), no una duda técnica abierta; se deja
  constancia como riesgo de despliegue a coordinar con los equipos de backend consumidores antes de publicar la feature.
