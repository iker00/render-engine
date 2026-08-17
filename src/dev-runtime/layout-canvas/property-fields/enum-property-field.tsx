import { useId, type ChangeEvent } from 'react'
import { PropertyFieldRow } from './property-field-row'

interface EnumPropertyFieldProps {
  label: string
  value: string | number
  options: readonly (string | number)[]
  // Optional display text per option (keyed by `String(option)`), distinct from the underlying
  // value. Falls back to `String(option)` for any option missing from the map. Used by
  // `DiscriminatedUnionPropertyField` (T5) to show readable Spanish labels for action variants
  // while keeping the actual committed value as the raw `type` literal.
  optionLabels?: Record<string, string>
  onChange: (value: string | number) => void
  required?: boolean
}

export function EnumPropertyField({ label, value, options, optionLabels, onChange, required = false }: EnumPropertyFieldProps) {
  const selectId = useId()

  function handleChange(event: ChangeEvent<HTMLSelectElement>) {
    const selectedOption = options.find((option) => String(option) === event.target.value)
    onChange(selectedOption ?? event.target.value)
  }

  return (
    <PropertyFieldRow htmlFor={selectId} label={label} required={required}>
      <select
        id={selectId}
        value={String(value)}
        onChange={handleChange}
        className="w-full rounded-md border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900 focus:border-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-400"
      >
        {options.map((option) => (
          <option key={String(option)} value={String(option)}>
            {optionLabels?.[String(option)] ?? String(option)}
          </option>
        ))}
      </select>
    </PropertyFieldRow>
  )
}
