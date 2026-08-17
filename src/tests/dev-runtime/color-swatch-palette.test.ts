import { describe, expect, it } from 'vitest'
import {
  COLOR_SWATCH_CLASS_BY_NAME,
  COLOR_SWATCH_NAMES,
} from '../../dev-runtime/layout-canvas/property-fields/color-swatch-palette'

describe('COLOR_SWATCH_NAMES', () => {
  it('has exactly the six semantic names in the fixed order', () => {
    expect(COLOR_SWATCH_NAMES).toEqual(['neutral', 'primary', 'success', 'warning', 'danger', 'info'])
  })
})

describe('COLOR_SWATCH_CLASS_BY_NAME', () => {
  it('has a non-empty Tailwind class entry for every name in COLOR_SWATCH_NAMES', () => {
    COLOR_SWATCH_NAMES.forEach((name) => {
      expect(typeof COLOR_SWATCH_CLASS_BY_NAME[name]).toBe('string')
      expect(COLOR_SWATCH_CLASS_BY_NAME[name].length).toBeGreaterThan(0)
    })
  })

  it('has exactly one entry per name, no extras', () => {
    expect(Object.keys(COLOR_SWATCH_CLASS_BY_NAME).sort()).toEqual([...COLOR_SWATCH_NAMES].sort())
  })
})
