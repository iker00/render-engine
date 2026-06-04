import { describe, expect, it } from 'vitest'
import { validateRuntimeConfig } from '../../config/runtime-config'
import { createConfigWithLayout } from './helpers'

function createDividerNode(overrides: Record<string, unknown> = {}) {
  return {
    type: 'divider',
    ...overrides,
  }
}

describe('validateRuntimeConfig — divider node: acceptance', () => {
  it('accepts a minimal divider with only type and no props (defaults to solid)', () => {
    const result = validateRuntimeConfig(createConfigWithLayout([createDividerNode()]))
    expect(result.status).toBe('ready')
  })

  it('accepts divider with props.variant: "solid"', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([createDividerNode({ props: { variant: 'solid' } })]),
    )
    expect(result.status).toBe('ready')
  })

  it('accepts divider with props.variant: "dashed"', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([createDividerNode({ props: { variant: 'dashed' } })]),
    )
    expect(result.status).toBe('ready')
  })

  it('accepts divider with props.variant: "dotted"', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([createDividerNode({ props: { variant: 'dotted' } })]),
    )
    expect(result.status).toBe('ready')
  })

  it('accepts divider with props.variant: "invisible"', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([createDividerNode({ props: { variant: 'invisible' } })]),
    )
    expect(result.status).toBe('ready')
  })

  it('accepts divider with visibility declared', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        createDividerNode({
          visibility: { reference: 'queries.q.status', operator: 'equals', value: 'success' },
        }),
      ]),
    )
    expect(result.status).toBe('ready')
  })

  it('accepts divider with queryStateFeedback declared', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        createDividerNode({
          queryStateFeedback: { query: 'q' },
        }),
      ]),
    )
    expect(result.status).toBe('ready')
  })

  it('accepts divider with layout.span declared', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        createDividerNode({ layout: { span: 6 } }),
      ]),
    )
    expect(result.status).toBe('ready')
  })

  it('accepts divider with children declared — children are stripped silently (leaf node)', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        createDividerNode({ children: [{ type: 'paragraph', props: { text: 'ignored' } }] }),
      ]),
    )
    expect(result.status).toBe('ready')
    if (result.status === 'ready') {
      const dividerNode = result.page.layout[0] as Record<string, unknown>
      expect(dividerNode.children).toBeUndefined()
    }
  })

  it('accepts divider inside a container children collection', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        {
          type: 'container',
          children: [createDividerNode()],
        },
      ]),
    )
    expect(result.status).toBe('ready')
  })
})

describe('validateRuntimeConfig — divider node: rejection', () => {
  it('rejects divider with props.variant value outside catalog ("underline") — error contains props.variant', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([createDividerNode({ props: { variant: 'underline' } })]),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('props.variant')
    }
  })

  it('rejects divider with invalid layout.span (out of range 1–12) — error contains layout.span', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([createDividerNode({ layout: { span: 99 } })]),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('layout.span')
    }
  })
})
