import { useId } from 'react'
import { PropertyFieldRow } from './property-field-row'

interface NumberPropertyFieldProps {
  label: string
  value: number
  onChange: (value: number) => void
  required?: boolean
}

export function NumberPropertyField({ label, value, onChange, required = false }: NumberPropertyFieldProps) {
  const inputId = useId()

  return (
    <PropertyFieldRow htmlFor={inputId} label={label} required={required}>
      <input
        id={inputId}
        type="number"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full rounded-md border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900 focus:border-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-400"
      />
    </PropertyFieldRow>
  )
}
