import { fireEvent, render, screen, waitFor } from '@testing-library/react'
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

const page: RuntimePageConfig = {
  id: 'home',
  layout: [
    {
      type: 'heading',
      props: {
        text: 'Welcome',
        level: 1,
      },
    },
    {
      type: 'paragraph',
      props: {
        text: 'Build forms from configuration.',
      },
    },
    {
      type: 'container',
      props: {
        direction: 'row',
        gap: 'sm',
      },
      children: [
        {
          type: 'list',
          props: {
            items: ['Reusable layout nodes', 'Static content'],
          },
        },
      ],
    },
  ],
}

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

function QueryStateFeedbackFixture() {
  const { initializeQuery, setQueryError, setQueryLoading, setQuerySuccess } = useRuntimeStateActions()

  useEffect(() => {
    initializeQuery('searchUsers')
  }, [initializeQuery])

  return (
    <>
      <button type="button" onClick={() => setQueryLoading('searchUsers')}>
        Set loading
      </button>
      <button type="button" onClick={() => setQuerySuccess('searchUsers', ['Ada', 'Grace'])}>
        Set success list
      </button>
      <button type="button" onClick={() => setQuerySuccess('searchUsers', [])}>
        Set success empty list
      </button>
      <button type="button" onClick={() => setQuerySuccess('searchUsers', 0)}>
        Set success zero
      </button>
      <button
        type="button"
        onClick={() =>
          setQueryError('searchUsers', {
            code: 'network',
            message: 'Could not load users.',
          })
        }
      >
        Set error
      </button>
    </>
  )
}

function renderRuntimePageWithQueryFeedback(activePage: RuntimePageConfig) {
  const config: RuntimeConfig = {
    api: {},
    initialPage: activePage.id,
    pages: [activePage],
  }

  return render(
    <RuntimeStateProvider config={config}>
      <QueryStateFeedbackFixture />
      <RuntimePage />
    </RuntimeStateProvider>,
  )
}

describe('RuntimePage', () => {
  it('keeps nodes without queryStateFeedback rendering exactly as before', () => {
    renderRuntimePageWithQueryFeedback(page)

    expect(screen.getByRole('heading', { name: 'Welcome', level: 1 })).toBeInTheDocument()
    expect(screen.getByText('Build forms from configuration.')).toBeInTheDocument()
    expect(screen.getByRole('list')).toBeInTheDocument()
  })

  it('keeps a node hidden while idle when its idle rule resolves to hide and shows it after success', () => {
    renderRuntimePageWithQueryFeedback({
      id: 'home',
      layout: [
        {
          type: 'paragraph',
          queryStateFeedback: {
            query: 'searchUsers',
            states: {
              idle: {
                mode: 'hide',
              },
            },
          },
          props: {
            text: 'Visible only after loading',
          },
        },
      ],
    })

    expect(screen.queryByText('Visible only after loading')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Set success list' }))

    expect(screen.getByText('Visible only after loading')).toBeInTheDocument()
  })

  it('renders an idle fallback before the first execution and restores the original node on non-empty success', () => {
    renderRuntimePageWithQueryFeedback({
      id: 'home',
      layout: [
        {
          type: 'paragraph',
          queryStateFeedback: {
            query: 'searchUsers',
            states: {
              idle: {
                mode: 'fallback',
                fallback: [
                  {
                    type: 'heading',
                    props: {
                      text: 'Run a search first',
                      level: 2,
                    },
                  },
                  {
                    type: 'paragraph',
                    props: {
                      text: 'Choose a filter and search',
                    },
                  },
                ],
              },
            },
          },
          props: {
            text: 'Loaded users',
          },
        },
      ],
    })

    const pageRoot = screen.getByTestId('runtime-page')

    expect(screen.getByRole('heading', { name: 'Run a search first', level: 2 })).toBeInTheDocument()
    expect(screen.getByText('Choose a filter and search')).toBeInTheDocument()
    expect(screen.queryByText('Loaded users')).not.toBeInTheDocument()
    expect(pageRoot.children[0]).toHaveAttribute('data-layout-node', 'heading')
    expect(pageRoot.children[1]).toHaveAttribute('data-layout-node', 'paragraph')

    fireEvent.click(screen.getByRole('button', { name: 'Set success list' }))

    expect(screen.queryByRole('heading', { name: 'Run a search first', level: 2 })).not.toBeInTheDocument()
    expect(screen.queryByText('Choose a filter and search')).not.toBeInTheDocument()
    expect(screen.getByText('Loaded users')).toBeInTheDocument()
  })

  it('renders a loading fallback only during an actual loading execution', () => {
    renderRuntimePageWithQueryFeedback({
      id: 'home',
      layout: [
        {
          type: 'paragraph',
          queryStateFeedback: {
            query: 'searchUsers',
            states: {
              loading: {
                mode: 'fallback',
                fallback: [
                  {
                    type: 'paragraph',
                    props: {
                      text: 'Loading users...',
                    },
                  },
                ],
              },
            },
          },
          props: {
            text: 'Loaded users',
          },
        },
      ],
    })

    expect(screen.queryByText('Loading users...')).not.toBeInTheDocument()
    expect(screen.queryByText('Loaded users')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Set loading' }))

    expect(screen.getByText('Loading users...')).toBeInTheDocument()
    expect(screen.queryByText('Loaded users')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Set success list' }))

    expect(screen.queryByText('Loading users...')).not.toBeInTheDocument()
    expect(screen.getByText('Loaded users')).toBeInTheDocument()
  })

  it('renders the error fallback instead of the original node when the query fails', () => {
    renderRuntimePageWithQueryFeedback({
      id: 'home',
      layout: [
        {
          type: 'heading',
          queryStateFeedback: {
            query: 'searchUsers',
            states: {
              error: {
                mode: 'fallback',
                fallback: [
                  {
                    type: 'paragraph',
                    props: {
                      text: 'Could not load users.',
                    },
                  },
                ],
              },
            },
          },
          props: {
            text: 'Users loaded',
            level: 2,
          },
        },
      ],
    })

    fireEvent.click(screen.getByRole('button', { name: 'Set error' }))

    expect(screen.queryByRole('heading', { name: 'Users loaded', level: 2 })).not.toBeInTheDocument()
    expect(screen.getByText('Could not load users.')).toBeInTheDocument()
  })

  it('treats empty results as empty but keeps zero in the success branch', () => {
    renderRuntimePageWithQueryFeedback({
      id: 'home',
      layout: [
        {
          type: 'paragraph',
          queryStateFeedback: {
            query: 'searchUsers',
            states: {
              empty: {
                mode: 'fallback',
                fallback: [
                  {
                    type: 'paragraph',
                    props: {
                      text: 'No users found',
                    },
                  },
                ],
              },
            },
          },
          props: {
            text: 'Users available',
          },
        },
      ],
    })

    fireEvent.click(screen.getByRole('button', { name: 'Set success empty list' }))

    expect(screen.queryByText('Users available')).not.toBeInTheDocument()
    expect(screen.getByText('No users found')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Set success zero' }))

    expect(screen.queryByText('No users found')).not.toBeInTheDocument()
    expect(screen.getByText('Users available')).toBeInTheDocument()
  })

  it('keeps a success-only node hidden in loading error and empty, and shows it on non-empty success', () => {
    renderRuntimePageWithQueryFeedback({
      id: 'home',
      layout: [
        {
          type: 'paragraph',
          queryStateFeedback: {
            query: 'searchUsers',
            states: {
              success: {
                mode: 'show',
              },
            },
          },
          props: {
            text: 'Users available',
          },
        },
      ],
    })

    expect(screen.queryByText('Users available')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Set error' }))
    expect(screen.queryByText('Users available')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Set success empty list' }))
    expect(screen.queryByText('Users available')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Set success list' }))
    expect(screen.getByText('Users available')).toBeInTheDocument()
  })

  it('lets multiple nodes react differently to the same query and shows loading again during a reload with stale data', () => {
    renderRuntimePageWithQueryFeedback({
      id: 'home',
      layout: [
        {
          type: 'paragraph',
          queryStateFeedback: {
            query: 'searchUsers',
            states: {
              loading: {
                mode: 'fallback',
                fallback: [
                  {
                    type: 'paragraph',
                    props: {
                      text: 'Loading list...',
                    },
                  },
                ],
              },
            },
          },
          props: {
            text: 'User list',
          },
        },
        {
          type: 'button',
          queryStateFeedback: {
            query: 'searchUsers',
            states: {
              loading: {
                mode: 'hide',
              },
              error: {
                mode: 'show',
              },
            },
          },
          props: {
            label: 'Retry later',
            action: {
              type: 'goBack',
            },
          },
        },
      ],
    })

    expect(screen.queryByText('Loading list...')).not.toBeInTheDocument()
    expect(screen.queryByText('User list')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Retry later' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Set success list' }))

    expect(screen.getByText('User list')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Retry later' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Set loading' }))

    expect(screen.getByText('Loading list...')).toBeInTheDocument()
    expect(screen.queryByText('User list')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Retry later' })).not.toBeInTheDocument()
  })

  it('shows and hides supported layout nodes through visibility rules based on forms and queries values', async () => {
    renderRuntimePageWithQueryFeedback({
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
                defaultValue: '',
                items: [
                  { label: '', value: '' },
                  { label: 'Admin', value: 'admin' },
                ],
              },
            },
            {
              type: 'input',
              visibility: {
                reference: 'forms.profile-form.role',
                operator: 'equals',
                value: 'admin',
              },
              props: {
                fieldId: 'notes',
                label: 'Notes',
                defaultValue: '',
              },
            },
          ],
        },
        {
          type: 'heading',
          visibility: {
            reference: 'forms.profile-form.role',
            operator: 'equals',
            value: 'admin',
          },
          props: {
            text: 'Admin heading',
            level: 2,
          },
        },
        {
          type: 'paragraph',
          visibility: {
            reference: 'queries.searchUsers.status',
            operator: 'equals',
            value: 'success',
          },
          props: {
            text: 'Success status paragraph',
          },
        },
        {
          type: 'paragraph',
          visibility: {
            reference: 'queries.searchUsers.data.0',
            operator: 'isTruthy',
          },
          props: {
            text: 'First result paragraph',
          },
        },
        {
          type: 'list',
          visibility: {
            reference: 'queries.searchUsers.data',
            operator: 'greaterThan',
            value: 1,
          },
          props: {
            items: ['Visible list item'],
          },
        },
        {
          type: 'button',
          visibility: {
            reference: 'queries.searchUsers.status',
            operator: 'equals',
            value: 'success',
          },
          props: {
            label: 'Visible runtime button',
            action: {
              type: 'goBack',
            },
          },
        },
        {
          type: 'container',
          visibility: {
            reference: 'queries.searchUsers.error',
            operator: 'isTruthy',
          },
          children: [
            {
              type: 'paragraph',
              props: {
                text: 'Error container content',
              },
            },
          ],
        },
        {
          type: 'form',
          id: 'error-form',
          visibility: {
            reference: 'queries.searchUsers.error',
            operator: 'isTruthy',
          },
          children: [
            {
              type: 'input',
              props: {
                fieldId: 'reason',
                label: 'Reason',
                defaultValue: '',
              },
            },
          ],
        },
      ],
    })

    expect(screen.queryByRole('heading', { name: 'Admin heading', level: 2 })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Notes')).not.toBeInTheDocument()
    expect(screen.queryByText('Success status paragraph')).not.toBeInTheDocument()
    expect(screen.queryByText('First result paragraph')).not.toBeInTheDocument()
    expect(screen.queryByText('Visible list item')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Visible runtime button' })).not.toBeInTheDocument()
    expect(screen.queryByText('Error container content')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Reason')).not.toBeInTheDocument()

    fireEvent.change(screen.getByRole('combobox', { name: 'Role' }), { target: { value: 'admin' } })

    expect(screen.getByRole('heading', { name: 'Admin heading', level: 2 })).toBeInTheDocument()
    expect(screen.getByLabelText('Notes')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Set success list' }))

    await waitFor(() => expect(screen.getByText('Success status paragraph')).toBeInTheDocument())
    expect(screen.getByText('First result paragraph')).toBeInTheDocument()
    expect(screen.getByText('Visible list item')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Visible runtime button' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Set error' }))

    await waitFor(() => expect(screen.getByText('Error container content')).toBeInTheDocument())
    expect(screen.getByLabelText('Reason')).toBeInTheDocument()
    expect(screen.queryByText('Success status paragraph')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Visible runtime button' })).not.toBeInTheDocument()
  })

  it('compares visibility.value as a literal even when it contains template delimiters', async () => {
    renderRuntimePage({
      id: 'literal-visibility-value',
      layout: [
        {
          type: 'form',
          id: 'filters',
          children: [
            {
              type: 'input',
              props: {
                fieldId: 'type',
                label: 'Type',
                defaultValue: 'open',
              },
            },
            {
              type: 'input',
              props: {
                fieldId: 'status',
                label: 'Status',
                defaultValue: 'case-{{forms.filters.type}}',
              },
            },
          ],
        },
        {
          type: 'paragraph',
          visibility: {
            reference: 'forms.filters.status',
            operator: 'equals',
            value: 'case-{{forms.filters.type}}',
          },
          props: {
            text: 'Literal status match',
          },
        },
      ],
    })

    await waitFor(() => expect(screen.getByText('Literal status match')).toBeInTheDocument())

    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'case-open' } })

    await waitFor(() => expect(screen.queryByText('Literal status match')).not.toBeInTheDocument())
  })

  it('treats queryStateFeedback.query as a literal query name instead of an interpolated template', () => {
    const activePage: RuntimePageConfig = {
      id: 'literal-query-feedback',
      layout: [
        {
          type: 'paragraph',
          queryStateFeedback: {
            query: '{{forms.filters.queryName}}',
          },
          props: {
            text: 'Literal query feedback node',
          },
        },
      ],
    }

    renderRuntimePageWithState(
      activePage,
      {
        ...createRuntimePageState(activePage, {
          '{{forms.filters.queryName}}': {
            status: 'success',
            data: ['literal'],
            error: null,
            requestSignature: null,
          },
          searchUsers: {
            status: 'error',
            data: null,
            error: {
              code: 'network',
              message: 'Could not load users.',
            },
            requestSignature: null,
          },
        }),
        forms: {
          filters: {
            queryName: {
              value: 'searchUsers',
              error: null,
              touched: false,
              dirty: false,
              defaultValue: 'searchUsers',
            },
          },
        },
      },
    )

    expect(screen.getByText('Literal query feedback node')).toBeInTheDocument()
  })

  it('wraps loading fallback nodes inside an element with role="status"', () => {
    renderRuntimePageWithQueryFeedback({
      id: 'home',
      layout: [
        {
          type: 'paragraph',
          queryStateFeedback: {
            query: 'searchUsers',
            states: {
              loading: {
                mode: 'fallback',
                fallback: [
                  {
                    type: 'paragraph',
                    props: {
                      text: 'Loading users...',
                    },
                  },
                ],
              },
            },
          },
          props: {
            text: 'Loaded users',
          },
        },
      ],
    })

    fireEvent.click(screen.getByRole('button', { name: 'Set loading' }))

    const statusEl = screen.getByRole('status')
    expect(statusEl).toBeInTheDocument()
    expect(statusEl).toHaveTextContent('Loading users...')
  })

  it('wraps error fallback nodes inside an element with role="alert"', () => {
    renderRuntimePageWithQueryFeedback({
      id: 'home',
      layout: [
        {
          type: 'heading',
          queryStateFeedback: {
            query: 'searchUsers',
            states: {
              error: {
                mode: 'fallback',
                fallback: [
                  {
                    type: 'paragraph',
                    props: {
                      text: 'Could not load users.',
                    },
                  },
                ],
              },
            },
          },
          props: {
            text: 'Users loaded',
            level: 2,
          },
        },
      ],
    })

    fireEvent.click(screen.getByRole('button', { name: 'Set error' }))

    const alertEl = screen.getByRole('alert')
    expect(alertEl).toBeInTheDocument()
    expect(alertEl).toHaveTextContent('Could not load users.')
  })

  it('does not add role="status" or role="alert" wrapper for idle fallback', () => {
    renderRuntimePageWithQueryFeedback({
      id: 'home',
      layout: [
        {
          type: 'paragraph',
          queryStateFeedback: {
            query: 'searchUsers',
            states: {
              idle: {
                mode: 'fallback',
                fallback: [
                  {
                    type: 'paragraph',
                    props: {
                      text: 'Run a search first',
                    },
                  },
                ],
              },
            },
          },
          props: {
            text: 'Loaded users',
          },
        },
      ],
    })

    expect(screen.getByText('Run a search first')).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('does not add role="status" or role="alert" wrapper for empty fallback', () => {
    renderRuntimePageWithQueryFeedback({
      id: 'home',
      layout: [
        {
          type: 'paragraph',
          queryStateFeedback: {
            query: 'searchUsers',
            states: {
              empty: {
                mode: 'fallback',
                fallback: [
                  {
                    type: 'paragraph',
                    props: {
                      text: 'No users found',
                    },
                  },
                ],
              },
            },
          },
          props: {
            text: 'Users available',
          },
        },
      ],
    })

    fireEvent.click(screen.getByRole('button', { name: 'Set success empty list' }))

    expect(screen.getByText('No users found')).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('does not add role="status" or role="alert" wrapper for success fallback', () => {
    renderRuntimePageWithQueryFeedback({
      id: 'home',
      layout: [
        {
          type: 'paragraph',
          queryStateFeedback: {
            query: 'searchUsers',
            states: {
              success: {
                mode: 'fallback',
                fallback: [
                  {
                    type: 'paragraph',
                    props: {
                      text: 'Users loaded successfully',
                    },
                  },
                ],
              },
            },
          },
          props: {
            text: 'Users available',
          },
        },
      ],
    })

    fireEvent.click(screen.getByRole('button', { name: 'Set success list' }))

    expect(screen.getByText('Users loaded successfully')).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('uses a single role="status" wrapper for a loading fallback with multiple children', () => {
    renderRuntimePageWithQueryFeedback({
      id: 'home',
      layout: [
        {
          type: 'paragraph',
          queryStateFeedback: {
            query: 'searchUsers',
            states: {
              loading: {
                mode: 'fallback',
                fallback: [
                  {
                    type: 'paragraph',
                    props: {
                      text: 'Loading line 1',
                    },
                  },
                  {
                    type: 'paragraph',
                    props: {
                      text: 'Loading line 2',
                    },
                  },
                ],
              },
            },
          },
          props: {
            text: 'Loaded users',
          },
        },
      ],
    })

    fireEvent.click(screen.getByRole('button', { name: 'Set loading' }))

    const statusElements = screen.getAllByRole('status')
    expect(statusElements).toHaveLength(1)
    expect(statusElements[0]).toHaveTextContent('Loading line 1')
    expect(statusElements[0]).toHaveTextContent('Loading line 2')
  })

  it('keeps role="status" wrapper valid when loading fallback is an empty array', () => {
    renderRuntimePageWithQueryFeedback({
      id: 'home',
      layout: [
        {
          type: 'paragraph',
          queryStateFeedback: {
            query: 'searchUsers',
            states: {
              loading: {
                mode: 'fallback',
                fallback: [],
              },
            },
          },
          props: {
            text: 'Loaded users',
          },
        },
      ],
    })

    fireEvent.click(screen.getByRole('button', { name: 'Set loading' }))

    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.queryByText('Loaded users')).not.toBeInTheDocument()
  })

  it('applies visibility rules inside queryStateFeedback fallback nodes without reopening the original node', async () => {
    renderRuntimePageWithQueryFeedback({
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
                defaultValue: '',
                items: [
                  { label: '', value: '' },
                  { label: 'Admin', value: 'admin' },
                ],
              },
            },
          ],
        },
        {
          type: 'paragraph',
          queryStateFeedback: {
            query: 'searchUsers',
            states: {
              idle: {
                mode: 'fallback',
                fallback: [
                  {
                    type: 'paragraph',
                    visibility: {
                      reference: 'forms.profile-form.role',
                      operator: 'equals',
                      value: 'admin',
                    },
                    props: {
                      text: 'Admin-only idle fallback',
                    },
                  },
                  {
                    type: 'paragraph',
                    props: {
                      text: 'Always idle fallback',
                    },
                  },
                ],
              },
            },
          },
          props: {
            text: 'Original query node',
          },
        },
      ],
    })

    expect(screen.getByText('Always idle fallback')).toBeInTheDocument()
    expect(screen.queryByText('Admin-only idle fallback')).not.toBeInTheDocument()
    expect(screen.queryByText('Original query node')).not.toBeInTheDocument()

    fireEvent.change(screen.getByRole('combobox', { name: 'Role' }), { target: { value: 'admin' } })

    expect(screen.getByText('Admin-only idle fallback')).toBeInTheDocument()
    expect(screen.queryByText('Original query node')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Set success list' }))

    await waitFor(() => expect(screen.getByText('Original query node')).toBeInTheDocument())
    expect(screen.queryByText('Always idle fallback')).not.toBeInTheDocument()
    expect(screen.queryByText('Admin-only idle fallback')).not.toBeInTheDocument()
  })

  it('renders error.message interpolation with the actual error message when the query is in error', () => {
    renderRuntimePageWithState(
      {
        id: 'home',
        layout: [
          {
            type: 'heading',
            props: {
              text: '{{queries.searchUsers.error.message}}',
              level: 2,
            },
          },
        ],
      },
      createRuntimePageState(
        {
          id: 'home',
          layout: [],
        },
        {
          searchUsers: {
            status: 'error',
            data: null,
            error: {
              code: 'http-error',
              message: 'No autorizado',
            },
            requestSignature: null,
          },
        },
      ),
    )

    expect(screen.getByRole('heading', { level: 2, name: 'No autorizado' })).toBeInTheDocument()
  })

  it('renders error.code interpolation with the error code string when the query is in error', () => {
    renderRuntimePageWithState(
      {
        id: 'home',
        layout: [
          {
            type: 'paragraph',
            props: {
              text: '{{queries.searchUsers.error.code}}',
            },
          },
        ],
      },
      createRuntimePageState(
        {
          id: 'home',
          layout: [],
        },
        {
          searchUsers: {
            status: 'error',
            data: null,
            error: {
              code: 'UNAUTHORIZED',
              message: 'Not authorized',
            },
            requestSignature: null,
          },
        },
      ),
    )

    expect(screen.getByText('UNAUTHORIZED')).toBeInTheDocument()
  })

  it('renders error.message interpolation as empty string when the query is in success', () => {
    renderRuntimePageWithState(
      {
        id: 'home',
        layout: [
          {
            type: 'heading',
            props: {
              text: 'Error: {{queries.searchUsers.error.message}}',
              level: 2,
            },
          },
        ],
      },
      createRuntimePageState(
        {
          id: 'home',
          layout: [],
        },
        {
          searchUsers: {
            status: 'success',
            data: ['Ada'],
            error: null,
            requestSignature: null,
          },
        },
      ),
    )

    expect(screen.getByRole('heading', { level: 2, name: 'Error:' })).toBeInTheDocument()
  })

  it('renders error.message as the full reference value when used without interpolation delimiters', () => {
    renderRuntimePageWithState(
      {
        id: 'home',
        layout: [
          {
            type: 'heading',
            props: {
              text: 'queries.searchUsers.error.message',
              level: 2,
            },
          },
        ],
      },
      createRuntimePageState(
        {
          id: 'home',
          layout: [],
        },
        {
          searchUsers: {
            status: 'error',
            data: null,
            error: {
              code: 'http-error',
              message: 'Could not connect',
            },
            requestSignature: null,
          },
        },
      ),
    )

    expect(screen.getByRole('heading', { level: 2, name: 'Could not connect' })).toBeInTheDocument()
  })
})
