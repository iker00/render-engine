import type { StepsVariant } from '../config/runtime-config'

export function getStepsRootClassName(variant: StepsVariant) {
  return variant === 'vertical' ? 'flex flex-row gap-5' : 'flex flex-col gap-5'
}

export function getStepsIndicatorClassName(variant: StepsVariant) {
  if (variant === 'vertical') {
    return 'flex flex-col w-48 shrink-0 gap-1'
  }

  if (variant === 'progress') {
    return 'flex flex-row items-center text-sm font-medium text-app-text-muted'
  }

  return 'flex flex-row items-center overflow-x-auto scrollbar-hide gap-1'
}

export function getStepsMarkerClassName(status: 'active' | 'visited' | 'upcoming', variant: StepsVariant) {
  const spacingClass = variant === 'vertical' ? 'mr-2' : 'mr-1.5'
  const baseClasses = [
    'inline-flex',
    'items-center',
    'justify-center',
    'w-6',
    'h-6',
    'shrink-0',
    'rounded-full',
    'text-xs',
    'font-semibold',
    'border',
    spacingClass,
  ]

  if (status === 'upcoming') {
    return [...baseClasses, 'bg-neutral-100', 'text-neutral-600', 'border-neutral-300'].join(' ')
  }

  return [...baseClasses, 'bg-primary-600', 'text-white', 'border-primary-600'].join(' ')
}

export function getStepsPanelClassName() {
  return 'flex-1 border border-app-border-soft p-4 flex flex-col gap-5'
}

/**
 * Styles the whole clickable step item (marker + label) in `horizontal`/`vertical` variants,
 * adapting the "connected tab" technique already used by `getTabsButtonClassName`: the active
 * step fuses its border with `getStepsPanelClassName()`'s perimeter (bottom border in
 * `horizontal`, right border in `vertical`). `progress` never renders per-step items, so it has
 * no counterpart here.
 */
export function getStepsItemWrapperClassName(isActive: boolean, variant: 'horizontal' | 'vertical') {
  const orientationClasses = variant === 'vertical' ? 'text-left w-full' : 'shrink-0 whitespace-nowrap'
  const baseClasses = [
    'inline-flex',
    'items-center',
    'px-3',
    'py-1.5',
    'transition-colors',
    orientationClasses,
  ]

  if (!isActive) {
    return [
      ...baseClasses,
      'text-app-text-muted',
      'font-medium',
      'cursor-pointer',
      'disabled:cursor-not-allowed',
      'disabled:opacity-60',
    ].join(' ')
  }

  const borderClasses =
    variant === 'vertical'
      ? ['border-t', 'border-l', 'border-b', 'border-app-border-soft']
      : ['border-t', 'border-l', 'border-r', 'border-app-border-soft']
  const overlapClass = variant === 'vertical' ? '-mr-px' : '-mb-px'

  return [
    ...baseClasses,
    ...borderClasses,
    overlapClass,
    'relative',
    'z-10',
    'bg-app-background',
    'text-primary-700',
    'font-semibold',
    'cursor-pointer',
  ].join(' ')
}
