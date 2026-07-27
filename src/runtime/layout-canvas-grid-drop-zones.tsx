import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactElement } from 'react'
import { useDroppable } from '@dnd-kit/core'
import type { LayoutNodePath } from './layout-node-path'
import { serializeDropZoneId } from './layout-node-path'

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
const OVERLAY_MARKER_ATTRIBUTE = 'data-canvas-grid-drop-zones'

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

interface LayoutCanvasGridDropZonesOverlayProps {
  parentPath: LayoutNodePath
  childCount: number
  tabItemIndex?: number
}

// Reserved so React shallow-compare keeps the overlay style object stable across renders.
const OVERLAY_STYLE: CSSProperties = {
  position: 'absolute',
  inset: 0,
  pointerEvents: 'none',
}

/**
 * T2 (feature 0106): overlay mounted as a direct child of a `container` `<section>` in Editor
 * mode when the parent is in grid mode. Measures the real children's bounding rects with
 * `getBoundingClientRect` and delegates zone positioning to the pure
 * `computeGridDropZoneRects`. `ResizeObserver` re-runs the measurement on section/child size
 * changes; the overlay is `pointer-events: none` so it never intercepts clicks. Each computed
 * zone renders as a `useDroppable` target with `[data-drop-zone]`, so the existing dnd
 * pipeline (`LayoutCanvasDndContext`, `parseDropAttempt`, `isValidDropTarget`, commit path)
 * consumes it without changes. Zone IDs stay ordinal, matching the array index in the parent
 * `children` collection.
 */
export function LayoutCanvasGridDropZonesOverlay({
  parentPath,
  childCount,
  tabItemIndex,
}: LayoutCanvasGridDropZonesOverlayProps): ReactElement {
  const overlayRef = useRef<HTMLDivElement>(null)
  const [zones, setZones] = useState<GridDropZoneRect[]>([])

  useLayoutEffect(() => {
    const overlay = overlayRef.current
    if (overlay === null) return
    const section = overlay.parentElement
    if (section === null) return

    const collectChildren = (): Element[] =>
      Array.from(section.children).filter((child) => !child.hasAttribute(OVERLAY_MARKER_ATTRIBUTE))

    const recompute = () => {
      const sectionRect = section.getBoundingClientRect()
      const children = collectChildren()
      if (children.length === 0) {
        setZones([])
        return
      }
      const childRects: DropZoneRectInput[] = children.map((child) => {
        const rect = child.getBoundingClientRect()
        return {
          top: rect.top - sectionRect.top,
          left: rect.left - sectionRect.left,
          right: rect.right - sectionRect.left,
          bottom: rect.bottom - sectionRect.top,
          width: rect.width,
          height: rect.height,
        }
      })
      const nextZones = computeGridDropZoneRects(childRects, {
        width: sectionRect.width,
        height: sectionRect.height,
      })
      setZones(nextZones)
    }

    recompute()

    if (typeof ResizeObserver === 'undefined') {
      return
    }

    const observer = new ResizeObserver(recompute)
    observer.observe(section)
    for (const child of collectChildren()) {
      observer.observe(child)
    }

    return () => {
      observer.disconnect()
    }
  }, [childCount])

  return (
    <div ref={overlayRef} data-canvas-grid-drop-zones="" aria-hidden="true" style={OVERLAY_STYLE}>
      {zones.map((zone) => (
        <GridDropZone
          key={zone.index}
          rect={zone}
          parentPath={parentPath}
          tabItemIndex={tabItemIndex}
        />
      ))}
    </div>
  )
}

interface GridDropZoneProps {
  rect: GridDropZoneRect
  parentPath: LayoutNodePath
  tabItemIndex?: number
}

function GridDropZone({ rect, parentPath, tabItemIndex }: GridDropZoneProps): ReactElement {
  const dropZoneId = serializeDropZoneId({ parentPath, index: rect.index, tabItemIndex })
  const { setNodeRef } = useDroppable({ id: dropZoneId })

  const style: CSSProperties = {
    position: 'absolute',
    pointerEvents: 'auto',
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
  }

  return <div ref={setNodeRef} data-drop-zone={dropZoneId} aria-hidden="true" style={style} />
}
