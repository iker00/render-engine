import { EnumPropertyField } from './enum-property-field'
import { TextPropertyField } from './text-property-field'

// The three shapes `props.items` of `select`/`radioGroup`/`checkboxGroup` can take (T1, 0108):
// manual literal (array of `{ label, value }`), manual scalar (`{ values: [...] }`), or dynamic
// (`{ source, itemType: 'scalar' | 'object', label?, value? }`, `itemType` mandatory). No other
// shape is part of the contract.
export type ChoiceItemsMode = 'manualLiteral' | 'manualScalar' | 'dynamic'

interface ManualLiteralItem {
  label: string
  value: string
}

interface DynamicValue {
  source: string
  itemType: 'scalar' | 'object'
  label?: string
  value?: string
}

const MODE_OPTIONS: ChoiceItemsMode[] = ['manualLiteral', 'manualScalar', 'dynamic']

const MODE_LABELS: Record<string, string> = {
  manualLiteral: 'Manual — literal',
  manualScalar: 'Manual — escalar',
  dynamic: 'Dinámico',
}

// Minimal, structurally valid template for each mode. Switching modes always replaces the value
// wholesale — nothing from the previous mode survives (D5, tasks.md T4).
const MODE_DEFAULTS: Record<ChoiceItemsMode, unknown> = {
  manualLiteral: [],
  manualScalar: { values: [] },
  dynamic: { source: '', itemType: 'scalar' },
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

// Detects the mode from the value's own shape: array → manual literal, object with a `values`
// array → manual scalar, object with a string `source` → dynamic. Anything else (including
// `null`/`undefined`/a malformed object) falls back to an empty manual literal rather than
// throwing — the panel must stay usable even when the underlying value doesn't match the contract.
function detectMode(value: unknown): ChoiceItemsMode {
  if (Array.isArray(value)) return 'manualLiteral'
  if (isPlainObject(value) && Array.isArray(value.values)) return 'manualScalar'
  if (isPlainObject(value) && typeof value.source === 'string') return 'dynamic'
  return 'manualLiteral'
}

function toManualLiteralItem(item: unknown): ManualLiteralItem {
  if (!isPlainObject(item)) return { label: '', value: '' }
  const label = typeof item.label === 'string' ? item.label : ''
  const value = typeof item.value === 'string' ? item.value : item.value !== undefined ? String(item.value) : ''
  return { label, value }
}

function toDynamicValue(value: unknown): DynamicValue {
  if (!isPlainObject(value) || typeof value.source !== 'string') {
    return { source: '', itemType: 'scalar' }
  }
  const itemType: 'scalar' | 'object' = value.itemType === 'object' ? 'object' : 'scalar'
  if (itemType === 'scalar') {
    return { source: value.source, itemType: 'scalar' }
  }
  return {
    source: value.source,
    itemType: 'object',
    label: typeof value.label === 'string' ? value.label : '',
    value: typeof value.value === 'string' ? value.value : '',
  }
}

export interface ChoiceItemsPropertyFieldProps {
  label: string
  value: unknown
  onChange: (value: unknown) => void
}

/**
 * Dedicated widget for `props.items` of `select`/`radioGroup`/`checkboxGroup` (T4, 0108). Wired
 * into `PropertyFieldDispatcher` via the `x-widget: 'choice-items'` hook (D5) instead of the
 * generic union/object patterns, since the three shapes share no discriminated `type` literal the
 * dispatcher's generic detectors could key off.
 */
export function ChoiceItemsPropertyField({ label, value, onChange }: ChoiceItemsPropertyFieldProps) {
  const mode = detectMode(value)

  function handleModeChange(nextMode: string | number) {
    onChange(MODE_DEFAULTS[nextMode as ChoiceItemsMode])
  }

  return (
    <fieldset className="flex flex-col gap-2 rounded border border-gray-200 p-2">
      <legend className="px-1 text-xs font-medium text-gray-700">{label}</legend>
      <EnumPropertyField label={label} value={mode} options={MODE_OPTIONS} optionLabels={MODE_LABELS} onChange={handleModeChange} />
      {mode === 'manualLiteral' && (
        <ManualLiteralItemsEditor label={label} items={Array.isArray(value) ? value.map(toManualLiteralItem) : []} onChange={onChange} />
      )}
      {mode === 'manualScalar' && (
        <ManualScalarItemsEditor
          label={label}
          items={isPlainObject(value) && Array.isArray(value.values) ? value.values : []}
          onChange={onChange}
        />
      )}
      {mode === 'dynamic' && <DynamicItemsEditor label={label} value={toDynamicValue(value)} onChange={onChange} />}
    </fieldset>
  )
}

interface ManualLiteralItemsEditorProps {
  label: string
  items: ManualLiteralItem[]
  onChange: (value: unknown) => void
}

function ManualLiteralItemsEditor({ label, items, onChange }: ManualLiteralItemsEditorProps) {
  function handleFieldChange(index: number, field: 'label' | 'value', nextFieldValue: string) {
    const next = items.slice()
    next[index] = { ...next[index], [field]: nextFieldValue }
    onChange(next)
  }

  function handleAdd() {
    onChange([...items, { label: '', value: '' }])
  }

  function handleRemove(index: number) {
    onChange(items.filter((_, itemIndex) => itemIndex !== index))
  }

  return (
    <div className="flex flex-col gap-2">
      {items.map((item, index) => (
        // No stable identity of its own (plain JSON values); index is the only ordering key,
        // consistent with the generic `ArrayPropertyField` convention elsewhere in the dispatcher.
        <div key={index} role="group" aria-label={`${label} #${index + 1}`} className="flex items-start gap-2 rounded border border-gray-200 p-2">
          <div className="flex flex-1 flex-col gap-2">
            <TextPropertyField label="label" value={item.label} onChange={(nextValue) => handleFieldChange(index, 'label', nextValue)} />
            <TextPropertyField label="value" value={item.value} onChange={(nextValue) => handleFieldChange(index, 'value', nextValue)} />
          </div>
          <button
            type="button"
            onClick={() => handleRemove(index)}
            aria-label={`Quitar ${label} #${index + 1}`}
            className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100"
          >
            Quitar
          </button>
        </div>
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

interface ManualScalarItemsEditorProps {
  label: string
  items: unknown[]
  onChange: (value: unknown) => void
}

function ManualScalarItemsEditor({ label, items, onChange }: ManualScalarItemsEditorProps) {
  function toScalarString(item: unknown): string {
    return typeof item === 'string' ? item : item !== undefined && item !== null ? String(item) : ''
  }

  function handleItemChange(index: number, nextValue: string) {
    const next = items.slice()
    next[index] = nextValue
    onChange({ values: next })
  }

  function handleAdd() {
    onChange({ values: [...items, ''] })
  }

  function handleRemove(index: number) {
    onChange({ values: items.filter((_, itemIndex) => itemIndex !== index) })
  }

  return (
    <div className="flex flex-col gap-2">
      {items.map((item, index) => (
        <div key={index} className="flex items-center gap-2">
          <div className="flex-1">
            <TextPropertyField label={`${label} #${index + 1}`} value={toScalarString(item)} onChange={(nextValue) => handleItemChange(index, nextValue)} />
          </div>
          <button
            type="button"
            onClick={() => handleRemove(index)}
            aria-label={`Quitar ${label} #${index + 1}`}
            className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100"
          >
            Quitar
          </button>
        </div>
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

interface DynamicItemsEditorProps {
  label: string
  value: DynamicValue
  onChange: (value: unknown) => void
}

function DynamicItemsEditor({ value, onChange }: DynamicItemsEditorProps) {
  function handleSourceChange(nextSource: string) {
    onChange({ ...value, source: nextSource })
  }

  function handleItemTypeChange(nextItemType: string | number) {
    if (nextItemType === 'object') {
      onChange({ source: value.source, itemType: 'object', label: '', value: '' })
      return
    }
    onChange({ source: value.source, itemType: 'scalar' })
  }

  function handleLabelChange(nextLabel: string) {
    onChange({ ...value, label: nextLabel })
  }

  function handleValueChange(nextValue: string) {
    onChange({ ...value, value: nextValue })
  }

  return (
    <div className="flex flex-col gap-2">
      <TextPropertyField label="source" value={value.source} onChange={handleSourceChange} />
      <EnumPropertyField label="itemType" value={value.itemType} options={['scalar', 'object']} onChange={handleItemTypeChange} />
      {value.itemType === 'object' && (
        <>
          <TextPropertyField label="label" value={value.label ?? ''} onChange={handleLabelChange} />
          <TextPropertyField label="value" value={value.value ?? ''} onChange={handleValueChange} />
        </>
      )}
    </div>
  )
}
