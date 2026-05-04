# Spec: Shared runtime UI actions foundation

## Objetivo
Definir una base común para acciones disparadas por la UI del runtime, de forma que capacidades ya existentes como navegar entre páginas, ejecutar operaciones remotas declaradas y resetear formularios puedan declararse desde nodos interactivos sin depender de lógica imperativa ad hoc específica de cada caso.

## Alcance
- Convertir `action` en un contrato funcional común del runtime para interacciones disparadas desde nodos del layout.
- Mantener compatibilidad con la sintaxis actual `button.props.action`.
- Hacer que el trigger siga siendo implícito por tipo de nodo en esta primera iteración, sin introducir todavía un bloque general de `events`.
- Extender el catálogo de acciones comunes soportadas para cubrir:
  - `navigateTo`
  - `goBack`
  - `executeOperation`
  - `resetForm`
- Mantener la semántica estable ya existente de navegación, ejecución remota y reset de formularios, reutilizando esos mismos dominios de estado.
- Dejar esta base preparada para que futuras features puedan reutilizarla desde otros nodos con eventos, como `form`, `link` o campos interactivos, sin rediseñar otra vez el contrato de acción.

## Fuera de alcance
- Introducir ahora un sistema general de `events`, `onClick`, `onSubmit` u otros nombres de trigger explícitos compartidos entre nodos.
- Soportar más de una acción por trigger.
- Soportar secuencias, branching, callbacks por éxito o error, condiciones declarativas o políticas de continuación tras fallo.
- Añadir acciones adicionales fuera del catálogo inicial, como `refetchQuery`, `resetQuery`, navegación externa o combinaciones automáticas entre varias acciones.
- Crear un nuevo dominio común de estado efímero de acciones para loading, error, disabled o progreso.
- Modificar la semántica ya documentada de `preloads`, de historial interno, de ejecución de `api` o de reset por formulario.
- Introducir todavía nodos `form`, `link`, `input` o nuevas superficies interactivas más allá de dejar la base preparada para ellas.

## Requisitos funcionales
- El runtime debe considerar `action` como una pieza declarativa común, aunque en esta iteración siga usándose solo desde `button.props`.
- Una acción declarada debe representar exactamente una operación funcional por activación del trigger del nodo.
- El nodo `button` debe conservar la sintaxis visible actual basada en `props.label` y `props.action`.
- `button.props.action` debe seguir aceptando `navigateTo` y `goBack` con la misma semántica funcional ya estable.
- `button.props.action` debe poder declarar también `executeOperation`, identificando una operación existente del catálogo `api` por nombre.
- `button.props.action` debe poder declarar `resetForm`, identificando un formulario por `formId`.
- La acción `navigateTo` debe seguir cambiando la página visible por `pageId` dentro del catálogo `pages`, sin tocar la URL del navegador.
- La acción `goBack` debe seguir apoyándose en el historial interno del runtime y comportarse como `no-op` cuando no exista una página previa válida.
- La acción `executeOperation` debe reutilizar la misma semántica estable ya existente para ejecución remota por nombre:
  - escribir el resultado en `queries.{operationName}`
  - pasar por los mismos estados `loading | success | error`
  - conservar el último `data` válido durante recargas
  - reutilizar los mismos códigos de error orientados a UI
- La acción `resetForm` debe reutilizar el reset ya existente por `formId`, restaurando el estado inicial efectivo de los campos del formulario.
- Una acción declarada no debe requerir que el nodo visual conozca lógica imperativa específica de navegación, red o formularios más allá de disparar el contrato común.
- La validación del config debe rechazar antes del render:
  - shapes inválidos de `action`
  - acciones no soportadas
  - acciones con parámetros obligatorios ausentes o inválidos
  - referencias a páginas inexistentes en `navigateTo`
  - referencias a operaciones inexistentes en `executeOperation`
- Una configuración existente que solo use `button.props.action` con navegación debe mantener el comportamiento observable actual sin cambios.

## Requisitos no funcionales
- El contrato debe seguir siendo simple de generar desde backend legacy: una sola acción, shape corto y nombres explícitos.
- La feature debe preservar el alcance acotado de v1: resolver la base común de acciones sin convertirse todavía en un motor general de automatización UI.
- La terminología debe mantenerse alineada con el vocabulario ya existente del proyecto: `pages`, `button`, `action`, `api`, `queries`, `forms`, `navigateTo`, `goBack`, `executeOperation` y `resetForm`.
- La base común debe ser reutilizable por futuros nodos interactivos sin exigir una migración inmediata del contrato actual de `button`.
- La feature debe reaprovechar únicamente los dominios de estado existentes para reflejar el resultado visible de las acciones.
- La validación debe seguir siendo previa al render, diagnóstica en desarrollo y coherente con las rutas canónicas del JSON afectado.

## Criterios de aceptación
- Dado un config existente con `button.props.action` de navegación válida, el runtime mantiene el mismo comportamiento observable actual.
- Dado un `button` con `action.type: navigateTo` hacia una página existente y distinta de la visible, al activarlo el runtime muestra la página destino.
- Dado un `button` con `action.type: goBack` y sin historial previo válido, al activarlo no ocurre ningún cambio visible ni error recuperable nuevo.
- Dado un `button` con `action.type: executeOperation` hacia una operación declarada en `api`, al activarlo el runtime ejecuta esa operación y proyecta el resultado en `queries.{operationName}` con la misma semántica ya estable de loading, success o error.
- Dado un `button` con `action.type: executeOperation` hacia una operación cuya construcción de request falla por referencias sin resolver, el runtime refleja el mismo error de query ya documentado para esa operación y no inventa un dominio de error paralelo.
- Dado un `button` con `action.type: resetForm` hacia un `formId` existente en el estado del runtime, al activarlo el formulario vuelve a su estado inicial efectivo.
- Dado un config con `button.props.action` de tipo no soportado, la validación lo rechaza antes del render.
- Dado un config con `navigateTo.pageId` inexistente o `executeOperation.operationName` inexistente, la validación lo rechaza antes del render.
- Dada una configuración que no declare ninguna acción nueva fuera de navegación, el runtime mantiene compatibilidad hacia atrás sin exigir migración.

## Casos límite
- Un `button` puede existir sin `action` válida solo en el sentido de config inválido; el runtime no debe degradarlo silenciosamente a botón inerte.
- Activar `executeOperation` varias veces seguidas debe seguir resolviéndose con la semántica estable ya existente de recarga de query.
- `resetForm` sobre un formulario todavía no inicializado no debe abrir una semántica nueva distinta de la ya existente en el store compartido.
- Una acción común puede existir hoy solo en `button`, pero su shape debe ser suficientemente reutilizable como para encajar después en nodos con otro trigger implícito.
- Esta feature no abre todavía lectura declarativa de “acción en curso” ni “última acción fallida” para condicionar visibilidad o disabled de otros nodos.

## Riesgos o preguntas abiertas
- La base común queda preparada para futuros triggers, pero la sintaxis pública compartida de esos triggers sigue pendiente de una feature posterior.
- El catálogo inicial se mantiene deliberadamente corto; futuras necesidades como secuencias, follow-ups o acciones condicionadas deberán abrirse como alcance nuevo y no asumirse implícitamente.
- La feature sigue siendo transversal entre contrato JSON, validación y runtime compartido, por lo que `design.md` sigue siendo necesaria antes de implementar.

## Áreas de producto afectadas
- Runtime UI configurable
- Contrato de configuración
- Páginas y navegación
- Queries y feedback
- Formularios y validación

## Documentación probablemente afectada
- `ai-workflow/docs/current-state.md`
- `ai-workflow/docs/architecture.md`
- `ai-workflow/docs/app-features/config-contract.md`
- `ai-workflow/docs/app-features/config-driven-ui-runtime.md`
- `ai-workflow/docs/app-features/pages-and-navigation.md`
- `ai-workflow/docs/app-features/queries-and-feedback.md`
- `ai-workflow/docs/app-features/forms-and-validation.md`
