import type { CSSProperties } from 'react'
import type { RuntimeResponsiveBreakpoint, RuntimeResponsiveLayoutValue } from '../config/runtime-config'
import { responsiveBreakpoints } from './runtime-node-styling-base'

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
