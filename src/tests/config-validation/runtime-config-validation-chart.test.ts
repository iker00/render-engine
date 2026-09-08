import { describe, expect, it } from 'vitest'
import { chartNodeSchema } from '../../config/runtime-config-zod'

// T01 of feature chart-node: `chartNodeSchema` is not yet wired into the layout dispatcher
// (`validate-layout-nodes-core.ts`) or the recursive root union (`runtime-config-root-zod.ts`) —
// that imperative wiring (with cross-field rules between `variant`/`data`/`source`) is T02's
// scope. These tests exercise the Zod shape layer directly with `chartNodeSchema.safeParse`, the
// same way `validateRuntimeConfig` would once T02 threads it through, but without depending on
// dispatcher wiring that does not exist yet.
function createChartNode(overrides: Record<string, unknown> = {}) {
  return {
    type: 'chart',
    props: {
      variant: 'bar',
      data: [{ category: 'a', value: 1 }],
    },
    ...overrides,
  }
}

describe('chartNodeSchema — shape acceptance', () => {
  it('accepts variant: "bar" with a categorical data point', () => {
    const result = chartNodeSchema.safeParse(createChartNode())
    expect(result.success).toBe(true)
  })

  it('accepts variant: "bar" without data or source declared', () => {
    const result = chartNodeSchema.safeParse(
      createChartNode({ props: { variant: 'bar' } }),
    )
    expect(result.success).toBe(true)
  })

  it('accepts variant: "bar" with both a categorical data array and a categorical source declared at once', () => {
    const result = chartNodeSchema.safeParse(
      createChartNode({
        props: {
          variant: 'bar',
          data: [{ category: 'a', value: 1 }],
          source: { source: 'queries.stats.data', category: 'label', value: 'total' },
        },
      }),
    )
    expect(result.success).toBe(true)
  })

  it('accepts variant: "scatter" with a numeric data point (numeric shape accepted by the union)', () => {
    const result = chartNodeSchema.safeParse(
      createChartNode({ props: { variant: 'scatter', data: [{ x: 1, y: 2 }] } }),
    )
    expect(result.success).toBe(true)
  })

  it('accepts variant: "pie" with color and label declared', () => {
    const result = chartNodeSchema.safeParse(
      createChartNode({
        props: { variant: 'pie', color: 'primary', label: 'Distribución' },
      }),
    )
    expect(result.success).toBe(true)
  })
})

describe('chartNodeSchema — shape rejection', () => {
  it('rejects a node without props.variant', () => {
    const result = chartNodeSchema.safeParse(createChartNode({ props: { data: [{ category: 'a', value: 1 }] } }))
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(['props', 'variant'])
    }
  })

  it.each(['radar', 'BAR', null])('rejects props.variant: %s (outside the six supported literals)', (variant) => {
    const result = chartNodeSchema.safeParse(createChartNode({ props: { variant, data: [{ category: 'a', value: 1 }] } }))
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(['props', 'variant'])
    }
  })

  it('rejects props.height outside sm|md|lg|xl', () => {
    const result = chartNodeSchema.safeParse(createChartNode({ props: { variant: 'bar', height: 'huge' } }))
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(['props', 'height'])
    }
  })

  it('rejects props.color outside the closed six-color palette', () => {
    const result = chartNodeSchema.safeParse(createChartNode({ props: { variant: 'bar', color: 'purple' } }))
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(['props', 'color'])
    }
  })

  it('rejects children declared as an empty array', () => {
    const result = chartNodeSchema.safeParse(createChartNode({ children: [] }))
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(['children'])
    }
  })

  it('rejects children declared with a node inside', () => {
    const result = chartNodeSchema.safeParse(
      createChartNode({ children: [{ type: 'paragraph', props: { text: 'ignored' } }] }),
    )
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(['children'])
    }
  })

  it('rejects props.data[i] with an unrecognizable shape', () => {
    const result = chartNodeSchema.safeParse(
      createChartNode({ props: { variant: 'bar', data: [{ foo: 1 }] } }),
    )
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(['props', 'data', 0])
    }
  })

  // `props.source` is a plain (non-discriminated) union of the categorical and numeric dynamic
  // source shapes — there is no shared literal discriminant to key a `z.discriminatedUnion` on
  // (both shapes start with `source`), so a mismatched leaf field fails *both* union members at
  // once and Zod surfaces a single `invalid_union` issue scoped to `props.source` rather than the
  // individual leaf. The nested per-branch issues (`issue.errors`) still pinpoint which leaf
  // field actually failed, so assertions check both: the top-level issue lands on `props.source`,
  // and at least one nested branch blames the exact field under test.
  function expectSourceUnionIssueOnField(
    result: ReturnType<typeof chartNodeSchema.safeParse>,
    fieldName: string,
  ): void {
    expect(result.success).toBe(false)
    if (result.success) return
    const issue = result.error.issues[0]
    expect(issue.path).toEqual(['props', 'source'])
    expect(issue.code).toBe('invalid_union')
    const nestedIssues = 'errors' in issue ? issue.errors.flat() : []
    expect(nestedIssues.some((nested) => nested.path.length === 1 && nested.path[0] === fieldName)).toBe(true)
  }

  it('rejects props.source.source when not a string', () => {
    const result = chartNodeSchema.safeParse(
      createChartNode({
        props: { variant: 'bar', data: undefined, source: { source: 42, category: 'label', value: 'total' } },
      }),
    )
    expectSourceUnionIssueOnField(result, 'source')
  })

  it('rejects props.source.category when not a string', () => {
    const result = chartNodeSchema.safeParse(
      createChartNode({
        props: {
          variant: 'bar',
          data: undefined,
          source: { source: 'queries.stats.data', category: 42, value: 'total' },
        },
      }),
    )
    expectSourceUnionIssueOnField(result, 'category')
  })

  it('rejects props.source.value when not a string', () => {
    const result = chartNodeSchema.safeParse(
      createChartNode({
        props: {
          variant: 'bar',
          data: undefined,
          source: { source: 'queries.stats.data', category: 'label', value: 42 },
        },
      }),
    )
    expectSourceUnionIssueOnField(result, 'value')
  })

  it('rejects props.source.x when not a string', () => {
    const result = chartNodeSchema.safeParse(
      createChartNode({
        props: {
          variant: 'scatter',
          data: undefined,
          source: { source: 'queries.stats.data', x: 42, y: 'y' },
        },
      }),
    )
    expectSourceUnionIssueOnField(result, 'x')
  })

  it('rejects props.source.y when not a string', () => {
    const result = chartNodeSchema.safeParse(
      createChartNode({
        props: {
          variant: 'scatter',
          data: undefined,
          source: { source: 'queries.stats.data', x: 'x', y: 42 },
        },
      }),
    )
    expectSourceUnionIssueOnField(result, 'y')
  })

  it('rejects props.label when not a string', () => {
    const result = chartNodeSchema.safeParse(createChartNode({ props: { variant: 'bar', label: 42 } }))
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(['props', 'label'])
    }
  })

  it('rejects props.xAxisLabel when not a string', () => {
    const result = chartNodeSchema.safeParse(createChartNode({ props: { variant: 'bar', xAxisLabel: 42 } }))
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(['props', 'xAxisLabel'])
    }
  })

  it('rejects props.yAxisLabel when not a string', () => {
    const result = chartNodeSchema.safeParse(createChartNode({ props: { variant: 'bar', yAxisLabel: 42 } }))
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(['props', 'yAxisLabel'])
    }
  })
})
