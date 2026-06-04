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

describe('validateRuntimeConfig — tabs item visibility', () => {
  it('accepts items with valid visibility using operator equals and forms reference', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        createTabsNode({
          props: {
            items: [
              { label: 'Tab 1', visibility: { reference: 'forms.user.role', operator: 'equals', value: 'admin' } },
              { label: 'Tab 2' },
            ],
          },
        }),
      ]),
    )
    expect(result.status).toBe('ready')
  })

  it('accepts items with valid visibility using operator notEquals', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        createTabsNode({
          props: {
            items: [
              { label: 'Tab 1', visibility: { reference: 'forms.user.role', operator: 'notEquals', value: 'guest' } },
            ],
          },
        }),
      ]),
    )
    expect(result.status).toBe('ready')
  })

  it('accepts items with valid visibility using operator isTruthy and queries reference', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        createTabsNode({
          props: {
            items: [
              { label: 'Tab 1', visibility: { reference: 'queries.someQuery.data.show', operator: 'isTruthy' } },
            ],
          },
        }),
      ]),
    )
    expect(result.status).toBe('ready')
  })

  it('accepts items with valid visibility using operator isFalsy and queries.data reference', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        createTabsNode({
          props: {
            items: [
              { label: 'Tab 1', visibility: { reference: 'queries.someQuery.data', operator: 'isFalsy' } },
            ],
          },
        }),
      ]),
    )
    expect(result.status).toBe('ready')
  })

  it('accepts items with valid visibility using operator greaterThan and numeric value', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        createTabsNode({
          props: {
            items: [
              { label: 'Tab 1', visibility: { reference: 'queries.data.data.count', operator: 'greaterThan', value: 5 } },
            ],
          },
        }),
      ]),
    )
    expect(result.status).toBe('ready')
  })

  it('accepts items with valid visibility using operator lessThan and params reference', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        createTabsNode({
          props: {
            items: [
              { label: 'Tab 1', visibility: { reference: 'queries.data.data.count', operator: 'lessThan', value: 10 } },
            ],
          },
        }),
      ]),
    )
    expect(result.status).toBe('ready')
  })

  it('accepts items with valid visibility using item.* reference', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        createTabsNode({
          props: {
            items: [
              { label: 'Tab 1', visibility: { reference: 'item.visible', operator: 'isTruthy' } },
            ],
          },
        }),
      ]),
    )
    expect(result.status).toBe('ready')
  })

  it('accepts item without visibility (regression: previous behavior unchanged)', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        createTabsNode({
          props: {
            items: [{ label: 'Tab 1' }, { label: 'Tab 2' }],
          },
        }),
      ]),
    )
    expect(result.status).toBe('ready')
  })

  it('accepts node-level visibility and item-level visibility simultaneously', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        createTabsNode({
          visibility: { reference: 'queries.someQuery.data.show', operator: 'isTruthy' },
          props: {
            items: [
              { label: 'Tab 1', visibility: { reference: 'forms.user.role', operator: 'equals', value: 'admin' } },
              { label: 'Tab 2' },
            ],
          },
        }),
      ]),
    )
    expect(result.status).toBe('ready')
  })

  it('rejects item with visibility.reference outside supported scope with path containing props.items[i].visibility.reference', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        createTabsNode({
          props: {
            items: [
              { label: 'Tab 1', visibility: { reference: 'foo.bar', operator: 'isTruthy' } },
            ],
          },
        }),
      ]),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.code).toBe('invalid-layout')
      expect(result.error.message).toContain('props.items[0].visibility.reference')
    }
  })

  it('rejects item with visibility.operator not in enum with path containing props.items[i].visibility.operator', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        createTabsNode({
          props: {
            items: [
              { label: 'Tab 1', visibility: { reference: 'forms.user.role', operator: 'contains' } },
            ],
          },
        }),
      ]),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.code).toBe('invalid-layout')
      expect(result.error.message).toContain('props.items[0].visibility.operator')
    }
  })

  it('rejects item with visibility.reference empty string with path containing props.items[i].visibility.reference', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        createTabsNode({
          props: {
            items: [
              { label: 'Tab 1', visibility: { reference: '', operator: 'isTruthy' } },
            ],
          },
        }),
      ]),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.code).toBe('invalid-layout')
      expect(result.error.message).toContain('props.items[0].visibility.reference')
    }
  })

  it('rejects item with isTruthy operator and value declared with path containing props.items[i].visibility.value', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        createTabsNode({
          props: {
            items: [
              { label: 'Tab 1', visibility: { reference: 'forms.user.role', operator: 'isTruthy', value: 'extra' } },
            ],
          },
        }),
      ]),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.code).toBe('invalid-layout')
      expect(result.error.message).toContain('props.items[0].visibility.value')
    }
  })

  it('rejects item with isFalsy operator and value declared with path containing props.items[i].visibility.value', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        createTabsNode({
          props: {
            items: [
              { label: 'Tab 1', visibility: { reference: 'forms.user.role', operator: 'isFalsy', value: true } },
            ],
          },
        }),
      ]),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.code).toBe('invalid-layout')
      expect(result.error.message).toContain('props.items[0].visibility.value')
    }
  })

  it('rejects item with equals operator and no value with path containing props.items[i].visibility.value', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        createTabsNode({
          props: {
            items: [
              { label: 'Tab 1', visibility: { reference: 'forms.user.role', operator: 'equals' } },
            ],
          },
        }),
      ]),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.code).toBe('invalid-layout')
      expect(result.error.message).toContain('props.items[0].visibility.value')
    }
  })

  it('rejects item with notEquals operator and no value with path containing props.items[i].visibility.value', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        createTabsNode({
          props: {
            items: [
              { label: 'Tab 1', visibility: { reference: 'forms.user.role', operator: 'notEquals' } },
            ],
          },
        }),
      ]),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.code).toBe('invalid-layout')
      expect(result.error.message).toContain('props.items[0].visibility.value')
    }
  })

  it('rejects item with greaterThan operator and no value with path containing props.items[i].visibility.value', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        createTabsNode({
          props: {
            items: [
              { label: 'Tab 1', visibility: { reference: 'queries.data.data.count', operator: 'greaterThan' } },
            ],
          },
        }),
      ]),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.code).toBe('invalid-layout')
      expect(result.error.message).toContain('props.items[0].visibility.value')
    }
  })

  it('rejects item with lessThan operator and no value with path containing props.items[i].visibility.value', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        createTabsNode({
          props: {
            items: [
              { label: 'Tab 1', visibility: { reference: 'queries.data.data.count', operator: 'lessThan' } },
            ],
          },
        }),
      ]),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.code).toBe('invalid-layout')
      expect(result.error.message).toContain('props.items[0].visibility.value')
    }
  })

  it('rejects item with equals operator and non-scalar value with error from validateVisibility', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        createTabsNode({
          props: {
            items: [
              { label: 'Tab 1', visibility: { reference: 'forms.user.role', operator: 'equals', value: { nested: true } } },
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

  it('rejects item with greaterThan operator and non-numeric value with error from validateVisibility', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        createTabsNode({
          props: {
            items: [
              { label: 'Tab 1', visibility: { reference: 'queries.data.data.count', operator: 'greaterThan', value: 'not-a-number' } },
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

  it('silently discards unsupported keys within item visibility (strip behavior)', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        createTabsNode({
          props: {
            items: [
              { label: 'Tab 1', visibility: { reference: 'forms.user.role', operator: 'isTruthy', unknownKey: 'ignored' } },
            ],
          },
        }),
      ]),
    )
    expect(result.status).toBe('ready')
  })

  it('reports error at second item when first item is valid and second has invalid visibility', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        createTabsNode({
          props: {
            items: [
              { label: 'Tab 1', visibility: { reference: 'forms.user.role', operator: 'isTruthy' } },
              { label: 'Tab 2', visibility: { reference: 'foo.bar', operator: 'isTruthy' } },
            ],
          },
        }),
      ]),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.code).toBe('invalid-layout')
      expect(result.error.message).toContain('props.items[1].visibility.reference')
    }
  })
})
