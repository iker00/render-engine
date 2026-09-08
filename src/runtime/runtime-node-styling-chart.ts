import type { ComponentType } from 'react'
import { Area, AreaChart, Bar, BarChart, Line, LineChart, Pie, PieChart, Scatter, ScatterChart } from 'recharts'
import type { ChartColor, ChartHeight, ChartVariant } from '../config/runtime-config-types'

const chartHeightClassMap: Record<ChartHeight, string> = {
  sm: 'h-64',
  md: 'h-80',
  lg: 'h-96',
  xl: 'h-[32rem]',
}

const DEFAULT_CHART_HEIGHT: ChartHeight = 'md'

export function getChartHeightClassName(height: ChartHeight | undefined): string {
  return chartHeightClassMap[height ?? DEFAULT_CHART_HEIGHT]
}

interface ChartSeriesColorTokens {
  fill: string
  stroke: string
}

// Same hex values as `runtime-node-styling-map.ts`'s marker color map, resolved against the same
// six semantic tokens shared by `ButtonColor`/`ChartColor`.
const chartSeriesColorHexMap: Record<ChartColor, ChartSeriesColorTokens> = {
  neutral: { fill: '#64748b', stroke: '#64748b' },
  primary: { fill: '#3b82f6', stroke: '#3b82f6' },
  success: { fill: '#22c55e', stroke: '#22c55e' },
  warning: { fill: '#f59e0b', stroke: '#f59e0b' },
  danger: { fill: '#ef4444', stroke: '#ef4444' },
  info: { fill: '#06b6d4', stroke: '#06b6d4' },
}

const DEFAULT_CHART_COLOR: ChartColor = 'primary'

export function getChartSeriesColor(color: ChartColor | undefined): ChartSeriesColorTokens {
  return chartSeriesColorHexMap[color ?? DEFAULT_CHART_COLOR]
}

// Same cycle order used by `map.markerSources` entries that omit an explicit color.
const CHART_CYCLIC_COLOR_ORDER: ChartColor[] = ['primary', 'success', 'warning', 'danger', 'info', 'neutral']

export function getChartCyclicPieColors(count: number): string[] {
  return Array.from({ length: count }, (_, index) => {
    const color = CHART_CYCLIC_COLOR_ORDER[index % CHART_CYCLIC_COLOR_ORDER.length]
    return chartSeriesColorHexMap[color].fill
  })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyChartComponent = ComponentType<any>

/**
 * Per-variant pair of Recharts components plus the layout family that
 * `ChartNode` (`chart-layout-node.tsx`) needs to decide which chrome (axes,
 * per-series `data` vs. chart-level `data`) to compose around them. `donut`
 * reuses the same `PieChart`/`Pie` pair as `pie` with a non-zero `pieInnerRadius`.
 */
export interface ChartVariantRenderer {
  ChartComponent: AnyChartComponent
  SeriesComponent: AnyChartComponent
  family: 'categorical' | 'numeric' | 'pie'
  pieInnerRadius?: number | string
}

export const chartVariantRenderers: Record<ChartVariant, ChartVariantRenderer> = {
  bar: { ChartComponent: BarChart, SeriesComponent: Bar, family: 'categorical' },
  line: { ChartComponent: LineChart, SeriesComponent: Line, family: 'categorical' },
  area: { ChartComponent: AreaChart, SeriesComponent: Area, family: 'categorical' },
  scatter: { ChartComponent: ScatterChart, SeriesComponent: Scatter, family: 'numeric' },
  pie: { ChartComponent: PieChart, SeriesComponent: Pie, family: 'pie', pieInnerRadius: 0 },
  donut: { ChartComponent: PieChart, SeriesComponent: Pie, family: 'pie', pieInnerRadius: '60%' },
}
