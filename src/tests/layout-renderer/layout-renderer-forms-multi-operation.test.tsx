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

function MultiOpFormFixture({ config }: { config: RuntimeConfig }) {
  return (
    <RuntimeStateProvider config={config}>
      <RuntimePage />
      <RuntimeStateSnapshot testId="runtime-state" />
    </RuntimeStateProvider>
  )
}

function MultiOpFormSeedInnerFixture({ seedQueryName, seedData }: { seedQueryName: string; seedData: unknown }) {
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

function MultiOpFormWithSeedFixture({ config, seedQueryName, seedData }: {
  config: RuntimeConfig
  seedQueryName: string
  seedData: unknown
}) {
  return (
    <RuntimeStateProvider config={config}>
      <MultiOpFormSeedInnerFixture seedQueryName={seedQueryName} seedData={seedData} />
    </RuntimeStateProvider>
  )
}

describe('form with submitAction.type: executeOperations', () => {
  it('launches two parallel operations and both resolve to success', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    )
    vi.stubGlobal('fetch', fetchMock)

    const config: RuntimeConfig = {
      api: {
        saveProfile: { method: 'POST', endpoint: '/api/profile' },
        logActivity: { method: 'POST', endpoint: '/api/log' },
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
                type: 'executeOperations',
                operations: [
                  { operationName: 'saveProfile' },
                  { operationName: 'logActivity' },
                ],
              },
              children: [
                {
                  type: 'input',
                  props: { fieldId: 'name', label: 'Name', defaultValue: 'Ada' },
                },
                {
                  type: 'button',
                  props: { label: 'Submit' },
                },
              ],
            },
          ],
        },
      ],
    }

    render(<MultiOpFormFixture config={config} />)

    await waitFor(() => expect(screen.getByLabelText('Name')).toHaveValue('Ada'))
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))

    await waitFor(() => {
      const state = readRuntimeStateSnapshot('runtime-state')
      return state.queries.saveProfile?.status === 'success' && state.queries.logActivity?.status === 'success'
    })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    const state = readRuntimeStateSnapshot('runtime-state')
    expect(state.queries.saveProfile?.status).toBe('success')
    expect(state.queries.logActivity?.status).toBe('success')
  })

  it('resets form when resetOnSuccess is true and all operations succeed', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    )
    vi.stubGlobal('fetch', fetchMock)

    const config: RuntimeConfig = {
      api: {
        saveProfile: { method: 'POST', endpoint: '/api/profile' },
        logActivity: { method: 'POST', endpoint: '/api/log' },
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
                type: 'executeOperations',
                operations: [
                  { operationName: 'saveProfile' },
                  { operationName: 'logActivity' },
                ],
              },
              resetOnSuccess: true,
              children: [
                {
                  type: 'input',
                  props: { fieldId: 'name', label: 'Name', defaultValue: 'Ada' },
                },
                {
                  type: 'button',
                  props: { label: 'Submit' },
                },
              ],
            },
          ],
        },
      ],
    }

    render(<MultiOpFormFixture config={config} />)

    await waitFor(() => expect(screen.getByLabelText('Name')).toHaveValue('Ada'))
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Grace' } })
    await waitFor(() => expect(screen.getByLabelText('Name')).toHaveValue('Grace'))

    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))

    // After all operations succeed with resetOnSuccess: true, the form should be reset to default
    await waitFor(() => expect(screen.getByLabelText('Name')).toHaveValue('Ada'))
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('does not reset form when one operation fails and resetOnSuccess is true', async () => {
    let callCount = 0
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(() => {
      callCount++
      if (callCount === 1) {
        return Promise.resolve(
          new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }
      return Promise.resolve(
        new Response(JSON.stringify({ error: 'fail' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    })
    vi.stubGlobal('fetch', fetchMock)

    const config: RuntimeConfig = {
      api: {
        saveProfile: { method: 'POST', endpoint: '/api/profile' },
        logActivity: { method: 'POST', endpoint: '/api/log' },
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
                type: 'executeOperations',
                operations: [
                  { operationName: 'saveProfile' },
                  { operationName: 'logActivity' },
                ],
              },
              resetOnSuccess: true,
              children: [
                {
                  type: 'input',
                  props: { fieldId: 'name', label: 'Name', defaultValue: 'Ada' },
                },
                {
                  type: 'button',
                  props: { label: 'Submit' },
                },
              ],
            },
          ],
        },
      ],
    }

    render(<MultiOpFormFixture config={config} />)

    await waitFor(() => expect(screen.getByLabelText('Name')).toHaveValue('Ada'))
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Grace' } })
    await waitFor(() => expect(screen.getByLabelText('Name')).toHaveValue('Grace'))

    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))

    // Wait for both queries to settle (one success, one error)
    await waitFor(() => {
      const state = readRuntimeStateSnapshot('runtime-state')
      const statuses = [state.queries.saveProfile?.status, state.queries.logActivity?.status]
      return statuses.includes('success') && statuses.includes('error')
    })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    const state = readRuntimeStateSnapshot('runtime-state')
    const statuses = [state.queries.saveProfile?.status, state.queries.logActivity?.status]
    // One is success, one is error
    expect(statuses).toContain('success')
    expect(statuses).toContain('error')
    // Form is NOT reset; name should still be 'Grace'
    expect(screen.getByLabelText('Name')).toHaveValue('Grace')
  })

  it('does not reset form when resetOnSuccess is false (or absent) even when all operations succeed', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    )
    vi.stubGlobal('fetch', fetchMock)

    const config: RuntimeConfig = {
      api: {
        saveProfile: { method: 'POST', endpoint: '/api/profile' },
        logActivity: { method: 'POST', endpoint: '/api/log' },
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
                type: 'executeOperations',
                operations: [
                  { operationName: 'saveProfile' },
                  { operationName: 'logActivity' },
                ],
              },
              // resetOnSuccess deliberately absent
              children: [
                {
                  type: 'input',
                  props: { fieldId: 'name', label: 'Name', defaultValue: 'Ada' },
                },
                {
                  type: 'button',
                  props: { label: 'Submit' },
                },
              ],
            },
          ],
        },
      ],
    }

    render(<MultiOpFormFixture config={config} />)

    await waitFor(() => expect(screen.getByLabelText('Name')).toHaveValue('Ada'))
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Grace' } })

    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))

    // Wait for both operations to complete
    await waitFor(() => {
      const state = readRuntimeStateSnapshot('runtime-state')
      return state.queries.saveProfile?.status === 'success' && state.queries.logActivity?.status === 'success'
    })
    // With no resetOnSuccess, form value should remain as 'Grace'
    expect(screen.getByLabelText('Name')).toHaveValue('Grace')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('resolves operation-not-found for an entry with an unknown operationName while the other operation succeeds', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    )
    vi.stubGlobal('fetch', fetchMock)

    const config: RuntimeConfig = {
      api: {
        saveProfile: { method: 'POST', endpoint: '/api/profile' },
        // 'missingOp' is intentionally absent from api catalog
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
                type: 'executeOperations',
                operations: [
                  { operationName: 'saveProfile' },
                  { operationName: 'missingOp' },
                ],
              },
              resetOnSuccess: true,
              children: [
                {
                  type: 'input',
                  props: { fieldId: 'name', label: 'Name', defaultValue: 'Ada' },
                },
                {
                  type: 'button',
                  props: { label: 'Submit' },
                },
              ],
            },
          ],
        },
      ],
    }

    render(<MultiOpFormFixture config={config} />)

    await waitFor(() => expect(screen.getByLabelText('Name')).toHaveValue('Ada'))
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))

    await waitFor(() => {
      const state = readRuntimeStateSnapshot('runtime-state')
      return state.queries.missingOp?.status === 'error'
    })

    const state = readRuntimeStateSnapshot('runtime-state')
    expect(state.queries.saveProfile?.status).toBe('success')
    expect(state.queries.missingOp?.status).toBe('error')
    expect(state.queries.missingOp?.error?.code).toBe('operation-not-found')
    // Not all success, so no reset
    expect(screen.getByLabelText('Name')).toHaveValue('Ada')
  })

  it('resolves request-build-failed for an entry whose endpoint placeholder fails to resolve, the other operation executes normally', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    )
    vi.stubGlobal('fetch', fetchMock)

    const config: RuntimeConfig = {
      api: {
        saveProfile: { method: 'POST', endpoint: '/api/profile' },
        getItem: { method: 'GET', endpoint: '/api/items/{{params.itemId}}' },
      },
      initialPage: 'home',
      pages: [
        {
          id: 'home',
          // no params declared, so {{params.itemId}} won't resolve
          layout: [
            {
              type: 'form',
              id: 'profileForm',
              submitAction: {
                type: 'executeOperations',
                operations: [
                  { operationName: 'saveProfile' },
                  { operationName: 'getItem' },
                ],
              },
              children: [
                {
                  type: 'input',
                  props: { fieldId: 'name', label: 'Name', defaultValue: 'Ada' },
                },
                {
                  type: 'button',
                  props: { label: 'Submit' },
                },
              ],
            },
          ],
        },
      ],
    }

    render(<MultiOpFormFixture config={config} />)

    await waitFor(() => expect(screen.getByLabelText('Name')).toHaveValue('Ada'))
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))

    await waitFor(() => {
      const state = readRuntimeStateSnapshot('runtime-state')
      return state.queries.getItem?.status === 'error'
    })

    const state = readRuntimeStateSnapshot('runtime-state')
    expect(state.queries.saveProfile?.status).toBe('success')
    expect(state.queries.getItem?.status).toBe('error')
    expect(state.queries.getItem?.error?.code).toBe('request-build-failed')
    // fetch only called for saveProfile, not for getItem
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('all operations share a single snapshot taken before Promise.all; body reads form values from the snapshot', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    )
    vi.stubGlobal('fetch', fetchMock)

    const config: RuntimeConfig = {
      api: {
        saveProfile: { method: 'POST', endpoint: '/api/profile' },
        logActivity: { method: 'POST', endpoint: '/api/log' },
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
                type: 'executeOperations',
                operations: [
                  {
                    operationName: 'saveProfile',
                    body: { name: 'forms.profileForm.name' },
                  },
                  {
                    operationName: 'logActivity',
                    body: { name: 'forms.profileForm.name' },
                  },
                ],
              },
              resetOnSuccess: true,
              children: [
                {
                  type: 'input',
                  props: { fieldId: 'name', label: 'Name', defaultValue: 'Ada' },
                },
                {
                  type: 'button',
                  props: { label: 'Submit' },
                },
              ],
            },
          ],
        },
      ],
    }

    render(<MultiOpFormFixture config={config} />)

    await waitFor(() => expect(screen.getByLabelText('Name')).toHaveValue('Ada'))
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Grace' } })

    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))

    // After all succeed with resetOnSuccess, form should reset to 'Ada'
    await waitFor(() => expect(screen.getByLabelText('Name')).toHaveValue('Ada'))

    expect(fetchMock).toHaveBeenCalledTimes(2)
    // Both operations received the form value from the snapshot ('Grace'), not post-reset value
    const call0Body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))
    const call1Body = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))
    expect(call0Body).toEqual({ name: 'Grace' })
    expect(call1Body).toEqual({ name: 'Grace' })
  })

  it('handles form inside a repeater with executeOperations and propagates iterationContext', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    )
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
                items: {
                  source: 'queries.items.data',
                  key: 'id',
                },
                template: [
                  {
                    type: 'form',
                    id: 'itemForm',
                    submitAction: {
                      type: 'executeOperations',
                      operations: [
                        {
                          operationName: 'saveItem',
                          body: { id: 'item.id' },
                        },
                        {
                          operationName: 'logItem',
                          body: { ref: 'item.id' },
                        },
                      ],
                    },
                    children: [
                      {
                        type: 'button',
                        props: { label: 'Submit item' },
                      },
                    ],
                  },
                ],
              },
            },
          ],
        },
      ],
    }

    render(
      <MultiOpFormWithSeedFixture
        config={config}
        seedQueryName="items"
        seedData={[{ id: 'row-1' }]}
      />,
    )

    await waitFor(() => expect(screen.getByRole('button', { name: 'Submit item' })).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Submit item' }))

    // Wait for both operations to settle
    await waitFor(() => {
      const state = readRuntimeStateSnapshot('runtime-state')
      return state.queries.saveItem?.status === 'success' && state.queries.logItem?.status === 'success'
    })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    // Both calls should have body with id resolved from iterationContext
    const bodies = fetchMock.mock.calls.map((call) => JSON.parse(String(call[1]?.body)))
    const saveBody = bodies.find((b: Record<string, unknown>) => 'id' in b)
    const logBody = bodies.find((b: Record<string, unknown>) => 'ref' in b)
    expect(saveBody).toEqual({ id: 'row-1' })
    expect(logBody).toEqual({ ref: 'row-1' })
  })

  it('handles a single entry in executeOperations with resetOnSuccess like the singular case', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    )
    vi.stubGlobal('fetch', fetchMock)

    const config: RuntimeConfig = {
      api: {
        saveProfile: { method: 'POST', endpoint: '/api/profile' },
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
                type: 'executeOperations',
                operations: [{ operationName: 'saveProfile' }],
              },
              resetOnSuccess: true,
              children: [
                {
                  type: 'input',
                  props: { fieldId: 'name', label: 'Name', defaultValue: 'Ada' },
                },
                {
                  type: 'button',
                  props: { label: 'Submit' },
                },
              ],
            },
          ],
        },
      ],
    }

    render(<MultiOpFormFixture config={config} />)

    await waitFor(() => expect(screen.getByLabelText('Name')).toHaveValue('Ada'))
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Grace' } })

    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))

    // Single operation succeeded, reset should happen
    await waitFor(() => expect(screen.getByLabelText('Name')).toHaveValue('Ada'))
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('regression: executeOperation (singular) still works correctly after the new branch is added', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    )
    vi.stubGlobal('fetch', fetchMock)

    const config: RuntimeConfig = {
      api: {
        submitProfile: { method: 'POST', endpoint: '/api/profile' },
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
              resetOnSuccess: true,
              children: [
                {
                  type: 'input',
                  props: { fieldId: 'name', label: 'Name', defaultValue: 'Ada' },
                },
                {
                  type: 'button',
                  props: { label: 'Submit' },
                },
              ],
            },
          ],
        },
      ],
    }

    render(<MultiOpFormFixture config={config} />)

    await waitFor(() => expect(screen.getByLabelText('Name')).toHaveValue('Ada'))
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Grace' } })

    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    // Reset should happen: back to 'Ada'
    await waitFor(() => expect(screen.getByLabelText('Name')).toHaveValue('Ada'))

    const state = readRuntimeStateSnapshot('runtime-state')
    expect(state.queries.submitProfile?.status).toBe('success')
  })

  it('opens the onSuccess modal only after the second onSuccess entry has resolved, never before its fetch is dispatched', async () => {
    let resolveLogActivity: ((response: Response) => void) | null = null
    const fetchMock = vi.fn<typeof fetch>().mockImplementation((input) => {
      const url = String(input)
      if (url.includes('/api/profile')) {
        return Promise.resolve(
          new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }
      if (url.includes('/api/log')) {
        return new Promise<Response>((resolve) => {
          resolveLogActivity = resolve
        })
      }
      throw new Error(`No mock response configured for URL: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    const config: RuntimeConfig = {
      api: {
        saveProfile: { method: 'POST', endpoint: '/api/profile' },
        logActivity: { method: 'POST', endpoint: '/api/log' },
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
                operationName: 'saveProfile',
              },
              onSuccess: [
                { type: 'executeOperation', operationName: 'logActivity' },
                { type: 'openModal', modalId: 'success-modal' },
              ],
              children: [
                {
                  type: 'input',
                  props: { fieldId: 'name', label: 'Name', defaultValue: 'Ada' },
                },
                {
                  type: 'button',
                  props: { label: 'Submit' },
                },
              ],
            },
            {
              type: 'modal',
              id: 'success-modal',
              children: [{ type: 'heading', props: { level: 2, text: 'Saved!' } }],
            },
          ],
        },
      ],
    }

    render(<MultiOpFormFixture config={config} />)

    await waitFor(() => expect(screen.getByLabelText('Name')).toHaveValue('Ada'))
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))

    await waitFor(() => {
      const state = readRuntimeStateSnapshot('runtime-state')
      expect(state.queries.saveProfile?.status).toBe('success')
      expect(state.queries.logActivity?.status).toBe('loading')
    })

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    resolveLogActivity?.(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
  })
})
