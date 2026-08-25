import 'leaflet/dist/leaflet.css'
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet'
import type { ButtonColor } from '../../config/runtime-config'
import type { MapHeight, MapLayoutNode } from '../../config/runtime-config-types'
import type { RuntimeIterationContext } from '../runtime-references/runtime-reference-resolver'
import { resolveMapMarkerSourceItems } from '../runtime-collection-sources'
import { getMapHeightClassName, getMapMarkerIcon } from '../runtime-node-styling-map'
import { useRuntimeState } from '../runtime-state/use-runtime-state'

interface MapNodeProps {
  node: MapLayoutNode
  iterationContext?: RuntimeIterationContext
}

const DEFAULT_MAP_CENTER = { lat: 42.8125, lng: -1.6458 }
const DEFAULT_MAP_ZOOM = 13
const DEFAULT_MAP_HEIGHT: MapHeight = 'md'

const MAP_SOURCE_COLOR_CYCLE: ButtonColor[] = ['primary', 'success', 'warning', 'danger', 'info', 'neutral']

export function MapNode({ node, iterationContext }: MapNodeProps) {
  const state = useRuntimeState()
  const center = node.props?.center ?? DEFAULT_MAP_CENTER
  const zoom = node.props?.zoom ?? DEFAULT_MAP_ZOOM
  const heightClassName = getMapHeightClassName(node.props?.height ?? DEFAULT_MAP_HEIGHT)
  const markerSources = node.props?.markerSources

  return (
    <MapContainer center={[center.lat, center.lng]} zoom={zoom} className={`w-full ${heightClassName}`}>
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      {markerSources === undefined
        ? (node.props?.markers ?? []).map((marker, index) => (
            <Marker key={index} position={[marker.lat, marker.lng]} icon={getMapMarkerIcon('primary')}>
              <Popup>{marker.label}</Popup>
            </Marker>
          ))
        : markerSources.flatMap((source, sourceIndex) => {
            const color = source.color ?? MAP_SOURCE_COLOR_CYCLE[sourceIndex % MAP_SOURCE_COLOR_CYCLE.length]
            const icon = getMapMarkerIcon(color)
            const items = resolveMapMarkerSourceItems(source, state, { iterationContext })

            return items.map((item, itemIndex) => (
              <Marker key={`${sourceIndex}-${itemIndex}`} position={[item.lat, item.lng]} icon={icon}>
                <Popup>{item.label}</Popup>
              </Marker>
            ))
          })}
    </MapContainer>
  )
}
