# Tasks: Shared runtime UI actions foundation

## T0014-01

### Estado
Completada

### Objetivo
Promover `button.props.action` a un contrato común del runtime basado en una unión reutilizable de acciones UI, ampliando el shape soportado a `navigateTo`, `goBack`, `executeOperation` y `resetForm`, y cerrando en bootstrap las validaciones estructurales y semánticas que la spec deja exigidas.

### Fuera de alcance
- Ejecutar todavía las acciones nuevas desde el renderer React.
- Sustituir todavía el ejecutor específico de navegación por el ejecutor común del runtime.
- Introducir triggers generales como `events`, `onClick` u `onSubmit`.
- Validar semánticamente `resetForm.formId` contra un catálogo de formularios inexistente en el contrato actual.
- Actualizar documentación funcional o arquitectónica en esta misma tarea.

### Dependencias
- `spec.md`
- `design.md`

### Impacto esperado en archivos
- Código a crear o modificar:
  - `src/config/runtime-config-types.ts`
  - `src/config/runtime-config-zod.ts`
  - `src/config/validate-runtime-config.ts`
  - `src/config/runtime-config.ts` solo si hace falta exportar el contrato común con un nombre nuevo
- Tests a crear o modificar:
  - `src/tests/runtime-config-validation.test.ts`
  - `src/tests/read-runtime-config.test.ts` solo si conviene fijar el borde de bootstrap con el contrato ampliado
- Documentación a revisar o actualizar después:
  - `ai-workflow/docs/app-features/config-contract.md`
  - `ai-workflow/docs/app-features/config-driven-ui-runtime.md`
  - `ai-workflow/docs/app-features/pages-and-navigation.md`
  - `ai-workflow/docs/app-features/queries-and-feedback.md`
  - `ai-workflow/docs/app-features/forms-and-validation.md`

### Tests requeridos
- Confirmar que `button.props.action` sigue aceptando `navigateTo` y `goBack` sin cambiar el resultado normalizado actual.
- Confirmar que `button.props.action` acepta `executeOperation` con `operationName` string no vacío.
- Confirmar que `button.props.action` acepta `resetForm` con `formId` string no vacío.
- Confirmar que un `type` de acción no soportado sigue rechazando el config antes del render con ruta diagnóstica precisa.
- Confirmar que `navigateTo.pageId` hacia una página inexistente rechaza el config completo.
- Confirmar que `executeOperation.operationName` hacia una operación inexistente en `api` rechaza el config completo.
- Confirmar que `resetForm` valida shape y `formId` no vacío, pero no exige catálogo semántico adicional en bootstrap.
- Confirmar que las claves extra de `action` siguen descartándose del resultado validado final.

### Documentación afectada
- Pendiente de actualización posterior para reflejar el nuevo catálogo común de acciones UI y sus límites de validación previa al render.

### Criterios de finalización
- Existe un contrato técnico único y reutilizable para acciones UI del runtime.
- `button.props.action` mantiene compatibilidad hacia atrás mientras adopta ese contrato común.
- La validación previa al render rechaza shapes inválidos y referencias semánticas cerrables para `pages` y `api`.
- El límite intencional de `resetForm` queda fijado por tests y no se deja a interpretación en implementación posterior.
- Los tests relevantes del contrato quedan en verde.

### Cierre de implementación
Completado cuando el JSON del runtime ya puede describir inequívocamente las cuatro acciones soportadas y bootstrap valida de forma determinista todo lo que esta feature puede cerrar antes del render.

### Cierre documental
Pendiente de una pasada posterior para actualizar fichas funcionales y estado global. No se cierra en esta tarea.

## T0014-02

### Estado
Completada

### Objetivo
Sustituir el ejecutor específico de navegación por un ejecutor común de acciones UI en `src/runtime/runtime-actions/`, mapeando cada variante del contrato a las primitivas ya existentes del provider sin introducir estado efímero nuevo ni lógica de dominio dentro del nodo `button`.

### Fuera de alcance
- Cerrar todavía la regresión visible completa de `executeOperation` y `resetForm` desde botones renderizados.
- Añadir estados de loading, disabled o error propios del botón.
- Introducir composición de varias acciones por click o callbacks por éxito/error.
- Reorganizar el provider más allá de exponer claramente los handlers que el ejecutor necesita.
- Actualizar documentación en esta tarea.

### Dependencias
- `T0014-01` completada

### Impacto esperado en archivos
- Código a crear o modificar:
  - `src/runtime/runtime-actions/runtime-ui-action-executor.ts`
  - `src/runtime/runtime-actions/runtime-navigation-action-executor.ts` para eliminarlo, redirigirlo o dejar de usarlo
  - `src/runtime/nodes/button-layout-node.tsx`
  - `src/runtime/runtime-state/runtime-state-provider.tsx` solo si hace falta estabilizar el surface de handlers del hook `useRuntimeStateActions`
  - `src/config/runtime-config.ts` solo si el ejecutor importa el tipo común desde la fachada pública
- Tests a crear o modificar:
  - `src/tests/runtime-ui-actions.test.ts` como unidad nueva para fijar el mapeo `action -> handler`
  - `src/tests/runtime-button-navigation.test.tsx`
- Documentación a revisar o actualizar después:
  - `ai-workflow/docs/architecture.md`
  - `ai-workflow/docs/current-state.md`
  - `ai-workflow/docs/app-features/config-driven-ui-runtime.md`

### Tests requeridos
- Confirmar que `navigateTo` invoca solo `navigateToPage(pageId)`.
- Confirmar que `goBack` invoca solo `goBackPage()`.
- Confirmar que `executeOperation` invoca `void executeQueryOperation(operationName)` sin esperar una promesa en el nodo visual.
- Confirmar que `resetForm` invoca solo `resetForm(formId)`.
- Confirmar que `button-layout-node.tsx` delega al ejecutor común y no conserva ramas imperativas específicas por tipo de acción.
- Confirmar que la navegación por botón sigue funcionando exactamente igual con el ejecutor común.

### Documentación afectada
- Pendiente de actualización posterior para reflejar que la interpretación de acciones UI vive ya en una capa transversal del runtime.

### Criterios de finalización
- Existe un ejecutor común del runtime preparado para futuros triggers sin estar acoplado al botón.
- `ButtonNode` conserva una responsabilidad mínima de presentación y trigger.
- El provider sigue siendo la única superficie que conoce navegación, queries y formularios como dominios de estado.
- La compatibilidad observable de navegación queda fijada por tests.

### Cierre de implementación
Completado cuando la decisión de qué hace cada `action.type` deja de vivir en el nodo visual y queda concentrada en una capa común, testeada y reutilizable.

### Cierre documental
Pendiente de una pasada posterior sobre arquitectura y runtime. No se cierra en esta tarea.

## T0014-03

### Estado
Completada

### Objetivo
Conectar y validar de extremo a extremo las acciones `executeOperation` y `resetForm` desde botones renderizados, cerrar la regresión final del subconjunto afectado y dejar la feature lista para una pasada documental posterior sin deuda técnica ambigua dentro del alcance aprobado.

### Fuera de alcance
- Añadir acciones nuevas fuera del catálogo aprobado.
- Exponer estado declarativo de “acción en curso” o “última acción fallida”.
- Reabrir la semántica estable de `preloads`, historial de navegación o `queryStateFeedback`.
- Realizar la pasada documental amplia de la feature.

### Dependencias
- `T0014-02` completada

### Impacto esperado en archivos
- Código a crear o modificar:
  - `src/runtime/nodes/button-layout-node.tsx`
  - `src/runtime/runtime-actions/runtime-ui-action-executor.ts`
  - `src/runtime/runtime-state/runtime-state-provider.tsx` solo si hace falta un ajuste mínimo para que los handlers sigan siendo testeables y coherentes
  - cualquier ajuste estrictamente acotado en `src/runtime/runtime-page.tsx` o `src/runtime/layout-renderer.tsx` solo si la integración visible o `queryStateFeedback` lo exige de verdad
- Tests a crear o modificar:
  - `src/tests/runtime-button-navigation.test.tsx`
  - `src/tests/runtime-state.test.tsx`
  - helpers o harnesses locales de test dentro de esos archivos para inicializar y mutar formularios desde el provider mientras el trigger sigue ocurriendo desde un `button` renderizado
  - `src/tests/layout-renderer.test.tsx` solo si hace falta fijar la compatibilidad de `button` con el resto del renderer
  - `src/tests/runtime-api-execution.test.ts` solo si aparece una laguna real del contrato compartido de ejecución remota
  - `src/tests/runtime-config-validation.test.ts`
  - `src/tests/read-runtime-config.test.ts`
  - `src/tests/runtime-ui-actions.test.ts`
  - `src/tests/app-shell.test.tsx` solo si aparece impacto visible en bootstrap o render inicial
- Documentación a revisar o actualizar después:
  - `ai-workflow/docs/current-state.md`
  - `ai-workflow/docs/architecture.md`
  - `ai-workflow/docs/app-features/config-contract.md`
  - `ai-workflow/docs/app-features/queries-and-feedback.md`
  - `ai-workflow/docs/app-features/forms-and-validation.md`
  - `ai-workflow/docs/app-features/config-driven-ui-runtime.md`
  - `ai-workflow/docs/app-features/pages-and-navigation.md`
  - `ai-workflow/features/index.md`

### Tests requeridos
- Confirmar que un botón con `executeOperation` ejecuta la operación declarada y proyecta el resultado en `queries.{operationName}`.
- Confirmar que una recarga disparada por `executeOperation` conserva el último `data` válido mientras `status` vuelve a `loading`.
- Confirmar que `executeOperation` reutiliza los mismos errores `operation-not-found`, `request-build-failed`, `network-error`, `http-error` e `invalid-json-response` sin inventar una superficie paralela de error en el botón.
- Confirmar que un botón con `resetForm` restaura el estado inicial efectivo del formulario objetivo sin afectar otros formularios del runtime.
- Confirmar que `resetForm` sobre un formulario no inicializado mantiene la semántica estable actual del store y no rompe la pantalla.
- Confirmar que configuraciones previas que solo usan navegación siguen funcionando dentro del mismo archivo de regresión del botón.
- Repetir la regresión conjunta del contrato `action`, del ejecutor común y del comportamiento visible del botón para cerrar la feature sin incoherencias entre capas.
- Ejecutar `pnpm test` para validar el gate global de coverage del proyecto al cierre de la tarea.

### Documentación afectada
- Pendiente de actualización posterior para reflejar acciones API y reset declarativo de formularios desde el árbol del layout.

### Criterios de finalización
- `executeOperation` y `resetForm` funcionan desde `button.props.action` de extremo a extremo.
- La semántica visible sigue viviendo exclusivamente en `queries`, `forms` y `navigation`.
- No aparecen estados efímeros ni mensajes nuevos acoplados al botón.
- La regresión de comportamiento relevante del runtime queda en verde.
- `pnpm test` mantiene el umbral global mínimo del proyecto.

### Cierre de implementación
Completado cuando las acciones nuevas ya están operativas desde el layout, sus efectos visibles son exactamente los de los dominios compartidos existentes y la regresión final demuestra coherencia entre contrato, ejecutor y renderer.

### Cierre documental
Pendiente de una pasada posterior sobre fichas funcionales y estado actual. No se cierra en esta tarea.

## Orden de ejecución
La siguiente tarea que debe escogerse en implementación es `T0014-01`.

No se debe empezar `T0014-02` hasta cerrar `T0014-01`, ni `T0014-03` hasta cerrar `T0014-02`.
