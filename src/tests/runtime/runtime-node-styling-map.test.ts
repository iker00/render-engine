import { describe, expect, it } from 'vitest'
import L from 'leaflet'
import type { MapHeight } from '../../config/runtime-config-types'
import type { ButtonColor } from '../../config/runtime-config'
import { getMapHeightClassName, getMapMarkerIcon } from '../../runtime/runtime-node-styling-map'

describe('runtime-node-styling-map', () => {
  describe('getMapHeightClassName', () => {
    const cases: Array<[MapHeight, string]> = [
      ['sm', 'h-64'],
      ['md', 'h-80'],
      ['lg', 'h-96'],
      ['xl', 'h-[32rem]'],
    ]

    it.each(cases)('returns the Tailwind class for height %s', (height, expected) => {
      expect(getMapHeightClassName(height)).toBe(expected)
    })
  })

  describe('getMapMarkerIcon', () => {
    const colorHexCases: Array<[ButtonColor, string]> = [
      ['neutral', '#64748b'],
      ['primary', '#3b82f6'],
      ['success', '#22c55e'],
      ['warning', '#f59e0b'],
      ['danger', '#ef4444'],
      ['info', '#06b6d4'],
    ]

    it.each(colorHexCases)('returns an L.DivIcon for color %s', (color) => {
      const icon = getMapMarkerIcon(color)
      expect(icon).toBeInstanceOf(L.DivIcon)
    })

    it.each(colorHexCases)('embeds the correct hex color in the icon html for %s', (color, hex) => {
      const icon = getMapMarkerIcon(color)
      expect(icon.options.html).toContain(hex)
    })

    it.each(colorHexCases)('uses fixed iconSize, iconAnchor and popupAnchor regardless of color for %s', (color) => {
      const icon = getMapMarkerIcon(color)
      expect(icon.options.iconSize).toEqual([24, 36])
      expect(icon.options.iconAnchor).toEqual([12, 36])
      expect(icon.options.popupAnchor).toEqual([0, -36])
    })
  })
})
