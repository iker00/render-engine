# Tareas de implementación — Feature 0079

> Contrato de ejecución secuencial. Ejecutar tareas en orden. No reabrir alcance ni rediseñar durante la implementación.

## Resumen del alcance técnico

La feature `0079` añade soporte de interpolación parcial `{{...}}` en los valores de cabecera de las cuatro superficies declarativas que hoy ya aceptan referencias completas en headers:

- `api.headers`
- `button.props.action.headers` (incluyendo `executeOperations.operations[].headers`)
- `form.submitAction.headers` (incluyendo `executeOperations.operations[].headers`)
- `preloads[].headers`

Todas estas superficies convergen en `resolveHeaders()` dentro de `src/queries/runtime-api-payload-resolver.ts`, que se invoca desde `buildRuntimeApiRequest` / `buildInlineRuntimeApiRequest`. Por tanto el cambio principal es centralizado: ampliar la resolución de valores de header para detectar placeholders `{{...}}` y combinarlos con texto literal usando la misma capa central `resolveRuntimeReference`. El resto de superficies (`query`, `body`) no se tocan: siguen aceptando solo referencia completa o literal según el contrato actual.

La política de errores para headers se mantiene como `request-build-failed` (sin degradación silenciosa a string vacío), igual que en `api.endpoint`. La política de `token-refresh-failed` ya soportada en `resolveHeaders` se preserva sin cambios. La omisión de claves para campos ocultos en submit (`hiddenFormFields`) se extiende a placeholders: si un placeholder del valor referencia un campo oculto del propio formulario que dispara el submit, el header completo se omite (no se produce un valor parcial).

Decisiones técnicas vinculantes:

- **D1** Punto único de implementación: añadir un helper interno `resolveHeaderTemplateValue` en `runtime-api-payload-resolver.ts` que `resolveHeaders` invoca por cada entry. El helper detecta `{{` y, si está presente, ejecuta el flujo de interpolación; si no, delega en `resolvePayloadValue` para conservar el comportamiento exacto actual (referencia completa o literal).
- **D2** Reuso de la capa central: el flujo de interpolación reutiliza `resolveRuntimeReference` y `RUNTIME_TEMPLATE_PLACEHOLDER_PATTERN` ya exportados desde `src/runtime/runtime-references/runtime-reference-resolver.ts`. No se duplica la lógica de parseo de placeholders ni se introduce un nuevo módulo.
- **D3** Semántica de cada placeholder dentro de un valor de header:
  - placeholder vacío (`{{}}` o solo espacios) → `request-build-failed`
  - estado `token-error` → corta el resto del valor y propaga `token-refresh-failed` con el `tokenId` afectado
  - estado `missing` cuyo `reference.namespace === 'forms'`, `path.length === 2`, `path[0] === hiddenFormFields?.formId` y `hiddenFormFields.fieldIds.has(path[1])` → marca el header completo como `omit`
  - estado `resolved` con valor `string` → se inserta tal cual
  - estado `resolved` con valor `number` o `boolean` → `String(value)`
  - estado `resolved` con valor `null`, `undefined`, objeto o array → `request-build-failed`
  - cualquier otro estado (`missing` no-omitible, `invalid`, `unsupported`, `literal`) → `request-build-failed`
- **D4** Omisión de header en interpolación: si cualquier placeholder del valor activa la condición de hidden-form-field, se descarta el header completo. No se emite un valor parcial. Esta política es consistente con la omisión actual en `resolveHeaders` (la entrada se omite del wire format).
- **D5** Compatibilidad: un valor sin `{{` se enruta directo por `resolvePayloadValue` y mantiene exactamente el comportamiento previo, incluyendo el branch que ya hace `resolvePayloadValue` para `forms.{formId}.{fieldId}` hidden. No se cambia ese branch.
- **D6** Diagnóstico: el catálogo actual `RuntimeReferenceSurface` en `runtime-reference-diagnostics.ts` no contempla superficies de header y el flujo actual de `resolveHeaders` tampoco invoca `reportRuntimeReferenceDiagnostic`. Esta feature no añade superficies nuevas al catálogo ni cambia el diagnóstico: se mantiene el comportamiento silencioso actual de cabeceras (los mensajes de error ya incluyen el header y la referencia que falló).
- **D7** Sin cambios en validación de config previa al render. Las superficies de header ya aceptan strings; un valor con `{{...}}` sigue cumpliendo el esquema Zod actual. No se añaden tests de validación.
- **D8** Sin cambios en el contrato de claves de header (siguen siendo strings literales). Sin cambios en familias admitidas por superficie: las mismas que hoy son válidas como referencia completa en cada superficie son las únicas válidas dentro de `{{...}}`.

Notas:

- `executeOperations` ya delega cada operación en `buildRuntimeApiRequest` / `buildInlineRuntimeApiRequest`, por lo que la interpolación en su sub-array `operations[].headers` se cubre automáticamente al cambiar `resolveHeaders`. No requiere tarea propia.
- La superficie `preloads[].headers` también se ejecuta vía `buildRuntimeApiRequest` desde el flujo de page-entry; misma cobertura automática.
- La pregunta abierta de la spec sobre la disponibilidad actual de `params.*` en `preloads[].headers` se hereda del contrato de referencia completa: si hoy es admitida como referencia completa, también lo será dentro de `{{...}}` sin cambios adicionales; si no, el placeholder fallará con `request-build-failed` igual que su equivalente completo. La implementación no introduce ni amplía la frontera.

---

## T1 — Soporte de interpolación `{{...}}` en `resolveHeaders` (núcleo + unit tests)

- **ID**: T1
- **Estado**: completed
- **Objetivo**: Ampliar `src/queries/runtime-api-payload-resolver.ts` para que los valores de cabecera con uno o varios placeholders `{{referencia}}` se resuelvan combinando texto literal y referencias dinámicas. Mantener idéntico el comportamiento actual para valores sin `{{...}}`. Preservar `token-refresh-failed` y la omisión de hidden-form-fields. No tocar `query` ni `body`.
- **Fuera de alcance**:
  - Cambios en `resolvePayloadValue` para los caminos `query`/`body` (estos siguen aceptando solo referencia completa o literal).
  - Cambios en `runtime-reference-parser.ts` o `runtime-reference-resolver.ts` (la capa central ya cubre todo lo necesario vía `resolveRuntimeReference` y `RUNTIME_TEMPLATE_PLACEHOLDER_PATTERN`).
  - Cambios en `RuntimeReferenceSurface` o en `reportRuntimeReferenceDiagnostic`.
  - Cambios en validación de config (`src/config/`).
  - Tests de integración por superficie (forman T2).
- **Dependencias**: ninguna.
- **Impacto esperado en archivos**:
  - código:
    - `src/queries/runtime-api-payload-resolver.ts` (modificar):
      - Añadir un helper interno (no exportado) `resolveHeaderTemplateValue(rawValue, options)` que:
        - si `rawValue` no incluye `{{`, devuelve `resolvePayloadValue(rawValue, options)` tal cual (incluido `omit` / `token-error` / `error` / `ready`).
        - si incluye `{{`, recorre el string con `RUNTIME_TEMPLATE_PLACEHOLDER_PATTERN` y construye el valor concatenando los fragmentos literales y los placeholders resueltos.
        - aplica la semántica de D3 placeholder por placeholder; si algún placeholder activa `omit` (hidden-form-field) marca el header como `omit`; si activa `token-error` corta y devuelve `token-error` con el `tokenId`; si activa cualquier error devuelve `error`.
        - una vez procesados todos los placeholders sin omisión ni error, devuelve `{ status: 'ready', value: <string concatenado> }`.
      - Modificar `resolveHeaders` para invocar el helper nuevo en lugar de `resolvePayloadValue` en cada entry. Conservar las ramas `omit`, `token-error`, `error` y la rama de tipo no-string del flujo actual (sigue rechazando un `ready` cuyo valor final no sea string, aunque tras interpolación el tipo siempre sea string; se mantiene como defensa).
      - No exportar `resolveHeaderTemplateValue`; se usa solo desde `resolveHeaders`.
    - `src/runtime/runtime-references/runtime-reference-resolver.ts` (no modificar): se reusa `RUNTIME_TEMPLATE_PLACEHOLDER_PATTERN` ya exportado.
  - tests:
    - `src/tests/runtime/runtime-api-header-interpolation.test.ts` (nuevo): cobertura unitaria del helper a través de `resolveHeaders`.
  - documentación: ninguna en esta tarea.
- **Cambios concretos**:
  - El helper reinicia `RUNTIME_TEMPLATE_PLACEHOLDER_PATTERN.lastIndex = 0` antes de iterar (mismo patrón que `resolveEndpoint` en `runtime-api-request.ts`) para evitar arrastre de estado entre invocaciones.
  - El helper extrae el `tokenId` desde `parsedReference.reference.path[0]` solo cuando el branch es `token-error`, igual que el código actual de `resolvePayloadValue`.
  - El helper trata los espacios alrededor del contenido del placeholder con `String.prototype.trim()` antes de pasarlo a `resolveRuntimeReference`, consistente con `resolveRuntimeInterpolatedVisibleValue`.
  - El helper no invoca `reportRuntimeReferenceDiagnostic` (decisión D6).
- **Tests**:
  - **Ficheros de test**:
    - `src/tests/runtime/runtime-api-header-interpolation.test.ts` (nuevo).
  - **Comportamiento cubierto**:
    - Valor sin `{{` se comporta igual que antes (referencia completa válida `"forms.f.field"` → `ready` con valor del campo; literal `"static-value"` → `ready` con literal; `forms.myForm.hiddenField` con `hiddenFormFields` → `omit`).
    - `"Bearer {{tokens.sede.value}}"` con `tokens.sede.status: 'ready'` y `value: 'XYZ'` → header con valor `"Bearer XYZ"`.
    - `"{{params.tenantId}}-{{queries.session.data.userId}}"` con ambas referencias resueltas (`tenantId: 'acme'`, `userId: 'u-1'`) → header con valor `"acme-u-1"`.
    - Espacios alrededor de la referencia dentro del placeholder se ignoran: `"{{ tokens.sede.value }}"` produce el mismo valor que `"{{tokens.sede.value}}"`.
    - Placeholder con referencia ausente (`{{params.missingParam}}`) → resultado `error` con `code: request-build-failed` y mensaje que cita el header y la referencia fallida.
    - Placeholder con token en estado `'error'` (`{{tokens.sede.value}}`) → resultado `error` con `code: token-refresh-failed` y `tokenId: 'sede'`.
    - Placeholder con referencia bien formada pero valor `null`/`undefined` resuelto → `request-build-failed`.
    - Placeholder con referencia bien formada pero valor objeto o array → `request-build-failed`.
    - Placeholder con referencia inválida (`{{forms.justOne}}`, `{{params}}`, `{{queries.x.status.deep}}`) → `request-build-failed`.
    - Placeholder con referencia unsupported (`{{navigation.currentPageId}}`) → `request-build-failed`.
    - Placeholder vacío (`{{}}`) o solo espacios (`{{   }}`) → `request-build-failed`.
    - Llaves no pareadas dentro del valor (`"Bearer {token}"`, `"valor}raro"`) no se interpretan como placeholder y el valor se trata como literal (`resolvePayloadValue` actual lo trataría como literal sin `{{`).
    - Valor formado por un único placeholder `"{{tokens.sede.value}}"` produce el mismo valor que la referencia completa `"tokens.sede.value"` (paridad con criterio 10 de la spec).
    - Dos placeholders donde uno resuelve y otro no: el valor completo falla con `request-build-failed`, no produce un header parcial.
    - Placeholder `{{forms.myForm.hiddenField}}` con `hiddenFormFields = { formId: 'myForm', fieldIds: new Set(['hiddenField']) }` → el header completo se omite (`resolveHeaders` no incluye la clave en el output).
    - Valor `"prefix-{{forms.myForm.hiddenField}}"` con la misma `hiddenFormFields` → el header completo se omite (no se produce un valor parcial con `"prefix-"`).
    - Placeholder `{{forms.otherForm.someField}}` con `hiddenFormFields.formId !== 'otherForm'` y campo ausente → `request-build-failed` (la omisión es exclusiva del formulario que dispara el submit).
    - Header con valor que mezcla referencia completa y texto literal sin delimitadores (`"prefix-queries.user.data.id"`) sigue tratándose como string literal (sin interpolación).
    - Smoke test de regresión con todos los casos del fichero `runtime-api-payload-omission.test.ts` relativos a `resolveHeaders` (referencia completa hidden → omit, referencia completa missing en otro form → error, referencia completa válida → ready) replicados aquí en su forma con interpolación para garantizar paridad.
  - **Comandos durante la implementación**:
    - `pnpm test --run src/tests/runtime/runtime-api-header-interpolation.test.ts`
  - **Restricciones**:
    - Reusar el patrón de fixtures `makeState`/`makeFormState` que ya existe en `runtime-api-payload-omission.test.ts`. No introducir un harness nuevo: copiar el patrón o extraer un helper a un fichero local si la duplicación supera ~50 líneas.
    - No mockear `resolveRuntimeReference`; los tests deben ejercitar el flujo real para validar la semántica.
    - No introducir snapshots.
- **Documentación afectada**:
  - `ai-workflow/docs/app-features/references/dynamic-strings.md` (la actualizará `update-app-documentation`): añadir las cuatro superficies de header al catálogo de superficies con interpolación; explicitar la semántica de error (no string vacío).
  - `ai-workflow/docs/app-features/references/reference-resolution.md` (la actualizará `update-app-documentation`): reflejar que los headers admiten interpolación además de referencia completa.
  - `ai-workflow/docs/app-features/queries/execution.md` (la actualizará `update-app-documentation`): retirar la afirmación actual de que `{{...}}` no aplica en `api.headers` y derivados.
- **Criterios de finalización**: el helper de interpolación está implementado dentro de `resolveHeaders`, los tests del nuevo fichero pasan, no hay regresiones en `pnpm test`.
- **Cierre de implementación**: código modificado, todos los tests del nuevo fichero verdes, `pnpm test` global cumple el umbral del 80%.

---

## T2 — Integración end-to-end en las cuatro superficies de header

- **ID**: T2
- **Estado**: completed
- **Objetivo**: Verificar mediante tests de integración que la interpolación `{{...}}` en valores de header funciona correctamente en cada una de las cuatro superficies admitidas, ejercitando la ruta completa desde `buildRuntimeApiRequest` (`api.headers`, `button.props.action.headers`, `form.submitAction.headers`, `preloads[].headers`). Validar también la omisión de headers en submit cuando un placeholder referencia un campo oculto del propio formulario.
- **Fuera de alcance**:
  - Reimplementar lógica de resolución (vive en T1).
  - Cambios en validación de config previa al render (ningún test en `config-validation/`).
  - Cambios en parser o resolver de referencias.
  - Tests de `executeOperations` (plural) por superficie: el cambio es centralizado y al cubrir la superficie básica queda asegurado el plural; basta con un caso de smoke en `button.props.action.headers` plural.
- **Dependencias**: T1.
- **Impacto esperado en archivos**:
  - código: ninguno; los cambios viven en T1.
  - tests:
    - `src/tests/runtime/runtime-api-execution.test.ts` (ampliación): casos para `api.headers` con interpolación al ejecutar la operación vía `executeQueryOperation`.
    - `src/tests/runtime/runtime-page-entry-preloads.test.tsx` (ampliación): caso para `preloads[].headers` con interpolación al disparar la precarga al entrar en página.
    - `src/tests/runtime/runtime-ui-actions.test.tsx` (ampliación): caso para `button.props.action.headers` con interpolación al hacer click (incluyendo un sub-caso con `executeOperations` plural).
    - `src/tests/runtime/runtime-form-submit-hidden-fields.test.tsx` (ampliación): caso para `form.submitAction.headers` con interpolación cuyo placeholder referencia un campo oculto del propio form → header omitido del wire format.
  - documentación: ninguna en esta tarea (la actualización funcional vive en `update-app-documentation` posterior).
- **Cambios concretos**:
  - Cada test de integración debe asertar:
    - el header final emitido al fetch mockeado (orden y valor exacto, sin espacios añadidos),
    - el comportamiento ante fallo (`request-build-failed`) cuando una referencia del placeholder no resuelve,
    - el comportamiento ante `token-refresh-failed` cuando el placeholder referencia un token en error.
  - El sub-caso de `form.submitAction.headers` con campo oculto debe asertar que la clave del header no aparece en `init.headers` del request emitido.
- **Tests**:
  - **Ficheros de test**:
    - `src/tests/runtime/runtime-api-execution.test.ts` (ampliación).
    - `src/tests/runtime/runtime-page-entry-preloads.test.tsx` (ampliación).
    - `src/tests/runtime/runtime-ui-actions.test.tsx` (ampliación).
    - `src/tests/runtime/runtime-form-submit-hidden-fields.test.tsx` (ampliación).
  - **Comportamiento cubierto**:
    - `api.headers` con `"Authorization": "Bearer {{tokens.sede.value}}"` al ejecutar la operación produce el header `Authorization: "Bearer XYZ"` (con token ready).
    - `api.headers` con `"X-Header": "{{params.tenantId}}-{{queries.session.data.userId}}"` y ambas referencias resueltas produce el header concatenado.
    - `api.headers` con placeholder cuyo token está en error → la query queda en `status: error` con `code: token-refresh-failed`.
    - `api.headers` con placeholder cuya referencia falta → la query queda en `status: error` con `code: request-build-failed`.
    - `preloads[].headers` con `"Authorization": "Bearer {{tokens.sede.value}}"` al entrar en página produce el header concatenado correcto en el request precargado.
    - `preloads[].headers` con placeholder cuya referencia falta → la precarga queda en `status: error` con `code: request-build-failed`.
    - `button.props.action.headers` con placeholder al click produce el header concatenado correcto; smoke adicional con `executeOperations` plural verificando que el override por operación también interpola.
    - `button.props.action.headers` con placeholder no resoluble al click → `queries.{operationName}` queda en `status: error` con `code: request-build-failed`.
    - `form.submitAction.headers` con `"Authorization": "Bearer {{forms.myForm.token}}"` y campo `token` visible en el form produce el header concatenado correcto al submit.
    - `form.submitAction.headers` con `"X-Hint": "{{forms.myForm.hiddenField}}"` donde `hiddenField` está oculto por `visibility` del propio form omite la clave `X-Hint` del request final; el resto del payload (`body`, `query`) sigue el flujo estándar.
    - `form.submitAction.headers` con placeholder cuya referencia es `params.unknownParam` → submit falla con `code: request-build-failed`.
  - **Comandos durante la implementación**:
    - `pnpm test --run src/tests/runtime/runtime-api-execution.test.ts`
    - `pnpm test --run src/tests/runtime/runtime-page-entry-preloads.test.tsx`
    - `pnpm test --run src/tests/runtime/runtime-ui-actions.test.tsx`
    - `pnpm test --run src/tests/runtime/runtime-form-submit-hidden-fields.test.tsx`
  - **Restricciones**:
    - Reusar los harnesses, fixtures y mocks ya establecidos en cada uno de esos ficheros (incluyendo el patrón de mock de `fetch` y los `RuntimeStateProvider` fixtures); no introducir un harness nuevo por test.
    - Limitar el número de casos por fichero al mínimo necesario para cubrir el comportamiento listado; no replicar la matriz completa de unit tests de T1.
    - No introducir tests de `executeOperations` plural por cada superficie: basta el smoke listado en `button.props.action.headers`.
- **Documentación afectada**:
  - Mismas fichas que T1 (mencionadas allí). Esta tarea no añade impacto documental adicional.
- **Criterios de finalización**: los cuatro ficheros de test ampliados pasan en verde y demuestran que las cuatro superficies interpolan correctamente, propagan los códigos de error esperados y aplican la omisión de hidden fields en submit.
- **Cierre de implementación**: tests integración verdes, `pnpm test` global cumple el umbral del 80%, no hay regresiones en otros ficheros de test.

---

## Orden de ejecución

1. T1 — implementar el núcleo y los unit tests del helper.
2. T2 — añadir los tests de integración por superficie sobre el núcleo ya implementado.

Tras cerrar ambas tareas, la feature queda lista para `update-app-documentation`, que actualizará las fichas declaradas en el bloque "Documentación afectada" de cada tarea.
