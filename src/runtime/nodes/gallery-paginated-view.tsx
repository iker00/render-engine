import { useEffect, useMemo, useRef, useState } from 'react'
import type { GalleryPaginatedDisplay, RuntimeCollectionPaginationControlsVariant } from '../../config/runtime-config'
import {
  createCollectionPaginationModel,
  createCollectionScrollWindow,
} from '../runtime-collection-pagination'
import type { ResolvedGalleryPhoto } from '../runtime-gallery-photos'
import {
  getGalleryPaginatedGridClassName,
  getGalleryPaginationButtonClassName,
  getGalleryPaginationControlsClassName,
  getGalleryPaginationCurrentButtonClassName,
} from '../runtime-node-styling-gallery'
import { CollectionPaginationControls } from './collection-pagination-controls'
import { GalleryPhotoTile } from './gallery-photo-tile'

interface GalleryPaginatedViewProps {
  display: GalleryPaginatedDisplay
  photos: ResolvedGalleryPhoto[]
  onSelectPhoto: (index: number) => void
}

export function GalleryPaginatedView({ display, photos, onSelectPhoto }: GalleryPaginatedViewProps) {
  // Remounting the content component on identity change resets activePage/scrollVisibleCount to
  // their initial state, mirroring RepeaterNode's key={paginationStateKey} pattern (D12).
  const generation = useGalleryPhotosGeneration(photos)

  if (photos.length === 0) {
    return null
  }

  return (
    <GalleryPaginatedViewContent
      key={generation}
      display={display}
      photos={photos}
      onSelectPhoto={onSelectPhoto}
    />
  )
}

// Adjusts state during render (React-documented pattern for deriving state from a changed prop
// without an Effect) instead of mutating a ref, which the project's react-hooks lint rules forbid.
function useGalleryPhotosGeneration(photos: ResolvedGalleryPhoto[]): number {
  const [previousPhotos, setPreviousPhotos] = useState(photos)
  const [generation, setGeneration] = useState(0)

  if (previousPhotos !== photos) {
    setPreviousPhotos(photos)
    setGeneration((value) => value + 1)
  }

  return generation
}

interface IndexedGalleryPhoto {
  photo: ResolvedGalleryPhoto
  index: number
}

function GalleryPaginatedViewContent({ display, photos, onSelectPhoto }: GalleryPaginatedViewProps) {
  const pageSize = display.pagination.pageSize
  const variant: RuntimeCollectionPaginationControlsVariant = display.pagination.controls?.variant ?? 'previousNext'
  const [activePage, setActivePage] = useState(1)
  const [scrollVisibleCount, setScrollVisibleCount] = useState(pageSize)

  const indexedPhotos = useMemo<IndexedGalleryPhoto[]>(
    () => photos.map((photo, index) => ({ photo, index })),
    [photos],
  )
  const paginationModel = useMemo(
    () => createCollectionPaginationModel(indexedPhotos, pageSize),
    [indexedPhotos, pageSize],
  )
  const paginationPage = variant === 'scroll' ? null : paginationModel.getPage(activePage)
  const scrollWindow =
    variant === 'scroll' ? createCollectionScrollWindow(indexedPhotos, pageSize, scrollVisibleCount) : null
  const visibleIndexedPhotos = scrollWindow?.visibleItems ?? paginationPage?.visibleItems ?? indexedPhotos

  const tiles = visibleIndexedPhotos.map(({ photo, index }) => (
    <GalleryPhotoTile key={photo.key} photo={photo} onSelect={() => onSelectPhoto(index)} />
  ))

  return (
    <>
      <div className={getGalleryPaginatedGridClassName()}>{tiles}</div>
      {paginationPage && paginationPage.totalPages > 1 ? (
        <CollectionPaginationControls
          variant={variant}
          currentPage={paginationPage.currentPage}
          totalPages={paginationPage.totalPages}
          canGoPrevious={paginationPage.canGoPrevious}
          canGoNext={paginationPage.canGoNext}
          setActivePage={setActivePage}
          dataLayoutNode="gallery-pagination"
          containerClassName={getGalleryPaginationControlsClassName}
          buttonClassName={getGalleryPaginationButtonClassName}
          currentButtonClassName={getGalleryPaginationCurrentButtonClassName}
        />
      ) : null}
      {scrollWindow?.canShowMore ? (
        <GalleryScrollControls
          onShowMore={() => setScrollVisibleCount((visibleCount) => visibleCount + pageSize)}
        />
      ) : null}
    </>
  )
}

interface GalleryScrollControlsProps {
  onShowMore: () => void
}

// Local replica of RepeaterScrollControls (repeater-layout-node.tsx): sentinel + IntersectionObserver
// with a "Mostrar más" button fallback when IntersectionObserver isn't available.
function GalleryScrollControls({ onShowMore }: GalleryScrollControlsProps) {
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const hasIntersectionObserver = typeof globalThis.IntersectionObserver === 'function'

  useEffect(() => {
    const sentinel = sentinelRef.current

    if (!hasIntersectionObserver || !sentinel) {
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          onShowMore()
        }
      },
      {
        threshold: 0.75,
      },
    )

    observer.observe(sentinel)

    return () => {
      observer.disconnect()
    }
  }, [hasIntersectionObserver, onShowMore])

  if (!hasIntersectionObserver) {
    return (
      <div className={getGalleryPaginationControlsClassName()} data-layout-node="gallery-pagination">
        <button type="button" className={getGalleryPaginationButtonClassName()} onClick={onShowMore}>
          Mostrar más
        </button>
      </div>
    )
  }

  return (
    <div
      ref={sentinelRef}
      className={getGalleryPaginationControlsClassName()}
      data-layout-node="gallery-scroll-sentinel"
      aria-hidden="true"
    />
  )
}
