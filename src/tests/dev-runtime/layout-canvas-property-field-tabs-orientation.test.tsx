import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TabsOrientationPropertyField } from '../../dev-runtime/layout-canvas/property-fields/tabs-orientation-property-field'

describe('TabsOrientationPropertyField active segment resolution', () => {
  it('marks only "Horizontal" active when value is "horizontal"', () => {
    render(<TabsOrientationPropertyField label="orientation" value="horizontal" onChange={vi.fn()} />)

    expect(screen.getByRole('radio', { name: /Horizontal/ })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: /Vertical/ })).toHaveAttribute('aria-checked', 'false')
  })

  it('marks only "Vertical" active when value is "vertical"', () => {
    render(<TabsOrientationPropertyField label="orientation" value="vertical" onChange={vi.fn()} />)

    expect(screen.getByRole('radio', { name: /Vertical/ })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: /Horizontal/ })).toHaveAttribute('aria-checked', 'false')
  })

  it('defaults to "Horizontal" active when value is undefined (runtime default)', () => {
    render(<TabsOrientationPropertyField label="orientation" value={undefined} onChange={vi.fn()} />)

    expect(screen.getByRole('radio', { name: /Horizontal/ })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: /Vertical/ })).toHaveAttribute('aria-checked', 'false')
  })
})

describe('TabsOrientationPropertyField onChange behavior', () => {
  it('calls onChange("vertical") when Vertical is clicked while value is "horizontal"', () => {
    const onChange = vi.fn()
    render(<TabsOrientationPropertyField label="orientation" value="horizontal" onChange={onChange} />)

    fireEvent.click(screen.getByRole('radio', { name: /Vertical/ }))

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith('vertical')
  })

  it('calls onChange("vertical") when Vertical is clicked while value is undefined', () => {
    const onChange = vi.fn()
    render(<TabsOrientationPropertyField label="orientation" value={undefined} onChange={onChange} />)

    fireEvent.click(screen.getByRole('radio', { name: /Vertical/ }))

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith('vertical')
  })

  it('calls onChange("horizontal") when Horizontal is clicked while value is "vertical"', () => {
    const onChange = vi.fn()
    render(<TabsOrientationPropertyField label="orientation" value="vertical" onChange={onChange} />)

    fireEvent.click(screen.getByRole('radio', { name: /Horizontal/ }))

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith('horizontal')
  })

  it('does not call onChange when clicking the already-active segment', () => {
    const onChange = vi.fn()
    render(<TabsOrientationPropertyField label="orientation" value="horizontal" onChange={onChange} />)

    fireEvent.click(screen.getByRole('radio', { name: /Horizontal/ }))

    expect(onChange).not.toHaveBeenCalled()
  })
})

describe('TabsOrientationPropertyField icon rendering', () => {
  it('renders an icon (svg) on every segment', () => {
    render(<TabsOrientationPropertyField label="orientation" value="horizontal" onChange={vi.fn()} />)

    screen.getAllByRole('radio').forEach((radio) => expect(radio.querySelector('svg')).not.toBeNull())
  })
})
