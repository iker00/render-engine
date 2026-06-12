# Tareas de implementación — Feature 0075

> Contrato de ejecución secuencial. Ejecutar tareas en orden. No reabrir alcance ni rediseñar durante la implementación.

## Resumen del alcance técnico

La feature `0075` añade `submitAction.onError` al nodo `form` con semántica simétrica a `submitAction.onSuccess` (introducido en `0073`). El shape, la validación contractual y la ejecución runtime reutilizan toda la infraestructura ya existente para `onSuccess`. Las únicas piezas nuevas son:

1. Un alias de tipo `FormOnErrorAction` para `FormLayoutNode.onError` (idéntico estructuralmente a `FormOnSuccessAction`, pero con intent semántico distinto).
2. Ampliación de `validateFormSubmitAction` para reconocer y validar `rawAction.onError` reutilizando exactamente la misma lógica que ya aplica a `onSuccess` (forma de array, `validateRuntimeUiAction`, `validateWhenCondition`).
3. Cross-validation de targets (`pageId`, `operationName`, `modalId`) y check de `GET + body` para acciones de `onError`, simétricos a los ya implementados para `onSuccess`.
4. Disparo runtime desde `FormNode.handleSubmit`:
   - `executeOperation`: cuando `result.status === 'error'` (cubre tanto error HTTP como error de negocio vía `errorCondition`, gracias a la feature `0060`).
   - `executeOperations`: cuando al menos una operación de la lista termina con `status: 'error'`.
   - **Nunca** cuando el submit falla por validación local de campos.
5. Tests de aceptación y rechazo en bootstrap, y tests runtime que cubren los criterios de aceptación de la spec.

No se introduce ningún nuevo helper compartido entre `onSuccess` y `onError`; reutilizamos los existentes y duplicamos las dos o tres líneas de glue cuando aplica, manteniendo la simetría literal con `0073` para minimizar varianza de ejecución entre agentes.

No se modifica el schema Zod (`formNodeSchema.submitAction` sigue siendo `z.unknown().optional()`); toda la validación contractual de `onError` vive en `validateFormSubmitAction` y `validate-form-nodes.ts`.

No se introduce `resetOnError`: queda explícitamente fuera de alcance por spec (sección "Fuera de alcance"). `resetOnSuccess` mantiene su comportamiento intacto.

---

## T1 — Tipo `FormOnErrorAction` y extensión de `FormLayoutNode`

- **ID**: T1
- **Estado**: done
- **Objetivo**: Añadir el alias de tipo `FormOnErrorAction` en `src/config/runtime-config-types.ts` y extender `FormLayoutNode` con `onError?: FormOnErrorAction[]`. Pre-condición de tipos para las tareas siguientes; no toca runtime ni validación.
- **Fuera de alcance**:
  - Cambios en `submitAction.type`, ni en la unión `RuntimeUiAction`.
  - Cualquier alias compartido entre `FormOnSuccessAction` y `FormOnErrorAction`. Se mantienen aliases separados con intent semántico distinto.
  - Cambios en `ButtonAction` o en cualquier acción de botón.
- **Dependencias**: ninguna.
- **Impacto esperado en archivos**:
  - código: `src/config/runtime-config-types.ts` (modificar).
  - tests: ninguno propio (los tests de tipos se cubren indirectamente vía T2 y T3, que ya ejercitarán los tipos en compile-time TypeScript).
  - documentación: ninguna en esta tarea.
- **Cambios concretos**:
  - Añadir `export type FormOnErrorAction = RuntimeUiAction & { when?: RuntimeWhenCondition }` inmediatamente después de la declaración existente de `FormOnSuccessAction` (línea ~562 de `runtime-config-types.ts`). Mantener ambos aliases aunque sean estructuralmente idénticos: la intención semántica (post-éxito vs post-error) justifica nombres separados para los consumidores.
  - Añadir el campo `onError?: FormOnErrorAction[]` a la interfaz `FormLayoutNode` (línea ~247), inmediatamente después del campo existente `onSuccess?: FormOnSuccessAction[]`.
- **Tests**:
  - **Ficheros de test**: ninguno propio.
  - **Comportamiento cubierto**: cubierto por T2 (validación bootstrap) y T3 (runtime), que ejercitan los tipos a través de TypeScript en compile-time. No hay comportamiento observable en esta tarea.
  - **Comandos durante la implementación**: `pnpm test --run src/tests/config-validation/runtime-config-validation-forms-semantics.test.ts` para confirmar que la suite sigue verde tras el cambio de tipos.
  - **Restricciones**: no introducir cambios runtime ni de validación; solo declaraciones de tipos. No tocar `FormOnSuccessAction`. No declarar un alias compartido genérico tipo `FormSubmitOutcomeAction`.
- **Documentación afectada**: `ai-workflow/docs/app-features/nodes/form.md` y `ai-workflow/docs/app-features/forms/submit.md` se verán afectadas tras T3 (no se actualizan en esta tarea).
- **Criterios de finalización**: el proyecto compila (`tsc`/build de Vite) y `pnpm test` global sigue en verde.
- **Cierre de implementación**: tipos extendidos, `pnpm test` global sigue cumpliendo umbral del 80%.

---

## T2 — Validación bootstrap de `submitAction.onError`

- **ID**: T2
- **Estado**: done
- **Objetivo**: Extender `validateFormSubmitAction` (en `src/config/validate-actions-visibility.ts`) para validar el array `rawAction.onError` con la misma lógica que ya aplica a `rawAction.onSuccess`. Propagar el resultado a `validateFormNode` y a las pasadas cross-check (`validateFormNodesInCollection` y `validateExecutionRequestParamsInCollection`) en `src/config/validate-form-nodes.ts`.
- **Fuera de alcance**:
  - Lógica runtime de ejecución (T3).
  - Cambios al schema Zod (`formNodeSchema` sigue tratando `submitAction` como `z.unknown().optional()`).
  - Introducir un helper compartido `validateOnOutcomeActionTargets` entre `onSuccess` y `onError`. Mantener dos funciones separadas (o, si se decide refactor, hacerlo en una tarea propia fuera de este plan).
- **Dependencias**: T1.
- **Impacto esperado en archivos**:
  - código:
    - `src/config/validate-actions-visibility.ts` (modificar `validateFormSubmitAction` para devolver también `onError`).
    - `src/config/validate-form-nodes.ts` (modificar `validateFormNode` para extraer `onError` del resultado y adjuntarlo al nodo; añadir un walker cross-check de targets análogo a `validateOnSuccessActionTargets`; ampliar `validateExecutionRequestParamsInCollection` para recorrer también `node.onError`).
  - tests: `src/tests/config-validation/runtime-config-validation-forms-semantics.test.ts` (ampliación).
  - documentación: ninguna en esta tarea.
- **Cambios concretos**:
  - En `validate-actions-visibility.ts`:
    - Ampliar el tipo de retorno de `validateFormSubmitAction` a `{ status: 'ready'; action: ...; onSuccess?: FormOnSuccessAction[]; onError?: FormOnErrorAction[] } | { status: 'error'; error: RuntimeConfigError }`.
    - Importar `FormOnErrorAction` desde `runtime-config-types`.
    - Tras el bloque actual que valida `rawAction.onSuccess`, replicar el mismo bloque para `rawAction.onError`:
      - Si `rawAction.onError === undefined`: no aportar la clave `onError` al retorno.
      - Si `rawAction.onError` no es array: devolver `invalidLayout(\`Page "${pageId}" has an invalid layout at "${path}.onError".\`)`.
      - Si es array (incluido vacío): iterar `rawAction.onError`, para cada entrada llamar a `validateRuntimeUiAction(rawEntry, \`${path}.onError[${index}]\`, pageId)` y luego, si `rawEntry.when !== undefined`, a `validateWhenCondition(rawWhen, \`${path}.onError[${index}].when\`, pageId, { allowItem: true })`. Construir `onError: FormOnErrorAction[]` y devolverlo en el resultado junto con `action` (y, si aplica, `onSuccess` ya validado).
    - Mantener la simetría 1:1 con el bloque ya existente para `onSuccess`. Un array vacío (`onError: []`) es válido y produce `onError: []` en el retorno (no se omite); esto es coherente con el comportamiento observable de `onSuccess: []` en T5 de 0073.
  - En `validate-form-nodes.ts`:
    - En `validateFormNode`, declarar `let onError: FormOnErrorAction[] | undefined` y asignarlo desde `submitActionResult.onError`. Adjuntarlo al nodo retornado: `onError`.
    - En `validateFormNodesInCollection`, dentro de la rama `if (node.type === 'form')` y después del bloque existente `if (node.onSuccess)`, añadir un bloque análogo `if (node.onError) { ... }` que delegue en una función nueva `validateOnErrorActionTargets(node.onError, \`${nodePath}.submitAction.onError\`, pageId, context.pageIds, context.operationNames, context.modalIds)`.
    - Implementar `validateOnErrorActionTargets` como copia literal de `validateOnSuccessActionTargets` (mismo cuerpo, mismos mensajes con la única diferencia textual de "onError" en lugar de "onSuccess" implícita en el `basePath`). El cross-check cubre:
      - `navigateTo.pageId` debe existir en `pageIds`.
      - `executeOperation.operationName` debe existir en `operationNames`.
      - `openModal.modalId` debe existir en `modalIds`.
      - `closeModal.modalId` debe existir en `modalIds`.
      - `executeOperations.operations[j].operationName`: NO se cross-checka (igual que en `onSuccess` y en botones; se delega a runtime).
      - `resetForm.formId`: NO se cross-checka (igual que en `onSuccess`).
    - En `validateExecutionRequestParamsInCollection`, añadir un bloque análogo al ya existente `if (node.type === 'form' && node.onSuccess)` para `node.onError`. Replicar el mismo recorrido sobre `executeOperation` y `executeOperations.operations[i]` rechazando `GET + body` con la ruta exacta `${nodePath}.submitAction.onError[${i}](.operations[${j}])?.body`.
- **Tests**:
  - **Ficheros de test**:
    - `src/tests/config-validation/runtime-config-validation-forms-semantics.test.ts` (ampliación).
  - **Comportamiento cubierto** (simétrico a los casos de `onSuccess` ya existentes en este fichero a partir del comentario `// T5: submitAction.onSuccess validation`):
    - acepta `submitAction.onError: []` (array vacío, no-op).
    - acepta `submitAction.onError: [{ type: 'navigateTo', pageId: 'existing' }]`.
    - acepta `submitAction.onError: [{ type: 'navigateTo', pageId: 'X', when: { reference: 'queries.op.error.message', operator: 'equals', value: 'forbidden' } }]`.
    - acepta `submitAction.onError` con `executeOperations` que tiene `operations[i].when`.
    - rechaza `submitAction.onError` no-array con ruta `submitAction.onError`.
    - rechaza acción `onError` con `pageId` inexistente y ruta exacta `submitAction.onError[0].pageId`.
    - rechaza acción `onError` con `operationName` inexistente (singular `executeOperation`) y ruta exacta `submitAction.onError[0].operationName`.
    - rechaza acción `onError` con `modalId` inexistente (tanto `openModal` como `closeModal`).
    - rechaza `onError[i].when` con operador fuera de catálogo, ruta exacta `submitAction.onError[i].when.operator`.
    - rechaza `onError[i]` con `executeOperation` GET + body con ruta exacta.
    - rechaza `onError[i]` con `executeOperations.operations[j]` GET + body con ruta exacta.
    - confirma que `onSuccess` y `onError` declarados conjuntamente en el mismo `submitAction` se aceptan y ambos se preservan en el nodo validado (no se solapan ni se pisan).
    - confirma que `resetOnSuccess: true` coexiste con `onError: [...]` sin romper la regla actual `resetOnSuccess requires submitAction`.
    - confirma que `submitAction.onError` con `params.userId` como `reference` de `when` se acepta (la spec exige aceptar `params.*` en `when`; este caso es regresión simétrica de T3 de 0073, ya que `validateWhenCondition` con `{ allowItem: true }` ya lo permite, pero la cobertura por `onError` confirma que el helper se aplica correctamente).
    - confirma que `form` con `onError` declarado a nivel raíz del nodo (fuera de `submitAction`) no aparece en el resultado: la clave se descarta silenciosamente por el `.strip()` del `formNodeSchema`, idéntico al comportamiento de `onSuccess` en raíz documentado en T5 de 0073.
  - **Comandos durante la implementación**:
    - `pnpm test --run src/tests/config-validation/runtime-config-validation-forms-semantics.test.ts`
  - **Restricciones**:
    - No introducir un mecanismo nuevo de validación de `when` ni de cross-check distinto al que ya usa `onSuccess`. Mantener simetría literal con T3 y T5 de la feature `0073`.
    - No factorizar `validateOnSuccessActionTargets` y `validateOnErrorActionTargets` en un helper compartido en esta tarea.
    - Cubrir TODOS los casos de error con verificación de la ruta exacta en `result.error.message` (no basta con comprobar que `status === 'error'`).
- **Documentación afectada**: `ai-workflow/docs/app-features/nodes/form.md` y `ai-workflow/docs/app-features/forms/submit.md` se actualizarán manualmente tras T3 (la skill `update-app-documentation` recogerá esta tarea).
- **Criterios de finalización**: todas las reglas de validación contractual de `onError` cubiertas con tests verdes y rutas de error exactas; los tests existentes de `onSuccess` siguen pasando sin cambios.
- **Cierre de implementación**: validación bootstrap completa, `pnpm test` global cumple umbral del 80%.

---

## T3 — Ejecución runtime de `submitAction.onError`

- **ID**: T3
- **Estado**: done
- **Objetivo**: Implementar el comportamiento runtime de `submitAction.onError` en `src/runtime/nodes/form-layout-node.tsx`. Disparar las acciones de `onError` cuando el submit termina en error (HTTP o de negocio vía `errorCondition`), evaluando `when` por acción contra el snapshot fresco, sin tocar el camino de éxito ni el camino de validación local.
- **Fuera de alcance**:
  - Cambios en el executor compartido (`runtime-ui-action-executor.ts`): la firma y el comportamiento del executor no cambian.
  - Refactor del helper `runOnSuccessActions` ni introducción de un helper genérico `runOutcomeActions`. Se mantienen dos funciones separadas (`runOnSuccessActions` ya existente, `runOnErrorActions` nueva) por intent semántico.
  - Cambios en `resetOnSuccess` u otros campos del nodo `form`.
  - Filtrado de `when` en preloads u otros caminos no relacionados con el submit.
- **Dependencias**: T1, T2.
- **Impacto esperado en archivos**:
  - código: `src/runtime/nodes/form-layout-node.tsx` (modificar).
  - tests: `src/tests/runtime-state/runtime-state-forms-queries.test.tsx` (ampliación).
  - documentación: ninguna en esta tarea.
- **Cambios concretos**:
  - Importar `FormOnErrorAction` desde `../../config/runtime-config`.
  - Añadir una función interna `runOnErrorActions(actions: FormOnErrorAction[] | undefined)` análoga a la existente `runOnSuccessActions`. Comportamiento idéntico al de `runOnSuccessActions`:
    1. Si `actions` es `undefined` o vacío, no hacer nada.
    2. Construir handlers con el helper ya existente `buildHandlers()`.
    3. Para cada acción en orden declarado:
       - Leer `readRuntimeState()` (snapshot fresco antes de cada acción).
       - Evaluar `matchesVisibilityRule(action.when, snapshot, iterationContext)`. Si no pasa, continuar al siguiente.
       - Hacer destructuring `{ when, ...baseAction }` y llamar `executeRuntimeUiAction(baseAction, handlers, { state: snapshot, iterationContext })`.
    4. NO esperar la resolución de promesas (fire-and-forget; mismo contrato que `runOnSuccessActions`).
  - En `handleSubmit`:
    - Rama `executeOperations` (plural): tras el `Promise.all`, dejar el bloque existente `if (allSuccess)` intacto y añadir, simétricamente, un `else if (results.length > 0)` que llame a `runOnErrorActions(node.onError)`. La condición `results.length > 0` evita disparar `onError` cuando TODAS las entries quedaron filtradas por su `when` (en ese caso `allSuccess === true` ya por el contrato de array vacío, alineado con la spec de `0073`).
      - Equivalente más explícito (preferido por claridad): `const anyError = results.some((r) => r.status === 'error'); if (allSuccess) { runOnSuccessActions(node.onSuccess); if (node.resetOnSuccess) resetForm(node.id) } else if (anyError) { runOnErrorActions(node.onError) }`.
    - Rama `executeOperation` (singular): tras el `await executeQueryOperation`, dejar el bloque existente `if (result.status === 'success')` y añadir `else if (result.status === 'error') { runOnErrorActions(node.onError) }`. Cubre tanto error HTTP como error de negocio (`errorCondition` ya mapea ambos a `status: 'error'`).
  - Mantener el guard previo `if (!validationResult.isValid || !node.submitAction) return` intacto: garantiza que un fallo de validación local NO dispara `onError` (RF7 y RF9 de la spec).
  - No alterar el orden actual de operaciones del path de éxito: `runOnSuccessActions` sigue ejecutándose ANTES de `resetOnSuccess`.
  - `onError` NO se ve afectado por `resetOnSuccess`: si `onError` se dispara, NO se resetea el formulario (la spec excluye `resetOnError`).
- **Tests**:
  - **Ficheros de test**:
    - `src/tests/runtime-state/runtime-state-forms-queries.test.tsx` (ampliación).
  - **Comportamiento cubierto** (añadir un nuevo `describe('Form submitAction.onError', ...)` siguiendo el patrón del `describe('Form submitAction.onSuccess', ...)` ya existente):
    - submit fallido con `submitAction.type: 'executeOperation'` y error HTTP: `onError: [{ type: 'navigateTo', pageId: 'X' }]` ejecuta la navegación a `X`. Verificar que el mock de `navigateToPage` se invoca con `'X'`.
    - submit fallido con `submitAction.type: 'executeOperation'` y error de negocio (`errorCondition` cumplido sobre payload 2xx): `onError` se ejecuta igualmente. Verificar usando una operación `api` declarativa con `errorCondition` y mockeando la respuesta para que cumpla la condición.
    - submit exitoso con `executeOperation`: `onError` NO se ejecuta; `onSuccess` (si existe) sí. Verificar que el mock asociado a la acción de `onError` no se invoca.
    - submit fallido por validación local de campos (e.g. campo `required` sin valor): NI `onSuccess` NI `onError` se ejecutan. Verificar leyendo el estado `forms.{formId}.{fieldId}.error` y comprobando que ninguno de los side-effects de `onError` se dispara.
    - submit con `submitAction.type: 'executeOperations'` plural donde **una** entry falla y **otra** tiene éxito: `onError` se ejecuta, `onSuccess` NO se ejecuta, `resetOnSuccess` (si está activo) NO se dispara. Confirma RF9 de la spec.
    - submit con `executeOperations` plural donde TODAS las entries quedan filtradas por su `when`: NI `onSuccess` ejecuta acciones reales (cubierto por 0073) NI `onError` se dispara (`results.length === 0` ⇒ no entra en la rama `else if`). Verificar explícitamente que el mock de `onError` no se invoca.
    - submit con `executeOperations` plural donde TODAS las entries fallan: `onError` se ejecuta una vez (no por cada operación). Confirmar que las acciones de `onError` se invocan en el orden declarado.
    - `onError` con dos acciones y `when` por acción: solo se ejecutan las que cumplen su condición. Una acción con `when: { reference: 'queries.{op}.error.message', operator: 'equals', value: 'forbidden' }` se ejecuta cuando el snapshot post-error contiene `error.message === 'forbidden'`. Esto valida RF10 (el snapshot ya refleja `queries.{op}.error.*` antes de evaluar `when`).
    - `onError` con dos acciones sin `when`: ambas se ejecutan en el orden declarado. Verificar el orden observando la secuencia de side-effects de los mocks.
    - coexistencia: un `form` con `onSuccess` y `onError` declarados a la vez. Con submit exitoso, solo se ejecuta `onSuccess`. Con submit fallido, solo se ejecuta `onError`. Confirma RF11 de la spec.
    - `resetOnSuccess: true` + `onError` declarado: en submit fallido, `resetOnSuccess` NO se dispara y `onError` sí. Confirma RF12 de la spec.
    - `onError` con acción `executeOperation` que a su vez falla: el fallo secundario NO dispara recursivamente otro ciclo de `onError`. Verificar que el mock de `onError` se invoca exactamente una vez aunque la operación interna emita `status: 'error'` (cubre el caso límite de la spec).
    - `onError: []` (array vacío) y submit fallido: no se dispara ningún side-effect; la pantalla permanece estable.
  - **Comandos durante la implementación**:
    - `pnpm test --run src/tests/runtime-state/runtime-state-forms-queries.test.tsx`
  - **Restricciones**:
    - Reutilizar `matchesVisibilityRule` y `executeRuntimeUiAction` sin duplicar lógica.
    - No introducir `await` entre acciones de `onError`; flujo fire-and-forget igual que `onSuccess`.
    - Reusar el harness ya establecido en el fichero (`FormRuntimeFixture` u homólogos definidos en `runtime-state/helpers.tsx` y los patrones de mock de `executeQueryOperation` que usan los tests de `onSuccess`). No crear un nuevo fixture si los existentes ya soportan el caso.
    - No introducir snapshots de DOM en estos tests; verificar comportamiento observando side-effects (mocks) y estado del store.
- **Documentación afectada**:
  - `ai-workflow/docs/app-features/forms/submit.md` — añadir la sección `Acciones post-fallo (onError)` simétrica a la sección existente `Acciones post-éxito (onSuccess)`.
  - `ai-workflow/docs/app-features/nodes/form.md` — extender el contrato de `submitAction` con `onError`, paralelo a la línea actual de `onSuccess`.
  - Estas actualizaciones se ejecutarán manualmente con `update-app-documentation`; ninguna tarea las cierra dentro de su propio scope.
- **Criterios de finalización**: comportamiento runtime alineado con todos los criterios de aceptación de la spec; tests verdes; los tests existentes de `onSuccess`, `resetOnSuccess` y validación local siguen pasando sin cambios.
- **Cierre de implementación**: ejecución runtime de `onError` operativa, `pnpm test` global cumple umbral del 80%.

---

## Documentación afectada (resumen para `update-app-documentation`)

Estas fichas se verán afectadas tras cerrar la implementación; ninguna tarea actualiza documentación dentro de su propio cierre. Se listan aquí para alimentar la skill `update-app-documentation`:

- `ai-workflow/docs/app-features/forms/submit.md` — añadir sección `Acciones post-fallo (onError)` simétrica a la existente `Acciones post-éxito (onSuccess)`. Documentar:
  - shape (lista ordenada de acciones del catálogo de botón con `when` opcional por acción),
  - cuándo dispara (error HTTP o error de negocio vía `errorCondition`; NO en validación local; NO en éxito),
  - semántica con `executeOperations` (cualquier operación en error ⇒ se dispara),
  - independencia de `resetOnSuccess` y ausencia de `resetOnError`,
  - terminalidad (un fallo secundario dentro de `onError` no dispara recursivamente otro ciclo).
- `ai-workflow/docs/app-features/nodes/form.md` — añadir la línea de contrato `submitAction.onError`, paralela a la línea actual de `submitAction.onSuccess`.

---

## Próxima tarea a ejecutar

T1.
