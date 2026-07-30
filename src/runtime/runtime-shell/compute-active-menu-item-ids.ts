import type { MenuItemChildConfig, MenuItemConfig } from '../../config/runtime-config-types'

export interface ActiveMenuItemState {
  readonly activePaths: ReadonlySet<string>
}

// `path` encoding: root items use their index as a string (`"0"`); children use
// `${rootIndex}.${childIndex}` (e.g. `"2.1"`). Stable within a single `menu` array, not a public API.
function isActiveNavigateTarget(item: MenuItemConfig | MenuItemChildConfig, activePageId: string): boolean {
  return item.action?.type === 'navigateTo' && item.action.pageId === activePageId
}

export function computeActiveMenuItemIds(
  menu: readonly MenuItemConfig[] | undefined,
  activePageId: string | null,
): ActiveMenuItemState {
  if (!menu || menu.length === 0 || activePageId === null) {
    return { activePaths: new Set() }
  }

  const activePaths = new Set<string>()

  menu.forEach((item, rootIndex) => {
    const rootPath = String(rootIndex)

    if (isActiveNavigateTarget(item, activePageId)) {
      activePaths.add(rootPath)
    }

    item.children?.forEach((child, childIndex) => {
      if (isActiveNavigateTarget(child, activePageId)) {
        activePaths.add(`${rootPath}.${childIndex}`)
        activePaths.add(rootPath)
      }
    })
  })

  return { activePaths }
}
