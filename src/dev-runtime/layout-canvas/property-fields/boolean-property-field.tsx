import { useId } from 'react'
import { PropertyFieldRow } from './property-field-row'

interface BooleanPropertyFieldProps {
  label: string
  value: boolean
  onChange: (value: boolean) => void
}

export function BooleanPropertyField({ label, value, onChange }: BooleanPropertyFieldProps) {
  const inputId = useId()

  return (
    <PropertyFieldRow htmlFor={inputId} label={label}>
      <button
        id={inputId}
        type="button"
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-1 focus:ring-gray-400 ${
          value ? 'bg-gray-800' : 'bg-gray-300'
        }`}
      >
        <span
          aria-hidden="true"
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
            value ? 'translate-x-4' : 'translate-x-0.5'
          }`}
        />
      </button>
    </PropertyFieldRow>
  )
}
