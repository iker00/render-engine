import { describe, expect, it } from 'vitest'
import { validateRuntimeConfig } from '../../config/runtime-config'
import { createConfigWithLayout } from './helpers'

function createAccordionNode(overrides: Record<string, unknown> = {}) {
  return {
    type: 'accordion',
    props: { label: 'Mi sección' },
    ...overrides,
  }
}

describe('validateRuntimeConfig — accordion node: acceptance', () => {
  it('accepts an accordion with only props.label declared', () => {
    const result = validateRuntimeConfig(createConfigWithLayout([createAccordionNode()]))
    expect(result.status).toBe('ready')
  })

  it('accepts props.defaultOpen: true', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([createAccordionNode({ props: { label: 'Sección', defaultOpen: true } })]),
    )
    expect(result.status).toBe('ready')
  })

  it('accepts props.defaultOpen: false', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([createAccordionNode({ props: { label: 'Sección', defaultOpen: false } })]),
    )
    expect(result.status).toBe('ready')
  })

  it('accepts props.groupId: "group-a"', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([createAccordionNode({ props: { label: 'Sección', groupId: 'group-a' } })]),
    )
    expect(result.status).toBe('ready')
  })

  it('accepts children: [] (empty array)', () => {
    const result = validateRuntimeConfig(createConfigWithLayout([createAccordionNode({ children: [] })]))
    expect(result.status).toBe('ready')
  })

  it('accepts children with valid catalog nodes (heading, paragraph, container, form, button)', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        createAccordionNode({
          children: [
            { type: 'heading', props: { text: 'Título', level: 2 } },
            { type: 'paragraph', props: { text: 'Cuerpo del acordeón' } },
            { type: 'container', children: [] },
            { type: 'form', id: 'my-form', children: [] },
            { type: 'button', props: { label: 'Acción' } },
          ],
        }),
      ]),
    )
    expect(result.status).toBe('ready')
  })

  it('accepts accordion inside container.children', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([{ type: 'container', children: [createAccordionNode()] }]),
    )
    expect(result.status).toBe('ready')
  })

  it('accepts accordion inside repeater.props.template', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        {
          type: 'repeater',
          props: {
            items: { source: 'queries.list.data', key: 'id' },
            template: [createAccordionNode()],
          },
        },
      ]),
    )
    expect(result.status).toBe('ready')
  })

  it('accepts accordion inside form.children', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([{ type: 'form', id: 'my-form', children: [createAccordionNode()] }]),
    )
    expect(result.status).toBe('ready')
  })

  it('accepts accordion inside modal.children', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([{ type: 'modal', id: 'my-modal', children: [createAccordionNode()] }]),
    )
    expect(result.status).toBe('ready')
  })

  it('accepts visibility and queryStateFeedback with standard semantics', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        createAccordionNode({
          visibility: { reference: 'queries.q.status', operator: 'equals', value: 'success' },
          queryStateFeedback: { query: 'q' },
        }),
      ]),
    )
    expect(result.status).toBe('ready')
  })

  it('accepts layout.span valid value', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([createAccordionNode({ layout: { span: 6 } })]),
    )
    expect(result.status).toBe('ready')
  })
})

describe('validateRuntimeConfig — accordion node: rejection', () => {
  it('rejects an accordion without props.label — error contains props.label', () => {
    const result = validateRuntimeConfig(createConfigWithLayout([{ type: 'accordion', props: {} }]))
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('props.label')
    }
  })

  it('rejects props.label: "" (empty string) — error contains props.label', () => {
    const result = validateRuntimeConfig(createConfigWithLayout([createAccordionNode({ props: { label: '' } })]))
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('props.label')
    }
  })

  it('rejects props.defaultOpen: "true" (string, not boolean) — error contains props.defaultOpen', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([createAccordionNode({ props: { label: 'Sección', defaultOpen: 'true' } })]),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('props.defaultOpen')
    }
  })

  it('rejects props.defaultOpen: 1 (number, not boolean) — error contains props.defaultOpen', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([createAccordionNode({ props: { label: 'Sección', defaultOpen: 1 } })]),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('props.defaultOpen')
    }
  })

  it('rejects props.groupId: 42 (number, not string) — error contains props.groupId', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([createAccordionNode({ props: { label: 'Sección', groupId: 42 } })]),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('props.groupId')
    }
  })

  it('rejects children with an unknown node type — error code is unsupported-node-type', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([createAccordionNode({ children: [{ type: 'unknown-widget' }] })]),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.code).toBe('unsupported-node-type')
    }
  })
})
