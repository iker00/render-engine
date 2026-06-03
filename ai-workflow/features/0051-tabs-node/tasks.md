# Plan de implementación: `tabs` node (0051)

## Resumen

Tres tareas secuenciales:
1. Contrato de tipos y esquema Zod para el nodo `tabs`.
2. Validación previa al render en `src/config/`.
3. Componente React y registro en el dispatcher central.

Cada tarea cierra su implementación con tests en verde antes de pasar a la siguiente.

---

## T01 — Tipos TypeScript y esquema Zod del nodo `tabs`

**Estado:** completada

**Objetivo:**
Añadir el tipo `TabsLayoutNode` a `src/config/runtime-config-types.ts` y el esquema Zod `tabsNodeSchema` a `src/config/runtime-config-zod.ts`, incluyendo `tabs` en `supportedNodeTypes` y en el union `LayoutNode`.

**Fuera de alcance:**
- Validación cruzada de `props.items` (T02).
- Componente React y registro en el dispatcher (T03).
- Cambios en `layout-renderer.tsx` o `layout-node-renderer.tsx`.

**Dependencias:** ninguna.

**Impacto esperado en archivos:**
- `src/config/runtime-config-types.ts` — añadir `TabsLayoutNode`, `TabsOrientation`, `TabsItem`; añadir `'tabs'` al union `LayoutNode`; añadir `'tabs'` al tipo `LayoutNodeType`.
- `src/config/runtime-config-zod.ts` — añadir `tabsNodeSchema`; añadir `'tabs'` a `supportedNodeTypes`.
- `src/tests/config-validation/runtime-config-root-zod.test.ts` — ampliación con caso de aceptación básico del schema Zod (nuevo tipo presente en union).

**Tests:**

**Ficheros de test:**
- `src/tests/config-validation/runtime-config-root-zod.test.ts` (ampliación) — verifica que `tabsNodeSchema` parsea un nodo mínimo válido y rechaza uno inválido a nivel de schema.

**Comportamiento cubierto:**
- `tabsNodeSchema.safeParse` acepta `{ type: 'tabs', props: { items: [{ label: 'Tab 1', children: [] }] } }` y devuelve `success: true`.
- `tabsNodeSchema.safeParse` acepta el nodo anterior con `props.orientation: 'horizontal'` y `props.defaultTab: 0`.
- `tabsNodeSchema.safeParse` acepta el nodo anterior con `props.orientation: 'vertical'`.
- `tabsNodeSchema.safeParse` rechaza un nodo sin `props.items` con `success: false`.
- `tabsNodeSchema.safeParse` rechaza un nodo con `props.items: []` (array vacío) con `success: false`.
- `tabsNodeSchema.safeParse` rechaza un item de `props.items` sin `label` con `success: false`.
- `tabsNodeSchema.safeParse` rechaza `props.orientation` con un valor fuera del catálogo `"horizontal" | "vertical"` con `success: false`.
- `'tabs'` está presente en `supportedNodeTypes`.

**Comandos durante la implementación:**
```
pnpm test --run src/tests/config-validation/runtime-config-root-zod.test.ts
```

**Restricciones:**
- El esquema `tabsNodeSchema` debe usar `.strip()` igual que el resto de esquemas de nodo en `runtime-config-zod.ts`.
- El campo `props.items` debe ser un array no vacío (usar `z.array(...).min(1)`); cada item tiene `label: z.string()` y `children: z.array(z.unknown()).optional()`.
- `props.orientation` es un `z.enum(['horizontal', 'vertical']).optional()`.
- `props.defaultTab` es un `z.number().int().min(0).optional()`.
- El esquema `tabsNodeSchema` incluye los campos transversales estándar: `id`, `queryStateFeedback`, `visibility`, `layout`.

**Criterios de finalización:**
- `tabsNodeSchema` exportado desde `runtime-config-zod.ts`.
- `TabsLayoutNode` exportado desde `runtime-config-types.ts` con `type: 'tabs'`, `id?`, `props: { orientation?, defaultTab?, items: TabsItem[] }`, `children?: never`, y los campos transversales `queryStateFeedback?`, `visibility?`, `layout?`.
- `'tabs'` en el array `supportedNodeTypes`.
- `LayoutNode` incluye `TabsLayoutNode` en su union.
- Los tests de `runtime-config-root-zod.test.ts` pasan.

**Cierre de implementación:** código en `runtime-config-types.ts` y `runtime-config-zod.ts` completos, tests de T01 en verde, `pnpm test` pasa el umbral global.

**Documentación afectada:** ninguna en esta tarea (la ficha `nodes/tabs.md` se actualizará al invocar `update-app-documentation`).

---

## T02 — Validación previa al render del nodo `tabs`

**Estado:** completada

**Objetivo:**
Implementar `validateTabsNode` en `src/config/validate-layout-nodes.ts` y conectarla al dispatcher `validateLayoutNode`. La validación debe rechazar contratos inválidos con ruta diagnóstica explícita y validar recursivamente los `children` de cada item como colecciones de nodos.

**Fuera de alcance:**
- Componente React (T03).
- Cambios en el dispatcher de render.

**Dependencias:** T01 completa (tipos y schema Zod disponibles).

**Impacto esperado en archivos:**
- `src/config/validate-layout-nodes.ts` — añadir `validateTabsNode`; añadir `case 'tabs'` en el switch de `validateLayoutNode`; añadir importación de `tabsNodeSchema` y `TabsLayoutNode`.
- `src/config/runtime-config-types.ts` — posible ajuste menor de tipo si se necesita `TabsItem` con `children: LayoutNode[]` (normalizado).
- `src/tests/config-validation/runtime-config-validation-tabs.test.ts` (nuevo) — tests de validación de `validateRuntimeConfig` para el nodo `tabs`.

**Tests:**

**Ficheros de test:**
- `src/tests/config-validation/runtime-config-validation-tabs.test.ts` (nuevo) — cubre toda la validación del nodo `tabs` via `validateRuntimeConfig`.

**Comportamiento cubierto:**
- Acepta un nodo `tabs` en el root layout con `props.items` de un único item con `label` y sin `children`.
- Acepta un nodo `tabs` con `orientation: 'horizontal'`.
- Acepta un nodo `tabs` con `orientation: 'vertical'`.
- Acepta un nodo `tabs` con `defaultTab: 1` (índice válido dentro del array).
- Acepta un nodo `tabs` con `children` en un item que son nodos válidos del catálogo (`heading`, `paragraph`, `container`, `form`).
- Acepta un nodo `tabs` dentro de `container.children`.
- Acepta un nodo `tabs` con `visibility`, `queryStateFeedback` y `layout.span` válidos aplicados al nodo raíz.
- Rechaza un nodo `tabs` sin `props.items` con código `'invalid-layout'` y ruta que incluye `props.items`.
- Rechaza un nodo `tabs` con `props.items: []` con código `'invalid-layout'` y ruta que incluye `props.items`.
- Rechaza un item de `props.items` sin `label` con código `'invalid-layout'` y ruta que incluye el índice del item y `.label`.
- Rechaza `props.orientation` con valor `'diagonal'` con código `'invalid-layout'` y ruta que incluye `props.orientation`.
- Rechaza `children` de un item que contiene un nodo con tipo desconocido con código `'unsupported-node-type'`.
- Rechaza `children` de un item que contiene un nodo inválido (p. ej. `input` fuera de `form`) con código `'invalid-layout'`.

**Comandos durante la implementación:**
```
pnpm test --run src/tests/config-validation/runtime-config-validation-tabs.test.ts
```

**Restricciones:**
- `validateTabsNode` debe seguir el mismo patrón que `validateContainerNode` y `validateModalNode`: `safeParse` primero, luego validar `queryStateFeedback`, `visibility`, y finalmente la parte específica del nodo.
- Los `children` de cada item se validan recursivamente llamando a `validateLayoutCollection` con ruta `${path}.props.items[${index}].children`.
- No se añade un allowlist de tipos de children para el nodo `tabs` (admite cualquier nodo válido del catálogo, igual que `container`).
- Los mensajes de error deben seguir el patrón `Page "${pageId}" has an invalid layout at "${path}..."`.
- Reusar `helpers.ts` de `src/tests/config-validation/` para la creación de fixtures.

**Criterios de finalización:**
- `validateTabsNode` implementada y conectada al dispatcher.
- `case 'tabs'` presente en el switch de `validateLayoutNode`.
- Los tests de `runtime-config-validation-tabs.test.ts` pasan.
- `pnpm test` pasa el umbral global.

**Cierre de implementación:** función `validateTabsNode` implementada y conectada, todos los tests de T02 en verde, `pnpm test` pasa el umbral global.

**Documentación afectada:** `ai-workflow/docs/app-features/config/validation.md` (se verá afectada al invocar `update-app-documentation`).

---

## T03 — Componente React y registro en el dispatcher de render

**Estado:** completada

**Objetivo:**
Crear el componente `TabsNode` en `src/runtime/nodes/tabs-layout-node.tsx` y registrarlo en `layout-node-renderer.tsx` (switch y import). El componente gestiona el estado local del tab activo, aplica `orientation` para la posición de la barra de tabs, interpola los `label` de cada item usando `resolveRuntimeTextReference`, y llama a `LayoutRenderer` internamente sobre `item.children` del tab activo.

`layout-renderer.tsx` NO debe incluir `'tabs'` en `hasChildren`: el nodo `tabs` no recibe `renderedChildren` del dispatcher porque cada item tiene su propio array de children; el componente los renderiza internamente. `getLayoutNodeKey` no requiere cambio porque el fallback genérico `${node.type}-${index}` ya aplica.

**Fuera de alcance:**
- Validación del contrato (T01, T02 ya cierran esto).
- Vinculación del tab activo a referencias declarativas del runtime.
- Persistencia del tab activo.

**Dependencias:** T01 y T02 completas.

**Impacto esperado en archivos:**
- `src/runtime/nodes/tabs-layout-node.tsx` (nuevo) — componente `TabsNode`.
- `src/runtime/layout-node-renderer.tsx` — añadir `import { TabsNode }`, añadir `case 'tabs'` en el switch; `tabs` NO recibe `renderedChildren`, lo que es coherente con el patrón de `RepeaterNode`.
- `src/runtime/layout-renderer.tsx` — sin cambios: `hasChildren` no incluye `'tabs'` porque el componente llama a `LayoutRenderer` internamente; `getLayoutNodeKey` ya cubre el fallback genérico.
- `src/tests/layout-renderer/layout-renderer-tabs.test.tsx` (nuevo) — tests de render del nodo `tabs`.

**Tests:**

**Ficheros de test:**
- `src/tests/layout-renderer/layout-renderer-tabs.test.tsx` (nuevo) — cubre el comportamiento de render del nodo `tabs`.

**Comportamiento cubierto:**
- Un nodo `tabs` con `orientation: 'horizontal'` renderiza la barra de tabs encima del panel activo; la barra aparece antes del panel en el DOM (`data-layout-node="tabs-bar"` antes de `data-layout-node="tabs-panel"`).
- Un nodo `tabs` con `orientation: 'vertical'` renderiza la barra de tabs a la izquierda del panel activo; el contenedor raíz tiene una clase Tailwind de flex en fila.
- Cuando no se declara `orientation`, el comportamiento es idéntico a `orientation: 'horizontal'`.
- Al montar, el panel activo es el del índice `0` si no se declara `defaultTab`.
- `props.defaultTab: 1` hace que el segundo tab sea el activo al montar.
- Solo el panel del tab activo está presente en el DOM; los demás no se renderizan.
- Al hacer clic en un tab de la barra, el panel correspondiente pasa a ser el activo y el anterior desaparece del DOM.
- Un `label` con `{{queries.someQuery.data.title}}` resuelve la referencia usando el runtime (simular estado con el valor resuelto y verificar que el label se renderiza con ese valor).
- Los `children` del tab activo se renderizan correctamente (un `heading` en el panel activo aparece en el DOM).
- Si `props.defaultTab` apunta a un índice fuera de rango, el primer tab (índice 0) es el activo.
- Si `props.items` es un array vacío (caso límite, validación lo rechaza pero el runtime degrada silenciosamente), no se renderiza nada.
- `visibility` aplicado al nodo `tabs` con condición falsa oculta el nodo entero (barra + panel).
- `queryStateFeedback` aplicado al nodo `tabs` en estado `loading` sustituye el nodo entero por el fallback de loading.
- `layout.span` aplicado al nodo `tabs` dentro de un `container` con `columns` produce el wrapper `col-span-*` esperado.
- Un nodo `tabs` dentro de un `form` se renderiza correctamente (el componente acepta el `FormContextProvider` del ancestro sin error).
- El botón de tab activo recibe un atributo visual diferenciador (p. ej. clase CSS o `aria-selected="true"`) respecto a los inactivos.

**Comandos durante la implementación:**
```
pnpm test --run src/tests/layout-renderer/layout-renderer-tabs.test.tsx
```

**Restricciones:**
- El componente `TabsNode` usa `useState` de React para el estado local del tab activo; no usa `useRuntimeState` ni ningún store compartido para este estado.
- Los labels se resuelven con `resolveRuntimeTextReference` igual que `HeadingNode` y `ParagraphNode`.
- Los `children` de cada item se pasan al `LayoutRenderer` como `nodes={item.children ?? []}`.
- El nodo raíz del componente lleva `data-layout-node="tabs"`.
- Los elementos de la barra de tabs son `<button>` con `type="button"`.
- Las clases Tailwind se aplican mediante utilidades de `runtime-node-styling.ts` o directamente en el componente (no se añaden estilos inline).
- No se añaden snapshots.
- Reusar el patrón de `renderRuntimePage` de los ficheros de test existentes en `layout-renderer/`.

**Criterios de finalización:**
- `tabs-layout-node.tsx` implementado con gestión de estado local y render condicional del panel.
- `layout-node-renderer.tsx` actualizado con `case 'tabs'` (sin `renderedChildren`).
- `layout-renderer.tsx` sin cambios estructurales respecto a `hasChildren` ni `getLayoutNodeKey`.
- Los tests de `layout-renderer-tabs.test.tsx` pasan.
- `pnpm test` pasa el umbral global.

**Cierre de implementación:** componente `TabsNode` implementado y registrado, todos los tests de T03 en verde, `pnpm test` pasa el umbral global.

**Documentación afectada:** `ai-workflow/docs/app-features/nodes/index.md` y nueva ficha `ai-workflow/docs/app-features/nodes/tabs.md` (se actualizarán al invocar `update-app-documentation`).
