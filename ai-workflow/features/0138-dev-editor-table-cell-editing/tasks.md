# Tasks — 0138 dev-editor-table-cell-editing

Contrato de ejecución. Orden estrictamente secuencial (T1 → T9); cada tarea asume cerradas todas
las anteriores. Referencias a `design.md` por decisión (D1–D8).

**Revisión 2026-08-19**: `design.md` se revisó tras una primera pasada de implementación completa
de T1–T9 (disposición `role="grid"` original de D5, validada por el usuario contra el ancho real
del panel de propiedades, ~370px, e insuficiente). D5 se sustituyó por secciones apiladas con
acordeones y reordenamiento (arrastre + botones "Subir"/"Bajar"); D8 confirma que el campo de valor
de una celda-plantilla de texto en modo dinámico no cambia. Esta revisión de `tasks.md` solo toca
T8 (reescritura completa) y el sub-bloque `tests` de T9 (consultas de test obsoletas); T1–T7 no
cambian. T7 gana un export mínimo (sin cambio de comportamiento) aplicado dentro de T8 — ver su
"Paso 0". El reordenamiento en sí (arrastre y botones Subir/Bajar) es una capacidad que `design.md`
incorpora en esta revisión sin que conste todavía como criterio de aceptación explícito 1–17 en
`spec.md` — el propio `design.md` lo marca como no bloqueante para planificar y recomienda añadir
dos criterios de aceptación nuevos a `spec.md` en paralelo; no es requisito de esta pasada de
planificación resolverlo, pero debe quedar visible antes de considerar la feature completamente
cerrada (ver nota final del propio `design.md`, sección "Preguntas abiertas").

**Revisión 2 (2026-08-19)**: tras verificar T1–T9 ya implementadas, feedback adicional del usuario:
en modo dinámico, la sección "Columnas" (headers) es redundante con la lista de acordeones
"Columnas-plantilla" (que ya permite renombrar el header de cada ítem). `design.md` D5 se revisó de
nuevo ("Revisión 2") para fusionar ambas superficies en modo dinámico: la sección "Columnas" deja de
renderizarse en ese modo; la lista de acordeones se renombra a "Columnas" y absorbe alta/baja
(botones "Añadir columna"/"Quitar columna" reutilizando `commitAddColumn`/`commitRemoveColumn` sin
cambios de lógica), y sus `aria-label` dejan de decir "columna-plantilla" para decir "columna". Modo
manual no cambia: conserva su sección "Columnas" propia (headers compartidos por varias filas, sin
reordenamiento). Esta revisión solo toca el sub-bloque "Dinámico" de T8 (ver más abajo) y el
sub-bloque `tests` correspondiente; el resto de T8, y T1–T7 y T9 completos, no cambian.

## T1 — Modelo de path: nuevos steps `row`/`cells`

### Objetivo
Añadir a `LayoutPathStep` (`src/runtime/layout-node-path.ts`) las dos variantes que fija D1:
- `{ field: 'row'; rowIndex: number; index: number }` — celda de `table.props.rows[rowIndex][index]`
  (modo manual). `index` es la posición de columna, siempre posicional contra `headers` (nunca un
  `id` de `columns[]`).
- `{ field: 'cells'; index: number }` — celda de plantilla `table.props.rows.cells[index]` (modo
  dinámico).
  
Actualizar en el mismo fichero, de forma simétrica a como ya lo hacen `template`/`tabItem`:
- `getNodeAtPath`: nueva rama por step. Para `row`, requiere `currentNode.type === 'table'` y
  `Array.isArray(currentNode.props.rows)` (modo manual); para `cells`, requiere
  `currentNode.type === 'table'` y `!Array.isArray(currentNode.props.rows)` (modo dinámico). En
  ambos casos, si la celda resuelta (`TableCellValue`, no `TableCellNode`) es un primitivo
  (`string | number | boolean`) la resolución falla igual que un índice fuera de rango — un path no
  se construye nunca apuntando a una celda de texto (`table-layout-node.tsx` solo envuelve con
  selección las celdas que son `TableCellNode`, ver T3), así que esto es una guarda defensiva de
  tipo, no un caso que deba ocurrir en el flujo normal. Añadir un predicado local
  `isTableCellNodeValue(value: TableCellValue): value is TableCellNode` (objeto no-array, mismo
  criterio que el `isTableCellNode` ya existente en `table-layout-node.tsx`; no lo dupliques con
  lógica divergente — puedes definirlo aquí como fuente única y hacer que
  `table-layout-node.tsx` lo importe en T3, o mantenerlo duplicado si el tipo de entrada difiere
  demasiado; decide y sé consistente).
- `serializeLayoutNodePath`: `row.${rowIndex}.${index}` y `cells.${index}`.
- `deserializeLayoutNodePath`: `row` consume 3 tokens (como `tabItem`: valida `rowIndex` e `index`
  como enteros `>= 0`); `cells` consume 2 tokens (como `children`/`template`).
- Exporta un predicado puro nuevo, `pathEndsAtTableCell(path: LayoutNodePath): boolean` — `true`
  cuando `path` no está vacío y su último step es `row` o `cells`. Lo consumen T2 (mutaciones), T4
  (exclusión de arrastre) y T5 (caso especial de "Eliminar nodo"); defínelo una sola vez aquí para
  que ninguno de los tres reimplemente el chequeo de forma divergente.

### Fuera de alcance
- Cualquier cambio en `layout-tree-mutations.ts` (T2).
- Cualquier cambio de render (T3).

### Dependencias
Ninguna. Primera tarea de la feature; bloquea T2–T5.

### Impacto esperado en archivos
- Código: `src/runtime/layout-node-path.ts` (modificado).
- Tests: ver sub-bloque `tests`.
- Documentación: ninguna (detalle interno de implementación, no comportamiento observable de
  producto).

### Tests
**Ficheros de test**: `src/tests/layout-renderer/layout-node-renderer-edit-mode.test.tsx`
(ampliación — ya cubre el modelo de path general, `getNodeAtPath`/`serializeLayoutNodePath`).

**Comportamiento cubierto**:
- `getNodeAtPath` resuelve una celda-nodo en modo manual (`row`) y en modo dinámico (`cells`),
  incluida una celda anidada dentro de un `container` de celda vía un step `children` posterior.
- `getNodeAtPath` devuelve `null` para: `rowIndex`/`index` fuera de rango, un step `row` contra una
  tabla en modo dinámico (o viceversa `cells` contra modo manual), un step `row`/`cells` contra un
  nodo que no es `table`, y un step `row`/`cells` que resuelve a una celda primitiva (string).
- `serializeLayoutNodePath`/`deserializeLayoutNodePath` hacen round-trip exacto para paths que
  incluyen `row` y `cells`, incluidos paths con un step `children` posterior (celda-contenedor con
  hijos).
- `deserializeLayoutNodePath` devuelve `null` para tokens malformados de `row` (`rowIndex`/`index`
  no enteros, negativos, o token ausente) y de `cells` (`index` no entero, negativo, o token
  ausente).
- `pathEndsAtTableCell` devuelve `true` solo cuando el último step es `row` o `cells`, `false` para
  cualquier otro último step (incluido un `children` posterior a un `row`/`cells`) y para el path
  vacío.

**Comandos durante la implementación**:
```
pnpm test --run src/tests/layout-renderer/layout-node-renderer-edit-mode.test.tsx
```

**Restricciones**: no toques `layout-tree-mutations.ts` en esta tarea aunque compile con errores de
tipo al referenciar los nuevos steps desde otros ficheros — eso es T2.

### Criterios de finalización
`getNodeAtPath`, `serializeLayoutNodePath`, `deserializeLayoutNodePath` y `pathEndsAtTableCell`
soportan `row`/`cells` con la misma robustez que `template`/`tabItem`; tests en verde.

### Cierre de implementación
Código y tests de esta tarea completos y validados.

---

## T2 — Mutaciones de árbol por path: soporte de `row`/`cells`

### Objetivo
Extender `src/dev-runtime/layout-tree-mutations.ts` para que `replaceNodeAt`, `removeNodeAt`,
`insertNodeAt`, `movePathTo` y `findNodePath` resuelvan y reconstruyan correctamente un path que
contiene un step `row` o `cells`, en cualquier posición (terminal o intermedio, seguido de
`children`).

- `resolvePathFrames`: nueva rama por step, simétrica a `template`/`tabItem`.
  - `row`: requiere `currentNode.type === 'table'` y `Array.isArray(currentNode.props.rows)`;
    lanza si no. La "colección" del frame es la fila `currentNode.props.rows[step.rowIndex]`
    (`TableCellValue[]`, no `LayoutNode[]`: mezcla primitivos y nodos). Como el resto de este
    fichero tipa `ResolvedPathFrame.collection` como `readonly LayoutNode[]`, usa un cast local
    (`as unknown as LayoutNode[]` al empujar el frame, revertido con
    `as unknown as TableCellValue[]` en el `setNodeCollection` correspondiente) — mismo patrón de
    cast estructural que `withTemplate`/`getChildNodesCollection` ya usan en este fichero para
    casos análogos. No generalices el tipo de `ResolvedPathFrame` para este único caso.
    `parentNode` del frame es el propio nodo `table`. La celda candidata
    (`row[step.index]`) debe ser un `TableCellNode` (usa el mismo predicado de T1 o uno local
    equivalente); si no lo es, lanza.
  - `cells`: requiere `currentNode.type === 'table'` y `!Array.isArray(currentNode.props.rows)`
    (modo dinámico); lanza si no. La colección del frame es `currentNode.props.rows.cells`, mismo
    cast que arriba. `parentNode` es el propio `table`.
- `setNodeCollection`: despacha a dos nuevas funciones privadas, mismo patrón que
  `withTemplate`/`withTabItemChildren`:
  - `withTableRow(node, rowIndex, row)`: exige `node.type === 'table'` y modo manual; devuelve el
    nodo con `props.rows[rowIndex]` reemplazada (resto de filas intactas, no mutar el array
    original).
  - `withTableDynamicCells(node, cells)`: exige `node.type === 'table'` y modo dinámico; devuelve
    el nodo con `props.rows.cells` reemplazada, preservando `props.rows.source`.
- `stepsEqual`: dos steps `row` son iguales solo si coinciden `field`, `index` y `rowIndex`; dos
  steps `cells` son iguales si coinciden `field` e `index` (igual que `children`/`template` hoy).
- `stepsReferenceSameCollection`: dos steps `row` referencian la misma colección (misma fila) solo
  si coincide `rowIndex` (con independencia de `index` — mismo criterio que `tabItem` con
  `itemIndex`); dos steps `cells` siempre referencian la misma colección entre sí (mismo criterio
  que `children`/`template`, sin disambiguador adicional).
- `findPathWithinNode`: nueva rama para `node.type === 'table'`. En modo manual, recorre
  `node.props.rows` fila a fila y, dentro de cada fila, celda a celda por posición, comparando por
  identidad de objeto contra `target` solo las celdas que son `TableCellNode` (una celda primitiva
  nunca puede ser `target`, ya que `target` siempre es un `LayoutNode`); usa
  `findPathWithinChildren` con `stepForChild = (index) => ({ field: 'row', rowIndex, index })` por
  cada fila. En modo dinámico, recorre `node.props.rows.cells` una vez con
  `stepForChild = (index) => ({ field: 'cells', index })`. Necesario para que `movePathTo`
  (`findNodePath` tras un `movePathTo` que involucra un nodo seleccionado anidado dentro de una
  celda-`container`) siga re-resolviendo la selección correctamente.
- `insertIntoParentNode`/`isSameOrDescendantPath`: no requieren rama nueva — heredan corrección de
  `stepsEqual`/`getNodeAtPath` (T1) sin cambios propios, ya que la inserción dentro de una
  celda-`container` siempre apunta a su colección `children`, no a la colección `row`/`cells` en sí
  (D3: la celda nunca es destino de inserción directa). No añadas ninguna rama a
  `insertIntoParentNode` para `row`/`cells` — confírmalo con un test que documente que intentarlo
  lanza el mismo error genérico "does not accept children" que ya lanza para cualquier otro tipo no
  contenedor.

### Fuera de alcance
- Cualquier cambio de render o de wiring de arrastre/borrado (T3, T4, T5).
- Cualquier exclusión de `row`/`cells` como origen o destino de arrastre — eso vive en la capa de
  render/drag (T4), no en las funciones puras de este fichero.

### Dependencias
T1.

### Impacto esperado en archivos
- Código: `src/dev-runtime/layout-tree-mutations.ts` (modificado).
- Tests: ver sub-bloque `tests`.
- Documentación: ninguna.

### Tests
**Ficheros de test**: `src/tests/dev-runtime/layout-tree-mutations.test.ts` (ampliación).

**Comportamiento cubierto**:
- `replaceNodeAt` sobre un path terminado en `row`/`cells` sustituye exactamente esa celda,
  preservando el resto de `headers`/`rows`/`columns` sin mutar el array/objeto original.
- `replaceNodeAt` sobre un path que atraviesa `row`/`cells` y termina en un step `children` (nodo
  anidado dentro de una celda-`container`) reconstruye correctamente toda la cadena de frames hasta
  la raíz.
- `removeNodeAt` sobre un path que termina en un step `children` dentro de una celda-`container`
  elimina solo ese descendiente, sin afectar a la posición de la celda en su fila/plantilla.
- `insertNodeAt` con `parentPath` terminado en `row`/`cells` (insertar un hijo dentro de una
  celda-`container`) inserta correctamente en la colección `children` de esa celda.
- `movePathTo` reordena/reanida correctamente un nodo anidado dentro de una celda-`container` (por
  ejemplo, mover un `heading` de una posición a otra dentro de los hijos de la misma celda), y
  `findNodePath` re-resuelve su nuevo path (incluido el prefijo `row`/`cells` intacto) tras el
  commit — mismo patrón ya cubierto para nodos dentro de `repeater.props.template`.
- `stepsEqual` distingue dos steps `row` con distinto `rowIndex` aunque compartan `index`, y trata
  como iguales dos steps `cells` con el mismo `index`.
- `stepsReferenceSameCollection` distingue dos steps `row` de distinto `rowIndex` (colecciones
  distintas) de dos steps `row` del mismo `rowIndex` (misma colección), y trata cualesquiera dos
  steps `cells` como la misma colección.
- Un intento de `insertNodeAt`/`removeNodeAt` cuyo path (terminal, no intermedio) es directamente un
  step `row`/`cells` como `parentPath` para insertar un hijo (no como paso previo a un `children`)
  lanza el mismo error genérico que ya lanza para cualquier nodo sin colección de hijos propia — sin
  rama especial añadida para este caso.

**Comandos durante la implementación**:
```
pnpm test --run src/tests/dev-runtime/layout-tree-mutations.test.ts
```

**Restricciones**: no cambies la firma pública de `replaceNodeAt`/`removeNodeAt`/`insertNodeAt`/
`movePathTo`/`findNodePath`. Los casts locales descritos arriba deben quedar contenidos dentro de
`resolvePathFrames`/`setNodeCollection`/`withTableRow`/`withTableDynamicCells`, sin filtrar el tipo
`TableCellValue` a las firmas genéricas existentes (`ResolvedPathFrame`, `rebuildFromFrames`).

### Criterios de finalización
Las cinco funciones de mutación/búsqueda por path soportan `row`/`cells` con la misma robustez que
`template`/`tabItem`; tests en verde.

### Cierre de implementación
Código y tests de esta tarea completos y validados.

---

## T3 — Propagación de path en `table` y placeholder de contenedor vacío en celda

### Objetivo
Conectar el modelo de path (T1/T2) desde `table` hasta cada celda y sus descendientes, y reutilizar
el mecanismo ya existente de placeholder de contenedor vacío para una celda-`container` sin hijos.

1. **`src/runtime/layout-node-renderer.tsx`**: en `case 'table':`, pasa `path={path}` a `TableNode`
   (hoy no se pasa nada).
2. **`src/runtime/layout-renderer.tsx`**: exporta las tres piezas hoy privadas que
   `table-layout-node.tsx` necesita reutilizar sin duplicar lógica: la función `hasChildren`, la
   función `isEmptyPlaceholderCandidate` y el componente `EmptyContainerPlaceholder` (con su interfaz
   `EmptyContainerPlaceholderProps`). No cambies su comportamiento, solo su visibilidad
   (`export function` / `export interface`).
3. **`src/runtime/nodes/table-layout-node.tsx`**:
   - `TableNodeProps` gana `path?: LayoutNodePath` (import desde `../layout-node-path`); dentro del
     componente, `const basePath = path ?? []`.
   - Importa `useLayoutEditModeContext` desde `../use-layout-edit-mode-context` y calcula
     `const activeEditModeContext = editModeContext !== null && editModeContext.active ? editModeContext : null`
     (mismo patrón que `layout-renderer.tsx`).
   - Importa `hasChildren`, `isEmptyPlaceholderCandidate`, `EmptyContainerPlaceholder` desde
     `../layout-renderer` (ahora exportados en el paso 2).
   - **Rastreo del índice de fila original**: `resolveTableRows` debe devolver, además de
     `rowItemMap`, un nuevo `rowOriginalIndexMap: Map<TableVisibleRow, number>` que asocia cada fila
     (por identidad de objeto) con su índice real en `node.props.rows` (modo manual) o en la
     iteración de `items` (modo dinámico) — poblado en el mismo bucle que ya construye cada `row`,
     antes de que pase por `processTableRows`/paginación. Esto es necesario porque `filterTableRows`/
     `sortTableRows`/la paginación preservan la identidad de objeto de cada fila pero reordenan o
     descartan posiciones, así que el índice de renderizado final (`visibleRows.map((row, i) => ...)`)
     ya NO coincide con la posición real en `props.rows` una vez hay un filtro activo, un orden
     distinto del original, o paginación. El path de una celda debe direccionar siempre la posición
     real en `props.rows`, nunca la posición visual tras procesar. **No cambies** el uso existente
     del índice de renderizado para `rowIterationContext.key`/`itemIndex` (eso sigue igual, es un
     contrato distinto y ya correcto).
   - `const isManualTableMode = Array.isArray(node.props.rows)`.
   - En el `<td>` de cada celda: computa
     `const cellPath = isManualTableMode ? [...basePath, { field: 'row', rowIndex: rowOriginalIndexMap.get(row)!, index: cellIndex }] : [...basePath, { field: 'cells', index: cellIndex }]`
     y pásalo como `path={cellPath}` a `LayoutNodeRenderer`.
   - Sustituye el cálculo actual de `renderedChildren` (`cell.type === 'container' && cell.children...`)
     por, cuando `isTableCellNode(cell)` y `hasChildren(cell)` (cubre `container` y, tras T6, `link`
     en modo "Elementos anidados"):
     `activeEditModeContext !== null && isEmptyPlaceholderCandidate(cell) ? <EmptyContainerPlaceholder nodeType={cell.type} path={cellPath} editModeContext={activeEditModeContext} /> : <LayoutRenderer nodes={cell.children ?? []} iterationContext={rowIterationContext} path={cellPath} />`;
     `undefined` cuando `!hasChildren(cell)`. Esto reutiliza exactamente el mismo mecanismo ya
     vigente para `container`/`form`/`link` en el árbol principal — sin lógica de placeholder nueva.

### Fuera de alcance
- Exclusión de la celda como fuente de arrastre (T4).
- Caso especial de "Eliminar nodo" sobre una celda (T5).
- Cualquier cambio en `props.pagination`/filtros/ordenación más allá de exponer el índice original
  de fila necesario para el path.

### Dependencias
T1, T2.

### Impacto esperado en archivos
- Código: `src/runtime/layout-node-renderer.tsx`, `src/runtime/layout-renderer.tsx`,
  `src/runtime/nodes/table-layout-node.tsx` (modificados).
- Tests: ver sub-bloque `tests`.
- Documentación: `ai-workflow/docs/app-features/development/dev-mode-editor.md` (nueva superficie
  seleccionable en modo Editor), `ai-workflow/docs/app-features/nodes/table.md` (si el criterio de
  documentación decide reflejar aquí el path de celda — a valorar en la pasada documental).

### Tests
**Ficheros de test**:
- `src/tests/layout-renderer/layout-renderer-table-edit-mode.test.tsx` (nuevo, mismo patrón que
  `layout-renderer-repeater-edit-mode.test.tsx`/`layout-renderer-accordion-edit-mode.test.tsx`).
- `src/tests/layout-renderer/layout-renderer-table-rich-cells.test.tsx` (regresión, sin modificar —
  se re-ejecuta tal cual para confirmar que el render de celdas ricas fuera de modo Editor no
  cambia; no añadas casos nuevos aquí, los casos de modo Editor van en el fichero nuevo de arriba).
- `src/tests/layout-renderer/layout-renderer-table-pagination.test.tsx` (regresión, sin modificar —
  mismo criterio: confirma que la paginación local no cambia de comportamiento fuera de modo
  Editor).

**Comportamiento cubierto**:
- Click en modo Editor sobre una celda-nodo (`button`, `image`, `container`) en modo manual y en
  modo dinámico selecciona únicamente esa celda (`data-node-path` con el step `row`/`cells`
  correcto); el hover resalta solo esa celda, sin afectar a otras celdas de la misma tabla ni de
  otra tabla de la misma página (dos `table` en la misma página, verificar que el path de cada una
  es distinto y no colisiona — regresión directa del bug que motiva esta feature).
- Un `container` anidado dentro de una celda-nodo permite seleccionar a sus hijos a cualquier
  profundidad (path con steps `children` apilados sobre el step `row`/`cells`).
- Una celda-`container` sin hijos en modo Editor muestra el placeholder `EmptyContainerPlaceholder`
  (mismo texto/atributos que un `container` vacío en el árbol principal), es seleccionable, y acepta
  insertar el primer hijo desde la paleta; fuera de modo Editor esa misma celda no renderiza el
  placeholder (produce el mismo árbol que antes de esta tarea — regresión byte a byte).
- **Índice de fila original tras filtrar/ordenar/paginar** (caso crítico de esta tarea): con una
  tabla `sortable`/`filterable` y varias filas, aplicar un filtro que oculta la primera fila y/o
  cambiar el orden a descendente, y verificar que el `path` resuelto al hacer click sobre una celda
  de la fila visible resultante direcciona la fila correcta de `node.props.rows` (comprobar
  editando esa celda vía `onCommitNodeUpdate` y verificando que la mutación cae sobre el índice
  correcto de `props.rows`, no sobre la posición visual). Repetir con paginación activa
  (`pagination.pageSize`) seleccionando una celda de la segunda página.
- Un `container` ya existente dentro de una celda-nodo acepta insertar nodos nuevos desde la paleta
  flotante y reordenar sus hijos existentes (drag end-to-end, mismo patrón que
  `layout-canvas-reorder-reinsert.test.tsx`/`layout-canvas-palette-insert.test.tsx`), con las mismas
  reglas de destino de drop que cualquier otro `container` del `layout`.
- Regresión: fuera de modo Editor, el árbol renderizado por `table` con celdas-nodo (incluida una
  celda-`container` con hijos, y una vacía) es idéntico al de antes de esta tarea.

**Comandos durante la implementación**:
```
pnpm test --run src/tests/layout-renderer/layout-renderer-table-edit-mode.test.tsx
pnpm test --run src/tests/layout-renderer/layout-renderer-table-rich-cells.test.tsx
pnpm test --run src/tests/layout-renderer/layout-renderer-table-pagination.test.tsx
```

**Restricciones**: usa el mismo harness/mocks de `@dnd-kit/core` ya establecido en
`layout-canvas-reorder-reinsert.test.tsx`/`layout-canvas-palette-insert.test.tsx` para los casos de
arrastre; no introduzcas un mock paralelo.

### Criterios de finalización
Selección, hover, breadcrumb (heredado del modelo de path genérico) y arrastre de hijos de celda
funcionan en modo manual y dinámico, con el índice de fila correcto bajo filtro/orden/paginación;
sin regresión en producción; tests en verde.

### Cierre de implementación
Código y tests de esta tarea completos y validados.

---

## T4 — Exclusión de la celda como fuente de arrastre (D3)

### Objetivo
En `src/runtime/layout-node-renderer.tsx`, el `useDraggable` que hace arrastrable cualquier nodo
seleccionable debe quedar deshabilitado cuando el `path` del nodo termina en un step `row`/`cells`
(usa `pathEndsAtTableCell` de T1), además de la condición ya existente
(`editModeContext === null || !editModeContext.active`). El `id` (`serializedPath`) se sigue
calculando igual — solo cambia `disabled`. Esto no afecta a los hijos de una celda-`container`
(su propio path termina en `children`, no en `row`/`cells`, así que siguen siendo arrastrables con
normalidad).

### Fuera de alcance
- Cualquier cambio en `layout-drop-validity.ts` — no es necesario: `table` ya no está en
  `nodeTypeAcceptsChildren` (`layout-placement-rules.ts`), así que ninguna zona de inserción se
  genera nunca para reordenar celdas de `table` entre sí. Verifícalo con un test, no lo
  "arregles" añadiendo código que ya sería redundante.

### Dependencias
T3 (la celda ya tiene un path real que hace relevante este chequeo).

### Impacto esperado en archivos
- Código: `src/runtime/layout-node-renderer.tsx` (modificado).
- Tests: ver sub-bloque `tests`.
- Documentación: `ai-workflow/docs/app-features/development/dev-mode-editor.md` (regla de arrastre
  nueva, sección de reglas de destino/origen de drop).

### Tests
**Ficheros de test**: `src/tests/dev-runtime/layout-canvas-dnd-wiring.test.tsx` (ampliación).

**Comportamiento cubierto**:
- Una celda-nodo (path terminado en `row` o en `cells`) tiene `useDraggable` deshabilitado en modo
  Editor: no se le puede iniciar un arrastre (verificar el argumento `disabled` pasado a
  `useDraggable`, mismo patrón de mock ya usado en este fichero para inspeccionar los argumentos de
  `useDraggable`/`useDroppable`).
- Un hijo de una celda-`container` (path con un step `children` tras el step `row`/`cells`) sigue
  siendo arrastrable con normalidad en modo Editor.
- Arrastrar un tipo de nodo desde la paleta flotante directamente sobre una celda en modo "Texto"
  (una celda primitiva, sin wrapper de selección/arrastre en absoluto) no produce ningún cambio en
  el config — confirma que no existe ninguna zona `data-drop-zone` para la posición de una celda de
  `table` (ni de texto ni de nodo), a diferencia de un `container` con la misma cantidad de hijos.

**Comandos durante la implementación**:
```
pnpm test --run src/tests/dev-runtime/layout-canvas-dnd-wiring.test.tsx
```

**Restricciones**: ninguna.

### Criterios de finalización
Una celda-nodo nunca es fuente de arrastre; sus hijos (si es un `container`) siguen siéndolo; tests
en verde.

### Cierre de implementación
Código y tests de esta tarea completos y validados.

---

## T5 — "Eliminar nodo" especial sobre una celda (D6)

### Nota de replanificación (desbloqueo)
Esta tarea estuvo bloqueada: el plan original asumía el mismo literal `''` (texto vacío) para
revertir cualquier celda, en modo manual y en modo dinámico. `validateTableDynamicRows`
(`src/config/validate-table-node.ts:448`, vía `isNonEmptyString`) exige que una celda-texto de
`table.props.rows.cells` (modo dinámico) sea una cadena no vacía tras `trim()` — `''` se rechaza, y
hay un test pinneado que fija ese contrato como comportamiento actual
(`runtime-config-validation-image-table.test.ts:1277`, "regression: current contract"). El requisito
no funcional de la spec restringe el único cambio de validación permitido a la ampliación del
catálogo de celda con `link` (T6) — así que no se toca esa validación para acomodar `''`. En su
lugar, el "texto vacío" por defecto usa **dos literales distintos según el modo**, ambos ya válidos
contra la validación existente sin tocarla:
- Modo manual (step `row`): `''` — sigue siendo válido (`validateTableManualRows` no exige no-vacío).
- Modo dinámico (step `cells`): `'—'` (guion largo, U+2014) — no vacío tras `trim()`, pasa
  `isNonEmptyString`, y es un marcador visualmente neutro de "celda vacía" (convención habitual en
  tablas de datos), sin overlap semántico con contenido real.

Ambos literales se definen una sola vez como constantes exportadas en
`src/dev-runtime/layout-canvas/layout-canvas-node-palette-defaults.ts` (mismo fichero que ya centraliza
los valores por defecto de la paleta de nodos): `EMPTY_TABLE_CELL_TEXT_VALUE = ''` y
`EMPTY_DYNAMIC_TABLE_CELL_TEXT_VALUE = '—'`. T7 y T8 deben importarlas de ahí — no las redefinas ni
las repitas como literales sueltos en otro fichero.

Como `row` solo existe en modo manual y `cells` solo en modo dinámico (T1/T2), el propio tipo del
último step del path ya discrimina el modo sin necesidad de inspeccionar `node.props.rows`.

### Objetivo
En `src/dev-runtime/layout-canvas/layout-canvas-node-palette-defaults.ts`, añade las dos constantes
exportadas descritas arriba.

En `src/dev-runtime/floating-toolbar/dev-editor-layer.tsx`, `handleDeleteSelectedNode` debe
bifurcar según `pathEndsAtTableCell(selectedPath)` (T1):
- Si es `true`: sea `lastStep = selectedPath[selectedPath.length - 1]`. En vez de
  `onCommitCanvasMutation((pageLayout) => removeNodeAt(pageLayout, selectedPath))`, aplica
  `onCommitCanvasMutation((pageLayout) => replaceNodeAt(pageLayout, selectedPath, () => lastStep.field === 'row' ? EMPTY_TABLE_CELL_TEXT_VALUE : EMPTY_DYNAMIC_TABLE_CELL_TEXT_VALUE))`
  — revierte la celda al texto vacío del literal correspondiente a su modo. La posición y la
  longitud del array de la fila (o de `cells`) no cambian.
- Si es `false`: comportamiento actual sin cambios (`removeNodeAt`).
En ambos casos, tras un commit `applied`, limpia la selección igual que hoy.

### Fuera de alcance
- El resto de puntos donde T8 debe reutilizar estas mismas constantes (alta de fila/columna, cambio
  de modo) — se especifica en T8, no aquí; esta tarea solo define las constantes y las consume desde
  "Eliminar nodo".

### Dependencias
T2, T3.

### Impacto esperado en archivos
- Código: `src/dev-runtime/layout-canvas/layout-canvas-node-palette-defaults.ts` (modificado — nuevas
  constantes), `src/dev-runtime/floating-toolbar/dev-editor-layer.tsx` (modificado).
- Tests: ver sub-bloque `tests`.
- Documentación: `ai-workflow/docs/app-features/development/dev-mode-editor.md` (sección "Eliminar
  nodo (modo Editor)": caso especial de celda de tabla, incluida la distinción de literal por modo).

### Tests
**Ficheros de test**: `src/tests/dev-runtime/layout-canvas-delete-node.test.tsx` (ampliación).

**Comportamiento cubierto**:
- "Eliminar nodo" sobre una celda-nodo seleccionada en modo manual la convierte en `''` en la misma
  posición, sin cambiar la longitud de la fila ni la de `headers`/`rows`, y limpia la selección.
- "Eliminar nodo" sobre una celda-nodo seleccionada en modo dinámico la convierte en `'—'` en la
  misma posición de `cells`, sin cambiar su longitud, y limpia la selección — y el commit resultante
  pasa `validateRuntimeConfig` (regresión directa del bloqueo: antes de este fix, este mismo caso
  producía un commit rechazado).
- "Eliminar nodo" sobre una celda-`container` con subárbol (varios hijos), en ambos modos, la
  revierte igualmente a su literal de texto vacío correspondiente de una sola vez (todo el subárbol
  desaparece con ella), sin aviso de confirmación adicional distinto del ya existente.
- Regresión: "Eliminar nodo" sobre cualquier otro nodo del `layout` (no una celda de tabla) sigue
  usando `removeNodeAt` sin cambios de comportamiento.

**Comandos durante la implementación**:
```
pnpm test --run src/tests/dev-runtime/layout-canvas-delete-node.test.tsx
```

**Restricciones**: no modifiques `validate-table-node.ts` ni el test pinneado
`runtime-config-validation-image-table.test.ts:1277` — el contrato de validación existente no cambia
en esta tarea.

### Criterios de finalización
Borrar una celda-nodo la revierte al literal de texto vacío correcto según su modo (manual `''`,
dinámico `'—'`), siempre con un commit aceptado por `validateRuntimeConfig`; borrar cualquier otro
nodo sigue eliminándolo del árbol; tests en verde.

### Cierre de implementación
Código y tests de esta tarea completos y validados.

---

## T6 — Validación: `link` en el catálogo de celda de tabla (D7)

### Objetivo
- `src/config/runtime-config-zod.ts`: añade `'link'` a `tableCellAllowedNodeTypes` (única fuente,
  ya consumida por `validate-table-node.ts` en `validateTableCellNode`/`checkContainerChildrenSubset`
  y reutilizable directamente por el widget de T7/T8/T9 sin catálogo paralelo).
- `src/config/runtime-config-types.ts`: añade `LinkLayoutNode` a la unión `TableCellNode` (hoy
  `ImageLayoutNode | ListLayoutNode | ButtonLayoutNode | ContainerLayoutNode | HeadingLayoutNode | ParagraphLayoutNode`).
- No se requiere ningún otro cambio en `src/config/` ni en `src/runtime/`: `validateTableCellNode`
  ya delega en `validateLayoutNode` para el contrato completo del `link` (idéntico al de un `link`
  fuera de tabla), y el render de una celda `link` reutiliza sin cambios el mecanismo genérico de
  `LayoutNodeRenderer`/`hasChildren`/`EmptyContainerPlaceholder` ya conectado en T3 (un `link`-celda
  en modo "Elementos anidados" obtiene el mismo placeholder de contenedor vacío que un `container`,
  sin código adicional).

### Fuera de alcance
- Ampliar el catálogo con cualquier otro tipo (`badge`, `alert`, `stat`, `divider`, `skeleton`).
- El selector de tipo del widget (T7).

### Dependencias
Ninguna respecto a T1–T5 (cambio aislado en `src/config/`); se sitúa aquí por orden de plan, no por
necesidad técnica. Bloquea T7 (necesita el catálogo con `link` ya incluido) y T8/T9 (necesitan
`buildDefaultNodeInstance('link')` como valor de tipo `TableCellNode` válido).

### Impacto esperado en archivos
- Código: `src/config/runtime-config-zod.ts`, `src/config/runtime-config-types.ts` (modificados).
- Tests: ver sub-bloque `tests`.
- Documentación: `ai-workflow/docs/app-features/nodes/table.md` (catálogo de celda ampliado con
  `link`), `ai-workflow/docs/app-features/nodes/link.md` (si procede referenciar la nueva superficie
  como celda de tabla).

### Tests
**Ficheros de test**: `src/tests/config-validation/runtime-config-validation-image-table.test.ts`
(ampliación).

**Comportamiento cubierto**:
- Un `table` con una celda `link` (modo manual y modo dinámico) válida (mismo contrato que fuera de
  tabla: `props.href`/`props.action`, `props.label`/`children`) se acepta.
- Un `link`-celda inválido (por ejemplo, con `props.label` y `children` simultáneos, o sin ninguno
  de los dos) se rechaza con el mismo diagnóstico que ya usa `validateLayoutNode` para `link` fuera
  de tabla.
- Un `link`-celda dentro de un `container`-celda anidado (recursión de `checkContainerChildrenSubset`)
  se acepta.
- Regresión: los tipos ya prohibidos como celda (`modal`, `form`, `input`, `repeater`, `table`, y
  cualquier otro fuera del catálogo) se siguen rechazando exactamente igual que antes.

**Comandos durante la implementación**:
```
pnpm test --run src/tests/config-validation/runtime-config-validation-image-table.test.ts
```

**Restricciones**: ninguna.

### Criterios de finalización
`link` es un tipo de celda válido en validación, con el mismo contrato que fuera de tabla, sin
afectar al resto del catálogo; tests en verde.

### Cierre de implementación
Código y tests de esta tarea completos y validados.

---

## T7 — Selector de tipo de celda (widget puro, aislado)

### Objetivo
Nuevo componente `TableCellTypePropertyField` en
`src/dev-runtime/layout-canvas/property-fields/table-cell-type-property-field.tsx`, siguiendo el
patrón visual/de interacción del selector de variante de acción (dropdown, no segmented — el
catálogo tiene 8 opciones, por encima del rango 2–5 de `SegmentedTogglePropertyField`) descrito en
design.md D5. No forma parte de `WIDGET_REGISTRY` (no se engancha vía `x-widget`): es un componente
consumido directamente por T8, igual que `EnumPropertyField`/`SegmentedTogglePropertyField` se
consumen directamente en otros widgets dedicados de este mismo directorio.

- Catálogo de opciones: `'text'` ("Texto") más `tableCellAllowedNodeTypes` (import directo desde
  `../../../config/runtime-config-zod`, ya con `'link'` incluido tras T6) — un único catálogo
  fuente, sin lista paralela.
- Etiquetas en español por tipo: `image` → "Imagen", `list` → "Lista", `button` → "Botón",
  `container` → "Contenedor", `heading` → "Título", `paragraph` → "Párrafo", `link` → "Enlace";
  `'text'` → "Texto". Mismo patrón de tabla de etiquetas que `VARIANT_LABELS` en
  `discriminated-union-property-field.tsx`.
- Props: `{ label: string; value: TableCellValue; emptyTextValue: string; onChange: (value: TableCellValue) => void }`.
  `emptyTextValue` es el literal que se commitea al elegir "Texto" — el componente no conoce el modo
  de la tabla (manual/dinámico) ni por tanto qué literal es válido en cada caso (T5: `''` en modo
  manual, `'—'` en modo dinámico — ver `EMPTY_TABLE_CELL_TEXT_VALUE`/
  `EMPTY_DYNAMIC_TABLE_CELL_TEXT_VALUE` en `layout-canvas-node-palette-defaults.ts`), así que quien lo
  monta (T8) se lo pasa explícitamente según el contexto de cada celda. No definas aquí un literal
  `''` hardcodeado ni una constante propia — este componente es agnóstico del modo.
- Detección del tipo activo: `typeof value !== 'object' ? 'text' : value.type` (una celda primitiva
  siempre es "Texto"; una celda-nodo usa su propio `type`).
- Al elegir "Texto" desde cualquier otro tipo: `onChange(emptyTextValue)`.
- Al elegir un tipo de nodo (desde "Texto" o desde otro tipo de nodo distinto): `onChange(buildDefaultNodeInstance(type))`,
  importado desde `../layout-canvas-node-palette-defaults` — reutiliza los valores por defecto
  mínimos ya definidos para la paleta de nodos, sin una segunda tabla de defaults. Reconstruye desde
  cero: ningún campo del tipo anterior sobrevive al cambio (mismo criterio que el selector de
  variante de acción).
- Reelegir el tipo ya activo es un no-op (no invoca `onChange`), mismo criterio de idempotencia que
  el resto de selectores del panel.
- Mientras el tipo activo es "Texto", el propio componente expone además, debajo del selector, un
  campo de texto libre (`TextPropertyField`, mismo patrón que el resto de strings del panel) que
  edita directamente el valor literal de la celda (`onChange(nextText)`); ausente para cualquier
  otro tipo (la edición de un tipo de nodo ocurre seleccionándolo en el canvas, T3 — no aquí, per
  spec sección 2).

### Fuera de alcance
- Wiring en el panel de propiedades (T9).
- La estructura de filas/columnas que contiene a este selector (T8).

### Dependencias
T5 (constantes `EMPTY_TABLE_CELL_TEXT_VALUE`/`EMPTY_DYNAMIC_TABLE_CELL_TEXT_VALUE`, usadas por los
tests de esta tarea), T6.

### Impacto esperado en archivos
- Código: `src/dev-runtime/layout-canvas/property-fields/table-cell-type-property-field.tsx`
  (nuevo).
- Tests: ver sub-bloque `tests`.
- Documentación: `ai-workflow/docs/app-features/development/dev-mode-editor.md` (nuevo widget,
  sección del editor visual del layout — a completar en la pasada documental junto con T8/T9).

### Tests
**Ficheros de test**:
`src/tests/dev-runtime/layout-canvas-property-field-table-cell-type.test.tsx` (nuevo, mismo criterio
de aislamiento que `layout-canvas-property-field-container-columns-mode.test.tsx`: sin dispatcher ni
pipeline real).

**Comportamiento cubierto**:
- Detección del tipo activo desde una celda de texto (`''`, `'hola'`, `42`, `true`) → "Texto"; desde
  cada uno de los 7 tipos de nodo permitidos → su propio tipo.
- El dropdown lista exactamente 8 opciones ("Texto" + los 7 tipos) en un orden estable, con las
  etiquetas en español fijadas arriba.
- Elegir un tipo de nodo distinto del activo invoca `onChange` con el resultado exacto de
  `buildDefaultNodeInstance(type)` para cada uno de los 7 tipos (`it.each`).
- Elegir "Texto" desde un tipo de nodo invoca `onChange(emptyTextValue)` con el valor exacto de la
  prop recibida — verificar tanto con `emptyTextValue=''` como con `emptyTextValue='—'` (`it.each`),
  confirmando que el componente nunca hardcodea su propio literal.
- Reelegir el tipo ya activo no invoca `onChange` (idempotencia), tanto desde "Texto" como desde un
  tipo de nodo.
- Con el tipo activo "Texto", el campo de texto libre está visible y su edición invoca `onChange`
  con el nuevo literal; con cualquier otro tipo activo, el campo de texto libre no se renderiza.

**Comandos durante la implementación**:
```
pnpm test --run src/tests/dev-runtime/layout-canvas-property-field-table-cell-type.test.tsx
```

**Restricciones**: no montes `PropertyFieldDispatcher` ni ningún pipeline de commit en este fichero
— es un test de componente aislado, mismo criterio que el resto de `layout-canvas-property-field-*`.
Importa `EMPTY_TABLE_CELL_TEXT_VALUE`/`EMPTY_DYNAMIC_TABLE_CELL_TEXT_VALUE` desde
`layout-canvas-node-palette-defaults.ts` para el caso `it.each` de arriba en vez de escribir `''`/`'—'`
como literales sueltos en el test.

### Criterios de finalización
El selector cubre las 8 opciones con reconstrucción desde cero y edición de texto literal
condicionada; tests en verde.

### Cierre de implementación
Código y tests de esta tarea completos y validados.

---

## T8 — Widget de filas/columnas/celdas (secciones apiladas con acordeones, D5 revisado)

### Nota de revisión de diseño (D5, D8)
Esta tarea ya se implementó una vez con la disposición `role="grid"` original de `design.md` D5. El
usuario validó el resultado contra el ancho real del panel de propiedades (~370px) y lo consideró
inmanejable; `design.md` revisó D5 para sustituir la cuadrícula por secciones apiladas con
acordeones y reordenamiento (arrastre + botones "Subir"/"Bajar"). Esta tarea **sustituye por
completo** la implementación anterior de `TableRowsPropertyField` y su fichero de test — no es una
ampliación incremental sobre la disposición `role="grid"` existente, es una reescritura de la
estructura interna del componente. `TableCellTypePropertyField` (T7) no cambia de comportamiento,
salvo el Paso 0 de abajo (export adicional, sin lógica nueva). D8 no introduce ningún cambio de
implementación: confirma que el campo de valor de una celda-plantilla de texto en modo dinámico
sigue siendo el campo libre que T7 ya expone, sin control compuesto nuevo.

### Objetivo
Nuevo componente `TableRowsPropertyField` en
`src/dev-runtime/layout-canvas/property-fields/table-rows-property-field.tsx`. Escribe y recibe el
**nodo `table` completo** (mismo alcance de escritura que `ContainerColumnsModePropertyField`/
`LinkContentModePropertyField`, D4), no un `props` parcial: `{ label: string; node: TableLayoutNode; onChange: (node: TableLayoutNode) => void }`
— firma sin cambios respecto a la versión anterior (T9 no necesita tocar su wiring).

Disposición de secciones apiladas verticalmente (D5, revisión post-implementación), sin caja con
borde ni fondo agrupando el widget o sus secciones (spec sección 6/criterio 16), cabeceras de texto
simple en mayúsculas pequeñas y grises. El elemento raíz sigue siendo un `<fieldset>` con
`<legend>{label}</legend>` (igual que la versión anterior) — su `role` implícito `group` con nombre
accesible tomado de la `legend` es ahora el punto de consulta de los tests de integración (T9),
sustituyendo a la consulta anterior por `role="grid"`.

Valores de celda de texto vacío por defecto en toda esta tarea: importa `EMPTY_TABLE_CELL_TEXT_VALUE`
(`''`, modo manual) y `EMPTY_DYNAMIC_TABLE_CELL_TEXT_VALUE` (`'—'`, modo dinámico) desde
`layout-canvas-node-palette-defaults.ts` (T5) — nunca literales `''`/`'—'` sueltos en este fichero.
Cada celda de `TableCellTypePropertyField` (T7) recibe `emptyTextValue={isManualTableMode ? EMPTY_TABLE_CELL_TEXT_VALUE : EMPTY_DYNAMIC_TABLE_CELL_TEXT_VALUE}`
— constante para todas las celdas de un mismo render del widget, ya que el modo es una propiedad de
la tabla completa, no de la celda individual. (Sin cambios respecto a la versión anterior.)

**Paso 0 — export mínimo en T7**: en `table-cell-type-property-field.tsx`, añade `export` a la
constante `CELL_TYPE_LABELS` y al tipo `TableCellType` (ambos ya definidos, hoy privados del
módulo). No cambies ninguna otra línea de ese fichero — es una ampliación de visibilidad, no una
modificación de comportamiento; `TableCellTypePropertyField` sigue siendo la única forma de editar
el tipo/valor de una celda individual.

**Detección de modo, alta/baja/renombrado de columna, cambio de modo Manual/Dinámico**: sin cambios
de comportamiento respecto a la implementación anterior de esta tarea (`detectMode`,
`toDynamicRowsMode`, `toManualRowsMode`, `commitHeaderRename`/`commitRemoveColumn`/`commitAddColumn`
y su interacción con `columns[]` por `id`, AC6/AC7 — incluida la reconstrucción mínima válida de
`props.rows` al cambiar de modo, ver nota de replanificación en T5). Lo único que cambia es la
disposición visual:

- **Columnas** (solo modo manual, sin reordenamiento — D5 revisión 2): lista vertical de headers
  editables, un `HeaderCell` por header (input de texto + botón "Quitar columna" en línea,
  deshabilitado con una única columna restante) apilados verticalmente sin roles `row`/`gridcell`,
  seguida de un botón "Añadir columna" — mismo patrón visual de lista de alta/baja sin
  reordenamiento que `ManualLiteralItemsEditor`/`ManualScalarItemsEditor`
  (`src/dev-runtime/layout-canvas/property-fields/choice-items-property-field.tsx`). Sin
  reordenamiento: reordenar una columna manual movería la misma posición en `headers` **y** en cada
  fila de `props.rows` a la vez — mutación de mayor superficie no motivada por ningún caso de uso
  descrito (design.md D5). **No se renderiza en modo dinámico** (D5 revisión 2): en ese modo, la
  gestión de columnas vive por completo en la lista de acordeones "Columnas" descrita más abajo —
  mostrar ambas superficies a la vez era redundante, ya que en modo dinámico hay una correspondencia
  1:1 entre header y columna-plantilla (a diferencia del modo manual, donde `headers` es compartido
  por varias filas).

**Filas (modo manual) y columnas (modo dinámico, D5 revisión 2) — acordeones ordenables**: sustituye
por completo la anterior fila `role="row"` de `gridcell`s. En modo dinámico este acordeón se titula
"Columnas" (no "Columnas-plantilla") y es la única superficie de gestión de columnas de ese modo —
ver el bullet "Dinámico" más abajo.

- **Mecanismo de reordenamiento** (compartido entre ambas listas, nunca montadas a la vez porque los
  modos son mutuamente excluyentes): un único `DndContext` de `@dnd-kit/core` local a este componente
  (`id="table-rows-reorder"`), sensor de puntero (`PointerSensor`, `activationConstraint: { distance: 4 }`,
  mismo umbral que `ShellTreeDndContext`), `collisionDetection={closestCenter}` (mismo criterio ya
  documentado en `shell-config-panel-dnd.tsx` para que una zona `gap` fina no quede eclipsada por el
  cuerpo del ítem vecino). Es un subconjunto más simple de la arquitectura ya construida para el
  panel de Shell (`shell-config-panel-dnd.tsx`, feature 0125): **no** reutilices
  `ShellTreeDndContext`/`ShellTreeDraggableRow`/`ShellTreeGapZone` ni `shell-tree-mutations.ts`
  directamente — esos módulos resuelven un árbol con notación de path por puntos y zonas `nest` para
  anidar, y ni las filas de una tabla ni las columnas-plantilla anidan entre sí (no hace falta zona
  `nest` ninguna). Implementa localmente en este fichero, con `@dnd-kit/core` puro (misma dependencia
  ya presente en el proyecto, sin añadir ninguna nueva):
  - Un ítem arrastrable por fila/columna: `useDraggable({ id: \`item-${index}\` })`, con un
    botón-handle (`⠿`, `aria-label` "Reordenar fila N"/"Reordenar columna N" — D5 revisión 2: ya no
    dice "columna-plantilla", ver bullet "Dinámico" más abajo) como único elemento con
    `attributes`/`listeners`/`setActivatorNodeRef` — mismo patrón que `ShellTreeDraggableRow`.
  - Una zona `gap` fina (`useDroppable({ id: \`gap-${index}\` })`, `<div>` sin estilo en el flujo
    normal, sin medición) antes del primer ítem, entre cada par de ítems consecutivos y después del
    último — mismo patrón que `ShellTreeGapZone`, con `index` de 0 a `length` inclusive.
  - `onDragEnd`: `fromIndex = Number(String(active.id).split('-')[1])`,
    `gapIndex = Number(String(over.id).split('-')[1])` (ignora el evento si `over` es `null` o el id
    no matchea ninguno de los dos prefijos). Índice final resultante:
    `gapIndex > fromIndex ? gapIndex - 1 : gapIndex` (mismo criterio de ajuste por posición relativa
    ya usado en `resolveGapIndexAfterRemoval`, adaptado a una única lista plana sin el paso de
    borrado). Si el índice final coincide con `fromIndex`, no invoques `onChange` (soltar sobre el
    hueco adyacente a la propia fila no es un cambio real).
  - Aplica la mutación con `moveArrayItem<T>(list: readonly T[], fromIndex: number, toIndex: number): T[]`
    (helper puro local, `splice` inmutable) sobre `props.rows` en modo manual. En modo dinámico,
    **una única función `moveDynamicColumnTemplate(node, fromIndex, toIndex)`** mueve la misma
    posición en `props.headers` **y** en `props.rows.cells` en la misma operación — riesgo señalado
    explícitamente en design.md ("Riesgos y trade-offs"): mover un array sin el otro rompe la
    correspondencia posicional que exige `validateTableDynamicRows`. No apliques dos `onChange`
    separados (uno por array); construye el nodo completo con ambos arrays ya movidos y comitea una
    sola vez. (`props.columns[]` no necesita tocarse: referencia headers por `id`, no por posición,
    así que sigue apuntando al header correcto tras el reorder sin cambios.)
  - **Fallback de teclado** (requisito no funcional de la spec — ninguna superficie de arrastre del
    proyecto implementa `KeyboardSensor` hoy, ver design.md D5): junto al handle de cada ítem, dos
    botones "Subir"/"Bajar" (`aria-label` "Subir fila N"/"Bajar fila N" o "Subir columna N"/"Bajar
    columna N" — D5 revisión 2) que invocan la misma mutación (`moveArrayItem`/
    `moveDynamicColumnTemplate`) con `toIndex = fromIndex - 1` / `fromIndex + 1`.
    "Subir" deshabilitado en el primer ítem (`index === 0`); "Bajar" deshabilitado en el último
    (`index === length - 1`).
- **Filas (modo manual)**: un ítem-acordeón por elemento de `props.rows`, dentro del mecanismo de
  arriba. Estado de expansión: `Set<number>` local al componente (`useState`), todas las filas
  colapsadas al montar; una fila añadida por "Añadir fila" se expande automáticamente (mismo
  criterio que `ShellMenuListEditor.addItem`). El índice usado como clave del `Set` no se reajusta
  tras quitar/reordenar filas — un índice colapsado/expandido que queda "desalineado" tras una baja
  o un reorder es una simplificación aceptada, mismo criterio de simplicidad que design.md D5 ya
  acepta para el propio estado de expansión (se resetea igualmente al cambiar de pestaña/nodo).
  - Colapsado: handle + botones Subir/Bajar + botón disclosure con `aria-expanded`/
    `aria-label={(collapsed ? 'Expandir' : 'Colapsar') + ' fila ' + (index + 1)}` que muestra
    "Fila N" y, si `row[0]` es una celda de texto (`typeof row[0] !== 'object'`), el valor completo
    de esa primera celda como preview (sin truncar el contenido del DOM; puedes aplicar la clase
    Tailwind `truncate` solo como recorte visual). Botón "Quitar fila" (sin mínimo — `props.rows: []`
    es un estado válido, ver casos límite).
  - Expandido: un `TableCellTypePropertyField` (T7, sin cambios) por columna existente, en el mismo
    orden que `headers`, con `emptyTextValue={EMPTY_TABLE_CELL_TEXT_VALUE}` — mismo callback
    `commitManualCellChange` que la versión anterior.
  - "+ Añadir fila" al final de la lista completa (tras la última zona `gap`, fuera del mecanismo de
    arrastre en sí). Sin filas (`props.rows.length === 0`): estado vacío con el mismo botón visible,
    sin `DndContext`/zonas `gap` (nada que reordenar).
- **Dinámico** (D5 revisión 2 — sustituye por completo el bullet "Dinámico" original): campo
  `source` sin cambios (`TextPropertyField`, texto libre, `commitSourceChange` intacta). Un
  ítem-acordeón por columna-plantilla de `rows.cells`, titulado como sección "Columnas" (no
  "Columnas-plantilla"), mismo mecanismo de arrastre que arriba, y ahora **única** superficie de
  gestión de columnas en este modo (la sección "Columnas" de headers ya no se renderiza en modo
  dinámico, ver bullet "Columnas" de arriba):
  - Colapsado: handle + botones Subir/Bajar + botón disclosure con el mismo patrón `aria-expanded`
    que en Filas (`aria-label` "Expandir/Colapsar columna N" — ya no dice "columna-plantilla") que
    muestra el texto del header en esa posición y un badge con `CELL_TYPE_LABELS[detectCellType(cell)]`
    (import del export del Paso 0; no dupliques la tabla de etiquetas), y un botón "Quitar columna"
    en línea (`aria-label` "Quitar columna N", deshabilitado con una única columna restante —
    mismo criterio AC6 que `HeaderCell`) que invoca `commitRemoveColumn(index)` — la misma función
    que antes solo se llamaba desde la sección "Columnas", ahora reubicada aquí.
  - Expandido: un input de renombrado de header (`labelText` "Cabecera de columna N" — ya no dice
    "columna-plantilla"; mismo comportamiento AC7 — si existe una entrada de `columns[].id`
    coincidente, se renombra en la misma operación — reutiliza `commitHeaderRename`, sin cambios de
    lógica) seguido de un `TableCellTypePropertyField` (T7, sin cambios) para esa celda-plantilla,
    con `emptyTextValue={EMPTY_DYNAMIC_TABLE_CELL_TEXT_VALUE}` — mismo callback
    `commitDynamicCellChange` que la versión anterior.
  - "+ Añadir columna" al final de la lista completa (tras la última zona `gap`, fuera del mecanismo
    de arrastre en sí) — invoca `commitAddColumn`, la misma función que antes solo vivía en la
    sección "Columnas", ahora reubicada aquí. `headers.length === 0` no es un caso alcanzable (un
    `table` siempre tiene al menos un header — AC "quitar la última columna no está permitido"), así
    que no hace falta un estado vacío distinto del ya cubierto por AC6.
- **Commit**: sin cambios de contrato — cada operación (renombrar/añadir/quitar columna,
  añadir/quitar/reordenar fila, cambiar tipo o texto de una celda, editar `source`, cambiar de modo,
  reordenar columna) invoca `onChange` con el nodo completo reconstruido de forma inmutable; el
  propio componente sigue sin conocer el pipeline de commit/validación (T9).

### Fuera de alcance
- Wiring en `layout-canvas-properties-panel.tsx`, exclusión de `headers`/`rows`/`columns` del
  dispatcher genérico, feedback de commit rechazado (`role="alert"`) — todo eso es T9.
- Extraer el mecanismo de arrastre a un módulo compartido con `shell-config-panel-dnd.tsx` — mejora
  posible señalada en design.md D5 como decisión de implementación menor, no exigida por esta tarea.
- Reordenamiento por arrastre/teclado para las columnas de la sección "Columnas" (headers) — D5 lo
  excluye explícitamente, solo aplica a filas manuales y columnas-plantilla dinámicas.
- Cualquier control para `props.pagination` o `props.columns[].filterable`/`sortable`/
  `filterPlaceholder` (fuera de alcance de la spec).

### Dependencias
T5 (constantes de literal vacío por modo), T7 (más el export del Paso 0, aplicado dentro de esta
misma tarea).

### Impacto esperado en archivos
- Código: `src/dev-runtime/layout-canvas/property-fields/table-rows-property-field.tsx`
  (reescritura completa de su implementación anterior — mismo nombre de fichero y misma firma
  exportada), `src/dev-runtime/layout-canvas/property-fields/table-cell-type-property-field.tsx`
  (modificado — solo el export del Paso 0, sin cambio de comportamiento).
- Tests: ver sub-bloque `tests`.
- Documentación: `ai-workflow/docs/app-features/development/dev-mode-editor.md`,
  `ai-workflow/docs/app-features/nodes/table.md` (a completar en la pasada documental junto con T9;
  la ficha debe describir la disposición de acordeones y el reordenamiento, no la cuadrícula
  original).

### Tests
**Ficheros de test**:
`src/tests/dev-runtime/layout-canvas-property-field-table-rows.test.tsx` (ampliación — reescritura
completa de los casos existentes contra la nueva estructura; mismo criterio de aislamiento que
`layout-canvas-property-field-layout-span.test.tsx`: sin dispatcher ni pipeline real, `onChange`
espiado con `vi.fn()`). Para simular el arrastre, usa el mismo mock de `@dnd-kit/core` ya establecido
en `layout-canvas-reorder-reinsert.test.tsx` (`onDragEnd` invocado directamente con un `DragEndEvent`
sintético `{ active: { id: ... }, over: { id: ... } }`, sin simular puntero real) — no introduzcas un
mock paralelo.

**Comportamiento cubierto**:
- Detección de modo desde `props.rows` (array → Manual; objeto `{source, cells}` → Dinámico)
  (regresión, sin cambios respecto a la versión anterior).
- Cambiar de modo reconstruye `props.rows` con la forma mínima fijada en T8 original en ambos
  sentidos, preservando `headers`/`columns` intactos (regresión).
- Modo manual: la sección "Columnas" se renderiza y renombrar un header desde ella sin entrada de
  `columns[]` asociada solo cambia `headers[index]`; con una entrada `columns[].id` coincidente,
  actualiza también esa entrada (regresión, AC7). "Quitar columna" desde esa sección elimina el
  header y la celda correspondiente de cada fila, y cualquier entrada de `columns[]` asociada;
  deshabilitado con una única columna restante. "Añadir columna" desde esa sección añade un header y
  una celda `EMPTY_TABLE_CELL_TEXT_VALUE` nueva en cada fila existente.
- Modo dinámico (D5 revisión 2): la sección "Columnas" de headers **no** se renderiza — no existe
  ningún elemento que la identifique (ni por `role="group"` propio de esa lista, ni por el botón
  "Añadir columna" fuera del acordeón). "Quitar columna" desde el botón en línea de cada ítem-acordeón
  (`aria-label` "Quitar columna N") elimina el header, la celda correspondiente de `cells`, y
  cualquier entrada de `columns[]` asociada; deshabilitado con una única columna restante. "Añadir
  columna" desde el botón al final de la lista de acordeones añade un header y una celda
  `EMPTY_DYNAMIC_TABLE_CELL_TEXT_VALUE` nueva en `cells` (`it.each` cubriendo ambos modos con sus
  literales y ubicaciones de control correctas).
- El widget ya no renderiza ningún elemento con `role="grid"`/`role="row"`/`role="gridcell"`
  (regresión directa de la revisión 1 — confirma que la cuadrícula original desapareció).
- Modo manual: cada fila se renderiza colapsada por defecto; expandir/colapsar mediante el botón
  disclosure alterna `aria-expanded` y la presencia del `TableCellTypePropertyField` de cada columna
  en el DOM.
- Modo manual: el preview colapsado de una fila muestra el valor completo de su primera celda cuando
  esa celda es de tipo texto, y no muestra preview cuando la primera celda es un tipo de nodo.
- "Añadir fila" añade una fila nueva con `EMPTY_TABLE_CELL_TEXT_VALUE` en cada celda y la deja
  expandida automáticamente; "Quitar fila" la elimina sin mínimo; `rows: []` sigue mostrando
  "Añadir fila" sin montar ningún mecanismo de arrastre.
- Reordenar una fila en modo manual, tanto soltando el ítem sobre una zona `gap` (invocando
  `onDragEnd` directamente con el mock) como pulsando "Subir"/"Bajar", mueve la fila a la posición
  correcta en `props.rows` sin afectar a `headers`/`columns`; "Subir" deshabilitado en la primera
  fila, "Bajar" en la última; soltar sobre el hueco adyacente a la propia fila (posición sin cambio
  real) no invoca `onChange`.
- Modo dinámico: cada columna se renderiza colapsada por defecto con handle + texto del header +
  badge de `CELL_TYPE_LABELS[detectCellType(cell)]` + botón "Quitar columna"; expandirla muestra el
  input de renombrado de header (`aria-label`/`labelText` "Cabecera de columna N" — sin
  "-plantilla") y el `TableCellTypePropertyField` de esa celda.
- Modo dinámico: renombrar el header desde dentro del ítem-acordeón expandido actualiza
  `headers[index]` y, si existe, la entrada `columns[].id` coincidente (AC7) — única vía de
  renombrado en este modo tras la revisión 2 (ya no hay una segunda sección "Columnas" con la que
  comparar el resultado).
- Reordenar una columna en modo dinámico (drag y botones Subir/Bajar) mueve la misma
  posición en `props.headers` **y** en `props.rows.cells` en la misma operación (verificar ambos
  arrays tras el reorder, no solo uno — caso de riesgo señalado explícitamente en design.md);
  `props.columns[]` no cambia (sigue referenciando por `id`).
- Cada celda (manual y dinámica) monta `TableCellTypePropertyField` con el `value`/`emptyTextValue`
  correctos de esa posición; su `onChange` reemplaza exactamente esa celda sin afectar a las demás
  (regresión).
- Modo dinámico: editar `source` invoca `onChange` con `props.rows.source` actualizado preservando
  `cells` intacto (regresión).
- Dos celdas de la misma columna en filas manuales distintas pueden tener tipos distintos sin que el
  widget lo impida (AC9, regresión).
- Quitar una columna que tiene celdas-nodo con subárbol propio en varias filas las elimina todas
  junto con la columna, sin aviso adicional (regresión).

**Comandos durante la implementación**:
```
pnpm test --run src/tests/dev-runtime/layout-canvas-property-field-table-rows.test.tsx
```

**Restricciones**: no montes `LayoutCanvasPropertiesPanel` ni ningún pipeline de commit real en este
fichero. No reintroduzcas literales `''`/`'—'` sueltos en el componente ni en el test — usa siempre
`EMPTY_TABLE_CELL_TEXT_VALUE`/`EMPTY_DYNAMIC_TABLE_CELL_TEXT_VALUE`. No importes
`ShellTreeDndContext`/`ShellTreeDraggableRow`/`ShellTreeGapZone`/`shell-tree-mutations.ts` — el
mecanismo de arrastre de esta tarea es una implementación local más simple, no una reutilización
directa de esos módulos (ver Objetivo).

### Criterios de finalización
El widget cubre alta/baja/renombrado de columnas (sin reordenamiento), alta/baja/reordenamiento de
filas en modo manual (arrastre y botones Subir/Bajar), edición de `source` y celdas más
reordenamiento de columnas-plantilla en modo dinámico (con movimiento atómico de `headers`/`cells`),
y cambio de modo con reconstrucción mínima válida — todo mediante un único `onChange` de nodo
completo, sobre una disposición de acordeones apilados sin `role="grid"`; tests en verde.

### Cierre de implementación
Código y tests de esta tarea completos y validados.

---

## T9 — Wiring del widget en el panel de propiedades

### Objetivo
En `src/dev-runtime/layout-canvas/layout-canvas-properties-panel.tsx`:
1. Añade `'tableRows'` a `PendingRejectionKey` (junto a `'submitAction'`/`'containerColumnsMode'`).
2. En `renderPropsSpecialBlocks()`, añade un bloque `node.type === 'table'` que monta
   `TableRowsPropertyField` (T8) con el mismo patrón que el bloque `containerColumnsMode` existente:
   `displayedNode` desde `pendingRejections.tableRows` si existe, si no desde `node`; `onChange`
   invoca `onCommitNodeUpdate(path, () => nextNode)` y registra el resultado con
   `recordCommitResult('tableRows', nextNode, result)`; muestra `CommitRejectionBanner` con
   `dataTestId="layout-canvas-properties-panel-tableRows-error"` cuando hay rechazo pendiente.
3. Añade una función `resolveTablePropsSchema(propsSchema)` (mismo patrón que
   `resolveContainerPropsSchema`/`resolveTabsPropsSchema`) que, cuando `node.type === 'table'`,
   elimina `headers`, `rows` y `columns` de `propsSchema.properties` antes de pasarlo al dispatcher
   genérico — el dispatcher deja de iterarlas como campos independientes de `Props`, ya que el
   widget de T8 es su única vía de edición (D4). Invócala en `renderTabContent` junto al resto de
   `resolveXxxPropsSchema` para `key === 'props'`.

### Fuera de alcance
- Cualquier cambio en `TableRowsPropertyField`/`TableCellTypePropertyField` en sí (T7/T8).
- Cualquier cambio en el resto de bloques especiales (`link`, `container`, `form`) ya existentes.

### Dependencias
T8.

### Impacto esperado en archivos
- Código: `src/dev-runtime/layout-canvas/layout-canvas-properties-panel.tsx` (modificado).
- Tests: ver sub-bloque `tests`.
- Documentación: `ai-workflow/docs/app-features/development/dev-mode-editor.md` (sección de bloques
  especiales de `Props` — añadir `table` a la lista junto a `link`/`container`/`form`, y sección de
  disposición tabular del widget si aplica), `ai-workflow/docs/app-features/nodes/table.md` (si el
  criterio de la pasada documental decide reflejar aquí la existencia del widget del editor).

### Tests
**Ficheros de test**:
- `src/tests/dev-runtime/layout-canvas-properties-panel.test.tsx` (ampliación).
- `src/tests/dev-runtime/layout-canvas-properties-panel-commit-feedback.test.tsx` (ampliación).

**Comportamiento cubierto**:
- El widget de filas/columnas/celdas aparece al principio del tabpanel `Props` de un nodo `table`
  seleccionado, antes de cualquier campo generado por el dispatcher para esa subsección, y
  desaparece al activar cualquier otra pestaña (`Visibilidad`/`Queries`) — mismo criterio ya
  cubierto para `container`/`link`/`form`.
- `headers`, `rows` y `columns` no aparecen como campos genéricos independientes en `Props` de
  `table` (regresión de que el dispatcher ya no los itera).
- Una operación del widget (por ejemplo, añadir una columna) corre por el pipeline de commit real
  (`onCommitNodeUpdate` → `validateRuntimeConfig`) y se refleja en `currentConfig`/buffer de Monaco,
  tocando solo el nodo `table` seleccionado.
- Un commit rechazado desde cualquier control del widget (por ejemplo, un `href` inválido en una
  celda `link` recién convertida) deja el valor tecleado visible y muestra
  `role="alert"` con el mismo criterio de limpieza (se limpia al reintentar con éxito o al cambiar
  de nodo seleccionado) que el resto del panel — criterio 17 de la spec.
- Regresión: los bloques especiales existentes (`link` "Contenido", `container` "Modo", `form`
  "Acción de envío") no cambian de comportamiento para sus propios tipos de nodo.
- End-to-end de una celda `link` (criterios 12–13 de la spec): elegir "Enlace" en el selector de tipo
  de una celda, editar su `href`/`label` desde el canvas (T3) tras seleccionarla, y confirmar que el
  commit resultante pasa `validateRuntimeConfig` y se refleja en el config.

**Reescritura obligatoria por la revisión de D5 (disposición de T8, ver su Nota de revisión)**: los
casos ya existentes que localizaban el widget por `screen.getByRole('grid', { name: 'Filas y
columnas' })` y recorrían su interior con `getAllByRole('row')`/`getAllByRole('gridcell')` quedan
obsoletos, porque T8 ya no renderiza esos roles. Reescribe, sin cambiar la aserción de fondo de cada
caso:
- `layout-canvas-properties-panel.test.tsx`, describe `'LayoutCanvasPropertiesPanel table
  rows/columns widget (T9, 0138)'` (4 casos: presencia/ausencia bajo `Props`/`Visibilidad`,
  posición relativa a los campos del dispatcher, ausencia para un nodo no-`table`): localiza el
  widget con `screen.getByRole('group', { name: 'Filas y columnas' })` (el `fieldset`/`legend` de
  T8) en vez de `role="grid"`.
- `layout-canvas-properties-panel-commit-feedback.test.tsx`, describes `'... table rows/columns
  widget — end-to-end real pipeline (T9, 0138)'` y `'... table cell converted to link — end-to-end
  (T9, 0138, criteria 12-13)'` (4 casos): misma sustitución de `role="grid"` por `role="group"`. El
  caso de conversión a `link` (criterios 12–13) accede hoy al `combobox` de tipo de celda navegando
  `grid` → `row`[1] → `gridcell`[0]; en la nueva estructura, expande primero el ítem-acordeón de esa
  fila (`fireEvent.click(screen.getByRole('button', { name: 'Expandir fila 1' }))`, T8) y localiza el
  `combobox` dentro de su cuerpo ya expandido antes de disparar el `fireEvent.change` a `'link'`.

**Comandos durante la implementación**:
```
pnpm test --run src/tests/dev-runtime/layout-canvas-properties-panel.test.tsx
pnpm test --run src/tests/dev-runtime/layout-canvas-properties-panel-commit-feedback.test.tsx
```

**Restricciones**: no dejes ninguna consulta `role="grid"`/`role="row"`/`role="gridcell"` contra el
widget de tabla en ninguno de los dos ficheros tras esta tarea (las coincidencias de esos roles del
selector de iconos en `layout-canvas-properties-panel.test.tsx`, no relacionadas con `table`, no se
tocan).

### Criterios de finalización
El widget queda operable end-to-end contra el pipeline real de commit/validación, con el mismo
criterio de feedback de rechazo que el resto del panel, y `headers`/`rows`/`columns` quedan
excluidos del dispatcher genérico; tests en verde. Con esta tarea cerrada, todos los criterios de
aceptación 1–17 de la spec quedan cubiertos por la suite de tests de la feature.

### Cierre de implementación
Código y tests de esta tarea completos y validados.
