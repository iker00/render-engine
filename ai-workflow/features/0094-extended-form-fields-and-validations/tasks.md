# Feature 0094 — Extended form fields and validations — Plan de implementación

## Resumen

8 tareas secuenciales. El orden prioriza la infraestructura de validación (T1–T4) antes que los nodos nuevos (T5–T8), para que cada nodo disponga del sistema completo al implementarse.

| ID | Título | Estado |
|----|--------|--------|
| T1 | Config: reglas pattern, email, url | completada |
| T2 | Config: condición `when` en reglas | completada |
| T3 | Runtime: evaluación pattern, email, url | completada |
| T4 | Runtime: evaluación `when` | completada |
| T5 | Toggle: validación de config | completada |
| T6 | Toggle: componente runtime | completada |
| T7 | Hidden: validación de config | completada |
| T8 | Hidden: componente runtime | completada |

---

## T1 — Config: reglas de validación pattern, email, url

### Estado
completada

### Objetivo
Extender el sistema de validación de config para aceptar tres reglas nuevas (`pattern`, `email`, `url`) con sus shapes y restricciones de compatibilidad por tipo de campo.

### Fuera de alcance
- Evaluación runtime de las reglas (T3).
- Soporte de `when` en las reglas (T2).
- Cambios en nodos existentes o nodos nuevos.

### Dependencias
Ninguna. Primera tarea del plan.

### Impacto esperado en archivos
**Código:**
- `src/config/validate-form-nodes.ts` — añadir `pattern`, `email`, `url` a `supportedFormValidationRuleNames`; crear funciones de validación `validatePatternRule` (acepta string o `{ value: string, message?: string }`, comprueba que el valor compila como `RegExp`, rechaza string vacío) y `validateBooleanFlagRule` (acepta `true` o `{ value: true, message?: string }`, reutilizable para email y url); ampliar `validateValidationCompatibility` para que `pattern`, `email`, `url` solo sean válidos en campos textuales (`input` con `inputType` text, email, password, search, tel, url; y `textarea`) y se rechacen en `input` con `inputType` number, date, datetime-local, time y en `select`, `radioGroup`, `checkboxGroup`.
- `src/config/runtime-config-types.ts` — añadir tipos `RuntimePatternValidationRule` (`{ value: string; message?: string }`), `RuntimeBooleanFlagValidationRule` (`{ value: true; message?: string }`); ampliar `RuntimeFormFieldValidations` con campos opcionales `pattern?: string | RuntimePatternValidationRule`, `email?: true | RuntimeBooleanFlagValidationRule`, `url?: true | RuntimeBooleanFlagValidationRule`; ampliar `RuntimeFormValidationRuleName` con los tres nombres nuevos.

**Tests:**
- `src/tests/config-validation/runtime-config-validation-forms-validations.test.ts` (ampliación)

**Documentación afectada:**
- `ai-workflow/docs/app-features/forms/validation-rules.md`
- `ai-workflow/docs/app-features/config/validation.md`

### Tests

#### Ficheros de test
- `src/tests/config-validation/runtime-config-validation-forms-validations.test.ts` (ampliación)

#### Comportamiento cubierto
- `pattern` acepta forma corta (string puro) en input textual.
- `pattern` acepta forma extendida `{ value: string, message?: string }` en input textual.
- `pattern` acepta en `textarea`.
- `pattern` con regex inválido (no compila como `RegExp`) rechaza el config con ruta exacta.
- `pattern` con string vacío (`""`) rechaza el config.
- `pattern` rechazado en `input` con `inputType` `number`.
- `pattern` rechazado en `input` con `inputType` `date`.
- `pattern` rechazado en `input` con `inputType` `datetime-local`.
- `pattern` rechazado en `input` con `inputType` `time`.
- `pattern` rechazado en `select`, `radioGroup`, `checkboxGroup`.
- `email` acepta `true` como forma corta en input textual.
- `email` acepta `{ value: true, message?: string }` como forma extendida.
- `email` aceptado en `textarea`.
- `email` rechazado en `input` con `inputType` `number`, `date`, `datetime-local`, `time`.
- `email` rechazado en `select`, `radioGroup`, `checkboxGroup`.
- `url` acepta `true` como forma corta en input textual.
- `url` acepta `{ value: true, message?: string }` como forma extendida.
- `url` aceptado en `textarea`.
- `url` rechazado en `input` con `inputType` `number`, `date`, `datetime-local`, `time`.
- `url` rechazado en `select`, `radioGroup`, `checkboxGroup`.
- Las reglas existentes (`required`, `minLength`, `maxLength`, `min`, `max`, `minSelections`, `maxSelections`) siguen validando sin cambios (retrocompatibilidad).

#### Comandos durante la implementación
```
pnpm test --run src/tests/config-validation/runtime-config-validation-forms-validations.test.ts
```

#### Restricciones
- Reusar el patrón existente de `validateRequiredRule` / `validateNumericRule` para la estructura de las nuevas funciones de validación.

### Criterios de finalización
- **Cierre de implementación**: los tres shapes nuevos se aceptan y rechazan correctamente en todos los tipos de campo; la suite completa `pnpm test` pasa en verde con cobertura ≥ 80%.

---

## T2 — Config: condición `when` en reglas de validación

### Estado
completada

### Objetivo
Permitir que cualquier regla de validación en su forma extendida (objeto con `value`) declare opcionalmente un campo `when` con el shape idéntico al de `visibility`, validando su estructura antes del render.

### Fuera de alcance
- Evaluación runtime de `when` (T4).
- Cambios en las formas cortas de las reglas (siguen sin `when`).
- Composición booleana de condiciones en `when`.

### Dependencias
T1 — las funciones de validación de las reglas nuevas deben existir para que T2 pueda extender su shape con `when`.

### Impacto esperado en archivos
**Código:**
- `src/config/validate-form-nodes.ts` — en cada función de validación de regla (existentes: `validateRequiredRule`, `validateNumericRule`; nuevas de T1: `validatePatternRule`, `validateBooleanFlagRule`), cuando la regla está en forma extendida (objeto con `value`), comprobar si incluye `when`; si existe, validar su shape reutilizando la misma función de validación de condiciones ya usada para `visibility` (validar reference, operator, value según las mismas reglas que `visibility`).
- `src/config/runtime-config-types.ts` — añadir `when?: RuntimeWhenCondition` a `RuntimeRequiredValidationRule`, `RuntimeNumericValidationRule`, `RuntimePatternValidationRule`, `RuntimeBooleanFlagValidationRule`.

**Tests:**
- `src/tests/config-validation/runtime-config-validation-forms-validations.test.ts` (ampliación)

**Documentación afectada:**
- `ai-workflow/docs/app-features/forms/validation-rules.md`

### Tests

#### Ficheros de test
- `src/tests/config-validation/runtime-config-validation-forms-validations.test.ts` (ampliación)

#### Comportamiento cubierto
- `required: { value: true, when: { reference: "forms.f.x", operator: "equals", value: "a" } }` aceptado.
- `minLength: { value: 5, when: { reference: "forms.f.x", operator: "isTruthy" } }` aceptado.
- `pattern: { value: "^\\d+$", when: { reference: "queries.q.data.flag", operator: "isFalsy" } }` aceptado.
- `email: { value: true, when: { reference: "params.mode", operator: "equals", value: "strict" } }` aceptado.
- `url: { value: true, when: { reference: "forms.f.x", operator: "notEquals", value: "none" } }` aceptado.
- `max: { value: 100, when: { reference: "forms.f.x", operator: "greaterThan", value: 0 } }` aceptado.
- `when.reference` fuera del alcance soportado rechaza el config con ruta exacta.
- `when.operator` fuera del catálogo rechaza el config.
- `when` con `isTruthy` y `value` declarado rechaza el config.
- `when` con `isFalsy` y `value` declarado rechaza el config.
- `when` con `equals` sin `value` rechaza el config.
- `when` con `notEquals` sin `value` rechaza el config.
- `when` con `greaterThan` y `value` no numérico rechaza el config.
- `when` con `lessThan` y `value` no numérico rechaza el config.
- `when` con `equals` y `value` no escalar (ej. array u objeto) rechaza el config.
- Formas cortas (`required: true`, `minLength: 5`, `pattern: "..."`, `email: true`, `url: true`) siguen funcionando sin `when`.
- Una regla en forma extendida sin `when` sigue validando exactamente igual (retrocompatibilidad).

#### Comandos durante la implementación
```
pnpm test --run src/tests/config-validation/runtime-config-validation-forms-validations.test.ts
```

#### Restricciones
- Reutilizar la validación de shape de condición ya existente en `src/config/` (la misma función que valida `visibility`). No reimplementar la lógica.

### Criterios de finalización
- **Cierre de implementación**: `when` se acepta en la forma extendida de todas las reglas (existentes y nuevas); los shapes inválidos de `when` se rechazan con ruta exacta; retrocompatibilidad confirmada; `pnpm test` verde con cobertura ≥ 80%.

---

## T3 — Runtime: evaluación de pattern, email, url

### Estado
completada

### Objetivo
Evaluar las tres reglas nuevas (`pattern`, `email`, `url`) en la pasada de validación al submit y en la reevaluación local al editar un campo con error.

### Fuera de alcance
- Validación de shape en config (T1).
- Evaluación de `when` (T4).

### Dependencias
T1 — los tipos normalizados de las reglas deben existir para que la evaluación runtime los consuma.

### Impacto esperado en archivos
**Código:**
- `src/runtime/runtime-form-validations.ts` — añadir ramas para `pattern`, `email`, `url` en `getFirstVisibleValidationError`; definir funciones auxiliares `passesPatternValidation` (aplica `new RegExp(pattern).test(value)`, skip si vacío), `passesEmailValidation` (valida presencia de `@`, carácter antes y después, dominio con punto; skip si vacío), `passesUrlValidation` (intenta `new URL(value)` y verifica protocolo `http` o `https`; skip si vacío); añadir mensajes por defecto: `"Invalid format."`, `"Invalid email address."`, `"Invalid URL."`.

**Tests:**
- `src/tests/runtime/runtime-form-validations.test.ts` (ampliación)
- `src/tests/runtime-state/runtime-state-validations-rules.test.tsx` (ampliación)

**Documentación afectada:**
- `ai-workflow/docs/app-features/forms/validation-rules.md`

### Tests

#### Ficheros de test
- `src/tests/runtime/runtime-form-validations.test.ts` (ampliación)
- `src/tests/runtime-state/runtime-state-validations-rules.test.tsx` (ampliación)

#### Comportamiento cubierto

**En `runtime-form-validations.test.ts` (unit):**
- `pattern` con regex válido y valor que hace match → sin error.
- `pattern` con regex válido y valor que no hace match → error `"Invalid format."`.
- `pattern` con campo vacío (`""`) → sin error.
- `pattern` con mensaje personalizado → muestra el mensaje personalizado.
- `pattern` sin anclaje automático: `"\\d+"` acepta `"abc123def"` (match parcial).
- `email` con dirección válida (`"user@example.com"`) → sin error.
- `email` con dirección inválida (`"noarroba"`) → error `"Invalid email address."`.
- `email` rechaza dirección sin punto en dominio (`"user@example"`).
- `email` con campo vacío → sin error.
- `email` con mensaje personalizado → muestra el mensaje.
- `url` con URL http válida (`"http://example.com"`) → sin error.
- `url` con URL https válida (`"https://example.com"`) → sin error.
- `url` con URL ftp (`"ftp://files.com"`) → error `"Invalid URL."`.
- `url` con string no parseable como URL (`"not-a-url"`) → error.
- `url` con campo vacío → sin error.
- `url` con mensaje personalizado → muestra el mensaje.

**En `runtime-state-validations-rules.test.tsx` (integración):**
- Submit de form con campo input con `pattern` inválido → error visible, submit bloqueado.
- Submit de form con campo input con `email` inválido → error visible, submit bloqueado.
- Submit de form con campo input con `url` inválido → error visible, submit bloqueado.
- Edición de campo con error `pattern` que ahora coincide → error se limpia.
- Edición de campo con error `email` que ahora es válido → error se limpia.
- Edición de campo con error `url` que ahora es válido → error se limpia.
- Orden de reglas respetado: si `required` viene antes de `pattern`, campo vacío muestra `"Required"` (no `"Invalid format."`).

#### Comandos durante la implementación
```
pnpm test --run src/tests/runtime/runtime-form-validations.test.ts
pnpm test --run src/tests/runtime-state/runtime-state-validations-rules.test.tsx
```

#### Restricciones
Ninguna específica de esta tarea.

### Criterios de finalización
- **Cierre de implementación**: las tres reglas se evalúan correctamente en submit y reevaluación; mensajes por defecto y personalizados funcionan; campos vacíos no fallan; `pnpm test` verde con cobertura ≥ 80%.

---

## T4 — Runtime: evaluación de condición `when` en validación

### Estado
completada

### Objetivo
Antes de evaluar cualquier regla de validación (existentes y nuevas), comprobar si tiene un campo `when` y omitir la regla si la condición no se cumple, reutilizando `matchesVisibilityRule`.

### Fuera de alcance
- Validación de shape de `when` en config (T2).
- Composición booleana de condiciones.
- Validación cruzada entre campos.

### Dependencias
T2 — los tipos con `when` deben existir. T3 — las reglas nuevas deben poder evaluarse para que `when` también las cubra.

### Impacto esperado en archivos
**Código:**
- `src/runtime/runtime-form-validations.ts` — modificar `getFirstVisibleValidationError` para recibir el snapshot de estado runtime (`RuntimeState`) y el `iterationContext` opcional (nota: `validateFormFields` y `getValidationErrorForEditedField` ya reciben estos parámetros — el cambio se concentra en propagarlos al callsite interno de `getFirstVisibleValidationError`); antes de evaluar cada regla, comprobar si tiene `when`: si la regla está en forma normalizada (objeto con `value`) y tiene `when`, llamar a `matchesVisibilityRule(rule.when, stateSnapshot, iterationContext)`; si devuelve `false`, omitir la regla; si devuelve `true` o no tiene `when`, evaluar normalmente.

**Tests:**
- `src/tests/runtime-state/runtime-state-validations-when.test.tsx` (nuevo)

**Documentación afectada:**
- `ai-workflow/docs/app-features/forms/validation-rules.md`

### Tests

#### Ficheros de test
- `src/tests/runtime-state/runtime-state-validations-when.test.tsx` (nuevo)

#### Comportamiento cubierto
- Campo con `required: { value: true, when: { reference: "forms.f.toggle", operator: "equals", value: "yes" } }`: cuando `f.toggle` vale `"yes"`, el campo vacío falla `required`; cuando vale otra cosa, el campo vacío pasa.
- Campo con `minLength: { value: 5, when: { reference: "forms.f.check", operator: "isTruthy" } }`: cuando `f.check` es truthy, se aplica minLength; cuando es falsy, se omite.
- Campo con `pattern: { value: "^\\d+$", when: { reference: "forms.f.mode", operator: "equals", value: "strict" } }`: cuando `f.mode` es `"strict"`, se aplica pattern; cuando no, se omite.
- Campo con varias reglas, todas con `when` cuya condición no se cumple: el campo pasa validación como si no tuviera reglas.
- Campo con una regla sin `when` y otra con `when`: la regla sin `when` se evalúa siempre; la otra depende de la condición.
- Regla sin `when`: se evalúa siempre (retrocompatibilidad).
- Reevaluación local al editar: si la condición `when` de un campo cambia (porque el campo referenciado se editó), la reevaluación del campo con error respeta la nueva condición.
- `when` con referencia a `queries.*`: la condición se evalúa contra el estado actual de la query.
- `when` con referencia ausente (campo no inicializado): sigue la semántica de `visibility` (`isFalsy` → true; `isTruthy` → false; otros → no match).

#### Comandos durante la implementación
```
pnpm test --run src/tests/runtime-state/runtime-state-validations-when.test.tsx
```

#### Restricciones
- Reutilizar `matchesVisibilityRule` de `runtime-layout-visibility.ts`. No reimplementar la evaluación de condiciones.

### Criterios de finalización
- **Cierre de implementación**: `when` omite la regla cuando la condición no se cumple; evalúa cuando se cumple; funciona con todas las reglas (existentes y nuevas); reevaluación local respeta `when`; `pnpm test` verde con cobertura ≥ 80%.

---

## T5 — Toggle: validación de config

### Estado
completada

### Objetivo
Añadir el nodo `toggle` al catálogo de nodos soportados: schema Zod, tipo TypeScript, validación de shape, restricción form-only, allowlist de `form.children` y compatibilidad de reglas de validación.

### Fuera de alcance
- Componente React del toggle (T6).
- Evaluación runtime de validación (cubierta por T1–T4).

### Dependencias
T1 — la validación de compatibilidad de reglas debe incluir toggle al verificar que `pattern`, `email`, `url` no aplican.

### Impacto esperado en archivos
**Código:**
- `src/config/runtime-config-zod.ts` — añadir `'toggle'` a `supportedNodeTypes`; definir `toggleNodeSchema` con props: `fieldId` (nonEmptyStringSchema), `label` (string), `labelPosition` (enum `top | inline` opcional), `defaultValue` (boolean o string referencia, opcional), `validations` (`formFieldValidationsSchema` opcional).
- `src/config/runtime-config-types.ts` — añadir `'toggle'` a `LayoutNodeType`; definir `ToggleLayoutNode` interface con `type: 'toggle'`, `props` tipado, transversales opcionales (`visibility`, `queryStateFeedback`, `layout`); añadir a la unión `LayoutNode`.
- `src/config/validate-form-nodes.ts` — implementar `validateToggleNode` (parsea con `toggleNodeSchema`, valida `labelPosition` si existe, valida `defaultValue` literal boolean o referencia dinámica, rechaza `defaultValue` literal no boolean y no string, invoca `validateFormFieldValidations`, valida feedback/visibility transversales); añadir `'toggle'` al check form-only en `validateFormNodesInCollection`; añadir `'toggle'` al allowlist de `validateFormChildren`; añadir `'toggle'` al bloque de tracking de `fieldId` duplicado dentro de `validateFormChildren`; ampliar `validateValidationCompatibility` para que toggle solo acepte `required` (rechazar `minLength`, `maxLength`, `min`, `max`, `minSelections`, `maxSelections`, `pattern`, `email`, `url`).
- `src/config/validate-layout-nodes.ts` — añadir case `'toggle'` en `validateLayoutNode` que delegue a `validateToggleNode` de `validate-form-nodes.ts`.
- `src/config/runtime-config-root-zod.ts` — añadir `toggleNodeSchema` a la unión `layoutNodeSchema`.

**Tests:**
- `src/tests/config-validation/runtime-config-validation-toggle.test.ts` (nuevo)
- `src/tests/config-validation/runtime-config-validation-forms-semantics.test.ts` (ampliación)

**Documentación afectada:**
- `ai-workflow/docs/app-features/nodes/toggle.md` (nueva ficha)
- `ai-workflow/docs/app-features/nodes/index.md`
- `ai-workflow/docs/app-features/forms/index.md`

### Tests

#### Ficheros de test
- `src/tests/config-validation/runtime-config-validation-toggle.test.ts` (nuevo)
- `src/tests/config-validation/runtime-config-validation-forms-semantics.test.ts` (ampliación)

#### Comportamiento cubierto

**En `runtime-config-validation-toggle.test.ts`:**
- Toggle con props mínimos (`fieldId`, `label`) dentro de form aceptado.
- Toggle con `labelPosition: "top"` aceptado.
- Toggle con `labelPosition: "inline"` aceptado.
- Toggle sin `labelPosition` aceptado (default `top`).
- Toggle con `labelPosition` inválido (p. ej. `"bottom"`) rechaza el config con ruta exacta.
- Toggle con `defaultValue: true` aceptado.
- Toggle con `defaultValue: false` aceptado.
- Toggle sin `defaultValue` aceptado (default `false` implícito).
- Toggle con `defaultValue` string literal rechaza el config (un string se interpreta como referencia dinámica solo si el validador lo acepta como tal; un literal string no boolean como `"yes"` se rechaza).
- Toggle con `defaultValue` number rechaza el config.
- Toggle con `defaultValue` referencia dinámica completa (`"queries.q.data.active"`) aceptado.
- Toggle con `validations.required: true` aceptado.
- Toggle con `validations.required: { value: true, message: "..." }` aceptado.
- Toggle con `validations.required: { value: true, when: {...} }` aceptado.
- Toggle con `validations.minLength` rechaza el config.
- Toggle con `validations.maxLength` rechaza el config.
- Toggle con `validations.min` rechaza el config.
- Toggle con `validations.max` rechaza el config.
- Toggle con `validations.minSelections` rechaza el config.
- Toggle con `validations.maxSelections` rechaza el config.
- Toggle con `validations.pattern` rechaza el config.
- Toggle con `validations.email` rechaza el config.
- Toggle con `validations.url` rechaza el config.
- Toggle fuera de form rechaza el config.
- Toggle con `visibility` aceptado (transversal estándar).
- Toggle con `queryStateFeedback` aceptado (transversal estándar).
- Toggle con `layout.span` aceptado (transversal estándar).
- Toggle dentro de `repeater.props.template` dentro de form aceptado.
- Toggle con `fieldId` duplicado dentro del mismo form rechaza el config.

**En `runtime-config-validation-forms-semantics.test.ts`:**
- Toggle admitido en la lista de hijos permitidos de form.
- Toggle fuera de form rechazado por el check form-only.

#### Comandos durante la implementación
```
pnpm test --run src/tests/config-validation/runtime-config-validation-toggle.test.ts
pnpm test --run src/tests/config-validation/runtime-config-validation-forms-semantics.test.ts
```

#### Restricciones
Ninguna específica de esta tarea.

### Criterios de finalización
- **Cierre de implementación**: toggle validado correctamente en config con todas las restricciones de shape, form-only, children allowlist y compatibilidad de reglas; `pnpm test` verde con cobertura ≥ 80%.

---

## T6 — Toggle: componente runtime e integración con formulario

### Estado
completada

### Objetivo
Implementar el componente React del toggle, registrarlo en el mapa de nodos, integrarlo con el form store y manejar la semántica especial de `required` (el valor debe ser `true` para pasar).

### Fuera de alcance
- Validación de config del toggle (T5).
- Variantes visuales más allá de `labelPosition`.
- `disabled` o `readOnly`.

### Dependencias
T5 — el schema y tipos del toggle deben existir. T3 — la función de validación runtime debe existir para que `required` del toggle funcione correctamente. T4 — la evaluación de `when` debe funcionar para que `required: { value: true, when: {...} }` en un toggle se evalúe correctamente.

### Impacto esperado en archivos
**Código:**
- `src/runtime/nodes/toggle-layout-node.tsx` (nuevo) — componente React: renderiza `<button type="button" role="switch" aria-checked={value}>` con label posicionado según `labelPosition` (`top`: label encima en bloque; `inline`: label a la derecha en flex row); lee valor de `forms.{formId}.{fieldId}.value` (boolean) vía `selectFormFieldState`; escribe vía dispatch `setFormFieldValue` al hacer click; cuando hay error activo, incluye `aria-describedby="${formId}-${fieldId}-error"` apuntando al span de error; estilo con clases Tailwind.
- `src/runtime/nodes/node-components-map.ts` — añadir `toggle: ToggleNode` a `eagerMap` (import estático) y `toggle: React.lazy(...)` a `lazyMap`.
- `src/runtime/layout-node-renderer.tsx` — añadir case `'toggle'` en el switch que pase `node` y `iterationContext` al componente.
- `src/runtime/nodes/form-layout-node.tsx` — añadir `'toggle'` a `collectResolvedFormFieldDefinitions` (reconocer toggle como campo de formulario, construir `ResolvedFormFieldDefinition` con type `'toggle'`, defaultValue `false` cuando no declarado); añadir `'toggle'` a `collectAllFormFieldIds`; en `resolveResolvedFormFieldDefinition`, construir la definición resuelta para toggle (fieldId, label, validations normalizadas, defaultValue resuelto).
- `src/runtime/runtime-form-validations.ts` — ampliar `passesRequiredValidation` (o la rama `required` en `getFirstVisibleValidationError`) para que cuando el tipo de campo sea `'toggle'`, `required` exija `value === true`; un toggle con valor `false` falla `required`.

**Tests:**
- `src/tests/layout-renderer/layout-renderer-toggle.test.tsx` (nuevo)

**Documentación afectada:**
- `ai-workflow/docs/app-features/nodes/toggle.md`
- `ai-workflow/docs/app-features/forms/lifecycle.md`

### Tests

#### Ficheros de test
- `src/tests/layout-renderer/layout-renderer-toggle.test.tsx` (nuevo)

#### Comportamiento cubierto
- Toggle renderiza un `<button>` con `role="switch"`.
- Toggle sin `defaultValue` muestra `aria-checked="false"`.
- Toggle con `defaultValue: true` muestra `aria-checked="true"`.
- Toggle con `labelPosition: "top"` (o sin labelPosition) renderiza el label encima del control.
- Toggle con `labelPosition: "inline"` renderiza el label a la derecha del control en la misma línea.
- Click en toggle cambia `aria-checked` de `"false"` a `"true"` y viceversa.
- Click en toggle actualiza `forms.{formId}.{fieldId}.value` en el store como boolean.
- Submit con toggle `required: true` y valor `false` → error visible, submit bloqueado.
- Submit con toggle `required: true` y valor `true` → sin error, submit ejecutado.
- Toggle con error muestra `aria-describedby` apuntando al span de error con id `{formId}-{fieldId}-error`.
- Toggle sin error no tiene atributo `aria-describedby`.
- Toggle oculto por `visibility` no bloquea el submit.
- Toggle con `defaultValue` referencia dinámica resuelve el valor al inicializarse.
- Toggle dentro de repeater dentro de form renderiza instancias independientes por iteración.
- Toggle dentro de repeater con `defaultValue` `item.*` resuelve contra la iteración actual.
- Valor del toggle se incluye como boolean en el payload del submit.
- Reevaluación: toggle con error `required` → click para activar → error se limpia.
- Toggle con `layout.span` aplica el span de grid correctamente.
- Toggle con `queryStateFeedback` muestra fallback cuando corresponde.

#### Comandos durante la implementación
```
pnpm test --run src/tests/layout-renderer/layout-renderer-toggle.test.tsx
```

#### Restricciones
- Reusar los patrones de test de `layout-renderer-forms-fields.test.tsx` como referencia para la estructura del render fixture y las aserciones.
- Reusar los helpers de `src/tests/runtime-state/helpers.tsx` (`FormRuntimeFixture` o equivalente) si aplican al patrón de layout-renderer.

### Criterios de finalización
- **Cierre de implementación**: toggle renderiza, interactúa, valida (`required` exige `true`), envía como boolean y soporta transversales; `pnpm test` verde con cobertura ≥ 80%.

---

## T7 — Hidden: validación de config

### Estado
completada

### Objetivo
Añadir el nodo `hidden` al catálogo de nodos soportados: schema Zod, tipo TypeScript, validación de shape, rechazo explícito de props y transversales prohibidos, restricción form-only y allowlist de `form.children`.

### Fuera de alcance
- Componente React de hidden (T8).
- Inicialización en el form store (T8).

### Dependencias
Ninguna estricta, pero se ubica después de T5 para mantener orden secuencial de nodos.

### Impacto esperado en archivos
**Código:**
- `src/config/runtime-config-zod.ts` — añadir `'hidden'` a `supportedNodeTypes`; definir `hiddenNodeSchema` con props: `fieldId` (nonEmptyStringSchema), `value` (`z.union([z.string(), z.number(), z.boolean()])`); no incluir `layout`, `visibility` ni `queryStateFeedback` en el schema del nodo (los descarta `.strip()`).
- `src/config/runtime-config-types.ts` — añadir `'hidden'` a `LayoutNodeType`; definir `HiddenLayoutNode` interface con `type: 'hidden'`, `props: { fieldId: string; value: string | number | boolean }`, sin `visibility`, `queryStateFeedback` ni `layout`; añadir a la unión `LayoutNode`.
- `src/config/validate-form-nodes.ts` — implementar `validateHiddenNode` que: parsee con `hiddenNodeSchema`; rechace explícitamente si el nodo raw declara `visibility` o `queryStateFeedback` (error con ruta exacta); rechace explícitamente si `props` raw declara `label`, `validations`, `defaultValue`, `placeholder`, `icon` o `iconPosition` (error con ruta exacta); añadir `'hidden'` al check form-only en `validateFormNodesInCollection`; añadir `'hidden'` al allowlist de `validateFormChildren`; añadir `'hidden'` al bloque de tracking de `fieldId` duplicado dentro de `validateFormChildren`.
- `src/config/validate-layout-nodes.ts` — añadir case `'hidden'` en `validateLayoutNode` que delegue a `validateHiddenNode` de `validate-form-nodes.ts`.
- `src/config/runtime-config-root-zod.ts` — añadir `hiddenNodeSchema` a la unión `layoutNodeSchema`.

**Tests:**
- `src/tests/config-validation/runtime-config-validation-hidden.test.ts` (nuevo)
- `src/tests/config-validation/runtime-config-validation-forms-semantics.test.ts` (ampliación)

**Documentación afectada:**
- `ai-workflow/docs/app-features/nodes/hidden.md` (nueva ficha)
- `ai-workflow/docs/app-features/nodes/index.md`
- `ai-workflow/docs/app-features/forms/index.md`
- `ai-workflow/docs/app-features/forms/lifecycle.md`

### Tests

#### Ficheros de test
- `src/tests/config-validation/runtime-config-validation-hidden.test.ts` (nuevo)
- `src/tests/config-validation/runtime-config-validation-forms-semantics.test.ts` (ampliación)

#### Comportamiento cubierto

**En `runtime-config-validation-hidden.test.ts`:**
- Hidden con `fieldId` y `value` string dentro de form aceptado.
- Hidden con `value` number aceptado.
- Hidden con `value` boolean aceptado.
- Hidden con `value` referencia dinámica completa (`"queries.q.data.id"`) aceptado.
- Hidden sin `value` rechaza el config con ruta exacta.
- Hidden con `label` en props rechaza el config con ruta exacta.
- Hidden con `validations` en props rechaza el config con ruta exacta.
- Hidden con `defaultValue` en props rechaza el config con ruta exacta.
- Hidden con `placeholder` en props rechaza el config con ruta exacta.
- Hidden con `icon` en props rechaza el config con ruta exacta.
- Hidden con `iconPosition` en props rechaza el config con ruta exacta.
- Hidden con `visibility` en el nodo rechaza el config con ruta exacta.
- Hidden con `queryStateFeedback` en el nodo rechaza el config con ruta exacta.
- Hidden fuera de form rechaza el config.
- Hidden dentro de `repeater.props.template` dentro de form aceptado.
- Hidden con `fieldId` duplicado dentro del mismo form rechaza el config.
- Hidden con `layout.span` en el nodo: descartado silenciosamente por `.strip()` (no rechaza, no llega al resultado normalizado).

**En `runtime-config-validation-forms-semantics.test.ts`:**
- Hidden admitido en la lista de hijos permitidos de form.
- Hidden fuera de form rechazado por el check form-only.

#### Comandos durante la implementación
```
pnpm test --run src/tests/config-validation/runtime-config-validation-hidden.test.ts
pnpm test --run src/tests/config-validation/runtime-config-validation-forms-semantics.test.ts
```

#### Restricciones
Ninguna específica de esta tarea.

### Criterios de finalización
- **Cierre de implementación**: hidden validado correctamente en config con todas las restricciones de shape, props prohibidos rechazados, transversales rechazados, form-only y children allowlist; `pnpm test` verde con cobertura ≥ 80%.

---

## T8 — Hidden: componente runtime e integración con formulario

### Estado
completada

### Objetivo
Implementar el componente React del hidden (sin render DOM), registrarlo en el mapa de nodos, integrarlo con el form store con inicialización no lazy al montar el form, y asegurar que su valor siempre se incluya en el payload del submit independientemente de la visibilidad de nodos padres.

### Fuera de alcance
- Validación de config del hidden (T7).
- Validación runtime de hidden (no participa por diseño).
- Soporte de `visibility`, `queryStateFeedback` o `layout.span`.

### Dependencias
T7 — el schema y tipos del hidden deben existir.

### Impacto esperado en archivos
**Código:**
- `src/runtime/nodes/hidden-layout-node.tsx` (nuevo) — componente React que no produce ningún elemento DOM (`return null`); obtiene `formContext` vía `useOptionalFormContext()`; resuelve `props.value` (literal o referencia dinámica) usando la misma utilidad de resolución que `defaultValue` de otros campos; inicializa `forms.{formId}.{fieldId}.value` con el valor resuelto al montarse.
- `src/runtime/nodes/node-components-map.ts` — añadir `hidden: HiddenNode` a `eagerMap` (import estático) y `hidden: React.lazy(...)` a `lazyMap`.
- `src/runtime/layout-node-renderer.tsx` — añadir case `'hidden'` en el switch que pase `node` y `iterationContext` al componente.
- `src/runtime/nodes/form-layout-node.tsx` — cambios clave:
  1. Añadir `'hidden'` a `collectAllFormFieldIds` para que los fieldIds de hidden se recojan.
  2. Crear una función (o ampliar la existente) que recorra el subárbol del form **ignorando la visibilidad de nodos padres** y recoja los campos hidden con su valor resuelto. Esto es necesario porque hidden se inicializa al montar el form independientemente de que un container padre tenga `visibility` que evalúe como oculto.
  3. En el flujo de inicialización del form (`initializeForm`), incluir los campos hidden recogidos en el paso anterior para que se inicialicen junto con los campos visibles.
  4. En el flujo de omisión de payload al submit (donde se excluyen del payload los campos ocultos por `visibility`), excluir los campos de tipo `'hidden'` de esa lógica: un campo hidden nunca se omite del payload, independientemente de la visibilidad de sus padres.

**Tests:**
- `src/tests/layout-renderer/layout-renderer-hidden.test.tsx` (nuevo)

**Documentación afectada:**
- `ai-workflow/docs/app-features/nodes/hidden.md`
- `ai-workflow/docs/app-features/forms/lifecycle.md`

### Tests

#### Ficheros de test
- `src/tests/layout-renderer/layout-renderer-hidden.test.tsx` (nuevo)

#### Comportamiento cubierto
- Hidden no produce ningún elemento DOM en el render (el container del form no contiene nodos visibles del hidden).
- Hidden con `value` literal string almacena el valor en `forms.{formId}.{fieldId}.value` al montar el form.
- Hidden con `value` literal number almacena el valor numérico.
- Hidden con `value` literal boolean almacena el valor booleano.
- Hidden con `value` referencia dinámica (`"queries.q.data.someField"`) resuelve el valor al inicializarse contra el estado vigente de la query.
- Hidden se inicializa al montar el form sin necesidad de interacción del usuario (no lazy).
- Hidden no bloquea el submit (no participa en validación).
- Hidden se incluye en el payload del submit cuando se referencia desde `submitAction.body`.
- Hidden dentro de repeater dentro de form resuelve `props.value` con `item.*` contra la iteración actual y mantiene valores independientes por iteración.
- Hidden dentro de un container con `visibility` oculta: el campo sigue inicializado y su valor se incluye en el payload del submit (no se omite por la lógica de omisión de campos ocultos).
- Hidden no aparece en el DOM aunque el form esté visible y renderizando otros campos.
- Hidden con `value` referencia dinámica que apunta a preload resuelve contra el estado de la query al montar el form.
- Dos campos hidden con diferentes fieldIds dentro del mismo form almacenan valores independientes.

#### Comandos durante la implementación
```
pnpm test --run src/tests/layout-renderer/layout-renderer-hidden.test.tsx
```

#### Restricciones
- La recogida de campos hidden para inicialización debe ser independiente de la visibilidad de nodos padres. Usar una función dedicada o un flag/parámetro en la función de recogida existente para caminar el subárbol completo sin evaluar `visibility`.
- Los campos hidden nunca deben ser omitidos del payload por la lógica de omisión de campos ocultos.

### Criterios de finalización
- **Cierre de implementación**: hidden no renderiza DOM; inicializa al montar; incluye valor en payload siempre (incluso dentro de padres ocultos); funciona en repeater con `item.*`; `pnpm test` verde con cobertura ≥ 80%.
