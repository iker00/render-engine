import { fireEvent, render, screen, within } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { PropertyFieldDispatcher } from '../../dev-runtime/layout-canvas/property-fields/property-field-dispatcher'

// PropertyFieldDispatcher is fully controlled: the caller owns `value` and must feed back
// whatever `onChange` reports. This harness plays that role for the tests so each interaction
// can be observed both as an onChange call and as the resulting re-render.
function ControlledDispatcher({
  schema,
  initialValue,
  label,
  onChangeSpy,
}: {
  schema: Record<string, unknown>
  initialValue: unknown
  label: string
  onChangeSpy: (value: unknown) => void
}) {
  const [value, setValue] = useState(initialValue)
  return (
    <PropertyFieldDispatcher
      schema={schema}
      value={value}
      label={label}
      onChange={(nextValue) => {
        onChangeSpy(nextValue)
        setValue(nextValue)
      }}
    />
  )
}

describe('PropertyFieldDispatcher primitives', () => {
  it('renders a text input for a string schema and invokes onChange with the new string', () => {
    const onChangeSpy = vi.fn()
    render(
      <ControlledDispatcher schema={{ type: 'string' }} initialValue="hola" label="Título" onChangeSpy={onChangeSpy} />,
    )

    const input = screen.getByLabelText('Título')
    expect(input).toHaveAttribute('type', 'text')

    fireEvent.change(input, { target: { value: 'nuevo texto' } })
    expect(onChangeSpy).toHaveBeenCalledWith('nuevo texto')
  })

  it('renders a numeric input for a number schema and invokes onChange with a number, not a string', () => {
    const onChangeSpy = vi.fn()
    render(<ControlledDispatcher schema={{ type: 'number' }} initialValue={0} label="Cantidad" onChangeSpy={onChangeSpy} />)

    const input = screen.getByLabelText('Cantidad')
    expect(input).toHaveAttribute('type', 'number')

    fireEvent.change(input, { target: { value: '42' } })
    expect(onChangeSpy).toHaveBeenCalledWith(42)
    expect(typeof onChangeSpy.mock.calls[0][0]).toBe('number')
  })

  it('renders a checkbox for a boolean schema and invokes onChange with the inverted boolean', () => {
    const onChangeSpy = vi.fn()
    render(
      <ControlledDispatcher schema={{ type: 'boolean' }} initialValue={false} label="Activo" onChangeSpy={onChangeSpy} />,
    )

    const checkbox = screen.getByLabelText('Activo')
    expect(checkbox).toHaveAttribute('type', 'checkbox')

    fireEvent.click(checkbox)
    expect(onChangeSpy).toHaveBeenCalledWith(true)
  })

  it('renders a select with the enum options for a string enum schema and invokes onChange with the selected value', () => {
    const onChangeSpy = vi.fn()
    render(
      <ControlledDispatcher
        schema={{ type: 'string', enum: ['a', 'b', 'c'] }}
        initialValue="a"
        label="Variante"
        onChangeSpy={onChangeSpy}
      />,
    )

    const select = screen.getByLabelText('Variante') as HTMLSelectElement
    const optionValues = Array.from(select.options).map((option) => option.value)
    expect(optionValues).toEqual(['a', 'b', 'c'])

    fireEvent.change(select, { target: { value: 'b' } })
    expect(onChangeSpy).toHaveBeenCalledWith('b')
  })
})

describe('PropertyFieldDispatcher array schema', () => {
  const arraySchema = { type: 'array', items: { type: 'string' } }

  it('renders one text field per existing item', () => {
    const onChangeSpy = vi.fn()
    render(
      <ControlledDispatcher schema={arraySchema} initialValue={['x', 'y']} label="Opciones" onChangeSpy={onChangeSpy} />,
    )

    expect((screen.getByLabelText('Opciones #1') as HTMLInputElement).value).toBe('x')
    expect((screen.getByLabelText('Opciones #2') as HTMLInputElement).value).toBe('y')
  })

  it('adding an entry invokes onChange with a three-element array using a default value', () => {
    const onChangeSpy = vi.fn()
    render(
      <ControlledDispatcher schema={arraySchema} initialValue={['x', 'y']} label="Opciones" onChangeSpy={onChangeSpy} />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Añadir Opciones' }))
    expect(onChangeSpy).toHaveBeenCalledWith(['x', 'y', ''])
  })

  it('removing the first entry invokes onChange with the remaining items', () => {
    const onChangeSpy = vi.fn()
    render(
      <ControlledDispatcher schema={arraySchema} initialValue={['x', 'y']} label="Opciones" onChangeSpy={onChangeSpy} />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Quitar Opciones #1' }))
    expect(onChangeSpy).toHaveBeenCalledWith(['y'])
  })
})

describe('PropertyFieldDispatcher object schema', () => {
  it('renders one field per property with its current value and preserves siblings on change', () => {
    const onChangeSpy = vi.fn()
    const schema = { type: 'object', properties: { a: { type: 'string' }, b: { type: 'number' } } }

    render(
      <ControlledDispatcher schema={schema} initialValue={{ a: 'x', b: 1 }} label="Config" onChangeSpy={onChangeSpy} />,
    )

    const fieldA = screen.getByLabelText('a') as HTMLInputElement
    const fieldB = screen.getByLabelText('b') as HTMLInputElement
    expect(fieldA.value).toBe('x')
    expect(fieldB.value).toBe('1')

    fireEvent.change(fieldA, { target: { value: 'nuevo' } })
    expect(onChangeSpy).toHaveBeenCalledWith({ a: 'nuevo', b: 1 })
  })

  it('renders a nested array inside an object recursively (table.props.columns-like) and edits one inner item without affecting siblings', () => {
    const onChangeSpy = vi.fn()
    const schema = {
      type: 'object',
      properties: {
        columns: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              key: { type: 'string' },
              label: { type: 'string' },
            },
          },
        },
      },
    }
    const initialValue = {
      columns: [
        { key: 'name', label: 'Nombre' },
        { key: 'email', label: 'Email' },
      ],
    }

    expect(() =>
      render(
        <ControlledDispatcher schema={schema} initialValue={initialValue} label="Tabla" onChangeSpy={onChangeSpy} />,
      ),
    ).not.toThrow()

    const firstColumnGroup = screen.getByRole('group', { name: 'columns #1' })
    const firstLabelField = within(firstColumnGroup).getByLabelText('label')
    fireEvent.change(firstLabelField, { target: { value: 'Nombre completo' } })

    expect(onChangeSpy).toHaveBeenCalledWith({
      columns: [
        { key: 'name', label: 'Nombre completo' },
        { key: 'email', label: 'Email' },
      ],
    })
  })
})

describe('PropertyFieldDispatcher escape hatch', () => {
  it('falls back to a disabled raw JSON textarea without throwing when the schema has no recognizable type', () => {
    const onChangeSpy = vi.fn()

    expect(() =>
      render(
        <ControlledDispatcher
          schema={{ anyOf: [{ type: 'string' }, { type: 'number' }] }}
          initialValue={42}
          label="Valor libre"
          onChangeSpy={onChangeSpy}
        />,
      ),
    ).not.toThrow()

    const textarea = screen.getByLabelText('Valor libre') as HTMLTextAreaElement
    expect(textarea.tagName).toBe('TEXTAREA')
    expect(textarea).toBeDisabled()
    expect(textarea.value).toBe('42')
  })

  it('keeps the raw JSON textarea editable when the current value is already a plain string', () => {
    const onChangeSpy = vi.fn()
    render(
      <ControlledDispatcher schema={{}} initialValue="texto libre" label="Nota" onChangeSpy={onChangeSpy} />,
    )

    const textarea = screen.getByLabelText('Nota') as HTMLTextAreaElement
    expect(textarea).not.toBeDisabled()

    fireEvent.change(textarea, { target: { value: 'texto editado' } })
    expect(onChangeSpy).toHaveBeenCalledWith('texto editado')
  })
})
