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
      preloads: [
        { operationName: 'searchUsers', requestParams: {} },
        { operationName: 'loadTeams', requestParams: {} },
      ],
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
      preloads: [{ operationName: 'searchUsers', requestParams: {} }],
      layout: [],
    },
    {
      id: 'details',
      preloads: [{ operationName: 'loadTeams', requestParams: {} }],
      layout: [],
    },
    {
      id: 'dashboard',
      preloads: [
        { operationName: 'searchUsers', requestParams: {} },
        { operationName: 'loadTeams', requestParams: {} },
      ],
      layout: [],
    },
    {
      id: 'broken',
      preloads: [
        { operationName: 'missingOperation', requestParams: {} },
        { operationName: 'invalidSearch', requestParams: {} },
      ],
      layout: [],
    },
    {
      id: 'profile',
      preloads: [
        { operationName: 'selectedUser', requestParams: {} },
        { operationName: 'loadProfile', requestParams: {} },
      ],
      layout: [],
    },
    {
      id: 'editor',
      preloads: [{ operationName: 'loadEditor', requestParams: {} }],
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
  window.history.replaceState(null, '', window.location.pathname + window.location.search)
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
      <button type="button" onClick={() => navigateToPage('editor', { userId: 'user-8' })}>
        Go editor user 8
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

function QueryMutationHarness() {
  const { setQuerySuccess } = useRuntimeStateActions()

  return (
    <button
      type="button"
      onClick={() => {
        setQuerySuccess('selectedUser', {
          id: 'user-2',
        })
      }}
    >
      Change selected user
    </button>
  )
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
      requestSignature: null,
    })
    expect(nextState.queries.loadTeams).toEqual({
      status: 'loading',
      data: null,
      error: null,
      requestSignature: null,
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
      requestSignature: '{"endpoint":"/api/users","method":"GET","operationName":"searchUsers"}',
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
      requestSignature: '{"endpoint":"/api/users","method":"GET","operationName":"searchUsers"}',
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
          preloads: [{ operationName: 'searchUsers', requestParams: {} }],
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

  it('does not relaunch a preload when revisiting a page whose effective request signature did not change', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(createJsonResponse({ results: ['Ada'] }))
      .mockResolvedValueOnce(createJsonResponse({ teams: ['Runtime'] }))
      
    vi.stubGlobal('fetch', fetchMock)

    renderPreloadHarness()

    fireEvent.click(screen.getByRole('button', { name: 'Go home' }))
    await waitFor(() => expect(readRuntimeState().pageEntry.status).toBe('success'))

    fireEvent.click(screen.getByRole('button', { name: 'Go details' }))
    await waitFor(() => expect(readRuntimeState().pageEntry.pageId).toBe('details'))
    await waitFor(() => expect(readRuntimeState().pageEntry.status).toBe('success'))

    fireEvent.click(screen.getByRole('button', { name: 'Go home' }))
    await waitFor(() => expect(readRuntimeState().pageEntry.pageId).toBe('home'))
    await waitFor(() => expect(readRuntimeState().queries.searchUsers.data).toEqual({ results: ['Ada'] }))

    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/users', { method: 'GET' })
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/teams', { method: 'GET' })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('does not relaunch goBack preloads when the visible query already represents the same request signature', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(createJsonResponse({ results: ['Ada'] }))
      .mockResolvedValueOnce(createJsonResponse({ teams: ['Runtime'] }))
      
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

    expect(readRuntimeState().queries.searchUsers.data).toEqual({ results: ['Ada'] })
    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/users', { method: 'GET' })
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/teams', { method: 'GET' })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('keeps the existing query data when going back to a page whose preload signature did not change', async () => {
    let resolveInitialHome: ((response: Response) => void) | null = null
    let resolveDetails: ((response: Response) => void) | null = null
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

      return Promise.resolve(createJsonResponse({ results: ['Unexpected replay'] }))
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
      status: 'success',
    }))
    expect(readRuntimeState().queries.searchUsers).toEqual({
      status: 'success',
      data: { results: ['Ada'] },
      error: null,
      requestSignature: '{"endpoint":"/api/users","method":"GET","operationName":"searchUsers"}',
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
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

  it('relaunches a settled page entry preload when a query dependency changes its effective request signature', async () => {
    let resolveSecondProfile: ((response: Response) => void) | null = null
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(createJsonResponse({ name: 'Ada' }))
      .mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            resolveSecondProfile = resolve
          }),
      )
    vi.stubGlobal('fetch', fetchMock)

    render(
      <RuntimeStateProvider
        config={{
          api: {
            loadProfile: {
              method: 'GET',
              endpoint: '/api/profile',
              query: {
                userId: 'queries.selectedUser.data.id',
              },
            },
          },
          initialPage: 'profile',
          pages: [
            {
              id: 'profile',
              preloads: [{ operationName: 'loadProfile', requestParams: {} }],
              layout: [],
            },
          ],
        }}
      >
        <SeedRuntimeState selectedUserId="user-1" />
        <QueryMutationHarness />
        <RuntimeStateSnapshot />
      </RuntimeStateProvider>,
    )

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(readRuntimeState().pageEntry.status).toBe('success'))
    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/profile?userId=user-1', { method: 'GET' })

    fireEvent.click(screen.getByRole('button', { name: 'Change selected user' }))

    await waitFor(() => expect(readRuntimeState().pageEntry.status).toBe('loading'))
    expect(readRuntimeState().queries.loadProfile).toEqual({
      status: 'loading',
      data: null,
      error: null,
      requestSignature: '{"endpoint":"/api/profile","method":"GET","operationName":"loadProfile","query":{"userId":"user-2"}}',
    })

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/profile?userId=user-2', { method: 'GET' })
    resolveSecondProfile?.(createJsonResponse({ name: 'Grace' }))
    await waitFor(() => expect(readRuntimeState().pageEntry.status).toBe('success'))
    expect(readRuntimeState().queries.loadProfile).toEqual({
      status: 'success',
      data: { name: 'Grace' },
      error: null,
      requestSignature: '{"endpoint":"/api/profile","method":"GET","operationName":"loadProfile","query":{"userId":"user-2"}}',
    })
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
      requestSignature: '{"endpoint":"/api/users","method":"GET","operationName":"searchUsers"}',
    })
    expect(state.queries.loadTeams).toEqual({
      status: 'error',
      data: null,
      error: {
        code: 'http-error',
        message: 'The api operation "loadTeams" failed with HTTP status 500.',
      },
      requestSignature: '{"endpoint":"/api/teams","method":"GET","operationName":"loadTeams"}',
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
      requestSignature: null,
    })
    expect(state.queries.invalidSearch).toEqual({
      status: 'error',
      data: null,
      error: {
        code: 'request-build-failed',
        message: 'The api operation "invalidSearch" could not resolve "forms.userSearch.missingField" for "query.search".',
      },
      requestSignature: null,
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
      requestSignature: '{"endpoint":"/api/users/current","method":"GET","operationName":"selectedUser"}',
    })
    expect(readRuntimeState().queries.loadProfile).toEqual({
      status: 'error',
      data: null,
      error: {
        code: 'request-build-failed',
        message: 'The api operation "loadProfile" could not resolve "queries.selectedUser.data.id" for "query.id".',
      },
      requestSignature: null,
    })
  })

  it('relaunches preloads when navigating to the same page with different params that change the effective request signature', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(createJsonResponse({ ok: true }))
      .mockResolvedValueOnce(createJsonResponse({ ok: true }))
    vi.stubGlobal('fetch', fetchMock)

    renderPreloadHarness({
      config: {
        ...preloadConfig,
        initialPage: 'landing',
      },
    })

    fireEvent.click(screen.getByRole('button', { name: 'Go editor user 7' }))
    await waitFor(() => expect(readRuntimeState().pageEntry.status).toBe('success'))

    fireEvent.click(screen.getByRole('button', { name: 'Go editor user 8' }))
    await waitFor(() => expect(readRuntimeState().pageEntry.status).toBe('success'))

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(readRuntimeState().navigation.history).toEqual([
      { entryId: 0, pageId: 'landing', params: {} },
      { entryId: 1, pageId: 'editor', params: { userId: 'user-7' } },
      { entryId: 2, pageId: 'editor', params: { userId: 'user-8' } },
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

  it('rebuilds preload-driven forms on same-page goBack while keeping persistOnUnmount forms intact', async () => {
    let resolveAdaInitial: ((response: Response) => void) | null = null
    let resolveGrace: ((response: Response) => void) | null = null
    let resolveAdaReplay: ((response: Response) => void) | null = null
    const fetchMock = vi.fn((url: string) => {
      if (url === '/api/profile?userId=ada' && resolveAdaInitial === null) {
        return new Promise<Response>((resolve) => {
          resolveAdaInitial = resolve
        })
      }

      if (url === '/api/profile?userId=grace') {
        return new Promise<Response>((resolve) => {
          resolveGrace = resolve
        })
      }

      return new Promise<Response>((resolve) => {
        resolveAdaReplay = resolve
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    renderRuntimePageWithPreloads({
      api: {
        loadProfile: {
          method: 'GET',
          endpoint: '/api/profile',
          query: {
            userId: 'params.userId',
          },
        },
      },
      initialPage: 'landing',
      pages: [
        {
          id: 'landing',
          layout: [
            {
              type: 'button',
              props: {
                label: 'Edit Ada',
                action: {
                  type: 'navigateTo',
                  pageId: 'editor',
                  params: {
                    userId: 'ada',
                  },
                },
              },
            },
          ],
        },
        {
          id: 'editor',
          preloads: [{ operationName: 'loadProfile', requestParams: {} }],
          layout: [
            {
              type: 'form',
              id: 'profileForm',
              children: [
                {
                  type: 'input',
                  queryStateFeedback: {
                    query: 'loadProfile',
                    states: {
                      success: {
                        mode: 'show',
                      },
                    },
                  },
                  props: {
                    fieldId: 'name',
                    label: 'Name',
                    defaultValue: 'queries.loadProfile.data.name',
                  },
                },
              ],
            },
            {
              type: 'form',
              id: 'stickyForm',
              persistOnUnmount: true,
              children: [
                {
                  type: 'input',
                  props: {
                    fieldId: 'notes',
                    label: 'Notes',
                    defaultValue: '',
                  },
                },
              ],
            },
            {
              type: 'button',
              props: {
                label: 'Edit Grace',
                action: {
                  type: 'navigateTo',
                  pageId: 'editor',
                  params: {
                    userId: 'grace',
                  },
                },
              },
            },
            {
              type: 'button',
              props: {
                label: 'Go back',
                action: {
                  type: 'goBack',
                },
              },
            },
          ],
        },
      ],
    })

    fireEvent.click(screen.getByRole('button', { name: 'Edit Ada' }))
    resolveAdaInitial?.(createJsonResponse({ name: 'Ada' }))
    await waitFor(() => expect(readRuntimeState().pageEntry.status).toBe('success'))
    await waitFor(() => expect(screen.getByLabelText('Name')).toHaveValue('Ada'))

    fireEvent.change(screen.getByLabelText('Notes'), { target: { value: 'Pinned note' } })
    fireEvent.click(screen.getByRole('button', { name: 'Edit Grace' }))

    await waitFor(() => expect(readRuntimeState().pageEntry).toMatchObject({
      pageId: 'editor',
      params: { userId: 'grace' },
      status: 'loading',
    }))
    expect(screen.getByLabelText('Notes')).toHaveValue('Pinned note')
    expect(screen.queryByLabelText('Name')).not.toBeInTheDocument()
    expect(screen.queryByDisplayValue('Ada')).not.toBeInTheDocument()

    resolveGrace?.(createJsonResponse({ name: 'Grace' }))
    await waitFor(() => expect(readRuntimeState().pageEntry.status).toBe('success'))
    await waitFor(() => expect(screen.getByLabelText('Name')).toHaveValue('Grace'))
    expect(screen.getByLabelText('Notes')).toHaveValue('Pinned note')

    fireEvent.click(screen.getByRole('button', { name: 'Go back' }))

    await waitFor(() => expect(readRuntimeState().pageEntry).toMatchObject({
      pageId: 'editor',
      params: { userId: 'ada' },
      status: 'loading',
    }))
    expect(readRuntimeState().queries.loadProfile).toEqual({
      status: 'loading',
      data: null,
      error: null,
      requestSignature: '{"endpoint":"/api/profile","method":"GET","operationName":"loadProfile","query":{"userId":"ada"}}',
    })
    expect(screen.getByLabelText('Notes')).toHaveValue('Pinned note')
    expect(screen.queryByLabelText('Name')).not.toBeInTheDocument()
    expect(screen.queryByDisplayValue('Grace')).not.toBeInTheDocument()

    resolveAdaReplay?.(createJsonResponse({ name: 'Ada replay' }))
    await waitFor(() => expect(readRuntimeState().pageEntry.status).toBe('success'))
    await waitFor(() => expect(screen.getByLabelText('Name')).toHaveValue('Ada replay'))
    expect(screen.getByLabelText('Notes')).toHaveValue('Pinned note')
    expect(readRuntimeState().forms.profileForm.name.value).toBe('Ada replay')
    expect(readRuntimeState().forms.stickyForm.notes.value).toBe('Pinned note')
  })

  it('keeps reset, validation, and submit aligned with the reconstructed form state after same-page preload invalidation', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(createJsonResponse({ name: 'Ada' }))
      .mockResolvedValueOnce(createJsonResponse({ name: 'Grace' }))
      .mockResolvedValueOnce(createJsonResponse({ ok: true }))
    vi.stubGlobal('fetch', fetchMock)

    renderRuntimePageWithPreloads({
      api: {
        loadProfile: {
          method: 'GET',
          endpoint: '/api/profile',
          query: {
            userId: 'params.userId',
          },
        },
        saveProfile: {
          method: 'POST',
          endpoint: '/api/profile',
          body: {
            userId: 'params.userId',
            name: 'forms.profileForm.name',
          },
        },
      },
      initialPage: 'landing',
      pages: [
        {
          id: 'landing',
          layout: [
            {
              type: 'button',
              props: {
                label: 'Edit Ada',
                action: {
                  type: 'navigateTo',
                  pageId: 'editor',
                  params: {
                    userId: 'ada',
                  },
                },
              },
            },
          ],
        },
        {
          id: 'editor',
          preloads: [{ operationName: 'loadProfile', requestParams: {} }],
          layout: [
            {
              type: 'form',
              id: 'profileForm',
              submitAction: {
                type: 'executeOperation',
                operationName: 'saveProfile',
              },
              children: [
                {
                  type: 'input',
                  props: {
                    fieldId: 'name',
                    label: 'Name',
                    defaultValue: 'queries.loadProfile.data.name',
                    validations: {
                      required: {
                        value: true,
                      },
                    },
                  },
                },
                {
                  type: 'button',
                  props: {
                    label: 'Submit profile',
                  },
                },
              ],
            },
            {
              type: 'button',
              props: {
                label: 'Reset profile form',
                action: {
                  type: 'resetForm',
                  formId: 'profileForm',
                },
              },
            },
            {
              type: 'button',
              props: {
                label: 'Edit Grace',
                action: {
                  type: 'navigateTo',
                  pageId: 'editor',
                  params: {
                    userId: 'grace',
                  },
                },
              },
            },
          ],
        },
      ],
    })

    fireEvent.click(screen.getByRole('button', { name: 'Edit Ada' }))
    await waitFor(() => expect(readRuntimeState().pageEntry.status).toBe('success'))
    await waitFor(() => expect(screen.getByRole('textbox', { name: /^Name/ })).toHaveValue('Ada'))

    fireEvent.change(screen.getByRole('textbox', { name: /^Name/ }), { target: { value: 'Manual Ada' } })
    fireEvent.click(screen.getByRole('button', { name: 'Edit Grace' }))

    await waitFor(() => expect(readRuntimeState().pageEntry).toMatchObject({
      pageId: 'editor',
      params: { userId: 'grace' },
      status: 'success',
    }))
    await waitFor(() => expect(screen.getByRole('textbox', { name: /^Name/ })).toHaveValue('Grace'))
    expect(readRuntimeState().forms.profileForm.name.value).toBe('Grace')

    fireEvent.click(screen.getByRole('button', { name: 'Reset profile form' }))
    await waitFor(() => expect(screen.getByRole('textbox', { name: /^Name/ })).toHaveValue('Grace'))
    expect(readRuntimeState().forms.profileForm.name.value).toBe('Grace')

    fireEvent.change(screen.getByRole('textbox', { name: /^Name/ }), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: 'Submit profile' }))

    await waitFor(() => expect(screen.getByText('Required')).toBeInTheDocument())
    expect(fetchMock).toHaveBeenCalledTimes(2)

    fireEvent.change(screen.getByRole('textbox', { name: /^Name/ }), { target: { value: 'Grace Updated' } })
    fireEvent.click(screen.getByRole('button', { name: 'Submit profile' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3))
    expect(fetchMock.mock.calls[2]?.[0]).toBe('/api/profile')
    expect(fetchMock.mock.calls[2]?.[1]).toMatchObject({
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        userId: 'grace',
        name: 'Grace Updated',
      }),
    })
    await waitFor(() =>
      expect(readRuntimeState().queries.saveProfile).toEqual({
        status: 'success',
        data: { ok: true },
        error: null,
        requestSignature:
          '{"body":{"name":"Grace Updated","userId":"grace"},"endpoint":"/api/profile","method":"POST","operationName":"saveProfile"}',
      }),
    )
  })
})
