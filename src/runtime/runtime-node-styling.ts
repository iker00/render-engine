import type { CSSProperties } from 'react'

const containerGapClassMap: Record<string, string> = {
  sm: 'gap-3',
  md: 'gap-5',
  lg: 'gap-8',
}

const headingSizeClassMap: Record<number, string> = {
  1: 'text-4xl sm:text-5xl',
  2: 'text-3xl sm:text-4xl',
  3: 'text-2xl sm:text-3xl',
  4: 'text-xl sm:text-2xl',
  5: 'text-lg sm:text-xl',
  6: 'text-base sm:text-lg',
}

interface ContainerNodeStylingOptions {
  direction?: string
  gap?: string
  surface?: 'plain' | 'form-section'
}

interface ContainerNodeStyling {
  className: string
  style?: CSSProperties
}

type ContainerGapStyle = CSSProperties & {
  '--runtime-container-gap': string
}

export function getAppShellClassName() {
  return 'min-h-screen bg-app-background text-app-text'
}

export function getAppShellContentClassName() {
  return 'mx-auto flex w-full max-w-shell px-4 py-10 sm:px-6 sm:py-12 lg:px-8 lg:py-16'
}

export function getAppShellFrameClassName() {
  return 'w-full rounded-shell border border-app-border-strong bg-app-surface p-5 shadow-shell sm:p-8 lg:p-10'
}

export function getAppShellErrorEyebrowClassName() {
  return 'text-xs font-semibold uppercase tracking-[0.24em] text-app-accent'
}

export function getAppShellErrorTitleClassName() {
  return 'm-0 text-3xl font-semibold leading-tight tracking-[-0.02em] text-app-text-strong sm:text-4xl'
}

export function getAppShellErrorBodyClassName() {
  return 'max-w-2xl text-base leading-7 text-app-text-muted sm:text-lg sm:leading-8'
}

export function getRuntimePageClassName() {
  return 'grid gap-6 lg:gap-8'
}

export function getContainerNodeStyling({ direction, gap, surface }: ContainerNodeStylingOptions): ContainerNodeStyling {
  const classNames = [
    'flex',
    'w-full',
    direction === 'row' ? 'flex-row' : 'flex-col',
  ]
  const surfaceClassNames =
    surface === 'form-section'
      ? [
          '-mx-5',
          'border-t',
          'border-app-border-soft',
          'px-5',
          'py-6',
          'sm:-mx-6',
          'sm:px-6',
          'sm:py-7',
        ]
      : []

  if (!gap) {
    return {
      className: [...classNames, ...surfaceClassNames].join(' '),
    }
  }

  const mappedGapClassName = containerGapClassMap[gap]

  if (mappedGapClassName) {
    return {
      className: [...classNames, ...surfaceClassNames, mappedGapClassName].join(' '),
    }
  }

  return {
    className: [...classNames, ...surfaceClassNames, 'gap-[var(--runtime-container-gap)]'].join(' '),
    style: {
      '--runtime-container-gap': gap,
    } satisfies ContainerGapStyle,
  }
}

export function getHeadingTag(level: number) {
  if (level <= 1) {
    return 'h1'
  }

  if (level === 2) {
    return 'h2'
  }

  if (level === 3) {
    return 'h3'
  }

  if (level === 4) {
    return 'h4'
  }

  if (level === 5) {
    return 'h5'
  }

  return 'h6'
}

export function getHeadingNodeClassName(level: number) {
  return [
    'm-0',
    ...(headingSizeClassMap[level] ?? headingSizeClassMap[6]).split(' '),
    'font-semibold',
    'leading-tight',
    'tracking-[-0.03em]',
    'text-app-text-strong',
  ].join(' ')
}

export function getParagraphNodeClassName() {
  return 'm-0 max-w-3xl text-base leading-7 text-app-text-muted sm:text-lg sm:leading-8'
}

export function getListNodeClassName() {
  return 'm-0 grid list-disc gap-3 pl-5 text-app-text marker:text-app-accent'
}

export function getListItemClassName() {
  return 'leading-7'
}

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
    'px-4',
    'py-3',
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
    'px-4',
    'py-3',
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

export function getFormNodeClassName() {
  return 'grid w-full gap-6 sm:gap-8'
}

export function getFieldWrapperClassName() {
  return 'grid gap-2.5'
}

export function getFieldLabelClassName() {
  return 'text-sm font-semibold text-app-text-strong'
}

export function getFieldControlClassName(hasError = false) {
  return [
    'w-full',
    'rounded-control',
    'border',
    hasError ? 'border-app-danger' : 'border-app-border-soft',
    'bg-white',
    'px-4',
    'py-3',
    'text-sm',
    'leading-6',
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

export function getChoiceGroupClassName() {
  return 'grid gap-3'
}

export function getChoiceOptionClassName() {
  return 'flex items-start gap-3 text-sm leading-6 text-app-text'
}
