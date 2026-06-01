import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RuntimeConfig } from '../../config/runtime-config'
import { RuntimeStateProvider } from '../../runtime/runtime-state/runtime-state-provider'
import { RuntimePage } from '../../runtime/runtime-page'
import { DynamicSelectQueryFixture, RuntimeStateSnapshot } from './helpers'

afterEach(() => {
  window.history.replaceState(null, '', window.location.pathname + window.location.search)
})

describe('Runtime shared state store', () => {
  it('cleans a dynamic select value when its option disappears and submits the empty value', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: {
          'content-type': 'application/json',
        },
      }),
    )

    const config: RuntimeConfig = {
      api: {
        submitProfile: {
          method: 'POST',
          endpoint: '/api/profile',
          body: {
            role: 'forms.profileForm.role',
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
                  type: 'select',
                  props: {
                    fieldId: 'role',
                    label: 'Role',
                    validations: {
                      required: {
                        value: true,
                      },
                    },
                    defaultValue: 'editor',
                    items: {
                      source: 'queries.roleCatalog.data.results',
                      label: 'label',
                      value: 'id',
                    },
                  },
                },
                {
                  type: 'button',
                  props: {
                    label: 'Submit dynamic profile',
                  },
                },
              ],
            },
          ],
        },
      ],
    }

    globalThis.fetch = fetchMock

    render(
      <RuntimeStateProvider config={config}>
        <DynamicSelectQueryFixture />
        <RuntimePage />
        <RuntimeStateSnapshot testId="runtime-state" />
      </RuntimeStateProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Seed role catalog' }))

    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Role' })).toHaveValue(''))

    fireEvent.change(screen.getByRole('combobox', { name: 'Role' }), { target: { value: 'editor' } })
    expect(screen.getByTestId('runtime-state')).toHaveTextContent('"role":{"value":"editor"')

    fireEvent.click(screen.getByRole('button', { name: 'Seed replacement role catalog' }))

    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Role' })).toHaveValue(''))
    expect(screen.getByTestId('runtime-state')).toHaveTextContent('"role":{"value":"","error":null')

    fireEvent.click(screen.getByRole('button', { name: 'Submit dynamic profile' }))

    await waitFor(() => expect(screen.getByText('Required')).toBeInTheDocument())
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('submits the cleaned empty string after a dynamic select loses its selected option', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: {
          'content-type': 'application/json',
        },
      }),
    )

    const config: RuntimeConfig = {
      api: {
        submitProfile: {
          method: 'POST',
          endpoint: '/api/profile',
          body: {
            role: 'forms.profileForm.role',
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
                  type: 'select',
                  props: {
                    fieldId: 'role',
                    label: 'Role',
                    defaultValue: 'editor',
                    items: {
                      source: 'queries.roleCatalog.data.results',
                      label: 'label',
                      value: 'id',
                    },
                  },
                },
                {
                  type: 'button',
                  props: {
                    label: 'Submit cleaned dynamic profile',
                  },
                },
              ],
            },
          ],
        },
      ],
    }

    globalThis.fetch = fetchMock

    render(
      <RuntimeStateProvider config={config}>
        <DynamicSelectQueryFixture />
        <RuntimePage />
        <RuntimeStateSnapshot testId="runtime-state" />
      </RuntimeStateProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Seed role catalog' }))
    fireEvent.change(screen.getByRole('combobox', { name: 'Role' }), { target: { value: 'editor' } })
    fireEvent.click(screen.getByRole('button', { name: 'Seed replacement role catalog' }))

    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Role' })).toHaveValue(''))

    fireEvent.click(screen.getByRole('button', { name: 'Submit cleaned dynamic profile' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      body: JSON.stringify({
        role: '',
      }),
    })
  })

  it('submits declarative forms with the latest field values and resets them after a successful submit', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: {
          'content-type': 'application/json',
        },
      }),
    )

    const config: RuntimeConfig = {
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
              resetOnSuccess: true,
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
    }

    globalThis.fetch = fetchMock

    render(
      <RuntimeStateProvider config={config}>
        <RuntimePage />
        <RuntimeStateSnapshot testId="runtime-state" />
      </RuntimeStateProvider>,
    )

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Grace' } })
    fireEvent.click(screen.getByRole('button', { name: 'Submit profile' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      body: JSON.stringify({
        name: 'Grace',
      }),
    })
    await waitFor(() => expect(screen.getByLabelText('Name')).toHaveValue('Ada'))
    expect(screen.getByTestId('runtime-state')).toHaveTextContent('"submitProfile":{"status":"success"')
  })
})
