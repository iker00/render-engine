import { useCallback } from 'react'
import type { ReactNode } from 'react'
import { useContext, useMemo, useReducer, useRef } from 'react'
import type { RuntimeConfig } from '../../config/runtime-config'
import { executeRuntimeApiOperation } from '../../queries/runtime-api-executor'
import { RuntimeStateContext } from './runtime-state-context'
import { createRuntimeState, runtimeStateReducer } from './runtime-state-reducer'
import { selectCurrentPage } from './runtime-state-selectors'
import type { RuntimeFormFieldDefinition, RuntimeQueryError } from './runtime-state-types'

interface RuntimeStateProviderProps {
  config: RuntimeConfig
  children: ReactNode
}

export function RuntimeStateProvider({ config, children }: RuntimeStateProviderProps) {
  const initialStateRef = useRef(createRuntimeState(config))
  const [state, dispatch] = useReducer(runtimeStateReducer, initialStateRef.current)

  const contextValue = useMemo(
    () => ({
      config,
      initialState: initialStateRef.current,
      state,
      dispatch,
    }),
    [config, state],
  )

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
      const operation = config.api[operationName]

      if (!operation) {
        dispatch({
          type: 'queries/set-error',
          payload: {
            queryName: operationName,
            error: {
              code: 'operation-not-found',
              message: `The api operation "${operationName}" does not exist.`,
            },
          },
        })

        return
      }

      dispatch({
        type: 'queries/set-loading',
        payload: {
          queryName: operationName,
        },
      })

      const result = await executeRuntimeApiOperation({
        config,
        operationName,
        state,
        fetch: options?.fetch,
      })

      if (result.status === 'success') {
        dispatch({
          type: 'queries/set-success',
          payload: {
            queryName: operationName,
            data: result.data,
          },
        })

        return
      }

      dispatch({
        type: 'queries/set-error',
        payload: {
          queryName: operationName,
          error: result.error satisfies RuntimeQueryError,
        },
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
