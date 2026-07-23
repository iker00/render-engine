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

describe('PropertyFieldDispatcher array schema with minItems (RF2, 0105)', () => {
  it('disables "Quitar" and ignores the click when the array is already at minItems', () => {
    const onChangeSpy = vi.fn()
    render(
      <ControlledDispatcher
        schema={{ type: 'array', items: { type: 'string' }, minItems: 1 }}
        initialValue={['solo']}
        label="Pestañas"
        onChangeSpy={onChangeSpy}
      />,
    )

    const removeButton = screen.getByRole('button', { name: 'Quitar Pestañas #1' })
    expect(removeButton).toBeDisabled()

    fireEvent.click(removeButton)
    expect(onChangeSpy).not.toHaveBeenCalled()
  })

  it('keeps both "Quitar" enabled with two items above minItems, then disables the remaining one after removing one', () => {
    const onChangeSpy = vi.fn()
    render(
      <ControlledDispatcher
        schema={{ type: 'array', items: { type: 'string' }, minItems: 1 }}
        initialValue={['uno', 'dos']}
        label="Pestañas"
        onChangeSpy={onChangeSpy}
      />,
    )

    expect(screen.getByRole('button', { name: 'Quitar Pestañas #1' })).not.toBeDisabled()
    expect(screen.getByRole('button', { name: 'Quitar Pestañas #2' })).not.toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: 'Quitar Pestañas #1' }))
    expect(onChangeSpy).toHaveBeenCalledWith(['dos'])

    expect(screen.getByRole('button', { name: 'Quitar Pestañas #1' })).toBeDisabled()
  })

  it('without minItems in the schema, "Quitar" stays enabled down to a single item (no regression)', () => {
    const onChangeSpy = vi.fn()
    render(
      <ControlledDispatcher
        schema={{ type: 'array', items: { type: 'string' } }}
        initialValue={['x']}
        label="Opciones"
        onChangeSpy={onChangeSpy}
      />,
    )

    const removeButton = screen.getByRole('button', { name: 'Quitar Opciones #1' })
    expect(removeButton).not.toBeDisabled()

    fireEvent.click(removeButton)
    expect(onChangeSpy).toHaveBeenCalledWith([])
  })
})

describe('PropertyFieldDispatcher array-of-objects default on "Añadir" (RF2, 0105)', () => {
  const itemsSchemaWithDefault = {
    type: 'object',
    required: ['label'],
    properties: { label: { type: 'string', default: 'Nueva pestaña' } },
  }

  it('uses the required field default declared on the item sub-schema instead of {}', () => {
    const onChangeSpy = vi.fn()
    render(
      <ControlledDispatcher
        schema={{ type: 'array', items: itemsSchemaWithDefault, minItems: 1 }}
        initialValue={[{ label: 'Uno' }]}
        label="items"
        onChangeSpy={onChangeSpy}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Añadir items' }))
    expect(onChangeSpy).toHaveBeenCalledWith([{ label: 'Uno' }, { label: 'Nueva pestaña' }])
  })

  it('falls back to the empty string for a required field with no declared default, never omitting the key', () => {
    const onChangeSpy = vi.fn()
    const itemsSchemaWithoutDefault = {
      type: 'object',
      required: ['label'],
      properties: { label: { type: 'string' } },
    }
    render(
      <ControlledDispatcher
        schema={{ type: 'array', items: itemsSchemaWithoutDefault, minItems: 1 }}
        initialValue={[{ label: 'Uno' }]}
        label="items"
        onChangeSpy={onChangeSpy}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Añadir items' }))
    expect(onChangeSpy).toHaveBeenCalledWith([{ label: 'Uno' }, { label: '' }])
  })
})

describe('PropertyFieldDispatcher union branch resolution during recursion (T4)', () => {
  // Fabricated schema shaped like `visibility`/`layout.span`: a `oneOf` whose branches share no
  // discriminant literal `type` (both are plain objects). Placed as an array item's schema so the
  // dispatcher must resolve the branch during its own `ArrayPropertyField` recursion, not at its
  // own top-level entry point (that stays the caller's job — see the escape-hatch tests below).
  const nestedUnionSchema = {
    oneOf: [
      {
        type: 'object',
        required: ['reference', 'operator'],
        properties: { reference: { type: 'string' }, operator: { type: 'string' } },
      },
      {
        type: 'object',
        required: ['operator', 'conditions'],
        properties: {
          operator: { type: 'string' },
          conditions: { type: 'array', items: { type: 'string' } },
        },
      },
    ],
  }

  it('resolves a oneOf array item by shape (single-condition branch) and renders it as an editable form, not the raw-JSON escape hatch', () => {
    const onChangeSpy = vi.fn()
    const arraySchemaWithNestedUnion = { type: 'array', items: nestedUnionSchema }
    render(
      <ControlledDispatcher
        schema={arraySchemaWithNestedUnion}
        initialValue={[{ reference: 'queries.list.state', operator: 'equals' }]}
        label="Reglas"
        onChangeSpy={onChangeSpy}
      />,
    )

    const referenceField = screen.getByLabelText('reference', { exact: false }) as HTMLInputElement
    expect(referenceField.value).toBe('queries.list.state')

    fireEvent.change(referenceField, { target: { value: 'queries.list.otherState' } })
    expect(onChangeSpy).toHaveBeenCalledWith([{ reference: 'queries.list.otherState', operator: 'equals' }])
  })

  it('resolves a oneOf array item by shape (group branch with conditions) and keeps the other item unaffected', () => {
    const onChangeSpy = vi.fn()
    const arraySchemaWithNestedUnion = { type: 'array', items: nestedUnionSchema }
    const groupItem = { operator: 'and', conditions: ['a', 'b'] }
    const conditionItem = { reference: 'x', operator: 'equals' }
    render(
      <ControlledDispatcher
        schema={arraySchemaWithNestedUnion}
        initialValue={[groupItem, conditionItem]}
        label="Reglas"
        onChangeSpy={onChangeSpy}
      />,
    )

    expect(screen.queryByLabelText('reference', { exact: false })).toBeInTheDocument()
    const conditionsGroup = screen.getByRole('group', { name: 'Reglas #1' })
    const firstConditionField = within(conditionsGroup).getByLabelText('conditions #1')
    fireEvent.change(firstConditionField, { target: { value: 'changed' } })

    expect(onChangeSpy).toHaveBeenCalledWith([{ operator: 'and', conditions: ['changed', 'b'] }, conditionItem])
  })
})

describe('PropertyFieldDispatcher discriminated union with selector (T5)', () => {
  // Fabricated schema shaped like `oneOf` of two object branches sharing a literal
  // `properties.type.const` — the "discriminated union with selector" pattern (D5, design.md).
  // Uses made-up type names (`alpha`/`beta`) precisely so the readable-label map (real 7 action
  // variants) never applies here: the fallback path (raw `type` literal as the option text) is
  // what's under test, keeping this unit suite independent from the real action catalog.
  const discriminatedSchema = {
    oneOf: [
      {
        type: 'object',
        properties: { type: { type: 'string', const: 'alpha' }, foo: { type: 'string' } },
        required: ['type', 'foo'],
      },
      {
        type: 'object',
        properties: { type: { type: 'string', const: 'beta' }, bar: { type: 'number' } },
        required: ['type', 'bar'],
      },
    ],
  }

  it('renders a selector plus the active variant fields, and does not render the other variant fields', () => {
    const onChangeSpy = vi.fn()
    render(
      <ControlledDispatcher
        schema={discriminatedSchema}
        initialValue={{ type: 'alpha', foo: 'x' }}
        label="Acción"
        onChangeSpy={onChangeSpy}
      />,
    )

    const select = screen.getByLabelText('Acción') as HTMLSelectElement
    expect(select.value).toBe('alpha')
    expect(screen.getByRole('option', { name: 'alpha' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'beta' })).toBeInTheDocument()

    expect((screen.getByLabelText('foo', { exact: false }) as HTMLInputElement).value).toBe('x')
    expect(screen.queryByLabelText('bar', { exact: false })).not.toBeInTheDocument()
  })

  it('changing the selector rebuilds the default value for the new variant, dropping the previous variant fields', () => {
    const onChangeSpy = vi.fn()
    render(
      <ControlledDispatcher
        schema={discriminatedSchema}
        initialValue={{ type: 'alpha', foo: 'x' }}
        label="Acción"
        onChangeSpy={onChangeSpy}
      />,
    )

    fireEvent.change(screen.getByLabelText('Acción'), { target: { value: 'beta' } })
    expect(onChangeSpy).toHaveBeenCalledWith({ type: 'beta', bar: 0 })

    expect((screen.getByLabelText('bar', { exact: false }) as HTMLInputElement).value).toBe('0')
    expect(screen.queryByLabelText('foo', { exact: false })).not.toBeInTheDocument()
  })

  it('adds a "Sin acción" option when the field is optional, and selecting it calls onChange(undefined)', () => {
    const onChangeSpy = vi.fn()
    render(
      <ControlledDispatcher schema={discriminatedSchema} initialValue={undefined} label="Acción" onChangeSpy={onChangeSpy} />,
    )

    expect(screen.getByRole('option', { name: 'Sin acción', selected: true })).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Acción'), { target: { value: 'alpha' } })
    expect(onChangeSpy).toHaveBeenCalledWith({ type: 'alpha', foo: '' })

    const noActionOption = screen.getByRole('option', { name: 'Sin acción' }) as HTMLOptionElement
    fireEvent.change(screen.getByLabelText('Acción'), { target: { value: noActionOption.value } })
    expect(onChangeSpy).toHaveBeenLastCalledWith(undefined)
  })

  it('does not add a "Sin acción" option when the field is required', () => {
    const onChangeSpy = vi.fn()
    render(
      <ControlledDispatcher
        schema={{ type: 'object', properties: { action: discriminatedSchema }, required: ['action'] }}
        initialValue={{ action: { type: 'alpha', foo: 'x' } }}
        label="Config"
        onChangeSpy={onChangeSpy}
      />,
    )

    expect(screen.queryByRole('option', { name: 'Sin acción' })).not.toBeInTheDocument()
  })

  it('an array of discriminated-union items renders one independent selector per entry, required so no "Sin acción" per item', () => {
    const onChangeSpy = vi.fn()
    const arraySchema = { type: 'array', items: discriminatedSchema }
    render(
      <ControlledDispatcher
        schema={arraySchema}
        initialValue={[{ type: 'alpha', foo: 'x' }]}
        label="Reglas"
        onChangeSpy={onChangeSpy}
      />,
    )

    const entryGroup = screen.getByRole('group', { name: 'Reglas #1' })
    const select = within(entryGroup).getByRole('combobox') as HTMLSelectElement
    expect(select.value).toBe('alpha')
    expect(screen.queryByRole('option', { name: 'Sin acción' })).not.toBeInTheDocument()

    fireEvent.change(select, { target: { value: 'beta' } })
    expect(onChangeSpy).toHaveBeenCalledWith([{ type: 'beta', bar: 0 }])
  })
})

describe('PropertyFieldDispatcher object schema with additionalProperties: string (T6)', () => {
  it('dispatches to the key-value editor (not ObjectPropertyField) for an object with no declared properties and additionalProperties: { type: "string" }', () => {
    const onChangeSpy = vi.fn()
    const schema = { type: 'object', additionalProperties: { type: 'string' } }

    render(
      <ControlledDispatcher schema={schema} initialValue={{ a: '1' }} label="Cabeceras" onChangeSpy={onChangeSpy} />,
    )

    // The key-value editor labels its rows "<label> clave #n" / "<label> valor #n" — a shape
    // ObjectPropertyField (which renders one field per declared `properties` key) never produces,
    // since it has no `properties` to iterate here.
    expect(screen.getByLabelText('Cabeceras clave #1')).toBeInTheDocument()
    expect(screen.getByLabelText('Cabeceras valor #1')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Añadir Cabeceras' }))
    expect(onChangeSpy).toHaveBeenCalledWith({ a: '1', '': '' })
  })
})

describe('PropertyFieldDispatcher x-widget hook (T4, 0108)', () => {
  it('delegates to ChoiceItemsPropertyField for a schema declaring x-widget: "choice-items", instead of the raw-JSON escape hatch', () => {
    const onChangeSpy = vi.fn()
    render(
      <ControlledDispatcher
        schema={{ 'x-widget': 'choice-items' }}
        initialValue={[]}
        label="items"
        onChangeSpy={onChangeSpy}
      />,
    )

    // ChoiceItemsPropertyField's own mode selector is labelled by the field's `label` and starts
    // in "manualLiteral" for an array value — distinct from the disabled raw-JSON textarea the
    // escape hatch would render for a schema this bare.
    const modeSelect = screen.getByLabelText('items') as HTMLSelectElement
    expect(modeSelect.tagName).toBe('SELECT')
    expect(modeSelect.value).toBe('manualLiteral')
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Añadir items' }))
    expect(onChangeSpy).toHaveBeenCalledWith([{ label: '', value: '' }])
  })

  it('ignores x-widget when its value has no entry in the closed registry, falling back to the generic patterns', () => {
    const onChangeSpy = vi.fn()
    render(
      <ControlledDispatcher
        schema={{ type: 'string', 'x-widget': 'not-a-real-widget' }}
        initialValue="hola"
        label="Título"
        onChangeSpy={onChangeSpy}
      />,
    )

    const input = screen.getByLabelText('Título')
    expect(input).toHaveAttribute('type', 'text')

    fireEvent.change(input, { target: { value: 'nuevo texto' } })
    expect(onChangeSpy).toHaveBeenCalledWith('nuevo texto')
  })

  it('applies the generic patterns unchanged for a schema with no x-widget at all (regression)', () => {
    const onChangeSpy = vi.fn()
    render(
      <ControlledDispatcher schema={{ type: 'boolean' }} initialValue={false} label="Activo" onChangeSpy={onChangeSpy} />,
    )

    const checkbox = screen.getByLabelText('Activo')
    expect(checkbox).toHaveAttribute('type', 'checkbox')

    fireEvent.click(checkbox)
    expect(onChangeSpy).toHaveBeenCalledWith(true)
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
