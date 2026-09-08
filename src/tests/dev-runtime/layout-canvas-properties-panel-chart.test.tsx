import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ChartLayoutNode } from '../../config/runtime-config-types'
import type { LayoutNodePath } from '../../runtime/layout-node-path'
import { LayoutCanvasPropertiesPanel, resolveChartPropsSchema } from '../../dev-runtime/layout-canvas/layout-canvas-properties-panel'

// Dedicated file (not the shared layout-canvas-properties-panel.test.tsx, per
// ai-workflow/standards/testing-rules.md "Cuándo dividir un fichero existente"): covers the
// `chart` node (T07, feature 2026-09-08-08-50-chart-node) — `resolveChartPropsSchema`, the "Tipo
// de chart" special block and the "Origen" (`ChartOriginModePropertyField`, T06) integration.

const somePath: LayoutNodePath = [{ field: 'children', index: 0 }]

const CHART_PROPS_SCHEMA_FIXTURE: Record<string, unknown> = {
  type: 'object',
  properties: {
    variant: { type: 'string', enum: ['bar', 'line', 'area', 'pie', 'donut', 'scatter'] },
    data: { type: 'array', items: {} },
    source: { type: 'object' },
    color: { type: 'string', enum: ['neutral', 'primary', 'success', 'warning', 'danger', 'info'] },
    label: { type: 'string' },
    xAxisLabel: { type: 'string' },
    yAxisLabel: { type: 'string' },
    height: { type: 'string', enum: ['sm', 'md', 'lg', 'xl'] },
  },
  required: ['variant'],
}

const SHARED_PROPS = {
  color: 'primary' as const,
  label: 'Ventas',
  xAxisLabel: 'Mes',
  yAxisLabel: 'Total',
  height: 'md' as const,
}

function staticBarNode(overrides: Partial<ChartLayoutNode['props']> = {}): ChartLayoutNode {
  return { type: 'chart', props: { variant: 'bar', data: [{ category: 'A', value: 1 }], ...SHARED_PROPS, ...overrides } }
}

function dynamicBarNode(overrides: Partial<ChartLayoutNode['props']> = {}): ChartLayoutNode {
  return {
    type: 'chart',
    props: { variant: 'bar', source: { source: 'queries.p.data', category: 'c', value: 'v' }, ...SHARED_PROPS, ...overrides },
  }
}

function staticScatterNode(overrides: Partial<ChartLayoutNode['props']> = {}): ChartLayoutNode {
  return { type: 'chart', props: { variant: 'scatter', data: [{ x: 1, y: 2 }], ...SHARED_PROPS, ...overrides } }
}

describe('resolveChartPropsSchema', () => {
  it('preserves color/label/xAxisLabel/yAxisLabel when variant is "bar"', () => {
    const result = resolveChartPropsSchema(CHART_PROPS_SCHEMA_FIXTURE, { variant: 'bar', data: [] })

    const properties = (result.properties as Record<string, unknown>) ?? {}
    expect(properties).toHaveProperty('color')
    expect(properties).toHaveProperty('label')
    expect(properties).toHaveProperty('xAxisLabel')
    expect(properties).toHaveProperty('yAxisLabel')
  })

  it('drops color/label/xAxisLabel/yAxisLabel when variant is "pie"', () => {
    const result = resolveChartPropsSchema(CHART_PROPS_SCHEMA_FIXTURE, { variant: 'pie', data: [] })

    const properties = (result.properties as Record<string, unknown>) ?? {}
    expect(properties).not.toHaveProperty('color')
    expect(properties).not.toHaveProperty('label')
    expect(properties).not.toHaveProperty('xAxisLabel')
    expect(properties).not.toHaveProperty('yAxisLabel')
  })

  it('drops color/label/xAxisLabel/yAxisLabel when variant is "donut"', () => {
    const result = resolveChartPropsSchema(CHART_PROPS_SCHEMA_FIXTURE, { variant: 'donut', data: [] })

    const properties = (result.properties as Record<string, unknown>) ?? {}
    expect(properties).not.toHaveProperty('color')
    expect(properties).not.toHaveProperty('label')
    expect(properties).not.toHaveProperty('xAxisLabel')
    expect(properties).not.toHaveProperty('yAxisLabel')
  })

  it('drops "source" and keeps "data" when props.data is declared', () => {
    const result = resolveChartPropsSchema(CHART_PROPS_SCHEMA_FIXTURE, { variant: 'bar', data: [{ category: 'A', value: 1 }] })

    const properties = (result.properties as Record<string, unknown>) ?? {}
    expect(properties).not.toHaveProperty('source')
    expect(properties).toHaveProperty('data')
  })

  it('drops "data" and keeps "source" when props.source is declared', () => {
    const result = resolveChartPropsSchema(CHART_PROPS_SCHEMA_FIXTURE, {
      variant: 'bar',
      source: { source: 'queries.q.data', category: 'c', value: 'v' },
    })

    const properties = (result.properties as Record<string, unknown>) ?? {}
    expect(properties).not.toHaveProperty('data')
    expect(properties).toHaveProperty('source')
  })

  it('composes both conditionings: variant "pie" + props.source declared drops the four label fields and "data"', () => {
    const result = resolveChartPropsSchema(CHART_PROPS_SCHEMA_FIXTURE, {
      variant: 'pie',
      source: { source: 'queries.q.data', category: 'c', value: 'v' },
    })

    const properties = (result.properties as Record<string, unknown>) ?? {}
    expect(properties).not.toHaveProperty('color')
    expect(properties).not.toHaveProperty('label')
    expect(properties).not.toHaveProperty('xAxisLabel')
    expect(properties).not.toHaveProperty('yAxisLabel')
    expect(properties).not.toHaveProperty('data')
    expect(properties).toHaveProperty('source')
  })
})

describe('LayoutCanvasPropertiesPanel chart "Tipo de chart" special block', () => {
  it('renders a standard <select> with the six variants at the top of the Props tab', () => {
    render(<LayoutCanvasPropertiesPanel node={staticBarNode()} path={somePath} onCommitNodeUpdate={() => {}} />)

    const select = screen.getByRole('combobox', { name: 'Tipo de chart' })
    const options = within(select).getAllByRole('option')
    expect(options.map((option) => option.textContent)).toEqual(['bar', 'line', 'area', 'pie', 'donut', 'scatter'])
  })

  it('the "Tipo de chart" select renders above the Props subsection, before the dispatcher-driven fields', () => {
    render(<LayoutCanvasPropertiesPanel node={staticBarNode()} path={somePath} onCommitNodeUpdate={() => {}} />)

    const select = screen.getByRole('combobox', { name: 'Tipo de chart' })
    const heightControl = screen.getByRole('radiogroup', { name: 'height' })
    expect(select.compareDocumentPosition(heightControl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('changing variant "bar" -> "line" (same family) preserves data untouched', () => {
    const node = staticBarNode()
    const onCommitNodeUpdate = vi.fn()
    render(<LayoutCanvasPropertiesPanel node={node} path={somePath} onCommitNodeUpdate={onCommitNodeUpdate} />)

    fireEvent.change(screen.getByRole('combobox', { name: 'Tipo de chart' }), { target: { value: 'line' } })

    expect(onCommitNodeUpdate).toHaveBeenCalledTimes(1)
    const [, patchFn] = onCommitNodeUpdate.mock.calls[0]
    const result = patchFn(node) as ChartLayoutNode
    expect(result.props.variant).toBe('line')
    expect(result.props.data).toEqual(node.props.data)
  })

  it('changing variant "bar" -> "scatter" (family changes) resets a static "data" node with the minimal numeric template', () => {
    const node = staticBarNode()
    const onCommitNodeUpdate = vi.fn()
    render(<LayoutCanvasPropertiesPanel node={node} path={somePath} onCommitNodeUpdate={onCommitNodeUpdate} />)

    fireEvent.change(screen.getByRole('combobox', { name: 'Tipo de chart' }), { target: { value: 'scatter' } })

    const [, patchFn] = onCommitNodeUpdate.mock.calls[0]
    const result = patchFn(node) as ChartLayoutNode
    expect(result.props.variant).toBe('scatter')
    expect(result.props.data).toEqual([{ x: 0, y: 0 }])
    expect(result.props).not.toHaveProperty('source')
  })

  it('changing variant "bar" -> "scatter" resets a dynamic "source" node with the minimal numeric source template', () => {
    const node = dynamicBarNode()
    const onCommitNodeUpdate = vi.fn()
    render(<LayoutCanvasPropertiesPanel node={node} path={somePath} onCommitNodeUpdate={onCommitNodeUpdate} />)

    fireEvent.change(screen.getByRole('combobox', { name: 'Tipo de chart' }), { target: { value: 'scatter' } })

    const [, patchFn] = onCommitNodeUpdate.mock.calls[0]
    const result = patchFn(node) as ChartLayoutNode
    expect(result.props.source).toEqual({ source: 'queries.query.data', x: 'x', y: 'y' })
    expect(result.props).not.toHaveProperty('data')
  })

  it('changing variant "scatter" -> "bar" (family changes) resets the block with the minimal categorical template', () => {
    const node = staticScatterNode()
    const onCommitNodeUpdate = vi.fn()
    render(<LayoutCanvasPropertiesPanel node={node} path={somePath} onCommitNodeUpdate={onCommitNodeUpdate} />)

    fireEvent.change(screen.getByRole('combobox', { name: 'Tipo de chart' }), { target: { value: 'bar' } })

    const [, patchFn] = onCommitNodeUpdate.mock.calls[0]
    const result = patchFn(node) as ChartLayoutNode
    expect(result.props.variant).toBe('bar')
    expect(result.props.data).toEqual([{ category: 'Ejemplo', value: 1 }])
  })

  it('changing variant "bar" -> "pie" drops color/label/xAxisLabel/yAxisLabel from the node', () => {
    const node = staticBarNode()
    const onCommitNodeUpdate = vi.fn()
    render(<LayoutCanvasPropertiesPanel node={node} path={somePath} onCommitNodeUpdate={onCommitNodeUpdate} />)

    fireEvent.change(screen.getByRole('combobox', { name: 'Tipo de chart' }), { target: { value: 'pie' } })

    const [, patchFn] = onCommitNodeUpdate.mock.calls[0]
    const result = patchFn(node) as ChartLayoutNode
    expect(result.props).not.toHaveProperty('color')
    expect(result.props).not.toHaveProperty('label')
    expect(result.props).not.toHaveProperty('xAxisLabel')
    expect(result.props).not.toHaveProperty('yAxisLabel')
  })

  it('returning "pie" -> "bar" leaves color/label/xAxisLabel/yAxisLabel absent (not re-seeded) but editable in the Props tab', () => {
    const pieNode: ChartLayoutNode = { type: 'chart', props: { variant: 'pie', data: [{ category: 'A', value: 1 }] } }
    const onCommitNodeUpdate = vi.fn()
    render(<LayoutCanvasPropertiesPanel node={pieNode} path={somePath} onCommitNodeUpdate={onCommitNodeUpdate} />)

    fireEvent.change(screen.getByRole('combobox', { name: 'Tipo de chart' }), { target: { value: 'bar' } })

    const [, patchFn] = onCommitNodeUpdate.mock.calls[0]
    const result = patchFn(pieNode) as ChartLayoutNode
    expect(result.props).not.toHaveProperty('color')
    expect(result.props).not.toHaveProperty('label')

    // Re-render with the resulting (still-label-less) node: the generic dispatcher still shows the
    // text/swatch fields, ready for the user to declare them by hand.
    render(<LayoutCanvasPropertiesPanel node={result} path={somePath} onCommitNodeUpdate={() => {}} />)
    expect(screen.getByLabelText('label', { exact: true })).toHaveValue('')
  })
})

describe('LayoutCanvasPropertiesPanel chart "Origen" special block integration', () => {
  it('renders the "Origen" widget below "Tipo de chart", reflecting "Estático" for a node with props.data', () => {
    render(<LayoutCanvasPropertiesPanel node={staticBarNode()} path={somePath} onCommitNodeUpdate={() => {}} />)

    const chartTypeSelect = screen.getByRole('combobox', { name: 'Tipo de chart' })
    const origenGroup = screen.getByRole('radiogroup', { name: 'Origen' })
    expect(chartTypeSelect.compareDocumentPosition(origenGroup) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(within(origenGroup).getByRole('radio', { name: /Estático/, checked: true })).toBeInTheDocument()
  })

  it('reflects "Dinámico" for a node with props.source', () => {
    render(<LayoutCanvasPropertiesPanel node={dynamicBarNode()} path={somePath} onCommitNodeUpdate={() => {}} />)

    const origenGroup = screen.getByRole('radiogroup', { name: 'Origen' })
    expect(within(origenGroup).getByRole('radio', { name: /Dinámico/, checked: true })).toBeInTheDocument()
  })

  it('clicking "Dinámico" commits the whole node with the minimal source template for the active variant', () => {
    const node = staticBarNode()
    const onCommitNodeUpdate = vi.fn()
    render(<LayoutCanvasPropertiesPanel node={node} path={somePath} onCommitNodeUpdate={onCommitNodeUpdate} />)

    fireEvent.click(within(screen.getByRole('radiogroup', { name: 'Origen' })).getByRole('radio', { name: /Dinámico/ }))

    expect(onCommitNodeUpdate).toHaveBeenCalledTimes(1)
    const [calledPath, patchFn] = onCommitNodeUpdate.mock.calls[0]
    expect(calledPath).toBe(somePath)
    const result = patchFn(node) as ChartLayoutNode
    expect(result.props).not.toHaveProperty('data')
    expect(result.props.source).toEqual({ source: 'queries.query.data', category: 'category', value: 'value' })
  })
})

describe('LayoutCanvasPropertiesPanel chart generic dispatcher coverage', () => {
  it('edits props.color with the swatches convention (name "color")', () => {
    const node = staticBarNode()
    const onCommitNodeUpdate = vi.fn()
    render(<LayoutCanvasPropertiesPanel node={node} path={somePath} onCommitNodeUpdate={onCommitNodeUpdate} />)

    const colorGroup = screen.getByRole('radiogroup', { name: 'color' })
    expect(within(colorGroup).getByRole('radio', { name: 'primary', checked: true })).toBeInTheDocument()

    fireEvent.click(within(colorGroup).getByRole('radio', { name: 'success' }))

    expect(onCommitNodeUpdate).toHaveBeenCalledTimes(1)
    const [, patchFn] = onCommitNodeUpdate.mock.calls[0]
    const result = patchFn(node) as ChartLayoutNode
    expect(result.props.color).toBe('success')
  })

  it('edits props.height with the segmented toggle (4-option enum, generic 2-5 rule)', () => {
    const node = staticBarNode()
    const onCommitNodeUpdate = vi.fn()
    render(<LayoutCanvasPropertiesPanel node={node} path={somePath} onCommitNodeUpdate={onCommitNodeUpdate} />)

    const heightGroup = screen.getByRole('radiogroup', { name: 'height' })
    expect(within(heightGroup).getByRole('radio', { name: 'md', checked: true })).toBeInTheDocument()

    fireEvent.click(within(heightGroup).getByRole('radio', { name: 'lg' }))

    expect(onCommitNodeUpdate).toHaveBeenCalledTimes(1)
    const [, patchFn] = onCommitNodeUpdate.mock.calls[0]
    const result = patchFn(node) as ChartLayoutNode
    expect(result.props.height).toBe('lg')
  })

  it('edits props.label, props.xAxisLabel and props.yAxisLabel as simple text fields', () => {
    const node = staticBarNode()
    render(<LayoutCanvasPropertiesPanel node={node} path={somePath} onCommitNodeUpdate={() => {}} />)

    expect(screen.getByLabelText('label', { exact: true })).toHaveValue('Ventas')
    expect(screen.getByLabelText('xAxisLabel', { exact: false })).toHaveValue('Mes')
    expect(screen.getByLabelText('yAxisLabel', { exact: false })).toHaveValue('Total')
  })

  it('editing props.label commits a props patch preserving the rest of props', () => {
    const node = staticBarNode()
    const onCommitNodeUpdate = vi.fn()
    render(<LayoutCanvasPropertiesPanel node={node} path={somePath} onCommitNodeUpdate={onCommitNodeUpdate} />)

    fireEvent.change(screen.getByLabelText('label', { exact: true }), { target: { value: 'Ingresos' } })

    expect(onCommitNodeUpdate).toHaveBeenCalledTimes(1)
    const [, patchFn] = onCommitNodeUpdate.mock.calls[0]
    const result = patchFn(node) as ChartLayoutNode
    expect(result.props.label).toBe('Ingresos')
    expect(result.props.color).toBe('primary')
  })

  it('props.data (static origin) renders the generic array-of-objects editor: adding a row commits a longer array', () => {
    const node = staticBarNode()
    const onCommitNodeUpdate = vi.fn()
    render(<LayoutCanvasPropertiesPanel node={node} path={somePath} onCommitNodeUpdate={onCommitNodeUpdate} />)

    fireEvent.click(screen.getByRole('button', { name: 'Añadir data' }))

    expect(onCommitNodeUpdate).toHaveBeenCalledTimes(1)
    const [, patchFn] = onCommitNodeUpdate.mock.calls[0]
    const result = patchFn(node) as ChartLayoutNode
    expect(result.props.data).toHaveLength(2)
  })

  it('props.data (static origin) renders "Quitar" per row: removing a row commits a shorter array', () => {
    const node = staticBarNode({ data: [{ category: 'A', value: 1 }, { category: 'B', value: 2 }] })
    const onCommitNodeUpdate = vi.fn()
    render(<LayoutCanvasPropertiesPanel node={node} path={somePath} onCommitNodeUpdate={onCommitNodeUpdate} />)

    fireEvent.click(screen.getByRole('button', { name: 'Quitar data #1' }))

    expect(onCommitNodeUpdate).toHaveBeenCalledTimes(1)
    const [, patchFn] = onCommitNodeUpdate.mock.calls[0]
    const result = patchFn(node) as ChartLayoutNode
    expect(result.props.data).toHaveLength(1)
  })

  it('does not render a manual array editor for props.data when the origin is dynamic (props.source)', () => {
    render(<LayoutCanvasPropertiesPanel node={dynamicBarNode()} path={somePath} onCommitNodeUpdate={() => {}} />)

    expect(screen.queryByRole('button', { name: 'Añadir data' })).not.toBeInTheDocument()
  })

  it('props.source (dynamic origin) renders the generic object-of-simple-fields editor, without a dedicated widget', () => {
    render(<LayoutCanvasPropertiesPanel node={dynamicBarNode()} path={somePath} onCommitNodeUpdate={() => {}} />)

    expect(screen.getByLabelText('source', { exact: false })).toHaveValue('queries.p.data')
    expect(screen.getByLabelText('category', { exact: false })).toHaveValue('c')
    expect(screen.getByLabelText('value', { exact: false })).toHaveValue('v')
  })

  it('editing a props.source field commits a props patch preserving the rest of the source object', () => {
    const node = dynamicBarNode()
    const onCommitNodeUpdate = vi.fn()
    render(<LayoutCanvasPropertiesPanel node={node} path={somePath} onCommitNodeUpdate={onCommitNodeUpdate} />)

    fireEvent.change(screen.getByLabelText('value', { exact: false }), { target: { value: 'total' } })

    expect(onCommitNodeUpdate).toHaveBeenCalledTimes(1)
    const [, patchFn] = onCommitNodeUpdate.mock.calls[0]
    const result = patchFn(node) as ChartLayoutNode
    expect(result.props.source).toEqual({ source: 'queries.p.data', category: 'c', value: 'total' })
  })
})
