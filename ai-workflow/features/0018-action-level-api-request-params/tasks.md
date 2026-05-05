# Tasks: Action-level API request params

## T0018-01

### Estado
Completada

### Objetivo
Ampliar el contrato del runtime config para formalizar `api.headers` y para que `button.props.action.type: executeOperation` y `form.submitAction` acepten opcionalmente `query`, `body` y `headers`, cerrando en bootstrap todas las validaciones estructurales y semánticas que esta feature puede resolver antes del render.

### Fuera de alcance
- Ejecutar todavía requests combinadas en runtime.
- Resolver todavía referencias dinámicas de los overrides por ejecución.
- Cambiar todavía la firma del provider o el ejecutor común de acciones UI.
- Actualizar documentación funcional o arquitectónica en esta tarea.

### Dependencias
- `spec.md`
- `design.md`

### Impacto esperado en archivos
- Código a crear o modificar:
  - `src/config/runtime-config-types.ts`
  - `src/config/runtime-config-zod.ts`
  - `src/config/validate-runtime-config.ts`
  - `src/config/runtime-config.ts` solo si hace falta reexportar tipos nuevos desde la fachada pública
- Tests a crear o modificar:
  - `src/tests/runtime-config-validation.test.ts`
  - `src/tests/read-runtime-config.test.ts` solo si conviene fijar el borde de bootstrap con el contrato ampliado
- Documentación a revisar o actualizar después:
  - `ai-workflow/docs/app-features/config-contract.md`
  - `ai-workflow/docs/app-features/config-driven-ui-runtime.md`
  - `ai-workflow/docs/app-features/queries-and-feedback.md`
  - `ai-workflow/docs/app-features/forms-and-validation.md`
  - `ai-workflow/docs/architecture.md`

### Tests requeridos
- Confirmar que una operación `api` acepta `headers` con objeto plano de claves no vacías y valores string.
- Confirmar que `button.props.action.type: executeOperation` acepta opcionalmente `query`, `body` y `headers` con el mismo shape contractual aprobado para cada canal.
- Confirmar que `form.submitAction` acepta esos mismos canales opcionales con la misma semántica estructural.
- Confirmar que `GET` rechaza `body` tanto en la operación base como en la acción o submit.
- Confirmar que `query` y `headers` rechazan claves vacías o valores fuera de los tipos soportados.
- Confirmar que `headers` rechaza valores no string tanto en `api` como en acciones y submit.
- Confirmar que `executeOperation` y `submitAction` siguen rechazando `operationName` inexistente en `api`.
- Confirmar que configuraciones existentes que solo declaran `operationName` sin request params adicionales siguen siendo válidas y conservan el resultado normalizado actual.
- Confirmar que las claves extra de `api`, `action` y `submitAction` siguen descartándose sin introducir semántica nueva.

### Documentación afectada
- Pendiente de actualización posterior para reflejar `headers` como canal estable de `api` y el nuevo contrato opcional por ejecución en acciones y submit.

### Criterios de finalización
- El contrato JSON describe inequívocamente `api.headers`, `action.query`, `action.body`, `action.headers`, `submitAction.query`, `submitAction.body` y `submitAction.headers`.
- La validación previa al render separa de forma estable config inválido de dato dinámico aún no resoluble en runtime.
- La prohibición de `body` para `GET` queda cerrada por tests en ambas capas contractuales.
- La compatibilidad hacia atrás de `executeOperation` sin overrides queda fijada por tests.

### Cierre de implementación
Completado cuando bootstrap puede aceptar o rechazar de forma determinista toda la nueva superficie contractual sin dejar reglas críticas del request builder para los nodos visuales.

### Cierre documental
Pendiente de una pasada posterior sobre contrato, runtime, queries y formularios. No se cierra en esta tarea.

## T0018-02

### Estado
Completada

### Objetivo
Introducir en `src/queries/` la composición única entre operación base y parámetros por ejecución, ampliando la fachada de ejecución con `requestParams` y fijando la semántica estable de merge y resolución para `query`, `body` y `headers`.

### Fuera de alcance
- Cablear todavía botones o formularios renderizados para emitir overrides por ejecución.
- Duplicar lógica de merge en nodos visuales o en `runtime-actions/`.
- Añadir merge profundo, interpolación parcial o transformaciones arbitrarias fuera de la semántica cerrada por la spec.
- Actualizar documentación en esta tarea.

### Dependencias
- `T0018-01` completada

### Impacto esperado en archivos
- Código a crear o modificar:
  - `src/queries/runtime-api-types.ts`
  - `src/queries/runtime-api-request.ts`
  - `src/queries/runtime-api-executor.ts`
  - `src/runtime/runtime-state/runtime-state-provider.tsx`
  - `src/config/runtime-config.ts` solo si hace falta reexportar tipos auxiliares compartidos con `src/queries/`
- Tests a crear o modificar:
  - `src/tests/runtime-api-execution.test.ts`
  - `src/tests/runtime-state.test.tsx` solo si hace falta fijar la nueva firma pública del provider o helpers de snapshot
- Documentación a revisar o actualizar después:
  - `ai-workflow/docs/current-state.md`
  - `ai-workflow/docs/architecture.md`
  - `ai-workflow/docs/app-features/queries-and-feedback.md`
  - `ai-workflow/docs/app-features/config-driven-ui-runtime.md`

### Tests requeridos
- Confirmar que `api.headers` viaja al `RequestInit` resultante sin depender de un tratamiento ad hoc fuera del contrato.
- Confirmar que `requestParams.query` y `requestParams.headers` se combinan por clave con precedencia del override por ejecución.
- Confirmar que `requestParams.body` reemplaza por completo al body base cuando alguna de las dos capas usa un valor raíz no objeto.
- Confirmar que dos bodies raíz objeto se combinan solo en el primer nivel, con prevalencia de la acción o submit en las claves repetidas.
- Confirmar que el builder añade `content-type: application/json` solo cuando hay body serializado y el conjunto efectivo de headers no declara ya `content-type` en ninguna variante de casing.
- Confirmar que un `content-type` declarado explícitamente en la operación base o en el override por ejecución prevalece sobre la cabecera implícita del builder.
- Confirmar que el merge ocurre antes de resolver referencias y que la resolución usa un único snapshot runtime por ejecución.
- Confirmar que un valor no resoluble en cualquiera de los canales devuelve `request-build-failed` y no emite red.
- Confirmar que un header resuelto a valor no string también devuelve `request-build-failed`.
- Confirmar que la firma ampliada `executeRuntimeApiOperation` y `buildRuntimeApiRequest` mantiene compatibilidad con callers que no pasan `requestParams`.

### Documentación afectada
- Pendiente de actualización posterior para reflejar que la composición final del request vive ya solo en `src/queries/`.

### Criterios de finalización
- Existe una única capa de composición del request efectiva dentro de `src/queries/`.
- `query`, `body` y `headers` siguen una semántica de merge estable, limitada y comprobable.
- La convivencia entre `headers` declarativo y la inyección implícita de `content-type` queda cerrada por tests sin duplicidades accidentales.
- La resolución dinámica por ejecución sigue devolviendo los mismos errores normalizados del dominio `queries`.
- La ampliación de la fachada pública es compatible con `preloads` y con callers existentes sin overrides.

### Cierre de implementación
Completado cuando la frontera HTTP ya puede construir requests efectivos a partir de una operación base y un override por ejecución sin ambigüedad técnica ni lógica duplicada fuera de `src/queries/`.

### Cierre documental
Pendiente de una pasada posterior sobre arquitectura, runtime y queries. No se cierra en esta tarea.

## T0018-03

### Estado
Completada

### Objetivo
Conectar `button.props.action` y `form.submitAction` con la nueva capacidad de `requestParams`, asegurando que ambos triggers reutilizan exactamente la misma semántica, el mismo snapshot runtime y la misma superficie visible en `queries.{operationName}`.

### Fuera de alcance
- Añadir tipos nuevos de acción, secuencias o callbacks por éxito o error.
- Introducir estado visible nuevo para botones o formularios fuera de `queries`.
- Reabrir la semántica de `preloads`.
- Actualizar documentación en esta tarea.

### Dependencias
- `T0018-02` completada

### Impacto esperado en archivos
- Código a crear o modificar:
  - `src/runtime/runtime-actions/runtime-ui-action-executor.ts`
  - `src/runtime/nodes/button-layout-node.tsx` solo si hace falta un ajuste mínimo para seguir delegando el action completo sin lógica de merge local
  - `src/runtime/nodes/form-layout-node.tsx`
  - `src/runtime/runtime-state/runtime-state-provider.tsx`
  - `src/runtime/runtime-state/runtime-state-types.ts` solo si la firma pública del handler necesita tipos auxiliares explícitos
- Tests a crear o modificar:
  - `src/tests/runtime-ui-actions.test.tsx`
  - `src/tests/runtime-button-navigation.test.tsx`
  - `src/tests/runtime-state.test.tsx`
- Documentación a revisar o actualizar después:
  - `ai-workflow/docs/current-state.md`
  - `ai-workflow/docs/app-features/forms-and-validation.md`
  - `ai-workflow/docs/app-features/queries-and-feedback.md`
  - `ai-workflow/docs/app-features/config-driven-ui-runtime.md`

### Tests requeridos
- Confirmar que `executeRuntimeUiAction` reenvía `operationName` y los `requestParams` opcionales a `executeQueryOperation` sin esperar la promesa en la superficie del botón.
- Confirmar que un botón con `executeOperation.query`, `body` o `headers` ejecuta la operación combinada y proyecta el resultado en `queries.{operationName}`.
- Confirmar que un submit con `submitAction.query`, `body` o `headers` ejecuta esa misma semántica combinada usando el snapshot vigente tras la validación local del formulario.
- Confirmar que un cambio de campo seguido inmediatamente de submit sigue enviando el valor más reciente del usuario cuando el override por ejecución referencia `forms.*`.
- Confirmar que `resetOnSuccess` sigue dependiendo del resultado final de la operación combinada y no de una fase intermedia del submit.
- Confirmar que errores `request-build-failed`, `network-error`, `http-error` e `invalid-json-response` siguen apareciendo solo en `queries.{operationName}` sin una superficie paralela en botón o formulario.
- Confirmar que configuraciones previas sin request params por ejecución siguen funcionando desde botón y submit.

### Documentación afectada
- Pendiente de actualización posterior para reflejar la semántica compartida entre botón y formulario sobre `executeOperation`.

### Criterios de finalización
- Botón y formulario comparten exactamente la misma capacidad de parametrización por ejecución.
- Ningún nodo visual mergea o resuelve por su cuenta `query`, `body` o `headers`.
- La lectura del snapshot runtime sigue ocurriendo en el momento real de disparo y no durante bootstrap ni render.
- La semántica visible del submit y del click sigue viviendo exclusivamente en `queries` y, para reset, en `forms`.

### Cierre de implementación
Completado cuando los dos triggers declarativos existentes ya pueden pasar overrides por ejecución de extremo a extremo sin introducir divergencias funcionales entre botón, formulario y provider.

### Cierre documental
Pendiente de una pasada posterior sobre runtime, formularios y queries. No se cierra en esta tarea.

## T0018-04

### Estado
Completada

### Objetivo
Cerrar la regresión final del subconjunto afectado validando conjuntamente contrato ampliado, composición de requests, integración de botón y submit, compatibilidad hacia atrás y gate global de coverage.

### Fuera de alcance
- Añadir capacidades nuevas fuera de la spec.
- Reabrir decisiones contractuales o de merge ya fijadas por las tareas anteriores.
- Realizar en esta tarea la pasada documental amplia.

### Dependencias
- `T0018-03` completada

### Impacto esperado en archivos
- Código a crear o modificar:
  - cualquier ajuste mínimo residual en `src/config/`, `src/queries/`, `src/runtime/` o `src/tests/` necesario para cerrar la integración
- Tests a crear o modificar:
  - `src/tests/runtime-config-validation.test.ts`
  - `src/tests/read-runtime-config.test.ts` solo si quedó cubriendo un borde real de bootstrap
  - `src/tests/runtime-api-execution.test.ts`
  - `src/tests/runtime-ui-actions.test.tsx`
  - `src/tests/runtime-button-navigation.test.tsx`
  - `src/tests/runtime-state.test.tsx`
  - `src/tests/layout-renderer.test.tsx` solo si aparece impacto visible real en el renderer
- Documentación a revisar o actualizar después:
  - `ai-workflow/docs/app-features/config-contract.md`
  - `ai-workflow/docs/app-features/config-driven-ui-runtime.md`
  - `ai-workflow/docs/app-features/queries-and-feedback.md`
  - `ai-workflow/docs/app-features/forms-and-validation.md`
  - `ai-workflow/docs/current-state.md`
  - `ai-workflow/docs/architecture.md`
  - `ai-workflow/features/index.md`

### Tests requeridos
- Ejecutar la regresión conjunta del contrato ampliado, del request builder con merge y de la integración visible desde botón y submit.
- Confirmar que `api.headers` y los overrides por ejecución conviven sin romper casos previos de `query` o `body`.
- Confirmar que no aparecen duplicidades accidentales de `content-type` cuando existe body y también headers declarativos efectivos.
- Confirmar que `preloads` y llamadas existentes a `executeQueryOperation(operationName)` siguen funcionando sin necesidad de `requestParams`.
- Confirmar que configuraciones históricas con `executeOperation` sin payload adicional conservan su comportamiento observable.
- Confirmar que los errores de construcción del request siguen evitando emisión de red en cualquier trigger.
- Ejecutar `pnpm test` para validar el gate global de coverage del proyecto.

### Documentación afectada
- Pendiente de una pasada posterior de documentación sobre contrato, runtime, queries, formularios y estado actual.

### Criterios de finalización
- No quedan incoherencias entre contrato JSON, request builder, provider, botón y formulario respecto a `query`, `body` y `headers`.
- La compatibilidad hacia atrás del runtime queda fijada por regresión.
- El subconjunto afectado del runtime queda validado por tests relevantes y por el gate global de coverage.

### Cierre de implementación
Completado cuando la feature queda cerrada de extremo a extremo, sin divergencias entre capas y con regresión suficiente para evitar reinterpretaciones futuras del contrato.

### Cierre documental
Pendiente de una pasada posterior sobre fichas funcionales, arquitectura y estado global. No se cierra en esta tarea.

## Orden de ejecución
La siguiente tarea que debe escogerse en implementación es `T0018-01`.

No se debe empezar `T0018-02` hasta cerrar `T0018-01`, ni `T0018-03` hasta cerrar `T0018-02`, ni `T0018-04` hasta cerrar `T0018-03`.
