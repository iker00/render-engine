# Feature 0073 — Acciones post-éxito en formularios y predicado `when` condicional

## Objetivo

Permitir que un formulario ejecute una secuencia de acciones declarativas después de un submit exitoso, que cada operación dentro de `executeOperations` pueda condicionarse individualmente, y que tanto esas acciones como las precargas de página puedan omitirse mediante un predicado `when` reutilizando el lenguaje de comparación de `visibility`.

## Alcance

### `submitAction.onSuccess`

- El objeto `submitAction` de un `form` acepta un nuevo campo opcional `onSuccess`: lista ordenada de acciones declarativas.
- Cada entrada de la lista puede ser cualquier acción del catálogo existente de botón: `navigateTo`, `goBack`, `executeOperation`, `executeOperations`, `resetForm`, `openModal`, `closeModal`.
- Cada entrada puede declarar opcionalmente `when` con el mismo shape que `visibility` (`reference`, `operator`, `value?`).
- Tras un submit exitoso, el runtime evalúa las acciones en orden declarado y ejecuta todas las que cumplan su condición.
- Una acción sin `when` siempre se ejecuta.
- Si la condición `when` no se cumple, la acción se omite silenciosamente.
- Si el submit falla, no se ejecuta ninguna acción de `onSuccess`.
- Si `submitAction.type` es `executeOperations` (plural), `onSuccess` se ejecuta solo si todas las operaciones de la lista terminan en éxito.
- `resetOnSuccess: true` coexiste con `onSuccess`: si está activo, el reset del formulario ocurre después de ejecutar todas las acciones de `onSuccess`.

### Predicado `when` en preloads

- Cada entrada de `pages[].preloads` acepta un nuevo campo opcional `when` con el mismo shape que `visibility`.
- Al entrar a una página, el runtime evalúa el predicado `when` de cada preload contra el estado activo en ese momento.
- Si la condición no se cumple, el preload se omite silenciosamente.
- Un preload omitido no aparece en `pageEntry.preloadNames` ni contribuye a `pageEntry.status`.
- Si todos los preloads de una página son omitidos por sus condiciones `when`, `pageEntry.status` queda en `idle`.

### Shape del predicado `when`

- `{ reference, operator, value? }` — idéntico al de `visibility`.
- Referencias admitidas: `forms.*`, `queries.*`, `params.*`, `item.*` con la misma semántica que en `visibility`.
- Operadores admitidos: `equals`, `notEquals`, `isTruthy`, `isFalsy`, `greaterThan`, `lessThan`.
- En preloads, `item.*` no es una referencia válida (no existe contexto de item a nivel de página); el config se rechaza en bootstrap con ruta de error exacta.
- La evaluación se resuelve contra el estado del runtime en el momento de ejecución de cada acción o al inicio de la tanda de preloads.

### `when` en entradas de `executeOperations`

- Cada entrada del array `operations` en `executeOperations` acepta un nuevo campo opcional `when` con el mismo shape que `visibility`.
- Aplica en todos los contextos donde se usa `executeOperations`: `button.props.action`, `submitAction` y `submitAction.onSuccess`.
- Al ejecutar la acción, el runtime evalúa `when` de cada entrada contra el estado actual y lanza solo las operaciones cuya condición se cumpla.
- Una entrada sin `when` siempre se lanza.
- Si ninguna operación pasa su condición `when`, la acción completa sin lanzar ninguna query; este caso se trata como éxito a efectos de `resetOnSuccess` y `onSuccess`.
- La semántica de parallelismo y de `resetOnSuccess` colectivo aplica únicamente sobre las operaciones efectivamente lanzadas.

### Tipo `Action` compartido

- La definición del tipo `Action` (acción con `when?` opcional) se construye como tipo compartido en el runtime para facilitar su reutilización futura en botones sin reabrir el contrato de esta feature.
- El shape de `button.props.action` no cambia en esta feature.

## Fuera de alcance

- Cambio del shape de `button.props.action` o adición de `when` al nivel de la acción de botón completa.
- `when` en la acción singular `executeOperation` (solo se añade a las entradas individuales de `executeOperations` plural).
- Condiciones compuestas (AND/OR) en `when`.
- Nuevos operadores de comparación más allá del catálogo de `visibility`.
- Ejecución secuencial dependiente entre `onSuccess` actions (esperar resultado de una acción para lanzar la siguiente).

## Requisitos funcionales

1. `submitAction.onSuccess` acepta una lista de cero o más acciones; si la lista está vacía o no se declara, el comportamiento del submit es el mismo que el actual.
2. Cada acción en `onSuccess` sigue el mismo contrato de parámetros y validación que la acción equivalente en `button.props.action`.
3. Las acciones de `onSuccess` se evalúan y ejecutan en el orden declarado.
4. Todas las acciones cuya condición `when` se cumpla se ejecutan; no existe semántica de primera coincidencia.
5. Tras un submit exitoso, las referencias `queries.{operationName}.*` ya reflejan el estado `success` y sus datos antes de que se evalúen los `when` de las `onSuccess` actions.
6. Los preloads con `when` se evalúan antes de derivar la firma de request y de limpiar el estado de queries afectadas.
7. La validación de config rechaza en bootstrap cualquier acción de `onSuccess` con shape inválido, `pageId` inexistente, `operationName` inexistente, `modalId` inexistente o `when` con referencia u operador fuera del catálogo soportado.
8. La validación rechaza en bootstrap cualquier preload con `when` que use `item.*` como referencia.
9. La validación rechaza en bootstrap `when` en una entrada de `operations` de `executeOperations` con referencia u operador fuera del catálogo soportado.

## Requisitos no funcionales

- La evaluación del predicado `when` reutiliza la misma función de resolución de condiciones que usa `visibility`; no se duplica lógica de comparación.
- La feature no introduce dominios de estado nuevos en el store del runtime; solo añade comportamiento reactivo a flujos ya existentes.

## Criterios de aceptación

- Un formulario con `onSuccess: [{ type: "navigateTo", pageId: "X" }]` navega a la página X tras un submit exitoso.
- Un formulario con `onSuccess: [{ type: "navigateTo", pageId: "X", when: { reference: "queries.op.data.status", operator: "equals", value: "ok" } }]` solo navega si la respuesta contiene `status: "ok"`.
- Si hay dos acciones en `onSuccess` con condiciones `when` distintas y solo una se cumple, solo se ejecuta esa.
- Si hay dos acciones en `onSuccess` con condiciones `when` distintas y ambas se cumplen, ambas se ejecutan en orden declarado.
- Un submit fallido no ejecuta ninguna acción de `onSuccess`.
- Con `resetOnSuccess: true` y `onSuccess: [{ type: "navigateTo", ... }]`, la navegación ocurre antes que el reset.
- Un preload con `when: { reference: "params.userId", operator: "isTruthy" }` que no tenga `userId` en params no se ejecuta y no aparece en `pageEntry.preloadNames`.
- Un preload con `when: { reference: "params.userId", operator: "isTruthy" }` que sí tenga `userId` se ejecuta con normalidad.
- Una página cuyos preloads son todos omitidos por sus condiciones `when` presenta `pageEntry.status: idle`.
- Un `when` con `reference: "item.x"` en un preload rechaza el config en bootstrap con ruta de error exacta.
- Un `onSuccess` con `pageId` inexistente rechaza el config en bootstrap.
- Un botón con `executeOperations` donde una entrada tiene `when: { reference: "queries.op.data.flag", operator: "isTruthy" }` solo lanza esa operación si la condición se cumple en el momento del clic.
- Un `executeOperations` donde todas las entradas tienen `when` que no se cumple completa sin queries afectadas y, en contexto de formulario, desencadena `onSuccess` y `resetOnSuccess` igualmente.

## Casos límite

- `onSuccess: []` — válido, no ejecuta ninguna acción adicional.
- Múltiples acciones en `onSuccess` que todas cumplan su `when`, incluyendo dos `navigateTo` — se ejecutan todas en orden; la última navegación es la que prevalece en el historial.
- `resetForm` en `onSuccess` con `formId` del propio formulario — válido; el reset ocurre como parte de la secuencia de `onSuccess`, antes del `resetOnSuccess` del propio formulario si este también está activo.
- `onSuccess` con `executeOperation` — esa operación actualiza `queries.*` normalmente; el runtime no espera su resultado para continuar con la siguiente acción de la lista.
- `executeOperations` con todas las entradas filtradas por `when` — completa como éxito; `onSuccess` y `resetOnSuccess` se ejecutan normalmente.
- Todos los preloads de una página con `when` que no se cumple — `pageEntry.status: idle`, sin ninguna query en estado `loading`.
- Preload con `when` y firma de request coincidente con la anterior entrada — la condición se evalúa antes de comparar firmas; si no se cumple, el preload se omite sin llegar a comparar.

## Documentación afectada

- `ai-workflow/docs/app-features/forms/submit.md` — ampliar con `onSuccess`, semántica de ejecución condicional y relación con `resetOnSuccess`.
- `ai-workflow/docs/app-features/queries/preloads.md` — ampliar con `when` en preloads y semántica de omisión silenciosa.
- `ai-workflow/docs/app-features/nodes/form.md` — actualizar contrato de `submitAction` con el nuevo campo `onSuccess`.
- `ai-workflow/docs/app-features/references/visibility.md` — nota de que el shape de condición se reutiliza en `onSuccess`, preloads y entradas de `executeOperations`.
- `ai-workflow/docs/app-features/nodes/button.md` — actualizar contrato de `executeOperations` con `when` opcional por entrada.

## Riesgos o preguntas abiertas

Ninguno.
