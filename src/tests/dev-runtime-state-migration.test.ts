import { describe, expect, it } from 'vitest'
import { migrateRuntimeStateAcrossConfig } from '../dev-runtime/dev-runtime-state-migration'
import type { RuntimeConfig } from '../config/runtime-config'
import type { RuntimeState } from '../runtime/runtime-state/runtime-state-types'

function makeConfig(overrides: Partial<RuntimeConfig> = {}): RuntimeConfig {
  return {
    api: {},
    pages: [{ id: 'home', layout: [], preloads: [] }],
    initialPage: 'home',
    ...overrides,
  } as RuntimeConfig
}

function makeState(overrides: Partial<RuntimeState> = {}): RuntimeState {
  return {
    navigation: {
      currentPageId: 'home',
      history: [{ entryId: 0, pageId: 'home', params: {} }],
      currentEntryIndex: 0,
      lastError: null,
    },
    forms: {},
    queries: {},
    pageEntry: {
      entryId: 0,
      pageId: 'home',
      params: {},
      preloadNames: [],
      status: 'idle',
    },
    ...overrides,
  }
}

describe('migrateRuntimeStateAcrossConfig', () => {
  describe('forms', () => {
    it('preserves a form that still exists, keeping only surviving fieldIds', () => {
      const prevState = makeState({
        forms: {
          loginForm: {
            username: { value: 'alice', error: null, touched: true, dirty: true },
            password: { value: 'secret', error: null, touched: true, dirty: true },
          },
        },
      })
      const prevConfig = makeConfig({
        pages: [
          {
            id: 'home',
            layout: [
              {
                type: 'form',
                id: 'loginForm',
                children: [
                  { type: 'input', props: { fieldId: 'username', label: 'Username' } },
                  { type: 'input', props: { fieldId: 'password', label: 'Password' } },
                ],
              },
            ],
          },
        ],
      } as unknown as Partial<RuntimeConfig>)
      const nextConfig = makeConfig({
        pages: [
          {
            id: 'home',
            layout: [
              {
                type: 'form',
                id: 'loginForm',
                children: [
                  { type: 'input', props: { fieldId: 'username', label: 'Username' } },
                  // password removed
                ],
              },
            ],
          },
        ],
      } as unknown as Partial<RuntimeConfig>)

      const result = migrateRuntimeStateAcrossConfig(prevState, prevConfig, nextConfig)

      expect(result.forms['loginForm']).toBeDefined()
      expect(result.forms['loginForm']['username']).toEqual(prevState.forms['loginForm']['username'])
      expect(result.forms['loginForm']['password']).toBeUndefined()
    })

    it('discards a form that no longer exists in nextConfig', () => {
      const prevState = makeState({
        forms: {
          removedForm: {
            name: { value: 'test', error: null, touched: true, dirty: true },
          },
        },
      })
      const prevConfig = makeConfig({
        pages: [
          {
            id: 'home',
            layout: [
              {
                type: 'form',
                id: 'removedForm',
                children: [{ type: 'input', props: { fieldId: 'name', label: 'Name' } }],
              },
            ],
          },
        ],
      } as unknown as Partial<RuntimeConfig>)
      const nextConfig = makeConfig({
        pages: [{ id: 'home', layout: [] }],
      } as unknown as Partial<RuntimeConfig>)

      const result = migrateRuntimeStateAcrossConfig(prevState, prevConfig, nextConfig)

      expect(result.forms['removedForm']).toBeUndefined()
    })

    it('discovers forms nested in container.children', () => {
      const prevState = makeState({
        forms: {
          nestedForm: {
            email: { value: 'test@example.com', error: null, touched: true, dirty: true },
          },
        },
      })
      const prevConfig = makeConfig()
      const nextConfig = makeConfig({
        pages: [
          {
            id: 'home',
            layout: [
              {
                type: 'container',
                children: [
                  {
                    type: 'form',
                    id: 'nestedForm',
                    children: [{ type: 'input', props: { fieldId: 'email', label: 'Email' } }],
                  },
                ],
              },
            ],
          },
        ],
      } as unknown as Partial<RuntimeConfig>)

      const result = migrateRuntimeStateAcrossConfig(prevState, prevConfig, nextConfig)

      expect(result.forms['nestedForm']).toBeDefined()
      expect(result.forms['nestedForm']['email']).toEqual(prevState.forms['nestedForm']['email'])
    })

    it('discovers forms nested in repeater.template', () => {
      const prevState = makeState({
        forms: {
          templateForm: {
            note: { value: 'hello', error: null, touched: true, dirty: false },
          },
        },
      })
      const prevConfig = makeConfig()
      const nextConfig = makeConfig({
        pages: [
          {
            id: 'home',
            layout: [
              {
                type: 'repeater',
                props: {
                  items: { source: 'queries.data', key: 'id' },
                  template: [
                    {
                      type: 'form',
                      id: 'templateForm',
                      children: [{ type: 'textarea', props: { fieldId: 'note', label: 'Note' } }],
                    },
                  ],
                },
              },
            ],
          },
        ],
      } as unknown as Partial<RuntimeConfig>)

      const result = migrateRuntimeStateAcrossConfig(prevState, prevConfig, nextConfig)

      expect(result.forms['templateForm']).toBeDefined()
      expect(result.forms['templateForm']['note']).toEqual(prevState.forms['templateForm']['note'])
    })
  })

  describe('queries', () => {
    it('preserves a cached query that still exists in nextConfig.api', () => {
      const queryState = {
        status: 'success' as const,
        data: [{ id: 1 }],
        error: null,
        requestSignature: 'sig-abc',
      }
      const prevState = makeState({ queries: { getUsers: queryState } })
      const prevConfig = makeConfig({ api: { getUsers: { method: 'GET', endpoint: '/users' } } } as unknown as Partial<RuntimeConfig>)
      const nextConfig = makeConfig({ api: { getUsers: { method: 'GET', endpoint: '/users' } } } as unknown as Partial<RuntimeConfig>)

      const result = migrateRuntimeStateAcrossConfig(prevState, prevConfig, nextConfig)

      expect(result.queries['getUsers']).toEqual(queryState)
    })

    it('discards a cached query whose operation is removed from nextConfig.api', () => {
      const prevState = makeState({
        queries: { removedQuery: { status: 'success', data: [], error: null, requestSignature: null } },
      })
      const prevConfig = makeConfig({ api: { removedQuery: { method: 'GET', endpoint: '/data' } } } as unknown as Partial<RuntimeConfig>)
      const nextConfig = makeConfig({ api: {} } as unknown as Partial<RuntimeConfig>)

      const result = migrateRuntimeStateAcrossConfig(prevState, prevConfig, nextConfig)

      expect(result.queries['removedQuery']).toBeUndefined()
    })
  })

  describe('navigation', () => {
    it('preserves currentPageId when it still exists in nextConfig.pages', () => {
      const prevState = makeState({
        navigation: {
          currentPageId: 'details',
          history: [
            { entryId: 0, pageId: 'home', params: {} },
            { entryId: 1, pageId: 'details', params: { id: '42' } },
          ],
          currentEntryIndex: 1,
          lastError: null,
        },
      })
      const prevConfig = makeConfig({
        pages: [
          { id: 'home', layout: [] },
          { id: 'details', layout: [] },
        ],
      } as unknown as Partial<RuntimeConfig>)
      const nextConfig = makeConfig({
        pages: [
          { id: 'home', layout: [] },
          { id: 'details', layout: [] },
        ],
        initialPage: 'home',
      } as unknown as Partial<RuntimeConfig>)

      const result = migrateRuntimeStateAcrossConfig(prevState, prevConfig, nextConfig)

      expect(result.navigation.currentPageId).toBe('details')
      expect(result.navigation.history).toHaveLength(1)
      expect(result.navigation.history[0].entryId).toBe(0)
      expect(result.navigation.history[0].pageId).toBe('details')
      expect(result.navigation.history[0].params).toEqual({ id: '42' })
      expect(result.navigation.lastError).toBeNull()
    })

    it('degrades to nextConfig.initialPage when currentPageId no longer exists', () => {
      const prevState = makeState({
        navigation: {
          currentPageId: 'removed-page',
          history: [{ entryId: 0, pageId: 'removed-page', params: {} }],
          currentEntryIndex: 0,
          lastError: null,
        },
      })
      const prevConfig = makeConfig({
        pages: [{ id: 'removed-page', layout: [] }],
      } as unknown as Partial<RuntimeConfig>)
      const nextConfig = makeConfig({
        pages: [{ id: 'home', layout: [] }, { id: 'dashboard', layout: [] }],
        initialPage: 'dashboard',
      } as unknown as Partial<RuntimeConfig>)

      const result = migrateRuntimeStateAcrossConfig(prevState, prevConfig, nextConfig)

      expect(result.navigation.currentPageId).toBe('dashboard')
      expect(result.navigation.history).toHaveLength(1)
      expect(result.navigation.history[0].pageId).toBe('dashboard')
      expect(result.navigation.history[0].params).toEqual({})
      expect(result.navigation.lastError).toBeNull()
    })

    it('sets lastError to null in all cases', () => {
      const prevState = makeState({
        navigation: {
          currentPageId: 'home',
          history: [{ entryId: 0, pageId: 'home', params: {} }],
          currentEntryIndex: 0,
          lastError: { code: 'page-not-found', message: 'oops', pageId: 'missing' },
        },
      })
      const prevConfig = makeConfig()
      const nextConfig = makeConfig()

      const result = migrateRuntimeStateAcrossConfig(prevState, prevConfig, nextConfig)

      expect(result.navigation.lastError).toBeNull()
    })
  })

  describe('pageEntry', () => {
    it('rebuilds pageEntry with entryId 0, resolved pageId, derived preloadNames and idle status', () => {
      const prevState = makeState({
        navigation: {
          currentPageId: 'details',
          history: [
            { entryId: 0, pageId: 'home', params: {} },
            { entryId: 1, pageId: 'details', params: { id: '5' } },
          ],
          currentEntryIndex: 1,
          lastError: null,
        },
        pageEntry: { entryId: 1, pageId: 'details', params: { id: '5' }, preloadNames: ['getPost'], status: 'success' },
      })
      const prevConfig = makeConfig({
        pages: [{ id: 'home', layout: [] }, { id: 'details', layout: [], preloads: [{ operationName: 'getPost', requestParams: {} }] }],
      } as unknown as Partial<RuntimeConfig>)
      const nextConfig = makeConfig({
        pages: [
          { id: 'home', layout: [] },
          {
            id: 'details',
            layout: [],
            preloads: [
              { operationName: 'getPost', requestParams: {} },
              { operationName: 'getComments', requestParams: {} },
            ],
          },
        ],
        initialPage: 'home',
      } as unknown as Partial<RuntimeConfig>)

      const result = migrateRuntimeStateAcrossConfig(prevState, prevConfig, nextConfig)

      expect(result.pageEntry.entryId).toBe(0)
      expect(result.pageEntry.pageId).toBe('details')
      expect(result.pageEntry.params).toEqual({ id: '5' })
      expect(result.pageEntry.preloadNames).toEqual(['getPost', 'getComments'])
      expect(result.pageEntry.status).toBe('idle')
    })

    it('uses initialPage params {} when current page was removed', () => {
      const prevState = makeState({
        navigation: {
          currentPageId: 'removed',
          history: [{ entryId: 0, pageId: 'removed', params: { key: 'val' } }],
          currentEntryIndex: 0,
          lastError: null,
        },
      })
      const prevConfig = makeConfig({ pages: [{ id: 'removed', layout: [] }] } as unknown as Partial<RuntimeConfig>)
      const nextConfig = makeConfig({
        pages: [{ id: 'home', layout: [], preloads: [{ operationName: 'loadData', requestParams: {} }] }],
        initialPage: 'home',
      } as unknown as Partial<RuntimeConfig>)

      const result = migrateRuntimeStateAcrossConfig(prevState, prevConfig, nextConfig)

      expect(result.pageEntry.entryId).toBe(0)
      expect(result.pageEntry.pageId).toBe('home')
      expect(result.pageEntry.params).toEqual({})
      expect(result.pageEntry.preloadNames).toEqual(['loadData'])
      expect(result.pageEntry.status).toBe('idle')
    })
  })

  describe('immutability', () => {
    it('does not mutate prevState', () => {
      const prevState = makeState({
        forms: { f: { name: { value: 'x', error: null, touched: true, dirty: false } } },
        queries: { q: { status: 'success', data: [], error: null, requestSignature: null } },
      })
      const frozen = JSON.parse(JSON.stringify(prevState)) as RuntimeState
      const prevConfig = makeConfig()
      const nextConfig = makeConfig()

      migrateRuntimeStateAcrossConfig(prevState, prevConfig, nextConfig)

      expect(prevState).toEqual(frozen)
    })

    it('does not mutate prevConfig', () => {
      const prevConfig = makeConfig({ api: { op: { method: 'GET', endpoint: '/x' } } } as unknown as Partial<RuntimeConfig>)
      const frozen = JSON.parse(JSON.stringify(prevConfig)) as RuntimeConfig
      const prevState = makeState()
      const nextConfig = makeConfig()

      migrateRuntimeStateAcrossConfig(prevState, prevConfig, nextConfig)

      expect(prevConfig).toEqual(frozen)
    })
  })
})
