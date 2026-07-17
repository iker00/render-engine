import type { MouseEvent, ReactNode } from 'react'
import { useDroppable } from '@dnd-kit/core'
import type { LayoutNode, LayoutNodeCollection } from '../config/runtime-config'
import type { RuntimeIterationContext } from './runtime-references/runtime-reference-resolver'
import type { LayoutNodePath } from './layout-node-path'
import { LayoutNodeRenderer } from './layout-node-renderer'
import { useLayoutEditModeContext, type LayoutEditModeContextValue } from './layout-edit-mode-context'
import { serializeDropZoneId, serializeLayoutNodePath } from './layout-node-path'

export interface LayoutRendererProps {
  nodes: readonly LayoutNode[]
  iterationContext?: RuntimeIterationContext
  path?: LayoutNodePath
  buildChildPath?: (index: number) => LayoutNodePath
  /**
   * Drop-zone disambiguator (T12 / design.md Decisión 7): set only by `TabsNode` when
   * rendering the active tab's children, since `path` there is the tabs node's own path
   * (shared by every tab item), not a per-tabItem path. Mirrors
   * `InsertNodeAtOptions.tabItemIndex` in `layout-tree-mutations.ts`. `repeater` and
   * `accordion`/`container`/`form` recursion all pass their own path as `path` already, so
   * they need no equivalent — `parentPath` for their drop zones is just `path`.
   */
  parentTabItemIndex?: number
}

export function LayoutRenderer({
  nodes,
  iterationContext,
  path = [],
  buildChildPath,
  parentTabItemIndex,
}: LayoutRendererProps) {
  const editModeContext = useLayoutEditModeContext()
  const resolveChildPath = buildChildPath ?? ((index: number) => [...path, { field: 'children' as const, index }])

  // Canvas-only (T12 / design.md Decisión 7): a droppable "insertion position" zone before
  // the first node, between every pair of consecutive siblings, and after the last one — N+1
  // zones for N nodes, N=0 included (an otherwise-empty collection still gets its single
  // zone at index 0). Positions are ordinal (array index), not geometric: the DOM already
  // follows array order regardless of how a grid with `columns` distributes it visually, so
  // `closestCenter` resolves the same way for lists and grids without a separate algorithm.
  // A production render (no LayoutEditModeContext) never mounts these, so output stays
  // byte-identical to before T12.
  const elements: ReactNode[] = []

  if (editModeContext !== null) {
    elements.push(
      <LayoutCanvasDropZoneGap key="drop-zone-0" parentPath={path} index={0} tabItemIndex={parentTabItemIndex} />,
    )
  }

  nodes.forEach((node, index) => {
    const childPath = resolveChildPath(index)

    elements.push(
      <LayoutNodeRenderer
        key={getLayoutNodeKey(node, index)}
        node={node}
        iterationContext={iterationContext}
        path={childPath}
        renderedChildren={
          hasChildren(node) ? (
            editModeContext !== null && isEmptyPlaceholderCandidate(node) ? (
              <EmptyContainerPlaceholder nodeType={node.type} path={childPath} editModeContext={editModeContext} />
            ) : (
              <LayoutRenderer nodes={node.children ?? []} iterationContext={iterationContext} path={childPath} />
            )
          ) : undefined
        }
      />,
    )

    if (editModeContext !== null) {
      elements.push(
        <LayoutCanvasDropZoneGap
          key={`drop-zone-${index + 1}`}
          parentPath={path}
          index={index + 1}
          tabItemIndex={parentTabItemIndex}
        />,
      )
    }
  })

  return <>{elements}</>
}

interface LayoutCanvasDropZoneGapProps {
  parentPath: LayoutNodePath
  index: number
  tabItemIndex?: number
}

// A minimal, unstyled-by-default drop target participating in the real flex/grid flow of its
// parent container, so its measured rect (and therefore its collision center) reflects the
// actual visual layout without any custom geometry math on our side (see T12 note on grids
// vs vertical lists).
function LayoutCanvasDropZoneGap({ parentPath, index, tabItemIndex }: LayoutCanvasDropZoneGapProps) {
  const dropZoneId = serializeDropZoneId({ parentPath, index, tabItemIndex })
  const { setNodeRef } = useDroppable({ id: dropZoneId })

  return <div ref={setNodeRef} data-drop-zone={dropZoneId} aria-hidden="true" className="h-1 min-w-1" />
}

type EmptyPlaceholderNodeType = 'container' | 'form'

const EMPTY_PLACEHOLDER_LABEL: Record<EmptyPlaceholderNodeType, string> = {
  container: 'Contenedor vacío',
  form: 'Formulario vacío',
}

function isEmptyPlaceholderCandidate(
  node: Extract<LayoutNode, { children?: LayoutNodeCollection }>,
): node is Extract<LayoutNode, { type: EmptyPlaceholderNodeType }> {
  return (node.type === 'container' || node.type === 'form') && (node.children ?? []).length === 0
}

interface EmptyContainerPlaceholderProps {
  nodeType: EmptyPlaceholderNodeType
  path: LayoutNodePath
  editModeContext: LayoutEditModeContextValue
}

// The placeholder stands for the container/form's still-empty first-child slot, so its own
// path is the container's path plus a `children.0` step — a real, valid LayoutNodePath that
// T13's drop engine can later read as "insert as first child", distinct from the container's
// own path one level up. It is also, per T12, the single drop zone for an empty container:
// {parentPath: <container's own path>, index: 0} — the same formula
// `LayoutCanvasDropZoneGap` uses for the "before the first sibling" position, just realized
// here as the already-existing placeholder element instead of a separate gap.
function EmptyContainerPlaceholder({ nodeType, path, editModeContext }: EmptyContainerPlaceholderProps) {
  const placeholderPath: LayoutNodePath = [...path, { field: 'children', index: 0 }]
  const serializedPath = serializeLayoutNodePath(placeholderPath)
  const { setNodeRef: setDropZoneRef } = useDroppable({ id: serializeDropZoneId({ parentPath: path, index: 0 }) })
  const isSelected =
    editModeContext.selectedPath !== null &&
    serializeLayoutNodePath(editModeContext.selectedPath) === serializedPath
  const isHovered =
    editModeContext.hoveredPath !== null &&
    serializeLayoutNodePath(editModeContext.hoveredPath) === serializedPath

  let editModeClassName = ''
  if (isSelected) {
    editModeClassName = ' outline outline-2 -outline-offset-2 outline-blue-500'
  } else if (isHovered) {
    editModeClassName = ' outline outline-1 -outline-offset-1 outline-blue-300'
  }

  // Same "first handler wins" marking mechanism as the node wrapper in layout-node-renderer.tsx
  // (see design.md): no stopPropagation, so the click keeps bubbling to the container's own
  // wrapper above, but that ancestor wrapper sees the event already marked and no-ops.
  const handleSelectClick = (event: MouseEvent<HTMLDivElement>) => {
    const nativeEvent = event.nativeEvent as MouseEvent['nativeEvent'] & {
      __layoutEditModeNodeSelected?: boolean
    }

    if (nativeEvent.__layoutEditModeNodeSelected) {
      return
    }

    nativeEvent.__layoutEditModeNodeSelected = true
    editModeContext.onSelectNode(placeholderPath)
  }

  return (
    <div
      ref={setDropZoneRef}
      data-empty-placeholder="true"
      data-node-path={serializedPath}
      onClick={handleSelectClick}
      onMouseEnter={() => editModeContext.onHoverNode(placeholderPath)}
      onMouseLeave={() => editModeContext.onHoverNode(null)}
      className={`rounded-control border border-dashed border-app-border-strong p-4 text-center text-sm text-app-text-muted${editModeClassName}`}
    >
      {EMPTY_PLACEHOLDER_LABEL[nodeType]}
    </div>
  )
}

function hasChildren(node: LayoutNode): node is Extract<LayoutNode, { children?: LayoutNodeCollection }> {
  return node.type === 'container' || node.type === 'form' || node.type === 'modal' || node.type === 'link'
}

function getLayoutNodeKey(node: LayoutNode, index: number) {
  if ('id' in node && typeof node.id === 'string') {
    return node.id
  }

  if (node.type === 'input' || node.type === 'textarea' || node.type === 'select') {
    return `${node.type}-${node.props.fieldId}-${index}`
  }

  return `${node.type}-${index}`
}
