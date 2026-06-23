import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useEffect } from 'react'
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

function RuntimeStateSnapshot() {
  const state = useRuntimeState()

  return <pre data-testid="runtime-state">{JSON.stringify(state)}</pre>
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

const navigationConfig: RuntimeConfig = {
  api: {
    loadHome: {
      method: 'GET',
      endpoint: '/api/home',
    },
    loadDetails: {
      method: 'GET',
      endpoint: '/api/details',
    },
  },
  initialPage: 'home',
  pages: [
    {
      id: 'home',
      preloads: [{ operationName: 'loadHome', requestParams: {} }],
      layout: [
        {
          type: 'heading',
          props: {
            text: 'Home',
            level: 1,
          },
        },
        {
          type: 'button',
          props: {
            label: 'Open details',
            action: {
              type: 'navigateTo',
              pageId: 'details',
            },
          },
        },
        {
          type: 'button',
          props: {
            label: 'Stay here',
            action: {
              type: 'navigateTo',
              pageId: 'home',
            },
          },
        },
      ],
    },
    {
      id: 'details',
      preloads: [{ operationName: 'loadDetails', requestParams: {} }],
      layout: [
        {
          type: 'heading',
          props: {
            text: 'Details',
            level: 1,
          },
        },
        {
          type: 'button',
          props: {
            label: 'Back home',
            action: {
              type: 'goBack',
            },
          },
        },
        {
          type: 'button',
          props: {
            label: 'Open home again',
            action: {
              type: 'navigateTo',
              pageId: 'home',
            },
          },
        },
      ],
    },
  ],
}

const executeOperationButtonConfig: RuntimeConfig = {
  api: {
    searchUsers: {
      method: 'POST',
      endpoint: '/api/users',
      query: {
        search: 'forms.userSearch.name',
      },
      headers: {
        accept: 'application/json',
      },
      body: {
        source: 'button',
      },
    },
  },
  initialPage: 'home',
  pages: [
    {
      id: 'home',
      layout: [
        {
          type: 'heading',
          props: {
            text: 'Home',
            level: 1,
          },
        },
        {
          type: 'button',
          props: {
            label: 'Search users',
            action: {
              type: 'executeOperation',
              operationName: 'searchUsers',
              query: {
                page: 2,
              },
              headers: {
                authorization: 'queries.searchUsers.data.0',
              },
              body: {
                profile: {
                  nickname: 'forms.userSearch.name',
                },
              },
            },
          },
        },
      ],
    },
  ],
}

const navigateWithParamsConfig: RuntimeConfig = {
  api: {},
  initialPage: 'home',
  pages: [
    {
      id: 'home',
      layout: [
        {
          type: 'button',
          props: {
            label: 'Open details with params',
            action: {
              type: 'navigateTo',
              pageId: 'details',
              params: {
                userId: 'forms.userSearch.name',
                mode: 'edit',
                missing: 'forms.userSearch.missingField',
                tags: 'queries.searchUsers.data',
              },
            },
          },
        },
      ],
    },
    {
      id: 'details',
      layout: [
        {
          type: 'heading',
          props: {
            text: 'params.userId',
            level: 1,
          },
        },
        {
          type: 'paragraph',
          props: {
            text: 'params.mode',
          },
        },
        {
          type: 'button',
          props: {
            label: 'Open summary with inherited params',
            action: {
              type: 'navigateTo',
              pageId: 'summary',
              params: {
                userId: 'params.userId',
              },
            },
          },
        },
      ],
    },
    {
      id: 'summary',
      layout: [
        {
          type: 'heading',
          props: {
            text: 'params.userId',
            level: 2,
          },
        },
      ],
    },
  ],
}

const repeaterNavigationConfig: RuntimeConfig = {
  api: {
    loadPost: {
      method: 'POST',
      endpoint: '/api/posts/load',
    },
  },
  initialPage: 'home',
  pages: [
    {
      id: 'home',
      layout: [
        {
          type: 'repeater',
          props: {
            items: {
              source: 'queries.posts.data.results',
              key: 'id',
            },
            template: [
              {
                type: 'button',
                props: {
                  label: 'Open post',
                  action: {
                    type: 'navigateTo',
                    pageId: 'details',
                    params: {
                      slug: 'item.slug',
                      mode: 'item.meta.mode',
                      tags: 'item.tags',
                    },
                  },
                },
              },
              {
                type: 'button',
                props: {
                  label: 'Load post',
                  action: {
                    type: 'executeOperation',
                    operationName: 'loadPost',
                    query: {
                      slug: 'item.slug',
                    },
                    headers: {
                      authorization: 'item.token',
                    },
                    body: {
                      id: 'item.id',
                      mode: 'item.meta.mode',
                    },
                  },
                },
              },
            ],
          },
        },
      ],
    },
    {
      id: 'details',
      layout: [
        {
          type: 'heading',
          props: {
            text: 'params.slug',
            level: 1,
          },
        },
        {
          type: 'paragraph',
          props: {
            text: 'params.mode',
          },
        },
      ],
    },
  ],
}

function renderRuntime(config: RuntimeConfig = navigationConfig) {
  return render(
    <RuntimeStateProvider config={config}>
      <RuntimeStateSnapshot />
      <RuntimePage />
    </RuntimeStateProvider>,
  )
}

function RuntimeFormAndQuerySeed() {
  const { initializeForm, initializeQuery, setQuerySuccess } = useRuntimeStateActions()

  useEffect(() => {
    initializeForm('userSearch', {
      name: {
        defaultValue: 'Ada',
      },
    })
    initializeQuery('searchUsers')
  }, [initializeForm, initializeQuery])

  return (
    <>
      <button type="button" onClick={() => setQuerySuccess('searchUsers', ['Ada'])}>
        Seed prior query success
      </button>
    </>
  )
}

function renderRuntimeWithStateSeed(config: RuntimeConfig) {
  return render(
    <RuntimeStateProvider config={config}>
      <RuntimeFormAndQuerySeed />
      <RuntimeStateSnapshot />
      <RuntimePage />
    </RuntimeStateProvider>,
  )
}

function RuntimeRepeaterSeed() {
  const { initializeQuery, setQuerySuccess } = useRuntimeStateActions()

  useEffect(() => {
    initializeQuery('posts')
  }, [initializeQuery])

  return (
    <button
      type="button"
      onClick={() =>
        setQuerySuccess('posts', {
          results: [
            {
              id: 'post-1',
              slug: 'hello-world',
              token: 'token-1',
              tags: ['alpha'],
              meta: {
                mode: 'read',
              },
            },
            {
              id: 'post-2',
              slug: 'goodbye-world',
              token: 'token-2',
              tags: ['beta'],
              meta: {
                mode: 'preview',
              },
            },
          ],
        })
      }
    >
      Seed repeater posts
    </button>
  )
}

function renderRuntimeWithRepeaterSeed(config: RuntimeConfig) {
  return render(
    <RuntimeStateProvider config={config}>
      <RuntimeRepeaterSeed />
      <RuntimeStateSnapshot />
      <RuntimePage />
    </RuntimeStateProvider>,
  )
}

describe('Runtime button navigation', () => {
  it('navigates to another page when a navigateTo button is clicked', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(createJsonResponse({ home: true }))
      .mockResolvedValueOnce(createJsonResponse({ details: true }))
    vi.stubGlobal('fetch', fetchMock)

    renderRuntime()

    await waitFor(() => expect(readRuntimeState().pageEntry.status).toBe('success'))

    fireEvent.click(screen.getByRole('button', { name: 'Open details' }))

    await waitFor(() => expect(screen.getByTestId('runtime-page')).toHaveAttribute('data-runtime-page-id', 'details'))
    await waitFor(() => expect(readRuntimeState().pageEntry.status).toBe('success'))

    expect(readRuntimeState().navigation.history).toEqual([
      { entryId: 0, pageId: 'home', params: {} },
      { entryId: 1, pageId: 'details', params: {} },
    ])
  })

  it('keeps the current page and does not duplicate history when navigateTo targets the visible page', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(createJsonResponse({ home: true }))
    vi.stubGlobal('fetch', fetchMock)

    renderRuntime()

    await waitFor(() => expect(readRuntimeState().pageEntry.status).toBe('success'))

    fireEvent.click(screen.getByRole('button', { name: 'Stay here' }))

    expect(screen.getByTestId('runtime-page')).toHaveAttribute('data-runtime-page-id', 'home')
    expect(readRuntimeState().navigation.history).toEqual([{ entryId: 0, pageId: 'home', params: {} }])
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('goes back to the previous valid page when a goBack button is clicked', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(createJsonResponse({ home: true }))
      .mockResolvedValueOnce(createJsonResponse({ details: true }))
    vi.stubGlobal('fetch', fetchMock)

    renderRuntime()

    await waitFor(() => expect(readRuntimeState().pageEntry.status).toBe('success'))

    fireEvent.click(screen.getByRole('button', { name: 'Open details' }))
    await waitFor(() => expect(screen.getByTestId('runtime-page')).toHaveAttribute('data-runtime-page-id', 'details'))
    await waitFor(() => expect(readRuntimeState().pageEntry.status).toBe('success'))

    fireEvent.click(screen.getByRole('button', { name: 'Back home' }))

    await waitFor(() => expect(screen.getByTestId('runtime-page')).toHaveAttribute('data-runtime-page-id', 'home'))
    await waitFor(() => expect(readRuntimeState().pageEntry.status).toBe('success'))

    expect(readRuntimeState().navigation.history).toEqual([
      { entryId: 0, pageId: 'home', params: {} },
      { entryId: 1, pageId: 'details', params: {} },
    ])
    expect(readRuntimeState().navigation.currentEntryIndex).toBe(0)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('keeps the previous query data when goBack returns to a page whose preload signature did not change', async () => {
    let resolveInitialHome: ((response: Response) => void) | null = null
    let resolveDetails: ((response: Response) => void) | null = null
    const fetchMock = vi.fn((url: string) => {
      if (url === '/api/home' && resolveInitialHome === null) {
        return new Promise<Response>((resolve) => {
          resolveInitialHome = resolve
        })
      }

      if (url === '/api/details') {
        return new Promise<Response>((resolve) => {
          resolveDetails = resolve
        })
      }

      return Promise.resolve(createJsonResponse({ home: 'unexpected replay' }))
    })
    vi.stubGlobal('fetch', fetchMock)

    renderRuntime()

    resolveInitialHome?.(createJsonResponse({ home: true }))
    await waitFor(() => expect(readRuntimeState().pageEntry.status).toBe('success'))
    expect(readRuntimeState().queries.loadHome).toEqual({
      status: 'success',
      data: { home: true },
      error: null,
      requestSignature: '{"endpoint":"/api/home","method":"GET","operationName":"loadHome"}',
    })

    fireEvent.click(screen.getByRole('button', { name: 'Open details' }))
    resolveDetails?.(createJsonResponse({ details: true }))
    await waitFor(() => expect(readRuntimeState().pageEntry.status).toBe('success'))

    fireEvent.click(screen.getByRole('button', { name: 'Back home' }))

    await waitFor(() => expect(screen.getByTestId('runtime-page')).toHaveAttribute('data-runtime-page-id', 'home'))
    await waitFor(() => expect(readRuntimeState().pageEntry.status).toBe('success'))
    expect(readRuntimeState().queries.loadHome).toEqual({
      status: 'success',
      data: { home: true },
      error: null,
      requestSignature: '{"endpoint":"/api/home","method":"GET","operationName":"loadHome"}',
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('keeps navigation deterministic under successive button activations', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(createJsonResponse({ home: true }))
      .mockResolvedValueOnce(createJsonResponse({ details: true }))
      .mockResolvedValueOnce(createJsonResponse({ home: 'again' }))
    vi.stubGlobal('fetch', fetchMock)

    renderRuntime()

    await waitFor(() => expect(readRuntimeState().pageEntry.status).toBe('success'))

    fireEvent.click(screen.getByRole('button', { name: 'Open details' }))
    await waitFor(() => expect(screen.getByTestId('runtime-page')).toHaveAttribute('data-runtime-page-id', 'details'))
    await waitFor(() => expect(readRuntimeState().pageEntry.status).toBe('success'))

    fireEvent.click(screen.getByRole('button', { name: 'Open home again' }))

    await waitFor(() => expect(screen.getByTestId('runtime-page')).toHaveAttribute('data-runtime-page-id', 'home'))
    await waitFor(() => expect(readRuntimeState().pageEntry.status).toBe('success'))

    expect(readRuntimeState().navigation.history).toEqual([
      { entryId: 0, pageId: 'home', params: {} },
      { entryId: 1, pageId: 'details', params: {} },
      { entryId: 2, pageId: 'home', params: {} },
    ])
  })

  it('resolves navigateTo params against the current snapshot, omits missing or non-scalar results, and renders params text on the destination page', async () => {
    renderRuntimeWithStateSeed(navigateWithParamsConfig)

    fireEvent.click(screen.getByRole('button', { name: 'Seed prior query success' }))
    fireEvent.click(screen.getByRole('button', { name: 'Open details with params' }))

    await waitFor(() => expect(screen.getByTestId('runtime-page')).toHaveAttribute('data-runtime-page-id', 'details'))

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Ada')
    expect(screen.getByText('edit')).toBeInTheDocument()
    expect(readRuntimeState().navigation.history).toEqual([
      { entryId: 0, pageId: 'home', params: {} },
      { entryId: 1, pageId: 'details', params: { userId: 'Ada', mode: 'edit' } },
    ])
  })

  it('can use params as the source for a second navigateTo action', async () => {
    renderRuntimeWithStateSeed(navigateWithParamsConfig)

    fireEvent.click(screen.getByRole('button', { name: 'Seed prior query success' }))
    fireEvent.click(screen.getByRole('button', { name: 'Open details with params' }))
    await waitFor(() => expect(screen.getByTestId('runtime-page')).toHaveAttribute('data-runtime-page-id', 'details'))

    fireEvent.click(screen.getByRole('button', { name: 'Open summary with inherited params' }))

    await waitFor(() => expect(screen.getByTestId('runtime-page')).toHaveAttribute('data-runtime-page-id', 'summary'))
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Ada')
    expect(readRuntimeState().navigation.history).toEqual([
      { entryId: 0, pageId: 'home', params: {} },
      { entryId: 1, pageId: 'details', params: { userId: 'Ada', mode: 'edit' } },
      { entryId: 2, pageId: 'summary', params: { userId: 'Ada' } },
    ])
  })

  it('keeps partial template strings literal in navigateTo params while resolving complete params references', async () => {
    const configWithTemplatedParams: RuntimeConfig = {
      api: {},
      initialPage: 'home',
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'button',
              props: {
                label: 'Open details',
                action: {
                  type: 'navigateTo',
                  pageId: 'details',
                  params: {
                    userId: 'forms.userSearch.name',
                  },
                },
              },
            },
          ],
        },
        {
          id: 'details',
          layout: [
            {
              type: 'button',
              props: {
                label: 'Open templated summary',
                action: {
                  type: 'navigateTo',
                  pageId: 'summary',
                  params: {
                    userId: 'params.userId',
                    caseId: 'case-{{params.userId}}',
                  },
                },
              },
            },
          ],
        },
        {
          id: 'summary',
          layout: [
            {
              type: 'heading',
              props: {
                text: 'params.userId',
                level: 1,
              },
            },
            {
              type: 'paragraph',
              props: {
                text: 'params.caseId',
              },
            },
          ],
        },
      ],
    }

    renderRuntimeWithStateSeed(configWithTemplatedParams)

    fireEvent.click(screen.getByRole('button', { name: 'Open details' }))
    await waitFor(() => expect(screen.getByTestId('runtime-page')).toHaveAttribute('data-runtime-page-id', 'details'))

    fireEvent.click(screen.getByRole('button', { name: 'Open templated summary' }))

    await waitFor(() => expect(screen.getByTestId('runtime-page')).toHaveAttribute('data-runtime-page-id', 'summary'))
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Ada')
    expect(screen.getByText('case-{{params.userId}}')).toBeInTheDocument()
    expect(readRuntimeState().navigation.history).toEqual([
      { entryId: 0, pageId: 'home', params: {} },
      { entryId: 1, pageId: 'details', params: { userId: 'Ada' } },
      { entryId: 2, pageId: 'summary', params: { userId: 'Ada', caseId: 'case-{{params.userId}}' } },
    ])
  })

  it('rebuilds params-based form defaults from the new navigation context after a real unmount', async () => {
    renderRuntime({
      api: {},
      initialPage: 'home',
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'button',
              props: {
                label: 'Edit Ada',
                action: {
                  type: 'navigateTo',
                  pageId: 'details',
                  params: {
                    userId: 'Ada',
                  },
                },
              },
            },
            {
              type: 'button',
              props: {
                label: 'Edit Grace',
                action: {
                  type: 'navigateTo',
                  pageId: 'details',
                  params: {
                    userId: 'Grace',
                  },
                },
              },
            },
          ],
        },
        {
          id: 'details',
          layout: [
            {
              type: 'form',
              id: 'profileForm',
              children: [
                {
                  type: 'input',
                  props: {
                    fieldId: 'name',
                    label: 'Name',
                    defaultValue: 'params.userId',
                  },
                },
              ],
            },
            {
              type: 'button',
              props: {
                label: 'Back home',
                action: {
                  type: 'navigateTo',
                  pageId: 'home',
                },
              },
            },
          ],
        },
      ],
    })

    fireEvent.click(screen.getByRole('button', { name: 'Edit Ada' }))
    await waitFor(() => expect(screen.getByTestId('runtime-page')).toHaveAttribute('data-runtime-page-id', 'details'))
    expect(screen.getByLabelText('Name')).toHaveValue('Ada')

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Manual override' } })
    fireEvent.click(screen.getByRole('button', { name: 'Back home' }))
    await waitFor(() => expect(screen.getByTestId('runtime-page')).toHaveAttribute('data-runtime-page-id', 'home'))

    fireEvent.click(screen.getByRole('button', { name: 'Edit Grace' }))
    await waitFor(() => expect(screen.getByTestId('runtime-page')).toHaveAttribute('data-runtime-page-id', 'details'))

    expect(screen.getByLabelText('Name')).toHaveValue('Grace')
    expect(readRuntimeState().forms.profileForm.name.value).toBe('Grace')
  })

  it('rebuilds params-based form defaults when navigating to a different page entry on the same page', async () => {
    renderRuntime({
      api: {},
      initialPage: 'details',
      pages: [
        {
          id: 'details',
          layout: [
            {
              type: 'form',
              id: 'profileForm',
              children: [
                {
                  type: 'input',
                  props: {
                    fieldId: 'name',
                    label: 'Name',
                    defaultValue: 'params.userId',
                  },
                },
              ],
            },
            {
              type: 'button',
              props: {
                label: 'Edit Ada',
                action: {
                  type: 'navigateTo',
                  pageId: 'details',
                  params: {
                    userId: 'Ada',
                  },
                },
              },
            },
            {
              type: 'button',
              props: {
                label: 'Edit Grace',
                action: {
                  type: 'navigateTo',
                  pageId: 'details',
                  params: {
                    userId: 'Grace',
                  },
                },
              },
            },
            {
              type: 'button',
              props: {
                label: 'Stay on Grace',
                action: {
                  type: 'navigateTo',
                  pageId: 'details',
                  params: {
                    userId: 'Grace',
                    mode: 'edit',
                  },
                },
              },
            },
            {
              type: 'button',
              props: {
                label: 'Stay on Grace reordered',
                action: {
                  type: 'navigateTo',
                  pageId: 'details',
                  params: {
                    mode: 'edit',
                    userId: 'Grace',
                  },
                },
              },
            },
          ],
        },
      ],
    })

    expect(screen.getByLabelText('Name')).toHaveValue('')

    fireEvent.click(screen.getByRole('button', { name: 'Edit Ada' }))
    await waitFor(() => expect(screen.getByLabelText('Name')).toHaveValue('Ada'))

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Manual Ada' } })
    fireEvent.click(screen.getByRole('button', { name: 'Edit Grace' }))

    await waitFor(() => expect(screen.getByLabelText('Name')).toHaveValue('Grace'))
    expect(readRuntimeState().forms.profileForm.name.value).toBe('Grace')

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Manual Grace' } })
    fireEvent.click(screen.getByRole('button', { name: 'Stay on Grace' }))
    await waitFor(() => expect(readRuntimeState().pageEntry.params).toEqual({ mode: 'edit', userId: 'Grace' }))

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Manual Grace retained' } })
    fireEvent.click(screen.getByRole('button', { name: 'Stay on Grace reordered' }))

    expect(screen.getByLabelText('Name')).toHaveValue('Manual Grace retained')
    expect(readRuntimeState().navigation.history).toEqual([
      { entryId: 0, pageId: 'details', params: {} },
      { entryId: 1, pageId: 'details', params: { userId: 'Ada' } },
      { entryId: 2, pageId: 'details', params: { userId: 'Grace' } },
      { entryId: 3, pageId: 'details', params: { mode: 'edit', userId: 'Grace' } },
    ])
  })

  it('reenters a preload-driven page without rendering stale query text or stale query-based default values', async () => {
    let resolveAdaProfile: ((response: Response) => void) | null = null
    let resolveGraceProfile: ((response: Response) => void) | null = null
    const fetchMock = vi.fn((url: string) => {
      if (url === '/api/profile?userId=ada') {
        return new Promise<Response>((resolve) => {
          resolveAdaProfile = resolve
        })
      }

      return new Promise<Response>((resolve) => {
        resolveGraceProfile = resolve
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    renderRuntime({
      api: {
        loadProfile: {
          method: 'GET',
          endpoint: '/api/profile',
          query: {
            userId: 'params.userId',
          },
        },
      },
      initialPage: 'home',
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'button',
              props: {
                label: 'Edit Ada',
                action: {
                  type: 'navigateTo',
                  pageId: 'details',
                  params: {
                    userId: 'ada',
                  },
                },
              },
            },
            {
              type: 'button',
              props: {
                label: 'Edit Grace',
                action: {
                  type: 'navigateTo',
                  pageId: 'details',
                  params: {
                    userId: 'grace',
                  },
                },
              },
            },
          ],
        },
        {
          id: 'details',
          preloads: [{ operationName: 'loadProfile', requestParams: {} }],
          layout: [
            {
              type: 'paragraph',
              queryStateFeedback: {
                query: 'loadProfile',
                states: {
                  loading: {
                    mode: 'fallback',
                    fallback: [
                      {
                        type: 'paragraph',
                        props: {
                          text: 'Loading profile...',
                        },
                      },
                    ],
                  },
                },
              },
              props: {
                text: 'queries.loadProfile.data.name',
              },
            },
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
              type: 'button',
              props: {
                label: 'Back home',
                action: {
                  type: 'navigateTo',
                  pageId: 'home',
                },
              },
            },
          ],
        },
      ],
    })

    fireEvent.click(screen.getByRole('button', { name: 'Edit Ada' }))
    resolveAdaProfile?.(createJsonResponse({ name: 'Ada' }))
    await waitFor(() => expect(readRuntimeState().pageEntry.status).toBe('success'))
    expect(screen.getByText('Ada')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Ada')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Back home' }))
    await waitFor(() => expect(screen.getByTestId('runtime-page')).toHaveAttribute('data-runtime-page-id', 'home'))

    fireEvent.click(screen.getByRole('button', { name: 'Edit Grace' }))

    await waitFor(() => expect(readRuntimeState().pageEntry.status).toBe('loading'))
    expect(screen.getByText('Loading profile...')).toBeInTheDocument()
    expect(screen.queryByText('Ada')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Name')).not.toBeInTheDocument()

    resolveGraceProfile?.(createJsonResponse({ name: 'Grace' }))
    await waitFor(() => expect(readRuntimeState().pageEntry.status).toBe('success'))
    expect(screen.getByText('Grace')).toBeInTheDocument()
  })

  it('reenters a preload-driven edit form without reusing the previous query default value', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(createJsonResponse({ name: 'Ada' }))
      .mockResolvedValueOnce(createJsonResponse({ name: 'Grace' }))
    vi.stubGlobal('fetch', fetchMock)

    renderRuntime({
      api: {
        loadProfile: {
          method: 'GET',
          endpoint: '/api/profile',
          query: {
            userId: 'params.userId',
          },
        },
      },
      initialPage: 'home',
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'button',
              props: {
                label: 'Edit Ada',
                action: {
                  type: 'navigateTo',
                  pageId: 'details',
                  params: {
                    userId: 'ada',
                  },
                },
              },
            },
            {
              type: 'button',
              props: {
                label: 'Edit Grace',
                action: {
                  type: 'navigateTo',
                  pageId: 'details',
                  params: {
                    userId: 'grace',
                  },
                },
              },
            },
          ],
        },
        {
          id: 'details',
          preloads: [{ operationName: 'loadProfile', requestParams: {} }],
          layout: [
            {
              type: 'form',
              id: 'profileForm',
              children: [
                {
                  type: 'input',
                  props: {
                    fieldId: 'name',
                    label: 'Name',
                    defaultValue: 'queries.loadProfile.data.name',
                  },
                },
              ],
            },
            {
              type: 'button',
              props: {
                label: 'Back home',
                action: {
                  type: 'navigateTo',
                  pageId: 'home',
                },
              },
            },
          ],
        },
      ],
    })

    fireEvent.click(screen.getByRole('button', { name: 'Edit Ada' }))
    await waitFor(() => expect(readRuntimeState().pageEntry.status).toBe('success'))
    await waitFor(() => expect(screen.getByLabelText('Name')).toHaveValue('Ada'))

    fireEvent.click(screen.getByRole('button', { name: 'Back home' }))
    await waitFor(() => expect(screen.getByTestId('runtime-page')).toHaveAttribute('data-runtime-page-id', 'home'))

    fireEvent.click(screen.getByRole('button', { name: 'Edit Grace' }))
    await waitFor(() => expect(readRuntimeState().pageEntry.status).toBe('success'))
    await waitFor(() => expect(screen.getByLabelText('Name')).toHaveValue('Grace'))

    expect(screen.getByLabelText('Name')).not.toHaveValue('Ada')
  })

  it('executes a declared operation from a rendered button and stores the result in queries', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      createJsonResponse({
        results: ['Ada', 'Grace'],
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    renderRuntimeWithStateSeed(executeOperationButtonConfig)

    fireEvent.click(screen.getByRole('button', { name: 'Seed prior query success' }))
    fireEvent.click(screen.getByRole('button', { name: 'Search users' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      method: 'POST',
      headers: {
        accept: 'application/json',
        authorization: 'Ada',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        source: 'button',
        profile: {
          nickname: 'Ada',
        },
      }),
    })
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/users?search=Ada&page=2')

    await waitFor(() =>
      expect(readRuntimeState()).toMatchObject({
        queries: {
          searchUsers: {
            status: 'success',
            data: {
              results: ['Ada', 'Grace'],
            },
            error: null,
          },
        },
      }),
    )
  })

  it('keeps partial template strings literal in button executeOperation query and body, but interpolates {{...}} in headers', async () => {
    const fetchMock = vi.fn().mockResolvedValue(createJsonResponse({ ok: true }))
    vi.stubGlobal('fetch', fetchMock)

    renderRuntimeWithStateSeed({
      api: {
        searchUsers: {
          method: 'POST',
          endpoint: '/api/users',
        },
      },
      initialPage: 'home',
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'button',
              props: {
                label: 'Search literal templates',
                action: {
                  type: 'executeOperation',
                  operationName: 'searchUsers',
                  query: {
                    search: 'prefix-{{forms.userSearch.name}}',
                  },
                  headers: {
                    authorization: 'Bearer {{forms.userSearch.name}}',
                  },
                  body: {
                    name: 'prefix-{{forms.userSearch.name}}',
                  },
                },
              },
            },
          ],
        },
      ],
    })

    fireEvent.click(screen.getByRole('button', { name: 'Search literal templates' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    // query: {{...}} is treated as literal (no interpolation in query surface)
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/users?search=prefix-%7B%7Bforms.userSearch.name%7D%7D')
    // headers: {{...}} IS interpolated — "Bearer {{forms.userSearch.name}}" resolves to "Bearer Ada"
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      method: 'POST',
      headers: {
        authorization: 'Bearer Ada',
        'content-type': 'application/json',
      },
    })
    // body: {{...}} is treated as literal (no interpolation in body surface)
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      name: 'prefix-{{forms.userSearch.name}}',
    })
  })

  it('keeps the last successful query data while a button-triggered executeOperation reload is in flight', async () => {
    let resolveFetch: ((response: Response) => void) | null = null
    const fetchMock = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve
        }),
    )
    vi.stubGlobal('fetch', fetchMock)

    renderRuntimeWithStateSeed(executeOperationButtonConfig)

    fireEvent.click(screen.getByRole('button', { name: 'Seed prior query success' }))
    fireEvent.click(screen.getByRole('button', { name: 'Search users' }))

    expect(readRuntimeState()).toMatchObject({
      queries: {
        searchUsers: {
          status: 'loading',
          data: ['Ada'],
          error: null,
        },
      },
    })

    if (resolveFetch) {
      resolveFetch(
        createJsonResponse({
          results: ['Ada', 'Grace'],
        }),
      )
    }

    await waitFor(() =>
      expect(readRuntimeState()).toMatchObject({
        queries: {
          searchUsers: {
            status: 'success',
            data: {
              results: ['Ada', 'Grace'],
            },
            error: null,
          },
        },
      }),
    )
  })

  it('submits a form through an implicit submit button nested inside a container descendant', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      createJsonResponse({
        results: ['Grace'],
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    renderRuntime({
      api: {
        submitProfile: {
          method: 'POST',
          endpoint: '/api/profile',
          query: {
            mode: 'save',
          },
          headers: {
            accept: 'application/json',
          },
          body: {
            source: 'form',
          },
        },
      },
      initialPage: 'home',
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'form',
              id: 'profileForm',
              submitAction: {
                type: 'executeOperation',
                operationName: 'submitProfile',
                query: {
                  name: 'forms.profileForm.name',
                },
                headers: {
                  authorization: 'forms.profileForm.name',
                },
                body: {
                  name: 'forms.profileForm.name',
                },
              },
              children: [
                {
                  type: 'container',
                  children: [
                    {
                      type: 'input',
                      props: {
                        fieldId: 'name',
                        label: 'Name',
                        defaultValue: 'Ada',
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
              ],
            },
          ],
        },
      ],
    })

    expect(screen.getByRole('button', { name: 'Submit profile' })).toHaveClass(
      'bg-blue-600',
      'text-white',
      'border-blue-600',
    )
    expect(screen.getByRole('button', { name: 'Submit profile' }).closest('[data-layout-node="container"]')).toHaveClass(
      'flex',
      'w-full',
      'flex-col',
      'flex-nowrap',
      'gap-5',
    )
    expect(
      screen.getByRole('button', { name: 'Submit profile' }).closest('[data-layout-node="container"]'),
    ).not.toHaveClass('border-t', 'pt-5', '-mx-5', 'sm:-mx-6')

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Grace' } })
    fireEvent.click(screen.getByRole('button', { name: 'Submit profile' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/profile?mode=save&name=Grace')
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      method: 'POST',
      headers: {
        accept: 'application/json',
        authorization: 'Grace',
        'content-type': 'application/json',
      },
    })
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      name: 'Grace',
      source: 'form',
    })
    await waitFor(() =>
      expect(readRuntimeState()).toMatchObject({
        queries: {
          submitProfile: {
            status: 'success',
            data: {
              results: ['Grace'],
            },
            error: null,
          },
        },
      }),
    )
  })

  it('keeps explicit auxiliary buttons inside a form from triggering implicit submit', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    renderRuntime({
      api: {
        submitProfile: {
          method: 'POST',
          endpoint: '/api/profile',
          body: {
            name: 'forms.profileForm.name',
          },
        },
      },
      initialPage: 'home',
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'form',
              id: 'profileForm',
              submitAction: {
                type: 'executeOperation',
                operationName: 'submitProfile',
              },
              children: [
                {
                  type: 'input',
                  props: {
                    fieldId: 'name',
                    label: 'Name',
                    defaultValue: 'Ada',
                  },
                },
                {
                  type: 'button',
                  props: {
                    label: 'Open details',
                    action: {
                      type: 'navigateTo',
                      pageId: 'details',
                    },
                  },
                },
              ],
            },
          ],
        },
        {
          id: 'details',
          layout: [],
        },
      ],
    })

    expect(screen.getByRole('button', { name: 'Open details' })).toHaveClass(
      'bg-blue-600',
      'text-white',
      'border-blue-600',
    )

    fireEvent.click(screen.getByRole('button', { name: 'Open details' }))

    await waitFor(() => expect(screen.getByTestId('runtime-page')).toHaveAttribute('data-runtime-page-id', 'details'))
    expect(fetchMock).not.toHaveBeenCalled()
    expect(readRuntimeState().queries.submitProfile).toBeUndefined()
  })

  it('resolves repeater navigateTo params from the current item and omits non-scalar params', async () => {
    renderRuntimeWithRepeaterSeed(repeaterNavigationConfig)

    fireEvent.click(screen.getByRole('button', { name: 'Seed repeater posts' }))
    fireEvent.click(screen.getAllByRole('button', { name: 'Open post' })[1]!)

    await waitFor(() => expect(screen.getByTestId('runtime-page')).toHaveAttribute('data-runtime-page-id', 'details'))

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('goodbye-world')
    expect(screen.getByText('preview')).toBeInTheDocument()
    expect(readRuntimeState().navigation.history).toEqual([
      { entryId: 0, pageId: 'home', params: {} },
      { entryId: 1, pageId: 'details', params: { slug: 'goodbye-world', mode: 'preview' } },
    ])
  })

  it('executes repeater button operations with query, body, and headers resolved from the current item', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      createJsonResponse({
        ok: true,
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    renderRuntimeWithRepeaterSeed(repeaterNavigationConfig)

    fireEvent.click(screen.getByRole('button', { name: 'Seed repeater posts' }))
    fireEvent.click(screen.getAllByRole('button', { name: 'Load post' })[0]!)

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/posts/load?slug=hello-world')
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      method: 'POST',
      headers: {
        authorization: 'token-1',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        id: 'post-1',
        mode: 'read',
      }),
    })
  })

})
