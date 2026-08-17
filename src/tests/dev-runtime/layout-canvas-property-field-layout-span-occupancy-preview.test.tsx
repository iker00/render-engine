import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { LayoutSpanOccupancyPreview } from '../../dev-runtime/layout-canvas/property-fields/layout-span-occupancy-preview'

function getSegments() {
  return within(screen.getByTestId('layout-span-occupancy-preview')).getAllByTestId('layout-span-occupancy-preview-segment')
}

describe('LayoutSpanOccupancyPreview', () => {
  it('renders exactly denominator segments, with the first `span` of them highlighted in order', () => {
    render(<LayoutSpanOccupancyPreview breakpoint="base" span={2} denominator={6} />)

    const segments = getSegments()
    expect(segments).toHaveLength(6)
    expect(segments.map((segment) => segment.getAttribute('data-highlighted'))).toEqual([
      'true',
      'true',
      'false',
      'false',
      'false',
      'false',
    ])
  })

  it('clamps the highlighted segment count to denominator when span exceeds it, without overflow or an extra segment', () => {
    render(<LayoutSpanOccupancyPreview breakpoint="md" span={5} denominator={3} />)

    const segments = getSegments()
    expect(segments).toHaveLength(3)
    expect(segments.every((segment) => segment.getAttribute('data-highlighted') === 'true')).toBe(true)
  })

  it('shows the real (unclamped) span value in the legend text even when span exceeds denominator', () => {
    render(<LayoutSpanOccupancyPreview breakpoint="md" span={5} denominator={3} />)

    expect(screen.getByText('Vista previa en md: ocupa 5 de 3.')).toBeInTheDocument()
  })

  it('renders the exact legend text for a normal (non-overflowing) span', () => {
    render(<LayoutSpanOccupancyPreview breakpoint="xl" span={2} denominator={6} />)

    expect(screen.getByText('Vista previa en xl: ocupa 2 de 6.')).toBeInTheDocument()
  })

  it('highlights nothing for span=0 without throwing', () => {
    render(<LayoutSpanOccupancyPreview breakpoint="base" span={0} denominator={4} />)

    const segments = getSegments()
    expect(segments).toHaveLength(4)
    expect(segments.every((segment) => segment.getAttribute('data-highlighted') === 'false')).toBe(true)
    expect(screen.getByText('Vista previa en base: ocupa 0 de 4.')).toBeInTheDocument()
  })
})
