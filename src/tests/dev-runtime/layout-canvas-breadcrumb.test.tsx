import { render, screen, fireEvent } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { LayoutNode, RuntimeConfig } from '../../config/runtime-config'
import { LayoutCanvasBreadcrumb } from '../../dev-runtime/layout-canvas/layout-canvas-breadcrumb'
import { LayoutEditModeProvider } from '../../runtime/layout-edit-mode-context'
import { LayoutRenderer } from '../../runtime/layout-renderer'
import type { LayoutNodePath } from '../../runtime/layout-node-path'
import { RuntimeStateProvider } from '../../runtime/runtime-state/runtime-state-provider'

function buildNestedLayout(): LayoutNode[] {
  return [
    {
      type: 'container',
      props: {},
      children: [
        {
          type: 'form',
          id: 'checkout',
          children: [{ type: 'heading', props: { text: 'Title', level: 2 } }],
        },
      ],
    },
  ]
}

const HEADING_PATH: LayoutNodePath = [
  { field: 'children', index: 0 },
  { field: 'children', index: 0 },
  { field: 'children', index: 0 },
]
const FORM_PATH: LayoutNodePath = [
  { field: 'children', index: 0 },
  { field: 'children', index: 0 },
]
const CONTAINER_PATH: LayoutNodePath = [{ field: 'children', index: 0 }]

describe('LayoutCanvasBreadcrumb rendering', () => {
  it('renders nothing when selectedPath is null', () => {
    const { container } = render(
      <LayoutCanvasBreadcrumb pageLayout={buildNestedLayout()} selectedPath={null} onSelectNode={() => {}} />,
    )

    expect(container.querySelector('[data-testid="layout-canvas-breadcrumb"]')).not.toBeInTheDocument()
  })

  it('renders exactly 3 segments in order for a heading nested in container > form', () => {
    render(
      <LayoutCanvasBreadcrumb
        pageLayout={buildNestedLayout()}
        selectedPath={HEADING_PATH}
        onSelectNode={() => {}}
      />,
    )

    const nav = screen.getByTestId('layout-canvas-breadcrumb')
    const texts = Array.from(nav.querySelectorAll('button, span.font-medium')).map((el) => el.textContent)

    expect(texts).toEqual(['container', 'form (checkout)', 'heading'])
  })

  it('shows the id in the label when the node declares one, and only the type otherwise', () => {
    render(
      <LayoutCanvasBreadcrumb
        pageLayout={buildNestedLayout()}
        selectedPath={FORM_PATH}
        onSelectNode={() => {}}
      />,
    )

    expect(screen.getByText('container')).toBeInTheDocument()
    expect(screen.getByText('form (checkout)')).toBeInTheDocument()
  })
})

describe('LayoutCanvasBreadcrumb navigation', () => {
  it('invokes onSelectNode with the container path when clicking the container segment, not form or heading', () => {
    const onSelectNode = vi.fn()
    render(
      <LayoutCanvasBreadcrumb
        pageLayout={buildNestedLayout()}
        selectedPath={HEADING_PATH}
        onSelectNode={onSelectNode}
      />,
    )

    fireEvent.click(screen.getByText('container'))

    expect(onSelectNode).toHaveBeenCalledTimes(1)
    expect(onSelectNode).toHaveBeenCalledWith(CONTAINER_PATH)
  })

  it('does not change selection behavior when clicking the last (already selected) segment', () => {
    const onSelectNode = vi.fn()
    render(
      <LayoutCanvasBreadcrumb
        pageLayout={buildNestedLayout()}
        selectedPath={HEADING_PATH}
        onSelectNode={onSelectNode}
      />,
    )

    const headingSegment = screen.getByText('heading')
    fireEvent.click(headingSegment)

    // Either it's not a button (no click handler wired) or, if clicked, it's a
    // no-op because the node is already selected — never a call with a
    // different path than the one already selected.
    if (onSelectNode.mock.calls.length > 0) {
      expect(onSelectNode).toHaveBeenCalledWith(HEADING_PATH)
    }
    expect(headingSegment.tagName).not.toBe('BUTTON')
  })
})

function buildTwoLevelConfig(): RuntimeConfig {
  return {
    api: {},
    initialPage: 'home',
    pages: [
      {
        id: 'home',
        layout: buildNestedLayout(),
      },
    ],
  }
}

const HEADING_NODE_PATH_ATTR = 'children.0.children.0.children.0'

// LayoutCanvas (0102) was retired in 0103/T10 in favor of DevEditorLayer wrapping the real
// `<RuntimePage />` in place, and kept selectedPath as private internal state with no way to
// seed it directly with an already multi-level selection from the outside anyway (a real click
// can reach any node, but there was no prop to start the component pre-selected). This harness
// composes the exact same real, unmocked pieces LayoutCanvas used to wire together
// (LayoutEditModeProvider, RuntimeStateProvider, LayoutRenderer, LayoutCanvasBreadcrumb) around
// a locally-owned selectedPath, so both the initial-click-to-select and the ancestor-navigation
// behavior can still be verified against the real T2 selection class, independent of that
// unrelated pre-existing limitation.
function CanvasBreadcrumbHarness({
  config,
  initialSelectedPath,
}: {
  config: RuntimeConfig
  initialSelectedPath: LayoutNodePath | null
}) {
  const [selectedPath, setSelectedPath] = useState<LayoutNodePath | null>(initialSelectedPath)
  const page = config.pages[0]

  return (
    <LayoutEditModeProvider
      value={{ active: true, selectedPath, hoveredPath: null, onSelectNode: setSelectedPath, onHoverNode: () => {} }}
    >
      <LayoutCanvasBreadcrumb pageLayout={page.layout} selectedPath={selectedPath} onSelectNode={setSelectedPath} />
      <RuntimeStateProvider config={config}>
        <LayoutRenderer nodes={page.layout} />
      </RuntimeStateProvider>
    </LayoutEditModeProvider>
  )
}

describe('LayoutCanvasBreadcrumb integration with the real edit-mode rendering pipeline', () => {
  it('updates the breadcrumb shown when a node is selected in the canvas', () => {
    render(<CanvasBreadcrumbHarness config={buildTwoLevelConfig()} initialSelectedPath={null} />)

    expect(screen.queryByTestId('layout-canvas-breadcrumb')).not.toBeInTheDocument()

    // The T2 edit-mode wrapper (layout-node-renderer.tsx) intentionally does not call
    // stopPropagation (see design.md, decision 2) so that clicks on interactive content
    // nested deeper in the tree keep working. A click on "Title" therefore also bubbles
    // through the form and container wrappers above the heading, but the wrapper marks
    // the native event once the innermost (actual click target) handler claims it, so
    // the ancestor wrappers become no-ops for selection — the heading itself is what
    // ends up selected, and the breadcrumb reflects its full 3-level path.
    fireEvent.click(screen.getByText('Title'))

    const nav = screen.getByTestId('layout-canvas-breadcrumb')
    const texts = Array.from(nav.querySelectorAll('button, span.font-medium')).map((el) => el.textContent)
    expect(texts).toEqual(['container', 'form (checkout)', 'heading'])
  })
})

describe('LayoutCanvasBreadcrumb ancestor navigation against the real edit-mode rendering pipeline', () => {
  it('moves the T2 selection class to the ancestor node when clicking a breadcrumb segment', () => {
    const { container } = render(
      <CanvasBreadcrumbHarness config={buildTwoLevelConfig()} initialSelectedPath={HEADING_PATH} />,
    )

    const headingWrapperBeforeClick = container.querySelector(`[data-node-path="${HEADING_NODE_PATH_ATTR}"]`)
    expect(headingWrapperBeforeClick?.className).toContain('outline-blue-500')

    fireEvent.click(screen.getByText('container'))

    const containerWrapper = container.querySelector('[data-node-path="children.0"]')
    expect(containerWrapper?.className).toContain('outline-blue-500')

    const headingWrapper = container.querySelector(`[data-node-path="${HEADING_NODE_PATH_ATTR}"]`)
    expect(headingWrapper?.className ?? '').not.toContain('outline-blue-500')
  })
})
