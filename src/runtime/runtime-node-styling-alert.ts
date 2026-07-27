import type { ButtonColor } from '../config/runtime-config'

const alertBgClassMap: Record<ButtonColor, string> = {
  neutral: 'bg-neutral-100',
  primary: 'bg-primary-100',
  success: 'bg-success-100',
  warning: 'bg-warning-100',
  danger: 'bg-danger-100',
  info: 'bg-info-100',
}

const alertTextClassMap: Record<ButtonColor, string> = {
  neutral: 'text-neutral-700',
  primary: 'text-primary-700',
  success: 'text-success-700',
  warning: 'text-warning-700',
  danger: 'text-danger-700',
  info: 'text-info-700',
}

export function getAlertClassName(color: ButtonColor): string {
  return `flex items-start gap-3 rounded-md p-4 ${alertBgClassMap[color]}`
}

export function getAlertTitleClassName(color: ButtonColor): string {
  return `${alertTextClassMap[color]} font-medium`
}

export function getAlertIconClassName(color: ButtonColor): string {
  return `${alertTextClassMap[color]} size-5 shrink-0`
}

export function getAlertBodyClassName(color: ButtonColor): string {
  return `${alertTextClassMap[color]} text-sm`
}
