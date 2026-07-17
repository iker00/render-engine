import { useId } from 'react'

interface NumberPropertyFieldProps {
  label: string
  value: number
  onChange: (value: number) => void
  required?: boolean
}

export function NumberPropertyField({ label, value, onChange, required = false }: NumberPropertyFieldProps) {
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
        type="number"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="rounded border border-gray-300 px-2 py-1 text-sm text-gray-900 focus:border-gray-500 focus:outline-none"
      />
    </div>
  )
}
