import { describe, expect, it } from 'vitest'
import devConfig from '../dev/config.json'
import { runtimeConfigRootSchema } from '../config/runtime-config-root-zod'
import { validateRuntimeConfig } from '../config/runtime-config'

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
