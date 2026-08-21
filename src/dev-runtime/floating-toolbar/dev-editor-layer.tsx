import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { LayoutNode, LayoutNodeType, RuntimeConfigError } from '../../config/runtime-config'
import type {
  RuntimeApiConfig,
  RuntimePreloadConfig,
  RuntimeTranslationsConfig,
  ShellConfig,
} from '../../config/runtime-config-types'
import { LayoutEditModeProvider } from '../../runtime/layout-edit-mode-context'
import {
  getNodeAtPath,
  pathEndsAtTableCell,
  serializeLayoutNodePath,
  type LayoutNodePath,
} from '../../runtime/layout-node-path'
import { useRuntimeConfig, useRuntimeCurrentPage, useRuntimeStateActions } from '../../runtime/runtime-state/use-runtime-state'
import { findNodePath, insertNodeAt, movePathTo, removeNodeAt, replaceNodeAt } from '../layout-tree-mutations'
import { LayoutCanvasDndContext, type LayoutCanvasDropAttempt } from '../layout-canvas/layout-canvas-dnd-context'
import { isValidDropTarget } from '../layout-canvas/layout-drop-validity'
import {
  buildDefaultNodeInstance,
  EMPTY_DYNAMIC_TABLE_CELL_TEXT_VALUE,
  EMPTY_TABLE_CELL_TEXT_VALUE,
} from '../layout-canvas/layout-canvas-node-palette-defaults'
import type { CommitCanvasMutationResult } from '../layout-canvas/layout-canvas-commit'
import type { ResolvedEndpointOperation } from '../endpoints-config/resolve-endpoint-operation'
import type { RuntimeEndpointsConfig } from '../endpoints-config/runtime-endpoints-config-schema'
import { ApiConfigPanel } from '../api-config-panel/api-config-panel'
import { ShellConfigPanel } from '../shell-config-panel/shell-config-panel'
import { TranslationsConfigPanel } from '../translations-panel/translations-config-panel'
import { createPlatagesTranslationsProvider } from '../translations-panel/translations-provider'
import {
  DevEditorFloatingToolbar,
  type SaveConfigErrorInfo,
  type SaveState,
  type ToolbarDomain,
} from './dev-editor-floating-toolbar'
import { FloatingNodePalette } from './floating-node-palette'
import { FloatingSelectionOverlay } from './floating-selection-overlay'

type DevEditorMode = 'visual' | 'editor'

// Same shape FloatingMonacoPanel (T7) expects, threaded through here for prop-contract
// symmetry with the rest of DevRuntimeReady's callback wiring. FloatingMonacoPanel itself is
// NOT rendered by this component: it lives outside RuntimeStateProvider in DevRuntimeReady
// (T8/design.md Decisión 7), since it doesn't need to consume runtime state.
interface DevEditorLayerMonacoProps {
  editorBuffer: string | null
  onEditorChange: (value: string) => void
  onApply: () => void
  onCopy: () => void
  pendingChanges: boolean
  errors: RuntimeConfigError | { code: string; message: string } | null
}

interface DevEditorLayerProps {
  mode: DevEditorMode
  onModeChange: (mode: DevEditorMode) => void
  paletteOpen: boolean
  onPaletteOpenChange: (open: boolean) => void
  monacoOpen: boolean
  onMonacoOpenChange: (open: boolean) => void
  monaco: DevEditorLayerMonacoProps
  onCommitCanvasMutation: (mutate: (pageLayout: LayoutNode[]) => LayoutNode[]) => CommitCanvasMutationResult
  onCommitNodeUpdate: (
    path: LayoutNodePath,
    updater: (node: LayoutNode) => LayoutNode,
  ) => CommitCanvasMutationResult
  onCommitShellMutation: (
    mutate: (shell: ShellConfig | undefined) => ShellConfig | undefined,
  ) => CommitCanvasMutationResult
  onCommitTranslationsMutation: (
    mutate: (prev: RuntimeTranslationsConfig | undefined) => RuntimeTranslationsConfig | undefined,
  ) => CommitCanvasMutationResult
  onCommitApiMutation: (mutate: (api: RuntimeApiConfig) => RuntimeApiConfig) => CommitCanvasMutationResult
  onCommitGlobalPreloadsMutation: (
    mutate: (preloads: RuntimePreloadConfig[] | undefined) => RuntimePreloadConfig[] | undefined,
  ) => CommitCanvasMutationResult
  onCommitPagePreloadsMutation: (
    mutate: (preloads: RuntimePreloadConfig[] | undefined) => RuntimePreloadConfig[] | undefined,
  ) => CommitCanvasMutationResult
  // T6 (0131): all computed once by DevRuntimeReady (T5/D7) and threaded through here unchanged —
  // this component never recalculates a resolution nor tracks its own save state.
  endpointsConfig: RuntimeEndpointsConfig | undefined
  saveResolution: ResolvedEndpointOperation
  searchResolution: ResolvedEndpointOperation
  refreshResolution: ResolvedEndpointOperation
  saveState: SaveState
  saveError: SaveConfigErrorInfo | null
  handleSaveConfig: () => void
  children: ReactNode
}

// Mutable (not `readonly`) so it structurally matches `Page['layout']` and can flow unchanged
// into `onCommitCanvasMutation`'s `(pageLayout: LayoutNode[]) => LayoutNode[]` mutate callback
// — it is only ever read, never pushed to.
const EMPTY_LAYOUT: LayoutNode[] = []

/**
 * Mounted inside DevRuntimeReady's single RuntimeStateProvider (design.md Decisión 1/2 de
 * 0103): wraps the real `<RuntimePage />` permanently with LayoutEditModeProvider and
 * LayoutCanvasDndContext instead of LayoutCanvas's own isolated preview tree, so there is a
 * single render tree for both navigation and visual editing. Only the provider's `value`
 * changes between Visual (`{ active: false }`) and Editor (`{ active: true, ... }` with the
 * live selection state) — the wrapper itself never unmounts, so switching modes never remounts
 * `<RuntimePage />` nor any node underneath it (design.md Decisión 9).
 */
export function DevEditorLayer({
  mode,
  onModeChange,
  paletteOpen,
  onPaletteOpenChange,
  monacoOpen,
  onMonacoOpenChange,
  onCommitCanvasMutation,
  onCommitNodeUpdate,
  onCommitShellMutation,
  onCommitTranslationsMutation,
  onCommitApiMutation,
  onCommitGlobalPreloadsMutation,
  onCommitPagePreloadsMutation,
  endpointsConfig,
  saveResolution,
  searchResolution,
  refreshResolution,
  saveState,
  saveError,
  handleSaveConfig,
  children,
}: DevEditorLayerProps) {
  const [selectedPath, setSelectedPath] = useState<LayoutNodePath | null>(null)
  const [hoveredPath, setHoveredPath] = useState<LayoutNodePath | null>(null)
  // Domain tab (0122-T5): "layout" renders the canvas (default), "shell" swaps the central
  // content area for `ShellConfigPanel`. `api`/`pages`/`tokens` stay disabled in the toolbar, so
  // this type only needs to track the two domains that are actually selectable.
  const [activeDomain, setActiveDomain] = useState<ToolbarDomain>('layout')

  // Read here, outside LayoutEditModeProvider (mounted further down this same component),
  // so navigateToPage is the real one — not the no-op useRuntimeStateActions() returns when
  // called from a descendant of a LayoutEditModeProvider with `active: true` (T1/Decisión 3).
  // The page selector must navigate for real in any mode (spec FR2).
  const { navigateToPage } = useRuntimeStateActions()
  const activePage = useRuntimeCurrentPage()
  const config = useRuntimeConfig()

  const activePageLayout = activePage?.layout ?? EMPTY_LAYOUT
  const activePageId = activePage?.id ?? config.initialPage

  // Single real `TranslationsProvider` instance (T6, 0131 — replaces the former module-scope
  // singleton from 0130-T4): memoized by `endpointsConfig?.baseUrl` only, not by the whole
  // `endpointsConfig` object nor by `currentConfig.tokens`, so it stays stable across renders that
  // don't change the base URL and in practice settles right after bootstrap. Built unconditionally
  // (never `undefined`) — when `baseUrl` isn't declared, `createPlatagesTranslationsProvider` is
  // called with no options, its current signature (unchanged by this task, see T3).
  const endpointsBaseUrl = endpointsConfig?.baseUrl
  const translationsProvider = useMemo(
    () =>
      endpointsBaseUrl
        ? createPlatagesTranslationsProvider({ baseUrl: endpointsBaseUrl })
        : createPlatagesTranslationsProvider(),
    [endpointsBaseUrl],
  )

  // Edge case: navigating to a different page clears the selection — a selected node from a
  // different page has no meaning on the new page (spec FR15). Adjusted during render (the
  // React-documented "adjust state when a prop changes" pattern) rather than in an effect:
  // tracking the previous page id in state lets us detect the transition without an effect,
  // and the guard below only fires once per actual change so it cannot loop.
  const [prevActivePageId, setPrevActivePageId] = useState(activePage?.id)
  if (activePage?.id !== prevActivePageId) {
    setPrevActivePageId(activePage?.id)
    setSelectedPath(null)
    setHoveredPath(null)
  }

  // Edge case: a config change (canvas commit or Monaco Aplicar) may remove the selected node.
  // Degrade the selection safely instead of pointing at a path that no longer resolves — same
  // guard LayoutCanvas already applied before this task. Same render-time adjustment pattern
  // as above, keyed off the layout array reference instead of the page id.
  const [prevActivePageLayout, setPrevActivePageLayout] = useState(activePageLayout)
  if (activePageLayout !== prevActivePageLayout) {
    setPrevActivePageLayout(activePageLayout)
    if (selectedPath !== null && getNodeAtPath(activePageLayout, selectedPath) === null) {
      setSelectedPath(null)
    }
  }

  const selectedNode = selectedPath !== null ? getNodeAtPath(activePageLayout, selectedPath) : null

  // T3: `Esc` closes the selection panel when Monaco is closed, same effect as the panel's own
  // close button (T1). This listener is independent from the Monaco `Esc` listener in
  // dev-runtime.tsx: when Monaco is open, the guard below is false and this effect does
  // nothing, leaving that listener as the sole handler for Monaco's own close-on-Esc behavior.
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && selectedPath !== null && !monacoOpen) {
        setSelectedPath(null)
        setHoveredPath(null)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [selectedPath, monacoOpen])

  function handleModeChange(nextMode: DevEditorMode) {
    // Deliberately does not clear selectedPath (design.md Decisión 5): with the provider
    // permanently mounted, the selection is still valid when switching back to Editor on the
    // same page, so there is nothing to reconcile.
    onModeChange(nextMode)
  }

  // Mutual exclusion between the selection panel and the Monaco panel (T2): the right side of
  // the screen shows at most one of the two at a time. Selecting a node while Monaco is open
  // closes Monaco; opening Monaco while a node is selected clears the selection. Both setters
  // below run in the same handler invocation, so React 18's automatic batching coalesces them
  // into a single commit without needing flushSync.
  function handleSelectNode(path: LayoutNodePath | null) {
    if (path !== null && monacoOpen) {
      onMonacoOpenChange(false)
    }
    setSelectedPath(path)
  }

  function handleOpenMonaco() {
    setSelectedPath(null)
    setHoveredPath(null)
    onMonacoOpenChange(true)
  }

  // Entering "shell", "translations" or "api" clears the canvas selection (same policy already
  // documented for pages/tokens once they become selectable too): neither panel uses the
  // "selected canvas node" model at all, so a selection carried over from Layout would just be
  // stale state pointing at a hidden tree. Leaving any of these domains back to "layout" has
  // nothing else to reconcile — each panel's own local state lives inside itself and fully
  // unmounts whenever `activeDomain` moves away from it, so there is no residue to clear
  // explicitly.
  function handleDomainSelected(domain: ToolbarDomain) {
    if (domain === activeDomain) return
    setActiveDomain(domain)
    if (domain === 'shell' || domain === 'translations' || domain === 'api') {
      setSelectedPath(null)
      setHoveredPath(null)
    }
  }

  // Same drop-commit logic LayoutCanvas.handleDropAttempt used (0102 T14/T15), reused as-is:
  // onDropAttempt (raw) always fires first, isValidDropTarget gates whether a commit can ever
  // happen, and a successful move of the selected node re-resolves its new path afterwards.
  function handleDropAttempt(attempt: LayoutCanvasDropAttempt) {
    const { draggedPath, draggedNodeType, targetParentPath, targetIndex, targetTabItemIndex } = attempt

    const isStructurallyValid = isValidDropTarget(activePageLayout, draggedPath, targetParentPath, targetIndex, {
      targetTabItemIndex,
      draggedNodeType,
    })
    if (!isStructurallyValid) return

    if (draggedPath === null) {
      // Palette-originated insert: isValidDropTarget above only returns true for a
      // draggedPath: null attempt when it could resolve a synthetic node from
      // draggedNodeType, so draggedNodeType is guaranteed defined here.
      const nodeType = draggedNodeType as LayoutNodeType
      onCommitCanvasMutation((pageLayout) =>
        insertNodeAt(pageLayout, targetParentPath, targetIndex, buildDefaultNodeInstance(nodeType), {
          tabItemIndex: targetTabItemIndex,
        }),
      )
      return
    }

    const applyMove = (pageLayout: LayoutNode[]) =>
      movePathTo(pageLayout, draggedPath, targetParentPath, targetIndex, {
        toTabItemIndex: targetTabItemIndex,
      })

    const result = onCommitCanvasMutation(applyMove)
    if (result.status !== 'applied') return

    const draggedNodeWasSelected =
      selectedPath !== null && serializeLayoutNodePath(selectedPath) === serializeLayoutNodePath(draggedPath)
    if (!draggedNodeWasSelected || selectedNode === null) return

    const mutatedLayout = applyMove(activePageLayout)
    const newSelectedPath = findNodePath(mutatedLayout, selectedNode)
    if (newSelectedPath !== null) setSelectedPath(newSelectedPath)
  }

  // Same delete logic LayoutCanvas.handleDeleteSelectedNode used (0102 T16), except when the
  // selection is a table cell-node (T5, 0138, D6): removing it from `props.rows`/
  // `props.rows.cells` would shift every remaining cell out of alignment with `headers` and its
  // sibling cells, so a cell-node is instead reverted in place to its empty-text literal — `''`
  // for manual mode (`row` step) or `'—'` for dynamic mode (`cells` step), since
  // `validateTableDynamicRows` rejects `''` for a dynamic-mode cell (see
  // layout-canvas-node-palette-defaults.ts).
  function handleDeleteSelectedNode() {
    if (selectedPath === null) return

    const result = pathEndsAtTableCell(selectedPath)
      ? onCommitCanvasMutation((pageLayout) => {
          const lastStep = selectedPath[selectedPath.length - 1]
          return replaceNodeAt(
            pageLayout,
            selectedPath,
            () =>
              (lastStep.field === 'row'
                ? EMPTY_TABLE_CELL_TEXT_VALUE
                : EMPTY_DYNAMIC_TABLE_CELL_TEXT_VALUE) as unknown as LayoutNode,
          )
        })
      : onCommitCanvasMutation((pageLayout) => removeNodeAt(pageLayout, selectedPath))
    if (result.status !== 'applied') return

    setSelectedPath(null)
    setHoveredPath(null)
  }

  return (
    <>
      {activeDomain === 'layout' ? (
        <>
          {/* dnd-kit does not support dragging across sibling DndContext instances, so the
              palette (T6) lives inside this same context (design.md Decisión 7). Always mounted:
              useDraggable/useDroppable inside layout-node-renderer.tsx/layout-renderer.tsx are
              already gated on editModeContext !== null, so nothing drags in Visual mode even
              though the DndContext itself is present. */}
          <LayoutCanvasDndContext pageLayout={activePageLayout} onDropAttempt={handleDropAttempt}>
            <LayoutEditModeProvider
              value={
                mode === 'editor'
                  ? { active: true, selectedPath, hoveredPath, onSelectNode: handleSelectNode, onHoverNode: setHoveredPath }
                  : { active: false }
              }
            >
              {children}
            </LayoutEditModeProvider>
            {paletteOpen && <FloatingNodePalette open={true} onClose={() => onPaletteOpenChange(false)} />}
          </LayoutCanvasDndContext>

          {mode === 'editor' && (
            <FloatingSelectionOverlay
              pageLayout={activePageLayout}
              selectedPath={selectedPath}
              onSelectNode={handleSelectNode}
              onCommitNodeUpdate={onCommitNodeUpdate}
              onDeleteNode={handleDeleteSelectedNode}
            />
          )}
        </>
      ) : activeDomain === 'shell' ? (
        <ShellConfigPanel shell={config.shell} onCommitShellMutation={onCommitShellMutation} />
      ) : activeDomain === 'api' ? (
        <ApiConfigPanel
          api={config.api}
          onCommitApiMutation={onCommitApiMutation}
          globalPreloads={config.preloads}
          activePageId={activePageId}
          pagePreloads={activePage?.preloads}
          onCommitGlobalPreloadsMutation={onCommitGlobalPreloadsMutation}
          onCommitPagePreloadsMutation={onCommitPagePreloadsMutation}
        />
      ) : (
        <TranslationsConfigPanel
          translations={config.translations}
          onCommitTranslationsMutation={onCommitTranslationsMutation}
          provider={translationsProvider}
          searchResolution={searchResolution}
          refreshResolution={refreshResolution}
        />
      )}

      <DevEditorFloatingToolbar
        mode={mode}
        onModeChange={handleModeChange}
        pages={config.pages}
        activePageId={activePageId}
        onActivePageIdChange={(pageId) => navigateToPage(pageId)}
        activeDomain={activeDomain}
        onDomainSelected={handleDomainSelected}
        onOpenMonaco={handleOpenMonaco}
        isMonacoOpen={monacoOpen}
        onOpenPalette={() => onPaletteOpenChange(!paletteOpen)}
        isPaletteOpen={paletteOpen}
        saveResolution={saveResolution}
        saveState={saveState}
        saveError={saveError}
        onSave={handleSaveConfig}
      />
    </>
  )
}
