import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useEffect } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RuntimeConfig } from '../../config/runtime-config'
import type { RuntimeState } from '../../runtime/runtime-state/runtime-state-types'
import {
  RuntimeStateProvider,
  useRuntimeState,
  useRuntimeStateActions,
} from '../../runtime/runtime-state/runtime-state-provider'
import { RuntimePage } from '../../runtime/runtime-page'

afterEach(() => {
  window.history.replaceState(null, '', window.location.pathname + window.location.search)
})

const runtimeConfig: RuntimeConfig = {
  api: {},
  initialPage: 'home',
  pages: [
    {
      id: 'home',
      layout: [],
    },
    {
      id: 'details',
      layout: [],
    },
  ],
}

const runtimeApiConfig: RuntimeConfig = {
  api: {
    searchUsers: {
      method: 'GET',
      endpoint: '/api/users',
      query: {
        search: 'forms.userSearch.name',
      },
    },
    invalidSearch: {
      method: 'GET',
      endpoint: '/api/users',
      query: {
        search: 'forms.userSearch.missingField',
      },
    },
    clearUsers: {
      method: 'DELETE',
      endpoint: '/api/users',
    },
  },
  initialPage: 'home',
  pages: runtimeConfig.pages,
}

function RuntimeStateSnapshot({ testId }: { testId: string }) {
  const state = useRuntimeState()

  return <pre data-testid={testId}>{JSON.stringify(state)}</pre>
}

function readRuntimeStateSnapshot(testId: string) {
  return JSON.parse(screen.getByTestId(testId).textContent ?? '') as RuntimeState
}

function RuntimeInstanceFixture({ name, initialPage }: { name: string; initialPage: 'home' | 'details' }) {
  const { initializeForm, initializeQuery, navigateToPage, setFormFieldValue, setQuerySuccess } =
    useRuntimeStateActions()

  useEffect(() => {
    initializeForm('userSearch', {
      name: {
        defaultValue: initialPage,
      },
    })
    initializeQuery('searchUsers')
  }, [initializeForm, initializeQuery, initialPage])

  return (
    <>
      <button type="button" onClick={() => navigateToPage(initialPage === 'home' ? 'details' : 'home')}>
        {name} navigate
      </button>
      <button type="button" onClick={() => setFormFieldValue('userSearch', 'name', `${name}-value`)}>
        {name} set form value
      </button>
      <button type="button" onClick={() => setQuerySuccess('searchUsers', [`${name}-query`])}>
        {name} set query success
      </button>
      <RuntimeStateSnapshot testId={`${name}-state`} />
      <RuntimePage />
    </>
  )
}

function QueryOperationFixture({
  operationName,
  fetchMock,
}: {
  operationName: string
  fetchMock?: typeof fetch
}) {
  const { executeQueryOperation, initializeForm, initializeQuery, setQuerySuccess } = useRuntimeStateActions()

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
      <button type="button" onClick={() => void executeQueryOperation(operationName, { fetch: fetchMock })}>
        Execute operation
      </button>
      <RuntimeStateSnapshot testId="runtime-state" />
    </>
  )
}

describe('Runtime shared state store', () => {
  it('executes a declared operation by name and stores the successful result in queries', async () => {
    render(
      <RuntimeStateProvider config={runtimeApiConfig}>
        <QueryOperationFixture
          operationName="searchUsers"
          fetchMock={vi.fn().mockResolvedValue(
            new Response(JSON.stringify({ results: ['Ada', 'Grace'] }), {
              status: 200,
              headers: {
                'content-type': 'application/json',
              },
            }),
          )}
        />
      </RuntimeStateProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Execute operation' }))

    await waitFor(() =>
      expect(readRuntimeStateSnapshot('runtime-state').queries.searchUsers).toMatchObject({
        status: 'success',
        data: { results: ['Ada', 'Grace'] },
        error: null,
      }),
    )
    expect(readRuntimeStateSnapshot('runtime-state').queries.searchUsers.requestSignature).toBe(
      '{"endpoint":"/api/users","method":"GET","operationName":"searchUsers","query":{"search":"Ada"}}',
    )
  })

  it('keeps the last successful data while the operation reload is in flight', async () => {
    let resolveFetch: ((response: Response) => void) | null = null
    const fetchMock = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve
        }),
    )

    render(
      <RuntimeStateProvider config={runtimeApiConfig}>
        <QueryOperationFixture operationName="searchUsers" fetchMock={fetchMock} />
      </RuntimeStateProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Seed prior query success' }))
    fireEvent.click(screen.getByRole('button', { name: 'Execute operation' }))

    expect(readRuntimeStateSnapshot('runtime-state').queries.searchUsers).toMatchObject({
      status: 'loading',
      data: ['Ada'],
      error: null,
    })
    expect(readRuntimeStateSnapshot('runtime-state').queries.searchUsers.requestSignature).toBe(
      '{"endpoint":"/api/users","method":"GET","operationName":"searchUsers","query":{"search":"Ada"}}',
    )

    if (resolveFetch) {
      resolveFetch(
        new Response(JSON.stringify({ results: ['Ada', 'Grace'] }), {
          status: 200,
          headers: {
            'content-type': 'application/json',
          },
        }),
      )
    }

    await waitFor(() =>
      expect(readRuntimeStateSnapshot('runtime-state').queries.searchUsers).toMatchObject({
        status: 'success',
        data: { results: ['Ada', 'Grace'] },
        error: null,
      }),
    )
  })

  it('clears data to null when an operation transitions to http-error after having successful data', async () => {
    render(
      <RuntimeStateProvider config={runtimeApiConfig}>
        <QueryOperationFixture
          operationName="searchUsers"
          fetchMock={vi.fn().mockResolvedValue(
            new Response(JSON.stringify({ message: 'Boom' }), {
              status: 500,
              headers: {
                'content-type': 'application/json',
              },
            }),
          )}
        />
      </RuntimeStateProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Seed prior query success' }))
    fireEvent.click(screen.getByRole('button', { name: 'Execute operation' }))

    await waitFor(() =>
      expect(readRuntimeStateSnapshot('runtime-state').queries.searchUsers).toMatchObject({
        status: 'error',
        data: null,
        error: {
          code: 'http-error',
          message: 'The api operation "searchUsers" failed with HTTP status 500.',
        },
      }),
    )
    expect(readRuntimeStateSnapshot('runtime-state').queries.searchUsers.requestSignature).toBe(
      '{"endpoint":"/api/users","method":"GET","operationName":"searchUsers","query":{"search":"Ada"}}',
    )
  })

  it('stores an operation-not-found error without calling fetch', async () => {
    const fetchMock = vi.fn()

    render(
      <RuntimeStateProvider config={runtimeApiConfig}>
        <QueryOperationFixture operationName="missingOperation" fetchMock={fetchMock} />
      </RuntimeStateProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Execute operation' }))

    await waitFor(() =>
      expect(readRuntimeStateSnapshot('runtime-state').queries.missingOperation).toEqual({
        status: 'error',
        data: null,
        error: {
          code: 'operation-not-found',
          message: 'The api operation "missingOperation" does not exist.',
        },
        requestSignature: null,
      }),
    )

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('stores a request-build-failed error without calling fetch when references are not resolvable', async () => {
    const fetchMock = vi.fn()

    render(
      <RuntimeStateProvider config={runtimeApiConfig}>
        <QueryOperationFixture operationName="invalidSearch" fetchMock={fetchMock} />
      </RuntimeStateProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Execute operation' }))

    await waitFor(() =>
      expect(readRuntimeStateSnapshot('runtime-state').queries.invalidSearch).toEqual({
        status: 'error',
        data: null,
        error: {
          code: 'request-build-failed',
          message: 'The api operation "invalidSearch" could not resolve "forms.userSearch.missingField" for "query.search".',
        },
        requestSignature: null,
      }),
    )

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('stores data null in queries when an operation succeeds with an empty response body', async () => {
    render(
      <RuntimeStateProvider config={runtimeApiConfig}>
        <QueryOperationFixture
          operationName="clearUsers"
          fetchMock={vi.fn().mockResolvedValue(
            new Response(null, {
              status: 204,
            }),
          )}
        />
      </RuntimeStateProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Execute operation' }))

    await waitFor(() =>
      expect(readRuntimeStateSnapshot('runtime-state').queries.clearUsers).toMatchObject({
        status: 'success',
        data: null,
        error: null,
      }),
    )
    expect(readRuntimeStateSnapshot('runtime-state').queries.clearUsers.requestSignature).toBe(
      '{"endpoint":"/api/users","method":"DELETE","operationName":"clearUsers"}',
    )
  })

  it('clears data to null when an operation fails with network-error after having successful data', async () => {
    render(
      <RuntimeStateProvider config={runtimeApiConfig}>
        <QueryOperationFixture
          operationName="searchUsers"
          fetchMock={vi.fn().mockRejectedValue(new Error('socket hang up'))}
        />
      </RuntimeStateProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Seed prior query success' }))
    fireEvent.click(screen.getByRole('button', { name: 'Execute operation' }))

    await waitFor(() =>
      expect(readRuntimeStateSnapshot('runtime-state').queries.searchUsers).toMatchObject({
        status: 'error',
        data: null,
        error: {
          code: 'network-error',
        },
      }),
    )
  })

  it('clears data to null when an operation fails with invalid-json-response after having successful data', async () => {
    render(
      <RuntimeStateProvider config={runtimeApiConfig}>
        <QueryOperationFixture
          operationName="searchUsers"
          fetchMock={vi.fn().mockResolvedValue(
            new Response('{"broken"', {
              status: 200,
              headers: {
                'content-type': 'application/json',
              },
            }),
          )}
        />
      </RuntimeStateProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Seed prior query success' }))
    fireEvent.click(screen.getByRole('button', { name: 'Execute operation' }))

    await waitFor(() =>
      expect(readRuntimeStateSnapshot('runtime-state').queries.searchUsers).toMatchObject({
        status: 'error',
        data: null,
        error: {
          code: 'invalid-json-response',
        },
      }),
    )
  })

  it('clears data to null when an operation fails with operation-not-found after having successful data', async () => {
    render(
      <RuntimeStateProvider config={runtimeApiConfig}>
        <QueryOperationFixture operationName="missingOperation" fetchMock={vi.fn()} />
      </RuntimeStateProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Execute operation' }))

    await waitFor(() =>
      expect(readRuntimeStateSnapshot('runtime-state').queries.missingOperation).toMatchObject({
        status: 'error',
        data: null,
        error: {
          code: 'operation-not-found',
        },
      }),
    )
  })

  it('clears data to null when an operation fails with request-build-failed after having successful data', async () => {
    render(
      <RuntimeStateProvider config={runtimeApiConfig}>
        <QueryOperationFixture operationName="invalidSearch" fetchMock={vi.fn()} />
      </RuntimeStateProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Execute operation' }))

    await waitFor(() =>
      expect(readRuntimeStateSnapshot('runtime-state').queries.invalidSearch).toMatchObject({
        status: 'error',
        data: null,
        error: {
          code: 'request-build-failed',
        },
      }),
    )
  })

  it('keeps navigation, forms and queries isolated across multiple runtime instances', async () => {
    render(
      <>
        <RuntimeStateProvider config={runtimeConfig}>
          <RuntimeInstanceFixture name="first" initialPage="home" />
        </RuntimeStateProvider>
        <RuntimeStateProvider
          config={{
            ...runtimeConfig,
            initialPage: 'details',
          }}
        >
          <RuntimeInstanceFixture name="second" initialPage="details" />
        </RuntimeStateProvider>
      </>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'first navigate' }))
    fireEvent.click(screen.getByRole('button', { name: 'first set form value' }))
    fireEvent.click(screen.getByRole('button', { name: 'first set query success' }))

    await waitFor(() => expect(screen.getByTestId('first-state')).toHaveTextContent('"currentPageId":"details"'))
    expect(screen.getByTestId('first-state')).toHaveTextContent('"value":"first-value"')
    expect(screen.getByTestId('first-state')).toHaveTextContent('"data":["first-query"]')

    expect(screen.getByTestId('second-state')).toHaveTextContent('"currentPageId":"details"')
    expect(screen.getByTestId('second-state')).toHaveTextContent('"value":"details"')
    expect(screen.getByTestId('second-state')).toHaveTextContent('"status":"idle","data":null,"error":null')
  })

  it('creates a clean shared state when the runtime unmounts and mounts again', async () => {
    const { unmount } = render(
      <RuntimeStateProvider config={runtimeConfig}>
        <RuntimeInstanceFixture name="single" initialPage="home" />
      </RuntimeStateProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'single navigate' }))
    fireEvent.click(screen.getByRole('button', { name: 'single set form value' }))
    fireEvent.click(screen.getByRole('button', { name: 'single set query success' }))

    await waitFor(() => expect(screen.getByTestId('single-state')).toHaveTextContent('"currentPageId":"details"'))
    expect(screen.getByTestId('single-state')).toHaveTextContent('"value":"single-value"')
    expect(screen.getByTestId('single-state')).toHaveTextContent('"data":["single-query"]')

    unmount()
    window.history.replaceState(null, '', window.location.pathname + window.location.search)

    render(
      <RuntimeStateProvider config={runtimeConfig}>
        <RuntimeInstanceFixture name="single-remount" initialPage="home" />
      </RuntimeStateProvider>,
    )

    expect(screen.getByTestId('single-remount-state')).toHaveTextContent('"currentPageId":"home"')
    expect(screen.getByTestId('single-remount-state')).toHaveTextContent('"value":"home"')
    expect(screen.getByTestId('single-remount-state')).toHaveTextContent('"status":"idle","data":null,"error":null')
  })
})
