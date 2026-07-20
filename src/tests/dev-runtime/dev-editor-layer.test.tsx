import { fireEvent, render, screen } from '@testing-library/react'
import { useState, type MutableRefObject } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { LayoutNode, RuntimeConfig } from '../../config/runtime-config'
import type { CommitCanvasMutationResult } from '../../dev-runtime/layout-canvas/layout-canvas-commit'
import { DevEditorLayer } from '../../dev-runtime/floating-toolbar/dev-editor-layer'
import { useLayoutEditModeContext } from '../../runtime/layout-edit-mode-context'
import { RuntimePage } from '../../runtime/runtime-page'
import { RuntimeStateProvider, useRuntimeState } from '../../runtime/runtime-state/runtime-state-provider'

function heading(text: string): LayoutNode {
  return { type: 'heading', props: { text, level: 2 } }
}

function buildConfig(): RuntimeConfig {
  return {
    api: {},
    initialPage: 'home',
    pages: [
      { id: 'home', layout: [heading('First'), heading('Second')] },
      { id: 'about', layout: [heading('About heading')] },
    ],
  } as RuntimeConfig
}

const NOOP_MONACO = {
  editorBuffer: null,
  onEditorChange: () => {},
  onApply: () => {},
  onCopy: () => {},
  pendingChanges: false,
  errors: null,
}

const noopCommitCanvasMutation = (): CommitCanvasMutationResult => ({ status: 'applied' })

// Stands in for `<RuntimePage />` (which DevRuntimeReady actually passes as `children` in
// production) — DevEditorLayer treats `children` opaquely, so a small consumer of
// useLayoutEditModeContext() with a couple of clickable `[data-node-path]` anchors (mirroring
// what layout-node-renderer.tsx produces for real nodes) is enough to observe everything
// DevEditorLayer itself is responsible for, without pulling in the full node-render pipeline.
// The lazy useState initializer runs exactly once per component instance, so
// `mountCountRef` only increments on a genuine mount — not on a re-render — which is how the
// "mode switch never remounts RuntimePage" behavior (design.md Decisión 1) gets verified.
function EditModeProbe({ mountCountRef }: { mountCountRef: MutableRefObject<number> }) {
  const editModeContext = useLayoutEditModeContext()
  useState(() => {
    mountCountRef.current += 1
  })

  return (
    <div>
      <pre data-testid="edit-mode-context">{JSON.stringify(editModeContext)}</pre>
      <div
        data-node-path="children.0"
        data-testid="probe-node-a"
        onClick={() => editModeContext?.active && editModeContext.onSelectNode([{ field: 'children', index: 0 }])}
      >
        First
      </div>
      <div
        data-node-path="children.1"
        data-testid="probe-node-b"
        onClick={() => editModeContext?.active && editModeContext.onSelectNode([{ field: 'children', index: 1 }])}
      >
        Second
      </div>
    </div>
  )
}

function CurrentPageIdProbe() {
  const state = useRuntimeState()
  return <pre data-testid="current-page-id">{state.navigation.currentPageId}</pre>
}

interface HarnessProps {
  config: RuntimeConfig
  mountCountRef: MutableRefObject<number>
  onCommitCanvasMutation?: (mutate: (pageLayout: LayoutNode[]) => LayoutNode[]) => CommitCanvasMutationResult
  onCommitNodeUpdate?: (path: never, updater: never) => void
}

function DevEditorLayerHarness({
  config,
  mountCountRef,
  onCommitCanvasMutation = noopCommitCanvasMutation,
  onCommitNodeUpdate = () => {},
}: HarnessProps) {
  const [mode, setMode] = useState<'visual' | 'editor'>('visual')
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [monacoOpen, setMonacoOpen] = useState(false)

  return (
    <RuntimeStateProvider config={config}>
      <CurrentPageIdProbe />
      <DevEditorLayer
        mode={mode}
        onModeChange={setMode}
        paletteOpen={paletteOpen}
        onPaletteOpenChange={setPaletteOpen}
        monacoOpen={monacoOpen}
        onMonacoOpenChange={setMonacoOpen}
        monaco={NOOP_MONACO}
        onCommitCanvasMutation={onCommitCanvasMutation}
        onCommitNodeUpdate={onCommitNodeUpdate}
      >
        <EditModeProbe mountCountRef={mountCountRef} />
      </DevEditorLayer>
    </RuntimeStateProvider>
  )
}

function renderHarness(config: RuntimeConfig = buildConfig()) {
  const mountCountRef = { current: 0 }
  render(<DevEditorLayerHarness config={config} mountCountRef={mountCountRef} />)
  return { mountCountRef }
}

function contextJson(): unknown {
  return JSON.parse(screen.getByTestId('edit-mode-context').textContent ?? 'null')
}

function switchToEditorMode() {
  fireEvent.click(screen.getByTestId('dev-editor-toolbar-mode-editor'))
}

function switchToVisualMode() {
  fireEvent.click(screen.getByTestId('dev-editor-toolbar-mode-visual'))
}

describe('DevEditorLayer / LayoutEditModeProvider value by mode', () => {
  it('provides { active: false } while mode is visual (design.md Decisión 9)', () => {
    renderHarness()
    expect(contextJson()).toEqual({ active: false })
  })

  it('provides { active: true, selectedPath, hoveredPath } once switched to editor', () => {
    renderHarness()
    switchToEditorMode()

    const context = contextJson() as { active: unknown; selectedPath: unknown; hoveredPath: unknown }
    expect(context).not.toBeNull()
    expect(context).toHaveProperty('active', true)
    expect(context).toHaveProperty('selectedPath', null)
    expect(context).toHaveProperty('hoveredPath', null)
  })

  it('never remounts the children tree when toggling between visual and editor', () => {
    const { mountCountRef } = renderHarness()
    expect(mountCountRef.current).toBe(1)

    switchToEditorMode()
    switchToVisualMode()
    switchToEditorMode()

    expect(mountCountRef.current).toBe(1)
  })
})

describe('DevEditorLayer / selection persistence across mode switches (Decisión 5)', () => {
  it('keeps selectedPath when switching from editor to visual and back, without reselecting', () => {
    renderHarness()
    switchToEditorMode()
    fireEvent.click(screen.getByTestId('probe-node-a'))

    expect((contextJson() as { selectedPath: unknown }).selectedPath).toEqual([{ field: 'children', index: 0 }])

    switchToVisualMode()
    expect(contextJson()).toEqual({ active: false })

    switchToEditorMode()
    expect((contextJson() as { selectedPath: unknown }).selectedPath).toEqual([{ field: 'children', index: 0 }])
  })
})

describe('DevEditorLayer / selection overlay visibility by mode', () => {
  it('does not render FloatingSelectionOverlay in visual mode', () => {
    renderHarness()
    expect(screen.queryByTestId('dev-editor-selection-overlay')).not.toBeInTheDocument()
  })

  it('renders FloatingSelectionOverlay anchored to the selected node once in editor mode', () => {
    renderHarness()
    switchToEditorMode()
    fireEvent.click(screen.getByTestId('probe-node-a'))

    expect(screen.getByTestId('dev-editor-selection-overlay')).toBeInTheDocument()
  })

  it('hides the overlay when switching back to visual, without discarding the selection', () => {
    renderHarness()
    switchToEditorMode()
    fireEvent.click(screen.getByTestId('probe-node-a'))
    expect(screen.getByTestId('dev-editor-selection-overlay')).toBeInTheDocument()

    switchToVisualMode()
    expect(screen.queryByTestId('dev-editor-selection-overlay')).not.toBeInTheDocument()

    switchToEditorMode()
    expect(screen.getByTestId('dev-editor-selection-overlay')).toBeInTheDocument()
  })
})

describe('DevEditorLayer / page navigation clears selection (FR15)', () => {
  it('navigates for real via the toolbar page selector and clears selectedPath', () => {
    renderHarness()
    switchToEditorMode()
    fireEvent.click(screen.getByTestId('probe-node-a'))
    expect((contextJson() as { selectedPath: unknown }).selectedPath).not.toBeNull()
    expect(screen.getByTestId('current-page-id').textContent).toBe('home')

    fireEvent.change(screen.getByTestId('dev-editor-toolbar-page-select'), { target: { value: 'about' } })

    expect(screen.getByTestId('current-page-id').textContent).toBe('about')
    expect((contextJson() as { selectedPath: unknown }).selectedPath).toBeNull()
  })
})

describe('DevEditorLayer / selection degrades safely when the layout changes underneath it', () => {
  it('clears selectedPath without throwing once the selected node is deleted via a canvas commit', () => {
    function ConfigMutableHarness({ mountCountRef }: { mountCountRef: MutableRefObject<number> }) {
      const [config, setConfig] = useState<RuntimeConfig>(buildConfig())
      const [mode, setMode] = useState<'visual' | 'editor'>('editor')
      const [paletteOpen, setPaletteOpen] = useState(false)
      const [monacoOpen, setMonacoOpen] = useState(false)

      function commit(mutate: (pageLayout: LayoutNode[]) => LayoutNode[]): CommitCanvasMutationResult {
        setConfig((prev) => ({
          ...prev,
          pages: prev.pages.map((page) =>
            page.id === prev.initialPage ? { ...page, layout: mutate(page.layout) } : page,
          ),
        }))
        return { status: 'applied' }
      }

      return (
        <RuntimeStateProvider config={config}>
          <DevEditorLayer
            mode={mode}
            onModeChange={setMode}
            paletteOpen={paletteOpen}
            onPaletteOpenChange={setPaletteOpen}
            monacoOpen={monacoOpen}
            onMonacoOpenChange={setMonacoOpen}
            monaco={NOOP_MONACO}
            onCommitCanvasMutation={commit}
            onCommitNodeUpdate={() => {}}
          >
            <EditModeProbe mountCountRef={mountCountRef} />
          </DevEditorLayer>
        </RuntimeStateProvider>
      )
    }

    const mountCountRef = { current: 0 }
    render(<ConfigMutableHarness mountCountRef={mountCountRef} />)

    fireEvent.click(screen.getByTestId('probe-node-a'))
    expect(screen.getByTestId('dev-editor-selection-overlay')).toBeInTheDocument()

    // Deleting the selected node through the overlay's own delete action is the real,
    // observable trigger for a canvas commit that removes the selected node — same pipeline
    // FloatingSelectionOverlay.onDeleteNode -> DevEditorLayer.handleDeleteSelectedNode ->
    // onCommitCanvasMutation uses in production.
    fireEvent.click(screen.getByTestId('layout-canvas-delete-node-button'))

    expect(screen.queryByTestId('dev-editor-selection-overlay')).not.toBeInTheDocument()
    expect((contextJson() as { selectedPath: unknown }).selectedPath).toBeNull()
  })
})

describe('DevEditorLayer / FloatingNodePalette visibility', () => {
  it('shows the palette when paletteOpen is true even in visual mode', () => {
    renderHarness()
    fireEvent.click(screen.getByTestId('dev-editor-toolbar-palette-toggle'))
    expect(screen.getByTestId('dev-editor-floating-palette')).toBeInTheDocument()
  })

  it('toggles paletteOpen when clicking "Añadir elemento" on the toolbar', () => {
    renderHarness()
    expect(screen.queryByTestId('dev-editor-floating-palette')).not.toBeInTheDocument()

    fireEvent.click(screen.getByTestId('dev-editor-toolbar-palette-toggle'))
    expect(screen.getByTestId('dev-editor-floating-palette')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('dev-editor-toolbar-palette-toggle'))
    expect(screen.queryByTestId('dev-editor-floating-palette')).not.toBeInTheDocument()
  })
})

describe('DevEditorLayer / toolbar always visible', () => {
  it('renders the toolbar regardless of mode/palette/monaco state', () => {
    renderHarness()
    expect(screen.getByTestId('dev-editor-toolbar')).toBeInTheDocument()

    switchToEditorMode()
    expect(screen.getByTestId('dev-editor-toolbar')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('dev-editor-toolbar-palette-toggle'))
    expect(screen.getByTestId('dev-editor-toolbar')).toBeInTheDocument()
  })
})

describe('DevEditorLayer / commit callbacks are the ones threaded through, no second mechanism', () => {
  it('invokes the onCommitCanvasMutation prop when a delete is confirmed', () => {
    const onCommitCanvasMutation = vi.fn(noopCommitCanvasMutation)
    const mountCountRef = { current: 0 }
    render(
      <DevEditorLayerHarness
        config={buildConfig()}
        mountCountRef={mountCountRef}
        onCommitCanvasMutation={onCommitCanvasMutation}
      />,
    )

    switchToEditorMode()
    fireEvent.click(screen.getByTestId('probe-node-a'))
    fireEvent.click(screen.getByTestId('layout-canvas-delete-node-button'))

    expect(onCommitCanvasMutation).toHaveBeenCalledTimes(1)
  })
})

// Central case for design.md feature 0103 Decisión 9: before this fix, the wrapper
// layout-node-renderer.tsx wraps each node in only existed when the provider's `value` was
// non-null, so toggling Visual ({ active: false }, formerly `value: null`) <-> Editor
// (`{ active: true, ... }`) changed the element type at that tree position and React
// unmounted/remounted every node underneath, wiping any node-local state (e.g. an expanded
// accordion). This exercises the real rendering pipeline (LayoutRenderer -> LayoutNodeRenderer
// -> AccordionNode), not the EditModeProbe stand-in used by the other describes above, because
// the bug lived specifically in the per-node wrapper those tests don't render through.
describe('DevEditorLayer / node-local state persists across mode switches (Decisión 9)', () => {
  it('keeps an expanded accordion expanded, same DOM node, toggling Visual -> Editor -> Visual', () => {
    const accordionLayout: LayoutNode[] = [
      {
        type: 'accordion',
        props: { label: 'Details' },
        children: [heading('Accordion body')],
      },
    ]
    const accordionConfig: RuntimeConfig = {
      api: {},
      initialPage: 'home',
      pages: [{ id: 'home', layout: accordionLayout }],
    } as RuntimeConfig

    function AccordionModeSwitchHarness() {
      const [mode, setMode] = useState<'visual' | 'editor'>('visual')
      const [paletteOpen, setPaletteOpen] = useState(false)
      const [monacoOpen, setMonacoOpen] = useState(false)

      return (
        <RuntimeStateProvider config={accordionConfig}>
          <DevEditorLayer
            mode={mode}
            onModeChange={setMode}
            paletteOpen={paletteOpen}
            onPaletteOpenChange={setPaletteOpen}
            monacoOpen={monacoOpen}
            onMonacoOpenChange={setMonacoOpen}
            monaco={NOOP_MONACO}
            onCommitCanvasMutation={noopCommitCanvasMutation}
            onCommitNodeUpdate={() => {}}
          >
            <RuntimePage />
          </DevEditorLayer>
        </RuntimeStateProvider>
      )
    }

    const { container } = render(<AccordionModeSwitchHarness />)

    const header = screen.getByRole('button', { name: 'Details' })
    fireEvent.click(header)
    expect(header).toHaveAttribute('aria-expanded', 'true')

    const headerBeforeToggle = container.querySelector('[data-layout-node="accordion-header"]')
    expect(headerBeforeToggle).not.toBeNull()

    switchToEditorMode()

    const headerInEditor = container.querySelector('[data-layout-node="accordion-header"]')
    expect(headerInEditor).toBe(headerBeforeToggle)
    expect(headerInEditor).toHaveAttribute('aria-expanded', 'true')

    switchToVisualMode()

    const headerBackInVisual = container.querySelector('[data-layout-node="accordion-header"]')
    expect(headerBackInVisual).toBe(headerBeforeToggle)
    expect(headerBackInVisual).toHaveAttribute('aria-expanded', 'true')
  })
})
