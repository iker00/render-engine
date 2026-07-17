import type { LayoutNode, LayoutNodeType } from '../../config/runtime-config'
import {
  FORM_ALLOWED_DESCENDANT_TYPES,
  FORM_ONLY_LEAF_NODE_TYPES,
  LINK_ALLOWED_CHILD_TYPES,
  MODAL_ALLOWED_CHILD_TYPES,
  buttonRequiresFormAncestor,
  nodeTypeAcceptsChildren,
} from '../../config/layout-placement-rules'
import { getNodeAtPath, type LayoutNodePath } from '../../runtime/layout-node-path'
import { isSameOrDescendantPath } from '../layout-tree-mutations'

export interface IsValidDropTargetOptions {
  targetTabItemIndex?: number
  /**
   * Only meaningful when `draggedPath` is `null` (drag originated in the node palette, T15 —
   * the node doesn't exist in the tree yet). Ignored whenever `draggedPath` is non-null: a
   * real path always takes priority over a declared type.
   */
  draggedNodeType?: LayoutNodeType
}

/**
 * Minimal shape needed by steps 5-8 below: only `.type` (and, for a `button`, `.props.action`
 * via `buttonRequiresFormAncestor`) is ever inspected. This is exactly what a palette-originated
 * drag can offer, since the node doesn't exist anywhere in the tree yet to resolve a real one.
 */
type DraggedNodeLike = LayoutNode | { type: LayoutNodeType }

/**
 * Step 1-2 of the spec: resolve the node being dragged from either a real `draggedPath` (drag
 * started on an existing canvas node, T14) or a synthetic `{ type }` built from
 * `options.draggedNodeType` (drag started in the palette, T15, where no path exists yet).
 * `draggedPath: null` with no `draggedNodeType` is a malformed call and resolves to `null`.
 */
function resolveDraggedNode(
  pageLayout: readonly LayoutNode[],
  draggedPath: LayoutNodePath | null,
  draggedNodeType: LayoutNodeType | undefined,
): DraggedNodeLike | null {
  if (draggedPath === null) {
    return draggedNodeType === undefined ? null : { type: draggedNodeType }
  }
  return getNodeAtPath(pageLayout, draggedPath)
}

/**
 * Step 7-8 of the spec: whether the drop destination has a `form` ancestor, either because
 * `targetParentNode` itself is a `form` or because one of its own ancestors (walking
 * `targetParentPath` prefixes back to the root) is. A `tabs` node disambiguated via
 * `targetTabItemIndex` is not itself a `form`, so it still needs this walk to find one nested
 * higher up the tree.
 */
function hasFormAncestor(
  pageLayout: readonly LayoutNode[],
  targetParentPath: LayoutNodePath,
  targetParentNode: LayoutNode | null,
): boolean {
  if (targetParentNode !== null && targetParentNode.type === 'form') return true

  for (let length = 1; length < targetParentPath.length; length++) {
    const ancestor = getNodeAtPath(pageLayout, targetParentPath.slice(0, length))
    if (ancestor !== null && ancestor.type === 'form') return true
  }

  return false
}

/** Step 7 of the spec: the dragged node only ever makes sense as a descendant of a `form`. */
function requiresFormAncestor(draggedNode: DraggedNodeLike): boolean {
  if (FORM_ONLY_LEAF_NODE_TYPES.has(draggedNode.type)) return true
  if (draggedNode.type !== 'button') return false
  // `DraggedNodeLike`'s synthetic-palette member (`{ type: LayoutNodeType }`) keeps its `type`
  // field as the full union even once narrowed to `'button'` here, since it isn't itself a
  // discriminated union member with a literal `type` — hence the explicit, locally-safe cast
  // instead of relying on further narrowing. `buttonRequiresFormAncestor` only ever reads
  // `props?.action`, which both branches of `DraggedNodeLike` already satisfy structurally.
  return buttonRequiresFormAncestor(draggedNode as { props?: { action?: unknown } })
}

/**
 * Resolves whether dropping the dragged node at `targetParentPath`/`targetIndex` (optionally
 * disambiguated into a `tabs` item via `options.targetTabItemIndex`) is structurally valid,
 * per FR7 of the feature spec. `targetIndex` only carries the insertion position — it plays no
 * part in validity, which is entirely about node-type placement rules and cycle avoidance.
 *
 * `targetParentPath` always resolves to an existing node (or the root, when empty) — never a
 * `tabItem` terminal step used as a collection marker on its own, mirroring the `parentPath`
 * contract fixed by T3's `insertNodeAt`.
 */
export function isValidDropTarget(
  pageLayout: readonly LayoutNode[],
  draggedPath: LayoutNodePath | null,
  targetParentPath: LayoutNodePath,
  targetIndex: number,
  options?: IsValidDropTargetOptions,
): boolean {
  void targetIndex

  const draggedNode = resolveDraggedNode(pageLayout, draggedPath, options?.draggedNodeType)
  if (draggedNode === null) return false

  const targetParentNode = targetParentPath.length === 0 ? null : getNodeAtPath(pageLayout, targetParentPath)
  if (targetParentPath.length > 0 && targetParentNode === null) return false

  const targetTabItemIndex = options?.targetTabItemIndex

  if (targetParentNode !== null && targetParentNode.type === 'tabs') {
    if (targetTabItemIndex === undefined) return false
    const items = targetParentNode.props.items
    if (targetTabItemIndex < 0 || targetTabItemIndex >= items.length) return false
    // Valid tabs disambiguation: treated as an unrestricted-by-type acceptor (like `container`),
    // so the generic `nodeTypeAcceptsChildren` check below is intentionally skipped.
  } else {
    if (targetTabItemIndex !== undefined) return false
    if (targetParentNode !== null && !nodeTypeAcceptsChildren(targetParentNode.type)) return false
  }

  if (targetParentNode !== null && targetParentNode.type === 'modal' && !MODAL_ALLOWED_CHILD_TYPES.has(draggedNode.type)) {
    return false
  }

  if (targetParentNode !== null && targetParentNode.type === 'link' && !LINK_ALLOWED_CHILD_TYPES.has(draggedNode.type)) {
    return false
  }

  const targetHasFormAncestor = hasFormAncestor(pageLayout, targetParentPath, targetParentNode)

  if (requiresFormAncestor(draggedNode) && !targetHasFormAncestor) return false
  if (targetHasFormAncestor && !FORM_ALLOWED_DESCENDANT_TYPES.has(draggedNode.type)) return false

  if (draggedPath !== null && isSameOrDescendantPath(draggedPath, targetParentPath)) return false

  return true
}
