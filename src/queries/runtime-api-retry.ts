/**
 * Bounded retry primitive for remote operations. It knows nothing about
 * `RuntimeConfig`, `RuntimeState`, or the reducer — it only runs a caller-supplied
 * `attempt` function up to `maxAttempts` times, sequentially, with no wait between
 * attempts, and returns the first `success` result or the last `error` result.
 *
 * `GLOBAL_PRELOAD_MAX_ATTEMPTS` is the single source of truth for the retry
 * policy applied to the global `preloads` block (wired in a later task).
 */
export const GLOBAL_PRELOAD_MAX_ATTEMPTS = 3

export interface RunRuntimeApiRequestWithRetriesOptions<
  TResult extends { status: 'success' } | { status: 'error' },
> {
  attempt: (attemptIndex: number) => Promise<TResult>
  maxAttempts: number
}

export async function runRuntimeApiRequestWithRetries<
  TResult extends { status: 'success' } | { status: 'error' },
>({ attempt, maxAttempts }: RunRuntimeApiRequestWithRetriesOptions<TResult>): Promise<TResult> {
  let lastResult: TResult | undefined

  for (let i = 0; i < maxAttempts; i += 1) {
    const result = await attempt(i)

    if (result.status === 'success') {
      return result
    }

    lastResult = result
  }

  return lastResult as TResult
}
