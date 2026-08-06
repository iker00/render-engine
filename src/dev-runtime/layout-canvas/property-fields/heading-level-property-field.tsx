import type { SegmentedToggleOption } from './segmented-toggle-property-field'
import { SegmentedTogglePropertyField } from './segmented-toggle-property-field'

// Fixed five levels of `heading.props.level` (T2, 0128). No icon — the label alone ("H1"…"H5")
// is unambiguous.
const SEGMENTS: ReadonlyArray<SegmentedToggleOption> = [1, 2, 3, 4, 5].map((level) => ({
  value: level,
  label: `H${level}`,
}))

// `1..5` are the only valid `heading.props.level` values. Anything else — `6`, `undefined`, a
// non-numeric value the schema wouldn't normally allow through — resolves to `null` ("no segment
// active") rather than guessing a fallback level.
function resolveActiveValue(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isInteger(value)) return null
  if (value < 1 || value > 5) return null
  return value
}

export interface HeadingLevelPropertyFieldProps {
  label: string
  value: unknown
  onChange: (value: unknown) => void
}

/**
 * `x-widget: 'heading-level'` (T2, 0128): thin wrapper around `SegmentedTogglePropertyField` for
 * `heading.props.level`. Uses its own human legend ("Nivel") instead of the schema's technical
 * field name (`level`) forwarded by the dispatcher as `label`.
 */
export function HeadingLevelPropertyField({ value, onChange }: HeadingLevelPropertyFieldProps) {
  return (
    <SegmentedTogglePropertyField
      label="Nivel"
      segments={SEGMENTS}
      activeValue={resolveActiveValue(value)}
      onSelect={(nextLevel) => onChange(nextLevel)}
    />
  )
}
