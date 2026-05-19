# Tasks: Request-aware preloads

## Resultado de revisión

La feature requiere `design.md` y el artefacto ya queda fijado como contrato técnico obligatorio.

Decisiones de diseño que la implementación no debe reabrir:
- el shape visible de `preloads` se valida como lista de objetos de una sola clave y se normaliza a una representación interna estructurada
- la firma de request se calcula desde `src/queries/`, compartiendo composición y resolución con `executeOperation`
- la comparación de reejecución se hace contra la firma actualmente asociada a `queries.{operationName}`, no contra una caché histórica por `pageEntry` que esta iteración todavía no introduce
- `pageEntry` debe alinear su estado agregado con el subconjunto de preloads realmente relanzado, no con una lista nominal por nombre

Con estas decisiones, la implementación puede ejecutarse sin reinterpretar arquitectura ni política de reejecución. La siguiente tarea que debe escogerse es `T0031-01`.

## T0031-01

### Estado
Pendiente

### Objetivo
Cambiar el contrato y la validación de `pages[].preloads` para retirar la forma histórica basada en strings, aceptar solo la forma declarativa por objeto de una sola clave y normalizarla a una representación interna explícita y segura para el runtime.

### Fuera de alcance
- Introducir todavía la lógica de firma o reejecución automática.
- Resolver en validación la existencia real de la operación en `api`; esa semántica sigue siendo error recuperable de runtime.
- Actualizar todavía la documentación estable del proyecto.

### Dependencias
- `spec.md`
- `design.md`

### Impacto esperado en archivos
- Código a crear o modificar:
  - `src/config/runtime-config-types.ts`
  - `src/config/runtime-config-zod.ts`
  - `src/config/validate-runtime-config.ts`
- Tests a crear o modificar:
  - `src/tests/runtime-config-validation.test.ts`
  - `src/tests/read-runtime-config.test.ts`
- Documentación a revisar o actualizar después:
  - `ai-workflow/docs/app-features/config-contract.md`
  - `ai-workflow/docs/app-features/pages-and-navigation.md`
  - `ai-workflow/docs/current-state.md`

### Tests requeridos
- Confirmar que `preloads` acepta `[{ "loadUser": {} }]`.
- Confirmar que `preloads` acepta overrides declarativos en `query`, `body` y `headers`.
- Confirmar que la forma histórica `preloads: ["loadUser"]` se rechaza con error diagnóstico explícito.
- Confirmar que una entrada de preload con cero claves, más de una clave o clave vacía se rechaza.
- Confirmar que el payload del preload reutiliza exactamente las reglas ya vigentes de `RuntimeApiRequestParams`.
- Confirmar que dos entradas con el mismo `operationName` dentro de la misma página se rechazan antes del render.
- Confirmar que una operación inexistente en `api` sigue pasando validación estructural para que el runtime la trate luego como error recuperable.
- Confirmar que la frontera pública que entrega config validado expone la representación interna normalizada de `preloads`, no el objeto literal de una sola clave ni la forma histórica basada en strings.

### Documentación afectada
- Pendiente de actualización posterior para reflejar el nuevo shape contractual y la retirada explícita de la lista de strings.

### Criterios de finalización
- El runtime validado ya no expone `preloads` como lista de strings.
- La representación interna resultante evita que el provider tenga que inspeccionar la única clave de cada objeto literal.
- La validación cruzada deja cerrada la unicidad por `operationName` dentro de cada página.
- El cambio queda fijado por tests de contrato, no solo por tipos.

### Cierre de implementación
Completado cuando el contrato validado de `preloads` queda normalizado y cubierto por tests relevantes en verde.

### Cierre documental
Pendiente de una pasada posterior. No se cierra en esta tarea.

## T0031-02

### Estado
Pendiente

### Objetivo
Introducir una frontera compartida para describir y firmar la request efectiva de una operación declarativa, reutilizando la misma semántica base de merge y resolución que ya usa `executeOperation`, y extender el dominio `queries` para conservar la firma actualmente asociada a cada operación.

### Fuera de alcance
- Cambiar todavía la orquestación automática de `preloads` en el provider.
- Introducir caché histórica por firma o reutilización activa de resultados viejos.
- Abrir nuevas superficies declarativas para leer la firma desde el JSON.

### Dependencias
- `T0031-01` completada

### Impacto esperado en archivos
- Código a crear o modificar:
  - `src/queries/runtime-api-types.ts`
  - `src/queries/runtime-api-request.ts`
  - `src/queries/runtime-api-executor.ts`
  - `src/runtime/runtime-state/runtime-state-types.ts`
  - `src/runtime/runtime-state/runtime-state-reducer.ts`
  - `src/runtime/runtime-state/runtime-state-selectors.ts` solo si conviene exponer lectura explícita de firma por query
- Tests a crear o modificar:
  - `src/tests/runtime-api-execution.test.ts`
  - `src/tests/runtime-state.test.tsx`
- Documentación a revisar o actualizar después:
  - `ai-workflow/docs/app-features/queries-and-feedback.md`
  - `ai-workflow/docs/architecture.md`
  - `ai-workflow/docs/current-state.md`

### Tests requeridos
- Confirmar que la descripción efectiva de request reutiliza la misma precedencia de merge en `query`, `headers` y `body`.
- Confirmar que dos requests funcionalmente equivalentes con distinto orden declarativo producen la misma firma.
- Confirmar que un cambio solo en `query`, solo en `headers` o solo en una rama del `body` cambia la firma.
- Confirmar que `operation-not-found` y `request-build-failed` siguen saliendo por la misma frontera de ejecución.
- Confirmar que `queries/set-loading`, `queries/set-success`, `queries/set-error` y `queries/reset` mantienen alineado el metadato de firma asociado a la operación.
- Confirmar que las ejecuciones manuales siguen funcionando igual aunque ahora transporten también la firma efectiva.

### Documentación afectada
- Pendiente de actualización posterior para reflejar que el dominio de queries conserva identidad de request además de `status`, `data` y `error`.

### Criterios de finalización
- Existe una única capa compartida que resuelve request efectiva y firma estable sin duplicar lógica en el provider.
- La firma queda desacoplada del orden incidental de objetos.
- El dominio `queries` puede responder qué request representa hoy cada `operationName`.
- La semántica manual de ejecución queda preservada por tests.

### Cierre de implementación
Completado cuando la firma efectiva y su persistencia en `queries` quedan cubiertas por tests unitarios e integrados relevantes en verde.

### Cierre documental
Pendiente de una pasada posterior. No se cierra en esta tarea.

## T0031-03

### Estado
Pendiente

### Objetivo
Rehacer la orquestación automática de `preloads` para que resuelva la request efectiva preload a preload con un snapshot común, compare cada firma contra la firma vigente de `queries.{operationName}`, relance solo las cargas necesarias y alinee `pageEntry` con la tanda real de recargas.

### Fuera de alcance
- Reutilizar activamente resultados históricos de una request vieja cuya firma coincida pero cuyo dato ya no esté presente en `queries`.
- Introducir secuencialidad, dependencias entre preloads o políticas nuevas de cancelación.
- Cambiar la superficie declarativa principal `queries.{operationName}`.

### Dependencias
- `T0031-02` completada

### Impacto esperado en archivos
- Código a crear o modificar:
  - `src/runtime/runtime-state/runtime-state-types.ts`
  - `src/runtime/runtime-state/runtime-state-reducer.ts`
  - `src/runtime/runtime-state/runtime-state-provider.tsx`
  - `src/runtime/runtime-state/runtime-state-selectors.ts`
  - `src/queries/runtime-api-executor.ts` solo si hace falta transportar metadatos adicionales del intento ejecutado
- Tests a crear o modificar:
  - `src/tests/runtime-page-entry-preloads.test.tsx`
  - `src/tests/runtime-button-navigation.test.tsx`
  - `src/tests/runtime-state.test.tsx`
- Documentación a revisar o actualizar después:
  - `ai-workflow/docs/app-features/pages-and-navigation.md`
  - `ai-workflow/docs/app-features/queries-and-feedback.md`
  - `ai-workflow/docs/app-features/config-driven-ui-runtime.md`
  - `ai-workflow/docs/current-state.md`
  - `ai-workflow/docs/architecture.md`

### Tests requeridos
- Confirmar que una página sin cambios de firma no abre una nueva tanda `loading`.
- Confirmar que un cambio de `params.*` que altere la request efectiva relanza solo el preload afectado.
- Confirmar que un cambio de `forms.*` o `queries.*` que altere la request efectiva relanza solo el preload afectado dentro de la misma página.
- Confirmar que dos preloads con firmas equivalentes salvo orden de claves no relanzan por esa diferencia no funcional.
- Confirmar que una página con varios preloads resetea a `loading` solo las queries cuya firma cambió.
- Confirmar que el agregado `pageEntry` queda en `loading` solo cuando existe al menos un relanzamiento real y que su cierre `success | error` se alinea con ese subconjunto.
- Confirmar que `operation-not-found` y `request-build-failed` siguen reflejándose como errores recuperables de query y del agregado.
- Confirmar que una reactivación de página tras haber ejecutado la misma operación con otra firma en una entrada intermedia vuelve a relanzar, porque la query visible ya no representa la firma anterior.

### Documentación afectada
- Pendiente de actualización posterior para reflejar la nueva política de reejecución por firma y el papel actualizado de `pageEntry`.

### Criterios de finalización
- La decisión de reejecución automática deja de depender solo de `pageId` o `operationName`.
- El runtime no inventa tandas `loading` cuando ninguna firma cambió.
- La limpieza fresca por `pageEntry` sigue aplicándose a las cargas realmente relanzadas.
- La integración queda fijada por tests de provider y navegación, no solo por helpers aislados.

### Cierre de implementación
Completado cuando la reejecución selectiva por firma y la nueva semántica agregada de `pageEntry` quedan cerradas con tests relevantes en verde.

### Cierre documental
Pendiente de una pasada posterior. No se cierra en esta tarea.

## T0031-04

### Estado
Pendiente

### Objetivo
Ejecutar la regresión transversal del subconjunto afectado para demostrar que el nuevo contrato de `preloads`, la firma de request y la reejecución selectiva no rompen navegación, formularios, requests manuales ni el gate global del proyecto.

### Fuera de alcance
- Añadir capacidades nuevas fuera de la spec.
- Reabrir decisiones de diseño ya cerradas salvo bug demostrado por tests.
- Realizar en esta tarea la pasada documental amplia.

### Dependencias
- `T0031-03` completada

### Impacto esperado en archivos
- Código a crear o modificar:
  - cualquier ajuste mínimo residual en `src/config/`, `src/queries/` o `src/runtime/` estrictamente necesario para cerrar la integración sin ampliar alcance
- Tests a crear o modificar:
  - `src/tests/runtime-config-validation.test.ts`
  - `src/tests/runtime-api-execution.test.ts`
  - `src/tests/runtime-page-entry-preloads.test.tsx`
  - `src/tests/runtime-button-navigation.test.tsx`
  - `src/tests/runtime-state.test.tsx`
- Documentación a revisar o actualizar después:
  - `ai-workflow/docs/current-state.md`
  - `ai-workflow/docs/app-features/config-contract.md`
  - `ai-workflow/docs/app-features/pages-and-navigation.md`
  - `ai-workflow/docs/app-features/queries-and-feedback.md`
  - `ai-workflow/features/index.md`

### Tests requeridos
- Ejecutar la regresión conjunta del contrato de config, requests y `preloads`.
- Confirmar en conjunto que la navegación no-op a la misma entrada sigue intacta.
- Confirmar en conjunto que las ejecuciones manuales de `executeOperation` y `form.submitAction` no pierden la semántica actual por adoptar la capa común de firma.
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

## T0031-05

### Estado
Pendiente

### Objetivo
Actualizar la documentación funcional, técnica y de estado para dejar explícito el nuevo shape declarativo de `preloads`, la política de reejecución por firma efectiva y el hecho de que la caché histórica por request sigue fuera de alcance.

### Fuera de alcance
- Reabrir decisiones de implementación ya cerradas.
- Convertir `README.md` u otros documentos breves en changelog.
- Diseñar la futura caché por request o exponer nuevas referencias declarativas de firma.

### Dependencias
- `T0031-04` completada

### Impacto esperado en archivos
- Documentación a crear o modificar:
  - `ai-workflow/docs/app-features/config-contract.md`
  - `ai-workflow/docs/app-features/pages-and-navigation.md`
  - `ai-workflow/docs/app-features/queries-and-feedback.md`
  - `ai-workflow/docs/app-features/config-driven-ui-runtime.md`
  - `ai-workflow/docs/current-state.md`
  - `ai-workflow/docs/architecture.md`
  - `ai-workflow/features/index.md`
- Estado del workflow a actualizar:
  - `ai-workflow/features/0031-request-aware-preloads/status.yaml`

### Tests requeridos
- No introduce tests nuevos por sí misma.
- Debe apoyarse en que `T0031-04` haya dejado en verde el subconjunto relevante y el gate global `pnpm test`.

### Documentación afectada
- Se cierra en esta propia tarea.

### Criterios de finalización
- La documentación estable describe sin ambigüedad el nuevo shape de `preloads` y la retirada del formato histórico.
- Queda claro que la comparación automática se hace por request efectiva y que la superficie visible principal sigue siendo `queries.{operationName}`.
- Queda explícito que la iteración no introduce caché histórica ni lectura declarativa de firmas.
- `status.yaml` refleja correctamente el cierre de planificación, implementación y documentación según el momento real de la feature.

### Cierre de implementación
No aplica; la implementación debe llegar cerrada desde `T0031-04`.

### Cierre documental
Completado cuando la documentación funcional, técnica y el estado del workflow quedan actualizados de forma consistente.
