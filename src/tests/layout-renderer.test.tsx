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

function renderRuntimePageWithState(activePage: RuntimePageConfig, state: RuntimeState) {
  const config: RuntimeConfig = {
    api: {},
    initialPage: activePage.id,
    pages: [activePage],
  }
  const dispatch = vi.fn<(action: RuntimeStateAction) => void>()
  const dispatchAndSyncState = vi.fn<(action: RuntimeStateAction) => void>()

  return render(
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
  )
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

    expect(container?.tagName).toBe('SECTION')
    expect(container).toHaveClass(
      'flex',
      'w-full',
      'flex-row',
      'gap-3',
    )
    expect(container).not.toHaveAttribute('style')
  })

  it('uses md as the default visible gap for containers without an explicit gap', () => {
    renderRuntimePage({
      id: 'default-gap',
      layout: [
        {
          type: 'container',
          children: [
            {
              type: 'paragraph',
              props: {
                text: 'Default gap container',
              },
            },
          ],
        },
      ],
    })

    const container = screen.getByText('Default gap container').closest('[data-layout-node="container"]')

    expect(container).toHaveClass(
      'flex',
      'w-full',
      'flex-col',
      'flex-nowrap',
      'gap-5',
    )
    expect(container).not.toHaveAttribute('style')
  })

  it('renders columns as grid and lets columns win over direction', () => {
    renderRuntimePage({
      id: 'columns-layout',
      layout: [
        {
          type: 'container',
          props: {
            direction: 'row',
            columns: 3,
          },
          children: [
            {
              type: 'paragraph',
              props: {
                text: 'Grid item',
              },
            },
          ],
        },
      ],
    })

    const container = screen.getByText('Grid item').closest('[data-layout-node="container"]')

    expect(container).toHaveClass('grid', 'w-full', 'grid-cols-3', 'gap-5')
    expect(container).not.toHaveClass('flex', 'flex-row')
  })

  it('renders container variant default like the historical default and card as a closed surface', () => {
    renderRuntimePage({
      id: 'container-variants',
      layout: [
        {
          type: 'container',
          props: {
            variant: 'default',
          },
          children: [
            {
              type: 'paragraph',
              props: {
                text: 'Default variant body',
              },
            },
          ],
        },
        {
          type: 'container',
          props: {
            variant: 'card',
            columns: 2,
          },
          children: [
            {
              type: 'paragraph',
              props: {
                text: 'Card variant body',
              },
            },
          ],
        },
      ],
    })

    const defaultContainer = screen.getByText('Default variant body').closest('[data-layout-node="container"]')
    const cardContainer = screen.getByText('Card variant body').closest('[data-layout-node="container"]')

    expect(defaultContainer).toHaveClass('flex', 'w-full', 'flex-col', 'flex-nowrap', 'gap-5')
    expect(defaultContainer).not.toHaveClass('rounded-section', 'border', 'shadow-section')

    expect(cardContainer).toHaveClass(
      'grid',
      'w-full',
      'grid-cols-2',
      'rounded-section',
      'border',
      'border-app-border-soft',
      'bg-white',
      'p-4',
      'shadow-section',
      'gap-5',
    )
    expect(cardContainer).not.toHaveClass('border-t', 'pt-5')
  })

  it('maps align justify and wrap to the rendered container classes', () => {
    renderRuntimePage({
      id: 'aligned-layout',
      layout: [
        {
          type: 'container',
          props: {
            direction: 'row',
            align: 'center',
            justify: 'between',
            wrap: 'wrap',
          },
          children: [
            {
              type: 'paragraph',
              props: {
                text: 'Aligned child',
              },
            },
          ],
        },
      ],
    })

    const container = screen.getByText('Aligned child').closest('[data-layout-node="container"]')

    expect(container).toHaveClass(
      'flex',
      'w-full',
      'flex-row',
      'items-center',
      'justify-between',
      'flex-wrap',
      'gap-5',
    )
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

    expect(container).toHaveClass(
      'flex',
      'w-full',
      'flex-col',
      'flex-nowrap',
      'gap-[var(--runtime-container-gap)]',
    )
    expect(container).toHaveStyle('--runtime-container-gap: 18px')
  })

  it('renders heading, paragraph and list with stable Tailwind classes', () => {
    renderRuntimePage(page)

    expect(screen.getByRole('heading', { name: 'Welcome', level: 1 })).toHaveClass(
      'm-0',
      'text-3xl',
      'font-semibold',
      'leading-tight',
      'tracking-[-0.03em]',
      'text-app-text-strong',
      'sm:text-4xl',
    )
    expect(screen.getByText('Build forms from configuration.')).toHaveClass(
      'm-0',
      'text-sm',
      'leading-6',
      'text-app-text-muted',
      'sm:text-base',
      'sm:leading-7',
    )
    expect(screen.getByRole('list')).toHaveClass(
      'm-0',
      'grid',
      'list-disc',
      'gap-3',
      'pl-5',
      'text-app-text',
      'marker:text-app-accent',
    )
  })

  it('renders image nodes from literals and runtime references, including item.* inside repeater', () => {
    const activePage: RuntimePageConfig = {
      id: 'images',
      layout: [
        {
          type: 'image',
          props: {
            src: '/media/hero.png',
            alt: 'Hero image',
          },
        },
        {
          type: 'image',
          props: {
            src: 'queries.searchUsers.data.user.profile.avatarUrl',
            alt: 'queries.searchUsers.data.user.profile.name',
          },
        },
        {
          type: 'repeater',
          props: {
            items: {
              source: 'queries.searchUsers.data.results',
              key: 'id',
            },
            template: [
              {
                type: 'image',
                props: {
                  src: 'item.avatarUrl',
                  alt: 'item.name',
                },
              },
            ],
          },
        },
      ],
    }

    renderRuntimePageWithState(
      activePage,
      createRuntimePageState(activePage, {
        searchUsers: {
          status: 'success',
          data: {
            user: {
              profile: {
                name: 'Ada',
                avatarUrl: '/media/ada-profile.png',
              },
            },
            results: [
              {
                id: 'user-1',
                name: 'Ada',
                avatarUrl: '/media/ada.png',
              },
              {
                id: 'user-2',
                name: 'Grace',
                avatarUrl: '/media/grace.png',
              },
            ],
          },
          error: null,
        },
      }),
    )

    const heroImage = screen.getByRole('img', { name: 'Hero image' })
    expect(heroImage).toHaveAttribute('src', '/media/hero.png')
    expect(heroImage).toHaveClass(
      'block',
      'max-w-full',
      'rounded-card',
      'border',
      'border-app-border-soft',
      'bg-app-surface-subtle',
      'object-cover',
    )

    expect(
      screen
        .getAllByRole('img', { name: 'Ada' })
        .find((image) => image.getAttribute('src') === '/media/ada-profile.png'),
    ).toBeDefined()

    const repeaterImages = screen.getAllByRole('img').filter((image) =>
      ['/media/ada.png', '/media/grace.png'].includes(image.getAttribute('src') ?? ''),
    )
    expect(repeaterImages.map((image) => image.getAttribute('alt'))).toEqual(['Ada', 'Grace'])
  })

  it('degrades image nodes safely when src is missing or not a usable string and keeps alt as empty text when unavailable', () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const activePage: RuntimePageConfig = {
      id: 'broken-images',
      layout: [
        {
          type: 'image',
          props: {
            src: 'queries.searchUsers.data.user.profile.avatarUrl',
            alt: 'queries.searchUsers.data.user.profile.nickname',
          },
        },
        {
          type: 'image',
          props: {
            src: 'queries.searchUsers.data',
            alt: 'queries.searchUsers.data.user.profile.name',
          },
        },
        {
          type: 'image',
          props: {
            src: 'queries.unknown.data.url',
            alt: 'Unknown image',
          },
        },
      ],
    }

    renderRuntimePageWithState(
      activePage,
      createRuntimePageState(activePage, {
        searchUsers: {
          status: 'success',
          data: {
            user: {
              profile: {
                name: 'Ada',
                avatarUrl: '/media/ada-profile.png',
              },
            },
          },
          error: null,
        },
      }),
    )

    const images = Array.from(document.querySelectorAll('img[data-layout-node="image"]'))
    expect(images).toHaveLength(1)
    expect(images[0]).toHaveAttribute('src', '/media/ada-profile.png')
    expect(images[0]).toHaveAttribute('alt', '')

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      '[runtime-references] Could not resolve "queries.searchUsers.data.user.profile.nickname" for image.props.alt (missing).',
    )
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      '[runtime-references] Could not resolve "queries.unknown.data.url" for image.props.src (missing).',
    )

    consoleWarnSpy.mockRestore()
  })

  it('renders manual tables with semantic markup, declared order, and shared visible scalar normalization', () => {
    const activePage: RuntimePageConfig = {
      id: 'manual-table',
      layout: [
        {
          type: 'table',
          props: {
            headers: ['Name', 'Status', 'Visits'],
            rows: [
              ['queries.searchUsers.data.user.profile.name', true, 12],
              ['Grace', false, 7],
            ],
          },
        },
      ],
    }

    renderRuntimePageWithState(
      activePage,
      createRuntimePageState(activePage, {
        searchUsers: {
          status: 'success',
          data: {
            user: {
              profile: {
                name: 'Ada',
              },
            },
          },
          error: null,
        },
      }),
    )

    const table = screen.getByRole('table')
    expect(within(table).getAllByRole('columnheader').map((cell) => cell.textContent)).toEqual(['Name', 'Status', 'Visits'])

    const bodyRows = within(table).getAllByRole('row').slice(1)
    expect(bodyRows).toHaveLength(2)
    expect(within(bodyRows[0]).getAllByRole('cell').map((cell) => cell.textContent)).toEqual(['Ada', 'true', '12'])
    expect(within(bodyRows[1]).getAllByRole('cell').map((cell) => cell.textContent)).toEqual(['Grace', 'false', '7'])
  })

  it('renders dynamic tables from collection sources, preserves rows with partial items, and reuses global references per cell', () => {
    const activePage: RuntimePageConfig = {
      id: 'dynamic-table',
      layout: [
        {
          type: 'table',
          props: {
            headers: ['Name', 'Role', 'Query status'],
            rows: {
              source: 'queries.searchUsers.data.results',
              cells: ['item.name', 'item.role', 'queries.searchUsers.status'],
            },
          },
        },
      ],
    }

    renderRuntimePageWithState(
      activePage,
      createRuntimePageState(activePage, {
        searchUsers: {
          status: 'success',
          data: {
            results: [
              {
                id: 'user-1',
                name: 'Ada',
                role: 'Admin',
              },
              {
                id: 'user-2',
                name: 'Grace',
              },
            ],
          },
          error: null,
        },
      }),
    )

    const table = screen.getByRole('table')
    const bodyRows = within(table).getAllByRole('row').slice(1)
    expect(bodyRows).toHaveLength(2)
    expect(within(bodyRows[0]).getAllByRole('cell').map((cell) => cell.textContent)).toEqual(['Ada', 'Admin', 'success'])
    expect(within(bodyRows[1]).getAllByRole('cell').map((cell) => cell.textContent)).toEqual(['Grace', '', 'success'])
  })

  it('renders tables inside repeaters using item.* as the dynamic source context and degrades missing collections to zero body rows', () => {
    const activePage: RuntimePageConfig = {
      id: 'department-tables',
      layout: [
        {
          type: 'repeater',
          props: {
            items: {
              source: 'queries.departments.data',
              key: 'id',
            },
            template: [
              {
                type: 'heading',
                props: {
                  text: 'item.name',
                  level: 2,
                },
              },
              {
                type: 'table',
                props: {
                  headers: ['Member', 'Role'],
                  rows: {
                    source: 'item.members',
                    cells: ['item.name', 'item.role'],
                  },
                },
              },
            ],
          },
        },
      ],
    }

    renderRuntimePageWithState(
      activePage,
      createRuntimePageState(activePage, {
        departments: {
          status: 'success',
          data: [
            {
              id: 'dept-1',
              name: 'Engineering',
              members: [
                { name: 'Ada', role: 'Lead' },
                { name: 'Grace', role: 'Reviewer' },
              ],
            },
            {
              id: 'dept-2',
              name: 'Operations',
            },
          ],
          error: null,
        },
      }),
    )

    expect(screen.getAllByRole('heading', { level: 2 }).map((item) => item.textContent)).toEqual(['Engineering', 'Operations'])

    const tables = screen.getAllByRole('table')
    expect(within(tables[0]).getAllByRole('row').slice(1)).toHaveLength(2)
    expect(within(tables[0]).getAllByRole('cell').map((cell) => cell.textContent)).toEqual(['Ada', 'Lead', 'Grace', 'Reviewer'])
    expect(within(tables[1]).queryAllByRole('row').slice(1)).toHaveLength(0)
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
      'rounded-control',
      'border-app-border-strong',
      'bg-white',
      'px-4',
      'py-3',
      'sm:px-3.5',
      'sm:py-2.5',
      'text-sm',
      'font-semibold',
      'text-app-text-strong',
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
      'border-t',
      'border-app-border-soft',
      'pt-5',
    )
    expect(screen.getByLabelText('Bio').closest('[data-layout-node="container"]')).not.toHaveClass('-mx-5', 'sm:-mx-6')
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
    expect(screen.getByLabelText('Role')).toHaveValue('2')
    expect(screen.getByLabelText('Bio')).toHaveClass('rounded-control', 'bg-white', 'min-h-28', 'sm:min-h-32')
    expect(screen.getByLabelText('Bio')).not.toHaveClass('shadow-sm')
    expect(screen.getByLabelText('Role')).toHaveClass(
      'rounded-control',
      'bg-white',
      'appearance-none',
      'pr-12',
      'sm:px-3.5',
      'sm:py-2.5',
    )
    expect(screen.getByLabelText('Role')).not.toHaveClass('shadow-sm')
    expect(buttons[0]).toHaveClass('bg-white', 'text-app-text-strong', 'sm:px-3.5', 'sm:py-2.5')
    expect(buttons[1]).toHaveClass('bg-app-accent', 'text-white', 'sm:px-3.5', 'sm:py-2.5')
    expect(buttons[0]).toHaveTextContent('Aux reset')
    expect(buttons[1]).toHaveTextContent('Submit profile')
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
      'border-t',
      'border-app-border-soft',
      'pt-5',
    )
    expect(container).not.toHaveClass('-mx-5', 'sm:-mx-6')
    expect(container).not.toHaveClass('flex-row')
    expect(screen.getByLabelText('Bio')).toHaveValue('Runtime builder')
    expect(screen.getByLabelText('Role')).toHaveValue('admin')
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

  it('applies layout.span to leaf and composite nodes only inside effective grid parents', () => {
    renderRuntimePage({
      id: 'grid-span-layout',
      layout: [
        {
          type: 'container',
          props: {
            columns: 4,
          },
          children: [
            {
              type: 'heading',
              layout: {
                span: 2,
              },
              props: {
                text: 'Grid heading',
                level: 2,
              },
            },
            {
              type: 'container',
              layout: {
                span: 3,
              },
              children: [
                {
                  type: 'paragraph',
                  props: {
                    text: 'Composite span body',
                  },
                },
              ],
            },
            {
              type: 'form',
              id: 'grid-form',
              layout: {
                span: 6,
              },
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
        },
        {
          type: 'paragraph',
          layout: {
            span: 4,
          },
          props: {
            text: 'Outside grid body',
          },
        },
      ],
    })

    const headingWrapper = screen.getByRole('heading', { name: 'Grid heading', level: 2 }).parentElement
    const compositeWrapper = screen.getByText('Composite span body').closest('[data-layout-node="container"]')?.parentElement
    const formWrapper = screen.getByLabelText('Name').closest('form')?.parentElement
    const outsideGridWrapper = screen.getByText('Outside grid body').parentElement

    expect(headingWrapper).toHaveClass('col-span-2')
    expect(compositeWrapper).toHaveClass('col-span-3')
    expect(formWrapper).toHaveClass('col-span-4')
    expect(outsideGridWrapper).not.toHaveClass('col-span-4')
  })

  it('keeps repeater itself span-less and applies layout.span only to visible template roots inside grids', () => {
    renderRuntimePageWithState(
      {
        id: 'repeater-grid-span',
        layout: [
          {
            type: 'container',
            props: {
              columns: 4,
            },
            children: [
              {
                type: 'repeater',
                layout: {
                  span: 4,
                },
                props: {
                  items: {
                    source: 'queries.users.data.results',
                    key: 'id',
                  },
                  template: [
                    {
                      type: 'container',
                      layout: {
                        span: 2,
                      },
                      children: [
                        {
                          type: 'paragraph',
                          props: {
                            text: 'item.name',
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
      },
      createRuntimePageState(
        {
          id: 'repeater-grid-span',
          layout: [
            {
              type: 'container',
              props: {
                columns: 4,
              },
              children: [
                {
                  type: 'repeater',
                  layout: {
                    span: 4,
                  },
                  props: {
                    items: {
                      source: 'queries.users.data.results',
                      key: 'id',
                    },
                    template: [
                      {
                        type: 'container',
                        layout: {
                          span: 2,
                        },
                        children: [
                          {
                            type: 'paragraph',
                            props: {
                              text: 'item.name',
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
        },
        {
          users: {
            status: 'success',
            data: {
              results: [
                { id: 'user-1', name: 'Ada' },
                { id: 'user-2', name: 'Grace' },
              ],
            },
            error: null,
            requestSignature: null,
          },
        },
      ),
    )

    const adaCard = screen.getByText('Ada').closest('[data-layout-node="container"]')
    const graceCard = screen.getByText('Grace').closest('[data-layout-node="container"]')
    const repeaterGrid = adaCard?.parentElement

    expect(adaCard?.parentElement).toHaveClass('col-span-2')
    expect(graceCard?.parentElement).toHaveClass('col-span-2')
    expect(repeaterGrid).not.toHaveClass('col-span-4')
  })

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
    expect(screen.getByLabelText('Role')).toHaveValue('edit')
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

  it('renders one repeater iteration per query item, keeps collection order, and resolves item.* in descendants', () => {
    const activePage: RuntimePageConfig = {
      id: 'posts',
      layout: [
        {
          type: 'repeater',
          props: {
            items: {
              source: 'queries.posts.data.results',
              key: 'id',
            },
            template: [
              {
                type: 'heading',
                props: {
                  text: 'item.title',
                  level: 2,
                },
              },
              {
                type: 'paragraph',
                props: {
                  text: 'item.author.name',
                },
              },
              {
                type: 'list',
                props: {
                  items: {
                    source: 'item.tags',
                    itemType: 'scalar',
                  },
                },
              },
            ],
          },
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
                title: 'First post',
                author: { name: 'Ada' },
                tags: ['alpha', 'beta'],
              },
              {
                id: 'post-2',
                title: 'Second post',
                author: { name: 'Grace' },
                tags: ['gamma'],
              },
            ],
          },
          error: null,
        },
      }),
    )

    expect(screen.getAllByRole('heading', { level: 2 }).map((item) => item.textContent)).toEqual(['First post', 'Second post'])
    expect(screen.getAllByText(/Ada|Grace/, { selector: 'p' }).map((item) => item.textContent)).toEqual(['Ada', 'Grace'])

    const lists = screen.getAllByRole('list')
    expect(within(lists[0]).getAllByRole('listitem').map((item) => item.textContent)).toEqual(['alpha', 'beta'])
    expect(within(lists[1]).getAllByRole('listitem').map((item) => item.textContent)).toEqual(['gamma'])
  })

  it('renders scalar repeater items and degrades to zero iterations for missing, failed, or non-array sources', () => {
    const scalarPage: RuntimePageConfig = {
      id: 'scalars',
      layout: [
        {
          type: 'repeater',
          props: {
            items: {
              source: 'queries.tags.data',
              key: '0',
            },
            template: [
              {
                type: 'paragraph',
                props: {
                  text: 'item.0',
                },
              },
            ],
          },
        },
      ],
    }

    const { unmount } = renderRuntimePageWithState(
      scalarPage,
      createRuntimePageState(scalarPage, {
        tags: {
          status: 'success',
          data: [['alpha'], ['beta']],
          error: null,
        },
      }),
    )

    expect(screen.getAllByText(/alpha|beta/, { selector: 'p' }).map((item) => item.textContent)).toEqual(['alpha', 'beta'])
    unmount()

    const emptyPage: RuntimePageConfig = {
      id: 'empty',
      layout: scalarPage.layout,
    }

    const { rerender } = renderRuntimePageWithState(
      emptyPage,
      createRuntimePageState(emptyPage, {
        tags: {
          status: 'error',
          data: null,
          error: { code: 'network', message: 'Nope' },
        },
      }),
    )

    expect(screen.queryByText('alpha', { selector: 'p' })).not.toBeInTheDocument()

    const emptyConfig: RuntimeConfig = {
      api: {},
      initialPage: emptyPage.id,
      pages: [emptyPage],
    }
    const nonArrayState = createRuntimePageState(emptyPage, {
      tags: {
        status: 'success',
        data: { value: 'not-an-array' },
        error: null,
      },
    })

    rerender(
      <RuntimeStateContext.Provider
        value={{
          config: emptyConfig,
          initialState: nonArrayState,
          state: nonArrayState,
          dispatch: vi.fn(),
          dispatchAndSyncState: vi.fn(),
          getLatestState: () => nonArrayState,
        }}
      >
        <RuntimePage />
      </RuntimeStateContext.Provider>,
    )

    expect(screen.queryByText('alpha', { selector: 'p' })).not.toBeInTheDocument()
  })

  it('keeps queryStateFeedback and visibility behavior on repeater and skips invalid iteration keys with diagnostics', () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const activePage: RuntimePageConfig = {
      id: 'posts',
      layout: [
        {
          type: 'repeater',
          queryStateFeedback: {
            query: 'posts',
            states: {
              loading: {
                mode: 'fallback',
                fallback: [
                  {
                    type: 'paragraph',
                    props: {
                      text: 'Loading posts',
                    },
                  },
                ],
              },
            },
          },
          visibility: {
            reference: 'queries.posts.data.results',
            operator: 'greaterThan',
            value: 0,
          },
          props: {
            items: {
              source: 'queries.posts.data.results',
              key: 'id',
            },
            template: [
              {
                type: 'paragraph',
                props: {
                  text: 'item.title',
                },
              },
            ],
          },
        },
      ],
    }

    const { rerender } = renderRuntimePageWithState(
      activePage,
      createRuntimePageState(activePage, {
        posts: {
          status: 'loading',
          data: null,
          error: null,
        },
      }),
    )

    expect(screen.getByText('Loading posts')).toBeInTheDocument()

    const config: RuntimeConfig = {
      api: {},
      initialPage: activePage.id,
      pages: [activePage],
    }
    const invalidKeyState = createRuntimePageState(activePage, {
      posts: {
        status: 'success',
        data: {
          results: [
            { id: 'post-1', title: 'First post' },
            { id: 'post-1', title: 'Duplicate post' },
            { id: null, title: 'Broken post' },
          ],
        },
        error: null,
      },
    })

    rerender(
      <RuntimeStateContext.Provider
        value={{
          config,
          initialState: invalidKeyState,
          state: invalidKeyState,
          dispatch: vi.fn<(action: RuntimeStateAction) => void>(),
          dispatchAndSyncState: vi.fn<(action: RuntimeStateAction) => void>(),
          getLatestState: () => invalidKeyState,
        }}
      >
        <RuntimePage />
      </RuntimeStateContext.Provider>,
    )

    expect(screen.getByText('First post')).toBeInTheDocument()
    expect(screen.queryByText('Duplicate post')).not.toBeInTheDocument()
    expect(screen.queryByText('Broken post')).not.toBeInTheDocument()
    expect(consoleWarnSpy).toHaveBeenCalled()

    consoleWarnSpy.mockRestore()
  })
})
