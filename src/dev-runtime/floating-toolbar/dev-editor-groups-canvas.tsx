import { useState } from 'react'
import type { LayoutNode, LayoutNodeType } from '../../config/runtime-config'
import type { RuntimeGroupConfig } from '../../config/runtime-config-types'
import { LayoutEditModeProvider } from '../../runtime/layout-edit-mode-context'
import {
  getNodeAtPath,
  pathEndsAtTableCell,
  serializeLayoutNodePath,
  type LayoutNodePath,
} from '../../runtime/layout-node-path'
import { LayoutRenderer } from '../../runtime/layout-renderer'
import { RuntimeGroupContextProvider } from '../../runtime/runtime-references/runtime-group-context'
import type { CommitResult, LayoutCanvasTarget, LayoutTreeMutation } from '../layout-canvas/layout-canvas-commit'
import { LayoutCanvasDndContext, type LayoutCanvasDropAttempt } from '../layout-canvas/layout-canvas-dnd-context'
import {
  buildDefaultNodeInstance,
  EMPTY_DYNAMIC_TABLE_CELL_TEXT_VALUE,
  EMPTY_TABLE_CELL_TEXT_VALUE,
} from '../layout-canvas/layout-canvas-node-palette-defaults'
import { isValidDropTarget } from '../layout-canvas/layout-drop-validity'
import { findNodePath, insertNodeAt, movePathTo, removeNodeAt, replaceNodeAt } from '../layout-tree-mutations'
import { FloatingNodePalette } from './floating-node-palette'
import { FloatingSelectionOverlay } from './floating-selection-overlay'

export interface DevEditorGroupsCanvasProps {
  groupId: string
  group: RuntimeGroupConfig
  onCommitLayoutMutation: (target: LayoutCanvasTarget, patch: LayoutTreeMutation) => CommitResult
}

/**
 * Editable preview of a group's `template` (T14 / feature reusable-node-groups): retargets the
 * same canvas machinery `DevEditorLayer`'s "Layout" domain uses for a page's `layout` —
 * `LayoutCanvasDndContext`, `LayoutEditModeProvider`, `FloatingSelectionOverlay`,
 * `FloatingNodePalette` — onto `groups[groupId].template` via `commitLayoutMutation`'s
 * `{ kind: 'group-template', groupId }` target (T13), instead of a page's layout. Always in
 * Editor mode (`active: true`): there is no "Visual" reading for a group template on its own,
 * unlike a page.
 *
 * Feeds a `RuntimeGroupContextProvider` with one mock value per declared `param` — explicit
 * format: `"{groupId}.{paramName}"` — so a `{{group.paramName}}` reference inside the template
 * renders with a visible sample value instead of degrading to "not found". This mirrors the same
 * "single representative sample" precedent the `repeater` node's Editor-mode instance already
 * established for `item.*`.
 *
 * Rendered by `GroupsConfigPanel` only while a `groupId` is selected. Mounted fresh per
 * `groupId` — see the `prevGroupId` guard below, which resets the local selection when the
 * `groupId` prop changes — but this never remounts `DevRuntime` itself, since that component is
 * mounted far above this one's own mount point and is entirely unaffected by which `groupId` is
 * currently selected in the "Grupos" tab.
 */
export function DevEditorGroupsCanvas({ groupId, group, onCommitLayoutMutation }: DevEditorGroupsCanvasProps) {
  const [selectedPath, setSelectedPath] = useState<LayoutNodePath | null>(null)
  const [hoveredPath, setHoveredPath] = useState<LayoutNodePath | null>(null)
  const [paletteOpen, setPaletteOpen] = useState(false)

  // Switching to a different group has nothing meaningful to keep selected — same "adjust state
  // during render" pattern DevEditorLayer uses when the active page changes.
  const [prevGroupId, setPrevGroupId] = useState(groupId)
  if (groupId !== prevGroupId) {
    setPrevGroupId(groupId)
    setSelectedPath(null)
    setHoveredPath(null)
  }

  const target: LayoutCanvasTarget = { kind: 'group-template', groupId }
  const template = group.template

  const mockParamValues: Record<string, unknown> = {}
  for (const paramName of group.params) {
    mockParamValues[paramName] = `${groupId}.${paramName}`
  }

  function handleDropAttempt(attempt: LayoutCanvasDropAttempt) {
    const { draggedPath, draggedNodeType, targetParentPath, targetIndex, targetTabItemIndex, targetStepItemIndex } =
      attempt

    const isStructurallyValid = isValidDropTarget(template, draggedPath, targetParentPath, targetIndex, {
      targetTabItemIndex,
      targetStepItemIndex,
      draggedNodeType,
    })
    if (!isStructurallyValid) return

    if (draggedPath === null) {
      const nodeType = draggedNodeType as LayoutNodeType
      onCommitLayoutMutation(target, (layout) =>
        insertNodeAt(layout, targetParentPath, targetIndex, buildDefaultNodeInstance(nodeType), {
          tabItemIndex: targetTabItemIndex,
          stepItemIndex: targetStepItemIndex,
        }),
      )
      return
    }

    const applyMove = (layout: LayoutNode[]) =>
      movePathTo(layout, draggedPath, targetParentPath, targetIndex, {
        toTabItemIndex: targetTabItemIndex,
        toStepItemIndex: targetStepItemIndex,
      })

    const result = onCommitLayoutMutation(target, applyMove)
    if (result.status !== 'applied') return

    const selectedNode = selectedPath !== null ? getNodeAtPath(template, selectedPath) : null
    const draggedNodeWasSelected =
      selectedPath !== null && serializeLayoutNodePath(selectedPath) === serializeLayoutNodePath(draggedPath)
    if (!draggedNodeWasSelected || selectedNode === null) return

    const mutatedTemplate = applyMove(template)
    const newSelectedPath = findNodePath(mutatedTemplate, selectedNode)
    if (newSelectedPath !== null) setSelectedPath(newSelectedPath)
  }

  function handleCommitNodeUpdate(path: LayoutNodePath, updater: (node: LayoutNode) => LayoutNode) {
    onCommitLayoutMutation(target, (layout) => replaceNodeAt(layout, path, updater))
  }

  // Same table-cell exception as DevEditorLayer.handleDeleteSelectedNode (T5, 0138, D6): removing
  // a table cell-node from `props.rows`/`props.rows.cells` would shift every remaining cell out
  // of alignment with `headers`, so it reverts to its empty-text literal instead.
  function handleDeleteSelectedNode() {
    if (selectedPath === null) return

    const result = pathEndsAtTableCell(selectedPath)
      ? onCommitLayoutMutation(target, (layout) => {
          const lastStep = selectedPath[selectedPath.length - 1]
          return replaceNodeAt(
            layout,
            selectedPath,
            () =>
              (lastStep.field === 'row'
                ? EMPTY_TABLE_CELL_TEXT_VALUE
                : EMPTY_DYNAMIC_TABLE_CELL_TEXT_VALUE) as unknown as LayoutNode,
          )
        })
      : onCommitLayoutMutation(target, (layout) => removeNodeAt(layout, selectedPath))
    if (result.status !== 'applied') return

    setSelectedPath(null)
    setHoveredPath(null)
  }

  return (
    <div data-testid="dev-editor-groups-canvas" className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-gray-200 px-3 py-2">
        <span className="text-xs font-medium text-gray-600">
          Editando plantilla de <span className="font-semibold text-gray-900">{groupId}</span>
        </span>
        <button
          type="button"
          data-testid="dev-editor-groups-canvas-palette-toggle"
          aria-pressed={paletteOpen}
          onClick={() => setPaletteOpen((open) => !open)}
          className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-100"
        >
          Añadir elemento
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-3">
        <LayoutCanvasDndContext pageLayout={template} onDropAttempt={handleDropAttempt}>
          <LayoutEditModeProvider
            value={{
              active: true,
              selectedPath,
              hoveredPath,
              onSelectNode: setSelectedPath,
              onHoverNode: setHoveredPath,
            }}
          >
            <RuntimeGroupContextProvider value={{ paramValues: mockParamValues }}>
              <LayoutRenderer nodes={template} />
            </RuntimeGroupContextProvider>
          </LayoutEditModeProvider>
          {paletteOpen && <FloatingNodePalette open={true} onClose={() => setPaletteOpen(false)} />}
        </LayoutCanvasDndContext>

        <FloatingSelectionOverlay
          pageLayout={template}
          selectedPath={selectedPath}
          onSelectNode={setSelectedPath}
          onCommitNodeUpdate={handleCommitNodeUpdate}
          onDeleteNode={handleDeleteSelectedNode}
        />
      </div>
    </div>
  )
}
