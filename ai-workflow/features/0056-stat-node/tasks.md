# Tasks: stat node (0056)

## T01 — Tipos TypeScript y schema Zod para el nodo `stat`

**Estado:** completado

### Objetivo
Añadir el tipo `StatLayoutNode` al catálogo de tipos de `runtime-config-types.ts`, registrar `'stat'` en el union `LayoutNodeType`, añadir `stat` al array `supportedNodeTypes` en `runtime-config-zod.ts`, y crear `statNodeSchema` con las constantes de variantes y colores. Registrar también los tipos exportados en `runtime-config.ts`.

### Fuera de alcance
- Validación semántica en `validate-layout-nodes.ts` (T02).
- Componente React (T03).
- Dispatcher (T04).
- Tests de validación config (T05) y de renderer (T06).

### Dependencias
Ninguna. Primera tarea de la feature.

### Impacto esperado en archivos
- **Modificar** `src/config/runtime-config-types.ts`:
  - Añadir `'stat'` al union `LayoutNodeType`.
  - Añadir tipos `StatVariant = 'accent' | 'tinted'` y `StatColor = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info'` (o reusar `BadgeColor`; la paleta es idéntica).
  - Añadir interfaz `StatLayoutNode extends LayoutNodeFeedbackFields, LayoutNodeLayoutFields` con `type: 'stat'`, `id?: string`, `props: { label: string; value: string; variant?: StatVariant; color?: StatColor }`, `children?: unknown`.
  - Añadir `StatLayoutNode` al union `LayoutNode`.
- **Modificar** `src/config/runtime-config-zod.ts`:
  - Añadir `'stat'` al array `supportedNodeTypes`.
  - Añadir `export const supportedStatVariants = ['accent', 'tinted'] as const`.
  - Añadir `export const supportedStatColors = ['neutral', 'primary', 'success', 'warning', 'danger', 'info'] as const`.
  - Añadir `export const statNodeSchema` siguiendo exactamente el patrón de `badgeNodeSchema`: `type: z.literal('stat')`, `id`, `queryStateFeedback`, `visibility`, `layout`, `props: { label: z.string(), value: z.string(), variant: z.enum(supportedStatVariants).optional(), color: z.enum(supportedStatColors).optional() }`, todo con `.strip()`.
- **Modificar** `src/config/runtime-config.ts`:
  - Añadir `StatLayoutNode`, `StatVariant`, `StatColor` a los exports del barrel.
- **Ficheros de test**: ninguno en esta tarea (los tests de zod schema son cubiertas en T05).
- **Documentación**: `ai-workflow/docs/app-features/nodes/index.md` (nueva fila de nodo hoja stat).

### Tests

**Ficheros de test:** ninguno — los comportamientos del schema son cubiertos por T05.

**Comportamiento cubierto:** ninguno directo. La corrección estructural queda validada cuando T05 pasa.

**Comandos durante la implementación:** ninguno en esta tarea. Usar `pnpm test` al final para confirmar que no hay regresiones de tipos.

**Restricciones:** ninguna adicional.

### Documentación afectada
- `ai-workflow/docs/app-features/nodes/index.md` — añadir fila `stat` en la tabla de nodos hoja visibles.

### Criterios de finalización
- `StatLayoutNode` está en el union `LayoutNode` de `runtime-config-types.ts`.
- `statNodeSchema` existe en `runtime-config-zod.ts` y sigue el patrón de `badgeNodeSchema`.
- `'stat'` está en `supportedNodeTypes`.
- Los tipos están exportados en `runtime-config.ts`.
- `pnpm test` no introduce nuevas regresiones.

### Cierre de implementación
Tipos y schema compilando sin errores TypeScript y tests previos en verde.

---

## T02 — Validación semántica en `validate-layout-nodes.ts`

**Estado:** completado

### Objetivo
Registrar `'stat'` en el dispatcher `validateLayoutNode`, implementar la función `validateStatNode` siguiendo el mismo patrón que `validateBadgeNode` y `validateAlertNode`, y exportar desde `runtime-config.ts` si algún tipo nuevo requiere re-export.

### Fuera de alcance
- Componente React (T03).
- Registro en el dispatcher de layout (T04).
- Tests de validación config (T05).

### Dependencias
T01 debe estar completo (tipos y schema disponibles).

### Impacto esperado en archivos
- **Modificar** `src/config/validate-layout-nodes.ts`:
  - Añadir `StatLayoutNode` al import de tipos.
  - Añadir `statNodeSchema`, `supportedStatVariants`, `supportedStatColors` al import desde `runtime-config-zod`.
  - Añadir `case 'stat': return validateStatNode(rawNode, path, pageId)` en el switch del dispatcher `validateLayoutNode`.
  - Implementar `function validateStatNode(rawNode, path, pageId)` siguiendo el patrón de `validateBadgeNode`:
    - `statNodeSchema.safeParse(rawNode)`.
    - Mapear issues de `queryStateFeedback`, `visibility`, `layout` con los helpers existentes.
    - Mapear issue de `id` con mensaje `"${path}.id"`.
    - Mapear issue de `props.label` con mensaje `"${path}.props.label"`.
    - Mapear issue de `props.value` con mensaje `"${path}.props.value"`.
    - Mapear issue de `props.variant` con mensaje `"${path}.props.variant"`.
    - Mapear issue de `props.color` con mensaje `"${path}.props.color"`.
    - Llamar `mapLeafNodeIssue` como fallback.
    - En éxito: construir `StatLayoutNode` con `type: 'stat'`, `id`, `queryStateFeedback`, `visibility`, `layout`, `props: { label, value, variant, color }`.
- **Ficheros de test**: ninguno en esta tarea (cubiertos por T05).
- **Documentación**: ninguna adicional.

### Tests

**Ficheros de test:** ninguno en T02 — los casos de validación son declarados y ejecutados en T05.

**Comportamiento cubierto:** ninguno directo. La corrección se verifica cuando T05 pasa.

**Comandos durante la implementación:** ninguno en esta tarea. Usar `pnpm test` al final para confirmar que no hay regresiones en el resto de la suite.

**Restricciones:** ninguna adicional.

### Documentación afectada
Ninguna.

### Criterios de finalización
- `validateLayoutNode` despacha correctamente `'stat'` a `validateStatNode`.
- `validateStatNode` construye un `StatLayoutNode` válido para inputs correctos.
- `validateStatNode` retorna error con ruta exacta para inputs inválidos.
- `pnpm test` no introduce nuevas regresiones.

### Cierre de implementación
Función implementada y suite preexistente en verde.

---

## T03 — Componente React `StatNode`

**Estado:** completado

### Objetivo
Crear `src/runtime/nodes/stat-layout-node.tsx` implementando el componente `StatNode` que renderiza las variantes `accent` y `tinted` con la paleta semántica completa.

### Fuera de alcance
- Dispatcher en `layout-node-renderer.tsx` (T04).
- Tests de render (T06).

### Dependencias
T01 debe estar completo (tipos disponibles).

### Impacto esperado en archivos
- **Crear** `src/runtime/nodes/stat-layout-node.tsx`:
  - Importar `StatLayoutNode`, `StatVariant`, `StatColor` desde `../../config/runtime-config`.
  - Importar `resolveRuntimeTextReference` y `RuntimeIterationContext` desde `../runtime-references/runtime-reference-resolver`.
  - Importar `useRuntimeState` desde `../runtime-state/runtime-state-provider`.
  - Props: `{ node: StatLayoutNode, iterationContext?: RuntimeIterationContext }`.
  - Resolver `label` con `resolveRuntimeTextReference(node.props.label, state, 'stat.props.label', { iterationContext })`.
  - Resolver `value` con `resolveRuntimeTextReference(node.props.value, state, 'stat.props.value', { iterationContext })`.
  - `variant = node.props.variant ?? 'accent'`.
  - `color = node.props.color ?? 'neutral'`.
  - Variante `accent`: `<div data-layout-node="stat">` con borde lateral izquierdo coloreado. Paleta de borde (border-l-4):
    - `neutral`: `border-gray-400`
    - `primary`: `border-blue-500`
    - `success`: `border-green-500`
    - `warning`: `border-yellow-400`
    - `danger`: `border-red-500`
    - `info`: `border-cyan-500`
    - Fondo neutro (no coloreado), p.ej. `bg-white` o sin clase de fondo.
    - `label` en `<p>` o `<span>` con clase de texto muted, p.ej. `text-sm text-gray-500`.
    - `value` en `<p>` con texto prominente y negrita, p.ej. `text-2xl font-bold text-gray-900`.
  - Variante `tinted`: `<div data-layout-node="stat">` con fondo de color suave. Paleta (misma que `badge` pill + texto marcado):
    - `neutral`: fondo `bg-gray-100`, texto de label `text-gray-600`, texto de value `text-gray-800 font-bold`.
    - `primary`: fondo `bg-blue-100`, texto de label `text-blue-600`, texto de value `text-blue-800 font-bold`.
    - `success`: fondo `bg-green-100`, texto de label `text-green-600`, texto de value `text-green-800 font-bold`.
    - `warning`: fondo `bg-yellow-100`, texto de label `text-yellow-600`, texto de value `text-yellow-800 font-bold`.
    - `danger`: fondo `bg-red-100`, texto de label `text-red-600`, texto de value `text-red-800 font-bold`.
    - `info`: fondo `bg-cyan-100`, texto de label `text-cyan-600`, texto de value `text-cyan-800 font-bold`.
  - Renderizar siempre con `data-layout-node="stat"`.
  - Sin estado local ni efectos secundarios.
  - Solo utilidades de Tailwind CSS; sin estilos inline.

**Nota de implementación sobre paleta `accent`:** los shades de borde deben coincidir con los shades de los puntos círculos de `badge` variante `circle` (misma paleta sólida). Esta es la alineación con el baseline visual institucional descrita en la spec; no requiere tokens nuevos.

### Tests

**Ficheros de test:** ninguno en T03 — los tests de render son declarados y ejecutados en T06.

**Comportamiento cubierto:** ninguno directo. La corrección se verifica cuando T06 pasa.

**Comandos durante la implementación:** ninguno en esta tarea.

**Restricciones:** ninguna adicional.

### Documentación afectada
Ninguna.

### Criterios de finalización
- `src/runtime/nodes/stat-layout-node.tsx` existe y compila sin errores TypeScript.
- El componente renderiza correctamente en inspección manual si se usa temporalmente en dev.
- `pnpm test` no introduce regresiones.

### Cierre de implementación
Fichero creado y compilando limpiamente. El comportamiento visual se valida en T06.

---

## T04 — Registro en el dispatcher de layout (`layout-node-renderer.tsx`)

**Estado:** completado

### Objetivo
Importar `StatNode` en `layout-node-renderer.tsx` y añadir `case 'stat'` al switch del dispatcher. El nodo `stat` aplica `layout.span` como cualquier otro nodo hoja.

### Fuera de alcance
- Tests de dispatcher (cubiertos por T06, que los ejercita de forma integrada).

### Dependencias
T01, T02, T03 deben estar completos.

### Impacto esperado en archivos
- **Modificar** `src/runtime/layout-node-renderer.tsx`:
  - Añadir `import { StatNode } from './nodes/stat-layout-node'`.
  - Añadir `case 'stat': renderedNode = <StatNode node={node} iterationContext={iterationContext} />` en el switch.
  - El `gridChildSpanClassName` ya cubre todos los nodos excepto `repeater` y `modal`; `stat` no requiere excepción adicional.

### Tests

**Ficheros de test:** ninguno en T04 — la integración se valida en T06.

**Comportamiento cubierto:** ninguno directo.

**Comandos durante la implementación:** `pnpm test` al final para verificar que no hay regresiones.

**Restricciones:** ninguna adicional.

### Documentación afectada
Ninguna.

### Criterios de finalización
- `layout-node-renderer.tsx` importa `StatNode` y lo despacha en el `case 'stat'`.
- `pnpm test` no introduce regresiones.

### Cierre de implementación
Switch actualizado y suite en verde.

---

## T05 — Tests de validación de configuración (`config-validation/`)

**Estado:** completado

### Objetivo
Crear `src/tests/config-validation/runtime-config-validation-stat.test.ts` con cobertura completa de aceptación y rechazo del nodo `stat` siguiendo el patrón de `runtime-config-validation-badge.test.ts`.

### Fuera de alcance
- Tests de render del componente (T06).

### Dependencias
T01 y T02 deben estar completos (schema y validación disponibles).

### Impacto esperado en archivos
- **Crear** `src/tests/config-validation/runtime-config-validation-stat.test.ts` (nuevo).
- **Documentación**: `ai-workflow/docs/test-index.md` (entrada nueva en la sección `config-validation/`).

### Tests

**Ficheros de test:**
- `src/tests/config-validation/runtime-config-validation-stat.test.ts` (nuevo)

**Comportamiento cubierto:**

_Aceptación:_
- `stat` mínimo con `props.label` y `props.value` pasa validación (`status: 'ready'`).
- `stat` con `variant: 'accent'` explícito pasa validación.
- `stat` con `variant: 'tinted'` explícito pasa validación.
- `stat` con cada uno de los seis colores (`neutral`, `primary`, `success`, `warning`, `danger`, `info`) pasa validación.
- `stat` con `props.label` y `props.value` conteniendo placeholders `{{...}}` pasa validación.
- `stat` con `visibility`, `queryStateFeedback` y `layout.span` pasa validación.
- `stat` con `children` declarados en input crudo pasa validación; nodo normalizado no contiene `children`.

_Rechazo:_
- `stat` sin `props.label` es rechazado con mensaje que contiene `props.label`.
- `stat` con `props.label` no string es rechazado con mensaje que contiene `props.label`.
- `stat` sin `props.value` es rechazado con mensaje que contiene `props.value`.
- `stat` con `props.value` no string es rechazado con mensaje que contiene `props.value`.
- `stat` con `props.variant` inválido es rechazado con mensaje que contiene `props.variant`.
- `stat` con `props.color` inválido es rechazado con mensaje que contiene `props.color`.
- `stat` con `layout.span` inválido es rechazado con mensaje que contiene `layout.span`.

**Comandos durante la implementación:**
```
pnpm test --run src/tests/config-validation/runtime-config-validation-stat.test.ts
```

**Restricciones:**
- Reusar el helper `createConfigWithLayout` de `./helpers` (patrón existente en todos los tests de config-validation).
- Reusar el patrón `createStatNode(overrides)` igual que `createBadgeNode` en el test de badge.
- No añadir snapshots.

### Documentación afectada
- `ai-workflow/docs/test-index.md` — añadir entrada `runtime-config-validation-stat.test.ts` en la sección `config-validation/`.

### Criterios de finalización
- Todos los casos listados pasan con `pnpm test --run`.
- `pnpm test` (suite completa) mantiene el umbral del 80%.

### Cierre de implementación
Todos los tests en verde; suite completa supera el umbral de cobertura.

---

## T06 — Tests de renderizado del componente (`layout-renderer/`)

**Estado:** completado

### Objetivo
Crear `src/tests/layout-renderer/layout-renderer-stat.test.tsx` con cobertura completa del render del nodo `stat` incluyendo variantes, paleta de colores, interpolación, transversales y casos de integración con repeater y form. Modelo: `layout-renderer-badge.test.tsx` y `layout-renderer-alert.test.tsx`.

### Fuera de alcance
- Tests de validación config (T05).

### Dependencias
T01, T02, T03 y T04 deben estar completos.

### Impacto esperado en archivos
- **Crear** `src/tests/layout-renderer/layout-renderer-stat.test.tsx` (nuevo).
- **Documentación**: `ai-workflow/docs/test-index.md` (entrada nueva en la sección `layout-renderer/`).

### Tests

**Ficheros de test:**
- `src/tests/layout-renderer/layout-renderer-stat.test.tsx` (nuevo)

**Comportamiento cubierto:**

_Variante y datos básicos:_
- `stat` con `variant: 'accent'` renderiza un elemento con `data-layout-node="stat"` en el DOM.
- `stat` con `variant: 'tinted'` renderiza un elemento con `data-layout-node="stat"` en el DOM.
- `stat` sin `variant` declarado renderiza como `accent` (verificar que no aplica clase de fondo de color).
- `stat` sin `color` declarado usa `neutral` (verificar clase de borde o fondo del color neutral).
- `label` y `value` son visibles en el DOM como texto.

_Paleta `accent` (borde):_
- Para cada uno de los seis colores, `stat` con `variant: 'accent'` tiene la clase de borde izquierdo correspondiente en el elemento raíz (ver mapa en T03).

_Paleta `tinted` (fondo + texto):_
- Para cada uno de los seis colores, `stat` con `variant: 'tinted'` tiene la clase de fondo correspondiente en el elemento raíz.
- Para cada uno de los seis colores, el texto de label tiene la clase de texto del color semántico correspondiente.
- Para cada uno de los seis colores, el texto de value tiene la clase de texto marcado del color semántico correspondiente.

_Interpolación:_
- `props.label` con `{{queries.foo.data}}` resuelve al valor de la query cuando la query tiene `status: 'success'`.
- `props.value` con `{{queries.foo.data}}` resuelve al valor de la query cuando la query tiene `status: 'success'`.
- `props.label` con string vacío renderiza sin texto de label visible (sin error).
- `props.value` con string vacío renderiza sin texto de value visible (sin error).
- `props.label` con placeholder no resuelto renderiza sin error (`data-layout-node="stat"` presente en DOM).
- `props.value` con placeholder no resuelto renderiza sin error.

_Transversales:_
- `stat` con `visibility` evaluada a false no se renderiza en el DOM.
- `stat` con `queryStateFeedback` en estado loading con fallback muestra el fallback y oculta el stat original.
- `stat` con `layout.span: 4` dentro de un `container` con `columns: 12` está envuelto en `div.col-span-4`.

_Integración con repeater:_
- `stat` dentro de repeater con dos ítems renderiza dos elementos `[data-layout-node="stat"]` con labels y valores distintos usando `item.*`.

_Integración con form:_
- `stat` como hijo de un `form` renderiza `[data-layout-node="stat"]` en el DOM sin error.

**Comandos durante la implementación:**
```
pnpm test --run src/tests/layout-renderer/layout-renderer-stat.test.tsx
```

**Restricciones:**
- Reusar el harness de render (`renderRuntimePage`, `renderRuntimePageWithState`, `createRuntimePageState`) siguiendo el patrón establecido en `layout-renderer-badge.test.tsx` y `layout-renderer-alert.test.tsx`.
- No añadir snapshots.

### Documentación afectada
- `ai-workflow/docs/test-index.md` — añadir entrada `layout-renderer-stat.test.tsx` en la sección `layout-renderer/`.

### Criterios de finalización
- Todos los casos listados pasan con `pnpm test --run`.
- `pnpm test` (suite completa) mantiene el umbral del 80%.

### Cierre de implementación
Todos los tests en verde; suite completa supera el umbral de cobertura.
