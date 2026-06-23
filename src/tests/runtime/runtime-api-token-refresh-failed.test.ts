import { describe, expect, it } from 'vitest'
import { buildRuntimeApiRequest, buildInlineRuntimeApiRequest } from '../../queries/runtime-api-executor'
import {
  resolvePayloadValue,
  resolveHeaders,
  resolveBody,
} from '../../queries/runtime-api-payload-resolver'
import type { RuntimeConfig } from '../../config/runtime-config'
import type { RuntimeState } from '../../runtime/runtime-state/runtime-state-types'

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

function makeTokenState(
  value: string,
  status: 'ready' | 'refreshing' | 'error',
  failedAttempts = 0,
) {
  return { value, status, failedAttempts }
}

function makeConfig(headers: Record<string, string>): RuntimeConfig {
  return {
    api: {
      secureOp: {
        method: 'GET',
        endpoint: '/api/secure',
        headers,
      },
    },
    initialPage: 'home',
    pages: [{ id: 'home', layout: [] }],
  }
}

const MESSAGE_PREFIX = 'The api operation "secureOp"'

// ---------------------------------------------------------------------------
// resolvePayloadValue — token-error branch
// ---------------------------------------------------------------------------

describe('resolvePayloadValue — token-error branch', () => {
  it('returns ready with token value when token status is "ready"', () => {
    const state = makeBaseState({
      tokens: { session: makeTokenState('abc', 'ready') },
    })
    const result = resolvePayloadValue('tokens.session.value', { state })
    expect(result).toEqual({ status: 'ready', value: 'abc' })
  })

  it('returns ready with token value when token status is "refreshing" (proactive refresh does not block)', () => {
    const state = makeBaseState({
      tokens: { session: makeTokenState('abc', 'refreshing') },
    })
    const result = resolvePayloadValue('tokens.session.value', { state })
    expect(result).toEqual({ status: 'ready', value: 'abc' })
  })

  it('returns token-error when token status is "error"', () => {
    const state = makeBaseState({
      tokens: { session: makeTokenState('abc', 'error') },
    })
    const result = resolvePayloadValue('tokens.session.value', { state })
    expect(result).toEqual({ status: 'token-error', tokenId: 'session' })
  })

  it('returns error (not token-error) when token id does not exist in state.tokens', () => {
    const state = makeBaseState({ tokens: {} })
    const result = resolvePayloadValue('tokens.unknown.value', { state })
    expect(result).toEqual({ status: 'error' })
  })
})

// ---------------------------------------------------------------------------
// resolveHeaders — token-error → token-refresh-failed
// ---------------------------------------------------------------------------

describe('resolveHeaders — token-refresh-failed', () => {
  it('returns token-refresh-failed error when header token is in "error" state', () => {
    const state = makeBaseState({
      tokens: { session: makeTokenState('abc', 'error') },
    })
    const result = resolveHeaders(
      { Authorization: 'tokens.session.value' },
      MESSAGE_PREFIX,
      { state },
    )
    expect(result).toEqual({
      status: 'error',
      error: {
        code: 'token-refresh-failed',
        message: `${MESSAGE_PREFIX} cannot build the request because token "session" is in error state.`,
      },
    })
  })

  it('error message does not contain the token value', () => {
    const state = makeBaseState({
      tokens: { session: makeTokenState('super-secret-token-value', 'error') },
    })
    const result = resolveHeaders(
      { Authorization: 'tokens.session.value' },
      MESSAGE_PREFIX,
      { state },
    )
    expect(result.status).toBe('error')
    if (result.status !== 'error') return
    expect(result.error.message).not.toContain('super-secret-token-value')
  })

  it('resolves header to token value when token is "ready"', () => {
    const state = makeBaseState({
      tokens: { session: makeTokenState('Bearer token123', 'ready') },
    })
    const result = resolveHeaders(
      { Authorization: 'tokens.session.value' },
      MESSAGE_PREFIX,
      { state },
    )
    expect(result).toEqual({
      status: 'ready',
      headers: { Authorization: 'Bearer token123' },
    })
  })

  it('resolves header to token value when token is "refreshing"', () => {
    const state = makeBaseState({
      tokens: { session: makeTokenState('old-token', 'refreshing') },
    })
    const result = resolveHeaders(
      { Authorization: 'tokens.session.value' },
      MESSAGE_PREFIX,
      { state },
    )
    expect(result).toEqual({
      status: 'ready',
      headers: { Authorization: 'old-token' },
    })
  })

  it('returns request-build-failed (not token-refresh-failed) for unknown token id', () => {
    const state = makeBaseState({ tokens: {} })
    const result = resolveHeaders(
      { Authorization: 'tokens.unknown.value' },
      MESSAGE_PREFIX,
      { state },
    )
    expect(result).toEqual({
      status: 'error',
      error: {
        code: 'request-build-failed',
        message: expect.stringContaining('tokens.unknown.value'),
      },
    })
  })

  it('reports token-refresh-failed for the first errored token when multiple headers are mixed', () => {
    const state = makeBaseState({
      tokens: {
        session: makeTokenState('abc', 'error'),
        other: makeTokenState('xyz', 'ready'),
      },
    })
    const result = resolveHeaders(
      {
        Authorization: 'tokens.session.value',
        'X-Other': 'tokens.other.value',
      },
      MESSAGE_PREFIX,
      { state },
    )
    expect(result.status).toBe('error')
    if (result.status !== 'error') return
    expect(result.error.code).toBe('token-refresh-failed')
    expect(result.error.message).toContain('"session"')
  })
})

// ---------------------------------------------------------------------------
// resolveBody — token-error → token-refresh-failed (defensive path)
// ---------------------------------------------------------------------------

describe('resolveBody — token-refresh-failed (defensive path)', () => {
  it('returns token-refresh-failed when body leaf string references an errored token', () => {
    const state = makeBaseState({
      tokens: { session: makeTokenState('abc', 'error') },
    })
    const result = resolveBody(
      { tokenValue: 'tokens.session.value' },
      MESSAGE_PREFIX,
      { state },
    )
    expect(result).toEqual({
      status: 'error',
      error: {
        code: 'token-refresh-failed',
        message: `${MESSAGE_PREFIX} cannot build the request because token "session" is in error state.`,
      },
    })
  })

  it('resolves body leaf string to token value when token is "ready"', () => {
    const state = makeBaseState({
      tokens: { session: makeTokenState('my-token', 'ready') },
    })
    const result = resolveBody(
      { tokenValue: 'tokens.session.value' },
      MESSAGE_PREFIX,
      { state },
    )
    expect(result).toEqual({
      status: 'ready',
      body: { tokenValue: 'my-token' },
    })
  })
})

// ---------------------------------------------------------------------------
// buildRuntimeApiRequest — end-to-end token-refresh-failed
// ---------------------------------------------------------------------------

describe('buildRuntimeApiRequest — token-refresh-failed integration', () => {
  it('produces request with resolved Authorization header when token is "ready"', () => {
    const state = makeBaseState({
      tokens: { session: makeTokenState('Bearer abc', 'ready') },
    })
    const result = buildRuntimeApiRequest({
      config: makeConfig({ Authorization: 'tokens.session.value' }),
      operationName: 'secureOp',
      state,
    })
    expect(result.status).toBe('ready')
    if (result.status !== 'ready') return
    const headersInit = result.request.init.headers as Record<string, string>
    expect(headersInit['Authorization']).toBe('Bearer abc')
  })

  it('produces request with previous token value when token is "refreshing"', () => {
    const state = makeBaseState({
      tokens: { session: makeTokenState('Bearer old', 'refreshing') },
    })
    const result = buildRuntimeApiRequest({
      config: makeConfig({ Authorization: 'tokens.session.value' }),
      operationName: 'secureOp',
      state,
    })
    expect(result.status).toBe('ready')
    if (result.status !== 'ready') return
    const headersInit = result.request.init.headers as Record<string, string>
    expect(headersInit['Authorization']).toBe('Bearer old')
  })

  it('returns token-refresh-failed when header token is in "error" state', () => {
    const state = makeBaseState({
      tokens: { session: makeTokenState('abc', 'error') },
    })
    const result = buildRuntimeApiRequest({
      config: makeConfig({ Authorization: 'tokens.session.value' }),
      operationName: 'secureOp',
      state,
    })
    expect(result).toEqual({
      status: 'error',
      error: {
        code: 'token-refresh-failed',
        message: 'The api operation "secureOp" cannot build the request because token "session" is in error state.',
      },
    })
  })

  it('error message does not contain the token value (NFR)', () => {
    const state = makeBaseState({
      tokens: { session: makeTokenState('super-secret', 'error') },
    })
    const result = buildRuntimeApiRequest({
      config: makeConfig({ Authorization: 'tokens.session.value' }),
      operationName: 'secureOp',
      state,
    })
    expect(result.status).toBe('error')
    if (result.status !== 'error') return
    expect(result.error.message).not.toContain('super-secret')
  })

  it('returns request-build-failed (not token-refresh-failed) when token id does not exist', () => {
    const state = makeBaseState({ tokens: {} })
    const result = buildRuntimeApiRequest({
      config: makeConfig({ Authorization: 'tokens.unknown.value' }),
      operationName: 'secureOp',
      state,
    })
    expect(result).toEqual({
      status: 'error',
      error: {
        code: 'request-build-failed',
        message: expect.stringContaining('tokens.unknown.value'),
      },
    })
  })

  it('normal non-token header references remain unaffected (regression)', () => {
    const state = makeBaseState({
      forms: {
        myForm: {
          apiKey: {
            value: 'key-123',
            error: null,
            touched: false,
            dirty: false,
            defaultValue: '',
          },
        },
      },
      tokens: {},
    })
    const result = buildRuntimeApiRequest({
      config: makeConfig({ 'X-Api-Key': 'forms.myForm.apiKey' }),
      operationName: 'secureOp',
      state,
    })
    expect(result.status).toBe('ready')
    if (result.status !== 'ready') return
    const headersInit = result.request.init.headers as Record<string, string>
    expect(headersInit['X-Api-Key']).toBe('key-123')
  })
})

// ---------------------------------------------------------------------------
// buildInlineRuntimeApiRequest — parity with buildRuntimeApiRequest
// ---------------------------------------------------------------------------

describe('buildInlineRuntimeApiRequest — token-refresh-failed parity', () => {
  it('returns token-refresh-failed when inline operation header token is in "error" state', () => {
    const state = makeBaseState({
      tokens: { session: makeTokenState('abc', 'error') },
    })
    const result = buildInlineRuntimeApiRequest({
      operation: {
        method: 'GET',
        endpoint: '/api/secure',
        headers: { Authorization: 'tokens.session.value' },
      },
      operationName: 'secureOp',
      state,
    })
    expect(result).toEqual({
      status: 'error',
      error: {
        code: 'token-refresh-failed',
        message: 'The api operation "secureOp" cannot build the request because token "session" is in error state.',
      },
    })
  })
})
