# Design: Feature 2026-08-25-12-01 - button-execute-operation-lifecycle-actions

## Contexto
La capacidad `onSuccess`/`onError` ya existe hoy, pero solo para `form.submitAction`, y su implementación no es tan aislada como parece a primera vista:

- **Validación (`src/config/`)**: `validate-actions-visibility.ts` ya tiene dos validadores de acción con responsabilidades distintas:
  - `validateRuntimeUiAction` (genérico, sin `onSuccess`/`onError`): valida cualquiera de los 7 tipos de acción. Es la función que hoy usan tanto `validate-button-node.ts` (`button.props.action`) como `validate-link-node.ts` (`link.props.action`).
  - `validateFormSubmitAction` (nombrada para `submitAction` pero estructuralmente genérica): restringe el tipo a `executeOperation`/`executeOperations`, y además valida los arrays `onSuccess`/`onError` (shape, `when`, y referencias a `operationName`/`pageId`/`modalId` vía `validateActionTargets`/`findInvalidActionTarget`). Los mensajes de error ya se construyen a partir del parámetro `path` que pasa el caller, no de un literal `"submitAction"` hardcodeado — es decir, ya es reusable sin tocar su lógica interna.
  - Hoy solo `validate-form-node.ts` llama a `validateFormSubmitAction`.
- **Ejecución (`src/runtime/`)**: `runtime-actions/runtime-ui-action-executor.ts` expone `executeRuntimeUiAction`, un dispatcher puro por tipo de acción, usado hoy tanto por `button-layout-node.tsx` (la acción propia del botón) como por `form-layout-node.tsx` (cada entrada de `onSuccess`/`onError`). Para `executeOperation`/`executeOperations`, este dispatcher es *fire-and-forget* (`void handlers.executeQueryOperation(...)`) — no devuelve el resultado.
  - El bucle que evalúa `when` por entrada, toma un snapshot de estado fresco y decide qué bloque (`onSuccess`/`onError`) ejecutar según el resultado de la operación (`runOnSuccessActions`/`runOnErrorActions`) vive **solo** como funciones locales dentro de `form-layout-node.tsx`, acopladas a `handleSubmit`. Esta es la pieza que la spec marcó como riesgo a resolver aquí.
  - `button-layout-node.tsx` hoy no espera (`await`) el resultado de su propia acción: el `onClick` es síncrono y no conoce éxito/error.
- `ButtonAction` es simplemente un alias de `RuntimeUiAction` (`type ButtonAction = RuntimeUiAction`), no un tipo discriminado propio por nodo. Esto significa que añadir `onSuccess`/`onError` a las variantes `executeOperation`/`executeOperations` de `RuntimeUiAction` los hace disponibles automáticamente para `button.props.action` sin un tipo paralelo.
- `FormOnSuccessAction`/`FormOnErrorAction` (`RuntimeUiAction & { when?: RuntimeWhenCondition }`) son ya el shape exacto que la spec pide para las entradas de `button.props.action.onSuccess/onError`.

## Objetivos / No objetivos

### Objetivos
- Decidir dónde vive la validación y la orquestación de `onSuccess`/`onError` para que sirva a la vez a `form.submitAction` (comportamiento existente, sin cambios) y a `button.props.action` (comportamiento nuevo), sin duplicar lógica de dominio.
- Fijar el punto de integración exacto en `src/config/` y `src/runtime/` para que `generate-implementation-plan` pueda trocear tareas sin reabrir esta decisión.

### No objetivos
- No se diseña el shape del schema Zod línea a línea ni los mensajes de error exactos; eso es detalle de implementación.
- No se resuelve aquí el árbol de tests; el contrato de tests por tarea es responsabilidad de `tasks.md`.
- No se toca la semántica ya vigente de `form.submitAction.onSuccess/onError` (se reutiliza, no se reabre).

## Decisiones

### D1 — Compartir la validación de `onSuccess`/`onError` entre `submitAction` y `button.props.action`
**Elegido**: extraer de `validateFormSubmitAction` la parte que valida `onSuccess`/`onError` (shape, `when`, referencias a `operationName`/`pageId`/`modalId`) a una función reusable, invocada tanto desde `validate-form-node.ts` (como hoy) como desde `validate-button-node.ts`, para cuando la acción ya validada por `validateRuntimeUiAction` es `executeOperation`/`executeOperations`.
**Por qué**: la lógica ya es genérica (usa `path` del caller, no literales de "submitAction"); duplicarla en `validate-button-node.ts` violaría la regla de `architecture.md` de no dispersar la misma validación por nodo.
**Alternativa descartada**: reimplementar una validación equivalente en `validate-button-node.ts`. Se descarta porque introduciría un segundo punto de verdad para el mismo criterio de validación (referencias a `operationName`/`pageId`/`modalId`), con riesgo de que diverjan con el tiempo.
**Coste/riesgo residual**: mover/renombrar una función que hoy funciona correctamente para `submitAction` exige no alterar su comportamiento observable; las tareas de implementación deben incluir tests de regresión sobre los casos existentes de `submitAction.onSuccess/onError` antes de tocar el código compartido.

### D2 — Compartir la orquestación de ejecución entre formulario y botón
**Elegido**: extraer el bucle de `runOnSuccessActions`/`runOnErrorActions` (evaluación de `when` por entrada contra un snapshot fresco de estado, ejecución en orden vía `executeRuntimeUiAction`) de `form-layout-node.tsx` a una función compartida dentro de `runtime-actions/` (mismo fichero `runtime-ui-action-executor.ts` o uno hermano en la misma carpeta), reusada por `FormNode` y por `ButtonNode`.
**Por qué**: es exactamente el punto de extensión que documenta `architecture.md` ("Nueva acción UI: extender el contrato de acción, resolver parámetros en la capa común y delegar en handlers del provider"); es también la razón explícita por la que la spec marcó `requires_design: true`.
**Alternativa descartada**: duplicar los dos closures en `button-layout-node.tsx`. Se descarta por el mismo motivo que D1: crea dos copias de una semántica que `forms/submit.md` y (tras esta feature) `nodes/button.md` documentan como idéntica, con riesgo de divergencia futura.
**Coste/riesgo residual**: ninguno funcional nuevo; es una extracción mecánica de código ya probado.

### D3 — El disparo de la acción propia del botón deja de ser fire-and-forget cuando hay `onSuccess`/`onError`
**Elegido**: cuando `button.props.action.type` es `executeOperation`/`executeOperations`, `ButtonNode` pasa a ejecutar esa acción de forma directa y asíncrona (llamando a `executeQueryOperation`/`Promise.all` igual que ya hace `FormNode.handleSubmit` para `submitAction`), en vez de delegar en el `executeRuntimeUiAction` genérico (que hoy es fire-and-forget para estos dos tipos). El runner compartido de D2 se invoca únicamente sobre las listas `onSuccess`/`onError` resultantes, igual que hoy hace `form-layout-node.tsx`.
**Por qué**: es la única forma de conocer éxito/error antes de decidir qué bloque ejecutar; replica un patrón ya validado en producción (`FormNode.handleSubmit`) en lugar de inventar uno nuevo.
**Alternativa descartada**: extender `executeRuntimeUiAction` para que también devuelva/espere el resultado en sus ramas `executeOperation`/`executeOperations`. Se descarta porque esas ramas siguen siendo usadas fire-and-forget por las entradas *dentro* de `onSuccess`/`onError` (que por límite de anidamiento de un nivel nunca tienen su propio `onSuccess`/`onError` y no necesitan esperar su resultado); cambiar su contrato ahí introduciría un `await` innecesario en ese camino y complicaría el dispatcher genérico para un caso que no lo necesita.
**Coste/riesgo residual**: el `onClick` de `ButtonNode` pasa de síncrono a async (`onClick={() => void handleClick()}`), mismo patrón que ya usa `onSubmit` en `form-layout-node.tsx`; riesgo bajo. Queda una asimetría legítima entre "acción propia del botón" (bypassa el dispatcher genérico cuando hay onSuccess/onError) y "acción dentro de una lista onSuccess/onError" (usa el dispatcher genérico): debe quedar documentada en el código para que no se lea como inconsistencia accidental.

### D4 — Renombrar los tipos compartidos de entrada de lista
**Elegido**: `FormOnSuccessAction`/`FormOnErrorAction` pasan a un nombre neutral (p. ej. algo que no lleve el prefijo `Form`), ya que tras esta feature los consume también `button.props.action`.
**Por qué**: `conventions.md` exige que el lenguaje de código sea consistente con la terminología real del producto; mantener el prefijo `Form` en un tipo usado por botones sería engañoso para quien lo lea después.
**Alternativa descartada**: dejar el nombre `Form...` tal cual y reusarlo igualmente para botones. Se descarta por bajo coste de renombrar (alias interno de tipo, no una clave de config pública) frente al coste de confusión futura.

### D5 — Ubicación de `onSuccess`/`onError` en el árbol de tipos
**Fijado por la spec, no una alternativa abierta**: `onSuccess`/`onError` cuelgan de las variantes `executeOperation`/`executeOperations` de `RuntimeUiAction` (es decir, de `props.action.onSuccess/onError`), no del nodo `button` a nivel superior como ocurre en `form` (donde son hermanos de `submitAction`). Es consecuencia directa de que `ButtonAction` ya es un alias plano de `RuntimeUiAction` y de que el botón no tiene un concepto de "submitAction" separado de su propia acción.

### D6 — Restricción de tipo y criterio de validación de referencias
**Elegido**: reusar exactamente el mismo criterio ya vigente para `submitAction.onSuccess/onError` — `onSuccess`/`onError` solo se validan/aceptan cuando la acción ya resuelta por `validateRuntimeUiAction` es `executeOperation`/`executeOperations`, y las referencias a `operationName`/`pageId`/`modalId` de cada entrada se validan con los mismos validadores de destino (`validateActionTargets`/`findInvalidActionTarget`) que hoy usa `submitAction`, aplicados sobre el `path` del botón (`button.props.action.onSuccess[i]`, etc.).
**Por qué**: es el criterio que la spec pide explícitamente (requisito 7) y evita un segundo criterio de validación paralelo.

## Riesgos y trade-offs
- Compartir `validateFormSubmitAction`/su lógica interna entre dos call sites reales (formulario y botón) es un cambio en un módulo de validación ya estable; el riesgo se mitiga cubriendo con tests los casos existentes de `submitAction.onSuccess/onError` antes y después de la extracción, para que cualquier regresión se detecte de inmediato.
- La asimetría de D3 (la acción propia del botón bypassa el dispatcher genérico cuando hay `onSuccess`/`onError`, pero las entradas de las listas sí lo usan) es intencional pero no obvia a simple vista; debe quedar señalada en el código para futuros lectores, no solo en este documento.
- Ningún riesgo nuevo de datos o migración: la feature es puramente aditiva sobre campos opcionales.

## Migración o despliegue
No aplica. No hay migración de datos ni de configuración; las configuraciones existentes sin `onSuccess`/`onError` en `button.props.action` no cambian de comportamiento.

## Preguntas abiertas
Ninguna pregunta técnica bloqueante. Las decisiones de arquitectura que motivaron `requires_design: true` (extracción vs. duplicación en validación y en ejecución) quedan cerradas en D1–D3.
