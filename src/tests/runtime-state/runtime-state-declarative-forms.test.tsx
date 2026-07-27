import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { useEffect } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RuntimeConfig } from '../../config/runtime-config'
import { RuntimeStateProvider } from '../../runtime/runtime-state/runtime-state-provider'
import { useRuntimeState, useRuntimeStateActions } from '../../runtime/runtime-state/use-runtime-state'
import { RuntimePage } from '../../runtime/runtime-page'

afterEach(() => {
  window.history.replaceState(null, '', window.location.pathname + window.location.search)
})

function RuntimeStateSnapshot({ testId }: { testId: string }) {
  const state = useRuntimeState()

  return <pre data-testid={testId}>{JSON.stringify(state)}</pre>
}

function DynamicSelectQueryFixture() {
  const { initializeQuery, setQuerySuccess } = useRuntimeStateActions()

  useEffect(() => {
    initializeQuery('roleCatalog')
    initializeQuery('visibilityQuery')
  }, [initializeQuery])

  return (
    <>
      <button
        type="button"
        onClick={() =>
          setQuerySuccess('roleCatalog', {
            results: [
              {
                id: 'admin',
                label: 'Admin',
              },
              {
                id: 'editor',
                label: 'Editor',
              },
            ],
          })
        }
      >
        Seed role catalog
      </button>
      <button
        type="button"
        onClick={() =>
          setQuerySuccess('roleCatalog', {
            results: [
              {
                id: 'viewer',
                label: 'Viewer',
              },
            ],
          })
        }
      >
        Seed replacement role catalog
      </button>
      <button
        type="button"
        onClick={() =>
          setQuerySuccess('visibilityQuery', {
            ok: true,
          })
        }
      >
        Seed dynamic visibility success
      </button>
    </>
  )
}

describe('Runtime shared state store', () => {
  it('keeps declarative forms isolated and normalizes select state to strings', () => {
    const config: RuntimeConfig = {
      api: {},
      initialPage: 'home',
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'form',
              id: 'profile-form',
              children: [
                {
                  type: 'select',
                  props: {
                    fieldId: 'role',
                    label: 'Role',
                    defaultValue: 2,
                    items: [
                      { label: '', value: '' },
                      { label: 'Editor', value: 2 },
                    ],
                  },
                },
              ],
            },
            {
              type: 'form',
              id: 'preferences-form',
              children: [
                {
                  type: 'select',
                  props: {
                    fieldId: 'theme',
                    label: 'Theme',
                    defaultValue: 'missing',
                    items: [{ label: 'Light', value: 'light' }],
                  },
                },
              ],
            },
          ],
        },
      ],
    }

    render(
      <RuntimeStateProvider config={config}>
        <RuntimePage />
        <RuntimeStateSnapshot testId="runtime-state" />
      </RuntimeStateProvider>,
    )

    expect(screen.getByRole('combobox', { name: 'Role' })).toHaveValue('2')
    expect(screen.getByRole('combobox', { name: 'Theme' })).toHaveValue('')
    expect(screen.getByTestId('runtime-state')).toHaveTextContent('"role":{"value":"2"')
    expect(screen.getByTestId('runtime-state')).toHaveTextContent('"theme":{"value":""')
  })

  it('applies dynamic select defaults only on first effective initialization and does not reinitialize when options arrive later', async () => {
    const config: RuntimeConfig = {
      api: {},
      initialPage: 'home',
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'form',
              id: 'profile-form',
              children: [
                {
                  type: 'select',
                  props: {
                    fieldId: 'lateRole',
                    label: 'Late role',
                    defaultValue: 'editor',
                    items: {
                      source: 'queries.roleCatalog.data.results',
                      label: 'label',
                      value: 'id',
                    },
                  },
                },
                {
                  type: 'select',
                  queryStateFeedback: {
                    query: 'visibilityQuery',
                    states: {
                      idle: {
                        mode: 'hide',
                      },
                      success: {
                        mode: 'show',
                      },
                    },
                  },
                  props: {
                    fieldId: 'visibleRole',
                    label: 'Visible role',
                    defaultValue: 'editor',
                    items: {
                      source: 'queries.roleCatalog.data.results',
                      label: 'label',
                      value: 'id',
                    },
                  },
                },
              ],
            },
          ],
        },
      ],
    }

    render(
      <RuntimeStateProvider config={config}>
        <DynamicSelectQueryFixture />
        <RuntimePage />
        <RuntimeStateSnapshot testId="runtime-state" />
      </RuntimeStateProvider>,
    )

    expect(screen.getByRole('combobox', { name: 'Late role' })).toHaveValue('')
    expect(screen.queryByRole('combobox', { name: 'Visible role' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Seed role catalog' }))

    expect(screen.getByRole('combobox', { name: 'Late role' })).toHaveValue('')

    fireEvent.click(screen.getByRole('button', { name: 'Seed dynamic visibility success' }))

    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Visible role' })).toHaveValue('editor'))
    expect(screen.getByTestId('runtime-state')).toHaveTextContent('"lateRole":{"value":"","error":null')
    expect(screen.getByTestId('runtime-state')).toHaveTextContent('"visibleRole":{"value":"editor","error":null')
  })

  it('stores select.multiple as an ordered string array and resets it through the shared form state', () => {
    const config: RuntimeConfig = {
      api: {},
      initialPage: 'home',
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'form',
              id: 'profile-form',
              children: [
                {
                  type: 'select',
                  props: {
                    fieldId: 'scopes',
                    label: 'Scopes',
                    multiple: true,
                    defaultValue: ['publish', 'read'],
                    items: {
                      values: ['read', 'write', 'publish'],
                    },
                  },
                },
                {
                  type: 'button',
                  props: {
                    label: 'Reset scopes',
                    action: {
                      type: 'resetForm',
                      formId: 'profile-form',
                    },
                  },
                },
              ],
            },
          ],
        },
      ],
    }

    render(
      <RuntimeStateProvider config={config}>
        <RuntimePage />
        <RuntimeStateSnapshot testId="runtime-state" />
      </RuntimeStateProvider>,
    )

    const scopes = screen.getByRole('listbox', { name: 'Scopes' }) as HTMLSelectElement

    expect(Array.from(scopes.selectedOptions, (option) => option.value)).toEqual(['read', 'publish'])
    expect(screen.getByTestId('runtime-state')).toHaveTextContent('"scopes":{"value":["read","publish"]')

    const options = within(scopes).getAllByRole('option')
    ;(options[0] as HTMLOptionElement).selected = true
    ;(options[1] as HTMLOptionElement).selected = true
    ;(options[2] as HTMLOptionElement).selected = false
    fireEvent.change(scopes)

    expect(screen.getByTestId('runtime-state')).toHaveTextContent('"scopes":{"value":["read","write"]')

    fireEvent.click(screen.getByRole('button', { name: 'Reset scopes' }))

    expect(screen.getByTestId('runtime-state')).toHaveTextContent('"scopes":{"value":["read","publish"]')
  })

  it('keeps inline radioGroup as a single string value and cleans it when the dynamic option disappears', async () => {
    const config: RuntimeConfig = {
      api: {},
      initialPage: 'home',
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'form',
              id: 'profile-form',
              children: [
                {
                  type: 'radioGroup',
                  props: {
                    fieldId: 'role',
                    label: 'Role',
                    optionLayout: 'inline',
                    defaultValue: 'editor',
                    items: {
                      source: 'queries.roleCatalog.data.results',
                      label: 'label',
                      value: 'id',
                    },
                  },
                },
              ],
            },
          ],
        },
      ],
    }

    render(
      <RuntimeStateProvider config={config}>
        <DynamicSelectQueryFixture />
        <RuntimePage />
        <RuntimeStateSnapshot testId="runtime-state" />
      </RuntimeStateProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Seed role catalog' }))

    await waitFor(() => expect(screen.getByRole('radio', { name: 'Editor' })).toBeInTheDocument())
    expect(screen.getByRole('radio', { name: 'Editor' })).not.toBeChecked()
    fireEvent.click(screen.getByRole('radio', { name: 'Editor' }))
    expect(screen.getByTestId('runtime-state')).toHaveTextContent('"role":{"value":"editor"')

    fireEvent.click(screen.getByRole('button', { name: 'Seed replacement role catalog' }))

    await waitFor(() => expect(screen.queryByRole('radio', { name: 'Editor' })).not.toBeInTheDocument())
    expect(screen.getByTestId('runtime-state')).toHaveTextContent('"role":{"value":"","error":null')
  })

  it('shares multiple-selection semantics between inline checkboxGroup and select.multiple for cleanup and submit payloads', async () => {
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
            scopes: 'forms.profileForm.scopes',
            teams: 'forms.profileForm.teams',
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
                    fieldId: 'scopes',
                    label: 'Scopes',
                    multiple: true,
                    defaultValue: ['editor', 'admin'],
                    items: {
                      source: 'queries.roleCatalog.data.results',
                      label: 'label',
                      value: 'id',
                    },
                  },
                },
                {
                  type: 'checkboxGroup',
                  props: {
                    fieldId: 'teams',
                    label: 'Teams',
                    optionLayout: 'inline',
                    defaultValue: ['editor', 'admin'],
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
                    label: 'Submit dynamic groups',
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

    await waitFor(() => expect(screen.getByRole('listbox', { name: 'Scopes' })).toBeInTheDocument())

    const scopes = screen.getByRole('listbox', { name: 'Scopes' }) as HTMLSelectElement
    const scopeOptions = within(scopes).getAllByRole('option')
    ;(scopeOptions[0] as HTMLOptionElement).selected = true
    ;(scopeOptions[1] as HTMLOptionElement).selected = true
    fireEvent.change(scopes)

    fireEvent.click(screen.getByRole('checkbox', { name: 'Admin' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Editor' }))

    expect(screen.getByTestId('runtime-state')).toHaveTextContent('"scopes":{"value":["admin","editor"]')
    expect(screen.getByTestId('runtime-state')).toHaveTextContent('"teams":{"value":["admin","editor"]')

    fireEvent.click(screen.getByRole('button', { name: 'Seed replacement role catalog' }))

    await waitFor(() => expect(screen.getByTestId('runtime-state')).toHaveTextContent('"scopes":{"value":[],"error":null'))
    expect(screen.getByTestId('runtime-state')).toHaveTextContent('"teams":{"value":[],"error":null')

    fireEvent.click(screen.getByRole('button', { name: 'Submit dynamic groups' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      body: JSON.stringify({
        scopes: [],
        teams: [],
      }),
    })
  })
})
