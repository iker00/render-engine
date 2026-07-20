import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { LayoutNode, RuntimeConfig } from '../../config/runtime-config'
import { LayoutRenderer } from '../../runtime/layout-renderer'
import {
  LayoutEditModeProvider,
  type LayoutEditModeContextValue,
} from '../../runtime/layout-edit-mode-context'
import { RuntimeStateProvider } from '../../runtime/runtime-state/runtime-state-provider'

function buildConfig(): RuntimeConfig {
  return {
    api: {},
    initialPage: 'home',
    pages: [{ id: 'home', layout: [] }],
  }
}

function renderNodes(
  nodes: LayoutNode[],
  options?: { editMode?: { active?: boolean }; dataValues?: Record<string, unknown> },
) {
  const onSelectNode = vi.fn()
  const onHoverNode = vi.fn()

  const editModeValue: LayoutEditModeContextValue | null = options?.editMode
    ? options.editMode.active === false
      ? { active: false }
      : { active: true, selectedPath: null, hoveredPath: null, onSelectNode, onHoverNode }
    : null

  const content = editModeValue ? (
    <LayoutEditModeProvider value={editModeValue}>
      <LayoutRenderer nodes={nodes} />
    </LayoutEditModeProvider>
  ) : (
    <LayoutRenderer nodes={nodes} />
  )

  const result = render(
    <RuntimeStateProvider config={buildConfig()} dataValues={options?.dataValues}>
      {content}
    </RuntimeStateProvider>,
  )

  return { ...result, onSelectNode, onHoverNode }
}

function buildRepeaterNode(overrides?: Partial<LayoutNode & { type: 'repeater' }>): LayoutNode {
  return {
    type: 'repeater',
    props: {
      items: { source: 'queries.posts.data.results', key: 'id' },
      template: [{ type: 'paragraph', props: { text: 'item.title' } }],
    },
    ...overrides,
  } as LayoutNode
}

const fivePosts = {
  posts: {
    results: [
      { id: 1, title: 'Post one' },
      { id: 2, title: 'Post two' },
      { id: 3, title: 'Post three' },
      { id: 4, title: 'Post four' },
      { id: 5, title: 'Post five' },
    ],
  },
}

describe('RepeaterNode without LayoutEditModeProvider (production regression)', () => {
  it('renders one iteration per item in the resolved collection', () => {
    renderNodes([buildRepeaterNode()], { dataValues: fivePosts })

    expect(screen.getByText('Post one')).toBeInTheDocument()
    expect(screen.getByText('Post two')).toBeInTheDocument()
    expect(screen.getByText('Post three')).toBeInTheDocument()
    expect(screen.getByText('Post four')).toBeInTheDocument()
    expect(screen.getByText('Post five')).toBeInTheDocument()
  })
})

describe('RepeaterNode with LayoutEditModeProvider', () => {
  it('renders exactly one instance of the template, not one per collection item', () => {
    renderNodes([buildRepeaterNode()], { editMode: {}, dataValues: fivePosts })

    expect(screen.getByText('Post one')).toBeInTheDocument()
    expect(screen.queryByText('Post two')).not.toBeInTheDocument()
    expect(screen.queryByText('Post three')).not.toBeInTheDocument()
  })

  it('renders exactly one editable instance of the template when the resolved collection is empty', () => {
    const { container } = renderNodes([buildRepeaterNode()], {
      editMode: {},
      dataValues: { posts: { results: [] } },
    })

    const wrapper = container.querySelector('[data-node-path="children.0"]')
    expect(wrapper).not.toBeNull()
    // The template still mounts (one paragraph node), even though item.title has nothing to resolve to.
    expect(container.querySelectorAll('[data-node-path]').length).toBeGreaterThan(1)
  })

  it('exposes a selectable node inside the single instance with a data-node-path containing a template segment', () => {
    const { onSelectNode } = renderNodes([buildRepeaterNode()], { editMode: {}, dataValues: fivePosts })

    const paragraph = screen.getByText('Post one')
    const wrapper = paragraph.closest('[data-node-path]')

    expect(wrapper).toHaveAttribute('data-node-path', 'children.0.template.0')

    fireEvent.click(paragraph)

    expect(onSelectNode).toHaveBeenCalledWith([
      { field: 'children', index: 0 },
      { field: 'template', index: 0 },
    ])
  })

  it('renders no pagination controls regardless of props.pagination', () => {
    const { container } = renderNodes(
      [
        buildRepeaterNode({
          props: {
            items: { source: 'queries.posts.data.results', key: 'id' },
            template: [{ type: 'paragraph', props: { text: 'item.title' } }],
            pagination: { enabled: true, pageSize: 2 },
          },
        } as never),
      ],
      { editMode: {}, dataValues: fivePosts },
    )

    expect(container.querySelector('[data-layout-node="repeater-pagination"]')).toBeNull()
    expect(container.querySelector('[data-layout-node="repeater-scroll-sentinel"]')).toBeNull()
    expect(screen.getByText('Post one')).toBeInTheDocument()
    expect(screen.queryByText('Post two')).not.toBeInTheDocument()
  })
})

// design.md feature 0103 Decisión 9: with a mounted-but-inert provider ({ active: false },
// Visual mode inside DevRuntime), the repeater must resolve the real collection into one
// iteration per item, not collapse to a single template instance — same as production.
describe('RepeaterNode with LayoutEditModeProvider ({ active: false }, Visual mode)', () => {
  it('renders one iteration per item in the resolved collection, same as production', () => {
    renderNodes([buildRepeaterNode()], { editMode: { active: false }, dataValues: fivePosts })

    expect(screen.getByText('Post one')).toBeInTheDocument()
    expect(screen.getByText('Post two')).toBeInTheDocument()
    expect(screen.getByText('Post three')).toBeInTheDocument()
    expect(screen.getByText('Post four')).toBeInTheDocument()
    expect(screen.getByText('Post five')).toBeInTheDocument()
  })
})
