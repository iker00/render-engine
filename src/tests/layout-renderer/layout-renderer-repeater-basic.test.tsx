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

  it('iterates a primitive array with key "$index", resolving item to each scalar value', () => {
    const activePage: RuntimePageConfig = {
      id: 'medios',
      layout: [
        {
          type: 'repeater',
          props: {
            items: {
              source: 'queries.ficha.data.Medios',
              key: '$index',
            },
            template: [
              {
                type: 'paragraph',
                props: {
                  text: 'item',
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
        ficha: {
          status: 'success',
          data: {
            Medios: ['876b2745-aaaa', '9e737714-bbbb', '12345678-cccc'],
          },
          error: null,
        },
      }),
    )

    expect(screen.getAllByRole('paragraph').map((p) => p.textContent)).toEqual([
      '876b2745-aaaa',
      '9e737714-bbbb',
      '12345678-cccc',
    ])
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

  describe('T0045-03 object source iteration', () => {
    it('renders one expansion per own enumerable key in natural insertion order', () => {
      const activePage: RuntimePageConfig = {
        id: 'sources',
        layout: [
          {
            type: 'repeater',
            props: {
              items: {
                source: 'queries.results.data',
                key: '$key',
              },
              template: [
                {
                  type: 'paragraph',
                  props: {
                    text: '{{item.$key}}',
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
          results: {
            status: 'success',
            data: {
              vinfopol: { label: 'Vinfopol' },
              bites: { label: 'Bites' },
              multas: { label: 'Multas' },
            },
            error: null,
          },
        }),
      )

      expect(screen.getAllByRole('paragraph').map((p) => p.textContent)).toEqual(['vinfopol', 'bites', 'multas'])
    })

    it('uses the dictionary key as React key and renders item.$key as the key string with key: "$key"', () => {
      const activePage: RuntimePageConfig = {
        id: 'sources',
        layout: [
          {
            type: 'repeater',
            props: {
              items: {
                source: 'queries.results.data',
                key: '$key',
              },
              template: [
                {
                  type: 'paragraph',
                  props: {
                    text: '{{item.$key}}: {{item.label}}',
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
          results: {
            status: 'success',
            data: {
              vinfopol: { label: 'Resultado A' },
              bites: { label: 'Resultado B' },
            },
            error: null,
          },
        }),
      )

      expect(screen.getAllByRole('paragraph').map((p) => p.textContent)).toEqual([
        'vinfopol: Resultado A',
        'bites: Resultado B',
      ])
    })

    it('navigates a relative key path within the entry value when key is a conventional path', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

      const activePage: RuntimePageConfig = {
        id: 'sources',
        layout: [
          {
            type: 'repeater',
            props: {
              items: {
                source: 'queries.results.data',
                key: 'id',
              },
              template: [
                {
                  type: 'paragraph',
                  props: {
                    text: 'item.label',
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
          results: {
            status: 'success',
            data: {
              alpha: { id: 'id-alpha', label: 'Alpha label' },
              beta: { id: 'id-beta', label: 'Beta label' },
              noId: { label: 'No key, skipped' },
            },
            error: null,
          },
        }),
      )

      expect(screen.getAllByRole('paragraph').map((p) => p.textContent)).toEqual(['Alpha label', 'Beta label'])
      expect(screen.queryByText('No key, skipped')).not.toBeInTheDocument()
      expect(consoleWarnSpy).toHaveBeenCalled()

      consoleWarnSpy.mockRestore()
    })

    it('omits all iterations and emits diagnostics when key is "$key" and source is an array', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

      const activePage: RuntimePageConfig = {
        id: 'sources',
        layout: [
          {
            type: 'repeater',
            props: {
              items: {
                source: 'queries.results.data',
                key: '$key',
              },
              template: [
                {
                  type: 'paragraph',
                  props: {
                    text: 'item.label',
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
          results: {
            status: 'success',
            data: [{ label: 'Item one' }, { label: 'Item two' }],
            error: null,
          },
        }),
      )

      expect(screen.queryByText('Item one')).not.toBeInTheDocument()
      expect(screen.queryByText('Item two')).not.toBeInTheDocument()
      expect(consoleWarnSpy).toHaveBeenCalled()

      consoleWarnSpy.mockRestore()
    })

    it('renders zero iterations for null, undefined, number, string and empty object sources without errors', () => {
      function createPage(queryData: unknown): RuntimePageConfig {
        return {
          id: 'sources',
          layout: [
            {
              type: 'repeater',
              props: {
                items: {
                  source: 'queries.results.data',
                  key: '$key',
                },
                template: [
                  {
                    type: 'paragraph',
                    props: {
                      text: 'item.label',
                    },
                  },
                ],
              },
            },
          ],
        }
      }

      const config: RuntimeConfig = {
        api: {},
        initialPage: 'sources',
        pages: [createPage(null)],
      }

      for (const badData of [null, undefined, 42, 'a string', {}]) {
        const page = createPage(badData)
        const state = createRuntimePageState(page, {
          results: {
            status: 'success',
            data: badData as never,
            error: null,
          },
        })

        const { unmount } = render(
          <RuntimeStateContext.Provider
            value={{
              config,
              initialState: state,
              state,
              dispatch: vi.fn<(action: RuntimeStateAction) => void>(),
              dispatchAndSyncState: vi.fn<(action: RuntimeStateAction) => void>(),
              getLatestState: () => state,
            }}
          >
            <RuntimePage />
          </RuntimeStateContext.Provider>,
        )

        expect(screen.queryByText('item.label')).not.toBeInTheDocument()
        unmount()
      }
    })

    it('resolves item.$key as the dictionary key even when item value contains a literal $key property', () => {
      const activePage: RuntimePageConfig = {
        id: 'sources',
        layout: [
          {
            type: 'repeater',
            props: {
              items: {
                source: 'queries.results.data',
                key: '$key',
              },
              template: [
                {
                  type: 'paragraph',
                  props: {
                    text: '{{item.$key}}',
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
          results: {
            status: 'success',
            data: {
              dictkey: { $key: 'internal-value', label: 'Entry' },
            },
            error: null,
          },
        }),
      )

      // item.$key must resolve to the dictionary key 'dictkey', not the internal '$key' property
      expect(screen.getByRole('paragraph').textContent).toBe('dictkey')
    })

    it('resolves item.{ruta} to navigate inside the entry value, not the $key synthetic property', () => {
      const activePage: RuntimePageConfig = {
        id: 'sources',
        layout: [
          {
            type: 'repeater',
            props: {
              items: {
                source: 'queries.results.data',
                key: '$key',
              },
              template: [
                {
                  type: 'paragraph',
                  props: {
                    text: '{{item.label}}',
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
          results: {
            status: 'success',
            data: {
              alpha: { label: 'Alpha content' },
              beta: { label: 'Beta content' },
            },
            error: null,
          },
        }),
      )

      expect(screen.getAllByRole('paragraph').map((p) => p.textContent)).toEqual(['Alpha content', 'Beta content'])
    })
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
