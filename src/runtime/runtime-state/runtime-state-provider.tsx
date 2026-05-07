import { useCallback, useEffect, useLayoutEffect, useState } from 'react'
import type { Dispatch, ReactNode } from 'react'
import { useContext, useMemo, useReducer, useRef } from 'react'
import type { NavigateToRuntimeUiAction, RuntimeApiRequestParams, RuntimeConfig, RuntimeConfigValue } from '../../config/runtime-config'
import { executeRuntimeApiOperation } from '../../queries/runtime-api-executor'
import { resolveRuntimeValue } from '../runtime-references/runtime-reference-resolver'
import { RuntimeStateContext } from './runtime-state-context'
import { createRuntimeState, runtimeStateReducer } from './runtime-state-reducer'
import { selectCurrentNavigationEntry, selectCurrentPage } from './runtime-state-selectors'
import type { RuntimeFormFieldDefinition, RuntimePageParams, RuntimeQueryError, RuntimeState, RuntimeStateAction } from './runtime-state-types'

interface RuntimeStateProviderProps {
  config: RuntimeConfig
  children: ReactNode
}

async function executeQueryOperationWithSnapshot({
  config,
  dispatch,
  operationName,
  snapshotState,
  requestParams,
  fetchImplementation,
}: {
  config: RuntimeConfig
  dispatch: Dispatch<RuntimeStateAction>
  operationName: string
  snapshotState: RuntimeState
  requestParams?: RuntimeApiRequestParams
  fetchImplementation?: typeof fetch
}) {
  dispatch({
    type: 'queries/set-loading',
    payload: {
      queryName: operationName,
    },
  })

  const result = await executeRuntimeApiOperation({
    config,
    operationName,
    state: snapshotState,
    requestParams,
    fetch: fetchImplementation,
  })

  if (result.status === 'success') {
    dispatch({
      type: 'queries/set-success',
      payload: {
        queryName: operationName,
        data: result.data,
      },
    })

    return result
  }

  dispatch({
    type: 'queries/set-error',
    payload: {
      queryName: operationName,
      error: result.error satisfies RuntimeQueryError,
    },
  })

  return result
}

export function RuntimeStateProvider({ config, children }: RuntimeStateProviderProps) {
  const [initialState] = useState(() => createRuntimeState(config))
  const [state, dispatch] = useReducer(runtimeStateReducer, initialState)
  const isFirstEntryRef = useRef(true)
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
    }),
    [config, dispatch, initialState, state],
  )

  useEffect(() => {
    if (!activeNavigationEntry) {
      return
    }

    const activePage = config.pages.find((page) => page.id === activeNavigationEntry.pageId)

    if (!activePage) {
      return
    }

    const preloadNames = activePage.preloads ?? []

    if (
      state.pageEntry.entryId === activeNavigationEntry.entryId &&
      state.pageEntry.pageId === activeNavigationEntry.pageId &&
      arePageParamsEqual(state.pageEntry.params, activeNavigationEntry.params) &&
      state.pageEntry.preloadNames.length === preloadNames.length &&
      state.pageEntry.preloadNames.every((name, index) => name === preloadNames[index])
    ) {
      return
    }

    dispatchAndSyncState({
      type: 'page-entry/set-idle',
      payload: {
        entryId: activeNavigationEntry.entryId,
        pageId: activeNavigationEntry.pageId,
        params: activeNavigationEntry.params,
        preloadNames,
      },
    })
  }, [activeNavigationEntry, config.pages, dispatchAndSyncState, state.pageEntry])

  useEffect(() => {
    if (!activeNavigationEntry) {
      isFirstEntryRef.current = false
      return
    }

    const activePage = config.pages.find((page) => page.id === activeNavigationEntry.pageId)

    if (!activePage) {
      isFirstEntryRef.current = false
      return
    }

    const preloadNames = activePage.preloads ?? []

    if (preloadNames.length === 0 && isFirstEntryRef.current) {
      isFirstEntryRef.current = false
      return
    }

    isFirstEntryRef.current = false
    const entryId = activeNavigationEntry.entryId
    const params = activeNavigationEntry.params

    if (preloadNames.length === 0) {
      dispatchAndSyncState({
        type: 'page-entry/set-idle',
        payload: {
          entryId,
          pageId: activePage.id,
          params,
          preloadNames,
        },
      })

      return
    }

    dispatchAndSyncState({
      type: 'page-entry/set-loading',
      payload: {
        entryId,
        pageId: activePage.id,
        params,
        preloadNames,
      },
    })

    const snapshotState = latestStateRef.current

    void Promise.all(
      preloadNames.map((operationName) =>
        executeQueryOperationWithSnapshot({
          config,
          dispatch: dispatchAndSyncState,
          operationName,
          snapshotState,
        }),
      ),
    ).then((results) => {
      dispatchAndSyncState({
        type: 'page-entry/set-settled',
        payload: {
          entryId,
          status: results.every((result) => result.status === 'success') ? 'success' : 'error',
        },
      })
    })
  }, [activeNavigationEntry, config, dispatchAndSyncState])

  return <RuntimeStateContext.Provider value={contextValue}>{children}</RuntimeStateContext.Provider>
}

export function useRuntimeState() {
  return useRuntimeStateContext().state
}

export function useRuntimeStateActions() {
  const { config, dispatch, initialState, state } = useRuntimeStateContext()
  const latestStateRef = useRef(state)

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

  const navigateToPage = useCallback(
    (pageId: string, params: NavigateToRuntimeUiAction['params'] = {}) => {
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

      const resolvedParams = resolveNavigationParams(params, latestStateRef.current)

      dispatchAndSyncState({
        type: 'navigation/navigate',
        payload: {
          pageId: page.id,
          params: resolvedParams,
        },
      })
    },
    [config.pages, dispatchAndSyncState],
  )

  const goBackPage = useCallback(() => {
    dispatchAndSyncState({
      type: 'navigation/go-back',
    })
  }, [dispatchAndSyncState])

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
      options?: { fetch?: typeof fetch; snapshotState?: RuntimeState; requestParams?: RuntimeApiRequestParams },
    ) => {
      return executeQueryOperationWithSnapshot({
        config,
        dispatch: dispatchAndSyncState,
        operationName,
        snapshotState: options?.snapshotState ?? latestStateRef.current,
        requestParams: options?.requestParams,
        fetchImplementation: options?.fetch,
      })
    },
    [config, dispatchAndSyncState],
  )

  return useMemo(
    () => ({
      executeQueryOperation,
      goBackPage,
      initializeForm,
      initializeQuery,
      navigateToPage,
      resetQuery,
      resetForm,
      readRuntimeState() {
        return latestStateRef.current
      },
      resetRuntimeState() {
        latestStateRef.current = initialState
        dispatch({
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
      dispatch,
      initialState,
      executeQueryOperation,
      goBackPage,
      initializeForm,
      initializeQuery,
      navigateToPage,
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

function resolveNavigationParams(
  params: NavigateToRuntimeUiAction['params'],
  state: RuntimeState,
): RuntimePageParams {
  const resolvedParams: RuntimePageParams = {}

  for (const [key, value] of Object.entries(params ?? {})) {
    const resolvedValue = typeof value === 'string' ? resolveRuntimeValue(value, state) : { status: 'resolved', value } as const

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
