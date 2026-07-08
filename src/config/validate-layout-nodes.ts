import type {
  AccordionLayoutNode,
  AlertLayoutNode,
  BadgeLayoutNode,
  StatLayoutNode,
  DividerLayoutNode,
  SkeletonLayoutNode,
  FileInputLayoutNode,
  FileManagerLayoutNode,
  ButtonLayoutNode,
  ContainerLayoutNode,
  HeadingLayoutNode,
  ImageLayoutNode,
  LayoutNode,
  LayoutNodeCollection,
  LayoutNodeFeedbackFields,
  LayoutNodeType,
  LinkLayoutNode,
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
  TabsLayoutNode,
} from './runtime-config-types'
import {
  accordionNodeSchema,
  alertNodeSchema,
  badgeNodeSchema,
  statNodeSchema,
  dividerNodeSchema,
  skeletonNodeSchema,
  fileInputNodeSchema,
  fileManagerNodeSchema,
  buttonNodeSchema,
  containerNodeSchema,
  headingNodeSchema,
  imageNodeSchema,
  linkNodeSchema,
  listNodeSchema,
  modalNodeSchema,
  paragraphNodeSchema,
  repeaterNodeSchema,
  supportedNodeTypes,
  tableCellAllowedNodeTypes,
  tableNodeSchema,
  tabsNodeSchema,
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
const modalAllowedChildTypes = new Set(['container', 'form', 'heading', 'paragraph', 'list', 'image', 'table', 'button', 'repeater', 'accordion', 'fileManager'])
const linkAllowedChildTypes = new Set(['container', 'heading', 'paragraph', 'list', 'image', 'badge', 'alert', 'stat', 'divider', 'skeleton'])

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
    case 'link':
      return validateLinkNode(rawNode, path, pageId)
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
    case 'tabs':
      return validateTabsNode(rawNode, path, pageId)
    case 'accordion':
      return validateAccordionNode(rawNode, path, pageId)
    case 'badge':
      return validateBadgeNode(rawNode, path, pageId)
    case 'alert':
      return validateAlertNode(rawNode, path, pageId)
    case 'stat':
      return validateStatNode(rawNode, path, pageId)
    case 'divider':
      return validateDividerNode(rawNode, path, pageId)
    case 'skeleton':
      return validateSkeletonNode(rawNode, path, pageId)
    case 'fileInput':
      return validateFileInputNode(rawNode, path, pageId)
    case 'fileManager':
      return validateFileManagerNode(rawNode, path, pageId)
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
          `Page "${pageId}" has an invalid layout at "${path}.children[${i}]": modal children may only be container, form, heading, paragraph, list, image, table, button, repeater, accordion or fileManager nodes.`,
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

function validateTabsNode(
  rawNode: Record<string, unknown>,
  path: string,
  pageId: string,
): { status: 'ready'; node: TabsLayoutNode } | { status: 'error'; error: RuntimeConfigError } {
  const parseResult = tabsNodeSchema.safeParse(rawNode)

  if (!parseResult.success) {
    const issue = parseResult.error.issues[0]
    const issuePath = issue?.path ?? []

    const feedbackIssue = mapQueryStateFeedbackIssue(pageId, path, issue)
    if (feedbackIssue) return feedbackIssue

    const visibilityIssue = mapVisibilityIssue(pageId, path, issue)
    if (visibilityIssue) return visibilityIssue

    const layoutIssue = mapLayoutNodeIssue(pageId, path, issuePath)
    if (layoutIssue) return layoutIssue

    if (issuePath[0] === 'id') {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.id".`)
    }

    if (issuePath[0] === 'props' && issuePath[1] === 'orientation') {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.orientation".`)
    }

    if (issuePath[0] === 'props' && issuePath[1] === 'items' && typeof issuePath[2] === 'number' && issuePath[3] === 'label') {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.items[${issuePath[2]}].label".`)
    }

    if (issuePath[0] === 'props' && issuePath[1] === 'items' && typeof issuePath[2] === 'number' && issuePath[3] === 'visibility') {
      const itemIndex = issuePath[2]
      const remainingSegments = issuePath.slice(3).map(formatPathSegment).join('')
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.items[${itemIndex}]${remainingSegments}".`)
    }

    if (issuePath[0] === 'props' && issuePath[1] === 'items') {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.items".`)
    }

    if (issuePath[0] === 'props') {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props".`)
    }

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

  const rawItems = (rawNode.props as Record<string, unknown>).items
  if (!Array.isArray(rawItems)) {
    return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.items".`)
  }

  const normalizedItems: TabsLayoutNode['props']['items'] = []

  for (let index = 0; index < rawItems.length; index += 1) {
    const rawItem = rawItems[index]

    if (!isRecord(rawItem)) {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.items[${index}]".`)
    }

    if (typeof rawItem.label !== 'string') {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.items[${index}].label".`)
    }

    const itemVisibilityResult = validateVisibility(
      rawItem.visibility as LayoutNodeFeedbackFields['visibility'],
      `${path}.props.items[${index}].visibility`,
      pageId,
    )

    if (itemVisibilityResult.status === 'error') return itemVisibilityResult

    let children: LayoutNodeCollection | undefined

    if (rawItem.children !== undefined) {
      const childrenResult = validateLayoutCollection(rawItem.children, `${path}.props.items[${index}].children`, pageId)

      if (childrenResult.status === 'error') return childrenResult

      children = childrenResult.nodes
    }

    normalizedItems.push({ label: rawItem.label, children, visibility: itemVisibilityResult.visibility })
  }

  return {
    status: 'ready',
    node: {
      type: 'tabs',
      id: parseResult.data.id,
      queryStateFeedback: feedbackResult.queryStateFeedback,
      visibility: visibilityResult.visibility,
      layout: parseResult.data.layout,
      props: {
        orientation: parseResult.data.props.orientation,
        defaultTab: parseResult.data.props.defaultTab,
        items: normalizedItems,
      },
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

    if (issuePath[0] === 'props' && issuePath[1] === 'color') {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.color".`)
    }

    if (issuePath[0] === 'props' && issuePath[1] === 'variant') {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.variant".`)
    }

    if (issuePath[0] === 'props' && issuePath[1] === 'fullWidth') {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.fullWidth".`)
    }

    if (issuePath[0] === 'props' && issuePath[1] === 'iconPosition') {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.iconPosition".`)
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

  const buttonProps: ButtonLayoutNode['props'] = {
    label: parseResult.data.props.label,
    action,
    color: parseResult.data.props.color,
    variant: parseResult.data.props.variant,
    fullWidth: parseResult.data.props.fullWidth,
    icon: parseResult.data.props.icon,
  }

  if (parseResult.data.props.iconPosition !== undefined) {
    buttonProps.iconPosition = parseResult.data.props.iconPosition
  }

  return {
    status: 'ready',
    node: {
      type: 'button',
      id: parseResult.data.id,
      queryStateFeedback: feedbackResult.queryStateFeedback,
      visibility: visibilityResult.visibility,
      layout: parseResult.data.layout,
      props: buttonProps,
    },
  }
}

export function validateLinkNode(
  rawNode: Record<string, unknown>,
  path: string,
  pageId: string,
): { status: 'ready'; node: LinkLayoutNode } | { status: 'error'; error: RuntimeConfigError } {
  const parseResult = linkNodeSchema.safeParse(rawNode)

  if (!parseResult.success) {
    const issue = parseResult.error.issues[0]
    const issuePath = issue?.path ?? []

    const feedbackIssue = mapQueryStateFeedbackIssue(pageId, path, issue)
    if (feedbackIssue) return feedbackIssue

    const visibilityIssue = mapVisibilityIssue(pageId, path, issue)
    if (visibilityIssue) return visibilityIssue

    const layoutIssue = mapLayoutNodeIssue(pageId, path, issuePath)
    if (layoutIssue) return layoutIssue

    if (issuePath[0] === 'id') {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.id".`)
    }

    if (issuePath[0] === 'props' && issuePath.length === 1) {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props".`)
    }

    if (issuePath[0] === 'props' && issuePath[1] === 'label') {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.label".`)
    }

    if (issuePath[0] === 'props' && issuePath[1] === 'href') {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.href".`)
    }

    if (issuePath[0] === 'props' && issuePath[1] === 'download') {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.download".`)
    }

    if (issuePath[0] === 'props' && issuePath[1] === 'target') {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.target".`)
    }

    if (issuePath[0] === 'props' && issuePath[1] === 'action') {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.action".`)
    }

    if (issuePath[0] === 'props' && issuePath[1] === 'iconPosition') {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.iconPosition".`)
    }

    return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props".`)
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

  const { href, download, target, action, label, icon, iconPosition } = parseResult.data.props
  const hasChildren = parseResult.data.children !== undefined
  const hasLabel = label !== undefined
  const hasIcon = icon !== undefined
  const hasIconPosition = iconPosition !== undefined
  const hasHref = href !== undefined
  const hasAction = action !== undefined

  // Cross-validation (1): children and props.label are mutually exclusive
  if (hasChildren && hasLabel) {
    return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}": link nodes cannot have both props.label and children.`)
  }

  // Cross-validation (2): children and props.icon are mutually exclusive
  if (hasChildren && hasIcon) {
    return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}": link nodes cannot have both props.icon and children.`)
  }

  // Cross-validation (2b): children and props.iconPosition are mutually exclusive
  if (hasChildren && hasIconPosition) {
    return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}": link nodes cannot have both props.icon and children.`)
  }

  // Cross-validation (3): must have either props.label or children
  if (!hasChildren && !hasLabel) {
    return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}": link nodes must have either props.label or children.`)
  }

  // Cross-validation (4): children cannot be empty
  if (hasChildren && parseResult.data.children!.length === 0) {
    return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.children": link children cannot be empty.`)
  }

  // Cross-validation (5 & 6): validate children types (direct and recursive)
  let children: LayoutNodeCollection | undefined

  if (hasChildren) {
    // Check direct type restriction before full validation
    const directTypeCheck = checkLinkChildrenAllowedTypes(parseResult.data.children!, `${path}.children`, pageId)

    if (directTypeCheck.status === 'error') {
      return directTypeCheck
    }

    // Full validation of children
    const childrenResult = validateLayoutCollection(parseResult.data.children!, `${path}.children`, pageId)

    if (childrenResult.status === 'error') {
      return childrenResult
    }

    children = childrenResult.nodes
  }

  // Cross-validation (7): href and action are mutually exclusive
  if (hasHref && hasAction) {
    return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}": link nodes cannot have both props.href and props.action.`)
  }

  // Cross-validation (7): must have either href or action
  if (!hasHref && !hasAction) {
    return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}": link nodes must have either props.href or props.action.`)
  }

  // Cross-validation (7): download requires href
  if (download !== undefined && !hasHref) {
    return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.download": download requires props.href.`)
  }

  // Cross-validation (7): target requires href
  if (target !== undefined && !hasHref) {
    return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.target": target requires props.href.`)
  }

  // Cross-validation (7): action.type must be navigateTo or goBack
  let validatedAction: LinkLayoutNode['props']['action'] | undefined
  if (hasAction) {
    const rawAction = action as Record<string, unknown>

    if (rawAction.type !== 'navigateTo' && rawAction.type !== 'goBack') {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.action.type".`)
    }

    const linkActionResult = validateRuntimeUiAction(rawAction, `${path}.props.action`, pageId)

    if (linkActionResult.status === 'error') {
      return linkActionResult
    }

    validatedAction = linkActionResult.action as LinkLayoutNode['props']['action']
  }

  const props: LinkLayoutNode['props'] = {}

  if (label !== undefined) props.label = label
  if (href !== undefined) props.href = href
  if (download !== undefined) props.download = download
  if (target !== undefined) props.target = target
  if (validatedAction !== undefined) props.action = validatedAction
  if (icon !== undefined) props.icon = icon
  if (iconPosition !== undefined) props.iconPosition = iconPosition

  const node: LinkLayoutNode = {
    type: 'link',
    id: parseResult.data.id,
    queryStateFeedback: feedbackResult.queryStateFeedback,
    visibility: visibilityResult.visibility,
    layout: parseResult.data.layout,
    props,
  }

  if (children !== undefined) {
    node.children = children
  }

  return {
    status: 'ready',
    node,
  }
}

function checkLinkChildrenAllowedTypes(
  children: unknown[],
  basePath: string,
  pageId: string,
): { status: 'ready' } | { status: 'error'; error: RuntimeConfigError } {
  for (let i = 0; i < children.length; i += 1) {
    const child = children[i]

    if (!isRecord(child)) {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${basePath}[${i}]": link children may only be container, heading, paragraph, list, image, badge, alert, stat, divider or skeleton nodes.`)
    }

    const childType = typeof child.type === 'string' ? child.type : undefined

    if (!childType || !linkAllowedChildTypes.has(childType)) {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${basePath}[${i}]": link children may only be container, heading, paragraph, list, image, badge, alert, stat, divider or skeleton nodes.`)
    }

    // Recurse into container children
    if (childType === 'container' && child.children !== undefined) {
      const nestedCheck = checkLinkChildrenAllowedTypes(child.children as unknown[], `${basePath}[${i}].children`, pageId)

      if (nestedCheck.status === 'error') {
        return nestedCheck
      }
    }
  }

  return { status: 'ready' }
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

function validateAccordionNode(
  rawNode: Record<string, unknown>,
  path: string,
  pageId: string,
): { status: 'ready'; node: AccordionLayoutNode } | { status: 'error'; error: RuntimeConfigError } {
  const parseResult = accordionNodeSchema.safeParse(rawNode)

  if (!parseResult.success) {
    const issue = parseResult.error.issues[0]
    const issuePath = issue?.path ?? []

    const feedbackIssue = mapQueryStateFeedbackIssue(pageId, path, issue)
    if (feedbackIssue) return feedbackIssue

    const visibilityIssue = mapVisibilityIssue(pageId, path, issue)
    if (visibilityIssue) return visibilityIssue

    const layoutIssue = mapLayoutNodeIssue(pageId, path, issuePath)
    if (layoutIssue) return layoutIssue

    if (issuePath[0] === 'id') {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.id".`)
    }

    if (issuePath[0] === 'props' && issuePath[1] === 'label') {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.label".`)
    }

    if (issuePath[0] === 'props' && issuePath[1] === 'defaultOpen') {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.defaultOpen".`)
    }

    if (issuePath[0] === 'props' && issuePath[1] === 'groupId') {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.groupId".`)
    }

    if (issuePath[0] === 'props') {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props".`)
    }

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
    const childrenResult = validateLayoutCollection(parseResult.data.children, `${path}.children`, pageId)

    if (childrenResult.status === 'error') return childrenResult

    children = childrenResult.nodes
  }

  return {
    status: 'ready',
    node: {
      type: 'accordion',
      id: parseResult.data.id,
      queryStateFeedback: feedbackResult.queryStateFeedback,
      visibility: visibilityResult.visibility,
      layout: parseResult.data.layout,
      props: {
        label: parseResult.data.props.label,
        defaultOpen: parseResult.data.props.defaultOpen,
        groupId: parseResult.data.props.groupId,
      },
      children,
    },
  }
}

function validateBadgeNode(
  rawNode: Record<string, unknown>,
  path: string,
  pageId: string,
): { status: 'ready'; node: BadgeLayoutNode } | { status: 'error'; error: RuntimeConfigError } {
  const parseResult = badgeNodeSchema.safeParse(rawNode)

  if (!parseResult.success) {
    const issue = parseResult.error.issues[0]
    const issuePath = issue?.path ?? []

    const feedbackIssue = mapQueryStateFeedbackIssue(pageId, path, issue)
    if (feedbackIssue) return feedbackIssue

    const visibilityIssue = mapVisibilityIssue(pageId, path, issue)
    if (visibilityIssue) return visibilityIssue

    const layoutIssue = mapLayoutNodeIssue(pageId, path, issuePath)
    if (layoutIssue) return layoutIssue

    if (issuePath[0] === 'id') {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.id".`)
    }

    if (issuePath[0] === 'props' && issuePath[1] === 'label') {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.label".`)
    }

    if (issuePath[0] === 'props' && issuePath[1] === 'variant') {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.variant".`)
    }

    if (issuePath[0] === 'props' && issuePath[1] === 'color') {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.color".`)
    }

    return mapLeafNodeIssue(pageId, path, issuePath)
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

  return {
    status: 'ready',
    node: {
      type: 'badge',
      id: parseResult.data.id,
      queryStateFeedback: feedbackResult.queryStateFeedback,
      visibility: visibilityResult.visibility,
      layout: parseResult.data.layout,
      props: {
        label: parseResult.data.props.label,
        variant: parseResult.data.props.variant,
        color: parseResult.data.props.color,
      },
    },
  }
}

function validateAlertNode(
  rawNode: Record<string, unknown>,
  path: string,
  pageId: string,
): { status: 'ready'; node: AlertLayoutNode } | { status: 'error'; error: RuntimeConfigError } {
  const parseResult = alertNodeSchema.safeParse(rawNode)

  if (!parseResult.success) {
    const issue = parseResult.error.issues[0]
    const issuePath = issue?.path ?? []

    const feedbackIssue = mapQueryStateFeedbackIssue(pageId, path, issue)
    if (feedbackIssue) return feedbackIssue

    const visibilityIssue = mapVisibilityIssue(pageId, path, issue)
    if (visibilityIssue) return visibilityIssue

    const layoutIssue = mapLayoutNodeIssue(pageId, path, issuePath)
    if (layoutIssue) return layoutIssue

    if (issuePath[0] === 'id') {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.id".`)
    }

    if (issuePath[0] === 'props' && issuePath[1] === 'message') {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.message".`)
    }

    if (issuePath[0] === 'props' && issuePath[1] === 'type') {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.type".`)
    }

    if (issuePath[0] === 'props' && issuePath[1] === 'title') {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.title".`)
    }

    return mapLeafNodeIssue(pageId, path, issuePath)
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

  return {
    status: 'ready',
    node: {
      type: 'alert',
      id: parseResult.data.id,
      queryStateFeedback: feedbackResult.queryStateFeedback,
      visibility: visibilityResult.visibility,
      layout: parseResult.data.layout,
      props: {
        message: parseResult.data.props.message,
        type: parseResult.data.props.type,
        title: parseResult.data.props.title,
      },
    },
  }
}

function validateStatNode(
  rawNode: Record<string, unknown>,
  path: string,
  pageId: string,
): { status: 'ready'; node: StatLayoutNode } | { status: 'error'; error: RuntimeConfigError } {
  const parseResult = statNodeSchema.safeParse(rawNode)

  if (!parseResult.success) {
    const issue = parseResult.error.issues[0]
    const issuePath = issue?.path ?? []

    const feedbackIssue = mapQueryStateFeedbackIssue(pageId, path, issue)
    if (feedbackIssue) return feedbackIssue

    const visibilityIssue = mapVisibilityIssue(pageId, path, issue)
    if (visibilityIssue) return visibilityIssue

    const layoutIssue = mapLayoutNodeIssue(pageId, path, issuePath)
    if (layoutIssue) return layoutIssue

    if (issuePath[0] === 'id') {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.id".`)
    }

    if (issuePath[0] === 'props' && issuePath[1] === 'label') {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.label".`)
    }

    if (issuePath[0] === 'props' && issuePath[1] === 'value') {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.value".`)
    }

    if (issuePath[0] === 'props' && issuePath[1] === 'variant') {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.variant".`)
    }

    if (issuePath[0] === 'props' && issuePath[1] === 'color') {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.color".`)
    }

    return mapLeafNodeIssue(pageId, path, issuePath)
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

  return {
    status: 'ready',
    node: {
      type: 'stat',
      id: parseResult.data.id,
      queryStateFeedback: feedbackResult.queryStateFeedback,
      visibility: visibilityResult.visibility,
      layout: parseResult.data.layout,
      props: {
        label: parseResult.data.props.label,
        value: parseResult.data.props.value,
        variant: parseResult.data.props.variant,
        color: parseResult.data.props.color,
      },
    },
  }
}

function validateDividerNode(
  rawNode: Record<string, unknown>,
  path: string,
  pageId: string,
): { status: 'ready'; node: DividerLayoutNode } | { status: 'error'; error: RuntimeConfigError } {
  const parseResult = dividerNodeSchema.safeParse(rawNode)

  if (!parseResult.success) {
    const issue = parseResult.error.issues[0]
    const issuePath = issue?.path ?? []

    const feedbackIssue = mapQueryStateFeedbackIssue(pageId, path, issue)
    if (feedbackIssue) return feedbackIssue

    const visibilityIssue = mapVisibilityIssue(pageId, path, issue)
    if (visibilityIssue) return visibilityIssue

    const layoutIssue = mapLayoutNodeIssue(pageId, path, issuePath)
    if (layoutIssue) return layoutIssue

    if (issuePath[0] === 'id') {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.id".`)
    }

    if (issuePath[0] === 'props' && issuePath[1] === 'variant') {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.variant".`)
    }

    return mapLeafNodeIssue(pageId, path, issuePath)
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

  return {
    status: 'ready',
    node: {
      type: 'divider',
      id: parseResult.data.id,
      queryStateFeedback: feedbackResult.queryStateFeedback,
      visibility: visibilityResult.visibility,
      layout: parseResult.data.layout,
      props: parseResult.data.props,
    },
  }
}

function validateSkeletonNode(
  rawNode: Record<string, unknown>,
  path: string,
  pageId: string,
): { status: 'ready'; node: SkeletonLayoutNode } | { status: 'error'; error: RuntimeConfigError } {
  const parseResult = skeletonNodeSchema.safeParse(rawNode)

  if (!parseResult.success) {
    const issue = parseResult.error.issues[0]
    const issuePath = issue?.path ?? []

    const feedbackIssue = mapQueryStateFeedbackIssue(pageId, path, issue)
    if (feedbackIssue) return feedbackIssue

    const visibilityIssue = mapVisibilityIssue(pageId, path, issue)
    if (visibilityIssue) return visibilityIssue

    const layoutIssue = mapLayoutNodeIssue(pageId, path, issuePath)
    if (layoutIssue) return layoutIssue

    if (issuePath[0] === 'id') {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.id".`)
    }

    if (issuePath[0] === 'props' && issuePath[1] === 'variant') {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.variant".`)
    }

    if (issuePath[0] === 'props' && issuePath[1] === 'lines') {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.lines".`)
    }

    if (issuePath[0] === 'props' && issuePath[1] === 'width') {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.width".`)
    }

    if (issuePath[0] === 'props' && issuePath[1] === 'height') {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.height".`)
    }

    if (issuePath[0] === 'props' && issuePath[1] === 'rounded') {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.rounded".`)
    }

    if (issuePath[0] === 'props' && issuePath[1] === 'animate') {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.animate".`)
    }

    return mapLeafNodeIssue(pageId, path, issuePath)
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

  return {
    status: 'ready',
    node: {
      type: 'skeleton',
      id: parseResult.data.id,
      queryStateFeedback: feedbackResult.queryStateFeedback,
      visibility: visibilityResult.visibility,
      layout: parseResult.data.layout,
      props: parseResult.data.props,
    },
  }
}

function validateFileInputNode(
  rawNode: Record<string, unknown>,
  path: string,
  pageId: string,
): { status: 'ready'; node: FileInputLayoutNode } | { status: 'error'; error: RuntimeConfigError } {
  const parseResult = fileInputNodeSchema.safeParse(rawNode)

  if (!parseResult.success) {
    const issue = parseResult.error.issues[0]
    const issuePath = issue?.path ?? []

    const feedbackIssue = mapQueryStateFeedbackIssue(pageId, path, issue)
    if (feedbackIssue) return feedbackIssue

    const visibilityIssue = mapVisibilityIssue(pageId, path, issue)
    if (visibilityIssue) return visibilityIssue

    const layoutIssue = mapLayoutNodeIssue(pageId, path, issuePath)
    if (layoutIssue) return layoutIssue

    if (issuePath[0] === 'id') {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.id".`)
    }

    if (issuePath[0] === 'props' && issuePath[1] === 'fieldId') {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.fieldId".`)
    }

    if (issuePath[0] === 'props' && issuePath[1] === 'label') {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.label".`)
    }

    if (issuePath[0] === 'props' && issuePath[1] === 'multiple') {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.multiple".`)
    }

    if (issuePath[0] === 'props' && issuePath[1] === 'capture') {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.capture".`)
    }

    if (issuePath[0] === 'props' && issuePath[1] === 'validations') {
      const validationKey = issuePath[2]
      if (typeof validationKey === 'string') {
        return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.validations.${validationKey}".`)
      }
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.validations".`)
    }

    if (issuePath[0] === 'props') {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props".`)
    }

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

  const rawProps = parseResult.data.props
  const props: FileInputLayoutNode['props'] = {
    fieldId: rawProps.fieldId,
    label: rawProps.label,
  }

  if (rawProps.multiple !== undefined) {
    props.multiple = rawProps.multiple
  }

  if (rawProps.capture !== undefined) {
    props.capture = rawProps.capture
  }

  if (rawProps.validations !== undefined) {
    props.validations = rawProps.validations as FileInputLayoutNode['props']['validations']
  }

  return {
    status: 'ready',
    node: {
      type: 'fileInput',
      id: parseResult.data.id,
      queryStateFeedback: feedbackResult.queryStateFeedback,
      visibility: visibilityResult.visibility,
      layout: parseResult.data.layout,
      props,
    },
  }
}

function validateFileManagerNode(
  rawNode: Record<string, unknown>,
  path: string,
  pageId: string,
): { status: 'ready'; node: FileManagerLayoutNode } | { status: 'error'; error: RuntimeConfigError } {
  const parseResult = fileManagerNodeSchema.safeParse(rawNode)

  if (!parseResult.success) {
    const issue = parseResult.error.issues[0]
    const issuePath = issue?.path ?? []

    const feedbackIssue = mapQueryStateFeedbackIssue(pageId, path, issue)
    if (feedbackIssue) return feedbackIssue

    const visibilityIssue = mapVisibilityIssue(pageId, path, issue)
    if (visibilityIssue) return visibilityIssue

    const layoutIssue = mapLayoutNodeIssue(pageId, path, issuePath)
    if (layoutIssue) return layoutIssue

    if (issuePath[0] === 'id') {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.id".`)
    }

    if (issuePath[0] === 'props' && issuePath.length === 1) {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props".`)
    }

    if (issuePath[0] === 'props' && issuePath[1] === 'multiple') {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.multiple".`)
    }

    if (issuePath[0] === 'props' && issuePath[1] === 'getOperation') {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.getOperation".`)
    }

    if (issuePath[0] === 'props' && issuePath[1] === 'uploadOperation') {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.uploadOperation".`)
    }

    if (issuePath[0] === 'props' && issuePath[1] === 'deleteOperation') {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.deleteOperation".`)
    }

    if (issuePath[0] === 'props' && issuePath[1] === 'viewOperation') {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.viewOperation".`)
    }

    if (issuePath[0] === 'props' && issuePath[1] === 'downloadOperation') {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.downloadOperation".`)
    }

    if (issuePath[0] === 'props' && issuePath[1] === 'pagination') {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.pagination".`)
    }

    if (issuePath[0] === 'props' && issuePath[1] === 'validations') {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.validations".`)
    }

    if (issuePath[0] === 'props' && issuePath[1] === 'labels') {
      if (issue.code === 'unrecognized_keys' && Array.isArray(issue.keys) && issue.keys.length > 0) {
        return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.labels.${issue.keys[0]}".`)
      }
      const labelKey = issuePath[2]
      const labelSuffix = typeof labelKey === 'string' ? `.${labelKey}` : ''
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.labels${labelSuffix}".`)
    }

    return mapLeafNodeIssue(pageId, path, issuePath)
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

  return {
    status: 'ready',
    node: {
      type: 'fileManager',
      id: parseResult.data.id,
      queryStateFeedback: feedbackResult.queryStateFeedback,
      visibility: visibilityResult.visibility,
      layout: parseResult.data.layout,
      props: parseResult.data.props as FileManagerLayoutNode['props'],
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
  if (value === '$key' || value === '$index') {
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
