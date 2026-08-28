import type { SidebarItemConfig } from '../../config/runtime-config-types'
import { MODE_LABELS, type MenuItemMode } from './menu-item-mode'

// `sidebarItem` shares the exact same four-mode vocabulary as `menuItem`/`menuItemChild`
// (none/href/action/children) and the same Spanish labels, so this module reuses `MenuItemMode`
// and `MODE_LABELS` from `menu-item-mode.ts` directly rather than redeclaring an identical type —
// nothing about `SidebarItemConfig` conflicts with that type's four string literals. What it
// cannot reuse is `computeMenuItemMode` itself: that helper is typed over
// `MenuItemConfig | MenuItemChildConfig` (the header's fixed two-shape contract, 0122-T1), while
// `sidebarItem` is genuinely recursive (0123-T1) — the same field shape at every depth, with no
// separate "child" type to narrow against.
export type { MenuItemMode }
export { MODE_LABELS }

// Same seed convention as the header's `NEW_ROOT_ITEM_LABEL` (`shell-menu-list-editor.tsx`) and
// `NEW_CHILD_LABEL` (`menu-item-mode.ts`): a freshly added row — at the root or inside any
// `children` sublist — must itself satisfy `refineSidebarItemShape` (0123-T1: exactly one of
// href/action/children), so both are seeded with an empty `href`. Kept as two distinct constants
// (same value) so each call site documents its own intent, matching the header's precedent.
export const NEW_ROOT_ITEM_LABEL = 'Nuevo elemento'
export const NEW_CHILD_LABEL = 'Nuevo elemento'

/** Same mode-detection logic as `computeMenuItemMode`, adapted to the recursive `SidebarItemConfig` shape. */
export function computeSidebarItemMode(item: SidebarItemConfig): MenuItemMode {
  if (item.children !== undefined) return 'children'
  if (item.href !== undefined) return 'href'
  if (item.action !== undefined) return 'action'
  return 'none'
}
