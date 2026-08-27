import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RuntimeConfig } from '../../config/runtime-config'
import { validateRuntimeConfig } from '../../config/runtime-config'
import { RuntimePage } from '../../runtime/runtime-page'
import { RuntimeStateContext } from '../../runtime/runtime-state/runtime-state-context'
import { createRuntimeState } from '../../runtime/runtime-state/runtime-state-reducer'
import type { RuntimeState, RuntimeStateAction } from '../../runtime/runtime-state/runtime-state-types'

// End-to-end coverage for gallery's carousel mode, through the real pipeline (raw config ->
// validateRuntimeConfig -> LayoutRenderer -> GalleryNode's second-level React.lazy split, D8).
// embla-carousel-react/embla-carousel-autoplay are mocked with the same deterministic test double
// as T5's runtime-gallery-carousel-view.test.tsx, driven by the DOM's data-carousel-slide count
// instead of real drag/swipe mechanics.

type AnyPluginOptions = { delay: number }

vi.mock('embla-carousel-autoplay', () => ({
  default: vi.fn((options: AnyPluginOptions) => ({ __isAutoplayPlugin: true, options })),
}))

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
        on(event: string, callback: () => void) {
          localState.listeners[event] = localState.listeners[event] ?? []
          localState.listeners[event].push(callback)
        },
        off(event: string, callback: () => void) {
          localState.listeners[event] = (localState.listeners[event] ?? []).filter((item) => item !== callback)
        },
      }

      stateRef.current = Object.assign(localState, { api })
    }

    const currentState = stateRef.current

    const refCallback = (node: HTMLElement | null) => {
      currentState.containerNode = node
    }

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
  vi.unstubAllGlobals()
})

function buildRawConfig(layoutNode: Record<string, unknown>) {
  return {
    api: {},
    initialPage: 'home',
    pages: [{ id: 'home', layout: [layoutNode] }],
  }
}

function carouselDisplay(overrides: Record<string, unknown> = {}) {
  return { mode: 'carousel', visibleCount: 2, ...overrides }
}

function galleryCarouselNode(count: number, display: Record<string, unknown> = carouselDisplay()) {
  return {
    type: 'gallery',
    props: {
      images: Array.from({ length: count }, (_, index) => ({ src: `/img-${index + 1}.jpg`, alt: `Photo ${index + 1}` })),
      display,
    },
  }
}

function validateGalleryConfig(layoutNode: Record<string, unknown>): RuntimeConfig {
  const result = validateRuntimeConfig(buildRawConfig(layoutNode))
  if (result.status !== 'ready') {
    throw new Error(`Expected a valid gallery config, got error: ${JSON.stringify(result.error)}`)
  }
  return result.config
}

async function renderConfig(config: RuntimeConfig) {
  const state: RuntimeState = createRuntimeState(config)
  const dispatch = vi.fn<(action: RuntimeStateAction) => void>()
  const dispatchAndSyncState = vi.fn<(action: RuntimeStateAction) => void>()

  let renderResult!: ReturnType<typeof render>
  await act(async () => {
    renderResult = render(
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
        <RuntimePage />
      </RuntimeStateContext.Provider>,
    )
  })

  return renderResult
}

async function renderValidatedCarouselGallery(layoutNode: Record<string, unknown>) {
  const config = validateGalleryConfig(layoutNode)
  const renderResult = await renderConfig(config)
  return { ...renderResult, config }
}

describe('GalleryNode — carousel mode end-to-end', () => {
  it('registers via the second-level lazy split and renders one slide per photo sized for visibleCount', async () => {
    await renderValidatedCarouselGallery(galleryCarouselNode(5, carouselDisplay({ visibleCount: 2 })))

    // The carousel view is behind its own React.lazy() (D8, second level of code-splitting),
    // so its dynamic import can resolve one macrotask later than the render() + first act()
    // flush above — findAllByRole polls until the slides mount instead of asserting synchronously.
    const images = await screen.findAllByRole('img')
    expect(images).toHaveLength(5)

    const slides = document.querySelectorAll('[data-carousel-slide]')
    expect(slides).toHaveLength(5)
    slides.forEach((slide) => expect(slide.className).toContain('basis-1/2'))
  })

  it('allows manual navigation with the previous/next controls', async () => {
    await renderValidatedCarouselGallery(galleryCarouselNode(3, carouselDisplay({ visibleCount: 1 })))

    const previousButton = screen.getByRole('button', { name: 'Anterior' })
    const nextButton = screen.getByRole('button', { name: 'Siguiente' })
    expect(previousButton).toBeDisabled()

    fireEvent.click(nextButton)

    expect(previousButton).toBeEnabled()
  })

  it('advances automatically according to autoplay.intervalMs', async () => {
    vi.useFakeTimers()

    await renderValidatedCarouselGallery(
      galleryCarouselNode(3, carouselDisplay({ visibleCount: 1, autoplay: { enabled: true, intervalMs: 3000 } })),
    )

    const previousButton = screen.getByRole('button', { name: 'Anterior' })
    expect(previousButton).toBeDisabled()

    await act(async () => {
      vi.advanceTimersByTime(3000)
    })

    expect(previousButton).toBeEnabled()
  })

  it('wraps to the first photo when advancing past the last one with loop enabled', async () => {
    await renderValidatedCarouselGallery(galleryCarouselNode(2, carouselDisplay({ visibleCount: 1, loop: true })))

    const nextButton = screen.getByRole('button', { name: 'Siguiente' })
    fireEvent.click(nextButton)
    fireEvent.click(nextButton)

    expect(screen.getByRole('button', { name: 'Anterior' })).toBeEnabled()
  })

  it('opens the lightbox when clicking a slide', async () => {
    await renderValidatedCarouselGallery(galleryCarouselNode(3))

    fireEvent.click(screen.getByRole('button', { name: 'Photo 1' }))

    expect(screen.getByTestId('gallery-lightbox-overlay')).toBeInTheDocument()
  })

  it('resets the active carousel position when the resolved collection identity changes', async () => {
    const { rerender } = await renderValidatedCarouselGallery(galleryCarouselNode(3, carouselDisplay({ visibleCount: 1 })))

    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeEnabled()

    const nextConfig = validateGalleryConfig(galleryCarouselNode(2, carouselDisplay({ visibleCount: 1 })))
    const nextState: RuntimeState = createRuntimeState(nextConfig)
    const dispatch = vi.fn<(action: RuntimeStateAction) => void>()
    const dispatchAndSyncState = vi.fn<(action: RuntimeStateAction) => void>()

    await act(async () => {
      rerender(
        <RuntimeStateContext.Provider
          value={{
            config: nextConfig,
            initialState: nextState,
            state: nextState,
            dispatch,
            dispatchAndSyncState,
            getLatestState: () => nextState,
          }}
        >
          <RuntimePage />
        </RuntimeStateContext.Provider>,
      )
    })

    expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled()
  })
})
