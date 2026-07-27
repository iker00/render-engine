import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { useEffect } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RuntimeConfig, RuntimePageConfig } from '../../config/runtime-config'
import { RuntimePage } from '../../runtime/runtime-page'
import { RuntimeStateContext } from '../../runtime/runtime-state/runtime-state-context'
import { createRuntimeState, runtimeStateReducer } from '../../runtime/runtime-state/runtime-state-reducer'
import type { RuntimeState, RuntimeStateAction } from '../../runtime/runtime-state/runtime-state-types'
import {
  RuntimeStateProvider,
  useRuntimeStateActions,
} from '../../runtime/runtime-state/runtime-state-provider'

afterEach(() => {
  vi.unstubAllGlobals()
})

function renderRuntimePage(activePage: RuntimePageConfig) {
  const config: RuntimeConfig = {
    api: {},
    initialPage: activePage.id,
    pages: [activePage],
  }

  return render(
    <RuntimeStateProvider config={config}>
      <RuntimePage />
    </RuntimeStateProvider>,
  )
}

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

function seedRuntimeState(state: RuntimeState) {
  return [
    {
      type: 'forms/initialize',
      payload: {
        formId: 'userSearch',
        fields: {
          name: {
            defaultValue: 'Ada',
          },
        },
      },
    },
    {
      type: 'forms/set-value',
      payload: {
        formId: 'userSearch',
        fieldId: 'name',
        value: 'Grace',
      },
    },
    {
      type: 'queries/initialize',
      payload: {
        queryName: 'searchUsers',
      },
    },
    {
      type: 'queries/set-success',
      payload: {
        queryName: 'searchUsers',
        data: {
          user: {
            profile: {
              name: 'Ada',
              active: true,
            },
          },
          results: [
            {
              id: 'user-1',
              name: 'Ada',
            },
            {
              id: 'user-2',
              name: 'Grace',
            },
          ],
          stats: {
            total: 2,
          },
        },
      },
    },
    {
      type: 'queries/set-error',
      payload: {
        queryName: 'searchUsers',
        error: {
          code: 'network',
          message: 'Could not load users.',
        },
      },
    },
  ].reduce(runtimeStateReducer, state)
}

function renderRuntimePageWithSeed(activePage: RuntimePageConfig) {
  const config: RuntimeConfig = {
    api: {},
    initialPage: activePage.id,
    pages: [activePage],
  }
  const initialState = createRuntimeState(config)
  const seededState = seedRuntimeState(initialState)
  const dispatch = vi.fn<(action: RuntimeStateAction) => void>()
  const dispatchAndSyncState = vi.fn<(action: RuntimeStateAction) => void>()

  return render(
    <RuntimeStateContext.Provider
      value={{
        config,
        initialState: seededState,
        state: seededState,
        dispatch,
        dispatchAndSyncState,
        getLatestState: () => seededState,
      }}
    >
        <RuntimePage />
    </RuntimeStateContext.Provider>,
  )
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

function CollectionSourceControls() {
  const { initializeQuery, setQuerySuccess } = useRuntimeStateActions()

  useEffect(() => {
    initializeQuery('searchUsers')
  }, [initializeQuery])

  return (
    <>
      <button type="button" onClick={() => setQuerySuccess('searchUsers', ['Ada', 'Grace'])}>
        Seed scalar results
      </button>
      <button
        type="button"
        onClick={() =>
          setQuerySuccess('searchUsers', {
            results: [
              {
                id: 'user-1',
                profile: {
                  name: 'Ada',
                },
                meta: {
                  role: 'Admin',
                },
              },
              {
                id: 'user-2',
                profile: {
                  name: 'Grace',
                },
                meta: {
                  role: 'Editor',
                },
              },
            ],
          })
        }
      >
        Seed object results
      </button>
      <button
        type="button"
        onClick={() =>
          setQuerySuccess('searchUsers', {
            results: [
              {
                id: 'user-1',
                profile: {
                  name: 'Ada',
                },
              },
              {
                id: 'broken-user',
              },
              {
                id: 'user-2',
                profile: {
                  name: 'Grace',
                },
              },
            ],
          })
        }
      >
        Seed partial object results
      </button>
      <button
        type="button"
        onClick={() =>
          setQuerySuccess('searchUsers', {
            results: {
              profile: {
                name: 'Not a collection',
              },
            },
          })
        }
      >
        Seed non-collection results
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

function renderRuntimePageWithCollectionControls(activePage: RuntimePageConfig) {
  const config: RuntimeConfig = {
    api: {},
    initialPage: activePage.id,
    pages: [activePage],
  }

  return render(
    <RuntimeStateProvider config={config}>
      <CollectionSourceControls />
      <RuntimePage />
    </RuntimeStateProvider>,
  )
}

function renderRuntimePageWithCollectionControlsAndApi(activePage: RuntimePageConfig) {
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
      <CollectionSourceControls />
      <RuntimePage />
    </RuntimeStateProvider>,
  )
}

describe('RuntimePage', () => {
  it('renders expanded form fields including native input types, select.multiple, radioGroup and checkboxGroup', () => {
    renderRuntimeFormPage({
      id: 'expanded-form',
      layout: [
        {
          type: 'form',
          id: 'profile-form',
          children: [
            {
              type: 'input',
              props: {
                fieldId: 'age',
                label: 'Age',
                inputType: 'number',
                defaultValue: 42,
              },
            },
            {
              type: 'input',
              props: {
                fieldId: 'birthday',
                label: 'Birthday',
                inputType: 'date',
                defaultValue: '2026-05-07',
              },
            },
            {
              type: 'input',
              props: {
                fieldId: 'appointmentAt',
                label: 'Appointment',
                inputType: 'datetime-local',
                defaultValue: '2026-05-07T12:30',
              },
            },
            {
              type: 'select',
              props: {
                fieldId: 'scopes',
                label: 'Scopes',
                multiple: true,
                defaultValue: ['write', 'read'],
                items: {
                  values: ['read', 'write', 'publish'],
                },
              },
            },
            {
              type: 'radioGroup',
              props: {
                fieldId: 'role',
                label: 'Role',
                defaultValue: 'editor',
                items: [
                  { label: 'Admin', value: 'admin' },
                  { label: 'Editor', value: 'editor' },
                ],
              },
            },
            {
              type: 'checkboxGroup',
              props: {
                fieldId: 'teams',
                label: 'Teams',
                defaultValue: ['beta', 'alpha'],
                items: {
                  values: ['alpha', 'beta', 'gamma'],
                },
              },
            },
          ],
        },
      ],
    })

    expect(screen.getByLabelText('Age')).toHaveValue(42)
    expect(screen.getByLabelText('Birthday')).toHaveValue('2026-05-07')
    expect(screen.getByLabelText('Appointment')).toHaveValue('2026-05-07T12:30')
    expect(screen.getByRole('radio', { name: 'Admin' }).closest('div')).toHaveClass('grid', 'gap-2.5')
    expect(screen.getByRole('checkbox', { name: 'alpha' }).closest('div')).toHaveClass('grid', 'gap-2.5')
    expect(screen.getByRole('radio', { name: 'Admin' }).closest('label')).not.toHaveClass('border')
    expect(screen.getByRole('checkbox', { name: 'alpha' }).closest('label')).not.toHaveClass('border')
    expect(screen.getByRole('listbox', { name: 'Scopes' })).toBeInTheDocument()
    expect(within(screen.getByRole('listbox', { name: 'Scopes' })).getAllByRole('option', { selected: true }).map((option) => option.textContent)).toEqual([
      'read',
      'write',
    ])
    expect(screen.getByRole('radio', { name: 'Editor' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'alpha' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'beta' })).toBeChecked()
  })

  it('renders inline and vertical choice groups side by side without cross-contaminating classes', () => {
    renderRuntimeFormPage({
      id: 'mixed-choice-layouts',
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
                items: [
                  { label: 'Administrator with a long label that can wrap on small widths', value: 'admin' },
                  { label: 'Editor', value: 'editor' },
                ],
              },
            },
            {
              type: 'checkboxGroup',
              props: {
                fieldId: 'teams',
                label: 'Teams',
                items: {
                  values: ['alpha', 'beta', 'gamma'],
                },
              },
            },
          ],
        },
      ],
    })

    const inlineRadioGroup = screen.getByRole('radio', { name: 'Administrator with a long label that can wrap on small widths' }).closest('div')
    const verticalCheckboxGroup = screen.getByRole('checkbox', { name: 'alpha' }).closest('div')

    expect(inlineRadioGroup).toHaveClass('flex', 'flex-wrap', 'gap-x-4', 'gap-y-2.5')
    expect(verticalCheckboxGroup).toHaveClass('grid', 'gap-2.5')
    expect(verticalCheckboxGroup).not.toHaveClass('flex-wrap')
    expect(screen.getByRole('group', { name: 'Role' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Teams' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Administrator with a long label that can wrap on small widths' }).closest('label')).toHaveClass(
      'max-w-full',
      'items-start',
    )
  })

  it('renders dynamic scalar and object select options from query-backed collections', () => {
    renderRuntimePageWithCollectionControls({
      id: 'dynamic-selects',
      layout: [
        {
          type: 'form',
          id: 'catalog-form',
          children: [
            {
              type: 'select',
              props: {
                fieldId: 'scalarRole',
                label: 'Scalar role',
                items: {
                  source: 'queries.searchUsers.data',
                  itemType: 'scalar',
                },
              },
            },
            {
              type: 'select',
              props: {
                fieldId: 'objectRole',
                label: 'Object role',
                items: {
                  source: 'queries.searchUsers.data.results',
                  itemType: 'object',
                  label: 'profile.name',
                  value: 'id',
                },
              },
            },
          ],
        },
      ],
    })

    expect(
      within(screen.getByRole('combobox', { name: 'Scalar role' })).getAllByRole('option').map((option) => option.textContent),
    ).toEqual([''])
    expect(
      within(screen.getByRole('combobox', { name: 'Object role' })).getAllByRole('option').map((option) => option.textContent),
    ).toEqual([''])

    fireEvent.click(screen.getByRole('button', { name: 'Seed scalar results' }))

    expect(
      within(screen.getByRole('combobox', { name: 'Scalar role' })).getAllByRole('option').map((option) => option.textContent),
    ).toEqual(['', 'Ada', 'Grace'])

    fireEvent.click(screen.getByRole('button', { name: 'Seed object results' }))

    expect(
      within(screen.getByRole('combobox', { name: 'Object role' })).getAllByRole('option').map((option) => option.textContent),
    ).toEqual(['', 'Ada', 'Grace'])
  })

  it('renders radioGroup and checkboxGroup dynamic scalar options from query-backed collections', () => {
    renderRuntimePageWithCollectionControls({
      id: 'dynamic-choice-groups-scalar',
      layout: [
        {
          type: 'form',
          id: 'catalog-form',
          children: [
            {
              type: 'radioGroup',
              props: {
                fieldId: 'scalarRole',
                label: 'Scalar role',
                items: {
                  source: 'queries.searchUsers.data',
                  itemType: 'scalar',
                },
              },
            },
            {
              type: 'checkboxGroup',
              props: {
                fieldId: 'scalarRoles',
                label: 'Scalar roles',
                items: {
                  source: 'queries.searchUsers.data',
                  itemType: 'scalar',
                },
              },
            },
          ],
        },
      ],
    })

    expect(screen.queryAllByRole('radio')).toHaveLength(0)
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0)

    fireEvent.click(screen.getByRole('button', { name: 'Seed scalar results' }))

    expect(screen.getAllByRole('radio').map((radio) => radio.getAttribute('value'))).toEqual(['Ada', 'Grace'])
    expect(screen.getAllByRole('radio').map((radio) => radio.parentElement?.textContent)).toEqual(['Ada', 'Grace'])
    expect(screen.getAllByRole('checkbox').map((checkbox) => checkbox.getAttribute('value'))).toEqual(['Ada', 'Grace'])
    expect(screen.getAllByRole('checkbox').map((checkbox) => checkbox.parentElement?.textContent)).toEqual(['Ada', 'Grace'])
  })

  it('uses interpolated dynamic select option labels and values as stored and submitted strings', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    renderRuntimePageWithCollectionControlsAndApi({
      id: 'dynamic-select-submit',
      layout: [
        {
          type: 'form',
          id: 'dynamic-choice-form',
          submitAction: {
            type: 'executeOperation',
            operationName: 'submitProfile',
            body: {
              userKey: 'forms.dynamic-choice-form.userKey',
            },
          },
          children: [
            {
              type: 'select',
              props: {
                fieldId: 'userKey',
                label: 'User',
                items: {
                  source: 'queries.searchUsers.data.results',
                  itemType: 'object',
                  label: '{{item.id}} - {{item.profile.name}}',
                  value: '{{item.meta.role}}:{{item.id}}',
                },
              },
            },
            {
              type: 'button',
              props: {
                label: 'Submit choice',
              },
            },
          ],
        },
      ],
    })

    fireEvent.click(screen.getByRole('button', { name: 'Seed object results' }))

    const select = screen.getByRole('combobox', { name: 'User' })
    expect(within(select).getAllByRole('option').map((option) => option.textContent)).toEqual([
      '',
      'user-1 - Ada',
      'user-2 - Grace',
    ])

    fireEvent.change(select, { target: { value: 'Admin:user-1' } })
    await waitFor(() => expect(select).toHaveValue('Admin:user-1'))

    fireEvent.click(screen.getByRole('button', { name: 'Submit choice' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/profile')
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      method: 'POST',
    })
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      userKey: 'Admin:user-1',
    })
  })

  it('updates interpolated option labels and clears invalid selections when forms or queries change', async () => {
    renderRuntimePageWithCollectionControls({
      id: 'dynamic-choice-cleanup',
      layout: [
        {
          type: 'form',
          id: 'option-form',
          children: [
            {
              type: 'input',
              props: {
                fieldId: 'prefix',
                label: 'Prefix',
                defaultValue: 'A',
              },
            },
            {
              type: 'select',
              props: {
                fieldId: 'choice',
                label: 'Choice',
                items: {
                  source: 'queries.searchUsers.data.results',
                  itemType: 'object',
                  label: '{{forms.option-form.prefix}} {{item.profile.name}}/{{item.meta.role}}',
                  value: '{{forms.option-form.prefix}}:{{item.meta.role}}:{{item.id}}',
                },
              },
            },
          ],
        },
      ],
    })

    fireEvent.click(screen.getByRole('button', { name: 'Seed object results' }))

    const prefixInput = await screen.findByLabelText('Prefix')
    const select = screen.getByRole('combobox', { name: 'Choice' })

    expect(within(select).getAllByRole('option').map((option) => option.textContent)).toEqual([
      '',
      'A Ada/Admin',
      'A Grace/Editor',
    ])

    fireEvent.change(select, { target: { value: 'A:Admin:user-1' } })
    await waitFor(() => expect(select).toHaveValue('A:Admin:user-1'))

    fireEvent.change(prefixInput, { target: { value: 'B' } })

    await waitFor(() => expect(select).toHaveValue(''))
    expect(within(select).getAllByRole('option').map((option) => option.textContent)).toEqual([
      '',
      'B Ada/Admin',
      'B Grace/Editor',
    ])

    fireEvent.change(select, { target: { value: 'B:Admin:user-1' } })
    await waitFor(() => expect(select).toHaveValue('B:Admin:user-1'))

    fireEvent.click(screen.getByRole('button', { name: 'Seed partial object results' }))

    await waitFor(() => expect(select).toHaveValue(''))
    expect(within(select).getAllByRole('option').map((option) => option.textContent)).toEqual([
      '',
      'B Ada/',
      'B /',
      'B Grace/',
    ])
  })

  it('keeps historical option arrays stable while allowing interpolated labels and string values', async () => {
    renderRuntimePage({
      id: 'historical-choice-options',
      layout: [
        {
          type: 'form',
          id: 'choice-form',
          children: [
            {
              type: 'input',
              props: {
                fieldId: 'prefix',
                label: 'Prefix',
                defaultValue: 'A',
              },
            },
            {
              type: 'select',
              props: {
                fieldId: 'legacy',
                label: 'Legacy',
                defaultValue: 7,
                items: [
                  { label: 'Number {{forms.choice-form.prefix}}', value: 7 },
                  { label: 'Interpolated {{forms.choice-form.prefix}}', value: '{{forms.choice-form.prefix}}-{{forms.choice-form.missing}}' },
                  { label: 'Empty {{forms.choice-form.missing}}', value: '{{forms.choice-form.missing}}' },
                  { label: 'Duplicate one', value: 'dup' },
                  { label: 'Duplicate two', value: 'dup' },
                ],
              },
            },
          ],
        },
      ],
    })

    const select = screen.getByRole('combobox', { name: 'Legacy' })
    await waitFor(() => expect(select).toHaveValue('7'))

    const options = within(select).getAllByRole('option')
    expect(options.map((option) => option.textContent)).toEqual([
      'Number A',
      'Interpolated A',
      'Empty ',
      'Duplicate one',
      'Duplicate two',
    ])
    expect(options.map((option) => option.getAttribute('value'))).toEqual(['7', 'A-', '', 'dup', 'dup'])
  })

  it('renders radioGroup and checkboxGroup options from query-backed collections with the shared projection contract', () => {
    renderRuntimePageWithCollectionControls({
      id: 'dynamic-choice-fields',
      layout: [
        {
          type: 'form',
          id: 'catalog-form',
          children: [
            {
              type: 'radioGroup',
              props: {
                fieldId: 'userId',
                label: 'User',
                items: {
                  source: 'queries.searchUsers.data.results',
                  itemType: 'object',
                  label: 'profile.name',
                  value: 'id',
                },
              },
            },
            {
              type: 'checkboxGroup',
              props: {
                fieldId: 'roles',
                label: 'Roles',
                items: {
                  source: 'queries.searchUsers.data.results',
                  itemType: 'object',
                  label: 'meta.role',
                  value: 'id',
                },
              },
            },
          ],
        },
      ],
    })

    fireEvent.click(screen.getByRole('button', { name: 'Seed object results' }))

    expect(screen.getAllByRole('radio').map((radio) => radio.getAttribute('value'))).toEqual(['user-1', 'user-2'])
    expect(screen.getAllByRole('radio').map((radio) => radio.parentElement?.textContent)).toEqual(['Ada', 'Grace'])
    expect(screen.getAllByRole('checkbox').map((checkbox) => checkbox.parentElement?.textContent)).toEqual(['Admin', 'Editor'])
  })

  it('applies interpolated labels and values consistently to radioGroup and checkboxGroup options', () => {
    renderRuntimePage({
      id: 'interpolated-choice-groups',
      layout: [
        {
          type: 'form',
          id: 'choice-groups-form',
          children: [
            {
              type: 'radioGroup',
              props: {
                fieldId: 'flag',
                label: 'Flag',
                items: {
                  values: [
                    {
                      name: 'Zero',
                      value: 0,
                    },
                    {
                      name: 'False',
                      value: false,
                    },
                  ],
                  label: '{{item.name}} {{item.value}}',
                  value: '{{item.value}}',
                },
              },
            },
            {
              type: 'checkboxGroup',
              props: {
                fieldId: 'flags',
                label: 'Flags',
                items: {
                  values: [
                    {
                      name: 'Zero',
                      value: 0,
                    },
                    {
                      name: 'False',
                      value: false,
                    },
                  ],
                  label: '{{item.name}} {{item.value}}',
                  value: '{{item.value}}',
                },
              },
            },
          ],
        },
      ],
    })

    expect(screen.getByRole('radio', { name: 'Zero 0' })).toHaveAttribute('value', '0')
    expect(screen.getByRole('radio', { name: 'False false' })).toHaveAttribute('value', 'false')
    expect(screen.getByRole('checkbox', { name: 'Zero 0' })).toHaveAttribute('value', '0')
    expect(screen.getByRole('checkbox', { name: 'False false' })).toHaveAttribute('value', 'false')
  })

  it('renders inline choice groups from query-backed collections with the same semantic fieldset structure', () => {
    renderRuntimePageWithCollectionControls({
      id: 'dynamic-inline-choice-fields',
      layout: [
        {
          type: 'form',
          id: 'catalog-form',
          children: [
            {
              type: 'radioGroup',
              props: {
                fieldId: 'userId',
                label: 'User',
                optionLayout: 'inline',
                items: {
                  source: 'queries.searchUsers.data.results',
                  itemType: 'object',
                  label: 'profile.name',
                  value: 'id',
                },
              },
            },
            {
              type: 'checkboxGroup',
              props: {
                fieldId: 'roles',
                label: 'Roles',
                optionLayout: 'inline',
                items: {
                  source: 'queries.searchUsers.data.results',
                  itemType: 'object',
                  label: 'meta.role',
                  value: 'id',
                },
              },
            },
          ],
        },
      ],
    })

    fireEvent.click(screen.getByRole('button', { name: 'Seed object results' }))

    expect(screen.getByRole('group', { name: 'User' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Roles' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Ada' }).closest('div')).toHaveClass('flex', 'flex-wrap')
    expect(screen.getByRole('checkbox', { name: 'Admin' }).closest('div')).toHaveClass('flex', 'flex-wrap')
  })

  it('degrades only invalid dynamic object options and reports a development diagnostic for each skipped select item', () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    renderRuntimePageWithCollectionControls({
      id: 'dynamic-object-select-diagnostics',
      layout: [
        {
          type: 'form',
          id: 'diagnostic-form',
          children: [
            {
              type: 'select',
              props: {
                fieldId: 'userId',
                label: 'User',
                items: {
                  source: 'queries.searchUsers.data.results',
                  itemType: 'object',
                  label: 'profile.name',
                  value: 'id',
                },
              },
            },
          ],
        },
      ],
    })

    fireEvent.click(screen.getByRole('button', { name: 'Seed partial object results' }))

    expect(
      within(screen.getByRole('combobox', { name: 'User' })).getAllByRole('option').map((option) => option.textContent),
    ).toEqual(['', 'Ada', 'Grace'])
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      '[runtime-collections] Skipped item at "queries.searchUsers.data.results[1]" for select.props.items because "profile.name|id" could not be resolved.',
    )

    consoleWarnSpy.mockRestore()
  })

  it('lets a list and a select reuse the same query with different projections', () => {
    renderRuntimePageWithCollectionControls({
      id: 'shared-query-consumers',
      layout: [
        {
          type: 'list',
          props: {
            items: {
              source: 'queries.searchUsers.data.results',
              itemText: 'meta.role',
            },
          },
        },
        {
          type: 'form',
          id: 'shared-query-form',
          children: [
            {
              type: 'select',
              props: {
                fieldId: 'userId',
                label: 'User',
                items: {
                  source: 'queries.searchUsers.data.results',
                  itemType: 'object',
                  label: 'profile.name',
                  value: 'id',
                },
              },
            },
          ],
        },
      ],
    })

    fireEvent.click(screen.getByRole('button', { name: 'Seed object results' }))

    expect(within(screen.getByRole('list')).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'Admin',
      'Editor',
    ])
    expect(
      within(screen.getByRole('combobox', { name: 'User' })).getAllByRole('option').map((option) => option.textContent),
    ).toEqual(['', 'Ada', 'Grace'])
  })

  it('resolves dynamic default values only during the first field initialization', () => {
    renderRuntimeFormPage({
      id: 'profile',
      layout: [
        {
          type: 'form',
          id: 'profile-form',
          children: [
            {
              type: 'input',
              props: {
                fieldId: 'nickname',
                label: 'Nickname',
                defaultValue: 'queries.selectedUser.data.profile.nickname',
              },
            },
          ],
        },
      ],
    })

    const nicknameInput = screen.getByLabelText('Nickname')
    expect(nicknameInput).toHaveValue('')

    fireEvent.click(screen.getByRole('button', { name: 'Seed selected user' }))

    expect(nicknameInput).toHaveValue('')
  })

  it('applies a dynamic default value when a hidden field becomes visible for the first time', async () => {
    renderRuntimeFormPage({
      id: 'profile',
      layout: [
        {
          type: 'form',
          id: 'profile-form',
          children: [
            {
              type: 'input',
              queryStateFeedback: {
                query: 'submitProfile',
                states: {
                  success: {
                    mode: 'show',
                  },
                },
              },
              props: {
                fieldId: 'nickname',
                label: 'Nickname',
                defaultValue: 'queries.selectedUser.data.profile.nickname',
              },
            },
          ],
        },
      ],
    })

    fireEvent.click(screen.getByRole('button', { name: 'Seed selected user' }))
    fireEvent.click(screen.getByRole('button', { name: 'Seed submit success' }))

    await waitFor(() => expect(screen.getByLabelText('Nickname')).toHaveValue('Countess'))
  })

  it('renders query-driven text and lazy defaults against a clean loading query state without reviving stale content', () => {
    renderRuntimePageWithState(
      {
        id: 'profile',
        layout: [
          {
            type: 'paragraph',
            queryStateFeedback: {
              query: 'selectedUser',
              states: {
                loading: {
                  mode: 'fallback',
                  fallback: [
                    {
                      type: 'paragraph',
                      props: {
                        text: 'Loading profile...',
                      },
                    },
                  ],
                },
              },
            },
            props: {
              text: 'queries.selectedUser.data.profile.nickname',
            },
          },
          {
            type: 'form',
            id: 'profile-form',
            children: [
              {
                type: 'input',
                props: {
                  fieldId: 'nickname',
                  label: 'Nickname',
                  defaultValue: 'queries.selectedUser.data.profile.nickname',
                },
              },
            ],
          },
        ],
      },
      {
        ...createRuntimeState({
          api: {},
          initialPage: 'profile',
          pages: [
            {
              id: 'profile',
              layout: [],
            },
          ],
        }),
        queries: {
          selectedUser: {
            status: 'loading',
            data: null,
            error: null,
          },
        },
      },
    )

    expect(screen.getByText('Loading profile...')).toBeInTheDocument()
    expect(screen.queryByDisplayValue('Countess')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Nickname')).toHaveValue('')
  })

  it('keeps form fields hidden by queryStateFeedback from rendering until their query becomes visible', () => {
    renderRuntimeFormPage({
      id: 'profile',
      layout: [
        {
          type: 'form',
          id: 'profile-form',
          children: [
            {
              type: 'input',
              queryStateFeedback: {
                query: 'submitProfile',
                states: {
                  success: {
                    mode: 'show',
                  },
                },
              },
              props: {
                fieldId: 'nickname',
                label: 'Nickname',
                defaultValue: 'Ada',
              },
            },
          ],
        },
      ],
    })

    expect(screen.queryByLabelText('Nickname')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Seed submit success' }))

    expect(screen.getByLabelText('Nickname')).toHaveValue('Ada')
  })

  it('renders params in visible text and uses them as lazy defaultValue for form fields', () => {
    const activePage: RuntimePageConfig = {
      id: 'details',
      layout: [
        {
          type: 'heading',
          props: {
            text: 'params.userId',
            level: 1,
          },
        },
        {
          type: 'paragraph',
          props: {
            text: 'params.mode',
          },
        },
        {
          type: 'form',
          id: 'profile-form',
          children: [
            {
              type: 'input',
              props: {
                fieldId: 'nickname',
                label: 'Nickname',
                defaultValue: 'params.userId',
              },
            },
            {
              type: 'textarea',
              props: {
                fieldId: 'bio',
                label: 'Bio',
                defaultValue: 'params.mode',
              },
            },
            {
              type: 'input',
              props: {
                fieldId: 'greeting',
                label: 'Greeting',
                defaultValue: 'Hello {{params.userId}}',
              },
            },
            {
              type: 'select',
              props: {
                fieldId: 'role',
                label: 'Role',
                defaultValue: 'params.mode',
                items: {
                  values: ['edit', 'view'],
                },
              },
            },
          ],
        },
      ],
    }
    const config: RuntimeConfig = {
      api: {},
      initialPage: 'details',
      pages: [activePage],
    }
    const state: RuntimeState = {
      ...createRuntimeState(config),
      navigation: {
        currentPageId: 'details',
        history: [{ entryId: 0, pageId: 'details', params: { userId: 'user-7', mode: 'edit' } }],
        currentEntryIndex: 0,
        lastError: null,
      },
      pageEntry: {
        entryId: 0,
        pageId: 'details',
        params: { userId: 'user-7', mode: 'edit' },
        preloadNames: [],
        status: 'idle',
      },
    }

    renderRuntimePageWithState(activePage, state)

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('user-7')
    expect(screen.getByText('edit', { selector: 'p' })).toBeInTheDocument()
    expect(screen.getByLabelText('Nickname')).toHaveValue('user-7')
    expect(screen.getByLabelText('Bio')).toHaveValue('edit')
    expect(screen.getByLabelText('Greeting')).toHaveValue('Hello {{params.userId}}')
    expect(screen.getByRole('combobox', { name: 'Role' })).toHaveValue('edit')
  })

  it('reports unresolved visible references in development with the source path and surface name', () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    renderRuntimePageWithSeed({
      id: 'diagnostics',
      layout: [
        {
          type: 'heading',
          props: {
            text: 'forms.userSearch.email',
            level: 2,
          },
        },
        {
          type: 'paragraph',
          props: {
            text: 'queries.searchUsers.data.results.3.name',
          },
        },
      ],
    })

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      '[runtime-references] Could not resolve "forms.userSearch.email" for heading.props.text (missing).',
    )
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      '[runtime-references] Could not resolve "queries.searchUsers.data.results.3.name" for paragraph.props.text (missing).',
    )

    consoleWarnSpy.mockRestore()
  })

  it('renders input with stable id and no aria-describedby when there is no error', () => {
    renderRuntimeFormPage({
      id: 'aria-input-no-error',
      layout: [
        {
          type: 'form',
          id: 'test-form',
          children: [
            {
              type: 'input',
              props: {
                fieldId: 'name',
                label: 'Name',
                defaultValue: 'Ada',
              },
            },
          ],
        },
      ],
    })

    const input = screen.getByLabelText('Name')
    expect(input).toHaveAttribute('id', 'test-form-name')
    expect(input).not.toHaveAttribute('aria-describedby')
  })

  it('renders input with aria-describedby linked to the error span when there is an active error', async () => {
    renderRuntimeFormPage({
      id: 'aria-input-with-error',
      layout: [
        {
          type: 'form',
          id: 'test-form',
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
                defaultValue: '',
                validations: {
                  required: { value: true },
                },
              },
            },
            {
              type: 'button',
              props: { label: 'Submit' },
            },
          ],
        },
      ],
    })

    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))

    await waitFor(() => {
      const input = document.getElementById('test-form-name')
      expect(input).toHaveAttribute('aria-describedby', 'test-form-name-error')
      expect(document.getElementById('test-form-name-error')).toBeInTheDocument()
    })
  })

  it('removes aria-describedby from input and error span when error is cleared by typing a valid value', async () => {
    renderRuntimeFormPage({
      id: 'aria-input-error-clear',
      layout: [
        {
          type: 'form',
          id: 'test-form',
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
                  required: { value: true },
                },
              },
            },
            {
              type: 'button',
              props: { label: 'Submit' },
            },
          ],
        },
      ],
    })

    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))

    await waitFor(() => {
      expect(document.getElementById('test-form-username')).toHaveAttribute('aria-describedby', 'test-form-username-error')
    })

    const usernameInput = document.getElementById('test-form-username')
    fireEvent.change(usernameInput!, { target: { value: 'valid-value' } })

    await waitFor(() => {
      expect(document.getElementById('test-form-username')).not.toHaveAttribute('aria-describedby')
      expect(document.getElementById('test-form-username-error')).not.toBeInTheDocument()
    })
  })

  it('renders textarea with stable id and no aria-describedby when there is no error', () => {
    renderRuntimeFormPage({
      id: 'aria-textarea-no-error',
      layout: [
        {
          type: 'form',
          id: 'bio-form',
          children: [
            {
              type: 'textarea',
              props: {
                fieldId: 'bio',
                label: 'Bio',
                defaultValue: 'some text',
              },
            },
          ],
        },
      ],
    })

    const textarea = document.getElementById('bio-form-bio')
    expect(textarea).not.toBeNull()
    expect(textarea).not.toHaveAttribute('aria-describedby')
  })

  it('renders textarea with aria-describedby linked to the error span and removes it when error clears', async () => {
    renderRuntimeFormPage({
      id: 'aria-textarea-with-error',
      layout: [
        {
          type: 'form',
          id: 'bio-form',
          submitAction: {
            type: 'executeOperation',
            operationName: 'submitProfile',
          },
          children: [
            {
              type: 'textarea',
              props: {
                fieldId: 'bio',
                label: 'Bio',
                defaultValue: '',
                validations: {
                  required: { value: true },
                },
              },
            },
            {
              type: 'button',
              props: { label: 'Submit' },
            },
          ],
        },
      ],
    })

    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))

    await waitFor(() => {
      expect(document.getElementById('bio-form-bio')).toHaveAttribute('aria-describedby', 'bio-form-bio-error')
      expect(document.getElementById('bio-form-bio-error')).toBeInTheDocument()
    })

    const bioTextarea = document.getElementById('bio-form-bio')
    fireEvent.change(bioTextarea!, { target: { value: 'valid text' } })

    await waitFor(() => {
      expect(document.getElementById('bio-form-bio')).not.toHaveAttribute('aria-describedby')
      expect(document.getElementById('bio-form-bio-error')).not.toBeInTheDocument()
    })
  })

  it('renders select with stable id, no aria-label, and no aria-describedby when there is no error', () => {
    renderRuntimeFormPage({
      id: 'aria-select-no-error',
      layout: [
        {
          type: 'form',
          id: 'role-form',
          children: [
            {
              type: 'select',
              props: {
                fieldId: 'role',
                label: 'Role',
                items: [
                  { label: 'Admin', value: 'admin' },
                  { label: 'Editor', value: 'editor' },
                ],
              },
            },
          ],
        },
      ],
    })

    const select = document.getElementById('role-form-role')
    expect(select).not.toBeNull()
    expect(select).not.toHaveAttribute('aria-label')
    expect(select).not.toHaveAttribute('aria-describedby')
  })

  it('renders select accessible via getByRole after removing redundant aria-label', () => {
    renderRuntimeFormPage({
      id: 'aria-select-accessible',
      layout: [
        {
          type: 'form',
          id: 'role-form',
          children: [
            {
              type: 'select',
              props: {
                fieldId: 'role',
                label: 'Role',
                items: [
                  { label: 'Admin', value: 'admin' },
                  { label: 'Editor', value: 'editor' },
                ],
              },
            },
          ],
        },
      ],
    })

    expect(screen.getByRole('combobox', { name: 'Role' })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Role' })).not.toHaveAttribute('aria-label')
  })

  it('renders select with aria-describedby linked to error span and removes it when error clears', async () => {
    renderRuntimeFormPage({
      id: 'aria-select-with-error',
      layout: [
        {
          type: 'form',
          id: 'role-form',
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
                items: [
                  { label: '', value: '' },
                  { label: 'Admin', value: 'admin' },
                  { label: 'Editor', value: 'editor' },
                ],
                validations: {
                  required: { value: true },
                },
              },
            },
            {
              type: 'button',
              props: { label: 'Submit' },
            },
          ],
        },
      ],
    })

    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))

    await waitFor(() => {
      expect(document.getElementById('role-form-role')).toHaveAttribute('aria-describedby', 'role-form-role-error')
      expect(document.getElementById('role-form-role-error')).toBeInTheDocument()
    })

    fireEvent.change(screen.getByRole('combobox', { name: /Role/ }), { target: { value: 'admin' } })

    await waitFor(() => {
      expect(document.getElementById('role-form-role')).not.toHaveAttribute('aria-describedby')
      expect(document.getElementById('role-form-role-error')).not.toBeInTheDocument()
    })
  })

  it('renders radioGroup fieldset without aria-describedby when there is no error', () => {
    renderRuntimeFormPage({
      id: 'aria-radiogroup-no-error',
      layout: [
        {
          type: 'form',
          id: 'choice-form',
          children: [
            {
              type: 'radioGroup',
              props: {
                fieldId: 'role',
                label: 'Role',
                items: [
                  { label: 'Admin', value: 'admin' },
                  { label: 'Editor', value: 'editor' },
                ],
              },
            },
          ],
        },
      ],
    })

    const fieldset = screen.getByRole('group', { name: 'Role' })
    expect(fieldset).toBeInTheDocument()
    expect(fieldset).not.toHaveAttribute('aria-describedby')
    expect(document.getElementById('choice-form-role-error')).not.toBeInTheDocument()
  })

  it('renders radioGroup fieldset with aria-describedby linked to error span when there is an active error', async () => {
    renderRuntimeFormPage({
      id: 'aria-radiogroup-with-error',
      layout: [
        {
          type: 'form',
          id: 'choice-form',
          submitAction: {
            type: 'executeOperation',
            operationName: 'submitProfile',
          },
          children: [
            {
              type: 'radioGroup',
              props: {
                fieldId: 'role',
                label: 'Role',
                items: [
                  { label: 'Admin', value: 'admin' },
                  { label: 'Editor', value: 'editor' },
                ],
                validations: {
                  required: { value: true },
                },
              },
            },
            {
              type: 'button',
              props: { label: 'Submit' },
            },
          ],
        },
      ],
    })

    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))

    await waitFor(() => {
      const fieldset = screen.getByRole('group', { name: 'Role' })
      expect(fieldset).toHaveAttribute('aria-describedby', 'choice-form-role-error')
      expect(document.getElementById('choice-form-role-error')).toBeInTheDocument()
    })
  })

  it('removes aria-describedby from radioGroup fieldset and error span when error is cleared by selecting a valid value', async () => {
    renderRuntimeFormPage({
      id: 'aria-radiogroup-error-clear',
      layout: [
        {
          type: 'form',
          id: 'choice-form',
          submitAction: {
            type: 'executeOperation',
            operationName: 'submitProfile',
          },
          children: [
            {
              type: 'radioGroup',
              props: {
                fieldId: 'role',
                label: 'Role',
                items: [
                  { label: 'Admin', value: 'admin' },
                  { label: 'Editor', value: 'editor' },
                ],
                validations: {
                  required: { value: true },
                },
              },
            },
            {
              type: 'button',
              props: { label: 'Submit' },
            },
          ],
        },
      ],
    })

    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))

    await waitFor(() => {
      expect(screen.getByRole('group', { name: 'Role' })).toHaveAttribute('aria-describedby', 'choice-form-role-error')
    })

    fireEvent.click(screen.getByRole('radio', { name: 'Admin' }))

    await waitFor(() => {
      expect(screen.getByRole('group', { name: 'Role' })).not.toHaveAttribute('aria-describedby')
      expect(document.getElementById('choice-form-role-error')).not.toBeInTheDocument()
    })
  })

  it('renders checkboxGroup fieldset without aria-describedby when there is no error', () => {
    renderRuntimeFormPage({
      id: 'aria-checkboxgroup-no-error',
      layout: [
        {
          type: 'form',
          id: 'choice-form',
          children: [
            {
              type: 'checkboxGroup',
              props: {
                fieldId: 'teams',
                label: 'Teams',
                items: [
                  { label: 'Alpha', value: 'alpha' },
                  { label: 'Beta', value: 'beta' },
                ],
              },
            },
          ],
        },
      ],
    })

    const fieldset = screen.getByRole('group', { name: 'Teams' })
    expect(fieldset).toBeInTheDocument()
    expect(fieldset).not.toHaveAttribute('aria-describedby')
    expect(document.getElementById('choice-form-teams-error')).not.toBeInTheDocument()
  })

  it('renders checkboxGroup fieldset with aria-describedby linked to error span when there is an active error', async () => {
    renderRuntimeFormPage({
      id: 'aria-checkboxgroup-with-error',
      layout: [
        {
          type: 'form',
          id: 'choice-form',
          submitAction: {
            type: 'executeOperation',
            operationName: 'submitProfile',
          },
          children: [
            {
              type: 'checkboxGroup',
              props: {
                fieldId: 'teams',
                label: 'Teams',
                items: [
                  { label: 'Alpha', value: 'alpha' },
                  { label: 'Beta', value: 'beta' },
                ],
                validations: {
                  required: { value: true },
                },
              },
            },
            {
              type: 'button',
              props: { label: 'Submit' },
            },
          ],
        },
      ],
    })

    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))

    await waitFor(() => {
      const fieldset = screen.getByRole('group', { name: 'Teams' })
      expect(fieldset).toHaveAttribute('aria-describedby', 'choice-form-teams-error')
      expect(document.getElementById('choice-form-teams-error')).toBeInTheDocument()
    })
  })

  it('removes aria-describedby from checkboxGroup fieldset and error span when error is cleared by selecting a valid value', async () => {
    renderRuntimeFormPage({
      id: 'aria-checkboxgroup-error-clear',
      layout: [
        {
          type: 'form',
          id: 'choice-form',
          submitAction: {
            type: 'executeOperation',
            operationName: 'submitProfile',
          },
          children: [
            {
              type: 'checkboxGroup',
              props: {
                fieldId: 'teams',
                label: 'Teams',
                items: [
                  { label: 'Alpha', value: 'alpha' },
                  { label: 'Beta', value: 'beta' },
                ],
                validations: {
                  required: { value: true },
                },
              },
            },
            {
              type: 'button',
              props: { label: 'Submit' },
            },
          ],
        },
      ],
    })

    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))

    await waitFor(() => {
      expect(screen.getByRole('group', { name: 'Teams' })).toHaveAttribute('aria-describedby', 'choice-form-teams-error')
    })

    fireEvent.click(screen.getByRole('checkbox', { name: 'Alpha' }))

    await waitFor(() => {
      expect(screen.getByRole('group', { name: 'Teams' })).not.toHaveAttribute('aria-describedby')
      expect(document.getElementById('choice-form-teams-error')).not.toBeInTheDocument()
    })
  })

  it('renders input placeholder attribute when props.placeholder is a non-empty string', () => {
    renderRuntimeFormPage({
      id: 'input-placeholder-basic',
      layout: [
        {
          type: 'form',
          id: 'placeholder-form',
          children: [
            {
              type: 'input',
              props: {
                fieldId: 'name',
                label: 'Name',
                placeholder: 'Introduce tu nombre',
              },
            },
          ],
        },
      ],
    })

    expect(screen.getByLabelText('Name')).toHaveAttribute('placeholder', 'Introduce tu nombre')
  })

  it('does not render placeholder attribute on input when props.placeholder is absent', () => {
    renderRuntimeFormPage({
      id: 'input-placeholder-absent',
      layout: [
        {
          type: 'form',
          id: 'placeholder-form',
          children: [
            {
              type: 'input',
              props: {
                fieldId: 'name',
                label: 'Name',
              },
            },
          ],
        },
      ],
    })

    expect(screen.getByLabelText('Name')).not.toHaveAttribute('placeholder')
  })

  it('does not render placeholder attribute on input when props.placeholder is empty string', () => {
    renderRuntimeFormPage({
      id: 'input-placeholder-empty',
      layout: [
        {
          type: 'form',
          id: 'placeholder-form',
          children: [
            {
              type: 'input',
              props: {
                fieldId: 'name',
                label: 'Name',
                placeholder: '',
              },
            },
          ],
        },
      ],
    })

    expect(screen.getByLabelText('Name')).not.toHaveAttribute('placeholder')
  })

  it('resolves interpolated placeholder on input using params references', () => {
    const activePage: RuntimePageConfig = {
      id: 'input-placeholder-interpolated',
      layout: [
        {
          type: 'form',
          id: 'placeholder-form',
          children: [
            {
              type: 'input',
              props: {
                fieldId: 'name',
                label: 'Name',
                placeholder: 'Hola {{params.userName}}',
              },
            },
          ],
        },
      ],
    }
    const config: RuntimeConfig = {
      api: {},
      initialPage: activePage.id,
      pages: [activePage],
    }
    const state: RuntimeState = {
      ...createRuntimeState(config),
      navigation: {
        currentPageId: activePage.id,
        history: [{ entryId: 0, pageId: activePage.id, params: { userName: 'Ada' } }],
        currentEntryIndex: 0,
        lastError: null,
      },
      pageEntry: {
        entryId: 0,
        pageId: activePage.id,
        params: { userName: 'Ada' },
        preloadNames: [],
        status: 'idle',
      },
    }

    renderRuntimePageWithState(activePage, state)

    expect(screen.getByLabelText('Name')).toHaveAttribute('placeholder', 'Hola Ada')
  })

  it('renders partial literal text in placeholder when interpolated reference is missing', () => {
    const activePage: RuntimePageConfig = {
      id: 'input-placeholder-missing-ref',
      layout: [
        {
          type: 'form',
          id: 'placeholder-form',
          children: [
            {
              type: 'input',
              props: {
                fieldId: 'name',
                label: 'Name',
                placeholder: 'Hola {{params.missing}}',
              },
            },
          ],
        },
      ],
    }
    const config: RuntimeConfig = {
      api: {},
      initialPage: activePage.id,
      pages: [activePage],
    }
    const state: RuntimeState = {
      ...createRuntimeState(config),
      pageEntry: {
        entryId: 0,
        pageId: activePage.id,
        params: {},
        preloadNames: [],
        status: 'idle',
      },
    }

    renderRuntimePageWithState(activePage, state)

    expect(screen.getByLabelText('Name')).toHaveAttribute('placeholder', 'Hola ')
  })

  it('adding placeholder to input does not change form field value or trigger onChange side effects', () => {
    renderRuntimeFormPage({
      id: 'input-placeholder-no-value-change',
      layout: [
        {
          type: 'form',
          id: 'placeholder-form',
          children: [
            {
              type: 'input',
              props: {
                fieldId: 'name',
                label: 'Name',
                defaultValue: 'existing value',
                placeholder: 'Enter name',
              },
            },
          ],
        },
      ],
    })

    expect(screen.getByLabelText('Name')).toHaveValue('existing value')
    expect(screen.getByLabelText('Name')).toHaveAttribute('placeholder', 'Enter name')
  })

  it('renders textarea placeholder attribute when props.placeholder is a non-empty string', () => {
    renderRuntimeFormPage({
      id: 'textarea-placeholder-basic',
      layout: [
        {
          type: 'form',
          id: 'placeholder-form',
          children: [
            {
              type: 'textarea',
              props: {
                fieldId: 'bio',
                label: 'Bio',
                placeholder: 'Escribe aquí...',
              },
            },
          ],
        },
      ],
    })

    expect(document.getElementById('placeholder-form-bio')).toHaveAttribute('placeholder', 'Escribe aquí...')
  })

  it('does not render placeholder attribute on textarea when props.placeholder is absent', () => {
    renderRuntimeFormPage({
      id: 'textarea-placeholder-absent',
      layout: [
        {
          type: 'form',
          id: 'placeholder-form',
          children: [
            {
              type: 'textarea',
              props: {
                fieldId: 'bio',
                label: 'Bio',
              },
            },
          ],
        },
      ],
    })

    expect(document.getElementById('placeholder-form-bio')).not.toHaveAttribute('placeholder')
  })

  it('does not render placeholder attribute on textarea when props.placeholder is empty string', () => {
    renderRuntimeFormPage({
      id: 'textarea-placeholder-empty',
      layout: [
        {
          type: 'form',
          id: 'placeholder-form',
          children: [
            {
              type: 'textarea',
              props: {
                fieldId: 'bio',
                label: 'Bio',
                placeholder: '',
              },
            },
          ],
        },
      ],
    })

    expect(document.getElementById('placeholder-form-bio')).not.toHaveAttribute('placeholder')
  })

  it('resolves interpolated placeholder on textarea using params references', () => {
    const activePage: RuntimePageConfig = {
      id: 'textarea-placeholder-interpolated',
      layout: [
        {
          type: 'form',
          id: 'placeholder-form',
          children: [
            {
              type: 'textarea',
              props: {
                fieldId: 'bio',
                label: 'Bio',
                placeholder: '{{params.userName}}',
              },
            },
          ],
        },
      ],
    }
    const config: RuntimeConfig = {
      api: {},
      initialPage: activePage.id,
      pages: [activePage],
    }
    const state: RuntimeState = {
      ...createRuntimeState(config),
      navigation: {
        currentPageId: activePage.id,
        history: [{ entryId: 0, pageId: activePage.id, params: { userName: 'Ada' } }],
        currentEntryIndex: 0,
        lastError: null,
      },
      pageEntry: {
        entryId: 0,
        pageId: activePage.id,
        params: { userName: 'Ada' },
        preloadNames: [],
        status: 'idle',
      },
    }

    renderRuntimePageWithState(activePage, state)

    expect(document.getElementById('placeholder-form-bio')).toHaveAttribute('placeholder', 'Ada')
  })

  it('does not render placeholder on textarea when interpolated reference resolves to empty string', () => {
    const activePage: RuntimePageConfig = {
      id: 'textarea-placeholder-missing-ref',
      layout: [
        {
          type: 'form',
          id: 'placeholder-form',
          children: [
            {
              type: 'textarea',
              props: {
                fieldId: 'bio',
                label: 'Bio',
                placeholder: '{{params.missing}}',
              },
            },
          ],
        },
      ],
    }
    const config: RuntimeConfig = {
      api: {},
      initialPage: activePage.id,
      pages: [activePage],
    }
    const state: RuntimeState = {
      ...createRuntimeState(config),
      pageEntry: {
        entryId: 0,
        pageId: activePage.id,
        params: {},
        preloadNames: [],
        status: 'idle',
      },
    }

    renderRuntimePageWithState(activePage, state)

    expect(document.getElementById('placeholder-form-bio')).not.toHaveAttribute('placeholder')
  })

  it('adding placeholder to textarea does not change field value', () => {
    renderRuntimeFormPage({
      id: 'textarea-placeholder-no-value-change',
      layout: [
        {
          type: 'form',
          id: 'placeholder-form',
          children: [
            {
              type: 'textarea',
              props: {
                fieldId: 'bio',
                label: 'Bio',
                defaultValue: 'existing content',
                placeholder: 'Write here',
              },
            },
          ],
        },
      ],
    })

    const textarea = document.getElementById('placeholder-form-bio') as HTMLTextAreaElement
    expect(textarea).toHaveValue('existing content')
    expect(textarea).toHaveAttribute('placeholder', 'Write here')
  })

  it('renders select placeholder as first disabled option when props.placeholder is declared and no value is selected', () => {
    renderRuntimeFormPage({
      id: 'select-placeholder-basic',
      layout: [
        {
          type: 'form',
          id: 'placeholder-form',
          children: [
            {
              type: 'select',
              props: {
                fieldId: 'role',
                label: 'Role',
                placeholder: 'Selecciona una opción',
                items: [
                  { label: 'Admin', value: 'admin' },
                  { label: 'Editor', value: 'editor' },
                ],
              },
            },
          ],
        },
      ],
    })

    const select = screen.getByRole('combobox', { name: 'Role' })
    const options = within(select).getAllByRole('option')
    expect(options[0]).toHaveTextContent('Selecciona una opción')
    expect(options[0]).toHaveAttribute('value', '')
    expect(options[0]).toBeDisabled()
    expect(options.map((o) => o.textContent)).toEqual(['Selecciona una opción', 'Admin', 'Editor'])
  })

  it('select placeholder option is not selectable (disabled attribute present)', () => {
    renderRuntimeFormPage({
      id: 'select-placeholder-disabled',
      layout: [
        {
          type: 'form',
          id: 'placeholder-form',
          children: [
            {
              type: 'select',
              props: {
                fieldId: 'role',
                label: 'Role',
                placeholder: 'Selecciona una opción',
                items: [
                  { label: 'Admin', value: 'admin' },
                ],
              },
            },
          ],
        },
      ],
    })

    const select = screen.getByRole('combobox', { name: 'Role' })
    const placeholderOption = within(select).getByRole('option', { name: 'Selecciona una opción' })
    expect(placeholderOption).toBeDisabled()
  })

  it('select placeholder option is in DOM but not active when a real defaultValue is selected', async () => {
    renderRuntimeFormPage({
      id: 'select-placeholder-with-default',
      layout: [
        {
          type: 'form',
          id: 'placeholder-form',
          children: [
            {
              type: 'select',
              props: {
                fieldId: 'role',
                label: 'Role',
                placeholder: 'Selecciona una opción',
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
    })

    const select = screen.getByRole('combobox', { name: 'Role' })
    await waitFor(() => expect(select).toHaveValue('admin'))
    const placeholderOption = within(select).getByRole('option', { name: 'Selecciona una opción' })
    expect(placeholderOption).toBeInTheDocument()
    expect(placeholderOption).toBeDisabled()
  })

  it('select placeholder remains visible when defaultValue does not match any option', () => {
    renderRuntimeFormPage({
      id: 'select-placeholder-unmatched-default',
      layout: [
        {
          type: 'form',
          id: 'placeholder-form',
          children: [
            {
              type: 'select',
              props: {
                fieldId: 'role',
                label: 'Role',
                placeholder: 'Selecciona',
                defaultValue: 'nonexistent',
                items: [
                  { label: 'Admin', value: 'admin' },
                ],
              },
            },
          ],
        },
      ],
    })

    const select = screen.getByRole('combobox', { name: 'Role' })
    const placeholderOption = within(select).getByRole('option', { name: 'Selecciona' })
    expect(placeholderOption).toBeInTheDocument()
    expect(placeholderOption).toBeDisabled()
  })

  it('select without props.placeholder preserves current behavior: first option empty without disabled', () => {
    renderRuntimeFormPage({
      id: 'select-placeholder-absent',
      layout: [
        {
          type: 'form',
          id: 'placeholder-form',
          children: [
            {
              type: 'select',
              props: {
                fieldId: 'role',
                label: 'Role',
                items: [
                  { label: 'Admin', value: 'admin' },
                  { label: 'Editor', value: 'editor' },
                ],
              },
            },
          ],
        },
      ],
    })

    const select = screen.getByRole('combobox', { name: 'Role' })
    const options = within(select).getAllByRole('option')
    expect(options[0]).toHaveValue('')
    expect(options[0]).not.toBeDisabled()
    expect(options.map((o) => o.textContent)).toEqual(['', 'Admin', 'Editor'])
  })

  it('select with empty string props.placeholder behaves the same as no placeholder', () => {
    renderRuntimeFormPage({
      id: 'select-placeholder-empty',
      layout: [
        {
          type: 'form',
          id: 'placeholder-form',
          children: [
            {
              type: 'select',
              props: {
                fieldId: 'role',
                label: 'Role',
                placeholder: '',
                items: [
                  { label: 'Admin', value: 'admin' },
                ],
              },
            },
          ],
        },
      ],
    })

    const select = screen.getByRole('combobox', { name: 'Role' })
    const options = within(select).getAllByRole('option')
    expect(options[0]).toHaveValue('')
    expect(options[0]).not.toBeDisabled()
  })

  it('resolves interpolated placeholder on select using params references', () => {
    const activePage: RuntimePageConfig = {
      id: 'select-placeholder-interpolated',
      layout: [
        {
          type: 'form',
          id: 'placeholder-form',
          children: [
            {
              type: 'select',
              props: {
                fieldId: 'role',
                label: 'Role',
                placeholder: 'Hola {{params.userName}}',
                items: [
                  { label: 'Admin', value: 'admin' },
                ],
              },
            },
          ],
        },
      ],
    }
    const config: RuntimeConfig = {
      api: {},
      initialPage: activePage.id,
      pages: [activePage],
    }
    const state: RuntimeState = {
      ...createRuntimeState(config),
      navigation: {
        currentPageId: activePage.id,
        history: [{ entryId: 0, pageId: activePage.id, params: { userName: 'Ada' } }],
        currentEntryIndex: 0,
        lastError: null,
      },
      pageEntry: {
        entryId: 0,
        pageId: activePage.id,
        params: { userName: 'Ada' },
        preloadNames: [],
        status: 'idle',
      },
    }

    renderRuntimePageWithState(activePage, state)

    const select = screen.getByRole('combobox', { name: 'Role' })
    const placeholderOption = within(select).getByRole('option', { name: 'Hola Ada' })
    expect(placeholderOption).toBeInTheDocument()
    expect(placeholderOption).toBeDisabled()
  })

  it('select.multiple ignores props.placeholder and does not add any extra option', () => {
    renderRuntimeFormPage({
      id: 'select-multiple-placeholder-ignored',
      layout: [
        {
          type: 'form',
          id: 'placeholder-form',
          children: [
            {
              type: 'select',
              props: {
                fieldId: 'roles',
                label: 'Roles',
                multiple: true,
                placeholder: 'Selecciona varias',
                items: [
                  { label: 'Admin', value: 'admin' },
                  { label: 'Editor', value: 'editor' },
                ],
              },
            },
          ],
        },
      ],
    })

    const select = screen.getByRole('listbox', { name: 'Roles' })
    const options = within(select).getAllByRole('option')
    expect(options.map((o) => o.textContent)).toEqual(['Admin', 'Editor'])
    expect(options).toHaveLength(2)
  })

  it('select with placeholder and required validation still fails required when placeholder is selected', async () => {
    renderRuntimeFormPage({
      id: 'select-placeholder-required',
      layout: [
        {
          type: 'form',
          id: 'placeholder-form',
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
                placeholder: 'Selecciona una opción',
                items: [
                  { label: 'Admin', value: 'admin' },
                  { label: 'Editor', value: 'editor' },
                ],
                validations: {
                  required: { value: true },
                },
              },
            },
            {
              type: 'button',
              props: { label: 'Submit' },
            },
          ],
        },
      ],
    })

    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))

    await waitFor(() => {
      expect(document.getElementById('placeholder-form-role-error')).toBeInTheDocument()
    })
  })
})
