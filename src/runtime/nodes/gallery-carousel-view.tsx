import { useEffect, useState } from 'react'
import Autoplay from 'embla-carousel-autoplay'
import useEmblaCarousel from 'embla-carousel-react'
import type { GalleryCarouselDisplay } from '../../config/runtime-config'
import type { ResolvedGalleryPhoto } from '../runtime-gallery-photos'
import {
  getGalleryCarouselArrowButtonClassName,
  getGalleryCarouselContainerClassName,
  getGalleryCarouselControlsClassName,
  getGalleryCarouselSlideClassName,
  getGalleryCarouselViewportClassName,
} from '../runtime-node-styling-gallery'
import { GalleryPhotoTile } from './gallery-photo-tile'

interface GalleryCarouselViewProps {
  display: GalleryCarouselDisplay
  photos: ResolvedGalleryPhoto[]
  onSelectPhoto: (index: number) => void
}

export function GalleryCarouselView({ display, photos, onSelectPhoto }: GalleryCarouselViewProps) {
  // Remounting the content component on identity change re-initializes embla from scratch,
  // resetting the active index to 0 — mirrors GalleryPaginatedView's key={generation} pattern (D12).
  const generation = useGalleryPhotosGeneration(photos)

  if (photos.length === 0) {
    return null
  }

  return <GalleryCarouselViewContent key={generation} display={display} photos={photos} onSelectPhoto={onSelectPhoto} />
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

function GalleryCarouselViewContent({ display, photos, onSelectPhoto }: GalleryCarouselViewProps) {
  const plugins = display.autoplay?.enabled ? [Autoplay({ delay: display.autoplay.intervalMs })] : []
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: display.loop ?? false }, plugins)
  const [, forceRerender] = useState(0)

  // embla mutates its internal engine state imperatively (navigation, autoplay, drag) without
  // notifying React on its own; subscribing to 'select' is the documented embla-carousel-react
  // pattern to force a re-render so canScrollPrev/canScrollNext reflect the current position.
  useEffect(() => {
    if (!emblaApi) return

    const onSelect = () => forceRerender((value) => value + 1)
    emblaApi.on('select', onSelect)

    return () => {
      emblaApi.off('select', onSelect)
    }
  }, [emblaApi])

  const canScrollPrev = emblaApi?.canScrollPrev() ?? false
  const canScrollNext = emblaApi?.canScrollNext() ?? false

  return (
    <div>
      <div className={getGalleryCarouselViewportClassName()} ref={emblaRef}>
        <div className={getGalleryCarouselContainerClassName()}>
          {photos.map((photo, index) => (
            <div key={photo.key} className={getGalleryCarouselSlideClassName(display.visibleCount)} data-carousel-slide>
              <GalleryPhotoTile photo={photo} onSelect={() => onSelectPhoto(index)} />
            </div>
          ))}
        </div>
      </div>
      <div className={getGalleryCarouselControlsClassName()}>
        <button
          type="button"
          aria-label="Anterior"
          className={getGalleryCarouselArrowButtonClassName()}
          disabled={!canScrollPrev}
          onClick={() => emblaApi?.scrollPrev()}
        >
          ‹
        </button>
        <button
          type="button"
          aria-label="Siguiente"
          className={getGalleryCarouselArrowButtonClassName()}
          disabled={!canScrollNext}
          onClick={() => emblaApi?.scrollNext()}
        >
          ›
        </button>
      </div>
    </div>
  )
}
