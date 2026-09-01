import { useCallback, useContext, useMemo } from 'react'
import type {
  NavigateToRuntimeUiAction,
  RuntimeApiOperation,
  RuntimeApiRequestParams,
  RuntimeConfigValue,
} from '../../config/runtime-config'
import type {
  RuntimeApiEmptySubmitValues,
  RuntimeApiFileInputSources,
  RuntimeApiHiddenFormFields,
} from '../../queries/runtime-api-types'
import {
  areBrowserHashNavigationEntriesEqual,
  createBrowserHashNavigationHash,
} from '../runtime-navigation/browser-hash-navigation'
import type { RuntimeIterationContext } from '../runtime-references/runtime-reference-resolver'
import { resolveRuntimeValueWithOptions } from '../runtime-references/runtime-reference-resolver'
import { useLayoutEditModeContext } from '../use-layout-edit-mode-context'
import { RuntimeStateContext } from './runtime-state-context'
import {
  executeDownloadOperationWithSnapshot,
  executeInlineQueryOperationWithSnapshot,
  executeQueryOperationWithSnapshot,
} from './runtime-state-query-execution'
import { selectCurrentNavigationEntry, selectCurrentPage } from './runtime-state-selectors'
import type {
  RuntimeFormFieldDefinition,
  RuntimePageParams,
  RuntimeQueryError,
  RuntimeState,
} from './runtime-state-types'

// The 4 public hooks consuming `RuntimeStateContext` (plus the private `useRuntimeStateContext`
// helper they all share) live in their own module, separate from the `RuntimeStateProvider`
// component that provides the context — Fast Refresh requires component-only modules to
// preserve state across edits.

export function useRuntimeState() {
  return useRuntimeStateContext().state
}

export function useRuntimeStateActions() {
  const { config, dispatchAndSyncState, getLatestState, initialState } = useRuntimeStateContext()
  const editModeContext = useLayoutEditModeContext()

  const navigateToPage = useCallback(
    (
      pageId: string,
      params: NavigateToRuntimeUiAction['params'] = {},
      options?: { iterationContext?: RuntimeIterationContext },
    ) => {
      if (editModeContext !== null && editModeContext.active) {
        return
      }

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
    [config.initialPage, config.pages, dispatchAndSyncState, editModeContext, getLatestState],
  )

  const goBackPage = useCallback(() => {
    if (editModeContext !== null && editModeContext.active) {
      return
    }

    const runtimeState = getLatestState()

    if (runtimeState.navigation.currentEntryIndex < 1) {
      return
    }

    window.history.back()
  }, [editModeContext, getLatestState])

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
      if (editModeContext !== null && editModeContext.active) {
        return
      }

      dispatchAndSyncState({
        type: 'modal/open',
        payload: {
          modalId,
          iterationKey: options?.iterationContext?.key,
        },
      })
    },
    [dispatchAndSyncState, editModeContext],
  )

  const closeModal = useCallback(
    (modalId: string, options?: { iterationContext?: RuntimeIterationContext }) => {
      if (editModeContext !== null && editModeContext.active) {
        return
      }

      dispatchAndSyncState({
        type: 'modal/close',
        payload: {
          modalId,
          iterationKey: options?.iterationContext?.key,
        },
      })
    },
    [dispatchAndSyncState, editModeContext],
  )

  const resetForm = useCallback(
    (formId: string) => {
      if (editModeContext !== null && editModeContext.active) {
        return
      }

      dispatchAndSyncState({
        type: 'forms/reset',
        payload: {
          formId,
        },
      })
    },
    [dispatchAndSyncState, editModeContext],
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
        switchNextValue?: boolean
        hiddenFormFields?: RuntimeApiHiddenFormFields
        emptySubmitValues?: RuntimeApiEmptySubmitValues
        fileInputSources?: RuntimeApiFileInputSources
      },
    ) => {
      if (editModeContext !== null && editModeContext.active) {
        return { status: 'skipped' as const }
      }

      return executeQueryOperationWithSnapshot({
        config,
        dispatch: dispatchAndSyncState,
        operationName,
        snapshotState: options?.snapshotState ?? getLatestState(),
        requestParams: options?.requestParams,
        iterationContext: options?.iterationContext,
        switchNextValue: options?.switchNextValue,
        hiddenFormFields: options?.hiddenFormFields,
        emptySubmitValues: options?.emptySubmitValues,
        fileInputSources: options?.fileInputSources,
        fetchImplementation: options?.fetch,
      })
    },
    [config, dispatchAndSyncState, editModeContext, getLatestState],
  )

  const executeDownloadOperation = useCallback(
    async (
      operationName: string,
      options?: {
        fetch?: typeof fetch
        snapshotState?: RuntimeState
        requestParams?: RuntimeApiRequestParams
        iterationContext?: RuntimeIterationContext
      },
    ) => {
      if (editModeContext !== null && editModeContext.active) {
        return { status: 'skipped' as const }
      }

      return executeDownloadOperationWithSnapshot({
        config,
        dispatch: dispatchAndSyncState,
        operationName,
        snapshotState: options?.snapshotState ?? getLatestState(),
        requestParams: options?.requestParams,
        iterationContext: options?.iterationContext,
        fetchImplementation: options?.fetch,
      })
    },
    [config, dispatchAndSyncState, editModeContext, getLatestState],
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
      executeDownloadOperation,
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
      getLatestState,
      initialState,
      executeQueryOperation,
      executeDownloadOperation,
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
