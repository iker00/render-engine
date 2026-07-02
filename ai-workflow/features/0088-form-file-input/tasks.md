# Tasks — 0088: nodo `fileInput` en formulario

Contrato de ejecución secuencial para introducir el nodo `fileInput` dentro del catálogo de formularios. El orden T1 → T2 → T3 → T4 → T5 es obligatorio: las tareas posteriores asumen que el contrato declarativo (T1), las reglas de placement (T2) y la semántica de validación (T3) ya están cerradas.

Reglas universales:
- `pnpm test` queda como gate global de cobertura al cerrar la última tarea; no se repite por tarea.
- Reutilizar `evaluateFileManagerBatch` (`src/runtime/runtime-form-validations.ts`) como evaluador de selecciones; no duplicar reglas de fichero (`accept`, `maxFileSize`, `maxTotalSize`, `maxFiles`, `validFileNames`, 0 bytes, nombre duplicado).
- El estado del nodo vive en `forms.{formId}.{fieldId}.value` con shape `File[]`. `defaultValue` efectivo en runtime es `[]`; no se admite forma declarativa desde JSON.
- El submit serializa como `multipart/form-data` reutilizando la rama existente de `buildInlineRuntimeApiRequest` (`requestParams.files: RuntimeApiFileField[]`). El runtime no debe tocar `runtime-api-request.ts`.
- Los nodos `fileInput` ocultos por `visibility` / `queryStateFeedback` no participan en validación, en `requestParams.files` ni en la omisión de claves del payload.

---

## T1 — Contrato declarativo: tipos, Zod y validación de shape

### Estado
completed

### Objetivo
Introducir `fileInput` como nodo de configuración soportado, con su tipo TypeScript, esquema Zod y validador de shape, de forma que:
- `LayoutNodeType` y `supportedNodeTypes` reconozcan `'fileInput'`,
- el JSON acepte el shape declarado en la spec (props + validaciones extendidas `{ value, message? }` para `required`/`accept`/`maxFileSize`/`maxTotalSize`/`minFiles`/`maxFiles`/`validFileNames`, `capture: "environment" | "user"`, `multiple` opcional),
- cualquier shape incorrecto (tipos inválidos, `capture` fuera del enum, valores negativos en `maxFileSize`/`maxTotalSize`/`minFiles`/`maxFiles`, `accept` o `validFileNames` no array de strings) se rechace con `code: 'invalid-layout'` y ruta exacta `<path>.props…`,
- el nodo normalizado conserve `props.multiple` cuando esté declarado y aplique el default `true` solo en runtime (no en el config normalizado),
- el dispatcher de `validate-layout-nodes.ts` reconozca `'fileInput'` y devuelva el nodo normalizado.

Esta tarea cierra el contrato declarativo a nivel de shape. Las restricciones cruzadas (placement dentro de `form`, coherencia `capture + accept`, unicidad de `fieldId`) se cierran en T2.

### Fuera de alcance
- Cualquier render (`FileInputNode`, registro en `node-components-map.ts`).
- Cualquier cambio en `runtime-form-validations.ts`, `form-layout-node.tsx` o `runtime-api-request.ts`.
- Cross-checks semánticos (T2).

### Dependencias
Ninguna.

### Impacto esperado en archivos
- Código:
  - `src/config/runtime-config-types.ts` (mod) — añadir `'fileInput'` a `LayoutNodeType`, exportar `RuntimeFileInputValidations` (con `required?: RuntimeRequiredValidationRule`, `minFiles?: RuntimeNumericValidationRule` y las cinco reglas de fichero compartidas con `RuntimeFileManagerValidations`: `accept`/`maxFileSize`/`maxTotalSize`/`maxFiles`/`validFileNames`), exportar `FileInputLayoutNode` (con `type: 'fileInput'`, `id?`, `LayoutNodeFeedbackFields`, `LayoutNodeLayoutFields`, `props: { fieldId: string; label: string; multiple?: boolean; capture?: 'environment' | 'user'; validations?: RuntimeFileInputValidations }`), incluir `FileInputLayoutNode` en la union `LayoutNode`.
  - `src/config/runtime-config-zod.ts` (mod) — añadir `'fileInput'` al array `supportedNodeTypes`, exportar `supportedCaptureValues = ['environment', 'user'] as const`, exportar `fileInputNodeSchema` (Zod) con `validations` reutilizando el shape extendido `{ value, message? }`. Para `accept` y `validFileNames` exigir `z.array(z.string()).nonempty()`; para `maxFileSize`/`maxTotalSize`/`maxFiles`/`minFiles` exigir `z.number().positive()` (para enteros, mantener el patrón actual del repo). Para `required` reutilizar el shape `{ value: z.literal(true), message: z.string().optional() }` ya usado por el resto del catálogo (forma extendida obligatoria; no admitir `boolean` desnudo). Schema `.strip()` por defecto, igual que el resto de schemas.
  - `src/config/validate-layout-nodes.ts` (mod) — importar `fileInputNodeSchema` y `FileInputLayoutNode`, añadir rama `case 'fileInput'` en el dispatcher que llama a una nueva función `validateFileInputNode(rawNode, path, pageId)` (formato análogo a `validateFileManagerNode`), devolver `{ status: 'ready', node: { type: 'fileInput', id, queryStateFeedback, visibility, layout, props } }`. En el mapeo de issues Zod, anclar las rutas más comunes (`['props', 'fieldId']`, `['props', 'label']`, `['props', 'multiple']`, `['props', 'capture']`, `['props', 'validations', ...]`) al patrón `invalidLayout(... "${path}.props.<ruta>" ...)`.
- Tests:
  - `src/tests/config-validation/runtime-config-validation-file-input.test.ts` (nuevo) — bloque dedicado al contrato shape-only.
- Documentación:
  - `ai-workflow/docs/app-features/nodes/file-input.md` (referencia para T5; la documentación se actualizará durante la skill documental).

### Tests

**Ficheros de test**
- `src/tests/config-validation/runtime-config-validation-file-input.test.ts` (nuevo)

**Comportamiento cubierto**
- Un `fileInput` mínimo dentro de un `form` (`fieldId`, `label`) se acepta y el nodo normalizado conserva `type: 'fileInput'`, `props.fieldId` y `props.label`.
- Un `fileInput` con `props.multiple: false`, `props.capture: 'environment'` y todas las reglas declaradas en la spec (`required: { value: true }`, `accept: { value: ['image/jpeg', 'image/png'] }`, `maxFileSize: { value: 5 }`, `maxTotalSize: { value: 20 }`, `minFiles: { value: 1 }`, `maxFiles: { value: 4 }`, `validFileNames: { value: ['^IMG_\\d+\\.jpg$'] }`) se acepta y el normalizado preserva cada regla con su forma extendida `{ value, message? }`.
- Las reglas con `message` opcional (`required: { value: true, message: 'Obligatorio' }`, `maxFileSize: { value: 5, message: '...' }`) se aceptan y el `message` queda reflejado en el normalizado.
- Un `fileInput` sin `props.multiple` produce un nodo normalizado sin la clave `multiple` (el default `true` lo aplica el runtime en T4/T5, no el normalizado).
- Un `fileInput` sin `props.validations` se acepta y el normalizado no contiene la clave `validations`.
- Un `fileInput` con `props.capture: 'rear'` se rechaza con `code: 'invalid-layout'` y mensaje cuya ruta sea exactamente `<path>.props.capture`.
- Un `fileInput` con `props.validations.accept` igual a `[]`, `'image/png'` (no array) o array con elementos no string se rechaza con `code: 'invalid-layout'` y ruta `<path>.props.validations.accept` (o el `value` interno, según el shape que aplique el schema).
- Un `fileInput` con `props.validations.maxFileSize: -1`, `0` o no-numérico se rechaza con `code: 'invalid-layout'` y ruta `<path>.props.validations.maxFileSize`.
- Un `fileInput` con `props.validations.maxFiles: 0` o no entero se rechaza con `code: 'invalid-layout'` y ruta `<path>.props.validations.maxFiles`.
- Un `fileInput` con `props.validations.required: true` (boolean desnudo, sin forma extendida) se rechaza con `code: 'invalid-layout'` y ruta `<path>.props.validations.required`.
- Un `fileInput` con `props.validations.validFileNames: []` o con regex no string se rechaza con ruta `<path>.props.validations.validFileNames`.
- Un `fileInput` sin `props.fieldId` o sin `props.label` se rechaza con `code: 'invalid-layout'` y ruta `<path>.props.fieldId` / `<path>.props.label`.
- `fileInput` soporta los campos transversales del shape (`visibility`, `queryStateFeedback`, `layout.span`) sin que se considere ambiguo, y el normalizado los conserva.

**Comandos durante la implementación**
- `pnpm test --run src/tests/config-validation/runtime-config-validation-file-input.test.ts`

**Restricciones**
- Reutilizar el harness de validación ya presente en `src/tests/config-validation/helpers.ts`; no introducir builders nuevos.
- En esta tarea los casos válidos pueden colocar el `fileInput` dentro de un `form` mínimo para que pasen la validación cruzada, pero no se afirma nada sobre placement; eso lo cubre T2.

### Documentación afectada
- `ai-workflow/docs/app-features/nodes/file-input.md`

### Criterios de finalización
- `LayoutNodeType` y `supportedNodeTypes` incluyen `'fileInput'`.
- `fileInputNodeSchema` acepta el shape contractual y rechaza shapes inválidos con ruta exacta.
- `validate-layout-nodes.ts` despacha `fileInput` y devuelve el nodo normalizado.
- Los tests del fichero pasan en verde con el comando declarado.

### Cierre de implementación
Código y tests de la tarea completos y validados.

---

## T2 — Placement y cross-checks de bootstrap para `fileInput`

### Estado
completed

### Objetivo
Cerrar las restricciones cruzadas del nodo antes de que cualquier capa del runtime lo consuma:
- `fileInput` solo es válido como descendiente de un `form` (directo o anidado en `container`/`accordion`/`tabs` dentro del form), mismo criterio que `input`/`select`/etc.; fuera de un `form` se rechaza con `code: 'invalid-layout'` y diagnóstico que mencione la restricción.
- `fileInput` participa en la unicidad de `fieldId` del formulario contenedor (igual que `input`/`textarea`/`select`/`radioGroup`/`checkboxGroup`).
- Si `props.capture` está declarado y `props.validations.accept` no incluye ningún MIME que empiece por `image/` o `video/`, el config completo se rechaza con un diagnóstico explícito que identifique la incoherencia (criterio de aceptación 9 de la spec).
- La lista de children permitidos dentro de `form` se amplía para incluir `fileInput`.

### Fuera de alcance
- Cambios en runtime (`runtime-form-validations.ts`, `form-layout-node.tsx`, render del nodo).
- Reescribir la regla existente que rechaza `fileManager` dentro de `form`; debe seguir vigente sin modificación.
- Definir validaciones de fichero al seleccionar (eso vive en T5).

### Dependencias
T1.

### Impacto esperado en archivos
- Código:
  - `src/config/validate-form-nodes.ts` (mod) — extender `validateFormChildren` para que `fileInput` sea un descendiente válido de `form` (añadir a la lista de tipos aceptados, ajustar el mensaje de error literal cuando haya tipos no permitidos para que incluya `fileInput`). Extender la rama que recoge `fieldId` (`input | textarea | select | radioGroup | checkboxGroup`) para incluir también `'fileInput'`, de forma que la unicidad de `fieldId` aplique. Añadir la regla `fileInput` debe vivir dentro de un `form`: si aparece fuera del subárbol de un `form`, devolver `invalidLayout` con el mismo patrón de mensaje usado hoy por los demás field nodes (`"... fileInput nodes must be descendants of a form node."`).
  - `src/config/validate-file-manager-nodes.ts` (no se toca; sigue siendo de `fileManager`).
  - Nuevo módulo `src/config/validate-file-input-nodes.ts` (nuevo) — exporta `validateFileInputSemantics(config)` que recorre el layout de cada página y, por cada `fileInput`, aplica el cross-check `capture` + `accept`: si `props.capture` está definido y `props.validations?.accept?.value` o bien está ausente o bien no contiene ningún string que empiece por `image/` o `video/`, devuelve `invalidLayout` con mensaje que mencione la incoherencia y la ruta exacta del nodo (`<page>.layout[...]....props.capture`).
  - `src/config/validate-runtime-config.ts` (mod) — importar `validateFileInputSemantics` y llamarlo en orden análogo a `validateFileManagerSemantics`, propagando el primer error encontrado.
- Tests:
  - `src/tests/config-validation/runtime-config-validation-file-input.test.ts` (ampliación) — bloques nuevos para placement, unicidad de `fieldId` y cross-check `capture + accept`.
- Documentación:
  - `ai-workflow/docs/app-features/nodes/file-input.md` (referencia; se actualiza en la skill documental).
  - `ai-workflow/docs/app-features/nodes/form.md` (referencia; pasa a admitir `fileInput` en `children`).

### Tests

**Ficheros de test**
- `src/tests/config-validation/runtime-config-validation-file-input.test.ts` (ampliación)

**Comportamiento cubierto**
- Un `fileInput` declarado como descendiente directo de un `form` se acepta sin error.
- Un `fileInput` declarado dentro de un `container` que a su vez está dentro de un `form` se acepta sin error.
- Un `fileInput` declarado fuera de cualquier `form` (al nivel de `page.layout` o dentro de un `container` sin `form` ancestro) se rechaza con `code: 'invalid-layout'` y mensaje que mencione que `fileInput` debe ser descendiente de un `form` (mismo patrón verbal usado hoy por los demás field nodes).
- Dos `fileInput` con el mismo `fieldId` dentro del mismo `form` rechazan el config con `code: 'invalid-layout'` y ruta `<path>.props.fieldId`.
- Un `fileInput` y un `input` con el mismo `fieldId` dentro del mismo `form` rechazan el config con `code: 'invalid-layout'` (la unicidad cubre el catálogo completo de field nodes del form).
- Un `fileInput` con `props.capture: 'environment'` y `props.validations.accept: ['image/png']` se acepta (al menos un MIME `image/*`).
- Un `fileInput` con `props.capture: 'user'` y `props.validations.accept: ['video/mp4']` se acepta (al menos un MIME `video/*`).
- Un `fileInput` con `props.capture: 'environment'` y `props.validations.accept: ['application/pdf']` se rechaza con `code: 'invalid-layout'` y mensaje que mencione la incoherencia entre `capture` y `accept`.
- Un `fileInput` con `props.capture: 'environment'` sin `props.validations.accept` declarado se rechaza con el mismo cross-check (no hay manera de garantizar `image/*` o `video/*`).
- Un `fileInput` sin `props.capture` y sin `props.validations.accept` se acepta (cross-check inactivo).

**Comandos durante la implementación**
- `pnpm test --run src/tests/config-validation/runtime-config-validation-file-input.test.ts`

**Restricciones**
- No reescribir los mensajes de error de los demás field nodes; usar el mismo patrón literal `fileInput nodes must be descendants of a form node.` para consistencia.
- No tocar la regla `fileManager not allowed inside a form`; debe permanecer.

### Documentación afectada
- `ai-workflow/docs/app-features/nodes/file-input.md`
- `ai-workflow/docs/app-features/nodes/form.md`

### Criterios de finalización
- `fileInput` es descendiente válido de `form` y rechazado fuera de él.
- `fileInput` participa en la unicidad de `fieldId` del formulario.
- El cross-check `capture` + `accept` se aplica desde bootstrap.
- Los tests del fichero pasan en verde con el comando declarado.

### Cierre de implementación
Código y tests de la tarea completos y validados.

---

## T3 — Validación de submit de `fileInput` en `runtime-form-validations`

### Estado
completed

### Objetivo
Extender el pipeline de validación de formularios para que conozca el tipo `fileInput`:
- `ResolvedFormFieldDefinition` admite `type: 'fileInput'` y un nuevo campo opcional `fileValidations?: RuntimeFileInputValidations` (no se reusa `validations: RuntimeFormFieldValidations` porque la semántica de `required` es distinta).
- `getFirstVisibleValidationError` añade una rama dedicada para `type === 'fileInput'` que evalúa, en orden:
  - `required` con semántica `Array.isArray(value) && value.length > 0` (mensaje por defecto `Required`).
  - `minFiles` con semántica `Array.isArray(value) && value.length >= rule.value` (mensaje por defecto `Select at least N files.`).
- Las reglas de fichero (`accept`, `maxFileSize`, `maxTotalSize`, `maxFiles`, `validFileNames`) no se reevalúan en submit: la spec dice que ya filtraron los ficheros al seleccionar (T5).
- `resolveFormFieldValue` para `fileInput` devuelve el `value` del store si existe (`File[]`) o el `defaultValue` (`[]`) si no.
- `passesRequiredValidation` no se modifica; el caso `fileInput` se aísla en su propia rama por `type`.
- `evaluateFileManagerBatch` queda intacto: es la utilidad que T5 reutilizará para evaluar selecciones.

### Fuera de alcance
- Modificar el componente del nodo, `form-layout-node.tsx` o la integración con submit (T4 y T5).
- Cambiar la semántica de `required` para los demás tipos de campo.

### Dependencias
T1.

### Impacto esperado en archivos
- Código:
  - `src/runtime/runtime-form-validations.ts` (mod) — extender el union `ResolvedFormFieldDefinition['type']` para incluir `'fileInput'`, añadir el campo opcional `fileValidations?: RuntimeFileInputValidations`, añadir la rama dedicada en `getFirstVisibleValidationError` (sobre `fileDefinition.fileValidations` cuando el `type` es `'fileInput'`). Ajustar `resolveFormFieldValue` para devolver `fieldState?.value ?? fieldDefinition.defaultValue` cuando el `type` es `'fileInput'` (sin pasar por `normalizeChoiceFieldValue`). En `getValidationErrorForEditedField` no se requiere cambio funcional, pero verificar que sigue compilando con el union ampliado.
- Tests:
  - `src/tests/runtime/runtime-form-validations.test.ts` (ampliación) — bloque dedicado a `fileInput` (`required`, `minFiles`, semántica de array vacío).
- Documentación:
  - `ai-workflow/docs/app-features/forms/validation-rules.md` (referencia para la skill documental: la sección de `fileInput` en submit-validation).

### Tests

**Ficheros de test**
- `src/tests/runtime/runtime-form-validations.test.ts` (ampliación)

**Comportamiento cubierto**
- Un `fileInput` con `required: { value: true }` y `value: []` produce un error con mensaje `Required` y bloquea el submit (`isValid: false`).
- Un `fileInput` con `required: { value: true }` y `value: [File]` no produce error.
- Un `fileInput` sin `required` y `value: []` no produce error (la spec no exige selección por defecto).
- Un `fileInput` con `minFiles: { value: 2 }` y `value: [File]` produce un error cuyo mensaje por defecto refleja el número (`Select at least 2 files.`) y bloquea el submit.
- Un `fileInput` con `minFiles: { value: 2 }` y `value: [File, File]` no produce error.
- Un `fileInput` con `required: { value: true, message: 'Sube al menos un fichero' }` y `value: []` devuelve el mensaje literal `Sube al menos un fichero` (la formateadora ya soporta este caso para otros tipos; solo verifica que la rama de `fileInput` la usa).
- Un `fileInput` con `accept`, `maxFileSize`, `maxTotalSize`, `maxFiles`, `validFileNames` declarados pero `value: []` y `required: false` o ausente **no** produce error en submit (las reglas de fichero solo se aplican al seleccionar, no en submit; T5 las cubre por separado).
- Un `fileInput` oculto por `visibility` con `required: { value: true }` y `value: []` **no** bloquea el submit (la rama `!isVisible` ya existente conserva su comportamiento sin reevaluar reglas).
- `resolveFormFieldValue` para un `fileInput` devuelve el `File[]` del store cuando existe; si el campo no está en store, devuelve el `defaultValue` (`[]`).

**Comandos durante la implementación**
- `pnpm test --run src/tests/runtime/runtime-form-validations.test.ts`

**Restricciones**
- Reutilizar el harness y fixtures del fichero existente; no añadir builders nuevos.
- No tocar la semántica de `required` para los demás tipos de campo; cualquier regresión en `input`/`textarea`/`select`/`radioGroup`/`checkboxGroup` cuenta como fallo de la tarea.
- Construir los `File` con `new File([...], 'name', { type: 'image/png' })` (o equivalente) directamente en el test; no inventar utilidades nuevas.

### Documentación afectada
- `ai-workflow/docs/app-features/forms/validation-rules.md`

### Criterios de finalización
- La rama `fileInput` de `getFirstVisibleValidationError` evalúa `required` y `minFiles` con la semántica indicada.
- `resolveFormFieldValue` devuelve `File[]` o `[]` para `fileInput`.
- Los tests del fichero pasan en verde con el comando declarado.

### Cierre de implementación
Código y tests de la tarea completos y validados.

---

## T4 — Integración del `fileInput` en `form-layout-node` y submit multipart

### Estado
completed

### Objetivo
Hacer que el formulario reconozca los `fileInput` durante la recolección de campos y, en el submit, inyecte sus ficheros como `requestParams.files` para que el camino multipart existente en `buildInlineRuntimeApiRequest` los serialice como `multipart/form-data`:
- `collectResolvedFormFieldDefinitions` añade los nodos `fileInput` visibles a la lista con `type: 'fileInput'`, `defaultValue: []`, `multiple: node.props.multiple ?? true` y `fileValidations: node.props.validations` (mapeo a la nueva clave introducida en T3).
- `collectAllFormFieldIds` incluye `fileInput` en el barrido (para que su `fieldId` se considere en el set `hiddenFieldIds`).
- En `handleSubmit`, tras validar y antes de llamar a `executeQueryOperation`, recoger de `visibleFieldDefinitions` los `fileInput` que tengan al menos un fichero seleccionado y construir `files: RuntimeApiFileField[]` con un entry por fichero: `{ name: fieldDefinition.fieldId, file }`. Si el array final no está vacío, pasar `files` dentro de `requestParams`; si está vacío, omitirlo.
- Esta inyección aplica tanto en la rama `executeOperation` como en cada entrada de `executeOperations` (mismo array `files` para todas las operaciones del plural).
- Los `fileInput` ocultos por `visibility` no se incluyen en `files` (al estar fuera de `visibleFieldDefinitions`) y quedan reflejados en `hiddenFormFields.fieldIds` para que el resolver siga omitiendo referencias `forms.{formId}.{fieldId}` ocultas, igual que con los demás field nodes.
- `resetOnSuccess: true` que dispare `resetForm(node.id)` restaura cada `fileInput` a `defaultValue: []` (no se introduce un comportamiento nuevo: basta con que `defaultValue: []` viaje en la inicialización del campo).
- Cuando `fileValidations.required` está declarado y el `value` en store es `undefined` o no array, el helper de T3 ya lo trata como `[]` vía `resolveFormFieldValue`; nada extra que hacer aquí.

### Fuera de alcance
- Render del nodo (T5).
- Cambios en `runtime-api-request.ts`, `runtime-api-payload-resolver.ts` o cualquier módulo de `src/queries/`.
- Cambios en la inicialización lazy de campos que no sean para soportar el nuevo `defaultValue: []` de `fileInput`.
- Casos de `executeOperations` donde solo una de las operaciones quiera multipart: la spec acepta que todas reciban el mismo `files` (documentado como limitación).

### Dependencias
T1, T3.

### Impacto esperado en archivos
- Código:
  - `src/runtime/nodes/form-layout-node.tsx` (mod) — añadir rama `node.type === 'fileInput'` en `collectResolvedFormFieldDefinitions` (devuelve `ResolvedFormFieldDefinition` con `type: 'fileInput'`, `fileValidations: node.props.validations`, `defaultValue: []`, `multiple: node.props.multiple ?? true`, `queryStateFeedback`, `visibility`). Añadir rama análoga en `collectAllFormFieldIds`. En `handleSubmit`, después de calcular `visibleFieldDefinitions`, recolectar los `fileInput` y construir el array `files`; pasarlo dentro de `requestParams.files` tanto en la rama `executeOperation` (un solo `executeQueryOperation`) como en cada `executeQueryOperation` del `Promise.all` de `executeOperations`. Importar `FileInputLayoutNode` cuando aplique.
  - `src/runtime/nodes/form-layout-node.tsx` (mod) — extender el tipo del parámetro `node` de `resolveResolvedFormFieldDefinition` si fuese necesario para incluir `FileInputLayoutNode`; alternativa equivalente: tratar `fileInput` con una función auxiliar dedicada (`resolveFileInputFieldDefinition`) si conserva mejor la legibilidad.
- Tests:
  - `src/tests/runtime/runtime-form-submit-file-input.test.tsx` (nuevo) — submit end-to-end de un `form` con `fileInput`: verifica que `executeQueryOperation` recibe `requestParams.files` con un entry por fichero seleccionado bajo la clave `fieldId`; verifica que un `form` con `fileInput` vacío no añade `files` al `requestParams`; verifica que un `fileInput` oculto por `visibility` no aporta ficheros y queda en `hiddenFormFields.fieldIds`; verifica que en `executeOperations` cada operación recibe el mismo array `files`; verifica que `required` sin ficheros bloquea el submit (no se llama a `executeQueryOperation`).
  - `src/tests/runtime-state/runtime-state-forms-queries.test.tsx` (ampliación) — inicialización de un `fileInput` produce `forms.{formId}.{fieldId}` con `value: []` y `defaultValue: []`; un `resetForm` posterior restaura `value: []` después de haber escrito ficheros vía `setFormFieldValue`.
- Documentación:
  - `ai-workflow/docs/app-features/forms/submit.md` (referencia: serialización multipart cuando hay `fileInput` con valor).
  - `ai-workflow/docs/app-features/nodes/file-input.md` (referencia: integración con submit, comportamiento con `resetOnSuccess`, comportamiento con `visibility`).

### Tests

**Ficheros de test**
- `src/tests/runtime/runtime-form-submit-file-input.test.tsx` (nuevo)
- `src/tests/runtime-state/runtime-state-forms-queries.test.tsx` (ampliación)

**Comportamiento cubierto**
- Un `form` con un `fileInput` y un `input` de texto en cuyo store hay un `File` para el `fileInput` y un string para el `input`: el submit dispara `executeQueryOperation` y el `requestParams.files` recibido contiene `[{ name: '<fieldId fileInput>', file: <File> }]`; el `body` o `query` que referencian al `input` siguen siendo strings normales (no se altera la composición existente).
- Un `form` con `fileInput.multiple: true` y dos ficheros seleccionados produce un `requestParams.files` con dos entries bajo la misma clave `fieldId`.
- Un `form` con un solo `fileInput` con `value: []` produce un `requestParams` **sin** la clave `files`.
- Un `fileInput` oculto por `visibility` con un `File` en store no aporta entries en `requestParams.files` y su `fieldId` aparece en `hiddenFormFields.fieldIds` durante el submit (basta con mockear `executeQueryOperation` y aserciar sobre el argumento).
- Un `form` con `submitAction.type: 'executeOperations'` y dos operaciones recibe el mismo array `files` en ambas llamadas (verificar por mock que cada `executeQueryOperation` se invoca con `requestParams.files` equivalente).
- Un `fileInput` con `required: { value: true }` y `value: []` bloquea el submit: `executeQueryOperation` no se llama, y `forms.{formId}.{fieldId}.error` queda en el mensaje de `required`.
- Un `fileInput` con `value: [File, File]` y un `resetForm(formId)` posterior deja `forms.{formId}.{fieldId}.value` en `[]` (cubierto desde `runtime-state-forms-queries`).
- Inicialización lazy: un `form` con un `fileInput` que no existía en store, al montarse, crea `forms.{formId}.{fieldId}` con `value: []` y `defaultValue: []` (cubierto desde `runtime-state-forms-queries`).

**Comandos durante la implementación**
- `pnpm test --run src/tests/runtime/runtime-form-submit-file-input.test.tsx`
- `pnpm test --run src/tests/runtime-state/runtime-state-forms-queries.test.tsx`

**Restricciones**
- Reutilizar `FormRuntimeFixture` (y fixtures equivalentes) de `src/tests/runtime-state/helpers.tsx`; no introducir un harness paralelo.
- Mockear `executeQueryOperation` con `vi.fn()` para aserciar el `requestParams`; no llamar a `fetch` real ni construir un servidor.
- No verificar la serialización final `multipart/form-data` en esta tarea; ese contrato lo cubre `runtime-api-multipart.test.ts` para `requestParams.files` ya conocido.
- Al construir `File` en tests, usar `new File(['contenido'], 'foto.png', { type: 'image/png' })`.

### Documentación afectada
- `ai-workflow/docs/app-features/forms/submit.md`
- `ai-workflow/docs/app-features/nodes/file-input.md`

### Criterios de finalización
- `collectResolvedFormFieldDefinitions` y `collectAllFormFieldIds` reconocen `fileInput`.
- `handleSubmit` inyecta `requestParams.files` cuando hay al menos un `fileInput` visible con valor; lo omite en caso contrario.
- `hiddenFormFields.fieldIds` incluye los `fileInput` ocultos.
- `executeOperations` propaga el mismo `files` a todas las operaciones.
- Los tests de los ficheros declarados pasan en verde con los comandos arriba.

### Cierre de implementación
Código y tests de la tarea completos y validados.

---

## T5 — Componente `FileInputNode`, registro en `node-components-map` y code splitting

### Estado
completed

### Objetivo
Implementar el componente React del nodo `fileInput` y registrarlo en el mapa central de nodos, de forma que:
- El nodo renderiza un selector nativo de ficheros (`<input type="file">`) con los atributos derivados de props:
  - `multiple` cuando `props.multiple !== false` (default runtime `true`),
  - `capture` con el valor declarado (`'environment' | 'user'`) cuando aplique,
  - `accept` como string con los MIME de `props.validations.accept.value` separados por coma cuando esté declarado,
  - `disabled` cuando `props.validations.maxFiles` esté declarado y el `value` actual ya tenga ese tamaño (con un label informativo de "límite alcanzado").
- Al seleccionar ficheros, el componente:
  - llama a `evaluateFileManagerBatch(props.validations, existingFiles, incomingBatch)`,
  - escribe el nuevo `value` en `forms.{formId}.{fieldId}` con `setFormFieldValue`: en `multiple: false` reemplaza el value con `acceptedFiles.slice(0, 1)`; en `multiple: true` concatena `[...existing, ...accepted]`,
  - traduce la `rejection` (per-file o batch) a un mensaje y lo guarda con `setFormFieldError`; limpia el error previo cuando todos los ficheros del lote son aceptados.
- El nodo lista los ficheros del `value`:
  - imágenes (`file.type` empieza por `image/`) → miniatura usando `URL.createObjectURL`,
  - el resto → nombre + icono genérico (puede reutilizar el icono ya usado por `fileManager`),
  - cada entrada incluye un botón "eliminar" que actualiza el `value` quitando ese fichero.
- Lifecycle de `URL.createObjectURL`:
  - mapa `Map<File, string>` en `useRef`/`useState` que genera URL solo para imágenes,
  - revoca la URL del fichero eliminado al actualizar el `value`,
  - revoca todas las URLs pendientes al desmontar el componente.
- El nodo respeta los wrappers transversales (`visibility`, `queryStateFeedback`, `layout.span`) sin gestionar nada por su cuenta: el dispatcher central ya los aplica.
- El estilo se implementa exclusivamente con utilidades Tailwind alineadas con `runtime-node-styling`; no se introducen props visuales en JSON.
- El nodo se registra en `src/runtime/nodes/node-components-map.ts` tanto en la rama `eagerMap` (tests) como en `lazyMap` (dev/prod), de forma que `runtime-nodes-bundle.test.ts` siga viendo el chunk `fileInput` independiente.
- El test de coverage del mapa (`runtime-node-components-map.test.tsx`) incluye `fileInput` como clave esperada.

### Fuera de alcance
- Cambios en la integración con submit (T4).
- Modificar `runtime-api-request.ts` o cualquier módulo de `src/queries/`.
- Drag-and-drop (fuera de alcance de la spec).
- Preview de PDFs u otros formatos no imagen.
- Theming configurable o variantes visuales por JSON.

### Dependencias
T1, T2, T3, T4.

### Impacto esperado en archivos
- Código:
  - `src/runtime/nodes/file-input-layout-node.tsx` (nuevo) — `FileInputNode` que recibe `node: FileInputLayoutNode` y opcionalmente `iterationContext`. Lee `formId` del `FormContext` (igual que `input-layout-node.tsx`). Usa `useRuntimeState`/`useRuntimeStateActions` para `setFormFieldValue`/`setFormFieldError`. Implementa selección con `evaluateFileManagerBatch`, lista de previews con `URL.createObjectURL`, botón de eliminar y `disabled` por `maxFiles`. Estilos con utilidades Tailwind alineadas con el resto del runtime.
  - `src/runtime/nodes/node-components-map.ts` (mod) — añadir `fileInput: FileInputNode` en `eagerMap` y la entrada equivalente en `lazyMap` con `React.lazy(() => import('./file-input-layout-node').then(...))`.
  - `src/runtime/runtime-form-validations.ts` (mod si aplica) — si la traducción `rejection -> string` es lo bastante genérica, considerar exponer un helper `formatFileManagerRejection(rejection)` en este módulo para reutilizarlo desde el nodo `fileInput`. No es obligatorio: si el helper ya existe para `fileManager`, reutilizarlo tal cual; si no, una utilidad local al nodo es aceptable mientras el comportamiento sea consistente con `fileManager`.
- Tests:
  - `src/tests/runtime/runtime-file-input-hook.test.tsx` (nuevo) — comportamiento del nodo: selección de ficheros válidos actualiza `forms.{formId}.{fieldId}.value`; selección con rechazo escribe el mensaje en `forms.{formId}.{fieldId}.error`; `multiple: false` reemplaza el value; `multiple: true` concatena; eliminar un fichero lo quita del `value`; `maxFiles` deshabilita el `<input>` y al eliminar uno se rehabilita; ficheros de 0 bytes y nombres duplicados se rechazan con mensaje inline.
  - `src/tests/layout-renderer/layout-renderer-file-input.test.tsx` (nuevo) — render dentro de un `form`: selector nativo presente; `accept` se serializa como string CSV; `capture` se propaga al input; `multiple` controla el atributo; preview de imágenes muestra `<img>` con `src` blob (mockeando `URL.createObjectURL`); preview de no-imágenes muestra el nombre + icono genérico; `visibility` oculta el nodo por completo; `queryStateFeedback` permite reemplazar el render por el fallback declarado; `layout.span` aplica las clases esperadas.
  - `src/tests/runtime/runtime-node-components-map.test.tsx` (ampliación) — añadir `fileInput` a la lista de claves esperadas del mapa.
  - `src/tests/dev-runtime/runtime-nodes-bundle.test.ts` (ampliación) — verificar que el build de producción produce un chunk independiente para `fileInput` (mismo gate que para los nodos añadidos en 0087).
- Documentación:
  - `ai-workflow/docs/app-features/nodes/file-input.md` (referencia).
  - `ai-workflow/docs/test-index.md` (referencia: registrar los nuevos ficheros de test).

### Tests

**Ficheros de test**
- `src/tests/runtime/runtime-file-input-hook.test.tsx` (nuevo)
- `src/tests/layout-renderer/layout-renderer-file-input.test.tsx` (nuevo)
- `src/tests/runtime/runtime-node-components-map.test.tsx` (ampliación)
- `src/tests/dev-runtime/runtime-nodes-bundle.test.ts` (ampliación)

**Comportamiento cubierto**
- Render de un `fileInput` dentro de un `form` produce un `<input type="file">` accesible (con su label asociado vía `htmlFor` o `aria-label`, según convención de los demás field nodes).
- `props.multiple: true` añade el atributo `multiple`; `props.multiple: false` lo omite.
- `props.capture: 'environment'` propaga el atributo `capture="environment"` al `<input>`.
- `props.validations.accept: ['image/jpeg', 'image/png']` produce `accept="image/jpeg,image/png"` en el `<input>`.
- Seleccionar dos ficheros válidos actualiza `forms.{formId}.{fieldId}.value` con los dos `File`.
- Con `props.multiple: false`, seleccionar un fichero cuando ya hay uno reemplaza el `value` (queda un único `File`).
- Con `props.multiple: true`, seleccionar un fichero cuando ya hay uno concatena (el `value` queda con dos `File`).
- Eliminar un fichero del listado actualiza el `value` quitando ese `File`; cuando había una preview de imagen, se revoca su object URL (verificable con `vi.spyOn(URL, 'revokeObjectURL')`).
- Al desmontar el nodo se revocan todas las object URLs pendientes generadas para imágenes (verificable con el mismo spy).
- Un fichero con `type` que no pasa `validations.accept` se rechaza: el `value` no lo incluye y `forms.{formId}.{fieldId}.error` recibe el mensaje correspondiente (per-file).
- Un fichero que supera `validations.maxFileSize` se rechaza con mensaje inline; el `value` no lo incluye.
- Un lote que supera `validations.maxTotalSize` o `validations.maxFiles` se rechaza completo y el `value` no se modifica.
- Un fichero de 0 bytes se rechaza con mensaje inline (regla implícita).
- Un fichero con el mismo nombre que uno ya presente en el `value` se rechaza con mensaje inline (regla implícita).
- Cuando `validations.maxFiles` está declarado y el `value` lo alcanza, el `<input>` queda `disabled` y se muestra un texto informativo de límite alcanzado; al eliminar un fichero, el `<input>` vuelve a habilitarse.
- Una imagen (`type: 'image/png'`) en el `value` produce una miniatura `<img>` cuyo `src` proviene de `URL.createObjectURL` (mockeable).
- Un fichero no imagen (`type: 'application/pdf'`) muestra el nombre + un placeholder de documento, sin `<img>`.
- Un `fileInput` con `visibility` que oculta el nodo no aparece en el DOM (cubierto por el dispatcher; basta una aserción explícita).
- Un `fileInput` con `queryStateFeedback.states.loading.fallback` se reemplaza por el fallback cuando la query referenciada está en `loading` (cubierto por el dispatcher; basta una aserción explícita).
- Un `fileInput` con `layout.span` aplica la utilidad de span esperada en el wrapper externo (verificación de clase).
- `runtime-node-components-map.test.tsx` reconoce `fileInput` como clave del mapa eager y devuelve un componente truthy.
- `runtime-nodes-bundle.test.ts` confirma que el build de producción produce un chunk independiente para `fileInput`.

**Comandos durante la implementación**
- `pnpm test --run src/tests/runtime/runtime-file-input-hook.test.tsx`
- `pnpm test --run src/tests/layout-renderer/layout-renderer-file-input.test.tsx`
- `pnpm test --run src/tests/runtime/runtime-node-components-map.test.tsx`
- `pnpm test --run src/tests/dev-runtime/runtime-nodes-bundle.test.ts`

**Restricciones**
- Reutilizar `evaluateFileManagerBatch` (existing en `runtime-form-validations.ts`); no reimplementar las reglas de fichero.
- Reutilizar `FormContext` y los hooks `useRuntimeState`/`useRuntimeStateActions` (mismo patrón que `input-layout-node.tsx`); no introducir un store paralelo.
- Mockear `URL.createObjectURL` y `URL.revokeObjectURL` en los tests con `vi.spyOn` para verificar el lifecycle sin depender de la implementación del runtime de pruebas.
- No usar snapshots; las aserciones deben ser explícitas sobre el DOM y sobre el store.
- No introducir helpers en `runtime-node-styling.ts` salvo que la presentación lo exija (alinear con la convención de `input`/`textarea`).

### Documentación afectada
- `ai-workflow/docs/app-features/nodes/file-input.md`
- `ai-workflow/docs/test-index.md`

### Criterios de finalización
- `FileInputNode` renderiza el selector con `accept`, `capture`, `multiple` y `disabled` por `maxFiles` según props.
- Selección, rechazo, eliminación y previews funcionan con el lifecycle de `URL.createObjectURL` cubierto.
- `node-components-map.ts` registra `fileInput` en eager y lazy.
- `runtime-node-components-map.test.tsx` y `runtime-nodes-bundle.test.ts` reconocen `fileInput`.
- Los ficheros de test declarados pasan en verde con los comandos arriba.
- `pnpm test` global pasa con la cobertura ≥ 80% en `functions`, `lines` y `statements`.

### Cierre de implementación
Código y tests de la tarea completos y validados.

---

## Siguiente tarea a escoger
T1 — Contrato declarativo: tipos, Zod y validación de shape.
