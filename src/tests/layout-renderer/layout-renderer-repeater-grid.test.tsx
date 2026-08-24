import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { LayoutNode, RuntimeConfig, RuntimePageConfig } from '../../config/runtime-config'
import { RuntimePage } from '../../runtime/runtime-page'
import { RuntimeStateContext } from '../../runtime/runtime-state/runtime-state-context'
import { createRuntimeState } from '../../runtime/runtime-state/runtime-state-reducer'
import type { RuntimeState, RuntimeStateAction } from '../../runtime/runtime-state/runtime-state-types'
import { LayoutRenderer } from '../../runtime/layout-renderer'
import { LayoutEditModeProvider } from '../../runtime/layout-edit-mode-context'
import type { LayoutEditModeContextValue } from '../../runtime/layout-edit-mode-context-value'
import { RuntimeStateProvider } from '../../runtime/runtime-state/runtime-state-provider'

// Reuses the RuntimePage rendering pattern already established in layout-renderer-repeater-basic.test.tsx
// and layout-renderer-repeater-pagination.test.tsx instead of introducing a new helper module.
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

function createRuntimePageState(activePage: RuntimePageConfig, queries: RuntimeState['queries']) {
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

function buildPostsPage(repeaterProps: Record<string, unknown>): RuntimePageConfig {
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
          template: [
            {
              type: 'paragraph',
              props: {
                text: 'item.title',
              },
            },
          ],
          ...repeaterProps,
        },
      } as never,
    ] as LayoutNode[],
  }
}

function postsQueryData(count: number) {
  return {
    posts: {
      status: 'success' as const,
      data: {
        results: Array.from({ length: count }, (_, index) => ({
          id: `post-${index + 1}`,
          title: `Post ${index + 1}`,
        })),
      },
      error: null,
    },
  }
}

// Reuses the edit-mode rendering pattern already established in layout-renderer-repeater-edit-mode.test.tsx.
function renderNodesInEditMode(nodes: LayoutNode[], dataValues: Record<string, unknown>) {
  const onSelectNode = vi.fn()
  const onHoverNode = vi.fn()
  const editModeValue: LayoutEditModeContextValue = {
    active: true,
    selectedPath: null,
    hoveredPath: null,
    onSelectNode,
    onHoverNode,
  }

  const config: RuntimeConfig = {
    api: {},
    initialPage: 'home',
    pages: [{ id: 'home', layout: [] }],
  }

  return render(
    <RuntimeStateProvider config={config} dataValues={dataValues}>
      <LayoutEditModeProvider value={editModeValue}>
        <LayoutRenderer nodes={nodes} />
      </LayoutEditModeProvider>
    </RuntimeStateProvider>,
  )
}

describe('RepeaterNode grid wrapper (props.columns declared)', () => {
  it('renders visible iterations inside a single wrapper with grid-cols-3 for a fixed columns value', () => {
    const activePage = buildPostsPage({ columns: 3 })

    renderRuntimePageWithState(activePage, createRuntimePageState(activePage, postsQueryData(3)))

    const wrapper = screen.getByText('Post 1').parentElement
    expect(wrapper).toHaveClass('grid', 'w-full', 'grid-cols-3', 'gap-5')
    expect(wrapper?.children).toHaveLength(3)
    expect(screen.getByText('Post 2').parentElement).toBe(wrapper)
    expect(screen.getByText('Post 3').parentElement).toBe(wrapper)
  })

  it('applies per-breakpoint classes with base as mobile fallback for a responsive columns map', () => {
    const activePage = buildPostsPage({ columns: { base: 1, md: 2, lg: 4 } })

    renderRuntimePageWithState(activePage, createRuntimePageState(activePage, postsQueryData(2)))

    const wrapper = screen.getByText('Post 1').parentElement
    expect(wrapper).toHaveClass('grid-cols-1', 'md:grid-cols-2', 'lg:grid-cols-4')
  })

  it('translates gap/align/justify to the same classes container uses in grid mode', () => {
    const activePage = buildPostsPage({ columns: 2, gap: 'lg', align: 'center', justify: 'between' })

    renderRuntimePageWithState(activePage, createRuntimePageState(activePage, postsQueryData(2)))

    const wrapper = screen.getByText('Post 1').parentElement
    expect(wrapper).toHaveClass('grid-cols-2', 'items-center', 'justify-between', 'gap-8')
  })

  it('renders the grid wrapper without cells and without error when the resolved collection is empty', () => {
    const activePage = buildPostsPage({ columns: 3 })

    const { container } = renderRuntimePageWithState(
      activePage,
      createRuntimePageState(activePage, postsQueryData(0)),
    )

    const wrapper = container.querySelector('.grid.w-full.grid-cols-3')
    expect(wrapper).not.toBeNull()
    expect(wrapper?.children).toHaveLength(0)
  })

  it('keeps only the active page items inside the grid wrapper for previousNext pagination, recomputing on page change', () => {
    const activePage = buildPostsPage({
      columns: 2,
      pagination: { enabled: true, pageSize: 2 },
    })

    renderRuntimePageWithState(activePage, createRuntimePageState(activePage, postsQueryData(5)))

    const wrapper = screen.getByText('Post 1').parentElement
    expect(wrapper?.children).toHaveLength(2)
    expect(screen.queryByText('Post 3')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }))

    const wrapperAfter = screen.getByText('Post 3').parentElement
    expect(wrapperAfter?.children).toHaveLength(2)
    expect(screen.queryByText('Post 1')).not.toBeInTheDocument()
  })

  it('keeps only the active page items inside the grid wrapper for numbered pagination', () => {
    const activePage = buildPostsPage({
      columns: 2,
      pagination: { enabled: true, pageSize: 2, controls: { variant: 'numbered' } },
    })

    renderRuntimePageWithState(activePage, createRuntimePageState(activePage, postsQueryData(5)))

    fireEvent.click(screen.getByRole('button', { name: '3' }))

    const wrapper = screen.getByText('Post 5').parentElement
    expect(wrapper?.children).toHaveLength(1)
  })

  it('accumulates iterations inside the grid wrapper as the scroll window expands', () => {
    const activePage = buildPostsPage({
      columns: 2,
      pagination: { enabled: true, pageSize: 2, controls: { variant: 'scroll' } },
    })

    renderRuntimePageWithState(activePage, createRuntimePageState(activePage, postsQueryData(5)))

    const wrapper = screen.getByText('Post 1').parentElement
    expect(wrapper?.children).toHaveLength(2)

    fireEvent.click(screen.getByRole('button', { name: 'Mostrar más' }))

    expect(wrapper?.children).toHaveLength(4)
  })

  it('renders pagination controls as a sibling of the grid wrapper, occupying the full row of an ancestor grid', () => {
    const activePage: RuntimePageConfig = {
      id: 'posts',
      layout: [
        {
          type: 'container',
          props: { columns: 4 },
          children: [
            {
              type: 'repeater',
              props: {
                items: { source: 'queries.posts.data.results', key: 'id' },
                columns: 2,
                pagination: { enabled: true, pageSize: 2 },
                template: [{ type: 'paragraph', props: { text: 'item.title' } }],
              },
            } as never,
          ],
        },
      ],
    }

    renderRuntimePageWithState(activePage, createRuntimePageState(activePage, postsQueryData(3)))

    const wrapper = screen.getByText('Post 1').parentElement
    const controls = document.querySelector('[data-layout-node="repeater-pagination"]')

    expect(controls).not.toBeNull()
    expect(wrapper?.contains(controls)).toBe(false)
    expect(controls).toHaveClass('col-span-4')
  })
})

describe('RepeaterNode grid wrapper in edit mode', () => {
  it('wraps the single sample iteration in the grid wrapper without pagination controls', () => {
    const { container } = renderNodesInEditMode(
      [
        {
          type: 'repeater',
          props: {
            items: { source: 'queries.posts.data.results', key: 'id' },
            columns: 3,
            pagination: { enabled: true, pageSize: 2 },
            template: [{ type: 'paragraph', props: { text: 'item.title' } }],
          },
        } as never,
      ],
      { posts: { results: [{ id: 1, title: 'Post one' }, { id: 2, title: 'Post two' }] } },
    )

    // In edit mode each rendered node is wrapped in a selection wrapper (`[data-node-path]`);
    // the grid wrapper is that selection wrapper's parent.
    const selectionWrapper = screen.getByText('Post one').closest('[data-node-path]')
    const wrapper = selectionWrapper?.parentElement
    expect(wrapper).toHaveClass('grid', 'w-full', 'grid-cols-3')
    // Exactly one selectable sample iteration lives inside the wrapper (a second wrapper
    // sibling, `[data-canvas-grid-drop-zones]`, is the grid-mode drop overlay from T12/0106,
    // mounted automatically because the wrapper now provides a grid layout context).
    expect(wrapper?.querySelectorAll('[data-node-path]')).toHaveLength(1)
    expect(screen.queryByText('Post two')).not.toBeInTheDocument()
    expect(container.querySelector('[data-layout-node="repeater-pagination"]')).toBeNull()
  })
})
