import { Marker, Popup } from 'react-leaflet'
import type { ButtonColor } from '../../config/runtime-config'
import type { MapLayoutNode } from '../../config/runtime-config-types'
import type { RuntimeIterationContext } from '../runtime-references/runtime-reference-resolver'
import { resolveMapMarkerSourceItems } from '../runtime-collection-sources'
import { getMapMarkerIcon } from '../runtime-node-styling-map'
import { useRuntimeState } from '../runtime-state/use-runtime-state'
import { MapShell } from './map-shell'

interface MapNodeProps {
  node: MapLayoutNode
  iterationContext?: RuntimeIterationContext
}

const MAP_SOURCE_COLOR_CYCLE: ButtonColor[] = ['primary', 'success', 'warning', 'danger', 'info', 'neutral']

export function MapNode({ node, iterationContext }: MapNodeProps) {
  const state = useRuntimeState()
  const markerSources = node.props?.markerSources

  return (
    <MapShell center={node.props?.center} zoom={node.props?.zoom} height={node.props?.height}>
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
    </MapShell>
  )
}
