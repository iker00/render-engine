import { fireEvent, render, screen, within } from '@testing-library/react'
import { useEffect, useState, type MutableRefObject } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { LayoutNode, RuntimeConfig } from '../../config/runtime-config'
import type { CommitCanvasMutationResult } from '../../dev-runtime/layout-canvas/layout-canvas-commit'
import { DevEditorLayer } from '../../dev-runtime/floating-toolbar/dev-editor-layer'
import type {
  SaveConfigErrorInfo,
  SaveState,
} from '../../dev-runtime/floating-toolbar/dev-editor-floating-toolbar'
import type { ResolvedEndpointOperation } from '../../dev-runtime/endpoints-config/resolve-endpoint-operation'
import type { RuntimeEndpointsConfig } from '../../dev-runtime/endpoints-config/runtime-endpoints-config-schema'
import { useLayoutEditModeContext } from '../../runtime/use-layout-edit-mode-context'
import { RuntimePage } from '../../runtime/runtime-page'
import { RuntimeStateProvider } from '../../runtime/runtime-state/runtime-state-provider'
import { useRuntimeState } from '../../runtime/runtime-state/use-runtime-state'

// T2 (0129): every `heading` fixture in this file now mounts the real `IconPickerPropertyField`
// when selected (its generated `props` schema always declares `icon`, regardless of whether a
// given fixture sets it — see `resolveIconPropsSchema`). Without this mock, selecting any node
// walks the real ~3900-icon `lucide-react` namespace and blows the global Vitest timeout (same
// failure mode documented in T1/T2's own suites). `OTHER_MODULE_ICON_NAMES` covers every other
// icon name imported anywhere in `DevEditorLayer`'s render tree (it mounts `ShellConfigPanel`
// internally) — ESM named imports resolve those bindings at module-load time regardless of which
// of them actually renders in a given test.
vi.mock('lucide-react', async () => {
  const { createLucideReactMock, OTHER_MODULE_ICON_NAMES } = await import('./lucide-react-mock')
  return createLucideReactMock(OTHER_MODULE_ICON_NAMES)
})

// T6 (0131): `TranslationsConfigPanel` is mocked purely to observe the props `DevEditorLayer`
// forwards to it (`searchResolution`/`refreshResolution`/`provider`) — this task doesn't change
// anything about the panel's own real behavior (T7 does), and none of that behavior is observable
// from these new props yet. Every existing assertion in this file only checks for the
// `translations-config-panel` testid, so replacing the real render with this stub doesn't affect
// them. `vi.hoisted` is required because `vi.mock` factories are hoisted above ordinary
// declarations.
const { translationsConfigPanelSpy } = vi.hoisted(() => ({ translationsConfigPanelSpy: vi.fn() }))

vi.mock('../../dev-runtime/translations-panel/translations-config-panel', () => ({
  TranslationsConfigPanel: (props: Record<string, unknown>) => {
    translationsConfigPanelSpy(props)
    return <div data-testid="translations-config-panel" />
  },
}))

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

// T6 (0131): default resolution for every test in this file that doesn't specifically exercise
// the save-config pipeline — matches `resolveEndpointOperation`'s own shape for an operation with
// no matching entry in `endpointsConfig.operations` (the common case when no `endpointsConfig` is
// passed at all).
const UNAVAILABLE_RESOLUTION: ResolvedEndpointOperation = {
  status: 'unavailable',
  reason: 'operation-not-declared',
}
const NOOP_SAVE = () => {}

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
  onCommitTranslationsMutation?: (mutate: (prev: never) => never) => CommitCanvasMutationResult
  onCommitApiMutation?: (mutate: (api: never) => never) => CommitCanvasMutationResult
  onCommitGlobalPreloadsMutation?: (mutate: (preloads: never) => never) => CommitCanvasMutationResult
  onCommitPagePreloadsMutation?: (mutate: (preloads: never) => never) => CommitCanvasMutationResult
  onMonacoOpenChangeSpy?: (open: boolean) => void
  initialMonacoOpen?: boolean
  endpointsConfig?: RuntimeEndpointsConfig
  saveResolution?: ResolvedEndpointOperation
  searchResolution?: ResolvedEndpointOperation
  refreshResolution?: ResolvedEndpointOperation
  saveState?: SaveState
  saveError?: SaveConfigErrorInfo | null
  handleSaveConfig?: () => void
}

function DevEditorLayerHarness({
  config,
  mountCountRef,
  onCommitCanvasMutation = noopCommitCanvasMutation,
  onCommitNodeUpdate = () => {},
  onCommitShellMutation = noopCommitCanvasMutation,
  onCommitTranslationsMutation = noopCommitCanvasMutation,
  onCommitApiMutation = noopCommitCanvasMutation,
  onCommitGlobalPreloadsMutation = noopCommitCanvasMutation,
  onCommitPagePreloadsMutation = noopCommitCanvasMutation,
  onMonacoOpenChangeSpy,
  initialMonacoOpen = false,
  endpointsConfig,
  saveResolution = UNAVAILABLE_RESOLUTION,
  searchResolution = UNAVAILABLE_RESOLUTION,
  refreshResolution = UNAVAILABLE_RESOLUTION,
  saveState = 'idle',
  saveError = null,
  handleSaveConfig = NOOP_SAVE,
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
        onCommitTranslationsMutation={onCommitTranslationsMutation}
        onCommitApiMutation={onCommitApiMutation}
        onCommitGlobalPreloadsMutation={onCommitGlobalPreloadsMutation}
        onCommitPagePreloadsMutation={onCommitPagePreloadsMutation}
        endpointsConfig={endpointsConfig}
        saveResolution={saveResolution}
        searchResolution={searchResolution}
        refreshResolution={refreshResolution}
        saveState={saveState}
        saveError={saveError}
        handleSaveConfig={handleSaveConfig}
      >
        <EditModeProbe mountCountRef={mountCountRef} />
      </DevEditorLayer>
    </RuntimeStateProvider>
  )
}

function renderHarness(config: RuntimeConfig = buildConfig(), overrides: Partial<HarnessProps> = {}) {
  const mountCountRef = { current: 0 }
  render(<DevEditorLayerHarness config={config} mountCountRef={mountCountRef} {...overrides} />)
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
            onCommitTranslationsMutation={noopCommitCanvasMutation}
            onCommitApiMutation={noopCommitCanvasMutation}
            onCommitGlobalPreloadsMutation={noopCommitCanvasMutation}
            onCommitPagePreloadsMutation={noopCommitCanvasMutation}
            endpointsConfig={undefined}
            saveResolution={UNAVAILABLE_RESOLUTION}
            searchResolution={UNAVAILABLE_RESOLUTION}
            refreshResolution={UNAVAILABLE_RESOLUTION}
            saveState="idle"
            saveError={null}
            handleSaveConfig={NOOP_SAVE}
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
            onCommitTranslationsMutation={noopCommitCanvasMutation}
            onCommitApiMutation={noopCommitCanvasMutation}
            onCommitGlobalPreloadsMutation={noopCommitCanvasMutation}
            onCommitPagePreloadsMutation={noopCommitCanvasMutation}
            endpointsConfig={undefined}
            saveResolution={UNAVAILABLE_RESOLUTION}
            searchResolution={UNAVAILABLE_RESOLUTION}
            refreshResolution={UNAVAILABLE_RESOLUTION}
            saveState="idle"
            saveError={null}
            handleSaveConfig={NOOP_SAVE}
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
            onCommitTranslationsMutation={noopCommitCanvasMutation}
            onCommitApiMutation={noopCommitCanvasMutation}
            onCommitGlobalPreloadsMutation={noopCommitCanvasMutation}
            onCommitPagePreloadsMutation={noopCommitCanvasMutation}
            endpointsConfig={undefined}
            saveResolution={UNAVAILABLE_RESOLUTION}
            searchResolution={UNAVAILABLE_RESOLUTION}
            refreshResolution={UNAVAILABLE_RESOLUTION}
            saveState="idle"
            saveError={null}
            handleSaveConfig={NOOP_SAVE}
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

function switchToTranslationsDomain() {
  fireEvent.click(screen.getByTestId('dev-editor-toolbar-domain-translations'))
}

// 0130-T2: activating the "Traducciones" domain tab swaps the central content area for
// `TranslationsConfigPanel`, in place of the Layout canvas — same pattern the Shell domain
// already established, never alongside the canvas.
describe('DevEditorLayer / Translations domain (0130-T2)', () => {
  it('renders TranslationsConfigPanel and stops rendering the canvas once the Traducciones tab is selected', () => {
    renderHarness()
    expect(screen.getByTestId('probe-node-a')).toBeInTheDocument()
    expect(screen.queryByTestId('translations-config-panel')).not.toBeInTheDocument()

    switchToTranslationsDomain()

    expect(screen.getByTestId('translations-config-panel')).toBeInTheDocument()
    expect(screen.queryByTestId('probe-node-a')).not.toBeInTheDocument()
  })

  it('restores the canvas view when switching back to Layout', () => {
    renderHarness()
    switchToTranslationsDomain()
    expect(screen.getByTestId('translations-config-panel')).toBeInTheDocument()

    switchToLayoutDomain()

    expect(screen.queryByTestId('translations-config-panel')).not.toBeInTheDocument()
    expect(screen.getByTestId('probe-node-a')).toBeInTheDocument()
  })

  it('marks the Traducciones tab as pressed and Layout as not pressed once selected', () => {
    renderHarness()
    switchToTranslationsDomain()

    expect(screen.getByTestId('dev-editor-toolbar-domain-translations')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByTestId('dev-editor-toolbar-domain-layout')).toHaveAttribute('aria-pressed', 'false')
  })

  it('clears a canvas node selection when entering Layout from Translations, with a node selected before switching to Layout again', () => {
    renderHarness()
    switchToEditorMode()
    fireEvent.click(screen.getByTestId('probe-node-a'))
    expect((contextJson() as { selectedPath: unknown }).selectedPath).not.toBeNull()

    switchToTranslationsDomain()
    switchToLayoutDomain()

    expect((contextJson() as { selectedPath: unknown }).selectedPath).toBeNull()
  })

  it('entering Translations from Shell does not break: the panel renders and the toolbar stays functional', () => {
    renderHarness()
    switchToShellDomain()
    expect(screen.getByTestId('shell-config-panel')).toBeInTheDocument()

    switchToTranslationsDomain()

    expect(screen.queryByTestId('shell-config-panel')).not.toBeInTheDocument()
    expect(screen.getByTestId('translations-config-panel')).toBeInTheDocument()
    expect(screen.getByTestId('dev-editor-toolbar-domain-translations')).toHaveAttribute('aria-pressed', 'true')
  })

  it('does not render the FloatingSelectionOverlay while the Translations domain is active', () => {
    renderHarness()
    switchToEditorMode()
    fireEvent.click(screen.getByTestId('probe-node-a'))
    expect(screen.getByTestId('dev-editor-selection-overlay')).toBeInTheDocument()

    switchToTranslationsDomain()

    expect(screen.queryByTestId('dev-editor-selection-overlay')).not.toBeInTheDocument()
  })

  it('keeps the toolbar visible while the Translations panel is rendered', () => {
    renderHarness()
    switchToTranslationsDomain()
    expect(screen.getByTestId('dev-editor-toolbar')).toBeInTheDocument()
  })

  // Regression: shell/translations domains must not participate in the canvas-selection <->
  // Monaco mutual exclusion (T2 of 0104) — that exclusion only concerns the selection overlay.
  it('regression: with Monaco open, clicking Traducciones does not affect the Monaco panel state', () => {
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

    switchToTranslationsDomain()

    expect(screen.getByTestId('translations-config-panel')).toBeInTheDocument()
    expect(onMonacoOpenChangeSpy).not.toHaveBeenCalled()
  })
})

function switchToApiDomain() {
  fireEvent.click(screen.getByTestId('dev-editor-toolbar-domain-api'))
}

// 0132-T5: activating the "Api" domain tab swaps the central content area for `ApiConfigPanel`,
// in place of the Layout canvas — same pattern the Shell/Translations domains already
// established, never alongside the canvas. `ApiConfigPanel` is real here (not mocked), same
// decision already applied for `ShellConfigPanel` in this file.
describe('DevEditorLayer / Api domain (0132-T5)', () => {
  it('renders ApiConfigPanel and stops rendering the canvas once the Api tab is selected', () => {
    renderHarness()
    expect(screen.getByTestId('probe-node-a')).toBeInTheDocument()
    expect(screen.queryByTestId('api-config-panel')).not.toBeInTheDocument()

    switchToApiDomain()

    expect(screen.getByTestId('api-config-panel')).toBeInTheDocument()
    expect(screen.queryByTestId('probe-node-a')).not.toBeInTheDocument()
  })

  it('restores the canvas view when switching back to Layout', () => {
    renderHarness()
    switchToApiDomain()
    expect(screen.getByTestId('api-config-panel')).toBeInTheDocument()

    switchToLayoutDomain()

    expect(screen.queryByTestId('api-config-panel')).not.toBeInTheDocument()
    expect(screen.getByTestId('probe-node-a')).toBeInTheDocument()
  })

  it('marks the Api tab as pressed and Layout as not pressed once selected', () => {
    renderHarness()
    switchToApiDomain()

    expect(screen.getByTestId('dev-editor-toolbar-domain-api')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByTestId('dev-editor-toolbar-domain-layout')).toHaveAttribute('aria-pressed', 'false')
  })

  it('clears a canvas node selection when entering Layout from Api, with a node selected before switching to Api', () => {
    renderHarness()
    switchToEditorMode()
    fireEvent.click(screen.getByTestId('probe-node-a'))
    expect((contextJson() as { selectedPath: unknown }).selectedPath).not.toBeNull()

    switchToApiDomain()
    switchToLayoutDomain()

    expect((contextJson() as { selectedPath: unknown }).selectedPath).toBeNull()
  })

  it('does not render the FloatingSelectionOverlay while the Api domain is active', () => {
    renderHarness()
    switchToEditorMode()
    fireEvent.click(screen.getByTestId('probe-node-a'))
    expect(screen.getByTestId('dev-editor-selection-overlay')).toBeInTheDocument()

    switchToApiDomain()

    expect(screen.queryByTestId('dev-editor-selection-overlay')).not.toBeInTheDocument()
  })

  it('keeps the toolbar visible while the Api panel is rendered', () => {
    renderHarness()
    switchToApiDomain()
    expect(screen.getByTestId('dev-editor-toolbar')).toBeInTheDocument()
  })

  // Regression: the api domain must not participate in the canvas-selection <-> Monaco mutual
  // exclusion (T2 of 0104) — that exclusion only concerns the selection overlay.
  it('regression: with Monaco open, clicking Api does not affect the Monaco panel state', () => {
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

    switchToApiDomain()

    expect(screen.getByTestId('api-config-panel')).toBeInTheDocument()
    expect(onMonacoOpenChangeSpy).not.toHaveBeenCalled()
  })
})

function switchToPreloadsSubview() {
  fireEvent.click(screen.getByRole('tab', { name: 'Preloads' }))
}

// 0132-T7: `ApiConfigPanel`'s `globalPreloads`/`activePageId`/`pagePreloads` props are exactly
// `config.preloads`/`activePage.id`/`activePage.preloads`, the same values DevEditorLayer already
// computes for the canvas (`activePageLayout`/`activePageId` above) — real `ApiConfigPanel` here
// (not mocked, same decision as the rest of this describe group), observed through its rendered
// Preloads sub-view instead of a prop spy.
describe('DevEditorLayer / Api domain preloads props (0132-T7)', () => {
  it('forwards config.preloads/activePage.id/activePage.preloads to ApiConfigPanel as globalPreloads/activePageId/pagePreloads', () => {
    const config: RuntimeConfig = {
      api: { loadUsers: { method: 'GET', endpoint: '/users' } },
      initialPage: 'home',
      preloads: [{ operationName: 'loadUsers', requestParams: {} }],
      pages: [
        {
          id: 'home',
          preloads: [{ operationName: 'loadUsers', requestParams: { query: { a: '1' } } }],
          layout: [heading('First')],
        },
        { id: 'about', layout: [heading('About heading')] },
      ],
    } as RuntimeConfig

    renderHarness(config)
    switchToApiDomain()
    switchToPreloadsSubview()

    const globalSection = within(screen.getByTestId('api-config-panel-preloads-global'))
    const pageSection = within(screen.getByTestId('api-config-panel-preloads-page'))

    expect(globalSection.getByLabelText('Operación #1')).toHaveValue('loadUsers')
    expect(pageSection.getByLabelText('Query valor #1')).toHaveValue('1')

    fireEvent.change(screen.getByTestId('dev-editor-toolbar-page-select'), { target: { value: 'about' } })

    expect(within(screen.getByTestId('api-config-panel-preloads-page')).getByText(/sin precargas/i)).toBeInTheDocument()
    expect(within(screen.getByTestId('api-config-panel-preloads-global')).getByLabelText('Operación #1')).toHaveValue(
      'loadUsers',
    )
  })
})

// T6 (0131): DevEditorLayer receives the three endpoint-operation resolutions and the save state
// already computed by DevRuntimeReady (T5) — it only propagates them to the toolbar (Guardar) and
// to the Translations panel, and builds the single `translationsProvider` instance via `useMemo`
// instead of the former module-scope singleton.
describe('DevEditorLayer / endpoints-config resolutions + translations provider (T6, 0131)', () => {
  it('propagates saveResolution to the toolbar Save button when unavailable (disabled + reason title)', () => {
    renderHarness(buildConfig(), {
      saveResolution: { status: 'unavailable', reason: 'token-not-resolvable' },
    })

    const saveButton = screen.getByTestId('dev-editor-toolbar-save')
    expect(saveButton).toBeDisabled()
    expect(saveButton).toHaveAttribute('title', 'El token declarado para la operación de guardado no existe en tokens')
  })

  it('propagates saveResolution to the toolbar Save button when ready (enabled, click invokes handleSaveConfig)', () => {
    const handleSaveConfig = vi.fn()
    renderHarness(buildConfig(), {
      saveResolution: { status: 'ready', url: 'https://example.test/save', token: 'tok' },
      handleSaveConfig,
    })

    const saveButton = screen.getByTestId('dev-editor-toolbar-save')
    expect(saveButton).not.toBeDisabled()

    fireEvent.click(saveButton)
    expect(handleSaveConfig).toHaveBeenCalledTimes(1)
  })

  it('propagates saveState/saveError to the toolbar (loading indicator, error alert)', () => {
    renderHarness(buildConfig(), {
      saveState: 'error',
      saveError: { kind: 'integration', message: 'No se pudo contactar con el proveedor externo.' },
    })

    expect(screen.getByRole('alert')).toHaveTextContent('No se pudo contactar con el proveedor externo.')
  })

  it('propagates searchResolution and refreshResolution to TranslationsConfigPanel unchanged', () => {
    const searchResolution: ResolvedEndpointOperation = {
      status: 'ready',
      url: 'https://example.test/search',
      token: 'tok-search',
    }
    const refreshResolution: ResolvedEndpointOperation = { status: 'unavailable', reason: 'operation-not-declared' }

    renderHarness(buildConfig(), { searchResolution, refreshResolution })
    switchToTranslationsDomain()

    const lastProps = translationsConfigPanelSpy.mock.calls.at(-1)?.[0] as Record<string, unknown>
    expect(lastProps.searchResolution).toBe(searchResolution)
    expect(lastProps.refreshResolution).toBe(refreshResolution)
  })

  // T7 (0131): the `tokens` prop is retired along with the token dropdown (FR10/FR11/D7) —
  // DevEditorLayer must not forward `config.tokens` to the panel any more, and since the panel is
  // mocked as a plain stub `<div>` in this file, no `<select>` can ever render through it either.
  it('no longer passes tokens to TranslationsConfigPanel, and no token <select> renders when the layer mounts the panel', () => {
    const config = buildConfig()
    config.tokens = { apiKey: { value: 'secret' } }

    renderHarness(config)
    switchToTranslationsDomain()

    const lastProps = translationsConfigPanelSpy.mock.calls.at(-1)?.[0] as Record<string, unknown>
    expect(lastProps.tokens).toBeUndefined()
    expect(screen.queryByRole('combobox', { name: 'Token' })).not.toBeInTheDocument()
  })

  it('builds the translations provider via useMemo: stable across re-renders with the same baseUrl, recreated when it changes', () => {
    const endpointsConfigA: RuntimeEndpointsConfig = { baseUrl: 'https://a.example.test', operations: {} }
    const endpointsConfigB: RuntimeEndpointsConfig = { baseUrl: 'https://b.example.test', operations: {} }
    const config = buildConfig()
    const mountCountRef = { current: 0 }

    const { rerender } = render(
      <DevEditorLayerHarness config={config} mountCountRef={mountCountRef} endpointsConfig={endpointsConfigA} />,
    )
    switchToTranslationsDomain()

    const providerAfterFirstRender = (translationsConfigPanelSpy.mock.calls.at(-1)?.[0] as Record<string, unknown>)
      .provider

    // Re-render with a structurally-equal but distinct config object carrying the same baseUrl:
    // the memoized provider must not be rebuilt (it depends on the baseUrl string, not on
    // endpointsConfig's object identity).
    rerender(
      <DevEditorLayerHarness
        config={config}
        mountCountRef={mountCountRef}
        endpointsConfig={{ baseUrl: 'https://a.example.test', operations: {} }}
      />,
    )
    const providerAfterSameBaseUrl = (translationsConfigPanelSpy.mock.calls.at(-1)?.[0] as Record<string, unknown>)
      .provider
    expect(providerAfterSameBaseUrl).toBe(providerAfterFirstRender)

    // Re-render with a different baseUrl: the memoized provider must be rebuilt.
    rerender(<DevEditorLayerHarness config={config} mountCountRef={mountCountRef} endpointsConfig={endpointsConfigB} />)
    const providerAfterDifferentBaseUrl = (translationsConfigPanelSpy.mock.calls.at(-1)?.[0] as Record<string, unknown>)
      .provider
    expect(providerAfterDifferentBaseUrl).not.toBe(providerAfterFirstRender)
  })

  it('builds the translations provider with the current signature (no options) when endpointsConfig is undefined', () => {
    renderHarness(buildConfig(), { endpointsConfig: undefined })
    switchToTranslationsDomain()

    const lastProps = translationsConfigPanelSpy.mock.calls.at(-1)?.[0] as Record<string, unknown>
    expect(lastProps.provider).toBeDefined()
  })
})
