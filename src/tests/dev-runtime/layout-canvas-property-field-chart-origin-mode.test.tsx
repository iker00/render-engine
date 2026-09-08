import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ChartLayoutNode } from '../../config/runtime-config-types'
import { ChartOriginModePropertyField } from '../../dev-runtime/layout-canvas/property-fields/chart-origin-mode-property-field'

const SHARED_PROPS = {
  color: 'primary' as const,
  label: 'Ventas',
  xAxisLabel: 'Mes',
  yAxisLabel: 'Total',
  height: 'md' as const,
}

function staticBarNode(overrides: Partial<ChartLayoutNode> = {}): ChartLayoutNode {
  return {
    type: 'chart',
    props: { variant: 'bar', data: [{ category: 'A', value: 1 }], ...SHARED_PROPS },
    ...overrides,
  }
}

function dynamicBarNode(overrides: Partial<ChartLayoutNode> = {}): ChartLayoutNode {
  return {
    type: 'chart',
    props: { variant: 'bar', source: { source: 'queries.p.data', category: 'c', value: 'v' }, ...SHARED_PROPS },
    ...overrides,
  }
}

function staticScatterNode(overrides: Partial<ChartLayoutNode> = {}): ChartLayoutNode {
  return {
    type: 'chart',
    props: { variant: 'scatter', data: [{ x: 1, y: 2 }], ...SHARED_PROPS },
    ...overrides,
  }
}

function dynamicScatterNode(overrides: Partial<ChartLayoutNode> = {}): ChartLayoutNode {
  return {
    type: 'chart',
    props: { variant: 'scatter', source: { source: 'queries.p.data', x: 'xx', y: 'yy' }, ...SHARED_PROPS },
    ...overrides,
  }
}

describe('ChartOriginModePropertyField mode detection', () => {
  it('activates "Estático" for a node with props.data', () => {
    render(<ChartOriginModePropertyField label="Origen" node={staticBarNode()} onChange={vi.fn()} />)

    expect(screen.getByRole('radio', { name: /Estático/ })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: /Dinámico/ })).toHaveAttribute('aria-checked', 'false')
  })

  it('activates "Dinámico" for a node with props.source (props.data absent)', () => {
    render(<ChartOriginModePropertyField label="Origen" node={dynamicBarNode()} onChange={vi.fn()} />)

    expect(screen.getByRole('radio', { name: /Dinámico/ })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: /Estático/ })).toHaveAttribute('aria-checked', 'false')
  })
})

describe('ChartOriginModePropertyField switching Estático -> Dinámico (categorical variant)', () => {
  it('drops data, seeds the categorical source template, preserves the rest of props for variant "bar"', () => {
    const onChange = vi.fn()
    render(<ChartOriginModePropertyField label="Origen" node={staticBarNode()} onChange={onChange} />)

    fireEvent.click(screen.getByRole('radio', { name: /Dinámico/ }))

    expect(onChange).toHaveBeenCalledTimes(1)
    const nextNode = onChange.mock.calls[0][0] as ChartLayoutNode
    expect(nextNode.props).not.toHaveProperty('data')
    expect(nextNode.props.source).toEqual({ source: 'queries.query.data', category: 'category', value: 'value' })
    expect(nextNode.props.variant).toBe('bar')
    expect(nextNode.props.color).toBe(SHARED_PROPS.color)
    expect(nextNode.props.label).toBe(SHARED_PROPS.label)
    expect(nextNode.props.xAxisLabel).toBe(SHARED_PROPS.xAxisLabel)
    expect(nextNode.props.yAxisLabel).toBe(SHARED_PROPS.yAxisLabel)
    expect(nextNode.props.height).toBe(SHARED_PROPS.height)
  })
})

describe('ChartOriginModePropertyField switching Dinámico -> Estático (categorical variant)', () => {
  it('drops source, seeds the categorical data template for variant "bar"', () => {
    const onChange = vi.fn()
    render(<ChartOriginModePropertyField label="Origen" node={dynamicBarNode()} onChange={onChange} />)

    fireEvent.click(screen.getByRole('radio', { name: /Estático/ }))

    expect(onChange).toHaveBeenCalledTimes(1)
    const nextNode = onChange.mock.calls[0][0] as ChartLayoutNode
    expect(nextNode.props).not.toHaveProperty('source')
    expect(nextNode.props.data).toEqual([{ category: 'Ejemplo', value: 1 }])
  })
})

describe('ChartOriginModePropertyField switching Estático -> Dinámico (numeric variant)', () => {
  it('seeds the numeric source template for variant "scatter"', () => {
    const onChange = vi.fn()
    render(<ChartOriginModePropertyField label="Origen" node={staticScatterNode()} onChange={onChange} />)

    fireEvent.click(screen.getByRole('radio', { name: /Dinámico/ }))

    const nextNode = onChange.mock.calls[0][0] as ChartLayoutNode
    expect(nextNode.props).not.toHaveProperty('data')
    expect(nextNode.props.source).toEqual({ source: 'queries.query.data', x: 'x', y: 'y' })
  })
})

describe('ChartOriginModePropertyField switching Dinámico -> Estático (numeric variant)', () => {
  it('seeds the numeric data template for variant "scatter"', () => {
    const onChange = vi.fn()
    render(<ChartOriginModePropertyField label="Origen" node={dynamicScatterNode()} onChange={onChange} />)

    fireEvent.click(screen.getByRole('radio', { name: /Estático/ }))

    const nextNode = onChange.mock.calls[0][0] as ChartLayoutNode
    expect(nextNode.props).not.toHaveProperty('source')
    expect(nextNode.props.data).toEqual([{ x: 0, y: 0 }])
  })
})

describe('ChartOriginModePropertyField idempotency', () => {
  it('does not call onChange when clicking the already-active "Estático" segment', () => {
    const onChange = vi.fn()
    render(<ChartOriginModePropertyField label="Origen" node={staticBarNode()} onChange={onChange} />)

    fireEvent.click(screen.getByRole('radio', { name: /Estático/ }))

    expect(onChange).not.toHaveBeenCalled()
  })

  it('does not call onChange when clicking the already-active "Dinámico" segment', () => {
    const onChange = vi.fn()
    render(<ChartOriginModePropertyField label="Origen" node={dynamicBarNode()} onChange={onChange} />)

    fireEvent.click(screen.getByRole('radio', { name: /Dinámico/ }))

    expect(onChange).not.toHaveBeenCalled()
  })
})

describe('ChartOriginModePropertyField spec edge case: Estático -> Dinámico -> Estático does not restore previously edited data', () => {
  it('re-seeds the minimal template, not the discarded data, on the second Estático activation', () => {
    const onChange = vi.fn()
    let node = staticBarNode({ props: { variant: 'bar', data: [{ category: 'Custom', value: 42 }], ...SHARED_PROPS } })
    const { rerender } = render(<ChartOriginModePropertyField label="Origen" node={node} onChange={onChange} />)

    fireEvent.click(screen.getByRole('radio', { name: /Dinámico/ }))
    node = onChange.mock.calls[0][0] as ChartLayoutNode
    rerender(<ChartOriginModePropertyField label="Origen" node={node} onChange={onChange} />)

    fireEvent.click(screen.getByRole('radio', { name: /Estático/ }))

    expect(onChange).toHaveBeenCalledTimes(2)
    const finalNode = onChange.mock.calls[1][0] as ChartLayoutNode
    expect(finalNode.props.data).toEqual([{ category: 'Ejemplo', value: 1 }])
  })
})

describe('ChartOriginModePropertyField keyboard navigation', () => {
  it('Tab enters the group at the active segment (roving tabindex)', () => {
    render(<ChartOriginModePropertyField label="Origen" node={staticBarNode()} onChange={vi.fn()} />)

    const staticRadio = screen.getByRole('radio', { name: /Estático/ })
    const dynamicRadio = screen.getByRole('radio', { name: /Dinámico/ })

    expect(staticRadio).toHaveAttribute('tabIndex', '0')
    expect(dynamicRadio).toHaveAttribute('tabIndex', '-1')
  })

  it('ArrowRight moves focus to and activates the adjacent segment', () => {
    const onChange = vi.fn()
    render(<ChartOriginModePropertyField label="Origen" node={staticBarNode()} onChange={onChange} />)

    const staticRadio = screen.getByRole('radio', { name: /Estático/ })
    const dynamicRadio = screen.getByRole('radio', { name: /Dinámico/ })

    staticRadio.focus()
    fireEvent.keyDown(staticRadio, { key: 'ArrowRight' })

    expect(document.activeElement).toBe(dynamicRadio)
    expect(onChange).toHaveBeenCalledTimes(1)
    expect((onChange.mock.calls[0][0] as ChartLayoutNode).props).toHaveProperty('source')
  })

  it('ArrowLeft wraps circularly from the first segment to the last', () => {
    const onChange = vi.fn()
    render(<ChartOriginModePropertyField label="Origen" node={staticBarNode()} onChange={onChange} />)

    const staticRadio = screen.getByRole('radio', { name: /Estático/ })
    const dynamicRadio = screen.getByRole('radio', { name: /Dinámico/ })

    staticRadio.focus()
    fireEvent.keyDown(staticRadio, { key: 'ArrowLeft' })

    expect(document.activeElement).toBe(dynamicRadio)
    expect(onChange).toHaveBeenCalledTimes(1)
  })
})
