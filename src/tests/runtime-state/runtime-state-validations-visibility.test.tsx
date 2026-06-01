import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RuntimeConfig } from '../../config/runtime-config'
import { RuntimeStateProvider } from '../../runtime/runtime-state/runtime-state-provider'
import { RuntimePage } from '../../runtime/runtime-page'
import { FormRuntimeFixture, RepeaterFormFixture, RuntimeStateSnapshot } from './helpers'

afterEach(() => {
  window.history.replaceState(null, '', window.location.pathname + window.location.search)
})

describe('Runtime shared state store', () => {
  it('blocks submit for visible required fields, clears errors on valid change and ignores hidden required fields', async () => {
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
                  type: 'input',
                  props: {
                    fieldId: 'name',
                    label: 'Name',
                    validations: {
                      required: {
                        value: true,
                      },
                    },
                    defaultValue: '',
                  },
                },
                {
                  type: 'radioGroup',
                  queryStateFeedback: {
                    query: 'visibilityQuery',
                    states: {
                      idle: {
                        mode: 'hide',
                      },
                      loading: {
                        mode: 'show',
                      },
                      success: {
                        mode: 'show',
                      },
                    },
                  },
                  props: {
                    fieldId: 'role',
                    label: 'Role',
                    optionLayout: 'inline',
                    validations: {
                      required: {
                        value: true,
                      },
                    },
                    defaultValue: '',
                    items: [
                      { label: 'Editor', value: 'editor' },
                      { label: 'Admin', value: 'admin' },
                    ],
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

    render(
      <RuntimeStateProvider config={config}>
        <FormRuntimeFixture />
      </RuntimeStateProvider>,
    )

    const form = screen.getByTestId('runtime-page').querySelector('form')
    expect(form).not.toBeNull()

    fireEvent.submit(form!)

    expect(screen.getAllByText('Required')).toHaveLength(1)
    expect(screen.getByTestId('runtime-state')).toHaveTextContent('"name":{"value":"","error":"Required"')

    fireEvent.change(screen.getByRole('textbox', { name: /Name/ }), { target: { value: 'Ada' } })

    await waitFor(() => expect(screen.queryByText('Required')).not.toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: 'Set visibility loading' }))
    fireEvent.submit(form!)

    expect(screen.getByTestId('runtime-state')).toHaveTextContent('"role":{"value":"","error":"Required"')

    fireEvent.click(screen.getByRole('button', { name: 'Set visibility success' }))
    fireEvent.submit(form!)

    expect(screen.getByTestId('runtime-state')).toHaveTextContent('"role":{"value":"","error":"Required"')
  })

  it('preserves hidden field state and allows submit while a visibility-hidden required field stays out of validation', async () => {
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
            nickname: 'forms.profileForm.nickname',
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
                    validations: {
                      required: {
                        value: true,
                      },
                    },
                    defaultValue: 'Ada',
                  },
                },
                {
                  type: 'select',
                  props: {
                    fieldId: 'role',
                    label: 'Role',
                    defaultValue: 'admin',
                    items: [
                      { label: 'Admin', value: 'admin' },
                      { label: 'Editor', value: 'editor' },
                    ],
                  },
                },
                {
                  type: 'input',
                  visibility: {
                    reference: 'forms.profileForm.role',
                    operator: 'equals',
                    value: 'admin',
                  },
                  props: {
                    fieldId: 'nickname',
                    label: 'Nickname',
                    validations: {
                      required: {
                        value: true,
                      },
                    },
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

    fireEvent.change(screen.getByRole('textbox', { name: 'Nickname' }), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: 'Submit profile' }))

    await waitFor(() => expect(screen.getByText('Required')).toBeInTheDocument())
    expect(fetchMock).not.toHaveBeenCalled()

    fireEvent.change(screen.getByRole('combobox', { name: 'Role' }), { target: { value: 'editor' } })

    await waitFor(() => expect(screen.queryByLabelText('Nickname')).not.toBeInTheDocument())
    expect(screen.getByTestId('runtime-state')).toHaveTextContent(
      '"nickname":{"value":"","error":"Required","touched":true,"dirty":true,"defaultValue":"Ada"}',
    )

    fireEvent.click(screen.getByRole('button', { name: 'Submit profile' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    fireEvent.change(screen.getByRole('combobox', { name: 'Role' }), { target: { value: 'admin' } })

    await waitFor(() => {
      const nicknameInput = screen.getByText('Nickname').closest('label')?.querySelector('input')
      expect(nicknameInput).not.toBeNull()
      expect(nicknameInput).toHaveValue('')
    })
    expect(screen.getByText('Required')).toBeInTheDocument()
  })

  it('does not validate required fields nested inside a visibility-hidden container', async () => {
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
          query: {
            clientType: 'forms.dynamicForm.clientType',
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
              id: 'dynamicForm',
              submitAction: {
                type: 'executeOperation',
                operationName: 'submitProfile',
              },
              children: [
                {
                  type: 'radioGroup',
                  props: {
                    fieldId: 'clientType',
                    label: 'Tipo de cliente',
                    optionLayout: 'inline',
                    items: [
                      { label: 'Particular', value: 'particular' },
                      { label: 'Empresa', value: 'empresa' },
                    ],
                    defaultValue: 'particular',
                  },
                },
                {
                  type: 'container',
                  visibility: {
                    reference: 'forms.dynamicForm.clientType',
                    operator: 'equals',
                    value: 'empresa',
                  },
                  children: [
                    {
                      type: 'input',
                      props: {
                        fieldId: 'company_cif',
                        label: 'CIF',
                        validations: {
                          required: {
                            value: true,
                          },
                        },
                        defaultValue: '',
                      },
                    },
                  ],
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

    expect(screen.queryByRole('textbox', { name: 'CIF' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Submit profile' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(screen.queryByText('Required')).not.toBeInTheDocument()
    expect(screen.getByTestId('runtime-state')).not.toHaveTextContent('"company_cif"')
  })

  it('allows submit while a queryStateFeedback-hidden required field stays hidden and revalidates it when visible again', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(async () =>
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
              children: [
                {
                  type: 'input',
                  props: {
                    fieldId: 'name',
                    label: 'Name',
                    defaultValue: 'Ada',
                    validations: {
                      required: {
                        value: true,
                      },
                    },
                  },
                },
                {
                  type: 'input',
                  queryStateFeedback: {
                    query: 'visibilityQuery',
                    states: {
                      loading: {
                        mode: 'hide',
                      },
                      success: {
                        mode: 'show',
                      },
                    },
                  },
                  props: {
                    fieldId: 'roleCode',
                    label: 'Role code',
                    defaultValue: '',
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
          ],
        },
      ],
    }

    globalThis.fetch = fetchMock

    render(
      <RuntimeStateProvider config={config}>
        <FormRuntimeFixture />
      </RuntimeStateProvider>,
    )

    expect(screen.queryByRole('textbox', { name: 'Role code' })).not.toBeInTheDocument()
    expect(screen.getByTestId('runtime-state')).not.toHaveTextContent('"roleCode"')

    fireEvent.click(screen.getByRole('button', { name: 'Submit profile' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(screen.getByTestId('runtime-state')).not.toHaveTextContent('"roleCode"')

    fireEvent.click(screen.getByRole('button', { name: 'Set visibility success' }))

    await waitFor(() => {
      const roleCodeInput = screen.getByText('Role code').closest('label')?.querySelector('input')
      expect(roleCodeInput).not.toBeNull()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Submit profile' }))

    await waitFor(() => expect(screen.getByText('Required')).toBeInTheDocument())
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('runtime-state')).toHaveTextContent('"roleCode":{"value":"","error":"Required"')

    fireEvent.click(screen.getByRole('button', { name: 'Set visibility loading' }))

    await waitFor(() => expect(screen.queryByRole('textbox', { name: 'Role code' })).not.toBeInTheDocument())
    expect(screen.getByTestId('runtime-state')).toHaveTextContent('"roleCode":{"value":"","error":"Required"')

    fireEvent.click(screen.getByRole('button', { name: 'Submit profile' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))

    fireEvent.click(screen.getByRole('button', { name: 'Set visibility success' }))

    await waitFor(() => {
      const roleCodeInput = screen.getByText('Role code').closest('label')?.querySelector('input')
      expect(roleCodeInput).not.toBeNull()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Submit profile' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    expect(screen.getByText('Required')).toBeInTheDocument()
  })

  it('blocks submit for repeater form fields whose visibility depends on the current item context', async () => {
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
                  source: 'queries.profiles.data',
                  key: 'id',
                },
                template: [
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
                        type: 'input',
                        visibility: {
                          reference: 'item.requiresCode',
                          operator: 'equals',
                          value: true,
                        },
                        props: {
                          fieldId: 'roleCode',
                          label: 'Role code',
                          defaultValue: '',
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
                ],
              },
            },
          ],
        },
      ],
    }

    globalThis.fetch = fetchMock

    render(
      <RuntimeStateProvider config={config}>
        <RepeaterFormFixture />
      </RuntimeStateProvider>,
    )

    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Role code' })).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: 'Submit profile' }))

    await waitFor(() => expect(screen.getByText('Required')).toBeInTheDocument())
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
