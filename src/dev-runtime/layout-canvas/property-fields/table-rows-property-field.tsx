import { useId, useState } from 'react'
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import type {
  TableCellValue,
  TableColumnConfig,
  TableDynamicRows,
  TableLayoutNode,
  TableManualRows,
  TableRows,
} from '../../../config/runtime-config'
import { EMPTY_DYNAMIC_TABLE_CELL_TEXT_VALUE, EMPTY_TABLE_CELL_TEXT_VALUE } from '../layout-canvas-node-palette-defaults'
import type { SegmentedToggleOption } from './segmented-toggle-property-field'
import { SegmentedTogglePropertyField } from './segmented-toggle-property-field'
import { CELL_TYPE_LABELS, TableCellTypePropertyField, type TableCellType } from './table-cell-type-property-field'
import { TextPropertyField } from './text-property-field'

// The two mutually exclusive shapes `table.props.rows` can take (spec section 3, design.md D5):
// "Manual" (an array of rows, each row an array of cells) or "Dinámico" (`{ source, cells }`,
// a single template row bound to a collection). No other shape is part of the contract.
type TableRowsMode = 'manual' | 'dynamic'

const MODE_SEGMENTS: ReadonlyArray<SegmentedToggleOption> = [
  { value: 'manual', label: 'Manual' },
  { value: 'dynamic', label: 'Dinámico' },
]

const MODE_TOGGLE_LABEL = 'Modo de filas'

// Same placeholder query name `buildDefaultNodeInstance('repeater')` seeds for `props.items.source`
// (T5, 0138): only the shape is checked at validation time, never that the query actually exists,
// so this keeps a freshly-reconstructed dynamic table minimally valid without depending on any
// real query being wired up.
const PLACEHOLDER_DYNAMIC_ROWS_SOURCE = 'queries.placeholderQuery.data'

function detectMode(rows: TableRows): TableRowsMode {
  return Array.isArray(rows) ? 'manual' : 'dynamic'
}

// "Manual" -> "Dinámico": drop every row, seed `{ source: <placeholder>, cells }` with one
// EMPTY_DYNAMIC_TABLE_CELL_TEXT_VALUE per existing header. `headers`/`columns` survive untouched.
function toDynamicRowsMode(node: TableLayoutNode): TableLayoutNode {
  const cells = node.props.headers.map(() => EMPTY_DYNAMIC_TABLE_CELL_TEXT_VALUE)
  return { ...node, props: { ...node.props, rows: { source: PLACEHOLDER_DYNAMIC_ROWS_SOURCE, cells } } }
}

// "Dinámico" -> "Manual": drop the source/template row, seed `rows: []` (no rows — a valid empty
// state, see "Casos límite" in the spec). `headers`/`columns` survive untouched.
function toManualRowsMode(node: TableLayoutNode): TableLayoutNode {
  return { ...node, props: { ...node.props, rows: [] } }
}

function renameColumnsEntry(columns: TableColumnConfig[] | undefined, oldHeader: string, newHeader: string): TableColumnConfig[] | undefined {
  if (!columns) return columns
  return columns.map((column) => (column.id === oldHeader ? { ...column, id: newHeader } : column))
}

function removeColumnsEntry(columns: TableColumnConfig[] | undefined, removedHeader: string): TableColumnConfig[] | undefined {
  if (!columns) return columns
  return columns.filter((column) => column.id !== removedHeader)
}

// A primitive cell is always "Texto" — mirrors `detectCellType` in `table-cell-type-property-field.tsx`
// without importing it: only `CELL_TYPE_LABELS`/`TableCellType` are exported from there (Paso 0),
// and this detection itself is a two-line check, not worth promoting to a shared export.
function detectCellType(value: TableCellValue): TableCellType {
  if (typeof value !== 'object') return 'text'
  return value.type
}

function moveArrayItem<T>(list: readonly T[], fromIndex: number, toIndex: number): T[] {
  const next = list.slice()
  const [moved] = next.splice(fromIndex, 1)
  next.splice(toIndex, 0, moved)
  return next
}

// Moves the same position in `headers` and `rows.cells` in a single operation — moving one array
// without the other would break the positional correspondence `validateTableDynamicRows` requires
// (design.md D5, "Riesgos y trade-offs"). `columns[]` never needs touching: it references headers
// by `id`, not by position.
function moveDynamicColumnTemplate(node: TableLayoutNode, fromIndex: number, toIndex: number): TableLayoutNode {
  const dynamicRows = node.props.rows as TableDynamicRows
  return {
    ...node,
    props: {
      ...node.props,
      headers: moveArrayItem(node.props.headers, fromIndex, toIndex),
      rows: { ...dynamicRows, cells: moveArrayItem(dynamicRows.cells, fromIndex, toIndex) },
    },
  }
}

// Resolves a drag-end event against the `item-{index}`/`gap-{index}` id scheme shared by both
// reorderable accordion lists (rows in Manual mode, column-templates in Dinámico — never mounted
// at the same time). Returns `null` when the event doesn't resolve to an actual move: dropped
// outside a gap zone, or over the gap adjacent to the dragged item itself — same index-adjustment
// criterion as `resolveGapIndexAfterRemoval` in `shell-tree-mutations.ts`, adapted to a flat list
// with no removal step.
function resolveDragMove(event: DragEndEvent): { fromIndex: number; toIndex: number } | null {
  if (event.over === null) return null
  const activeId = String(event.active.id)
  const overId = String(event.over.id)
  if (!activeId.startsWith('item-') || !overId.startsWith('gap-')) return null
  const fromIndex = Number(activeId.split('-')[1])
  const gapIndex = Number(overId.split('-')[1])
  const toIndex = gapIndex > fromIndex ? gapIndex - 1 : gapIndex
  if (toIndex === fromIndex) return null
  return { fromIndex, toIndex }
}

export interface TableRowsPropertyFieldProps {
  label: string
  node: TableLayoutNode
  onChange: (node: TableLayoutNode) => void
}

/**
 * Dedicated widget for the `table` node's rows/columns/cells structure (T8, 0138 — rewritten
 * post-implementation per design.md D5's revision). Same full-node write scope as
 * `ContainerColumnsModePropertyField`/`LinkContentModePropertyField` (D4) — the panel wires this
 * widget's `onChange` to the wider full-node commit path, not the generic per-subsection `props`
 * patch.
 *
 * Stacked sections replace the original `role="grid"` disposition, which the user found unworkable
 * at the properties panel's ~370px width. No bordered box around the widget or its sections (spec
 * section 6/criterio 16); section headers are plain small uppercase gray text. Manual mode: a
 * "Columnas" header list (add/rename/remove, no reorder — `headers` is shared across rows) followed
 * by a reorderable accordion list of rows. Dinámico mode (design.md D5 revisión 2): no separate
 * "Columnas" list — `headers` and the column-template cells have a 1:1 correspondence in this mode,
 * so the reorderable accordion list of columns (also titled "Columnas") is the single surface for
 * add/remove/rename/reorder/cell-type, followed by "Origen".
 */
export function TableRowsPropertyField({ label, node, onChange }: TableRowsPropertyFieldProps) {
  const mode = detectMode(node.props.rows)
  const isManualTableMode = mode === 'manual'
  const emptyTextValueForMode = isManualTableMode ? EMPTY_TABLE_CELL_TEXT_VALUE : EMPTY_DYNAMIC_TABLE_CELL_TEXT_VALUE
  // Keyed by list index, not row/column-template identity — an index that becomes "misaligned"
  // after a removal or reorder is an accepted simplification (design.md D5), the same one already
  // accepted for this state resetting wholesale on tab/node change.
  const [expandedIndexes, setExpandedIndexes] = useState<Set<number>>(new Set())
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  function toggleExpanded(index: number) {
    setExpandedIndexes((prev) => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  function handleModeChange(nextMode: string | number) {
    if (nextMode === mode) return
    onChange(nextMode === 'dynamic' ? toDynamicRowsMode(node) : toManualRowsMode(node))
  }

  function commitHeaderRename(index: number, newHeader: string) {
    const oldHeader = node.props.headers[index]
    if (newHeader === oldHeader) return
    const nextHeaders = node.props.headers.slice()
    nextHeaders[index] = newHeader
    onChange({
      ...node,
      props: { ...node.props, headers: nextHeaders, columns: renameColumnsEntry(node.props.columns, oldHeader, newHeader) },
    })
  }

  function commitRemoveColumn(index: number) {
    if (node.props.headers.length === 1) return
    const removedHeader = node.props.headers[index]
    const nextHeaders = node.props.headers.filter((_, headerIndex) => headerIndex !== index)
    const nextColumns = removeColumnsEntry(node.props.columns, removedHeader)
    const nextRows: TableRows = isManualTableMode
      ? (node.props.rows as TableManualRows).map((row) => row.filter((_, cellIndex) => cellIndex !== index))
      : { ...(node.props.rows as TableDynamicRows), cells: (node.props.rows as TableDynamicRows).cells.filter((_, cellIndex) => cellIndex !== index) }
    onChange({ ...node, props: { ...node.props, headers: nextHeaders, columns: nextColumns, rows: nextRows } })
  }

  function commitAddColumn() {
    const nextHeaders = [...node.props.headers, `Columna ${node.props.headers.length + 1}`]
    const nextRows: TableRows = isManualTableMode
      ? (node.props.rows as TableManualRows).map((row) => [...row, emptyTextValueForMode])
      : { ...(node.props.rows as TableDynamicRows), cells: [...(node.props.rows as TableDynamicRows).cells, emptyTextValueForMode] }
    onChange({ ...node, props: { ...node.props, headers: nextHeaders, rows: nextRows } })
  }

  function commitManualCellChange(rowIndex: number, cellIndex: number, nextValue: TableManualRows[number][number]) {
    const rows = node.props.rows as TableManualRows
    const nextRows = rows.map((row, currentRowIndex) =>
      currentRowIndex === rowIndex ? row.map((cell, currentCellIndex) => (currentCellIndex === cellIndex ? nextValue : cell)) : row,
    )
    onChange({ ...node, props: { ...node.props, rows: nextRows } })
  }

  function commitAddRow() {
    const rows = node.props.rows as TableManualRows
    const newRow = node.props.headers.map(() => emptyTextValueForMode)
    const newIndex = rows.length
    onChange({ ...node, props: { ...node.props, rows: [...rows, newRow] } })
    setExpandedIndexes((prev) => new Set(prev).add(newIndex))
  }

  function commitRemoveRow(rowIndex: number) {
    const rows = node.props.rows as TableManualRows
    onChange({ ...node, props: { ...node.props, rows: rows.filter((_, currentRowIndex) => currentRowIndex !== rowIndex) } })
  }

  function commitDynamicCellChange(cellIndex: number, nextValue: TableDynamicRows['cells'][number]) {
    const dynamicRows = node.props.rows as TableDynamicRows
    const nextCells = dynamicRows.cells.map((cell, currentCellIndex) => (currentCellIndex === cellIndex ? nextValue : cell))
    onChange({ ...node, props: { ...node.props, rows: { ...dynamicRows, cells: nextCells } } })
  }

  function commitSourceChange(nextSource: string) {
    const dynamicRows = node.props.rows as TableDynamicRows
    onChange({ ...node, props: { ...node.props, rows: { ...dynamicRows, source: nextSource } } })
  }

  function commitMove(fromIndex: number, toIndex: number) {
    if (isManualTableMode) {
      onChange({ ...node, props: { ...node.props, rows: moveArrayItem(node.props.rows as TableManualRows, fromIndex, toIndex) } })
      return
    }
    onChange(moveDynamicColumnTemplate(node, fromIndex, toIndex))
  }

  function handleDragEnd(event: DragEndEvent) {
    const move = resolveDragMove(event)
    if (move === null) return
    commitMove(move.fromIndex, move.toIndex)
  }

  const manualRows = isManualTableMode ? (node.props.rows as TableManualRows) : null
  const dynamicRows = !isManualTableMode ? (node.props.rows as TableDynamicRows) : null

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="pt-2 text-[11px] font-medium uppercase tracking-wide text-gray-500">{label}</legend>
      <SegmentedTogglePropertyField label={MODE_TOGGLE_LABEL} segments={MODE_SEGMENTS} activeValue={mode} onSelect={handleModeChange} />

      {isManualTableMode && (
        <div className="flex flex-col gap-2">
          <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Columnas</p>
          {node.props.headers.map((header, index) => (
            <div key={`${index}-${header}`} className="flex items-end gap-2">
              <HeaderCell
                index={index}
                header={header}
                canRemove={node.props.headers.length > 1}
                onRename={(nextHeader) => commitHeaderRename(index, nextHeader)}
                onRemove={() => commitRemoveColumn(index)}
              />
            </div>
          ))}
          <button
            type="button"
            onClick={commitAddColumn}
            className="self-start rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100"
          >
            Añadir columna
          </button>
        </div>
      )}

      {isManualTableMode && manualRows && (
        <div className="flex flex-col gap-2">
          <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Filas</p>
          {manualRows.length === 0 ? (
            <p className="text-xs text-gray-500">Sin filas.</p>
          ) : (
            <DndContext id="table-rows-reorder" sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <div className="flex flex-col gap-2">
                <ReorderGapZone index={0} />
                {manualRows.map((row, index) => (
                  <div key={index} className="flex flex-col gap-2">
                    <ManualRowAccordionItem
                      index={index}
                      row={row}
                      headers={node.props.headers}
                      length={manualRows.length}
                      collapsed={!expandedIndexes.has(index)}
                      onToggle={() => toggleExpanded(index)}
                      onMoveUp={() => commitMove(index, index - 1)}
                      onMoveDown={() => commitMove(index, index + 1)}
                      onRemove={() => commitRemoveRow(index)}
                      onCellChange={(cellIndex, nextValue) => commitManualCellChange(index, cellIndex, nextValue)}
                    />
                    <ReorderGapZone index={index + 1} />
                  </div>
                ))}
              </div>
            </DndContext>
          )}
          <button
            type="button"
            onClick={commitAddRow}
            className="self-start rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100"
          >
            Añadir fila
          </button>
        </div>
      )}

      {!isManualTableMode && dynamicRows && (
        <>
          <div className="flex flex-col gap-2">
            <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Columnas</p>
            <DndContext id="table-rows-reorder" sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <div className="flex flex-col gap-2">
                <ReorderGapZone index={0} />
                {node.props.headers.map((header, index) => (
                  <div key={index} className="flex flex-col gap-2">
                    <DynamicColumnAccordionItem
                      index={index}
                      header={header}
                      cell={dynamicRows.cells[index]}
                      length={node.props.headers.length}
                      canRemove={node.props.headers.length > 1}
                      collapsed={!expandedIndexes.has(index)}
                      onToggle={() => toggleExpanded(index)}
                      onMoveUp={() => commitMove(index, index - 1)}
                      onMoveDown={() => commitMove(index, index + 1)}
                      onHeaderRename={(nextHeader) => commitHeaderRename(index, nextHeader)}
                      onCellChange={(nextValue) => commitDynamicCellChange(index, nextValue)}
                      onRemove={() => commitRemoveColumn(index)}
                    />
                    <ReorderGapZone index={index + 1} />
                  </div>
                ))}
              </div>
            </DndContext>
            <button
              type="button"
              onClick={commitAddColumn}
              className="self-start rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100"
            >
              Añadir columna
            </button>
          </div>
          <TextPropertyField label="Origen" value={dynamicRows.source} onChange={commitSourceChange} />
        </>
      )}
    </fieldset>
  )
}

function ReorderGapZone({ index }: { index: number }) {
  const { setNodeRef } = useDroppable({ id: `gap-${index}` })
  return <div ref={setNodeRef} aria-hidden="true" className="h-1" />
}

interface HeaderTextInputProps {
  labelText: string
  header: string
  onRename: (nextHeader: string) => void
}

// Uncontrolled text input (`defaultValue`), committed on blur only when the value actually
// changed (spec: "Al perder el foco, si el valor cambió, commitea"). Callers key this component by
// something that changes together with `header` (e.g. `${index}-${header}`) so a committed rename
// remounts it with a fresh `defaultValue` matching the new header — no local resync logic needed
// here. Shared by `HeaderCell` (Columnas section) and the Dinámico column-template accordion item,
// so both call sites reuse the exact same input behaviour around `commitHeaderRename`.
function HeaderTextInput({ labelText, header, onRename }: HeaderTextInputProps) {
  const inputId = useId()

  return (
    <div className="flex flex-1 flex-col gap-1">
      <label htmlFor={inputId} className="text-xs font-medium text-gray-700">{labelText}</label>
      <input
        id={inputId}
        type="text"
        defaultValue={header}
        onBlur={(event) => onRename(event.target.value)}
        className="w-full rounded-md border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900 focus:border-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-400"
      />
    </div>
  )
}

interface HeaderCellProps {
  index: number
  header: string
  canRemove: boolean
  onRename: (nextHeader: string) => void
  onRemove: () => void
}

// Columns section row: no reordering (D5 excludes it explicitly — reordering a manual column would
// move the same position in `headers` **and** every row simultaneously, a larger-surface mutation
// not motivated by any described use case).
function HeaderCell({ index, header, canRemove, onRename, onRemove }: HeaderCellProps) {
  return (
    <>
      <HeaderTextInput labelText={`Cabecera ${index + 1}`} header={header} onRename={onRename} />
      <button
        type="button"
        onClick={onRemove}
        disabled={!canRemove}
        aria-label={`Quitar columna ${header}`}
        className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Quitar columna
      </button>
    </>
  )
}

interface ReorderMoveButtonsProps {
  index: number
  length: number
  itemNoun: string
  onMoveUp: () => void
  onMoveDown: () => void
}

// Keyboard fallback for reordering (no surface in the project implements `KeyboardSensor` today,
// design.md D5): same mutation as the drag gesture, driven by plain buttons instead.
function ReorderMoveButtons({ index, length, itemNoun, onMoveUp, onMoveDown }: ReorderMoveButtonsProps) {
  return (
    <>
      <button
        type="button"
        onClick={onMoveUp}
        disabled={index === 0}
        aria-label={`Subir ${itemNoun} ${index + 1}`}
        className="shrink-0 rounded border border-gray-300 px-1.5 py-1 text-xs text-gray-500 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
      >
        ↑
      </button>
      <button
        type="button"
        onClick={onMoveDown}
        disabled={index === length - 1}
        aria-label={`Bajar ${itemNoun} ${index + 1}`}
        className="shrink-0 rounded border border-gray-300 px-1.5 py-1 text-xs text-gray-500 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
      >
        ↓
      </button>
    </>
  )
}

interface ManualRowAccordionItemProps {
  index: number
  row: TableManualRows[number]
  headers: string[]
  length: number
  collapsed: boolean
  onToggle: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  onRemove: () => void
  onCellChange: (cellIndex: number, nextValue: TableManualRows[number][number]) => void
}

/**
 * One row of Manual mode's reorderable accordion list (T8, 0138 D5 revision). Collapsed by
 * default (`expandedIndexes` state lives in the parent). Shows a preview of `row[0]` only when
 * that cell holds a text value — a node-cell preview would need its own subtree summary, and
 * editing a node cell happens on the canvas (spec section 2), not here.
 */
function ManualRowAccordionItem({ index, row, headers, length, collapsed, onToggle, onMoveUp, onMoveDown, onRemove, onCellChange }: ManualRowAccordionItemProps) {
  const { setNodeRef, setActivatorNodeRef, attributes, listeners } = useDraggable({ id: `item-${index}` })
  const firstCell = row[0]
  const preview = typeof firstCell !== 'object' ? String(firstCell) : null

  return (
    <div ref={setNodeRef} className="flex flex-col gap-2 rounded border border-gray-200 p-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          aria-label={`Reordenar fila ${index + 1}`}
          className="shrink-0 cursor-grab rounded border border-gray-300 px-1.5 py-1 text-xs text-gray-500 hover:bg-gray-100"
        >
          ⠿
        </button>
        <ReorderMoveButtons index={index} length={length} itemNoun="fila" onMoveUp={onMoveUp} onMoveDown={onMoveDown} />
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={!collapsed}
          aria-label={`${collapsed ? 'Expandir' : 'Colapsar'} fila ${index + 1}`}
          className="flex min-w-0 flex-1 items-center gap-2 truncate rounded border border-gray-300 px-2 py-1 text-left text-xs text-gray-700 hover:bg-gray-100"
        >
          <span>{`Fila ${index + 1}`}</span>
          {preview !== null && <span className="truncate text-gray-500">{preview}</span>}
        </button>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Quitar fila ${index + 1}`}
          className="shrink-0 rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100"
        >
          Quitar fila
        </button>
      </div>
      {!collapsed && (
        <div className="flex flex-col gap-2 pl-6">
          {headers.map((header, cellIndex) => (
            <TableCellTypePropertyField
              key={cellIndex}
              label={`${header} — fila ${index + 1}`}
              value={row[cellIndex]}
              emptyTextValue={EMPTY_TABLE_CELL_TEXT_VALUE}
              onChange={(nextValue) => onCellChange(cellIndex, nextValue)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

interface DynamicColumnAccordionItemProps {
  index: number
  header: string
  cell: TableDynamicRows['cells'][number]
  length: number
  canRemove: boolean
  collapsed: boolean
  onToggle: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  onHeaderRename: (nextHeader: string) => void
  onCellChange: (nextValue: TableDynamicRows['cells'][number]) => void
  onRemove: () => void
}

/**
 * One column of Dinámico mode's reorderable accordion list — the only column-management surface
 * in this mode (design.md D5 revisión 2: the top "Columnas" header list, which used to duplicate
 * this item's rename control, is dropped in dynamic mode). Expanding it shows a header rename
 * input alongside the cell-type editor for its template cell; collapsed, it also exposes "Quitar
 * columna" (same `commitRemoveColumn` the top section used to own) next to "Añadir columna" at the
 * end of the list (rendered by the parent).
 */
function DynamicColumnAccordionItem({ index, header, cell, length, canRemove, collapsed, onToggle, onMoveUp, onMoveDown, onHeaderRename, onCellChange, onRemove }: DynamicColumnAccordionItemProps) {
  const { setNodeRef, setActivatorNodeRef, attributes, listeners } = useDraggable({ id: `item-${index}` })
  const cellType = detectCellType(cell)

  return (
    <div ref={setNodeRef} className="flex flex-col gap-2 rounded border border-gray-200 p-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          aria-label={`Reordenar columna ${index + 1}`}
          className="shrink-0 cursor-grab rounded border border-gray-300 px-1.5 py-1 text-xs text-gray-500 hover:bg-gray-100"
        >
          ⠿
        </button>
        <ReorderMoveButtons index={index} length={length} itemNoun="columna" onMoveUp={onMoveUp} onMoveDown={onMoveDown} />
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={!collapsed}
          aria-label={`${collapsed ? 'Expandir' : 'Colapsar'} columna ${index + 1}`}
          className="flex min-w-0 flex-1 items-center gap-2 truncate rounded border border-gray-300 px-2 py-1 text-left text-xs text-gray-700 hover:bg-gray-100"
        >
          <span className="truncate">{header}</span>
          <span className="shrink-0 rounded bg-gray-100 px-1 text-[10px] uppercase text-gray-600">{CELL_TYPE_LABELS[cellType]}</span>
        </button>
        <button
          type="button"
          onClick={onRemove}
          disabled={!canRemove}
          aria-label={`Quitar columna ${index + 1}`}
          className="shrink-0 rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Quitar columna
        </button>
      </div>
      {!collapsed && (
        <div className="flex flex-col gap-2 pl-6">
          <HeaderTextInput
            key={`${index}-${header}`}
            labelText={`Cabecera de columna ${index + 1}`}
            header={header}
            onRename={onHeaderRename}
          />
          <TableCellTypePropertyField
            label={`${header} — plantilla`}
            value={cell}
            emptyTextValue={EMPTY_DYNAMIC_TABLE_CELL_TEXT_VALUE}
            onChange={(nextValue) => onCellChange(nextValue as TableDynamicRows['cells'][number])}
          />
        </div>
      )}
    </div>
  )
}
