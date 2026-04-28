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

      expect(parseRuntimeReference('queries.searchUsers.data.extra')).toMatchObject({
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
})
