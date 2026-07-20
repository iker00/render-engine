import { renderHook, act } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  computeOverlayAnchorPosition,
  useAnchoredPosition,
  type AnchorRect,
  type OverlaySize,
  type Viewport,
} from '../../dev-runtime/floating-toolbar/overlay-anchor-position'

function makeAnchor(rect: Partial<DOMRect>): HTMLElement {
  const el = document.createElement('div')
  document.body.appendChild(el)
  const fullRect: DOMRect = {
    top: rect.top ?? 0,
    left: rect.left ?? 0,
    right: rect.right ?? 0,
    bottom: rect.bottom ?? 0,
    width: rect.width ?? 0,
    height: rect.height ?? 0,
    x: rect.x ?? rect.left ?? 0,
    y: rect.y ?? rect.top ?? 0,
    toJSON: () => ({}),
  }
  el.getBoundingClientRect = () => fullRect
  return el
}

function setWindowSize(width: number, height: number): void {
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: width })
  Object.defineProperty(window, 'innerHeight', { configurable: true, writable: true, value: height })
}

describe('computeOverlayAnchorPosition', () => {
  it('places overlay below the anchor when there is room', () => {
    const anchor: AnchorRect = { top: 100, left: 100, right: 300, bottom: 150, width: 200, height: 50 }
    const overlay: OverlaySize = { width: 200, height: 100 }
    const viewport: Viewport = { width: 800, height: 600 }

    const result = computeOverlayAnchorPosition(anchor, overlay, viewport, 8)

    expect(result).toEqual({ top: 158, left: 100, placement: 'below' })
  })

  it('uses a default gap of 8 when gap is omitted', () => {
    const anchor: AnchorRect = { top: 100, left: 100, right: 300, bottom: 150, width: 200, height: 50 }
    const overlay: OverlaySize = { width: 200, height: 100 }
    const viewport: Viewport = { width: 800, height: 600 }

    const result = computeOverlayAnchorPosition(anchor, overlay, viewport)

    expect(result.top).toBe(158)
    expect(result.placement).toBe('below')
  })

  it('flips overlay above the anchor when it does not fit below', () => {
    // anchor.bottom=580, overlay.height=100, viewport.height=600, gap=8
    // below: 580+8+100 = 688 > 600 → no
    // above: 530-8-100 = 422 >= 0 → yes
    const anchor: AnchorRect = { top: 530, left: 100, right: 300, bottom: 580, width: 200, height: 50 }
    const overlay: OverlaySize = { width: 200, height: 100 }
    const viewport: Viewport = { width: 800, height: 600 }

    const result = computeOverlayAnchorPosition(anchor, overlay, viewport, 8)

    expect(result).toEqual({ top: 422, left: 100, placement: 'above' })
  })

  it('accepts partial overlap over hiding the overlay when neither fits', () => {
    // spaceBelow = 600-400 = 200, spaceAbove = 200 (tie → below)
    const anchor: AnchorRect = { top: 200, left: 100, right: 300, bottom: 400, width: 200, height: 200 }
    const overlay: OverlaySize = { width: 200, height: 500 }
    const viewport: Viewport = { width: 800, height: 600 }

    const result = computeOverlayAnchorPosition(anchor, overlay, viewport, 8)

    // Overlay stays fully inside the viewport.
    expect(result.top).toBeGreaterThanOrEqual(0)
    expect(result.top + overlay.height).toBeLessThanOrEqual(viewport.height)
    // Overlay overlaps the anchor (does not hide it below the viewport border).
    const overlayBottom = result.top + overlay.height
    const overlapsAnchor = overlayBottom > anchor.top && result.top < anchor.bottom
    expect(overlapsAnchor).toBe(true)
    expect(result.placement === 'below' || result.placement === 'above').toBe(true)
  })

  it('picks the direction with more available space when neither fits', () => {
    // spaceBelow = 550-400 = 150, spaceAbove = 100 → below wins.
    const anchor: AnchorRect = { top: 100, left: 100, right: 300, bottom: 400, width: 200, height: 300 }
    const overlay: OverlaySize = { width: 200, height: 500 }
    const viewport: Viewport = { width: 800, height: 550 }

    const result = computeOverlayAnchorPosition(anchor, overlay, viewport, 8)

    expect(result.placement).toBe('below')
    expect(result.top).toBe(50) // bottom-aligned: 550 - 500 = 50
  })

  it('clamps left when the overlay would overflow the right edge of the viewport', () => {
    // anchor.left=700, overlay.width=200, viewport.width=800 → 700+200=900>800
    // clamp to viewport.width - overlay.width = 600
    const anchor: AnchorRect = { top: 100, left: 700, right: 900, bottom: 150, width: 200, height: 50 }
    const overlay: OverlaySize = { width: 200, height: 100 }
    const viewport: Viewport = { width: 800, height: 600 }

    const result = computeOverlayAnchorPosition(anchor, overlay, viewport, 8)

    expect(result.left).toBe(600)
  })

  it('returns left=0 when the overlay is wider than the viewport', () => {
    const anchor: AnchorRect = { top: 100, left: 100, right: 300, bottom: 150, width: 200, height: 50 }
    const overlay: OverlaySize = { width: 1000, height: 100 }
    const viewport: Viewport = { width: 800, height: 600 }

    const result = computeOverlayAnchorPosition(anchor, overlay, viewport, 8)

    expect(result.left).toBe(0)
  })

  it('clamps left to 0 when the anchor is partially off-screen to the left', () => {
    const anchor: AnchorRect = { top: 100, left: -50, right: 150, bottom: 150, width: 200, height: 50 }
    const overlay: OverlaySize = { width: 200, height: 100 }
    const viewport: Viewport = { width: 800, height: 600 }

    const result = computeOverlayAnchorPosition(anchor, overlay, viewport, 8)

    expect(result.left).toBe(0)
  })
})

describe('useAnchoredPosition', () => {
  const originalInnerWidth = window.innerWidth
  const originalInnerHeight = window.innerHeight

  beforeEach(() => {
    setWindowSize(800, 600)
  })

  afterEach(() => {
    setWindowSize(originalInnerWidth, originalInnerHeight)
    document.body.innerHTML = ''
  })

  it('returns null when anchorElement is null', () => {
    const { result } = renderHook(() =>
      useAnchoredPosition(null, { width: 100, height: 100 }),
    )

    expect(result.current).toBeNull()
  })

  it('returns null when overlaySize is null', () => {
    const anchor = makeAnchor({ top: 100, left: 100, right: 300, bottom: 150, width: 200, height: 50 })

    const { result } = renderHook(() => useAnchoredPosition(anchor, null))

    expect(result.current).toBeNull()
  })

  it('returns a position matching computeOverlayAnchorPosition for a mounted anchor', () => {
    const anchor = makeAnchor({ top: 100, left: 100, right: 300, bottom: 150, width: 200, height: 50 })

    const { result } = renderHook(() =>
      useAnchoredPosition(anchor, { width: 200, height: 100 }),
    )

    expect(result.current).toEqual({ top: 158, left: 100, placement: 'below' })
  })

  it('recalculates on window scroll after the anchor moves', () => {
    let rect: DOMRect = {
      top: 100, left: 100, right: 300, bottom: 150, width: 200, height: 50,
      x: 100, y: 100, toJSON: () => ({}),
    }
    const anchor = document.createElement('div')
    document.body.appendChild(anchor)
    anchor.getBoundingClientRect = () => rect

    const { result } = renderHook(() =>
      useAnchoredPosition(anchor, { width: 200, height: 100 }),
    )

    expect(result.current?.top).toBe(158)

    act(() => {
      rect = {
        top: 200, left: 100, right: 300, bottom: 250, width: 200, height: 50,
        x: 100, y: 200, toJSON: () => ({}),
      }
      window.dispatchEvent(new Event('scroll'))
    })

    expect(result.current?.top).toBe(258)
  })

  it('recalculates on window resize when innerWidth changes', () => {
    // anchor.left=700, overlay.width=200 → clamped to 600 at 800px viewport.
    const anchor = makeAnchor({ top: 100, left: 700, right: 900, bottom: 150, width: 200, height: 50 })

    const { result } = renderHook(() =>
      useAnchoredPosition(anchor, { width: 200, height: 100 }),
    )

    expect(result.current?.left).toBe(600)

    act(() => {
      setWindowSize(1200, 600)
      window.dispatchEvent(new Event('resize'))
    })

    expect(result.current?.left).toBe(700)
  })

  it('removes scroll and resize listeners on unmount', () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener')
    const anchor = makeAnchor({ top: 100, left: 100, right: 300, bottom: 150, width: 200, height: 50 })

    const { unmount } = renderHook(() =>
      useAnchoredPosition(anchor, { width: 200, height: 100 }),
    )

    removeSpy.mockClear()
    unmount()

    const removedEvents = removeSpy.mock.calls.map((call) => call[0])
    expect(removedEvents).toContain('scroll')
    expect(removedEvents).toContain('resize')

    removeSpy.mockRestore()
  })

  it('removes listeners tied to the previous anchor when the anchor element changes', () => {
    const anchorA = makeAnchor({ top: 100, left: 100, right: 300, bottom: 150, width: 200, height: 50 })
    const anchorB = makeAnchor({ top: 300, left: 100, right: 300, bottom: 350, width: 200, height: 50 })

    const { rerender } = renderHook(
      ({ el }: { el: HTMLElement }) => useAnchoredPosition(el, { width: 200, height: 100 }),
      { initialProps: { el: anchorA } },
    )

    const removeSpy = vi.spyOn(window, 'removeEventListener')
    rerender({ el: anchorB })

    const removedEvents = removeSpy.mock.calls.map((call) => call[0])
    expect(removedEvents).toContain('scroll')
    expect(removedEvents).toContain('resize')

    removeSpy.mockRestore()
  })
})
