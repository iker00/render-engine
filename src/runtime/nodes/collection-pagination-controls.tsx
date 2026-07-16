import type { Dispatch, SetStateAction } from 'react'
import type { RuntimeCollectionPaginationControlsVariant } from '../../config/runtime-config'
import { createNumberedPaginationWindow } from '../runtime-collection-pagination'

interface CollectionPaginationControlsProps {
  variant: RuntimeCollectionPaginationControlsVariant
  currentPage: number
  totalPages: number
  canGoPrevious: boolean
  canGoNext: boolean
  setActivePage: Dispatch<SetStateAction<number>>
  dataLayoutNode: string
  containerClassName: () => string
  buttonClassName: () => string
  currentButtonClassName: () => string
}

export function CollectionPaginationControls({
  variant,
  currentPage,
  totalPages,
  canGoPrevious,
  canGoNext,
  setActivePage,
  dataLayoutNode,
  containerClassName,
  buttonClassName,
  currentButtonClassName,
}: CollectionPaginationControlsProps) {
  if (variant === 'numbered') {
    const pageWindow = createNumberedPaginationWindow({ currentPage, totalPages })

    return (
      <div className={containerClassName()} data-layout-node={dataLayoutNode}>
        <button
          type="button"
          className={buttonClassName()}
          disabled={!canGoPrevious}
          onClick={() => setActivePage(1)}
        >
          Primera
        </button>
        <button
          type="button"
          className={buttonClassName()}
          disabled={!canGoPrevious}
          onClick={() => setActivePage((page) => Math.max(1, page - 1))}
        >
          Anterior
        </button>
        {pageWindow.map((page) => (
          <button
            key={page}
            type="button"
            className={page === currentPage ? currentButtonClassName() : buttonClassName()}
            aria-current={page === currentPage ? 'page' : undefined}
            onClick={() => setActivePage(page)}
          >
            {page}
          </button>
        ))}
        <button
          type="button"
          className={buttonClassName()}
          disabled={!canGoNext}
          onClick={() => setActivePage((page) => Math.min(totalPages, page + 1))}
        >
          Siguiente
        </button>
        <button
          type="button"
          className={buttonClassName()}
          disabled={!canGoNext}
          onClick={() => setActivePage(totalPages)}
        >
          Última
        </button>
      </div>
    )
  }

  return (
    <div className={containerClassName()} data-layout-node={dataLayoutNode}>
      <button
        type="button"
        className={buttonClassName()}
        disabled={!canGoPrevious}
        onClick={() => setActivePage((page) => Math.max(1, page - 1))}
      >
        Anterior
      </button>
      <button
        type="button"
        className={buttonClassName()}
        disabled={!canGoNext}
        onClick={() => setActivePage((page) => Math.min(totalPages, page + 1))}
      >
        Siguiente
      </button>
    </div>
  )
}
