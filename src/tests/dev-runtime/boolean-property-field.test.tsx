import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { BooleanPropertyField } from '../../dev-runtime/layout-canvas/property-fields/boolean-property-field'

describe('BooleanPropertyField enabled behavior', () => {
  it('invokes onChange with the inverted value when clicked without disabled', () => {
    const onChange = vi.fn()
    render(<BooleanPropertyField label="Activo" value={false} onChange={onChange} />)

    fireEvent.click(screen.getByRole('switch'))

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith(true)
  })

  it('reflects value via aria-checked when enabled', () => {
    render(<BooleanPropertyField label="Activo" value={true} onChange={vi.fn()} />)

    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true')
  })
})

describe('BooleanPropertyField disabled behavior', () => {
  it('disables the switch and sets title from disabledReason, blocking onChange', () => {
    const onChange = vi.fn()
    render(
      <BooleanPropertyField
        label="Activo"
        value={false}
        onChange={onChange}
        disabled
        disabledReason="No hay operación configurada"
      />,
    )

    const switchEl = screen.getByRole('switch')
    expect(switchEl).toBeDisabled()
    expect(switchEl).toHaveAttribute('title', 'No hay operación configurada')

    fireEvent.click(switchEl)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('disables the switch without a title when disabledReason is absent', () => {
    render(<BooleanPropertyField label="Activo" value={false} onChange={vi.fn()} disabled />)

    const switchEl = screen.getByRole('switch')
    expect(switchEl).toBeDisabled()
    expect(switchEl).not.toHaveAttribute('title')
  })

  it('reflects value via aria-checked when disabled', () => {
    render(<BooleanPropertyField label="Activo" value={true} onChange={vi.fn()} disabled />)

    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true')
  })
})
