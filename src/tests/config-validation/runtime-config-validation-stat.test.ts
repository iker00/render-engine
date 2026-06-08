import { describe, expect, it } from 'vitest'
import { validateRuntimeConfig } from '../../config/runtime-config'
import { createConfigWithLayout } from './helpers'

function createStatNode(overrides: Record<string, unknown> = {}) {
  return {
    type: 'stat',
    props: { label: 'Revenue', value: '$12,000' },
    ...overrides,
  }
}

describe('validateRuntimeConfig — stat node: acceptance', () => {
  it('accepts a minimal stat with only props.label and props.value', () => {
    const result = validateRuntimeConfig(createConfigWithLayout([createStatNode()]))
    expect(result.status).toBe('ready')
  })

  it('accepts stat with variant: "accent" explicit', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([createStatNode({ props: { label: 'Revenue', value: '$12,000', variant: 'accent' } })]),
    )
    expect(result.status).toBe('ready')
  })

  it('accepts stat with variant: "tinted" explicit', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([createStatNode({ props: { label: 'Revenue', value: '$12,000', variant: 'tinted' } })]),
    )
    expect(result.status).toBe('ready')
  })

  it('accepts stat with color: "neutral"', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([createStatNode({ props: { label: 'X', value: '0', color: 'neutral' } })]),
    )
    expect(result.status).toBe('ready')
  })

  it('accepts stat with color: "primary"', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([createStatNode({ props: { label: 'X', value: '0', color: 'primary' } })]),
    )
    expect(result.status).toBe('ready')
  })

  it('accepts stat with color: "success"', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([createStatNode({ props: { label: 'X', value: '0', color: 'success' } })]),
    )
    expect(result.status).toBe('ready')
  })

  it('accepts stat with color: "warning"', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([createStatNode({ props: { label: 'X', value: '0', color: 'warning' } })]),
    )
    expect(result.status).toBe('ready')
  })

  it('accepts stat with color: "danger"', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([createStatNode({ props: { label: 'X', value: '0', color: 'danger' } })]),
    )
    expect(result.status).toBe('ready')
  })

  it('accepts stat with color: "info"', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([createStatNode({ props: { label: 'X', value: '0', color: 'info' } })]),
    )
    expect(result.status).toBe('ready')
  })

  it('accepts stat with props.label and props.value containing placeholders {{...}}', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        createStatNode({ props: { label: '{{queries.foo.data.label}}', value: '{{queries.foo.data.value}}' } }),
      ]),
    )
    expect(result.status).toBe('ready')
  })

  it('accepts stat with visibility, queryStateFeedback and layout.span declared', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        createStatNode({
          visibility: { reference: 'queries.q.status', operator: 'equals', value: 'success' },
          queryStateFeedback: { query: 'q' },
          layout: { span: 6 },
        }),
      ]),
    )
    expect(result.status).toBe('ready')
  })

  it('accepts stat with children declared in raw input — result does not include children (leaf node)', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        createStatNode({ children: [{ type: 'paragraph', props: { text: 'ignored' } }] }),
      ]),
    )
    expect(result.status).toBe('ready')
    if (result.status === 'ready') {
      const statNode = result.page.layout[0] as Record<string, unknown>
      expect(statNode.children).toBeUndefined()
    }
  })
})

describe('validateRuntimeConfig — stat node: props.icon acceptance', () => {
  it('accepts stat with props.icon as an arbitrary string', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([createStatNode({ props: { label: 'Revenue', value: '$12,000', icon: 'TrendingUp' } })]),
    )
    expect(result.status).toBe('ready')
  })

  it('accepts stat with props.icon as an unknown icon name string', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([createStatNode({ props: { label: 'Revenue', value: '$12,000', icon: 'NonExistentIconXyz' } })]),
    )
    expect(result.status).toBe('ready')
  })

  it('accepts stat with props.icon combined with variant and color', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([createStatNode({ props: { label: 'X', value: '0', variant: 'tinted', color: 'success', icon: 'CheckCircle' } })]),
    )
    expect(result.status).toBe('ready')
  })
})

describe('validateRuntimeConfig — stat node: rejection', () => {
  it('rejects stat without props.label — error contains props.label', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([{ type: 'stat', props: { value: '$12,000' } }]),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('props.label')
    }
  })

  it('rejects stat with props.label as non-string — error contains props.label', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([createStatNode({ props: { label: 42, value: '$12,000' } })]),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('props.label')
    }
  })

  it('rejects stat without props.value — error contains props.value', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([{ type: 'stat', props: { label: 'Revenue' } }]),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('props.value')
    }
  })

  it('rejects stat with props.value as non-string — error contains props.value', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([createStatNode({ props: { label: 'Revenue', value: 12000 } })]),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('props.value')
    }
  })

  it('rejects stat with invalid props.variant — error contains props.variant', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([createStatNode({ props: { label: 'X', value: '0', variant: 'outline' } })]),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('props.variant')
    }
  })

  it('rejects stat with invalid props.color — error contains props.color', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([createStatNode({ props: { label: 'X', value: '0', color: 'purple' } })]),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('props.color')
    }
  })

  it('rejects stat with invalid layout.span — error contains layout.span', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([createStatNode({ layout: { span: 99 } })]),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('layout.span')
    }
  })
})
