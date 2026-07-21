# Tasks: 0106 — Indicador vertical y zonas de inserción intermedias en `container` grid (canvas modo Editor)

## Contexto

Dos tareas atómicas y secuenciales que materializan la Decisión 1 del `design.md`: un overlay
absoluto medido dentro de cada `<section data-layout-node="container">` en modo Editor cuando el
padre está en modo grid, cuya geometría se calcula a partir de las rects reales de los hijos.

- **T1** entrega la lógica pura de cálculo de posiciones (`computeGridDropZoneRects`) en un módulo
  nuevo, con tests unitarios que ejercitan la geometría sin montar DOM real. Es la unidad más
  pequeña verificable y desbloquea T2.
- **T2** entrega el componente overlay (`LayoutCanvasGridDropZonesOverlay`), lo integra en
  `LayoutRenderer` sustituyendo el branch actual "grid → 2 gaps con `grid-column: 1 / -1`", aplica
  `position: relative` condicional en `ContainerNode` sólo bajo `LayoutEditModeContext` activo Y
  modo grid, y cubre RF1 + RF2 + regresiones (0105/RF1, contenedores sin `columns`, indicador de
  validez del drop).

Orden obligatorio: T1 → T2. T2 depende de la función pura ya expuesta por T1.

Ninguna tarea altera el modo Visual/producción, el contrato JSON, la validación previa al render,
`isValidDropTarget`, `layout-tree-mutations.ts`, `layout-canvas-commit.ts` ni el pipeline de
sincronización con Monaco (ver "No objetivos" del `design.md`).

---

## T1 — Función pura `computeGridDropZoneRects`

### Estado
completada

### Objetivo
Aportar la lógica pura y determinista que, dadas las rects (relativas al `<section>` grid) de los
`N` hijos reales de un `container` en modo grid, devuelve las coordenadas absolutas de las `N+1`
zonas de inserción overlay (`{ index, top, left, width, height }`), aplicando la Decisión 4 del
`design.md` (barra vertical fija de ancho `W`, misma fila salvo salto por wrap, ancla al inicio del
hijo destino en el caso wrap, clamp dentro del `<section>` cuando el `left` cae fuera).

La función es el corazón testeable de la solución: T2 la consume desde el componente overlay sin
reimplementarla.

### Fuera de alcance
- No renderiza nada, no toca el DOM, no importa React ni `@dnd-kit/core`.
- No define el componente overlay, no configura `ResizeObserver`, no serializa `data-drop-zone`
  (T2).
- No modifica `LayoutRenderer`, `ContainerNode` ni la lógica de commit del canvas.
- No decide la política visual final de casos ambiguos si el `design.md` ya la fija: la regla
  wrap = "ancla al inicio del hijo destino" es la del design; no proponer alternativas.
- No añade una segunda función auxiliar salvo que sea necesaria para mantener legibilidad; toda la
  lógica de casos "misma fila", "wrap", "clamp" vive dentro de `computeGridDropZoneRects`.

### Dependencias
Ninguna.

### Impacto esperado en archivos
- Código:
    - `src/runtime/layout-canvas-grid-drop-zones.tsx` (nuevo): exportar la función pura
      `computeGridDropZoneRects` con firma equivalente a:
      ```
      interface DropZoneRectInput { top: number; left: number; right: number; bottom: number; width: number; height: number }
      interface SectionRectInput { width: number; height: number }
      interface GridDropZoneRect { index: number; top: number; left: number; width: number; height: number }
      export function computeGridDropZoneRects(
        childRects: readonly DropZoneRectInput[],
        sectionRect: SectionRectInput,
        options?: { zoneWidth?: number; sameRowTolerance?: number }
      ): GridDropZoneRect[]
      ```
      Constante local `DEFAULT_ZONE_WIDTH = 8` (Decisión 4). Constante local
      `DEFAULT_SAME_ROW_TOLERANCE = 1` (píxeles) para el criterio "misma fila" (comparación de
      `top` con tolerancia). Devuelve `[]` cuando `childRects.length === 0` (el `EmptyContainerPlaceholder`
      cubre ese caso; el overlay grid no se monta, ver Decisión 3).
    - `src/tests/runtime/runtime-grid-drop-zone-rects.test.ts` (nuevo): tests unitarios de la
      función pura (ver sub-bloque "tests" abajo). Ubicación en `runtime/` por consistencia con
      `runtime-node-styling.test.ts` (pura, sin DOM ni React).
- Tests:
    - `src/tests/runtime/runtime-grid-drop-zone-rects.test.ts` (nuevo).
- Documentación:
    - Ninguna. La función pura es un detalle interno; no forma parte del contrato observable
      documentado.

### Tests

- **Ficheros de test**:
    - `src/tests/runtime/runtime-grid-drop-zone-rects.test.ts` (nuevo).

- **Comportamiento cubierto**:
    - Para `childRects` de longitud `0`, la función devuelve `[]` (el overlay no se monta en ese
      caso).
    - Para 1 hijo en `top: 0, left: 20, right: 120, height: 40, width: 100` y
      `sectionRect: { width: 200, height: 40 }`, devuelve 2 zonas con `index: 0` y `index: 1`,
      ambas con `height: 40` y `top: 0`; la zona `0` tiene `left = 20 - W/2` y `width: W`; la zona
      `1` tiene `left = 120 - W/2` y `width: W`. (`W = 8` por defecto).
    - Para 3 hijos en la misma fila con hueco entre ellos (por ejemplo `right/left` respectivos
      `[120, 200]` y `[140, 220]`), devuelve 4 zonas; la zona `1` (entre hijo 0 y hijo 1) queda
      centrada en `round((child[0].right + child[1].left) / 2) − W/2`; la zona `2` centrada en
      `round((child[1].right + child[2].left) / 2) − W/2`; la zona `3` en `child[2].right - W/2`.
    - Con 3 hijos en la misma fila, la altura de cada zona intermedia es la del hijo destino
      (`child[i].height`), coherente con la regla del caso wrap (design.md Decisión 4).
    - Con 4 hijos donde `child[0]` y `child[1]` comparten `top: 0` y `child[2]`, `child[3]`
      comparten `top: 60` (wrap), las zonas `0` y `1` se ubican en la fila `0` y las zonas
      intermedias en el salto de fila (`index: 2`) se anclan al inicio de `child[2]`
      (`top: 60`, `left: child[2].left − W/2`, `height: child[2].height`). La zona `3` sigue la
      regla "misma fila" respecto a `child[2]` y `child[3]`; la zona `4` (final) se ancla al borde
      derecho de `child[3]`.
    - Cuando `child[0].left` es menor que `W/2` (primer hijo pegado al borde izquierdo del
      `<section>`), la zona `0` clampa su `left` a `0` para permanecer visible dentro del
      `<section>`.
    - Cuando `child[N-1].right + W/2` excede `sectionRect.width` (último hijo pegado al borde
      derecho del `<section>`), la zona `N` clampa su `left` a `sectionRect.width − W` para
      permanecer visible.
    - Con `options.zoneWidth: 4`, todas las zonas devueltas tienen `width: 4` y sus `left`
      reflejan el nuevo `W`; regresión de configurabilidad del ancho.
    - Con `options.sameRowTolerance: 2`, dos hijos con `top: 0` y `top: 1` respectivamente se
      consideran misma fila y la zona intermedia entre ellos aplica la regla "centrada en el
      hueco" (no la regla wrap).
    - Con 2 hijos en la misma fila cuyas alturas difieren (`child[0].height = 40`,
      `child[1].height = 80`), la zona intermedia `1` usa `height: child[1].height` (hijo destino,
      Decisión 4 preferida). La zona `2` (final) usa `height: child[1].height`.
    - Regresión: los índices devueltos son estrictamente `0, 1, ..., N` en ese orden y ningún
      `index` se repite ni se salta.

- **Comandos durante la implementación**:
    - `pnpm test --run src/tests/runtime/runtime-grid-drop-zone-rects.test.ts`

- **Restricciones**:
    - La función no debe leer del DOM ni depender de `window`; recibe todo lo que necesita como
      parámetros. Tests deterministas.
    - No usar `Math.random` ni fechas.
    - Mantener las constantes `DEFAULT_ZONE_WIDTH` y `DEFAULT_SAME_ROW_TOLERANCE` como constantes
      locales nombradas del módulo (no inline mágico).
    - No exportar helpers privados del módulo; el contrato público es `computeGridDropZoneRects`.
    - Interpretación uniforme del anclaje al borde para las zonas límite: **la zona `0` y la
      zona `N` straddlean el borde correspondiente**, con `left = child[0].left − W/2` y
      `left = child[N-1].right − W/2` respectivamente. El design.md §Decisión 4 escribe
      `left = child[N-1].right + W/2` para la zona `N`, pero esa fórmula deja la barra siempre
      fuera del `<section>` (contradice tanto la descripción textual "anclada al borde derecho
      del hijo N-1" como la regla de clamp del propio design, que sólo tiene sentido si el
      straddle es la geometría base). Se aplica la simetría con la zona `0` como interpretación
      canónica; el ajuste queda encajado en el margen "Ajustes visuales menores" que el propio
      design contempla.

### Documentación afectada
- Ninguna.

### Criterios de finalización
- El fichero de test listado está en verde.
- No se ha modificado ningún fichero fuera de los declarados en "Impacto esperado en archivos".
- La suite global `pnpm test` sigue en verde (regresión mínima esperada: cero, la función es nueva).

### Cierre de implementación
Código y tests de la tarea completos, `pnpm test --run` sobre el fichero listado en verde, y sin
regresiones en la suite global.

### Cierre documental
No aplica: T1 no altera ningún contrato observable ni comportamiento documentado. La
actualización documental de la feature vive íntegramente en T2 (ver su "Cierre documental").

---

## T2 — Overlay `LayoutCanvasGridDropZonesOverlay` e integración en `LayoutRenderer` y `ContainerNode`

### Estado
completada

### Objetivo
Sustituir el branch actual "grid → 2 gaps con `grid-column: 1 / -1`" de `LayoutRenderer` por un
overlay medido `LayoutCanvasGridDropZonesOverlay` que renderiza `N+1` zonas droppable posicionadas
por `computeGridDropZoneRects` (T1), reactivas a cambios de tamaño mediante `ResizeObserver`, y
aplica `position: relative` al `<section data-layout-node="container">` sólo cuando
`LayoutEditModeContext` está activo Y el propio `container` está en modo grid, para que el overlay
tenga ancestro de posicionamiento estable.

Materializa RF1 (indicador vertical de las zonas límite) y RF2 (zonas intermedias adicionales)
sobre la misma unidad de código: ambos comportamientos son consecuencia directa del overlay + la
función pura ya entregada por T1.

### Fuera de alcance
- No modifica la función `computeGridDropZoneRects` (T1); sólo la consume.
- No modifica `isValidDropTarget`, `layout-tree-mutations.ts`, `layout-canvas-commit.ts`,
  `LayoutCanvasDndContext`, `parseDropAttempt`, `serializeDropZoneId` ni el flujo end-to-end de
  commit/sincronización.
- No modifica el render de contenedores sin `columns` (flex/row/column): la rama no-grid de
  `LayoutRenderer` mantiene `LayoutCanvasDropZoneGap` tal cual está hoy.
- No introduce wrappers per-child en el árbol renderizado (Alternativa descartada en Decisión 1).
- No añade zonas droppable propias para `tabItem` de `tabs` o cuerpo de `accordion` vacíos
  (limitación conocida separada, fuera de alcance).
- No toca `EmptyContainerPlaceholder`; un `container` grid vacío sigue mostrando el placeholder y
  el overlay no se monta.
- No introduce importaciones cruzadas `src/runtime/ → src/dev-runtime/` (frontera arquitectónica
  intacta).
- No añade dependencias nuevas al proyecto.

### Dependencias
- T1 completada: `computeGridDropZoneRects` disponible y con tests en verde.

### Impacto esperado en archivos
- Código:
    - `src/runtime/layout-canvas-grid-drop-zones.tsx` (modificar, ya creado en T1): añadir el
      componente `LayoutCanvasGridDropZonesOverlay` con la firma:
      ```
      interface LayoutCanvasGridDropZonesOverlayProps {
        parentPath: LayoutNodePath
        childCount: number
        tabItemIndex?: number
      }
      export function LayoutCanvasGridDropZonesOverlay(props: LayoutCanvasGridDropZonesOverlayProps): ReactElement
      ```
      Detalles:
        - Ref al propio overlay (`<div>` raíz `position: absolute inset-0 pointer-events-none`,
          con `data-canvas-grid-drop-zones=""` para poder identificarlo y excluirlo al iterar
          hijos reales durante la medición).
        - En `useLayoutEffect`: leer `overlayRef.current?.parentElement` para obtener el
          `<section>` grid ancestro directo, medir su `getBoundingClientRect`, iterar
          `parentElement.children` filtrando el propio overlay (por su atributo neutro) y medir
          cada hijo real; calcular rects relativas al `<section>` (restar `section.left/top`) y
          delegar en `computeGridDropZoneRects` para obtener las `N+1` posiciones.
        - Registrar un único `ResizeObserver` observando el `<section>` y cada hijo real; en su
          callback, recomputar las posiciones. Guardar el resultado en estado local del overlay
          para provocar el re-render de las zonas absolutas.
        - Rebobinar (`disconnect`) y volver a registrar el observer cuando `childCount` cambia.
        - Renderizar `N+1` `<div data-drop-zone="…">` como hijos del overlay, cada uno:
            - `position: absolute`, `pointer-events: auto`,
            - `top/left/width/height` calculados,
            - `id` generado con `serializeDropZoneId({ parentPath, index, tabItemIndex })` (mismo
              contrato que hoy),
            - registrado con `useDroppable({ id })` para que
              `LayoutCanvasDndContext.handleDragOver` los reconozca y aplique el outline
              emerald/red exactamente como en el resto del canvas (Decisión 1).
            - clase base sin fondo visible (`bg-transparent` o similar) para que el outline sea la
              única señal visual durante el arrastre.
        - Si `childCount === 0`, el componente no debería montarse desde `LayoutRenderer`, pero el
          overlay debe manejar la degradación devolviendo `null` cuando la medición inicial da
          `0` hijos reales (defensa mínima; el caso normal está cubierto por el placeholder).
    - `src/runtime/layout-renderer.tsx` (modificar): en el branch `activeEditModeContext !== null`
      y `isGridParent`:
        - No emitir el `LayoutCanvasDropZoneGap` inicial de `index: 0`.
        - En la iteración de nodos, no emitir el `LayoutCanvasDropZoneGap` post-hijo cuando
          `isGridParent` (elimina el `!isGridParent || isLastNode` actual).
        - Después de la iteración, añadir al array `elements` un único
          `<LayoutCanvasGridDropZonesOverlay parentPath={path} childCount={nodes.length} tabItemIndex={parentTabItemIndex} />`
          cuando `nodes.length > 0`.
        - Si `nodes.length === 0` y el padre es grid, no se monta ni el overlay ni gaps; el
          `EmptyContainerPlaceholder` (emitido desde `LayoutNodeRenderer`) sigue cubriendo el
          drop de "primer hijo" como hoy.
        - Rama no-grid del `activeEditModeContext !== null`: sin cambios respecto a hoy (sigue
          usando `LayoutCanvasDropZoneGap` sin `fullRowSpan`).
        - Quitar el parámetro `fullRowSpan` de `LayoutCanvasDropZoneGap` si deja de usarse;
          eliminar la lógica muerta asociada.
    - `src/runtime/nodes/container-layout-node.tsx` (modificar): consumir
      `useLayoutEditModeContext()` y añadir la clase `relative` al `className` del `<section>`
      cuando el contexto está activo (`context !== null && context.active`) Y `node.props?.columns`
      no es nulo/`undefined` (mismo predicado "modo grid" que ya usa `LayoutRenderer` vía
      `parentGridColumns`). En Visual/producción, el `<section>` no recibe `relative`
      (regresión byte a byte del DOM garantizada).
- Tests:
    - `src/tests/dev-runtime/layout-canvas-grid-drop-zones.test.tsx` (ampliación mayor): sustituir
      los tests preexistentes que exigen "exactamente 2 `data-drop-zone` como hijos directos del
      `<section>` con `grid-column: 1 / -1`" por el nuevo contrato (N+1 zonas dentro del overlay,
      overlay con `position: absolute inset-0 pointer-events-none`, cada zona con
      `position: absolute pointer-events: auto`). Añadir los nuevos casos de RF1/RF2. Mockear
      `ResizeObserver` y `getBoundingClientRect` como indica la Decisión 6 del design.
    - `src/tests/layout-renderer/layout-renderer-container.test.tsx` (ampliación): regresión
      0105/RF1 (orden y clases `col-span-*` de los hijos reales de un grid en Editor coinciden
      con Visual, incluso con el overlay presente) y regresión de aplicación condicional de
      `relative` en el `<section>`.
    - `src/tests/dev-runtime/layout-canvas-reorder-reinsert.test.tsx` (ampliación): un caso
      end-to-end de reanidar un nodo hacia una posición intermedia de un `container` grid con 3+
      hijos, verificando que el `layout` resultante coloca el nodo en el índice ordinal correcto
      sin desplazar los demás hijos (RF2, criterio 4 de spec).
    - `src/tests/dev-runtime/layout-canvas-palette-insert.test.tsx` (ampliación): un caso
      end-to-end de insertar un nodo nuevo desde la paleta sobre una zona intermedia de un
      `container` grid (RF2, criterio 5 de spec).
- Documentación:
    - `ai-workflow/docs/app-features/development/dev-mode-editor.md`: sección "Reordenar y
      reanidar por arrastre (modo Editor)" — retirar la limitación conocida actual sobre
      ausencia de zonas de inserción intermedias en modo grid y describir el nuevo comportamiento
      (barra vertical + zonas intermedias con altura de fila). No abrir sección nueva; se ajusta
      la existente. (La actualización documental efectiva la aplicará el usuario invocando
      `update-app-documentation` tras el cierre de esta tarea; ver "Documentación afectada".)

### Tests

- **Ficheros de test**:
    - `src/tests/dev-runtime/layout-canvas-grid-drop-zones.test.tsx` (ampliación).
    - `src/tests/layout-renderer/layout-renderer-container.test.tsx` (ampliación).
    - `src/tests/dev-runtime/layout-canvas-reorder-reinsert.test.tsx` (ampliación).
    - `src/tests/dev-runtime/layout-canvas-palette-insert.test.tsx` (ampliación).

- **Comportamiento cubierto**:
    - En `layout-canvas-grid-drop-zones.test.tsx`:
        - Con un `container` de `props.columns: 3` y 5 hijos heterogéneos, montado bajo
          `LayoutEditModeProvider` con `active: true`, el DOM contiene exactamente **un** elemento
          con `data-canvas-grid-drop-zones=""` como hijo del `<section data-layout-node="container">`,
          y dentro de él exactamente **6** elementos con `data-drop-zone` (índices `0..5`), cada uno
          con `position: absolute` y `pointer-events: auto`. El overlay raíz tiene
          `position: absolute`, `inset: 0` y `pointer-events: none`.
        - Los `id` de las 6 zonas son exactamente
          `serializeDropZoneId({ parentPath, index: i })` para `i ∈ {0..5}`, con `parentPath`
          coincidente con el `path` del `container`.
        - Regresión: los hijos reales del `<section>` mantienen el mismo orden y las mismas
          clases Tailwind (`col-span-*` cuando aplican) que en modo Visual (sin provider o con
          `active: false`), a pesar de la presencia del overlay como hermano.
        - Con `container` sin `props.columns` (flex/row), no se monta overlay; el DOM contiene
          `N+1` `LayoutCanvasDropZoneGap` como hoy (regresión respecto al comportamiento actual
          no-grid).
        - En modo Visual (sin provider o `active: false`), el `<section>` no lleva la clase
          `relative`, no se monta overlay ni `LayoutCanvasDropZoneGap`, y el DOM es byte-idéntico
          al render de producción.
        - En modo Editor con grid y `container` vacío (`children: []`), el `<section>` contiene
          únicamente el `EmptyContainerPlaceholder`; el overlay no se monta.
        - Con `columns` responsive (mapa por breakpoint `{ base: 1, md: 3 }`), el overlay se
          monta y renderiza `N+1` zonas sin regresión de posición de los hijos reales; los `id`
          siguen siendo ordinales (`0..N`).
        - Con hijos cuyas rects mockeadas ejercitan un salto de fila (dos filas), las zonas del
          overlay reflejan la geometría devuelta por `computeGridDropZoneRects` (la zona
          intermedia entre las dos filas se ancla al inicio del primer hijo de la segunda fila).
          Verificar leyendo `element.style.top/left/width/height`.
        - `ResizeObserver` mockeado dispara el recálculo: forzar el callback del observer con
          nuevas rects y verificar que los `top/left/width/height` de las zonas cambian
          coherentemente.
        - Cuando `LayoutCanvasDndContext` está presente y se dispara un `onDragOver` cuyo `over`
          apunta a una zona intermedia (por ejemplo `index: 2`), la zona correspondiente recibe
          las clases `outline outline-2 -outline-offset-2 outline-emerald-500` (destino válido)
          o `outline-red-500` (inválido), exactamente igual que hoy en las zonas de la rama
          no-grid (regresión del pipeline de indicador visual).
    - En `layout-renderer-container.test.tsx`:
        - Regresión 0105/RF1: con `container` `props.columns: 3` y 5 hijos con y sin
          `layout.span`, el orden de los `data-layout-node` hijos y sus clases `col-span-*`
          coinciden byte a byte entre modo Editor (con overlay presente) y modo Visual.
        - Con `container` en modo grid bajo `LayoutEditModeProvider` con `active: true`, el
          `<section data-layout-node="container">` recibe la clase `relative` en su `className`.
        - Con `container` en modo grid en modo Visual (sin provider o `active: false`), el
          `<section>` no contiene `relative` en su `className`.
        - Con `container` sin `props.columns` bajo `LayoutEditModeProvider` con `active: true`,
          el `<section>` no recibe `relative` (la clase se aplica sólo bajo grid + Editor).
    - En `layout-canvas-reorder-reinsert.test.tsx`:
        - Reanidar por drag un nodo raíz `X` hacia la zona intermedia `index: 2` de un
          `container` grid con 4 hijos `[A, B, C, D]`: el resultado es
          `container.children = [A, B, X, C, D]` y `X` desaparece del root; el JSON del buffer
          de Monaco resultante sigue validando (RF2, criterio 4 de spec).
    - En `layout-canvas-palette-insert.test.tsx`:
        - Insertar desde la paleta un nodo nuevo (por ejemplo `heading`) sobre la zona
          intermedia `index: 1` de un `container` grid con 3 hijos `[A, B, C]`: el resultado es
          `container.children = [A, heading, B, C]` con `heading` inicializado con los defaults
          de `buildDefaultNodeInstance`; el JSON del buffer de Monaco sigue validando (RF2,
          criterio 5 de spec).

- **Comandos durante la implementación**:
    - `pnpm test --run src/tests/dev-runtime/layout-canvas-grid-drop-zones.test.tsx`
    - `pnpm test --run src/tests/layout-renderer/layout-renderer-container.test.tsx`
    - `pnpm test --run src/tests/dev-runtime/layout-canvas-reorder-reinsert.test.tsx`
    - `pnpm test --run src/tests/dev-runtime/layout-canvas-palette-insert.test.tsx`

- **Restricciones**:
    - Reusar los helpers y patrones de mount con `LayoutEditModeProvider` ya usados por
      `layout-node-renderer-edit-mode.test.tsx`, `layout-renderer-edit-mode-placeholders.test.tsx`
      y el propio `layout-canvas-grid-drop-zones.test.tsx` preexistente.
    - Mockear `ResizeObserver` con una implementación mínima (registro de callbacks, método
      `disconnect`) y `Element.prototype.getBoundingClientRect` para poder controlar las rects
      de `<section>` y hijos desde el test.
    - No introducir un tercer mock de `@dnd-kit/core`: reusar el patrón ya establecido en
      `layout-canvas-reorder-reinsert.test.tsx` / `layout-canvas-palette-insert.test.tsx` para
      los tests end-to-end. Para los tests de contrato de DOM del overlay, `useDroppable` sin
      `DndContext` ancestro sigue siendo un no-op seguro.
    - Ninguna importación en `src/runtime/` puede apuntar a `src/dev-runtime/`; el overlay usa
      exclusivamente `LayoutEditModeContext`, `RuntimeLayoutContext`, `LayoutNodePath` y
      `useDroppable` (`@dnd-kit/core`).
    - El componente `LayoutCanvasGridDropZonesOverlay` no debe re-mediar durante un `drag` en
      curso: `ResizeObserver` cubre cambios reales de layout; el listener de dnd-kit no debe
      registrar callbacks adicionales aquí (Decisión 5).
    - No añadir snapshots de DOM completo; verificar propiedades específicas
      (`data-drop-zone`, `style.top`, `style.left`, `className`, número de hijos).

### Documentación afectada
- `ai-workflow/docs/app-features/development/dev-mode-editor.md`.

### Criterios de finalización
- Los cuatro ficheros de test listados están en verde.
- La suite global `pnpm test` sigue en verde y el umbral del 80% de cobertura del proyecto se
  mantiene (regla global de `standards/testing-rules.md`, no repetida por tarea).
- Los criterios de aceptación 1–9 de `spec.md` se cumplen: verificables mediante los tests de
  esta tarea (1, 2, 3, 6, 7, 8, 9 cubiertos por el fichero de overlay + regresión de
  container; 4 y 5 cubiertos por los ficheros end-to-end).
- El `<section data-layout-node="container">` recibe la clase `relative` únicamente bajo Editor
  activo Y grid; en Visual/producción el DOM del `<section>` es byte-idéntico al render actual.
- No se han modificado `isValidDropTarget`, `layout-tree-mutations.ts`, `layout-canvas-commit.ts`,
  `LayoutCanvasDndContext` ni el pipeline de sincronización con Monaco.

### Cierre de implementación
Código y tests de la tarea completos, `pnpm test --run` sobre los ficheros listados en verde, y
`pnpm test` de la suite global en verde con cobertura ≥ 80%.

### Cierre documental
Actualización efectiva de `ai-workflow/docs/app-features/development/dev-mode-editor.md` (sección
"Reordenar y reanidar por arrastre (modo Editor)"): retirar la limitación conocida sobre ausencia
de zonas de inserción intermedias en modo grid y describir el nuevo comportamiento (barra vertical
+ zonas intermedias con altura de fila). La escritura documental la aplica el usuario invocando
`update-app-documentation` tras el cierre de implementación de esta tarea; no forma parte del
código entregado por T2.

---

## Próxima tarea a escoger
T1 — Función pura `computeGridDropZoneRects`.
