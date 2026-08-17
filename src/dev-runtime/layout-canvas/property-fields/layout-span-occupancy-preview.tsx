import type { RuntimeResponsiveBreakpoint } from '../../../config/runtime-config'

interface LayoutSpanOccupancyPreviewProps {
  breakpoint: RuntimeResponsiveBreakpoint
  span: number
  denominator: number
}

/**
 * Presentational-only occupancy bar for `layout.span` (T5, 0134, FR7). Renders `denominator`
 * horizontal segments with the first `min(span, denominator)` of them highlighted — clamped so an
 * out-of-range resolved span (`span > denominator`) never overflows the bar with an extra segment.
 * The legend always shows the real resolved `span`, unclamped: only the painted segment count is
 * clamped, not the number reported to the user.
 *
 * Purely visual, no local state of its own: `LayoutSpanPropertyField` owns which breakpoint is
 * being previewed (focus-driven) and passes the already-resolved `span`/`denominator` down.
 */
export function LayoutSpanOccupancyPreview({ breakpoint, span, denominator }: LayoutSpanOccupancyPreviewProps) {
  const highlightedCount = Math.min(Math.max(span, 0), denominator)
  const segments = Array.from({ length: denominator }, (_, index) => index < highlightedCount)

  return (
    <div data-testid="layout-span-occupancy-preview" className="flex flex-col gap-1.5 pt-1">
      <div className="flex gap-1" aria-hidden="true">
        {segments.map((highlighted, index) => (
          <span
            key={index}
            data-testid="layout-span-occupancy-preview-segment"
            data-highlighted={highlighted}
            className={highlighted ? 'h-2 flex-1 rounded-sm bg-gray-700' : 'h-2 flex-1 rounded-sm bg-gray-200'}
          />
        ))}
      </div>
      <p className="text-xs text-gray-500">
        {`Vista previa en ${breakpoint}: ocupa ${span} de ${denominator}.`}
      </p>
    </div>
  )
}
