# Plan de implementación: placeholder en nodos de formulario

Contrato de ejecución para la feature 0061. Tareas atómicas, secuenciales, con su sub-bloque `tests`. Sigue el orden: T1 establece el contrato (tipos + Zod + diagnostics), T2–T4 implementan render por nodo.

Siguiente tarea recomendada: T1.

---

## T1 — Contrato del campo `placeholder` en config y diagnostics

### Estado
completada

### Objetivo
Incorporar `props.placeholder` como campo opcional de tipo `string` en los nodos `input`, `textarea` y `select` a nivel de tipos TypeScript, esquemas Zod y registro de superficies de referencia. El campo debe aceptarse en el parser sin afectar a ningún otro contrato y debe quedar disponible para que el render lo consuma en tareas posteriores.

### Fuera de alcance
- No tocar la render UI de ningún nodo en esta tarea.
- No añadir `placeholder` a `radioGroup` ni a `checkboxGroup`.
- No introducir validaciones nuevas sobre el contenido del placeholder (cualquier string es válido, incluido `""`).
- No modificar `formFieldNodePropsSchema` compartido si eso implicaría exponer `placeholder` también a `radioGroup` y `checkboxGroup`; el campo se añade vía `.extend` solo en los tres nodos del alcance.
- No actualizar `dynamic-strings.md` ni fichas de `app-features/` aquí: eso lo declarará el campo `documentación afectada` y se ejecutará con `update-app-documentation`.

### Dependencias
Ninguna.

### Impacto esperado en archivos
- Código:
  - `src/config/runtime-config-types.ts`: añadir `placeholder?: string` a la props inline de `InputLayoutNode`, `TextareaLayoutNode` y `SelectLayoutNode`.
  - `src/config/runtime-config-zod.ts`: en `inputNodeSchema`, `textareaNodeSchema` y `selectNodeSchema`, sustituir/extender el bloque `props` por `formFieldNodePropsSchema.extend({ placeholder: z.string().optional(), ...campos específicos previos del nodo }).strip()`. En particular, `textareaNodeSchema` pasa de `props: formFieldNodePropsSchema` a `props: formFieldNodePropsSchema.extend({ placeholder: z.string().optional() }).strip()`. No alterar `formFieldNodePropsSchema` compartido para que `radioGroup` y `checkboxGroup` no expongan `placeholder`.
  - `src/runtime/runtime-references/runtime-reference-diagnostics.ts`: añadir `'input.props.placeholder'`, `'textarea.props.placeholder'` y `'select.props.placeholder'` al union `RuntimeReferenceSurface`.
- Tests:
  - `src/tests/config-validation/runtime-config-validation-form-fields.test.ts` (ampliación).
- Documentación afectada (referencia para `update-app-documentation`, no se toca aquí):
  - `ai-workflow/docs/app-features/nodes/input.md`
  - `ai-workflow/docs/app-features/nodes/textarea.md`
  - `ai-workflow/docs/app-features/nodes/select.md`
  - `ai-workflow/docs/app-features/references/dynamic-strings.md`

### Tests
- **Ficheros de test**:
  - `src/tests/config-validation/runtime-config-validation-form-fields.test.ts` (ampliación).
- **Comportamiento cubierto**:
  - Un `input` válido dentro de un `form` acepta `props.placeholder: "Introduce tu nombre"` y el nodo normalizado expone ese valor en `props.placeholder`.
  - Un `input` sin `props.placeholder` se sigue aceptando y el nodo normalizado no presenta la propiedad (o la presenta como `undefined`) sin errores.
  - Un `input` con `props.placeholder: ""` se acepta sin errores y el nodo normalizado conserva la cadena vacía (el filtrado de render se valida en T2).
  - Un `input` con `props.placeholder: 123` (no string) se rechaza con error de layout sobre `props.placeholder`.
  - Un `textarea` con `props.placeholder: "Escribe aquí..."` se acepta y normaliza igual que el caso `input`.
  - Un `textarea` con `props.placeholder` no string se rechaza.
  - Un `select` simple (`multiple` ausente) con `props.placeholder: "Selecciona una opción"` se acepta y el nodo normalizado expone ese valor.
  - Un `select` con `props.multiple: true` y `props.placeholder` declarado se sigue aceptando (no error de validación), porque el runtime lo ignora silenciosamente; el placeholder se conserva en el nodo normalizado.
  - Un `select` con `props.placeholder` no string se rechaza.
  - Un nodo no incluido en el alcance (ej. `radioGroup` o `checkboxGroup`) con `props.placeholder` lo trata como propiedad extra: el parser hace `.strip()` y el nodo normalizado no lo expone (verificar que no se filtra al output ni rompe la validación).
- **Comandos durante la implementación**:
  - `pnpm test --run src/tests/config-validation/runtime-config-validation-form-fields.test.ts`
- **Restricciones**:
  - Reusar las fixtures y helpers ya existentes en `src/tests/config-validation/helpers.ts` y en el propio fichero de tests; no crear un harness nuevo.
  - No introducir snapshots; aseverar sobre la forma del nodo normalizado y los errores diagnósticos.

### Criterios de finalización
- Los tres esquemas Zod aceptan `placeholder` opcional y siguen rechazándolo cuando no es string.
- Los tres tipos TS exponen `placeholder?: string` en su `props`.
- El union `RuntimeReferenceSurface` incluye las tres nuevas superficies.
- Los tests añadidos pasan ejecutando el comando del sub-bloque y todo `pnpm test` sigue en verde.

### Cierre de implementación
Código y tests de la tarea completos, `pnpm test --run src/tests/config-validation/runtime-config-validation-form-fields.test.ts` en verde y suite global sin regresiones.

---

## T2 — Render de `placeholder` en `input`

### Estado
completada

### Objetivo
Resolver `node.props.placeholder` en `InputNode` con la misma semántica que `props.label` (literal + interpolación parcial `{{...}}` usando `resolveRuntimeTextReference` con la superficie `'input.props.placeholder'`) y aplicarlo como atributo HTML `placeholder` del `<input>`. Cuando el placeholder resuelto sea cadena vacía o el campo no esté declarado, el `<input>` renderizado no debe incluir el atributo.

### Fuera de alcance
- `textarea` y `select` (cubiertos por T3 y T4).
- Estilos visuales del placeholder.
- Modificar el valor inicial, la validación o el flujo de submit del campo.

### Dependencias
- T1 cerrada (el tipo y el Zod aceptan `placeholder` y la superficie `'input.props.placeholder'` existe).

### Impacto esperado en archivos
- Código:
  - `src/runtime/nodes/input-layout-node.tsx`: resolver `node.props.placeholder` con `resolveRuntimeTextReference(..., 'input.props.placeholder', { iterationContext })` y aplicar el atributo `placeholder` al `<input>` solo cuando el valor resuelto sea string no vacío.
- Tests:
  - `src/tests/layout-renderer/layout-renderer-forms-fields.test.tsx` (ampliación).
- Documentación afectada:
  - `ai-workflow/docs/app-features/nodes/input.md`
  - `ai-workflow/docs/app-features/references/dynamic-strings.md`

### Tests
- **Ficheros de test**:
  - `src/tests/layout-renderer/layout-renderer-forms-fields.test.tsx` (ampliación).
- **Comportamiento cubierto**:
  - Un `input` con `props.placeholder: "Introduce tu nombre"` renderiza un `<input>` con `placeholder="Introduce tu nombre"`.
  - Un `input` sin `props.placeholder` renderiza un `<input>` sin atributo `placeholder` (assert con `not.toHaveAttribute('placeholder')`).
  - Un `input` con `props.placeholder: ""` renderiza un `<input>` sin atributo `placeholder`.
  - Un `input` con `props.placeholder: "Hola {{params.userName}}"` y `params.userName: "Ada"` renderiza `placeholder="Hola Ada"`.
  - Un `input` con `props.placeholder: "Hola {{params.missing}}"` renderiza `placeholder="Hola "` (placeholder no resoluble degrada a string vacío manteniendo el texto literal alrededor; el atributo sí se establece porque la parte literal no está vacía).
  - Añadir `placeholder` no cambia el valor mostrado ni dispara cambios en `forms.{formId}.{fieldId}`.
- **Comandos durante la implementación**:
  - `pnpm test --run src/tests/layout-renderer/layout-renderer-forms-fields.test.tsx`
- **Restricciones**:
  - Reusar los helpers del propio fichero para montar formularios; no crear un harness alternativo.
  - Aseverar sobre el DOM del `<input>` (rol `textbox` o selector explícito por `id`), no sobre el wrapper.

### Criterios de finalización
- `InputNode` renderiza el atributo `placeholder` cuando el valor resuelto es no vacío y lo omite cuando es vacío o ausente.
- Interpolación parcial `{{...}}` y referencias ausentes se comportan como en el resto de superficies textuales del catálogo.
- Tests del fichero verde y suite global sin regresiones.

### Cierre de implementación
Código y tests de la tarea completos, `pnpm test --run src/tests/layout-renderer/layout-renderer-forms-fields.test.tsx` en verde y suite global sin regresiones.

---

## T3 — Render de `placeholder` en `textarea`

### Estado
completada

### Objetivo
Resolver `node.props.placeholder` en `TextareaNode` con la misma semántica que en `InputNode` (T2), usando la superficie `'textarea.props.placeholder'`, y aplicar el atributo HTML `placeholder` al `<textarea>` solo cuando el valor resuelto sea string no vacío.

### Fuera de alcance
- `input` y `select` (cubiertos por T2 y T4).
- Cambios de altura mínima, `resize`, foco u otros estilos del `textarea`.
- Cualquier modificación al flujo de validación del campo.

### Dependencias
- T1 cerrada.
- T2 no es bloqueante a nivel de compilación; se planifica detrás de T2 por consistencia de orden.

### Impacto esperado en archivos
- Código:
  - `src/runtime/nodes/textarea-layout-node.tsx`: resolver `node.props.placeholder` con `resolveRuntimeTextReference(..., 'textarea.props.placeholder', { iterationContext })` y aplicar el atributo `placeholder` al `<textarea>` solo cuando el valor resuelto sea string no vacío.
- Tests:
  - `src/tests/layout-renderer/layout-renderer-forms-fields.test.tsx` (ampliación).
- Documentación afectada:
  - `ai-workflow/docs/app-features/nodes/textarea.md`
  - `ai-workflow/docs/app-features/references/dynamic-strings.md`

### Tests
- **Ficheros de test**:
  - `src/tests/layout-renderer/layout-renderer-forms-fields.test.tsx` (ampliación).
- **Comportamiento cubierto**:
  - Un `textarea` con `props.placeholder: "Escribe aquí..."` renderiza un `<textarea>` con `placeholder="Escribe aquí..."`.
  - Un `textarea` sin `props.placeholder` renderiza un `<textarea>` sin atributo `placeholder`.
  - Un `textarea` con `props.placeholder: ""` renderiza un `<textarea>` sin atributo `placeholder`.
  - Un `textarea` con `props.placeholder: "{{params.userName}}"` y `params.userName: "Ada"` renderiza `placeholder="Ada"`.
  - Un `textarea` con `props.placeholder: "{{params.missing}}"` renderiza un `<textarea>` sin atributo `placeholder` (placeholder único no resoluble que produce string final vacío).
  - Añadir `placeholder` no cambia el valor del campo ni el contenido del `<textarea>`.
- **Comandos durante la implementación**:
  - `pnpm test --run src/tests/layout-renderer/layout-renderer-forms-fields.test.tsx`
- **Restricciones**:
  - Reusar los mismos helpers del fichero usado por T2.
  - Aseverar sobre el `<textarea>` directamente (rol `textbox` con el `<textarea>` correspondiente o selector por `id`).

### Criterios de finalización
- `TextareaNode` aplica el mismo contrato funcional que `InputNode` para `placeholder`.
- Tests del fichero verde y suite global sin regresiones.

### Cierre de implementación
Código y tests de la tarea completos, `pnpm test --run src/tests/layout-renderer/layout-renderer-forms-fields.test.tsx` en verde y suite global sin regresiones.

---

## T4 — Render de `placeholder` en `select` simple e ignorado en `select.multiple`

### Estado
completada

### Objetivo
En `SelectNode`, resolver `node.props.placeholder` con `resolveRuntimeTextReference(..., 'select.props.placeholder', { iterationContext })`. Cuando el `select` es simple (`multiple` no `true`) y el placeholder resuelto es string no vacío, sustituir la opción vacía sintética actual (`{ label: '', value: '' }`) por una opción `<option value="" disabled>{placeholder}</option>` que se inserta al inicio de las opciones solo cuando el valor efectivo del campo sea `''`. Cuando `placeholder` esté ausente o resuelva a vacío, el comportamiento actual se mantiene (opción vacía sin etiqueta). Cuando `multiple` es `true`, `placeholder` se ignora completamente: no se inserta ninguna opción adicional aunque esté declarado.

### Fuera de alcance
- `input` y `textarea` (cubiertos por T2 y T3).
- Cambios en `normalizeChoiceFieldValue` o en la resolución de items.
- Cambios en la validación `required`: el valor seleccionado mientras se ve el placeholder sigue siendo `''` y por tanto sigue siendo inválido para `required`.
- Estilos personalizados de la opción placeholder más allá del atributo `disabled`.

### Dependencias
- T1 cerrada.
- Independiente de T2 y T3 a nivel de compilación; se planifica al final por orden de feature.

### Impacto esperado en archivos
- Código:
  - `src/runtime/nodes/select-layout-node.tsx`:
    - Calcular `placeholderText = !isMultiple ? resolveRuntimeTextReference(node.props.placeholder ?? '', state, 'select.props.placeholder', { iterationContext }) : ''`.
    - Cuando `!isMultiple && value === '' && !resolvedItems.some((item) => item.value === '')`: insertar al inicio del array de items renderizables una opción sintética cuya marca de "placeholder activo" sea su posición y la combinación `value === '' && placeholderText !== ''`. La marca NO se propaga al tipo `SelectLayoutNodeItem`: el array local `items` puede mantener su forma `{ label, value }` actual y el `.map()` detecta la opción placeholder por la regla `index === 0 && item.value === '' && placeholderText !== ''` para emitir `disabled` en el JSX (`<option value="" disabled={index === 0 && placeholderText !== ''}>`). El resto de opciones no llevan `disabled`.
    - Cuando `!isMultiple` y `placeholderText === ''`: mantener el comportamiento actual (primera opción vacía sin `label` y sin `disabled`).
    - Cuando `isMultiple`: no insertar ninguna opción placeholder, aunque `node.props.placeholder` esté declarado, y no recorrer la rama de cálculo de `placeholderText`.
- Tests:
  - `src/tests/layout-renderer/layout-renderer-forms-fields.test.tsx` (ampliación).
- Documentación afectada:
  - `ai-workflow/docs/app-features/nodes/select.md`
  - `ai-workflow/docs/app-features/references/dynamic-strings.md`

### Tests
- **Ficheros de test**:
  - `src/tests/layout-renderer/layout-renderer-forms-fields.test.tsx` (ampliación).
- **Comportamiento cubierto**:
  - Un `select` simple con `props.placeholder: "Selecciona una opción"` e items reales, sin `defaultValue`, renderiza como primera opción `<option value="" disabled>Selecciona una opción</option>` y mantiene las opciones reales después.
  - Esa opción placeholder no es seleccionable (atributo `disabled` presente).
  - El mismo `select` con un `defaultValue` que coincide con una opción real no muestra la opción placeholder como activa (el `<select>` toma el valor real) y la opción placeholder sigue presente en el DOM con `disabled`.
  - Un `select` simple con `props.placeholder: "Selecciona"` y `defaultValue` literal que NO coincide con ninguna opción queda con valor vacío y la opción placeholder visible y disabled.
  - Un `select` simple sin `props.placeholder` y sin valor seleccionado conserva el comportamiento actual: primera opción vacía sin `disabled`, sin texto placeholder.
  - Un `select` simple con `props.placeholder: ""` se comporta exactamente igual que el caso sin placeholder.
  - Un `select` simple con `props.placeholder: "Hola {{params.userName}}"` y `params.userName: "Ada"` renderiza la opción placeholder con texto `"Hola Ada"`.
  - Un `select.multiple: true` con `props.placeholder: "Selecciona varias"` no añade ninguna opción adicional ni cambia el catálogo visible (assert sobre número y orden de `<option>`).
  - Un `select` simple con `placeholder` declarado y `validations.required: true`, sin selección activa, falla la validación `required` en submit (mismo valor `''`); la presencia del placeholder no salta la regla.
- **Comandos durante la implementación**:
  - `pnpm test --run src/tests/layout-renderer/layout-renderer-forms-fields.test.tsx`
- **Restricciones**:
  - Reusar los helpers de montaje de formularios del fichero.
  - Para el caso `required`, integrarse con el mismo patrón de submit ya usado en otros tests del fichero; no introducir un harness paralelo de validación.

### Criterios de finalización
- `SelectNode` inserta una opción placeholder deshabilitada solo cuando el select es simple, hay placeholder no vacío y el valor efectivo es `''`.
- `select.multiple` ignora silenciosamente `props.placeholder`.
- La semántica de `required` no cambia.
- Tests del fichero verde y suite global sin regresiones.

### Cierre de implementación
Código y tests de la tarea completos, `pnpm test --run src/tests/layout-renderer/layout-renderer-forms-fields.test.tsx` en verde y suite global sin regresiones.

---

## Orden y siguiente paso
1. T1 — contrato (tipos + Zod + diagnostics).
2. T2 — render en `input`.
3. T3 — render en `textarea`.
4. T4 — render en `select` simple e ignorado en `select.multiple`.

Después de cerrar T4, lanzar `update-app-documentation` para reflejar `placeholder` en las tres fichas de nodo y en `dynamic-strings.md`.
