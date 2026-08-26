import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
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

describe('SkeletonNode — variant rect (default)', () => {
  it('renders a single [data-layout-node="skeleton"] element with bg-neutral-200, h-4, block and animate-pulse when no props', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [{ type: 'skeleton' }],
    }
    const { container } = renderRuntimePage(page)
    const skeleton = container.querySelector('[data-layout-node="skeleton"]')
    expect(skeleton).toBeInTheDocument()
    expect(skeleton).toHaveClass('bg-neutral-200')
    expect(skeleton).toHaveClass('h-4')
    expect(skeleton).toHaveClass('block')
    expect(skeleton).toHaveClass('animate-pulse')
    expect(skeleton).not.toHaveClass('rounded')
    expect(skeleton).not.toHaveClass('rounded-full')
  })

  it('renders rect with w-32, h-8, rounded and bg-neutral-200 when width, height and rounded are set', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [{ type: 'skeleton', props: { variant: 'rect', width: '32', height: '8', rounded: true } }],
    }
    const { container } = renderRuntimePage(page)
    const skeleton = container.querySelector('[data-layout-node="skeleton"]')
    expect(skeleton).toBeInTheDocument()
    expect(skeleton).toHaveClass('w-32')
    expect(skeleton).toHaveClass('h-8')
    expect(skeleton).toHaveClass('rounded')
    expect(skeleton).toHaveClass('bg-neutral-200')
  })

  it('does not add animate-pulse to rect when animate: false', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [{ type: 'skeleton', props: { variant: 'rect', animate: false } }],
    }
    const { container } = renderRuntimePage(page)
    const skeleton = container.querySelector('[data-layout-node="skeleton"]')
    expect(skeleton).toBeInTheDocument()
    expect(skeleton).not.toHaveClass('animate-pulse')
  })

  it('renders a single element for rect even when lines prop is set (lines is ignored in rect)', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [{ type: 'skeleton', props: { variant: 'rect', lines: 3 } }],
    }
    const { container } = renderRuntimePage(page)
    const skeletons = container.querySelectorAll('[data-layout-node="skeleton"]')
    expect(skeletons).toHaveLength(1)
    expect(skeletons[0].children).toHaveLength(0)
  })

  it('does not add rounded-full or space-y-2 to rect with width and height', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [{ type: 'skeleton', props: { variant: 'rect', width: '32', height: '8' } }],
    }
    const { container } = renderRuntimePage(page)
    const skeleton = container.querySelector('[data-layout-node="skeleton"]')
    expect(skeleton).toBeInTheDocument()
    expect(skeleton).not.toHaveClass('rounded-full')
    expect(skeleton).not.toHaveClass('space-y-2')
  })
})

describe('SkeletonNode — variant text', () => {
  it('renders wrapper with flex, flex-col, gap-2 and animate-pulse containing 3 children with bg-neutral-200, h-3 and w-full when lines: 3', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [{ type: 'skeleton', props: { variant: 'text', lines: 3 } }],
    }
    const { container } = renderRuntimePage(page)
    const wrapper = container.querySelector('[data-layout-node="skeleton"]')
    expect(wrapper).toBeInTheDocument()
    expect(wrapper).toHaveClass('flex')
    expect(wrapper).toHaveClass('flex-col')
    expect(wrapper).toHaveClass('gap-2')
    expect(wrapper).toHaveClass('animate-pulse')
    const children = Array.from(wrapper!.children)
    expect(children).toHaveLength(3)
    for (const child of children) {
      expect(child).toHaveClass('bg-neutral-200')
      expect(child).toHaveClass('h-3')
      expect(child).toHaveClass('w-full')
    }
  })

  it('renders exactly 1 child when no lines prop is set (default lines: 1)', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [{ type: 'skeleton', props: { variant: 'text' } }],
    }
    const { container } = renderRuntimePage(page)
    const wrapper = container.querySelector('[data-layout-node="skeleton"]')
    expect(wrapper).toBeInTheDocument()
    expect(wrapper!.children).toHaveLength(1)
  })

  it('renders 2 children with w-1/2 and rounded, without w-full, when lines: 2, width: "1/2", rounded: true', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [{ type: 'skeleton', props: { variant: 'text', lines: 2, width: '1/2', rounded: true } }],
    }
    const { container } = renderRuntimePage(page)
    const wrapper = container.querySelector('[data-layout-node="skeleton"]')
    expect(wrapper).toBeInTheDocument()
    const children = Array.from(wrapper!.children)
    expect(children).toHaveLength(2)
    for (const child of children) {
      expect(child).toHaveClass('w-1/2')
      expect(child).toHaveClass('rounded')
      expect(child).not.toHaveClass('w-full')
    }
  })

  it('does not add animate-pulse to text wrapper when animate: false', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [{ type: 'skeleton', props: { variant: 'text', animate: false } }],
    }
    const { container } = renderRuntimePage(page)
    const wrapper = container.querySelector('[data-layout-node="skeleton"]')
    expect(wrapper).toBeInTheDocument()
    expect(wrapper).not.toHaveClass('animate-pulse')
  })
})

describe('SkeletonNode — variant circle', () => {
  it('renders a single element with w-12, h-12, rounded-full, bg-neutral-200 and animate-pulse when no width', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [{ type: 'skeleton', props: { variant: 'circle' } }],
    }
    const { container } = renderRuntimePage(page)
    const skeleton = container.querySelector('[data-layout-node="skeleton"]')
    expect(skeleton).toBeInTheDocument()
    expect(skeleton).toHaveClass('w-12')
    expect(skeleton).toHaveClass('h-12')
    expect(skeleton).toHaveClass('rounded-full')
    expect(skeleton).toHaveClass('bg-neutral-200')
    expect(skeleton).toHaveClass('animate-pulse')
  })

  it('renders circle with w-20 and h-20 when width: "20"', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [{ type: 'skeleton', props: { variant: 'circle', width: '20' } }],
    }
    const { container } = renderRuntimePage(page)
    const skeleton = container.querySelector('[data-layout-node="skeleton"]')
    expect(skeleton).toBeInTheDocument()
    expect(skeleton).toHaveClass('w-20')
    expect(skeleton).toHaveClass('h-20')
    expect(skeleton).toHaveClass('rounded-full')
  })

  it('ignores height and rounded props in circle variant: has rounded-full but not h-4 nor extra rounded', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [{ type: 'skeleton', props: { variant: 'circle', height: '4', rounded: true } }],
    }
    const { container } = renderRuntimePage(page)
    const skeleton = container.querySelector('[data-layout-node="skeleton"]')
    expect(skeleton).toBeInTheDocument()
    expect(skeleton).toHaveClass('rounded-full')
    expect(skeleton).not.toHaveClass('h-4')
    // rounded should not be added alongside rounded-full
    // classList should not contain 'rounded' as a standalone class
    expect(Array.from(skeleton!.classList)).not.toContain('rounded')
  })

  it('does not add animate-pulse to circle when animate: false', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [{ type: 'skeleton', props: { variant: 'circle', animate: false } }],
    }
    const { container } = renderRuntimePage(page)
    const skeleton = container.querySelector('[data-layout-node="skeleton"]')
    expect(skeleton).toBeInTheDocument()
    expect(skeleton).not.toHaveClass('animate-pulse')
  })
})

describe('SkeletonNode — transversal features (via LayoutNodeRenderer)', () => {
  it('hides the skeleton when visibility evaluates to hidden', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'skeleton',
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
    const skeleton = container.querySelector('[data-layout-node="skeleton"]')
    expect(skeleton).not.toBeInTheDocument()
  })

  it('shows the skeleton when visibility evaluates to visible', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'skeleton',
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
    const skeleton = container.querySelector('[data-layout-node="skeleton"]')
    expect(skeleton).toBeInTheDocument()
  })

  it('wraps skeleton in col-span-6 wrapper when layout.span: 6 inside a container with columns: 12', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'container',
          props: { columns: 12 },
          children: [
            {
              type: 'skeleton',
              layout: { span: 6 },
            },
          ],
        },
      ],
    }
    const { container } = renderRuntimePage(page)
    const spanWrapper = container.querySelector('.col-span-6')
    expect(spanWrapper).toBeInTheDocument()
    expect(spanWrapper!.querySelector('[data-layout-node="skeleton"]')).toBeInTheDocument()
  })

  it('renders skeleton twice when inside a repeater template with 2 items', () => {
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
            template: [{ type: 'skeleton' }],
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
    const skeletons = container.querySelectorAll('[data-layout-node="skeleton"]')
    expect(skeletons).toHaveLength(2)
  })
})

describe('SkeletonNode — queryStateFeedback primary use case', () => {
  it('shows skeleton with 2 line children wrapped in role="status" when query is loading and fallback has text variant with lines: 2', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'heading',
          props: { text: 'Title', level: 1 },
          queryStateFeedback: {
            query: 'q',
            states: {
              loading: {
                mode: 'fallback',
                fallback: [
                  { type: 'skeleton', props: { variant: 'text', lines: 2 } },
                ],
              },
            },
          },
        },
      ],
    }
    const state = createRuntimePageState(page, {
      q: {
        status: 'loading',
        data: null,
        requestedAt: Date.now(),
        resolvedAt: 0,
        error: null,
      },
    })
    const { container } = renderRuntimePageWithState(page, state)
    const statusWrapper = container.querySelector('[role="status"]')
    expect(statusWrapper).toBeInTheDocument()
    const skeleton = statusWrapper!.querySelector('[data-layout-node="skeleton"]')
    expect(skeleton).toBeInTheDocument()
    expect(skeleton!.children).toHaveLength(2)
  })
})

describe('SkeletonNode — form integration', () => {
  it('skeleton as child of a form renders [data-layout-node="skeleton"] in the DOM without error', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'form',
          id: 'test-form',
          children: [
            { type: 'skeleton' },
          ],
        },
      ],
    }
    const { container } = renderRuntimePage(page)
    expect(container.querySelector('[data-layout-node="skeleton"]')).toBeInTheDocument()
  })

  it('skeleton inside form does not produce any field in state.forms[formId]', () => {
    const formId = 'test-form'
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'form',
          id: formId,
          children: [
            { type: 'skeleton' },
          ],
        },
      ],
    }
    const config: RuntimeConfig = {
      api: {},
      initialPage: page.id,
      pages: [page],
    }
    const state = createRuntimeState(config)
    expect(Object.keys(state.forms[formId] ?? {})).toHaveLength(0)
  })
})
