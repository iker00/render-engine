import { useEffect, useRef } from 'react'
import type { RuntimeConfig } from '../../config/runtime-config'
import type { RuntimeState, RuntimeStateAction } from '../runtime-state/runtime-state-types'
import { executeTokenRefresh } from './execute-token-refresh'

interface TokenTimerRef {
  timeoutId: ReturnType<typeof setTimeout>
  generation: number
}

export interface UseRuntimeTokenSchedulerOptions {
  config: RuntimeConfig
  dispatch: (action: RuntimeStateAction) => void
  getLatestState: () => RuntimeState
  fetchImplementation?: typeof fetch
}

export function useRuntimeTokenScheduler({
  config,
  dispatch,
  getLatestState,
  fetchImplementation,
}: UseRuntimeTokenSchedulerOptions): void {
  const timersRef = useRef<Map<string, TokenTimerRef>>(new Map())
  const generationRef = useRef<Map<string, number>>(new Map())

  useEffect(() => {
    const tokens = config.tokens

    if (!tokens) {
      return
    }

    const tokensWithRefresh = Object.entries(tokens).filter(([, tokenConfig]) => tokenConfig.refresh !== undefined)

    if (tokensWithRefresh.length === 0) {
      return
    }

    // Increment generation for each token to invalidate any in-flight results from prior effects
    for (const [tokenId] of tokensWithRefresh) {
      const currentGen = generationRef.current.get(tokenId) ?? 0
      generationRef.current.set(tokenId, currentGen + 1)
    }

    function scheduleNextCycle(tokenId: string, delayMs: number, generation: number) {
      const timeoutId = setTimeout(() => {
        void runCycle(tokenId, generation)
      }, delayMs)

      timersRef.current.set(tokenId, { timeoutId, generation })
    }

    async function runCycle(tokenId: string, generation: number) {
      const currentGeneration = generationRef.current.get(tokenId)

      if (currentGeneration !== generation) {
        return
      }

      const tokenConfig = config.tokens?.[tokenId]

      if (!tokenConfig?.refresh) {
        return
      }

      const refreshConfig = tokenConfig.refresh
      const intervalMs = refreshConfig.intervalSeconds * 1000
      const fetchImpl = fetchImplementation ?? globalThis.fetch

      // Attempt 1
      dispatch({ type: 'tokens/set-refreshing', payload: { tokenId } })

      const outcome1 = await executeTokenRefresh({
        config,
        tokenId,
        refreshConfig,
        snapshotState: getLatestState(),
        fetchImplementation: fetchImpl,
      })

      if (generationRef.current.get(tokenId) !== generation) {
        return
      }

      if (outcome1.kind === 'success') {
        dispatch({ type: 'tokens/set-value', payload: { tokenId, value: outcome1.value } })
        scheduleNextCycle(tokenId, intervalMs, generation)
        return
      }

      // Attempt 1 failed — record and immediately run attempt 2
      dispatch({ type: 'tokens/record-failed-attempt', payload: { tokenId } })

      if (generationRef.current.get(tokenId) !== generation) {
        return
      }

      // Attempt 2 (immediate)
      dispatch({ type: 'tokens/set-refreshing', payload: { tokenId } })

      const outcome2 = await executeTokenRefresh({
        config,
        tokenId,
        refreshConfig,
        snapshotState: getLatestState(),
        fetchImplementation: fetchImpl,
      })

      if (generationRef.current.get(tokenId) !== generation) {
        return
      }

      if (outcome2.kind === 'success') {
        dispatch({ type: 'tokens/set-value', payload: { tokenId, value: outcome2.value } })
        scheduleNextCycle(tokenId, intervalMs, generation)
        return
      }

      // Both attempts failed
      dispatch({ type: 'tokens/record-failed-attempt', payload: { tokenId } })
      dispatch({ type: 'tokens/set-error', payload: { tokenId } })
      scheduleNextCycle(tokenId, intervalMs, generation)
    }

    // Schedule initial refresh for each token with refresh config
    for (const [tokenId, tokenConfig] of tokensWithRefresh) {
      if (!tokenConfig.refresh) continue
      const generation = generationRef.current.get(tokenId) ?? 1
      const delayMs = tokenConfig.refresh.intervalSeconds * 1000
      scheduleNextCycle(tokenId, delayMs, generation)
    }

    return () => {
      // Cleanup: cancel all active timers and increment generation to invalidate in-flight results
      for (const [tokenId, timerRef] of timersRef.current) {
        clearTimeout(timerRef.timeoutId)
        const currentGen = generationRef.current.get(tokenId) ?? 0
        generationRef.current.set(tokenId, currentGen + 1)
      }
      timersRef.current.clear()
    }
  }, [config, dispatch, fetchImplementation, getLatestState])
}
