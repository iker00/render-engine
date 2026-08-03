// Pure tree-mutation primitives for `shell.header.menu` and `shell.sidebar.items`, addressed by a
// positional dot-notation `path`: '' is the root list, '0'/'1'/... are root nodes, '0.0'/'0.1'/...
// are their children, with no depth limit in the notation itself (depth limits are enforced by
// `isValidShellTreeDestination`'s `maxDepth`, not by `path`).
//
// This intentionally does not reuse `layout-tree-mutations.ts`: that module's `LayoutNodePath` is a
// structured path of `{ field, index }` steps across several distinct collection kinds (`children`,
// `template`, `tabItem`), which does not match the flat dot-notation this feature's spec requires.

export type ShellTreeDestination = { type: 'nest'; path: string } | { type: 'gap'; parentPath: string; index: number }

function segmentsOf(path: string): number[] {
  return path.split('.').map(Number)
}

function segmentDepth(pathOrParentPath: string): number {
  return pathOrParentPath === '' ? 0 : pathOrParentPath.split('.').length
}

function replaceAtIndex<T>(list: readonly T[], index: number, value: T): T[] {
  const next = list.slice()
  next[index] = value
  return next
}

function removeAtIndex<T>(list: readonly T[], index: number): T[] {
  const next = list.slice()
  next.splice(index, 1)
  return next
}

function insertAtIndex<T>(list: readonly T[], index: number, value: T): T[] {
  const next = list.slice()
  next.splice(index, 0, value)
  return next
}

/**
 * Rebuilds `tree` by applying `transform` to the node addressed by `segs` (a non-empty list of
 * root-relative indices), spreading every ancestor along the way without mutating the original
 * arrays or nodes.
 */
function replaceNodeAt<T extends { children?: T[] }>(
  tree: readonly T[],
  segs: number[],
  transform: (node: T) => T
): T[] {
  const [index, ...rest] = segs
  const node = tree[index]
  if (rest.length === 0) {
    return replaceAtIndex(tree, index, transform(node))
  }
  const updatedNode: T = { ...node, children: replaceNodeAt(node.children ?? [], rest, transform) }
  return replaceAtIndex(tree, index, updatedNode)
}

/**
 * Rebuilds `tree` by applying `transform` to the sibling list addressed by `segs` (the node whose
 * `children` array is being replaced; an empty `segs` addresses `tree` itself), spreading every
 * ancestor without mutating the original arrays or nodes.
 */
function replaceListAt<T extends { children?: T[] }>(
  tree: readonly T[],
  segs: number[],
  transform: (list: readonly T[]) => T[]
): T[] {
  if (segs.length === 0) return transform(tree)
  return replaceNodeAt(tree, segs, (node) => ({ ...node, children: transform(node.children ?? []) }))
}

export function getAtPath<T extends { children?: T[] }>(tree: readonly T[], path: string): T | null {
  if (path === '') return null
  let list: readonly T[] | undefined = tree
  let node: T | undefined
  for (const seg of segmentsOf(path)) {
    if (!list) return null
    node = list[seg]
    if (!node) return null
    list = node.children
  }
  return node ?? null
}

export function removeAtPath<T extends { children?: T[] }>(tree: readonly T[], path: string): T[] {
  const segs = segmentsOf(path)
  const lastIndex = segs[segs.length - 1]
  const parentSegs = segs.slice(0, -1)
  return replaceListAt(tree, parentSegs, (list) => removeAtIndex(list, lastIndex))
}

export function insertAtPath<T extends { children?: T[] }>(
  tree: readonly T[],
  parentPath: string,
  index: number,
  node: T
): T[] {
  const parentSegs = parentPath === '' ? [] : segmentsOf(parentPath)
  return replaceListAt(tree, parentSegs, (list) => insertAtIndex(list, index, node))
}

export function appendChildAtPath<T extends { children?: T[] }>(
  tree: readonly T[],
  targetPath: string,
  node: T
): T[] {
  return replaceNodeAt(tree, segmentsOf(targetPath), (target) => ({
    ...target,
    children: target.children === undefined ? [node] : [...target.children, node],
  }))
}

/**
 * `true` if `candidatePath` is `ofPath` itself or a descendant of it. Same anti-cycle criterion as
 * `isSameOrDescendantPath` in `layout-tree-mutations.ts`, adapted to string `path`s: descent is
 * recognized only through the `.` separator, so a textual prefix match without the separator
 * (`'01'` vs `'0'`) is not a false positive.
 */
export function isSelfOrDescendantPath(candidatePath: string, ofPath: string): boolean {
  return candidatePath === ofPath || candidatePath.startsWith(`${ofPath}.`)
}

export function subtreeHeight<T extends { children?: T[] }>(node: T): number {
  if (node.children === undefined) return 0
  // A node explicitly in "with children" mode but with a currently-empty array is not a leaf;
  // treat it the same as "children all leaves" rather than folding Math.max() over nothing.
  if (node.children.length === 0) return 1
  return 1 + Math.max(...node.children.map(subtreeHeight))
}

export function isValidShellTreeDestination<T extends { children?: T[] }>(
  tree: readonly T[],
  sourcePath: string,
  destination: ShellTreeDestination,
  maxDepth: number | null
): boolean {
  const destinationPath = destination.type === 'nest' ? destination.path : destination.parentPath
  if (isSelfOrDescendantPath(destinationPath, sourcePath)) return false
  if (maxDepth === null) return true

  const sourceNode = getAtPath(tree, sourcePath)
  if (!sourceNode) return false

  const targetDepth = segmentDepth(destinationPath)
  return targetDepth + subtreeHeight(sourceNode) <= maxDepth
}

function collectPathByNode<T extends { children?: T[] }>(
  tree: readonly T[],
  prefix: string,
  map: Map<T, string>
): void {
  tree.forEach((node, index) => {
    const path = prefix === '' ? String(index) : `${prefix}.${index}`
    map.set(node, path)
    if (node.children) collectPathByNode(node.children, path, map)
  })
}

function buildPathByNode<T extends { children?: T[] }>(tree: readonly T[]): Map<T, string> {
  const map = new Map<T, string>()
  collectPathByNode(tree, '', map)
  return map
}

/**
 * Combines `removeAtPath` with `insertAtPath`/`appendChildAtPath` (per `destination.type`); does
 * not validate the move itself — that is `isValidShellTreeDestination`'s responsibility, called
 * beforehand by the caller (same split of concerns as `movePathTo`/`isValidDropTarget` in
 * `layout-tree-mutations.ts`/`layout-drop-validity.ts`). Same-level reordering is just the
 * particular case `destination = { type: 'gap', parentPath: parentOf(sourcePath), index }`; there
 * is no separate `reorder()`.
 *
 * `destination.path`/`destination.parentPath` address the tree as the caller (and
 * `isValidShellTreeDestination`) saw it *before* removal. When the destination lives in the same
 * collection `sourcePath` is extracted from, both its address and any numeric index within that
 * collection go stale by exactly one position once `sourceNode` is gone — the same problem
 * `adjustParentPathForRemoval`/`adjustIndexForSiblingMove` solve in `layout-tree-mutations.ts`.
 * The destination node's address is re-resolved by identity against the post-removal tree
 * (sidesteps case-by-case ancestor arithmetic); the gap index is decremented by one only when the
 * gap belongs to the exact same parent list `sourcePath` was removed from, at a position after it.
 *
 * `pathRemap` is computed by a second identity diff over the final tree: every node (by reference)
 * is mapped to its `path` before mutating and again after, and the remap is the intersection of
 * both maps restricted to entries whose `path` actually changed. Since none of `removeAtPath`,
 * `insertAtPath` or `appendChildAtPath` clone the moved node or its descendants — they only rebuild
 * the ancestor chain around it — the moved subtree's internal object identities survive the move,
 * so this diff naturally covers both the moved node/its descendants and any siblings whose index
 * shifted as a side effect of the extraction/insertion.
 */
export function moveShellSubtree<T extends { children?: T[] }>(
  tree: readonly T[],
  sourcePath: string,
  destination: ShellTreeDestination
): { tree: T[]; pathRemap: Map<string, string> } {
  const sourceNode = getAtPath(tree, sourcePath)
  if (!sourceNode) {
    throw new Error('shell-tree-mutations: moveShellSubtree sourcePath does not resolve to an existing node')
  }

  const oldPathByNode = buildPathByNode(tree)

  const afterRemoval = removeAtPath(tree, sourcePath)

  const nextTree =
    destination.type === 'nest'
      ? appendChildAtPath(afterRemoval, resolvePathAfterRemoval(sourcePath, destination.path), sourceNode)
      : insertAtPath(
          afterRemoval,
          resolvePathAfterRemoval(sourcePath, destination.parentPath),
          resolveGapIndexAfterRemoval(sourcePath, destination),
          sourceNode
        )

  const newPathByNode = buildPathByNode(nextTree)

  const pathRemap = new Map<string, string>()
  for (const [node, oldPath] of oldPathByNode) {
    const newPath = newPathByNode.get(node)
    if (newPath !== undefined && newPath !== oldPath) {
      pathRemap.set(oldPath, newPath)
    }
  }

  return { tree: nextTree, pathRemap }
}

function parentPathOf(path: string): string {
  const dotIndex = path.lastIndexOf('.')
  return dotIndex === -1 ? '' : path.slice(0, dotIndex)
}

function lastIndexSegmentOf(path: string): number {
  const dotIndex = path.lastIndexOf('.')
  return Number(dotIndex === -1 ? path : path.slice(dotIndex + 1))
}

/**
 * Re-addresses `otherPath` (a node/list address as it read *before* `sourcePath` was removed) to
 * its equivalent address *after* that removal — pure path-segment arithmetic, the same kind of
 * adjustment `resolveGapIndexAfterRemoval` below already makes for a `gap`'s own numeric index,
 * generalized from a single index to an arbitrary path string.
 *
 * A single removal only ever changes indices within one sibling list: `sourcePath`'s own parent
 * list. Every other address — an ancestor of `sourcePath` (its immediate parent included), a
 * sibling positioned *before* `sourcePath` in that same list, or anything in an unrelated branch
 * — still reads correctly as-is. Only a sibling positioned *after* `sourcePath` in that exact list
 * has the corresponding path segment decremented by one; segments before and after that one
 * position are left untouched. `otherPath.length <= parentSegs.length` covers both `''` (the root
 * list itself) and any ancestor of `sourcePath` up to and including its immediate parent: none of
 * these have a segment *at* `parentSegs.length` to shift, so they fall through unchanged — this is
 * what a naive identity-based re-lookup against the post-removal tree gets wrong, since every
 * ancestor along `sourcePath`'s own chain is rebuilt (new object identity, same address) by
 * `removeAtPath`.
 */
function resolvePathAfterRemoval(sourcePath: string, otherPath: string): string {
  const sourceParentPath = parentPathOf(sourcePath)
  const parentSegs = sourceParentPath === '' ? [] : segmentsOf(sourceParentPath)
  const sourceIndex = lastIndexSegmentOf(sourcePath)
  const otherSegs = otherPath === '' ? [] : segmentsOf(otherPath)

  if (otherSegs.length <= parentSegs.length) return otherPath
  for (let i = 0; i < parentSegs.length; i++) {
    if (otherSegs[i] !== parentSegs[i]) return otherPath
  }
  if (otherSegs[parentSegs.length] <= sourceIndex) return otherPath

  const adjusted = otherSegs.slice()
  adjusted[parentSegs.length] -= 1
  return adjusted.join('.')
}

function resolveGapIndexAfterRemoval(
  sourcePath: string,
  destination: { type: 'gap'; parentPath: string; index: number }
): number {
  const sameParentList = parentPathOf(sourcePath) === destination.parentPath
  const sourceIndex = lastIndexSegmentOf(sourcePath)
  return sameParentList && sourceIndex < destination.index ? destination.index - 1 : destination.index
}
