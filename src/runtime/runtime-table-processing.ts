import type { TableColumnConfig } from '../config/runtime-config'

export type TableSortDirection = 'ascending' | 'descending'
export type TableVisibleRow = readonly string[]

export interface ResolvedTableColumnConfig {
  id: string
  header: string
  index: number
  filterable: boolean
  filterPlaceholder?: string
  sortable: boolean
}

export interface TableSortState {
  columnId: string
  direction: TableSortDirection
}

export type TableFilterValues = Record<string, string>

export function resolveTableColumnConfigs(
  headers: readonly string[],
  columns: readonly TableColumnConfig[] = [],
): ResolvedTableColumnConfig[] {
  return columns.flatMap((column) => {
    const index = headers.findIndex((header) => header === column.id)

    if (index === -1) {
      return []
    }

    const resolvedColumn: ResolvedTableColumnConfig = {
      id: column.id,
      header: headers[index],
      index,
      filterable: column.filterable === true,
      sortable: column.sortable === true,
    }

    if (column.filterPlaceholder !== undefined) {
      resolvedColumn.filterPlaceholder = column.filterPlaceholder
    }

    return resolvedColumn
  })
}

export function normalizeTableSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
}

export function filterTableRows(
  rows: readonly TableVisibleRow[],
  columns: readonly ResolvedTableColumnConfig[],
  filterValues: TableFilterValues,
): TableVisibleRow[] {
  const activeFilters = columns
    .filter((column) => column.filterable)
    .map((column) => ({
      column,
      value: normalizeTableSearchText(filterValues[column.id] ?? ''),
    }))
    .filter((filter) => filter.value.length > 0)

  if (activeFilters.length === 0) {
    return [...rows]
  }

  return rows.filter((row) =>
    activeFilters.every(({ column, value }) => normalizeTableSearchText(row[column.index] ?? '').includes(value)),
  )
}

export function sortTableRows(
  rows: readonly TableVisibleRow[],
  columns: readonly ResolvedTableColumnConfig[],
  sortState: TableSortState | null,
): TableVisibleRow[] {
  if (sortState === null) {
    return [...rows]
  }

  const sortColumn = columns.find((column) => column.id === sortState.columnId && column.sortable)

  if (!sortColumn) {
    return [...rows]
  }

  const directionMultiplier = sortState.direction === 'ascending' ? 1 : -1

  return rows
    .map((row, index) => ({ row, index }))
    .sort((left, right) => {
      const leftValue = normalizeTableSearchText(left.row[sortColumn.index] ?? '')
      const rightValue = normalizeTableSearchText(right.row[sortColumn.index] ?? '')
      const comparison = leftValue.localeCompare(rightValue)

      if (comparison !== 0) {
        return comparison * directionMultiplier
      }

      return left.index - right.index
    })
    .map((entry) => entry.row)
}

export function processTableRows(
  rows: readonly TableVisibleRow[],
  columns: readonly ResolvedTableColumnConfig[],
  filterValues: TableFilterValues,
  sortState: TableSortState | null,
): TableVisibleRow[] {
  return sortTableRows(filterTableRows(rows, columns, filterValues), columns, sortState)
}

export function getNextTableSortState(currentSort: TableSortState | null, columnId: string): TableSortState | null {
  if (currentSort?.columnId !== columnId) {
    return {
      columnId,
      direction: 'ascending',
    }
  }

  if (currentSort.direction === 'descending') {
    return null
  }

  return {
    columnId,
    direction: 'descending',
  }
}
