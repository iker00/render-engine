import { describe, expect, it } from 'vitest'
import { validateRuntimeConfig } from '../../config/runtime-config'
import { createConfigWithLayout } from './helpers'

function createSkeletonNode(overrides: Record<string, unknown> = {}) {
  return {
    type: 'skeleton',
    ...overrides,
  }
}

describe('validateRuntimeConfig — skeleton node: acceptance', () => {
  it('accepts a minimal skeleton with only type and no props', () => {
    const result = validateRuntimeConfig(createConfigWithLayout([createSkeletonNode()]))
    expect(result.status).toBe('ready')
  })

  it('accepts skeleton with props.variant: "rect"', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([createSkeletonNode({ props: { variant: 'rect' } })]),
    )
    expect(result.status).toBe('ready')
  })

  it('accepts skeleton with props.variant: "text"', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([createSkeletonNode({ props: { variant: 'text' } })]),
    )
    expect(result.status).toBe('ready')
  })

  it('accepts skeleton with props.variant: "circle"', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([createSkeletonNode({ props: { variant: 'circle' } })]),
    )
    expect(result.status).toBe('ready')
  })

  it('accepts skeleton with multiple props: width, height, rounded, animate', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        createSkeletonNode({ props: { width: '32', height: '8', rounded: true, animate: false } }),
      ]),
    )
    expect(result.status).toBe('ready')
    if (result.status === 'ready') {
      const node = result.page.layout[0] as Record<string, unknown>
      const props = node.props as Record<string, unknown>
      expect(props.width).toBe('32')
      expect(props.height).toBe('8')
      expect(props.rounded).toBe(true)
      expect(props.animate).toBe(false)
    }
  })

  it('accepts skeleton with visibility declared', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        createSkeletonNode({
          visibility: { reference: 'queries.q.status', operator: 'equals', value: 'success' },
        }),
      ]),
    )
    expect(result.status).toBe('ready')
  })

  it('accepts skeleton with queryStateFeedback declared', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        createSkeletonNode({ queryStateFeedback: { query: 'q' } }),
      ]),
    )
    expect(result.status).toBe('ready')
  })

  it('accepts skeleton with layout.span declared', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([createSkeletonNode({ layout: { span: 6 } })]),
    )
    expect(result.status).toBe('ready')
  })

  it('accepts skeleton with children declared — children are stripped silently (leaf node)', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        createSkeletonNode({ children: [{ type: 'paragraph', props: { text: 'ignored' } }] }),
      ]),
    )
    expect(result.status).toBe('ready')
    if (result.status === 'ready') {
      const node = result.page.layout[0] as Record<string, unknown>
      expect(node.children).toBeUndefined()
    }
  })

  it('accepts skeleton inside a container children collection', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        {
          type: 'container',
          children: [createSkeletonNode()],
        },
      ]),
    )
    expect(result.status).toBe('ready')
  })

  it('accepts skeleton inside repeater template', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        {
          type: 'repeater',
          props: {
            items: { source: 'queries.x.data', key: 'id' },
            template: [createSkeletonNode()],
          },
        },
      ]),
    )
    expect(result.status).toBe('ready')
  })

  it('accepts skeleton inside queryStateFeedback loading fallback (primary use case)', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        {
          type: 'paragraph',
          props: { text: 'content' },
          queryStateFeedback: {
            query: 'myQuery',
            states: {
              loading: {
                mode: 'fallback',
                fallback: [createSkeletonNode({ props: { variant: 'text', lines: 2 } })],
              },
            },
          },
        },
      ]),
    )
    expect(result.status).toBe('ready')
  })
})

describe('validateRuntimeConfig — skeleton node: rejection', () => {
  it('rejects skeleton with props.variant outside catalog ("pill") — error contains props.variant', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([createSkeletonNode({ props: { variant: 'pill' } })]),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.code).toBe('invalid-layout')
      expect(result.error.message).toContain('props.variant')
    }
  })

  it('rejects skeleton with props.lines: 0 — error contains props.lines', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([createSkeletonNode({ props: { lines: 0 } })]),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('props.lines')
    }
  })

  it('rejects skeleton with props.lines: -3 — error contains props.lines', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([createSkeletonNode({ props: { lines: -3 } })]),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('props.lines')
    }
  })

  it('rejects skeleton with props.lines: 1.5 (non-integer) — error contains props.lines', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([createSkeletonNode({ props: { lines: 1.5 } })]),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('props.lines')
    }
  })

  it('rejects skeleton with props.width of incorrect type (number) — error contains props.width', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([createSkeletonNode({ props: { width: 123 } })]),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('props.width')
    }
  })

  it('rejects skeleton with props.rounded: "yes" (non-boolean) — error contains props.rounded', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([createSkeletonNode({ props: { rounded: 'yes' } })]),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('props.rounded')
    }
  })

  it('rejects skeleton with props.animate: "no" (non-boolean) — error contains props.animate', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([createSkeletonNode({ props: { animate: 'no' } })]),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('props.animate')
    }
  })

  it('rejects skeleton with invalid layout.span (out of range 1–12) — error contains layout.span', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([createSkeletonNode({ layout: { span: 99 } })]),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('layout.span')
    }
  })
})
