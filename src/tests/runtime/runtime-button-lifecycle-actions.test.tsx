import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RuntimeConfig } from '../../config/runtime-config'
import { RuntimePage } from '../../runtime/runtime-page'
import { RuntimeStateProvider } from '../../runtime/runtime-state/runtime-state-provider'
import { useRuntimeStateActions } from '../../runtime/runtime-state/use-runtime-state'
import { RuntimeStateSnapshot } from '../runtime-state/helpers'
import { readRuntimeStateSnapshot } from '../runtime-state/read-runtime-state-snapshot'
import { useEffect } from 'react'

afterEach(() => {
  vi.unstubAllGlobals()
  window.history.replaceState(null, '', window.location.pathname + window.location.search)
})

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function ButtonLifecycleFixture({ config }: { config: RuntimeConfig }) {
  return (
    <RuntimeStateProvider config={config}>
      <RuntimePage />
      <RuntimeStateSnapshot testId="runtime-state" />
    </RuntimeStateProvider>
  )
}

function ButtonLifecycleSeedInnerFixture({ seedQueryName, seedData }: { seedQueryName: string; seedData: unknown }) {
  const { initializeQuery, setQuerySuccess } = useRuntimeStateActions()

  useEffect(() => {
    initializeQuery(seedQueryName)
    setQuerySuccess(seedQueryName, seedData)
  }, [initializeQuery, setQuerySuccess, seedQueryName, seedData])

  return (
    <>
      <RuntimePage />
      <RuntimeStateSnapshot testId="runtime-state" />
    </>
  )
}

function ButtonLifecycleWithSeedFixture({ config, seedQueryName, seedData }: {
  config: RuntimeConfig
  seedQueryName: string
  seedData: unknown
}) {
  return (
    <RuntimeStateProvider config={config}>
      <ButtonLifecycleSeedInnerFixture seedQueryName={seedQueryName} seedData={seedData} />
    </RuntimeStateProvider>
  )
}

/**
 * Builds a fetch mock that resolves to a distinct response per endpoint, keyed by
 * a substring match against the request URL.
 */
function createFetchMockByEndpoint(responsesByEndpointFragment: Record<string, Response | (() => Response)>) {
  return vi.fn<typeof fetch>().mockImplementation((input) => {
    const url = String(input)
    for (const [fragment, response] of Object.entries(responsesByEndpointFragment)) {
      if (url.includes(fragment)) {
        return Promise.resolve(typeof response === 'function' ? response() : response)
      }
    }
    throw new Error(`No mock response configured for URL: ${url}`)
  })
}

describe('ButtonNode direct execution with onSuccess/onError lifecycle', () => {
  it('chains a second operation automatically after the button own operation succeeds', async () => {
    const fetchMock = createFetchMockByEndpoint({
      '/api/main': jsonResponse({ ok: true }),
      '/api/chained': jsonResponse({ ok: true }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const config: RuntimeConfig = {
      api: {
        mainOp: { method: 'POST', endpoint: '/api/main' },
        chainedOp: { method: 'POST', endpoint: '/api/chained' },
      },
      initialPage: 'home',
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'button',
              props: {
                label: 'Run',
                action: {
                  type: 'executeOperation',
                  operationName: 'mainOp',
                  onSuccess: [{ type: 'executeOperation', operationName: 'chainedOp' }],
                },
              },
            },
          ],
        },
      ],
    }

    render(<ButtonLifecycleFixture config={config} />)
    fireEvent.click(screen.getByRole('button', { name: 'Run' }))

    await waitFor(() => {
      const state = readRuntimeStateSnapshot('runtime-state')
      expect(state.queries.mainOp?.status).toBe('success')
      expect(state.queries.chainedOp?.status).toBe('success')
    })

    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('does not fire the second onSuccess executeOperation network call until the first one resolves', async () => {
    let resolveChainedOne: ((response: Response) => void) | null = null
    const fetchMock = vi.fn<typeof fetch>().mockImplementation((input) => {
      const url = String(input)
      if (url.includes('/api/main')) {
        return Promise.resolve(jsonResponse({ ok: true }))
      }
      if (url.includes('/api/chained-one')) {
        return new Promise<Response>((resolve) => {
          resolveChainedOne = resolve
        })
      }
      if (url.includes('/api/chained-two')) {
        return Promise.resolve(jsonResponse({ ok: true }))
      }
      throw new Error(`No mock response configured for URL: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    const config: RuntimeConfig = {
      api: {
        mainOp: { method: 'POST', endpoint: '/api/main' },
        chainedOneOp: { method: 'POST', endpoint: '/api/chained-one' },
        chainedTwoOp: { method: 'POST', endpoint: '/api/chained-two' },
      },
      initialPage: 'home',
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'button',
              props: {
                label: 'Run',
                action: {
                  type: 'executeOperation',
                  operationName: 'mainOp',
                  onSuccess: [
                    { type: 'executeOperation', operationName: 'chainedOneOp' },
                    { type: 'executeOperation', operationName: 'chainedTwoOp' },
                  ],
                },
              },
            },
          ],
        },
      ],
    }

    render(<ButtonLifecycleFixture config={config} />)
    fireEvent.click(screen.getByRole('button', { name: 'Run' }))

    await waitFor(() => {
      const state = readRuntimeStateSnapshot('runtime-state')
      expect(state.queries.mainOp?.status).toBe('success')
      expect(state.queries.chainedOneOp?.status).toBe('loading')
    })

    // Only the main operation and the first onSuccess entry have been dispatched so far;
    // the second entry is still waiting for the first one to resolve.
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(readRuntimeStateSnapshot('runtime-state').queries.chainedTwoOp).toBeUndefined()

    resolveChainedOne?.(jsonResponse({ ok: true }))

    await waitFor(() => {
      const state = readRuntimeStateSnapshot('runtime-state')
      expect(state.queries.chainedTwoOp?.status).toBe('success')
    })

    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('opens a modal via onError when the button own operation fails', async () => {
    const fetchMock = createFetchMockByEndpoint({
      '/api/risky': jsonResponse({ error: 'failed' }, 500),
    })
    vi.stubGlobal('fetch', fetchMock)

    const config: RuntimeConfig = {
      api: {
        riskyOp: { method: 'POST', endpoint: '/api/risky' },
      },
      initialPage: 'home',
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'button',
              props: {
                label: 'Run risky',
                action: {
                  type: 'executeOperation',
                  operationName: 'riskyOp',
                  onError: [{ type: 'openModal', modalId: 'error-modal' }],
                },
              },
            },
            {
              type: 'modal',
              id: 'error-modal',
              children: [{ type: 'heading', props: { level: 2, text: 'Something failed' } }],
            },
          ],
        },
      ],
    }

    render(<ButtonLifecycleFixture config={config} />)

    expect(screen.queryByTestId('modal-panel')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Run risky' }))

    await waitFor(() => expect(screen.getByTestId('modal-panel')).toBeInTheDocument())
    expect(screen.getByText('Something failed')).toBeInTheDocument()
  })

  it('does not open the onError modal when the button own operation succeeds', async () => {
    const fetchMock = createFetchMockByEndpoint({
      '/api/safe': jsonResponse({ ok: true }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const config: RuntimeConfig = {
      api: {
        safeOp: { method: 'POST', endpoint: '/api/safe' },
      },
      initialPage: 'home',
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'button',
              props: {
                label: 'Run safe',
                action: {
                  type: 'executeOperation',
                  operationName: 'safeOp',
                  onError: [{ type: 'openModal', modalId: 'error-modal' }],
                },
              },
            },
            {
              type: 'modal',
              id: 'error-modal',
              children: [{ type: 'heading', props: { level: 2, text: 'Something failed' } }],
            },
          ],
        },
      ],
    }

    render(<ButtonLifecycleFixture config={config} />)
    fireEvent.click(screen.getByRole('button', { name: 'Run safe' }))

    await waitFor(() => {
      const state = readRuntimeStateSnapshot('runtime-state')
      expect(state.queries.safeOp?.status).toBe('success')
    })

    expect(screen.queryByTestId('modal-panel')).not.toBeInTheDocument()
  })

  it('executes onSuccess for executeOperations only when every operation succeeds, otherwise evaluates onError', async () => {
    const fetchMock = createFetchMockByEndpoint({
      '/api/opX': jsonResponse({ ok: true }),
      '/api/opY': jsonResponse({ error: 'boom' }, 500),
    })
    vi.stubGlobal('fetch', fetchMock)

    const config: RuntimeConfig = {
      api: {
        opX: { method: 'POST', endpoint: '/api/opX' },
        opY: { method: 'POST', endpoint: '/api/opY' },
      },
      initialPage: 'home',
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'button',
              props: {
                label: 'Run both',
                action: {
                  type: 'executeOperations',
                  operations: [{ operationName: 'opX' }, { operationName: 'opY' }],
                  onSuccess: [{ type: 'navigateTo', pageId: 'success-page' }],
                  onError: [{ type: 'navigateTo', pageId: 'error-page' }],
                },
              },
            },
          ],
        },
        { id: 'success-page', layout: [] },
        { id: 'error-page', layout: [] },
      ],
    }

    render(<ButtonLifecycleFixture config={config} />)
    fireEvent.click(screen.getByRole('button', { name: 'Run both' }))

    await waitFor(() =>
      expect(screen.getByTestId('runtime-page')).toHaveAttribute('data-runtime-page-id', 'error-page'),
    )
  })

  it('skips an onSuccess entry whose when condition is not met while still evaluating the rest of the list', async () => {
    const fetchMock = createFetchMockByEndpoint({
      '/api/main': jsonResponse({ shouldNotify: false }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const config: RuntimeConfig = {
      api: {
        mainOp: { method: 'POST', endpoint: '/api/main' },
        skippedOp: { method: 'POST', endpoint: '/api/skipped' },
      },
      initialPage: 'home',
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'button',
              props: {
                label: 'Run',
                action: {
                  type: 'executeOperation',
                  operationName: 'mainOp',
                  onSuccess: [
                    {
                      type: 'executeOperation',
                      operationName: 'skippedOp',
                      when: { reference: 'queries.mainOp.data.shouldNotify', operator: 'isTruthy' },
                    },
                    { type: 'navigateTo', pageId: 'next-page' },
                  ],
                },
              },
            },
          ],
        },
        { id: 'next-page', layout: [] },
      ],
    }

    render(<ButtonLifecycleFixture config={config} />)
    fireEvent.click(screen.getByRole('button', { name: 'Run' }))

    await waitFor(() =>
      expect(screen.getByTestId('runtime-page')).toHaveAttribute('data-runtime-page-id', 'next-page'),
    )

    const state = readRuntimeStateSnapshot('runtime-state')
    expect(state.queries.skippedOp).toBeUndefined()
  })

  it('triggers onError after a business error signaled via errorCondition on a 2xx payload', async () => {
    const fetchMock = createFetchMockByEndpoint({
      '/api/business': jsonResponse({ success: false, message: 'forbidden' }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const config: RuntimeConfig = {
      api: {
        businessOp: {
          method: 'POST',
          endpoint: '/api/business',
          errorCondition: { path: 'success', equals: false },
          errorMessagePath: 'message',
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
                label: 'Run business',
                action: {
                  type: 'executeOperation',
                  operationName: 'businessOp',
                  onError: [{ type: 'navigateTo', pageId: 'business-error-page' }],
                },
              },
            },
          ],
        },
        { id: 'business-error-page', layout: [] },
      ],
    }

    render(<ButtonLifecycleFixture config={config} />)
    fireEvent.click(screen.getByRole('button', { name: 'Run business' }))

    await waitFor(() =>
      expect(screen.getByTestId('runtime-page')).toHaveAttribute('data-runtime-page-id', 'business-error-page'),
    )
  })

  it('treats an executeOperations action with all entries filtered by when as success and fires onSuccess', async () => {
    const fetchMock = createFetchMockByEndpoint({})
    vi.stubGlobal('fetch', fetchMock)

    const config: RuntimeConfig = {
      api: {
        skippableOp: { method: 'POST', endpoint: '/api/skippable' },
      },
      initialPage: 'home',
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'button',
              props: {
                label: 'Run filtered',
                action: {
                  type: 'executeOperations',
                  operations: [
                    {
                      operationName: 'skippableOp',
                      when: { reference: 'queries.flagQuery.data.enabled', operator: 'isTruthy' },
                    },
                  ],
                  onSuccess: [{ type: 'navigateTo', pageId: 'all-skipped-success' }],
                },
              },
            },
          ],
        },
        { id: 'all-skipped-success', layout: [] },
      ],
    }

    render(<ButtonLifecycleFixture config={config} />)
    fireEvent.click(screen.getByRole('button', { name: 'Run filtered' }))

    await waitFor(() =>
      expect(screen.getByTestId('runtime-page')).toHaveAttribute('data-runtime-page-id', 'all-skipped-success'),
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('keeps the fire-and-forget regression behavior for a button without onSuccess/onError even when its operation fails', async () => {
    const fetchMock = createFetchMockByEndpoint({
      '/api/plain': jsonResponse({ error: 'boom' }, 500),
    })
    vi.stubGlobal('fetch', fetchMock)

    const config: RuntimeConfig = {
      api: {
        plainOp: { method: 'POST', endpoint: '/api/plain' },
      },
      initialPage: 'home',
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'button',
              props: {
                label: 'Run plain',
                action: { type: 'executeOperation', operationName: 'plainOp' },
              },
            },
          ],
        },
      ],
    }

    render(<ButtonLifecycleFixture config={config} />)

    // Click does not throw and does not block; the button remains interactive immediately.
    fireEvent.click(screen.getByRole('button', { name: 'Run plain' }))
    expect(screen.getByRole('button', { name: 'Run plain' })).toBeInTheDocument()

    await waitFor(() => {
      const state = readRuntimeStateSnapshot('runtime-state')
      expect(state.queries.plainOp?.status).toBe('error')
    })
  })

  it('resolves item.* references in a repeater against the iteration that triggered the button', async () => {
    const fetchMock = createFetchMockByEndpoint({
      '/api/items': jsonResponse({ ok: true }),
      '/api/log': jsonResponse({ ok: true }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const config: RuntimeConfig = {
      api: {
        saveItem: { method: 'POST', endpoint: '/api/items' },
        logItem: { method: 'POST', endpoint: '/api/log' },
      },
      initialPage: 'home',
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'repeater',
              props: {
                items: { source: 'queries.items.data', key: 'id' },
                template: [
                  {
                    type: 'button',
                    props: {
                      label: 'Save item',
                      action: {
                        type: 'executeOperation',
                        operationName: 'saveItem',
                        body: { id: 'item.id' },
                        onSuccess: [
                          {
                            type: 'executeOperation',
                            operationName: 'logItem',
                            body: { ref: 'item.id' },
                          },
                        ],
                      },
                    },
                  },
                ],
              },
            },
          ],
        },
      ],
    }

    render(
      <ButtonLifecycleWithSeedFixture config={config} seedQueryName="items" seedData={[{ id: 'row-1' }]} />,
    )

    await waitFor(() => expect(screen.getByRole('button', { name: 'Save item' })).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Save item' }))

    await waitFor(() => {
      const state = readRuntimeStateSnapshot('runtime-state')
      expect(state.queries.saveItem?.status).toBe('success')
      expect(state.queries.logItem?.status).toBe('success')
    })

    const logCall = fetchMock.mock.calls.find((call) => String(call[0]).includes('/api/log'))
    expect(logCall).toBeDefined()
    expect(JSON.parse(String(logCall?.[1]?.body))).toEqual({ ref: 'row-1' })
  })

  it('runs an auxiliary button own onSuccess/onError inside a form independently of the form submitAction lifecycle', async () => {
    const fetchMock = createFetchMockByEndpoint({
      '/api/form-submit': jsonResponse({ ok: true }),
      '/api/aux': jsonResponse({ ok: true }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const config: RuntimeConfig = {
      api: {
        submitOp: { method: 'POST', endpoint: '/api/form-submit' },
        auxOp: { method: 'POST', endpoint: '/api/aux' },
      },
      initialPage: 'home',
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'form',
              id: 'main-form',
              submitAction: { type: 'executeOperation', operationName: 'submitOp' },
              children: [
                {
                  type: 'button',
                  props: {
                    label: 'Aux action',
                    action: {
                      type: 'executeOperation',
                      operationName: 'auxOp',
                      onSuccess: [{ type: 'navigateTo', pageId: 'aux-success' }],
                    },
                  },
                },
                {
                  type: 'button',
                  props: { label: 'Submit form' },
                },
              ],
            },
          ],
        },
        { id: 'aux-success', layout: [] },
      ],
    }

    render(<ButtonLifecycleFixture config={config} />)
    fireEvent.click(screen.getByRole('button', { name: 'Aux action' }))

    await waitFor(() =>
      expect(screen.getByTestId('runtime-page')).toHaveAttribute('data-runtime-page-id', 'aux-success'),
    )

    const state = readRuntimeStateSnapshot('runtime-state')
    expect(state.queries.auxOp?.status).toBe('success')
    expect(state.queries.submitOp).toBeUndefined()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

describe('ButtonNode variant "switch" action execution', () => {
  it('fires its action on click when rendered outside any form', async () => {
    const fetchMock = createFetchMockByEndpoint({
      '/api/toggle': jsonResponse({ ok: true }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const config: RuntimeConfig = {
      api: {
        toggleOp: { method: 'POST', endpoint: '/api/toggle' },
      },
      initialPage: 'home',
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'button',
              props: {
                label: 'Active',
                variant: 'switch',
                checked: false,
                action: { type: 'executeOperation', operationName: 'toggleOp' },
              },
            },
          ],
        },
      ],
    }

    render(<ButtonLifecycleFixture config={config} />)
    fireEvent.click(screen.getByRole('switch'))

    await waitFor(() => {
      const state = readRuntimeStateSnapshot('runtime-state')
      expect(state.queries.toggleOp?.status).toBe('success')
    })
  })

  it('sends switch.next resolved to true in the body when checked is false at click time', async () => {
    const fetchMock = createFetchMockByEndpoint({
      '/api/toggle': jsonResponse({ ok: true }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const config: RuntimeConfig = {
      api: {
        toggleOp: { method: 'POST', endpoint: '/api/toggle' },
      },
      initialPage: 'home',
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'button',
              props: {
                label: 'Active',
                variant: 'switch',
                checked: false,
                action: {
                  type: 'executeOperation',
                  operationName: 'toggleOp',
                  body: { isPrimary: 'switch.next' },
                },
              },
            },
          ],
        },
      ],
    }

    render(<ButtonLifecycleFixture config={config} />)
    fireEvent.click(screen.getByRole('switch'))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({ isPrimary: true })
  })

  it('sends switch.next resolved to false in the body when checked is already true at click time, without any disabled state', async () => {
    const fetchMock = createFetchMockByEndpoint({
      '/api/toggle': jsonResponse({ ok: true }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const config: RuntimeConfig = {
      api: {
        toggleOp: { method: 'POST', endpoint: '/api/toggle' },
      },
      initialPage: 'home',
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'button',
              props: {
                label: 'Active',
                variant: 'switch',
                checked: true,
                action: {
                  type: 'executeOperation',
                  operationName: 'toggleOp',
                  body: { isPrimary: 'switch.next' },
                },
              },
            },
          ],
        },
      ],
    }

    render(<ButtonLifecycleFixture config={config} />)
    const switchControl = screen.getByRole('switch')
    expect(switchControl).not.toHaveAttribute('disabled')

    fireEvent.click(switchControl)

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({ isPrimary: false })
  })

  it('resolves item.* references in a repeater against the row that triggered the switch click', async () => {
    const fetchMock = createFetchMockByEndpoint({
      '/api/toggle-item': jsonResponse({ ok: true }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const config: RuntimeConfig = {
      api: {
        toggleItem: { method: 'POST', endpoint: '/api/toggle-item' },
      },
      initialPage: 'home',
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'repeater',
              props: {
                items: { source: 'queries.items.data', key: 'id' },
                template: [
                  {
                    type: 'button',
                    props: {
                      label: 'Primary',
                      variant: 'switch',
                      checked: 'item.isPrimary',
                      action: {
                        type: 'executeOperation',
                        operationName: 'toggleItem',
                        body: { id: 'item.id', isPrimary: 'switch.next' },
                      },
                    },
                  },
                ],
              },
            },
          ],
        },
      ],
    }

    render(
      <ButtonLifecycleWithSeedFixture
        config={config}
        seedQueryName="items"
        seedData={[
          { id: 'row-1', isPrimary: false },
          { id: 'row-2', isPrimary: true },
        ]}
      />,
    )

    await waitFor(() => expect(screen.getAllByRole('switch')).toHaveLength(2))
    fireEvent.click(screen.getAllByRole('switch')[1])

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({ id: 'row-2', isPrimary: false })
  })

  it('runs an onSuccess that relaunches a listing query the same way as any other button', async () => {
    const fetchMock = createFetchMockByEndpoint({
      '/api/toggle': jsonResponse({ ok: true }),
      '/api/list': jsonResponse({ ok: true }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const config: RuntimeConfig = {
      api: {
        toggleOp: { method: 'POST', endpoint: '/api/toggle' },
        listOp: { method: 'GET', endpoint: '/api/list' },
      },
      initialPage: 'home',
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'button',
              props: {
                label: 'Active',
                variant: 'switch',
                checked: false,
                action: {
                  type: 'executeOperation',
                  operationName: 'toggleOp',
                  onSuccess: [{ type: 'executeOperation', operationName: 'listOp' }],
                },
              },
            },
          ],
        },
      ],
    }

    render(<ButtonLifecycleFixture config={config} />)
    fireEvent.click(screen.getByRole('switch'))

    await waitFor(() => {
      const state = readRuntimeStateSnapshot('runtime-state')
      expect(state.queries.toggleOp?.status).toBe('success')
      expect(state.queries.listOp?.status).toBe('success')
    })
  })
})
