# Test Plan: Declarative form validation rules

## Objetivo
Validar con enfoque tests-first que el runtime sustituye `required` histórico por `validations`, rechaza antes del render las combinaciones incompatibles, evalúa reglas locales sobre valores efectivos normalizados, conserva un único error visible por campo según el orden declarado y limpia ese error al editar solo cuando el campo ya cumple sus reglas visibles.

## Cobertura y gate de cierre
- El gate global del proyecto sigue siendo `pnpm test`, que debe mantener al menos el 80% de coverage en `functions`, `lines` y `statements` sobre `src/`.
- Durante la implementación pueden ejecutarse subconjuntos más pequeños para iterar, pero ninguna tarea queda cerrada sin ejecutar sus bloques relevantes y sin pasar `pnpm test` al final de la pasada.

## Unit tests esperados

### 1. Contrato de `validations` y validación previa al render
- Archivos principales esperados:
  - `src/tests/runtime-config-validation.test.ts`
  - `src/tests/read-runtime-config.test.ts` solo si hace falta fijar el shape normalizado expuesto por la fachada pública
- Comportamiento a validar:
  - aceptación de `validations.required` exactamente como `true` y `{ value: true, message?: string }`
  - aceptación de `minLength`, `maxLength`, `min`, `max`, `minSelections` y `maxSelections` exactamente como número y `{ value: number, message?: string }`
  - rechazo de `props.required` como contrato soportado
  - rechazo de reglas desconocidas o shapes inválidos
  - rechazo de reglas aplicadas a tipos de campo incompatibles
  - rechazo de `required: false`, `required: { value: false }`, valores no finitos, cardinalidades no enteras, umbrales negativos y rangos contradictorios cerrados en bootstrap
  - preservación del orden declarado de `validations` para la prioridad runtime
  - aceptación de `message` dentro de la forma extendida sin efecto visible todavía en los mensajes runtime
- Comando sugerido durante la tarea:
  - `pnpm exec vitest run src/tests/runtime-config-validation.test.ts src/tests/read-runtime-config.test.ts`

### 2. Helpers de evaluación de reglas locales
- Archivos principales esperados:
  - `src/tests/runtime-state.test.tsx`
  - `src/tests/layout-renderer.test.tsx`
- Comportamiento a validar:
  - semántica heredada de `required` sobre texto, selección simple y multiselección
  - longitud efectiva de `minLength` y `maxLength` sobre `input` textual y `textarea`
  - comparación numérica efectiva de `min` y `max` sobre `inputType: 'number'`
  - cardinalidad efectiva de `minSelections` y `maxSelections` después de normalizar el catálogo visible
  - prioridad por orden declarado cuando varias reglas fallan a la vez
  - exclusión de campos ocultos del circuito de bloqueo de submit
- Comando sugerido durante la tarea:
  - `pnpm exec vitest run src/tests/runtime-state.test.tsx src/tests/layout-renderer.test.tsx`

## Integration tests esperados

### 3. Submit declarativo con reglas nuevas y error único por campo
- Archivos principales esperados:
  - `src/tests/layout-renderer.test.tsx`
  - `src/tests/runtime-api-execution.test.ts`
- Comportamiento a validar:
  - el submit se bloquea cuando falla la primera regla visible declarada para el campo
  - el runtime escribe solo un error visible por campo en `forms.{formId}.{fieldId}.error`
  - `submitAction` sigue resolviendo payloads contra los valores ya validados de `forms.*`
  - `resetOnSuccess` y `resetForm` siguen siendo coherentes con el nuevo catálogo de reglas
- Comando sugerido durante la tarea:
  - `pnpm exec vitest run src/tests/layout-renderer.test.tsx src/tests/runtime-api-execution.test.ts`

### 4. Limpieza local de errores al editar
- Archivos principales esperados:
  - `src/tests/layout-renderer.test.tsx`
  - `src/tests/runtime-state.test.tsx`
- Comportamiento a validar:
  - un error existente se limpia al editar cuando la primera regla fallida ya deja de fallar
  - un error no se limpia si otra regla previa en el orden declarado sigue fallando
  - la edición de `select.multiple` y `checkboxGroup` respeta la misma semántica de cardinalidad y limpieza local
  - la edición no dispara una revalidación completa del formulario
- Comando sugerido durante la tarea:
  - `pnpm exec vitest run src/tests/layout-renderer.test.tsx src/tests/runtime-state.test.tsx`

### 5. Visibilidad, defaults dinámicos y catálogos que cambian
- Archivos principales esperados:
  - `src/tests/layout-renderer.test.tsx`
  - `src/tests/runtime-state.test.tsx`
  - `src/tests/runtime-button-navigation.test.tsx` solo si hace falta cubrir un caso de `params.*` o reentrada
- Comportamiento a validar:
  - un campo oculto por `queryStateFeedback` o `visibility` deja de bloquear submit aunque conserve error previo
  - al volver a mostrarse, el campo se reincorpora a la validación usando su estado local existente
  - `minSelections` y `maxSelections` operan sobre la selección efectiva después de que el catálogo elimine opciones inválidas
  - `defaultValue` parcialmente inválido en multiselección no provoca una cardinalidad incoherente tras la normalización
- Comando sugerido durante la tarea:
  - `pnpm exec vitest run src/tests/layout-renderer.test.tsx src/tests/runtime-state.test.tsx src/tests/runtime-button-navigation.test.tsx`

### 6. Regresión final del subconjunto afectado
- Archivos principales esperados:
  - `src/tests/runtime-config-validation.test.ts`
  - `src/tests/read-runtime-config.test.ts`
  - `src/tests/layout-renderer.test.tsx`
  - `src/tests/runtime-state.test.tsx`
  - `src/tests/runtime-api-execution.test.ts`
  - `src/tests/runtime-button-navigation.test.tsx`
- Comportamiento a validar:
  - coherencia entre contrato, visibilidad, validación local, limpieza al editar y submit
  - compatibilidad de las nuevas reglas con normalización de colecciones y defaults ya soportados
  - ausencia de regresiones sobre `required` migrado, `resetForm`, `resetOnSuccess` y payloads declarativos
  - mantenimiento del gate global de coverage
- Comando sugerido durante la tarea:
  - `pnpm exec vitest run src/tests/runtime-config-validation.test.ts src/tests/read-runtime-config.test.ts src/tests/layout-renderer.test.tsx src/tests/runtime-state.test.tsx src/tests/runtime-api-execution.test.ts src/tests/runtime-button-navigation.test.tsx`
  - `pnpm test`

## Tests e2e
- No se planifican tests e2e en esta feature.
- El comportamiento vive dentro del contrato JSON, el store compartido y el renderer React ya cubierto por la infraestructura de tests del repositorio, sin exigir navegador real ni backend real.

## Secuencia recomendada de validación por tareas
1. `T0023-01`
   - Ejecutar `pnpm exec vitest run src/tests/runtime-config-validation.test.ts src/tests/read-runtime-config.test.ts`
2. `T0023-02`
   - Ejecutar `pnpm exec vitest run src/tests/runtime-state.test.tsx src/tests/layout-renderer.test.tsx`
   - Ejecutar `pnpm exec vitest run src/tests/layout-renderer.test.tsx src/tests/runtime-api-execution.test.ts`
3. `T0023-03`
   - Ejecutar `pnpm exec vitest run src/tests/layout-renderer.test.tsx src/tests/runtime-state.test.tsx`
4. `T0023-04`
   - Ejecutar `pnpm exec vitest run src/tests/runtime-config-validation.test.ts src/tests/read-runtime-config.test.ts src/tests/layout-renderer.test.tsx src/tests/runtime-state.test.tsx src/tests/runtime-api-execution.test.ts src/tests/runtime-button-navigation.test.tsx`
   - Ejecutar `pnpm test`
5. `T0023-05`
   - No requiere nuevos comandos de test.
   - Verificar que la documentación actualizada no contradice el comportamiento validado en `T0023-04`.

## Riesgos de validación a vigilar
- Perder el orden declarado de `validations` al normalizar el config y terminar con una prioridad distinta en runtime.
- Aceptar un shape extendido incompleto o ambiguo y descubrir demasiado tarde que `message` o `value` no quedaron fijados como contrato estable.
- Limpiar errores demasiado pronto al editar por seguir usando `setFormFieldError(..., null)` sin reevaluación real.
- Reintroducir coerciones ambiguas para `min` y `max` sobre strings vacíos o tipos no numéricos.
- Contar cardinalidad sobre selecciones crudas en vez de la selección efectiva ya filtrada por el catálogo visible.
- Dejar que campos ocultos por `visibility` o `queryStateFeedback` sigan bloqueando reglas avanzadas aunque ya no bloqueen `required`.
- Romper `resetForm`, `resetOnSuccess` o el payload declarativo de `submitAction` por acoplar la validación a un shape nuevo de estado.
