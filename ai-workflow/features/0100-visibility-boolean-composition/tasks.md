# Tasks: Feature 0100 - visibility-boolean-composition

## Contexto rápido

Cerrado en `spec.md` y `design.md`:
- Contrato: `visibility`/`when` acepta **condición simple** (con `negate?` opcional) o **grupo compuesto** `{ operator: 'and' | 'or', conditions: [condición simple, ...] }`. Un solo nivel; sin negación de grupo; sin nuevos operadores ni familias de referencia.
- Estrategia técnica: unión discriminada Zod por `operator` (D1); rechazo de anidamiento por tipar `conditions` con la rama de condición simple (D2); tipos públicos en unión con type guard `isVisibilityGroup` compartido (D3, D4); validación semántica extraída a un helper de condición única invocado desde `validateVisibility` y `validateWhenCondition` (D5); `mapVisibilityIssue` sin cambios (D6); `matchesVisibilityRule` con un único nivel de indirección (D7).

Orden fijado por dependencia técnica: **T-1 → T-2 → T-3**.

- T-1 amplía tipos + evaluación runtime en el mismo cambio para no dejar un intermedio no compilable (la unión de `RuntimeVisibilityConfig` rompe la firma actual de `matchesVisibilityRule`, único punto fuera de la capa de validación según D3).
- T-2 introduce la unión discriminada Zod sobre el shape ya soportado por los tipos y el runtime.
- T-3 extiende la validación semántica reutilizando el type guard de T-1 y el shape de T-2 para iterar `conditions`.

Ninguna tarea es puramente documental. La actualización de fichas funcionales queda fuera de este contrato y se hace posteriormente vía `update-app-documentation`.

---

## T-1 — Tipos, type guard y evaluación runtime de composición + `negate`

- **ID**: T-1
- **Estado**: completada
- **Objetivo**: Introducir el shape de tipos de composición booleana (`RuntimeVisibilityGroupOperator`, `RuntimeVisibilityCondition`, `RuntimeVisibilityGroup`) en `runtime-config-types.ts`, ampliar `RuntimeVisibilityConfig` y `RuntimeWhenCondition` a unión discriminada (condición simple con `negate?` | grupo), añadir el type guard compartido `isVisibilityGroup`, y actualizar `matchesVisibilityRule` en `runtime-layout-visibility.ts` para evaluar grupos `and`/`or` con un único nivel de indirección y aplicar `negate` sobre el resultado individual de cada condición (incluidos los casos hoy degradados a "no coincide").
- **Fuera de alcance**:
  - Cambios en `runtime-config-zod.ts` (T-2).
  - Cambios en `validate-actions-visibility.ts` (T-3).
  - Cambios en `mapVisibilityIssue` (según D6 no requiere cambios).
- **Dependencias**: ninguna.
- **Impacto esperado en archivos**:
  - Código a modificar:
    - `src/config/runtime-config-types.ts` — introducir `RuntimeVisibilityGroupOperator`, `RuntimeVisibilityCondition` (con `negate?: boolean`), `RuntimeVisibilityGroup`, ampliar `RuntimeVisibilityConfig` (y alias `RuntimeWhenCondition`) a la unión, exportar `isVisibilityGroup`.
    - `src/runtime/runtime-layout-visibility.ts` — extender `matchesVisibilityRule` para manejar grupo (iterar `conditions` con `every`/`some` según `operator`) y aplicar `negate` en el resultado por condición.
  - Tests a crear/modificar:
    - `src/tests/runtime/runtime-layout-visibility.test.ts` — ampliación.
  - Documentación afectada (referencia, sin editar aquí):
    - `ai-workflow/docs/app-features/references/visibility.md`.
- **Tests**:
  - Ficheros de test:
    - `src/tests/runtime/runtime-layout-visibility.test.ts` (ampliación).
  - Comportamiento cubierto:
    - Grupo `and` de dos condiciones simples coincide **solo** cuando ambas coinciden; con una que no coincide, no coincide.
    - Grupo `or` de dos condiciones simples coincide cuando al menos una coincide; con ninguna que coincida, no coincide.
    - Grupo `and`/`or` con una sola condición se comporta igual que esa condición suelta.
    - Condición simple con `negate: true` sobre `equals`: invierte match ↔ no match respecto a `equals` sin `negate`.
    - Condición simple con `negate: true` sobre `isTruthy` con referencia ausente: pasa de "no coincide" a "coincide".
    - Condición simple con `negate: true` sobre `isFalsy` con referencia ausente: pasa de "coincide" a "no coincide".
    - Condición simple con `negate: true` sobre `greaterThan` con valor no comparable (string): pasa de "no coincide" (degradado) a "coincide".
    - Condición simple con `negate: true` sobre `lessThan` con valor no comparable (objeto/null): pasa de "no coincide" a "coincide".
    - Grupo `and` con una condición negada y otra sin negar: se combina el resultado individual (ya negado) con AND.
    - Grupo `or` con dos condiciones donde una tiene `negate: true`: se combina el resultado individual (ya negado) con OR.
    - Regresión: condición simple sin `negate` (todos los operadores, todas las familias de referencia) mantiene exactamente el comportamiento actual (los tests preexistentes del fichero siguen verdes sin cambios).
    - Regresión: `visibility` no declarada devuelve match (`true`) igual que hoy.
  - Comandos durante la implementación:
    - `pnpm test --run src/tests/runtime/runtime-layout-visibility.test.ts`
  - Restricciones:
    - Reusar los helpers de estado y fixtures ya existentes en `src/tests/runtime/runtime-layout-visibility.test.ts`. No introducir un harness nuevo.
    - No añadir tests puramente de tipos (los tipos se validan implícitamente al compilar el código y los tests).
- **Documentación afectada**: `ai-workflow/docs/app-features/references/visibility.md` (referencia; edición posterior fuera de `tasks.md`).
- **Criterios de finalización**:
  - Los tipos ampliados y el type guard `isVisibilityGroup` existen y son consumidos por `matchesVisibilityRule`.
  - `matchesVisibilityRule` compila con la nueva unión y evalúa grupos + `negate` según D7/D8.
  - `pnpm test --run src/tests/runtime/runtime-layout-visibility.test.ts` en verde.
  - `pnpm test` compila sin errores de tipos en el resto del proyecto (efecto colateral esperado y acotado a este fichero, según D3).
- **Cierre de implementación**: tipos, type guard y evaluación runtime implementados; tests de la tarea verdes; `pnpm test` no rompe por cambios de tipos fuera del alcance.

---

## T-2 — Shape Zod: unión discriminada por `operator`

- **ID**: T-2
- **Estado**: completada
- **Objetivo**: Reescribir `visibilitySchema` en `src/config/runtime-config-zod.ts` como unión discriminada por `operator` entre `visibilityConditionSchema` (rama simple con `reference`, `operator ∈ supportedVisibilityOperators`, `value?`, `negate?: z.boolean().optional()`) y `visibilityGroupSchema` (rama grupo con `operator ∈ supportedVisibilityGroupOperators = ['and', 'or']` y `conditions: z.array(visibilityConditionSchema).min(1)`). Añadir `supportedVisibilityGroupOperators` como const junto a `supportedVisibilityOperators`. Mantener `whenConditionSchema` como alias de `visibilitySchema`. `conditions` **debe** tipar sus elementos con `visibilityConditionSchema` (rama simple), no con la unión, para que un anidamiento falle automáticamente contra el shape simple (D2).
- **Fuera de alcance**:
  - Validación semántica en `validate-actions-visibility.ts` (T-3).
  - Cambios en tipos y en el runtime eval (T-1).
  - Cambios en `mapVisibilityIssue`.
- **Dependencias**: T-1 (los tipos ampliados ya deben existir para que el schema tipe correctamente contra ellos).
- **Impacto esperado en archivos**:
  - Código a modificar:
    - `src/config/runtime-config-zod.ts` — añadir `supportedVisibilityGroupOperators`, introducir `visibilityConditionSchema` y `visibilityGroupSchema`, sustituir `visibilitySchema` por `z.discriminatedUnion('operator', [...])`. Todos los ~30 usos de `visibilitySchema.optional()` siguen intactos.
  - Tests a modificar:
    - `src/tests/config-validation/runtime-config-validation-visibility.test.ts` (ampliación).
  - Documentación afectada (referencia, sin editar aquí):
    - `ai-workflow/docs/app-features/references/visibility.md`.
- **Tests**:
  - Ficheros de test:
    - `src/tests/config-validation/runtime-config-validation-visibility.test.ts` (ampliación).
  - Comportamiento cubierto:
    - Aceptación de grupo `and` con una condición simple válida (`{ operator: 'and', conditions: [{ reference: 'params.mode', operator: 'isTruthy' }] }`).
    - Aceptación de grupo `or` con dos condiciones simples válidas.
    - Aceptación de condición simple con `negate: true`.
    - Aceptación de condición simple con `negate: false`.
    - Rechazo de condición simple con `negate` no booleano (string, número): mensaje señala ruta `visibility.negate`.
    - Rechazo de grupo con `conditions: []` (array vacío): mensaje señala ruta `visibility.conditions`.
    - Rechazo de grupo con `operator` fuera de `and | or` y también fuera del catálogo de condición simple (p. ej. `"xyz"`): mensaje señala ruta `visibility.operator`.
    - Rechazo de grupo con `operator` ausente: mensaje señala ruta `visibility.operator`.
    - Rechazo de grupo anidado: un elemento de `conditions` con forma de grupo (`{ operator: 'and', conditions: [...] }`) hace que el config se rechace con ruta que empiece por `visibility.conditions[0]` (falla contra el shape de condición simple: `reference` ausente y/o `operator` fuera de catálogo simple).
    - Rechazo de condición dentro de `conditions` que incumple reglas de shape ya vigentes:
      - `operator` fuera del catálogo de condición simple, ruta `visibility.conditions[0].operator`.
      - `reference` ausente o vacío, ruta `visibility.conditions[0].reference`.
    - Rechazo de condición dentro de `conditions` con `negate` no booleano, ruta `visibility.conditions[0].negate`.
    - Retrocompatibilidad de shape: condición simple existente (sin `negate`, sin `conditions`) sigue siendo aceptada y sigue rechazando exactamente igual que antes ante shape inválido (los tests preexistentes siguen verdes sin cambios).
  - Comandos durante la implementación:
    - `pnpm test --run src/tests/config-validation/runtime-config-validation-visibility.test.ts`
  - Restricciones:
    - Reusar `src/tests/config-validation/helpers.ts` para construir configs mínimos.
    - No añadir cobertura semántica en esta tarea; T-3 se encarga de la validación de familia de referencia y `value` según operador.
    - Los tests de esta tarea sólo verifican que la validación del **shape** produce el resultado esperado (aceptación/rechazo y ruta del mensaje). No verifican comportamiento en runtime.
- **Documentación afectada**: `ai-workflow/docs/app-features/references/visibility.md` (referencia; edición posterior fuera de `tasks.md`).
- **Criterios de finalización**:
  - `visibilitySchema` es una `z.discriminatedUnion('operator', [...])` con ramas simple y grupo, y `whenConditionSchema` sigue siendo alias.
  - Los ~30 puntos existentes que usan `visibilitySchema.optional()` compilan y siguen aceptando condición simple igual que antes.
  - `pnpm test --run src/tests/config-validation/runtime-config-validation-visibility.test.ts` en verde.
- **Cierre de implementación**: schema Zod actualizado; tests de shape verdes.

---

## T-3 — Validación semántica: iteración de `conditions` en `validateVisibility` y `validateWhenCondition`

- **ID**: T-3
- **Estado**: completada
- **Objetivo**: En `src/config/validate-actions-visibility.ts`, extraer la lógica semántica de condición única (validez de `reference` por familia; presencia/tipo de `value` según `operator`; rechazo de `tokens.*`) a un helper interno parametrizado por el validador de referencia aplicable. `validateVisibility` invoca el helper con `isValidVisibilityReference`; `validateWhenCondition` lo invoca con `isValidWhenReference` respetando `options.allowItem`. Cuando el shape recibido es grupo (comprobado con `isVisibilityGroup` de T-1), ambas funciones iteran `conditions` aplicando el helper a cada elemento con path `${path}.conditions[${index}]` y cortan al primer error. Cuando es condición simple, aplican el helper una única vez con el `path` recibido (comportamiento actual, sin cambios de mensaje ni de reglas). No fusionar `validateVisibility` y `validateWhenCondition` en una única función (D5 trade-off aceptado).
- **Fuera de alcance**:
  - Cambios en tipos, Zod o runtime eval (T-1, T-2).
  - Cambios de mensajes o reglas para el caso de condición simple (retrocompatibles).
  - Deduplicar o rechazar combinaciones lógicamente redundantes o contradictorias.
- **Dependencias**: T-1 (type guard `isVisibilityGroup`), T-2 (shape Zod ya acepta el grupo; el semántico se ejecuta después de que el shape parseó correctamente).
- **Impacto esperado en archivos**:
  - Código a modificar:
    - `src/config/validate-actions-visibility.ts` — extraer helper interno de condición única, adaptar `validateVisibility` y `validateWhenCondition` para iterar sobre grupo.
  - Tests a modificar:
    - `src/tests/config-validation/runtime-config-validation-visibility.test.ts` (ampliación).
    - `src/tests/config-validation/runtime-config-validation-preloads.test.ts` (ampliación).
    - `src/tests/config-validation/runtime-config-validation-buttons.test.ts` (ampliación).
    - `src/tests/config-validation/runtime-config-validation-forms-semantics.test.ts` (ampliación).
    - `src/tests/config-validation/runtime-config-validation-forms-validations.test.ts` (ampliación).
  - Documentación afectada (referencia, sin editar aquí):
    - `ai-workflow/docs/app-features/references/visibility.md`.
    - `ai-workflow/docs/app-features/references/index.md`.
- **Tests**:
  - Ficheros de test:
    - `src/tests/config-validation/runtime-config-validation-visibility.test.ts` (ampliación) — `node.visibility`.
    - `src/tests/config-validation/runtime-config-validation-preloads.test.ts` (ampliación) — `pages[].preloads[*].when` (única superficie con `allowItem: false`).
    - `src/tests/config-validation/runtime-config-validation-buttons.test.ts` (ampliación) — `button.props.action.operations[*].when` (dentro de `executeOperations`).
    - `src/tests/config-validation/runtime-config-validation-forms-semantics.test.ts` (ampliación) — `form.submitAction.onSuccess[*].when` (bloque T5 ya presente en el fichero).
    - `src/tests/config-validation/runtime-config-validation-forms-validations.test.ts` (ampliación) — `form.validations.*.when` (rules por campo).
  - Comportamiento cubierto:
    - En `node.visibility`, grupo con condición interna cuya `reference` no cumple `isValidVisibilityReference` (p. ej. `foo.bar`, `params` sin segmento, `params.user.id` con dos segmentos): rechazo con ruta `visibility.conditions[N].reference`.
    - En `node.visibility`, grupo con condición interna `equals` sin `value`: rechazo con ruta `visibility.conditions[N].value`.
    - En `node.visibility`, grupo con condición interna `equals` con `value` no escalar (objeto/array): rechazo con ruta `visibility.conditions[N].value`.
    - En `node.visibility`, grupo con condición interna `greaterThan` con `value` no numérico: rechazo con ruta `visibility.conditions[N].value`.
    - En `node.visibility`, grupo con condición interna `isTruthy` con `value` declarado: rechazo con ruta `visibility.conditions[N].value`.
    - En `node.visibility`, grupo con condición interna cuya `reference` es `tokens.*`: rechazo con ruta `visibility.conditions[N].reference` y mensaje coherente con el ya existente para el caso simple.
    - En `node.visibility`, grupo aceptado con dos condiciones simples válidas usando familias distintas (`params.*` + `queries.*.data.*`).
    - En `pages[].preloads[*].when`, grupo aceptado con dos condiciones válidas (una con `params.*`, otra con `queries.*`).
    - En `pages[].preloads[*].when`, grupo con condición interna inválida: rechazo con ruta `pages[N].preloads[M].when.conditions[K].<segmento>`.
    - En `pages[].preloads[*].when` (propagación de `allowItem: false` dentro del grupo — única superficie que restringe `item`, verificado en `validate-preloads.ts:104`): grupo con condición interna cuya `reference` es `item` o `item.foo` es rechazado con ruta `pages[N].preloads[M].when.conditions[K].reference`.
    - En `button.props.action.operations[*].when` (dentro de `executeOperations`), grupo aceptado con condiciones válidas.
    - En `button.props.action.operations[*].when`, grupo con condición interna inválida: rechazo con ruta que apunte a `operations[N].when.conditions[K].<segmento>`.
    - En `form.submitAction.onSuccess[*].when`, grupo aceptado con dos condiciones válidas (`params.*` + `queries.*`).
    - En `form.submitAction.onSuccess[*].when` (propagación de `allowItem: true` dentro del grupo, verificado en `validate-actions-visibility.ts:255`): grupo aceptado con condición interna cuya `reference` es `item.foo`.
    - En `form.submitAction.onSuccess[*].when`, grupo con condición interna inválida (p. ej. `equals` sin `value`): rechazo con ruta señalando `submitAction.onSuccess[N].when.conditions[K].<segmento>`.
    - En `form.validations.*.when`, grupo aceptado con condición válida (rule `required`/`minLength`/`pattern` a elegir).
    - En `form.validations.*.when`, grupo con condición interna inválida: rechazo con ruta señalando `...validations.<rule>.when.conditions[K].<segmento>`.
    - Retrocompatibilidad: los tests preexistentes de condición simple en los cinco ficheros siguen verdes sin cambios (mismo mensaje y misma ruta para el caso simple).
  - Comandos durante la implementación:
    - `pnpm test --run src/tests/config-validation/runtime-config-validation-visibility.test.ts`
    - `pnpm test --run src/tests/config-validation/runtime-config-validation-preloads.test.ts`
    - `pnpm test --run src/tests/config-validation/runtime-config-validation-buttons.test.ts`
    - `pnpm test --run src/tests/config-validation/runtime-config-validation-forms-semantics.test.ts`
    - `pnpm test --run src/tests/config-validation/runtime-config-validation-forms-validations.test.ts`
  - Restricciones:
    - Reusar `src/tests/config-validation/helpers.ts` y los harness locales de cada fichero para construir configs mínimos; no duplicar builders.
    - Mantener nombres y mensajes de error existentes para el caso de condición simple; los tests preexistentes son gate de regresión.
    - `allowItem` en las cinco superficies actuales, ya verificado: `preloads[].when` usa `allowItem: false` (`validate-preloads.ts:104`); `submitAction.onSuccess[*].when`, `submitAction.onError[*].when`, `operations[*].when` y `form.validations.*.when` usan `allowItem: true`. La caracterización positiva (`item.*` aceptado) va en la superficie `submitAction.onSuccess`; la negativa (`item.*` rechazado) va en `preloads[].when`. No repetir las dos direcciones en cada fichero.
- **Documentación afectada**: `ai-workflow/docs/app-features/references/visibility.md`, `ai-workflow/docs/app-features/references/index.md` (referencia; edición posterior fuera de `tasks.md`).
- **Criterios de finalización**:
  - `validateVisibility` y `validateWhenCondition` iteran `conditions` cuando el shape es grupo, delegando en el helper compartido y cortando al primer error.
  - Los cinco ficheros de test señalados están en verde tras la ampliación.
  - Suite global (`pnpm test`) verde, y el umbral global de cobertura del 80% sigue cumpliéndose.
- **Cierre de implementación**: validación semántica extendida a grupo; tests de las cinco superficies (`node.visibility`, `preloads[].when`, `operations[].when`, `submitAction.onSuccess[].when`, `form.validations.*.when`) verdes; suite global en verde con cobertura ≥ 80%.

---

## Siguiente tarea a escoger

**T-1**. Es la única sin dependencias y desbloquea T-2 (necesita los tipos ampliados) y T-3 (necesita el type guard `isVisibilityGroup`).
