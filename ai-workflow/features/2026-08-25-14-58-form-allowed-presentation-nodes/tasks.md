# Tasks: nodos de presentación pura permitidos dentro de `form`

## Orden de ejecución
Una única tarea (`T1`), sin dependencias.

---

## T1 — Añadir `alert`, `badge`, `stat` y `skeleton` a los descendientes permitidos de `form`

### Objetivo
Ampliar la lista cerrada de tipos de nodo permitidos como descendientes de un `form` (`FORM_ALLOWED_DESCENDANT_TYPES` en `src/config/layout-placement-rules.ts`) para incluir `alert`, `badge`, `stat` y `skeleton`, actualizar el mensaje de error de validación que enumera esa lista, y cubrir con tests tanto la aceptación en todos los contextos descritos en la spec (hijo directo, anidado en `container`/`accordion`/`tabs`, y como `queryStateFeedback.states.*.fallback` de cualquier nodo del subárbol de un `form`) como la ausencia de regresión sobre los tipos que se siguen rechazando (`map`, `link`, `repeater`, `modal`, `fileManager`, tipos inventados).

### Fuera de alcance
- Añadir `map` o `link` a la lista permitida.
- Cualquier cambio de props, shape Zod, render o comportamiento propio de `alert`, `badge`, `stat` o `skeleton`.
- Cambios en el subconjunto de tipos permitidos en celdas ricas de `table`.
- Cambios en la semántica general de `queryStateFeedback` o `visibility`.
- Escribir o actualizar `ai-workflow/docs/app-features/`; queda declarado en "Documentación afectada" para `update-app-documentation`.

### Dependencias
Ninguna. Es la única tarea de la feature.

### Interfaces
**Consume:** ninguno.
**Produce:** ninguno (no se expone ninguna firma nueva reutilizable; el cambio es una ampliación de un `Set` y una constante de mensaje ya existentes, sin cambio de forma).

### Impacto esperado en archivos

**Código a modificar:**
- `src/config/layout-placement-rules.ts` — en la constante `FORM_ALLOWED_DESCENDANT_TYPES` (líneas 34-52 actuales), añadir `'alert'`, `'badge'`, `'stat'` y `'skeleton'` al `Set`, a continuación de `'tabs'` (último elemento actual), en ese orden.
- `src/config/validate-form-semantics.ts` — en la función `validateFormChildren`, actualizar el literal del mensaje de error (línea ~308, dentro del bloque `if (!FORM_ALLOWED_DESCENDANT_TYPES.has(node.type))`) para que enumere la lista ampliada. El nuevo mensaje debe ser exactamente:
  ```
  `Page "${pageId}" has an invalid layout at "${nodePath}": form nodes only accept input, textarea, select, radioGroup, checkboxGroup, fileInput, toggle, hidden, button, heading, paragraph, image, table, container, accordion, divider, tabs, alert, badge, stat and skeleton descendants.`
  ```
  (cambia únicamente el tramo final, de `"...divider and tabs descendants."` a `"...divider, tabs, alert, badge, stat and skeleton descendants."`).

No se requiere ningún otro cambio de código: `src/dev-runtime/layout-canvas/layout-drop-validity.ts` consume `FORM_ALLOWED_DESCENDANT_TYPES` directamente y hereda el comportamiento ampliado sin modificación; `validateFallbackCollections` en `validate-form-semantics.ts` ya aplica `validateFormChildren` de forma genérica a cualquier `queryStateFeedback.states.*.fallback` dentro del subárbol de un `form`, a cualquier profundidad, sin cambios adicionales; ninguno de los cuatro nodos tiene entrada en `FORM_ONLY_LEAF_NODE_TYPES` y no deben añadirse a ella.

**Tests a crear o modificar:**
- `src/tests/config-validation/layout-placement-rules.test.ts` (ampliación)
- `src/tests/config-validation/runtime-config-validation-forms-semantics.test.ts` (ampliación)
- `src/tests/config-validation/runtime-config-validation-form-fields.test.ts` (ampliación)
- `src/tests/dev-runtime/layout-canvas-drop-validity.test.ts` (ampliación)
- `src/tests/layout-renderer/layout-renderer-badge.test.tsx` (ampliación)
- `src/tests/layout-renderer/layout-renderer-skeleton.test.tsx` (ampliación)

**Documentación afectada** (no se actualiza en esta tarea; declarado para `update-app-documentation`):
- `ai-workflow/docs/app-features/nodes/form.md`: la lista de `children` soportados (contrato del nodo, línea 19) y la regla de "Validación específica" (línea 37) deben incluir `alert`, `badge`, `stat` y `skeleton`.
- `ai-workflow/docs/app-features/config/validation.md`: la regla en "Validación estructural global" (línea 22, `Si form.children contiene nodos fuera de...`) debe reflejar la lista ampliada.
- `ai-workflow/docs/app-features/nodes/skeleton.md`: añadir una entrada equivalente a la ya existente en `alert.md`/`badge.md`/`stat.md` ("`skeleton` dentro de `form`: válido. No participa en validación ni submit del formulario...").

### Tests

**Ficheros de test:**
- `src/tests/config-validation/layout-placement-rules.test.ts` (ampliación)
- `src/tests/config-validation/runtime-config-validation-forms-semantics.test.ts` (ampliación)
- `src/tests/config-validation/runtime-config-validation-form-fields.test.ts` (ampliación)
- `src/tests/dev-runtime/layout-canvas-drop-validity.test.ts` (ampliación)
- `src/tests/layout-renderer/layout-renderer-badge.test.tsx` (ampliación)
- `src/tests/layout-renderer/layout-renderer-skeleton.test.tsx` (ampliación)

**Comportamiento cubierto:**

En `layout-placement-rules.test.ts`:
- El test `describe('FORM_ALLOWED_DESCENDANT_TYPES')` → `it('rejects types that are not valid inside a form')` deja de afirmar `FORM_ALLOWED_DESCENDANT_TYPES.has('badge')`, `.has('alert')`, `.has('stat')` y `.has('skeleton')` como `false` (eliminar esas cuatro aserciones; mantener las de `repeater`, `fileManager`, `list`, `link` y `modal` como `false`, que no cambian).
- El test `it('accepts exactly the 17 types documented as valid form descendants')` se renombra a `it('accepts exactly the 21 types documented as valid form descendants')`, añade `'alert'`, `'badge'`, `'stat'` y `'skeleton'` al array `expected` (en ese orden, al final) y cambia `expect(FORM_ALLOWED_DESCENDANT_TYPES.size).toBe(17)` por `.toBe(21)`.

En `runtime-config-validation-forms-semantics.test.ts`:
- Las dos ocurrencias del mensaje de error antiguo (líneas ~275 y ~311, en `it('rejects unsupported form children and invalid submitAction or resetOnSuccess semantics')`, para los casos `list` y `repeater`) se actualizan al mensaje nuevo declarado en "Impacto esperado en archivos"; ninguna otra parte de esos dos casos cambia (`list` y `repeater` se siguen rechazando).
- Nuevo `it`: un `form` con `alert`, `badge`, `stat` y `skeleton` como hijos directos de `form.children` (los cuatro en el mismo array, junto a un campo de formulario existente) produce `status: 'ready'`. Usar `createConfigWithFormLayout({ children: [...] })`.
- Nuevo `it`: un `form` con un `container` que a su vez contiene un `skeleton` produce `status: 'ready'`.
- Nuevo `it`: un `form` con un `tabs` cuyo primer item (`props.items[0].children`) contiene un `badge` y un `stat` produce `status: 'ready'`.
- Nuevo `it`: un `form` cuyo propio nodo declara `queryStateFeedback: { query: 'someQuery', states: { loading: { mode: 'fallback', fallback: [{ type: 'skeleton' }] } } }` produce `status: 'ready'` y (en el mismo caso o en otro `it` separado) `states: { error: { mode: 'fallback', fallback: [{ type: 'alert', props: { type: 'danger', message: '...' } }] } }` también produce `status: 'ready'`.
- Nuevo `it`: un `form` con `map` como hijo directo de `form.children` sigue rechazándose con `status: 'error'` y el mensaje de la lista ampliada (mismo formato que los casos `list`/`repeater` ya existentes); igual para `link` como hijo directo. Usar el `type: 'map'` y `type: 'link'` mínimos que ya validan su propio shape en otros tests de este repo (`props: { center: {...}, zoom: ... }` para `map`; `props: { href: '...' }` o `props: { action: {...} }` para `link` — consultar el shape exacto en `src/tests/config-validation/runtime-config-validation-map.test.ts` y `runtime-config-validation-buttons.test.ts` si hace falta un ejemplo mínimo válido en shape pero inválido en placement).
- Nuevo `it`: un `queryStateFeedback.states.error.fallback` dentro de un `form` que mezcla `[{ type: 'alert', props: { message: 'x' } }, { type: 'map', ... }]` produce `status: 'error'` señalando la ruta del elemento `map` (índice 1 del array `fallback`), no la de `alert`.

En `runtime-config-validation-form-fields.test.ts`:
- La única ocurrencia del mensaje de error antiguo (línea ~482, en `it('rejects unsupported form descendants after adding radioGroup and checkboxGroup')`, caso `list`) se actualiza al mensaje nuevo. No se añade ningún caso nuevo en este fichero.

En `layout-canvas-drop-validity.test.ts`:
- El `it('rejects list, link, modal, badge, alert, stat and skeleton dragged directly into a form')` se divide: se renombra a `it('rejects list, link and modal dragged directly into a form')` y conserva solo las aserciones de `PALETTE_LIST_PATH`, `LINK_PATH` y `PALETTE_MODAL_PATH` como `false`.
- Nuevo `it('accepts badge, alert, stat and skeleton dragged directly into a form')`: `dragIntoFormA(PALETTE_BADGE_PATH)`, `dragIntoFormA(PALETTE_ALERT_PATH)`, `dragIntoFormA(PALETTE_STAT_PATH)` y `dragIntoFormA(PALETTE_SKELETON_PATH)` devuelven `true`.
- Nuevo `it('accepts badge, alert, stat and skeleton dragged into a container nested inside a form')`: los mismos cuatro `PALETTE_*_PATH` arrastrados a `CONTAINER_IN_FORM_A_PATH` (mismo patrón que `isValidDropTarget(PAGE_LAYOUT, PALETTE_LIST_PATH, CONTAINER_IN_FORM_A_PATH, 0)` ya usado en el test contiguo) devuelven `true`.

En `layout-renderer-badge.test.tsx`:
- Nuevo `describe('BadgeNode — form integration')` con el mismo patrón que `describe('AlertNode — form integration')` en `layout-renderer-alert.test.tsx` (líneas 586-626): un `it` que verifica que un `badge` como hijo de un `form` renderiza `[data-layout-node="badge"]` en el DOM sin error, y otro `it` que verifica que ese `badge` no produce ninguna entrada en `state.forms[formId]` tras `createRuntimeState`.

En `layout-renderer-skeleton.test.tsx`:
- Nuevo `describe('SkeletonNode — form integration')` con el mismo patrón: un `it` que verifica que un `skeleton` como hijo de un `form` renderiza `[data-layout-node="skeleton"]` en el DOM sin error, y otro `it` que verifica que no produce ninguna entrada en `state.forms[formId]`.

**Comandos durante la implementación:**
```
pnpm test --run src/tests/config-validation/layout-placement-rules.test.ts
pnpm test --run src/tests/config-validation/runtime-config-validation-forms-semantics.test.ts
pnpm test --run src/tests/config-validation/runtime-config-validation-form-fields.test.ts
pnpm test --run src/tests/dev-runtime/layout-canvas-drop-validity.test.ts
pnpm test --run src/tests/layout-renderer/layout-renderer-badge.test.tsx
pnpm test --run src/tests/layout-renderer/layout-renderer-skeleton.test.tsx
```

**Restricciones:**
- No modificar `layout-renderer-alert.test.tsx` ni `layout-renderer-stat.test.tsx`: ya cubren la integración con `form` (describe `AlertNode — form integration` y equivalente en stat) y no cambian de comportamiento.
- No añadir aserciones sobre `state.forms[formId]` ni sobre el payload de submit en `runtime-form-validations.test.ts` ni en ningún test de `src/tests/runtime/runtime-form-*`: los cuatro nodos no son campos de formulario (no tienen `fieldId`) y su no-participación en el store de formulario ya está garantizada estructuralmente por no estar en `FORM_ONLY_LEAF_NODE_TYPES`; los dos `it` de "form integration" en renderer bastan como evidencia observable.
- Reutilizar `createConfigWithFormLayout` y `createFormNode` de `./helpers` en los nuevos casos de `runtime-config-validation-forms-semantics.test.ts`; no duplicar builders de config a mano.

### Criterios de finalización
- `FORM_ALLOWED_DESCENDANT_TYPES` incluye `alert`, `badge`, `stat` y `skeleton`.
- El mensaje de error de `validateFormChildren` enumera la lista ampliada tal cual se declara en este documento.
- Todos los criterios de aceptación de `spec.md` están cubiertos por al menos un test que pasa.
- Los seis ficheros de test listados pasan (`pnpm test --run <ruta>` en verde para cada uno).
- `pnpm test` global sigue en verde y el umbral de cobertura del 80% sobre `src/` se mantiene.
- No hay ninguna otra ocurrencia en `src/` del mensaje de error antiguo (`"...divider and tabs descendants."`) sin actualizar.

### Cierre de implementación
Código y tests de esta tarea completos y validados: los seis ficheros de test en verde, `pnpm test` global en verde y cobertura de `src/` sobre el umbral del 80%.
