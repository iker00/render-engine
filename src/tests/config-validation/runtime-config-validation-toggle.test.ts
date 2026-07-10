import { describe, expect, it } from 'vitest'
import { validateRuntimeConfig } from '../../config/runtime-config'
import { createConfigWithFormLayout, createConfigWithPages, createVisibilityRule } from './helpers'

function createToggleInForm(toggleProps: Record<string, unknown>, formOverrides: Record<string, unknown> = {}) {
  return createConfigWithFormLayout({
    children: [
      {
        type: 'toggle',
        props: toggleProps,
      },
    ],
    ...formOverrides,
  })
}

describe('validateRuntimeConfig — toggle node', () => {
  it('accepts toggle with minimal props (fieldId, label) inside a form', () => {
    const result = validateRuntimeConfig(createToggleInForm({ fieldId: 'agree', label: 'I agree' }))
    expect(result.status).toBe('ready')
  })

  it('accepts toggle with labelPosition "top"', () => {
    const result = validateRuntimeConfig(createToggleInForm({ fieldId: 'agree', label: 'I agree', labelPosition: 'top' }))
    expect(result.status).toBe('ready')
  })

  it('accepts toggle with labelPosition "inline"', () => {
    const result = validateRuntimeConfig(createToggleInForm({ fieldId: 'agree', label: 'I agree', labelPosition: 'inline' }))
    expect(result.status).toBe('ready')
  })

  it('accepts toggle without labelPosition (default top)', () => {
    const result = validateRuntimeConfig(createToggleInForm({ fieldId: 'agree', label: 'I agree' }))
    expect(result.status).toBe('ready')
  })

  it('rejects toggle with invalid labelPosition', () => {
    const result = validateRuntimeConfig(createToggleInForm({ fieldId: 'agree', label: 'I agree', labelPosition: 'bottom' }))
    expect(result).toEqual({
      status: 'error',
      error: {
        code: 'invalid-layout',
        displayMode: 'development-only',
        message: expect.stringContaining('layout[0].children[0].props.labelPosition'),
      },
    })
  })

  it('accepts toggle with defaultValue true', () => {
    const result = validateRuntimeConfig(createToggleInForm({ fieldId: 'agree', label: 'I agree', defaultValue: true }))
    expect(result.status).toBe('ready')
  })

  it('accepts toggle with defaultValue false', () => {
    const result = validateRuntimeConfig(createToggleInForm({ fieldId: 'agree', label: 'I agree', defaultValue: false }))
    expect(result.status).toBe('ready')
  })

  it('accepts toggle without defaultValue (implicit false)', () => {
    const result = validateRuntimeConfig(createToggleInForm({ fieldId: 'agree', label: 'I agree' }))
    expect(result.status).toBe('ready')
  })

  it('rejects toggle with defaultValue string literal (non-reference)', () => {
    const result = validateRuntimeConfig(createToggleInForm({ fieldId: 'agree', label: 'I agree', defaultValue: 'yes' }))
    expect(result).toEqual({
      status: 'error',
      error: {
        code: 'invalid-layout',
        displayMode: 'development-only',
        message: expect.stringContaining('layout[0].children[0].props.defaultValue'),
      },
    })
  })

  it('rejects toggle with defaultValue number', () => {
    const result = validateRuntimeConfig(createToggleInForm({ fieldId: 'agree', label: 'I agree', defaultValue: 42 }))
    expect(result).toEqual({
      status: 'error',
      error: {
        code: 'invalid-layout',
        displayMode: 'development-only',
        message: expect.stringContaining('layout[0].children[0].props.defaultValue'),
      },
    })
  })

  it('accepts toggle with defaultValue dynamic reference', () => {
    const result = validateRuntimeConfig(createToggleInForm({ fieldId: 'agree', label: 'I agree', defaultValue: 'queries.q.data.active' }))
    expect(result.status).toBe('ready')
  })

  it('accepts toggle with validations.required: true', () => {
    const result = validateRuntimeConfig(createToggleInForm({ fieldId: 'agree', label: 'I agree', validations: { required: true } }))
    expect(result.status).toBe('ready')
  })

  it('accepts toggle with validations.required extended form', () => {
    const result = validateRuntimeConfig(createToggleInForm({ fieldId: 'agree', label: 'I agree', validations: { required: { value: true, message: 'Must agree' } } }))
    expect(result.status).toBe('ready')
  })

  it('accepts toggle with validations.required with when condition', () => {
    const result = validateRuntimeConfig(createToggleInForm({
      fieldId: 'agree',
      label: 'I agree',
      validations: {
        required: {
          value: true,
          when: { reference: 'forms.user-form.name', operator: 'isTruthy' },
        },
      },
    }))
    expect(result.status).toBe('ready')
  })

  it('rejects toggle with validations.minLength', () => {
    const result = validateRuntimeConfig(createToggleInForm({ fieldId: 'agree', label: 'I agree', validations: { minLength: 5 } }))
    expect(result).toEqual({
      status: 'error',
      error: {
        code: 'invalid-layout',
        displayMode: 'development-only',
        message: expect.stringContaining('layout[0].children[0].props.validations.minLength'),
      },
    })
  })

  it('rejects toggle with validations.maxLength', () => {
    const result = validateRuntimeConfig(createToggleInForm({ fieldId: 'agree', label: 'I agree', validations: { maxLength: 10 } }))
    expect(result).toEqual({
      status: 'error',
      error: {
        code: 'invalid-layout',
        displayMode: 'development-only',
        message: expect.stringContaining('layout[0].children[0].props.validations.maxLength'),
      },
    })
  })

  it('rejects toggle with validations.min', () => {
    const result = validateRuntimeConfig(createToggleInForm({ fieldId: 'agree', label: 'I agree', validations: { min: 0 } }))
    expect(result).toEqual({
      status: 'error',
      error: {
        code: 'invalid-layout',
        displayMode: 'development-only',
        message: expect.stringContaining('layout[0].children[0].props.validations.min'),
      },
    })
  })

  it('rejects toggle with validations.max', () => {
    const result = validateRuntimeConfig(createToggleInForm({ fieldId: 'agree', label: 'I agree', validations: { max: 100 } }))
    expect(result).toEqual({
      status: 'error',
      error: {
        code: 'invalid-layout',
        displayMode: 'development-only',
        message: expect.stringContaining('layout[0].children[0].props.validations.max'),
      },
    })
  })

  it('rejects toggle with validations.minSelections', () => {
    const result = validateRuntimeConfig(createToggleInForm({ fieldId: 'agree', label: 'I agree', validations: { minSelections: 1 } }))
    expect(result).toEqual({
      status: 'error',
      error: {
        code: 'invalid-layout',
        displayMode: 'development-only',
        message: expect.stringContaining('layout[0].children[0].props.validations.minSelections'),
      },
    })
  })

  it('rejects toggle with validations.maxSelections', () => {
    const result = validateRuntimeConfig(createToggleInForm({ fieldId: 'agree', label: 'I agree', validations: { maxSelections: 3 } }))
    expect(result).toEqual({
      status: 'error',
      error: {
        code: 'invalid-layout',
        displayMode: 'development-only',
        message: expect.stringContaining('layout[0].children[0].props.validations.maxSelections'),
      },
    })
  })

  it('rejects toggle with validations.pattern', () => {
    const result = validateRuntimeConfig(createToggleInForm({ fieldId: 'agree', label: 'I agree', validations: { pattern: '^\\d+$' } }))
    expect(result).toEqual({
      status: 'error',
      error: {
        code: 'invalid-layout',
        displayMode: 'development-only',
        message: expect.stringContaining('layout[0].children[0].props.validations.pattern'),
      },
    })
  })

  it('rejects toggle with validations.email', () => {
    const result = validateRuntimeConfig(createToggleInForm({ fieldId: 'agree', label: 'I agree', validations: { email: true } }))
    expect(result).toEqual({
      status: 'error',
      error: {
        code: 'invalid-layout',
        displayMode: 'development-only',
        message: expect.stringContaining('layout[0].children[0].props.validations.email'),
      },
    })
  })

  it('rejects toggle with validations.url', () => {
    const result = validateRuntimeConfig(createToggleInForm({ fieldId: 'agree', label: 'I agree', validations: { url: true } }))
    expect(result).toEqual({
      status: 'error',
      error: {
        code: 'invalid-layout',
        displayMode: 'development-only',
        message: expect.stringContaining('layout[0].children[0].props.validations.url'),
      },
    })
  })

  it('rejects toggle outside a form', () => {
    const result = validateRuntimeConfig(
      createConfigWithPages([
        {
          id: 'home',
          layout: [
            {
              type: 'toggle',
              props: {
                fieldId: 'agree',
                label: 'I agree',
              },
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
        message: `Page "home" has an invalid layout at "layout[0]": toggle nodes must be descendants of a form node.
  → toggle(fieldId: "agree")
  Node: {"type":"toggle","props":{"fieldId":"agree","label":"I agree"}}`,
      },
    })
  })

  it('accepts toggle with visibility', () => {
    const result = validateRuntimeConfig(createConfigWithFormLayout({
      children: [
        {
          type: 'toggle',
          visibility: createVisibilityRule(),
          props: { fieldId: 'agree', label: 'I agree' },
        },
      ],
    }))
    expect(result.status).toBe('ready')
  })

  it('accepts toggle with queryStateFeedback', () => {
    const result = validateRuntimeConfig({
      api: {
        submitUserForm: { method: 'POST', endpoint: '/api/forms' },
        loadData: { method: 'GET', endpoint: '/api/data' },
      },
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'form',
              id: 'user-form',
              submitAction: { type: 'executeOperation', operationName: 'submitUserForm' },
              children: [
                {
                  type: 'toggle',
                  queryStateFeedback: { query: 'loadData' },
                  props: { fieldId: 'agree', label: 'I agree' },
                },
              ],
            },
          ],
        },
      ],
      initialPage: 'home',
    })
    expect(result.status).toBe('ready')
  })

  it('accepts toggle with layout.span', () => {
    const result = validateRuntimeConfig(createConfigWithFormLayout({
      children: [
        {
          type: 'toggle',
          layout: { span: 6 },
          props: { fieldId: 'agree', label: 'I agree' },
        },
      ],
    }))
    expect(result.status).toBe('ready')
  })

  it('accepts toggle inside container inside form', () => {
    const result = validateRuntimeConfig(createConfigWithFormLayout({
      children: [
        {
          type: 'container',
          children: [
            {
              type: 'toggle',
              props: { fieldId: 'active', label: 'Active' },
            },
          ],
        },
      ],
    }))
    expect(result.status).toBe('ready')
  })

  it('includes breadcrumb with toggle(fieldId: "agree") for validation error', () => {
    const result = validateRuntimeConfig(createToggleInForm({ fieldId: 'agree', label: 'I agree', validations: { minLength: 5 } }))
    expect(result.status).toBe('error')
    if (result.status !== 'error') throw new Error('Expected error')
    expect(result.error.message).toContain('form("user-form") > toggle(fieldId: "agree")')
    expect(result.error.message).toContain('Node: {"type":"toggle","props":{"fieldId":"agree","label":"I agree"}}')
  })

  it('rejects toggle with duplicate fieldId within the same form', () => {
    const result = validateRuntimeConfig(createConfigWithFormLayout({
      children: [
        {
          type: 'toggle',
          props: { fieldId: 'agree', label: 'First toggle' },
        },
        {
          type: 'toggle',
          props: { fieldId: 'agree', label: 'Duplicate toggle' },
        },
      ],
    }))
    expect(result).toEqual({
      status: 'error',
      error: {
        code: 'invalid-layout',
        displayMode: 'development-only',
        message: `Page "home" has an invalid layout at "layout[0].children[1].props.fieldId": duplicate fieldId "agree" in form "user-form".
  → form("user-form") > toggle(fieldId: "agree")
  Node: {"type":"toggle","props":{"fieldId":"agree","label":"Duplicate toggle"}}`,
      },
    })
  })
})
