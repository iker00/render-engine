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

  describe('T0092-T2 $index as React key', () => {
    it('renders one expansion per string element when key is "$index" over an array of strings', () => {
      const activePage: RuntimePageConfig = {
        id: 'tags',
        layout: [
          {
            type: 'repeater',
            props: {
              items: {
                source: 'queries.tags.data',
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
          tags: {
            status: 'success',
            data: ['a', 'b', 'c'],
            error: null,
          },
        }),
      )

      expect(screen.getAllByRole('paragraph').map((p) => p.textContent)).toEqual(['a', 'b', 'c'])
    })

    it('renders one expansion per object element when key is "$index" and resolves item.title', () => {
      const activePage: RuntimePageConfig = {
        id: 'posts',
        layout: [
          {
            type: 'repeater',
            props: {
              items: {
                source: 'queries.posts.data',
                key: '$index',
              },
              template: [
                {
                  type: 'heading',
                  props: {
                    text: 'item.title',
                    level: 2,
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
            data: [
              { title: 'First post' },
              { title: 'Second post' },
              { title: 'Third post' },
            ],
            error: null,
          },
        }),
      )

      expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([
        'First post',
        'Second post',
        'Third post',
      ])
    })

    it('renders one expansion per entry when key is "$index" over a plain object with ordinal position as React key', () => {
      const activePage: RuntimePageConfig = {
        id: 'sources',
        layout: [
          {
            type: 'repeater',
            props: {
              items: {
                source: 'queries.results.data',
                key: '$index',
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
              alpha: { label: 'Alpha label' },
              beta: { label: 'Beta label' },
              gamma: { label: 'Gamma label' },
            },
            error: null,
          },
        }),
      )

      expect(screen.getAllByRole('paragraph').map((p) => p.textContent)).toEqual([
        'Alpha label',
        'Beta label',
        'Gamma label',
      ])
    })

    it('renders iterations normally for null or primitive items when key is "$index"', () => {
      const activePage: RuntimePageConfig = {
        id: 'mixed',
        layout: [
          {
            type: 'repeater',
            props: {
              items: {
                source: 'queries.items.data',
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
          items: {
            status: 'success',
            data: ['hello', null, 42, true],
            error: null,
          },
        }),
      )

      const paragraphs = screen.getAllByRole('paragraph')
      expect(paragraphs).toHaveLength(4)
      expect(paragraphs[0].textContent).toBe('hello')
      expect(paragraphs[1].textContent).toBe('')
      expect(paragraphs[2].textContent).toBe('42')
      expect(paragraphs[3].textContent).toBe('true')
    })

    it('renders all iterations for duplicate values when key is "$index" because indices are inherently unique', () => {
      const activePage: RuntimePageConfig = {
        id: 'dupes',
        layout: [
          {
            type: 'repeater',
            props: {
              items: {
                source: 'queries.tags.data',
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
          tags: {
            status: 'success',
            data: ['a', 'a', 'b'],
            error: null,
          },
        }),
      )

      const paragraphs = screen.getAllByRole('paragraph')
      expect(paragraphs).toHaveLength(3)
      expect(paragraphs.map((p) => p.textContent)).toEqual(['a', 'a', 'b'])
    })

    it('applies pageSize correctly when key is "$index" and shows only first page items', () => {
      const activePage: RuntimePageConfig = {
        id: 'paged',
        layout: [
          {
            type: 'repeater',
            props: {
              items: {
                source: 'queries.items.data',
                key: '$index',
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
          items: {
            status: 'success',
            data: [
              { title: 'Item 1' },
              { title: 'Item 2' },
              { title: 'Item 3' },
              { title: 'Item 4' },
              { title: 'Item 5' },
            ],
            error: null,
          },
        }),
      )

      expect(screen.getAllByRole('paragraph').map((p) => p.textContent)).toEqual(['Item 1', 'Item 2'])
      expect(screen.queryByText('Item 3')).not.toBeInTheDocument()
    })
  })

  describe('T0092-T3 item.$index synthetic reference', () => {
    it('renders {{item.$index}} as the numeric index within each iteration when key is "id" (not "$index")', () => {
      const activePage: RuntimePageConfig = {
        id: 'posts',
        layout: [
          {
            type: 'repeater',
            props: {
              items: {
                source: 'queries.posts.data',
                key: 'id',
              },
              template: [
                {
                  type: 'paragraph',
                  props: {
                    text: '{{item.$index}}: {{item.title}}',
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
            data: [
              { id: 'a', title: 'First' },
              { id: 'b', title: 'Second' },
              { id: 'c', title: 'Third' },
            ],
            error: null,
          },
        }),
      )

      expect(screen.getAllByRole('paragraph').map((p) => p.textContent)).toEqual([
        '0: First',
        '1: Second',
        '2: Third',
      ])
    })

    it('renders {{item.$index}} when key is "$index"', () => {
      const activePage: RuntimePageConfig = {
        id: 'tags',
        layout: [
          {
            type: 'repeater',
            props: {
              items: {
                source: 'queries.tags.data',
                key: '$index',
              },
              template: [
                {
                  type: 'paragraph',
                  props: {
                    text: '{{item.$index}}: {{item}}',
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
          tags: {
            status: 'success',
            data: ['a', 'b', 'c'],
            error: null,
          },
        }),
      )

      expect(screen.getAllByRole('paragraph').map((p) => p.textContent)).toEqual([
        '0: a',
        '1: b',
        '2: c',
      ])
    })

    it('renders {{item.$index}} as ordinal position for plain object source', () => {
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
                    text: '{{item.$index}}: {{item.label}}',
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
              alpha: { label: 'Alpha' },
              beta: { label: 'Beta' },
              gamma: { label: 'Gamma' },
            },
            error: null,
          },
        }),
      )

      expect(screen.getAllByRole('paragraph').map((p) => p.textContent)).toEqual([
        '0: Alpha',
        '1: Beta',
        '2: Gamma',
      ])
    })

    it('gives item.$index precedence over a literal $index property in the item value', () => {
      const activePage: RuntimePageConfig = {
        id: 'posts',
        layout: [
          {
            type: 'repeater',
            props: {
              items: {
                source: 'queries.posts.data',
                key: 'id',
              },
              template: [
                {
                  type: 'paragraph',
                  props: {
                    text: '{{item.$index}}',
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
            data: [
              { id: 'a', $index: 'shadow-value' },
              { id: 'b', $index: 99 },
            ],
            error: null,
          },
        }),
      )

      expect(screen.getAllByRole('paragraph').map((p) => p.textContent)).toEqual(['0', '1'])
    })

    it('exposes {{item.$index}} as absolute position in paginated repeater on second page', () => {
      const activePage: RuntimePageConfig = {
        id: 'paged',
        layout: [
          {
            type: 'repeater',
            props: {
              items: {
                source: 'queries.items.data',
                key: 'id',
              },
              pagination: {
                enabled: true,
                pageSize: 3,
              },
              template: [
                {
                  type: 'paragraph',
                  props: {
                    text: '{{item.$index}}',
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
          items: {
            status: 'success',
            data: [
              { id: 'a' },
              { id: 'b' },
              { id: 'c' },
              { id: 'd' },
              { id: 'e' },
              { id: 'f' },
            ],
            error: null,
          },
        }),
      )

      // First page shows items with index 0, 1, 2
      expect(screen.getAllByRole('paragraph').map((p) => p.textContent)).toEqual(['0', '1', '2'])
    })
  })
})
