# Plan de implementación: badge node (0054)

## Resumen de tareas

| ID | Objetivo | Estado |
|---|---|---|
| T01 | Añadir tipo `BadgeLayoutNode` y esquema Zod al contrato de configuración | completado |
| T02 | Añadir validador `validateBadgeNode` en `validate-layout-nodes.ts` | completado |
| T03 | Implementar el componente React `BadgeNode` | completado |
| T04 | Conectar `badge` en el dispatcher `LayoutNodeRenderer` | completado |

---

## T01 — Añadir tipo `BadgeLayoutNode` y esquema Zod al contrato de configuración

**Estado:** completado

**Objetivo:**
Extender `src/config/runtime-config-types.ts` con el tipo TypeScript `BadgeLayoutNode` y extender `src/config/runtime-config-zod.ts` con el esquema Zod `badgeNodeSchema`. Añadir `'badge'` a `supportedNodeTypes`, al tipo `LayoutNodeType` y al union `LayoutNode`. Exportar el tipo y el esquema desde los puntos de entrada correspondientes.

**Fuera de alcance:**
- No implementar el validador semántico (se hace en T02).
- No implementar el componente React (se hace en T03).
- No conectar el dispatcher (se hace en T04).
- No modificar `tableCellAllowedNodeTypes` ni ninguna lista restringida de tipos de celda de tabla.

**Dependencias:** ninguna

**Impacto esperado en archivos:**

*Código:*
- `src/config/runtime-config-types.ts` — añadir `BadgeLayoutNode` al union `LayoutNode` y al tipo `LayoutNodeType`; añadir la interfaz `BadgeLayoutNode` con `type: 'badge'`, campos opcionales `id`, `layout`, `visibility`, `queryStateFeedback` y `props: { label: string; variant?: 'pill' | 'circle'; color?: 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info' }`.
- `src/config/runtime-config-zod.ts` — añadir constantes exportadas `supportedBadgeVariants` y `supportedBadgeColors`; añadir y exportar `badgeNodeSchema` siguiendo el mismo patrón que `headingNodeSchema` / `paragraphNodeSchema`; añadir `'badge'` al array `supportedNodeTypes`.
- `src/config/runtime-config.ts` — re-exportar `BadgeLayoutNode` si es necesario para que los consumidores externos puedan importarlo.

*Tests:* ninguno directo en esta tarea; los tests de contrato se escriben en T02.

*Documentación:* ninguna (los cambios de contrato se documentarán en `update-app-documentation` tras implementación).

**Tests:**

- **Ficheros de test:** ninguno propio en esta tarea; cubierto por T02 (`runtime-config-validation-badge.test.ts`).

- **Comportamiento cubierto:** (ver T02)

- **Comandos durante la implementación:** (ver T02)

- **Restricciones:** ninguna específica de esta tarea.

**Criterios de finalización:**
- `LayoutNodeType` incluye `'badge'`.
- `LayoutNode` incluye `BadgeLayoutNode`.
- `supportedNodeTypes` incluye `'badge'`.
- `badgeNodeSchema` exportado y compila sin errores TypeScript.
- `pnpm test` pasa (sin nuevos casos de test propios aún).

**Cierre de implementación:** tipos compilados correctamente y `pnpm test` en verde.

---

## T02 — Añadir validador `validateBadgeNode` en `validate-layout-nodes.ts`

**Estado:** completado

**Objetivo:**
Implementar `validateBadgeNode` en `src/config/validate-layout-nodes.ts` siguiendo el mismo patrón que `validateHeadingNode` / `validateParagraphNode`. Conectar el nuevo caso `'badge'` en el switch de `validateLayoutNode`. Escribir el fichero de tests `src/tests/config-validation/runtime-config-validation-badge.test.ts` con cobertura completa de aceptación y rechazo.

**Fuera de alcance:**
- No implementar el componente React (T03).
- No conectar el dispatcher (T04).
- No añadir `badge` a `tableCellAllowedNodeTypes`.

**Dependencias:** T01 completado (tipo y schema Zod deben existir).

**Impacto esperado en archivos:**

*Código:*
- `src/config/validate-layout-nodes.ts` — añadir función privada `validateBadgeNode`; añadir `case 'badge':` en el switch de `validateLayoutNode`; importar `BadgeLayoutNode` y `badgeNodeSchema` donde corresponda.

*Tests:*
- `src/tests/config-validation/runtime-config-validation-badge.test.ts` (nuevo)

*Documentación:* ninguna.

**Tests:**

- **Ficheros de test:**
  - `src/tests/config-validation/runtime-config-validation-badge.test.ts` (nuevo)

- **Comportamiento cubierto:**
  - Acepta un `badge` mínimo válido: solo `type: 'badge'` y `props.label` como string literal.
  - Acepta `badge` con `variant: 'pill'` explícito.
  - Acepta `badge` con `variant: 'circle'` explícito.
  - Acepta `badge` con `color: 'neutral'`, `'primary'`, `'success'`, `'warning'`, `'danger'`, `'info'` (un test por color o test parametrizado).
  - Acepta `badge` con `props.label` con placeholder `{{queries.foo.data}}`.
  - Acepta `badge` con `visibility`, `queryStateFeedback` y `layout.span` declarados (comportamiento transversal estándar).
  - Acepta `badge` con `children` declarado en el raw input: el resultado normalizado no incluye `children` (nodo hoja — `children` no forma parte del tipo normalizado).
  - Rechaza `badge` sin `props.label` con `status: 'error'` y diagnóstico `{path}.props.label`.
  - Rechaza `badge` con `props.label` no string (p.ej. número) con `status: 'error'` y diagnóstico `{path}.props.label`.
  - Rechaza `badge` con `props.variant` inválido (p.ej. `'square'`) con `status: 'error'` y diagnóstico `{path}.props.variant`.
  - Rechaza `badge` con `props.color` inválido (p.ej. `'red'`) con `status: 'error'` y diagnóstico `{path}.props.color`.
  - Rechaza `badge` con `layout.span` inválido con `status: 'error'` y diagnóstico `{path}.layout.span`.

- **Comandos durante la implementación:**
  ```
  pnpm test --run src/tests/config-validation/runtime-config-validation-badge.test.ts
  ```

- **Restricciones:**
  - Reusar el helper `createConfigWithPages` de `src/tests/config-validation/helpers.ts`.
  - No añadir snapshots.
  - El formato de los tests debe seguir el patrón de `runtime-config-validation-buttons.test.ts` (import, describe, it, expect).

**Criterios de finalización:**
- `validateLayoutNode` enruta `'badge'` al nuevo validador.
- Todos los casos del fichero de test en verde con `pnpm test --run`.
- `pnpm test` pasa globalmente sin degradar cobertura.

**Cierre de implementación:** tests de validación en verde y `pnpm test` global en verde.

---

## T03 — Implementar el componente React `BadgeNode`

**Estado:** completado

**Objetivo:**
Crear `src/runtime/nodes/badge-layout-node.tsx` con el componente `BadgeNode`. El componente resuelve `props.label` con `resolveRuntimeTextReference`, aplica las clases Tailwind correspondientes a la variante y color, y renderiza sin estado local ni efectos. Escribir el fichero de tests de renderer `src/tests/layout-renderer/layout-renderer-badge.test.tsx`.

**Fuera de alcance:**
- No conectar el dispatcher (T04).
- No usar estilos inline — solo clases Tailwind.
- No implementar acciones interactivas (el nodo es de presentación pura).
- No modificar `tableCellAllowedNodeTypes`.

**Dependencias:** T01 completado (tipo disponible para importar), T02 completado (validación funcional).

**Impacto esperado en archivos:**

*Código:*
- `src/runtime/nodes/badge-layout-node.tsx` (nuevo) — exporta `BadgeNode`; acepta `{ node: BadgeLayoutNode; iterationContext?: RuntimeIterationContext }`; resuelve `node.props.label` mediante `resolveRuntimeTextReference`; renderiza con `data-layout-node="badge"`.

  Paleta de clases Tailwind (decisión de implementación):
  - El componente debe contener un mapa interno (objeto literal o función) de `color → { pill: { bg, text }, circle: { dot } }` con clases Tailwind concretas. El mapa cubre los seis colores semánticos: `neutral`, `primary`, `success`, `warning`, `danger`, `info`.
  - Para `variant: 'pill'`: wrapper con clases de fondo suave y texto marcado según el color; forma redondeada (`rounded-full`); padding horizontal y vertical mínimos.
  - Para `variant: 'circle'`: wrapper flex con alineación vertical centrada; circulo de color sólido a la izquierda (`rounded-full` con dimensiones fijas); texto a la derecha en color heredado del tema.
  - Los shades exactos de Tailwind se eligen durante implementación, alineados con la baseline visual del proyecto.

*Tests:*
- `src/tests/layout-renderer/layout-renderer-badge.test.tsx` (nuevo)

*Documentación:* ninguna.

**Tests:**

- **Ficheros de test:**
  - `src/tests/layout-renderer/layout-renderer-badge.test.tsx` (nuevo)

- **Comportamiento cubierto:**
  - Un `badge` con `variant: 'pill'` renderiza un elemento con `data-layout-node="badge"` y el texto de `props.label` visible.
  - Un `badge` con `variant: 'circle'` renderiza un elemento con `data-layout-node="badge"` y el texto de `props.label` visible.
  - Un `badge` sin `variant` declarado renderiza igual que `variant: 'pill'` (default).
  - Un `badge` sin `color` declarado renderiza igual que `color: 'neutral'` (default).
  - Para cada uno de los seis colores semánticos, el badge con `variant: 'pill'` incluye clases Tailwind de fondo suave y texto marcado específicos de ese color (verificar clases CSS presentes en el DOM).
  - Para cada uno de los seis colores semánticos, el badge con `variant: 'circle'` incluye la clase de color del círculo específica de ese color.
  - `props.label` con placeholder `{{queries.foo.data}}` resuelve correctamente cuando la referencia está disponible en el estado del runtime.
  - `props.label` vacío renderiza el badge sin texto visible (no es error, el nodo sí se renderiza).
  - Un `badge` con `visibility: { reference, operator, value }` que evalúa a oculto no se renderiza (comportamiento estándar de `LayoutNodeRenderer`).
  - Un `badge` con `queryStateFeedback` en estado `loading` renderiza el nodo de feedback correspondiente (comportamiento estándar de `LayoutNodeRenderer`).
  - Un `badge` con `layout.span` declarado dentro de un `container` con `columns` recibe la clase de span Tailwind correcta (comportamiento estándar de `LayoutNodeRenderer`).

- **Comandos durante la implementación:**
  ```
  pnpm test --run src/tests/layout-renderer/layout-renderer-badge.test.tsx
  ```

- **Restricciones:**
  - Reusar los helpers y fixtures de `src/tests/layout-renderer/` (patrón de `renderRuntimePage` / `RuntimeStateProvider`).
  - No añadir snapshots de componente.
  - Los tests de `visibility`, `queryStateFeedback` y `layout.span` son tests de integración de `LayoutNodeRenderer` con el nodo `badge`; si la cobertura de esos mecanismos transversales ya está garantizada en otros ficheros del renderer, basta con un test representativo de cada uno.

**Criterios de finalización:**
- `BadgeNode` renderiza correctamente las dos variantes con los seis colores.
- Todos los casos del fichero de test en verde.
- `pnpm test` pasa globalmente sin degradar cobertura.

**Cierre de implementación:** tests del renderer en verde y `pnpm test` global en verde.

---

## T04 — Conectar `badge` en el dispatcher `LayoutNodeRenderer`

**Estado:** completado

**Objetivo:**
Añadir el caso `'badge'` en el switch de `src/runtime/layout-node-renderer.tsx` importando `BadgeNode` desde `./nodes/badge-layout-node`. Verificar que el componente queda integrado correctamente en el pipeline de render transversal (visibility, queryStateFeedback, layout.span).

**Fuera de alcance:**
- No cambiar la lógica existente del dispatcher.
- No añadir `badge` a `tableCellAllowedNodeTypes`.
- No cambiar la gestión de `gridChildSpanClassName` (el nodo `badge` no es `repeater` ni `modal`, por lo que sigue la regla estándar).

**Dependencias:** T01, T02 y T03 completados.

**Impacto esperado en archivos:**

*Código:*
- `src/runtime/layout-node-renderer.tsx` — añadir `import { BadgeNode } from './nodes/badge-layout-node'`; añadir `case 'badge': renderedNode = <BadgeNode node={node} iterationContext={iterationContext} />; break;` en el switch.

*Tests:*
- `src/tests/layout-renderer/layout-renderer-badge.test.tsx` (ampliación) — añadir un test de integración end-to-end que use `renderRuntimePage` con una página que contenga un nodo `badge` ya validado, verificando que el nodo se renderiza correctamente a través del pipeline completo (incluyendo el dispatcher).

*Documentación:* ninguna.

**Tests:**

- **Ficheros de test:**
  - `src/tests/layout-renderer/layout-renderer-badge.test.tsx` (ampliación)

- **Comportamiento cubierto:**
  - Un nodo `badge` en el layout de una página se renderiza a través del dispatcher `LayoutNodeRenderer` sin error y muestra el texto de `props.label`.
  - El nodo `badge` recibe correctamente la clase de span de grid cuando está dentro de un `container` con `columns` (verifica que `gridChildSpanClassName` se aplica, igual que para otros nodos hoja).

- **Comandos durante la implementación:**
  ```
  pnpm test --run src/tests/layout-renderer/layout-renderer-badge.test.tsx
  ```

- **Restricciones:**
  - No duplicar los casos de variante/color ya cubiertos en T03; los tests de T04 se centran en la integración del dispatcher.

**Criterios de finalización:**
- El caso `'badge'` existe en el switch de `LayoutNodeRenderer`.
- Los tests de integración del dispatcher en verde.
- `pnpm test` pasa globalmente sin degradar cobertura.
- TypeScript compila sin errores (`pnpm build` o comprobación de tipos).

**Cierre de implementación:** dispatcher conectado, tests end-to-end en verde y `pnpm test` global en verde.
