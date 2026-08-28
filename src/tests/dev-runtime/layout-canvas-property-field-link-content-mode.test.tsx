import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { LayoutNode } from '../../config/runtime-config'
import { LinkContentModePropertyField } from '../../dev-runtime/layout-canvas/property-fields/link-content-mode-property-field'

type LinkNode = Extract<LayoutNode, { type: 'link' }>

function linkNode(overrides: Partial<LinkNode['props']> = {}, children?: LayoutNode[]): LinkNode {
  return {
    type: 'link',
    props: { label: 'Enlace', ...overrides },
    ...(children !== undefined ? { children } : {}),
  } as LinkNode
}

describe('LinkContentModePropertyField mode detection', () => {
  it('detects "Texto" for a link with props.label', () => {
    render(<LinkContentModePropertyField label="Contenido" node={linkNode({ label: 'Ir' })} onChange={vi.fn()} />)

    expect((screen.getByLabelText('Contenido') as HTMLSelectElement).value).toBe('text')
  })

  it('detects "Elementos anidados" for a link with children', () => {
    const node = { type: 'link', props: {}, children: [] } as unknown as LinkNode
    render(<LinkContentModePropertyField label="Contenido" node={node} onChange={vi.fn()} />)

    expect((screen.getByLabelText('Contenido') as HTMLSelectElement).value).toBe('children')
  })

  it('falls back to "Texto" without throwing for a node with neither label nor children', () => {
    const node = { type: 'link', props: {} } as unknown as LinkNode
    expect(() => render(<LinkContentModePropertyField label="Contenido" node={node} onChange={vi.fn()} />)).not.toThrow()

    expect((screen.getByLabelText('Contenido') as HTMLSelectElement).value).toBe('text')
  })
})

describe('LinkContentModePropertyField selector shape', () => {
  it('renders a dropdown with exactly the two readable options, same base element as the action variant selector', () => {
    render(<LinkContentModePropertyField label="Contenido" node={linkNode()} onChange={vi.fn()} />)

    const select = screen.getByLabelText('Contenido') as HTMLSelectElement
    expect(select.tagName).toBe('SELECT')
    const optionTexts = Array.from(select.options).map((option) => option.textContent)
    expect(optionTexts).toEqual(['Texto', 'Elementos anidados'])
  })
})

describe('LinkContentModePropertyField mode switching: Texto -> Elementos anidados', () => {
  it('emits children: [] with label/icon/iconPosition dropped, preserving href/download/target/action', () => {
    const onChange = vi.fn()
    const node = linkNode({
      label: 'Ir',
      icon: 'arrow',
      iconPosition: 'left',
      href: '/somewhere',
      download: 'file.pdf',
      target: '_blank',
      action: { type: 'navigateTo', pageId: 'home' },
    })
    render(<LinkContentModePropertyField label="Contenido" node={node} onChange={onChange} />)

    fireEvent.change(screen.getByLabelText('Contenido'), { target: { value: 'children' } })

    expect(onChange).toHaveBeenCalledTimes(1)
    const nextNode = onChange.mock.calls[0][0] as LinkNode
    expect(nextNode.children).toEqual([])
    expect(nextNode.props).not.toHaveProperty('label')
    expect(nextNode.props).not.toHaveProperty('icon')
    expect(nextNode.props).not.toHaveProperty('iconPosition')
    expect(nextNode.props.href).toBe('/somewhere')
    expect(nextNode.props.download).toBe('file.pdf')
    expect(nextNode.props.target).toBe('_blank')
    expect(nextNode.props.action).toEqual({ type: 'navigateTo', pageId: 'home' })
  })

  it('edge case: a link with icon + label switching to children drops icon, iconPosition and label together', () => {
    const onChange = vi.fn()
    const node = linkNode({ label: 'Ir', icon: 'arrow', iconPosition: 'right' })
    render(<LinkContentModePropertyField label="Contenido" node={node} onChange={onChange} />)

    fireEvent.change(screen.getByLabelText('Contenido'), { target: { value: 'children' } })

    const nextNode = onChange.mock.calls[0][0] as LinkNode
    expect(nextNode.props).not.toHaveProperty('icon')
    expect(nextNode.props).not.toHaveProperty('iconPosition')
    expect(nextNode.props).not.toHaveProperty('label')
  })

  it('edge case: an action-only link (no href) keeps its action unchanged when switching to children', () => {
    const onChange = vi.fn()
    const node = linkNode({ label: 'Ir', action: { type: 'navigateTo', pageId: 'about' } })
    render(<LinkContentModePropertyField label="Contenido" node={node} onChange={onChange} />)

    fireEvent.change(screen.getByLabelText('Contenido'), { target: { value: 'children' } })

    const nextNode = onChange.mock.calls[0][0] as LinkNode
    expect(nextNode.props.action).toEqual({ type: 'navigateTo', pageId: 'about' })
    expect(nextNode.props).not.toHaveProperty('href')
  })
})

describe('LinkContentModePropertyField mode switching: Elementos anidados -> Texto', () => {
  it('emits props.label "Enlace" with children dropped, preserving href/download/target/action', () => {
    const onChange = vi.fn()
    const node = {
      type: 'link',
      props: {
        href: '/somewhere',
        download: 'file.pdf',
        target: '_blank',
        action: { type: 'navigateTo', pageId: 'home' },
      },
      children: [{ type: 'heading', props: { text: 'Hi', level: 2 } }],
    } as unknown as LinkNode
    render(<LinkContentModePropertyField label="Contenido" node={node} onChange={onChange} />)

    fireEvent.change(screen.getByLabelText('Contenido'), { target: { value: 'text' } })

    expect(onChange).toHaveBeenCalledTimes(1)
    const nextNode = onChange.mock.calls[0][0] as LinkNode
    expect(nextNode.props.label).toBe('Enlace')
    expect(nextNode).not.toHaveProperty('children')
    expect(nextNode.props).not.toHaveProperty('icon')
    expect(nextNode.props.href).toBe('/somewhere')
    expect(nextNode.props.download).toBe('file.pdf')
    expect(nextNode.props.target).toBe('_blank')
    expect(nextNode.props.action).toEqual({ type: 'navigateTo', pageId: 'home' })
  })

  it('drops the whole subtree, not just the top-level children array', () => {
    const onChange = vi.fn()
    const node = {
      type: 'link',
      props: {},
      children: [{ type: 'container', children: [{ type: 'heading', props: { text: 'Nested', level: 2 } }] }],
    } as unknown as LinkNode
    render(<LinkContentModePropertyField label="Contenido" node={node} onChange={onChange} />)

    fireEvent.change(screen.getByLabelText('Contenido'), { target: { value: 'text' } })

    const nextNode = onChange.mock.calls[0][0] as LinkNode
    expect(nextNode).not.toHaveProperty('children')
  })

  it('edge case: an action-only link (no href) keeps its action unchanged when switching to text', () => {
    const onChange = vi.fn()
    const node = {
      type: 'link',
      props: { action: { type: 'goBack' } },
      children: [],
    } as unknown as LinkNode
    render(<LinkContentModePropertyField label="Contenido" node={node} onChange={onChange} />)

    fireEvent.change(screen.getByLabelText('Contenido'), { target: { value: 'text' } })

    const nextNode = onChange.mock.calls[0][0] as LinkNode
    expect(nextNode.props.action).toEqual({ type: 'goBack' })
    expect(nextNode.props).not.toHaveProperty('href')
  })
})

describe('LinkContentModePropertyField idempotency', () => {
  it('choosing the already-active "Texto" option does not call onChange', () => {
    const onChange = vi.fn()
    render(<LinkContentModePropertyField label="Contenido" node={linkNode({ label: 'Ir' })} onChange={onChange} />)

    fireEvent.change(screen.getByLabelText('Contenido'), { target: { value: 'text' } })

    expect(onChange).not.toHaveBeenCalled()
  })

  it('choosing the already-active "Elementos anidados" option does not call onChange', () => {
    const onChange = vi.fn()
    const node = { type: 'link', props: {}, children: [] } as unknown as LinkNode
    render(<LinkContentModePropertyField label="Contenido" node={node} onChange={onChange} />)

    fireEvent.change(screen.getByLabelText('Contenido'), { target: { value: 'children' } })

    expect(onChange).not.toHaveBeenCalled()
  })
})
