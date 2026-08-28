import type { CSSProperties } from 'react'
import type { RuntimeResponsiveLayoutValue } from '../config/runtime-config'
import { getGridLayoutClassNames } from './runtime-node-styling-base'

interface RepeaterGridClassNameOptions {
  columns: RuntimeResponsiveLayoutValue
  gap?: string
  align?: string
  justify?: string
}

interface RepeaterGridClassName {
  className: string
  style?: CSSProperties
}

export function getRepeaterGridClassName({
  columns,
  gap,
  align,
  justify,
}: RepeaterGridClassNameOptions): RepeaterGridClassName {
  const gridLayout = getGridLayoutClassNames({ columns, gap, align, justify })

  return {
    className: gridLayout.classNames.join(' '),
    ...(gridLayout.style ? { style: gridLayout.style } : {}),
  }
}
