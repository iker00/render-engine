import { useState } from 'react'

export type BrowserGeolocationStatus = 'idle' | 'requesting' | 'error'

export interface UseBrowserGeolocationResult {
  request: () => void
  status: BrowserGeolocationStatus
  position: { lat: number; lng: number } | null
}

// Finite so a click never leaves the caller stuck on 'requesting' if the browser's own permission
// dialog is never answered (T9 edge case) — the browser API has no other way to bound that wait.
const GEOLOCATION_REQUEST_TIMEOUT_MS = 10_000

/**
 * Wraps `navigator.geolocation.getCurrentPosition` behind a single `request()` call, for a caller
 * that needs a one-shot position (not `watchPosition`/continuous tracking, out of scope for v1).
 *
 * `PERMISSION_DENIED`, `POSITION_UNAVAILABLE`, `TIMEOUT` and the API being unavailable altogether
 * all collapse into the same `status: 'error'` — an explicit design decision (T9): the caller only
 * needs to know whether a position was produced, not why it wasn't. A failed request does not
 * leave the hook unusable: calling `request()` again retries from a clean slate.
 */
export function useBrowserGeolocation(): UseBrowserGeolocationResult {
  const [status, setStatus] = useState<BrowserGeolocationStatus>('idle')
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null)

  const request = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setStatus('error')
      setPosition(null)
      return
    }

    setStatus('requesting')

    navigator.geolocation.getCurrentPosition(
      (result) => {
        setPosition({ lat: result.coords.latitude, lng: result.coords.longitude })
        setStatus('idle')
      },
      () => {
        setStatus('error')
        setPosition(null)
      },
      { timeout: GEOLOCATION_REQUEST_TIMEOUT_MS },
    )
  }

  return { request, status, position }
}
