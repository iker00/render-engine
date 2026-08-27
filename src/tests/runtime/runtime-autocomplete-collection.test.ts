import { describe, expect, it } from 'vitest'
import {
  filterAutocompleteSuggestions,
  resolveAutocompleteCollectionItems,
} from '../../runtime/runtime-collection-sources'
import type { SelectLayoutNodeItems } from '../../config/runtime-config'
import type { RuntimeState } from '../../runtime/runtime-state/runtime-state-types'

const runtimeState: RuntimeState = {
  navigation: {
    currentPageId: 'home',
    history: [{ entryId: 0, pageId: 'home', params: {} }],
    lastError: null,
  },
  forms: {},
  queries: {
    countries: {
      status: 'success',
      data: [
        { code: 'ES', name: 'Spain' },
        { code: 'FR', name: 'France' },
        { code: 'DE', name: 'Germany' },
      ],
      error: null,
    },
  },
  pageEntry: {
    entryId: 0,
    pageId: 'home',
    params: {},
    preloadNames: [],
    status: 'idle',
  },
}

describe('resolveAutocompleteCollectionItems', () => {
  it('resolves a manual literal items list preserving order', () => {
    const items: SelectLayoutNodeItems = [
      { label: 'Spain', value: 'ES' },
      { label: 'France', value: 'FR' },
    ]

    expect(resolveAutocompleteCollectionItems(items, runtimeState)).toEqual([
      { label: 'Spain', value: 'ES' },
      { label: 'France', value: 'FR' },
    ])
  })

  it('resolves a manual scalar values list', () => {
    const items: SelectLayoutNodeItems = {
      values: ['ES', 'FR', 'DE'],
    }

    expect(resolveAutocompleteCollectionItems(items, runtimeState)).toEqual([
      { label: 'ES', value: 'ES' },
      { label: 'FR', value: 'FR' },
      { label: 'DE', value: 'DE' },
    ])
  })

  it('resolves a dynamic object items source pointed at queries.x.data', () => {
    const items: SelectLayoutNodeItems = {
      source: 'queries.countries.data',
      itemType: 'object',
      label: 'name',
      value: 'code',
    }

    expect(resolveAutocompleteCollectionItems(items, runtimeState)).toEqual([
      { label: 'Spain', value: 'ES' },
      { label: 'France', value: 'FR' },
      { label: 'Germany', value: 'DE' },
    ])
  })

  it('resolves a dynamic items source rooted at item.* within an iteration context', () => {
    const items: SelectLayoutNodeItems = {
      source: 'item.tags',
      itemType: 'scalar',
    }

    const iterationContext = {
      item: { tags: ['alpha', 'beta'] },
      key: '0',
      itemIndex: 0,
    }

    expect(
      resolveAutocompleteCollectionItems(items, runtimeState, { iterationContext }),
    ).toEqual([
      { label: 'alpha', value: 'alpha' },
      { label: 'beta', value: 'beta' },
    ])
  })
})

describe('filterAutocompleteSuggestions', () => {
  const items = [
    { label: 'Spain', value: 'ES' },
    { label: 'France', value: 'FR' },
    { label: 'Germany', value: 'DE' },
  ]

  it('returns an empty list when searchText is shorter than minChars regardless of content', () => {
    expect(filterAutocompleteSuggestions(items, 'sp', 3)).toEqual([])
  })

  it('returns only items whose label contains searchText as a case-insensitive substring', () => {
    expect(filterAutocompleteSuggestions(items, 'an', 1)).toEqual([
      { label: 'France', value: 'FR' },
      { label: 'Germany', value: 'DE' },
    ])
    expect(filterAutocompleteSuggestions(items, 'SPA', 1)).toEqual([
      { label: 'Spain', value: 'ES' },
    ])
  })

  it('returns the full list unfiltered when searchText is empty and minChars is 0', () => {
    expect(filterAutocompleteSuggestions(items, '', 0)).toEqual(items)
  })

  it('does not mutate the input array', () => {
    const originalItems = [...items]

    filterAutocompleteSuggestions(items, 'fr', 1)

    expect(items).toEqual(originalItems)
  })
})
