import type { RuntimeVisibilityOperator } from '../../../config/runtime-config'
import type { SegmentedToggleOption } from './segmented-toggle-property-field'
import { SegmentedTogglePropertyField } from './segmented-toggle-property-field'
import { TextPropertyField } from './text-property-field'
import { NumberPropertyField } from './number-property-field'
import { BooleanPropertyField } from './boolean-property-field'
import { EnumPropertyField } from './enum-property-field'

// Minimal, structurally valid condition seeded on "Añadir" (group mode) and as the starting point
// when `value` is entirely absent (spec, "Estado por defecto"). Named constant so a future default
// change stays a one-line edit.
const DEFAULT_CONDITION: Record<string, unknown> = { reference: '', operator: 'equals', value: '' }

const OPERATORS: readonly RuntimeVisibilityOperator[] = [
  'equals',
  'notEquals',
  'isTruthy',
  'isFalsy',
  'greaterThan',
  'lessThan',
  'arrayContains',
]

const SHAPE_SEGMENTS: ReadonlyArray<SegmentedToggleOption> = [
  { value: 'condition', label: 'Condición simple' },
  { value: 'group', label: 'Grupo (y/o)' },
]

const GROUP_OPERATOR_SEGMENTS: ReadonlyArray<SegmentedToggleOption> = [
  { value: 'and', label: 'and' },
  { value: 'or', label: 'or' },
]

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

// Shape detection (spec, "Detección de forma inicial"): a group is a plain object with `conditions`
// present in its top-level shape and `operator` in the group catalog. Anything else — including
// `undefined`, `null`, a non-object, or a plain object whose `operator` is outside `and`/`or` — is
// treated as a simple condition. Deliberately independent from `resolveUnionBranch`.
function isGroupShape(value: unknown): boolean {
  if (!isPlainObject(value)) return false
  if (!('conditions' in value)) return false
  return value.operator === 'and' || value.operator === 'or'
}

function isScalarOrNull(value: unknown): boolean {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || value === null
}

function readReference(row: Record<string, unknown>): string {
  return typeof row.reference === 'string' ? row.reference : ''
}

function readOperator(row: Record<string, unknown>): RuntimeVisibilityOperator {
  return typeof row.operator === 'string' && (OPERATORS as readonly string[]).includes(row.operator)
    ? (row.operator as RuntimeVisibilityOperator)
    : 'equals'
}

function readItemField(row: Record<string, unknown>): string {
  return typeof row.itemField === 'string' ? row.itemField : ''
}

function readNegate(row: Record<string, unknown>): boolean {
  return typeof row.negate === 'boolean' ? row.negate : false
}

// Applied on every row commit (not only operator changes) so a condition loaded out-of-contract
// (spec, "Casos límite": `operator: 'isTruthy'` with a stale `value` already present) never
// resurfaces its stale `value`/`itemField` through a later, unrelated field edit.
function sanitizeRowForOperator(row: Record<string, unknown>, operator: RuntimeVisibilityOperator): Record<string, unknown> {
  const next = { ...row }
  if (operator === 'isTruthy' || operator === 'isFalsy') {
    delete next.value
    delete next.itemField
    return next
  }
  if (operator !== 'arrayContains') {
    delete next.itemField
  }
  return next
}

// Reconciliation applied whenever a row's `operator` changes (spec, "Reconstrucción al cambiar de
// operador"). Every other field edit (reference/itemField/negate/value) is a plain spread with no
// reconstruction beyond `sanitizeRowForOperator`.
function reconcileForOperatorChange(row: Record<string, unknown>, nextOperator: RuntimeVisibilityOperator): Record<string, unknown> {
  const prevOperator = readOperator(row)
  const next: Record<string, unknown> = { ...row, operator: nextOperator }

  if (nextOperator === 'isTruthy' || nextOperator === 'isFalsy') {
    delete next.value
    delete next.itemField
    return next
  }

  if (prevOperator === 'arrayContains' && nextOperator !== 'arrayContains') {
    delete next.itemField
  }

  if (nextOperator === 'arrayContains' && prevOperator !== 'arrayContains' && !isScalarOrNull(next.value)) {
    next.value = ''
  }

  if ((nextOperator === 'greaterThan' || nextOperator === 'lessThan') && typeof next.value !== 'number') {
    next.value = 0
  }

  return next
}

export interface ConditionGroupPropertyFieldProps {
  label: string
  value: unknown
  onChange: (value: unknown) => void
  // T4 (0133), FR6: when this widget is mounted as the root of a properties-panel tab (the
  // `Visibilidad` tab, whose tab button already shows the section name), the tab label would
  // otherwise repeat as this fieldset's own visible `legend`. `hideRootLegend` keeps the legend in
  // the DOM (so the fieldset keeps an accessible name) but visually hides it via `sr-only`. Every
  // nested accessible name derived from `label` (e.g. `"Visibilidad — Forma"`) is untouched — only
  // this component's own root `legend` reacts to the flag. Defaults to `false` so every other
  // caller (the `visibility`/`when` mounts inside `Props`, and this file's own isolated tests) keeps
  // today's visible legend.
  hideRootLegend?: boolean
}

/**
 * Single reusable widget for the condition/group shape used by `visibility`/`when` (feature
 * `0132`, T2). Purely presentational: it has no visibility into the real JSON Schema fragment
 * behind the `x-widget: 'condition-group'` sentinel (design.md D3) — shape detection and every
 * reconstruction rule below work exclusively off the runtime shape of `value` itself.
 */
export function ConditionGroupPropertyField({ label, value, onChange, hideRootLegend = false }: ConditionGroupPropertyFieldProps) {
  const isGroup = isGroupShape(value)
  const shape = isGroup ? 'group' : 'condition'

  function handleShapeChange(nextShape: string | number) {
    if (nextShape === shape) return

    if (nextShape === 'group') {
      const seedCondition = isPlainObject(value) ? value : DEFAULT_CONDITION
      onChange({ operator: 'and', conditions: [seedCondition] })
      return
    }

    const group = value as Record<string, unknown>
    const conditions = Array.isArray(group.conditions) ? group.conditions : []
    onChange(conditions[0] ?? DEFAULT_CONDITION)
  }

  return (
    <fieldset className="flex flex-col gap-2 rounded border border-dashed border-gray-300 p-2">
      <legend className={hideRootLegend ? 'sr-only' : 'px-1 text-xs font-medium text-gray-700'}>{label}</legend>
      <SegmentedTogglePropertyField label={`${label} — Forma`} segments={SHAPE_SEGMENTS} activeValue={shape} onSelect={handleShapeChange} />
      {isGroup ? (
        <GroupEditor label={label} value={value} onChange={onChange} />
      ) : (
        <ConditionRowEditor label={label} value={value} onChange={onChange} canRemove={false} />
      )}
    </fieldset>
  )
}

interface GroupEditorProps {
  label: string
  value: unknown
  onChange: (value: unknown) => void
}

function GroupEditor({ label, value, onChange }: GroupEditorProps) {
  const group = isPlainObject(value) ? value : {}
  const operator = group.operator === 'or' ? 'or' : 'and'
  const conditions = Array.isArray(group.conditions) ? group.conditions : []
  const canRemoveRows = conditions.length > 1

  function handleOperatorChange(nextOperator: string | number) {
    onChange({ ...group, operator: nextOperator })
  }

  function handleRowChange(index: number, nextCondition: unknown) {
    const nextConditions = conditions.slice()
    nextConditions[index] = nextCondition
    onChange({ ...group, conditions: nextConditions })
  }

  function handleAdd() {
    onChange({ ...group, conditions: [...conditions, DEFAULT_CONDITION] })
  }

  function handleRemove(index: number) {
    if (!canRemoveRows) return
    onChange({ ...group, conditions: conditions.filter((_, itemIndex) => itemIndex !== index) })
  }

  return (
    <div className="flex flex-col gap-2">
      <SegmentedTogglePropertyField
        label={`${label} — Operador del grupo`}
        segments={GROUP_OPERATOR_SEGMENTS}
        activeValue={operator}
        onSelect={handleOperatorChange}
      />
      {conditions.map((condition, index) => (
        // Conditions are plain JSON values with no stable identity of their own; the index is the
        // only ordering key available, consistent with the rest of the panel's array widgets.
        <ConditionRowEditor
          key={index}
          label={`${label} — Condición ${index + 1}`}
          value={condition}
          onChange={(nextCondition) => handleRowChange(index, nextCondition)}
          canRemove={canRemoveRows}
          onRemove={() => handleRemove(index)}
        />
      ))}
      <button
        type="button"
        onClick={handleAdd}
        aria-label={`Añadir ${label}`}
        className="self-start rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100"
      >
        Añadir
      </button>
    </div>
  )
}

interface ConditionRowEditorProps {
  label: string
  value: unknown
  onChange: (next: unknown) => void
  canRemove: boolean
  onRemove?: () => void
}

// Sub-component shared by "Condición simple" mode and every row of "Grupo (y/o)". `onRemove` is
// only ever passed by `GroupEditor`; the "Quitar condición" button renders exclusively when it is
// present, and is disabled (not hidden, spec criterio 5) while `canRemove` is `false`.
function ConditionRowEditor({ label, value, onChange, canRemove, onRemove }: ConditionRowEditorProps) {
  const row = isPlainObject(value) ? value : {}
  const operator = readOperator(row)

  const showItemField = operator === 'arrayContains'
  const showValue = operator !== 'isTruthy' && operator !== 'isFalsy'
  const useTypedValueEditor = operator === 'equals' || operator === 'notEquals' || operator === 'arrayContains'
  const useNumericValueEditor = operator === 'greaterThan' || operator === 'lessThan'

  function commitRowChange(patch: Record<string, unknown>) {
    onChange(sanitizeRowForOperator({ ...row, ...patch }, operator))
  }

  function handleReferenceChange(nextReference: string) {
    commitRowChange({ reference: nextReference })
  }

  function handleOperatorChange(nextOperator: string | number) {
    onChange(reconcileForOperatorChange(row, nextOperator as RuntimeVisibilityOperator))
  }

  function handleItemFieldChange(nextItemField: string) {
    commitRowChange({ itemField: nextItemField })
  }

  function handleNegateChange(nextNegate: boolean) {
    commitRowChange({ negate: nextNegate })
  }

  function handleValueChange(nextValue: unknown) {
    commitRowChange({ value: nextValue })
  }

  return (
    <div role="group" aria-label={label} className="flex flex-col gap-2 rounded border border-gray-200 p-2">
      <TextPropertyField label={`${label} — Referencia`} value={readReference(row)} onChange={handleReferenceChange} />
      <EnumPropertyField label={`${label} — Operador`} value={operator} options={OPERATORS} onChange={handleOperatorChange} />
      {showItemField && (
        <TextPropertyField label={`${label} — itemField`} value={readItemField(row)} onChange={handleItemFieldChange} />
      )}
      {showValue && useTypedValueEditor && (
        <ConditionValueTypedEditor label={`${label} — Valor`} value={row.value} onChange={handleValueChange} />
      )}
      {showValue && useNumericValueEditor && (
        <NumberPropertyField label={`${label} — Valor`} value={typeof row.value === 'number' ? row.value : 0} onChange={handleValueChange} />
      )}
      <BooleanPropertyField label={`${label} — Negar`} value={readNegate(row)} onChange={handleNegateChange} />
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          disabled={!canRemove}
          aria-label="Quitar condición"
          className="self-start rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
        >
          Quitar condición
        </button>
      )}
    </div>
  )
}

type ValueType = 'text' | 'number' | 'boolean' | 'null'

const VALUE_TYPE_SEGMENTS: ReadonlyArray<SegmentedToggleOption> = [
  { value: 'text', label: 'Texto' },
  { value: 'number', label: 'Número' },
  { value: 'boolean', label: 'Booleano' },
  { value: 'null', label: 'Null' },
]

const VALUE_TYPE_DEFAULTS: Record<ValueType, unknown> = {
  text: '',
  number: 0,
  boolean: false,
  null: null,
}

// Type detection from the JS type of the current `value` alone (spec, "Editor de value con
// selector de tipo"). Anything outside the four contract types (undefined, an object, an array)
// degrades silently to Texto without converting the previous value — same criterion the rest of
// the panel already applies to out-of-contract data.
function detectValueType(value: unknown): ValueType {
  if (typeof value === 'string') return 'text'
  if (typeof value === 'number') return 'number'
  if (typeof value === 'boolean') return 'boolean'
  if (value === null) return 'null'
  return 'text'
}

interface ConditionValueTypedEditorProps {
  label: string
  value: unknown
  onChange: (value: unknown) => void
}

function ConditionValueTypedEditor({ label, value, onChange }: ConditionValueTypedEditorProps) {
  const activeType = detectValueType(value)

  function handleTypeChange(nextType: string | number) {
    onChange(VALUE_TYPE_DEFAULTS[nextType as ValueType])
  }

  return (
    <div className="flex flex-col gap-2">
      <SegmentedTogglePropertyField label={`${label} — Tipo`} segments={VALUE_TYPE_SEGMENTS} activeValue={activeType} onSelect={handleTypeChange} />
      {activeType === 'text' && <TextPropertyField label={label} value={typeof value === 'string' ? value : ''} onChange={onChange} />}
      {activeType === 'number' && <NumberPropertyField label={label} value={typeof value === 'number' ? value : 0} onChange={onChange} />}
      {activeType === 'boolean' && <BooleanPropertyField label={label} value={typeof value === 'boolean' ? value : false} onChange={onChange} />}
    </div>
  )
}
