import { useEffect, useState, type ReactNode } from 'react'
import type { LayoutNode, LayoutNodeType, RuntimeConfigError } from '../../config/runtime-config'
import { LayoutEditModeProvider } from '../../runtime/layout-edit-mode-context'
import { getNodeAtPath, serializeLayoutNodePath, type LayoutNodePath } from '../../runtime/layout-node-path'
import {
  useRuntimeConfig,
  useRuntimeCurrentPage,
  useRuntimeStateActions,
} from '../../runtime/runtime-state/runtime-state-provider'
import { findNodePath, insertNodeAt, movePathTo, removeNodeAt } from '../layout-tree-mutations'
import { LayoutCanvasDndContext, type LayoutCanvasDropAttempt } from '../layout-canvas/layout-canvas-dnd-context'
import { isValidDropTarget } from '../layout-canvas/layout-drop-validity'
import { buildDefaultNodeInstance } from '../layout-canvas/layout-canvas-node-palette-defaults'
import type { CommitCanvasMutationResult } from '../layout-canvas/layout-canvas-commit'
import { DevEditorFloatingToolbar } from './dev-editor-floating-toolbar'
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
  onCommitNodeUpdate: (path: LayoutNodePath, updater: (node: LayoutNode) => LayoutNode) => void
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
  children,
}: DevEditorLayerProps) {
  const [selectedPath, setSelectedPath] = useState<LayoutNodePath | null>(null)
  const [hoveredPath, setHoveredPath] = useState<LayoutNodePath | null>(null)

  // Read here, outside LayoutEditModeProvider (mounted further down this same component),
  // so navigateToPage is the real one — not the no-op useRuntimeStateActions() returns when
  // called from a descendant of a LayoutEditModeProvider with `active: true` (T1/Decisión 3).
  // The page selector must navigate for real in any mode (spec FR2).
  const { navigateToPage } = useRuntimeStateActions()
  const activePage = useRuntimeCurrentPage()
  const config = useRuntimeConfig()

  const activePageLayout = activePage?.layout ?? EMPTY_LAYOUT
  const activePageId = activePage?.id ?? config.initialPage

  // Edge case: navigating to a different page clears the selection — a selected node from a
  // different page has no meaning on the new page (spec FR15).
  useEffect(() => {
    setSelectedPath(null)
    setHoveredPath(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePage?.id])

  // Edge case: a config change (canvas commit or Monaco Aplicar) may remove the selected node.
  // Degrade the selection safely instead of pointing at a path that no longer resolves — same
  // guard LayoutCanvas already applied before this task.
  useEffect(() => {
    if (selectedPath === null) return
    if (getNodeAtPath(activePageLayout, selectedPath) === null) {
      setSelectedPath(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePageLayout])

  const selectedNode = selectedPath !== null ? getNodeAtPath(activePageLayout, selectedPath) : null

  function handleModeChange(nextMode: DevEditorMode) {
    // Deliberately does not clear selectedPath (design.md Decisión 5): with the provider
    // permanently mounted, the selection is still valid when switching back to Editor on the
    // same page, so there is nothing to reconcile.
    onModeChange(nextMode)
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

  // Same delete logic LayoutCanvas.handleDeleteSelectedNode used (0102 T16), reused as-is.
  function handleDeleteSelectedNode() {
    if (selectedPath === null) return

    const result = onCommitCanvasMutation((pageLayout) => removeNodeAt(pageLayout, selectedPath))
    if (result.status !== 'applied') return

    setSelectedPath(null)
    setHoveredPath(null)
  }

  return (
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
              ? { active: true, selectedPath, hoveredPath, onSelectNode: setSelectedPath, onHoverNode: setHoveredPath }
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
          onSelectNode={setSelectedPath}
          onCommitNodeUpdate={onCommitNodeUpdate}
          onDeleteNode={handleDeleteSelectedNode}
        />
      )}

      <DevEditorFloatingToolbar
        mode={mode}
        onModeChange={handleModeChange}
        pages={config.pages}
        activePageId={activePageId}
        onActivePageIdChange={(pageId) => navigateToPage(pageId)}
        activeDomain="layout"
        onOpenMonaco={() => onMonacoOpenChange(true)}
        isMonacoOpen={monacoOpen}
        onOpenPalette={() => onPaletteOpenChange(!paletteOpen)}
        isPaletteOpen={paletteOpen}
      />
    </>
  )
}
