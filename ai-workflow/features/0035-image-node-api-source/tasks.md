# Tasks: Image node API source

## Resultado de revisión

La feature requiere `design.md` y el artefacto queda fijado como contrato técnico obligatorio.

Decisiones de diseño que la implementación no debe reabrir:
- el nodo `image` tendrá dos modos excluyentes: local histórico con `src`/`alt` y remoto con `loadFromApi`
- la carga remota del nodo no escribirá en `queries.{operationName}` por obligación, sino en `queries.{queryName}` para evitar colisiones entre imágenes simultáneas
- `queryStateFeedback` no podrá bloquear la activación de una imagen remota cuando observe la misma `queryName` que la propia imagen dispara
- `src` y `alt` remotos se extraerán por rutas relativas explícitas contra la respuesta bruta, sin introducir un lenguaje de transformaciones ni persistir un dato proyectado nuevo en store
- la activación automática será aware de `pageEntry`, para permitir recargas por nueva entrada aunque la request efectiva coincida con una anterior

## Bloqueo previo a implementación

La revisión detecta un hueco de diseño que impide considerar el plan listo:
- no está cerrada la identidad visible de query por instancia cuando una misma definición de `image` remota se repite dentro de `repeater`
- tampoco está cerrada la clave estable de activación que permita recordar "ya se disparó en esta `pageEntry`" aunque la instancia se desmonte y remonte

Mientras esto no quede fijado, la secuencia `T0035-01` a `T0035-06` no es segura porque la feature podría implementarse de dos maneras incompatibles:
- mantener `queries.{queryName}` como key única por nodo declarativo, rompiendo el caso de varias iteraciones simultáneas
- derivar keys por instancia en runtime, lo que reabre cómo `queryStateFeedback` y otros consumidores `queries.*` pueden observar esa query

La siguiente tarea real antes de implementar debe ser refinar `design.md`, `tasks.md` y `test-plan.md` con esa decisión.

## T0035-01

### Estado
Pendiente

### Objetivo
Ampliar el contrato del runtime config para introducir el modo remoto del nodo `image`, cerrar la gramática `loadFromApi` y rechazar antes del render cualquier configuración ambigua entre el modo histórico local y el nuevo modo remoto.

La tarea debe dejar cerrado este contrato:
- modo local actual con `props.src` y `props.alt`
- modo remoto nuevo con `props.loadFromApi.queryName`, `operationName`, `query`, `body`, `headers` y `response.srcPath`
- `props.alt` como literal fijo opcional solo en modo remoto
- `loadFromApi.response.altPath` como alternativa al literal fijo de `alt`
- unicidad de `loadFromApi.queryName` entre imágenes remotas del config

### Fuera de alcance
- Ejecutar todavía la carga remota en runtime.
- Separar todavía la identidad visible de query en la capa de ejecución.
- Resolver todavía `srcPath` o `altPath` contra respuestas reales.
- Actualizar todavía la documentación estable del proyecto.

### Dependencias
- `spec.md`
- `design.md`

### Impacto esperado en archivos
- Código a crear o modificar:
  - `src/config/runtime-config-types.ts`
  - `src/config/runtime-config-zod.ts`
  - `src/config/validate-runtime-config.ts`
  - `src/config/runtime-config.ts` solo si hace falta reexportar tipos nuevos
- Tests a crear o modificar:
  - `src/tests/runtime-config-validation.test.ts`
  - `src/tests/read-runtime-config.test.ts` solo si conviene fijar el shape normalizado desde la fachada pública
- Documentación a revisar o actualizar después:
  - `ai-workflow/docs/app-features/config-contract.md`
  - `ai-workflow/docs/app-features/config-driven-ui-runtime.md`
  - `ai-workflow/docs/app-features/queries-and-feedback.md`
  - `ai-workflow/docs/current-state.md`

### Tests requeridos
- Confirmar que `image` sigue aceptando su modo local actual con `src` y `alt`.
- Confirmar que `image` acepta el modo remoto con `loadFromApi.queryName`, `operationName`, request params opcionales y `response.srcPath`.
- Confirmar que el modo remoto acepta `props.alt` literal fijo o `response.altPath`, pero rechaza declararlos a la vez.
- Confirmar que `image` rechaza configuraciones sin `src` ni `loadFromApi`.
- Confirmar que `image` rechaza `src` junto con `loadFromApi`.
- Confirmar que `loadFromApi` rechaza ausencia de `queryName`, ausencia de `operationName`, ausencia de `response` o ausencia de `response.srcPath`.
- Confirmar que `query`, `body` y `headers` del modo remoto reutilizan exactamente el contrato ya vigente de `RuntimeApiRequestParams`.
- Confirmar que dos imágenes remotas con el mismo `queryName` se rechazan antes del render.
- Confirmar que configuraciones existentes sin este modo remoto conservan el mismo resultado normalizado actual.

### Documentación afectada
- Pendiente de actualización posterior para reflejar el nuevo shape contractual del nodo `image` y sus reglas de exclusión entre modo local y remoto.

### Criterios de finalización
- El contrato JSON deja inequívoco cuándo `image` está en modo local y cuándo en modo remoto.
- La validación previa al render asume toda la ambigüedad estructural y no la delega al renderer.
- `loadFromApi.queryName` queda fijado como identidad visible de query para la feature.
- La compatibilidad hacia atrás del modo local queda demostrada por tests.

### Cierre de implementación
Completado cuando bootstrap puede aceptar y rechazar el nuevo modo remoto de `image` de forma determinista y sin dejar combinaciones ambiguas para runtime.

### Cierre documental
Pendiente de una pasada posterior. No se cierra en esta tarea.

## T0035-02

### Estado
Pendiente

### Objetivo
Separar en la capa de ejecución remota la identidad visible de query respecto a `operationName`, para que el runtime pueda escribir resultados en `queries.{queryName}` sin alterar la semántica histórica de botones, formularios y `preloads`.

La tarea debe dejar cerrada esta semántica:
- la operación base se sigue resolviendo por `operationName`
- el estado visible se escribe por `queryName`
- si no se declara `queryName`, el comportamiento histórico sigue siendo `queryName = operationName`
- `status`, `data`, `error` y `requestSignature` siguen viviendo en el mismo dominio `queries`

### Fuera de alcance
- Disparar todavía cargas automáticas desde el nodo `image`.
- Resolver todavía `srcPath` y `altPath` para render.
- Introducir todavía memoria entry-aware de activación automática.
- Actualizar todavía la documentación estable del proyecto.

### Dependencias
- `T0035-01` completada

### Impacto esperado en archivos
- Código a crear o modificar:
  - `src/queries/runtime-api-types.ts`
  - `src/queries/runtime-api-request.ts`
  - `src/queries/runtime-api-executor.ts`
  - `src/runtime/runtime-state/runtime-state-provider.tsx`
  - `src/runtime/runtime-state/runtime-state-reducer.ts`
  - `src/runtime/runtime-state/runtime-state-types.ts`
  - `src/runtime/runtime-state/runtime-state-selectors.ts` solo si conviene exponer helpers explícitos por `queryName`
  - `src/runtime/runtime-actions/runtime-ui-action-executor.ts` solo si necesita transportar el nombre visible de query sin romper la firma actual
- Tests a crear o modificar:
  - `src/tests/runtime-api-execution.test.ts`
  - `src/tests/runtime-state.test.tsx`
  - `src/tests/runtime-ui-actions.test.tsx` solo si conviene fijar compatibilidad de acciones manuales desde el ejecutor común
- Documentación a revisar o actualizar después:
  - `ai-workflow/docs/app-features/queries-and-feedback.md`
  - `ai-workflow/docs/architecture.md`
  - `ai-workflow/docs/current-state.md`

### Tests requeridos
- Confirmar que una ejecución manual sin `queryName` explícito sigue escribiendo en `queries.{operationName}`.
- Confirmar que una ejecución con `queryName` explícito escribe en `queries.{queryName}` sin alterar la operación base usada para construir la request.
- Confirmar que la semántica vigente de merge, errores y `requestSignature` se conserva cuando cambia solo el destino visible de query.
- Confirmar que `queries/set-loading`, `set-success`, `set-error` y `reset` siguen manteniendo alineado `requestSignature` para la key visible elegida.
- Confirmar que botones, submit y `preloads` históricos siguen funcionando sin declarar un `queryName` nuevo.
- Confirmar que dos ejecuciones con la misma `operationName` pero distinto `queryName` no pisan su estado visible entre sí.

### Documentación afectada
- Pendiente de actualización posterior para reflejar que el dominio `queries` puede representar una identidad visible distinta de la operación `api` base.

### Criterios de finalización
- Existe una única frontera compartida para resolver operación base y destino visible de query.
- La semántica histórica del runtime permanece intacta cuando no se usa `queryName` explícito.
- El store puede aislar varias queries visibles sobre una misma operación base sin subsistema paralelo.
- La compatibilidad queda fijada por tests de ejecución y store.

### Cierre de implementación
Completado cuando la capa de requests y el estado compartido permiten escribir resultados por `queryName` sin romper `preloads`, botones, formularios ni el contrato histórico de `queries`.

### Cierre documental
Pendiente de una pasada posterior. No se cierra en esta tarea.

## T0035-03

### Estado
Pendiente

### Objetivo
Implementar la activación automática del modo remoto de `image`, su política entry-aware y la convivencia correcta con `visibility`, `queryStateFeedback`, `repeater` y varias imágenes simultáneas en pantalla.

La tarea debe dejar cerrada esta semántica:
- la imagen remota se activa cuando entra en condición efectiva de activación dentro de la `pageEntry` actual
- dentro de la misma `pageEntry`, una misma imagen no relanza la misma request efectiva por rerender o por reexposición redundante
- al cambiar de `pageEntry`, la imagen puede volver a disparar la misma request efectiva
- `queryStateFeedback` no bloquea la activación cuando observa la misma `queryName` remota de la imagen
- `visibility` sí sigue bloqueando activaciones cuando el nodo realmente no debe existir aún
- una imagen dentro de `repeater` puede resolver `query`, `body` y `headers` desde `item.*`

### Fuera de alcance
- Introducir polling, retry, cancelación o refetch manual específico para imágenes.
- Añadir deduplicación global de red entre queries visibles distintas aunque coincidan en firma.
- Generalizar todavía esta activación automática a otros nodos del catálogo.
- Actualizar todavía la documentación estable del proyecto.

### Dependencias
- `T0035-02` completada

### Impacto esperado en archivos
- Código a crear o modificar:
  - `src/runtime/layout-node-renderer.tsx`
  - `src/runtime/nodes/image-layout-node.tsx`
  - `src/runtime/runtime-layout-visibility.ts`
  - `src/runtime/runtime-query-state-feedback.ts` solo si conviene exponer una derivación reutilizable para separar activación de render final
  - `src/runtime/runtime-state/runtime-state-provider.tsx`
  - `src/runtime/runtime-references/runtime-reference-resolver.ts`
  - `src/queries/runtime-api-request.ts` solo si hace falta transportar datos auxiliares de la request efectiva al controlador de activación
- Tests a crear o modificar:
  - `src/tests/layout-renderer.test.tsx`
  - `src/tests/runtime-button-navigation.test.tsx`
  - `src/tests/runtime-state.test.tsx`
  - `src/tests/runtime-reference-resolution.test.tsx` solo si la navegación de rutas relativas de respuesta queda formalizada en helper compartido
- Documentación a revisar o actualizar después:
  - `ai-workflow/docs/app-features/config-driven-ui-runtime.md`
  - `ai-workflow/docs/app-features/queries-and-feedback.md`
  - `ai-workflow/docs/current-state.md`
  - `ai-workflow/docs/architecture.md`

### Tests requeridos
- Confirmar que una imagen remota visible al entrar en página dispara automáticamente su request sin botón ni submit.
- Confirmar que una imagen inicialmente oculta por `visibility` dispara la carga cuando pasa a mostrarse por primera vez dentro de la entrada actual.
- Confirmar que una imagen con `queryStateFeedback.query === loadFromApi.queryName` puede disparar la carga aunque el feedback inicial resuelva `idle -> hide` o `idle -> fallback`.
- Confirmar que una imagen dentro de `repeater` resuelve `item.*` en request params para cada iteración correcta.
- Confirmar que dos imágenes simultáneas con la misma `operationName` base y distinto `queryName` conservan estados y resultados visibles independientes.
- Confirmar que una misma imagen no relanza la misma request efectiva por rerenders ordinarios o por toggles repetidos dentro de la misma `pageEntry`.
- Confirmar que una nueva `pageEntry` puede volver a disparar la misma request efectiva aunque la firma coincida con una entrada anterior.
- Confirmar que los errores `operation-not-found`, `request-build-failed`, `network-error`, `http-error` e `invalid-json-response` siguen proyectándose solo en `queries.{queryName}`.

### Documentación afectada
- Pendiente de actualización posterior para reflejar la política de activación remota de `image`, su relación con `pageEntry` y el alcance exacto de `queryStateFeedback`.

### Criterios de finalización
- La activación automática del modo remoto queda cerrada por comportamiento observable y no por heurísticas implícitas de montaje.
- La política “una vez por entrada y request efectiva” queda fijada por tests.
- La compatibilidad con `visibility`, `queryStateFeedback` y `repeater` queda cubierta sin ramas ad hoc dispersas por consumidor.
- Varias imágenes simultáneas dejan de colisionar funcionalmente aunque reutilicen la misma operación base.

### Cierre de implementación
Completado cuando el runtime puede disparar imágenes remotas de forma automática, entry-aware y sin deadlock con su propio feedback visible.

### Cierre documental
Pendiente de una pasada posterior. No se cierra en esta tarea.

## T0035-04

### Estado
Pendiente

### Objetivo
Implementar la proyección de `src` y `alt` desde la respuesta remota, reutilizando una navegación segura por rutas relativas y preservando la degradación segura del nodo `image` ante datos ausentes, parciales o no textuales.

La tarea debe dejar cerrada esta semántica:
- `queries.{queryName}.data` conserva la respuesta bruta
- `srcPath` navega esa respuesta y debe resolver un string utilizable para renderizar la imagen
- `altPath` navega esa misma respuesta y degrada a `props.alt` literal o `''` cuando no resuelve un string utilizable
- rutas válidas pero ausentes degradan de forma segura sin romper la pantalla

### Fuera de alcance
- Persistir en store una versión transformada de la respuesta específica para imágenes.
- Introducir expresiones, interpolación parcial o transformadores arbitrarios de respuesta.
- Cambiar la semántica histórica de `image` en modo local.
- Actualizar todavía la documentación estable del proyecto.

### Dependencias
- `T0035-03` completada

### Impacto esperado en archivos
- Código a crear o modificar:
  - `src/runtime/nodes/image-layout-node.tsx`
  - `src/runtime/runtime-references/runtime-reference-resolver.ts`
  - `src/runtime/runtime-references/runtime-reference-diagnostics.ts` solo si hace falta registrar una superficie diagnóstica nueva para rutas remotas de imagen
  - `src/tests/layout-renderer.test.tsx`
  - `src/tests/runtime-reference-resolution.test.tsx`
- Tests a crear o modificar:
  - `src/tests/layout-renderer.test.tsx`
  - `src/tests/runtime-reference-resolution.test.tsx`
- Documentación a revisar o actualizar después:
  - `ai-workflow/docs/app-features/config-driven-ui-runtime.md`
  - `ai-workflow/docs/app-features/queries-and-feedback.md`
  - `ai-workflow/docs/current-state.md`

### Tests requeridos
- Confirmar que `srcPath` puede extraer una URL anidada desde objetos y arrays de la respuesta remota.
- Confirmar que `altPath` puede extraer un texto alternativo anidado desde otra ruta distinta de la misma respuesta.
- Confirmar que `alt` literal fijo sigue funcionando en modo remoto cuando no se declara `altPath`.
- Confirmar que `srcPath` ausente, vacío o no textual degrada a no render sin romper el resto de la pantalla.
- Confirmar que `altPath` ausente o no textual degrada a `props.alt` literal o `''`.
- Confirmar que el modo local histórico de `image` sigue renderizando igual que antes.
- Confirmar que una imagen remota puede coexistir con otras imágenes locales o con consumidores que lean la misma `queries.{queryName}.data`.

### Documentación afectada
- Pendiente de actualización posterior para reflejar la proyección declarativa de `src` y `alt` desde la respuesta remota.

### Criterios de finalización
- La proyección visible de la imagen remota reutiliza helpers compartidos y no abre un lenguaje nuevo de mapping.
- `src` y `alt` degradan de forma segura y predecible.
- `queries.{queryName}.data` sigue siendo la fuente de verdad bruta del resultado remoto.
- La compatibilidad del modo local queda fijada por regresión.

### Cierre de implementación
Completado cuando la imagen remota puede proyectar `src` y `alt` desde la respuesta compartida sin introducir estado paralelo ni romper el modo local histórico.

### Cierre documental
Pendiente de una pasada posterior. No se cierra en esta tarea.

## T0035-05

### Estado
Pendiente

### Objetivo
Ejecutar la regresión transversal del subconjunto afectado para demostrar que el nuevo modo remoto de `image` no rompe validación, requests manuales, `preloads`, renderer, `repeater`, visibilidad, feedback ni el gate global del proyecto.

### Fuera de alcance
- Añadir capacidades nuevas fuera de la spec.
- Reabrir decisiones de diseño ya cerradas salvo bug demostrado por tests.
- Realizar en esta tarea la pasada documental amplia.

### Dependencias
- `T0035-04` completada

### Impacto esperado en archivos
- Código a crear o modificar:
  - cualquier ajuste mínimo residual en `src/config/`, `src/queries/`, `src/runtime/` o `src/tests/` estrictamente necesario para cerrar la integración sin ampliar alcance
- Tests a crear o modificar:
  - `src/tests/runtime-config-validation.test.ts`
  - `src/tests/read-runtime-config.test.ts` solo si forma parte del contrato cerrado
  - `src/tests/runtime-api-execution.test.ts`
  - `src/tests/runtime-state.test.tsx`
  - `src/tests/runtime-ui-actions.test.tsx`
  - `src/tests/runtime-page-entry-preloads.test.tsx` solo si conviene fijar explícitamente que `preloads` históricos no cambian
  - `src/tests/runtime-button-navigation.test.tsx`
  - `src/tests/layout-renderer.test.tsx`
  - `src/tests/runtime-reference-resolution.test.tsx`
- Documentación a revisar o actualizar después:
  - `ai-workflow/docs/current-state.md`
  - `ai-workflow/docs/app-features/config-contract.md`
  - `ai-workflow/docs/app-features/config-driven-ui-runtime.md`
  - `ai-workflow/docs/app-features/queries-and-feedback.md`
  - `ai-workflow/docs/architecture.md`
  - `ai-workflow/features/index.md`

### Tests requeridos
- Ejecutar la regresión conjunta del contrato de config, de la capa de requests, del store compartido y del renderer visible afectado por imágenes remotas.
- Confirmar en conjunto que botones, submit y `preloads` históricos siguen escribiendo en `queries.{operationName}` cuando no usan `queryName` explícito.
- Confirmar en conjunto que varias imágenes simultáneas no colisionan aunque reutilicen la misma operación base.
- Confirmar en conjunto que `item.*`, `queries.*`, `visibility` y `queryStateFeedback` mantienen su semántica actual fuera del nuevo modo remoto.
- Ejecutar `pnpm test` para validar el gate global del 80% sobre `src/`.

### Documentación afectada
- Pendiente de actualización posterior en la pasada documental de la feature.

### Criterios de finalización
- El subconjunto afectado queda validado de extremo a extremo sin regresiones abiertas dentro del alcance.
- La compatibilidad preservada por la spec queda demostrada por tests y no solo asumida.
- El gate global de tests y coverage queda listo para pasar a documentación.

### Cierre de implementación
Completado cuando la feature queda integrada y validada de extremo a extremo, con `pnpm test` en verde y sin deuda funcional abierta dentro del alcance acordado.

### Cierre documental
Pendiente de una pasada posterior. No se cierra en esta tarea.

## T0035-06

### Estado
Pendiente

### Objetivo
Actualizar la documentación funcional, técnica y de estado para dejar explícitos el nuevo modo remoto de `image`, la separación entre `queryName` y `operationName`, la política de activación por `pageEntry` y el criterio de cuándo usar esta capacidad frente a `preloads`.

### Fuera de alcance
- Reabrir decisiones de implementación ya cerradas.
- Convertir `README.md` u otros documentos breves en changelog.
- Diseñar futuras generalizaciones de auto-carga remota para otros nodos.

### Dependencias
- `T0035-05` completada

### Impacto esperado en archivos
- Documentación a crear o modificar:
  - `ai-workflow/docs/app-features/config-contract.md`
  - `ai-workflow/docs/app-features/config-driven-ui-runtime.md`
  - `ai-workflow/docs/app-features/queries-and-feedback.md`
  - `ai-workflow/docs/current-state.md`
  - `ai-workflow/docs/architecture.md`
  - `ai-workflow/features/index.md`

### Tests requeridos
- No exige tests nuevos si solo actualiza documentación y `status.yaml`.
- Si la pasada documental obliga a tocar código o tests, volver a ejecutar como mínimo el subconjunto cerrado en `T0035-05`.

### Documentación afectada
- Esta tarea constituye el cierre documental de la feature.

### Criterios de finalización
- La documentación deja claro cómo se declara una imagen remota y cómo se diferencia de un `preload` compartido.
- Queda documentado que `queryName` identifica la query visible y `operationName` la operación base.
- La política de activación por `pageEntry` y la convivencia con `queryStateFeedback` quedan reflejadas sin ambigüedad.
- `status.yaml` puede pasar a reflejar cierre documental cuando la implementación real exista y esta pasada se complete.

### Cierre de implementación
No aplica. Esta tarea no añade alcance funcional nuevo.

### Cierre documental
Completado cuando la documentación funcional, arquitectónica y de estado refleja el comportamiento estable final de la feature.

## Orden de ejecución
La implementación no debe empezar todavía.

Una vez resuelto el bloqueo de diseño sobre identidad por instancia y memoria de activación, la siguiente tarea a escoger será `T0035-01`.

No se debe empezar `T0035-02` hasta cerrar `T0035-01`, ni `T0035-03` hasta cerrar `T0035-02`, ni `T0035-04` hasta cerrar `T0035-03`, ni `T0035-05` hasta cerrar `T0035-04`, ni `T0035-06` hasta cerrar `T0035-05`.
