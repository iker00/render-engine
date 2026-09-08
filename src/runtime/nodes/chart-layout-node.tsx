import type { ReactNode } from 'react'
import { CartesianGrid, Cell, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type {
  ChartCategoricalDynamicSource,
  ChartLayoutNode,
  ChartNumericDynamicSource,
  ChartStaticCategoricalPoint,
  ChartStaticNumericPoint,
  ChartVariant,
} from '../../config/runtime-config-types'
import type { RuntimeIterationContext } from '../runtime-references/runtime-reference-resolver'
import { resolveChartCategoricalPoints, resolveChartNumericPoints } from '../runtime-collection-sources'
import {
  chartVariantRenderers,
  getChartCyclicPieColors,
  getChartHeightClassName,
  getChartSeriesColor,
} from '../runtime-node-styling-chart'
import { useRuntimeState } from '../runtime-state/use-runtime-state'

interface ChartNodeProps {
  node: ChartLayoutNode
  iterationContext?: RuntimeIterationContext
}

// D2 of design.md (feature chart-node): bar/line/area/pie/donut share the categorical
// { category, value } shape; scatter is the only numeric { x, y } variant.
const CATEGORICAL_CHART_VARIANTS: ReadonlySet<ChartVariant> = new Set(['bar', 'line', 'area', 'pie', 'donut'])

export function ChartNode({ node, iterationContext }: ChartNodeProps) {
  const state = useRuntimeState()
  const { variant, data, source, color, label, xAxisLabel, yAxisLabel, height } = node.props
  const renderer = chartVariantRenderers[variant]
  const isCategorical = CATEGORICAL_CHART_VARIANTS.has(variant)

  const categoricalPoints = isCategorical
    ? data !== undefined
      ? (data as ChartStaticCategoricalPoint[]).map((point) => ({ category: point.category, value: point.value }))
      : resolveChartCategoricalPoints(source as ChartCategoricalDynamicSource, state, { iterationContext })
    : []

  const numericPoints = !isCategorical
    ? data !== undefined
      ? (data as ChartStaticNumericPoint[]).map((point) => ({ x: point.x, y: point.y }))
      : resolveChartNumericPoints(source as ChartNumericDynamicSource, state, { iterationContext })
    : []

  const seriesColor = getChartSeriesColor(color)
  const pieSliceColors = getChartCyclicPieColors(categoricalPoints.length)
  const effectiveLabel = label ? label : undefined
  const effectiveXAxisLabel = xAxisLabel ? xAxisLabel : undefined
  const effectiveYAxisLabel = yAxisLabel ? yAxisLabel : undefined

  const { ChartComponent, SeriesComponent } = renderer

  let chartBody: ReactNode

  if (renderer.family === 'pie') {
    chartBody = (
      <ChartComponent>
        <Tooltip />
        <Legend />
        <SeriesComponent
          data={categoricalPoints}
          dataKey="value"
          nameKey="category"
          innerRadius={renderer.pieInnerRadius ?? 0}
          outerRadius="80%"
        >
          {categoricalPoints.map((point, index) => (
            <Cell key={`${point.category}-${index}`} fill={pieSliceColors[index % pieSliceColors.length]} />
          ))}
        </SeriesComponent>
      </ChartComponent>
    )
  } else if (renderer.family === 'numeric') {
    chartBody = (
      <ChartComponent>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="x" type="number" label={effectiveXAxisLabel} />
        <YAxis dataKey="y" type="number" label={effectiveYAxisLabel} />
        <Tooltip />
        {effectiveLabel ? <Legend /> : null}
        <SeriesComponent
          data={numericPoints}
          dataKey="y"
          name={effectiveLabel}
          fill={seriesColor.fill}
          stroke={seriesColor.stroke}
        />
      </ChartComponent>
    )
  } else {
    chartBody = (
      <ChartComponent data={categoricalPoints}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="category" label={effectiveXAxisLabel} />
        <YAxis label={effectiveYAxisLabel} />
        <Tooltip />
        {effectiveLabel ? <Legend /> : null}
        <SeriesComponent dataKey="value" name={effectiveLabel} fill={seriesColor.fill} stroke={seriesColor.stroke} />
      </ChartComponent>
    )
  }

  return (
    <div className={`w-full ${getChartHeightClassName(height)}`}>
      <ResponsiveContainer width="100%" height="100%">
        {chartBody}
      </ResponsiveContainer>
    </div>
  )
}
