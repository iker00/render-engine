import { act, render, screen, fireEvent, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { TableCellNode, TableColumnConfig, TableDynamicRows, TableLayoutNode, TableManualRows } from '../../config/runtime-config'
import { EMPTY_DYNAMIC_TABLE_CELL_TEXT_VALUE, EMPTY_TABLE_CELL_TEXT_VALUE, buildDefaultNodeInstance } from '../../dev-runtime/layout-canvas/layout-canvas-node-palette-defaults'
import { TableRowsPropertyField } from '../../dev-runtime/layout-canvas/property-fields/table-rows-property-field'

// Light mock of @dnd-kit/core (see layout-canvas-reorder-reinsert.test.tsx, T12): real pointer
// simulation against PointerSensor is impractical in jsdom, so DndContext is replaced with a
// pass-through that captures the onDragEnd handler, letting tests invoke it directly with
// synthetic {active, over} pairs. useDraggable/useDroppable keep their real implementation.
let capturedOnDragEnd: ((event: { active: { id: string }; over: { id: string } | null }) => void) | null = null

vi.mock('@dnd-kit/core', async () => {
  const actual = await vi.importActual<typeof import('@dnd-kit/core')>('@dnd-kit/core')
  return {
    ...actual,
    DndContext: (props: { children: React.ReactNode; onDragEnd?: (event: unknown) => void }) => {
      capturedOnDragEnd = props.onDragEnd as typeof capturedOnDragEnd
      return props.children
    },
  }
})

function manualTableNode(overrides: Partial<TableLayoutNode['props']> = {}): TableLayoutNode {
  return {
    type: 'table',
    props: {
      headers: ['Nombre', 'Edad'],
      rows: [
        [EMPTY_TABLE_CELL_TEXT_VALUE, EMPTY_TABLE_CELL_TEXT_VALUE],
      ] as TableManualRows,
      ...overrides,
    },
  }
}

function dynamicTableNode(overrides: Partial<TableLayoutNode['props']> = {}): TableLayoutNode {
  return {
    type: 'table',
    props: {
      headers: ['Nombre', 'Edad'],
      rows: {
        source: 'queries.people.data',
        cells: [EMPTY_DYNAMIC_TABLE_CELL_TEXT_VALUE, EMPTY_DYNAMIC_TABLE_CELL_TEXT_VALUE],
      } as TableDynamicRows,
      ...overrides,
    },
  }
}

describe('TableRowsPropertyField mode detection', () => {
  it('activates "Manual" when props.rows is an array', () => {
    render(<TableRowsPropertyField label="Filas y columnas" node={manualTableNode()} onChange={vi.fn()} />)
    expect(screen.getByRole('radio', { name: /Manual/ })).toHaveAttribute('aria-checked', 'true')
  })

  it('activates "Dinámico" when props.rows is an object with source/cells', () => {
    render(<TableRowsPropertyField label="Filas y columnas" node={dynamicTableNode()} onChange={vi.fn()} />)
    expect(screen.getByRole('radio', { name: /Dinámico/ })).toHaveAttribute('aria-checked', 'true')
  })
})

describe('TableRowsPropertyField switching mode', () => {
  it('Manual -> Dinámico reconstructs props.rows.cells with EMPTY_DYNAMIC_TABLE_CELL_TEXT_VALUE, never EMPTY_TABLE_CELL_TEXT_VALUE', () => {
    const onChange = vi.fn()
    const node = manualTableNode({ headers: ['A', 'B', 'C'] })
    render(<TableRowsPropertyField label="Filas y columnas" node={node} onChange={onChange} />)

    fireEvent.click(screen.getByRole('radio', { name: /Dinámico/ }))

    expect(onChange).toHaveBeenCalledTimes(1)
    const nextNode = onChange.mock.calls[0][0] as TableLayoutNode
    const nextRows = nextNode.props.rows as TableDynamicRows
    expect(Array.isArray(nextRows)).toBe(false)
    expect(nextRows.source).toBe('queries.placeholderQuery.data')
    expect(nextRows.cells).toEqual([
      EMPTY_DYNAMIC_TABLE_CELL_TEXT_VALUE,
      EMPTY_DYNAMIC_TABLE_CELL_TEXT_VALUE,
      EMPTY_DYNAMIC_TABLE_CELL_TEXT_VALUE,
    ])
    expect(nextRows.cells).not.toContain(EMPTY_TABLE_CELL_TEXT_VALUE)
  })

  it('Dinámico -> Manual reconstructs props.rows as an empty array', () => {
    const onChange = vi.fn()
    const node = dynamicTableNode()
    render(<TableRowsPropertyField label="Filas y columnas" node={node} onChange={onChange} />)

    fireEvent.click(screen.getByRole('radio', { name: /Manual/ }))

    expect(onChange).toHaveBeenCalledTimes(1)
    const nextNode = onChange.mock.calls[0][0] as TableLayoutNode
    expect(nextNode.props.rows).toEqual([])
  })

  it('preserves headers/columns intact when switching mode in both directions', () => {
    const onChange = vi.fn()
    const columns = [{ id: 'Nombre', sortable: true as const }]
    const node = manualTableNode({ headers: ['Nombre', 'Edad'], columns })
    render(<TableRowsPropertyField label="Filas y columnas" node={node} onChange={onChange} />)

    fireEvent.click(screen.getByRole('radio', { name: /Dinámico/ }))

    const nextNode = onChange.mock.calls[0][0] as TableLayoutNode
    expect(nextNode.props.headers).toEqual(['Nombre', 'Edad'])
    expect(nextNode.props.columns).toEqual(columns)
  })
})

describe('TableRowsPropertyField no longer uses a grid layout', () => {
  it('renders no role="grid"/"row"/"gridcell" element (D5 revision)', () => {
    render(<TableRowsPropertyField label="Filas y columnas" node={manualTableNode()} onChange={vi.fn()} />)
    expect(screen.queryByRole('grid')).not.toBeInTheDocument()
    expect(screen.queryByRole('row')).not.toBeInTheDocument()
    expect(screen.queryByRole('gridcell')).not.toBeInTheDocument()
  })

  it('exposes the root fieldset/legend as an accessible group named after label', () => {
    render(<TableRowsPropertyField label="Filas y columnas" node={manualTableNode()} onChange={vi.fn()} />)
    expect(screen.getByRole('group', { name: 'Filas y columnas' })).toBeInTheDocument()
  })
})

describe('TableRowsPropertyField header rename (Columnas section)', () => {
  it('renaming a header without a matching columns[] entry only changes headers[index]', () => {
    const onChange = vi.fn()
    const node = manualTableNode({ headers: ['Nombre', 'Edad'] })
    render(<TableRowsPropertyField label="Filas y columnas" node={node} onChange={onChange} />)

    const headerInput = screen.getByLabelText('Cabecera 1') as HTMLInputElement
    fireEvent.change(headerInput, { target: { value: 'Nombre completo' } })
    fireEvent.blur(headerInput)

    expect(onChange).toHaveBeenCalledTimes(1)
    const nextNode = onChange.mock.calls[0][0] as TableLayoutNode
    expect(nextNode.props.headers).toEqual(['Nombre completo', 'Edad'])
    expect(nextNode.props.columns).toBeUndefined()
  })

  it('renaming a header with a matching columns[].id entry also renames that entry', () => {
    const onChange = vi.fn()
    const columns = [{ id: 'Nombre' }]
    const node = manualTableNode({ headers: ['Nombre', 'Edad'], columns })
    render(<TableRowsPropertyField label="Filas y columnas" node={node} onChange={onChange} />)

    const headerInput = screen.getByLabelText('Cabecera 1') as HTMLInputElement
    fireEvent.change(headerInput, { target: { value: 'Nombre completo' } })
    fireEvent.blur(headerInput)

    const nextNode = onChange.mock.calls[0][0] as TableLayoutNode
    expect(nextNode.props.headers).toEqual(['Nombre completo', 'Edad'])
    expect(nextNode.props.columns).toEqual([{ id: 'Nombre completo' }])
  })

  it('does not commit when blurring without changing the value', () => {
    const onChange = vi.fn()
    const node = manualTableNode()
    render(<TableRowsPropertyField label="Filas y columnas" node={node} onChange={onChange} />)

    const headerInput = screen.getByLabelText('Cabecera 1') as HTMLInputElement
    fireEvent.blur(headerInput)

    expect(onChange).not.toHaveBeenCalled()
  })
})

describe('TableRowsPropertyField remove column', () => {
  it('removes the header, the matching cell in every manual row, and any matching columns[] entry', () => {
    const onChange = vi.fn()
    const columns = [{ id: 'Nombre' }]
    const node = manualTableNode({
      headers: ['Nombre', 'Edad'],
      rows: [
        ['Ana', 30],
        ['Bea', 40],
      ] as TableManualRows,
      columns,
    })
    render(<TableRowsPropertyField label="Filas y columnas" node={node} onChange={onChange} />)

    fireEvent.click(screen.getByRole('button', { name: 'Quitar columna Nombre' }))

    expect(onChange).toHaveBeenCalledTimes(1)
    const nextNode = onChange.mock.calls[0][0] as TableLayoutNode
    expect(nextNode.props.headers).toEqual(['Edad'])
    expect(nextNode.props.rows).toEqual([[30], [40]])
    expect(nextNode.props.columns).toEqual([])
  })

  it('removes the matching entry from cells in dynamic mode, via the "Quitar columna" button inside the accordion item', () => {
    const onChange = vi.fn()
    const node = dynamicTableNode({
      headers: ['Nombre', 'Edad'],
      rows: { source: 'queries.people.data', cells: ['—', '—'] } as TableDynamicRows,
    })
    render(<TableRowsPropertyField label="Filas y columnas" node={node} onChange={onChange} />)

    fireEvent.click(screen.getByRole('button', { name: 'Quitar columna 1' }))

    const nextNode = onChange.mock.calls[0][0] as TableLayoutNode
    const nextRows = nextNode.props.rows as TableDynamicRows
    expect(nextNode.props.headers).toEqual(['Edad'])
    expect(nextRows.cells).toEqual(['—'])
    expect(nextRows.source).toBe('queries.people.data')
  })

  it('is disabled when there is only one column remaining (manual mode, top Columnas section)', () => {
    const node = manualTableNode({ headers: ['Único'], rows: [[EMPTY_TABLE_CELL_TEXT_VALUE]] as TableManualRows })
    render(<TableRowsPropertyField label="Filas y columnas" node={node} onChange={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Quitar columna Único' })).toBeDisabled()
  })

  it('is disabled when there is only one column remaining (dynamic mode, accordion item)', () => {
    const node = dynamicTableNode({
      headers: ['Único'],
      rows: { source: 'queries.people.data', cells: ['—'] } as TableDynamicRows,
    })
    render(<TableRowsPropertyField label="Filas y columnas" node={node} onChange={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Quitar columna 1' })).toBeDisabled()
  })

  it('removing a column whose cells hold node subtrees in several rows drops them all, without any dialog', () => {
    const onChange = vi.fn()
    const nodeCell: TableCellNode = buildDefaultNodeInstance('heading') as TableCellNode
    const node = manualTableNode({
      headers: ['Nombre', 'Detalle'],
      rows: [
        ['Ana', nodeCell],
        ['Bea', nodeCell],
      ] as TableManualRows,
    })
    render(<TableRowsPropertyField label="Filas y columnas" node={node} onChange={onChange} />)

    fireEvent.click(screen.getByRole('button', { name: 'Quitar columna Detalle' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    const nextNode = onChange.mock.calls[0][0] as TableLayoutNode
    expect(nextNode.props.rows).toEqual([['Ana'], ['Bea']])
  })
})

describe('TableRowsPropertyField manual mode column flags (Ordenable/Filtrable)', () => {
  function columnEntryContainer(labelText: string): HTMLElement {
    const input = screen.getByLabelText(labelText) as HTMLInputElement
    const container = input.closest('.flex.flex-col.gap-2')
    if (!container) throw new Error(`no column entry container found for ${labelText}`)
    return container as HTMLElement
  }

  it('shows "Ordenable"/"Filtrable" switches next to each column entry, distinguishing entries by index', () => {
    const node = manualTableNode({ headers: ['Nombre', 'Edad'] })
    render(<TableRowsPropertyField label="Filas y columnas" node={node} onChange={vi.fn()} />)

    const firstEntry = columnEntryContainer('Cabecera 1')
    const secondEntry = columnEntryContainer('Cabecera 2')

    expect(within(firstEntry).getByRole('switch', { name: 'Ordenable' })).toBeInTheDocument()
    expect(within(firstEntry).getByRole('switch', { name: 'Filtrable' })).toBeInTheDocument()
    expect(within(secondEntry).getByRole('switch', { name: 'Ordenable' })).toBeInTheDocument()
    expect(within(secondEntry).getByRole('switch', { name: 'Filtrable' })).toBeInTheDocument()
  })

  it('marking "Ordenable" on a column with no columns[] entry commits a fresh sortable entry, rest of node intact', () => {
    const onChange = vi.fn()
    const node = manualTableNode({ headers: ['Nombre', 'Edad'] })
    render(<TableRowsPropertyField label="Filas y columnas" node={node} onChange={onChange} />)

    const entry = columnEntryContainer('Cabecera 1')
    fireEvent.click(within(entry).getByRole('switch', { name: 'Ordenable' }))

    expect(onChange).toHaveBeenCalledTimes(1)
    const nextNode = onChange.mock.calls[0][0] as TableLayoutNode
    expect(nextNode.props.columns).toEqual([{ id: 'Nombre', sortable: true }])
    expect(nextNode.props.headers).toEqual(['Nombre', 'Edad'])
    expect(nextNode.props.rows).toEqual(node.props.rows)
  })

  it('marking "Ordenable" on a column already filterable keeps that entry and adds sortable', () => {
    const onChange = vi.fn()
    const columns: TableColumnConfig[] = [{ id: 'Edad', filterable: true }]
    const node = manualTableNode({ headers: ['Nombre', 'Edad'], columns })
    render(<TableRowsPropertyField label="Filas y columnas" node={node} onChange={onChange} />)

    const entry = columnEntryContainer('Cabecera 2')
    fireEvent.click(within(entry).getByRole('switch', { name: 'Ordenable' }))

    const nextNode = onChange.mock.calls[0][0] as TableLayoutNode
    expect(nextNode.props.columns).toEqual([{ id: 'Edad', filterable: true, sortable: true }])
  })

  it('unmarking "Ordenable" when the entry has no filterable:true drops it from props.columns', () => {
    const onChange = vi.fn()
    const columns: TableColumnConfig[] = [{ id: 'Nombre', sortable: true }]
    const node = manualTableNode({ headers: ['Nombre', 'Edad'], columns })
    render(<TableRowsPropertyField label="Filas y columnas" node={node} onChange={onChange} />)

    const entry = columnEntryContainer('Cabecera 1')
    fireEvent.click(within(entry).getByRole('switch', { name: 'Ordenable' }))

    const nextNode = onChange.mock.calls[0][0] as TableLayoutNode
    expect(nextNode.props.columns).toEqual([])
  })

  it('marking "Filtrable" reveals an empty "Placeholder del filtro" field in that same entry, and typing sets filterPlaceholder', () => {
    let node = manualTableNode({ headers: ['Nombre', 'Edad'] })
    const onChange = vi.fn((next: TableLayoutNode) => {
      node = next
    })
    const { rerender } = render(<TableRowsPropertyField label="Filas y columnas" node={node} onChange={onChange} />)

    let entry = columnEntryContainer('Cabecera 1')
    fireEvent.click(within(entry).getByRole('switch', { name: 'Filtrable' }))
    rerender(<TableRowsPropertyField label="Filas y columnas" node={node} onChange={onChange} />)

    entry = columnEntryContainer('Cabecera 1')
    expect(within(entry).getByLabelText('Placeholder del filtro')).toHaveValue('')

    fireEvent.change(within(entry).getByLabelText('Placeholder del filtro'), { target: { value: 'Buscar…' } })

    expect(onChange).toHaveBeenCalledTimes(2)
    const nextNode = onChange.mock.calls[1][0] as TableLayoutNode
    expect(nextNode.props.columns).toEqual([{ id: 'Nombre', filterable: true, filterPlaceholder: 'Buscar…' }])
  })

  it('unmarking "Filtrable" hides "Placeholder del filtro" and drops filterable/filterPlaceholder while keeping sortable', () => {
    let node = manualTableNode({
      headers: ['Nombre', 'Edad'],
      columns: [{ id: 'Nombre', sortable: true, filterable: true, filterPlaceholder: 'texto' }],
    })
    const onChange = vi.fn((next: TableLayoutNode) => {
      node = next
    })
    const { rerender } = render(<TableRowsPropertyField label="Filas y columnas" node={node} onChange={onChange} />)

    let entry = columnEntryContainer('Cabecera 1')
    fireEvent.click(within(entry).getByRole('switch', { name: 'Filtrable' }))

    const nextNode = onChange.mock.calls[0][0] as TableLayoutNode
    expect(nextNode.props.columns).toEqual([{ id: 'Nombre', sortable: true }])

    rerender(<TableRowsPropertyField label="Filas y columnas" node={node} onChange={onChange} />)
    entry = columnEntryContainer('Cabecera 1')
    expect(within(entry).queryByLabelText('Placeholder del filtro')).not.toBeInTheDocument()
  })

  it('renaming a header keeps sortable/filterable/filterPlaceholder of its columns[] entry, only syncing the id (regression)', () => {
    const onChange = vi.fn()
    const columns: TableColumnConfig[] = [{ id: 'Nombre', sortable: true, filterable: true, filterPlaceholder: 'texto' }]
    const node = manualTableNode({ headers: ['Nombre', 'Edad'], columns })
    render(<TableRowsPropertyField label="Filas y columnas" node={node} onChange={onChange} />)

    const headerInput = screen.getByLabelText('Cabecera 1') as HTMLInputElement
    fireEvent.change(headerInput, { target: { value: 'Nombre completo' } })
    fireEvent.blur(headerInput)

    const nextNode = onChange.mock.calls[0][0] as TableLayoutNode
    expect(nextNode.props.columns).toEqual([{ id: 'Nombre completo', sortable: true, filterable: true, filterPlaceholder: 'texto' }])
  })

  it('removing a column drops its full columns[] entry, including sortable/filterable/filterPlaceholder (regression)', () => {
    const onChange = vi.fn()
    const columns: TableColumnConfig[] = [{ id: 'Nombre', sortable: true, filterable: true, filterPlaceholder: 'texto' }]
    const node = manualTableNode({ headers: ['Nombre', 'Edad'], columns })
    render(<TableRowsPropertyField label="Filas y columnas" node={node} onChange={onChange} />)

    fireEvent.click(screen.getByRole('button', { name: 'Quitar columna Nombre' }))

    const nextNode = onChange.mock.calls[0][0] as TableLayoutNode
    expect(nextNode.props.columns).toEqual([])
  })

  it('does not introduce a bordered or background box around the column entry', () => {
    const columns: TableColumnConfig[] = [{ id: 'Nombre', filterable: true }]
    const node = manualTableNode({ headers: ['Nombre', 'Edad'], columns })
    render(<TableRowsPropertyField label="Filas y columnas" node={node} onChange={vi.fn()} />)

    const entry = columnEntryContainer('Cabecera 1')
    expect(entry.className).not.toMatch(/\bborder\b/)
    expect(entry.className).not.toMatch(/\bbg-/)
  })
})

describe('TableRowsPropertyField add column', () => {
  it.each([
    ['manual', manualTableNode, EMPTY_TABLE_CELL_TEXT_VALUE],
    ['dynamic', dynamicTableNode, EMPTY_DYNAMIC_TABLE_CELL_TEXT_VALUE],
  ] as const)('adds a header "Columna N" and a new cell per existing row/cells with the %s-mode literal, without touching columns', (_modeName, buildNode, emptyValue) => {
    const onChange = vi.fn()
    const columns = [{ id: 'Nombre' }]
    const node = buildNode({ headers: ['Nombre', 'Edad'], columns })
    render(<TableRowsPropertyField label="Filas y columnas" node={node} onChange={onChange} />)

    fireEvent.click(screen.getByRole('button', { name: 'Añadir columna' }))

    expect(onChange).toHaveBeenCalledTimes(1)
    const nextNode = onChange.mock.calls[0][0] as TableLayoutNode
    expect(nextNode.props.headers).toEqual(['Nombre', 'Edad', 'Columna 3'])
    expect(nextNode.props.columns).toEqual(columns)

    if (Array.isArray(nextNode.props.rows)) {
      nextNode.props.rows.forEach((row) => expect(row[row.length - 1]).toBe(emptyValue))
    } else {
      const cells = (nextNode.props.rows as TableDynamicRows).cells
      expect(cells[cells.length - 1]).toBe(emptyValue)
    }
  })
})

describe('TableRowsPropertyField manual mode accordion rows', () => {
  it('renders each row collapsed by default; toggling the disclosure button expands/collapses it', () => {
    const node = manualTableNode({ headers: ['Nombre', 'Edad'], rows: [['Ana', 30]] as TableManualRows })
    render(<TableRowsPropertyField label="Filas y columnas" node={node} onChange={vi.fn()} />)

    const toggle = screen.getByRole('button', { name: 'Expandir fila 1' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryAllByRole('combobox')).toHaveLength(0)

    fireEvent.click(toggle)

    expect(screen.getByRole('button', { name: 'Colapsar fila 1' })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getAllByRole('combobox')).toHaveLength(2)
  })

  it('shows the row[0] text value as a preview when collapsed; shows no preview when row[0] is a node cell', () => {
    const textRowNode = manualTableNode({ headers: ['Nombre', 'Edad'], rows: [['Ana', 30]] as TableManualRows })
    const { rerender } = render(<TableRowsPropertyField label="Filas y columnas" node={textRowNode} onChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Expandir fila 1' }).textContent).toContain('Ana')

    const nodeCellRowNode = manualTableNode({
      headers: ['Nombre', 'Edad'],
      rows: [[buildDefaultNodeInstance('heading'), 30]] as unknown as TableManualRows,
    })
    rerender(<TableRowsPropertyField label="Filas y columnas" node={nodeCellRowNode} onChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Expandir fila 1' }).textContent?.trim()).toBe('Fila 1')
  })
})

describe('TableRowsPropertyField manual mode add/remove row', () => {
  it('shows "Añadir fila" and mounts no drag mechanism when props.rows is empty', () => {
    const node = manualTableNode({ rows: [] })
    render(<TableRowsPropertyField label="Filas y columnas" node={node} onChange={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Añadir fila' })).toBeInTheDocument()
    expect(screen.queryByLabelText(/Reordenar fila/)).not.toBeInTheDocument()
  })

  it('adds a row with EMPTY_TABLE_CELL_TEXT_VALUE for every existing column', () => {
    const onChange = vi.fn()
    const node = manualTableNode({ headers: ['A', 'B', 'C'], rows: [] })
    render(<TableRowsPropertyField label="Filas y columnas" node={node} onChange={onChange} />)

    fireEvent.click(screen.getByRole('button', { name: 'Añadir fila' }))

    expect(onChange).toHaveBeenCalledTimes(1)
    const nextNode = onChange.mock.calls[0][0] as TableLayoutNode
    expect(nextNode.props.rows).toEqual([[EMPTY_TABLE_CELL_TEXT_VALUE, EMPTY_TABLE_CELL_TEXT_VALUE, EMPTY_TABLE_CELL_TEXT_VALUE]])
  })

  it('a newly added row is expanded automatically', () => {
    let node = manualTableNode({ headers: ['A'], rows: [] })
    const onChange = vi.fn((next: TableLayoutNode) => {
      node = next
    })
    const { rerender } = render(<TableRowsPropertyField label="Filas y columnas" node={node} onChange={onChange} />)

    fireEvent.click(screen.getByRole('button', { name: 'Añadir fila' }))
    rerender(<TableRowsPropertyField label="Filas y columnas" node={node} onChange={onChange} />)

    expect(screen.getByRole('button', { name: 'Colapsar fila 1' })).toHaveAttribute('aria-expanded', 'true')
  })

  it('removes a row via "Quitar fila N" without a minimum', () => {
    const onChange = vi.fn()
    const node = manualTableNode({
      rows: [
        ['Ana', 30],
        ['Bea', 40],
      ] as TableManualRows,
    })
    render(<TableRowsPropertyField label="Filas y columnas" node={node} onChange={onChange} />)

    fireEvent.click(screen.getByRole('button', { name: 'Quitar fila 1' }))

    expect(onChange).toHaveBeenCalledTimes(1)
    const nextNode = onChange.mock.calls[0][0] as TableLayoutNode
    expect(nextNode.props.rows).toEqual([['Bea', 40]])
  })
})

describe('TableRowsPropertyField manual mode row reordering', () => {
  it('dragging a row onto a gap zone moves it to the resolved position without touching headers/columns', () => {
    const onChange = vi.fn()
    const columns = [{ id: 'Nombre' }]
    const node = manualTableNode({
      headers: ['Nombre', 'Edad'],
      rows: [
        ['Ana', 30],
        ['Bea', 40],
        ['Cia', 50],
      ] as TableManualRows,
      columns,
    })
    render(<TableRowsPropertyField label="Filas y columnas" node={node} onChange={onChange} />)

    expect(capturedOnDragEnd).not.toBeNull()
    act(() => {
      capturedOnDragEnd!({ active: { id: 'item-0' }, over: { id: 'gap-2' } })
    })

    expect(onChange).toHaveBeenCalledTimes(1)
    const nextNode = onChange.mock.calls[0][0] as TableLayoutNode
    expect(nextNode.props.rows).toEqual([
      ['Bea', 40],
      ['Ana', 30],
      ['Cia', 50],
    ])
    expect(nextNode.props.headers).toEqual(['Nombre', 'Edad'])
    expect(nextNode.props.columns).toEqual(columns)
  })

  it('"Subir"/"Bajar" move a row and are disabled at the list boundaries', () => {
    const onChange = vi.fn()
    const node = manualTableNode({
      headers: ['Nombre', 'Edad'],
      rows: [
        ['Ana', 30],
        ['Bea', 40],
      ] as TableManualRows,
    })
    render(<TableRowsPropertyField label="Filas y columnas" node={node} onChange={onChange} />)

    expect(screen.getByRole('button', { name: 'Subir fila 1' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Bajar fila 2' })).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: 'Bajar fila 1' }))

    expect(onChange).toHaveBeenCalledTimes(1)
    const nextNode = onChange.mock.calls[0][0] as TableLayoutNode
    expect(nextNode.props.rows).toEqual([
      ['Bea', 40],
      ['Ana', 30],
    ])
  })

  it('dropping on the gap adjacent to the dragged row itself does not invoke onChange', () => {
    const onChange = vi.fn()
    const node = manualTableNode({
      headers: ['Nombre', 'Edad'],
      rows: [
        ['Ana', 30],
        ['Bea', 40],
      ] as TableManualRows,
    })
    render(<TableRowsPropertyField label="Filas y columnas" node={node} onChange={onChange} />)

    act(() => {
      capturedOnDragEnd!({ active: { id: 'item-0' }, over: { id: 'gap-1' } })
    })

    expect(onChange).not.toHaveBeenCalled()
  })
})

describe('TableRowsPropertyField dynamic mode accordion columns (D5 revisión 2 — no separate top Columnas section)', () => {
  it('does not render the top "Columnas" header list in dynamic mode', () => {
    const node = dynamicTableNode({ headers: ['Nombre', 'Edad'] })
    render(<TableRowsPropertyField label="Filas y columnas" node={node} onChange={vi.fn()} />)

    expect(screen.queryByLabelText('Cabecera 1')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Cabecera 2')).not.toBeInTheDocument()
  })

  it('renders the top "Columnas" header list in manual mode', () => {
    const node = manualTableNode({ headers: ['Nombre', 'Edad'] })
    render(<TableRowsPropertyField label="Filas y columnas" node={node} onChange={vi.fn()} />)

    expect(screen.getByLabelText('Cabecera 1')).toBeInTheDocument()
    expect(screen.getByLabelText('Cabecera 2')).toBeInTheDocument()
  })

  it('renders each column collapsed by default with the header text and a cell-type badge', () => {
    const node = dynamicTableNode({
      headers: ['Nombre', 'Edad'],
      rows: { source: 'queries.people.data', cells: ['—', buildDefaultNodeInstance('heading')] } as TableDynamicRows,
    })
    render(<TableRowsPropertyField label="Filas y columnas" node={node} onChange={vi.fn()} />)

    const firstToggle = screen.getByRole('button', { name: 'Expandir columna 1' })
    expect(firstToggle).toHaveAttribute('aria-expanded', 'false')
    expect(firstToggle).toHaveTextContent('Nombre')
    expect(firstToggle).toHaveTextContent('Texto')

    const secondToggle = screen.getByRole('button', { name: 'Expandir columna 2' })
    expect(secondToggle).toHaveTextContent('Título')
  })

  it('expanding a column shows the header rename input and the cell-type editor for that cell', () => {
    const node = dynamicTableNode({
      headers: ['Nombre', 'Edad'],
      rows: { source: 'queries.people.data', cells: ['—', '—'] } as TableDynamicRows,
    })
    render(<TableRowsPropertyField label="Filas y columnas" node={node} onChange={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: 'Expandir columna 1' }))

    expect(screen.getByLabelText('Cabecera de columna 1')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Colapsar columna 1' })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('combobox')).toBeInTheDocument()
  })

  it('renaming the header from inside the expanded accordion item updates headers[index] and any matching columns[].id entry (AC7)', () => {
    const onChange = vi.fn()
    const columns = [{ id: 'Nombre' }]
    const node = dynamicTableNode({ headers: ['Nombre', 'Edad'], columns })
    render(<TableRowsPropertyField label="Filas y columnas" node={node} onChange={onChange} />)

    fireEvent.click(screen.getByRole('button', { name: 'Expandir columna 1' }))
    const input = screen.getByLabelText('Cabecera de columna 1') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'Nombre completo' } })
    fireEvent.blur(input)

    expect(onChange).toHaveBeenCalledTimes(1)
    const nextNode = onChange.mock.calls[0][0] as TableLayoutNode
    expect(nextNode.props.headers).toEqual(['Nombre completo', 'Edad'])
    expect(nextNode.props.columns).toEqual([{ id: 'Nombre completo' }])
  })
})

describe('TableRowsPropertyField dynamic mode column flags (Ordenable/Filtrable)', () => {
  function columnEntryBody(labelText: string): HTMLElement {
    const input = screen.getByLabelText(labelText) as HTMLInputElement
    const container = input.closest('.flex.flex-col.gap-2.pl-6')
    if (!container) throw new Error(`no expanded column entry body found for ${labelText}`)
    return container as HTMLElement
  }

  function expandedColumnEntryContainer(expandButtonName: string, labelText: string): HTMLElement {
    fireEvent.click(screen.getByRole('button', { name: expandButtonName }))
    return columnEntryBody(labelText)
  }

  it('shows "Ordenable"/"Filtrable" switches next to the header input of each expanded column-template entry', () => {
    const node = dynamicTableNode({ headers: ['Nombre', 'Edad'] })
    render(<TableRowsPropertyField label="Filas y columnas" node={node} onChange={vi.fn()} />)

    const firstEntry = expandedColumnEntryContainer('Expandir columna 1', 'Cabecera de columna 1')
    expect(within(firstEntry).getByRole('switch', { name: 'Ordenable' })).toBeInTheDocument()
    expect(within(firstEntry).getByRole('switch', { name: 'Filtrable' })).toBeInTheDocument()

    const secondEntry = expandedColumnEntryContainer('Expandir columna 2', 'Cabecera de columna 2')
    expect(within(secondEntry).getByRole('switch', { name: 'Ordenable' })).toBeInTheDocument()
    expect(within(secondEntry).getByRole('switch', { name: 'Filtrable' })).toBeInTheDocument()
  })

  it('marking "Ordenable" on a column-template with no columns[] entry commits [{ id: header, sortable: true }], leaving headers/rows intact', () => {
    const onChange = vi.fn()
    const node = dynamicTableNode({ headers: ['Nombre', 'Edad'] })
    render(<TableRowsPropertyField label="Filas y columnas" node={node} onChange={onChange} />)

    const entry = expandedColumnEntryContainer('Expandir columna 1', 'Cabecera de columna 1')
    fireEvent.click(within(entry).getByRole('switch', { name: 'Ordenable' }))

    expect(onChange).toHaveBeenCalledTimes(1)
    const nextNode = onChange.mock.calls[0][0] as TableLayoutNode
    expect(nextNode.props.columns).toEqual([{ id: 'Nombre', sortable: true }])
    expect(nextNode.props.headers).toEqual(['Nombre', 'Edad'])
    expect(nextNode.props.rows).toEqual(node.props.rows)
  })

  it('marking "Filtrable" reveals an empty "Placeholder del filtro" field in that entry, and typing sets filterPlaceholder', () => {
    let node = dynamicTableNode({ headers: ['Nombre', 'Edad'] })
    const onChange = vi.fn((next: TableLayoutNode) => {
      node = next
    })
    const { rerender } = render(<TableRowsPropertyField label="Filas y columnas" node={node} onChange={onChange} />)

    let entry = expandedColumnEntryContainer('Expandir columna 1', 'Cabecera de columna 1')
    fireEvent.click(within(entry).getByRole('switch', { name: 'Filtrable' }))
    rerender(<TableRowsPropertyField label="Filas y columnas" node={node} onChange={onChange} />)

    entry = columnEntryBody('Cabecera de columna 1')
    expect(within(entry).getByLabelText('Placeholder del filtro')).toHaveValue('')

    fireEvent.change(within(entry).getByLabelText('Placeholder del filtro'), { target: { value: 'Buscar…' } })

    expect(onChange).toHaveBeenCalledTimes(2)
    const nextNode = onChange.mock.calls[1][0] as TableLayoutNode
    expect(nextNode.props.columns).toEqual([{ id: 'Nombre', filterable: true, filterPlaceholder: 'Buscar…' }])
  })

  it('unmarking "Filtrable" on an entry with sortable:true keeps sortable and drops filterable/filterPlaceholder', () => {
    let node = dynamicTableNode({
      headers: ['Nombre', 'Edad'],
      columns: [{ id: 'Nombre', sortable: true, filterable: true, filterPlaceholder: 'texto' }],
    })
    const onChange = vi.fn((next: TableLayoutNode) => {
      node = next
    })
    const { rerender } = render(<TableRowsPropertyField label="Filas y columnas" node={node} onChange={onChange} />)

    let entry = expandedColumnEntryContainer('Expandir columna 1', 'Cabecera de columna 1')
    fireEvent.click(within(entry).getByRole('switch', { name: 'Filtrable' }))

    expect(onChange).toHaveBeenCalledTimes(1)
    const nextNode = onChange.mock.calls[0][0] as TableLayoutNode
    expect(nextNode.props.columns).toEqual([{ id: 'Nombre', sortable: true }])

    rerender(<TableRowsPropertyField label="Filas y columnas" node={node} onChange={onChange} />)
    entry = columnEntryBody('Cabecera de columna 1')
    expect(within(entry).queryByLabelText('Placeholder del filtro')).not.toBeInTheDocument()
  })

  it('unmarking "Filtrable" on an entry without sortable:true removes the entry entirely from columns[]', () => {
    const onChange = vi.fn()
    const node = dynamicTableNode({
      headers: ['Nombre', 'Edad'],
      columns: [{ id: 'Nombre', filterable: true, filterPlaceholder: 'texto' }],
    })
    render(<TableRowsPropertyField label="Filas y columnas" node={node} onChange={onChange} />)

    const entry = expandedColumnEntryContainer('Expandir columna 1', 'Cabecera de columna 1')
    fireEvent.click(within(entry).getByRole('switch', { name: 'Filtrable' }))

    expect(onChange).toHaveBeenCalledTimes(1)
    const nextNode = onChange.mock.calls[0][0] as TableLayoutNode
    expect(nextNode.props.columns).toEqual([])
  })

  it('renaming a column-template header keeps sortable/filterable/filterPlaceholder of its columns[] entry, only syncing the id (regression)', () => {
    const onChange = vi.fn()
    const columns: TableColumnConfig[] = [{ id: 'Nombre', sortable: true, filterable: true, filterPlaceholder: 'texto' }]
    const node = dynamicTableNode({ headers: ['Nombre', 'Edad'], columns })
    render(<TableRowsPropertyField label="Filas y columnas" node={node} onChange={onChange} />)

    fireEvent.click(screen.getByRole('button', { name: 'Expandir columna 1' }))
    const input = screen.getByLabelText('Cabecera de columna 1') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'Nombre completo' } })
    fireEvent.blur(input)

    const nextNode = onChange.mock.calls[0][0] as TableLayoutNode
    expect(nextNode.props.columns).toEqual([{ id: 'Nombre completo', sortable: true, filterable: true, filterPlaceholder: 'texto' }])
  })

  it('removing a column-template drops its full columns[] entry, including sortable/filterable/filterPlaceholder (regression)', () => {
    const onChange = vi.fn()
    const columns: TableColumnConfig[] = [{ id: 'Nombre', sortable: true, filterable: true, filterPlaceholder: 'texto' }]
    const node = dynamicTableNode({ headers: ['Nombre', 'Edad'], columns })
    render(<TableRowsPropertyField label="Filas y columnas" node={node} onChange={onChange} />)

    fireEvent.click(screen.getByRole('button', { name: 'Quitar columna 1' }))

    const nextNode = onChange.mock.calls[0][0] as TableLayoutNode
    expect(nextNode.props.columns).toEqual([])
  })

  it('does not introduce a bordered or background box for the flags around the column-template header input', () => {
    const columns: TableColumnConfig[] = [{ id: 'Nombre', filterable: true }]
    const node = dynamicTableNode({ headers: ['Nombre', 'Edad'], columns })
    render(<TableRowsPropertyField label="Filas y columnas" node={node} onChange={vi.fn()} />)

    const entry = expandedColumnEntryContainer('Expandir columna 1', 'Cabecera de columna 1')
    expect(entry.className).not.toMatch(/\bbg-/)
    // The accordion item's own outer wrapper legitimately has border/rounded classes; only the
    // flags/body region itself must stay bare, so this asserts on the pl-6 body container found
    // by expandedColumnEntryContainer, not the item's outer <div>.
    expect(entry.className).not.toMatch(/\bborder\b/)
  })
})

describe('TableRowsPropertyField dynamic mode column reordering', () => {
  it('dragging a column onto a gap moves the same position in headers and rows.cells atomically; columns[] unaffected', () => {
    const onChange = vi.fn()
    const columns = [{ id: 'Nombre' }]
    const node = dynamicTableNode({
      headers: ['Nombre', 'Edad', 'Ciudad'],
      rows: { source: 'queries.people.data', cells: ['n0', 'n1', 'n2'] } as TableDynamicRows,
      columns,
    })
    render(<TableRowsPropertyField label="Filas y columnas" node={node} onChange={onChange} />)

    act(() => {
      capturedOnDragEnd!({ active: { id: 'item-0' }, over: { id: 'gap-2' } })
    })

    expect(onChange).toHaveBeenCalledTimes(1)
    const nextNode = onChange.mock.calls[0][0] as TableLayoutNode
    expect(nextNode.props.headers).toEqual(['Edad', 'Nombre', 'Ciudad'])
    expect((nextNode.props.rows as TableDynamicRows).cells).toEqual(['n1', 'n0', 'n2'])
    expect(nextNode.props.columns).toEqual(columns)
  })

  it('"Subir"/"Bajar" also move headers and cells atomically', () => {
    const onChange = vi.fn()
    const node = dynamicTableNode({
      headers: ['Nombre', 'Edad'],
      rows: { source: 'queries.people.data', cells: ['n0', 'n1'] } as TableDynamicRows,
    })
    render(<TableRowsPropertyField label="Filas y columnas" node={node} onChange={onChange} />)

    fireEvent.click(screen.getByRole('button', { name: 'Bajar columna 1' }))

    expect(onChange).toHaveBeenCalledTimes(1)
    const nextNode = onChange.mock.calls[0][0] as TableLayoutNode
    expect(nextNode.props.headers).toEqual(['Edad', 'Nombre'])
    expect((nextNode.props.rows as TableDynamicRows).cells).toEqual(['n1', 'n0'])
  })
})

describe('TableRowsPropertyField cell editing', () => {
  it('mounts the cell-type editor for each manual cell with the correct value/emptyTextValue and updates only that cell', () => {
    const onChange = vi.fn()
    const node = manualTableNode({
      headers: ['Nombre', 'Edad'],
      rows: [
        ['Ana', 'texto libre'],
        ['Bea', 'otro texto'],
      ] as TableManualRows,
    })
    render(<TableRowsPropertyField label="Filas y columnas" node={node} onChange={onChange} />)

    fireEvent.click(screen.getByRole('button', { name: 'Expandir fila 1' }))
    const selects = screen.getAllByRole('combobox')
    fireEvent.change(selects[1], { target: { value: 'heading' } })

    expect(onChange).toHaveBeenCalledTimes(1)
    const nextNode = onChange.mock.calls[0][0] as TableLayoutNode
    const nextRows = nextNode.props.rows as TableManualRows
    expect(nextRows[0][1]).toEqual(buildDefaultNodeInstance('heading'))
    expect(nextRows[0][0]).toBe('Ana')
    expect(nextRows[1]).toEqual(['Bea', 'otro texto'])
  })

  it('two cells of the same column in different manual rows can hold distinct types independently (AC9)', () => {
    const onChange = vi.fn()
    const node = manualTableNode({
      headers: ['Nombre', 'Detalle'],
      rows: [
        ['Ana', buildDefaultNodeInstance('heading')],
        ['Bea', buildDefaultNodeInstance('paragraph')],
      ] as TableManualRows,
    })
    render(<TableRowsPropertyField label="Filas y columnas" node={node} onChange={onChange} />)

    fireEvent.click(screen.getByRole('button', { name: 'Expandir fila 1' }))
    fireEvent.click(screen.getByRole('button', { name: 'Expandir fila 2' }))

    const selects = screen.getAllByRole('combobox')
    expect(selects[1]).toHaveValue('heading')
    expect(selects[3]).toHaveValue('paragraph')

    fireEvent.change(selects[1], { target: { value: 'button' } })

    const nextNode = onChange.mock.calls[0][0] as TableLayoutNode
    const nextRows = nextNode.props.rows as TableManualRows
    expect(nextRows[0][1]).toEqual(buildDefaultNodeInstance('button'))
    expect(nextRows[1][1]).toEqual(buildDefaultNodeInstance('paragraph'))
  })

  it('mounts the cell-type editor for a dynamic template cell with EMPTY_DYNAMIC_TABLE_CELL_TEXT_VALUE and updates only that cell', () => {
    const onChange = vi.fn()
    const node = dynamicTableNode({
      headers: ['Nombre', 'Edad'],
      rows: { source: 'queries.people.data', cells: ['—', '—'] } as TableDynamicRows,
    })
    render(<TableRowsPropertyField label="Filas y columnas" node={node} onChange={onChange} />)

    fireEvent.click(screen.getByRole('button', { name: 'Expandir columna 2' }))
    const select = screen.getByRole('combobox')
    fireEvent.change(select, { target: { value: 'button' } })

    expect(onChange).toHaveBeenCalledTimes(1)
    const nextNode = onChange.mock.calls[0][0] as TableLayoutNode
    const nextRows = nextNode.props.rows as TableDynamicRows
    expect(nextRows.cells[1]).toEqual(buildDefaultNodeInstance('button'))
    expect(nextRows.cells[0]).toBe('—')
  })
})

describe('TableRowsPropertyField dynamic source editing', () => {
  it('editing "Origen" invokes onChange with props.rows.source updated, preserving cells intact', () => {
    const onChange = vi.fn()
    const node = dynamicTableNode({
      headers: ['Nombre', 'Edad'],
      rows: { source: 'queries.people.data', cells: ['—', '—'] } as TableDynamicRows,
    })
    render(<TableRowsPropertyField label="Filas y columnas" node={node} onChange={onChange} />)

    const sourceInput = screen.getByLabelText('Origen') as HTMLInputElement
    fireEvent.change(sourceInput, { target: { value: 'queries.otherQuery.data' } })

    expect(onChange).toHaveBeenCalledTimes(1)
    const nextNode = onChange.mock.calls[0][0] as TableLayoutNode
    const nextRows = nextNode.props.rows as TableDynamicRows
    expect(nextRows.source).toBe('queries.otherQuery.data')
    expect(nextRows.cells).toEqual(['—', '—'])
  })
})
