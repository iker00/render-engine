import { useEffect, useState } from 'react'
import type { RuntimeApiRequestParams } from '../config/runtime-config'
import type { RuntimeIterationContext } from './runtime-references/runtime-reference-resolver'
import { selectQueryRequestSignature } from './runtime-state/runtime-state-selectors'
import { useRuntimeStateActions } from './runtime-state/use-runtime-state'

const AUTOCOMPLETE_SEARCH_DEBOUNCE_MS = 300

export interface UseAutocompleteSearchTriggerParams {
  queryName: string | null
  searchText: string
  minChars: number
  requestParams?: RuntimeApiRequestParams
  iterationContext?: RuntimeIterationContext
}

export interface UseAutocompleteSearchTriggerResult {
  lastFiredRequestSignature: string | null
}

/**
 * Fires `executeQueryOperation` on a fixed 300ms debounce whenever `searchText` reaches
 * `minChars`, without knowing anything about the form node that produced `searchText` or how
 * suggestions get filtered on the client. Tracks the `requestSignature` this instance last fired
 * so callers (T10) can decide whether stored query results are "fresh" for their own trigger.
 *
 * Reads the just-resolved signature via `readRuntimeState()` — synced synchronously on every
 * `dispatchAndSyncState` call (`runtime-state-provider.tsx`'s `latestStateRef`) — rather than a
 * React-rendered snapshot tracked through a component-local ref. A ref updated by a passive effect
 * races the very same dispatch that resolves the query: the effect and the `.then()` continuation
 * chained onto that dispatch's promise can settle in the same microtask turn, before React has
 * necessarily flushed the render that would update the ref, making the freshness comparison
 * dependent on unrelated render timing instead of on the write itself. `readRuntimeState()`
 * observes the write immediately and deterministically, with no such race.
 */
export function useAutocompleteSearchTrigger({
  queryName,
  searchText,
  minChars,
  requestParams,
  iterationContext,
}: UseAutocompleteSearchTriggerParams): UseAutocompleteSearchTriggerResult {
  const { executeQueryOperation, readRuntimeState } = useRuntimeStateActions()

  const [lastFiredRequestSignature, setLastFiredRequestSignature] = useState<string | null>(null)

  useEffect(() => {
    if (queryName === null || searchText.length < minChars) {
      return
    }

    const timer = setTimeout(() => {
      void executeQueryOperation(queryName, { requestParams, iterationContext }).then(() => {
        setLastFiredRequestSignature(selectQueryRequestSignature(readRuntimeState(), queryName))
      })
    }, AUTOCOMPLETE_SEARCH_DEBOUNCE_MS)

    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- requestParams/iterationContext/executeQueryOperation/readRuntimeState se comparan por referencia como en el resto del runtime; no se hace deep-equal aquí
  }, [queryName, searchText, minChars])

  return { lastFiredRequestSignature }
}
