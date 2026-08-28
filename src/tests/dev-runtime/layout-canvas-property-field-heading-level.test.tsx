import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { HeadingLevelPropertyField } from '../../dev-runtime/layout-canvas/property-fields/heading-level-property-field'

describe('HeadingLevelPropertyField active segment resolution', () => {
  it('marks only "H2" active when value is 2', () => {
    render(<HeadingLevelPropertyField label="level" value={2} onChange={vi.fn()} />)

    const radios = screen.getAllByRole('radio')
    expect(radios.map((radio) => radio.textContent)).toEqual(['H1', 'H2', 'H3', 'H4', 'H5'])
    expect(screen.getByRole('radio', { name: 'H2' })).toHaveAttribute('aria-checked', 'true')
    radios
      .filter((radio) => radio.textContent !== 'H2')
      .forEach((radio) => expect(radio).toHaveAttribute('aria-checked', 'false'))
  })

  it.each([1, 3, 4, 5])('marks exactly its own segment active for value %i', (level) => {
    render(<HeadingLevelPropertyField label="level" value={level} onChange={vi.fn()} />)

    expect(screen.getByRole('radio', { name: `H${level}` })).toHaveAttribute('aria-checked', 'true')
    screen
      .getAllByRole('radio')
      .filter((radio) => radio.textContent !== `H${level}`)
      .forEach((radio) => expect(radio).toHaveAttribute('aria-checked', 'false'))
  })

  it('marks no segment active when value is 6 (out of range)', () => {
    render(<HeadingLevelPropertyField label="level" value={6} onChange={vi.fn()} />)

    screen.getAllByRole('radio').forEach((radio) => expect(radio).toHaveAttribute('aria-checked', 'false'))
  })

  it('marks no segment active when value is undefined', () => {
    render(<HeadingLevelPropertyField label="level" value={undefined} onChange={vi.fn()} />)

    screen.getAllByRole('radio').forEach((radio) => expect(radio).toHaveAttribute('aria-checked', 'false'))
  })

  it('marks no segment active when value is not numeric', () => {
    render(<HeadingLevelPropertyField label="level" value="2" onChange={vi.fn()} />)

    screen.getAllByRole('radio').forEach((radio) => expect(radio).toHaveAttribute('aria-checked', 'false'))
  })
})

describe('HeadingLevelPropertyField onChange behavior', () => {
  it('calls onChange(4) once when H4 is clicked while value is 2', () => {
    const onChange = vi.fn()
    render(<HeadingLevelPropertyField label="level" value={2} onChange={onChange} />)

    fireEvent.click(screen.getByRole('radio', { name: 'H4' }))

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith(4)
  })

  it('does not call onChange when clicking the already-active segment', () => {
    const onChange = vi.fn()
    render(<HeadingLevelPropertyField label="level" value={2} onChange={onChange} />)

    fireEvent.click(screen.getByRole('radio', { name: 'H2' }))

    expect(onChange).not.toHaveBeenCalled()
  })
})

describe('HeadingLevelPropertyField icon rendering', () => {
  it('renders no icon (no svg) on any segment', () => {
    render(<HeadingLevelPropertyField label="level" value={2} onChange={vi.fn()} />)

    screen.getAllByRole('radio').forEach((radio) => expect(radio.querySelector('svg')).toBeNull())
  })
})
