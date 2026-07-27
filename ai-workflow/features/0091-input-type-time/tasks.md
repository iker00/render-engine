# Feature 0091 — Input type time: plan de implementación

## T1 — Extender el enum `inputType` y la política de validación

### Estado
completada

### Objetivo
Añadir `'time'` al catálogo cerrado de `inputType` en el esquema Zod, en el tipo TypeScript y en la función de exclusión de validaciones incompatibles. Tras esta tarea, un JSON con `inputType: "time"` pasa la validación de config y renderiza `<input type="time">` sin cambios en el componente React (que ya pasa `inputType` directamente al atributo HTML `type`).

### Fuera de alcance
- Cambios en el componente React `input-layout-node.tsx` (no necesarios; ya pasa `inputType` directo).
- Cambios en la lógica de validación runtime (`runtime-form-validations.ts`), que ya ignora reglas no compatibles por diseño del config-time gate.
- Tests de render o de comportamiento de formulario (tarea T2).

### Dependencias
Ninguna.

### Impacto esperado en archivos

**Código:**
- `src/config/runtime-config-zod.ts` — añadir `'time'` al array `supportedInputTypes` (línea 36).
- `src/config/runtime-config-types.ts` — añadir `'time'` a la unión de `inputType` en `InputLayoutNode` (línea 322).
- `src/config/validate-form-nodes.ts` — añadir `target.inputType !== 'time'` a la función `supportsTextLengthValidations` (línea 813-818) para que `minLength`/`maxLength` no apliquen a `time` (mismo tratamiento que `date` y `datetime-local`). `min`/`max` ya no aplican porque solo se permiten para `inputType === 'number'`.

**Tests:**
- `src/tests/config-validation/runtime-config-validation-form-fields.test.ts` (ampliación)
- `src/tests/config-validation/runtime-config-validation-forms-validations.test.ts` (ampliación)

**Documentación:**
- `ai-workflow/docs/app-features/nodes/input.md`

### Tests

**Ficheros de test:**
- `src/tests/config-validation/runtime-config-validation-form-fields.test.ts` (ampliación) — añadir `inputType: 'time'` al test `'accepts the expanded inputType catalog'`.
- `src/tests/config-validation/runtime-config-validation-forms-validations.test.ts` (ampliación) — añadir casos de aceptación y rechazo para `time`.

**Comportamiento cubierto:**
- Un input con `inputType: 'time'` pasa la validación de config sin error.
- Un input con `inputType: 'time'` y `validations.required` pasa la validación de config.
- Un input con `inputType: 'time'` y `validations.minLength` es rechazado con código `invalid-layout` (incompatible, mismo comportamiento que `date`).
- Un input con `inputType: 'time'` y `validations.maxLength` es rechazado con código `invalid-layout`.
- Un input con `inputType: 'time'` y `validations.min` es rechazado con código `invalid-layout` (solo aplica a `number`).
- Un input con `inputType: 'time'` y `validations.max` es rechazado con código `invalid-layout`.

**Comandos durante la implementación:**
```
pnpm test --run src/tests/config-validation/runtime-config-validation-form-fields.test.ts
pnpm test --run src/tests/config-validation/runtime-config-validation-forms-validations.test.ts
```

**Restricciones:**
- Seguir el patrón existente de los tests de `date` y `datetime-local` en los mismos ficheros.

### Documentación afectada
- `ai-workflow/docs/app-features/nodes/input.md` — actualizar el enum `props.inputType` para incluir `time` y añadir las reglas de validación que no aplican.

### Criterios de finalización

**Cierre de implementación:**
- Los tres ficheros de código están modificados.
- Los tests de config-validation pasan con `pnpm test --run` para los dos ficheros.
- `pnpm test` completo sigue en verde y el umbral de cobertura se mantiene.

---

## T2 — Tests de render y comportamiento de formulario

### Estado
completada

### Objetivo
Verificar con tests de integración que `inputType: 'time'` renderiza correctamente `<input type="time">`, soporta `defaultValue`, almacena el valor en el store de formulario, aplica la validación `required` en submit, y soporta `icon`/`iconPosition` con el mismo comportamiento que los demás tipos.

### Fuera de alcance
- Cambios en código fuente (no necesarios; el comportamiento ya funciona tras T1).
- Tests de config-validation (cubiertos en T1).

### Dependencias
- T1 completada (el enum debe incluir `'time'` para que la config sea válida).

### Impacto esperado en archivos

**Código:**
Ninguno.

**Tests:**
- `src/tests/layout-renderer/layout-renderer-forms-fields.test.tsx` (ampliación)
- `src/tests/runtime-state/runtime-state-validations-rules.test.tsx` (ampliación)

**Documentación:**
Ninguna.

### Tests

**Ficheros de test:**
- `src/tests/layout-renderer/layout-renderer-forms-fields.test.tsx` (ampliación) — añadir un input `time` con `defaultValue` al test existente de renderizado del catálogo expandido de `inputType`.
- `src/tests/runtime-state/runtime-state-validations-rules.test.tsx` (ampliación) — añadir un caso de `inputType: 'time'` con `validations.required` que verifica bloqueo de submit con campo vacío y éxito con valor.

**Comportamiento cubierto:**
- Un `<input type="time">` se renderiza en el DOM cuando `inputType` es `'time'`.
- `defaultValue: "14:30"` precarga el campo con el valor correcto (`toHaveValue('14:30')`).
- El valor del campo `time` queda almacenado como string en `forms.{formId}.{fieldId}`.
- Un campo `time` con `required` y valor vacío bloquea el submit y muestra el mensaje de error `"Required"`.
- Un campo `time` con `required` y valor `"09:00"` permite el submit sin error.
- El control renderiza `id` con patrón `${formId}-${fieldId}` y, cuando hay error activo, incluye `aria-describedby` apuntando al span de error.

**Comandos durante la implementación:**
```
pnpm test --run src/tests/layout-renderer/layout-renderer-forms-fields.test.tsx
pnpm test --run src/tests/runtime-state/runtime-state-validations-rules.test.tsx
```

**Restricciones:**
- Seguir el patrón exacto de los tests existentes para `date` y `datetime-local` en `layout-renderer-forms-fields.test.tsx` (mismo `describe`, misma estructura de config).
- Seguir el patrón de los tests existentes de `inputType: 'number'` con `min`/`max` en `runtime-state-validations-rules.test.tsx` para el caso de `required` con `time`.
- Reutilizar los helpers y fixtures ya existentes en cada fichero; no crear helpers nuevos.

### Documentación afectada
Ninguna.

### Criterios de finalización

**Cierre de implementación:**
- Los tests de layout-renderer y runtime-state pasan con `pnpm test --run` para los dos ficheros.
- `pnpm test` completo sigue en verde y el umbral de cobertura se mantiene.

---

## Orden de ejecución

1. **T1** — Extender enum y política de validación (habilita T2).
2. **T2** — Tests de render y comportamiento de formulario.
