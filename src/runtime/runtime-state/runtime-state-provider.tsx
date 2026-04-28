import { useCallback, useEffect } from 'react'
import type { Dispatch, ReactNode } from 'react'
import { useContext, useMemo, useReducer, useRef } from 'react'
import type { RuntimeConfig } from '../../config/runtime-config'
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
  fetchImplementation,
}: {
  config: RuntimeConfig
  dispatch: Dispatch<RuntimeStateAction>
  operationName: string
  snapshotState: RuntimeState
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
  const initialStateRef = useRef(createRuntimeState(config))
  const [state, dispatch] = useReducer(runtimeStateReducer, initialStateRef.current)
  const pageEntryIdRef = useRef(initialStateRef.current.pageEntry.entryId)
  const isFirstEntryRef = useRef(true)
  const latestStateRef = useRef(state)

  latestStateRef.current = state

  const contextValue = useMemo(
    () => ({
      config,
      initialState: initialStateRef.current,
      state,
      dispatch,
    }),
    [config, state],
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
      dispatch({
        type: 'page-entry/set-idle',
        payload: {
          entryId,
          pageId: activePage.id,
          preloadNames,
        },
      })

      return
    }

    dispatch({
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
          dispatch,
          operationName,
          snapshotState,
        }),
      ),
    ).then((results) => {
      dispatch({
        type: 'page-entry/set-settled',
        payload: {
          entryId,
          status: results.every((result) => result.status === 'success') ? 'success' : 'error',
        },
      })
    })
  }, [config, dispatch, state.navigation.currentPageId])

  return <RuntimeStateContext.Provider value={contextValue}>{children}</RuntimeStateContext.Provider>
}

export function useRuntimeState() {
  return useRuntimeStateContext().state
}

export function useRuntimeStateActions() {
  const { config, dispatch, initialState, state } = useRuntimeStateContext()

  const navigateToPage = useCallback(
    (pageId: string) => {
      const page = config.pages.find((entry) => entry.id === pageId)

      if (!page) {
        dispatch({
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

      dispatch({
        type: 'navigation/navigate',
        payload: {
          pageId: page.id,
        },
      })
    },
    [config.pages, dispatch],
  )

  const initializeForm = useCallback(
    (formId: string, fields: Record<string, RuntimeFormFieldDefinition>) => {
      dispatch({
        type: 'forms/initialize',
        payload: {
          formId,
          fields,
        },
      })
    },
    [dispatch],
  )

  const setFormFieldValue = useCallback(
    (formId: string, fieldId: string, value: unknown) => {
      dispatch({
        type: 'forms/set-value',
        payload: {
          formId,
          fieldId,
          value,
        },
      })
    },
    [dispatch],
  )

  const setFormFieldError = useCallback(
    (formId: string, fieldId: string, error: string | null) => {
      dispatch({
        type: 'forms/set-error',
        payload: {
          formId,
          fieldId,
          error,
        },
      })
    },
    [dispatch],
  )

  const resetForm = useCallback(
    (formId: string) => {
      dispatch({
        type: 'forms/reset',
        payload: {
          formId,
        },
      })
    },
    [dispatch],
  )

  const initializeQuery = useCallback(
    (queryName: string) => {
      dispatch({
        type: 'queries/initialize',
        payload: {
          queryName,
        },
      })
    },
    [dispatch],
  )

  const setQueryLoading = useCallback(
    (queryName: string) => {
      dispatch({
        type: 'queries/set-loading',
        payload: {
          queryName,
        },
      })
    },
    [dispatch],
  )

  const setQuerySuccess = useCallback(
    (queryName: string, data: unknown) => {
      dispatch({
        type: 'queries/set-success',
        payload: {
          queryName,
          data,
        },
      })
    },
    [dispatch],
  )

  const setQueryError = useCallback(
    (queryName: string, error: RuntimeQueryError) => {
      dispatch({
        type: 'queries/set-error',
        payload: {
          queryName,
          error,
        },
      })
    },
    [dispatch],
  )

  const resetQuery = useCallback(
    (queryName: string) => {
      dispatch({
        type: 'queries/reset',
        payload: {
          queryName,
        },
      })
    },
    [dispatch],
  )

  const executeQueryOperation = useCallback(
    async (operationName: string, options?: { fetch?: typeof fetch }) => {
      await executeQueryOperationWithSnapshot({
        config,
        dispatch,
        operationName,
        snapshotState: state,
        fetchImplementation: options?.fetch,
      })
    },
    [config, dispatch, state],
  )

  return useMemo(
    () => ({
      executeQueryOperation,
      initializeForm,
      initializeQuery,
      navigateToPage,
      resetQuery,
      resetForm,
      resetRuntimeState() {
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
      initializeForm,
      initializeQuery,
      navigateToPage,
      executeQueryOperation,
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

  return useMemo(() => selectCurrentPage(config, state), [config, state])
}

function useRuntimeStateContext() {
  const contextValue = useContext(RuntimeStateContext)

  if (contextValue === null) {
    throw new Error('RuntimeStateProvider is required to read shared runtime state.')
  }

  return contextValue
}
