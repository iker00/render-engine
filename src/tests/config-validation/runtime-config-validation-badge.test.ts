import { describe, expect, it } from 'vitest'
import { validateRuntimeConfig } from '../../config/runtime-config'
import { createConfigWithLayout } from './helpers'

function createBadgeNode(overrides: Record<string, unknown> = {}) {
  return {
    type: 'badge',
    props: { label: 'Activo' },
    ...overrides,
  }
}

describe('validateRuntimeConfig — badge node: acceptance', () => {
  it('accepts a minimal badge with only type and props.label', () => {
    const result = validateRuntimeConfig(createConfigWithLayout([createBadgeNode()]))
    expect(result.status).toBe('ready')
  })

  it('accepts badge with variant: "pill" explicit', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([createBadgeNode({ props: { label: 'Activo', variant: 'pill' } })]),
    )
    expect(result.status).toBe('ready')
  })

  it('accepts badge with variant: "circle" explicit', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([createBadgeNode({ props: { label: 'Activo', variant: 'circle' } })]),
    )
    expect(result.status).toBe('ready')
  })

  it('accepts badge with color: "neutral"', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([createBadgeNode({ props: { label: 'X', color: 'neutral' } })]),
    )
    expect(result.status).toBe('ready')
  })

  it('accepts badge with color: "primary"', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([createBadgeNode({ props: { label: 'X', color: 'primary' } })]),
    )
    expect(result.status).toBe('ready')
  })

  it('accepts badge with color: "success"', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([createBadgeNode({ props: { label: 'X', color: 'success' } })]),
    )
    expect(result.status).toBe('ready')
  })

  it('accepts badge with color: "warning"', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([createBadgeNode({ props: { label: 'X', color: 'warning' } })]),
    )
    expect(result.status).toBe('ready')
  })

  it('accepts badge with color: "danger"', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([createBadgeNode({ props: { label: 'X', color: 'danger' } })]),
    )
    expect(result.status).toBe('ready')
  })

  it('accepts badge with color: "info"', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([createBadgeNode({ props: { label: 'X', color: 'info' } })]),
    )
    expect(result.status).toBe('ready')
  })

  it('accepts badge with props.label containing a placeholder {{queries.foo.data}}', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([createBadgeNode({ props: { label: '{{queries.foo.data}}' } })]),
    )
    expect(result.status).toBe('ready')
  })

  it('accepts badge with visibility, queryStateFeedback and layout.span declared', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        createBadgeNode({
          visibility: { reference: 'queries.q.status', operator: 'equals', value: 'success' },
          queryStateFeedback: { query: 'q' },
          layout: { span: 6 },
        }),
      ]),
    )
    expect(result.status).toBe('ready')
  })

  it('accepts badge with children declared in raw input — result does not include children (leaf node)', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        createBadgeNode({ children: [{ type: 'paragraph', props: { text: 'ignored' } }] }),
      ]),
    )
    expect(result.status).toBe('ready')
    if (result.status === 'ready') {
      const badgeNode = result.page.layout[0] as Record<string, unknown>
      expect(badgeNode.children).toBeUndefined()
    }
  })
})

describe('validateRuntimeConfig — badge node: rejection', () => {
  it('rejects badge without props.label — error contains props.label', () => {
    const result = validateRuntimeConfig(createConfigWithLayout([{ type: 'badge', props: {} }]))
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('props.label')
    }
  })

  it('rejects badge with props.label as number — error contains props.label', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([createBadgeNode({ props: { label: 42 } })]),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('props.label')
    }
  })

  it('rejects badge with invalid props.variant — error contains props.variant', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([createBadgeNode({ props: { label: 'X', variant: 'square' } })]),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('props.variant')
    }
  })

  it('rejects badge with invalid props.color — error contains props.color', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([createBadgeNode({ props: { label: 'X', color: 'red' } })]),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('props.color')
    }
  })

  it('rejects badge with invalid layout.span — error contains layout.span', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([createBadgeNode({ layout: { span: 99 } })]),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('layout.span')
    }
  })
})
