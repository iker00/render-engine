# Design: Feature 0106 — Indicador vertical y zonas de inserción intermedias en `container` grid (canvas modo Editor)

## Contexto

- La spec de esta feature ya cerró el comportamiento funcional: indicador visual vertical en las 2 zonas
  límite ya existentes y N-1 zonas de inserción intermedias adicionales para un `container` grid, sin desplazar
  la posición de columna/fila de los hijos reales respecto al modo Visual. La spec deja explícitamente para el
  design la estrategia técnica de posicionar esas zonas.
- La feature 0105/T1 dejó el estado actual del render de drop-zones en `src/runtime/layout-renderer.tsx`
  (`LayoutRenderer` + `LayoutCanvasDropZoneGap`). Cada zona es un `<div data-drop-zone="…" className="h-1 min-w-1">`
  registrado como `useDroppable`. Para un padre grid (`parentGridColumns !== null`) solo se emiten las 2 zonas
  límite (índice `0` y `N`) con `style={{ gridColumn: '1 / -1' }}` para que ocupen su propia fila y no compitan
  por una celda con los hijos reales. Ese `1 / -1` es exactamente lo que hace que el indicador se perciba como
  una franja horizontal.
- Los hijos del `container` participan directamente en el grid CSS con `grid-auto-flow: row`; su posición de
  columna/fila viene del propio grid y, cuando aplica, de `layout.span` (`col-span-*`) aplicado sobre el hijo por
  `runtime-node-styling.ts` (`getGridChildSpanClassName`, `normalizeResponsiveLayoutValue`). No hay wrappers
  intermedios entre `<section data-layout-node="container">` y cada hijo.
- El indicador visual verde/rojo durante el arrastre se aplica imperativamente por
  `LayoutCanvasDndContext` (`src/dev-runtime/layout-canvas/layout-canvas-dnd-context.tsx`) sobre el elemento
  del DOM identificado por el selector `[data-drop-zone="…"]` mediante `outline outline-2 -outline-offset-2
  outline-emerald-500` (o `outline-red-500`). Es el propio bounding box del `<div>` de la zona el que define
  cómo se ve el outline: si el elemento es una franja horizontal, se percibe como línea horizontal; si es una
  barra vertical fina, se percibe como barra vertical.
- La identidad de destino de cada zona es `{ parentPath, index, tabItemIndex? }` (`layout-node-path.ts`), y el
  commit (`layout-canvas/dev-editor-layer.tsx` → `insertNodeAt` / `movePathTo` en
  `layout-tree-mutations.ts`) actúa por índice ordinal en la colección de hermanos, no por geometría del grid.
  Es decir, el ordinal ya funciona para las nuevas zonas intermedias en cuanto exista un elemento droppable con
  el `id` serializado correcto: no hay cambios necesarios en validación de destino, en el pipeline de commit,
  ni en la mutación del árbol.
- `container.props.columns` puede ser un entero fijo `1..12` o el mapa responsive
  `Partial<Record<'base'|'sm'|'md'|'lg'|'xl'|'2xl', number>>`. Hoy `LayoutRenderer` solo usa el valor como
  booleano (`isGridParent`), no inspecciona su shape.
- Restricción arquitectónica ya vigente: `src/runtime/` no debe importar de `src/dev-runtime/`
  (`architecture.md`). Las zonas de drop viven en `src/runtime/layout-renderer.tsx` porque el árbol Editor es
  el mismo árbol real renderizado; ese fichero está permitido para código drop-only-in-Edit-mode gated por
  `LayoutEditModeContext`, tal como se hizo en 0102/0105.

## Objetivos / No objetivos

### Objetivos
- Que las 2 zonas límite ya existentes de un `container` grid dejen de percibirse como una franja horizontal
  de fila completa y pasen a percibirse como una barra vertical anclada al borde izquierdo del primer hijo o
  al borde derecho del último hijo, con la altura de la fila donde se sitúa ese hijo.
- Añadir N-1 zonas de inserción intermedias entre cada par de hijos consecutivos del grid, mostradas también
  como barra vertical con la altura de la fila donde se ubican.
- Preservar el invariante 0105/RF1: ninguna zona (límite o intermedia) puede desplazar la posición de
  columna/fila de los hijos reales respecto al modo Visual. Ni introducir wrappers en producción, ni cambiar
  el contrato JSON, ni tocar la validación previa al render.
- Reutilizar sin cambios la mecánica ya vigente: `useDroppable`, `serializeDropZoneId({parentPath, index,
  tabItemIndex})`, `[data-drop-zone]`, outline verde/rojo aplicado por `LayoutCanvasDndContext`, `parseDropAttempt`,
  reglas de destino (`isValidDropTarget`) y commit (`insertNodeAt` / `movePathTo`).
- Mantener funcionamiento correcto en `columns` fijo y responsive (mapa por breakpoint), en cualquier
  breakpoint activo.

### No objetivos
- No cambiar el render en modo Visual/producción de `container` ni de ningún nodo.
- No modificar `container.props.columns`, `layout.span`, `getContainerNodeStyling`, `getGridChildSpanClassName`
  ni `normalizeResponsiveLayoutValue`.
- No modificar `isValidDropTarget`, `layout-tree-mutations.ts`, `layout-canvas-commit.ts` ni el pipeline de
  sincronización con Monaco.
- No introducir wrappers per-child en el árbol renderizado (rechazado explícitamente en Decisión 2 más abajo).
- No añadir deshacer/rehacer, selección múltiple, ni cambiar el tratamiento visual de `EmptyContainerPlaceholder`
  (placeholder de contenedor/formulario vacío se mantiene igual y no aplica RF1/RF2).
- No añadir soporte de zonas droppable propias para `tabItem` de `tabs` o cuerpo de `accordion` vacíos
  (limitación conocida separada, fuera del alcance de esta feature).

## Decisiones

### Decisión 1 — Estrategia técnica: overlay absoluto medido, no participación en el grid

Las zonas de inserción de un `container` grid en modo Editor se renderizan como una capa overlay
`position: absolute` **hija directa** del `<section data-layout-node="container">`, cuyos elementos droppable
se posicionan por medición real (`getBoundingClientRect`) de los hijos reales del grid.

Concretamente:
- En modo Editor, cuando el padre está en modo grid (`parentGridColumns !== null`), `LayoutRenderer`:
  - Renderiza los hijos reales exactamente como hoy en Visual, sin intercalar `<div>`s de drop-zone entre
    ellos y sin envolverlos.
  - Renderiza además un componente overlay al final (un único elemento hermano de los hijos), que:
    - Es `position: absolute; inset: 0; pointer-events: none;` para no consumir celda del grid ni interceptar
      clicks.
    - Contiene N+1 `<div data-drop-zone="…">` como hijos internos, cada uno con `position: absolute`,
      `pointer-events: auto`, y `top/left/width/height` calculados en `useLayoutEffect` a partir de las rects
      de los hijos reales del `<section>` medidas con `getBoundingClientRect`.
    - Se re-mide con `ResizeObserver` sobre el `<section>` (y sobre cada hijo real observado) para reaccionar
      a cambios de breakpoint, cambios de tamaño de hijos y cambios estructurales del layout.
- El `<section data-layout-node="container">` recibe `position: relative` **solo cuando el `<section>` está
  bajo un `LayoutEditModeContext` activo Y en modo grid** (gate ya disponible via
  `useLayoutEditModeContext()`), para que el overlay tenga ancestro de posicionamiento estable. En modo
  Visual/producción, `<section>` sigue sin `position: relative`. Este es el único cambio observable en el DOM
  del `container` en modo Editor respecto a hoy, y no afecta a la disposición de los hijos.
- La zona overlay se marca con un atributo neutro (`data-canvas-grid-drop-zones` o similar) para poder
  identificarla y excluirla al iterar hijos reales del `<section>` en la fase de medición.

**Alternativas descartadas:**
- *Wrapping per-child (envolver cada hijo en un `<div>` cell-wrapper con `position: relative` y drop-zones
  absolutas dentro):* requiere hoistar `col-span-*` y otras clases de participación en grid desde el hijo al
  wrapper, cambia la estructura del DOM del árbol Editor respecto al árbol Visual (rompe la garantía "el
  árbol editado ES el árbol renderizado"), y toca `layout-node-renderer.tsx` y `runtime-node-styling.ts` en
  puntos delicados. Trade-off no justificado frente a la medición.
- *Zonas con `grid-column-start` explícito compartiendo celda con el hijo:* requiere calcular la celda de
  cada hijo (columna, fila) desde el runtime, lo que implica reimplementar la lógica de auto-flow del grid en
  JS y mantener sincronía con `layout.span` y breakpoints. Frágil, alto coste de mantenimiento y difícil de
  probar de forma determinista frente a los cambios de estilo del grid.
- *Mantener el enfoque de 0105 y solo cambiar la geometría del `<div>` de zona (por ejemplo `grid-column: 1 /
  2; justify-self: start; width: 4px; height: 100%;`):* el `<div>` seguiría ocupando su propia celda del grid
  y desplazaría a los hijos, reintroduciendo el bug corregido en 0105/RF1.

**Coste asumido:** una medición y una capa overlay por cada `container` grid en modo Editor, más un
`ResizeObserver` por `<section>` grid y por cada hijo real observado. El coste es despreciable en el orden de
magnitud habitual de un `container` (unidades de hijos). No se re-mide durante el drag: la geometría no cambia
mientras se arrastra.

**Riesgo residual:** timing de medición si el layout aún no está pintado la primera vez.
`useLayoutEffect` + `ResizeObserver` cubre el caso general; para el primer render también se dispara el
observer con la rect inicial. Un test en jsdom debe mockear `ResizeObserver` y `getBoundingClientRect` para
poder ejercitar el cálculo de posiciones puro (ver Decisión 6).

### Decisión 2 — Ubicación del código y frontera de capa

- Todo el nuevo código vive en `src/runtime/`:
  - `LayoutRenderer` (`src/runtime/layout-renderer.tsx`) sigue orquestando la emisión de zonas y sustituye el
    branch actual "grid → 2 gaps con `1 / -1`" por "grid → renderizar overlay medido con N+1 zonas".
  - Un componente nuevo, `LayoutCanvasGridDropZonesOverlay` (o nombre equivalente coherente con
    `LayoutCanvasDropZoneGap`), vive en `src/runtime/layout-renderer.tsx` o en un módulo hermano nuevo
    `src/runtime/layout-canvas-grid-drop-zones.tsx` (decisión de granularidad reservada a la fase de
    planificación de tareas). Encapsula: overlay, refs, `useLayoutEffect`, `ResizeObserver` y render de las
    N+1 zonas absolutas.
  - Una función pura de cálculo de posiciones (por ejemplo `computeGridDropZoneRects(children: DOMRectLike[])
    → Array<{ index, top, left, width, height, tabItemIndex? }>`) para poder testear la lógica de layout sin
    montar el DOM.
- `ContainerNode` (`src/runtime/nodes/container-layout-node.tsx`) recibe el gate mínimo necesario para
  aplicar `position: relative` a `<section>` solo cuando corresponda (contexto de edición activo Y modo grid).
  No se abre theming ni una API visual paralela: es una única clase Tailwind (`relative`) aplicada
  condicionalmente al `className` del `<section>`.
- No se introduce ninguna importación cruzada `src/runtime/ → src/dev-runtime/` (frontera arquitectónica
  intacta). El overlay usa `LayoutEditModeContext` (ya en `src/runtime/`) para saber si está activo, y expone
  los mismos `data-drop-zone` que consume `LayoutCanvasDndContext` desde `src/dev-runtime/` — el contrato
  entre ambas capas no cambia.

### Decisión 3 — Modelo de zonas y semántica ordinal

- Para N hijos se emiten N+1 zonas con `index ∈ {0, 1, …, N}`, misma convención que el modo no-grid actual.
- La identidad droppable y el commit siguen siendo puramente ordinales: `{parentPath, index, tabItemIndex?}`
  se serializa igual con `serializeDropZoneId`, y `insertNodeAt`/`movePathTo` ya operan por índice en la
  colección `children`. No hace falta ningún cambio en `layout-tree-mutations.ts` ni en `dev-editor-layer.tsx`.
- Cuando el `container` grid está vacío (N=0), se sigue usando `EmptyContainerPlaceholder` (borde punteado
  seleccionable y droppable, ya vigente). El overlay grid no se monta en ese caso; el placeholder ya cubre
  index `0`.

### Decisión 4 — Geometría de cada zona

Regla uniforme para las N+1 zonas:
- **Zona `index = 0` (antes del primer hijo):** barra vertical de ancho fijo (`W`) anclada al borde
  izquierdo del hijo `0`. `top = child[0].top`; `left = child[0].left − W/2` (o `− W`, según ajuste fino, ver
  "Ajustes visuales" abajo); `height = child[0].height`.
- **Zona `index = i` intermedia (1 ≤ i ≤ N-1):**
  - Si `child[i-1]` y `child[i]` están en la misma fila (mismo `top` con tolerancia de píxeles): barra
    vertical centrada en el hueco entre ellos. `top = child[i].top`; `left = round((child[i-1].right +
    child[i].left) / 2) − W/2`; `height = child[i].height` (o `max(child[i-1].height, child[i].height)` si
    difieren, ver "Ajustes visuales").
  - Si `child[i]` está en una fila distinta de `child[i-1]` (envoltorio por wrap): barra vertical anclada al
    borde izquierdo de `child[i]` (start de la nueva fila). `top = child[i].top`; `left = child[i].left − W/2`;
    `height = child[i].height`. Esta es la decisión de diseño para la zona "de salto de fila" mencionada en
    los casos límite de la spec, y comunica visualmente al usuario que la inserción ocurre al comienzo de la
    fila destino.
- **Zona `index = N` (después del último hijo):** barra vertical anclada al borde derecho del hijo `N-1`.
  `top = child[N-1].top`; `left = child[N-1].right + W/2`; `height = child[N-1].height`.
- Coordenadas siempre relativas al `<section>` grid (restar `<section>.getBoundingClientRect()` a las rects
  de hijos).
- `W` (ancho geométrico de la zona droppable/outline) queda como constante local del módulo. Un valor
  orientativo es `8px` — suficiente para ser un target de arrastre generoso sin invadir visiblemente el hijo
  cuando se aplica el outline con `-outline-offset-2`. La decisión final del valor exacto es de
  implementación menor.
- El elemento droppable no lleva fondo visible en reposo; el outline verde/rojo aplicado por
  `LayoutCanvasDndContext` es lo que lo hace visible durante el arrastre, exactamente como hoy.

**Ajustes visuales menores** que quedan como decisión de implementación (no comprometen alcance ni contrato):
- Si `left` calculado queda fuera del `<section>` (por ejemplo la zona `0` con el primer hijo pegado al borde
  izquierdo, o la zona `N` con el último hijo pegado al derecho), se clampa dentro del `<section>` para que la
  barra siga siendo visible.
- Si dos hijos consecutivos en la misma fila tienen alturas distintas (por ejemplo por contenido con altura
  intrínseca variable), el design admite tanto "usar la altura del hijo destino" como "usar el máximo de las
  dos". Se recomienda "hijo destino" (`child[i]`) por consistencia con la regla del caso wrap, pero la spec
  no lo bloquea.

### Decisión 5 — Reactividad a cambios de tamaño y breakpoint

- `useLayoutEffect` recalcula las posiciones al montar y ante cambios de `nodes.length` o de `path`.
- Un único `ResizeObserver` observa:
  - el `<section>` grid (para reaccionar a cambios de ancho, columnas responsive y por tanto reflow),
  - cada hijo real (para reaccionar a cambios de altura por contenido dinámico).
- El observer se registra/limpia en el ciclo de vida del overlay; se recomputa la lista de hijos observados
  cada vez que `nodes.length` cambie.
- No se re-mide durante el drag: la geometría de los hijos no cambia mientras se arrastra un nodo en el
  editor (los commits son atómicos al soltar).

### Decisión 6 — Tests

- **Unit tests de la función pura de cálculo de posiciones** (`computeGridDropZoneRects`) con arrays de
  rects sintéticas, cubriendo: 1 hijo, 2 hijos en misma fila, N hijos con salto de fila, ancho del `<section>`
  distinto, alturas de hijos distintas. Este es el corazón testeable sin DOM real.
- **Tests de integración en jsdom** con `LayoutEditModeProvider` activo y `RuntimeLayoutContextProvider`
  simulando `parentGridColumns`, mockeando `ResizeObserver` y `getBoundingClientRect` para verificar:
  - El DOM contiene exactamente N+1 `[data-drop-zone]` dentro del overlay grid.
  - Los `id` serializados corresponden a `{parentPath, index=0..N, tabItemIndex?}`.
  - El overlay tiene `position: absolute; inset: 0; pointer-events: none;` y sus zonas
    `pointer-events: auto`.
  - En modo Visual (sin provider o `active: false`) no se monta overlay ni cambia el DOM del `<section>`.
  - `container` sin `columns` sigue emitiendo N+1 gaps en el flujo normal (regresión, sin cambios respecto a
    hoy).
- **Regresión de 0105/RF1** en `layout-renderer-container.test.tsx`: el orden y las clases `col-span-*` de
  los hijos reales de un grid en Editor coinciden con Visual, incluso con el overlay presente.
- **Regresión responsive**: `columns` como mapa por breakpoint sigue funcionando sin regresión visible en la
  disposición de los hijos.
- **Integración con drop indicator**: el outline verde/rojo se sigue aplicando sobre `[data-drop-zone]`
  correctamente en las nuevas zonas.
- El detalle final del reparto de comportamiento cubierto por fichero (ampliar
  `dev-runtime/layout-canvas-grid-drop-zones.test.tsx`, `layout-renderer/layout-renderer-container.test.tsx`,
  crear un nuevo fichero para la función pura si aplica) queda para la fase de planificación.

### Decisión 7 — Documentación afectada

- `ai-workflow/docs/app-features/development/dev-mode-editor.md`, sección "Reordenar y reanidar por
  arrastre (modo Editor)": retirar la limitación conocida actual sobre ausencia de zonas de inserción
  intermedias en modo grid, y describir el nuevo comportamiento (barra vertical + zonas intermedias con
  altura de fila). No hay que abrir sección nueva; se ajusta la ya existente.

## Riesgos y trade-offs

- **Complejidad añadida en `src/runtime/`:** se introduce medición DOM + `ResizeObserver` + `useLayoutEffect`
  en la capa runtime, que hasta ahora describía render sin medición. Está acotado: gated por
  `LayoutEditModeContext` activo Y modo grid; en Visual/producción no ejecuta nada. Mitigación: la lógica de
  cálculo va en una función pura testeable sin DOM.
- **Timing de medición en frames iniciales:** si el `<section>` se monta con hijos aún sin layout final (por
  ejemplo cargando fuente o imagen), las primeras rects pueden ser imprecisas. `ResizeObserver` dispara al
  primer layout y en subsecuentes cambios; en la práctica el usuario no interactúa con drop zones antes de
  ese primer paint. Riesgo residual bajo.
- **Coste de re-render por resize:** si el usuario redimensiona el viewport de forma continua, el overlay
  se re-renderiza. Se mitiga guardando las posiciones calculadas en refs/estado local del overlay (no
  propagar a `LayoutRenderer` ni al árbol padre).
- **Regresión visual involuntaria en `<section>`:** aplicar `position: relative` en modo Editor podría
  interactuar con `layout.span` u otros wrappers cercanos. Mitigación: `relative` no crea nuevo contexto de
  layout ni afecta a la propia participación del `<section>` en un grid padre si a su vez el `<section>` es
  hijo de otro grid. Cubrir con test de anidamiento (grid dentro de grid con al menos un `<section>` con
  Editor activo).
- **Salto de fila (wrap):** la elección de anclar la zona intermedia al inicio del hijo `i` (arranque de la
  nueva fila) es una convención razonable pero no la única. Si en el futuro producto pide anclar al final del
  hijo `i-1` (tail de la fila previa), es un cambio localizado en `computeGridDropZoneRects` sin impacto en
  el resto del sistema.

## Migración o despliegue

- No aplica: cambio puramente en el modo Editor del `DevRuntime`. Sin migración de datos, sin cambio de
  contrato JSON, sin flags de despliegue. Compatible en caliente con cualquier `config.json` existente.

## Preguntas abiertas

- Ninguna bloqueante. Los ajustes visuales menores señalados (ancho exacto `W`, política de altura ante
  hijos de altura distinta, clamp cerca del borde del `<section>`) son decisiones de implementación acotadas y
  se resolverán en la fase de tareas sin reabrir esta fase.

---

**Siguiente paso del flujo:** `generate-implementation-plan`.
