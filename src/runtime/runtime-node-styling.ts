import type { CSSProperties } from 'react'
import type {
  ButtonColor,
  ButtonVariant,
  ChoiceGroupOptionLayout,
  RuntimeResponsiveBreakpoint,
  RuntimeResponsiveLayoutValue,
} from '../config/runtime-config'

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

const responsiveContainerColumnsClassMaps: Record<RuntimeResponsiveBreakpoint, Record<number, string>> = {
  base: containerColumnsClassMap,
  sm: {
    1: 'sm:grid-cols-1',
    2: 'sm:grid-cols-2',
    3: 'sm:grid-cols-3',
    4: 'sm:grid-cols-4',
    5: 'sm:grid-cols-5',
    6: 'sm:grid-cols-6',
    7: 'sm:grid-cols-7',
    8: 'sm:grid-cols-8',
    9: 'sm:grid-cols-9',
    10: 'sm:grid-cols-10',
    11: 'sm:grid-cols-11',
    12: 'sm:grid-cols-12',
  },
  md: {
    1: 'md:grid-cols-1',
    2: 'md:grid-cols-2',
    3: 'md:grid-cols-3',
    4: 'md:grid-cols-4',
    5: 'md:grid-cols-5',
    6: 'md:grid-cols-6',
    7: 'md:grid-cols-7',
    8: 'md:grid-cols-8',
    9: 'md:grid-cols-9',
    10: 'md:grid-cols-10',
    11: 'md:grid-cols-11',
    12: 'md:grid-cols-12',
  },
  lg: {
    1: 'lg:grid-cols-1',
    2: 'lg:grid-cols-2',
    3: 'lg:grid-cols-3',
    4: 'lg:grid-cols-4',
    5: 'lg:grid-cols-5',
    6: 'lg:grid-cols-6',
    7: 'lg:grid-cols-7',
    8: 'lg:grid-cols-8',
    9: 'lg:grid-cols-9',
    10: 'lg:grid-cols-10',
    11: 'lg:grid-cols-11',
    12: 'lg:grid-cols-12',
  },
  xl: {
    1: 'xl:grid-cols-1',
    2: 'xl:grid-cols-2',
    3: 'xl:grid-cols-3',
    4: 'xl:grid-cols-4',
    5: 'xl:grid-cols-5',
    6: 'xl:grid-cols-6',
    7: 'xl:grid-cols-7',
    8: 'xl:grid-cols-8',
    9: 'xl:grid-cols-9',
    10: 'xl:grid-cols-10',
    11: 'xl:grid-cols-11',
    12: 'xl:grid-cols-12',
  },
  '2xl': {
    1: '2xl:grid-cols-1',
    2: '2xl:grid-cols-2',
    3: '2xl:grid-cols-3',
    4: '2xl:grid-cols-4',
    5: '2xl:grid-cols-5',
    6: '2xl:grid-cols-6',
    7: '2xl:grid-cols-7',
    8: '2xl:grid-cols-8',
    9: '2xl:grid-cols-9',
    10: '2xl:grid-cols-10',
    11: '2xl:grid-cols-11',
    12: '2xl:grid-cols-12',
  },
}

const gridChildSpanClassMap: Record<number, string> = {
  1: 'col-span-1',
  2: 'col-span-2',
  3: 'col-span-3',
  4: 'col-span-4',
  5: 'col-span-5',
  6: 'col-span-6',
  7: 'col-span-7',
  8: 'col-span-8',
  9: 'col-span-9',
  10: 'col-span-10',
  11: 'col-span-11',
  12: 'col-span-12',
}

const responsiveGridChildSpanClassMaps: Record<RuntimeResponsiveBreakpoint, Record<number, string>> = {
  base: gridChildSpanClassMap,
  sm: {
    1: 'sm:col-span-1',
    2: 'sm:col-span-2',
    3: 'sm:col-span-3',
    4: 'sm:col-span-4',
    5: 'sm:col-span-5',
    6: 'sm:col-span-6',
    7: 'sm:col-span-7',
    8: 'sm:col-span-8',
    9: 'sm:col-span-9',
    10: 'sm:col-span-10',
    11: 'sm:col-span-11',
    12: 'sm:col-span-12',
  },
  md: {
    1: 'md:col-span-1',
    2: 'md:col-span-2',
    3: 'md:col-span-3',
    4: 'md:col-span-4',
    5: 'md:col-span-5',
    6: 'md:col-span-6',
    7: 'md:col-span-7',
    8: 'md:col-span-8',
    9: 'md:col-span-9',
    10: 'md:col-span-10',
    11: 'md:col-span-11',
    12: 'md:col-span-12',
  },
  lg: {
    1: 'lg:col-span-1',
    2: 'lg:col-span-2',
    3: 'lg:col-span-3',
    4: 'lg:col-span-4',
    5: 'lg:col-span-5',
    6: 'lg:col-span-6',
    7: 'lg:col-span-7',
    8: 'lg:col-span-8',
    9: 'lg:col-span-9',
    10: 'lg:col-span-10',
    11: 'lg:col-span-11',
    12: 'lg:col-span-12',
  },
  xl: {
    1: 'xl:col-span-1',
    2: 'xl:col-span-2',
    3: 'xl:col-span-3',
    4: 'xl:col-span-4',
    5: 'xl:col-span-5',
    6: 'xl:col-span-6',
    7: 'xl:col-span-7',
    8: 'xl:col-span-8',
    9: 'xl:col-span-9',
    10: 'xl:col-span-10',
    11: 'xl:col-span-11',
    12: 'xl:col-span-12',
  },
  '2xl': {
    1: '2xl:col-span-1',
    2: '2xl:col-span-2',
    3: '2xl:col-span-3',
    4: '2xl:col-span-4',
    5: '2xl:col-span-5',
    6: '2xl:col-span-6',
    7: '2xl:col-span-7',
    8: '2xl:col-span-8',
    9: '2xl:col-span-9',
    10: '2xl:col-span-10',
    11: '2xl:col-span-11',
    12: '2xl:col-span-12',
  },
}

const responsiveBreakpoints: RuntimeResponsiveBreakpoint[] = ['base', 'sm', 'md', 'lg', 'xl', '2xl']

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
  1: 'text-lg sm:text-xl',
  2: 'text-base sm:text-lg',
  3: 'text-sm sm:text-base',
  4: 'text-sm sm:text-base',
  5: 'text-xs sm:text-sm',
  6: 'text-xs sm:text-sm',
}

interface ContainerNodeStylingOptions {
  direction?: string
  gap?: string
  columns?: RuntimeResponsiveLayoutValue
  variant?: 'default' | 'card'
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
  columns?: RuntimeResponsiveLayoutValue
}

export type EffectiveResponsiveLayoutValue = Record<RuntimeResponsiveBreakpoint, number>

export function normalizeResponsiveLayoutValue(
  value: RuntimeResponsiveLayoutValue,
  fallback = 1,
): EffectiveResponsiveLayoutValue {
  if (typeof value === 'number') {
    return {
      base: value,
      sm: value,
      md: value,
      lg: value,
      xl: value,
      '2xl': value,
    }
  }

  let currentValue = value.base ?? fallback
  const normalized = {} as EffectiveResponsiveLayoutValue

  for (const breakpoint of responsiveBreakpoints) {
    currentValue = value[breakpoint] ?? currentValue
    normalized[breakpoint] = currentValue
  }

  return normalized
}

function getResponsiveClassNames(
  value: RuntimeResponsiveLayoutValue,
  classMaps: Record<RuntimeResponsiveBreakpoint, Record<number, string>>,
) {
  if (typeof value === 'number') {
    return [classMaps.base[value]]
  }

  const classNames = [classMaps.base[value.base ?? 1]]

  for (const breakpoint of responsiveBreakpoints.slice(1)) {
    const breakpointValue = value[breakpoint]

    if (breakpointValue !== undefined) {
      classNames.push(classMaps[breakpoint][breakpointValue])
    }
  }

  return classNames
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

  if (columns !== undefined) {
    return 'form-section'
  }

  return direction === 'row' ? 'plain' : 'form-section'
}

export function getContainerNodeStyling({
  direction,
  gap,
  columns,
  variant,
  align,
  justify,
  wrap,
  surface,
}: ContainerNodeStylingOptions): ContainerNodeStyling {
  const isGridLayout = columns !== undefined
  const classNames = isGridLayout
    ? ['grid', 'w-full', ...getResponsiveClassNames(columns, responsiveContainerColumnsClassMaps)]
    : ['flex', 'w-full', direction === 'row' ? 'flex-row' : 'flex-col']
  const surfaceClassNames =
    variant === 'card'
      ? ['rounded-section', 'border', 'border-app-border-soft', 'bg-white', 'p-4', 'shadow-section', 'sm:p-5']
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
    } as ContainerGapStyle,
  }
}

export function getGridChildSpanClassName(
  span?: RuntimeResponsiveLayoutValue,
  parentGridColumns?: RuntimeResponsiveLayoutValue | null,
) {
  if (span === undefined || parentGridColumns === undefined || parentGridColumns === null) {
    return null
  }

  if (typeof span === 'number' && typeof parentGridColumns === 'number') {
    return gridChildSpanClassMap[Math.min(span, parentGridColumns)]
  }

  const normalizedSpan = normalizeResponsiveLayoutValue(span)
  const normalizedParentGridColumns = normalizeResponsiveLayoutValue(parentGridColumns)
  const classNames: string[] = []
  let previousEffectiveSpan: number | null = null

  for (const breakpoint of responsiveBreakpoints) {
    const effectiveSpan = Math.min(normalizedSpan[breakpoint], normalizedParentGridColumns[breakpoint])

    if (breakpoint === 'base' || effectiveSpan !== previousEffectiveSpan) {
      classNames.push(responsiveGridChildSpanClassMaps[breakpoint][effectiveSpan])
    }

    previousEffectiveSpan = effectiveSpan
  }

  return classNames.join(' ')
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
  const weight = level <= 2 ? 'font-semibold' : 'font-medium'

  return [
    'm-0',
    ...(headingSizeClassMap[level] ?? headingSizeClassMap[6]).split(' '),
    weight,
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

export function getImageNodeClassName() {
  return 'block max-w-full rounded-card border border-app-border-soft bg-app-surface-subtle object-cover'
}

export function getTableContainerClassName() {
  return 'rounded-card border border-app-border-soft bg-white'
}

export function getTableScrollContainerClassName() {
  return 'overflow-x-auto'
}

export function getTableNodeClassName() {
  return 'min-w-full border-collapse text-left text-sm leading-6 text-app-text'
}

export function getTableHeaderCellClassName() {
  return 'border-b border-app-border-soft bg-app-surface-subtle px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-app-text-strong'
}

export function getTableFilterControlsClassName() {
  return 'flex w-full flex-wrap items-end justify-start gap-3 border-b border-app-border-soft bg-white px-4 py-3'
}

export function getTableFilterFieldClassName() {
  return 'flex min-w-40 flex-col gap-1'
}

export function getTableFilterLabelClassName() {
  return 'sr-only'
}

export function getTableFilterInputClassName() {
  return [
    'w-full',
    'min-w-40',
    'rounded-control',
    'border',
    'border-app-border-soft',
    'bg-white',
    'px-3',
    'py-2',
    'text-sm',
    'leading-5',
    'text-app-text',
    'placeholder:text-app-text-muted',
    'focus-visible:outline-none',
    'focus-visible:ring-2',
    'focus-visible:border-app-accent',
    'focus-visible:ring-app-accent',
  ].join(' ')
}

export function getTableFilterResetButtonClassName() {
  return [
    'inline-flex',
    'items-center',
    'justify-center',
    'self-end',
    'rounded-control',
    'border',
    'border-app-border-strong',
    'bg-white',
    'px-3.5',
    'py-2',
    'text-sm',
    'font-medium',
    'leading-5',
    'text-app-text-strong',
    'transition-colors',
    'cursor-pointer',
    'hover:bg-app-surface-subtle',
    'focus-visible:outline',
    'focus-visible:outline-2',
    'focus-visible:outline-offset-2',
    'focus-visible:outline-app-accent',
  ].join(' ')
}

export function getTableSortButtonClassName(isActive = false) {
  return [
    'inline-flex',
    'w-full',
    'items-center',
    'justify-between',
    'gap-2',
    'text-left',
    'text-xs',
    'font-semibold',
    'uppercase',
    'tracking-[0.16em]',
    isActive ? 'text-app-accent' : 'text-app-text-strong',
    'transition-colors',
    'cursor-pointer',
    'hover:text-app-accent',
    'focus-visible:outline',
    'focus-visible:outline-2',
    'focus-visible:outline-offset-2',
    'focus-visible:outline-app-accent',
  ].join(' ')
}

export function getTableBodyRowClassName() {
  return 'border-b border-app-border-soft last:border-b-0'
}

export function getTableCellClassName() {
  return 'px-4 py-3 align-top text-sm text-app-text'
}

export function getTablePaginationControlsClassName() {
  return 'flex w-full flex-wrap items-center justify-center gap-3 border-t border-app-border-soft px-4 py-3'
}

export function getTablePaginationButtonClassName() {
  return getRepeaterPaginationButtonClassName()
}

export function getTablePaginationCurrentButtonClassName() {
  return getRepeaterPaginationCurrentButtonClassName()
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

export function getModalOverlayClassName() {
  return 'fixed inset-0 z-50 flex items-center justify-center bg-black/50 cursor-pointer'
}

const modalPanelSizeClassMap: Record<string, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
}

export function getModalPanelClassName(size: 'sm' | 'md' | 'lg' = 'md') {
  return [
    'relative',
    'w-full',
    modalPanelSizeClassMap[size] ?? modalPanelSizeClassMap.md,
    'rounded-card',
    'border',
    'border-app-border-soft',
    'bg-white',
    'p-6',
    'shadow-shell',
    'cursor-auto',
    'sm:p-8',
  ].join(' ')
}

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

const buttonVariantClassMaps: Record<ButtonVariant, Record<ButtonColor, string>> = {
  solid: buttonSolidVariantClassMap,
  outline: buttonOutlineVariantClassMap,
  ghost: buttonGhostVariantClassMap,
  link: buttonLinkVariantClassMap,
}

export function getAccordionHeaderClassName() {
  return [
    'w-full',
    'text-left',
    'px-4',
    'py-2',
    'font-medium',
    'flex',
    'items-center',
    'justify-between',
    'bg-primary-50',
    'cursor-pointer',
    'hover:bg-primary-100',
    'focus:outline-none',
    'focus-visible:ring-2',
    'focus-visible:ring-primary-600',
    'transition-colors',
  ].join(' ')
}

export function getAccordionChevronClassName(isOpen: boolean) {
  return [
    'h-4',
    'w-4',
    'text-primary-600',
    'transition-transform',
    'duration-200',
    'ease-out',
    ...(isOpen ? ['rotate-180'] : []),
  ].join(' ')
}

export function getAccordionBodyClassName() {
  return 'px-4 py-2 flex flex-col gap-5'
}

export function getAccordionBodyAnimationClassName(isOpen: boolean) {
  return isOpen ? 'animate-accordion-open' : 'animate-accordion-close'
}

export function getTabsRootClassName(orientation: 'horizontal' | 'vertical') {
  return orientation === 'vertical' ? 'flex flex-row' : 'flex flex-col'
}

export function getTabsBarClassName(orientation: 'horizontal' | 'vertical') {
  return orientation === 'vertical'
    ? 'flex flex-col w-48 shrink-0'
    : 'flex flex-row overflow-x-auto scrollbar-hide'
}

export function getTabsButtonClassName(isActive: boolean, orientation: 'horizontal' | 'vertical') {
  const orientationClasses =
    orientation === 'vertical'
      ? 'text-left whitespace-normal break-words'
      : 'shrink-0 whitespace-nowrap'

  if (isActive) {
    const borderClasses =
      orientation === 'vertical'
        ? ['border-t', 'border-l', 'border-b', 'border-app-border-soft']
        : ['border-t', 'border-l', 'border-r', 'border-app-border-soft']

    const overlapClass = orientation === 'vertical' ? '-mr-px' : '-mb-px'

    return [
      ...borderClasses,
      overlapClass,
      'relative',
      'z-10',
      'bg-app-background',
      'text-primary-700',
      'font-semibold',
      'px-3',
      'py-1.5',
      'transition-colors',
      'cursor-pointer',
      orientationClasses,
    ].join(' ')
  }

  return [
    'text-app-text-muted',
    'hover:text-app-text-strong',
    'font-medium',
    'px-3',
    'py-1.5',
    'transition-colors',
    'cursor-pointer',
    orientationClasses,
  ].join(' ')
}

export function getTabsPanelClassName() {
  return 'flex-1 border border-app-border-soft p-4 flex flex-col gap-5'
}

export function getLinkNodeClassName() {
  return 'inline-flex items-center text-primary-600 underline hover:text-primary-800 transition-colors font-medium'
}

export function getButtonVariantClassName(
  color: ButtonColor,
  variant: ButtonVariant,
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

// --- Stat node styling functions (T8) ---

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

// T9 — Badge styling functions (D9 D10)

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

// T10 — Alert styling functions (D9 D10)

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

// T11 — Skeleton styling functions (D9 D10)

export function getSkeletonBaseClassName(): string {
  return 'bg-neutral-200'
}

export function getSkeletonAnimateClassName(animate: boolean): string {
  return animate ? 'animate-pulse' : ''
}

// T12 — Input icon holder and icon styling functions (D9 D10 D7)

export function getInputIconHolderClassName(position: 'left' | 'right' = 'left'): string {
  const borderClass = position === 'right' ? 'border-l' : 'border-r'
  return `flex items-center justify-center px-3 bg-neutral-50 ${borderClass} border-app-border-soft shrink-0`
}

export function getInputIconClassName(): string {
  return 'text-app-text-muted size-4 pointer-events-none'
}

export function getInputWithIconClassName(): string {
  return 'flex-1 min-w-0 bg-white px-3 py-2 text-sm leading-5 text-app-text placeholder:text-app-text-muted focus-visible:outline-none'
}

export function getInputIconWrapperClassName(hasError: boolean): string {
  return [
    'flex',
    'items-stretch',
    'w-full',
    'rounded-control',
    'border',
    'overflow-hidden',
    hasError ? 'border-app-danger' : 'border-app-border-soft',
    hasError ? 'focus-within:border-app-danger' : 'focus-within:border-app-accent',
    hasError ? 'focus-within:ring-app-danger' : 'focus-within:ring-app-accent',
    'focus-within:ring-2',
  ].join(' ')
}

// T13 — File-manager styling functions (D9 D10 D8)

export function getFileManagerRowClassName(): string {
  return 'flex items-center justify-between py-2 border-b border-app-border-soft last:border-0'
}

export function getFileManagerRowFileNameClassName(): string {
  return 'text-sm text-app-text flex-1 truncate'
}

export function getFileManagerRowActionClassName(variant: 'primary' | 'danger' | 'disabled'): string {
  if (variant === 'primary') {
    return 'flex items-center gap-1 text-sm text-primary-600 hover:text-primary-800 cursor-pointer transition-colors'
  }
  if (variant === 'danger') {
    return 'flex items-center gap-1 text-sm text-danger-600 hover:text-danger-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors'
  }
  return 'flex items-center gap-1 text-sm text-neutral-300'
}

export function getFileManagerListErrorClassName(): string {
  return 'text-sm text-danger-600'
}

export function getFileManagerListEmptyClassName(): string {
  return 'text-sm text-app-text-muted'
}

export function getFileManagerListDividerClassName(): string {
  return 'divide-y divide-app-border-soft'
}

export function getFileManagerErrorItemClassName(): string {
  return 'text-sm text-danger-600'
}

const fileManagerDropZonePhaseClassMap: Record<string, string> = {
  idle: 'border-neutral-300 bg-neutral-50 cursor-pointer hover:bg-neutral-100',
  'drag-over': 'border-primary-500 bg-primary-50 cursor-pointer',
  uploading: 'border-info-400 bg-info-50 cursor-not-allowed',
  success: 'border-success-500 bg-success-50 cursor-pointer',
  error: 'border-danger-400 bg-danger-50 cursor-pointer',
}

export function getFileManagerDropZoneClassName(phase: 'idle' | 'drag-over' | 'uploading' | 'success' | 'error'): string {
  return fileManagerDropZonePhaseClassMap[phase] ?? fileManagerDropZonePhaseClassMap.idle
}

const fileManagerDropZoneTextClassMap: Record<'muted' | 'info' | 'success', string> = {
  muted: 'text-sm text-app-text-muted',
  info: 'text-sm text-info-700',
  success: 'text-sm text-success-700',
}

export function getFileManagerDropZoneTextClassName(intent: 'muted' | 'info' | 'success'): string {
  return fileManagerDropZoneTextClassMap[intent]
}

export function getFileManagerDropZoneProgressTrackClassName(): string {
  return 'w-full bg-info-200 rounded h-2'
}

export function getFileManagerDropZoneProgressFillClassName(): string {
  return 'bg-info-600 h-2 rounded transition-all'
}

const fileManagerDropZoneIconColorClassMap: Record<'muted' | 'info' | 'success', string> = {
  muted: 'text-app-text-muted',
  info: 'text-info-700',
  success: 'text-success-700',
}

export function getFileManagerDropZoneIconColorClassName(intent: 'muted' | 'info' | 'success'): string {
  return fileManagerDropZoneIconColorClassMap[intent]
}
