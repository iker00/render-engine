import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, Dispatch, SetStateAction } from 'react'
import type {
  RuntimeCollectionPaginationControlsVariant,
  TableCellNode,
  TableDynamicRows,
  TableLayoutNode,
} from '../../config/runtime-config'
import {
  createCollectionPaginationModel,
  createCollectionScrollWindow,
  createNumberedPaginationWindow,
} from '../runtime-collection-pagination'
import { resolveCollectionSourceItems } from '../runtime-collection-sources'
import {
  getNextTableSortState,
  processTableRows,
  resolveTableColumnConfigs,
  type ResolvedTableColumnConfig,
  type TableFilterValues,
  type TableSortState,
  type TableVisibleRow,
} from '../runtime-table-processing'
import {
  resolveRuntimeVisibleValue,
  type RuntimeIterationContext,
} from '../runtime-references/runtime-reference-resolver'
import {
  getTableBodyRowClassName,
  getTableCellClassName,
  getTableContainerClassName,
  getTableFilterControlsClassName,
  getTableFilterFieldClassName,
  getTableFilterInputClassName,
  getTableFilterLabelClassName,
  getTableFilterResetButtonClassName,
  getTableHeaderCellClassName,
  getTableNodeClassName,
  getTablePaginationButtonClassName,
  getTablePaginationControlsClassName,
  getTablePaginationCurrentButtonClassName,
  getTableScrollContainerClassName,
  getTableSortButtonClassName,
} from '../runtime-node-styling'
import { useRuntimeState } from '../runtime-state/runtime-state-provider'
import { LayoutNodeRenderer } from '../layout-node-renderer'
import { LayoutRenderer } from '../layout-renderer'

interface TableNodeProps {
  node: TableLayoutNode
  iterationContext?: RuntimeIterationContext
}

interface TablePaginationState {
  key: string
  activePage: number
  scrollVisibleCount: number
}

export function TableNode({ node, iterationContext }: TableNodeProps) {
  const state = useRuntimeState()
  const tableInstanceId = useId()
  const { rows, rowItemMap } = resolveTableRows(node, state, iterationContext)
  const [filterValues, setFilterValues] = useState<TableFilterValues>({})
  const [sortState, setSortState] = useState<TableSortState | null>(null)
  const pageSize = node.props.pagination?.pageSize
  const paginationControlsVariant = node.props.pagination?.controls?.variant ?? 'previousNext'
  const [paginationState, setPaginationState] = useState<TablePaginationState>({
    key: '',
    activePage: 1,
    scrollVisibleCount: 0,
  })
  const columns = useMemo(
    () => resolveTableColumnConfigs(node.props.headers, node.props.columns),
    [node.props.headers, node.props.columns],
  )
  const processedRows = useMemo(
    () => processTableRows(rows, columns, filterValues, sortState),
    [rows, columns, filterValues, sortState],
  )
  const processedRowsKey = useMemo(() => createRowsStateKey(processedRows), [processedRows])
  const paginationStateKey = `${paginationControlsVariant}:${pageSize ?? 'none'}:${processedRowsKey}`
  const activePage = paginationState.key === paginationStateKey ? paginationState.activePage : 1
  const scrollVisibleCount =
    paginationState.key === paginationStateKey ? paginationState.scrollVisibleCount : (pageSize ?? 0)
  const paginationModel = useMemo(
    () => (pageSize === undefined ? null : createCollectionPaginationModel(processedRows, pageSize)),
    [processedRows, pageSize],
  )
  const paginationPage = paginationControlsVariant === 'scroll' ? null : paginationModel?.getPage(activePage)
  const scrollWindow =
    paginationControlsVariant === 'scroll' && pageSize !== undefined
      ? createCollectionScrollWindow(processedRows, pageSize, scrollVisibleCount)
      : null
  const visibleRows = scrollWindow?.visibleItems ?? paginationPage?.visibleItems ?? processedRows
  const hasFilterableColumns = columns.some((column) => column.filterable)
  const hasActiveFilters = Object.values(filterValues).some((value) => value.trim().length > 0)
  const resetPagination = useCallback(() => {
    setPaginationState({
      key: paginationStateKey,
      activePage: 1,
      scrollVisibleCount: pageSize ?? 0,
    })
  }, [pageSize, paginationStateKey])
  const setActivePage = useCallback<Dispatch<SetStateAction<number>>>(
    (pageAction) => {
      setPaginationState((currentState) => {
        const currentActivePage = currentState.key === paginationStateKey ? currentState.activePage : 1
        const currentScrollVisibleCount =
          currentState.key === paginationStateKey ? currentState.scrollVisibleCount : (pageSize ?? 0)
        const nextActivePage = typeof pageAction === 'function' ? pageAction(currentActivePage) : pageAction

        return {
          key: paginationStateKey,
          activePage: nextActivePage,
          scrollVisibleCount: currentScrollVisibleCount,
        }
      })
    },
    [pageSize, paginationStateKey],
  )
  const resetFilters = useCallback(() => {
    setFilterValues({})
    resetPagination()
  }, [resetPagination])
  const showMoreRows = useCallback(() => {
    if (pageSize !== undefined) {
      setPaginationState((currentState) => {
        const currentActivePage = currentState.key === paginationStateKey ? currentState.activePage : 1
        const currentScrollVisibleCount =
          currentState.key === paginationStateKey ? currentState.scrollVisibleCount : pageSize

        return {
          key: paginationStateKey,
          activePage: currentActivePage,
          scrollVisibleCount: currentScrollVisibleCount + pageSize,
        }
      })
    }
  }, [pageSize, paginationStateKey])

  return (
    <div data-layout-node="table" className={getTableContainerClassName()}>
      {hasFilterableColumns
        ? renderFilterControls({
            tableInstanceId,
            columns,
            filterValues,
            hasActiveFilters,
            onFilterChange: (columnId, value) => {
              setFilterValues((currentValues) => ({
                ...currentValues,
                [columnId]: value,
              }))
              resetPagination()
            },
            onResetFilters: resetFilters,
          })
        : null}
      <div className={getTableScrollContainerClassName()}>
        <table className={getTableNodeClassName()}>
          <thead>
            <tr>
              {node.props.headers.map((header, index) =>
                renderHeaderCell({
                  header,
                  index,
                  column: findColumnByIndex(columns, index),
                  sortState,
                  onSort: (columnId) => {
                    setSortState((currentSort) => getNextTableSortState(currentSort, columnId))
                    resetPagination()
                  },
                }),
              )}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row, rowIndex) => {
              const rowItem = rowItemMap.get(row)
              const rowIterationContext: RuntimeIterationContext | undefined =
                rowItem !== undefined ? { item: rowItem, key: String(rowIndex), itemIndex: rowIndex } : undefined

              return (
                <tr key={`row-${rowIndex}`} className={getTableBodyRowClassName()}>
                  {row.map((cell, cellIndex) => (
                    <td key={`cell-${cellIndex}`} className={getTableCellClassName()}>
                      {isTableCellNode(cell) ? (
                        <LayoutNodeRenderer
                          node={cell}
                          iterationContext={rowIterationContext}
                          renderedChildren={
                            cell.type === 'container' && cell.children && cell.children.length > 0
                              ? <LayoutRenderer nodes={cell.children} iterationContext={rowIterationContext} />
                              : undefined
                          }
                        />
                      ) : (
                        cell
                      )}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {paginationPage && paginationPage.totalPages > 1
        ? renderPaginationControls({
            variant: paginationControlsVariant,
            currentPage: paginationPage.currentPage,
            totalPages: paginationPage.totalPages,
            canGoPrevious: paginationPage.canGoPrevious,
            canGoNext: paginationPage.canGoNext,
            setActivePage,
          })
        : null}
      {scrollWindow?.canShowMore && pageSize !== undefined ? <TableScrollControls onShowMore={showMoreRows} /> : null}
    </div>
  )
}

interface FilterControlsRenderOptions {
  tableInstanceId: string
  columns: readonly ResolvedTableColumnConfig[]
  filterValues: TableFilterValues
  hasActiveFilters: boolean
  onFilterChange: (columnId: string, value: string) => void
  onResetFilters: () => void
}

function renderFilterControls({
  tableInstanceId,
  columns,
  filterValues,
  hasActiveFilters,
  onFilterChange,
  onResetFilters,
}: FilterControlsRenderOptions) {
  const filterableColumns = [...columns].filter((column) => column.filterable).sort((left, right) => left.index - right.index)

  return (
    <div className={getTableFilterControlsClassName()} data-layout-node="table-filters" role="group" aria-label="Filtros de tabla">
      {filterableColumns.map((column) => {
        const inputId = `${tableInstanceId}-filter-${column.index}`

        return (
          <div key={column.id} className={getTableFilterFieldClassName()}>
            <label htmlFor={inputId} className={getTableFilterLabelClassName()}>
              Filtrar {column.header}
            </label>
            <input
              id={inputId}
              type="search"
              className={getTableFilterInputClassName()}
              placeholder={column.filterPlaceholder ?? column.header}
              value={filterValues[column.id] ?? ''}
              onChange={(event: ChangeEvent<HTMLInputElement>) => onFilterChange(column.id, event.target.value)}
            />
          </div>
        )
      })}
      {hasActiveFilters ? (
        <button type="button" className={getTableFilterResetButtonClassName()} onClick={onResetFilters}>
          Reiniciar filtros
        </button>
      ) : null}
    </div>
  )
}

interface HeaderCellRenderOptions {
  header: string
  index: number
  column?: ResolvedTableColumnConfig
  sortState: TableSortState | null
  onSort: (columnId: string) => void
}

function renderHeaderCell({ header, index, column, sortState, onSort }: HeaderCellRenderOptions) {
  const isSortable = column?.sortable === true
  const isActive = isSortable && sortState?.columnId === column.id
  const ariaSort = isSortable ? (isActive ? sortState.direction : 'none') : undefined

  return (
    <th key={`header-${index}`} scope="col" className={getTableHeaderCellClassName()} aria-sort={ariaSort}>
      {isSortable ? (
        <button
          type="button"
          className={getTableSortButtonClassName(isActive)}
          aria-label={`Ordenar ${header}`}
          onClick={() => onSort(column.id)}
        >
          <span>{header}</span>
          <span aria-hidden="true">{isActive ? getSortDirectionLabel(sortState.direction) : ''}</span>
        </button>
      ) : (
        header
      )}
    </th>
  )
}

function findColumnByIndex(columns: readonly ResolvedTableColumnConfig[], index: number) {
  return columns.find((column) => column.index === index)
}

function getSortDirectionLabel(direction: TableSortState['direction']) {
  return direction === 'ascending' ? 'Asc' : 'Desc'
}

interface TablePaginationControlsProps {
  variant: RuntimeCollectionPaginationControlsVariant
  currentPage: number
  totalPages: number
  canGoPrevious: boolean
  canGoNext: boolean
  setActivePage: Dispatch<SetStateAction<number>>
}

function renderPaginationControls({
  variant,
  currentPage,
  totalPages,
  canGoPrevious,
  canGoNext,
  setActivePage,
}: TablePaginationControlsProps) {
  if (variant === 'numbered') {
    const pageWindow = createNumberedPaginationWindow({ currentPage, totalPages })

    return (
      <div className={getTablePaginationControlsClassName()} data-layout-node="table-pagination">
        <button
          type="button"
          className={getTablePaginationButtonClassName()}
          disabled={!canGoPrevious}
          onClick={() => setActivePage(1)}
        >
          Primera
        </button>
        <button
          type="button"
          className={getTablePaginationButtonClassName()}
          disabled={!canGoPrevious}
          onClick={() => setActivePage((page) => Math.max(1, page - 1))}
        >
          Anterior
        </button>
        {pageWindow.map((page) => (
          <button
            key={page}
            type="button"
            className={page === currentPage ? getTablePaginationCurrentButtonClassName() : getTablePaginationButtonClassName()}
            aria-current={page === currentPage ? 'page' : undefined}
            onClick={() => setActivePage(page)}
          >
            {page}
          </button>
        ))}
        <button
          type="button"
          className={getTablePaginationButtonClassName()}
          disabled={!canGoNext}
          onClick={() => setActivePage((page) => Math.min(totalPages, page + 1))}
        >
          Siguiente
        </button>
        <button
          type="button"
          className={getTablePaginationButtonClassName()}
          disabled={!canGoNext}
          onClick={() => setActivePage(totalPages)}
        >
          Última
        </button>
      </div>
    )
  }

  return (
    <div className={getTablePaginationControlsClassName()} data-layout-node="table-pagination">
      <button
        type="button"
        className={getTablePaginationButtonClassName()}
        disabled={!canGoPrevious}
        onClick={() => setActivePage((page) => Math.max(1, page - 1))}
      >
        Anterior
      </button>
      <button
        type="button"
        className={getTablePaginationButtonClassName()}
        disabled={!canGoNext}
        onClick={() => setActivePage((page) => Math.min(totalPages, page + 1))}
      >
        Siguiente
      </button>
    </div>
  )
}

interface TableScrollControlsProps {
  onShowMore: () => void
}

function TableScrollControls({ onShowMore }: TableScrollControlsProps) {
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const hasIntersectionObserver = typeof globalThis.IntersectionObserver === 'function'

  useEffect(() => {
    const sentinel = sentinelRef.current

    if (!hasIntersectionObserver || !sentinel) {
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          onShowMore()
        }
      },
      {
        threshold: 0.75,
      },
    )

    observer.observe(sentinel)

    return () => {
      observer.disconnect()
    }
  }, [hasIntersectionObserver, onShowMore])

  if (!hasIntersectionObserver) {
    return (
      <div className={getTablePaginationControlsClassName()} data-layout-node="table-pagination">
        <button type="button" className={getTablePaginationButtonClassName()} onClick={onShowMore}>
          Mostrar más
        </button>
      </div>
    )
  }

  return (
    <div
      ref={sentinelRef}
      className={getTablePaginationControlsClassName()}
      data-layout-node="table-scroll-sentinel"
      aria-hidden="true"
    />
  )
}

function createRowsStateKey(rows: readonly TableVisibleRow[]) {
  return JSON.stringify(rows)
}

function isTableCellNode(cell: unknown): cell is TableCellNode {
  return typeof cell === 'object' && cell !== null && !Array.isArray(cell)
}

interface ResolvedTableRowsResult {
  rows: TableVisibleRow[]
  rowItemMap: Map<TableVisibleRow, unknown>
}

function resolveTableRows(
  node: TableLayoutNode,
  state: ReturnType<typeof useRuntimeState>,
  iterationContext?: RuntimeIterationContext,
): ResolvedTableRowsResult {
  const rowItemMap = new Map<TableVisibleRow, unknown>()

  if (Array.isArray(node.props.rows)) {
    const rows = node.props.rows.map((row) =>
      row.map((cell) => {
        // NodeObject: pass through as-is (TableCellNode)
        if (isTableCellNode(cell)) {
          return cell
        }

        // Primitive: resolve references (string may contain references, numbers/booleans normalize directly)
        if (typeof cell === 'string') {
          return normalizeTableCellValue(resolveRuntimeVisibleValue(cell, state, 'table.cell', { iterationContext }))
        }

        return normalizeTableCellValue(cell)
      }),
    )

    return { rows, rowItemMap }
  }

  const dynamicRows = node.props.rows as TableDynamicRows
  const items = resolveCollectionSourceItems(dynamicRows.source, state, { iterationContext })

  const rows = items.map((item, rowIndex) => {
    const row: (string | TableCellNode)[] = dynamicRows.cells.map((cell) => {
      // NodeObject: pass through as-is (TableCellNode), item context applied at render time
      if (isTableCellNode(cell)) {
        return cell
      }

      return normalizeTableCellValue(
        resolveRuntimeVisibleValue(cell, state, 'table.cell', {
          iterationContext: {
            item,
            key: String(rowIndex),
          },
        }),
      )
    })

    rowItemMap.set(row as unknown as TableVisibleRow, item)
    return row as unknown as TableVisibleRow
  })

  return { rows, rowItemMap }
}

function normalizeTableCellValue(value: string | number | boolean) {
  if (typeof value === 'string') {
    return value
  }

  return String(value)
}
