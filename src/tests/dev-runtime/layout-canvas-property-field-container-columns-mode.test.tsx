import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { LayoutNode } from '../../config/runtime-config'
import { ContainerColumnsModePropertyField } from '../../dev-runtime/layout-canvas/property-fields/container-columns-mode-property-field'

type ContainerNode = Extract<LayoutNode, { type: 'container' }>

function containerNode(overrides: Partial<NonNullable<ContainerNode['props']>> = {}): ContainerNode {
  return { type: 'container', props: { ...overrides } } as ContainerNode
}

describe('ContainerColumnsModePropertyField mode detection', () => {
  it('activates "Grid" for a container without props.columns', () => {
    render(<ContainerColumnsModePropertyField label="Modo" node={containerNode()} onChange={vi.fn()} />)

    expect(screen.getByRole('radio', { name: /Grid/ })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: /Columnas/ })).toHaveAttribute('aria-checked', 'false')
  })

  it('activates "Columnas" for a container with a fixed integer props.columns', () => {
    render(<ContainerColumnsModePropertyField label="Modo" node={containerNode({ columns: 3 })} onChange={vi.fn()} />)

    expect(screen.getByRole('radio', { name: /Columnas/ })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: /Grid/ })).toHaveAttribute('aria-checked', 'false')
  })

  it('activates "Columnas" for a container with a responsive map props.columns', () => {
    render(
      <ContainerColumnsModePropertyField
        label="Modo"
        node={containerNode({ columns: { base: 2, md: 4 } })}
        onChange={vi.fn()}
      />,
    )

    expect(screen.getByRole('radio', { name: /Columnas/ })).toHaveAttribute('aria-checked', 'true')
  })

  it('regression: a container declaring direction "row" without columns still activates "Grid"', () => {
    render(<ContainerColumnsModePropertyField label="Modo" node={containerNode({ direction: 'row' })} onChange={vi.fn()} />)

    expect(screen.getByRole('radio', { name: /Grid/ })).toHaveAttribute('aria-checked', 'true')
  })
})

describe('ContainerColumnsModePropertyField switching Grid -> Columnas', () => {
  it('emits props.columns = 2 while preserving the rest of props (including direction)', () => {
    const onChange = vi.fn()
    const node = containerNode({ direction: 'row', gap: 'md' })
    render(<ContainerColumnsModePropertyField label="Modo" node={node} onChange={onChange} />)

    fireEvent.click(screen.getByRole('radio', { name: /Columnas/ }))

    expect(onChange).toHaveBeenCalledTimes(1)
    const nextNode = onChange.mock.calls[0][0] as ContainerNode
    expect(nextNode.props?.columns).toBe(2)
    expect(nextNode.props?.direction).toBe('row')
    expect(nextNode.props?.gap).toBe('md')
  })

  it('changes no other field on the node (children, id, visibility, layout)', () => {
    const onChange = vi.fn()
    const node = {
      ...containerNode(),
      id: 'root-container',
      children: [{ type: 'heading', props: { text: 'Hi', level: 2 } }],
      visibility: { condition: { reference: 'forms.f1.x', operator: 'equals', value: true } },
      layout: { span: 4 },
    } as unknown as ContainerNode
    render(<ContainerColumnsModePropertyField label="Modo" node={node} onChange={onChange} />)

    fireEvent.click(screen.getByRole('radio', { name: /Columnas/ }))

    const nextNode = onChange.mock.calls[0][0] as ContainerNode
    expect(nextNode.id).toBe('root-container')
    expect(nextNode.children).toEqual(node.children)
    expect(nextNode.visibility).toEqual(node.visibility)
    expect(nextNode.layout).toEqual(node.layout)
  })
})

describe('ContainerColumnsModePropertyField switching Columnas -> Grid', () => {
  it('drops props.columns (fixed integer) while preserving direction/gap/variant', () => {
    const onChange = vi.fn()
    const node = containerNode({ columns: 4, direction: 'row', gap: 'md', variant: 'card' })
    render(<ContainerColumnsModePropertyField label="Modo" node={node} onChange={onChange} />)

    fireEvent.click(screen.getByRole('radio', { name: /Grid/ }))

    expect(onChange).toHaveBeenCalledTimes(1)
    const nextNode = onChange.mock.calls[0][0] as ContainerNode
    expect(nextNode.props).not.toHaveProperty('columns')
    expect(nextNode.props?.direction).toBe('row')
    expect(nextNode.props?.gap).toBe('md')
    expect(nextNode.props?.variant).toBe('card')
  })

  it('drops props.columns (responsive map) while preserving the rest of props', () => {
    const onChange = vi.fn()
    const node = containerNode({ columns: { base: 2, md: 4 }, align: 'center' })
    render(<ContainerColumnsModePropertyField label="Modo" node={node} onChange={onChange} />)

    fireEvent.click(screen.getByRole('radio', { name: /Grid/ }))

    const nextNode = onChange.mock.calls[0][0] as ContainerNode
    expect(nextNode.props).not.toHaveProperty('columns')
    expect(nextNode.props?.align).toBe('center')
  })
})

describe('ContainerColumnsModePropertyField spec edge case: Columnas -> Grid -> Columnas does not restore a previous map', () => {
  it('re-seeds a fixed 2, not the discarded responsive map, on the second Columnas activation', () => {
    const onChange = vi.fn()
    let node = containerNode({ columns: { base: 2, md: 4 } })
    const { rerender } = render(<ContainerColumnsModePropertyField label="Modo" node={node} onChange={onChange} />)

    fireEvent.click(screen.getByRole('radio', { name: /Grid/ }))
    node = onChange.mock.calls[0][0] as ContainerNode
    expect(node.props).not.toHaveProperty('columns')
    rerender(<ContainerColumnsModePropertyField label="Modo" node={node} onChange={onChange} />)

    fireEvent.click(screen.getByRole('radio', { name: /Columnas/ }))

    expect(onChange).toHaveBeenCalledTimes(2)
    const finalNode = onChange.mock.calls[1][0] as ContainerNode
    expect(finalNode.props?.columns).toBe(2)
  })
})

describe('ContainerColumnsModePropertyField idempotency', () => {
  it('does not call onChange when clicking the already-active "Grid" segment', () => {
    const onChange = vi.fn()
    render(<ContainerColumnsModePropertyField label="Modo" node={containerNode()} onChange={onChange} />)

    fireEvent.click(screen.getByRole('radio', { name: /Grid/ }))

    expect(onChange).not.toHaveBeenCalled()
  })

  it('does not call onChange when clicking the already-active "Columnas" segment', () => {
    const onChange = vi.fn()
    render(<ContainerColumnsModePropertyField label="Modo" node={containerNode({ columns: 3 })} onChange={onChange} />)

    fireEvent.click(screen.getByRole('radio', { name: /Columnas/ }))

    expect(onChange).not.toHaveBeenCalled()
  })
})

describe('ContainerColumnsModePropertyField icon rendering', () => {
  it('renders an icon (svg) on every segment', () => {
    render(<ContainerColumnsModePropertyField label="Modo" node={containerNode()} onChange={vi.fn()} />)

    screen.getAllByRole('radio').forEach((radio) => expect(radio.querySelector('svg')).not.toBeNull())
  })
})
