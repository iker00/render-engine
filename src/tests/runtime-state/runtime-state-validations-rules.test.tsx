import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RuntimeConfig } from '../../config/runtime-config'
import type { RuntimeState } from '../../runtime/runtime-state/runtime-state-types'
import {
  getValidationErrorForEditedField,
  type ResolvedFormFieldDefinition,
} from '../../runtime/runtime-form-validations'
import { RuntimeStateProvider } from '../../runtime/runtime-state/runtime-state-provider'
import { RuntimePage } from '../../runtime/runtime-page'
import { RuntimeStateSnapshot, VisibilityRuleQueryFixture } from './helpers'

afterEach(() => {
  window.history.replaceState(null, '', window.location.pathname + window.location.search)
})

describe('Runtime shared state store', () => {
  it('initializes visibility-controlled fields lazily, keeps queryStateFeedback precedence, and supports length-based rules for input textarea and select', async () => {
    const config: RuntimeConfig = {
      api: {},
      initialPage: 'home',
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'form',
              id: 'profileForm',
              children: [
                {
                  type: 'select',
                  props: {
                    fieldId: 'role',
                    label: 'Role',
                    defaultValue: '',
                    items: [
                      { label: '', value: '' },
                      { label: 'Admin', value: 'admin' },
                    ],
                  },
                },
                {
                  type: 'input',
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
                  visibility: {
                    reference: 'forms.profileForm.role',
                    operator: 'equals',
                    value: 'admin',
                  },
                  props: {
                    fieldId: 'secretCode',
                    label: 'Secret code',
                    defaultValue: 'queries.selectedUser.data.profile.nickname',
                  },
                },
                {
                  type: 'textarea',
                  visibility: {
                    reference: 'queries.thresholdQuery.data',
                    operator: 'greaterThan',
                    value: 1,
                  },
                  props: {
                    fieldId: 'notes',
                    label: 'Notes',
                    defaultValue: '',
                  },
                },
                {
                  type: 'select',
                  visibility: {
                    reference: 'queries.thresholdQuery.data',
                    operator: 'lessThan',
                    value: 1,
                  },
                  props: {
                    fieldId: 'reviewer',
                    label: 'Reviewer',
                    defaultValue: '',
                    items: [
                      { label: '', value: '' },
                      { label: 'Lead', value: 'lead' },
                    ],
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
        <VisibilityRuleQueryFixture />
      </RuntimeStateProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Seed conditional selected user' }))
    fireEvent.change(screen.getByRole('combobox', { name: 'Role' }), { target: { value: 'admin' } })

    expect(screen.queryByRole('textbox', { name: 'Secret code' })).not.toBeInTheDocument()
    expect(screen.getByTestId('runtime-state')).not.toHaveTextContent('"secretCode"')

    fireEvent.click(screen.getByRole('button', { name: 'Set conditional visibility success' }))

    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Secret code' })).toHaveValue('Countess'))
    expect(screen.getByTestId('runtime-state')).toHaveTextContent('"secretCode":{"value":"Countess"')

    expect(screen.queryByRole('textbox', { name: 'Notes' })).not.toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: 'Reviewer' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Seed threshold list' }))

    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Notes' })).toBeInTheDocument())
    expect(screen.queryByRole('combobox', { name: 'Reviewer' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Seed threshold empty list' }))

    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Reviewer' })).toBeInTheDocument())
    expect(screen.queryByRole('textbox', { name: 'Notes' })).not.toBeInTheDocument()
  })

  it('applies ordered local validations on submit for text, number, and multiselect fields', async () => {
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
                    fieldId: 'username',
                    label: 'Username',
                    defaultValue: '',
                    validations: {
                      minLength: { value: 3 },
                      required: { value: true },
                      maxLength: { value: 5 },
                    },
                  },
                },
                {
                  type: 'input',
                  props: {
                    fieldId: 'age',
                    label: 'Age',
                    inputType: 'number',
                    defaultValue: 16,
                    validations: {
                      min: { value: 18 },
                      max: { value: 65 },
                    },
                  },
                },
                {
                  type: 'checkboxGroup',
                  props: {
                    fieldId: 'scopes',
                    label: 'Scopes',
                    optionLayout: 'inline',
                    defaultValue: ['read'],
                    items: [
                      { label: 'Read', value: 'read' },
                      { label: 'Write', value: 'write' },
                      { label: 'Deploy', value: 'deploy' },
                      { label: 'Audit', value: 'audit' },
                    ],
                    validations: {
                      minSelections: { value: 2 },
                      maxSelections: { value: 3 },
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
        <RuntimePage />
      </RuntimeStateProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Submit profile' }))

    await waitFor(() => {
      expect(screen.getByText('Must be at least 3 characters.')).toBeInTheDocument()
      expect(screen.getByText('Must be at least 18.')).toBeInTheDocument()
      expect(screen.getByText('Select at least 2 options.')).toBeInTheDocument()
    })
    expect(fetchMock).not.toHaveBeenCalled()

    fireEvent.change(screen.getByRole('textbox', { name: /Username/ }), { target: { value: 'abcdef' } })
    fireEvent.change(screen.getByRole('spinbutton', { name: /Age/ }), { target: { value: '70' } })
    fireEvent.click(screen.getByLabelText('Write'))
    fireEvent.click(screen.getByLabelText('Deploy'))
    fireEvent.click(screen.getByLabelText('Audit'))

    fireEvent.click(screen.getByRole('button', { name: 'Submit profile' }))

    await waitFor(() => {
      expect(screen.getByText('Must be at most 5 characters.')).toBeInTheDocument()
      expect(screen.getByText('Must be at most 65.')).toBeInTheDocument()
      expect(screen.getByText('Select no more than 3 options.')).toBeInTheDocument()
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('ignores hidden advanced validation rules during submit while preserving the hidden field error state', async () => {
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
                    fieldId: 'secret',
                    label: 'Secret',
                    defaultValue: '',
                    validations: {
                      minLength: { value: 4 },
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
        <RuntimePage />
        <RuntimeStateSnapshot testId="runtime-state" />
      </RuntimeStateProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Submit profile' }))

    await waitFor(() => expect(screen.getByText('Must be at least 4 characters.')).toBeInTheDocument())
    expect(fetchMock).not.toHaveBeenCalled()

    fireEvent.change(screen.getByRole('combobox', { name: 'Role' }), { target: { value: 'editor' } })

    await waitFor(() => expect(screen.queryByRole('textbox', { name: 'Secret' })).not.toBeInTheDocument())
    expect(screen.getByTestId('runtime-state')).toHaveTextContent('"secret":{"value":"","error":"Must be at least 4 characters."')

    fireEvent.click(screen.getByRole('button', { name: 'Submit profile' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
  })

  it('preserves the previous field error when editing causes that same field to become hidden', () => {
    const fieldDefinition: ResolvedFormFieldDefinition = {
      fieldId: 'secret',
      type: 'input',
      validations: {
        minLength: { value: 6 },
      },
      visibility: {
        reference: 'forms.profileForm.secret',
        operator: 'notEquals',
        value: 'hide',
      },
      multiple: false,
      defaultValue: 'abc',
      inputType: 'text',
    }

    const state: RuntimeState = {
      navigation: {
        currentPageId: 'home',
        history: [{ entryId: 0, pageId: 'home', params: {} }],
        lastError: null,
      },
      forms: {
        profileForm: {
          secret: {
            value: 'abc',
            error: 'Must be at least 6 characters.',
            touched: false,
            dirty: true,
            defaultValue: 'abc',
          },
        },
      },
      queries: {},
      pageEntry: {
        entryId: 0,
        pageId: 'home',
        params: {},
        preloadNames: [],
        status: 'idle',
      },
    }

    expect(
      getValidationErrorForEditedField({
        fieldDefinition,
        formId: 'profileForm',
        state,
        nextValue: 'hide',
      }),
    ).toBe('Must be at least 6 characters.')
  })

  it('reevaluates edited multiselect fields against their normalized effective value', () => {
    const fieldDefinition: ResolvedFormFieldDefinition = {
      fieldId: 'scopes',
      type: 'checkboxGroup',
      validations: {
        minSelections: { value: 2 },
      },
      items: [
        { label: 'Read', value: 'read' },
        { label: 'Write', value: 'write' },
      ],
      multiple: true,
      defaultValue: [],
    }

    const state: RuntimeState = {
      navigation: {
        currentPageId: 'home',
        history: [{ entryId: 0, pageId: 'home', params: {} }],
        lastError: null,
      },
      forms: {
        profileForm: {
          scopes: {
            value: [],
            error: 'Select at least 2 options.',
            touched: false,
            dirty: true,
            defaultValue: [],
          },
        },
      },
      queries: {},
      pageEntry: {
        entryId: 0,
        pageId: 'home',
        params: {},
        preloadNames: [],
        status: 'idle',
      },
    }

    expect(
      getValidationErrorForEditedField({
        fieldDefinition,
        formId: 'profileForm',
        state,
        nextValue: ['read', 'missing'],
      }),
    ).toBe('Select at least 2 options.')
  })

  it('reevaluates field errors locally instead of clearing them blindly while editing', async () => {
    const config: RuntimeConfig = {
      api: {},
      initialPage: 'home',
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'form',
              id: 'profileForm',
              children: [
                {
                  type: 'input',
                  props: {
                    fieldId: 'username',
                    label: 'Username',
                    defaultValue: '',
                    validations: {
                      minLength: { value: 3 },
                      maxLength: { value: 5 },
                    },
                  },
                },
                {
                  type: 'checkboxGroup',
                  props: {
                    fieldId: 'scopes',
                    label: 'Scopes',
                    defaultValue: [],
                    items: [
                      { label: 'Read', value: 'read' },
                      { label: 'Write', value: 'write' },
                      { label: 'Deploy', value: 'deploy' },
                      { label: 'Audit', value: 'audit' },
                    ],
                    validations: {
                      minSelections: { value: 2 },
                      maxSelections: { value: 3 },
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

    render(
      <RuntimeStateProvider config={config}>
        <RuntimePage />
      </RuntimeStateProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Submit profile' }))

    await waitFor(() => {
      expect(screen.getByText('Must be at least 3 characters.')).toBeInTheDocument()
      expect(screen.getByText('Select at least 2 options.')).toBeInTheDocument()
    })

    fireEvent.change(screen.getByRole('textbox', { name: /Username/ }), { target: { value: 'ab' } })
    fireEvent.click(screen.getByLabelText('Read'))

    expect(screen.getByText('Must be at least 3 characters.')).toBeInTheDocument()
    expect(screen.getByText('Select at least 2 options.')).toBeInTheDocument()

    fireEvent.change(screen.getByRole('textbox', { name: /Username/ }), { target: { value: 'abc' } })
    fireEvent.click(screen.getByLabelText('Write'))

    await waitFor(() => {
      expect(screen.queryByText('Must be at least 3 characters.')).not.toBeInTheDocument()
      expect(screen.queryByText('Select at least 2 options.')).not.toBeInTheDocument()
    })

    fireEvent.change(screen.getByRole('textbox', { name: /Username/ }), { target: { value: 'abcdef' } })
    fireEvent.click(screen.getByLabelText('Deploy'))
    fireEvent.click(screen.getByLabelText('Audit'))
    fireEvent.click(screen.getByRole('button', { name: 'Submit profile' }))

    await waitFor(() => {
      expect(screen.getByText('Must be at most 5 characters.')).toBeInTheDocument()
      expect(screen.getByText('Select no more than 3 options.')).toBeInTheDocument()
    })

    fireEvent.change(screen.getByRole('textbox', { name: /Username/ }), { target: { value: 'abcd' } })
    fireEvent.click(screen.getByLabelText('Audit'))

    await waitFor(() => {
      expect(screen.queryByText('Must be at most 5 characters.')).not.toBeInTheDocument()
      expect(screen.queryByText('Select no more than 3 options.')).not.toBeInTheDocument()
    })
  })
})
