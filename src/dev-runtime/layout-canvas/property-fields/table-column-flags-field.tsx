import type { TableColumnConfig } from '../../../config/runtime-config'
import { BooleanPropertyField } from './boolean-property-field'
import { TextPropertyField } from './text-property-field'

function findColumnEntry(columns: TableColumnConfig[] | undefined, id: string): TableColumnConfig | undefined {
  return columns?.find((column) => column.id === id)
}

// Replaces the entry matching `id` with `nextEntry`, or drops it entirely when `nextEntry` is
// `null`. Always returns a fresh array (never mutates `columns` or its entries).
function replaceOrRemoveEntry(
  columns: TableColumnConfig[] | undefined,
  id: string,
  nextEntry: TableColumnConfig | null,
): TableColumnConfig[] {
  const base = columns ?? []
  if (nextEntry === null) return base.filter((column) => column.id !== id)
  return base.map((column) => (column.id === id ? nextEntry : column))
}

// `sortable`/`filterable` are `true | undefined` in the contract (never `false`) — turning a flag
// off always means deleting the key, not writing `false`.
function setColumnSortable(columns: TableColumnConfig[] | undefined, id: string, sortable: boolean): TableColumnConfig[] | undefined {
  const entry = findColumnEntry(columns, id)
  if (!entry) {
    if (!sortable) return columns
    return [...(columns ?? []), { id, sortable: true }]
  }
  if (sortable) return replaceOrRemoveEntry(columns, id, { ...entry, sortable: true })
  const { sortable: _sortable, ...rest } = entry
  return replaceOrRemoveEntry(columns, id, rest.filterable ? rest : null)
}

// Turning `filterable` off also drops `filterPlaceholder` — it never survives without the check
// (no caching of the previous text).
function setColumnFilterable(columns: TableColumnConfig[] | undefined, id: string, filterable: boolean): TableColumnConfig[] | undefined {
  const entry = findColumnEntry(columns, id)
  if (!entry) {
    if (!filterable) return columns
    return [...(columns ?? []), { id, filterable: true }]
  }
  if (filterable) return replaceOrRemoveEntry(columns, id, { ...entry, filterable: true })
  const { filterable: _filterable, filterPlaceholder: _filterPlaceholder, ...rest } = entry
  return replaceOrRemoveEntry(columns, id, rest.sortable ? rest : null)
}

// Only invoked while `filterable` is already `true` for this column (the field isn't mounted
// otherwise). If there's no entry for `id`, does nothing — never creates a `filterPlaceholder`-only
// entry, which would be an invalid shape.
function setColumnFilterPlaceholder(columns: TableColumnConfig[] | undefined, id: string, text: string): TableColumnConfig[] | undefined {
  const entry = findColumnEntry(columns, id)
  if (!entry) return columns
  if (text === '') {
    const { filterPlaceholder: _filterPlaceholder, ...rest } = entry
    return replaceOrRemoveEntry(columns, id, rest)
  }
  return replaceOrRemoveEntry(columns, id, { ...entry, filterPlaceholder: text })
}

export interface TableColumnFlagsFieldProps {
  id: string
  columns: TableColumnConfig[] | undefined
  onColumnsChange: (nextColumns: TableColumnConfig[] | undefined) => void
}

/**
 * Reusable "Ordenable"/"Filtrable" pair for one `table` column (identified by its header `id`),
 * plus the conditional "Placeholder del filtro" text field, all wired to `table.props.columns[]`
 * (T1, dev-editor-table-column-filter-sort-toggles). Reads the current entry (if any) straight
 * from `columns` on every render — no local caching of `filterPlaceholder`, so re-enabling
 * "Filtrable" after disabling it always starts from an empty placeholder.
 *
 * Standalone widget, not yet wired into `TableRowsPropertyField` (T2/T3 integrate Manual and
 * Dinámico modes respectively).
 */
export function TableColumnFlagsField({ id, columns, onColumnsChange }: TableColumnFlagsFieldProps) {
  const entry = findColumnEntry(columns, id)
  const sortable = entry?.sortable === true
  const filterable = entry?.filterable === true
  const filterPlaceholder = entry?.filterPlaceholder ?? ''

  return (
    <div className="flex flex-col gap-2">
      <BooleanPropertyField
        label="Ordenable"
        value={sortable}
        onChange={(nextSortable) => onColumnsChange(setColumnSortable(columns, id, nextSortable))}
      />
      <BooleanPropertyField
        label="Filtrable"
        value={filterable}
        onChange={(nextFilterable) => onColumnsChange(setColumnFilterable(columns, id, nextFilterable))}
      />
      {filterable && (
        <TextPropertyField
          label="Placeholder del filtro"
          value={filterPlaceholder}
          onChange={(nextText) => onColumnsChange(setColumnFilterPlaceholder(columns, id, nextText))}
        />
      )}
    </div>
  )
}
