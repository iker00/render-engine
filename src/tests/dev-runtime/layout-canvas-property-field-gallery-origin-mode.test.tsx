import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { GalleryLayoutNode } from '../../config/runtime-config'
import { validateGalleryNode } from '../../config/validate-gallery-node'
import { GalleryOriginModePropertyField } from '../../dev-runtime/layout-canvas/property-fields/gallery-origin-mode-property-field'

const DISPLAY = { mode: 'paginated' as const, pagination: { pageSize: 4 } }

function staticGalleryNode(overrides: Partial<GalleryLayoutNode> = {}): GalleryLayoutNode {
  return { type: 'gallery', props: { images: [], display: DISPLAY }, ...overrides }
}

function dynamicGalleryNode(overrides: Partial<GalleryLayoutNode> = {}): GalleryLayoutNode {
  const props = { source: { source: 'queries.p.data', key: '$index', alt: 'a', mode: 'src', src: 's' }, display: DISPLAY }
  return { type: 'gallery', props: props as unknown as GalleryLayoutNode['props'], ...overrides }
}

describe('GalleryOriginModePropertyField mode detection', () => {
  it('activates "Estático" for a node with props.images', () => {
    render(<GalleryOriginModePropertyField label="Origen" node={staticGalleryNode()} onChange={vi.fn()} />)

    expect(screen.getByRole('radio', { name: /Estático/ })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: /Dinámico/ })).toHaveAttribute('aria-checked', 'false')
  })

  it('activates "Dinámico" for a node with props.source', () => {
    render(<GalleryOriginModePropertyField label="Origen" node={dynamicGalleryNode()} onChange={vi.fn()} />)

    expect(screen.getByRole('radio', { name: /Dinámico/ })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: /Estático/ })).toHaveAttribute('aria-checked', 'false')
  })
})

describe('GalleryOriginModePropertyField switching Estático -> Dinámico', () => {
  it('drops images, seeds a minimal source ($index key, mode src), preserves display', () => {
    const onChange = vi.fn()
    const node = staticGalleryNode({ props: { images: [{ src: '/a.jpg', alt: 'A' }], display: DISPLAY } })
    render(<GalleryOriginModePropertyField label="Origen" node={node} onChange={onChange} />)

    fireEvent.click(screen.getByRole('radio', { name: /Dinámico/ }))

    expect(onChange).toHaveBeenCalledTimes(1)
    const nextNode = onChange.mock.calls[0][0] as GalleryLayoutNode
    expect(nextNode.props).not.toHaveProperty('images')
    expect((nextNode.props as { source: unknown }).source).toEqual({
      source: 'queries.query.data',
      key: '$index',
      alt: 'alt',
      mode: 'src',
      src: 'src',
    })
    expect(nextNode.props.display).toEqual(DISPLAY)
  })

  it('seeds a source that is schema-valid on its own, so the mode switch commits on the first try', () => {
    // Regression test: `commitCanvasMutation` validates the *entire* config before applying a
    // panel commit (see the `PendingRejections` doc comment in `layout-canvas-properties-panel.tsx`).
    // An empty-string seed for `source`/`alt`/`src` would fail `nonEmptyStringSchema` immediately,
    // rejecting every "Dinámico" switch and leaving the Props tab stuck showing the old `images`
    // editor (that tab reads the real, still-static node — it has no visibility into this widget's
    // own rejected-commit state). Asserting against `validateGalleryNode` directly, rather than a
    // literal seed value, is what actually guards against reintroducing an unseedable default.
    const onChange = vi.fn()
    const node = staticGalleryNode({ props: { images: [], display: DISPLAY } })
    render(<GalleryOriginModePropertyField label="Origen" node={node} onChange={onChange} />)

    fireEvent.click(screen.getByRole('radio', { name: /Dinámico/ }))

    const nextNode = onChange.mock.calls[0][0] as GalleryLayoutNode
    const result = validateGalleryNode(nextNode as unknown as Record<string, unknown>, 'layout[0]', 'home')
    expect(result.status).toBe('ready')
  })

  it('changes no other field on the node (id, visibility, layout)', () => {
    const onChange = vi.fn()
    const node = {
      ...staticGalleryNode(),
      id: 'gallery-1',
      visibility: { reference: 'forms.f1.x', operator: 'equals', value: true },
      layout: { span: 4 },
    } as unknown as GalleryLayoutNode
    render(<GalleryOriginModePropertyField label="Origen" node={node} onChange={onChange} />)

    fireEvent.click(screen.getByRole('radio', { name: /Dinámico/ }))

    const nextNode = onChange.mock.calls[0][0] as GalleryLayoutNode
    expect(nextNode.id).toBe('gallery-1')
    expect(nextNode.visibility).toEqual(node.visibility)
    expect(nextNode.layout).toEqual(node.layout)
  })
})

describe('GalleryOriginModePropertyField switching Dinámico -> Estático', () => {
  it('drops source, seeds an empty images array, preserves display', () => {
    const onChange = vi.fn()
    const node = dynamicGalleryNode()
    render(<GalleryOriginModePropertyField label="Origen" node={node} onChange={onChange} />)

    fireEvent.click(screen.getByRole('radio', { name: /Estático/ }))

    expect(onChange).toHaveBeenCalledTimes(1)
    const nextNode = onChange.mock.calls[0][0] as GalleryLayoutNode
    expect(nextNode.props).not.toHaveProperty('source')
    expect((nextNode.props as { images: unknown }).images).toEqual([])
    expect(nextNode.props.display).toEqual(DISPLAY)
  })
})

describe('GalleryOriginModePropertyField spec edge case: Estático -> Dinámico -> Estático does not restore a previous images array', () => {
  it('re-seeds an empty array, not the discarded images, on the second Estático activation', () => {
    const onChange = vi.fn()
    let node = staticGalleryNode({ props: { images: [{ src: '/a.jpg', alt: 'A' }], display: DISPLAY } })
    const { rerender } = render(<GalleryOriginModePropertyField label="Origen" node={node} onChange={onChange} />)

    fireEvent.click(screen.getByRole('radio', { name: /Dinámico/ }))
    node = onChange.mock.calls[0][0] as GalleryLayoutNode
    rerender(<GalleryOriginModePropertyField label="Origen" node={node} onChange={onChange} />)

    fireEvent.click(screen.getByRole('radio', { name: /Estático/ }))

    expect(onChange).toHaveBeenCalledTimes(2)
    const finalNode = onChange.mock.calls[1][0] as GalleryLayoutNode
    expect((finalNode.props as { images: unknown[] }).images).toEqual([])
  })
})

describe('GalleryOriginModePropertyField idempotency', () => {
  it('does not call onChange when clicking the already-active "Estático" segment', () => {
    const onChange = vi.fn()
    render(<GalleryOriginModePropertyField label="Origen" node={staticGalleryNode()} onChange={onChange} />)

    fireEvent.click(screen.getByRole('radio', { name: /Estático/ }))

    expect(onChange).not.toHaveBeenCalled()
  })

  it('does not call onChange when clicking the already-active "Dinámico" segment', () => {
    const onChange = vi.fn()
    render(<GalleryOriginModePropertyField label="Origen" node={dynamicGalleryNode()} onChange={onChange} />)

    fireEvent.click(screen.getByRole('radio', { name: /Dinámico/ }))

    expect(onChange).not.toHaveBeenCalled()
  })
})
