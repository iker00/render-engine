import { describe, expect, it } from 'vitest'
import type { TableColumnConfig } from '../config/runtime-config'
import {
  filterTableRows,
  getNextTableSortState,
  processTableRows,
  resolveTableColumnConfigs,
  sortTableRows,
} from '../runtime/runtime-table-processing'

describe('runtime table processing', () => {
  const columns: TableColumnConfig[] = [
    { id: 'Visits', sortable: true },
    { id: 'Name', filterable: true, sortable: true },
    { id: 'Role', filterable: true },
  ]

  it('resolves configured columns by id without assuming positional metadata', () => {
    expect(resolveTableColumnConfigs(['Name', 'Role', 'Visits', 'Active'], columns)).toEqual([
      { id: 'Visits', header: 'Visits', index: 2, filterable: false, sortable: true },
      { id: 'Name', header: 'Name', index: 0, filterable: true, sortable: true },
      { id: 'Role', header: 'Role', index: 1, filterable: true, sortable: false },
    ])
  })

  it('filters by partial visible cell text without case or accent sensitivity', () => {
    const resolvedColumns = resolveTableColumnConfigs(['Name', 'Role'], columns)
    const rows = [
      ['Álvaro', 'Admin'],
      ['Grace', 'Editor'],
      ['Ada', 'Admin'],
    ]

    expect(filterTableRows(rows, resolvedColumns, { Name: 'alv' })).toEqual([['Álvaro', 'Admin']])
    expect(filterTableRows(rows, resolvedColumns, { Name: 'A', Role: 'admin' })).toEqual([
      ['Álvaro', 'Admin'],
      ['Ada', 'Admin'],
    ])
  })

  it('treats empty filters as inactive and returns zero rows when no filter matches', () => {
    const resolvedColumns = resolveTableColumnConfigs(['Name', 'Role'], columns)
    const rows = [
      ['Ada', 'Admin'],
      ['Grace', 'Editor'],
    ]

    expect(filterTableRows(rows, resolvedColumns, { Name: '   ' })).toEqual(rows)
    expect(filterTableRows(rows, resolvedColumns, { Role: 'missing' })).toEqual([])
  })

  it('sorts one active column at a time while preserving original order for ties and missing cells', () => {
    const resolvedColumns = resolveTableColumnConfigs(['Name', 'Role'], columns)
    const rows = [
      ['Grace', 'Editor'],
      ['Ada', 'Admin'],
      ['Ada', 'Reviewer'],
      ['', 'Pending'],
      ['Boolean true', 'true'],
    ]

    expect(sortTableRows(rows, resolvedColumns, null)).toEqual(rows)
    expect(sortTableRows(rows, resolvedColumns, { columnId: 'Name', direction: 'ascending' })).toEqual([
      ['', 'Pending'],
      ['Ada', 'Admin'],
      ['Ada', 'Reviewer'],
      ['Boolean true', 'true'],
      ['Grace', 'Editor'],
    ])
    expect(sortTableRows(rows, resolvedColumns, { columnId: 'Name', direction: 'descending' })).toEqual([
      ['Grace', 'Editor'],
      ['Boolean true', 'true'],
      ['Ada', 'Admin'],
      ['Ada', 'Reviewer'],
      ['', 'Pending'],
    ])
  })

  it('derives the next single-column sort state by cycling through ascending descending and inactive', () => {
    expect(getNextTableSortState(null, 'Name')).toEqual({ columnId: 'Name', direction: 'ascending' })
    expect(getNextTableSortState({ columnId: 'Name', direction: 'ascending' }, 'Name')).toEqual({
      columnId: 'Name',
      direction: 'descending',
    })
    expect(getNextTableSortState({ columnId: 'Name', direction: 'descending' }, 'Name')).toBeNull()
    expect(getNextTableSortState({ columnId: 'Name', direction: 'descending' }, 'Role')).toEqual({
      columnId: 'Role',
      direction: 'ascending',
    })
  })

  it('processes filters before sorting and never mutates the input rows', () => {
    const resolvedColumns = resolveTableColumnConfigs(['Name', 'Role'], columns)
    const rows = [
      ['Grace', 'Editor'],
      ['Álvaro', 'Admin'],
      ['Ada', 'Admin'],
    ]
    const originalRows = rows.map((row) => [...row])

    expect(
      processTableRows(rows, resolvedColumns, { Role: 'admin' }, { columnId: 'Name', direction: 'ascending' }),
    ).toEqual([
      ['Ada', 'Admin'],
      ['Álvaro', 'Admin'],
    ])
    expect(rows).toEqual(originalRows)
  })
})
