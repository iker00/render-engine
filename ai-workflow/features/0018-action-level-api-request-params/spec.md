# Spec: Action-level API request params

## Objetivo
Permitir que las llamadas API declarativas del runtime acepten `query`, `body` y `headers` como canales soportados del request, y que además las acciones declarativas que ejecutan una operación remota puedan aportar esos mismos parámetros por ejecución sin obligar a declarar una operación `api` distinta para cada variante.

## Alcance
- Formalizar `headers` como parte del contrato base de una operación declarada en `api`.
- Ampliar `executeOperation` para que acepte parámetros de request declarados en el propio trigger de ejecución.
- Aplicar esa capacidad tanto a `button.props.action` como a `form.submitAction`.
- Mantener `operationName` como vínculo obligatorio con una operación existente de `api`.
- Reutilizar la misma convención declarativa ya existente para referencias completas y strings escapados dentro del payload.
- Permitir que una operación base definida en `api` siga declarando su request estable y que la acción o el submit añadan o ajusten valores para una ejecución concreta.
- Dejar explícita una semántica funcional de combinación entre la operación base y los parámetros declarados en la acción o el submit.

## Fuera de alcance
- Añadir nuevos tipos de acción distintos de `executeOperation`.
- Introducir varias acciones por trigger, secuencias, branching o callbacks por éxito o error.
- Cambiar la semántica de `preloads` o añadir parámetros por ejecución a `preloads` en esta iteración.
- Añadir un lenguaje general de transformaciones, interpolación parcial o expresiones arbitrarias para construir payloads.
- Crear un nuevo dominio de estado visible separado de `queries.{operationName}` para loading, error o éxito de la ejecución.
- Ampliar en esta spec otros triggers declarativos fuera de `button.props.action` y `form.submitAction`.

## Requisitos funcionales
- Una operación declarada en `api` debe poder definir opcionalmente:
  - `query`, para parámetros de query string
  - `body`, para payload JSON
  - `headers`, para cabeceras HTTP declarativas
- Una acción `executeOperation` debe poder declarar opcionalmente canales de request adicionales junto a `operationName`.
- `form.submitAction` debe poder declarar esos mismos canales opcionales junto a `operationName`.
- Los canales soportados en esta feature deben ser:
  - `query`, para parámetros de query string
  - `body`, para payload JSON
  - `headers`, para cabeceras HTTP declarativas
- El shape funcional de `query`, `body` y `headers` en una acción o submit debe seguir las mismas reglas que use la operación `api` para esos mismos canales.
- `api.headers` debe usar un objeto plano de claves no vacías con valores string.
- `action.headers` y `submitAction.headers` deben usar ese mismo shape.
- Los valores dinámicos declarados dentro de esos canales deben resolverse contra el estado actual del runtime en el momento de disparar la acción o el submit, no en bootstrap.
- Si una operación `api` ya define `query`, `body` o `headers`, la acción o el submit debe poder complementar esa definición para una ejecución concreta.
- La combinación entre operación base y parámetros de la acción o submit debe seguir estas reglas:
  - `query`: unión por clave; si la misma clave existe en ambos sitios, prevalece el valor declarado en la acción o en el submit
  - `headers`: unión por clave; si la misma cabecera existe en ambos sitios, prevalece el valor declarado en la acción o en el submit
  - `body`: si solo una de las dos capas declara body, ese body es el efectivo; si ambas declaran un objeto JSON en raíz, el body efectivo combina ambas ramas y la acción o submit prevalece en las claves repetidas; si alguna de las dos capas usa un body raíz no objeto, el body declarado en la acción o submit sustituye al body base completo
- Una acción o submit debe poder declarar `query`, `body` o `headers` aunque la operación base no declare ese mismo canal.
- Un `form.submitAction` con parámetros declarados debe seguir reutilizando `queries.{operationName}` como única superficie visible de loading, success y error.
- Un `button.props.action.type: executeOperation` con parámetros declarados debe seguir reutilizando exactamente esa misma superficie visible.
- Si faltan datos para resolver referencias en cualquiera de los canales declarados en la acción o submit, la ejecución debe fallar con la misma semántica estable ya existente de `request-build-failed` y no debe emitir red.
- Si una configuración existente usa `executeOperation` sin `query`, `body` ni `headers` en la acción o submit, el comportamiento observable actual no debe cambiar.
- La validación del config debe rechazar antes del render:
  - shapes inválidos de `headers` dentro de una operación `api`
  - shapes inválidos de `query`, `body` o `headers` dentro de una acción `executeOperation`
  - shapes inválidos de `query`, `body` o `headers` dentro de `form.submitAction`
  - un `body` declarado para una ejecución `GET`
  - claves vacías o valores no soportados en `query` o `headers`
  - cualquier combinación de payload que contradiga las reglas estables del contrato `api`

## Requisitos no funcionales
- El contrato debe seguir siendo simple de generar desde backend legacy: una acción, un `operationName` y, opcionalmente, fragmentos declarativos de request.
- La feature debe resolver un caso concreto de reutilización de endpoints sin convertirse en un sistema general de composición de requests arbitrarios.
- La terminología debe mantenerse alineada con el proyecto actual, preservando `query` como nombre del canal JSON aunque conceptualmente represente params de query string.
- La semántica debe ser consistente entre `button.props.action` y `form.submitAction`.
- La semántica base de `api` debe quedar alineada con esa misma terminología para que `headers` no sea una excepción implícita del builder HTTP sino una parte explícita del contrato declarativo.
- La validación debe seguir siendo previa al render, diagnóstica en desarrollo y coherente con las rutas canónicas del JSON afectado.
- La combinación entre operación base y parámetros por ejecución debe ser predecible y estable para evitar que el backend necesite duplicar operaciones `api` casi idénticas.

## Criterios de aceptación
- Dado un `button` con `action.type: executeOperation` y `query` declarada en la propia acción, al activarlo el runtime ejecuta la operación con esos params adicionales y refleja el resultado en `queries.{operationName}`.
- Dado un `form` con `submitAction.type: executeOperation` y `query` declarada en el submit, al enviarlo el runtime ejecuta la operación con esos params adicionales y refleja el resultado en `queries.{operationName}`.
- Dada una operación `api` con `query` base y una acción con `query` adicional, la request efectiva incluye ambas familias de params.
- Dada una operación `api` con `headers` declarados y sin override por acción o submit, la request efectiva envía esas cabeceras.
- Dada una operación `api` con una clave de `query` ya declarada y una acción o submit que vuelve a declarar esa misma clave, prevalece el valor de la acción o submit en esa ejecución.
- Dada una operación `api` con `headers` base y una acción o submit con `headers` adicionales, la request efectiva incluye ambas cabeceras, con precedencia de la acción o submit en caso de colisión.
- Dada una operación `api` con body objeto y una acción o submit con body objeto adicional, la request efectiva combina ambos cuerpos y prevalecen las claves de la acción o submit cuando se repiten.
- Dada una operación `api` con body raíz no objeto y una acción o submit con body propio, el body efectivo de la ejecución es el declarado en la acción o submit.
- Dado un valor dinámico como `forms.postForm.id` dentro de `query`, `body` o `headers` de una acción o submit, el runtime lo resuelve en el momento real de disparo usando el estado vigente.
- Dada una referencia no resoluble dentro de `query`, `body` o `headers` de una acción o submit, la ejecución falla con el mismo error estable de construcción de request y no emite red.
- Dado un config existente que solo usa `operationName` sin payload adicional en acciones o submit, el comportamiento observable actual se mantiene.
- Dado un config inválido que declara `query`, `body` o `headers` con shape no soportado en la acción o en `submitAction`, la validación lo rechaza antes del render con diagnóstico trazable.

## Casos límite
- Un mismo `operationName` puede reutilizarse desde varios botones o formularios con distintos parámetros por ejecución sin exigir operaciones `api` duplicadas.
- Un formulario puede enviar un valor actual de `forms.*` en `query` aunque la operación base siga usando `body`, o viceversa.
- Una acción puede declarar solo `headers`, solo `query`, solo `body` o cualquier combinación válida de esos canales.
- Dos capas pueden aportar body a la misma ejecución; la spec fija una combinación limitada y explícita para no abrir un motor de merge arbitrario.
- Un submit con `resetOnSuccess: true` debe seguir reseteando el formulario solo después de un éxito real de la operación resultante, aunque la request efectiva provenga de mezclar operación base y parámetros del submit.
- El hecho de que `src/dev/config.json` ya pueda expresar un caso como `submitAction.query` debe quedar cubierto por esta spec como contrato estable, no como excepción informal.

## Riesgos o preguntas abiertas
- La feature es transversal entre contrato JSON, validación, construcción de requests, acciones compartidas y submit de formularios, por lo que requiere `design.md` antes de implementarse.
- La spec fija una semántica acotada de combinación para `body`; cualquier necesidad futura de merge profundo más expresivo o transformaciones condicionadas debe abrirse como alcance nuevo.

## Áreas de producto afectadas
- Runtime UI configurable
- Contrato de configuración
- Queries y feedback
- Formularios y validación

## Documentación probablemente afectada
- `ai-workflow/docs/current-state.md`
- `ai-workflow/docs/architecture.md`
- `ai-workflow/docs/app-features/config-driven-ui-runtime.md`
- `ai-workflow/docs/app-features/config-contract.md`
- `ai-workflow/docs/app-features/queries-and-feedback.md`
- `ai-workflow/docs/app-features/forms-and-validation.md`
