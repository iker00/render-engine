import 'leaflet/dist/leaflet.css'
import type { ReactNode } from 'react'
import { MapContainer, TileLayer } from 'react-leaflet'
import type { MapHeight } from '../../config/runtime-config-types'
import { getMapHeightClassName } from '../runtime-node-styling-map'

interface MapShellProps {
  center?: { lat: number; lng: number }
  zoom?: number
  bounds?: [[number, number], [number, number]]
  height?: MapHeight
  className?: string
  children?: ReactNode
}

const DEFAULT_MAP_CENTER = { lat: 42.8125, lng: -1.6458 }
const DEFAULT_MAP_ZOOM = 13
const DEFAULT_MAP_HEIGHT: MapHeight = 'md'

export function MapShell({ center, zoom, bounds, height, className, children }: MapShellProps) {
  const resolvedCenter = center ?? DEFAULT_MAP_CENTER
  const resolvedZoom = zoom ?? DEFAULT_MAP_ZOOM
  const heightClassName = getMapHeightClassName(height ?? DEFAULT_MAP_HEIGHT)
  const viewProps = bounds ? { bounds } : { center: [resolvedCenter.lat, resolvedCenter.lng] as [number, number], zoom: resolvedZoom }

  return (
    <MapContainer
      {...viewProps}
      className={`w-full ${heightClassName}${className ? ` ${className}` : ''}`}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      {children}
    </MapContainer>
  )
}
