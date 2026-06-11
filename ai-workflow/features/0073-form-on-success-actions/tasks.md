# Tareas de implementación — Feature 0073

> Contrato de ejecución secuencial. Ejecutar tareas en orden. No reabrir alcance ni rediseñar durante la implementación.

## Resumen del alcance técnico

La feature introduce tres extensiones contractuales independientes pero relacionadas:

1. Campo `when` por entrada en `executeOperations.operations[*]` (acción de botón y submitAction de formulario).
2. Campo `when` por entrada en `pages[].preloads[*]`.
3. Campo `submitAction.onSuccess` en formularios: lista ordenada de acciones (`navigateTo | goBack | executeOperation | executeOperations | resetForm | openModal | closeModal`) con `when` opcional por acción.

Todas las evaluaciones de `when` se hacen reutilizando `matchesVisibilityRule` de `src/runtime/runtime-layout-visibility.ts`. La validación de shape de `when` reutiliza el validador `validateVisibility` y `isValidVisibilityReference` de `src/config/validate-actions-visibility.ts`, con dos matices declarados en la feature:

- en preloads, `item.*` es referencia inválida (no existe contexto de item).
- en `when` (preloads, entradas de `executeOperations` y `onSuccess`), la spec exige aceptar `params.*` como referencia. `isValidVisibilityReference` actualmente NO acepta `params.*`. Por eso esta feature introduce un nuevo helper `isValidWhenReference` que reutiliza la base de `isValidVisibilityReference` y añade `params.*`. `visibility` (transversal a nodos) sigue rechazando `params.*` como hoy.

Los tipos `Action` con `when?` quedan modelados de forma compartida en `runtime-config-types.ts` (ver T6).

---

## T1 — Tipo `Action` compartido y tipos extendidos

- **ID**: T1
- **Estado**: completed
- **Objetivo**: Extender los tipos TypeScript en `src/config/runtime-config-types.ts` para reflejar el nuevo contrato (sin tocar runtime ni validación todavía).
- **Fuera de alcance**:
  - Cambios en el shape público de `button.props.action` (no añadir `when` al nivel raíz de la acción de botón).
  - Cualquier cambio en lógica runtime o validación.
- **Dependencias**: ninguna.
- **Impacto esperado en archivos**:
  - código: `src/config/runtime-config-types.ts` (modificar)
  - tests: `src/tests/config-validation/runtime-config-validation-forms-semantics.test.ts` (no edición en esta tarea; los tests vienen en T3-T7)
  - documentación: ninguna en esta tarea.
- **Cambios concretos**:
  - Añadir un alias exportado `RuntimeWhenCondition = RuntimeVisibilityConfig` (mismo shape, nombre distinto para legibilidad en consumidores).
  - Añadir `when?: RuntimeWhenCondition` a `ExecuteOperationsRuntimeUiActionEntry`.
  - Añadir `when?: RuntimeWhenCondition` a `RuntimePreloadConfig`.
  - Crear un nuevo tipo `FormOnSuccessAction = RuntimeUiAction & { when?: RuntimeWhenCondition }`. Este tipo se intersecta con la unión completa; cada miembro de la unión hereda el `when?` opcional. Es el "tipo `Action` compartido" mencionado en la spec; no se sobrescribe `RuntimeUiAction` (las acciones de botón no aceptan `when`).
  - Añadir `onSuccess?: FormOnSuccessAction[]` a `FormLayoutNode`.
- **Tests**:
  - **Ficheros de test**: ninguno; cubierto por T2 (Zod), T3 (validation actions-visibility) y T6 (runtime tests de onSuccess) que ya ejercitarán los tipos a través de TypeScript en compile-time.
  - **Comportamiento cubierto**: n/a en esta tarea; los tipos son una pre-condición para tareas siguientes.
  - **Comandos durante la implementación**: `pnpm test --run src/tests/config-validation/runtime-config-validation-forms-semantics.test.ts` para confirmar que la suite sigue verde tras el cambio de tipos.
  - **Restricciones**: no introducir cambios runtime ni de validación en esta tarea; solo declaraciones de tipos. No tocar el tipo `ButtonAction`.
- **Documentación afectada**: ninguna en esta tarea (se actualizará tras T7).
- **Criterios de finalización**: el proyecto compila (`tsc`) y los tests existentes siguen en verde.
- **Cierre de implementación**: tipos extendidos, `pnpm test` global sigue pasando.

---

## T2 — Schemas Zod para `when` en preloads, entries y onSuccess

- **ID**: T2
- **Estado**: completed
- **Objetivo**: Ampliar los schemas Zod en `src/config/runtime-config-zod.ts` para reconocer `when` opcional en `executeOperationsRuntimeUiActionEntrySchema`, en preloads (a través del cambio en `validate-preloads.ts` consumiendo el schema reutilizable) y exponer un esquema base reutilizable para `when`.
- **Fuera de alcance**:
  - Validación semántica (`params.*`, operador, value): vive en T3.
  - Validación cruzada (`operationName`, `pageId`, `modalId` existentes): vive en T4.
  - Definición del shape de `onSuccess` a nivel de Zod del nodo `form`: el schema del nodo `form` deja `submitAction` y `onSuccess` como `z.unknown()` (siguiendo el patrón actual), y la validación contractual se hace en T3.
- **Dependencias**: T1.
- **Impacto esperado en archivos**:
  - código: `src/config/runtime-config-zod.ts` (modificar), `src/config/validate-preloads.ts` (modificar para preservar `when` en el `RuntimePreloadConfig` resultante)
  - tests: `src/tests/config-validation/runtime-config-validation-preloads.test.ts` (ampliación), `src/tests/config-validation/runtime-config-validation-forms-semantics.test.ts` (ampliación), `src/tests/config-validation/runtime-config-validation-buttons.test.ts` (ampliación)
  - documentación: ninguna en esta tarea.
- **Cambios concretos**:
  - Reusar `visibilitySchema` (el ya existente en `runtime-config-zod.ts`) y exportarlo adicionalmente como `whenConditionSchema` (alias del mismo símbolo) para legibilidad en consumidores. No se duplica shape.
  - Añadir `when: whenConditionSchema.optional()` a `executeOperationsRuntimeUiActionEntrySchema`.
  - En `validate-preloads.ts`, ampliar el contrato estructural de cada entrada de `preloads` para admitir opcionalmente una clave reservada `when`. El shape pasa a permitir 1 o 2 claves: la clave dinámica `operationName` (obligatoria) y opcionalmente la clave literal `when`. Reglas exactas:
    - `entries.length === 0` o `entries.length > 2` → error de shape ya existente: `invalidPreloadEntry(pageIndex, preloadIndex)` con el mensaje actual `The page at "pages[${pageIndex}].preloads[${preloadIndex}]" must be an object with exactly one non-empty operationName key.` (sin cambios en el mensaje).
    - `entries.length === 2` y ninguna clave es exactamente `"when"` → mismo error `invalidPreloadEntry`. No se introduce un mensaje nuevo: la regla sigue siendo "una clave de operación; `when` es la única clave reservada extra permitida".
    - `entries.length === 2` con clave `"when"` → la otra clave es `operationName` y se valida con las mismas reglas existentes; el valor de `when` se parsea con `whenConditionSchema.safeParse(...)`. Si el parseo falla, se devuelve `invalidLayout` con la ruta `pages[${pageIndex}].preloads[${preloadIndex}].when.<segmento>` según el `issuePath` retornado por Zod, alineado con la convención actual del fichero.
  - El `RuntimePreloadConfig` resultante incluye `when` cuando estaba declarado (T1 ya extendió el tipo).
- **Tests**:
  - **Ficheros de test**:
    - `src/tests/config-validation/runtime-config-validation-buttons.test.ts` (ampliación)
    - `src/tests/config-validation/runtime-config-validation-forms-semantics.test.ts` (ampliación)
    - `src/tests/config-validation/runtime-config-validation-preloads.test.ts` (ampliación)
  - **Comportamiento cubierto**:
    - acepta `executeOperations` con `operations[i].when = { reference: "queries.x.data.flag", operator: "isTruthy" }` tanto en `button.props.action` como en `form.submitAction`.
    - acepta una entrada de `preloads` declarada como `{ "<operationName>": <requestParams>, "when": { ... } }` con el shape válido.
    - rechaza una entrada de `preloads` con tres claves: error `invalidPreloadEntry` con el mensaje existente sin modificación.
    - rechaza una entrada de `preloads` con dos claves donde ninguna es `when`: mismo error `invalidPreloadEntry` con el mensaje existente.
    - rechaza una entrada de `preloads` con clave `when` cuyo valor no es objeto o tiene shape estructural inválido (e.g. `operator` no string): error con ruta `pages[N].preloads[M].when.<segmento>` exacta.
    - rechaza una entrada de `executeOperations.operations[i].when` con shape estructural inválido (e.g. `operator` no string) con la ruta exacta.
    - confirma que el shape de `button.props.action` sigue rechazando `when` a nivel raíz (no por entrada): un `navigateTo` con `when` a nivel raíz no se acepta.
  - **Comandos durante la implementación**:
    - `pnpm test --run src/tests/config-validation/runtime-config-validation-preloads.test.ts`
    - `pnpm test --run src/tests/config-validation/runtime-config-validation-forms-semantics.test.ts`
    - `pnpm test --run src/tests/config-validation/runtime-config-validation-buttons.test.ts`
  - **Restricciones**: no añadir validación semántica de `params.*` ni `item.*` aquí; corresponde a T3. Tampoco validar cross-config (T4).
- **Documentación afectada**: ninguna en esta tarea.
- **Criterios de finalización**: los schemas reflejan el contrato y los tests de aceptación/rechazo estructural pasan.
- **Cierre de implementación**: schemas extendidos y nuevos tests verdes; `pnpm test` global sigue cumpliendo umbral 80%.

---

## T3 — Validación semántica de `when` (referencia + operador + valor)

- **ID**: T3
- **Estado**: completed
- **Objetivo**: Introducir un helper `validateWhenCondition` en `src/config/validate-actions-visibility.ts` análogo a `validateVisibility`, reutilizando reglas de operador/valor pero con un catálogo de referencias específico para `when`. Aplicarlo en preloads y en cada entrada de `executeOperations.operations[*]`.
- **Fuera de alcance**:
  - Validación cross-config de existencia (`pageId`/`operationName`/`modalId`): vive en T4.
  - `onSuccess` actions: estructura y validación viven en T5.
- **Dependencias**: T2.
- **Impacto esperado en archivos**:
  - código: `src/config/validate-actions-visibility.ts` (modificar), `src/config/validate-preloads.ts` (modificar), `src/config/validate-form-nodes.ts` (modificar para propagar errores en submitAction.operations[i].when, ver más abajo)
  - tests: `src/tests/config-validation/runtime-config-validation-visibility.test.ts` (ampliación), `src/tests/config-validation/runtime-config-validation-preloads.test.ts` (ampliación), `src/tests/config-validation/runtime-config-validation-buttons.test.ts` (ampliación), `src/tests/config-validation/runtime-config-validation-forms-semantics.test.ts` (ampliación)
  - documentación: ninguna en esta tarea.
- **Cambios concretos**:
  - Crear `isValidWhenReference(reference, { allowItem }): boolean` que:
    - acepta lo que ya acepta `isValidVisibilityReference` (forms.*, queries.*, item.* condicionalmente).
    - acepta también `params.*` con el patrón `^params\.[A-Za-z0-9_-]+$`.
    - rechaza `item.*` cuando `allowItem === false`.
  - Crear `validateWhenCondition(rawWhen, path, pageId, { allowItem }): { status: 'ready'; when?: RuntimeWhenCondition } | { status: 'error'; error }` reutilizando la lógica de operador/valor de `validateVisibility`, pero llamando a `isValidWhenReference` en su lugar.
  - En `validateExecuteOperationsAction` (acción de botón y submit de form), después de validar request params por entry, validar `entry.when` con `allowItem: true` y `path = "${entryPath}.when"`.
  - En `validate-preloads.ts`, tras validar el shape básico, llamar a `validateWhenCondition(rawPreload.when, "${preloadPath}.when", \`pages[${pageIndex}]\`, { allowItem: false })` antes de almacenar el preload normalizado. Si la condición es válida, persistir `when` en `RuntimePreloadConfig`.
- **Tests**:
  - **Ficheros de test**:
    - `src/tests/config-validation/runtime-config-validation-preloads.test.ts` (ampliación)
    - `src/tests/config-validation/runtime-config-validation-buttons.test.ts` (ampliación)
    - `src/tests/config-validation/runtime-config-validation-forms-semantics.test.ts` (ampliación)
    - `src/tests/config-validation/runtime-config-validation-visibility.test.ts` (ampliación, solo para asegurar que `visibility` sigue rechazando `params.*` y que el catálogo previo no cambia)
  - **Comportamiento cubierto**:
    - acepta `preloads[i].when` con `reference: "params.userId", operator: "isTruthy"`.
    - acepta `preloads[i].when` con `reference: "forms.f1.field1", operator: "equals", value: "x"`.
    - rechaza `preloads[i].when` con `reference: "item.x"` con ruta de error exacta (`pages[N].preloads[M].<op>.when.reference`).
    - acepta `executeOperations.operations[i].when` con `reference: "params.id"`, `reference: "item.x"` (dentro de repeater) y `reference: "queries.x.data.flag"`.
    - rechaza `executeOperations.operations[i].when` con operador fuera de catálogo, ruta exacta.
    - rechaza `executeOperations.operations[i].when` con `isTruthy` que declara `value`.
    - rechaza preload `when.value` no escalar cuando el operador es `equals`.
    - confirma que `visibility` en nodos sigue rechazando `params.*` (no se contamina con `when`).
  - **Comandos durante la implementación**:
    - `pnpm test --run src/tests/config-validation/runtime-config-validation-preloads.test.ts`
    - `pnpm test --run src/tests/config-validation/runtime-config-validation-buttons.test.ts`
    - `pnpm test --run src/tests/config-validation/runtime-config-validation-forms-semantics.test.ts`
    - `pnpm test --run src/tests/config-validation/runtime-config-validation-visibility.test.ts`
  - **Restricciones**: ninguna específica más allá de no reutilizar `validateVisibility` directamente (mantener separadas las rutas de error para no romper mensajes existentes de `visibility`).
- **Documentación afectada**: ninguna en esta tarea.
- **Criterios de finalización**: rutas de error de `when` se devuelven con `path.when.reference|operator|value` exactos; tests verdes.
- **Cierre de implementación**: validación semántica completa, `pnpm test` global cumple umbral.

---

## T4 — Cross-validation de targets (`operationName`, `modalId`, `pageId`) en `submitAction.operations[*]` y propagación

- **ID**: T4
- **Estado**: completed
- **Objetivo**: Asegurar que `submitAction.operations[i].when` no rompe la validación cruzada existente (`validateActionTargets` y `validateExecutionRequestParamsInCollection`) y que esa validación cruzada sigue cubriendo correctamente las `executeOperations` de `submitAction`. No introduce comprobaciones nuevas: confirma y, si necesario, ajusta los walkers para que reconozcan el nuevo campo `when` sin tratarlo como error.
- **Fuera de alcance**:
  - Validación cruzada de `onSuccess` (vive en T5).
  - Lógica runtime.
- **Dependencias**: T3.
- **Impacto esperado en archivos**:
  - código: `src/config/validate-actions-visibility.ts` (revisar `findInvalidActionTarget`) y `src/config/validate-form-nodes.ts` (revisar `validateFormNodesInCollection` y `validateExecutionRequestParamsInCollection`).
  - tests: `src/tests/config-validation/runtime-config-validation-buttons.test.ts` (ampliación), `src/tests/config-validation/runtime-config-validation-forms-semantics.test.ts` (ampliación)
  - documentación: ninguna en esta tarea.
- **Cambios concretos**:
  - Verificar que `findInvalidActionTarget` no rechaza configs solo porque una entrada tenga campos adicionales (`when`). Si el walker tiene un filtro estricto, ampliarlo para tolerar `when`.
  - Confirmar que `validateExecutionRequestParamsInCollection` (líneas 1411–1420) sigue funcionando porque `when` es opcional y no rompe el bucle existente. Añadir un caso de test que tenga GET con `body` y `when` para confirmar que el rechazo de `body` ocurre antes y no se ve enmascarado.
- **Tests**:
  - **Ficheros de test**:
    - `src/tests/config-validation/runtime-config-validation-buttons.test.ts` (ampliación)
    - `src/tests/config-validation/runtime-config-validation-forms-semantics.test.ts` (ampliación)
  - **Comportamiento cubierto**:
    - `button.props.action.executeOperations` con `operations[i].when` válido y `operationName` inexistente: se valida en runtime (`operation-not-found`), no se rechaza en bootstrap (preservar el contrato actual descrito en `button.md`).
    - `form.submitAction.executeOperations` con `operations[i].when` válido y un `operationName` inexistente en `api`: el contrato actual para submitAction.executeOperations no contiene una validación cross-config previa (se delega a runtime); el test confirma esto sigue siendo así con `when` presente.
    - `form.submitAction.executeOperations` con GET y `body` y `when` válido: rechaza por `body`, no por `when`, con la ruta exacta del body.
  - **Comandos durante la implementación**:
    - `pnpm test --run src/tests/config-validation/runtime-config-validation-buttons.test.ts`
    - `pnpm test --run src/tests/config-validation/runtime-config-validation-forms-semantics.test.ts`
  - **Restricciones**: no introducir cross-checks nuevos que no pidiera la spec.
- **Documentación afectada**: ninguna en esta tarea.
- **Criterios de finalización**: tests verdes; el contrato cross-config previo sigue intacto.
- **Cierre de implementación**: walkers compatibles, `pnpm test` global cumple umbral.

---

## T5 — Validación de `submitAction.onSuccess`

- **ID**: T5
- **Estado**: completed
- **Objetivo**: Añadir validación contractual completa para `form.submitAction.onSuccess` en bootstrap: array de acciones declarativas, cada una con `when` opcional, y cross-check de existencia (`pageId`, `operationName`, `modalId`) contra el config.
- **Fuera de alcance**:
  - Ejecución runtime de `onSuccess` (vive en T6).
  - Validación de preloads (T3 ya cubierta).
- **Dependencias**: T3 (helper `validateWhenCondition`).
- **Impacto esperado en archivos**:
  - código: `src/config/validate-actions-visibility.ts` (extender `validateFormSubmitAction` para incluir `onSuccess`), `src/config/validate-form-nodes.ts` (extender cross-check con `pageIds`, `modalIds` y `operationNames` en el context), `src/config/runtime-config-zod.ts` (extender `formNodeSchema.submitAction` para ya no ser `unknown` o seguir igual + parsear `onSuccess` aparte; decisión: mantener `submitAction: z.unknown().optional()` y validar todo en `validateFormSubmitAction`).
  - tests: `src/tests/config-validation/runtime-config-validation-forms-semantics.test.ts` (ampliación).
  - documentación: ninguna en esta tarea.
- **Cambios concretos**:
  - Extender `validateFormSubmitAction` para aceptar la nueva forma `{ type, ..., onSuccess?: unknown[] }`. Tras validar el cuerpo principal (`executeOperation` o `executeOperations`), si `rawAction.onSuccess` existe:
    - exigir que sea array; en caso contrario, error con ruta `${path}.onSuccess`.
    - iterar cada entrada y delegar en `validateRuntimeUiAction(entry, "${path}.onSuccess[${index}]", pageId)` para validar el cuerpo de la acción.
    - tras validar el cuerpo, leer `entry.when` y delegar en `validateWhenCondition(entry.when, "${path}.onSuccess[${index}].when", pageId, { allowItem: true })`.
    - construir un array tipado `FormOnSuccessAction[]` y adjuntarlo al `action` devuelto. El tipo retorno de `validateFormSubmitAction` se amplía para incluir `onSuccess?: FormOnSuccessAction[]`.
  - Extender el `context` de `validateFormNodesInCollection` con `pageIds: ReadonlySet<string>` y `modalIds: ReadonlySet<string>` (recolectados desde `config.pages` y de los nodos `modal` con `id` declarado durante el walk). Cross-check por cada acción de `node.submitAction.onSuccess`:
    - `navigateTo.pageId` debe existir en `pageIds` (error con ruta `${nodePath}.submitAction.onSuccess[${i}].pageId`).
    - `executeOperation.operationName` debe existir en `operationNames`.
    - cada `executeOperations.operations[j].operationName`: NO se cross-checka (se mantiene el contrato actual de delegar a runtime, igual que en botones).
    - `openModal.modalId` y `closeModal.modalId` deben existir en `modalIds`.
    - `resetForm.formId`: igual que hoy en botones, no se cross-checka.
  - Validar GET con body en acciones de `onSuccess` extendiendo `validateExecutionRequestParamsInCollection` en `validate-form-nodes.ts` para que recorra también `node.submitAction.onSuccess` cuando exista, aplicando la misma comprobación que ya hace sobre `button.props.action` y `submitAction`. No se hace dentro de `validateFormSubmitAction`.
- **Tests**:
  - **Ficheros de test**:
    - `src/tests/config-validation/runtime-config-validation-forms-semantics.test.ts` (ampliación)
  - **Comportamiento cubierto**:
    - acepta `submitAction.onSuccess: []` (válido, no-op).
    - acepta `submitAction.onSuccess: [{ type: 'navigateTo', pageId: 'existing' }]`.
    - acepta `submitAction.onSuccess: [{ type: 'navigateTo', pageId: 'X', when: { reference: 'queries.op.data.status', operator: 'equals', value: 'ok' } }]`.
    - acepta `onSuccess` con `executeOperations` que tiene `operations[i].when`.
    - rechaza `onSuccess` no-array con ruta `submitAction.onSuccess`.
    - rechaza acción `onSuccess` con `pageId` inexistente y ruta exacta.
    - rechaza acción `onSuccess` con `operationName` inexistente (singular `executeOperation`) y ruta exacta.
    - rechaza acción `onSuccess` con `modalId` inexistente.
    - rechaza `onSuccess[i].when` con operador fuera de catálogo, ruta exacta.
    - rechaza `onSuccess[i]` con GET + body, ruta exacta.
    - confirma que `resetOnSuccess: true` + `onSuccess: [...]` se acepta junto.
    - confirma que `onSuccess` no puede aparecer fuera de `submitAction`: como `onSuccess` se anida dentro de `submitAction` por contrato del tipo (T1), un `form` sin `submitAction` que declare `onSuccess` a nivel raíz del nodo se rechaza por `.strip()` del `formNodeSchema` (la clave queda fuera del shape conocido y, si Zod la marcara, se reportaría como `unrecognized_keys` con ruta `form.onSuccess`). Test estructural: `form` con `onSuccess` en raíz y sin `submitAction` no acepta la clave (Zod la ignora silenciosamente al usar `.strip()`); no se considera error explícito. Documentar este comportamiento en el test como "key silenciosamente descartada" en lugar de error.
  - **Comandos durante la implementación**:
    - `pnpm test --run src/tests/config-validation/runtime-config-validation-forms-semantics.test.ts`
  - **Restricciones**: no introducir un nuevo dominio de tipos; reutilizar `FormOnSuccessAction` de T1. Mantener el contrato actual de `executeOperations` entries (sin cross-check de operationName).
- **Documentación afectada**: ninguna en esta tarea.
- **Criterios de finalización**: todas las nuevas reglas de validación cubiertas con tests verdes; rutas de error exactas.
- **Cierre de implementación**: validación de `onSuccess` completa, `pnpm test` global cumple umbral.

---

## T6 — Runtime: ejecución de `onSuccess` y filtrado de `when` en `executeOperations`

- **ID**: T6
- **Estado**: completed
- **Objetivo**: Implementar el comportamiento runtime de las tres ramas afectadas:
  1. Filtrar entradas de `executeOperations.operations[*]` por `when` en el executor compartido.
  2. Ejecutar `submitAction.onSuccess` tras un submit exitoso, evaluando `when` por acción.
  3. Mantener el contrato de `resetOnSuccess` (reset después de `onSuccess`).
- **Fuera de alcance**:
  - Filtrado de `when` en preloads (vive en T7 por separarlo del path de submit y del executor).
  - Documentación.
- **Dependencias**: T1, T2, T3, T5 (validación completa de los nuevos campos).
- **Impacto esperado en archivos**:
  - código:
    - `src/runtime/runtime-actions/runtime-ui-action-executor.ts` (modificar para filtrar entries por `when` reutilizando `matchesVisibilityRule`).
    - `src/runtime/nodes/form-layout-node.tsx` (modificar `handleSubmit` para ejecutar `onSuccess` tras éxito, antes de `resetOnSuccess`).
    - Posiblemente `src/runtime/runtime-state/runtime-state-provider.tsx` si los handlers del executor (resetForm, openModal, closeModal, navigateToPage, goBackPage) no están todos accesibles desde el form node; en ese caso, exponer un selector o hook que los devuelva como un único objeto `RuntimeUiActionHandlers`.
  - tests:
    - `src/tests/runtime/runtime-ui-actions.test.tsx` (ampliación) — cubre filtrado por `when` en `executeOperations`.
    - `src/tests/runtime-state/runtime-state-forms-queries.test.tsx` (ampliación) — cubre el ciclo de submit + onSuccess + resetOnSuccess.
  - documentación: ninguna en esta tarea.
- **Cambios concretos**:
  - En `runtime-ui-action-executor.ts`, modificar la firma de `executeRuntimeUiAction` para que `options` pase a ser `{ state: RuntimeState; iterationContext?: RuntimeIterationContext }` con `state` **requerido**. Eliminar el modo "sin state" — no hay compatibilidad opcional. En la rama `executeOperations`, antes del `for (const entry of action.operations)`, filtrar por `matchesVisibilityRule(entry.when, options.state, options.iterationContext)`.
  - Actualizar todos los callers existentes para pasar `state`:
    - `src/runtime/nodes/button-layout-node.tsx`: leer `state` con `useRuntimeState()` y pasarlo en la llamada.
    - Cualquier otro caller que aparezca al compilar (e.g. `link-layout-node.tsx`). El compilador delatará los puntos a actualizar.
  - Handlers consolidados: hoy `button-layout-node.tsx` construye `RuntimeUiActionHandlers` ad-hoc cerca de la llamada al executor. T6 NO introduce un hook genérico nuevo: el form-layout-node construye su propio objeto `RuntimeUiActionHandlers` reutilizando las funciones ya retornadas por `useRuntimeStateActions()` (`executeQueryOperation`, `resetForm`) más las funciones de navegación y modal (`navigateToPage`, `goBackPage`, `openModal`, `closeModal`) accesibles vía `useRuntimeStateActions()` (verificar nombres exactos al implementar; si alguna no está expuesta hoy, exponerla en el provider como parte de esta tarea siguiendo el patrón existente del botón). La meta es que `form-layout-node.tsx` reproduzca el mismo objeto que ya pasa `button-layout-node.tsx` al executor, sin abstraer un hook compartido en esta tarea.
  - En `form-layout-node.tsx`, tras la rama de `executeOperation`/`executeOperations`:
    - Para `executeOperations`: después de obtener `results` y antes del bloque `if (allSuccess && node.resetOnSuccess)`, si `allSuccess`, ejecutar `runOnSuccessActions(node.submitAction.onSuccess, ...)`.
    - Para `executeOperation`: tras `result.status === 'success'`, ejecutar `runOnSuccessActions(node.submitAction.onSuccess, ...)`.
    - El reset (`resetOnSuccess`) ocurre DESPUÉS de `runOnSuccessActions`.
  - `runOnSuccessActions` (interna al módulo): itera la lista en orden declarado. Para cada acción:
    1. Lee `readRuntimeState()` (snapshot fresco antes de cada acción, para que `queries.{operationName}.*` reflejen el éxito reciente y para que el efecto de una acción previa, como `executeOperation`, sea visible si llegase a actualizar el store antes de evaluar la siguiente).
    2. Evalúa `matchesVisibilityRule(action.when, snapshot, iterationContext)`.
    3. Si pasa, llama `executeRuntimeUiAction(action, handlers, { state: snapshot, iterationContext })`.
    4. NO espera la resolución de promesas dentro del executor (fire-and-forget; la spec excluye ejecución secuencial dependiente).
  - Si la rama `executeOperations` no lanza ninguna query (todas las entries filtradas por `when`), el `Promise.all` devuelve `[]` y `every(...)` sobre array vacío es `true`. Confirmar que esto produce `allSuccess === true` y activa `onSuccess` y `resetOnSuccess`, alineado con la spec ("se trata como éxito a efectos de resetOnSuccess y onSuccess").
- **Tests**:
  - **Ficheros de test**:
    - `src/tests/runtime/runtime-ui-actions.test.tsx` (ampliación)
    - `src/tests/runtime-state/runtime-state-forms-queries.test.tsx` (ampliación)
  - **Comportamiento cubierto**:
    - `executeOperations` con dos entries, una `when` cumplida y otra no: solo se lanza la primera; la segunda no entra en `loading`.
    - `executeOperations` con todas las entries filtradas: no se lanza ninguna query; en contexto botón no ocurre nada visible; en contexto submit, `onSuccess` y `resetOnSuccess` se disparan igual.
    - submit exitoso con `onSuccess: [{ type: 'navigateTo', pageId: 'X' }]`: navega.
    - submit exitoso con dos acciones `onSuccess`, una con `when` falso, otra con `when` true: solo se ejecuta la segunda.
    - submit exitoso con dos acciones `onSuccess` y ambas `when` cumplidas: ambas se ejecutan, y se verifica el orden declarado observando la secuencia de side-effects (mocks de `navigateToPage`/`executeQueryOperation` invocados en el orden esperado).
    - submit exitoso con `onSuccess: [{ type: 'navigateTo', pageId: 'X' }, { type: 'navigateTo', pageId: 'Y' }]`: ambas navegaciones se disparan en orden; el estado final del store refleja la última navegación (`Y` prevalece) — verificar tanto el orden de invocación como el `pageEntry.pageId` final.
    - submit fallido (operationName devuelve error): `onSuccess` no se ejecuta, `resetOnSuccess` no se dispara.
    - `executeOperations` plural con un fallo: ni `onSuccess` ni `resetOnSuccess` se disparan.
    - `resetOnSuccess: true` + `onSuccess: [{ type: 'navigateTo', pageId: 'X' }]`: la navegación ocurre antes del reset (verificable con orden de llamadas: el mock de `navigateToPage` se invoca antes que el de `resetForm`).
    - `onSuccess` con `executeOperation`: se observa que el ejecutor llama a `executeQueryOperation` para esa acción y NO se bloquea esperando su resolución antes de evaluar la siguiente acción. Verificar leyendo `queries.{operationName}.status === 'loading'` o el orden de eventos: la siguiente acción de la lista (mockeada como otro side-effect) se invoca antes de que el `executeQueryOperation` interno resuelva su promesa.
    - `onSuccess` evalúa `when` contra `queries.{operationName}.data.*` y ve el resultado success de la operación recién completada (acción singular `executeOperation` como `submitAction`).
  - **Comandos durante la implementación**:
    - `pnpm test --run src/tests/runtime/runtime-ui-actions.test.tsx`
    - `pnpm test --run src/tests/runtime-state/runtime-state-forms-queries.test.tsx`
  - **Restricciones**: reutilizar `matchesVisibilityRule` sin duplicar lógica. No introducir esperas (`await`) entre acciones de `onSuccess` salvo las ya implícitas en el executor; el flujo es fire-and-forget según la spec ("ejecución secuencial dependiente entre `onSuccess` actions" está fuera de alcance).
- **Documentación afectada**: ninguna en esta tarea.
- **Criterios de finalización**: comportamiento runtime alineado con los criterios de aceptación de la spec; tests verdes.
- **Cierre de implementación**: ejecución condicional viva, `pnpm test` global cumple umbral.

---

## T7 — Runtime: `when` en preloads

- **ID**: T7
- **Estado**: completed
- **Objetivo**: Implementar el filtrado de preloads por `when` en `planPagePreloadExecution` / `evaluatePreloadExecution`, omitiendo silenciosamente los preloads cuya condición no se cumple. El preload omitido no aparece en `preloadNames` ni contribuye al `pageEntry.status`.
- **Fuera de alcance**:
  - Cambios al executor de acciones (ya cubierto en T6).
  - Cambios a `submitAction.onSuccess`.
- **Dependencias**: T1, T3 (`when` validado), T6 idealmente cerrado para minimizar conflictos de import en el provider, aunque no estrictamente necesario.
- **Impacto esperado en archivos**:
  - código: `src/runtime/runtime-state/runtime-state-provider.tsx` (modificar `planPagePreloadExecution` y `evaluatePreloadExecution`).
  - tests: `src/tests/runtime/runtime-page-entry-preloads.test.tsx` (ampliación).
  - documentación: ninguna en esta tarea.
- **Cambios concretos**:
  - En `planPagePreloadExecution`, antes de mapear `preloadNames`, filtrar `page.preloads` por `matchesVisibilityRule(preload.when, snapshotState)` (usar el snapshot ya preparado para la entrada; sin `iterationContext`, ya que preloads no tienen contexto de item).
  - `preloadNames` se construye sobre los preloads que pasan `when`. Los omitidos no aparecen en `preloadNames` (criterio de spec: "Un preload omitido no aparece en `pageEntry.preloadNames`").
  - Si tras el filtrado `preloads.length === 0`, mantener el `aggregateStatus: 'idle'` actual.
  - Asegurar que la evaluación de `when` ocurre ANTES de derivar la firma de request (criterio de spec: "Los preloads con `when` se evalúan antes de derivar la firma de request").
- **Tests**:
  - **Ficheros de test**:
    - `src/tests/runtime/runtime-page-entry-preloads.test.tsx` (ampliación)
  - **Comportamiento cubierto**:
    - preload con `when: { reference: 'params.userId', operator: 'isTruthy' }` y sin `userId` en params: no se ejecuta, no aparece en `preloadNames`, `pageEntry.status` queda en `idle` si era el único preload.
    - preload con `when` que sí se cumple: se ejecuta normalmente.
    - dos preloads, uno con `when` falso y otro sin `when`: solo el segundo aparece en `preloadNames` y dispara `loading`.
    - dos preloads, uno con `when` falso y otro con `when` cumplido y status `loading`: `pageEntry.status === 'loading'` (refleja solo el segundo) y el primero no aparece en `preloadNames`. Verifica explícitamente que el preload omitido no contribuye al `pageEntry.status`.
    - todos los preloads con `when` falso: `pageEntry.status: 'idle'`, ninguna query entra en `loading`.
    - preload con `when` cumplido y firma idéntica a la entrada anterior: la firma se compara solo tras pasar `when`; el comportamiento de no relanzar por firma idéntica se preserva.
    - preload con `when: { reference: 'forms.f1.field1', operator: 'equals', value: 'x' }` evalúa contra el snapshot común.
  - **Comandos durante la implementación**:
    - `pnpm test --run src/tests/runtime/runtime-page-entry-preloads.test.tsx`
  - **Restricciones**: reutilizar `matchesVisibilityRule`; no duplicar lógica de comparación. Mantener el `snapshotState` que ya se construye en `planPagePreloadExecution` como entrada para la evaluación de `when`.
- **Documentación afectada**: ninguna en esta tarea (se actualizará manualmente con `update-app-documentation`).
- **Criterios de finalización**: comportamiento alineado con la spec; tests verdes.
- **Cierre de implementación**: filtrado de preloads activo, `pnpm test` global cumple umbral.

---

## Documentación afectada (resumen para `update-app-documentation`)

Estas fichas se verán afectadas tras cerrar la implementación; ninguna tarea actualiza documentación dentro de su propio cierre. Se listan aquí para alimentar la skill `update-app-documentation`:

- `ai-workflow/docs/app-features/forms/submit.md` — añadir `onSuccess` y su relación con `resetOnSuccess`.
- `ai-workflow/docs/app-features/queries/preloads.md` — añadir `when` en preloads y semántica de omisión.
- `ai-workflow/docs/app-features/nodes/form.md` — actualizar contrato de `submitAction.onSuccess`.
- `ai-workflow/docs/app-features/references/visibility.md` — nota de que el shape se reusa en `onSuccess`, preloads y entries de `executeOperations`, con la salvedad de que `when` admite `params.*` y `visibility` no.
- `ai-workflow/docs/app-features/nodes/button.md` — actualizar contrato de `executeOperations.operations[*].when`.

---

## Próxima tarea a ejecutar

T1.
