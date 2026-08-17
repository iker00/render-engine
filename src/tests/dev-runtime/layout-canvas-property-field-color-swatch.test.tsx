import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ColorSwatchPropertyField } from '../../dev-runtime/layout-canvas/property-fields/color-swatch-property-field'

describe('ColorSwatchPropertyField row layout', () => {
  it('renders in a label-left/control-right row, with the label text visible', () => {
    render(<ColorSwatchPropertyField label="color" value="primary" onChange={vi.fn()} />)

    expect(screen.getByText('color')).toBeInTheDocument()
    expect(screen.getByRole('radiogroup', { name: 'color' })).toBeInTheDocument()
  })
})

describe('ColorSwatchPropertyField swatch rendering', () => {
  it('always renders the six fixed swatches, in the fixed order, regardless of value', () => {
    render(<ColorSwatchPropertyField label="color" value="primary" onChange={vi.fn()} />)

    const radios = screen.getAllByRole('radio')
    expect(radios.map((radio) => radio.getAttribute('aria-label'))).toEqual([
      'neutral',
      'primary',
      'success',
      'warning',
      'danger',
      'info',
    ])
  })

  it('renders the same six swatches for a value outside the catalog', () => {
    render(<ColorSwatchPropertyField label="color" value="morado" onChange={vi.fn()} />)

    expect(screen.getAllByRole('radio')).toHaveLength(6)
  })

  it('renders the same six swatches when value is undefined', () => {
    render(<ColorSwatchPropertyField label="color" value={undefined} onChange={vi.fn()} />)

    expect(screen.getAllByRole('radio')).toHaveLength(6)
  })

  it('marks only the swatch matching value as active via aria-checked', () => {
    render(<ColorSwatchPropertyField label="color" value="success" onChange={vi.fn()} />)

    expect(screen.getByRole('radio', { name: 'success' })).toHaveAttribute('aria-checked', 'true')
    ;['neutral', 'primary', 'warning', 'danger', 'info'].forEach((name) => {
      expect(screen.getByRole('radio', { name })).toHaveAttribute('aria-checked', 'false')
    })
  })

  it('marks no swatch as active when value is outside the catalog, without throwing', () => {
    expect(() => render(<ColorSwatchPropertyField label="color" value="morado" onChange={vi.fn()} />)).not.toThrow()

    screen.getAllByRole('radio').forEach((radio) => expect(radio).toHaveAttribute('aria-checked', 'false'))
  })

  it('marks no swatch as active when value is undefined, without throwing', () => {
    expect(() => render(<ColorSwatchPropertyField label="color" value={undefined} onChange={vi.fn()} />)).not.toThrow()

    screen.getAllByRole('radio').forEach((radio) => expect(radio).toHaveAttribute('aria-checked', 'false'))
  })
})

describe('ColorSwatchPropertyField active name text (FR4)', () => {
  it('shows the semantic name of the active swatch next to the swatches', () => {
    render(<ColorSwatchPropertyField label="color" value="primary" onChange={vi.fn()} />)

    expect(screen.getByText('primary')).toBeInTheDocument()
  })

  it('does not render the active name text (absent from the DOM) when value is outside the catalog', () => {
    render(<ColorSwatchPropertyField label="color" value="morado" onChange={vi.fn()} />)

    expect(screen.queryByText('morado')).not.toBeInTheDocument()
  })

  it('does not render the active name text when value is undefined', () => {
    render(<ColorSwatchPropertyField label="color" value={undefined} onChange={vi.fn()} />)

    ;['neutral', 'primary', 'success', 'warning', 'danger', 'info'].forEach((name) => {
      // The name only appears as each swatch's aria-label, never as visible text, when none is active.
      expect(screen.queryByText(name)).not.toBeInTheDocument()
    })
  })
})

describe('ColorSwatchPropertyField onChange behavior', () => {
  it('calls onChange once with the clicked swatch name when it differs from the active one', () => {
    const onChange = vi.fn()
    render(<ColorSwatchPropertyField label="color" value="primary" onChange={onChange} />)

    fireEvent.click(screen.getByRole('radio', { name: 'danger' }))

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith('danger')
  })

  it('does not call onChange when clicking the already-active swatch (idempotency)', () => {
    const onChange = vi.fn()
    render(<ColorSwatchPropertyField label="color" value="primary" onChange={onChange} />)

    fireEvent.click(screen.getByRole('radio', { name: 'primary' }))

    expect(onChange).not.toHaveBeenCalled()
  })
})

describe('ColorSwatchPropertyField keyboard navigation', () => {
  it('ArrowRight moves focus to the next swatch and selects it', () => {
    const onChange = vi.fn()
    render(<ColorSwatchPropertyField label="color" value="neutral" onChange={onChange} />)

    const radios = screen.getAllByRole('radio')
    radios[0].focus()
    fireEvent.keyDown(radios[0], { key: 'ArrowRight' })

    expect(document.activeElement).toBe(radios[1])
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith('primary')
  })

  it('ArrowLeft moves focus to the previous swatch and selects it', () => {
    const onChange = vi.fn()
    render(<ColorSwatchPropertyField label="color" value="success" onChange={onChange} />)

    const radios = screen.getAllByRole('radio')
    radios[2].focus()
    fireEvent.keyDown(radios[2], { key: 'ArrowLeft' })

    expect(document.activeElement).toBe(radios[1])
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith('primary')
  })

  it('wraps focus to the first swatch when ArrowRight is pressed at the right edge', () => {
    const onChange = vi.fn()
    render(<ColorSwatchPropertyField label="color" value="info" onChange={onChange} />)

    const radios = screen.getAllByRole('radio')
    radios[5].focus()
    fireEvent.keyDown(radios[5], { key: 'ArrowRight' })

    expect(document.activeElement).toBe(radios[0])
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith('neutral')
  })

  it('wraps focus to the last swatch when ArrowLeft is pressed at the left edge', () => {
    const onChange = vi.fn()
    render(<ColorSwatchPropertyField label="color" value="neutral" onChange={onChange} />)

    const radios = screen.getAllByRole('radio')
    radios[0].focus()
    fireEvent.keyDown(radios[0], { key: 'ArrowLeft' })

    expect(document.activeElement).toBe(radios[5])
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith('info')
  })
})

describe('ColorSwatchPropertyField roving tabindex', () => {
  it('only the active swatch is a Tab stop', () => {
    render(<ColorSwatchPropertyField label="color" value="warning" onChange={vi.fn()} />)

    screen.getAllByRole('radio').forEach((radio) => {
      const expected = radio.getAttribute('aria-label') === 'warning' ? '0' : '-1'
      expect(radio).toHaveAttribute('tabIndex', expected)
    })
  })

  it('the first swatch is the Tab stop when no swatch is active', () => {
    render(<ColorSwatchPropertyField label="color" value={undefined} onChange={vi.fn()} />)

    const radios = screen.getAllByRole('radio')
    expect(radios[0]).toHaveAttribute('tabIndex', '0')
    radios.slice(1).forEach((radio) => expect(radio).toHaveAttribute('tabIndex', '-1'))
  })
})
