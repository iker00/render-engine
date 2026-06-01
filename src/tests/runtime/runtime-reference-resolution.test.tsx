import { describe, expect, it, vi } from 'vitest'
import { parseRuntimeReference } from '../../runtime/runtime-references/runtime-reference-parser'
import {
  resolveRuntimeImageAlt,
  resolveRuntimeImageSource,
  resolveRuntimeReference,
  resolveRuntimeVisibleValue,
} from '../../runtime/runtime-references/runtime-reference-resolver'
import type { RuntimeState } from '../../runtime/runtime-state/runtime-state-types'

const runtimeState: RuntimeState = {
  navigation: {
    currentPageId: 'home',
    history: [{ entryId: 0, pageId: 'home', params: {} }],
    lastError: null,
  },
  forms: {
    userSearch: {
      name: {
        value: 'Grace',
        error: null,
        touched: true,
        dirty: true,
        defaultValue: 'Ada',
      },
    },
  },
  queries: {
    searchUsers: {
      status: 'success',
      data: ['Ada', 'Grace'],
      error: {
        code: 'network',
        message: 'Recovered error',
      },
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

const nestedQueryRuntimeState: RuntimeState = {
  ...runtimeState,
  queries: {
    ...runtimeState.queries,
    searchUsers: {
      status: 'success',
      data: {
        user: {
          profile: {
            name: 'Ada',
          },
        },
        results: [
          {
            id: 'user-1',
            name: 'Ada',
          },
          {
            id: 'user-2',
            name: 'Grace',
          },
        ],
        sections: [
          {
            items: [{ label: 'Alpha' }, { label: 'Beta' }, { label: 'Gamma' }],
          },
        ],
        years: {
          '2024': {
            label: 'Q1',
          },
        },
        total: 3,
      },
      error: {
        code: 'network',
        message: 'Recovered error',
      },
    },
  },
}

const iterationContext = {
  item: {
    id: 'post-1',
    slug: 'hello-world',
    author: {
      name: 'Ada',
    },
    tags: ['news', 'featured'],
    stats: null,
  },
}

const interpolationRuntimeState: RuntimeState = {
  ...nestedQueryRuntimeState,
  navigation: {
    currentPageId: 'details',
    history: [
      {
        entryId: 0,
        pageId: 'details',
        params: {
          userId: '42',
        },
      },
    ],
    currentEntryIndex: 0,
    lastError: null,
  },
  queries: {
    ...nestedQueryRuntimeState.queries,
    scalarValues: {
      status: 'success',
      data: {
        text: 'Ada',
        emptyText: '',
        zero: 0,
        falseValue: false,
        objectValue: {
          name: 'Ada',
        },
        arrayValue: ['Ada'],
        nullValue: null,
        undefinedValue: undefined,
      },
      error: null,
    },
  },
  pageEntry: {
    entryId: 0,
    pageId: 'details',
    params: {
      userId: '42',
    },
    preloadNames: [],
    status: 'idle',
  },
}

describe('Runtime reference resolution', () => {
  describe('T0007-01 parser contract', () => {
    it('classifies supported forms and queries paths as dynamic references', () => {
      expect(parseRuntimeReference('forms.userSearch.name')).toMatchObject({
        kind: 'reference',
        status: 'supported',
        namespace: 'forms',
        path: ['userSearch', 'name'],
      })

      expect(parseRuntimeReference('queries.searchUsers.data')).toMatchObject({
        kind: 'reference',
        status: 'supported',
        namespace: 'queries',
        path: ['searchUsers', 'data'],
      })

      expect(parseRuntimeReference('params.userId')).toMatchObject({
        kind: 'reference',
        status: 'supported',
        namespace: 'params',
        path: ['userId'],
      })
    })

    it('classifies reserved namespaces as unsupported', () => {
      expect(parseRuntimeReference('navigation.currentPageId')).toMatchObject({
        kind: 'reference',
        status: 'unsupported',
        namespace: 'navigation',
        path: ['currentPageId'],
      })

      expect(parseRuntimeReference('routeParams.userId')).toMatchObject({
        kind: 'reference',
        status: 'unsupported',
        namespace: 'routeParams',
        path: ['userId'],
      })

      expect(parseRuntimeReference('params.user.id')).toMatchObject({
        kind: 'reference',
        status: 'invalid',
        namespace: 'params',
      })
    })

    it('treats escaped references as visible literal text', () => {
      expect(parseRuntimeReference('\\forms.userSearch.name')).toEqual({
        kind: 'literal',
        value: 'forms.userSearch.name',
      })
    })

    it('keeps partial interpolation-like text as literal', () => {
      expect(parseRuntimeReference('User: forms.userSearch.name')).toEqual({
        kind: 'literal',
        value: 'User: forms.userSearch.name',
      })
    })

    it('classifies malformed supported namespaces as invalid with a uniform result', () => {
      expect(parseRuntimeReference('forms')).toMatchObject({
        kind: 'reference',
        status: 'invalid',
        namespace: 'forms',
      })

      expect(parseRuntimeReference('forms.userSearch')).toMatchObject({
        kind: 'reference',
        status: 'invalid',
        namespace: 'forms',
      })

      expect(parseRuntimeReference('queries')).toMatchObject({
        kind: 'reference',
        status: 'invalid',
        namespace: 'queries',
      })

      expect(parseRuntimeReference('queries.searchUsers.error.message')).toMatchObject({
        kind: 'reference',
        status: 'invalid',
        namespace: 'queries',
      })

      expect(parseRuntimeReference('forms.user Search.name')).toMatchObject({
        kind: 'reference',
        status: 'invalid',
        namespace: 'forms',
      })

      expect(parseRuntimeReference('queries.searchUsers.status ')).toMatchObject({
        kind: 'reference',
        status: 'invalid',
        namespace: 'queries',
      })

      expect(parseRuntimeReference('params')).toMatchObject({
        kind: 'reference',
        status: 'invalid',
        namespace: 'params',
      })

      expect(parseRuntimeReference('params.user.id')).toMatchObject({
        kind: 'reference',
        status: 'invalid',
        namespace: 'params',
      })
    })
  })

  describe('T0008-01 nested query reference parser contract', () => {
    it('classifies nested query data paths as supported references', () => {
      expect(parseRuntimeReference('queries.searchUsers.data.results.0.name')).toMatchObject({
        kind: 'reference',
        status: 'supported',
        namespace: 'queries',
        path: ['searchUsers', 'data', 'results', '0', 'name'],
      })

      expect(parseRuntimeReference('queries.searchUsers.data.user.profile.name')).toMatchObject({
        kind: 'reference',
        status: 'supported',
        namespace: 'queries',
        path: ['searchUsers', 'data', 'user', 'profile', 'name'],
      })
    })

    it('keeps the current base query routes classified exactly as before', () => {
      expect(parseRuntimeReference('queries.searchUsers')).toMatchObject({
        kind: 'reference',
        status: 'supported',
        namespace: 'queries',
        path: ['searchUsers'],
      })

      expect(parseRuntimeReference('queries.searchUsers.data')).toMatchObject({
        kind: 'reference',
        status: 'supported',
        namespace: 'queries',
        path: ['searchUsers', 'data'],
      })

      expect(parseRuntimeReference('queries.searchUsers.status')).toMatchObject({
        kind: 'reference',
        status: 'supported',
        namespace: 'queries',
        path: ['searchUsers', 'status'],
      })

      expect(parseRuntimeReference('queries.searchUsers.error')).toMatchObject({
        kind: 'reference',
        status: 'supported',
        namespace: 'queries',
        path: ['searchUsers', 'error'],
      })
    })

    it('keeps status and error branches closed to additional navigation', () => {
      expect(parseRuntimeReference('queries.searchUsers.error.message')).toMatchObject({
        kind: 'reference',
        status: 'invalid',
        namespace: 'queries',
      })

      expect(parseRuntimeReference('queries.searchUsers.status.label')).toMatchObject({
        kind: 'reference',
        status: 'invalid',
        namespace: 'queries',
      })
    })

    it('classifies malformed nested query routes as invalid', () => {
      expect(parseRuntimeReference('queries')).toMatchObject({
        kind: 'reference',
        status: 'invalid',
        namespace: 'queries',
      })

      expect(parseRuntimeReference('queries.searchUsers.data.')).toMatchObject({
        kind: 'reference',
        status: 'invalid',
        namespace: 'queries',
      })

      expect(parseRuntimeReference('queries.searchUsers.data..results')).toMatchObject({
        kind: 'reference',
        status: 'invalid',
        namespace: 'queries',
      })

      expect(parseRuntimeReference('queries.searchUsers.data.results.')).toMatchObject({
        kind: 'reference',
        status: 'invalid',
        namespace: 'queries',
      })
    })

    it('keeps escaped nested query references as visible literal text', () => {
      expect(parseRuntimeReference('\\queries.searchUsers.data.results.0.name')).toEqual({
        kind: 'literal',
        value: 'queries.searchUsers.data.results.0.name',
      })
    })
  })

  describe('T0024-02 item reference parser contract', () => {
    it('classifies item references as unsupported outside explicit iteration context', () => {
      expect(parseRuntimeReference('item')).toMatchObject({
        kind: 'reference',
        status: 'unsupported',
        namespace: 'item',
        path: [],
      })

      expect(parseRuntimeReference('item.author.name')).toMatchObject({
        kind: 'reference',
        status: 'unsupported',
        namespace: 'item',
        path: ['author', 'name'],
      })
    })

    it('classifies item references as supported when iteration context is enabled', () => {
      expect(parseRuntimeReference('item', { allowItemReference: true })).toMatchObject({
        kind: 'reference',
        status: 'supported',
        namespace: 'item',
        path: [],
      })

      expect(parseRuntimeReference('item.tags.0', { allowItemReference: true })).toMatchObject({
        kind: 'reference',
        status: 'supported',
        namespace: 'item',
        path: ['tags', '0'],
      })
    })

    it('keeps malformed item references invalid and escaped item references literal', () => {
      expect(parseRuntimeReference('item.')).toMatchObject({
        kind: 'reference',
        status: 'invalid',
        namespace: 'item',
      })

      expect(parseRuntimeReference('item..slug')).toMatchObject({
        kind: 'reference',
        status: 'invalid',
        namespace: 'item',
      })

      expect(parseRuntimeReference('\\item.slug')).toEqual({
        kind: 'literal',
        value: 'item.slug',
      })
    })
  })

  describe('T0007-02 store-backed resolution', () => {
    it('reads current form values from the shared runtime state', () => {
      expect(resolveRuntimeReference('forms.userSearch.name', runtimeState)).toEqual({
        status: 'resolved',
        value: 'Grace',
        reference: parseRuntimeReference('forms.userSearch.name'),
      })
    })

    it('reads current page params from the active navigation entry', () => {
      const stateWithParams: RuntimeState = {
        ...runtimeState,
        navigation: {
          currentPageId: 'details',
          history: [
            { entryId: 0, pageId: 'home', params: {} },
            { entryId: 1, pageId: 'details', params: { userId: '42' } },
          ],
          currentEntryIndex: 1,
          lastError: null,
        },
        pageEntry: {
          entryId: 1,
          pageId: 'details',
          params: { userId: '42' },
          preloadNames: [],
          status: 'idle',
        },
      }

      expect(resolveRuntimeReference('params.userId', stateWithParams)).toEqual({
        status: 'resolved',
        value: '42',
        reference: parseRuntimeReference('params.userId'),
      })

      expect(resolveRuntimeReference('params.missing', stateWithParams)).toEqual({
        status: 'missing',
        reference: parseRuntimeReference('params.missing'),
      })
    })

    it('reads full query state and official query subpaths', () => {
      expect(resolveRuntimeReference('queries.searchUsers', runtimeState)).toEqual({
        status: 'resolved',
        value: runtimeState.queries.searchUsers,
        reference: parseRuntimeReference('queries.searchUsers'),
      })

      expect(resolveRuntimeReference('queries.searchUsers.data', runtimeState)).toEqual({
        status: 'resolved',
        value: ['Ada', 'Grace'],
        reference: parseRuntimeReference('queries.searchUsers.data'),
      })

      expect(resolveRuntimeReference('queries.searchUsers.status', runtimeState)).toEqual({
        status: 'resolved',
        value: 'success',
        reference: parseRuntimeReference('queries.searchUsers.status'),
      })

      expect(resolveRuntimeReference('queries.searchUsers.error', runtimeState)).toEqual({
        status: 'resolved',
        value: runtimeState.queries.searchUsers.error,
        reference: parseRuntimeReference('queries.searchUsers.error'),
      })
    })

    it('returns the same current value for repeated reads of the same reference', () => {
      const firstRead = resolveRuntimeReference('queries.searchUsers', runtimeState)
      const secondRead = resolveRuntimeReference('queries.searchUsers', runtimeState)

      expect(firstRead.status).toBe('resolved')
      expect(secondRead.status).toBe('resolved')

      if (firstRead.status === 'resolved' && secondRead.status === 'resolved') {
        expect(firstRead.value).toBe(runtimeState.queries.searchUsers)
        expect(secondRead.value).toBe(runtimeState.queries.searchUsers)
      }
    })

    it('returns missing for supported routes whose value does not exist yet', () => {
      expect(resolveRuntimeReference('forms.userSearch.email', runtimeState)).toEqual({
        status: 'missing',
        reference: parseRuntimeReference('forms.userSearch.email'),
      })

      expect(resolveRuntimeReference('queries.pendingUsers.data', runtimeState)).toEqual({
        status: 'missing',
        reference: parseRuntimeReference('queries.pendingUsers.data'),
      })
    })

    it('keeps existing supported routes resolved when their current value is null or undefined', () => {
      const runtimeStateWithNullableValues: RuntimeState = {
        ...runtimeState,
        forms: {
          userSearch: {
            ...runtimeState.forms.userSearch,
            nickname: {
              value: undefined,
              error: null,
              touched: false,
              dirty: false,
            },
          },
        },
        queries: {
          searchUsers: {
            ...runtimeState.queries.searchUsers,
            data: null,
            error: null,
          },
        },
      }

      expect(resolveRuntimeReference('forms.userSearch.nickname', runtimeStateWithNullableValues)).toEqual({
        status: 'resolved',
        value: undefined,
        reference: parseRuntimeReference('forms.userSearch.nickname'),
      })

      expect(resolveRuntimeReference('queries.searchUsers.data', runtimeStateWithNullableValues)).toEqual({
        status: 'resolved',
        value: null,
        reference: parseRuntimeReference('queries.searchUsers.data'),
      })

      expect(resolveRuntimeReference('queries.searchUsers.error', runtimeStateWithNullableValues)).toEqual({
        status: 'resolved',
        value: null,
        reference: parseRuntimeReference('queries.searchUsers.error'),
      })
    })

    it('keeps unsupported and invalid routes distinct from missing ones', () => {
      expect(resolveRuntimeReference('queries.searchUsers.foo', runtimeState)).toEqual({
        status: 'invalid',
        reference: parseRuntimeReference('queries.searchUsers.foo'),
      })

      expect(resolveRuntimeReference('forms.userSearch.name.error', runtimeState)).toEqual({
        status: 'invalid',
        reference: parseRuntimeReference('forms.userSearch.name.error'),
      })

      expect(resolveRuntimeReference('item.slug', runtimeState)).toEqual({
        status: 'unsupported',
        reference: parseRuntimeReference('item.slug'),
      })
    })
  })

  describe('T0008-02 nested query data resolution', () => {
    it('resolves nested query data paths through objects and arrays', () => {
      expect(resolveRuntimeReference('queries.searchUsers.data.user.profile.name', nestedQueryRuntimeState)).toEqual({
        status: 'resolved',
        value: 'Ada',
        reference: parseRuntimeReference('queries.searchUsers.data.user.profile.name'),
      })

      expect(resolveRuntimeReference('queries.searchUsers.data.results.0.id', nestedQueryRuntimeState)).toEqual({
        status: 'resolved',
        value: 'user-1',
        reference: parseRuntimeReference('queries.searchUsers.data.results.0.id'),
      })
    })

    it('resolves mixed object and array paths from left to right', () => {
      expect(
        resolveRuntimeReference('queries.searchUsers.data.sections.0.items.2.label', nestedQueryRuntimeState),
      ).toEqual({
        status: 'resolved',
        value: 'Gamma',
        reference: parseRuntimeReference('queries.searchUsers.data.sections.0.items.2.label'),
      })
    })

    it('treats numeric segments as indexes only for arrays and as literal keys for objects', () => {
      expect(resolveRuntimeReference('queries.searchUsers.data.results.1.name', nestedQueryRuntimeState)).toEqual({
        status: 'resolved',
        value: 'Grace',
        reference: parseRuntimeReference('queries.searchUsers.data.results.1.name'),
      })

      expect(resolveRuntimeReference('queries.searchUsers.data.years.2024.label', nestedQueryRuntimeState)).toEqual({
        status: 'resolved',
        value: 'Q1',
        reference: parseRuntimeReference('queries.searchUsers.data.years.2024.label'),
      })
    })

    it('returns missing for absent nested data or attempts to go deeper into primitives', () => {
      const runtimeStateWithUndefinedData: RuntimeState = {
        ...nestedQueryRuntimeState,
        queries: {
          ...nestedQueryRuntimeState.queries,
          searchUsers: {
            ...nestedQueryRuntimeState.queries.searchUsers,
            data: undefined,
          },
        },
      }

      expect(resolveRuntimeReference('queries.pendingUsers.data.results.0.id', nestedQueryRuntimeState)).toEqual({
        status: 'missing',
        reference: parseRuntimeReference('queries.pendingUsers.data.results.0.id'),
      })

      expect(resolveRuntimeReference('queries.searchUsers.data.user.address.city', nestedQueryRuntimeState)).toEqual({
        status: 'missing',
        reference: parseRuntimeReference('queries.searchUsers.data.user.address.city'),
      })

      expect(resolveRuntimeReference('queries.searchUsers.data.results.9.id', nestedQueryRuntimeState)).toEqual({
        status: 'missing',
        reference: parseRuntimeReference('queries.searchUsers.data.results.9.id'),
      })

      expect(resolveRuntimeReference('queries.searchUsers.data.total.value', nestedQueryRuntimeState)).toEqual({
        status: 'missing',
        reference: parseRuntimeReference('queries.searchUsers.data.total.value'),
      })

      expect(resolveRuntimeReference('queries.searchUsers.data.user.profile.name.first', nestedQueryRuntimeState)).toEqual({
        status: 'missing',
        reference: parseRuntimeReference('queries.searchUsers.data.user.profile.name.first'),
      })

      expect(
        resolveRuntimeReference('queries.searchUsers.data.results.0.id.value', nestedQueryRuntimeState),
      ).toEqual({
        status: 'missing',
        reference: parseRuntimeReference('queries.searchUsers.data.results.0.id.value'),
      })

      expect(
        resolveRuntimeReference('queries.searchUsers.data.user.profile.name.first', runtimeStateWithUndefinedData),
      ).toEqual({
        status: 'missing',
        reference: parseRuntimeReference('queries.searchUsers.data.user.profile.name.first'),
      })

      expect(
        resolveRuntimeReference('queries.searchUsers.data.user.constructor.name', nestedQueryRuntimeState),
      ).toEqual({
        status: 'missing',
        reference: parseRuntimeReference('queries.searchUsers.data.user.constructor.name'),
      })
    })

    it('keeps the current base query routes resolved with their existing meaning', () => {
      expect(resolveRuntimeReference('queries.searchUsers', nestedQueryRuntimeState)).toEqual({
        status: 'resolved',
        value: nestedQueryRuntimeState.queries.searchUsers,
        reference: parseRuntimeReference('queries.searchUsers'),
      })

      expect(resolveRuntimeReference('queries.searchUsers.data', nestedQueryRuntimeState)).toEqual({
        status: 'resolved',
        value: nestedQueryRuntimeState.queries.searchUsers.data,
        reference: parseRuntimeReference('queries.searchUsers.data'),
      })

      expect(resolveRuntimeReference('queries.searchUsers.status', nestedQueryRuntimeState)).toEqual({
        status: 'resolved',
        value: 'success',
        reference: parseRuntimeReference('queries.searchUsers.status'),
      })

      expect(resolveRuntimeReference('queries.searchUsers.error', nestedQueryRuntimeState)).toEqual({
        status: 'resolved',
        value: nestedQueryRuntimeState.queries.searchUsers.error,
        reference: parseRuntimeReference('queries.searchUsers.error'),
      })
    })
  })

  describe('T0024-02 item resolution with explicit iteration context', () => {
    it('resolves the full current item and nested item paths', () => {
      expect(resolveRuntimeReference('item', runtimeState, { iterationContext })).toEqual({
        status: 'resolved',
        value: iterationContext.item,
        reference: parseRuntimeReference('item', { allowItemReference: true }),
      })

      expect(resolveRuntimeReference('item.slug', runtimeState, { iterationContext })).toEqual({
        status: 'resolved',
        value: 'hello-world',
        reference: parseRuntimeReference('item.slug', { allowItemReference: true }),
      })

      expect(resolveRuntimeReference('item.author.name', runtimeState, { iterationContext })).toEqual({
        status: 'resolved',
        value: 'Ada',
        reference: parseRuntimeReference('item.author.name', { allowItemReference: true }),
      })

      expect(resolveRuntimeReference('item.tags.1', runtimeState, { iterationContext })).toEqual({
        status: 'resolved',
        value: 'featured',
        reference: parseRuntimeReference('item.tags.1', { allowItemReference: true }),
      })
    })

    it('returns missing when item paths are valid but the current item does not provide navigable data', () => {
      expect(resolveRuntimeReference('item.author.role', runtimeState, { iterationContext })).toEqual({
        status: 'missing',
        reference: parseRuntimeReference('item.author.role', { allowItemReference: true }),
      })

      expect(resolveRuntimeReference('item.tags.9', runtimeState, { iterationContext })).toEqual({
        status: 'missing',
        reference: parseRuntimeReference('item.tags.9', { allowItemReference: true }),
      })

      expect(resolveRuntimeReference('item.tags.label', runtimeState, { iterationContext })).toEqual({
        status: 'missing',
        reference: parseRuntimeReference('item.tags.label', { allowItemReference: true }),
      })

      expect(resolveRuntimeReference('item.stats.total', runtimeState, { iterationContext })).toEqual({
        status: 'missing',
        reference: parseRuntimeReference('item.stats.total', { allowItemReference: true }),
      })
    })

    it('keeps forms, queries and params semantics unchanged while item context exists', () => {
      expect(resolveRuntimeReference('forms.userSearch.name', runtimeState, { iterationContext })).toEqual({
        status: 'resolved',
        value: 'Grace',
        reference: parseRuntimeReference('forms.userSearch.name'),
      })

      expect(resolveRuntimeReference('queries.searchUsers.status', runtimeState, { iterationContext })).toEqual({
        status: 'resolved',
        value: 'success',
        reference: parseRuntimeReference('queries.searchUsers.status'),
      })

      expect(resolveRuntimeReference('params.userId', runtimeState, { iterationContext })).toEqual({
        status: 'missing',
        reference: parseRuntimeReference('params.userId'),
      })
    })
  })

  describe('T0033-02 visible value resolution for image surfaces', () => {
    it('keeps literal strings and scalar resolved values visible across surfaces', () => {
      expect(resolveRuntimeVisibleValue('Plain text', runtimeState, 'image.props.alt')).toBe('Plain text')
      expect(resolveRuntimeVisibleValue('queries.searchUsers.data.1', runtimeState, 'image.props.alt')).toBe('Grace')
      expect(resolveRuntimeVisibleValue('queries.searchUsers.status', runtimeState, 'image.props.alt')).toBe('success')
    })

    it('normalizes image src and alt independently from the shared visible value helper', () => {
      expect(resolveRuntimeImageSource('/media/hero.png', runtimeState)).toBe('/media/hero.png')
      expect(resolveRuntimeImageSource('queries.searchUsers.data.1', runtimeState)).toBe('Grace')
      expect(resolveRuntimeImageSource('queries.searchUsers.status', runtimeState)).toBe('success')
      expect(resolveRuntimeImageSource('queries.searchUsers.data', runtimeState)).toBeNull()

      expect(resolveRuntimeImageAlt('/media/hero.png', runtimeState)).toBe('/media/hero.png')
      expect(resolveRuntimeImageAlt('queries.searchUsers.data.1', runtimeState)).toBe('Grace')
      expect(resolveRuntimeImageAlt('queries.searchUsers.data', runtimeState)).toBe('')
    })

    it('keeps item context available to the shared visible value helper', () => {
      expect(resolveRuntimeVisibleValue('item.author.name', runtimeState, 'image.props.alt', { iterationContext })).toBe('Ada')
      expect(resolveRuntimeImageSource('item.slug', runtimeState, { iterationContext })).toBe('hello-world')
    })
  })

  describe('T0040-01 visible string interpolation', () => {
    it('interpolates one or more placeholders while preserving surrounding literal text', () => {
      expect(
        resolveRuntimeVisibleValue(
          'Hola {{queries.scalarValues.data.text}}',
          interpolationRuntimeState,
          'heading.props.text',
        ),
      ).toBe('Hola Ada')
      expect(
        resolveRuntimeVisibleValue(
          '{{queries.scalarValues.data.text}}:{{queries.scalarValues.data.zero}}:{{queries.scalarValues.data.falseValue}}',
          interpolationRuntimeState,
          'heading.props.text',
        ),
      ).toBe('Ada:0:false')
      expect(
        resolveRuntimeVisibleValue(
          '{{ queries.scalarValues.data.text }} signed in as {{ forms.userSearch.name }} for {{ params.userId }}',
          interpolationRuntimeState,
          'paragraph.props.text',
        ),
      ).toBe('Ada signed in as Grace for 42')
      expect(
        resolveRuntimeVisibleValue(
          'First {{queries.scalarValues.data.text}} last {{queries.scalarValues.data.zero}}',
          interpolationRuntimeState,
          'paragraph.props.text',
        ),
      ).toBe('First Ada last 0')
    })

    it('converts only scalar placeholder values to visible text and keeps empty strings explicit', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

      expect(
        resolveRuntimeVisibleValue(
          '{{queries.scalarValues.data.emptyText}}',
          interpolationRuntimeState,
          'heading.props.text',
        ),
      ).toBe('')
      expect(
        resolveRuntimeVisibleValue(
          '{{queries.scalarValues.data.objectValue}}',
          interpolationRuntimeState,
          'heading.props.text',
        ),
      ).toBe('')
      expect(
        resolveRuntimeVisibleValue(
          '{{queries.scalarValues.data.arrayValue}}',
          interpolationRuntimeState,
          'heading.props.text',
        ),
      ).toBe('')
      expect(
        resolveRuntimeVisibleValue(
          '{{queries.scalarValues.data.nullValue}}',
          interpolationRuntimeState,
          'heading.props.text',
        ),
      ).toBe('')
      expect(
        resolveRuntimeVisibleValue(
          '{{queries.scalarValues.data.undefinedValue}}',
          interpolationRuntimeState,
          'heading.props.text',
        ),
      ).toBe('')
      expect(
        resolveRuntimeVisibleValue(
          '{{queries.scalarValues.data.missingValue}}',
          interpolationRuntimeState,
          'heading.props.text',
        ),
      ).toBe('')
      expect(resolveRuntimeVisibleValue('{{params.user.id}}', interpolationRuntimeState, 'heading.props.text')).toBe('')
      expect(resolveRuntimeVisibleValue('{{navigation.currentPageId}}', interpolationRuntimeState, 'heading.props.text')).toBe('')
      expect(resolveRuntimeVisibleValue('{{foo.bar}}', interpolationRuntimeState, 'heading.props.text')).toBe('')
      expect(resolveRuntimeVisibleValue('{{texto}}', interpolationRuntimeState, 'heading.props.text')).toBe('')
      expect(resolveRuntimeVisibleValue('{{}}', interpolationRuntimeState, 'heading.props.text')).toBe('')

      consoleWarnSpy.mockRestore()
    })

    it('resolves item placeholders only when an iteration context is available', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

      expect(
        resolveRuntimeVisibleValue('Post {{item.id}} by {{item.author.name}}', runtimeState, 'heading.props.text', {
          iterationContext,
        }),
      ).toBe('Post post-1 by Ada')
      expect(resolveRuntimeVisibleValue('Post {{item.id}}', runtimeState, 'heading.props.text')).toBe('Post ')

      consoleWarnSpy.mockRestore()
    })

    it('keeps strings without complete placeholders on the historical literal or full-reference path', () => {
      expect(resolveRuntimeVisibleValue('queries.scalarValues.data.text', interpolationRuntimeState, 'heading.props.text')).toBe(
        'Ada',
      )
      expect(resolveRuntimeVisibleValue('\\queries.scalarValues.data.text', interpolationRuntimeState, 'heading.props.text')).toBe(
        'queries.scalarValues.data.text',
      )
      expect(
        resolveRuntimeVisibleValue('User: queries.scalarValues.data.text', interpolationRuntimeState, 'heading.props.text'),
      ).toBe('User: queries.scalarValues.data.text')
      expect(
        resolveRuntimeVisibleValue('Keep {{queries.scalarValues.data.text', interpolationRuntimeState, 'heading.props.text'),
      ).toBe('Keep {{queries.scalarValues.data.text')
      expect(
        resolveRuntimeVisibleValue('Keep queries.scalarValues.data.text}}', interpolationRuntimeState, 'heading.props.text'),
      ).toBe('Keep queries.scalarValues.data.text}}')
    })
  })
})
