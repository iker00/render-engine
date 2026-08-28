import type { ReactNode } from 'react'

interface PropertyFieldRowProps {
  htmlFor: string
  label: string
  required?: boolean
  // T7 (0133): 'top' aligns the label with the first line of a multi-line control (the
  // `RawJsonPropertyField` textarea); every other simple control is single-line and stays
  // vertically centered ('center', the default).
  align?: 'center' | 'top'
  children: ReactNode
}

/**
 * Shared label-left / control-right row used by the panel's simple controls (T7, FR8, criterion
 * 12): `TextPropertyField`, `NumberPropertyField`, `EnumPropertyField`, `BooleanPropertyField` and
 * `RawJsonPropertyField`. The label takes roughly a third of the row width with a pixel floor so
 * it doesn't collapse on a narrow tab (`w-1/3 min-w-24 shrink-0`); the control fills the rest
 * without ever forcing the row wider than its container (`flex-1 min-w-0`), which is what keeps
 * the panel free of horizontal scroll for these controls.
 *
 * Dedicated widgets (`layout-span`, `choice-items`, icon picker, segmented, condition/group,
 * key-value) render their own layout and never use this wrapper — out of scope for T7.
 */
export function PropertyFieldRow({ htmlFor, label, required = false, align = 'center', children }: PropertyFieldRowProps) {
  return (
    <div className={`flex gap-2 ${align === 'top' ? 'items-start' : 'items-center'}`}>
      <label htmlFor={htmlFor} className="w-1/3 min-w-24 shrink-0 text-xs font-medium text-gray-700">
        {label}
        {required && (
          <span aria-hidden="true" className="ml-0.5 text-red-500">
            *
          </span>
        )}
      </label>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}
