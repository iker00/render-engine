import { render, screen, within, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ConditionGroupPropertyField } from '../../dev-runtime/layout-canvas/property-fields/condition-group-property-field'

const LABEL = 'Visibilidad'

function renderField(value: unknown) {
  const onChange = vi.fn()
  render(<ConditionGroupPropertyField label={LABEL} value={value} onChange={onChange} />)
  return onChange
}

describe('ConditionGroupPropertyField shape detection and selector', () => {
  it('starts in "Condición simple" for a simple-condition value, with its fields visible', () => {
    renderField({ reference: 'params.userId', operator: 'equals', value: 'x' })

    expect(screen.getByRole('radio', { name: 'Condición simple' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: 'Grupo (y/o)' })).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByRole('textbox', { name: `${LABEL} — Referencia` })).toHaveValue('params.userId')
  })

  it('starts in "Grupo (y/o)" for a group value, with the operator toggle and one row per condition', () => {
    renderField({
      operator: 'and',
      conditions: [
        { reference: 'a', operator: 'equals', value: '1' },
        { reference: 'b', operator: 'equals', value: '2' },
      ],
    })

    expect(screen.getByRole('radio', { name: 'Grupo (y/o)' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: 'and' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('group', { name: `${LABEL} — Condición 1` })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: `${LABEL} — Condición 2` })).toBeInTheDocument()
  })

  it('starts in "Condición simple" with the minimal default condition when value is undefined, without calling onChange', () => {
    const onChange = renderField(undefined)

    expect(screen.getByRole('radio', { name: 'Condición simple' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('textbox', { name: `${LABEL} — Referencia` })).toHaveValue('')
    expect(onChange).not.toHaveBeenCalled()
  })

  it('does not call onChange when reselecting the already-active shape segment', () => {
    const onChange = renderField({ reference: 'a', operator: 'equals', value: 'x' })

    fireEvent.click(screen.getByRole('radio', { name: 'Condición simple' }))

    expect(onChange).not.toHaveBeenCalled()
  })
})

describe('ConditionGroupPropertyField shape transitions', () => {
  it('switching to "Grupo (y/o)" wraps the current condition as the sole row, negate included', () => {
    const onChange = renderField({ reference: 'params.a', operator: 'equals', value: 'x', negate: true })

    fireEvent.click(screen.getByRole('radio', { name: 'Grupo (y/o)' }))

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith({
      operator: 'and',
      conditions: [{ reference: 'params.a', operator: 'equals', value: 'x', negate: true }],
    })
  })

  it('switching to "Condición simple" applies the first condition of the group, discarding the rest', () => {
    const c1 = { reference: 'a', operator: 'equals', value: '1' }
    const c2 = { reference: 'b', operator: 'equals', value: '2' }
    const c3 = { reference: 'c', operator: 'equals', value: '3' }
    const onChange = renderField({ operator: 'or', conditions: [c1, c2, c3] })

    fireEvent.click(screen.getByRole('radio', { name: 'Condición simple' }))

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith(c1)
  })
})

describe('ConditionGroupPropertyField group operator toggle', () => {
  it('emits operator: "or" when clicking "or" from an "and" group', () => {
    const value = { operator: 'and', conditions: [{ reference: 'a', operator: 'equals', value: '1' }] }
    const onChange = renderField(value)

    fireEvent.click(screen.getByRole('radio', { name: 'or' }))

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith({ ...value, operator: 'or' })
  })

  it('does not call onChange when clicking the already-active "and" segment', () => {
    const value = { operator: 'and', conditions: [{ reference: 'a', operator: 'equals', value: '1' }] }
    const onChange = renderField(value)

    fireEvent.click(screen.getByRole('radio', { name: 'and' }))

    expect(onChange).not.toHaveBeenCalled()
  })
})

describe('ConditionGroupPropertyField group row remove/add', () => {
  it('disables "Quitar condición" and ignores its click with a single condition', () => {
    const c1 = { reference: 'a', operator: 'equals', value: '1' }
    const value = { operator: 'and', conditions: [c1] }
    const onChange = renderField(value)

    const row = screen.getByRole('group', { name: `${LABEL} — Condición 1` })
    const removeButton = within(row).getByRole('button', { name: 'Quitar condición' })
    expect(removeButton).toBeDisabled()

    fireEvent.click(removeButton)

    expect(onChange).not.toHaveBeenCalled()
  })

  it('enables both "Quitar condición" buttons with two conditions, and removes the targeted row', () => {
    const c1 = { reference: 'a', operator: 'equals', value: '1' }
    const c2 = { reference: 'b', operator: 'equals', value: '2' }
    const value = { operator: 'and', conditions: [c1, c2] }
    const onChange = renderField(value)

    const row1 = screen.getByRole('group', { name: `${LABEL} — Condición 1` })
    const row2 = screen.getByRole('group', { name: `${LABEL} — Condición 2` })
    expect(within(row1).getByRole('button', { name: 'Quitar condición' })).toBeEnabled()
    expect(within(row2).getByRole('button', { name: 'Quitar condición' })).toBeEnabled()

    fireEvent.click(within(row2).getByRole('button', { name: 'Quitar condición' }))

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith({ ...value, conditions: [c1] })
  })

  it('adds a minimal default condition on "Añadir"', () => {
    const c1 = { reference: 'a', operator: 'equals', value: '1' }
    const value = { operator: 'and', conditions: [c1] }
    const onChange = renderField(value)

    fireEvent.click(screen.getByRole('button', { name: `Añadir ${LABEL}` }))

    expect(onChange).toHaveBeenCalledWith({
      ...value,
      conditions: [c1, { reference: '', operator: 'equals', value: '' }],
    })
  })
})

describe('ConditionGroupPropertyField conditional fields by operator', () => {
  it('shows itemField only for operator "arrayContains"', () => {
    renderField({ reference: 'a', operator: 'arrayContains', value: 'x', itemField: 'code' })
    expect(screen.getByRole('textbox', { name: `${LABEL} — itemField` })).toHaveValue('code')
  })

  it.each(['equals', 'notEquals', 'isTruthy', 'isFalsy', 'greaterThan', 'lessThan'])(
    'hides itemField for operator %s',
    (operator) => {
      const value = operator === 'greaterThan' || operator === 'lessThan' ? 1 : 'x'
      renderField({ reference: 'a', operator, value })
      expect(screen.queryByRole('textbox', { name: `${LABEL} — itemField` })).not.toBeInTheDocument()
    },
  )

  it.each(['isTruthy', 'isFalsy'])('hides the value editor for operator %s', (operator) => {
    renderField({ reference: 'a', operator })

    expect(screen.queryByRole('radiogroup', { name: `${LABEL} — Valor — Tipo` })).not.toBeInTheDocument()
    expect(screen.queryByRole('spinbutton', { name: `${LABEL} — Valor` })).not.toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: `${LABEL} — Valor` })).not.toBeInTheDocument()
  })
})

describe('ConditionGroupPropertyField typed value editor (equals/notEquals/arrayContains)', () => {
  it('shows Texto active with the string value for a string', () => {
    renderField({ reference: 'a', operator: 'equals', value: 'x' })

    expect(screen.getByRole('radio', { name: 'Texto' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('textbox', { name: `${LABEL} — Valor` })).toHaveValue('x')
  })

  it('shows Número active with the numeric value for a number', () => {
    renderField({ reference: 'a', operator: 'equals', value: 3 })

    expect(screen.getByRole('radio', { name: 'Número' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('spinbutton', { name: `${LABEL} — Valor` })).toHaveValue(3)
  })

  it('shows Booleano active with the boolean value for a boolean', () => {
    renderField({ reference: 'a', operator: 'equals', value: true })

    expect(screen.getByRole('radio', { name: 'Booleano' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('checkbox', { name: `${LABEL} — Valor` })).toBeChecked()
  })

  it('shows Null active with no additional control for null', () => {
    renderField({ reference: 'a', operator: 'equals', value: null })

    expect(screen.getByRole('radio', { name: 'Null' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.queryByRole('textbox', { name: `${LABEL} — Valor` })).not.toBeInTheDocument()
    expect(screen.queryByRole('spinbutton', { name: `${LABEL} — Valor` })).not.toBeInTheDocument()
    expect(screen.queryByRole('checkbox', { name: `${LABEL} — Valor` })).not.toBeInTheDocument()
  })

  it('switches Texto -> Número emitting value: 0', () => {
    const onChange = renderField({ reference: 'a', operator: 'equals', value: 'x' })
    fireEvent.click(screen.getByRole('radio', { name: 'Número' }))
    expect(onChange).toHaveBeenCalledWith({ reference: 'a', operator: 'equals', value: 0 })
  })

  it('switches Texto -> Booleano emitting value: false', () => {
    const onChange = renderField({ reference: 'a', operator: 'equals', value: 'x' })
    fireEvent.click(screen.getByRole('radio', { name: 'Booleano' }))
    expect(onChange).toHaveBeenCalledWith({ reference: 'a', operator: 'equals', value: false })
  })

  it('switches Texto -> Null emitting value: null', () => {
    const onChange = renderField({ reference: 'a', operator: 'equals', value: 'x' })
    fireEvent.click(screen.getByRole('radio', { name: 'Null' }))
    expect(onChange).toHaveBeenCalledWith({ reference: 'a', operator: 'equals', value: null })
  })

  it('switches Número -> Texto emitting value: ""', () => {
    const onChange = renderField({ reference: 'a', operator: 'equals', value: 5 })
    fireEvent.click(screen.getByRole('radio', { name: 'Texto' }))
    expect(onChange).toHaveBeenCalledWith({ reference: 'a', operator: 'equals', value: '' })
  })

  it('does not call onChange when reselecting the already-active type', () => {
    const onChange = renderField({ reference: 'a', operator: 'equals', value: 'x' })
    fireEvent.click(screen.getByRole('radio', { name: 'Texto' }))
    expect(onChange).not.toHaveBeenCalled()
  })
})

describe('ConditionGroupPropertyField numeric editor (greaterThan/lessThan)', () => {
  it('renders a plain numeric input without the type selector', () => {
    renderField({ reference: 'a', operator: 'greaterThan', value: 42 })

    expect(screen.queryByRole('radiogroup', { name: `${LABEL} — Valor — Tipo` })).not.toBeInTheDocument()
    expect(screen.getByRole('spinbutton', { name: `${LABEL} — Valor` })).toHaveValue(42)
  })

  it('emits the new number on change', () => {
    const onChange = renderField({ reference: 'a', operator: 'greaterThan', value: 42 })

    fireEvent.change(screen.getByRole('spinbutton', { name: `${LABEL} — Valor` }), { target: { value: '7' } })

    expect(onChange).toHaveBeenCalledWith({ reference: 'a', operator: 'greaterThan', value: 7 })
  })
})

describe('ConditionGroupPropertyField operator reconciliation', () => {
  function changeOperator(nextOperator: string) {
    fireEvent.change(screen.getByRole('combobox', { name: `${LABEL} — Operador` }), { target: { value: nextOperator } })
  }

  it('drops value (absent, not undefined) when switching to isTruthy', () => {
    const onChange = renderField({ reference: 'r', operator: 'equals', value: 'x' })

    changeOperator('isTruthy')

    const emitted = onChange.mock.calls[0][0] as Record<string, unknown>
    expect(emitted).toEqual({ reference: 'r', operator: 'isTruthy' })
    expect('value' in emitted).toBe(false)
  })

  it('seeds value: 0 when switching to greaterThan from a non-numeric value', () => {
    const onChange = renderField({ reference: 'r', operator: 'equals', value: 'x' })

    changeOperator('greaterThan')

    expect(onChange).toHaveBeenCalledWith({ reference: 'r', operator: 'greaterThan', value: 0 })
  })

  it('preserves an already-numeric value when switching between greaterThan and lessThan', () => {
    const onChange = renderField({ reference: 'r', operator: 'greaterThan', value: 5 })

    changeOperator('lessThan')

    expect(onChange).toHaveBeenCalledWith({ reference: 'r', operator: 'lessThan', value: 5 })
  })

  it('drops itemField when switching away from arrayContains', () => {
    const onChange = renderField({ reference: 'r', operator: 'arrayContains', value: 'x', itemField: 'code' })

    changeOperator('equals')

    expect(onChange).toHaveBeenCalledWith({ reference: 'r', operator: 'equals', value: 'x' })
  })

  it('preserves value and leaves itemField absent when switching into arrayContains', () => {
    const onChange = renderField({ reference: 'r', operator: 'equals', value: 'x' })

    changeOperator('arrayContains')

    const emitted = onChange.mock.calls[0][0] as Record<string, unknown>
    expect(emitted).toEqual({ reference: 'r', operator: 'arrayContains', value: 'x' })
    expect('itemField' in emitted).toBe(false)
  })

  it('preserves value when switching between equals and notEquals', () => {
    const onChange = renderField({ reference: 'r', operator: 'equals', value: true })

    changeOperator('notEquals')

    expect(onChange).toHaveBeenCalledWith({ reference: 'r', operator: 'notEquals', value: true })
  })
})

describe('ConditionGroupPropertyField edge cases', () => {
  it('does not call onChange on mount when value is undefined', () => {
    const onChange = renderField(undefined)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('hides the value control for a hand-edited isTruthy condition with a stale value, and does not reintroduce it on a later edit', () => {
    const onChange = renderField({ reference: 'r', operator: 'isTruthy', value: 'x' })

    expect(screen.queryByRole('textbox', { name: `${LABEL} — Valor` })).not.toBeInTheDocument()

    fireEvent.change(screen.getByRole('textbox', { name: `${LABEL} — Referencia` }), { target: { value: 'r2' } })

    expect(onChange).toHaveBeenCalledWith({ reference: 'r2', operator: 'isTruthy' })
  })

  it('degrades an out-of-contract object value to Texto without converting it, and a later edit overwrites it with a string', () => {
    const onChange = renderField({ reference: 'r', operator: 'equals', value: { anidado: true } })

    expect(screen.getByRole('radio', { name: 'Texto' })).toHaveAttribute('aria-checked', 'true')
    const input = screen.getByRole('textbox', { name: `${LABEL} — Valor` })
    expect(input).toHaveValue('')

    fireEvent.change(input, { target: { value: 'nuevo' } })

    expect(onChange).toHaveBeenCalledWith({ reference: 'r', operator: 'equals', value: 'nuevo' })
  })
})

describe('ConditionGroupPropertyField accessible label regression', () => {
  it('surfaces the received label on at least one accessible group', () => {
    renderField({ reference: 'a', operator: 'equals', value: 'x' })
    expect(screen.getAllByRole('group', { name: new RegExp(LABEL) }).length).toBeGreaterThan(0)
  })
})

// T4 (0133), FR6: `hideRootLegend` visually hides the root `legend` (kept in the DOM for the
// fieldset's accessible name) without touching any nested accessible name derived from `label`.
describe('ConditionGroupPropertyField hideRootLegend (T4, 0133)', () => {
  it('regression: without hideRootLegend (the default), the root legend renders visible as today', () => {
    render(<ConditionGroupPropertyField label={LABEL} value={{ reference: 'a', operator: 'equals', value: 'x' }} onChange={vi.fn()} />)

    const legend = screen.getByText(LABEL, { selector: 'legend' })
    expect(legend).not.toHaveClass('sr-only')
  })

  it('hides the root legend visually with hideRootLegend, keeping it in the DOM and leaving nested accessible names unchanged', () => {
    render(
      <ConditionGroupPropertyField
        label={LABEL}
        value={{ reference: 'a', operator: 'equals', value: 'x' }}
        onChange={vi.fn()}
        hideRootLegend
      />,
    )

    const legend = screen.getByText(LABEL, { selector: 'legend' })
    expect(legend).toHaveClass('sr-only')
    // The fieldset keeps `legend` as its (visually-hidden) accessible name.
    expect(legend.closest('fieldset')).toHaveAccessibleName(LABEL)
    // Nested labels derived from `label` (e.g. "Visibilidad — Forma") are untouched.
    expect(screen.getByRole('radiogroup', { name: `${LABEL} — Forma` })).toBeInTheDocument()
  })
})
