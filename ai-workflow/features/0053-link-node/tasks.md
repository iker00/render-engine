# Plan de implementación: `link` node (0053)

## Resumen

Cuatro tareas secuenciales: (1) tipos TypeScript + schema Zod, (2) validación de config en `src/config/`, (3) componente React + dispatcher, (4) tests de render. Las tareas 1 y 2 no generan cambios visibles en UI; las tareas 3 y 4 cierra el comportamiento observable.

---

## T1 — Tipos TypeScript y schema Zod para `link`

**Estado:** completed

**Objetivo:**
Añadir el tipo `LinkLayoutNode` a `runtime-config-types.ts`, incluirlo en el union `LayoutNode`, añadir `'link'` a `supportedNodeTypes` y crear el schema Zod `linkNodeSchema` en `runtime-config-zod.ts`. No incluye validación cruzada ni lógica de render.

**Fuera de alcance:**
- Validación semántica de props (href/action mutuamente excluyentes, pageId existente). Eso es T2.
- Componente React. Eso es T3.

**Dependencias:** ninguna

**Impacto esperado en archivos:**
- Código a modificar:
  - `src/config/runtime-config-types.ts` — añadir `LinkLayoutNode`, añadir `'link'` a `LayoutNodeType`, añadir `LinkLayoutNode` al union `LayoutNode`
  - `src/config/runtime-config-zod.ts` — añadir `'link'` al array `supportedNodeTypes`, exportar `linkNodeSchema`
  - `src/config/runtime-config.ts` — exportar `LinkLayoutNode` desde la fachada pública
- Tests a modificar:
  - `src/tests/config-validation/runtime-config-validation-buttons.test.ts` — (ampliación) añadir test de aceptación estructural básica de `link` con `href` literal
- Documentación afectada: ninguna en esta tarea

**Tests:**

- **Ficheros de test:**
  - `src/tests/config-validation/runtime-config-validation-buttons.test.ts` (ampliación) — verifica que el schema Zod acepta un `link` structuralmente válido con `props.href` y `props.label`

- **Comportamiento cubierto:**
  - Un nodo `{ type: 'link', props: { label: 'Go', href: 'https://example.com' } }` es aceptado por `validateRuntimeConfig` con status `'ready'`
  - El nodo normalizado tiene `type: 'link'`, `props.label` y `props.href` correctamente pasados en el resultado
  - Un nodo `link` sin `props.label` es rechazado con `invalid-layout`
  - Un nodo `link` sin ningún prop (`props: {}`) es rechazado con `invalid-layout`

- **Comandos durante la implementación:**
  - `pnpm test --run src/tests/config-validation/runtime-config-validation-buttons.test.ts`

- **Restricciones:**
  - Los casos de esta tarea solo cubren la aceptación estructural básica y rechazo por props obligatorias. La validación cruzada (href/action mutuamente excluyentes, download/target sin href, pageId inexistente) es responsabilidad de T2 y sus tests.

**Criterios de finalización:**
- `LinkLayoutNode` existe en `runtime-config-types.ts` con props: `label: string`, `href?: string`, `download?: string`, `target?: string`, `action?: NavigateToRuntimeUiAction | GoBackRuntimeUiAction`
- `LayoutNodeType` incluye `'link'`
- `LayoutNode` union incluye `LinkLayoutNode`
- `supportedNodeTypes` incluye `'link'`
- `linkNodeSchema` exportado desde `runtime-config-zod.ts` con props opcionales `href`, `download`, `target`, `action` y obligatorio `label`
- `LinkLayoutNode` exportado desde `src/config/runtime-config.ts`
- Tests de aceptación estructural básica en verde

**Cierre de implementación:** código y tests de la tarea completos y validados con `pnpm test`.

---

## T2 — Validación cruzada del nodo `link` en `src/config/`

**Estado:** completed

**Objetivo:**
Añadir `validateLinkNode` en `src/config/validate-layout-nodes.ts` con todas las reglas cruzadas de la spec: `href` y `action` mutuamente excluyentes, `download`/`target` solo si hay `href`, `action.type` restringido a `navigateTo`/`goBack`, y verificación de `pageId` existente en el catálogo de páginas. Registrar el nuevo tipo en el `switch` de `validateLayoutNode` y en `findInvalidActionTarget` para propagación de errores de targets.

**Fuera de alcance:**
- Componente React. Eso es T3.
- Tests de render. Eso es T4.

**Dependencias:** T1 completada (tipo y schema disponibles)

**Impacto esperado en archivos:**
- Código a modificar:
  - `src/config/validate-layout-nodes.ts` — añadir `validateLinkNode`, añadir `case 'link'` en el switch de `validateLayoutNode`
  - `src/config/validate-actions-visibility.ts` — actualizar `findInvalidActionTarget` para recorrer nodos `link` con `action.type: 'navigateTo'` y detectar `pageId` inexistente (misma lógica que ya existe para `button`)
- Tests a crear/ampliar:
  - `src/tests/config-validation/runtime-config-validation-buttons.test.ts` (ampliación) — todos los casos de validación cruzada del nodo `link`

- Documentación afectada:
  - `ai-workflow/docs/app-features/config/validation.md` — añadir sección de reglas del nodo `link` (para `update-app-documentation`)

**Tests:**

- **Ficheros de test:**
  - `src/tests/config-validation/runtime-config-validation-buttons.test.ts` (ampliación) — casos de rechazo y aceptación cruzada del nodo `link`

- **Comportamiento cubierto:**
  - Un `link` con `props.href` literal y sin `props.action` es aceptado (`status: 'ready'`)
  - Un `link` con `props.action: { type: 'navigateTo', pageId: '<existingPage>' }` y sin `props.href` es aceptado (`status: 'ready'`)
  - Un `link` con `props.action: { type: 'goBack' }` y sin `props.href` es aceptado (`status: 'ready'`)
  - Un `link` con `props.download` y `props.href` presentes es aceptado
  - Un `link` con `props.target: '_blank'` y `props.href` presente es aceptado
  - Un `link` sin `props.href` ni `props.action` es rechazado con `invalid-layout`
  - Un `link` con `props.href` y `props.action` simultáneos es rechazado con `invalid-layout`
  - Un `link` con `props.download` sin `props.href` es rechazado con `invalid-layout`
  - Un `link` con `props.target` sin `props.href` es rechazado con `invalid-layout`
  - Un `link` con `props.action.type: 'executeOperation'` es rechazado con `invalid-layout` (tipo no soportado)
  - Un `link` con `props.action: { type: 'navigateTo', pageId: 'inexistente' }` es rechazado con `invalid-layout` (pageId desconocido)
  - Un `link` con `props.action: { type: 'navigateTo' }` sin `pageId` es rechazado con `invalid-layout`
  - `visibility`, `queryStateFeedback` y `layout.span` son aceptados en un nodo `link` siguiendo el contrato transversal
  - `children` en un nodo `link` no se propaga al nodo normalizado (comportamiento hoja)

- **Comandos durante la implementación:**
  - `pnpm test --run src/tests/config-validation/runtime-config-validation-buttons.test.ts`

- **Restricciones:**
  - Para la validación de `action`, reutilizar `validateRuntimeUiAction` de `validate-actions-visibility.ts` pero con un guard previo que rechace `type` distinto de `navigateTo`/`goBack` antes de delegar; no crear un validador de acción paralelo.
  - Los mensajes de error deben seguir el mismo patrón que el resto del catálogo: `Page "${pageId}" has an invalid layout at "${path}.<campo>"`.

**Criterios de finalización:**
- `validateLinkNode` implementada y registrada en `validateLayoutNode`
- `findInvalidActionTarget` recorre nodos `link` con `navigateTo` para detectar `pageId` inexistente
- Todos los casos de aceptación y rechazo cruzada en verde
- `pnpm test` pasa con cobertura global ≥ 80%

**Cierre de implementación:** código y tests de la tarea completos y validados con `pnpm test`.

---

## T3 — Componente React `LinkNode` y registro en el dispatcher

**Estado:** completed

**Objetivo:**
Crear `src/runtime/nodes/link-layout-node.tsx` con el componente `LinkNode`. Registrarlo en `src/runtime/layout-node-renderer.tsx` (import + `case 'link'` en el switch). El componente renderiza siempre como `<a>`: si `props.href` está presente, lo usa como atributo; si `props.action` está presente, previene el comportamiento por defecto y delega en el ejecutor común de acciones. Añade `download` y `target` solo cuando están declarados. Resuelve `props.label` y `props.href` como referencias de texto dinámicas con el mismo mecanismo que el resto del runtime.

**Fuera de alcance:**
- Tests de render. Eso es T4.
- `rel="noopener noreferrer"` automático para `target="_blank"` (fuera de spec v1).
- Ningún comportamiento de submit implícito dentro de `form`.

**Dependencias:** T1 y T2 completadas

**Impacto esperado en archivos:**
- Código a crear:
  - `src/runtime/nodes/link-layout-node.tsx` — componente `LinkNode`
- Código a modificar:
  - `src/runtime/layout-node-renderer.tsx` — import de `LinkNode`, `case 'link'` en el switch
- Tests: ningún fichero de test propio en esta tarea; la cobertura del componente queda a cargo de T4
- Documentación afectada:
  - `ai-workflow/docs/app-features/nodes/index.md` — añadir entrada `link` a la tabla de nodos hoja visibles (para `update-app-documentation`)
  - Nueva ficha `ai-workflow/docs/app-features/nodes/link.md` (para `update-app-documentation`)

**Tests:**

- **Ficheros de test:** ninguno; cubierto por: T4 (`src/tests/layout-renderer/layout-renderer-buttons-text.test.tsx`)

- **Comportamiento cubierto:** N/A en esta tarea; los comportamientos se validan en T4.

- **Comandos durante la implementación:** N/A

- **Restricciones:**
  - El componente debe usar `data-layout-node="link"` como atributo de identificación en el `<a>`, siguiendo el patrón del resto de nodos.
  - Estilo con Tailwind CSS únicamente; sin estilos inline.
  - Para la resolución de `props.href` como referencia dinámica, usar `resolveRuntimeTextReference` del mismo módulo que `button-layout-node.tsx` usa para `props.label`.
  - Para la delegación de acciones (`navigateTo`, `goBack`), usar `executeRuntimeUiAction` del mismo ejecutor que `button-layout-node.tsx`.

**Criterios de finalización:**
- Fichero `src/runtime/nodes/link-layout-node.tsx` creado con componente `LinkNode` funcional
- `layout-node-renderer.tsx` incluye `case 'link'` en el switch y el import correspondiente
- El nodo `link` no aparece en el mismo bloque de exclusión que `repeater` y `modal` para el wrap de span (los nodos hoja estándar sí participan en el grid)
- `pnpm test` pasa (los tests de T4 aún no existen, pero los tests existentes deben seguir en verde)

**Cierre de implementación:** código completo y validado con `pnpm test`.

---

## T4 — Tests de render del nodo `link`

**Estado:** completed

**Objetivo:**
Añadir los tests de renderizado del nodo `link` al fichero `src/tests/layout-renderer/layout-renderer-buttons-text.test.tsx`. Cubrir todos los criterios de aceptación de la spec relacionados con comportamiento de render: atributos del anchor, resolución dinámica de `props.href`, navegación interna con `navigateTo`/`goBack`, y soporte de `visibility`, `queryStateFeedback` y `layout.span`.

**Fuera de alcance:**
- Tests de validación de config. Cubiertos por T2.
- Casos de degradación de `props.href` vacío resuelto: solo verificar que el atributo existe con valor `""`, no más.

**Dependencias:** T1, T2 y T3 completadas

**Impacto esperado en archivos:**
- Tests a modificar:
  - `src/tests/layout-renderer/layout-renderer-buttons-text.test.tsx` (ampliación)
- Documentación afectada:
  - `ai-workflow/docs/test-index.md` — actualizar línea de `layout-renderer-buttons-text.test.tsx` para reflejar que también cubre `link` (para `update-app-documentation`)
  - `ai-workflow/features/index.md` — mover la feature a completadas (para `update-app-documentation`)

**Tests:**

- **Ficheros de test:**
  - `src/tests/layout-renderer/layout-renderer-buttons-text.test.tsx` (ampliación)

- **Comportamiento cubierto:**
  - Un `link` con `props.href` literal renderiza un `<a>` con `href` igual al valor declarado y texto visible igual a `props.label`
  - Un `link` con `props.href` dinámico (`queries.myQuery.data`) resuelve la referencia desde el estado del runtime y renderiza la URL resultante como `href`
  - Un `link` con `props.label` interpolado (`{{item.name}}`) resuelve el placeholder y lo muestra en el texto del anchor
  - Un `link` con `props.download: 'file.pdf'` y `props.href` renderiza el anchor con atributo `download="file.pdf"`
  - Un `link` con `props.target: '_blank'` y `props.href` renderiza el anchor con `target="_blank"`
  - Un `link` sin `props.target` no incluye atributo `target` en el DOM
  - Un `link` con `props.action: { type: 'navigateTo', pageId: 'details' }` — al hacer clic, el estado de navegación cambia a la página `details` (sin recarga)
  - Un `link` con `props.action: { type: 'navigateTo', pageId: 'details' }` no incluye atributo `href` estático en el DOM
  - Un `link` con `props.action: { type: 'goBack' }` — al hacer clic, el dispatcher del runtime recibe la acción `goBack`
  - Un `link` con `visibility` que resulta en oculto no se renderiza en el DOM
  - Un `link` con `queryStateFeedback` en estado `loading` muestra el contenido de fallback definido
  - Un `link` con `layout.span: 6` aplica la clase de span de grid correspondiente al nodo envolvente

- **Comandos durante la implementación:**
  - `pnpm test --run src/tests/layout-renderer/layout-renderer-buttons-text.test.tsx`

- **Restricciones:**
  - Reutilizar los helpers de render (`renderRuntimePage`, `renderRuntimePageWithState`, `createRuntimePageState`) ya definidos en el fichero existente; no duplicarlos.
  - Para los tests de `navigateTo` y `goBack`, reutilizar el patrón de `renderRuntimePageWithState` con dispatch espiado que ya se usa en el fichero para botones.

**Criterios de finalización:**
- Todos los bullets de comportamiento cubierto tienen test asociado en el fichero
- `pnpm test --run src/tests/layout-renderer/layout-renderer-buttons-text.test.tsx` pasa sin errores
- `pnpm test` pasa con cobertura global ≥ 80%

**Cierre de implementación:** código y tests completos y validados con `pnpm test`.
