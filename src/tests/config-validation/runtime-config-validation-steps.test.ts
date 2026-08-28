import { describe, expect, it } from 'vitest'
import { validateRuntimeConfig } from '../../config/runtime-config'
import { createConfigWithLayout, createConfigWithFormLayout } from './helpers'

function createStepsNode(overrides: Record<string, unknown> = {}) {
  return {
    type: 'steps',
    props: {
      items: [{ label: 'Step 1' }],
    },
    ...overrides,
  }
}

function createStepsFormConfig(stepsOverrides: Record<string, unknown> = {}) {
  return createConfigWithFormLayout({
    children: [createStepsNode(stepsOverrides)],
  })
}

describe('validateRuntimeConfig — steps node shape', () => {
  it('accepts a steps node with one item without children (inside a form)', () => {
    const result = validateRuntimeConfig(createStepsFormConfig())
    expect(result.status).toBe('ready')
  })

  it('accepts a steps node with variant horizontal, vertical or progress', () => {
    for (const variant of ['horizontal', 'vertical', 'progress']) {
      const result = validateRuntimeConfig(
        createStepsFormConfig({ props: { items: [{ label: 'Step 1' }], variant } }),
      )
      expect(result.status).toBe('ready')
    }
  })

  it('accepts a steps node without variant (optional field)', () => {
    const result = validateRuntimeConfig(createStepsFormConfig())
    expect(result.status).toBe('ready')
  })

  it('accepts a steps node with backLabel, nextLabel and submitLabel as strings', () => {
    const result = validateRuntimeConfig(
      createStepsFormConfig({
        props: {
          items: [{ label: 'Step 1' }],
          backLabel: 'Atrás',
          nextLabel: 'Siguiente',
          submitLabel: 'Enviar',
        },
      }),
    )
    expect(result.status).toBe('ready')
  })

  it('accepts a steps node with children containing valid nodes (heading, paragraph, container)', () => {
    const result = validateRuntimeConfig(
      createStepsFormConfig({
        props: {
          items: [
            {
              label: 'Step 1',
              children: [{ type: 'heading', props: { text: 'Hello', level: 1 } }],
            },
            {
              label: 'Step 2',
              children: [{ type: 'paragraph', props: { text: 'World' } }],
            },
          ],
        },
      }),
    )
    expect(result.status).toBe('ready')
  })

  it('accepts a steps node with visibility, queryStateFeedback and layout.span', () => {
    const result = validateRuntimeConfig(
      createStepsFormConfig({
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
    )
    expect(result.status).toBe('ready')
  })

  it('rejects a steps node without props.items with code invalid-layout and path including props.items', () => {
    const result = validateRuntimeConfig(createStepsFormConfig({ props: {} }))
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.code).toBe('invalid-layout')
      expect(result.error.message).toContain('props.items')
    }
  })

  it('rejects a steps node with props.items as empty array with code invalid-layout and path including props.items', () => {
    const result = validateRuntimeConfig(createStepsFormConfig({ props: { items: [] } }))
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.code).toBe('invalid-layout')
      expect(result.error.message).toContain('props.items')
    }
  })

  it('rejects a steps item without label with code invalid-layout and path including index and .label', () => {
    const result = validateRuntimeConfig(createStepsFormConfig({ props: { items: [{ children: [] }] } }))
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.code).toBe('invalid-layout')
      expect(result.error.message).toContain('items[0]')
      expect(result.error.message).toContain('label')
    }
  })

  it('rejects props.variant with a value outside the enum with code invalid-layout and path including props.variant', () => {
    const result = validateRuntimeConfig(
      createStepsFormConfig({ props: { items: [{ label: 'Step 1' }], variant: 'diagonal' } }),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.code).toBe('invalid-layout')
      expect(result.error.message).toContain('props.variant')
    }
  })

  it('rejects props.backLabel with a non-string value', () => {
    const result = validateRuntimeConfig(
      createStepsFormConfig({ props: { items: [{ label: 'Step 1' }], backLabel: 42 } }),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.code).toBe('invalid-layout')
    }
  })

  it('rejects props.nextLabel with a non-string value', () => {
    const result = validateRuntimeConfig(
      createStepsFormConfig({ props: { items: [{ label: 'Step 1' }], nextLabel: true } }),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.code).toBe('invalid-layout')
    }
  })

  it('rejects props.submitLabel with a non-string value', () => {
    const result = validateRuntimeConfig(
      createStepsFormConfig({ props: { items: [{ label: 'Step 1' }], submitLabel: { text: 'Send' } } }),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.code).toBe('invalid-layout')
    }
  })

  it('rejects children of an item containing a node with unknown type with code unsupported-node-type', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        createStepsNode({
          props: {
            items: [
              {
                label: 'Step 1',
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

  it('rejects children of an item containing a structurally invalid node with code invalid-layout and path including props.items[N].children', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        createStepsNode({
          props: {
            items: [
              {
                label: 'Step 1',
                children: [{ type: 'heading', props: {} }],
              },
            ],
          },
        }),
      ]),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.code).toBe('invalid-layout')
      expect(result.error.message).toContain('props.items[0].children[0]')
    }
  })

  it('rejects a steps node declared outside of a form node with the descendant-of-form message', () => {
    const result = validateRuntimeConfig(createConfigWithLayout([createStepsNode()]))
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.code).toBe('invalid-layout')
      expect(result.error.message).toContain('steps nodes must be descendants of a form node.')
    }
  })
})

describe('validateRuntimeConfig — steps inside form', () => {
  it('accepts a steps node declared directly in form.children', () => {
    const result = validateRuntimeConfig(createStepsFormConfig())
    expect(result.status).toBe('ready')
  })

  it('accepts a steps node nested inside form.children[].container.children', () => {
    const result = validateRuntimeConfig(
      createConfigWithFormLayout({
        children: [{ type: 'container', children: [createStepsNode()] }],
      }),
    )
    expect(result.status).toBe('ready')
  })

  it('rejects a duplicate fieldId between a field inside steps.props.items[0].children and a sibling field outside steps in the same form', () => {
    const result = validateRuntimeConfig(
      createConfigWithFormLayout({
        children: [
          { type: 'input', props: { fieldId: 'email', label: 'Email' } },
          createStepsNode({
            props: {
              items: [
                {
                  label: 'Step 1',
                  children: [{ type: 'input', props: { fieldId: 'email', label: 'Email again' } }],
                },
              ],
            },
          }),
        ],
      }),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.code).toBe('invalid-layout')
      expect(result.error.message).toContain('duplicate fieldId "email"')
    }
  })

  it('rejects a duplicate fieldId between two distinct items of the same steps node within the same form', () => {
    const result = validateRuntimeConfig(
      createConfigWithFormLayout({
        children: [
          createStepsNode({
            props: {
              items: [
                {
                  label: 'Step 1',
                  children: [{ type: 'input', props: { fieldId: 'email', label: 'Email' } }],
                },
                {
                  label: 'Step 2',
                  children: [{ type: 'input', props: { fieldId: 'email', label: 'Email duplicate' } }],
                },
              ],
            },
          }),
        ],
      }),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.code).toBe('invalid-layout')
      expect(result.error.message).toContain('duplicate fieldId "email"')
    }
  })
})

describe('validateRuntimeConfig — steps item onNext', () => {
  it('accepts a steps item with onNext declaring only operationName', () => {
    const result = validateRuntimeConfig(
      createStepsFormConfig({
        props: {
          items: [{ label: 'Step 1', onNext: { operationName: 'submitUserForm' } }],
        },
      }),
    )
    expect(result.status).toBe('ready')
  })

  it('accepts a steps item with onNext declaring operationName, query, body and headers', () => {
    const result = validateRuntimeConfig(
      createStepsFormConfig({
        props: {
          items: [
            {
              label: 'Step 1',
              onNext: {
                operationName: 'submitUserForm',
                query: { page: 1 },
                body: { note: 'ok' },
                headers: { 'X-Trace': 'abc' },
              },
            },
          ],
        },
      }),
    )
    expect(result.status).toBe('ready')
  })

  it('rejects a steps item onNext without operationName', () => {
    const result = validateRuntimeConfig(
      createStepsFormConfig({
        props: { items: [{ label: 'Step 1', onNext: {} }] },
      }),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.code).toBe('invalid-layout')
      expect(result.error.message).toContain('items[0].onNext')
    }
  })

  it('rejects a steps item onNext with an empty operationName', () => {
    const result = validateRuntimeConfig(
      createStepsFormConfig({
        props: { items: [{ label: 'Step 1', onNext: { operationName: '' } }] },
      }),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.code).toBe('invalid-layout')
      expect(result.error.message).toContain('items[0].onNext')
    }
  })

  it('rejects a steps item onNext.operationName that does not exist in api', () => {
    const result = validateRuntimeConfig(
      createStepsFormConfig({
        props: { items: [{ label: 'Step 1', onNext: { operationName: 'unknownOperation' } }] },
      }),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.code).toBe('invalid-layout')
      expect(result.error.message).toContain('unknown operation "unknownOperation"')
    }
  })

  it('rejects a steps item onNext with body when the referenced operation is GET', () => {
    const result = validateRuntimeConfig(
      createConfigWithFormLayout(
        {
          children: [
            createStepsNode({
              props: {
                items: [{ label: 'Step 1', onNext: { operationName: 'loadNextStep', body: { note: 'ok' } } }],
              },
            }),
          ],
        },
        { api: { loadNextStep: { method: 'GET', endpoint: '/api/next-step' } } },
      ),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.code).toBe('invalid-layout')
      expect(result.error.message).toContain('GET operations do not support body')
    }
  })

  it('accepts a steps item onNext without body when the referenced operation is GET', () => {
    const result = validateRuntimeConfig(
      createConfigWithFormLayout(
        {
          children: [
            createStepsNode({
              props: {
                items: [{ label: 'Step 1', onNext: { operationName: 'loadNextStep' } }],
              },
            }),
          ],
        },
        { api: { loadNextStep: { method: 'GET', endpoint: '/api/next-step' } } },
      ),
    )
    expect(result.status).toBe('ready')
  })
})
