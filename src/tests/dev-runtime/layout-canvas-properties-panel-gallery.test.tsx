import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { GalleryLayoutNode, GalleryStaticImage } from '../../config/runtime-config'
import type { LayoutNodePath } from '../../runtime/layout-node-path'
import { LayoutCanvasPropertiesPanel } from '../../dev-runtime/layout-canvas/layout-canvas-properties-panel'

// Dedicated file (not the shared ~2700-line layout-canvas-properties-panel.test.tsx, per
// ai-workflow/standards/testing-rules.md "Cuándo dividir un fichero existente" — that file is
// already well past the ~500-line split threshold): covers the `gallery` node's "Origen"
// (Estático/Dinámico) special block and its nested `source` "mode" (src/fetch) widget, wired by
// the `gallery-config` follow-up to feature 2026-08-25-14-49-gallery-node.

const somePath: LayoutNodePath = [{ field: 'children', index: 0 }]

const DEFAULT_DISPLAY = { mode: 'paginated' as const, pagination: { pageSize: 6 } }

function staticGalleryNode(images: GalleryStaticImage[] = []): GalleryLayoutNode {
  return { type: 'gallery', props: { images, display: DEFAULT_DISPLAY } }
}

function dynamicGalleryNode(sourceOverrides: Record<string, unknown> = {}): GalleryLayoutNode {
  const props = {
    source: {
      source: 'queries.photos.data',
      key: '$index',
      alt: 'title',
      mode: 'src',
      src: 'url',
      ...sourceOverrides,
    },
    display: DEFAULT_DISPLAY,
  }
  return { type: 'gallery', props: props as unknown as GalleryLayoutNode['props'] }
}

describe('LayoutCanvasPropertiesPanel gallery origin mode widget (gallery-config)', () => {
  it('renders the "Origen" widget with "Estático" active when props.images is declared', () => {
    render(<LayoutCanvasPropertiesPanel node={staticGalleryNode()} path={somePath} onCommitNodeUpdate={() => {}} />)

    const radiogroup = screen.getByRole('radiogroup', { name: 'Origen' })
    expect(within(radiogroup).getByRole('radio', { name: /Estático/, checked: true })).toBeInTheDocument()
  })

  it('renders the "Origen" widget with "Dinámico" active when props.source is declared', () => {
    render(<LayoutCanvasPropertiesPanel node={dynamicGalleryNode()} path={somePath} onCommitNodeUpdate={() => {}} />)

    const radiogroup = screen.getByRole('radiogroup', { name: 'Origen' })
    expect(within(radiogroup).getByRole('radio', { name: /Dinámico/, checked: true })).toBeInTheDocument()
  })

  it.each<'form' | 'heading' | 'image' | 'map'>(['form', 'heading', 'image', 'map'])(
    'does not render the "Origen" widget for a %s node',
    (type) => {
      const node = { type, props: { text: 'x', label: 'x', fieldId: 'f', alt: 'x', src: 'x' }, id: 'f1' } as unknown as GalleryLayoutNode
      render(<LayoutCanvasPropertiesPanel node={node} path={somePath} onCommitNodeUpdate={() => {}} />)

      expect(screen.queryByRole('radiogroup', { name: 'Origen' })).not.toBeInTheDocument()
    },
  )

  it('the "Origen" widget renders above the Props subsection, before the dispatcher-driven fields', () => {
    render(<LayoutCanvasPropertiesPanel node={staticGalleryNode()} path={somePath} onCommitNodeUpdate={() => {}} />)

    const origenGroup = screen.getByRole('radiogroup', { name: 'Origen' })
    const addImagesButton = screen.getByRole('button', { name: 'Añadir images' })
    expect(origenGroup.compareDocumentPosition(addImagesButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('clicking "Dinámico" commits the whole node: drops images, seeds a minimal source, preserves display', () => {
    const node = staticGalleryNode([{ src: '/a.jpg', alt: 'A' }])
    const onCommitNodeUpdate = vi.fn()
    render(<LayoutCanvasPropertiesPanel node={node} path={somePath} onCommitNodeUpdate={onCommitNodeUpdate} />)

    fireEvent.click(within(screen.getByRole('radiogroup', { name: 'Origen' })).getByRole('radio', { name: /Dinámico/ }))

    expect(onCommitNodeUpdate).toHaveBeenCalledTimes(1)
    const [calledPath, patchFn] = onCommitNodeUpdate.mock.calls[0]
    expect(calledPath).toBe(somePath)
    const result = patchFn(node) as GalleryLayoutNode
    expect(result.props).not.toHaveProperty('images')
    expect((result.props as { source: unknown }).source).toEqual({
      source: 'queries.query.data',
      key: '$index',
      alt: 'alt',
      mode: 'src',
      src: 'src',
    })
    expect(result.props.display).toEqual(DEFAULT_DISPLAY)
  })

  it('clicking "Estático" commits the whole node: drops source, seeds an empty images array, preserves display', () => {
    const node = dynamicGalleryNode()
    const onCommitNodeUpdate = vi.fn()
    render(<LayoutCanvasPropertiesPanel node={node} path={somePath} onCommitNodeUpdate={onCommitNodeUpdate} />)

    fireEvent.click(within(screen.getByRole('radiogroup', { name: 'Origen' })).getByRole('radio', { name: /Estático/ }))

    expect(onCommitNodeUpdate).toHaveBeenCalledTimes(1)
    const [, patchFn] = onCommitNodeUpdate.mock.calls[0]
    const result = patchFn(node) as GalleryLayoutNode
    expect(result.props).not.toHaveProperty('source')
    expect((result.props as { images: unknown }).images).toEqual([])
    expect(result.props.display).toEqual(DEFAULT_DISPLAY)
  })

  it('when the origin is Estático, the manual images array editor renders in the Props subsection', () => {
    render(<LayoutCanvasPropertiesPanel node={staticGalleryNode()} path={somePath} onCommitNodeUpdate={() => {}} />)

    expect(screen.getByRole('button', { name: 'Añadir images' })).toBeInTheDocument()
    expect(screen.queryByLabelText('source', { exact: false })).not.toBeInTheDocument()
  })

  it('when the origin is Dinámico, the dynamic source widget renders instead of the images array editor', () => {
    render(<LayoutCanvasPropertiesPanel node={dynamicGalleryNode()} path={somePath} onCommitNodeUpdate={() => {}} />)

    expect(screen.queryByRole('button', { name: 'Añadir images' })).not.toBeInTheDocument()
    expect(screen.getByLabelText('source', { exact: false })).toBeInTheDocument()
  })
})

describe('LayoutCanvasPropertiesPanel gallery dynamic source mode widget (gallery-config)', () => {
  it('renders source/key/alt seeded with the current value, and "src" active by default', () => {
    render(
      <LayoutCanvasPropertiesPanel
        node={dynamicGalleryNode({ source: 'queries.photos.data', key: 'id', alt: 'title', src: 'url' })}
        path={somePath}
        onCommitNodeUpdate={() => {}}
      />,
    )

    expect(screen.getByLabelText('source', { exact: false })).toHaveValue('queries.photos.data')
    expect(screen.getByLabelText('key', { exact: false })).toHaveValue('id')
    expect(screen.getByLabelText('alt', { exact: false })).toHaveValue('title')
    expect(screen.getByLabelText('src', { exact: false })).toHaveValue('url')

    const modeGroup = screen.getByRole('radiogroup', { name: 'mode' })
    expect(within(modeGroup).getByRole('radio', { name: 'src', checked: true })).toBeInTheDocument()
  })

  it('renders "fetch" active and its url field when mode is "fetch"', () => {
    render(
      <LayoutCanvasPropertiesPanel
        node={dynamicGalleryNode({ mode: 'fetch', src: undefined, fetch: { url: '/media/{{item.id}}.jpg' } })}
        path={somePath}
        onCommitNodeUpdate={() => {}}
      />,
    )

    const modeGroup = screen.getByRole('radiogroup', { name: 'mode' })
    expect(within(modeGroup).getByRole('radio', { name: 'fetch', checked: true })).toBeInTheDocument()
    expect(screen.queryByLabelText('src', { exact: false })).not.toBeInTheDocument()
    expect(screen.getByLabelText('url', { exact: false })).toHaveValue('/media/{{item.id}}.jpg')
  })

  it('editing "source" commits a props patch preserving key/alt/mode/src', () => {
    const node = dynamicGalleryNode({ source: 'queries.photos.data', key: 'id', alt: 'title', src: 'url' })
    const onCommitNodeUpdate = vi.fn()
    render(<LayoutCanvasPropertiesPanel node={node} path={somePath} onCommitNodeUpdate={onCommitNodeUpdate} />)

    fireEvent.change(screen.getByLabelText('source', { exact: false }), { target: { value: 'queries.other.data' } })

    expect(onCommitNodeUpdate).toHaveBeenCalledTimes(1)
    const [, patchFn] = onCommitNodeUpdate.mock.calls[0]
    const result = patchFn(node) as GalleryLayoutNode
    expect((result.props as { source: Record<string, unknown> }).source).toEqual({
      source: 'queries.other.data',
      key: 'id',
      alt: 'title',
      mode: 'src',
      src: 'url',
    })
  })

  it('switching mode from "src" to "fetch" drops src, seeds a fresh fetch config, preserves source/key/alt', () => {
    const node = dynamicGalleryNode({ source: 'queries.photos.data', key: 'id', alt: 'title', src: 'url' })
    const onCommitNodeUpdate = vi.fn()
    render(<LayoutCanvasPropertiesPanel node={node} path={somePath} onCommitNodeUpdate={onCommitNodeUpdate} />)

    fireEvent.click(within(screen.getByRole('radiogroup', { name: 'mode' })).getByRole('radio', { name: 'fetch' }))

    expect(onCommitNodeUpdate).toHaveBeenCalledTimes(1)
    const [, patchFn] = onCommitNodeUpdate.mock.calls[0]
    const result = patchFn(node) as GalleryLayoutNode
    const source = (result.props as { source: Record<string, unknown> }).source
    expect(source).toEqual({ source: 'queries.photos.data', key: 'id', alt: 'title', mode: 'fetch', fetch: { url: '' } })
    expect(source).not.toHaveProperty('src')
  })

  it('switching mode from "fetch" to "src" drops fetch, seeds a fresh empty src, preserves source/key/alt', () => {
    const node = dynamicGalleryNode({
      source: 'queries.photos.data',
      key: 'id',
      alt: 'title',
      mode: 'fetch',
      src: undefined,
      fetch: { url: '/media/{{item.id}}.jpg' },
    })
    const onCommitNodeUpdate = vi.fn()
    render(<LayoutCanvasPropertiesPanel node={node} path={somePath} onCommitNodeUpdate={onCommitNodeUpdate} />)

    fireEvent.click(within(screen.getByRole('radiogroup', { name: 'mode' })).getByRole('radio', { name: 'src' }))

    expect(onCommitNodeUpdate).toHaveBeenCalledTimes(1)
    const [, patchFn] = onCommitNodeUpdate.mock.calls[0]
    const result = patchFn(node) as GalleryLayoutNode
    const source = (result.props as { source: Record<string, unknown> }).source
    expect(source).toEqual({ source: 'queries.photos.data', key: 'id', alt: 'title', mode: 'src', src: '' })
    expect(source).not.toHaveProperty('fetch')
  })

  it('editing the fetch url commits a props patch nesting it under source.fetch', () => {
    const node = dynamicGalleryNode({
      source: 'queries.photos.data',
      key: 'id',
      alt: 'title',
      mode: 'fetch',
      src: undefined,
      fetch: { url: '/media/{{item.id}}.jpg' },
    })
    const onCommitNodeUpdate = vi.fn()
    render(<LayoutCanvasPropertiesPanel node={node} path={somePath} onCommitNodeUpdate={onCommitNodeUpdate} />)

    fireEvent.change(screen.getByLabelText('url', { exact: false }), { target: { value: '/media/{{item.id}}.png' } })

    expect(onCommitNodeUpdate).toHaveBeenCalledTimes(1)
    const [, patchFn] = onCommitNodeUpdate.mock.calls[0]
    const result = patchFn(node) as GalleryLayoutNode
    const source = (result.props as { source: Record<string, unknown> }).source
    expect(source.fetch).toEqual({ url: '/media/{{item.id}}.png' })
  })
})
