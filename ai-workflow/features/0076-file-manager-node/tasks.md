# Tareas de implementación — Feature 0076

> Contrato de ejecución secuencial. Ejecutar tareas en orden. No reabrir alcance ni rediseñar durante la implementación.

## Resumen del alcance técnico

La feature `0076` introduce un nuevo nodo standalone `fileManager` en el catálogo del runtime para subir, listar, eliminar, ver y descargar ficheros. El cambio cruza tres capas:

1. **Capa de queries (`src/queries/`)**: la fachada `buildRuntimeApiRequest` queda extendida para emitir `multipart/form-data` cuando hay un nuevo campo `files` en `requestParams`, y se añade una variante "inline" del builder/executor que recibe la operación directamente (sin pasarla por `config.api`) para soportar el modo legacy (operaciones omitidas con `fieldName`). El executor (`runtime-api-executor.ts`) no cambia su superficie pública porque `fetch` ya acepta `FormData` como `init.body`.
2. **Capa de validación de formularios (`src/runtime/runtime-form-validations.ts`)**: se extiende con un target `fileManager` y un evaluador `evaluateFileManagerBatch` que aplica las reglas `accept`/`maxFileSize`/`maxTotalSize`/`minFiles`/`maxFiles`/`validFileNames` sobre `File[]` y devuelve "primer error visible" con distinción `per-file` vs `batch`. No participa de `forms.*`; los errores viven en estado local del nodo.
3. **Capa de bootstrap (`src/config/`) y nodo visual (`src/runtime/nodes/file-manager/`)**: nuevo schema Zod, nuevo validador con reglas de presencia y cross-checks, hook `useFileManager` con reducer local para la subida secuencial y subcomponentes para zona DnD, lista paginada, progreso y errores.

Decisiones técnicas vinculantes vienen literales de `design.md`:

- D1/D2/D3: `RuntimeApiRequestParams.files?: { name; file }[]`; cuando hay `files`, el builder construye `FormData` con `formData.append(name, file, file.name)` y aplana `body` JSON a pares texto en raíz (solo escalares). Si `body` tiene sub-objetos en modo multipart, se rechaza con `request-build-failed` indicando el campo problemático. No se setea `content-type` automáticamente. `requestSignature` excluye los `File` (firma una representación derivada `{ name, fileName, size, type }`).
- D4: `RuntimeFileManagerValidations` (shape `{ value, message? }` por regla) vive en el mismo módulo `runtime-form-validations.ts` que las reglas de formulario. Se introduce target `{ type: 'fileManager'; validations? }` y función pública `evaluateFileManagerBatch(validations, existingFiles, incomingBatch) → { acceptedFiles, rejection? }`. El error inline NO escribe en `forms.*`.
- D5: el canon de la lista vive en `queries.{getOperation}` (o slot legacy `__fileManager__:{fieldName}:get`); el estado efímero (cola en curso, errores inline, flash visual, página actual, estado DnD) vive en el reducer local del nodo.
- D6: el file id se inyecta en `deleteOperation` vía `executeQueryOperation(deleteOperationName, { requestParams: { body: { [fileIdField]: file[fileIdField] } } })`. Sin nuevo namespace global.
- D7: la URL de Ver/Descargar se construye llamando a `buildRuntimeApiRequest({ ..., requestParams: { query: { [fileIdField]: file[fileIdField] } } })` y usando `request.url` como `href`. Solo aplica si la operación es `GET`.
- D8: modo legacy materializa `RuntimeApiOperation` en memoria con helpers `buildLegacy*Operation(fieldName, fileField?)`. Se añade fachada `buildInlineRuntimeApiRequest({ operation, state, requestParams })` y `executeInlineRuntimeApiOperation`. La fachada actual `buildRuntimeApiRequest` se reescribe encima.
- D9: el prefijo `__fileManager__:` queda reservado: `validate-api-config` rechaza explícitamente cualquier `api.{operationName}` que empiece por él. Los slots legacy se escriben en `queries.__fileManager__:{fieldName}:{get|upload|delete}`.
- D10: schema Zod `fileManagerNodeSchema` y `validateFileManagerNode` con todas las reglas de presencia (al menos una operación activa, `fieldName` si alguna omitida, GET en view/download, cross-check de strings contra `config.api`, etc.). `fileManager` NO puede aparecer dentro de `form.children`.
- D11: el nodo vive en `src/runtime/nodes/file-manager/` con subcomponentes propios. El dispatcher central gana `case 'fileManager'` en `layout-node-renderer.tsx`.
- D12: `normalizeFileName(fileName, prefix?)` aislado como función pura.
- D13: subida secuencial con `useReducer`; `mountedRef` descarta dispatch tras unmount.
- D14: reuso de `runtime-collection-pagination.ts` (variante `previousNext`) sobre la lista resuelta.

No se introduce el dominio paralelo `fileManagers.*` ni el namespace `{{fileManager.selectedFileId}}`. No se modifica la firma del executor (`runtime-api-executor.ts` sigue exportando `executeRuntimeApiOperation` y `executeBuiltRuntimeApiRequest`). El refactor de `buildRuntimeApiRequest` sobre el builder inline debe preservar literalmente el comportamiento actual JSON puro (cubierto por la suite existente del builder).

Las preguntas abiertas del design se resuelven en este plan así:
- Q1 (body con sub-objetos en upload del catálogo): se valida en runtime al construir el multipart (D1/D2). No se añade validación cruzada en bootstrap; la spec no lo exige y abrir el contrato de `RuntimeApiOperation` para detectar "intended upload" en bootstrap excede el alcance.
- Q2 (colisión de `__fileManager__:` con nombre real de operación): cubierto por **T3** (validate-api-config rechaza el prefijo).
- Q3 (refetch automático de `getOperation`): se mantiene la política actual del runtime (latest-only por `requestSignature`). No se introduce refetch explícito.

---

## T1 — Extender la fachada de queries con soporte `multipart/form-data`

- **ID**: T1
- **Estado**: pending
- **Objetivo**: Extender `RuntimeApiRequestParams` con `files?: RuntimeApiFileField[]`, ampliar `buildRuntimeApiRequest` para materializar el request como `FormData` cuando hay `files` (aplanando `body` a pares texto en raíz y rechazando sub-objetos), y firmar `requestSignature` de forma estable excluyendo los `File`. Confirmar que `executeBuiltRuntimeApiRequest` funciona sin modificaciones porque `fetch` ya acepta `FormData` en `init.body`.
- **Fuera de alcance**:
  - Cualquier modificación del runtime-state-provider (la fachada `executeQueryOperation` no cambia de firma; el consumidor pasa `files` dentro de `requestParams`).
  - Variante inline del builder (es T2).
  - Validación cruzada en bootstrap que detecte "upload con body no plano" en `config.api` (se queda como runtime error documentado).
  - Cambios en `runtime-api-payload-resolver.ts` (`resolveBody`/`resolveHeaders`/`resolvePayloadValue`); se reutilizan sin tocar.
- **Dependencias**: ninguna.
- **Impacto esperado en archivos**:
  - código:
    - `src/config/runtime-config-types.ts` (modificar): declarar y exportar `RuntimeApiFileField = { name: string; file: File }` junto a `RuntimeApiRequestParams`; ampliar `RuntimeApiRequestParams` con `files?: RuntimeApiFileField[]`. Mantener `RuntimeApiBodyValue` intacto (JSON puro).
    - `src/queries/runtime-api-types.ts`: ningún cambio (el tipo `RuntimeApiFileField` se consume vía `RuntimeApiRequestParams` ya importado de `runtime-config-types`). `RuntimeApiRequest['init']` tampoco cambia: `RequestInit.body` ya admite `BodyInit` (incluye `FormData`).
    - `src/queries/runtime-api-request.ts` (modificar): detectar `effectiveRequestParams.files` resuelto y no vacío en `buildRuntimeApiRequest`; cuando lo hay, construir un `FormData` con cada `{ name, file }` vía `formData.append(name, file, file.name)`, aplanar `body` JSON al primer nivel como pares texto (solo `string|number|boolean`; cualquier otro tipo en raíz produce `request-build-failed` con mensaje específico `The api operation "${operationName}" cannot serialize "body.${key}" for multipart payload (only scalar values are allowed).`). No setear `content-type`. Excluir `files` de `descriptor` y firmar una representación derivada `[{ name, fileName: file.name, size: file.size, type: file.type }, ...]` dentro de `requestSignature` para conservar estabilidad razonable.
  - tests:
    - `src/tests/runtime/runtime-api-execution.test.ts` (ampliación) o un nuevo fichero `src/tests/runtime/runtime-api-multipart.test.ts` (nuevo) si la suite existente supera ~500 líneas. Decisión: usar **nuevo fichero** `runtime-api-multipart.test.ts` para mantener la suite actual cohesionada y el nuevo dominio aislado.
  - documentación: ninguna en esta tarea.
- **Cambios concretos**:
  - En `runtime-config-types.ts` añadir, junto a `RuntimeApiRequestParams`:
    ```ts
    export type RuntimeApiFileField = { name: string; file: File }
    // y dentro de RuntimeApiRequestParams:
    files?: RuntimeApiFileField[]
    ```
  - En `runtime-api-request.ts`, dentro de `buildRuntimeApiRequest`, tras resolver `bodyResult` y `headersResult`, detectar `effectiveRequestParams.files`. Implementar una rama nueva `buildMultipartRequestInit(method, headers, body, files)` que:
    1. Construye un `FormData` nuevo.
    2. Para cada `field` en `files`, `formData.append(field.name, field.file, field.file.name)`. El iterador se nombra `field` (no `file`) para no confundir con `field.file`.
    3. Si `body` es un objeto plano, recorre sus pares; para cada valor `string|number|boolean` hace `formData.append(key, String(value))`; cualquier otro tipo retorna `request-build-failed` con mensaje específico.
    4. Si `body` es `null|undefined`, no añade pares de texto adicionales.
    5. Devuelve `RequestInit` con `method`, `headers` (sin `content-type` autoinyectado) y `body: formData`.
  - Reescribir `createRuntimeApiRequest` para aceptar opcionalmente `files` y, cuando exista, incluir en `descriptor` un campo `filesSignature: [{ name, fileName, size, type }, ...]` y excluir los `File` reales. `requestSignature` se calcula como hasta ahora sobre `descriptor` ya estabilizado.
  - Mantener el comportamiento actual JSON puro idéntico cuando `files` está ausente.
- **Tests**:
  - **Ficheros de test**:
    - `src/tests/runtime/runtime-api-multipart.test.ts` (nuevo).
  - **Comportamiento cubierto**:
    - `buildRuntimeApiRequest` con `requestParams.files: [{ name: 'file', file: <File 'doc.pdf'> }]` y sin `body` produce `init.body` instancia de `FormData` con una sola entrada `file=<File>` y sin `content-type` autoinyectado.
    - `buildRuntimeApiRequest` con `requestParams.files: [{ name: 'file', file }]` y `body: { upload_multiple_field_name: 'documentos' }` produce un `FormData` con la entrada `file` y la entrada texto `upload_multiple_field_name=documentos`.
    - `buildRuntimeApiRequest` con `requestParams.files: [...]` y `body: { nested: { key: 'value' } }` devuelve `status: 'error'` con `code: 'request-build-failed'` y mensaje exacto `The api operation "<op>" cannot serialize "body.nested" for multipart payload (only scalar values are allowed).`.
    - `buildRuntimeApiRequest` con `requestParams.files: [...]` y `body: { items: [1, 2] }` rechaza con el mismo código de error, ruta `body.items`.
    - `buildRuntimeApiRequest` con `requestParams.files: [...]` y `headers: { 'content-type': 'multipart/form-data; boundary=abc' }` preserva el header explícito tal cual y no lo sobreescribe.
    - `buildRuntimeApiRequest` con `requestParams.files: []` (array vacío) se comporta como si `files` estuviera ausente (no fuerza multipart; usa el camino JSON cuando hay body).
    - `requestSignature` de dos llamadas con `files` que apuntan a `File` distintos pero con el mismo `name`, `fileName`, `size`, `type` es idéntico. `requestSignature` cambia si `size` o `type` cambian. `requestSignature` para una request JSON pura es idéntico al actual (regresión).
    - `executeBuiltRuntimeApiRequest` con una request multipart pasa correctamente el `FormData` a `fetch` (mock); el test no verifica el wire format real, solo que `init.body instanceof FormData` y el `method`/`url` se preservan.
    - Sigue verde la suite de `runtime-api-execution.test.ts` sin cambios (sanity check).
  - **Comandos durante la implementación**:
    - `pnpm test --run src/tests/runtime/runtime-api-multipart.test.ts`
    - `pnpm test --run src/tests/runtime/runtime-api-execution.test.ts`
  - **Restricciones**:
    - No introducir helpers genéricos compartidos con la rama JSON: la rama multipart es un sub-caso aislado dentro de `runtime-api-request.ts`.
    - No mockear `FormData`: usar la implementación real de jsdom.
    - No verificar el `boundary` del request multipart (no es parte del contrato).
    - No tocar `runtime-api-payload-resolver.ts`.
- **Documentación afectada**: ninguna en esta tarea (las fichas funcionales se actualizan al cierre completo de la feature).
- **Criterios de finalización**: `requestParams.files` soportado por el builder con cobertura por tests; el camino JSON sigue intacto (suite existente verde); `requestSignature` estable bajo igualdad de metadata.
- **Cierre de implementación**: builder con soporte multipart operativo; `pnpm test` global cumple umbral del 80%.

---

## T2 — Fachada inline del builder/executor (modo legacy y reuso)

- **ID**: T2
- **Estado**: pending
- **Objetivo**: Introducir `buildInlineRuntimeApiRequest({ operation, state, requestParams, iterationContext })` y `executeInlineRuntimeApiOperation` en `src/queries/`, recibiendo la `RuntimeApiOperation` directamente (sin lookup en `config.api`). Reescribir `buildRuntimeApiRequest` y `executeRuntimeApiOperation` como thin wrappers que hacen el lookup y delegan en la fachada inline. Comportamiento observable idéntico al actual para el camino existente.
- **Fuera de alcance**:
  - Cambios en el contrato visible a consumidores actuales (`buildRuntimeApiRequest`/`executeRuntimeApiOperation` mantienen firma e identidad de exportación).
  - Materialización de operaciones legacy del fileManager (los helpers `buildLegacy*Operation` viven en el módulo del nodo, T8).
  - Wiring del slot `queries.__fileManager__:*` (es T3).
- **Dependencias**: T1.
- **Impacto esperado en archivos**:
  - código:
    - `src/queries/runtime-api-request.ts` (modificar): extraer el cuerpo de `buildRuntimeApiRequest` (todo lo posterior al lookup `config.api[operationName]`) a una función nueva `buildInlineRuntimeApiRequest({ operation, operationName, state, requestParams, iterationContext })`. `buildRuntimeApiRequest` queda como wrapper: hace el lookup, devuelve `operation-not-found` si no existe, y delega.
    - `src/queries/runtime-api-executor.ts` (modificar): extraer la parte post-build de `executeRuntimeApiOperation` a `executeInlineRuntimeApiOperation({ operation, operationName, state, requestParams, iterationContext, fetch })` que reciba directamente la `RuntimeApiOperation`. `executeRuntimeApiOperation` se reescribe como wrapper que hace el lookup y delega.
    - `src/queries/runtime-api-types.ts` (modificar): añadir `BuildInlineRuntimeApiRequestOptions` y `ExecuteInlineRuntimeApiOperationOptions` (sin `config`; con `operation` directo).
  - tests:
    - `src/tests/runtime/runtime-api-execution.test.ts` (ampliación): añadir casos que ejerciten directamente `buildInlineRuntimeApiRequest` y `executeInlineRuntimeApiOperation` con una `RuntimeApiOperation` sintetizada en memoria; confirmar que el comportamiento es indistinguible del camino con lookup.
  - documentación: ninguna en esta tarea.
- **Cambios concretos**:
  - `buildInlineRuntimeApiRequest` no recibe `config`. Su firma es `{ operation, operationName, state, requestParams?, iterationContext? }`. El parámetro `operationName` se usa solo para construir mensajes de error idénticos a los actuales (`The api operation "${operationName}" ...`).
  - El wrapper `buildRuntimeApiRequest` mantiene el mismo error literal `The api operation "${operationName}" does not exist.` cuando `config.api[operationName]` no existe.
  - `executeInlineRuntimeApiOperation` reusa `executeBuiltRuntimeApiRequest` y emite `RuntimeApiExecutionResult` igual que `executeRuntimeApiOperation`.
  - Exportar `buildInlineRuntimeApiRequest` y `executeInlineRuntimeApiOperation` desde sus módulos respectivos.
- **Tests**:
  - **Ficheros de test**:
    - `src/tests/runtime/runtime-api-execution.test.ts` (ampliación).
  - **Comportamiento cubierto**:
    - Llamar a `buildInlineRuntimeApiRequest` con una `RuntimeApiOperation` ad-hoc produce el mismo `request.url` e `init` que el equivalente vía `buildRuntimeApiRequest` con la misma operación registrada en `config.api`.
    - Llamar a `buildInlineRuntimeApiRequest` con `requestParams.files` activa el camino multipart (regresión T1 vía la nueva fachada).
    - `executeInlineRuntimeApiOperation` con una operación sintetizada devuelve `RuntimeApiExecutionResult` con el mismo `status` y `data`/`error` que `executeRuntimeApiOperation`.
    - `buildRuntimeApiRequest` con `operationName` inexistente sigue devolviendo `operation-not-found` con el mensaje literal actual.
    - El refactor no rompe ningún test existente; la suite actual de queries/runtime sigue verde.
  - **Comandos durante la implementación**:
    - `pnpm test --run src/tests/runtime/runtime-api-execution.test.ts`
    - `pnpm test --run src/tests/runtime/runtime-api-multipart.test.ts`
  - **Restricciones**:
    - El refactor debe ser estructural: el comportamiento observable previo (cuando `files` está ausente) no cambia.
    - Mantener idénticos los mensajes de error literales y los códigos (`operation-not-found`, `request-build-failed`).
    - No exponer `buildInlineRuntimeApiRequest`/`executeInlineRuntimeApiOperation` a través de re-exports adicionales que no sean los módulos donde viven.
- **Documentación afectada**: ninguna en esta tarea.
- **Criterios de finalización**: la fachada inline existe, está testeada, el camino con lookup pasa por ella, todos los tests existentes siguen verdes.
- **Cierre de implementación**: refactor completo y tests cubriendo ambas rutas; `pnpm test` global cumple umbral del 80%.

---

## T3 — Reservar prefijo `__fileManager__:` en validate-api-config

- **ID**: T3
- **Estado**: pending
- **Objetivo**: Extender `src/config/validate-api-config.ts` para rechazar cualquier `api.{operationName}` cuyo nombre empiece por `__fileManager__:`. Garantiza que el slot legacy `queries.__fileManager__:{fieldName}:{op}` no colisiona con operaciones reales declaradas por el configurador.
- **Fuera de alcance**:
  - Validar el contenido funcional de operaciones (`method`, `endpoint`, etc.) — ya cubierto por `validate-api-config` actual.
  - Reservar otros prefijos.
- **Dependencias**: ninguna funcional (puede ir en paralelo a T1/T2). Se ubica aquí para dejar el contrato cerrado antes de que el nodo lo consuma.
- **Impacto esperado en archivos**:
  - código:
    - `src/config/validate-api-config.ts` (modificar): tras el bloque actual que valida la clave `operationName`, añadir una guardia: si `operationName.startsWith('__fileManager__:')`, devolver `invalidConfig(\`The api operation "${operationName}" uses the reserved prefix "__fileManager__:".\`)` (usar el helper de error vigente en el módulo; preservar el mismo shape de retorno que las validaciones existentes).
  - tests:
    - `src/tests/config-validation/runtime-config-validation-api-operations.test.ts` (ampliación).
  - documentación: ninguna en esta tarea.
- **Cambios concretos**:
  - La guardia se aplica a cada clave de `config.api` antes de validar el resto del shape. Es la primera regla evaluada para que el error sea siempre el de prefijo reservado cuando hay colisión, independientemente de si el resto del shape sería válido.
- **Tests**:
  - **Ficheros de test**:
    - `src/tests/config-validation/runtime-config-validation-api-operations.test.ts` (ampliación).
  - **Comportamiento cubierto**:
    - Una `config` con `api: { '__fileManager__:foo:upload': { method: 'POST', endpoint: '/x' } }` se rechaza con mensaje exacto `The api operation "__fileManager__:foo:upload" uses the reserved prefix "__fileManager__:".`.
    - Una `config` con `api: { '__fileManager__:bar': { method: 'GET', endpoint: '/x' } }` se rechaza igualmente (no se exige que el nombre tenga forma completa de slot; basta el prefijo).
    - Una `config` con `api: { 'fileManager__foo': { ... } }` (sin los dos guiones bajos iniciales delante de la palabra) se acepta como hasta ahora (regresión).
    - Una `config` con `api: { 'uploadDocuments': { ... } }` se acepta como hasta ahora (regresión).
  - **Comandos durante la implementación**:
    - `pnpm test --run src/tests/config-validation/runtime-config-validation-api-operations.test.ts`
  - **Restricciones**:
    - No tocar el orden del resto de reglas del módulo.
    - El mensaje de error debe ser literal (los tests lo verifican exactamente).
- **Documentación afectada**: ninguna en esta tarea.
- **Criterios de finalización**: el prefijo está reservado y los tests cubren aceptación y rechazo; la suite de `api-operations` sigue verde en el resto de casos.
- **Cierre de implementación**: validación añadida; `pnpm test` global cumple umbral del 80%.

---

## T4 — Reglas de validación para `File[]` en runtime-form-validations

- **ID**: T4
- **Estado**: pending
- **Objetivo**: Extender `src/runtime/runtime-form-validations.ts` con el target `{ type: 'fileManager'; validations?: RuntimeFileManagerValidations }` y la función pública `evaluateFileManagerBatch(validations, existingFiles, incomingBatch) → { acceptedFiles, rejection? }`. La función evalúa las reglas en el orden de la spec, distingue rechazo por fichero (`per-file`) vs rechazo de lote (`batch`), y produce mensajes por defecto.
- **Fuera de alcance**:
  - Integrar la función con la pipeline de subida (es T8).
  - UI de feedback inline (es T9).
  - Mensajes personalizados configurables más allá del campo opcional `message` por regla (la spec excluye i18n y mensajes personalizados extensos).
  - Modificar `getFirstVisibleValidationError` para que delegue en el nuevo evaluador (no debe; las reglas de `fileManager` operan fuera de `forms.*`).
- **Dependencias**: ninguna funcional. Se hace en paralelo a T1–T3 si conviene, pero el plan los ejecuta secuencialmente.
- **Impacto esperado en archivos**:
  - código:
    - `src/config/runtime-config-types.ts` (modificar): exportar `RuntimeFileManagerValidations` con el shape:
      ```ts
      export interface RuntimeFileManagerValidations {
        accept?: { value: string[]; message?: string }
        maxFileSize?: { value: number; message?: string }
        maxTotalSize?: { value: number; message?: string }
        minFiles?: { value: number; message?: string }
        maxFiles?: { value: number; message?: string }
        validFileNames?: { value: string[]; message?: string }
      }
      ```
    - `src/runtime/runtime-form-validations.ts` (modificar): añadir `evaluateFileManagerBatch(validations, existingFiles, incomingBatch)` que devuelve `FileManagerValidationResult = { acceptedFiles: File[]; rejection?: FileManagerRejection }`. `FileManagerRejection` discrimina `{ scope: 'per-file'; file: File; ruleName; message }` y `{ scope: 'batch'; ruleName; message }`.
  - tests:
    - `src/tests/runtime/runtime-form-validations.test.ts` (ampliación): nuevo `describe('evaluateFileManagerBatch', ...)`.
  - documentación: ninguna en esta tarea.
- **Cambios concretos**:
  - Orden de evaluación (literal del orden de la spec, primer error visible):
    1. Para cada fichero del `incomingBatch`, en el orden recibido: comprobar fichero de 0 bytes; nombre duplicado contra `existingFiles ∪ aceptados previos`; `accept` (MIME types); `maxFileSize`; `validFileNames` (al menos un regex casa). Cualquier fallo en este nivel marca el fichero como rechazado con `scope: 'per-file'`. Los ficheros rechazados se excluyen de `acceptedFiles` pero el batch continúa procesando el resto, salvo en las reglas de batch del paso 2.
    2. Reglas de batch (sobre `existingFiles ∪ acceptedFiles` tras el paso 1): `maxFiles` (rechaza el lote entero si el total supera el límite); `maxTotalSize` (rechaza el lote entero si la suma de tamaños supera el límite). Una violación de batch DESCARTA TODOS los ficheros del lote (incluidos los que pasaron el paso 1): el resultado final tiene `acceptedFiles: []` y `rejection: { scope: 'batch', ... }`, sobreescribiendo cualquier `rejection` per-file previo. Es decir: en presencia de violación de batch, no se sube ningún fichero del lote, ni siquiera los que individualmente serían válidos.
    3. `minFiles` es informativo: no produce rechazo en `evaluateFileManagerBatch`; queda como propiedad del estado canónico para consumo externo. **Nota explícita**: la spec marca `minFiles` como informativo; el evaluador no lo reporta como rechazo.
  - Mensajes por defecto literales (el campo `message` opcional los sobreescribe):
    - `zero-bytes`: `El fichero "${fileName}" tiene 0 bytes.`
    - `duplicate-name`: `Ya se ha subido un fichero con el nombre "${fileName}".`
    - `accept`: `El fichero "${fileName}" no es de un tipo válido.`
    - `maxFileSize`: `El fichero "${fileName}" supera el tamaño máximo permitido (${value} bytes).`
    - `validFileNames`: `El nombre del fichero "${fileName}" no coincide con los patrones permitidos.`
    - `maxFiles`: `Se ha superado el número máximo de ficheros permitidos (${value}).`
    - `maxTotalSize`: `El tamaño total del lote supera el límite (${value} bytes).`
  - Devolver únicamente el primer rechazo por nivel: el primer fichero rechazado del paso 1 marca `rejection` (si el batch entero no falla en el paso 2). Si el paso 2 falla, su rechazo sobreescribe el del paso 1.
- **Tests**:
  - **Ficheros de test**:
    - `src/tests/runtime/runtime-form-validations.test.ts` (ampliación).
  - **Comportamiento cubierto**:
    - Sin validaciones, devuelve `acceptedFiles === incomingBatch` y `rejection` ausente.
    - Fichero de 0 bytes → `rejection.scope === 'per-file'`, `ruleName === 'zero-bytes'`, mensaje literal.
    - Nombre duplicado vs `existingFiles` → `rejection.scope === 'per-file'`, `ruleName === 'duplicate-name'`.
    - Nombre duplicado entre dos ficheros del mismo `incomingBatch` → el segundo se rechaza.
    - `accept` con MIME no permitido → `rejection.scope === 'per-file'`, `ruleName === 'accept'`.
    - `maxFileSize` superado por un fichero → rechazado, mensaje incluye el límite.
    - `validFileNames` con regex que casa al menos una entrada → aceptado; sin regex que case → rechazado.
    - `maxFiles` superado contando `existingFiles + acceptedFiles` → `rejection.scope === 'batch'`, `acceptedFiles: []`.
    - `maxTotalSize` superado por la suma de `existingFiles.size + acceptedFiles.size` → `rejection.scope === 'batch'`.
    - `minFiles` configurado: el evaluador NUNCA rechaza por minFiles (es informativo). Confirmación explícita con un caso donde `existingFiles + acceptedFiles < minFiles` y el batch se devuelve sin `rejection`.
    - Mensaje personalizado vía `message` sobreescribe el por defecto en cada regla.
    - Orden de precedencia: si un fichero violaría tanto `accept` como `maxFileSize`, gana `accept` (mismo orden de la spec).
    - Orden de precedencia: si el batch viola simultáneamente una regla per-file y una de batch, la regla de batch gana en el `rejection` final (`maxFiles`/`maxTotalSize` sobreescriben).
  - **Comandos durante la implementación**:
    - `pnpm test --run src/tests/runtime/runtime-form-validations.test.ts`
  - **Restricciones**:
    - No modificar `getFirstVisibleValidationError` ni el flujo existente de validación de campos de formulario.
    - No introducir nueva interpolación; los mensajes por defecto son strings simples con concatenación.
    - Las reglas operan sobre `File` real (jsdom lo soporta) — no inventar un shape DTO interno.
- **Documentación afectada**: ninguna en esta tarea.
- **Criterios de finalización**: evaluador completo y testeado; la pipeline de validación de formularios existente sigue intacta.
- **Cierre de implementación**: evaluador disponible; `pnpm test` global cumple umbral del 80%.

---

## T5 — Helper `normalizeFileName`

- **ID**: T5
- **Estado**: pending
- **Objetivo**: Crear `src/runtime/nodes/file-manager/normalize-file-name.ts` exportando `normalizeFileName(fileName: string, prefix?: string): string` con la lógica literal de la spec (caracteres inválidos Windows → `_`, trim de espacios y puntos al final, nombres reservados Windows → `archivo_N`, truncar a ≤ 255 caracteres totales incluida extensión, antepone `prefix_` al final).
- **Fuera de alcance**:
  - Integrar la función en la pipeline de subida (es T8).
  - Detección de extensiones múltiples (`.tar.gz`): se trata como extensión simple (último `.`).
  - i18n del nombre `archivo_N`: literal según la spec legacy.
- **Dependencias**: ninguna.
- **Impacto esperado en archivos**:
  - código:
    - `src/runtime/nodes/file-manager/normalize-file-name.ts` (nuevo).
  - tests:
    - `src/tests/runtime/runtime-file-manager-normalize-name.test.ts` (nuevo) bajo `src/tests/runtime/` (área "runtime/").
  - documentación: ninguna en esta tarea.
- **Cambios concretos**:
  - Algoritmo paso a paso (literal de la spec, sin desviaciones):
    1. Separar `base` y `ext` por el último `.` (si no hay punto, `ext = ''`).
    2. En `base` y `ext` sustituir cada carácter de la lista `\\ / : * ? " < > |` por `_`.
    3. Trim de espacios y puntos al final tanto del `base` como del nombre completo.
    4. Si el `base` (case-insensitive) coincide con un nombre reservado de Windows (`CON`, `PRN`, `AUX`, `NUL`, `COM1`–`COM9`, `LPT1`–`LPT9`), reemplazar el `base` por `archivo_N` donde `N` empieza en `1`. El argumento `N` es siempre `1` (no se mantiene contador externo; la unicidad la garantiza la validación de duplicados aguas arriba).
    5. Reensamblar `name = base + (ext ? '.' + ext : '')`. Si `name.length > 255`, truncar el `base` hasta que `base.length + (ext ? ext.length + 1 : 0) === 255`.
    6. Si `prefix` está presente y no vacío, devolver `${prefix}_${name}`; si está ausente o vacío, devolver `name`.
- **Tests**:
  - **Ficheros de test**:
    - `src/tests/runtime/runtime-file-manager-normalize-name.test.ts` (nuevo).
  - **Comportamiento cubierto**:
    - Nombre simple sin prefijo: `'documento.pdf'` → `'documento.pdf'`.
    - Nombre con caracteres Windows inválidos: `'do:cu*mento?.pdf'` → `'do_cu_mento_.pdf'`.
    - Trim de espacios y puntos al final: `'documento.pdf...  '` → `'documento.pdf'`.
    - Nombre reservado Windows: `'CON.txt'` → `'archivo_1.txt'`; `'com1.log'` → `'archivo_1.log'` (case-insensitive).
    - Truncamiento a 255: un `base` muy largo con extensión `.pdf` produce un resultado con `length === 255` y conserva la extensión.
    - Prefijo: `normalizeFileName('documento.pdf', 'EXP')` → `'EXP_documento.pdf'`.
    - Prefijo se aplica DESPUÉS del truncamiento (la longitud final con prefijo puede exceder 255; el contrato literal de la spec aplica el truncamiento al nombre normalizado y luego antepone el prefijo).
    - Sin extensión: `'documento'` con caracteres inválidos `'doc/u'` → `'doc_u'`.
    - Combinación: nombre con caracteres inválidos, espacios al final y reservado: `'CON*.txt   '` → trata primero la sustitución, luego trim, luego comprueba reservado sobre el `base` resultante; el caso concreto produce `'archivo_1.txt'` si tras sustituir `*` y trim el `base` queda `CON`.
  - **Comandos durante la implementación**:
    - `pnpm test --run src/tests/runtime/runtime-file-manager-normalize-name.test.ts`
  - **Restricciones**:
    - Función pura, sin dependencias del runtime ni del DOM.
    - No introducir caching ni memoización.
- **Documentación afectada**: ninguna en esta tarea.
- **Criterios de finalización**: helper listo y testeado exhaustivamente por caso.
- **Cierre de implementación**: `pnpm test` global cumple umbral del 80%.

---

## T6 — Schema Zod del nodo `fileManager`

- **ID**: T6
- **Estado**: pending
- **Objetivo**: Declarar `fileManagerNodeSchema` en `src/config/runtime-config-zod.ts` reflejando el contrato JSON de la spec (props, validations, pagination, operaciones `string | false`). El schema solo valida shape y tipos, no presencia cruzada (eso es T7). Añadir la rama `'fileManager'` a la unión de tipos `LayoutNode` en `runtime-config-types.ts` y al discriminante de schemas usado por el dispatcher.
- **Fuera de alcance**:
  - Reglas de presencia cruzada (al menos una operación activa, `fieldName` cuando alguna omitida, GET para view/download, cross-check de strings contra `config.api`): todo en T7.
  - Wiring en el dispatcher (`layout-node-renderer.tsx`): T9.
- **Dependencias**: T4 (para reutilizar el tipo `RuntimeFileManagerValidations`).
- **Impacto esperado en archivos**:
  - código:
    - `src/config/runtime-config-zod.ts` (modificar): añadir `fileManagerNodeSchema` con `type: z.literal('fileManager')`, `props` con los campos del contrato (incluido `validations` con shape `RuntimeFileManagerValidations` y `pagination.pageSize` opcional entero positivo). Cada operación se declara como `z.union([z.string(), z.literal(false)]).optional()`. `acceptExtension` como `z.array(z.string()).optional()`. `multiple` default `true`. Mantener `.strict()` o `.strip()` consistentemente con el resto de schemas del módulo (seguir el patrón del schema vecino más cercano).
    - `src/config/runtime-config-types.ts` (modificar): añadir `FileManagerLayoutNode` con el shape resultante del schema y añadir su tipo a la unión `LayoutNode`.
    - `src/config/validate-layout-nodes.ts` (modificar): registrar `fileManager` en el dispatcher estructural de tipos de nodo siguiendo literalmente el patrón aplicado a `divider`/`stat`/`alert` (mismo módulo, misma función de despacho que ya existe para esos tipos). El objetivo es que la pasada estructural no rechace el nodo como `unknown-type` y enrute la validación específica al validador de T7. Sin reglas de presencia cruzada aquí; solo registro del tipo. Si el patrón de `divider`/`stat`/`alert` requiere también tocar la unión de hijos válidos de `container`/`tabs`/`accordion`/`modal`/`repeater.props.template`, replicar literalmente ese mismo cambio para `fileManager` (la spec exige que el nodo sea válido como descendiente de cualquier contenedor excepto `form`).
  - tests:
    - `src/tests/config-validation/runtime-config-validation-file-manager.test.ts` (nuevo) — tests de schema (aceptación de shapes válidos y rechazo de shapes inválidos por tipos/forma).
  - documentación: ninguna en esta tarea.
- **Cambios concretos**:
  - Props soportadas (literal del contrato):
    - `fieldName?: string`
    - `fileField?: string` (default `'file'`; aplicar default en runtime, no en schema)
    - `listPath?: string` (default `'files'`)
    - `fileIdField?: string` (default `'id'`)
    - `fileNameField?: string` (default `'name'`)
    - `multiple?: boolean` (default `true`)
    - `prefix?: string`
    - `acceptExtension?: string[]`
    - `getOperation`, `uploadOperation`, `deleteOperation`, `viewOperation`, `downloadOperation`: cada una `string | false` opcional
    - `validations?: RuntimeFileManagerValidations`
    - `pagination?: { pageSize?: number }` (entero positivo)
  - Campos transversales soportados a nivel de nodo: `layout.span`, `visibility`, `queryStateFeedback`, `data-layout-node` se aplicarán por las reglas globales ya existentes (no se replican en el schema; se incluyen vía composición igual que el resto de nodos).
- **Tests**:
  - **Ficheros de test**:
    - `src/tests/config-validation/runtime-config-validation-file-manager.test.ts` (nuevo).
  - **Comportamiento cubierto** (solo shape; presencia cruzada en T7):
    - Acepta un nodo `fileManager` con todas las props pobladas según el ejemplo del contrato JSON de la spec.
    - Acepta un nodo `fileManager` mínimo con `fieldName: 'x'` y sin operaciones explícitas.
    - Acepta operaciones como `string` y como `false` indistintamente en cada campo.
    - Rechaza si `type: 'fileManager'` aparece sin objeto `props` (debe existir el objeto, aunque sea vacío).
    - Rechaza si `getOperation` es `true` (solo `string | false` permitidos).
    - Rechaza si `multiple` no es booleano.
    - Rechaza si `pagination.pageSize` no es entero positivo (0 o negativo).
    - Rechaza si `validations.accept` no es array de strings.
    - Rechaza si `validations.maxFileSize` no es número.
    - Rechaza si `validations.validFileNames` contiene una regex inválida (en este nivel solo se exige array de strings; la validez de la regex se delega a T7).
    - Acepta `layout.span`, `visibility` y `queryStateFeedback` declarados a nivel de nodo (regresión transversal).
  - **Comandos durante la implementación**:
    - `pnpm test --run src/tests/config-validation/runtime-config-validation-file-manager.test.ts`
  - **Restricciones**:
    - No introducir reglas de presencia cruzada en este fichero ni en el schema (eso es T7).
    - Seguir literalmente el patrón de schemas de nodos hoja vecinos (`alertNodeSchema`, `statNodeSchema`, `dividerNodeSchema`).
- **Documentación afectada**: ninguna en esta tarea.
- **Criterios de finalización**: el schema acepta y rechaza correctamente por shape; los tests cubren los casos clave; el resto de schemas siguen intactos.
- **Cierre de implementación**: schema listo y cubierto por tests; `pnpm test` global cumple umbral del 80%.

---

## T7 — Validación bootstrap de `fileManager` (presencia cruzada y placement)

- **ID**: T7
- **Estado**: pending
- **Objetivo**: Implementar `validateFileManagerNode` en un nuevo módulo `src/config/validate-file-manager-nodes.ts` (decisión fija; el nodo es standalone y no pertenece al dominio de `validate-form-nodes.ts`). Validar reglas de presencia cruzada y placement, y registrar el dispatcher en `validate-runtime-config.ts` para que reconozca el tipo `fileManager`.
- **Fuera de alcance**:
  - Lógica runtime del nodo (T8/T9).
  - Validar shape básico (T6).
- **Dependencias**: T6.
- **Impacto esperado en archivos**:
  - código:
    - `src/config/validate-file-manager-nodes.ts` (nuevo): exportar `validateFileManagerNode(rawNode, path, pageId, { apiOperationNames, apiOperationMethods }): { status: 'ready'; node } | { status: 'error'; error }`.
    - `src/config/validate-runtime-config.ts` y/o `validate-layout-nodes.ts` (modificar): enrutar el tipo `'fileManager'` hacia el nuevo validador y pasarle `apiOperationNames` y `apiOperationMethods` (ya disponibles en el contexto cross-check de otras validaciones).
    - `src/config/validate-form-nodes.ts` (modificar): añadir la regla de placement que prohíbe `fileManager` como descendiente de `form.children` con mensaje exacto `Page "${pageId}" has an invalid layout at "${path}": "fileManager" is not allowed inside a form.`. El walker recursivo del subárbol del form debe detectar el tipo a cualquier profundidad.
  - tests:
    - `src/tests/config-validation/runtime-config-validation-file-manager.test.ts` (ampliación T6 → en esta tarea ya existe).
  - documentación: ninguna en esta tarea.
- **Cambios concretos**:
  - Reglas (todas con ruta exacta en el mensaje de error):
    1. Si todas las operaciones (`getOperation`, `uploadOperation`, `deleteOperation`, `viewOperation`, `downloadOperation`) son `false` o están ausentes → rechazar con `Page "${pageId}" has an invalid layout at "${path}.props": at least one operation must be enabled.`.
    2. Si alguna operación está omitida (no `false`, no `string`) y `fieldName` no está declarado → rechazar con `Page "${pageId}" has an invalid layout at "${path}.props.fieldName": fieldName is required when an operation is omitted.`.
    3. Cada operación declarada como `string` debe existir en `config.api`. Si no existe → rechazar con `Page "${pageId}" has an invalid layout at "${path}.props.${operationKey}": operation "${name}" is not declared in api.`.
    4. `viewOperation`/`downloadOperation` declaradas como `string` deben corresponder a operaciones `GET`. Si no → rechazar con `Page "${pageId}" has an invalid layout at "${path}.props.${operationKey}": operation "${name}" must use method "GET" for view/download links.`.
    5. `validations.validFileNames`: cada entrada debe ser una regex válida (`new RegExp(entry)` no lanza). Si falla → rechazar con `Page "${pageId}" has an invalid layout at "${path}.props.validations.validFileNames[${i}]": invalid regex.`.
    6. `validations.maxFileSize`, `validations.maxTotalSize`, `validations.minFiles`, `validations.maxFiles`: enteros ≥ 0. Si negativos → rechazar con ruta exacta `${path}.props.validations.${ruleName}`.
    7. `validations.maxFiles`, si está presente con `validations.minFiles`, debe ser ≥ `minFiles`. Si no → rechazar con `Page "${pageId}" has an invalid layout at "${path}.props.validations.maxFiles": maxFiles must be greater than or equal to minFiles.`.
    8. `pagination.pageSize` entero positivo (T6 ya lo cubre estructuralmente; aquí se confirma en cross-check si T6 lo dejó como opcional sin coerción).
    9. **Placement**: `fileManager` no puede aparecer dentro de `form.children` (a cualquier profundidad dentro del subárbol del form). El walker recursivo de `validateFormNodesInCollection` (o equivalente) emite el error literal de la regla. **Sí** puede aparecer dentro de cualquier otro contenedor (`container`, `repeater.props.template`, `tabs`, `accordion`, `modal`).
- **Tests**:
  - **Ficheros de test**:
    - `src/tests/config-validation/runtime-config-validation-file-manager.test.ts` (ampliación de T6).
  - **Comportamiento cubierto**:
    - Acepta el ejemplo del contrato JSON de la spec con todas las operaciones declaradas y `validations` completas.
    - Rechaza si todas las operaciones son `false` con ruta exacta `${path}.props`.
    - Rechaza si todas las operaciones están omitidas y no hay `fieldName`.
    - Acepta si todas las operaciones están declaradas como `string` o `false` y no hay `fieldName`.
    - Acepta modo legacy con `fieldName: 'documentos'` y todas las operaciones omitidas.
    - Rechaza si `uploadOperation: 'noExiste'` no está en `config.api` con ruta exacta `${path}.props.uploadOperation`.
    - Rechaza si `viewOperation: 'postOperation'` apunta a una operación POST con mensaje exacto que cita el método requerido `GET`.
    - Rechaza si `validations.validFileNames: ['[invalid(']` contiene una regex que no parsea con ruta exacta `${path}.props.validations.validFileNames[0]`.
    - Rechaza si `validations.maxFileSize: -1` con ruta exacta `${path}.props.validations.maxFileSize`.
    - Rechaza si `validations.maxFiles: 2` y `validations.minFiles: 5`.
    - Rechaza si un `fileManager` aparece como hijo directo de `form.children` con mensaje exacto que cita `"fileManager" is not allowed inside a form.`.
    - Rechaza si un `fileManager` aparece dentro de un `container` que a su vez está dentro de `form.children` (placement transitivo).
    - Acepta `fileManager` dentro de `container`, `repeater.props.template`, `tabs.props.items[].children`, `accordion.children`, `modal.children` con regresiones por cada contenedor.
    - Acepta `fileManager` con `visibility` y `queryStateFeedback` declarados a nivel de nodo (regresión transversal).
  - **Comandos durante la implementación**:
    - `pnpm test --run src/tests/config-validation/runtime-config-validation-file-manager.test.ts`
  - **Restricciones**:
    - Reusar el patrón de cross-check de `validateOnSuccessActionTargets` para errores con ruta exacta.
    - No abrir el schema Zod a casos no previstos; mantener la separación shape (T6) vs cross-check (T7).
    - Cubrir TODOS los casos de error con verificación de la ruta exacta en `result.error.message`.
- **Documentación afectada**: ninguna en esta tarea.
- **Criterios de finalización**: todas las reglas de presencia y placement con tests verdes y rutas exactas; los tests existentes de otros validadores siguen pasando.
- **Cierre de implementación**: validación bootstrap completa; `pnpm test` global cumple umbral del 80%.

---

## T8 — Hook `useFileManager` y operaciones legacy

- **ID**: T8
- **Estado**: pending
- **Objetivo**: Implementar `useFileManager(node)` en `src/runtime/nodes/file-manager/use-file-manager.ts` con el reducer local (cola en curso, errores inline, flash visual, página actual, estado DnD) y la pipeline operativa: get inicial, validación con `evaluateFileManagerBatch`, normalización con `normalizeFileName`, subida secuencial, borrado, y construcción de URL para Ver/Descargar. Materializar las operaciones legacy en `src/runtime/nodes/file-manager/legacy-operations.ts` (helpers `buildLegacy*Operation`). Reflejar los slots `__fileManager__:{fieldName}:{get|upload|delete}` en `queries.*` para modo legacy y consumir `queries.{operationName}` para modo declarado.
- **Fuera de alcance**:
  - Render de JSX (subcomponentes y dispatcher): T9.
  - Cambios en `runtime-state-provider.tsx` que no estén estrictamente necesarios para escribir los slots legacy en `queries.*`. La extensión mínima del provider en esta tarea es la **materialización directa de D8+D9 del design** (no es una decisión nueva): D8 fija que upload/delete legacy llaman a `executeInlineRuntimeApiOperation` (introducido en T2) y D9 fija que el resultado se refleja en `queries.__fileManager__:{fieldName}:{op}`. Para conectar ambos sin abrir nuevos dominios de estado, esta tarea expone una sola función en el provider: `executeInlineQueryOperation(slotName, { operation, requestParams, iterationContext })`. Esta función no introduce semántica nueva: reusa literalmente la misma maquinaria de snapshot/loading que `executeQueryOperationWithSnapshot`, parametrizada por `slotName` en lugar de leer `operationName` de la operación. No se introduce ningún otro punto de entrada al store de queries.
- **Dependencias**: T1, T2, T4, T5; T6/T7 deben estar cerradas (el hook consume el shape ya validado).
- **Impacto esperado en archivos**:
  - código:
    - `src/runtime/nodes/file-manager/use-file-manager.ts` (nuevo): hook con reducer, refs, callbacks y pipeline.
    - `src/runtime/nodes/file-manager/legacy-operations.ts` (nuevo): helpers `buildLegacyGetOperation(fieldName)`, `buildLegacyUploadOperation(fieldName, fileField)`, `buildLegacyDeleteOperation(fieldName)`, `buildLegacyViewDownloadOperation(fieldName)` que devuelven `RuntimeApiOperation` literal. La URL base del modo legacy es `'/subirFicheros.aspx'` por convención heredada (literal de la legacy doc).
    - `src/runtime/nodes/file-manager/file-manager-types.ts` (nuevo): estado del reducer (`FileManagerLocalState`), acciones discriminadas (`FileManagerAction`).
    - `src/runtime/runtime-state/runtime-state-provider.tsx` (modificar): exponer `executeInlineQueryOperation(slotName, { operation, requestParams, iterationContext })` que escriba en `queries[slotName]` con la misma maquinaria que `executeQueryOperationWithSnapshot`. Reutilizar los selectores existentes.
    - `src/runtime/nodes/file-manager/build-file-link-url.ts` (nuevo) — encapsula la construcción de URL para Ver/Descargar (operación declarada vía `buildRuntimeApiRequest` con `requestParams.query`; operación legacy vía `buildLegacyViewDownloadOperation` + `buildInlineRuntimeApiRequest`). Devuelve `{ status: 'ready'; url } | { status: 'error' }`. **Este fichero lo crea T8** (no T9). T9 solo lo consume.
  - tests:
    - `src/tests/runtime/runtime-file-manager-hook.test.tsx` (nuevo): tests del hook con render harness mínimo (`@testing-library/react` `renderHook` o un componente envoltorio que ya esté en uso en otros tests del runtime).
  - documentación: ninguna en esta tarea.
- **Cambios concretos**:
  - Estado local (literal):
    ```ts
    interface FileManagerLocalState {
      dndPhase: 'idle' | 'drag-over' | 'uploading' | 'success' | 'error'
      pending: File[]
      currentIndex: number | null
      completed: number
      total: number
      inlineErrors: string[]
      successFlashUntil: number | null
      page: number
      deletingFileId: string | number | null
    }
    ```
  - Acciones discriminadas: `'drag-enter'`, `'drag-leave'`, `'select-files'`, `'upload-progress'`, `'upload-error'`, `'upload-complete'`, `'clear-success-flash'`, `'set-page'`, `'delete-start'`, `'delete-end'`.
  - Pipeline `selectFiles(files: File[])`:
    1. Resolver `existingFiles` desde `queries.{getOperation}.data` con `listPath` (modo declarado) o desde `queries.__fileManager__:{fieldName}:get.data` (modo legacy), mapeando con `fileIdField`/`fileNameField`.
    2. Llamar a `evaluateFileManagerBatch(node.props.validations, existingFiles, files)`.
    3. Manejo de `rejection` (sin contradicciones):
       - Si `rejection.scope === 'batch'`: `acceptedFiles` está vacío por contrato de T4; dispatch `'upload-error'` con el mensaje del `rejection`; NO se sube ningún fichero.
       - Si `rejection.scope === 'per-file'`: dispatch `'upload-error'` con el mensaje del `rejection` (un único mensaje inline correspondiente al primer fichero rechazado por T4); LA SUBIDA CONTINÚA con los ficheros de `acceptedFiles`.
       - Si `rejection` está ausente: sin mensaje inline; la subida continúa con `acceptedFiles` íntegro.
    4. Para cada fichero aceptado en orden, calcular `normalizedFile = new File([file], normalizeFileName(file.name, node.props.prefix), { type: file.type })`.
    5. Disparar las subidas en secuencia con `await`. En modo declarado: `executeQueryOperation(uploadOperationName, { requestParams: { files: [{ name: fileField, file: normalizedFile }] } })`. En modo legacy: `executeInlineQueryOperation(slotName, { operation: buildLegacyUploadOperation(fieldName, fileField), requestParams: { files: [{ name: fileField, file: normalizedFile }], body: { upload_multiple_field_name: fieldName } } })`.
    6. Tras cada respuesta exitosa, dispatch `'upload-progress'`. Si la respuesta resuelve `listPath`, la lista se renderiza desde `queries.{slot}.data` (no se almacena en el reducer local). Si la respuesta no resuelve `listPath`, dispatch `'upload-error'` con código interno `'upload-list-path-missing'` y mensaje literal `La respuesta de la subida no incluye la lista actualizada de ficheros.` (cadena estable verificable por los tests); la cola se detiene y no se intentan los ficheros pendientes.
    7. Tras la última subida exitosa, dispatch `'upload-complete'` con `successFlashUntil = Date.now() + 4000` (mantener 4s; documentado como "transcurridos unos segundos vuelve automáticamente a reposo"). Un `setTimeout` o `useEffect` con `mountedRef` resetea el flash a `idle`.
  - Pipeline `deleteFile(file)`:
    - Modo declarado: `executeQueryOperation(deleteOperationName, { requestParams: { body: { [fileIdField]: file[fileIdField] } } })`.
    - Modo legacy: `executeInlineQueryOperation(slotName, { operation: buildLegacyDeleteOperation(fieldName), requestParams: { body: { upload_multiple_field_name: fieldName, upload_multiple_file_id: file[fileIdField] } } })`.
    - Si la respuesta resuelve `listPath`, la lista se actualiza desde la respuesta. Si no, borrado optimista de la lista local (gestionado por el reducer del nodo cuando la respuesta llega sin `listPath`).
    - Errores → error inline; el fichero permanece en lista.
  - `mountedRef` declarado con `useRef(true)` y reseteado a `false` en cleanup del `useEffect`. Cada `dispatch` post-await comprueba `mountedRef.current` antes de aplicar.
  - Helpers `buildLegacy*Operation`:
    - `buildLegacyGetOperation(fieldName) → { method: 'GET', endpoint: '/subirFicheros.aspx', query: { upload_multiple_field_name: fieldName } }`.
    - `buildLegacyUploadOperation(fieldName, fileField) → { method: 'POST', endpoint: '/subirFicheros.aspx' }` (los pares se pasan vía `requestParams.body` y el binario vía `requestParams.files`).
    - `buildLegacyDeleteOperation(fieldName) → { method: 'POST', endpoint: '/subirFicheros.aspx' }` (los pares se pasan vía `requestParams.body`).
    - `buildLegacyViewDownloadOperation(fieldName) → { method: 'GET', endpoint: '/subirFicheros.aspx' }` (los params dinámicos vía `requestParams.query`).
- **Tests**:
  - **Ficheros de test**:
    - `src/tests/runtime/runtime-file-manager-hook.test.tsx` (nuevo).
  - **Comportamiento cubierto**:
    - Get inicial en modo declarado: al montar, el hook dispara `getOperation`. Confirmar con mock del executor.
    - Get inicial en modo legacy: al montar con `fieldName: 'documentos'` y `getOperation` omitida, el hook dispara `executeInlineQueryOperation('__fileManager__:documentos:get', ...)` con la `RuntimeApiOperation` esperada.
    - Get omitida y sin `fieldName`: el hook arranca sin disparar nada y con lista vacía.
    - Subida exitosa de 3 ficheros: el hook dispara 3 llamadas secuenciales, el `state.completed` avanza tras cada una, el `state.total` permanece en 3 y al final `dndPhase === 'success'`.
    - Subida con un fallo en el segundo de 3: tras el éxito del primero el contador avanza a 1; tras el fallo del segundo, los restantes NO se intentan y `dndPhase === 'error'`.
    - Subida cuya respuesta de éxito (200 OK con `status: 'OK'`) NO incluye `listPath` resoluble: el hook dispara `'upload-error'` con código `'upload-list-path-missing'` y mensaje literal `La respuesta de la subida no incluye la lista actualizada de ficheros.`; la cola se detiene; los ficheros pendientes del lote no se intentan; la lista actual del estado canónico (`queries.{slot}.data`) no se modifica.
    - Subida con `rejection` per-file (`accept` MIME inválido): los aceptados se suben; el rechazado emite mensaje inline; el contador `total` refleja solo los aceptados.
    - Subida con `rejection` batch (`maxFiles` superado): no se intenta ninguna subida; mensaje inline corresponde a la regla.
    - `normalizeFileName` se aplica al fichero antes de subir: la `File` enviada al executor tiene el `name` normalizado (verificable inspeccionando el argumento del mock).
    - `prefix` se aplica al `name` enviado: con `prefix: 'EXP'`, el fichero llega con `EXP_documento.pdf`.
    - Borrado: dispatch a `deleteOperation` con `body: { [fileIdField]: id }`. Verificar args del mock.
    - Borrado en modo legacy: dispatch a `executeInlineQueryOperation` con la `RuntimeApiOperation` legacy y `body: { upload_multiple_field_name, upload_multiple_file_id }`.
    - Borrado con respuesta sin `listPath`: borrado optimista (el fichero deja de aparecer en la lista visible).
    - `mountedRef`: si la respuesta del último upload llega tras unmount, el dispatch se descarta (sin warning de React `setState on unmounted component`).
    - `successFlashUntil`: tras completar todas las subidas, transcurridos los 4s simulados con `vi.useFakeTimers()`, el `dndPhase` vuelve a `'idle'`.
    - `executeInlineQueryOperation` está expuesto desde el provider y devuelve un `RuntimeApiExecutionResult` consistente (regresión cubierta brevemente en este fichero).
  - **Comandos durante la implementación**:
    - `pnpm test --run src/tests/runtime/runtime-file-manager-hook.test.tsx`
    - `pnpm test --run src/tests/runtime-state/runtime-state-operations.test.tsx` (asegurar que la extensión del provider no rompe regresiones).
  - **Restricciones**:
    - Reusar los helpers ya existentes: `executeQueryOperation` (declarado), `executeInlineRuntimeApiOperation` (T2), `evaluateFileManagerBatch` (T4), `normalizeFileName` (T5).
    - No introducir un store global paralelo a `queries.*`.
    - Reusar el patrón de `mountedRef` ya presente en el repo (otros hooks del runtime lo aplican; replicar literal).
    - No introducir reintento automático ni cancelación de cola por usuario; la spec lo excluye.
- **Documentación afectada**: ninguna en esta tarea.
- **Criterios de finalización**: hook orquestando get/upload/delete con cobertura por tests; provider extendido con `executeInlineQueryOperation` para slots inline; legacy operativo.
- **Cierre de implementación**: hook operativo y testeado; `pnpm test` global cumple umbral del 80%.

---

## T9 — Componentes visuales, dispatcher y paginación

- **ID**: T9
- **Estado**: pending
- **Objetivo**: Implementar los componentes JSX del nodo (`FileManagerNode`, `FileManagerDropZone`, `FileManagerProgress`, `FileManagerList`, `FileManagerRow`, `FileManagerErrorList`) en `src/runtime/nodes/file-manager/`, registrar `case 'fileManager'` en `layout-node-renderer.tsx` y consumir `runtime-collection-pagination.ts` (variante `previousNext`) para la lista. Construir el `href` de los botones Ver/Descargar con `build-file-link-url.ts` (T8). Cumplir requisitos de accesibilidad de la spec (ARIA en zona DnD, input nativo accesible por teclado).
- **Fuera de alcance**:
  - Hook y lógica de subida (T8).
  - Temas o colores configurables desde JSON (la spec lo excluye).
  - Animaciones distintas a estados visuales declarados (`idle`/`drag-over`/`uploading`/`success`/`error`).
- **Dependencias**: T8.
- **Impacto esperado en archivos**:
  - código:
    - `src/runtime/nodes/file-manager-layout-node.tsx` (nuevo): componente raíz `FileManagerNode` que llama al hook y compone los subcomponentes. Estilos Tailwind. Aplica `layout.span`, `visibility` y `queryStateFeedback` por las reglas globales ya en uso.
    - `src/runtime/nodes/file-manager/file-manager-drop-zone.tsx` (nuevo).
    - `src/runtime/nodes/file-manager/file-manager-progress.tsx` (nuevo).
    - `src/runtime/nodes/file-manager/file-manager-list.tsx` (nuevo).
    - `src/runtime/nodes/file-manager/file-manager-row.tsx` (nuevo).
    - `src/runtime/nodes/file-manager/file-manager-error-list.tsx` (nuevo).
    - `src/runtime/layout-node-renderer.tsx` (modificar): añadir `case 'fileManager'` que delega en `FileManagerNode`.
    - `src/runtime/nodes/file-manager/build-file-link-url.ts` (nuevo, ya declarado en T8 — si T8 no lo crea, lo crea T9; el contrato vive en T8).
  - tests:
    - `src/tests/layout-renderer/layout-renderer-file-manager.test.tsx` (nuevo).
  - documentación: ninguna en esta tarea (la creación de fichas funcionales corresponde a `update-app-documentation`).
- **Cambios concretos**:
  - `FileManagerDropZone`:
    - Renderiza un `div` con `role="button"`, `aria-label="Drop zone for ${fieldName ?? 'files'}"`, `tabIndex={0}`, manejadores `onDragOver`, `onDragLeave`, `onDrop`. Incluye un `<input type="file" multiple={node.props.multiple ?? true} accept={node.props.validations?.accept?.value?.join(',')}>` accesible por teclado (label sobre el botón nativo o disparo de `inputRef.current?.click()` en `Enter`/`Space`).
    - Estado visual derivado de `dndPhase`: clases Tailwind para `idle | drag-over | uploading | success | error`.
    - Si `node.props.uploadOperation === false`, la zona DnD no se renderiza.
    - Si la lista ha alcanzado `maxFiles`, se renderiza la zona pero con un mensaje informativo "Límite alcanzado" y se deshabilita la interacción (no acepta drop ni click).
    - Mientras `dndPhase === 'uploading'`, no acepta drops ni clicks; muestra `FileManagerProgress`.
  - `FileManagerProgress`: renderiza `({completed}/{total}) {percent}%` y una barra `width: percent%`. `percent = total === 0 ? 0 : Math.round((completed / total) * 100)`.
  - `FileManagerList`:
    - Consume `queries.{slot}.data` y mapea con `listPath` para obtener el array. Aplica `runtime-collection-pagination` (variante `previousNext`) con `pageSize = node.props.pagination?.pageSize ?? 10`.
    - Renderiza cada fila con `FileManagerRow`.
    - Si la lista resuelta está vacía, muestra el estado de vacío informativo.
    - Si la query de `getOperation` está en estado de error, muestra el error de carga (sin condicionar la presencia de la zona DnD).
  - `FileManagerRow`:
    - Renderiza el `fileNameField` como etiqueta.
    - Botones según operación configurada:
      - `viewOperation !== false`: enlace `<a href={url} target="_blank" rel="noopener noreferrer">Ver</a>`. Si `buildFileLinkUrl` devuelve `error`, deshabilitar (renderizar `<span>` atenuado).
      - `downloadOperation !== false`: enlace `<a href={url} download>Descargar</a>`.
      - `deleteOperation !== false`: botón Eliminar que llama al callback del hook. Mientras `deletingFileId === file[fileIdField]`, el botón se renderiza deshabilitado.
  - `FileManagerErrorList`: lista los `inlineErrors` con role `alert`. Se vacía al disparar `'select-files'` (lógica en el reducer del hook, ya cubierta por T8; el componente solo renderiza la lista actual).
  - `FileManagerNode` (raíz):
    - Aplica `runtime-node-styling` y respeta `layout.span`, `visibility`, `queryStateFeedback` igual que el resto de nodos (ya cubierto por el dispatcher transversal; solo asegurar que el componente raíz expone `data-layout-node="fileManager"`).
- **Tests**:
  - **Ficheros de test**:
    - `src/tests/layout-renderer/layout-renderer-file-manager.test.tsx` (nuevo).
  - **Comportamiento cubierto**:
    - Render mínimo: un nodo `fileManager` con `fieldName: 'docs'` muestra zona DnD vacía y lista vacía.
    - Estado visual de la zona DnD: tests unitarios del subcomponente `FileManagerDropZone` que reciben `dndPhase` como prop y verifican que las clases Tailwind / `data-state` cambian para `idle`, `drag-over`, `uploading`, `success`, `error`. Estos tests NO ejercitan el hook ni la subida real; el subcomponente es presentacional. Los tests integrados de transición de fase (subida real → `dndPhase` real) viven en `runtime-file-manager-hook.test.tsx` (T8); este fichero no los duplica.
    - `uploadOperation: false` → la zona DnD no aparece en el DOM.
    - `maxFiles` alcanzado: la zona DnD muestra el mensaje de límite y no responde a drops (verificar con un evento `drop` simulado que no dispara ninguna llamada al executor mock).
    - Lista con 12 ficheros mockeados en `queries.{getOperation}.data` y `pagination.pageSize: 5`: solo 5 filas renderizadas; controles `previousNext` permiten navegar a la siguiente página y muestran las 5 siguientes; última página muestra 2.
    - Vacío: con respuesta de get sin ficheros, se renderiza el estado de vacío informativo.
    - Error de carga: con `queries.{getOperation}` en estado de error, se muestra mensaje de error y la zona DnD sigue presente cuando `uploadOperation` no es `false`.
    - Botones por fila: con `viewOperation: 'viewDoc'`, `downloadOperation: false`, `deleteOperation: 'deleteDoc'`, cada fila muestra Ver y Eliminar pero NO Descargar.
    - Ver: `<a href>` con la URL construida por `buildFileLinkUrl` (mockeado o resuelto contra `config.api`); confirmar `target="_blank"` y `rel="noopener noreferrer"`.
    - Descargar: `<a>` con atributo `download` cuando `downloadOperation` es string GET.
    - URL no construible (operación con endpoint que no resuelve referencias): el enlace se renderiza como `<span>` atenuado sin ruptura de fila.
    - Botón Eliminar dispara el callback (mockeado vía hook) con el `file[fileIdField]` correcto.
    - Accesibilidad: la zona DnD tiene `role="button"`, `tabIndex={0}` y `aria-label` legible. El input nativo es focuseable por Tab.
    - Integración con `visibility`: con `visibility: { reference: ..., operator: 'equals', value: 'show' }` y el estado que cumple/no cumple, el nodo aparece/desaparece (regresión transversal estándar).
    - Integración con `queryStateFeedback.states.loading.fallback`: con la query asociada en `loading`, se renderiza el fallback declarado en lugar del nodo (regresión transversal estándar).
    - Dispatcher: el nodo aparece correctamente cuando se incluye en una página y atraviesa `layout-node-renderer.tsx` sin fallback de "tipo desconocido".
    - Submit independiente: en un layout con un `form` hermano y un `fileManager` paralelo, el submit del form NO incluye `File`s ni referencia al estado del fileManager (verificable inspeccionando el body de la llamada al executor del submit).
  - **Comandos durante la implementación**:
    - `pnpm test --run src/tests/layout-renderer/layout-renderer-file-manager.test.tsx`
    - `pnpm test --run src/tests/runtime/runtime-file-manager-hook.test.tsx` (regresión)
    - `pnpm test` (gate de cobertura final)
  - **Restricciones**:
    - Tailwind para estilos; sin estilos inline ni CSS adicional.
    - Reusar `runtime-collection-pagination.ts` sin duplicar lógica.
    - No introducir snapshots de DOM; verificar elementos por `data-*`, role, y assertion explícita.
    - Mantener la separación: el JSX no llama directamente a `executeQueryOperation`; solo llama a callbacks expuestos por el hook.
- **Documentación afectada**:
  - `ai-workflow/docs/app-features/nodes/index.md` — nueva entrada para `fileManager`.
  - `ai-workflow/docs/app-features/nodes/file-manager.md` — ficha nueva del nodo.
  - `ai-workflow/docs/app-features/forms/validation-rules.md` — nuevas reglas `accept`/`maxFileSize`/`maxTotalSize`/`minFiles`/`maxFiles`/`validFileNames` sobre `File[]`.
  - `ai-workflow/docs/current-state.md` — área "Subida de archivos" pasa de "fuera de v1" a "estable".
  - Estas actualizaciones se ejecutarán manualmente con `update-app-documentation`; ninguna tarea las cierra dentro de su propio scope.
- **Criterios de finalización**: el nodo se renderiza, integra get/upload/delete/ver/descargar, pagina, respeta `visibility`/`queryStateFeedback`/`layout.span`, accesibilidad ARIA cubierta y todos los criterios de aceptación de la spec verificados por tests.
- **Cierre de implementación**: nodo operativo end-to-end; `pnpm test` global cumple umbral del 80%.

---

## Documentación afectada (resumen para `update-app-documentation`)

Estas fichas se verán afectadas tras cerrar la implementación; ninguna tarea actualiza documentación dentro de su propio cierre. Se listan aquí para alimentar la skill `update-app-documentation`:

- `ai-workflow/docs/app-features/nodes/index.md` — añadir entrada para `fileManager` en la tabla del catálogo.
- `ai-workflow/docs/app-features/nodes/file-manager.md` — ficha nueva del nodo. Documentar:
  - shape JSON literal del contrato (todas las props),
  - modelo de operaciones `string | false | omitida`,
  - convención de respuesta `{ status, files }`,
  - placement (válido fuera de `form.children`, prohibido dentro),
  - reflejo en `queries.{operation}` y slots legacy `__fileManager__:{fieldName}:{op}`,
  - reglas de validación (lista de reglas y orden de evaluación),
  - normalización de nombre,
  - límites explícitos: sin chunked upload, sin preview, sin reordenación, sin headers de auth en enlaces Ver/Descargar.
- `ai-workflow/docs/app-features/forms/validation-rules.md` — añadir sección "Reglas sobre `File[]` (fileManager)" con las nuevas reglas. Documentar que estas reglas NO escriben en `forms.*` y operan en estado local del nodo.
- `ai-workflow/docs/current-state.md` — promover el área "Subida de archivos" de "fuera de v1" a "estable" con referencia al nodo `fileManager`.

---

## Próxima tarea a ejecutar

T1.
