import { fireEvent, render, screen } from '@testing-library/react'
import { useEffect, useState, type MutableRefObject } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { LayoutNode, RuntimeConfig } from '../../config/runtime-config'
import type { CommitCanvasMutationResult } from '../../dev-runtime/layout-canvas/layout-canvas-commit'
import { DevEditorLayer } from '../../dev-runtime/floating-toolbar/dev-editor-layer'
import { useLayoutEditModeContext } from '../../runtime/use-layout-edit-mode-context'
import { RuntimePage } from '../../runtime/runtime-page'
import { RuntimeStateProvider } from '../../runtime/runtime-state/runtime-state-provider'
import { useRuntimeState } from '../../runtime/runtime-state/use-runtime-state'

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
// The mount-only effect (empty deps) runs exactly once per component instance, so
// `mountCountRef` only increments on a genuine mount — not on a re-render — which is how the
// "mode switch never remounts RuntimePage" behavior (design.md Decisión 1) gets verified.
// `render()` from Testing Library flushes effects synchronously (wrapped in `act`), so the
// counter is already up to date by the time assertions run right after `render`.
function EditModeProbe({ mountCountRef }: { mountCountRef: MutableRefObject<number> }) {
  const editModeContext = useLayoutEditModeContext()
  useEffect(() => {
    mountCountRef.current += 1
  }, [mountCountRef])

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
  onCommitShellMutation?: (mutate: (shell: never) => never) => CommitCanvasMutationResult
  onMonacoOpenChangeSpy?: (open: boolean) => void
  initialMonacoOpen?: boolean
}

function DevEditorLayerHarness({
  config,
  mountCountRef,
  onCommitCanvasMutation = noopCommitCanvasMutation,
  onCommitNodeUpdate = () => {},
  onCommitShellMutation = noopCommitCanvasMutation,
  onMonacoOpenChangeSpy,
  initialMonacoOpen = false,
}: HarnessProps) {
  const [mode, setMode] = useState<'visual' | 'editor'>('visual')
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [monacoOpen, setMonacoOpen] = useState(initialMonacoOpen)

  function handleMonacoOpenChange(open: boolean) {
    onMonacoOpenChangeSpy?.(open)
    setMonacoOpen(open)
  }

  return (
    <RuntimeStateProvider config={config}>
      <CurrentPageIdProbe />
      <DevEditorLayer
        mode={mode}
        onModeChange={setMode}
        paletteOpen={paletteOpen}
        onPaletteOpenChange={setPaletteOpen}
        monacoOpen={monacoOpen}
        onMonacoOpenChange={handleMonacoOpenChange}
        monaco={NOOP_MONACO}
        onCommitCanvasMutation={onCommitCanvasMutation}
        onCommitNodeUpdate={onCommitNodeUpdate}
        onCommitShellMutation={onCommitShellMutation}
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
            onCommitShellMutation={noopCommitCanvasMutation}
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
describe('DevEditorLayer / mutual exclusion between selection panel and Monaco (T2)', () => {
  it('selecting a node while Monaco is open closes Monaco and keeps the node selected', () => {
    const onMonacoOpenChangeSpy = vi.fn()
    const mountCountRef = { current: 0 }
    render(
      <DevEditorLayerHarness
        config={buildConfig()}
        mountCountRef={mountCountRef}
        onMonacoOpenChangeSpy={onMonacoOpenChangeSpy}
        initialMonacoOpen={true}
      />,
    )

    switchToEditorMode()
    fireEvent.click(screen.getByTestId('probe-node-a'))

    expect(onMonacoOpenChangeSpy).toHaveBeenCalledTimes(1)
    expect(onMonacoOpenChangeSpy).toHaveBeenCalledWith(false)
    expect((contextJson() as { selectedPath: unknown }).selectedPath).toEqual([{ field: 'children', index: 0 }])
  })

  it('opening Monaco while a node is selected clears the selection and hides the selection panel', () => {
    const onMonacoOpenChangeSpy = vi.fn()
    const mountCountRef = { current: 0 }
    render(
      <DevEditorLayerHarness
        config={buildConfig()}
        mountCountRef={mountCountRef}
        onMonacoOpenChangeSpy={onMonacoOpenChangeSpy}
        initialMonacoOpen={false}
      />,
    )

    switchToEditorMode()
    fireEvent.click(screen.getByTestId('probe-node-a'))
    expect(screen.getByTestId('dev-editor-selection-overlay')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('dev-editor-toolbar-monaco-toggle'))

    expect(onMonacoOpenChangeSpy).toHaveBeenCalledTimes(1)
    expect(onMonacoOpenChangeSpy).toHaveBeenCalledWith(true)
    expect((contextJson() as { selectedPath: unknown }).selectedPath).toBeNull()
    expect(screen.queryByTestId('dev-editor-selection-overlay')).not.toBeInTheDocument()
  })

  it('does not invoke onMonacoOpenChange when selecting a node while Monaco is already closed', () => {
    const onMonacoOpenChangeSpy = vi.fn()
    const mountCountRef = { current: 0 }
    render(
      <DevEditorLayerHarness
        config={buildConfig()}
        mountCountRef={mountCountRef}
        onMonacoOpenChangeSpy={onMonacoOpenChangeSpy}
        initialMonacoOpen={false}
      />,
    )

    switchToEditorMode()
    fireEvent.click(screen.getByTestId('probe-node-a'))

    expect(onMonacoOpenChangeSpy).not.toHaveBeenCalled()
  })

  it('does not touch the selection when opening Monaco with no active selection', () => {
    const onMonacoOpenChangeSpy = vi.fn()
    const mountCountRef = { current: 0 }
    render(
      <DevEditorLayerHarness
        config={buildConfig()}
        mountCountRef={mountCountRef}
        onMonacoOpenChangeSpy={onMonacoOpenChangeSpy}
        initialMonacoOpen={false}
      />,
    )

    switchToEditorMode()
    fireEvent.click(screen.getByTestId('dev-editor-toolbar-monaco-toggle'))

    expect(onMonacoOpenChangeSpy).toHaveBeenCalledTimes(1)
    expect(onMonacoOpenChangeSpy).toHaveBeenCalledWith(true)
    expect((contextJson() as { selectedPath: unknown }).selectedPath).toBeNull()
    expect(screen.queryByTestId('dev-editor-selection-overlay')).not.toBeInTheDocument()
  })
})

// T3: the selection panel's own Escape handling. The Monaco panel's Escape handling lives in
// dev-runtime.tsx (a separate, untouched listener) and is covered there — this describe only
// exercises the listener DevEditorLayer registers for itself.
describe('DevEditorLayer / Esc closes the selection panel when Monaco is closed (T3)', () => {
  it('clears the selection and hides the overlay on Escape when Monaco is closed', () => {
    renderHarness()
    switchToEditorMode()
    fireEvent.click(screen.getByTestId('probe-node-a'))
    expect(screen.getByTestId('dev-editor-selection-overlay')).toBeInTheDocument()

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(screen.queryByTestId('dev-editor-selection-overlay')).not.toBeInTheDocument()
    expect((contextJson() as { selectedPath: unknown }).selectedPath).toBeNull()
  })

  it('does not clear the selection on Escape while Monaco is open', () => {
    // DevEditorLayer's own handlers (handleSelectNode / handleOpenMonaco) never allow
    // monacoOpen: true and a selection to coexist (T2's mutual exclusion), so this state is
    // constructed directly: monacoOpen is a fixed prop here and onMonacoOpenChange is a no-op,
    // isolating the Esc guard itself rather than relying on a reachable app flow.
    const mountCountRef = { current: 0 }

    function MonacoStaysOpenHarness() {
      const [paletteOpen, setPaletteOpen] = useState(false)

      return (
        <RuntimeStateProvider config={buildConfig()}>
          <DevEditorLayer
            mode="editor"
            onModeChange={() => {}}
            paletteOpen={paletteOpen}
            onPaletteOpenChange={setPaletteOpen}
            monacoOpen={true}
            onMonacoOpenChange={() => {}}
            monaco={NOOP_MONACO}
            onCommitCanvasMutation={noopCommitCanvasMutation}
            onCommitNodeUpdate={() => {}}
            onCommitShellMutation={noopCommitCanvasMutation}
          >
            <EditModeProbe mountCountRef={mountCountRef} />
          </DevEditorLayer>
        </RuntimeStateProvider>
      )
    }

    render(<MonacoStaysOpenHarness />)
    fireEvent.click(screen.getByTestId('probe-node-a'))
    expect(screen.getByTestId('dev-editor-selection-overlay')).toBeInTheDocument()

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(screen.getByTestId('dev-editor-selection-overlay')).toBeInTheDocument()
    expect((contextJson() as { selectedPath: unknown }).selectedPath).toEqual([{ field: 'children', index: 0 }])
  })

  it('has no effect when there is no active selection', () => {
    renderHarness()
    switchToEditorMode()

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(screen.queryByTestId('dev-editor-selection-overlay')).not.toBeInTheDocument()
    expect(contextJson()).toEqual({ active: true, selectedPath: null, hoveredPath: null })
  })

  it('deregisters the keydown listener when DevEditorLayer unmounts', () => {
    const mountCountRef = { current: 0 }
    const { unmount } = render(<DevEditorLayerHarness config={buildConfig()} mountCountRef={mountCountRef} />)
    unmount()

    expect(() => fireEvent.keyDown(document, { key: 'Escape' })).not.toThrow()
  })
})

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
            onCommitShellMutation={noopCommitCanvasMutation}
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

function switchToShellDomain() {
  fireEvent.click(screen.getByTestId('dev-editor-toolbar-domain-shell'))
}

function switchToLayoutDomain() {
  fireEvent.click(screen.getByTestId('dev-editor-toolbar-domain-layout'))
}

// 0122-T5: activating the "Shell" domain tab swaps the central content area for
// `ShellConfigPanel`, in place of the Layout canvas — never alongside it.
describe('DevEditorLayer / Shell domain (0122-T5)', () => {
  it('renders ShellConfigPanel and stops rendering the canvas once the Shell tab is selected', () => {
    renderHarness()
    expect(screen.getByTestId('probe-node-a')).toBeInTheDocument()
    expect(screen.queryByTestId('shell-config-panel')).not.toBeInTheDocument()

    switchToShellDomain()

    expect(screen.getByTestId('shell-config-panel')).toBeInTheDocument()
    expect(screen.queryByTestId('probe-node-a')).not.toBeInTheDocument()
  })

  it('restores the canvas view when switching back to Layout', () => {
    renderHarness()
    switchToShellDomain()
    expect(screen.getByTestId('shell-config-panel')).toBeInTheDocument()

    switchToLayoutDomain()

    expect(screen.queryByTestId('shell-config-panel')).not.toBeInTheDocument()
    expect(screen.getByTestId('probe-node-a')).toBeInTheDocument()
  })

  it('marks the Shell tab as pressed and Layout as not pressed once selected', () => {
    renderHarness()
    switchToShellDomain()

    expect(screen.getByTestId('dev-editor-toolbar-domain-shell')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByTestId('dev-editor-toolbar-domain-layout')).toHaveAttribute('aria-pressed', 'false')
  })

  it('clears a canvas node selection when entering Shell (same policy as api/pages/tokens)', () => {
    renderHarness()
    switchToEditorMode()
    fireEvent.click(screen.getByTestId('probe-node-a'))
    expect((contextJson() as { selectedPath: unknown }).selectedPath).not.toBeNull()

    switchToShellDomain()
    switchToLayoutDomain()

    expect((contextJson() as { selectedPath: unknown }).selectedPath).toBeNull()
  })

  it('does not render the FloatingSelectionOverlay while the Shell domain is active', () => {
    renderHarness()
    switchToEditorMode()
    fireEvent.click(screen.getByTestId('probe-node-a'))
    expect(screen.getByTestId('dev-editor-selection-overlay')).toBeInTheDocument()

    switchToShellDomain()

    expect(screen.queryByTestId('dev-editor-selection-overlay')).not.toBeInTheDocument()
  })

  it('keeps the toolbar visible while the Shell panel is rendered', () => {
    renderHarness()
    switchToShellDomain()
    expect(screen.getByTestId('dev-editor-toolbar')).toBeInTheDocument()
  })
})
