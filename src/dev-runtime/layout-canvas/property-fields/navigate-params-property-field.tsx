import { KeyValuePropertyField } from './key-value-property-field'

// Same defensive plain-object/array criterion `resolveUnionBranch`/`ObjectPropertyField` apply in
// `property-field-dispatcher.tsx` (via `isPlainObject`), duplicated locally rather than imported
// so this widget stays a self-contained composition over `KeyValuePropertyField` (T2).
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isStringValue(value: unknown): boolean {
  return typeof value === 'string'
}

export interface NavigateParamsPropertyFieldProps {
  label: string
  value: unknown
  onChange: (value: unknown) => void
}

/**
 * Dedicated widget for `navigateTo.params` (T2, FR3/D5): a `KeyValuePropertyField` whose rows are
 * editable only when their current value is a string — any other shape (number, boolean, null,
 * nested object/array) degrades that single row to the same read-only `RawJsonPropertyField`
 * fallback `KeyValuePropertyField` already uses for nested `body` values, without affecting the
 * rest of `params`.
 *
 * Normalizes an incoming non-plain-object `value` (e.g. `undefined`/`null`/array/string, possible
 * if the config was hand-edited in Monaco) to `{}` before handing it to `KeyValuePropertyField`,
 * so the editor never throws and always starts from an empty, addable map in that case.
 */
export function NavigateParamsPropertyField({ label, value, onChange }: NavigateParamsPropertyFieldProps) {
  const normalizedValue = isPlainObject(value) ? value : {}

  return (
    <KeyValuePropertyField
      label={label}
      value={normalizedValue}
      onChange={onChange}
      isValueEditable={isStringValue}
    />
  )
}
