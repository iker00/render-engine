import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { RuntimeConfig, RuntimePageConfig } from '../../config/runtime-config'
import { RuntimePage } from '../../runtime/runtime-page'
import { RuntimeStateContext } from '../../runtime/runtime-state/runtime-state-context'
import { createRuntimeState } from '../../runtime/runtime-state/runtime-state-reducer'
import type { RuntimeState, RuntimeStateAction } from '../../runtime/runtime-state/runtime-state-types'

function renderRuntimePageWithState(activePage: RuntimePageConfig, state: RuntimeState) {
  const config: RuntimeConfig = {
    api: {},
    initialPage: activePage.id,
    pages: [activePage],
  }
  const dispatch = vi.fn<(action: RuntimeStateAction) => void>()
  const dispatchAndSyncState = vi.fn<(action: RuntimeStateAction) => void>()

  return {
    ...render(
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
    ),
    dispatch,
    dispatchAndSyncState,
  }
}

function createRuntimePageState(activePage: RuntimePageConfig, queries: RuntimeState['queries']) {
  const config: RuntimeConfig = {
    api: {},
    initialPage: activePage.id,
    pages: [activePage],
  }

  const baseState = createRuntimeState(config)

  return {
    ...baseState,
    queries,
  } satisfies RuntimeState
}

function getTableBodyRows(table: HTMLElement) {
  const tbody = table.querySelector('tbody')

  if (!tbody) {
    throw new Error('Expected table to render a tbody element.')
  }

  return within(tbody).queryAllByRole('row')
}

function getTableBodyCellText(table: HTMLElement) {
  return getTableBodyRows(table).map((row) => within(row).getAllByRole('cell').map((cell) => cell.textContent))
}

describe('table collection pipeline source', () => {
  it('regression: a dynamic source without a pipeline renders the same rows as before the feature', () => {
    const activePage: RuntimePageConfig = {
      id: 'table-no-pipeline',
      layout: [
        {
          type: 'table',
          props: {
            headers: ['Id'],
            rows: {
              source: 'queries.orders.data',
              cells: ['row.id'],
            },
          },
        },
      ],
    }

    renderRuntimePageWithState(
      activePage,
      createRuntimePageState(activePage, {
        orders: {
          status: 'success',
          data: [{ id: 'o1' }, { id: 'o2' }, { id: 'o3' }],
          error: null,
        },
      }),
    )

    expect(getTableBodyCellText(screen.getByRole('table'))).toEqual([['o1'], ['o2'], ['o3']])
  })

  it('applies the declarative filter stage before native processing, with no native filters or sort active', () => {
    const activePage: RuntimePageConfig = {
      id: 'table-pipeline-filter',
      layout: [
        {
          type: 'table',
          props: {
            headers: ['Id', 'Status'],
            rows: {
              source: 'queries.orders.data | filter:status,eq,"pending"',
              cells: ['row.id', 'row.status'],
            },
          },
        },
      ],
    }

    renderRuntimePageWithState(
      activePage,
      createRuntimePageState(activePage, {
        orders: {
          status: 'success',
          data: [
            { id: 'o1', status: 'pending' },
            { id: 'o2', status: 'shipped' },
            { id: 'o3', status: 'pending' },
          ],
          error: null,
        },
      }),
    )

    expect(getTableBodyCellText(screen.getByRole('table'))).toEqual([
      ['o1', 'pending'],
      ['o3', 'pending'],
    ])
  })

  it('combines the declarative filter with an active native column filter using AND', () => {
    const activePage: RuntimePageConfig = {
      id: 'table-pipeline-filter-and-native',
      layout: [
        {
          type: 'table',
          props: {
            headers: ['Id', 'Status', 'Customer'],
            columns: [{ id: 'Customer', filterable: true }],
            rows: {
              source: 'queries.orders.data | filter:status,eq,"pending"',
              cells: ['row.id', 'row.status', 'row.customerName'],
            },
          },
        },
      ],
    }

    renderRuntimePageWithState(
      activePage,
      createRuntimePageState(activePage, {
        orders: {
          status: 'success',
          data: [
            { id: 'o1', status: 'pending', customerName: 'Ana Torres' },
            { id: 'o2', status: 'pending', customerName: 'Bruno Diaz' },
            { id: 'o3', status: 'shipped', customerName: 'Ana Perez' },
          ],
          error: null,
        },
      }),
    )

    const table = screen.getByRole('table')
    // Before the native filter, both pending rows are visible (declarative filter already applied).
    expect(getTableBodyCellText(table)).toEqual([
      ['o1', 'pending', 'Ana Torres'],
      ['o2', 'pending', 'Bruno Diaz'],
    ])

    fireEvent.change(screen.getByRole('searchbox', { name: 'Filtrar Customer' }), { target: { value: 'ana' } })

    // Only the row satisfying both the declarative filter (pending) and the native filter (customer contains "ana").
    expect(getTableBodyCellText(table)).toEqual([['o1', 'pending', 'Ana Torres']])
  })

  it('fixes the default row order with the declarative orderby while no sortable column is active', () => {
    const activePage: RuntimePageConfig = {
      id: 'table-pipeline-orderby-default',
      layout: [
        {
          type: 'table',
          props: {
            headers: ['Id', 'CreatedAt'],
            rows: {
              source: 'queries.orders.data | orderby:createdAt,desc',
              cells: ['row.id', 'row.createdAt'],
            },
          },
        },
      ],
    }

    renderRuntimePageWithState(
      activePage,
      createRuntimePageState(activePage, {
        orders: {
          status: 'success',
          data: [
            { id: 'o1', createdAt: '2024-01-01' },
            { id: 'o2', createdAt: '2024-03-01' },
            { id: 'o3', createdAt: '2024-02-01' },
          ],
          error: null,
        },
      }),
    )

    expect(getTableBodyCellText(screen.getByRole('table'))).toEqual([
      ['o2', '2024-03-01'],
      ['o3', '2024-02-01'],
      ['o1', '2024-01-01'],
    ])
  })

  it('returns rows to the declarative orderby order once the native column sort cycles back to "no sort"', () => {
    const activePage: RuntimePageConfig = {
      id: 'table-pipeline-orderby-native-cycle',
      layout: [
        {
          type: 'table',
          props: {
            headers: ['Id', 'Total'],
            columns: [{ id: 'Total', sortable: true }],
            rows: {
              source: 'queries.orders.data | orderby:createdAt,desc',
              cells: ['row.id', 'row.total'],
            },
          },
        },
      ],
    }

    renderRuntimePageWithState(
      activePage,
      createRuntimePageState(activePage, {
        orders: {
          status: 'success',
          data: [
            { id: 'o1', createdAt: '2024-01-01', total: '50' },
            { id: 'o2', createdAt: '2024-03-01', total: '10' },
            { id: 'o3', createdAt: '2024-02-01', total: '90' },
          ],
          error: null,
        },
      }),
    )

    const table = screen.getByRole('table')
    // Declarative default: orderby createdAt desc -> o2, o3, o1
    expect(getTableBodyCellText(table)).toEqual([
      ['o2', '10'],
      ['o3', '90'],
      ['o1', '50'],
    ])

    const sortButton = within(table).getByRole('button', { name: 'Ordenar Total' })

    // First click: ascending native sort by Total replaces the declarative order.
    fireEvent.click(sortButton)
    expect(getTableBodyCellText(table)).toEqual([
      ['o2', '10'],
      ['o1', '50'],
      ['o3', '90'],
    ])

    // Second click: descending native sort by Total.
    fireEvent.click(sortButton)
    expect(getTableBodyCellText(table)).toEqual([
      ['o3', '90'],
      ['o1', '50'],
      ['o2', '10'],
    ])

    // Third click: back to "no sort" - rows return to the declarative orderby order, with no
    // extra mechanism remembering the pre-sort order.
    fireEvent.click(sortButton)
    expect(getTableBodyCellText(table)).toEqual([
      ['o2', '10'],
      ['o3', '90'],
      ['o1', '50'],
    ])
  })

  it('produces 4 pages of 5 rows when a declarative slice:0,20 stage feeds local pagination with pageSize 5', () => {
    const orders = Array.from({ length: 30 }, (_, index) => ({ id: `o${index + 1}`, total: index + 1 }))
    const activePage: RuntimePageConfig = {
      id: 'table-pipeline-slice-pagination',
      layout: [
        {
          type: 'table',
          props: {
            headers: ['Id', 'Total'],
            rows: {
              source: 'queries.orders.data | orderby:total,desc | slice:0,20',
              cells: ['row.id', 'row.total'],
            },
            pagination: {
              enabled: true,
              pageSize: 5,
              controls: { variant: 'numbered' },
            },
          },
        },
      ],
    }

    renderRuntimePageWithState(
      activePage,
      createRuntimePageState(activePage, {
        orders: {
          status: 'success',
          data: orders,
          error: null,
        },
      }),
    )

    // Numbered controls render one button per page: exactly 4 pages for a 20-row sliced pool.
    expect(screen.getByRole('button', { name: '4' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '5' })).not.toBeInTheDocument()
  })

  it('makes the local pagination model paginate the rows already cut down by the declarative slice, not the full collection', () => {
    const orders = Array.from({ length: 30 }, (_, index) => ({ id: `o${index + 1}`, total: index + 1 }))
    const activePage: RuntimePageConfig = {
      id: 'table-pipeline-slice-before-native-pagination',
      layout: [
        {
          type: 'table',
          props: {
            headers: ['Id', 'Total'],
            rows: {
              source: 'queries.orders.data | orderby:total,desc | slice:0,20',
              cells: ['row.id', 'row.total'],
            },
            pagination: {
              enabled: true,
              pageSize: 5,
              controls: { variant: 'numbered' },
            },
          },
        },
      ],
    }

    renderRuntimePageWithState(
      activePage,
      createRuntimePageState(activePage, {
        orders: {
          status: 'success',
          data: orders,
          error: null,
        },
      }),
    )

    const table = screen.getByRole('table')
    // Top 20 by total desc: totals 30..11. Page 1 shows the 5 highest totals.
    expect(getTableBodyCellText(table)).toEqual([
      ['o30', '30'],
      ['o29', '29'],
      ['o28', '28'],
      ['o27', '27'],
      ['o26', '26'],
    ])

    fireEvent.click(screen.getByRole('button', { name: '4' }))

    // Last page (4th of 4) shows the lowest totals still inside the sliced pool (rank 16-20 => totals 15..11).
    // total=10 (rank 21) must never appear: it was discarded by the declarative slice before pagination ran.
    expect(getTableBodyCellText(table)).toEqual([
      ['o15', '15'],
      ['o14', '14'],
      ['o13', '13'],
      ['o12', '12'],
      ['o11', '11'],
    ])
  })
})
