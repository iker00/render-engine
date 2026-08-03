// Pure collapse-state primitives for the shell config panel's tree UI, indexed by the same flat
// dot-notation `path` convention as `shell-tree-mutations.ts` ('0', '0.1', ...). Absence of an
// entry means collapsed (the default, post-implementation simplification — every row starts
// collapsed); an explicit `false` entry means expanded. Deliberately has no dependency on
// `MenuItemConfig`/`SidebarItemConfig` so a single hook instance works for both
// `shell.header.menu` and `shell.sidebar.items` trees without generics.

import { useCallback, useState } from 'react'

export type ShellCollapseState = ReadonlyMap<string, boolean>

export function isShellPathCollapsed(state: ShellCollapseState, path: string): boolean {
  return state.get(path) !== false
}

export function toggleShellCollapse(state: ShellCollapseState, path: string): Map<string, boolean> {
  const next = new Map(state)
  next.set(path, !isShellPathCollapsed(state, path))
  return next
}

/**
 * Forces `path` to expanded regardless of its current entry — used when a row is created (so a
 * freshly added item opens with its fields ready to fill in, instead of collapsed like the rest
 * of the tree by default) rather than toggled from whatever state it happened to be in.
 */
export function expandShellPath(state: ShellCollapseState, path: string): Map<string, boolean> {
  const next = new Map(state)
  next.set(path, false)
  return next
}

/**
 * Rewrites every entry of `state` whose `path` appears in `pathRemap` to its new `path`, keeping
 * its collapse boolean untouched; entries whose `path` is absent from `pathRemap` (the node did
 * not move) are carried over unchanged. Applying this after a `moveShellSubtree` call is enough to
 * preserve a moved subtree's collapse state without any move-specific logic here, because
 * `moveShellSubtree`'s `pathRemap` already contains one entry per descendant of the moved subtree.
 */
export function remapShellCollapseState(
  state: ShellCollapseState,
  pathRemap: ReadonlyMap<string, string>
): Map<string, boolean> {
  const next = new Map<string, boolean>()
  for (const [path, collapsed] of state) {
    next.set(pathRemap.get(path) ?? path, collapsed)
  }
  return next
}

/**
 * Owns a single tree's collapse state (`shell.header.menu` or `shell.sidebar.items`); one instance
 * per tree, kept and passed down by `ShellConfigPanel`.
 */
export function useShellCollapseState(): {
  isCollapsed: (path: string) => boolean
  toggleCollapse: (path: string) => void
  expand: (path: string) => void
  applyPathRemap: (pathRemap: ReadonlyMap<string, string>) => void
} {
  const [state, setState] = useState<Map<string, boolean>>(() => new Map())

  const isCollapsed = useCallback((path: string) => isShellPathCollapsed(state, path), [state])

  const toggleCollapse = useCallback((path: string) => {
    setState((current) => toggleShellCollapse(current, path))
  }, [])

  const expand = useCallback((path: string) => {
    setState((current) => expandShellPath(current, path))
  }, [])

  const applyPathRemap = useCallback((pathRemap: ReadonlyMap<string, string>) => {
    setState((current) => remapShellCollapseState(current, pathRemap))
  }, [])

  return { isCollapsed, toggleCollapse, expand, applyPathRemap }
}
