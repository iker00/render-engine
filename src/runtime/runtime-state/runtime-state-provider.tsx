import { useCallback, useEffect, useLayoutEffect, useState } from 'react'
import type { Dispatch, ReactNode } from 'react'
import { useContext, useMemo, useReducer, useRef } from 'react'
import type { RuntimeApiRequestParams, RuntimeConfig } from '../../config/runtime-config'
import { executeRuntimeApiOperation } from '../../queries/runtime-api-executor'
import { RuntimeStateContext } from './runtime-state-context'
import { createRuntimeState, runtimeStateReducer } from './runtime-state-reducer'
import { selectCurrentPage } from './runtime-state-selectors'
import type { RuntimeFormFieldDefinition, RuntimeQueryError, RuntimeState, RuntimeStateAction } from './runtime-state-types'

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
  const pageEntryIdRef = useRef(initialState.pageEntry.entryId)
  const isFirstEntryRef = useRef(true)
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
    const activePage = config.pages.find((page) => page.id === state.navigation.currentPageId)

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
    pageEntryIdRef.current += 1

    const entryId = pageEntryIdRef.current

    if (preloadNames.length === 0) {
      dispatchAndSyncState({
        type: 'page-entry/set-idle',
        payload: {
          entryId,
          pageId: activePage.id,
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
  }, [config, dispatchAndSyncState, state.navigation.currentPageId])

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
    (pageId: string) => {
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

      dispatchAndSyncState({
        type: 'navigation/navigate',
        payload: {
          pageId: page.id,
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
