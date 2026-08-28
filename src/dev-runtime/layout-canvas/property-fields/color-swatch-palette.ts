// Fixed catalog of the editor's six semantic color names (T2, 0134, FR3/FR4). Deliberately
// declared independently of `runtime-config-zod.ts` and of every `src/runtime/` styling module
// (spec risk 2): this is the editor's own swatch palette, not a re-export of the runtime's color
// contract, even though the six names happen to coincide with `supportedStatColors` /
// `supportedBadgeColors` / `supportedAlertTypes` today. The order is fixed and is what
// `ColorSwatchPropertyField` renders, regardless of the field's actual `enum` order or length.
export const COLOR_SWATCH_NAMES = ['neutral', 'primary', 'success', 'warning', 'danger', 'info'] as const

export type ColorSwatchName = (typeof COLOR_SWATCH_NAMES)[number]

// One solid Tailwind background utility per swatch name, used for the swatch itself (a small
// filled circle) rather than any border/outline treatment.
export const COLOR_SWATCH_CLASS_BY_NAME: Record<ColorSwatchName, string> = {
  neutral: 'bg-gray-500',
  primary: 'bg-blue-500',
  success: 'bg-green-500',
  warning: 'bg-amber-500',
  danger: 'bg-red-500',
  info: 'bg-sky-500',
}
