import { describe, expect, it } from 'vitest'
import type { ChartColor, ChartVariant } from '../../config/runtime-config-types'
import {
  chartVariantRenderers,
  getChartCyclicPieColors,
  getChartHeightClassName,
  getChartSeriesColor,
} from '../../runtime/runtime-node-styling-chart'

describe('getChartHeightClassName', () => {
  it.each([
    ['sm', 'h-64'],
    ['md', 'h-80'],
    ['lg', 'h-96'],
    ['xl', 'h-[32rem]'],
  ] as const)('resolves height %s to class %s', (height, className) => {
    expect(getChartHeightClassName(height)).toBe(className)
  })

  it('falls back to the md class when height is undefined', () => {
    expect(getChartHeightClassName(undefined)).toBe('h-80')
  })
})

describe('getChartSeriesColor', () => {
  const expected: Record<ChartColor, { fill: string; stroke: string }> = {
    neutral: { fill: '#64748b', stroke: '#64748b' },
    primary: { fill: '#3b82f6', stroke: '#3b82f6' },
    success: { fill: '#22c55e', stroke: '#22c55e' },
    warning: { fill: '#f59e0b', stroke: '#f59e0b' },
    danger: { fill: '#ef4444', stroke: '#ef4444' },
    info: { fill: '#06b6d4', stroke: '#06b6d4' },
  }

  it.each(Object.keys(expected) as ChartColor[])('resolves the fill/stroke pair for %s', (color) => {
    expect(getChartSeriesColor(color)).toEqual(expected[color])
  })

  it('falls back to the primary pair when color is undefined', () => {
    expect(getChartSeriesColor(undefined)).toEqual(expected.primary)
  })
})

describe('getChartCyclicPieColors', () => {
  it.each([1, 2, 3, 4, 5, 6])('returns an array of length %d', (count) => {
    expect(getChartCyclicPieColors(count)).toHaveLength(count)
  })

  it('returns an array of length 7 that recycles the first token in the 7th position', () => {
    const colors = getChartCyclicPieColors(7)
    expect(colors).toHaveLength(7)
    expect(colors[6]).toBe(colors[0])
  })

  it('cycles through six distinct tokens before repeating', () => {
    const colors = getChartCyclicPieColors(6)
    expect(new Set(colors).size).toBe(6)
  })
})

describe('chartVariantRenderers', () => {
  it('exposes exactly the six ChartVariant keys', () => {
    const expectedKeys: ChartVariant[] = ['bar', 'line', 'area', 'pie', 'donut', 'scatter']
    expect(Object.keys(chartVariantRenderers).sort()).toEqual([...expectedKeys].sort())
  })

  it('donut reuses the same component pair as pie with a non-zero inner radius', () => {
    expect(chartVariantRenderers.donut.ChartComponent).toBe(chartVariantRenderers.pie.ChartComponent)
    expect(chartVariantRenderers.donut.SeriesComponent).toBe(chartVariantRenderers.pie.SeriesComponent)
    expect(chartVariantRenderers.pie.pieInnerRadius).toBe(0)
    expect(chartVariantRenderers.donut.pieInnerRadius).not.toBe(0)
  })
})
