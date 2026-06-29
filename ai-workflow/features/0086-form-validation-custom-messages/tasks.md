# Tasks: mensajes de error personalizados en validaciones de formulario

Feature: `0086-form-validation-custom-messages`
Spec de referencia: [spec.md](./spec.md)
Design: no aplica (`requires_design: false`).

Orden de ejecución obligatorio: 0086.1 → 0086.2.

## 0086.1 — Helper de formateo del mensaje de error personalizado

### Estado
completada

### Objetivo
Introducir un helper puro que produzca el string final de error de una regla de validación de formulario, aplicando la sustitución de `{{value}}` y delegando el resto de placeholders al sistema central de referencias dinámicas. El helper queda aislado del resto del pipeline de validación para poder probarse en unidad y luego cablearse en 0086.2.

Incluye:
- nueva función `formatValidationMessage` con firma fija `(input: { rule: { value: number | true; message?: string }; defaultMessage: string; state: RuntimeState; iterationContext?: RuntimeIterationContext }) => string`
- semántica:
  - si `rule.message === undefined` → devuelve `defaultMessage` sin tocar el resolver de referencias
  - si `rule.message === ''` → devuelve `''` (string vacío explícito, válido)
  - si `rule.message` es string no vacío:
    - sustituir todas las apariciones de `{{value}}` (con espacios opcionales internos, p. ej. `{{ value }}`) por `String(rule.value)` cuando `rule.value` sea `number` (incluye `0`); por `''` cuando `rule.value` sea `true` u otra cosa no numérica
    - tras esa sustitución, delegar el string resultante a `resolveRuntimeTextReference(substituted, state, 'form.validation.message', { iterationContext })` para resolver `{{translations.someKey}}` y degradar a `''` cualquier otro placeholder
- añadir la superficie `'form.validation.message'` al tipo `RuntimeReferenceSurface` en `runtime-reference-diagnostics.ts` para que el diagnóstico en DEV registre el origen correcto cuando una referencia interpolada no resuelva

### Fuera de alcance
- Cablear el helper en `validateFormFields` o `getValidationErrorForEditedField` (es 0086.2).
- Refactorizar `getFirstVisibleValidationError` (es 0086.2).
- Modificar el contrato JSON o el zod de `validations.*.message` (ya existe y se acepta).
- Cambiar reglas de prioridad de validaciones, criterios de inicialización lazy ni semántica de `forms.{formId}.{fieldId}.error`.
- Validaciones del nodo `fileManager` (sistema independiente, sin cambios).

### Dependencias
Ninguna.

### Impacto esperado en archivos
- Código:
  - `src/runtime/runtime-form-validations.ts` — añadir `formatValidationMessage` y exportarlo. Mantener imports compatibles con el resolver de referencias y el tipo `RuntimeIterationContext`.
  - `src/runtime/runtime-references/runtime-reference-diagnostics.ts` — añadir `'form.validation.message'` a la unión `RuntimeReferenceSurface`.
- Tests:
  - `src/tests/runtime/runtime-form-validation-message.test.ts` (nuevo) — unit tests del helper.
- Documentación:
  - Ninguna en esta tarea. La actualización de `ai-workflow/docs/app-features/forms/validation-rules.md` se reserva a la pasada `update-app-documentation` tras 0086.2.

### Tests
- **Ficheros de test**:
  - `src/tests/runtime/runtime-form-validation-message.test.ts` (nuevo)
- **Comportamiento cubierto**:
  - regla con `message` ausente → devuelve `defaultMessage` literal sin invocar el resolver (no debe romper si el resolver no se llama; cubrir caso explícito con un message ausente)
  - regla con `message: ''` → devuelve `''`
  - regla con `message: 'Texto literal sin placeholders'` → devuelve el string tal cual
  - regla con `message: 'Mínimo {{value}} caracteres'` y `rule.value: 3` → devuelve `'Mínimo 3 caracteres'`
  - regla con `message: 'Mínimo {{ value }}'` (con espacios internos) y `rule.value: 5` → devuelve `'Mínimo 5'`
  - regla con `message: '{{value}} y {{value}}'` y `rule.value: 7` → devuelve `'7 y 7'` (múltiples ocurrencias del mismo placeholder)
  - regla con `message: '{{value}}'` y `rule.value: 0` → devuelve `'0'` (zero no degrada a vacío)
  - regla con `message: '{{value}} es requerido'` y `rule.value: true` → devuelve `' es requerido'` (boolean true degrada a vacío)
  - regla con `message: '{{translations.max_length_error}}'` y catálogo con esa clave para el idioma activo → devuelve el string traducido del catálogo
  - regla con `message: '{{translations.unknown_key}}'` y catálogo sin esa clave en idioma activo ni en fallback → devuelve la cadena de fallback definida por el resolver (clave literal en DEV, string vacío en PROD)
  - regla con `message: 'Hola {{translations.greeting}}, mínimo {{value}}'` y `rule.value: 4` → combina ambas interpolaciones produciendo la concatenación esperada
  - regla con `message: 'pre {{forms.someForm.someField}} post'` → produce `'pre  post'` (placeholder no soportado degrada a string vacío, texto literal alrededor preservado)
  - regla con `message: 'pre {{ }} post'` (delimitador vacío) → produce `'pre  post'` sin romper
- **Comandos durante la implementación**:
  - `pnpm test --run src/tests/runtime/runtime-form-validation-message.test.ts`
- **Restricciones**:
  - el test debe construir el `RuntimeState` mínimo necesario incluyendo `i18n.translations` y `i18n.activeLanguage` (no se permite mockear el resolver de referencias).
  - no añadir snapshots ni testing de implementación interna del resolver (cubierto en su propia suite).

### Criterios de finalización
- `formatValidationMessage` exportada desde `runtime-form-validations.ts` con la firma y semántica descritas.
- Superficie `'form.validation.message'` añadida a `RuntimeReferenceSurface`.
- Los tests del fichero nuevo pasan en local con el comando indicado.
- TypeScript del proyecto compila sin nuevos errores.
- Ningún call site existente cambia su comportamiento en esta tarea (no se cablea aún).

### Cierre de implementación
Código y tests de la tarea completos, en verde local con el comando indicado, sin regresiones de tipos.

---

## 0086.2 — Cablear el helper en el pipeline de validación de formularios

### Estado
completada

### Objetivo
Hacer que las dos rutas de validación del runtime (submit completo y reevaluación inline al editar) usen `formatValidationMessage` para producir el mensaje final por regla fallida, manteniendo intacta la lógica de cuándo se valida, qué regla gana y dónde vive el error. Tras esta tarea, los criterios de aceptación 1–9 de la spec quedan demostrables end-to-end.

Incluye:
- refactor de `getFirstVisibleValidationError` para que devuelva un resultado estructurado que identifique la regla fallida y el mensaje por defecto del runtime, sin emitir aún el string final. Firma propuesta: `(fieldDefinition, value) => { ruleName, rule, defaultMessage } | null`. Las cadenas por defecto actuales se conservan literalmente (`'Required'`, `'Must be at least N characters.'`, `'Must be at most N characters.'`, `'Must be at least N.'`, `'Must be at most N.'`, `'Select at least N options.'`, `'Select no more than N options.'`).
- en `validateFormFields`: tras obtener el resultado estructurado por campo visible, si hay fallo, llamar a `formatValidationMessage({ rule, defaultMessage, state, iterationContext })` y escribir el string resultante en `errorsByFieldId[fieldId]`. Si no hay fallo o el campo no es visible, mantener el comportamiento actual (`null` o `fieldState?.error ?? null`).
- en `getValidationErrorForEditedField`: producir el string final con `formatValidationMessage` usando `nextState` (el state proyectado tras el cambio) e `iterationContext` recibido. Devolver el string o `null` siguiendo la semántica actual.
- ninguna firma pública de las funciones llamadas desde `form-layout-node.tsx`, `input-layout-node.tsx`, `textarea-layout-node.tsx`, `select-layout-node.tsx`, `radio-group-layout-node.tsx` o `checkbox-group-layout-node.tsx` cambia: ya pasan `state` e `iterationContext` cuando aplica.
- el orden de prioridad de reglas (orden declarado en `props.validations`) no se altera.

### Fuera de alcance
- Cambiar mensajes por defecto literales (no se internacionalizan en esta feature).
- Validaciones del nodo `fileManager`.
- Soportar referencias dinámicas distintas de `{{value}}` y `{{translations.*}}` (cualquier otro placeholder cae al comportamiento de degradación a vacío del resolver).
- Refactorizar la representación visual del error en los nodos de formulario.
- Modificar el zod schema, la normalización de validaciones en `validate-form-nodes.ts` o el contrato TypeScript de `RuntimeFormFieldValidations`.

### Dependencias
- 0086.1 debe estar cerrada y en verde.

### Impacto esperado en archivos
- Código:
  - `src/runtime/runtime-form-validations.ts` — refactor de `getFirstVisibleValidationError` para devolver estructura `{ ruleName, rule, defaultMessage }`; ajuste de `validateFormFields` y `getValidationErrorForEditedField` para invocar `formatValidationMessage`.
- Tests:
  - `src/tests/runtime/runtime-form-validations.test.ts` (ampliación) — cobertura de la rama de submit con `message` declarado y sin declarar.
  - `src/tests/runtime-state/runtime-state-validations-rules.test.tsx` (ampliación) — cobertura de la reevaluación inline con `message` declarado.
- Documentación:
  - `ai-workflow/docs/app-features/forms/validation-rules.md` — se verá afectada porque la sección "Qué no hace todavía" deja de listar el bullet sobre `message` y porque hay que documentar la semántica de interpolación efectiva. La actualización no se hace en esta tarea: se difiere a la pasada `update-app-documentation` cuando el usuario la invoque.

### Tests
- **Ficheros de test**:
  - `src/tests/runtime/runtime-form-validations.test.ts` (ampliación)
  - `src/tests/runtime-state/runtime-state-validations-rules.test.tsx` (ampliación)
- **Comportamiento cubierto**:
  - en submit, campo `input` con `validations.required: { value: true, message: 'Este campo es obligatorio' }` y valor vacío → `errorsByFieldId[fieldId]` es `'Este campo es obligatorio'`
  - en submit, campo `input` con `validations.minLength: { value: 3, message: 'Mínimo {{value}} caracteres' }` y valor `'ab'` → `'Mínimo 3 caracteres'`
  - en submit, campo `input` con `validations.required: { value: true, message: '{{value}} es requerido' }` y valor vacío → `' es requerido'`
  - en submit, campo `input` con `validations.maxLength: { value: 100, message: '{{translations.max_length_error}}' }` y catálogo con esa clave → el string traducido del catálogo activo
  - en submit, campo `input` con `validations.min: { value: 5, message: 'Mínimo {{value}}' }` y `inputType: 'number'` con valor `'2'` → `'Mínimo 5'`
  - en submit, campo `select.multiple` con `validations.minSelections: { value: 2, message: 'Selecciona al menos {{value}}' }` y valor `[]` → `'Selecciona al menos 2'`
  - en submit, campo sin `message` declarado → el mensaje por defecto del runtime no cambia (`'Required'`, `'Must be at least 3 characters.'`, etc.)
  - en submit, regla con `message: ''` declarado y valor inválido → `errorsByFieldId[fieldId]` es `''` (cadena vacía, no `null` y no el mensaje por defecto)
  - en submit, campo oculto por `visibility` con `message` declarado → el error vive intacto (no se sobreescribe ni se intenta formatear) — el campo oculto sigue conservando `fieldState?.error ?? null`
  - en reevaluación inline tras editar, campo con `validations.minLength: { value: 3, message: 'Mínimo {{value}} caracteres' }` previamente en error y nuevo valor aún inválido (`'a'`) → `getValidationErrorForEditedField` devuelve `'Mínimo 3 caracteres'`
  - en reevaluación inline tras editar, mismo campo con nuevo valor válido (`'abc'`) → `getValidationErrorForEditedField` devuelve `null`
  - en reevaluación inline, campo con `validations.required: { value: true, message: '{{translations.field_required}}' }` y catálogo con esa clave → el string traducido del catálogo activo
- **Comandos durante la implementación**:
  - `pnpm test --run src/tests/runtime/runtime-form-validations.test.ts`
  - `pnpm test --run src/tests/runtime-state/runtime-state-validations-rules.test.tsx`
- **Restricciones**:
  - reusar el harness y los fixtures ya existentes en cada fichero (`baseState` y similares en runtime; `VisibilityRuleQueryFixture`/`RuntimeStateSnapshot` en runtime-state).
  - los nuevos casos deben extender el `baseState` para incluir `i18n.translations` y `i18n.activeLanguage` cuando se prueben `{{translations.*}}`. No mockear el resolver de referencias.
  - no añadir snapshots de árbol completo; verificar el string concreto del error.
  - no introducir helpers nuevos transversales entre carpetas distintas.

### Criterios de finalización
- `validateFormFields` produce el mensaje personalizado en submit cuando `message` está declarado y mantiene el mensaje por defecto cuando no.
- `getValidationErrorForEditedField` produce el mensaje personalizado en la reevaluación inline cuando `message` está declarado y mantiene el mensaje por defecto cuando no.
- Los criterios de aceptación 1–9 de la spec quedan demostrados por los tests ampliados.
- Los tests existentes no regresan; los nuevos pasan con los comandos indicados.
- `pnpm test` global sigue en verde y la cobertura sigue por encima del 80% según `testing-rules.md`.
- TypeScript del proyecto compila sin nuevos errores.

### Cierre de implementación
Código y tests de la tarea completos, en verde local con los comandos indicados; la pasada global `pnpm test` también en verde sin caída de cobertura.

---

## Siguiente tarea a tomar
0086.1.
