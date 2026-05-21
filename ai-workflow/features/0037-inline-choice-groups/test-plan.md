# Test Plan: Inline choice groups

## Objetivo
Validar con enfoque tests-first que `radioGroup` y `checkboxGroup` soportan una variante opt-in `optionLayout: 'inline'` sin alterar contrato, render semántico, estado compartido del formulario, validación local ni submit.

## Cobertura y gate de cierre
- El gate global del proyecto sigue siendo `pnpm test`, con mínimo del 80% de coverage en `functions`, `lines` y `statements` sobre `src/`.
- Durante la implementación pueden ejecutarse subconjuntos con `Vitest`, pero ninguna tarea queda cerrada sin sus tests relevantes en verde y sin pasar `pnpm test` al final de la pasada completa.

## Unit tests esperados

### 1. Validación del contrato de `optionLayout`
- Archivos principales esperados:
  - `src/tests/runtime-config-validation.test.ts`
- Comportamiento a validar:
  - `radioGroup` acepta `optionLayout: 'vertical'`
  - `radioGroup` acepta `optionLayout: 'inline'`
  - `checkboxGroup` acepta `optionLayout: 'vertical'`
  - `checkboxGroup` acepta `optionLayout: 'inline'`
  - omitir `optionLayout` mantiene un nodo válido y compatible hacia atrás
  - cualquier valor fuera del catálogo falla antes del render con ruta diagnóstica en `props.optionLayout`
- Comando sugerido durante la tarea:
  - `pnpm exec vitest run src/tests/runtime-config-validation.test.ts`

### 2. Helpers de styling para grupos verticales e inline
- Archivos principales esperados:
  - `src/tests/runtime-node-styling.test.ts`
- Comportamiento a validar:
  - la variante vertical conserva las clases compactas actuales
  - la variante inline devuelve una composición estable de clases con distribución horizontal y `wrap`
  - la variante inline no introduce estilos de tarjeta, bordes por opción ni dependencias de anchos fijos
- Comando sugerido durante la tarea:
  - `pnpm exec vitest run src/tests/runtime-node-styling.test.ts`

## Integration tests esperados

### 3. Render visible de choice groups inline y mixtos
- Archivos principales esperados:
  - `src/tests/layout-renderer.test.tsx`
- Comportamiento a validar:
  - un `radioGroup` sin `optionLayout` sigue renderizando el wrapper vertical actual
  - un `checkboxGroup` sin `optionLayout` sigue renderizando el wrapper vertical actual
  - `optionLayout: 'inline'` aplica el wrapper inline manteniendo `fieldset`, `legend`, `label` y controles nativos
  - un formulario puede mezclar grupos verticales e inline sin que uno herede clases del otro
  - el modo inline funciona igual con opciones manuales y con opciones dinámicas desde `queries.*` o `item.*`
  - labels largos siguen presentes y clicables aunque la opción ocupe más de una línea
- Comando sugerido durante la tarea:
  - `pnpm exec vitest run src/tests/layout-renderer.test.tsx`

### 4. Estado, validación y submit con grupos inline
- Archivos principales esperados:
  - `src/tests/runtime-state.test.tsx`
- Comportamiento a validar:
  - `radioGroup` inline sigue escribiendo un único string y lo limpia si la opción desaparece del catálogo dinámico
  - `checkboxGroup` inline sigue escribiendo un array ordenado de strings y elimina solo valores ya inválidos
  - `defaultValue` válido se refleja igual en inline y vertical
  - `required`, `minSelections` y `maxSelections` siguen bloqueando o permitiendo submit según la misma semántica previa
  - el submit declarativo expone el mismo payload en `api.body` o `requestParams` independientemente de la variante visual
  - `visibility` y `queryStateFeedback` siguen comportándose igual con grupos inline
- Comando sugerido durante la tarea:
  - `pnpm exec vitest run src/tests/runtime-state.test.tsx`

### 5. Regresión coordinada del subconjunto afectado
- Archivos principales esperados:
  - `src/tests/runtime-config-validation.test.ts`
  - `src/tests/runtime-node-styling.test.ts`
  - `src/tests/layout-renderer.test.tsx`
  - `src/tests/runtime-state.test.tsx`
- Comportamiento a validar:
  - coherencia entre contrato, clases visibles, render real y semántica de formulario
  - mantenimiento del default vertical en ausencia de `optionLayout`
  - ausencia de regresiones en colecciones dinámicas, limpieza de opciones inválidas y submit de choice groups
  - mantenimiento del gate global de coverage
- Comandos sugeridos durante la tarea:
  - `pnpm exec vitest run src/tests/runtime-config-validation.test.ts src/tests/runtime-node-styling.test.ts src/tests/layout-renderer.test.tsx src/tests/runtime-state.test.tsx`
  - `pnpm test`

## Tests e2e
- No se planifican tests e2e en esta feature.
- El comportamiento afectado queda dentro del contrato JSON, los renderers React de formularios y el store local del runtime, así que la cobertura relevante queda en `Vitest` con tests unitarios e integración local.

## Secuencia recomendada de validación por tareas
1. `T0037-01`
   - Ejecutar `pnpm exec vitest run src/tests/runtime-config-validation.test.ts`
2. `T0037-02`
   - Ejecutar `pnpm exec vitest run src/tests/runtime-node-styling.test.ts src/tests/layout-renderer.test.tsx`
3. `T0037-03`
   - Ejecutar `pnpm exec vitest run src/tests/runtime-state.test.tsx`
   - Cerrar la pasada completa con `pnpm test`
4. `T0037-04`
   - No añade tests nuevos.
   - Confirmar que el cierre documental no se marca como completado si `T0037-03` no dejó ya `pnpm test` en verde.

## Riesgos de validación a vigilar
- Aceptar `optionLayout` en tipos o `Zod` pero olvidar el diagnóstico semántico consistente en `validate-runtime-config.ts`.
- Implementar clases inline solo en uno de los dos nodos y dejar divergencia visible entre `radioGroup` y `checkboxGroup`.
- Romper el default vertical existente al introducir la nueva variante.
- Resolver la variante inline con estilos demasiado rígidos que no hagan `wrap` o que recorten labels largos.
- Verificar solo render visible y dejar sin cobertura la semántica compartida de `forms.*`, limpieza de valores inválidos, validación y submit.
