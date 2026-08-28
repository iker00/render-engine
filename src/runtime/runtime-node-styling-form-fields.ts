import type { ChoiceGroupOptionLayout } from '../config/runtime-config'

export function getFormNodeClassName() {
  return 'grid w-full gap-5 sm:gap-6'
}

export function getFieldWrapperClassName() {
  return 'grid gap-2'
}

export function getFieldLabelClassName() {
  return 'text-sm font-medium leading-5 text-app-text-strong'
}

export function getFieldControlClassName(hasError = false) {
  return [
    'w-full',
    'rounded-control',
    'border',
    hasError ? 'border-app-danger' : 'border-app-border-soft',
    'bg-white',
    'px-3',
    'py-2',
    'text-sm',
    'leading-5',
    'text-app-text',
    'placeholder:text-app-text-muted',
    'focus-visible:outline-none',
    'focus-visible:ring-2',
    hasError ? 'focus-visible:border-app-danger' : 'focus-visible:border-app-accent',
    hasError ? 'focus-visible:ring-app-danger' : 'focus-visible:ring-app-accent',
  ].join(' ')
}

export function getFieldErrorClassName() {
  return 'text-sm font-medium text-app-danger'
}

export function getChoiceGroupClassName(optionLayout: ChoiceGroupOptionLayout = 'vertical') {
  if (optionLayout === 'inline') {
    return 'flex flex-wrap gap-x-4 gap-y-2.5'
  }

  return 'grid gap-2.5'
}

export function getChoiceOptionClassName(optionLayout: ChoiceGroupOptionLayout = 'vertical') {
  return optionLayout === 'inline'
    ? 'flex max-w-full items-start gap-2.5 text-sm leading-5 text-app-text'
    : 'flex items-start gap-2.5 text-sm leading-5 text-app-text'
}
