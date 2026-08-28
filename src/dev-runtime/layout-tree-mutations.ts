import type { LayoutNode, TableCellNode, TableCellValue } from '../config/runtime-config'
import type { StepsItem, TabsItem } from '../config/runtime-config-types'
import { getNodeAtPath, type LayoutNodePath, type LayoutPathStep } from '../runtime/layout-node-path'

export { getNodeAtPath }

export interface InsertNodeAtOptions {
  tabItemIndex?: number
  stepItemIndex?: number
}

export interface MovePathToOptions {
  toTabItemIndex?: number
  toStepItemIndex?: number
}

interface ResolvedPathFrame {
  step: LayoutPathStep
  collection: readonly LayoutNode[]
  parentNode: LayoutNode | null
}

function getChildNodesCollection(node: LayoutNode): readonly LayoutNode[] {
  const children = (node as { children?: unknown }).children
  return Array.isArray(children) ? (children as LayoutNode[]) : []
}

/**
 * A table cell resolved by a `row`/`cells` path step is either a `TableCellNode` (a nested
 * layout node) or a plain primitive. Paths are only ever built to point at the former, so a
 * primitive here is a defensive type guard, not a case that occurs in the normal flow — same
 * predicate shape as `layout-node-path.ts`'s `isTableCellNodeValue` (T1).
 */
function isTableCellNodeValue(value: TableCellValue): value is TableCellNode {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function replaceAtIndex(collection: readonly LayoutNode[], index: number, value: LayoutNode): LayoutNode[] {
  const next = collection.slice()
  next[index] = value
  return next
}

function removeAtIndex(collection: readonly LayoutNode[], index: number): LayoutNode[] {
  const next = collection.slice()
  next.splice(index, 1)
  return next
}

function insertAtIndex(collection: readonly LayoutNode[], index: number, value: LayoutNode): LayoutNode[] {
  const next = collection.slice()
  next.splice(index, 0, value)
  return next
}

function withChildren(node: LayoutNode, children: LayoutNode[]): LayoutNode {
  switch (node.type) {
    case 'container':
    case 'form':
    case 'modal':
    case 'link':
    case 'accordion':
      return { ...node, children }
    default:
      throw new Error(`layout-tree-mutations: node type "${node.type}" does not have a children collection`)
  }
}

function withTemplate(node: LayoutNode, template: LayoutNode[]): LayoutNode {
  if (node.type !== 'repeater') {
    throw new Error(`layout-tree-mutations: node type "${node.type}" does not have a props.template collection`)
  }
  return { ...node, props: { ...node.props, template } }
}

function withTabItemChildren(node: LayoutNode, itemIndex: number, children: LayoutNode[]): LayoutNode {
  if (node.type !== 'tabs') {
    throw new Error(`layout-tree-mutations: node type "${node.type}" does not have tabs items`)
  }
  const items = node.props.items
  if (itemIndex < 0 || itemIndex >= items.length) {
    throw new Error(`layout-tree-mutations: no tabs item at index ${itemIndex}`)
  }
  const newItems = items.map((item, i) => (i === itemIndex ? { ...item, children } : item))
  return { ...node, props: { ...node.props, items: newItems } }
}

function withStepItemChildren(node: LayoutNode, itemIndex: number, children: LayoutNode[]): LayoutNode {
  if (node.type !== 'steps') {
    throw new Error(`layout-tree-mutations: node type "${node.type}" does not have steps items`)
  }
  const items = node.props.items
  if (itemIndex < 0 || itemIndex >= items.length) {
    throw new Error(`layout-tree-mutations: no steps item at index ${itemIndex}`)
  }
  const newItems = items.map((item, i) => (i === itemIndex ? { ...item, children } : item))
  return { ...node, props: { ...node.props, items: newItems } }
}

function withTableRow(node: LayoutNode, rowIndex: number, row: TableCellValue[]): LayoutNode {
  if (node.type !== 'table') {
    throw new Error(`layout-tree-mutations: node type "${node.type}" does not have a props.rows collection`)
  }
  if (!Array.isArray(node.props.rows)) {
    throw new Error('layout-tree-mutations: table node is in dynamic mode, cannot set a "row" collection')
  }
  const newRows = node.props.rows.map((existingRow, i) => (i === rowIndex ? row : existingRow))
  return { ...node, props: { ...node.props, rows: newRows } }
}

function withTableDynamicCells(node: LayoutNode, cells: TableCellValue[]): LayoutNode {
  if (node.type !== 'table') {
    throw new Error(`layout-tree-mutations: node type "${node.type}" does not have a props.rows collection`)
  }
  if (Array.isArray(node.props.rows)) {
    throw new Error('layout-tree-mutations: table node is in manual mode, cannot set a "cells" collection')
  }
  return {
    ...node,
    props: {
      ...node.props,
      rows: { source: node.props.rows.source, cells: cells as (string | TableCellNode)[] },
    },
  }
}

function setNodeCollection(node: LayoutNode, step: LayoutPathStep, collection: LayoutNode[]): LayoutNode {
  if (step.field === 'children') return withChildren(node, collection)
  if (step.field === 'template') return withTemplate(node, collection)
  if (step.field === 'row') return withTableRow(node, step.rowIndex, collection as unknown as TableCellValue[])
  if (step.field === 'cells') return withTableDynamicCells(node, collection as unknown as TableCellValue[])
  if (step.field === 'tabItem') return withTabItemChildren(node, step.itemIndex, collection)
  return withStepItemChildren(node, step.itemIndex, collection)
}

/**
 * Walks `path` from `rootNodes`, recording at each step the collection the step's
 * index was read from and the node that owns that collection (`null` for the root
 * array). Throws if any step fails to resolve to an existing node.
 */
function resolvePathFrames(
  rootNodes: readonly LayoutNode[],
  path: LayoutNodePath
): { frames: ResolvedPathFrame[]; targetNode: LayoutNode } {
  if (path.length === 0) {
    throw new Error('layout-tree-mutations: path must address an existing node, got an empty path')
  }

  let currentNodes: readonly LayoutNode[] = rootNodes
  let currentNode: LayoutNode | null = null
  const frames: ResolvedPathFrame[] = []

  for (const step of path) {
    if (step.field === 'children') {
      frames.push({ step, collection: currentNodes, parentNode: currentNode })
      const candidate = currentNodes[step.index]
      if (!candidate) {
        throw new Error(`layout-tree-mutations: path does not resolve, no node at children[${step.index}]`)
      }
      currentNode = candidate
      currentNodes = getChildNodesCollection(candidate)
      continue
    }

    if (step.field === 'template') {
      if (currentNode === null || currentNode.type !== 'repeater') {
        throw new Error('layout-tree-mutations: path does not resolve, "template" step requires a repeater node')
      }
      const template: LayoutNode[] = currentNode.props.template
      frames.push({ step, collection: template, parentNode: currentNode })
      const candidate: LayoutNode | undefined = template[step.index]
      if (!candidate) {
        throw new Error(`layout-tree-mutations: path does not resolve, no node at template[${step.index}]`)
      }
      currentNode = candidate
      currentNodes = getChildNodesCollection(candidate)
      continue
    }

    if (step.field === 'row') {
      if (currentNode === null || currentNode.type !== 'table' || !Array.isArray(currentNode.props.rows)) {
        throw new Error('layout-tree-mutations: path does not resolve, "row" step requires a table node in manual mode')
      }
      const row: TableCellValue[] | undefined = currentNode.props.rows[step.rowIndex]
      if (!row) {
        throw new Error(`layout-tree-mutations: path does not resolve, no row at rows[${step.rowIndex}]`)
      }
      frames.push({ step, collection: row as unknown as LayoutNode[], parentNode: currentNode })
      const candidate: TableCellValue | undefined = row[step.index]
      if (candidate === undefined || !isTableCellNodeValue(candidate)) {
        throw new Error(
          `layout-tree-mutations: path does not resolve, no table cell node at row[${step.rowIndex}][${step.index}]`
        )
      }
      currentNode = candidate
      currentNodes = getChildNodesCollection(candidate)
      continue
    }

    if (step.field === 'cells') {
      if (currentNode === null || currentNode.type !== 'table' || Array.isArray(currentNode.props.rows)) {
        throw new Error('layout-tree-mutations: path does not resolve, "cells" step requires a table node in dynamic mode')
      }
      const cells: (string | TableCellNode)[] = currentNode.props.rows.cells
      frames.push({ step, collection: cells as unknown as LayoutNode[], parentNode: currentNode })
      const candidate: string | TableCellNode | undefined = cells[step.index]
      if (candidate === undefined || !isTableCellNodeValue(candidate)) {
        throw new Error(`layout-tree-mutations: path does not resolve, no table cell node at cells[${step.index}]`)
      }
      currentNode = candidate
      currentNodes = getChildNodesCollection(candidate)
      continue
    }

    if (step.field === 'tabItem') {
      if (currentNode === null || currentNode.type !== 'tabs') {
        throw new Error('layout-tree-mutations: path does not resolve, "tabItem" step requires a tabs node')
      }
      const item: TabsItem | undefined = currentNode.props.items[step.itemIndex]
      if (!item) {
        throw new Error(`layout-tree-mutations: path does not resolve, no tabs item at index ${step.itemIndex}`)
      }
      const tabItemChildren: LayoutNode[] = item.children ?? []
      frames.push({ step, collection: tabItemChildren, parentNode: currentNode })
      const candidate: LayoutNode | undefined = tabItemChildren[step.index]
      if (!candidate) {
        throw new Error(
          `layout-tree-mutations: path does not resolve, no node at tabItem[${step.itemIndex}][${step.index}]`
        )
      }
      currentNode = candidate
      currentNodes = getChildNodesCollection(candidate)
      continue
    }

    if (currentNode === null || currentNode.type !== 'steps') {
      throw new Error('layout-tree-mutations: path does not resolve, "stepItem" step requires a steps node')
    }
    const item: StepsItem | undefined = currentNode.props.items[step.itemIndex]
    if (!item) {
      throw new Error(`layout-tree-mutations: path does not resolve, no steps item at index ${step.itemIndex}`)
    }
    const stepItemChildren: LayoutNode[] = item.children ?? []
    frames.push({ step, collection: stepItemChildren, parentNode: currentNode })
    const candidate: LayoutNode | undefined = stepItemChildren[step.index]
    if (!candidate) {
      throw new Error(
        `layout-tree-mutations: path does not resolve, no node at stepItem[${step.itemIndex}][${step.index}]`
      )
    }
    currentNode = candidate
    currentNodes = getChildNodesCollection(candidate)
  }

  if (currentNode === null) {
    throw new Error('layout-tree-mutations: path did not resolve to a node')
  }

  return { frames, targetNode: currentNode }
}

/**
 * Rebuilds the root array by applying `applyToLeafCollection` to the collection of
 * the deepest frame, then folding the result back up through every ancestor
 * collection without mutating any of the original arrays or nodes.
 */
function rebuildFromFrames(
  frames: ResolvedPathFrame[],
  applyToLeafCollection: (leafCollection: readonly LayoutNode[]) => LayoutNode[]
): LayoutNode[] {
  const lastIndex = frames.length - 1
  let newCollection = applyToLeafCollection(frames[lastIndex].collection)

  for (let i = lastIndex; i > 0; i--) {
    const frame = frames[i]
    const parentFrame = frames[i - 1]
    const updatedParentNode = setNodeCollection(frame.parentNode as LayoutNode, frame.step, newCollection)
    newCollection = replaceAtIndex(parentFrame.collection, parentFrame.step.index, updatedParentNode)
  }

  return newCollection
}

export function replaceNodeAt(
  rootNodes: readonly LayoutNode[],
  path: LayoutNodePath,
  updater: (node: LayoutNode) => LayoutNode
): LayoutNode[] {
  const { frames, targetNode } = resolvePathFrames(rootNodes, path)
  const replacement = updater(targetNode)
  const lastFrame = frames[frames.length - 1]
  return rebuildFromFrames(frames, (leafCollection) => replaceAtIndex(leafCollection, lastFrame.step.index, replacement))
}

export function removeNodeAt(rootNodes: readonly LayoutNode[], path: LayoutNodePath): LayoutNode[] {
  const { frames } = resolvePathFrames(rootNodes, path)
  const lastFrame = frames[frames.length - 1]
  return rebuildFromFrames(frames, (leafCollection) => removeAtIndex(leafCollection, lastFrame.step.index))
}

function insertIntoParentNode(
  parentNode: LayoutNode,
  index: number,
  newNode: LayoutNode,
  options?: InsertNodeAtOptions
): LayoutNode {
  const tabItemIndex = options?.tabItemIndex
  const stepItemIndex = options?.stepItemIndex

  if (parentNode.type === 'tabs') {
    if (tabItemIndex === undefined) {
      throw new Error('layout-tree-mutations: insertNodeAt into a tabs node requires options.tabItemIndex')
    }
    const items = parentNode.props.items
    const item = items[tabItemIndex]
    if (!item) {
      throw new Error(`layout-tree-mutations: tabs node has no item at index ${tabItemIndex}`)
    }
    const children = insertAtIndex(item.children ?? [], index, newNode)
    return withTabItemChildren(parentNode, tabItemIndex, children)
  }

  if (tabItemIndex !== undefined) {
    throw new Error('layout-tree-mutations: options.tabItemIndex only applies when the target node is a tabs node')
  }

  if (parentNode.type === 'steps') {
    if (stepItemIndex === undefined) {
      throw new Error('layout-tree-mutations: insertNodeAt into a steps node requires options.stepItemIndex')
    }
    const items = parentNode.props.items
    const item = items[stepItemIndex]
    if (!item) {
      throw new Error(`layout-tree-mutations: steps node has no item at index ${stepItemIndex}`)
    }
    const children = insertAtIndex(item.children ?? [], index, newNode)
    return withStepItemChildren(parentNode, stepItemIndex, children)
  }

  if (stepItemIndex !== undefined) {
    throw new Error('layout-tree-mutations: options.stepItemIndex only applies when the target node is a steps node')
  }

  if (parentNode.type === 'repeater') {
    const template = insertAtIndex(parentNode.props.template, index, newNode)
    return withTemplate(parentNode, template)
  }

  if (
    parentNode.type === 'container' ||
    parentNode.type === 'form' ||
    parentNode.type === 'modal' ||
    parentNode.type === 'link' ||
    parentNode.type === 'accordion'
  ) {
    const children = insertAtIndex(parentNode.children ?? [], index, newNode)
    return withChildren(parentNode, children)
  }

  throw new Error(`layout-tree-mutations: node type "${parentNode.type}" does not accept children`)
}

export function insertNodeAt(
  rootNodes: readonly LayoutNode[],
  parentPath: LayoutNodePath,
  index: number,
  newNode: LayoutNode,
  options?: InsertNodeAtOptions
): LayoutNode[] {
  if (parentPath.length === 0) {
    return insertAtIndex(rootNodes, index, newNode)
  }

  const { frames, targetNode } = resolvePathFrames(rootNodes, parentPath)
  const updatedParentNode = insertIntoParentNode(targetNode, index, newNode, options)
  const lastFrame = frames[frames.length - 1]
  return rebuildFromFrames(frames, (leafCollection) =>
    replaceAtIndex(leafCollection, lastFrame.step.index, updatedParentNode)
  )
}

function stepsEqual(a: LayoutPathStep, b: LayoutPathStep): boolean {
  if (a.field !== b.field || a.index !== b.index) return false
  if (a.field === 'tabItem' && b.field === 'tabItem') return a.itemIndex === b.itemIndex
  if (a.field === 'stepItem' && b.field === 'stepItem') return a.itemIndex === b.itemIndex
  if (a.field === 'row' && b.field === 'row') return a.rowIndex === b.rowIndex
  return true
}

function isSamePath(a: LayoutNodePath, b: LayoutNodePath): boolean {
  if (a.length !== b.length) return false
  return a.every((step, i) => stepsEqual(step, b[i]))
}

/**
 * Exported (not just used internally by `movePathTo`) so the drop-validity engine
 * (`layout-drop-validity.ts`, T13) can reuse the exact same cycle criterion instead of
 * reimplementing it — dragging a node onto itself or one of its own descendants.
 */
export function isSameOrDescendantPath(ancestorPath: LayoutNodePath, candidatePath: LayoutNodePath): boolean {
  if (candidatePath.length < ancestorPath.length) return false
  return ancestorPath.every((step, i) => stepsEqual(step, candidatePath[i]))
}

function getSourceParentDescriptor(fromPath: LayoutNodePath): {
  parentPath: LayoutNodePath
  tabItemIndex: number | undefined
  stepItemIndex: number | undefined
  index: number
} {
  const lastStep = fromPath[fromPath.length - 1]
  const parentPath = fromPath.slice(0, -1)
  if (lastStep.field === 'tabItem') {
    return { parentPath, tabItemIndex: lastStep.itemIndex, stepItemIndex: undefined, index: lastStep.index }
  }
  if (lastStep.field === 'stepItem') {
    return { parentPath, tabItemIndex: undefined, stepItemIndex: lastStep.itemIndex, index: lastStep.index }
  }
  return { parentPath, tabItemIndex: undefined, stepItemIndex: undefined, index: lastStep.index }
}

function adjustIndexForSiblingMove(
  fromPath: LayoutNodePath,
  toParentPath: LayoutNodePath,
  toIndex: number,
  toTabItemIndex: number | undefined,
  toStepItemIndex: number | undefined
): number {
  const source = getSourceParentDescriptor(fromPath)
  const sameParent =
    isSamePath(source.parentPath, toParentPath) &&
    source.tabItemIndex === toTabItemIndex &&
    source.stepItemIndex === toStepItemIndex
  if (sameParent && source.index < toIndex) {
    return toIndex - 1
  }
  return toIndex
}

function stepsReferenceSameCollection(a: LayoutPathStep, b: LayoutPathStep): boolean {
  if (a.field !== b.field) return false
  if (a.field === 'tabItem' && b.field === 'tabItem') return a.itemIndex === b.itemIndex
  if (a.field === 'stepItem' && b.field === 'stepItem') return a.itemIndex === b.itemIndex
  if (a.field === 'row' && b.field === 'row') return a.rowIndex === b.rowIndex
  return true
}

/**
 * `removeNodeAt(rootNodes, fromPath)` shifts down the indices of every sibling that came
 * after the removed node within its own collection. `toParentPath` is always computed
 * against the pre-removal tree (the DOM the user actually dragged over), so when it
 * addresses a node that lives in that very same collection — the case where the dragged
 * node and the drop target are themselves siblings, directly or through a shared ancestor
 * step — it goes stale by exactly one position. `movePathTo` must correct it before calling
 * `insertNodeAt` on the post-removal tree.
 */
function adjustParentPathForRemoval(
  fromPath: LayoutNodePath,
  toParentPath: LayoutNodePath,
  toTabItemIndex: number | undefined,
  toStepItemIndex: number | undefined
): LayoutNodePath {
  if (fromPath.length === 0) return toParentPath

  const sourceParentPath = fromPath.slice(0, -1)
  const lastFromStep = fromPath[fromPath.length - 1]

  const targetsSourceCollection =
    lastFromStep.field === 'tabItem'
      ? toTabItemIndex === lastFromStep.itemIndex
      : lastFromStep.field === 'stepItem'
        ? toStepItemIndex === lastFromStep.itemIndex
        : toTabItemIndex === undefined && toStepItemIndex === undefined

  if (isSamePath(sourceParentPath, toParentPath) && targetsSourceCollection) {
    // Case A: removal and insertion happen in the exact same collection — toParentPath
    // itself does not change; adjustIndexForSiblingMove still owns the toIndex shift.
    return toParentPath
  }

  const isStrictDescendant =
    toParentPath.length > sourceParentPath.length &&
    sourceParentPath.every((step, i) => stepsEqual(step, toParentPath[i]))

  if (!isStrictDescendant) {
    // Case C: unrelated paths (disjoint subtrees, or toParentPath too shallow to be affected).
    return toParentPath
  }

  const divergentStep = toParentPath[sourceParentPath.length]
  if (!stepsReferenceSameCollection(divergentStep, lastFromStep) || divergentStep.index <= lastFromStep.index) {
    return toParentPath
  }

  // Case B: toParentPath descends through the same collection the removal shifted, at a
  // step that addressed a sibling positioned after the removed node — decrement it by one.
  return toParentPath.map((step, i) =>
    i === sourceParentPath.length ? { ...step, index: step.index - 1 } : step
  )
}

function findPathWithinChildren(
  children: readonly LayoutNode[],
  target: LayoutNode,
  stepForChild: (index: number) => LayoutPathStep
): LayoutNodePath | null {
  for (let index = 0; index < children.length; index++) {
    const child = children[index]
    if (child === target) return [stepForChild(index)]

    const nestedPath = findPathWithinNode(child, target)
    if (nestedPath !== null) return [stepForChild(index), ...nestedPath]
  }
  return null
}

function findPathWithinNode(node: LayoutNode, target: LayoutNode): LayoutNodePath | null {
  if (node.type === 'repeater') {
    return findPathWithinChildren(node.props.template, target, (index) => ({ field: 'template', index }))
  }

  if (node.type === 'tabs') {
    for (let itemIndex = 0; itemIndex < node.props.items.length; itemIndex++) {
      const item: TabsItem = node.props.items[itemIndex]
      const found = findPathWithinChildren(item.children ?? [], target, (index) => ({
        field: 'tabItem',
        itemIndex,
        index,
      }))
      if (found !== null) return found
    }
    return null
  }

  if (node.type === 'steps') {
    for (let itemIndex = 0; itemIndex < node.props.items.length; itemIndex++) {
      const item: StepsItem = node.props.items[itemIndex]
      const found = findPathWithinChildren(item.children ?? [], target, (index) => ({
        field: 'stepItem',
        itemIndex,
        index,
      }))
      if (found !== null) return found
    }
    return null
  }

  if (node.type === 'table') {
    const rows = node.props.rows
    if (Array.isArray(rows)) {
      for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
        const found = findPathWithinChildren(rows[rowIndex] as unknown as LayoutNode[], target, (index) => ({
          field: 'row',
          rowIndex,
          index,
        }))
        if (found !== null) return found
      }
      return null
    }
    return findPathWithinChildren(rows.cells as unknown as LayoutNode[], target, (index) => ({
      field: 'cells',
      index,
    }))
  }

  return findPathWithinChildren(getChildNodesCollection(node), target, (index) => ({ field: 'children', index }))
}

/**
 * Locates `target` inside `rootNodes` by object identity (not deep equality), returning the
 * `LayoutNodePath` that resolves to it via `getNodeAtPath`, or `null` if `target` is not
 * present. Used by the canvas (T14) to recompute the selected node's path right after a
 * `movePathTo` commit: `movePathTo` never clones the moved node itself (only the collections
 * around it), so the exact object reference removed from `fromPath` is the same one that ends
 * up inserted at its new location — searching by identity finds that new location without
 * duplicating `movePathTo`'s own index-adjustment logic.
 */
export function findNodePath(rootNodes: readonly LayoutNode[], target: LayoutNode): LayoutNodePath | null {
  return findPathWithinChildren(rootNodes, target, (index) => ({ field: 'children', index }))
}

export function movePathTo(
  rootNodes: readonly LayoutNode[],
  fromPath: LayoutNodePath,
  toParentPath: LayoutNodePath,
  toIndex: number,
  options?: MovePathToOptions
): LayoutNode[] {
  if (isSameOrDescendantPath(fromPath, toParentPath)) {
    throw new Error('layout-tree-mutations: movePathTo target must not be fromPath itself or one of its descendants')
  }

  const movedNode = getNodeAtPath(rootNodes, fromPath)
  if (!movedNode) {
    throw new Error('layout-tree-mutations: movePathTo fromPath does not resolve to an existing node')
  }

  const adjustedToIndex = adjustIndexForSiblingMove(
    fromPath,
    toParentPath,
    toIndex,
    options?.toTabItemIndex,
    options?.toStepItemIndex
  )
  const adjustedToParentPath = adjustParentPathForRemoval(
    fromPath,
    toParentPath,
    options?.toTabItemIndex,
    options?.toStepItemIndex
  )

  const afterRemoval = removeNodeAt(rootNodes, fromPath)
  return insertNodeAt(afterRemoval, adjustedToParentPath, adjustedToIndex, movedNode, {
    tabItemIndex: options?.toTabItemIndex,
    stepItemIndex: options?.toStepItemIndex,
  })
}
