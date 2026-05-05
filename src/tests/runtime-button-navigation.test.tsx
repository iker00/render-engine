import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useEffect } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { RuntimeConfig } from '../config/runtime-config'
import { RuntimePage } from '../runtime/runtime-page'
import {
  RuntimeStateProvider,
  useRuntimeState,
  useRuntimeStateActions,
} from '../runtime/runtime-state/runtime-state-provider'
import type { RuntimeState } from '../runtime/runtime-state/runtime-state-types'

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
      preloads: ['loadHome'],
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
      preloads: ['loadDetails'],
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

    expect(readRuntimeState().navigation.history).toEqual(['home', 'details'])
  })

  it('keeps the current page and does not duplicate history when navigateTo targets the visible page', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(createJsonResponse({ home: true }))
    vi.stubGlobal('fetch', fetchMock)

    renderRuntime()

    await waitFor(() => expect(readRuntimeState().pageEntry.status).toBe('success'))

    fireEvent.click(screen.getByRole('button', { name: 'Stay here' }))

    expect(screen.getByTestId('runtime-page')).toHaveAttribute('data-runtime-page-id', 'home')
    expect(readRuntimeState().navigation.history).toEqual(['home'])
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('goes back to the previous valid page when a goBack button is clicked', async () => {
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

    fireEvent.click(screen.getByRole('button', { name: 'Back home' }))

    await waitFor(() => expect(screen.getByTestId('runtime-page')).toHaveAttribute('data-runtime-page-id', 'home'))
    await waitFor(() => expect(readRuntimeState().pageEntry.status).toBe('success'))

    expect(readRuntimeState().navigation.history).toEqual(['home'])
    expect(fetchMock).toHaveBeenCalledTimes(3)
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

    expect(readRuntimeState().navigation.history).toEqual(['home', 'details', 'home'])
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

    fireEvent.click(screen.getByRole('button', { name: 'Open details' }))

    await waitFor(() => expect(screen.getByTestId('runtime-page')).toHaveAttribute('data-runtime-page-id', 'details'))
    expect(fetchMock).not.toHaveBeenCalled()
    expect(readRuntimeState().queries.submitProfile).toBeUndefined()
  })
})
