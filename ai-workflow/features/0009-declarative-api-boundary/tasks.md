# Tasks: Declarative API boundary

## T0009-01

### Estado
Completada

### Objetivo
Convertir `config.api` en un contrato tipado y validado de operaciones remotas declarativas, fijando desde tests qué shapes, métodos y combinaciones de `query` y `body` forman parte del soporte real de v1.

### Fuera de alcance
- Ejecutar todavía llamadas de red reales.
- Hidratar el dominio `queries` desde el provider.
- Diseñar `preloads`, refetch automáticos, botones declarativos o acciones de formulario.

### Dependencias
- `spec.md`
- `design.md`

### Impacto esperado en archivos
- Código a crear o modificar:
  - `src/config/runtime-config-types.ts`
  - `src/config/validate-runtime-config.ts`
  - `src/config/runtime-config.ts` si la fachada pública necesita exportar nuevos tipos de `api`
- Tests a crear o modificar:
  - `src/tests/runtime-config-validation.test.ts`
  - `src/tests/read-runtime-config.test.ts` solo si hace falta fijar el comportamiento del borde `data-config` con operaciones válidas e inválidas
- Documentación a revisar o actualizar después:
  - `ai-workflow/docs/app-features/config-contract.md`
  - `ai-workflow/docs/architecture.md`

### Tests requeridos
- Confirmar que un `GET` con `endpoint` y `query` plano válido se acepta.
- Confirmar que un `POST` con `body` JSON válido se acepta.
- Confirmar que un `PUT` con `body` JSON válido se acepta.
- Confirmar que un `DELETE` con `query` y sin `body` se acepta.
- Confirmar que un `PATCH` con `body` y sin `query` se acepta.
- Confirmar que `body: null` en la raíz se acepta para métodos que admiten body y se rechaza para `GET`.
- Confirmar que se rechazan operaciones con `method` no soportado, `endpoint` vacío, `query` no objeto, claves vacías o valores de `query` que no sean `string`, `number` o `boolean`.
- Confirmar que se rechazan árboles de `body` con valores no JSON-serializables o shapes incompatibles con el contrato soportado.

### Criterios de finalización
- `api` deja de ser un objeto opaco y queda tipado con un contrato estable exportado desde `config/`.
- La validación de bootstrap detecta operaciones inválidas antes de renderizar o ejecutar.
- La semántica permitida de `query`, `body` y compatibilidad por método queda fijada en tests.
- Los tests de validación relevantes quedan en verde.

### Cierre de implementación
Completado cuando la frontera declarativa de `api` queda cerrada en tipos y validación, sin dejar decisiones abiertas sobre qué operaciones son aceptables en v1.

### Cierre documental
Pendiente de una pasada posterior para actualizar la ficha del contrato de configuración y, si hace falta, la arquitectura. No se cierra en esta tarea.

## T0009-02

### Estado
Completada

### Objetivo
Introducir una capa reusable en `src/queries/` para resolver payloads declarativos, construir requests HTTP y ejecutar una operación por nombre con errores normalizados, sin tocar todavía el store compartido del runtime.

### Fuera de alcance
- Acoplar la ejecución a componentes visuales o nodos del layout.
- Decidir aún la sintaxis de `preloads`, submit de formularios o refetch declarativo.
- Persistir resultados o side effects fuera del resultado inmediato de la operación.

### Dependencias
- `T0009-01` completada

### Impacto esperado en archivos
- Código a crear o modificar:
  - `src/queries/runtime-api-types.ts`
  - `src/queries/runtime-api-request.ts`
  - `src/queries/runtime-api-executor.ts`
  - `src/runtime/runtime-references/runtime-reference-resolver.ts` solo si el builder necesita una superficie más reutilizable para resolver referencias fuera de textos visibles
  - `src/config/runtime-config.ts` solo si el ejecutor necesita importar tipos públicos del contrato
- Tests a crear o modificar:
  - `src/tests/runtime-api-execution.test.ts`
  - `src/tests/runtime-reference-resolution.test.tsx` solo si hay que fijar algún caso nuevo del uso de referencias completas dentro de payloads declarativos
- Documentación a revisar o actualizar después:
  - `ai-workflow/docs/architecture.md`
  - `ai-workflow/docs/current-state.md`
  - `ai-workflow/docs/app-features/queries-and-feedback.md`

### Tests requeridos
- Confirmar que una operación `GET` construye URL final con query string plana sin body.
- Confirmar que una operación `POST` construye `body` JSON serializado correctamente.
- Confirmar que una operación `PUT` construye `body` JSON serializado correctamente.
- Confirmar que una operación `DELETE` puede enviar query string sin inventar payload JSON.
- Confirmar que una operación `PATCH` puede enviar body sin query string.
- Confirmar que `body: null` en la raíz genera una petición explícita sin body JSON serializado.
- Confirmar que strings literales, strings escapados y referencias soportadas conviven correctamente dentro de `query` y `body`.
- Confirmar que `query` serializa `string`, `number` y `boolean` como escalares simples y rechaza `null` u otros valores fuera de contrato antes de emitir red.
- Confirmar que una referencia soportada pero sin valor disponible produce un error de construcción estable y no una llamada de red parcial.
- Confirmar que una operación inexistente se detecta antes de emitir red.
- Confirmar que fallos de red, respuestas HTTP no `ok` y respuestas JSON inválidas se normalizan a errores estables orientados a UI con códigos concretos (`network-error`, `http-error`, `invalid-json-response`, `request-build-failed`, `operation-not-found`).
- Confirmar que una respuesta satisfactoria sin body JSON consumible, incluida `204 No Content`, se normaliza como éxito con `data: null`.

### Criterios de finalización
- Existe una frontera explícita en `src/queries/` para construir y ejecutar operaciones declaradas.
- La lógica de request no depende de React ni del reducer del runtime.
- Los errores remotos y de invocación quedan normalizados con shape estable y testeado.
- Los tests del builder/ejecutor quedan en verde.

### Cierre de implementación
Completado cuando el runtime ya dispone de un ejecutor reusable de operaciones declarativas y no queda trabajo técnico ambiguo sobre cómo construir o lanzar el request.

### Cierre documental
Pendiente de una pasada posterior para reflejar la nueva capa `queries/` y la frontera de ejecución remota. No se cierra en esta tarea.

## T0009-03

### Estado
Completada

### Objetivo
Exponer una fachada mínima en el provider del runtime para ejecutar una operación declarada y reflejar su resultado en `queries.{operationName}`, manteniendo las transiciones de estado ya acordadas para `loading`, `success` y `error`.

### Fuera de alcance
- Crear una UI declarativa para disparar operaciones desde el layout.
- Introducir un dominio separado de acciones visibles en el store.
- Resolver cancelación, deduplicación, polling o concurrencia avanzada entre invocaciones.

### Dependencias
- `T0009-02` completada

### Impacto esperado en archivos
- Código a crear o modificar:
  - `src/runtime/runtime-state/runtime-state-provider.tsx`
  - `src/runtime/runtime-state/runtime-state-types.ts`
  - `src/runtime/runtime-state/runtime-state-reducer.ts` solo si hace falta un ajuste mínimo de tipos o transiciones ya existentes
  - `src/runtime/runtime-state/runtime-state-selectors.ts` solo si los tests de integración necesitan un helper de lectura más explícito
  - `src/queries/runtime-api-executor.ts` si la integración revela un resultado de retorno más útil para el provider
- Tests a crear o modificar:
  - `src/tests/runtime-state.test.tsx`
  - `src/tests/runtime-api-execution.test.ts` solo si la integración obliga a fijar mejor el contrato de retorno del ejecutor
- Documentación a revisar o actualizar después:
  - `ai-workflow/docs/current-state.md`
  - `ai-workflow/docs/app-features/queries-and-feedback.md`
  - `ai-workflow/docs/app-features/config-driven-ui-runtime.md`

### Tests requeridos
- Confirmar que `executeQueryOperation('searchUsers')` inicializa o reutiliza `queries.searchUsers`, pasa a `loading` y luego a `success` con el dato remoto.
- Confirmar que una recarga conserva el último `data` válido mientras la query está en `loading`.
- Confirmar que una respuesta fallida deja `status: error` y un `error` estable sin borrar indebidamente el último dato válido si la política actual del store exige conservarlo.
- Confirmar que una operación inexistente no emite red y deja un error de invocación estable en `queries.{operationName}` con `code: operation-not-found`.
- Confirmar que un fallo de construcción del request por referencias no resolubles deja `status: error` con `code: request-build-failed` y no emite red.
- Confirmar que la fachada pública no necesita que la UI construya URLs, query strings ni payloads manualmente.

### Criterios de finalización
- El provider expone una fachada pública mínima y coherente para ejecutar operaciones declaradas por nombre.
- La integración reutiliza el dominio `queries` existente sin abrir un store paralelo.
- Las transiciones `loading -> success | error` quedan fijadas en tests del runtime compartido.
- Los tests de integración del store quedan en verde.

### Cierre de implementación
Completado cuando el runtime ya puede ejecutar una operación declarada y dejar su resultado accesible desde `queries.{operationName}.*` sin acoplar la UI a detalles HTTP.

### Cierre documental
Pendiente de una pasada posterior para actualizar el comportamiento estable de `queries` y del runtime visible. No se cierra en esta tarea.

## T0009-04

### Estado
Completada

### Objetivo
Cerrar la regresión final de la feature validando la coherencia entre contrato `api`, builder/ejecutor, integración con `queries` y gate global de cobertura del proyecto.

### Fuera de alcance
- Añadir capacidades declarativas fuera de la spec.
- Actualizar documentación funcional y arquitectónica dentro de esta misma tarea.
- Abrir aún refetch automáticos, `preloads` o superficies visuales nuevas.

### Dependencias
- `T0009-03` completada

### Impacto esperado en archivos
- Código a crear o modificar:
  - cualquier ajuste mínimo residual en `src/config/`, `src/queries/`, `src/runtime/` o `src/tests/` necesario para cerrar la integración
- Tests a crear o modificar:
  - `src/tests/runtime-config-validation.test.ts`
  - `src/tests/read-runtime-config.test.ts`
  - `src/tests/runtime-api-execution.test.ts`
  - `src/tests/runtime-state.test.tsx`
  - `src/tests/app-shell.test.tsx` solo si el cierre detecta una regresión real en el arranque del runtime
- Documentación a revisar o actualizar después:
  - `ai-workflow/docs/current-state.md`
  - `ai-workflow/docs/architecture.md`
  - `ai-workflow/docs/app-features/config-contract.md`
  - `ai-workflow/docs/app-features/queries-and-feedback.md`
  - `ai-workflow/docs/app-features/config-driven-ui-runtime.md`
  - `ai-workflow/features/index.md`

### Tests requeridos
- Ejecutar la regresión conjunta de validación de config, ejecutor remoto y store compartido.
- Confirmar que una configuración existente con `api: {}` sigue siendo válida y no cambia el comportamiento actual del runtime mientras no se invoquen operaciones.
- Confirmar que operaciones distintas pueden reutilizar un mismo `endpoint` con métodos distintos sin colisionar.
- Confirmar que las respuestas exitosas vacías siguen llegando a `queries.*` como `data: null` en lugar de degradarse a error de parseo.
- Confirmar que el runtime sigue exponiendo resultados remotos solo a través de `queries.*`.
- Ejecutar `pnpm test` para validar el gate global de cobertura del proyecto.

### Criterios de finalización
- No quedan incoherencias entre validación, construcción de requests, ejecución remota y transiciones del store.
- La introducción de `api` como frontera declarativa no rompe configuraciones previas con `api: {}`.
- La regresión relevante del runtime queda en verde.
- `pnpm test` mantiene el umbral global mínimo del proyecto.

### Cierre de implementación
Completado cuando la feature queda integrada, validada y lista para una pasada documental posterior sin trabajo técnico pendiente dentro del alcance acordado.

### Cierre documental
Pendiente de una pasada posterior de `update-app-documentation` sobre los documentos listados en el impacto documental.

## Orden de ejecución
La siguiente tarea que debe escogerse en implementación es `T0009-01`.

No se debe empezar `T0009-02` hasta cerrar `T0009-01`, ni `T0009-03` hasta cerrar `T0009-02`, ni `T0009-04` hasta cerrar `T0009-03`.
