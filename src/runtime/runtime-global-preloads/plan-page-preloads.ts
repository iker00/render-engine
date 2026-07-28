import { buildRuntimeApiRequest } from '../../queries/runtime-api-executor'
import type {
  RuntimeApiRequestParams,
  RuntimeConfig,
  RuntimePageConfig,
  RuntimePreloadConfig,
} from '../../config/runtime-config'
import { matchesVisibilityRule } from '../runtime-layout-visibility'
import type { RuntimePageParams, RuntimeQueryError, RuntimeState } from '../runtime-state/runtime-state-types'

export interface PlannedPreloadReloadItem {
  operationName: string
  requestParams: RuntimeApiRequestParams
  requestSignature: string | null
}

export interface PlannedPreloadBatch {
  batchSignature: string
  entryId: number
  pageId: string
  params: RuntimePageParams
  preloadNames: string[]
  reloadItems: PlannedPreloadReloadItem[]
  snapshotState: RuntimeState
}

export function arePageParamsEqual(left: RuntimePageParams, right: RuntimePageParams) {
  const leftKeys = Object.keys(left)
  const rightKeys = Object.keys(right)

  if (leftKeys.length !== rightKeys.length) {
    return false
  }

  for (const key of leftKeys) {
    if (!Object.is(left[key], right[key])) {
      return false
    }
  }

  return true
}

export function arePreloadNamesEqual(left: string[], right: string[]) {
  return left.length === right.length && left.every((name, index) => name === right[index])
}

export function isMatchingPageEntryState(
  pageEntry: RuntimeState['pageEntry'],
  entryId: number,
  pageId: string,
  params: RuntimePageParams,
  preloadNames: string[],
  status: RuntimeState['pageEntry']['status'],
) {
  return (
    pageEntry.entryId === entryId &&
    pageEntry.pageId === pageId &&
    pageEntry.status === status &&
    arePageParamsEqual(pageEntry.params, params) &&
    arePreloadNamesEqual(pageEntry.preloadNames, preloadNames)
  )
}

export function planPagePreloadExecution({
  config,
  page,
  entryId,
  params,
  state,
}: {
  config: RuntimeConfig
  page: RuntimePageConfig
  entryId: number
  params: RuntimePageParams
  state: RuntimeState
}) {
  const allPreloads = page.preloads ?? []
  const preloads = allPreloads.filter((preload) => matchesVisibilityRule(preload.when, state))
  const preloadNames = preloads.map((preload) => preload.operationName)
  const snapshotState = createPreloadPlanningSnapshot(state, preloadNames)

  if (preloads.length === 0) {
    return {
      preloadNames,
      reloadItems: [] as PlannedPreloadReloadItem[],
      aggregateStatus: 'idle' as const,
      batchSignature: '',
      snapshotState,
    }
  }

  const evaluations = preloads.map((preload) =>
    evaluatePreloadExecution({
      config,
      preload,
      requestState: snapshotState,
      currentState: state,
    }),
  )
  const reloadItems = evaluations
    .filter((evaluation) => evaluation.shouldReload)
    .map((evaluation) => ({
      operationName: evaluation.operationName,
      requestParams: evaluation.requestParams,
      requestSignature: evaluation.requestSignature,
    }))

  return {
    preloadNames,
    reloadItems,
    aggregateStatus: deriveAggregatePageEntryStatus(preloadNames, state.queries),
    snapshotState,
    batchSignature: createPlannedPreloadBatchSignature({
      entryId,
      pageId: page.id,
      params,
      preloadNames,
      evaluations,
    }),
  }
}

export function evaluatePreloadExecution({
  config,
  preload,
  requestState,
  currentState,
}: {
  config: RuntimeConfig
  preload: RuntimePreloadConfig
  requestState: RuntimeState
  currentState: RuntimeState
}) {
  const requestResult = buildRuntimeApiRequest({
    config,
    operationName: preload.operationName,
    state: requestState,
    requestParams: preload.requestParams,
  })
  const currentQuery = currentState.queries[preload.operationName]

  if (requestResult.status === 'ready') {
    return {
      operationName: preload.operationName,
      requestParams: preload.requestParams,
      requestSignature: requestResult.request.requestSignature,
      shouldReload: currentQuery?.requestSignature !== requestResult.request.requestSignature,
    }
  }

  return {
    operationName: preload.operationName,
    requestParams: preload.requestParams,
    requestSignature: null,
    error: requestResult.error,
    shouldReload:
      currentQuery?.status !== 'error' ||
      currentQuery.error?.code !== requestResult.error.code ||
      currentQuery.error?.message !== requestResult.error.message,
  }
}

export function createPreloadPlanningSnapshot(state: RuntimeState, preloadNames: string[]): RuntimeState {
  if (preloadNames.length === 0) {
    return state
  }

  return {
    ...state,
    queries: Object.fromEntries(
      Object.entries(state.queries).map(([queryName, queryState]) => [
        queryName,
        preloadNames.includes(queryName)
          ? {
              status: 'idle',
              data: null,
              error: null,
              requestSignature: null,
            }
          : queryState,
      ]),
    ),
  }
}

export function deriveAggregatePageEntryStatus(preloadNames: string[], state: RuntimeState['queries']) {
  if (preloadNames.some((queryName) => state[queryName]?.status === 'loading')) {
    return 'loading' as const
  }

  if (preloadNames.some((queryName) => state[queryName]?.status === 'error')) {
    return 'error' as const
  }

  return 'success' as const
}

export function createPlannedPreloadBatchSignature({
  entryId,
  pageId,
  params,
  preloadNames,
  evaluations,
}: {
  entryId: number
  pageId: string
  params: RuntimePageParams
  preloadNames: string[]
  evaluations: Array<{
    operationName: string
    requestSignature: string | null
    error?: RuntimeQueryError
  }>
}) {
  return JSON.stringify({
    entryId,
    pageId,
    params,
    preloadNames,
    evaluations: evaluations.map((evaluation) => ({
      operationName: evaluation.operationName,
      requestSignature: evaluation.requestSignature,
      error: evaluation.error ?? null,
    })),
  })
}
