# Tasks: Declarative form node catalog

## T0015-01

### Estado
Completada

### Objetivo
Ampliar el contrato del runtime config para soportar `form`, `input`, `textarea` y `select`, relajar estructuralmente `button.props.action` para permitir submit declarativo y cerrar en bootstrap todas las validaciones semánticas que la feature puede resolver antes del render.

### Fuera de alcance
- Renderizar todavía formularios o campos en React.
- Inicializar todavía el store `forms` desde el árbol declarativo.
- Ejecutar todavía submit, validación `required` o `resetOnSuccess` en runtime.
- Actualizar documentación funcional o arquitectónica dentro de esta tarea.

### Dependencias
- `spec.md`
- `design.md`

### Impacto esperado en archivos
- Código a crear o modificar:
  - `src/config/runtime-config-types.ts`
  - `src/config/runtime-config-zod.ts`
  - `src/config/validate-runtime-config.ts`
  - `src/config/runtime-config.ts` solo si hace falta exportar tipos nuevos desde la fachada pública
- Tests a crear o modificar:
  - `src/tests/runtime-config-validation.test.ts`
  - `src/tests/read-runtime-config.test.ts` solo si conviene fijar el borde de bootstrap con el contrato ampliado
- Documentación a revisar o actualizar después:
  - `ai-workflow/docs/app-features/config-contract.md`
  - `ai-workflow/docs/app-features/config-driven-ui-runtime.md`
  - `ai-workflow/docs/app-features/forms-and-validation.md`
  - `ai-workflow/docs/architecture.md`

### Tests requeridos
- Confirmar que `form` acepta `id`, `children`, `submitAction` y `resetOnSuccess` con el shape aprobado.
- Confirmar que `input`, `textarea` y `select` solo son válidos dentro de un `form`.
- Confirmar que `input`, `textarea`, `select` y un `button` sin `action` siguen siendo válidos cuando cuelgan de un `container` descendiente de un `form`, y que siguen siendo inválidos fuera de ese subárbol.
- Confirmar que `form.id` se rechaza cuando se repite en cualquier página del config.
- Confirmar que `fieldId` repetido dentro del mismo `form` rechaza el config completo.
- Confirmar que `form.children` acepta solo `input`, `textarea`, `select`, `button`, `heading`, `paragraph` y `container`.
- Confirmar que un `button` sin `action` dentro de `form.children` es válido y que el mismo nodo fuera de `form` es inválido.
- Confirmar que `submitAction.type` solo admite `executeOperation` y que `operationName` debe existir en `api`.
- Confirmar que `resetOnSuccess: true` sin `submitAction` rechaza el config completo.
- Confirmar que `select.props.items` acepta solo valores homogéneos `string` o `number` dentro del mismo campo.
- Confirmar que `queryStateFeedback` sigue siendo válido sobre `form`, `input`, `textarea` y `select`.
- Confirmar que una configuración previa sin `form` conserva el resultado normalizado actual.

### Documentación afectada
- Pendiente de actualización posterior para reflejar el nuevo catálogo de formularios y sus reglas de validación previa al render.

### Criterios de finalización
- El contrato JSON ya describe inequívocamente formularios y campos del catálogo inicial.
- La validación previa al render cierra las reglas de ancestry, unicidad, `submitAction`, `resetOnSuccess` y `button` submit implícito.
- El contrato de `button` ampliado mantiene compatibilidad hacia atrás con botones que ya declaran `action`.
- Los tests relevantes del contrato quedan en verde.

### Cierre de implementación
Completado cuando bootstrap puede aceptar o rechazar de forma determinista toda la superficie nueva del config sin dejar reglas contractuales críticas para el renderer.

### Cierre documental
Pendiente de una pasada posterior sobre fichas funcionales y arquitectura. No se cierra en esta tarea.

## T0015-02

### Estado
Completada

### Objetivo
Introducir el catálogo visible de `form`, `input`, `textarea` y `select` en el runtime, junto con la herencia de contexto de formulario y la inicialización lazy de `forms.{formId}.{fieldId}` usando `defaultValue` literal o dinámico sin sobrescribir estado ya existente.

### Fuera de alcance
- Bloquear todavía el submit por `required`.
- Ejecutar todavía `submitAction` o `resetOnSuccess`.
- Resolver todavía la semántica final de botones submit frente a botones auxiliares.
- Actualizar documentación en esta tarea.

### Dependencias
- `T0015-01` completada

### Impacto esperado en archivos
- Código a crear o modificar:
  - `src/runtime/layout-node-renderer.tsx`
  - `src/runtime/layout-renderer.tsx` solo si hace falta adaptar la composición del nuevo nodo `form`
  - `src/runtime/nodes/form-layout-node.tsx`
  - `src/runtime/nodes/input-layout-node.tsx`
  - `src/runtime/nodes/textarea-layout-node.tsx`
  - `src/runtime/nodes/select-layout-node.tsx`
  - `src/runtime/form-context.tsx` o un helper equivalente si hace falta propagar el `formId` por descendencia sin acoplar los nodos de campo a props manuales repetidas
  - `src/runtime/runtime-node-styling.ts`
  - `src/runtime/runtime-references/runtime-reference-resolver.ts` o un helper adyacente si hace falta reutilizar resolución de `defaultValue` fuera de superficies textuales
  - `src/runtime/runtime-state/runtime-state-selectors.ts`
  - `src/runtime/runtime-state/runtime-state-types.ts` solo si la implementación necesita tipos auxiliares explícitos para definiciones de campo
  - `src/runtime/runtime-state/runtime-state-provider.tsx` solo si hace falta exponer una primitiva estable para inicializar formularios desde el nodo `form`
- Tests a crear o modificar:
  - `src/tests/layout-renderer.test.tsx`
  - `src/tests/runtime-state.test.tsx`
  - `src/tests/runtime-reference-resolution.test.tsx` solo si se extrae un helper reutilizable de resolución de referencias
  - `src/tests/app-shell.test.tsx` solo si el render visible base del runtime cambia de forma apreciable
- Documentación a revisar o actualizar después:
  - `ai-workflow/docs/current-state.md`
  - `ai-workflow/docs/architecture.md`
  - `ai-workflow/docs/app-features/config-driven-ui-runtime.md`
  - `ai-workflow/docs/app-features/forms-and-validation.md`

### Tests requeridos
- Confirmar que un `form` válido renderiza un `<form>` real con sus hijos en orden.
- Confirmar que los campos y botones auxiliares pueden renderizarse correctamente también cuando están anidados dentro de `container` bajo el mismo `form`.
- Confirmar que `input`, `textarea` y `select` leen y escriben exclusivamente en `forms.{formId}.{fieldId}`.
- Confirmar que el primer render inicializa solo los campos todavía ausentes en el store.
- Confirmar que un rerender o un regreso a la página no sobrescribe valores ya modificados por el usuario.
- Confirmar que `defaultValue` literal y dinámico se resuelven solo en la primera inicialización del campo.
- Confirmar que un `defaultValue` dinámico que aparece más tarde no rehidrata el campo después de su inicialización inicial.
- Confirmar que `select` normaliza a string los valores numéricos y deja vacío un `defaultValue` que no coincide con ninguna opción.
- Confirmar que varios formularios en la misma página mantienen aislamiento completo de estado.
- Confirmar que `queryStateFeedback` sigue pudiendo ocultar o mostrar `form` y campos sin borrar su estado existente.

### Documentación afectada
- Pendiente de actualización posterior para reflejar el catálogo visible de formularios y su semántica de inicialización.

### Criterios de finalización
- Los nuevos nodos del catálogo ya existen y renderizan controles accesibles básicos.
- La inicialización declarativa de campos queda centralizada en el `form` y fijada por tests.
- Los valores de formularios persisten en la misma instancia del runtime sin sobrescrituras inesperadas.
- La tarea deja explícitamente diferida a `T0015-03` la validación `required` y a `T0015-04` el submit declarativo.

### Cierre de implementación
Completado cuando el runtime ya puede mostrar formularios reales desde JSON y sostener su estado compartido con defaults estables sin trabajo ambiguo pendiente sobre inicialización.

### Cierre documental
Pendiente de una pasada posterior sobre runtime, formularios y estado actual. No se cierra en esta tarea.

## T0015-03

### Estado
Completada

### Objetivo
Añadir la validación declarativa `required` en la capa de formulario, reutilizando `forms.*` para errores por campo y una semántica compartida de visibilidad efectiva para que los campos ocultos por `queryStateFeedback` no bloqueen el submit.

### Fuera de alcance
- Ejecutar todavía `submitAction` contra `api`.
- Añadir validaciones declarativas nuevas fuera de `required`.
- Introducir mensajes personalizados, resúmenes de error o una UX avanzada de validación.
- Actualizar documentación en esta tarea.

### Dependencias
- `T0015-02` completada

### Impacto esperado en archivos
- Código a crear o modificar:
  - `src/runtime/nodes/form-layout-node.tsx`
  - `src/runtime/nodes/input-layout-node.tsx`
  - `src/runtime/nodes/textarea-layout-node.tsx`
  - `src/runtime/nodes/select-layout-node.tsx`
  - `src/runtime/layout-node-renderer.tsx` solo si hace falta extraer una utilidad compartida de visibilidad efectiva
  - `src/runtime/runtime-query-state-feedback.ts` o un helper adyacente para compartir la decisión visible entre renderer y submit
  - `src/runtime/runtime-state/runtime-state-selectors.ts`
  - `src/runtime/runtime-node-styling.ts` para reflejar el estado visual mínimo de error
  - `src/runtime/runtime-state/runtime-state-provider.tsx` o un helper adyacente si hace falta exponer setters, helpers adicionales del dominio `forms` o una lectura estable del último snapshot para validar sin carreras contra eventos de cambio recién disparados
- Tests a crear o modificar:
  - `src/tests/layout-renderer.test.tsx`
  - `src/tests/runtime-state.test.tsx`
  - `src/tests/runtime-page-entry-preloads.test.tsx` solo si hace falta demostrar una interacción real con queries que gobiernan visibilidad
- Documentación a revisar o actualizar después:
  - `ai-workflow/docs/current-state.md`
  - `ai-workflow/docs/architecture.md`
  - `ai-workflow/docs/app-features/forms-and-validation.md`
  - `ai-workflow/docs/app-features/queries-and-feedback.md`

### Tests requeridos
- Confirmar que `input` y `textarea` `required` consideran inválido `''` y también strings solo con espacios.
- Confirmar que `select` `required` considera inválido `''` aunque exista una opción placeholder visible.
- Confirmar que el submit bloqueado escribe errores solo en `forms.{formId}.{fieldId}.error`.
- Confirmar que un cambio de campo seguido inmediatamente de submit valida contra el valor más reciente del usuario y no contra un snapshot anterior del store.
- Confirmar que un campo con error limpia ese error al volver a un valor válido sin exigir un nuevo submit.
- Confirmar que un campo visible y obligatorio sin valor bloquea el submit.
- Confirmar que un campo oculto por `queryStateFeedback` no bloquea el submit aunque conserve error previo.
- Confirmar que ocultar un campo o un formulario no borra ni el valor ni el error existente.
- Confirmar que, al reaparecer, el campo conserva su estado previo.

### Documentación afectada
- Pendiente de actualización posterior para reflejar la validación `required`, la persistencia de errores y la relación con `queryStateFeedback`.

### Criterios de finalización
- La validación `required` queda centralizada en la capa de formulario y no dispersa entre controles.
- Los errores por campo viven exclusivamente en el dominio compartido `forms`.
- Renderer y submit comparten la misma semántica de visibilidad efectiva.
- El formulario ya dispone de un `onSubmit` local capaz de bloquear envíos inválidos sin ejecutar todavía `submitAction`.
- Los tests relevantes de validación y visibilidad quedan en verde.

### Cierre de implementación
Completado cuando el formulario ya puede bloquear envíos inválidos de forma determinista, sin contradicción entre campos visibles y ocultos ni dominios paralelos de error.

### Cierre documental
Pendiente de una pasada posterior sobre formularios, queries y estado actual. No se cierra en esta tarea.

## T0015-04

### Estado
Completada

### Objetivo
Conectar el submit declarativo del nodo `form` con `submitAction.type: executeOperation`, respetar la semántica nativa de `<form>` y cerrar la convivencia entre botones submit implícitos y botones auxiliares con `action`.

### Fuera de alcance
- Añadir estados nuevos de `submitting`, `submitError` o `submitSuccess` fuera de `queries`.
- Introducir secuencias de acciones, callbacks por resultado o branching.
- Reabrir el catálogo de acciones UI fuera del alcance ya fijado por `0014`.
- Actualizar documentación en esta tarea.

### Dependencias
- `T0015-03` completada

### Impacto esperado en archivos
- Código a crear o modificar:
  - `src/runtime/nodes/form-layout-node.tsx`
  - `src/runtime/nodes/button-layout-node.tsx`
  - `src/runtime/runtime-actions/runtime-ui-action-executor.ts` solo si hace falta acomodar el caso explícito de botones auxiliares dentro de formularios
  - `src/runtime/runtime-state/runtime-state-provider.tsx`
  - `src/runtime/runtime-state/runtime-state-selectors.ts` solo si hace falta lectura auxiliar del estado agregado durante submit
  - `src/runtime/layout-node-renderer.tsx` solo si la integración del `form` exige un ajuste mínimo del borde central
- Tests a crear o modificar:
  - `src/tests/layout-renderer.test.tsx`
  - `src/tests/runtime-state.test.tsx`
  - `src/tests/runtime-api-execution.test.ts`
  - `src/tests/runtime-button-navigation.test.tsx`
  - `src/tests/runtime-ui-actions.test.tsx` solo si la convivencia con botones auxiliares requiere fijar un límite adicional
- Documentación a revisar o actualizar después:
  - `ai-workflow/docs/current-state.md`
  - `ai-workflow/docs/architecture.md`
  - `ai-workflow/docs/app-features/config-contract.md`
  - `ai-workflow/docs/app-features/config-driven-ui-runtime.md`
  - `ai-workflow/docs/app-features/forms-and-validation.md`
  - `ai-workflow/docs/app-features/queries-and-feedback.md`

### Tests requeridos
- Confirmar que el submit del `form` se dispara tanto por Enter cuando aplica como por un `button` sin `action` dentro de `form.children`.
- Confirmar que la misma semántica aplica también a un `button` sin `action` anidado dentro de un `container` descendiente del `form`.
- Confirmar que un `button` con `action` explícita dentro del `form` ejecuta su propia acción y no dispara el submit implícito.
- Confirmar que `submitAction.executeOperation` reutiliza `queries.{operationName}` como única superficie visible de loading, success y error.
- Confirmar que un cambio de campo seguido inmediatamente de submit envía el valor más reciente del formulario en `api.body`.
- Confirmar que un submit exitoso con `resetOnSuccess: true` resetea el formulario a su estado inicial efectivo.
- Confirmar que un submit exitoso con `resetOnSuccess: false` conserva los valores actuales.
- Confirmar que un submit fallido conserva los valores del usuario y no resetea el formulario.
- Confirmar que un `api.body` que referencia `forms.{formId}.{fieldId}` envía los valores actuales del formulario sin adaptador específico adicional.
- Confirmar que la convivencia con botones auxiliares como `resetForm` o `navigateTo` no rompe la semántica propia del formulario.

### Documentación afectada
- Pendiente de actualización posterior para reflejar submit declarativo, Enter, `resetOnSuccess` y convivencia con botones auxiliares.

### Criterios de finalización
- El nodo `form` ya ejecuta submit declarativo de extremo a extremo.
- La semántica nativa de `<form>` y la distinción submit/auxiliar quedan fijadas por tests.
- No aparece un dominio paralelo de estado de submit fuera de `queries`.
- `resetOnSuccess` reutiliza la semántica estable de reset por `formId`.

### Cierre de implementación
Completado cuando el formulario ya puede enviar, bloquear, resetear o conservar valores exactamente según la spec, sin ambigüedad técnica sobre dónde vive la lógica de submit.

### Cierre documental
Pendiente de una pasada posterior sobre contrato, runtime y formularios. No se cierra en esta tarea.

## T0015-05

### Estado
Completada

### Objetivo
Cerrar la regresión final de la feature validando conjuntamente contrato, renderer, store compartido, visibilidad por query, submit declarativo y compatibilidad hacia atrás del runtime sin formularios.

### Fuera de alcance
- Añadir nuevas capacidades fuera de la spec.
- Realizar en esta tarea la pasada documental amplia.
- Reabrir decisiones ya fijadas en `design.md`.

### Dependencias
- `T0015-04` completada

### Impacto esperado en archivos
- Código a crear o modificar:
  - cualquier ajuste mínimo residual en `src/config/`, `src/runtime/`, `src/queries/` o `src/tests/` estrictamente necesario para cerrar la integración
- Tests a crear o modificar:
  - `src/tests/runtime-config-validation.test.ts`
  - `src/tests/read-runtime-config.test.ts`
  - `src/tests/layout-renderer.test.tsx`
  - `src/tests/runtime-state.test.tsx`
  - `src/tests/runtime-api-execution.test.ts`
  - `src/tests/runtime-button-navigation.test.tsx`
  - `src/tests/runtime-reference-resolution.test.tsx` solo si la implementación final tocó la resolución genérica de referencias
  - `src/tests/app-shell.test.tsx` solo si aparece impacto visible en bootstrap o render inicial
- Documentación a revisar o actualizar después:
  - `ai-workflow/docs/current-state.md`
  - `ai-workflow/docs/architecture.md`
  - `ai-workflow/docs/app-features/config-contract.md`
  - `ai-workflow/docs/app-features/config-driven-ui-runtime.md`
  - `ai-workflow/docs/app-features/forms-and-validation.md`
  - `ai-workflow/docs/app-features/queries-and-feedback.md`
  - `ai-workflow/features/index.md`

### Tests requeridos
- Ejecutar la regresión conjunta del contrato de formularios, de la inicialización lazy, de `required`, de `queryStateFeedback` aplicado a formularios/campos y del submit declarativo.
- Confirmar que varias instancias del runtime siguen aisladas aunque ahora monten formularios reales.
- Confirmar que una configuración previa sin `form` conserva el comportamiento observable actual del runtime.
- Confirmar que las referencias `forms.*` siguen resolviéndose correctamente cuando los valores cambian desde controles declarativos reales.
- Confirmar que la convivencia con `preloads` y con queries reutilizadas por `queryStateFeedback` no abre regresiones laterales.
- Ejecutar `pnpm test` para validar el gate global de coverage del proyecto.

### Documentación afectada
- Pendiente de actualización posterior para reflejar el comportamiento estable final de la feature en runtime, contrato y formularios.

### Criterios de finalización
- No quedan incoherencias entre contrato JSON, renderer, store compartido, submit y queries.
- Las configuraciones previas sin formularios siguen siendo compatibles.
- La regresión relevante del runtime queda en verde.
- `pnpm test` mantiene el umbral global mínimo del proyecto.

### Cierre de implementación
Completado cuando la feature queda integrada, validada y lista para la pasada documental posterior sin trabajo técnico pendiente dentro del alcance aprobado.

### Cierre documental
Pendiente de una pasada posterior de `update-app-documentation` sobre los documentos listados en el impacto documental.

## Orden de ejecución
Todas las tareas planificadas de implementación para esta feature están completadas.
