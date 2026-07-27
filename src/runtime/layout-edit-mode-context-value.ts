import { createContext } from 'react'
import type { LayoutNodePath } from './layout-node-path'

// Discriminated union (design.md feature 0103, Decisión 9): distinguishes "provider mounted"
// from "Editor mode actually active" so consumers can tell apart three effective states via
// useLayoutEditModeContext():
// - `null` — no provider at all (real production/preview rendering). Byte-identical guarantee.
// - `{ active: false }` — provider mounted, Visual mode inside DevRuntime. Selection/hover
//   wrapper and field fieldsets stay present in the DOM (so toggling never remounts a node),
//   but inert: no outline, no click-to-select, fieldset not disabled, declarative actions not
//   suppressed.
// - `{ active: true, ... }` — Editor mode, same behavior "context !== null" already had before
//   this type existed.
export type LayoutEditModeContextValue =
  | { active: false }
  | {
      active: true
      selectedPath: LayoutNodePath | null
      hoveredPath: LayoutNodePath | null
      onSelectNode: (path: LayoutNodePath) => void
      onHoverNode: (path: LayoutNodePath | null) => void
    }

export const LayoutEditModeContext = createContext<LayoutEditModeContextValue | null>(null)
