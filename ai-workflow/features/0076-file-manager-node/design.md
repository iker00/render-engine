# Design: Feature 0076 — fileManager node

## Contexto

El runtime actual tiene una superficie cerrada para llamar al backend:

- `src/queries/runtime-api-request.ts` resuelve `endpoint`, `query`, `body` y `headers` exclusivamente a partir de `RuntimeApiBodyValue` (JSON serializable) y `RuntimeApiQuery` (escalares). El builder serializa el body con `JSON.stringify` y fuerza `content-type: application/json` cuando no hay override.
- `src/queries/runtime-api-executor.ts` encapsula `fetch`, normaliza errores (`network-error`, `http-error`, `invalid-json-response`, `business-error-condition`) y parsea respuestas JSON.
- `executeQueryOperation` en `runtime-state-provider.tsx` es la única fachada pública para disparar una operación nominada y escribir el resultado en `queries.{operationName}`.
- `runtime-form-validations.ts` evalúa reglas (`required`, `minLength`, `maxLength`, `min`, `max`, `minSelections`, `maxSelections`) sobre valores almacenados en `forms.{formId}.{fieldId}.value`. La estructura `RuntimeFormFieldValidations` admite forma `{ value, message? }`.
- `validate-form-nodes.ts` solo acepta `input`, `textarea`, `select`, `radioGroup`, `checkboxGroup`, `button` y nodos puramente visuales como descendientes válidos. Cualquier tipo nuevo debe pasar por `runtime-config-zod.ts`, el dispatcher de `layout-node-renderer.tsx` y los validadores de bootstrap.

El componente legacy `FILE-UPLOAD.md` describe el contrato funcional cerrado de v0: `multipart/form-data` con discriminantes `upload_multiple_field_name`, `upload_multiple_file_id` y campo binario `file`. La spec 0076 conserva esa semántica como convención por defecto y la abre a operaciones declaradas en `api`.

Restricciones globales relevantes:

- La red vive solo en `src/queries/`. Ningún nodo visual construye `FormData`, `fetch` ni URLs.
- La resolución de referencias y el snapshot único de estado por disparo viven en `runtime-references/`.
- Tailwind para estilos. Sin theming declarativo desde JSON.
- Cobertura ≥ 80% sobre `src/`.

## Objetivos / No objetivos

### Objetivos

- Decidir cómo extender la fachada de queries para soportar payloads binarios sin romper el contrato actual JSON-only.
- Decidir dónde vive la evaluación de reglas que operan sobre `File[]` y cómo se integra con `runtime-form-validations`.
- Definir el modelo de estado: qué vive en `queries.*` (canon persistente) y qué vive en estado local del nodo (efímero de UI).
- Definir cómo el nodo inyecta valores dinámicos (file id) en `deleteOperation` sin abrir referencias ad hoc.
- Definir la construcción de URL para `viewOperation` y `downloadOperation` cuando son strings del catálogo `api`.
- Definir el modo legacy: cómo se materializa la convención por defecto cuando una operación está omitida sin reabrir el catálogo `api` a registros sintéticos.
- Definir el punto de extensión en bootstrap (`validate-runtime-config` y schemas Zod) para registrar `fileManager` como tipo de nodo nuevo, standalone, fuera del subárbol `form`.
- Trazar el lugar de la capa visual del nodo dentro de `src/runtime/nodes/`.

### No objetivos

- Reabrir la spec: no se redefine alcance funcional, criterios de aceptación ni casos límite ya cerrados.
- No se diseña subida por chunks, preview, reordenación, edición de metadatos ni validación remota.
- No se reescribe el catálogo `api` ni se rediseñan operaciones existentes.
- No se introduce un nuevo dominio de estado paralelo a `forms.*`, `queries.*` ni `navigation.*`.
- No se define theming para el nodo. Sólo Tailwind con tokens globales (`bg-app-surface`, `text-app-text`, etc.).
- No se diseñan i18n ni mensajes personalizados configurables; se reutiliza el patrón vigente de mensajes por defecto.
- No se trocea el trabajo en tareas; eso pertenece a `generate-implementation-plan`.

## Decisiones

### D1. Payload binario: nuevo campo `files` en `RuntimeApiRequestParams`

Se extiende `RuntimeApiRequestParams` con un campo opcional `files?: RuntimeApiFileField[]` donde `RuntimeApiFileField = { name: string; file: File }`. El campo `body` sigue siendo JSON serializable como hasta ahora; cuando coexisten `body` y `files`, el body JSON se aplana al primer nivel como pares clave-valor textuales del mismo `FormData`.

- **Por qué**: hacer explícita la intención de subida en lugar de inferirla por detección de `File` dentro de `body`. La detección implícita rompería la invariante de `RuntimeApiBodyValue` (JSON puro) y obligaría a Zod a aceptar tipos no serializables.
- **Alternativa descartada**: mezclar `File` dentro de `body`. Ensucia el contrato JSON, complica el merge superficial (`mergeRuntimeApiBody`) y rompe el cálculo de `requestSignature` (que serializa con `JSON.stringify`).
- **Trade-off**: el body en modo multipart se limita a pares texto en raíz. Subárboles JSON anidados no son representables como campo de `FormData`. Es aceptable: la convención legacy y el catálogo `api` para upload usan campos planos.
- **Riesgo residual**: si una operación declara `body` con sub-objetos en el catálogo y se usa como `uploadOperation`, se rechaza en build con `request-build-failed` con mensaje específico (multipart sólo admite pares planos).

### D2. Detección y materialización del request multipart en `runtime-api-request.ts`

`buildRuntimeApiRequest` detecta `effectiveRequestParams.files` resuelto y no vacío. Cuando lo hay:

- Construye un `FormData` con cada `{ name, file }` añadido como `formData.append(name, file, file.name)`.
- Resuelve `body` con la misma maquinaria de referencias actual; cada par del body resultante se añade como `formData.append(key, String(value))`. Sólo se permiten valores escalares (`string | number | boolean`) en raíz; otros tipos producen `request-build-failed` con detalle del campo problemático.
- No setea `content-type` automáticamente: con `FormData` la API de `fetch` añade `multipart/form-data` con boundary correcto. Si el operador declara `content-type` explícito en `headers`, se preserva tal cual (consistente con la regla actual del builder).
- `requestSignature` excluye `files` (los `File` no son comparables por igualdad estable). Se firma `descriptor` con `files` representado como `[{ name, fileName, size, type }, ...]` para conservar estabilidad razonable y permitir deduplicación de loading states. La estabilidad exacta no es crítica porque cada subida es una operación discreta.

- **Por qué aquí**: mantiene la frontera arquitectónica: ningún nodo visual construye `FormData`. La materialización vive en la misma capa que ya compone JSON.
- **Alternativa descartada**: crear `runtime-multipart-request.ts` paralelo. Duplicaría la resolución de referencias y forzaría dos fachadas de ejecución divergentes.

### D3. Ejecución multipart en `runtime-api-executor.ts`

`executeBuiltRuntimeApiRequest` no cambia: `fetch(request.url, request.init)` ya acepta `init.body: FormData`. La respuesta sigue tratándose como texto y parseándose como JSON, manteniendo `business-error-condition`/`errorCondition` igual.

- **Por qué**: la asimetría es solo en la construcción. La respuesta sigue siendo JSON con el shape `{ status, files? }`.
- **Riesgo residual**: si una upload responde con body no JSON, se trata como `invalid-json-response`. Consistente con el resto del runtime.

### D4. Validaciones de fichero: extensión de `runtime-form-validations.ts`

Se extiende la unión `ResolvedFormFieldDefinition` con un nuevo target `{ type: 'fileManager'; validations?: RuntimeFileManagerValidations }`. Se añade `RuntimeFileManagerValidations` al modelo público con shape:

```ts
{
  accept?: { value: string[]; message?: string }
  maxFileSize?: { value: number; message?: string }
  maxTotalSize?: { value: number; message?: string }
  minFiles?: { value: number; message?: string }
  maxFiles?: { value: number; message?: string }
  validFileNames?: { value: string[]; message?: string }
}
```

Se introduce `evaluateFileManagerBatch(validations, existingFiles, incomingBatch): FileManagerValidationResult` en el mismo módulo. La función devuelve `{ acceptedFiles, rejection? }` donde `rejection` describe la primera regla violada en el orden declarado, distinguiendo rechazo por fichero (`per-file`) vs rechazo de lote (`batch`).

- **Por qué en el mismo módulo**: la spec lo pide explícitamente para preparar un futuro `fileInput`. Mantener la unidad operativa permite reutilizar las reglas sin nueva superficie.
- **Por qué no compartir el catálogo `RuntimeFormFieldValidations` existente**: las reglas tienen shape distinto (`string[]` para `accept`, números absolutos para `maxFileSize`/`maxTotalSize`). Forzarlas al shape `{ value: number; message? }` actual confundiría la semántica. Se opta por una unión nueva `RuntimeFileManagerValidations` con la misma forma extendida `{ value, message? }`.
- **Trade-off**: el módulo gana un eje de variación. Se acepta porque `runtime-file-validations.ts` paralelo duplicaría la canalización de "primer error visible" y rompería la unidad de `getFirstVisibleValidationError`.
- **No se reusa `forms.*`**: el fileManager no escribe en `forms.{formId}.{fieldId}.error`. Su error inline vive en estado local del nodo.

### D5. Estado: canon en `queries.*`, efímero en estado local del nodo

- `queries.{getOperation}` mantiene la lista canónica de ficheros (`data` cruda según `listPath`).
- `queries.{uploadOperation}` y `queries.{deleteOperation}` reflejan la última llamada individual (status, error tipado, datos de respuesta).
- Estado local del nodo (`useReducer` o `useState`):
  - lote en curso (cola pendiente, índice actual, contador `subidos / total`).
  - errores inline de validación cliente (no nacen de una query).
  - flash visual de éxito (visibilidad temporizada).
  - estado de la zona DnD (`idle | drag-over | uploading | success | error`).
  - página actual de la lista paginada.

- **Por qué**: el estado efímero no participa en `visibility` ni en `queryStateFeedback` de otros nodos y no debe contaminar `queries.*`. El estado canónico (la lista, status por operación) ya lo cubre el dominio de queries existente.
- **Alternativa descartada**: introducir un nuevo dominio `fileManagers.*` en el store global. Innecesario en v1; rompe la frontera del runtime-state.

### D6. Inyección de file id en `deleteOperation`: `requestParams` explícito

Cuando el usuario pulsa Eliminar, el nodo llama `executeQueryOperation(deleteOperationName, { requestParams: { body: { [fileIdField]: file[fileIdField] } } })`. La fachada existente ya admite override de `body` por ejecución y mergea con la operación declarada en el catálogo.

Para modo legacy (sin `deleteOperation` configurada, `fieldName` definido) el nodo no llama a la fachada `executeQueryOperation` (no hay operación registrada). En su lugar invoca un atajo interno (ver D8) que construye la request directamente con `buildRuntimeApiRequest` recibiendo una `RuntimeApiOperation` sintetizada en memoria.

- **Por qué**: no abre referencias ad hoc al estado compartido. El runtime-references queda intacto. El nodo es responsable de su propio identificador efímero (el file seleccionado en la fila), igual que un botón dentro de `repeater` resuelve su `item.*` por contexto local.
- **Alternativa descartada**: exponer un nuevo namespace `fileManager.*` para que el catálogo `api` resuelva `{{fileManager.selectedFileId}}`. Sobrediseño; introduce estado global para un caso aislado.

### D7. URL de Ver/Descargar: reuso de `buildRuntimeApiRequest`

Cuando `viewOperation`/`downloadOperation` son strings del catálogo, el nodo construye la URL por cada fila así:

1. Llama a `buildRuntimeApiRequest({ config, operationName, state, requestParams: { query: { [fileIdField]: file[fileIdField] } } })`.
2. Si `status === 'ready'`, usa `request.url` como `href` del `<a>`. Si `status === 'error'`, deshabilita el enlace y muestra fallback discreto (icono atenuado, sin row-break).

La operación declarada en el catálogo `api` debe ser `GET` (validable en bootstrap). El query param ya queda colgado del endpoint vía `appendQueryString`.

- **Por qué**: no añade lógica de URL en el nodo. Reutiliza la misma canalización que cualquier ejecución, pero corta antes del `fetch`. Coherente con la frontera de queries.
- **Riesgo residual**: si el endpoint require headers (auth) los enlaces de descarga vía `<a>` no los llevan. Es aceptable: el legacy usa cookies de sesión; el catálogo se debería usar con endpoints de descarga públicos o autenticados por sesión.

### D8. Modo legacy: operación sintetizada en memoria, no en `config.api`

Cuando alguna operación está omitida y `fieldName` está declarado, el nodo construye al vuelo objetos `RuntimeApiOperation` (no se modifica `config.api`). Estas operaciones legacy se materializan en un helper interno del nodo, p.ej.:

- `buildLegacyGetOperation(fieldName)`
- `buildLegacyUploadOperation(fieldName, fileField)`
- `buildLegacyDeleteOperation(fieldName)`
- `buildLegacyViewDownloadOperation(fieldName)` (sólo para construir URL)

Cada helper devuelve un objeto que el nodo pasa por una variante "operación inline" del builder. Para no duplicar lógica, se expone una segunda fachada en `src/queries/`: `buildInlineRuntimeApiRequest({ operation, state, requestParams })` que recibe la operación directamente en vez de buscarla en `config.api`. La fachada actual `buildRuntimeApiRequest` se reescribe sobre esta para evitar duplicación.

Para la ejecución (no sólo construcción de URL), se introduce `executeInlineRuntimeApiOperation` análoga a `executeRuntimeApiOperation`. Tanto upload como delete legacy llaman a `executeInlineRuntimeApiOperation` y se reflejan en un "slot" de queries reservado con un nombre estable derivado del `fieldName`, p.ej. `queries.__fileManager__:{fieldName}:upload` (ver D9).

- **Por qué**: no contamina `config.api` con entradas sintéticas y mantiene `validate-api-config` y validaciones cruzadas intactas. El nodo encapsula su contrato heredado sin que el resto del runtime tenga que conocerlo.
- **Alternativa descartada**: registrar las operaciones legacy en `config.api` durante una fase pre-validación. Rompe la idempotencia entre el JSON validado y el ejecutado, abre superficie de colisión de nombres y hace que entradas que el usuario no escribió aparezcan en `queries.*` con nombres ambiguos.
- **Trade-off**: hay que mantener dos puntos de entrada al builder/executor. Coste contenido porque el segundo es un thin wrapper del primero.

### D9. Reflejo en `queries.*` y naming determinista para slots legacy

- Operaciones declaradas (`uploadDocuments`, etc.) usan su nombre real en `queries.{operationName}` con la semántica actual.
- Operaciones legacy usan slots con prefijo reservado, formato: `__fileManager__:{fieldName}:upload | :delete | :get`. El prefijo `__fileManager__:` queda excluido de validaciones de nombre de operación pero accesible desde `queries.*` para que otros nodos puedan consumir estados con `queryStateFeedback`.
- Si `getOperation` está omitida y `fieldName` ausente, el nodo arranca vacío sin tocar `queries.*`.

- **Por qué naming determinista con prefijo**: permite que un consumidor declare `queryStateFeedback` sobre el slot legacy si lo necesita, manteniendo el mismo contrato visual que las operaciones declaradas. El prefijo `__fileManager__:` actúa como espacio reservado y es legible en debugging.
- **Trade-off**: introduce convención de naming. Aceptable en v1; documentable en la ficha del nodo y reservado bajo prefijo improbable de chocar con nombres reales.

### D10. Bootstrap: nuevo schema `fileManager` y reglas de presencia

- Se añade `fileManagerNodeSchema` en `runtime-config-zod.ts` reflejando las props del contrato JSON de la spec.
- Se añade `validateFileManagerNode` en `validate-form-nodes.ts` (o un nuevo `validate-file-manager-nodes.ts` si la longitud del módulo lo justifica) que:
  - Rechaza si todas las operaciones son `false` o están ausentes.
  - Rechaza si alguna operación está omitida y `fieldName` no está declarado.
  - Verifica que cada operación declarada como string referencia una entrada existente de `api`.
  - Verifica que `viewOperation`/`downloadOperation` declaradas como string corresponden a métodos `GET`.
  - Verifica el shape de `validations`: tipos primitivos, regex válidos en `validFileNames`, números no negativos, rangos coherentes.
  - Verifica `pagination.pageSize` entero positivo si está declarado.
- Se permite `fileManager` como descendiente arbitrario del layout (`validateFormNodesInCollection` admite la nueva variante igual que `container`/`accordion`, sin obligar a estar dentro de un `form`). No se incluye en la whitelist de hijos válidos de `form.children`; si aparece dentro de un `form`, se rechaza el layout, salvo decisión explícita posterior.

- **Por qué excluir de `form.children`**: el nodo no escribe en `forms.*` ni participa en submit. Permitirlo allí confundiría el contrato del formulario y abriría casos límite (¿reset incluye fileManager? ¿persistOnUnmount aplica?). Mantener fuera del subárbol form es coherente y evita superficie ambigua.
- **Trade-off**: el usuario que quiera "un formulario con campo de ficheros" debe usar dos nodos hermanos: un `form` para los campos textuales y un `fileManager` paralelo. Aceptable y consistente con que el upload no participe en el submit del formulario.

### D11. Capa visual: nuevo nodo en `src/runtime/nodes/`

- Componente raíz `FileManagerNode` en `src/runtime/nodes/file-manager-layout-node.tsx`.
- Componentes internos colocados en `src/runtime/nodes/file-manager/` (subcarpeta dedicada): `FileManagerDropZone`, `FileManagerProgress`, `FileManagerList`, `FileManagerRow`, `FileManagerErrorList`.
- Lógica de orquestación en hook `useFileManager(node)` en la misma carpeta, encapsulando el reducer local, la pipeline de validación, normalización y subida secuencial.
- El dispatcher central (`layout-node-renderer.tsx`) gana un nuevo `case 'fileManager'`.
- Estilos con utilidades Tailwind; estados visuales del drop zone con clases derivadas del estado local.

- **Por qué subcarpeta**: el nodo tiene varios subcomponentes y un hook con lógica densa. Mantener `src/runtime/nodes/` plano para nodos pequeños ya es la norma; los nodos con expansión interna (p. ej. `repeater`, `modal`) ya separan componentes auxiliares en módulos. Una subcarpeta dedicada conserva el patrón sin dispersar por `src/runtime/`.
- **Alternativa descartada**: un único fichero monolítico. Tamaño esperado >500 LOC, dificulta testing por unidad.

### D12. Normalización de nombre de fichero: helper aislado

`src/runtime/nodes/file-manager/normalize-file-name.ts` exporta `normalizeFileName(fileName, prefix?)` con la lógica especificada en la spec (caracteres inválidos Windows, trim de espacios y puntos, nombres reservados, truncamiento a 255, prefijo). Pure function, sin dependencias del runtime.

- **Por qué aislado**: facilita testing exhaustivo por casos y reutilización futura por un eventual `fileInput`.
- **Trade-off**: ninguno relevante.

### D13. Subida secuencial: control de cancelación en el reducer local

La cola se modela como `pending: File[]`, `current: { file, index } | null`, `completed: number`. Cada `executeQueryOperation` resuelta con éxito avanza al siguiente; cada fallo detiene la cola y deja `pending` intacto pero marca `phase: 'error'` con `failedFile` para feedback inline.

- **Por qué reducer**: cada disparo de upload tiene transiciones bien definidas y el react-state plano sería propenso a races. Un reducer cerrado evita actualizaciones incoherentes durante respuestas tardías.
- **Riesgo residual**: si el usuario desmonta el nodo durante una subida, la respuesta del último request puede llegar tras unmount. Mitigación: bandera `mountedRef` para descartar dispatch tras unmount, patrón ya usado en otros nodos.

### D14. Paginación: reuso de `runtime-collection-pagination.ts`

La lista de ficheros se pagina con el helper existente `runtime-collection-pagination.ts` (ya usado por `repeater` con variante `previousNext`), manteniendo el control visual coherente con el resto del runtime.

- **Por qué**: evita duplicar lógica de paginación y mantiene UX coherente.
- **Trade-off**: el helper exige una colección normalizada; basta con mapear `queries.{getOperation}.data` por `listPath` antes de paginar. Ya está cubierto por el cómputo derivado del nodo.

## Riesgos y trade-offs

| Riesgo | Mitigación |
|---|---|
| Extender la fachada de queries para multipart introduce divergencia entre dos formas de construir requests. | El thin wrapper `buildInlineRuntimeApiRequest` queda como único punto bajo. Tests específicos del builder cubren ambas rutas (JSON puro, multipart con files, mezcla files+body). |
| `requestSignature` para multipart es de estabilidad reducida (no hash de bytes). | Aceptable porque cada subida es discreta y la firma no se usa para deduplicación crítica en este flujo. Documentar en el slot de `state-model.md`. |
| El nodo introduce convención de naming `__fileManager__:{fieldName}:*` en `queries.*`. | Prefijo reservado e improbable de colisión. Se documenta en la ficha del nodo y se valida en bootstrap que ningún `api.{operationName}` use el prefijo. |
| Las validaciones sobre `File[]` rompen la unidad conceptual de `runtime-form-validations`. | Se modela como target distinto explícito (`type: 'fileManager'`) y se usa una unión nueva para `validations`. Reusa el patrón "primer error visible" sin contaminar reglas existentes. |
| Permitir `fileManager` fuera de `form` y prohibirlo dentro puede confundir a configuradores acostumbrados a "campos de formulario". | Documentar el motivo en la ficha funcional. El error de bootstrap es claro y temprano. Es coherente con que el submit del form contenedor no incluye ficheros. |
| URL de view/download no soporta headers de auth. | Documentar como límite explícito. Para v1 los endpoints de descarga se asumen accesibles por cookies de sesión. |
| Subida secuencial sin reintento puede dejar el lote a medias. | Spec ya lo acepta: la cola se detiene y muestra el fichero fallido. No se introduce reintento automático en v1. |
| El nodo desmontado durante subida puede provocar warnings. | `mountedRef` en el hook descarta dispatch tras unmount. |

## Migración o despliegue

- No hay migración de datos: el JSON antiguo de FileUpload no es runtime config.
- Compatibilidad con backends legacy: el modo legacy (operaciones omitidas con `fieldName`) preserva el contrato `multipart/form-data` con discriminantes `upload_multiple_field_name` y `upload_multiple_file_id`. El cambio es solo de superficie de configuración del frontend.
- Para configuraciones que ya estaban usando algún wrapper externo del runtime para subir ficheros, el cambio es aditivo: el nodo nuevo no afecta a otros nodos.
- Documentación: actualizar `ai-workflow/docs/app-features/nodes/index.md`, crear `nodes/file-manager.md`, ampliar `forms/validation-rules.md` con la nueva familia de reglas y promover el área "Subida de archivos" de `current-state.md` a estable.

## Preguntas abiertas

1. **`fileField` en operaciones declaradas con `body` no plano**: si el catálogo `api` declara `body` con sub-objetos para una `uploadOperation`, el builder lo rechaza (D1). Queda como riesgo de configuración detectable en bootstrap si la operación se referencia desde `fileManager.uploadOperation`. Esta validación cruzada se confirma o pospone en planning como tarea aparte. Sugerencia: incluirla.
2. **Slot legacy con `fieldName` que coincida con un `api.{operationName}` real**: por convención el prefijo `__fileManager__:` evita colisión, pero conviene confirmar en planning que `validate-api-config` rechaza explícitamente operaciones cuyo nombre empiece por `__fileManager__:`. Sugerencia: añadirlo a `validate-api-config`.
3. **Comportamiento si `getOperation` está habilitada y se llama varias veces durante reentrada de página**: la spec no fija refetch automático. Decisión propuesta: usar la misma política que el resto de queries (latest-only por `requestSignature`). Confirmar en planning si hace falta documentar este punto en la ficha.

---

Siguiente paso del flujo: `generate-implementation-plan`.
