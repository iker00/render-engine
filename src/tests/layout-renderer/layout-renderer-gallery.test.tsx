import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RuntimeConfig } from '../../config/runtime-config'
import { validateRuntimeConfig } from '../../config/runtime-config'
import { LayoutEditModeProvider } from '../../runtime/layout-edit-mode-context'
import type { LayoutEditModeContextValue } from '../../runtime/layout-edit-mode-context-value'
import { RuntimePage } from '../../runtime/runtime-page'
import { RuntimeStateContext } from '../../runtime/runtime-state/runtime-state-context'
import { createRuntimeState } from '../../runtime/runtime-state/runtime-state-reducer'
import type { RuntimeState, RuntimeStateAction } from '../../runtime/runtime-state/runtime-state-types'

// This file exercises the real pipeline (raw config -> validateRuntimeConfig -> LayoutRenderer),
// the same criterion as layout-renderer-map.test.tsx. Unit-level cases for resolveGalleryPhotos,
// GalleryPaginatedView and GalleryLightbox already live in T2-T6's dedicated test files and are
// not repeated here.

afterEach(() => {
  vi.unstubAllGlobals()
})

function buildRawConfig(layoutNode: Record<string, unknown>) {
  return {
    api: {},
    initialPage: 'home',
    pages: [{ id: 'home', layout: [layoutNode] }],
  }
}

function validateGalleryPage(layoutNode: Record<string, unknown>) {
  return validateRuntimeConfig(buildRawConfig(layoutNode))
}

function renderWithConfigAndQueries(
  config: RuntimeConfig,
  queries: RuntimeState['queries'] = {},
  editModeValue?: LayoutEditModeContextValue,
) {
  const baseState = createRuntimeState(config)
  const state: RuntimeState = { ...baseState, queries }
  const dispatch = vi.fn<(action: RuntimeStateAction) => void>()
  const dispatchAndSyncState = vi.fn<(action: RuntimeStateAction) => void>()

  const page = (
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
    </RuntimeStateContext.Provider>
  )

  return {
    ...render(editModeValue ? <LayoutEditModeProvider value={editModeValue}>{page}</LayoutEditModeProvider> : page),
    config,
    dispatch,
    dispatchAndSyncState,
  }
}

// Renders a single gallery layout node end-to-end through the real validation pipeline. Throws
// with the validation error if the fixture itself is invalid, so a broken test fixture fails loud
// instead of silently rendering nothing.
function renderValidatedGallery(
  layoutNode: Record<string, unknown>,
  queries: RuntimeState['queries'] = {},
  editModeValue?: LayoutEditModeContextValue,
) {
  const result = validateGalleryPage(layoutNode)

  if (result.status !== 'ready') {
    throw new Error(`Expected a valid gallery config, got error: ${JSON.stringify(result.error)}`)
  }

  return renderWithConfigAndQueries(result.config, queries, editModeValue)
}

function paginatedDisplay(pageSize: number, variant?: 'previousNext' | 'numbered' | 'scroll') {
  return {
    mode: 'paginated',
    pagination: { pageSize, ...(variant ? { controls: { variant } } : {}) },
  }
}

function staticGalleryNode(
  images: Array<{ src: string; alt: string }>,
  display: Record<string, unknown> = paginatedDisplay(10),
  overrides: Record<string, unknown> = {},
) {
  return { type: 'gallery', props: { images, display }, ...overrides }
}

function dynamicGalleryNode(
  source: Record<string, unknown>,
  display: Record<string, unknown> = paginatedDisplay(10),
  overrides: Record<string, unknown> = {},
) {
  return { type: 'gallery', props: { source, display }, ...overrides }
}

function makeStaticImages(count: number) {
  return Array.from({ length: count }, (_, index) => ({ src: `/img-${index + 1}.jpg`, alt: `Photo ${index + 1}` }))
}

describe('GalleryNode — static source (props.images)', () => {
  it('renders one image per declared entry', () => {
    renderValidatedGallery(
      staticGalleryNode([
        { src: '/a.jpg', alt: 'Photo A' },
        { src: '/b.jpg', alt: 'Photo B' },
      ]),
    )

    expect(screen.getByRole('img', { name: 'Photo A' })).toHaveAttribute('src', '/a.jpg')
    expect(screen.getByRole('img', { name: 'Photo B' })).toHaveAttribute('src', '/b.jpg')
    expect(screen.getAllByRole('img')).toHaveLength(2)
  })
})

describe('GalleryNode — dynamic source (queries.*)', () => {
  it('renders one image per resolved item from queries.{name}.data', () => {
    const node = dynamicGalleryNode({ source: 'queries.photos.data', key: 'id', alt: 'title', mode: 'src', src: 'url' })

    renderValidatedGallery(node, {
      photos: {
        status: 'success',
        data: [
          { id: 'p1', title: 'Sunset', url: '/sunset.jpg' },
          { id: 'p2', title: 'Mountain', url: '/mountain.jpg' },
        ],
        error: null,
      },
    })

    expect(screen.getByRole('img', { name: 'Sunset' })).toHaveAttribute('src', '/sunset.jpg')
    expect(screen.getByRole('img', { name: 'Mountain' })).toHaveAttribute('src', '/mountain.jpg')
    expect(screen.getAllByRole('img')).toHaveLength(2)
  })
})

describe('GalleryNode — dynamic source (item.* inside repeater.props.template)', () => {
  it('each repeater iteration renders its own gallery scoped to its own item photos', () => {
    const layoutNode = {
      type: 'repeater',
      props: {
        items: { source: 'queries.posts.data', key: 'id' },
        template: [
          dynamicGalleryNode({ source: 'item.photos', key: '$index', alt: 'label', mode: 'src', src: 'url' }),
        ],
      },
    }

    const result = validateGalleryPage(layoutNode)
    if (result.status !== 'ready') {
      throw new Error(`Expected a valid config, got error: ${JSON.stringify(result.error)}`)
    }

    renderWithConfigAndQueries(result.config, {
      posts: {
        status: 'success',
        data: [
          { id: 'post-1', photos: [{ url: '/a.jpg', label: 'A' }] },
          { id: 'post-2', photos: [{ url: '/b1.jpg', label: 'B1' }, { url: '/b2.jpg', label: 'B2' }] },
        ],
        error: null,
      },
    })

    const alts = screen.getAllByRole('img').map((img) => img.getAttribute('alt'))
    expect(alts).toEqual(['A', 'B1', 'B2'])
  })
})

describe('GalleryNode — mutually exclusive origin/none rejected by validation', () => {
  it('rejects a config declaring both images and source', () => {
    const result = validateGalleryPage({
      type: 'gallery',
      props: {
        images: [{ src: '/a.jpg', alt: 'A' }],
        source: { source: 'queries.photos.data', key: 'id', alt: 'title', mode: 'src', src: 'url' },
        display: paginatedDisplay(4),
      },
    })

    expect(result.status).toBe('error')
  })

  it('rejects a config declaring neither images nor source', () => {
    const result = validateGalleryPage({ type: 'gallery', props: { display: paginatedDisplay(4) } })

    expect(result.status).toBe('error')
  })
})

describe('GalleryNode — paginated mode with pageSize', () => {
  it('renders at most pageSize images per page with the configured controls variant', () => {
    renderValidatedGallery(staticGalleryNode(makeStaticImages(5), paginatedDisplay(2, 'numbered')))

    expect(screen.getAllByRole('img')).toHaveLength(2)
    expect(screen.getByRole('img', { name: 'Photo 1' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Photo 2' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Primera' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Última' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }))

    expect(screen.getByRole('img', { name: 'Photo 3' })).toBeInTheDocument()
    expect(screen.getAllByRole('img')).toHaveLength(2)
  })
})

describe('GalleryNode — lightbox', () => {
  it('clicking a photo opens the lightbox showing that photo', () => {
    renderValidatedGallery(staticGalleryNode(makeStaticImages(3)))

    fireEvent.click(screen.getByRole('button', { name: 'Photo 2' }))

    const panel = screen.getByTestId('gallery-lightbox-panel')
    expect(within(panel).getByRole('img', { name: 'Photo 2' })).toBeInTheDocument()
  })

  it('navigating within the lightbox traverses the full resolved collection, not just the current page', () => {
    renderValidatedGallery(staticGalleryNode(makeStaticImages(5), paginatedDisplay(2)))

    fireEvent.click(screen.getByRole('button', { name: 'Photo 2' }))
    const panel = screen.getByTestId('gallery-lightbox-panel')
    expect(within(panel).getByRole('img', { name: 'Photo 2' })).toBeInTheDocument()

    fireEvent.click(within(panel).getByRole('button', { name: 'Siguiente' }))

    expect(within(panel).getByRole('img', { name: 'Photo 3' })).toBeInTheDocument()
  })

  it('closes via the explicit close button', () => {
    renderValidatedGallery(staticGalleryNode(makeStaticImages(2)))

    fireEvent.click(screen.getByRole('button', { name: 'Photo 1' }))
    expect(screen.getByTestId('gallery-lightbox-overlay')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }))

    expect(screen.queryByTestId('gallery-lightbox-overlay')).not.toBeInTheDocument()
  })

  it('closes by clicking the overlay outside the panel', () => {
    renderValidatedGallery(staticGalleryNode(makeStaticImages(2)))

    fireEvent.click(screen.getByRole('button', { name: 'Photo 1' }))
    fireEvent.click(screen.getByTestId('gallery-lightbox-overlay'))

    expect(screen.queryByTestId('gallery-lightbox-overlay')).not.toBeInTheDocument()
  })

  it('closes on Escape', () => {
    renderValidatedGallery(staticGalleryNode(makeStaticImages(2)))

    fireEvent.click(screen.getByRole('button', { name: 'Photo 1' }))
    fireEvent.keyDown(screen.getByTestId('gallery-lightbox-overlay'), { key: 'Escape' })

    expect(screen.queryByTestId('gallery-lightbox-overlay')).not.toBeInTheDocument()
  })
})

describe('GalleryNode — dynamic source, mode "src": unresolved entries degrade silently', () => {
  it('omits an item without a resolvable src and renders the rest normally, including pagination', () => {
    const node = dynamicGalleryNode(
      { source: 'queries.photos.data', key: 'id', alt: 'title', mode: 'src', src: 'url' },
      paginatedDisplay(1, 'previousNext'),
    )

    renderValidatedGallery(node, {
      photos: {
        status: 'success',
        data: [
          { id: 'p1', title: 'A', url: '/a.jpg' },
          { id: 'p2', title: 'B', url: '' },
          { id: 'p3', title: 'C', url: '/c.jpg' },
        ],
        error: null,
      },
    })

    expect(screen.getByRole('img', { name: 'A' })).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: 'B' })).not.toBeInTheDocument()
    expect(screen.getAllByRole('img')).toHaveLength(1)

    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }))

    expect(screen.getByRole('img', { name: 'C' })).toBeInTheDocument()
  })
})

describe('GalleryNode — dynamic source, mode "fetch"', () => {
  function makeBlobResponse(size = 100, type = 'image/png') {
    const blob = new Blob([new Uint8Array(size)], { type })
    return new Response(blob, { status: 200 })
  }

  function makeEmptyBlobResponse() {
    const response = new Response(makeBlobResponse().body, { status: 200 })
    Object.defineProperty(response, 'blob', { value: () => Promise.resolve(new Blob([])) })
    return response
  }

  beforeEach(() => {
    URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-url')
    URL.revokeObjectURL = vi.fn()
  })

  it('fetches one binary request per element and renders it when resolved, without breaking the rest', async () => {
    const node = dynamicGalleryNode({
      source: 'queries.photos.data',
      key: 'id',
      alt: 'title',
      mode: 'fetch',
      fetch: { url: '/media/{{item.id}}.jpg' },
      idField: 'id',
    })

    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url === '/media/ok.jpg') return Promise.resolve(makeBlobResponse())
        if (url === '/media/bad.jpg') return Promise.resolve(new Response(null, { status: 500 }))
        if (url === '/media/empty.jpg') return Promise.resolve(makeEmptyBlobResponse())
        return new Promise(() => undefined) // pending forever
      }),
    )

    await act(async () => {
      renderValidatedGallery(node, {
        photos: {
          status: 'success',
          data: [
            { id: 'ok', title: 'OK photo' },
            { id: 'bad', title: 'HTTP error photo' },
            { id: 'empty', title: 'Invalid binary photo' },
            { id: 'pending', title: 'Pending photo' },
          ],
          error: null,
        },
      })
    })

    expect(screen.getByRole('img', { name: 'OK photo' })).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: 'HTTP error photo' })).not.toBeInTheDocument()
    expect(screen.queryByRole('img', { name: 'Invalid binary photo' })).not.toBeInTheDocument()
    expect(screen.queryByRole('img', { name: 'Pending photo' })).not.toBeInTheDocument()
    expect(screen.getAllByRole('img')).toHaveLength(1)
  })
})

describe('GalleryNode — transversal features (via LayoutRenderer)', () => {
  it('hides the gallery when visibility evaluates to false', () => {
    const node = staticGalleryNode(makeStaticImages(1), paginatedDisplay(4), {
      visibility: { reference: 'queries.q.data.show', operator: 'isTruthy' },
    })

    renderValidatedGallery(node, {
      q: { status: 'success', data: { show: false }, error: null },
    })

    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('shows feedback fallback when queryStateFeedback triggers on loading state', () => {
    const node = staticGalleryNode(makeStaticImages(1), paginatedDisplay(4), {
      queryStateFeedback: {
        query: 'q',
        states: { loading: { mode: 'fallback', fallback: [{ type: 'paragraph', props: { text: 'Cargando...' } }] } },
      },
    })

    renderValidatedGallery(node, {
      q: { status: 'loading', data: null, error: null },
    })

    expect(screen.getByText('Cargando...')).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('wraps the gallery in a col-span wrapper when layout.span is set inside a container with columns', () => {
    const layoutNode = {
      type: 'container',
      props: { columns: 12 },
      children: [staticGalleryNode(makeStaticImages(1), paginatedDisplay(4), { layout: { span: 4 } })],
    }
    const result = validateGalleryPage(layoutNode)
    if (result.status !== 'ready') {
      throw new Error(`Expected a valid config, got error: ${JSON.stringify(result.error)}`)
    }

    const { container } = renderWithConfigAndQueries(result.config)
    const spanWrapper = container.querySelector('.col-span-4')

    expect(spanWrapper).toBeInTheDocument()
    expect(spanWrapper!.querySelector('img')).toBeInTheDocument()
  })
})

describe('GalleryNode — empty collection', () => {
  it('renders no images, no pagination controls and offers no way to open the lightbox', () => {
    const { container } = renderValidatedGallery(staticGalleryNode([], paginatedDisplay(4)))

    expect(screen.queryAllByRole('img')).toHaveLength(0)
    expect(screen.queryAllByRole('button')).toHaveLength(0)
    expect(container.querySelector('[data-layout-node="gallery-pagination"]')).toBeNull()
  })

  it('renders no placeholder trace when a LayoutEditModeProvider is present but inactive (Visual mode inside DevRuntime)', () => {
    const { container } = renderValidatedGallery(staticGalleryNode([], paginatedDisplay(4)), {}, { active: false })

    expect(container.querySelector('[data-layout-node="gallery-empty-placeholder"]')).toBeNull()
  })

  it('renders a selectable placeholder for an empty gallery inside an active LayoutEditModeProvider (Editor mode)', () => {
    const onSelectNode = vi.fn()
    const { container } = renderValidatedGallery(staticGalleryNode([], paginatedDisplay(4)), {}, {
      active: true,
      selectedPath: null,
      hoveredPath: null,
      onSelectNode,
      onHoverNode: vi.fn(),
    })

    const placeholder = screen.getByText('Galería vacía')
    expect(placeholder).toHaveAttribute('data-layout-node', 'gallery-empty-placeholder')

    // The generic per-node selection wrapper from layout-node-renderer.tsx is what makes this
    // clickable — the placeholder just gives it non-zero, visible content to click on.
    const selectionWrapper = container.querySelector('[data-node-path="children.0"]')
    expect(selectionWrapper).not.toBeNull()
    expect(selectionWrapper).toContainElement(placeholder)

    fireEvent.click(placeholder)
    expect(onSelectNode).toHaveBeenCalledTimes(1)
  })

  it('never shows the empty placeholder once the collection has photos, even in Editor mode', () => {
    renderValidatedGallery(staticGalleryNode(makeStaticImages(1), paginatedDisplay(4)), {}, {
      active: true,
      selectedPath: null,
      hoveredPath: null,
      onSelectNode: vi.fn(),
      onHoverNode: vi.fn(),
    })

    expect(screen.queryByText('Galería vacía')).not.toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Photo 1' })).toBeInTheDocument()
  })
})

describe('GalleryNode — reset on collection change', () => {
  it('resets the active page to 1 when the resolved collection identity changes', () => {
    const node = dynamicGalleryNode(
      { source: 'queries.photos.data', key: 'id', alt: 'title', mode: 'src', src: 'url' },
      paginatedDisplay(2),
    )
    const result = validateGalleryPage(node)
    if (result.status !== 'ready') {
      throw new Error(`Expected a valid config, got error: ${JSON.stringify(result.error)}`)
    }
    const { config } = result

    const firstQueries: RuntimeState['queries'] = {
      photos: {
        status: 'success',
        data: [
          { id: 'p1', title: 'v1-1', url: '/v1-1.jpg' },
          { id: 'p2', title: 'v1-2', url: '/v1-2.jpg' },
          { id: 'p3', title: 'v1-3', url: '/v1-3.jpg' },
        ],
        error: null,
      },
    }
    const { rerender } = renderWithConfigAndQueries(config, firstQueries)

    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    expect(screen.getByRole('img', { name: 'v1-3' })).toBeInTheDocument()

    const secondState: RuntimeState = {
      ...createRuntimeState(config),
      queries: {
        photos: {
          status: 'success',
          data: [
            { id: 'p4', title: 'v2-1', url: '/v2-1.jpg' },
            { id: 'p5', title: 'v2-2', url: '/v2-2.jpg' },
          ],
          error: null,
        },
      },
    }

    rerender(
      <RuntimeStateContext.Provider
        value={{
          config,
          initialState: secondState,
          state: secondState,
          dispatch: vi.fn<(action: RuntimeStateAction) => void>(),
          dispatchAndSyncState: vi.fn<(action: RuntimeStateAction) => void>(),
          getLatestState: () => secondState,
        }}
      >
        <RuntimePage />
      </RuntimeStateContext.Provider>,
    )

    expect(screen.getByRole('img', { name: 'v2-1' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'v2-2' })).toBeInTheDocument()
  })
})
