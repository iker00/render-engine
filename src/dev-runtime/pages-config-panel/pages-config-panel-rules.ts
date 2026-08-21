import type { RuntimePageConfig } from '../../config/runtime-config-types'

export function normalizePageId(rawId: string): string {
  return rawId.trim()
}

export function isDuplicatePageId(normalizedId: string, pages: RuntimePageConfig[]): boolean {
  if (normalizedId === '') {
    return false
  }

  return pages.some((page) => page.id === normalizedId)
}

export function getPageDeleteBlockedReason(
  pageId: string,
  pages: RuntimePageConfig[],
  initialPage: string
): string | null {
  if (pages.length <= 1) {
    return 'No se puede eliminar la única página restante.'
  }

  if (pageId === initialPage) {
    return 'No se puede eliminar la página inicial. Cambia primero la página inicial.'
  }

  return null
}
