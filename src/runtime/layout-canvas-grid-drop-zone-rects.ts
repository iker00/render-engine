// Pure geometry helper for `LayoutCanvasGridDropZonesOverlay`, kept in its own module (rather
// than alongside that component) so `layout-canvas-grid-drop-zones.tsx` only exports a
// component — Fast Refresh requires component-only modules to preserve state across edits.

export interface DropZoneRectInput {
  top: number
  left: number
  right: number
  bottom: number
  width: number
  height: number
}

export interface SectionRectInput {
  width: number
  height: number
}

export interface GridDropZoneRect {
  index: number
  top: number
  left: number
  width: number
  height: number
}

interface ComputeGridDropZoneRectsOptions {
  zoneWidth?: number
  sameRowTolerance?: number
}

const DEFAULT_ZONE_WIDTH = 8
const DEFAULT_SAME_ROW_TOLERANCE = 1

export function computeGridDropZoneRects(
  childRects: readonly DropZoneRectInput[],
  sectionRect: SectionRectInput,
  options?: ComputeGridDropZoneRectsOptions,
): GridDropZoneRect[] {
  if (childRects.length === 0) {
    return []
  }

  const zoneWidth = options?.zoneWidth ?? DEFAULT_ZONE_WIDTH
  const sameRowTolerance = options?.sameRowTolerance ?? DEFAULT_SAME_ROW_TOLERANCE
  const halfWidth = zoneWidth / 2
  const maxLeft = sectionRect.width - zoneWidth

  const clampLeft = (left: number): number => {
    if (left > maxLeft) return maxLeft < 0 ? 0 : maxLeft
    if (left < 0) return 0
    return left
  }

  const zones: GridDropZoneRect[] = []

  const first = childRects[0]
  zones.push({
    index: 0,
    top: first.top,
    left: clampLeft(first.left - halfWidth),
    width: zoneWidth,
    height: first.height,
  })

  for (let i = 1; i < childRects.length; i++) {
    const prev = childRects[i - 1]
    const current = childRects[i]
    const sameRow = Math.abs(current.top - prev.top) <= sameRowTolerance
    const rawLeft = sameRow
      ? Math.round((prev.right + current.left) / 2) - halfWidth
      : current.left - halfWidth
    zones.push({
      index: i,
      top: current.top,
      left: clampLeft(rawLeft),
      width: zoneWidth,
      height: current.height,
    })
  }

  const last = childRects[childRects.length - 1]
  zones.push({
    index: childRects.length,
    top: last.top,
    left: clampLeft(last.right - halfWidth),
    width: zoneWidth,
    height: last.height,
  })

  return zones
}
