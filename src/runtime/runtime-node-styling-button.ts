import type { ButtonColor, ButtonVariant } from '../config/runtime-config'

const buttonSolidVariantClassMap: Record<ButtonColor, string> = {
  neutral: 'bg-neutral-500 border-neutral-500 text-white hover:bg-neutral-600 hover:border-neutral-600',
  primary: 'bg-primary-600 border-primary-600 text-white hover:bg-primary-700 hover:border-primary-700',
  success: 'bg-success-600 border-success-600 text-white hover:bg-success-700 hover:border-success-700',
  warning: 'bg-warning-500 border-warning-500 text-white hover:bg-warning-600 hover:border-warning-600',
  danger: 'bg-danger-600 border-danger-600 text-white hover:bg-danger-700 hover:border-danger-700',
  info: 'bg-info-500 border-info-500 text-white hover:bg-info-600 hover:border-info-600',
}

const buttonOutlineVariantClassMap: Record<ButtonColor, string> = {
  neutral: 'bg-transparent border-neutral-400 text-neutral-600 hover:bg-neutral-50',
  primary: 'bg-transparent border-primary-500 text-primary-600 hover:bg-primary-50',
  success: 'bg-transparent border-success-500 text-success-600 hover:bg-success-50',
  warning: 'bg-transparent border-warning-400 text-warning-600 hover:bg-warning-50',
  danger: 'bg-transparent border-danger-500 text-danger-600 hover:bg-danger-50',
  info: 'bg-transparent border-info-500 text-info-600 hover:bg-info-50',
}

const buttonGhostVariantClassMap: Record<ButtonColor, string> = {
  neutral: 'border-transparent bg-transparent text-neutral-600 hover:bg-neutral-100',
  primary: 'border-transparent bg-transparent text-primary-600 hover:bg-primary-100',
  success: 'border-transparent bg-transparent text-success-600 hover:bg-success-100',
  warning: 'border-transparent bg-transparent text-warning-600 hover:bg-warning-100',
  danger: 'border-transparent bg-transparent text-danger-600 hover:bg-danger-100',
  info: 'border-transparent bg-transparent text-info-600 hover:bg-info-100',
}

const buttonLinkVariantClassMap: Record<ButtonColor, string> = {
  neutral: 'border-transparent bg-transparent text-neutral-600 hover:underline underline-offset-2',
  primary: 'border-transparent bg-transparent text-primary-600 hover:underline underline-offset-2',
  success: 'border-transparent bg-transparent text-success-600 hover:underline underline-offset-2',
  warning: 'border-transparent bg-transparent text-warning-600 hover:underline underline-offset-2',
  danger: 'border-transparent bg-transparent text-danger-600 hover:underline underline-offset-2',
  info: 'border-transparent bg-transparent text-info-600 hover:underline underline-offset-2',
}

const buttonVariantClassMaps: Record<Exclude<ButtonVariant, 'switch'>, Record<ButtonColor, string>> = {
  solid: buttonSolidVariantClassMap,
  outline: buttonOutlineVariantClassMap,
  ghost: buttonGhostVariantClassMap,
  link: buttonLinkVariantClassMap,
}

const buttonSwitchTrackBaseClassName =
  'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-accent'

const buttonSwitchCheckedTrackColorClassMap: Record<ButtonColor, string> = {
  neutral: 'bg-neutral-500',
  primary: 'bg-primary-600',
  success: 'bg-success-600',
  warning: 'bg-warning-500',
  danger: 'bg-danger-600',
  info: 'bg-info-500',
}

const buttonSwitchUncheckedTrackColorClassName = 'bg-neutral-200'

const buttonSwitchKnobBaseClassName =
  'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out'

export function getButtonNodeClassName() {
  return getSecondaryButtonNodeClassName()
}

export function getPrimaryButtonNodeClassName() {
  return [
    'inline-flex',
    'items-center',
    'justify-center',
    'self-start',
    'rounded-control',
    'border',
    'border-app-accent',
    'bg-app-accent',
    'px-3.5',
    'py-2',
    'text-sm',
    'font-semibold',
    'leading-5',
    'text-white',
    'transition-colors',
    'hover:bg-app-accent-strong',
    'focus-visible:outline',
    'focus-visible:outline-2',
    'focus-visible:outline-offset-2',
    'focus-visible:outline-app-accent',
  ].join(' ')
}

export function getSecondaryButtonNodeClassName() {
  return [
    'inline-flex',
    'items-center',
    'justify-center',
    'self-start',
    'rounded-control',
    'border',
    'border-app-border-strong',
    'bg-white',
    'px-3.5',
    'py-2',
    'text-sm',
    'font-semibold',
    'leading-5',
    'text-app-text-strong',
    'transition-colors',
    'hover:bg-app-surface-subtle',
    'focus-visible:outline',
    'focus-visible:outline-2',
    'focus-visible:outline-offset-2',
    'focus-visible:outline-app-accent',
  ].join(' ')
}

export function getButtonVariantClassName(
  color: ButtonColor,
  variant: Exclude<ButtonVariant, 'switch'>,
  fullWidth: boolean,
): string {
  const fontWeight = variant === 'solid' ? 'font-semibold' : 'font-medium'
  const baseClasses = [
    'inline-flex',
    'items-center',
    'justify-center',
    'rounded-control',
    'border',
    'px-3.5',
    'py-2',
    'text-sm',
    fontWeight,
    'leading-5',
    'transition-colors',
    'cursor-pointer',
    'focus-visible:outline',
    'focus-visible:outline-2',
    'focus-visible:outline-offset-2',
    'focus-visible:outline-app-accent',
  ]
  const widthClass = fullWidth ? 'w-full' : 'self-start'
  const variantClasses = buttonVariantClassMaps[variant][color]

  return [...baseClasses, widthClass, variantClasses].join(' ')
}

export function getButtonSwitchClassName(
  checked: boolean,
  color: ButtonColor,
): { trackClassName: string; knobClassName: string } {
  const trackColorClassName = checked ? buttonSwitchCheckedTrackColorClassMap[color] : buttonSwitchUncheckedTrackColorClassName

  return {
    trackClassName: `${buttonSwitchTrackBaseClassName} ${trackColorClassName}`,
    knobClassName: `${buttonSwitchKnobBaseClassName} ${checked ? 'translate-x-5' : 'translate-x-0'}`,
  }
}
