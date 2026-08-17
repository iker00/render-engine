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
      <input
        id={inputId}
        type="checkbox"
        checked={value}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 rounded border-gray-300 text-gray-800 focus:outline-none focus:ring-1 focus:ring-gray-400"
      />
    </PropertyFieldRow>
  )
}
