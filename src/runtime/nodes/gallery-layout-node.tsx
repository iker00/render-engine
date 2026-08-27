import { Suspense, lazy, useMemo, useState } from 'react'
import type { GalleryLayoutNode } from '../../config/runtime-config'
import type { RuntimeIterationContext } from '../runtime-references/runtime-reference-resolver'
import { resolveGalleryPhotos } from '../runtime-gallery-photos'
import { getGalleryEmptyPlaceholderClassName } from '../runtime-node-styling-gallery'
import { useLayoutEditModeContext } from '../use-layout-edit-mode-context'
import { useRuntimeState } from '../runtime-state/use-runtime-state'
import { GalleryLightbox } from './gallery-lightbox'
import { GalleryPaginatedView } from './gallery-paginated-view'

// Second level of code-splitting (design.md D8): only the carousel view imports
// embla-carousel-react/embla-carousel-autoplay, so a gallery in `paginated` mode never downloads
// that chunk.
const GalleryCarouselView = lazy(() =>
  import('./gallery-carousel-view').then((m) => ({ default: m.GalleryCarouselView })),
)

interface GalleryNodeProps {
  node: GalleryLayoutNode
  iterationContext?: RuntimeIterationContext
}

interface LightboxState {
  open: boolean
  activeIndex: number
}

const CLOSED_LIGHTBOX: LightboxState = { open: false, activeIndex: 0 }

export function GalleryNode({ node, iterationContext }: GalleryNodeProps) {
  const state = useRuntimeState()
  const editModeContext = useLayoutEditModeContext()
  // Memoized so that toggling the lightbox (local state, does not change node/state/
  // iterationContext identity) does not produce a new `photos` array reference — GalleryPaginatedView
  // and GalleryCarouselView reset their internal position whenever the `photos` prop identity
  // changes (D12), so an unmemoized recompute here would wrongly reset the page/carousel position
  // every time the lightbox opens or closes.
  const photos = useMemo(
    () => resolveGalleryPhotos(node, state, { iterationContext }),
    [node, state, iterationContext],
  )
  const [lightbox, setLightbox] = useState<LightboxState>(CLOSED_LIGHTBOX)

  if (photos.length === 0) {
    // Production/preview (no provider, or provider present but inactive): stays exactly as
    // spec'd, no visual trace at all. Editor mode only: an empty gallery would otherwise render
    // nothing, so the generic per-node selection wrapper in layout-node-renderer.tsx collapses to
    // a 0x0 box and the node becomes impossible to click-select. Same "force visible in edit mode"
    // pattern as ModalNode's `isEditMode` override — no new selection machinery needed here.
    if (editModeContext === null || !editModeContext.active) {
      return null
    }

    return (
      <div data-layout-node="gallery-empty-placeholder" className={getGalleryEmptyPlaceholderClassName()}>
        Galería vacía
      </div>
    )
  }

  const onSelectPhoto = (index: number) => setLightbox({ open: true, activeIndex: index })

  // Defensive degradation (not a new product requirement, see task contract): if the resolved
  // collection shrinks/changes while the lightbox is open and the active index no longer exists,
  // stop rendering the lightbox instead of pointing at an out-of-range photo.
  const lightboxOpen = lightbox.open && lightbox.activeIndex < photos.length

  return (
    <>
      {node.props.display.mode === 'paginated' ? (
        <GalleryPaginatedView display={node.props.display} photos={photos} onSelectPhoto={onSelectPhoto} />
      ) : (
        <Suspense fallback={null}>
          <GalleryCarouselView display={node.props.display} photos={photos} onSelectPhoto={onSelectPhoto} />
        </Suspense>
      )}
      {lightboxOpen ? (
        <GalleryLightbox
          photos={photos}
          activeIndex={lightbox.activeIndex}
          onNavigate={(index) => setLightbox({ open: true, activeIndex: index })}
          onClose={() => setLightbox(CLOSED_LIGHTBOX)}
        />
      ) : null}
    </>
  )
}
