import { createContext, useContext, useEffect, useId, useReducer } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RuntimeConfig, RuntimePageConfig } from '../../config/runtime-config'
import type { AddressPickerLayoutNode } from '../../config/runtime-config-types'
import { NodeComponents } from '../../runtime/nodes/node-components-map'
import { RuntimePage } from '../../runtime/runtime-page'
import { RuntimeStateContext } from '../../runtime/runtime-state/runtime-state-context'
import { RuntimeStateProvider } from '../../runtime/runtime-state/runtime-state-provider'
import { createRuntimeState, runtimeStateReducer } from '../../runtime/runtime-state/runtime-state-reducer'
import type { RuntimeState } from '../../runtime/runtime-state/runtime-state-types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyProps = Record<string, any>

// Same test-double strategy as layout-renderer-map.test.tsx (react-leaflet needs real DOM
// measurement APIs jsdom doesn't implement), extended with a click surface. Each `MapContainer`
// instance gets a stable `useId()` and registers itself in a plain module-scope `Map` — never a
// value returned by a hook, so the React Compiler's mutability check has nothing to flag — keyed
// by that id. `useMapEvents({ click })`, called by a nested component, writes the latest handler
// into that same map (from an effect, never during render); the container's own `onClick` looks
// it up by its own id. Scoped per `MapContainer` instance so two map instances in a repeater never
// share a handler.
type MapClickHandler = (event: { latlng: { lat: number; lng: number } }) => void

const clickHandlersByContainerId = new Map<string, MapClickHandler>()
const MapContainerIdContext = createContext<string | null>(null)

vi.mock('react-leaflet', () => {
  function MapContainer({ center, zoom, className, children }: AnyProps) {
    const containerId = useId()
    return (
      <MapContainerIdContext.Provider value={containerId}>
        <div
          data-testid="map-container"
          data-center={JSON.stringify(center)}
          data-zoom={zoom}
          className={className}
          onClick={(event: React.MouseEvent) => {
            const handler = clickHandlersByContainerId.get(containerId)
            handler?.({ latlng: { lat: event.clientX, lng: event.clientY } })
          }}
        >
          {children}
        </div>
      </MapContainerIdContext.Provider>
    )
  }

  function TileLayer({ url }: AnyProps) {
    return <div data-testid="tile-layer" data-url={url} />
  }

  function Marker({ position }: AnyProps) {
    return <div data-testid="marker" data-lat={position[0]} data-lng={position[1]} />
  }

  function Popup({ children }: AnyProps) {
    return <div data-testid="popup">{children}</div>
  }

  function useMapEvents(handlers: { click?: MapClickHandler }) {
    const containerId = useContext(MapContainerIdContext)
    useEffect(() => {
      if (containerId && handlers.click) {
        clickHandlersByContainerId.set(containerId, handlers.click)
      }
    })
    return null
  }

  return { MapContainer, TileLayer, Marker, Popup, useMapEvents }
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function renderRuntimePage(activePage: RuntimePageConfig, api: RuntimeConfig['api'] = {}) {
  const config: RuntimeConfig = {
    api,
    initialPage: activePage.id,
    pages: [activePage],
  }

  return render(
    <RuntimeStateProvider config={config}>
      <RuntimePage />
    </RuntimeStateProvider>,
  )
}

function createRuntimePageState(activePage: RuntimePageConfig, queries: RuntimeState['queries']): RuntimeState {
  const config: RuntimeConfig = {
    api: {},
    initialPage: activePage.id,
    pages: [activePage],
  }
  const baseState = createRuntimeState(config)
  return { ...baseState, queries }
}

// A minimal, fully-reactive `RuntimeStateContext` provider (unlike the mocked-dispatch pattern
// used elsewhere to inspect dispatched actions) so a seeded state with pre-populated queries can
// still react to real clicks/changes, without pulling in `RuntimeStateProvider`'s hash-sync and
// preload machinery this test doesn't need.
function InteractiveRuntimePage({ config, initialState }: { config: RuntimeConfig; initialState: RuntimeState }) {
  const [state, dispatch] = useReducer(runtimeStateReducer, initialState)

  return (
    <RuntimeStateContext.Provider
      value={{
        config,
        initialState,
        state,
        dispatch,
        dispatchAndSyncState: dispatch,
        getLatestState: () => state,
      }}
    >
      <RuntimePage />
    </RuntimeStateContext.Provider>
  )
}

function addressPickerField(extraProps: Partial<AddressPickerLayoutNode['props']> = {}): AddressPickerLayoutNode {
  return {
    type: 'addressPicker',
    props: {
      fieldId: 'address',
      label: 'Address',
      geocodeOperation: 'geocode',
      addressPath: 'results.0.formatted',
      ...extraProps,
    },
  }
}

function buildPage(addressPickerProps: Partial<AddressPickerLayoutNode['props']> = {}): RuntimePageConfig {
  return {
    id: 'p',
    layout: [
      {
        type: 'form',
        id: 'f',
        children: [addressPickerField(addressPickerProps)],
      },
    ],
  }
}

function createDeferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

function createJsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

const geocodeApi: RuntimeConfig['api'] = {
  geocode: {
    method: 'POST',
    endpoint: '/api/geocode',
    body: { lat: 'forms.f.address.$lat', lng: 'forms.f.address.$lng' },
  },
}

describe('addressPicker layout node — rendering and marker on click', () => {
  it('renders a map, an associated label/input and an initially empty text field without defaultValue', () => {
    renderRuntimePage(buildPage())

    expect(screen.getByTestId('map-container')).toBeInTheDocument()
    const input = screen.getByLabelText('Address')
    expect(input).toHaveValue('')
    expect(input).toHaveAttribute('id', 'f-address')
  })

  it('renders no marker when no coordinates are fixed yet', () => {
    renderRuntimePage(buildPage())
    expect(screen.queryByTestId('marker')).not.toBeInTheDocument()
  })

  it('renders a marker at the clicked point and fixes it as the field synthetic coordinates', () => {
    renderRuntimePage(buildPage())

    fireEvent.click(screen.getByTestId('map-container'), { clientX: 10, clientY: 20 })

    const marker = screen.getByTestId('marker')
    expect(marker.dataset.lat).toBe('10')
    expect(marker.dataset.lng).toBe('20')
  })

  it('moves the marker to the second clicked point, keeping exactly one marker', () => {
    renderRuntimePage(buildPage())
    const mapContainer = screen.getByTestId('map-container')

    fireEvent.click(mapContainer, { clientX: 10, clientY: 20 })
    fireEvent.click(mapContainer, { clientX: 30, clientY: 40 })

    const markers = screen.getAllByTestId('marker')
    expect(markers).toHaveLength(1)
    expect(markers[0].dataset.lat).toBe('30')
    expect(markers[0].dataset.lng).toBe('40')
  })

  it('does not touch the text field value when clicking the map', () => {
    renderRuntimePage(buildPage())

    fireEvent.click(screen.getByTestId('map-container'), { clientX: 10, clientY: 20 })

    expect(screen.getByLabelText('Address')).toHaveValue('')
  })
})

describe('addressPicker layout node — text field', () => {
  it('writes forms.{formId}.{fieldId} on every keystroke', () => {
    renderRuntimePage(buildPage())
    const input = screen.getByLabelText('Address')

    fireEvent.change(input, { target: { value: 'Calle Mayor' } })

    expect(input).toHaveValue('Calle Mayor')
  })

  it('does not alter synthetic coordinates or the marker when typing after a click', () => {
    renderRuntimePage(buildPage())
    const mapContainer = screen.getByTestId('map-container')

    fireEvent.click(mapContainer, { clientX: 10, clientY: 20 })
    fireEvent.change(screen.getByLabelText('Address'), { target: { value: 'Calle Mayor' } })

    const marker = screen.getByTestId('marker')
    expect(marker.dataset.lat).toBe('10')
    expect(marker.dataset.lng).toBe('20')
  })

  it('seeds the initial text from props.defaultValue without creating coordinates or a marker', () => {
    renderRuntimePage(buildPage({ defaultValue: 'Plaza Mayor' }))

    expect(screen.getByLabelText('Address')).toHaveValue('Plaza Mayor')
    expect(screen.queryByTestId('marker')).not.toBeInTheDocument()
  })
})

describe('addressPicker layout node — validation and submit payload', () => {
  it('blocks submit with a required error when the text is empty, and proceeds once it is not', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const page: RuntimePageConfig = {
      id: 'p',
      layout: [
        {
          type: 'form',
          id: 'f',
          submitAction: {
            type: 'executeOperation',
            operationName: 'submitAddress',
            body: { address: 'forms.f.address' },
          },
          children: [
            addressPickerField({ validations: { required: { value: true } } }),
            { type: 'button', props: { label: 'Submit' } },
          ],
        },
      ],
    }

    renderRuntimePage(page, {
      submitAddress: { method: 'POST', endpoint: '/api/address' },
    })

    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))

    expect(await screen.findByText('Required')).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()

    fireEvent.change(screen.getByLabelText('Address'), { target: { value: 'Calle Mayor 1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({ address: 'Calle Mayor 1' })
  })
})

describe('addressPicker layout node — map props', () => {
  it('applies explicit props.center/zoom/height to the map', () => {
    renderRuntimePage(
      buildPage({
        center: { lat: 40.4168, lng: -3.7038 },
        zoom: 8,
        height: 'lg',
      }),
    )

    const mapContainer = screen.getByTestId('map-container')
    expect(JSON.parse(mapContainer.dataset.center!)).toEqual([40.4168, -3.7038])
    expect(mapContainer.dataset.zoom).toBe('8')
    expect(mapContainer).toHaveClass('h-96')
  })

  it('falls back to the shared map defaults when center/zoom/height are not declared', () => {
    renderRuntimePage(buildPage())

    const mapContainer = screen.getByTestId('map-container')
    expect(JSON.parse(mapContainer.dataset.center!)).toEqual([42.8125, -1.6458])
    expect(mapContainer.dataset.zoom).toBe('13')
    expect(mapContainer).toHaveClass('h-80')
  })
})

describe('addressPicker layout node — repeater isolation', () => {
  it('fixes coordinates only in the clicked iteration, leaving the other iteration without marker or coordinates', () => {
    const page: RuntimePageConfig = {
      id: 'p',
      layout: [
        {
          type: 'repeater',
          props: {
            items: { source: 'queries.rows.data', key: '$index' },
            template: [
              {
                type: 'form',
                id: 'f',
                children: [addressPickerField()],
              },
            ],
          },
        },
      ],
    }

    const state = createRuntimePageState(page, {
      rows: { status: 'success', data: [{}, {}], requestedAt: 0, resolvedAt: 0, error: null },
    })
    const config: RuntimeConfig = { api: {}, initialPage: page.id, pages: [page] }

    render(<InteractiveRuntimePage config={config} initialState={state} />)

    const mapContainers = screen.getAllByTestId('map-container')
    expect(mapContainers).toHaveLength(2)

    fireEvent.click(mapContainers[0], { clientX: 10, clientY: 20 })

    expect(screen.getAllByTestId('marker')).toHaveLength(1)
  })
})

describe('addressPicker layout node — component registration', () => {
  it('registers addressPicker in NodeComponents with the same dual pattern as the rest of the catalog', () => {
    expect(NodeComponents.addressPicker).toBeTruthy()
  })
})

describe('addressPicker layout node — geocode trigger', () => {
  it('sends the clicked point coordinates in the geocode request body via forms.{formId}.{fieldId}.$lat/$lng', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(createJsonResponse({ results: [{ formatted: 'Calle Mayor 1' }] }))
    vi.stubGlobal('fetch', fetchMock)

    renderRuntimePage(buildPage(), geocodeApi)

    fireEvent.click(screen.getByTestId('map-container'), { clientX: 10, clientY: 20 })

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({ lat: 10, lng: 20 })
  })

  it('writes the text resolved by props.addressPath (a nested multi-segment path) into the field on success', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(createJsonResponse({ results: [{ formatted: 'Calle Mayor 1' }] }))
    vi.stubGlobal('fetch', fetchMock)

    renderRuntimePage(buildPage(), geocodeApi)

    fireEvent.click(screen.getByTestId('map-container'), { clientX: 10, clientY: 20 })

    await waitFor(() => expect(screen.getByLabelText('Address')).toHaveValue('Calle Mayor 1'))
  })

  it('disables the address field while geocoding, leaving another field of the same form editable', async () => {
    const deferred = createDeferred<Response>()
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(() => deferred.promise)
    vi.stubGlobal('fetch', fetchMock)

    const page: RuntimePageConfig = {
      id: 'p',
      layout: [
        {
          type: 'form',
          id: 'f',
          children: [addressPickerField(), { type: 'input', props: { fieldId: 'note', label: 'Note' } }],
        },
      ],
    }

    renderRuntimePage(page, geocodeApi)

    fireEvent.click(screen.getByTestId('map-container'), { clientX: 10, clientY: 20 })

    await waitFor(() => expect(screen.getByLabelText('Address')).toBeDisabled())
    expect(screen.getByLabelText('Note')).toBeEnabled()

    fireEvent.change(screen.getByLabelText('Note'), { target: { value: 'still editable' } })
    expect(screen.getByLabelText('Note')).toHaveValue('still editable')

    deferred.resolve(createJsonResponse({ results: [{ formatted: 'Calle Mayor 1' }] }))
    await waitFor(() => expect(screen.getByLabelText('Address')).toBeEnabled())
  })

  it('shows an inline error without overwriting the text on an HTTP error, and a later click retriggers the operation', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ message: 'Boom' }), {
        status: 500,
        headers: { 'content-type': 'application/json' },
      }))
      .mockResolvedValueOnce(createJsonResponse({ results: [{ formatted: 'Calle Mayor 1' }] }))
    vi.stubGlobal('fetch', fetchMock)

    renderRuntimePage(buildPage(), geocodeApi)
    fireEvent.change(screen.getByLabelText('Address'), { target: { value: 'Previous text' } })

    fireEvent.click(screen.getByTestId('map-container'), { clientX: 10, clientY: 20 })

    await waitFor(() =>
      expect(screen.getByText('The api operation "geocode" failed with HTTP status 500.')).toBeInTheDocument(),
    )
    expect(screen.getByLabelText('Address')).toHaveValue('Previous text')

    fireEvent.click(screen.getByTestId('map-container'), { clientX: 30, clientY: 40 })

    await waitFor(() => expect(screen.getByLabelText('Address')).toHaveValue('Calle Mayor 1'))
    expect(screen.queryByText('The api operation "geocode" failed with HTTP status 500.')).not.toBeInTheDocument()
  })

  it('shows an inline error and does not overwrite the text when props.addressPath does not resolve to text ("out of coverage")', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(createJsonResponse({ results: [{ formatted: 42 }] }))
    vi.stubGlobal('fetch', fetchMock)

    renderRuntimePage(buildPage(), geocodeApi)
    fireEvent.change(screen.getByLabelText('Address'), { target: { value: 'Previous text' } })

    fireEvent.click(screen.getByTestId('map-container'), { clientX: 10, clientY: 20 })

    await waitFor(() => expect(screen.getByText('Could not resolve the address.')).toBeInTheDocument())
    expect(screen.getByLabelText('Address')).toHaveValue('Previous text')
  })

  it('lets the user keep typing freely in the text field after a geocode error', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ message: 'Boom' }), { status: 500, headers: { 'content-type': 'application/json' } }),
    )
    vi.stubGlobal('fetch', fetchMock)

    renderRuntimePage(buildPage(), geocodeApi)

    fireEvent.click(screen.getByTestId('map-container'), { clientX: 10, clientY: 20 })
    await waitFor(() =>
      expect(screen.getByText('The api operation "geocode" failed with HTTP status 500.')).toBeInTheDocument(),
    )

    fireEvent.change(screen.getByLabelText('Address'), { target: { value: 'Typed by hand' } })
    expect(screen.getByLabelText('Address')).toHaveValue('Typed by hand')
  })

  it('applies only the result of the last of two rapid clicks; a stale response arriving later does not overwrite it', async () => {
    const firstResponse = createDeferred<Response>()
    const secondResponse = createDeferred<Response>()
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockImplementationOnce(() => firstResponse.promise)
      .mockImplementationOnce(() => secondResponse.promise)
    vi.stubGlobal('fetch', fetchMock)

    renderRuntimePage(buildPage(), geocodeApi)
    const mapContainer = screen.getByTestId('map-container')

    fireEvent.click(mapContainer, { clientX: 10, clientY: 20 })
    fireEvent.click(mapContainer, { clientX: 30, clientY: 40 })

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))

    // The last-fired (second) click's response settles first…
    secondResponse.resolve(createJsonResponse({ results: [{ formatted: 'Second address' }] }))
    await waitFor(() => expect(screen.getByLabelText('Address')).toHaveValue('Second address'))

    // …and the now-obsolete first click's response arrives after — it must not override it.
    firstResponse.resolve(createJsonResponse({ results: [{ formatted: 'First address' }] }))
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(screen.getByLabelText('Address')).toHaveValue('Second address')
  })

  it('does not trigger the geocode operation when the text field is edited by hand', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(createJsonResponse({ results: [] }))
    vi.stubGlobal('fetch', fetchMock)

    renderRuntimePage(buildPage(), geocodeApi)

    fireEvent.change(screen.getByLabelText('Address'), { target: { value: 'Calle Mayor 1' } })

    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('addressPicker layout node — coordinates in payload while hidden', () => {
  function buildHideableAddressPage(): RuntimePageConfig {
    return {
      id: 'p',
      layout: [
        {
          type: 'form',
          id: 'f',
          submitAction: {
            type: 'executeOperation',
            operationName: 'submitAddress',
            body: { lat: 'forms.f.address.$lat', lng: 'forms.f.address.$lng' },
          },
          children: [
            {
              type: 'toggle',
              props: { fieldId: 'showMap', label: 'Show map', defaultValue: true },
            },
            {
              ...addressPickerField(),
              visibility: { reference: 'forms.f.showMap', operator: 'equals', value: true },
            },
            { type: 'button', props: { label: 'Submit' } },
          ],
        },
      ],
    }
  }

  it('does not omit $lat/$lng coordinate keys from the payload when the addressPicker is hidden by visibility (unlike a two-segment reference)', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(createJsonResponse({ ok: true }))
    vi.stubGlobal('fetch', fetchMock)

    renderRuntimePage(buildHideableAddressPage(), {
      submitAddress: { method: 'POST', endpoint: '/api/address' },
    })

    fireEvent.click(screen.getByTestId('map-container'), { clientX: 10, clientY: 20 })
    fireEvent.click(screen.getByRole('switch'))
    expect(screen.queryByTestId('map-container')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({ lat: 10, lng: 20 })
  })

  it('fails the submit with the standard missing-reference semantics when the hidden addressPicker never fixed a position', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(createJsonResponse({ ok: true }))
    vi.stubGlobal('fetch', fetchMock)

    renderRuntimePage(buildHideableAddressPage(), {
      submitAddress: { method: 'POST', endpoint: '/api/address' },
    })

    fireEvent.click(screen.getByRole('switch'))
    expect(screen.queryByTestId('map-container')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))

    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
