import { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useRuntimeTokenScheduler } from '../runtime-tokens'
import {
  arePageParamsEqual,
  arePreloadNamesEqual,
  isMatchingPageEntryState,
  planGlobalPreloads,
  planPagePreloadExecution,
  useRuntimeGlobalPreloads,
} from '../runtime-global-preloads'
import type { PlannedPreloadBatch } from '../runtime-global-preloads'
import type { RuntimeConfig } from '../../config/runtime-config'
import { parseBrowserHashNavigationHash, replaceBrowserHash } from '../runtime-navigation/browser-hash-navigation'
import { RuntimeDocumentTitleEffect } from '../runtime-document-title'
import { RuntimeStateContext } from './runtime-state-context'
import { createRuntimeState, runtimeStateReducer } from './runtime-state-reducer'
import { executeQueryOperationWithSnapshot } from './runtime-state-query-execution'
import { selectCurrentNavigationEntry } from './runtime-state-selectors'
import type { RuntimeState, RuntimeStateAction } from './runtime-state-types'

interface RuntimeStateProviderProps {
  config: RuntimeConfig
  dataValues?: Record<string, unknown>
  activeLanguage?: string
  children: ReactNode
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
  useRuntimeGlobalPreloads({ config, dispatch: dispatchAndSyncState, getLatestState: getLatestStateForScheduler })

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
  const globalPreloadPlan = planGlobalPreloads({ config, state: initialState })
  const queriesWithGlobalPreloadSeeds = { ...initialState.queries }

  for (const item of globalPreloadPlan.items) {
    // dataValues (embedder-provided seeds) win over the preload plan: a query
    // name already present in `queries` at this point came from `dataValues`,
    // since `initialState` has no other query source yet. Latest-only policy:
    // never overwrite an existing entry with a `loading` marker.
    if (Object.hasOwn(queriesWithGlobalPreloadSeeds, item.operationName)) {
      continue
    }

    queriesWithGlobalPreloadSeeds[item.operationName] = {
      status: 'loading',
      data: null,
      error: null,
      requestSignature: item.requestSignature,
    }
  }

  return {
    ...initialState,
    queries: queriesWithGlobalPreloadSeeds,
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
