import { describe, expect, it } from 'vitest'
import { chartNodeSchema } from '../../config/runtime-config-zod'
import { validateRuntimeConfig } from '../../config/runtime-config'
import { createConfigWithLayout } from './helpers'

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

// T02 of feature chart-node: `validateChartNode` wires `chartNodeSchema` into the layout
// dispatcher and adds the cross-field rules (D2) that the shape-only schema above cannot express
// on its own (family-per-variant match, data/source mutual exclusion, pie/donut prop rejection,
// collection source/projection path validation). These tests exercise the full pipeline through
// `validateRuntimeConfig`, the same way `runtime-config-validation-gallery.test.ts` and
// `runtime-config-validation-map.test.ts` do for their own dispatcher-integrated node validators.
describe('validateRuntimeConfig — chart node: data/source mutual exclusion', () => {
  it('rejects a chart without data or source declared', () => {
    const result = validateRuntimeConfig(createConfigWithLayout([createChartNode({ props: { variant: 'bar' } })]))
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('at "layout[0].props"')
    }
  })

  it('rejects a chart that declares both data and source at once', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        createChartNode({
          props: {
            variant: 'bar',
            data: [{ category: 'a', value: 1 }],
            source: { source: 'queries.stats.data', category: 'label', value: 'total' },
          },
        }),
      ]),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('at "layout[0].props"')
    }
  })
})

describe('validateRuntimeConfig — chart node: family-per-variant match', () => {
  it('accepts variant "scatter" with a numeric data point', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([createChartNode({ props: { variant: 'scatter', data: [{ x: 1, y: 2 }] } })]),
    )
    expect(result.status).toBe('ready')
  })

  it('rejects variant "scatter" with a categorical data point (family mismatch)', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([createChartNode({ props: { variant: 'scatter', data: [{ category: 'a', value: 1 }] } })]),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('props.data[0]')
    }
  })

  it('accepts variant "bar" with a categorical data point', () => {
    const result = validateRuntimeConfig(createConfigWithLayout([createChartNode()]))
    expect(result.status).toBe('ready')
  })

  it('rejects variant "bar" with a numeric data point (family mismatch)', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([createChartNode({ props: { variant: 'bar', data: [{ x: 1, y: 2 }] } })]),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('props.data[0]')
    }
  })

  it('accepts variant "scatter" with a numeric source', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        createChartNode({
          props: { variant: 'scatter', data: undefined, source: { source: 'queries.stats.data', x: 'a', y: 'b' } },
        }),
      ]),
    )
    expect(result.status).toBe('ready')
  })

  it('rejects variant "scatter" with a categorical source (family mismatch)', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        createChartNode({
          props: {
            variant: 'scatter',
            data: undefined,
            source: { source: 'queries.stats.data', category: 'label', value: 'total' },
          },
        }),
      ]),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('at "layout[0].props.source"')
    }
  })
})

describe('validateRuntimeConfig — chart node: pie/donut reject color/label/axis labels', () => {
  it('rejects props.color when variant is "pie"', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        createChartNode({ props: { variant: 'pie', data: [{ category: 'a', value: 1 }], color: 'primary' } }),
      ]),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('at "layout[0].props.color"')
    }
  })

  it('rejects props.label when variant is "donut"', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        createChartNode({ props: { variant: 'donut', data: [{ category: 'a', value: 1 }], label: 'Distribución' } }),
      ]),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('at "layout[0].props.label"')
    }
  })

  it('rejects props.xAxisLabel when variant is "pie"', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        createChartNode({ props: { variant: 'pie', data: [{ category: 'a', value: 1 }], xAxisLabel: 'Categoría' } }),
      ]),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('at "layout[0].props.xAxisLabel"')
    }
  })

  it('rejects props.yAxisLabel when variant is "pie"', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        createChartNode({ props: { variant: 'pie', data: [{ category: 'a', value: 1 }], yAxisLabel: 'Valor' } }),
      ]),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('at "layout[0].props.yAxisLabel"')
    }
  })

  it('accepts color/label/xAxisLabel/yAxisLabel declared together when variant is "bar"', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        createChartNode({
          props: {
            variant: 'bar',
            data: [{ category: 'a', value: 1 }],
            color: 'primary',
            label: 'Ventas',
            xAxisLabel: 'Mes',
            yAxisLabel: 'Total',
          },
        }),
      ]),
    )
    expect(result.status).toBe('ready')
  })
})

describe('validateRuntimeConfig — chart node: source.source pattern (validateCollectionSource)', () => {
  it('rejects source.source outside the queries.{queryName}.data(.*) pattern', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        createChartNode({
          props: {
            variant: 'bar',
            data: undefined,
            source: { source: 'stats', category: 'label', value: 'total' },
          },
        }),
      ]),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('props.source.source')
    }
  })
})

describe('validateRuntimeConfig — chart node: source.category/value/x/y projection paths', () => {
  it('accepts source.category as an interpolation "{{item.name}}"', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        createChartNode({
          props: {
            variant: 'bar',
            data: undefined,
            source: { source: 'queries.stats.data', category: '{{item.name}}', value: 'total' },
          },
        }),
      ]),
    )
    expect(result.status).toBe('ready')
  })

  it('rejects source.category when empty', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        createChartNode({
          props: {
            variant: 'bar',
            data: undefined,
            source: { source: 'queries.stats.data', category: '', value: 'total' },
          },
        }),
      ]),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('at "layout[0].props.source.category"')
    }
  })

  it('rejects source.value declared as an interpolation "{{...}}" instead of a pure relative path', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        createChartNode({
          props: {
            variant: 'bar',
            data: undefined,
            source: { source: 'queries.stats.data', category: 'label', value: '{{item.total}}' },
          },
        }),
      ]),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('at "layout[0].props.source.value"')
    }
  })

  it('rejects source.value as an empty relative path', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        createChartNode({
          props: {
            variant: 'bar',
            data: undefined,
            source: { source: 'queries.stats.data', category: 'label', value: '' },
          },
        }),
      ]),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('at "layout[0].props.source.value"')
    }
  })

  it('rejects source.x declared as an interpolation "{{...}}" instead of a pure relative path', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        createChartNode({
          props: {
            variant: 'scatter',
            data: undefined,
            source: { source: 'queries.stats.data', x: '{{item.x}}', y: 'b' },
          },
        }),
      ]),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('at "layout[0].props.source.x"')
    }
  })

  it('rejects source.y as an empty relative path', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        createChartNode({
          props: {
            variant: 'scatter',
            data: undefined,
            source: { source: 'queries.stats.data', x: 'a', y: '' },
          },
        }),
      ]),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('at "layout[0].props.source.y"')
    }
  })
})

describe('validateRuntimeConfig — chart node: children rejection', () => {
  it('rejects a chart with children declared as an empty array', () => {
    const result = validateRuntimeConfig(createConfigWithLayout([createChartNode({ children: [] })]))
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('at "layout[0].children"')
    }
  })
})
