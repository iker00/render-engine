import type { SidebarItemConfig } from '../../config/runtime-config-types'
import { IconNode } from '../nodes/icon-node'
import { getAppShellSidebarGlyphClassName } from '../runtime-node-styling-app-shell-sidebar'
import { resolveSidebarItemGlyph } from './resolve-sidebar-item-glyph'

// Icon-vs-glyph resolution shared by rail mode (`app-shell-sidebar.tsx`) and `SidebarRailFlyout`
// (design decisión 8): a `sidebarItem` without `icon` falls back to the first letter of its
// resolved `label` wherever a glyph fallback applies (`showGlyphFallback`). The ordinary expanded
// sidebar keeps its long-standing behaviour of rendering nothing when `icon` is absent, by never
// opting in. Kept in its own module (not exported from `app-shell-sidebar.tsx`) purely so that
// file's exports stay component-only for fast refresh.
export function renderSidebarItemGlyphOrIcon(item: SidebarItemConfig, label: string, showGlyphFallback: boolean) {
  if (item.icon || !showGlyphFallback) {
    return <IconNode name={item.icon} className="size-4 shrink-0" />
  }

  return (
    <span aria-hidden="true" className={getAppShellSidebarGlyphClassName()}>
      {resolveSidebarItemGlyph(label)}
    </span>
  )
}
