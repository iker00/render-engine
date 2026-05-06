# Discovery: Declarative runtime visibility rules

## Problema a resolver
El runtime ya puede ocultar o sustituir nodos según el estado visible de una query mediante `queryStateFeedback`, y ya puede leer valores dinámicos desde `forms.*` y `queries.*`. Lo que todavía no existe es una forma declarativa y transversal de mostrar u ocultar cualquier elemento del layout según el estado actual del runtime cuando la condición depende de valores concretos, no solo del ciclo visible de una query.

Hoy eso deja fuera casos funcionales frecuentes como:
- mostrar un campo adicional cuando otro campo toma un valor concreto
- ocultar o mostrar `heading`, `paragraph`, `list`, `button`, `container` u otros nodos del catálogo según un valor del runtime
- ocultar bloques mientras una query no tenga un valor utilizable concreto
- mostrar una ayuda, un resumen o una llamada a la acción solo cuando el runtime ya contiene cierto dato

La petición pide cubrir esos casos sin abrir todavía un motor general de reglas, expresiones o branching complejo.

## Contexto funcional relevante
- El runtime ya tiene una convención estable de referencias completas para `forms.{formId}.{fieldId}` y `queries.{queryName}.*`.
- `queryStateFeedback` ya resuelve visibilidad por `idle | loading | error | empty | success`, con soporte de `show`, `hide` y `fallback`.
- Los formularios ya excluyen del submit a campos ocultos por `queryStateFeedback`, así que la visibilidad ya tiene impacto funcional además de visual.
- Los consumidores declarativos de referencias siguen siendo acotados: texto, params remotos, `defaultValue` y orígenes de colecciones. No existe todavía una superficie genérica de evaluación condicional.
- La validación del config ya se apoya en `Zod` y el renderer ya centraliza decisiones transversales como feedback por query y resolución de referencias.

## Supuestos actuales
- La v1 debe introducir una capacidad de visibilidad genérica pero deliberadamente pequeña.
- La unidad base debería ser una sola condición declarativa por nodo o campo, no una lista de reglas compuestas.
- La nueva capacidad debe reutilizar referencias ya soportadas y no abrir namespaces nuevos.
- La semántica especializada de `queryStateFeedback` sigue teniendo valor para `fallback` y para estados visibles agregados de query; no hace falta reemplazarla en esta iteración.
- El comportamiento de campos ocultos por esta nueva capacidad debería alinearse con la semántica ya existente de campos ocultos por `queryStateFeedback`: conservan estado local y no bloquean submit mientras permanezcan ocultos.

## Decisiones ya cerradas
- La primera iteración debe centrarse en `show/hide`, sin `fallback`.
- La primera iteración no debe incluir composición booleana (`and`, `or`, `not`) ni expresiones arbitrarias.
- La condición debe leer solo una referencia completa del runtime ya soportada.
- La feature debe servir para cualquier nodo soportado del layout; los campos dentro de formularios son solo un caso particular dentro de ese alcance.
- `queryStateFeedback` debe seguir coexistiendo como capacidad específica para estados visibles de query y para fallbacks locales.
- El nuevo bloque se llamará `visibility`.
- La primera iteración tendrá una sola condición por nodo.
- Los operadores iniciales serán `equals`, `notEquals`, `isTruthy`, `isFalsy`, `greaterThan` y `lessThan`.
- Las referencias admitidas en v1 serán `forms.*`, `queries.*`, `queries.*.data.*`, `queries.*.status` y `queries.*.error`.
- Si una referencia válida no resuelve dato en runtime, se tratará como valor ausente; `isFalsy` podrá considerarla falsa y las comparaciones directas no harán match por defecto.
- `visibility` y `queryStateFeedback` coexistirán como capacidades distintas: la primera para reglas simples sobre valores del runtime y la segunda para estados visibles de query y `fallback`.
- Los campos ocultos por `visibility` conservarán su estado local y no bloquearán submit mientras sigan ocultos.

## Preguntas abiertas
- Ninguna bloqueante para pasar a `spec.md`.

## Aclaraciones para la siguiente fase
- `greaterThan` y `lessThan` compararán números y arrays usando `length`; no abrirán comparación lexicográfica de strings ni evaluación item a item en v1.
- Cuando un nodo declare a la vez `queryStateFeedback` y `visibility`, primero se resolverá `queryStateFeedback` y después `visibility`.
- `visibility` podrá comparar también contra `queries.*.status`, aunque el mecanismo recomendado para estados visibles de query y para `fallback` seguirá siendo `queryStateFeedback`.

## Riesgos detectados
- Si la feature intenta cubrir desde el inicio comparaciones múltiples, combinaciones lógicas o transformaciones de datos, dejará de ser una v1 acotada.
- Si se reutiliza `queryStateFeedback` para resolver también comparaciones sobre valores de formularios, el contrato puede volverse confuso porque esa capacidad hoy está modelada alrededor de estados visibles de query y `fallback`.
- Si no se fija con claridad la semántica de referencias ausentes o tardías, la visibilidad puede resultar difícil de explicar en formularios lazy y queries que todavía no existen en el store.
- El cambio tocará contrato JSON, validación, renderer y validación de formularios visibles, así que el impacto es transversal aunque el alcance funcional sea pequeño.
- La combinación entre la nueva visibilidad genérica y `queryStateFeedback` puede introducir precedencias ambiguas si no se cierra en spec.

## Documentos o áreas de código a revisar después
- `ai-workflow/docs/app-features/config-contract.md`
- `ai-workflow/docs/app-features/forms-and-validation.md`
- `ai-workflow/docs/app-features/queries-and-feedback.md`
- `ai-workflow/docs/current-state.md`
- `src/config/runtime-config-types.ts`
- `src/config/runtime-config-zod.ts`
- `src/config/validate-runtime-config.ts`
- `src/runtime/runtime-query-state-feedback.ts`
- `src/runtime/runtime-references/`
- `src/runtime/layout-renderer.tsx`
- `src/runtime/layout-node-renderer.tsx`
- `src/runtime/runtime-form-submission.ts`

## Recomendación final
Lista para `spec.md`, con una dirección de alcance ya suficientemente clara.

La recomendación para la siguiente fase es fijar una v1 pequeña con estas líneas:
- bloque declarativo genérico de visibilidad por cualquier nodo del layout, incluidos los campos de formulario
- una sola condición basada en una referencia completa ya soportada
- catálogo corto de operadores con `equals`, `notEquals`, `isTruthy`, `isFalsy`, `greaterThan` y `lessThan`
- coexistencia con `queryStateFeedback`, que se mantiene como mecanismo específico para estados visibles de query y `fallback`

La `spec.md` ya puede fijar el contrato funcional sin más discovery previo. El riesgo es medio y conviene prever `design.md` porque la integración afectará a varias capas del runtime.
