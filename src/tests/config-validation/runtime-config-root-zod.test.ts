import { describe, expect, it } from 'vitest'
import devConfig from '../../dev/config.json'
import { runtimeConfigRootSchema } from '../../config/runtime-config-root-zod'
import { openModalRuntimeUiActionSchema, closeModalRuntimeUiActionSchema } from '../../config/runtime-config-zod'
import { validateRuntimeConfig } from '../../config/runtime-config'

describe('runtimeConfigRootSchema', () => {
  it('accepts src/dev/config.json without errors', () => {
    const result = runtimeConfigRootSchema.safeParse(devConfig)
    expect(result.success).toBe(true)
  })

  it('accepts a minimal valid config', () => {
    const result = runtimeConfigRootSchema.safeParse({
      api: {},
      pages: [{ id: 'home', layout: [] }],
      initialPage: 'home',
    })
    expect(result.success).toBe(true)
  })

  it('rejects pages as non-array', () => {
    const result = runtimeConfigRootSchema.safeParse({
      api: {},
      pages: 'not-an-array',
      initialPage: 'home',
    })
    expect(result.success).toBe(false)
  })

  it('rejects empty initialPage string', () => {
    const result = runtimeConfigRootSchema.safeParse({
      api: {},
      pages: [],
      initialPage: '',
    })
    expect(result.success).toBe(false)
  })

  it('rejects unsupported node type in pages layout', () => {
    const result = runtimeConfigRootSchema.safeParse({
      api: {},
      pages: [{ id: 'home', layout: [{ type: 'unknown-widget', props: {} }] }],
      initialPage: 'home',
    })
    expect(result.success).toBe(false)
  })

  it('accepts container.children with two levels of nesting', () => {
    const result = runtimeConfigRootSchema.safeParse({
      api: {},
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'container',
              children: [
                {
                  type: 'container',
                  children: [{ type: 'heading', props: { text: 'Nested', level: 2 } }],
                },
              ],
            },
          ],
        },
      ],
      initialPage: 'home',
    })
    expect(result.success).toBe(true)
  })

  it('accepts repeater.template with nested container.children at two levels', () => {
    const result = runtimeConfigRootSchema.safeParse({
      api: {},
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'repeater',
              props: {
                items: { source: 'queries.data', key: 'id' },
                template: [
                  {
                    type: 'container',
                    children: [{ type: 'paragraph', props: { text: 'item.name' } }],
                  },
                ],
              },
            },
          ],
        },
      ],
      initialPage: 'home',
    })
    expect(result.success).toBe(true)
  })

  it('accepts form.children with nested container and input at two levels', () => {
    const result = runtimeConfigRootSchema.safeParse({
      api: {},
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'form',
              id: 'myForm',
              children: [
                {
                  type: 'container',
                  children: [{ type: 'input', props: { fieldId: 'username', label: 'Username' } }],
                },
              ],
            },
          ],
        },
      ],
      initialPage: 'home',
    })
    expect(result.success).toBe(true)
  })
})

describe('runtimeConfigRootSchema — modal node shape', () => {
  it('accepts a minimal modal node with a valid id', () => {
    const result = runtimeConfigRootSchema.safeParse({
      api: {},
      pages: [{ id: 'home', layout: [{ type: 'modal', id: 'my-modal' }] }],
      initialPage: 'home',
    })
    expect(result.success).toBe(true)
  })

  it('accepts modal with all valid props', () => {
    const result = runtimeConfigRootSchema.safeParse({
      api: {},
      pages: [
        {
          id: 'home',
          layout: [{ type: 'modal', id: 'my-modal', props: { size: 'lg', defaultOpen: true } }],
        },
      ],
      initialPage: 'home',
    })
    expect(result.success).toBe(true)
  })

  it('accepts modal with props.size sm, md and lg', () => {
    for (const size of ['sm', 'md', 'lg']) {
      const result = runtimeConfigRootSchema.safeParse({
        api: {},
        pages: [{ id: 'home', layout: [{ type: 'modal', id: 'my-modal', props: { size } }] }],
        initialPage: 'home',
      })
      expect(result.success).toBe(true)
    }
  })

  it('accepts modal without props', () => {
    const result = runtimeConfigRootSchema.safeParse({
      api: {},
      pages: [{ id: 'home', layout: [{ type: 'modal', id: 'dialog' }] }],
      initialPage: 'home',
    })
    expect(result.success).toBe(true)
  })

  it('accepts modal with children', () => {
    const result = runtimeConfigRootSchema.safeParse({
      api: {},
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'modal',
              id: 'dialog',
              children: [{ type: 'heading', props: { text: 'Title', level: 2 } }],
            },
          ],
        },
      ],
      initialPage: 'home',
    })
    expect(result.success).toBe(true)
  })

  it('rejects modal without id', () => {
    const result = runtimeConfigRootSchema.safeParse({
      api: {},
      pages: [{ id: 'home', layout: [{ type: 'modal' }] }],
      initialPage: 'home',
    })
    expect(result.success).toBe(false)
  })

  it('rejects modal with id as non-string', () => {
    const result = runtimeConfigRootSchema.safeParse({
      api: {},
      pages: [{ id: 'home', layout: [{ type: 'modal', id: 42 }] }],
      initialPage: 'home',
    })
    expect(result.success).toBe(false)
  })

  it('rejects modal with props.size outside catalog', () => {
    const result = runtimeConfigRootSchema.safeParse({
      api: {},
      pages: [{ id: 'home', layout: [{ type: 'modal', id: 'dialog', props: { size: 'xl' } }] }],
      initialPage: 'home',
    })
    expect(result.success).toBe(false)
  })

  it('rejects modal with props.defaultOpen as non-boolean', () => {
    const result = runtimeConfigRootSchema.safeParse({
      api: {},
      pages: [{ id: 'home', layout: [{ type: 'modal', id: 'dialog', props: { defaultOpen: 'yes' } }] }],
      initialPage: 'home',
    })
    expect(result.success).toBe(false)
  })
})

describe('openModalRuntimeUiActionSchema', () => {
  it('accepts a valid openModal action with non-empty modalId', () => {
    const result = openModalRuntimeUiActionSchema.safeParse({ type: 'openModal', modalId: 'my-modal' })
    expect(result.success).toBe(true)
  })

  it('rejects openModal without modalId', () => {
    const result = openModalRuntimeUiActionSchema.safeParse({ type: 'openModal' })
    expect(result.success).toBe(false)
  })

  it('rejects openModal with empty modalId', () => {
    const result = openModalRuntimeUiActionSchema.safeParse({ type: 'openModal', modalId: '   ' })
    expect(result.success).toBe(false)
  })

  it('rejects openModal with modalId as non-string', () => {
    const result = openModalRuntimeUiActionSchema.safeParse({ type: 'openModal', modalId: 123 })
    expect(result.success).toBe(false)
  })
})

describe('closeModalRuntimeUiActionSchema', () => {
  it('accepts a valid closeModal action with non-empty modalId', () => {
    const result = closeModalRuntimeUiActionSchema.safeParse({ type: 'closeModal', modalId: 'my-modal' })
    expect(result.success).toBe(true)
  })

  it('rejects closeModal without modalId', () => {
    const result = closeModalRuntimeUiActionSchema.safeParse({ type: 'closeModal' })
    expect(result.success).toBe(false)
  })

  it('rejects closeModal with empty modalId', () => {
    const result = closeModalRuntimeUiActionSchema.safeParse({ type: 'closeModal', modalId: '' })
    expect(result.success).toBe(false)
  })

  it('rejects closeModal with modalId as non-string', () => {
    const result = closeModalRuntimeUiActionSchema.safeParse({ type: 'closeModal', modalId: null })
    expect(result.success).toBe(false)
  })
})

describe('validateRuntimeConfig behavior unchanged after adding runtime-config-root-zod', () => {
  it('returns ready status for a valid minimal config', () => {
    const result = validateRuntimeConfig({
      api: {},
      pages: [{ id: 'home', layout: [] }],
      initialPage: 'home',
    })
    expect(result.status).toBe('ready')
  })

  it('returns error with code initial-page-not-found when initialPage does not match', () => {
    const result = validateRuntimeConfig({
      api: {},
      pages: [{ id: 'home', layout: [] }],
      initialPage: 'missing-page',
    })
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.code).toBe('initial-page-not-found')
      expect(result.error.message).toBe('The initialPage "missing-page" does not match any page id.')
    }
  })
})
