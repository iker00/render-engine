import { fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { LayoutNode } from '../../config/runtime-config'
import { FloatingSelectionOverlay } from '../../dev-runtime/floating-toolbar/floating-selection-overlay'
import type { LayoutNodePath } from '../../runtime/layout-node-path'

// jsdom does not implement ResizeObserver. FloatingSelectionOverlay measures
// its own size with one, so the test needs a controllable stub. Firing the
// callback synchronously inside observe() gives the overlay a size on the same
// commit tick, which is what allows the position to be computed before the
// initial render assertion runs.
const MOCK_OVERLAY_SIZE = { width: 320, height: 200 }

class MockResizeObserver {
  private readonly callback: ResizeObserverCallback

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback
  }

  observe(target: Element): void {
    const rect: DOMRectReadOnly = {
      width: MOCK_OVERLAY_SIZE.width,
      height: MOCK_OVERLAY_SIZE.height,
      top: 0,
      left: 0,
      right: MOCK_OVERLAY_SIZE.width,
      bottom: MOCK_OVERLAY_SIZE.height,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }
    this.callback(
      [
        {
          target,
          contentRect: rect,
          borderBoxSize: [],
          contentBoxSize: [],
          devicePixelContentBoxSize: [],
        } as unknown as ResizeObserverEntry,
      ],
      this as unknown as ResizeObserver,
    )
  }

  unobserve(): void {}
  disconnect(): void {}
}

function setViewport(width: number, height: number): void {
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: width })
  Object.defineProperty(window, 'innerHeight', { configurable: true, writable: true, value: height })
}

function makeRect(rect: Partial<DOMRect>): DOMRect {
  const top = rect.top ?? 0
  const left = rect.left ?? 0
  const width = rect.width ?? 0
  const height = rect.height ?? 0
  return {
    top,
    left,
    right: rect.right ?? left + width,
    bottom: rect.bottom ?? top + height,
    width,
    height,
    x: rect.x ?? left,
    y: rect.y ?? top,
    toJSON: () => ({}),
  }
}

interface AnchorSpec {
  path: string
  rect: Partial<DOMRect>
}

function AnchorFixture({ anchors, children }: { anchors: AnchorSpec[]; children?: ReactNode }) {
  return (
    <>
      {anchors.map((anchor) => (
        <div
          key={anchor.path}
          data-node-path={anchor.path}
          ref={(el) => {
            if (el) {
              const rect = makeRect(anchor.rect)
              el.getBoundingClientRect = () => rect
            }
          }}
        />
      ))}
      {children}
    </>
  )
}

function buildLayout(): LayoutNode[] {
  return [
    {
      type: 'container',
      props: {},
      children: [
        {
          type: 'form',
          id: 'checkout',
          children: [{ type: 'heading', props: { text: 'Hello', level: 2 } }],
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
const HEADING_PATH_STR = 'children.0.children.0.children.0'

const CONTAINER_PATH: LayoutNodePath = [{ field: 'children', index: 0 }]
const CONTAINER_PATH_STR = 'children.0'

const OUT_OF_BOUNDS_PATH: LayoutNodePath = [{ field: 'children', index: 99 }]

const DEFAULT_ANCHOR_RECT: Partial<DOMRect> = {
  top: 100,
  left: 200,
  width: 80,
  height: 20,
  right: 280,
  bottom: 120,
}

interface RenderOverlayOptions {
  selectedPath: LayoutNodePath | null
  onSelectNode?: (path: LayoutNodePath | null) => void
  onCommitNodeUpdate?: (
    path: LayoutNodePath,
    updater: (node: LayoutNode) => LayoutNode,
  ) => void
  onDeleteNode?: () => void
  anchors?: AnchorSpec[]
}

function renderOverlay(options: RenderOverlayOptions) {
  return render(
    <AnchorFixture anchors={options.anchors ?? []}>
      <FloatingSelectionOverlay
        pageLayout={buildLayout()}
        selectedPath={options.selectedPath}
        onSelectNode={options.onSelectNode ?? vi.fn()}
        onCommitNodeUpdate={options.onCommitNodeUpdate ?? vi.fn()}
        onDeleteNode={options.onDeleteNode ?? vi.fn()}
      />
    </AnchorFixture>,
  )
}

describe('FloatingSelectionOverlay', () => {
  const originalInnerWidth = window.innerWidth
  const originalInnerHeight = window.innerHeight

  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', MockResizeObserver)
    setViewport(1024, 768)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    setViewport(originalInnerWidth, originalInnerHeight)
  })

  it('renders nothing when selectedPath is null', () => {
    renderOverlay({ selectedPath: null })

    expect(screen.queryByTestId('dev-editor-selection-overlay')).toBeNull()
  })

  it('renders the overlay with position:fixed and computed top/left when the anchor is mounted', () => {
    renderOverlay({
      selectedPath: HEADING_PATH,
      anchors: [{ path: HEADING_PATH_STR, rect: DEFAULT_ANCHOR_RECT }],
    })

    const overlay = screen.getByTestId('dev-editor-selection-overlay')
    expect(overlay).toHaveClass('fixed')
    // anchor.bottom=120, gap=8 → top=128; anchor.left=200 → left=200 (fits).
    expect((overlay as HTMLElement).style.top).toBe('128px')
    expect((overlay as HTMLElement).style.left).toBe('200px')
  })

  it('returns null when the selected path does not resolve to a node in pageLayout', () => {
    // Even if an anchor with that serialized path happens to exist in the DOM,
    // getNodeAtPath returns null and the overlay must degrade safely rather
    // than render with a stale/undefined node.
    renderOverlay({
      selectedPath: OUT_OF_BOUNDS_PATH,
      anchors: [{ path: 'children.99', rect: DEFAULT_ANCHOR_RECT }],
    })

    expect(screen.queryByTestId('dev-editor-selection-overlay')).toBeNull()
  })

  it('returns null when the selected node exists in pageLayout but no data-node-path anchor is mounted yet', () => {
    renderOverlay({ selectedPath: HEADING_PATH, anchors: [] })

    expect(screen.queryByTestId('dev-editor-selection-overlay')).toBeNull()
  })

  it('renders the ancestor breadcrumb and invokes onSelectNode with the ancestor path when a segment is clicked', () => {
    const onSelectNode = vi.fn()
    renderOverlay({
      selectedPath: HEADING_PATH,
      onSelectNode,
      anchors: [{ path: HEADING_PATH_STR, rect: DEFAULT_ANCHOR_RECT }],
    })

    expect(screen.getByTestId('layout-canvas-breadcrumb')).toBeInTheDocument()

    fireEvent.click(screen.getByText('container'))

    expect(onSelectNode).toHaveBeenCalledTimes(1)
    expect(onSelectNode).toHaveBeenCalledWith(CONTAINER_PATH)
  })

  it('renders the properties panel and forwards field edits to onCommitNodeUpdate with the selected path', () => {
    const onCommitNodeUpdate = vi.fn()
    renderOverlay({
      selectedPath: HEADING_PATH,
      onCommitNodeUpdate,
      anchors: [{ path: HEADING_PATH_STR, rect: DEFAULT_ANCHOR_RECT }],
    })

    expect(screen.getByTestId('layout-canvas-properties-panel')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('text', { exact: false }), { target: { value: 'Updated' } })

    expect(onCommitNodeUpdate).toHaveBeenCalledTimes(1)
    const [calledPath, updater] = onCommitNodeUpdate.mock.calls[0]
    expect(calledPath).toBe(HEADING_PATH)
    const originalNode: LayoutNode = { type: 'heading', props: { text: 'Hello', level: 2 } }
    expect(updater(originalNode)).toEqual({ type: 'heading', props: { text: 'Updated', level: 2 } })
  })

  it('invokes onDeleteNode when the delete button of the properties panel is clicked', () => {
    const onDeleteNode = vi.fn()
    renderOverlay({
      selectedPath: HEADING_PATH,
      onDeleteNode,
      anchors: [{ path: HEADING_PATH_STR, rect: DEFAULT_ANCHOR_RECT }],
    })

    fireEvent.click(screen.getByTestId('layout-canvas-delete-node-button'))

    expect(onDeleteNode).toHaveBeenCalledTimes(1)
  })

  it('repositions when selectedPath changes to a different anchor with a different rect', () => {
    const anchors: AnchorSpec[] = [
      {
        path: HEADING_PATH_STR,
        rect: { top: 100, left: 100, width: 80, height: 20, right: 180, bottom: 120 },
      },
      {
        path: CONTAINER_PATH_STR,
        rect: { top: 300, left: 400, width: 200, height: 40, right: 600, bottom: 340 },
      },
    ]

    const { rerender } = render(
      <AnchorFixture anchors={anchors}>
        <FloatingSelectionOverlay
          pageLayout={buildLayout()}
          selectedPath={HEADING_PATH}
          onSelectNode={vi.fn()}
          onCommitNodeUpdate={vi.fn()}
          onDeleteNode={vi.fn()}
        />
      </AnchorFixture>,
    )

    const overlayForHeading = screen.getByTestId('dev-editor-selection-overlay') as HTMLElement
    expect(overlayForHeading.style.top).toBe('128px')
    expect(overlayForHeading.style.left).toBe('100px')

    rerender(
      <AnchorFixture anchors={anchors}>
        <FloatingSelectionOverlay
          pageLayout={buildLayout()}
          selectedPath={CONTAINER_PATH}
          onSelectNode={vi.fn()}
          onCommitNodeUpdate={vi.fn()}
          onDeleteNode={vi.fn()}
        />
      </AnchorFixture>,
    )

    const overlayForContainer = screen.getByTestId('dev-editor-selection-overlay') as HTMLElement
    // container.bottom=340, +8=348; container.left=400 fits with overlay width 320 in 1024 viewport.
    expect(overlayForContainer.style.top).toBe('348px')
    expect(overlayForContainer.style.left).toBe('400px')
  })

  it('keeps the overlay inside the viewport for an anchor near the bottom-right corner', () => {
    setViewport(800, 600)
    // Anchor is at the bottom-right corner. Overlay is 320×200.
    // Below: 590 + 8 + 200 = 798 > 600 → does not fit.
    // Above: 570 - 8 - 200 = 362 ≥ 0 → fits above.
    // Horizontal: left 750 + 320 = 1070 > 800 → clamped to 800 - 320 = 480.
    renderOverlay({
      selectedPath: HEADING_PATH,
      anchors: [
        {
          path: HEADING_PATH_STR,
          rect: { top: 570, left: 750, width: 40, height: 20, right: 790, bottom: 590 },
        },
      ],
    })

    const overlay = screen.getByTestId('dev-editor-selection-overlay') as HTMLElement
    const top = Number.parseFloat(overlay.style.top)
    const left = Number.parseFloat(overlay.style.left)

    expect(top).toBeGreaterThanOrEqual(0)
    expect(top + MOCK_OVERLAY_SIZE.height).toBeLessThanOrEqual(600)
    expect(left).toBeGreaterThanOrEqual(0)
    expect(left + MOCK_OVERLAY_SIZE.width).toBeLessThanOrEqual(800)
    expect(top).toBe(362)
    expect(left).toBe(480)
  })
})
