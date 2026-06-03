import type {
  ButtonLayoutNode,
  ContainerLayoutNode,
  HeadingLayoutNode,
  ImageLayoutNode,
  LayoutNode,
  LayoutNodeCollection,
  LayoutNodeFeedbackFields,
  LayoutNodeType,
  ListLayoutNode,
  ModalLayoutNode,
  ParagraphLayoutNode,
  QueryStateFeedbackConfig,
  QueryStateFeedbackFallbackRule,
  QueryStateFeedbackRule,
  QueryStateFeedbackVisibleState,
  RepeaterLayoutNode,
  RuntimeCollectionPaginationConfig,
  RuntimeCollectionObjectItem,
  RuntimeConfigError,
  RuntimeUiAction,
  RuntimeVisibilityConfig,
  TableCellNode,
  TableCellValue,
  TableColumnConfig,
  TableDynamicRows,
  TableLayoutNode,
} from './runtime-config-types'
import {
  buttonNodeSchema,
  containerNodeSchema,
  headingNodeSchema,
  imageNodeSchema,
  listNodeSchema,
  modalNodeSchema,
  paragraphNodeSchema,
  repeaterNodeSchema,
  supportedNodeTypes,
  tableCellAllowedNodeTypes,
  tableNodeSchema,
} from './runtime-config-zod'
import { invalidLayout, unsupportedNodeType } from './runtime-config-validation-errors'
import { hasRuntimeTemplateDelimiter, parseRuntimeReference } from '../runtime/runtime-references/runtime-reference-parser'
import {
  mapQueryStateFeedbackIssue,
  mapVisibilityIssue,
  validateRuntimeUiAction,
  validateVisibility,
} from './validate-actions-visibility'
import {
  validateFormNode,
  validateInputNode,
  validateTextareaNode,
  validateSelectNode,
  validateRadioGroupNode,
  validateCheckboxGroupNode,
  validateCollectionSource,
} from './validate-form-nodes'

const collectionPathSegmentPattern = /^[A-Za-z0-9_-]+$/
const modalAllowedChildTypes = new Set(['container', 'form', 'heading', 'paragraph', 'list', 'image', 'table', 'button', 'repeater'])

export function validateLayoutCollection(
  rawNodes: unknown,
  path: string,
  pageId: string,
): { status: 'ready'; nodes: LayoutNodeCollection } | { status: 'error'; error: RuntimeConfigError } {
  if (!Array.isArray(rawNodes)) {
    return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}".`)
  }

  const nodes: LayoutNode[] = []

  for (let index = 0; index < rawNodes.length; index += 1) {
    const nodeResult = validateLayoutNode(rawNodes[index], `${path}[${index}]`, pageId)

    if (nodeResult.status === 'error') {
      return nodeResult
    }

    nodes.push(nodeResult.node)
  }

  return {
    status: 'ready',
    nodes,
  }
}

export function validateLayoutNode(
  rawNode: unknown,
  path: string,
  pageId: string,
): { status: 'ready'; node: LayoutNode } | { status: 'error'; error: RuntimeConfigError } {
  if (!isRecord(rawNode)) {
    return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}".`)
  }

  if (typeof rawNode.type !== 'string') {
    return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.type".`)
  }

  if (!supportedNodeTypes.includes(rawNode.type as LayoutNodeType)) {
    return unsupportedNodeType(pageId, path, rawNode.type)
  }

  switch (rawNode.type) {
    case 'container':
      return validateContainerNode(rawNode, path, pageId)
    case 'repeater':
      return validateRepeaterNode(rawNode, path, pageId)
    case 'heading':
      return validateHeadingNode(rawNode, path, pageId)
    case 'paragraph':
      return validateParagraphNode(rawNode, path, pageId)
    case 'list':
      return validateListNode(rawNode, path, pageId)
    case 'image':
      return validateImageNode(rawNode, path, pageId)
    case 'table':
      return validateTableNode(rawNode, path, pageId)
    case 'button':
      return validateButtonNode(rawNode, path, pageId)
    case 'form':
      return validateFormNode(rawNode, path, pageId)
    case 'input':
      return validateInputNode(rawNode, path, pageId)
    case 'textarea':
      return validateTextareaNode(rawNode, path, pageId)
    case 'select':
      return validateSelectNode(rawNode, path, pageId)
    case 'radioGroup':
      return validateRadioGroupNode(rawNode, path, pageId)
    case 'checkboxGroup':
      return validateCheckboxGroupNode(rawNode, path, pageId)
    case 'modal':
      return validateModalNode(rawNode, path, pageId)
  }

  return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.type".`)
}

export function validateQueryStateFeedback(
  rawQueryStateFeedback: LayoutNodeFeedbackFields['queryStateFeedback'],
  path: string,
  pageId: string,
):
  | { status: 'ready'; queryStateFeedback: QueryStateFeedbackConfig | undefined }
  | { status: 'error'; error: RuntimeConfigError } {
  if (rawQueryStateFeedback === undefined) {
    return {
      status: 'ready',
      queryStateFeedback: undefined,
    }
  }

  if (rawQueryStateFeedback.states === undefined) {
    return {
      status: 'ready',
      queryStateFeedback: rawQueryStateFeedback,
    }
  }

  const normalizedStates: Partial<Record<QueryStateFeedbackVisibleState, QueryStateFeedbackRule>> = {}

  for (const state of Object.keys(rawQueryStateFeedback.states) as QueryStateFeedbackVisibleState[]) {
    const rule = rawQueryStateFeedback.states[state]

    if (rule === undefined) {
      continue
    }

    if (rule.mode !== 'fallback') {
      normalizedStates[state] = rule
      continue
    }

    const fallbackResult = validateLayoutCollection(rule.fallback, `${path}.states.${state}.fallback`, pageId)

    if (fallbackResult.status === 'error') {
      return fallbackResult
    }

    normalizedStates[state] = {
      mode: 'fallback',
      fallback: fallbackResult.nodes,
    } satisfies QueryStateFeedbackFallbackRule
  }

  return {
    status: 'ready',
    queryStateFeedback: {
      query: rawQueryStateFeedback.query,
      states: normalizedStates,
    },
  }
}

export { validateVisibility }

function validateContainerNode(
  rawNode: Record<string, unknown>,
  path: string,
  pageId: string,
): { status: 'ready'; node: ContainerLayoutNode } | { status: 'error'; error: RuntimeConfigError } {
  const parseResult = containerNodeSchema.safeParse(rawNode)

  if (!parseResult.success) {
    const issue = parseResult.error.issues[0]
    const issuePath = issue?.path[0]

    if (issuePath === 'id') {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.id".`)
    }

    if (issuePath === 'props' && issue.path.length === 1) {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props".`)
    }

    if (issuePath === 'props' && issue.path[1] === 'direction') {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.direction".`)
    }

    if (issuePath === 'props' && issue.path[1] === 'gap') {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.gap".`)
    }

    if (issuePath === 'props' && issue.path[1] === 'columns') {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.columns".`)
    }

    if (issuePath === 'props' && issue.path[1] === 'variant') {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.variant".`)
    }

    if (issuePath === 'props' && issue.path[1] === 'align') {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.align".`)
    }

    if (issuePath === 'props' && issue.path[1] === 'justify') {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.justify".`)
    }

    if (issuePath === 'props' && issue.path[1] === 'wrap') {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.wrap".`)
    }

    if (issuePath === 'children') {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.children".`)
    }

    const layoutIssue = mapLayoutNodeIssue(pageId, path, issue.path)

    if (layoutIssue) {
      return layoutIssue
    }

    const feedbackIssue = mapQueryStateFeedbackIssue(pageId, path, issue)

    if (feedbackIssue) {
      return feedbackIssue
    }

    const visibilityIssue = mapVisibilityIssue(pageId, path, issue)

    if (visibilityIssue) {
      return visibilityIssue
    }

    return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}".`)
  }

  const feedbackResult = validateQueryStateFeedback(
    parseResult.data.queryStateFeedback as LayoutNodeFeedbackFields['queryStateFeedback'],
    `${path}.queryStateFeedback`,
    pageId,
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
    return visibilityResult
  }

  const containerProps = parseResult.data.props

  if (containerProps?.columns !== undefined && containerProps.wrap !== undefined) {
    return invalidLayout(
      `Page "${pageId}" has an invalid layout at "${path}.props.wrap": container nodes cannot declare "wrap" when "columns" is present.`,
    )
  }

  let children: LayoutNodeCollection | undefined

  if (parseResult.data.children !== undefined) {
    const childrenResult = validateLayoutCollection(parseResult.data.children, `${path}.children`, pageId)

    if (childrenResult.status === 'error') {
      return childrenResult
    }

    children = childrenResult.nodes
  }

  return {
    status: 'ready',
    node: {
      type: 'container',
      id: parseResult.data.id,
      queryStateFeedback: feedbackResult.queryStateFeedback,
      visibility: visibilityResult.visibility,
      layout: parseResult.data.layout,
      props: containerProps,
      children,
    },
  }
}

function validateRepeaterNode(
  rawNode: Record<string, unknown>,
  path: string,
  pageId: string,
): { status: 'ready'; node: RepeaterLayoutNode } | { status: 'error'; error: RuntimeConfigError } {
  const parseResult = repeaterNodeSchema.safeParse(rawNode)

  if (!parseResult.success) {
    const issue = parseResult.error.issues[0]
    const issuePath = issue?.path ?? []

    const feedbackIssue = mapQueryStateFeedbackIssue(pageId, path, issue)

    if (feedbackIssue) {
      return feedbackIssue
    }

    const visibilityIssue = mapVisibilityIssue(pageId, path, issue)

    if (visibilityIssue) {
      return visibilityIssue
    }

    if (issuePath[0] === 'id') {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.id".`)
    }

    if (issuePath[0] === 'children') {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.children".`)
    }

    const layoutIssue = mapLayoutNodeIssue(pageId, path, issuePath)

    if (layoutIssue) {
      return layoutIssue
    }

    if (issuePath[0] === 'props' && issuePath[1] === 'template') {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.template".`)
    }

    if (issuePath[0] === 'props' && issuePath[1] === 'items' && issuePath[2] === 'source') {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.items.source".`)
    }

    if (issuePath[0] === 'props' && issuePath[1] === 'items' && issuePath[2] === 'key') {
      return invalidLayout(
        `Page "${pageId}" has an invalid layout at "${path}.props.items.key": repeater item keys must use a non-empty relative item path.`,
      )
    }

    const paginationIssue = mapCollectionPaginationIssue(pageId, path, issue)

    if (paginationIssue) {
      return paginationIssue
    }

    if (issuePath[0] === 'props' && issuePath.length === 1) {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props".`)
    }

    return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}".`)
  }

  const feedbackResult = validateQueryStateFeedback(
    parseResult.data.queryStateFeedback as LayoutNodeFeedbackFields['queryStateFeedback'],
    `${path}.queryStateFeedback`,
    pageId,
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
    return visibilityResult
  }

  const itemsSourceResult = validateCollectionSource(parseResult.data.props.items.source, `${path}.props.items.source`, pageId)

  if (itemsSourceResult.status === 'error') {
    return itemsSourceResult
  }

  if (!isValidRepeaterItemKeyPath(parseResult.data.props.items.key)) {
    return invalidLayout(
      `Page "${pageId}" has an invalid layout at "${path}.props.items.key": repeater item keys must use a non-empty relative item path.`,
    )
  }

  const templateResult = validateLayoutCollection(parseResult.data.props.template, `${path}.props.template`, pageId)

  if (templateResult.status === 'error') {
    return templateResult
  }

  return {
    status: 'ready',
    node: {
      type: 'repeater',
      id: parseResult.data.id,
      queryStateFeedback: feedbackResult.queryStateFeedback,
      visibility: visibilityResult.visibility,
      layout: parseResult.data.layout,
      props: {
        items: {
          source: itemsSourceResult.source,
          key: parseResult.data.props.items.key,
        },
        pagination: parseResult.data.props.pagination as RuntimeCollectionPaginationConfig | undefined,
        template: templateResult.nodes,
      },
    },
  }
}

export function mapCollectionPaginationIssue(
  pageId: string,
  path: string,
  issue: { path: PropertyKey[]; code?: string; keys?: string[] },
): { status: 'error'; error: RuntimeConfigError } | null {
  const issuePath = issue.path

  if (issuePath[0] !== 'props' || issuePath[1] !== 'pagination') {
    return null
  }

  if (issuePath[2] === 'controls') {
    if (issue.code === 'unrecognized_keys' && Array.isArray(issue.keys) && issue.keys.length > 0) {
      return invalidLayout(
        `Page "${pageId}" has an invalid layout at "${path}.props.pagination.controls.${issue.keys[0]}".`,
      )
    }

    if (issuePath[3] === 'variant') {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.pagination.controls.variant".`)
    }

    return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.pagination.controls".`)
  }

  if (issue.code === 'unrecognized_keys' && Array.isArray(issue.keys) && issue.keys.length > 0) {
    return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.pagination.${issue.keys[0]}".`)
  }

  if (issuePath[2] === 'enabled') {
    return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.pagination.enabled".`)
  }

  if (issuePath[2] === 'pageSize') {
    return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.pagination.pageSize".`)
  }

  return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.pagination".`)
}

function validateHeadingNode(
  rawNode: Record<string, unknown>,
  path: string,
  pageId: string,
): { status: 'ready'; node: HeadingLayoutNode } | { status: 'error'; error: RuntimeConfigError } {
  const parseResult = headingNodeSchema.safeParse(rawNode)

  if (!parseResult.success) {
    const issue = parseResult.error.issues[0]
    const feedbackIssue = mapQueryStateFeedbackIssue(pageId, path, issue)

    if (feedbackIssue) {
      return feedbackIssue
    }

    const visibilityIssue = mapVisibilityIssue(pageId, path, issue)

    if (visibilityIssue) {
      return visibilityIssue
    }

    return mapLeafNodeIssue(pageId, path, issue?.path ?? [])
  }

  const feedbackResult = validateQueryStateFeedback(
    parseResult.data.queryStateFeedback as LayoutNodeFeedbackFields['queryStateFeedback'],
    `${path}.queryStateFeedback`,
    pageId,
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
    return visibilityResult
  }

  return {
    status: 'ready',
    node: {
      ...parseResult.data,
      queryStateFeedback: feedbackResult.queryStateFeedback,
      visibility: visibilityResult.visibility,
    },
  }
}

function validateParagraphNode(
  rawNode: Record<string, unknown>,
  path: string,
  pageId: string,
): { status: 'ready'; node: ParagraphLayoutNode } | { status: 'error'; error: RuntimeConfigError } {
  const parseResult = paragraphNodeSchema.safeParse(rawNode)

  if (!parseResult.success) {
    const feedbackIssue = mapQueryStateFeedbackIssue(pageId, path, parseResult.error.issues[0])

    if (feedbackIssue) {
      return feedbackIssue
    }

    const visibilityIssue = mapVisibilityIssue(pageId, path, parseResult.error.issues[0])

    if (visibilityIssue) {
      return visibilityIssue
    }

    return mapLeafNodeIssue(pageId, path, parseResult.error.issues[0]?.path ?? [])
  }

  const feedbackResult = validateQueryStateFeedback(
    parseResult.data.queryStateFeedback as LayoutNodeFeedbackFields['queryStateFeedback'],
    `${path}.queryStateFeedback`,
    pageId,
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
    return visibilityResult
  }

  return {
    status: 'ready',
    node: {
      ...parseResult.data,
      queryStateFeedback: feedbackResult.queryStateFeedback,
      visibility: visibilityResult.visibility,
    },
  }
}

function validateListNode(
  rawNode: Record<string, unknown>,
  path: string,
  pageId: string,
): { status: 'ready'; node: ListLayoutNode } | { status: 'error'; error: RuntimeConfigError } {
  const parseResult = listNodeSchema.safeParse(rawNode)

  if (!parseResult.success) {
    const feedbackIssue = mapQueryStateFeedbackIssue(pageId, path, parseResult.error.issues[0])

    if (feedbackIssue) {
      return feedbackIssue
    }

    const visibilityIssue = mapVisibilityIssue(pageId, path, parseResult.error.issues[0])

    if (visibilityIssue) {
      return visibilityIssue
    }

    return mapLeafNodeIssue(pageId, path, parseResult.error.issues[0]?.path ?? [])
  }

  const feedbackResult = validateQueryStateFeedback(
    parseResult.data.queryStateFeedback as LayoutNodeFeedbackFields['queryStateFeedback'],
    `${path}.queryStateFeedback`,
    pageId,
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
    return visibilityResult
  }

  const itemsResult = validateListItems(parseResult.data.props.items, `${path}.props.items`, pageId)

  if (itemsResult.status === 'error') {
    return itemsResult
  }

  return {
    status: 'ready',
    node: {
      type: 'list',
      id: parseResult.data.id,
      queryStateFeedback: feedbackResult.queryStateFeedback,
      visibility: visibilityResult.visibility,
      layout: parseResult.data.layout,
      props: {
        items: itemsResult.items,
      },
    },
  }
}

function validateImageNode(
  rawNode: Record<string, unknown>,
  path: string,
  pageId: string,
): { status: 'ready'; node: ImageLayoutNode } | { status: 'error'; error: RuntimeConfigError } {
  const parseResult = imageNodeSchema.safeParse(rawNode)

  if (!parseResult.success) {
    const issue = parseResult.error.issues[0]

    const feedbackIssue = mapQueryStateFeedbackIssue(pageId, path, issue)

    if (feedbackIssue) {
      return feedbackIssue
    }

    const visibilityIssue = mapVisibilityIssue(pageId, path, issue)

    if (visibilityIssue) {
      return visibilityIssue
    }

    return mapLeafNodeIssue(pageId, path, issue?.path ?? [])
  }

  const feedbackResult = validateQueryStateFeedback(
    parseResult.data.queryStateFeedback as LayoutNodeFeedbackFields['queryStateFeedback'],
    `${path}.queryStateFeedback`,
    pageId,
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
    return visibilityResult
  }

  const parsedProps = parseResult.data.props as { src?: string; fetch?: { url: string; method?: string; headers?: Record<string, string>; body?: unknown }; alt: string }
  const hasSrc = parsedProps.src !== undefined
  const hasFetch = parsedProps.fetch !== undefined

  // Mutual exclusion: src and fetch cannot both be present
  if (hasSrc && hasFetch) {
    return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props".`)
  }

  // At least one of src or fetch must be present
  if (!hasSrc && !hasFetch) {
    return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.src".`)
  }

  // fetch mode: validate that fetch.url is present (should already be validated by schema, but alt check)
  if (hasFetch) {
    return {
      status: 'ready',
      node: {
        ...parseResult.data,
        props: {
          fetch: parsedProps.fetch!,
          alt: parsedProps.alt,
        } as ImageLayoutNode['props'],
        queryStateFeedback: feedbackResult.queryStateFeedback,
        visibility: visibilityResult.visibility,
      },
    }
  }

  // src mode
  return {
    status: 'ready',
    node: {
      ...parseResult.data,
      props: {
        src: parsedProps.src!,
        alt: parsedProps.alt,
      } as ImageLayoutNode['props'],
      queryStateFeedback: feedbackResult.queryStateFeedback,
      visibility: visibilityResult.visibility,
    },
  }
}

function validateTableNode(
  rawNode: Record<string, unknown>,
  path: string,
  pageId: string,
): { status: 'ready'; node: TableLayoutNode } | { status: 'error'; error: RuntimeConfigError } {
  const parseResult = tableNodeSchema.safeParse(rawNode)

  if (!parseResult.success) {
    const issue = parseResult.error.issues[0]
    const feedbackIssue = mapQueryStateFeedbackIssue(pageId, path, issue)

    if (feedbackIssue) {
      return feedbackIssue
    }

    const visibilityIssue = mapVisibilityIssue(pageId, path, issue)

    if (visibilityIssue) {
      return visibilityIssue
    }

    const columnsIssue = mapTableColumnsIssue(pageId, path, issue)

    if (columnsIssue) {
      return columnsIssue
    }

    const paginationIssue = mapCollectionPaginationIssue(pageId, path, issue)

    if (paginationIssue) {
      return paginationIssue
    }

    return mapLeafNodeIssue(pageId, path, issue?.path ?? [])
  }

  const feedbackResult = validateQueryStateFeedback(
    parseResult.data.queryStateFeedback as LayoutNodeFeedbackFields['queryStateFeedback'],
    `${path}.queryStateFeedback`,
    pageId,
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
    return visibilityResult
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
): { status: 'error'; error: RuntimeConfigError } | null {
  const issuePath = issue?.path ?? []

  if (issuePath[0] !== 'props' || issuePath[1] !== 'columns') {
    return null
  }

  const issueKeys = issue?.code === 'unrecognized_keys' && Array.isArray(issue.keys) ? issue.keys : []

  if (issueKeys.length > 0) {
    if (typeof issuePath[2] === 'number') {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.columns[${issuePath[2]}].${issueKeys[0]}".`)
    }

    return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.columns.${issueKeys[0]}".`)
  }

  if (typeof issuePath[2] === 'number') {
    const columnPath = `${path}.props.columns[${issuePath[2]}]`

    if (
      issuePath[3] === 'id' ||
      issuePath[3] === 'filterable' ||
      issuePath[3] === 'filterPlaceholder' ||
      issuePath[3] === 'sortable'
    ) {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${columnPath}.${String(issuePath[3])}".`)
    }

    return invalidLayout(`Page "${pageId}" has an invalid layout at "${columnPath}".`)
  }

  return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.columns".`)
}

function validateListItems(
  rawItems: unknown,
  path: string,
  pageId: string,
): { status: 'ready'; items: ListLayoutNode['props']['items'] } | { status: 'error'; error: RuntimeConfigError } {
  if (Array.isArray(rawItems)) {
    const items: string[] = []

    for (let index = 0; index < rawItems.length; index += 1) {
      if (typeof rawItems[index] !== 'string') {
        return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}[${index}]".`)
      }

      items.push(rawItems[index])
    }

    return {
      status: 'ready',
      items,
    }
  }

  if (!isRecord(rawItems)) {
    return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}".`)
  }

  const hasSource = 'source' in rawItems
  const hasValues = 'values' in rawItems

  if (hasSource && hasValues) {
    return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}".`)
  }

  if (hasSource) {
    const sourceResult = validateCollectionSource(rawItems.source, `${path}.source`, pageId, { allowItemReference: true })

    if (sourceResult.status === 'error') {
      return sourceResult
    }

    if (rawItems.itemType !== undefined && rawItems.itemType !== 'scalar') {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.itemType".`)
    }

    if (rawItems.itemText !== undefined && !isValidCollectionProjectionPath(rawItems.itemText)) {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.itemText".`)
    }

    if (rawItems.itemText !== undefined && rawItems.itemType !== undefined) {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}".`)
    }

    if (rawItems.itemText === undefined && rawItems.itemType !== 'scalar') {
      return invalidLayout(
        `Page "${pageId}" has an invalid layout at "${path}": dynamic scalar collections must declare itemType: "scalar", and dynamic object collections must declare itemText.`,
      )
    }

    return {
      status: 'ready',
      items: rawItems.itemText === undefined
        ? { source: sourceResult.source, itemType: 'scalar' }
        : { source: sourceResult.source, itemText: rawItems.itemText },
    }
  }

  if (!hasValues) {
    return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}".`)
  }

  if (!Array.isArray(rawItems.values)) {
    return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.values".`)
  }

  const values = rawItems.values

  if (values.every((value) => typeof value === 'string')) {
    return {
      status: 'ready',
      items: {
        values,
      },
    }
  }

  if (values.every((value) => isRecord(value))) {
    if (!isValidCollectionProjectionPath(rawItems.itemText)) {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.itemText".`)
    }

    return {
      status: 'ready',
      items: {
        values: values as RuntimeCollectionObjectItem[],
        itemText: rawItems.itemText,
      },
    }
  }

  const invalidIndex = values.findIndex((value) => typeof value !== 'string' && !isRecord(value))
  return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.values[${Math.max(invalidIndex, 0)}]".`)
}

export function mapLeafNodeIssue(
  pageId: string,
  path: string,
  issuePath: PropertyKey[],
): { status: 'error'; error: RuntimeConfigError } {
  const layoutIssue = mapLayoutNodeIssue(pageId, path, issuePath)

  if (layoutIssue) {
    return layoutIssue
  }

  if (issuePath[0] === 'id') {
    return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.id".`)
  }

  if (issuePath[0] === 'props' && issuePath.length === 1) {
    return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props".`)
  }

  const formattedIssuePath = issuePath.map(formatPathSegment).join('')
  return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}${formattedIssuePath}".`)
}

export function mapLayoutNodeIssue(
  pageId: string,
  path: string,
  issuePath: PropertyKey[],
): { status: 'error'; error: RuntimeConfigError } | null {
  if (issuePath[0] === 'layout' && issuePath.length === 1) {
    return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.layout".`)
  }

  if (issuePath[0] === 'layout' && issuePath[1] === 'span') {
    return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.layout.span".`)
  }

  return null
}

function validateModalNode(
  rawNode: Record<string, unknown>,
  path: string,
  pageId: string,
): { status: 'ready'; node: ModalLayoutNode } | { status: 'error'; error: RuntimeConfigError } {
  const parseResult = modalNodeSchema.safeParse(rawNode)

  if (!parseResult.success) {
    const issue = parseResult.error.issues[0]
    const issuePath = issue?.path ?? []

    const feedbackIssue = mapQueryStateFeedbackIssue(pageId, path, issue)
    if (feedbackIssue) return feedbackIssue

    const visibilityIssue = mapVisibilityIssue(pageId, path, issue)
    if (visibilityIssue) return visibilityIssue

    if (issuePath[0] === 'id') {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.id".`)
    }

    if (issuePath[0] === 'props' && issuePath[1] === 'size') {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.size".`)
    }

    if (issuePath[0] === 'props' && issuePath[1] === 'defaultOpen') {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.defaultOpen".`)
    }

    if (issuePath[0] === 'props' && issuePath[1] === 'label') {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.label".`)
    }

    const layoutIssue = mapLayoutNodeIssue(pageId, path, issuePath)
    if (layoutIssue) return layoutIssue

    return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}".`)
  }

  const feedbackResult = validateQueryStateFeedback(
    parseResult.data.queryStateFeedback as LayoutNodeFeedbackFields['queryStateFeedback'],
    `${path}.queryStateFeedback`,
    pageId,
  )

  if (feedbackResult.status === 'error') return feedbackResult

  const visibilityResult = validateVisibility(
    parseResult.data.visibility as LayoutNodeFeedbackFields['visibility'],
    `${path}.visibility`,
    pageId,
  )

  if (visibilityResult.status === 'error') return visibilityResult

  let children: LayoutNodeCollection | undefined

  if (parseResult.data.children !== undefined) {
    for (let i = 0; i < parseResult.data.children.length; i += 1) {
      const child = parseResult.data.children[i]
      const childType = isRecord(child) ? String(child.type) : undefined

      if (!childType || !modalAllowedChildTypes.has(childType)) {
        return invalidLayout(
          `Page "${pageId}" has an invalid layout at "${path}.children[${i}]": modal children may only be container, form, heading, paragraph, list, image, table, button or repeater nodes.`,
        )
      }
    }

    const childrenResult = validateLayoutCollection(parseResult.data.children, `${path}.children`, pageId)
    if (childrenResult.status === 'error') return childrenResult
    children = childrenResult.nodes
  }

  return {
    status: 'ready',
    node: {
      type: 'modal',
      id: parseResult.data.id,
      queryStateFeedback: feedbackResult.queryStateFeedback,
      visibility: visibilityResult.visibility,
      layout: parseResult.data.layout,
      props: parseResult.data.props,
      children,
    },
  }
}

function validateButtonNode(
  rawNode: Record<string, unknown>,
  path: string,
  pageId: string,
): { status: 'ready'; node: ButtonLayoutNode } | { status: 'error'; error: RuntimeConfigError } {
  const parseResult = buttonNodeSchema.safeParse(rawNode)

  if (!parseResult.success) {
    const issue = parseResult.error.issues[0]
    const issuePath = issue?.path ?? []

    const feedbackIssue = mapQueryStateFeedbackIssue(pageId, path, issue)

    if (feedbackIssue) {
      return feedbackIssue
    }

    const visibilityIssue = mapVisibilityIssue(pageId, path, issue)

    if (visibilityIssue) {
      return visibilityIssue
    }

    if (issuePath[0] === 'id') {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.id".`)
    }

    if (issuePath[0] === 'props' && issuePath.length === 1) {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props".`)
    }

    if (issuePath[0] === 'props' && issuePath[1] === 'label') {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.label".`)
    }

    if (issuePath[0] === 'props' && issuePath[1] === 'action') {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.action".`)
    }

    const layoutIssue = mapLayoutNodeIssue(pageId, path, issuePath)

    if (layoutIssue) {
      return layoutIssue
    }

    return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props".`)
  }

  const feedbackResult = validateQueryStateFeedback(
    parseResult.data.queryStateFeedback as LayoutNodeFeedbackFields['queryStateFeedback'],
    `${path}.queryStateFeedback`,
    pageId,
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
    return visibilityResult
  }

  let action: RuntimeUiAction | undefined

  if (parseResult.data.props.action !== undefined) {
    const actionResult = validateRuntimeUiAction(parseResult.data.props.action, `${path}.props.action`, pageId)

    if (actionResult.status === 'error') {
      return actionResult
    }

    action = actionResult.action
  }

  return {
    status: 'ready',
    node: {
      type: 'button',
      id: parseResult.data.id,
      queryStateFeedback: feedbackResult.queryStateFeedback,
      visibility: visibilityResult.visibility,
      layout: parseResult.data.layout,
      props: {
        label: parseResult.data.props.label,
        action,
      },
    },
  }
}

function validateTableHeaders(
  rawHeaders: unknown,
  path: string,
  pageId: string,
): { status: 'ready'; headers: string[] } | { status: 'error'; error: RuntimeConfigError } {
  if (!Array.isArray(rawHeaders) || rawHeaders.length === 0) {
    return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}".`)
  }

  const headers: string[] = []

  for (let index = 0; index < rawHeaders.length; index += 1) {
    if (!isNonEmptyString(rawHeaders[index])) {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}".`)
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
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${columnPath}.id".`)
    }

    seenColumnIds.add(column.id)

    const matchingHeaders = headers.filter((header) => header === column.id)

    if (matchingHeaders.length !== 1) {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${columnPath}.id".`)
    }

    if (column.filterable !== true && column.sortable !== true) {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${columnPath}".`)
    }

    if (column.filterPlaceholder !== undefined && column.filterable !== true) {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${columnPath}.filterPlaceholder".`)
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
): { status: 'ready'; rows: TableLayoutNode['props']['rows'] } | { status: 'error'; error: RuntimeConfigError } {
  if (Array.isArray(rawRows)) {
    return validateTableManualRows(rawRows, headersLength, path, pageId)
  }

  if (!isRecord(rawRows)) {
    return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}".`)
  }

  return validateTableDynamicRows(rawRows, headersLength, path, pageId)
}

export function validateTableCellNode(
  rawCell: unknown,
  path: string,
  pageId: string,
): { status: 'ready'; node: TableCellNode } | { status: 'error'; error: RuntimeConfigError } {
  if (!isRecord(rawCell)) {
    return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.type".`)
  }

  const cellType = rawCell.type

  // Step 1: validate type is a non-empty string within the allowed subset
  if (typeof cellType !== 'string' || cellType.trim().length === 0 || !(tableCellAllowedNodeTypes as readonly string[]).includes(cellType)) {
    return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.type".`)
  }

  // Step 2: if container, recursively check all descendants for allowed subset before delegating to validateLayoutNode
  if (cellType === 'container') {
    const childrenCheck = checkContainerChildrenSubset(rawCell.children, `${path}.children`, pageId)

    if (childrenCheck !== null) {
      return childrenCheck
    }
  }

  // Step 3: delegate to validateLayoutNode for full contract validation (props, visibility, queryStateFeedback, layout)
  const nodeResult = validateLayoutNode(rawCell, path, pageId)

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
): { status: 'error'; error: RuntimeConfigError } | null {
  if (!Array.isArray(children)) {
    return null
  }

  for (let i = 0; i < children.length; i += 1) {
    const child = children[i]

    if (!isRecord(child)) {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}[${i}].type".`)
    }

    const childType = child.type

    if (typeof childType !== 'string' || childType.trim().length === 0 || !(tableCellAllowedNodeTypes as readonly string[]).includes(childType)) {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}[${i}].type".`)
    }

    // Recurse into nested containers
    if (childType === 'container') {
      const nestedCheck = checkContainerChildrenSubset(child.children, `${path}[${i}].children`, pageId)

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
): { status: 'ready'; rows: TableLayoutNode['props']['rows'] } | { status: 'error'; error: RuntimeConfigError } {
  const rows: TableCellValue[][] = []

  for (let rowIndex = 0; rowIndex < rawRows.length; rowIndex += 1) {
    const rawRow = rawRows[rowIndex]

    if (!Array.isArray(rawRow)) {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}[${rowIndex}]".`)
    }

    if (rawRow.length !== headersLength) {
      return invalidLayout(
        `Page "${pageId}" has an invalid layout at "${path}[${rowIndex}]": table rows must have exactly ${headersLength} cells to match headers.`,
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
        return invalidLayout(
          `Page "${pageId}" has an invalid layout at "${cellPath}": table cells only accept string, number, boolean or node values.`,
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
): { status: 'ready'; rows: TableDynamicRows } | { status: 'error'; error: RuntimeConfigError } {
  const hasSource = Object.prototype.hasOwnProperty.call(rawRows, 'source')
  const hasCells = Object.prototype.hasOwnProperty.call(rawRows, 'cells')

  if ('values' in rawRows || !hasSource || !hasCells) {
    return invalidLayout(
      `Page "${pageId}" has an invalid layout at "${path}": table rows must use either manual rows or a dynamic { source, cells } object.`,
    )
  }

  const sourceResult = validateCollectionSource(rawRows.source, `${path}.source`, pageId, { allowItemReference: true })

  if (sourceResult.status === 'error') {
    return sourceResult
  }

  if (!Array.isArray(rawRows.cells)) {
    return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.cells".`)
  }

  if (rawRows.cells.length !== headersLength) {
    return invalidLayout(
      `Page "${pageId}" has an invalid layout at "${path}.cells": table dynamic cells must have exactly ${headersLength} entries to match headers.`,
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
        return invalidLayout(`Page "${pageId}" has an invalid layout at "${cellPath}".`)
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

function formatPathSegment(segment: PropertyKey): string {
  if (typeof segment === 'number') {
    return `[${segment}]`
  }

  return `.${String(segment)}`
}

function isTableCellPrimitive(value: unknown): value is string | number | boolean {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }

  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isValidCollectionItemPath(value: unknown): value is string {
  if (!isNonEmptyString(value)) {
    return false
  }

  return value.split('.').every(isValidCollectionPathSegment)
}

function isValidCollectionProjectionPath(value: unknown): value is string {
  return isNonEmptyString(value) && (hasRuntimeTemplateDelimiter(value) || isValidCollectionItemPath(value))
}

function isValidRepeaterItemKeyPath(value: unknown): value is string {
  if (value === '$key') {
    return true
  }

  if (!isValidCollectionItemPath(value)) {
    return false
  }

  const [firstSegment] = value.split('.')

  return (
    firstSegment !== 'item' &&
    firstSegment !== 'queries' &&
    firstSegment !== 'forms' &&
    firstSegment !== 'params' &&
    firstSegment !== 'navigation' &&
    firstSegment !== 'routeParams'
  )
}

function isValidCollectionPathSegment(segment: string) {
  return segment.length > 0 && collectionPathSegmentPattern.test(segment)
}
