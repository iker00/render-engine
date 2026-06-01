import { act, render, screen, fireEvent, within } from '@testing-library/react'
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
  it('paginates table rows with previous and next controls outside the table body', () => {
    const activePage: RuntimePageConfig = {
      id: 'paginated-table',
      layout: [
        {
          type: 'table',
          props: {
            headers: ['Name'],
            rows: [['Ada'], ['Grace'], ['Lin'], ['Katherine'], ['Evelyn']],
            pagination: {
              enabled: true,
              pageSize: 2,
            },
          },
        },
      ],
    }
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    const { dispatch, dispatchAndSyncState } = renderRuntimePageWithState(activePage, createRuntimePageState(activePage, {}))
    const table = screen.getByRole('table')
    const previousButton = screen.getByRole('button', { name: 'Anterior' })
    const nextButton = screen.getByRole('button', { name: 'Siguiente' })

    expect(getTableBodyCellText(table)).toEqual([['Ada'], ['Grace']])
    expect(previousButton).toBeDisabled()
    expect(nextButton).toBeEnabled()
    expect(table.querySelector('tbody')?.contains(previousButton)).toBe(false)

    fireEvent.click(nextButton)
    expect(getTableBodyCellText(table)).toEqual([['Lin'], ['Katherine']])
    expect(previousButton).toBeEnabled()

    fireEvent.click(nextButton)
    expect(getTableBodyCellText(table)).toEqual([['Evelyn']])
    expect(nextButton).toBeDisabled()

    fireEvent.click(nextButton)
    expect(getTableBodyCellText(table)).toEqual([['Evelyn']])

    fireEvent.click(previousButton)
    fireEvent.click(previousButton)
    expect(getTableBodyCellText(table)).toEqual([['Ada'], ['Grace']])
    expect(previousButton).toBeDisabled()
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(dispatch).not.toHaveBeenCalled()
    expect(dispatchAndSyncState).not.toHaveBeenCalled()
  })

  it('uses previousNext as the table pagination default when controls are empty', () => {
    const activePage: RuntimePageConfig = {
      id: 'paginated-table-default-controls',
      layout: [
        {
          type: 'table',
          props: {
            headers: ['Name'],
            rows: [['Ada'], ['Grace'], ['Lin']],
            pagination: {
              enabled: true,
              pageSize: 2,
              controls: {},
            },
          },
        },
      ],
    }

    renderRuntimePageWithState(activePage, createRuntimePageState(activePage, {}))

    expect(getTableBodyCellText(screen.getByRole('table'))).toEqual([['Ada'], ['Grace']])
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeEnabled()
  })

  it('renders numbered table pagination with a compact page window', () => {
    const activePage: RuntimePageConfig = {
      id: 'numbered-table',
      layout: [
        {
          type: 'table',
          props: {
            headers: ['Name'],
            rows: Array.from({ length: 8 }, (_, index) => [`User ${index + 1}`]),
            pagination: {
              enabled: true,
              pageSize: 1,
              controls: {
                variant: 'numbered',
              },
            },
          },
        },
      ],
    }

    renderRuntimePageWithState(activePage, createRuntimePageState(activePage, {}))
    const table = screen.getByRole('table')

    expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual([
      'Primera',
      'Anterior',
      '1',
      '2',
      '3',
      '4',
      '5',
      'Siguiente',
      'Última',
    ])
    expect(screen.getByRole('button', { name: '1' })).toHaveAttribute('aria-current', 'page')
    expect(getTableBodyCellText(table)).toEqual([['User 1']])

    fireEvent.click(screen.getByRole('button', { name: '2' }))
    expect(screen.getByRole('button', { name: '2' })).toHaveAttribute('aria-current', 'page')
    expect(getTableBodyCellText(table)).toEqual([['User 2']])

    fireEvent.click(screen.getByRole('button', { name: 'Última' }))
    expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual([
      'Primera',
      'Anterior',
      '4',
      '5',
      '6',
      '7',
      '8',
      'Siguiente',
      'Última',
    ])
    expect(screen.getByRole('button', { name: '8' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Última' })).toBeDisabled()
    expect(getTableBodyCellText(table)).toEqual([['User 8']])
  })

  it('hides table pagination controls for zero or single effective pages', () => {
    const activePage: RuntimePageConfig = {
      id: 'single-page-tables',
      layout: [
        {
          type: 'table',
          props: {
            headers: ['Name'],
            rows: [['Ada']],
            pagination: {
              enabled: true,
              pageSize: 2,
            },
          },
        },
        {
          type: 'table',
          props: {
            headers: ['Name'],
            columns: [{ id: 'Name', filterable: true }],
            rows: [['Ada']],
            pagination: {
              enabled: true,
              pageSize: 2,
            },
          },
        },
      ],
    }

    renderRuntimePageWithState(activePage, createRuntimePageState(activePage, {}))
    fireEvent.change(screen.getByRole('searchbox', { name: 'Filtrar Name' }), { target: { value: 'missing' } })

    expect(screen.queryByRole('button', { name: 'Anterior' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Siguiente' })).not.toBeInTheDocument()
  })

  it('paginates after filtering and sorting and resets table pages when processing changes', () => {
    const activePage: RuntimePageConfig = {
      id: 'processed-paginated-table',
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
              ['Lin', 'Admin'],
              ['Evelyn', 'Admin'],
            ],
            pagination: {
              enabled: true,
              pageSize: 2,
            },
          },
        },
      ],
    }

    renderRuntimePageWithState(activePage, createRuntimePageState(activePage, {}))
    const table = screen.getByRole('table')

    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    expect(getTableBodyCellText(table)).toEqual([
      ['Álvaro', 'Admin'],
      ['Lin', 'Admin'],
    ])

    fireEvent.change(within(getTableLayoutNode(table)).getByRole('searchbox', { name: 'Filtrar Role' }), {
      target: { value: 'admin' },
    })
    expect(getTableBodyCellText(table)).toEqual([
      ['Ada', 'Admin'],
      ['Álvaro', 'Admin'],
    ])

    fireEvent.click(within(table).getByRole('button', { name: 'Ordenar Name' }))
    expect(getTableBodyCellText(table)).toEqual([
      ['Ada', 'Admin'],
      ['Álvaro', 'Admin'],
    ])
  })

  it('keeps table pagination state isolated between table instances', () => {
    const activePage: RuntimePageConfig = {
      id: 'independent-paginated-tables',
      layout: [
        {
          type: 'table',
          props: {
            headers: ['Name'],
            rows: [['Ada'], ['Grace'], ['Lin']],
            pagination: {
              enabled: true,
              pageSize: 1,
            },
          },
        },
        {
          type: 'table',
          props: {
            headers: ['Name'],
            rows: [['Ada'], ['Grace'], ['Lin']],
            pagination: {
              enabled: true,
              pageSize: 1,
            },
          },
        },
      ],
    }

    renderRuntimePageWithState(activePage, createRuntimePageState(activePage, {}))
    const [firstTable, secondTable] = screen.getAllByRole('table')
    const [firstNextButton] = screen.getAllByRole('button', { name: 'Siguiente' })

    fireEvent.click(firstNextButton)

    expect(getTableBodyCellText(firstTable)).toEqual([['Grace']])
    expect(getTableBodyCellText(secondTable)).toEqual([['Ada']])
  })

  it('increments table scroll pagination locally with the fallback action', () => {
    vi.stubGlobal('IntersectionObserver', undefined)
    const activePage: RuntimePageConfig = {
      id: 'scroll-table-fallback',
      layout: [
        {
          type: 'table',
          props: {
            headers: ['Name'],
            rows: [['Ada'], ['Grace'], ['Lin'], ['Katherine'], ['Evelyn']],
            pagination: {
              enabled: true,
              pageSize: 2,
              controls: {
                variant: 'scroll',
              },
            },
          },
        },
      ],
    }
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    const { dispatch, dispatchAndSyncState } = renderRuntimePageWithState(activePage, createRuntimePageState(activePage, {}))
    const table = screen.getByRole('table')

    expect(getTableBodyCellText(table)).toEqual([['Ada'], ['Grace']])

    fireEvent.click(screen.getByRole('button', { name: 'Mostrar más' }))
    expect(getTableBodyCellText(table)).toEqual([['Ada'], ['Grace'], ['Lin'], ['Katherine']])

    fireEvent.click(screen.getByRole('button', { name: 'Mostrar más' }))
    expect(getTableBodyCellText(table)).toEqual([['Ada'], ['Grace'], ['Lin'], ['Katherine'], ['Evelyn']])
    expect(screen.queryByRole('button', { name: 'Mostrar más' })).not.toBeInTheDocument()
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(dispatch).not.toHaveBeenCalled()
    expect(dispatchAndSyncState).not.toHaveBeenCalled()
  })

  it('increments table scroll pagination through IntersectionObserver and resets on filters', () => {
    let observerCallback: IntersectionObserverCallback | null = null
    const observe = vi.fn()
    const disconnect = vi.fn()

    vi.stubGlobal(
      'IntersectionObserver',
      vi.fn((callback: IntersectionObserverCallback) => {
        observerCallback = callback

        return {
          observe,
          disconnect,
          unobserve: vi.fn(),
          takeRecords: vi.fn(() => []),
        }
      }),
    )

    const activePage: RuntimePageConfig = {
      id: 'scroll-table-observer',
      layout: [
        {
          type: 'table',
          props: {
            headers: ['Name', 'Role'],
            columns: [{ id: 'Role', filterable: true }],
            rows: [
              ['Ada', 'Admin'],
              ['Grace', 'Editor'],
              ['Lin', 'Admin'],
              ['Katherine', 'Editor'],
              ['Evelyn', 'Admin'],
            ],
            pagination: {
              enabled: true,
              pageSize: 2,
              controls: {
                variant: 'scroll',
              },
            },
          },
        },
      ],
    }

    renderRuntimePageWithState(activePage, createRuntimePageState(activePage, {}))
    const table = screen.getByRole('table')

    expect(observe).toHaveBeenCalled()
    expect(document.querySelector('[data-layout-node="table-scroll-sentinel"]')).toBeInTheDocument()
    expect(getTableBodyCellText(table)).toEqual([
      ['Ada', 'Admin'],
      ['Grace', 'Editor'],
    ])

    act(() => {
      observerCallback?.([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver)
    })
    expect(getTableBodyCellText(table)).toEqual([
      ['Ada', 'Admin'],
      ['Grace', 'Editor'],
      ['Lin', 'Admin'],
      ['Katherine', 'Editor'],
    ])

    fireEvent.change(within(getTableLayoutNode(table)).getByRole('searchbox', { name: 'Filtrar Role' }), {
      target: { value: 'admin' },
    })
    expect(getTableBodyCellText(table)).toEqual([
      ['Ada', 'Admin'],
      ['Lin', 'Admin'],
    ])

    act(() => {
      observerCallback?.([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver)
    })
    expect(getTableBodyCellText(table)).toEqual([
      ['Ada', 'Admin'],
      ['Lin', 'Admin'],
      ['Evelyn', 'Admin'],
    ])
    expect(document.querySelector('[data-layout-node="table-scroll-sentinel"]')).not.toBeInTheDocument()
    expect(disconnect).toHaveBeenCalled()
  })

  it('keeps scroll table state isolated inside repeater iterations using item sources', () => {
    vi.stubGlobal('IntersectionObserver', undefined)
    const activePage: RuntimePageConfig = {
      id: 'scroll-table-repeater',
      layout: [
        {
          type: 'repeater',
          props: {
            items: {
              source: 'queries.departments.data',
              key: 'id',
            },
            template: [
              {
                type: 'table',
                props: {
                  headers: ['Member'],
                  rows: {
                    source: 'item.members',
                    cells: ['item.name'],
                  },
                  pagination: {
                    enabled: true,
                    pageSize: 1,
                    controls: {
                      variant: 'scroll',
                    },
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
            { id: 'dept-1', members: [{ name: 'Ada' }, { name: 'Grace' }] },
            { id: 'dept-2', members: [{ name: 'Lin' }, { name: 'Katherine' }] },
          ],
          error: null,
        },
      }),
    )

    const [firstTable, secondTable] = screen.getAllByRole('table')
    const [firstShowMore] = screen.getAllByRole('button', { name: 'Mostrar más' })

    fireEvent.click(firstShowMore)

    expect(getTableBodyCellText(firstTable)).toEqual([['Ada'], ['Grace']])
    expect(getTableBodyCellText(secondTable)).toEqual([['Lin']])
  })

  it('renders tables inside repeaters using item.* as the dynamic source context and degrades missing collections to zero body rows', () => {
    const activePage: RuntimePageConfig = {
      id: 'department-tables',
      layout: [
        {
          type: 'repeater',
          props: {
            items: {
              source: 'queries.departments.data',
              key: 'id',
            },
            template: [
              {
                type: 'heading',
                props: {
                  text: 'item.name',
                  level: 2,
                },
              },
              {
                type: 'table',
                props: {
                  headers: ['Member', 'Role'],
                  rows: {
                    source: 'item.members',
                    cells: ['item.name', 'item.role'],
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
              id: 'dept-1',
              name: 'Engineering',
              members: [
                { name: 'Ada', role: 'Lead' },
                { name: 'Grace', role: 'Reviewer' },
              ],
            },
            {
              id: 'dept-2',
              name: 'Operations',
            },
          ],
          error: null,
        },
      }),
    )

    expect(screen.getAllByRole('heading', { level: 2 }).map((item) => item.textContent)).toEqual(['Engineering', 'Operations'])

    const tables = screen.getAllByRole('table')
    expect(within(tables[0]).getAllByRole('row').slice(1)).toHaveLength(2)
    expect(within(tables[0]).getAllByRole('cell').map((cell) => cell.textContent)).toEqual(['Ada', 'Lead', 'Grace', 'Reviewer'])
    expect(within(tables[1]).queryAllByRole('row').slice(1)).toHaveLength(0)
  })
})
