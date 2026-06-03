# Tasks: celdas ricas en tabla (`0049-rich-table-cells`)

Plan de ejecución para extender `table` y aceptar `NodeObject` en celdas además de primitivos. Las tareas se ejecutan en orden estricto: cada una habilita la siguiente.

Subconjunto canónico de nodos permitidos en celda (`TABLE_CELL_ALLOWED_NODE_TYPES`):
`image`, `list`, `button`, `container`, `heading`, `paragraph`.
`container` permite `children` recursivamente del mismo subconjunto, incluido otro `container`.

Todas las tareas comparten una restricción global: el umbral del 80% de cobertura en `pnpm test` debe mantenerse al cierre de cada tarea.

---

## T1 — Contrato de tipos y validación de celdas-nodo en modo manual

### Estado
`done`

### Objetivo
Extender el contrato del nodo `table` para que cada celda en modo manual pueda ser `string | number | boolean | NodeObject` y validar que el `NodeObject` solo declare un `type` del subconjunto permitido, con `container` recursivo bajo la misma restricción. Cada `NodeObject` se valida reutilizando `validateLayoutNode` para que las reglas existentes de cada nodo (props, visibilidad, `queryStateFeedback`, `layout`) apliquen sin excepción.

### Fuera de alcance
- Modo dinámico (`props.rows.cells`); se aborda en `T2`.
- Render de celdas-nodo y propagación de `item.*`; se aborda en `T3`.
- Comportamiento de filtros, ordenación y paginación frente a celdas-nodo; se aborda en `T3`.

### Dependencias
Ninguna. Es la tarea raíz.

### Impacto esperado en archivos
- Código a modificar:
  - `src/config/runtime-config-types.ts`: añadir tipo `TableCellPrimitive`, añadir tipo `TableCellNode` (alias del subconjunto de `LayoutNode` permitido) y redefinir `TableCellValue` como `TableCellPrimitive | TableCellNode`. `TableManualRows` queda como `TableCellValue[][]`.
  - `src/config/runtime-config-zod.ts`: exportar constante `tableCellAllowedNodeTypes` con el subconjunto canónico.
  - `src/config/validate-layout-nodes.ts`:
    - Añadir helper `validateTableCellNode(rawCell, path, pageId)` con orden estricto de chequeo:
      1. Si `rawCell.type` no es string no vacío o no está en `tableCellAllowedNodeTypes`, rechazar con diagnóstico sobre `<path>.type` antes de cualquier otra validación.
      2. Si `type` es `container`, recorrer recursivamente la rama `children` declarada (a través de todos los `container` anidados que aparezcan) y rechazar con diagnóstico exacto sobre `<path>.children[i].type` (o la ruta anidada que corresponda) el primer descendiente cuyo `type` no esté en `tableCellAllowedNodeTypes`. Esta pasada de subconjunto se ejecuta antes de delegar en `validateLayoutNode`, para que un `modal`/`input`/`form`/`repeater`/`table` anidado no se diagnostique como problema interno del `container`.
      3. Solo si las pasadas anteriores han pasado, delegar en `validateLayoutNode(rawCell, path, pageId)` para validar props, `visibility`, `queryStateFeedback` y `layout` del nodo embebido (y, en el caso de `container`, sus `children` ya garantizados dentro del subconjunto).
    - Modificar `validateTableManualRows` para aceptar celdas no primitivas, delegando en el helper.
    - Mantener la regla de longitud exacta de filas contra `headers`.
- Tests a modificar:
  - `src/tests/config-validation/runtime-config-validation-image-table.test.ts` (ampliación).
- Documentación afectada (referencia para `update-app-documentation`):
  - `ai-workflow/docs/app-features/nodes/table.md`: contrato de celdas en modo manual.

### Tests

- **Ficheros de test**:
  - `src/tests/config-validation/runtime-config-validation-image-table.test.ts` (ampliación)
- **Comportamiento cubierto**:
  - Acepta una fila manual con un `NodeObject` `image` válido en una celda y mantiene el resto de celdas primitivas.
  - Acepta una celda manual `container` cuyos `children` solo declaran tipos del subconjunto (incluido otro `container` anidado).
  - Acepta una celda manual `button` con `action: navigateTo` válida.
  - Rechaza una celda manual con `{ type: 'modal', ... }` con diagnóstico de ruta `layout[...].props.rows[r][c].type`.
  - Rechaza una celda manual con `{ type: 'input', ... }` con diagnóstico de ruta sobre la posición exacta.
  - Rechaza una celda manual con `{ type: 'repeater', ... }` y con `{ type: 'table', ... }`.
  - Rechaza una celda manual con `{ type: 'form', ... }`.
  - Rechaza una celda manual con `type` vacío o ausente apuntando a la ruta exacta.
  - Rechaza una celda manual `container` cuyo `children[i]` declara un tipo fuera del subconjunto (por ejemplo `modal`), con diagnóstico en `...container.children[i].type`.
  - Rechaza una celda manual `container` con `children` anidados que rompen el subconjunto en cualquier profundidad (`container > container > input`).
  - Rechaza una celda manual cuyo `NodeObject` rompe el contrato propio del nodo (ejemplo: `image` sin `src` ni `fetch`) reutilizando el diagnóstico del validador de `image`.
  - Rechaza una fila manual cuyo número de celdas (mezcla primitivos + nodos) no coincide con `headers`.
  - Acepta filas manuales mixtas (primitivos y nodos en columnas distintas) preservando la posición de cada celda contra `headers`.
- **Comandos durante la implementación**:
  - `pnpm test --run src/tests/config-validation/runtime-config-validation-image-table.test.ts`
- **Restricciones**:
  - Reusar los helpers existentes de `config-validation/helpers.ts`; no introducir un harness nuevo.
  - Diagnósticos de ruta deben seguir el formato `Page "<pageId>" has an invalid layout at "<path>".` ya canónico en el resto de validadores.

### Criterios de finalización
- Validación manual acepta los casos del subconjunto y rechaza los fuera de subconjunto con diagnóstico exacto.
- `validateLayoutNode` no se duplica: el helper de celda recurre en él.
- `container` en celda solo acepta `children` del subconjunto, recursivo.

### Cierre de implementación
Código aplicado, los tests ampliados de validación pasan en verde y `pnpm test` completo mantiene cobertura ≥80%.

---

## T2 — Validación de celdas-nodo en modo dinámico

### Estado
`done`

### Objetivo
Extender la validación dinámica para aceptar `(string | NodeObject)[]` en `props.rows.cells`, reutilizando el helper introducido en `T1` para el `NodeObject`. La correspondencia exacta con `headers` se mantiene contando cada `NodeObject` como una posición de celda.

### Fuera de alcance
- Render de celdas-nodo en runtime; se aborda en `T3`.
- Resolución de `item.*` dentro de los props del nodo embebido en runtime; queda cubierto por el render en `T3`.

### Dependencias
`T1` (el helper `validateTableCellNode` y los tipos extendidos deben existir).

### Impacto esperado en archivos
- Código a modificar:
  - `src/config/runtime-config-types.ts`: redefinir `TableDynamicRows.cells` como `(string | TableCellNode)[]`.
  - `src/config/validate-layout-nodes.ts`:
    - Modificar `validateTableDynamicRows`:
      - Cada entrada de `cells` se acepta si es un string no vacío (semántica actual) o un `NodeObject` válido bajo el subconjunto.
      - Mantener el chequeo de longitud exacta contra `headers`.
      - Mantener el rechazo por strings vacíos cuando la entrada sea string (no relajar el contrato existente para el caso string).
- Tests a modificar:
  - `src/tests/config-validation/runtime-config-validation-image-table.test.ts` (ampliación).
- Documentación afectada:
  - `ai-workflow/docs/app-features/nodes/table.md`: contrato de celdas en modo dinámico.

### Tests

- **Ficheros de test**:
  - `src/tests/config-validation/runtime-config-validation-image-table.test.ts` (ampliación)
- **Comportamiento cubierto**:
  - Acepta `cells` dinámicas con un `NodeObject` `image` cuyo `src` es `item.avatar` mezclado con celdas string referenciales.
  - Acepta `cells` dinámicas con un `NodeObject` `button` cuya `action.navigateTo.params.id` referencia `item.id`.
  - Acepta `cells` dinámicas con un `NodeObject` `container` cuyo `children` declara solo tipos del subconjunto.
  - Rechaza `cells` dinámicas con un `NodeObject` `modal` con diagnóstico en `...rows.cells[i].type`.
  - Rechaza `cells` dinámicas con un `NodeObject` `input` con diagnóstico en `...rows.cells[i].type`.
  - Rechaza `cells` dinámicas con un `NodeObject` `repeater` y con `table` (ambos casos).
  - Rechaza `cells` dinámicas con un `NodeObject` cuyo `type` es string vacío o ausente.
  - Rechaza `cells` dinámicas con una entrada string vacía (regresión del contrato actual).
  - Rechaza `cells` dinámicas cuyo número total (string + NodeObject) no coincide con `headers`.
  - Rechaza `cells` dinámicas donde un `container` embebido tiene `children` fuera del subconjunto en cualquier profundidad.
- **Comandos durante la implementación**:
  - `pnpm test --run src/tests/config-validation/runtime-config-validation-image-table.test.ts`
- **Restricciones**:
  - El helper `validateTableCellNode` no debe duplicarse; reusar el introducido en `T1`.

### Criterios de finalización
- Validación dinámica acepta celdas mixtas string + NodeObject del subconjunto.
- Diagnósticos exactos para tipos fuera del subconjunto y para incumplimientos del contrato propio del nodo embebido.
- Regresión: ningún test previo de tabla deja de pasar.

### Cierre de implementación
Código aplicado, tests dinámicos ampliados en verde y `pnpm test` completo mantiene cobertura ≥80%.

---

## T3 — Render de celdas-nodo y comportamiento de filtro, ordenación y paginación

### Estado
`done`

### Objetivo
Renderizar las celdas-nodo dentro del `<td>` correspondiente delegando en el renderer central existente, propagando `item.*` desde la fila cuando la tabla opera en modo dinámico, y manteniendo el contrato de filtros, ordenación y paginación tratando las celdas-nodo como string vacío.

### Fuera de alcance
- Cambios en el contrato de tipos del config (ya cerrados en `T1` y `T2`).
- Soporte de `modal`, formularios, `repeater` o `table` como contenido de celda.
- Edición inline o cualquier interactividad nueva sobre la tabla más allá de delegar al renderer.

### Dependencias
`T1` y `T2`.

### Impacto esperado en archivos
- Código a modificar:
  - `src/runtime/runtime-table-processing.ts`:
    - Redefinir `TableVisibleRow` como `readonly (string | TableCellNode)[]` exactamente — unión plana, sin envoltorio objeto adicional ni alias intermedio. La detección de celda-nodo en filtros y ordenación se basa en `typeof value !== 'string'`.
    - Ajustar `filterTableRows`, `sortTableRows` y cualquier punto que llame a `normalizeTableSearchText` para tratar las celdas-nodo como cadena vacía sin error.
    - `processTableRows` y `getNextTableSortState` mantienen su firma pública salvo el tipo de celda.
  - `src/runtime/nodes/table-layout-node.tsx`:
    - `resolveTableRows`:
      - Modo manual: para cada celda, si es `NodeObject` se conserva la referencia al nodo declarativo tal cual (sin clonar); si es primitivo se resuelve y normaliza como hoy.
      - Modo dinámico: por cada `item`, si la entrada `cells[c]` es un `NodeObject` se conserva la referencia al mismo nodo declarativo de la configuración (no se clona ni se materializa en string), y la asociación con el `item` correspondiente se produce únicamente en el momento del render vía `iterationContext`. Si es string, semántica actual.
    - En el cuerpo del `<tbody>`, una celda string se sigue renderizando como texto; una celda-nodo se renderiza usando `LayoutNodeRenderer` con `iterationContext: { item }` cuando la tabla opera en modo dinámico, o sin `iterationContext` cuando opera en modo manual.
    - La estructura `<tr>/<td>` se mantiene íntegra incluso cuando el nodo embebido renderiza `null` (visibility/qsf).
    - Identidad React: cada `<tr>` mantiene una `key` estable derivada del item visible (en modo dinámico, basada en el `item` resuelto; en modo manual, basada en el índice de fila) y cada `<td>` usa una `key` por índice de columna. La celda-nodo se renderiza directamente dentro de su `<td>` sin un `key` adicional sobre el nodo embebido. Cambiar de página recrea los `<tr>` correspondientes al nuevo conjunto de filas visibles, lo que provoca el montaje del subárbol embebido para esas filas y el desmontaje del de las filas que salen.
- Tests a crear:
  - `src/tests/layout-renderer/layout-renderer-table-rich-cells.test.tsx` (nuevo).
- Tests a modificar:
  - `src/tests/runtime/runtime-table-processing.test.ts` (ampliación).
- Documentación afectada:
  - `ai-workflow/docs/app-features/nodes/table.md`: pipeline de procesamiento, degradación y filtros/ordenación con celdas-nodo.
  - `ai-workflow/docs/test-index.md`: registrar el nuevo fichero `layout-renderer-table-rich-cells.test.tsx`.
  - `ai-workflow/docs/current-state.md`: nota de última feature relevante en Catálogo de nodos.

### Tests

- **Ficheros de test**:
  - `src/tests/layout-renderer/layout-renderer-table-rich-cells.test.tsx` (nuevo)
  - `src/tests/runtime/runtime-table-processing.test.ts` (ampliación)
- **Comportamiento cubierto** (`layout-renderer-table-rich-cells.test.tsx`):
  - Una celda dinámica `{ type: 'image', props: { src: 'item.avatar', alt: 'item.name' } }` renderiza una `<img>` por fila con el `src` y `alt` correctos resueltos desde `item.*`.
  - Una celda dinámica `{ type: 'button', props: { label: 'Ver', action: { type: 'navigateTo', pageId: 'detail', params: { id: 'item.id' } } } }` renderiza un botón por fila y al pulsarlo dispara navegación a `detail` con `id` del `item` de esa fila.
  - Una celda dinámica `{ type: 'container', props: { ... }, children: [image, paragraph] }` renderiza la composición sin error y el subárbol propaga `item.*` correctamente.
  - Una celda dinámica `NodeObject` con `visibility` que resuelve a oculto deja la `<td>` vacía sin romper la fila ni el resto de celdas.
  - Una celda dinámica `NodeObject` con `queryStateFeedback` en estado `loading` muestra el feedback del nodo dentro de la `<td>` sin afectar a otras celdas de la misma fila.
  - Una celda manual `NodeObject` (sin contexto `item`) se renderiza dentro de la `<td>` correspondiente.
  - Una columna `sortable: true` cuyas celdas son una mezcla de primitivos y nodos ordena correctamente comparando los primitivos y trata las celdas-nodo como cadena vacía sin error.
  - Una columna `filterable: true` cuyas celdas son una mezcla aplica la comparación sobre el texto resuelto de las celdas primitivas y compara las celdas-nodo de esa misma columna como cadena vacía: con un filtro activo no vacío, las filas cuya celda en la columna filtrada sea un `NodeObject` quedan excluidas del resultado; con el filtro vacío, todas las filas pasan (semántica actual de filtro inactivo).
  - Una columna simultáneamente `filterable: true` y `sortable: true` con celdas-nodo aplica ambas reglas sin error.
  - Una tabla con `pagination.pageSize: 2` y celdas-nodo solo monta nodos embebidos para la página visible: cambiar de página monta los nodos de la nueva ventana y desmonta los anteriores (verificación por contadores de presencia en DOM).
  - Una celda-nodo `container` vacío (sin `children`) renderiza una `<td>` no rota.
- **Comportamiento cubierto** (`runtime-table-processing.test.ts` ampliación):
  - `filterTableRows` trata una celda no string como cadena vacía y no llama a `normalizeTableSearchText` sobre objetos.
  - `sortTableRows` ordena filas con celdas mezcladas tratando las celdas no string como cadena vacía y manteniendo orden estable entre filas equivalentes.
  - `processTableRows` no muta la entrada cuando algunas celdas son nodos.
- **Comandos durante la implementación**:
  - `pnpm test --run src/tests/layout-renderer/layout-renderer-table-rich-cells.test.tsx`
  - `pnpm test --run src/tests/runtime/runtime-table-processing.test.ts`
- **Restricciones**:
  - Reusar los helpers de `layout-renderer/` (`renderRuntimePageWithState`, fixtures de queries) en lugar de crear un harness nuevo.
  - No introducir snapshots completos del `<table>`; las aserciones deben ir contra estructura DOM concreta (`role="row"`, `role="cell"`, `<img>`, `<button>`).
  - La detección de celda-nodo en `processTableRows` debe basarse en el tipo del valor (`typeof !== 'string'`), no en una propiedad inventada del marcador.

### Criterios de finalización
- Render de celdas-nodo delega en `LayoutNodeRenderer` reutilizando el dispatcher central.
- `item.*` se propaga correctamente desde cada fila al subárbol embebido.
- Filtros y ordenación operan sin error sobre tablas con celdas mezcladas.
- Paginación solo monta los nodos embebidos de la página visible.
- Tests existentes de tabla (`layout-renderer-image-table.test.tsx`, `layout-renderer-table-pagination.test.tsx`, `runtime-config-validation-image-table.test.ts`, `runtime-table-processing.test.ts`) siguen en verde sin modificación de los casos previos.
- `pnpm test` completo mantiene cobertura ≥80%.

### Cierre de implementación
Código aplicado, los tests nuevos y ampliados en verde, los previos siguen en verde y `pnpm test` completo mantiene cobertura ≥80%.

---

## Siguiente tarea a abordar
`T1`.
