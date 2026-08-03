# Tasks — 0125 — dev-editor-shell-tree-ux

Contrato de ejecución para la feature. Alcance: mejorar la sección "Shell" del editor visual en modo desarrollo
(`ShellConfigPanel` y sus editores hijos) con colapso individual por `menuItem`/`sidebarItem`, arrastre extendido
entre niveles (anidar/mover, respetando el tope de profundidad 1 de `menuItem` y la ausencia de tope de
`sidebarItem`), y dos sub-vistas "Header"/"Sidebar" dentro del dominio Shell. Sin cambios al contrato JSON de
`shell` ni a su validación; exclusivo del editor en modo desarrollo (`src/dev-runtime/`).

Basado en `spec.md` y en las 7 decisiones de `design.md`. Se divide en ocho tareas secuenciales:

1. **T1** — Módulo puro de mutación de árbol por `path` posicional (`getAtPath`/`removeAtPath`/`insertAtPath`/
   `appendChildAtPath`, `isSelfOrDescendantPath`, `subtreeHeight`, validez de profundidad, `moveShellSubtree` con
   `pathRemap` completo), parametrizado por `maxDepth`, compartido por header y sidebar.
2. **T2** — Módulo puro de estado de colapso indexado por `path` (`Map<string, boolean>`) más el hook que lo
   posee, incluida la reescritura de claves vía `pathRemap`.
3. **T3** — Módulo de DnD extendido: un único `DndContext` de `@dnd-kit/core` por árbol con dos categorías de
   zona droppable (`gap` para reordenar/mover, `nest` para anidar), indicador visual verde/rojo de validez.
4. **T4** — Header: extrae los tests del menú a `shell-menu-list-editor.test.tsx` propio (el fichero compartido
   `shell-config-panel.test.tsx` ya supera el umbral de tamaño de `testing-rules.md`) y añade el control de
   colapso por `menuItem`/`menuItemChild` (fila resumen, icono de rama, espacio antes del primer hijo) en
   `shell-menu-list-editor.tsx`, sin tocar el arrastre todavía.
5. **T5** — Header: arrastre extendido (anidar/mover entre niveles, tope de profundidad 1) sustituyendo el DnD
   por nivel actual por el módulo de T3, con reescritura del mapa de colapso vía `pathRemap`.
6. **T6** — Sidebar: control de colapso por `sidebarItem` (mismo patrón que T4) en `sidebar-item-list-editor.tsx`,
   incluida la normalización de la convención de `path` a la que usa el módulo de T1.
7. **T7** — Sidebar: arrastre extendido (anidar/mover entre niveles, sin tope de profundidad) sustituyendo el DnD
   por nivel actual por el módulo de T3, incluida la comprobación estructural de que el arrastre entre el árbol
   del header y el del sidebar sigue siendo imposible.
8. **T8** — Sub-vistas "Header"/"Sidebar" (`role="tablist"`) en `shell-config-panel.tsx`, ambos paneles siempre
   montados.

T1 y T2 no dependen entre sí pero T2 se apoya en el formato de `pathRemap` que define T1, así que T1 va primero.
T3 depende de T1 (usa su validez de profundidad para el indicador visual). T4 depende de T2. T5 depende de T3+T4
(mismo fichero) y de T1/T2. T6 depende de T2 (igual que T4, dominio distinto). T7 depende de T3+T6 y de T1/T2. T8
depende de T4+T5+T6+T7 cerradas — no por dependencia técnica real (T8 es aditivo sobre `shell-config-panel.tsx`),
sino para evitar reabrir ese fichero varias veces mientras el resto del árbol sigue cambiando de forma.

## Siguiente tarea a escoger

`0125-T1` — habilita el resto del plan (T2, T3, T5 y T7 dependen de sus tipos/funciones).

---

## Task 0125-T1 — Módulo puro de mutación de árbol por `path` posicional

- **ID**: 0125-T1
- **Estado**: pending
- **Objetivo**: Crear `src/dev-runtime/shell-config-panel/shell-tree-mutations.ts`, un módulo puro (sin React, sin
  DOM) que opera sobre árboles con forma `{ children?: T[] }` usando una convención de `path` posicional en
  notación de puntos: la lista raíz se identifica con la cadena vacía `''`; un nodo raíz es `'0'`, `'1'`, ...; un
  hijo de ese nodo es `'0.0'`, `'0.1'`, ...; sin límite de profundidad en la notación misma (el límite lo impone
  `maxDepth` en la validación, no el `path`). Esta es la misma convención que ya usa hoy `SidebarItemListEditor`
  salvo por el prefijo literal `'root'`, que este módulo no usa (la lista raíz es `''`, no `'root'`) — T6 alinea
  el componente a esta convención.

  Nota de tipos: no hace falta declarar dos formas de árbol para header/sidebar. `MenuItemConfig extends
  MenuItemChildConfig` y `MenuItemChildConfig` no declara `children`, así que el árbol completo de
  `shell.header.menu` (raíz + hijos) es válido como `T = MenuItemChildConfig` bajo la restricción `T extends {
  children?: T[] }` sin necesidad de una unión — el único elemento que en la práctica tiene `children` no vacío
  es un `MenuItemConfig` de la raíz, pero el tipo genérico no necesita saberlo. Para el sidebar, `T =
  SidebarItemConfig` (genuinamente recursivo).

  Exportar:
  - `type ShellTreeDestination = { type: 'nest'; path: string } | { type: 'gap'; parentPath: string; index: number }`
  - `getAtPath<T extends { children?: T[] }>(tree: readonly T[], path: string): T | null` — resuelve un `path` no
    vacío contra `tree`; `null` si algún segmento no resuelve.
  - `removeAtPath<T extends { children?: T[] }>(tree: readonly T[], path: string): T[]` — devuelve un árbol
    nuevo sin mutar `tree` ni ningún nodo intermedio (mismo criterio de inmutabilidad que
    `layout-tree-mutations.ts`).
  - `insertAtPath<T extends { children?: T[] }>(tree: readonly T[], parentPath: string, index: number, node: T):
    T[]` — inserta `node` en la posición `index` de la lista de hermanos identificada por `parentPath` (`''` para
    la raíz).
  - `appendChildAtPath<T extends { children?: T[] }>(tree: readonly T[], targetPath: string, node: T): T[]` —
    añade `node` como **último** elemento de `children` del nodo en `targetPath` (Decisión 5 de `design.md`); si
    el nodo en `targetPath` no tiene `children` definido (modo hoja), lo sustituye por un array de un solo
    elemento `[node]` en vez de fallar.
  - `isSelfOrDescendantPath(candidatePath: string, ofPath: string): boolean` — `true` si `candidatePath === ofPath`
    o si `candidatePath` empieza por `` `${ofPath}.` ``. Mismo criterio anti-ciclo que `isSameOrDescendantPath` de
    `layout-tree-mutations.ts`, adaptado a `path` de tipo string en vez de `LayoutNodePath`.
  - `subtreeHeight<T extends { children?: T[] }>(node: T): number` — `0` si `node.children` es `undefined`;
    `1 + Math.max(...node.children.map(subtreeHeight))` en otro caso.
  - `isValidShellTreeDestination<T extends { children?: T[] }>(tree: readonly T[], sourcePath: string,
    destination: ShellTreeDestination, maxDepth: number | null): boolean` — implementa la Decisión 3 de
    `design.md`:
    ```ts
    function segmentDepth(pathOrParentPath: string): number {
      return pathOrParentPath === '' ? 0 : pathOrParentPath.split('.').length
    }
    // targetDepth = profundidad que tendría el nodo arrastrado si el destino se acepta:
    // - zona gap: segmentDepth(destination.parentPath)
    // - zona nest: segmentDepth(destination.path)
    ```
    Inválido si: (a) el nodo objetivo de anidado/gap es el propio `sourcePath` o uno de sus descendientes
    (`isSelfOrDescendantPath` sobre `destination.path`/`destination.parentPath` sobre `sourcePath` — evita
    ciclos); o (b) `maxDepth !== null && targetDepth + subtreeHeight(getAtPath(tree, sourcePath)) > maxDepth`.
    Con `maxDepth === null` (sidebar) el chequeo de profundidad se omite siempre.
  - `moveShellSubtree<T extends { children?: T[] }>(tree: readonly T[], sourcePath: string, destination:
    ShellTreeDestination): { tree: T[]; pathRemap: Map<string, string> }`: combina `removeAtPath` +
    `insertAtPath`/`appendChildAtPath` (según `destination.type`) sin validar por sí mismo (la validación es
    responsabilidad de `isValidShellTreeDestination`, llamada antes por quien invoque esta función — mismo
    reparto de responsabilidades que `movePathTo`/`isValidDropTarget` en `layout-tree-mutations.ts`/
    `layout-drop-validity.ts`). El reordenamiento dentro del mismo nivel es el caso particular `destination = {
    type: 'gap', parentPath: parentOf(sourcePath), index: <índice destino> }`; no debe existir una función
    `reorder()` paralela — T5/T7 eliminan la que ya existe hoy en `shell-menu-list-editor.tsx`/
    `sidebar-item-list-editor.tsx` y pasan a llamar a `moveShellSubtree` también para ese caso.

    **Cálculo de `pathRemap`** (más completo que la única frase de `design.md` sobre "el subárbol movido", para
    cubrir también los hermanos cuyo índice se desplaza como efecto colateral de la extracción/inserción — mismo
    problema que ya resuelve `adjustIndexForSiblingMove`/`adjustParentPathForRemoval` en `layout-tree-mutations.ts`
    pero aquí, en vez de aritmética de índice caso a caso, se resuelve con un diff por identidad de objeto, mismo
    principio que `findNodePath` ya usa en ese mismo fichero): antes de mutar, recorrer `tree` y construir un
    `Map<T, string>` de cada nodo (por referencia) a su `path` antiguo; tras construir el árbol resultante,
    recorrerlo igual y construir un `Map<T, string>` a su `path` nuevo. Igual que `rebuildFromFrames` en
    `layout-tree-mutations.ts`, reconstruir un árbol inmutable por `path` reconstruye por spread **todos** los
    ancestros de la cadena tocada (el propio nodo movido, su nuevo padre y cada antecesor hasta la raíz), no solo
    uno — pero esas reconstrucciones son irrelevantes para el remap: lo único que le importa a `pathRemap` es qué
    referencia de nodo aparece bajo qué `path` en cada árbol, y un nodo no movido conserva su propia referencia
    aunque el array que lo contiene se haya reconstruido alrededor suyo. `pathRemap` es la intersección: para cada
    nodo presente en ambos mapas cuyo `path` antiguo difiera del nuevo, una entrada `pathAntiguo -> pathNuevo`.
- **Fuera de alcance**:
  - Cualquier componente React, hook o wiring de `@dnd-kit/core`: T2 (colapso) y T3 (DnD) consumen este módulo
    pero se implementan aparte.
  - Cualquier cambio a `src/config/`, `src/runtime/` o al contrato JSON de `shell`.
  - `layout-tree-mutations.ts` no se toca ni se generaliza para reutilizarse aquí: los tipos de nodo (`LayoutNode`
    con su propio modelo de `path` estructurado por pasos `{field, index}`) no coinciden con la notación de
    puntos que exige esta feature (Decisión 3, ubicación del código).
- **Dependencias**: ninguna. Primera tarea del plan.
- **Impacto esperado en archivos**:
  - Código:
    - `src/dev-runtime/shell-config-panel/shell-tree-mutations.ts` (nuevo)
  - Tests:
    - `src/tests/dev-runtime/shell-tree-mutations.test.ts` (nuevo)
  - Documentación:
    - `ai-workflow/docs/test-index.md` — registrar el fichero de test nuevo en la sección `dev-runtime/`.
- **Tests**:
  - **Ficheros de test**:
    - `src/tests/dev-runtime/shell-tree-mutations.test.ts` (nuevo)
  - **Comportamiento cubierto**:
    - `getAtPath`: resuelve raíz (`'0'`), un nivel anidado (`'0.1'`), tres niveles (`'0.1.2'`); devuelve `null`
      ante un índice fuera de rango en cualquier segmento, incluido el último.
    - `removeAtPath`/`insertAtPath`/`appendChildAtPath`: no mutan el árbol original (comparar contra una
      instantánea `JSON.parse(JSON.stringify(...))` antes/después, mismo patrón que
      `layout-tree-mutations.test.ts`); `insertAtPath` con `parentPath: ''` inserta en la raíz; `insertAtPath`
      con `parentPath` de un nodo existente inserta en su `children`; `appendChildAtPath` sobre un nodo con
      `children` ya no vacío añade al final conservando el orden previo; `appendChildAtPath` sobre un nodo hoja
      (sin `children`) crea `children: [node]`.
    - `isSelfOrDescendantPath`: `true` para el mismo `path`; `true` para un descendiente directo e indirecto
      (`'0'` frente a `'0.1.2'`); `false` para un hermano (`'0'` frente a `'1'`) y para un `path` que comparte
      prefijo textual sin ser descendiente real (`'0'` frente a `'01'` — no debe dar falso positivo por
      coincidencia de substring sin el separador `.`).
    - `subtreeHeight`: `0` para un nodo sin `children`; `1` para un nodo con hijos todos hoja; profundidad
      correcta con ramas de altura desigual (el máximo de las ramas, no la suma).
    - `isValidShellTreeDestination` con `maxDepth: 1` (equivalente a header): destino `nest` sobre un item raíz
      (profundidad 0) es válido; destino `nest` sobre un item ya de profundidad 1 es inválido (reproduce el
      criterio de aceptación 5 de la spec); destino `gap` con `parentPath: ''` siempre válido en cuanto a
      profundidad; mover una rama con `subtreeHeight: 1` (un item raíz con hijos) sobre el cuerpo de otro item
      raíz (profundidad 0) es inválido (`1+1=2>1`, el caso derivado documentado en `design.md`).
    - `isValidShellTreeDestination` con `maxDepth: null` (equivalente a sidebar): siempre válido en cuanto a
      profundidad, a cualquier profundidad de origen/destino, incluida una rama con `subtreeHeight` de varios
      niveles.
    - `isValidShellTreeDestination`: inválido cuando el destino (`nest.path` o `gap.parentPath`) es el propio
      `sourcePath` o uno de sus descendientes, con `maxDepth` tanto `1` como `null`.
    - `moveShellSubtree`: mover un nodo raíz a otra posición raíz (reordenar) produce el árbol esperado y un
      `pathRemap` que incluye tanto el nodo movido como los hermanos cuyo índice se desplazó; anidar un item
      raíz sobre otro (destino `nest`) produce `children: [nodo]` si el destino era hoja, o lo añade al final si
      ya tenía `children`; mover una rama con hijos colapsados en distintos estados (representado aquí solo como
      forma de árbol, sin estado de colapso — ese cruce lo cubre T2/T4/T6) conserva intacta la estructura interna
      del subárbol movido bajo su nuevo `path` base; `pathRemap` contiene una entrada por cada descendiente del
      subárbol movido con su `path` antiguo y nuevo coherentes entre sí (el nuevo `path` de cada descendiente es
      el nuevo `path` del nodo movido más el mismo sufijo relativo que tenía antes).
    - `moveShellSubtree`: mover un item al único hueco disponible de una lista de un solo elemento (reordenar
      consigo mismo) no lanza error y produce un árbol equivalente al original (criterio del caso límite de la
      spec).
  - **Comandos durante la implementación**:
    - `pnpm test --run src/tests/dev-runtime/shell-tree-mutations.test.ts`
  - **Restricciones**:
    - No usar `JSON.stringify`/`JSON.parse` como mecanismo de clonado dentro del propio módulo (solo es válido
      como snapshot de comparación en los tests); usar spread/slice como el resto del código de mutación de
      árbol del proyecto.
    - No exportar `segmentDepth` como función pública si no la necesita ningún consumidor fuera de este módulo;
      mantenerla local salvo que T3 demuestre necesitarla directamente.
- **Documentación afectada**:
  - `ai-workflow/docs/test-index.md` — añadir `shell-tree-mutations.test.ts` a la sección `dev-runtime/`.
- **Criterios de finalización**:
  - Las funciones exportadas cubren exactamente los criterios de aceptación 3, 4, 5, 6, 7 (mitad de
    profundidad/ciclo) y el caso límite de reordenar-consigo-mismo de `spec.md`, verificables sin DOM ni React.
  - Todos los tests nuevos en verde; `pnpm test` (suite completa) en verde sin bajar el 80% de cobertura.
- **Cierre de implementación**: módulo puro completo en el árbol; ningún consumidor lo importa todavía (inerte
  hasta T3-T7).

---

## Task 0125-T2 — Módulo y hook de estado de colapso indexado por `path`

- **ID**: 0125-T2
- **Estado**: pending
- **Objetivo**: Crear `src/dev-runtime/shell-config-panel/shell-collapse-state.ts` con funciones puras sobre un
  `Map<string, boolean>` (clave = `path` en la misma convención de T1; valor `true` = colapsado; ausencia de
  entrada = expandido, el default que exige la spec) y un hook React que lo posee (Decisión 4 de `design.md`: un
  hook a nivel de `ShellConfigPanel`, no por fila).

  Exportar:
  - `type ShellCollapseState = ReadonlyMap<string, boolean>`
  - `isShellPathCollapsed(state: ShellCollapseState, path: string): boolean` — `state.get(path) === true`.
  - `toggleShellCollapse(state: ShellCollapseState, path: string): Map<string, boolean>` — nuevo `Map` con la
    entrada de `path` invertida respecto a `isShellPathCollapsed` (si no existía, la crea en `true`); no muta
    `state`.
  - `remapShellCollapseState(state: ShellCollapseState, pathRemap: ReadonlyMap<string, string>): Map<string,
    boolean>` — nuevo `Map` donde cada entrada `[path, collapsed]` de `state` se reescribe a `[pathRemap.get(path)
    ?? path, collapsed]`. Una clave de `state` ausente de `pathRemap` conserva su `path` (el nodo no se movió).
    Es la operación que preserva el caso límite de la spec ("mover un item con hijos en distintos estados de
    colapso: el subárbol completo... viaja con él sin alterarse"): como T1's `pathRemap` ya incluye una entrada
    por cada descendiente del subárbol movido, aplicar esta función después de cada `moveShellSubtree` basta sin
    lógica adicional específica de "colapso".
  - `useShellCollapseState(): { isCollapsed: (path: string) => boolean; toggleCollapse: (path: string) => void;
    applyPathRemap: (pathRemap: ReadonlyMap<string, string>) => void }` — hook que envuelve `useState<Map<string,
    boolean>>(new Map())` y expone las tres funciones puras de arriba ya ligadas al `state`/`setState` del hook.
    Una instancia de este hook por árbol (una para `shell.header.menu`, otra para `shell.sidebar.items`) — T4/T6
    la instancian en `ShellConfigPanel` y la pasan hacia abajo.
- **Fuera de alcance**:
  - Cualquier render de fila resumen, icono de rama o control de colapso visual: T4/T6.
  - Cableado de `applyPathRemap` a una mutación real de árbol: T5/T7 (aquí solo se prueba que la función reescribe
    claves correctamente, con un `pathRemap` construido a mano en el test).
- **Dependencias**: `0125-T1` cerrado (reutiliza literalmente su convención de `path` y la forma de `pathRemap`
  que producirá `moveShellSubtree`, aunque este módulo no importa nada de T1 — solo comparte contrato de tipos).
- **Impacto esperado en archivos**:
  - Código:
    - `src/dev-runtime/shell-config-panel/shell-collapse-state.ts` (nuevo)
  - Tests:
    - `src/tests/dev-runtime/shell-collapse-state.test.ts` (nuevo)
  - Documentación:
    - `ai-workflow/docs/test-index.md` — registrar el fichero de test nuevo en la sección `dev-runtime/`.
- **Tests**:
  - **Ficheros de test**:
    - `src/tests/dev-runtime/shell-collapse-state.test.ts` (nuevo)
  - **Comportamiento cubierto**:
    - `isShellPathCollapsed`: `false` para un `Map` vacío o para un `path` sin entrada; `true` solo cuando la
      entrada existe y vale `true`; `false` si la entrada existe y vale `false` (tras un segundo toggle).
    - `toggleShellCollapse`: invierte de expandido (sin entrada) a colapsado, y de colapsado a expandido; no muta
      el `Map` recibido (comparar por referencia que el resultado es un objeto distinto); dos llamadas
      consecutivas sobre `path`s distintos no interfieren entre sí.
    - `remapShellCollapseState`: una clave presente en `pathRemap` se reescribe a su nuevo valor conservando el
      booleano de colapso; una clave ausente de `pathRemap` permanece igual; un `pathRemap` que reescribe varias
      claves a la vez (simulando un subárbol movido con descendientes en distintos estados de colapso) produce un
      `Map` final con todas las claves nuevas y ninguna de las antiguas; no muta el `state` recibido.
    - `useShellCollapseState` (con `@testing-library/react`'s `renderHook`, precedente en
      `runtime-tokens-scheduler.test.tsx`): `isCollapsed` empieza en `false` para cualquier `path`;
      `toggleCollapse('0')` hace que `isCollapsed('0')` sea `true` tras un re-render; una segunda llamada lo
      vuelve a `false`; `applyPathRemap` reescribe las claves ya colapsadas y deja intactas las no afectadas,
      observable vía `isCollapsed` con los `path`s nuevo y antiguo respectivamente.
  - **Comandos durante la implementación**:
    - `pnpm test --run src/tests/dev-runtime/shell-collapse-state.test.ts`
  - **Restricciones**:
    - El hook no debe depender de ningún tipo de `MenuItemConfig`/`SidebarItemConfig`: opera solo sobre `path`
      strings, para poder instanciarse igual para header y para sidebar sin genéricos ni parámetros de tipo.
- **Documentación afectada**:
  - `ai-workflow/docs/test-index.md` — añadir `shell-collapse-state.test.ts` a la sección `dev-runtime/`.
- **Criterios de finalización**:
  - El hook y las funciones puras cubren el caso límite de la spec sobre preservar el estado de colapso de un
    subárbol movido, verificable con un `pathRemap` construido a mano sin depender de T1 en tiempo de ejecución.
  - Todos los tests nuevos en verde; `pnpm test` en verde sin bajar el 80% de cobertura.
- **Cierre de implementación**: módulo y hook completos en el árbol; ningún consumidor los importa todavía
  (inertes hasta T4/T6).

---

## Task 0125-T3 — Módulo de DnD extendido: `DndContext` por árbol con zonas `gap`/`nest`

- **ID**: 0125-T3
- **Estado**: pending
- **Objetivo**: Reescribir `src/dev-runtime/shell-config-panel/shell-config-panel-dnd.tsx` (Decisión 1 y 2 de
  `design.md`) para sustituir el patrón actual "un `DndContext` por nivel" (`ShellDndSortableList`/
  `ShellDndSortableRow`, uno por lista) por un único `DndContext` compartido por **árbol completo** (todo
  `shell.header.menu` con sus `children`; todo `shell.sidebar.items` con toda su recursión), con dos categorías
  de zona droppable dentro de ese mismo contexto:
  - **Zona `gap`**: mismo patrón que `LayoutCanvasDropZoneGap` en `src/runtime/layout-renderer.tsx` (`<div>` de
    bajo alto, sin medición ni overlay, participando en el flujo normal `flex flex-col`). Serializa su id como
    `` `gap:${parentPath}:${index}` `` (`parentPath` en la convención de T1, `''` para la raíz).
  - **Zona `nest`**: el cuerpo entero de la fila de un item pasa a ser un destino de anidado (ya no de
    intercambio de posición, ese rol pasa a las zonas `gap`). Serializa su id como `` `nest:${path}` ``.

  Exportar:
  - `parseShellTreeDropZoneId(id: string): ShellTreeDestination | null` (tipo `ShellTreeDestination` de T1) —
    `id.split(':')`; `['gap', parentPath, indexText]` → `{ type: 'gap', parentPath, index: Number(indexText) }`
    (`null` si `indexText` no es un entero no negativo); `['nest', path]` → `{ type: 'nest', path }`; cualquier
    otro shape → `null`.
  - `ShellTreeDndContext` (componente): props `{ treeId: string; onMoveAttempt: (sourcePath: string,
    destination: ShellTreeDestination) => void; isValidDestination: (sourcePath: string, destination:
    ShellTreeDestination) => boolean; children: ReactNode }` (`sensors` no es un prop: el componente configura
    internamente su propio `PointerSensor` con `activationConstraint: { distance: 4 }`, igual que hoy). `treeId`
    se pasa como `id` de `DndContext`
    (distingue header de sidebar en tests, igual función que hoy cumplen `dndContextId`s como
    `'shell-menu-root'`). En `onDragEnd`: parsea `active.id` como `sourcePath` (string tal cual, sin
    transformación — el `path` de un item es directamente su id draggable) y `over.id` con
    `parseShellTreeDropZoneId`; si ambos resuelven y `isValidDestination(sourcePath, destination)` es `true`,
    llama a `onMoveAttempt(sourcePath, destination)`; en cualquier otro caso (sin `over`, id no parseable,
    destino inválido) no hace nada. En `onDragOver`: misma resolución, y si hay una zona activa, marca su
    elemento `[data-drop-zone]` con las clases Tailwind de válido (`outline outline-2 -outline-offset-2
    outline-emerald-500`) o inválido (mismas clases con `outline-red-500`) según `isValidDestination` — mismo
    mecanismo imperativo de `classList` con limpieza previa que ya usa `LayoutCanvasDndContext` en
    `src/dev-runtime/layout-canvas/layout-canvas-dnd-context.tsx` (reutilizar el mismo patrón, no una
    implementación paralela).
  - `ShellTreeGapZone` (componente): props `{ parentPath: string; index: number }`. Renderiza
    `<div ref={setNodeRef} data-drop-zone={id} aria-hidden="true" className="h-1 min-w-1" />` con
    `id = gap:${parentPath}:${index}` y `useDroppable({ id })` — mismo criterio visual/estructural que
    `LayoutCanvasDropZoneGap`.
  - `ShellTreeDraggableRow` (componente, sustituye a `ShellDndSortableRow`): props `{ path: string;
    dragHandleLabel: string; children: ReactNode }`. El contenedor raíz de la fila es a la vez el elemento
    draggable (activado por un botón de asa, igual que hoy) y el droppable de la zona `nest` (`id =
    nest:${path}`, vía `useDroppable`), con el mismo indicador visual de `isOver` que ya usa
    `ShellDndSortableRow` hoy (`outline emerald` mientras el puntero está encima, sin distinguir aún validez —
    esa distinción ya la aporta `ShellTreeDndContext.onDragOver` vía `data-drop-zone`).
- **Fuera de alcance**:
  - Cablear estos componentes dentro de `shell-menu-list-editor.tsx`/`sidebar-item-list-editor.tsx`: T5/T7.
  - Cualquier lógica de `moveShellSubtree`/`pathRemap`: ya vive en T1/T2, este módulo solo las invoca a través de
    las props `isValidDestination`/`onMoveAttempt` que le pasa quien lo use.
- **Dependencias**: `0125-T1` cerrado (usa su tipo `ShellTreeDestination`; `isValidDestination` se implementará
  en T5/T7 componiendo `isValidShellTreeDestination` de T1, no dentro de este módulo).
- **Impacto esperado en archivos**:
  - Código:
    - `src/dev-runtime/shell-config-panel/shell-config-panel-dnd.tsx` (reescritura completa; se eliminan
      `ShellDndSortableList`/`ShellDndSortableRow`)
  - Tests:
    - `src/tests/dev-runtime/shell-config-panel-dnd.test.tsx` (nuevo)
  - Documentación:
    - `ai-workflow/docs/test-index.md` — añadir `shell-config-panel-dnd.test.tsx` a la sección `dev-runtime/`
      (el fichero anterior no tenía test dedicado propio, solo cobertura indirecta vía
      `shell-config-panel.test.tsx`/`shell-sidebar-list-editor.test.tsx`).
- **Tests**:
  - **Ficheros de test**:
    - `src/tests/dev-runtime/shell-config-panel-dnd.test.tsx` (nuevo)
  - **Comportamiento cubierto**:
    - `parseShellTreeDropZoneId`: `'gap::0'` → `{ type: 'gap', parentPath: '', index: 0 }`; `'gap:0:2'` →
      `{ type: 'gap', parentPath: '0', index: 2 }`; `'nest:0.1'` → `{ type: 'nest', path: '0.1' }`; ids sin el
      prefijo `gap:`/`nest:`, con índice no numérico, o vacíos → `null`.
    - `ShellTreeDndContext` (mismo patrón de mock de `@dnd-kit/core` que ya usan
      `layout-canvas-dnd-wiring.test.tsx`/`shell-config-panel.test.tsx`: `DndContext` pass-through que expone
      `onDragEnd`/`onDragOver` capturados por `id`): un `onDragEnd` con `over` resolviendo a una zona `gap`
      válida invoca `onMoveAttempt` con el `sourcePath`/destino correctos; una zona `nest` válida igual; un
      `onDragEnd` con `isValidDestination` devolviendo `false` no invoca `onMoveAttempt`; un `onDragEnd` sin
      `over` (`null`) no invoca `onMoveAttempt` ni lanza; un `over.id` no parseable no invoca `onMoveAttempt` ni
      lanza.
    - `ShellTreeDndContext.onDragOver`: marca `data-drop-zone` con las clases verdes cuando
      `isValidDestination` es `true`, con las clases rojas cuando es `false`; limpia las clases de la zona
      anterior al pasar a sobrevolar una zona distinta; las limpia también en `onDragCancel`.
    - `ShellTreeGapZone`: renderiza el `id`/`data-drop-zone` esperado a partir de `parentPath`/`index`.
    - `ShellTreeDraggableRow`: expone el botón de asa con `dragHandleLabel` como `aria-label`; el contenedor de
      fila es droppable en `nest:${path}`; aplica el indicador `isOver` mientras el puntero está encima (sin
      mezclarlo con la clase de validez, que es responsabilidad de `ShellTreeDndContext`).
  - **Comandos durante la implementación**:
    - `pnpm test --run src/tests/dev-runtime/shell-config-panel-dnd.test.tsx`
  - **Restricciones**:
    - No añadir `@dnd-kit/sortable` ni ninguna otra dependencia nueva (mismo criterio que el módulo actual, que
      construye el patrón directamente sobre `@dnd-kit/core`).
    - Reutilizar textualmente las constantes de clases Tailwind de validez si `layout-canvas-dnd-context.tsx` las
      exporta; si no las exporta, declararlas localmente con los mismos valores literales (no importar un módulo
      de `layout-canvas/` solo por esas constantes si no están ya pensadas para reutilización externa).
- **Documentación afectada**:
  - `ai-workflow/docs/test-index.md` — añadir `shell-config-panel-dnd.test.tsx` a la sección `dev-runtime/`.
- **Criterios de finalización**:
  - El módulo cubre los criterios de aceptación 3, 4, 5, 6, 7 y los casos límite de ciclo/reordenar-consigo-mismo
    de `spec.md` en cuanto a mecánica de arrastre (wiring), verificado con el mock estándar de `@dnd-kit/core`
    ya usado en el resto de la suite de DnD del proyecto.
  - Todos los tests nuevos en verde; `pnpm test` en verde sin bajar el 80% de cobertura.
- **Cierre de implementación**: módulo de DnD extendido completo en el árbol; ningún editor lo consume todavía
  (inerte hasta T5/T7). `ShellDndSortableList`/`ShellDndSortableRow` ya no existen, pero
  `shell-menu-list-editor.tsx`/`sidebar-item-list-editor.tsx` siguen importándolos hasta T5/T7 — **este cierre
  deja el build roto a propósito entre T3 y T5/T7 si se ejecutan fuera de orden**; la nota de "Dependencias" de
  T5/T7 ya refleja que deben ejecutarse inmediatamente después de T3 en la práctica aunque T4/T6 puedan
  intercalarse.

---

## Task 0125-T4 — Header: control de colapso por `menuItem`/`menuItemChild`

- **ID**: 0125-T4
- **Estado**: pending
- **Objetivo**: Añadir a `shell-menu-list-editor.tsx` (`ShellMenuListEditor` y `ShellMenuChildrenListEditor`) un
  control de colapso/expansión individual por fila, sin tocar todavía el mecanismo de arrastre (sigue usando
  `ShellDndSortableList`/`ShellDndSortableRow` tal cual hasta T5). Cambios:

  **Paso 0 — extraer los tests del menú a un fichero propio (requisito previo de esta tarea, antes de escribir
  ningún test nuevo):** `src/tests/dev-runtime/shell-config-panel.test.tsx` ya tiene 660 líneas y 12 bloques
  `describe` de alto nivel independientes antes de que arranque esta feature, por encima del umbral de
  `ai-workflow/standards/testing-rules.md` ("Cuándo dividir un fichero existente": >~500 líneas y más de un
  dominio, o múltiples `describe` de alto nivel leíbles por separado). Añadir aquí el colapso (y en T5 el
  arrastre extendido) sin dividir agravaría ese problema en el fichero que más domina la sección Shell. Mover los
  cuatro bloques `describe` que hoy cubren en exclusiva a `ShellMenuListEditor`/`ShellMenuChildrenListEditor` —
  `'ShellConfigPanel / menu — add root item with href'`, `'... action variant selector'`, `'... children mode'`,
  `'... reordering by drag'` — a un fichero nuevo `src/tests/dev-runtime/shell-menu-list-editor.test.tsx`, con un
  harness aislado que renderiza `ShellMenuListEditor` directamente (no todo `ShellConfigPanel`) y una función de
  commit local mínima, mismo criterio ya usado por `shell-sidebar-list-editor.test.tsx` para
  `SidebarItemListEditor` (harness propio, sin `RuntimeStateProvider`/`patchRootKey`/`AppShellHeader` — esa
  cobertura de integración completa la sigue aportando `shell-config-panel.test.tsx`). Tras mover esos cuatro
  bloques, dejar en `shell-config-panel.test.tsx` un único `describe` reducido
  `'ShellConfigPanel / menu — list editor mounted in the panel'` con 1-2 tests mínimos de humo (el panel monta
  `ShellMenuListEditor` con el `menu` del config real y un alta de item se refleja en `raw-text` vía el pipeline
  completo de commit) — mismo patrón que ya sigue hoy el `describe` `'sidebar items — recursive editor mounted in
  the panel'` para el sidebar. Los tests nuevos de colapso de esta tarea, y los de arrastre extendido de T5, se
  añaden directamente a `shell-menu-list-editor.test.tsx`, no a `shell-config-panel.test.tsx`.

  - `shell-config-panel.tsx` instancia `const menuCollapse = useShellCollapseState()` (T2) y lo pasa a
    `ShellMenuListEditor` como nueva prop `collapse: { isCollapsed, toggleCollapse, applyPathRemap }`.
    `ShellMenuListEditor` la reenvía a `ShellMenuChildrenListEditor` sin transformarla (el hook es único para
    todo el árbol del menú).
  - Convención de `path` para el mapa de colapso, ya alineada con T1 desde el principio (el header no tiene una
    convención previa que migrar): un item raíz en el índice `i` usa `path = String(i)`; un hijo en el índice `j`
    del padre `i` usa `path = ${i}.${j}`.
  - Cada fila (dentro de `ShellDndSortableRow`, sin cambios en ese componente todavía) añade, en la misma línea
    que ya contiene el botón "Quitar" (pasa de `justify-end` a `justify-between`), un botón de colapso al inicio:
    `aria-expanded={!collapsed}`, `aria-label` = `` `${collapsed ? 'Expandir' : 'Colapsar'} ${labelText}` ``
    (reutiliza el `labelText` que ya calcula cada list editor, p. ej. `"Elemento de menú 1"`), `data-testid` =
    `` `menu-item-collapse-toggle-${path}` ``. Al pulsarlo, llama a `collapse.toggleCollapse(path)`.
  - Cuando `collapse.isCollapsed(path)` es `true`, la fila **no** renderiza `<MenuItemFieldsEditor>`; en su lugar
    renderiza una fila resumen `data-testid="menu-item-summary-${path}"` con el `label` y, si existe, el `icon`
    del item tal cual están configurados (sin resolver referencias dinámicas ni interpolación — mismo criterio de
    solo-lectura que ya usa el breadcrumb de `Layout`, que tampoco resuelve `{{...}}`). El `<CommitRejectionBanner>`
    de esa fila (si hay una entrada pendiente para ese índice) se sigue renderizando igual tanto colapsado como
    expandido — no debe quedar oculto por el colapso (caso límite de la spec).
  - Cuando el item está en modo "Con desplegable" (`item.children !== undefined`), la fila muestra, junto al
    botón de colapso (misma línea de cabecera, visible tanto colapsado como expandido), un icono indicador de
    rama distinto del `icon` propio del item (usar un icono de `lucide-react` importado directamente, mismo
    precedente que `dev-editor-floating-toolbar.tsx`; la elección exacta de icono es un ajuste visual menor sin
    impacto de contrato) con `aria-hidden="true"` y `data-testid="menu-item-branch-indicator-${path}"`. Un item
    sin `children` nunca renderiza este indicador.
  - El contenedor de `children` que renderiza `ShellMenuChildrenListEditor` (su `<fieldset>`) ya recibe el mismo
    `gap-2` de separación entre su propio contenido y el resto de la fila padre gracias al `flex flex-col gap-2`
    que ya declara `ShellDndSortableRow`; verificar explícitamente con un test que ese espacio (antes del primer
    hijo) es igual al `gap-2` que separa a los hermanos dentro de `ShellDndSortableList` — si al añadir la fila
    de cabecera (botón colapso + indicador de rama) ese espacio se altera, ajustar el `className` para
    preservarlo, no introducir un valor de espaciado distinto.
- **Fuera de alcance**:
  - Arrastre/anidado entre niveles: `0125-T5`.
  - `menu-item-fields-editor.tsx`: no requiere cambios (el colapso decide si se renderiza el componente entero,
    no qué renderiza por dentro).
  - Sidebar: `0125-T6`.
- **Dependencias**: `0125-T2` cerrado (usa `useShellCollapseState`).
- **Impacto esperado en archivos**:
  - Código:
    - `src/dev-runtime/shell-config-panel/shell-config-panel.tsx` (instancia el hook de colapso del menú, nueva
      prop hacia `ShellMenuListEditor`)
    - `src/dev-runtime/shell-config-panel/shell-menu-list-editor.tsx` (`ShellMenuListEditor`,
      `ShellMenuChildrenListEditor`: botón de colapso, fila resumen, icono de rama)
  - Tests:
    - `src/tests/dev-runtime/shell-menu-list-editor.test.tsx` (nuevo — recibe los cuatro `describe` movidos desde
      `shell-config-panel.test.tsx` sin cambiar sus aserciones, más los tests nuevos de colapso de esta tarea)
    - `src/tests/dev-runtime/shell-config-panel.test.tsx` (ampliación — se reduce a un único `describe` de humo
      para el menú; ver Paso 0 del objetivo)
  - Documentación:
    - `ai-workflow/docs/app-features/development/dev-mode-editor.md`
    - `ai-workflow/docs/test-index.md`
- **Tests**:
  - **Ficheros de test**:
    - `src/tests/dev-runtime/shell-menu-list-editor.test.tsx` (nuevo)
    - `src/tests/dev-runtime/shell-config-panel.test.tsx` (ampliación)
  - **Comportamiento cubierto**:
    - Los cuatro `describe` movidos (`add root item with href`, `action variant selector`, `children mode`,
      `reordering by drag`) siguen pasando byte a byte igual tras el traslado y el cambio de harness (regresión
      de la extracción del Paso 0).
    - El `describe` de humo que permanece en `shell-config-panel.test.tsx` confirma que `ShellMenuListEditor`
      sigue montado dentro del panel real y conectado al pipeline de commit completo (`validateRuntimeConfig` +
      `patchRootKey`), sin repetir la matriz de casos que ya cubre el fichero dedicado.
    - Un `menuItem` raíz recién montado expone su control de colapso con `aria-expanded="true"` (default
      expandido) y sigue mostrando `<MenuItemFieldsEditor>` completo.
    - Pulsar el botón de colapso de un item raíz oculta sus campos (`getByLabelText`/`queryByRole` para los
      inputs de `MenuItemFieldsEditor` ya no están) y muestra la fila resumen con su `label`/`icon`; sus hijos
      (si los tiene y están expandidos en el árbol) siguen visibles e interactivos debajo, indentados.
    - Un `menuItem` en modo "Con desplegable" muestra el icono indicador de rama tanto colapsado como expandido;
      un item en modo `href`/`action`/`none` nunca lo muestra.
    - Colapsar un item con un aviso de rechazo pendiente mantiene el `role="alert"` visible tras colapsar (usar,
      en el harness aislado de `shell-menu-list-editor.test.tsx`, el mismo mecanismo de commit simulado que
      rechaza en función de un valor de test que ya usa `shell-sidebar-list-editor.test.tsx`, o el pipeline real
      de `validateRuntimeConfig` si el harness de este fichero ya lo monta tras el Paso 0 — cualquiera de los dos
      es válido siempre que el rechazo sea genuino, no simulado con un mock que nunca falla).
    - Colapsar un item padre no deshabilita el botón "Añadir elemento de desplegable" de su lista de hijos ni el
      botón de colapso/campos de un hijo ya expandido.
    - El espacio (medido por `className`/estructura DOM, no por píxeles reales en jsdom) entre la fila de un item
      con hijos y su primer hijo usa la misma clase de gap (`gap-2`) que ya separa a los hermanos de esa lista —
      test de regresión de clase, no de medición real.
    - Colapsar/expandir un item raíz no cambia el estado de colapso de otros items (independencia por `path`).
  - **Comandos durante la implementación**:
    - `pnpm test --run src/tests/dev-runtime/shell-menu-list-editor.test.tsx`
    - `pnpm test --run src/tests/dev-runtime/shell-config-panel.test.tsx`
  - **Restricciones**:
    - No introducir un `data-testid` distinto por cada campo oculto al colapsar: basta con comprobar la ausencia
      del contenedor de `MenuItemFieldsEditor` (por ejemplo, por la ausencia de un campo que solo él renderiza,
      como el input de "Etiqueta") y la presencia de la fila resumen.
    - Ejecutar `pnpm test --run` sobre ambos ficheros tras el Paso 0 antes de añadir ningún test nuevo, para
      confirmar que la extracción no rompió ninguna aserción movida (mismo criterio que "Cómo dividir" de
      `testing-rules.md`: verificar tras cada fichero extraído, no solo al final).
- **Documentación afectada**:
  - `ai-workflow/docs/app-features/development/dev-mode-editor.md` — sección "Sección Shell (dominio de
    configuración)": documentar el control de colapso, la fila resumen y el icono de rama para `menuItem`.
  - `ai-workflow/docs/test-index.md` — añadir `shell-menu-list-editor.test.tsx` a la sección `dev-runtime/` y
    actualizar la entrada de `shell-config-panel.test.tsx` (o crearla, si todavía no existe) para reflejar su
    alcance reducido.
- **Criterios de finalización**:
  - Cubre los criterios de aceptación 1 (parcial: colapso sin arrastre todavía), 2 (parcial: colapso +
    add-child, arrastre se suma en T5), 11 y 12, y el caso límite de aviso de rechazo bajo colapso, todos sobre
    `shell.header.menu`.
  - Todos los tests nuevos/ampliados en verde; `pnpm test` en verde sin bajar el 80% de cobertura.
- **Cierre de implementación**: colapso por item operativo en el editor de menú del header; el arrastre sigue
  siendo el de nivel único ya existente hasta `0125-T5`.

---

## Task 0125-T5 — Header: arrastre extendido entre niveles (anidar/mover)

- **ID**: 0125-T5
- **Estado**: pending
- **Objetivo**: Sustituir en `shell-menu-list-editor.tsx` el DnD por nivel (`ShellDndSortableList`/
  `ShellDndSortableRow`, uno por lista) por el módulo compartido de T3 (`ShellTreeDndContext`/`ShellTreeGapZone`/
  `ShellTreeDraggableRow`), montando **un único** `ShellTreeDndContext` que envuelve todo el árbol del menú
  (`ShellMenuListEditor` lo monta una vez; `ShellMenuChildrenListEditor` ya no monta el suyo propio, solo
  renderiza zonas `gap`/filas dentro del contexto heredado).
  - `shell-config-panel.tsx` añade el manejador de movimiento, que necesita tanto el árbol de menú actual como el
    hook de colapso de T4:
    ```ts
    function handleMoveMenuItem(sourcePath: string, destination: ShellTreeDestination): void {
      const { tree, pathRemap } = moveShellSubtree(header?.menu ?? [], sourcePath, destination)
      const result = commitMenu(tree)
      if (result.status !== 'rejected') menuCollapse.applyPathRemap(pathRemap)
    }
    function isValidMenuDestination(sourcePath: string, destination: ShellTreeDestination): boolean {
      return isValidShellTreeDestination(header?.menu ?? [], sourcePath, destination, 1)
    }
    ```
    (`maxDepth: 1`, el tope de `menuItem`). Ambas se pasan a `ShellMenuListEditor` como nuevas props
    `onMoveItem`/`isValidDestination`.
  - `ShellMenuListEditor` monta `<ShellTreeDndContext treeId="shell-menu" onMoveAttempt={onMoveItem}
    isValidDestination={isValidDestination}>` envolviendo toda la lista raíz y, recursivamente,
    `ShellMenuChildrenListEditor` para cada item con hijos (sin montar un segundo `ShellTreeDndContext`).
  - Cada fila pasa de `ShellDndSortableRow` a `ShellTreeDraggableRow` con `path` (misma convención de T4: `'0'`,
    `'0.1'`, ...) en vez de `index`. Se añaden `ShellTreeGapZone` antes del primer item, entre cada par de items
    consecutivos y después del último, tanto en la lista raíz como en cada lista de `children` — `N+1` zonas por
    `N` items, mismo criterio que `LayoutRenderer` en `src/runtime/`.
  - Eliminar la función local `reorder()` de `shell-menu-list-editor.tsx`: reordenar dentro del mismo nivel pasa
    a ser `onMoveItem(path, { type: 'gap', parentPath: parentOf(path), index: targetIndex })`, el mismo camino
    que anidar/mover a otro nivel (Decisión 3 de `design.md`).
  - Anidar sobre un item hoja (Decisión 5): el resultado de `moveShellSubtree` con destino `nest` ya deja
    `children: [nodo movido]` gracias a `appendChildAtPath` (T1); no requiere lógica adicional aquí.
- **Fuera de alcance**:
  - Sidebar: `0125-T7`.
  - Cualquier cambio a `isValidShellTreeDestination`/`moveShellSubtree` (ya cerrados en T1).
- **Dependencias**: `0125-T3` y `0125-T4` cerradas (mismo fichero que T4; añade el módulo de DnD de T3); `0125-T1`
  y `0125-T2` (invoca sus funciones directamente).
- **Impacto esperado en archivos**:
  - Código:
    - `src/dev-runtime/shell-config-panel/shell-config-panel.tsx` (`handleMoveMenuItem`,
      `isValidMenuDestination`, wiring hacia `ShellMenuListEditor`)
    - `src/dev-runtime/shell-config-panel/shell-menu-list-editor.tsx` (sustitución completa del DnD por nivel por
      el compartido de T3; eliminación de `reorder()`)
  - Tests:
    - `src/tests/dev-runtime/shell-menu-list-editor.test.tsx` (ampliación: reescribe el `describe` "reordering by
      drag" para el nuevo mock de `ShellTreeDndContext`/ids `gap:`/`nest:`, y añade una sección nueva de
      anidado/movimiento entre niveles — fichero introducido en `0125-T4`)
  - Documentación:
    - `ai-workflow/docs/app-features/development/dev-mode-editor.md`
    - `ai-workflow/docs/test-index.md`
- **Tests**:
  - **Ficheros de test**:
    - `src/tests/dev-runtime/shell-menu-list-editor.test.tsx` (ampliación)
  - **Comportamiento cubierto**:
    - Reordenar la lista raíz del menú vía una zona `gap` persiste el nuevo orden en el config (reemplaza la
      aserción equivalente que hoy usa ids numéricos `'0'`/`'2'` de `ShellDndSortableRow` por los nuevos ids
      `gap:...`).
    - Reordenar los `children` de un padre vía una zona `gap` interna persiste el orden dentro de ese array sin
      tocar la raíz ni otros padres.
    - Anidar un `menuItem` raíz existente sobre el cuerpo (`nest:`) de otro `menuItem` raíz de profundidad 0 lo
      convierte en hijo de profundidad 1 (criterio de aceptación 4); si el destino ya tenía `children`, se añade
      al final; si el destino era hoja, sustituye su `href`/`action` por `children: [nodo]` (Decisión 5).
    - Intentar anidar un item que ya está en `children` (profundidad 1) dentro de otro item también en
      `children` se bloquea: no se acepta al soltar y el config no cambia (criterio de aceptación 5); test
      adicional comprobando que la zona `nest` correspondiente recibe la clase de indicador inválido durante
      `onDragOver`.
    - Mover un `menuItem`/hijo existente a una zona `gap` de la lista raíz lo saca de su padre actual y lo sitúa
      en la posición ordinal de la raíz (criterio de aceptación 6).
    - Root y children del menú comparten el mismo `DndContext` (mismo `treeId`/mock capturado), a diferencia del
      comportamiento anterior — reemplaza el test que hoy afirma "contexts independientes por nivel" por uno que
      afirma "mismo contexto para todo el árbol del menú".
    - Mover un item con hijos en distintos estados de colapso (colapsar uno, dejar otro expandido, mover el
      padre) conserva el estado de colapso de cada descendiente tras la mutación, verificado leyendo
      `aria-expanded` de cada fila antes y después del movimiento por su nueva posición.
    - Arrastrar el último item visible de una lista de un solo elemento hasta su única zona `gap` disponible no
      produce cambio ni error.
    - Un intento de arrastre con `over` resolviendo a un id ajeno/no parseable sigue sin producir cambio ni
      lanzar (regresión del test ya existente "out-of-range/foreign drop id").
  - **Comandos durante la implementación**:
    - `pnpm test --run src/tests/dev-runtime/shell-menu-list-editor.test.tsx`
    - `pnpm test --run src/tests/dev-runtime/shell-config-panel.test.tsx` (sanity: el `describe` de humo que
      dejó `0125-T4` sigue montando `ShellMenuListEditor` con el nuevo DnD sin errores)
  - **Restricciones**:
    - Actualizar (no duplicar) las aserciones existentes de "reordering by drag" y "root menu and a children
      sublist use independent DnD contexts" que ya no describen el comportamiento correcto tras esta tarea; no
      dejar ambas versiones (antigua y nueva) conviviendo en el fichero.
- **Documentación afectada**:
  - `ai-workflow/docs/app-features/development/dev-mode-editor.md` — sección "Sección Shell (dominio de
    configuración)" / "Reordenar por arrastre": sustituir la descripción de "solo mismo nivel" por el nuevo
    comportamiento de anidado/movimiento entre niveles, con el tope de profundidad de `menuItem`.
  - `ai-workflow/docs/test-index.md` — actualizar la entrada de `shell-menu-list-editor.test.tsx` (creada en
    `0125-T4`) para reflejar que también cubre arrastre extendido entre niveles, no solo colapso.
- **Criterios de finalización**:
  - Cubre los criterios de aceptación 1, 2, 4, 5, 6 (mitad header), 7 (mitad header, la otra mitad la cierra T7)
    y 10 (regresión) sobre `shell.header.menu`, más el caso límite de mover un subárbol con colapso mixto.
  - Todos los tests nuevos/ampliados en verde; `pnpm test` en verde sin bajar el 80% de cobertura.
- **Cierre de implementación**: arrastre extendido completo y operativo para `shell.header.menu`, incluida la
  preservación del estado de colapso a través de movimientos.

---

## Task 0125-T6 — Sidebar: control de colapso por `sidebarItem`

- **ID**: 0125-T6
- **Estado**: pending
- **Objetivo**: Mismo patrón que T4, aplicado a `sidebar-item-list-editor.tsx` (`SidebarItemListEditor`,
  genuinamente recursivo, sin tope de profundidad). Incluye, además, normalizar la convención de su prop `path`
  a la que usa el módulo de T1 (sin el prefijo literal `'root'`), para que el `pathRemap` que producirá T7 pueda
  aplicarse directamente sobre las claves del mapa de colapso sin una capa de traducción intermedia:
  - Cambiar el prop `path` de `SidebarItemListEditor`: la lista raíz pasa a identificarse con `''` (no `'root'`);
    un nivel anidado sigue siendo `` `${parentPath}.${index}` `` (sin cambios en ese caso, ya coincide con T1).
    Actualizar el único call site (`shell-config-panel.tsx`, que hoy pasa `path="root"`) a `path=""`.
    `computeLevelLabelPrefix` deja de tratar `'root'` como caso especial y pasa a tratar `''` (comprobar con
    `path === ''` en vez de `path === 'root'`); el resto de su lógica (quitar el prefijo, sumar 1 a cada
    segmento para la numeración 1-based visible) no cambia.
  - Instanciar `const sidebarCollapse = useShellCollapseState()` en `shell-config-panel.tsx` (independiente del
    de T4/T5 para el menú) y pasarlo a `SidebarItemListEditor` como prop `collapse`, reenviada sin transformar en
    cada llamada recursiva a sí mismo.
  - Añadir el mismo botón de colapso (misma línea que "Quitar", mismo `aria-expanded`/`aria-label`,
    `data-testid="sidebar-item-collapse-toggle-${path}"`), la misma fila resumen
    (`data-testid="sidebar-item-summary-${path}"`) sustituyendo a `<SidebarItemFieldsEditor>` cuando está
    colapsado, y el mismo icono indicador de rama (`data-testid="sidebar-item-branch-indicator-${path}"`) cuando
    `item.children !== undefined`, a cualquier profundidad — sin la restricción de "solo raíz" que tiene el
    header, porque `sidebarItem` no tiene tope.
  - Mismo criterio de espacio antes del primer hijo (`gap-2` ya heredado de `ShellDndSortableRow`), verificado
    igual que en T4.
- **Fuera de alcance**:
  - Arrastre/anidado entre niveles: `0125-T7`.
  - `sidebar-item-fields-editor.tsx`: no requiere cambios.
  - Header: ya cerrado en T4.
- **Dependencias**: `0125-T2` cerrado (usa `useShellCollapseState`); independiente de T4/T5 (dominio de datos
  distinto), aunque se ejecuta después en este plan por orden de seguimiento.
- **Impacto esperado en archivos**:
  - Código:
    - `src/dev-runtime/shell-config-panel/shell-config-panel.tsx` (instancia el hook de colapso del sidebar,
      `path=""` en la llamada raíz, nueva prop hacia `SidebarItemListEditor`)
    - `src/dev-runtime/shell-config-panel/sidebar-item-list-editor.tsx` (`computeLevelLabelPrefix`, botón de
      colapso, fila resumen, icono de rama, normalización de `path`)
  - Tests:
    - `src/tests/dev-runtime/shell-sidebar-list-editor.test.tsx` (ampliación: actualiza cualquier uso directo de
      `path="root"` en el harness de este fichero a `path=""`, y añade los tests nuevos de colapso)
    - `src/tests/dev-runtime/shell-config-panel.test.tsx` (ampliación menor: la sección "sidebar items —
      recursive editor mounted in the panel" sigue pasando con `path=""`, sin nuevas aserciones de colapso aquí —
      esas viven en el fichero dedicado del editor recursivo)
  - Documentación:
    - `ai-workflow/docs/app-features/development/dev-mode-editor.md`
    - `ai-workflow/docs/test-index.md`
- **Tests**:
  - **Ficheros de test**:
    - `src/tests/dev-runtime/shell-sidebar-list-editor.test.tsx` (ampliación)
    - `src/tests/dev-runtime/shell-config-panel.test.tsx` (ampliación menor)
  - **Comportamiento cubierto**:
    - Mismo catálogo de comportamiento que T4 (default expandido, colapsar oculta solo los campos propios y deja
      hijos visibles, icono de rama presente solo con `children`, aviso de rechazo pendiente visible bajo
      colapso, "añadir hijo" operativo con el padre colapsado, independencia entre `path`s), pero verificado a
      **al menos tres niveles de profundidad** (raíz, hijo, nieto) para confirmar que no hay límite de
      profundidad en el colapso, a diferencia del header.
    - El `path` raíz pasado por el harness/`ShellConfigPanel` es `''`; un item raíz usa `path` `'0'`, `'1'`, ...;
      un nieto usa `'0.0.1'` — regresión explícita de que la convención cambió respecto al `'root'`/`'root.0'`
      anterior en cualquier aserción que dependiera de ese literal.
    - El espacio antes del primer hijo de un `sidebarItem` con `children` usa la misma clase de gap que separa a
      los hermanos de esa lista, a cualquier profundidad.
  - **Comandos durante la implementación**:
    - `pnpm test --run src/tests/dev-runtime/shell-sidebar-list-editor.test.tsx`
    - `pnpm test --run src/tests/dev-runtime/shell-config-panel.test.tsx`
  - **Restricciones**:
    - No dejar ningún literal `'root'` residual en `sidebar-item-list-editor.tsx` ni en sus tests tras el cambio
      de convención (ni en `path` por defecto, ni en `dndContextId` derivado — este último de todos modos
      desaparece por completo en T7).
- **Documentación afectada**:
  - `ai-workflow/docs/app-features/development/dev-mode-editor.md` — sección "Sección Shell (dominio de
    configuración)": documentar el control de colapso, la fila resumen y el icono de rama para `sidebarItem`, sin
    límite de profundidad.
  - `ai-workflow/docs/test-index.md` — actualizar la entrada de `shell-sidebar-list-editor.test.tsx` (línea
    existente en la sección `dev-runtime/`) para reflejar los tests de colapso añadidos aquí; la frase de esa
    entrada sobre "reordenación por arrastre limitada al mismo nivel" queda desactualizada por esta tarea (el
    `path` cambia de convención) y por `0125-T7` (deja de haber tope de nivel) — corregirla en `0125-T7`, cuando
    deje de ser cierta también en el comportamiento real.
- **Criterios de finalización**:
  - Cubre los criterios de aceptación 1, 2 (parcial, sin arrastre todavía), 11 y 12 sobre `shell.sidebar.items` a
    cualquier profundidad.
  - Todos los tests nuevos/ampliados en verde; `pnpm test` en verde sin bajar el 80% de cobertura.
- **Cierre de implementación**: colapso por item operativo en el editor recursivo de sidebar a cualquier
  profundidad; convención de `path` ya alineada con T1; el arrastre sigue siendo el de nivel único ya existente
  hasta `0125-T7`.

---

## Task 0125-T7 — Sidebar: arrastre extendido entre niveles (anidar/mover, sin tope)

- **ID**: 0125-T7
- **Estado**: pending
- **Objetivo**: Mismo patrón que T5, aplicado a `sidebar-item-list-editor.tsx`, con `maxDepth: null` (sin tope de
  profundidad) y montando el `ShellTreeDndContext` de T3 **una sola vez**, en la invocación raíz
  (`path === ''`) de `SidebarItemListEditor` — las llamadas recursivas para niveles anidados no vuelven a montar
  un contexto propio, solo añaden sus propias zonas `gap`/filas `nest` dentro del heredado (a diferencia de hoy,
  que monta un `ShellDndSortableList` nuevo en cada nivel de la recursión).
  - `shell-config-panel.tsx` añade, análogo a `handleMoveMenuItem`/`isValidMenuDestination` de T5:
    ```ts
    function handleMoveSidebarItem(sourcePath: string, destination: ShellTreeDestination): void {
      const { tree, pathRemap } = moveShellSubtree(sidebar?.items ?? [], sourcePath, destination)
      const result = commitSidebarItems(tree)
      if (result.status !== 'rejected') sidebarCollapse.applyPathRemap(pathRemap)
    }
    function isValidSidebarDestination(sourcePath: string, destination: ShellTreeDestination): boolean {
      return isValidShellTreeDestination(sidebar?.items ?? [], sourcePath, destination, null)
    }
    ```
    pasadas a `SidebarItemListEditor` como nuevas props `onMoveItem`/`isValidDestination`, reenviadas sin
    transformar en cada llamada recursiva.
  - Eliminar la función local `reorder()` de `sidebar-item-list-editor.tsx`, igual que T5 hizo con la del header.
  - Sustituir `ShellDndSortableList`/`ShellDndSortableRow` por `ShellTreeGapZone`/`ShellTreeDraggableRow` en cada
    nivel de la recursión, montando `ShellTreeDndContext` (`treeId="shell-sidebar"`) únicamente cuando
    `path === ''`.
  - Verificación estructural de aislamiento entre árboles (criterio de aceptación 7, ya con header y sidebar
    ambos usando el nuevo mecanismo tras esta tarea): un intento de arrastre entre el árbol del menú del header y
    el del sidebar no tiene ningún `over.id` común que resolver — comprobar en el test que ambos `ShellTreeDndContext`
    (`treeId="shell-menu"` / `treeId="shell-sidebar"`) son instancias de `DndContext` completamente separadas
    (mismo criterio que ya usaba el test "independent DnD contexts" retirado en T5, pero ahora a nivel de árbol
    completo en vez de a nivel de lista).
- **Fuera de alcance**:
  - Header: ya cerrado en T5.
  - Cualquier cambio a `isValidShellTreeDestination`/`moveShellSubtree` (T1) o a `ShellTreeDndContext` (T3).
- **Dependencias**: `0125-T3` y `0125-T6` cerradas (mismo fichero que T6; añade el módulo de DnD de T3); `0125-T1`
  y `0125-T2` (invoca sus funciones directamente).
- **Impacto esperado en archivos**:
  - Código:
    - `src/dev-runtime/shell-config-panel/shell-config-panel.tsx` (`handleMoveSidebarItem`,
      `isValidSidebarDestination`, wiring hacia `SidebarItemListEditor`)
    - `src/dev-runtime/shell-config-panel/sidebar-item-list-editor.tsx` (sustitución completa del DnD por nivel
      por el compartido de T3, montado una única vez en la raíz; eliminación de `reorder()`)
  - Tests:
    - `src/tests/dev-runtime/shell-sidebar-list-editor.test.tsx` (ampliación: reescribe "reordering by drag" para
      el nuevo mock, añade sección de anidado/movimiento entre niveles a varias profundidades)
    - `src/tests/dev-runtime/shell-config-panel.test.tsx` (ampliación: test de aislamiento estructural entre el
      árbol del header y el del sidebar)
  - Documentación:
    - `ai-workflow/docs/app-features/development/dev-mode-editor.md`
    - `ai-workflow/docs/app-features/shell/sidebar.md`
    - `ai-workflow/docs/test-index.md`
- **Tests**:
  - **Ficheros de test**:
    - `src/tests/dev-runtime/shell-sidebar-list-editor.test.tsx` (ampliación)
    - `src/tests/dev-runtime/shell-config-panel.test.tsx` (ampliación)
  - **Comportamiento cubierto**:
    - Reordenar la lista raíz y los `children` de cualquier padre (a varios niveles de profundidad) vía zonas
      `gap` persiste el nuevo orden, reemplazando las aserciones que hoy dependen de un `dndContextId` distinto
      por nivel.
    - Anidar un `sidebarItem` existente sobre el cuerpo (`nest:`) de otro `sidebarItem` lo convierte en su hijo,
      a cualquier profundidad, sin límite (criterio de aceptación 3), incluido anidar a una profundidad de al
      menos 4 niveles para confirmar la ausencia de tope.
    - Mover un `sidebarItem` existente a una zona `gap` de la lista raíz lo saca de su padre actual y lo sitúa en
      la posición ordinal de la raíz (criterio de aceptación 6, mitad sidebar).
    - Un intento de anidar un item dentro de su propio descendiente se bloquea (indicador inválido durante
      `onDragOver`, sin cambio al soltar) — caso límite de ciclo, aquí sin la restricción de profundidad que sí
      aplica al header.
    - Mover un subárbol con hijos en distintos estados de colapso conserva el estado de cada descendiente tras la
      mutación, igual verificación que T5 pero a mayor profundidad.
    - El árbol del header y el del sidebar no comparten `DndContext`: un `sourcePath` capturado del contexto del
      menú no resuelve nada si se invoca contra el `onDragEnd` capturado del contexto del sidebar (y viceversa) —
      test de aislamiento estructural (criterio de aceptación 7, cierre completo junto con T5).
  - **Comandos durante la implementación**:
    - `pnpm test --run src/tests/dev-runtime/shell-sidebar-list-editor.test.tsx`
    - `pnpm test --run src/tests/dev-runtime/shell-config-panel.test.tsx`
  - **Restricciones**:
    - Actualizar (no duplicar) las aserciones existentes de "reordering by drag" y "root list and nested children
      list use independent DnD contexts" que ya no describen el comportamiento correcto tras esta tarea.
- **Documentación afectada**:
  - `ai-workflow/docs/app-features/development/dev-mode-editor.md` — sección "Sección Shell (dominio de
    configuración)" / "Reordenar por arrastre": completar la descripción con el comportamiento sin tope del
    sidebar.
  - `ai-workflow/docs/app-features/shell/sidebar.md` — su sección "Editor visual" ya enlaza a
    `dev-mode-editor.md`; revisar si la frase "sin límite de profundidad" necesita mencionar también el arrastre.
  - `ai-workflow/docs/test-index.md` — corregir en la entrada de `shell-sidebar-list-editor.test.tsx` la frase
    "reordenación por arrastre limitada al mismo nivel" (ya no es cierta tras esta tarea) y añadir la cobertura
    de anidado/movimiento entre niveles y de aislamiento estructural frente al árbol del header.
- **Criterios de finalización**:
  - Cubre los criterios de aceptación 1, 2, 3, 6 (mitad sidebar), 7 (cierre completo) y 10 (regresión) sobre
    `shell.sidebar.items` a cualquier profundidad, más el caso límite de ciclo y el de mover un subárbol con
    colapso mixto.
  - Todos los tests nuevos/ampliados en verde; `pnpm test` en verde sin bajar el 80% de cobertura.
- **Cierre de implementación**: arrastre extendido completo y operativo para `shell.sidebar.items` a cualquier
  profundidad; ambos árboles (header, sidebar) verificablemente aislados entre sí; ningún componente del dominio
  Shell importa ya `ShellDndSortableList`/`ShellDndSortableRow`.

---

## Task 0125-T8 — Sub-vistas "Header"/"Sidebar" en la sección Shell

- **ID**: 0125-T8
- **Estado**: pending
- **Objetivo**: Añadir a `shell-config-panel.tsx` una sub-navegación `role="tablist"` con dos `role="tab"`
  ("Header", "Sidebar") controlando `aria-selected`/`aria-controls` hacia dos `role="tabpanel"` (Decisión 6 de
  `design.md`). Ambos `tabpanel` permanecen **siempre montados**; la sub-vista no activa se oculta con la clase
  Tailwind `hidden` (mismo precedente ya documentado para `accordion`/`modal` en modo Editor: "su cuerpo...
  siempre presentes en el DOM"), nunca con renderizado condicional. El estado de qué tab está activo es
  `useState<'header' | 'sidebar'>('header')` local al componente (no persiste entre recargas, ya fuera de alcance
  por la spec).
  - El `tabpanel` "Header" envuelve el bloque ya existente: toggle "Header activo", logo, título,
    `ShellMenuListEditor`, `ShellActionsListEditor`.
  - El `tabpanel` "Sidebar" envuelve el bloque ya existente: toggle "Sidebar activo", `SidebarItemListEditor`
    (el campo `defaultCollapsed` ya vive en el shape de `shell.sidebar`; si el panel no lo edita todavía a día de
    esta tarea — comprobar contra el código actual de `shell-config-panel.tsx` antes de implementar — añadir un
    campo booleano simple para él dentro de este mismo `tabpanel`, reutilizando `BooleanPropertyField` como ya
    hace el resto del panel; si ya existe, no tocarlo).
  - Ninguno de los dos pipelines de commit (`commitMenu`/`commitActions`/`commitHeaderField` vs
    `commitSidebarItems`) cambia: la sub-navegación es puramente de presentación sobre el árbol ya existente de
    componentes.
  - No hay lógica de cancelación de arrastre al cambiar de tab: con el único sensor configurado
    (`PointerSensor`, sin `KeyboardSensor`), un arrastre en curso mantiene capturado el puntero sobre el árbol de
    la sub-vista activa, por lo que no hay una secuencia de interacción real en la que el usuario pueda clicar el
    otro tab durante un arrastre (Decisión 6, "cambiar de sub-vista con un arrastre en curso").
- **Fuera de alcance**:
  - Cualquier cambio a los editores de menú/sidebar/acciones en sí (ya cerrados en T4-T7): esta tarea solo los
    envuelve.
  - Extender el patrón de sub-vistas a otras pestañas del editor (`Api`, `Páginas`, `Tokens`, `Translations`) —
    explícitamente fuera de alcance de la spec.
- **Dependencias**: `0125-T4`, `0125-T5`, `0125-T6`, `0125-T7` cerradas (evita reabrir `shell-config-panel.tsx`
  varias veces mientras cambia de forma; no hay dependencia técnica real de la sub-navegación sobre el contenido
  interno de cada sub-vista).
- **Impacto esperado en archivos**:
  - Código:
    - `src/dev-runtime/shell-config-panel/shell-config-panel.tsx` (sub-navegación `tablist`/`tab`/`tabpanel`)
  - Tests:
    - `src/tests/dev-runtime/shell-config-panel.test.tsx` (ampliación)
  - Documentación:
    - `ai-workflow/docs/app-features/development/dev-mode-editor.md`
- **Tests**:
  - **Ficheros de test**:
    - `src/tests/dev-runtime/shell-config-panel.test.tsx` (ampliación)
  - **Comportamiento cubierto**:
    - Al montar, la sub-vista "Header" está activa por defecto (`aria-selected="true"` en su `tab`, su `tabpanel`
      visible sin `hidden`); la sub-vista "Sidebar" está montada pero oculta (`hidden` presente, no ausente del
      DOM — comprobar con `queryByTestId`/`getByTestId`, no con `queryByRole` inexistente).
    - Clicar el tab "Sidebar" activa esa sub-vista (`aria-selected` se invierte en ambos tabs, la clase `hidden`
      se mueve del panel de Sidebar al de Header) sin desmontar ninguno de los dos (verificar que un estado local
      del panel de Header — por ejemplo un valor de campo ya editado, o el estado de colapso de T4/T5 — sigue
      presente al volver a Header).
    - Un aviso de commit rechazado (`role="alert"`) pendiente en un campo de la sub-vista no visible sigue
      presente en el DOM tras cambiar de tab y volver (criterio de aceptación 9).
    - El toggle "Header activo"/"Sidebar activo" y el resto de campos de cada sub-vista siguen funcionando
      exactamente igual que antes de esta tarea dentro de su propio `tabpanel` (regresión mínima: reutilizar
      alguna aserción ya existente de las secciones "header toggle"/"sidebar toggle" de este mismo fichero,
      adaptada al nuevo contenedor).
  - **Comandos durante la implementación**:
    - `pnpm test --run src/tests/dev-runtime/shell-config-panel.test.tsx`
  - **Restricciones**:
    - No usar renderizado condicional (`{activeTab === 'header' && <...>}`) para ninguno de los dos `tabpanel`;
      ambos deben estar siempre en el árbol React, alternando solo la clase `hidden`.
- **Documentación afectada**:
  - `ai-workflow/docs/app-features/development/dev-mode-editor.md` — sección "Sección Shell (dominio de
    configuración)": documentar la sub-navegación Header/Sidebar, su patrón `tablist`/`tabpanel` y la
    preservación de estado entre sub-vistas.
- **Criterios de finalización**:
  - Cubre los criterios de aceptación 8 y 9 de `spec.md` en su totalidad.
  - Todos los tests nuevos/ampliados en verde; `pnpm test` (suite completa) en verde sin bajar el 80% de
    cobertura.
- **Cierre de implementación**: sección Shell completa con sub-vistas Header/Sidebar, colapso por item y
  arrastre extendido entre niveles en ambos árboles — cierra la feature 0125 en cuanto a implementación.
