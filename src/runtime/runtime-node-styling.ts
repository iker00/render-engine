import type { CSSProperties } from 'react'

const containerGapClassMap: Record<string, string> = {
  sm: 'gap-3',
  md: 'gap-5',
  lg: 'gap-8',
  xl: 'gap-10',
  '2xl': 'gap-12',
}

const containerColumnsClassMap: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-4',
  5: 'grid-cols-5',
  6: 'grid-cols-6',
  7: 'grid-cols-7',
  8: 'grid-cols-8',
  9: 'grid-cols-9',
  10: 'grid-cols-10',
  11: 'grid-cols-11',
  12: 'grid-cols-12',
}

const containerAlignClassMap: Record<string, string> = {
  start: 'items-start',
  center: 'items-center',
  end: 'items-end',
  stretch: 'items-stretch',
}

const containerJustifyClassMap: Record<string, string> = {
  start: 'justify-start',
  center: 'justify-center',
  end: 'justify-end',
  between: 'justify-between',
  around: 'justify-around',
  evenly: 'justify-evenly',
}

const containerWrapClassMap: Record<string, string> = {
  nowrap: 'flex-nowrap',
  wrap: 'flex-wrap',
  'wrap-reverse': 'flex-wrap-reverse',
}

const headingSizeClassMap: Record<number, string> = {
  1: 'text-3xl sm:text-4xl',
  2: 'text-2xl sm:text-3xl',
  3: 'text-xl sm:text-2xl',
  4: 'text-lg sm:text-xl',
  5: 'text-base sm:text-lg',
  6: 'text-sm sm:text-base',
}

interface ContainerNodeStylingOptions {
  direction?: string
  gap?: string
  columns?: number
  align?: string
  justify?: string
  wrap?: string
  surface?: 'plain' | 'form-section'
}

interface ContainerNodeStyling {
  className: string
  style?: CSSProperties
}

type ContainerGapStyle = CSSProperties & {
  '--runtime-container-gap': string
}

interface ContainerNodeSurfaceOptions {
  withinForm?: boolean
  direction?: string
  columns?: number
}

export function getAppShellClassName() {
  return 'min-h-screen bg-app-background text-app-text'
}

export function getAppShellContentClassName() {
  return 'mx-auto flex w-full max-w-shell px-4 py-8 sm:px-6 sm:py-10 lg:px-8 lg:py-12'
}

export function getAppShellFrameClassName() {
  return 'w-full rounded-shell border border-app-border-strong bg-app-surface p-4 shadow-shell sm:p-6 lg:p-8'
}

export function getAppShellErrorEyebrowClassName() {
  return 'text-xs font-semibold uppercase tracking-[0.24em] text-app-accent'
}

export function getAppShellErrorTitleClassName() {
  return 'm-0 text-2xl font-semibold leading-tight tracking-[-0.02em] text-app-text-strong sm:text-3xl'
}

export function getAppShellErrorBodyClassName() {
  return 'max-w-2xl text-sm leading-6 text-app-text-muted sm:text-base sm:leading-7'
}

export function getRuntimePageClassName() {
  return 'grid gap-5 lg:gap-6'
}

export function getContainerNodeSurface({
  withinForm,
  direction,
  columns,
}: ContainerNodeSurfaceOptions): 'plain' | 'form-section' {
  if (!withinForm) {
    return 'plain'
  }

  if (typeof columns === 'number') {
    return 'form-section'
  }

  return direction === 'row' ? 'plain' : 'form-section'
}

export function getContainerNodeStyling({
  direction,
  gap,
  columns,
  align,
  justify,
  wrap,
  surface,
}: ContainerNodeStylingOptions): ContainerNodeStyling {
  const isGridLayout = typeof columns === 'number'
  const classNames = isGridLayout
    ? ['grid', 'w-full', containerColumnsClassMap[columns]]
    : ['flex', 'w-full', direction === 'row' ? 'flex-row' : 'flex-col']
  const surfaceClassNames =
    surface === 'form-section'
      ? ['border-t', 'border-app-border-soft', 'pt-5', 'sm:pt-6']
      : []

  if (align) {
    classNames.push(containerAlignClassMap[align])
  }

  if (justify) {
    classNames.push(containerJustifyClassMap[justify])
  }

  if (!isGridLayout) {
    classNames.push(containerWrapClassMap[wrap ?? 'nowrap'])
  }

  const effectiveGap = gap ?? 'md'
  const mappedGapClassName = containerGapClassMap[effectiveGap]

  if (mappedGapClassName) {
    return {
      className: [...classNames, ...surfaceClassNames, mappedGapClassName].join(' '),
    }
  }

  return {
    className: [...classNames, ...surfaceClassNames, 'gap-[var(--runtime-container-gap)]'].join(' '),
    style: {
      '--runtime-container-gap': effectiveGap,
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
  return 'm-0 text-sm leading-6 text-app-text-muted sm:text-base sm:leading-7'
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
    'sm:px-3.5',
    'sm:py-2.5',
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
    'sm:px-3.5',
    'sm:py-2.5',
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
  return 'grid w-full gap-5 sm:gap-6'
}

export function getFieldWrapperClassName() {
  return 'grid gap-2'
}

export function getFieldLabelClassName() {
  return 'text-sm font-semibold leading-5 text-app-text-strong'
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
    'sm:px-3.5',
    'sm:py-2.5',
    'text-sm',
    'leading-6',
    'sm:leading-5',
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
  return 'grid gap-2.5'
}

export function getChoiceOptionClassName() {
  return 'flex items-start gap-2.5 text-sm leading-5 text-app-text'
}
