# Tasks — 0121 — Valor de sustitución en submit para `select` vacío

Contrato de ejecución para la feature. Alcance acotado: nuevo prop opcional `select.props.emptySubmitValue`
(selección simple únicamente) que sustituye `""` por un valor literal configurado exclusivamente al construir el
payload de submit (`api.body`/`api.query`/`api.headers` y los canales equivalentes de `submitAction`), sin afectar al
store, la UI, `visibility`, `queryStateFeedback`, `defaultValue` de otros campos ni la validación `required`.

Se divide en tres tareas secuenciales que separan capas ya delimitadas por `architecture.md`:
1. Contrato y validación bootstrap (`src/config/`).
2. Sustitución en el resolver de payload (`src/queries/`, la frontera de red).
3. Cómputo del valor por campo desde el árbol de layout y wiring end-to-end (`src/runtime/`).

Cada tarea es compilable y testeable de forma aislada. `0121-T3` es la que hace el comportamiento observable
end-to-end; `0121-T1` y `0121-T2` dejan contrato y lógica listos pero inertes hasta que `0121-T3` los conecta.

## Siguiente tarea a escoger
`0121-T1` — habilita el contrato de tipos y validación. `0121-T2` no depende de `0121-T1` a nivel de compilación (usa
tipos propios en `src/queries/`), pero debe implementarse después para mantener el orden secuencial del plan.
`0121-T3` no debe iniciarse hasta cerrar `0121-T1` y `0121-T2`: necesita el prop tipado/validado y el resolver ya
preparado para recibir la sustitución.

---

## Task 0121-T1 — Contrato y validación bootstrap de `select.props.emptySubmitValue`

- **ID**: 0121-T1
- **Estado**: pending
- **Objetivo**: Añadir el prop opcional `props.emptySubmitValue` (`string | number`) al contrato de tipos y al schema
  `Zod` del nodo `select`, y rechazar en bootstrap la combinación `props.multiple: true` + `emptySubmitValue`
  declarado. No se valida contra `props.items` (el valor de sustitución no necesita coincidir con ninguna opción).
  - Cambios concretos:
    - `src/config/runtime-config-types.ts`:
      - Añadir `emptySubmitValue?: string | number` al objeto `props` de `SelectLayoutNode` (línea ~432-441), junto a
        `items`, `multiple` y `placeholder`. No añadir a `FormFieldLayoutNodeProps` compartido: es exclusivo de
        `select`.
    - `src/config/runtime-config-zod.ts`:
      - Añadir `emptySubmitValue: z.union([z.string(), z.number()]).optional()` dentro del `.extend({...})` de
        `selectNodeSchema` (línea ~561-565), junto a `items`, `multiple` y `placeholder`.
    - `src/config/validate-form-field-nodes.ts`, función `validateSelectNode`:
      - Inmediatamente después del bloque `defaultValueIssue` (líneas ~236-247) y antes de
        `validateFormFieldValidations`, añadir:
        ```ts
        if (parseResult.data.props.multiple === true && parseResult.data.props.emptySubmitValue !== undefined) {
          return enrichedInvalidLayout(
            `Page "${pageId}" has an invalid layout at "${path}.props.emptySubmitValue": emptySubmitValue is only valid for single-selection select fields (props.multiple must be absent or false).`,
            breadcrumb,
            rawNode,
          )
        }
        ```
      - `enrichedInvalidLayout` ya está importado en este fichero (línea 20); no añadir un nuevo import.
      - No añadir ninguna comprobación cruzada contra `parseResult.data.props.items`.
- **Fuera de alcance**:
  - Sustitución en el payload de submit (queda para `0121-T2` y `0121-T3`).
  - Cómputo del mapa `fieldId → valor` desde el árbol de layout (queda para `0121-T3`).
  - Cualquier cambio en `props.defaultValue`, `validateChoiceFieldDefaultValue` o `validateSelectItemsContract`.
  - Actualizar documentación funcional (queda para `update-app-documentation` posterior).
- **Dependencias**: ninguna. Es la primera tarea del plan.
- **Impacto esperado en archivos**:
  - Código:
    - `src/config/runtime-config-types.ts` (tipo `SelectLayoutNode`)
    - `src/config/runtime-config-zod.ts` (`selectNodeSchema`)
    - `src/config/validate-form-field-nodes.ts` (`validateSelectNode`)
  - Tests:
    - `src/tests/config-validation/runtime-config-validation-form-fields.test.ts` (ampliación)
  - Documentación: revisar tras el cierre de implementación (ver "Documentación afectada") — no ejecutar aquí.
- **Tests**:
  - **Ficheros de test**:
    - `src/tests/config-validation/runtime-config-validation-form-fields.test.ts` (ampliación)
  - **Comportamiento cubierto**:
    - Aceptación: `select` simple (`multiple` ausente) con `emptySubmitValue: "N/A"` (string) valida sin error.
    - Aceptación: `select` simple con `emptySubmitValue: 0` (number) valida sin error.
    - Aceptación: `select` simple con `emptySubmitValue` ausente valida sin error (sin regresión).
    - Aceptación: `select` simple con `emptySubmitValue` configurado a un valor que no aparece en ningún `value` de
      `props.items` (manual literal, manual escalar o dinámico) valida sin error — no hay cross-check contra items.
    - Aceptación: `select` con `multiple: false` explícito y `emptySubmitValue` declarado valida sin error (equivale a
      ausente).
    - Rechazo: `select.props.multiple: true` con `emptySubmitValue` declarado (string o number) se rechaza con
      `code: invalid-layout` y ruta `{path}.props.emptySubmitValue` y el mensaje exacto declarado arriba.
    - Rechazo: `emptySubmitValue` con un shape no escalar (`array`, `object`, `boolean`, `null`) se rechaza por el
      schema `Zod` (mensaje genérico de tipo inválido de la fachada de errores estructurales), tanto en selección
      simple como múltiple.
    - Regresión: los tests ya existentes de `defaultValue` (array/escalar, simple/múltiple) del fichero siguen
      pasando sin cambios de aserciones.
  - **Comandos durante la implementación**:
    - `pnpm test --run src/tests/config-validation/runtime-config-validation-form-fields.test.ts`
    - `pnpm test` (una vez al cierre, para confirmar la suite global y el gate de cobertura)
  - **Restricciones**:
    - Añadir los casos nuevos como `it(...)`/`describe('emptySubmitValue', ...)` propio dentro de los bloques ya
      existentes para `select`, sin crear un fichero nuevo.
    - No introducir snapshots.
    - No tocar ni reordenar tests ya existentes; solo añadir.
    - Reutilizar los helpers y fixtures ya declarados en la cabecera del fichero.
- **Documentación afectada**:
  - `ai-workflow/docs/app-features/nodes/select.md` — documentar el nuevo prop `emptySubmitValue` en "Contrato
    (`props`)" y en "Validación específica" (regla de rechazo con `multiple: true`).
  - `ai-workflow/docs/app-features/config/validation.md` — añadir la regla de rechazo bajo "Reglas de items y
    colecciones" o una sección propia del nodo `select`.
- **Criterios de finalización**:
  - `SelectLayoutNode['props']` incluye `emptySubmitValue?: string | number`.
  - `selectNodeSchema` acepta `emptySubmitValue` opcional como `string | number`.
  - `validateSelectNode` rechaza `multiple: true` + `emptySubmitValue` declarado con la ruta y mensaje exactos
    definidos arriba, y no valida `emptySubmitValue` contra `props.items`.
  - Todos los tests nuevos y ya existentes del fichero `runtime-config-validation-form-fields.test.ts` en verde.
  - `pnpm test` (suite completa) en verde sin bajar el umbral de cobertura global del 80%.
- **Cierre de implementación**:
  - Tipos, schema y validación de shape están en el árbol; los tests declarados arriba pasan; la suite global sigue
    en verde.

---

## Task 0121-T2 — Sustitución en el resolver de payload (`src/queries/`)

- **ID**: 0121-T2
- **Estado**: pending
- **Objetivo**: Implementar la lógica de sustitución de `""` por un valor de reemplazo (normalizado a string) dentro
  del resolvedor compartido de payload de submit, activada por una nueva opción `emptySubmitValues` que en esta tarea
  no se computa todavía desde ningún nodo real (queda para `0121-T3`); aquí solo se prepara y prueba el mecanismo con
  el tipo ya definido y valores construidos a mano en los tests. `resolvePayloadValue` es la función compartida que ya
  usan `resolveBody`, `resolveQuery` y las cabeceras sin interpolación; `resolveHeaderTemplateValue` tiene su propia
  rama de resolución para cabeceras con `{{...}}` y necesita el mismo tratamiento por separado.
  - Cambios concretos:
    - `src/queries/runtime-api-types.ts`:
      - Añadir el tipo:
        ```ts
        export interface RuntimeApiEmptySubmitValues {
          formId: string
          valuesByFieldId: ReadonlyMap<string, string | number>
        }
        ```
        (colocarlo junto a `RuntimeApiHiddenFormFields`, del que es análogo).
      - Añadir el campo opcional `emptySubmitValues?: RuntimeApiEmptySubmitValues` a `BuildRuntimeApiRequestOptions`
        y a `BuildInlineRuntimeApiRequestOptions`, junto a `hiddenFormFields`.
    - `src/queries/runtime-api-payload-resolver.ts`:
      - Importar `RuntimeApiEmptySubmitValues` desde `./runtime-api-types`.
      - Añadir `emptySubmitValues?: RuntimeApiEmptySubmitValues` a la interfaz `ResolvePayloadValueOptions`.
      - En `resolvePayloadValue`, dentro de la rama `resolvedReference.status === 'resolved'` (líneas ~60-77),
        **después** del `if` existente que decide `status: 'omit'` por campo oculto y **antes** del `return {status:
        'ready', value: resolvedReference.value}` final, insertar:
        ```ts
        if (
          resolvedReference.value === '' &&
          emptySubmitValues !== undefined &&
          resolvedReference.reference.namespace === 'forms' &&
          resolvedReference.reference.path.length === 2 &&
          resolvedReference.reference.path[0] === emptySubmitValues.formId &&
          emptySubmitValues.valuesByFieldId.has(resolvedReference.reference.path[1])
        ) {
          return {
            status: 'ready',
            value: String(emptySubmitValues.valuesByFieldId.get(resolvedReference.reference.path[1])),
          } as const
        }
        ```
      - Destructurar `emptySubmitValues` de `options` junto a `state, iterationContext, hiddenFormFields` (línea 35).
      - No tocar la rama `resolvedReference.status === 'missing'`: la sustitución solo aplica cuando la referencia
        resuelve con éxito a `''`, no cuando el campo no existe.
      - En `resolveHeaderTemplateValue` (función interna, rama de interpolación con `{{...}}`, líneas ~325-459):
        - Destructurar `emptySubmitValues` de `options` junto a `state, iterationContext, hiddenFormFields` (línea
          338).
        - Dentro de la rama `if (result.status === 'resolved')` (líneas ~409-454), **después** del `if` existente que
          decide `shouldOmit = true` por campo oculto y **antes** de calcular `let finalValue: unknown =
          result.value`, sustituir el valor base cuando aplique:
          ```ts
          let finalValue: unknown =
            result.value === '' &&
            emptySubmitValues !== undefined &&
            result.reference.namespace === 'forms' &&
            result.reference.path.length === 2 &&
            result.reference.path[0] === emptySubmitValues.formId &&
            emptySubmitValues.valuesByFieldId.has(result.reference.path[1])
              ? String(emptySubmitValues.valuesByFieldId.get(result.reference.path[1]))
              : result.value
          ```
          (sustituye la declaración `let finalValue: unknown = result.value` existente; el resto del bloque —
          aplicación de `formatters`, chequeos de tipo final — no cambia).
    - `src/queries/runtime-api-request.ts`:
      - En `buildRuntimeApiRequest` (líneas ~40-70): añadir `emptySubmitValues` a la desestructuración de parámetros
        y pasarlo en la llamada a `buildInlineRuntimeApiRequest`, junto a `hiddenFormFields`.
      - En `buildInlineRuntimeApiRequest` (líneas ~72-82): añadir `emptySubmitValues` a la desestructuración de
        parámetros y añadirlo al objeto `resolveOptions = { state, iterationContext, hiddenFormFields }` (línea 82)
        → `{ state, iterationContext, hiddenFormFields, emptySubmitValues }`. Este único objeto ya se reutiliza para
        `resolveQuery`, `resolveBody` y `resolveHeaders`, por lo que no hace falta tocar esas tres funciones.
- **Fuera de alcance**:
  - Calcular `emptySubmitValues` a partir de un `SelectLayoutNode` real o de `node.children` (queda para `0121-T3`).
  - Threading de la opción a través de `executeQueryOperation`, `executeQueryOperationWithSnapshot` o
    `form-layout-node.tsx` (queda para `0121-T3`).
  - Cualquier cambio en `resolveRuntimeReference` o en `runtime-references/` (la sustitución vive enteramente en
    `src/queries/`, como post-procesado del resultado ya resuelto).
  - Cambios en la lógica de omisión por campo oculto ya existente.
  - Actualizar documentación funcional (queda para `update-app-documentation` posterior).
- **Dependencias**: ninguna a nivel de compilación (el tipo `RuntimeApiEmptySubmitValues` es propio de
  `src/queries/`), pero se implementa después de `0121-T1` siguiendo el orden secuencial del plan.
- **Impacto esperado en archivos**:
  - Código:
    - `src/queries/runtime-api-types.ts` (nuevo tipo `RuntimeApiEmptySubmitValues`, opciones de build)
    - `src/queries/runtime-api-payload-resolver.ts` (`ResolvePayloadValueOptions`, `resolvePayloadValue`,
      `resolveHeaderTemplateValue`)
    - `src/queries/runtime-api-request.ts` (`buildRuntimeApiRequest`, `buildInlineRuntimeApiRequest`)
  - Tests:
    - `src/tests/runtime/runtime-api-empty-submit-value.test.ts` (nuevo)
  - Documentación: ninguna — cambio interno de `src/queries/` sin superficie de comportamiento observable hasta que
    `0121-T3` lo conecta.
- **Tests**:
  - **Ficheros de test**:
    - `src/tests/runtime/runtime-api-empty-submit-value.test.ts` (nuevo) — seguir el mismo patrón de test unitario
      directo sobre el resolvedor que usa `src/tests/runtime/runtime-api-payload-omission.test.ts` para la omisión
      por campo oculto (construir `RuntimeState`/`RuntimeApiOperation` mínimos y llamar a
      `buildInlineRuntimeApiRequest`/`resolveBody`/`resolveHeaders` directamente, sin montar componentes React).
  - **Comportamiento cubierto**:
    - Con `emptySubmitValues: { formId, valuesByFieldId: new Map([['field', 'N/A']]) }` y el store con
      `forms.{formId}.field = ''`, una referencia `forms.{formId}.field` en `body` resuelve a `"N/A"` (string).
    - Mismo caso con `valuesByFieldId: new Map([['field', 0]])` resuelve a `"0"` (string, no se omite ni se trata
      como falsy).
    - Mismo caso con `valuesByFieldId: new Map([['field', '']])` (sustitución declarada vacía) resuelve a `""` — sin
      diferencia observable respecto a no declarar sustitución.
    - Con el store con `forms.{formId}.field = 'realValue'` (valor efectivo no vacío), la sustitución no aplica: la
      referencia resuelve a `"realValue"` aunque `emptySubmitValues` incluya `field`.
    - Sin `emptySubmitValues` (opción `undefined`), el comportamiento es exactamente el actual: `''` resuelve a
      `''`.
    - `emptySubmitValues` con un `formId` distinto al de la referencia no sustituye (scoping por formulario).
    - `emptySubmitValues.valuesByFieldId` sin entrada para el `fieldId` referenciado no sustituye.
    - La sustitución aplica igual en `body`, en `query` (vía `buildInlineRuntimeApiRequest`) y en `headers` sin
      interpolación (valor exacto de referencia, sin `{{...}}`).
    - La sustitución aplica en `headers` **con** interpolación (`"Bearer {{forms.{formId}.field}}"`): el resultado
      final del header contiene el valor sustituido concatenado con el resto del string literal.
    - Precedencia: si el mismo campo está en `hiddenFormFields` (oculto) y en `emptySubmitValues.valuesByFieldId` a
      la vez, el resultado es `status: 'omit'` — la omisión por campo oculto gana y la sustitución nunca reintroduce
      la clave, tanto en la rama sin interpolación (`resolvePayloadValue`) como en la rama con interpolación de
      headers (`resolveHeaderTemplateValue`).
  - **Comandos durante la implementación**:
    - `pnpm test --run src/tests/runtime/runtime-api-empty-submit-value.test.ts`
    - `pnpm test` (una vez al cierre, para confirmar la suite global y el gate de cobertura)
  - **Restricciones**:
    - Reutilizar los helpers de construcción de `RuntimeState`/`RuntimeApiOperation` ya presentes en
      `runtime-api-payload-omission.test.ts` si son directamente importables; si no lo son, replicar el mismo estilo
      mínimo sin montar React ni `@testing-library/react`.
    - No introducir snapshots.
- **Documentación afectada**: ninguno en esta tarea (ver `0121-T3`).
- **Criterios de finalización**:
  - `RuntimeApiEmptySubmitValues` existe y está enlazado en `BuildRuntimeApiRequestOptions`,
    `BuildInlineRuntimeApiRequestOptions` y `ResolvePayloadValueOptions`.
  - `resolvePayloadValue` y `resolveHeaderTemplateValue` sustituyen `''` por el valor normalizado a string cuando
    aplica, respetando la precedencia de campo oculto.
  - Todos los tests nuevos del fichero `runtime-api-empty-submit-value.test.ts` en verde.
  - `pnpm test` (suite completa) en verde sin bajar el umbral de cobertura global del 80%.
- **Cierre de implementación**:
  - El resolvedor de `src/queries/` soporta la sustitución de extremo a extremo cuando se le pasa `emptySubmitValues`
    manualmente; los tests declarados arriba pasan; la suite global sigue en verde. El comportamiento todavía no es
    alcanzable desde un `select` real hasta el cierre de `0121-T3`.

---

## Task 0121-T3 — Cómputo desde el árbol de layout y wiring end-to-end

- **ID**: 0121-T3
- **Estado**: pending
- **Objetivo**: Calcular, en el momento del submit de `form-layout-node.tsx`, el mapa `fieldId → emptySubmitValue`
  para los nodos `select` de selección simple del subárbol del formulario que declaren el prop, construir el
  `RuntimeApiEmptySubmitValues` scoped al `formId` y pasarlo junto a `hiddenFormFields` por toda la cadena de
  ejecución de la operación hasta el resolvedor de `0121-T2`, dejando el comportamiento alcanzable end-to-end desde
  un config real.
  - Cambios concretos:
    - `src/runtime/nodes/form-layout-node.tsx`:
      - Añadir una función local nueva, siguiendo el mismo patrón recursivo que `collectHiddenNodeFieldIds` (líneas
        ~560-593: recorre `container` vía `children`, `repeater` vía `props.template`, `tabs` vía
        `props.items[].children`):
        ```ts
        /**
         * Collects the configured `emptySubmitValue` for every simple-selection
         * `select` field in the form subtree, keyed by fieldId.
         */
        function collectSelectEmptySubmitValues(nodes: LayoutNodeCollection): Map<string, string | number> {
          const valuesByFieldId = new Map<string, string | number>()

          for (const node of nodes) {
            if (node.type === 'container') {
              for (const [id, value] of collectSelectEmptySubmitValues(node.children ?? [])) {
                valuesByFieldId.set(id, value)
              }
              continue
            }

            if (node.type === 'repeater') {
              for (const [id, value] of collectSelectEmptySubmitValues(node.props.template)) {
                valuesByFieldId.set(id, value)
              }
              continue
            }

            if (node.type === 'tabs') {
              for (const item of node.props.items) {
                for (const [id, value] of collectSelectEmptySubmitValues(item.children ?? [])) {
                  valuesByFieldId.set(id, value)
                }
              }
              continue
            }

            if (node.type === 'select' && node.props.multiple !== true && node.props.emptySubmitValue !== undefined) {
              valuesByFieldId.set(node.props.fieldId, node.props.emptySubmitValue)
            }
          }

          return valuesByFieldId
        }
        ```
      - Junto al cómputo de `hiddenFormFields` (líneas ~250-256), añadir:
        ```ts
        const emptySubmitValueByFieldId = collectSelectEmptySubmitValues(node.children ?? [])
        const emptySubmitValues: RuntimeApiEmptySubmitValues | undefined =
          emptySubmitValueByFieldId.size > 0
            ? { formId: node.id, valuesByFieldId: emptySubmitValueByFieldId }
            : undefined
        ```
      - Importar `RuntimeApiEmptySubmitValues` desde `'../../queries/runtime-api-types'` (mismo módulo que ya provee
        `RuntimeApiHiddenFormFields` en este fichero).
      - Pasar `emptySubmitValues` junto a `hiddenFormFields` en ambas llamadas a `executeQueryOperation`: la rama
        `executeOperations` (línea ~277, dentro de `filteredOperations.map(...)`) y la rama `executeOperation`
        (línea ~308).
    - `src/runtime/runtime-state/use-runtime-state.ts`:
      - Añadir `emptySubmitValues?: RuntimeApiEmptySubmitValues` al tipo del parámetro `options` de
        `executeQueryOperation` (líneas ~303-310, junto a `hiddenFormFields`).
      - Pasar `emptySubmitValues: options?.emptySubmitValues` en la llamada a `executeQueryOperationWithSnapshot`
        (líneas ~316-326, junto a `hiddenFormFields: options?.hiddenFormFields`).
      - Importar `RuntimeApiEmptySubmitValues` si el fichero no lo importa ya.
    - `src/runtime/runtime-state/runtime-state-query-execution.ts`:
      - Añadir `emptySubmitValues` a la desestructuración de parámetros y al tipo de `executeQueryOperationWithSnapshot`
        (líneas ~94-116, junto a `hiddenFormFields`).
      - Pasar `emptySubmitValues` en la llamada a `buildRuntimeApiRequest` (líneas ~142-149, junto a
        `hiddenFormFields`).
      - Importar `RuntimeApiEmptySubmitValues` si el fichero no lo importa ya.
- **Fuera de alcance**:
  - Cualquier cambio en el store, en el render de `select` o en el estado visible del campo (el store y la UI siguen
    en `''`/placeholder; ver criterios de aceptación de la spec).
  - Cualquier cambio en `resetForm`, `visibility`, `queryStateFeedback` o en la resolución de `defaultValue` de otros
    campos.
  - Cambios en la lógica de sustitución del resolvedor en sí (ya cerrada en `0121-T2`).
  - Actualizar documentación funcional más allá de lo declarado en "Documentación afectada" — la actualización en sí
    queda para `update-app-documentation` posterior.
- **Dependencias**: `0121-T1` (tipo/validación de `select.props.emptySubmitValue`) y `0121-T2` (mecanismo de
  sustitución en el resolvedor) cerrados. Sin `0121-T1` el nodo no tipa `props.emptySubmitValue`; sin `0121-T2` el
  resolvedor ignoraría la opción `emptySubmitValues` aunque se le pasara.
- **Impacto esperado en archivos**:
  - Código:
    - `src/runtime/nodes/form-layout-node.tsx` (nueva función `collectSelectEmptySubmitValues`, cómputo y wiring en
      ambas ramas de submit)
    - `src/runtime/runtime-state/use-runtime-state.ts` (`executeQueryOperation`: tipo de opciones y passthrough)
    - `src/runtime/runtime-state/runtime-state-query-execution.ts` (`executeQueryOperationWithSnapshot`: tipo de
      parámetros y passthrough a `buildRuntimeApiRequest`)
  - Tests:
    - `src/tests/runtime/runtime-form-submit-empty-select-fallback.test.tsx` (nuevo)
  - Documentación:
    - `ai-workflow/docs/app-features/nodes/select.md`
    - `ai-workflow/docs/app-features/forms/submit.md`
    - `ai-workflow/docs/test-index.md`
- **Tests**:
  - **Ficheros de test**:
    - `src/tests/runtime/runtime-form-submit-empty-select-fallback.test.tsx` (nuevo) — end-to-end, siguiendo el mismo
      patrón de montaje/submit real que `src/tests/runtime/runtime-form-submit-hidden-fields.test.tsx` (render de
      `form` con `select` real, disparo de submit nativo, aserción sobre el payload capturado por el `fetch` mock).
  - **Comportamiento cubierto**:
    - Criterio de aceptación 1: `select` simple sin selección y con `emptySubmitValue` configurado → el payload de
      submit (`api.body`) contiene el valor de sustitución normalizado a string en vez de `''`.
    - Criterio de aceptación 2 (regresión): mismo `select` sin `emptySubmitValue` configurado → el payload sigue
      conteniendo `''`.
    - Criterio de aceptación 3: `select` simple con una opción realmente seleccionada → el payload contiene el valor
      seleccionado, con y sin `emptySubmitValue` declarado (sin diferencia).
    - Criterio de aceptación 4: `emptySubmitValue` configurado a un valor ausente de `props.items` (dinámicos o
      manuales) → bootstrap acepta el config y el submit sustituye igualmente cuando el campo está vacío.
    - Criterio de aceptación 5: `select` con `props.validations.required: true` y `emptySubmitValue` configurado y
      campo vacío → el submit se bloquea por validación local (no se dispara ninguna operación de red); el prop no
      elude `required`.
    - Criterio de aceptación 6: `select.props.multiple: true` con `emptySubmitValue` declarado → el config completo
      se rechaza en bootstrap (regresión de `0121-T1`, verificar también end-to-end en este fichero con un config de
      integración completo).
    - Criterio de aceptación 7: otro campo del formulario cuyo `defaultValue` dinámico referencia
      `forms.{formId}.{fieldId}` del `select` vacío con `emptySubmitValue` configurado → ese otro campo sigue
      resolviendo `''` en su valor efectivo (no ve el valor de sustitución).
    - Caso límite: `emptySubmitValue: 0` → se envía como `"0"` (string), verificado en el payload real capturado por
      el mock de `fetch`.
    - Caso límite: `emptySubmitValue: ''` declarado explícitamente → comportamiento observable idéntico a no
      declarar el prop (`''` en el payload).
    - Caso límite: el `select` con `emptySubmitValue` configurado está oculto por `visibility` en el momento del
      submit → la clave se omite del payload igual que cualquier otro campo oculto; la sustitución nunca reintroduce
      la clave.
    - Caso límite: el campo pasa de tener una selección real a quedar vacío antes del submit (la opción seleccionada
      desaparece de una colección dinámica tras refrescar `queries.*`) → en ese momento el valor efectivo es `''` y
      la sustitución aplica con normalidad.
    - Cobertura de la superficie completa del payload: la sustitución se verifica al menos una vez en `api.body`, una
      vez en `api.query` y una vez en `submitAction.headers` (con interpolación `{{...}}`), para no depender solo de
      la cobertura unitaria de `0121-T2`.
    - Regresión explícita (NFR de la spec): un test que documente que el store (`selectFormFieldState` o snapshot
      equivalente) y el DOM del `<select>` siguen mostrando `''`/placeholder tras el submit, aunque el payload
      enviado contuviera el valor de sustitución.
    - Regresión: un formulario con `select` sin `emptySubmitValue` en absoluto mantiene exactamente el mismo
      comportamiento de submit que antes de esta feature (sin diffs de payload).
  - **Comandos durante la implementación**:
    - `pnpm test --run src/tests/runtime/runtime-form-submit-empty-select-fallback.test.tsx`
    - `pnpm test --run src/tests/runtime/runtime-api-empty-submit-value.test.ts` (sanity check de no regresión sobre
      `0121-T2`)
    - `pnpm test --run src/tests/config-validation/runtime-config-validation-form-fields.test.ts` (sanity check de no
      regresión sobre `0121-T1`)
    - `pnpm test` (una vez al cierre, para confirmar la suite global y el gate de cobertura)
  - **Restricciones**:
    - Reutilizar el harness de montaje de formulario y el mock de `fetch`/captura de request ya usado en
      `runtime-form-submit-hidden-fields.test.tsx`; no crear un harness paralelo.
    - No introducir snapshots.
- **Documentación afectada**:
  - `ai-workflow/docs/app-features/nodes/select.md` — cerrar la documentación de `emptySubmitValue` iniciada en
    `0121-T1` con el comportamiento de submit real (esta tarea es la que lo hace observable).
  - `ai-workflow/docs/app-features/forms/submit.md` — añadir la sustitución de `emptySubmitValue` como parte de la
    construcción del payload efectivo, incluyendo su precedencia frente a la omisión de campos ocultos.
  - `ai-workflow/docs/test-index.md` — registrar los ficheros de test nuevos de `0121-T2` y `0121-T3`.
- **Criterios de finalización**:
  - Todos los criterios de aceptación y casos límite de `spec.md` están cubiertos por tests y en verde.
  - El comportamiento es alcanzable end-to-end desde un config real (`select` con `emptySubmitValue` en un `form`
    montado, submit real, payload de red observado).
  - `pnpm test` (suite completa) en verde sin bajar el umbral de cobertura global del 80%.
- **Cierre de implementación**:
  - El wiring completo está en el árbol; todos los tests de `0121-T1`, `0121-T2` y `0121-T3` pasan; la suite global
    sigue en verde. La feature queda funcionalmente completa y lista para la pasada documental posterior.
