# Test Plan: Hidden fields ignore validation while hidden

## Objetivo
Validar con enfoque tests-first que los campos ocultos de un formulario dejan de participar en la validación y en el bloqueo de submit mientras siguen ocultos, sin perder su estado local ni abrir una semántica nueva de errores o persistencia.

## Cobertura y gate de cierre
- El gate global del proyecto sigue siendo `pnpm test`, con mínimo del 80% de coverage en `functions`, `lines` y `statements` sobre `src/`.
- Durante la implementación puede iterarse con subconjuntos más pequeños, pero ninguna tarea queda cerrada sin sus tests relevantes en verde y sin pasar `pnpm test` al cierre de la pasada final.

## Unit tests esperados

### 1. Helper compartido de validación y visibilidad efectiva
- Archivos principales esperados:
  - `src/tests/runtime-form-validations.test.ts`
  - `src/tests/runtime-layout-visibility.test.ts` solo si cambia la superficie explícita de la utilidad de visibilidad
- Comportamiento a validar:
  - un campo oculto por `visibility` no participa en la validación del submit
  - un campo oculto por `queryStateFeedback` tampoco participa en la validación
  - un error previo almacenado en un campo oculto puede conservarse en estado local sin volver inválido el formulario
  - un campo visible con reglas incumplidas sigue devolviendo la primera regla fallida según el orden declarado
  - un campo que vuelve a hacerse visible tras estar oculto vuelve a producir error si su valor sigue siendo inválido
- Comando sugerido durante la tarea:
  - `pnpm exec vitest run src/tests/runtime-form-validations.test.ts`

## Integration tests esperados

### 2. Submit real de formularios con campos ocultos por `visibility`
- Archivos principales esperados:
  - `src/tests/runtime-state.test.tsx`
- Comportamiento a validar:
  - un campo `required` oculto desde el inicio no bloquea el submit si el resto del formulario visible es válido
  - un campo que generó error visible y luego se oculta deja de bloquear el siguiente submit
  - ocultar un campo con error no altera la validación de los demás campos visibles
  - el estado local del campo oculto sigue disponible cuando vuelve a mostrarse
- Comando sugerido durante la tarea:
  - `pnpm exec vitest run src/tests/runtime-state.test.tsx`

### 3. Submit real de formularios con campos ocultos por `queryStateFeedback`
- Archivos principales esperados:
  - `src/tests/runtime-state.test.tsx`
- Comportamiento a validar:
  - un campo oculto mientras la query observada está en `idle`, `loading`, `error` o `empty` no bloquea el submit si las reglas de feedback lo mantienen fuera de pantalla
  - un campo con error previo que pasa a ocultarse por `queryStateFeedback` deja de bloquear el submit
  - cuando la query devuelve el campo a estado visible, la siguiente validación vuelve a incluirlo
- Comando sugerido durante la tarea:
  - `pnpm exec vitest run src/tests/runtime-state.test.tsx`

### 4. Regresión final del subconjunto afectado
- Archivos principales esperados:
  - `src/tests/runtime-form-validations.test.ts`
  - `src/tests/runtime-state.test.tsx`
- Comportamiento a validar:
  - coherencia entre helper de validación, helper de visibilidad y submit observable del formulario
  - continuidad de la semántica de conservación de `value`, `error`, `dirty`, `touched` y `defaultValue`
  - ausencia de regresiones en la validación normal de campos visibles
  - mantenimiento del gate global de coverage
- Comandos sugeridos durante la tarea:
  - `pnpm exec vitest run src/tests/runtime-form-validations.test.ts src/tests/runtime-state.test.tsx`
  - `pnpm test`

## Tests e2e
- No se planifican tests e2e en esta feature.
- El comportamiento afectado vive dentro del helper local de validación, la resolución de visibilidad y el submit del renderer React, por lo que la verificación relevante queda cubierta con `Vitest` y tests de integración locales.

## Secuencia recomendada de validación por tareas
1. `T0036-01`
   - Ejecutar `pnpm exec vitest run src/tests/runtime-form-validations.test.ts`
2. `T0036-02`
   - Ejecutar `pnpm exec vitest run src/tests/runtime-form-validations.test.ts src/tests/runtime-state.test.tsx`
3. `T0036-03`
   - No exige tests nuevos si solo actualiza documentación y `status.yaml`
   - Cerrar la pasada completa con `pnpm test`

## Riesgos de validación a vigilar
- Seguir decidiendo la validez del formulario a partir de errores persistidos en store en vez de a partir de la visibilidad efectiva del campo en el instante del submit.
- Corregir el submit pero dejar divergencia entre el helper compartido y el renderer para `visibility` y `queryStateFeedback`.
- Limpiar errores de campos ocultos como efecto secundario y cambiar silenciosamente la política de conservación de estado local.
- Reintroducir la validación de campos ocultos al volver a inicializar campos lazy durante el submit.
- Confiar solo en `layout-renderer.test.tsx` y dejar sin cobertura el flujo real donde `FormNode`, `RuntimeStateProvider` y `executeOperation` coordinan la regresión.
