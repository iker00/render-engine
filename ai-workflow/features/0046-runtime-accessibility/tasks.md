# 0046 — tasks

Contrato de ejecución secuencial para implementar la feature 0046 (accesibilidad en nodos del runtime). Cada tarea es atómica, ordenada por dependencia y debe poder cerrarse en una sola pasada de implementación. La pasada de implementación debe seguir el orden exacto T1 → T2 → T3 → T4 → T5 → T6.

Convenciones:
- Cierre de implementación: código y tests propios de la tarea verdes; no incluye documentación.
- Cierre documental: doc afectada actualizada en una pasada posterior; las tareas T1–T5 declaran su impacto documental pero su cierre documental se ejecuta en T6.
- El umbral global de cobertura 80% sobre `src/` (`pnpm test`) es gate del cierre de la pasada de implementación, no se replica por tarea.
- Las correcciones son aditivas: ninguna debe alterar comportamiento funcional visible (apertura/cierre de modal, navegación, validación de formularios, fallbacks de query siguen funcionando exactamente igual).

---

## T1 — Modal: rol de diálogo, `aria-modal` y nombre accesible vía `props.label`

- **ID**: T1
- **Estado**: done
- **Objetivo**: Que el panel del modal renderice `role="dialog"` y `aria-modal="true"`, y que tenga un nombre accesible vía `aria-label`. Añadir al contrato del nodo `modal` el campo opcional `props.label` (string). Si `props.label` está declarado, se usa como `aria-label` del panel; si no, el panel recibe el fallback literal `aria-label="Diálogo"`. La validación Zod debe aceptar el nuevo campo manteniendo el rechazo de claves extra en `props`.
- **Fuera de alcance**:
  - Cambios en focus trap, ESC, overlay-click u otra mecánica de apertura/cierre del modal (ya implementadas correctamente).
  - Soporte de `aria-labelledby` por referencia a un heading hijo.
  - Resolución dinámica de `props.label` vía referencias `{{...}}` o `queries.*` (es string literal, sin interpolación).
  - Cualquier cambio visual; el panel sigue renderizando exactamente la misma estructura DOM externa más los atributos ARIA.
- **Dependencias**: ninguna.
- **Impacto esperado en archivos**:
  - Código:
    - `src/config/runtime-config-zod.ts` — extender `modalNodeSchema.props` con `label: z.string().optional()`; mantener `.strip()` y el resto de campos intactos.
    - `src/runtime/nodes/modal-layout-node.tsx` — añadir `role="dialog"`, `aria-modal="true"` y `aria-label` al `<div data-testid="modal-panel">`. El valor de `aria-label` es `node.props?.label` cuando es string no vacío; si no, el literal exacto `'Diálogo'`.
  - Tests:
    - `src/tests/config-validation/runtime-config-validation-modal.test.ts` (ampliación).
    - `src/tests/layout-renderer/layout-renderer-modal.test.tsx` (ampliación).
  - Documentación: `ai-workflow/docs/app-features/nodes/modal.md` (impacto declarado, cierre documental en T6).
- **Tests**:
  - Ficheros de test:
    - `src/tests/config-validation/runtime-config-validation-modal.test.ts` (ampliación)
    - `src/tests/layout-renderer/layout-renderer-modal.test.tsx` (ampliación)
  - Comportamiento cubierto:
    - Un `modal` con `props.label: "Confirmar eliminación"` se acepta por la validación y queda normalizado con el campo presente en el config validado.
    - Un `modal` sin `props.label` se sigue aceptando y no añade el campo al config validado.
    - Un `modal` con `props.label` no string (número, boolean, objeto) rechaza el config completo con el mismo patrón de mensaje que usan otras claves de `props` (`"layout[0].props.label"`).
    - Una clave extra dentro de `props.label.*` o cualquier otra clave nueva no declarada en `props` sigue rechazándose si Zod ya rechaza extras; si Zod las `strip`-ea, mantener ese comportamiento como hoy.
    - Un `modal` abierto renderiza el panel con `role="dialog"` y `aria-modal="true"`.
    - Un `modal` abierto sin `props.label` renderiza el panel con `aria-label="Diálogo"`.
    - Un `modal` abierto con `props.label: "Confirmar eliminación"` renderiza el panel con `aria-label="Confirmar eliminación"`.
    - Un `modal` dentro de `repeater.props.template` con `props.label` aplica el mismo `aria-label` a cada instancia abierta de modal (verificable cuando solo hay una iteración abierta, dado que solo un modal puede estar abierto a la vez).
    - El test existente que verifica focus trap, ESC, overlay-click y `defaultOpen` sigue verde tras añadir los nuevos atributos ARIA.
  - Comandos durante la implementación:
    - `pnpm test --run src/tests/config-validation/runtime-config-validation-modal.test.ts`
    - `pnpm test --run src/tests/layout-renderer/layout-renderer-modal.test.tsx`
  - Restricciones:
    - Reutilizar los helpers existentes de ambos ficheros (`createModalNode`, `createConfigWithLayout`, los renderers de modal abiertos por botón) sin introducir un harness paralelo.
    - Las aserciones de ARIA deben hacerse sobre el `getByTestId('modal-panel')` o usando `getByRole('dialog')`; no recurrir a snapshots de markup.
- **Documentación afectada**: `ai-workflow/docs/app-features/nodes/modal.md` (impacto declarado, cierre documental en T6).
- **Criterios de finalización**:
  - El panel renderiza `role="dialog"`, `aria-modal="true"` y un `aria-label` no vacío en todos los casos.
  - El campo `props.label` está aceptado por la validación y normalizado en el config validado.
  - Los tests nuevos pasan junto con los existentes de los dos ficheros.
- **Cierre de implementación**: T1 cierra cuando los tests indicados están verdes y el resto de tests del proyecto que tocan modal o validación de modal siguen verdes.
- **Cierre documental**: diferido a T6.

---

## T2 — Campos de texto y `select`: `id`, `aria-describedby` de error y limpieza de `aria-label` redundante

- **ID**: T2
- **Estado**: done
- **Objetivo**: Que los nodos `input`, `textarea` y `select` generen un `id` estable en el control y vinculen el span de error vía `aria-describedby` cuando hay error activo. Eliminar el `aria-label` redundante actualmente presente en el `<select>` (ya tiene `<label>` wrapper). El atributo `aria-describedby` debe estar presente solo cuando hay error; al limpiarse el error, debe desaparecer junto con el span de error.
- **Fuera de alcance**:
  - Tocar `radioGroup` y `checkboxGroup`: viven en T3.
  - Cambiar la asociación `<label>`↔control (sigue siendo wrapper implícito en los tres nodos).
  - Cambiar el contrato de los campos (`fieldId`, `label`, `defaultValue`, validation rules).
  - Resolver dinámicamente el texto del error o cambiar su renderizado visual.
  - Añadir un `id` al `<label>` o al `<span>` de label.
- **Dependencias**: ninguna.
- **Impacto esperado en archivos**:
  - Código:
    - `src/runtime/nodes/input-layout-node.tsx` — añadir `id={\`${formId}-${fieldId}\`}` al `<input>`. Cuando `error !== null`, añadir `aria-describedby={\`${formId}-${fieldId}-error\`}` al `<input>` y añadir el mismo `id` al `<span>` de error.
    - `src/runtime/nodes/textarea-layout-node.tsx` — mismo patrón sobre el `<textarea>` y su `<span>` de error.
    - `src/runtime/nodes/select-layout-node.tsx` — mismo patrón sobre el `<select>` y su `<span>` de error; además, eliminar el `aria-label={label}` actualmente presente en el `<select>`.
    - Si el patrón `${formId}-${fieldId}` y `${formId}-${fieldId}-error` aparece en más de un nodo, valorar extraer un helper local pequeño (por ejemplo, en `src/runtime/runtime-form-validations.ts` o en un módulo nuevo `src/runtime/runtime-form-field-ids.ts`) solo si la legibilidad mejora claramente. No introducir abstracción si no hay repetición real.
  - Tests:
    - `src/tests/layout-renderer/layout-renderer-forms.test.tsx` (ampliación).
    - `src/tests/layout-renderer/layout-renderer-forms-fields.test.tsx` (ampliación).
  - Documentación: `ai-workflow/docs/app-features/nodes/input.md`, `ai-workflow/docs/app-features/nodes/textarea.md`, `ai-workflow/docs/app-features/nodes/select.md` (impacto declarado, cierre documental en T6).
- **Tests**:
  - Ficheros de test:
    - `src/tests/layout-renderer/layout-renderer-forms.test.tsx` (ampliación)
    - `src/tests/layout-renderer/layout-renderer-forms-fields.test.tsx` (ampliación)
  - Comportamiento cubierto:
    - Un `input` sin error renderiza el control con `id="${formId}-${fieldId}"` y sin atributo `aria-describedby`.
    - Un `input` con error activo (tras submit que dispara validación) añade `aria-describedby="${formId}-${fieldId}-error"` al control y el span de error renderiza con `id="${formId}-${fieldId}-error"`.
    - Al limpiar el error escribiendo un valor válido, `aria-describedby` desaparece del `<input>` y el span de error deja de existir.
    - Un `textarea` cumple el mismo contrato (id estable, aria-describedby solo con error, span con id correspondiente, atributo desaparece al limpiar el error).
    - Un `select` cumple el mismo contrato.
    - El `<select>` no incluye `aria-label` cuando ya tiene `<label>` wrapper (el test existente que comprobaba `toHaveAttribute('aria-label', ...)` se actualiza para asegurar la ausencia del atributo, o se sustituye por una aserción equivalente sobre la asociación accesible por `<label>`).
    - El `<select>` sigue siendo accesible vía `getByRole('combobox', { name: <label> })` o `getByLabelText(<label>)` después del cambio, demostrando que la asociación label↔control sigue funcionando vía wrapper.
  - Comandos durante la implementación:
    - `pnpm test --run src/tests/layout-renderer/layout-renderer-forms.test.tsx`
    - `pnpm test --run src/tests/layout-renderer/layout-renderer-forms-fields.test.tsx`
  - Restricciones:
    - Reusar los helpers ya existentes en ambos ficheros (renderers de formulario, fixtures de validation). No introducir snapshots ni un harness nuevo.
    - El test existente sobre `aria-label` en `select` debe quedar actualizado a la nueva semántica; no dejar dos aserciones contradictorias.
- **Documentación afectada**: `ai-workflow/docs/app-features/nodes/input.md`, `ai-workflow/docs/app-features/nodes/textarea.md`, `ai-workflow/docs/app-features/nodes/select.md` (impacto declarado, cierre documental en T6).
- **Criterios de finalización**:
  - Los tres nodos generan `id` estable y `aria-describedby` solo cuando hay error.
  - El span de error siempre lleva el `id` consistente con el `aria-describedby`.
  - El `<select>` ya no incluye `aria-label` redundante.
  - Los tests nuevos pasan junto con los existentes de ambos ficheros.
- **Cierre de implementación**: T2 cierra cuando los tests indicados están verdes y el resto de tests del proyecto que tocan estos nodos siguen verdes.
- **Cierre documental**: diferido a T6.

---

## T3 — Grupos de opciones: `aria-describedby` de error en `<fieldset>`

- **ID**: T3
- **Estado**: done
- **Objetivo**: Que `radioGroup` y `checkboxGroup` añadan `aria-describedby` sobre su `<fieldset>` cuando hay error activo, apuntando al `id` del span de error correspondiente. El span de error debe llevar el `id` consistente. El atributo `aria-describedby` debe estar presente solo cuando hay error y desaparecer al limpiarse.
- **Fuera de alcance**:
  - Tocar `input`, `textarea`, `select`: viven en T2.
  - Añadir un `id` al `<fieldset>`, al `<legend>` o a cada `<input type="radio">` / `<input type="checkbox">` individual (la asociación label↔control sigue siendo wrapper implícito por `<label>` envolviendo cada opción).
  - Cambiar el contrato del nodo o la semántica de selección múltiple.
- **Dependencias**: ninguna estricta sobre T2. Se puede implementar en paralelo conceptualmente, pero el orden de ejecución acordado es T2 antes que T3.
- **Impacto esperado en archivos**:
  - Código:
    - `src/runtime/nodes/radio-group-layout-node.tsx` — cuando `error !== null`, añadir `aria-describedby={\`${formId}-${fieldId}-error\`}` al `<fieldset>` y añadir el mismo `id` al `<span>` de error.
    - `src/runtime/nodes/checkbox-group-layout-node.tsx` — mismo patrón.
  - Tests:
    - `src/tests/layout-renderer/layout-renderer-forms-fields.test.tsx` (ampliación).
  - Documentación: `ai-workflow/docs/app-features/nodes/choice-groups.md` (impacto declarado, cierre documental en T6).
- **Tests**:
  - Ficheros de test:
    - `src/tests/layout-renderer/layout-renderer-forms-fields.test.tsx` (ampliación)
  - Comportamiento cubierto:
    - Un `radioGroup` sin error renderiza el `<fieldset>` sin atributo `aria-describedby` y sin span de error.
    - Un `radioGroup` con error activo añade `aria-describedby="${formId}-${fieldId}-error"` al `<fieldset>` y el span de error renderiza con `id="${formId}-${fieldId}-error"`.
    - Al limpiar el error (seleccionando un valor válido), `aria-describedby` desaparece del `<fieldset>` y el span de error deja de existir.
    - Un `checkboxGroup` cumple el mismo contrato.
    - El `<fieldset>` sigue siendo localizable vía `getByRole('group', { name: <legend> })` después del cambio, demostrando que la asociación legend↔group sigue funcionando.
  - Comandos durante la implementación:
    - `pnpm test --run src/tests/layout-renderer/layout-renderer-forms-fields.test.tsx`
  - Restricciones:
    - Reusar los helpers existentes del fichero (renderers de formulario, fixture de validación que dispara error).
    - No introducir snapshots; afirmar atributos concretos sobre el elemento `<fieldset>` y el span de error.
- **Documentación afectada**: `ai-workflow/docs/app-features/nodes/choice-groups.md` (impacto declarado, cierre documental en T6).
- **Criterios de finalización**:
  - `radioGroup` y `checkboxGroup` generan `aria-describedby` solo cuando hay error y el span de error lleva el `id` consistente.
  - Los tests nuevos pasan junto con los existentes del fichero.
- **Cierre de implementación**: T3 cierra cuando los tests indicados están verdes y el resto de tests del proyecto que tocan estos nodos siguen verdes.
- **Cierre documental**: diferido a T6.

---

## T4 — `queryStateFeedback`: envolver fallbacks de `loading` y `error` con rol ARIA

- **ID**: T4
- **Estado**: done
- **Objetivo**: Que el renderer central, al sustituir un nodo por su fallback de `queryStateFeedback` en estado `loading`, envuelva los nodos de fallback con un elemento contenedor que incluya `role="status"`. Cuando el estado es `error`, envolver con un elemento contenedor que incluya `role="alert"`. Los estados `idle`, `empty` y `success` no añaden envoltorio ni rol especial: siguen renderizando el fallback directamente como hoy. El envoltorio se aplica una sola vez por nodo sustituido (no por cada nodo hijo del fallback) y respeta el flujo de iteración (`iterationContext`) sin cambios funcionales.
- **Fuera de alcance**:
  - Cambiar la heurística de derivación de estado visible (`deriveQueryVisibleState`) o el contrato de `QueryStateFeedbackConfig`.
  - Añadir texto `sr-only` automático: el contenido visible o invisible del fallback sigue siendo responsabilidad del config del operador.
  - Tocar `visibility` o el modo `hide` (el wrapper ARIA solo aplica al modo `fallback`).
  - Añadir un rol al estado `idle`, `empty` o `success`.
  - Cambiar cómo se preserva la semántica de iteración o de grid (`getGridChildSpanClassName`); el wrapper ARIA es ortogonal al wrapping de grid.
- **Dependencias**: ninguna estricta sobre T1–T3.
- **Impacto esperado en archivos**:
  - Código:
    - `src/runtime/layout-node-renderer.tsx` — cuando `resolvedVisibility.mode === 'fallback'`, distinguir el `visibleState` del feedback (`loading` o `error`) para envolver el `<LayoutRenderer ... />` resultante en un `<div>` (o el elemento neutro mínimo) con `role="status"` o `role="alert"` según corresponda. Para `idle`/`empty`/`success` con `mode: 'fallback'` (caso explícitamente configurado por el operador), renderizar el fallback sin envoltorio ARIA, igual que hoy.
    - Para que el renderer sepa el `visibleState` del fallback, `resolveLayoutNodeVisibility` debe exponerlo cuando `mode === 'fallback'`. Extender `ResolvedLayoutNodeVisibility` (rama `fallback`) en `src/runtime/runtime-layout-visibility.ts` con un campo `visibleState: RuntimeQueryVisibleState` y propagarlo desde `resolveLayoutNodeFeedback`.
    - `src/runtime/runtime-query-state-feedback.ts` — ya expone `visibleState` en `ResolvedQueryStateFeedback`; no requiere cambios. Solo verificar que el campo se reusa tal cual.
  - Tests:
    - `src/tests/layout-renderer/layout-renderer-state-feedback.test.tsx` (ampliación).
  - Documentación: `ai-workflow/docs/app-features/queries/feedback.md` (impacto declarado, cierre documental en T6).
- **Tests**:
  - Ficheros de test:
    - `src/tests/layout-renderer/layout-renderer-state-feedback.test.tsx` (ampliación)
  - Comportamiento cubierto:
    - Cuando un nodo se sustituye por su fallback de `loading`, los nodos de fallback aparecen dentro de un elemento contenedor con `role="status"` (verificable vía `getByRole('status')`).
    - Cuando un nodo se sustituye por su fallback de `error`, los nodos de fallback aparecen dentro de un elemento contenedor con `role="alert"` (verificable vía `getByRole('alert')`).
    - Cuando un nodo se sustituye por su fallback de `idle`, `empty` o `success`, los nodos de fallback se renderizan sin envoltorio ARIA (no aparece `role="status"` ni `role="alert"` adicional sobre ellos).
    - Un fallback con varios nodos hijos comparte un único wrapper con el rol correspondiente (no se duplica un rol por hijo).
    - Un fallback con colección vacía (`fallback: []`) sigue siendo válido: el wrapper con `role="status"`/`role="alert"` puede quedar vacío sin romper el render.
    - El test existente que confirma la sustitución por fallback durante `loading`, `error`, `empty` e `idle` sigue verde tras añadir las aserciones de rol.
  - Comandos durante la implementación:
    - `pnpm test --run src/tests/layout-renderer/layout-renderer-state-feedback.test.tsx`
  - Restricciones:
    - Reusar el harness de `searchUsers` y los botones `Set loading`/`Set error` ya presentes en el fichero.
    - El wrapper ARIA debe ser un elemento neutro (`<div>`); no introducir un nuevo `data-layout-node`. Si se añade un `data-testid`, hacerlo solo para localizar el wrapper sin pisar identificadores existentes.
- **Documentación afectada**: `ai-workflow/docs/app-features/queries/feedback.md` (impacto declarado, cierre documental en T6).
- **Criterios de finalización**:
  - Los fallbacks de `loading` y `error` se envuelven exactamente con el rol ARIA correspondiente.
  - Los otros estados (`idle`, `empty`, `success`) renderizan el fallback sin wrapper ARIA.
  - El contrato externo de `QueryStateFeedbackConfig` no cambia.
  - Los tests nuevos pasan junto con los existentes del fichero.
- **Cierre de implementación**: T4 cierra cuando los tests indicados están verdes y la suite completa sigue verde.
- **Cierre documental**: diferido a T6.

---

## T5 — Navegación entre páginas: foco programático al `<section>` de la página

- **ID**: T5
- **Estado**: done
- **Objetivo**: Que el contenedor `<section>` de la página renderizada por `RuntimePage` lleve `tabIndex={-1}` y reciba foco programático cada vez que cambia la página renderizada, ya sea por cambio de `pageId` o por una nueva `pageEntry` sobre la misma página (preloads, params distintos, navegación que vuelve a la misma página). La `<section>` vacía del caso `page === null` no recibe foco.
- **Fuera de alcance**:
  - Cambiar la estructura del shell de la aplicación o el orden de tabulación natural.
  - Mover el foco a un heading concreto o a un elemento interactivo dentro de la página (queda fuera; el contrato es mover el foco al `<section>` contenedor).
  - Sincronización con el hash o el historial del navegador (ya existe y no se altera).
  - Modificar la lógica de preloads o de `pageEntry` más allá de leer su `entryId` para disparar el efecto de foco.
- **Dependencias**: ninguna estricta. Puede ir en paralelo con T1–T4, pero el orden de ejecución acordado es T5 después de T4 para minimizar conflictos en `runtime-page.tsx` y mantener el plan secuencial.
- **Impacto esperado en archivos**:
  - Código:
    - `src/runtime/runtime-page.tsx` — añadir `tabIndex={-1}` al `<section>` cuando se renderiza una página (caso no nulo). Añadir un `useRef<HTMLElement | null>` al `<section>` y un `useEffect` que dispare `.focus({ preventScroll: false })` cuando cambien `page?.id` o `state.pageEntry.entryId`. El caso `page === null` retorna antes y no aplica el efecto. El `<section>` vacío del caso nulo no necesita `tabIndex`.
  - Tests:
    - `src/tests/runtime-state/runtime-state-navigation.test.tsx` (ampliación).
  - Documentación: `ai-workflow/docs/app-features/navigation/page-model.md` (impacto declarado, cierre documental en T6).
- **Tests**:
  - Ficheros de test:
    - `src/tests/runtime-state/runtime-state-navigation.test.tsx` (ampliación)
  - Comportamiento cubierto:
    - Tras renderizar una página inicial (`pageId` resuelto), el `<section data-testid="runtime-page">` tiene `tabIndex={-1}` y recibe foco (`document.activeElement === <section>`).
    - Tras una acción `navigateToPage('details')` desde otra página, el nuevo `<section>` recibe foco (`document.activeElement` es el `<section>` con `data-runtime-page-id="details"`).
    - Tras una acción `navigateToPage('details', { userId: '42' })` que entra a `details` desde `details` con params distintos (cambio de `pageEntry.entryId` sin cambio de `pageId`), el `<section>` recibe foco de nuevo.
    - El caso `page === null` (sin `pageId` resuelto) renderiza un `<section>` vacío sin `tabIndex` y sin foco programático; ningún efecto rompe el render.
    - Un test de regresión confirma que tras la navegación, los datos visibles de la nueva página siguen siendo los esperados (no hay regresión en el contenido o en el estado del store).
  - Comandos durante la implementación:
    - `pnpm test --run src/tests/runtime-state/runtime-state-navigation.test.tsx`
  - Restricciones:
    - Reusar los helpers existentes del fichero (`readRuntimeStateSnapshot`, los fixtures de navegación con `navigateToPage` y `goBackPage`).
    - Las aserciones de foco se hacen sobre `document.activeElement` y/o `getByTestId('runtime-page')` con `toHaveFocus()` de `@testing-library/jest-dom`.
    - No introducir esperas artificiales (`setTimeout`); el efecto se dispara en montaje/actualización, así que basta con esperar al render React (`await screen.findBy...` o `await waitFor(...)`).
- **Documentación afectada**: `ai-workflow/docs/app-features/navigation/page-model.md` (impacto declarado, cierre documental en T6).
- **Criterios de finalización**:
  - El `<section>` de la página renderizada lleva `tabIndex={-1}` y recibe foco al cambiar de página o de `pageEntry`.
  - El `<section>` del caso `page === null` no se ve afectado.
  - Toda la suite del proyecto pasa (`pnpm test`) cumpliendo el umbral global de cobertura del 80% sobre `src/`.
- **Cierre de implementación**: T5 cierra cuando los tests indicados están verdes, la suite completa pasa y se respeta el umbral global de cobertura.
- **Cierre documental**: diferido a T6.

---

## T6 — Documentación funcional de la feature

- **ID**: T6
- **Estado**: done
- **Objetivo**: Reflejar el comportamiento estable de la feature en la documentación funcional y registrar la feature en los índices que correspondan.
- **Fuera de alcance**:
  - Modificar código de runtime ni de validación.
  - Reabrir decisiones de producto: el contrato es el cerrado en `spec.md`.
  - Tocar `README.md` (entrada breve, no historial).
- **Dependencias**: T1, T2, T3, T4 y T5 con cierre de implementación verde.
- **Impacto esperado en archivos**:
  - Código: ninguno.
  - Tests: ninguno.
  - Documentación:
    - `ai-workflow/docs/app-features/nodes/modal.md` — incorporar:
      - el `role="dialog"` y `aria-modal="true"` en el panel;
      - el nuevo `props.label` opcional (string), con fallback `aria-label="Diálogo"` cuando no se declara.
    - `ai-workflow/docs/app-features/nodes/input.md` — incorporar la generación de `id` estable en el control y la vinculación de error vía `aria-describedby` cuando hay error activo.
    - `ai-workflow/docs/app-features/nodes/textarea.md` — análogo a `input.md`.
    - `ai-workflow/docs/app-features/nodes/select.md` — análogo a `input.md`, y explicitar que el `<select>` ya no lleva `aria-label` redundante porque la asociación se hace vía `<label>` wrapper.
    - `ai-workflow/docs/app-features/nodes/choice-groups.md` — incorporar la vinculación de error vía `aria-describedby` sobre el `<fieldset>` cuando hay error activo.
    - `ai-workflow/docs/app-features/queries/feedback.md` — incorporar que el renderer envuelve el fallback de `loading` con `role="status"` y el de `error` con `role="alert"`; los demás estados no llevan rol especial.
    - `ai-workflow/docs/app-features/navigation/page-model.md` — incorporar que al cambiar de página o de `pageEntry`, el runtime mueve el foco al `<section>` contenedor (con `tabIndex={-1}`).
    - `ai-workflow/features/index.md` — registrar la feature 0046 en el índice.
    - `ai-workflow/docs/current-state.md` — actualizar el estado vigente del área "Catálogo de nodos" y/o "Accesibilidad" solo si la última feature relevante referenciada cambia con 0046; si no, dejarlo explícito como sin cambios.
- **Tests**:
  - Ficheros: ninguno; cubierto por T1–T5.
  - Comportamiento cubierto: ninguno propio de esta tarea; la verificación funcional vive en las suites de T1–T5.
  - Comandos durante la implementación: ninguno; tarea exclusivamente documental.
  - Restricciones: mantener el estilo y tamaño de las fichas actuales; no convertir ninguna ficha en changelog. Cada ficha integra el nuevo comportamiento en la sección que corresponda (`Contrato`, `Reglas de render`, `Casos límite`), no como anexo.
- **Documentación afectada**: ver arriba.
- **Criterios de finalización**:
  - Las siete fichas funcionales describen el nuevo contrato de forma consistente entre sí y con `spec.md`.
  - El índice de features y el estado vigente reflejan la feature.
  - `status.yaml` queda en estado terminal documental coherente (`documentation.done: true`, `feature_status: completed`).
- **Cierre de implementación**: ninguno propio; T6 no toca código.
- **Cierre documental**: T6 cierra cuando las entradas documentales arriba listadas quedan revisadas y actualizadas según el contrato cerrado en T1–T5.

---

## Siguiente tarea sugerida
T1. Es la única tarea de la fase con cambios en validación Zod y contrato de nodo; cerrarla primero evita conflictos con el resto del runtime. El orden recomendado de ejecución es T1 → T2 → T3 → T4 → T5 → T6.
