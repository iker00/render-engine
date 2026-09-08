import type { RuntimePreloadConfig } from '../../config/runtime-config'
import type { RuntimeState } from '../runtime-state/runtime-state-types'

export function deriveBlockingPreloadNames(preloads: readonly RuntimePreloadConfig[]): string[] {
  return preloads.filter((preload) => preload.blocking === true).map((preload) => preload.operationName)
}

export function isPreloadGateBlocked(blockingNames: readonly string[], queries: RuntimeState['queries']): boolean {
  return blockingNames.some((name) => queries[name]?.status === 'loading')
}
