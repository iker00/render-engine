import type { TableCellNode, TableCellValue } from '../../../config/runtime-config'
import { tableCellAllowedNodeTypes } from '../../../config/runtime-config-zod'
import { buildDefaultNodeInstance } from '../layout-canvas-node-palette-defaults'
import { CELL_TYPE_LABELS } from './table-cell-type-labels'
import { EnumPropertyField } from './enum-property-field'
import { TextPropertyField } from './text-property-field'

// "Texto" plus the 7 node types a table cell may hold (T6, `tableCellAllowedNodeTypes`), single
// catalog source — no parallel list. `TableCellType` mirrors `TableCellNode['type']` plus the
// literal `'text'` sentinel for a primitive cell.
export type TableCellType = 'text' | (typeof tableCellAllowedNodeTypes)[number]

const TEXT_TYPE = 'text' as const

const CELL_TYPE_OPTIONS: TableCellType[] = [TEXT_TYPE, ...tableCellAllowedNodeTypes]

// A primitive cell (`string`/`number`/`boolean`) is always "Texto"; a node cell uses its own
// `type`.
function detectCellType(value: TableCellValue): TableCellType {
  if (typeof value !== 'object') return TEXT_TYPE
  return value.type
}

export interface TableCellTypePropertyFieldProps {
  label: string
  value: TableCellValue
  // Literal committed when choosing "Texto" — mode-dependent (manual `''` vs dynamic `'—'`,
  // T5), so the caller (T8) supplies it explicitly per cell context. This component never
  // hardcodes its own literal.
  emptyTextValue: string
  onChange: (value: TableCellValue) => void
}

/**
 * Cell-type selector for a table cell (T7, design.md D5): a dropdown — not segmented, the
 * catalog has 8 options, above `SegmentedTogglePropertyField`'s 2-5 range — listing "Texto" plus
 * the 7 node types a cell may hold. Same visual/interaction pattern as the action variant
 * selector (`DiscriminatedUnionPropertyField`)/`LinkContentModePropertyField`: fieldset + single
 * dropdown, reconstruct-from-scratch on change. Not registered in `WIDGET_REGISTRY` — consumed
 * directly by T8, the same way `EnumPropertyField`/`SegmentedTogglePropertyField` are consumed
 * directly by other dedicated widgets in this directory.
 *
 * Choosing "Texto" commits `emptyTextValue` as-is; choosing a node type commits
 * `buildDefaultNodeInstance(type)` — no field from the previous type survives. While the active
 * type is "Texto", a `TextPropertyField` below the dropdown edits the literal directly; it is
 * absent for any node type (editing a node cell happens by selecting it on the canvas, T3 — not
 * here, spec section 2).
 */
export function TableCellTypePropertyField({ label, value, emptyTextValue, onChange }: TableCellTypePropertyFieldProps) {
  const activeType = detectCellType(value)

  function handleTypeChange(nextValue: string | number) {
    const nextType = nextValue as TableCellType
    if (nextType === activeType) return
    if (nextType === TEXT_TYPE) {
      onChange(emptyTextValue)
      return
    }
    // `nextType` here is constrained to `tableCellAllowedNodeTypes`, whose literals are exactly
    // `TableCellNode`'s variants — narrower than `buildDefaultNodeInstance`'s generic `LayoutNode`
    // return type, so the cast is safe by construction.
    onChange(buildDefaultNodeInstance(nextType) as TableCellNode)
  }

  function handleTextChange(nextText: string) {
    onChange(nextText)
  }

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="pt-2 text-[11px] font-medium uppercase tracking-wide text-gray-500">{label}</legend>
      <EnumPropertyField label={label} value={activeType} options={CELL_TYPE_OPTIONS} optionLabels={CELL_TYPE_LABELS} onChange={handleTypeChange} />
      {activeType === TEXT_TYPE && <TextPropertyField label="Texto" value={typeof value === 'string' ? value : String(value)} onChange={handleTextChange} />}
    </fieldset>
  )
}
