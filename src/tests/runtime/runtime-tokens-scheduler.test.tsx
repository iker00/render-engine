import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { RuntimeConfig } from '../../config/runtime-config'
import type { RuntimeState, RuntimeStateAction } from '../../runtime/runtime-state/runtime-state-types'
import { createRuntimeState, runtimeStateReducer } from '../../runtime/runtime-state/runtime-state-reducer'
import { useRuntimeTokenScheduler } from '../../runtime/runtime-tokens/use-runtime-token-scheduler'

// ---------------------------------------------------------------------------
// Test infrastructure
// ---------------------------------------------------------------------------

function makeConfig(options: {
  tokens?: RuntimeConfig['tokens']
  api?: RuntimeConfig['api']
} = {}): RuntimeConfig {
  return {
    api: options.api ?? {
      refreshToken: { method: 'POST', endpoint: '/auth/refresh' },
    },
    initialPage: 'home',
    pages: [{ id: 'home', layout: [] }],
    tokens: options.tokens,
  }
}

function mockFetchSuccess(responseData: unknown): typeof fetch {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    text: vi.fn().mockResolvedValue(JSON.stringify(responseData)),
  } as unknown as Response)
}

function mockFetchFailure(): typeof fetch {
  return vi.fn().mockRejectedValue(new Error('network error'))
}

interface SchedulerTestHarness {
  state: RuntimeState
  dispatchedActions: RuntimeStateAction[]
  dispatch: (action: RuntimeStateAction) => void
  getLatestState: () => RuntimeState
}

function createHarness(config: RuntimeConfig): SchedulerTestHarness {
  const dispatchedActions: RuntimeStateAction[] = []
  let currentState = createRuntimeState(config)

  const dispatch = (action: RuntimeStateAction) => {
    dispatchedActions.push(action)
    currentState = runtimeStateReducer(currentState, action)
  }

  const getLatestState = () => currentState

  return {
    get state() {
      return currentState
    },
    dispatchedActions,
    dispatch,
    getLatestState,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useRuntimeTokenScheduler — no refresh tokens', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('does not call fetch when no tokens have refresh config', async () => {
    const config = makeConfig({
      tokens: { session: { value: 'initial-token' } },
    })
    const harness = createHarness(config)
    const mockFetch = vi.fn()

    renderHook(() =>
      useRuntimeTokenScheduler({
        config,
        dispatch: harness.dispatch,
        getLatestState: harness.getLatestState,
        fetchImplementation: mockFetch,
      }),
    )

    await act(async () => {
      await vi.runAllTimersAsync()
    })

    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('does not dispatch any token actions when config has no tokens', async () => {
    const config = makeConfig({})
    const harness = createHarness(config)
    const mockFetch = vi.fn()

    renderHook(() =>
      useRuntimeTokenScheduler({
        config,
        dispatch: harness.dispatch,
        getLatestState: harness.getLatestState,
        fetchImplementation: mockFetch,
      }),
    )

    await act(async () => {
      await vi.runAllTimersAsync()
    })

    const tokenActions = harness.dispatchedActions.filter((a) => a.type.startsWith('tokens/'))
    expect(tokenActions).toHaveLength(0)
  })
})

describe('useRuntimeTokenScheduler — first refresh cycle timing', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('does not call fetch before intervalSeconds have elapsed', async () => {
    const config = makeConfig({
      tokens: {
        session: {
          value: 'initial-token',
          refresh: { operation: 'refreshToken', responsePath: 'data.token', intervalSeconds: 10 },
        },
      },
    })
    const harness = createHarness(config)
    const mockFetch = mockFetchSuccess({ data: { token: 'new-token' } })

    renderHook(() =>
      useRuntimeTokenScheduler({
        config,
        dispatch: harness.dispatch,
        getLatestState: harness.getLatestState,
        fetchImplementation: mockFetch,
      }),
    )

    await act(async () => {
      await vi.advanceTimersByTimeAsync(9000)
    })

    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('calls fetch exactly once at intervalSeconds and dispatches set-refreshing then set-value on success', async () => {
    const config = makeConfig({
      tokens: {
        session: {
          value: 'initial-token',
          refresh: { operation: 'refreshToken', responsePath: 'data.token', intervalSeconds: 10 },
        },
      },
    })
    const harness = createHarness(config)
    const mockFetch = mockFetchSuccess({ data: { token: 'new-token' } })

    renderHook(() =>
      useRuntimeTokenScheduler({
        config,
        dispatch: harness.dispatch,
        getLatestState: harness.getLatestState,
        fetchImplementation: mockFetch,
      }),
    )

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000)
    })

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const tokenActions = harness.dispatchedActions.filter((a) => a.type.startsWith('tokens/'))
    expect(tokenActions[0]).toEqual({ type: 'tokens/set-refreshing', payload: { tokenId: 'session' } })
    expect(tokenActions[1]).toEqual({ type: 'tokens/set-value', payload: { tokenId: 'session', value: 'new-token' } })
  })

  it('after a successful refresh the token has status ready with new value', async () => {
    const config = makeConfig({
      tokens: {
        session: {
          value: 'initial-token',
          refresh: { operation: 'refreshToken', responsePath: 'data.token', intervalSeconds: 10 },
        },
      },
    })
    const harness = createHarness(config)
    const mockFetch = mockFetchSuccess({ data: { token: 'refreshed' } })

    renderHook(() =>
      useRuntimeTokenScheduler({
        config,
        dispatch: harness.dispatch,
        getLatestState: harness.getLatestState,
        fetchImplementation: mockFetch,
      }),
    )

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000)
    })

    expect(harness.getLatestState().tokens.session).toEqual({ value: 'refreshed', status: 'ready', failedAttempts: 0 })
  })
})

describe('useRuntimeTokenScheduler — chained refresh cycles', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('two consecutive successful cycles each update the token value', async () => {
    const config = makeConfig({
      tokens: {
        session: {
          value: 'initial-token',
          refresh: { operation: 'refreshToken', responsePath: 'data.token', intervalSeconds: 10 },
        },
      },
    })
    const harness = createHarness(config)
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, status: 200, text: vi.fn().mockResolvedValue(JSON.stringify({ data: { token: 'first-refresh' } })) })
      .mockResolvedValueOnce({ ok: true, status: 200, text: vi.fn().mockResolvedValue(JSON.stringify({ data: { token: 'second-refresh' } })) })

    renderHook(() =>
      useRuntimeTokenScheduler({
        config,
        dispatch: harness.dispatch,
        getLatestState: harness.getLatestState,
        fetchImplementation: mockFetch,
      }),
    )

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000)
    })
    expect(harness.getLatestState().tokens.session.value).toBe('first-refresh')

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000)
    })
    expect(harness.getLatestState().tokens.session.value).toBe('second-refresh')
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })
})

describe('useRuntimeTokenScheduler — retry policy', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('first attempt failure triggers immediate second attempt (record-failed-attempt + retry at 0ms)', async () => {
    const config = makeConfig({
      tokens: {
        session: {
          value: 'initial-token',
          refresh: { operation: 'refreshToken', responsePath: 'data.token', intervalSeconds: 10 },
        },
      },
    })
    const harness = createHarness(config)

    const mockFetch = vi
      .fn()
      .mockRejectedValueOnce(new Error('network error'))
      .mockResolvedValueOnce({ ok: true, status: 200, text: vi.fn().mockResolvedValue(JSON.stringify({ data: { token: 'recovered' } })) })

    renderHook(() =>
      useRuntimeTokenScheduler({
        config,
        dispatch: harness.dispatch,
        getLatestState: harness.getLatestState,
        fetchImplementation: mockFetch,
      }),
    )

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000)
    })

    // After 10s + retry: both attempts should have fired
    expect(mockFetch).toHaveBeenCalledTimes(2)

    const tokenActions = harness.dispatchedActions.filter((a) => a.type.startsWith('tokens/'))
    // set-refreshing (attempt 1) → record-failed-attempt (attempt 1 fails) → set-refreshing (attempt 2) → set-value (success)
    expect(tokenActions.map((a) => a.type)).toContain('tokens/record-failed-attempt')
    expect(tokenActions[tokenActions.length - 1]).toMatchObject({ type: 'tokens/set-value', payload: { tokenId: 'session', value: 'recovered' } })
  })

  it('attempt 2 success leaves token ready with new value and failedAttempts 0 (spec criterion 3)', async () => {
    const config = makeConfig({
      tokens: {
        session: {
          value: 'initial-token',
          refresh: { operation: 'refreshToken', responsePath: 'data.token', intervalSeconds: 10 },
        },
      },
    })
    const harness = createHarness(config)

    const mockFetch = vi
      .fn()
      .mockRejectedValueOnce(new Error('network error'))
      .mockResolvedValueOnce({ ok: true, status: 200, text: vi.fn().mockResolvedValue(JSON.stringify({ data: { token: 'from-retry' } })) })

    renderHook(() =>
      useRuntimeTokenScheduler({
        config,
        dispatch: harness.dispatch,
        getLatestState: harness.getLatestState,
        fetchImplementation: mockFetch,
      }),
    )

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000)
    })

    const tokenState = harness.getLatestState().tokens.session
    expect(tokenState).toEqual({ value: 'from-retry', status: 'ready', failedAttempts: 0 })
  })

  it('both attempts fail → set-error with failedAttempts 2 (spec criterion 4)', async () => {
    const config = makeConfig({
      tokens: {
        session: {
          value: 'initial-token',
          refresh: { operation: 'refreshToken', responsePath: 'data.token', intervalSeconds: 10 },
        },
      },
    })
    const harness = createHarness(config)
    const mockFetch = mockFetchFailure()

    renderHook(() =>
      useRuntimeTokenScheduler({
        config,
        dispatch: harness.dispatch,
        getLatestState: harness.getLatestState,
        fetchImplementation: mockFetch,
      }),
    )

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000)
    })

    const tokenState = harness.getLatestState().tokens.session
    expect(tokenState.status).toBe('error')
    expect(tokenState.failedAttempts).toBe(2)
    expect(tokenState.value).toBe('initial-token')
  })

  it('after entering error state the next interval reopens the cycle (Q1 resolution)', async () => {
    const config = makeConfig({
      tokens: {
        session: {
          value: 'initial-token',
          refresh: { operation: 'refreshToken', responsePath: 'data.token', intervalSeconds: 10 },
        },
      },
    })
    const harness = createHarness(config)

    const mockFetch = vi
      .fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce({ ok: true, status: 200, text: vi.fn().mockResolvedValue(JSON.stringify({ data: { token: 'recovered-after-error' } })) })
      .mockResolvedValueOnce({ ok: true, status: 200, text: vi.fn().mockResolvedValue(JSON.stringify({ data: { token: 'recovered-after-error' } })) })

    renderHook(() =>
      useRuntimeTokenScheduler({
        config,
        dispatch: harness.dispatch,
        getLatestState: harness.getLatestState,
        fetchImplementation: mockFetch,
      }),
    )

    // First cycle: both fail → error state
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000)
    })
    expect(harness.getLatestState().tokens.session.status).toBe('error')

    // Next cycle: success → back to ready
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000)
    })
    const tokenState = harness.getLatestState().tokens.session
    expect(tokenState.status).toBe('ready')
    expect(tokenState.value).toBe('recovered-after-error')
  })
})

describe('useRuntimeTokenScheduler — cleanup', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('does not call fetch if hook unmounts before first interval elapses', async () => {
    const config = makeConfig({
      tokens: {
        session: {
          value: 'initial-token',
          refresh: { operation: 'refreshToken', responsePath: 'data.token', intervalSeconds: 10 },
        },
      },
    })
    const harness = createHarness(config)
    const mockFetch = mockFetchSuccess({ data: { token: 'should-not-appear' } })

    const { unmount } = renderHook(() =>
      useRuntimeTokenScheduler({
        config,
        dispatch: harness.dispatch,
        getLatestState: harness.getLatestState,
        fetchImplementation: mockFetch,
      }),
    )

    unmount()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000)
    })

    expect(mockFetch).not.toHaveBeenCalled()
  })
})

describe('useRuntimeTokenScheduler — multiple independent tokens', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('two tokens refresh independently at their own intervals (spec criterion 15)', async () => {
    const config = makeConfig({
      api: {
        refreshA: { method: 'POST', endpoint: '/auth/refreshA' },
        refreshB: { method: 'POST', endpoint: '/auth/refreshB' },
      },
      tokens: {
        tokenA: {
          value: 'a-initial',
          refresh: { operation: 'refreshA', responsePath: 'data.token', intervalSeconds: 5 },
        },
        tokenB: {
          value: 'b-initial',
          refresh: { operation: 'refreshB', responsePath: 'data.value', intervalSeconds: 30 },
        },
      },
    })

    const harness = createHarness(config)
    const mockFetch = vi
      .fn()
      .mockResolvedValue({ ok: true, status: 200, text: vi.fn().mockResolvedValue(JSON.stringify({ data: { token: 'a-refreshed', value: 'b-refreshed' } })) })

    renderHook(() =>
      useRuntimeTokenScheduler({
        config,
        dispatch: harness.dispatch,
        getLatestState: harness.getLatestState,
        fetchImplementation: mockFetch,
      }),
    )

    // After 5s: only tokenA should have refreshed
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000)
    })

    expect(harness.getLatestState().tokens.tokenA.value).toBe('a-refreshed')
    // tokenB has not refreshed yet
    expect(harness.getLatestState().tokens.tokenB.value).toBe('b-initial')
  })

  it('failure of tokenA does not affect tokenB (spec criterion 15)', async () => {
    const config = makeConfig({
      api: {
        refreshA: { method: 'POST', endpoint: '/auth/refreshA' },
        refreshB: { method: 'POST', endpoint: '/auth/refreshB' },
      },
      tokens: {
        tokenA: {
          value: 'a-initial',
          refresh: { operation: 'refreshA', responsePath: 'data.token', intervalSeconds: 5 },
        },
        tokenB: {
          value: 'b-initial',
          refresh: { operation: 'refreshB', responsePath: 'data.value', intervalSeconds: 5 },
        },
      },
    })

    const harness = createHarness(config)

    // refreshA always fails; refreshB always succeeds
    const mockFetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('refreshA')) {
        return Promise.reject(new Error('fail'))
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue(JSON.stringify({ data: { value: 'b-refreshed' } })),
      })
    })

    renderHook(() =>
      useRuntimeTokenScheduler({
        config,
        dispatch: harness.dispatch,
        getLatestState: harness.getLatestState,
        fetchImplementation: mockFetch,
      }),
    )

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000)
    })

    // tokenA should be in error (both attempts failed)
    expect(harness.getLatestState().tokens.tokenA.status).toBe('error')
    // tokenB should remain ready with refreshed value
    expect(harness.getLatestState().tokens.tokenB.status).toBe('ready')
    expect(harness.getLatestState().tokens.tokenB.value).toBe('b-refreshed')
  })
})

describe('useRuntimeTokenScheduler — cross-token header reference', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('when refresh operation uses another token in headers and that token is in error, refresh fails with failure policy', async () => {
    const config = makeConfig({
      api: {
        refreshToken: {
          method: 'POST',
          endpoint: '/auth/refresh',
          headers: { 'X-Api-Key': 'tokens.api.value' },
        },
      },
      tokens: {
        session: {
          value: 'session-token',
          refresh: { operation: 'refreshToken', responsePath: 'data.token', intervalSeconds: 10 },
        },
        api: {
          value: 'api-key',
        },
      },
    })

    const harness = createHarness(config)
    // Manually set api token to error state in harness
    harness.dispatch({ type: 'tokens/set-error', payload: { tokenId: 'api' } })

    const mockFetch = mockFetchSuccess({ data: { token: 'new-session' } })

    renderHook(() =>
      useRuntimeTokenScheduler({
        config,
        dispatch: harness.dispatch,
        getLatestState: harness.getLatestState,
        fetchImplementation: mockFetch,
      }),
    )

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000)
    })

    // The request build failed because api token is in error → session should go to error after 2 attempts
    expect(harness.getLatestState().tokens.session.status).toBe('error')
    // fetch should not have been called since build fails
    expect(mockFetch).not.toHaveBeenCalled()
  })
})
