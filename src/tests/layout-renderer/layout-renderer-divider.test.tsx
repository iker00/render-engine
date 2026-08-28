import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { vi } from 'vitest'
import type { RuntimeConfig, RuntimePageConfig } from '../../config/runtime-config'
import { RuntimePage } from '../../runtime/runtime-page'
import { RuntimeStateContext } from '../../runtime/runtime-state/runtime-state-context'
import { createRuntimeState } from '../../runtime/runtime-state/runtime-state-reducer'
import type { RuntimeState, RuntimeStateAction } from '../../runtime/runtime-state/runtime-state-types'
import { RuntimeStateProvider } from '../../runtime/runtime-state/runtime-state-provider'

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
): RuntimeState {
  const config: RuntimeConfig = {
    api: {},
    initialPage: activePage.id,
    pages: [activePage],
  }
  const baseState = createRuntimeState(config)
  return { ...baseState, queries }
}

describe('DividerNode — data-layout-node and variants', () => {
  it('renders a divider without props.variant with data-layout-node="divider"', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [{ type: 'divider' }],
    }
    const { container } = renderRuntimePage(page)
    const divider = container.querySelector('[data-layout-node="divider"]')
    expect(divider).toBeInTheDocument()
  })

  it('renders a divider with variant: "solid" with border-t class and without border-dashed or border-dotted', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [{ type: 'divider', props: { variant: 'solid' } }],
    }
    const { container } = renderRuntimePage(page)
    const divider = container.querySelector('[data-layout-node="divider"]')
    expect(divider).toBeInTheDocument()
    expect(divider).toHaveClass('border-t')
    expect(divider).not.toHaveClass('border-dashed')
    expect(divider).not.toHaveClass('border-dotted')
  })

  it('renders a divider with variant: "dashed" with border-dashed class', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [{ type: 'divider', props: { variant: 'dashed' } }],
    }
    const { container } = renderRuntimePage(page)
    const divider = container.querySelector('[data-layout-node="divider"]')
    expect(divider).toBeInTheDocument()
    expect(divider).toHaveClass('border-dashed')
  })

  it('renders a divider with variant: "dotted" with border-dotted class', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [{ type: 'divider', props: { variant: 'dotted' } }],
    }
    const { container } = renderRuntimePage(page)
    const divider = container.querySelector('[data-layout-node="divider"]')
    expect(divider).toBeInTheDocument()
    expect(divider).toHaveClass('border-dotted')
  })

  it('renders a divider with variant: "invisible" without border-t class', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [{ type: 'divider', props: { variant: 'invisible' } }],
    }
    const { container } = renderRuntimePage(page)
    const divider = container.querySelector('[data-layout-node="divider"]')
    expect(divider).toBeInTheDocument()
    expect(divider).not.toHaveClass('border-t')
  })

  it('renders a divider with variant: "invisible" with border-0 class to suppress preflight border', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [{ type: 'divider', props: { variant: 'invisible' } }],
    }
    const { container } = renderRuntimePage(page)
    const divider = container.querySelector('[data-layout-node="divider"]')
    expect(divider).toBeInTheDocument()
    expect(divider).toHaveClass('border-0')
  })

  it('renders a divider with variant: "invisible" with block and h-0 classes preserved', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [{ type: 'divider', props: { variant: 'invisible' } }],
    }
    const { container } = renderRuntimePage(page)
    const divider = container.querySelector('[data-layout-node="divider"]')
    expect(divider).toBeInTheDocument()
    expect(divider).toHaveClass('block')
    expect(divider).toHaveClass('h-0')
  })

  it('renders a divider with variant: "solid" without border-0 class', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [{ type: 'divider', props: { variant: 'solid' } }],
    }
    const { container } = renderRuntimePage(page)
    const divider = container.querySelector('[data-layout-node="divider"]')
    expect(divider).toBeInTheDocument()
    expect(divider).not.toHaveClass('border-0')
  })

  it('renders a divider with variant: "dashed" without border-0 class', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [{ type: 'divider', props: { variant: 'dashed' } }],
    }
    const { container } = renderRuntimePage(page)
    const divider = container.querySelector('[data-layout-node="divider"]')
    expect(divider).toBeInTheDocument()
    expect(divider).not.toHaveClass('border-0')
  })

  it('renders a divider with variant: "dotted" without border-0 class', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [{ type: 'divider', props: { variant: 'dotted' } }],
    }
    const { container } = renderRuntimePage(page)
    const divider = container.querySelector('[data-layout-node="divider"]')
    expect(divider).toBeInTheDocument()
    expect(divider).not.toHaveClass('border-0')
  })
})

describe('DividerNode — transversal features (via LayoutNodeRenderer)', () => {
  it('shows the divider when visibility evaluates to true', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'divider',
          visibility: {
            reference: 'queries.q.data.show',
            operator: 'isTruthy',
          },
        },
      ],
    }
    const state = createRuntimePageState(page, {
      q: {
        status: 'success',
        data: { show: true },
        requestedAt: 0,
        resolvedAt: 0,
        error: null,
      },
    })
    const { container } = renderRuntimePageWithState(page, state)
    const divider = container.querySelector('[data-layout-node="divider"]')
    expect(divider).toBeInTheDocument()
  })

  it('hides the divider when visibility evaluates to false', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'divider',
          visibility: {
            reference: 'queries.q.data.show',
            operator: 'isTruthy',
          },
        },
      ],
    }
    const state = createRuntimePageState(page, {
      q: {
        status: 'success',
        data: { show: false },
        requestedAt: 0,
        resolvedAt: 0,
        error: null,
      },
    })
    const { container } = renderRuntimePageWithState(page, state)
    const divider = container.querySelector('[data-layout-node="divider"]')
    expect(divider).not.toBeInTheDocument()
  })

  it('wraps divider in col-span wrapper when layout.span is set inside a container with columns', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'container',
          props: { columns: 12 },
          children: [
            {
              type: 'divider',
              layout: { span: 6 },
            },
          ],
        },
      ],
    }
    const { container } = renderRuntimePage(page)
    const spanWrapper = container.querySelector('.col-span-6')
    expect(spanWrapper).toBeInTheDocument()
    expect(spanWrapper!.querySelector('[data-layout-node="divider"]')).toBeInTheDocument()
  })

  it('renders a divider once per item when inside a repeater template', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'repeater',
          props: {
            items: {
              source: 'queries.items.data.results',
              key: 'id',
            },
            template: [
              {
                type: 'divider',
              },
            ],
          },
        },
      ],
    }
    const state = createRuntimePageState(page, {
      items: {
        status: 'success',
        data: {
          results: [
            { id: 'item-1' },
            { id: 'item-2' },
          ],
        },
        requestedAt: 0,
        resolvedAt: 0,
        error: null,
      },
    })
    const { container } = renderRuntimePageWithState(page, state)
    const dividers = container.querySelectorAll('[data-layout-node="divider"]')
    expect(dividers).toHaveLength(2)
  })

  it('does not render declared children in the divider output', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'divider',
          // children is `never` in the type but the test exercises the runtime contract
        } as RuntimePageConfig['layout'][number],
      ],
    }
    const { container } = renderRuntimePage(page)
    const divider = container.querySelector('[data-layout-node="divider"]')
    expect(divider).toBeInTheDocument()
    // The divider element itself should not contain any rendered child nodes
    expect(divider!.childElementCount).toBe(0)
  })
})
