import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { RuntimeConfig, RuntimePageConfig } from '../../config/runtime-config'
import { RuntimePage } from '../../runtime/runtime-page'
import { RuntimeStateContext } from '../../runtime/runtime-state/runtime-state-context'
import { createRuntimeState } from '../../runtime/runtime-state/runtime-state-reducer'
import type { RuntimeState, RuntimeStateAction } from '../../runtime/runtime-state/runtime-state-types'
import { RuntimeStateProvider } from '../../runtime/runtime-state/runtime-state-provider'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyProps = Record<string, any>

// Recharts measures real DOM dimensions via ResizeObserver/getBoundingClientRect (both
// effectively no-ops/zero in jsdom), so — same rationale as `react-leaflet` in
// layout-renderer-map.test.tsx — it's replaced here with lightweight test doubles that expose
// the relevant props as data-* attributes/visible text for assertions, instead of asserting on
// real SVG output that jsdom cannot produce reliably.
vi.mock('recharts', () => {
  const renderPoints = (data: AnyProps[] | undefined) =>
    (data ?? []).map((point, index) => (
      <div
        key={index}
        data-testid="chart-point"
        data-category={point.category}
        data-value={point.value}
        data-x={point.x}
        data-y={point.y}
      >
        {point.category}
      </div>
    ))

  const renderSeriesName = (name: string | undefined) =>
    name ? (
      <span data-testid="chart-series-name" data-fill={undefined}>
        {name}
      </span>
    ) : null

  return {
    ResponsiveContainer: ({ children }: AnyProps) => <div data-testid="chart-responsive-container">{children}</div>,
    BarChart: ({ data, children }: AnyProps) => (
      <div data-testid="chart-root" data-chart-type="bar">
        {renderPoints(data)}
        {children}
      </div>
    ),
    LineChart: ({ data, children }: AnyProps) => (
      <div data-testid="chart-root" data-chart-type="line">
        {renderPoints(data)}
        {children}
      </div>
    ),
    AreaChart: ({ data, children }: AnyProps) => (
      <div data-testid="chart-root" data-chart-type="area">
        {renderPoints(data)}
        {children}
      </div>
    ),
    ScatterChart: ({ children }: AnyProps) => (
      <div data-testid="chart-root" data-chart-type="scatter">
        {children}
      </div>
    ),
    PieChart: ({ children }: AnyProps) => (
      <div data-testid="chart-root" data-chart-type="pie">
        {children}
      </div>
    ),
    Bar: ({ dataKey, name, fill, stroke }: AnyProps) => (
      <div data-testid="chart-series" data-series-kind="bar" data-data-key={dataKey} data-fill={fill} data-stroke={stroke}>
        {renderSeriesName(name)}
      </div>
    ),
    Line: ({ dataKey, name, stroke }: AnyProps) => (
      <div data-testid="chart-series" data-series-kind="line" data-data-key={dataKey} data-stroke={stroke}>
        {renderSeriesName(name)}
      </div>
    ),
    Area: ({ dataKey, name, fill, stroke }: AnyProps) => (
      <div data-testid="chart-series" data-series-kind="area" data-data-key={dataKey} data-fill={fill} data-stroke={stroke}>
        {renderSeriesName(name)}
      </div>
    ),
    Scatter: ({ data, dataKey, name, fill }: AnyProps) => (
      <div data-testid="chart-series" data-series-kind="scatter" data-data-key={dataKey} data-fill={fill}>
        {renderPoints(data)}
        {renderSeriesName(name)}
      </div>
    ),
    Pie: ({ data, dataKey, nameKey, innerRadius, children }: AnyProps) => (
      <div
        data-testid="chart-pie"
        data-data-key={dataKey}
        data-name-key={nameKey}
        data-inner-radius={String(innerRadius)}
      >
        {renderPoints(data)}
        {children}
      </div>
    ),
    Cell: ({ fill }: AnyProps) => <div data-testid="chart-pie-cell" data-fill={fill} />,
    XAxis: ({ dataKey, label, type }: AnyProps) => (
      <div data-testid="chart-x-axis" data-data-key={dataKey} data-type={type ?? ''} data-label={label ?? ''} />
    ),
    YAxis: ({ dataKey, label, type }: AnyProps) => (
      <div data-testid="chart-y-axis" data-data-key={dataKey} data-type={type ?? ''} data-label={label ?? ''} />
    ),
    CartesianGrid: () => <div data-testid="chart-grid" />,
    Tooltip: () => <div data-testid="chart-tooltip" />,
    Legend: () => <div data-testid="chart-legend" />,
  }
})

const SERIES_COLOR_FILL = {
  neutral: '#64748b',
  primary: '#3b82f6',
  success: '#22c55e',
  warning: '#f59e0b',
  danger: '#ef4444',
  info: '#06b6d4',
} as const

function renderRuntimePage(activePage: RuntimePageConfig) {
  const config: RuntimeConfig = {
    api: {},
    initialPage: activePage.id,
    pages: [activePage],
  }

  return render(
    <RuntimeStateProvider config={config}>
      <RuntimePage />
    </RuntimeStateProvider>,
  )
}

function createRuntimePageState(
  activePage: RuntimePageConfig,
  queries: RuntimeState['queries'],
): RuntimeState {
  const config: RuntimeConfig = {
    api: {},
    initialPage: activePage.id,
    pages: [activePage],
  }
  const baseState = createRuntimeState(config)
  return { ...baseState, queries }
}

function renderRuntimePageWithState(activePage: RuntimePageConfig, state: RuntimeState) {
  const config: RuntimeConfig = {
    api: {},
    initialPage: activePage.id,
    pages: [activePage],
  }
  const dispatch = vi.fn<(action: RuntimeStateAction) => void>()
  const dispatchAndSyncState = vi.fn<(action: RuntimeStateAction) => void>()

  return render(
    <RuntimeStateContext.Provider
      value={{
        config,
        initialState: state,
        state,
        dispatch,
        dispatchAndSyncState,
        getLatestState: () => state,
      }}
    >
      <RuntimePage />
    </RuntimeStateContext.Provider>,
  )
}

describe('ChartNode — static data by variant', () => {
  it('renders one point per category for a bar chart from props.data', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'chart',
          props: {
            variant: 'bar',
            data: [
              { category: 'A', value: 10 },
              { category: 'B', value: 5 },
            ],
          },
        },
      ],
    }
    renderRuntimePage(page)
    expect(screen.getByTestId('chart-root')).toHaveAttribute('data-chart-type', 'bar')
    const points = screen.getAllByTestId('chart-point')
    expect(points).toHaveLength(2)
    expect(screen.getByText('A')).toBeInTheDocument()
    expect(screen.getByText('B')).toBeInTheDocument()
  })

  it('renders one cell colored from the cyclic palette per slice for a pie chart', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'chart',
          props: {
            variant: 'pie',
            data: [
              { category: 'A', value: 10 },
              { category: 'B', value: 20 },
              { category: 'C', value: 30 },
            ],
          },
        },
      ],
    }
    renderRuntimePage(page)
    const cells = screen.getAllByTestId('chart-pie-cell')
    expect(cells).toHaveLength(3)
    expect(cells[0]).toHaveAttribute('data-fill', SERIES_COLOR_FILL.primary)
    expect(cells[1]).toHaveAttribute('data-fill', SERIES_COLOR_FILL.success)
    expect(cells[2]).toHaveAttribute('data-fill', SERIES_COLOR_FILL.warning)
  })

  it('renders one point per entry for a scatter chart from props.data', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'chart',
          props: {
            variant: 'scatter',
            data: [
              { x: 1, y: 2 },
              { x: 3, y: 4 },
            ],
          },
        },
      ],
    }
    renderRuntimePage(page)
    expect(screen.getByTestId('chart-root')).toHaveAttribute('data-chart-type', 'scatter')
    const points = screen.getAllByTestId('chart-point')
    expect(points).toHaveLength(2)
    expect(points[0]).toHaveAttribute('data-x', '1')
    expect(points[0]).toHaveAttribute('data-y', '2')
    expect(points[1]).toHaveAttribute('data-x', '3')
    expect(points[1]).toHaveAttribute('data-y', '4')
  })
})

describe('ChartNode — dynamic source (props.source)', () => {
  it('renders one point per resolved collection item', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'chart',
          props: {
            variant: 'bar',
            source: { source: 'queries.sales.data', category: 'label', value: 'amount' },
          },
        },
      ],
    }
    const state = createRuntimePageState(page, {
      sales: {
        status: 'success',
        data: [
          { label: 'Enero', amount: 100 },
          { label: 'Febrero', amount: 200 },
        ],
        requestedAt: 0,
        resolvedAt: 0,
        error: null,
      },
    })
    renderRuntimePageWithState(page, state)
    const points = screen.getAllByTestId('chart-point')
    expect(points).toHaveLength(2)
    expect(screen.getByText('Enero')).toBeInTheDocument()
    expect(screen.getByText('Febrero')).toBeInTheDocument()
  })

  it('omits an item whose value is not numeric while rendering the rest normally', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'chart',
          props: {
            variant: 'bar',
            source: { source: 'queries.sales.data', category: 'label', value: 'amount' },
          },
        },
      ],
    }
    const state = createRuntimePageState(page, {
      sales: {
        status: 'success',
        data: [
          { label: 'Enero', amount: 100 },
          { label: 'Invalido', amount: 'not-a-number' },
          { label: 'Marzo', amount: 300 },
        ],
        requestedAt: 0,
        resolvedAt: 0,
        error: null,
      },
    })
    renderRuntimePageWithState(page, state)
    expect(screen.getAllByTestId('chart-point')).toHaveLength(2)
    expect(screen.getByText('Enero')).toBeInTheDocument()
    expect(screen.getByText('Marzo')).toBeInTheDocument()
    expect(screen.queryByText('Invalido')).not.toBeInTheDocument()
  })

  it('omits a scatter item whose x/y is not numeric while rendering the rest normally', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'chart',
          props: {
            variant: 'scatter',
            source: { source: 'queries.points.data', x: 'a', y: 'b' },
          },
        },
      ],
    }
    const state = createRuntimePageState(page, {
      points: {
        status: 'success',
        data: [
          { a: 1, b: 2 },
          { a: 'invalid', b: 2 },
          { a: 3, b: 4 },
        ],
        requestedAt: 0,
        resolvedAt: 0,
        error: null,
      },
    })
    renderRuntimePageWithState(page, state)
    expect(screen.getAllByTestId('chart-point')).toHaveLength(2)
  })
})

describe('ChartNode — label as legend entry (bar/line/area/scatter)', () => {
  it('shows the label as a legend entry when declared', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'chart',
          props: {
            variant: 'bar',
            data: [{ category: 'A', value: 10 }],
            label: 'Ventas',
          },
        },
      ],
    }
    renderRuntimePage(page)
    expect(screen.getByTestId('chart-legend')).toBeInTheDocument()
    expect(screen.getByText('Ventas')).toBeInTheDocument()
  })

  it('renders no legend when label is not declared', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'chart',
          props: {
            variant: 'bar',
            data: [{ category: 'A', value: 10 }],
          },
        },
      ],
    }
    renderRuntimePage(page)
    expect(screen.queryByTestId('chart-legend')).not.toBeInTheDocument()
  })
})

describe('ChartNode — axis titles (bar/line/area/scatter)', () => {
  it('shows xAxisLabel/yAxisLabel next to their axes when declared', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'chart',
          props: {
            variant: 'line',
            data: [{ category: 'A', value: 10 }],
            xAxisLabel: 'Mes',
            yAxisLabel: 'Ingresos',
          },
        },
      ],
    }
    renderRuntimePage(page)
    expect(screen.getByTestId('chart-x-axis')).toHaveAttribute('data-label', 'Mes')
    expect(screen.getByTestId('chart-y-axis')).toHaveAttribute('data-label', 'Ingresos')
  })

  it('renders axes without a title (but present, with ticks) when not declared', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'chart',
          props: {
            variant: 'line',
            data: [{ category: 'A', value: 10 }],
          },
        },
      ],
    }
    renderRuntimePage(page)
    expect(screen.getByTestId('chart-x-axis')).toHaveAttribute('data-label', '')
    expect(screen.getByTestId('chart-y-axis')).toHaveAttribute('data-label', '')
  })
})

describe('ChartNode — pie/donut have no axis titles or label-based legend', () => {
  it('renders no axis for a pie chart, and the category legend appears without any textual prop', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'chart',
          props: {
            variant: 'pie',
            data: [
              { category: 'A', value: 10 },
              { category: 'B', value: 20 },
            ],
          },
        },
      ],
    }
    renderRuntimePage(page)
    expect(screen.queryByTestId('chart-x-axis')).not.toBeInTheDocument()
    expect(screen.queryByTestId('chart-y-axis')).not.toBeInTheDocument()
    expect(screen.getByTestId('chart-legend')).toBeInTheDocument()
    expect(screen.getByText('A')).toBeInTheDocument()
    expect(screen.getByText('B')).toBeInTheDocument()
  })
})

describe('ChartNode — color', () => {
  it('paints bars with the declared semantic color', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'chart',
          props: {
            variant: 'bar',
            data: [{ category: 'A', value: 10 }],
            color: 'success',
          },
        },
      ],
    }
    renderRuntimePage(page)
    expect(screen.getByTestId('chart-series')).toHaveAttribute('data-fill', SERIES_COLOR_FILL.success)
  })

  it('falls back to primary when color is not declared', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'chart',
          props: {
            variant: 'bar',
            data: [{ category: 'A', value: 10 }],
          },
        },
      ],
    }
    renderRuntimePage(page)
    expect(screen.getByTestId('chart-series')).toHaveAttribute('data-fill', SERIES_COLOR_FILL.primary)
  })
})

describe('ChartNode — height', () => {
  it('applies the class matching an explicit props.height', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'chart',
          props: { variant: 'bar', data: [{ category: 'A', value: 10 }], height: 'lg' },
        },
      ],
    }
    const { container } = renderRuntimePage(page)
    expect(container.querySelector('.h-96')).toBeInTheDocument()
  })

  it('uses the md class when props.height is not declared', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'chart',
          props: { variant: 'bar', data: [{ category: 'A', value: 10 }] },
        },
      ],
    }
    const { container } = renderRuntimePage(page)
    expect(container.querySelector('.h-80')).toBeInTheDocument()
  })
})

describe('ChartNode — transversal features (via LayoutNodeRenderer)', () => {
  it('shows feedback fallback when queryStateFeedback triggers on loading state', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'chart',
          props: {
            variant: 'bar',
            source: { source: 'queries.sales.data', category: 'label', value: 'amount' },
          },
          queryStateFeedback: {
            query: 'sales',
            states: {
              loading: {
                mode: 'fallback',
                fallback: [{ type: 'paragraph', props: { text: 'Cargando...' } }],
              },
            },
          },
        },
      ],
    }
    const state = createRuntimePageState(page, {
      sales: {
        status: 'loading',
        data: null,
        requestedAt: 0,
        resolvedAt: null,
        error: null,
      },
    })
    renderRuntimePageWithState(page, state)
    expect(screen.getByText('Cargando...')).toBeInTheDocument()
    expect(screen.queryByTestId('chart-root')).not.toBeInTheDocument()
  })
})

describe('ChartNode — inside a repeater resolves props.source with item.* paths', () => {
  it('resolves each iteration chart against its own item collection', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'repeater',
          props: {
            items: { source: 'queries.groups.data', key: 'id' },
            template: [
              {
                type: 'chart',
                props: {
                  variant: 'bar',
                  source: { source: 'item.points', category: 'label', value: 'amount' },
                },
              },
            ],
          },
        },
      ],
    }
    const state = createRuntimePageState(page, {
      groups: {
        status: 'success',
        data: [
          { id: 'g1', points: [{ label: 'A', amount: 1 }] },
          { id: 'g2', points: [{ label: 'B1', amount: 2 }, { label: 'B2', amount: 3 }] },
        ],
        requestedAt: 0,
        resolvedAt: 0,
        error: null,
      },
    })
    renderRuntimePageWithState(page, state)
    const labels = screen.getAllByTestId('chart-point').map((point) => point.textContent)
    expect(labels).toEqual(['A', 'B1', 'B2'])
  })
})

describe('ChartNode — clicking a point never triggers a catalog action', () => {
  it('does not dispatch navigation/operation actions when a series/point element is clicked', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'chart',
          props: { variant: 'bar', data: [{ category: 'A', value: 10 }] },
        },
      ],
    }
    const config: RuntimeConfig = { api: {}, initialPage: page.id, pages: [page] }
    const state = createRuntimeState(config)
    const dispatch = vi.fn<(action: RuntimeStateAction) => void>()
    const dispatchAndSyncState = vi.fn<(action: RuntimeStateAction) => void>()

    render(
      <RuntimeStateContext.Provider
        value={{
          config,
          initialState: state,
          state,
          dispatch,
          dispatchAndSyncState,
          getLatestState: () => state,
        }}
      >
        <RuntimePage />
      </RuntimeStateContext.Provider>,
    )

    fireEvent.click(screen.getByTestId('chart-series'))
    expect(dispatch).not.toHaveBeenCalled()
    expect(dispatchAndSyncState).not.toHaveBeenCalled()
    expect(screen.getByTestId('chart-tooltip')).toBeInTheDocument()
  })
})
