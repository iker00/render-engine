# Tasks — dev-editor-table-column-filter-sort-toggles

Orden de ejecución: T1 → T2 → T3. T2 y T3 no tienen dependencia de interfaz entre sí (ambas solo
consumen lo que produce T1), pero ambas modifican el mismo fichero
(`table-rows-property-field.tsx`), así que deben implementarse en este orden secuencial para evitar
conflictos de edición, no por necesidad de contrato.

Siguiente tarea recomendada tras cerrar esta planificación: **T1**.

---

## T1 — Campo reutilizable "Ordenable"/"Filtrable" + lógica pura de `columns[]`

### Objetivo
Crear un componente de campo reutilizable, `TableColumnFlagsField`, que renderiza los dos
controles booleanos "Ordenable" y "Filtrable" de una columna de `table` (identificada por su `id`,
que coincide con el header) más el campo de texto condicional "Placeholder del filtro", y que
encapsula toda la lógica de alta/actualización/baja de la entrada correspondiente en
`table.props.columns[]`. Este componente no se integra todavía en el widget "Filas y columnas"
(eso es T2 y T3): esta tarea lo deja listo, aislado y completamente cubierto por tests propios.

Lógica pura a implementar dentro del mismo fichero del componente (no exportar como contrato
entre tareas; solo `TableColumnFlagsField` es el contrato — ver `Interfaces`):

- **Lectura de estado actual** de una columna a partir de `columns: TableColumnConfig[] | undefined`
  y su `id`: si no existe entrada, `sortable` y `filterable` son `false` y `filterPlaceholder` es
  `''`; si existe, se leen sus valores tal cual (`filterPlaceholder` ausente se trata como `''`).
- **Marcar "Ordenable" (`sortable: true`)**: si no existe entrada para ese `id`, crea
  `{ id, sortable: true }` y la añade al array (`columns ?? []`). Si ya existe una entrada, le
  añade/actualiza `sortable: true` sin tocar `filterable` ni `filterPlaceholder` si los tenía.
- **Desmarcar "Ordenable"**: si no existe entrada, no hace nada. Si existe, quita la clave
  `sortable` de esa entrada; si tras quitarla la entrada no tiene `filterable: true`, la entrada se
  elimina por completo del array; si sí lo tiene, la entrada se conserva sin `sortable` (y
  conservando `filterPlaceholder` si lo tenía).
- **Marcar "Filtrable" (`filterable: true`)**: mismo criterio de alta que "Ordenable" — crea la
  entrada si no existe (`{ id, filterable: true }`) o añade/actualiza `filterable: true` sobre una
  entrada existente, sin tocar `sortable`.
- **Desmarcar "Filtrable"**: si no existe entrada, no hace nada. Si existe, quita **tanto**
  `filterable` **como** `filterPlaceholder` de esa entrada (el placeholder no sobrevive a
  desactivar el check, sin caché). Si tras quitarlas la entrada no tiene `sortable: true`, la
  entrada se elimina por completo del array; si sí lo tiene, se conserva sin `filterable` ni
  `filterPlaceholder`.
- **Editar "Placeholder del filtro"**: solo se invoca mientras `filterable` ya es `true` para esa
  columna (el campo no está montado si no). Si el texto es `''`, quita la clave `filterPlaceholder`
  de la entrada sin tocar `filterable` ni `sortable`. Si el texto no es `''`, fija
  `filterPlaceholder` a ese texto literal (sin trim ni validación adicional de formato). Si por
  cualquier motivo se invoca sin que exista entrada para ese `id`, no hace nada (no crea una entrada
  solo con `filterPlaceholder`, que sería un estado inválido según el contrato de `table.props.columns`
  — ver [[../../docs/app-features/nodes/table.md]]).
- Cualquier mutación que no encuentre nada que cambiar puede devolver el mismo array de entrada
  (no es necesario forzar una copia superficial cuando el resultado es idéntico), pero cuando sí hay
  cambio debe devolver siempre un array nuevo (sin mutar el array ni los objetos originales).

### Fuera de alcance
- Integrar el componente en el widget "Filas y columnas" (Manual: T2; Dinámico: T3).
- Cualquier cambio en `table.props.headers`, `table.props.rows` o en el resto de
  `TableRowsPropertyField`.
- Cualquier cambio en el contrato de validación (`src/config/validate-table-node.ts`) o en el tipo
  `TableColumnConfig` — ambos ya existen y cubren `sortable`/`filterable`/`filterPlaceholder`.

### Dependencias
Ninguna. Es la primera tarea de la feature.

### Interfaces
**Consume**: ninguno.

**Produce**:
- `TableColumnFlagsField(props: { id: string; columns: TableColumnConfig[] | undefined; onColumnsChange: (nextColumns: TableColumnConfig[] | undefined) => void }): JSX.Element` — consumido por: T2, T3.

### Impacto esperado en archivos
- Código: crear `src/dev-runtime/layout-canvas/property-fields/table-column-flags-field.tsx`
  (nuevo componente `TableColumnFlagsField`, más las funciones puras internas descritas arriba, no
  exportadas fuera del módulo salvo que el propio test unitario de la tarea las necesite
  directamente).
- Tests: crear `src/tests/dev-runtime/layout-canvas-property-field-table-column-flags.test.tsx`.
- Documentación: ninguna (componente aislado, todavía no visible en el editor real hasta T2/T3).

### Tests

**Ficheros de test**:
- `src/tests/dev-runtime/layout-canvas-property-field-table-column-flags.test.tsx` (nuevo)

**Comportamiento cubierto**:
- Con `columns: undefined` y ambos checks sin marcar, el componente renderiza "Ordenable" y
  "Filtrable" como `role="switch"` con `aria-checked="false"`, y no renderiza ningún campo
  "Placeholder del filtro".
- Marcar "Ordenable" sobre `columns: undefined` invoca `onColumnsChange` con
  `[{ id, sortable: true }]`.
- Marcar "Ordenable" sobre una columna que ya tiene `{ id, filterable: true }` invoca
  `onColumnsChange` con la misma entrada más `sortable: true`, sin alterar `filterable`.
- Desmarcar "Ordenable" sobre `{ id, sortable: true, filterable: true }` invoca `onColumnsChange`
  con `{ id, filterable: true }` (entrada conservada sin `sortable`).
- Desmarcar "Ordenable" sobre `{ id, sortable: true }` (sin `filterable`) invoca `onColumnsChange`
  eliminando la entrada por completo del array.
- Marcar "Filtrable" sobre `columns: undefined` invoca `onColumnsChange` con
  `[{ id, filterable: true }]`, y tras ese cambio (rerender con el nuevo `columns`) aparece el campo
  de texto "Placeholder del filtro" vacío.
- Escribir en "Placeholder del filtro" con `filterable: true` invoca `onColumnsChange` fijando
  `filterPlaceholder` con el texto escrito, sin alterar `sortable`/`filterable`.
- Desmarcar "Filtrable" sobre `{ id, filterable: true, filterPlaceholder: 'texto' , sortable: true }`
  invoca `onColumnsChange` con `{ id, sortable: true }` (sin `filterable` ni `filterPlaceholder`) y,
  tras el rerender, el campo "Placeholder del filtro" deja de mostrarse.
- Desmarcar "Filtrable" sobre `{ id, filterable: true, filterPlaceholder: 'texto' }` (sin
  `sortable`) invoca `onColumnsChange` eliminando la entrada por completo del array.
- Volver a marcar "Filtrable" tras haberlo desmarcado (nuevo `columns` pasado por props, sin
  `filterPlaceholder`) muestra el campo "Placeholder del filtro" vacío, no el texto anterior (el
  componente no cachea el texto en estado local propio; lee el valor del `columns` recibido).
- Vaciar el campo "Placeholder del filtro" (de un texto no vacío a `''`) invoca `onColumnsChange`
  quitando la clave `filterPlaceholder` de la entrada sin quitar `filterable`.
- El componente no renderiza ninguna caja con borde ni fondo alrededor de los dos checks ni del
  campo de placeholder (sin clases `border`/`bg-*` de contenedor en el nodo raíz o wrappers propios
  del widget).

**Comandos durante la implementación**:
```
pnpm test --run src/tests/dev-runtime/layout-canvas-property-field-table-column-flags.test.tsx
```

**Restricciones**:
- Reutilizar `BooleanPropertyField` (`src/dev-runtime/layout-canvas/property-fields/boolean-property-field.tsx`)
  para ambos checks y `TextPropertyField` (`.../text-property-field.tsx`) para el placeholder — no
  reimplementar el interruptor ni el input de texto.
- No añadir snapshots.

### Documentación afectada
`ai-workflow/docs/test-index.md`: añadir la línea del nuevo fichero de test
`layout-canvas-property-field-table-column-flags.test.tsx` en la sección `dev-runtime/`, junto al
resto de widgets aislados de `property-fields` (ver regla de mantenimiento "Actualizar al añadir,
dividir, mover o eliminar un fichero de test" y `ai-workflow/scripts/check-test-index.sh`).

### Criterios de finalización
El componente `TableColumnFlagsField` existe, es importable de forma aislada, cubre íntegramente la
lógica de alta/actualización/baja de una entrada de `columns[]` descrita arriba, y su test unitario
está en verde sin depender de `TableRowsPropertyField`.

### Cierre de implementación
Código y tests de esta tarea completos y validados (`pnpm test --run` del fichero de test de esta
tarea en verde).

---

## T2 — Integrar los checks en el modo Manual del widget "Filas y columnas"

### Objetivo
Añadir los controles "Ordenable"/"Filtrable"/"Placeholder del filtro" a cada entrada de la sección
"Columnas" del modo Manual de `TableRowsPropertyField`
(`src/dev-runtime/layout-canvas/property-fields/table-rows-property-field.tsx`), junto al input de
nombre de esa entrada ya existente (componente `HeaderCell`).

Cambios concretos:
- `HeaderCellProps` gana dos props nuevas: `columns: TableColumnConfig[] | undefined` y
  `onColumnsChange: (nextColumns: TableColumnConfig[] | undefined) => void`.
- El `id` que se pasa a `TableColumnFlagsField` dentro de `HeaderCell` es el `header` actual de esa
  entrada (el mismo valor ya usado como `id` en `renameColumnsEntry`/`removeColumnsEntry`), no el
  texto que el usuario esté tecleando sin confirmar en el input de nombre (ese input commitea solo
  al perder el foco, igual que hoy).
- El contenedor de cada entrada de columna dentro de la sección "Columnas" (el `<div key={...}
  className="flex items-end gap-2">` en `TableRowsPropertyField`) pasa a envolver dos bloques
  apilados verticalmente (`flex flex-col gap-2`, sin caja con borde ni fondo): la fila existente
  (`HeaderTextInput` + botón "Quitar columna", que conserva su disposición `items-end`) y, debajo,
  `TableColumnFlagsField` con `id={header}`.
- `TableRowsPropertyField` gana una función `commitColumnsChange(nextColumns: TableColumnConfig[] |
  undefined)` que aplica `onChange({ ...node, props: { ...node.props, columns: nextColumns } })`
  (mismo patrón que el resto de funciones `commit*` ya existentes en el fichero) y se pasa como
  `onColumnsChange` a cada `HeaderCell`, junto con `columns={node.props.columns}`.
- No se toca el modo Dinámico en esta tarea (eso es T3).

### Fuera de alcance
- Modo Dinámico del widget (T3).
- Cualquier cambio en `TableColumnFlagsField` (T1) más allá de consumirlo tal cual.
- Cualquier cambio en `commitHeaderRename`, `commitRemoveColumn` o `commitAddColumn` salvo pasar las
  dos props nuevas hacia `HeaderCell`.

### Dependencias
T1 (consume `TableColumnFlagsField`).

### Interfaces
**Consume**:
- `TableColumnFlagsField(props: { id: string; columns: TableColumnConfig[] | undefined; onColumnsChange: (nextColumns: TableColumnConfig[] | undefined) => void }): JSX.Element` (de T1)

**Produce**:
- `commitColumnsChange(nextColumns: TableColumnConfig[] | undefined): void` — consumido por: T3.

### Impacto esperado en archivos
- Código: modificar `src/dev-runtime/layout-canvas/property-fields/table-rows-property-field.tsx`
  (`HeaderCell`, `HeaderCellProps`, el bloque de render de la sección "Columnas" en modo Manual
  dentro de `TableRowsPropertyField`, nueva función `commitColumnsChange`).
- Tests: ampliar `src/tests/dev-runtime/layout-canvas-property-field-table-rows.test.tsx`.
- Documentación: revisar `ai-workflow/docs/app-features/development/dev-mode-editor.md`, sección
  "Selección de celdas-nodo y widget de filas/columnas de `table` (modo Editor)" (parte Manual).

### Tests

**Ficheros de test**:
- `src/tests/dev-runtime/layout-canvas-property-field-table-rows.test.tsx` (ampliación)

**Comportamiento cubierto**:
- En modo Manual, cada entrada de "Columnas" muestra los switches "Ordenable" y "Filtrable" junto a
  su input de nombre (`getByRole('switch', { name: /Ordenable/ })` /
  `getByRole('switch', { name: /Filtrable/ })` junto al input de esa fila de columna concreta,
  distinguiendo entre columnas por índice/nombre cuando el nodo tiene más de una).
- Marcar "Ordenable" en una columna del `node.props.columns` sin entrada previa dispara `onChange`
  con `props.columns` igual a `[{ id: header, sortable: true }]` (resto del nodo intacto).
- Marcar "Ordenable" en una columna que ya tenía `{ id: header, filterable: true }` en
  `node.props.columns` dispara `onChange` con esa misma entrada más `sortable: true`.
- Desmarcar "Ordenable" cuando la entrada no declara `filterable: true` dispara `onChange` sin esa
  entrada en `props.columns`.
- Marcar "Filtrable" hace aparecer el campo "Placeholder del filtro" vacío en esa misma entrada de
  columna, y escribir en él dispara `onChange` con `filterPlaceholder` fijado en esa entrada de
  `props.columns`.
- Desmarcar "Filtrable" oculta el campo "Placeholder del filtro" de esa entrada y dispara `onChange`
  sin `filterable` ni `filterPlaceholder` en esa entrada (conservando `sortable` si estaba
  marcado).
- Renombrar un header con una entrada de `columns[]` asociada (vía `commitHeaderRename`, ya
  existente) sigue sincronizando el `id` de la entrada sin alterar `sortable`/`filterable`/
  `filterPlaceholder` ya fijados — test de regresión sobre comportamiento heredado de 0138.
- Quitar una columna (vía `commitRemoveColumn`, ya existente) sigue eliminando su entrada completa
  de `columns[]`, incluidos `sortable`/`filterable`/`filterPlaceholder` — test de regresión.
- Ninguno de los dos switches ni el campo de placeholder introduce una caja con borde o fondo
  alrededor de la entrada de columna.

**Comandos durante la implementación**:
```
pnpm test --run src/tests/dev-runtime/layout-canvas-property-field-table-rows.test.tsx
```

**Restricciones**:
- No introducir un segundo commit por cambio: cada toggle o cada blur del placeholder debe producir
  exactamente una llamada a `onChange` del widget completo, igual que el resto de mutaciones ya
  existentes de `TableRowsPropertyField`.

### Documentación afectada
`ai-workflow/docs/app-features/development/dev-mode-editor.md` — sección "Selección de celdas-nodo y
widget de filas/columnas de `table` (modo Editor)", subsección de comportamiento del modo Manual del
widget.

### Criterios de finalización
En modo Manual, cada entrada de "Columnas" edita `sortable`/`filterable`/`filterPlaceholder` de su
columna a través del mismo pipeline de commit que el resto del widget, cumpliendo los criterios de
aceptación 1, 3, 4, 5, 6, 7, 8, 9, 11, 12 y 13 de `spec.md` en modo Manual, con los tests de la tarea
en verde.

### Cierre de implementación
Código y tests de esta tarea completos y validados (`pnpm test --run` del fichero de test de esta
tarea en verde, incluidas las regresiones de renombrado/borrado de columna).

---

## T3 — Integrar los checks en el modo Dinámico del widget "Filas y columnas"

### Objetivo
Añadir los mismos controles "Ordenable"/"Filtrable"/"Placeholder del filtro" a cada entrada de la
lista reordenable de columnas-plantilla del modo Dinámico de `TableRowsPropertyField`
(componente `DynamicColumnAccordionItem`), en el mismo lugar relativo que en modo Manual: justo
junto al input de nombre de esa columna (`HeaderTextInput`), dentro del cuerpo expandido del
acordeón de esa columna.

Cambios concretos:
- `DynamicColumnAccordionItemProps` gana las mismas dos props que T2 añadió a `HeaderCellProps`:
  `columns: TableColumnConfig[] | undefined` y
  `onColumnsChange: (nextColumns: TableColumnConfig[] | undefined) => void`.
- El `id` que se pasa a `TableColumnFlagsField` es el `header` de esa columna-plantilla (mismo
  criterio que T2).
- Dentro del bloque `!collapsed && (...)` de `DynamicColumnAccordionItem`, `TableColumnFlagsField`
  se renderiza inmediatamente después de `HeaderTextInput` y antes de `TableCellTypePropertyField`.
- `TableRowsPropertyField` pasa `columns={node.props.columns}` y `onColumnsChange={commitColumnsChange}`
  (la misma función que T2 ya añadió) a cada `DynamicColumnAccordionItem` en el bloque de render del
  modo Dinámico.

### Fuera de alcance
- Modo Manual del widget (ya cerrado en T2).
- Cualquier cambio en `TableColumnFlagsField` (T1) o en `commitColumnsChange` (T2) más allá de
  reutilizarlos tal cual.
- Cualquier cambio en `commitAddColumn`, `commitRemoveColumn`, `commitMove` o
  `moveDynamicColumnTemplate` salvo pasar las dos props nuevas hacia `DynamicColumnAccordionItem`.

### Dependencias
T1 (consume `TableColumnFlagsField`) y T2 (reutiliza `commitColumnsChange`, ya añadida a
`TableRowsPropertyField`, y su misma sección "Columnas" del fichero).

### Interfaces
**Consume**:
- `TableColumnFlagsField(props: { id: string; columns: TableColumnConfig[] | undefined; onColumnsChange: (nextColumns: TableColumnConfig[] | undefined) => void }): JSX.Element` (de T1)
- `commitColumnsChange(nextColumns: TableColumnConfig[] | undefined): void` (de T2)

**Produce**: ninguno.

### Impacto esperado en archivos
- Código: modificar `src/dev-runtime/layout-canvas/property-fields/table-rows-property-field.tsx`
  (`DynamicColumnAccordionItem`, `DynamicColumnAccordionItemProps`, el bloque de render de la
  sección "Columnas" en modo Dinámico dentro de `TableRowsPropertyField`).
- Tests: ampliar `src/tests/dev-runtime/layout-canvas-property-field-table-rows.test.tsx`.
- Documentación: revisar `ai-workflow/docs/app-features/development/dev-mode-editor.md`, sección
  "Selección de celdas-nodo y widget de filas/columnas de `table` (modo Editor)" (parte Dinámico).

### Tests

**Ficheros de test**:
- `src/tests/dev-runtime/layout-canvas-property-field-table-rows.test.tsx` (ampliación)

**Comportamiento cubierto**:
- En modo Dinámico, cada entrada de la lista de columnas-plantilla expandida muestra los switches
  "Ordenable" y "Filtrable" junto a su input de cabecera.
- Marcar "Ordenable" en una columna-plantilla del `node.props.columns` sin entrada previa dispara
  `onChange` con `props.columns` igual a `[{ id: header, sortable: true }]`, sin alterar
  `props.headers` ni `props.rows`.
- Marcar "Filtrable" hace aparecer el campo "Placeholder del filtro" vacío en esa misma entrada de
  columna-plantilla, y escribir en él dispara `onChange` con `filterPlaceholder` fijado en la
  entrada correspondiente de `props.columns`.
- Desmarcar "Filtrable" sobre una entrada con `sortable: true` conserva `sortable` en `props.columns`
  y quita `filterable`/`filterPlaceholder`; si la entrada no tenía `sortable: true`, la entrada
  desaparece por completo de `props.columns`.
- Renombrar el header de una columna-plantilla con entrada en `columns[]` asociada sigue
  sincronizando su `id` sin alterar `sortable`/`filterable`/`filterPlaceholder` — test de regresión.
- Quitar una columna-plantilla sigue eliminando su entrada completa de `columns[]` — test de
  regresión.
- Ninguno de los dos switches ni el campo de placeholder introduce una caja con borde o fondo
  adicional dentro del cuerpo expandido del acordeón de la columna-plantilla.

**Comandos durante la implementación**:
```
pnpm test --run src/tests/dev-runtime/layout-canvas-property-field-table-rows.test.tsx
```

**Restricciones**:
- Igual que T2: un toggle o un blur del placeholder debe producir exactamente una llamada a
  `onChange` del widget completo.

### Documentación afectada
`ai-workflow/docs/app-features/development/dev-mode-editor.md` — sección "Selección de celdas-nodo y
widget de filas/columnas de `table` (modo Editor)", subsección de comportamiento del modo Dinámico
del widget.

### Criterios de finalización
En modo Dinámico, cada entrada de la lista de columnas-plantilla edita
`sortable`/`filterable`/`filterPlaceholder` de su columna a través del mismo pipeline de commit que
el resto del widget, cumpliendo los criterios de aceptación 2, 3, 4, 5, 6, 7, 8, 9, 11, 12 y 13 de
`spec.md` en modo Dinámico, con los tests de la tarea en verde. Con el cierre de esta tarea, la
feature completa queda implementada.

### Cierre de implementación
Código y tests de esta tarea completos y validados (`pnpm test --run` del fichero de test de esta
tarea en verde, incluidas las regresiones de renombrado/borrado de columna-plantilla, y `pnpm test`
completo del proyecto en verde manteniendo el umbral de cobertura del 80% sobre `src/`).
