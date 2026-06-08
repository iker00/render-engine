# Tasks: nodo `skeleton` (0066)

Contrato de ejecución para la implementación. Las tareas están ordenadas; cada tarea debe completarse antes de iniciar la siguiente.

---

## T1 — Tipos, esquema Zod, validación y registro del nodo `skeleton`

### Estado
completada

### Objetivo
Introducir el nodo hoja `skeleton` como tipo de nodo soportado por el runtime, con su esquema Zod, su validación específica y su registro en la unión raíz que alimenta al editor Monaco. Esta tarea cubre exclusivamente la capa de configuración: cuando termine, una config con un `skeleton` válido pasa `validateRuntimeConfig` y una con un `skeleton` inválido es rechazada con diagnóstico de ruta, aunque todavía no exista componente React para renderizarlo.

El nodo declara estos props opcionales:
- `variant`: `'text' | 'rect' | 'circle'`, default lógico `'rect'` aplicado en render (Zod lo deja opcional sin default).
- `lines`: entero ≥ 1.
- `width`: string (sufijo de escala Tailwind, e.g. `"32"`, `"full"`, `"1/2"`).
- `height`: string (sufijo de escala Tailwind).
- `rounded`: boolean.
- `animate`: boolean.

El nodo soporta los campos transversales estándar (`visibility`, `queryStateFeedback`, `layout`). No declara `children` (es hoja); si se declaran en la config, el normalizador los descarta silenciosamente, igual que `divider`.

### Fuera de alcance
- Componente React `SkeletonNode` y su registro en `layout-node-renderer.tsx`: es T2.
- Cualquier cambio en clases Tailwind, mapas de estilo, helpers de styling o pruebas de render: es T2.
- Cambios en la documentación funcional bajo `ai-workflow/docs/`: el cierre documental lo hace `update-app-documentation` después de cerrar todas las tareas.
- Modificaciones a `queryStateFeedback`, `visibility` o al sistema de span (`layout.span`); el nodo solo se acopla a contratos ya existentes.

### Dependencias
Ninguna.

### Impacto esperado en archivos

- Código:
  - `src/config/runtime-config-types.ts` — añadir `SkeletonVariant` (`'text' | 'rect' | 'circle'`) y la interface `SkeletonLayoutNode` siguiendo el patrón de `DividerLayoutNode` (extiende `LayoutNodeFeedbackFields` y `LayoutNodeLayoutFields`, `type: 'skeleton'`, `id?: string`, `props?: { variant?: SkeletonVariant; lines?: number; width?: string; height?: string; rounded?: boolean; animate?: boolean }`, `children?: never`). Añadir `SkeletonLayoutNode` al alias unión `LayoutNode`.
  - `src/config/runtime-config-zod.ts` — añadir `'skeleton'` al array `supportedNodeTypes`; añadir `export const supportedSkeletonVariants = ['text', 'rect', 'circle'] as const`; añadir `export const skeletonNodeSchema` con shape `{ type: literal('skeleton'), id: nodeIdSchema.optional(), queryStateFeedback, visibility, layout, props: z.object({ variant: z.enum(supportedSkeletonVariants).optional(), lines: z.number().int().min(1).optional(), width: z.string().optional(), height: z.string().optional(), rounded: z.boolean().optional(), animate: z.boolean().optional() }).strip().optional() }.strip()`.
  - `src/config/runtime-config.ts` — re-exportar `SkeletonLayoutNode` y `SkeletonVariant` junto al resto de tipos de nodos hoja.
  - `src/config/runtime-config-root-zod.ts` — importar `skeletonNodeSchema` y añadirlo a la unión `layoutNodeSchema` para que el JSON Schema generado para Monaco incluya el nodo.
  - `src/config/validate-layout-nodes.ts` — importar `SkeletonLayoutNode` y `skeletonNodeSchema`; añadir el case `'skeleton'` en el switch de `validateLayoutNode`; implementar `validateSkeletonNode` siguiendo el patrón exacto de `validateDividerNode`: `safeParse` con el schema, mapear issues de `queryStateFeedback`, `visibility`, `layout` y `id` con sus helpers existentes, mapear issues `props.variant` / `props.lines` / `props.width` / `props.height` / `props.rounded` / `props.animate` a `invalidLayout` con ruta exacta, fallback final con `mapLeafNodeIssue`. Tras validar transversales, devolver el nodo normalizado con `type: 'skeleton'`, `id`, `queryStateFeedback`, `visibility`, `layout`, `props: parseResult.data.props`.

- Tests:
  - `src/tests/config-validation/runtime-config-validation-skeleton.test.ts` (nuevo).
  - `src/tests/dev-runtime/dev-runtime-json-schema.test.ts` (ampliación) — un único caso que verifique que el JSON Schema generado contiene la cadena `"skeleton"` (mismo estilo del caso existente `expect(schemaStr).toContain('container')`).

- Documentación: ninguna se modifica en esta tarea. Tras T2 el cierre documental se hará vía `update-app-documentation` (ver sección "Documentación afectada" al final del fichero).

### Tests

#### Ficheros de test
- `src/tests/config-validation/runtime-config-validation-skeleton.test.ts` (nuevo)
- `src/tests/dev-runtime/dev-runtime-json-schema.test.ts` (ampliación)

#### Comportamiento cubierto
- Una config con un nodo `{ type: 'skeleton' }` sin `props` declarados pasa `validateRuntimeConfig` (`status === 'ready'`).
- Una config con `{ type: 'skeleton', props: { variant: 'rect' } }`, `{ ..., props: { variant: 'text' } }` y `{ ..., props: { variant: 'circle' } }` pasan validación.
- Una config con `{ type: 'skeleton', props: { variant: 'pill' } }` (fuera del catálogo) es rechazada con `status === 'error'`, `error.code === 'invalid-layout'` y `error.message` contiene `props.variant`.
- Una config con `{ type: 'skeleton', props: { lines: 0 } }` es rechazada con `error.message` que contiene `props.lines`.
- Una config con `{ type: 'skeleton', props: { lines: -3 } }` es rechazada con `error.message` que contiene `props.lines`.
- Una config con `{ type: 'skeleton', props: { lines: 1.5 } }` (no entero) es rechazada con `error.message` que contiene `props.lines`.
- Una config con `{ type: 'skeleton', props: { width: '32', height: '8', rounded: true, animate: false } }` pasa validación y los valores se propagan al nodo normalizado tal cual.
- Una config con `{ type: 'skeleton', props: { width: 123 } }` (tipo incorrecto) es rechazada con `error.message` que contiene `props.width`.
- Una config con `{ type: 'skeleton', props: { rounded: 'yes' } }` es rechazada con `error.message` que contiene `props.rounded`.
- Una config con `{ type: 'skeleton', props: { animate: 'no' } }` es rechazada con `error.message` que contiene `props.animate`.
- Una config con `{ type: 'skeleton', visibility: { reference: 'queries.q.status', operator: 'equals', value: 'success' } }` pasa validación.
- Una config con `{ type: 'skeleton', queryStateFeedback: { query: 'q' } }` pasa validación.
- Una config con `{ type: 'skeleton', layout: { span: 6 } }` pasa validación.
- Una config con `{ type: 'skeleton', layout: { span: 99 } }` es rechazada con `error.message` que contiene `layout.span`.
- Una config con `{ type: 'skeleton', children: [{ type: 'paragraph', props: { text: 'ignored' } }] }` pasa validación y el nodo normalizado no expone `children` (igual que `divider`).
- Una config con `{ type: 'container', children: [{ type: 'skeleton' }] }` pasa validación (el nodo es legal dentro de un container).
- Una config con `{ type: 'repeater', props: { items: { source: 'queries.x.data', key: 'id' }, template: [{ type: 'skeleton' }] } }` pasa validación (legal dentro del template de un repeater).
- Una config en la que `queryStateFeedback.states.loading.fallback` contiene un `{ type: 'skeleton' }` pasa validación (el caso de uso primario de la feature).
- En `src/tests/dev-runtime/dev-runtime-json-schema.test.ts` se añade un caso que verifica que `JSON.stringify(getRuntimeConfigJsonSchema())` contiene `"skeleton"` (autocompletado del editor Monaco para el nuevo nodo).

#### Comandos durante la implementación
- `pnpm test --run src/tests/config-validation/runtime-config-validation-skeleton.test.ts`
- `pnpm test --run src/tests/dev-runtime/dev-runtime-json-schema.test.ts`

#### Restricciones
- Reusar `createConfigWithLayout` de `src/tests/config-validation/helpers.ts` para construir las configs de test (no introducir builders nuevos).
- Las aserciones de rechazo siguen el patrón existente `result.status === 'error'` + `result.error.message.toContain('...')`; no inspeccionar issues Zod crudos.
- No introducir cambios en la implementación de `mapLeafNodeIssue`, `mapLayoutNodeIssue`, `mapQueryStateFeedbackIssue` ni `mapVisibilityIssue`; reusarlos tal cual.
- No tocar el caso existente de `dev-runtime-json-schema.test.ts` que comprueba `container`; añadir un caso nuevo análogo.

### Documentación afectada
- `ai-workflow/docs/app-features/nodes/index.md` — el catálogo de nodos hoja deberá incorporar la entrada `skeleton.md`. La actualización se hace al final de la feature vía `update-app-documentation`; no forma parte de esta tarea.
- `ai-workflow/docs/app-features/nodes/skeleton.md` — ficha nueva. La actualización se hace al final de la feature vía `update-app-documentation`; no forma parte de esta tarea.

### Criterios de finalización
- `validateRuntimeConfig` acepta configs válidas con nodos `skeleton` y rechaza las inválidas con diagnóstico de ruta (`props.variant`, `props.lines`, `props.width`, `props.height`, `props.rounded`, `props.animate`, `layout.span`).
- `getRuntimeConfigJsonSchema()` genera un schema que contiene el discriminante `'skeleton'`.
- El fichero de test nuevo y la ampliación del fichero de Monaco pasan en verde.
- `pnpm test` sigue cumpliendo el umbral del 80 % de cobertura.

### Cierre de implementación
T1 está cerrada cuando los tipos, el esquema Zod, la validación y la unión raíz del schema están en su sitio, los tests indicados pasan en verde y `pnpm test` no rompe regresiones ni cobertura.

---

## T2 — Componente `SkeletonNode` y registro en el renderer

### Estado
completada

### Objetivo
Implementar el componente React `SkeletonNode` que renderiza las tres variantes del nodo, integrarlo en `LayoutNodeRenderer` y validar el contrato de render con tests de integración. La implementación se apoya exclusivamente en utilidades Tailwind, sin estilos inline, y respeta los defaults lógicos definidos por la spec.

Comportamiento de render por variante:

- **`rect` (default)**: un único `<div data-layout-node="skeleton">` con clases base `bg-gray-200` y `block`, más:
  - `w-{props.width}` si `props.width` está declarado; si no, ninguna clase de anchura (hereda del contenedor).
  - `h-{props.height}` si `props.height` está declarado; si no, altura por defecto `h-4`.
  - `rounded` si `props.rounded === true`.
  - `animate-pulse` salvo que `props.animate === false`.

- **`text`**: un wrapper `<div data-layout-node="skeleton">` con clases `flex flex-col gap-2`, más `animate-pulse` salvo que `props.animate === false`. Dentro renderiza `props.lines ?? 1` hijos `<div>` con clases base `bg-gray-200 h-3`, `w-{props.width}` si `props.width` está declarado o `w-full` en caso contrario, y `rounded` si `props.rounded === true`. La clase `animate-pulse` vive solo en el wrapper para evitar animaciones desincronizadas. `props.height` se ignora en esta variante (altura por línea fija).

- **`circle`**: un único `<div data-layout-node="skeleton">` con clases base `bg-gray-200 rounded-full`, más:
  - `w-{props.width} h-{props.width}` si `props.width` está declarado; si no, `w-12 h-12` por defecto.
  - `animate-pulse` salvo que `props.animate === false`.
  - `props.rounded` y `props.height` se ignoran (no añaden ni cambian clases).

Defaults aplicados en componente (no en Zod): `variant ?? 'rect'`, `lines ?? 1`, `animate ?? true`, `rounded ?? false`. El componente no resuelve referencias dinámicas (`{{...}}`) porque ninguna prop del nodo es texto; basta con leer `node.props` directamente.

### Fuera de alcance
- Cambios en `src/config/`: ya quedaron cerrados en T1.
- Helpers nuevos en `src/runtime/runtime-node-styling.ts`: la composición de clases vive dentro del componente, igual que en `divider-layout-node.tsx`. No introducir una función `getSkeletonClassName` separada salvo que el componente supere ~120 líneas y necesite extraerse por legibilidad.
- Cambios en `LayoutRenderer`, en `hasChildren` o en el contrato de `LayoutNodeRenderer` distintos del registro del nuevo nodo.
- Variantes de animación distintas de `pulse`, paletas semánticas, tamaños responsive por breakpoint y resto de extensiones marcadas explícitamente como fuera de alcance en `spec.md`.
- Documentación funcional bajo `ai-workflow/docs/`.

### Dependencias
T1.

### Impacto esperado en archivos

- Código:
  - `src/runtime/nodes/skeleton-layout-node.tsx` (nuevo) — exporta `SkeletonNode({ node, iterationContext })` con `node: SkeletonLayoutNode`. Importa `SkeletonLayoutNode` y `SkeletonVariant` desde `../../config/runtime-config` y `RuntimeIterationContext` desde `../runtime-references/runtime-reference-resolver`. Implementa el switch por variante descrito en el objetivo. `iterationContext` se acepta en la firma por consistencia con otros nodos aunque no se use internamente (el resto de nodos hoja siguen el mismo patrón).
  - `src/runtime/layout-node-renderer.tsx` — añadir `import { SkeletonNode } from './nodes/skeleton-layout-node'`; añadir el case `'skeleton'` en el switch (entre `divider` y el cierre, manteniendo el orden alfabético existente solo si el resto del switch lo respeta — si no, simplemente añadirlo junto a `divider`): `renderedNode = <SkeletonNode node={node} iterationContext={iterationContext} />`.

- Tests:
  - `src/tests/layout-renderer/layout-renderer-skeleton.test.tsx` (nuevo).

- Documentación:
  - `ai-workflow/docs/app-features/nodes/skeleton.md` (nueva) y `ai-workflow/docs/app-features/nodes/index.md` (entrada nueva en la tabla de nodos hoja). Se actualizan al final de la feature vía `update-app-documentation`; no forman parte de esta tarea.

### Tests

#### Ficheros de test
- `src/tests/layout-renderer/layout-renderer-skeleton.test.tsx` (nuevo)

#### Comportamiento cubierto
- Render por variante:
  - Un `{ type: 'skeleton' }` sin `props` renderiza un único elemento `[data-layout-node="skeleton"]` con clases `bg-gray-200`, `h-4`, `block` y `animate-pulse`, sin `rounded` ni `rounded-full`.
  - Un `{ type: 'skeleton', props: { variant: 'rect', width: '32', height: '8', rounded: true } }` renderiza un único elemento con `w-32`, `h-8`, `rounded` y `bg-gray-200`.
  - Un `{ type: 'skeleton', props: { variant: 'rect', animate: false } }` no añade `animate-pulse` al elemento.
  - Un `{ type: 'skeleton', props: { variant: 'text', lines: 3 } }` renderiza un wrapper `[data-layout-node="skeleton"]` con clases `flex`, `flex-col`, `gap-2` y `animate-pulse`, y contiene exactamente 3 hijos directos con clases `bg-gray-200`, `h-3` y `w-full`.
  - Un `{ type: 'skeleton', props: { variant: 'text' } }` (sin `lines`) renderiza exactamente 1 hijo (default `lines: 1`).
  - Un `{ type: 'skeleton', props: { variant: 'text', lines: 2, width: '1/2', rounded: true } }` renderiza 2 hijos con clases `w-1/2` y `rounded`, sin `w-full`.
  - Un `{ type: 'skeleton', props: { variant: 'text', animate: false } }` no añade `animate-pulse` al wrapper.
  - Un `{ type: 'skeleton', props: { variant: 'circle' } }` renderiza un único elemento con clases `w-12`, `h-12`, `rounded-full`, `bg-gray-200` y `animate-pulse`.
  - Un `{ type: 'skeleton', props: { variant: 'circle', width: '20' } }` renderiza un único elemento con `w-20`, `h-20` y `rounded-full`.
  - Un `{ type: 'skeleton', props: { variant: 'circle', height: '4', rounded: true } }` ignora `height` y `rounded`: las clases del elemento contienen `rounded-full` pero no `h-4` ni el `rounded` no-full.
  - Un `{ type: 'skeleton', props: { variant: 'circle', animate: false } }` no añade `animate-pulse`.
  - Un `{ type: 'skeleton', props: { variant: 'rect', lines: 3 } }` renderiza un único elemento (sin hijos línea); `lines` se ignora en `rect`.
  - Un `{ type: 'skeleton', props: { variant: 'rect', width: '32', height: '8' } }` no añade ni `rounded-full` ni `space-y-2`.

- Integraciones transversales:
  - Un skeleton con `visibility` que evalúa a oculto no aparece en el DOM.
  - Un skeleton con `visibility` que evalúa a visible sí aparece.
  - Un skeleton con `layout.span: 6` dentro de un `container` con `props.columns: 12` queda envuelto en un `<div class="col-span-6">`, dentro del cual existe el elemento `[data-layout-node="skeleton"]`.
  - Un skeleton dentro del `template` de un `repeater` cuyo source resuelve a 2 items renderiza exactamente 2 elementos `[data-layout-node="skeleton"]`.

- Caso de uso primario `queryStateFeedback`:
  - Un nodo con `queryStateFeedback.states.loading.fallback: [{ type: 'skeleton', props: { variant: 'text', lines: 2 } }]` y la query en estado `loading` muestra el wrapper `[data-layout-node="skeleton"]` con 2 hijos línea, envuelto por el `role="status"` que ya añade el renderer para el estado de carga.

#### Comandos durante la implementación
- `pnpm test --run src/tests/layout-renderer/layout-renderer-skeleton.test.tsx`
- `pnpm test --run src/tests/layout-renderer/layout-renderer-divider.test.tsx`

#### Restricciones
- Reusar los helpers locales `renderRuntimePage`, `renderRuntimePageWithState` y `createRuntimePageState` siguiendo el patrón de `layout-renderer-divider.test.tsx`; no extraerlos a un fichero compartido en esta tarea.
- Comprobar la presencia de clases Tailwind con `toHaveClass` o consultando `classList`; no comparar `className` como cadena completa.
- Para contar hijos de la variante `text`, usar `querySelectorAll` sobre los hijos directos del wrapper (`wrapper.children`), no contar todos los descendientes del documento.
- No introducir snapshots de DOM completos.
- El test de `queryStateFeedback` debe construir el estado mínimo necesario reusando `createRuntimePageState` con una query en estado `loading`, igual que hace `layout-renderer-state-feedback.test.tsx` para otros nodos.

### Documentación afectada
- `ai-workflow/docs/app-features/nodes/skeleton.md` — ficha nueva con contrato (props), comportamiento por variante, validación específica, límites y casos límite.
- `ai-workflow/docs/app-features/nodes/index.md` — añadir la entrada `skeleton.md` en la sección "Nodos hoja visibles" del catálogo.

La actualización documental se ejecuta al cerrar las tareas de implementación vía `update-app-documentation`; no forma parte de esta tarea.

### Criterios de finalización
- `SkeletonNode` renderiza correctamente las tres variantes con las clases Tailwind descritas y respeta los defaults lógicos.
- El nodo está registrado en `LayoutNodeRenderer` y se renderiza para cualquier `type: 'skeleton'` válido en la config.
- El fichero de test nuevo pasa en verde y los tests existentes siguen verdes.
- `pnpm test` sigue cumpliendo el umbral del 80 % de cobertura.

### Cierre de implementación
T2 está cerrada cuando el componente y su registro están en su sitio, los tests del fichero nuevo y los tests previos pasan en verde, y `pnpm test` no rompe regresiones ni cobertura. Al cerrar T2 la feature queda lista para invocar `update-app-documentation`, que se encarga de crear `ai-workflow/docs/app-features/nodes/skeleton.md` y de añadir la entrada en `ai-workflow/docs/app-features/nodes/index.md`.

---

## Próxima tarea
T1 — Tipos, esquema Zod, validación y registro del nodo `skeleton`.
