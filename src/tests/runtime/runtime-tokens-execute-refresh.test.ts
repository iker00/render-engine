import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { RuntimeConfig } from '../../config/runtime-config'
import type { RuntimeState } from '../../runtime/runtime-state/runtime-state-types'
import { executeTokenRefresh } from '../../runtime/runtime-tokens/execute-token-refresh'

function makeBaseState(overrides: Partial<RuntimeState> = {}): RuntimeState {
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
    ...overrides,
  }
}

const baseConfig: RuntimeConfig = {
  api: {
    refreshToken: {
      method: 'POST',
      endpoint: '/auth/refresh',
    },
  },
  initialPage: 'home',
  pages: [{ id: 'home', layout: [] }],
}

const refreshConfig = {
  operation: 'refreshToken',
  responsePath: 'data.token',
  intervalSeconds: 30,
}

function mockFetchSuccess(data: unknown): typeof fetch {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    text: vi.fn().mockResolvedValue(JSON.stringify(data)),
  } as unknown as Response)
}

function mockFetchHttpError(status = 500): typeof fetch {
  return vi.fn().mockResolvedValue({
    ok: false,
    status,
    text: vi.fn().mockResolvedValue(''),
  } as unknown as Response)
}

function mockFetchNetworkError(): typeof fetch {
  return vi.fn().mockRejectedValue(new Error('network error'))
}

function mockFetchInvalidJson(): typeof fetch {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    text: vi.fn().mockResolvedValue('not-json'),
  } as unknown as Response)
}

describe('executeTokenRefresh — success cases', () => {
  it('returns success with extracted value when responsePath resolves to a non-empty string', async () => {
    const snapshotState = makeBaseState()
    const fetch = mockFetchSuccess({ data: { token: 'newValue' } })

    const result = await executeTokenRefresh({
      config: baseConfig,
      tokenId: 'session',
      refreshConfig,
      snapshotState,
      fetchImplementation: fetch,
    })

    expect(result).toEqual({ kind: 'success', value: 'newValue' })
  })

  it('correctly navigates nested responsePath', async () => {
    const snapshotState = makeBaseState()
    const fetch = mockFetchSuccess({ auth: { session: { token: 'deep-token' } } })

    const result = await executeTokenRefresh({
      config: baseConfig,
      tokenId: 'session',
      refreshConfig: { ...refreshConfig, responsePath: 'auth.session.token' },
      snapshotState,
      fetchImplementation: fetch,
    })

    expect(result).toEqual({ kind: 'success', value: 'deep-token' })
  })
})

describe('executeTokenRefresh — responsePath failure cases', () => {
  it('returns failure when responsePath resolves to a number', async () => {
    const snapshotState = makeBaseState()
    const fetch = mockFetchSuccess({ data: { token: 42 } })

    const result = await executeTokenRefresh({
      config: baseConfig,
      tokenId: 'session',
      refreshConfig,
      snapshotState,
      fetchImplementation: fetch,
    })

    expect(result).toEqual({ kind: 'failure' })
  })

  it('returns failure when responsePath resolves to a boolean', async () => {
    const snapshotState = makeBaseState()
    const fetch = mockFetchSuccess({ data: { token: true } })

    const result = await executeTokenRefresh({
      config: baseConfig,
      tokenId: 'session',
      refreshConfig,
      snapshotState,
      fetchImplementation: fetch,
    })

    expect(result).toEqual({ kind: 'failure' })
  })

  it('returns failure when responsePath resolves to null', async () => {
    const snapshotState = makeBaseState()
    const fetch = mockFetchSuccess({ data: { token: null } })

    const result = await executeTokenRefresh({
      config: baseConfig,
      tokenId: 'session',
      refreshConfig,
      snapshotState,
      fetchImplementation: fetch,
    })

    expect(result).toEqual({ kind: 'failure' })
  })

  it('returns failure when responsePath resolves to an object', async () => {
    const snapshotState = makeBaseState()
    const fetch = mockFetchSuccess({ data: { token: { nested: 'value' } } })

    const result = await executeTokenRefresh({
      config: baseConfig,
      tokenId: 'session',
      refreshConfig,
      snapshotState,
      fetchImplementation: fetch,
    })

    expect(result).toEqual({ kind: 'failure' })
  })

  it('returns failure when responsePath resolves to empty string', async () => {
    const snapshotState = makeBaseState()
    const fetch = mockFetchSuccess({ data: { token: '' } })

    const result = await executeTokenRefresh({
      config: baseConfig,
      tokenId: 'session',
      refreshConfig,
      snapshotState,
      fetchImplementation: fetch,
    })

    expect(result).toEqual({ kind: 'failure' })
  })

  it('returns failure when responsePath segment is missing from response', async () => {
    const snapshotState = makeBaseState()
    const fetch = mockFetchSuccess({ data: {} })

    const result = await executeTokenRefresh({
      config: baseConfig,
      tokenId: 'session',
      refreshConfig,
      snapshotState,
      fetchImplementation: fetch,
    })

    expect(result).toEqual({ kind: 'failure' })
  })

  it('returns failure when responsePath root key does not exist', async () => {
    const snapshotState = makeBaseState()
    const fetch = mockFetchSuccess({ other: 'value' })

    const result = await executeTokenRefresh({
      config: baseConfig,
      tokenId: 'session',
      refreshConfig,
      snapshotState,
      fetchImplementation: fetch,
    })

    expect(result).toEqual({ kind: 'failure' })
  })
})

describe('executeTokenRefresh — network and HTTP errors', () => {
  it('returns failure when fetch throws (network error)', async () => {
    const snapshotState = makeBaseState()
    const fetch = mockFetchNetworkError()

    const result = await executeTokenRefresh({
      config: baseConfig,
      tokenId: 'session',
      refreshConfig,
      snapshotState,
      fetchImplementation: fetch,
    })

    expect(result).toEqual({ kind: 'failure' })
  })

  it('returns failure when server responds with HTTP 500', async () => {
    const snapshotState = makeBaseState()
    const fetch = mockFetchHttpError(500)

    const result = await executeTokenRefresh({
      config: baseConfig,
      tokenId: 'session',
      refreshConfig,
      snapshotState,
      fetchImplementation: fetch,
    })

    expect(result).toEqual({ kind: 'failure' })
  })

  it('returns failure when server responds with HTTP 401', async () => {
    const snapshotState = makeBaseState()
    const fetch = mockFetchHttpError(401)

    const result = await executeTokenRefresh({
      config: baseConfig,
      tokenId: 'session',
      refreshConfig,
      snapshotState,
      fetchImplementation: fetch,
    })

    expect(result).toEqual({ kind: 'failure' })
  })

  it('returns failure when response body is invalid JSON', async () => {
    const snapshotState = makeBaseState()
    const fetch = mockFetchInvalidJson()

    const result = await executeTokenRefresh({
      config: baseConfig,
      tokenId: 'session',
      refreshConfig,
      snapshotState,
      fetchImplementation: fetch,
    })

    expect(result).toEqual({ kind: 'failure' })
  })
})

describe('executeTokenRefresh — errorCondition as business error', () => {
  it('returns failure when operation errorCondition is satisfied (business error on HTTP 200)', async () => {
    const configWithErrorCondition: RuntimeConfig = {
      ...baseConfig,
      api: {
        refreshToken: {
          method: 'POST',
          endpoint: '/auth/refresh',
          errorCondition: { path: 'error', equals: true },
        },
      },
    }

    const snapshotState = makeBaseState()
    const fetch = mockFetchSuccess({ error: true, data: { token: 'should-not-be-used' } })

    const result = await executeTokenRefresh({
      config: configWithErrorCondition,
      tokenId: 'session',
      refreshConfig,
      snapshotState,
      fetchImplementation: fetch,
    })

    expect(result).toEqual({ kind: 'failure' })
  })

  it('returns success when errorCondition is not satisfied', async () => {
    const configWithErrorCondition: RuntimeConfig = {
      ...baseConfig,
      api: {
        refreshToken: {
          method: 'POST',
          endpoint: '/auth/refresh',
          errorCondition: { path: 'error', equals: true },
        },
      },
    }

    const snapshotState = makeBaseState()
    const fetch = mockFetchSuccess({ error: false, data: { token: 'valid-token' } })

    const result = await executeTokenRefresh({
      config: configWithErrorCondition,
      tokenId: 'session',
      refreshConfig,
      snapshotState,
      fetchImplementation: fetch,
    })

    expect(result).toEqual({ kind: 'success', value: 'valid-token' })
  })
})

describe('executeTokenRefresh — build request failure', () => {
  it('returns failure when buildRuntimeApiRequest fails (operation not found)', async () => {
    const snapshotState = makeBaseState()
    const fetch = mockFetchSuccess({ data: { token: 'value' } })

    const result = await executeTokenRefresh({
      config: baseConfig,
      tokenId: 'session',
      refreshConfig: { ...refreshConfig, operation: 'nonexistentOp' },
      snapshotState,
      fetchImplementation: fetch,
    })

    expect(result).toEqual({ kind: 'failure' })
  })

  it('returns failure when header token reference is in error state (build fails with token-refresh-failed)', async () => {
    const configWithTokenHeader: RuntimeConfig = {
      ...baseConfig,
      api: {
        refreshToken: {
          method: 'POST',
          endpoint: '/auth/refresh',
          headers: { 'X-Other-Token': 'tokens.other.value' },
        },
      },
    }

    const snapshotState = makeBaseState({
      tokens: {
        session: { value: 'session-token', status: 'ready', failedAttempts: 0 },
        other: { value: 'other-token', status: 'error', failedAttempts: 2 },
      },
    })

    const fetch = mockFetchSuccess({ data: { token: 'new-value' } })

    const result = await executeTokenRefresh({
      config: configWithTokenHeader,
      tokenId: 'session',
      refreshConfig,
      snapshotState,
      fetchImplementation: fetch,
    })

    expect(result).toEqual({ kind: 'failure' })
  })
})
