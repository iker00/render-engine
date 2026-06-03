import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RuntimeConfig, RuntimePageConfig } from '../../config/runtime-config'
import { RuntimePage } from '../../runtime/runtime-page'
import { RuntimeStateContext } from '../../runtime/runtime-state/runtime-state-context'
import { createRuntimeState } from '../../runtime/runtime-state/runtime-state-reducer'
import type { RuntimeState, RuntimeStateAction } from '../../runtime/runtime-state/runtime-state-types'
import { RuntimeStateProvider } from '../../runtime/runtime-state/runtime-state-provider'

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
