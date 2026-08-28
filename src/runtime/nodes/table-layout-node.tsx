import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, Dispatch, SetStateAction } from 'react'
import type {
  TableCellNode,
  TableCellValue,
  TableDynamicRows,
  TableLayoutNode,
} from '../../config/runtime-config'
import {
  createCollectionPaginationModel,
  createCollectionScrollWindow,
} from '../runtime-collection-pagination'
import { CollectionPaginationControls } from './collection-pagination-controls'
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
import { useRuntimeState } from '../runtime-state/use-runtime-state'
import { LayoutNodeRenderer } from '../layout-node-renderer'
import { LayoutRenderer, EmptyContainerPlaceholder } from '../layout-renderer'
import { hasChildren, isEmptyPlaceholderCandidate } from '../layout-node-children'
import { useLayoutEditModeContext } from '../use-layout-edit-mode-context'
import type { LayoutNodePath } from '../layout-node-path'

interface TableNodeProps {
  node: TableLayoutNode
  iterationContext?: RuntimeIterationContext
  path?: LayoutNodePath
}

interface TablePaginationState {
  key: string
  activePage: number
  scrollVisibleCount: number
}

export function TableNode({ node, iterationContext, path }: TableNodeProps) {
  const state = useRuntimeState()
  const tableInstanceId = useId()
  const basePath = path ?? []
  const editModeContext = useLayoutEditModeContext()
  const activeEditModeContext = editModeContext !== null && editModeContext.active ? editModeContext : null
  const isManualTableMode = Array.isArray(node.props.rows)
  // Memoized so its identity is stable across renders that don't change these inputs (e.g. a
  // local sort/filter/pagination interaction) — `processedRows` below depends on `rows`, and an
  // unmemoized `rows` (a fresh array every render) would defeat that memoization entirely.
  const { rows, rowItemMap, rowOriginalIndexMap } = useMemo(
    () => resolveTableRows(node, state, iterationContext),
    [node, state, iterationContext],
  )
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
              const rowIterationContext: RuntimeIterationContext = {
                ...iterationContext,
                ...(rowItem !== undefined ? { row: rowItem } : {}),
                rowIndex: rowIndex + 1,
              }

              return (
                <tr key={`row-${rowIndex}`} className={getTableBodyRowClassName()}>
                  {row.map((cell, cellIndex) => {
                    const cellPath: LayoutNodePath = isManualTableMode
                      ? [...basePath, { field: 'row', rowIndex: rowOriginalIndexMap.get(row)!, index: cellIndex }]
                      : [...basePath, { field: 'cells', index: cellIndex }]

                    return (
                      <td key={`cell-${cellIndex}`} className={getTableCellClassName()}>
                        {isTableCellNode(cell) ? (
                          <LayoutNodeRenderer
                            node={cell}
                            iterationContext={rowIterationContext}
                            path={cellPath}
                            renderedChildren={
                              hasChildren(cell)
                                ? activeEditModeContext !== null && isEmptyPlaceholderCandidate(cell)
                                  ? (
                                      <EmptyContainerPlaceholder
                                        nodeType={cell.type}
                                        path={cellPath}
                                        editModeContext={activeEditModeContext}
                                      />
                                    )
                                  : (
                                      <LayoutRenderer
                                        nodes={cell.children ?? []}
                                        iterationContext={rowIterationContext}
                                        path={cellPath}
                                      />
                                    )
                                : undefined
                            }
                          />
                        ) : (
                          resolveTableCellDisplayValue(
                            cell,
                            isManualTableMode
                              ? (node.props.rows as TableCellValue[][])[rowOriginalIndexMap.get(row)!][cellIndex]
                              : (node.props.rows as TableDynamicRows).cells[cellIndex],
                            state,
                            rowIterationContext,
                          )
                        )}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {paginationPage && paginationPage.totalPages > 1 ? (
        <CollectionPaginationControls
          variant={paginationControlsVariant}
          currentPage={paginationPage.currentPage}
          totalPages={paginationPage.totalPages}
          canGoPrevious={paginationPage.canGoPrevious}
          canGoNext={paginationPage.canGoNext}
          setActivePage={setActivePage}
          dataLayoutNode="table-pagination"
          containerClassName={getTablePaginationControlsClassName}
          buttonClassName={getTablePaginationButtonClassName}
          currentButtonClassName={getTablePaginationCurrentButtonClassName}
        />
      ) : null}
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
  // Maps each resolved row (by object identity) back to its real index in `node.props.rows`
  // (manual mode) or in the `items` iteration (dynamic mode) — see T3/design.md: filtering,
  // sorting and pagination reorder/discard positions while preserving row object identity, so
  // the final rendering index (`visibleRows.map((row, i) => ...)`) no longer matches the real
  // position in `props.rows` once any of those is active. A cell's path must always address the
  // real position, never the post-processing visual one.
  rowOriginalIndexMap: Map<TableVisibleRow, number>
}

function resolveTableRows(
  node: TableLayoutNode,
  state: ReturnType<typeof useRuntimeState>,
  iterationContext?: RuntimeIterationContext,
): ResolvedTableRowsResult {
  const rowItemMap = new Map<TableVisibleRow, unknown>()
  const rowOriginalIndexMap = new Map<TableVisibleRow, number>()

  if (Array.isArray(node.props.rows)) {
    const rows = node.props.rows.map((row, rowIndex) => {
      const resolvedRow = row.map((cell) => {
        // NodeObject: pass through as-is (TableCellNode)
        if (isTableCellNode(cell)) {
          return cell
        }

        // Primitive: resolve references (string may contain references, numbers/booleans normalize directly)
        if (typeof cell === 'string') {
          return normalizeTableCellValue(resolveRuntimeVisibleValue(cell, state, 'table.cell', { iterationContext }))
        }

        return normalizeTableCellValue(cell)
      })

      rowOriginalIndexMap.set(resolvedRow as unknown as TableVisibleRow, rowIndex)
      return resolvedRow
    })

    return { rows, rowItemMap, rowOriginalIndexMap }
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
            ...iterationContext,
            row: item,
          },
        }),
      )
    })

    rowItemMap.set(row as unknown as TableVisibleRow, item)
    rowOriginalIndexMap.set(row as unknown as TableVisibleRow, rowIndex)
    return row as unknown as TableVisibleRow
  })

  return { rows, rowItemMap, rowOriginalIndexMap }
}

function normalizeTableCellValue(value: string | number | boolean) {
  if (typeof value === 'string') {
    return value
  }

  return String(value)
}

// The value already resolved in Phase A (`resolveTableRows`) is used as the filter/sort
// comparison key, but it can't carry the final visible `rowIndex` (unknown until after
// filter/sort/pagination are applied). Re-resolve string cell templates here, in Phase B, with
// `rowIterationContext` so that `row.$index` reflects the row's actual visible position.
// Non-string templates (number/boolean, manual mode only) have no reference to resolve, so the
// Phase A value is reused as-is.
function resolveTableCellDisplayValue(
  cell: string,
  rawCell: TableCellValue,
  state: ReturnType<typeof useRuntimeState>,
  rowIterationContext: RuntimeIterationContext,
) {
  if (typeof rawCell !== 'string') {
    return cell
  }

  return normalizeTableCellValue(
    resolveRuntimeVisibleValue(rawCell, state, 'table.cell', { iterationContext: rowIterationContext }),
  )
}
