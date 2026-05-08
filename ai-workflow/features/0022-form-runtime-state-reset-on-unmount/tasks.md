# Tasks: Form runtime state reset on unmount

## T0022-01

### Estado
Completada

### Objetivo
Ampliar el contrato del runtime config para que el nodo `form` acepte la propiedad opcional `persistOnUnmount`, fijando en bootstrap que la semántica por defecto pasa a ser limpiar el estado local al desmontar y que la persistencia histórica solo se recupera de forma explícita.

### Fuera de alcance
- Implementar todavía la limpieza real del estado al desmontarse.
- Cambiar todavía el reducer o el provider del runtime para soportar borrado de formularios.
- Rehidratar formularios ya montados cuando cambian `params.*`, `queries.*` u otros orígenes dinámicos.
- Actualizar documentación funcional o arquitectónica dentro de esta tarea.

### Dependencias
- `spec.md`

### Impacto esperado en archivos
- Código a crear o modificar:
  - `src/config/runtime-config-types.ts`
  - `src/config/runtime-config-zod.ts`
  - `src/config/validate-runtime-config.ts`
  - `src/config/runtime-config.ts` solo si hace falta reexportar el shape ampliado desde la fachada pública
- Tests a crear o modificar:
  - `src/tests/runtime-config-validation.test.ts`
  - `src/tests/read-runtime-config.test.ts` solo si conviene fijar la compatibilidad del borde de bootstrap con el nuevo shape del nodo `form`
- Documentación a revisar o actualizar después:
  - `ai-workflow/docs/app-features/config-contract.md`
  - `ai-workflow/docs/app-features/forms-and-validation.md`
  - `ai-workflow/docs/app-features/config-driven-ui-runtime.md`

### Tests requeridos
- Confirmar que `form` sigue siendo válido sin `persistOnUnmount`.
- Confirmar que `persistOnUnmount` acepta solo boolean y sigue siendo opcional.
- Confirmar que `persistOnUnmount: true` y `persistOnUnmount: false` se normalizan sin romper el resto del shape de `form`.
- Confirmar que configuraciones existentes con `form`, `submitAction` y `resetOnSuccess` siguen validando igual cuando no declaran la nueva propiedad.
- Confirmar que valores inválidos como string, number, array u objeto en `persistOnUnmount` se rechazan sobre la ruta exacta del nodo.

### Documentación afectada
- Pendiente de actualización posterior para reflejar el nuevo contrato del nodo `form` y el cambio de semántica por defecto.

### Criterios de finalización
- El contrato JSON describe inequívocamente `persistOnUnmount` como excepción opt-in a la limpieza por desmontaje.
- Bootstrap acepta o rechaza de forma determinista toda la nueva superficie declarativa del nodo `form`.
- La compatibilidad hacia atrás del shape histórico de `form` queda fijada por tests.
- No queda ambigüedad contractual sobre si la persistencia es implícita o explícita.

### Cierre de implementación
Completado cuando el contrato del config deja cerrada la nueva semántica del nodo `form` sin delegar decisiones de shape o defaults a la implementación runtime.

### Cierre documental
Pendiente de una pasada posterior sobre contrato y formularios. No se cierra en esta tarea.

## T0022-02

### Estado
Completada

### Objetivo
Introducir en el dominio compartido de `forms` una primitiva explícita para eliminar el estado completo de un formulario concreto sin afectar a los demás, manteniendo intacta la semántica vigente de `resetForm`.

### Fuera de alcance
- Conectar todavía esa primitiva al ciclo de vida real del nodo `form`.
- Cambiar todavía la inicialización lazy de los campos durante el render del formulario.
- Reabrir la semántica de `resetForm`, `required`, submit o payloads `forms.*`.
- Actualizar documentación dentro de esta tarea.

### Dependencias
- `T0022-01` completada

### Impacto esperado en archivos
- Código a crear o modificar:
  - `src/runtime/runtime-state/runtime-state-types.ts`
  - `src/runtime/runtime-state/runtime-state-reducer.ts`
  - `src/runtime/runtime-state/runtime-state-provider.tsx`
  - `src/runtime/runtime-state/runtime-state-selectors.ts` solo si conviene exponer un helper explícito para comprobar ausencia total del formulario
- Tests a crear o modificar:
  - `src/tests/runtime-state.test.tsx`
  - `src/tests/runtime-ui-actions.test.tsx` solo si la implementación expone o reusa una firma compartida nueva
- Documentación a revisar o actualizar después:
  - `ai-workflow/docs/architecture.md`
  - `ai-workflow/docs/current-state.md`
  - `ai-workflow/docs/app-features/config-driven-ui-runtime.md`

### Tests requeridos
- Confirmar que existe una acción explícita para borrar `forms.{formId}` completo sin tocar otros formularios.
- Confirmar que borrar un formulario elimina también `value`, `error`, `touched`, `dirty` y `defaultValue` de todos sus campos.
- Confirmar que borrar un formulario inexistente deja el estado estable y no crea errores nuevos.
- Confirmar que `resetForm` sigue restaurando el estado inicial efectivo del formulario ya existente, y no se convierte en borrado.
- Confirmar que la primitiva nueva no altera navegación, queries ni el aislamiento entre varias instancias del runtime.

### Documentación afectada
- Pendiente de actualización posterior para reflejar la nueva capacidad interna de borrado total por `formId`.

### Criterios de finalización
- El store compartido distingue de forma explícita entre resetear un formulario existente y eliminarlo por completo.
- El borrado total queda cerrado por tests sobre el reducer y la fachada de acciones del provider.
- La semántica histórica de `resetForm` permanece estable y demostrada por regresión.

### Cierre de implementación
Completado cuando el dominio `forms` ya ofrece una primitiva segura y acotada para limpieza total por `formId`, lista para que el nodo `form` la use en su desmontaje real.

### Cierre documental
Pendiente de una pasada posterior sobre arquitectura y estado actual. No se cierra en esta tarea.

## T0022-03

### Estado
Completada

### Objetivo
Conectar el nodo `form` al ciclo de vida real de montaje y desmontaje para que, por defecto, elimine su estado al desmontarse, vuelva a inicializarse con la semántica lazy vigente en el siguiente montaje y conserve la persistencia histórica solo cuando `persistOnUnmount` esté activado.

### Fuera de alcance
- Introducir políticas nuevas de limpieza global por navegación, `pageEntry`, visibilidad o cambios de params mientras el formulario sigue montado.
- Rehidratar campos ya montados cuando cambian datos externos sin desmontaje real.
- Añadir políticas intermedias de persistencia por campo o por evento.
- Realizar en esta tarea la pasada documental amplia.

### Dependencias
- `T0022-02` completada

### Impacto esperado en archivos
- Código a crear o modificar:
  - `src/runtime/nodes/form-layout-node.tsx`
  - `src/runtime/runtime-state/runtime-state-provider.tsx`
  - `src/runtime/runtime-state/runtime-state-selectors.ts` solo si la implementación necesita una lectura más explícita de ausencia/presencia del formulario
  - `src/runtime/runtime-state/runtime-state-types.ts` solo si hace falta ampliar la superficie pública de acciones del provider
- Tests a crear o modificar:
  - `src/tests/runtime-state.test.tsx`
  - `src/tests/layout-renderer.test.tsx`
  - `src/tests/runtime-button-navigation.test.tsx`
  - `src/tests/runtime-api-execution.test.ts` solo si conviene fijar que submit y payloads siguen leyendo el estado local vigente tras remontaje
- Documentación a revisar o actualizar después:
  - `ai-workflow/docs/app-features/forms-and-validation.md`
  - `ai-workflow/docs/app-features/pages-and-navigation.md`
  - `ai-workflow/docs/app-features/config-driven-ui-runtime.md`
  - `ai-workflow/docs/current-state.md`

### Tests requeridos
- Confirmar que un formulario sin `persistOnUnmount` desaparece de `runtimeState.forms` al desmontarse realmente.
- Confirmar que un rerender del mismo formulario montado no dispara limpieza ni reinicializa campos ya escritos.
- Confirmar que, tras remontar ese formulario, sus campos vuelven a inicializarse como primera inicialización efectiva y no recuperan valores escritos en la visita anterior.
- Confirmar que un `defaultValue` basado en `params.*` se recalcula en el nuevo montaje cuando la entrada activa cambió entre visitas.
- Confirmar que un `defaultValue` basado en `queries.*` se reconstruye desde los datos externos vigentes tras un desmontaje y no desde `forms.*` anterior.
- Confirmar que el flujo `search-posts -> home -> post-form` o su equivalente de test deja de reutilizar valores previos por defecto.
- Confirmar que `persistOnUnmount: true` conserva los valores ya escritos tras desmontar y volver a montar dentro de la misma instancia.
- Confirmar que un formulario oculto por `visibility` o `queryStateFeedback` pero todavía montado conserva su estado y no dispara limpieza.
- Confirmar que `resetForm`, validación `required` y submit siguen operando sobre el estado local vigente después de cada remontaje.
- Confirmar que varios formularios conviven sin borrarse entre sí cuando uno se desmonta.

### Documentación afectada
- Pendiente de actualización posterior para reflejar la limpieza por desmontaje como nuevo default y la persistencia como opción explícita.

### Criterios de finalización
- El ciclo de vida visible de `form` distingue correctamente entre rerender, ocultación y desmontaje real.
- La limpieza al desmontar queda ligada a una frontera de lifecycle estable del nodo `form`, no a cambios de estado, submit, navegación interna sin desmontaje ni rerenders ordinarios.
- La semántica lazy de inicialización permanece intacta mientras el formulario sigue montado.
- El nuevo default de limpieza y la excepción `persistOnUnmount` quedan demostrados con casos de navegación y de datos externos.
- No aparece una política lateral de limpieza global fuera del nodo `form`.

### Cierre de implementación
Completado cuando el comportamiento observable del runtime coincide con la spec en desmontaje, remontaje, defaults dinámicos y persistencia opt-in por formulario.

### Cierre documental
Pendiente de una pasada posterior sobre runtime, formularios, navegación y estado actual. No se cierra en esta tarea.

## T0022-04

### Estado
Completada

### Objetivo
Cerrar la regresión final del subconjunto afectado validando conjuntamente contrato, primitiva de borrado, ciclo de vida del formulario, compatibilidad hacia atrás de `resetForm` y gate global de coverage del proyecto.

### Fuera de alcance
- Añadir capacidades nuevas fuera de la spec.
- Reabrir decisiones contractuales o de lifecycle ya fijadas por las tareas anteriores.
- Realizar en esta tarea la pasada documental amplia.

### Dependencias
- `T0022-03` completada

### Impacto esperado en archivos
- Código a crear o modificar:
  - cualquier ajuste mínimo residual en `src/config/`, `src/runtime/` o `src/tests/` necesario para cerrar la integración sin ampliar alcance
- Tests a crear o modificar:
  - `src/tests/runtime-config-validation.test.ts`
  - `src/tests/read-runtime-config.test.ts` si participa en la regresión contractual final
  - `src/tests/runtime-state.test.tsx`
  - `src/tests/layout-renderer.test.tsx`
  - `src/tests/runtime-button-navigation.test.tsx`
  - `src/tests/runtime-api-execution.test.ts` si cubre un borde final de submit tras remontaje
- Documentación a revisar o actualizar después:
  - `ai-workflow/docs/current-state.md`
  - `ai-workflow/docs/app-features/config-contract.md`
  - `ai-workflow/docs/app-features/forms-and-validation.md`
  - `ai-workflow/docs/app-features/pages-and-navigation.md`
  - `ai-workflow/docs/app-features/config-driven-ui-runtime.md`

### Tests requeridos
- Confirmar en conjunto que el config acepta la nueva propiedad y mantiene compatibilidad con formularios existentes.
- Confirmar que la limpieza por desmontaje no rompe el reset explícito ni el submit declarativo.
- Confirmar que los defaults dinámicos desde `params.*` y `queries.*` se observan correctamente al remontar.
- Confirmar que `persistOnUnmount: true` recupera la persistencia histórica solo para el formulario que la declara.
- Ejecutar el gate global `pnpm test` y mantener el mínimo del 80% de coverage sobre `src/`.

### Documentación afectada
- Pendiente de actualización posterior en la pasada documental de la feature.

### Criterios de finalización
- El subconjunto afectado queda validado de extremo a extremo sin regresiones funcionales abiertas.
- La compatibilidad hacia atrás se mantiene solo donde la spec la conserva explícitamente.
- El gate global de tests y coverage queda en verde al cierre de la pasada de implementación.

### Cierre de implementación
Completado cuando la implementación del alcance queda validada de extremo a extremo, sin deuda funcional abierta dentro de la spec y con el gate global de tests listo para pasar a la fase documental.

### Cierre documental
Pendiente de la pasada documental posterior. No se cierra en esta tarea.

## T0022-05

### Estado
Pendiente

### Objetivo
Actualizar la documentación funcional y técnica afectada para dejar explícito que la limpieza del estado de `form` al desmontarse pasa a ser el comportamiento por defecto y que la persistencia histórica solo se conserva con `persistOnUnmount`.

### Fuera de alcance
- Reabrir decisiones de implementación ya cerradas en las tareas anteriores.
- Añadir nuevas capacidades de formularios, navegación o estado fuera de la spec.
- Reescribir documentación no afectada por el cambio de semántica.

### Dependencias
- `T0022-04` completada

### Impacto esperado en archivos
- Documentación a crear o modificar:
  - `ai-workflow/docs/current-state.md`
  - `ai-workflow/docs/app-features/config-contract.md`
  - `ai-workflow/docs/app-features/forms-and-validation.md`
  - `ai-workflow/docs/app-features/pages-and-navigation.md`
  - `ai-workflow/docs/app-features/config-driven-ui-runtime.md`
  - `ai-workflow/docs/architecture.md` solo si la implementación introduce una primitiva interna nueva que deba quedar reflejada como parte estable
- Estado del workflow:
  - `ai-workflow/features/0022-form-runtime-state-reset-on-unmount/status.yaml`

### Tests requeridos
- No añade tests nuevos por sí misma.
- Debe apoyarse en el resultado validado de `T0022-04` sin contradecir el comportamiento observable cerrado por tests.

### Documentación afectada
- Se cierra en esta tarea toda la documentación listada como impactada por la spec y por las tareas anteriores.

### Criterios de finalización
- El contrato del nodo `form` documenta `persistOnUnmount` con su semántica opt-in real.
- La ficha de formularios deja claro que el estado local ya no se conserva por defecto entre desmontajes reales.
- La relación con navegación y reentrada parametrizada queda descrita sin sugerir una limpieza global por cambio de página.
- `status.yaml` puede pasar a la siguiente fase sin huecos documentales abiertos para esta feature.

### Cierre de implementación
No aplica. La implementación ya debe estar cerrada al entrar en esta tarea.

### Cierre documental
Completado cuando la documentación funcional y técnica afectada refleja el comportamiento estable final y `status.yaml` queda actualizado para el cierre posterior de la feature.
