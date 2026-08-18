import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  ICON_PICKER_PAGE_SIZE,
  IconPickerPropertyField,
} from '../../dev-runtime/layout-canvas/property-fields/icon-picker-property-field'
import { CATALOG } from './lucide-react-mock'

vi.mock('lucide-react', async () => {
  const { createLucideReactMock } = await import('./lucide-react-mock')
  return createLucideReactMock()
})

// Re-registers the `lucide-react` mock with a different catalog for a single test (dedup,
// pagination), then dynamically re-imports `IconPickerPropertyField` so its module-scope
// `ICON_CATALOG` is recomputed against it — `ICON_CATALOG` is derived once at module load, so
// observing a different catalog requires a fresh module evaluation, not just a fresh render.
// `vi.doMock` (unlike mutating a variable read by the static `vi.mock` factory above) reliably
// takes effect on the next `import(...)` once paired with `vi.resetModules()`.
async function importIconPickerWithCatalog(extraIconNames: readonly string[], iconNames?: readonly string[]) {
  vi.doMock('lucide-react', async () => {
    const { createLucideReactMock } = await import('./lucide-react-mock')
    return createLucideReactMock(extraIconNames, iconNames)
  })
  vi.resetModules()
  return import('../../dev-runtime/layout-canvas/property-fields/icon-picker-property-field')
}

afterEach(() => {
  vi.doUnmock('lucide-react')
})

describe('IconPickerPropertyField catalog rendering', () => {
  it('renders exactly one gridcell per mocked catalog icon when query and value are empty', () => {
    render(<IconPickerPropertyField label="Icono" value={undefined} onChange={vi.fn()} />)
    fireEvent.focus(screen.getByRole('textbox', { name: 'Buscar icono' }))

    const cells = screen.getAllByRole('gridcell')
    expect(cells).toHaveLength(CATALOG.length)
    CATALOG.forEach((name) => {
      expect(screen.getByText(name)).toBeInTheDocument()
    })
  })

  it('does not render a cell for the non-icon export declared in the mock', () => {
    render(<IconPickerPropertyField label="Icono" value={undefined} onChange={vi.fn()} />)
    fireEvent.focus(screen.getByRole('textbox', { name: 'Buscar icono' }))

    expect(screen.queryByText('createLucideIcon')).not.toBeInTheDocument()
  })

  it('exposes an accessible grid name derived from label', () => {
    render(<IconPickerPropertyField label="Icono del botón" value={undefined} onChange={vi.fn()} />)
    fireEvent.focus(screen.getByRole('textbox', { name: 'Buscar icono' }))

    expect(screen.getByRole('grid', { name: 'Icono del botón' })).toBeInTheDocument()
  })

  it('each visible cell renders an svg preview via IconNode', () => {
    render(<IconPickerPropertyField label="Icono" value={undefined} onChange={vi.fn()} />)
    fireEvent.focus(screen.getByRole('textbox', { name: 'Buscar icono' }))

    screen.getAllByRole('gridcell').forEach((cell) => {
      expect(cell.querySelector('svg')).not.toBeNull()
    })
  })
})

describe('IconPickerPropertyField filtering', () => {
  it('reduces the visible list to names containing the query, case-insensitively', () => {
    render(<IconPickerPropertyField label="Icono" value={undefined} onChange={vi.fn()} />)

    const input = screen.getByRole('textbox', { name: 'Buscar icono' })
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'home' } })

    const cells = screen.getAllByRole('gridcell')
    expect(cells).toHaveLength(1)
    expect(screen.getByText('Home')).toBeInTheDocument()
    expect(screen.queryByText('Settings')).not.toBeInTheDocument()
    expect(screen.queryByText('Bell')).not.toBeInTheDocument()
    expect(screen.queryByText('Users')).not.toBeInTheDocument()
  })

  it('renders no cells and no alert when the query matches nothing, keeping the input editable', () => {
    render(<IconPickerPropertyField label="Icono" value={undefined} onChange={vi.fn()} />)

    const input = screen.getByRole('textbox', { name: 'Buscar icono' })
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'xyz_definitely_none' } })

    expect(screen.queryAllByRole('gridcell')).toEqual([])
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()

    fireEvent.change(input, { target: { value: 'xyz_definitely_none_more' } })
    expect(input).toHaveValue('xyz_definitely_none_more')
  })
})

describe('IconPickerPropertyField selection highlight', () => {
  it('marks the cell matching value as aria-selected=true and the rest as false', () => {
    render(<IconPickerPropertyField label="Icono" value="Home" onChange={vi.fn()} />)
    fireEvent.focus(screen.getByRole('textbox', { name: 'Buscar icono' }))

    const cells = screen.getAllByRole('gridcell')
    const selected = cells.filter((cell) => cell.getAttribute('aria-selected') === 'true')
    const notSelected = cells.filter((cell) => cell.getAttribute('aria-selected') === 'false')

    expect(selected).toHaveLength(1)
    expect(selected[0]).toHaveTextContent('Home')
    expect(notSelected).toHaveLength(CATALOG.length - 1)
  })

  it('highlights no cell, keeps the full catalog visible and shows the raw value when unrecognized', () => {
    render(<IconPickerPropertyField label="Icono" value="NombreQueNoExisteEnLucide" onChange={vi.fn()} />)
    fireEvent.focus(screen.getByRole('textbox', { name: 'Buscar icono' }))

    const cells = screen.getAllByRole('gridcell')
    expect(cells).toHaveLength(CATALOG.length)
    expect(cells.every((cell) => cell.getAttribute('aria-selected') === 'false')).toBe(true)
    expect(screen.getByText('NombreQueNoExisteEnLucide')).toBeInTheDocument()
  })
})

describe('IconPickerPropertyField selection behavior', () => {
  it('calls onChange once with the clicked cell name when it differs from value', () => {
    const onChange = vi.fn()
    render(<IconPickerPropertyField label="Icono" value="Home" onChange={onChange} />)
    fireEvent.focus(screen.getByRole('textbox', { name: 'Buscar icono' }))

    fireEvent.click(screen.getByText('Settings').closest('[role="gridcell"]')!)

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith('Settings')
  })

  it('does not call onChange when clicking the already-selected cell', () => {
    const onChange = vi.fn()
    render(<IconPickerPropertyField label="Icono" value="Settings" onChange={onChange} />)
    fireEvent.focus(screen.getByRole('textbox', { name: 'Buscar icono' }))

    // `getByText` is scoped to the grid because the recognized-value preview chip (T5) also
    // renders the name "Settings" next to the input, outside the grid.
    fireEvent.click(within(screen.getByRole('grid')).getByText('Settings').closest('[role="gridcell"]')!)

    expect(onChange).not.toHaveBeenCalled()
  })

  it('Enter on a focused, different cell calls onChange once with that cell name', () => {
    const onChange = vi.fn()
    render(<IconPickerPropertyField label="Icono" value="Settings" onChange={onChange} />)
    fireEvent.focus(screen.getByRole('textbox', { name: 'Buscar icono' }))

    const homeCell = screen.getByText('Home').closest('[role="gridcell"]')!
    fireEvent.focus(homeCell)
    fireEvent.keyDown(homeCell, { key: 'Enter' })

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith('Home')
  })
})

describe('IconPickerPropertyField disclosure (T5, 0129)', () => {
  it('does not mount the grid on initial render, regardless of value', () => {
    render(<IconPickerPropertyField label="Icono" value="Home" onChange={vi.fn()} />)

    expect(screen.queryByRole('grid')).not.toBeInTheDocument()
    expect(screen.queryAllByRole('gridcell')).toEqual([])
  })

  it('focusing the search input opens the grid: cells appear and the input reports aria-expanded=true', () => {
    render(<IconPickerPropertyField label="Icono" value={undefined} onChange={vi.fn()} />)

    const input = screen.getByRole('textbox', { name: 'Buscar icono' })
    fireEvent.focus(input)

    expect(screen.getAllByRole('gridcell').length).toBeGreaterThan(0)
    expect(input).toHaveAttribute('aria-expanded', 'true')
  })

  it('shows a preview chip with the icon and its name for a recognized value while the grid stays closed', () => {
    render(<IconPickerPropertyField label="Icono" value="Home" onChange={vi.fn()} />)

    expect(screen.queryByRole('grid')).not.toBeInTheDocument()
    expect(screen.getByText('Home')).toBeInTheDocument()
    expect(document.querySelector('svg')).not.toBeNull()
  })

  it('keeps showing the "Valor actual" note for an unrecognized value without opening the grid', () => {
    render(<IconPickerPropertyField label="Icono" value="NombreQueNoExisteEnLucide" onChange={vi.fn()} />)

    expect(screen.queryByRole('grid')).not.toBeInTheDocument()
    expect(screen.getByText('NombreQueNoExisteEnLucide')).toBeInTheDocument()
  })

  it('clicking a cell closes the grid and returns focus to the search input, even when it changes value', () => {
    const onChange = vi.fn()
    render(<IconPickerPropertyField label="Icono" value="Home" onChange={onChange} />)
    const input = screen.getByRole('textbox', { name: 'Buscar icono' })
    fireEvent.focus(input)

    fireEvent.click(screen.getByText('Settings').closest('[role="gridcell"]')!)

    expect(onChange).toHaveBeenCalledWith('Settings')
    expect(screen.queryAllByRole('gridcell')).toEqual([])
    expect(document.activeElement).toBe(input)
  })

  it('reclicking the already-selected cell closes the grid and refocuses the input without calling onChange', () => {
    const onChange = vi.fn()
    render(<IconPickerPropertyField label="Icono" value="Settings" onChange={onChange} />)
    const input = screen.getByRole('textbox', { name: 'Buscar icono' })
    fireEvent.focus(input)

    // Scoped to the grid: the preview chip for the recognized value "Settings" also renders that
    // name next to the input (T5).
    fireEvent.click(within(screen.getByRole('grid')).getByText('Settings').closest('[role="gridcell"]')!)

    expect(onChange).not.toHaveBeenCalled()
    expect(screen.queryAllByRole('gridcell')).toEqual([])
    expect(document.activeElement).toBe(input)
  })

  it('Enter on a focused cell closes the grid, refocuses the input and calls onChange', () => {
    const onChange = vi.fn()
    render(<IconPickerPropertyField label="Icono" value="Settings" onChange={onChange} />)
    const input = screen.getByRole('textbox', { name: 'Buscar icono' })
    fireEvent.focus(input)

    const homeCell = screen.getByText('Home').closest('[role="gridcell"]')!
    fireEvent.keyDown(homeCell, { key: 'Enter' })

    expect(onChange).toHaveBeenCalledWith('Home')
    expect(screen.queryAllByRole('gridcell')).toEqual([])
    expect(document.activeElement).toBe(input)
  })

  it('Escape with focus on a cell closes the grid, refocuses the input and does not call onChange', () => {
    const onChange = vi.fn()
    render(<IconPickerPropertyField label="Icono" value="Home" onChange={onChange} />)
    const input = screen.getByRole('textbox', { name: 'Buscar icono' })
    fireEvent.focus(input)

    const settingsCell = screen.getByText('Settings').closest('[role="gridcell"]')!
    fireEvent.keyDown(settingsCell, { key: 'Escape' })

    expect(onChange).not.toHaveBeenCalled()
    expect(screen.queryAllByRole('gridcell')).toEqual([])
    expect(document.activeElement).toBe(input)
  })

  it('Escape with focus on the input closes the already-open grid and leaves focus on the input', () => {
    render(<IconPickerPropertyField label="Icono" value={undefined} onChange={vi.fn()} />)
    const input = screen.getByRole('textbox', { name: 'Buscar icono' })
    fireEvent.focus(input)
    expect(screen.getAllByRole('gridcell').length).toBeGreaterThan(0)

    fireEvent.keyDown(input, { key: 'Escape' })

    expect(screen.queryAllByRole('gridcell')).toEqual([])
    expect(document.activeElement).toBe(input)
  })

  it('a mousedown outside the widget closes the open grid', () => {
    const { container } = render(
      <div>
        <IconPickerPropertyField label="Icono" value={undefined} onChange={vi.fn()} />
        <button type="button">Fuera del widget</button>
      </div>,
    )
    const input = screen.getByRole('textbox', { name: 'Buscar icono' })
    fireEvent.focus(input)
    expect(screen.getAllByRole('gridcell').length).toBeGreaterThan(0)

    fireEvent.mouseDown(screen.getByRole('button', { name: 'Fuera del widget' }))

    expect(screen.queryAllByRole('gridcell')).toEqual([])
    expect(container).toBeInTheDocument()
  })

  it('ArrowDown on a closed grid opens it and moves focus to the first visible cell in one interaction', () => {
    render(<IconPickerPropertyField label="Icono" value={undefined} onChange={vi.fn()} />)
    const input = screen.getByRole('textbox', { name: 'Buscar icono' })

    expect(screen.queryByRole('grid')).not.toBeInTheDocument()
    fireEvent.keyDown(input, { key: 'ArrowDown' })

    const cells = screen.getAllByRole('gridcell')
    expect(document.activeElement).toBe(cells[0])
  })

  it('ArrowDown on an already-open grid moves focus to the first visible cell (T1/T4 regression)', () => {
    render(<IconPickerPropertyField label="Icono" value={undefined} onChange={vi.fn()} />)
    const input = screen.getByRole('textbox', { name: 'Buscar icono' })
    fireEvent.focus(input)

    fireEvent.keyDown(input, { key: 'ArrowDown' })

    const cells = screen.getAllByRole('gridcell')
    expect(document.activeElement).toBe(cells[0])
  })

  it('"Quitar icono" with the grid closed does not open it', () => {
    render(<IconPickerPropertyField label="Icono" value="Home" onChange={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: /Quitar icono/i }))

    expect(screen.queryByRole('grid')).not.toBeInTheDocument()
  })

  it('"Quitar icono" with the grid open does not close it', () => {
    render(<IconPickerPropertyField label="Icono" value="Home" onChange={vi.fn()} />)
    fireEvent.focus(screen.getByRole('textbox', { name: 'Buscar icono' }))

    fireEvent.click(screen.getByRole('button', { name: /Quitar icono/i }))

    expect(screen.getAllByRole('gridcell').length).toBeGreaterThan(0)
  })
})

describe('IconPickerPropertyField clear control', () => {
  it('shows the clear button for a non-empty string value and calls onChange(undefined) once', () => {
    const onChange = vi.fn()
    render(<IconPickerPropertyField label="Icono" value="Home" onChange={onChange} />)

    const clearButton = screen.getByRole('button', { name: /Quitar icono/i })
    fireEvent.click(clearButton)

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith(undefined)
  })

  it('hides the clear button when value is undefined', () => {
    render(<IconPickerPropertyField label="Icono" value={undefined} onChange={vi.fn()} />)

    expect(screen.queryByRole('button', { name: /Quitar icono/i })).not.toBeInTheDocument()
  })

  it('hides the clear button when value is an empty string', () => {
    render(<IconPickerPropertyField label="Icono" value="" onChange={vi.fn()} />)

    expect(screen.queryByRole('button', { name: /Quitar icono/i })).not.toBeInTheDocument()
  })
})

describe('IconPickerPropertyField keyboard navigation', () => {
  it('ArrowRight moves focus within the row; ArrowDown moves focus to the row below', () => {
    render(<IconPickerPropertyField label="Icono" value={undefined} onChange={vi.fn()} />)
    fireEvent.focus(screen.getByRole('textbox', { name: 'Buscar icono' }))

    const cells = screen.getAllByRole('gridcell')
    cells[0].focus()

    fireEvent.keyDown(cells[0], { key: 'ArrowRight' })
    expect(document.activeElement).toBe(cells[1])

    cells[0].focus()
    fireEvent.keyDown(cells[0], { key: 'ArrowDown' })
    expect(document.activeElement).toBe(cells[4])
  })

  it('clamps focus at the top-left corner: ArrowUp and ArrowLeft do not move it', () => {
    render(<IconPickerPropertyField label="Icono" value={undefined} onChange={vi.fn()} />)
    fireEvent.focus(screen.getByRole('textbox', { name: 'Buscar icono' }))

    const cells = screen.getAllByRole('gridcell')
    cells[0].focus()

    fireEvent.keyDown(cells[0], { key: 'ArrowUp' })
    expect(document.activeElement).toBe(cells[0])

    fireEvent.keyDown(cells[0], { key: 'ArrowLeft' })
    expect(document.activeElement).toBe(cells[0])
  })

  it('ArrowDown from the search input moves focus to the first visible cell', () => {
    render(<IconPickerPropertyField label="Icono" value={undefined} onChange={vi.fn()} />)

    const input = screen.getByRole('textbox', { name: 'Buscar icono' })
    input.focus()
    fireEvent.keyDown(input, { key: 'ArrowDown' })

    const cells = screen.getAllByRole('gridcell')
    expect(document.activeElement).toBe(cells[0])
  })
})

describe('IconPickerPropertyField catalog dedup regression', () => {
  it('derives its catalog from the icons registry, excluding a namespace-only alias absent from it', async () => {
    // Mirrors the real `lucide-react` package's own shape: every icon export also has an
    // `Icon`-suffixed alias in the namespace (e.g. `Home`/`HomeIcon`), but only the un-suffixed
    // name lives in the canonical `icons` registry. `extraIconNames` adds `HomeIcon` to the mocked
    // namespace without adding it to the mock's `icons` registry (see `lucide-react-mock.ts`).
    const { IconPickerPropertyField: DedupField } = await importIconPickerWithCatalog(['HomeIcon'])
    render(<DedupField label="Icono" value={undefined} onChange={vi.fn()} />)
    fireEvent.focus(screen.getByRole('textbox', { name: 'Buscar icono' }))

    expect(screen.getByText('Home')).toBeInTheDocument()
    expect(screen.queryByText('HomeIcon')).not.toBeInTheDocument()
  })
})

describe('IconPickerPropertyField row layout (T3, 0136)', () => {
  it('renders label as a <label> associated with the search input via htmlFor/id, without changing its aria-label', () => {
    render(<IconPickerPropertyField label="Icono" value={undefined} onChange={vi.fn()} />)

    const input = screen.getByRole('textbox', { name: 'Buscar icono' })
    const label = screen.getByText('Icono')

    expect(label.tagName).toBe('LABEL')
    expect(label).toHaveAttribute('for', input.id)
    // `getByLabelText` resolves purely via the <label htmlFor>/id association, independent of
    // the input's own `aria-label` — confirming both mechanisms point at the same input.
    expect(screen.getByLabelText('Icono')).toBe(input)
  })

  it('places the label before the search input in the standard row, and keeps the open grid outside that row (full-width placement)', () => {
    render(<IconPickerPropertyField label="Icono" value={undefined} onChange={vi.fn()} />)

    const input = screen.getByRole('textbox', { name: 'Buscar icono' })
    const label = screen.getByText('Icono')

    // Label-left / control-right: the label node precedes the search input in DOM order.
    expect(label.compareDocumentPosition(input) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    const row = label.parentElement!
    expect(row.contains(input)).toBe(true)

    fireEvent.focus(input)
    const grid = screen.getByRole('grid')

    // The grid is not nested inside the label/input row — it spans the widget's full width as a
    // sibling below the row, not constrained to the row's right-hand column.
    expect(row.contains(grid)).toBe(false)
  })
})

describe('IconPickerPropertyField pagination', () => {
  // Programmatically generated, not real Lucide names: exactly two full pages plus a partial
  // third, so the tests below can assert page boundaries without depending on any real icon name
  // or its spelling.
  const PAGINATION_ICON_NAMES = Array.from(
    { length: ICON_PICKER_PAGE_SIZE * 2 + 5 },
    (_, index) => `MockIcon${String(index).padStart(3, '0')}`,
  )

  async function renderPaginatedPicker(onChange: (value: unknown) => void = vi.fn()) {
    const { IconPickerPropertyField: PaginatedField } = await importIconPickerWithCatalog([], PAGINATION_ICON_NAMES)
    render(<PaginatedField label="Icono" value={undefined} onChange={onChange} />)
    // Every pagination case below assumes the grid is already visible (T5, 0129): the disclosure
    // itself is covered separately in "IconPickerPropertyField disclosure", so opening it here
    // once keeps this describe block focused on pagination behavior.
    fireEvent.focus(screen.getByRole('textbox', { name: 'Buscar icono' }))
  }

  it('shows only the first page, with Previous disabled and Next enabled', async () => {
    await renderPaginatedPicker()

    expect(screen.getAllByRole('gridcell')).toHaveLength(ICON_PICKER_PAGE_SIZE)
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Siguiente' })).not.toBeDisabled()
    expect(screen.getByText('Página 1 de 3')).toBeInTheDocument()
  })

  it('Next shows a second page of distinct cells and enables Previous', async () => {
    await renderPaginatedPicker()
    const firstPageNames = screen.getAllByRole('gridcell').map((cell) => cell.textContent)

    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }))

    const secondPageCells = screen.getAllByRole('gridcell')
    expect(secondPageCells).toHaveLength(ICON_PICKER_PAGE_SIZE)
    const secondPageNames = secondPageCells.map((cell) => cell.textContent)
    expect(secondPageNames.some((name) => firstPageNames.includes(name))).toBe(false)
    expect(screen.getByRole('button', { name: 'Anterior' })).not.toBeDisabled()
    expect(screen.getByText('Página 2 de 3')).toBeInTheDocument()
  })

  it('advancing to the last page shows the remaining cells and disables Next', async () => {
    await renderPaginatedPicker()

    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }))

    expect(screen.getAllByRole('gridcell')).toHaveLength(5)
    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeDisabled()
    expect(screen.getByText('Página 3 de 3')).toBeInTheDocument()
  })

  it('Previous from the last page goes back one page', async () => {
    await renderPaginatedPicker()

    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    fireEvent.click(screen.getByRole('button', { name: 'Anterior' }))

    expect(screen.getAllByRole('gridcell')).toHaveLength(ICON_PICKER_PAGE_SIZE)
    expect(screen.getByText('Página 2 de 3')).toBeInTheDocument()
  })

  it('resets to page 1 of the new filtered result when searching from page 2', async () => {
    await renderPaginatedPicker()
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    expect(screen.getByText('Página 2 de 3')).toBeInTheDocument()

    fireEvent.change(screen.getByRole('textbox', { name: 'Buscar icono' }), { target: { value: 'mockicon' } })

    expect(screen.getByText('Página 1 de 3')).toBeInTheDocument()
    expect(screen.getAllByRole('gridcell')).toHaveLength(ICON_PICKER_PAGE_SIZE)
  })

  it('shows no Previous/Next controls or page text when the result fits a single page', async () => {
    await renderPaginatedPicker()

    fireEvent.change(screen.getByRole('textbox', { name: 'Buscar icono' }), { target: { value: 'MockIcon000' } })

    expect(screen.queryByRole('button', { name: /Anterior|Siguiente/i })).not.toBeInTheDocument()
    expect(screen.queryByText(/Página \d+ de \d+/)).not.toBeInTheDocument()
  })

  it('keyboard navigation clamps within the visible page instead of advancing pages', async () => {
    await renderPaginatedPicker()

    const cells = screen.getAllByRole('gridcell')
    const lastCell = cells[cells.length - 1]
    lastCell.focus()
    fireEvent.keyDown(lastCell, { key: 'ArrowRight' })
    fireEvent.keyDown(lastCell, { key: 'ArrowRight' })
    fireEvent.keyDown(lastCell, { key: 'ArrowDown' })
    fireEvent.keyDown(lastCell, { key: 'ArrowDown' })

    expect(document.activeElement).toBe(lastCell)
    expect(screen.getByText('Página 1 de 3')).toBeInTheDocument()
  })

  it('selecting a cell on the visible page still calls onChange with that cell name', async () => {
    const onChange = vi.fn()
    await renderPaginatedPicker(onChange)

    fireEvent.click(screen.getByText('MockIcon000').closest('[role="gridcell"]')!)

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith('MockIcon000')
  })
})
