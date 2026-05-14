# Tasks: Preload query reset on page entry

## Resultado de revisión

La feature sí requiere `design.md` porque había más de una estrategia técnica razonable y la spec dejaba abierta una decisión importante: corregir la ventana obsoleta solo reordenando el provider o introducir lógica adicional en formularios. El diseño ya fija el contrato de implementación:

- el arranque de una tanda de `preloads` pasa a ser una transición atómica del reducer
- esa transición limpia solo las queries precargadas y las deja ya en `loading`
- el provider separa una fase síncrona previa al paint y una fase asíncrona de ejecución remota
- la semántica manual de `executeOperation` no cambia
- no se introduce reactividad nueva de `defaultValue`

Con ese diseño, la siguiente tarea que debe ejecutarse es `T0025-01`.

## T0025-01

### Estado
Completada

### Objetivo
Introducir en el dominio compartido de `runtime-state` una transición atómica específica para el arranque de `preloads`, de forma que una nueva `pageEntry` con precargas pueda fijar su agregado en `loading` y resetear exactamente las queries afectadas en un solo commit observable.

### Fuera de alcance
- Lanzar todavía las requests remotas de la tanda desde el provider.
- Reordenar todavía los efectos del provider.
- Cambiar la semántica de `executeQueryOperation` para ejecuciones manuales.
- Actualizar documentación funcional o arquitectónica dentro de esta tarea.

### Dependencias
- `spec.md`
- `design.md`

### Impacto esperado en archivos
- Código a crear o modificar:
  - `src/runtime/runtime-state/runtime-state-types.ts`
  - `src/runtime/runtime-state/runtime-state-reducer.ts`
  - `src/runtime/runtime-state/runtime-state-selectors.ts` solo si conviene exponer una lectura explícita del arranque de tanda
- Tests a crear o modificar:
  - `src/tests/runtime-page-entry-preloads.test.tsx`
  - `src/tests/runtime-state.test.tsx`
- Documentación a revisar o actualizar después:
  - `ai-workflow/docs/architecture.md`
  - `ai-workflow/docs/app-features/queries-and-feedback.md`
  - `ai-workflow/docs/current-state.md`

### Tests requeridos
- Confirmar que existe una transición explícita para arrancar una tanda de `preloads` con `entryId`, `pageId`, `params` y `preloadNames`.
- Confirmar que esa transición deja `pageEntry.status` en `loading` y copia correctamente `entryId/pageId/params/preloadNames`.
- Confirmar que cada query incluida en `preloadNames` queda en `status: loading`, `data: null` y `error: null`, incluso si antes tenía un éxito o error de otra entrada.
- Confirmar que las queries no incluidas en la tanda conservan intacto su estado previo.
- Confirmar que una tanda con varios `preloads` resetea todas sus queries dentro del mismo paso observable del store.
- Confirmar que las acciones existentes `queries/set-loading`, `queries/set-success`, `queries/set-error` y `queries/reset` mantienen su semántica previa para ejecuciones manuales.

### Documentación afectada
- Pendiente de actualización posterior para reflejar la nueva primitiva interna de arranque atómico de `preloads`.

### Criterios de finalización
- El store compartido puede describir de forma inequívoca el arranque de una nueva tanda de `preloads`.
- El reset de queries precargadas deja de depender de varios dispatches visibles separados.
- La política de limpieza queda limitada por tests al subconjunto exacto `preloadNames`.
- No aparece ninguna redefinición accidental del contrato global de `queries.*`.

### Cierre de implementación
Completado cuando el dominio `runtime-state` ya ofrece una transición atómica y testeada para iniciar una entrada con `preloads`, lista para ser orquestada por el provider.

### Cierre documental
Pendiente de una pasada posterior sobre arquitectura, queries y estado actual. No se cierra en esta tarea.

## T0025-02

### Estado
Completada

### Objetivo
Reorquestar `runtime-state-provider.tsx` para aplicar el reset atómico de `preloads` antes del primer paint útil de la nueva entrada y lanzar después la tanda remota con un snapshot común capturado ya sobre el estado limpio.

### Fuera de alcance
- Rehidratar formularios ya montados cuando cambian queries externas.
- Cambiar todavía la semántica de recarga manual desde `button.props.action` o `form.submitAction`.
- Añadir caché, deduplicación, cancelación o latest-only por query individual.
- Actualizar documentación en esta tarea.

### Dependencias
- `T0025-01` completada

### Impacto esperado en archivos
- Código a crear o modificar:
  - `src/runtime/runtime-state/runtime-state-provider.tsx`
  - `src/runtime/runtime-state/runtime-state-selectors.ts` solo si ayuda a expresar mejor la entrada activa preparada
  - `src/runtime/runtime-state/runtime-state-types.ts` solo si la fachada pública del provider necesita afinar su contrato
- Tests a crear o modificar:
  - `src/tests/runtime-page-entry-preloads.test.tsx`
  - `src/tests/runtime-button-navigation.test.tsx`
  - `src/tests/runtime-state.test.tsx`
- Documentación a revisar o actualizar después:
  - `ai-workflow/docs/app-features/pages-and-navigation.md`
  - `ai-workflow/docs/app-features/queries-and-feedback.md`
  - `ai-workflow/docs/app-features/config-driven-ui-runtime.md`
  - `ai-workflow/docs/current-state.md`

### Tests requeridos
- Confirmar que al entrar en una página con `preloads` las queries incluidas pasan directamente al estado limpio `loading` sin exponer un paso visible por `idle`.
- Confirmar que una reentrada a la misma página con params distintos vuelve a aplicar esa preparación atómica antes de lanzar la nueva tanda.
- Confirmar que `goBack` hacia una entrada previa con `preloads` reaplica la misma política de limpieza previa.
- Confirmar que una página sin `preloads` no limpia queries no relacionadas por el mero hecho de navegar.
- Confirmar que varias precargas de la misma entrada siguen resolviendo sus requests contra un snapshot común que ya contiene params activos y queries precargadas limpias.
- Confirmar que el agregado `pageEntry` sigue cerrándose como `success` o `error` solo para la entrada activa más reciente.
- Confirmar que una respuesta tardía de una tanda antigua no reabre el agregado visible de una entrada nueva.

### Documentación afectada
- Pendiente de actualización posterior para reflejar la nueva secuencia de entrada con reset previo y arranque directo en `loading`.

### Criterios de finalización
- El provider separa con claridad la preparación síncrona de la tanda y su ejecución asíncrona.
- La nueva entrada no puede pintar un snapshot con queries precargadas todavía contaminadas por la visita anterior.
- La semántica existing de `pageEntry` y latest-only sigue cerrada por tests.
- La compatibilidad hacia atrás de páginas sin `preloads` queda demostrada.

### Cierre de implementación
Completado cuando la orquestación automática aplica el reset atómico antes del render útil y lanza luego la tanda remota desde un snapshot ya coherente.

### Cierre documental
Pendiente de una pasada posterior sobre navegación, queries, runtime y estado actual. No se cierra en esta tarea.

## T0025-03

### Estado
Completada

### Objetivo
Cerrar la regresión observable en consumidores renderizados y formularios para demostrar que, durante una reentrada con `preloads`, la nueva página ya no puede hidratar texto visible ni `defaultValue` desde datos obsoletos de `queries.*`, manteniendo intacta la semántica lazy de formularios y la recarga manual con datos previos.

### Fuera de alcance
- Introducir un sistema reactivo general de `defaultValue`.
- Cambiar la política de limpieza o persistencia global de `forms.*` fuera de lo ya fijado en `0022`.
- Reabrir la semántica manual de `executeOperation`.
- Actualizar documentación funcional o arquitectónica en esta tarea.

### Dependencias
- `T0025-02` completada

### Impacto esperado en archivos
- Código a crear o modificar:
  - `src/runtime/nodes/form-layout-node.tsx` solo si hace falta un ajuste mínimo para alinearse con la nueva secuencia del provider sin volver reactivo `defaultValue`
  - `src/runtime/runtime-page.tsx` solo si aparece un ajuste real del borde visible
  - `src/runtime/layout-renderer.tsx` solo si aparece un ajuste real del borde común al fijar la regresión visible
  - `src/runtime/runtime-state/runtime-state-provider.tsx` si la regresión final obliga a un ajuste residual del orden ya definido
- Tests a crear o modificar:
  - `src/tests/runtime-button-navigation.test.tsx`
  - `src/tests/runtime-page-entry-preloads.test.tsx`
  - `src/tests/layout-renderer.test.tsx`
  - `src/tests/runtime-state.test.tsx`
- Documentación a revisar o actualizar después:
  - `ai-workflow/docs/app-features/forms-and-validation.md`
  - `ai-workflow/docs/app-features/queries-and-feedback.md`
  - `ai-workflow/docs/app-features/pages-and-navigation.md`
  - `ai-workflow/docs/current-state.md`

### Tests requeridos
- Confirmar que al reentrar en una página parametrizada un `heading` o `paragraph` que lea `queries.{queryName}.data.*` no muestra transitoriamente el dato de la visita anterior.
- Confirmar que un formulario con `defaultValue` derivado de una query precargada no se inicializa con el registro anterior antes de que la nueva carga quede en curso.
- Confirmar que un formulario consumidor de una query precargada ve durante `loading` la query ya vacía, no el éxito previo.
- Confirmar que `queryStateFeedback.states.loading` sigue pudiendo reaccionar con normalidad durante esa reentrada.
- Confirmar que una recarga manual disparada desde botón o submit sigue conservando el último `data` mientras la nueva ejecución está en curso.
- Confirmar que `persistOnUnmount: false` conserva su semántica actual de limpieza por desmontaje real y no pasa a depender de la nueva política de `preloads`.

### Documentación afectada
- Pendiente de actualización posterior para reflejar el efecto real sobre formularios, feedback y consumidores visibles.

### Criterios de finalización
- La regresión visible queda cerrada de extremo a extremo para consumidores textuales y formularios.
- La semántica lazy de `defaultValue` permanece intacta fuera de esta ventana específica de reentrada.
- La semántica manual de recarga con datos previos se mantiene demostrada por tests.
- No aparece una solución ad hoc por consumidor que duplique la responsabilidad del provider.

### Cierre de implementación
Completado cuando la nueva entrada ya no puede hidratar consumidores visibles con datos viejos de `preloads` y el resto de semánticas vigentes permanece estable.

### Cierre documental
Pendiente de una pasada posterior sobre formularios, queries, navegación y estado actual. No se cierra en esta tarea.

## T0025-04

### Estado
Completada

### Objetivo
Cerrar la regresión final del subconjunto afectado validando conjuntamente store, provider, navegación parametrizada, `preloads`, formularios y compatibilidad hacia atrás de las recargas manuales, manteniendo el gate global de tests y coverage del proyecto.

### Fuera de alcance
- Añadir capacidades nuevas fuera de la spec.
- Reabrir decisiones técnicas ya fijadas por `design.md` y las tareas anteriores.
- Realizar en esta tarea la pasada documental amplia.

### Dependencias
- `T0025-03` completada

### Impacto esperado en archivos
- Código a crear o modificar:
  - cualquier ajuste mínimo residual en `src/runtime/` o `src/tests/` necesario para cerrar la integración sin ampliar alcance
- Tests a crear o modificar:
  - `src/tests/runtime-page-entry-preloads.test.tsx`
  - `src/tests/runtime-button-navigation.test.tsx`
  - `src/tests/runtime-state.test.tsx`
  - `src/tests/layout-renderer.test.tsx`
- Documentación a revisar o actualizar después:
  - `ai-workflow/docs/current-state.md`
  - `ai-workflow/docs/app-features/queries-and-feedback.md`
  - `ai-workflow/docs/app-features/pages-and-navigation.md`
  - `ai-workflow/docs/app-features/forms-and-validation.md`
  - `ai-workflow/docs/app-features/config-driven-ui-runtime.md`
  - `ai-workflow/features/index.md`

### Tests requeridos
- Ejecutar la regresión conjunta del subconjunto afectado de `runtime-state`, `preloads`, navegación y formularios.
- Confirmar en conjunto que solo los `preloads` limpian sus queries antes de reentrar y que las recargas manuales no cambian de semántica.
- Confirmar que páginas y formularios no afectados por `preloads` siguen comportándose como antes.
- Ejecutar `pnpm test` para validar el gate global del 80% sobre `src/`.

### Documentación afectada
- Pendiente de actualización posterior en la pasada documental de la feature.

### Criterios de finalización
- El subconjunto afectado queda validado de extremo a extremo sin regresiones funcionales abiertas.
- La compatibilidad hacia atrás se mantiene exactamente donde la spec la conserva.
- El gate global de tests y coverage queda listo para pasar a la fase documental.

### Cierre de implementación
Completado cuando la feature queda integrada y validada de extremo a extremo, sin deuda funcional abierta dentro del alcance acordado.

### Cierre documental
Pendiente de la pasada documental posterior. No se cierra en esta tarea.

## T0025-05

### Estado
Completada

### Objetivo
Actualizar la documentación funcional y técnica afectada para dejar explícito que la semántica vigente de `preloads` pasa a ser carga fresca por nueva `pageEntry`, con reset previo de sus queries declaradas antes del primer render útil y sin cambio en la semántica manual de recarga.

### Fuera de alcance
- Reabrir decisiones de implementación ya cerradas en las tareas anteriores.
- Añadir nuevas capacidades de caché, reutilización entre entradas o políticas configurables por query.
- Reescribir documentación no afectada por el cambio de semántica.

### Dependencias
- `T0025-04` completada

### Impacto esperado en archivos
- Documentación a crear o modificar:
  - `ai-workflow/docs/current-state.md`
  - `ai-workflow/docs/app-features/queries-and-feedback.md`
  - `ai-workflow/docs/app-features/pages-and-navigation.md`
  - `ai-workflow/docs/app-features/forms-and-validation.md`
  - `ai-workflow/docs/app-features/config-driven-ui-runtime.md`
  - `ai-workflow/docs/architecture.md`
  - `ai-workflow/features/index.md`
- Estado del workflow:
  - `ai-workflow/features/0025-preload-query-reset-on-page-entry/status.yaml`

### Tests requeridos
- No añade tests nuevos por sí misma.
- Debe apoyarse en el resultado validado de `T0025-04` sin contradecir el comportamiento observable cerrado por tests.

### Documentación afectada
- Se cierra en esta tarea toda la documentación listada como impactada por la spec y por las tareas anteriores.

### Criterios de finalización
- La ficha de queries deja explícito que `preloads` limpian solo sus queries declaradas antes de la nueva carga real.
- La ficha de navegación deja claro que la política se reaplica en reentradas y `goBack` sobre entradas con `preloads`.
- La ficha de formularios refleja que `defaultValue` basado en queries precargadas ya no puede hidratar datos de la entrada anterior durante la reentrada.
- `current-state.md` y `features/index.md` quedan alineados con el comportamiento ya implementado.
- `status.yaml` puede pasar a fase documental o completa según el cierre real de la feature.

### Cierre de implementación
No aplica. La implementación debe llegar cerrada desde `T0025-04`.

### Cierre documental
Completado cuando toda la documentación afectada refleja la nueva semántica estable sin contradicciones con la spec ni con los tests.

## Orden de ejecución
La secuencia contractual de la feature quedó cerrada en orden `T0025-01` → `T0025-02` → `T0025-03` → `T0025-04` → `T0025-05`.
