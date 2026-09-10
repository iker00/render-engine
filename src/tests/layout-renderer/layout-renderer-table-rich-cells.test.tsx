import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RuntimeConfig, RuntimePageConfig } from '../../config/runtime-config'
import { RuntimePage } from '../../runtime/runtime-page'
import { RuntimeStateContext } from '../../runtime/runtime-state/runtime-state-context'
import { createRuntimeState } from '../../runtime/runtime-state/runtime-state-reducer'
import type { RuntimeState, RuntimeStateAction } from '../../runtime/runtime-state/runtime-state-types'

afterEach(() => {
  vi.unstubAllGlobals()
})

function renderRuntimePageWithState(
  activePage: RuntimePageConfig,
  state: RuntimeState,
  extraPages: RuntimePageConfig[] = [],
) {
  const config: RuntimeConfig = {
    api: {},
    initialPage: activePage.id,
    pages: [activePage, ...extraPages],
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

function createRuntimePageState(
  activePage: RuntimePageConfig,
  queries: RuntimeState['queries'],
  navigation?: RuntimeState['navigation'],
) {
  const config: RuntimeConfig = {
    api: {},
    initialPage: activePage.id,
    pages: [activePage],
  }

  const baseState = createRuntimeState(config)

  return {
    ...baseState,
    queries,
    navigation: navigation ?? baseState.navigation,
    pageEntry: {
      ...baseState.pageEntry,
      pageId: (navigation ?? baseState.navigation).currentPageId,
      params: navigation?.history[navigation.history.length - 1]?.params ?? baseState.pageEntry.params,
    },
  } satisfies RuntimeState
}

function getTableBodyRows(table: HTMLElement) {
  const tbody = table.querySelector('tbody')

  if (!tbody) {
    throw new Error('Expected table to render a tbody element.')
  }

  return within(tbody).queryAllByRole('row')
}

describe('table rich cells', () => {
  it('renders a dynamic image cell resolving src and alt from row.* per row', () => {
    const activePage: RuntimePageConfig = {
      id: 'rich-table-dynamic-image',
      layout: [
        {
          type: 'table',
          props: {
            headers: ['Name', 'Avatar'],
            rows: {
              source: 'queries.users.data.results',
              cells: [
                'row.name',
                { type: 'image', props: { src: 'row.avatar', alt: 'row.name' } },
              ],
            },
          },
        },
      ],
    }

    renderRuntimePageWithState(
      activePage,
      createRuntimePageState(activePage, {
        users: {
          status: 'success',
          data: {
            results: [
              { name: 'Ada', avatar: '/media/ada.png' },
              { name: 'Grace', avatar: '/media/grace.png' },
            ],
          },
          error: null,
        },
      }),
    )

    const table = screen.getByRole('table')
    const rows = getTableBodyRows(table)
    expect(rows).toHaveLength(2)

    const adaRow = rows[0]
    const graceRow = rows[1]

    // First cell in each row has the name as text
    expect(within(adaRow).getAllByRole('cell')[0]).toHaveTextContent('Ada')
    // Second cell contains the image
    const adaImg = within(adaRow).getByRole('img', { name: 'Ada' })
    expect(adaImg).toHaveAttribute('src', '/media/ada.png')

    const graceImg = within(graceRow).getByRole('img', { name: 'Grace' })
    expect(graceImg).toHaveAttribute('src', '/media/grace.png')
  })

  it('renders a dynamic button cell that navigates with row.* params when clicked', () => {
    const detailPage: RuntimePageConfig = {
      id: 'detail',
      layout: [],
    }
    const activePage: RuntimePageConfig = {
      id: 'rich-table-dynamic-button',
      layout: [
        {
          type: 'table',
          props: {
            headers: ['Name', 'Action'],
            rows: {
              source: 'queries.users.data.results',
              cells: [
                'row.name',
                {
                  type: 'button',
                  props: {
                    label: 'Ver',
                    action: { type: 'navigateTo', pageId: 'detail', params: { id: 'row.id' } },
                  },
                },
              ],
            },
          },
        },
      ],
    }

    const { dispatchAndSyncState } = renderRuntimePageWithState(
      activePage,
      createRuntimePageState(activePage, {
        users: {
          status: 'success',
          data: {
            results: [
              { id: 'user-1', name: 'Ada' },
              { id: 'user-2', name: 'Grace' },
            ],
          },
          error: null,
        },
      }),
      [detailPage],
    )

    const table = screen.getByRole('table')
    const rows = getTableBodyRows(table)
    expect(rows).toHaveLength(2)

    const buttons = within(table).getAllByRole('button', { name: 'Ver' })
    expect(buttons).toHaveLength(2)

    // Click first button (Ada's row) - should navigate to detail with id from first item
    fireEvent.click(buttons[0])
    expect(dispatchAndSyncState).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'navigation/navigate',
        payload: expect.objectContaining({
          pageId: 'detail',
          params: expect.objectContaining({ id: 'user-1' }),
        }),
      }),
    )

    // Click second button (Grace's row) - should navigate with Grace's id
    fireEvent.click(buttons[1])
    expect(dispatchAndSyncState).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'navigation/navigate',
        payload: expect.objectContaining({
          pageId: 'detail',
          params: expect.objectContaining({ id: 'user-2' }),
        }),
      }),
    )
  })

  it('renders a dynamic container cell with image and paragraph children propagating row.*', () => {
    const activePage: RuntimePageConfig = {
      id: 'rich-table-dynamic-container',
      layout: [
        {
          type: 'table',
          props: {
            headers: ['Info'],
            rows: {
              source: 'queries.users.data.results',
              cells: [
                {
                  type: 'container',
                  props: {},
                  children: [
                    { type: 'image', props: { src: 'row.avatar', alt: 'row.name' } },
                    { type: 'paragraph', props: { text: 'row.name' } },
                  ],
                },
              ],
            },
          },
        },
      ],
    }

    renderRuntimePageWithState(
      activePage,
      createRuntimePageState(activePage, {
        users: {
          status: 'success',
          data: {
            results: [
              { name: 'Ada', avatar: '/media/ada.png' },
              { name: 'Grace', avatar: '/media/grace.png' },
            ],
          },
          error: null,
        },
      }),
    )

    const table = screen.getByRole('table')
    const rows = getTableBodyRows(table)
    expect(rows).toHaveLength(2)

    const adaImg = within(rows[0]).getByRole('img', { name: 'Ada' })
    expect(adaImg).toHaveAttribute('src', '/media/ada.png')
    expect(within(rows[0]).getByText('Ada')).toBeInTheDocument()

    const graceImg = within(rows[1]).getByRole('img', { name: 'Grace' })
    expect(graceImg).toHaveAttribute('src', '/media/grace.png')
    expect(within(rows[1]).getByText('Grace')).toBeInTheDocument()
  })

  it('leaves the td empty when a dynamic NodeObject cell has visibility that resolves to hidden', () => {
    const activePage: RuntimePageConfig = {
      id: 'rich-table-visibility-hidden',
      layout: [
        {
          type: 'table',
          props: {
            headers: ['Name', 'Action'],
            rows: {
              source: 'queries.users.data.results',
              cells: [
                'row.name',
                {
                  type: 'button',
                  props: { label: 'Ver' },
                  visibility: { reference: 'queries.users.status', operator: 'equals', value: 'never' },
                },
              ],
            },
          },
        },
      ],
    }

    renderRuntimePageWithState(
      activePage,
      createRuntimePageState(activePage, {
        users: {
          status: 'success',
          data: {
            results: [{ name: 'Ada' }],
          },
          error: null,
        },
      }),
    )

    const table = screen.getByRole('table')
    const rows = getTableBodyRows(table)
    expect(rows).toHaveLength(1)

    // The row still has exactly 2 cells
    const cells = within(rows[0]).getAllByRole('cell')
    expect(cells).toHaveLength(2)

    // First cell has text, second cell has no button
    expect(cells[0]).toHaveTextContent('Ada')
    expect(within(cells[1]).queryByRole('button')).not.toBeInTheDocument()
    expect(cells[1]).toHaveTextContent('')
  })

  it('shows queryStateFeedback inside the td without affecting other cells in the row', () => {
    const activePage: RuntimePageConfig = {
      id: 'rich-table-qsf-loading',
      layout: [
        {
          type: 'table',
          props: {
            headers: ['Name', 'Avatar'],
            rows: {
              source: 'queries.users.data.results',
              cells: [
                'row.name',
                {
                  type: 'image',
                  props: { src: 'row.avatar', alt: 'row.name' },
                  queryStateFeedback: {
                    query: 'slowQuery',
                    states: { loading: { mode: 'fallback', fallback: [{ type: 'paragraph', props: { text: 'Cargando...' } }] } },
                  },
                },
              ],
            },
          },
        },
      ],
    }

    renderRuntimePageWithState(
      activePage,
      createRuntimePageState(activePage, {
        users: {
          status: 'success',
          data: {
            results: [{ name: 'Ada', avatar: '/media/ada.png' }],
          },
          error: null,
        },
        slowQuery: {
          status: 'loading',
          data: null,
          error: null,
        },
      }),
    )

    const table = screen.getByRole('table')
    const rows = getTableBodyRows(table)
    expect(rows).toHaveLength(1)

    const cells = within(rows[0]).getAllByRole('cell')
    expect(cells).toHaveLength(2)
    // First cell is unaffected
    expect(cells[0]).toHaveTextContent('Ada')
    // Second cell shows the loading fallback
    expect(within(cells[1]).getByText('Cargando...')).toBeInTheDocument()
    // Image is not rendered because qsf hides it
    expect(within(cells[1]).queryByRole('img')).not.toBeInTheDocument()
  })

  it('renders a manual NodeObject cell inside the td without an item context', () => {
    const activePage: RuntimePageConfig = {
      id: 'rich-table-manual-node',
      layout: [
        {
          type: 'table',
          props: {
            headers: ['Name', 'Logo'],
            rows: [
              ['Ada', { type: 'image', props: { src: '/media/logo.png', alt: 'Logo' } }],
            ],
          },
        },
      ],
    }

    renderRuntimePageWithState(activePage, createRuntimePageState(activePage, {}))

    const table = screen.getByRole('table')
    const rows = getTableBodyRows(table)
    expect(rows).toHaveLength(1)

    const cells = within(rows[0]).getAllByRole('cell')
    expect(cells).toHaveLength(2)
    expect(cells[0]).toHaveTextContent('Ada')

    const img = within(cells[1]).getByRole('img', { name: 'Logo' })
    expect(img).toHaveAttribute('src', '/media/logo.png')
  })

  it('sorts a column with mixed primitives and NodeObject cells treating nodes as empty string', () => {
    const activePage: RuntimePageConfig = {
      id: 'rich-table-sort-mixed',
      layout: [
        {
          type: 'table',
          props: {
            headers: ['Name', 'Action'],
            columns: [{ id: 'Name', sortable: true }],
            rows: [
              ['Grace', { type: 'button', props: { label: 'B1' } }],
              ['Ada', { type: 'button', props: { label: 'B2' } }],
              ['Álvaro', { type: 'button', props: { label: 'B3' } }],
            ],
          },
        },
      ],
    }

    renderRuntimePageWithState(activePage, createRuntimePageState(activePage, {}))

    const table = screen.getByRole('table')
    const sortButton = within(table).getByRole('button', { name: 'Ordenar Name' })

    // Sort ascending
    fireEvent.click(sortButton)

    const rows = getTableBodyRows(table)
    expect(rows).toHaveLength(3)
    const rowTexts = rows.map((row) => within(row).getAllByRole('cell')[0].textContent)
    // Ascending order: Ada, Álvaro, Grace
    expect(rowTexts).toEqual(['Ada', 'Álvaro', 'Grace'])

    // No errors: button cells still present in each row
    rows.forEach((row) => {
      expect(within(row).getAllByRole('cell')).toHaveLength(2)
    })
  })

  it('filters a column with mixed primitives and NodeObject cells treating nodes as empty string', () => {
    const activePage: RuntimePageConfig = {
      id: 'rich-table-filter-mixed',
      layout: [
        {
          type: 'table',
          props: {
            headers: ['Name', 'Action'],
            columns: [{ id: 'Name', filterable: true }],
            rows: {
              source: 'queries.users.data.results',
              cells: [
                'row.name',
                { type: 'button', props: { label: 'Ver' } },
              ],
            },
          },
        },
      ],
    }

    renderRuntimePageWithState(
      activePage,
      createRuntimePageState(activePage, {
        users: {
          status: 'success',
          data: {
            results: [
              { name: 'Ada' },
              { name: 'Grace' },
            ],
          },
          error: null,
        },
      }),
    )

    const table = screen.getByRole('table')

    // Without filter: all rows visible
    expect(getTableBodyRows(table)).toHaveLength(2)

    // Filter by 'ada': only Ada's row shows
    const filterInput = screen.getByRole('searchbox', { name: 'Filtrar Name' })
    fireEvent.change(filterInput, { target: { value: 'ada' } })

    const filteredRows = getTableBodyRows(table)
    expect(filteredRows).toHaveLength(1)
    expect(within(filteredRows[0]).getAllByRole('cell')[0]).toHaveTextContent('Ada')
  })

  it('applies both filterable and sortable with NodeObject cells without error', () => {
    const activePage: RuntimePageConfig = {
      id: 'rich-table-filter-sort-mixed',
      layout: [
        {
          type: 'table',
          props: {
            headers: ['Name', 'Badge'],
            columns: [{ id: 'Name', filterable: true, sortable: true }],
            rows: [
              ['Grace', { type: 'paragraph', props: { text: 'badge-g' } }],
              ['Ada', { type: 'paragraph', props: { text: 'badge-a' } }],
            ],
          },
        },
      ],
    }

    renderRuntimePageWithState(activePage, createRuntimePageState(activePage, {}))

    const table = screen.getByRole('table')

    // Sort ascending first
    fireEvent.click(within(table).getByRole('button', { name: 'Ordenar Name' }))
    expect(getTableBodyRows(table)[0]).toHaveTextContent('Ada')

    // Now filter: only Grace rows
    fireEvent.change(screen.getByRole('searchbox', { name: 'Filtrar Name' }), { target: { value: 'grace' } })
    const filteredRows = getTableBodyRows(table)
    expect(filteredRows).toHaveLength(1)
    expect(filteredRows[0]).toHaveTextContent('Grace')
  })

  it('only mounts node cells for the visible page and remounts when page changes', () => {
    const activePage: RuntimePageConfig = {
      id: 'rich-table-pagination',
      layout: [
        {
          type: 'table',
          props: {
            headers: ['Name', 'Avatar'],
            pagination: { enabled: true, pageSize: 2 },
            rows: [
              ['Ada', { type: 'image', props: { src: '/media/ada.png', alt: 'Ada' } }],
              ['Grace', { type: 'image', props: { src: '/media/grace.png', alt: 'Grace' } }],
              ['Álvaro', { type: 'image', props: { src: '/media/alvaro.png', alt: 'Álvaro' } }],
            ],
          },
        },
      ],
    }

    renderRuntimePageWithState(activePage, createRuntimePageState(activePage, {}))

    // Page 1: Ada and Grace should have their images
    expect(screen.getByRole('img', { name: 'Ada' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Grace' })).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: 'Álvaro' })).not.toBeInTheDocument()

    // Navigate to page 2
    const nextButton = screen.getByRole('button', { name: 'Siguiente' })
    fireEvent.click(nextButton)

    // Page 2: Álvaro's image should be mounted, Ada and Grace unmounted
    expect(screen.queryByRole('img', { name: 'Ada' })).not.toBeInTheDocument()
    expect(screen.queryByRole('img', { name: 'Grace' })).not.toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Álvaro' })).toBeInTheDocument()
  })

  it('renders an empty container cell without breaking the row structure', () => {
    const activePage: RuntimePageConfig = {
      id: 'rich-table-empty-container',
      layout: [
        {
          type: 'table',
          props: {
            headers: ['Name', 'Empty'],
            rows: [
              ['Ada', { type: 'container', props: {} }],
            ],
          },
        },
      ],
    }

    renderRuntimePageWithState(activePage, createRuntimePageState(activePage, {}))

    const table = screen.getByRole('table')
    const rows = getTableBodyRows(table)
    expect(rows).toHaveLength(1)

    const cells = within(rows[0]).getAllByRole('cell')
    expect(cells).toHaveLength(2)
    expect(cells[0]).toHaveTextContent('Ada')
    // The container renders but is empty
    expect(cells[1]).toBeInTheDocument()
  })

  it('resolves item.* from the repeater ancestor and row.* from the table row at the same time inside an interpolated string', () => {
    const activePage: RuntimePageConfig = {
      id: 'repeater-table-item-and-row',
      layout: [
        {
          type: 'repeater',
          props: {
            items: { source: 'queries.departments.data', key: 'id' },
            template: [
              {
                type: 'table',
                props: {
                  headers: ['Info'],
                  rows: {
                    source: 'item.members',
                    cells: [
                      '{{item.deptName}} - {{row.name}}',
                      { type: 'paragraph', props: { text: '{{item.deptName}} - {{row.name}}' } },
                    ],
                  },
                },
              },
            ],
          },
        },
      ],
    }

    renderRuntimePageWithState(
      activePage,
      createRuntimePageState(activePage, {
        departments: {
          status: 'success',
          data: [{ id: 'dept-1', deptName: 'Engineering', members: [{ name: 'Ada' }] }],
          error: null,
        },
      }),
    )

    const table = screen.getByRole('table')
    const cells = within(getTableBodyRows(table)[0]).getAllByRole('cell')
    expect(cells[0]).toHaveTextContent('Engineering - Ada')
    expect(cells[1]).toHaveTextContent('Engineering - Ada')
  })

  it('degrades item.* to empty and resolves row.* normally in a dynamic table without a repeater ancestor', () => {
    const activePage: RuntimePageConfig = {
      id: 'dynamic-table-no-repeater-item-vs-row',
      layout: [
        {
          type: 'table',
          props: {
            headers: ['Item', 'Row'],
            rows: {
              source: 'queries.users.data.results',
              cells: ['item.name', 'row.name'],
            },
          },
        },
      ],
    }

    renderRuntimePageWithState(
      activePage,
      createRuntimePageState(activePage, {
        users: {
          status: 'success',
          data: { results: [{ name: 'Ada' }] },
          error: null,
        },
      }),
    )

    const cells = within(getTableBodyRows(screen.getByRole('table'))[0]).getAllByRole('cell')
    expect(cells[0]).toHaveTextContent('')
    expect(cells[1]).toHaveTextContent('Ada')
  })

  it('keeps item.$key accessible inside table cells when the repeater source is a plain object', () => {
    const activePage: RuntimePageConfig = {
      id: 'repeater-table-object-source-key',
      layout: [
        {
          type: 'repeater',
          props: {
            items: { source: 'queries.departments.data', key: '$key' },
            template: [
              {
                type: 'table',
                props: {
                  headers: ['Department', 'Member'],
                  rows: {
                    source: 'item.members',
                    cells: ['item.$key', 'row.name'],
                  },
                },
              },
            ],
          },
        },
      ],
    }

    renderRuntimePageWithState(
      activePage,
      createRuntimePageState(activePage, {
        departments: {
          status: 'success',
          data: {
            engineering: { members: [{ name: 'Ada' }] },
          },
          error: null,
        },
      }),
    )

    const cells = within(getTableBodyRows(screen.getByRole('table'))[0]).getAllByRole('cell')
    expect(cells[0]).toHaveTextContent('engineering')
    expect(cells[1]).toHaveTextContent('Ada')
  })

  it('propagates row and row.$index through a recursively nested container inside a cell-node, same depth as item', () => {
    const activePage: RuntimePageConfig = {
      id: 'rich-table-nested-container-row',
      layout: [
        {
          type: 'table',
          props: {
            headers: ['Info'],
            rows: {
              source: 'queries.users.data.results',
              cells: [
                {
                  type: 'container',
                  props: {},
                  children: [
                    {
                      type: 'container',
                      props: {},
                      children: [{ type: 'paragraph', props: { text: '{{row.name}} #{{row.$index}}' } }],
                    },
                  ],
                },
              ],
            },
          },
        },
      ],
    }

    renderRuntimePageWithState(
      activePage,
      createRuntimePageState(activePage, {
        users: {
          status: 'success',
          data: { results: [{ name: 'Ada' }, { name: 'Grace' }] },
          error: null,
        },
      }),
    )

    const rows = getTableBodyRows(screen.getByRole('table'))
    expect(within(rows[0]).getByText('Ada #1')).toBeInTheDocument()
    expect(within(rows[1]).getByText('Grace #2')).toBeInTheDocument()
  })

  it('leaves the td empty when a NodeObject cell inside a repeater-nested table has visibility that resolves to hidden, preserving item.* ancestor context for other cells', () => {
    const activePage: RuntimePageConfig = {
      id: 'rich-table-repeater-visibility-hidden',
      layout: [
        {
          type: 'repeater',
          props: {
            items: { source: 'queries.departments.data', key: 'id' },
            template: [
              {
                type: 'table',
                props: {
                  headers: ['Name', 'Action'],
                  rows: {
                    source: 'item.members',
                    cells: [
                      'row.name',
                      {
                        type: 'button',
                        props: { label: 'Ver {{item.deptName}}' },
                        visibility: { reference: 'queries.departments.status', operator: 'equals', value: 'never' },
                      },
                    ],
                  },
                },
              },
            ],
          },
        },
      ],
    }

    renderRuntimePageWithState(
      activePage,
      createRuntimePageState(activePage, {
        departments: {
          status: 'success',
          data: [{ id: 'dept-1', deptName: 'Engineering', members: [{ name: 'Ada' }] }],
          error: null,
        },
      }),
    )

    const cells = within(getTableBodyRows(screen.getByRole('table'))[0]).getAllByRole('cell')
    expect(cells[0]).toHaveTextContent('Ada')
    expect(within(cells[1]).queryByRole('button')).not.toBeInTheDocument()
    expect(cells[1]).toHaveTextContent('')
  })

  it('resolves item.* from the repeater ancestor inside a manual-mode NodeObject cell (regression: table no longer replaces ambient context in manual mode)', () => {
    const activePage: RuntimePageConfig = {
      id: 'manual-table-repeater-item-context',
      layout: [
        {
          type: 'repeater',
          props: {
            items: { source: 'queries.departments.data', key: 'id' },
            template: [
              {
                type: 'table',
                props: {
                  headers: ['Name', 'Action'],
                  rows: [['Ada', { type: 'button', props: { label: 'Ver {{item.deptName}}' } }]],
                },
              },
            ],
          },
        },
      ],
    }

    renderRuntimePageWithState(
      activePage,
      createRuntimePageState(activePage, {
        departments: {
          status: 'success',
          data: [{ id: 'dept-1', deptName: 'Engineering' }],
          error: null,
        },
      }),
    )

    expect(screen.getByRole('button', { name: 'Ver Engineering' })).toBeInTheDocument()
  })

  it('recalculates row.$index contiguously over the visible subset after filtering excludes rows', () => {
    const activePage: RuntimePageConfig = {
      id: 'rich-table-filter-row-index',
      layout: [
        {
          type: 'table',
          props: {
            headers: ['Name', 'Position'],
            columns: [{ id: 'Name', filterable: true }],
            rows: [
              ['Ada', '{{row.$index}}'],
              ['Grace', '{{row.$index}}'],
              ['Lin', '{{row.$index}}'],
            ],
          },
        },
      ],
    }

    renderRuntimePageWithState(activePage, createRuntimePageState(activePage, {}))
    const table = screen.getByRole('table')

    fireEvent.change(screen.getByRole('searchbox', { name: 'Filtrar Name' }), { target: { value: 'a' } })

    const rows = getTableBodyRows(table)
    expect(rows).toHaveLength(2)
    expect(within(rows[0]).getAllByRole('cell').map((cell) => cell.textContent)).toEqual(['Ada', '1'])
    expect(within(rows[1]).getAllByRole('cell').map((cell) => cell.textContent)).toEqual(['Grace', '2'])
  })

  it('recalculates row.$index reflecting the new order after sorting a sortable column', () => {
    const activePage: RuntimePageConfig = {
      id: 'rich-table-sort-row-index',
      layout: [
        {
          type: 'table',
          props: {
            headers: ['Name', 'Position'],
            columns: [{ id: 'Name', sortable: true }],
            rows: [
              ['Grace', '{{row.$index}}'],
              ['Ada', '{{row.$index}}'],
            ],
          },
        },
      ],
    }

    renderRuntimePageWithState(activePage, createRuntimePageState(activePage, {}))
    const table = screen.getByRole('table')

    fireEvent.click(within(table).getByRole('button', { name: 'Ordenar Name' }))

    const rows = getTableBodyRows(table)
    expect(within(rows[0]).getAllByRole('cell').map((cell) => cell.textContent)).toEqual(['Ada', '1'])
    expect(within(rows[1]).getAllByRole('cell').map((cell) => cell.textContent)).toEqual(['Grace', '2'])
  })

  it('resolves row.$index to the row position, not a literal $index property present in the row data', () => {
    const activePage: RuntimePageConfig = {
      id: 'rich-table-row-index-precedence',
      layout: [
        {
          type: 'table',
          props: {
            headers: ['Name', 'Position'],
            rows: {
              source: 'queries.users.data.results',
              cells: ['row.name', '{{row.$index}}'],
            },
          },
        },
      ],
    }

    renderRuntimePageWithState(
      activePage,
      createRuntimePageState(activePage, {
        users: {
          status: 'success',
          data: {
            results: [
              { name: 'Ada', $index: 'bogus' },
              { name: 'Grace', $index: 'bogus2' },
            ],
          },
          error: null,
        },
      }),
    )

    const rows = getTableBodyRows(screen.getByRole('table'))
    expect(within(rows[0]).getAllByRole('cell').map((cell) => cell.textContent)).toEqual(['Ada', '1'])
    expect(within(rows[1]).getAllByRole('cell').map((cell) => cell.textContent)).toEqual(['Grace', '2'])
  })

  describe('visibility with row.* in table cells', () => {
    it('shows a cell-node child with visibility: row.status equals active only on matching rows', () => {
      const activePage: RuntimePageConfig = {
        id: 'rich-table-visibility-row-status',
        layout: [
          {
            type: 'table',
            props: {
              headers: ['Name', 'Info'],
              rows: {
                source: 'queries.users.data.results',
                cells: [
                  'row.name',
                  {
                    type: 'container',
                    props: {},
                    children: [
                      {
                        type: 'paragraph',
                        props: { text: 'Active only' },
                        visibility: { reference: 'row.status', operator: 'equals', value: 'active' },
                      },
                    ],
                  },
                ],
              },
            },
          },
        ],
      }

      renderRuntimePageWithState(
        activePage,
        createRuntimePageState(activePage, {
          users: {
            status: 'success',
            data: {
              results: [
                { name: 'Ada', status: 'active' },
                { name: 'Grace', status: 'archived' },
                { name: 'Lin', status: 'active' },
              ],
            },
            error: null,
          },
        }),
      )

      const rows = getTableBodyRows(screen.getByRole('table'))
      expect(rows).toHaveLength(3)
      expect(within(rows[0]).queryByText('Active only')).toBeInTheDocument()
      expect(within(rows[1]).queryByText('Active only')).not.toBeInTheDocument()
      expect(within(rows[2]).queryByText('Active only')).toBeInTheDocument()
    })

    it('shows a cell-node with visibility: row.$index lessThan 3 only on the first two rows', () => {
      const activePage: RuntimePageConfig = {
        id: 'rich-table-visibility-row-index',
        layout: [
          {
            type: 'table',
            props: {
              headers: ['Name', 'Info'],
              rows: {
                source: 'queries.users.data.results',
                cells: [
                  'row.name',
                  {
                    type: 'paragraph',
                    props: { text: 'Early row' },
                    visibility: { reference: 'row.$index', operator: 'lessThan', value: 3 },
                  },
                ],
              },
            },
          },
        ],
      }

      renderRuntimePageWithState(
        activePage,
        createRuntimePageState(activePage, {
          users: {
            status: 'success',
            data: {
              results: [{ name: 'Ada' }, { name: 'Grace' }, { name: 'Lin' }],
            },
            error: null,
          },
        }),
      )

      const rows = getTableBodyRows(screen.getByRole('table'))
      expect(rows).toHaveLength(3)
      expect(within(rows[0]).queryByText('Early row')).toBeInTheDocument()
      expect(within(rows[1]).queryByText('Early row')).toBeInTheDocument()
      expect(within(rows[2]).queryByText('Early row')).not.toBeInTheDocument()
    })

    it('recontabiliza row.$index de forma contigua tras aplicar un filtro por columna', () => {
      const activePage: RuntimePageConfig = {
        id: 'rich-table-visibility-row-index-filtered',
        layout: [
          {
            type: 'table',
            props: {
              headers: ['Name', 'Info'],
              columns: [{ id: 'Name', filterable: true }],
              rows: {
                source: 'queries.users.data.results',
                cells: [
                  'row.name',
                  {
                    type: 'paragraph',
                    props: { text: 'First visible row' },
                    visibility: { reference: 'row.$index', operator: 'equals', value: 1 },
                  },
                ],
              },
            },
          },
        ],
      }

      renderRuntimePageWithState(
        activePage,
        createRuntimePageState(activePage, {
          users: {
            status: 'success',
            data: {
              results: [{ name: 'Ada' }, { name: 'Grace' }, { name: 'Lin' }],
            },
            error: null,
          },
        }),
      )

      const table = screen.getByRole('table')

      // Before filtering: only the first row ("Ada") shows the visibility-gated cell
      const initialRows = getTableBodyRows(table)
      expect(within(initialRows[0]).queryByText('First visible row')).toBeInTheDocument()
      expect(within(initialRows[1]).queryByText('First visible row')).not.toBeInTheDocument()

      // Filtering out "Ada" makes "Grace" the new first visible row: row.$index recounts to 1
      fireEvent.change(screen.getByRole('searchbox', { name: 'Filtrar Name' }), { target: { value: 'grace' } })

      const filteredRows = getTableBodyRows(table)
      expect(filteredRows).toHaveLength(1)
      expect(within(filteredRows[0]).getAllByRole('cell')[0]).toHaveTextContent('Grace')
      expect(within(filteredRows[0]).queryByText('First visible row')).toBeInTheDocument()
    })

    it('composes row.* and item.* in an and group without mutual shadowing inside a table nested in a repeater', () => {
      const activePage: RuntimePageConfig = {
        id: 'repeater-table-row-and-item-visibility',
        layout: [
          {
            type: 'repeater',
            props: {
              items: { source: 'queries.departments.data', key: 'id' },
              template: [
                {
                  type: 'table',
                  props: {
                    headers: ['Name', 'Info'],
                    rows: {
                      source: 'item.members',
                      cells: [
                        '{{item.ownerName}} - {{row.name}}',
                        {
                          type: 'paragraph',
                          props: { text: 'Editable' },
                          visibility: {
                            operator: 'and',
                            conditions: [
                              { reference: 'row.status', operator: 'equals', value: 'active' },
                              { reference: 'item.canEdit', operator: 'isTruthy' },
                            ],
                          },
                        },
                      ],
                    },
                  },
                },
              ],
            },
          },
        ],
      }

      renderRuntimePageWithState(
        activePage,
        createRuntimePageState(activePage, {
          departments: {
            status: 'success',
            data: [
              {
                id: 'dept-editable',
                ownerName: 'Engineering',
                canEdit: true,
                members: [
                  { name: 'Ada', status: 'active' },
                  { name: 'Grace', status: 'archived' },
                ],
              },
              {
                id: 'dept-readonly',
                ownerName: 'Sales',
                canEdit: false,
                members: [{ name: 'Lin', status: 'active' }],
              },
            ],
            error: null,
          },
        }),
      )

      const tables = screen.getAllByRole('table')
      expect(tables).toHaveLength(2)

      const editableRows = getTableBodyRows(tables[0])
      expect(within(editableRows[0]).queryByText('Editable')).toBeInTheDocument()
      expect(within(editableRows[1]).queryByText('Editable')).not.toBeInTheDocument()

      const readonlyRows = getTableBodyRows(tables[1])
      expect(within(readonlyRows[0]).queryByText('Editable')).not.toBeInTheDocument()
    })

    it('keeps table.visibility working with a non-row reference, unaffected by row.* wiring (regression)', () => {
      const activePage: RuntimePageConfig = {
        id: 'rich-table-table-level-visibility',
        layout: [
          {
            type: 'table',
            props: {
              headers: ['Name'],
              rows: {
                source: 'queries.users.data.results',
                cells: ['row.name'],
              },
            },
            visibility: { reference: 'queries.tableVisible.data', operator: 'isTruthy' },
          },
        ],
      }

      renderRuntimePageWithState(
        activePage,
        createRuntimePageState(activePage, {
          users: {
            status: 'success',
            data: { results: [{ name: 'Ada' }] },
            error: null,
          },
          tableVisible: {
            status: 'success',
            data: true,
            error: null,
          },
        }),
      )

      expect(screen.getByRole('table')).toBeInTheDocument()
    })

    it('degrades row.* without .$index to absent in manual table mode: row.$index still works, row.<field> does not', () => {
      const activePage: RuntimePageConfig = {
        id: 'manual-table-visibility-row-degradation',
        layout: [
          {
            type: 'table',
            props: {
              headers: ['Name', 'Index gated', 'Status gated'],
              rows: [
                [
                  'Ada',
                  {
                    type: 'paragraph',
                    props: { text: 'First row only' },
                    visibility: { reference: 'row.$index', operator: 'equals', value: 1 },
                  },
                  {
                    type: 'paragraph',
                    props: { text: 'Active only' },
                    visibility: { reference: 'row.status', operator: 'equals', value: 'active' },
                  },
                ],
                [
                  'Grace',
                  {
                    type: 'paragraph',
                    props: { text: 'First row only' },
                    visibility: { reference: 'row.$index', operator: 'equals', value: 1 },
                  },
                  {
                    type: 'paragraph',
                    props: { text: 'Active only' },
                    visibility: { reference: 'row.status', operator: 'equals', value: 'active' },
                  },
                ],
              ],
            },
          },
        ],
      }

      renderRuntimePageWithState(activePage, createRuntimePageState(activePage, {}))

      const rows = getTableBodyRows(screen.getByRole('table'))
      expect(rows).toHaveLength(2)

      // row.$index resolves from rowIndex, which is always populated (even in manual mode)
      expect(within(rows[0]).queryByText('First row only')).toBeInTheDocument()
      expect(within(rows[1]).queryByText('First row only')).not.toBeInTheDocument()

      // row.status has no backing row item in manual mode: it degrades to absent, never matching equals
      expect(within(rows[0]).queryByText('Active only')).not.toBeInTheDocument()
      expect(within(rows[1]).queryByText('Active only')).not.toBeInTheDocument()
    })
  })
})
