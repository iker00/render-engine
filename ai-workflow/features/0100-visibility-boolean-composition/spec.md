# Spec: Composición booleana en `visibility`

## Objetivo

Permitir que `visibility` (y los predicados `when` que reutilizan su mismo shape) expresen una combinación de varias
condiciones simples mediante `and`/`or`, en lugar de estar limitados a una única condición. El objetivo es desbloquear
escenarios de UI condicional más ricos ("visible si se cumplen todas estas condiciones" o "visible si se cumple alguna
de estas") sin introducir un lenguaje de expresiones genérico.

## Contexto

Hoy `visibility` (definido originalmente en la feature `0019-declarative-runtime-visibility-rules`) es un único objeto
`{ reference, operator, value? }`. Esa misma feature, y su ampliación posterior `0074-visibility-params-reference`,
excluyeron explícitamente la composición booleana como fuera de alcance. Esta feature revisa esa decisión y añade
composición de un solo nivel.

El mismo shape de condición (`whenConditionSchema`) se reutiliza hoy en cuatro superficies del runtime:

- `node.visibility` (transversal a todos los nodos que lo soportan).
- `form.submitAction.onSuccess[*].when`.
- `pages[].preloads[*].when`.
- `button.props.action.operations[*].when` (y su equivalente en `form.submitAction`).

## Alcance

- Un valor de `visibility` (o `when`) puede seguir siendo una **condición simple** (shape actual, sin cambios) o pasar a
  ser un **grupo compuesto**:
  ```json
  { "operator": "and" | "or", "conditions": [ <condición simple>, ... ] }
  ```
- `operator` actúa como discriminador compartido: en una condición simple mantiene su catálogo actual (
  `equals | notEquals | isTruthy | isFalsy | greaterThan | lessThan`); en un grupo toma exclusivamente `and` o `or`.
- `conditions` es un array no vacío de condiciones simples (mismo shape y mismas reglas de validación que la condición
  simple actual). No admite anidar otro grupo dentro de `conditions`: un solo nivel de composición.
- Cada condición simple —tanto suelta como dentro de un grupo— admite un campo opcional `negate: boolean` que invierte
  su resultado de coincidencia final, incluyendo los casos hoy degradados a "no coincide" (referencia ausente, valor no
  comparable en `greaterThan`/`lessThan`).
- `and`: el grupo coincide solo si **todas** sus condiciones (tras aplicar `negate` a cada una) coinciden.
- `or`: el grupo coincide si **al menos una** de sus condiciones (tras aplicar `negate` a cada una) coincide.
- La composición aplica por igual a las cuatro superficies que hoy comparten `whenConditionSchema` (`visibility` y los
  tres `when`).
- Config existente con condición simple sigue siendo válida y se comporta exactamente igual que hoy (retrocompatible sin
  migración).
- La precedencia existente entre `queryStateFeedback` y `visibility` no cambia: sigue siendo ortogonal a si `visibility`
  es una condición simple o un grupo.

## Fuera de alcance

- Anidar grupos o mezclar `and`/`or` dentro de la misma regla (p. ej. `(A and B) or C`). Requeriría más de un nivel de
  composición.
- Negación a nivel de grupo completo (un `not` que invierta el resultado combinado de todas las condiciones a la vez).
  La negación vive únicamente por condición individual (`negate`).
- Nuevos operadores de comparación o nuevas familias de referencia. El catálogo de `operator` para condiciones simples y
  las referencias admitidas (`params.*`, `item.*`, `forms.*`, `queries.*`) no cambian.
- Cualquier forma de lenguaje de expresiones genérico (paréntesis, precedencia mixta, fórmulas).
- Deduplicar o rechazar combinaciones lógicamente redundantes o contradictorias (p. ej. `negate: true` sobre `isTruthy`
  equivalente a `isFalsy`, o dos condiciones contradictorias en el mismo `and`). Son responsabilidad de quien declara la
  configuración, no un error de validación.

## Requisitos funcionales

1. `whenConditionSchema` acepta dos shapes válidos:
    - Condición simple (sin cambios): `{ reference, operator, value?, negate? }`.
    - Grupo compuesto: `{ operator: "and" | "or", conditions: [condición simple, ...] }`.
2. El array `conditions` de un grupo debe tener al menos un elemento; un array vacío se rechaza.
3. Cada elemento de `conditions` se valida con las mismas reglas ya vigentes para una condición simple (catálogo de
   `operator`, presencia/ausencia obligatoria de `value` según operador, tipo de `value`, etc.), más la nueva regla de
   `negate`.
4. `negate` es opcional en cualquier condición simple (suelta o dentro de un grupo); si se declara, debe ser `boolean`.
5. La evaluación en runtime de una condición simple con `negate: true` produce el resultado booleano contrario al que
   produciría sin `negate`, para cualquier operador, incluyendo los casos hoy degradados a "no coincide" (referencia
   ausente o valor no comparable).
6. La evaluación de un grupo `and` combina con conjunción lógica el resultado (ya con `negate` aplicado) de cada
   condición de `conditions`.
7. La evaluación de un grupo `or` combina con disyunción lógica el resultado (ya con `negate` aplicado) de cada
   condición de `conditions`.
8. Las cuatro superficies que reutilizan `whenConditionSchema` (`node.visibility`, `submitAction.onSuccess[*].when`,
   `pages[].preloads[*].when`, `operations[*].when`) aceptan y evalúan igual tanto condición simple como grupo
   compuesto.
9. Un nodo que no declara `visibility` conserva su comportamiento actual sin cambios.
10. La interacción con `queryStateFeedback` no cambia: `queryStateFeedback` se resuelve primero, y `visibility` (simple
    o grupo) solo se evalúa cuando el resultado visible restante sigue siendo el nodo original.

## Requisitos no funcionales

- La validación de shape sigue ocurriendo antes del render (config completo rechazado ante un shape inválido),
  consistente con la política de errores del proyecto.
- Los mensajes de error de validación deben señalar la ruta exacta del grupo o de la condición dentro del grupo que
  incumple el contrato, con el mismo nivel de trazabilidad que ya existe para una condición simple (breadcrumb + ruta
  posicional, según `0096-improved-validation-error-messages`).
- No debe degradar el rendimiento de evaluación de `visibility` en configuraciones que solo usan condición simple (el
  camino existente no debe añadir coste apreciable cuando no hay grupo).
- Cobertura de tests debe mantener el umbral mínimo global del 80% sobre `src/`.

## Criterios de aceptación

- Un nodo con `visibility` de condición simple sin `negate` se comporta exactamente igual que antes de esta feature.
- Un nodo con `visibility` de grupo `and` de 2+ condiciones simples solo es visible cuando todas coinciden.
- Un nodo con `visibility` de grupo `or` de 2+ condiciones simples es visible cuando al menos una coincide.
- Una condición con `negate: true` invierte su resultado individual antes de combinarse en el grupo (o antes de
  determinarse su visibilidad, si va suelta).
- Un grupo con `conditions: []` (array vacío) hace que el config completo se rechace antes del render.
- Un grupo con `operator` fuera de `and | or` hace que el config completo se rechace antes del render.
- Una condición dentro de `conditions` que incumpla cualquier regla de validación ya vigente para condición simple (
  operador fuera de catálogo, `value` ausente/sobrante según operador, tipo de `value` incorrecto) hace que el config
  completo se rechace antes del render, señalando la ruta exacta dentro del grupo.
- `negate` con un valor no booleano hace que el config completo se rechace antes del render.
- Los tres `when` reutilizados (`onSuccess`, `preloads`, `operations`) aceptan grupo compuesto con el mismo
  comportamiento que `node.visibility`.
- Un grupo anidado dentro de `conditions` (un elemento que a su vez tiene `operator: "and"|"or"` + `conditions`) hace
  que el config completo se rechace antes del render, ya que el anidamiento no está soportado.
- La precedencia con `queryStateFeedback` se comporta igual con grupo compuesto que con condición simple.

## Casos límite

- Grupo con una sola condición en `conditions` (`{ operator: "and", conditions: [única] }`): válido, se comporta igual
  que si esa condición fuera declarada suelta.
- `negate: true` sobre `isTruthy` o `isFalsy`: válido y funcionalmente equivalente al operador contrario; no se rechaza
  como redundante.
- `negate: true` sobre una condición cuya referencia está ausente: el resultado (hoy "no coincide" para casi todos los
  operadores, o "coincide" para `isFalsy`) se invierte igual que cualquier otro resultado.
- `negate: true` sobre `greaterThan`/`lessThan` con un valor no comparable (string, objeto, `null`, etc.): el resultado
  degradado a "no coincide" se invierte a "coincide".
- Grupo con condiciones lógicamente contradictorias o redundantes entre sí: comportamiento normal derivado de la
  combinación booleana, sin validación especial ni aviso.

## Riesgos o preguntas abiertas

- **Estrategia técnica de la unión discriminada en Zod**: reutilizar `operator` como discriminador compartido entre
  condición simple (`equals | notEquals | ...`) y grupo (`and | or`) es una decisión de shape ya acordada, pero la
  estrategia concreta de implementación en `whenConditionSchema` (un único `discriminatedUnion`, dos schemas con
  `refine` cruzado, u otra composición de Zod) y su impacto en los ~30 nodos y las 3 superficies `when` que la
  reutilizan hoy es una decisión técnica no trivial. Se marca `requires_design: true` para resolverla en
  `generate-feature-design` antes de planificar.
- **Rechazo de anidamiento**: queda pendiente para el diseño técnico decidir el mecanismo exacto de validación que
  rechaza un grupo anidado dentro de `conditions` (por ejemplo, si el schema de `conditions` debe forzar
  explícitamente "solo condición simple" o si se apoya en que el propio shape de condición simple ya no admite
  `conditions`/`operator: and|or`).

## Áreas de producto afectadas (alto nivel)

- Contrato JSON y validación previa al render (`src/config/`, en particular `runtime-config-zod.ts`,
  `runtime-config-types.ts` y el validador transversal de visibilidad/acciones).
- Evaluación en runtime de `visibility` (`src/runtime/runtime-layout-visibility.ts`).
- Todos los nodos que declaran `visibility` de forma transversal (`container`, `heading`, `paragraph`, `list`, `image`,
  `table`, `button`, `link`, `form`, `input`, `textarea`, `select`, `radioGroup`, `checkboxGroup`, `modal`, `tabs` y sus
  items, `accordion`, `badge`, `alert`, `stat`, `divider`, `skeleton`, `fileManager`, `fileInput`, `toggle`, `hidden`).
- Predicados `when` reutilizados en `submitAction.onSuccess`, `pages[].preloads` y `operations`.

## Documentación probablemente afectada

- `ai-workflow/docs/app-features/references/visibility.md` (shape, reglas funcionales, validación de shape).
- `ai-workflow/docs/app-features/references/index.md` si cambia el resumen de alcance de `visibility`.
