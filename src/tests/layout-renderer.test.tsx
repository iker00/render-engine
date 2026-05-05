import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { useEffect } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { RuntimeConfig, RuntimePageConfig } from '../config/runtime-config'
import { RuntimePage } from '../runtime/runtime-page'
import { RuntimeStateContext } from '../runtime/runtime-state/runtime-state-context'
import { createRuntimeState, runtimeStateReducer } from '../runtime/runtime-state/runtime-state-reducer'
import type { RuntimeState, RuntimeStateAction } from '../runtime/runtime-state/runtime-state-types'
import {
  RuntimeStateProvider,
  useRuntimeStateActions,
} from '../runtime/runtime-state/runtime-state-provider'

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

function renderRuntimePageWithSeed(activePage: RuntimePageConfig) {
  const config: RuntimeConfig = {
    api: {},
    initialPage: activePage.id,
    pages: [activePage],
  }
  const initialState = createRuntimeState(config)
  const seededState = seedRuntimeState(initialState)
  const dispatch = vi.fn<(action: RuntimeStateAction) => void>()

  return render(
    <RuntimeStateContext.Provider
      value={{
        config,
        initialState: seededState,
        state: seededState,
        dispatch,
      }}
    >
        <RuntimePage />
    </RuntimeStateContext.Provider>,
  )
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

describe('RuntimePage', () => {
  it('renders multiple root nodes in the declared order', () => {
    renderRuntimePage(page)

    const pageRoot = screen.getByTestId('runtime-page')
    const renderedNodes = pageRoot.querySelectorAll('[data-layout-node]')

    expect(screen.getByRole('heading', { name: 'Welcome', level: 1 })).toBeInTheDocument()
    expect(screen.getByText('Build forms from configuration.')).toBeInTheDocument()
    expect(screen.getByRole('list')).toBeInTheDocument()
    expect(screen.getByText('Reusable layout nodes')).toBeInTheDocument()
    expect(screen.getByText('Static content')).toBeInTheDocument()
    expect(renderedNodes[0]).toHaveAttribute('data-layout-node', 'heading')
    expect(renderedNodes[1]).toHaveAttribute('data-layout-node', 'paragraph')
    expect(renderedNodes[2]).toHaveAttribute('data-layout-node', 'container')
  })

  it('does not add a synthetic container around root siblings', () => {
    renderRuntimePage(page)

    const pageRoot = screen.getByTestId('runtime-page')

    expect(pageRoot.children).toHaveLength(3)
    expect(pageRoot.children[0]).toHaveAttribute('data-layout-node', 'heading')
    expect(pageRoot.children[1]).toHaveAttribute('data-layout-node', 'paragraph')
    expect(pageRoot.children[2]).toHaveAttribute('data-layout-node', 'container')
  })

  it('renders an empty layout without inventing fallback content', () => {
    renderRuntimePage({
      id: 'empty',
      layout: [],
    })

    const pageRoot = screen.getByTestId('runtime-page')
    expect(pageRoot.childElementCount).toBe(0)
    expect(pageRoot).not.toHaveTextContent(/\S/)
  })

  it('renders an empty list without placeholder items', () => {
    renderRuntimePage({
      id: 'empty-list',
      layout: [
        {
          type: 'list',
          props: {
            items: [],
          },
        },
      ],
    })

    const list = screen.getByRole('list')
    expect(within(list).queryAllByRole('listitem')).toHaveLength(0)
  })

  it('renders dynamic scalar list items from query data', () => {
    renderRuntimePageWithCollectionControls({
      id: 'dynamic-scalar-list',
      layout: [
        {
          type: 'list',
          props: {
            items: {
              source: 'queries.searchUsers.data',
              itemType: 'scalar',
            },
          },
        },
      ],
    })

    expect(within(screen.getByRole('list')).queryAllByRole('listitem')).toHaveLength(0)

    fireEvent.click(screen.getByRole('button', { name: 'Seed scalar results' }))

    const items = within(screen.getByRole('list')).getAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(items[0]).toHaveTextContent('Ada')
    expect(items[1]).toHaveTextContent('Grace')
  })

  it('renders object-based lists from manual values and dynamic query values using itemText mappings', () => {
    renderRuntimePageWithCollectionControls({
      id: 'object-lists',
      layout: [
        {
          type: 'list',
          props: {
            items: {
              values: [
                {
                  profile: {
                    name: 'Manual Ada',
                  },
                },
                {
                  profile: {
                    name: 'Manual Grace',
                  },
                },
              ],
              itemText: 'profile.name',
            },
          },
        },
        {
          type: 'list',
          props: {
            items: {
              source: 'queries.searchUsers.data.results',
              itemText: 'profile.name',
            },
          },
        },
      ],
    })

    fireEvent.click(screen.getByRole('button', { name: 'Seed object results' }))

    const lists = screen.getAllByRole('list')
    expect(within(lists[0]).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'Manual Ada',
      'Manual Grace',
    ])
    expect(within(lists[1]).getAllByRole('listitem').map((item) => item.textContent)).toEqual(['Ada', 'Grace'])
  })

  it('degrades a valid dynamic source to an empty list when the query is absent or the resolved value is not a collection', () => {
    renderRuntimePage({
      id: 'missing-query-list',
      layout: [
        {
          type: 'list',
          props: {
            items: {
              source: 'queries.searchUsers.data.results',
            },
          },
        },
      ],
    })

    expect(within(screen.getByRole('list')).queryAllByRole('listitem')).toHaveLength(0)

    renderRuntimePageWithCollectionControls({
      id: 'non-collection-query-list',
      layout: [
        {
          type: 'list',
          props: {
            items: {
              source: 'queries.searchUsers.data.results',
            },
          },
        },
      ],
    })

    fireEvent.click(screen.getByRole('button', { name: 'Seed non-collection results' }))

    const lists = screen.getAllByRole('list')
    expect(within(lists[1]).queryAllByRole('listitem')).toHaveLength(0)
  })

  it('degrades only invalid object items and reports a development diagnostic for each skipped list item', () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    renderRuntimePageWithCollectionControls({
      id: 'partial-object-list',
      layout: [
        {
          type: 'list',
          props: {
            items: {
              source: 'queries.searchUsers.data.results',
              itemText: 'profile.name',
            },
          },
        },
      ],
    })

    fireEvent.click(screen.getByRole('button', { name: 'Seed partial object results' }))

    const listItems = within(screen.getByRole('list')).getAllByRole('listitem')
    expect(listItems).toHaveLength(2)
    expect(listItems[0]).toHaveTextContent('Ada')
    expect(listItems[1]).toHaveTextContent('Grace')
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      '[runtime-collections] Skipped item at "queries.searchUsers.data.results[1]" for list.props.items because "profile.name" could not be resolved.',
    )

    consoleWarnSpy.mockRestore()
  })

  it('lets multiple lists reuse the same query with different object mappings', () => {
    renderRuntimePageWithCollectionControls({
      id: 'reused-query-lists',
      layout: [
        {
          type: 'list',
          props: {
            items: {
              source: 'queries.searchUsers.data.results',
              itemText: 'profile.name',
            },
          },
        },
        {
          type: 'list',
          props: {
            items: {
              source: 'queries.searchUsers.data.results',
              itemText: 'meta.role',
            },
          },
        },
      ],
    })

    fireEvent.click(screen.getByRole('button', { name: 'Seed object results' }))

    const lists = screen.getAllByRole('list')
    expect(within(lists[0]).getAllByRole('listitem').map((item) => item.textContent)).toEqual(['Ada', 'Grace'])
    expect(within(lists[1]).getAllByRole('listitem').map((item) => item.textContent)).toEqual(['Admin', 'Editor'])
  })

  it('treats heading, paragraph and list as leaf nodes even when they receive children', () => {
    renderRuntimePage({
      id: 'leaf-nodes',
      layout: [
        {
          type: 'container',
          children: [
            {
              type: 'heading',
              props: {
                text: 'Leaf heading',
                level: 2,
              },
              children: [
                {
                  type: 'paragraph',
                  props: {
                    text: 'Unexpected child',
                  },
                },
              ],
            },
            {
              type: 'paragraph',
              props: {
                text: 'Leaf paragraph',
              },
              children: [
                {
                  type: 'heading',
                  props: {
                    text: 'Hidden child',
                    level: 3,
                  },
                },
              ],
            },
            {
              type: 'list',
              props: {
                items: ['Visible item'],
              },
              children: [
                {
                  type: 'paragraph',
                  props: {
                    text: 'Another hidden child',
                  },
                },
              ],
            },
          ],
        },
      ],
    })

    expect(screen.getByRole('heading', { name: 'Leaf heading', level: 2 })).toBeInTheDocument()
    expect(screen.getByText('Leaf paragraph')).toBeInTheDocument()
    expect(screen.getByText('Visible item')).toBeInTheDocument()
    expect(screen.queryByText('Unexpected child')).not.toBeInTheDocument()
    expect(screen.queryByText('Hidden child')).not.toBeInTheDocument()
    expect(screen.queryByText('Another hidden child')).not.toBeInTheDocument()
  })

  it('preserves container direction and gap semantics', () => {
    renderRuntimePage(page)

    const container = screen.getByText('Reusable layout nodes').closest('[data-layout-node="container"]')

    expect(container).toHaveClass('flex', 'w-full', 'flex-row', 'gap-3')
    expect(container).not.toHaveAttribute('style')
  })

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

  it('keeps arbitrary container gap values through the scoped CSS variable fallback', () => {
    renderRuntimePage({
      id: 'arbitrary-gap',
      layout: [
        {
          type: 'container',
          props: {
            gap: '18px',
          },
          children: [
            {
              type: 'paragraph',
              props: {
                text: 'Scoped gap fallback',
              },
            },
          ],
        },
      ],
    })

    const container = screen.getByText('Scoped gap fallback').closest('[data-layout-node="container"]')

    expect(container).toHaveClass('flex', 'w-full', 'flex-col', 'gap-[var(--runtime-container-gap)]')
    expect(container).toHaveStyle('--runtime-container-gap: 18px')
  })

  it('renders heading, paragraph and list with stable Tailwind classes', () => {
    renderRuntimePage(page)

    expect(screen.getByRole('heading', { name: 'Welcome', level: 1 })).toHaveClass(
      'm-0',
      'text-5xl',
      'font-semibold',
      'leading-tight',
      'tracking-[-0.03em]',
      'text-slate-50',
    )
    expect(screen.getByText('Build forms from configuration.')).toHaveClass('m-0', 'text-base', 'leading-7', 'text-slate-300')
    expect(screen.getByRole('list')).toHaveClass('m-0', 'grid', 'list-disc', 'gap-2', 'pl-5', 'text-slate-200')
  })

  it('renders button nodes as accessible button elements with stable base classes', () => {
    renderRuntimePage({
      id: 'button-page',
      layout: [
        {
          type: 'button',
          props: {
            label: 'Open details',
            action: {
              type: 'navigateTo',
              pageId: 'details',
            },
          },
        },
      ],
    })

    expect(screen.getByRole('button', { name: 'Open details' })).toHaveAttribute('type', 'button')
    expect(screen.getByRole('button', { name: 'Open details' })).toHaveClass(
      'inline-flex',
      'items-center',
      'justify-center',
      'rounded-md',
      'bg-slate-200',
      'px-4',
      'py-2',
      'text-sm',
      'font-medium',
      'text-slate-950',
    )
  })

  it('treats button as a leaf node even when it receives children', () => {
    renderRuntimePage({
      id: 'button-leaf',
      layout: [
        {
          type: 'button',
          props: {
            label: 'Back',
            action: {
              type: 'goBack',
            },
          },
          children: [
            {
              type: 'paragraph',
              props: {
                text: 'Unexpected child',
              },
            },
          ],
        },
      ],
    })

    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument()
    expect(screen.queryByText('Unexpected child')).not.toBeInTheDocument()
  })

  it('lets a rendered button navigate declaratively to another page', () => {
    const config: RuntimeConfig = {
      api: {},
      initialPage: 'home',
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'button',
              props: {
                label: 'Open details',
                action: {
                  type: 'navigateTo',
                  pageId: 'details',
                },
              },
            },
          ],
        },
        {
          id: 'details',
          layout: [
            {
              type: 'heading',
              props: {
                text: 'Details page',
                level: 1,
              },
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

    fireEvent.click(screen.getByRole('button', { name: 'Open details' }))

    expect(screen.getByTestId('runtime-page')).toHaveAttribute('data-runtime-page-id', 'details')
    expect(screen.getByRole('heading', { name: 'Details page', level: 1 })).toBeInTheDocument()
  })

  it('renders current forms and queries references inside heading and paragraph text', () => {
    renderRuntimePageWithSeed({
      id: 'dynamic-text',
      layout: [
        {
          type: 'heading',
          props: {
            text: 'forms.userSearch.name',
            level: 2,
          },
        },
        {
          type: 'paragraph',
          props: {
            text: 'queries.searchUsers.status',
          },
        },
      ],
    })

    expect(screen.getByRole('heading', { name: 'Grace', level: 2 })).toBeInTheDocument()
    expect(screen.getByText('error')).toBeInTheDocument()
  })

  it('renders nested query data values inside heading and paragraph text when they resolve to text-compatible scalars', () => {
    renderRuntimePageWithSeed({
      id: 'nested-dynamic-text',
      layout: [
        {
          type: 'heading',
          props: {
            text: 'queries.searchUsers.data.results.1.name',
            level: 2,
          },
        },
        {
          type: 'paragraph',
          props: {
            text: 'queries.searchUsers.data.stats.total',
          },
        },
        {
          type: 'paragraph',
          props: {
            text: 'queries.searchUsers.data.user.profile.active',
          },
        },
      ],
    })

    expect(screen.getByRole('heading', { name: 'Grace', level: 2 })).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('true')).toBeInTheDocument()
  })

  it('keeps static and partially interpolated text literal', () => {
    renderRuntimePageWithSeed({
      id: 'literal-text',
      layout: [
        {
          type: 'heading',
          props: {
            text: 'Welcome back',
            level: 2,
          },
        },
        {
          type: 'paragraph',
          props: {
            text: 'User: forms.userSearch.name',
          },
        },
      ],
    })

    expect(screen.getByRole('heading', { name: 'Welcome back', level: 2 })).toBeInTheDocument()
    expect(screen.getByText('User: forms.userSearch.name')).toBeInTheDocument()
  })

  it('degrades missing, unsupported and invalid references to an empty string in visible text nodes', () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    renderRuntimePageWithSeed({
      id: 'empty-dynamic-text',
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
            text: 'navigation.currentPageId',
          },
        },
        {
          type: 'paragraph',
          props: {
            text: 'queries.searchUsers.foo',
          },
        },
      ],
    })

    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('')
    expect(screen.getAllByText('', { selector: '[data-layout-node="paragraph"]' })).toHaveLength(2)

    consoleWarnSpy.mockRestore()
  })

  it('degrades unresolved or non-text nested query references to an empty string in visible text nodes', () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    renderRuntimePageWithSeed({
      id: 'nested-empty-dynamic-text',
      layout: [
        {
          type: 'heading',
          props: {
            text: 'queries.searchUsers.data.results.3.name',
            level: 2,
          },
        },
        {
          type: 'paragraph',
          props: {
            text: 'queries.searchUsers.data.results',
          },
        },
        {
          type: 'paragraph',
          props: {
            text: 'queries.searchUsers.data.user',
          },
        },
      ],
    })

    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('')
    expect(screen.getAllByText('', { selector: '[data-layout-node="paragraph"]' })).toHaveLength(2)

    consoleWarnSpy.mockRestore()
  })

  it('renders escaped references as visible literal text without the escape character', () => {
    renderRuntimePageWithSeed({
      id: 'escaped-literal',
      layout: [
        {
          type: 'heading',
          props: {
            text: '\\forms.userSearch.name',
            level: 3,
          },
        },
      ],
    })

    expect(screen.getByRole('heading', { name: 'forms.userSearch.name', level: 3 })).toBeInTheDocument()
  })

  it('renders escaped nested query references as visible literal text without the escape character', () => {
    renderRuntimePageWithSeed({
      id: 'escaped-nested-literal',
      layout: [
        {
          type: 'heading',
          props: {
            text: '\\queries.searchUsers.data.results.0.name',
            level: 3,
          },
        },
      ],
    })

    expect(
      screen.getByRole('heading', { name: 'queries.searchUsers.data.results.0.name', level: 3 }),
    ).toBeInTheDocument()
  })

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

    expect(screen.getByRole('heading', { name: 'Profile form', level: 2 })).toBeInTheDocument()
    expect(screen.getByLabelText('Name')).toHaveValue('Ada')
    expect(screen.getByLabelText('Bio')).toHaveValue('Runtime builder')
    expect(screen.getByLabelText('Role')).toHaveValue('2')
    expect(buttons[0]).toHaveTextContent('Aux reset')
    expect(buttons[1]).toHaveTextContent('Submit profile')
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
                  label: 'profile.name',
                  value: 'id',
                },
              },
            },
          ],
        },
      ],
    })

    fireEvent.click(screen.getByRole('button', { name: 'Seed scalar results' }))

    expect(
      within(screen.getByRole('combobox', { name: 'Scalar role' })).getAllByRole('option').map((option) => option.textContent),
    ).toEqual(['', 'Ada', 'Grace'])

    fireEvent.click(screen.getByRole('button', { name: 'Seed object results' }))

    expect(
      within(screen.getByRole('combobox', { name: 'Object role' })).getAllByRole('option').map((option) => option.textContent),
    ).toEqual(['', 'Ada', 'Grace'])
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
})
