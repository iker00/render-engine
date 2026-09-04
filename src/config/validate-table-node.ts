import type {
  LayoutNodeFeedbackFields,
  RuntimeCollectionPaginationConfig,
  RuntimeConfigError,
  TableCellNode,
  TableCellValue,
  TableColumnConfig,
  TableDynamicRows,
  TableLayoutNode,
} from './runtime-config-types'
import { tableCellAllowedNodeTypes, tableNodeSchema } from './runtime-config-zod'
import type { BreadcrumbSegment } from './validation-breadcrumb'
import { enrichedInvalidLayout, enrichErrorResult } from './validation-breadcrumb'
import { validateLayoutNode, validateQueryStateFeedback } from './validate-layout-nodes-core'
import { mapLeafNodeIssue } from './validate-layout-issue-mapping'
import { mapQueryStateFeedbackIssue, mapVisibilityIssue, validateVisibility } from './validate-actions-visibility'
import { mapCollectionPaginationIssue } from './validate-repeater-node'
import { validateCollectionSource } from './validate-collection-source'
import { isNonEmptyString, isRecord } from './validate-node-shared-helpers'

export function validateTableNode(
  rawNode: Record<string, unknown>,
  path: string,
  pageId: string,
  breadcrumb: BreadcrumbSegment[] = [],
): { status: 'ready'; node: TableLayoutNode } | { status: 'error'; error: RuntimeConfigError } {
  const parseResult = tableNodeSchema.safeParse(rawNode)

  if (!parseResult.success) {
    const issue = parseResult.error.issues[0]
    const feedbackIssue = mapQueryStateFeedbackIssue(pageId, path, issue)

    if (feedbackIssue) {
      return enrichErrorResult(feedbackIssue, breadcrumb, rawNode)
    }

    const visibilityIssue = mapVisibilityIssue(pageId, path, issue)

    if (visibilityIssue) {
      return enrichErrorResult(visibilityIssue, breadcrumb, rawNode)
    }

    const columnsIssue = mapTableColumnsIssue(pageId, path, issue, breadcrumb, rawNode)

    if (columnsIssue) {
      return columnsIssue
    }

    const paginationIssue = mapCollectionPaginationIssue(pageId, path, issue, breadcrumb, rawNode)

    if (paginationIssue) {
      return paginationIssue
    }

    return mapLeafNodeIssue(pageId, path, issue?.path ?? [], breadcrumb, rawNode)
  }

  const feedbackResult = validateQueryStateFeedback(
    parseResult.data.queryStateFeedback as LayoutNodeFeedbackFields['queryStateFeedback'],
    `${path}.queryStateFeedback`,
    pageId,
    breadcrumb,
  )

  if (feedbackResult.status === 'error') {
    return feedbackResult
  }

  const visibilityResult = validateVisibility(
    parseResult.data.visibility as LayoutNodeFeedbackFields['visibility'],
    `${path}.visibility`,
    pageId,
  )

  if (visibilityResult.status === 'error') {
    return enrichErrorResult(visibilityResult, breadcrumb, rawNode)
  }

  const headersResult = validateTableHeaders(parseResult.data.props.headers, `${path}.props.headers`, pageId)

  if (headersResult.status === 'error') {
    return headersResult
  }

  const rowsResult = validateTableRows(parseResult.data.props.rows, headersResult.headers.length, `${path}.props.rows`, pageId)

  if (rowsResult.status === 'error') {
    return rowsResult
  }

  const columnsResult = validateTableColumns(
    parseResult.data.props.columns as TableColumnConfig[] | undefined,
    headersResult.headers,
    `${path}.props.columns`,
    pageId,
  )

  if (columnsResult.status === 'error') {
    return columnsResult
  }

  const props: TableLayoutNode['props'] = {
    headers: headersResult.headers,
    rows: rowsResult.rows,
  }

  if (columnsResult.columns !== undefined) {
    props.columns = columnsResult.columns
  }

  if (parseResult.data.props.pagination !== undefined) {
    props.pagination = parseResult.data.props.pagination as RuntimeCollectionPaginationConfig
  }

  return {
    status: 'ready',
    node: {
      type: 'table',
      id: parseResult.data.id,
      queryStateFeedback: feedbackResult.queryStateFeedback,
      visibility: visibilityResult.visibility,
      layout: parseResult.data.layout,
      props,
    },
  }
}

function mapTableColumnsIssue(
  pageId: string,
  path: string,
  issue: { path: PropertyKey[]; code?: string; keys?: string[] } | undefined,
  breadcrumb: BreadcrumbSegment[] = [],
  rawNode: Record<string, unknown> = {},
): { status: 'error'; error: RuntimeConfigError } | null {
  const issuePath = issue?.path ?? []

  if (issuePath[0] !== 'props' || issuePath[1] !== 'columns') {
    return null
  }

  const issueKeys = issue?.code === 'unrecognized_keys' && Array.isArray(issue.keys) ? issue.keys : []

  if (issueKeys.length > 0) {
    if (typeof issuePath[2] === 'number') {
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.columns[${issuePath[2]}].${issueKeys[0]}".`, breadcrumb, rawNode)
    }

    return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.columns.${issueKeys[0]}".`, breadcrumb, rawNode)
  }

  if (typeof issuePath[2] === 'number') {
    const columnPath = `${path}.props.columns[${issuePath[2]}]`

    if (
      issuePath[3] === 'id' ||
      issuePath[3] === 'filterable' ||
      issuePath[3] === 'filterPlaceholder' ||
      issuePath[3] === 'sortable'
    ) {
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${columnPath}.${String(issuePath[3])}".`, breadcrumb, rawNode)
    }

    return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${columnPath}".`, breadcrumb, rawNode)
  }

  return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.columns".`, breadcrumb, rawNode)
}

function validateTableHeaders(
  rawHeaders: unknown,
  path: string,
  pageId: string,
  breadcrumb: BreadcrumbSegment[] = [],
  rawNode: Record<string, unknown> = {},
): { status: 'ready'; headers: string[] } | { status: 'error'; error: RuntimeConfigError } {
  if (!Array.isArray(rawHeaders) || rawHeaders.length === 0) {
    return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}".`, breadcrumb, rawNode)
  }

  const headers: string[] = []

  for (let index = 0; index < rawHeaders.length; index += 1) {
    if (!isNonEmptyString(rawHeaders[index])) {
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}".`, breadcrumb, rawNode)
    }

    headers.push(rawHeaders[index])
  }

  return {
    status: 'ready',
    headers,
  }
}

function validateTableColumns(
  columns: TableColumnConfig[] | undefined,
  headers: string[],
  path: string,
  pageId: string,
  breadcrumb: BreadcrumbSegment[] = [],
  rawNode: Record<string, unknown> = {},
): { status: 'ready'; columns?: TableColumnConfig[] } | { status: 'error'; error: RuntimeConfigError } {
  if (columns === undefined) {
    return {
      status: 'ready',
    }
  }

  const seenColumnIds = new Set<string>()

  for (let index = 0; index < columns.length; index += 1) {
    const column = columns[index]
    const columnPath = `${path}[${index}]`

    if (seenColumnIds.has(column.id)) {
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${columnPath}.id".`, breadcrumb, rawNode)
    }

    seenColumnIds.add(column.id)

    const matchingHeaders = headers.filter((header) => header === column.id)

    if (matchingHeaders.length !== 1) {
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${columnPath}.id".`, breadcrumb, rawNode)
    }

    if (column.filterable !== true && column.sortable !== true) {
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${columnPath}".`, breadcrumb, rawNode)
    }

    if (column.filterPlaceholder !== undefined && column.filterable !== true) {
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${columnPath}.filterPlaceholder".`, breadcrumb, rawNode)
    }
  }

  return {
    status: 'ready',
    columns,
  }
}

function validateTableRows(
  rawRows: unknown,
  headersLength: number,
  path: string,
  pageId: string,
  breadcrumb: BreadcrumbSegment[] = [],
  rawNode: Record<string, unknown> = {},
): { status: 'ready'; rows: TableLayoutNode['props']['rows'] } | { status: 'error'; error: RuntimeConfigError } {
  if (Array.isArray(rawRows)) {
    return validateTableManualRows(rawRows, headersLength, path, pageId)
  }

  if (!isRecord(rawRows)) {
    return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}".`, breadcrumb, rawNode)
  }

  return validateTableDynamicRows(rawRows, headersLength, path, pageId)
}

export function validateTableCellNode(
  rawCell: unknown,
  path: string,
  pageId: string,
  breadcrumb: BreadcrumbSegment[] = [],
): { status: 'ready'; node: TableCellNode } | { status: 'error'; error: RuntimeConfigError } {
  if (!isRecord(rawCell)) {
    return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.type".`, breadcrumb, isRecord(rawCell) ? rawCell : {})
  }

  const cellType = rawCell.type

  // Step 1: validate type is a non-empty string within the allowed subset
  if (typeof cellType !== 'string' || cellType.trim().length === 0 || !(tableCellAllowedNodeTypes as readonly string[]).includes(cellType)) {
    return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.type".`, breadcrumb, isRecord(rawCell) ? rawCell : {})
  }

  // Step 2: if container, recursively check all descendants for allowed subset before delegating to validateLayoutNode
  if (cellType === 'container') {
    const childrenCheck = checkContainerChildrenSubset(rawCell.children, `${path}.children`, pageId)

    if (childrenCheck !== null) {
      return childrenCheck
    }
  }

  // Step 3: delegate to validateLayoutNode for full contract validation (props, visibility, queryStateFeedback, layout)
  const nodeResult = validateLayoutNode(rawCell, path, pageId, breadcrumb)

  if (nodeResult.status === 'error') {
    return nodeResult
  }

  return {
    status: 'ready',
    node: nodeResult.node as TableCellNode,
  }
}

function checkContainerChildrenSubset(
  children: unknown,
  path: string,
  pageId: string,
  breadcrumb: BreadcrumbSegment[] = [],
): { status: 'error'; error: RuntimeConfigError } | null {
  if (!Array.isArray(children)) {
    return null
  }

  for (let i = 0; i < children.length; i += 1) {
    const child = children[i]

    if (!isRecord(child)) {
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}[${i}].type".`, breadcrumb, isRecord(child) ? child : {})
    }

    const childType = child.type

    if (typeof childType !== 'string' || childType.trim().length === 0 || !(tableCellAllowedNodeTypes as readonly string[]).includes(childType)) {
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}[${i}].type".`, breadcrumb, isRecord(child) ? child : {})
    }

    // Recurse into nested containers
    if (childType === 'container') {
      const nestedCheck = checkContainerChildrenSubset(child.children, `${path}[${i}].children`, pageId, breadcrumb)

      if (nestedCheck !== null) {
        return nestedCheck
      }
    }
  }

  return null
}

function validateTableManualRows(
  rawRows: unknown[],
  headersLength: number,
  path: string,
  pageId: string,
  breadcrumb: BreadcrumbSegment[] = [],
  rawNode: Record<string, unknown> = {},
): { status: 'ready'; rows: TableLayoutNode['props']['rows'] } | { status: 'error'; error: RuntimeConfigError } {
  const rows: TableCellValue[][] = []

  for (let rowIndex = 0; rowIndex < rawRows.length; rowIndex += 1) {
    const rawRow = rawRows[rowIndex]

    if (!Array.isArray(rawRow)) {
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}[${rowIndex}]".`, breadcrumb, rawNode)
    }

    if (rawRow.length !== headersLength) {
      return enrichedInvalidLayout(
        `Page "${pageId}" has an invalid layout at "${path}[${rowIndex}]": table rows must have exactly ${headersLength} cells to match headers.`,
        breadcrumb,
        rawNode,
      )
    }

    const row: TableCellValue[] = []

    for (let cellIndex = 0; cellIndex < rawRow.length; cellIndex += 1) {
      const rawCell = rawRow[cellIndex]
      const cellPath = `${path}[${rowIndex}][${cellIndex}]`

      if (isTableCellPrimitive(rawCell)) {
        row.push(rawCell)
      } else if (isRecord(rawCell)) {
        const cellResult = validateTableCellNode(rawCell, cellPath, pageId)

        if (cellResult.status === 'error') {
          return cellResult
        }

        row.push(cellResult.node)
      } else {
        return enrichedInvalidLayout(
          `Page "${pageId}" has an invalid layout at "${cellPath}": table cells only accept string, number, boolean or node values.`,
          breadcrumb,
          rawNode,
        )
      }
    }

    rows.push(row)
  }

  return {
    status: 'ready',
    rows,
  }
}

function validateTableDynamicRows(
  rawRows: Record<string, unknown>,
  headersLength: number,
  path: string,
  pageId: string,
  breadcrumb: BreadcrumbSegment[] = [],
  rawNode: Record<string, unknown> = {},
): { status: 'ready'; rows: TableDynamicRows } | { status: 'error'; error: RuntimeConfigError } {
  const hasSource = Object.prototype.hasOwnProperty.call(rawRows, 'source')
  const hasCells = Object.prototype.hasOwnProperty.call(rawRows, 'cells')

  if ('values' in rawRows || !hasSource || !hasCells) {
    return enrichedInvalidLayout(
      `Page "${pageId}" has an invalid layout at "${path}": table rows must use either manual rows or a dynamic { source, cells } object.`,
      breadcrumb,
      rawNode,
    )
  }

  const sourceResult = validateCollectionSource(rawRows.source, `${path}.source`, pageId, { allowItemReference: true, allowPipeline: true })

  if (sourceResult.status === 'error') {
    return enrichErrorResult(sourceResult, breadcrumb, rawNode)
  }

  if (!Array.isArray(rawRows.cells)) {
    return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.cells".`, breadcrumb, rawNode)
  }

  if (rawRows.cells.length !== headersLength) {
    return enrichedInvalidLayout(
      `Page "${pageId}" has an invalid layout at "${path}.cells": table dynamic cells must have exactly ${headersLength} entries to match headers.`,
      breadcrumb,
      rawNode,
    )
  }

  const cells: (string | TableCellNode)[] = []

  for (let index = 0; index < rawRows.cells.length; index += 1) {
    const rawCell = rawRows.cells[index]
    const cellPath = `${path}.cells[${index}]`

    if (isRecord(rawCell)) {
      const cellResult = validateTableCellNode(rawCell, cellPath, pageId)

      if (cellResult.status === 'error') {
        return cellResult
      }

      cells.push(cellResult.node)
    } else {
      if (!isNonEmptyString(rawCell)) {
        return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${cellPath}".`, breadcrumb, rawNode)
      }

      cells.push(rawCell)
    }
  }

  return {
    status: 'ready',
    rows: {
      source: sourceResult.source,
      cells,
    },
  }
}

function isTableCellPrimitive(value: unknown): value is string | number | boolean {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
}
