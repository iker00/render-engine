import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { GalleryCarouselDisplay } from '../../config/runtime-config'
import type { ResolvedGalleryPhoto } from '../../runtime/runtime-gallery-photos'
import { GalleryCarouselView } from '../../runtime/nodes/gallery-carousel-view'

type AnyPluginOptions = { delay: number }

// Fake, deterministic replica of embla-carousel-autoplay: it doesn't run any real timer logic
// itself, it only tags the options object so the fake useEmblaCarousel below can recognize it and
// start its own interval.
vi.mock('embla-carousel-autoplay', () => ({
  default: vi.fn((options: AnyPluginOptions) => ({ __isAutoplayPlugin: true, options })),
}))

// Fake, deterministic replica of embla-carousel-react's public API (scrollPrev/scrollNext,
// canScrollPrev/canScrollNext, on('select', ...)), driven by the number of DOM nodes marked with
// data-carousel-slide inside the ref'd viewport — the same DOM shape embla itself requires
// (viewport > container > slides). This avoids depending on embla's real drag/swipe mechanics
// while still exercising the component's real navigation/loop/autoplay wiring.
vi.mock('embla-carousel-react', async () => {
  const { useRef, useEffect, useState } = await import('react')

  function useEmblaCarouselMock(
    options: { loop?: boolean } = {},
    plugins: Array<{ __isAutoplayPlugin?: boolean; options: AnyPluginOptions }> = [],
  ) {
    const stateRef = useRef<{
      containerNode: HTMLElement | null
      selectedIndex: number
      listeners: Record<string, Array<() => void>>
      plugins: typeof plugins
      api: {
        scrollPrev: () => void
        scrollNext: () => void
        canScrollPrev: () => boolean
        canScrollNext: () => boolean
        selectedScrollSnap: () => number
        on: (event: string, callback: () => void) => void
        off: (event: string, callback: () => void) => void
      }
    } | null>(null)
    const [, forceRender] = useState(0)

    if (stateRef.current === null) {
      const localState = {
        containerNode: null as HTMLElement | null,
        selectedIndex: 0,
        listeners: { select: [] as Array<() => void> },
        plugins,
      }

      function getSlideCount(): number {
        return localState.containerNode ? localState.containerNode.querySelectorAll('[data-carousel-slide]').length : 0
      }

      function emitSelect(): void {
        localState.listeners.select.forEach((callback) => callback())
        forceRender((value) => value + 1)
      }

      const api = {
        scrollPrev() {
          const count = getSlideCount()
          if (count === 0) return
          if (localState.selectedIndex > 0) {
            localState.selectedIndex -= 1
          } else if (options.loop) {
            localState.selectedIndex = count - 1
          } else {
            return
          }
          emitSelect()
        },
        scrollNext() {
          const count = getSlideCount()
          if (count === 0) return
          if (localState.selectedIndex < count - 1) {
            localState.selectedIndex += 1
          } else if (options.loop) {
            localState.selectedIndex = 0
          } else {
            return
          }
          emitSelect()
        },
        canScrollPrev() {
          const count = getSlideCount()
          if (count <= 1) return false
          return options.loop ? true : localState.selectedIndex > 0
        },
        canScrollNext() {
          const count = getSlideCount()
          if (count <= 1) return false
          return options.loop ? true : localState.selectedIndex < count - 1
        },
        selectedScrollSnap() {
          return localState.selectedIndex
        },
        on(event: string, callback: () => void) {
          localState.listeners[event] = localState.listeners[event] ?? []
          localState.listeners[event].push(callback)
        },
        off(event: string, callback: () => void) {
          localState.listeners[event] = (localState.listeners[event] ?? []).filter((item) => item !== callback)
        },
      }

      // Mutate localState in place (not a spread copy) so refCallback's writes to
      // stateRef.current.containerNode are visible to the getSlideCount()/scrollPrev()/etc.
      // closures above, which read from this same localState object.
      stateRef.current = Object.assign(localState, { api })
    }

    const currentState = stateRef.current

    const refCallback = (node: HTMLElement | null) => {
      currentState.containerNode = node
    }

    // The ref callback (and thus the real slide count) is only available after the DOM commits,
    // which happens after this first render already computed canScrollPrev/canScrollNext from an
    // empty container — mirrors real embla-carousel-react, where emblaApi only becomes usable
    // after mount, forcing a second render once initialized.
    useEffect(() => {
      forceRender((value) => value + 1)
    }, [])

    useEffect(() => {
      const autoplayPlugin = currentState.plugins.find((plugin) => plugin.__isAutoplayPlugin)

      if (!autoplayPlugin) return

      const intervalId = setInterval(() => {
        currentState.api.scrollNext()
      }, autoplayPlugin.options.delay)

      return () => clearInterval(intervalId)
    }, [currentState])

    return [refCallback, currentState.api] as const
  }

  return { default: useEmblaCarouselMock }
})

afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
})

function makePhotos(count: number): ResolvedGalleryPhoto[] {
  return Array.from({ length: count }, (_, index) => ({
    key: `p${index + 1}`,
    alt: `Photo ${index + 1}`,
    source: { mode: 'src', src: `/media/photo-${index + 1}.jpg` },
  }))
}

function makeDisplay(overrides: Partial<GalleryCarouselDisplay> = {}): GalleryCarouselDisplay {
  return {
    mode: 'carousel',
    visibleCount: 3,
    ...overrides,
  }
}

describe('GalleryCarouselView', () => {
  it('renders one slide per photo sized for visibleCount and allows manual navigation', () => {
    render(<GalleryCarouselView display={makeDisplay({ visibleCount: 2 })} photos={makePhotos(5)} onSelectPhoto={vi.fn()} />)

    const slides = document.querySelectorAll('[data-carousel-slide]')
    expect(slides).toHaveLength(5)
    slides.forEach((slide) => {
      expect(slide.className).toContain('basis-1/2')
    })
    expect(screen.getAllByRole('img')).toHaveLength(5)

    const previousButton = screen.getByRole('button', { name: 'Anterior' })
    const nextButton = screen.getByRole('button', { name: 'Siguiente' })

    expect(previousButton).toBeDisabled()
    expect(nextButton).toBeEnabled()

    fireEvent.click(nextButton)
    expect(previousButton).toBeEnabled()
  })

  it('disables navigation controls when there is a single photo', () => {
    render(<GalleryCarouselView display={makeDisplay()} photos={makePhotos(1)} onSelectPhoto={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeDisabled()
  })

  it('invokes onSelectPhoto with the index within the full photos array', () => {
    const onSelectPhoto = vi.fn()
    render(<GalleryCarouselView display={makeDisplay()} photos={makePhotos(5)} onSelectPhoto={onSelectPhoto} />)

    fireEvent.click(screen.getByRole('button', { name: 'Photo 3' }))

    expect(onSelectPhoto).toHaveBeenCalledWith(2)
  })

  it('advances automatically according to autoplay.intervalMs without blocking manual navigation', () => {
    vi.useFakeTimers()

    render(
      <GalleryCarouselView
        display={makeDisplay({ visibleCount: 1, autoplay: { enabled: true, intervalMs: 3000 } })}
        photos={makePhotos(4)}
        onSelectPhoto={vi.fn()}
      />,
    )

    const previousButton = screen.getByRole('button', { name: 'Anterior' })
    expect(previousButton).toBeDisabled()

    // Autoplay advances photo 1 -> photo 2.
    act(() => {
      vi.advanceTimersByTime(3000)
    })
    expect(previousButton).toBeEnabled()

    // Manual navigation still works while autoplay is active: photo 2 -> photo 3.
    const nextButton = screen.getByRole('button', { name: 'Siguiente' })
    fireEvent.click(nextButton)
    expect(nextButton).toBeEnabled()

    // Autoplay keeps advancing after the manual click: photo 3 -> photo 4 (last, no loop).
    act(() => {
      vi.advanceTimersByTime(3000)
    })
    expect(nextButton).toBeDisabled()
  })

  describe('loop', () => {
    it('wraps to the first photo when advancing past the last one', () => {
      render(
        <GalleryCarouselView display={makeDisplay({ visibleCount: 1, loop: true })} photos={makePhotos(2)} onSelectPhoto={vi.fn()} />,
      )

      const nextButton = screen.getByRole('button', { name: 'Siguiente' })
      const previousButton = screen.getByRole('button', { name: 'Anterior' })

      fireEvent.click(nextButton)
      expect(nextButton).toBeEnabled()
      expect(previousButton).toBeEnabled()

      fireEvent.click(nextButton)
      expect(nextButton).toBeEnabled()
      expect(previousButton).toBeEnabled()
    })

    it('does not advance further past the last photo when loop is disabled', () => {
      render(
        <GalleryCarouselView display={makeDisplay({ visibleCount: 1, loop: false })} photos={makePhotos(2)} onSelectPhoto={vi.fn()} />,
      )

      const nextButton = screen.getByRole('button', { name: 'Siguiente' })

      fireEvent.click(nextButton)
      expect(nextButton).toBeDisabled()
    })
  })

  it('resets the active index when the photos array identity changes', () => {
    const { rerender } = render(
      <GalleryCarouselView display={makeDisplay({ visibleCount: 1 })} photos={makePhotos(3)} onSelectPhoto={vi.fn()} />,
    )

    const previousButton = screen.getByRole('button', { name: 'Anterior' })
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    expect(previousButton).toBeEnabled()

    rerender(<GalleryCarouselView display={makeDisplay({ visibleCount: 1 })} photos={makePhotos(3)} onSelectPhoto={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled()
  })

  it('renders nothing for an empty collection', () => {
    const { container } = render(<GalleryCarouselView display={makeDisplay()} photos={[]} onSelectPhoto={vi.fn()} />)

    expect(container).toBeEmptyDOMElement()
  })
})
