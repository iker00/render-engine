import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RuntimeConfig } from '../config/runtime-config'
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

function NavigationFixture() {
  const { navigateToPage } = useRuntimeStateActions()

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
      <button type="button" onClick={() => navigateToPage('empty')}>
        Go empty
      </button>
      <button type="button" onClick={() => navigateToPage('landing')}>
        Go landing
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
  withRerenderHarness = false,
}: {
  config?: RuntimeConfig
  seedFormTerm?: string
  seedSelectedUserId?: string
  withRerenderHarness?: boolean
} = {}) {
  const runtimeChildren = (
    <>
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
        preloadNames: ['searchUsers', 'loadTeams'],
      },
    })

    expect(loadingState.pageEntry).toEqual({
      entryId: 1,
      pageId: 'details',
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
        preloadNames: ['searchUsers'],
      },
    })

    const secondEntryState = runtimeStateReducer(firstEntryState, {
      type: 'page-entry/set-loading',
      payload: {
        entryId: 2,
        pageId: 'home',
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
      preloadNames: [],
      status: 'loading',
    })
  })

  it('exposes selectors for the page entry domain without affecting navigation, forms, or queries', () => {
    const state: RuntimeState = {
      navigation: {
        currentPageId: 'details',
        history: ['home', 'details'],
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
      .mockResolvedValueOnce(createJsonResponse({ profile: 'loaded' }))
    vi.stubGlobal('fetch', fetchMock)

    renderPreloadHarness({
      seedSelectedUserId: 'user-1',
    })

    fireEvent.click(screen.getByRole('button', { name: 'Go profile' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(readRuntimeState().pageEntry.status).toBe('success'))

    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/users/current', { method: 'GET' })
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/profile?id=user-1', { method: 'GET' })
  })
})
