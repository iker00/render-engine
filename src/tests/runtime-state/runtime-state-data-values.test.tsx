import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RuntimeConfig } from '../../config/runtime-config'
import { createRuntimeState } from '../../runtime/runtime-state/runtime-state-reducer'
import { RuntimeStateProvider } from '../../runtime/runtime-state/runtime-state-provider'
import { useRuntimeState, useRuntimeStateActions } from '../../runtime/runtime-state/use-runtime-state'
import { RuntimePage } from '../../runtime/runtime-page'
import type { RuntimeState } from '../../runtime/runtime-state/runtime-state-types'

afterEach(() => {
  window.history.replaceState(null, '', window.location.pathname + window.location.search)
})

function RuntimeStateSnapshot({ testId }: { testId: string }) {
  const state = useRuntimeState()
  return <pre data-testid={testId}>{JSON.stringify(state)}</pre>
}

function readRuntimeStateSnapshot(testId: string) {
  return JSON.parse(screen.getByTestId(testId).textContent ?? '') as RuntimeState
}

const baseConfig: RuntimeConfig = {
  api: {},
  initialPage: 'home',
  pages: [
    {
      id: 'home',
      layout: [],
    },
  ],
}

const apiConfig: RuntimeConfig = {
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
  },
  initialPage: 'home',
  pages: [
    {
      id: 'home',
      layout: [],
    },
    {
      id: 'details',
      preloads: [{ operationName: 'searchUsers', requestParams: {} }],
      layout: [],
    },
  ],
}

const listConfig: RuntimeConfig = {
  api: {},
  initialPage: 'home',
  pages: [
    {
      id: 'home',
      layout: [
        {
          type: 'repeater',
          props: {
            items: {
              source: 'queries.searchUsers.data',
              key: 'id',
            },
            template: [
              {
                type: 'paragraph',
                props: {
                  text: 'item.name',
                },
              },
            ],
          },
        },
      ],
    },
  ],
}

describe('RuntimeStateProvider with dataValues pre-seeding', () => {
  it('pre-seeds queries with status success when dataValues is provided', () => {
    render(
      <RuntimeStateProvider
        config={baseConfig}
        dataValues={{ searchUsers: [{ id: '1', name: 'Juan' }] }}
      >
        <RuntimeStateSnapshot testId="runtime-state" />
      </RuntimeStateProvider>,
    )

    const state = readRuntimeStateSnapshot('runtime-state')
    expect(state.queries.searchUsers).toEqual({
      status: 'success',
      data: [{ id: '1', name: 'Juan' }],
      error: null,
      requestSignature: null,
    })
  })

  it('keeps queries empty when no dataValues prop is provided (regression)', () => {
    render(
      <RuntimeStateProvider config={baseConfig}>
        <RuntimeStateSnapshot testId="runtime-state" />
      </RuntimeStateProvider>,
    )

    const state = readRuntimeStateSnapshot('runtime-state')
    expect(state.queries).toEqual({})
  })

  it('keeps queries empty when dataValues is an empty object', () => {
    render(
      <RuntimeStateProvider config={baseConfig} dataValues={{}}>
        <RuntimeStateSnapshot testId="runtime-state" />
      </RuntimeStateProvider>,
    )

    const state = readRuntimeStateSnapshot('runtime-state')
    expect(state.queries).toEqual({})
  })

  it('pre-seeds a query with null data when entry value is null', () => {
    render(
      <RuntimeStateProvider config={baseConfig} dataValues={{ a: null }}>
        <RuntimeStateSnapshot testId="runtime-state" />
      </RuntimeStateProvider>,
    )

    const state = readRuntimeStateSnapshot('runtime-state')
    expect(state.queries.a).toEqual({
      status: 'success',
      data: null,
      error: null,
      requestSignature: null,
    })
  })

  it('pre-seeds a query with a string primitive value', () => {
    render(
      <RuntimeStateProvider config={baseConfig} dataValues={{ greeting: 'hello' }}>
        <RuntimeStateSnapshot testId="runtime-state" />
      </RuntimeStateProvider>,
    )

    const state = readRuntimeStateSnapshot('runtime-state')
    expect(state.queries.greeting).toEqual({
      status: 'success',
      data: 'hello',
      error: null,
      requestSignature: null,
    })
  })

  it('pre-seeds a query with a number primitive value', () => {
    render(
      <RuntimeStateProvider config={baseConfig} dataValues={{ count: 42 }}>
        <RuntimeStateSnapshot testId="runtime-state" />
      </RuntimeStateProvider>,
    )

    const state = readRuntimeStateSnapshot('runtime-state')
    expect(state.queries.count).toEqual({
      status: 'success',
      data: 42,
      error: null,
      requestSignature: null,
    })
  })

  it('pre-seeds a query with a boolean primitive value', () => {
    render(
      <RuntimeStateProvider config={baseConfig} dataValues={{ flag: true }}>
        <RuntimeStateSnapshot testId="runtime-state" />
      </RuntimeStateProvider>,
    )

    const state = readRuntimeStateSnapshot('runtime-state')
    expect(state.queries.flag).toEqual({
      status: 'success',
      data: true,
      error: null,
      requestSignature: null,
    })
  })

  it('pre-seeds multiple entries mixing object, array, primitive and null', () => {
    render(
      <RuntimeStateProvider
        config={baseConfig}
        dataValues={{
          objQuery: { foo: 'bar' },
          arrQuery: [1, 2, 3],
          strQuery: 'text',
          nullQuery: null,
        }}
      >
        <RuntimeStateSnapshot testId="runtime-state" />
      </RuntimeStateProvider>,
    )

    const state = readRuntimeStateSnapshot('runtime-state')
    expect(state.queries.objQuery).toEqual({ status: 'success', data: { foo: 'bar' }, error: null, requestSignature: null })
    expect(state.queries.arrQuery).toEqual({ status: 'success', data: [1, 2, 3], error: null, requestSignature: null })
    expect(state.queries.strQuery).toEqual({ status: 'success', data: 'text', error: null, requestSignature: null })
    expect(state.queries.nullQuery).toEqual({ status: 'success', data: null, error: null, requestSignature: null })
  })

  it('pre-seeds a query whose name does not exist in config.api', () => {
    render(
      <RuntimeStateProvider config={baseConfig} dataValues={{ unknownOp: { result: true } }}>
        <RuntimeStateSnapshot testId="runtime-state" />
      </RuntimeStateProvider>,
    )

    const state = readRuntimeStateSnapshot('runtime-state')
    expect(state.queries.unknownOp).toEqual({
      status: 'success',
      data: { result: true },
      error: null,
      requestSignature: null,
    })
  })

  it('overwrites pre-seeded data after executeQueryOperation transitions loading and then success', async () => {
    function QueryExecuteFixture({ fetchMock }: { fetchMock: typeof fetch }) {
      const { executeQueryOperation } = useRuntimeStateActions()

      return (
        <>
          <button
            type="button"
            onClick={() => void executeQueryOperation('searchUsers', { fetch: fetchMock })}
          >
            Execute operation
          </button>
          <RuntimeStateSnapshot testId="runtime-state" />
        </>
      )
    }

    render(
      <RuntimeStateProvider
        config={apiConfig}
        dataValues={{ searchUsers: [{ id: '1', name: 'Juan' }] }}
      >
        <QueryExecuteFixture
          fetchMock={vi.fn().mockResolvedValue(
            new Response(JSON.stringify([{ id: '2', name: 'Grace' }]), {
              status: 200,
              headers: { 'content-type': 'application/json' },
            }),
          )}
        />
      </RuntimeStateProvider>,
    )

    // Confirm pre-seeded state is present before executing
    expect(readRuntimeStateSnapshot('runtime-state').queries.searchUsers).toEqual({
      status: 'success',
      data: [{ id: '1', name: 'Juan' }],
      error: null,
      requestSignature: null,
    })

    fireEvent.click(screen.getByRole('button', { name: 'Execute operation' }))

    // Should transition to loading
    expect(readRuntimeStateSnapshot('runtime-state').queries.searchUsers.status).toBe('loading')

    // And eventually to success with real data
    await waitFor(() =>
      expect(readRuntimeStateSnapshot('runtime-state').queries.searchUsers).toMatchObject({
        status: 'success',
        data: [{ id: '2', name: 'Grace' }],
        error: null,
      }),
    )
  })

  it('resets pre-seeded query to loading when navigating to a page whose preloads include that query', async () => {
    function NavigateFixture() {
      const { navigateToPage } = useRuntimeStateActions()
      return (
        <>
          <button type="button" onClick={() => navigateToPage('details')}>
            Go to details
          </button>
          <RuntimeStateSnapshot testId="runtime-state" />
        </>
      )
    }

    render(
      <RuntimeStateProvider
        config={preloadConfig}
        dataValues={{ searchUsers: [{ id: '1', name: 'Juan' }] }}
      >
        <NavigateFixture />
      </RuntimeStateProvider>,
    )

    // Confirm pre-seeded state on initial page (no preloads on home)
    expect(readRuntimeStateSnapshot('runtime-state').queries.searchUsers).toEqual({
      status: 'success',
      data: [{ id: '1', name: 'Juan' }],
      error: null,
      requestSignature: null,
    })

    fireEvent.click(screen.getByRole('button', { name: 'Go to details' }))

    // After navigating to a page with preloads, the query should be reset to loading
    await waitFor(() =>
      expect(readRuntimeStateSnapshot('runtime-state').queries.searchUsers.status).toBe('loading'),
    )
  })

  it('renders pre-seeded query data in layout from the first render without any fetch', () => {
    render(
      <RuntimeStateProvider
        config={listConfig}
        dataValues={{ searchUsers: [{ id: '1', name: 'Juan' }, { id: '2', name: 'Grace' }] }}
      >
        <RuntimePage />
      </RuntimeStateProvider>,
    )

    expect(screen.getByText('Juan')).toBeInTheDocument()
    expect(screen.getByText('Grace')).toBeInTheDocument()
  })

  it('createRuntimeState without second param and with empty dataValues produce structurally equivalent states', () => {
    const stateA = createRuntimeState(baseConfig)
    const stateB = createRuntimeState(baseConfig, { dataValues: {} })

    expect(JSON.stringify(stateA)).toBe(JSON.stringify(stateB))
  })
})
