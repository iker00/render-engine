# Spec: acciones post-ejecución (`onSuccess`/`onError`) en `button.props.action`

## Objetivo
Permitir que un `button` con `props.action.type: executeOperation` o `executeOperations` encadene acciones declarativas tras el resultado de la operación, igual que ya puede hacer `form.submitAction`. Hoy esa capacidad solo existe en el submit de formularios, lo que obliga a construir formularios artificiales (sin campos reales, solo para acceder a `submitAction.onSuccess`) o a refrescos manuales fuera del modelo declarativo cuando un botón suelto necesita, por ejemplo, disparar un refetch de listado tras borrar un item.

## Alcance
- Añadir `onSuccess` y `onError` como campos opcionales de `button.props.action` cuando `props.action.type` es `executeOperation` o `executeOperations`.
- `onSuccess`/`onError` son listas ordenadas de acciones del mismo catálogo ya soportado por `button.props.action` (`navigateTo`, `goBack`, `executeOperation`, `executeOperations`, `resetForm`, `openModal`, `closeModal`), cada una con `when` opcional (mismo shape que `visibility`).
- Semántica de ejecución idéntica a la ya vigente en `form.submitAction` (documentada en `forms/submit.md`):
  - Las acciones se evalúan y ejecutan en orden declarado; todas las que cumplan su `when` se ejecutan (sin semántica de "primera coincidencia").
  - Una acción sin `when` siempre se ejecuta; si `when` no se cumple, se omite en silencio.
  - `onSuccess` solo se ejecuta si la operación termina en éxito; `onError` solo si termina en error. Nunca se ejecutan ambos bloques para la misma ejecución.
  - Con `executeOperation` (singular): éxito/error de esa única operación decide el bloque.
  - Con `executeOperations` (plural): `onSuccess` se ejecuta solo si **todas** las operaciones de la lista terminan en éxito; `onError` se ejecuta si **alguna** termina en error.
  - Las referencias `queries.{operationName}.*` usadas por los `when` de `onSuccess`/`onError` ya reflejan el estado (`success`/`error`) y los datos de la ejecución antes de evaluarse.
- Cuando la acción ocurre dentro de un `repeater`, las acciones de `onSuccess`/`onError` (y sus overrides `query`/`body`/`headers`/`params`) pueden resolver `item.*` contra el item de la iteración activa, igual que ya puede hacerlo la acción principal del botón.
- Anidamiento limitado a un solo nivel: una acción dentro de una lista `onSuccess`/`onError` (ya sea la de `button.props.action` o la de `submitAction`) no admite su propio `onSuccess`/`onError`. Esto ya es el comportamiento vigente de `submitAction` (las entradas de sus listas no exponen esos campos) y se mantiene igual al extender la capacidad a `button`.
- Cubre cualquier botón con `props.action.type: executeOperation`/`executeOperations`, esté donde esté en el árbol: suelto, dentro de un `repeater.props.template`, dentro de un `modal`, o como botón auxiliar (`action` explícita) dentro de un `form` — este último ya no dispara submit implícito y hoy no tiene forma de encadenar acciones tras su propia operación.

## Fuera de alcance
- `onSuccess`/`onError` en el resto de tipos de `props.action.type` (`navigateTo`, `goBack`, `resetForm`, `openModal`, `closeModal`). Estas acciones son síncronas y no tienen un resultado de red que decida éxito/error; no se les añade el campo.
- Cualquier redefinición de la semántica ya vigente de `form.submitAction.onSuccess`/`onError` (se reutiliza tal cual, sin cambios de comportamiento para formularios existentes).
- Anidamiento de más de un nivel (una acción dentro de `onSuccess`/`onError` con su propio `onSuccess`/`onError`), en `button` o en `submitAction`.
- Cambios en la semántica de errores tipados de `queries/execution.md` (`operation-not-found`, `request-build-failed`, `token-refresh-failed`, `network-error`, `http-error`, `invalid-json-response`, `business-error-condition`): se reutiliza el mismo criterio de éxito/error que ya usa `submitAction.onError` hoy, sin ampliarlo ni reducirlo.
- Cualquier nuevo dominio de estado visible para "operación en curso" (loading) del botón; el resultado sigue viviendo únicamente en `queries.{operationName}`.

## Requisitos funcionales
1. El schema de configuración acepta `onSuccess`/`onError` (arrays opcionales) en `button.props.action` cuando `type` es `executeOperation` o `executeOperations`, con el mismo shape de entrada que ya usa `submitAction` (acción del catálogo de botón + `when` opcional), sin admitir `onSuccess`/`onError` anidado dentro de cada entrada.
2. Tras una ejecución exitosa de `executeOperation`/`executeOperations` disparada por un botón, si existe `onSuccess`, se evalúan y ejecutan en orden sus entradas cuyo `when` se cumpla (o que no declaren `when`).
3. Tras una ejecución fallida, si existe `onError`, se evalúan y ejecutan en orden sus entradas bajo la misma regla de `when`.
4. Ningún botón sin `onSuccess`/`onError` cambia de comportamiento: la ausencia de estos campos deja la ejecución de la acción exactamente igual que hoy.
5. Un botón dentro de un `repeater` que use `onSuccess`/`onError` resuelve `item.*` de la iteración activa en los overrides (`query`, `body`, `headers`, `params`) de las acciones encadenadas, igual que ya hace la acción principal del botón.
6. Un botón auxiliar (`action` explícita) dentro de un `form` puede usar `onSuccess`/`onError` sobre su propia operación, de forma independiente al `submitAction` del formulario que lo contiene.
7. La validación en bootstrap rechaza el config completo si alguna entrada de `onSuccess`/`onError` referencia un `operationName` inexistente en `api` (mismo criterio ya aplicado a `button.props.action.operationName` y a las entradas de `executeOperations`), una `pageId` inexistente en `navigateTo`, o un `modalId` inexistente en `openModal`/`closeModal`, siguiendo el mismo criterio de validación ya vigente para el catálogo de acciones de botón.

## Requisitos no funcionales
- Reutilizar la semántica de ejecución y de errores tipados ya implementada para `submitAction.onSuccess`/`onError` (`forms/submit.md`, `queries/execution.md`), sin introducir un segundo modelo de orquestación paralelo.
- Mantener el umbral de cobertura de tests del 80% sobre `src/` ya exigido por el proyecto.
- Sin cambios de comportamiento observable para configuraciones existentes que no declaren `onSuccess`/`onError` en `button.props.action`.

## Criterios de aceptación
- Un botón con `action.type: executeOperation` y `onSuccess: [{ type: executeOperation, operationName: "listUsers" }]` dispara `listUsers` automáticamente tras el éxito de su propia operación, sin refresco manual.
- Un botón con `action.type: executeOperation` y `onError` con una acción `openModal` abre el modal indicado cuando la operación del botón termina en error, y no la ejecuta si la operación tiene éxito.
- Un botón con `action.type: executeOperations` y `onSuccess` solo ejecuta las acciones encadenadas cuando **todas** las operaciones de la lista terminan en éxito; si una falla, se evalúa `onError` en su lugar (si existe) y `onSuccess` no se ejecuta.
- Una entrada de `onSuccess`/`onError` con `when` que no se cumple se omite en silencio; el resto de entradas de la lista se sigue evaluando.
- Un config que declara `onSuccess`/`onError` en una entrada anidada dentro de otra lista `onSuccess`/`onError` (de `button` o de `submitAction`) se rechaza en bootstrap.
- Un config con `button.props.action.onSuccess` referenciando un `operationName` inexistente en `api` se rechaza en bootstrap con el mismo criterio que ya aplica hoy a `button.props.action.operationName`.
- Un botón dentro de `repeater.props.template` con `onSuccess` que referencia `item.*` en el `body`/`query` de la acción encadenada resuelve correctamente contra el item de la iteración que disparó el botón.
- Formularios existentes con `submitAction.onSuccess`/`onError` no cambian de comportamiento tras esta feature.

## Casos límite
- `onSuccess`/`onError` vacíos (`[]`) o ausentes: comportamiento actual sin cambios, no se ejecuta nada adicional.
- Botón cuya operación termina en error de negocio (`business-error-condition` vía `errorCondition`), no solo error HTTP: dispara `onError`, igual que ya hace `submitAction.onError` hoy.
- Botón con `executeOperations` donde todas las entradas se omiten por `when` (según `button.md`, esto se trata como éxito): dispara `onSuccess` si existe, no `onError`.
- Encadenar dos acciones `executeOperation` distintas en el mismo `onSuccess` (por ejemplo, refrescar dos listados a la vez): ambas se lanzan según el orden declarado, sin bloquearse entre sí más allá de lo que ya define la ejecución en paralelo de acciones dentro de una misma lista `onSuccess`.
- Un botón con `onSuccess`/`onError` que a su vez dispara, dentro de esas listas, otro `executeOperation` cuyo resultado también falla: ese fallo no dispara recursivamente ningún `onError` adicional (no hay segundo nivel), consistente con el límite de anidamiento ya fijado.

## Áreas de producto afectadas (alto nivel)
- Catálogo de nodos: `button` (`nodes/button.md`).
- Queries y ejecución: `queries/execution.md` (deja de listar el refetch declarativo desde botón como pendiente).
- Formularios: `forms/submit.md` (referencia cruzada, sin cambio de comportamiento, para dejar constancia de que la capacidad ya no es exclusiva de `submitAction`).
- Editor visual de desarrollo: el panel de propiedades ya edita `onSuccess`/`onError` para `submitAction` (feature `0107`); previsiblemente necesita extender ese mismo editor a `button.props.action` para las dos variantes `executeOperation`/`executeOperations`.

## Documentación probablemente afectada (alto nivel)
- `ai-workflow/docs/app-features/nodes/button.md`
- `ai-workflow/docs/app-features/queries/execution.md`
- `ai-workflow/docs/app-features/forms/submit.md` (nota de referencia cruzada)
- `ai-workflow/docs/current-state.md` si cambia el resumen de la fila "Catálogo de nodos" o "Queries, preloads y feedback"

## Riesgos o preguntas abiertas
- Ninguna pregunta bloqueante pendiente: las decisiones de forma de la capacidad, simetría éxito/error y límite de anidamiento se cerraron en la fase de exploración conversacional previa.
- Riesgo técnico real (no bloqueante para la spec, a resolver en `design.md`): hoy la orquestación de `onSuccess`/`onError` vive como lógica local dentro de `form-layout-node.tsx`, acoplada al ciclo de vida del submit de formulario; extender la misma capacidad a botones exige decidir si esa orquestación se extrae a un módulo compartido reutilizado por ambos puntos de disparo (formulario y botón) o si se duplica de forma equivalente en el ejecutor de acciones de botón (`runtime-ui-action-executor.ts` u otro punto del árbol `layout`). Esta decisión de arquitectura es la razón por la que la feature marca `requires_design: true`.
