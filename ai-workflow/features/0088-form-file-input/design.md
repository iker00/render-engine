# Design: Feature 0088 - form-file-input

## Contexto

El runtime ya soporta nodos de formulario (`input`, `textarea`, `select`, `radioGroup`, `checkboxGroup`) cuyo estado vive en `forms.{formId}.{fieldId}` con shape `{ value: unknown; error; touched; dirty; defaultValue }`. El submit de `form` se compone en `form-layout-node.tsx`:

1. Recolecta `ResolvedFormFieldDefinition[]` visibles desde el subárbol.
2. Llama a `validateFormFields` (en `runtime-form-validations.ts`) que aplica las reglas declaradas en `props.validations` por tipo de campo.
3. Si la validación es válida, ejecuta `executeQueryOperation(operationName, { requestParams: { query, body, headers }, hiddenFormFields })`.
4. `hiddenFormFields` permite que `runtime-api-payload-resolver.ts` omita del wire format las claves cuya referencia apunte a un campo oculto del propio formulario.

La capa `src/queries/` ya soporta multipart:

- `RuntimeApiRequestParams` (en `runtime-config-types.ts`) admite `files?: RuntimeApiFileField[]` con `RuntimeApiFileField = { name: string; file: File }`.
- `buildInlineRuntimeApiRequest` (en `runtime-api-request.ts`) detecta `effectiveFiles.length > 0` y desvía la construcción a `buildMultipartRequestInit`, que crea un `FormData` con los binarios bajo su `name` y serializa los pares escalares de `body` como partes de texto.
- Si `body` no es un objeto plano o contiene valores no escalares, devuelve `request-build-failed`.

`fileManager` ya consume esta vía para subir un fichero por llamada (`requestParams.files: [{ name: fileField, file }]`), pero `fileManager` es standalone, no participa en el submit y no escribe en `forms.*`.

Las validaciones de fichero también existen:

- `runtime-form-validations.ts` exporta `evaluateFileManagerBatch(validations, existingFiles, incomingBatch)` con reglas `accept`, `maxFileSize`, `maxTotalSize`, `maxFiles`, `validFileNames` y rechazos implícitos (0 bytes, nombre duplicado).
- Los tipos viven en `RuntimeFileManagerValidations` (`{ value, message? }` por regla).
- `validateFormFields`/`getFirstVisibleValidationError` operan sobre `RuntimeFormFieldValidations` (`required`, `minLength`, `maxLength`, `min`, `max`, `minSelections`, `maxSelections`); no conoce reglas de fichero.

La spec exige integrar `fileInput` con el modelo de formulario:

- Estado en `forms.{formId}.{fieldId}` con `value: File[]`.
- Validaciones inmediatas al seleccionar (las reglas de fichero) y submit-bloqueantes (`required`, `minFiles`).
- Submit multipart automático cuando exista al menos un `fileInput` con valor.

## Objetivos / No objetivos

### Objetivos

- Definir cómo el campo `fileInput` se integra con `forms.*` reutilizando el contrato `value` genérico.
- Decidir cómo el submit detecta los `fileInput` con valor y los inyecta como `requestParams.files` para activar el camino multipart existente sin tocar `runtime-api-request.ts`.
- Decidir dónde y cómo se reutilizan las reglas de fichero ya implementadas en `runtime-form-validations` para evaluar selecciones de `fileInput`.
- Decidir cómo se extiende la validación de submit (`validateFormFields`) para soportar `required` y `minFiles` sobre `File[]` sin duplicar la lógica de los demás campos.
- Identificar las extensiones necesarias en el contrato de configuración (`runtime-config-types.ts`, `validate-form-nodes.ts`) y los checks de bootstrap nuevos.
- Documentar la gestión de `URL.createObjectURL` para evitar memory leaks.

### No objetivos

- Cambiar la fachada de ejecución de operaciones (`executeQueryOperation`) o el builder de requests.
- Introducir una semántica de `defaultValue` para `fileInput` (los ficheros no se hidratan desde JSON).
- Soportar zona drag-and-drop, subida eager, chunked upload o validación remota previa al submit (fuera de alcance).
- Reabrir el modelo de `fileManager` ni su independencia del formulario.
- Construir un sistema de theming para la previsualización.

## Decisiones

### D1. Almacenar `File[]` en `forms.{formId}.{fieldId}.value`

`RuntimeFormFieldState.value` es `unknown`, por lo que admite `File[]` sin cambios de tipo. El campo `fileInput` se trata como cualquier otro campo de formulario:

- `defaultValue` efectivo en runtime: `[]` (no admite forma declarativa desde JSON).
- `setFormFieldValue(formId, fieldId, nextFiles)` se usa para actualizar la selección.
- `setFormFieldError(formId, fieldId, message)` se usa para el error inline.
- `resetForm(formId)` restablece el valor a `[]` reutilizando la maquinaria existente.

**Por qué**: alinea `fileInput` con el ciclo de vida de campos de formulario (`lifecycle.md`, persistencia, `resetOnSuccess`, visibility) sin abrir un dominio paralelo. La alternativa de mantener estado local en el nodo (como `fileManager`) duplicaría la coordinación con submit, reset y visibilidad.

**Trade-off**: `File[]` no es JSON serializable; cualquier persistencia que en el futuro intente snapshot del store de `forms.*` deberá excluir o serializar especialmente los `fileInput`. Riesgo aceptado: la v1 no persiste formularios fuera de memoria.

### D2. Modelo de validaciones del nodo: tipo dedicado `RuntimeFileInputValidations`

Se introduce un tipo de validaciones específico para `fileInput` que combina:

- Reglas de fichero ya existentes en `RuntimeFileManagerValidations`: `accept`, `maxFileSize`, `maxTotalSize`, `maxFiles`, `validFileNames` (todas con forma extendida `{ value, message? }`).
- Reglas submit-bloqueantes: `required` (compartida con `RuntimeRequiredValidationRule`) y `minFiles` (compartida con la regla numérica usada en `fileManager`).

`RuntimeFormFieldValidations` no se reutiliza tal cual porque su semántica de `required` está acoplada a strings y arrays de strings; `fileInput` necesita una semántica de `required` que evalúe sobre `File[]` (`length > 0`).

**Por qué**: un tipo dedicado evita inflar `RuntimeFormFieldValidations` con reglas que no aplican a `input`/`textarea`/`select`/`radioGroup`/`checkboxGroup`, y mantiene `RuntimeFileManagerValidations` intacto para `fileManager`. Las constantes y mensajes por defecto ya pueden reusarse.

**Trade-off**: se introduce un tercer tipo de validaciones en el catálogo. Mitigación: solo dos campos (`required`, `minFiles`) son nuevos sobre lo que ya existe en `RuntimeFileManagerValidations`; el resto se referencia con los mismos shapes.

### D3. Validación al seleccionar: reutilizar `evaluateFileManagerBatch`

La selección de ficheros (cambio en el `<input type="file">`) pasa el lote por `evaluateFileManagerBatch(validations, existingFiles, incomingBatch)` ya implementado. El resultado se aplica así:

- `acceptedFiles` reemplaza o concatena el `value` del campo en `forms.*` según `multiple`:
  - `multiple: false`: `nextValue = acceptedFiles.slice(0, 1)`. El `<input>` se renderiza sin atributo `multiple`.
  - `multiple: true`: `nextValue = [...existingFiles, ...acceptedFiles]`.
- `rejection` (si existe) se traduce a un mensaje y se guarda en `forms.{formId}.{fieldId}.error`.
- Si hay aceptados sin rechazo, el error previo se limpia.
- Tras escribir el nuevo `value`, el campo no se considera `submitting` ni dispara red; solo cambia el snapshot del store.

**Por qué**: `evaluateFileManagerBatch` ya cubre todas las reglas de fichero del spec incluidas las implícitas (`0 bytes`, nombre duplicado). Reescribirlas duplicaría comportamiento ya probado.

**Trade-off**: los mensajes por defecto de `evaluateFileManagerBatch` están en castellano y orientados a `fileManager`. Mitigación: aceptables para v1; el override por `message` ya está soportado por el shape `{ value, message }`.

### D4. Validación de submit: extender el pipeline existente sin tocar reglas string/numéricas

Se extiende `ResolvedFormFieldDefinition` con un nuevo `type: 'fileInput'` y un campo opcional `fileValidations?: RuntimeFileInputValidations`. La extensión se aplica en tres puntos:

1. `collectResolvedFormFieldDefinitions` (en `form-layout-node.tsx`) acepta nodos `fileInput` además de los existentes y devuelve una definición con `type: 'fileInput'`, `fileValidations`, `multiple` y `defaultValue: []`.
2. `collectAllFormFieldIds` (en `form-layout-node.tsx`) incluye nodos `fileInput`.
3. `getFirstVisibleValidationError` (en `runtime-form-validations.ts`) añade una rama dedicada para `type === 'fileInput'` que evalúa solo dos reglas en orden:
   - `required` con semántica `Array.isArray(value) && value.length > 0`.
   - `minFiles` con `Array.isArray(value) && value.length >= rule.value`.
   Las reglas de fichero ya filtraron los ficheros inválidos al seleccionar; en submit no se vuelven a evaluar.

`passesRequiredValidation` se mantiene sin cambios para los demás tipos; el caso `fileInput` se aísla en la nueva rama por `type`.

**Por qué**: respeta el principio de "una primera regla fallida por campo" del pipeline existente y minimiza el cambio en la utilidad compartida. No se introduce un evaluador paralelo.

**Trade-off**: `getFirstVisibleValidationError` adquiere conocimiento del tipo `fileInput` y de su forma de `validations`. Mitigación: el switch ya conoce los tipos por regla; añadir una rama coherente es preferible a inventar una función nueva.

### D5. Inyección de `files` en el submit reutilizando el camino multipart del builder

En `handleSubmit` de `form-layout-node.tsx`, antes de llamar a `executeQueryOperation` (rama `executeOperation` y `executeOperations`), el código:

1. Recolecta de `visibleFieldDefinitions` los `fileInput` y lee su valor actual `selectFormFieldValue(state, formId, fieldId)`.
2. Construye `RuntimeApiFileField[]` con un entry por fichero: `{ name: fieldId, file }`. Si el campo tiene varios ficheros, todos viajan bajo la misma clave `fieldId` (FormData admite múltiples valores por clave).
3. Si el array final no está vacío, se pasa como `requestParams.files` en la llamada a `executeQueryOperation`. Si está vacío, `files` se omite (`undefined`).
4. La detección de multipart vs JSON queda íntegra en `buildInlineRuntimeApiRequest`: `effectiveFiles.length > 0` → multipart; en caso contrario → JSON.

Para `executeOperations` (plural), cada operación de la lista recibe el mismo array `files` (los ficheros pertenecen al formulario, no a una operación específica). Si la operación base no es semánticamente multipart, el merge no cambia: `requestParams.files` solo afecta a la construcción de `RequestInit`.

**Por qué**: el builder ya hace la decisión binaria; replicarla en el form sería redundante y fácil de divergir. Reutilizar `requestParams.files` mantiene el cambio dentro del submit.

**Trade-off**:

- Pasar el mismo `files` a varias operaciones en `executeOperations` puede no ser deseable cuando solo una de ellas tenga sentido multipart. La spec no especifica este caso porque la v1 lo asume implícito: si el usuario declara varios endpoints en plural, todos reciben los mismos binarios. Riesgo aceptado y documentado.
- El payload de texto (`body`) debe ser un objeto plano con valores escalares para sobrevivir a `buildMultipartRequestInit`. Si el `submitAction.body` declara estructuras anidadas, el builder devolverá `request-build-failed`. Mitigación: documentar la limitación en `submit.md`; los formularios que mezclen ficheros con body complejo deben aplanarlo.

### D6. Visibilidad y omisión de campos ocultos

Los `fileInput` se incluyen en `visibleFieldDefinitions` solo si pasan `isLayoutNodeVisible`. Los ocultos:

- No se incluyen en la recolección de `files` para `requestParams.files`.
- Quedan en `hiddenFormFields.fieldIds`, por lo que cualquier referencia `forms.{formId}.{fieldId}` en `body`/`query`/`headers` se omite tal y como ya hace el resolver para campos string.

**Por qué**: alinea `fileInput` con la política existente de campos ocultos (`lifecycle.md`); no se introduce semántica nueva.

### D7. Validación de bootstrap

Se añaden checks en `validate-form-nodes.ts` (o el módulo equivalente que valida los campos descendientes de `form`):

1. `fileInput` solo puede aparecer dentro de `form` (directo o anidado en `container` dentro de form), mismo criterio que `input`/`select`/etc.
2. `validations.accept` (si presente) debe ser `string[]` no vacío.
3. `validations.maxFileSize`, `maxTotalSize`, `minFiles`, `maxFiles` deben ser números positivos.
4. `validations.validFileNames` debe ser `string[]` no vacío con regex válidos (mismo criterio que en `fileManager`).
5. `capture` solo admite `"environment"` o `"user"`.
6. Si `capture` está declarado y `validations.accept` no incluye ningún MIME que empiece por `image/` o `video/`, el config se rechaza con diagnóstico explícito (criterio de aceptación 9 del spec).
7. `fieldId` único dentro del formulario (regla existente del nodo `form`).

**Por qué**: el contrato declarativo se valida antes del render (frontera arquitectónica). El check de `capture` + `accept` evita ambigüedad de UI en runtime y forza a declarar coherentemente.

### D8. Preview con `URL.createObjectURL` revocada

El componente del nodo mantiene un mapa `Map<File, string>` con las object URLs generadas. Reglas de ciclo de vida:

- Al cambiar el valor del campo, se revocan las URLs de los ficheros eliminados y se generan URLs solo para los nuevos.
- Al desmontar el componente, se revocan todas las URLs pendientes.
- Solo se generan URLs para ficheros cuyo `type` empieza por `image/`. Para el resto se muestra el nombre con icono genérico (puede reutilizar el icono ya usado por `fileManager`).

**Por qué**: `URL.createObjectURL` retiene memoria del fichero hasta `revokeObjectURL`. Generar y revocar perezosamente por entrada del mapa minimiza fugas y evita re-renders innecesarios.

**Trade-off**: el mapa `File → URL` vive en `useRef`/`useState` del componente. Si el `value` se hidrata desde fuera (improbable hoy), las entradas huérfanas se revocan en el efecto de limpieza. No se intenta cachear URLs entre desmontajes.

### D9. Maxfiles deshabilita el selector

Cuando `validations.maxFiles` está declarado y `value.length >= maxFiles`, el `<input type="file">` se renderiza con `disabled` y el label del selector indica el límite alcanzado. Al eliminar un fichero, el atributo `disabled` desaparece automáticamente (estado derivado del store).

**Por qué**: cumple el requisito funcional 5 del spec sin necesidad de lógica adicional en `evaluateFileManagerBatch`.

### D10. Render con utilidades Tailwind, sin theming configurable

El nodo se renderiza con clases de Tailwind alineadas con `runtime-node-styling`. No se exponen props visuales en JSON.

- Botón del selector usa la utilidad de botón secundario existente.
- Miniaturas se renderizan en una grid de tamaño fijo (`w-16 h-16 object-cover`).
- Errores inline usan la utilidad estándar de mensajes de error de campo.

**Por qué**: alinea con la convención (`conventions.md`) y deja el theming para una feature futura específica.

## Riesgos y trade-offs

- **`executeOperations` y multipart compartido**: el mismo array `files` viaja a todas las operaciones del plural. Si una de ellas espera JSON y otra multipart, el resultado puede confundir al backend. Mitigación: documentar la limitación en `submit.md`; los autores de config deben separar formularios cuando lo necesiten.
- **`body` complejo con multipart**: `buildMultipartRequestInit` exige body plano con escalares. Un `submitAction.body` con objetos anidados producirá `request-build-failed`. Mitigación: el error tipado ya existe y la docs lo recoge.
- **Memoria de previews**: si el usuario selecciona muchas imágenes pesadas, el navegador retiene los blobs. La revocación al cambiar de selección y al desmontar es la única defensa razonable sin streaming. Riesgo conocido y aceptable.
- **Compatibilidad de `capture` en desktop y móviles antiguos**: el atributo es ignorado en desktop; en algunos navegadores móviles `capture: "environment"` puede comportarse como `user` o ignorar `multiple`. Sin polyfill; el spec ya lo declara como limitación conocida.
- **Reset tras submit exitoso**: `resetForm` restaura `defaultValue` (`[]`), pero el componente debe revocar las URLs activas. Riesgo controlado por el efecto de limpieza al detectar `value` vacío.
- **Lazy code splitting**: la feature 0087 introdujo code splitting de nodos. El nuevo nodo `fileInput` debe registrarse en `node-components-map.ts` (rama eager para tests) y exponerse como chunk independiente igual que los demás. Riesgo de divergencia menor cubierto por `runtime-nodes-bundle.test.ts`.

## Migración o despliegue

- No hay migración de configuración: `fileInput` es un nodo nuevo; los formularios existentes no se ven afectados.
- Formularios sin `fileInput` siguen serializando como JSON; el cambio en `handleSubmit` solo añade el cómputo de `files` cuando exista al menos un `fileInput` visible con valor.
- No hay flag de release; el nodo entra en producción cuando se completa la implementación y validación.

## Preguntas abiertas

Ninguna bloqueante. La spec ya enumera las limitaciones conocidas (capture + multiple en móvil, ausencia de drag-and-drop, sin chunked upload). Las decisiones técnicas anteriores se toman dentro del marco existente y no requieren confirmación adicional.
