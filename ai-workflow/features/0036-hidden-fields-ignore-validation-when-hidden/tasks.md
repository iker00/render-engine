# Tasks: Hidden fields ignore validation while hidden

## Resultado de revisión

La feature no requiere `design.md`.

La revisión cierra dos decisiones de ejecución que la implementación no debe reabrir:
- la participación de un campo en la validación de submit debe derivarse exclusivamente de la misma visibilidad efectiva ya resuelta en `src/runtime/runtime-layout-visibility.ts`
- ocultar un campo no debe limpiar ni reconstruir su estado local; la corrección se limita a excluirlo de la validación y del bloqueo de submit mientras siga oculto

La revisión también fija una decisión de trazabilidad para evitar una implementación mal orientada:
- la regresión es del flujo de formularios apoyado en `RuntimeStateProvider`, así que la cobertura de integración debe vivir en `src/tests/runtime-state.test.tsx`; `src/tests/layout-renderer.test.tsx` puede seguir cubriendo render visible, pero no es el contrato principal para submit, persistencia de errores e interacción con `executeOperation`

No quedan bloqueos funcionales para pasar a implementación. La documentación funcional ya describe la semántica objetivo, así que la pasada documental debe centrarse en estado del workflow y en corregir solo cualquier desalineación residual que aparezca durante la implementación.

## T0036-01

### Estado
Completada

### Objetivo
Corregir la utilidad compartida de validación de formularios para que un campo oculto no participe en la pasada de validación ni convierta el submit en inválido mientras siga oculto, aunque conserve un error previo en `forms.{formId}.{fieldId}.error`.

### Fuera de alcance
- Limpiar automáticamente `error`, `dirty`, `touched`, `value` o `defaultValue` al ocultar un campo.
- Cambiar la gramática de `props.validations` o añadir reglas nuevas.
- Introducir estados agregados nuevos como `isValid`, `isSubmitting` o un dominio paralelo de errores.

### Dependencias
- `spec.md`

### Impacto esperado en archivos
- Código a crear o modificar:
  - `src/runtime/runtime-form-validations.ts`
  - `src/runtime/runtime-layout-visibility.ts` solo si hace falta exponer o ajustar una utilidad compartida para reutilizar exactamente la misma decisión de visibilidad en validación y render
- Tests a crear o modificar:
  - `src/tests/runtime-form-validations.test.ts`
  - `src/tests/runtime-layout-visibility.test.ts` solo si la extracción o ajuste de la utilidad compartida cambia el contrato explícito de visibilidad
- Documentación a revisar o actualizar después:
  - `ai-workflow/docs/app-features/forms-and-validation.md`
  - `ai-workflow/docs/architecture.md`
  - `ai-workflow/docs/current-state.md`

### Tests requeridos
- Confirmar que un campo oculto por `visibility` no aporta un error nuevo ni vuelve inválido el resultado de `validateFormFields`.
- Confirmar que un campo oculto por `queryStateFeedback` tampoco participa en la validación ni bloquea el submit.
- Confirmar que un error previo ya almacenado en un campo ahora oculto se conserva en estado local sin convertirse en causa de `isValid: false`.
- Confirmar que un campo visible con el mismo valor inválido sigue devolviendo su primer error según el orden declarado.
- Confirmar que un campo que vuelve a mostrarse tras estar oculto recupera la validación normal en la siguiente pasada.

### Documentación afectada
- Pendiente de revisión posterior para verificar que la ficha de formularios y la arquitectura siguen describiendo con precisión la única fuente de verdad de visibilidad.

### Criterios de finalización
- La utilidad compartida de validación distingue explícitamente entre conservar estado local y participar en la validación.
- La validez del formulario depende solo de los campos efectivamente visibles en el instante de validar.
- La misma semántica cubre ocultación por `visibility` y por `queryStateFeedback`.
- El comportamiento queda fijado por tests unitarios del helper y, si se toca la utilidad de visibilidad, por sus tests dedicados; no basta con cobertura indirecta de render.

### Cierre de implementación
Completado cuando el helper de validación devuelve resultados consistentes para campos visibles y ocultos, y sus tests dedicados quedan en verde.

### Cierre documental
Pendiente de una pasada posterior. No se cierra en esta tarea.

## T0036-02

### Estado
Completada

### Objetivo
Alinear el flujo de submit del nodo `form` con la semántica corregida para que la inicialización lazy, la escritura de errores y el disparo de `submitAction` respeten que solo los campos visibles participan en la validación de ese submit.

### Fuera de alcance
- Rediseñar la inicialización lazy general de campos.
- Cambiar la semántica de `resetForm`, `persistOnUnmount`, `defaultValue` o `executeOperation`.
- Reabrir la política visual de ocultación o fallback de nodos fuera del ámbito de formularios.

### Dependencias
- `T0036-01` completada

### Impacto esperado en archivos
- Código a crear o modificar:
  - `src/runtime/nodes/form-layout-node.tsx`
  - `src/runtime/runtime-form-validations.ts` solo si el flujo de submit necesita transportar contexto adicional ya cerrado en `T0036-01`
- Tests a crear o modificar:
  - `src/tests/runtime-state.test.tsx`
- Documentación a revisar o actualizar después:
  - `ai-workflow/docs/app-features/forms-and-validation.md`
  - `ai-workflow/docs/current-state.md`

### Tests requeridos
- Confirmar que un formulario puede enviarse cuando un campo `required` permanece oculto por `visibility` y el resto de campos visibles son válidos.
- Confirmar que el mismo caso funciona cuando el campo queda oculto por `queryStateFeedback`.
- Confirmar que un campo que falló validación, guardó error y luego pasa a ocultarse deja de bloquear el siguiente submit.
- Confirmar que ocultar un campo con error no altera la validación de otros campos visibles del mismo formulario.
- Confirmar que un campo oculto antes del primer submit no necesita inicializarse para bloquear o permitir el submit.
- Confirmar que, si ese campo vuelve a mostrarse con un valor aún inválido, el siguiente submit vuelve a bloquearse.

### Documentación afectada
- Pendiente de actualización posterior para reflejar el comportamiento observable final y el cierre de la regresión.

### Criterios de finalización
- El nodo `form` inicializa y valida solo los campos visibles en el momento del submit.
- La presencia de errores previos en campos ocultos no impide ejecutar `submitAction`.
- La transición visible → oculto → visible conserva el estado local y restaura la validación normal sin reseteos implícitos.
- El comportamiento observable queda fijado por tests de integración del flujo de estado del runtime, incluyendo submit real y comprobación de llamadas a `executeOperation`.

### Cierre de implementación
Completado cuando el submit del formulario reproduce correctamente los casos de ocultación previa, ocultación después de error y reaparición del campo, con tests de integración en verde.

### Cierre documental
Pendiente de una pasada posterior. No se cierra en esta tarea.

## T0036-03

### Estado
Completada

### Objetivo
Actualizar el estado documental y del workflow para reflejar la corrección cerrada, manteniendo la ficha funcional alineada solo si durante la implementación aparece alguna diferencia real entre la documentación vigente y el comportamiento final.

### Fuera de alcance
- Reabrir decisiones de implementación ya cerradas por `T0036-01` y `T0036-02`.
- Convertir `README.md` en changelog.
- Introducir documentación nueva de features no afectadas.

### Dependencias
- `T0036-02` completada

### Impacto esperado en archivos
- Documentación a crear o modificar:
  - `ai-workflow/docs/current-state.md`
  - `ai-workflow/features/index.md`
  - `ai-workflow/docs/app-features/forms-and-validation.md` solo si hace falta corregir wording residual
  - `ai-workflow/docs/architecture.md` solo si la implementación ajusta la responsabilidad explícita entre helper de visibilidad y validación
- Estado del workflow a actualizar:
  - `ai-workflow/features/0036-hidden-fields-ignore-validation-when-hidden/status.yaml`

### Tests requeridos
- No introduce tests nuevos por sí misma.
- Debe apoyarse en que `T0036-02` haya dejado en verde el subconjunto relevante y el gate global `pnpm test`.

### Documentación afectada
- Se cierra en esta propia tarea.

### Criterios de finalización
- `current-state.md` y `features/index.md` reflejan que la feature dejó de estar planificada cuando corresponda, corrigiendo además la inconsistencia actual entre una capacidad ya declarada como cerrada y la regresión real que esta feature viene a reparar.
- La ficha de formularios sigue alineada con el comportamiento estable real; si ya estaba correcta, se deja constancia solo mediante los documentos de estado y workflow.
- `status.yaml` refleja el estado real de la feature al cierre de la pasada correspondiente.

### Cierre de implementación
No aplica; la implementación debe llegar cerrada desde `T0036-02`.

### Cierre documental
Completado cuando la documentación afectada queda revisada y `status.yaml` refleja correctamente el estado posterior.
