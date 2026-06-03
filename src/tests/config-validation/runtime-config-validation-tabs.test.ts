import { describe, expect, it } from 'vitest'
import { validateRuntimeConfig } from '../../config/runtime-config'
import { createConfigWithLayout } from './helpers'

function createTabsNode(overrides: Record<string, unknown> = {}) {
  return {
    type: 'tabs',
    props: {
      items: [{ label: 'Tab 1' }],
    },
    ...overrides,
  }
}

describe('validateRuntimeConfig — tabs node shape', () => {
  it('accepts a tabs node with one item without children', () => {
    const result = validateRuntimeConfig(createConfigWithLayout([createTabsNode()]))
    expect(result.status).toBe('ready')
  })

  it('accepts a tabs node with orientation horizontal', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([createTabsNode({ props: { items: [{ label: 'Tab 1' }], orientation: 'horizontal' } })]),
    )
    expect(result.status).toBe('ready')
  })

  it('accepts a tabs node with orientation vertical', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([createTabsNode({ props: { items: [{ label: 'Tab 1' }], orientation: 'vertical' } })]),
    )
    expect(result.status).toBe('ready')
  })

  it('accepts a tabs node with defaultTab: 1', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        createTabsNode({
          props: {
            items: [{ label: 'Tab 1' }, { label: 'Tab 2' }],
            defaultTab: 1,
          },
        }),
      ]),
    )
    expect(result.status).toBe('ready')
  })

  it('accepts a tabs node with children containing valid nodes (heading, paragraph, container, form)', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        createTabsNode({
          props: {
            items: [
              {
                label: 'Tab 1',
                children: [{ type: 'heading', props: { text: 'Hello', level: 1 } }],
              },
              {
                label: 'Tab 2',
                children: [{ type: 'paragraph', props: { text: 'World' } }],
              },
            ],
          },
        }),
      ]),
    )
    expect(result.status).toBe('ready')
  })

  it('accepts a tabs node inside container.children', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        { type: 'container', children: [createTabsNode()] },
      ]),
    )
    expect(result.status).toBe('ready')
  })

  it('accepts a tabs node with visibility, queryStateFeedback and layout.span', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        createTabsNode({
          visibility: {
            reference: 'queries.someQuery.data.show',
            operator: 'isTruthy',
          },
          queryStateFeedback: {
            query: 'someQuery',
            states: { loading: { mode: 'hide' } },
          },
          layout: { span: 6 },
        }),
      ]),
    )
    expect(result.status).toBe('ready')
  })

  it('rejects a tabs node without props.items with code invalid-layout and path including props.items', () => {
    const result = validateRuntimeConfig(createConfigWithLayout([{ type: 'tabs', props: {} }]))
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.code).toBe('invalid-layout')
      expect(result.error.message).toContain('props.items')
    }
  })

  it('rejects a tabs node with props.items as empty array with code invalid-layout and path including props.items', () => {
    const result = validateRuntimeConfig(createConfigWithLayout([{ type: 'tabs', props: { items: [] } }]))
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.code).toBe('invalid-layout')
      expect(result.error.message).toContain('props.items')
    }
  })

  it('rejects a tabs item without label with code invalid-layout and path including index and .label', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([{ type: 'tabs', props: { items: [{ children: [] }] } }]),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.code).toBe('invalid-layout')
      expect(result.error.message).toContain('items[0]')
      expect(result.error.message).toContain('label')
    }
  })

  it('rejects props.orientation with value diagonal with code invalid-layout and path including props.orientation', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        createTabsNode({ props: { items: [{ label: 'Tab 1' }], orientation: 'diagonal' } }),
      ]),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.code).toBe('invalid-layout')
      expect(result.error.message).toContain('props.orientation')
    }
  })

  it('rejects children of an item containing a node with unknown type with code unsupported-node-type', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        createTabsNode({
          props: {
            items: [
              {
                label: 'Tab 1',
                children: [{ type: 'unknown-widget', props: {} }],
              },
            ],
          },
        }),
      ]),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.code).toBe('unsupported-node-type')
    }
  })

  it('rejects children of an item containing an invalid node (input outside form) with code invalid-layout', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        createTabsNode({
          props: {
            items: [
              {
                label: 'Tab 1',
                children: [{ type: 'input', props: { fieldId: 'f1', label: 'Field 1' } }],
              },
            ],
          },
        }),
      ]),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.code).toBe('invalid-layout')
    }
  })
})
