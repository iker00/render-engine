import { useId, type ChangeEvent } from 'react'
import { PropertyFieldRow } from './property-field-row'

export interface RawJsonPropertyFieldProps {
  label: string
  value: unknown
  onChange: (value: unknown) => void
}

/**
 * Escape hatch for schema fragments the dispatcher can't represent (missing schema, unsupported
 * unions, etc.), and — since T7 — for an individual key-value-editor row (`KeyValuePropertyField`)
 * whose current value is itself an object or array (e.g. a nested `body` key). Editing raw JSON
 * back into a typed value is only safe when the current value is already a plain string; any other
 * shape is shown read-only and must be edited from Monaco.
 */
export function RawJsonPropertyField({ label, value, onChange }: RawJsonPropertyFieldProps) {
  const textareaId = useId()
  const isEditableAsString = typeof value === 'string'
  const serialized = isEditableAsString ? value : (JSON.stringify(value, null, 2) ?? '')

  function handleChange(event: ChangeEvent<HTMLTextAreaElement>) {
    if (isEditableAsString) onChange(event.target.value)
  }

  return (
    <PropertyFieldRow htmlFor={textareaId} label={label} align="top">
      <textarea
        id={textareaId}
        value={serialized}
        disabled={!isEditableAsString}
        onChange={handleChange}
        rows={3}
        className="w-full rounded-md border border-gray-300 bg-white px-2 py-1 font-mono text-xs text-gray-900 focus:border-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-400 disabled:bg-gray-100 disabled:text-gray-500"
      />
      {!isEditableAsString && (
        <p className="mt-1 text-[11px] text-gray-500">
          Este valor no se puede editar de forma segura desde el formulario. Usa el editor JSON (Monaco) para
          modificarlo.
        </p>
      )}
    </PropertyFieldRow>
  )
}
