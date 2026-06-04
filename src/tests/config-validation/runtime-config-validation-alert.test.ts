import { describe, expect, it } from 'vitest'
import { validateRuntimeConfig } from '../../config/runtime-config'
import { createConfigWithLayout } from './helpers'

function createAlertNode(overrides: Record<string, unknown> = {}) {
  return {
    type: 'alert',
    props: { message: 'Mensaje de alerta' },
    ...overrides,
  }
}

describe('validateRuntimeConfig — alert node: acceptance', () => {
  it('accepts a minimal alert with only type and props.message (no props.type, defaults to neutral)', () => {
    const result = validateRuntimeConfig(createConfigWithLayout([createAlertNode()]))
    expect(result.status).toBe('ready')
  })

  it('accepts alert with props.type: "neutral"', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([createAlertNode({ props: { message: 'Msg', type: 'neutral' } })]),
    )
    expect(result.status).toBe('ready')
  })

  it('accepts alert with props.type: "primary"', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([createAlertNode({ props: { message: 'Msg', type: 'primary' } })]),
    )
    expect(result.status).toBe('ready')
  })

  it('accepts alert with props.type: "success"', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([createAlertNode({ props: { message: 'Msg', type: 'success' } })]),
    )
    expect(result.status).toBe('ready')
  })

  it('accepts alert with props.type: "warning"', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([createAlertNode({ props: { message: 'Msg', type: 'warning' } })]),
    )
    expect(result.status).toBe('ready')
  })

  it('accepts alert with props.type: "danger"', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([createAlertNode({ props: { message: 'Msg', type: 'danger' } })]),
    )
    expect(result.status).toBe('ready')
  })

  it('accepts alert with props.type: "info"', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([createAlertNode({ props: { message: 'Msg', type: 'info' } })]),
    )
    expect(result.status).toBe('ready')
  })

  it('accepts alert with optional props.title present as string', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([createAlertNode({ props: { message: 'Msg', title: 'Título' } })]),
    )
    expect(result.status).toBe('ready')
  })

  it('accepts alert without props.title declared', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([createAlertNode({ props: { message: 'Msg' } })]),
    )
    expect(result.status).toBe('ready')
  })

  it('accepts alert with props.message containing a placeholder {{queries.foo.data}}', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([createAlertNode({ props: { message: '{{queries.foo.data}}' } })]),
    )
    expect(result.status).toBe('ready')
  })

  it('accepts alert with props.title containing a placeholder {{forms.f.field}}', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([createAlertNode({ props: { message: 'Msg', title: '{{forms.f.field}}' } })]),
    )
    expect(result.status).toBe('ready')
  })

  it('accepts alert with visibility, queryStateFeedback and layout.span declared', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        createAlertNode({
          visibility: { reference: 'queries.q.status', operator: 'equals', value: 'success' },
          queryStateFeedback: { query: 'q' },
          layout: { span: 6 },
        }),
      ]),
    )
    expect(result.status).toBe('ready')
  })

  it('accepts alert with children declared in raw input — result does not include children (leaf node)', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        createAlertNode({ children: [{ type: 'paragraph', props: { text: 'ignored' } }] }),
      ]),
    )
    expect(result.status).toBe('ready')
    if (result.status === 'ready') {
      const alertNode = result.page.layout[0] as Record<string, unknown>
      expect(alertNode.children).toBeUndefined()
    }
  })
})

describe('validateRuntimeConfig — alert node: normalized output', () => {
  it('a valid full alert passes validation and returns the node with all fields normalized', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        createAlertNode({ props: { message: 'Alerta de prueba', type: 'danger', title: 'Cabecera' } }),
      ]),
    )
    expect(result.status).toBe('ready')
    if (result.status === 'ready') {
      const node = result.page.layout[0] as Record<string, unknown>
      expect(node.type).toBe('alert')
      const props = node.props as Record<string, unknown>
      expect(props.message).toBe('Alerta de prueba')
      expect(props.type).toBe('danger')
      expect(props.title).toBe('Cabecera')
    }
  })

  it('normalized node has props.type equal to the declared value (not the default)', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        createAlertNode({ props: { message: 'Msg', type: 'success' } }),
      ]),
    )
    expect(result.status).toBe('ready')
    if (result.status === 'ready') {
      const node = result.page.layout[0] as Record<string, unknown>
      const props = node.props as Record<string, unknown>
      expect(props.type).toBe('success')
    }
  })

  it('normalized node has props.title only when declared', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        createAlertNode({ props: { message: 'Msg' } }),
      ]),
    )
    expect(result.status).toBe('ready')
    if (result.status === 'ready') {
      const node = result.page.layout[0] as Record<string, unknown>
      const props = node.props as Record<string, unknown>
      expect(props.title).toBeUndefined()
    }
  })

  it('normalized node has props.message equal to the declared string', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        createAlertNode({ props: { message: 'Mensaje específico' } }),
      ]),
    )
    expect(result.status).toBe('ready')
    if (result.status === 'ready') {
      const node = result.page.layout[0] as Record<string, unknown>
      const props = node.props as Record<string, unknown>
      expect(props.message).toBe('Mensaje específico')
    }
  })
})

describe('validateRuntimeConfig — alert node: rejection', () => {
  it('rejects alert without props.message even when props.title is present — error contains props.message', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([createAlertNode({ props: { title: 'Título' } })]),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('props.message')
    }
  })

  it('error for invalid props.type points exactly to the path {path}.props.type', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([createAlertNode({ props: { message: 'Msg', type: 'invalid-type' } })]),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('layout[0].props.type')
    }
  })

  it('rejects alert without props.message — error contains props.message', () => {
    const result = validateRuntimeConfig(createConfigWithLayout([{ type: 'alert', props: {} }]))
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('props.message')
    }
  })

  it('rejects alert with props.message as number — error contains props.message', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([createAlertNode({ props: { message: 42 } })]),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('props.message')
    }
  })

  it('rejects alert with props.type value outside catalog ("error") — error contains props.type', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([createAlertNode({ props: { message: 'Msg', type: 'error' } })]),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('props.type')
    }
  })

  it('rejects alert with props.type value outside catalog ("warn") — error contains props.type', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([createAlertNode({ props: { message: 'Msg', type: 'warn' } })]),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('props.type')
    }
  })

  it('rejects alert with props.title as number — error contains props.title', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([createAlertNode({ props: { message: 'Msg', title: 123 } })]),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('props.title')
    }
  })

  it('rejects alert with invalid layout.span — error contains layout.span', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([createAlertNode({ layout: { span: 99 } })]),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('layout.span')
    }
  })
})
