import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { GalleryPaginatedDisplay, RuntimeCollectionPaginationControlsVariant } from '../../config/runtime-config'
import type { ResolvedGalleryPhoto } from '../../runtime/runtime-gallery-photos'
import { GalleryPaginatedView } from '../../runtime/nodes/gallery-paginated-view'

afterEach(() => {
  vi.unstubAllGlobals()
})

function makePhotos(count: number): ResolvedGalleryPhoto[] {
  return Array.from({ length: count }, (_, index) => ({
    key: `p${index + 1}`,
    alt: `Photo ${index + 1}`,
    source: { mode: 'src', src: `/media/photo-${index + 1}.jpg` },
  }))
}

function makeDisplay(pageSize: number, variant?: RuntimeCollectionPaginationControlsVariant): GalleryPaginatedDisplay {
  return {
    mode: 'paginated',
    pagination: {
      pageSize,
      ...(variant ? { controls: { variant } } : {}),
    },
  }
}

describe('GalleryPaginatedView', () => {
  it('shows at most pageSize photos on the current page', () => {
    render(<GalleryPaginatedView display={makeDisplay(2)} photos={makePhotos(5)} onSelectPhoto={vi.fn()} />)

    expect(screen.getAllByRole('img')).toHaveLength(2)
    expect(screen.getByRole('img', { name: 'Photo 1' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Photo 2' })).toBeInTheDocument()
  })

  describe('previousNext variant', () => {
    it('navigates forward and backward, disabling buttons at the extremes', () => {
      render(
        <GalleryPaginatedView display={makeDisplay(2, 'previousNext')} photos={makePhotos(5)} onSelectPhoto={vi.fn()} />,
      )

      const previousButton = screen.getByRole('button', { name: 'Anterior' })
      const nextButton = screen.getByRole('button', { name: 'Siguiente' })

      expect(previousButton).toBeDisabled()
      expect(nextButton).toBeEnabled()
      expect(screen.getByRole('img', { name: 'Photo 1' })).toBeInTheDocument()

      fireEvent.click(nextButton)
      expect(screen.getByRole('img', { name: 'Photo 3' })).toBeInTheDocument()
      expect(previousButton).toBeEnabled()

      fireEvent.click(nextButton)
      expect(screen.getByRole('img', { name: 'Photo 5' })).toBeInTheDocument()
      expect(nextButton).toBeDisabled()

      fireEvent.click(previousButton)
      expect(screen.getByRole('img', { name: 'Photo 3' })).toBeInTheDocument()
    })
  })

  describe('numbered variant', () => {
    it('shows a window of up to five pages and marks the active one with aria-current', () => {
      render(
        <GalleryPaginatedView display={makeDisplay(1, 'numbered')} photos={makePhotos(8)} onSelectPhoto={vi.fn()} />,
      )

      const paginationControls = document.querySelector('[data-layout-node="gallery-pagination"]')
      expect(paginationControls).toBeInTheDocument()
      expect(
        within(paginationControls as HTMLElement)
          .getAllByRole('button')
          .map((button) => button.textContent),
      ).toEqual(['Primera', 'Anterior', '1', '2', '3', '4', '5', 'Siguiente', 'Última'])
      expect(screen.getByRole('button', { name: '1' })).toHaveAttribute('aria-current', 'page')

      fireEvent.click(screen.getByRole('button', { name: 'Última' }))

      expect(screen.getByRole('button', { name: '8' })).toHaveAttribute('aria-current', 'page')
      expect(screen.getByRole('img', { name: 'Photo 8' })).toBeInTheDocument()
    })
  })

  describe('scroll variant', () => {
    it('shows pageSize photos initially and expands via the fallback button when IntersectionObserver is unavailable', () => {
      vi.stubGlobal('IntersectionObserver', undefined)

      render(<GalleryPaginatedView display={makeDisplay(2, 'scroll')} photos={makePhotos(5)} onSelectPhoto={vi.fn()} />)

      expect(screen.getAllByRole('img')).toHaveLength(2)
      expect(screen.getByRole('button', { name: 'Mostrar más' })).toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: 'Mostrar más' }))
      expect(screen.getAllByRole('img')).toHaveLength(4)

      fireEvent.click(screen.getByRole('button', { name: 'Mostrar más' }))
      expect(screen.getAllByRole('img')).toHaveLength(5)
      expect(screen.queryByRole('button', { name: 'Mostrar más' })).not.toBeInTheDocument()
    })

    it('expands the window through the IntersectionObserver sentinel and removes it at the end', () => {
      let observerCallback: IntersectionObserverCallback | null = null
      const observe = vi.fn()
      const disconnect = vi.fn()

      vi.stubGlobal(
        'IntersectionObserver',
        vi.fn((callback: IntersectionObserverCallback) => {
          observerCallback = callback

          return {
            observe,
            disconnect,
            unobserve: vi.fn(),
            takeRecords: vi.fn(() => []),
          }
        }),
      )

      render(<GalleryPaginatedView display={makeDisplay(2, 'scroll')} photos={makePhotos(5)} onSelectPhoto={vi.fn()} />)

      expect(observe).toHaveBeenCalled()
      expect(document.querySelector('[data-layout-node="gallery-scroll-sentinel"]')).toBeInTheDocument()

      act(() => {
        observerCallback?.([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver)
      })
      expect(screen.getAllByRole('img')).toHaveLength(4)

      act(() => {
        observerCallback?.([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver)
      })
      expect(screen.getAllByRole('img')).toHaveLength(5)
      expect(document.querySelector('[data-layout-node="gallery-scroll-sentinel"]')).not.toBeInTheDocument()
      expect(disconnect).toHaveBeenCalled()
    })
  })

  it('invokes onSelectPhoto with the index within the full photos array, not the page-relative index', () => {
    const onSelectPhoto = vi.fn()
    render(
      <GalleryPaginatedView display={makeDisplay(2, 'previousNext')} photos={makePhotos(5)} onSelectPhoto={onSelectPhoto} />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    fireEvent.click(screen.getByRole('button', { name: 'Photo 3' }))

    expect(onSelectPhoto).toHaveBeenCalledWith(2)
  })

  it('renders no tiles nor pagination controls for an empty collection', () => {
    const { container } = render(<GalleryPaginatedView display={makeDisplay(2)} photos={[]} onSelectPhoto={vi.fn()} />)

    expect(container).toBeEmptyDOMElement()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('resets the active page to its initial state when the photos array identity changes', () => {
    const { rerender } = render(
      <GalleryPaginatedView display={makeDisplay(2, 'previousNext')} photos={makePhotos(5)} onSelectPhoto={vi.fn()} />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    expect(screen.getByRole('img', { name: 'Photo 3' })).toBeInTheDocument()

    rerender(
      <GalleryPaginatedView display={makeDisplay(2, 'previousNext')} photos={makePhotos(5)} onSelectPhoto={vi.fn()} />,
    )

    expect(screen.getByRole('img', { name: 'Photo 1' })).toBeInTheDocument()
  })

  it('resets the scroll window to its initial state when the photos array identity changes', () => {
    const { rerender } = render(
      <GalleryPaginatedView display={makeDisplay(2, 'scroll')} photos={makePhotos(5)} onSelectPhoto={vi.fn()} />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Mostrar más' }))
    expect(screen.getAllByRole('img')).toHaveLength(4)

    rerender(
      <GalleryPaginatedView display={makeDisplay(2, 'scroll')} photos={makePhotos(5)} onSelectPhoto={vi.fn()} />,
    )

    expect(screen.getAllByRole('img')).toHaveLength(2)
  })
})
