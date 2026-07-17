import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { LayoutNode, RuntimeConfig } from '../../config/runtime-config'
import { LayoutRenderer } from '../../runtime/layout-renderer'
import {
  LayoutEditModeProvider,
  type LayoutEditModeContextValue,
} from '../../runtime/layout-edit-mode-context'
import {
  getNodeAtPath,
  serializeLayoutNodePath,
  type LayoutNodePath,
} from '../../runtime/layout-node-path'
import { RuntimeStateProvider } from '../../runtime/runtime-state/runtime-state-provider'
import { RuntimeStateContext } from '../../runtime/runtime-state/runtime-state-context'
import { createRuntimeState } from '../../runtime/runtime-state/runtime-state-reducer'

function buildConfig(): RuntimeConfig {
  return {
    api: {},
    initialPage: 'home',
    pages: [{ id: 'home', layout: [] }],
  }
}

function renderNodes(
  nodes: LayoutNode[],
  options?: { editMode?: Partial<LayoutEditModeContextValue>; dataValues?: Record<string, unknown> },
) {
  const onSelectNode = vi.fn<(path: LayoutNodePath) => void>()
  const onHoverNode = vi.fn<(path: LayoutNodePath | null) => void>()

  const content = options?.editMode ? (
    <LayoutEditModeProvider
      value={{
        selectedPath: null,
        hoveredPath: null,
        onSelectNode,
        onHoverNode,
        ...options.editMode,
      }}
    >
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

describe('getNodeAtPath', () => {
  const tree: LayoutNode[] = [
    {
      type: 'container',
      props: {},
      children: [
        {
          type: 'form',
          id: 'form-1',
          children: [{ type: 'input', props: { fieldId: 'name', label: 'Name' } }],
        },
      ],
    },
  ]

  it('resolves the node at a full children path', () => {
    const path: LayoutNodePath = [
      { field: 'children', index: 0 },
      { field: 'children', index: 0 },
      { field: 'children', index: 0 },
    ]

    const node = getNodeAtPath(tree, path)

    expect(node).not.toBeNull()
    expect(node?.type).toBe('input')
  })

  it('returns null when an index is out of range', () => {
    const path: LayoutNodePath = [{ field: 'children', index: 5 }]

    expect(getNodeAtPath(tree, path)).toBeNull()
  })

  it('returns null for a template step on a node that is not a repeater', () => {
    const path: LayoutNodePath = [{ field: 'children', index: 0 }, { field: 'template', index: 0 }]

    expect(getNodeAtPath(tree, path)).toBeNull()
  })

  const tabsTree: LayoutNode[] = [
    {
      type: 'tabs',
      props: {
        items: [
          { label: 'Tab A', children: [{ type: 'heading', props: { text: 'A', level: 2 } }] },
          {
            label: 'Tab B',
            children: [
              { type: 'paragraph', props: { text: 'first' } },
              { type: 'paragraph', props: { text: 'second' } },
            ],
          },
        ],
      },
    },
  ]

  it('resolves the node at a path ending in a tabItem step', () => {
    const path: LayoutNodePath = [
      { field: 'children', index: 0 },
      { field: 'tabItem', itemIndex: 1, index: 0 },
    ]

    const node = getNodeAtPath(tabsTree, path)

    expect(node).not.toBeNull()
    expect(node?.type).toBe('paragraph')
    expect(node && 'props' in node && (node.props as { text?: string }).text).toBe('first')
  })

  it('returns null for a tabItem step on a node that is not tabs', () => {
    const path: LayoutNodePath = [
      { field: 'children', index: 0 },
      { field: 'tabItem', itemIndex: 0, index: 0 },
    ]

    expect(getNodeAtPath(tree, path)).toBeNull()
  })

  it('returns null when itemIndex is out of range', () => {
    const path: LayoutNodePath = [
      { field: 'children', index: 0 },
      { field: 'tabItem', itemIndex: 5, index: 0 },
    ]

    expect(getNodeAtPath(tabsTree, path)).toBeNull()
  })

  it('returns null when index within the tab item is out of range', () => {
    const path: LayoutNodePath = [
      { field: 'children', index: 0 },
      { field: 'tabItem', itemIndex: 0, index: 5 },
    ]

    expect(getNodeAtPath(tabsTree, path)).toBeNull()
  })
})

describe('serializeLayoutNodePath', () => {
  it('produces stable and distinct strings for different paths', () => {
    const empty = serializeLayoutNodePath([])
    const withTemplate = serializeLayoutNodePath([
      { field: 'children', index: 0 },
      { field: 'template', index: 1 },
    ])
    const withTabItem = serializeLayoutNodePath([
      { field: 'children', index: 0 },
      { field: 'tabItem', itemIndex: 1, index: 0 },
    ])

    expect(empty).toBe('')
    expect(withTemplate).toBe('children.0.template.1')
    expect(withTabItem).toBe('children.0.tabItem.1.0')

    const values = new Set([empty, withTemplate, withTabItem])
    expect(values.size).toBe(3)
  })
})

function StatefulEditModeHarness({ nodes }: { nodes: LayoutNode[] }) {
  const [selectedPath, setSelectedPath] = useState<LayoutNodePath | null>(null)
  const [hoveredPath, setHoveredPath] = useState<LayoutNodePath | null>(null)

  return (
    <RuntimeStateProvider config={buildConfig()}>
      <LayoutEditModeProvider
        value={{
          selectedPath,
          hoveredPath,
          onSelectNode: setSelectedPath,
          onHoverNode: setHoveredPath,
        }}
      >
        <LayoutRenderer nodes={nodes} />
      </LayoutEditModeProvider>
    </RuntimeStateProvider>
  )
}

describe('LayoutRenderer path threading', () => {
  const nodes: LayoutNode[] = [
    { type: 'heading', props: { text: 'First', level: 1 } },
    { type: 'heading', props: { text: 'Second', level: 1 } },
  ]

  const compoundTree: LayoutNode[] = [
    {
      type: 'container',
      props: {},
      children: [
        {
          type: 'form',
          id: 'compound-form',
          children: [{ type: 'heading', props: { text: 'Nested heading', level: 2 } }],
        },
      ],
    },
  ]

  const compoundContainerPath: LayoutNodePath = [{ field: 'children', index: 0 }]
  const compoundFormPath: LayoutNodePath = [
    { field: 'children', index: 0 },
    { field: 'children', index: 0 },
  ]
  const compoundHeadingPath: LayoutNodePath = [
    { field: 'children', index: 0 },
    { field: 'children', index: 0 },
    { field: 'children', index: 0 },
  ]

  it('builds each child path with the default {field: "children", index} step', () => {
    renderNodes(nodes, { editMode: {} })

    expect(screen.getByText('First').closest('[data-node-path]')).toHaveAttribute(
      'data-node-path',
      'children.0',
    )
    expect(screen.getByText('Second').closest('[data-node-path]')).toHaveAttribute(
      'data-node-path',
      'children.1',
    )
  })

  it('uses a custom buildChildPath to compute the path of each child', () => {
    const onSelectNode = vi.fn<(path: LayoutNodePath) => void>()
    const onHoverNode = vi.fn<(path: LayoutNodePath | null) => void>()

    render(
      <RuntimeStateProvider config={buildConfig()}>
        <LayoutEditModeProvider
          value={{ selectedPath: null, hoveredPath: null, onSelectNode, onHoverNode }}
        >
          <LayoutRenderer
            nodes={nodes}
            path={[]}
            buildChildPath={(index) => [{ field: 'template', index }]}
          />
        </LayoutEditModeProvider>
      </RuntimeStateProvider>,
    )

    expect(screen.getByText('First').closest('[data-node-path]')).toHaveAttribute(
      'data-node-path',
      'template.0',
    )
    expect(screen.getByText('Second').closest('[data-node-path]')).toHaveAttribute(
      'data-node-path',
      'template.1',
    )
  })

  it('accumulates the real path across three levels of container > form > heading recursion', () => {
    const expectedSerialized = serializeLayoutNodePath(compoundHeadingPath)

    // Sanity check: the expected path really does resolve to the heading node.
    expect(getNodeAtPath(compoundTree, compoundHeadingPath)?.type).toBe('heading')

    const { onSelectNode } = renderNodes(compoundTree, { editMode: {} })

    const headingText = screen.getByText('Nested heading')
    const wrapper = headingText.closest('[data-node-path]')

    expect(wrapper).toHaveAttribute('data-node-path', expectedSerialized)
    expect(expectedSerialized.split('.').filter((segment) => segment === 'children').length).toBe(3)

    fireEvent.click(headingText)

    // The click bubbles through the (intentionally non-stopPropagation) ancestor wrappers
    // (form, then container) too, but the heading's own wrapper — the actual click target —
    // fires first, and it carries the heading's exact 3-level path, not a collapsed one.
    expect(onSelectNode).toHaveBeenCalled()
    expect(onSelectNode.mock.calls[0][0]).toEqual(compoundHeadingPath)
  })

  it('invokes onSelectNode exactly once for a click on a deeply nested node, even though the click bubbles through two more selectable ancestor wrappers', () => {
    // This is the precise guarantee the "first handler wins" marking mechanism provides:
    // only the innermost wrapper under the pointer (the heading's own) is allowed to call
    // onSelectNode; the form and container wrappers above it see the click too (bubbling,
    // no stopPropagation) but must no-op because the native event is already marked.
    const { onSelectNode } = renderNodes(compoundTree, { editMode: {} })

    fireEvent.click(screen.getByText('Nested heading'))

    expect(onSelectNode).toHaveBeenCalledTimes(1)
    expect(onSelectNode).toHaveBeenCalledWith(compoundHeadingPath)
  })

  it('leaves the FINAL selection state pointing at the clicked node, not at an outer ancestor, after a real click applies onSelectNode to React state (container > form > heading)', () => {
    // Reproduces the bug end-to-end: onSelectNode here is wired to setState, exactly like
    // the real dev-editor canvas wires LayoutEditModeProvider. Before the fix, the outermost
    // ancestor wrapper (container) ran its onSelectNode call LAST during bubbling, so it won
    // the state race and the final selection was the container/form, never the heading.
    const { container } = render(<StatefulEditModeHarness nodes={compoundTree} />)

    fireEvent.click(screen.getByText('Nested heading'))

    const headingWrapper = container.querySelector(
      `[data-node-path="${serializeLayoutNodePath(compoundHeadingPath)}"]`,
    )
    const formWrapper = container.querySelector(
      `[data-node-path="${serializeLayoutNodePath(compoundFormPath)}"]`,
    )
    const containerWrapper = container.querySelector(
      `[data-node-path="${serializeLayoutNodePath(compoundContainerPath)}"]`,
    )

    expect(headingWrapper?.className).toContain('outline-blue-500')
    expect(formWrapper?.className ?? '').not.toContain('outline-blue-500')
    expect(containerWrapper?.className ?? '').not.toContain('outline-blue-500')
  })

  it('leaves the FINAL hovered state pointing at the innermost node under the pointer, not at an outer ancestor, after mouseEnter on a nested node (container > form > heading)', () => {
    const { container } = render(<StatefulEditModeHarness nodes={compoundTree} />)

    const headingWrapper = container.querySelector(
      `[data-node-path="${serializeLayoutNodePath(compoundHeadingPath)}"]`,
    ) as HTMLElement

    fireEvent.mouseEnter(headingWrapper)

    const formWrapper = container.querySelector(
      `[data-node-path="${serializeLayoutNodePath(compoundFormPath)}"]`,
    )
    const containerWrapper = container.querySelector(
      `[data-node-path="${serializeLayoutNodePath(compoundContainerPath)}"]`,
    )

    expect(headingWrapper.className).toContain('outline-blue-300')
    expect(formWrapper?.className ?? '').not.toContain('outline-blue-300')
    expect(containerWrapper?.className ?? '').not.toContain('outline-blue-300')
  })
})

describe('LayoutNodeRenderer edit mode wrapper', () => {
  const representativeTree: LayoutNode[] = [
    {
      type: 'container',
      props: { direction: 'row', gap: 'sm' },
      children: [{ type: 'heading', props: { text: 'Title', level: 1 } }],
    },
    {
      type: 'form',
      id: 'form-1',
      children: [{ type: 'input', props: { fieldId: 'name', label: 'Name' } }],
    },
    {
      type: 'repeater',
      props: {
        items: { source: 'queries.posts.data.results', key: 'id' },
        template: [{ type: 'paragraph', props: { text: 'item.title' } }],
      },
    },
    { type: 'button', props: { label: 'Click me' } },
  ]

  it('produces no data-node-path attribute or edit-mode wrapper without a LayoutEditModeProvider', () => {
    const { container } = renderNodes(representativeTree, {
      dataValues: { posts: { results: [{ id: 1, title: 'One' }] } },
    })

    expect(container.querySelectorAll('[data-node-path]')).toHaveLength(0)
    expect(screen.getByText('Title')).toBeInTheDocument()
    expect(screen.getByText('Click me')).toBeInTheDocument()
    expect(screen.getByText('One')).toBeInTheDocument()
  })

  it('exposes data-node-path on every top-level node when a provider is present with no selection', () => {
    const { container } = renderNodes(representativeTree, {
      editMode: {},
      dataValues: { posts: { results: [{ id: 1, title: 'One' }] } },
    })

    const containerWrapper = container.querySelector('[data-node-path="children.0"]')
    const formWrapper = container.querySelector('[data-node-path="children.1"]')
    const repeaterWrapper = container.querySelector('[data-node-path="children.2"]')
    const buttonWrapper = container.querySelector('[data-node-path="children.3"]')

    expect(containerWrapper?.textContent).toContain('Title')
    expect(formWrapper?.textContent).toContain('Name')
    expect(repeaterWrapper?.textContent).toContain('One')
    expect(buttonWrapper?.textContent).toContain('Click me')
  })

  it('invokes onSelectNode with the exact path of the clicked node', () => {
    // The button is a standalone top-level node (no wrapped ancestor above it in this
    // tree), so clicking it only bubbles through its own wrapper.
    const { onSelectNode } = renderNodes(representativeTree, { editMode: {} })

    fireEvent.click(screen.getByText('Click me'))

    expect(onSelectNode).toHaveBeenCalledTimes(1)
    expect(onSelectNode).toHaveBeenCalledWith([{ field: 'children', index: 3 }])
  })

  it('invokes onHoverNode(path) on mouseEnter and onHoverNode(null) on mouseLeave without touching selection', () => {
    const { onHoverNode, onSelectNode } = renderNodes(representativeTree, { editMode: {} })

    const buttonWrapper = screen.getByText('Click me').closest('[data-node-path]') as HTMLElement

    fireEvent.mouseEnter(buttonWrapper)
    expect(onHoverNode).toHaveBeenLastCalledWith([{ field: 'children', index: 3 }])

    fireEvent.mouseLeave(buttonWrapper)
    expect(onHoverNode).toHaveBeenLastCalledWith(null)

    expect(onSelectNode).not.toHaveBeenCalled()
  })

  it('applies the selection class to the selected node and the hover class to a different hovered node', () => {
    const { container } = renderNodes(representativeTree, {
      editMode: {
        selectedPath: [{ field: 'children', index: 0 }],
        hoveredPath: [{ field: 'children', index: 3 }],
      },
    })

    const selectedWrapper = container.querySelector('[data-node-path="children.0"]') as HTMLElement
    const hoveredWrapper = container.querySelector('[data-node-path="children.3"]') as HTMLElement

    expect(selectedWrapper.className).toContain('outline-blue-500')
    expect(selectedWrapper.className).not.toContain('outline-blue-300')

    expect(hoveredWrapper.className).toContain('outline-blue-300')
    expect(hoveredWrapper.className).not.toContain('outline-blue-500')
  })

  it('bubbles a click on an inner interactive control up to the nearest node wrapper without stopPropagation, without breaking the control own handler', () => {
    const treeWithAction: LayoutNode[] = [
      {
        type: 'form',
        id: 'form-with-button',
        children: [
          {
            type: 'button',
            props: { label: 'Open modal', action: { type: 'openModal', modalId: 'demo-modal' } },
          },
        ],
      },
    ]

    const onSelectNode = vi.fn<(path: LayoutNodePath) => void>()
    const onHoverNode = vi.fn<(path: LayoutNodePath | null) => void>()
    const config = buildConfig()
    const state = createRuntimeState(config)
    const dispatch = vi.fn()
    const dispatchAndSyncState = vi.fn()

    render(
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
        <LayoutEditModeProvider
          value={{ selectedPath: null, hoveredPath: null, onSelectNode, onHoverNode }}
        >
          <LayoutRenderer nodes={treeWithAction} />
        </LayoutEditModeProvider>
      </RuntimeStateContext.Provider>,
    )

    const button = screen.getByRole('button', { name: 'Open modal' })

    fireEvent.click(button)

    // The button's own onClick handler ran (dispatched the openModal action)...
    expect(dispatchAndSyncState).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'modal/open', payload: expect.objectContaining({ modalId: 'demo-modal' }) }),
    )

    // ...and the click also reached the button's own node wrapper (the nearest ancestor
    // with data-node-path) as the first call, since no stopPropagation is used anywhere
    // in the edit-mode wrapper chain — it then keeps bubbling to the form wrapper above it.
    expect(onSelectNode.mock.calls[0][0]).toEqual([
      { field: 'children', index: 0 },
      { field: 'children', index: 0 },
    ])
  })
})
