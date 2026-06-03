import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RuntimeConfig, RuntimePageConfig } from '../../config/runtime-config'
import { RuntimePage } from '../../runtime/runtime-page'
import { RuntimeStateContext } from '../../runtime/runtime-state/runtime-state-context'
import { createRuntimeState } from '../../runtime/runtime-state/runtime-state-reducer'
import type { RuntimeState, RuntimeStateAction } from '../../runtime/runtime-state/runtime-state-types'

afterEach(() => {
  vi.unstubAllGlobals()
})

function renderRuntimePageWithState(activePage: RuntimePageConfig, state: RuntimeState) {
  const config: RuntimeConfig = {
    api: {},
    initialPage: activePage.id,
    pages: [activePage],
  }
  const dispatch = vi.fn<(action: RuntimeStateAction) => void>()
  const dispatchAndSyncState = vi.fn<(action: RuntimeStateAction) => void>()

  return {
    ...render(
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
    ),
    dispatch,
    dispatchAndSyncState,
  }
}

function createRuntimePageState(
  activePage: RuntimePageConfig,
  queries: RuntimeState['queries'] = {},
): RuntimeState {
  const config: RuntimeConfig = {
    api: {},
    initialPage: activePage.id,
    pages: [activePage],
  }

  const baseState = createRuntimeState(config)

  return {
    ...baseState,
    queries,
  } satisfies RuntimeState
}

function makeBlobResponse(size = 100, type = 'image/png') {
  const bytes = new Uint8Array(size)
  const blob = new Blob([bytes], { type })
  return new Response(blob, { status: 200 })
}

describe('RuntimePage — image node with fetch', () => {
  let createObjectURLSpy: ReturnType<typeof vi.spyOn>
  let revokeObjectURLSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-url')
    URL.revokeObjectURL = vi.fn()
    createObjectURLSpy = vi.spyOn(URL, 'createObjectURL')
    revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL')
  })

  afterEach(() => {
    createObjectURLSpy.mockRestore()
    revokeObjectURLSpy.mockRestore()
  })

  it('does not render <img> while the fetch is in progress, then renders it with blob: src after resolution', async () => {
    const activePage: RuntimePageConfig = {
      id: 'fetch-image',
      layout: [
        {
          type: 'image',
          props: {
            fetch: { url: '/media/hero.png' },
            alt: 'Hero image',
          },
        },
      ],
    }

    let resolveFetch!: (value: Response) => void
    const pendingFetch = new Promise<Response>((resolve) => {
      resolveFetch = resolve
    })

    vi.stubGlobal('fetch', vi.fn().mockReturnValue(pendingFetch))

    renderRuntimePageWithState(activePage, createRuntimePageState(activePage))

    // While pending — no <img>
    expect(screen.queryByRole('img')).not.toBeInTheDocument()

    await act(async () => {
      resolveFetch(makeBlobResponse())
    })

    // After resolution — <img> with blob: src
    const img = screen.getByRole('img', { name: 'Hero image' })
    expect(img.getAttribute('src')).toMatch(/^blob:/)
    expect(img).toHaveAttribute('alt', 'Hero image')
  })

  it('does not render <img> while the fetch is still pending', async () => {
    const activePage: RuntimePageConfig = {
      id: 'fetch-image-pending',
      layout: [
        {
          type: 'image',
          props: {
            fetch: { url: '/media/hero.png' },
            alt: 'Hero image',
          },
        },
      ],
    }

    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => undefined)))

    renderRuntimePageWithState(activePage, createRuntimePageState(activePage))

    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('does not render <img> if fetch rejects with a network error', async () => {
    const activePage: RuntimePageConfig = {
      id: 'fetch-image-network-error',
      layout: [
        {
          type: 'image',
          props: {
            fetch: { url: '/media/hero.png' },
            alt: 'Hero image',
          },
        },
      ],
    }

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network failure')))

    await act(async () => {
      renderRuntimePageWithState(activePage, createRuntimePageState(activePage))
    })

    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('does not render <img> if the response has an HTTP error status', async () => {
    const activePage: RuntimePageConfig = {
      id: 'fetch-image-http-error',
      layout: [
        {
          type: 'image',
          props: {
            fetch: { url: '/media/hero.png' },
            alt: 'Hero image',
          },
        },
      ],
    }

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(null, { status: 500 })),
    )

    await act(async () => {
      renderRuntimePageWithState(activePage, createRuntimePageState(activePage))
    })

    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('does not render <img> if the blob has size === 0', async () => {
    const activePage: RuntimePageConfig = {
      id: 'fetch-image-empty-blob',
      layout: [
        {
          type: 'image',
          props: {
            fetch: { url: '/media/hero.png' },
            alt: 'Hero image',
          },
        },
      ],
    }

    // jsdom's Response wrapping of an empty Blob produces a non-zero size blob
    // so we construct a Response whose .blob() explicitly returns a zero-size Blob
    const emptyBlob = new Blob([])
    const emptyBlobResponse = new Response(makeBlobResponse().body, { status: 200 })
    Object.defineProperty(emptyBlobResponse, 'blob', {
      value: () => Promise.resolve(emptyBlob),
    })

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(emptyBlobResponse))

    await act(async () => {
      renderRuntimePageWithState(activePage, createRuntimePageState(activePage))
    })

    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('revokes the object URL when the component unmounts', async () => {
    const activePage: RuntimePageConfig = {
      id: 'fetch-image-revoke',
      layout: [
        {
          type: 'image',
          props: {
            fetch: { url: '/media/hero.png' },
            alt: 'Hero image',
          },
        },
      ],
    }

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeBlobResponse()))

    const { unmount } = renderRuntimePageWithState(activePage, createRuntimePageState(activePage))

    await act(async () => {})

    expect(createObjectURLSpy).toHaveBeenCalledTimes(1)
    expect(revokeObjectURLSpy).not.toHaveBeenCalled()

    unmount()

    expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:mock-url')
  })

  it('does not call createObjectURL and does not update state if unmounted before fetch resolves', async () => {
    const activePage: RuntimePageConfig = {
      id: 'fetch-image-early-unmount',
      layout: [
        {
          type: 'image',
          props: {
            fetch: { url: '/media/hero.png' },
            alt: 'Hero image',
          },
        },
      ],
    }

    let resolveFetch!: (value: Response) => void
    const pendingFetch = new Promise<Response>((resolve) => {
      resolveFetch = resolve
    })

    vi.stubGlobal('fetch', vi.fn().mockReturnValue(pendingFetch))

    const { unmount } = renderRuntimePageWithState(activePage, createRuntimePageState(activePage))

    // Unmount before fetch resolves
    unmount()

    await act(async () => {
      resolveFetch(makeBlobResponse())
    })

    // createObjectURL should not have been called since component was unmounted
    expect(createObjectURLSpy).not.toHaveBeenCalled()
  })

  it('two image fetch instances trigger independent fetches and render independently', async () => {
    const activePage: RuntimePageConfig = {
      id: 'fetch-image-two-instances',
      layout: [
        {
          type: 'image',
          props: {
            fetch: { url: '/media/first.png' },
            alt: 'First image',
          },
        },
        {
          type: 'image',
          props: {
            fetch: { url: '/media/second.png' },
            alt: 'Second image',
          },
        },
      ],
    }

    // Use mockImplementation so each fetch call gets a fresh Response (body streams are not reusable)
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(makeBlobResponse())))

    await act(async () => {
      renderRuntimePageWithState(activePage, createRuntimePageState(activePage))
    })

    const fetchMock = vi.mocked(fetch)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock).toHaveBeenCalledWith('/media/first.png', expect.any(Object))
    expect(fetchMock).toHaveBeenCalledWith('/media/second.png', expect.any(Object))

    expect(screen.getByRole('img', { name: 'First image' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Second image' })).toBeInTheDocument()
  })

  it('within a repeater, each item resolves fetch.url with its own item.* context', async () => {
    const activePage: RuntimePageConfig = {
      id: 'fetch-image-repeater',
      layout: [
        {
          type: 'repeater',
          props: {
            items: {
              source: 'queries.images.data.results',
              key: 'id',
            },
            template: [
              {
                type: 'image',
                props: {
                  fetch: { url: '/media/{{item.id}}.png' },
                  alt: 'item.name',
                },
              },
            ],
          },
        },
      ],
    }

    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(makeBlobResponse())))

    await act(async () => {
      renderRuntimePageWithState(
        activePage,
        createRuntimePageState(activePage, {
          images: {
            status: 'success',
            data: {
              results: [
                { id: 'img-1', name: 'Image 1' },
                { id: 'img-2', name: 'Image 2' },
              ],
            },
            error: null,
          },
        }),
      )
    })

    const fetchMock = vi.mocked(fetch)
    expect(fetchMock).toHaveBeenCalledWith('/media/img-1.png', expect.any(Object))
    expect(fetchMock).toHaveBeenCalledWith('/media/img-2.png', expect.any(Object))
  })

  it('outside a repeater, resolves fetch.url without item.* context', async () => {
    const activePage: RuntimePageConfig = {
      id: 'fetch-image-no-repeater',
      layout: [
        {
          type: 'image',
          props: {
            fetch: { url: 'queries.hero.data.imageUrl' },
            alt: 'Hero',
          },
        },
      ],
    }

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeBlobResponse()))

    await act(async () => {
      renderRuntimePageWithState(
        activePage,
        createRuntimePageState(activePage, {
          hero: {
            status: 'success',
            data: { imageUrl: '/cdn/hero.png' },
            error: null,
          },
        }),
      )
    })

    const fetchMock = vi.mocked(fetch)
    expect(fetchMock).toHaveBeenCalledWith('/cdn/hero.png', expect.any(Object))
    expect(screen.getByRole('img', { name: 'Hero' })).toBeInTheDocument()
  })

  it('existing image node with props.src continues to render as before', () => {
    const activePage: RuntimePageConfig = {
      id: 'src-image-regression',
      layout: [
        {
          type: 'image',
          props: {
            src: '/media/hero.png',
            alt: 'Hero image',
          },
        },
      ],
    }

    renderRuntimePageWithState(activePage, createRuntimePageState(activePage))

    const img = screen.getByRole('img', { name: 'Hero image' })
    expect(img).toHaveAttribute('src', '/media/hero.png')
    expect(img).toHaveAttribute('alt', 'Hero image')
  })

  it('image node with fetch does not write to state.queries', async () => {
    const activePage: RuntimePageConfig = {
      id: 'fetch-image-no-state-write',
      layout: [
        {
          type: 'image',
          props: {
            fetch: { url: '/media/hero.png' },
            alt: 'Hero image',
          },
        },
      ],
    }

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeBlobResponse()))

    const initialState = createRuntimePageState(activePage, {})
    const { dispatch, dispatchAndSyncState } = renderRuntimePageWithState(activePage, initialState)

    await act(async () => {})

    // No actions dispatched to the state store
    expect(dispatch).not.toHaveBeenCalled()
    expect(dispatchAndSyncState).not.toHaveBeenCalled()
  })
})
