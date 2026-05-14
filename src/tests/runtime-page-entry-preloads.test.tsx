import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useEffect, useLayoutEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RuntimeConfig } from '../config/runtime-config'
import { RuntimePage } from '../runtime/runtime-page'
import { createRuntimeState, runtimeStateReducer } from '../runtime/runtime-state/runtime-state-reducer'
import {
  selectCurrentPageId,
  selectFormsState,
  selectNavigationState,
  selectPageEntryState,
  selectPageEntryStatus,
  selectQueriesState,
} from '../runtime/runtime-state/runtime-state-selectors'
import {
  RuntimeStateProvider,
  useRuntimeState,
  useRuntimeStateActions,
} from '../runtime/runtime-state/runtime-state-provider'
import type { RuntimeState } from '../runtime/runtime-state/runtime-state-types'

const baseConfig: RuntimeConfig = {
  api: {},
  initialPage: 'home',
  pages: [
    {
      id: 'home',
      layout: [],
    },
    {
      id: 'details',
      preloads: ['searchUsers', 'loadTeams'],
      layout: [],
    },
  ],
}

const preloadConfig: RuntimeConfig = {
  api: {
    searchUsers: {
      method: 'GET',
      endpoint: '/api/users',
    },
    loadTeams: {
      method: 'GET',
      endpoint: '/api/teams',
    },
    selectedUser: {
      method: 'GET',
      endpoint: '/api/users/current',
    },
    loadProfile: {
      method: 'GET',
      endpoint: '/api/profile',
      query: {
        id: 'queries.selectedUser.data.id',
      },
    },
    loadEditor: {
      method: 'GET',
      endpoint: '/api/editor',
      query: {
        id: 'params.userId',
      },
    },
    invalidSearch: {
      method: 'GET',
      endpoint: '/api/users',
      query: {
        search: 'forms.userSearch.missingField',
      },
    },
  },
  initialPage: 'landing',
  pages: [
    {
      id: 'landing',
      layout: [],
    },
    {
      id: 'home',
      preloads: ['searchUsers'],
      layout: [],
    },
    {
      id: 'details',
      preloads: ['loadTeams'],
      layout: [],
    },
    {
      id: 'dashboard',
      preloads: ['searchUsers', 'loadTeams'],
      layout: [],
    },
    {
      id: 'broken',
      preloads: ['missingOperation', 'invalidSearch'],
      layout: [],
    },
    {
      id: 'profile',
      preloads: ['selectedUser', 'loadProfile'],
      layout: [],
    },
    {
      id: 'editor',
      preloads: ['loadEditor'],
      layout: [],
    },
    {
      id: 'empty',
      preloads: [],
      layout: [],
    },
  ],
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function RuntimeStateSnapshot() {
  const state = useRuntimeState()

  return <pre data-testid="runtime-state">{JSON.stringify(state)}</pre>
}

function RuntimeStateHistoryRecorder({ history }: { history: RuntimeState[] }) {
  const state = useRuntimeState()

  useLayoutEffect(() => {
    history.push(structuredClone(state))
  }, [history, state])

  return null
}

function NavigationFixture() {
  const { goBackPage, navigateToPage } = useRuntimeStateActions()

  return (
    <>
      <button type="button" onClick={() => navigateToPage('home')}>
        Go home
      </button>
      <button type="button" onClick={() => navigateToPage('details')}>
        Go details
      </button>
      <button type="button" onClick={() => navigateToPage('dashboard')}>
        Go dashboard
      </button>
      <button type="button" onClick={() => navigateToPage('broken')}>
        Go broken
      </button>
      <button type="button" onClick={() => navigateToPage('profile')}>
        Go profile
      </button>
      <button type="button" onClick={() => navigateToPage('home', { userId: '1' })}>
        Go home user 1
      </button>
      <button type="button" onClick={() => navigateToPage('home', { userId: '2' })}>
        Go home user 2
      </button>
      <button type="button" onClick={() => navigateToPage('editor', { userId: 'user-7' })}>
        Go editor user 7
      </button>
      <button type="button" onClick={() => navigateToPage('empty')}>
        Go empty
      </button>
      <button type="button" onClick={() => navigateToPage('landing')}>
        Go landing
      </button>
      <button type="button" onClick={() => goBackPage()}>
        Go back
      </button>
    </>
  )
}

function SeedRuntimeState({
  formTerm = 'Ada',
  selectedUserId,
}: {
  formTerm?: string
  selectedUserId?: string
}) {
  const { initializeForm, initializeQuery, setFormFieldValue, setQuerySuccess } = useRuntimeStateActions()

  useEffect(() => {
    initializeForm('userSearch', {
      term: {
        defaultValue: '',
      },
    })
    setFormFieldValue('userSearch', 'term', formTerm)
    initializeQuery('selectedUser')

    if (selectedUserId) {
      setQuerySuccess('selectedUser', {
        id: selectedUserId,
      })
    }
  }, [formTerm, initializeForm, initializeQuery, selectedUserId, setFormFieldValue, setQuerySuccess])

  return null
}

function ProviderRerenderHarness({
  config,
  children,
}: {
  config: RuntimeConfig
  children?: ReactNode
}) {
  const [renderCount, setRenderCount] = useState(0)

  return (
    <>
      <button type="button" onClick={() => setRenderCount((count) => count + 1)}>
        Rerender provider
      </button>
      <RuntimeStateProvider config={config}>
        <div data-testid="provider-render-count">{renderCount}</div>
        {children}
      </RuntimeStateProvider>
    </>
  )
}

function renderPreloadHarness({
  config = preloadConfig,
  seedFormTerm,
  seedSelectedUserId,
  history,
  withRerenderHarness = false,
}: {
  config?: RuntimeConfig
  seedFormTerm?: string
  seedSelectedUserId?: string
  history?: RuntimeState[]
  withRerenderHarness?: boolean
} = {}) {
  const runtimeChildren = (
    <>
      {history ? <RuntimeStateHistoryRecorder history={history} /> : null}
      <NavigationFixture />
      {(seedFormTerm || seedSelectedUserId) && (
        <SeedRuntimeState formTerm={seedFormTerm} selectedUserId={seedSelectedUserId} />
      )}
      <RuntimeStateSnapshot />
    </>
  )

  if (withRerenderHarness) {
    return render(<ProviderRerenderHarness config={config}>{runtimeChildren}</ProviderRerenderHarness>)
  }

  return render(<RuntimeStateProvider config={config}>{runtimeChildren}</RuntimeStateProvider>)
}

function renderRuntimePageWithPreloads(config: RuntimeConfig) {
  return render(
    <RuntimeStateProvider config={config}>
      <RuntimeStateSnapshot />
      <RuntimePage />
    </RuntimeStateProvider>,
  )
}

function readRuntimeState() {
  return JSON.parse(screen.getByTestId('runtime-state').textContent ?? '') as RuntimeState
}

function createJsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
    },
  })
}

describe('Runtime page entry shared state', () => {
  it('represents an entry without preloads as idle in the base state', () => {
    expect(createRuntimeState(baseConfig).pageEntry).toEqual({
      entryId: 0,
      pageId: 'home',
      params: {},
      preloadNames: [],
      status: 'idle',
    })
  })

  it('transitions the aggregated page entry state through loading, success, and error', () => {
    const loadingState = runtimeStateReducer(createRuntimeState(baseConfig), {
      type: 'page-entry/set-loading',
      payload: {
        entryId: 1,
        pageId: 'details',
        params: {},
        preloadNames: ['searchUsers', 'loadTeams'],
      },
    })

    expect(loadingState.pageEntry).toEqual({
      entryId: 1,
      pageId: 'details',
      params: {},
      preloadNames: ['searchUsers', 'loadTeams'],
      status: 'loading',
    })

    const successState = runtimeStateReducer(loadingState, {
      type: 'page-entry/set-settled',
      payload: {
        entryId: 1,
        status: 'success',
      },
    })

    expect(successState.pageEntry.status).toBe('success')

    const errorState = runtimeStateReducer(loadingState, {
      type: 'page-entry/set-settled',
      payload: {
        entryId: 1,
        status: 'error',
      },
    })

    expect(errorState.pageEntry.status).toBe('error')
  })

  it('ignores aggregated closures from stale page entries', () => {
    const firstEntryState = runtimeStateReducer(createRuntimeState(baseConfig), {
      type: 'page-entry/set-loading',
      payload: {
        entryId: 1,
        pageId: 'details',
        params: {},
        preloadNames: ['searchUsers'],
      },
    })

    const secondEntryState = runtimeStateReducer(firstEntryState, {
      type: 'page-entry/set-loading',
      payload: {
        entryId: 2,
        pageId: 'home',
        params: {},
        preloadNames: [],
      },
    })

    const staleSettledState = runtimeStateReducer(secondEntryState, {
      type: 'page-entry/set-settled',
      payload: {
        entryId: 1,
        status: 'success',
      },
    })

    expect(staleSettledState.pageEntry).toEqual({
      entryId: 2,
      pageId: 'home',
      params: {},
      preloadNames: [],
      status: 'loading',
    })
  })

  it('starts preload batches atomically by resetting only the declared queries directly into loading', () => {
    const seededState: RuntimeState = {
      ...createRuntimeState(baseConfig),
      queries: {
        searchUsers: {
          status: 'success',
          data: { results: ['Ada'] },
          error: null,
        },
        loadTeams: {
          status: 'error',
          data: { teams: ['Legacy'] },
          error: {
            code: 'network',
            message: 'Could not load teams.',
          },
        },
        selectedUser: {
          status: 'success',
          data: { id: 'user-7' },
          error: null,
        },
      },
    }

    const nextState = runtimeStateReducer(seededState, {
      type: 'page-entry/start-preload-batch',
      payload: {
        entryId: 3,
        pageId: 'details',
        params: { userId: '42' },
        preloadNames: ['searchUsers', 'loadTeams'],
      },
    })

    expect(nextState.pageEntry).toEqual({
      entryId: 3,
      pageId: 'details',
      params: { userId: '42' },
      preloadNames: ['searchUsers', 'loadTeams'],
      status: 'loading',
    })
    expect(nextState.queries.searchUsers).toEqual({
      status: 'loading',
      data: null,
      error: null,
    })
    expect(nextState.queries.loadTeams).toEqual({
      status: 'loading',
      data: null,
      error: null,
    })
    expect(nextState.queries.selectedUser).toEqual(seededState.queries.selectedUser)
  })

  it('exposes selectors for the page entry domain without affecting navigation, forms, or queries', () => {
    const state: RuntimeState = {
      navigation: {
        currentPageId: 'details',
        history: [
          { entryId: 0, pageId: 'home', params: {} },
          { entryId: 1, pageId: 'details', params: {} },
        ],
        lastError: null,
      },
      forms: {
        filters: {
          term: {
            value: 'Ada',
            error: null,
            touched: true,
            dirty: true,
            defaultValue: '',
          },
        },
      },
      queries: {
        searchUsers: {
          status: 'success',
          data: ['Ada'],
          error: null,
        },
      },
      pageEntry: {
        entryId: 4,
        pageId: 'details',
        params: {},
        preloadNames: ['searchUsers'],
        status: 'error',
      },
    }

    expect(selectPageEntryState(state)).toEqual(state.pageEntry)
    expect(selectPageEntryStatus(state)).toBe('error')
    expect(selectCurrentPageId(state)).toBe('details')
    expect(selectNavigationState(state)).toBe(state.navigation)
    expect(selectFormsState(state)).toBe(state.forms)
    expect(selectQueriesState(state)).toBe(state.queries)
  })
})

describe('Runtime page entry preloads integration', () => {
  it('automatically triggers initialPage preloads on mount', async () => {
    const initialConfig: RuntimeConfig = {
      ...preloadConfig,
      initialPage: 'home',
    }
    const fetchMock = vi.fn().mockResolvedValue(createJsonResponse({ results: ['Ada'] }))
    vi.stubGlobal('fetch', fetchMock)

    renderPreloadHarness({ config: initialConfig })

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(readRuntimeState().pageEntry.status).toBe('success'))

    expect(fetchMock).toHaveBeenCalledWith('/api/users', { method: 'GET' })
    expect(readRuntimeState().queries.searchUsers).toEqual({
      status: 'success',
      data: { results: ['Ada'] },
      error: null,
    })
  })

  it('prepares a new preload entry directly in loading without exposing an idle commit for that entry', async () => {
    let resolveUsers: ((response: Response) => void) | null = null
    const fetchMock = vi.fn(() => new Promise<Response>((resolve) => {
      resolveUsers = resolve
    }))
    vi.stubGlobal('fetch', fetchMock)
    const history: RuntimeState[] = []

    renderPreloadHarness({
      config: {
        ...preloadConfig,
        initialPage: 'landing',
      },
      history,
    })

    fireEvent.click(screen.getByRole('button', { name: 'Go home user 1' }))

    await waitFor(() => expect(readRuntimeState().pageEntry).toEqual({
      entryId: 1,
      pageId: 'home',
      params: { userId: '1' },
      preloadNames: ['searchUsers'],
      status: 'loading',
    }))

    const newEntryStates = history.filter((snapshot) => snapshot.pageEntry.entryId === 1)

    expect(newEntryStates.length).toBeGreaterThan(0)
    expect(newEntryStates.some((snapshot) => snapshot.pageEntry.status === 'idle')).toBe(false)
    expect(newEntryStates[0]?.queries.searchUsers).toEqual({
      status: 'loading',
      data: null,
      error: null,
    })

    resolveUsers?.(createJsonResponse({ results: ['Ada'] }))
    await waitFor(() => expect(readRuntimeState().pageEntry.status).toBe('success'))
  })

  it('applies the same visible query feedback semantics to preload-driven queries', async () => {
    let resolveUsers: ((response: Response) => void) | null = null
    const fetchMock = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveUsers = resolve
        }),
    )
    vi.stubGlobal('fetch', fetchMock)

    renderRuntimePageWithPreloads({
      api: {
        searchUsers: {
          method: 'GET',
          endpoint: '/api/users',
        },
      },
      initialPage: 'home',
      pages: [
        {
          id: 'home',
          preloads: ['searchUsers'],
          layout: [
            {
              type: 'paragraph',
              queryStateFeedback: {
                query: 'searchUsers',
                states: {
                  loading: {
                    mode: 'fallback',
                    fallback: [
                      {
                        type: 'paragraph',
                        props: {
                          text: 'Loading users...',
                        },
                      },
                    ],
                  },
                },
              },
              props: {
                text: 'Users loaded',
              },
            },
          ],
        },
      ],
    })

    expect(screen.getByText('Loading users...')).toBeInTheDocument()
    expect(screen.queryByText('Users loaded')).not.toBeInTheDocument()
    expect(readRuntimeState().pageEntry.status).toBe('loading')

    resolveUsers?.(createJsonResponse({ results: ['Ada'] }))

    await waitFor(() => expect(readRuntimeState().pageEntry.status).toBe('success'))
    expect(screen.queryByText('Loading users...')).not.toBeInTheDocument()
    expect(screen.getByText('Users loaded')).toBeInTheDocument()
  })

  it('triggers a new preload entry when navigating to a page and when revisiting it later', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(createJsonResponse({ results: ['Ada'] }))
      .mockResolvedValueOnce(createJsonResponse({ teams: ['Runtime'] }))
      .mockResolvedValueOnce(createJsonResponse({ results: ['Grace'] }))
    vi.stubGlobal('fetch', fetchMock)

    renderPreloadHarness()

    fireEvent.click(screen.getByRole('button', { name: 'Go home' }))
    await waitFor(() => expect(readRuntimeState().pageEntry.status).toBe('success'))

    fireEvent.click(screen.getByRole('button', { name: 'Go details' }))
    await waitFor(() => expect(readRuntimeState().pageEntry.pageId).toBe('details'))
    await waitFor(() => expect(readRuntimeState().pageEntry.status).toBe('success'))

    fireEvent.click(screen.getByRole('button', { name: 'Go home' }))
    await waitFor(() => expect(readRuntimeState().pageEntry.pageId).toBe('home'))
    await waitFor(() => expect(readRuntimeState().queries.searchUsers.data).toEqual({ results: ['Grace'] }))

    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/users', { method: 'GET' })
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/teams', { method: 'GET' })
    expect(fetchMock).toHaveBeenNthCalledWith(3, '/api/users', { method: 'GET' })
  })

  it('relaunches preloads when going back to a previously visited page entry', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(createJsonResponse({ results: ['Ada'] }))
      .mockResolvedValueOnce(createJsonResponse({ teams: ['Runtime'] }))
      .mockResolvedValueOnce(createJsonResponse({ results: ['Grace'] }))
    vi.stubGlobal('fetch', fetchMock)

    renderPreloadHarness()

    fireEvent.click(screen.getByRole('button', { name: 'Go home' }))
    await waitFor(() => expect(readRuntimeState().pageEntry.status).toBe('success'))

    fireEvent.click(screen.getByRole('button', { name: 'Go details' }))
    await waitFor(() => expect(readRuntimeState().pageEntry.pageId).toBe('details'))
    await waitFor(() => expect(readRuntimeState().pageEntry.status).toBe('success'))

    fireEvent.click(screen.getByRole('button', { name: 'Go back' }))
    await waitFor(() => expect(readRuntimeState().pageEntry.pageId).toBe('home'))
    await waitFor(() => expect(readRuntimeState().pageEntry.status).toBe('success'))

    expect(readRuntimeState().queries.searchUsers.data).toEqual({ results: ['Grace'] })
    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/users', { method: 'GET' })
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/teams', { method: 'GET' })
    expect(fetchMock).toHaveBeenNthCalledWith(3, '/api/users', { method: 'GET' })
  })

  it('resets the previous preload query data before replaying a goBack entry', async () => {
    let resolveInitialHome: ((response: Response) => void) | null = null
    let resolveDetails: ((response: Response) => void) | null = null
    let resolveGoBackHome: ((response: Response) => void) | null = null
    const fetchMock = vi.fn((url: string) => {
      if (url === '/api/users' && resolveInitialHome === null) {
        return new Promise<Response>((resolve) => {
          resolveInitialHome = resolve
        })
      }

      if (url === '/api/teams') {
        return new Promise<Response>((resolve) => {
          resolveDetails = resolve
        })
      }

      return new Promise<Response>((resolve) => {
        resolveGoBackHome = resolve
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    renderPreloadHarness()

    fireEvent.click(screen.getByRole('button', { name: 'Go home' }))
    resolveInitialHome?.(createJsonResponse({ results: ['Ada'] }))
    await waitFor(() => expect(readRuntimeState().pageEntry.status).toBe('success'))
    expect(readRuntimeState().queries.searchUsers.data).toEqual({ results: ['Ada'] })

    fireEvent.click(screen.getByRole('button', { name: 'Go details' }))
    resolveDetails?.(createJsonResponse({ teams: ['Runtime'] }))
    await waitFor(() => expect(readRuntimeState().pageEntry.status).toBe('success'))

    fireEvent.click(screen.getByRole('button', { name: 'Go back' }))

    await waitFor(() => expect(readRuntimeState().pageEntry).toEqual({
      entryId: 1,
      pageId: 'home',
      params: {},
      preloadNames: ['searchUsers'],
      status: 'loading',
    }))
    expect(readRuntimeState().queries.searchUsers).toEqual({
      status: 'loading',
      data: null,
      error: null,
    })

    resolveGoBackHome?.(createJsonResponse({ results: ['Grace'] }))
    await waitFor(() => expect(readRuntimeState().pageEntry.status).toBe('success'))
  })

  it('does not relaunch the same page entry preloads because queries update or the provider rerenders', async () => {
    const fetchMock = vi.fn().mockResolvedValue(createJsonResponse({ results: ['Ada'] }))
    vi.stubGlobal('fetch', fetchMock)

    renderPreloadHarness({
      config: {
        ...preloadConfig,
        initialPage: 'home',
      },
      withRerenderHarness: true,
    })

    await waitFor(() => expect(readRuntimeState().pageEntry.status).toBe('success'))

    fireEvent.click(screen.getByRole('button', { name: 'Rerender provider' }))

    await waitFor(() => expect(screen.getByTestId('provider-render-count')).toHaveTextContent('1'))
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('keeps the aggregate idle and emits no network calls for pages without preloads or with an empty list', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    renderPreloadHarness()

    fireEvent.click(screen.getByRole('button', { name: 'Go empty' }))

    await waitFor(() =>
      expect(readRuntimeState().pageEntry).toEqual({
        entryId: 1,
        pageId: 'empty',
        params: {},
        preloadNames: [],
        status: 'idle',
      }),
    )

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('launches all preloads of the same entry in parallel', async () => {
    let resolveUsers: ((response: Response) => void) | null = null
    let resolveTeams: ((response: Response) => void) | null = null
    const fetchMock = vi.fn((url: string) => {
      if (url === '/api/users') {
        return new Promise<Response>((resolve) => {
          resolveUsers = resolve
        })
      }

      return new Promise<Response>((resolve) => {
        resolveTeams = resolve
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    renderPreloadHarness()

    fireEvent.click(screen.getByRole('button', { name: 'Go dashboard' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    expect(readRuntimeState().pageEntry.status).toBe('loading')

    resolveUsers?.(createJsonResponse({ results: ['Ada'] }))
    resolveTeams?.(createJsonResponse({ teams: ['Runtime'] }))

    await waitFor(() => expect(readRuntimeState().pageEntry.status).toBe('success'))
  })

  it('finishes the aggregate as error when any preload fails without dropping successful query data', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(createJsonResponse({ results: ['Ada'] }))
      .mockResolvedValueOnce(createJsonResponse({ message: 'Boom' }, 500))
    vi.stubGlobal('fetch', fetchMock)

    renderPreloadHarness()

    fireEvent.click(screen.getByRole('button', { name: 'Go dashboard' }))

    await waitFor(() => expect(readRuntimeState().pageEntry.status).toBe('error'))

    const state = readRuntimeState()
    expect(state.queries.searchUsers).toEqual({
      status: 'success',
      data: { results: ['Ada'] },
      error: null,
    })
    expect(state.queries.loadTeams).toEqual({
      status: 'error',
      data: null,
      error: {
        code: 'http-error',
        message: 'The api operation "loadTeams" failed with HTTP status 500.',
      },
    })
  })

  it('treats missing operations and request-build failures as recoverable preload errors', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    renderPreloadHarness({ seedFormTerm: 'Ada' })

    fireEvent.click(screen.getByRole('button', { name: 'Go broken' }))

    await waitFor(() => expect(readRuntimeState().pageEntry.status).toBe('error'))

    const state = readRuntimeState()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(state.queries.missingOperation).toEqual({
      status: 'error',
      data: null,
      error: {
        code: 'operation-not-found',
        message: 'The api operation "missingOperation" does not exist.',
      },
    })
    expect(state.queries.invalidSearch).toEqual({
      status: 'error',
      data: null,
      error: {
        code: 'request-build-failed',
        message: 'The api operation "invalidSearch" could not resolve "forms.userSearch.missingField" for "query.search".',
      },
    })
  })

  it('keeps the latest page entry aggregate when an older preload entry resolves later', async () => {
    let resolveUsers: ((response: Response) => void) | null = null
    let resolveTeams: ((response: Response) => void) | null = null
    const fetchMock = vi.fn((url: string) => {
      if (url === '/api/users') {
        return new Promise<Response>((resolve) => {
          resolveUsers = resolve
        })
      }

      return new Promise<Response>((resolve) => {
        resolveTeams = resolve
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    renderPreloadHarness()

    fireEvent.click(screen.getByRole('button', { name: 'Go home' }))
    await waitFor(() => expect(readRuntimeState().pageEntry.status).toBe('loading'))

    fireEvent.click(screen.getByRole('button', { name: 'Go details' }))
    await waitFor(() => expect(readRuntimeState().pageEntry.pageId).toBe('details'))
    await waitFor(() => expect(readRuntimeState().pageEntry.status).toBe('loading'))

    resolveUsers?.(createJsonResponse({ results: ['Late home data'] }))

    await waitFor(() => expect(readRuntimeState().queries.searchUsers.status).toBe('success'))
    expect(readRuntimeState().pageEntry).toEqual({
      entryId: 2,
      pageId: 'details',
      params: {},
      preloadNames: ['loadTeams'],
      status: 'loading',
    })

    resolveTeams?.(createJsonResponse({ teams: ['Runtime'] }))

    await waitFor(() => expect(readRuntimeState().pageEntry.status).toBe('success'))
    expect(readRuntimeState().pageEntry.pageId).toBe('details')
  })

  it('resolves all requests of the same entry from a shared state snapshot', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(createJsonResponse({ id: 'user-2' }))
    vi.stubGlobal('fetch', fetchMock)

    renderPreloadHarness({
      seedSelectedUserId: 'user-1',
    })

    fireEvent.click(screen.getByRole('button', { name: 'Go profile' }))

    await waitFor(() => expect(readRuntimeState().pageEntry.status).toBe('error'))

    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/users/current', { method: 'GET' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(readRuntimeState().queries.selectedUser).toEqual({
      status: 'success',
      data: { id: 'user-2' },
      error: null,
    })
    expect(readRuntimeState().queries.loadProfile).toEqual({
      status: 'error',
      data: null,
      error: {
        code: 'request-build-failed',
        message: 'The api operation "loadProfile" could not resolve "queries.selectedUser.data.id" for "query.id".',
      },
    })
  })

  it('relaunches preloads when navigating to the same page with different params', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(createJsonResponse({ results: ['Ada'] }))
      .mockResolvedValueOnce(createJsonResponse({ results: ['Grace'] }))
    vi.stubGlobal('fetch', fetchMock)

    renderPreloadHarness({
      config: {
        ...preloadConfig,
        initialPage: 'landing',
      },
    })

    fireEvent.click(screen.getByRole('button', { name: 'Go home user 1' }))
    await waitFor(() => expect(readRuntimeState().pageEntry.status).toBe('success'))

    fireEvent.click(screen.getByRole('button', { name: 'Go home user 2' }))
    await waitFor(() => expect(readRuntimeState().pageEntry.status).toBe('success'))

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(readRuntimeState().navigation.history).toEqual([
      { entryId: 0, pageId: 'landing', params: {} },
      { entryId: 1, pageId: 'home', params: { userId: '1' } },
      { entryId: 2, pageId: 'home', params: { userId: '2' } },
    ])
  })

  it('resolves preload requests from the params snapshot of the active entry', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(createJsonResponse({ ok: true }))
    vi.stubGlobal('fetch', fetchMock)

    renderPreloadHarness()

    fireEvent.click(screen.getByRole('button', { name: 'Go editor user 7' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(readRuntimeState().pageEntry.status).toBe('success'))

    expect(fetchMock).toHaveBeenCalledWith('/api/editor?id=user-7', { method: 'GET' })
    expect(readRuntimeState().pageEntry).toEqual({
      entryId: 1,
      pageId: 'editor',
      params: { userId: 'user-7' },
      preloadNames: ['loadEditor'],
      status: 'success',
    })
  })
})
