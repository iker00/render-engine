import { fireEvent, render, screen, within } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { ChoiceItemsPropertyField } from '../../dev-runtime/layout-canvas/property-fields/choice-items-property-field'

// ChoiceItemsPropertyField is fully controlled: the caller owns `value` and must feed back
// whatever `onChange` reports. This harness plays that role so each interaction can be observed
// both as an onChange call and as the resulting re-render.
function ControlledChoiceItemsField({
  initialValue,
  label,
  onChangeSpy,
}: {
  initialValue: unknown
  label: string
  onChangeSpy: (value: unknown) => void
}) {
  const [value, setValue] = useState(initialValue)
  return (
    <ChoiceItemsPropertyField
      label={label}
      value={value}
      onChange={(nextValue) => {
        onChangeSpy(nextValue)
        setValue(nextValue)
      }}
    />
  )
}

describe('ChoiceItemsPropertyField manual literal mode', () => {
  it('renders the mode selector as "manualLiteral" and an empty list for an empty array value', () => {
    const onChangeSpy = vi.fn()
    render(<ControlledChoiceItemsField initialValue={[]} label="items" onChangeSpy={onChangeSpy} />)

    const modeSelect = screen.getByLabelText('items') as HTMLSelectElement
    expect(modeSelect.value).toBe('manualLiteral')
    expect(screen.queryByRole('group', { name: 'items #1' })).not.toBeInTheDocument()
  })

  it('"Añadir" inserts a { label: "", value: "" } entry', () => {
    const onChangeSpy = vi.fn()
    render(<ControlledChoiceItemsField initialValue={[]} label="items" onChangeSpy={onChangeSpy} />)

    fireEvent.click(screen.getByRole('button', { name: 'Añadir items' }))
    expect(onChangeSpy).toHaveBeenCalledWith([{ label: '', value: '' }])
  })

  it('"Quitar" removes the targeted entry', () => {
    const onChangeSpy = vi.fn()
    render(
      <ControlledChoiceItemsField
        initialValue={[{ label: 'Uno', value: '1' }, { label: 'Dos', value: '2' }]}
        label="items"
        onChangeSpy={onChangeSpy}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Quitar items #1' }))
    expect(onChangeSpy).toHaveBeenCalledWith([{ label: 'Dos', value: '2' }])
  })

  it('editing an entry emits the flat array with only label/value, no residual dynamic/scalar fields', () => {
    const onChangeSpy = vi.fn()
    render(<ControlledChoiceItemsField initialValue={[{ label: 'Uno', value: '1' }]} label="items" onChangeSpy={onChangeSpy} />)

    const group = screen.getByRole('group', { name: 'items #1' })
    fireEvent.change(within(group).getByLabelText('label'), { target: { value: 'Uno editado' } })
    expect(onChangeSpy).toHaveBeenCalledWith([{ label: 'Uno editado', value: '1' }])

    fireEvent.change(within(group).getByLabelText('value'), { target: { value: '10' } })
    expect(onChangeSpy).toHaveBeenLastCalledWith([{ label: 'Uno editado', value: '10' }])
  })
})

describe('ChoiceItemsPropertyField manual scalar mode', () => {
  it('renders the mode selector as "manualScalar" and an empty list for { values: [] }', () => {
    const onChangeSpy = vi.fn()
    render(<ControlledChoiceItemsField initialValue={{ values: [] }} label="items" onChangeSpy={onChangeSpy} />)

    const modeSelect = screen.getByLabelText('items') as HTMLSelectElement
    expect(modeSelect.value).toBe('manualScalar')
    expect(screen.queryByLabelText('items #1')).not.toBeInTheDocument()
  })

  it('"Añadir" inserts an empty string entry', () => {
    const onChangeSpy = vi.fn()
    render(<ControlledChoiceItemsField initialValue={{ values: [] }} label="items" onChangeSpy={onChangeSpy} />)

    fireEvent.click(screen.getByRole('button', { name: 'Añadir items' }))
    expect(onChangeSpy).toHaveBeenCalledWith({ values: [''] })
  })

  it('"Quitar" removes the targeted entry and editing emits the flat { values } shape', () => {
    const onChangeSpy = vi.fn()
    render(<ControlledChoiceItemsField initialValue={{ values: ['a', 'b'] }} label="items" onChangeSpy={onChangeSpy} />)

    fireEvent.change(screen.getByLabelText('items #1'), { target: { value: 'a editado' } })
    expect(onChangeSpy).toHaveBeenCalledWith({ values: ['a editado', 'b'] })

    fireEvent.click(screen.getByRole('button', { name: 'Quitar items #2' }))
    expect(onChangeSpy).toHaveBeenLastCalledWith({ values: ['a editado'] })
  })
})

describe('ChoiceItemsPropertyField dynamic mode', () => {
  it('renders "dynamic" with itemType "scalar", no label/value fields, and allows editing source', () => {
    const onChangeSpy = vi.fn()
    render(
      <ControlledChoiceItemsField
        initialValue={{ source: 'queries.foo.data', itemType: 'scalar' }}
        label="items"
        onChangeSpy={onChangeSpy}
      />,
    )

    expect((screen.getByLabelText('items') as HTMLSelectElement).value).toBe('dynamic')
    expect((screen.getByLabelText('itemType') as HTMLSelectElement).value).toBe('scalar')
    expect(screen.queryByLabelText('label')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('value')).not.toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('source'), { target: { value: 'queries.bar.data' } })
    expect(onChangeSpy).toHaveBeenCalledWith({ source: 'queries.bar.data', itemType: 'scalar' })
  })

  it('renders "dynamic" with itemType "object" showing label/value, editable, and preserving source', () => {
    const onChangeSpy = vi.fn()
    render(
      <ControlledChoiceItemsField
        initialValue={{ source: 'queries.foo.data', itemType: 'object', label: 'name', value: 'id' }}
        label="items"
        onChangeSpy={onChangeSpy}
      />,
    )

    expect((screen.getByLabelText('itemType') as HTMLSelectElement).value).toBe('object')
    expect((screen.getByLabelText('label') as HTMLInputElement).value).toBe('name')
    expect((screen.getByLabelText('value') as HTMLInputElement).value).toBe('id')

    fireEvent.change(screen.getByLabelText('label'), { target: { value: 'fullName' } })
    expect(onChangeSpy).toHaveBeenCalledWith({ source: 'queries.foo.data', itemType: 'object', label: 'fullName', value: 'id' })

    fireEvent.change(screen.getByLabelText('value'), { target: { value: 'uuid' } })
    expect(onChangeSpy).toHaveBeenLastCalledWith({ source: 'queries.foo.data', itemType: 'object', label: 'fullName', value: 'uuid' })
  })

  it('switching itemType from "object" to "scalar" drops label and value entirely', () => {
    const onChangeSpy = vi.fn()
    render(
      <ControlledChoiceItemsField
        initialValue={{ source: 'queries.foo.data', itemType: 'object', label: 'name', value: 'id' }}
        label="items"
        onChangeSpy={onChangeSpy}
      />,
    )

    fireEvent.change(screen.getByLabelText('itemType'), { target: { value: 'scalar' } })
    const emitted = onChangeSpy.mock.calls[0][0] as Record<string, unknown>
    expect(emitted).toEqual({ source: 'queries.foo.data', itemType: 'scalar' })
    expect('label' in emitted).toBe(false)
    expect('value' in emitted).toBe(false)
  })

  it('switching itemType from "scalar" to "object" reintroduces label and value as empty strings', () => {
    const onChangeSpy = vi.fn()
    render(
      <ControlledChoiceItemsField initialValue={{ source: 'queries.foo.data', itemType: 'scalar' }} label="items" onChangeSpy={onChangeSpy} />,
    )

    fireEvent.change(screen.getByLabelText('itemType'), { target: { value: 'object' } })
    expect(onChangeSpy).toHaveBeenCalledWith({ source: 'queries.foo.data', itemType: 'object', label: '', value: '' })
  })
})

describe('ChoiceItemsPropertyField mode switching', () => {
  it('switching the mode selector replaces the value with the new mode\'s minimal template', () => {
    const onChangeSpy = vi.fn()
    render(<ControlledChoiceItemsField initialValue={[{ label: 'x', value: 'y' }]} label="items" onChangeSpy={onChangeSpy} />)

    fireEvent.change(screen.getByLabelText('items'), { target: { value: 'manualScalar' } })
    expect(onChangeSpy).toHaveBeenCalledWith({ values: [] })

    fireEvent.change(screen.getByLabelText('items'), { target: { value: 'dynamic' } })
    expect(onChangeSpy).toHaveBeenLastCalledWith({ source: '', itemType: 'scalar' })

    fireEvent.change(screen.getByLabelText('items'), { target: { value: 'manualLiteral' } })
    expect(onChangeSpy).toHaveBeenLastCalledWith([])
  })
})

describe('ChoiceItemsPropertyField unrecognizable values', () => {
  it('falls back to an empty manual literal for null without throwing', () => {
    const onChangeSpy = vi.fn()
    expect(() => render(<ControlledChoiceItemsField initialValue={null} label="items" onChangeSpy={onChangeSpy} />)).not.toThrow()

    expect((screen.getByLabelText('items') as HTMLSelectElement).value).toBe('manualLiteral')
    expect(screen.queryByRole('group', { name: 'items #1' })).not.toBeInTheDocument()
  })

  it('falls back to an empty manual literal for an object with neither "values" nor "source"', () => {
    const onChangeSpy = vi.fn()
    expect(() =>
      render(<ControlledChoiceItemsField initialValue={{ foo: 'bar' }} label="items" onChangeSpy={onChangeSpy} />),
    ).not.toThrow()

    expect((screen.getByLabelText('items') as HTMLSelectElement).value).toBe('manualLiteral')
  })
})
