import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { KeyValuePropertyField } from '../../dev-runtime/layout-canvas/property-fields/key-value-property-field'

// KeyValuePropertyField is fully controlled: the caller owns `value` and must feed back whatever
// `onChange` reports. This harness plays that role so each interaction can be observed both as an
// onChange call and as the resulting re-render.
function ControlledKeyValueField({
  initialValue,
  label,
  onChangeSpy,
  isValueEditable,
}: {
  initialValue: Record<string, unknown>
  label: string
  onChangeSpy: (value: Record<string, unknown>) => void
  isValueEditable?: (value: unknown) => boolean
}) {
  const [value, setValue] = useState(initialValue)
  return (
    <KeyValuePropertyField
      label={label}
      value={value}
      onChange={(nextValue) => {
        onChangeSpy(nextValue)
        setValue(nextValue)
      }}
      isValueEditable={isValueEditable}
    />
  )
}

describe('KeyValuePropertyField', () => {
  it('renders zero rows plus the "Añadir" button for an empty object', () => {
    const onChangeSpy = vi.fn()
    render(<ControlledKeyValueField initialValue={{}} label="Cabeceras" onChangeSpy={onChangeSpy} />)

    expect(screen.queryByLabelText('Cabeceras clave #1')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Añadir Cabeceras' })).toBeInTheDocument()
  })

  it('"Añadir" creates a row with an empty key and value and calls onChange with { "": "" }', () => {
    const onChangeSpy = vi.fn()
    render(<ControlledKeyValueField initialValue={{}} label="Cabeceras" onChangeSpy={onChangeSpy} />)

    fireEvent.click(screen.getByRole('button', { name: 'Añadir Cabeceras' }))

    expect(onChangeSpy).toHaveBeenCalledWith({ '': '' })
    expect((screen.getByLabelText('Cabeceras clave #1') as HTMLInputElement).value).toBe('')
    expect((screen.getByLabelText('Cabeceras valor #1') as HTMLInputElement).value).toBe('')
  })

  it('editing a row key renames the key, preserves its value, and preserves the relative order of the rest', () => {
    const onChangeSpy = vi.fn()
    render(
      <ControlledKeyValueField
        initialValue={{ a: '1', b: '2', c: '3' }}
        label="Config"
        onChangeSpy={onChangeSpy}
      />,
    )

    const keyInputForB = screen.getByLabelText('Config clave #2') as HTMLInputElement
    expect(keyInputForB.value).toBe('b')

    fireEvent.change(keyInputForB, { target: { value: 'x' } })

    expect(onChangeSpy).toHaveBeenCalledWith({ a: '1', c: '3', x: '2' })
  })

  it('editing a row value leaves the key intact', () => {
    const onChangeSpy = vi.fn()
    render(
      <ControlledKeyValueField initialValue={{ a: '1', b: '2' }} label="Config" onChangeSpy={onChangeSpy} />,
    )

    const valueInputForA = screen.getByLabelText('Config valor #1') as HTMLInputElement
    fireEvent.change(valueInputForA, { target: { value: 'nuevo' } })

    expect(onChangeSpy).toHaveBeenCalledWith({ a: 'nuevo', b: '2' })
  })

  it('"Quitar" removes that row from the object', () => {
    const onChangeSpy = vi.fn()
    render(
      <ControlledKeyValueField initialValue={{ a: '1', b: '2' }} label="Config" onChangeSpy={onChangeSpy} />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Quitar Config #1' }))

    expect(onChangeSpy).toHaveBeenCalledWith({ b: '2' })
  })

  it('displays non-string incoming values as their String() form and overwrites them as strings on edit', () => {
    const onChangeSpy = vi.fn()
    render(
      <ControlledKeyValueField
        initialValue={{ page: 1, active: true }}
        label="Config"
        onChangeSpy={onChangeSpy}
      />,
    )

    const pageValueInput = screen.getByLabelText('Config valor #1') as HTMLInputElement
    const activeValueInput = screen.getByLabelText('Config valor #2') as HTMLInputElement
    expect(pageValueInput.value).toBe('1')
    expect(activeValueInput.value).toBe('true')

    fireEvent.change(pageValueInput, { target: { value: '2' } })

    expect(onChangeSpy).toHaveBeenCalledWith({ page: '2', active: true })
    expect(typeof onChangeSpy.mock.calls[0][0].page).toBe('string')
  })

  describe('body override (T7): a row whose value is an object or array', () => {
    it('renders that row’s value slot as a disabled raw-JSON fallback, leaving the key editable and other rows unaffected', () => {
      const onChangeSpy = vi.fn()
      render(
        <ControlledKeyValueField
          initialValue={{ nombre: 'Ana', metadatos: { origen: 'web' } }}
          label="body"
          onChangeSpy={onChangeSpy}
        />,
      )

      // Row 1 (primitive string value) stays the plain text/text pair from T6.
      expect((screen.getByLabelText('body valor #1') as HTMLInputElement).value).toBe('Ana')
      expect(screen.getByLabelText('body valor #1').tagName).toBe('INPUT')

      // Row 2 (object value) falls back to a disabled raw-JSON field for the value slot only.
      const nestedValueField = screen.getByLabelText('body valor #2')
      expect(nestedValueField.tagName).toBe('TEXTAREA')
      expect(nestedValueField).toBeDisabled()
      expect((nestedValueField as HTMLTextAreaElement).value).toBe(JSON.stringify({ origen: 'web' }, null, 2))

      // The key stays editable and "Quitar" stays available for the nested row.
      const nestedKeyInput = screen.getByLabelText('body clave #2') as HTMLInputElement
      expect(nestedKeyInput.value).toBe('metadatos')
      expect(screen.getByRole('button', { name: 'Quitar body #2' })).toBeInTheDocument()

      fireEvent.change(nestedKeyInput, { target: { value: 'meta' } })
      expect(onChangeSpy).toHaveBeenCalledWith({ nombre: 'Ana', meta: { origen: 'web' } })
    })

    it('falls back the same way for an array value', () => {
      render(<ControlledKeyValueField initialValue={{ tags: ['a', 'b'] }} label="body" onChangeSpy={vi.fn()} />)

      const nestedValueField = screen.getByLabelText('body valor #1')
      expect(nestedValueField.tagName).toBe('TEXTAREA')
      expect(nestedValueField).toBeDisabled()
      expect((nestedValueField as HTMLTextAreaElement).value).toBe(JSON.stringify(['a', 'b'], null, 2))
    })

    it('"Quitar" removes a nested-value row like any other row', () => {
      const onChangeSpy = vi.fn()
      render(
        <ControlledKeyValueField
          initialValue={{ nombre: 'Ana', metadatos: { origen: 'web' } }}
          label="body"
          onChangeSpy={onChangeSpy}
        />,
      )

      fireEvent.click(screen.getByRole('button', { name: 'Quitar body #2' }))

      expect(onChangeSpy).toHaveBeenCalledWith({ nombre: 'Ana' })
    })

    it('"Añadir" on a mixed body still creates the new row as a plain string/string pair', () => {
      const onChangeSpy = vi.fn()
      render(
        <ControlledKeyValueField
          initialValue={{ nombre: 'Ana', metadatos: { origen: 'web' } }}
          label="body"
          onChangeSpy={onChangeSpy}
        />,
      )

      fireEvent.click(screen.getByRole('button', { name: 'Añadir body' }))

      expect(onChangeSpy).toHaveBeenCalledWith({ nombre: 'Ana', metadatos: { origen: 'web' }, '': '' })
      expect((screen.getByLabelText('body valor #3') as HTMLInputElement).value).toBe('')
    })
  })

  describe('isValueEditable prop (T2)', () => {
    it('without the prop, a number or boolean value stays editable (default unchanged)', () => {
      render(
        <ControlledKeyValueField
          initialValue={{ page: 1, active: true }}
          label="Config"
          onChangeSpy={vi.fn()}
        />,
      )

      const pageValueInput = screen.getByLabelText('Config valor #1')
      const activeValueInput = screen.getByLabelText('Config valor #2')
      expect(pageValueInput.tagName).toBe('INPUT')
      expect(activeValueInput.tagName).toBe('INPUT')
    })

    it('without the prop, an object/array value still falls back to the read-only raw-JSON field', () => {
      render(
        <ControlledKeyValueField
          initialValue={{ metadatos: { origen: 'web' } }}
          label="body"
          onChangeSpy={vi.fn()}
        />,
      )

      const nestedValueField = screen.getByLabelText('body valor #1')
      expect(nestedValueField.tagName).toBe('TEXTAREA')
      expect(nestedValueField).toBeDisabled()
    })

    it('with the prop, only rows for which it returns true render as editable inputs', () => {
      const onChangeSpy = vi.fn()
      render(
        <ControlledKeyValueField
          initialValue={{ userId: 'texto', page: 42, active: true, note: null, meta: {}, tags: [] }}
          label="Parámetros"
          onChangeSpy={onChangeSpy}
          isValueEditable={(v) => typeof v === 'string'}
        />,
      )

      const stringField = screen.getByLabelText('Parámetros valor #1')
      expect(stringField.tagName).toBe('INPUT')

      const numberField = screen.getByLabelText('Parámetros valor #2')
      const booleanField = screen.getByLabelText('Parámetros valor #3')
      const nullField = screen.getByLabelText('Parámetros valor #4')
      const objectField = screen.getByLabelText('Parámetros valor #5')
      const arrayField = screen.getByLabelText('Parámetros valor #6')
      for (const field of [numberField, booleanField, nullField, objectField, arrayField]) {
        expect(field.tagName).toBe('TEXTAREA')
        expect(field).toBeDisabled()
      }
    })

    it('editing the key or using Quitar/Añadir on a row degraded by isValueEditable still works', () => {
      const onChangeSpy = vi.fn()
      render(
        <ControlledKeyValueField
          initialValue={{ userId: 'texto', page: 42 }}
          label="Parámetros"
          onChangeSpy={onChangeSpy}
          isValueEditable={(v) => typeof v === 'string'}
        />,
      )

      const degradedKeyInput = screen.getByLabelText('Parámetros clave #2') as HTMLInputElement
      expect(degradedKeyInput.value).toBe('page')
      fireEvent.change(degradedKeyInput, { target: { value: 'count' } })
      expect(onChangeSpy).toHaveBeenCalledWith({ userId: 'texto', count: 42 })

      fireEvent.click(screen.getByRole('button', { name: 'Quitar Parámetros #2' }))
      expect(onChangeSpy).toHaveBeenLastCalledWith({ userId: 'texto' })

      fireEvent.click(screen.getByRole('button', { name: 'Añadir Parámetros' }))
      expect(onChangeSpy).toHaveBeenLastCalledWith({ userId: 'texto', '': '' })
    })
  })
})
