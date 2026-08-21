import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { NavigateParamsPropertyField } from '../../dev-runtime/layout-canvas/property-fields/navigate-params-property-field'

// Same controlled-field harness pattern as `layout-canvas-property-field-key-value.test.tsx`:
// `NavigateParamsPropertyField` is fully controlled, so the caller must feed `onChange` results
// back into `value` for edits to be observable through subsequent renders.
function ControlledNavigateParamsField({
  initialValue,
  onChangeSpy,
}: {
  initialValue: unknown
  onChangeSpy: (value: unknown) => void
}) {
  const [value, setValue] = useState<unknown>(initialValue)
  return (
    <NavigateParamsPropertyField
      label="Parámetros"
      value={value}
      onChange={(nextValue) => {
        onChangeSpy(nextValue)
        setValue(nextValue)
      }}
    />
  )
}

describe('NavigateParamsPropertyField', () => {
  it('renders a string param as an editable row and reports the updated object on edit', () => {
    const onChangeSpy = vi.fn()
    render(<ControlledNavigateParamsField initialValue={{ userId: 'params.id' }} onChangeSpy={onChangeSpy} />)

    const valueInput = screen.getByLabelText('Parámetros valor #1') as HTMLInputElement
    expect(valueInput.tagName).toBe('INPUT')
    expect(valueInput.value).toBe('params.id')

    fireEvent.change(valueInput, { target: { value: 'params.otherId' } })

    expect(onChangeSpy).toHaveBeenCalledWith({ userId: 'params.otherId' })
  })

  it('degrades non-string rows to read-only without blocking a string row in the same object', () => {
    const onChangeSpy = vi.fn()
    render(
      <ControlledNavigateParamsField
        initialValue={{ page: 2, active: true, note: null, userId: 'params.id' }}
        onChangeSpy={onChangeSpy}
      />,
    )

    const pageField = screen.getByLabelText('Parámetros valor #1')
    const activeField = screen.getByLabelText('Parámetros valor #2')
    const noteField = screen.getByLabelText('Parámetros valor #3')
    expect(pageField.tagName).toBe('TEXTAREA')
    expect(pageField).toBeDisabled()
    expect(activeField.tagName).toBe('TEXTAREA')
    expect(activeField).toBeDisabled()
    expect(noteField.tagName).toBe('TEXTAREA')
    expect(noteField).toBeDisabled()

    const userIdField = screen.getByLabelText('Parámetros valor #4') as HTMLInputElement
    expect(userIdField.tagName).toBe('INPUT')
    fireEvent.change(userIdField, { target: { value: 'params.otherId' } })

    expect(onChangeSpy).toHaveBeenCalledWith({ page: 2, active: true, note: null, userId: 'params.otherId' })
  })

  it.each([
    ['undefined', undefined],
    ['null', null],
    ['an array', [1, 2]],
    ['a string', 'texto'],
  ])('normalizes %s value to an empty map without throwing, keeping "Añadir" available', (_label, value) => {
    render(<ControlledNavigateParamsField initialValue={value} onChangeSpy={vi.fn()} />)

    expect(screen.queryByLabelText('Parámetros clave #1')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Añadir Parámetros' })).toBeInTheDocument()
  })

  it('"Añadir" creates a row with an empty key/value that is itself editable', () => {
    const onChangeSpy = vi.fn()
    render(<ControlledNavigateParamsField initialValue={{}} onChangeSpy={onChangeSpy} />)

    fireEvent.click(screen.getByRole('button', { name: 'Añadir Parámetros' }))

    expect(onChangeSpy).toHaveBeenCalledWith({ '': '' })
    const newValueField = screen.getByLabelText('Parámetros valor #1') as HTMLInputElement
    expect(newValueField.tagName).toBe('INPUT')
    expect(newValueField.value).toBe('')
  })
})
