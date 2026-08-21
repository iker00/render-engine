import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { TableColumnConfig } from '../../config/runtime-config'
import { TableColumnFlagsField } from '../../dev-runtime/layout-canvas/property-fields/table-column-flags-field'

describe('TableColumnFlagsField initial rendering', () => {
  it('renders both switches off and no placeholder field when columns is undefined', () => {
    render(<TableColumnFlagsField id="Nombre" columns={undefined} onColumnsChange={vi.fn()} />)

    expect(screen.getByRole('switch', { name: 'Ordenable' })).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByRole('switch', { name: 'Filtrable' })).toHaveAttribute('aria-checked', 'false')
    expect(screen.queryByLabelText('Placeholder del filtro')).not.toBeInTheDocument()
  })

  it('renders no bordered/background container around the checks or the placeholder field', () => {
    const columns: TableColumnConfig[] = [{ id: 'Nombre', filterable: true }]
    const { container } = render(<TableColumnFlagsField id="Nombre" columns={columns} onColumnsChange={vi.fn()} />)

    const root = container.firstElementChild as HTMLElement
    expect(root.className).not.toMatch(/\bborder\b/)
    expect(root.className).not.toMatch(/\bbg-/)
  })
})

describe('TableColumnFlagsField sortable toggle', () => {
  it('marking "Ordenable" on undefined columns calls onColumnsChange with a fresh entry', () => {
    const onColumnsChange = vi.fn()
    render(<TableColumnFlagsField id="Nombre" columns={undefined} onColumnsChange={onColumnsChange} />)

    fireEvent.click(screen.getByRole('switch', { name: 'Ordenable' }))

    expect(onColumnsChange).toHaveBeenCalledWith([{ id: 'Nombre', sortable: true }])
  })

  it('marking "Ordenable" on a column already filterable keeps filterable untouched', () => {
    const onColumnsChange = vi.fn()
    const columns: TableColumnConfig[] = [{ id: 'Nombre', filterable: true }]
    render(<TableColumnFlagsField id="Nombre" columns={columns} onColumnsChange={onColumnsChange} />)

    fireEvent.click(screen.getByRole('switch', { name: 'Ordenable' }))

    expect(onColumnsChange).toHaveBeenCalledWith([{ id: 'Nombre', filterable: true, sortable: true }])
  })

  it('unmarking "Ordenable" on a sortable+filterable column keeps the entry without sortable', () => {
    const onColumnsChange = vi.fn()
    const columns: TableColumnConfig[] = [{ id: 'Nombre', sortable: true, filterable: true }]
    render(<TableColumnFlagsField id="Nombre" columns={columns} onColumnsChange={onColumnsChange} />)

    fireEvent.click(screen.getByRole('switch', { name: 'Ordenable' }))

    expect(onColumnsChange).toHaveBeenCalledWith([{ id: 'Nombre', filterable: true }])
  })

  it('unmarking "Ordenable" on a sortable-only column removes the entry entirely', () => {
    const onColumnsChange = vi.fn()
    const columns: TableColumnConfig[] = [{ id: 'Nombre', sortable: true }]
    render(<TableColumnFlagsField id="Nombre" columns={columns} onColumnsChange={onColumnsChange} />)

    fireEvent.click(screen.getByRole('switch', { name: 'Ordenable' }))

    expect(onColumnsChange).toHaveBeenCalledWith([])
  })
})

describe('TableColumnFlagsField filterable toggle and placeholder field', () => {
  it('marking "Filtrable" on undefined columns calls onColumnsChange and, after rerender, shows an empty placeholder field', () => {
    const onColumnsChange = vi.fn()
    const { rerender } = render(<TableColumnFlagsField id="Nombre" columns={undefined} onColumnsChange={onColumnsChange} />)

    fireEvent.click(screen.getByRole('switch', { name: 'Filtrable' }))

    expect(onColumnsChange).toHaveBeenCalledWith([{ id: 'Nombre', filterable: true }])

    rerender(<TableColumnFlagsField id="Nombre" columns={[{ id: 'Nombre', filterable: true }]} onColumnsChange={onColumnsChange} />)

    expect(screen.getByLabelText('Placeholder del filtro')).toHaveValue('')
  })

  it('typing in "Placeholder del filtro" sets filterPlaceholder without altering sortable/filterable', () => {
    const onColumnsChange = vi.fn()
    const columns: TableColumnConfig[] = [{ id: 'Nombre', sortable: true, filterable: true }]
    render(<TableColumnFlagsField id="Nombre" columns={columns} onColumnsChange={onColumnsChange} />)

    fireEvent.change(screen.getByLabelText('Placeholder del filtro'), { target: { value: 'Buscar…' } })

    expect(onColumnsChange).toHaveBeenCalledWith([{ id: 'Nombre', sortable: true, filterable: true, filterPlaceholder: 'Buscar…' }])
  })

  it('unmarking "Filtrable" on a sortable+filterable+placeholder column keeps only sortable and hides the placeholder field', () => {
    const onColumnsChange = vi.fn()
    const columns: TableColumnConfig[] = [{ id: 'Nombre', filterable: true, filterPlaceholder: 'texto', sortable: true }]
    const { rerender } = render(<TableColumnFlagsField id="Nombre" columns={columns} onColumnsChange={onColumnsChange} />)

    fireEvent.click(screen.getByRole('switch', { name: 'Filtrable' }))

    expect(onColumnsChange).toHaveBeenCalledWith([{ id: 'Nombre', sortable: true }])

    rerender(<TableColumnFlagsField id="Nombre" columns={[{ id: 'Nombre', sortable: true }]} onColumnsChange={onColumnsChange} />)

    expect(screen.queryByLabelText('Placeholder del filtro')).not.toBeInTheDocument()
  })

  it('unmarking "Filtrable" on a filterable+placeholder column with no sortable removes the entry entirely', () => {
    const onColumnsChange = vi.fn()
    const columns: TableColumnConfig[] = [{ id: 'Nombre', filterable: true, filterPlaceholder: 'texto' }]
    render(<TableColumnFlagsField id="Nombre" columns={columns} onColumnsChange={onColumnsChange} />)

    fireEvent.click(screen.getByRole('switch', { name: 'Filtrable' }))

    expect(onColumnsChange).toHaveBeenCalledWith([])
  })

  it('re-marking "Filtrable" after unmarking shows an empty placeholder, not the previous text', () => {
    const onColumnsChange = vi.fn()
    const { rerender } = render(
      <TableColumnFlagsField id="Nombre" columns={[{ id: 'Nombre', filterable: true, filterPlaceholder: 'anterior' }]} onColumnsChange={onColumnsChange} />,
    )

    rerender(<TableColumnFlagsField id="Nombre" columns={[]} onColumnsChange={onColumnsChange} />)
    expect(screen.queryByLabelText('Placeholder del filtro')).not.toBeInTheDocument()

    rerender(<TableColumnFlagsField id="Nombre" columns={[{ id: 'Nombre', filterable: true }]} onColumnsChange={onColumnsChange} />)

    expect(screen.getByLabelText('Placeholder del filtro')).toHaveValue('')
  })

  it('clearing "Placeholder del filtro" to empty removes the key without removing filterable', () => {
    const onColumnsChange = vi.fn()
    const columns: TableColumnConfig[] = [{ id: 'Nombre', filterable: true, filterPlaceholder: 'texto' }]
    render(<TableColumnFlagsField id="Nombre" columns={columns} onColumnsChange={onColumnsChange} />)

    fireEvent.change(screen.getByLabelText('Placeholder del filtro'), { target: { value: '' } })

    expect(onColumnsChange).toHaveBeenCalledWith([{ id: 'Nombre', filterable: true }])
  })
})
