import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactElement } from 'react'
import { useDroppable } from '@dnd-kit/core'
import type { LayoutNodePath } from './layout-node-path'
import { serializeDropZoneId } from './layout-node-path'
import { computeGridDropZoneRects, type DropZoneRectInput, type GridDropZoneRect } from './layout-canvas-grid-drop-zone-rects'

const OVERLAY_MARKER_ATTRIBUTE = 'data-canvas-grid-drop-zones'

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
