import type { LayoutNode } from '../config/runtime-config'

export type LayoutPathStep =
  | { field: 'children'; index: number }
  | { field: 'template'; index: number }
  | { field: 'tabItem'; itemIndex: number; index: number }

export type LayoutNodePath = LayoutPathStep[]

function getChildNodesCollection(node: LayoutNode): readonly LayoutNode[] {
  const children = (node as { children?: unknown }).children
  return Array.isArray(children) ? (children as LayoutNode[]) : []
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

    if (currentNode === null || currentNode.type !== 'tabs') return null
    const items = currentNode.props.items
    const item = items[step.itemIndex]
    if (!item) return null
    const tabItemChildren: LayoutNode[] = item.children ?? []
    const candidate: LayoutNode | undefined = tabItemChildren[step.index]
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
      return `tabItem.${step.itemIndex}.${step.index}`
    })
    .join('.')
}

/**
 * Inverse of `serializeLayoutNodePath`. `children`/`template` steps consume 2 dot-tokens
 * ("children.0"), `tabItem` steps consume 3 ("tabItem.1.0"), so parsing scans the token
 * stream rather than naively splitting on every ".". Returns `null` for any malformed
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

    return null
  }

  return path
}

/**
 * A droppable position inside the layout tree, produced by the canvas dnd wiring (T12):
 * "insert a node at `index` of the collection owned by the node at `parentPath`".
 * `parentPath` always resolves to an existing node — never a `tabItem` terminal step used
 * as a collection marker, which would be ambiguous (see the T3 design note on
 * `insertNodeAt`). `tabItemIndex` is the explicit disambiguator, present only when the node
 * at `parentPath` is a `tabs` node, matching `InsertNodeAtOptions.tabItemIndex` in
 * `layout-tree-mutations.ts`.
 */
export interface LayoutCanvasDropZone {
  parentPath: LayoutNodePath
  index: number
  tabItemIndex?: number
}

const DROP_ZONE_ID_PREFIX = 'drop:'

export function serializeDropZoneId(zone: LayoutCanvasDropZone): string {
  const base = `${DROP_ZONE_ID_PREFIX}${serializeLayoutNodePath(zone.parentPath)}:${zone.index}`
  return zone.tabItemIndex === undefined ? base : `${base}:tabItem.${zone.tabItemIndex}`
}

export function parseDropZoneId(id: string): LayoutCanvasDropZone | null {
  if (!id.startsWith(DROP_ZONE_ID_PREFIX)) return null

  const parts = id.slice(DROP_ZONE_ID_PREFIX.length).split(':')
  if (parts.length < 2 || parts.length > 3) return null

  const [serializedParentPath, indexToken, tabItemToken] = parts
  const index = Number(indexToken)
  if (!Number.isInteger(index) || index < 0) return null

  const parentPath = deserializeLayoutNodePath(serializedParentPath)
  if (parentPath === null) return null

  if (tabItemToken === undefined) {
    return { parentPath, index }
  }

  const tabItemParts = tabItemToken.split('.')
  if (tabItemParts.length !== 2 || tabItemParts[0] !== 'tabItem') return null

  const tabItemIndex = Number(tabItemParts[1])
  if (!Number.isInteger(tabItemIndex) || tabItemIndex < 0) return null

  return { parentPath, index, tabItemIndex }
}
