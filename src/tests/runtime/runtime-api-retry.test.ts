import { describe, expect, it, vi } from 'vitest'
import {
  GLOBAL_PRELOAD_MAX_ATTEMPTS,
  runRuntimeApiRequestWithRetries,
} from '../../queries/runtime-api-retry'

type AttemptResult = { status: 'success'; data: string } | { status: 'error'; code: string }

describe('runRuntimeApiRequestWithRetries', () => {
  it('resolves with the success result after a single invocation when the first attempt succeeds', async () => {
    const attempt = vi.fn<(attemptIndex: number) => Promise<AttemptResult>>(async () => ({
      status: 'success',
      data: 'ok',
    }))

    const result = await runRuntimeApiRequestWithRetries<AttemptResult>({
      attempt,
      maxAttempts: 3,
    })

    expect(result).toEqual({ status: 'success', data: 'ok' })
    expect(attempt).toHaveBeenCalledTimes(1)
  })

  it('resolves with the success result after exactly two invocations when the first attempt fails', async () => {
    const attempt = vi.fn<(attemptIndex: number) => Promise<AttemptResult>>(async (attemptIndex) => {
      if (attemptIndex === 0) {
        return { status: 'error', code: 'network-error' }
      }
      return { status: 'success', data: 'recovered' }
    })

    const result = await runRuntimeApiRequestWithRetries<AttemptResult>({
      attempt,
      maxAttempts: 3,
    })

    expect(result).toEqual({ status: 'success', data: 'recovered' })
    expect(attempt).toHaveBeenCalledTimes(2)
  })

  it('resolves with the last error result after exhausting all attempts', async () => {
    const attempt = vi.fn<(attemptIndex: number) => Promise<AttemptResult>>(async (attemptIndex) => ({
      status: 'error',
      code: `error-${attemptIndex}`,
    }))

    const result = await runRuntimeApiRequestWithRetries<AttemptResult>({
      attempt,
      maxAttempts: 3,
    })

    expect(result).toEqual({ status: 'error', code: 'error-2' })
    expect(attempt).toHaveBeenCalledTimes(3)
  })

  it('exposes GLOBAL_PRELOAD_MAX_ATTEMPTS as 3', () => {
    expect(GLOBAL_PRELOAD_MAX_ATTEMPTS).toBe(3)
  })

  it('does not introduce artificial waits between attempts', async () => {
    vi.useFakeTimers()
    try {
      const attempt = vi.fn<(attemptIndex: number) => Promise<AttemptResult>>(async (attemptIndex) => {
        if (attemptIndex < 2) {
          return { status: 'error', code: 'network-error' }
        }
        return { status: 'success', data: 'done' }
      })

      const resultPromise = runRuntimeApiRequestWithRetries<AttemptResult>({
        attempt,
        maxAttempts: 3,
      })

      // No real or fake timer advancement — only microtask flushing.
      await vi.advanceTimersByTimeAsync(0)

      const result = await resultPromise

      expect(result).toEqual({ status: 'success', data: 'done' })
      expect(attempt).toHaveBeenCalledTimes(3)
    } finally {
      vi.useRealTimers()
    }
  })

  it('propagates a synchronous rejection from attempt without transforming it into an error result', async () => {
    const failure = new Error('boom')
    const attempt = vi.fn<(attemptIndex: number) => Promise<AttemptResult>>(async () => {
      throw failure
    })

    await expect(
      runRuntimeApiRequestWithRetries<AttemptResult>({ attempt, maxAttempts: 3 }),
    ).rejects.toThrow('boom')
    expect(attempt).toHaveBeenCalledTimes(1)
  })
})
