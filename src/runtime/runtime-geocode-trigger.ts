import { useEffect, useRef, useState } from 'react'
import type { RuntimeIterationContext } from './runtime-references/runtime-reference-resolver'
import { selectQueryRequestSignature } from './runtime-state/runtime-state-selectors'
import { useRuntimeStateActions } from './runtime-state/use-runtime-state'

export interface UseAddressGeocodeTriggerParams {
  operationName: string
  position: { lat: number; lng: number } | null
  iterationContext?: RuntimeIterationContext
}

export type AddressGeocodeTriggerStatus = 'idle' | 'loading' | 'success' | 'error'

export interface UseAddressGeocodeTriggerResult {
  status: AddressGeocodeTriggerStatus
  lastFiredRequestSignature: string | null
}

type ResolvedFireOutcome = 'idle' | 'success' | 'error'

interface ResolvedFire {
  position: { lat: number; lng: number }
  outcome: ResolvedFireOutcome
}

function deriveAddressGeocodeTriggerStatus(
  position: { lat: number; lng: number } | null,
  resolvedFire: ResolvedFire | null,
): AddressGeocodeTriggerStatus {
  if (position === null) {
    return 'idle'
  }

  if (resolvedFire !== null && resolvedFire.position.lat === position.lat && resolvedFire.position.lng === position.lng) {
    return resolvedFire.outcome
  }

  return 'loading'
}

/**
 * Fires `executeQueryOperation` once per distinct `position` — compared by `lat`/`lng` value, not
 * object identity, so a rerender that produces a fresh `{ lat, lng }` object with the same
 * coordinates never redispatches. `position` comes from a discrete gesture (a map click), not
 * typed input, so unlike `useAutocompleteSearchTrigger` there is **no debounce**: two clicks in
 * quick succession can leave two requests in flight at once, in which case they can settle in
 * either order.
 *
 * `status` is never set synchronously inside the effect (React flags that as a cascading-render
 * risk — `react-hooks/set-state-in-effect`). Instead it is *derived* every render by comparing the
 * current `position` against `resolvedFire` (state written only from the async `.then()`
 * continuation, exactly like `lastFiredRequestSignature` below): while they don't match, this
 * instance is still waiting on `position`'s own fire, so the status is 'loading' for free, with no
 * explicit "start loading" write.
 *
 * A monotonically increasing `fireId` ref discards any resolution that is no longer the most
 * recently fired one: whichever settles last in wall-clock time does not matter, only whichever
 * was *fired* last does. Without this guard, an earlier click's request settling after a later
 * click's would overwrite `resolvedFire`/`lastFiredRequestSignature` with its own (stale) outcome,
 * even though the shared `queries.{operationName}` slot itself has no such protection (each
 * dispatch unconditionally overwrites the slot — see `runtime-state-reducer.ts`).
 *
 * `lastFiredRequestSignature` is still read via `readRuntimeState()` right after resolving — synced
 * synchronously on every `dispatchAndSyncState` call (`runtime-state-provider.tsx`'s
 * `latestStateRef`) — for the same determinism reason documented in `runtime-search-trigger.ts`: it
 * reflects the write from this very resolution, not a React-rendered snapshot that could lag a
 * render behind.
 */
export function useAddressGeocodeTrigger({
  operationName,
  position,
  iterationContext,
}: UseAddressGeocodeTriggerParams): UseAddressGeocodeTriggerResult {
  const { executeQueryOperation, readRuntimeState } = useRuntimeStateActions()

  const [lastFiredRequestSignature, setLastFiredRequestSignature] = useState<string | null>(null)
  const [resolvedFire, setResolvedFire] = useState<ResolvedFire | null>(null)
  const fireIdRef = useRef(0)

  useEffect(() => {
    if (position === null) {
      return
    }

    const firedPosition = position
    const fireId = ++fireIdRef.current

    void executeQueryOperation(operationName, { iterationContext }).then((result) => {
      if (fireIdRef.current !== fireId) {
        // A newer click has fired since this request started: its outcome, not this stale one,
        // must win.
        return
      }

      setResolvedFire({
        position: firedPosition,
        outcome: result.status === 'success' || result.status === 'error' ? result.status : 'idle',
      })
      setLastFiredRequestSignature(selectQueryRequestSignature(readRuntimeState(), operationName))
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- iterationContext/executeQueryOperation/readRuntimeState se comparan por referencia como en runtime-search-trigger.ts; el disparo depende solo de lat/lng por valor
  }, [operationName, position?.lat, position?.lng])

  const status = deriveAddressGeocodeTriggerStatus(position, resolvedFire)

  return { status, lastFiredRequestSignature }
}
