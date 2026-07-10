import { describe, expect, it } from 'vitest'
import { validateRuntimeConfig } from '../../config/runtime-config'
import { createConfigWithLayout, createConfigWithPages, createVisibilityRule } from './helpers'

function createModalNode(overrides: Record<string, unknown> = {}) {
  return {
    type: 'modal',
    id: 'my-modal',
    ...overrides,
  }
}

describe('validateRuntimeConfig — modal node shape', () => {
  it('accepts a modal at root layout level', () => {
    const result = validateRuntimeConfig(createConfigWithLayout([createModalNode()]))
    expect(result.status).toBe('ready')
  })

  it('accepts a modal inside container.children', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        { type: 'container', children: [createModalNode()] },
      ]),
    )
    expect(result.status).toBe('ready')
  })

  it('accepts a modal as root of repeater.props.template', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        {
          type: 'repeater',
          props: {
            items: { source: 'queries.list.data', key: 'id' },
            template: [createModalNode()],
          },
        },
      ]),
    )
    expect(result.status).toBe('ready')
  })

  it('accepts a modal with an empty children array', () => {
    const result = validateRuntimeConfig(createConfigWithLayout([createModalNode({ children: [] })]))
    expect(result.status).toBe('ready')
  })

  it('accepts a modal with all valid props', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([createModalNode({ props: { size: 'lg', defaultOpen: true } })]),
    )
    expect(result.status).toBe('ready')
  })

  it('accepts a modal with props.label as a non-empty string', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([createModalNode({ props: { label: 'Confirmar eliminación' } })]),
    )
    expect(result.status).toBe('ready')
    if (result.status === 'ready') {
      const modal = result.config.pages[0].layout[0] as { props?: { label?: string } }
      expect(modal.props?.label).toBe('Confirmar eliminación')
    }
  })

  it('accepts a modal without props.label and does not add the field', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([createModalNode({ props: { size: 'md' } })]),
    )
    expect(result.status).toBe('ready')
    if (result.status === 'ready') {
      const modal = result.config.pages[0].layout[0] as { props?: { label?: string } }
      expect(modal.props?.label).toBeUndefined()
    }
  })

  it('rejects a modal with props.label as a number', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([createModalNode({ props: { label: 42 } })]),
    )
    expect(result).toEqual({
      status: 'error',
      error: {
        code: 'invalid-layout',
        displayMode: 'development-only',
        message: `Page "home" has an invalid layout at "layout[0].props.label".
  → modal("my-modal")
  Node: {"type":"modal","id":"my-modal"}`,
      },
    })
  })

  it('rejects a modal with props.label as a boolean', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([createModalNode({ props: { label: true } })]),
    )
    expect(result).toEqual({
      status: 'error',
      error: {
        code: 'invalid-layout',
        displayMode: 'development-only',
        message: `Page "home" has an invalid layout at "layout[0].props.label".
  → modal("my-modal")
  Node: {"type":"modal","id":"my-modal"}`,
      },
    })
  })

  it('accepts a modal with size sm, md and lg', () => {
    for (const size of ['sm', 'md', 'lg']) {
      const result = validateRuntimeConfig(createConfigWithLayout([createModalNode({ props: { size } })]))
      expect(result.status).toBe('ready')
    }
  })

  it('accepts a modal with valid child node types', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        createModalNode({
          children: [
            { type: 'heading', props: { text: 'Title', level: 2 } },
            { type: 'paragraph', props: { text: 'Body' } },
            {
              type: 'button',
              props: { label: 'Close', action: { type: 'closeModal', modalId: 'my-modal' } },
            },
          ],
        }),
      ]),
    )
    expect(result.status).toBe('ready')
  })

  it('accepts a modal with visibility', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([createModalNode({ visibility: createVisibilityRule() })]),
    )
    expect(result.status).toBe('ready')
  })

  it('accepts a modal with queryStateFeedback', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        createModalNode({
          queryStateFeedback: { query: 'queries.data', states: { loading: { mode: 'hide' } } },
        }),
      ]),
    )
    expect(result.status).toBe('ready')
  })

  it('accepts a modal with defaultOpen: true outside a repeater', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([createModalNode({ props: { defaultOpen: true } })]),
    )
    expect(result.status).toBe('ready')
  })

  it('accepts a button outside the modal that closes it via closeModal', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        createModalNode(),
        { type: 'button', props: { label: 'Close', action: { type: 'closeModal', modalId: 'my-modal' } } },
      ]),
    )
    expect(result.status).toBe('ready')
  })

  it('rejects a modal without id', () => {
    const result = validateRuntimeConfig(createConfigWithLayout([{ type: 'modal' }]))
    expect(result).toEqual({
      status: 'error',
      error: {
        code: 'invalid-layout',
        displayMode: 'development-only',
        message: `Page "home" has an invalid layout at "layout[0].id".
  → modal[0]
  Node: {"type":"modal"}`,
      },
    })
  })

  it('rejects a modal with an empty id', () => {
    const result = validateRuntimeConfig(createConfigWithLayout([{ type: 'modal', id: '   ' }]))
    expect(result).toEqual({
      status: 'error',
      error: {
        code: 'invalid-layout',
        displayMode: 'development-only',
        message: `Page "home" has an invalid layout at "layout[0].id".
  → modal("   ")
  Node: {"type":"modal","id":"   "}`,
      },
    })
  })

  it('rejects a modal with a non-string id', () => {
    const result = validateRuntimeConfig(createConfigWithLayout([{ type: 'modal', id: 42 }]))
    expect(result).toEqual({
      status: 'error',
      error: {
        code: 'invalid-layout',
        displayMode: 'development-only',
        message: `Page "home" has an invalid layout at "layout[0].id".
  → modal[0]
  Node: {"type":"modal"}`,
      },
    })
  })

  it('rejects a modal with props.size outside the catalog', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([createModalNode({ props: { size: 'xl' } })]),
    )
    expect(result).toEqual({
      status: 'error',
      error: {
        code: 'invalid-layout',
        displayMode: 'development-only',
        message: `Page "home" has an invalid layout at "layout[0].props.size".
  → modal("my-modal")
  Node: {"type":"modal","id":"my-modal"}`,
      },
    })
  })

  it('rejects a modal with props.defaultOpen as non-boolean', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([createModalNode({ props: { defaultOpen: 'yes' } })]),
    )
    expect(result).toEqual({
      status: 'error',
      error: {
        code: 'invalid-layout',
        displayMode: 'development-only',
        message: `Page "home" has an invalid layout at "layout[0].props.defaultOpen".
  → modal("my-modal")
  Node: {"type":"modal","id":"my-modal"}`,
      },
    })
  })

  it('rejects a modal with a disallowed child type (input outside form)', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        createModalNode({
          children: [{ type: 'input', props: { fieldId: 'name', label: 'Name' } }],
        }),
      ]),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.code).toBe('invalid-layout')
      expect(result.error.message).toContain('layout[0].children[0]')
    }
  })

  it('rejects a modal with invalid visibility reference', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        createModalNode({ visibility: { reference: 'bad--ref', operator: 'isTruthy' } }),
      ]),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.code).toBe('invalid-layout')
      expect(result.error.message).toContain('layout[0].visibility')
    }
  })

  it('rejects a modal with invalid queryStateFeedback query', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        createModalNode({ queryStateFeedback: { query: '' } }),
      ]),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.code).toBe('invalid-layout')
      expect(result.error.message).toContain('layout[0].queryStateFeedback')
    }
  })
})

describe('validateRuntimeConfig — modal cross-validation', () => {
  it('rejects duplicate modal id across pages', () => {
    const result = validateRuntimeConfig(
      createConfigWithPages([
        { id: 'home', layout: [createModalNode()] },
        { id: 'details', layout: [createModalNode()] },
      ]),
    )
    expect(result).toEqual({
      status: 'error',
      error: {
        code: 'invalid-layout',
        displayMode: 'development-only',
        message: `Page "details" has an invalid layout at "layout[0].id": duplicate modal id "my-modal".
  → modal("my-modal")
  Node: {"type":"modal","id":"my-modal"}`,
      },
    })
  })

  it('rejects duplicate modal id within the same page', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([createModalNode(), createModalNode()]),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('duplicate modal id "my-modal"')
    }
  })

  it('rejects openModal.modalId referencing a non-existent modal', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        {
          type: 'button',
          props: {
            label: 'Open',
            action: { type: 'openModal', modalId: 'missing-modal' },
          },
        },
      ]),
    )
    expect(result).toEqual({
      status: 'error',
      error: {
        code: 'invalid-layout',
        displayMode: 'development-only',
        message: `Page "home" has an invalid layout at "layout[0].props.action.modalId": unknown modal "missing-modal".
  → button("Open")
  Node: {"type":"button","props":{"label":"Open"}}`,
      },
    })
  })

  it('rejects closeModal.modalId referencing a non-existent modal', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        {
          type: 'button',
          props: {
            label: 'Close',
            action: { type: 'closeModal', modalId: 'gone' },
          },
        },
      ]),
    )
    expect(result).toEqual({
      status: 'error',
      error: {
        code: 'invalid-layout',
        displayMode: 'development-only',
        message: `Page "home" has an invalid layout at "layout[0].props.action.modalId": unknown modal "gone".
  → button("Close")
  Node: {"type":"button","props":{"label":"Close"}}`,
      },
    })
  })

  it('rejects modal.props.defaultOpen: true inside repeater.props.template', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        {
          type: 'repeater',
          props: {
            items: { source: 'queries.list.data', key: 'id' },
            template: [createModalNode({ props: { defaultOpen: true } })],
          },
        },
      ]),
    )
    expect(result).toEqual({
      status: 'error',
      error: {
        code: 'invalid-layout',
        displayMode: 'development-only',
        message:
          `Page "home" has an invalid layout at "layout[0].props.template[0].props.defaultOpen": modal defaultOpen is not supported inside a repeater template.
  → repeater[0] > modal("my-modal")
  Node: {"type":"modal","id":"my-modal"}`,
      },
    })
  })

  it('rejects modal.props.defaultOpen: true nested inside a container that is inside a repeater template', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        {
          type: 'repeater',
          props: {
            items: { source: 'queries.list.data', key: 'id' },
            template: [
              {
                type: 'container',
                children: [createModalNode({ props: { defaultOpen: true } })],
              },
            ],
          },
        },
      ]),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('modal defaultOpen is not supported inside a repeater template')
    }
  })

  it('accepts openModal button and the referenced modal in the same config', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        createModalNode(),
        {
          type: 'button',
          props: { label: 'Open', action: { type: 'openModal', modalId: 'my-modal' } },
        },
      ]),
    )
    expect(result.status).toBe('ready')
  })

  it('accepts openModal referencing a modal on a different page', () => {
    const result = validateRuntimeConfig(
      createConfigWithPages([
        {
          id: 'home',
          layout: [
            {
              type: 'button',
              props: { label: 'Open', action: { type: 'openModal', modalId: 'modal-on-details' } },
            },
          ],
        },
        {
          id: 'details',
          layout: [{ type: 'modal', id: 'modal-on-details' }],
        },
      ]),
    )
    expect(result.status).toBe('ready')
  })
})

// ─── Second-pass breadcrumb enrichment tests ─────────────────────────────────

describe('validateRuntimeConfig — second-pass modal errors include breadcrumb', () => {
  it('duplicate modal id includes breadcrumb of the modal node', () => {
    const result = validateRuntimeConfig(
      createConfigWithPages([
        { id: 'home', layout: [createModalNode()] },
        { id: 'details', layout: [createModalNode()] },
      ]),
    )
    expect(result.status).toBe('error')
    if (result.status !== 'error') throw new Error('Expected error')
    expect(result.error.message).toContain('duplicate modal id "my-modal"')
    expect(result.error.message).toContain('\n  → ')
    expect(result.error.message).toContain('modal("my-modal")')
    expect(result.error.message).toContain('\n  Node: ')
    expect(result.error.message).toContain('"type":"modal"')
  })

  it('openModal referencing unknown modal includes breadcrumb of the button', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        {
          type: 'button',
          props: {
            label: 'Open missing',
            action: { type: 'openModal', modalId: 'missing-modal' },
          },
        },
      ]),
    )
    expect(result.status).toBe('error')
    if (result.status !== 'error') throw new Error('Expected error')
    expect(result.error.message).toContain('unknown modal "missing-modal"')
    expect(result.error.message).toContain('\n  → ')
    expect(result.error.message).toContain('button("Open missing")')
    expect(result.error.message).toContain('\n  Node: ')
    expect(result.error.message).toContain('"type":"button"')
  })

  it('defaultOpen in repeater template includes breadcrumb with repeater > modal ancestors', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        {
          type: 'repeater',
          props: {
            items: { source: 'queries.list.data', key: 'id' },
            template: [{ type: 'modal', id: 'rep-modal', props: { defaultOpen: true } }],
          },
        },
      ]),
    )
    expect(result.status).toBe('error')
    if (result.status !== 'error') throw new Error('Expected error')
    expect(result.error.message).toContain('modal defaultOpen is not supported inside a repeater template')
    expect(result.error.message).toContain('\n  → ')
    expect(result.error.message).toContain('repeater[0]')
    expect(result.error.message).toContain('modal("rep-modal")')
    expect(result.error.message).toContain('\n  Node: ')
    expect(result.error.message).toContain('"type":"modal"')
  })

  it('closeModal referencing unknown modal includes breadcrumb of the button', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        {
          type: 'button',
          props: {
            label: 'Close missing',
            action: { type: 'closeModal', modalId: 'gone' },
          },
        },
      ]),
    )
    expect(result.status).toBe('error')
    if (result.status !== 'error') throw new Error('Expected error')
    expect(result.error.message).toContain('unknown modal "gone"')
    expect(result.error.message).toContain('\n  → ')
    expect(result.error.message).toContain('button("Close missing")')
    expect(result.error.message).toContain('\n  Node: ')
  })
})
