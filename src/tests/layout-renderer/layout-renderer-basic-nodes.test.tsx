import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { RuntimeConfig, RuntimePageConfig } from '../../config/runtime-config'
import { RuntimePage } from '../../runtime/runtime-page'
import { RuntimeStateContext } from '../../runtime/runtime-state/runtime-state-context'
import { createRuntimeState } from '../../runtime/runtime-state/runtime-state-reducer'
import type { RuntimeState, RuntimeStateAction } from '../../runtime/runtime-state/runtime-state-types'
import { RuntimeStateProvider } from '../../runtime/runtime-state/runtime-state-provider'
import { useRuntimeStateActions } from '../../runtime/runtime-state/use-runtime-state'
import { useEffect } from 'react'
import { afterEach } from 'vitest'

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

  it('interpolates direct list strings and object itemText projections with local item context', () => {
    const activePage: RuntimePageConfig = {
      id: 'interpolated-lists',
      layout: [
        {
          type: 'list',
          props: {
            items: [
              'Status {{queries.posts.status}}',
              'Missing {{queries.posts.data.missing}} item',
            ],
          },
        },
        {
          type: 'list',
          props: {
            items: {
              values: [
                {
                  code: 'M1',
                  title: 'Manual one',
                },
                {
                  code: 'M2',
                },
              ],
              itemText: '{{item.code}} - {{item.title}}',
            },
          },
        },
        {
          type: 'list',
          props: {
            items: {
              source: 'queries.posts.data.results',
              itemText: '{{item.code}} - {{item.title}} ({{item.missing}})',
            },
          },
        },
        {
          type: 'repeater',
          props: {
            items: {
              source: 'queries.posts.data.results',
              key: 'id',
            },
            template: [
              {
                type: 'list',
                props: {
                  items: ['Post {{item.id}}', 'Title {{item.title}}'],
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
                code: 'P1',
                title: 'First post',
              },
              {
                id: 'post-2',
                code: 'P2',
              },
            ],
          },
          error: null,
          requestSignature: null,
        },
      }),
    )

    const lists = screen.getAllByRole('list')
    expect(within(lists[0]).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'Status success',
      'Missing  item',
    ])
    expect(within(lists[1]).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'M1 - Manual one',
      'M2 - ',
    ])
    expect(within(lists[2]).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'P1 - First post ()',
      'P2 -  ()',
    ])
    expect(within(lists[3]).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'Post post-1',
      'Title First post',
    ])
    expect(within(lists[4]).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'Post post-2',
      'Title ',
    ])
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

  it('renders heading, paragraph and list with stable Tailwind classes', () => {
    renderRuntimePage(page)

    expect(screen.getByRole('heading', { name: 'Welcome', level: 1 })).toHaveClass(
      'm-0',
      'text-lg',
      'font-semibold',
      'leading-tight',
      'tracking-[-0.03em]',
      'text-app-text-strong',
      'sm:text-xl',
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

  it('renders heading with props.icon as an svg with aria-hidden before the text', () => {
    renderRuntimePage({
      id: 'heading-icon',
      layout: [
        {
          type: 'heading',
          props: {
            text: 'Users',
            level: 2,
            icon: 'User',
          },
        },
      ],
    })

    const heading = screen.getByRole('heading', { name: 'Users', level: 2 })
    const svg = heading.querySelector('svg')
    expect(svg).toBeInTheDocument()
    expect(svg).toHaveAttribute('aria-hidden', 'true')
    // svg must come before the text node
    expect(heading.firstChild).toBe(svg)
  })

  it('renders heading with props.icon at any heading level preserving hierarchy', () => {
    renderRuntimePage({
      id: 'heading-icon-level1',
      layout: [
        {
          type: 'heading',
          props: {
            text: 'Title',
            level: 1,
            icon: 'User',
          },
        },
      ],
    })

    expect(screen.getByRole('heading', { name: 'Title', level: 1 })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Title', level: 1 }).querySelector('svg')).toBeInTheDocument()
  })

  it('renders heading without icon when props.icon is absent', () => {
    renderRuntimePage({
      id: 'heading-no-icon',
      layout: [
        {
          type: 'heading',
          props: {
            text: 'No Icon',
            level: 3,
          },
        },
      ],
    })

    const heading = screen.getByRole('heading', { name: 'No Icon', level: 3 })
    expect(heading.querySelector('svg')).not.toBeInTheDocument()
  })

  it('renders paragraph with props.icon as an svg with aria-hidden before the text', () => {
    renderRuntimePage({
      id: 'paragraph-icon',
      layout: [
        {
          type: 'paragraph',
          props: {
            text: 'Some info text.',
            icon: 'Info',
          },
        },
      ],
    })

    const paragraph = document.querySelector('[data-layout-node="paragraph"]')
    expect(paragraph).toBeInTheDocument()
    const svg = paragraph!.querySelector('svg')
    expect(svg).toBeInTheDocument()
    expect(svg).toHaveAttribute('aria-hidden', 'true')
  })

  it('renders paragraph without icon when props.icon is an unknown name', () => {
    renderRuntimePage({
      id: 'paragraph-unknown-icon',
      layout: [
        {
          type: 'paragraph',
          props: {
            text: 'Text only.',
            icon: 'NonExistentIconXyz',
          },
        },
      ],
    })

    const paragraph = document.querySelector('[data-layout-node="paragraph"]')
    expect(paragraph).toBeInTheDocument()
    expect(paragraph!.querySelector('svg')).not.toBeInTheDocument()
  })
})
