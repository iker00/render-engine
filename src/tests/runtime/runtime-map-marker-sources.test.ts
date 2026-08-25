import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resolveMapMarkerSourceItems } from '../../runtime/runtime-collection-sources'
import type { MapMarkerSource } from '../../config/runtime-config-types'
import type { RuntimeState } from '../../runtime/runtime-state/runtime-state-types'

const runtimeState: RuntimeState = {
  navigation: {
    currentPageId: 'home',
    history: [{ entryId: 0, pageId: 'home', params: {} }],
    lastError: null,
  },
  forms: {},
  queries: {
    venues: {
      status: 'success',
      data: [
        { name: 'Cafe Central', city: 'Madrid', coords: { lat: 40.4168, lng: -3.7038 } },
        { name: 'Bakery North', city: 'Bilbao', coords: { lat: 43.263, lng: -2.935 } },
      ],
      error: null,
    },
    venuesWithGaps: {
      status: 'success',
      data: [
        { name: 'A', coords: { lat: 1, lng: 2 } },
        { name: 'B' },
        { name: 'C', coords: { lat: 3, lng: 4 } },
      ],
      error: null,
    },
    venuesWithInvalidCoords: {
      status: 'success',
      data: [
        { name: 'valid', coords: { lat: 10, lng: 20 } },
        { name: 'nonNumeric', coords: { lat: '10', lng: 20 } },
        { name: 'nanValue', coords: { lat: Number.NaN, lng: 20 } },
        { name: 'infiniteValue', coords: { lat: Number.POSITIVE_INFINITY, lng: 20 } },
        { name: 'outOfRangeLat', coords: { lat: 200, lng: 20 } },
        { name: 'outOfRangeLng', coords: { lat: 10, lng: 400 } },
      ],
      error: null,
    },
    emptyVenues: {
      status: 'success',
      data: [],
      error: null,
    },
    scalarVenues: {
      status: 'success',
      data: 'not-a-collection',
      error: null,
    },
  },
  pageEntry: {
    entryId: 0,
    pageId: 'home',
    params: {},
    preloadNames: [],
    status: 'idle',
  },
}

describe('resolveMapMarkerSourceItems', () => {
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  })

  afterEach(() => {
    consoleWarnSpy.mockRestore()
  })

  it('resolves a marker per item with lat/lng/label in collection order', () => {
    const source: MapMarkerSource = {
      source: 'queries.venues.data',
      position: { lat: 'coords.lat', lng: 'coords.lng' },
      label: 'name',
    }

    expect(resolveMapMarkerSourceItems(source, runtimeState)).toEqual([
      { lat: 40.4168, lng: -3.7038, label: 'Cafe Central' },
      { lat: 43.263, lng: -2.935, label: 'Bakery North' },
    ])
  })

  it('skips items whose position path does not resolve and keeps the rest', () => {
    const source: MapMarkerSource = {
      source: 'queries.venuesWithGaps.data',
      position: { lat: 'coords.lat', lng: 'coords.lng' },
      label: 'name',
    }

    expect(resolveMapMarkerSourceItems(source, runtimeState)).toEqual([
      { lat: 1, lng: 2, label: 'A' },
      { lat: 3, lng: 4, label: 'C' },
    ])
  })

  it('skips items whose coordinates are non-numeric, NaN, Infinite or out of range', () => {
    const source: MapMarkerSource = {
      source: 'queries.venuesWithInvalidCoords.data',
      position: { lat: 'coords.lat', lng: 'coords.lng' },
      label: 'name',
    }

    expect(resolveMapMarkerSourceItems(source, runtimeState)).toEqual([
      { lat: 10, lng: 20, label: 'valid' },
    ])
    expect(() => resolveMapMarkerSourceItems(source, runtimeState)).not.toThrow()
  })

  it('resolves a partially interpolated label using the current item as iteration context', () => {
    const source: MapMarkerSource = {
      source: 'queries.venues.data',
      position: { lat: 'coords.lat', lng: 'coords.lng' },
      label: '{{item.name}} ({{item.city}})',
    }

    expect(resolveMapMarkerSourceItems(source, runtimeState)).toEqual([
      { lat: 40.4168, lng: -3.7038, label: 'Cafe Central (Madrid)' },
      { lat: 43.263, lng: -2.935, label: 'Bakery North (Bilbao)' },
    ])
  })

  it('resolves a label declared as a simple relative path by navigating the item', () => {
    const source: MapMarkerSource = {
      source: 'queries.venues.data',
      position: { lat: 'coords.lat', lng: 'coords.lng' },
      label: 'city',
    }

    expect(resolveMapMarkerSourceItems(source, runtimeState)).toEqual([
      { lat: 40.4168, lng: -3.7038, label: 'Madrid' },
      { lat: 43.263, lng: -2.935, label: 'Bilbao' },
    ])
  })

  it('produces an empty list without error when the source resolves to an empty collection', () => {
    const source: MapMarkerSource = {
      source: 'queries.emptyVenues.data',
      position: { lat: 'coords.lat', lng: 'coords.lng' },
      label: 'name',
    }

    expect(resolveMapMarkerSourceItems(source, runtimeState)).toEqual([])
  })

  it('produces an empty list without error when the source resolves to a non-collection value', () => {
    const source: MapMarkerSource = {
      source: 'queries.scalarVenues.data',
      position: { lat: 'coords.lat', lng: 'coords.lng' },
      label: 'name',
    }

    expect(resolveMapMarkerSourceItems(source, runtimeState)).toEqual([])
  })

  it('never mutates the underlying collection and returns equivalent results across repeated calls', () => {
    const source: MapMarkerSource = {
      source: 'queries.venues.data',
      position: { lat: 'coords.lat', lng: 'coords.lng' },
      label: 'name',
    }
    const originalData = JSON.parse(JSON.stringify(runtimeState.queries.venues.data))

    const firstResult = resolveMapMarkerSourceItems(source, runtimeState)
    const secondResult = resolveMapMarkerSourceItems(source, runtimeState)

    expect(runtimeState.queries.venues.data).toEqual(originalData)
    expect(firstResult).toEqual(secondResult)
  })
})
