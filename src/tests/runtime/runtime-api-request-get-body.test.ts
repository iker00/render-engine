import { describe, expect, it } from 'vitest'
import { buildRuntimeApiRequest } from '../../queries/runtime-api-request'
import type { RuntimeConfig } from '../../config/runtime-config'
import type { RuntimeState } from '../../runtime/runtime-state/runtime-state-types'

// Minimal RuntimeState for these unit tests — only what the resolver inspects
function makeState(): RuntimeState {
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
    modal: { activeModalId: null, activeIterationKey: null },
    i18n: { translations: {}, activeLanguage: 'es' },
    tokens: {},
  }
}

// A GET operation with no declared `body` — the shape autocomplete's dynamic multi-select search
// targets (design.md, decisión 3): it always attaches `requestParams.body` regardless of the
// operation's method, since it has no way to know it up front.
const getConfig: RuntimeConfig = {
  api: {
    searchOp: {
      method: 'GET',
      endpoint: '/api/search',
    },
  },
  initialPage: 'home',
  pages: [{ id: 'home', layout: [] }],
}

describe('buildRuntimeApiRequest — GET requests never carry a body', () => {
  it('drops a body passed via requestParams for a GET operation, instead of building a RequestInit fetch would reject', () => {
    const result = buildRuntimeApiRequest({
      config: getConfig,
      operationName: 'searchOp',
      state: makeState(),
      requestParams: { query: { search: 'sp' }, body: { search: 'sp' } },
    })

    expect(result.status).toBe('ready')
    if (result.status !== 'ready') return
    expect(result.request.init.body).toBeUndefined()
    expect(result.request.init.method).toBe('GET')
    expect(result.request.url).toBe('/api/search?search=sp')
  })

  it('still attaches a body for a POST operation with the same requestParams shape', () => {
    const postConfig: RuntimeConfig = {
      api: {
        searchOp: {
          method: 'POST',
          endpoint: '/api/search',
        },
      },
      initialPage: 'home',
      pages: [{ id: 'home', layout: [] }],
    }

    const result = buildRuntimeApiRequest({
      config: postConfig,
      operationName: 'searchOp',
      state: makeState(),
      requestParams: { body: { search: 'sp' } },
    })

    expect(result.status).toBe('ready')
    if (result.status !== 'ready') return
    expect(result.request.init.body).toBe(JSON.stringify({ search: 'sp' }))
  })
})
