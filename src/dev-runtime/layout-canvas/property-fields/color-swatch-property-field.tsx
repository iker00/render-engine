import { useId, useRef, type KeyboardEvent } from 'react'
import { PropertyFieldRow } from './property-field-row'
import { COLOR_SWATCH_CLASS_BY_NAME, COLOR_SWATCH_NAMES, type ColorSwatchName } from './color-swatch-palette'

export interface ColorSwatchPropertyFieldProps {
  label: string
  value: unknown
  onChange: (value: unknown) => void
}

// `value` only counts as "active" when it's literally one of the six fixed names — anything else
// (a color outside the catalog, typed by hand in Monaco, or no value at all) resolves to `null`
// ("no swatch active"), same convention `SegmentedTogglePropertyField`'s consumers use for an
// out-of-range value.
function resolveActiveValue(value: unknown): ColorSwatchName | null {
  return typeof value === 'string' && (COLOR_SWATCH_NAMES as readonly string[]).includes(value)
    ? (value as ColorSwatchName)
    : null
}

/**
 * `x-widget: 'color-swatch'` (T2, 0134, FR3/FR4): fixed row of the six semantic color swatches for
 * any `props.color` field whose schema declares an `enum` — regardless of that enum's actual
 * option count. Always renders `COLOR_SWATCH_NAMES` in that fixed order; never derived from the
 * field's own `enum` values (the dispatcher's `x-widget` hook already stripped them away by the
 * time this component sees the schema).
 *
 * Wrapped in `PropertyFieldRow` like `SegmentedEnumPropertyField` (T1, 0134,
 * property-field-dispatcher.tsx): visible label on the left, `useId()` only to satisfy
 * `PropertyFieldRow`'s required `htmlFor` — the row has no single focusable element of its own,
 * same accepted limitation as T1.
 *
 * Keyboard/roving-tabindex logic mirrors `SegmentedTogglePropertyField` (ArrowRight/ArrowLeft with
 * circular wrap, only the active — or first, when none is active — swatch is a `Tab` stop), but
 * renders its own markup rather than delegating to it: each swatch paints a solid color instead of
 * an icon+text pill.
 */
export function ColorSwatchPropertyField({ label, value, onChange }: ColorSwatchPropertyFieldProps) {
  const rowId = useId()
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([])
  const activeValue = resolveActiveValue(value)

  function selectSwatch(name: ColorSwatchName) {
    if (name === activeValue) return
    onChange(name)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return
    event.preventDefault()

    const direction = event.key === 'ArrowRight' ? 1 : -1
    const nextIndex = (index + direction + COLOR_SWATCH_NAMES.length) % COLOR_SWATCH_NAMES.length

    buttonRefs.current[nextIndex]?.focus()
    selectSwatch(COLOR_SWATCH_NAMES[nextIndex])
  }

  const activeIndex = activeValue ? COLOR_SWATCH_NAMES.indexOf(activeValue) : -1
  const tabbableIndex = activeIndex === -1 ? 0 : activeIndex

  return (
    <PropertyFieldRow htmlFor={rowId} label={label}>
      <div className="flex items-center gap-2">
        <div role="radiogroup" aria-label={label} className="inline-flex items-center gap-1.5">
          {COLOR_SWATCH_NAMES.map((name, index) => {
            const isActive = name === activeValue
            return (
              <button
                key={name}
                ref={(node) => {
                  buttonRefs.current[index] = node
                }}
                type="button"
                role="radio"
                aria-checked={isActive}
                aria-label={name}
                tabIndex={index === tabbableIndex ? 0 : -1}
                onClick={() => selectSwatch(name)}
                onKeyDown={(event) => handleKeyDown(event, index)}
                className={
                  isActive
                    ? `h-5 w-5 rounded-full ring-2 ring-offset-1 ring-gray-800 ${COLOR_SWATCH_CLASS_BY_NAME[name]}`
                    : `h-5 w-5 rounded-full ${COLOR_SWATCH_CLASS_BY_NAME[name]}`
                }
              />
            )
          })}
        </div>
        {activeValue && <span className="text-xs text-gray-600">{activeValue}</span>}
      </div>
    </PropertyFieldRow>
  )
}
