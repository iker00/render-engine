import { render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RuntimeConfig, RuntimePageConfig } from '../../config/runtime-config'
import { RuntimePage } from '../../runtime/runtime-page'
import { RuntimeStateContext } from '../../runtime/runtime-state/runtime-state-context'
import { createRuntimeState } from '../../runtime/runtime-state/runtime-state-reducer'
import type { RuntimeState, RuntimeStateAction } from '../../runtime/runtime-state/runtime-state-types'

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

describe('RuntimePage', () => {
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

  it('renders only the first effective page for paginated repeaters without changing item context', () => {
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
            pagination: {
              enabled: true,
              pageSize: 2,
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
              { id: 'post-1', title: 'First post', author: { name: 'Ada' } },
              { id: 'post-2', title: 'Second post', author: { name: 'Grace' } },
              { id: 'post-3', title: 'Third post', author: { name: 'Lin' } },
              { id: 'post-4', title: 'Fourth post', author: { name: 'Katherine' } },
              { id: 'post-5', title: 'Fifth post', author: { name: 'Evelyn' } },
            ],
          },
          error: null,
        },
      }),
    )

    expect(screen.getAllByRole('heading', { level: 2 }).map((item) => item.textContent)).toEqual(['First post', 'Second post'])
    expect(screen.getAllByText(/Ada|Grace/, { selector: 'p' }).map((item) => item.textContent)).toEqual(['Ada', 'Grace'])
    expect(screen.queryByText('Third post')).not.toBeInTheDocument()
    expect(screen.queryByText('Lin')).not.toBeInTheDocument()
  })

  it('paginates only renderable repeater items after applying key diagnostics', () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
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
            pagination: {
              enabled: true,
              pageSize: 2,
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

    renderRuntimePageWithState(
      activePage,
      createRuntimePageState(activePage, {
        posts: {
          status: 'success',
          data: {
            results: [
              { id: 'post-1', title: 'First post' },
              { id: 'post-1', title: 'Duplicate post' },
              { id: null, title: 'Broken post' },
              { id: 'post-2', title: 'Second post' },
              { id: 'post-3', title: 'Third post' },
            ],
          },
          error: null,
        },
      }),
    )

    expect(screen.getAllByText(/First post|Second post/, { selector: 'p' }).map((item) => item.textContent)).toEqual([
      'First post',
      'Second post',
    ])
    expect(screen.queryByText('Duplicate post')).not.toBeInTheDocument()
    expect(screen.queryByText('Broken post')).not.toBeInTheDocument()
    expect(screen.queryByText('Third post')).not.toBeInTheDocument()
    expect(consoleWarnSpy).toHaveBeenCalled()

    consoleWarnSpy.mockRestore()
  })
})
