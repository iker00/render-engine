import { useLayoutEffect, useState } from 'react'

export interface AnchorRect {
  top: number
  left: number
  right: number
  bottom: number
  width: number
  height: number
}

export interface Viewport {
  width: number
  height: number
}

export interface OverlaySize {
  width: number
  height: number
}

export interface OverlayPosition {
  top: number
  left: number
  placement: 'below' | 'above'
}

const DEFAULT_GAP = 8

function clamp(value: number, min: number, max: number): number {
  if (max < min) return min
  if (value < min) return min
  if (value > max) return max
  return value
}

export function computeOverlayAnchorPosition(
  anchor: AnchorRect,
  overlay: OverlaySize,
  viewport: Viewport,
  gap: number = DEFAULT_GAP,
): OverlayPosition {
  const topBelow = anchor.bottom + gap
  const topAbove = anchor.top - gap - overlay.height
  const fitsBelow = topBelow + overlay.height <= viewport.height
  const fitsAbove = topAbove >= 0

  let top: number
  let placement: 'below' | 'above'

  if (fitsBelow) {
    top = topBelow
    placement = 'below'
  } else if (fitsAbove) {
    top = topAbove
    placement = 'above'
  } else {
    const spaceBelow = viewport.height - anchor.bottom
    const spaceAbove = anchor.top
    if (spaceBelow >= spaceAbove) {
      placement = 'below'
      top = viewport.height - overlay.height
    } else {
      placement = 'above'
      top = 0
    }
  }

  let left: number
  if (overlay.width > viewport.width) {
    left = 0
  } else {
    left = clamp(anchor.left, 0, viewport.width - overlay.width)
  }

  return { top, left, placement }
}

export function useAnchoredPosition(
  anchorElement: HTMLElement | null,
  overlaySize: OverlaySize | null,
): OverlayPosition | null {
  const [position, setPosition] = useState<OverlayPosition | null>(null)
  const overlayWidth = overlaySize?.width
  const overlayHeight = overlaySize?.height

  useLayoutEffect(() => {
    if (!anchorElement || overlayWidth === undefined || overlayHeight === undefined) {
      setPosition(null)
      return
    }

    const recalc = () => {
      const rect = anchorElement.getBoundingClientRect()
      const anchor: AnchorRect = {
        top: rect.top,
        left: rect.left,
        right: rect.right,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
      }
      const viewport: Viewport = { width: window.innerWidth, height: window.innerHeight }
      setPosition(
        computeOverlayAnchorPosition(anchor, { width: overlayWidth, height: overlayHeight }, viewport),
      )
    }

    recalc()
    window.addEventListener('scroll', recalc, true)
    window.addEventListener('resize', recalc)

    return () => {
      window.removeEventListener('scroll', recalc, true)
      window.removeEventListener('resize', recalc)
    }
  }, [anchorElement, overlayWidth, overlayHeight])

  return position
}
