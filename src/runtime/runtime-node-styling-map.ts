import L from 'leaflet'
import type { MapHeight } from '../config/runtime-config-types'
import type { ButtonColor } from '../config/runtime-config'

const mapHeightClassMap: Record<MapHeight, string> = {
  sm: 'h-64',
  md: 'h-80',
  lg: 'h-96',
  xl: 'h-[32rem]',
}

const mapMarkerColorHexMap: Record<ButtonColor, string> = {
  neutral: '#64748b',
  primary: '#3b82f6',
  success: '#22c55e',
  warning: '#f59e0b',
  danger: '#ef4444',
  info: '#06b6d4',
}

export function getMapHeightClassName(height: MapHeight): string {
  return mapHeightClassMap[height]
}

export function getMapMarkerIcon(color: ButtonColor): L.DivIcon {
  return L.divIcon({
    className: 'map-marker-icon',
    html: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="24" height="36"><path fill="${mapMarkerColorHexMap[color]}" d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24C24 5.4 18.6 0 12 0zm0 16.5a4.5 4.5 0 110-9 4.5 4.5 0 010 9z"/></svg>`,
    iconSize: [24, 36],
    iconAnchor: [12, 36],
    popupAnchor: [0, -36],
  })
}
