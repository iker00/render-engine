import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { LayoutNode } from '../../config/runtime-config'
import { FloatingSelectionOverlay } from '../../dev-runtime/floating-toolbar/floating-selection-overlay'
import type { LayoutNodePath } from '../../runtime/layout-node-path'

// T2 (0129): the `heading` fixtures below now mount the real `IconPickerPropertyField` when
// selected (their generated `props` schema always declares `icon` — see `resolveIconPropsSchema`).
// Without this mock, selecting a node walks the real ~3900-icon `lucide-react` namespace and blows
// the global Vitest timeout (same failure mode documented in T1/T2's own suites).
// `OTHER_MODULE_ICON_NAMES` covers every other icon name imported anywhere in the properties
// panel's own widget registry — ESM named imports resolve those bindings at module-load time
// regardless of which of them actually renders in a given test.
vi.mock('lucide-react', async () => {
  const { createLucideReactMock, OTHER_MODULE_ICON_NAMES } = await import('./lucide-react-mock')
  return createLucideReactMock(OTHER_MODULE_ICON_NAMES)
})

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

const CONTAINER_PATH: LayoutNodePath = [{ field: 'children', index: 0 }]

const OUT_OF_BOUNDS_PATH: LayoutNodePath = [{ field: 'children', index: 99 }]

interface RenderOverlayOptions {
  selectedPath: LayoutNodePath | null
  onSelectNode?: (path: LayoutNodePath | null) => void
  onCommitNodeUpdate?: (
    path: LayoutNodePath,
    updater: (node: LayoutNode) => LayoutNode,
  ) => void
  onDeleteNode?: () => void
}

function renderOverlay(options: RenderOverlayOptions) {
  return render(
    <FloatingSelectionOverlay
      pageLayout={buildLayout()}
      selectedPath={options.selectedPath}
      onSelectNode={options.onSelectNode ?? vi.fn()}
      onCommitNodeUpdate={options.onCommitNodeUpdate ?? vi.fn()}
      onDeleteNode={options.onDeleteNode ?? vi.fn()}
    />,
  )
}

describe('FloatingSelectionOverlay', () => {
  it('renders nothing when selectedPath is null', () => {
    renderOverlay({ selectedPath: null })

    expect(screen.queryByTestId('dev-editor-selection-overlay')).toBeNull()
  })

  it('returns null when the selected path does not resolve to a node in pageLayout', () => {
    renderOverlay({ selectedPath: OUT_OF_BOUNDS_PATH })

    expect(screen.queryByTestId('dev-editor-selection-overlay')).toBeNull()
  })

  it('renders a fixed panel docked to the right edge of the viewport when selectedPath resolves, without any data-node-path anchor in the DOM', () => {
    renderOverlay({ selectedPath: HEADING_PATH })

    const overlay = screen.getByTestId('dev-editor-selection-overlay')
    expect(overlay).toHaveClass('fixed')
    expect(overlay).toHaveClass('right-0')
    expect(overlay).toHaveClass('inset-y-0')
    expect(document.querySelector('[data-node-path]')).toBeNull()
  })

  it('exposes overflow-y-auto on the content zone so internal scroll is enabled when content overflows', () => {
    renderOverlay({ selectedPath: HEADING_PATH })

    const overlay = screen.getByTestId('dev-editor-selection-overlay')
    const scrollableContent = overlay.querySelector('.overflow-y-auto')
    expect(scrollableContent).not.toBeNull()
    // The breadcrumb and properties panel must live inside the scrollable zone.
    expect(scrollableContent?.contains(screen.getByTestId('layout-canvas-breadcrumb'))).toBe(true)
    expect(scrollableContent?.contains(screen.getByTestId('layout-canvas-properties-panel'))).toBe(true)
  })

  it('renders the ancestor breadcrumb and invokes onSelectNode with the ancestor path when a segment is clicked', () => {
    const onSelectNode = vi.fn()
    renderOverlay({ selectedPath: HEADING_PATH, onSelectNode })

    expect(screen.getByTestId('layout-canvas-breadcrumb')).toBeInTheDocument()

    fireEvent.click(screen.getByText('container'))

    expect(onSelectNode).toHaveBeenCalledTimes(1)
    expect(onSelectNode).toHaveBeenCalledWith(CONTAINER_PATH)
  })

  it('renders the properties panel and forwards field edits to onCommitNodeUpdate with the selected path', () => {
    const onCommitNodeUpdate = vi.fn()
    renderOverlay({ selectedPath: HEADING_PATH, onCommitNodeUpdate })

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
    renderOverlay({ selectedPath: HEADING_PATH, onDeleteNode })

    fireEvent.click(screen.getByTestId('layout-canvas-delete-node-button'))

    expect(onDeleteNode).toHaveBeenCalledTimes(1)
  })

  it('renders a visible close button with its own data-testid and an explicit aria-label that clears the selection via onSelectNode(null)', () => {
    const onSelectNode = vi.fn()
    renderOverlay({ selectedPath: HEADING_PATH, onSelectNode })

    const closeButton = screen.getByTestId('dev-editor-selection-overlay-close')
    expect(closeButton).toHaveAttribute('aria-label')
    expect(closeButton.getAttribute('aria-label')).not.toBe('')

    fireEvent.click(closeButton)

    expect(onSelectNode).toHaveBeenCalledTimes(1)
    expect(onSelectNode).toHaveBeenCalledWith(null)
  })

  // T3 (0133), criterion 11: the overlay no longer renders its own "Selección" header — the
  // panel's own header (title + delete/close icon buttons) is the only header rendered, and the
  // close button reached above is that panel's button, not a separate overlay-owned one.
  it('renders no separate "Selección" header of its own — the close button belongs to the properties panel header', () => {
    renderOverlay({ selectedPath: HEADING_PATH })

    expect(screen.queryByText('Selección')).not.toBeInTheDocument()
    const panel = screen.getByTestId('layout-canvas-properties-panel')
    expect(panel.contains(screen.getByTestId('dev-editor-selection-overlay-close'))).toBe(true)
    expect(panel.contains(screen.getByTestId('layout-canvas-breadcrumb'))).toBe(true)
  })

  // T4 (0133): the panel's own tab bar (Props/Diseño/Visibilidad/Queries, T1/T2) renders inside
  // the overlay, scoped to the properties panel. `HEADING_PATH` has no `container` ancestor with
  // `columns` (see `buildLayout` above), so Diseño is absent — Props, Visibilidad and Queries
  // remain.
  it('renders the node panel tab bar inside the properties panel, with Props active and Diseño absent for this fixture', () => {
    renderOverlay({ selectedPath: HEADING_PATH })

    const panel = screen.getByTestId('layout-canvas-properties-panel')
    const tablist = within(panel).getByRole('tablist')
    const tabNames = within(tablist)
      .getAllByRole('tab')
      .map((tab) => tab.textContent)
    expect(tabNames).toEqual(['Props', 'Visibilidad', 'Queries'])
    expect(within(panel).getByRole('tab', { name: 'Props' })).toHaveAttribute('aria-selected', 'true')
  })
})
