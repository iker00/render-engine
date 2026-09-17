export type MapInitialView =
  | { mode: 'center'; center: { lat: number; lng: number }; zoom: number }
  | { mode: 'bounds'; bounds: [[number, number], [number, number]] }

export function resolveMapInitialView(
  coordinates: Array<{ lat: number; lng: number }>,
  fallback: { center: { lat: number; lng: number }; zoom: number },
): MapInitialView {
  if (coordinates.length === 0) {
    return { mode: 'center', center: fallback.center, zoom: fallback.zoom }
  }

  let minLat = coordinates[0].lat
  let maxLat = coordinates[0].lat
  let minLng = coordinates[0].lng
  let maxLng = coordinates[0].lng

  for (const coordinate of coordinates) {
    minLat = Math.min(minLat, coordinate.lat)
    maxLat = Math.max(maxLat, coordinate.lat)
    minLng = Math.min(minLng, coordinate.lng)
    maxLng = Math.max(maxLng, coordinate.lng)
  }

  if (minLat === maxLat && minLng === maxLng) {
    return { mode: 'center', center: { lat: minLat, lng: minLng }, zoom: fallback.zoom }
  }

  return {
    mode: 'bounds',
    bounds: [
      [minLat, minLng],
      [maxLat, maxLng],
    ],
  }
}
