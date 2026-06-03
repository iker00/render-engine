import { describe, expect, it } from 'vitest'
import type { TableCellNode, TableColumnConfig } from '../../config/runtime-config'
import {
  filterTableRows,
  getNextTableSortState,
  processTableRows,
  resolveTableColumnConfigs,
  sortTableRows,
} from '../../runtime/runtime-table-processing'

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

  it('filterTableRows treats non-string cells as empty string and does not call normalizeTableSearchText on objects', () => {
    const resolvedColumns = resolveTableColumnConfigs(['Name', 'Action'], [
      { id: 'Name', filterable: true },
    ])
    const nodeCell: TableCellNode = { type: 'button', props: { label: 'Click me' } }
    const rows = [
      ['Ada', nodeCell],
      ['Grace', nodeCell],
    ]

    // With an active filter that matches 'ada': only Ada's row should pass
    const filtered = filterTableRows(rows, resolvedColumns, { Name: 'ada' })
    expect(filtered).toHaveLength(1)
    expect(filtered[0][0]).toBe('Ada')

    // With an active filter that would match normalizeTableSearchText('[object Object]'): none should pass
    // (nodes are treated as empty string, not coerced to string)
    const filteredByObject = filterTableRows(rows, resolvedColumns, { Name: 'object' })
    expect(filteredByObject).toHaveLength(0)
  })

  it('filterTableRows does not throw when a cell is a NodeObject and treats it as empty string', () => {
    const resolvedColumns = resolveTableColumnConfigs(['Action'], [
      { id: 'Action', filterable: true },
    ])
    const nodeCell: TableCellNode = { type: 'paragraph', props: { text: 'hello' } }
    const rows = [[nodeCell]]

    // Filtering with an active filter: node cell treated as empty string, so it does not match
    expect(() => filterTableRows(rows, resolvedColumns, { Action: 'some-filter' })).not.toThrow()
    const filtered = filterTableRows(rows, resolvedColumns, { Action: 'some-filter' })
    expect(filtered).toHaveLength(0)

    // With empty filter: all rows pass
    const noFilter = filterTableRows(rows, resolvedColumns, {})
    expect(noFilter).toHaveLength(1)
  })

  it('sortTableRows treats non-string cells as empty string and preserves stable order for equal values', () => {
    const resolvedColumns = resolveTableColumnConfigs(['Name', 'Badge'], [
      { id: 'Name', sortable: true },
    ])
    const nodeCell: TableCellNode = { type: 'paragraph', props: { text: 'badge' } }
    const rows = [
      ['Grace', nodeCell],
      ['Ada', nodeCell],
      ['Álvaro', nodeCell],
    ]

    const sorted = sortTableRows(rows, resolvedColumns, { columnId: 'Name', direction: 'ascending' })
    expect(sorted.map((row) => row[0])).toEqual(['Ada', 'Álvaro', 'Grace'])

    // Node cells are preserved in the sorted output
    sorted.forEach((row) => {
      expect(row[1]).toBe(nodeCell)
    })
  })

  it('processTableRows does not mutate input when some cells are NodeObject', () => {
    const resolvedColumns = resolveTableColumnConfigs(['Name', 'Badge'], [
      { id: 'Name', filterable: true, sortable: true },
    ])
    const nodeCell: TableCellNode = { type: 'heading', props: { text: 'badge', level: 3 } }
    const rows = [
      ['Grace', nodeCell],
      ['Ada', nodeCell],
    ]
    const originalRows = rows.map((row) => [...row])

    processTableRows(rows, resolvedColumns, { Name: 'ada' }, { columnId: 'Name', direction: 'ascending' })

    expect(rows).toEqual(originalRows)
  })
})
