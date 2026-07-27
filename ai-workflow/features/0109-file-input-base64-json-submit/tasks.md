# Plan de implementación — Feature 0109

## Orden de ejecución
1. T1 — Codificador base64 de `File` aislado en `src/queries/`
2. T2 — Overrides de valor por referencia en el resolver del body
3. T3 — Preflight de codificación en el executor + wiring en `runtime-state-provider.executeQueryOperation`
4. T4 — `form-layout-node` deja de emitir `multipart/form-data` desde `fileInput` y pasa a alimentar el nuevo canal

Cada tarea debe completarse con sus tests en verde antes de empezar la siguiente. Ninguna tarea es puramente documental; la actualización de fichas de producto se hace después con `update-app-documentation` sobre `documentación afectada`.

---

## T1 — Codificador base64 de `File` aislado en `src/queries/`

### Estado
Completada

### Objetivo
Añadir una función pura y asíncrona en `src/queries/` que reciba un `File` del navegador y devuelva el objeto `{ name, size, mime, data }` requerido por el nuevo shape del body, con `data` en base64 estándar sin el prefijo `data:<mime>;base64,`. La función debe operar exclusivamente con la API nativa (`FileReader` o `Blob.arrayBuffer` + `btoa`), sin dependencias externas nuevas, y modelar el fallo de lectura del navegador como un resultado tipado `{ status: 'error' }` en vez de propagar la excepción, para que el executor pueda mapearlo a `request-build-failed` en T3.

### Fuera de alcance
- Cualquier consumo desde el executor, el resolver, el nodo `form` o `fileInput` (T2–T4).
- Cambios en `RuntimeApiBodyValue` u otros tipos públicos del contrato de request.
- Compresión, redimensionado o transformación del contenido del fichero.
- Chunking, streaming o cualquier estrategia distinta de "un `File` → una cadena base64".

### Dependencias
Ninguna.

### Impacto esperado en archivos
- Código a crear:
  - `src/queries/runtime-file-base64-encoder.ts` — expone `encodeFileToBase64Entry(file: File): Promise<{ status: 'ready'; entry: { name: string; size: number; mime: string; data: string } } | { status: 'error' }>` y, si conviene, `encodeFilesToBase64Entries(files: readonly File[]): Promise<{ status: 'ready'; entries: Array<...> } | { status: 'error' }>` como envoltorio en paralelo. La implementación debe:
    - preservar `File.name` sin normalización adicional,
    - preservar `File.size` como número entero de bytes,
    - preservar `File.type` en el campo `mime` (puede ser cadena vacía si el navegador no lo reporta),
    - producir `data` con la codificación base64 estándar del contenido binario, sin el prefijo `data:<mime>;base64,` y sin saltos de línea,
    - capturar cualquier excepción del navegador (fallo de `FileReader`/`arrayBuffer`) y devolver `{ status: 'error' }` sin `throw`.
- Tests a crear:
  - `src/tests/runtime/runtime-file-base64-encoder.test.ts` (nuevo).
- Documentación afectada (referencia para pasadas posteriores):
  - Ninguna en esta tarea. La documentación funcional se toca al alcanzar el nuevo contrato observable en T4.

### Tests

**Ficheros de test**
- `src/tests/runtime/runtime-file-base64-encoder.test.ts` (nuevo)

**Comportamiento cubierto**
- Un `File` con contenido conocido (por ejemplo `new File([bytes], 'a.bin', { type: 'application/octet-stream' })`) produce `{ status: 'ready', entry }` con `entry.name === 'a.bin'`, `entry.size === bytes.length`, `entry.mime === 'application/octet-stream'` y `entry.data` igual a la codificación base64 estándar de `bytes`, sin el prefijo `data:<mime>;base64,`.
- Decodificar `entry.data` desde base64 reproduce byte a byte el contenido original del `File`.
- Un `File` con `type: ''` produce `entry.mime === ''` sin fallar.
- Un `File` de 0 bytes produce `entry.size === 0` y `entry.data === ''`.
- Un `File` cuya lectura falla (simulado forzando `FileReader.readAsDataURL`/`Blob.arrayBuffer` a rechazar) produce `{ status: 'error' }` sin lanzar excepción al caller.
- Si se expone un envoltorio en paralelo, el fallo de codificación de un elemento del array produce `{ status: 'error' }` global y no deja resultados parciales.

**Comandos durante la implementación**
- `pnpm test --run src/tests/runtime/runtime-file-base64-encoder.test.ts`

**Restricciones**
- No introducir dependencias externas nuevas: usar exclusivamente la API nativa del navegador.
- No exportar la implementación interna (helper que recorta el prefijo `data:mime;base64,`, etc.) más allá de lo estrictamente necesario para el test.
- No mezclar en este módulo lógica de request-building, de resolución de referencias, ni de estado del formulario.

### Criterios de finalización
- El módulo existe, expone la función asíncrona pura con el contrato anterior y está aislado del resto de `src/queries/`.
- Todos los tests declarados arriba pasan en verde.
- La ejecución de `pnpm test` no rompe el umbral global de cobertura (`ai-workflow/standards/testing-rules.md`).

### Cierre de implementación
Código y tests de la tarea completos y validados. `implementation.completed_task_ids` en `status.yaml` incluye `T1`.

---

## T2 — Overrides de valor por referencia en el resolver del body

### Estado
Completada

### Objetivo
Extender el resolver del body de `src/queries/runtime-api-payload-resolver.ts` para aceptar un mapa opcional de "overrides por referencia" que sustituya el valor resuelto de una referencia `forms.{formId}.{fieldId}` por un array precomputado (el array `{ name, size, mime, data }[]` que producirá el preflight en T3). La firma pública de `resolveBody` debe seguir siendo compatible: cuando el mapa esté ausente o no contenga la clave, el comportamiento actual no cambia.

Esta tarea no introduce todavía ningún camino que rellene ese mapa; sólo prepara la superficie del resolver para que T3 lo utilice sin tocar de nuevo esta capa.

### Fuera de alcance
- Codificación real de ficheros (T1).
- Preflight asíncrono en el executor y wiring desde el provider (T3).
- Cambios en el resolver de query, headers o endpoint: el nuevo shape es únicamente body.
- Cambios en la política de omisión de campos ocultos ya vigente (`hiddenFormFields`): sigue teniendo prioridad sobre el override.

### Dependencias
Ninguna. T1 y T2 pueden implementarse en paralelo, pero se ejecutan de forma secuencial para simplificar la revisión.

### Impacto esperado en archivos
- Código a modificar:
  - `src/queries/runtime-api-payload-resolver.ts` — añadir un parámetro opcional `fileValueOverrides?: ReadonlyMap<string, RuntimeApiBodyValue[]>` al mismo `ResolvePayloadValueOptions` que ya viaja por todo el resolver. La clave del mapa es `${formId}.${fieldId}`. La lógica de sustitución debe aplicarse dentro de `resolveJsonPayloadValue` en la rama de string:
    - resolver la referencia con el resolver de referencias ya usado hoy;
    - si la referencia está en `hiddenFormFields`, seguir devolviendo `{ status: 'omit' }` como hoy (la omisión tiene prioridad sobre el override);
    - si `fileValueOverrides` está definido y contiene la clave `"${formId}.${fieldId}"` para una referencia `forms.{formId}.{fieldId}` completa (sin sufijos ni interpolación), devolver `{ status: 'ready', value: overrides.get(key) }`;
    - en cualquier otro caso, mantener el flujo actual sin regresión.
  - `src/queries/runtime-api-request.ts` — propagar el nuevo campo desde `BuildRuntimeApiRequestOptions`/`BuildInlineRuntimeApiRequestOptions` hasta las llamadas a `resolveBody`. No aplicar el override en `resolveHeaders`, `resolveQuery` ni `resolveEndpoint`.
  - `src/queries/runtime-api-types.ts` — extender `BuildRuntimeApiRequestOptions` y `BuildInlineRuntimeApiRequestOptions` con `fileValueOverrides?: ReadonlyMap<string, RuntimeApiBodyValue[]>`.
- Tests a crear:
  - `src/tests/runtime/runtime-api-payload-file-overrides.test.ts` (nuevo).
- Documentación afectada (referencia para pasadas posteriores):
  - Ninguna en esta tarea.

### Tests

**Ficheros de test**
- `src/tests/runtime/runtime-api-payload-file-overrides.test.ts` (nuevo)

**Comportamiento cubierto**
- Con `fileValueOverrides` no definido, un body que no referencia campos de fichero se serializa exactamente como hoy (regresión).
- Con `fileValueOverrides` definido pero sin la clave `"formId.fieldId"` presente en el body, el body se serializa exactamente como hoy (regresión).
- Con `fileValueOverrides` que contiene `"uploadForm.photos" → [{name,size,mime,data}, ...]` y un body `{ files: "forms.uploadForm.photos" }`, `resolveBody` devuelve `{ status: 'ready', body: { files: [{name,size,mime,data}, ...] } }` con el array literalmente igual al del override.
- El mismo override aplicado con `fileValueOverrides` produce un array vacío `[]` cuando el mapa asocia la clave a `[]` (caso "campo referenciado, selección vacía").
- Cuando la misma referencia aparece en varias claves del body, el override se aplica en cada aparición, sin duplicación ni mutación del array del mapa.
- Cuando `hiddenFormFields` incluye el fieldId y a la vez `fileValueOverrides` tiene la clave, la omisión por campo oculto tiene prioridad: `resolveBody` omite la clave del body y no inserta el array del override.
- Una referencia parcial (por ejemplo interpolada dentro de un string más largo como `"prefix-{{forms.uploadForm.photos}}"`, o una referencia con más niveles como `forms.uploadForm.photos.0.name`) no consume el override y sigue produciendo el error actual (`{status:'error'}`) al no ser convertible a scalar; el override sólo casa con la referencia string completa `forms.{formId}.{fieldId}` sin sufijo.
- El resolver de headers, query y endpoint no aplica el override: una referencia `forms.uploadForm.photos` en `query.foo` o `headers.X-Photos` sigue produciendo el error actual (no se convierte silenciosamente en array).
- La firma pública de `resolveBody` es compatible: los tests existentes de body sin overrides siguen pasando sin cambios.

**Comandos durante la implementación**
- `pnpm test --run src/tests/runtime/runtime-api-payload-file-overrides.test.ts`
- `pnpm test --run src/tests/runtime/runtime-api-execution.test.ts`
- `pnpm test --run src/tests/runtime/runtime-api-multipart.test.ts`

**Restricciones**
- No cambiar la semántica actual de `resolvePayloadValue` para escalares: el override sólo debe intervenir dentro del recorrido de `resolveJsonPayloadValue` para el body.
- El override no debe aplicarse a placeholders interpolados dentro de un string mayor ni a referencias con sufijos: sólo a la referencia completa `forms.{formId}.{fieldId}`.
- No introducir efectos secundarios: el mapa se lee, no se muta.

### Criterios de finalización
- El resolver del body acepta el nuevo canal opcional y lo aplica exclusivamente en la rama string completa `forms.{formId}.{fieldId}`.
- Los tests existentes de body, headers, query y endpoint siguen pasando sin cambios (no se rompe ningún caso).
- Todos los tests declarados arriba pasan en verde.
- `pnpm test` no rompe el umbral global de cobertura.

### Cierre de implementación
Código y tests de la tarea completos y validados. `implementation.completed_task_ids` en `status.yaml` incluye `T2`.

---

## T3 — Preflight de codificación en el executor + wiring en `runtime-state-provider.executeQueryOperation`

### Estado
Completada

### Objetivo
Introducir un paso asíncrono de preflight en `executeRuntimeApiOperation` y `executeInlineRuntimeApiOperation` que reciba un canal nuevo `fileInputSources`, codifique cada `File[]` a base64 usando el módulo de T1 y construya el `fileValueOverrides` de T2 antes de invocar `buildRuntimeApiRequest`. El fallo de codificación de cualquier fichero debe transitar la query a `status: error` con `code: 'request-build-failed'` sin emitir la llamada de red, siguiendo la semántica ya vigente para otros fallos de construcción de request.

Como parte de la misma capa, extender `runtime-state-provider.executeQueryOperation` para aceptar `fileInputSources` en sus `options` y propagarlo hasta el executor a través de `executeQueryOperationWithSnapshot`. No es necesario tocar `executeInlineQueryOperation` en esta tarea salvo que la firma común lo obligue; si no lo obliga, dejarlo intacto.

### Fuera de alcance
- Consumo real del canal desde el nodo `form` (T4). En esta tarea el canal existe y funciona, pero nadie lo alimenta todavía.
- Retirar el camino de `RuntimeApiRequestParams.files` (`multipart/form-data`): sigue en pie porque `fileManager` continúa dependiendo de él fuera del alcance de esta feature.
- Cambios en la semántica de headers, query o endpoint.
- Cambios en el signature/cache de la request (`requestSignature`): el descriptor del request no debe incluir el contenido binario ni las cadenas base64.

### Dependencias
- T1 completa (`encodeFileToBase64Entry`).
- T2 completa (`fileValueOverrides` aceptado por `buildRuntimeApiRequest`).

### Impacto esperado en archivos
- Código a modificar:
  - `src/queries/runtime-api-types.ts` — añadir `RuntimeApiFileInputSources` con shape `{ formId: string; valuesByFieldId: Record<string, readonly File[]> }` y extender `ExecuteRuntimeApiOperationOptions` y `ExecuteInlineRuntimeApiOperationOptions` con `fileInputSources?: RuntimeApiFileInputSources`. No añadir este canal a `BuildRuntimeApiRequestOptions`: la codificación ocurre en el executor, no en el builder. El nuevo tipo `RuntimeApiFileInputSources` **no** se re-exporta desde `src/config/runtime-config.ts` ni desde `src/config/runtime-config-types.ts` en esta tarea; su primer consumidor externo (`form-layout-node.tsx`) lo importa directamente desde `../../queries/runtime-api-types` en T4 y decide entonces si el re-export público es necesario. Esta restricción evita oscilar la superficie pública del módulo `config` entre T3 y T4.
  - `src/queries/runtime-api-executor.ts` — en `executeRuntimeApiOperation` y `executeInlineRuntimeApiOperation`, antes de invocar el builder:
    - si `fileInputSources` no está o `valuesByFieldId` está vacío, seguir el flujo actual sin overrides;
    - si hay campos con ficheros, codificar todos los `File[]` en paralelo con la utilidad de T1 (`Promise.all` sobre pares `[fieldId, files]`);
    - si alguna codificación falla, devolver `{ status: 'error', error: { code: 'request-build-failed', message: '...' } }` inmediatamente sin llamar al builder ni al `fetch`;
    - si todas se codifican, construir un `ReadonlyMap<string, RuntimeApiBodyValue[]>` con claves `"${formId}.${fieldId}"` y pasarlo a `buildRuntimeApiRequest`/`buildInlineRuntimeApiRequest` en el nuevo campo `fileValueOverrides` de T2.
  - `src/runtime/runtime-state/runtime-state-provider.tsx` — en `executeQueryOperation` (y en el helper interno `executeQueryOperationWithSnapshot`), aceptar `fileInputSources` en `options`, propagarlo al executor y no incluirlo en el descriptor de dispatch a `queries/set-loading`/`queries/set-success`/`queries/set-error` más allá de lo ya existente (los eventos siguen dependiendo del `requestSignature` calculado por el builder).
- Tests a crear:
  - `src/tests/runtime/runtime-api-file-encoding-preflight.test.ts` (nuevo).
- Tests a modificar:
  - Ninguno de los ficheros existentes debe requerir ampliación en esta tarea; los tests de `runtime-api-multipart.test.ts` y `runtime-api-execution.test.ts` deben seguir en verde sin cambios porque el nuevo canal es opcional.
- Documentación afectada (referencia para pasadas posteriores):
  - Ninguna en esta tarea.

### Tests

**Ficheros de test**
- `src/tests/runtime/runtime-api-file-encoding-preflight.test.ts` (nuevo) — el mismo fichero cubre tanto los casos del executor (`executeRuntimeApiOperation`/`executeInlineRuntimeApiOperation`) como los dos casos de wiring del provider (`useRuntimeStateActions().executeQueryOperation` bajo `RuntimeStateProvider`, éxito y fallo). No dividir en dos ficheros: el harness es compartido y el reparto se hace mediante `describe` separados dentro del mismo fichero (`describe('executor', …)` y `describe('provider wiring', …)`).

**Comportamiento cubierto**
- Llamar `executeRuntimeApiOperation` sin `fileInputSources` con un body escalar sencillo produce exactamente el mismo request/JSON que hoy (regresión: cache/firma estable).
- Llamar `executeRuntimeApiOperation` con `fileInputSources = { formId: 'uploadForm', valuesByFieldId: {} }` es equivalente a no pasarlo: no invoca el codificador, no altera el body y sigue produciendo el mismo `content-type: application/json` (o el que corresponda a la operación).
- Con `fileInputSources = { formId: 'uploadForm', valuesByFieldId: { photos: [File1, File2] } }` y un body `{ photos: 'forms.uploadForm.photos' }`, el `fetch` recibe un `RequestInit` cuyo body es la cadena JSON serializada con la clave `photos` igual al array `[{name,size,mime,data}, {name,size,mime,data}]`, y el `content-type` de cabecera es `application/json`.
- Con el mismo `fileInputSources` pero un body que no referencia `forms.uploadForm.photos`, el `fetch` recibe el body serializado como si no hubiera ficheros (el `fileInput` no aporta clave al payload), pero el codificador puede haber corrido: los ficheros nunca aparecen en el body si no están referenciados.
- Con `valuesByFieldId: { photos: [] }` y body `{ photos: 'forms.uploadForm.photos' }`, el `fetch` recibe `body: JSON.stringify({ photos: [] })`.
- Cuando el codificador falla para al menos un fichero (mockeando el encoder para que devuelva `{ status: 'error' }`), `executeRuntimeApiOperation` devuelve `{ status: 'error', error: { code: 'request-build-failed', message: <string> } }` y `fetch` no se invoca.
- Con `fileInputSources` presente **y** `requestParams.files` presente (canal legacy de `fileManager`), ambos coexisten: `files` sigue activando la rama multipart (regresión) y `fileInputSources` no interfiere con esa rama, porque el nodo `form` de T4 no pasa las dos cosas a la vez. Cubrir un test defensivo que verifique que, si un caller mezclara ambos, el multipart gana y `fileInputSources` se sigue codificando sin efecto observable en el body multipart.
- El `requestSignature` del request construido no depende del contenido binario ni de las cadenas base64: dos codificaciones sucesivas del mismo `fileInputSources` producen requests con la misma firma (los ficheros no se serializan como parte del descriptor de firma).
- Wiring en el provider: al invocar `useRuntimeStateActions().executeQueryOperation('uploadOp', { fileInputSources: {...} })` en un test con `RuntimeStateProvider`, el mock de `fetch` recibe el body JSON con los objetos `{name,size,mime,data}` esperados.
- Wiring en el provider en fallo: cuando el encoder falla, `queries.uploadOp` transita al estado `error` con `code: 'request-build-failed'` en `error.code` y no se dispara `set-success`.

**Comandos durante la implementación**
- `pnpm test --run src/tests/runtime/runtime-api-file-encoding-preflight.test.ts`
- `pnpm test --run src/tests/runtime/runtime-api-execution.test.ts`
- `pnpm test --run src/tests/runtime/runtime-api-multipart.test.ts`
- `pnpm test --run src/tests/runtime-state/runtime-state-forms-queries.test.tsx`

**Restricciones**
- El preflight debe ocurrir sólo en el executor asíncrono, no dentro de `buildRuntimeApiRequest`: el builder sigue siendo síncrono.
- No incluir el contenido binario ni las cadenas base64 en el `RuntimeApiRequestDescriptor`: la firma se calcula sobre el mismo descriptor de hoy, ampliado sólo con los mismos campos ya existentes.
- No romper la coexistencia con `requestParams.files` de `fileManager`: la rama multipart se mantiene sin regresión.
- El wiring del provider no debe alterar el orden de dispatch actual (`set-loading` antes de `fetch`, `set-success`/`set-error` tras la respuesta).

### Criterios de finalización
- El executor acepta `fileInputSources`, codifica en paralelo, mapea el resultado a `fileValueOverrides` y transita a `request-build-failed` cuando alguna codificación falla.
- El provider propaga el canal desde `executeQueryOperation` sin alterar el resto de la firma pública.
- Los tests existentes de `runtime-api-execution`, `runtime-api-multipart` y `runtime-state-forms-queries` siguen en verde sin cambios.
- Todos los tests declarados arriba pasan en verde.
- `pnpm test` no rompe el umbral global de cobertura.

### Cierre de implementación
Código y tests de la tarea completos y validados. `implementation.completed_task_ids` en `status.yaml` incluye `T3`.

---

## T4 — `form-layout-node` deja de emitir `multipart/form-data` desde `fileInput` y pasa a alimentar el nuevo canal

### Estado
Completada

### Objetivo
Cambiar el comportamiento observable del submit para `fileInput`: eliminar la construcción de `requestParams.files` a partir de los campos `fileInput` visibles en `src/runtime/nodes/form-layout-node.tsx` y sustituirla por la construcción de `fileInputSources = { formId, valuesByFieldId }` que se pasa a `executeQueryOperation` en las ramas `executeOperation` y `executeOperations`. `valuesByFieldId` sólo debe incluir campos `fileInput` visibles del propio formulario. Reescribir el test end-to-end del submit de `fileInput` para reflejar el nuevo shape JSON+base64, incluida la omisión sin referencia y la coexistencia con campos de texto en el body.

Esta tarea es la que cambia el contrato observable con el backend: es la que rompe deliberadamente cualquier integración que esperase `multipart/form-data` desde `fileInput`.

### Fuera de alcance
- Cualquier cambio en el nodo `fileManager` y en la vía multipart que sigue usando (`file-manager-drop-zone.tsx`, `use-file-manager.ts`, `runtime-api-multipart.test.ts`).
- Cambios en la preview visual, en las validaciones client-side (`accept`, `maxFileSize`, `maxTotalSize`, `minFiles`, `maxFiles`, `validFileNames`, 0 bytes, nombre duplicado) o en `required` sobre `fileInput`.
- Cambios en la semántica de omisión de campos ocultos (`hiddenFormFields`): sigue aplicándose automáticamente por la lógica ya existente y ya cubierta.
- Actualización de las fichas de documentación: se declara aquí como `documentación afectada`, pero la escritura vive en la pasada posterior de `update-app-documentation`.

### Dependencias
- T3 completa: `executeQueryOperation` acepta `fileInputSources` y el executor lo codifica y aplica al body.

### Impacto esperado en archivos
- Código a modificar:
  - `src/runtime/nodes/form-layout-node.tsx`:
    - Eliminar el bloque que recorre `visibleFieldDefinitions` construyendo `fileEntries: RuntimeApiFileField[]` y calcula `filesParam = fileEntries.length > 0 ? { files: fileEntries } : {}`.
    - En su lugar, construir `fileInputSources: RuntimeApiFileInputSources | undefined`:
      - recorrer `visibleFieldDefinitions` y quedarse con los que tienen `type === 'fileInput'`,
      - para cada uno, leer `selectFormFieldState(snapshotState, node.id, fieldId).value` y descartar entradas no `instanceof File`,
      - si el resultado incluye al menos un campo, poner `{ formId: node.id, valuesByFieldId }`; si no hay ningún fileInput visible, dejar `fileInputSources` como `undefined`.
    - Pasar `fileInputSources` (no ya `files`) al `executeQueryOperation` tanto en la rama `executeOperation` como en cada entrada de la rama `executeOperations`. Retirar de la llamada las claves `files` derivadas de `filesParam`.
    - Retirar del import `RuntimeApiFileField` si deja de usarse.
  - `src/config/runtime-config.ts` / `src/config/runtime-config-types.ts` — retirar `RuntimeApiFileField` de los re-exports públicos sólo si deja de tener consumidores externos al módulo `queries`; si `fileManager` sigue dependiendo de él, mantenerlo intacto. No ampliar el impacto de la tarea si no es necesario.
- Tests a modificar:
  - `src/tests/runtime/runtime-form-submit-file-input.test.tsx` (ampliación) — el fichero existe hoy y cubre la vía multipart de `fileInput`; esta tarea lo reescribe: los casos existentes de multipart se retiran (la vía deja de existir para `fileInput`) y se sustituyen por los casos JSON+base64 detallados en el bloque "Comportamiento cubierto". No se conserva ningún caso de multipart en este fichero.
- Documentación afectada (referencia para pasadas posteriores):
  - `ai-workflow/docs/app-features/nodes/file-input.md`
  - `ai-workflow/docs/app-features/forms/submit.md`
  - `ai-workflow/docs/current-state.md`

### Tests

**Ficheros de test**
- `src/tests/runtime/runtime-form-submit-file-input.test.tsx` (ampliación) — los casos multipart existentes se retiran y se sustituyen por los casos JSON+base64 listados abajo; no se mezcla contenido antiguo y nuevo en el mismo fichero.

`src/tests/runtime/runtime-api-multipart.test.ts` no se lista aquí porque esta tarea no añade ni retira casos suyos: se conserva como comando de regresión en el bloque "Comandos durante la implementación" para asegurar que la vía multipart de `fileManager` sigue en verde.

**Comportamiento cubierto**
- Un `form` con un `fileInput` `photos` referenciado en `submitAction.body = { photos: 'forms.uploadForm.photos' }` y un `File` seleccionado envía en el submit un body JSON `{ photos: [{ name, size, mime, data }] }`, `content-type: application/json`, sin `FormData`.
- `data` decodificado desde base64 reproduce byte a byte el contenido binario del `File` original.
- Con `props.multiple: true` y dos ficheros seleccionados en orden A, B, el body contiene un array de dos elementos en el mismo orden A, B, cada uno con su `name`/`size`/`mime`/`data`.
- Con selección vacía (`[]`) y `required: false`, el submit incluye `photos: []` en el body sin bloquear la operación.
- Un `fileInput` con ficheros seleccionados pero **sin** referencia en `submitAction.body` no aporta ninguna clave al body; el body resultante sólo contiene el resto de campos referenciados (regresión: el request es idéntico al de un form sin `fileInput`).
- El submit de un formulario con `fileInput` y campos de texto referenciados en el body incluye a la vez los objetos de fichero y los valores escalares en el mismo JSON, en las claves correspondientes.
- Con `required: true` y ningún fichero seleccionado, el submit se bloquea con error inline sin llamar a `fetch` (regresión).
- Con `visibility` que oculta el `fileInput` en el momento del submit y una referencia a `forms.{formId}.{fieldId}` en el body, la clave se omite del body (semántica de `hiddenFormFields`) sin producir `request-build-failed`.
- `resetOnSuccess: true` limpia la selección tras un submit exitoso, igual que hoy (regresión).
- Cuando la codificación falla (simular fallo del encoder), la query correspondiente transita a `status: error` con `code: 'request-build-failed'` y no se llama a `fetch`.
- La rama multipart de `fileManager` sigue funcionando exactamente como antes (regresión mediante el propio suite de `runtime-api-multipart.test.ts`, sin necesidad de cambios en él si `fileManager` no comparte fixture con `fileInput`).

**Comandos durante la implementación**
- `pnpm test --run src/tests/runtime/runtime-form-submit-file-input.test.tsx`
- `pnpm test --run src/tests/runtime/runtime-api-multipart.test.ts`
- `pnpm test --run src/tests/runtime-state/runtime-state-forms-queries.test.tsx`
- `pnpm test --run src/tests/runtime/runtime-form-submit-hidden-fields.test.tsx`

**Restricciones**
- No introducir un flag ni un modo dual `multipart` vs `json`: el cambio es total para `fileInput`.
- No pasar `requestParams.files` desde `form-layout-node.tsx`; ese canal queda reservado a `fileManager`.
- No incluir en `valuesByFieldId` campos `fileInput` ocultos por `visibility`: sólo campos visibles del formulario.
- No romper la interacción con `hiddenFormFields`: la omisión por campo oculto tiene prioridad sobre el override (comprobado en T2), y aquí se limita a no meter esos campos en `valuesByFieldId`.
- No modificar la preview, las validaciones client-side ni la lectura/escritura de `forms.{formId}.{fieldId}.value` como `File[]` en estado.

### Criterios de finalización
- `form-layout-node.tsx` ya no construye `requestParams.files` desde `fileInput` en ninguna rama de `submitAction`.
- `form-layout-node.tsx` pasa `fileInputSources` a `executeQueryOperation` cuando y sólo cuando haya al menos un `fileInput` visible con `File[]` en estado (aunque el array esté vacío el campo entra si es visible y su valor es `File[]`).
- El submit de un formulario con `fileInput` referenciado usa `content-type: application/json` y un body con arrays `{name,size,mime,data}` bajo las claves referenciadas.
- El submit de un formulario con `fileInput` no referenciado tiene un body idéntico al de un formulario sin `fileInput` (regresión sobre el resto de campos).
- Todos los tests declarados arriba pasan en verde y ningún test existente del runtime queda roto por la retirada de la vía multipart de `fileInput`.
- `pnpm test` no rompe el umbral global de cobertura.

### Cierre de implementación
Código y tests de la tarea completos y validados. `implementation.completed_task_ids` en `status.yaml` incluye `T4`. Todas las tareas de la feature están cerradas; `feature_status` puede pasar a `implemented` en la actualización final del estado.
