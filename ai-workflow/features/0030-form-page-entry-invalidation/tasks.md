# Tasks: Form page-entry invalidation

## Resultado de revisión

La feature no requiere `design.md`.

Razones:
- el cambio está acotado a una semántica ya localizada entre `src/runtime/runtime-page.tsx`, `src/runtime/nodes/form-layout-node.tsx` y el dominio `forms` del store compartido
- no cambia el contrato JSON ni la validación estructural del runtime config
- no introduce una decisión arquitectónica nueva entre varias estrategias equivalentes: la frontera funcional correcta ya está fijada por la spec y por la arquitectura vigente en torno a `pageEntry`

La revisión sí deja explícita una restricción de implementación que no debe quedar implícita:
- hoy la página ya se remonta por `pageEntry.entryId`, pero el formulario sigue conservando `forms.{formId}` cuando la nueva entrada mantiene la misma `pageId`; la implementación puede apoyarse en ese lifecycle actual si sigue siendo la opción más pequeña, pero el contrato a fijar es la invalidez por cambio de `pageEntry`, no el remount en sí mismo
- por tanto, los tests de cierre no deben limitarse a demostrar que hubo remount visual; deben fijar explícitamente el contenido de `forms.{formId}` y la reconstrucción efectiva de defaults contra la nueva entrada

Con esto, la implementación puede ejecutarse sin rediseñar la feature durante la pasada. La siguiente tarea que debe escogerse es `T0030-01`.

## T0030-01

### Estado
Completada

### Objetivo
Fijar y aplicar la nueva frontera de persistencia por defecto del formulario para que un `form` sin `persistOnUnmount: true` invalide `forms.{formId}` cuando cambia la `pageEntry` activa, también si la nueva entrada conserva la misma `pageId`, sin acoplar el contrato al detalle actual de remount por `pageEntry.entryId`.

### Fuera de alcance
- Convertir `defaultValue` en una referencia reactiva mientras la misma `pageEntry` siga activa.
- Cambiar el contrato declarativo de `form`, `input`, `textarea`, `select`, `radioGroup` o `checkboxGroup`.
- Alterar la semántica de `persistOnUnmount: true`.
- Reabrir la política de reset de queries automáticas o manuales fuera de esta frontera de formulario.

### Dependencias
- `spec.md`

### Impacto esperado en archivos
- Código a crear o modificar:
  - `src/runtime/nodes/form-layout-node.tsx`
  - `src/runtime/runtime-page.tsx` solo si hace falta un ajuste mínimo para conservar de forma explícita el remount por `pageEntry.entryId`
  - `src/runtime/runtime-state/runtime-state-selectors.ts` solo si conviene introducir una lectura más explícita de la entrada activa para el lifecycle del formulario
  - `src/runtime/runtime-state/runtime-state-types.ts` solo si hace falta tipar mejor la frontera de entrada observada por el `form`
- Tests a crear o modificar:
  - `src/tests/runtime-state.test.tsx`
  - `src/tests/runtime-button-navigation.test.tsx`
- Documentación a revisar o actualizar después:
  - `ai-workflow/docs/app-features/forms-and-validation.md`
  - `ai-workflow/docs/app-features/pages-and-navigation.md`
  - `ai-workflow/docs/current-state.md`

### Tests requeridos
- Confirmar que una reentrada a la misma `pageId` con params distintos invalida `forms.{formId}` y reconstruye el formulario sobre la nueva `pageEntry`, sin conservar el valor manual previo del usuario, tanto si el mecanismo observable sigue siendo un remount como si la implementación futura resolviera la invalidez por otra vía equivalente.
- Confirmar que un `defaultValue: "params.*"` se recalcula con los params de la nueva entrada.
- Confirmar que un rerender sin cambio de `pageEntry` no invalida el formulario.
- Confirmar que la navegación a la misma página con los mismos params efectivos sigue siendo un no-op y no reinicializa el formulario.
- Confirmar que `persistOnUnmount: true` conserva el valor manual también cuando cambia la `pageEntry` dentro de la misma página.

### Documentación afectada
- Pendiente de actualización posterior para dejar explícito que la persistencia por defecto queda ligada a `pageEntry` y no solo a `pageId` o al desmontaje real observado superficialmente.

### Criterios de finalización
- La limpieza por defecto del formulario deja de depender de si cambió `currentPageId`.
- La nueva frontera observable queda ligada a la `pageEntry` activa sin necesidad de rediseñar el store de formularios ni de convertir el remount actual en requisito contractual de la feature.
- El comportamiento queda fijado por tests de navegación y estado antes de cerrar la tarea.
- No se rompe la persistencia explícita ni la estabilidad del formulario durante la misma entrada.

### Cierre de implementación
Completado cuando el lifecycle del `form` invalida correctamente `forms.{formId}` al cambiar `pageEntry`, mantiene intacto `persistOnUnmount: true` y los tests relevantes quedan en verde.

### Cierre documental
Pendiente de una pasada posterior. No se cierra en esta tarea.

## T0030-02

### Estado
Completada

### Objetivo
Cerrar la regresión integrada entre navegación parametrizada, `preloads` y reinicialización lazy de campos para demostrar que una nueva `pageEntry` reconstruye formularios contra el contexto limpio y fresco de esa entrada, incluido `goBack` hacia entradas previas de la misma página.

### Fuera de alcance
- Cambiar la semántica latest-only del agregado `pageEntry`.
- Introducir una política global de limpieza de todos los formularios al navegar.
- Reabrir la semántica manual de `executeOperation`, `resetForm` o recargas no automáticas de queries.
- Añadir nuevas políticas declarativas de persistencia por campo o por navegación.

### Dependencias
- `T0030-01` completada

### Impacto esperado en archivos
- Código a crear o modificar:
  - `src/runtime/nodes/form-layout-node.tsx`
  - `src/runtime/runtime-state/runtime-state-provider.tsx` solo si aparece un ajuste residual de orden entre preparación de `pageEntry`, remount y carga fresca de `preloads`
  - `src/runtime/runtime-state/runtime-state-reducer.ts` solo si la regresión final exige un ajuste mínimo para mantener la semántica vigente de inicialización lazy o reset selectivo
- Tests a crear o modificar:
  - `src/tests/runtime-button-navigation.test.tsx`
  - `src/tests/runtime-page-entry-preloads.test.tsx`
  - `src/tests/runtime-state.test.tsx`
- Documentación a revisar o actualizar después:
  - `ai-workflow/docs/app-features/forms-and-validation.md`
  - `ai-workflow/docs/app-features/pages-and-navigation.md`
  - `ai-workflow/docs/app-features/queries-and-feedback.md`
  - `ai-workflow/docs/current-state.md`

### Tests requeridos
- Confirmar que un formulario con `defaultValue` basado en `queries.*` no conserva el dato de la entrada anterior durante el `loading` de una nueva `pageEntry`.
- Confirmar que, cuando llega el primer dato fresco de la nueva tanda de `preloads`, un campo todavía prístino puede absorberlo con la semántica vigente.
- Confirmar que `goBack` hacia una entrada previa de la misma página vuelve a reconstruir el formulario contra esa entrada reactivada.
- Confirmar que varios formularios en la misma página solo invalidan por defecto los que no declaran `persistOnUnmount: true`.
- Confirmar que `resetForm`, validación local y submit siguen operando sobre el nuevo estado reconstruido del formulario, verificando al menos un caso donde `forms.{formId}` ya fue invalidado por cambio de `pageEntry` y no solo un remontaje aislado.

### Documentación afectada
- Pendiente de actualización posterior para reflejar la integración real entre `pageEntry`, `preloads` y defaults de formulario.

### Criterios de finalización
- La reentrada parametrizada deja de conservar valores manuales o hidratados de otra entrada cuando no corresponde.
- La integración con `preloads` mantiene la semántica vigente de estado limpio durante `loading` y absorción acotada del primer dato fresco.
- La excepción `persistOnUnmount: true` sigue visible y comprobable en escenarios de reentrada dentro de la misma página.
- La regresión integrada queda cubierta por tests de navegación y preloads, no solo por un caso aislado del `form`.

### Cierre de implementación
Completado cuando la regresión de extremo a extremo entre `pageEntry`, `preloads` y formularios queda cerrada con tests relevantes en verde.

### Cierre documental
Pendiente de una pasada posterior. No se cierra en esta tarea.

## T0030-03

### Estado
Completada

### Objetivo
Ejecutar la regresión final del subconjunto afectado para validar conjuntamente store, navegación, `pageEntry`, formularios y `preloads`, y cerrar la feature técnica sin dejar ambigüedad sobre la compatibilidad preservada.

### Fuera de alcance
- Añadir capacidades nuevas fuera de la spec.
- Reabrir decisiones ya cerradas en `T0030-01` y `T0030-02` salvo bug demostrado por tests.
- Realizar en esta tarea la pasada documental amplia.

### Dependencias
- `T0030-02` completada

### Impacto esperado en archivos
- Código a crear o modificar:
  - cualquier ajuste mínimo residual en `src/runtime/` estrictamente necesario para cerrar la integración sin ampliar alcance
- Tests a crear o modificar:
  - `src/tests/runtime-state.test.tsx`
  - `src/tests/runtime-button-navigation.test.tsx`
  - `src/tests/runtime-page-entry-preloads.test.tsx`
- Documentación a revisar o actualizar después:
  - `ai-workflow/docs/current-state.md`
  - `ai-workflow/docs/app-features/forms-and-validation.md`
  - `ai-workflow/docs/app-features/pages-and-navigation.md`
  - `ai-workflow/docs/app-features/queries-and-feedback.md`
  - `ai-workflow/features/index.md`

### Tests requeridos
- Ejecutar la regresión conjunta del subconjunto afectado de estado, navegación y `preloads`.
- Confirmar en conjunto que la navegación no-op a la misma entrada sigue intacta.
- Confirmar en conjunto que formularios no afectados por cambio de `pageEntry` mantienen su estado local vigente.
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
Pendiente de la pasada documental posterior. No se cierra en esta tarea.

## T0030-04

### Estado
Pendiente

### Objetivo
Actualizar la documentación funcional y el estado del workflow para dejar explícito que la persistencia por defecto del formulario queda acotada a la vida de una `pageEntry`, con `persistOnUnmount` como excepción explícita y manteniendo la semántica vigente de `preloads`.

### Fuera de alcance
- Reabrir decisiones de implementación ya cerradas.
- Convertir `README.md` u otros documentos breves en changelog.
- Añadir roadmap o políticas de persistencia futuras fuera de la feature cerrada.

### Dependencias
- `T0030-03` completada

### Impacto esperado en archivos
- Documentación a crear o modificar:
  - `ai-workflow/docs/app-features/forms-and-validation.md`
  - `ai-workflow/docs/app-features/pages-and-navigation.md`
  - `ai-workflow/docs/app-features/queries-and-feedback.md`
  - `ai-workflow/docs/current-state.md`
  - `ai-workflow/features/index.md`
- Estado del workflow a actualizar:
  - `ai-workflow/features/0030-form-page-entry-invalidation/status.yaml`

### Tests requeridos
- No introduce tests nuevos por sí misma.
- Debe apoyarse en que `T0030-03` haya dejado en verde el subconjunto relevante y el gate global `pnpm test`.

### Documentación afectada
- Se cierra en esta propia tarea.

### Criterios de finalización
- La documentación estable describe sin ambigüedad la frontera `pageEntry` para persistencia por defecto del formulario.
- Queda claro que el cambio no convierte `defaultValue` en referencia reactiva general.
- `status.yaml` refleja correctamente el cierre de planificación, implementación y documentación según el momento real de la feature.

### Cierre de implementación
No aplica; la implementación debe llegar cerrada desde `T0030-03`.

### Cierre documental
Completado cuando la documentación funcional y el estado del workflow quedan actualizados de forma consistente.
