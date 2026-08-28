import { useCallback } from 'react'
import type { ImageFetchConfig } from '../../config/runtime-config'
import type { RuntimeIterationContext } from '../runtime-references/runtime-reference-resolver'
import type { ResolvedGalleryPhoto } from '../runtime-gallery-photos'
import {
  getGalleryLightboxCloseButtonClassName,
  getGalleryLightboxImageClassName,
  getGalleryLightboxNavButtonClassName,
  getGalleryLightboxOverlayClassName,
  getGalleryLightboxPanelClassName,
} from '../runtime-node-styling-gallery'
import { useImageFetchSource } from './use-image-fetch-source'

interface GalleryLightboxProps {
  photos: ResolvedGalleryPhoto[]
  activeIndex: number
  onNavigate: (index: number) => void
  onClose: () => void
}

// Local implementation for gallery's lightbox — deliberately not an instance of the catalog's
// modal node nor its openModal/closeModal state domain (design D10): gallery may live inside a
// repeater, where each iteration needs its own isolated lightbox without going through the
// global by-id modal registry.
export function GalleryLightbox({ photos, activeIndex, onNavigate, onClose }: GalleryLightboxProps) {
  const activePhoto = photos[activeIndex] ?? null
  const canGoPrevious = activeIndex > 0
  const canGoNext = activeIndex < photos.length - 1

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) {
        onClose()
      }
    },
    [onClose],
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    },
    [onClose],
  )

  const handlePrevious = useCallback(() => {
    if (!canGoPrevious) {
      return
    }
    onNavigate(activeIndex - 1)
  }, [canGoPrevious, onNavigate, activeIndex])

  const handleNext = useCallback(() => {
    if (!canGoNext) {
      return
    }
    onNavigate(activeIndex + 1)
  }, [canGoNext, onNavigate, activeIndex])

  return (
    <div
      data-layout-node="gallery-lightbox"
      data-testid="gallery-lightbox-overlay"
      className={getGalleryLightboxOverlayClassName()}
      onClick={handleOverlayClick}
      onKeyDown={handleKeyDown}
    >
      <div data-testid="gallery-lightbox-panel" className={getGalleryLightboxPanelClassName()}>
        <button
          type="button"
          aria-label="Cerrar"
          className={getGalleryLightboxCloseButtonClassName()}
          onClick={onClose}
        >
          ×
        </button>
        <button
          type="button"
          aria-label="Anterior"
          className={getGalleryLightboxNavButtonClassName()}
          disabled={!canGoPrevious}
          onClick={handlePrevious}
        >
          ‹
        </button>
        {/* Keyed by photo.key so navigating to a different photo remounts the fetch unit below
            instead of reusing a stale instance whose effect already ran (see D11). */}
        {activePhoto !== null ? <GalleryLightboxPhoto key={activePhoto.key} photo={activePhoto} /> : null}
        <button
          type="button"
          aria-label="Siguiente"
          className={getGalleryLightboxNavButtonClassName()}
          disabled={!canGoNext}
          onClick={handleNext}
        >
          ›
        </button>
      </div>
    </div>
  )
}

interface GalleryLightboxPhotoProps {
  photo: ResolvedGalleryPhoto
}

// Mirrors GalleryPhotoTile's mode-'src'/mode-'fetch' split (same per-item resolution unit as
// ImageNode/ImageNodeWithFetch), but with no click-to-select wrapper (design D11): the lightbox
// only displays the active photo, it does not let the user select a different one from here.
function GalleryLightboxPhoto({ photo }: GalleryLightboxPhotoProps) {
  if (photo.source.mode === 'fetch') {
    return (
      <GalleryLightboxPhotoWithFetch
        fetchConfig={photo.source.fetch}
        alt={photo.alt}
        iterationContext={photo.source.iterationContext}
      />
    )
  }

  return <img className={getGalleryLightboxImageClassName()} src={photo.source.src} alt={photo.alt} />
}

interface GalleryLightboxPhotoWithFetchProps {
  fetchConfig: ImageFetchConfig
  alt: string
  iterationContext?: RuntimeIterationContext
}

function GalleryLightboxPhotoWithFetch({ fetchConfig, alt, iterationContext }: GalleryLightboxPhotoWithFetchProps) {
  const { src } = useImageFetchSource(fetchConfig, iterationContext)

  if (src === null) {
    return null
  }

  return <img className={getGalleryLightboxImageClassName()} src={src} alt={alt} />
}
