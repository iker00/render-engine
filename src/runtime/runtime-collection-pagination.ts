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
