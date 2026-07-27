# Tareas — Feature 0095: Tooltip de ayuda en campos de formulario

## T1 — Contrato JSON: prop `tooltip` en esquemas Zod y tipos TypeScript

- **Estado**: completada
- **Objetivo**: Añadir `props.tooltip` como string opcional a los esquemas Zod y tipos TypeScript de los siete field nodes con label (`input`, `textarea`, `select`, `radioGroup`, `checkboxGroup`, `toggle`, `fileInput`), de forma que la validación de config acepte el campo cuando es string, lo rechace cuando no lo es, y no rompa configs existentes sin tooltip.
- **Fuera de alcance**: Renderizado del tooltip (tarea posterior). Cualquier cambio en `hidden` (no tiene label ni render visible). Cualquier validación semántica adicional más allá del tipo string.
- **Dependencias**: ninguna.

### Impacto esperado en archivos

**Código**:
- `src/config/runtime-config-zod.ts` — Añadir `tooltip: z.string().optional()` a `formFieldNodePropsSchema` (cubre input, textarea, select, radioGroup, checkboxGroup). Añadir `tooltip: z.string().optional()` al props object de `toggleNodeSchema`. Añadir `tooltip: z.string().optional()` al props object de `fileInputNodeSchema`.
- `src/config/runtime-config-types.ts` — Añadir `tooltip?: string` a `FormFieldLayoutNodeProps` (cubre InputLayoutNode, TextareaLayoutNode, SelectLayoutNode, RadioGroupLayoutNode, CheckboxGroupLayoutNode). Añadir `tooltip?: string` a `ToggleLayoutNode.props`. Añadir `tooltip?: string` a `FileInputLayoutNode.props`.
- `src/config/validate-layout-nodes.ts` — En `validateFileInputNode`, añadir el forwarding de `tooltip` al objeto `props` construido manualmente (línea ~2432). Los demás validate functions (input, textarea, select, radioGroup, checkboxGroup, toggle) usan spread de `parseResult.data.props`, por lo que tooltip pasa automáticamente sin cambio.

**Tests**:
- `src/tests/config-validation/runtime-config-validation-tooltip.test.ts` (nuevo)

**Documentación afectada**: ninguna.

### Tests

- **Ficheros de test**:
  - `src/tests/config-validation/runtime-config-validation-tooltip.test.ts` (nuevo)

- **Comportamiento cubierto**:
  - Acepta input con `props.tooltip` como string no vacío dentro de un form
  - Acepta textarea con `props.tooltip` como string no vacío dentro de un form
  - Acepta select con `props.tooltip` como string no vacío dentro de un form
  - Acepta radioGroup con `props.tooltip` como string no vacío dentro de un form
  - Acepta checkboxGroup con `props.tooltip` como string no vacío dentro de un form
  - Acepta toggle con `props.tooltip` como string no vacío dentro de un form
  - Acepta fileInput con `props.tooltip` como string no vacío dentro de un form
  - Acepta input sin `props.tooltip` sin regresión
  - Acepta toggle sin `props.tooltip` sin regresión
  - Acepta fileInput sin `props.tooltip` sin regresión
  - Rechaza input con `props.tooltip` como número
  - Rechaza input con `props.tooltip` como boolean
  - Rechaza input con `props.tooltip` como array
  - Rechaza toggle con `props.tooltip` como número
  - Rechaza fileInput con `props.tooltip` como número
  - Acepta input con `props.tooltip` como string vacío (la semántica de "no renderizar" se resuelve en render, no en validación)
  - Acepta input con `props.tooltip` que contiene referencia interpolada `{{...}}`

- **Comandos durante la implementación**:
  - `pnpm test --run src/tests/config-validation/runtime-config-validation-tooltip.test.ts`

- **Restricciones**: reusar los helpers de `src/tests/config-validation/helpers.ts` (`createConfigWithFormLayout`, `createConfigWithPages`). No duplicar helpers.

### Criterios de finalización

- **Cierre de implementación**: Los siete field nodes aceptan `props.tooltip` como string opcional en validación Zod. Los tipos TypeScript reflejan la prop. La validación rechaza valores no-string. Los tests de esta tarea pasan. `pnpm test` sigue en verde sin regresión.

---

## T2 — Componente compartido `FieldTooltip`

- **Estado**: completada
- **Objetivo**: Crear un componente React `FieldTooltip` reutilizable que renderice un icono de información (Lucide `HelpCircle`) con un tooltip flotante de texto, activado por hover y focus, accesible vía teclado, posicionado con CSS puro (Tailwind). Este componente se integrará en los siete field nodes en la tarea siguiente.
- **Fuera de alcance**: Integración del componente en los field nodes (T3). Resolución de referencias o interpolación (responsabilidad del componente que invoque a `FieldTooltip`, no del propio componente). Posicionamiento dinámico con JavaScript.
- **Dependencias**: T1 (el tipo `tooltip?: string` debe existir en los tipos para que la integración posterior sea coherente, aunque T2 no depende de ello en código).

### Impacto esperado en archivos

**Código**:
- `src/runtime/nodes/field-tooltip.tsx` (nuevo) — Componente `FieldTooltip` que recibe `text: string` como prop. Cuando `text` es vacío o no se pasa, no renderiza nada. Cuando tiene contenido: renderiza un `<span>` con `position: relative` que contiene el icono `HelpCircle` (16px, `tabindex="0"`, `aria-label="Help"`) y un `<span>` flotante con `role="tooltip"`, `position: absolute`, centrado encima del icono, con `max-width` y word-wrap, visible con CSS `:hover` y `:focus-within` del contenedor. La asociación `aria-describedby` conecta el icono con el tooltip. El ID del tooltip se genera con `useId()`.

**Tests**:
- `src/tests/layout-renderer/layout-renderer-tooltip.test.tsx` (nuevo)

**Documentación afectada**: ninguna.

### Tests

- **Ficheros de test**:
  - `src/tests/layout-renderer/layout-renderer-tooltip.test.tsx` (nuevo)

- **Comportamiento cubierto**:
  - Renderiza el icono de ayuda cuando `text` es un string no vacío
  - No renderiza nada cuando `text` es string vacío
  - No renderiza nada cuando `text` es `undefined`
  - El icono es focusable por teclado (tiene `tabindex="0"`)
  - El icono tiene `aria-label` con valor `"Help"`
  - El tooltip tiene `role="tooltip"`
  - Existe asociación `aria-describedby` entre el icono y el tooltip
  - El texto del tooltip muestra el contenido recibido en `text`

- **Comandos durante la implementación**:
  - `pnpm test --run src/tests/layout-renderer/layout-renderer-tooltip.test.tsx`

- **Restricciones**: Los tests de esta tarea renderizan `FieldTooltip` directamente (sin necesidad de un field node host). No dependen del state provider ni del form context. Mantener los tests simples y focalizados en el componente aislado.

### Criterios de finalización

- **Cierre de implementación**: El componente `FieldTooltip` existe en `src/runtime/nodes/field-tooltip.tsx`, renderiza correctamente el icono y el tooltip con la accesibilidad especificada, y no renderiza nada cuando el texto está ausente o vacío. Los tests de esta tarea pasan. `pnpm test` sigue en verde.

---

## T3 — Integración del tooltip en los siete field nodes

- **Estado**: completada
- **Objetivo**: Integrar el componente `FieldTooltip` en los siete field nodes con label (`input`, `textarea`, `select`, `radioGroup`, `checkboxGroup`, `toggle`, `fileInput`), de forma que cuando `props.tooltip` contenga un string no vacío (tras resolución de referencias), se renderice el icono de ayuda junto al texto del label. La resolución del tooltip usa `resolveRuntimeTextReference` con la misma semántica que `props.label`.
- **Fuera de alcance**: Tooltip en nodos sin label (`hidden`). Tooltip en nodos que no sean field nodes de formulario. Cambios en la validación de config (ya resuelta en T1).
- **Dependencias**: T1 (prop tooltip en tipos y esquemas), T2 (componente `FieldTooltip`).

### Impacto esperado en archivos

**Código**:
- `src/runtime/nodes/input-layout-node.tsx` — Importar `FieldTooltip`. Resolver `tooltip` via `resolveRuntimeTextReference(node.props.tooltip, ...)`. Reemplazar el `<span>` del label por un contenedor inline que incluya el texto del label y `<FieldTooltip text={tooltip} />` cuando tooltip es non-empty.
- `src/runtime/nodes/textarea-layout-node.tsx` — Mismo patrón que input.
- `src/runtime/nodes/select-layout-node.tsx` — Mismo patrón que input.
- `src/runtime/nodes/radio-group-layout-node.tsx` — Dentro del `<fieldset>`, reemplazar el `<legend>` plano por un `<legend>` que incluya el texto y `<FieldTooltip>`.
- `src/runtime/nodes/checkbox-group-layout-node.tsx` — Mismo patrón que radioGroup.
- `src/runtime/nodes/toggle-layout-node.tsx` — Resolver `tooltip` via `resolveRuntimeTextReference`. En ambos modos (`top` e `inline`), añadir `<FieldTooltip>` junto al `<span>` del label.
- `src/runtime/nodes/file-input-layout-node.tsx` — Importar `resolveRuntimeTextReference` y `FieldTooltip`. Resolver `tooltip` via `resolveRuntimeTextReference(node.props.tooltip, ...)`. Añadir `<FieldTooltip>` junto al texto del `<label>`.

**Tests**:
- `src/tests/layout-renderer/layout-renderer-tooltip.test.tsx` (ampliación)

**Documentación afectada**:
- `ai-workflow/docs/app-features/nodes/input.md`
- `ai-workflow/docs/app-features/nodes/textarea.md`
- `ai-workflow/docs/app-features/nodes/select.md`
- `ai-workflow/docs/app-features/nodes/choice-groups.md`
- `ai-workflow/docs/app-features/nodes/toggle.md`
- `ai-workflow/docs/app-features/nodes/file-input.md`

### Tests

- **Ficheros de test**:
  - `src/tests/layout-renderer/layout-renderer-tooltip.test.tsx` (ampliación)

- **Comportamiento cubierto**:
  - Input con `props.tooltip` declarado renderiza icono de ayuda junto al label
  - Input sin `props.tooltip` no renderiza icono de ayuda
  - Textarea con `props.tooltip` declarado renderiza icono de ayuda junto al label
  - Select con `props.tooltip` declarado renderiza icono de ayuda junto al label
  - RadioGroup con `props.tooltip` declarado renderiza icono de ayuda junto al legend
  - CheckboxGroup con `props.tooltip` declarado renderiza icono de ayuda junto al legend
  - Toggle (labelPosition top) con `props.tooltip` declarado renderiza icono de ayuda junto al label
  - Toggle (labelPosition inline) con `props.tooltip` declarado renderiza icono de ayuda junto al label inline
  - FileInput con `props.tooltip` declarado renderiza icono de ayuda junto al label
  - Input con `props.tooltip` como string vacío no renderiza icono de ayuda
  - Input con `props.tooltip` que contiene referencia interpolada `{{translations.helpText}}` renderiza el texto resuelto en el tooltip
  - Input con `props.tooltip` que contiene referencia no resuelta renderiza string vacío y no muestra icono
  - El tooltip no afecta al valor, validación ni submit del campo (un input con tooltip + required rechaza submit vacío igual que sin tooltip)
  - Input con `props.tooltip` e `props.icon` declarados: ambos coexisten sin interferencia (el icono del input aparece en el control, el icono de ayuda aparece en el label)

- **Comandos durante la implementación**:
  - `pnpm test --run src/tests/layout-renderer/layout-renderer-tooltip.test.tsx`

- **Restricciones**: Los tests de integración renderizan cada field node dentro de un form host con `RuntimeStateProvider`, reutilizando los patrones de fixture ya establecidos en `src/tests/layout-renderer/layout-renderer-toggle.test.tsx` y `src/tests/layout-renderer/layout-renderer-forms-fields.test.tsx`. No crear fixtures nuevas si las existentes cubren la necesidad.

### Criterios de finalización

- **Cierre de implementación**: Los siete field nodes renderizan el icono de ayuda y el tooltip cuando `props.tooltip` contiene un string no vacío resuelto. No renderizan nada adicional cuando `props.tooltip` está ausente o resuelve a vacío. La interpolación `{{...}}` funciona en el tooltip con las mismas reglas que en `props.label`. El tooltip no interfiere con el valor, validación ni submit del campo. Los tests de esta tarea pasan. `pnpm test` sigue en verde sin regresión de cobertura.
