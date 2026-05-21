# Tasks: Inline choice groups

## Resultado de revisión

La feature no requiere `design.md`.

La planificación cierra tres decisiones para que la implementación no reabra ni naming ni partición:
- la nueva API debe vivir en `radioGroup.props` y `checkboxGroup.props` como una prop específica del grupo de opciones, con catálogo cerrado `optionLayout: 'vertical' | 'inline'`
- la ausencia de `optionLayout` debe seguir significando layout vertical, así que la compatibilidad hacia atrás depende de mantener `vertical` como default efectivo en contrato, renderer y tests
- la variante en línea debe resolverse solo en la capa visual de choice groups y en la validación previa al render; no debe introducir un helper general de layout ni tocar la semántica de `forms.*`, `defaultValue`, limpieza de opciones inválidas, visibilidad o submit

La cobertura también queda particionada desde ahora:
- `src/tests/runtime-config-validation.test.ts` fija el contrato y los diagnósticos del nuevo catálogo
- `src/tests/runtime-node-styling.test.ts` y `src/tests/layout-renderer.test.tsx` fijan la salida visible base
- `src/tests/runtime-state.test.tsx` cubre que la variante en línea no cambia estado, limpieza, validación ni submit

No quedan bloqueos funcionales para pasar a implementación. La siguiente tarea a ejecutar es `T0037-01`.

## T0037-01

### Estado
Completada

### Objetivo
Ampliar el contrato de configuración para que `radioGroup` y `checkboxGroup` acepten `props.optionLayout` con catálogo cerrado `vertical | inline`, manteniendo `vertical` como comportamiento por defecto cuando la prop no exista.

### Fuera de alcance
- Añadir controles equivalentes en `select`, `input`, `textarea` u otros nodos.
- Abrir una API de layout más general bajo `props.layout`, `props.direction` o `node.layout`.
- Cambiar la semántica vigente de `items`, `defaultValue`, `required`, `minSelections` o `maxSelections`.

### Dependencias
- `spec.md`

### Impacto esperado en archivos
- Código a crear o modificar:
  - `src/config/runtime-config-types.ts`
  - `src/config/runtime-config-zod.ts`
  - `src/config/validate-runtime-config.ts`
- Tests a crear o modificar:
  - `src/tests/runtime-config-validation.test.ts`
- Documentación a revisar o actualizar después:
  - `ai-workflow/docs/app-features/config-contract.md`
  - `ai-workflow/docs/app-features/forms-and-validation.md`

### Tests requeridos
- Aceptar `optionLayout: 'inline'` y `optionLayout: 'vertical'` en `radioGroup` y `checkboxGroup`.
- Confirmar que omitir la prop sigue produciendo un nodo válido con default vertical.
- Rechazar cualquier valor fuera del catálogo con ruta diagnóstica explícita en `props.optionLayout`.
- Confirmar que la nueva prop sigue conviviendo con `items`, `defaultValue` y `validations` sin alterar sus reglas vigentes.

### Documentación afectada
- Pendiente de actualización posterior para describir la nueva prop y su default efectivo.

### Criterios de finalización
- El contrato tipado y la validación previa al render aceptan solo `vertical` e `inline`.
- El resultado normalizado que consume el runtime deja explícito `optionLayout` cuando venga declarado y mantiene `undefined` como caso equivalente al default vertical.
- El diagnóstico de error identifica exactamente `props.optionLayout` cuando el valor no es soportado.
- La compatibilidad hacia atrás queda fijada por tests, no solo por ausencia de cambios manuales.

### Cierre de implementación
Completado cuando contrato, validación y tests dedicados del config quedan en verde.

### Cierre documental
Pendiente de una pasada posterior. No se cierra en esta tarea.

## T0037-02

### Estado
Completada

### Objetivo
Renderizar `radioGroup` y `checkboxGroup` en modo vertical o en línea según `props.optionLayout`, reutilizando los mismos controles nativos, textos, labels de campo y baseline compacta actual.

### Fuera de alcance
- Convertir cada opción en tarjeta, chip, botón segmentado o variante visual tematizable.
- Añadir configuración declarativa de columnas, breakpoints, alineaciones complejas o layout por opción.
- Cambiar la resolución de colecciones dinámicas, la inicialización lazy del campo o la política de errores.

### Dependencias
- `T0037-01` completada

### Impacto esperado en archivos
- Código a crear o modificar:
  - `src/runtime/runtime-node-styling.ts`
  - `src/runtime/nodes/radio-group-layout-node.tsx`
  - `src/runtime/nodes/checkbox-group-layout-node.tsx`
- Tests a crear o modificar:
  - `src/tests/runtime-node-styling.test.ts`
  - `src/tests/layout-renderer.test.tsx`
- Documentación a revisar o actualizar después:
  - `ai-workflow/docs/app-features/forms-and-validation.md`
  - `ai-workflow/docs/current-state.md`

### Tests requeridos
- Confirmar que el modo por defecto sigue usando la clase base vertical ya vigente.
- Confirmar que `optionLayout: 'inline'` cambia el wrapper de opciones a un layout horizontal con `wrap` usable y mantiene cada opción como unidad clicable con control nativo + texto.
- Confirmar que los grupos en línea siguen renderizando correctamente opciones manuales y opciones dinámicas desde `queries.*` o `item.*`.
- Confirmar que un mismo formulario puede mezclar un grupo vertical y otro inline sin contaminación cruzada de clases.
- Confirmar que labels largos siguen renderizando sin recortes ni wrappers visuales nuevos no deseados.

### Documentación afectada
- Pendiente de actualización posterior para reflejar la nueva variante visual acotada dentro de la baseline compacta.

### Criterios de finalización
- `runtime-node-styling` expone helpers explícitos para choice groups con variante vertical e inline, sin abrir una API de layout genérica.
- `RadioGroupNode` y `CheckboxGroupNode` delegan en esos helpers y no duplican strings de clases divergentes.
- La salida visible mantiene `fieldset`, `legend`, `label` y controles nativos reales en ambas variantes.
- La degradación con poco ancho depende de `wrap` y del propio flujo del texto, no de truncados o anchos fijos.

### Cierre de implementación
Completado cuando renderer y styling producen ambas variantes con tests visibles en verde.

### Cierre documental
Pendiente de una pasada posterior. No se cierra en esta tarea.

## T0037-03

### Estado
Completada

### Objetivo
Verificar por integración que la variante inline no cambia la semántica de estado, limpieza de valores inválidos, validación local ni submit, y cerrar la pasada de implementación con el gate de tests completo.

### Fuera de alcance
- Reabrir la semántica compartida de selección simple o múltiple entre `select`, `radioGroup` y `checkboxGroup`.
- Cambiar la lógica de `forms.*`, `executeOperation`, `visibility` o `queryStateFeedback` más allá de la cobertura necesaria para esta variante visual.
- Añadir e2e si la regresión queda cubierta por tests de integración locales.

### Dependencias
- `T0037-02` completada

### Impacto esperado en archivos
- Código a crear o modificar:
  - `src/runtime/nodes/form-layout-node.tsx` solo si durante la implementación aparece una divergencia real entre layout inline y la semántica actual de validación o submit
  - `src/runtime/runtime-form-validations.ts` solo si la variante inline revela una dependencia accidental con el render vertical
  - `src/dev/config.json` solo si hace falta dejar un ejemplo representativo de la nueva capacidad en el entorno local
- Tests a crear o modificar:
  - `src/tests/runtime-state.test.tsx`
  - `src/tests/layout-renderer.test.tsx` solo para completar una regresión observable adicional no cubierta en `T0037-02`
- Documentación a revisar o actualizar después:
  - `ai-workflow/docs/app-features/forms-and-validation.md`
  - `ai-workflow/docs/app-features/config-contract.md`
  - `ai-workflow/docs/current-state.md`
  - `ai-workflow/features/index.md`
  - `ai-workflow/features/0037-inline-choice-groups/status.yaml`

### Tests requeridos
- Confirmar que un `radioGroup` inline sigue escribiendo un único `string` en `forms.{formId}.{fieldId}` y limpia el valor si desaparece la opción seleccionada.
- Confirmar que un `checkboxGroup` inline sigue escribiendo `string[]`, conserva el orden estable del catálogo efectivo y limpia solo opciones inválidas.
- Confirmar que `defaultValue`, `required`, `minSelections` y `maxSelections` se comportan igual en vertical e inline.
- Confirmar que el submit declarativo emite el mismo payload tanto con grupos verticales como inline.
- Confirmar que `visibility` y `queryStateFeedback` siguen ocultando o mostrando el grupo sin comportamiento especial por la variante visual.

### Documentación afectada
- Pendiente de actualización posterior una vez cerrada la pasada de implementación.

### Criterios de finalización
- La variante inline queda demostrada como cambio visual acotado, no como cambio de semántica de datos o validación.
- Si hizo falta tocar `form-layout-node.tsx` o `runtime-form-validations.ts`, el ajuste queda justificado por una regresión observable y cubierto por tests de integración.
- Los tests de integración relevantes y `pnpm test` dejan fijado que inline y vertical comparten semántica y que el gate global sigue en verde.

### Cierre de implementación
Completado cuando los tests de integración y el gate global de tests dejan fijado que inline y vertical comparten semántica.

### Cierre documental
Pendiente de una pasada posterior. No se cierra en esta tarea.

## T0037-04

### Estado
Completada

### Objetivo
Cerrar la pasada documental y de workflow para reflejar la nueva prop `optionLayout`, su default vertical y el alcance limitado de la variante inline una vez la implementación y los tests ya estén validados.

### Fuera de alcance
- Reabrir código de runtime o tests salvo para corregir una inconsistencia documental detectada durante el cierre.
- Añadir ejemplos de producto o variantes visuales fuera de lo ya soportado por la feature implementada.

### Dependencias
- `T0037-03` completada

### Impacto esperado en archivos
- Código a crear o modificar:
  - Ninguno, salvo ajuste menor estrictamente necesario para corregir una inconsistencia documental detectada al cerrar la feature
- Tests a crear o modificar:
  - Ninguno
- Documentación a revisar o actualizar:
  - `ai-workflow/docs/app-features/forms-and-validation.md`
  - `ai-workflow/docs/app-features/config-contract.md`
  - `ai-workflow/docs/current-state.md`
  - `ai-workflow/features/index.md`
  - `ai-workflow/features/0037-inline-choice-groups/status.yaml`

### Tests requeridos
- Ningún test nuevo.
- Confirmar en `status.yaml` que la pasada documental solo se cierra si `pnpm test` ya quedó en verde en `T0037-03`.

### Documentación afectada
- Se cierra en esta propia tarea.

### Criterios de finalización
- La documentación funcional describe `optionLayout`, su catálogo cerrado y que la ausencia de la prop mantiene el layout vertical.
- `current-state.md` y `features/index.md` reflejan la nueva capacidad sin exagerar su alcance.
- `status.yaml` queda alineado con el estado real final de la feature tras documentación y validación.

### Cierre de implementación
Ya completado en la tarea anterior; esta tarea no reabre el gate de implementación.

### Cierre documental
Completado cuando la documentación afectada y `status.yaml` reflejan el comportamiento estable realmente entregado.
