import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { RuntimeConfig, RuntimePageConfig } from '../../config/runtime-config'
import { RuntimePage } from '../../runtime/runtime-page'
import { RuntimeStateContext } from '../../runtime/runtime-state/runtime-state-context'
import { createRuntimeState } from '../../runtime/runtime-state/runtime-state-reducer'
import type { RuntimeState, RuntimeStateAction } from '../../runtime/runtime-state/runtime-state-types'
import { RuntimeStateProvider } from '../../runtime/runtime-state/runtime-state-provider'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyProps = Record<string, any>

// react-leaflet measures real DOM dimensions and uses canvas/ResizeObserver APIs that
// jsdom does not implement, so it's replaced here with lightweight test doubles that
// expose the relevant props as data-* attributes for assertions.
vi.mock('react-leaflet', () => ({
  MapContainer: ({ center, zoom, bounds, className, children }: AnyProps) => (
    <div
      data-testid="map-container"
      data-center={center ? JSON.stringify(center) : undefined}
      data-bounds={bounds ? JSON.stringify(bounds) : undefined}
      data-zoom={zoom}
      className={className}
    >
      {children}
    </div>
  ),
  TileLayer: ({ url }: AnyProps) => <div data-testid="tile-layer" data-url={url} />,
  Marker: ({ position, icon, children }: AnyProps) => (
    <div
      data-testid="marker"
      data-lat={position[0]}
      data-lng={position[1]}
      data-icon-html={icon.options.html}
    >
      {children}
    </div>
  ),
  Popup: ({ children }: AnyProps) => <div data-testid="popup">{children}</div>,
}))

const MARKER_COLOR_HEX = {
  neutral: '#64748b',
  primary: '#3b82f6',
  success: '#22c55e',
  warning: '#f59e0b',
  danger: '#ef4444',
  info: '#06b6d4',
} as const

function renderRuntimePage(activePage: RuntimePageConfig) {
  const config: RuntimeConfig = {
    api: {},
    initialPage: activePage.id,
    pages: [activePage],
  }

  return render(
    <RuntimeStateProvider config={config}>
      <RuntimePage />
    </RuntimeStateProvider>,
  )
}

function renderRuntimePageWithState(activePage: RuntimePageConfig, state: RuntimeState) {
  const config: RuntimeConfig = {
    api: {},
    initialPage: activePage.id,
    pages: [activePage],
  }
  const dispatch = vi.fn<(action: RuntimeStateAction) => void>()
  const dispatchAndSyncState = vi.fn<(action: RuntimeStateAction) => void>()

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
      <RuntimePage />
    </RuntimeStateContext.Provider>,
  )
}

function createRuntimePageState(
  activePage: RuntimePageConfig,
  queries: RuntimeState['queries'],
): RuntimeState {
  const config: RuntimeConfig = {
    api: {},
    initialPage: activePage.id,
    pages: [activePage],
  }
  const baseState = createRuntimeState(config)
  return { ...baseState, queries }
}

describe('MapNode — center, zoom, height defaults', () => {
  it('renders with Pamplona center when props.center is not declared', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [{ type: 'map' }],
    }
    renderRuntimePage(page)
    const mapContainer = screen.getByTestId('map-container')
    expect(JSON.parse(mapContainer.dataset.center!)).toEqual([42.8125, -1.6458])
  })

  it('renders with the explicit center from props.center', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [{ type: 'map', props: { center: { lat: 40.4168, lng: -3.7038 } } }],
    }
    renderRuntimePage(page)
    const mapContainer = screen.getByTestId('map-container')
    expect(JSON.parse(mapContainer.dataset.center!)).toEqual([40.4168, -3.7038])
  })

  it('renders with zoom 13 when props.zoom is not declared', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [{ type: 'map' }],
    }
    renderRuntimePage(page)
    expect(screen.getByTestId('map-container').dataset.zoom).toBe('13')
  })

  it('renders with the explicit zoom from props.zoom', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [{ type: 'map', props: { zoom: 5 } }],
    }
    renderRuntimePage(page)
    expect(screen.getByTestId('map-container').dataset.zoom).toBe('5')
  })

  it('uses the h-80 class (md) when props.height is not declared', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [{ type: 'map' }],
    }
    renderRuntimePage(page)
    expect(screen.getByTestId('map-container')).toHaveClass('h-80')
  })

  it('uses the class matching an explicit props.height', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [{ type: 'map', props: { height: 'xl' } }],
    }
    renderRuntimePage(page)
    expect(screen.getByTestId('map-container')).toHaveClass('h-[32rem]')
  })
})

describe('MapNode — static markers (props.markers)', () => {
  it('renders one marker per declared entry with position, primary icon and visible label in its popup', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'map',
          props: {
            markers: [
              { lat: 1, lng: 2, label: 'Marker A' },
              { lat: 3, lng: 4, label: 'Marker B' },
            ],
          },
        },
      ],
    }
    renderRuntimePage(page)
    const markers = screen.getAllByTestId('marker')
    expect(markers).toHaveLength(2)
    expect(markers[0].dataset.lat).toBe('1')
    expect(markers[0].dataset.lng).toBe('2')
    expect(markers[0].dataset.iconHtml).toContain(MARKER_COLOR_HEX.primary)
    expect(markers[1].dataset.iconHtml).toContain(MARKER_COLOR_HEX.primary)
    expect(screen.getByText('Marker A')).toBeInTheDocument()
    expect(screen.getByText('Marker B')).toBeInTheDocument()
  })

  it('renders no marker when props.markers is an empty array', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [{ type: 'map', props: { markers: [] } }],
    }
    renderRuntimePage(page)
    expect(screen.queryAllByTestId('marker')).toHaveLength(0)
  })
})

describe('MapNode — dynamic markers (props.markerSources)', () => {
  it('renders one marker per resolved collection item for a single dynamic source', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'map',
          props: {
            markerSources: [
              {
                source: 'queries.venues.data',
                position: { lat: 'coords.lat', lng: 'coords.lng' },
                label: 'name',
              },
            ],
          },
        },
      ],
    }
    const state = createRuntimePageState(page, {
      venues: {
        status: 'success',
        data: [
          { name: 'Cafe Central', coords: { lat: 40.4168, lng: -3.7038 } },
          { name: 'Bakery North', coords: { lat: 43.263, lng: -2.935 } },
        ],
        requestedAt: 0,
        resolvedAt: 0,
        error: null,
      },
    })
    renderRuntimePageWithState(page, state)
    const markers = screen.getAllByTestId('marker')
    expect(markers).toHaveLength(2)
    expect(markers[0].dataset.lat).toBe('40.4168')
    expect(markers[0].dataset.lng).toBe('-3.7038')
    expect(screen.getByText('Cafe Central')).toBeInTheDocument()
    expect(screen.getByText('Bakery North')).toBeInTheDocument()
  })

  it('assigns distinct cycle colors (primary, success) to two dynamic sources without declared color', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'map',
          props: {
            markerSources: [
              { source: 'queries.venues.data', position: { lat: 'lat', lng: 'lng' }, label: 'name' },
              { source: 'queries.shops.data', position: { lat: 'lat', lng: 'lng' }, label: 'name' },
            ],
          },
        },
      ],
    }
    const state = createRuntimePageState(page, {
      venues: {
        status: 'success',
        data: [{ name: 'Venue', lat: 1, lng: 2 }],
        requestedAt: 0,
        resolvedAt: 0,
        error: null,
      },
      shops: {
        status: 'success',
        data: [{ name: 'Shop', lat: 5, lng: 6 }],
        requestedAt: 0,
        resolvedAt: 0,
        error: null,
      },
    })
    renderRuntimePageWithState(page, state)
    const markers = screen.getAllByTestId('marker')
    expect(markers).toHaveLength(2)
    expect(markers[0].dataset.iconHtml).toContain(MARKER_COLOR_HEX.primary)
    expect(markers[1].dataset.iconHtml).toContain(MARKER_COLOR_HEX.success)
  })

  it('respects an explicit color on one source and only cycles the color for the source that omits it', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'map',
          props: {
            markerSources: [
              {
                source: 'queries.venues.data',
                position: { lat: 'lat', lng: 'lng' },
                label: 'name',
                color: 'danger',
              },
              { source: 'queries.shops.data', position: { lat: 'lat', lng: 'lng' }, label: 'name' },
            ],
          },
        },
      ],
    }
    const state = createRuntimePageState(page, {
      venues: {
        status: 'success',
        data: [{ name: 'Venue', lat: 1, lng: 2 }],
        requestedAt: 0,
        resolvedAt: 0,
        error: null,
      },
      shops: {
        status: 'success',
        data: [{ name: 'Shop', lat: 5, lng: 6 }],
        requestedAt: 0,
        resolvedAt: 0,
        error: null,
      },
    })
    renderRuntimePageWithState(page, state)
    const markers = screen.getAllByTestId('marker')
    expect(markers).toHaveLength(2)
    // First source declares color: 'danger' explicitly, so the cycle is not applied to it.
    expect(markers[0].dataset.iconHtml).toContain(MARKER_COLOR_HEX.danger)
    // Second source omits color, so it falls back to the cycle at its own index (1 -> success).
    expect(markers[1].dataset.iconHtml).toContain(MARKER_COLOR_HEX.success)
  })

  it('skips an item without valid coordinates while rendering the rest of its source and other sources normally', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'map',
          props: {
            markerSources: [
              { source: 'queries.venues.data', position: { lat: 'lat', lng: 'lng' }, label: 'name' },
              { source: 'queries.shops.data', position: { lat: 'lat', lng: 'lng' }, label: 'name' },
            ],
          },
        },
      ],
    }
    const state = createRuntimePageState(page, {
      venues: {
        status: 'success',
        data: [
          { name: 'Valid venue', lat: 1, lng: 2 },
          { name: 'Invalid venue', lat: 'not-a-number', lng: 2 },
        ],
        requestedAt: 0,
        resolvedAt: 0,
        error: null,
      },
      shops: {
        status: 'success',
        data: [{ name: 'Shop', lat: 5, lng: 6 }],
        requestedAt: 0,
        resolvedAt: 0,
        error: null,
      },
    })
    renderRuntimePageWithState(page, state)
    expect(screen.getByText('Valid venue')).toBeInTheDocument()
    expect(screen.queryByText('Invalid venue')).not.toBeInTheDocument()
    expect(screen.getByText('Shop')).toBeInTheDocument()
    expect(screen.getAllByTestId('marker')).toHaveLength(2)
  })
})

describe('MapNode — marker click shows its label without triggering catalog actions', () => {
  it('shows the marker label on click and does not invoke any navigation/operation dispatch', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'map',
          props: { markers: [{ lat: 1, lng: 2, label: 'Clickable marker' }] },
        },
      ],
    }
    const config: RuntimeConfig = {
      api: {},
      initialPage: page.id,
      pages: [page],
    }
    const state = createRuntimeState(config)
    const dispatch = vi.fn<(action: RuntimeStateAction) => void>()
    const dispatchAndSyncState = vi.fn<(action: RuntimeStateAction) => void>()

    render(
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

    const marker = screen.getByTestId('marker')
    fireEvent.click(marker)
    expect(screen.getByText('Clickable marker')).toBeInTheDocument()
    expect(dispatch).not.toHaveBeenCalled()
    expect(dispatchAndSyncState).not.toHaveBeenCalled()
  })
})

describe('MapNode — transversal features (via LayoutNodeRenderer)', () => {
  it('hides the map when visibility evaluates to false', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'map',
          visibility: {
            reference: 'queries.q.data.show',
            operator: 'isTruthy',
          },
        },
      ],
    }
    const state = createRuntimePageState(page, {
      q: {
        status: 'success',
        data: { show: false },
        requestedAt: 0,
        resolvedAt: 0,
        error: null,
      },
    })
    renderRuntimePageWithState(page, state)
    expect(screen.queryByTestId('map-container')).not.toBeInTheDocument()
  })

  it('shows feedback fallback when queryStateFeedback triggers on loading state', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'map',
          queryStateFeedback: {
            query: 'q',
            states: {
              loading: {
                mode: 'fallback',
                fallback: [{ type: 'paragraph', props: { text: 'Cargando...' } }],
              },
            },
          },
        },
      ],
    }
    const state = createRuntimePageState(page, {
      q: {
        status: 'loading',
        data: null,
        requestedAt: 0,
        resolvedAt: null,
        error: null,
      },
    })
    renderRuntimePageWithState(page, state)
    expect(screen.getByText('Cargando...')).toBeInTheDocument()
    expect(screen.queryByTestId('map-container')).not.toBeInTheDocument()
  })

  it('wraps map in col-span wrapper when layout.span is set inside a container with columns', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'container',
          props: { columns: 12 },
          children: [
            {
              type: 'map',
              layout: { span: 4 },
            },
          ],
        },
      ],
    }
    const { container } = renderRuntimePage(page)
    const spanWrapper = container.querySelector('.col-span-4')
    expect(spanWrapper).toBeInTheDocument()
    expect(spanWrapper!.querySelector('[data-testid="map-container"]')).toBeInTheDocument()
  })
})

describe('MapNode — automatic view adjustment (props.autoFitMarkers)', () => {
  it('keeps the default center/zoom and no bounds when autoFitMarkers is not declared', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'map',
          props: {
            markers: [
              { lat: 1, lng: 2, label: 'A' },
              { lat: 3, lng: 4, label: 'B' },
            ],
          },
        },
      ],
    }
    renderRuntimePage(page)
    const mapContainer = screen.getByTestId('map-container')
    expect(JSON.parse(mapContainer.dataset.center!)).toEqual([42.8125, -1.6458])
    expect(mapContainer.dataset.zoom).toBe('13')
    expect(mapContainer.dataset.bounds).toBeUndefined()
  })

  it('keeps the default center/zoom and no bounds when autoFitMarkers is false', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'map',
          props: {
            autoFitMarkers: false,
            markers: [
              { lat: 1, lng: 2, label: 'A' },
              { lat: 3, lng: 4, label: 'B' },
            ],
          },
        },
      ],
    }
    renderRuntimePage(page)
    const mapContainer = screen.getByTestId('map-container')
    expect(JSON.parse(mapContainer.dataset.center!)).toEqual([42.8125, -1.6458])
    expect(mapContainer.dataset.zoom).toBe('13')
    expect(mapContainer.dataset.bounds).toBeUndefined()
  })

  it('fits bounds to scattered markers and omits center when autoFitMarkers is true', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'map',
          props: {
            autoFitMarkers: true,
            markers: [
              { lat: 1, lng: 2, label: 'Marker A' },
              { lat: 5, lng: -3, label: 'Marker B' },
            ],
          },
        },
      ],
    }
    renderRuntimePage(page)
    const mapContainer = screen.getByTestId('map-container')
    expect(JSON.parse(mapContainer.dataset.bounds!)).toEqual([
      [1, -3],
      [5, 2],
    ])
    expect(mapContainer.dataset.center).toBeUndefined()
    const markers = screen.getAllByTestId('marker')
    expect(markers).toHaveLength(2)
    expect(screen.getByText('Marker A')).toBeInTheDocument()
    expect(screen.getByText('Marker B')).toBeInTheDocument()
  })

  it('fits bounds and ignores declared center/zoom when autoFitMarkers is true with several markers', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'map',
          props: {
            autoFitMarkers: true,
            center: { lat: 40.4168, lng: -3.7038 },
            zoom: 9,
            markers: [
              { lat: 1, lng: 2, label: 'Marker A' },
              { lat: 5, lng: -3, label: 'Marker B' },
            ],
          },
        },
      ],
    }
    renderRuntimePage(page)
    const mapContainer = screen.getByTestId('map-container')
    expect(JSON.parse(mapContainer.dataset.bounds!)).toEqual([
      [1, -3],
      [5, 2],
    ])
    expect(mapContainer.dataset.center).toBeUndefined()
  })

  it('centers on the single marker position with the declared zoom when autoFitMarkers is true', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'map',
          props: {
            autoFitMarkers: true,
            zoom: 7,
            markers: [{ lat: 10, lng: 20, label: 'Only marker' }],
          },
        },
      ],
    }
    renderRuntimePage(page)
    const mapContainer = screen.getByTestId('map-container')
    expect(JSON.parse(mapContainer.dataset.center!)).toEqual([10, 20])
    expect(mapContainer.dataset.zoom).toBe('7')
    expect(mapContainer.dataset.bounds).toBeUndefined()
  })

  it('centers on the single marker position with zoom 13 when props.zoom is not declared', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'map',
          props: {
            autoFitMarkers: true,
            markers: [{ lat: 10, lng: 20, label: 'Only marker' }],
          },
        },
      ],
    }
    renderRuntimePage(page)
    const mapContainer = screen.getByTestId('map-container')
    expect(JSON.parse(mapContainer.dataset.center!)).toEqual([10, 20])
    expect(mapContainer.dataset.zoom).toBe('13')
  })

  it('centers on the shared point and omits bounds when all markers share identical coordinates', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'map',
          props: {
            autoFitMarkers: true,
            markers: [
              { lat: 10, lng: 20, label: 'Marker A' },
              { lat: 10, lng: 20, label: 'Marker B' },
            ],
          },
        },
      ],
    }
    renderRuntimePage(page)
    const mapContainer = screen.getByTestId('map-container')
    expect(JSON.parse(mapContainer.dataset.center!)).toEqual([10, 20])
    expect(mapContainer.dataset.bounds).toBeUndefined()
  })

  it('falls back to the declared center/zoom when autoFitMarkers is true and markers is empty', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'map',
          props: {
            autoFitMarkers: true,
            center: { lat: 40.4168, lng: -3.7038 },
            zoom: 9,
            markers: [],
          },
        },
      ],
    }
    renderRuntimePage(page)
    const mapContainer = screen.getByTestId('map-container')
    expect(JSON.parse(mapContainer.dataset.center!)).toEqual([40.4168, -3.7038])
    expect(mapContainer.dataset.zoom).toBe('9')
    expect(mapContainer.dataset.bounds).toBeUndefined()
  })

  it('falls back to the default center/zoom when autoFitMarkers is true and there are no markers or markerSources', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [{ type: 'map', props: { autoFitMarkers: true } }],
    }
    renderRuntimePage(page)
    const mapContainer = screen.getByTestId('map-container')
    expect(JSON.parse(mapContainer.dataset.center!)).toEqual([42.8125, -1.6458])
    expect(mapContainer.dataset.zoom).toBe('13')
    expect(mapContainer.dataset.bounds).toBeUndefined()
  })

  it('fits bounds to the markerSources items already resolved on first render, ignoring declared center/zoom', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'map',
          props: {
            autoFitMarkers: true,
            center: { lat: 40.4168, lng: -3.7038 },
            zoom: 9,
            markerSources: [
              { source: 'queries.venues.data', position: { lat: 'lat', lng: 'lng' }, label: 'name' },
            ],
          },
        },
      ],
    }
    const state = createRuntimePageState(page, {
      venues: {
        status: 'success',
        data: [
          { name: 'Venue A', lat: 1, lng: 2 },
          { name: 'Venue B', lat: 5, lng: -3 },
        ],
        requestedAt: 0,
        resolvedAt: 0,
        error: null,
      },
    })
    renderRuntimePageWithState(page, state)
    const mapContainer = screen.getByTestId('map-container')
    expect(JSON.parse(mapContainer.dataset.bounds!)).toEqual([
      [1, -3],
      [5, 2],
    ])
    expect(mapContainer.dataset.center).toBeUndefined()
  })

  it('falls back to the declared center/zoom when markerSources resolves an empty collection on first render', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'map',
          props: {
            autoFitMarkers: true,
            center: { lat: 40.4168, lng: -3.7038 },
            zoom: 9,
            markerSources: [
              { source: 'queries.venues.data', position: { lat: 'lat', lng: 'lng' }, label: 'name' },
            ],
          },
        },
      ],
    }
    const state = createRuntimePageState(page, {
      venues: {
        status: 'success',
        data: [],
        requestedAt: 0,
        resolvedAt: 0,
        error: null,
      },
    })
    renderRuntimePageWithState(page, state)
    const mapContainer = screen.getByTestId('map-container')
    expect(JSON.parse(mapContainer.dataset.center!)).toEqual([40.4168, -3.7038])
    expect(mapContainer.dataset.zoom).toBe('9')
    expect(mapContainer.dataset.bounds).toBeUndefined()
  })

  it('keeps the first-render bounds unchanged when a later re-render resolves more markerSources items', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'map',
          props: {
            autoFitMarkers: true,
            markerSources: [
              { source: 'queries.venues.data', position: { lat: 'lat', lng: 'lng' }, label: 'name' },
            ],
          },
        },
      ],
    }
    const initialState = createRuntimePageState(page, {
      venues: {
        status: 'success',
        data: [
          { name: 'Venue A', lat: 1, lng: 2 },
          { name: 'Venue B', lat: 5, lng: -3 },
        ],
        requestedAt: 0,
        resolvedAt: 0,
        error: null,
      },
    })
    const config: RuntimeConfig = {
      api: {},
      initialPage: page.id,
      pages: [page],
    }
    const dispatch = vi.fn<(action: RuntimeStateAction) => void>()
    const dispatchAndSyncState = vi.fn<(action: RuntimeStateAction) => void>()

    const { rerender } = render(
      <RuntimeStateContext.Provider
        value={{
          config,
          initialState,
          state: initialState,
          dispatch,
          dispatchAndSyncState,
          getLatestState: () => initialState,
        }}
      >
        <RuntimePage />
      </RuntimeStateContext.Provider>,
    )

    const mapContainer = screen.getByTestId('map-container')
    const firstBounds = mapContainer.dataset.bounds
    expect(JSON.parse(firstBounds!)).toEqual([
      [1, -3],
      [5, 2],
    ])
    expect(screen.getAllByTestId('marker')).toHaveLength(2)

    const updatedState: RuntimeState = {
      ...initialState,
      queries: {
        venues: {
          status: 'success',
          data: [
            { name: 'Venue A', lat: 1, lng: 2 },
            { name: 'Venue B', lat: 5, lng: -3 },
            { name: 'Venue C', lat: 9, lng: 9 },
          ],
          requestedAt: 0,
          resolvedAt: 0,
          error: null,
        },
      },
    }

    rerender(
      <RuntimeStateContext.Provider
        value={{
          config,
          initialState: updatedState,
          state: updatedState,
          dispatch,
          dispatchAndSyncState,
          getLatestState: () => updatedState,
        }}
      >
        <RuntimePage />
      </RuntimeStateContext.Provider>,
    )

    expect(screen.getByTestId('map-container').dataset.bounds).toBe(firstBounds)
    expect(screen.getAllByTestId('marker')).toHaveLength(3)
    expect(screen.getByText('Venue C')).toBeInTheDocument()
  })
})
