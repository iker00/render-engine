import type { ButtonColor } from '../config/runtime-config'

const badgePillBgClassMap: Record<ButtonColor, string> = {
  neutral: 'bg-neutral-100',
  primary: 'bg-primary-100',
  success: 'bg-success-100',
  warning: 'bg-warning-100',
  danger: 'bg-danger-100',
  info: 'bg-info-100',
}

const badgePillTextClassMap: Record<ButtonColor, string> = {
  neutral: 'text-neutral-700',
  primary: 'text-primary-700',
  success: 'text-success-700',
  warning: 'text-warning-700',
  danger: 'text-danger-700',
  info: 'text-info-700',
}

const badgeCircleDotClassMap: Record<ButtonColor, string> = {
  neutral: 'bg-neutral-500',
  primary: 'bg-primary-500',
  success: 'bg-success-500',
  warning: 'bg-warning-500',
  danger: 'bg-danger-500',
  info: 'bg-info-500',
}

export function getBadgePillClassName(color: ButtonColor): string {
  return `inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${badgePillBgClassMap[color]} ${badgePillTextClassMap[color]}`
}

export function getBadgeCircleDotClassName(color: ButtonColor): string {
  return `inline-block h-2 w-2 rounded-full ${badgeCircleDotClassMap[color]}`
}

export function getBadgeCircleLabelClassName(): string {
  return 'text-sm'
}
