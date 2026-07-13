# Tasks: Feature 0090 — file-manager custom literals

Contrato de ejecución para implementar la spec `spec.md` siguiendo las decisiones de `design.md`. Cada tarea es una
unidad atómica y verificable. El orden es de dependencia estricta: no adelantar una tarea si su predecesora no está
cerrada.

Siguiente tarea a escoger: ninguna (todas las tareas completadas).

---

## T1 — Extender motor central de interpolación con canal `localPlaceholders`

**Estado**: completada

**Objetivo**: Añadir un canal opcional `localPlaceholders: Record<string, string>` en las funciones
`resolveRuntimeVisibleValue` y `resolveRuntimeTextReference` (
`src/runtime/runtime-references/runtime-reference-resolver.ts`). Cuando un placeholder `{{nombre}}` de un string
interpolado coincida con una clave presente en `localPlaceholders`, se sustituye por su valor string tal cual, sin
volver a pasar por el resolutor de referencias. Si el nombre no está en el mapa, se conserva el flujo actual (parse como
referencia → resolución → warning DEV cuando corresponda). Esta migración no cambia el comportamiento observable de
ningún consumidor existente porque el parámetro es opcional y hoy nadie lo pasa.

**Fuera de alcance**:

- Consumir el nuevo canal desde `fileManager`.
- Migrar `formatValidationMessage` a este canal (se hace en T2).
- Cambiar la semántica de referencias completas o del escape `\`.
- Añadir superficies nuevas al catálogo `RuntimeReferenceSurface`.

**Dependencias**: ninguna.

**Impacto esperado en archivos**:

- Código:
    - `src/runtime/runtime-references/runtime-reference-resolver.ts` (modificar `ResolveRuntimeReferenceOptions`,
      `resolveRuntimeInterpolatedVisibleValue`, `resolveRuntimeVisibleValue`, `resolveRuntimeTextReference`).
- Tests:
    - `src/tests/runtime/runtime-reference-resolution.test.tsx` (ampliación).
- Documentación:
    - `ai-workflow/docs/app-features/references/dynamic-strings.md` (referenciada como afectada; la actualización real
      la disparará `update-app-documentation`).

**Tests**:

- Ficheros de test:
    - `src/tests/runtime/runtime-reference-resolution.test.tsx` (ampliación) — añade una sección
      `describe('localPlaceholders')`.
- Comportamiento cubierto:
    - Un `resolveRuntimeVisibleValue` con `localPlaceholders: { fileName: 'foo.pdf' }` sobre el string
      `Error al subir "{{fileName}}"` produce `Error al subir "foo.pdf"`.
    - Un placeholder cuyo nombre no está en `localPlaceholders` y no es una referencia soportada resuelve a string vacío
      conservando el resto del texto (`Total {{completed}}/{{total}} — {{percent}}%` con
      `localPlaceholders: { completed: '2', total: '5', percent: '40' }` produce `Total 2/5 — 40%`).
    - Una `{{translations.foo}}` sigue resolviéndose por el catálogo aunque exista `localPlaceholders` con otras claves.
    - Un valor de `localPlaceholders` que contiene literalmente `{{translations.foo}}` se muestra tal cual, sin
      re-interpretarse (no hay doble interpolación).
    - `resolveRuntimeTextReference` acepta y propaga `localPlaceholders` a través de `resolveRuntimeVisibleValue`.
    - Sin `localPlaceholders`, cualquier test existente en el fichero sigue verde (no regresión).
- Comandos durante la implementación:
    - `pnpm test --run src/tests/runtime/runtime-reference-resolution.test.tsx`
- Restricciones:
    - Reusar el harness de estado runtime ya presente en el fichero.
    - No reescribir el escáner de placeholders; ampliarlo dentro del mismo `replace` para mantener una sola pasada.

**Documentación afectada**:

- `ai-workflow/docs/app-features/references/dynamic-strings.md` — pendiente de reflejar el canal `localPlaceholders`
  cuando se ejecute `update-app-documentation`.

**Criterios de finalización**:

- El motor acepta `localPlaceholders` en su bolsa de `options`.
- El canal resuelve nombres locales en la misma pasada, sin re-interpretación.
- El resto del comportamiento del motor no cambia.

**Cierre de implementación**:

- Cambios de código y tests aplicados.
- `pnpm test --run src/tests/runtime/runtime-reference-resolution.test.tsx` en verde.

---

## T2 — Migrar `formatValidationMessage` al canal `localPlaceholders`

**Estado**: completada

**Objetivo**: Reemplazar la sustitución previa de `{{value}}` en `formatValidationMessage` (
`src/runtime/runtime-form-validations.ts`) por una llamada a
`resolveRuntimeTextReference(rule.message, state, 'form.validation.message', { iterationContext, localPlaceholders: { value: valueStr } })`.
Eliminar `VALUE_PLACEHOLDER_PATTERN` y el `replace` previo. El resultado observable no cambia: cualquier mensaje con
`{{value}}` sigue produciendo el mismo string, y `{{translations.*}}` sigue resolviéndose como hoy.

**Fuera de alcance**:

- Cambiar la firma pública de `formatValidationMessage`.
- Alterar los mensajes por defecto de las reglas.
- Tocar el flujo de fileManager/fileInput (se hace en T6).

**Dependencias**: T1.

**Impacto esperado en archivos**:

- Código:
    - `src/runtime/runtime-form-validations.ts` (`formatValidationMessage`, eliminar `VALUE_PLACEHOLDER_PATTERN`).
- Tests:
    - `src/tests/runtime/runtime-form-validation-message.test.ts` (ampliación defensiva; verificar que los mismos casos
      siguen pasando).
    - `src/tests/runtime/runtime-form-validations.test.ts` (ampliación defensiva si aplica).
- Documentación: ninguna afectada (la doc de formularios ya describe el resultado, no la vía interna).

**Tests**:

- Ficheros de test:
    - `src/tests/runtime/runtime-form-validation-message.test.ts` (ampliación) — verificar no-regresión.
- Comportamiento cubierto:
    - `message: "{{value}}"` con `value: 0` produce `"0"` (el caso límite del cero se preserva).
    - `message: "{{value}} es requerido"` con `value: true` produce `" es requerido"` (booleano true → string vacío).
    - `message: "{{translations.foo}}"` se resuelve por el catálogo actualmente activo, con el fallback documentado.
    - `message` combinando `{{value}}` y `{{translations.foo}}` en el mismo string resuelve ambas piezas en una sola
      pasada.
    - `message: ""` sigue produciendo `""` sin caer al `defaultMessage`.
    - `message: undefined` sigue produciendo el `defaultMessage`.
- Comandos durante la implementación:
    - `pnpm test --run src/tests/runtime/runtime-form-validation-message.test.ts`
    - `pnpm test --run src/tests/runtime/runtime-form-validations.test.ts`
- Restricciones:
    - No introducir un nuevo helper local; delegar íntegramente en el motor central.
    - Ningún cambio en los mensajes por defecto codificados en `getFirstVisibleValidationError`.

**Documentación afectada**: ninguna.

**Criterios de finalización**:

- `formatValidationMessage` no aplica `replace` previo sobre `{{value}}`.
- Los tests de mensajes de validación pasan sin cambios de aserción salvo ampliación.

**Cierre de implementación**:

- Refactor completado; tests referenciados en verde.

---

## T3 — Ampliar catálogo `RuntimeReferenceSurface` con superficies de `fileManager`

**Estado**: completada

**Objetivo**: Añadir a `RuntimeReferenceSurface` (`src/runtime/runtime-references/runtime-reference-diagnostics.ts`) dos
superficies:

- `` `fileManager.props.labels.${string}` `` (patrón template-literal, análogo a `accordion[${string}].props.label`).
- `'fileManager.props.validations.message'`.

Sin consumidores nuevos todavía. El objetivo es exponer las superficies para que los helpers de T5 y T6 puedan reportar
diagnósticos con locators legibles en DEV.

**Fuera de alcance**:

- Consumir las superficies (se hace en T5 y T6).
- Alterar la función `reportRuntimeReferenceDiagnostic`.
- Añadir superficies para otros nodos.

**Dependencias**: T1.

**Impacto esperado en archivos**:

- Código:
    - `src/runtime/runtime-references/runtime-reference-diagnostics.ts` (añadir dos entradas a la unión
      `RuntimeReferenceSurface`).
- Tests:
    - Ninguno propio; cubierto indirectamente por los tests de T5, T6 y T7 que ejercitan estos surfaces.
- Documentación: ninguna afectada (el catálogo de superficies no está publicado en docs de app).

**Tests**:

- Ficheros: ninguno; cubierto por: T5, T6, T7.
- Comandos durante la implementación:
    - `pnpm test --run src/tests/runtime/runtime-reference-resolution.test.tsx` (comprobar que la unión sigue compilando
      y no rompe consumidores existentes).

**Documentación afectada**: ninguna.

**Criterios de finalización**:

- La unión `RuntimeReferenceSurface` incluye las dos superficies nuevas.
- El proyecto sigue compilando con `pnpm test`.

**Cierre de implementación**:

- Cambio aplicado; el fichero mantiene el orden y estilo actual de las entradas.

---

## T4 — Contrato de `fileManager.props.labels`: tipos + Zod estricto + mapeo de errores

**Estado**: completada

**Objetivo**: Introducir el contrato JSON del bloque opcional `props.labels` de `fileManager` con las claves cerradas
definidas en `spec.md` sección 2:

`dropzoneIdle`, `dropzoneAcceptedFormats`, `dropzoneUploading`, `dropzoneProgress`, `dropzoneSuccess`,
`dropzoneMaxFilesReached`, `dropzoneAriaLabel`, `listLoadError`, `listEmpty`, `paginationPrevious`, `paginationNext`,
`rowViewLabel`, `rowViewAriaLabel`, `rowViewUnavailableAriaLabel`, `rowDownloadLabel`, `rowDownloadAriaLabel`,
`rowDownloadUnavailableAriaLabel`, `rowDeleteLabel`, `rowDeleteAriaLabel`, `uploadFileError`, `uploadListPathMissing`,
`deleteError`.

Cambios a aplicar:

- En `src/config/runtime-config-types.ts`, ampliar `FileManagerLayoutNode['props']` con `labels?: FileManagerLabels` y
  declarar el tipo `FileManagerLabels` como `Partial<Record<KnownKey, string>>` donde `KnownKey` es la unión literal del
  catálogo cerrado.
- En `src/config/runtime-config-zod.ts`, añadir en `fileManagerNodeSchema` un
  `labels: fileManagerLabelsSchema.optional()` donde `fileManagerLabelsSchema` es un `z.object({...})` con cada clave
  `z.string().optional()` **y `.strict()`** para rechazar claves desconocidas.
- En `src/config/validate-layout-nodes.ts`, dentro de `validateFileManagerNode`, mapear
  `issuePath[0] === 'props' && issuePath[1] === 'labels'` a
  `Page "${pageId}" has an invalid layout at "${path}.props.labels.${issuePath[2] ?? ''}".` (con el sufijo `.{clave}`
  cuando exista).
- No consumir aún el bloque desde ningún componente.

**Fuera de alcance**:

- Renderizar los `labels` (T7).
- Escribir el helper `resolveFileManagerLabel` (T5).
- Cambiar la validación cruzada de `validate-file-manager-nodes.ts`.

**Dependencias**: ninguna estricta, pero se recomienda tras T3 para dejar el catálogo de superficies listo cuando T5
conecte con él.

**Impacto esperado en archivos**:

- Código:
    - `src/config/runtime-config-types.ts` (tipo `FileManagerLabels`, prop `labels?`).
    - `src/config/runtime-config-zod.ts` (`fileManagerLabelsSchema` + integración en `fileManagerNodeSchema`).
    - `src/config/validate-layout-nodes.ts` (mapeo de issue `labels.{key}` en `validateFileManagerNode`).
- Tests:
    - `src/tests/config-validation/runtime-config-validation-file-manager.test.ts` (ampliación).
- Documentación:
    - `ai-workflow/docs/app-features/nodes/file-manager.md` — pendiente de reflejar el nuevo bloque `props.labels`
      cuando se ejecute `update-app-documentation`.

**Tests**:

- Ficheros de test:
    - `src/tests/config-validation/runtime-config-validation-file-manager.test.ts` (ampliación) — sección
      `describe('props.labels')`.
- Comportamiento cubierto:
    - Aceptación: `fileManager` con `labels` omitido sigue siendo válido (no regresión de configuraciones existentes).
    - Aceptación: `labels` con una o varias claves reconocidas del catálogo como strings (incluyendo `""`) pasa la
      validación.
    - Aceptación: `labels: {}` (objeto vacío) pasa la validación.
    - Rechazo: `labels` con una clave desconocida (por ejemplo `dropzoneidle` en minúsculas) produce `invalid-layout`
      con path terminado en `props.labels.dropzoneidle`.
    - Rechazo: `labels.dropzoneIdle: 42` produce `invalid-layout` con path terminado en `props.labels.dropzoneIdle`.
    - Rechazo: `labels: "no-es-objeto"` produce `invalid-layout` con path terminado en `props.labels`.
- Comandos durante la implementación:
    - `pnpm test --run src/tests/config-validation/runtime-config-validation-file-manager.test.ts`
- Restricciones:
    - Reusar el helper `helpers.ts` de la carpeta de validación para construir configs.
    - El schema debe usar `.strict()` sobre el objeto `labels`, no `.strip()`, para que las claves desconocidas
      produzcan issue Zod.

**Documentación afectada**:

- `ai-workflow/docs/app-features/nodes/file-manager.md`.

**Criterios de finalización**:

- El tipo `FileManagerLabels` es la unión literal cerrada del catálogo.
- El schema Zod estricto rechaza claves desconocidas y tipos no string.
- `validateFileManagerNode` reporta el path preciso `fileManager.props.labels.{key}`.

**Cierre de implementación**:

- Código y tests del contrato en verde; el resto del comportamiento del nodo no cambia.

---

## T5 — Helper `resolveFileManagerLabel`

**Estado**: completada

**Objetivo**: Crear `src/runtime/nodes/file-manager/resolve-file-manager-label.ts` que exporte una función:

```
resolveFileManagerLabel({ labels, key, defaultText, placeholders, state, iterationContext }): string
```

Contrato exacto:

- Si `labels?.[key] === undefined`, devuelve `defaultText` sin pasar por el motor central.
- Si `labels?.[key] === ""`, devuelve `""` (caso límite explícito de la spec).
- En otro caso, delega en `resolveRuntimeTextReference(labels[key], state, \`fileManager.props.labels.${key}\`, {
  iterationContext, localPlaceholders: placeholders })` y devuelve el string resultante.

`placeholders` es `Record<string, string>` (o `undefined`). El helper no fabrica placeholders; los computa el
consumidor (T7).

**Fuera de alcance**:

- Consumir el helper desde los componentes (T7).
- Centralizar los textos por defecto (viven en el sitio de consumo, per D5).
- Cambiar el motor central (T1 ya lo dejó preparado).

**Dependencias**: T1, T3, T4.

**Impacto esperado en archivos**:

- Código:
    - `src/runtime/nodes/file-manager/resolve-file-manager-label.ts` (nuevo).
- Tests:
    - `src/tests/runtime/runtime-file-manager-resolve-label.test.ts` (nuevo).
- Documentación: ninguna directamente (el helper es interno).

**Tests**:

- Ficheros de test:
    - `src/tests/runtime/runtime-file-manager-resolve-label.test.ts` (nuevo).
- Comportamiento cubierto:
    - `labels` sin la clave → devuelve `defaultText` literal.
    - `labels[key] === ""` → devuelve `""`.
    - `labels[key]` string fijo sin `{{...}}` → devuelve ese string tal cual.
    - `labels[key]` referencia completa `translations.saludo` → resuelve al valor del catálogo activo.
    - `labels[key]` con placeholder local (`Error al subir "{{fileName}}"`) → interpola `placeholders.fileName`.
    - `labels[key]` con placeholder no reconocido (por ejemplo `{{unknown}}` sin entrada en `placeholders`) → sustituye
      por string vacío conservando el resto.
    - `labels[key]` combinando `{{translations.foo}}` + placeholder local resuelve ambas piezas en una sola pasada.
    - `placeholders` con un valor que contiene literalmente `{{translations.foo}}` no se re-interpreta.
- Comandos durante la implementación:
    - `pnpm test --run src/tests/runtime/runtime-file-manager-resolve-label.test.ts`
- Restricciones:
    - No incluir ningún texto por defecto en el helper; el `defaultText` siempre lo pasa el consumidor.
    - No memoizar internamente; el helper es puro y se invoca por render.

**Documentación afectada**: ninguna (helper interno).

**Criterios de finalización**:

- El helper existe y cumple el contrato descrito.
- Los tests unitarios cubren los seis subcasos listados.

**Cierre de implementación**:

- Helper y tests en verde; sin cambios en componentes de render todavía.

---

## T6 — Corrección de mensajes de validación de fichero: `evaluateFileManagerBatch` resuelve `{{translations.*}}`

**Estado**: completada

**Objetivo**: Cerrar el bug del mecanismo compartido de mensajes de reglas de fichero (`accept`, `maxFileSize`,
`maxTotalSize`, `maxFiles`, `validFileNames`) para que el `message` de override se interpole igual que los mensajes
estándar de formulario.

Cambios (según D7):

- En `src/runtime/runtime-form-validations.ts`:
    - Extender la firma de `evaluateFileManagerBatch` con dos parámetros adicionales: `state: RuntimeState` (
      obligatorio) y `iterationContext?: RuntimeIterationContext` (opcional). El orden queda:
      `(validations, existingFiles, incomingBatch, state, iterationContext?)`.
    - Añadir un helper local `formatFileRuleMessage({ ruleValue, message, defaultMessage, state, iterationContext })`
      que:
        - Si `message === undefined` → devuelve `defaultMessage`.
        - Si `message === ""` → devuelve `""`.
        - En otro caso → llama a
          `resolveRuntimeTextReference(message, state, 'fileManager.props.validations.message', { iterationContext, localPlaceholders: { value: normalizeFileRuleValue(ruleValue) } })`.
    - Añadir `normalizeFileRuleValue(ruleValue)`: `String(ruleValue)` cuando `ruleValue` es número, `""` en el resto de
      casos (incluye `string[]` para `accept` y `validFileNames`).
    - Usar `formatFileRuleMessage` en los seis puntos donde hoy se hace `message ?? "<default en español>"` (dentro de
      `evaluatePerFileRules` para `accept`, `maxFileSize`, `validFileNames`, y en `evaluateFileManagerBatch` para
      `maxTotalSize` y `maxFiles`).
    - `zero-bytes` y `duplicate-name` no admiten `message` de override, así que se dejan intactos.
- En `src/runtime/nodes/file-manager/use-file-manager.ts`:
    - Pasar `state` (obtenido con `readRuntimeState()` inmediatamente antes) y, si procede, `iterationContext` (no
      aplica hoy) a la llamada de `evaluateFileManagerBatch`.
- En `src/runtime/nodes/file-input-layout-node.tsx`:
    - Pasar `state` (el propio ya disponible en el componente) al invocar `evaluateFileManagerBatch`.

**Fuera de alcance**:

- Migrar mensajes por defecto codificados en español a `translations.*` (se mantienen como fallback fijo, per spec).
- Añadir soporte de override de mensaje a `zero-bytes` o `duplicate-name`.
- Añadir nuevos placeholders más allá de `{{value}}`.

**Dependencias**: T1, T3.

**Impacto esperado en archivos**:

- Código:
    - `src/runtime/runtime-form-validations.ts` (`evaluateFileManagerBatch`, `evaluatePerFileRules`, helper local
      `formatFileRuleMessage`, helper local `normalizeFileRuleValue`).
    - `src/runtime/nodes/file-manager/use-file-manager.ts` (paso de `state`).
    - `src/runtime/nodes/file-input-layout-node.tsx` (paso de `state`).
- Tests:
    - `src/tests/runtime/runtime-form-validations.test.ts` (ampliación).
- Documentación:
    - `ai-workflow/docs/app-features/forms/validation-rules.md` — pendiente de aclarar que el `message` de reglas de
      fichero también resuelve `{{translations.*}}` cuando se ejecute `update-app-documentation`.

**Tests**:

- Ficheros de test:
    - `src/tests/runtime/runtime-form-validations.test.ts` (ampliación) — nuevos casos dentro de
      `describe('evaluateFileManagerBatch')`.
- Comportamiento cubierto:
    - Regla `accept` con `message: "{{translations.tipoNoValido}}"` produce el string del catálogo activo cuando la
      clave existe.
    - Regla `maxFileSize` con `message: "Máximo {{value}} MB"` y `value: 2` produce `"Máximo 2 MB"`.
    - Regla `maxTotalSize` con `message: "{{translations.excedido}}"` produce el string del catálogo activo (rejection
      de scope `batch`).
    - Regla `maxFiles` con `message: "{{value}} máx"` y `value: 3` produce `"3 máx"` (rejection de scope `batch`).
    - Regla `validFileNames` con `message` sin placeholders sigue devolviendo el string tal cual.
    - Regla `accept` con `message: ""` devuelve `""` como mensaje del rejection (no cae al default).
    - Sin `message`, el rejection mantiene el `defaultMessage` en español codificado hoy (no regresión).
    - `zero-bytes` y `duplicate-name` no aceptan override y mantienen su mensaje actual.
- Comandos durante la implementación:
    - `pnpm test --run src/tests/runtime/runtime-form-validations.test.ts`
    - `pnpm test --run src/tests/runtime/runtime-file-manager-hook.test.tsx`
- Restricciones:
    - Construir `state` en los tests reutilizando el harness que ya usa el fichero (evitar duplicar fixtures).
    - No fusionar `formatFileRuleMessage` con `formatValidationMessage`; se dejan paralelos por diferencia de superficie
      de diagnóstico y por tipos de `value`.

**Documentación afectada**:

- `ai-workflow/docs/app-features/forms/validation-rules.md`.

**Criterios de finalización**:

- `evaluateFileManagerBatch` acepta `state` y lo usa para resolver `message`.
- Los dos callers pasan `state`.
- `zero-bytes` y `duplicate-name` no cambian.
- El test file de la función queda ampliado con los siete casos listados.

**Cierre de implementación**:

- Refactor aplicado; tests referenciados en verde; no hay uso interno de `evaluateFileManagerBatch` que compile sin
  `state`.

---

## T7 — Consumir `labels` desde los componentes de render de `fileManager`

**Estado**: completada

**Objetivo**: Rutear todos los literales listados en el catálogo cerrado de la spec a través de
`resolveFileManagerLabel`, computando los placeholders locales en el sitio de consumo. Los textos por defecto actuales
se pasan al helper como `defaultText` (per D5).

Estrategia de resolución (única y obligatoria para toda la tarea):

- El componente padre `src/runtime/nodes/file-manager-layout-node.tsx` es quien orquesta `useFileManager` y ya tiene
  acceso al `state` y al `config`. Ese componente lee `node.props.labels` y computa un diccionario
  `resolvedLabels: Partial<Record<KnownKey, string>>` con los labels **sin placeholders locales**, invocando
  `resolveFileManagerLabel` una vez por clave presente en el catálogo. Los labels con placeholders locales (
  `dropzoneAcceptedFormats`, `dropzoneProgress`, `dropzoneSuccess`, `dropzoneMaxFilesReached`, `dropzoneAriaLabel`,
  `uploadFileError`) **no** se pre-resuelven aquí; el padre pasa el string bruto (`labels?.<clave>`) a través de un
  segundo diccionario `rawLabels: Partial<Record<KnownKey, string>>` para que los subcomponentes puedan resolverlos con
  sus placeholders en el momento del render, delegando en `resolveFileManagerLabel(...)` con el `state` que también se
  propaga.
- `drop-zone`, `list` y `row` reciben `resolvedLabels`, `rawLabels`, `state` (el `RuntimeState` ya disponible en el
  padre) y, cuando aplique, `iterationContext`. Los subcomponentes usan `resolvedLabels[key] ?? defaultText` para
  literales sin placeholders y llaman a `resolveFileManagerLabel` con `rawLabels`, `state` y los `placeholders`
  calculados localmente para literales con placeholders.
- El hook `use-file-manager.ts` **resuelve sus tres mensajes runtime internamente** porque necesita `readRuntimeState()`
  en el instante del dispatch. Recibe `labels` (bruto) a través del `node` y llama a `resolveFileManagerLabel` con el
  `state` capturado con `readRuntimeState()`.
- `src/runtime/nodes/file-manager/file-manager-error-list.tsx` **no cambia**: sigue recibiendo strings pre-resueltos (
  los tres mensajes runtime los pre-resuelve el hook antes de dispatch). Se retira del impacto de esta tarea.

Puntos concretos a cambiar:

- `src/runtime/nodes/file-manager-layout-node.tsx`:
    - Computa `resolvedLabels` (labels sin placeholders locales) y `rawLabels` (labels con placeholders locales) tal
      como se describe arriba.
    - Propaga `resolvedLabels`, `rawLabels`, `state` (y `iterationContext` si procede) a `FileManagerDropZone`,
      `FileManagerList` y (a través de `FileManagerList`) a `FileManagerRow`.
- `src/runtime/nodes/file-manager/file-manager-drop-zone.tsx`:
    - Sustituir:
        - `Arrastra los ficheros aquí o haz clic para seleccionar` → `dropzoneIdle`.
        - `Formatos aceptados: {acceptExtension.join(', ')}` → `dropzoneAcceptedFormats` con
          `{ formats: acceptExtension.join(', ') }`.
        - `Subiendo ficheros...` → `dropzoneUploading`.
        - Texto del `ProgressBar` (`${completed}/${total} — ${percent}%`) → `dropzoneProgress` con
          `{ completed: String(completed), total: String(total), percent: String(percent) }`.
        - `¡Ficheros subidos correctamente!` → `dropzoneSuccess` con `{ count: String(total) }`.
        - `Límite alcanzado` → `dropzoneMaxFilesReached` con `{ max: String(validations.maxFiles?.value ?? '') }`.
        - `Drop zone for ${fieldName ?? 'files'}` → `dropzoneAriaLabel` con `{ fieldName: fieldName ?? 'files' }`. El
          defaultText **debe permanecer en inglés** (per spec/no objetivo D-No-3).
- `src/runtime/nodes/file-manager/file-manager-list.tsx`:
    - `Error al cargar los ficheros.` → `listLoadError`.
    - `No hay ficheros subidos.` → `listEmpty`.
    - `Anterior` → `paginationPrevious`.
    - `Siguiente` → `paginationNext`.
- `src/runtime/nodes/file-manager/file-manager-row.tsx`:
    - `Ver` → `rowViewLabel`.
    - `Ver fichero` → `rowViewAriaLabel`.
    - `Ver no disponible` → `rowViewUnavailableAriaLabel`.
    - `Descargar` → `rowDownloadLabel`.
    - `Descargar fichero` → `rowDownloadAriaLabel`.
    - `Descargar no disponible` → `rowDownloadUnavailableAriaLabel`.
    - `Eliminar` → `rowDeleteLabel`.
    - `Eliminar fichero` → `rowDeleteAriaLabel`.
- `src/runtime/nodes/file-manager/use-file-manager.ts`:
    - Mensajes generados por el hook que hoy dispatchan a `upload-error` / `add-inline-error`:
        - `Error al subir "${normalizedName}".` → `uploadFileError` con `{ fileName: normalizedName }`.
        - `La respuesta de la subida no incluye la lista actualizada de ficheros.` → `uploadListPathMissing`.
        - `Error al eliminar el fichero.` → `deleteError`.
    - Para poder resolverlos, el hook debe recibir acceso al `state` actual en el momento del dispatch (ya tiene
      `readRuntimeState()`) y al `labels` (leído de `node.props.labels`).

Regla de aplicación (para todos los sitios): un `labels[key]` omitido debe producir exactamente el texto por defecto
actual, byte a byte, para no regresionar configuraciones existentes.

**Fuera de alcance**:

- Extender el catálogo de literales.
- Refactorizar los componentes más allá del rerouting a `resolveFileManagerLabel`.
- Cambiar la lógica de subida, borrado o paginación.
- Mover los defaults a un catálogo centralizado.

**Dependencias**: T4, T5, T6.

**Impacto esperado en archivos**:

- Código:
    - `src/runtime/nodes/file-manager-layout-node.tsx` (orquestación de `resolvedLabels`/`rawLabels`, propagación de
      `state`).
    - `src/runtime/nodes/file-manager/file-manager-drop-zone.tsx`.
    - `src/runtime/nodes/file-manager/file-manager-list.tsx`.
    - `src/runtime/nodes/file-manager/file-manager-row.tsx`.
    - `src/runtime/nodes/file-manager/use-file-manager.ts` (mensajes runtime del hook, pre-resueltos antes de dispatch).
    - `src/runtime/nodes/file-manager/file-manager-error-list.tsx` **no cambia** (sigue recibiendo strings
      pre-resueltos).
- Tests:
    - `src/tests/layout-renderer/layout-renderer-file-manager.test.tsx` (ampliación).
    - `src/tests/runtime/runtime-file-manager-hook.test.tsx` (ampliación) — cubrir mensajes del hook con labels.
- Documentación:
    - `ai-workflow/docs/app-features/nodes/file-manager.md` — pendiente de reflejar el bloque `props.labels`, catálogo
      cerrado y ejemplos cuando se ejecute `update-app-documentation`.

**Tests**:

- Ficheros de test:
    - `src/tests/layout-renderer/layout-renderer-file-manager.test.tsx` (ampliación).
    - `src/tests/runtime/runtime-file-manager-hook.test.tsx` (ampliación).
- Comportamiento cubierto:
    - Sin `labels`, el render sigue produciendo exactamente los mismos textos actuales en zona DnD, lista, paginación,
      filas y errores inline (no regresión, verificado con las aserciones ya existentes).
    - `labels.dropzoneIdle: "Suelta aquí"` sustituye al texto por defecto de la zona DnD en reposo.
    - `labels.dropzoneAcceptedFormats: "Formatos: {{formats}}"` con `acceptExtension: [".pdf", ".jpg"]` renderiza
      `Formatos: .pdf, .jpg`.
    - `labels.dropzoneProgress: "{{completed}} de {{total}} ({{percent}}%)"` renderiza el string interpolado con los
      valores reales durante la subida.
    - `labels.dropzoneSuccess: "Subidos {{count}}"` con éxito de tres ficheros renderiza `Subidos 3`.
    - `labels.dropzoneMaxFilesReached: "Máximo {{max}}"` renderiza el valor de `validations.maxFiles`.
    - `labels.dropzoneAriaLabel: "Zona de {{fieldName}}"` cambia el aria-label; si se omite, el aria-label sigue en
      inglés (`Drop zone for ...`).
    - `labels.listLoadError`, `labels.listEmpty`, `labels.paginationPrevious`, `labels.paginationNext` sustituyen sus
      literales.
    - `labels.rowViewLabel`, `labels.rowViewAriaLabel`, `labels.rowViewUnavailableAriaLabel`, `labels.rowDownloadLabel`,
      `labels.rowDownloadAriaLabel`, `labels.rowDownloadUnavailableAriaLabel`, `labels.rowDeleteLabel`,
      `labels.rowDeleteAriaLabel` sustituyen sus literales en las filas de la lista.
    - `labels.uploadFileError: "Fallo: {{fileName}}"` renderiza `Fallo: foo.pdf` en el error inline cuando la subida de
      `foo.pdf` falla (hook test).
    - `labels.uploadListPathMissing: "translations.subidaSinLista"` renderiza el valor del catálogo activo cuando
      `listPath` no resuelve (hook test).
    - `labels.deleteError: "translations.borradoFallido"` renderiza el valor del catálogo activo cuando el borrado
      falla (hook test).
    - `labels.dropzoneAcceptedFormats: "Formatos: {{formats}}"` sin `acceptExtension` configurado no aparece igual que
      hoy (la condición de aparición no cambia).
    - `labels.<clave>: ""` (por ejemplo `labels.listEmpty: ""`) renderiza string vacío en ese literal en vez del texto
      por defecto.
- Comandos durante la implementación:
    - `pnpm test --run src/tests/layout-renderer/layout-renderer-file-manager.test.tsx`
    - `pnpm test --run src/tests/runtime/runtime-file-manager-hook.test.tsx`
- Restricciones:
    - Reusar los harness de render y de hook ya presentes en cada fichero de tests (no duplicar builders).
    - Los tests de aria-label deben leer el atributo real del DOM.
    - Los tests que verifiquen ausencia de `labels` deben no declarar el bloque en la config (no basta con
      `labels: {}`).
    - No añadir snapshots.

**Documentación afectada**:

- `ai-workflow/docs/app-features/nodes/file-manager.md`.

**Criterios de finalización**:

- Todos los literales del catálogo cerrado pasan por `resolveFileManagerLabel`.
- Los placeholders locales se computan en el sitio de consumo, no en el helper.
- Los tests de render y de hook demuestran cada sustitución y la ausencia de regresión.

**Cierre de implementación**:

- Cambios de UI y de hook aplicados; tests referenciados en verde; `pnpm test` global cumple el umbral de cobertura.
