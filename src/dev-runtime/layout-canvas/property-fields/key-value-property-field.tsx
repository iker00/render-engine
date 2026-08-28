import { useId } from 'react'
import { RawJsonPropertyField } from './raw-json-property-field'

export interface KeyValuePropertyFieldProps {
  label: string
  value: Record<string, unknown>
  onChange: (value: Record<string, unknown>) => void
  /**
   * Overrides the default editability criterion (`isNestedValue`, below) for every row. When
   * provided, a row renders as an editable text input only if this returns `true` for its current
   * value; otherwise it falls back to the same read-only `RawJsonPropertyField` used today for
   * nested object/array values (T2, FR3/D5 — e.g. `NavigateParamsPropertyField` degrading any
   * non-string row instead of only object/array ones).
   */
  isValueEditable?: (value: unknown) => boolean
}

/**
 * Editor for a JSON Schema `type: 'object'` with no declared `properties` and
 * `additionalProperties: { type: 'string' }` (T6) — an open string-to-string map such as
 * `httpRequest.headers`. Renders one row per entry (key input + value input + "Quitar"), plus a
 * trailing "Añadir" that appends an entry with an empty key and value.
 *
 * Does not coerce types: an incoming non-string value (e.g. a stray `number`/`boolean` in the
 * value) is displayed via `String(value)` but is left untouched in the object until the user
 * edits that row — only then does it become a plain string (R1, documented behavior).
 *
 * Also renders as the editor for `body` (T7, an override applied by the dispatcher — see
 * `isBareRefSchema` in `property-field-dispatcher.tsx` — since `runtimeApiBodySchema` allows
 * nested objects/arrays as a key's value, not just strings). A row whose current value is itself
 * an object or array falls back to a disabled `RawJsonPropertyField` for that row's value slot
 * only — the key stays editable, "Quitar" stays available, and "Añadir" still creates new rows as
 * plain string/string pairs.
 */
export function KeyValuePropertyField({ label, value, onChange, isValueEditable }: KeyValuePropertyFieldProps) {
  const entries = Object.entries(value)

  function handleKeyChange(index: number, newKey: string) {
    const [oldKey, entryValue] = entries[index]
    if (newKey === oldKey) return
    // Rebuilding from the remaining entries (rather than spreading `value` and deleting `oldKey`)
    // means the renamed entry moves to the end while every other key keeps its relative order —
    // the "reorders keys" behavior called out in the task contract.
    const remainingEntries = entries.filter((_, entryIndex) => entryIndex !== index)
    onChange({ ...Object.fromEntries(remainingEntries), [newKey]: entryValue })
  }

  function handleValueChange(index: number, newValue: string) {
    const nextEntries = entries.slice()
    nextEntries[index] = [nextEntries[index][0], newValue]
    onChange(Object.fromEntries(nextEntries))
  }

  function handleRemove(index: number) {
    const nextEntries = entries.filter((_, entryIndex) => entryIndex !== index)
    onChange(Object.fromEntries(nextEntries))
  }

  function handleAdd() {
    onChange({ ...value, '': '' })
  }

  return (
    <fieldset className="flex flex-col gap-2 rounded border border-gray-200 p-2">
      <legend className="px-1 text-xs font-medium text-gray-700">{label}</legend>
      {entries.map(([entryKey, entryValue], index) => (
        <KeyValueRow
          key={index}
          label={label}
          index={index}
          entryKey={entryKey}
          entryValue={entryValue}
          onKeyChange={(newKey) => handleKeyChange(index, newKey)}
          onValueChange={(newValue) => handleValueChange(index, newValue)}
          onRemove={() => handleRemove(index)}
          isValueEditable={isValueEditable}
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
    </fieldset>
  )
}

interface KeyValueRowProps {
  label: string
  index: number
  entryKey: string
  entryValue: unknown
  onKeyChange: (newKey: string) => void
  onValueChange: (newValue: string) => void
  onRemove: () => void
  isValueEditable?: (value: unknown) => boolean
}

// A row's value can't be edited as this field's plain text/text pair once it stops being a
// primitive — `body` (T7) is the one caller whose values can nest objects/arrays; every other
// caller (`headers`, `query`, T6) only ever passes primitives, so this is always `false` for them.
function isNestedValue(entryValue: unknown): boolean {
  return entryValue !== null && typeof entryValue === 'object'
}

function KeyValueRow({ label, index, entryKey, entryValue, onKeyChange, onValueChange, onRemove, isValueEditable }: KeyValueRowProps) {
  const keyInputId = useId()
  const valueInputId = useId()
  const valueLabel = `${label} valor #${index + 1}`
  // Never coerce an incoming non-string value; only the display string is derived (R1).
  const displayValue = typeof entryValue === 'string' ? entryValue : String(entryValue)
  const isReadOnly = isValueEditable ? !isValueEditable(entryValue) : isNestedValue(entryValue)

  return (
    <div className="flex items-start gap-2">
      <div className="flex flex-1 flex-col gap-1">
        <label htmlFor={keyInputId} className="text-xs font-medium text-gray-700">
          {`${label} clave #${index + 1}`}
        </label>
        <input
          id={keyInputId}
          type="text"
          value={entryKey}
          onChange={(event) => onKeyChange(event.target.value)}
          className="rounded border border-gray-300 px-2 py-1 text-sm text-gray-900 focus:border-gray-500 focus:outline-none"
        />
      </div>
      <div className="flex flex-1 flex-col gap-1">
        {isReadOnly ? (
          // T7: an object/array value has no safe text-input representation — same fallback the
          // dispatcher uses for any value it can't render as a form field, applied per-row instead
          // of forking the whole editor. Read-only here; committing this row's value stays the
          // KV editor's own single commit path ("Quitar"/key rename/"Añadir"), never a second route.
          <RawJsonPropertyField label={valueLabel} value={entryValue} onChange={() => {}} />
        ) : (
          <>
            <label htmlFor={valueInputId} className="text-xs font-medium text-gray-700">
              {valueLabel}
            </label>
            <input
              id={valueInputId}
              type="text"
              value={displayValue}
              onChange={(event) => onValueChange(event.target.value)}
              className="rounded border border-gray-300 px-2 py-1 text-sm text-gray-900 focus:border-gray-500 focus:outline-none"
            />
          </>
        )}
      </div>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Quitar ${label} #${index + 1}`}
        className="mt-5 rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100"
      >
        Quitar
      </button>
    </div>
  )
}
