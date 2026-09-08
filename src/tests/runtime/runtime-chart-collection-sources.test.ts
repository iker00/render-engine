import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resolveChartCategoricalPoints, resolveChartNumericPoints } from '../../runtime/runtime-collection-sources'
import type { ChartCategoricalDynamicSource, ChartNumericDynamicSource } from '../../config/runtime-config-types'
import type { RuntimeState } from '../../runtime/runtime-state/runtime-state-types'

const runtimeState: RuntimeState = {
  navigation: {
    currentPageId: 'home',
    history: [{ entryId: 0, pageId: 'home', params: {} }],
    lastError: null,
  },
  forms: {},
  queries: {
    q: {
      status: 'success',
      data: [
        { label: 'A', total: 10 },
        { label: 'B', total: 5 },
      ],
      error: null,
    },
    withInvalidValue: {
      status: 'success',
      data: [
        { label: 'A', total: 10 },
        { label: 'X', total: 'oops' },
        { label: 'C', total: 3 },
      ],
      error: null,
    },
    withInvalidCategory: {
      status: 'success',
      data: [
        { label: 'A', total: 10 },
        { label: { nested: true }, total: 4 },
        { label: 'C', total: 3 },
      ],
      error: null,
    },
    withNonFiniteValue: {
      status: 'success',
      data: [
        { label: 'A', total: Number.NaN },
        { label: 'B', total: Number.POSITIVE_INFINITY },
        { label: 'C', total: 7 },
      ],
      error: null,
    },
    emptyPoints: {
      status: 'success',
      data: [],
      error: null,
    },
    scalarPoints: {
      status: 'success',
      data: 'not-a-collection',
      error: null,
    },
    numeric: {
      status: 'success',
      data: [
        { a: 1, b: 2 },
        { a: 3, b: 4 },
      ],
      error: null,
    },
    numericWithInvalidX: {
      status: 'success',
      data: [
        { a: 1, b: 2 },
        { a: 'oops', b: 4 },
        { a: 3, b: 6 },
      ],
      error: null,
    },
    numericWithInvalidY: {
      status: 'success',
      data: [
        { a: 1, b: 2 },
        { a: 3, b: Number.NaN },
        { a: 5, b: Number.POSITIVE_INFINITY },
        { a: 7, b: 8 },
      ],
      error: null,
    },
  },
  pageEntry: {
    entryId: 0,
    pageId: 'home',
    params: {},
    preloadNames: [],
    status: 'idle',
  },
}

describe('resolveChartCategoricalPoints', () => {
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  })

  afterEach(() => {
    consoleWarnSpy.mockRestore()
  })

  it('resolves a categorical point per item preserving collection order', () => {
    const source: ChartCategoricalDynamicSource = {
      source: 'queries.q.data',
      category: 'label',
      value: 'total',
    }

    expect(resolveChartCategoricalPoints(source, runtimeState)).toEqual([
      { category: 'A', value: 10 },
      { category: 'B', value: 5 },
    ])
  })

  it('skips an item whose value is not numeric and keeps the rest', () => {
    const source: ChartCategoricalDynamicSource = {
      source: 'queries.withInvalidValue.data',
      category: 'label',
      value: 'total',
    }

    expect(resolveChartCategoricalPoints(source, runtimeState)).toEqual([
      { category: 'A', value: 10 },
      { category: 'C', value: 3 },
    ])
  })

  it('skips an item whose category does not resolve to a valid text value', () => {
    const source: ChartCategoricalDynamicSource = {
      source: 'queries.withInvalidCategory.data',
      category: 'label',
      value: 'total',
    }

    expect(resolveChartCategoricalPoints(source, runtimeState)).toEqual([
      { category: 'A', value: 10 },
      { category: 'C', value: 3 },
    ])
  })

  it('resolves an interpolated category using the item as iteration context', () => {
    const source: ChartCategoricalDynamicSource = {
      source: 'queries.q.data',
      category: '{{item.label}}: {{item.total}}',
      value: 'total',
    }

    expect(resolveChartCategoricalPoints(source, runtimeState)).toEqual([
      { category: 'A: 10', value: 10 },
      { category: 'B: 5', value: 5 },
    ])
  })

  it('does not interpolate value: an interpolation-shaped path is treated as a literal relative path and the item is skipped', () => {
    const source: ChartCategoricalDynamicSource = {
      source: 'queries.q.data',
      category: 'label',
      value: '{{total}}',
    }

    expect(resolveChartCategoricalPoints(source, runtimeState)).toEqual([])
  })

  it('returns an empty list without error when the base collection resolves to null, undefined or a non-array value', () => {
    const source: ChartCategoricalDynamicSource = {
      source: 'queries.emptyPoints.data',
      category: 'label',
      value: 'total',
    }
    const scalarSource: ChartCategoricalDynamicSource = {
      source: 'queries.scalarPoints.data',
      category: 'label',
      value: 'total',
    }
    const missingSource: ChartCategoricalDynamicSource = {
      source: 'queries.missing.data',
      category: 'label',
      value: 'total',
    }

    expect(resolveChartCategoricalPoints(source, runtimeState)).toEqual([])
    expect(resolveChartCategoricalPoints(scalarSource, runtimeState)).toEqual([])
    expect(() => resolveChartCategoricalPoints(missingSource, runtimeState)).not.toThrow()
  })

  it('skips items whose value is NaN or Infinity', () => {
    const source: ChartCategoricalDynamicSource = {
      source: 'queries.withNonFiniteValue.data',
      category: 'label',
      value: 'total',
    }

    expect(resolveChartCategoricalPoints(source, runtimeState)).toEqual([
      { category: 'C', value: 7 },
    ])
  })

  it('never mutates the underlying collection and returns equivalent results across repeated calls', () => {
    const source: ChartCategoricalDynamicSource = {
      source: 'queries.q.data',
      category: 'label',
      value: 'total',
    }
    const originalData = JSON.parse(JSON.stringify(runtimeState.queries.q.data))

    const firstResult = resolveChartCategoricalPoints(source, runtimeState)
    const secondResult = resolveChartCategoricalPoints(source, runtimeState)

    expect(runtimeState.queries.q.data).toEqual(originalData)
    expect(firstResult).toEqual(secondResult)
  })
})

describe('resolveChartNumericPoints', () => {
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  })

  afterEach(() => {
    consoleWarnSpy.mockRestore()
  })

  it('resolves a numeric point per item preserving collection order', () => {
    const source: ChartNumericDynamicSource = {
      source: 'queries.numeric.data',
      x: 'a',
      y: 'b',
    }

    expect(resolveChartNumericPoints(source, runtimeState)).toEqual([
      { x: 1, y: 2 },
      { x: 3, y: 4 },
    ])
  })

  it('skips an item whose x is not numeric and keeps the rest', () => {
    const source: ChartNumericDynamicSource = {
      source: 'queries.numericWithInvalidX.data',
      x: 'a',
      y: 'b',
    }

    expect(resolveChartNumericPoints(source, runtimeState)).toEqual([
      { x: 1, y: 2 },
      { x: 3, y: 6 },
    ])
  })

  it('skips an item whose y is NaN or Infinity', () => {
    const source: ChartNumericDynamicSource = {
      source: 'queries.numericWithInvalidY.data',
      x: 'a',
      y: 'b',
    }

    expect(resolveChartNumericPoints(source, runtimeState)).toEqual([
      { x: 1, y: 2 },
      { x: 7, y: 8 },
    ])
  })

  it('returns an empty list without error when the base collection does not resolve to an array', () => {
    const source: ChartNumericDynamicSource = {
      source: 'queries.scalarPoints.data',
      x: 'a',
      y: 'b',
    }

    expect(resolveChartNumericPoints(source, runtimeState)).toEqual([])
  })

  it('never mutates the underlying collection and returns equivalent results across repeated calls', () => {
    const source: ChartNumericDynamicSource = {
      source: 'queries.numeric.data',
      x: 'a',
      y: 'b',
    }
    const originalData = JSON.parse(JSON.stringify(runtimeState.queries.numeric.data))

    const firstResult = resolveChartNumericPoints(source, runtimeState)
    const secondResult = resolveChartNumericPoints(source, runtimeState)

    expect(runtimeState.queries.numeric.data).toEqual(originalData)
    expect(firstResult).toEqual(secondResult)
  })
})
