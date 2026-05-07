# Test Plan: Reusable form field expansion

## Objetivo
Validar con enfoque tests-first que el catálogo declarativo de formularios se amplía sin abrir semánticas divergentes entre contrato JSON, resolución de opciones, estado compartido, validación `required` y submit para `input`, `select`, `radioGroup` y `checkboxGroup`.

## Cobertura y gate de cierre
- El gate global del proyecto sigue siendo `pnpm test`, que debe mantener al menos el 80% de coverage en `functions`, `lines` y `statements` sobre `src/`.
- Durante la implementación pueden ejecutarse subconjuntos más pequeños para iterar, pero ninguna tarea queda cerrada sin ejecutar sus bloques relevantes y sin pasar `pnpm test` al cierre de la pasada final.

## Unit tests esperados

### 1. Contrato y validación previa al render del catálogo ampliado
- Archivos principales esperados:
  - `src/tests/runtime-config-validation.test.ts`
  - `src/tests/read-runtime-config.test.ts` solo si hace falta fijar el borde de bootstrap con el contrato ampliado
- Comportamiento a validar:
  - aceptación de `inputType: number | date | datetime-local` además del catálogo existente
  - aceptación de `radioGroup` y `checkboxGroup` solo dentro de `form`
  - aceptación de `select.props.multiple` como boolean opcional
  - aceptación del mismo contrato de `items` para `select`, `radioGroup` y `checkboxGroup`
  - rechazo de `items` heterogéneos por tipo de `value`
  - rechazo de `defaultValue` literal incoherente con la multiplicidad del campo
  - rechazo de `defaultValue` literal múltiple con miembros no escalares o con mezcla `string` y `number`
  - compatibilidad intacta de configuraciones existentes con `input`, `textarea` y `select`
- Comando sugerido durante la tarea:
  - `pnpm exec vitest run src/tests/runtime-config-validation.test.ts src/tests/read-runtime-config.test.ts`

### 2. Normalización compartida de colecciones y de selección efectiva
- Archivos principales esperados:
  - `src/tests/layout-renderer.test.tsx`
  - `src/tests/runtime-state.test.tsx`
- Comportamiento a validar:
  - degradación a colección vacía cuando `queries.*` no resuelve una colección válida
  - omisión de items inválidos sin romper el resto de la colección
  - normalización de opciones a `{ label: string, value: string }`
  - normalización de selección simple a `string` y de selección múltiple a `string[]`
  - orden estable de selección múltiple según el catálogo efectivo visible
  - limpieza de valores ya inválidos cuando cambia la colección de opciones
- Comando sugerido durante la tarea:
  - `pnpm exec vitest run src/tests/layout-renderer.test.tsx src/tests/runtime-state.test.tsx`

## Integration tests esperados

### 3. `input` ampliado y `select.multiple`
- Archivos principales esperados:
  - `src/tests/layout-renderer.test.tsx`
  - `src/tests/runtime-state.test.tsx`
  - `src/tests/runtime-api-execution.test.ts`
- Comportamiento a validar:
  - render correcto de `inputType: number | date | datetime-local`
  - selección múltiple visible en `<select multiple>`
  - inicialización lazy de `select.multiple` desde `defaultValue` literal o dinámico
  - degradación a `[]` cuando el `defaultValue` dinámico de `select.multiple` no resuelve una colección utilizable
  - omisión de miembros no escalares cuando el `defaultValue` dinámico múltiple llega parcialmente degradado
  - no rehidratación del valor del usuario tras la primera interacción
  - filtrado y limpieza de selecciones inválidas al cambiar las opciones
  - validación `required` sobre `[]`
  - submit y reset reutilizando `forms.{formId}.{fieldId}` con `string[]`
  - continuidad de `select` simple cuando `multiple` no existe
- Comando sugerido durante la tarea:
  - `pnpm exec vitest run src/tests/layout-renderer.test.tsx src/tests/runtime-state.test.tsx src/tests/runtime-api-execution.test.ts`

### 4. `radioGroup` con opciones manuales y dinámicas
- Archivos principales esperados:
  - `src/tests/layout-renderer.test.tsx`
  - `src/tests/runtime-state.test.tsx`
  - `src/tests/runtime-api-execution.test.ts`
- Comportamiento a validar:
  - render de un grupo accesible con selección única
  - almacenamiento de un único `string` en `forms.{formId}.{fieldId}`
  - resolución de opciones manuales y dinámicas con la misma semántica que `select`
  - inicialización por `defaultValue` válido y vaciado por valor inexistente
  - degradación a `''` cuando el `defaultValue` dinámico de `radioGroup` no resuelve un escalar soportado
  - limpieza a `''` cuando desaparece la opción seleccionada
  - validación `required` coherente con visibilidad efectiva
  - submit sin adaptador específico adicional
- Comando sugerido durante la tarea:
  - `pnpm exec vitest run src/tests/layout-renderer.test.tsx src/tests/runtime-state.test.tsx src/tests/runtime-api-execution.test.ts`

### 5. `checkboxGroup` y semántica múltiple compartida
- Archivos principales esperados:
  - `src/tests/layout-renderer.test.tsx`
  - `src/tests/runtime-state.test.tsx`
  - `src/tests/runtime-api-execution.test.ts`
- Comportamiento a validar:
  - render de varias opciones seleccionables
  - almacenamiento de `string[]` ordenado según el catálogo visible
  - inicialización lazy desde `defaultValue` literal o dinámico
  - degradación a `[]` cuando el `defaultValue` dinámico de `checkboxGroup` no resuelve una colección utilizable
  - omisión de miembros no escalares cuando el `defaultValue` dinámico múltiple llega parcialmente degradado
  - no rehidratación automática tras interacción del usuario
  - limpieza parcial de valores inválidos cuando cambian las opciones
  - validación `required` sobre selección vacía
  - submit y reset compartiendo exactamente la misma semántica que `select.multiple`
- Comando sugerido durante la tarea:
  - `pnpm exec vitest run src/tests/layout-renderer.test.tsx src/tests/runtime-state.test.tsx src/tests/runtime-api-execution.test.ts`

### 6. Regresión final del subconjunto afectado
- Archivos principales esperados:
  - `src/tests/runtime-config-validation.test.ts`
  - `src/tests/read-runtime-config.test.ts`
  - `src/tests/layout-renderer.test.tsx`
  - `src/tests/runtime-state.test.tsx`
  - `src/tests/runtime-api-execution.test.ts`
  - `src/tests/runtime-reference-resolution.test.tsx` solo si la implementación final toca la capa genérica de referencias
- Comportamiento a validar:
  - coherencia entre bootstrap, renderer, store compartido, validación y submit
  - compatibilidad hacia atrás del catálogo previo de formularios
  - reutilización coherente de una misma colección dinámica por `select`, `radioGroup` y `checkboxGroup`
  - continuidad de exclusión de campos ocultos por `queryStateFeedback` y `visibility`
  - mantenimiento del gate global de coverage
- Comando sugerido durante la tarea:
  - `pnpm exec vitest run src/tests/runtime-config-validation.test.ts src/tests/read-runtime-config.test.ts src/tests/layout-renderer.test.tsx src/tests/runtime-state.test.tsx src/tests/runtime-api-execution.test.ts`
  - `pnpm test`

## Tests e2e
- No se planifican tests e2e en esta feature.
- El comportamiento vive íntegramente dentro del renderer declarativo, el store compartido y la capa de ejecución ya testeable con mocks en memoria, sin introducir una dependencia necesaria de navegador real o backend real para validar el alcance principal.

## Secuencia recomendada de validación por tareas
1. `T0021-01`
   - Ejecutar `pnpm exec vitest run src/tests/runtime-config-validation.test.ts src/tests/read-runtime-config.test.ts`
2. `T0021-02`
   - Ejecutar `pnpm exec vitest run src/tests/layout-renderer.test.tsx src/tests/runtime-state.test.tsx`
3. `T0021-03`
   - Ejecutar `pnpm exec vitest run src/tests/layout-renderer.test.tsx src/tests/runtime-state.test.tsx src/tests/runtime-api-execution.test.ts`
4. `T0021-04`
   - Repetir `pnpm exec vitest run src/tests/layout-renderer.test.tsx src/tests/runtime-state.test.tsx src/tests/runtime-api-execution.test.ts`
5. `T0021-05`
   - Repetir `pnpm exec vitest run src/tests/layout-renderer.test.tsx src/tests/runtime-state.test.tsx src/tests/runtime-api-execution.test.ts`
6. `T0021-06`
   - Ejecutar `pnpm exec vitest run src/tests/runtime-config-validation.test.ts src/tests/read-runtime-config.test.ts src/tests/layout-renderer.test.tsx src/tests/runtime-state.test.tsx src/tests/runtime-api-execution.test.ts`
   - Ejecutar `pnpm test`

## Riesgos de validación a vigilar
- Regressión en `select` simple al introducir `multiple`.
- Divergencia accidental entre `checkboxGroup` y `select.multiple` en representación interna, orden o limpieza de valores.
- Divergencia accidental entre `radioGroup` y `select` simple en valor vacío o validación `required`.
- Rehidratación indebida de `defaultValue` cuando las opciones dinámicas llegan tarde o cambian tras interacción del usuario.
- Persistencia de valores inválidos en `forms.*` tras una actualización de opciones, con impacto en render, validación o submit.
