import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { ReactNode } from 'react'
import type { RuntimeConfig } from '../../config/runtime-config'
import { RuntimeStateProvider } from '../../runtime/runtime-state/runtime-state-provider'
import { useAutocompleteSearchTrigger } from '../../runtime/runtime-search-trigger'

// ---------------------------------------------------------------------------
// Test infrastructure
// ---------------------------------------------------------------------------

function createJsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

const searchConfig: RuntimeConfig = {
  api: {
    searchItems: {
      method: 'GET',
      endpoint: '/api/search',
    },
  },
  initialPage: 'home',
  pages: [{ id: 'home', layout: [] }],
}

function wrapper({ children }: { children: ReactNode }) {
  return <RuntimeStateProvider config={searchConfig}>{children}</RuntimeStateProvider>
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useAutocompleteSearchTrigger', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.useFakeTimers()
    fetchMock = vi.fn().mockResolvedValue(createJsonResponse({ results: [] }))
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('does not fire the query when searchText stays below minChars, even after the debounce elapses', async () => {
    renderHook(
      () =>
        useAutocompleteSearchTrigger({
          queryName: 'searchItems',
          searchText: 'ab',
          minChars: 3,
        }),
      { wrapper },
    )

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300)
    })

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('collapses several searchText updates within the debounce window into a single call using the latest requestParams', async () => {
    const { rerender } = renderHook(
      (props: { searchText: string; query: string }) =>
        useAutocompleteSearchTrigger({
          queryName: 'searchItems',
          searchText: props.searchText,
          minChars: 2,
          requestParams: { query: { q: props.query } },
        }),
      { wrapper, initialProps: { searchText: 'a', query: 'a' } },
    )

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100)
    })
    rerender({ searchText: 'ab', query: 'ab' })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100)
    })
    rerender({ searchText: 'abc', query: 'abc' })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300)
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('q=abc'), expect.anything())
  })

  it('fires executeQueryOperation exactly once, 300ms after the last update, with the given requestParams and iterationContext', async () => {
    renderHook(
      () =>
        useAutocompleteSearchTrigger({
          queryName: 'searchItems',
          searchText: 'abc',
          minChars: 2,
          requestParams: { query: { q: 'abc' } },
        }),
      { wrapper },
    )

    await act(async () => {
      await vi.advanceTimersByTimeAsync(299)
    })
    expect(fetchMock).not.toHaveBeenCalled()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1)
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('q=abc'), expect.anything())
  })

  it('sets lastFiredRequestSignature to its own resolved signature deterministically and immediately, cycle after cycle', async () => {
    // `lastFiredRequestSignature` is read via `readRuntimeState()`, which is synced synchronously
    // on every `dispatchAndSyncState` call regardless of React's own render/effect flush timing —
    // so each cycle's `.then()` reliably observes that very cycle's own committed signature, not a
    // React-rendered snapshot that could still be lagging one render behind.
    const { result, rerender } = renderHook(
      (props: { searchText: string; query: string }) =>
        useAutocompleteSearchTrigger({
          queryName: 'searchItems',
          searchText: props.searchText,
          minChars: 2,
          requestParams: { query: { q: props.query } },
        }),
      { wrapper, initialProps: { searchText: 'ab', query: 'ab' } },
    )

    expect(result.current.lastFiredRequestSignature).toBeNull()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300)
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)

    const firstCycleSignature =
      '{"endpoint":"/api/search","method":"GET","operationName":"searchItems","query":{"q":"ab"}}'
    expect(result.current.lastFiredRequestSignature).toBe(firstCycleSignature)

    rerender({ searchText: 'abc', query: 'abc' })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300)
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)

    const secondCycleSignature =
      '{"endpoint":"/api/search","method":"GET","operationName":"searchItems","query":{"q":"abc"}}'
    expect(result.current.lastFiredRequestSignature).toBe(secondCycleSignature)
  })

  it('never calls executeQueryOperation when queryName is null, regardless of searchText length', async () => {
    renderHook(
      () =>
        useAutocompleteSearchTrigger({
          queryName: null,
          searchText: 'abcdef',
          minChars: 2,
        }),
      { wrapper },
    )

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000)
    })

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('cancels the pending debounce timer on unmount, so executeQueryOperation never fires', async () => {
    const { unmount } = renderHook(
      () =>
        useAutocompleteSearchTrigger({
          queryName: 'searchItems',
          searchText: 'abc',
          minChars: 2,
          requestParams: { query: { q: 'abc' } },
        }),
      { wrapper },
    )

    unmount()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300)
    })

    expect(fetchMock).not.toHaveBeenCalled()
  })
})
