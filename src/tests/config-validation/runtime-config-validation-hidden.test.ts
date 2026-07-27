import { describe, expect, it } from 'vitest'
import { validateRuntimeConfig } from '../../config/runtime-config'
import { createConfigWithFormLayout, createConfigWithPages } from './helpers'

function createHiddenInForm(hiddenProps: Record<string, unknown>, formOverrides: Record<string, unknown> = {}) {
  return createConfigWithFormLayout({
    children: [
      {
        type: 'hidden',
        props: hiddenProps,
      },
    ],
    ...formOverrides,
  })
}

describe('validateRuntimeConfig — hidden node', () => {
  it('accepts hidden with fieldId and value string inside a form', () => {
    const result = validateRuntimeConfig(createHiddenInForm({ fieldId: 'token', value: 'abc123' }))
    expect(result.status).toBe('ready')
  })

  it('accepts hidden with value number', () => {
    const result = validateRuntimeConfig(createHiddenInForm({ fieldId: 'version', value: 42 }))
    expect(result.status).toBe('ready')
  })

  it('accepts hidden with value boolean', () => {
    const result = validateRuntimeConfig(createHiddenInForm({ fieldId: 'active', value: true }))
    expect(result.status).toBe('ready')
  })

  it('accepts hidden with value dynamic reference', () => {
    const result = validateRuntimeConfig(createHiddenInForm({ fieldId: 'userId', value: 'queries.q.data.id' }))
    expect(result.status).toBe('ready')
  })

  it('rejects hidden without value', () => {
    const result = validateRuntimeConfig(createHiddenInForm({ fieldId: 'token' }))
    expect(result).toEqual({
      status: 'error',
      error: {
        code: 'invalid-layout',
        displayMode: 'development-only',
        message: expect.stringContaining('layout[0].children[0].props.value'),
      },
    })
  })

  it('rejects hidden with label in props', () => {
    const result = validateRuntimeConfig(createHiddenInForm({ fieldId: 'token', value: 'abc', label: 'Token' }))
    expect(result).toEqual({
      status: 'error',
      error: {
        code: 'invalid-layout',
        displayMode: 'development-only',
        message: expect.stringContaining('layout[0].children[0].props.label'),
      },
    })
  })

  it('rejects hidden with validations in props', () => {
    const result = validateRuntimeConfig(createHiddenInForm({ fieldId: 'token', value: 'abc', validations: { required: true } }))
    expect(result).toEqual({
      status: 'error',
      error: {
        code: 'invalid-layout',
        displayMode: 'development-only',
        message: expect.stringContaining('layout[0].children[0].props.validations'),
      },
    })
  })

  it('rejects hidden with defaultValue in props', () => {
    const result = validateRuntimeConfig(createHiddenInForm({ fieldId: 'token', value: 'abc', defaultValue: 'def' }))
    expect(result).toEqual({
      status: 'error',
      error: {
        code: 'invalid-layout',
        displayMode: 'development-only',
        message: expect.stringContaining('layout[0].children[0].props.defaultValue'),
      },
    })
  })

  it('rejects hidden with placeholder in props', () => {
    const result = validateRuntimeConfig(createHiddenInForm({ fieldId: 'token', value: 'abc', placeholder: 'Enter...' }))
    expect(result).toEqual({
      status: 'error',
      error: {
        code: 'invalid-layout',
        displayMode: 'development-only',
        message: expect.stringContaining('layout[0].children[0].props.placeholder'),
      },
    })
  })

  it('rejects hidden with icon in props', () => {
    const result = validateRuntimeConfig(createHiddenInForm({ fieldId: 'token', value: 'abc', icon: 'lock' }))
    expect(result).toEqual({
      status: 'error',
      error: {
        code: 'invalid-layout',
        displayMode: 'development-only',
        message: expect.stringContaining('layout[0].children[0].props.icon'),
      },
    })
  })

  it('rejects hidden with iconPosition in props', () => {
    const result = validateRuntimeConfig(createHiddenInForm({ fieldId: 'token', value: 'abc', iconPosition: 'left' }))
    expect(result).toEqual({
      status: 'error',
      error: {
        code: 'invalid-layout',
        displayMode: 'development-only',
        message: expect.stringContaining('layout[0].children[0].props.iconPosition'),
      },
    })
  })

  it('rejects hidden with visibility on the node', () => {
    const result = validateRuntimeConfig(
      createConfigWithFormLayout({
        children: [
          {
            type: 'hidden',
            visibility: {
              reference: 'forms.f.x',
              operator: 'equals',
              value: 'a',
            },
            props: { fieldId: 'token', value: 'abc' },
          },
        ],
      }),
    )
    expect(result).toEqual({
      status: 'error',
      error: {
        code: 'invalid-layout',
        displayMode: 'development-only',
        message: expect.stringContaining('layout[0].children[0].visibility'),
      },
    })
  })

  it('rejects hidden with queryStateFeedback on the node', () => {
    const result = validateRuntimeConfig(
      createConfigWithFormLayout({
        children: [
          {
            type: 'hidden',
            queryStateFeedback: {
              query: 'someQuery',
            },
            props: { fieldId: 'token', value: 'abc' },
          },
        ],
      }),
    )
    expect(result).toEqual({
      status: 'error',
      error: {
        code: 'invalid-layout',
        displayMode: 'development-only',
        message: expect.stringContaining('layout[0].children[0].queryStateFeedback'),
      },
    })
  })

  it('includes breadcrumb with hidden(fieldId: "token") for prohibited prop error', () => {
    const result = validateRuntimeConfig(createHiddenInForm({ fieldId: 'token', value: 'abc', label: 'Token' }))
    expect(result.status).toBe('error')
    if (result.status !== 'error') throw new Error('Expected error')
    expect(result.error.message).toContain('form("user-form") > hidden(fieldId: "token")')
    expect(result.error.message).toContain('Node: ')
  })

  it('rejects hidden outside a form', () => {
    const result = validateRuntimeConfig(
      createConfigWithPages([
        {
          id: 'home',
          layout: [
            {
              type: 'hidden',
              props: { fieldId: 'token', value: 'abc' },
            },
          ],
        },
      ]),
    )
    expect(result).toEqual({
      status: 'error',
      error: {
        code: 'invalid-layout',
        displayMode: 'development-only',
        message: `Page "home" has an invalid layout at "layout[0]": hidden nodes must be descendants of a form node.
  → hidden(fieldId: "token")
  Node: {"type":"hidden","props":{"fieldId":"token"}}`,
      },
    })
  })

  it('accepts hidden inside container inside a form', () => {
    const result = validateRuntimeConfig(
      createConfigWithFormLayout({
        children: [
          {
            type: 'container',
            children: [
              {
                type: 'hidden',
                props: { fieldId: 'itemId', value: 'abc' },
              },
            ],
          },
        ],
      }),
    )
    expect(result.status).toBe('ready')
  })

  it('rejects hidden with fieldId duplicated within the same form', () => {
    const result = validateRuntimeConfig(
      createConfigWithFormLayout({
        children: [
          {
            type: 'hidden',
            props: { fieldId: 'token', value: 'abc' },
          },
          {
            type: 'hidden',
            props: { fieldId: 'token', value: 'def' },
          },
        ],
      }),
    )
    expect(result).toEqual({
      status: 'error',
      error: {
        code: 'invalid-layout',
        displayMode: 'development-only',
        message: expect.stringContaining('duplicate fieldId "token"'),
      },
    })
  })

  it('silently discards layout.span via .strip() (does not reject, does not reach normalized result)', () => {
    const result = validateRuntimeConfig(createHiddenInForm({ fieldId: 'token', value: 'abc' }))
    expect(result.status).toBe('ready')
    if (result.status === 'ready') {
      const hiddenNode = result.config.pages[0].layout[0] as { type: string; children?: Array<{ type: string; layout?: unknown }> }
      const formChildren = (hiddenNode as unknown as { children: Array<{ type: string; layout?: unknown }> }).children
      const hidden = formChildren?.find((c) => c.type === 'hidden')
      expect(hidden?.layout).toBeUndefined()
    }
  })
})
