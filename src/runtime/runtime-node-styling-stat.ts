import type { ButtonColor } from '../config/runtime-config'

const statAccentBorderClassMap: Record<ButtonColor, string> = {
  neutral: 'border-neutral-400',
  primary: 'border-primary-500',
  success: 'border-success-500',
  warning: 'border-warning-500',
  danger: 'border-danger-500',
  info: 'border-info-500',
}

const statAccentIconClassMap: Record<ButtonColor, string> = {
  neutral: 'text-neutral-400',
  primary: 'text-primary-500',
  success: 'text-success-500',
  warning: 'text-warning-500',
  danger: 'text-danger-500',
  info: 'text-info-500',
}

const statTintedBgClassMap: Record<ButtonColor, string> = {
  neutral: 'bg-neutral-100',
  primary: 'bg-primary-100',
  success: 'bg-success-100',
  warning: 'bg-warning-100',
  danger: 'bg-danger-100',
  info: 'bg-info-100',
}

const statTintedIconClassMap: Record<ButtonColor, string> = {
  neutral: 'text-neutral-600',
  primary: 'text-primary-600',
  success: 'text-success-600',
  warning: 'text-warning-600',
  danger: 'text-danger-600',
  info: 'text-info-600',
}

const statTintedLabelClassMap: Record<ButtonColor, string> = {
  neutral: 'text-neutral-700',
  primary: 'text-primary-700',
  success: 'text-success-700',
  warning: 'text-warning-700',
  danger: 'text-danger-700',
  info: 'text-info-700',
}

const statTintedValueClassMap: Record<ButtonColor, string> = {
  neutral: 'text-neutral-800',
  primary: 'text-primary-800',
  success: 'text-success-800',
  warning: 'text-warning-800',
  danger: 'text-danger-800',
  info: 'text-info-800',
}

export function getStatAccentRootClassName(color: ButtonColor): string {
  return `border-l-4 pl-4 py-2 ${statAccentBorderClassMap[color]}`
}

export function getStatAccentIconClassName(color: ButtonColor): string {
  return `size-8 shrink-0 ${statAccentIconClassMap[color]}`
}

export function getStatAccentLabelClassName(): string {
  return 'text-sm font-medium text-app-text-muted'
}

export function getStatAccentValueClassName(): string {
  return 'text-2xl font-semibold text-app-text-strong'
}

export function getStatTintedRootClassName(color: ButtonColor): string {
  return `rounded-lg p-4 ${statTintedBgClassMap[color]}`
}

export function getStatTintedIconClassName(color: ButtonColor): string {
  return `size-8 shrink-0 ${statTintedIconClassMap[color]}`
}

export function getStatTintedLabelClassName(color: ButtonColor): string {
  return `text-sm font-medium ${statTintedLabelClassMap[color]}`
}

export function getStatTintedValueClassName(color: ButtonColor): string {
  return `text-2xl font-semibold ${statTintedValueClassMap[color]}`
}

// Stat plain: color-agnostic, no lateral border, no colored background.
// `props.color` is accepted by the config but has no visual effect on this variant.

export function getStatPlainRootClassName(): string {
  return 'py-2'
}

export function getStatPlainIconClassName(): string {
  return 'size-8 shrink-0 text-app-text-muted'
}

export function getStatPlainLabelClassName(): string {
  return 'text-sm font-medium text-app-text-muted'
}

export function getStatPlainValueClassName(): string {
  return 'text-2xl font-semibold text-app-text-strong'
}
