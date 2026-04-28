import { describe, expect, it } from 'vitest'
import { parseRuntimeReference } from '../runtime/runtime-references/runtime-reference-parser'
import { resolveRuntimeReference } from '../runtime/runtime-references/runtime-reference-resolver'
import type { RuntimeState } from '../runtime/runtime-state/runtime-state-types'

const runtimeState: RuntimeState = {
  navigation: {
    currentPageId: 'home',
    history: ['home'],
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

      expect(parseRuntimeReference('params.id')).toMatchObject({
        kind: 'reference',
        status: 'unsupported',
        namespace: 'params',
        path: ['id'],
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

  describe('T0007-02 store-backed resolution', () => {
    it('reads current form values from the shared runtime state', () => {
      expect(resolveRuntimeReference('forms.userSearch.name', runtimeState)).toEqual({
        status: 'resolved',
        value: 'Grace',
        reference: parseRuntimeReference('forms.userSearch.name'),
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
})
