import type { KeyboardEvent } from 'react'
import { useRef } from 'react'
import type { LucideIcon } from 'lucide-react'

export interface SegmentedToggleOption {
  value: string | number
  label: string
  icon?: LucideIcon
}

interface SegmentedTogglePropertyFieldProps {
  label: string
  segments: ReadonlyArray<SegmentedToggleOption>
  // `null` represents "no segment active" (e.g. `heading.props.level` outside `1..5`, T3). The
  // component never infers an active segment on its own — `activeValue` is the only source of
  // truth for which segment (if any) is marked checked.
  activeValue: string | number | null
  onSelect: (value: string | number) => void
}

/**
 * Presentational pill control shared by the toggle widgets of this feature (T2/T3/T5): one
 * segment per option, active segment visually distinguished. Implements the ARIA `radiogroup`/
 * `radio` pattern (as opposed to `tablist`/`tab`) so all three consumers share the same semantics.
 *
 * `onSelect` fires only when the user picks a segment different from `activeValue` — same
 * idempotency rule as `LinkContentModePropertyField`: reselecting the already-active segment is a
 * no-op. The component owns no selection state of its own; it renders whatever `activeValue` says.
 *
 * Keyboard: `ArrowRight`/`ArrowLeft` move focus to the adjacent segment and immediately call
 * `onSelect` for it (native `radiogroup` auto-select behavior), wrapping at both edges. `Enter`/
 * `Space` on a focused segment are handled by the underlying `<button>` natively (no extra
 * wiring needed). Roving tabindex: only the active segment (or the first one, when
 * `activeValue` is `null`) is a `Tab` stop, so `Tab` enters and leaves the group in one step.
 */
export function SegmentedTogglePropertyField({ label, segments, activeValue, onSelect }: SegmentedTogglePropertyFieldProps) {
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([])

  function selectSegment(value: string | number) {
    if (value === activeValue) return
    onSelect(value)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return
    event.preventDefault()

    const direction = event.key === 'ArrowRight' ? 1 : -1
    const nextIndex = (index + direction + segments.length) % segments.length

    buttonRefs.current[nextIndex]?.focus()
    selectSegment(segments[nextIndex].value)
  }

  const activeIndex = segments.findIndex((segment) => segment.value === activeValue)
  const tabbableIndex = activeIndex === -1 ? 0 : activeIndex

  return (
    <div role="radiogroup" aria-label={label} className="w-full inline-flex items-center gap-0.5 rounded-full border border-gray-300 bg-white p-0.5">
      {segments.map((segment, index) => {
        const isActive = segment.value === activeValue
        const Icon = segment.icon

        return (
          <button
            key={String(segment.value)}
            ref={(node) => {
              buttonRefs.current[index] = node
            }}
            type="button"
            role="radio"
            aria-checked={isActive}
            tabIndex={index === tabbableIndex ? 0 : -1}
            onClick={() => selectSegment(segment.value)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={
              isActive
                ? 'flex-1 flex justify-center items-center gap-1 rounded-full bg-gray-800 px-3 py-1 text-xs font-medium text-white'
                : 'flex-1 flex justify-center items-center gap-1 rounded-full px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100'
            }
          >
            {Icon && <Icon aria-hidden="true" className="h-3.5 w-3.5" />}
            {segment.label}
          </button>
        )
      })}
    </div>
  )
}
