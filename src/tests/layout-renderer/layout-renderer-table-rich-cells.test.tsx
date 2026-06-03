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
  it('renders a dynamic image cell resolving src and alt from item.* per row', () => {
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
                'item.name',
                { type: 'image', props: { src: 'item.avatar', alt: 'item.name' } },
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

  it('renders a dynamic button cell that navigates with item.* params when clicked', () => {
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
                'item.name',
                {
                  type: 'button',
                  props: {
                    label: 'Ver',
                    action: { type: 'navigateTo', pageId: 'detail', params: { id: 'item.id' } },
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

  it('renders a dynamic container cell with image and paragraph children propagating item.*', () => {
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
                    { type: 'image', props: { src: 'item.avatar', alt: 'item.name' } },
                    { type: 'paragraph', props: { text: 'item.name' } },
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
                'item.name',
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
                'item.name',
                {
                  type: 'image',
                  props: { src: 'item.avatar', alt: 'item.name' },
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
                'item.name',
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
})
