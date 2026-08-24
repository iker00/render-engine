import type { LayoutNode, RuntimeResponsiveLayoutValue } from '../../config/runtime-config'
import { getNodeAtPath, type LayoutNodePath } from '../../runtime/layout-node-path'

/**
 * Resolves the raw `columns` contract value declared by the nearest `container` or `repeater`
 * ancestor of the node at `path`, walking `path` prefixes from the closest ancestor up to the
 * root (mirroring the ancestor-walk pattern in `layout-drop-validity.ts`'s `hasFormAncestor`).
 * Returns `null` when `path` is empty (no ancestors) or when no ancestor in the chain is a
 * `container`/`repeater` with `props.columns` declared.
 *
 * The node at `path` itself is never considered — only strict ancestors. A `container`/`repeater`
 * ancestor without `columns` is transparent to the search: the walk continues past it toward the
 * root. This does not resolve the effective per-breakpoint value (that cascade lives in
 * `normalizeResponsiveLayoutValue`); it returns the declared contract value verbatim, whether an
 * integer or a responsive map.
 */
export function resolveAncestorContainerColumns(
  pageLayout: readonly LayoutNode[],
  path: LayoutNodePath,
): RuntimeResponsiveLayoutValue | null {
  for (let length = path.length - 1; length >= 0; length--) {
    const ancestor = getNodeAtPath(pageLayout, path.slice(0, length))
    const isGridCapableAncestor = ancestor !== null && (ancestor.type === 'container' || ancestor.type === 'repeater')
    if (isGridCapableAncestor && ancestor.props?.columns !== undefined) {
      return ancestor.props.columns
    }
  }

  return null
}
