import type { ImageFetchConfig } from '../../config/runtime-config'
import type { RuntimeIterationContext } from '../runtime-references/runtime-reference-resolver'
import { getGalleryPhotoTileButtonClassName, getGalleryPhotoTileImageClassName } from '../runtime-node-styling-gallery'
import type { ResolvedGalleryPhoto } from '../runtime-gallery-photos'
import { useImageFetchSource } from './use-image-fetch-source'

interface GalleryPhotoTileProps {
  photo: ResolvedGalleryPhoto
  onSelect: () => void
}

// Mirrors the ImageNode/ImageNodeWithFetch split in image-layout-node.tsx: GalleryPhotoTile itself
// calls no hooks, it only decides which branch to render, so useImageFetchSource is never called
// conditionally (React hooks rules).
export function GalleryPhotoTile({ photo, onSelect }: GalleryPhotoTileProps) {
  if (photo.source.mode === 'fetch') {
    return (
      <GalleryPhotoTileWithFetch
        fetchConfig={photo.source.fetch}
        alt={photo.alt}
        iterationContext={photo.source.iterationContext}
        onSelect={onSelect}
      />
    )
  }

  return (
    <button type="button" className={getGalleryPhotoTileButtonClassName()} onClick={onSelect}>
      <img className={getGalleryPhotoTileImageClassName()} src={photo.source.src} alt={photo.alt} />
    </button>
  )
}

interface GalleryPhotoTileWithFetchProps {
  fetchConfig: ImageFetchConfig
  alt: string
  iterationContext?: RuntimeIterationContext
  onSelect: () => void
}

function GalleryPhotoTileWithFetch({ fetchConfig, alt, iterationContext, onSelect }: GalleryPhotoTileWithFetchProps) {
  const { src } = useImageFetchSource(fetchConfig, iterationContext)

  if (src === null) {
    return null
  }

  return (
    <button type="button" className={getGalleryPhotoTileButtonClassName()} onClick={onSelect}>
      <img className={getGalleryPhotoTileImageClassName()} src={src} alt={alt} />
    </button>
  )
}
