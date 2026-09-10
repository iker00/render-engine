import type {
  LayoutNode,
  LayoutNodeCollection,
  RuntimeConfig,
  RuntimeConfigError,
  TableCellNode,
  TableCellValue,
  TableLayoutNode,
} from './runtime-config-types'
import { isVisibilityGroup } from './runtime-config-types'
import type { BreadcrumbSegment } from './validation-breadcrumb'
import { buildBreadcrumbSegmentFromNode, enrichedInvalidLayoutFromNode } from './validation-breadcrumb'

// Post-pass over the already-validated layout tree: rejects any `visibility.reference` (or
// `visibility.conditions[k].reference`) shaped as `row.*` when the node it belongs to is not part
// of a `table` cell-node subtree. Mirrors the traversal pattern of `validateModalReferences` in
// `validate-runtime-config.ts`, operating on the typed `LayoutNode` tree instead of the raw config.
export function validateRowVisibilityScope(
  config: RuntimeConfig,
): { status: 'error'; error: RuntimeConfigError } | null {
  for (const page of config.pages) {
    const error = checkNodesRowVisibilityScope(page.layout, 'layout', page.id, false, [])
    if (error) return error
  }

  return null
}

function checkNodesRowVisibilityScope(
  nodes: LayoutNodeCollection,
  path: string,
  pageId: string,
  insideTableCell: boolean,
  breadcrumb: BreadcrumbSegment[],
): { status: 'error'; error: RuntimeConfigError } | null {
  for (let i = 0; i < nodes.length; i += 1) {
    const node = nodes[i]
    const nodePath = `${path}[${i}]`
    const nodeBreadcrumb = [...breadcrumb, buildBreadcrumbSegmentFromNode(node, i)]

    const error = checkNodeRowVisibilityScope(node, nodePath, pageId, insideTableCell, nodeBreadcrumb)
    if (error) return error
  }

  return null
}

function checkNodeRowVisibilityScope(
  node: LayoutNode,
  nodePath: string,
  pageId: string,
  insideTableCell: boolean,
  breadcrumb: BreadcrumbSegment[],
): { status: 'error'; error: RuntimeConfigError } | null {
  const visibilityError = checkVisibilityRowScope(node, nodePath, pageId, insideTableCell, breadcrumb)
  if (visibilityError) return visibilityError

  const fallbackError = checkFallbacksRowVisibilityScope(node, nodePath, pageId, insideTableCell, breadcrumb)
  if (fallbackError) return fallbackError

  if (node.type === 'table') {
    return checkTableRowsRowVisibilityScope(node, nodePath, pageId, breadcrumb)
  }

  if (
    (node.type === 'container' || node.type === 'form' || node.type === 'link' || node.type === 'accordion' || node.type === 'modal' || node.type === 'group') &&
    node.children
  ) {
    return checkNodesRowVisibilityScope(node.children, `${nodePath}.children`, pageId, insideTableCell, breadcrumb)
  }

  if (node.type === 'repeater') {
    return checkNodesRowVisibilityScope(node.props.template, `${nodePath}.props.template`, pageId, insideTableCell, breadcrumb)
  }

  if (node.type === 'tabs' || node.type === 'steps') {
    for (let i = 0; i < node.props.items.length; i += 1) {
      const item = node.props.items[i]
      if (!item.children) continue

      const error = checkNodesRowVisibilityScope(
        item.children,
        `${nodePath}.props.items[${i}].children`,
        pageId,
        insideTableCell,
        breadcrumb,
      )
      if (error) return error
    }
  }

  return null
}

function checkVisibilityRowScope(
  node: LayoutNode,
  nodePath: string,
  pageId: string,
  insideTableCell: boolean,
  breadcrumb: BreadcrumbSegment[],
): { status: 'error'; error: RuntimeConfigError } | null {
  const visibility = node.visibility

  if (!visibility || insideTableCell) return null

  if (isVisibilityGroup(visibility)) {
    for (let k = 0; k < visibility.conditions.length; k += 1) {
      if (isRowReference(visibility.conditions[k].reference)) {
        return rowScopeError(pageId, `${nodePath}.visibility.conditions[${k}].reference`, node, breadcrumb)
      }
    }

    return null
  }

  if (isRowReference(visibility.reference)) {
    return rowScopeError(pageId, `${nodePath}.visibility.reference`, node, breadcrumb)
  }

  return null
}

function checkFallbacksRowVisibilityScope(
  node: LayoutNode,
  nodePath: string,
  pageId: string,
  insideTableCell: boolean,
  breadcrumb: BreadcrumbSegment[],
): { status: 'error'; error: RuntimeConfigError } | null {
  if (!node.queryStateFeedback?.states) return null

  for (const [stateName, rule] of Object.entries(node.queryStateFeedback.states)) {
    if (!rule || rule.mode !== 'fallback') continue

    const error = checkNodesRowVisibilityScope(
      [...rule.fallback],
      `${nodePath}.queryStateFeedback.states.${stateName}.fallback`,
      pageId,
      insideTableCell,
      breadcrumb,
    )
    if (error) return error
  }

  return null
}

function checkTableRowsRowVisibilityScope(
  node: TableLayoutNode,
  nodePath: string,
  pageId: string,
  breadcrumb: BreadcrumbSegment[],
): { status: 'error'; error: RuntimeConfigError } | null {
  const rows = node.props.rows

  if (Array.isArray(rows)) {
    for (let j = 0; j < rows.length; j += 1) {
      const row = rows[j]

      for (let i = 0; i < row.length; i += 1) {
        const cell = row[i]
        if (!isTableCellNode(cell)) continue

        const cellPath = `${nodePath}.props.rows[${j}][${i}]`
        const cellBreadcrumb = [...breadcrumb, buildBreadcrumbSegmentFromNode(cell, i)]
        const error = checkNodeRowVisibilityScope(cell, cellPath, pageId, true, cellBreadcrumb)
        if (error) return error
      }
    }

    return null
  }

  for (let i = 0; i < rows.cells.length; i += 1) {
    const cell = rows.cells[i]
    if (typeof cell === 'string') continue

    const cellPath = `${nodePath}.props.rows.cells[${i}]`
    const cellBreadcrumb = [...breadcrumb, buildBreadcrumbSegmentFromNode(cell, i)]
    const error = checkNodeRowVisibilityScope(cell, cellPath, pageId, true, cellBreadcrumb)
    if (error) return error
  }

  return null
}

function isTableCellNode(value: TableCellValue): value is TableCellNode {
  return typeof value === 'object' && value !== null
}

function isRowReference(reference: string): boolean {
  return reference === 'row' || reference.startsWith('row.')
}

function rowScopeError(
  pageId: string,
  path: string,
  node: LayoutNode,
  breadcrumb: BreadcrumbSegment[],
): { status: 'error'; error: RuntimeConfigError } {
  return enrichedInvalidLayoutFromNode(
    `Page "${pageId}" has an invalid layout at "${path}": row.* references are only supported inside a table cell subtree.`,
    breadcrumb,
    node,
  )
}
