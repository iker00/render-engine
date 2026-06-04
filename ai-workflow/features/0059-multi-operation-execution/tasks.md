# Plan de implementación: ejecución múltiple y parametrización de requests (0059)

## Resumen

Cinco tareas secuenciales:

1. Interpolación `{{...}}` en `api.endpoint` al construir el request, con degradación tipada a `request-build-failed` cuando algún placeholder no se resuelve.
2. Definición del tipo `ExecuteOperationsRuntimeUiAction` y su validación previa al render en buttons y `form.submitAction`, sin pre-rechazo de `operationName` inexistente.
3. Ejecución runtime de `executeOperations` desde `button.props.action`: fan-out en paralelo desde el executor de acciones UI, con errores tipados por operación.
4. Ejecución runtime de `executeOperations` desde `form.submitAction`: fan-out en paralelo desde el handler del nodo `form`, con política colectiva de `resetOnSuccess` (reset solo si todas las operaciones terminan en `success`).
5. Ejemplo funcional en `src/dev/config.json` que ejercite tanto `executeOperations` como un `endpoint` con `{{...}}`.

Las decisiones cerradas de la spec (paralelismo sin orden garantizado, error por operación individual, `resetOnSuccess` colectivo, `endpoint` con placeholder no resuelto → `request-build-failed`, interpolación solo en `endpoint`) actúan como contrato de ejecución y no deben reinterpretarse durante la implementación.

---

## Tarea 01 — Interpolación `{{...}}` en `api.endpoint` al construir el request

**ID:** T01
**Estado:** pendiente
**Depende de:** ninguna (primera tarea)

### Objetivo

Permitir que `api.endpoint` contenga placeholders `{{...}}` con referencias de las familias `forms.*`, `queries.*`, `params.*` e `item.*`, resolverlos en el momento de construir el request, y degradar la operación a `status: error` con `code: request-build-failed` cuando cualquier placeholder no se resuelve o resuelve a un valor no representable como segmento (objeto, array, `null`, `undefined`, referencia ausente o no soportada).

La interpolación se evalúa en `src/queries/`, no en nodos visuales, y solo en `endpoint`. Las demás superficies de request (`api.query`, `api.body`, `api.headers`) no cambian.

### Fuera de alcance

- Interpolación `{{...}}` en superficies distintas de `api.endpoint`.
- Aplicación a `preloads` (queda explícitamente fuera de alcance en la spec).
- Cualquier cambio en el shape de validación de `api.endpoint` (sigue siendo `nonEmptyStringSchema`).
- Acción `executeOperations` (T02/T03/T04).

### Dependencias

Ninguna.

### Impacto esperado en archivos

**Código a modificar:**

- `src/queries/runtime-api-request.ts`
  - Añadir resolución del `endpoint` antes de pasar a `appendQueryString`. La lógica:
    - Si `operation.endpoint` no contiene la secuencia `{{`, usar el endpoint tal cual (regresión: comportamiento previo).
    - Si contiene placeholders, recorrer cada `{{...}}` con el mismo patrón que `runtime-reference-resolver` (`RUNTIME_TEMPLATE_PLACEHOLDER_PATTERN`) y resolver cada referencia con `resolveRuntimeReference(referenceValue, state, { iterationContext })`.
    - Cada placeholder cuya resolución no sea `resolved` con valor `string | number | boolean` (incluyendo `literal` cuyo `value` no sea string/number/boolean, `missing`, `unsupported`, `invalid`, o valores resueltos a objeto/array/`null`/`undefined`) debe marcar el endpoint como fallido. En ese caso, `buildRuntimeApiRequest` devuelve `{ status: 'error', error: { code: 'request-build-failed', message: 'The api operation "${operationName}" could not resolve "${placeholder}" for "endpoint".' } }` y no continúa.
    - Si todos los placeholders se resuelven a un valor representable, sustituir cada placeholder por la conversión a string usando la misma normalización que `dynamic-strings` (`number`/`boolean` se convierten a string visible; `0` y `false` se conservan).
  - El endpoint resuelto sustituye a `operation.endpoint` solo en la URL efectiva; el descriptor mantiene el `endpoint` original (no es necesario actualizarlo para los tests existentes salvo que rompa snapshots — verificar al implementar y reflejar en el descriptor si los tests existentes lo requieren).
- `src/runtime/runtime-references/runtime-reference-diagnostics.ts`
  - Añadir `'api.endpoint'` al tipo `RuntimeReferenceSurface` para que el diagnóstico de desarrollo discrimine este nuevo origen.
- `src/queries/runtime-api-request.ts` (continuación)
  - Llamar a `reportRuntimeReferenceDiagnostic` con `'api.endpoint'` cuando una resolución falla, para mantener la convención de diagnósticos.

**Tests a modificar:**

- `src/tests/runtime/runtime-api-execution.test.ts` (ampliación)

**Documentación a revisar al cerrar la feature:**

- `ai-workflow/docs/app-features/config/api-catalog.md`
- `ai-workflow/docs/app-features/references/dynamic-strings.md`
- `ai-workflow/docs/app-features/queries/execution.md`
- `ai-workflow/features/index.md`

### Tests

**Ficheros de test:**

- `src/tests/runtime/runtime-api-execution.test.ts` (ampliación)

**Comportamiento cubierto:**

- Un `endpoint` literal sin placeholders se comporta exactamente igual que antes: misma URL final, mismo descriptor, mismas familias de error. Regresión obligatoria.
- Un `endpoint` con `{{params.itemId}}` y `params: { itemId: '42' }` resuelve a la URL con `42` interpolado y emite el fetch con esa URL.
- Un `endpoint` con `{{forms.itemForm.id}}` y un form en store con `id: 'abc'` resuelve correctamente a la URL con `abc`.
- Un `endpoint` con `{{queries.previous.data.id}}` y una query previa con `data.id` numérico (`7`) resuelve a la URL con `7` y emite el fetch (number convertido a string visible).
- Un `endpoint` con `{{queries.x.data.enabled}}` y la query con `data.enabled: false` interpola la cadena `false` en la URL (boolean → string visible).
- Un `endpoint` dentro de un repeater con `{{item.id}}` y `iterationContext.item.id = 'row-3'` resuelve correctamente a `row-3`.
- Un `endpoint` con `{{params.missing}}` y `params: {}`: el resultado es `status: error`, `code: request-build-failed`, mensaje contiene el placeholder original y la palabra `endpoint`; el fetch no se invoca.
- Un `endpoint` con `{{forms.foo.bar}}` cuando ese form no existe en store: `status: error`, `code: request-build-failed`; el fetch no se invoca.
- Un `endpoint` con `{{queries.x.data.user}}` cuando la referencia resuelve a un objeto: `status: error`, `code: request-build-failed`; el fetch no se invoca.
- Un `endpoint` con `{{item.tags}}` cuando `item.tags` resuelve a un array: `status: error`, `code: request-build-failed`.
- Un `endpoint` con `{{item.id}}` fuera de un repeater (`iterationContext` ausente): `status: error`, `code: request-build-failed` (referencia no disponible).
- Un `endpoint` con dos placeholders, ambos resolubles: ambos se interpolan correctamente en el orden de aparición.
- Un `endpoint` con dos placeholders, el primero resuelve y el segundo falla: `status: error`, `code: request-build-failed`; no se emite request parcial.
- Un `endpoint` con un placeholder que combina espacios alrededor de la referencia (`{{ params.id }}`): se ignoran espacios y se resuelve igual que `{{params.id}}` (paridad con `dynamic-strings`).
- Coexistencia con `query` en el mismo request: tras interpolar `endpoint` correctamente, el `query` se anexa con `appendQueryString` como antes.

**Comandos durante la implementación:**

```
pnpm test --run src/tests/runtime/runtime-api-execution.test.ts
```

**Restricciones:**

- Reutilizar la maquinaria existente de resolución de referencias (`resolveRuntimeReference`, `RUNTIME_TEMPLATE_PLACEHOLDER_PATTERN`) en lugar de duplicar regex o parsing.
- No introducir un módulo nuevo para resolver `endpoint`; la lógica vive en `src/queries/` (puede ir en `runtime-api-request.ts` o en un helper privado del mismo módulo).
- La conversión de `number`/`boolean` a string debe usar la misma semántica que `dynamic-strings` (`normalizeRuntimeTextValue`-compatible): `String(value)`.
- La detección de "valor no representable" debe ser explícita por tipo, no por longitud de string vacío. Es decir, no usar "salida = ''" como heurística de fallo, sino comprobar el tipo del valor resuelto.
- No añadir snapshots de URLs construidas.

### Criterios de finalización

- `buildRuntimeApiRequest` interpola `{{...}}` en `endpoint` con la semántica descrita y devuelve `request-build-failed` cuando algún placeholder falla.
- `runtime-api-execution.test.ts` cubre los casos resolubles, fallidos y de regresión.
- `pnpm test --run src/tests/runtime/runtime-api-execution.test.ts` pasa en verde.

### Cierre de implementación

Código y tests de esta tarea completos y validados. La tarea siguiente (T02) puede ejecutarse.

---

## Tarea 02 — Tipo y validación previa al render de `executeOperations`

**ID:** T02
**Estado:** pendiente
**Depende de:** ninguna (T01 puede paralelizarse pero el orden secuencial efectivo es T01 → T02)

### Objetivo

Añadir el tipo `ExecuteOperationsRuntimeUiAction` al catálogo de acciones del runtime y aceptarlo en validación previa al render tanto en `button.props.action` como en `form.submitAction`. La validación cubre el shape (array de operaciones no vacío, cada entrada con `operationName` no vacío y `query`/`body`/`headers` opcionales con el mismo shape que `executeOperation` individual) y NO pre-rechaza `operationName` inexistente (esa decisión vive en runtime por entrada, según RF-4 de la spec).

### Fuera de alcance

- Cualquier cambio en el comportamiento de `executeOperation` singular (regresión obligatoria).
- Cualquier cambio en la pre-validación de `operationName` para `executeOperations`: la spec define que un `operationName` inexistente dentro de `executeOperations` se reporta como `operation-not-found` por operación en runtime, no como rechazo de config. El walker `findInvalidActionTarget` NO debe extenderse a `executeOperations`.
- La ejecución runtime (T03/T04).
- Interpolación de `endpoint` (T01).

### Dependencias

Ninguna.

### Impacto esperado en archivos

**Código a modificar:**

- `src/config/runtime-config-types.ts`
  - Añadir interfaz `ExecuteOperationsRuntimeUiActionEntry` con campos `operationName: string`, `query?: RuntimeApiQuery`, `body?: RuntimeApiBodyValue`, `headers?: RuntimeApiHeaders` (mismo shape que `RuntimeApiRequestParams` + `operationName`).
  - Añadir interfaz `ExecuteOperationsRuntimeUiAction` con `type: 'executeOperations'`, `operations: ExecuteOperationsRuntimeUiActionEntry[]`.
  - Añadir `'executeOperations'` al union `RuntimeUiActionType`.
  - Añadir `ExecuteOperationsRuntimeUiAction` al union `RuntimeUiAction`.
  - Mantener `ExecuteOperationRuntimeUiAction` y `submitAction?` actuales sin cambios de tipo; el tipo del `submitAction` debe ampliarse a `ExecuteOperationRuntimeUiAction | ExecuteOperationsRuntimeUiAction` (interfaz `FormLayoutNode` línea ~236).
- `src/config/runtime-config-zod.ts`
  - Añadir `executeOperationsRuntimeUiActionEntrySchema`: objeto `.strip()` con `operationName: nonEmptyStringSchema`, `query: runtimeApiQuerySchema.optional()`, `body: runtimeApiBodySchema.optional()`, `headers: runtimeApiHeadersSchema.optional()`.
  - Añadir `executeOperationsRuntimeUiActionSchema`: objeto `.strip()` con `type: z.literal('executeOperations')`, `operations: z.array(executeOperationsRuntimeUiActionEntrySchema).min(1)`.
- `src/config/runtime-config.ts`
  - Re-exportar los tipos nuevos (`ExecuteOperationsRuntimeUiAction`, `ExecuteOperationsRuntimeUiActionEntry`) siguiendo el patrón existente.
- `src/config/validate-actions-visibility.ts`
  - Extender `validateRuntimeUiAction`:
    - Añadir `rawAction.type === 'executeOperations'` al check del discriminador.
    - Añadir rama nueva tras la rama de `executeOperation` que use `executeOperationsRuntimeUiActionSchema.safeParse(rawAction)`. En caso de éxito, recorrer cada entrada y llamar a `validateRuntimeApiRequestParams(entry, '${path}.operations[${index}]', pageId)` para reutilizar la validación de `query`/`headers` por entrada. Si alguna entrada falla, devolver el error con la ruta exacta.
    - En caso de fallo de parseo Zod, mapear los issues más comunes a rutas legibles:
      - Issue en `operations` cuando es array vacío → ruta `${path}.operations`.
      - Issue en `operations[N].operationName` → ruta `${path}.operations[${N}].operationName`.
      - Issue en `operations[N].query`/`headers`/`body` → reutilizar `mapRequestQueryIssue`, `mapRequestHeadersIssue`, `mapRequestBodyIssue` con el prefijo `${path}.operations[${N}]`.
      - Fallback genérico → `${path}` con el segmento formateado.
  - Extender `validateFormSubmitAction`:
    - Aceptar `rawAction.type === 'executeOperation'` (comportamiento actual) y `rawAction.type === 'executeOperations'` (nuevo).
    - Para `executeOperations`, aplicar la misma rama de validación que `validateRuntimeUiAction` (extraerla a un helper interno reutilizable si reduce duplicación; si no, duplicar la mínima rama). La función devuelve `{ status: 'ready'; action: ExecuteOperationRuntimeUiAction | ExecuteOperationsRuntimeUiAction }`.
  - NO modificar `findInvalidActionTarget`: la rama de `executeOperation` que rechaza operationName inexistente sigue solo para `executeOperation` singular. Las entradas de `executeOperations` con operationName inexistente se gestionan en runtime (T03/T04).
- `src/config/validate-form-nodes.ts`
  - Asegurar que el tipo del `submitAction` resultante (línea ~129) admite el union nuevo; ajustar el tipo local de la variable `submitAction` a `ExecuteOperationRuntimeUiAction | ExecuteOperationsRuntimeUiAction | undefined`. El objeto devuelto por `validateFormNode` (línea ~151) debe propagar este union sin estrechar el tipo, de modo que `FormLayoutNode.submitAction` y los consumidores corriente abajo (runtime de submit en T04) reciban el subtipo correcto. La firma pública de `validateFormSubmitAction` queda como `{ status: 'ready'; action: ExecuteOperationRuntimeUiAction | ExecuteOperationsRuntimeUiAction } | { status: 'error'; ... }`.
  - Línea ~1128 (gate "unknown operationName" para `submitAction` del form): discriminar por `submitAction.type`. Para `executeOperation` (singular), mantener el comportamiento actual: rechazo previo al render con la ruta `submitAction.operationName`. Para `executeOperations`, NO aplicar este gate: la inexistencia de un `operationName` en una entrada del plural se reporta en runtime (T04) como `operation-not-found` por entrada. La implementación literal en este punto es: `if (node.submitAction?.type === 'executeOperation' && !context.operationNames.has(node.submitAction.operationName)) { ... }`.
  - Líneas ~1382–1395 (gate "GET + body" para `button.props.action.body` y para `form.submitAction.body`): este es un guard de **shape estático** sobre la combinación método/body, no un guard de existencia de operación. La decisión cerrada en este plan es aplicarlo **por entrada** para `executeOperations`:
    - Botones (línea ~1382): añadir una rama paralela para `node.type === 'button' && node.props.action?.type === 'executeOperations'` que recorra `action.operations` y, por cada entrada con `body !== undefined` y `api[entry.operationName]?.method === 'GET'`, devuelva `invalidLayout(\`Page "${pageId}" has an invalid layout at "${nodePath}.props.action.operations[${index}].body": GET operations do not support body.\`)`. Si `entry.operationName` no existe en `api`, la rama no dispara (consistente con "no pre-rechazo de operationName inexistente").
    - Form submit (línea ~1390): mismo patrón. Si `node.submitAction?.type === 'executeOperations'`, recorrer `submitAction.operations` y aplicar el mismo guard con la ruta `${nodePath}.submitAction.operations[${index}].body`.
  - El walker `findInvalidActionTarget` en `validate-actions-visibility.ts` sigue SIN tocarse (recordatorio del bloque anterior de la misma tarea).

**Tests a modificar:**

- `src/tests/config-validation/runtime-config-validation-buttons.test.ts` (ampliación)
- `src/tests/config-validation/runtime-config-validation-api-operations.test.ts` (ampliación)
- `src/tests/config-validation/runtime-config-validation-forms-semantics.test.ts` (ampliación)

**Documentación a revisar al cerrar la feature:**

- `ai-workflow/docs/app-features/queries/execution.md`
- `ai-workflow/docs/app-features/forms/submit.md`
- `ai-workflow/docs/app-features/config/validation.md`
- `ai-workflow/features/index.md`

### Tests

**Ficheros de test:**

- `src/tests/config-validation/runtime-config-validation-buttons.test.ts` (ampliación)
- `src/tests/config-validation/runtime-config-validation-api-operations.test.ts` (ampliación)
- `src/tests/config-validation/runtime-config-validation-forms-semantics.test.ts` (ampliación)

**Comportamiento cubierto:**

En `runtime-config-validation-buttons.test.ts`:

- Un `button.props.action` con `type: 'executeOperations'` y dos entradas válidas (`operationName` declarado en `api`) produce `status: 'ready'` con la acción normalizada.
- Un `button.props.action` con `type: 'executeOperations'` y una sola entrada válida produce `status: 'ready'` (caso permitido por la spec aunque no canónico).
- Un `button.props.action` con `executeOperations` sin `operations` produce `status: 'error'` con ruta `props.action.operations`.
- Un `button.props.action` con `executeOperations` y `operations: []` produce `status: 'error'` con ruta `props.action.operations`.
- Un `button.props.action` con `executeOperations` donde una entrada no declara `operationName` produce `status: 'error'` con ruta `props.action.operations[N].operationName`.
- Un `button.props.action` con `executeOperations` donde una entrada declara `operationName` vacío o no string produce `status: 'error'` con la misma ruta.
- Un `button.props.action` con `executeOperations` donde una entrada lleva `query` no plano (valor no escalar) produce `status: 'error'` con ruta `props.action.operations[N].query.<key>`.
- Un `button.props.action` con `executeOperations` donde una entrada lleva `headers` con valor no string produce `status: 'error'` con ruta `props.action.operations[N].headers.<key>`.
- Un `button.props.action` con `executeOperations` donde una entrada lleva `body` con valor no JSON-serializable produce `status: 'error'` con ruta `props.action.operations[N].body[...]`.
- Claves extra en una entrada de `operations` se descartan silenciosamente por `.strip()` (regresión: equivalente al comportamiento del `executeOperation` singular).
- Una entrada de `executeOperations` con `operationName` inexistente en el catálogo `api` NO produce error de validación previa al render (el config se acepta como `ready`). Justificación: por contrato de la feature, esto se reporta en runtime por operación. Verificar explícitamente que `validateActionTargets`/`findInvalidActionTarget` no recorren `executeOperations`.
- Regresión: `button.props.action.type: 'executeOperation'` sigue rechazándose por validación cuando referencia un `operationName` inexistente, sin cambios.

En `runtime-config-validation-api-operations.test.ts`:

- Caso happy-path: un config con dos botones, uno con `executeOperation` y otro con `executeOperations` de dos entradas, ambos con `query`/`body`/`headers` válidos, produce `status: 'ready'` con las acciones normalizadas (entradas conservan `operationName` y request params por entrada).
- Casos de error de shape por entrada (`query`/`headers`/`body` inválidos) producen rutas con `operations[N]`.

En `runtime-config-validation-forms-semantics.test.ts`:

- Un `form.submitAction` con `type: 'executeOperations'` y dos entradas válidas produce `status: 'ready'`.
- Un `form.submitAction` con `executeOperations` sin `operations` produce `status: 'error'` con ruta `submitAction.operations`.
- Un `form.submitAction` con `executeOperations` y `operations: []` produce `status: 'error'` con ruta `submitAction.operations`.
- Un `form.submitAction` con `executeOperations` donde una entrada no declara `operationName` produce `status: 'error'` con ruta `submitAction.operations[N].operationName`.
- Un `form.submitAction` con `executeOperations` y `resetOnSuccess: true` declarado en el formulario produce `status: 'ready'` (la combinación es válida; la política colectiva vive en runtime).
- Un `form.submitAction` con `executeOperations` donde alguna entrada referencia un `operationName` inexistente en `api` NO produce error de validación previa al render: el config se acepta como `ready`. Paridad explícita con el caso de botón. La gestión per-entry vive en runtime (T04).
- Un `form.submitAction` con `executeOperations` donde una entrada lleva `body` y `api[entry.operationName].method === 'GET'`: el config se rechaza con ruta `submitAction.operations[N].body` y mensaje `GET operations do not support body.` (extensión per-entry del guard estático ya existente).
- Un `button.props.action` con `executeOperations` donde una entrada lleva `body` y `api[entry.operationName].method === 'GET'`: el config se rechaza con ruta `props.action.operations[N].body` y el mismo mensaje (paridad con el caso form).
- Un `button.props.action` o `form.submitAction` con `executeOperations` donde una entrada referencia un `operationName` inexistente Y lleva `body`: el config se acepta como `ready` (el guard GET+body solo dispara cuando la operación existe en `api`; coherente con la decisión "no pre-rechazo de operationName inexistente").
- Regresión: `form.submitAction.type: 'executeOperation'` con `operationName` inexistente sigue rechazándose con ruta `submitAction.operationName`, sin cambios.
- Regresión: `form.submitAction.type: 'executeOperation'` se acepta y normaliza como antes.

**Comandos durante la implementación:**

```
pnpm test --run src/tests/config-validation/runtime-config-validation-buttons.test.ts
pnpm test --run src/tests/config-validation/runtime-config-validation-api-operations.test.ts
pnpm test --run src/tests/config-validation/runtime-config-validation-forms-semantics.test.ts
```

**Restricciones:**

- Reutilizar `executeOperationRuntimeUiActionSchema` solo como referencia conceptual del shape de entrada; cada entrada de `executeOperations` debe parsearse con un schema independiente que NO incluya el campo `type` y que use `runtimeApiQuerySchema`/`runtimeApiHeadersSchema`/`runtimeApiBodySchema` directamente.
- Reutilizar `validateRuntimeApiRequestParams`, `mapRequestQueryIssue`, `mapRequestHeadersIssue`, `mapRequestBodyIssue` para errores de `query`/`headers`/`body` por entrada. No duplicar walkers de JSON.
- No alterar `findInvalidActionTarget`. Añadir tests explícitos que verifiquen que un `executeOperations` con `operationName` inexistente NO se rechaza en validación.
- Mensajes de error consistentes con `Page "${pageId}" has an invalid layout at "${path}".`.

### Criterios de finalización

- `ExecuteOperationsRuntimeUiAction` y `ExecuteOperationsRuntimeUiActionEntry` existen y se exportan desde `src/config/runtime-config.ts`.
- `validateRuntimeUiAction` acepta `executeOperations` para botones con shape válido y propaga errores con rutas exactas en caso contrario.
- `validateFormSubmitAction` acepta `executeOperation` y `executeOperations` con su shape válido.
- `findInvalidActionTarget` no rechaza `executeOperations` con `operationName` inexistente.
- `pnpm test --run` de los tres ficheros listados pasa en verde.

### Cierre de implementación

Código y tests de esta tarea completos y validados. Las tareas T03 y T04 quedan habilitadas.

---

## Tarea 03 — Runtime de `executeOperations` desde `button.props.action`

**ID:** T03
**Estado:** pendiente
**Depende de:** T01 (interpolación de endpoint es necesaria si una entrada lleva endpoint con `{{...}}`), T02 (el tipo y el config aceptado)

### Objetivo

Extender el executor de acciones UI para que, cuando `action.type === 'executeOperations'`, lance en paralelo una llamada `executeQueryOperation` por cada entrada del array, con los overrides de `query`/`body`/`headers` declarados en la entrada y el mismo `iterationContext` que la acción raíz. Cada operación actualiza `queries.{operationName}` de forma independiente y se rige por la semántica de errores tipados existente; en particular, una entrada con `operationName` inexistente produce `code: operation-not-found` en `queries.{operationName}` sin afectar al resto.

### Fuera de alcance

- Estado agregado o consolidado de las N operaciones (no existe ni se introduce).
- Refetch automático tras éxito.
- Cambios en la fachada `executeQueryOperation` (firma, contrato, snapshot).
- Submit de formulario (T04).
- Validación previa al render (T02).

### Dependencias

T01, T02.

### Impacto esperado en archivos

**Código a modificar:**

- `src/runtime/runtime-actions/runtime-ui-action-executor.ts`
  - Añadir `case 'executeOperations':` al switch de `executeRuntimeUiAction`.
  - Implementación literal: recorrer `action.operations`, para cada entrada llamar a `handlers.executeQueryOperation(entry.operationName, { requestParams: { query: entry.query, body: entry.body, headers: entry.headers }, iterationContext: options?.iterationContext })`. Las llamadas se disparan sin `await` (la firma actual ya devuelve `Promise<unknown>` y se descarta con `void` igual que `executeOperation`). El executor no espera; las promesas viven hasta resolución en el ciclo de queries.
  - Pseudocódigo:
    ```
    case 'executeOperations':
      for (const entry of action.operations) {
        void handlers.executeQueryOperation(entry.operationName, {
          requestParams: {
            query: entry.query,
            body: entry.body,
            headers: entry.headers,
          },
          iterationContext: options?.iterationContext,
        })
      }
      return
    ```
- `src/runtime/nodes/button-layout-node.tsx`
  - No requiere cambios estructurales: el botón ya delega en `executeRuntimeUiAction(action, handlers, { iterationContext })` para cualquier acción. Verificar que el tipo del prop `action` admite `ExecuteOperationsRuntimeUiAction` por el union actualizado en T02.
- `src/runtime/runtime-actions/runtime-navigation-action-executor.ts` (verificación, no necesariamente modificación)
  - Confirmar que sigue compilando: este executor usa `executeQueryOperation: async () => undefined` como handler estub y debería seguir siendo compatible con la rama nueva.

**Tests a modificar/crear:**

- `src/tests/runtime/runtime-ui-actions.test.tsx` (ampliación)
- `src/tests/runtime/runtime-api-execution.test.ts` (ampliación)

**Documentación a revisar al cerrar la feature:**

- `ai-workflow/docs/app-features/queries/execution.md`
- `ai-workflow/docs/app-features/nodes/button.md`
- `ai-workflow/features/index.md`

### Tests

**Ficheros de test:**

- `src/tests/runtime/runtime-ui-actions.test.tsx` (ampliación)
- `src/tests/runtime/runtime-api-execution.test.ts` (ampliación)

**Comportamiento cubierto:**

En `runtime-ui-actions.test.tsx`:

- `executeRuntimeUiAction` con una acción `executeOperations` de dos entradas llama a `executeQueryOperation` dos veces, una por entrada, en el mismo tick síncrono (no espera la primera para lanzar la segunda).
- Cada llamada recibe `operationName`, `requestParams` (con `query`/`body`/`headers` de la entrada) y el `iterationContext` propagado desde las opciones del executor.
- `executeRuntimeUiAction` con una acción `executeOperations` de una sola entrada llama a `executeQueryOperation` exactamente una vez con la entrada.
- `executeRuntimeUiAction` con `executeOperations` no llama a otros handlers (`navigateToPage`, `goBackPage`, `openModal`, `closeModal`, `resetForm`).
- Una entrada con `query`/`body`/`headers` ausentes invoca `executeQueryOperation` con `requestParams: { query: undefined, body: undefined, headers: undefined }` (paridad con `executeOperation` cuyas opciones también pueden ir vacías).
- Una entrada con `body: null` se propaga literalmente como `body: null` (semántica intencional de petición sin body serializado, ya soportada en RuntimeApiRequestParams).
- Render de `ButtonNode` con un `action: executeOperations` dispara las dos llamadas al hacer click; sin click no se dispara ninguna.
- Render de `ButtonNode` dentro de un fixture con `iterationContext` propaga ese contexto a las llamadas (cobertura de `repeater`-like).

En `runtime-api-execution.test.ts`:

- Una llamada `executeRuntimeApiOperation` con `operationName` inexistente devuelve `status: error`, `code: operation-not-found` (regresión obligatoria — base para RF-4 en runtime).
- Dos llamadas independientes `executeRuntimeApiOperation` consecutivas con `operationName`s distintos producen dos resultados independientes; la promesa de una operación errónea no afecta al otro `queries.{name}` (verificación a nivel de building block; la validación end-to-end del fan-out vive en `runtime-ui-actions.test.tsx`).

**Comandos durante la implementación:**

```
pnpm test --run src/tests/runtime/runtime-ui-actions.test.tsx
pnpm test --run src/tests/runtime/runtime-api-execution.test.ts
```

**Restricciones:**

- No introducir agregación de resultados (no `Promise.all`, no `Promise.allSettled`) en el executor de acciones UI; el fan-out debe ser fire-and-forget como el singular.
- No tocar la fachada `executeQueryOperation`. La paralelización es solo "disparo simultáneo en el mismo tick síncrono".
- Reusar el fixture/mocks de `runtime-ui-actions.test.tsx` (`createHandlers`, `useRuntimeStateActionsMock`).
- No añadir snapshots.

### Criterios de finalización

- El executor maneja `executeOperations` con la semántica fan-out y paridad de overrides por entrada.
- `ButtonNode` dispara correctamente la nueva acción cuando se hace click.
- `runtime-ui-actions.test.tsx` y `runtime-api-execution.test.ts` ampliados pasan en verde.

### Cierre de implementación

Código y tests de esta tarea completos y validados. La tarea siguiente (T04) puede ejecutarse.

---

## Tarea 04 — Runtime de `executeOperations` desde `form.submitAction` con `resetOnSuccess` colectivo

**ID:** T04
**Estado:** pendiente
**Depende de:** T01 (endpoint dinámico en una entrada), T02 (validación de `submitAction`), T03 (executor singular ya estabilizado, aunque el form no lo usa directamente)

### Objetivo

Extender el handler de submit del nodo `form` para que, cuando `submitAction.type === 'executeOperations'`, lance en paralelo una llamada `executeQueryOperation` por cada entrada con sus overrides de `query`/`body`/`headers`, espere a TODAS las promesas, y aplique la política colectiva: `resetOnSuccess: true` resetea el formulario solo cuando todas las operaciones terminan con `status: 'success'`; si alguna falla, el formulario conserva los valores actuales del usuario.

### Fuera de alcance

- Estado agregado de las N operaciones más allá del cómputo binario "todas success".
- Refetch automático tras éxito.
- Cambios en validación local del formulario antes del submit (sin cambios).
- Cambios en `executeOperation` singular (regresión obligatoria).

### Dependencias

T01, T02, T03.

### Impacto esperado en archivos

**Código a modificar:**

- `src/runtime/nodes/form-layout-node.tsx`
  - Ajustar el tipo de `node.submitAction` a `ExecuteOperationRuntimeUiAction | ExecuteOperationsRuntimeUiAction | undefined` (ya cubierto por el union ampliado en T02).
  - En `handleSubmit`, tras la validación local exitosa, distinguir por `node.submitAction.type`:
    - Rama `executeOperation` (actual): comportamiento idéntico, sin cambios visibles. Reset si `result.status === 'success' && node.resetOnSuccess`.
    - Rama `executeOperations` (nueva):
      - Lanzar `Promise.all(node.submitAction.operations.map((entry) => executeQueryOperation(entry.operationName, { snapshotState: readRuntimeState(), requestParams: { query: entry.query, body: entry.body, headers: entry.headers }, iterationContext })))`.
      - Importante: `snapshotState` se captura UNA sola vez antes de `Promise.all` y se pasa por valor a cada llamada para que todas las operaciones del submit operen sobre el mismo snapshot del estado (consistente con cómo el submit singular ya captura `readRuntimeState()`).
      - Esperar el array de resultados.
      - Si `node.resetOnSuccess` es `true` y todos los resultados tienen `status === 'success'`, llamar a `resetForm(node.id)`. Si alguno tiene `status === 'error'`, no resetear.
  - Pseudocódigo:
    ```
    const submitAction = node.submitAction
    if (submitAction.type === 'executeOperation') {
      const result = await executeQueryOperation(submitAction.operationName, {...})
      if (result.status === 'success' && node.resetOnSuccess) {
        resetForm(node.id)
      }
      return
    }
    // executeOperations
    const snapshotState = readRuntimeState()
    const results = await Promise.all(
      submitAction.operations.map((entry) =>
        executeQueryOperation(entry.operationName, {
          snapshotState,
          requestParams: { query: entry.query, body: entry.body, headers: entry.headers },
          iterationContext,
        }),
      ),
    )
    const allSuccess = results.every((r) => r.status === 'success')
    if (allSuccess && node.resetOnSuccess) {
      resetForm(node.id)
    }
    ```

**Tests a crear:**

- `src/tests/layout-renderer/layout-renderer-forms-multi-operation.test.tsx` (nuevo)

**Tests a modificar:**

- `src/tests/runtime/runtime-api-execution.test.ts` (ampliación, opcional, solo si se descubre un building block faltante; por defecto los tests de form viven en `layout-renderer/`)

**Documentación a revisar al cerrar la feature:**

- `ai-workflow/docs/app-features/forms/submit.md`
- `ai-workflow/docs/app-features/queries/execution.md`
- `ai-workflow/features/index.md`

### Tests

**Ficheros de test:**

- `src/tests/layout-renderer/layout-renderer-forms-multi-operation.test.tsx` (nuevo)

**Comportamiento cubierto:**

- Un formulario con `submitAction.type: 'executeOperations'` y dos entradas resolubles, al hacer submit, lanza dos llamadas paralelas y ambas terminan en `queries.op1.status === 'success'` y `queries.op2.status === 'success'`. El fetch mock se invoca dos veces.
- Un formulario con dos entradas, `resetOnSuccess: true`, donde ambas operaciones devuelven success: tras el submit, los campos del formulario vuelven al `defaultValue`. (Reset colectivo confirmado.)
- Un formulario con dos entradas, `resetOnSuccess: true`, donde una operación devuelve `status: 'success'` y la otra `status: 'error'` (`code: http-error` o `network-error`): tras el submit, los campos del formulario CONSERVAN los valores actuales del usuario, no se resetean. Las dos queries quedan con su status respectivo.
- Un formulario con dos entradas, `resetOnSuccess: false` (o ausente), donde ambas devuelven success: NO se resetea (regresión: sin `resetOnSuccess` no hay reset).
- Un formulario con una entrada cuyo `operationName` no existe en `api`: tras submit, `queries.{nombreInexistente}.status === 'error'` con `code: operation-not-found` y la otra operación válida termina con `success`. El reset NO se aplica porque no todas son success.
- Un formulario con una entrada cuyo `endpoint` lleva `{{...}}` que no se resuelve: tras submit, esa operación queda en `error` con `code: request-build-failed`, sin emitir red, y la otra operación se ejecuta normalmente. (Integración con T01.)
- Un formulario con una entrada cuyo `body` referencia `forms.{formId}.{fieldId}`: la entrada usa el valor actual del campo en el snapshot del submit. Confirma que las N operaciones comparten un único snapshot (no leen el estado tras el reset implícito de la primera).
- Un formulario dentro de un `repeater` con `submitAction.type: 'executeOperations'` y una entrada con `body: { id: 'item.id' }`: el submit en una iteración concreta resuelve `item.id` contra el `iterationContext` de esa iteración.
- Un formulario con `executeOperations` de una sola entrada y `resetOnSuccess: true` resetea exactamente igual que el singular (paridad funcional documentada en spec).
- Regresión: un formulario con `submitAction.type: 'executeOperation'` (singular) sigue funcionando idénticamente: una llamada, reset cuando success y `resetOnSuccess: true`.

**Comandos durante la implementación:**

```
pnpm test --run src/tests/layout-renderer/layout-renderer-forms-multi-operation.test.tsx
```

**Restricciones:**

- Reutilizar el patrón de fixtures de `layout-renderer-forms.test.tsx` para inicialización del runtime, mock de `fetch`, y aserciones sobre el DOM/store (no duplicar utilidades; importar desde `runtime-state/helpers.tsx` o desde un helper local si ya existe).
- El cómputo de "todas success" debe ser literal `results.every((r) => r.status === 'success')`, no una heurística sobre el último resultado ni sobre conteos.
- `snapshotState` se captura ANTES del `Promise.all` y se reutiliza para todas las operaciones del submit; no recapturar dentro del `.map`.
- No añadir snapshots de DOM.

### Criterios de finalización

- `form-layout-node.tsx` distingue correctamente entre `executeOperation` y `executeOperations` en submit.
- La política colectiva de `resetOnSuccess` se aplica con la semántica "todas success → reset, alguna error → no reset".
- `layout-renderer-forms-multi-operation.test.tsx` pasa en verde.
- Regresión: `layout-renderer-forms.test.tsx` y la suite global siguen verdes.

### Cierre de implementación

Código y tests de esta tarea completos y validados. La tarea siguiente (T05) puede ejecutarse.

---

## Tarea 05 — Ejemplo funcional en `src/dev/config.json`

**ID:** T05
**Estado:** pendiente
**Depende de:** T01, T03 y T04 (todas las capacidades de runtime y validación deben estar operativas)

### Objetivo

Añadir o adaptar el config de desarrollo para incluir al menos:

- Un `endpoint` con `{{...}}` (preferentemente sobre `params.*` o `forms.*` para que sea fácilmente disparable manualmente).
- Un `button.props.action.type: 'executeOperations'` con al menos dos entradas, una con override de `body` o `query`.
- Un `form.submitAction.type: 'executeOperations'` con `resetOnSuccess: true` y al menos dos entradas.

El objetivo es permitir verificar visualmente en modo desarrollo el comportamiento de la feature, no introducir tests nuevos.

### Fuera de alcance

- Cualquier otro cambio en la lógica de runtime.
- Tests adicionales (las suites existentes y las ampliadas en T01–T04 ya cubren la feature).
- Crear un fichero de config nuevo.

### Dependencias

T01, T02, T03, T04.

### Impacto esperado en archivos

**Código a modificar:**

- `src/dev/config.json`
  - Añadir o adaptar operaciones `api` con `endpoint` que use `{{params.*}}` o `{{forms.*}}`.
  - Añadir o adaptar un botón en alguna página con `action: { type: 'executeOperations', operations: [...] }` (al menos dos entradas).
  - Añadir o adaptar un formulario con `submitAction: { type: 'executeOperations', operations: [...] }` y `resetOnSuccess: true`.
  - El config debe seguir validando como `ready` al arrancar el runtime.

**Tests:**

- No se crean tests nuevos. La suite global (`pnpm test`) ejerce el bootstrap del config si aplica.

**Documentación a revisar al cerrar la feature:**

- `ai-workflow/docs/app-features/development/local-config.md` (si documenta la estructura del config de desarrollo).

### Tests

**Ficheros de test:** ninguno; cubierto por: T01 (interpolación de endpoint), T02 (validación de `executeOperations`), T03 (runtime de botón), T04 (runtime de form), más las suites existentes que se ejecutan con `pnpm test`.

**Comportamiento cubierto:**

- `src/dev/config.json` pasa la validación del runtime (`validateRuntimeConfig`) tras los cambios.
- `pnpm test` sigue verde con cobertura ≥ 80%.

**Comandos durante la implementación:**

```
pnpm test
```

**Restricciones:**

- Solo modificar el JSON existente; no crear ficheros de config nuevos.
- Las referencias usadas (`params.*`, `forms.*`, `queries.*`, `item.*`) deben existir realmente en el contexto donde se evalúan (formId/fieldId declarados, paginas con esos `params`, queries declaradas).
- No introducir referencias huérfanas que rompan el bootstrap.

### Criterios de finalización

- `src/dev/config.json` no tiene errores de validación al arrancar el runtime en modo desarrollo.
- `pnpm test` pasa en verde con el umbral de cobertura del proyecto.

### Cierre de implementación

Código y tests de esta tarea completos y validados. La feature está implementada completamente.
