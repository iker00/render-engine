import { fireEvent, render, screen, within } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { PropertyFieldDispatcher } from '../../dev-runtime/layout-canvas/property-fields/property-field-dispatcher'
import { QueryStateFeedbackAccordionWidgetContext } from '../../dev-runtime/layout-canvas/property-fields/query-state-feedback-accordion-widget-context'

// The `icon` widget (T2, 0129) mounts the real `IconPickerPropertyField`, which enumerates the
// full `lucide-react` namespace to build its catalog. Same mock as T1's own suite, required here
// for the same reason: without it, every render walks ~3900 real icons and blows the global
// Vitest timeout. `OTHER_MODULE_ICON_NAMES` covers the icons `PropertyFieldDispatcher`'s other
// statically-imported widgets (e.g. `TabsOrientationPropertyField`) read from `lucide-react` at
// module scope, regardless of which widget a given test actually renders.
vi.mock('lucide-react', async () => {
  const { createLucideReactMock, OTHER_MODULE_ICON_NAMES } = await import('./lucide-react-mock')
  return createLucideReactMock(OTHER_MODULE_ICON_NAMES)
})

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

  it('renders a switch for a boolean schema and invokes onChange with the inverted boolean', () => {
    const onChangeSpy = vi.fn()
    render(
      <ControlledDispatcher schema={{ type: 'boolean' }} initialValue={false} label="Activo" onChangeSpy={onChangeSpy} />,
    )

    const toggle = screen.getByLabelText('Activo')
    expect(toggle).toHaveAttribute('role', 'switch')
    expect(toggle).toHaveAttribute('aria-checked', 'false')

    fireEvent.click(toggle)
    expect(onChangeSpy).toHaveBeenCalledWith(true)
  })

  // T1 (0134): a 6+ option enum stays outside the segmented range (2-5), so it's the case that
  // keeps demonstrating the plain `<select>` fallback.
  it('renders a select with the enum options for a string enum schema with 6+ options and invokes onChange with the selected value', () => {
    const onChangeSpy = vi.fn()
    render(
      <ControlledDispatcher
        schema={{ type: 'string', enum: ['a', 'b', 'c', 'd', 'e', 'f'] }}
        initialValue="a"
        label="Variante"
        onChangeSpy={onChangeSpy}
      />,
    )

    const select = screen.getByLabelText('Variante') as HTMLSelectElement
    const optionValues = Array.from(select.options).map((option) => option.value)
    expect(optionValues).toEqual(['a', 'b', 'c', 'd', 'e', 'f'])

    fireEvent.change(select, { target: { value: 'b' } })
    expect(onChangeSpy).toHaveBeenCalledWith('b')
  })

  // T1 (0134), FR1/FR2: a bounded enum (2-5 options) renders the shared segmented-toggle
  // radiogroup instead of a `<select>`.
  it('renders a segmented radiogroup (not a select) for a string enum schema with 3 options, and invokes onChange with the selected value', () => {
    const onChangeSpy = vi.fn()
    render(
      <ControlledDispatcher
        schema={{ type: 'string', enum: ['a', 'b', 'c'] }}
        initialValue="a"
        label="Variante"
        onChangeSpy={onChangeSpy}
      />,
    )

    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    const radiogroup = screen.getByRole('radiogroup', { name: 'Variante' })
    const radios = within(radiogroup).getAllByRole('radio')
    expect(radios.map((radio) => radio.textContent)).toEqual(['a', 'b', 'c'])
    expect(within(radiogroup).getByRole('radio', { name: 'a', checked: true })).toBeInTheDocument()

    fireEvent.click(within(radiogroup).getByRole('radio', { name: 'c' }))
    expect(onChangeSpy).toHaveBeenCalledWith('c')
  })

  it('renders a segmented radiogroup for a string enum schema with exactly 2 options', () => {
    const onChangeSpy = vi.fn()
    render(
      <ControlledDispatcher
        schema={{ type: 'string', enum: ['on', 'off'] }}
        initialValue="on"
        label="Estado"
        onChangeSpy={onChangeSpy}
      />,
    )

    const radiogroup = screen.getByRole('radiogroup', { name: 'Estado' })
    expect(within(radiogroup).getAllByRole('radio')).toHaveLength(2)
    expect(within(radiogroup).getByRole('radio', { name: 'on', checked: true })).toBeInTheDocument()
  })

  it('renders a segmented radiogroup for a string enum schema with exactly 5 options', () => {
    const onChangeSpy = vi.fn()
    render(
      <ControlledDispatcher
        schema={{ type: 'string', enum: ['a', 'b', 'c', 'd', 'e'] }}
        initialValue="a"
        label="Variante"
        onChangeSpy={onChangeSpy}
      />,
    )

    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    const radiogroup = screen.getByRole('radiogroup', { name: 'Variante' })
    expect(within(radiogroup).getAllByRole('radio')).toHaveLength(5)
  })

  it('renders a select (not a segmented radiogroup) for a string enum schema with exactly 1 option', () => {
    const onChangeSpy = vi.fn()
    render(
      <ControlledDispatcher
        schema={{ type: 'string', enum: ['only'] }}
        initialValue="only"
        label="Único"
        onChangeSpy={onChangeSpy}
      />,
    )

    expect(screen.getByLabelText('Único')).toHaveProperty('tagName', 'SELECT')
    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument()
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

    const toggle = screen.getByLabelText('Activo')
    expect(toggle).toHaveAttribute('role', 'switch')
    expect(toggle).toHaveAttribute('aria-checked', 'false')

    fireEvent.click(toggle)
    expect(onChangeSpy).toHaveBeenCalledWith(true)
  })

  it('delegates to HeadingLevelPropertyField for a schema declaring x-widget: "heading-level", instead of the generic number input (0128)', () => {
    const onChangeSpy = vi.fn()
    render(
      <ControlledDispatcher
        schema={{ type: 'integer', 'x-widget': 'heading-level' }}
        initialValue={2}
        label="level"
        onChangeSpy={onChangeSpy}
      />,
    )

    // The generic integer path would render a numeric <input>; the widget instead renders the
    // shared segmented-toggle radiogroup with five fixed H1..H5 segments.
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument()
    const radios = screen.getAllByRole('radio')
    expect(radios.map((radio) => radio.textContent)).toEqual(['H1', 'H2', 'H3', 'H4', 'H5'])
    expect(screen.getByRole('radio', { name: 'H2' })).toHaveAttribute('aria-checked', 'true')

    fireEvent.click(screen.getByRole('radio', { name: 'H4' }))
    expect(onChangeSpy).toHaveBeenCalledWith(4)
  })

  it('delegates to TabsOrientationPropertyField for a schema declaring x-widget: "tabs-orientation", instead of the generic EnumPropertyField (0128)', () => {
    const onChangeSpy = vi.fn()
    render(
      <ControlledDispatcher
        schema={{ type: 'string', enum: ['horizontal', 'vertical'], 'x-widget': 'tabs-orientation' }}
        initialValue="horizontal"
        label="orientation"
        onChangeSpy={onChangeSpy}
      />,
    )

    // The generic enum path would render a <select>; the widget instead renders the shared
    // segmented-toggle radiogroup with the two fixed orientation segments.
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /Horizontal/ })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: /Vertical/ })).toHaveAttribute('aria-checked', 'false')

    fireEvent.click(screen.getByRole('radio', { name: /Vertical/ }))
    expect(onChangeSpy).toHaveBeenCalledWith('vertical')
  })
})

describe('PropertyFieldDispatcher x-widget hook: icon (T2, 0129)', () => {
  it('delegates to IconPickerPropertyField for a schema declaring x-widget: "icon", instead of the generic text input', () => {
    const onChangeSpy = vi.fn()
    render(
      <ControlledDispatcher schema={{ 'x-widget': 'icon' }} initialValue="Home" label="icon" onChangeSpy={onChangeSpy} />,
    )

    // IconPickerPropertyField renders a `role="grid"` catalog with the mocked icon names; the
    // generic string path would instead render a single free-text `<input>` with no grid at all.
    expect(screen.queryByRole('textbox', { name: 'icon' })).not.toBeInTheDocument()

    // The grid is hidden until the search input is focused (T5, 0129).
    fireEvent.focus(screen.getByRole('textbox', { name: 'Buscar icono' }))
    const grid = screen.getByRole('grid', { name: 'icon' })
    expect(grid).toBeInTheDocument()

    // Scoped to the grid: the recognized-value preview chip (T5) also renders "Home" next to the
    // input, outside the grid.
    const homeCell = within(grid).getByText('Home').closest('[role="gridcell"]')!
    expect(homeCell).toHaveAttribute('aria-selected', 'true')

    fireEvent.click(screen.getByText('Settings').closest('[role="gridcell"]')!)
    expect(onChangeSpy).toHaveBeenCalledWith('Settings')
  })

  it('still renders the generic text input for a plain string schema with no x-widget (regression)', () => {
    const onChangeSpy = vi.fn()
    render(<ControlledDispatcher schema={{ type: 'string' }} initialValue="hola" label="Título" onChangeSpy={onChangeSpy} />)

    const input = screen.getByLabelText('Título')
    expect(input).toHaveAttribute('type', 'text')
    expect(screen.queryByRole('grid')).not.toBeInTheDocument()
  })
})

describe('PropertyFieldDispatcher x-widget hook: condition-group (T3, 0132)', () => {
  it('delegates to ConditionGroupPropertyField for a schema declaring x-widget: "condition-group", instead of any generic branch', () => {
    const onChangeSpy = vi.fn()
    render(
      <ControlledDispatcher
        schema={{ 'x-widget': 'condition-group' }}
        initialValue={{ reference: 'queries.list.state', operator: 'equals', value: 'done' }}
        label="visibility"
        onChangeSpy={onChangeSpy}
      />,
    )

    // ConditionGroupPropertyField's own shape selector (T2) — absent from every generic branch
    // (enum/primitive/object) the dispatcher could otherwise have picked for this schema.
    const shapeSelector = screen.getByRole('radiogroup', { name: 'Forma' })
    expect(within(shapeSelector).getByRole('radio', { name: 'Condición simple' })).toHaveAttribute('aria-checked', 'true')

    // None of the generic branches render: no plain text input labelled exactly "visibility"
    // (the generic string branch) and no raw-JSON escape-hatch textarea (disabled `textbox`).
    expect(screen.queryByRole('textbox', { name: 'visibility' })).not.toBeInTheDocument()

    const referenceField = screen.getByLabelText('Referencia') as HTMLInputElement
    expect(referenceField.value).toBe('queries.list.state')

    fireEvent.click(within(shapeSelector).getByRole('radio', { name: 'Grupo (y/o)' }))
    expect(onChangeSpy).toHaveBeenCalledWith({
      operator: 'and',
      conditions: [{ reference: 'queries.list.state', operator: 'equals', value: 'done' }],
    })
  })
})

describe('PropertyFieldDispatcher x-widget hook: color-swatch (T2, 0134)', () => {
  it('delegates to ColorSwatchPropertyField for a schema declaring x-widget: "color-swatch", instead of any generic enum/select branch', () => {
    const onChangeSpy = vi.fn()
    render(
      <ControlledDispatcher
        schema={{ 'x-widget': 'color-swatch' }}
        initialValue="primary"
        label="color"
        onChangeSpy={onChangeSpy}
      />,
    )

    const radiogroup = screen.getByRole('radiogroup', { name: 'color' })
    expect(within(radiogroup).getAllByRole('radio')).toHaveLength(6)
    expect(within(radiogroup).getByRole('radio', { name: 'primary' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.queryByRole('combobox', { name: 'color' })).not.toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: 'color' })).not.toBeInTheDocument()

    fireEvent.click(within(radiogroup).getByRole('radio', { name: 'danger' }))
    expect(onChangeSpy).toHaveBeenCalledWith('danger')
  })

  // The `color-swatch` sentinel itself carries no `enum` — the dispatcher's `x-widget` check runs
  // before it would ever inspect one. This proves the field-name convention (encoded by
  // `resolveColorSwatchPropsSchema` in the properties panel, which produces exactly this sentinel
  // shape for any `color` field declaring an `enum`) wins over cardinality even for a synthetic
  // 3-option field that would otherwise fall in T1's 2-5 segmented range: a sibling `size` property
  // with 3 raw enum options renders as the generic segmented control, while `color` — regardless of
  // how many options its original `enum` had before being swapped for the sentinel — always renders
  // as the fixed six-swatch row.
  it('within an object schema, a "color" property carrying the sentinel renders as six swatches while a sibling 3-option enum property renders as the generic segmented control', () => {
    const onChangeSpy = vi.fn()
    render(
      <ControlledDispatcher
        schema={{
          type: 'object',
          properties: {
            color: { 'x-widget': 'color-swatch' },
            size: { type: 'string', enum: ['sm', 'md', 'lg'] },
          },
        }}
        initialValue={{ color: 'primary', size: 'md' }}
        label="props"
        onChangeSpy={onChangeSpy}
      />,
    )

    const colorGroup = screen.getByRole('radiogroup', { name: 'color' })
    expect(within(colorGroup).getAllByRole('radio')).toHaveLength(6)

    const sizeGroup = screen.getByRole('radiogroup', { name: 'size' })
    expect(within(sizeGroup).getAllByRole('radio')).toHaveLength(3)
  })
})

describe('PropertyFieldDispatcher x-widget hook: query-state-feedback-accordion (T3, 0135)', () => {
  it('delegates to QueryStateFeedbackAccordionPropertyField for a schema declaring x-widget: "query-state-feedback-accordion", instead of any generic branch', () => {
    const onChangeSpy = vi.fn()
    render(
      <QueryStateFeedbackAccordionWidgetContext.Provider
        value={{
          fallbackCacheByState: {},
          onFallbackCacheCommit: vi.fn(),
          expandedStates: new Set(['success']),
          onSetExpanded: vi.fn(),
        }}
      >
        <ControlledDispatcher
          schema={{ 'x-widget': 'query-state-feedback-accordion' }}
          initialValue={{ success: { mode: 'show' } }}
          label="Feedback por estado"
          onChangeSpy={onChangeSpy}
        />
      </QueryStateFeedbackAccordionWidgetContext.Provider>,
    )

    // The widget's own accordion fieldset — absent from every generic branch (object/raw-JSON)
    // the dispatcher could otherwise have picked for this schema.
    expect(screen.getByTestId('query-state-feedback-accordion')).toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: 'Feedback por estado' })).not.toBeInTheDocument()

    const row = screen.getByTestId('query-state-feedback-accordion-row-success')
    expect(within(row).getByRole('radio', { name: 'Mostrar' })).toHaveAttribute('aria-checked', 'true')

    fireEvent.click(within(row).getByRole('radio', { name: 'Ocultar' }))
    expect(onChangeSpy).toHaveBeenCalledWith({ success: { mode: 'hide' } })
  })

  it('throws when mounted without a QueryStateFeedbackAccordionWidgetContext.Provider around the dispatcher (the dispatcher itself provides none)', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(() =>
      render(
        <ControlledDispatcher
          schema={{ 'x-widget': 'query-state-feedback-accordion' }}
          initialValue={undefined}
          label="Feedback por estado"
          onChangeSpy={vi.fn()}
        />,
      ),
    ).toThrow('useQueryStateFeedbackAccordionWidgetContext must be used within')

    consoleErrorSpy.mockRestore()
  })
})

describe('PropertyFieldDispatcher x-widget hook: navigate-params (T3, 0141)', () => {
  it('delegates to NavigateParamsPropertyField for a schema declaring x-widget: "navigate-params", instead of the generic object/raw-JSON branch', () => {
    const onChangeSpy = vi.fn()
    render(
      <ControlledDispatcher
        schema={{ 'x-widget': 'navigate-params' }}
        initialValue={{ id: 'params.userId' }}
        label="params"
        onChangeSpy={onChangeSpy}
      />,
    )

    // NavigateParamsPropertyField renders its row as an editable input for a string value — the
    // generic object branch (no declared `properties`) would instead fall through to the raw-JSON
    // escape hatch, which never produces a labelled "params valor #1" text input.
    const valueField = screen.getByLabelText('params valor #1') as HTMLInputElement
    expect(valueField.tagName).toBe('INPUT')
    expect(valueField.value).toBe('params.userId')

    fireEvent.change(valueField, { target: { value: 'params.otherId' } })
    expect(onChangeSpy).toHaveBeenCalledWith({ id: 'params.otherId' })
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

// T7 (0133): shared label-left / control-right row (`PropertyFieldRow`) applied to the five simple
// controls, plus the group-header style for a nested `ObjectPropertyField`/`ArrayPropertyField`
// legend. Assertions stay on the structural row/legend classes named by the task's own criteria
// (label width + control flex, group-header casing) — not the full decorative class list, per the
// task's restriction against frágil style assertions.
describe('PropertyFieldDispatcher row layout (T7)', () => {
  // A row is <div><label>…</label><div>{control}</div></div>: given the control element, the
  // control's own wrapper is its parent, and the row is that wrapper's parent.
  function getRowParts(control: HTMLElement) {
    const controlWrapper = control.parentElement!
    const row = controlWrapper.parentElement!
    const label = row.querySelector('label')!
    return { row, controlWrapper, label }
  }

  it('renders the text control in a label-left/control-right row', () => {
    const onChangeSpy = vi.fn()
    render(<ControlledDispatcher schema={{ type: 'string' }} initialValue="hola" label="Título" onChangeSpy={onChangeSpy} />)

    const { controlWrapper, label } = getRowParts(screen.getByLabelText('Título'))
    expect(label.className).toContain('w-1/3')
    expect(label.className).toContain('min-w-24')
    expect(controlWrapper.className).toContain('flex-1')
    expect(controlWrapper.className).toContain('min-w-0')
  })

  it('renders the number control in a label-left/control-right row', () => {
    const onChangeSpy = vi.fn()
    render(<ControlledDispatcher schema={{ type: 'number' }} initialValue={0} label="Cantidad" onChangeSpy={onChangeSpy} />)

    const { controlWrapper, label } = getRowParts(screen.getByLabelText('Cantidad'))
    expect(label.className).toContain('w-1/3')
    expect(label.className).toContain('min-w-24')
    expect(controlWrapper.className).toContain('flex-1')
    expect(controlWrapper.className).toContain('min-w-0')
  })

  // T1 (0134): a 2-option enum now renders the segmented radiogroup instead of a `<select>`
  // inside this same row — the row structure itself (label-left/control-right) is unaffected.
  it('renders the segmented enum control in a label-left/control-right row', () => {
    const onChangeSpy = vi.fn()
    render(
      <ControlledDispatcher
        schema={{ type: 'string', enum: ['a', 'b'] }}
        initialValue="a"
        label="Variante"
        onChangeSpy={onChangeSpy}
      />,
    )

    const { controlWrapper, label } = getRowParts(screen.getByRole('radiogroup', { name: 'Variante' }))
    expect(label.className).toContain('w-1/3')
    expect(label.className).toContain('min-w-24')
    expect(controlWrapper.className).toContain('flex-1')
    expect(controlWrapper.className).toContain('min-w-0')
  })

  // Sibling case for the fallback range (6+ options): confirms the row wrapping the plain
  // `<select>` is unchanged by this task.
  it('renders the enum select control in a label-left/control-right row for a 6+ option enum', () => {
    const onChangeSpy = vi.fn()
    render(
      <ControlledDispatcher
        schema={{ type: 'string', enum: ['a', 'b', 'c', 'd', 'e', 'f'] }}
        initialValue="a"
        label="Variante"
        onChangeSpy={onChangeSpy}
      />,
    )

    const { controlWrapper, label } = getRowParts(screen.getByLabelText('Variante'))
    expect(label.className).toContain('w-1/3')
    expect(label.className).toContain('min-w-24')
    expect(controlWrapper.className).toContain('flex-1')
    expect(controlWrapper.className).toContain('min-w-0')
  })

  it('renders the boolean switch to the right of a label-left row without inverting the htmlFor binding', () => {
    const onChangeSpy = vi.fn()
    render(<ControlledDispatcher schema={{ type: 'boolean' }} initialValue={false} label="Activo" onChangeSpy={onChangeSpy} />)

    const toggle = screen.getByLabelText('Activo')
    expect(toggle).toHaveAttribute('role', 'switch')
    const { controlWrapper, label } = getRowParts(toggle)
    expect(label.getAttribute('for')).toBe(toggle.id)
    expect(label.className).toContain('w-1/3')
    expect(controlWrapper.className).toContain('flex-1')

    fireEvent.click(toggle)
    expect(onChangeSpy).toHaveBeenCalledWith(true)
  })

  it('renders the raw-JSON fallback textarea in a label-left/control-right row', () => {
    const onChangeSpy = vi.fn()
    render(
      <ControlledDispatcher
        schema={{ anyOf: [{ type: 'string' }, { type: 'number' }] }}
        initialValue={42}
        label="Valor libre"
        onChangeSpy={onChangeSpy}
      />,
    )

    const { controlWrapper, label } = getRowParts(screen.getByLabelText('Valor libre'))
    expect(label.className).toContain('w-1/3')
    expect(label.className).toContain('min-w-24')
    expect(controlWrapper.className).toContain('flex-1')
    expect(controlWrapper.className).toContain('min-w-0')
  })

  it('styles a nested object legend (e.g. an array-of-objects item group) as an uppercase group header', () => {
    const onChangeSpy = vi.fn()
    const schema = {
      type: 'object',
      properties: {
        columns: {
          type: 'array',
          items: {
            type: 'object',
            properties: { key: { type: 'string' }, label: { type: 'string' } },
          },
        },
      },
    }
    const initialValue = { columns: [{ key: 'name', label: 'Nombre' }] }

    render(<ControlledDispatcher schema={schema} initialValue={initialValue} label="Tabla" onChangeSpy={onChangeSpy} />)

    const nestedGroup = screen.getByRole('group', { name: 'columns #1' })
    const legend = nestedGroup.querySelector('legend')!
    expect(legend.className).toContain('uppercase')
    expect(legend.className).toContain('tracking-wide')
    expect(legend.className).toContain('text-[11px]')
  })
})
