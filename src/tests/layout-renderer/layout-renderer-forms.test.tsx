import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { useEffect } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RuntimeConfig, RuntimePageConfig } from '../../config/runtime-config'
import { RuntimePage } from '../../runtime/runtime-page'
import { RuntimeStateContext } from '../../runtime/runtime-state/runtime-state-context'
import { createRuntimeState } from '../../runtime/runtime-state/runtime-state-reducer'
import type { RuntimeState, RuntimeStateAction } from '../../runtime/runtime-state/runtime-state-types'
import {
  RuntimeStateProvider,
  useRuntimeStateActions,
} from '../../runtime/runtime-state/runtime-state-provider'

afterEach(() => {
  vi.unstubAllGlobals()
})

function renderRuntimePageWithState(activePage: RuntimePageConfig, state: RuntimeState) {
  const config: RuntimeConfig = {
    api: {},
    initialPage: activePage.id,
    pages: [activePage],
  }
  const dispatch = vi.fn<(action: RuntimeStateAction) => void>()
  const dispatchAndSyncState = vi.fn<(action: RuntimeStateAction) => void>()

  return {
    ...render(
      <RuntimeStateContext.Provider
        value={{
          config,
          initialState: state,
          state,
          dispatch,
          dispatchAndSyncState,
          getLatestState: () => state,
        }}
      >
        <RuntimePage />
      </RuntimeStateContext.Provider>,
    ),
    dispatch,
    dispatchAndSyncState,
  }
}

function createRuntimePageState(
  activePage: RuntimePageConfig,
  queries: RuntimeState['queries'],
  navigation?: RuntimeState['navigation'],
) {
  const config: RuntimeConfig = {
    api: {},
    initialPage: activePage.id,
    pages: [activePage],
  }

  const baseState = createRuntimeState(config)

  return {
    ...baseState,
    queries,
    navigation: navigation ?? baseState.navigation,
    pageEntry: {
      ...baseState.pageEntry,
      pageId: (navigation ?? baseState.navigation).currentPageId,
      params: navigation?.history[navigation.history.length - 1]?.params ?? baseState.pageEntry.params,
    },
  } satisfies RuntimeState
}

function RuntimeFormQueryControls() {
  const { initializeQuery, setQuerySuccess } = useRuntimeStateActions()

  useEffect(() => {
    initializeQuery('selectedUser')
    initializeQuery('submitProfile')
  }, [initializeQuery])

  return (
    <>
      <button
        type="button"
        onClick={() =>
          setQuerySuccess('selectedUser', {
            profile: {
              nickname: 'Countess',
            },
          })
        }
      >
        Seed selected user
      </button>
      <button
        type="button"
        onClick={() =>
          setQuerySuccess('submitProfile', {
            ok: true,
          })
        }
      >
        Seed submit success
      </button>
    </>
  )
}

function renderRuntimeFormPage(activePage: RuntimePageConfig) {
  const config: RuntimeConfig = {
    api: {
      submitProfile: {
        method: 'POST',
        endpoint: '/api/profile',
      },
    },
    initialPage: activePage.id,
    pages: [activePage],
  }

  return render(
    <RuntimeStateProvider config={config}>
      <RuntimeFormQueryControls />
      <RuntimePage />
    </RuntimeStateProvider>,
  )
}

describe('RuntimePage', () => {
  it('renders declarative forms and nested fields in order with initialized values', () => {
    renderRuntimeFormPage({
      id: 'profile',
      layout: [
        {
          type: 'form',
          id: 'profile-form',
          children: [
            {
              type: 'heading',
              props: {
                text: 'Profile form',
                level: 2,
              },
            },
            {
              type: 'input',
              props: {
                fieldId: 'name',
                label: 'Name',
                defaultValue: 'Ada',
              },
            },
            {
              type: 'container',
              children: [
                {
                  type: 'textarea',
                  props: {
                    fieldId: 'bio',
                    label: 'Bio',
                    defaultValue: 'Runtime builder',
                  },
                },
                {
                  type: 'select',
                  props: {
                    fieldId: 'role',
                    label: 'Role',
                    defaultValue: 2,
                    items: [
                      { label: '', value: '' },
                      { label: 'Editor', value: 2 },
                      { label: 'Admin', value: 3 },
                    ],
                  },
                },
                {
                  type: 'button',
                  props: {
                    label: 'Aux reset',
                    action: {
                      type: 'resetForm',
                      formId: 'profile-form',
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
    })

    const form = screen.getByTestId('runtime-page').querySelector('form')
    expect(form).not.toBeNull()
    const buttons = within(form!).getAllByRole('button')

    expect(form).toHaveClass(
      'grid',
      'w-full',
      'gap-5',
    )
    expect(form).not.toHaveClass('rounded-form')
    expect(screen.getByLabelText('Bio').closest('[data-layout-node="container"]')?.tagName).toBe('SECTION')
    expect(screen.getByLabelText('Bio').closest('[data-layout-node="container"]')).toHaveClass(
      'flex',
      'flex-col',
      'flex-nowrap',
      'gap-5',
    )
    expect(screen.getByLabelText('Bio').closest('[data-layout-node="container"]')).not.toHaveClass(
      'border-t',
      'pt-5',
      '-mx-5',
      'sm:-mx-6',
    )
    expect(screen.getByRole('heading', { name: 'Profile form', level: 2 })).toBeInTheDocument()
    expect(screen.getByText('Name').closest('[data-layout-node="input"]')).toHaveClass('grid', 'gap-2')
    expect(screen.getByText('Name')).toHaveClass('text-sm', 'font-semibold', 'leading-5', 'text-app-text-strong')
    expect(screen.getByLabelText('Name')).toHaveValue('Ada')
    expect(screen.getByLabelText('Name')).toHaveClass(
      'rounded-control',
      'border-app-border-soft',
      'bg-white',
      'px-4',
      'py-3',
      'sm:px-3.5',
      'sm:py-2.5',
      'text-app-text',
    )
    expect(screen.getByLabelText('Name')).not.toHaveClass('shadow-sm')
    expect(screen.getByLabelText('Bio')).toHaveValue('Runtime builder')
    expect(screen.getByRole('combobox', { name: 'Role' })).toHaveValue('2')
    expect(screen.getByLabelText('Bio')).toHaveClass('rounded-control', 'bg-white', 'min-h-28', 'sm:min-h-32')
    expect(screen.getByLabelText('Bio')).not.toHaveClass('shadow-sm')
    expect(screen.getByRole('combobox', { name: 'Role' })).toHaveClass(
      'rounded-control',
      'bg-white',
      'appearance-none',
      'pr-12',
      'sm:px-3.5',
      'sm:py-2.5',
    )
    expect(screen.getByRole('combobox', { name: 'Role' })).not.toHaveClass('shadow-sm')
    expect(buttons[0]).toHaveClass('bg-blue-600', 'text-white', 'sm:px-3.5', 'sm:py-2.5')
    expect(buttons[1]).toHaveClass('bg-blue-600', 'text-white', 'sm:px-3.5', 'sm:py-2.5')
    expect(buttons[0]).toHaveTextContent('Aux reset')
    expect(buttons[1]).toHaveTextContent('Submit profile')
  })

  it('renders interpolated button and form labels from current form state without changing controls', async () => {
    renderRuntimeFormPage({
      id: 'interpolated-form-labels',
      layout: [
        {
          type: 'form',
          id: 'profile-form',
          children: [
            {
              type: 'input',
              props: {
                fieldId: 'type',
                label: 'Type',
                defaultValue: 'general',
              },
            },
            {
              type: 'input',
              props: {
                fieldId: 'name',
                label: 'Name for {{forms.profile-form.type}}',
              },
            },
            {
              type: 'textarea',
              props: {
                fieldId: 'bio',
                label: 'Bio for {{forms.profile-form.type}}',
              },
            },
            {
              type: 'select',
              props: {
                fieldId: 'role',
                label: 'Role for {{forms.profile-form.type}}',
                items: {
                  values: ['admin', 'editor'],
                },
              },
            },
            {
              type: 'radioGroup',
              props: {
                fieldId: 'contact',
                label: 'Contact for {{forms.profile-form.type}}',
                items: [
                  { label: 'Email', value: 'email' },
                  { label: 'Phone', value: 'phone' },
                ],
              },
            },
            {
              type: 'checkboxGroup',
              props: {
                fieldId: 'teams',
                label: 'Teams for {{forms.profile-form.missing}}',
                items: {
                  values: ['alpha', 'beta'],
                },
              },
            },
            {
              type: 'button',
              props: {
                label: 'Reset {{forms.profile-form.type}}',
                action: {
                  type: 'resetForm',
                  formId: 'profile-form',
                },
              },
            },
            {
              type: 'button',
              props: {
                label: 'Save {{forms.profile-form.type}}',
              },
            },
          ],
        },
      ],
    })

    const typeInput = await screen.findByLabelText('Type')
    await waitFor(() => expect(screen.getByLabelText('Name for general')).toBeInTheDocument())

    fireEvent.change(typeInput, { target: { value: 'urgent' } })

    await waitFor(() => expect(screen.getByLabelText('Name for urgent')).toBeInTheDocument())
    expect(screen.getByLabelText('Bio for urgent')).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Role for urgent' })).not.toHaveAttribute('aria-label')
    expect(screen.getByRole('combobox', { name: 'Role for urgent' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Contact for urgent' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Teams for' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reset urgent' })).toHaveAttribute('type', 'button')
    expect(screen.getByRole('button', { name: 'Save urgent' })).toHaveAttribute('type', 'submit')
  })

  it('keeps partial template strings literal in form submitAction query body and headers', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    renderRuntimeFormPage({
      id: 'literal-submit-templates',
      layout: [
        {
          type: 'form',
          id: 'profile-form',
          submitAction: {
            type: 'executeOperation',
            operationName: 'submitProfile',
            query: {
              name: 'prefix-{{forms.profile-form.name}}',
            },
            headers: {
              authorization: 'Bearer {{forms.profile-form.name}}',
            },
            body: {
              name: 'prefix-{{forms.profile-form.name}}',
            },
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
                label: 'Submit profile',
              },
            },
          ],
        },
      ],
    })

    await waitFor(() => expect(screen.getByLabelText('Name')).toHaveValue('Ada'))
    fireEvent.click(screen.getByRole('button', { name: 'Submit profile' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/profile?name=prefix-%7B%7Bforms.profile-form.name%7D%7D')
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      method: 'POST',
      headers: {
        authorization: 'Bearer {{forms.profile-form.name}}',
        'content-type': 'application/json',
      },
    })
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      name: 'prefix-{{forms.profile-form.name}}',
    })
  })

  it('uses repeater item context for interpolated field and button labels', () => {
    const activePage: RuntimePageConfig = {
      id: 'interpolated-repeater-labels',
      layout: [
        {
          type: 'button',
          props: {
            label: 'Outside {{item.id}}',
            action: {
              type: 'goBack',
            },
          },
        },
        {
          type: 'form',
          id: 'post-form',
          children: [
            {
              type: 'repeater',
              props: {
                items: {
                  source: 'queries.posts.data.results',
                  key: 'id',
                },
                template: [
                  {
                    type: 'input',
                    props: {
                      fieldId: 'note',
                      label: 'Note {{item.code}}',
                    },
                  },
                  {
                    type: 'button',
                    props: {
                      label: 'Review {{item.id}}',
                      action: {
                        type: 'resetForm',
                        formId: 'post-form',
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

    renderRuntimePageWithState(
      activePage,
      createRuntimePageState(activePage, {
        posts: {
          status: 'success',
          data: {
            results: [
              {
                id: 'post-1',
                code: 'A1',
              },
              {
                id: 'post-2',
                code: 'G2',
              },
            ],
          },
          error: null,
        },
      }),
    )

    expect(screen.getByRole('button', { name: 'Outside' })).toHaveAttribute('type', 'button')
    expect(screen.getByLabelText('Note A1')).toBeInTheDocument()
    expect(screen.getByLabelText('Note G2')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Review post-1' })).toHaveAttribute('type', 'button')
    expect(screen.getByRole('button', { name: 'Review post-2' })).toHaveAttribute('type', 'button')
  })

  it('keeps form section semantics when a container uses columns and direction together', () => {
    renderRuntimeFormPage({
      id: 'profile-columns',
      layout: [
        {
          type: 'form',
          id: 'profile-form',
          children: [
            {
              type: 'container',
              props: {
                direction: 'row',
                columns: 2,
                align: 'center',
                justify: 'between',
                gap: 'xl',
              },
              children: [
                {
                  type: 'textarea',
                  props: {
                    fieldId: 'bio',
                    label: 'Bio',
                    defaultValue: 'Runtime builder',
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
              ],
            },
          ],
        },
      ],
    })

    const container = screen.getByLabelText('Bio').closest('[data-layout-node="container"]')

    expect(container?.tagName).toBe('SECTION')
    expect(container).toHaveClass(
      'grid',
      'w-full',
      'grid-cols-2',
      'items-center',
      'justify-between',
      'gap-10',
    )
    expect(container).not.toHaveClass('border-t', 'pt-5', '-mx-5', 'sm:-mx-6')
    expect(container).not.toHaveClass('flex-row')
    expect(screen.getByLabelText('Bio')).toHaveValue('Runtime builder')
    expect(screen.getByRole('combobox', { name: 'Role' })).toHaveValue('admin')
  })

  it('keeps row containers inside forms as plain linear layout without section bleed', () => {
    renderRuntimeFormPage({
      id: 'profile-actions',
      layout: [
        {
          type: 'form',
          id: 'profile-form',
          children: [
            {
              type: 'container',
              props: {
                direction: 'row',
                gap: 'sm',
                justify: 'between',
              },
              children: [
                {
                  type: 'button',
                  props: {
                    label: 'Cancel',
                    action: {
                      type: 'resetForm',
                      formId: 'profile-form',
                    },
                  },
                },
                {
                  type: 'button',
                  props: {
                    label: 'Save',
                  },
                },
              ],
            },
          ],
        },
      ],
    })

    const container = screen.getByRole('button', { name: 'Save' }).closest('[data-layout-node="container"]')

    expect(container?.tagName).toBe('SECTION')
    expect(container).toHaveClass(
      'flex',
      'w-full',
      'flex-row',
      'justify-between',
      'flex-nowrap',
      'gap-3',
    )
    expect(container).not.toHaveClass(
      'border-t',
      'border-app-border-soft',
      '-mx-5',
      'sm:-mx-6',
    )
  })

  it('lets card containers inside forms replace the implicit form-section surface', () => {
    renderRuntimeFormPage({
      id: 'profile-card',
      layout: [
        {
          type: 'form',
          id: 'profile-form',
          children: [
            {
              type: 'container',
              props: {
                variant: 'card',
                columns: 2,
                gap: 'lg',
              },
              children: [
                {
                  type: 'textarea',
                  props: {
                    fieldId: 'bio',
                    label: 'Bio',
                    defaultValue: 'Runtime builder',
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
              ],
            },
          ],
        },
      ],
    })

    const container = screen.getByLabelText('Bio').closest('[data-layout-node="container"]')

    expect(container).toHaveClass(
      'grid',
      'w-full',
      'grid-cols-2',
      'rounded-section',
      'border',
      'border-app-border-soft',
      'bg-white',
      'p-4',
      'shadow-section',
      'gap-8',
    )
    expect(container).not.toHaveClass('border-t', 'pt-5', 'sm:pt-6')
  })
})
