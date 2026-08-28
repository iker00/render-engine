import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RuntimeConfig, RuntimePageConfig } from '../../config/runtime-config'
import type { ResolvedGalleryPhoto } from '../../runtime/runtime-gallery-photos'
import { GalleryLightbox } from '../../runtime/nodes/gallery-lightbox'
import { RuntimeStateContext } from '../../runtime/runtime-state/runtime-state-context'
import { createRuntimeState } from '../../runtime/runtime-state/runtime-state-reducer'

function renderGalleryLightbox(
  photos: ResolvedGalleryPhoto[],
  activeIndex: number,
  onNavigate: (index: number) => void,
  onClose: () => void,
) {
  const activePage: RuntimePageConfig = { id: 'home', layout: [] }
  const config: RuntimeConfig = {
    api: {},
    initialPage: activePage.id,
    pages: [activePage],
  }
  const state = createRuntimeState(config)
  const dispatch = vi.fn()
  const dispatchAndSyncState = vi.fn()

  return render(
    <RuntimeStateContext.Provider
      value={{
        config,
        initialState: state,
        state,
        dispatch,
        dispatchAndSyncState,
        getLatestState: () => state,
      }}
    >
      <GalleryLightbox photos={photos} activeIndex={activeIndex} onNavigate={onNavigate} onClose={onClose} />
    </RuntimeStateContext.Provider>,
  )
}

function makeBlobResponse(size = 100, type = 'image/png') {
  const bytes = new Uint8Array(size)
  const blob = new Blob([bytes], { type })
  return new Response(blob, { status: 200 })
}

function makeSrcPhotos(): ResolvedGalleryPhoto[] {
  return [
    { key: 'p0', alt: 'First photo', source: { mode: 'src', src: '/media/first.jpg' } },
    { key: 'p1', alt: 'Second photo', source: { mode: 'src', src: '/media/second.jpg' } },
    { key: 'p2', alt: 'Third photo', source: { mode: 'src', src: '/media/third.jpg' } },
  ]
}

describe('GalleryLightbox', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders the photo at photos[activeIndex] enlarged', () => {
    const photos = makeSrcPhotos()

    renderGalleryLightbox(photos, 1, vi.fn(), vi.fn())

    const img = screen.getByRole('img', { name: 'Second photo' })
    expect(img).toHaveAttribute('src', '/media/second.jpg')
  })

  describe('navigation', () => {
    it('invokes onNavigate with the next index when clicking "Siguiente"', () => {
      const photos = makeSrcPhotos()
      const onNavigate = vi.fn()

      renderGalleryLightbox(photos, 0, onNavigate, vi.fn())

      fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }))

      expect(onNavigate).toHaveBeenCalledExactlyOnceWith(1)
    })

    it('invokes onNavigate with the previous index when clicking "Anterior"', () => {
      const photos = makeSrcPhotos()
      const onNavigate = vi.fn()

      renderGalleryLightbox(photos, 1, onNavigate, vi.fn())

      fireEvent.click(screen.getByRole('button', { name: 'Anterior' }))

      expect(onNavigate).toHaveBeenCalledExactlyOnceWith(0)
    })

    it('does not invoke onNavigate when clicking "Anterior" on the first photo (no loop)', () => {
      const photos = makeSrcPhotos()
      const onNavigate = vi.fn()

      renderGalleryLightbox(photos, 0, onNavigate, vi.fn())

      fireEvent.click(screen.getByRole('button', { name: 'Anterior' }))

      expect(onNavigate).not.toHaveBeenCalled()
    })

    it('does not invoke onNavigate when clicking "Siguiente" on the last photo (no loop)', () => {
      const photos = makeSrcPhotos()
      const onNavigate = vi.fn()

      renderGalleryLightbox(photos, photos.length - 1, onNavigate, vi.fn())

      fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }))

      expect(onNavigate).not.toHaveBeenCalled()
    })
  })

  describe('closing', () => {
    it('invokes onClose when clicking the explicit close button', () => {
      const photos = makeSrcPhotos()
      const onClose = vi.fn()

      renderGalleryLightbox(photos, 0, vi.fn(), onClose)

      fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }))

      expect(onClose).toHaveBeenCalledOnce()
    })

    it('invokes onClose when clicking the overlay outside the panel', () => {
      const photos = makeSrcPhotos()
      const onClose = vi.fn()

      renderGalleryLightbox(photos, 0, vi.fn(), onClose)

      fireEvent.click(screen.getByTestId('gallery-lightbox-overlay'))

      expect(onClose).toHaveBeenCalledOnce()
    })

    it('does not invoke onClose when clicking inside the panel', () => {
      const photos = makeSrcPhotos()
      const onClose = vi.fn()

      renderGalleryLightbox(photos, 0, vi.fn(), onClose)

      fireEvent.click(screen.getByTestId('gallery-lightbox-panel'))

      expect(onClose).not.toHaveBeenCalled()
    })

    it('invokes onClose when pressing the Escape key', () => {
      const photos = makeSrcPhotos()
      const onClose = vi.fn()

      renderGalleryLightbox(photos, 0, vi.fn(), onClose)

      fireEvent.keyDown(screen.getByTestId('gallery-lightbox-overlay'), { key: 'Escape' })

      expect(onClose).toHaveBeenCalledOnce()
    })
  })

  describe('active photo in mode fetch', () => {
    beforeEach(() => {
      URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-url')
      URL.revokeObjectURL = vi.fn()
    })

    it('does not render <img> while the fetch is pending', () => {
      const photos: ResolvedGalleryPhoto[] = [
        { key: 'p0', alt: 'Mountain', source: { mode: 'fetch', fetch: { url: '/media/mountain.png' } } },
      ]

      vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => undefined)))

      renderGalleryLightbox(photos, 0, vi.fn(), vi.fn())

      expect(screen.queryByRole('img')).not.toBeInTheDocument()
    })

    it('does not render <img> when the fetch fails', async () => {
      const photos: ResolvedGalleryPhoto[] = [
        { key: 'p0', alt: 'Mountain', source: { mode: 'fetch', fetch: { url: '/media/mountain.png' } } },
      ]

      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network failure')))

      await act(async () => {
        renderGalleryLightbox(photos, 0, vi.fn(), vi.fn())
      })

      expect(screen.queryByRole('img')).not.toBeInTheDocument()
    })

    it('renders <img> with a blob: src once the fetch resolves successfully', async () => {
      const photos: ResolvedGalleryPhoto[] = [
        { key: 'p0', alt: 'Mountain', source: { mode: 'fetch', fetch: { url: '/media/mountain.png' } } },
      ]

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeBlobResponse()))

      await act(async () => {
        renderGalleryLightbox(photos, 0, vi.fn(), vi.fn())
      })

      const img = screen.getByRole('img', { name: 'Mountain' })
      expect(img.getAttribute('src')).toMatch(/^blob:/)
    })
  })
})
