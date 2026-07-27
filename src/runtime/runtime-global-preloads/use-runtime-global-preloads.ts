import { useEffect, useRef } from 'react'
import { buildRuntimeApiRequest, executeBuiltRuntimeApiRequest } from '../../queries/runtime-api-executor'
import { runRuntimeApiRequestWithRetries, GLOBAL_PRELOAD_MAX_ATTEMPTS } from '../../queries/runtime-api-retry'
import type { RuntimeApiExecutionResult } from '../../queries/runtime-api-types'
import type { RuntimeConfig } from '../../config/runtime-config'
import type { RuntimeState, RuntimeStateAction } from '../runtime-state/runtime-state-types'
import { planGlobalPreloads } from './plan-global-preloads'
import type { GlobalPreloadPlanItem } from './plan-global-preloads'

export interface UseRuntimeGlobalPreloadsOptions {
  config: RuntimeConfig
  dispatch: (action: RuntimeStateAction) => void
  getLatestState: () => RuntimeState
  fetchImplementation?: typeof fetch
}

/**
 * Fires the root `config.preloads` block's network requests exactly once per
 * `RuntimeStateProvider` instance. `RuntimeStateProvider` already seeds
 * `queries.{operationName}` with a `loading` marker for each entry when the
 * initial state is created, so this hook only has to settle that marker to
 * `success`/`error` — it never dispatches `queries/set-loading` itself.
 *
 * Guarded by a `useRef<boolean>` that is set to `true` and never reverted in
 * cleanup, so React StrictMode's mount → cleanup → mount cycle for this
 * effect still results in exactly one execution of the preload requests.
 *
 * Does not read or depend on `state.pageEntry`: root preloads run
 * independently of `initialPage`/page-entry orchestration (that belongs to
 * `pages[].preloads`, a separate mechanism).
 */
export function useRuntimeGlobalPreloads({
  config,
  dispatch,
  getLatestState,
  fetchImplementation,
}: UseRuntimeGlobalPreloadsOptions): void {
  const hasRunRef = useRef(false)

  useEffect(() => {
    if (hasRunRef.current) {
      return
    }
    hasRunRef.current = true

    const plan = planGlobalPreloads({ config, state: getLatestState() })

    for (const item of plan.items) {
      void settleGlobalPreload({ config, item, dispatch, getLatestState, fetchImplementation })
    }
  }, [config, dispatch, fetchImplementation, getLatestState])
}

async function settleGlobalPreload({
  config,
  item,
  dispatch,
  getLatestState,
  fetchImplementation,
}: {
  config: RuntimeConfig
  item: GlobalPreloadPlanItem
  dispatch: (action: RuntimeStateAction) => void
  getLatestState: () => RuntimeState
  fetchImplementation?: typeof fetch
}): Promise<void> {
  // Tracks the requestSignature of the request actually built on the attempt
  // that produced the final result (or `null` when that attempt failed to
  // compose), since `runRuntimeApiRequestWithRetries` only returns the
  // success/error result, not the request behind it.
  let finalRequestSignature: string | null = null

  const result = await runRuntimeApiRequestWithRetries<RuntimeApiExecutionResult>({
    maxAttempts: GLOBAL_PRELOAD_MAX_ATTEMPTS,
    attempt: async () => {
      const requestResult = buildRuntimeApiRequest({
        config,
        operationName: item.operationName,
        state: getLatestState(),
        requestParams: item.requestParams,
      })

      if (requestResult.status === 'error') {
        finalRequestSignature = null
        return requestResult
      }

      finalRequestSignature = requestResult.request.requestSignature

      return executeBuiltRuntimeApiRequest({
        request: requestResult.request,
        fetch: fetchImplementation,
      })
    },
  })

  if (result.status === 'success') {
    dispatch({
      type: 'queries/set-success',
      payload: {
        queryName: item.operationName,
        data: result.data,
        requestSignature: finalRequestSignature,
      },
    })
    return
  }

  dispatch({
    type: 'queries/set-error',
    payload: {
      queryName: item.operationName,
      error: result.error,
      requestSignature: finalRequestSignature,
    },
  })
}
