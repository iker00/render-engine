import { useCallback, useEffect, useLayoutEffect, useState } from 'react'
import type { Dispatch, ReactNode } from 'react'
import { useContext, useMemo, useReducer, useRef } from 'react'
import { useRuntimeTokenScheduler } from '../runtime-tokens'
import type {
  NavigateToRuntimeUiAction,
  RuntimeApiRequestParams,
  RuntimeConfig,
  RuntimeConfigValue,
  RuntimePageConfig,
  RuntimePreloadConfig,
} from '../../config/runtime-config'
import { buildRuntimeApiRequest, buildInlineRuntimeApiRequest, executeBuiltRuntimeApiRequest } from '../../queries/runtime-api-executor'
import type { RuntimeApiOperation } from '../../config/runtime-config'
import type { RuntimeApiHiddenFormFields } from '../../queries/runtime-api-types'
import {
  areBrowserHashNavigationEntriesEqual,
  createBrowserHashNavigationHash,
  parseBrowserHashNavigationHash,
} from '../runtime-navigation/browser-hash-navigation'
import type { RuntimeIterationContext } from '../runtime-references/runtime-reference-resolver'
import { resolveRuntimeValueWithOptions } from '../runtime-references/runtime-reference-resolver'
import { matchesVisibilityRule } from '../runtime-layout-visibility'
import { RuntimeDocumentTitleEffect } from '../runtime-document-title'
import { RuntimeStateContext } from './runtime-state-context'
import { createRuntimeState, runtimeStateReducer } from './runtime-state-reducer'
import { selectCurrentNavigationEntry, selectCurrentPage } from './runtime-state-selectors'
import type { RuntimeFormFieldDefinition, RuntimePageParams, RuntimeQueryError, RuntimeState, RuntimeStateAction } from './runtime-state-types'

interface RuntimeStateProviderProps {
  config: RuntimeConfig
  dataValues?: Record<string, unknown>
  activeLanguage?: string
  children: ReactNode
}

interface PlannedPreloadReloadItem {
  operationName: string
  requestParams: RuntimeApiRequestParams
  requestSignature: string | null
}

interface PlannedPreloadBatch {
  batchSignature: string
  entryId: number
  pageId: string
  params: RuntimePageParams
  preloadNames: string[]
  reloadItems: PlannedPreloadReloadItem[]
  snapshotState: RuntimeState
}

async function executeInlineQueryOperationWithSnapshot({
  operation,
  dispatch,
  slotName,
  snapshotState,
  requestParams,
  iterationContext,
  fetchImplementation,
}: {
  operation: RuntimeApiOperation
  dispatch: Dispatch<RuntimeStateAction>
  slotName: string
  snapshotState: RuntimeState
  requestParams?: RuntimeApiRequestParams
  iterationContext?: RuntimeIterationContext
  fetchImplementation?: typeof fetch
}) {
  const requestResult = buildInlineRuntimeApiRequest({
    operation,
    operationName: slotName,
    state: snapshotState,
    requestParams,
    iterationContext,
  })

  if (requestResult.status === 'error') {
    dispatch({
      type: 'queries/set-error',
      payload: {
        queryName: slotName,
        error: requestResult.error satisfies RuntimeQueryError,
        requestSignature: null,
      },
    })

    return requestResult
  }

  dispatch({
    type: 'queries/set-loading',
    payload: {
      queryName: slotName,
      requestSignature: requestResult.request.requestSignature,
    },
  })

  const result = await executeBuiltRuntimeApiRequest({
    request: requestResult.request,
    fetch: fetchImplementation,
  })

  if (result.status === 'success') {
    dispatch({
      type: 'queries/set-success',
      payload: {
        queryName: slotName,
        data: result.data,
        requestSignature: requestResult.request.requestSignature,
      },
    })

    return result
  }

  dispatch({
    type: 'queries/set-error',
    payload: {
      queryName: slotName,
      error: result.error satisfies RuntimeQueryError,
      requestSignature: requestResult.request.requestSignature,
    },
  })

  return result
}

async function executeQueryOperationWithSnapshot({
  config,
  dispatch,
  operationName,
  snapshotState,
  requestParams,
  iterationContext,
  hiddenFormFields,
  fetchImplementation,
  skipLoadingDispatch = false,
}: {
  config: RuntimeConfig
  dispatch: Dispatch<RuntimeStateAction>
  operationName: string
  snapshotState: RuntimeState
  requestParams?: RuntimeApiRequestParams
  iterationContext?: RuntimeIterationContext
  hiddenFormFields?: RuntimeApiHiddenFormFields
  fetchImplementation?: typeof fetch
  skipLoadingDispatch?: boolean
}) {
  const requestResult = buildRuntimeApiRequest({
    config,
    operationName,
    state: snapshotState,
    requestParams,
    iterationContext,
    hiddenFormFields,
  })

  if (requestResult.status === 'error') {
    dispatch({
      type: 'queries/set-error',
      payload: {
        queryName: operationName,
        error: requestResult.error satisfies RuntimeQueryError,
        requestSignature: null,
      },
    })

    return requestResult
  }

  if (!skipLoadingDispatch) {
    dispatch({
      type: 'queries/set-loading',
      payload: {
        queryName: operationName,
        requestSignature: requestResult.request.requestSignature,
      },
    })
  }

  const result = await executeBuiltRuntimeApiRequest({
    request: requestResult.request,
    fetch: fetchImplementation,
  })

  if (result.status === 'success') {
    dispatch({
      type: 'queries/set-success',
      payload: {
        queryName: operationName,
        data: result.data,
        requestSignature: requestResult.request.requestSignature,
      },
    })

    return result
  }

  dispatch({
    type: 'queries/set-error',
      payload: {
        queryName: operationName,
        error: result.error satisfies RuntimeQueryError,
        requestSignature: requestResult.request.requestSignature,
      },
    })

  return result
}

export function RuntimeStateProvider({ config, dataValues, activeLanguage, children }: RuntimeStateProviderProps) {
  const [initialState] = useState(() => createRuntimeStateFromBrowserHash(config, dataValues, activeLanguage))
  const [state, dispatch] = useReducer(runtimeStateReducer, initialState)
  const activePreloadBatchSignatureRef = useRef<string | null>(null)
  const completedPreloadEntryIdRef = useRef<number | null>(null)
  const plannedPreloadBatchRef = useRef<PlannedPreloadBatch | null>(null)
  const latestStateRef = useRef(state)
  const activeNavigationEntry = selectCurrentNavigationEntry(state)

  useLayoutEffect(() => {
    latestStateRef.current = state
  }, [state])

  const dispatchAndSyncState = useCallback(
    (action: RuntimeStateAction) => {
      latestStateRef.current = runtimeStateReducer(latestStateRef.current, action)
      dispatch(action)
    },
    [dispatch],
  )

  const contextValue = useMemo(
    () => ({
      config,
      initialState,
      state,
      dispatch,
      dispatchAndSyncState,
      getLatestState() {
        return latestStateRef.current
      },
    }),
    [config, dispatch, dispatchAndSyncState, initialState, state],
  )

  const getLatestStateForScheduler = useCallback(() => latestStateRef.current, [])
  useRuntimeTokenScheduler({ config, dispatch: dispatchAndSyncState, getLatestState: getLatestStateForScheduler })

  useLayoutEffect(() => {
    const normalizedHash = parseBrowserHashNavigationHash(window.location.hash, {
      initialPageId: config.initialPage,
      knownPageIds: config.pages.map((page) => page.id),
    })

    if (window.location.hash !== normalizedHash.canonicalHash) {
      replaceBrowserHash(normalizedHash.canonicalHash)
    }
  }, [config.initialPage, config.pages])

  useEffect(() => {
    const syncFromBrowserHash = () => {
      const parsedHash = parseBrowserHashNavigationHash(window.location.hash, {
        initialPageId: config.initialPage,
        knownPageIds: config.pages.map((page) => page.id),
      })

      if (window.location.hash !== parsedHash.canonicalHash) {
        replaceBrowserHash(parsedHash.canonicalHash)
      }

      dispatchAndSyncState({
        type: 'navigation/sync-from-browser',
        payload: {
          pageId: parsedHash.entry.pageId,
          params: parsedHash.entry.params,
        },
      })
    }

    window.addEventListener('hashchange', syncFromBrowserHash)
    window.addEventListener('popstate', syncFromBrowserHash)

    return () => {
      window.removeEventListener('hashchange', syncFromBrowserHash)
      window.removeEventListener('popstate', syncFromBrowserHash)
    }
  }, [config.initialPage, config.pages, dispatchAndSyncState])

  useLayoutEffect(() => {
    if (!activeNavigationEntry) {
      plannedPreloadBatchRef.current = null
      activePreloadBatchSignatureRef.current = null
      completedPreloadEntryIdRef.current = null
      return
    }

    if (completedPreloadEntryIdRef.current !== null && completedPreloadEntryIdRef.current !== activeNavigationEntry.entryId) {
      completedPreloadEntryIdRef.current = null
    }

    const activePage = config.pages.find((page) => page.id === activeNavigationEntry.pageId)

    if (!activePage) {
      plannedPreloadBatchRef.current = null
      activePreloadBatchSignatureRef.current = null
      return
    }

    const snapshotState = latestStateRef.current
  const preloadPlan = planPagePreloadExecution({
      config,
      page: activePage,
      entryId: activeNavigationEntry.entryId,
      params: activeNavigationEntry.params,
      state: snapshotState,
    })
    const preloadNames = preloadPlan.preloadNames

    if (preloadNames.length === 0) {
      plannedPreloadBatchRef.current = null
      activePreloadBatchSignatureRef.current = null

      if (isMatchingPageEntryState(state.pageEntry, activeNavigationEntry.entryId, activePage.id, activeNavigationEntry.params, preloadNames, 'idle')) {
        return
      }

      dispatchAndSyncState({
        type: 'page-entry/set-idle',
        payload: {
          entryId: activeNavigationEntry.entryId,
          pageId: activePage.id,
          params: activeNavigationEntry.params,
          preloadNames,
        },
      })

      return
    }

    if (preloadPlan.reloadItems.length === 0) {
      if (
        preloadPlan.aggregateStatus === 'loading' &&
        plannedPreloadBatchRef.current !== null &&
        isMatchingPageEntryState(
          state.pageEntry,
          activeNavigationEntry.entryId,
          activePage.id,
          activeNavigationEntry.params,
          preloadNames,
          'loading',
        )
      ) {
        return
      }

      plannedPreloadBatchRef.current = null
      activePreloadBatchSignatureRef.current = null

      if (
        isMatchingPageEntryState(
          state.pageEntry,
          activeNavigationEntry.entryId,
          activePage.id,
          activeNavigationEntry.params,
          preloadNames,
          preloadPlan.aggregateStatus,
        )
      ) {
        return
      }

      if (preloadPlan.aggregateStatus === 'loading') {
        dispatchAndSyncState({
          type: 'page-entry/set-loading',
          payload: {
            entryId: activeNavigationEntry.entryId,
            pageId: activePage.id,
            params: activeNavigationEntry.params,
            preloadNames,
          },
        })

        return
      }

      if (preloadPlan.aggregateStatus === 'idle') {
        dispatchAndSyncState({
          type: 'page-entry/set-idle',
          payload: {
            entryId: activeNavigationEntry.entryId,
            pageId: activePage.id,
            params: activeNavigationEntry.params,
            preloadNames,
          },
        })

        return
      }

      dispatchAndSyncState({
        type: 'page-entry/set-settled-entry',
        payload: {
          entryId: activeNavigationEntry.entryId,
          pageId: activePage.id,
          params: activeNavigationEntry.params,
          preloadNames,
          status: preloadPlan.aggregateStatus,
        },
      })

      return
    }

    if (
      isMatchingPageEntryState(state.pageEntry, activeNavigationEntry.entryId, activePage.id, activeNavigationEntry.params, preloadNames, 'loading') &&
      plannedPreloadBatchRef.current?.batchSignature === preloadPlan.batchSignature
    ) {
      return
    }

    plannedPreloadBatchRef.current = {
      batchSignature: preloadPlan.batchSignature,
      entryId: activeNavigationEntry.entryId,
      pageId: activePage.id,
      params: activeNavigationEntry.params,
      preloadNames,
      reloadItems: preloadPlan.reloadItems,
      snapshotState: preloadPlan.snapshotState,
    }

    dispatchAndSyncState({
      type: 'page-entry/start-preload-batch',
      payload: {
        entryId: activeNavigationEntry.entryId,
        pageId: activePage.id,
        params: activeNavigationEntry.params,
        preloadNames,
        resetQueries: preloadPlan.reloadItems.map((item) => ({
          queryName: item.operationName,
          requestSignature: item.requestSignature,
        })),
      },
    })
  }, [activeNavigationEntry, config, dispatchAndSyncState, state])

  useEffect(() => {
    if (!activeNavigationEntry) {
      plannedPreloadBatchRef.current = null
      activePreloadBatchSignatureRef.current = null
      return
    }

    const plannedBatch = plannedPreloadBatchRef.current

    if (!plannedBatch) {
      activePreloadBatchSignatureRef.current = null
      return
    }

    if (
      state.pageEntry.status !== 'loading' ||
      state.pageEntry.entryId !== plannedBatch.entryId ||
      state.pageEntry.pageId !== plannedBatch.pageId ||
      !arePageParamsEqual(state.pageEntry.params, plannedBatch.params) ||
      !arePreloadNamesEqual(state.pageEntry.preloadNames, plannedBatch.preloadNames)
    ) {
      activePreloadBatchSignatureRef.current = null
      return
    }

    if (activePreloadBatchSignatureRef.current === plannedBatch.batchSignature) {
      return
    }

    activePreloadBatchSignatureRef.current = plannedBatch.batchSignature
    const entryId = plannedBatch.entryId

    void Promise.all(
      plannedBatch.reloadItems.map((reloadItem) =>
        executeQueryOperationWithSnapshot({
          config,
          dispatch: dispatchAndSyncState,
          operationName: reloadItem.operationName,
          snapshotState: plannedBatch.snapshotState,
          requestParams: reloadItem.requestParams,
          skipLoadingDispatch: true,
        }),
      ),
    ).then((results) => {
      plannedPreloadBatchRef.current = null
      completedPreloadEntryIdRef.current = entryId
      dispatchAndSyncState({
        type: 'page-entry/set-settled',
        payload: {
          entryId,
          status: results.every((result) => result.status === 'success') ? 'success' : 'error',
        },
      })
    })
  }, [activeNavigationEntry, config, dispatchAndSyncState, state.pageEntry])

  return (
    <RuntimeStateContext.Provider value={contextValue}>
      <RuntimeDocumentTitleEffect />
      {children}
    </RuntimeStateContext.Provider>
  )
}

export function useRuntimeState() {
  return useRuntimeStateContext().state
}

export function useRuntimeStateActions() {
  const { config, dispatchAndSyncState, getLatestState, initialState } = useRuntimeStateContext()

  const navigateToPage = useCallback(
    (
      pageId: string,
      params: NavigateToRuntimeUiAction['params'] = {},
      options?: { iterationContext?: RuntimeIterationContext },
    ) => {
      const page = config.pages.find((entry) => entry.id === pageId)

      if (!page) {
        dispatchAndSyncState({
          type: 'navigation/set-error',
          payload: {
            error: {
              code: 'page-not-found',
              message: `The runtime page "${pageId}" does not exist.`,
              pageId,
            },
          },
        })

        return
      }

      const resolvedParams = resolveNavigationParams(params, getLatestState(), options?.iterationContext)
      const nextHash = createBrowserHashNavigationHash(
        {
          pageId: page.id,
          params: resolvedParams,
        },
        {
          initialPageId: config.initialPage,
        },
      )
      const currentEntry = selectCurrentNavigationEntry(getLatestState())

      if (
        currentEntry &&
        areBrowserHashNavigationEntriesEqual(
          {
            pageId: currentEntry.pageId,
            params: normalizePageParamsAsStrings(currentEntry.params),
          },
          {
            pageId: page.id,
            params: normalizePageParamsAsStrings(resolvedParams),
          },
        )
      ) {
        dispatchAndSyncState({
          type: 'navigation/sync-from-browser',
          payload: {
            pageId: currentEntry.pageId,
            params: currentEntry.params,
          },
        })
        return
      }

      if (window.location.hash !== nextHash) {
        dispatchAndSyncState({
          type: 'navigation/navigate',
          payload: {
            pageId: page.id,
            params: resolvedParams,
          },
        })
        pushBrowserHash(nextHash)
      }
    },
    [config.initialPage, config.pages, dispatchAndSyncState, getLatestState],
  )

  const goBackPage = useCallback(() => {
    const runtimeState = getLatestState()

    if (runtimeState.navigation.currentEntryIndex < 1) {
      return
    }

    window.history.back()
  }, [getLatestState])

  const initializeForm = useCallback(
    (formId: string, fields: Record<string, RuntimeFormFieldDefinition>) => {
      dispatchAndSyncState({
        type: 'forms/initialize',
        payload: {
          formId,
          fields,
        },
      })
    },
    [dispatchAndSyncState],
  )

  const setFormFieldValue = useCallback(
    (formId: string, fieldId: string, value: unknown) => {
      dispatchAndSyncState({
        type: 'forms/set-value',
        payload: {
          formId,
          fieldId,
          value,
        },
      })
    },
    [dispatchAndSyncState],
  )

  const setFormFieldError = useCallback(
    (formId: string, fieldId: string, error: string | null, options?: { defaultValue?: unknown }) => {
      dispatchAndSyncState({
        type: 'forms/set-error',
        payload: {
          formId,
          fieldId,
          error,
          defaultValue: options?.defaultValue,
        },
      })
    },
    [dispatchAndSyncState],
  )

  const openModal = useCallback(
    (modalId: string, options?: { iterationContext?: RuntimeIterationContext }) => {
      dispatchAndSyncState({
        type: 'modal/open',
        payload: {
          modalId,
          iterationKey: options?.iterationContext?.key,
        },
      })
    },
    [dispatchAndSyncState],
  )

  const closeModal = useCallback(
    (modalId: string, options?: { iterationContext?: RuntimeIterationContext }) => {
      dispatchAndSyncState({
        type: 'modal/close',
        payload: {
          modalId,
          iterationKey: options?.iterationContext?.key,
        },
      })
    },
    [dispatchAndSyncState],
  )

  const resetForm = useCallback(
    (formId: string) => {
      dispatchAndSyncState({
        type: 'forms/reset',
        payload: {
          formId,
        },
      })
    },
    [dispatchAndSyncState],
  )

  const removeForm = useCallback(
    (formId: string) => {
      dispatchAndSyncState({
        type: 'forms/remove',
        payload: {
          formId,
        },
      })
    },
    [dispatchAndSyncState],
  )

  const initializeQuery = useCallback(
    (queryName: string) => {
      dispatchAndSyncState({
        type: 'queries/initialize',
        payload: {
          queryName,
        },
      })
    },
    [dispatchAndSyncState],
  )

  const setQueryLoading = useCallback(
    (queryName: string) => {
      dispatchAndSyncState({
        type: 'queries/set-loading',
        payload: {
          queryName,
        },
      })
    },
    [dispatchAndSyncState],
  )

  const setQuerySuccess = useCallback(
    (queryName: string, data: unknown) => {
      dispatchAndSyncState({
        type: 'queries/set-success',
        payload: {
          queryName,
          data,
          requestSignature: null,
        },
      })
    },
    [dispatchAndSyncState],
  )

  const setQueryError = useCallback(
    (queryName: string, error: RuntimeQueryError) => {
      dispatchAndSyncState({
        type: 'queries/set-error',
        payload: {
          queryName,
          error,
          requestSignature: null,
        },
      })
    },
    [dispatchAndSyncState],
  )

  const resetQuery = useCallback(
    (queryName: string) => {
      dispatchAndSyncState({
        type: 'queries/reset',
        payload: {
          queryName,
        },
      })
    },
    [dispatchAndSyncState],
  )

  const executeQueryOperation = useCallback(
    async (
      operationName: string,
      options?: {
        fetch?: typeof fetch
        snapshotState?: RuntimeState
        requestParams?: RuntimeApiRequestParams
        iterationContext?: RuntimeIterationContext
        hiddenFormFields?: RuntimeApiHiddenFormFields
      },
    ) => {
      return executeQueryOperationWithSnapshot({
        config,
        dispatch: dispatchAndSyncState,
        operationName,
        snapshotState: options?.snapshotState ?? getLatestState(),
        requestParams: options?.requestParams,
        iterationContext: options?.iterationContext,
        hiddenFormFields: options?.hiddenFormFields,
        fetchImplementation: options?.fetch,
      })
    },
    [config, dispatchAndSyncState, getLatestState],
  )

  const executeInlineQueryOperation = useCallback(
    async (
      slotName: string,
      options: {
        operation: RuntimeApiOperation
        requestParams?: RuntimeApiRequestParams
        iterationContext?: RuntimeIterationContext
      },
      fetchOverride?: typeof fetch,
    ) => {
      return executeInlineQueryOperationWithSnapshot({
        operation: options.operation,
        dispatch: dispatchAndSyncState,
        slotName,
        snapshotState: getLatestState(),
        requestParams: options.requestParams,
        iterationContext: options.iterationContext,
        fetchImplementation: fetchOverride,
      })
    },
    [dispatchAndSyncState, getLatestState],
  )

  return useMemo(
    () => ({
      executeQueryOperation,
      executeInlineQueryOperation,
      goBackPage,
      initializeForm,
      initializeQuery,
      navigateToPage,
      openModal,
      closeModal,
      removeForm,
      resetQuery,
      resetForm,
      readRuntimeState() {
        return getLatestState()
      },
      resetRuntimeState() {
        dispatchAndSyncState({
          type: 'runtime/reset',
          payload: {
            state: initialState,
          },
        })
      },
      setFormFieldError,
      setFormFieldValue,
      setQueryError,
      setQueryLoading,
      setQuerySuccess,
    }),
    [
      dispatchAndSyncState,
      initialState,
      executeQueryOperation,
      executeInlineQueryOperation,
      goBackPage,
      initializeForm,
      initializeQuery,
      navigateToPage,
      openModal,
      closeModal,
      removeForm,
      resetForm,
      resetQuery,
      setFormFieldError,
      setFormFieldValue,
      setQueryError,
      setQueryLoading,
      setQuerySuccess,
    ],
  )
}

export function useRuntimeConfig() {
  return useRuntimeStateContext().config
}

export function useRuntimeCurrentPage() {
  const { config, state } = useRuntimeStateContext()

  return selectCurrentPage(config, state)
}

function useRuntimeStateContext() {
  const contextValue = useContext(RuntimeStateContext)

  if (contextValue === null) {
    throw new Error('RuntimeStateProvider is required to read shared runtime state.')
  }

  return contextValue
}

function arePageParamsEqual(left: RuntimePageParams, right: RuntimePageParams) {
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

function arePreloadNamesEqual(left: string[], right: string[]) {
  return left.length === right.length && left.every((name, index) => name === right[index])
}

function isMatchingPageEntryState(
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

function planPagePreloadExecution({
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

function evaluatePreloadExecution({
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

function createPreloadPlanningSnapshot(state: RuntimeState, preloadNames: string[]): RuntimeState {
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

function deriveAggregatePageEntryStatus(preloadNames: string[], state: RuntimeState['queries']) {
  if (preloadNames.some((queryName) => state[queryName]?.status === 'loading')) {
    return 'loading' as const
  }

  if (preloadNames.some((queryName) => state[queryName]?.status === 'error')) {
    return 'error' as const
  }

  return 'success' as const
}

function createPlannedPreloadBatchSignature({
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

function resolveNavigationParams(
  params: NavigateToRuntimeUiAction['params'],
  state: RuntimeState,
  iterationContext?: RuntimeIterationContext,
): RuntimePageParams {
  const resolvedParams: RuntimePageParams = {}

  for (const [key, value] of Object.entries(params ?? {})) {
    const resolvedValue =
      typeof value === 'string'
        ? resolveRuntimeValueWithOptions(value, state, { iterationContext })
        : ({ status: 'resolved', value } as const)

    if (resolvedValue.status !== 'resolved') {
      continue
    }

    if (isRuntimePageParamValue(resolvedValue.value)) {
      resolvedParams[key] = resolvedValue.value
    }
  }

  return resolvedParams
}

function isRuntimePageParamValue(value: unknown): value is RuntimeConfigValue {
  return value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
}

function createRuntimeStateFromBrowserHash(
  config: RuntimeConfig,
  dataValues?: Record<string, unknown>,
  activeLanguage?: string,
) {
  const parsedHash = parseBrowserHashNavigationHash(window.location.hash, {
    initialPageId: config.initialPage,
    knownPageIds: config.pages.map((page) => page.id),
  })
  const initialState = createRuntimeState(config, { dataValues, activeLanguage })
  const initialPage = config.pages.find((page) => page.id === parsedHash.entry.pageId)

  return {
    ...initialState,
    navigation: {
      currentPageId: parsedHash.entry.pageId,
      history: [
        {
          entryId: 0,
          pageId: parsedHash.entry.pageId,
          params: parsedHash.entry.params,
        },
      ],
      currentEntryIndex: 0,
      lastError: null,
    },
    pageEntry: {
      entryId: 0,
      pageId: parsedHash.entry.pageId,
      params: parsedHash.entry.params,
      preloadNames: initialPage?.preloads?.map((preload) => preload.operationName) ?? [],
      status: 'idle',
    },
  } satisfies RuntimeState
}

function replaceBrowserHash(hash: string) {
  const currentUrl = new URL(window.location.href)
  currentUrl.hash = hash
  window.history.replaceState(window.history.state, '', currentUrl)
}

function pushBrowserHash(hash: string) {
  const previousUrl = new URL(window.location.href)
  const nextUrl = new URL(window.location.href)
  nextUrl.hash = hash
  window.history.pushState(window.history.state, '', nextUrl)

  window.dispatchEvent(
    new HashChangeEvent('hashchange', {
      oldURL: previousUrl.toString(),
      newURL: nextUrl.toString(),
    }),
  )
}

function normalizePageParamsAsStrings(params: RuntimePageParams) {
  return Object.entries(params).reduce<Record<string, string>>((normalizedParams, [key, value]) => {
    if (value == null) {
      return normalizedParams
    }

    normalizedParams[key] = String(value)
    return normalizedParams
  }, {})
}
