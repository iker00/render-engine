import { describe, expect, it, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import type { RuntimeConfig } from '../../config/runtime-config'
import type { RuntimeIterationContext } from '../../runtime/runtime-references/runtime-reference-resolver'
import { RuntimeStateProvider } from '../../runtime/runtime-state/runtime-state-provider'
import { useAddressGeocodeTrigger } from '../../runtime/runtime-geocode-trigger'

// ---------------------------------------------------------------------------
// Test infrastructure
// ---------------------------------------------------------------------------

function createJsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function createDeferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

const geocodeConfig: RuntimeConfig = {
  api: {
    geocode: {
      method: 'GET',
      endpoint: '/api/geocode',
    },
  },
  initialPage: 'home',
  pages: [{ id: 'home', layout: [] }],
}

// `marker` is only used by the "two rapid fires" test below, to give two overlapping requests
// distinguishable requestSignatures without the hook itself passing `requestParams` (forbidden by
// its own contract).
const geocodeConfigWithMarkerQuery: RuntimeConfig = {
  api: {
    geocode: {
      method: 'GET',
      endpoint: '/api/geocode',
      query: { marker: 'item.marker' },
    },
  },
  initialPage: 'home',
  pages: [{ id: 'home', layout: [] }],
}

function wrapper({ children }: { children: ReactNode }) {
  return <RuntimeStateProvider config={geocodeConfig}>{children}</RuntimeStateProvider>
}

function wrapperWithMarkerQuery({ children }: { children: ReactNode }) {
  return <RuntimeStateProvider config={geocodeConfigWithMarkerQuery}>{children}</RuntimeStateProvider>
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useAddressGeocodeTrigger', () => {
  it('does not fire any execution while position is null', () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    renderHook(() => useAddressGeocodeTrigger({ operationName: 'geocode', position: null }), { wrapper })

    expect(fetchMock).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })

  it('fires executeQueryOperation exactly once when position moves from null to a value', async () => {
    const fetchMock = vi.fn().mockResolvedValue(createJsonResponse({ results: [] }))
    vi.stubGlobal('fetch', fetchMock)

    const { rerender } = renderHook(
      (props: { position: { lat: number; lng: number } | null }) =>
        useAddressGeocodeTrigger({ operationName: 'geocode', position: props.position }),
      { wrapper, initialProps: { position: null } },
    )

    await act(async () => {
      rerender({ position: { lat: 10, lng: 20 } })
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    vi.unstubAllGlobals()
  })

  it('does not redispatch when a rerender produces a new object with the same lat/lng values', async () => {
    const fetchMock = vi.fn().mockResolvedValue(createJsonResponse({ results: [] }))
    vi.stubGlobal('fetch', fetchMock)

    const { rerender } = renderHook(
      (props: { position: { lat: number; lng: number } | null }) =>
        useAddressGeocodeTrigger({ operationName: 'geocode', position: props.position }),
      { wrapper, initialProps: { position: { lat: 10, lng: 20 } } },
    )

    await act(async () => {
      rerender({ position: { lat: 10, lng: 20 } })
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    vi.unstubAllGlobals()
  })

  it('dispatches again when position changes to different coordinates', async () => {
    const fetchMock = vi.fn().mockResolvedValue(createJsonResponse({ results: [] }))
    vi.stubGlobal('fetch', fetchMock)

    const { rerender } = renderHook(
      (props: { position: { lat: number; lng: number } | null }) =>
        useAddressGeocodeTrigger({ operationName: 'geocode', position: props.position }),
      { wrapper, initialProps: { position: { lat: 10, lng: 20 } } },
    )

    await act(async () => {
      rerender({ position: { lat: 30, lng: 40 } })
    })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    vi.unstubAllGlobals()
  })

  it('never passes requestParams: a bare GET operation fires against its plain endpoint with no query string', async () => {
    const fetchMock = vi.fn().mockResolvedValue(createJsonResponse({ results: [] }))
    vi.stubGlobal('fetch', fetchMock)

    renderHook(() => useAddressGeocodeTrigger({ operationName: 'geocode', position: { lat: 10, lng: 20 } }), {
      wrapper,
    })

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(fetchMock).toHaveBeenCalledWith('/api/geocode', expect.anything())
    vi.unstubAllGlobals()
  })

  it('reflects the resolved requestSignature deterministically once the query settles', async () => {
    const fetchMock = vi.fn().mockResolvedValue(createJsonResponse({ results: [] }))
    vi.stubGlobal('fetch', fetchMock)

    const { result } = renderHook(
      () => useAddressGeocodeTrigger({ operationName: 'geocode', position: { lat: 10, lng: 20 } }),
      { wrapper },
    )

    expect(result.current.lastFiredRequestSignature).toBeNull()

    await waitFor(() => expect(result.current.lastFiredRequestSignature).not.toBeNull())

    expect(result.current.lastFiredRequestSignature).toBe(
      '{"endpoint":"/api/geocode","method":"GET","operationName":"geocode"}',
    )
    vi.unstubAllGlobals()
  })

  it('leaves lastFiredRequestSignature with the signature of the last fire, whichever request settles first', async () => {
    const firstResponse = createDeferred<Response>()
    const secondResponse = createDeferred<Response>()
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() => firstResponse.promise)
      .mockImplementationOnce(() => secondResponse.promise)
    vi.stubGlobal('fetch', fetchMock)

    const { rerender, result } = renderHook(
      (props: { position: { lat: number; lng: number }; iterationContext: RuntimeIterationContext }) =>
        useAddressGeocodeTrigger({
          operationName: 'geocode',
          position: props.position,
          iterationContext: props.iterationContext,
        }),
      {
        wrapper: wrapperWithMarkerQuery,
        initialProps: {
          position: { lat: 10, lng: 20 },
          iterationContext: { item: { marker: 'first' } },
        },
      },
    )

    rerender({ position: { lat: 30, lng: 40 }, iterationContext: { item: { marker: 'second' } } })

    expect(fetchMock).toHaveBeenCalledTimes(2)

    // The *last-fired* request (second click) settles first; the now-obsolete first request
    // settles after it. `lastFiredRequestSignature` must still end up reflecting the second one.
    await act(async () => {
      secondResponse.resolve(createJsonResponse({ ok: true }))
      await secondResponse.promise
    })
    await act(async () => {
      firstResponse.resolve(createJsonResponse({ ok: true }))
      await firstResponse.promise
    })

    await waitFor(() =>
      expect(result.current.lastFiredRequestSignature).toBe(
        '{"endpoint":"/api/geocode","method":"GET","operationName":"geocode","query":{"marker":"second"}}',
      ),
    )
  })

  it('exposes status "loading" while the request is in flight and "error" once it settles as an HTTP error', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: 'Server error' }), {
        status: 500,
        headers: { 'content-type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const { result } = renderHook(
      () => useAddressGeocodeTrigger({ operationName: 'geocode', position: { lat: 10, lng: 20 } }),
      { wrapper },
    )

    expect(result.current.status).toBe('loading')

    await waitFor(() => expect(result.current.status).toBe('error'))
    vi.unstubAllGlobals()
  })
})
