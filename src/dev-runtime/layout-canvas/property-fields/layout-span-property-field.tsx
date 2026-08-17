import { useId } from 'react'
import type { RuntimeResponsiveBoundedValue, RuntimeResponsiveBreakpoint, RuntimeResponsiveLayoutValue } from '../../../config/runtime-config'
import { normalizeResponsiveLayoutValue, responsiveBreakpoints } from '../../../runtime/runtime-node-styling-base'
import { CommitRejectionBanner } from '../../commit-rejection-banner'
import { useLayoutSpanWidgetContext } from './layout-span-widget-context'

// `spanValue` is either the responsive map itself, a plain integer (no explicit per-breakpoint
// key), or `undefined` (no span declared at all). Only the map case has explicit keys — this
// normalizes the other two to "no explicit keys" without touching the mobile-first cascade
// itself, which stays exclusively `normalizeResponsiveLayoutValue`'s job.
function explicitSpanMap(spanValue: RuntimeResponsiveLayoutValue | undefined): RuntimeResponsiveBoundedValue {
  return typeof spanValue === 'object' && spanValue !== null ? spanValue : {}
}

// The single write-path rule for every row edit (T3 spec): editing `breakpoint` merges
// `{ ...currentSpanMap, [breakpoint]: nextValue }` — except when `spanValue` is still a plain
// integer, which has no map to merge into yet. Converting it seeds `base` with that integer
// first (so the previously-uniform span survives at `base`), unless the edited row *is* `base`
// itself, in which case there is nothing to preserve.
function computeNextSpanOnEdit(
  spanValue: RuntimeResponsiveLayoutValue | undefined,
  breakpoint: RuntimeResponsiveBreakpoint,
  nextValue: number,
): RuntimeResponsiveLayoutValue {
  if (typeof spanValue === 'number') {
    return breakpoint === 'base' ? { base: nextValue } : { base: spanValue, [breakpoint]: nextValue }
  }
  return { ...explicitSpanMap(spanValue), [breakpoint]: nextValue }
}

// "Quitar" only ever targets an explicit map key (the button doesn't render otherwise). Dropping
// the last remaining key commits `undefined` rather than `{}`, so a fully-cleared span degrades
// to "no span at all" instead of leaving a dangling empty object in the config (T3 spec
// regression note).
function computeNextSpanOnRemove(
  spanValue: RuntimeResponsiveLayoutValue | undefined,
  breakpoint: RuntimeResponsiveBreakpoint,
): RuntimeResponsiveLayoutValue | undefined {
  const { [breakpoint]: _removed, ...rest } = explicitSpanMap(spanValue)
  return Object.keys(rest).length === 0 ? undefined : rest
}

/**
 * Full `layout.span` widget (T3, 0127), replacing T2's wiring-only stub. Six fixed rows — one per
 * `RuntimeResponsiveBreakpoint` — each editable independently, with "Quitar" for rows that carry
 * an explicit value and a muted/inherited display for the rest. Reads everything from
 * `LayoutSpanWidgetContext` (`parentColumns`/`spanValue`/`commitSpan`/`rowRejections`/
 * `onRowCommitResult`) rather than the `value`/`onChange` the dispatcher's `x-widget` hook passes
 * down — see the context module's doc comment for why `commitSpan` must stay the widget's only
 * write channel.
 *
 * T6 (0133): per-row commit-rejection feedback (`rowRejections`/`onRowCommitResult`) is hosted by
 * `LayoutCanvasPropertiesPanel`, not kept in local state here, so it survives a tab change within
 * the same node (FR7) — see the context module's doc comment for why.
 *
 * The mobile-first cascade itself is never reimplemented here: both the "/ N" denominator (from
 * `parentColumns`) and each row's inherited value (from `spanValue`) go through
 * `normalizeResponsiveLayoutValue`, the same helper the runtime uses to resolve grid spans.
 */
export function LayoutSpanPropertyField() {
  const { parentColumns, spanValue, commitSpan, rowRejections, onRowCommitResult } = useLayoutSpanWidgetContext()
  const inputIdPrefix = useId()

  const denominators = normalizeResponsiveLayoutValue(parentColumns, 1)
  const effectiveSpans = normalizeResponsiveLayoutValue(spanValue ?? {}, 1)
  const explicitKeys = explicitSpanMap(spanValue)

  function handleRowChange(breakpoint: RuntimeResponsiveBreakpoint, rawValue: string) {
    const nextValue = Number(rawValue)
    const result = commitSpan(computeNextSpanOnEdit(spanValue, breakpoint, nextValue))
    onRowCommitResult(breakpoint, nextValue, result)
  }

  function handleRowRemove(breakpoint: RuntimeResponsiveBreakpoint) {
    const result = commitSpan(computeNextSpanOnRemove(spanValue, breakpoint))
    onRowCommitResult(breakpoint, effectiveSpans[breakpoint], result)
  }

  return (
    <fieldset data-testid="layout-span-widget" className="flex flex-col gap-2 rounded border border-gray-200 p-2">
      <legend className="px-1 text-xs font-medium text-gray-700">Columnas</legend>
      {responsiveBreakpoints.map((breakpoint) => {
        const explicit = breakpoint in explicitKeys
        const rejection = rowRejections[breakpoint]
        const displayedValue = rejection ? rejection.value : effectiveSpans[breakpoint]
        const inputId = `${inputIdPrefix}-${breakpoint}`

        return (
          <div
            key={breakpoint}
            data-testid={`layout-span-widget-row-${breakpoint}`}
            data-explicit={explicit}
            className="flex flex-col gap-1"
          >
            <div className="flex items-center gap-2">
              <label
                htmlFor={inputId}
                className={explicit ? 'w-9 shrink-0 text-xs font-medium text-gray-900' : 'w-9 shrink-0 text-xs text-gray-400'}
              >
                {breakpoint}
              </label>
              <input
                id={inputId}
                type="number"
                value={displayedValue}
                onChange={(event) => handleRowChange(breakpoint, event.target.value)}
                className={
                  explicit
                    ? 'w-16 rounded border border-gray-300 px-2 py-1 text-sm text-gray-900 focus:border-gray-500 focus:outline-none'
                    : 'w-16 rounded border border-gray-300 px-2 py-1 text-sm text-gray-400 focus:border-gray-500 focus:outline-none'
                }
              />
              <span className="text-xs text-gray-500">/ {denominators[breakpoint]}</span>
              {explicit && (
                <button
                  type="button"
                  onClick={() => handleRowRemove(breakpoint)}
                  aria-label={`Quitar ${breakpoint}`}
                  className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100"
                >
                  Quitar
                </button>
              )}
            </div>
            {rejection && (
              <CommitRejectionBanner dataTestId={`layout-span-widget-${breakpoint}-error`} error={rejection.error} />
            )}
          </div>
        )
      })}
    </fieldset>
  )
}
