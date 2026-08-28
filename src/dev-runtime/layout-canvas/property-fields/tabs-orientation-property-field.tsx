import { LayoutPanelLeft, LayoutPanelTop } from 'lucide-react'
import type { SegmentedToggleOption } from './segmented-toggle-property-field'
import { SegmentedTogglePropertyField } from './segmented-toggle-property-field'

type TabsOrientation = 'horizontal' | 'vertical'

// Fixed two orientations of `tabs.props.orientation` (T2, 0128).
const SEGMENTS: ReadonlyArray<SegmentedToggleOption> = [
  { value: 'horizontal', label: 'Horizontal', icon: LayoutPanelTop },
  { value: 'vertical', label: 'Vertical', icon: LayoutPanelLeft },
]

// `undefined` is the runtime's implicit default for `tabs.props.orientation` (equivalent to
// `"horizontal"`, spec criterio 10), so it resolves to the "Horizontal" segment being active
// rather than "no segment active". Any other value the schema wouldn't normally allow through
// degrades silently to `null`.
function resolveActiveValue(value: unknown): TabsOrientation | null {
  if (value === undefined) return 'horizontal'
  if (value === 'horizontal' || value === 'vertical') return value
  return null
}

export interface TabsOrientationPropertyFieldProps {
  label: string
  value: unknown
  onChange: (value: unknown) => void
}

/**
 * `x-widget: 'tabs-orientation'` (T2, 0128): thin wrapper around `SegmentedTogglePropertyField`
 * for `tabs.props.orientation`. Uses its own human legend ("Orientación") instead of the schema's
 * technical field name (`orientation`) forwarded by the dispatcher as `label`.
 */
export function TabsOrientationPropertyField({ value, onChange }: TabsOrientationPropertyFieldProps) {
  return (
    <SegmentedTogglePropertyField
      label="Orientación"
      segments={SEGMENTS}
      activeValue={resolveActiveValue(value)}
      onSelect={(nextOrientation) => onChange(nextOrientation)}
    />
  )
}
