import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RuntimeConfig, RuntimePageConfig } from '../../config/runtime-config'
import type { ResolvedGalleryPhoto } from '../../runtime/runtime-gallery-photos'
import { GalleryPhotoTile } from '../../runtime/nodes/gallery-photo-tile'
import { RuntimeStateContext } from '../../runtime/runtime-state/runtime-state-context'
import { createRuntimeState } from '../../runtime/runtime-state/runtime-state-reducer'

function renderGalleryPhotoTile(photo: ResolvedGalleryPhoto, onSelect: () => void) {
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
      <GalleryPhotoTile photo={photo} onSelect={onSelect} />
    </RuntimeStateContext.Provider>,
  )
}

function makeBlobResponse(size = 100, type = 'image/png') {
  const bytes = new Uint8Array(size)
  const blob = new Blob([bytes], { type })
  return new Response(blob, { status: 200 })
}

describe('GalleryPhotoTile', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('mode src', () => {
    it('renders an <img> with the resolved src and alt', () => {
      const photo: ResolvedGalleryPhoto = {
        key: 'p1',
        alt: 'Sunset over the mountains',
        source: { mode: 'src', src: '/media/sunset.jpg' },
      }

      renderGalleryPhotoTile(photo, vi.fn())

      const img = screen.getByRole('img', { name: 'Sunset over the mountains' })
      expect(img).toHaveAttribute('src', '/media/sunset.jpg')
    })

    it('invokes onSelect exactly once when the tile is clicked', () => {
      const photo: ResolvedGalleryPhoto = {
        key: 'p1',
        alt: 'Sunset',
        source: { mode: 'src', src: '/media/sunset.jpg' },
      }
      const onSelect = vi.fn()

      renderGalleryPhotoTile(photo, onSelect)

      fireEvent.click(screen.getByRole('button', { name: 'Sunset' }))

      expect(onSelect).toHaveBeenCalledTimes(1)
    })
  })

  describe('mode fetch', () => {
    beforeEach(() => {
      URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-url')
      URL.revokeObjectURL = vi.fn()
    })

    it('triggers the binary fetch on mount and does not render <img> while pending', () => {
      const photo: ResolvedGalleryPhoto = {
        key: 'p1',
        alt: 'Mountain',
        source: { mode: 'fetch', fetch: { url: '/media/mountain.png' } },
      }

      const fetchMock = vi.fn().mockReturnValue(new Promise(() => undefined))
      vi.stubGlobal('fetch', fetchMock)

      renderGalleryPhotoTile(photo, vi.fn())

      expect(fetchMock).toHaveBeenCalledWith('/media/mountain.png', expect.any(Object))
      expect(screen.queryByRole('img')).not.toBeInTheDocument()
    })

    it('does not render <img> when the fetch fails', async () => {
      const photo: ResolvedGalleryPhoto = {
        key: 'p1',
        alt: 'Mountain',
        source: { mode: 'fetch', fetch: { url: '/media/mountain.png' } },
      }

      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network failure')))

      await act(async () => {
        renderGalleryPhotoTile(photo, vi.fn())
      })

      expect(screen.queryByRole('img')).not.toBeInTheDocument()
    })

    it('renders <img> with a blob: src once the fetch resolves successfully', async () => {
      const photo: ResolvedGalleryPhoto = {
        key: 'p1',
        alt: 'Mountain',
        source: { mode: 'fetch', fetch: { url: '/media/mountain.png' } },
      }

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeBlobResponse()))

      await act(async () => {
        renderGalleryPhotoTile(photo, vi.fn())
      })

      const img = screen.getByRole('img', { name: 'Mountain' })
      expect(img.getAttribute('src')).toMatch(/^blob:/)
    })

    it('invokes onSelect exactly once when clicking the resolved fetch tile', async () => {
      const photo: ResolvedGalleryPhoto = {
        key: 'p1',
        alt: 'Mountain',
        source: { mode: 'fetch', fetch: { url: '/media/mountain.png' } },
      }
      const onSelect = vi.fn()

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeBlobResponse()))

      await act(async () => {
        renderGalleryPhotoTile(photo, onSelect)
      })

      fireEvent.click(screen.getByRole('button', { name: 'Mountain' }))

      expect(onSelect).toHaveBeenCalledTimes(1)
    })
  })
})
