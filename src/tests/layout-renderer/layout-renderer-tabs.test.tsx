import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RuntimeConfig, RuntimePageConfig } from '../../config/runtime-config'
import { RuntimePage } from '../../runtime/runtime-page'
import { RuntimeStateContext } from '../../runtime/runtime-state/runtime-state-context'
import { createRuntimeState } from '../../runtime/runtime-state/runtime-state-reducer'
import type { RuntimeState, RuntimeStateAction } from '../../runtime/runtime-state/runtime-state-types'
import { RuntimeStateProvider, useRuntimeStateActions } from '../../runtime/runtime-state/runtime-state-provider'
import { useEffect } from 'react'

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
  } satisfies RuntimeState
}

describe('TabsNode — orientation', () => {
  it('renders tabs-bar before tabs-panel in DOM for horizontal orientation', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'tabs',
          props: {
            orientation: 'horizontal',
            items: [
              { label: 'Tab A', children: [] },
              { label: 'Tab B', children: [] },
            ],
          },
        },
      ],
    }

    const { container } = renderRuntimePage(page)
    const tabsNode = container.querySelector('[data-layout-node="tabs"]')
    expect(tabsNode).toBeInTheDocument()

    const bar = tabsNode!.querySelector('[data-layout-node="tabs-bar"]')
    const panel = tabsNode!.querySelector('[data-layout-node="tabs-panel"]')
    expect(bar).toBeInTheDocument()
    expect(panel).toBeInTheDocument()

    // bar must appear before panel in DOM order
    const position = bar!.compareDocumentPosition(panel!)
    expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('renders tabs-bar and tabs-panel side-by-side (flex-row) for vertical orientation', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'tabs',
          props: {
            orientation: 'vertical',
            items: [
              { label: 'Tab A', children: [] },
              { label: 'Tab B', children: [] },
            ],
          },
        },
      ],
    }

    const { container } = renderRuntimePage(page)
    const tabsNode = container.querySelector('[data-layout-node="tabs"]')
    expect(tabsNode).toBeInTheDocument()

    // Root node should have a flex-row class for vertical orientation
    expect(tabsNode!.className).toMatch(/flex-row|flex.*row/)
  })

  it('defaults to horizontal orientation when orientation is not declared', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'tabs',
          props: {
            items: [{ label: 'Tab A', children: [] }],
          },
        },
      ],
    }

    const { container } = renderRuntimePage(page)
    const tabsNode = container.querySelector('[data-layout-node="tabs"]')
    expect(tabsNode).toBeInTheDocument()

    const bar = tabsNode!.querySelector('[data-layout-node="tabs-bar"]')
    const panel = tabsNode!.querySelector('[data-layout-node="tabs-panel"]')
    expect(bar).toBeInTheDocument()
    expect(panel).toBeInTheDocument()

    const position = bar!.compareDocumentPosition(panel!)
    expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})

describe('TabsNode — active tab', () => {
  it('activates the first tab (index 0) by default when defaultTab is not declared', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'tabs',
          props: {
            items: [
              { label: 'First', children: [{ type: 'heading', props: { text: 'First content', level: 2 } }] },
              { label: 'Second', children: [{ type: 'heading', props: { text: 'Second content', level: 2 } }] },
            ],
          },
        },
      ],
    }

    renderRuntimePage(page)

    expect(screen.getByText('First content')).toBeInTheDocument()
    expect(screen.queryByText('Second content')).not.toBeInTheDocument()
  })

  it('activates the second tab when props.defaultTab is 1', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'tabs',
          props: {
            defaultTab: 1,
            items: [
              { label: 'First', children: [{ type: 'heading', props: { text: 'First content', level: 2 } }] },
              { label: 'Second', children: [{ type: 'heading', props: { text: 'Second content', level: 2 } }] },
            ],
          },
        },
      ],
    }

    renderRuntimePage(page)

    expect(screen.queryByText('First content')).not.toBeInTheDocument()
    expect(screen.getByText('Second content')).toBeInTheDocument()
  })

  it('only renders the active panel; inactive panels are absent from DOM', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'tabs',
          props: {
            items: [
              { label: 'A', children: [{ type: 'paragraph', props: { text: 'Panel A' } }] },
              { label: 'B', children: [{ type: 'paragraph', props: { text: 'Panel B' } }] },
              { label: 'C', children: [{ type: 'paragraph', props: { text: 'Panel C' } }] },
            ],
          },
        },
      ],
    }

    renderRuntimePage(page)

    expect(screen.getByText('Panel A')).toBeInTheDocument()
    expect(screen.queryByText('Panel B')).not.toBeInTheDocument()
    expect(screen.queryByText('Panel C')).not.toBeInTheDocument()
  })

  it('switches to the clicked tab and removes the previous panel from DOM', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'tabs',
          props: {
            items: [
              { label: 'Tab A', children: [{ type: 'paragraph', props: { text: 'Content A' } }] },
              { label: 'Tab B', children: [{ type: 'paragraph', props: { text: 'Content B' } }] },
            ],
          },
        },
      ],
    }

    renderRuntimePage(page)

    expect(screen.getByText('Content A')).toBeInTheDocument()
    expect(screen.queryByText('Content B')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Tab B' }))

    expect(screen.queryByText('Content A')).not.toBeInTheDocument()
    expect(screen.getByText('Content B')).toBeInTheDocument()
  })

  it('falls back to the first tab when defaultTab is out of range', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'tabs',
          props: {
            defaultTab: 99,
            items: [
              { label: 'Tab A', children: [{ type: 'paragraph', props: { text: 'Content A' } }] },
              { label: 'Tab B', children: [{ type: 'paragraph', props: { text: 'Content B' } }] },
            ],
          },
        },
      ],
    }

    renderRuntimePage(page)

    expect(screen.getByText('Content A')).toBeInTheDocument()
    expect(screen.queryByText('Content B')).not.toBeInTheDocument()
  })

  it('renders nothing when props.items is empty', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'tabs',
          // @ts-expect-error intentionally invalid for edge-case test
          props: { items: [] },
        },
      ],
    }

    const { container } = renderRuntimePage(page)
    const tabsNode = container.querySelector('[data-layout-node="tabs"]')
    expect(tabsNode).not.toBeInTheDocument()
  })
})

describe('TabsNode — label interpolation', () => {
  it('resolves {{queries.someQuery.data.title}} in a tab label', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'tabs',
          props: {
            items: [
              { label: '{{queries.someQuery.data.title}}', children: [] },
            ],
          },
        },
      ],
    }

    const state = createRuntimePageState(page, {
      someQuery: {
        status: 'success',
        data: { title: 'Resolved Title' },
        requestedAt: 0,
        resolvedAt: 0,
        error: null,
      },
    })

    renderRuntimePageWithState(page, state)

    expect(screen.getByRole('button', { name: 'Resolved Title' })).toBeInTheDocument()
  })
})

describe('TabsNode — children rendering', () => {
  it('renders heading children inside the active tab panel', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'tabs',
          props: {
            items: [
              {
                label: 'Tab 1',
                children: [{ type: 'heading', props: { text: 'Tab One Heading', level: 2 } }],
              },
            ],
          },
        },
      ],
    }

    renderRuntimePage(page)

    expect(screen.getByText('Tab One Heading')).toBeInTheDocument()
  })
})

describe('TabsNode — transversal features', () => {
  it('hides the entire tabs node when visibility condition is false', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'tabs',
          visibility: {
            reference: 'queries.someQuery.data.show',
            operator: 'isTruthy',
          },
          props: {
            items: [
              { label: 'Tab A', children: [{ type: 'paragraph', props: { text: 'Hidden content' } }] },
            ],
          },
        },
      ],
    }

    const state = createRuntimePageState(page, {
      someQuery: {
        status: 'success',
        data: { show: false },
        requestedAt: 0,
        resolvedAt: 0,
        error: null,
      },
    })

    renderRuntimePageWithState(page, state)

    expect(screen.queryByText('Hidden content')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Tab A' })).not.toBeInTheDocument()
  })

  it('replaces tabs node with loading fallback when queryStateFeedback triggers loading state', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'tabs',
          queryStateFeedback: {
            query: 'someQuery',
            states: {
              loading: {
                mode: 'fallback',
                fallback: [{ type: 'paragraph', props: { text: 'Loading...' } }],
              },
            },
          },
          props: {
            items: [
              { label: 'Tab A', children: [{ type: 'paragraph', props: { text: 'Real content' } }] },
            ],
          },
        },
      ],
    }

    const state = createRuntimePageState(page, {
      someQuery: {
        status: 'loading',
        data: null,
        requestedAt: 0,
        resolvedAt: null,
        error: null,
      },
    })

    renderRuntimePageWithState(page, state)

    expect(screen.getByText('Loading...')).toBeInTheDocument()
    expect(screen.queryByText('Real content')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Tab A' })).not.toBeInTheDocument()
  })

  it('wraps tabs node in col-span wrapper when layout.span is set inside a container with columns', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'container',
          props: { columns: 12 },
          children: [
            {
              type: 'tabs',
              layout: { span: 6 },
              props: {
                items: [{ label: 'Tab A', children: [] }],
              },
            },
          ],
        },
      ],
    }

    const { container } = renderRuntimePage(page)
    const spanWrapper = container.querySelector('.col-span-6')
    expect(spanWrapper).toBeInTheDocument()
    expect(spanWrapper!.querySelector('[data-layout-node="tabs"]')).toBeInTheDocument()
  })
})

describe('TabsNode — active tab indicator', () => {
  it('active tab button has aria-selected="true"; inactive tabs have aria-selected="false"', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'tabs',
          props: {
            items: [
              { label: 'First', children: [] },
              { label: 'Second', children: [] },
            ],
          },
        },
      ],
    }

    renderRuntimePage(page)

    const firstBtn = screen.getByRole('button', { name: 'First' })
    const secondBtn = screen.getByRole('button', { name: 'Second' })

    expect(firstBtn).toHaveAttribute('aria-selected', 'true')
    expect(secondBtn).toHaveAttribute('aria-selected', 'false')
  })
})

describe('TabsNode — form integration', () => {
  it('renders correctly inside a form without errors', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'form',
          id: 'myForm',
          children: [
            {
              type: 'tabs',
              props: {
                items: [
                  { label: 'Fields', children: [{ type: 'heading', props: { text: 'Form Tabs', level: 3 } }] },
                ],
              },
            },
          ],
        },
      ],
    }

    renderRuntimePage(page)

    expect(screen.getByText('Form Tabs')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Fields' })).toBeInTheDocument()
  })
})

// ── Helpers for item-visibility tests ──────────────────────────────────────

function buildQueryState(queryName: string, data: unknown): RuntimeState['queries'] {
  return {
    [queryName]: {
      status: 'success',
      data,
      requestedAt: 0,
      resolvedAt: 0,
      error: null,
    },
  }
}

function ToggleQueryFixture({ queryName, fieldPath, trueValue }: { queryName: string; fieldPath: string; trueValue: unknown }) {
  const { initializeQuery, setQuerySuccess } = useRuntimeStateActions()

  useEffect(() => {
    initializeQuery(queryName)
  }, [initializeQuery, queryName])

  return (
    <>
      <button type="button" onClick={() => setQuerySuccess(queryName, { [fieldPath]: trueValue })}>
        show
      </button>
      <button type="button" onClick={() => setQuerySuccess(queryName, { [fieldPath]: null })}>
        hide
      </button>
    </>
  )
}

function renderWithToggle(page: RuntimePageConfig, queryName: string, fieldPath: string, trueValue: unknown) {
  const config: RuntimeConfig = {
    api: {},
    initialPage: page.id,
    pages: [page],
  }

  return render(
    <RuntimeStateProvider config={config}>
      <ToggleQueryFixture queryName={queryName} fieldPath={fieldPath} trueValue={trueValue} />
      <RuntimePage />
    </RuntimeStateProvider>,
  )
}

// ── item-level visibility tests ─────────────────────────────────────────────

describe('TabsNode — item visibility', () => {
  it('hides a tab from the bar and its panel when item visibility evaluates to false', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'tabs',
          props: {
            items: [
              {
                label: 'Visible Tab',
                children: [{ type: 'paragraph', props: { text: 'Visible content' } }],
              },
              {
                label: 'Hidden Tab',
                visibility: { reference: 'queries.q.data.show', operator: 'isTruthy' },
                children: [{ type: 'paragraph', props: { text: 'Hidden content' } }],
              },
            ],
          },
        },
      ],
    }

    const state = createRuntimePageState(page, buildQueryState('q', { show: false }))
    renderRuntimePageWithState(page, state)

    expect(screen.queryByRole('button', { name: 'Hidden Tab' })).not.toBeInTheDocument()
    expect(screen.queryByText('Hidden content')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Visible Tab' })).toBeInTheDocument()
  })

  it('mounts with first visible tab active when index 0 is hidden and no defaultTab declared', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'tabs',
          props: {
            items: [
              {
                label: 'Hidden',
                visibility: { reference: 'queries.q.data.show', operator: 'isTruthy' },
                children: [{ type: 'paragraph', props: { text: 'Hidden panel' } }],
              },
              {
                label: 'Second',
                children: [{ type: 'paragraph', props: { text: 'Second panel' } }],
              },
              {
                label: 'Third',
                children: [{ type: 'paragraph', props: { text: 'Third panel' } }],
              },
            ],
          },
        },
      ],
    }

    const state = createRuntimePageState(page, buildQueryState('q', { show: false }))
    renderRuntimePageWithState(page, state)

    expect(screen.queryByRole('button', { name: 'Hidden' })).not.toBeInTheDocument()
    expect(screen.getAllByRole('button').filter(b => b.getAttribute('aria-selected') === 'true')).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Second' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText('Second panel')).toBeInTheDocument()
    expect(screen.queryByText('Hidden panel')).not.toBeInTheDocument()
  })

  it('mounts with first visible tab when defaultTab points to a hidden item', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'tabs',
          props: {
            defaultTab: 1,
            items: [
              {
                label: 'First',
                children: [{ type: 'paragraph', props: { text: 'First panel' } }],
              },
              {
                label: 'Hidden Default',
                visibility: { reference: 'queries.q.data.show', operator: 'isTruthy' },
                children: [{ type: 'paragraph', props: { text: 'Hidden panel' } }],
              },
            ],
          },
        },
      ],
    }

    const state = createRuntimePageState(page, buildQueryState('q', { show: false }))
    renderRuntimePageWithState(page, state)

    expect(screen.queryByRole('button', { name: 'Hidden Default' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'First' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText('First panel')).toBeInTheDocument()
  })

  it('regression: mounts with defaultTab:2 active when all three items are visible', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'tabs',
          props: {
            defaultTab: 2,
            items: [
              { label: 'A', children: [{ type: 'paragraph', props: { text: 'Panel A' } }] },
              { label: 'B', children: [{ type: 'paragraph', props: { text: 'Panel B' } }] },
              { label: 'C', children: [{ type: 'paragraph', props: { text: 'Panel C' } }] },
            ],
          },
        },
      ],
    }

    renderRuntimePage(page)

    expect(screen.getByRole('button', { name: 'C' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText('Panel C')).toBeInTheDocument()
    expect(screen.queryByText('Panel A')).not.toBeInTheDocument()
    expect(screen.queryByText('Panel B')).not.toBeInTheDocument()
  })

  it('auto-activates first visible tab when active tab becomes hidden, without user interaction', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'tabs',
          props: {
            items: [
              { label: 'First', children: [{ type: 'paragraph', props: { text: 'First panel' } }] },
              {
                label: 'Second',
                visibility: { reference: 'queries.q.data.show', operator: 'isTruthy' },
                children: [{ type: 'paragraph', props: { text: 'Second panel' } }],
              },
            ],
          },
        },
      ],
    }

    renderWithToggle(page, 'q', 'show', true)

    // Activate second tab so it becomes active
    fireEvent.click(screen.getByRole('button', { name: 'show' }))
    fireEvent.click(screen.getByRole('button', { name: 'Second' }))
    expect(screen.getByText('Second panel')).toBeInTheDocument()

    // Now hide second tab — first should become active
    fireEvent.click(screen.getByRole('button', { name: 'hide' }))

    expect(screen.queryByRole('button', { name: 'Second' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'First' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText('First panel')).toBeInTheDocument()
  })

  it('renders nothing when all items are hidden by visibility', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'tabs',
          props: {
            items: [
              {
                label: 'Tab A',
                visibility: { reference: 'queries.q.data.show', operator: 'isTruthy' },
                children: [{ type: 'paragraph', props: { text: 'Panel A' } }],
              },
              {
                label: 'Tab B',
                visibility: { reference: 'queries.q.data.show', operator: 'isTruthy' },
                children: [{ type: 'paragraph', props: { text: 'Panel B' } }],
              },
            ],
          },
        },
      ],
    }

    const state = createRuntimePageState(page, buildQueryState('q', { show: false }))
    const { container } = renderRuntimePageWithState(page, state)

    expect(container.querySelector('[data-layout-node="tabs"]')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Tab A' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Tab B' })).not.toBeInTheDocument()
  })

  it('regression: item without visibility is visible alongside items that have visibility', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'tabs',
          props: {
            items: [
              { label: 'Always', children: [] },
              {
                label: 'Conditional',
                visibility: { reference: 'queries.q.data.show', operator: 'isTruthy' },
                children: [],
              },
            ],
          },
        },
      ],
    }

    const state = createRuntimePageState(page, buildQueryState('q', { show: true }))
    renderRuntimePageWithState(page, state)

    expect(screen.getByRole('button', { name: 'Always' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Conditional' })).toBeInTheDocument()
  })

  it('does not render tabs node when node-level visibility is false regardless of item visibility', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'tabs',
          visibility: { reference: 'queries.q.data.show', operator: 'isTruthy' },
          props: {
            items: [
              { label: 'Tab A', children: [{ type: 'paragraph', props: { text: 'Panel A' } }] },
            ],
          },
        },
      ],
    }

    const state = createRuntimePageState(page, buildQueryState('q', { show: false }))
    const { container } = renderRuntimePageWithState(page, state)

    expect(container.querySelector('[data-layout-node="tabs"]')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Tab A' })).not.toBeInTheDocument()
  })

  it('evaluates item visibility per iteration in a repeater using item.* references', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'repeater',
          props: {
            items: {
              source: 'queries.q.data.rows',
              key: 'id',
            },
            template: [
              {
                type: 'tabs',
                props: {
                  items: [
                    { label: 'Always', children: [{ type: 'paragraph', props: { text: 'Always visible' } }] },
                    {
                      label: 'Conditional',
                      visibility: { reference: 'item.showTab', operator: 'isTruthy' },
                      children: [{ type: 'paragraph', props: { text: 'Conditional tab' } }],
                    },
                  ],
                },
              },
            ],
          },
        },
      ],
    }

    const state = createRuntimePageState(page, buildQueryState('q', {
      rows: [
        { id: 'row-1', showTab: true },
        { id: 'row-2', showTab: false },
      ],
    }))
    renderRuntimePageWithState(page, state)

    // First iteration: showTab=true → both tabs visible
    // Second iteration: showTab=false → only 'Always' visible
    const allButtons = screen.getAllByRole('button', { name: 'Always' })
    expect(allButtons).toHaveLength(2)

    const conditionalButtons = screen.queryAllByRole('button', { name: 'Conditional' })
    expect(conditionalButtons).toHaveLength(1)
  })

  it('toggle: shows active tab when hidden then re-shown, maintaining current selection', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'tabs',
          props: {
            items: [
              { label: 'Alpha', children: [{ type: 'paragraph', props: { text: 'Alpha panel' } }] },
              {
                label: 'Beta',
                visibility: { reference: 'queries.q.data.show', operator: 'isTruthy' },
                children: [{ type: 'paragraph', props: { text: 'Beta panel' } }],
              },
            ],
          },
        },
      ],
    }

    renderWithToggle(page, 'q', 'show', true)

    // Make Beta visible and click it
    fireEvent.click(screen.getByRole('button', { name: 'show' }))
    fireEvent.click(screen.getByRole('button', { name: 'Beta' }))
    expect(screen.getByText('Beta panel')).toBeInTheDocument()

    // Hide Beta: Alpha should become active automatically
    fireEvent.click(screen.getByRole('button', { name: 'hide' }))
    expect(screen.getByRole('button', { name: 'Alpha' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText('Alpha panel')).toBeInTheDocument()

    // Reveal Beta again: Alpha stays selected (no forced jump back to Beta)
    fireEvent.click(screen.getByRole('button', { name: 'show' }))
    expect(screen.getByRole('button', { name: 'Alpha' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText('Alpha panel')).toBeInTheDocument()
  })

  it('does not produce React maximum-update-depth warnings when active tab is hidden', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'tabs',
          props: {
            items: [
              { label: 'Alpha', children: [] },
              {
                label: 'Beta',
                visibility: { reference: 'queries.q.data.show', operator: 'isTruthy' },
                children: [],
              },
            ],
          },
        },
      ],
    }

    renderWithToggle(page, 'q', 'show', true)

    // Make Beta visible, select it, then hide it
    fireEvent.click(screen.getByRole('button', { name: 'show' }))
    fireEvent.click(screen.getByRole('button', { name: 'Beta' }))
    fireEvent.click(screen.getByRole('button', { name: 'hide' }))

    const maxUpdateErrors = consoleSpy.mock.calls.filter(args =>
      typeof args[0] === 'string' && args[0].includes('Maximum update depth'),
    )
    expect(maxUpdateErrors).toHaveLength(0)

    consoleSpy.mockRestore()
  })
})

describe('TabsNode — bar sizing and overflow', () => {
  it('vertical bar has w-48 and shrink-0 classes in addition to flex and flex-col', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'tabs',
          props: {
            orientation: 'vertical',
            items: [
              { label: 'Tab A', children: [] },
              { label: 'Tab B', children: [] },
            ],
          },
        },
      ],
    }

    const { container } = renderRuntimePage(page)
    const bar = container.querySelector('[data-layout-node="tabs-bar"]')
    expect(bar).toBeInTheDocument()
    expect(bar).toHaveClass('w-48')
    expect(bar).toHaveClass('shrink-0')
    expect(bar).toHaveClass('flex')
    expect(bar).toHaveClass('flex-col')
  })

  it('vertical buttons have text-left, whitespace-normal and break-words classes (active and inactive)', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'tabs',
          props: {
            orientation: 'vertical',
            items: [
              { label: 'Tab A', children: [] },
              { label: 'Tab B', children: [] },
            ],
          },
        },
      ],
    }

    renderRuntimePage(page)

    const buttons = screen.getAllByRole('button')
    for (const btn of buttons) {
      expect(btn).toHaveClass('text-left')
      expect(btn).toHaveClass('whitespace-normal')
      expect(btn).toHaveClass('break-words')
    }
  })

  it('vertical bar has w-48 and shrink-0 with a single item', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'tabs',
          props: {
            orientation: 'vertical',
            items: [
              { label: 'Only Tab', children: [] },
            ],
          },
        },
      ],
    }

    const { container } = renderRuntimePage(page)
    const bar = container.querySelector('[data-layout-node="tabs-bar"]')
    expect(bar).toHaveClass('w-48')
    expect(bar).toHaveClass('shrink-0')
  })

  it('vertical button with very long label has wrapping classes (whitespace-normal, break-words)', () => {
    const longLabel = 'A'.repeat(60)
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'tabs',
          props: {
            orientation: 'vertical',
            items: [
              { label: longLabel, children: [] },
            ],
          },
        },
      ],
    }

    renderRuntimePage(page)

    const btn = screen.getByRole('button', { name: longLabel })
    expect(btn).toHaveClass('whitespace-normal')
    expect(btn).toHaveClass('break-words')
  })

  it('horizontal bar has overflow-x-auto in addition to flex and flex-row (two items)', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'tabs',
          props: {
            orientation: 'horizontal',
            items: [
              { label: 'Tab A', children: [] },
              { label: 'Tab B', children: [] },
            ],
          },
        },
      ],
    }

    const { container } = renderRuntimePage(page)
    const bar = container.querySelector('[data-layout-node="tabs-bar"]')
    expect(bar).toBeInTheDocument()
    expect(bar).toHaveClass('overflow-x-auto')
    expect(bar).toHaveClass('flex')
    expect(bar).toHaveClass('flex-row')
  })

  it('horizontal buttons have shrink-0 and whitespace-nowrap classes (active and inactive)', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'tabs',
          props: {
            orientation: 'horizontal',
            items: [
              { label: 'Tab A', children: [] },
              { label: 'Tab B', children: [] },
            ],
          },
        },
      ],
    }

    renderRuntimePage(page)

    const buttons = screen.getAllByRole('button')
    for (const btn of buttons) {
      expect(btn).toHaveClass('shrink-0')
      expect(btn).toHaveClass('whitespace-nowrap')
    }
  })

  it('horizontal bar has overflow-x-auto with a single item', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'tabs',
          props: {
            orientation: 'horizontal',
            items: [
              { label: 'Only Tab', children: [] },
            ],
          },
        },
      ],
    }

    const { container } = renderRuntimePage(page)
    const bar = container.querySelector('[data-layout-node="tabs-bar"]')
    expect(bar).toHaveClass('overflow-x-auto')
  })

  it('hidden tabs do not appear as buttons; all rendered buttons have horizontal sizing classes', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'tabs',
          props: {
            orientation: 'horizontal',
            items: [
              { label: 'Visible', children: [] },
              {
                label: 'Hidden',
                visibility: { reference: 'queries.q.data.show', operator: 'isTruthy' },
                children: [],
              },
            ],
          },
        },
      ],
    }

    const state = createRuntimePageState(page, buildQueryState('q', { show: false }))
    renderRuntimePageWithState(page, state)

    expect(screen.queryByRole('button', { name: 'Hidden' })).not.toBeInTheDocument()

    const buttons = screen.getAllByRole('button')
    for (const btn of buttons) {
      expect(btn).toHaveClass('shrink-0')
      expect(btn).toHaveClass('whitespace-nowrap')
    }
  })

  it('vertical bar does not have overflow-x-auto; horizontal bar does not have w-48 or shrink-0 (exclusive classes)', () => {
    const verticalPage: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'tabs',
          props: {
            orientation: 'vertical',
            items: [
              { label: 'Tab A', children: [] },
              { label: 'Tab B', children: [] },
            ],
          },
        },
      ],
    }

    const { container: vertContainer, unmount } = renderRuntimePage(verticalPage)
    const vertBar = vertContainer.querySelector('[data-layout-node="tabs-bar"]')
    expect(vertBar).not.toHaveClass('overflow-x-auto')

    const vertButtons = vertContainer.querySelectorAll('[data-layout-node="tabs-bar"] button')
    for (const btn of Array.from(vertButtons)) {
      expect(btn).not.toHaveClass('whitespace-nowrap')
    }

    unmount()

    const horizontalPage: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'tabs',
          props: {
            orientation: 'horizontal',
            items: [
              { label: 'Tab A', children: [] },
              { label: 'Tab B', children: [] },
            ],
          },
        },
      ],
    }

    const { container: horizContainer } = renderRuntimePage(horizontalPage)
    const horizBar = horizContainer.querySelector('[data-layout-node="tabs-bar"]')
    expect(horizBar).not.toHaveClass('w-48')
    // shrink-0 is used in horizontal buttons (not bar), so we only check the bar here
    expect(horizBar).not.toHaveClass('text-left')
    expect(horizBar).not.toHaveClass('whitespace-normal')
    expect(horizBar).not.toHaveClass('break-words')

    const horizButtons = horizContainer.querySelectorAll('[data-layout-node="tabs-bar"] button')
    for (const btn of Array.from(horizButtons)) {
      expect(btn).not.toHaveClass('text-left')
      expect(btn).not.toHaveClass('whitespace-normal')
      expect(btn).not.toHaveClass('break-words')
    }
  })

  it('sanity: clicking second tab in horizontal orientation still switches the active panel', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'tabs',
          props: {
            orientation: 'horizontal',
            items: [
              { label: 'Tab A', children: [{ type: 'paragraph', props: { text: 'Content A' } }] },
              { label: 'Tab B', children: [{ type: 'paragraph', props: { text: 'Content B' } }] },
            ],
          },
        },
      ],
    }

    renderRuntimePage(page)

    expect(screen.getByText('Content A')).toBeInTheDocument()
    expect(screen.queryByText('Content B')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Tab B' }))

    expect(screen.queryByText('Content A')).not.toBeInTheDocument()
    expect(screen.getByText('Content B')).toBeInTheDocument()
  })
})

describe('TabsNode — T6 semantic tokens and centralized styling', () => {
  it('active horizontal tab button has text-primary-700, font-semibold, transition-colors and three-sided border with border-app-border-soft (D10 D6 D8)', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'tabs',
          props: {
            orientation: 'horizontal',
            items: [
              { label: 'Active Tab', children: [] },
              { label: 'Inactive Tab', children: [] },
            ],
          },
        },
      ],
    }

    renderRuntimePage(page)

    const activeBtn = screen.getByRole('button', { name: 'Active Tab' })
    expect(activeBtn).not.toHaveClass('border-primary-600')
    expect(activeBtn).toHaveClass('text-primary-700')
    expect(activeBtn).toHaveClass('font-semibold')
    expect(activeBtn).toHaveClass('transition-colors')
    expect(activeBtn).toHaveClass('border-t')
    expect(activeBtn).toHaveClass('border-l')
    expect(activeBtn).toHaveClass('border-r')
    expect(activeBtn.className).not.toMatch(/blue-/)
  })

  it('inactive horizontal tab button has text-app-text-muted and font-medium (D10 D6)', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'tabs',
          props: {
            orientation: 'horizontal',
            items: [
              { label: 'Active Tab', children: [] },
              { label: 'Inactive Tab', children: [] },
            ],
          },
        },
      ],
    }

    renderRuntimePage(page)

    const inactiveBtn = screen.getByRole('button', { name: 'Inactive Tab' })
    expect(inactiveBtn).toHaveClass('text-app-text-muted')
    expect(inactiveBtn).toHaveClass('font-medium')
    expect(inactiveBtn.className).not.toMatch(/gray-/)
  })

  it('tab buttons use px-3 and py-1.5 padding without responsive inversion (D7)', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'tabs',
          props: {
            orientation: 'horizontal',
            items: [
              { label: 'Tab A', children: [] },
              { label: 'Tab B', children: [] },
            ],
          },
        },
      ],
    }

    renderRuntimePage(page)

    const buttons = screen.getAllByRole('button')
    for (const btn of buttons) {
      expect(btn).toHaveClass('px-3')
      expect(btn).toHaveClass('py-1.5')
      expect(btn.className).not.toContain('px-4')
      expect(btn.className).not.toContain('py-2 ')
    }
  })

  it('tabs node maintains data-layout-node attributes after centralized styling migration', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'tabs',
          props: {
            items: [{ label: 'Tab A', children: [] }],
          },
        },
      ],
    }

    const { container } = renderRuntimePage(page)
    expect(container.querySelector('[data-layout-node="tabs"]')).toBeInTheDocument()
    expect(container.querySelector('[data-layout-node="tabs-bar"]')).toBeInTheDocument()
    expect(container.querySelector('[data-layout-node="tabs-panel"]')).toBeInTheDocument()
  })
})
