import { describe, expect, it } from 'vitest'
import {
  computeGridDropZoneRects,
  type DropZoneRectInput,
  type SectionRectInput,
} from '../../runtime/layout-canvas-grid-drop-zones'

function makeChild(overrides: Partial<DropZoneRectInput>): DropZoneRectInput {
  const top = overrides.top ?? 0
  const left = overrides.left ?? 0
  const width = overrides.width ?? 100
  const height = overrides.height ?? 40
  return {
    top,
    left,
    right: overrides.right ?? left + width,
    bottom: overrides.bottom ?? top + height,
    width,
    height,
  }
}

describe('computeGridDropZoneRects', () => {
  it('returns an empty array when there are no children', () => {
    const section: SectionRectInput = { width: 400, height: 200 }
    expect(computeGridDropZoneRects([], section)).toEqual([])
  })

  it('emits two zones straddling the borders of a single child with the default zone width', () => {
    const child = makeChild({ top: 0, left: 20, width: 100, height: 40 })
    const section: SectionRectInput = { width: 200, height: 40 }

    const zones = computeGridDropZoneRects([child], section)

    expect(zones).toEqual([
      { index: 0, top: 0, left: 16, width: 8, height: 40 },
      { index: 1, top: 0, left: 116, width: 8, height: 40 },
    ])
  })

  it('centers intermediate zones in the gap and straddles the final border for a same-row row of three children', () => {
    const children: DropZoneRectInput[] = [
      makeChild({ top: 0, left: 20, width: 100, height: 40 }),
      makeChild({ top: 0, left: 140, width: 60, height: 40 }),
      makeChild({ top: 0, left: 220, width: 80, height: 40 }),
    ]
    const section: SectionRectInput = { width: 320, height: 40 }

    const zones = computeGridDropZoneRects(children, section)

    expect(zones).toHaveLength(4)
    expect(zones[0]).toEqual({ index: 0, top: 0, left: 16, width: 8, height: 40 })
    expect(zones[1]).toEqual({ index: 1, top: 0, left: 126, width: 8, height: 40 })
    expect(zones[2]).toEqual({ index: 2, top: 0, left: 206, width: 8, height: 40 })
    expect(zones[3]).toEqual({ index: 3, top: 0, left: 296, width: 8, height: 40 })
  })

  it('uses the destination child height for each intermediate zone in a same-row row', () => {
    const children: DropZoneRectInput[] = [
      makeChild({ top: 0, left: 0, width: 100, height: 40 }),
      makeChild({ top: 0, left: 120, width: 100, height: 60 }),
      makeChild({ top: 0, left: 240, width: 100, height: 80 }),
    ]
    const section: SectionRectInput = { width: 400, height: 80 }

    const zones = computeGridDropZoneRects(children, section)

    expect(zones[1].height).toBe(60)
    expect(zones[2].height).toBe(80)
  })

  it('anchors the intermediate zone at a wrap boundary to the start of the destination child', () => {
    const children: DropZoneRectInput[] = [
      makeChild({ top: 0, left: 20, width: 80, height: 40 }),
      makeChild({ top: 0, left: 120, width: 80, height: 40 }),
      makeChild({ top: 60, left: 20, width: 80, height: 40 }),
      makeChild({ top: 60, left: 120, width: 80, height: 40 }),
    ]
    const section: SectionRectInput = { width: 240, height: 100 }

    const zones = computeGridDropZoneRects(children, section)

    expect(zones).toHaveLength(5)
    expect(zones[0]).toEqual({ index: 0, top: 0, left: 16, width: 8, height: 40 })
    expect(zones[1]).toEqual({ index: 1, top: 0, left: 106, width: 8, height: 40 })
    expect(zones[2]).toEqual({ index: 2, top: 60, left: 16, width: 8, height: 40 })
    expect(zones[3]).toEqual({ index: 3, top: 60, left: 106, width: 8, height: 40 })
    expect(zones[4]).toEqual({ index: 4, top: 60, left: 196, width: 8, height: 40 })
  })

  it('clamps zone 0 to the left edge of the section when the first child is flush against it', () => {
    const child = makeChild({ top: 0, left: 2, width: 100, height: 40 })
    const section: SectionRectInput = { width: 200, height: 40 }

    const zones = computeGridDropZoneRects([child], section)

    expect(zones[0].left).toBe(0)
    expect(zones[0].width).toBe(8)
  })

  it('clamps the final zone inside the section when the last child is flush against the right edge', () => {
    const child = makeChild({ top: 0, left: 20, width: 178, height: 40 })
    const section: SectionRectInput = { width: 200, height: 40 }

    const zones = computeGridDropZoneRects([child], section)

    expect(zones[1].left).toBe(192)
    expect(zones[1].width).toBe(8)
  })

  it('honors a custom zoneWidth option across every emitted zone', () => {
    const children: DropZoneRectInput[] = [
      makeChild({ top: 0, left: 20, width: 100, height: 40 }),
      makeChild({ top: 0, left: 140, width: 60, height: 40 }),
    ]
    const section: SectionRectInput = { width: 240, height: 40 }

    const zones = computeGridDropZoneRects(children, section, { zoneWidth: 4 })

    expect(zones.map(zone => zone.width)).toEqual([4, 4, 4])
    expect(zones[0].left).toBe(18)
    expect(zones[1].left).toBe(128)
    expect(zones[2].left).toBe(198)
  })

  it('treats near-identical tops as the same row when sameRowTolerance widens the threshold', () => {
    const children: DropZoneRectInput[] = [
      makeChild({ top: 0, left: 0, width: 100, height: 40 }),
      makeChild({ top: 1, left: 120, width: 100, height: 40 }),
    ]
    const section: SectionRectInput = { width: 240, height: 40 }

    const zones = computeGridDropZoneRects(children, section, { sameRowTolerance: 2 })

    // Same-row rule: centered in the gap between children (not the wrap "anchor to start" rule).
    expect(zones[1]).toEqual({ index: 1, top: 1, left: 106, width: 8, height: 40 })
  })

  it('uses the destination child height when consecutive same-row children have different heights', () => {
    const children: DropZoneRectInput[] = [
      makeChild({ top: 0, left: 0, width: 100, height: 40 }),
      makeChild({ top: 0, left: 120, width: 100, height: 80 }),
    ]
    const section: SectionRectInput = { width: 240, height: 80 }

    const zones = computeGridDropZoneRects(children, section)

    expect(zones[1].height).toBe(80)
    expect(zones[2].height).toBe(80)
  })

  it('emits strictly consecutive indices from 0 to N without gaps or duplicates', () => {
    const children: DropZoneRectInput[] = [
      makeChild({ top: 0, left: 0, width: 60, height: 40 }),
      makeChild({ top: 0, left: 80, width: 60, height: 40 }),
      makeChild({ top: 60, left: 0, width: 60, height: 40 }),
      makeChild({ top: 60, left: 80, width: 60, height: 40 }),
      makeChild({ top: 60, left: 160, width: 60, height: 40 }),
    ]
    const section: SectionRectInput = { width: 240, height: 100 }

    const zones = computeGridDropZoneRects(children, section)

    expect(zones.map(zone => zone.index)).toEqual([0, 1, 2, 3, 4, 5])
  })
})
