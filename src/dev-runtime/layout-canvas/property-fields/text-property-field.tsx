import { useId } from 'react'

interface TextPropertyFieldProps {
  label: string
  value: string
  onChange: (value: string) => void
  required?: boolean
}

export function TextPropertyField({ label, value, onChange, required = false }: TextPropertyFieldProps) {
  const inputId = useId()

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={inputId} className="text-xs font-medium text-gray-700">
        {label}
        {required && (
          <span aria-hidden="true" className="ml-0.5 text-red-500">
            *
          </span>
        )}
      </label>
      <input
        id={inputId}
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded border border-gray-300 px-2 py-1 text-sm text-gray-900 focus:border-gray-500 focus:outline-none"
      />
    </div>
  )
}
