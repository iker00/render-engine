import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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

    it('classifies error.message and error.code as supported sub-paths', () => {
      expect(parseRuntimeReference('queries.searchUsers.error.message')).toMatchObject({
        kind: 'reference',
        status: 'supported',
        namespace: 'queries',
        path: ['searchUsers', 'error', 'message'],
      })

      expect(parseRuntimeReference('queries.searchUsers.error.code')).toMatchObject({
        kind: 'reference',
        status: 'supported',
        namespace: 'queries',
        path: ['searchUsers', 'error', 'code'],
      })
    })

    it('keeps status branch and unlisted error sub-paths closed to additional navigation', () => {
      expect(parseRuntimeReference('queries.searchUsers.status.label')).toMatchObject({
        kind: 'reference',
        status: 'invalid',
        namespace: 'queries',
      })

      expect(parseRuntimeReference('queries.searchUsers.error.token')).toMatchObject({
        kind: 'reference',
        status: 'invalid',
        namespace: 'queries',
      })

      expect(parseRuntimeReference('queries.searchUsers.error.message.foo')).toMatchObject({
        kind: 'reference',
        status: 'invalid',
        namespace: 'queries',
      })

      expect(parseRuntimeReference('queries.searchUsers.error.code.bar')).toMatchObject({
        kind: 'reference',
        status: 'invalid',
        namespace: 'queries',
      })
    })

    it('keeps error references with empty segments as invalid', () => {
      expect(parseRuntimeReference('queries.searchUsers.error.')).toMatchObject({
        kind: 'reference',
        status: 'invalid',
        namespace: 'queries',
      })

      expect(parseRuntimeReference('queries.searchUsers.error..message')).toMatchObject({
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

  describe('T0060-03 error.message and error.code resolution', () => {
    const stateWithActiveError: RuntimeState = {
      ...runtimeState,
      queries: {
        ...runtimeState.queries,
        searchUsers: {
          status: 'error',
          data: null,
          error: {
            code: 'http-error',
            message: 'HTTP 500',
          },
        },
      },
    }

    const stateWithNullError: RuntimeState = {
      ...runtimeState,
      queries: {
        ...runtimeState.queries,
        searchUsers: {
          status: 'success',
          data: ['Ada'],
          error: null,
        },
      },
    }

    it('resolves error.message to the message string when the query has an active error', () => {
      expect(resolveRuntimeReference('queries.searchUsers.error.message', stateWithActiveError)).toEqual({
        status: 'resolved',
        value: 'HTTP 500',
        reference: parseRuntimeReference('queries.searchUsers.error.message'),
      })
    })

    it('resolves error.code to the code string when the query has an active error', () => {
      expect(resolveRuntimeReference('queries.searchUsers.error.code', stateWithActiveError)).toEqual({
        status: 'resolved',
        value: 'http-error',
        reference: parseRuntimeReference('queries.searchUsers.error.code'),
      })
    })

    it('returns missing for error.message when the query has no active error (error is null)', () => {
      expect(resolveRuntimeReference('queries.searchUsers.error.message', stateWithNullError)).toEqual({
        status: 'missing',
        reference: parseRuntimeReference('queries.searchUsers.error.message'),
      })
    })

    it('returns missing for error.code when the query does not exist in the store', () => {
      expect(resolveRuntimeReference('queries.nonExistent.error.code', runtimeState)).toEqual({
        status: 'missing',
        reference: parseRuntimeReference('queries.nonExistent.error.code'),
      })
    })

    it('returns missing when error.code is undefined (optional field)', () => {
      const stateWithErrorWithoutCode: RuntimeState = {
        ...runtimeState,
        queries: {
          ...runtimeState.queries,
          searchUsers: {
            status: 'error',
            data: null,
            error: {
              code: undefined as unknown as string,
              message: 'Some error',
            },
          },
        },
      }

      expect(resolveRuntimeReference('queries.searchUsers.error.code', stateWithErrorWithoutCode)).toEqual({
        status: 'missing',
        reference: parseRuntimeReference('queries.searchUsers.error.code'),
      })
    })

    it('keeps error root reference resolved as the full error object (regression)', () => {
      expect(resolveRuntimeReference('queries.searchUsers.error', stateWithActiveError)).toEqual({
        status: 'resolved',
        value: stateWithActiveError.queries.searchUsers.error,
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

  describe('T0045-01 item.$key parser and resolver contract', () => {
    it('classifies item.$key as a supported reference when iteration context is enabled', () => {
      expect(parseRuntimeReference('item.$key', { allowItemReference: true })).toMatchObject({
        kind: 'reference',
        status: 'supported',
        namespace: 'item',
        path: ['$key'],
      })
    })

    it('classifies item.$key as unsupported outside explicit iteration context', () => {
      expect(parseRuntimeReference('item.$key')).toMatchObject({
        kind: 'reference',
        status: 'unsupported',
        namespace: 'item',
        path: ['$key'],
      })
    })

    it('keeps forms with $ other than the exact item.$key literal as invalid', () => {
      expect(parseRuntimeReference('item.$key.algo', { allowItemReference: true })).toMatchObject({
        kind: 'reference',
        status: 'invalid',
        namespace: 'item',
      })

      expect(parseRuntimeReference('item.algo.$key', { allowItemReference: true })).toMatchObject({
        kind: 'reference',
        status: 'invalid',
        namespace: 'item',
      })

      expect(parseRuntimeReference('item.$other', { allowItemReference: true })).toMatchObject({
        kind: 'reference',
        status: 'invalid',
        namespace: 'item',
      })

      expect(parseRuntimeReference('item.$key2', { allowItemReference: true })).toMatchObject({
        kind: 'reference',
        status: 'invalid',
        namespace: 'item',
      })
    })

    it('resolves item.$key to the dictionary key when the iteration context provides itemKey', () => {
      const iterationContextWithKey = { item: { name: 'Ada' }, key: 'entry-1', itemKey: 'vinfopol' }

      expect(resolveRuntimeReference('item.$key', runtimeState, { iterationContext: iterationContextWithKey })).toEqual({
        status: 'resolved',
        value: 'vinfopol',
        reference: parseRuntimeReference('item.$key', { allowItemReference: true }),
      })
    })

    it('resolves item.$key as missing when iteration context does not provide itemKey (array source)', () => {
      const iterationContextWithoutKey = { item: { name: 'Ada' }, key: 'entry-1' }

      expect(resolveRuntimeReference('item.$key', runtimeState, { iterationContext: iterationContextWithoutKey })).toEqual({
        status: 'missing',
        reference: parseRuntimeReference('item.$key', { allowItemReference: true }),
      })
    })

    it('resolves item.$key as unsupported when evaluated outside an iteration context', () => {
      expect(resolveRuntimeReference('item.$key', runtimeState)).toEqual({
        status: 'unsupported',
        reference: parseRuntimeReference('item.$key'),
      })
    })

    it('degrades item.$key to empty string in text surfaces when itemKey is absent', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
      const iterationContextWithoutKey = { item: { name: 'Ada' }, key: 'entry-1' }

      expect(
        resolveRuntimeVisibleValue('item.$key', runtimeState, 'heading.props.text', {
          iterationContext: iterationContextWithoutKey,
        }),
      ).toBe('')

      consoleWarnSpy.mockRestore()
    })

    it('resolves {{item.$key}} interpolated as the dictionary key string', () => {
      const iterationContextWithKey = { item: { name: 'Ada' }, key: 'entry-1', itemKey: 'vinfopol' }

      expect(
        resolveRuntimeVisibleValue('Source: {{item.$key}}', runtimeState, 'heading.props.text', {
          iterationContext: iterationContextWithKey,
        }),
      ).toBe('Source: vinfopol')
    })

    it('keeps item.{ruta} navigation within the item value unaffected, including a value with a literal $key property', () => {
      const iterationContextWithKey = {
        item: { name: 'Ada', $key: 'internal-value' },
        key: 'entry-1',
        itemKey: 'vinfopol',
      }

      expect(
        resolveRuntimeReference('item.name', runtimeState, { iterationContext: iterationContextWithKey }),
      ).toEqual({
        status: 'resolved',
        value: 'Ada',
        reference: parseRuntimeReference('item.name', { allowItemReference: true }),
      })

      // item.$key always resolves to itemKey (synthetic), not the internal $key property of the item value
      expect(
        resolveRuntimeReference('item.$key', runtimeState, { iterationContext: iterationContextWithKey }),
      ).toEqual({
        status: 'resolved',
        value: 'vinfopol',
        reference: parseRuntimeReference('item.$key', { allowItemReference: true }),
      })
    })
  })

  describe('T0050-03 translations reference parser contract', () => {
    it('classifies translations.{key} with exactly one segment as a supported reference', () => {
      expect(parseRuntimeReference('translations.confirmBtn')).toMatchObject({
        kind: 'reference',
        status: 'supported',
        namespace: 'translations',
        path: ['confirmBtn'],
      })
    })

    it('classifies translations without any segment as invalid', () => {
      expect(parseRuntimeReference('translations')).toMatchObject({
        kind: 'reference',
        status: 'invalid',
        namespace: 'translations',
      })
    })

    it('classifies translations.group.key with two segments as invalid', () => {
      expect(parseRuntimeReference('translations.group.key')).toMatchObject({
        kind: 'reference',
        status: 'invalid',
        namespace: 'translations',
      })
    })

    it('classifies translations.with.too.many.segments as invalid', () => {
      expect(parseRuntimeReference('translations.with.too.many.segments')).toMatchObject({
        kind: 'reference',
        status: 'invalid',
        namespace: 'translations',
      })
    })

    it('classifies translations.confirm-btn with hyphens as valid (one segment)', () => {
      expect(parseRuntimeReference('translations.confirm-btn')).toMatchObject({
        kind: 'reference',
        status: 'supported',
        namespace: 'translations',
        path: ['confirm-btn'],
      })
    })

    it('classifies translations. with empty segment as invalid', () => {
      expect(parseRuntimeReference('translations.')).toMatchObject({
        kind: 'reference',
        status: 'invalid',
        namespace: 'translations',
      })
    })

    it('treats escaped translations.confirmBtn as a visible literal string', () => {
      expect(parseRuntimeReference('\\translations.confirmBtn')).toEqual({
        kind: 'literal',
        value: 'translations.confirmBtn',
      })
    })

    it('keeps translations.confirmBtn with trailing whitespace as invalid (segment contains space)', () => {
      expect(parseRuntimeReference('translations.confirmBtn ')).toMatchObject({
        kind: 'reference',
        status: 'invalid',
        namespace: 'translations',
      })
    })
  })

  describe('T0050-04 translations resolver with fallback chain', () => {
    const translationsState: RuntimeState = {
      ...runtimeState,
      modal: {
        activeModalId: null,
        activeIterationKey: null,
      },
      i18n: {
        translations: {
          confirmBtn: { es: 'Confirmar', en: 'Confirm' },
          onlyEn: { en: 'Only English' },
          onlyEs: { es: 'Solo español' },
        },
        activeLanguage: 'en',
      },
    }

    const translationsStateEs: RuntimeState = {
      ...translationsState,
      i18n: {
        ...translationsState.i18n,
        activeLanguage: 'es',
      },
    }

    const translationsStateFr: RuntimeState = {
      ...translationsState,
      i18n: {
        ...translationsState.i18n,
        activeLanguage: 'fr',
      },
    }

    const emptyTranslationsState: RuntimeState = {
      ...translationsState,
      i18n: {
        translations: {},
        activeLanguage: 'en',
      },
    }

    it('resolves translations.confirmBtn to the active language value when the key exists', () => {
      expect(resolveRuntimeReference('translations.confirmBtn', translationsState)).toEqual({
        status: 'resolved',
        value: 'Confirm',
        reference: parseRuntimeReference('translations.confirmBtn'),
      })

      expect(resolveRuntimeReference('translations.confirmBtn', translationsStateEs)).toEqual({
        status: 'resolved',
        value: 'Confirmar',
        reference: parseRuntimeReference('translations.confirmBtn'),
      })
    })

    it('falls back to the default language (es) when the active language lacks the key', () => {
      const stateFrWithOnlyEs: RuntimeState = {
        ...translationsState,
        i18n: {
          translations: { confirmBtn: { es: 'Confirmar', en: 'Confirm' } },
          activeLanguage: 'fr',
        },
      }

      expect(resolveRuntimeReference('translations.confirmBtn', stateFrWithOnlyEs)).toEqual({
        status: 'resolved',
        value: 'Confirmar',
        reference: parseRuntimeReference('translations.confirmBtn'),
      })
    })

    it('falls back to the default language (es) when activeLanguage is fr and only es and en exist', () => {
      expect(resolveRuntimeReference('translations.confirmBtn', translationsStateFr)).toEqual({
        status: 'resolved',
        value: 'Confirmar',
        reference: parseRuntimeReference('translations.confirmBtn'),
      })
    })

    it('skips to fallback when activeLanguage is es but the key only has en', () => {
      const stateEsOnlyEn: RuntimeState = {
        ...translationsState,
        i18n: {
          translations: { onlyEn: { en: 'Only English' } },
          activeLanguage: 'es',
        },
      }

      // In dev (Vitest default), fallback returns the key name
      expect(resolveRuntimeReference('translations.onlyEn', stateEsOnlyEn)).toEqual({
        status: 'resolved',
        value: 'onlyEn',
        reference: parseRuntimeReference('translations.onlyEn'),
      })
    })

    it('returns the key name in dev when the key does not exist in any language', () => {
      expect(resolveRuntimeReference('translations.missing', translationsState)).toEqual({
        status: 'resolved',
        value: 'missing',
        reference: parseRuntimeReference('translations.missing'),
      })
    })

    it('returns empty string in prod when the key does not exist in any language', () => {
      vi.stubEnv('DEV', false)

      try {
        expect(resolveRuntimeReference('translations.missing', translationsState)).toEqual({
          status: 'resolved',
          value: '',
          reference: parseRuntimeReference('translations.missing'),
        })
      } finally {
        vi.unstubAllEnvs()
      }
    })

    it('returns the key name in dev when translations is empty', () => {
      expect(resolveRuntimeReference('translations.confirmBtn', emptyTranslationsState)).toEqual({
        status: 'resolved',
        value: 'confirmBtn',
        reference: parseRuntimeReference('translations.confirmBtn'),
      })
    })

    it('returns empty string in prod when translations is empty', () => {
      vi.stubEnv('DEV', false)

      try {
        expect(resolveRuntimeReference('translations.confirmBtn', emptyTranslationsState)).toEqual({
          status: 'resolved',
          value: '',
          reference: parseRuntimeReference('translations.confirmBtn'),
        })
      } finally {
        vi.unstubAllEnvs()
      }
    })

    it('resolves {{translations.confirmBtn}} interpolated inside a larger string', () => {
      expect(
        resolveRuntimeVisibleValue('Texto: {{translations.confirmBtn}}', translationsStateEs, 'heading.props.text'),
      ).toBe('Texto: Confirmar')

      expect(
        resolveRuntimeVisibleValue('Texto: {{translations.confirmBtn}}', translationsState, 'heading.props.text'),
      ).toBe('Texto: Confirm')
    })

    it('keeps an invalid shape (translations.group.key) as invalid and degrades to empty string in visible value', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

      expect(resolveRuntimeReference('translations.group.key', translationsState)).toEqual({
        status: 'invalid',
        reference: parseRuntimeReference('translations.group.key'),
      })

      expect(
        resolveRuntimeVisibleValue('translations.group.key', translationsState, 'heading.props.text'),
      ).toBe('')

      consoleWarnSpy.mockRestore()
    })
  })

  describe('T0078-05 tokens reference parser contract', () => {
    it('classifies tokens.{id}.value as a supported reference', () => {
      expect(parseRuntimeReference('tokens.session.value')).toMatchObject({
        kind: 'reference',
        status: 'supported',
        namespace: 'tokens',
        path: ['session', 'value'],
      })
    })

    it('classifies tokens alone as invalid', () => {
      expect(parseRuntimeReference('tokens')).toMatchObject({
        kind: 'reference',
        status: 'invalid',
        namespace: 'tokens',
      })
    })

    it('classifies tokens.{id} with only one segment as invalid', () => {
      expect(parseRuntimeReference('tokens.session')).toMatchObject({
        kind: 'reference',
        status: 'invalid',
        namespace: 'tokens',
      })
    })

    it('classifies tokens.{id}.value.extra with extra segments as invalid', () => {
      expect(parseRuntimeReference('tokens.session.value.extra')).toMatchObject({
        kind: 'reference',
        status: 'invalid',
        namespace: 'tokens',
      })
    })

    it('classifies tokens.{id}.other (not .value) as invalid', () => {
      expect(parseRuntimeReference('tokens.session.other')).toMatchObject({
        kind: 'reference',
        status: 'invalid',
        namespace: 'tokens',
      })
    })

    it('treats escaped tokens.{id}.value as a visible literal string', () => {
      expect(parseRuntimeReference('\\tokens.session.value')).toEqual({
        kind: 'literal',
        value: 'tokens.session.value',
      })
    })
  })

  describe('T0078-05 tokens reference resolver contract', () => {
    const stateWithReadyToken: RuntimeState = {
      ...runtimeState,
      tokens: {
        session: { value: 'abc', status: 'ready', failedAttempts: 0 },
      },
    } as RuntimeState

    const stateWithRefreshingToken: RuntimeState = {
      ...runtimeState,
      tokens: {
        session: { value: 'abc', status: 'refreshing', failedAttempts: 0 },
      },
    } as RuntimeState

    const stateWithErrorToken: RuntimeState = {
      ...runtimeState,
      tokens: {
        session: { value: 'abc', status: 'error', failedAttempts: 2 },
      },
    } as RuntimeState

    const stateWithNoTokens: RuntimeState = {
      ...runtimeState,
      tokens: {},
    } as RuntimeState

    it('resolves tokens.{id}.value to the token value when status is ready', () => {
      expect(resolveRuntimeReference('tokens.session.value', stateWithReadyToken)).toEqual({
        status: 'resolved',
        value: 'abc',
        reference: parseRuntimeReference('tokens.session.value'),
      })
    })

    it('resolves tokens.{id}.value to the current value when status is refreshing (proactive refresh does not block)', () => {
      expect(resolveRuntimeReference('tokens.session.value', stateWithRefreshingToken)).toEqual({
        status: 'resolved',
        value: 'abc',
        reference: parseRuntimeReference('tokens.session.value'),
      })
    })

    it('returns token-error status when the token is in error state', () => {
      const result = resolveRuntimeReference('tokens.session.value', stateWithErrorToken)
      expect(result.status).toBe('token-error')
    })

    it('returns missing when the referenced tokenId does not exist in state.tokens', () => {
      expect(resolveRuntimeReference('tokens.unknown.value', stateWithNoTokens)).toEqual({
        status: 'missing',
        reference: parseRuntimeReference('tokens.unknown.value'),
      })
    })

    it('does not throw and returns missing when state.tokens is undefined (legacy / partial state)', () => {
      const stateWithoutTokensDomain = {
        ...runtimeState,
        // tokens omitted intentionally
      } as unknown as RuntimeState

      expect(() => resolveRuntimeReference('tokens.session.value', stateWithoutTokensDomain)).not.toThrow()

      expect(resolveRuntimeReference('tokens.session.value', stateWithoutTokensDomain)).toEqual({
        status: 'missing',
        reference: parseRuntimeReference('tokens.session.value'),
      })
    })

    it('returns empty string from resolveRuntimeVisibleValue when the token is in error state', () => {
      expect(
        resolveRuntimeVisibleValue('tokens.session.value', stateWithErrorToken, 'heading.props.text'),
      ).toBe('')
    })

    it('resolves {{tokens.session.value}} interpolation to empty string when token is in error state', () => {
      expect(
        resolveRuntimeVisibleValue('Header: {{tokens.session.value}}', stateWithErrorToken, 'heading.props.text'),
      ).toBe('Header: ')
    })

    it('resolves {{tokens.session.value}} interpolation to the token value when status is ready', () => {
      expect(
        resolveRuntimeVisibleValue('Bearer: {{tokens.session.value}}', stateWithReadyToken, 'heading.props.text'),
      ).toBe('Bearer: abc')
    })
  })

  describe('T0092-T3 item.$index parser and resolver contract', () => {
    it('classifies item.$index as a supported reference when iteration context is enabled', () => {
      expect(parseRuntimeReference('item.$index', { allowItemReference: true })).toMatchObject({
        kind: 'reference',
        status: 'supported',
        namespace: 'item',
        path: ['$index'],
      })
    })

    it('classifies item.$index as unsupported outside explicit iteration context', () => {
      expect(parseRuntimeReference('item.$index', { allowItemReference: false })).toMatchObject({
        kind: 'reference',
        status: 'unsupported',
        namespace: 'item',
        path: ['$index'],
      })
    })

    it('classifies item.$index.algo as invalid', () => {
      expect(parseRuntimeReference('item.$index.algo', { allowItemReference: true })).toMatchObject({
        kind: 'reference',
        status: 'invalid',
        namespace: 'item',
      })
    })

    it('resolves item.$index to the numeric index with precedence over a literal $index property', () => {
      const iterationContextWithIndex = {
        item: { $index: 'shadow' },
        key: '0',
        itemIndex: 2,
      }

      expect(resolveRuntimeReference('item.$index', runtimeState, { iterationContext: iterationContextWithIndex })).toEqual({
        status: 'resolved',
        value: 2,
        reference: parseRuntimeReference('item.$index', { allowItemReference: true }),
      })
    })

    it('resolves item.$index to 0 when itemIndex is 0', () => {
      const iterationContextWithZeroIndex = {
        item: {},
        key: '0',
        itemIndex: 0,
      }

      expect(resolveRuntimeReference('item.$index', runtimeState, { iterationContext: iterationContextWithZeroIndex })).toEqual({
        status: 'resolved',
        value: 0,
        reference: parseRuntimeReference('item.$index', { allowItemReference: true }),
      })
    })
  })

  describe('localPlaceholders', () => {
    const stateWithTranslations: RuntimeState = {
      ...runtimeState,
      modal: {
        activeModalId: null,
        activeIterationKey: null,
      },
      i18n: {
        translations: {
          foo: { es: 'Zorro', en: 'Fox' },
        },
        activeLanguage: 'es',
      },
    }

    it('substitutes a local placeholder verbatim without re-parsing it as a reference', () => {
      expect(
        resolveRuntimeVisibleValue('Error al subir "{{fileName}}"', stateWithTranslations, 'heading.props.text', {
          localPlaceholders: { fileName: 'foo.pdf' },
        }),
      ).toBe('Error al subir "foo.pdf"')
    })

    it('resolves several local placeholders within the same pass', () => {
      expect(
        resolveRuntimeVisibleValue(
          'Total {{completed}}/{{total}} — {{percent}}%',
          stateWithTranslations,
          'heading.props.text',
          { localPlaceholders: { completed: '2', total: '5', percent: '40' } },
        ),
      ).toBe('Total 2/5 — 40%')
    })

    it('degrades a placeholder name absent from localPlaceholders and unsupported as a reference to empty string', () => {
      expect(
        resolveRuntimeVisibleValue('Total {{completed}}/{{total}}', stateWithTranslations, 'heading.props.text', {
          localPlaceholders: { completed: '2' },
        }),
      ).toBe('Total 2/')
    })

    it('keeps resolving {{translations.*}} through the catalog while localPlaceholders holds unrelated keys', () => {
      expect(
        resolveRuntimeVisibleValue('{{translations.foo}}', stateWithTranslations, 'heading.props.text', {
          localPlaceholders: { fileName: 'foo.pdf' },
        }),
      ).toBe('Zorro')
    })

    it('does not re-interpolate a localPlaceholders value that itself contains {{translations.foo}}', () => {
      expect(
        resolveRuntimeVisibleValue('Nombre: {{fileName}}', stateWithTranslations, 'heading.props.text', {
          localPlaceholders: { fileName: '{{translations.foo}}' },
        }),
      ).toBe('Nombre: {{translations.foo}}')
    })

    it('propagates localPlaceholders from resolveRuntimeTextReference through resolveRuntimeVisibleValue', () => {
      expect(
        resolveRuntimeTextReference('Error al subir "{{fileName}}"', stateWithTranslations, 'heading.props.text', {
          localPlaceholders: { fileName: 'bar.pdf' },
        }),
      ).toBe('Error al subir "bar.pdf"')
    })
  })

  describe('T0101 formatters in visible interpolation', () => {
    const formatterState: RuntimeState = {
      ...runtimeState,
      queries: {
        ...runtimeState.queries,
        total: { status: 'success', data: 1234.5, error: null },
        price: { status: 'success', data: 19.9, error: null },
        date: { status: 'success', data: '2026-07-16', error: null },
        dateTime: { status: 'success', data: '2026-07-16T10:30:45+02:00', error: null },
        name: { status: 'success', data: 'ana', error: null },
        ratio: { status: 'success', data: 0.4256, error: null },
      },
    }

    let consoleWarnSpy: ReturnType<typeof vi.spyOn>

    beforeEach(() => {
      consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    })

    afterEach(() => {
      consoleWarnSpy.mockRestore()
      vi.unstubAllEnvs()
    })

    it('formats {{queries.total.data | number}} using es-ES grouping', () => {
      expect(
        resolveRuntimeVisibleValue('{{queries.total.data | number}}', formatterState, 'heading.props.text'),
      ).toBe('1.234,5')
    })

    it('formats {{queries.total.data | number:2}} with two forced decimals', () => {
      expect(
        resolveRuntimeVisibleValue('{{queries.total.data | number:2}}', formatterState, 'heading.props.text'),
      ).toBe('1.234,50')
    })

    it('formats {{queries.price.data | currency}} to euros', () => {
      const result = resolveRuntimeVisibleValue(
        '{{queries.price.data | currency}}',
        formatterState,
        'heading.props.text',
      )

      expect(String(result)).toContain('19,90')
      expect(String(result)).toMatch(/€/)
    })

    it('formats {{queries.price.data | currency:"USD"}} using USD', () => {
      const result = resolveRuntimeVisibleValue(
        '{{queries.price.data | currency:"USD"}}',
        formatterState,
        'heading.props.text',
      )

      expect(String(result)).toContain('19,90')
      expect(String(result)).toMatch(/US\$|\$/)
    })

    it('formats {{queries.date.data | date:"dd/MM/yyyy"}} for a date-only ISO input', () => {
      expect(
        resolveRuntimeVisibleValue(
          '{{queries.date.data | date:"dd/MM/yyyy"}}',
          formatterState,
          'heading.props.text',
        ),
      ).toBe('16/07/2026')
    })

    it('formats {{queries.dateTime.data | date:"dd/MM/yyyy HH:mm:ss"}} for an ISO datetime with offset', () => {
      const result = resolveRuntimeVisibleValue(
        '{{queries.dateTime.data | date:"dd/MM/yyyy HH:mm:ss"}}',
        formatterState,
        'heading.props.text',
      )

      expect(String(result)).toMatch(/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2}$/)
    })

    it('uppercases {{queries.name.data | uppercase}}', () => {
      expect(
        resolveRuntimeVisibleValue('{{queries.name.data | uppercase}}', formatterState, 'heading.props.text'),
      ).toBe('ANA')
    })

    it('chains {{queries.name.data | uppercase | truncate:2}} to produce AN…', () => {
      expect(
        resolveRuntimeVisibleValue(
          '{{queries.name.data | uppercase | truncate:2}}',
          formatterState,
          'heading.props.text',
        ),
      ).toBe('AN…')
    })

    it('formats {{queries.ratio.data | percent:1}} to a value containing 42,6 and %', () => {
      const result = resolveRuntimeVisibleValue(
        '{{queries.ratio.data | percent:1}}',
        formatterState,
        'heading.props.text',
      )

      expect(String(result)).toContain('42,6')
      expect(String(result)).toContain('%')
    })

    it('produces empty string when the formatter name is not in the catalog', () => {
      expect(
        resolveRuntimeVisibleValue(
          'A {{queries.total.data | doesNotExist}} B',
          formatterState,
          'heading.props.text',
        ),
      ).toBe('A  B')
    })

    it('produces empty string when a formatter cannot handle the resolved value', () => {
      expect(
        resolveRuntimeVisibleValue(
          'A {{queries.name.data | date:"dd/MM/yyyy"}} B',
          formatterState,
          'heading.props.text',
        ),
      ).toBe('A  B')
    })

    it('produces empty string when the argument grammar is invalid (number:"dos")', () => {
      expect(
        resolveRuntimeVisibleValue(
          'A {{queries.total.data | number:"dos"}} B',
          formatterState,
          'heading.props.text',
        ),
      ).toBe('A  B')
    })

    it('produces empty string when the argument is missing after ":"', () => {
      expect(
        resolveRuntimeVisibleValue(
          'A {{queries.total.data | truncate:}} B',
          formatterState,
          'heading.props.text',
        ),
      ).toBe('A  B')
    })

    it('tolerates variable whitespace around the pipe and the argument separator', () => {
      const expected = resolveRuntimeVisibleValue(
        '{{queries.total.data | number:2}}',
        formatterState,
        'heading.props.text',
      )

      expect(
        resolveRuntimeVisibleValue(
          '{{ queries.total.data | number : 2 }}',
          formatterState,
          'heading.props.text',
        ),
      ).toBe(expected)
    })

    it('formats a mixed string keeping literal text around the placeholder', () => {
      expect(
        resolveRuntimeVisibleValue(
          'Total: {{queries.total.data | number:2}} eur',
          formatterState,
          'heading.props.text',
        ),
      ).toBe('Total: 1.234,50 eur')
    })

    it('preserves historical behavior for placeholders without a pipe', () => {
      expect(
        resolveRuntimeVisibleValue('{{queries.total.data}}', formatterState, 'heading.props.text'),
      ).toBe('1234.5')
    })

    it('emits a DEV console.warn when a formatter chain is unresolvable, once per placeholder', () => {
      resolveRuntimeVisibleValue(
        '{{queries.name.data | date:"dd/MM/yyyy"}}',
        formatterState,
        'heading.props.text',
      )

      expect(consoleWarnSpy).toHaveBeenCalledTimes(1)
      const warnMessage = String(consoleWarnSpy.mock.calls[0]?.[0] ?? '')
      expect(warnMessage).toContain('runtime-formatters')
      expect(warnMessage).toContain('date')
    })

    it('does not emit console.warn for formatter chain diagnostics when not in DEV', () => {
      vi.stubEnv('DEV', false)

      resolveRuntimeVisibleValue(
        '{{queries.name.data | date:"dd/MM/yyyy"}}',
        formatterState,
        'heading.props.text',
      )

      expect(consoleWarnSpy).not.toHaveBeenCalled()
    })

    it('produces empty string when the reference is unsupported, regardless of the formatter', () => {
      expect(
        resolveRuntimeVisibleValue(
          'A {{params.user.id | uppercase}} B',
          formatterState,
          'heading.props.text',
        ),
      ).toBe('A  B')
    })
  })
})
