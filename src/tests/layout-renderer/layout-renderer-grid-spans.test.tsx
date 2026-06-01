import { fireEvent, render, screen } from '@testing-library/react'
import { useEffect } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RuntimeConfig, RuntimePageConfig } from '../../config/runtime-config'
import { RuntimePage } from '../../runtime/runtime-page'
import { RuntimeStateContext } from '../../runtime/runtime-state/runtime-state-context'
import { createRuntimeState } from '../../runtime/runtime-state/runtime-state-reducer'
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

  it('propagates responsive grid columns to child layout spans without viewport logic', () => {
    renderRuntimePage({
      id: 'responsive-grid-span-layout',
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
              type: 'heading',
              layout: {
                span: {
                  base: 1,
                  md: 2,
                },
              },
              props: {
                text: 'Responsive grid heading',
                level: 2,
              },
            },
          ],
        },
        {
          type: 'paragraph',
          layout: {
            span: {
              base: 1,
              md: 2,
            },
          },
          props: {
            text: 'Responsive span outside grid',
          },
        },
      ],
    })

    const container = screen.getByRole('heading', { name: 'Responsive grid heading', level: 2 }).closest('[data-layout-node="container"]')
    const headingWrapper = screen.getByRole('heading', { name: 'Responsive grid heading', level: 2 }).parentElement
    const outsideGridWrapper = screen.getByText('Responsive span outside grid').parentElement

    expect(container).toHaveClass('grid', 'w-full', 'grid-cols-1', 'md:grid-cols-2', 'lg:grid-cols-4')
    expect(headingWrapper).toHaveClass('col-span-1', 'md:col-span-2')
    expect(outsideGridWrapper).not.toHaveClass('col-span-1', 'md:col-span-2')
  })

  it('clamps responsive child spans against effective parent columns by breakpoint', () => {
    renderRuntimePage({
      id: 'responsive-grid-clamp-layout',
      layout: [
        {
          type: 'container',
          props: {
            columns: {
              base: 1,
              lg: 3,
            },
          },
          children: [
            {
              type: 'heading',
              layout: {
                span: {
                  base: 2,
                  lg: 4,
                },
              },
              props: {
                text: 'Clamped responsive heading',
                level: 2,
              },
            },
            {
              type: 'paragraph',
              layout: {
                span: {
                  md: 2,
                },
              },
              props: {
                text: 'Parent breakpoint recalculates span',
              },
            },
          ],
        },
      ],
    })

    expect(screen.getByRole('heading', { name: 'Clamped responsive heading', level: 2 }).parentElement).toHaveClass(
      'col-span-1',
      'lg:col-span-3',
    )
    expect(screen.getByText('Parent breakpoint recalculates span').parentElement).toHaveClass(
      'col-span-1',
      'lg:col-span-2',
    )
  })

  it('uses safe mobile fallbacks for responsive columns and spans that omit base', () => {
    renderRuntimePage({
      id: 'responsive-grid-fallback-layout',
      layout: [
        {
          type: 'container',
          props: {
            columns: {
              md: 2,
              lg: 4,
            },
          },
          children: [
            {
              type: 'heading',
              layout: {
                span: {
                  lg: 2,
                },
              },
              props: {
                text: 'Fallback responsive heading',
                level: 2,
              },
            },
          ],
        },
        {
          type: 'container',
          props: {
            columns: {
              lg: 3,
            },
          },
          children: [],
        },
      ],
    })

    const heading = screen.getByRole('heading', { name: 'Fallback responsive heading', level: 2 })
    const container = heading.closest('[data-layout-node="container"]')
    const pageRoot = screen.getByTestId('runtime-page')

    expect(container).toHaveClass('grid-cols-1', 'md:grid-cols-2', 'lg:grid-cols-4')
    expect(heading.parentElement).toHaveClass('col-span-1', 'lg:col-span-2')
    expect(pageRoot.querySelectorAll('[data-layout-node="container"]')).toHaveLength(2)
  })

  it('applies queryStateFeedback fallback spans against the responsive grid parent', () => {
    renderRuntimePageWithQueryFeedback({
      id: 'responsive-query-feedback-grid',
      layout: [
        {
          type: 'container',
          props: {
            columns: {
              base: 1,
              md: 2,
            },
          },
          children: [
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
                        layout: {
                          span: {
                            base: 1,
                            md: 2,
                          },
                        },
                        props: {
                          text: 'Responsive idle fallback',
                          level: 2,
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
        },
      ],
    })

    expect(screen.getByRole('heading', { name: 'Responsive idle fallback', level: 2 }).parentElement).toHaveClass(
      'col-span-1',
      'md:col-span-2',
    )
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

  it('keeps repeater itself span-less while template roots use responsive spans inside responsive grids', () => {
    const activePage: RuntimePageConfig = {
      id: 'responsive-repeater-grid-span',
      layout: [
        {
          type: 'container',
          props: {
            columns: {
              base: 1,
              md: 2,
            },
          },
          children: [
            {
              type: 'repeater',
              layout: {
                span: {
                  base: 1,
                  md: 2,
                },
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
                      span: {
                        base: 1,
                        md: 2,
                      },
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
    }

    renderRuntimePageWithState(
      activePage,
      createRuntimePageState(activePage, {
        users: {
          status: 'success',
          data: {
            results: [
              { id: 'user-1', name: 'Responsive Ada' },
              { id: 'user-2', name: 'Responsive Grace' },
            ],
          },
          error: null,
          requestSignature: null,
        },
      }),
    )

    const adaCard = screen.getByText('Responsive Ada').closest('[data-layout-node="container"]')
    const repeaterGrid = adaCard?.parentElement?.parentElement

    expect(adaCard?.parentElement).toHaveClass('col-span-1', 'md:col-span-2')
    expect(repeaterGrid).not.toHaveClass('col-span-1', 'md:col-span-2')
  })
})
