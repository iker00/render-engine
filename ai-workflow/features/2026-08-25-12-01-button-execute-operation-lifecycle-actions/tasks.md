# Tasks: button-execute-operation-lifecycle-actions

Contrato de ejecución para implementar `onSuccess`/`onError` en `button.props.action` (variantes `executeOperation`/`executeOperations`), reutilizando la semántica ya vigente de `form.submitAction.onSuccess/onError` según `design.md` (D1–D6).

Orden de ejecución: **T1 → T2 → T3 → T4 → T5 → T6**, estrictamente secuencial. Ninguna tarea debe empezar sin que sus dependencias declaradas estén cerradas.

Nota de contexto para quien implemente T2/T3: `design.md` describe la validación de referencias de destino (`operationName`/`pageId`/`modalId`) como si viviera en `validateActionTargets`/`findInvalidActionTarget` (`validate-actions-visibility.ts`). La lectura del código real muestra que esa función **no** valida `onSuccess`/`onError` de `submitAction` hoy: esa validación concreta vive en `validate-form-semantics.ts` (`validateOnSuccessActionTargets`/`validateOnErrorActionTargets`) y en `validate-form-request-params.ts` (chequeo GET+body). Las decisiones D1/D6 (compartir la validación, mismo criterio) siguen siendo correctas; T2/T3 de este documento apuntan a las funciones reales, no a las nombradas en `design.md`.

---

## T1 — Tipos y schema Zod compartidos para `onSuccess`/`onError` de `button.props.action`

### Objetivo
Añadir `onSuccess`/`onError` a las variantes `executeOperation`/`executeOperations` de `RuntimeUiAction` en el árbol de tipos y en el schema Zod, y renombrar los tipos/schemas de entrada de lista compartidos (hoy nombrados con el prefijo `Form`) a un nombre neutral, sin cambiar ningún comportamiento observable de `form.submitAction` ni de `button.props.action` todavía (esta tarea es puramente de tipos/schema; el resto de tareas conecta el comportamiento).

### Fuera de alcance
- Validación semántica (referencias `operationName`/`pageId`/`modalId`, GET+body) — T2/T3.
- Ejecución en runtime — T4/T5.
- Cualquier cambio en el editor de desarrollo — T6.

### Dependencias
Ninguna. Primera tarea de la feature.

### Interfaces
**Consume**: ninguno.

**Produce**:
- `RuntimeUiActionListEntry` (tipo, en `src/config/runtime-config-types.ts`): `RuntimeUiAction & { when?: RuntimeWhenCondition }` — reemplaza a `FormOnSuccessAction`/`FormOnErrorAction`, que se eliminan — consumido por: T2, T3, T4, T5.
- `ExecuteOperationRuntimeUiAction` (tipo ampliado, mismo nombre, en `src/config/runtime-config-types.ts`): gana `onSuccess?: RuntimeUiActionListEntry[]; onError?: RuntimeUiActionListEntry[]` — consumido por: T2, T3, T4, T5.
- `ExecuteOperationsRuntimeUiAction` (tipo ampliado, mismo nombre, en `src/config/runtime-config-types.ts`): gana los mismos dos campos opcionales — consumido por: T2, T3, T4, T5.
- `runtimeUiActionListEntrySchema` / `runtimeUiActionListSchema` (Zod, en `src/config/runtime-config-zod.ts`): reemplazan a `formLifecycleActionEntrySchema`/`formLifecycleActionsSchema`, mismo shape (discriminated union de los 7 tipos de acción + `when` opcional; array opcional de esa union) — consumido por: T2 (indirectamente, vía `buttonActionSchema`).
- `buttonActionSchema` (Zod, ampliado, mismo nombre, en `src/config/runtime-config-zod.ts`): sus miembros `executeOperation`/`executeOperations` pasan a incluir `onSuccess`/`onError` — consumido por: T2 (vía `buttonNodeSchema`).

### Impacto esperado en archivos
- `src/config/runtime-config-types.ts`: renombrar `FormOnSuccessAction`/`FormOnErrorAction` → `RuntimeUiActionListEntry` (tipo único, ambos campos usan el mismo tipo de entrada); actualizar `FormLayoutNode.onSuccess`/`onError` para usar el nuevo nombre; añadir `onSuccess?`/`onError?: RuntimeUiActionListEntry[]` a `ExecuteOperationRuntimeUiAction` y `ExecuteOperationsRuntimeUiAction`.
- `src/config/runtime-config-zod.ts`:
  - renombrar `formLifecycleActionEntrySchema` → `runtimeUiActionListEntrySchema` y `formLifecycleActionsSchema` → `runtimeUiActionListSchema` (mismo contenido).
  - crear `executeOperationWithLifecycleSchema = executeOperationRuntimeUiActionSchema.extend({ onSuccess: runtimeUiActionListSchema, onError: runtimeUiActionListSchema })` y `executeOperationsWithLifecycleSchema = executeOperationsRuntimeUiActionSchema.extend({ onSuccess: runtimeUiActionListSchema, onError: runtimeUiActionListSchema })`.
  - actualizar `formSubmitActionSchema` para usar `executeOperationWithLifecycleSchema`/`executeOperationsWithLifecycleSchema` en lugar de su `.extend()` inline (mismo resultado, sin duplicar la definición).
  - actualizar `buttonActionSchema`: sustituir sus miembros `executeOperationRuntimeUiActionSchema`/`executeOperationsRuntimeUiActionSchema` por `executeOperationWithLifecycleSchema`/`executeOperationsWithLifecycleSchema`; los otros 5 miembros (`navigateTo`, `goBack`, `resetForm`, `openModal`, `closeModal`) no cambian.
- `src/config/runtime-config.ts`: en el barrel, sustituir el re-export de `FormOnErrorAction, FormOnSuccessAction` por `RuntimeUiActionListEntry`.
- `src/config/validate-actions-visibility.ts`: actualizar imports de tipo (`FormOnSuccessAction`/`FormOnErrorAction` → `RuntimeUiActionListEntry`) sin tocar lógica todavía (la lógica se toca en T2).
- `src/config/validate-form-node.ts`: actualizar imports de tipo al nuevo nombre.
- `src/config/validate-form-semantics.ts`: actualizar imports de tipo al nuevo nombre (la lógica se toca en T3).
- `src/runtime/nodes/form-layout-node.tsx`: actualizar imports de tipo al nuevo nombre (la lógica se toca en T4).

### Tests
**Ficheros de test**: ninguno nuevo.

**Comportamiento cubierto**: esta tarea no introduce comportamiento observable nuevo; es un refactor de tipos/schema con riesgo de regresión sobre `form.submitAction.onSuccess/onError` ya existente (el riesgo que señala `design.md` en "Riesgos y trade-offs"). Se verifica por regresión, no por tests nuevos.

**Comandos durante la implementación**:
- `pnpm exec tsc --noEmit` (el árbol de tipos debe compilar sin errores tras el renombrado).
- `pnpm test --run src/tests/config-validation/runtime-config-validation-buttons.test.ts`
- `pnpm test --run src/tests/config-validation/runtime-config-validation-forms-semantics.test.ts`
- `pnpm test --run src/tests/layout-renderer/layout-renderer-forms-multi-operation.test.tsx`
- `pnpm test --run src/tests/layout-renderer/layout-renderer-forms.test.tsx`

**Restricciones**: no cambiar ningún mensaje de error ni comportamiento de aceptación/rechazo de `submitAction` en esta tarea; si alguno de los comandos anteriores falla tras el renombrado, es una regresión a corregir antes de cerrar T1, no un cambio de contrato a documentar.

### Documentación afectada
Ninguna (sin cambio de comportamiento observable todavía).

### Criterios de finalización
- `RuntimeUiActionListEntry` sustituye completamente a `FormOnSuccessAction`/`FormOnErrorAction` en todo `src/` (sin referencias residuales a los nombres antiguos).
- `ExecuteOperationRuntimeUiAction`/`ExecuteOperationsRuntimeUiAction` declaran `onSuccess`/`onError` opcionales.
- `buttonActionSchema` acepta (a nivel de shape Zod) `onSuccess`/`onError` en sus variantes `executeOperation`/`executeOperations`.
- `formSubmitActionSchema` reutiliza los mismos schemas ampliados que `buttonActionSchema` en lugar de duplicar la extensión.
- Todos los comandos de test listados arriba pasan sin cambios de expectativa.

### Cierre de implementación
Código y tests de regresión de esta tarea completos y validados.

---

## T2 — Validación de forma/`when` de `onSuccess`/`onError` en `validate-button-node.ts`

### Objetivo
Extraer de `validateFormSubmitAction` la validación de forma de `onSuccess`/`onError` (parseo de cada entrada vía `validateRuntimeUiAction`, validación de `when` vía `validateWhenCondition`) a una función reutilizable, y conectarla desde `validate-button-node.ts` para que `button.props.action.onSuccess/onError` queden validados en forma y adjuntos al `action` final del nodo, sin cambiar el comportamiento de `submitAction`.

### Fuera de alcance
- Validación de referencias de destino (`operationName`/`pageId`/`modalId`) y de GET+body para las entradas — T3.
- Ejecución en runtime — T4/T5.

### Dependencias
T1 (tipos y schema ampliados).

### Interfaces
**Consume**:
- `RuntimeUiActionListEntry` (de T1)
- `ExecuteOperationRuntimeUiAction` / `ExecuteOperationsRuntimeUiAction` con `onSuccess`/`onError` (de T1)

**Produce**:
- `validateRuntimeUiActionLifecycleBlocks(rawAction: Record<string, unknown>, path: string, pageId: string): { status: 'ready'; onSuccess?: RuntimeUiActionListEntry[]; onError?: RuntimeUiActionListEntry[] } | { status: 'error'; error: RuntimeConfigError }` (nueva función exportada en `src/config/validate-actions-visibility.ts`) — consumido por: T3 (no directamente, pero T3 opera sobre el nodo ya construido por esta tarea), y por `validateFormSubmitAction` (mismo fichero, uso interno).

### Impacto esperado en archivos
- `src/config/validate-actions-visibility.ts`:
  - extraer las dos secciones "Validate onSuccess if present" / "Validate onError if present" (líneas actuales ~232–305 de `validateFormSubmitAction`) a la nueva función exportada `validateRuntimeUiActionLifecycleBlocks`, con el mismo comportamiento línea por línea (mismo bucle, misma llamada a `validateRuntimeUiAction` por entrada, misma llamada a `validateWhenCondition` con `{ allowItem: true }`).
  - `validateFormSubmitAction` pasa a llamar a `validateRuntimeUiActionLifecycleBlocks(rawAction, path, pageId)` y a construir su valor de retorno igual que hoy (`{ status: 'ready', action, ...(onSuccess !== undefined ? { onSuccess } : {}), ...(onError !== undefined ? { onError } : {}) }`) — comportamiento externo sin cambios.
- `src/config/validate-button-node.ts`:
  - dentro del bloque `if (parseResult.data.props.action !== undefined)`, tras obtener `actionResult` de `validateRuntimeUiAction`, llamar a `validateRuntimeUiActionLifecycleBlocks(parseResult.data.props.action as Record<string, unknown>, \`${path}.props.action\`, pageId)`.
  - si devuelve `status: 'error'`, propagar con `enrichErrorResult(...)` igual que el resto de errores de esta función.
  - si devuelve `status: 'ready'`, construir `action` mezclando `actionResult.action` con `onSuccess`/`onError` cuando estén definidos (por ejemplo `{ ...actionResult.action, ...(lifecycleResult.onSuccess !== undefined ? { onSuccess: lifecycleResult.onSuccess } : {}), ...(lifecycleResult.onError !== undefined ? { onError: lifecycleResult.onError } : {}) }`); dado que `actionResult.action` es una unión discriminada, es válido y consistente con el resto del fichero (ver `validateExecuteOperationsAction`) castear el resultado con `as RuntimeUiAction` si el compilador lo exige.
  - la llamada a `validateRuntimeUiActionLifecycleBlocks` se hace incondicionalmente para cualquier tipo de acción del botón: para los 5 tipos que no declaran `onSuccess`/`onError` en su schema (`navigateTo`, `goBack`, `resetForm`, `openModal`, `closeModal`), `rawAction.onSuccess`/`.onError` ya vienen `undefined` (el propio `buttonActionSchema` no los declara en esas variantes), por lo que la función es un no-op para esos casos — no se necesita una comprobación de `type` explícita en `validate-button-node.ts`.

### Tests
**Ficheros de test**:
- `src/tests/config-validation/runtime-config-validation-buttons.test.ts` (ampliación)

**Comportamiento cubierto**:
- Un `button.props.action.type: executeOperation` con `onSuccess: [{ type: 'executeOperation', operationName: '<op existente>' }]` se acepta en bootstrap y el nodo resultante expone `props.action.onSuccess` con la entrada parseada.
- Un `button.props.action.type: executeOperation` con `onError` análogo se acepta igual.
- Una entrada de `onSuccess`/`onError` con `when: { reference: 'queries.<op>.status', operator: 'equals', value: 'success' }` se acepta.
- Una entrada de `onSuccess`/`onError` con `when.reference` inválido (por ejemplo `tokens.foo`) se rechaza en bootstrap.
- `onSuccess`/`onError` no siendo un array (por ejemplo un objeto) se rechaza en bootstrap.
- Un `button.props.action.type: executeOperations` con `onSuccess`/`onError` en el nivel de la acción (no de cada `operations[]`) se acepta y valida igual que en `executeOperation`.
- Un `button.props.action.type: navigateTo` con una clave `onSuccess` a mayores se acepta en bootstrap y esa clave no aparece en el nodo final (comportamiento heredado de `.strip()`, ya vigente para otras claves ajenas al shape).
- Regresión: un `button.props.action` sin `onSuccess`/`onError` se comporta exactamente igual que antes de esta tarea (mismo nodo resultante).

**Comandos durante la implementación**:
- `pnpm test --run src/tests/config-validation/runtime-config-validation-buttons.test.ts`
- `pnpm test --run src/tests/config-validation/runtime-config-validation-forms-semantics.test.ts` (regresión de `submitAction`)

**Restricciones**: no introducir aquí ninguna validación de `operationName`/`pageId`/`modalId` inexistente ni de GET+body — esas comprobaciones son de T3 y deben fallar en T2 si se prueban (dejarlas fuera de los casos de test de esta tarea).

### Documentación afectada
- `ai-workflow/docs/app-features/nodes/button.md` (nuevo contrato de `onSuccess`/`onError` en la sección "Contrato (props)" y en "Validación específica" una vez T3 también esté cerrada — no actualizar todavía, se revisa manualmente con `update-app-documentation` al final de la feature).

### Criterios de finalización
- `validateRuntimeUiActionLifecycleBlocks` existe, es usada por `validateFormSubmitAction` y por `validateButtonNode`, y el comportamiento de `submitAction` no cambia.
- `ButtonLayoutNode.props.action` expone `onSuccess`/`onError` cuando el config los declara, con forma y `when` ya validados.
- Todos los comandos de test listados pasan.

### Cierre de implementación
Código y tests de la tarea completos y validados.

---

## T3 — Validación de referencias de destino y de GET+body para `button.props.action.onSuccess/onError`

### Objetivo
Extender los dos validadores de config completo que hoy comprueban `form.onSuccess`/`form.onError` (referencias `operationName`/`pageId`/`modalId` inexistentes, y `GET` con `body`) para que también recorran `button.props.action.onSuccess`/`onError` en cualquier punto del árbol, reutilizando la misma lógica por entrada en lugar de duplicarla.

### Fuera de alcance
- Validación de forma/`when` (T2).
- Ejecución en runtime — T4/T5.

### Dependencias
T1, T2 (necesita que `ButtonLayoutNode.props.action.onSuccess/onError` ya estén poblados por el validador de nodo para poder recorrerlos).

### Interfaces
**Consume**:
- `RuntimeUiActionListEntry`, `ButtonLayoutNode.props.action.onSuccess/onError` (de T1/T2)

**Produce**:
- `validateActionListTargets(actions: RuntimeUiActionListEntry[], basePath: string, pageId: string, pageIds: ReadonlySet<string>, operationNames: ReadonlySet<string>, modalIds: ReadonlySet<string>): { status: 'error'; error: RuntimeConfigError } | null` (en `src/config/validate-form-semantics.ts`, exportada; reemplaza a `validateOnSuccessActionTargets`/`validateOnErrorActionTargets`, que se eliminan por ser idénticas salvo el nombre) — consumido por: uso interno del propio fichero (4 call sites: form.onSuccess, form.onError, button.onSuccess, button.onError).
- `validateActionListRequestParams(actions: RuntimeUiActionListEntry[], basePath: string, pageId: string, api: RuntimeApiConfig, nodePath: string, node: LayoutNode, nodeBreadcrumb: BreadcrumbSegment[]): { status: 'error'; error: RuntimeConfigError } | null` (en `src/config/validate-form-request-params.ts`, nueva, factoriza el bucle GET+body ya duplicado para `form.onSuccess`/`form.onError`; `node` es obligatorio porque el error se construye con `enrichedInvalidLayoutFromNode(message, nodeBreadcrumb, node)`, que exige el nodo completo, no solo su path/breadcrumb) — consumido por: uso interno del propio fichero (4 call sites).

### Impacto esperado en archivos
- `src/config/validate-form-semantics.ts`:
  - fusionar `validateOnSuccessActionTargets`/`validateOnErrorActionTargets` (cuerpos idénticos hoy) en `validateActionListTargets`, exportada.
  - actualizar los 2 call sites existentes (`node.onSuccess`/`node.onError` de `form`) para usar la función fusionada — mismo comportamiento.
  - en `validateFormNodesInCollection`, dentro de la rama donde ya se comprueba `node.type === 'button'`, añadir: si `node.props.action?.onSuccess` existe, llamar a `validateActionListTargets(node.props.action.onSuccess, \`${nodePath}.props.action.onSuccess\`, pageId, context.pageIds, context.operationNames, context.modalIds)`; análogo para `node.props.action?.onError`. No es necesario comprobar `action.type` antes: solo `executeOperation`/`executeOperations` pueden tener `onSuccess`/`onError` poblados (T1/T2).
- `src/config/validate-form-request-params.ts`:
  - factorizar el bucle GET+body ya duplicado en los bloques `node.type === 'form' && node.onSuccess` / `node.onError` (líneas ~70–120) en `validateActionListRequestParams`, incluyendo el parámetro `node` en su firma (ver `Interfaces` arriba) porque el error se construye con `enrichedInvalidLayoutFromNode(message, nodeBreadcrumb, node)`, que exige el nodo completo, no solo `nodePath`/`nodeBreadcrumb`.
  - actualizar los 2 call sites existentes (`form.onSuccess`/`form.onError`) para pasar `node` (la variable de nodo ya disponible en ese bucle) a la función factorizada.
  - añadir dos bloques análogos para `node.type === 'button' && node.props.action?.onSuccess` / `.onError`, pasando también `node`, con `actionPath` construido como `${nodePath}.props.action.onSuccess[i]` / `.onError[i]` (a diferencia del prefijo `.submitAction.onSuccess` que usa `form`, ya que en `button` el campo cuelga directamente de `props.action`, no de un `submitAction` separado — ver D5 de `design.md`).

### Tests
**Ficheros de test**:
- `src/tests/config-validation/runtime-config-validation-buttons.test.ts` (ampliación)
- `src/tests/config-validation/runtime-config-validation-forms-semantics.test.ts` (ampliación — solo regresión de la fusión de funciones, sin nuevos casos de negocio)

**Comportamiento cubierto**:
- `button.props.action.onSuccess` con una entrada `executeOperation` cuyo `operationName` no existe en `api` se rechaza en bootstrap con el mismo formato de mensaje que ya usa `submitAction.onSuccess` hoy.
- `button.props.action.onError` con una entrada `navigateTo` cuyo `pageId` no existe se rechaza en bootstrap.
- `button.props.action.onSuccess` con una entrada `openModal`/`closeModal` cuyo `modalId` no existe se rechaza en bootstrap.
- `button.props.action.onSuccess` con una entrada `executeOperation` cuyo `operationName` resuelve a una operación `GET` y declara `body` se rechaza con `GET operations do not support body.`.
- Caso feliz: `button.props.action.onSuccess`/`onError` referenciando `operationName`/`pageId`/`modalId` existentes se acepta en bootstrap (regresión positiva, complementa T2).
- Regresión: los mismos casos ya cubiertos para `submitAction.onSuccess/onError` (`operationName`/`pageId`/`modalId` inexistente, GET+body) siguen rechazándose igual tras la fusión de funciones.

**Comandos durante la implementación**:
- `pnpm test --run src/tests/config-validation/runtime-config-validation-buttons.test.ts`
- `pnpm test --run src/tests/config-validation/runtime-config-validation-forms-semantics.test.ts`

**Restricciones**: no validar en esta tarea las entradas anidadas de `executeOperations.operations[].operationName` dentro de una entrada de `onSuccess`/`onError` (ni para `button` ni para `form`) — hoy `validateOnSuccessActionTargets`/`validateOnErrorActionTargets` tampoco lo hacen para `submitAction`; mantener paridad exacta, no ampliar el criterio existente.

### Documentación afectada
- `ai-workflow/docs/app-features/nodes/button.md` — sección "Validación específica": nuevas reglas de rechazo por referencia inexistente y por GET+body en `onSuccess`/`onError`.

### Criterios de finalización
- `button.props.action.onSuccess/onError` quedan validados con el mismo criterio de referencias y de GET+body que `submitAction.onSuccess/onError`.
- Ningún caso existente de `submitAction` cambia de resultado (aceptado/rechazado) tras la fusión de funciones.
- Todos los comandos de test listados pasan.

### Cierre de implementación
Código y tests de la tarea completos y validados.

---

## T4 — Extraer la orquestación de `onSuccess`/`onError` a un módulo compartido de `runtime-actions/`

### Objetivo
Mover el bucle que hoy vive como `runOnSuccessActions`/`runOnErrorActions` dentro de `form-layout-node.tsx` (evaluación de `when` por entrada contra un snapshot fresco de estado, ejecución en orden vía `executeRuntimeUiAction`) a una función compartida en `src/runtime/runtime-actions/`, reutilizada por `FormNode` sin cambiar su comportamiento. Esta tarea NO conecta `ButtonNode` todavía (eso es T5); solo prepara el punto de extensión.

### Fuera de alcance
- Cualquier cambio en `button-layout-node.tsx` — T5.
- Cualquier cambio en la validación de config — ya cerrada en T2/T3.

### Dependencias
T1 (tipos `RuntimeUiActionListEntry` ya renombrados).

### Interfaces
**Consume**:
- `RuntimeUiActionListEntry` (de T1)
- `RuntimeUiActionHandlers`, `executeRuntimeUiAction(action, handlers, options)` (ya existentes en `src/runtime/runtime-actions/runtime-ui-action-executor.ts`, sin cambios)
- `matchesVisibilityRule(when, state, iterationContext)` (ya existente en `src/runtime/runtime-layout-visibility.ts`, sin cambios)

**Produce**:
- `runRuntimeUiActionLifecycleList(actions: RuntimeUiActionListEntry[] | undefined, handlers: RuntimeUiActionHandlers, readState: () => RuntimeState, iterationContext?: RuntimeIterationContext): void` (nueva, exportada desde `src/runtime/runtime-actions/runtime-ui-action-executor.ts`) — consumido por: T5 (además del uso interno de `FormNode` que esta misma tarea conecta).

### Impacto esperado en archivos
- `src/runtime/runtime-actions/runtime-ui-action-executor.ts`: añadir `runRuntimeUiActionLifecycleList`, extraída literalmente del cuerpo hoy duplicado de `runOnSuccessActions`/`runOnErrorActions` en `form-layout-node.tsx` (mismo bucle: por cada acción, `readState()` para snapshot fresco, `matchesVisibilityRule(action.when, snapshot, iterationContext)` para filtrar, strip de `when` antes de llamar a `executeRuntimeUiAction(baseAction, handlers, { state: snapshot, iterationContext })`).
- `src/runtime/nodes/form-layout-node.tsx`: eliminar las funciones locales `runOnSuccessActions`/`runOnErrorActions`; sustituir sus 2 llamadas (rama `executeOperation` y rama `executeOperations` de `handleSubmit`) por `runRuntimeUiActionLifecycleList(node.onSuccess, handlers, readRuntimeState, iterationContext)` / `runRuntimeUiActionLifecycleList(node.onError, handlers, readRuntimeState, iterationContext)`. `buildHandlers()` no cambia.

### Tests
**Ficheros de test**: ninguno nuevo.

**Comportamiento cubierto**: extracción pura sin comportamiento nuevo; se verifica por regresión de los tests ya existentes de `form.submitAction.onSuccess/onError`.

**Comandos durante la implementación**:
- `pnpm test --run src/tests/layout-renderer/layout-renderer-forms-multi-operation.test.tsx`
- `pnpm test --run src/tests/layout-renderer/layout-renderer-forms.test.tsx`
- `pnpm test --run src/tests/runtime/runtime-ui-actions.test.tsx`

**Restricciones**: no cambiar la firma de `executeRuntimeUiAction` ni de `RuntimeUiActionHandlers` en esta tarea.

### Documentación afectada
Ninguna (extracción interna, sin cambio de comportamiento observable).

### Criterios de finalización
- `runRuntimeUiActionLifecycleList` existe y es la única implementación de este bucle en el árbol `runtime`.
- `FormNode` la usa y su comportamiento no cambia.
- Todos los comandos de test listados pasan.

### Cierre de implementación
Código y tests de regresión de la tarea completos y validados.

---

## T5 — `ButtonNode` ejecuta su propia acción de forma directa y dispara `onSuccess`/`onError`

### Objetivo
Cuando `button.props.action.type` es `executeOperation`/`executeOperations` **y** declara `onSuccess` y/o `onError`, `ButtonNode` pasa a ejecutar esa acción de forma directa y asíncrona (llamando a `executeQueryOperation`/`Promise.all` igual que ya hace `FormNode.handleSubmit`), en vez de delegar en el `executeRuntimeUiAction` genérico (que sigue siendo fire-and-forget). Tras conocer el resultado, dispara `onSuccess`/`onError` vía `runRuntimeUiActionLifecycleList` (T4). Un botón sin `onSuccess`/`onError` mantiene exactamente el comportamiento actual (fire-and-forget vía `executeRuntimeUiAction`).

### Fuera de alcance
- Cualquier cambio en `link.props.action` (no tiene `onSuccess`/`onError`, fuera de alcance de la spec).
- Cualquier cambio en el editor de desarrollo — T6.

### Dependencias
T1, T4. (No depende estrictamente de T2/T3 para compilar, pero sus tests de integración necesitan configs con `button.props.action.onSuccess/onError` válidos, que solo pasan `validateRuntimeConfig` una vez T2/T3 están cerradas; ejecutar esta tarea después de T3 en el orden ya fijado.)

### Interfaces
**Consume**:
- `runRuntimeUiActionLifecycleList(actions, handlers, readState, iterationContext)` (de T4)
- `ExecuteOperationRuntimeUiAction`/`ExecuteOperationsRuntimeUiAction` con `onSuccess`/`onError` (de T1)
- `executeQueryOperation(operationName, options?): Promise<{status: 'success'|'error'|'skipped'; ...}>` (ya existente en `useRuntimeStateActions()`, sin cambios)

**Produce**: ninguno (consumidor final de la cadena; nada más depende de `ButtonNode` dentro de esta feature).

### Impacto esperado en archivos
- `src/runtime/nodes/button-layout-node.tsx`:
  - añadir `readRuntimeState` a la desestructuración de `useRuntimeStateActions()`.
  - nueva función interna async, por ejemplo `handleActionWithLifecycle(action: ExecuteOperationRuntimeUiAction | ExecuteOperationsRuntimeUiAction)`, que replica el patrón ya usado en `FormNode.handleSubmit` para sus dos ramas (`executeOperations`: `Promise.all` sobre las entradas filtradas por `when` vía `matchesVisibilityRule`, `allSuccess`/`anyError` sobre los resultados; `executeOperation`: un único `await executeQueryOperation(...)`), y que al final llama a `runRuntimeUiActionLifecycleList(action.onSuccess, handlers, readRuntimeState, iterationContext)` en éxito o `runRuntimeUiActionLifecycleList(action.onError, handlers, readRuntimeState, iterationContext)` en error.
  - el `onClick` del `<button>` pasa a: si `action` existe y `(action.type === 'executeOperation' || action.type === 'executeOperations') && (action.onSuccess !== undefined || action.onError !== undefined)`, invocar `() => void handleActionWithLifecycle(action)`; en cualquier otro caso (incluida la ausencia de `onSuccess`/`onError`), mantener exactamente la llamada actual a `executeRuntimeUiAction(action, handlers, { iterationContext })`.
  - `item.*` en `query`/`body`/`headers` de las entradas de `onSuccess`/`onError` dentro de un `repeater` se resuelve automáticamente porque `iterationContext` ya se pasa a `executeQueryOperation` exactamente igual que para la acción propia del botón hoy — no se añade lógica de resolución nueva.

### Tests
**Ficheros de test**:
- `src/tests/runtime/runtime-button-lifecycle-actions.test.tsx` (nuevo)

**Comportamiento cubierto**:
- Un botón con `action.type: executeOperation` y `onSuccess: [{ type: executeOperation, operationName: '<op2>' }]` dispara `<op2>` automáticamente tras el éxito de su propia operación.
- Un botón con `action.type: executeOperation` y `onError` con una acción `openModal` abre el modal cuando la operación del botón termina en error, y no la ejecuta si la operación tiene éxito.
- Un botón con `action.type: executeOperations` y `onSuccess` solo ejecuta las acciones encadenadas cuando **todas** las operaciones de la lista terminan en éxito; si una falla, se evalúa `onError` (si existe) y `onSuccess` no se ejecuta.
- Una entrada de `onSuccess`/`onError` con `when` que no se cumple se omite en silencio; el resto de entradas de la lista se sigue evaluando.
- Un botón cuya operación termina en error de negocio (`business-error-condition` vía `errorCondition`) dispara `onError`.
- Un botón con `executeOperations` donde todas las entradas se omiten por `when` (tratado como éxito) dispara `onSuccess` si existe.
- Un botón sin `onSuccess`/`onError` mantiene el comportamiento fire-and-forget actual (regresión: el click no bloquea ni cambia de comportamiento visible aunque la operación falle).
- Un botón dentro de `repeater.props.template` con `onSuccess` que referencia `item.*` en `body`/`query` de la acción encadenada resuelve contra el item de la iteración que disparó el botón.
- Un botón auxiliar (`action` explícita) dentro de un `form` usa `onSuccess`/`onError` sobre su propia operación de forma independiente al `submitAction` del formulario que lo contiene (ambos ciclos de vida no se interfieren).

**Comandos durante la implementación**:
- `pnpm test --run src/tests/runtime/runtime-button-lifecycle-actions.test.tsx`
- `pnpm test --run src/tests/runtime/runtime-ui-actions.test.tsx` (regresión del click fire-and-forget sin `onSuccess`/`onError`)
- `pnpm test --run src/tests/runtime/runtime-button-navigation.test.tsx` (regresión)

**Restricciones**: seguir el mismo patrón de fixtures que `layout-renderer-forms-multi-operation.test.tsx` (montaje vía `RuntimeStateProvider` + `RuntimePage`, lectura de estado vía `readRuntimeStateSnapshot`) en vez de mockear `useRuntimeStateActions` como hace `runtime-ui-actions.test.tsx`, para poder observar el efecto real sobre `queries.*` tras `onSuccess`/`onError`.

### Documentación afectada
- `ai-workflow/docs/app-features/nodes/button.md` (nueva sección de comportamiento `onSuccess`/`onError`, análoga a la de `forms/submit.md`).
- `ai-workflow/docs/app-features/queries/execution.md` (la sección "Refetch y mutadoras (estado actual)" deja de listar el refetch declarativo desde botón como pendiente).
- `ai-workflow/docs/app-features/forms/submit.md` (nota de referencia cruzada, sin cambio de comportamiento).
- `ai-workflow/docs/current-state.md` si el resumen de "Catálogo de nodos" o "Queries, preloads y feedback" menciona el estado pendiente de esta capacidad.

### Criterios de finalización
- Los 9 comportamientos listados arriba están cubiertos por test y pasan.
- Un botón sin `onSuccess`/`onError` no cambia de comportamiento (regresión verde).
- Todos los comandos de test listados pasan.

### Cierre de implementación
Código y tests de la tarea completos y validados.

---

## T6 — Cobertura de test: el panel de propiedades del editor de desarrollo ya expone `onSuccess`/`onError` en `button.props.action`

### Objetivo
Confirmar con tests que el panel de propiedades del editor de desarrollo (`DiscriminatedUnionPropertyField` + `PropertyFieldDispatcher`, ya usados hoy para `form.submitAction.onSuccess/onError` por ser 100% derivados del JSON Schema del nodo) exponen y permiten editar `onSuccess`/`onError` para `button.props.action` en sus variantes `executeOperation`/`executeOperations` sin necesidad de código nuevo en `src/dev-runtime/`, ya que el mecanismo (`discriminated-union-property-field.tsx`) no tiene ninguna lista de campos hardcodeada por tipo de nodo: renderiza cualquier propiedad del sub-schema de la variante activa, incluida `onSuccess`/`onError` una vez T1 las añade al schema Zod de `button.props.action`.

### Fuera de alcance
- Cualquier cambio de producción en `src/dev-runtime/` — si algún test de esta tarea falla, no improvisar una solución fuera de este contrato: ver "Restricciones".

### Dependencias
T1, T2, T3 (los tests de esta tarea necesitan que un config con `button.props.action.onSuccess/onError` válido pase `validateRuntimeConfig`, ya que el pipeline de commit del canvas usa ese mismo validador).

### Interfaces
**Consume**: `buttonActionSchema` ampliado (de T1), `validateButtonNode`/validación de destino (de T2/T3) — indirectamente, vía `validateRuntimeConfig`.

**Produce**: ninguno.

### Impacto esperado en archivos
- `src/tests/dev-runtime/layout-canvas-properties-panel.test.tsx` (ampliación): nuevos casos de test, sin cambios de producción esperados en `src/dev-runtime/`.

### Tests
**Ficheros de test**:
- `src/tests/dev-runtime/layout-canvas-properties-panel.test.tsx` (ampliación)

**Comportamiento cubierto**:
- Al seleccionar un `button` con `props.action.type: executeOperation`, la pestaña `Props` muestra los campos `onSuccess`/`onError` (arrays) debajo de los campos propios de la variante, igual que ya ocurre para `form.submitAction`.
- Añadir una entrada a `onSuccess` desde el panel (selector de variante de la entrada ofreciendo las 7 variantes) commitea correctamente y el `button.props.action.onSuccess` resultante refleja la entrada añadida.
- Cambiar la variante activa de `button.props.action` de `executeOperation` a `navigateTo` reconstruye el valor desde cero (sin `onSuccess`/`onError` residual), igual que ya ocurre para cualquier otro campo de la variante anterior.

**Comandos durante la implementación**:
- `pnpm test --run src/tests/dev-runtime/layout-canvas-properties-panel.test.tsx`

**Restricciones**: si alguno de los tres casos anteriores falla, el hallazgo es un gap real de arquitectura no anticipado por `design.md` (el mecanismo genérico no cubre este caso tan bien como predice esta tarea) — no parchear el dispatcher genérico ni añadir un widget dedicado dentro de esta tarea; dejar el test fallando documentado y devolver el control a planificación (posible actualización de `design.md`) en vez of improvisar alcance nuevo.

### Documentación afectada
Ninguna (comportamiento del editor ya documentado genéricamente en `ai-workflow/docs/app-features/development/dev-mode-editor.md`, sección "Selector de variante para uniones discriminadas por type (acciones)"; si T6 revela que hace falta código nuevo, la ficha se actualizaría en esa pasada futura, no aquí).

### Criterios de finalización
- Los 3 casos de test están escritos y en verde sin cambios de producción en `src/dev-runtime/`.

### Cierre de implementación
Tests de la tarea completos y en verde.

---

## Siguiente tarea
**T1** es la primera tarea a implementar.
