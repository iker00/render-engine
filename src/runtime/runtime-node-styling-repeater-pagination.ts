import type { RuntimeResponsiveLayoutValue } from '../config/runtime-config'
import { getGridChildSpanClassName } from './runtime-node-styling-base'

export function getRepeaterPaginationControlsClassName(parentGridColumns?: RuntimeResponsiveLayoutValue | null) {
  const classNames = ['flex', 'w-full', 'flex-wrap', 'items-center', 'justify-center', 'gap-3', 'pt-2']
  const spanClassName = parentGridColumns === null ? null : getGridChildSpanClassName(parentGridColumns, parentGridColumns)

  if (spanClassName) {
    classNames.unshift(spanClassName)
  }

  return classNames.join(' ')
}

export function getRepeaterPaginationButtonClassName() {
  return [
    'inline-flex',
    'items-center',
    'justify-center',
    'rounded-control',
    'border',
    'border-app-border-strong',
    'bg-white',
    'px-3',
    'py-1.5',
    'text-sm',
    'font-semibold',
    'leading-5',
    'text-app-text-strong',
    'transition-colors',
    'cursor-pointer',
    'hover:bg-app-surface-subtle',
    'disabled:cursor-not-allowed',
    'disabled:border-app-border-soft',
    'disabled:text-app-text-muted',
    'disabled:hover:bg-white',
    'focus-visible:outline',
    'focus-visible:outline-2',
    'focus-visible:outline-offset-2',
    'focus-visible:outline-app-accent',
  ].join(' ')
}

export function getRepeaterPaginationCurrentButtonClassName() {
  return getRepeaterPaginationButtonClassName()
    .replace('border-app-border-strong', 'border-app-accent')
    .replace('bg-white', 'bg-app-accent')
    .replace('text-app-text-strong', 'text-white')
    .replace('hover:bg-app-surface-subtle', 'hover:bg-app-accent-strong')
}
