import { useEffect, useState } from 'react'
import type { LayoutNode, LayoutNodeType, RuntimeConfig } from '../../config/runtime-config'
import { LayoutEditModeProvider } from '../../runtime/layout-edit-mode-context'
import { LayoutRenderer } from '../../runtime/layout-renderer'
import { getNodeAtPath, serializeLayoutNodePath, type LayoutNodePath } from '../../runtime/layout-node-path'
import { RuntimeStateProvider } from '../../runtime/runtime-state/runtime-state-provider'
import { findNodePath, insertNodeAt, movePathTo, removeNodeAt } from '../layout-tree-mutations'
import { LayoutCanvasBreadcrumb } from './layout-canvas-breadcrumb'
import type { CommitCanvasMutationResult } from './layout-canvas-commit'
import { LayoutCanvasDndContext, type LayoutCanvasDropAttempt } from './layout-canvas-dnd-context'
import { isValidDropTarget } from './layout-drop-validity'
import { buildDefaultNodeInstance } from './layout-canvas-node-palette-defaults'
import { LayoutCanvasNodePalette } from './layout-canvas-node-palette'
import { LayoutCanvasPropertiesPanel } from './layout-canvas-properties-panel'

interface LayoutCanvasProps {
  config: RuntimeConfig
  activePageId: string
  onActivePageIdChange: (id: string) => void
  onCommitNodeUpdate?: (path: LayoutNodePath, updater: (node: LayoutNode) => LayoutNode) => void
  // Raw drop intent from the T12 dnd wiring — validity (T13) and commit (T14/T15) are not
  // decided here; LayoutCanvas only threads the callback through.
  onDropAttempt?: (attempt: LayoutCanvasDropAttempt) => void
  // T14: performs the actual structural mutation (T3's `movePathTo`) through the T4 commit
  // pipeline once a drop attempt is confirmed structurally valid (T13's `isValidDropTarget`).
  // Optional — same optional-callback convention `LayoutCanvasDndContext` already uses for
  // `onDragOverAttempt` — so callers that don't need drag commits (a read-only canvas, or the
  // T12/T13 wiring tests that only assert the raw `onDropAttempt` callback) don't have to wire
  // it. This is deliberately the *same* function DevRuntimeReady exposes as
  // `commitCanvasMutation` (T4) via its ref handle — no second commit mechanism.
  onCommitCanvasMutation?: (mutate: (pageLayout: LayoutNode[]) => LayoutNode[]) => CommitCanvasMutationResult
}

// Stable default so callers that don't need canvas edits (existing shell/breadcrumb
// tests, callers that only render a read-only canvas) don't have to pass a prop —
// see react-best-practices.md 4.5 for why this must be a module constant, not an
// inline arrow, to avoid defeating memoization of consumers.
const noopCommitNodeUpdate: NonNullable<LayoutCanvasProps['onCommitNodeUpdate']> = () => {}
const noopDropAttempt: NonNullable<LayoutCanvasProps['onDropAttempt']> = () => {}

export function LayoutCanvas({
  config,
  activePageId,
  onActivePageIdChange,
  onCommitNodeUpdate = noopCommitNodeUpdate,
  onDropAttempt = noopDropAttempt,
  onCommitCanvasMutation,
}: LayoutCanvasProps) {
  const [selectedPath, setSelectedPath] = useState<LayoutNodePath | null>(null)
  const [hoveredPath, setHoveredPath] = useState<LayoutNodePath | null>(null)

  const activePage = config.pages.find((page) => page.id === activePageId) ?? config.pages[0]

  // Edge case: switching pages while a node is selected clears the selection —
  // a selected node from a different page has no meaning on the new page.
  useEffect(() => {
    setSelectedPath(null)
    setHoveredPath(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePageId])

  // Edge case: a config change (e.g. after "Aplicar" in Monaco, or a canvas
  // commit) may remove the selected node. Degrade the selection safely instead
  // of pointing at a path that no longer resolves.
  useEffect(() => {
    if (selectedPath === null) return
    if (getNodeAtPath(activePage.layout, selectedPath) === null) {
      setSelectedPath(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config])

  // Derived, not stored in state: recomputing from `selectedPath` on every render
  // keeps it consistent with `activePage.layout` without an extra effect (see
  // react-best-practices.md 4.1). Between a commit and the guard effect above
  // clearing a now-invalid `selectedPath`, this may transiently resolve to
  // `null` for one render — the panel below already handles that.
  const selectedNode = selectedPath !== null ? getNodeAtPath(activePage.layout, selectedPath) : null

  // T14/T15: the actual FR6/FR7/FR8 wiring. `onDropAttempt` (raw, T12) always fires first,
  // unchanged — callers that only care about the raw attempt (T12/T13 wiring tests) keep
  // working exactly as before. Structural validity (T13, extended by T15 for a palette-
  // originated `draggedNodeType`) is the gate for whether a commit happens at all: an invalid
  // attempt never reaches `onCommitCanvasMutation`, so it can never produce an observable state
  // change (spec's "no commit path for an invalid drop").
  function handleDropAttempt(attempt: LayoutCanvasDropAttempt) {
    onDropAttempt(attempt)

    const { draggedPath, draggedNodeType, targetParentPath, targetIndex, targetTabItemIndex } = attempt

    const isStructurallyValid = isValidDropTarget(activePage.layout, draggedPath, targetParentPath, targetIndex, {
      targetTabItemIndex,
      draggedNodeType,
    })
    if (!isStructurallyValid || onCommitCanvasMutation === undefined) return

    if (draggedPath === null) {
      // Palette-originated insert (T15, FR8): `isValidDropTarget` above only returns `true` for
      // a `draggedPath: null` attempt when it could resolve a synthetic node from
      // `draggedNodeType` (see `resolveDraggedNode` in layout-drop-validity.ts) — so reaching
      // here guarantees `draggedNodeType` is defined.
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

    // Only the dragged node's own selection needs to follow it to its new path — a sibling's
    // selection shifting because it moved index due to this drag (never its own path changing)
    // is the same known limitation the guard effect above already accepts for any commit.
    const draggedNodeWasSelected =
      selectedPath !== null && serializeLayoutNodePath(selectedPath) === serializeLayoutNodePath(draggedPath)
    if (!draggedNodeWasSelected || selectedNode === null) return

    const mutatedLayout = applyMove(activePage.layout)
    const newSelectedPath = findNodePath(mutatedLayout, selectedNode)
    if (newSelectedPath !== null) setSelectedPath(newSelectedPath)
  }

  // T16/FR9: deletes the selected node (and its subtree) through the same commit pipeline
  // T14/T15 already use — no second commit path. Clears the selection afterwards so the panel/
  // breadcrumb, which both read `selectedPath`, stop pointing at a node that no longer exists
  // (same intent as the guard effect above, but immediate instead of waiting for the next
  // `config` change).
  function handleDeleteSelectedNode() {
    if (selectedPath === null || onCommitCanvasMutation === undefined) return

    const result = onCommitCanvasMutation((pageLayout) => removeNodeAt(pageLayout, selectedPath))
    if (result.status !== 'applied') return

    setSelectedPath(null)
    setHoveredPath(null)
  }

  return (
    <div data-testid="layout-canvas" className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b px-4 py-2">
        <label htmlFor="layout-canvas-page-select" className="text-xs font-medium text-gray-600">
          Página
        </label>
        <select
          id="layout-canvas-page-select"
          data-testid="layout-canvas-page-select"
          value={activePageId}
          onChange={(event) => onActivePageIdChange(event.target.value)}
          className="rounded border px-2 py-1 text-sm"
        >
          {config.pages.map((page) => (
            <option key={page.id} value={page.id}>
              {page.id}
            </option>
          ))}
        </select>
      </div>
      <LayoutCanvasBreadcrumb
        pageLayout={activePage.layout}
        selectedPath={selectedPath}
        onSelectNode={setSelectedPath}
      />
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* T15/FR8: the palette lives inside the same LayoutCanvasDndContext as the canvas
            content so `@dnd-kit/core` shares one drag session between a palette entry (drag
            source) and the canvas's drop zones (drag targets) — dragging across sibling
            DndContext instances is not supported by the library. Always rendered, not
            conditioned on a selection. */}
        <LayoutCanvasDndContext pageLayout={activePage.layout} onDropAttempt={handleDropAttempt}>
          <LayoutCanvasNodePalette />
          <div className="min-h-0 flex-1 overflow-auto p-4">
            <LayoutEditModeProvider
              value={{
                selectedPath,
                hoveredPath,
                onSelectNode: setSelectedPath,
                onHoverNode: setHoveredPath,
              }}
            >
              {/* The canvas mounts its own isolated RuntimeStateProvider instance so it
                  can edit any page without depending on where the background preview
                  runtime has navigated to (see design.md / T5 spec). */}
              <RuntimeStateProvider config={config}>
                <LayoutRenderer nodes={activePage.layout} />
              </RuntimeStateProvider>
            </LayoutEditModeProvider>
          </div>
          {selectedNode !== null && selectedPath !== null && (
            <LayoutCanvasPropertiesPanel
              node={selectedNode}
              path={selectedPath}
              onCommitNodeUpdate={onCommitNodeUpdate}
              onDeleteNode={onCommitCanvasMutation === undefined ? undefined : handleDeleteSelectedNode}
            />
          )}
        </LayoutCanvasDndContext>
      </div>
    </div>
  )
}
