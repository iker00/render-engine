import { buildRuntimeApiRequest } from '../../queries/runtime-api-executor'
import type { RuntimeApiError } from '../../queries/runtime-api-executor'
import type { RuntimeApiRequestParams, RuntimeConfig } from '../../config/runtime-config'
import type { RuntimeState } from '../runtime-state/runtime-state-types'

/**
 * A single resolved entry of the root `config.preloads` block: the operation
 * to run, the effective request params used to build it, and either a
 * `requestSignature` (compose succeeded) or a `composeError` (compose failed
 * deterministically, e.g. `operation-not-found`).
 */
export interface GlobalPreloadPlanItem {
  operationName: string
  requestParams: RuntimeApiRequestParams
  requestSignature: string | null
  composeError: RuntimeApiError | null
}

/**
 * Pure planner for the root `preloads` block: resolves each entry against
 * `buildRuntimeApiRequest` without dispatching or performing any network
 * effect. Same `config`/`state` input always produces the same `items`
 * output, in the same order as `config.preloads`.
 *
 * Only imports `buildRuntimeApiRequest` (frontier: `src/queries/`). Never
 * imports the reducer or the provider, so the network-request shape stays
 * decoupled from how the resulting plan is later seeded into state (T4) or
 * executed (T5).
 */
export function planGlobalPreloads({
  config,
  state,
}: {
  config: RuntimeConfig
  state: RuntimeState
}): { items: GlobalPreloadPlanItem[] } {
  const globalPreloads = config.preloads ?? []

  const items = globalPreloads.map((preload): GlobalPreloadPlanItem => {
    const requestResult = buildRuntimeApiRequest({
      config,
      operationName: preload.operationName,
      state,
      requestParams: preload.requestParams,
    })

    if (requestResult.status === 'ready') {
      return {
        operationName: preload.operationName,
        requestParams: preload.requestParams,
        requestSignature: requestResult.request.requestSignature,
        composeError: null,
      }
    }

    return {
      operationName: preload.operationName,
      requestParams: preload.requestParams,
      requestSignature: null,
      composeError: requestResult.error,
    }
  })

  return { items }
}
