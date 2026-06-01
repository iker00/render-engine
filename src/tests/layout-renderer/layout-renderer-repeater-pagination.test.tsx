import { act, render, screen, fireEvent } from '@testing-library/react'
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
  it('renders repeater pagination controls, navigates within bounds, and exposes page state', () => {
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
              { id: 'post-2', title: 'Second post' },
              { id: 'post-3', title: 'Third post' },
              { id: 'post-4', title: 'Fourth post' },
              { id: 'post-5', title: 'Fifth post' },
            ],
          },
          error: null,
        },
      }),
    )

    const previousButton = screen.getByRole('button', { name: 'Anterior' })
    const nextButton = screen.getByRole('button', { name: 'Siguiente' })

    expect(previousButton).toHaveAttribute('type', 'button')
    expect(nextButton).toHaveAttribute('type', 'button')
    expect(previousButton).toBeDisabled()
    expect(nextButton).toBeEnabled()
    expect(screen.queryByText(/Página/)).not.toBeInTheDocument()
    expect(screen.getAllByText(/First post|Second post/, { selector: 'p' }).map((item) => item.textContent)).toEqual([
      'First post',
      'Second post',
    ])

    fireEvent.click(nextButton)
    expect(previousButton).toBeEnabled()
    expect(screen.getAllByText(/Third post|Fourth post/, { selector: 'p' }).map((item) => item.textContent)).toEqual([
      'Third post',
      'Fourth post',
    ])

    fireEvent.click(nextButton)
    expect(nextButton).toBeDisabled()
    expect(screen.getByText('Fifth post')).toBeInTheDocument()

    fireEvent.click(nextButton)
    expect(screen.getByText('Fifth post')).toBeInTheDocument()

    fireEvent.click(previousButton)
    expect(screen.getAllByText(/Third post|Fourth post/, { selector: 'p' }).map((item) => item.textContent)).toEqual([
      'Third post',
      'Fourth post',
    ])

    fireEvent.click(previousButton)
    expect(previousButton).toBeDisabled()
    expect(screen.getAllByText(/First post|Second post/, { selector: 'p' }).map((item) => item.textContent)).toEqual([
      'First post',
      'Second post',
    ])
  })

  it('hides repeater pagination controls when no navigation is useful', () => {
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
              pageSize: 5,
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
            results: [{ id: 'post-1', title: 'First post' }],
          },
          error: null,
        },
      }),
    )

    expect(screen.getByText('First post')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Anterior' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Siguiente' })).not.toBeInTheDocument()
    expect(screen.queryByText(/Página/)).not.toBeInTheDocument()
  })

  it('renders numbered repeater pagination and selects concrete pages', () => {
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
              controls: {
                variant: 'numbered',
              },
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
              { id: 'post-2', title: 'Second post' },
              { id: 'post-3', title: 'Third post' },
              { id: 'post-4', title: 'Fourth post' },
              { id: 'post-5', title: 'Fifth post' },
            ],
          },
          error: null,
        },
      }),
    )

    expect(screen.getByRole('button', { name: 'Primera' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '1' })).toHaveAttribute('aria-current', 'page')
    expect(screen.queryByText(/Página/)).not.toBeInTheDocument()
    expect(screen.getAllByText(/First post|Second post/, { selector: 'p' }).map((item) => item.textContent)).toEqual([
      'First post',
      'Second post',
    ])

    fireEvent.click(screen.getByRole('button', { name: '2' }))
    expect(screen.getByRole('button', { name: '2' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getAllByText(/Third post|Fourth post/, { selector: 'p' }).map((item) => item.textContent)).toEqual([
      'Third post',
      'Fourth post',
    ])

    fireEvent.click(screen.getByRole('button', { name: 'Última' }))
    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Última' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '3' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByText('Fifth post')).toBeInTheDocument()
    expect(screen.queryByText('Fourth post')).not.toBeInTheDocument()
  })

  it('hides numbered pagination controls when only one page is effective', () => {
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
              pageSize: 5,
              controls: {
                variant: 'numbered',
              },
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
            results: [{ id: 'post-1', title: 'First post' }],
          },
          error: null,
        },
      }),
    )

    expect(screen.getByText('First post')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Primera' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '1' })).not.toBeInTheDocument()
    expect(screen.queryByText(/Página/)).not.toBeInTheDocument()
  })

  it('renders a compact numbered pagination window for more than five pages', () => {
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
              pageSize: 1,
              controls: {
                variant: 'numbered',
              },
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
            results: Array.from({ length: 8 }, (_, index) => ({
              id: `post-${index + 1}`,
              title: `Post ${index + 1}`,
            })),
          },
          error: null,
        },
      }),
    )

    expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual([
      'Primera',
      'Anterior',
      '1',
      '2',
      '3',
      '4',
      '5',
      'Siguiente',
      'Última',
    ])

    fireEvent.click(screen.getByRole('button', { name: 'Última' }))

    expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual([
      'Primera',
      'Anterior',
      '4',
      '5',
      '6',
      '7',
      '8',
      'Siguiente',
      'Última',
    ])
    expect(screen.getByText('Post 8')).toBeInTheDocument()
  })

  it('renders scroll pagination with a local fallback action when IntersectionObserver is unavailable', () => {
    vi.stubGlobal('IntersectionObserver', undefined)
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
              controls: {
                variant: 'scroll',
              },
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
              { id: 'post-2', title: 'Second post' },
              { id: 'post-3', title: 'Third post' },
              { id: 'post-4', title: 'Fourth post' },
              { id: 'post-5', title: 'Fifth post' },
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
    expect(screen.queryByText('Third post')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Mostrar más' }))
    expect(screen.getAllByText(/First post|Second post|Third post|Fourth post/, { selector: 'p' })).toHaveLength(4)

    fireEvent.click(screen.getByRole('button', { name: 'Mostrar más' }))
    expect(screen.getByText('Fifth post')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Mostrar más' })).not.toBeInTheDocument()

    vi.unstubAllGlobals()
  })

  it('advances scroll pagination through IntersectionObserver and removes the sentinel at the end', () => {
    let observerCallback: IntersectionObserverCallback | null = null
    const observe = vi.fn()
    const disconnect = vi.fn()

    vi.stubGlobal(
      'IntersectionObserver',
      vi.fn((callback: IntersectionObserverCallback) => {
        observerCallback = callback

        return {
          observe,
          disconnect,
          unobserve: vi.fn(),
          takeRecords: vi.fn(() => []),
        }
      }),
    )

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
              controls: {
                variant: 'scroll',
              },
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
              { id: 'post-2', title: 'Second post' },
              { id: 'post-3', title: 'Third post' },
              { id: 'post-4', title: 'Fourth post' },
              { id: 'post-5', title: 'Fifth post' },
            ],
          },
          error: null,
        },
      }),
    )

    expect(observe).toHaveBeenCalled()
    expect(document.querySelector('[data-layout-node="repeater-scroll-sentinel"]')).toBeInTheDocument()

    act(() => {
      observerCallback?.([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver)
    })
    expect(screen.getAllByText(/First post|Second post|Third post|Fourth post/, { selector: 'p' })).toHaveLength(4)

    act(() => {
      observerCallback?.([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver)
    })
    expect(screen.getByText('Fifth post')).toBeInTheDocument()
    expect(document.querySelector('[data-layout-node="repeater-scroll-sentinel"]')).not.toBeInTheDocument()
    expect(disconnect).toHaveBeenCalled()

    vi.unstubAllGlobals()
  })

  it('renders repeater pagination controls as a full row inside effective grids', () => {
    const activePage: RuntimePageConfig = {
      id: 'posts',
      layout: [
        {
          type: 'container',
          props: {
            columns: 4,
          },
          children: [
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
                    layout: {
                      span: 2,
                    },
                    props: {
                      text: 'item.title',
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
              { id: 'post-1', title: 'First post' },
              { id: 'post-2', title: 'Second post' },
              { id: 'post-3', title: 'Third post' },
            ],
          },
          error: null,
        },
      }),
    )

    expect(screen.getByText('First post').parentElement).toHaveClass('col-span-2')
    expect(document.querySelector('[data-layout-node="repeater-pagination"]')).toHaveClass('col-span-4')
  })

  it('renders repeater pagination controls as a full responsive row inside responsive grids', () => {
    const activePage: RuntimePageConfig = {
      id: 'responsive-posts',
      layout: [
        {
          type: 'container',
          props: {
            columns: {
              base: 1,
              md: 2,
              lg: 4,
            },
          },
          children: [
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
                    layout: {
                      span: {
                        base: 1,
                        md: 2,
                      },
                    },
                    props: {
                      text: 'item.title',
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
              { id: 'post-1', title: 'First responsive post' },
              { id: 'post-2', title: 'Second responsive post' },
              { id: 'post-3', title: 'Third responsive post' },
            ],
          },
          error: null,
        },
      }),
    )

    expect(screen.getByText('First responsive post').parentElement).toHaveClass('col-span-1', 'md:col-span-2')
    expect(document.querySelector('[data-layout-node="repeater-pagination"]')).toHaveClass(
      'col-span-1',
      'md:col-span-2',
      'lg:col-span-4',
    )
  })
})
