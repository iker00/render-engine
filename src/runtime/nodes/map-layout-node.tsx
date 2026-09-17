import { useState } from 'react'
import { Marker, Popup } from 'react-leaflet'
import type { ButtonColor } from '../../config/runtime-config'
import type { MapLayoutNode } from '../../config/runtime-config-types'
import type { RuntimeIterationContext } from '../runtime-references/runtime-reference-resolver'
import { resolveMapMarkerSourceItems } from '../runtime-collection-sources'
import type { MapInitialView } from '../runtime-map-auto-fit'
import { resolveMapInitialView } from '../runtime-map-auto-fit'
import { getMapMarkerIcon } from '../runtime-node-styling-map'
import { useRuntimeState } from '../runtime-state/use-runtime-state'
import { MapShell } from './map-shell'

interface MapNodeProps {
  node: MapLayoutNode
  iterationContext?: RuntimeIterationContext
}

interface ResolvedMapMarker {
  key: string
  lat: number
  lng: number
  label: string
  color: ButtonColor
}

const DEFAULT_MAP_CENTER = { lat: 42.8125, lng: -1.6458 }
const DEFAULT_MAP_ZOOM = 13

const MAP_SOURCE_COLOR_CYCLE: ButtonColor[] = ['primary', 'success', 'warning', 'danger', 'info', 'neutral']

export function MapNode({ node, iterationContext }: MapNodeProps) {
  const state = useRuntimeState()
  const center = node.props?.center ?? DEFAULT_MAP_CENTER
  const zoom = node.props?.zoom ?? DEFAULT_MAP_ZOOM
  const markerSources = node.props?.markerSources

  const resolvedMarkers: ResolvedMapMarker[] =
    markerSources === undefined
      ? (node.props?.markers ?? []).map((marker, index) => ({
          key: `${index}`,
          lat: marker.lat,
          lng: marker.lng,
          label: marker.label,
          color: 'primary',
        }))
      : markerSources.flatMap((source, sourceIndex) => {
          const color = source.color ?? MAP_SOURCE_COLOR_CYCLE[sourceIndex % MAP_SOURCE_COLOR_CYCLE.length]
          const items = resolveMapMarkerSourceItems(source, state, { iterationContext })

          return items.map((item, itemIndex) => ({
            key: `${sourceIndex}-${itemIndex}`,
            lat: item.lat,
            lng: item.lng,
            label: item.label,
            color,
          }))
        })

  // Lazy initializer: runs only on the first render, so later re-renders (e.g. markerSources
  // resolving more items) never recompute or move the initial view.
  const [initialView] = useState<MapInitialView>(() =>
    resolveMapInitialView(
      node.props?.autoFitMarkers === true ? resolvedMarkers.map(({ lat, lng }) => ({ lat, lng })) : [],
      { center, zoom },
    ),
  )

  const shellViewProps =
    initialView.mode === 'bounds' ? { bounds: initialView.bounds } : { center: initialView.center, zoom: initialView.zoom }

  return (
    <MapShell {...shellViewProps} height={node.props?.height}>
      {resolvedMarkers.map((marker) => (
        <Marker key={marker.key} position={[marker.lat, marker.lng]} icon={getMapMarkerIcon(marker.color)}>
          <Popup>{marker.label}</Popup>
        </Marker>
      ))}
    </MapShell>
  )
}
