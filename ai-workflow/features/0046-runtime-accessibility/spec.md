# Spec: Accesibilidad en nodos del runtime (0046)

## Objetivo

Garantizar que todos los nodos del runtime producen HTML accesible según el estándar interno `ai-workflow/standards/accessibility.md` (nivel objetivo WCAG 2.1 AA), corrigiendo los gaps existentes en semántica HTML, gestión de foco y anuncios para lectores de pantalla, sin cambiar ningún comportamiento funcional visible.

---

## Alcance

### Nodos auditados y con correcciones

**`modal`**
- Añadir `role="dialog"` y `aria-modal="true"` al contenedor del panel (actualmente es un `<div>` sin rol).
- Añadir `props.label` opcional al contrato del nodo modal (string). Si se declara, se aplica como `aria-label` del contenedor del diálogo. Si no se declara, el fallback es `aria-label="Diálogo"`.
- El foco trap y la gestión de foco (entrada/salida) ya están implementados; no requieren corrección.

**`input`, `textarea`, `select`**
- Los tres nodos usan `<label>` como wrapper implícito del control, lo que ya cubre la asociación label↔control.
- Añadir `id` generado al control (`${formId}-${fieldId}`) y `aria-describedby` apuntando al `id` del span de error cuando hay error activo.
- El span de error necesita un `id` correspondiente para ser referenciable.

**`radioGroup`, `checkboxGroup`**
- Ya usan `<fieldset>` + `<legend>`, lo cual es correcto.
- Añadir `aria-describedby` en el `<fieldset>` apuntando al `id` del span de error cuando hay error activo.
- El span de error necesita un `id` correspondiente.

**`select` (redundancia)**
- Eliminar el `aria-label` redundante actualmente presente en el `<select>` (ya tiene label vía wrapper `<label>`).

**Estados de query (`queryStateFeedback`)**
- Cuando el renderer muestra el fallback del estado `loading`, el nodo wrapper que contiene ese fallback debe incluir `role="status"` para anunciar al lector de pantalla que hay carga en curso.
- Cuando el renderer muestra el fallback del estado `error`, el nodo wrapper debe incluir `role="alert"` para que sea anunciado automáticamente.
- El texto del fallback puede ser visualmente visible o estar oculto con `sr-only`; eso depende del config del operador. Lo que garantiza el runtime es el rol ARIA correcto en el wrapper.
- Los estados `idle`, `empty` y `success` no requieren rol ARIA especial.

**Navegación entre páginas**
- Al navegar a una página distinta (cambio de `pageId` o nueva `pageEntry`), el runtime debe mover el foco al contenedor `<section>` de la página nueva.
- El `<section>` necesita `tabIndex={-1}` para ser focalizable programáticamente sin entrar en el orden de tabulación natural.

### Nodos sin correcciones necesarias

| Nodo | Estado actual | Motivo |
|---|---|---|
| `button` | Correcto | Siempre `<button type="button">` o `<button type="submit">` |
| `heading` | Correcto | Usa `h1`–`h6` real según `props.level` |
| `list` | Correcto | `<ul>` + `<li>` semánticos |
| `image` | Correcto | `<img alt="">` con alt siempre presente |
| `radioGroup` | Parcialmente correcto | `<fieldset>` + `<legend>` ya presentes; solo falta `aria-describedby` en error |
| `checkboxGroup` | Ídem | Ídem |

---

## Fuera de alcance

- Nodo `link`: no existe en el catálogo actual; su accesibilidad se tratará cuando se implemente.
- Estado `disabled` en `button`: el contrato actual del nodo no incluye un campo `disabled`; queda fuera de esta feature.
- Verificación automática de ratio de contraste en CI.
- Live regions complejas para actualizaciones parciales de contenido (más allá de los estados de query ya definidos).
- Soporte completo de patrones ARIA Authoring Practices (grids, tree views, carousels).
- `aria-label` en botones solo-icono: el contrato actual de `button.props.label` ya obliga a un texto; el caso icono-sin-texto queda fuera hasta que se introduzca soporte de iconos.
- Jerarquía de headings: es responsabilidad del operador que configura el JSON; el runtime ya produce el tag correcto según `props.level`.

---

## Requisitos funcionales

### RF-01: Modal con rol de diálogo y nombre accesible

- El contenedor del panel del modal renderiza `role="dialog"` y `aria-modal="true"`.
- Si `modal.props.label` está declarado, se aplica como `aria-label` del panel.
- Si `modal.props.label` no está declarado, se aplica `aria-label="Diálogo"` como fallback.
- `props.label` es opcional en el contrato del nodo; no rompe configuraciones existentes.

### RF-02: Errores de formulario vinculados vía `aria-describedby`

- En `input`, `textarea` y `select`: cuando hay error activo, el control (`<input>`, `<textarea>`, `<select>`) incluye `aria-describedby` apuntando al `id` del span de error. Cuando no hay error, el atributo no está presente.
- En `radioGroup` y `checkboxGroup`: cuando hay error activo, el `<fieldset>` incluye `aria-describedby` apuntando al `id` del span de error. Cuando no hay error, el atributo no está presente.
- Los IDs de error siguen el patrón `${formId}-${fieldId}-error`.

### RF-03: Anuncios accesibles para estados de query

- El renderer que muestra el fallback del estado `loading` envuelve ese contenido en un elemento con `role="status"`.
- El renderer que muestra el fallback del estado `error` envuelve ese contenido en un elemento con `role="alert"`.
- Solo se envuelven los estados `loading` y `error`; los demás (`idle`, `empty`, `success`) no añaden rol ARIA al wrapper.

### RF-04: Foco al navegar entre páginas

- Cuando el runtime navega a una página (cambio de `pageId` o nueva `pageEntry`), se mueve el foco al `<section>` contenedor de la nueva página.
- El `<section>` tiene `tabIndex={-1}` para ser focalizable programáticamente.
- El `<section>` vacío (página `null`) no necesita recibir foco.

---

## Requisitos no funcionales

- Ninguna corrección debe alterar el comportamiento funcional visible del runtime (navegación, formularios, queries, modales siguen funcionando igual).
- El umbral de cobertura global del 80% sobre `src/` debe mantenerse al cierre de la implementación.
- Las correcciones deben usar HTML semántico preferiblemente sobre ARIA, tal como establece el estándar.
- Los IDs generados para `aria-describedby` deben ser estables y no depender de posición en el DOM (usar `formId` + `fieldId` como base).

---

## Criterios de aceptación

1. Un `modal` abierto en el DOM tiene `role="dialog"` y `aria-modal="true"` en su panel.
2. Un `modal` sin `props.label` tiene `aria-label="Diálogo"` en su panel.
3. Un `modal` con `props.label="Confirmar eliminación"` tiene `aria-label="Confirmar eliminación"` en su panel.
4. Un `input` con error activo tiene `aria-describedby` apuntando al span de error; sin error, el atributo no está presente.
5. Un `textarea` con error activo tiene `aria-describedby` apuntando al span de error; sin error, el atributo no está presente.
6. Un `select` con error activo tiene `aria-describedby` apuntando al span de error; sin error, el atributo no está presente.
7. Un `radioGroup` con error activo tiene `aria-describedby` en el `<fieldset>` apuntando al span de error; sin error, el atributo no está presente.
8. Un `checkboxGroup` con error activo tiene `aria-describedby` en el `<fieldset>` apuntando al span de error; sin error, el atributo no está presente.
9. El `<select>` no tiene `aria-label` redundante cuando ya tiene `<label>` wrapper.
10. El fallback del estado `loading` en `queryStateFeedback` está envuelto en un elemento con `role="status"`.
11. El fallback del estado `error` en `queryStateFeedback` está envuelto en un elemento con `role="alert"`.
12. Al navegar a una nueva página, el foco se mueve al `<section>` contenedor de esa página.
13. El `<section>` de la página tiene `tabIndex={-1}`.
14. Todos los tests relevantes pasan y la cobertura global se mantiene en ≥80%.

---

## Casos límite

- **Modal sin `props.label` y sin heading hijo**: el `aria-label="Diálogo"` garantiza nombre accesible siempre.
- **Modal dentro de `repeater`**: cada instancia de modal tiene su propio panel con `role="dialog"` y `aria-label`.
- **Campo con error que se limpia**: al limpiar el error, `aria-describedby` desaparece del control y el span de error no se renderiza.
- **`queryStateFeedback` con fallback vacío (`[]`)**: el wrapper con `role="status"` o `role="alert"` puede quedar vacío; esto es válido (el lector de pantalla no anuncia nada pero tampoco produce error).
- **Navegación a la misma página con nueva `pageEntry`**: el foco también debe moverse al `<section>`, porque el contenido puede haber cambiado (preloads, params distintos).
- **`section` vacío (página `null`)**: no recibe foco; el `if (page === null)` retorna antes.

---

## Áreas de producto afectadas

- `src/runtime/nodes/modal-layout-node.tsx` — añadir ARIA al panel
- `src/runtime/nodes/input-layout-node.tsx` — añadir `id` + `aria-describedby` en error
- `src/runtime/nodes/textarea-layout-node.tsx` — ídem
- `src/runtime/nodes/select-layout-node.tsx` — eliminar `aria-label` redundante, añadir `id` + `aria-describedby`
- `src/runtime/nodes/radio-group-layout-node.tsx` — añadir `aria-describedby` en fieldset
- `src/runtime/nodes/checkbox-group-layout-node.tsx` — ídem
- `src/runtime/layout-node-renderer.tsx` — envolver fallbacks de `loading`/`error` con rol ARIA
- `src/runtime/runtime-page.tsx` — añadir `tabIndex=-1` y gestión de foco al navegar
- `src/config/runtime-config.ts` (o esquema Zod) — añadir `props.label` opcional a `ModalLayoutNode`

## Documentación probablemente afectada

- `ai-workflow/docs/app-features/nodes/modal.md` — documentar `props.label`
- `ai-workflow/docs/app-features/queries/feedback.md` — documentar que loading/error llevan `role="status"`/`role="alert"` en el wrapper

---

## Riesgos o preguntas abiertas

Ninguno. Todas las decisiones de producto están cerradas.
