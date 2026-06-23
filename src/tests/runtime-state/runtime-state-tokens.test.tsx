import { describe, expect, it } from 'vitest'
import type { RuntimeConfig } from '../../config/runtime-config'
import { createRuntimeState, runtimeStateReducer } from '../../runtime/runtime-state/runtime-state-reducer'
import type { RuntimeState } from '../../runtime/runtime-state/runtime-state-types'

const testConfig: RuntimeConfig = {
  api: {},
  initialPage: 'home',
  pages: [{ id: 'home', layout: [] }],
}

const testConfigWithOneToken: RuntimeConfig = {
  ...testConfig,
  tokens: {
    session: { value: 'initial-token' },
  },
}

const testConfigWithTokenAndRefresh: RuntimeConfig = {
  ...testConfig,
  api: { refreshToken: { method: 'POST', endpoint: '/auth/refresh' } },
  tokens: {
    session: {
      value: 'initial-token',
      refresh: { operation: 'refreshToken', responsePath: 'data.token', intervalSeconds: 30 },
    },
  },
}

const testConfigWithTwoTokens: RuntimeConfig = {
  ...testConfig,
  tokens: {
    session: { value: 'session-token' },
    api: { value: 'api-key' },
  },
}

describe('tokens domain — createRuntimeState hydration', () => {
  it('produces tokens: {} when config.tokens is undefined', () => {
    const state = createRuntimeState(testConfig)
    expect(state.tokens).toEqual({})
  })

  it('hydrates a single token with status ready and failedAttempts 0', () => {
    const state = createRuntimeState(testConfigWithOneToken)
    expect(state.tokens.session).toEqual({ value: 'initial-token', status: 'ready', failedAttempts: 0 })
  })

  it('hydrates two tokens independently', () => {
    const state = createRuntimeState(testConfigWithTwoTokens)
    expect(state.tokens.session).toEqual({ value: 'session-token', status: 'ready', failedAttempts: 0 })
    expect(state.tokens.api).toEqual({ value: 'api-key', status: 'ready', failedAttempts: 0 })
  })

  it('hydrates a token with refresh config the same way as one without', () => {
    const state = createRuntimeState(testConfigWithTokenAndRefresh)
    expect(state.tokens.session).toEqual({ value: 'initial-token', status: 'ready', failedAttempts: 0 })
  })
})

describe('tokens domain — tokens/set-refreshing action', () => {
  it('sets status to refreshing while preserving value and failedAttempts', () => {
    const state = createRuntimeState(testConfigWithOneToken)
    const next = runtimeStateReducer(state, { type: 'tokens/set-refreshing', payload: { tokenId: 'session' } })
    expect(next.tokens.session).toEqual({ value: 'initial-token', status: 'refreshing', failedAttempts: 0 })
  })

  it('does not reset failedAttempts when transitioning to refreshing', () => {
    const state = createRuntimeState(testConfigWithOneToken)
    const withFailed = runtimeStateReducer(state, { type: 'tokens/record-failed-attempt', payload: { tokenId: 'session' } })
    const next = runtimeStateReducer(withFailed, { type: 'tokens/set-refreshing', payload: { tokenId: 'session' } })
    expect(next.tokens.session.failedAttempts).toBe(1)
    expect(next.tokens.session.status).toBe('refreshing')
  })

  it('is idempotent: set-refreshing on already-refreshing token preserves failedAttempts', () => {
    const state = createRuntimeState(testConfigWithOneToken)
    const once = runtimeStateReducer(state, { type: 'tokens/set-refreshing', payload: { tokenId: 'session' } })
    const twice = runtimeStateReducer(once, { type: 'tokens/set-refreshing', payload: { tokenId: 'session' } })
    expect(twice.tokens.session).toEqual({ value: 'initial-token', status: 'refreshing', failedAttempts: 0 })
  })
})

describe('tokens domain — tokens/record-failed-attempt action', () => {
  it('increments failedAttempts by 1 without changing status or value', () => {
    const state = createRuntimeState(testConfigWithOneToken)
    const next = runtimeStateReducer(state, { type: 'tokens/record-failed-attempt', payload: { tokenId: 'session' } })
    expect(next.tokens.session).toEqual({ value: 'initial-token', status: 'ready', failedAttempts: 1 })
  })

  it('two consecutive record-failed-attempt calls result in failedAttempts 2', () => {
    const state = createRuntimeState(testConfigWithOneToken)
    const first = runtimeStateReducer(state, { type: 'tokens/record-failed-attempt', payload: { tokenId: 'session' } })
    const second = runtimeStateReducer(first, { type: 'tokens/record-failed-attempt', payload: { tokenId: 'session' } })
    expect(second.tokens.session.failedAttempts).toBe(2)
  })
})

describe('tokens domain — tokens/set-error action', () => {
  it('sets status to error while preserving value and existing failedAttempts', () => {
    const state = createRuntimeState(testConfigWithOneToken)
    const next = runtimeStateReducer(state, { type: 'tokens/set-error', payload: { tokenId: 'session' } })
    expect(next.tokens.session).toEqual({ value: 'initial-token', status: 'error', failedAttempts: 0 })
  })

  it('preserves the value even when set-error is called', () => {
    const state = createRuntimeState(testConfigWithOneToken)
    // Simulate a set-value then error
    const withValue = runtimeStateReducer(state, { type: 'tokens/set-value', payload: { tokenId: 'session', value: 'refreshed-token' } })
    const withError = runtimeStateReducer(withValue, { type: 'tokens/set-error', payload: { tokenId: 'session' } })
    expect(withError.tokens.session.value).toBe('refreshed-token')
    expect(withError.tokens.session.status).toBe('error')
  })
})

describe('tokens domain — tokens/set-value action', () => {
  it('replaces value, sets status to ready, and resets failedAttempts to 0', () => {
    const state = createRuntimeState(testConfigWithOneToken)
    const next = runtimeStateReducer(state, { type: 'tokens/set-value', payload: { tokenId: 'session', value: 'new-token' } })
    expect(next.tokens.session).toEqual({ value: 'new-token', status: 'ready', failedAttempts: 0 })
  })

  it('resets failedAttempts to 0 even when coming from error state', () => {
    const state = createRuntimeState(testConfigWithOneToken)
    const withFailed = runtimeStateReducer(state, { type: 'tokens/record-failed-attempt', payload: { tokenId: 'session' } })
    const withError = runtimeStateReducer(withFailed, { type: 'tokens/set-error', payload: { tokenId: 'session' } })
    const recovered = runtimeStateReducer(withError, { type: 'tokens/set-value', payload: { tokenId: 'session', value: 'nuevo' } })
    expect(recovered.tokens.session).toEqual({ value: 'nuevo', status: 'ready', failedAttempts: 0 })
  })
})

describe('tokens domain — action on unknown tokenId', () => {
  it('tokens/set-refreshing on unknown tokenId does not throw', () => {
    const state = createRuntimeState(testConfig)
    expect(() => runtimeStateReducer(state, { type: 'tokens/set-refreshing', payload: { tokenId: 'nonexistent' } })).not.toThrow()
  })

  it('tokens/set-value on unknown tokenId does not throw', () => {
    const state = createRuntimeState(testConfig)
    expect(() => runtimeStateReducer(state, { type: 'tokens/set-value', payload: { tokenId: 'nonexistent', value: 'x' } })).not.toThrow()
  })

  it('tokens/set-error on unknown tokenId does not throw', () => {
    const state = createRuntimeState(testConfig)
    expect(() => runtimeStateReducer(state, { type: 'tokens/set-error', payload: { tokenId: 'nonexistent' } })).not.toThrow()
  })

  it('tokens/record-failed-attempt on unknown tokenId does not throw', () => {
    const state = createRuntimeState(testConfig)
    expect(() => runtimeStateReducer(state, { type: 'tokens/record-failed-attempt', payload: { tokenId: 'nonexistent' } })).not.toThrow()
  })
})

describe('tokens domain — runtime/reset', () => {
  it('restores the tokens domain from the snapshot', () => {
    const state = createRuntimeState(testConfigWithOneToken)
    const modified = runtimeStateReducer(state, { type: 'tokens/set-value', payload: { tokenId: 'session', value: 'changed' } })

    const reset = runtimeStateReducer(modified, { type: 'runtime/reset', payload: { state } })
    expect(reset.tokens.session).toEqual({ value: 'initial-token', status: 'ready', failedAttempts: 0 })
  })

  it('runtime/reset with a snapshot that includes tokens restores them exactly', () => {
    const state = createRuntimeState(testConfigWithOneToken)
    const snapshot: RuntimeState = {
      ...state,
      tokens: {
        session: { value: 'snapshot-token', status: 'error', failedAttempts: 2 },
      },
    }
    const reset = runtimeStateReducer(state, { type: 'runtime/reset', payload: { state: snapshot } })
    expect(reset.tokens.session).toEqual({ value: 'snapshot-token', status: 'error', failedAttempts: 2 })
  })
})

describe('tokens domain — full cycle sequences', () => {
  it('sequence refreshing → record-failed × 2 → set-error leaves token in error with failedAttempts 2', () => {
    const state = createRuntimeState(testConfigWithOneToken)
    const s1 = runtimeStateReducer(state, { type: 'tokens/set-refreshing', payload: { tokenId: 'session' } })
    const s2 = runtimeStateReducer(s1, { type: 'tokens/record-failed-attempt', payload: { tokenId: 'session' } })
    const s3 = runtimeStateReducer(s2, { type: 'tokens/record-failed-attempt', payload: { tokenId: 'session' } })
    const s4 = runtimeStateReducer(s3, { type: 'tokens/set-error', payload: { tokenId: 'session' } })
    expect(s4.tokens.session).toEqual({ value: 'initial-token', status: 'error', failedAttempts: 2 })
  })

  it('sequence refreshing → set-value leaves token as ready with new value and failedAttempts 0', () => {
    const state = createRuntimeState(testConfigWithOneToken)
    const s1 = runtimeStateReducer(state, { type: 'tokens/set-refreshing', payload: { tokenId: 'session' } })
    const s2 = runtimeStateReducer(s1, { type: 'tokens/set-value', payload: { tokenId: 'session', value: 'nuevo' } })
    expect(s2.tokens.session).toEqual({ value: 'nuevo', status: 'ready', failedAttempts: 0 })
  })

  it('actions on tokenA do not affect tokenB', () => {
    const state = createRuntimeState(testConfigWithTwoTokens)
    const next = runtimeStateReducer(state, { type: 'tokens/set-error', payload: { tokenId: 'session' } })
    expect(next.tokens.api).toEqual({ value: 'api-key', status: 'ready', failedAttempts: 0 })
  })
})
