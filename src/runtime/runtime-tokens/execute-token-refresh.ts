import type { RuntimeConfig } from '../../config/runtime-config'
import type { RuntimeTokenRefreshConfig } from '../../config/runtime-config'
import type { RuntimeState } from '../runtime-state/runtime-state-types'
import { buildRuntimeApiRequest, executeBuiltRuntimeApiRequest, resolveBodyPath } from '../../queries/runtime-api-executor'
import type { TokenRefreshOutcome } from './runtime-token-types'

export interface ExecuteTokenRefreshOptions {
  config: RuntimeConfig
  tokenId: string
  refreshConfig: RuntimeTokenRefreshConfig
  snapshotState: RuntimeState
  fetchImplementation: typeof fetch
}

export async function executeTokenRefresh({
  config,
  refreshConfig,
  snapshotState,
  fetchImplementation,
}: ExecuteTokenRefreshOptions): Promise<TokenRefreshOutcome> {
  const requestResult = buildRuntimeApiRequest({
    config,
    operationName: refreshConfig.operation,
    state: snapshotState,
  })

  if (requestResult.status === 'error') {
    return { kind: 'failure' }
  }

  const executionResult = await executeBuiltRuntimeApiRequest({
    request: requestResult.request,
    fetch: fetchImplementation,
  })

  if (executionResult.status === 'error') {
    return { kind: 'failure' }
  }

  const pathResult = resolveBodyPath(executionResult.data, refreshConfig.responsePath)

  if (!pathResult.found || typeof pathResult.value !== 'string' || pathResult.value.length === 0) {
    return { kind: 'failure' }
  }

  return { kind: 'success', value: pathResult.value }
}
