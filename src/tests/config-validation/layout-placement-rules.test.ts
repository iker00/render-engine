import { describe, expect, it } from 'vitest'
import {
  buttonRequiresFormAncestor,
  FORM_ALLOWED_DESCENDANT_TYPES,
  FORM_ONLY_LEAF_NODE_TYPES,
  LINK_ALLOWED_CHILD_TYPES,
  MODAL_ALLOWED_CHILD_TYPES,
  nodeTypeAcceptsChildren,
} from '../../config/layout-placement-rules'

describe('nodeTypeAcceptsChildren', () => {
  it('returns true for container, form, modal, link and accordion', () => {
    expect(nodeTypeAcceptsChildren('container')).toBe(true)
    expect(nodeTypeAcceptsChildren('form')).toBe(true)
    expect(nodeTypeAcceptsChildren('modal')).toBe(true)
    expect(nodeTypeAcceptsChildren('link')).toBe(true)
    expect(nodeTypeAcceptsChildren('accordion')).toBe(true)
  })

  it('returns false for repeater, tabs and heading', () => {
    expect(nodeTypeAcceptsChildren('repeater')).toBe(false)
    expect(nodeTypeAcceptsChildren('tabs')).toBe(false)
    expect(nodeTypeAcceptsChildren('heading')).toBe(false)
  })
})

describe('MODAL_ALLOWED_CHILD_TYPES / LINK_ALLOWED_CHILD_TYPES', () => {
  it('MODAL_ALLOWED_CHILD_TYPES contains exactly the types already validated for the modal node', () => {
    const expected = ['container', 'form', 'heading', 'paragraph', 'list', 'image', 'table', 'button', 'repeater', 'accordion', 'fileManager']

    expect([...MODAL_ALLOWED_CHILD_TYPES].sort()).toEqual([...expected].sort())
  })

  it('LINK_ALLOWED_CHILD_TYPES contains exactly the types already validated for the link node', () => {
    const expected = ['container', 'heading', 'paragraph', 'list', 'image', 'badge', 'alert', 'stat', 'divider', 'skeleton']

    expect([...LINK_ALLOWED_CHILD_TYPES].sort()).toEqual([...expected].sort())
  })
})

describe('FORM_ONLY_LEAF_NODE_TYPES', () => {
  it('contains exactly the ten form-only leaf node types', () => {
    const expected = ['input', 'textarea', 'select', 'radioGroup', 'checkboxGroup', 'fileInput', 'toggle', 'hidden', 'autocomplete', 'addressPicker']

    expect(FORM_ONLY_LEAF_NODE_TYPES.size).toBe(10)
    expect([...FORM_ONLY_LEAF_NODE_TYPES].sort()).toEqual([...expected].sort())
  })
})

describe('buttonRequiresFormAncestor', () => {
  it('returns true when props.action is undefined', () => {
    expect(buttonRequiresFormAncestor({ props: {} })).toBe(true)
  })

  it('returns false when props.action is set', () => {
    expect(
      buttonRequiresFormAncestor({ props: { action: { type: 'navigateTo', pageId: 'x' } } }),
    ).toBe(false)
  })

  it('tolerates a synthetic node without props (drag-from-palette case) and returns true without throwing', () => {
    expect(() => buttonRequiresFormAncestor({ type: 'button' })).not.toThrow()
    expect(buttonRequiresFormAncestor({ type: 'button' })).toBe(true)
  })
})

describe('FORM_ALLOWED_DESCENDANT_TYPES', () => {
  it('rejects types that are not valid inside a form', () => {
    expect(FORM_ALLOWED_DESCENDANT_TYPES.has('repeater')).toBe(false)
    expect(FORM_ALLOWED_DESCENDANT_TYPES.has('fileManager')).toBe(false)
    expect(FORM_ALLOWED_DESCENDANT_TYPES.has('list')).toBe(false)
    expect(FORM_ALLOWED_DESCENDANT_TYPES.has('link')).toBe(false)
    expect(FORM_ALLOWED_DESCENDANT_TYPES.has('modal')).toBe(false)
  })

  it('accepts exactly the 24 types documented as valid form descendants', () => {
    const expected = [
      'input',
      'textarea',
      'select',
      'radioGroup',
      'checkboxGroup',
      'fileInput',
      'toggle',
      'hidden',
      'button',
      'heading',
      'paragraph',
      'image',
      'table',
      'container',
      'accordion',
      'divider',
      'tabs',
      'steps',
      'autocomplete',
      'addressPicker',
      'alert',
      'badge',
      'stat',
      'skeleton',
    ]

    expect(FORM_ALLOWED_DESCENDANT_TYPES.size).toBe(24)

    for (const type of expected) {
      expect(FORM_ALLOWED_DESCENDANT_TYPES.has(type as never)).toBe(true)
    }
  })
})
