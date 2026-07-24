import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { StrictMode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RuntimeConfig } from '../../config/runtime-config'
import { RuntimePage } from '../../runtime/runtime-page'
import {
  RuntimeStateProvider,
  useRuntimeState,
  useRuntimeStateActions,
} from '../../runtime/runtime-state/runtime-state-provider'
import type { RuntimeState } from '../../runtime/runtime-state/runtime-state-types'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  window.history.replaceState(null, '', window.location.pathname + window.location.search)
})

function createJsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function createDeferredResponse() {
  let resolve!: (response: Response) => void
  const promise = new Promise<Response>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

function RuntimeStateSnapshot() {
  const state = useRuntimeState()
  return <pre data-testid="runtime-state">{JSON.stringify(state)}</pre>
}

function readRuntimeStateSnapshot() {
  return JSON.parse(screen.getByTestId('runtime-state').textContent ?? '') as RuntimeState
}

function ManualExecuteHarness({ operationName }: { operationName: string }) {
  const { executeQueryOperation } = useRuntimeStateActions()

  return (
    <button type="button" onClick={() => void executeQueryOperation(operationName, { requestParams: {} })}>
      Run manually
    </button>
  )
}

function NavigationHarness() {
  const { navigateToPage } = useRuntimeStateActions()

  return (
    <>
      <button type="button" onClick={() => navigateToPage('home')}>
        Go home
      </button>
      <button type="button" onClick={() => navigateToPage('other')}>
        Go other
      </button>
    </>
  )
}

const api = {
  getCatalog: {
    method: 'GET' as const,
    endpoint: '/api/catalog',
  },
}

const globalPreloadConfig: RuntimeConfig = {
  api,
  initialPage: 'home',
  preloads: [{ operationName: 'getCatalog', requestParams: {} }],
  pages: [
    {
      id: 'home',
      layout: [
        {
          type: 'paragraph',
          queryStateFeedback: {
            query: 'getCatalog',
            states: {
              loading: {
                mode: 'fallback',
                fallback: [{ type: 'paragraph', props: { text: 'Loading catalog...' } }],
              },
              error: {
                mode: 'fallback',
                fallback: [{ type: 'paragraph', props: { text: 'Could not load catalog.' } }],
              },
            },
          },
          props: { text: 'Catalog ready' },
        },
      ],
    },
    {
      id: 'other',
      layout: [{ type: 'paragraph', props: { text: 'Other page' } }],
    },
  ],
}

const noPreloadsConfig: RuntimeConfig = {
  api,
  initialPage: 'home',
  pages: [{ id: 'home', layout: [] }],
}

const emptyPreloadsConfig: RuntimeConfig = {
  ...noPreloadsConfig,
  preloads: [],
}

const rootAndPagePreloadConfig: RuntimeConfig = {
  api,
  initialPage: 'home',
  preloads: [{ operationName: 'getCatalog', requestParams: {} }],
  pages: [
    {
      id: 'home',
      preloads: [{ operationName: 'getCatalog', requestParams: {} }],
      layout: [],
    },
  ],
}

const unknownOperationPreloadConfig: RuntimeConfig = {
  ...noPreloadsConfig,
  preloads: [{ operationName: 'unknownOperation', requestParams: {} }],
}

const unresolvableReferencePreloadConfig: RuntimeConfig = {
  ...noPreloadsConfig,
  preloads: [{ operationName: 'getCatalog', requestParams: { query: { locale: 'forms.someForm.locale' } } }],
}

describe('useRuntimeGlobalPreloads', () => {
  it('fires exactly one fetch for the root preloads block when the provider mounts, regardless of the initial page', async () => {
    const fetchMock = vi.fn().mockResolvedValue(createJsonResponse({ items: ['a'] }))
    vi.stubGlobal('fetch', fetchMock)

    render(
      <RuntimeStateProvider config={{ ...globalPreloadConfig, initialPage: 'other' }}>
        <RuntimeStateSnapshot />
      </RuntimeStateProvider>,
    )

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(fetchMock).toHaveBeenCalledWith('/api/catalog', { method: 'GET' })

    await waitFor(() => expect(readRuntimeStateSnapshot().queries.getCatalog.status).toBe('success'))
  })

  it('renders the initial page before the global preload fetch resolves (non-blocking regression)', async () => {
    const deferred = createDeferredResponse()
    const fetchMock = vi.fn(() => deferred.promise)
    vi.stubGlobal('fetch', fetchMock)

    render(
      <RuntimeStateProvider config={globalPreloadConfig}>
        <RuntimePage />
      </RuntimeStateProvider>,
    )

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Loading catalog...')).toBeInTheDocument()
    expect(screen.queryByText('Catalog ready')).not.toBeInTheDocument()

    deferred.resolve(createJsonResponse({ items: ['a'] }))

    await waitFor(() => expect(screen.getByText('Catalog ready')).toBeInTheDocument())
  })

  it('transitions a queryStateFeedback node from loading to success reflecting the global preload result', async () => {
    const fetchMock = vi.fn().mockResolvedValue(createJsonResponse({ items: ['a'] }))
    vi.stubGlobal('fetch', fetchMock)

    render(
      <RuntimeStateProvider config={globalPreloadConfig}>
        <RuntimePage />
      </RuntimeStateProvider>,
    )

    expect(screen.getByText('Loading catalog...')).toBeInTheDocument()

    await waitFor(() => expect(screen.getByText('Catalog ready')).toBeInTheDocument())
    expect(screen.queryByText('Loading catalog...')).not.toBeInTheDocument()
  })

  it('does not emit a new fetch for the root preload when navigating away and back via hashchange', async () => {
    const fetchMock = vi.fn().mockResolvedValue(createJsonResponse({ items: ['a'] }))
    vi.stubGlobal('fetch', fetchMock)

    render(
      <RuntimeStateProvider config={globalPreloadConfig}>
        <NavigationHarness />
        <RuntimeStateSnapshot />
      </RuntimeStateProvider>,
    )

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    fireEvent.click(screen.getByRole('button', { name: 'Go other' }))
    await waitFor(() => expect(readRuntimeStateSnapshot().navigation.currentPageId).toBe('other'))

    fireEvent.click(screen.getByRole('button', { name: 'Go home' }))
    await waitFor(() => expect(readRuntimeStateSnapshot().navigation.currentPageId).toBe('home'))

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('settles to error with the last failure code after 3 attempts when fetch always fails, without emitting more requests', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 500 }))
    vi.stubGlobal('fetch', fetchMock)

    render(
      <RuntimeStateProvider config={globalPreloadConfig}>
        <RuntimeStateSnapshot />
      </RuntimeStateProvider>,
    )

    await waitFor(() => expect(readRuntimeStateSnapshot().queries.getCatalog.status).toBe('error'))

    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(readRuntimeStateSnapshot().queries.getCatalog.error?.code).toBe('http-error')

    // No more automatic requests should follow once the retry policy has settled.
    await Promise.resolve()
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('settles to success on the second attempt when the first fetch fails, without a third attempt', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 500 }))
      .mockResolvedValueOnce(createJsonResponse({ items: ['b'] }))
    vi.stubGlobal('fetch', fetchMock)

    render(
      <RuntimeStateProvider config={globalPreloadConfig}>
        <RuntimeStateSnapshot />
      </RuntimeStateProvider>,
    )

    await waitFor(() => expect(readRuntimeStateSnapshot().queries.getCatalog.status).toBe('success'))

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(readRuntimeStateSnapshot().queries.getCatalog.data).toEqual({ items: ['b'] })
  })

  it('does not emit any fetch attributable to the global preload when config has no preloads block', async () => {
    const fetchMock = vi.fn().mockResolvedValue(createJsonResponse({}))
    vi.stubGlobal('fetch', fetchMock)

    render(
      <RuntimeStateProvider config={noPreloadsConfig}>
        <RuntimeStateSnapshot />
      </RuntimeStateProvider>,
    )

    await Promise.resolve()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('does not emit any fetch attributable to the global preload when config has an empty preloads array', async () => {
    const fetchMock = vi.fn().mockResolvedValue(createJsonResponse({}))
    vi.stubGlobal('fetch', fetchMock)

    render(
      <RuntimeStateProvider config={emptyPreloadsConfig}>
        <RuntimeStateSnapshot />
      </RuntimeStateProvider>,
    )

    await Promise.resolve()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('emits exactly one fetch when the same operation appears in root preloads and the initial page preloads with an equivalent request', async () => {
    const fetchMock = vi.fn().mockResolvedValue(createJsonResponse({ items: ['a'] }))
    vi.stubGlobal('fetch', fetchMock)

    render(
      <RuntimeStateProvider config={rootAndPagePreloadConfig}>
        <RuntimeStateSnapshot />
      </RuntimeStateProvider>,
    )

    await waitFor(() => expect(readRuntimeStateSnapshot().queries.getCatalog.status).toBe('success'))
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('lets a manual execution and the in-flight global preload coexist, with the last one to settle winning (latest-only)', async () => {
    const deferreds: Array<{ resolve: (response: Response) => void }> = []
    const fetchMock = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          deferreds.push({ resolve })
        }),
    )
    vi.stubGlobal('fetch', fetchMock)

    render(
      <RuntimeStateProvider config={globalPreloadConfig}>
        <ManualExecuteHarness operationName="getCatalog" />
        <RuntimeStateSnapshot />
      </RuntimeStateProvider>,
    )

    expect(deferreds).toHaveLength(1)

    fireEvent.click(screen.getByRole('button', { name: 'Run manually' }))
    expect(deferreds).toHaveLength(2)

    // The manual execution (started second) settles first.
    deferreds[1].resolve(createJsonResponse({ source: 'manual' }))
    await waitFor(() => expect(readRuntimeStateSnapshot().queries.getCatalog.data).toEqual({ source: 'manual' }))

    // The global preload (started first) settles last and should win.
    deferreds[0].resolve(createJsonResponse({ source: 'preload' }))
    await waitFor(() => expect(readRuntimeStateSnapshot().queries.getCatalog.data).toEqual({ source: 'preload' }))

    expect(readRuntimeStateSnapshot().queries.getCatalog.status).toBe('success')
  })

  it('settles to operation-not-found after 3 attempts without emitting any fetch for an unknown operation', async () => {
    const fetchMock = vi.fn().mockResolvedValue(createJsonResponse({}))
    vi.stubGlobal('fetch', fetchMock)

    render(
      <RuntimeStateProvider config={unknownOperationPreloadConfig}>
        <RuntimeStateSnapshot />
      </RuntimeStateProvider>,
    )

    await waitFor(() => expect(readRuntimeStateSnapshot().queries.unknownOperation.status).toBe('error'))

    expect(readRuntimeStateSnapshot().queries.unknownOperation.error?.code).toBe('operation-not-found')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('settles to request-build-failed after 3 attempts without emitting any fetch for an unresolvable reference', async () => {
    const fetchMock = vi.fn().mockResolvedValue(createJsonResponse({}))
    vi.stubGlobal('fetch', fetchMock)

    render(
      <RuntimeStateProvider config={unresolvableReferencePreloadConfig}>
        <RuntimeStateSnapshot />
      </RuntimeStateProvider>,
    )

    await waitFor(() => expect(readRuntimeStateSnapshot().queries.getCatalog.status).toBe('error'))

    expect(readRuntimeStateSnapshot().queries.getCatalog.error?.code).toBe('request-build-failed')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('still fires exactly one fetch under React StrictMode', async () => {
    const fetchMock = vi.fn().mockResolvedValue(createJsonResponse({ items: ['a'] }))
    vi.stubGlobal('fetch', fetchMock)

    render(
      <StrictMode>
        <RuntimeStateProvider config={globalPreloadConfig}>
          <RuntimeStateSnapshot />
        </RuntimeStateProvider>
      </StrictMode>,
    )

    await waitFor(() => expect(readRuntimeStateSnapshot().queries.getCatalog.status).toBe('success'))
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
