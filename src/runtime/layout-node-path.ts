import type { LayoutNode, TableCellNode, TableCellValue, TableRows } from '../config/runtime-config'

export type LayoutPathStep =
  | { field: 'children'; index: number }
  | { field: 'template'; index: number }
  | { field: 'tabItem'; itemIndex: number; index: number }
  | { field: 'stepItem'; itemIndex: number; index: number }
  | { field: 'row'; rowIndex: number; index: number }
  | { field: 'cells'; index: number }

export type LayoutNodePath = LayoutPathStep[]

function getChildNodesCollection(node: LayoutNode): readonly LayoutNode[] {
  const children = (node as { children?: unknown }).children
  return Array.isArray(children) ? (children as LayoutNode[]) : []
}

/**
 * A table cell resolved by a `row`/`cells` path step is either a `TableCellNode` (a nested
 * layout node, which can be selected/edited) or a `TableCellPrimitive` (plain text, which
 * `table-layout-node.tsx` never wraps with selection — see T3). Paths are only ever built to
 * point at the former, so a primitive here is a defensive type guard, not a case that occurs
 * in the normal flow.
 */
function isTableCellNodeValue(value: TableCellValue): value is TableCellNode {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function getNodeAtPath(rootNodes: readonly LayoutNode[], path: LayoutNodePath): LayoutNode | null {
  let currentNodes: readonly LayoutNode[] = rootNodes
  let currentNode: LayoutNode | null = null

  for (const step of path) {
    if (step.field === 'children') {
      const candidate: LayoutNode | undefined = currentNodes[step.index]
      if (!candidate) return null
      currentNode = candidate
      currentNodes = getChildNodesCollection(candidate)
      continue
    }

    if (step.field === 'template') {
      if (currentNode === null || currentNode.type !== 'repeater') return null
      const template: LayoutNode[] = currentNode.props.template
      const candidate: LayoutNode | undefined = template[step.index]
      if (!candidate) return null
      currentNode = candidate
      currentNodes = getChildNodesCollection(candidate)
      continue
    }

    if (step.field === 'row') {
      if (currentNode === null || currentNode.type !== 'table') return null
      const rows: TableRows = currentNode.props.rows
      if (!Array.isArray(rows)) return null
      const row: TableCellValue[] | undefined = rows[step.rowIndex]
      if (!row) return null
      const cell: TableCellValue | undefined = row[step.index]
      if (cell === undefined || !isTableCellNodeValue(cell)) return null
      currentNode = cell
      currentNodes = getChildNodesCollection(cell)
      continue
    }

    if (step.field === 'cells') {
      if (currentNode === null || currentNode.type !== 'table') return null
      const rows: TableRows = currentNode.props.rows
      if (Array.isArray(rows)) return null
      const cell: string | TableCellNode | undefined = rows.cells[step.index]
      if (cell === undefined || !isTableCellNodeValue(cell)) return null
      currentNode = cell
      currentNodes = getChildNodesCollection(cell)
      continue
    }

    if (step.field === 'tabItem') {
      if (currentNode === null || currentNode.type !== 'tabs') return null
      const items = currentNode.props.items
      const item = items[step.itemIndex]
      if (!item) return null
      const tabItemChildren: LayoutNode[] = item.children ?? []
      const candidate: LayoutNode | undefined = tabItemChildren[step.index]
      if (!candidate) return null
      currentNode = candidate
      currentNodes = getChildNodesCollection(candidate)
      continue
    }

    if (currentNode === null || currentNode.type !== 'steps') return null
    const items = currentNode.props.items
    const item = items[step.itemIndex]
    if (!item) return null
    const stepItemChildren: LayoutNode[] = item.children ?? []
    const candidate: LayoutNode | undefined = stepItemChildren[step.index]
    if (!candidate) return null
    currentNode = candidate
    currentNodes = getChildNodesCollection(candidate)
  }

  return currentNode
}

export function serializeLayoutNodePath(path: LayoutNodePath): string {
  return path
    .map((step) => {
      if (step.field === 'children') return `children.${step.index}`
      if (step.field === 'template') return `template.${step.index}`
      if (step.field === 'row') return `row.${step.rowIndex}.${step.index}`
      if (step.field === 'cells') return `cells.${step.index}`
      if (step.field === 'tabItem') return `tabItem.${step.itemIndex}.${step.index}`
      return `stepItem.${step.itemIndex}.${step.index}`
    })
    .join('.')
}

/**
 * Inverse of `serializeLayoutNodePath`. `children`/`template` steps consume 2 dot-tokens
 * ("children.0"), `tabItem`/`stepItem` steps consume 3 ("tabItem.1.0"), so parsing scans the
 * token stream rather than naively splitting on every ".". Returns `null` for any malformed
 * input instead of throwing, so callers (e.g. parsing a drag id from `@dnd-kit/core`, which
 * is untrusted at the type level) can reject it explicitly.
 */
export function deserializeLayoutNodePath(serialized: string): LayoutNodePath | null {
  if (serialized === '') return []

  const tokens = serialized.split('.')
  const path: LayoutPathStep[] = []
  let cursor = 0

  while (cursor < tokens.length) {
    const field = tokens[cursor]

    if (field === 'children' || field === 'template') {
      const index = Number(tokens[cursor + 1])
      if (tokens[cursor + 1] === undefined || !Number.isInteger(index) || index < 0) return null
      path.push({ field, index })
      cursor += 2
      continue
    }

    if (field === 'row') {
      const rowIndex = Number(tokens[cursor + 1])
      const index = Number(tokens[cursor + 2])
      if (
        tokens[cursor + 1] === undefined ||
        tokens[cursor + 2] === undefined ||
        !Number.isInteger(rowIndex) ||
        rowIndex < 0 ||
        !Number.isInteger(index) ||
        index < 0
      ) {
        return null
      }
      path.push({ field: 'row', rowIndex, index })
      cursor += 3
      continue
    }

    if (field === 'cells') {
      const index = Number(tokens[cursor + 1])
      if (tokens[cursor + 1] === undefined || !Number.isInteger(index) || index < 0) return null
      path.push({ field: 'cells', index })
      cursor += 2
      continue
    }

    if (field === 'tabItem') {
      const itemIndex = Number(tokens[cursor + 1])
      const index = Number(tokens[cursor + 2])
      if (
        tokens[cursor + 1] === undefined ||
        tokens[cursor + 2] === undefined ||
        !Number.isInteger(itemIndex) ||
        itemIndex < 0 ||
        !Number.isInteger(index) ||
        index < 0
      ) {
        return null
      }
      path.push({ field: 'tabItem', itemIndex, index })
      cursor += 3
      continue
    }

    if (field === 'stepItem') {
      const itemIndex = Number(tokens[cursor + 1])
      const index = Number(tokens[cursor + 2])
      if (
        tokens[cursor + 1] === undefined ||
        tokens[cursor + 2] === undefined ||
        !Number.isInteger(itemIndex) ||
        itemIndex < 0 ||
        !Number.isInteger(index) ||
        index < 0
      ) {
        return null
      }
      path.push({ field: 'stepItem', itemIndex, index })
      cursor += 3
      continue
    }

    return null
  }

  return path
}

/**
 * `true` when `path` targets a table cell directly — i.e. it is non-empty and its last step is
 * `row` (manual mode) or `cells` (dynamic mode template). A path that continues past the cell
 * into its contents (e.g. a `children` step for a cell-container's own children) does not end
 * at the cell itself, so this returns `false` for it.
 */
export function pathEndsAtTableCell(path: LayoutNodePath): boolean {
  if (path.length === 0) return false
  const lastStep = path[path.length - 1]
  return lastStep.field === 'row' || lastStep.field === 'cells'
}

/**
 * A droppable position inside the layout tree, produced by the canvas dnd wiring (T12):
 * "insert a node at `index` of the collection owned by the node at `parentPath`".
 * `parentPath` always resolves to an existing node — never a `tabItem`/`stepItem` terminal
 * step used as a collection marker, which would be ambiguous (see the T3 design note on
 * `insertNodeAt`). `tabItemIndex`/`stepItemIndex` are the explicit disambiguators, present
 * only when the node at `parentPath` is a `tabs`/`steps` node respectively — mutually
 * exclusive in practice — matching `InsertNodeAtOptions.tabItemIndex`/`stepItemIndex` in
 * `layout-tree-mutations.ts`.
 */
export interface LayoutCanvasDropZone {
  parentPath: LayoutNodePath
  index: number
  tabItemIndex?: number
  stepItemIndex?: number
}

const DROP_ZONE_ID_PREFIX = 'drop:'

export function serializeDropZoneId(zone: LayoutCanvasDropZone): string {
  const base = `${DROP_ZONE_ID_PREFIX}${serializeLayoutNodePath(zone.parentPath)}:${zone.index}`
  if (zone.tabItemIndex !== undefined) return `${base}:tabItem.${zone.tabItemIndex}`
  if (zone.stepItemIndex !== undefined) return `${base}:stepItem.${zone.stepItemIndex}`
  return base
}

export function parseDropZoneId(id: string): LayoutCanvasDropZone | null {
  if (!id.startsWith(DROP_ZONE_ID_PREFIX)) return null

  const parts = id.slice(DROP_ZONE_ID_PREFIX.length).split(':')
  if (parts.length < 2 || parts.length > 3) return null

  const [serializedParentPath, indexToken, itemToken] = parts
  const index = Number(indexToken)
  if (!Number.isInteger(index) || index < 0) return null

  const parentPath = deserializeLayoutNodePath(serializedParentPath)
  if (parentPath === null) return null

  if (itemToken === undefined) {
    return { parentPath, index }
  }

  const itemParts = itemToken.split('.')
  if (itemParts.length !== 2) return null

  const itemIndex = Number(itemParts[1])
  if (!Number.isInteger(itemIndex) || itemIndex < 0) return null

  if (itemParts[0] === 'tabItem') return { parentPath, index, tabItemIndex: itemIndex }
  if (itemParts[0] === 'stepItem') return { parentPath, index, stepItemIndex: itemIndex }

  return null
}
