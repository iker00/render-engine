import { describe, expect, it } from 'vitest'
import type { AutocompleteLayoutNode } from '../../config/runtime-config'
import { resolveAutocompleteFieldDefinition } from '../../runtime/nodes/resolve-form-field-definition'
import { collectAllFormFieldIds, collectResolvedFormFieldDefinitions } from '../../runtime/nodes/runtime-form-field-collection'
import type { RuntimeState } from '../../runtime/runtime-state/runtime-state-types'

const baseState: RuntimeState = {
  navigation: {
    currentPageId: 'home',
    history: [{ entryId: 0, pageId: 'home', params: {} }],
    currentEntryIndex: 0,
    lastError: null,
  },
  forms: {},
  queries: {
    fruitSearch: {
      status: 'success',
      data: ['apple', 'banana'],
      error: null,
      requestSignature: 'x',
    },
  },
  pageEntry: {
    entryId: 0,
    pageId: 'home',
    params: {},
    preloadNames: [],
    status: 'idle',
  },
  modal: { activeModalId: null, activeIterationKey: null },
  i18n: { translations: {}, activeLanguage: 'es' },
  tokens: {},
}

function createStaticAutocompleteNode(
  overrides: Partial<AutocompleteLayoutNode['props']> = {},
): AutocompleteLayoutNode {
  return {
    type: 'autocomplete',
    props: {
      fieldId: 'fruit',
      label: 'Fruit',
      items: [
        { label: 'Apple', value: 'apple' },
        { label: 'Banana', value: 'banana' },
      ],
      ...overrides,
    },
  }
}

function createDynamicAutocompleteNode(
  source: string,
  overrides: Partial<AutocompleteLayoutNode['props']> = {},
): AutocompleteLayoutNode {
  return {
    type: 'autocomplete',
    props: {
      fieldId: 'fruit',
      label: 'Fruit',
      items: { source, itemType: 'scalar' },
      ...overrides,
    },
  }
}

describe('resolveAutocompleteFieldDefinition', () => {
  it('resolves a static-shape defaultValue that matches an item.value', () => {
    const node = createStaticAutocompleteNode({ defaultValue: 'banana' })

    const result = resolveAutocompleteFieldDefinition(node, baseState)

    expect(result.defaultValue).toBe('banana')
  })

  it('clears a static-shape defaultValue that does not match any item.value (single selection)', () => {
    const node = createStaticAutocompleteNode({ defaultValue: 'kiwi' })

    const result = resolveAutocompleteFieldDefinition(node, baseState)

    expect(result.defaultValue).toBe('')
  })

  it('filters out non-matching members of a static-shape multiple defaultValue', () => {
    const node = createStaticAutocompleteNode({ multiple: true, defaultValue: ['apple', 'kiwi'] })

    const result = resolveAutocompleteFieldDefinition(node, baseState)

    expect(result.defaultValue).toEqual(['apple'])
  })

  it('keeps a non-matching static-shape defaultValue as literal text when allowFreeText is true', () => {
    const node = createStaticAutocompleteNode({ allowFreeText: true, defaultValue: 'kiwi' })

    const result = resolveAutocompleteFieldDefinition(node, baseState)

    expect(result.defaultValue).toBe('kiwi')
  })

  it('never clears a dynamic-shape (queries.*) defaultValue absent from the currently resolved suggestions', () => {
    const node = createDynamicAutocompleteNode('queries.fruitSearch.data', { defaultValue: 'kiwi' })

    const result = resolveAutocompleteFieldDefinition(node, baseState)

    expect(result.defaultValue).toBe('kiwi')
  })

  it('never clears a dynamic-shape (item.*) defaultValue absent from the currently resolved suggestions', () => {
    const node = createDynamicAutocompleteNode('item.availableFruits', { defaultValue: 'kiwi' })

    const result = resolveAutocompleteFieldDefinition(node, baseState, {
      item: { availableFruits: ['apple', 'banana'] },
    })

    expect(result.defaultValue).toBe('kiwi')
  })

  it('falls back to [] when multiple is true and the resolved defaultValue is not an array', () => {
    const node = createStaticAutocompleteNode({ multiple: true, defaultValue: 'apple' })

    const result = resolveAutocompleteFieldDefinition(node, baseState)

    expect(result.defaultValue).toEqual([])
  })

  it('always returns items: undefined regardless of shape', () => {
    const staticNode = createStaticAutocompleteNode({ defaultValue: 'apple' })
    const dynamicNode = createDynamicAutocompleteNode('queries.fruitSearch.data', { defaultValue: 'apple' })

    expect(resolveAutocompleteFieldDefinition(staticNode, baseState).items).toBeUndefined()
    expect(resolveAutocompleteFieldDefinition(dynamicNode, baseState).items).toBeUndefined()
  })
})

describe('form-layout-node field collection wiring for autocomplete', () => {
  it('includes a visible autocomplete field in collectResolvedFormFieldDefinitions', () => {
    const node = createStaticAutocompleteNode({ defaultValue: 'apple' })

    const fields = collectResolvedFormFieldDefinitions([node], baseState)

    expect(fields).toHaveLength(1)
    expect(fields[0]).toMatchObject({ fieldId: 'fruit', type: 'autocomplete', defaultValue: 'apple' })
  })

  it('includes the autocomplete fieldId in collectAllFormFieldIds regardless of visibility', () => {
    const hiddenNode = createStaticAutocompleteNode({
      fieldId: 'hiddenFruit',
    })
    hiddenNode.visibility = { reference: 'forms.someForm.role', operator: 'equals', value: 'admin' }

    const fieldIds = collectAllFormFieldIds([hiddenNode])

    expect(fieldIds).toContain('hiddenFruit')
  })
})
