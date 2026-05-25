export interface CollectionPaginationPage<T> {
  totalItems: number
  totalPages: number
  currentPage: number
  canGoPrevious: boolean
  canGoNext: boolean
  visibleItems: T[]
}

export interface CollectionPaginationModel<T> {
  totalItems: number
  totalPages: number
  pageSize: number
  getPage: (requestedPage: number) => CollectionPaginationPage<T>
}

export interface NumberedPaginationWindowInput {
  currentPage: number
  totalPages: number
}

export interface CollectionScrollWindow<T> {
  totalItems: number
  pageSize: number
  visibleCount: number
  canShowMore: boolean
  visibleItems: T[]
}

export function createCollectionPaginationModel<T>(items: readonly T[], pageSize: number): CollectionPaginationModel<T> {
  const totalItems = items.length
  const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / pageSize)
  const pages = materializePages(items, pageSize, totalPages)

  return {
    totalItems,
    totalPages,
    pageSize,
    getPage(requestedPage) {
      const currentPage = normalizePage(requestedPage, totalPages)
      const visibleItems = currentPage === 0 ? [] : pages[currentPage - 1] ?? []

      return {
        totalItems,
        totalPages,
        currentPage,
        canGoPrevious: currentPage > 1,
        canGoNext: currentPage > 0 && currentPage < totalPages,
        visibleItems,
      }
    },
  }
}

export function createNumberedPaginationWindow({ currentPage, totalPages }: NumberedPaginationWindowInput): number[] {
  if (totalPages === 0) {
    return []
  }

  const normalizedPage = normalizePage(currentPage, totalPages)
  const windowSize = Math.min(totalPages, 5)
  const unclampedStart = normalizedPage - Math.floor(windowSize / 2)
  const maxStart = totalPages - windowSize + 1
  const start = Math.min(Math.max(unclampedStart, 1), maxStart)

  return Array.from({ length: windowSize }, (_, index) => start + index)
}

export function createCollectionScrollWindow<T>(
  items: readonly T[],
  pageSize: number,
  requestedVisibleCount: number,
): CollectionScrollWindow<T> {
  const totalItems = items.length
  const visibleCount = normalizeVisibleCount(requestedVisibleCount, pageSize, totalItems)

  return {
    totalItems,
    pageSize,
    visibleCount,
    canShowMore: visibleCount < totalItems,
    visibleItems: items.slice(0, visibleCount),
  }
}

function materializePages<T>(items: readonly T[], pageSize: number, totalPages: number): T[][] {
  const pages: T[][] = []

  for (let pageIndex = 0; pageIndex < totalPages; pageIndex += 1) {
    const start = pageIndex * pageSize
    pages.push(items.slice(start, start + pageSize))
  }

  return pages
}

function normalizePage(requestedPage: number, totalPages: number): number {
  if (totalPages === 0) {
    return 0
  }

  if (!Number.isFinite(requestedPage) || requestedPage < 1) {
    return 1
  }

  if (requestedPage > totalPages) {
    return totalPages
  }

  return Math.trunc(requestedPage)
}

function normalizeVisibleCount(requestedVisibleCount: number, pageSize: number, totalItems: number): number {
  if (totalItems === 0) {
    return 0
  }

  if (!Number.isFinite(requestedVisibleCount) || requestedVisibleCount < pageSize) {
    return Math.min(pageSize, totalItems)
  }

  return Math.min(Math.trunc(requestedVisibleCount), totalItems)
}
