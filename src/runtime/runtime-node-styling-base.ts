import type { CSSProperties } from 'react'
import type { RuntimeResponsiveBreakpoint, RuntimeResponsiveLayoutValue } from '../config/runtime-config'

export const containerGapClassMap: Record<string, string> = {
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

export const containerAlignClassMap: Record<string, string> = {
  start: 'items-start',
  center: 'items-center',
  end: 'items-end',
  stretch: 'items-stretch',
}

export const containerJustifyClassMap: Record<string, string> = {
  start: 'justify-start',
  center: 'justify-center',
  end: 'justify-end',
  between: 'justify-between',
  around: 'justify-around',
  evenly: 'justify-evenly',
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

export const responsiveBreakpoints: RuntimeResponsiveBreakpoint[] = ['base', 'sm', 'md', 'lg', 'xl', '2xl']

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

interface GridLayoutClassNamesOptions {
  columns: RuntimeResponsiveLayoutValue
  gap?: string
  align?: string
  justify?: string
}

interface GridLayoutClassNames {
  classNames: string[]
  style?: CSSProperties
}

type GridLayoutGapStyle = CSSProperties & {
  '--runtime-container-gap': string
}

export function getGridLayoutClassNames({
  columns,
  gap,
  align,
  justify,
}: GridLayoutClassNamesOptions): GridLayoutClassNames {
  const classNames = ['grid', 'w-full', ...getResponsiveClassNames(columns, responsiveContainerColumnsClassMaps)]

  if (align) {
    classNames.push(containerAlignClassMap[align])
  }

  if (justify) {
    classNames.push(containerJustifyClassMap[justify])
  }

  const effectiveGap = gap ?? 'md'
  const mappedGapClassName = containerGapClassMap[effectiveGap]

  if (mappedGapClassName) {
    return { classNames: [...classNames, mappedGapClassName] }
  }

  return {
    classNames: [...classNames, 'gap-[var(--runtime-container-gap)]'],
    style: {
      '--runtime-container-gap': effectiveGap,
    } as GridLayoutGapStyle,
  }
}
