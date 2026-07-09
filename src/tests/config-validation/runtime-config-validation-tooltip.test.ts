import { describe, expect, it } from 'vitest'
import { validateRuntimeConfig } from '../../config/runtime-config'
import { createConfigWithFormLayout } from './helpers'

function createFieldInForm(fieldNode: Record<string, unknown>) {
  return createConfigWithFormLayout({
    children: [fieldNode],
  })
}

describe('validateRuntimeConfig — tooltip prop', () => {
  it('accepts input with props.tooltip as string non-empty inside a form', () => {
    const result = validateRuntimeConfig(
      createFieldInForm({
        type: 'input',
        props: { fieldId: 'name', label: 'Name', tooltip: 'Enter your full name' },
      }),
    )
    expect(result.status).toBe('ready')
    if (result.status !== 'ready') throw new Error('Expected ready')
    const formNode = result.page.layout[0]
    if (formNode.type !== 'form') throw new Error('Expected form')
    expect(formNode.children?.[0]).toMatchObject({
      type: 'input',
      props: { fieldId: 'name', tooltip: 'Enter your full name' },
    })
  })

  it('accepts textarea with props.tooltip as string non-empty inside a form', () => {
    const result = validateRuntimeConfig(
      createFieldInForm({
        type: 'textarea',
        props: { fieldId: 'bio', label: 'Bio', tooltip: 'Tell us about yourself' },
      }),
    )
    expect(result.status).toBe('ready')
    if (result.status !== 'ready') throw new Error('Expected ready')
    const formNode = result.page.layout[0]
    if (formNode.type !== 'form') throw new Error('Expected form')
    expect(formNode.children?.[0]).toMatchObject({
      type: 'textarea',
      props: { fieldId: 'bio', tooltip: 'Tell us about yourself' },
    })
  })

  it('accepts select with props.tooltip as string non-empty inside a form', () => {
    const result = validateRuntimeConfig(
      createFieldInForm({
        type: 'select',
        props: {
          fieldId: 'role',
          label: 'Role',
          tooltip: 'Choose your role',
          items: [{ label: 'Admin', value: 'admin' }],
        },
      }),
    )
    expect(result.status).toBe('ready')
    if (result.status !== 'ready') throw new Error('Expected ready')
    const formNode = result.page.layout[0]
    if (formNode.type !== 'form') throw new Error('Expected form')
    expect(formNode.children?.[0]).toMatchObject({
      type: 'select',
      props: { fieldId: 'role', tooltip: 'Choose your role' },
    })
  })

  it('accepts radioGroup with props.tooltip as string non-empty inside a form', () => {
    const result = validateRuntimeConfig(
      createFieldInForm({
        type: 'radioGroup',
        props: {
          fieldId: 'color',
          label: 'Favorite color',
          tooltip: 'Pick one',
          items: [{ label: 'Red', value: 'red' }],
        },
      }),
    )
    expect(result.status).toBe('ready')
    if (result.status !== 'ready') throw new Error('Expected ready')
    const formNode = result.page.layout[0]
    if (formNode.type !== 'form') throw new Error('Expected form')
    expect(formNode.children?.[0]).toMatchObject({
      type: 'radioGroup',
      props: { fieldId: 'color', tooltip: 'Pick one' },
    })
  })

  it('accepts checkboxGroup with props.tooltip as string non-empty inside a form', () => {
    const result = validateRuntimeConfig(
      createFieldInForm({
        type: 'checkboxGroup',
        props: {
          fieldId: 'tags',
          label: 'Tags',
          tooltip: 'Select all that apply',
          items: [{ label: 'A', value: 'a' }],
        },
      }),
    )
    expect(result.status).toBe('ready')
    if (result.status !== 'ready') throw new Error('Expected ready')
    const formNode = result.page.layout[0]
    if (formNode.type !== 'form') throw new Error('Expected form')
    expect(formNode.children?.[0]).toMatchObject({
      type: 'checkboxGroup',
      props: { fieldId: 'tags', tooltip: 'Select all that apply' },
    })
  })

  it('accepts toggle with props.tooltip as string non-empty inside a form', () => {
    const result = validateRuntimeConfig(
      createFieldInForm({
        type: 'toggle',
        props: { fieldId: 'agree', label: 'I agree', tooltip: 'You must agree to continue' },
      }),
    )
    expect(result.status).toBe('ready')
    if (result.status !== 'ready') throw new Error('Expected ready')
    const formNode = result.page.layout[0]
    if (formNode.type !== 'form') throw new Error('Expected form')
    expect(formNode.children?.[0]).toMatchObject({
      type: 'toggle',
      props: { fieldId: 'agree', tooltip: 'You must agree to continue' },
    })
  })

  it('accepts fileInput with props.tooltip as string non-empty inside a form', () => {
    const result = validateRuntimeConfig(
      createFieldInForm({
        type: 'fileInput',
        props: { fieldId: 'doc', label: 'Document', tooltip: 'Upload your document' },
      }),
    )
    expect(result.status).toBe('ready')
    if (result.status !== 'ready') throw new Error('Expected ready')
    const formNode = result.page.layout[0]
    if (formNode.type !== 'form') throw new Error('Expected form')
    expect(formNode.children?.[0]).toMatchObject({
      type: 'fileInput',
      props: { fieldId: 'doc', tooltip: 'Upload your document' },
    })
  })

  it('accepts input without props.tooltip without regression', () => {
    const result = validateRuntimeConfig(
      createFieldInForm({
        type: 'input',
        props: { fieldId: 'name', label: 'Name' },
      }),
    )
    expect(result.status).toBe('ready')
    if (result.status !== 'ready') throw new Error('Expected ready')
    const formNode = result.page.layout[0]
    if (formNode.type !== 'form') throw new Error('Expected form')
    expect(formNode.children?.[0]).not.toHaveProperty('props.tooltip')
  })

  it('accepts toggle without props.tooltip without regression', () => {
    const result = validateRuntimeConfig(
      createFieldInForm({
        type: 'toggle',
        props: { fieldId: 'agree', label: 'I agree' },
      }),
    )
    expect(result.status).toBe('ready')
    if (result.status !== 'ready') throw new Error('Expected ready')
    const formNode = result.page.layout[0]
    if (formNode.type !== 'form') throw new Error('Expected form')
    expect(formNode.children?.[0]).not.toHaveProperty('props.tooltip')
  })

  it('accepts fileInput without props.tooltip without regression', () => {
    const result = validateRuntimeConfig(
      createFieldInForm({
        type: 'fileInput',
        props: { fieldId: 'doc', label: 'Document' },
      }),
    )
    expect(result.status).toBe('ready')
    if (result.status !== 'ready') throw new Error('Expected ready')
    const formNode = result.page.layout[0]
    if (formNode.type !== 'form') throw new Error('Expected form')
    expect(formNode.children?.[0]).not.toHaveProperty('props.tooltip')
  })

  it('rejects input with props.tooltip as number', () => {
    const result = validateRuntimeConfig(
      createFieldInForm({
        type: 'input',
        props: { fieldId: 'name', label: 'Name', tooltip: 42 },
      }),
    )
    expect(result.status).toBe('error')
  })

  it('rejects input with props.tooltip as boolean', () => {
    const result = validateRuntimeConfig(
      createFieldInForm({
        type: 'input',
        props: { fieldId: 'name', label: 'Name', tooltip: true },
      }),
    )
    expect(result.status).toBe('error')
  })

  it('rejects input with props.tooltip as array', () => {
    const result = validateRuntimeConfig(
      createFieldInForm({
        type: 'input',
        props: { fieldId: 'name', label: 'Name', tooltip: ['help'] },
      }),
    )
    expect(result.status).toBe('error')
  })

  it('rejects toggle with props.tooltip as number', () => {
    const result = validateRuntimeConfig(
      createFieldInForm({
        type: 'toggle',
        props: { fieldId: 'agree', label: 'I agree', tooltip: 99 },
      }),
    )
    expect(result.status).toBe('error')
  })

  it('rejects fileInput with props.tooltip as number', () => {
    const result = validateRuntimeConfig(
      createFieldInForm({
        type: 'fileInput',
        props: { fieldId: 'doc', label: 'Document', tooltip: 7 },
      }),
    )
    expect(result.status).toBe('error')
  })

  it('accepts input with props.tooltip as empty string', () => {
    const result = validateRuntimeConfig(
      createFieldInForm({
        type: 'input',
        props: { fieldId: 'name', label: 'Name', tooltip: '' },
      }),
    )
    expect(result.status).toBe('ready')
  })

  it('accepts input with props.tooltip containing interpolated reference {{...}}', () => {
    const result = validateRuntimeConfig(
      createFieldInForm({
        type: 'input',
        props: { fieldId: 'name', label: 'Name', tooltip: '{{translations.helpText}}' },
      }),
    )
    expect(result.status).toBe('ready')
    if (result.status !== 'ready') throw new Error('Expected ready')
    const formNode = result.page.layout[0]
    if (formNode.type !== 'form') throw new Error('Expected form')
    expect(formNode.children?.[0]).toMatchObject({
      type: 'input',
      props: { fieldId: 'name', tooltip: '{{translations.helpText}}' },
    })
  })
})
