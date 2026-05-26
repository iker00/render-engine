import type { CSSProperties } from 'react'
import type {
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
      : surface === 'form-section'
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

export function getImageNodeClassName() {
  return 'block max-w-full rounded-card border border-app-border-soft bg-app-surface-subtle object-cover'
}

export function getTableContainerClassName() {
  return 'overflow-x-auto rounded-card border border-app-border-soft bg-white'
}

export function getTableNodeClassName() {
  return 'min-w-full border-collapse text-left text-sm leading-6 text-app-text'
}

export function getTableHeaderCellClassName() {
  return 'border-b border-app-border-soft bg-app-surface-subtle px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-app-text-strong'
}

export function getTableBodyRowClassName() {
  return 'border-b border-app-border-soft last:border-b-0'
}

export function getTableCellClassName() {
  return 'px-4 py-3 align-top text-sm text-app-text'
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
    'px-3.5',
    'py-2',
    'text-sm',
    'font-semibold',
    'leading-5',
    'text-app-text-strong',
    'transition-colors',
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
