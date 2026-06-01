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

function getTableBodyCellText(table: HTMLElement) {
  return getTableBodyRows(table).map((row) => within(row).getAllByRole('cell').map((cell) => cell.textContent))
}

function getTableLayoutNode(table: HTMLElement) {
  const layoutNode = table.closest('[data-layout-node="table"]')

  if (!(layoutNode instanceof HTMLElement)) {
    throw new Error('Expected table to be wrapped by a table layout node.')
  }

  return layoutNode
}

describe('RuntimePage', () => {
  it('renders image nodes from literals and runtime references, including item.* inside repeater', () => {
    const activePage: RuntimePageConfig = {
      id: 'images',
      layout: [
        {
          type: 'image',
          props: {
            src: '/media/hero.png',
            alt: 'Hero image',
          },
        },
        {
          type: 'image',
          props: {
            src: 'queries.searchUsers.data.user.profile.avatarUrl',
            alt: 'queries.searchUsers.data.user.profile.name',
          },
        },
        {
          type: 'repeater',
          props: {
            items: {
              source: 'queries.searchUsers.data.results',
              key: 'id',
            },
            template: [
              {
                type: 'image',
                props: {
                  src: 'item.avatarUrl',
                  alt: 'item.name',
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
        searchUsers: {
          status: 'success',
          data: {
            user: {
              profile: {
                name: 'Ada',
                avatarUrl: '/media/ada-profile.png',
              },
            },
            results: [
              {
                id: 'user-1',
                name: 'Ada',
                avatarUrl: '/media/ada.png',
              },
              {
                id: 'user-2',
                name: 'Grace',
                avatarUrl: '/media/grace.png',
              },
            ],
          },
          error: null,
        },
      }),
    )

    const heroImage = screen.getByRole('img', { name: 'Hero image' })
    expect(heroImage).toHaveAttribute('src', '/media/hero.png')
    expect(heroImage).toHaveClass(
      'block',
      'max-w-full',
      'rounded-card',
      'border',
      'border-app-border-soft',
      'bg-app-surface-subtle',
      'object-cover',
    )

    expect(
      screen
        .getAllByRole('img', { name: 'Ada' })
        .find((image) => image.getAttribute('src') === '/media/ada-profile.png'),
    ).toBeDefined()

    const repeaterImages = screen.getAllByRole('img').filter((image) =>
      ['/media/ada.png', '/media/grace.png'].includes(image.getAttribute('src') ?? ''),
    )
    expect(repeaterImages.map((image) => image.getAttribute('alt'))).toEqual(['Ada', 'Grace'])
  })

  it('degrades image nodes safely when src is missing or not a usable string and keeps alt as empty text when unavailable', () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const activePage: RuntimePageConfig = {
      id: 'broken-images',
      layout: [
        {
          type: 'image',
          props: {
            src: 'queries.searchUsers.data.user.profile.avatarUrl',
            alt: 'queries.searchUsers.data.user.profile.nickname',
          },
        },
        {
          type: 'image',
          props: {
            src: 'queries.searchUsers.data',
            alt: 'queries.searchUsers.data.user.profile.name',
          },
        },
        {
          type: 'image',
          props: {
            src: 'queries.unknown.data.url',
            alt: 'Unknown image',
          },
        },
      ],
    }

    renderRuntimePageWithState(
      activePage,
      createRuntimePageState(activePage, {
        searchUsers: {
          status: 'success',
          data: {
            user: {
              profile: {
                name: 'Ada',
                avatarUrl: '/media/ada-profile.png',
              },
            },
          },
          error: null,
        },
      }),
    )

    const images = Array.from(document.querySelectorAll('img[data-layout-node="image"]'))
    expect(images).toHaveLength(1)
    expect(images[0]).toHaveAttribute('src', '/media/ada-profile.png')
    expect(images[0]).toHaveAttribute('alt', '')

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      '[runtime-references] Could not resolve "queries.searchUsers.data.user.profile.nickname" for image.props.alt (missing).',
    )
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      '[runtime-references] Could not resolve "queries.unknown.data.url" for image.props.src (missing).',
    )

    consoleWarnSpy.mockRestore()
  })

  it('renders manual tables with semantic markup, declared order, and shared visible scalar normalization', () => {
    const activePage: RuntimePageConfig = {
      id: 'manual-table',
      layout: [
        {
          type: 'table',
          props: {
            headers: ['Name', 'Status', 'Visits'],
            rows: [
              ['queries.searchUsers.data.user.profile.name', true, 12],
              ['Grace', false, 7],
            ],
          },
        },
      ],
    }

    renderRuntimePageWithState(
      activePage,
      createRuntimePageState(activePage, {
        searchUsers: {
          status: 'success',
          data: {
            user: {
              profile: {
                name: 'Ada',
              },
            },
          },
          error: null,
        },
      }),
    )

    const table = screen.getByRole('table')
    expect(within(table).getAllByRole('columnheader').map((cell) => cell.textContent)).toEqual(['Name', 'Status', 'Visits'])

    const bodyRows = within(table).getAllByRole('row').slice(1)
    expect(bodyRows).toHaveLength(2)
    expect(within(bodyRows[0]).getAllByRole('cell').map((cell) => cell.textContent)).toEqual(['Ada', 'true', '12'])
    expect(within(bodyRows[1]).getAllByRole('cell').map((cell) => cell.textContent)).toEqual(['Grace', 'false', '7'])
  })

  it('keeps table headers literal when they contain template delimiters', () => {
    const activePage: RuntimePageConfig = {
      id: 'literal-table-headers',
      layout: [
        {
          type: 'table',
          props: {
            headers: ['Name {{queries.searchUsers.status}}'],
            rows: [['Ada']],
          },
        },
      ],
    }

    renderRuntimePageWithState(
      activePage,
      createRuntimePageState(activePage, {
        searchUsers: {
          status: 'success',
          data: ['Ada'],
          error: null,
          requestSignature: null,
        },
      }),
    )

    expect(within(screen.getByRole('table')).getByRole('columnheader')).toHaveTextContent(
      'Name {{queries.searchUsers.status}}',
    )
  })

  it('renders dynamic tables from collection sources, preserves rows with partial items, and reuses global references per cell', () => {
    const activePage: RuntimePageConfig = {
      id: 'dynamic-table',
      layout: [
        {
          type: 'table',
          props: {
            headers: ['Name', 'Role', 'Query status'],
            rows: {
              source: 'queries.searchUsers.data.results',
              cells: ['item.name', 'item.role', 'queries.searchUsers.status'],
            },
          },
        },
      ],
    }

    renderRuntimePageWithState(
      activePage,
      createRuntimePageState(activePage, {
        searchUsers: {
          status: 'success',
          data: {
            results: [
              {
                id: 'user-1',
                name: 'Ada',
                role: 'Admin',
              },
              {
                id: 'user-2',
                name: 'Grace',
              },
            ],
          },
          error: null,
        },
      }),
    )

    const table = screen.getByRole('table')
    const bodyRows = within(table).getAllByRole('row').slice(1)
    expect(bodyRows).toHaveLength(2)
    expect(within(bodyRows[0]).getAllByRole('cell').map((cell) => cell.textContent)).toEqual(['Ada', 'Admin', 'success'])
    expect(within(bodyRows[1]).getAllByRole('cell').map((cell) => cell.textContent)).toEqual(['Grace', '', 'success'])
  })

  it('filters table rows locally by configured columns without affecting remote state', () => {
    const activePage: RuntimePageConfig = {
      id: 'filterable-table',
      layout: [
        {
          type: 'table',
          props: {
            headers: ['Name', 'Role', 'Visits'],
            columns: [
              { id: 'Name', filterable: true, filterPlaceholder: 'Buscar nombre' },
              { id: 'Role', filterable: true },
            ],
            rows: [
              ['Álvaro', 'Admin', 3],
              ['Ada', 'Admin', 12],
              ['Grace', 'Editor', 7],
            ],
          },
        },
      ],
    }
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    const { dispatch, dispatchAndSyncState } = renderRuntimePageWithState(activePage, createRuntimePageState(activePage, {}))
    const table = screen.getByRole('table')
    const tableNode = getTableLayoutNode(table)
    const filterGroup = within(tableNode).getByRole('group', { name: 'Filtros de tabla' })
    const nameFilter = within(tableNode).getByRole('searchbox', { name: 'Filtrar Name' })
    const roleFilter = within(tableNode).getByRole('searchbox', { name: 'Filtrar Role' })

    expect(tableNode.firstElementChild).toBe(filterGroup)
    expect(within(table).queryByRole('searchbox', { name: 'Filtrar Name' })).not.toBeInTheDocument()
    expect(nameFilter).toHaveAttribute('placeholder', 'Buscar nombre')
    expect(roleFilter).toHaveAttribute('placeholder', 'Role')
    expect(within(tableNode).queryByRole('searchbox', { name: 'Filtrar Visits' })).not.toBeInTheDocument()
    expect(within(tableNode).queryByRole('button', { name: 'Reiniciar filtros' })).not.toBeInTheDocument()
    expect(getTableBodyCellText(table)).toEqual([
      ['Álvaro', 'Admin', '3'],
      ['Ada', 'Admin', '12'],
      ['Grace', 'Editor', '7'],
    ])

    fireEvent.change(nameFilter, { target: { value: 'alv' } })
    expect(within(tableNode).getByRole('button', { name: 'Reiniciar filtros' })).toBeInTheDocument()
    expect(getTableBodyCellText(table)).toEqual([['Álvaro', 'Admin', '3']])

    fireEvent.change(nameFilter, { target: { value: 'a' } })
    fireEvent.change(roleFilter, { target: { value: 'admin' } })
    expect(getTableBodyCellText(table)).toEqual([
      ['Álvaro', 'Admin', '3'],
      ['Ada', 'Admin', '12'],
    ])

    fireEvent.change(roleFilter, { target: { value: 'missing' } })
    expect(getTableBodyRows(table)).toHaveLength(0)
    fireEvent.click(within(tableNode).getByRole('button', { name: 'Reiniciar filtros' }))
    expect(getTableBodyCellText(table)).toEqual([
      ['Álvaro', 'Admin', '3'],
      ['Ada', 'Admin', '12'],
      ['Grace', 'Editor', '7'],
    ])
    expect(within(tableNode).queryByRole('button', { name: 'Reiniciar filtros' })).not.toBeInTheDocument()
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(dispatch).not.toHaveBeenCalled()
    expect(dispatchAndSyncState).not.toHaveBeenCalled()
  })

  it('filters dynamic table cells by their final visible value and keeps table instances isolated', () => {
    const activePage: RuntimePageConfig = {
      id: 'independent-filtered-tables',
      layout: [
        {
          type: 'table',
          props: {
            headers: ['Display'],
            columns: [{ id: 'Display', filterable: true }],
            rows: {
              source: 'queries.searchUsers.data.results',
              cells: ['{{item.name}} ({{item.status}})'],
            },
          },
        },
        {
          type: 'table',
          props: {
            headers: ['Display'],
            columns: [{ id: 'Display', filterable: true }],
            rows: {
              source: 'queries.searchUsers.data.results',
              cells: ['{{item.name}} ({{item.status}})'],
            },
          },
        },
      ],
    }

    renderRuntimePageWithState(
      activePage,
      createRuntimePageState(activePage, {
        searchUsers: {
          status: 'success',
          data: {
            results: [
              { name: 'Ada', status: 'active' },
              { name: 'Grace', status: 'pending' },
            ],
          },
          error: null,
        },
      }),
    )

    const [firstTable, secondTable] = screen.getAllByRole('table')
    const [firstFilter] = screen.getAllByRole('searchbox', { name: 'Filtrar Display' })

    fireEvent.change(firstFilter, { target: { value: 'pending' } })

    expect(getTableBodyCellText(firstTable)).toEqual([['Grace (pending)']])
    expect(getTableBodyCellText(secondTable)).toEqual([['Ada (active)'], ['Grace (pending)']])
  })

  it('sorts configured table columns locally and exposes aria-sort on sortable headers', () => {
    const activePage: RuntimePageConfig = {
      id: 'sortable-table',
      layout: [
        {
          type: 'table',
          props: {
            headers: ['Name', 'Role', 'Visits'],
            columns: [
              { id: 'Name', sortable: true },
              { id: 'Role', sortable: true },
            ],
            rows: [
              ['Grace', 'Editor', 7],
              ['Ada', 'Admin', 12],
              ['Álvaro', 'Admin', 3],
            ],
          },
        },
      ],
    }
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    const { dispatch, dispatchAndSyncState } = renderRuntimePageWithState(activePage, createRuntimePageState(activePage, {}))
    const table = screen.getByRole('table')
    const [nameHeader, roleHeader, visitsHeader] = within(table).getAllByRole('columnheader')

    expect(within(table).getByRole('button', { name: 'Ordenar Name' })).toBeInTheDocument()
    expect(within(table).getByRole('button', { name: 'Ordenar Role' })).toBeInTheDocument()
    expect(within(table).queryByRole('button', { name: 'Ordenar Visits' })).not.toBeInTheDocument()
    expect(nameHeader).toHaveAttribute('aria-sort', 'none')
    expect(roleHeader).toHaveAttribute('aria-sort', 'none')
    expect(visitsHeader).not.toHaveAttribute('aria-sort')

    fireEvent.click(within(table).getByRole('button', { name: 'Ordenar Name' }))
    expect(nameHeader).toHaveAttribute('aria-sort', 'ascending')
    expect(getTableBodyCellText(table)).toEqual([
      ['Ada', 'Admin', '12'],
      ['Álvaro', 'Admin', '3'],
      ['Grace', 'Editor', '7'],
    ])

    fireEvent.click(within(table).getByRole('button', { name: 'Ordenar Name' }))
    expect(nameHeader).toHaveAttribute('aria-sort', 'descending')
    expect(getTableBodyCellText(table)).toEqual([
      ['Grace', 'Editor', '7'],
      ['Álvaro', 'Admin', '3'],
      ['Ada', 'Admin', '12'],
    ])

    fireEvent.click(within(table).getByRole('button', { name: 'Ordenar Name' }))
    expect(nameHeader).toHaveAttribute('aria-sort', 'none')
    expect(getTableBodyCellText(table)).toEqual([
      ['Grace', 'Editor', '7'],
      ['Ada', 'Admin', '12'],
      ['Álvaro', 'Admin', '3'],
    ])

    fireEvent.click(within(table).getByRole('button', { name: 'Ordenar Role' }))
    expect(nameHeader).toHaveAttribute('aria-sort', 'none')
    expect(roleHeader).toHaveAttribute('aria-sort', 'ascending')
    expect(getTableBodyCellText(table)).toEqual([
      ['Ada', 'Admin', '12'],
      ['Álvaro', 'Admin', '3'],
      ['Grace', 'Editor', '7'],
    ])
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(dispatch).not.toHaveBeenCalled()
    expect(dispatchAndSyncState).not.toHaveBeenCalled()
  })

  it('combines table filters before sorting and keeps sort state isolated between tables', () => {
    const activePage: RuntimePageConfig = {
      id: 'filtered-sorted-tables',
      layout: [
        {
          type: 'table',
          props: {
            headers: ['Name', 'Role'],
            columns: [
              { id: 'Name', sortable: true },
              { id: 'Role', filterable: true },
            ],
            rows: [
              ['Grace', 'Editor'],
              ['Ada', 'Admin'],
              ['Álvaro', 'Admin'],
            ],
          },
        },
        {
          type: 'table',
          props: {
            headers: ['Name', 'Role'],
            columns: [{ id: 'Name', sortable: true }],
            rows: [
              ['Grace', 'Editor'],
              ['Ada', 'Admin'],
            ],
          },
        },
      ],
    }

    renderRuntimePageWithState(activePage, createRuntimePageState(activePage, {}))

    const [firstTable, secondTable] = screen.getAllByRole('table')
    fireEvent.change(within(getTableLayoutNode(firstTable)).getByRole('searchbox', { name: 'Filtrar Role' }), {
      target: { value: 'admin' },
    })
    fireEvent.click(within(firstTable).getByRole('button', { name: 'Ordenar Name' }))
    fireEvent.click(within(secondTable).getByRole('button', { name: 'Ordenar Name' }))
    fireEvent.click(within(secondTable).getByRole('button', { name: 'Ordenar Name' }))

    expect(getTableBodyCellText(firstTable)).toEqual([
      ['Ada', 'Admin'],
      ['Álvaro', 'Admin'],
    ])
    expect(getTableBodyCellText(secondTable)).toEqual([
      ['Grace', 'Editor'],
      ['Ada', 'Admin'],
    ])
  })
})
