import { render, screen, fireEvent } from '@testing-library/react'
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
  it('resets a paginated repeater to the first page when the collection reference changes', () => {
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
    const config: RuntimeConfig = {
      api: {},
      initialPage: activePage.id,
      pages: [activePage],
    }
    const firstState = createRuntimePageState(activePage, {
      posts: {
        status: 'success',
        data: {
          results: [
            { id: 'post-1', title: 'First post' },
            { id: 'post-2', title: 'Second post' },
            { id: 'post-3', title: 'Third post' },
            { id: 'post-4', title: 'Fourth post' },
          ],
        },
        error: null,
      },
    })

    const { rerender } = renderRuntimePageWithState(activePage, firstState)

    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    expect(screen.getByText('Third post')).toBeInTheDocument()

    const replacementState = createRuntimePageState(activePage, {
      posts: {
        status: 'success',
        data: {
          results: [
            { id: 'new-1', title: 'New first post' },
            { id: 'new-2', title: 'New second post' },
            { id: 'new-3', title: 'New third post' },
          ],
        },
        error: null,
      },
    })

    rerender(
      <RuntimeStateContext.Provider
        value={{
          config,
          initialState: replacementState,
          state: replacementState,
          dispatch: vi.fn<(action: RuntimeStateAction) => void>(),
          dispatchAndSyncState: vi.fn<(action: RuntimeStateAction) => void>(),
          getLatestState: () => replacementState,
        }}
      >
        <RuntimePage />
      </RuntimeStateContext.Provider>,
    )

    expect(screen.getByText('New first post')).toBeInTheDocument()
    expect(screen.getByText('New second post')).toBeInTheDocument()
    expect(screen.queryByText('New third post')).not.toBeInTheDocument()
  })

  it('resets a paginated repeater when pageSize changes', () => {
    function createPage(pageSize: number): RuntimePageConfig {
      return {
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
                pageSize,
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
    }

    const initialPage = createPage(2)
    const state = createRuntimePageState(initialPage, {
      posts: {
        status: 'success',
        data: {
          results: [
            { id: 'post-1', title: 'First post' },
            { id: 'post-2', title: 'Second post' },
            { id: 'post-3', title: 'Third post' },
            { id: 'post-4', title: 'Fourth post' },
            { id: 'post-5', title: 'Fifth post' },
          ],
        },
        error: null,
      },
    })
    const { rerender } = renderRuntimePageWithState(initialPage, state)

    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    expect(screen.getByText('Third post')).toBeInTheDocument()
    expect(screen.getByText('Fourth post')).toBeInTheDocument()

    const resizedPage = createPage(3)
    const resizedConfig: RuntimeConfig = {
      api: {},
      initialPage: resizedPage.id,
      pages: [resizedPage],
    }

    rerender(
      <RuntimeStateContext.Provider
        value={{
          config: resizedConfig,
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

    expect(screen.getAllByText(/First post|Second post|Third post/, { selector: 'p' }).map((item) => item.textContent)).toEqual([
      'First post',
      'Second post',
      'Third post',
    ])
  })

  it('keeps paginated repeaters independent even when they read the same query', () => {
    const activePage: RuntimePageConfig = {
      id: 'posts',
      layout: [
        {
          type: 'repeater',
          props: {
            items: {
              source: 'queries.posts.data.primary',
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
        {
          type: 'repeater',
          props: {
            items: {
              source: 'queries.posts.data.secondary',
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
            primary: [
              { id: 'primary-1', title: 'Primary one' },
              { id: 'primary-2', title: 'Primary two' },
              { id: 'primary-3', title: 'Primary three' },
            ],
            secondary: [
              { id: 'secondary-1', title: 'Secondary one' },
              { id: 'secondary-2', title: 'Secondary two' },
              { id: 'secondary-3', title: 'Secondary three' },
            ],
          },
          error: null,
        },
      }),
    )

    fireEvent.click(screen.getAllByRole('button', { name: 'Siguiente' })[0])

    expect(screen.getByText('Primary three')).toBeInTheDocument()
    expect(screen.queryByText('Primary one')).not.toBeInTheDocument()
    expect(screen.getByText('Secondary one')).toBeInTheDocument()
    expect(screen.getByText('Secondary two')).toBeInTheDocument()
    expect(screen.queryByText('Secondary three')).not.toBeInTheDocument()
    expect(screen.queryByText(/Página/)).not.toBeInTheDocument()
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

  describe('T0045-03 object source: pagination and reset', () => {
    it('applies pageSize over object entries and shows the first page', () => {
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
              pagination: {
                enabled: true,
                pageSize: 2,
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
              alpha: { label: 'A' },
              beta: { label: 'B' },
              gamma: { label: 'C' },
              delta: { label: 'D' },
            },
            error: null,
          },
        }),
      )

      expect(screen.getAllByRole('paragraph').map((p) => p.textContent)).toEqual(['alpha', 'beta'])
      expect(screen.queryByText('gamma')).not.toBeInTheDocument()
      expect(screen.queryByText('delta')).not.toBeInTheDocument()
    })

    it('resets to first page when the object source changes to another object', () => {
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
              pagination: {
                enabled: true,
                pageSize: 2,
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

      const config: RuntimeConfig = {
        api: {},
        initialPage: activePage.id,
        pages: [activePage],
      }

      const firstState = createRuntimePageState(activePage, {
        results: {
          status: 'success',
          data: { alpha: {}, beta: {}, gamma: {}, delta: {} },
          error: null,
        },
      })

      const { rerender } = renderRuntimePageWithState(activePage, firstState)

      fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
      expect(screen.getByText('gamma')).toBeInTheDocument()

      const secondState = createRuntimePageState(activePage, {
        results: {
          status: 'success',
          data: { uno: {}, dos: {}, tres: {} },
          error: null,
        },
      })

      rerender(
        <RuntimeStateContext.Provider
          value={{
            config,
            initialState: secondState,
            state: secondState,
            dispatch: vi.fn<(action: RuntimeStateAction) => void>(),
            dispatchAndSyncState: vi.fn<(action: RuntimeStateAction) => void>(),
            getLatestState: () => secondState,
          }}
        >
          <RuntimePage />
        </RuntimeStateContext.Provider>,
      )

      expect(screen.getByText('uno')).toBeInTheDocument()
      expect(screen.getByText('dos')).toBeInTheDocument()
      expect(screen.queryByText('tres')).not.toBeInTheDocument()
    })

    it('resets to first page when the source changes from object to array', () => {
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
              pagination: {
                enabled: true,
                pageSize: 2,
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

      const config: RuntimeConfig = {
        api: {},
        initialPage: activePage.id,
        pages: [activePage],
      }

      const objectState = createRuntimePageState(activePage, {
        results: {
          status: 'success',
          data: {
            a: { id: 'a', label: 'A label' },
            b: { id: 'b', label: 'B label' },
            c: { id: 'c', label: 'C label' },
            d: { id: 'd', label: 'D label' },
          },
          error: null,
        },
      })

      const { rerender } = renderRuntimePageWithState(activePage, objectState)

      fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
      expect(screen.getByText('C label')).toBeInTheDocument()

      const arrayState = createRuntimePageState(activePage, {
        results: {
          status: 'success',
          data: [
            { id: 'x1', label: 'X one' },
            { id: 'x2', label: 'X two' },
            { id: 'x3', label: 'X three' },
          ],
          error: null,
        },
      })

      rerender(
        <RuntimeStateContext.Provider
          value={{
            config,
            initialState: arrayState,
            state: arrayState,
            dispatch: vi.fn<(action: RuntimeStateAction) => void>(),
            dispatchAndSyncState: vi.fn<(action: RuntimeStateAction) => void>(),
            getLatestState: () => arrayState,
          }}
        >
          <RuntimePage />
        </RuntimeStateContext.Provider>,
      )

      expect(screen.getByText('X one')).toBeInTheDocument()
      expect(screen.getByText('X two')).toBeInTheDocument()
      expect(screen.queryByText('X three')).not.toBeInTheDocument()
    })
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
