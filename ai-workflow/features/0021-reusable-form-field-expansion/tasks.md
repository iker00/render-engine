# Tasks: Reusable form field expansion

## T0021-01

### Estado
Completada

### Objetivo
Ampliar el contrato del runtime config para soportar los nuevos `inputType`, introducir `radioGroup` y `checkboxGroup`, añadir `select.props.multiple` y cerrar en bootstrap las validaciones estructurales y semánticas que la feature puede resolver antes del render.

### Fuera de alcance
- Renderizar todavía `radioGroup` o `checkboxGroup` en React.
- Cambiar todavía la semántica runtime de `select` o del submit del formulario.
- Resolver todavía la limpieza runtime de selecciones inválidas cuando cambian las opciones efectivas.
- Actualizar documentación funcional o arquitectónica dentro de esta tarea.

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
  - `ai-workflow/docs/app-features/forms-and-validation.md`
  - `ai-workflow/docs/architecture.md`

### Tests requeridos
- Confirmar que `inputType` sigue aceptando los tipos existentes y añade `number`, `date` y `datetime-local`.
- Confirmar que `radioGroup` y `checkboxGroup` solo son válidos dentro de un `form`, también cuando cuelgan de un `container` descendiente.
- Confirmar que `form.children` acepta `radioGroup` y `checkboxGroup` además del catálogo previo, y sigue rechazando nodos no permitidos.
- Confirmar que `select.props.multiple` acepta solo boolean y mantiene compatibilidad cuando no existe.
- Confirmar que `radioGroup`, `checkboxGroup` y `select` aceptan exactamente los mismos shapes válidos de `items`.
- Confirmar que el config rechaza `items` manuales con mezcla de `string` y `number` dentro del mismo campo de opciones.
- Confirmar que el config rechaza `defaultValue` literal escalar en `select.multiple` y `checkboxGroup`.
- Confirmar que el config rechaza `defaultValue` literal colección en `radioGroup` y `select` simple.
- Confirmar que el config rechaza `defaultValue` literal múltiple con miembros no escalares o con mezcla `string` y `number`.
- Confirmar que configuraciones existentes que usan solo `input`, `textarea` y `select` siguen normalizando igual.

### Documentación afectada
- Pendiente de actualización posterior para reflejar el contrato ampliado del catálogo de formularios y la nueva prop `multiple`.

### Criterios de finalización
- El contrato JSON describe inequívocamente los nuevos nodos y la multiplicidad de `select`.
- La validación previa al render cierra las reglas de ancestry, catálogo permitido, homogeneidad de valores y coherencia literal básica de `defaultValue`.
- Las configuraciones previas del catálogo actual mantienen compatibilidad hacia atrás fijada por tests.
- No queda trabajo contractual importante delegado a nodos visuales o a la capa de estado.

### Cierre de implementación
Completado cuando bootstrap puede aceptar o rechazar de forma determinista toda la nueva superficie declarativa sin dejar ambigüedad sobre shapes válidos, multiplicidad ni límites de la feature.

### Cierre documental
Pendiente de una pasada posterior sobre contrato, runtime y formularios. No se cierra en esta tarea.

## T0021-02

### Estado
Completada

### Objetivo
Generalizar la capa compartida de colecciones y la semántica base de campos de opciones para que `select`, `radioGroup` y `checkboxGroup` reutilicen una única normalización de `items`, de valores efectivos y de limpieza al cambiar las opciones disponibles.

### Fuera de alcance
- Renderizar todavía `radioGroup` o `checkboxGroup` visibles.
- Añadir todavía soporte de multiselección al control `<select>`.
- Reabrir la semántica de `list.props.items` fuera de la compatibilidad necesaria con la capa compartida.
- Actualizar documentación en esta tarea.

### Dependencias
- `T0021-01` completada

### Impacto esperado en archivos
- Código a crear o modificar:
  - `src/runtime/runtime-collection-sources.ts`
  - `src/runtime/nodes/form-layout-node.tsx`
  - `src/runtime/runtime-state/runtime-state-types.ts` solo si la implementación necesita tipos auxiliares explícitos para selección múltiple
  - `src/runtime/runtime-state/runtime-state-provider.tsx` solo si hace falta una primitiva compartida para normalizar estado de campos de opciones
  - `src/runtime/runtime-state/runtime-state-selectors.ts` solo si conviene exponer helpers de lectura auxiliares
- Tests a crear o modificar:
  - `src/tests/layout-renderer.test.tsx`
  - `src/tests/runtime-state.test.tsx`
  - `src/tests/runtime-config-validation.test.ts` solo si hace falta fijar una frontera adicional entre validación literal y degradación runtime
- Documentación a revisar o actualizar después:
  - `ai-workflow/docs/architecture.md`
  - `ai-workflow/docs/app-features/config-driven-ui-runtime.md`
  - `ai-workflow/docs/app-features/forms-and-validation.md`
  - `ai-workflow/docs/current-state.md`

### Tests requeridos
- Confirmar que la resolución de opciones compartida sigue degradando a colección vacía cuando `queries.*` no aporta una colección utilizable.
- Confirmar que la proyección de opciones omite solo los items inválidos y mantiene el resto tanto para colecciones manuales como dinámicas.
- Confirmar que los valores efectivos de opciones siguen normalizándose a `string` antes de render, validación y submit.
- Confirmar que la semántica de selección múltiple se cierra a `string[]`, ordenada según las opciones efectivas visibles.
- Confirmar que la limpieza de selecciones inválidas preserva solo los valores aún disponibles y no rompe el resto del estado del formulario.
- Confirmar que `select` simple conserva su comportamiento actual sobre `defaultValue`, valor vacío `''` y limpieza cuando desaparece su opción.

### Documentación afectada
- Pendiente de actualización posterior para reflejar la capa compartida de opciones y la representación interna de selección simple/múltiple.

### Criterios de finalización
- Existe una única capa reutilizable para resolver opciones efectivas y para normalizar selección simple o múltiple.
- `form-layout-node` puede validar y limpiar campos de opciones sin lógica divergente por consumidor.
- La semántica interna `''` para simple y `[]` para múltiple queda fijada por tests antes de añadir nodos nuevos.
- El trabajo posterior de `select`, `radioGroup` y `checkboxGroup` queda reducido a consumo del contrato común, no a rediseñar la semántica base.

### Cierre de implementación
Completado cuando la base compartida de opciones y selección deja cerrada la semántica interna que deberán reutilizar todos los campos de opciones de la feature.

### Cierre documental
Pendiente de una pasada posterior sobre runtime, formularios y estado actual. No se cierra en esta tarea.

## T0021-03

### Estado
Completada

### Objetivo
Ampliar `input` con los nuevos tipos nativos acordados y adaptar `select` para soportar `multiple` de extremo a extremo, manteniendo compatibilidad total con `select` simple en render, inicialización lazy, validación `required`, reset y submit.

### Fuera de alcance
- Introducir todavía `radioGroup` o `checkboxGroup`.
- Añadir búsqueda remota, autocompletado o UX avanzada de multiselección.
- Cambiar la semántica general de `queryStateFeedback` o `visibility`.
- Actualizar documentación en esta tarea.

### Dependencias
- `T0021-02` completada

### Impacto esperado en archivos
- Código a crear o modificar:
  - `src/runtime/nodes/input-layout-node.tsx`
  - `src/runtime/nodes/select-layout-node.tsx`
  - `src/runtime/nodes/form-layout-node.tsx`
  - `src/runtime/runtime-node-styling.ts` solo si hace falta ajustar el estado visual mínimo de error para multiselección
  - `src/runtime/runtime-state/runtime-state-provider.tsx` solo si la integración necesita helpers adicionales para escribir arrays de selección
  - `src/runtime/runtime-state/runtime-state-reducer.ts` solo si la persistencia de `string[]` exige un ajuste del dominio `forms`
- Tests a crear o modificar:
  - `src/tests/layout-renderer.test.tsx`
  - `src/tests/runtime-state.test.tsx`
  - `src/tests/runtime-api-execution.test.ts`
- Documentación a revisar o actualizar después:
  - `ai-workflow/docs/app-features/forms-and-validation.md`
  - `ai-workflow/docs/app-features/config-driven-ui-runtime.md`
  - `ai-workflow/docs/current-state.md`

### Tests requeridos
- Confirmar que `inputType: number | date | datetime-local` renderiza el control nativo correcto sin romper los tipos existentes.
- Confirmar que `select.multiple` guarda `string[]` ordenado según las opciones efectivas visibles.
- Confirmar que `select.multiple` puede inicializarse desde `defaultValue` literal o dinámico, filtrando valores inexistentes y reordenándolos según el catálogo efectivo.
- Confirmar que `select.multiple` degrada a `[]` cuando un `defaultValue` dinámico no resuelve una colección y que ignora miembros no escalares si la colección llega parcialmente degradada.
- Confirmar que un `select.multiple` ya interactuado no rehidrata su `defaultValue` en rerenders o reentradas dentro de la misma instancia.
- Confirmar que, si cambian las opciones efectivas, `select.multiple` elimina solo los valores ya inválidos y conserva los todavía válidos.
- Confirmar que `required` en `select.multiple` considera inválido `[]` y no bloquea submit cuando el campo está oculto por `queryStateFeedback` o `visibility`.
- Confirmar que `resetForm` y `submitAction` reutilizan `forms.{formId}.{fieldId}` sin adaptador adicional y envían la colección actual de strings.
- Confirmar que `select` simple conserva su semántica observable previa cuando `multiple` no está presente.

### Documentación afectada
- Pendiente de actualización posterior para reflejar los nuevos tipos de `input` y la multiselección de `select`.

### Criterios de finalización
- `input` soporta los nuevos tipos nativos acordados sin regresión sobre los existentes.
- `select.multiple` queda cerrado de extremo a extremo en render, estado, validación, reset y submit.
- La compatibilidad hacia atrás de `select` simple se demuestra con tests explícitos de regresión.
- No aparece una segunda semántica de selección múltiple distinta de la base acordada en `T0021-02`.

### Cierre de implementación
Completado cuando el catálogo previo sigue estable y `select` puede operar tanto en selección simple como múltiple sin bifurcaciones ambiguas de estado o validación.

### Cierre documental
Pendiente de una pasada posterior sobre formularios, runtime y estado actual. No se cierra en esta tarea.

## T0021-04

### Estado
Completada

### Objetivo
Añadir `radioGroup` como nodo declarativo visible de selección única, reutilizando la capa compartida de opciones y la misma semántica de `defaultValue`, limpieza de selección inválida, `required`, visibilidad efectiva y submit ya fijada para los campos de una sola elección.

### Fuera de alcance
- Introducir todavía `checkboxGroup`.
- Añadir layout configurable del grupo, variantes visuales o theming declarativo.
- Introducir serialización especial del valor en submit.
- Actualizar documentación en esta tarea.

### Dependencias
- `T0021-03` completada

### Impacto esperado en archivos
- Código a crear o modificar:
  - `src/runtime/nodes/radio-group-layout-node.tsx`
  - `src/runtime/layout-node-renderer.tsx`
  - `src/runtime/nodes/form-layout-node.tsx`
  - `src/runtime/runtime-node-styling.ts`
  - `src/runtime/form-context.tsx` solo si hace falta reutilizar mejor la herencia del `formId`
- Tests a crear o modificar:
  - `src/tests/layout-renderer.test.tsx`
  - `src/tests/runtime-state.test.tsx`
  - `src/tests/runtime-api-execution.test.ts`
- Documentación a revisar o actualizar después:
  - `ai-workflow/docs/app-features/forms-and-validation.md`
  - `ai-workflow/docs/app-features/config-driven-ui-runtime.md`
  - `ai-workflow/docs/current-state.md`

### Tests requeridos
- Confirmar que `radioGroup` renderiza un conjunto accesible de opciones y permite una sola selección a la vez.
- Confirmar que `radioGroup` guarda un único `string` en `forms.{formId}.{fieldId}`.
- Confirmar que `radioGroup` acepta las mismas familias de `items` que `select` y resuelve opciones dinámicas con la misma degradación a vacío.
- Confirmar que `defaultValue` válido inicializa la selección solo la primera vez y que un valor inexistente deja el campo vacío.
- Confirmar que `radioGroup` degrada a `''` cuando un `defaultValue` dinámico no resuelve un escalar soportado.
- Confirmar que, si la colección de opciones cambia y elimina la selección actual, el campo se limpia a `''`.
- Confirmar que `required` bloquea submit cuando no hay selección efectiva visible y no bloquea cuando el campo está oculto.
- Confirmar que el payload de submit reutiliza el valor único actual sin transformación adicional.

### Documentación afectada
- Pendiente de actualización posterior para reflejar `radioGroup` y su semántica compartida con `select` simple.

### Criterios de finalización
- `radioGroup` existe como nodo visible y accesible dentro del catálogo de formularios.
- La selección única reutiliza exactamente la misma semántica efectiva que `select` simple para opciones, valor vacío, limpieza y `required`.
- El nodo no introduce un camino especial de submit ni un dominio paralelo de estado.
- La integración queda validada con fuentes manuales y dinámicas de opciones.

### Cierre de implementación
Completado cuando `radioGroup` puede usarse como consumidor adicional del contrato compartido de opciones y del dominio `forms.*` sin abrir semánticas propias incompatibles.

### Cierre documental
Pendiente de una pasada posterior sobre formularios, runtime y estado actual. No se cierra en esta tarea.

## T0021-05

### Estado
Completada

### Objetivo
Añadir `checkboxGroup` como nodo declarativo visible de selección múltiple, reutilizando la misma semántica compartida ya fijada para `select.multiple` en opciones, `defaultValue`, limpieza de selección inválida, `required`, reset y submit.

### Fuera de alcance
- Cerrar todavía la regresión final global de la feature ni ejecutar el gate completo de coverage como criterio de cierre único de esta tarea.
- Añadir capacidades nuevas fuera de la spec.
- Introducir layout declarativo complejo para grupos de opciones.
- Reabrir decisiones contractuales o de representación interna ya fijadas por las tareas anteriores.
- Realizar en esta tarea la pasada documental amplia.

### Dependencias
- `T0021-04` completada

### Impacto esperado en archivos
- Código a crear o modificar:
  - `src/runtime/nodes/checkbox-group-layout-node.tsx`
  - `src/runtime/layout-node-renderer.tsx`
  - `src/runtime/nodes/form-layout-node.tsx`
  - `src/runtime/runtime-node-styling.ts`
  - `src/runtime/runtime-collection-sources.ts` solo si la integración final de la selección múltiple compartida necesita un ajuste puntual del helper común
- Tests a crear o modificar:
  - `src/tests/layout-renderer.test.tsx`
  - `src/tests/runtime-state.test.tsx`
  - `src/tests/runtime-api-execution.test.ts`
- Documentación a revisar o actualizar después:
  - `ai-workflow/docs/current-state.md`
  - `ai-workflow/docs/app-features/config-driven-ui-runtime.md`
  - `ai-workflow/docs/app-features/forms-and-validation.md`

### Tests requeridos
- Confirmar que `checkboxGroup` renderiza varias opciones seleccionables y guarda `string[]` en el orden efectivo del catálogo visible.
- Confirmar que `checkboxGroup` comparte con `select.multiple` la semántica de `defaultValue`, limpieza de valores inválidos, `required`, reset y submit.
- Confirmar que `checkboxGroup` degrada a `[]` cuando un `defaultValue` dinámico no resuelve una colección y que ignora miembros no escalares si la colección llega parcialmente degradada.
- Confirmar que un `checkboxGroup` ya interactuado no rehidrata `defaultValue` en rerenders o reentradas dentro de la misma instancia.
- Confirmar que `radioGroup`, `checkboxGroup` y `select` pueden reutilizar una misma colección dinámica con proyecciones coherentes y sin colisión de estado entre `fieldId` distintos.
- Confirmar que `checkboxGroup` no introduce una semántica distinta de orden ni de reset respecto a `select.multiple`.

### Documentación afectada
- Pendiente de actualización posterior para reflejar `checkboxGroup` y la semántica múltiple compartida dentro del catálogo ampliado.

### Criterios de finalización
- `checkboxGroup` queda integrado de extremo a extremo como consumidor de la semántica múltiple compartida.
- La integración deja a `T0021-06` solo la regresión cruzada y el gate global, no decisiones nuevas sobre comportamiento de `checkboxGroup`.
- No aparece una segunda semántica múltiple distinta de la ya fijada para `select.multiple`.

### Cierre de implementación
Completado cuando `checkboxGroup` funciona de extremo a extremo como consumidor de la semántica múltiple compartida y sus tests específicos quedan en verde.

### Cierre documental
Pendiente de una pasada posterior sobre estado actual, fichas funcionales y mapa de features. No se cierra en esta tarea.

## T0021-06

### Estado
Completada

### Objetivo
Cerrar la regresión final del subconjunto afectado validando conjuntamente contrato, semántica compartida de opciones, `select.multiple`, `radioGroup`, `checkboxGroup`, submit y gate global de coverage antes de pasar la feature a documentación.

### Fuera de alcance
- Añadir capacidades nuevas fuera de la spec.
- Reabrir decisiones contractuales o de representación interna ya cerradas por `spec.md` y `design.md`.
- Realizar en esta tarea la pasada documental amplia.

### Dependencias
- `T0021-05` completada

### Impacto esperado en archivos
- Código a revisar o ajustar solo si la regresión detecta incoherencias:
  - archivos ya tocados por `T0021-01` a `T0021-05`
- Tests a crear o modificar:
  - `src/tests/runtime-config-validation.test.ts`
  - `src/tests/read-runtime-config.test.ts`
  - `src/tests/layout-renderer.test.tsx`
  - `src/tests/runtime-state.test.tsx`
  - `src/tests/runtime-api-execution.test.ts`
  - `src/tests/runtime-reference-resolution.test.tsx` solo si la implementación final toca la resolución genérica de referencias
- Documentación a revisar o actualizar después:
  - `ai-workflow/docs/current-state.md`
  - `ai-workflow/docs/app-features/config-contract.md`
  - `ai-workflow/docs/app-features/config-driven-ui-runtime.md`
  - `ai-workflow/docs/app-features/forms-and-validation.md`
  - `ai-workflow/docs/architecture.md`
  - `ai-workflow/features/index.md` solo cuando la feature quede realmente cerrada en la pasada documental

### Tests requeridos
- Confirmar que configuraciones previas que usan solo `input`, `textarea` y `select` siguen manteniendo el comportamiento observable vigente.
- Confirmar que el subconjunto completo afectado mantiene coherencia entre validación previa al render, renderer, store compartido, validación de formulario y submit.
- Confirmar que `radioGroup`, `checkboxGroup` y `select` pueden reutilizar una misma colección dinámica con proyecciones coherentes y sin colisión de estado entre `fieldId` distintos.
- Confirmar que la exclusión de campos ocultos por `queryStateFeedback` y `visibility` sigue siendo coherente para selección simple y múltiple.
- Confirmar el gate global de coverage con `pnpm test`.

### Documentación afectada
- Pendiente de actualización posterior para reflejar el catálogo ampliado estable y marcar la feature en la documentación funcional.

### Criterios de finalización
- La regresión final demuestra coherencia entre contrato, runtime, formularios y submit para todo el catálogo ampliado.
- La compatibilidad hacia atrás del catálogo previo queda fijada por tests explícitos.
- El gate global de tests y coverage vuelve a quedar superado antes de pasar a documentación.

### Cierre de implementación
Completado cuando el catálogo ampliado de formularios funciona de extremo a extremo con tests relevantes en verde y el gate global del proyecto vuelve a quedar superado.

### Cierre documental
Pendiente de una pasada posterior sobre estado actual, fichas funcionales y mapa de features. No se cierra en esta tarea.

## Siguiente tarea recomendada
- Empezar por `T0021-01`.
- No iniciar `T0021-02` hasta que la frontera contractual de `radioGroup`, `checkboxGroup`, `select.multiple` y `defaultValue` literal por multiplicidad quede fijada por tests de bootstrap.
