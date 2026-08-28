import type { CSSProperties } from 'react'
import type { RuntimeResponsiveLayoutValue } from '../config/runtime-config'
import {
  containerAlignClassMap,
  containerGapClassMap,
  containerJustifyClassMap,
  getGridLayoutClassNames,
} from './runtime-node-styling-base'

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
  const surfaceClassNames =
    variant === 'card'
      ? ['rounded-section', 'border', 'border-app-border-soft', 'bg-white', 'p-4', 'shadow-section', 'sm:p-5']
      : []

  if (columns !== undefined) {
    const gridLayout = getGridLayoutClassNames({ columns, gap, align, justify })
    // getGridLayoutClassNames always appends the resolved gap class as its last entry;
    // the card surface classes must land before it to preserve the historical class order.
    const gapClassIndex = gridLayout.classNames.length - 1
    const classNames = [
      ...gridLayout.classNames.slice(0, gapClassIndex),
      ...surfaceClassNames,
      gridLayout.classNames[gapClassIndex],
    ]

    return {
      className: classNames.join(' '),
      ...(gridLayout.style ? { style: gridLayout.style } : {}),
    }
  }

  const classNames = ['flex', 'w-full', direction === 'row' ? 'flex-row' : 'flex-col']

  if (align) {
    classNames.push(containerAlignClassMap[align])
  }

  if (justify) {
    classNames.push(containerJustifyClassMap[justify])
  }

  classNames.push(containerWrapClassMap[wrap ?? 'nowrap'])

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
