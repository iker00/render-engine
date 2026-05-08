# Tasks: Declarative form validation rules

## T0023-01

### Estado
Completada

### Objetivo
Ampliar el contrato del runtime config para sustituir `props.required` por una superficie común `props.validations`, fijando desde bootstrap las reglas soportadas, sus formas breve y extendida, el orden declarado como prioridad efectiva y la compatibilidad estricta entre cada regla y el tipo de campo al que se aplica.

La tarea debe cerrar explícitamente este shape para no dejar margen de reinterpretación en implementación:
- `props.validations` es un objeto ordenado por declaración.
- `required` admite `true` o `{ value: true, message?: string }`.
- `minLength`, `maxLength`, `min`, `max`, `minSelections` y `maxSelections` admiten un número o `{ value: number, message?: string }`.
- Omitir una regla es la única forma soportada de desactivarla; `false` o `{ value: false }` se rechazan en bootstrap.

### Fuera de alcance
- Implementar todavía la evaluación runtime de las reglas durante submit o edición.
- Reutilizar de forma parcial `required` histórico como doble contrato prolongado junto a `validations`.
- Añadir mensajes personalizados efectivos, validaciones remotas, cruzadas o expresiones arbitrarias.
- Actualizar documentación funcional o arquitectónica dentro de esta tarea.

### Dependencias
- `spec.md`
- `design.md`

### Impacto esperado en archivos
- Código a crear o modificar:
  - `src/config/runtime-config-types.ts`
  - `src/config/runtime-config-zod.ts`
  - `src/config/validate-runtime-config.ts`
  - `src/config/runtime-config.ts` solo si hace falta reexportar nuevos tipos desde la fachada pública
- Tests a crear o modificar:
  - `src/tests/runtime-config-validation.test.ts`
  - `src/tests/read-runtime-config.test.ts` solo si conviene fijar el shape público ya parseado desde la fachada de lectura
- Documentación a revisar o actualizar después:
  - `ai-workflow/docs/app-features/config-contract.md`
  - `ai-workflow/docs/app-features/forms-and-validation.md`
  - `ai-workflow/docs/current-state.md`

### Tests requeridos
- Confirmar que `input`, `textarea`, `select`, `radioGroup` y `checkboxGroup` aceptan `props.validations` con las reglas soportadas y sin `props.required`.
- Confirmar que `required` admite exactamente `true` y `{ value: true, message?: string }` como formas equivalentes.
- Confirmar que `minLength`, `maxLength`, `min`, `max`, `minSelections` y `maxSelections` admiten exactamente número y `{ value: number, message?: string }` como formas equivalentes.
- Confirmar que el orden declarado de `validations` se conserva en el config normalizado en vez de perderse en una estructura que impida una prioridad determinista.
- Confirmar que el bootstrap rechaza reglas desconocidas, shapes inválidos y combinaciones incompatibles como `min` sobre `textarea`, `minLength` sobre `checkboxGroup` o `maxSelections` sobre `radioGroup`.
- Confirmar que el bootstrap rechaza `required: false`, `required: { value: false }`, valores no finitos, cardinalidades no enteras, umbrales negativos y rangos contradictorios (`minLength > maxLength`, `min > max`, `minSelections > maxSelections`).
- Migrar en esta misma tarea los fixtures y tests contractuales que todavía declaren `props.required` para que el repositorio tenga una única superficie válida de config antes de tocar la lógica runtime.

### Documentación afectada
- Pendiente de actualización posterior para describir `validations` como frontera principal del contrato de formularios.

### Criterios de finalización
- El contrato JSON deja una única superficie estable para validación de campos.
- La compatibilidad de tipos y shapes queda resuelta antes del render con diagnósticos trazables.
- El runtime ya no depende de seguir ampliando props sueltas por regla.
- El resultado normalizado conserva información suficiente para que el runtime pueda evaluar las reglas en el orden declarado.
- El contrato extendido ya acepta `message` como metadato reservado aunque esta iteración no lo use todavía en la UI.

### Cierre de implementación
Completado cuando el borde `config/` acepta y rechaza la nueva superficie de forma determinista, sin delegar al runtime decisiones contractuales sobre compatibilidad, prioridad o shape.

### Cierre documental
Pendiente de una pasada posterior sobre contrato y formularios. No se cierra en esta tarea.

## T0023-02

### Estado
Completada

### Objetivo
Introducir la evaluación runtime de reglas locales sobre valores efectivos ya normalizados, reutilizando la visibilidad efectiva existente y haciendo que el submit del `form` escriba un único error por campo según la primera regla fallida en el orden declarado.

### Fuera de alcance
- Revalidar todavía los errores al editar cada campo individualmente.
- Añadir múltiples errores visibles por campo o un dominio agregado nuevo como `isValid`.
- Cambiar la semántica estable de `forms.{formId}.{fieldId}` o del payload de submit.
- Realizar en esta tarea la pasada documental amplia.

### Dependencias
- `T0023-01` completada

### Impacto esperado en archivos
- Código a crear o modificar:
  - `src/runtime/nodes/form-layout-node.tsx`
  - `src/runtime/runtime-state/runtime-state-types.ts` solo si hace falta tipar mejor el error o la definición resuelta de campo
  - `src/runtime/` con un helper nuevo y acotado, por ejemplo `runtime-form-validations.ts`, para centralizar evaluación de reglas y reutilizarla también desde la limpieza local de errores de `T0023-03`
  - `src/runtime/runtime-collection-sources.ts` solo si hace falta reutilizar o exponer mejor la normalización ya estable para cardinalidad de multiselección
- Tests a crear o modificar:
  - `src/tests/layout-renderer.test.tsx`
  - `src/tests/runtime-state.test.tsx`
- Documentación a revisar o actualizar después:
  - `ai-workflow/docs/architecture.md`
  - `ai-workflow/docs/current-state.md`
  - `ai-workflow/docs/app-features/forms-and-validation.md`

### Tests requeridos
- Confirmar que `required` migrado a `validations` conserva exactamente su semántica observable actual por tipo de campo.
- Confirmar que `minLength` y `maxLength` bloquean submit solo en `input` textuales y `textarea`, usando la longitud efectiva del valor actual.
- Confirmar que `min` y `max` bloquean submit solo en `inputType: 'number'`, comparando contra el valor numérico efectivo sin coerciones ambiguas.
- Confirmar que `minSelections` y `maxSelections` bloquean submit solo en `checkboxGroup` y `select.multiple`, contando la selección efectiva tras la normalización del catálogo.
- Confirmar que un campo con varias reglas incumplidas expone siempre un único error visible según la primera regla fallida en el orden declarado.
- Confirmar que los campos ocultos por `queryStateFeedback` o `visibility` conservan estado y error, pero dejan de bloquear submit mientras sigan ocultos.
- Confirmar que `resetForm`, `resetOnSuccess` y el payload de `submitAction` siguen reutilizando el mismo estado validado de `forms.*`.

### Documentación afectada
- Pendiente de actualización posterior para reflejar la nueva semántica de reglas locales y su interacción con visibilidad y submit.

### Criterios de finalización
- El `form` valida todas las reglas visibles soportadas sin abrir un subsistema paralelo de errores.
- La prioridad entre reglas depende solo del orden declarado en `validations`.
- La evaluación runtime reutiliza valores efectivos ya normalizados y no reintroduce parsing divergente para números o multiselección.
- La semántica de campos ocultos permanece alineada con `0019`.

### Cierre de implementación
Completado cuando el submit del formulario aplica el nuevo catálogo de reglas con comportamiento observable coherente y sin regresiones sobre visibilidad, payload y error único por campo.

### Cierre documental
Pendiente de una pasada posterior sobre arquitectura, estado actual y formularios. No se cierra en esta tarea.

## T0023-03

### Estado
Completada

### Objetivo
Actualizar los nodos de campo para que la limpieza de errores al editar deje de ser un `setFormFieldError(..., null)` ciego y pase a reevaluar localmente las validaciones visibles del campo, limpiando el error solo cuando la primera regla fallida ya no falla.

### Fuera de alcance
- Revalidar el formulario completo en cada pulsación.
- Introducir validación remota, debounce, touched global o estados agregados adicionales.
- Rediseñar los nodos de campo fuera de lo necesario para compartir la reevaluación local.
- Realizar en esta tarea la pasada documental amplia.

### Dependencias
- `T0023-02` completada
- Helper compartido de validación extraído o consolidado en `T0023-02` para no duplicar reglas entre submit y edición

### Impacto esperado en archivos
- Código a crear o modificar:
  - `src/runtime/nodes/input-layout-node.tsx`
  - `src/runtime/nodes/textarea-layout-node.tsx`
  - `src/runtime/nodes/select-layout-node.tsx`
  - `src/runtime/nodes/radio-group-layout-node.tsx`
  - `src/runtime/nodes/checkbox-group-layout-node.tsx`
  - `src/runtime/nodes/form-layout-node.tsx` o el helper extraído en `T0023-02`, si la reevaluación local comparte la misma lógica de regla
  - `src/runtime/form-context.tsx` solo si hace falta exponer mejor contexto para evitar duplicación insegura
- Tests a crear o modificar:
  - `src/tests/layout-renderer.test.tsx`
  - `src/tests/runtime-state.test.tsx`
- Documentación a revisar o actualizar después:
  - `ai-workflow/docs/app-features/forms-and-validation.md`
  - `ai-workflow/docs/architecture.md` solo si la implementación deja una utilidad runtime nueva como parte estable

### Tests requeridos
- Confirmar que un error por `required`, `minLength`, `maxLength`, `min`, `max`, `minSelections` o `maxSelections` se limpia al editar solo cuando el valor actual pasa a cumplir la primera regla fallida visible.
- Confirmar que la edición no limpia prematuramente el error si otra regla previa en el orden declarado sigue fallando.
- Confirmar que la limpieza local sigue siendo compatible con la normalización automática de opciones en `select.multiple` y `checkboxGroup`.
- Confirmar que un campo oculto con error previo no necesita edición para dejar de bloquear submit, y que al volver a mostrarse se reevalúa con su estado actual.
- Confirmar que no aparece una revalidación global reactiva del formulario al cambiar un solo campo.

### Documentación afectada
- Pendiente de actualización posterior para reflejar la limpieza de errores basada en reevaluación local por regla.

### Criterios de finalización
- Todos los nodos de campo reutilizan una misma semántica de limpieza de errores basada en reglas visibles.
- La UX de edición deja de depender de borrar errores ciegamente cuando el valor todavía sigue siendo inválido por otra regla.
- La implementación mantiene acotada la validación reactiva al campo editado.

### Cierre de implementación
Completado cuando editar un campo con error ya no produce falsos negativos ni exige un nuevo submit para limpiar reglas locales satisfechas.

### Cierre documental
Pendiente de una pasada posterior sobre formularios. No se cierra en esta tarea.

## T0023-04

### Estado
Completada

### Objetivo
Cerrar la regresión integrada del subconjunto afectado validando conjuntamente contrato, evaluación runtime, limpieza de errores al editar, choice normalization, visibilidad, submit y gate global de coverage del proyecto.

### Fuera de alcance
- Añadir capacidades nuevas fuera de la spec.
- Reabrir decisiones contractuales o de runtime ya cerradas en las tareas anteriores.
- Realizar en esta tarea la pasada documental amplia.

### Dependencias
- `T0023-03` completada

### Impacto esperado en archivos
- Código a crear o modificar:
  - cualquier ajuste mínimo residual en `src/config/`, `src/runtime/` o `src/tests/` necesario para cerrar la integración sin ampliar alcance
- Tests a crear o modificar:
  - `src/tests/runtime-config-validation.test.ts`
  - `src/tests/read-runtime-config.test.ts` si participa en la regresión contractual final
  - `src/tests/layout-renderer.test.tsx`
  - `src/tests/runtime-state.test.tsx`
  - `src/tests/runtime-api-execution.test.ts`
  - `src/tests/runtime-button-navigation.test.tsx` solo si hace falta cubrir una interacción con `params.*` o reentrada que afecte a defaults y reglas nuevas
- Documentación a revisar o actualizar después:
  - `ai-workflow/docs/current-state.md`
  - `ai-workflow/docs/app-features/config-contract.md`
  - `ai-workflow/docs/app-features/forms-and-validation.md`
  - `ai-workflow/docs/architecture.md`

### Tests requeridos
- Confirmar en conjunto que el config acepta `validations` y rechaza usos incompatibles con diagnósticos trazables.
- Confirmar que submit, reset, resetOnSuccess, visibilidad efectiva y normalización de colecciones siguen siendo coherentes con las nuevas reglas.
- Confirmar que formularios con reglas mixtas y orden distinto dentro de `validations` mantienen un único error determinista por campo.
- Confirmar que `defaultValue` y catálogos dinámicos siguen interactuando correctamente con `minSelections` y `maxSelections` cuando parte de la selección deja de existir.
- Ejecutar el subconjunto relevante de `vitest` durante la tarea y cerrar la pasada con `pnpm test` manteniendo el mínimo global del 80% de coverage sobre `src/`.

### Documentación afectada
- Pendiente de actualización posterior en la pasada documental de la feature.

### Criterios de finalización
- El alcance funcional completo queda validado sin regresiones abiertas en contrato, runtime ni tests principales del renderer.
- El gate global de tests y coverage queda en verde al cierre de la pasada de implementación.
- No quedan decisiones funcionales pendientes para pasar a la fase documental.

### Cierre de implementación
Completado cuando el alcance implementado queda validado de extremo a extremo y el repositorio conserva su gate global de tests y coverage.

### Cierre documental
Pendiente de la pasada documental posterior. No se cierra en esta tarea.

## T0023-05

### Estado
Completada

### Objetivo
Actualizar la documentación funcional y técnica afectada para describir `validations` como contrato estable de formularios, reflejar el nuevo catálogo de reglas locales y registrar en el estado actual y la arquitectura la nueva semántica compartida de evaluación y limpieza de errores.

### Fuera de alcance
- Reabrir decisiones de implementación ya cerradas en las tareas anteriores.
- Añadir reglas nuevas o mensajes personalizados efectivos fuera de la spec.
- Reescribir documentación no afectada por el cambio.

### Dependencias
- `T0023-04` completada

### Impacto esperado en archivos
- Documentación a crear o modificar:
  - `ai-workflow/docs/app-features/config-contract.md`
  - `ai-workflow/docs/app-features/forms-and-validation.md`
  - `ai-workflow/docs/current-state.md`
  - `ai-workflow/docs/architecture.md`
  - `ai-workflow/features/index.md` solo si hace falta ajustar el resumen de la feature ya planificada cuando pase a implementarse o cerrarse
- Estado del workflow:
  - `ai-workflow/features/0023-declarative-form-validation-rules/status.yaml`

### Tests requeridos
- No añade tests nuevos por sí misma.
- Debe apoyarse en el resultado validado de `T0023-04` sin contradecir el comportamiento cerrado por tests.

### Documentación afectada
- Se cierra en esta tarea toda la documentación listada por la spec y por las tareas anteriores.

### Criterios de finalización
- El contrato de configuración documenta `validations` y el retiro de `required` histórico como forma objetivo.
- La ficha de formularios explica reglas soportadas, orden declarado, error único por campo, limpieza local al editar y exclusión de campos ocultos.
- `current-state.md` y `architecture.md` reflejan la capacidad ya estable sin dejar la validación avanzada como límite vigente.
- `status.yaml` puede pasar a la siguiente fase documental o de cierre según el estado real de la implementación.

### Cierre de implementación
No aplica. Esta tarea no introduce código de producto ni cambia el resultado validado de implementación.

### Cierre documental
Completado cuando toda la documentación afectada refleja el comportamiento estable real de la feature sin contradicciones con spec, diseño ni tests.
