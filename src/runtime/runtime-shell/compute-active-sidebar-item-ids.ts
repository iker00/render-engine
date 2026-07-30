import type { SidebarItemConfig } from '../../config/runtime-config-types'

export interface ActiveSidebarItemState {
  readonly activePaths: ReadonlySet<string>
}

// `path` encoding: root items use their index as a string (`"0"`); a nested item uses
// `${parentPath}.children.${index}` (e.g. `"0.children.2.children.1"`). Stable within a single
// `sidebar.items` tree, not a public API.
function isActiveNavigateTarget(item: SidebarItemConfig, activePageId: string): boolean {
  return item.action?.type === 'navigateTo' && item.action.pageId === activePageId
}

function collectActivePaths(
  items: readonly SidebarItemConfig[],
  path: string,
  activePageId: string,
  activePaths: Set<string>,
): boolean {
  let anyActive = false

  items.forEach((item, index) => {
    const itemPath = `${path}${index}`

    const hasActiveDescendant = item.children
      ? collectActivePaths(item.children, `${itemPath}.children.`, activePageId, activePaths)
      : false

    if (isActiveNavigateTarget(item, activePageId) || hasActiveDescendant) {
      activePaths.add(itemPath)
      anyActive = true
    }
  })

  return anyActive
}

export function computeActiveSidebarItemIds(
  items: readonly SidebarItemConfig[] | undefined,
  activePageId: string | null,
): ActiveSidebarItemState {
  if (!items || items.length === 0 || activePageId === null) {
    return { activePaths: new Set() }
  }

  const activePaths = new Set<string>()
  collectActivePaths(items, '', activePageId, activePaths)

  return { activePaths }
}
