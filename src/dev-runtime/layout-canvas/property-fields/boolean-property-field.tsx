import { useId } from 'react'

interface BooleanPropertyFieldProps {
  label: string
  value: boolean
  onChange: (value: boolean) => void
}

export function BooleanPropertyField({ label, value, onChange }: BooleanPropertyFieldProps) {
  const inputId = useId()

  return (
    <div className="flex items-center gap-2">
      <input
        id={inputId}
        type="checkbox"
        checked={value}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 rounded border-gray-300 text-gray-800 focus:ring-gray-500"
      />
      <label htmlFor={inputId} className="text-xs font-medium text-gray-700">
        {label}
      </label>
    </div>
  )
}
