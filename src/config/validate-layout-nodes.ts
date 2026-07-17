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
import type { BreadcrumbSegment } from './validation-breadcrumb'
import { buildBreadcrumbSegment, enrichedInvalidLayout, enrichErrorResult } from './validation-breadcrumb'
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
  validateToggleNode,
  validateHiddenNode,
  validateCollectionSource,
} from './validate-form-nodes'
import { LINK_ALLOWED_CHILD_TYPES as linkAllowedChildTypes, MODAL_ALLOWED_CHILD_TYPES as modalAllowedChildTypes } from './layout-placement-rules'

const collectionPathSegmentPattern = /^[A-Za-z0-9_-]+$/

export function validateLayoutCollection(
  rawNodes: unknown,
  path: string,
  pageId: string,
  breadcrumb: BreadcrumbSegment[] = [],
): { status: 'ready'; nodes: LayoutNodeCollection } | { status: 'error'; error: RuntimeConfigError } {
  if (!Array.isArray(rawNodes)) {
    return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}".`)
  }

  const nodes: LayoutNode[] = []

  for (let index = 0; index < rawNodes.length; index += 1) {
    const rawItem = rawNodes[index]
    const segment = isRecord(rawItem)
      ? buildBreadcrumbSegment(rawItem, index)
      : { label: `[${index}]` }
    const nodeBreadcrumb = [...breadcrumb, segment]
    const nodeResult = validateLayoutNode(rawItem, `${path}[${index}]`, pageId, nodeBreadcrumb)

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
  breadcrumb: BreadcrumbSegment[] = [],
): { status: 'ready'; node: LayoutNode } | { status: 'error'; error: RuntimeConfigError } {
  if (!isRecord(rawNode)) {
    return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}".`, breadcrumb, {} as Record<string, unknown>)
  }

  if (typeof rawNode.type !== 'string') {
    return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.type".`, breadcrumb, rawNode)
  }

  if (!supportedNodeTypes.includes(rawNode.type as LayoutNodeType)) {
    return unsupportedNodeType(pageId, path, rawNode.type)
  }

  switch (rawNode.type) {
    case 'container':
      return validateContainerNode(rawNode, path, pageId, breadcrumb)
    case 'repeater':
      return validateRepeaterNode(rawNode, path, pageId, breadcrumb)
    case 'heading':
      return validateHeadingNode(rawNode, path, pageId, breadcrumb)
    case 'paragraph':
      return validateParagraphNode(rawNode, path, pageId, breadcrumb)
    case 'list':
      return validateListNode(rawNode, path, pageId, breadcrumb)
    case 'image':
      return validateImageNode(rawNode, path, pageId, breadcrumb)
    case 'table':
      return validateTableNode(rawNode, path, pageId, breadcrumb)
    case 'button':
      return validateButtonNode(rawNode, path, pageId, breadcrumb)
    case 'link':
      return validateLinkNode(rawNode, path, pageId, breadcrumb)
    case 'form':
      return validateFormNode(rawNode, path, pageId, breadcrumb)
    case 'input':
      return validateInputNode(rawNode, path, pageId, breadcrumb)
    case 'textarea':
      return validateTextareaNode(rawNode, path, pageId, breadcrumb)
    case 'select':
      return validateSelectNode(rawNode, path, pageId, breadcrumb)
    case 'radioGroup':
      return validateRadioGroupNode(rawNode, path, pageId, breadcrumb)
    case 'checkboxGroup':
      return validateCheckboxGroupNode(rawNode, path, pageId, breadcrumb)
    case 'modal':
      return validateModalNode(rawNode, path, pageId, breadcrumb)
    case 'tabs':
      return validateTabsNode(rawNode, path, pageId, breadcrumb)
    case 'accordion':
      return validateAccordionNode(rawNode, path, pageId, breadcrumb)
    case 'badge':
      return validateBadgeNode(rawNode, path, pageId, breadcrumb)
    case 'alert':
      return validateAlertNode(rawNode, path, pageId, breadcrumb)
    case 'stat':
      return validateStatNode(rawNode, path, pageId, breadcrumb)
    case 'divider':
      return validateDividerNode(rawNode, path, pageId, breadcrumb)
    case 'skeleton':
      return validateSkeletonNode(rawNode, path, pageId, breadcrumb)
    case 'fileInput':
      return validateFileInputNode(rawNode, path, pageId, breadcrumb)
    case 'fileManager':
      return validateFileManagerNode(rawNode, path, pageId, breadcrumb)
    case 'toggle':
      return validateToggleNode(rawNode, path, pageId, breadcrumb)
    case 'hidden':
      return validateHiddenNode(rawNode, path, pageId, breadcrumb)
  }

  return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.type".`, breadcrumb, rawNode)
}

export function validateQueryStateFeedback(
  rawQueryStateFeedback: LayoutNodeFeedbackFields['queryStateFeedback'],
  path: string,
  pageId: string,
  breadcrumb: BreadcrumbSegment[] = [],
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

    const fallbackResult = validateLayoutCollection(rule.fallback, `${path}.states.${state}.fallback`, pageId, breadcrumb)

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
  breadcrumb: BreadcrumbSegment[] = [],
): { status: 'ready'; node: ContainerLayoutNode } | { status: 'error'; error: RuntimeConfigError } {
  const parseResult = containerNodeSchema.safeParse(rawNode)

  if (!parseResult.success) {
    const issue = parseResult.error.issues[0]
    const issuePath = issue?.path[0]

    if (issuePath === 'id') {
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.id".`, breadcrumb, rawNode)
    }

    if (issuePath === 'props' && issue.path.length === 1) {
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props".`, breadcrumb, rawNode)
    }

    if (issuePath === 'props' && issue.path[1] === 'direction') {
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.direction".`, breadcrumb, rawNode)
    }

    if (issuePath === 'props' && issue.path[1] === 'gap') {
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.gap".`, breadcrumb, rawNode)
    }

    if (issuePath === 'props' && issue.path[1] === 'columns') {
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.columns".`, breadcrumb, rawNode)
    }

    if (issuePath === 'props' && issue.path[1] === 'variant') {
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.variant".`, breadcrumb, rawNode)
    }

    if (issuePath === 'props' && issue.path[1] === 'align') {
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.align".`, breadcrumb, rawNode)
    }

    if (issuePath === 'props' && issue.path[1] === 'justify') {
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.justify".`, breadcrumb, rawNode)
    }

    if (issuePath === 'props' && issue.path[1] === 'wrap') {
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.wrap".`, breadcrumb, rawNode)
    }

    if (issuePath === 'children') {
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.children".`, breadcrumb, rawNode)
    }

    const layoutIssue = mapLayoutNodeIssue(pageId, path, issue.path, breadcrumb, rawNode)

    if (layoutIssue) {
      return layoutIssue
    }

    const feedbackIssue = mapQueryStateFeedbackIssue(pageId, path, issue)

    if (feedbackIssue) {
      return enrichErrorResult(feedbackIssue, breadcrumb, rawNode)
    }

    const visibilityIssue = mapVisibilityIssue(pageId, path, issue)

    if (visibilityIssue) {
      return enrichErrorResult(visibilityIssue, breadcrumb, rawNode)
    }

    return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}".`, breadcrumb, rawNode)
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

  const containerProps = parseResult.data.props

  if (containerProps?.columns !== undefined && containerProps.wrap !== undefined) {
    return enrichedInvalidLayout(
      `Page "${pageId}" has an invalid layout at "${path}.props.wrap": container nodes cannot declare "wrap" when "columns" is present.`,
      breadcrumb, rawNode)
  }

  let children: LayoutNodeCollection | undefined

  if (parseResult.data.children !== undefined) {
    const childrenResult = validateLayoutCollection(parseResult.data.children, `${path}.children`, pageId, breadcrumb)

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
  breadcrumb: BreadcrumbSegment[] = [],
): { status: 'ready'; node: RepeaterLayoutNode } | { status: 'error'; error: RuntimeConfigError } {
  const parseResult = repeaterNodeSchema.safeParse(rawNode)

  if (!parseResult.success) {
    const issue = parseResult.error.issues[0]
    const issuePath = issue?.path ?? []

    const feedbackIssue = mapQueryStateFeedbackIssue(pageId, path, issue)

    if (feedbackIssue) {
      return enrichErrorResult(feedbackIssue, breadcrumb, rawNode)
    }

    const visibilityIssue = mapVisibilityIssue(pageId, path, issue)

    if (visibilityIssue) {
      return enrichErrorResult(visibilityIssue, breadcrumb, rawNode)
    }

    if (issuePath[0] === 'id') {
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.id".`, breadcrumb, rawNode)
    }

    if (issuePath[0] === 'children') {
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.children".`, breadcrumb, rawNode)
    }

    const layoutIssue = mapLayoutNodeIssue(pageId, path, issuePath, breadcrumb, rawNode)

    if (layoutIssue) {
      return layoutIssue
    }

    if (issuePath[0] === 'props' && issuePath[1] === 'template') {
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.template".`, breadcrumb, rawNode)
    }

    if (issuePath[0] === 'props' && issuePath[1] === 'items' && issuePath[2] === 'source') {
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.items.source".`, breadcrumb, rawNode)
    }

    if (issuePath[0] === 'props' && issuePath[1] === 'items' && issuePath[2] === 'key') {
      return enrichedInvalidLayout(
        `Page "${pageId}" has an invalid layout at "${path}.props.items.key": repeater item keys must use a non-empty relative item path.`,
        breadcrumb, rawNode)
    }

    const paginationIssue = mapCollectionPaginationIssue(pageId, path, issue, breadcrumb, rawNode)

    if (paginationIssue) {
      return paginationIssue
    }

    if (issuePath[0] === 'props' && issuePath.length === 1) {
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props".`, breadcrumb, rawNode)
    }

    return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}".`, breadcrumb, rawNode)
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

  const itemsSourceResult = validateCollectionSource(parseResult.data.props.items.source, `${path}.props.items.source`, pageId)

  if (itemsSourceResult.status === 'error') {
    return enrichErrorResult(itemsSourceResult, breadcrumb, rawNode)
  }

  if (!isValidRepeaterItemKeyPath(parseResult.data.props.items.key)) {
    return enrichedInvalidLayout(
      `Page "${pageId}" has an invalid layout at "${path}.props.items.key": repeater item keys must use a non-empty relative item path.`,
      breadcrumb, rawNode)
  }

  const templateResult = validateLayoutCollection(parseResult.data.props.template, `${path}.props.template`, pageId, breadcrumb)

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
  breadcrumb: BreadcrumbSegment[] = [],
  rawNode: Record<string, unknown> = {},
): { status: 'error'; error: RuntimeConfigError } | null {
  const issuePath = issue.path

  if (issuePath[0] !== 'props' || issuePath[1] !== 'pagination') {
    return null
  }

  if (issuePath[2] === 'controls') {
    if (issue.code === 'unrecognized_keys' && Array.isArray(issue.keys) && issue.keys.length > 0) {
      return enrichedInvalidLayout(
        `Page "${pageId}" has an invalid layout at "${path}.props.pagination.controls.${issue.keys[0]}".`,
        breadcrumb,
        rawNode,
      )
    }

    if (issuePath[3] === 'variant') {
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.pagination.controls.variant".`, breadcrumb, rawNode)
    }

    return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.pagination.controls".`, breadcrumb, rawNode)
  }

  if (issue.code === 'unrecognized_keys' && Array.isArray(issue.keys) && issue.keys.length > 0) {
    return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.pagination.${issue.keys[0]}".`, breadcrumb, rawNode)
  }

  if (issuePath[2] === 'enabled') {
    return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.pagination.enabled".`, breadcrumb, rawNode)
  }

  if (issuePath[2] === 'pageSize') {
    return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.pagination.pageSize".`, breadcrumb, rawNode)
  }

  return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.pagination".`, breadcrumb, rawNode)
}

function validateHeadingNode(
  rawNode: Record<string, unknown>,
  path: string,
  pageId: string,
  breadcrumb: BreadcrumbSegment[] = [],
): { status: 'ready'; node: HeadingLayoutNode } | { status: 'error'; error: RuntimeConfigError } {
  const parseResult = headingNodeSchema.safeParse(rawNode)

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
  breadcrumb: BreadcrumbSegment[] = [],
): { status: 'ready'; node: ParagraphLayoutNode } | { status: 'error'; error: RuntimeConfigError } {
  const parseResult = paragraphNodeSchema.safeParse(rawNode)

  if (!parseResult.success) {
    const feedbackIssue = mapQueryStateFeedbackIssue(pageId, path, parseResult.error.issues[0])

    if (feedbackIssue) {
      return enrichErrorResult(feedbackIssue, breadcrumb, rawNode)
    }

    const visibilityIssue = mapVisibilityIssue(pageId, path, parseResult.error.issues[0])

    if (visibilityIssue) {
      return enrichErrorResult(visibilityIssue, breadcrumb, rawNode)
    }

    return mapLeafNodeIssue(pageId, path, parseResult.error.issues[0]?.path ?? [], breadcrumb, rawNode)
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
  breadcrumb: BreadcrumbSegment[] = [],
): { status: 'ready'; node: ListLayoutNode } | { status: 'error'; error: RuntimeConfigError } {
  const parseResult = listNodeSchema.safeParse(rawNode)

  if (!parseResult.success) {
    const feedbackIssue = mapQueryStateFeedbackIssue(pageId, path, parseResult.error.issues[0])

    if (feedbackIssue) {
      return enrichErrorResult(feedbackIssue, breadcrumb, rawNode)
    }

    const visibilityIssue = mapVisibilityIssue(pageId, path, parseResult.error.issues[0])

    if (visibilityIssue) {
      return enrichErrorResult(visibilityIssue, breadcrumb, rawNode)
    }

    return mapLeafNodeIssue(pageId, path, parseResult.error.issues[0]?.path ?? [], breadcrumb, rawNode)
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
  breadcrumb: BreadcrumbSegment[] = [],
): { status: 'ready'; node: ImageLayoutNode } | { status: 'error'; error: RuntimeConfigError } {
  const parseResult = imageNodeSchema.safeParse(rawNode)

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

  const parsedProps = parseResult.data.props as { src?: string; fetch?: { url: string; method?: string; headers?: Record<string, string>; body?: unknown }; alt: string }
  const hasSrc = parsedProps.src !== undefined
  const hasFetch = parsedProps.fetch !== undefined

  // Mutual exclusion: src and fetch cannot both be present
  if (hasSrc && hasFetch) {
    return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props".`, breadcrumb, rawNode)
  }

  // At least one of src or fetch must be present
  if (!hasSrc && !hasFetch) {
    return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.src".`, breadcrumb, rawNode)
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

function validateListItems(
  rawItems: unknown,
  path: string,
  pageId: string,
  breadcrumb: BreadcrumbSegment[] = [],
  rawNode: Record<string, unknown> = {},
): { status: 'ready'; items: ListLayoutNode['props']['items'] } | { status: 'error'; error: RuntimeConfigError } {
  if (Array.isArray(rawItems)) {
    const items: string[] = []

    for (let index = 0; index < rawItems.length; index += 1) {
      if (typeof rawItems[index] !== 'string') {
        return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}[${index}]".`, breadcrumb, rawNode)
      }

      items.push(rawItems[index])
    }

    return {
      status: 'ready',
      items,
    }
  }

  if (!isRecord(rawItems)) {
    return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}".`, breadcrumb, rawNode)
  }

  const hasSource = 'source' in rawItems
  const hasValues = 'values' in rawItems

  if (hasSource && hasValues) {
    return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}".`, breadcrumb, rawNode)
  }

  if (hasSource) {
    const sourceResult = validateCollectionSource(rawItems.source, `${path}.source`, pageId, { allowItemReference: true })

    if (sourceResult.status === 'error') {
      return enrichErrorResult(sourceResult, breadcrumb, rawNode)
    }

    if (rawItems.itemType !== undefined && rawItems.itemType !== 'scalar') {
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.itemType".`, breadcrumb, rawNode)
    }

    if (rawItems.itemText !== undefined && !isValidCollectionProjectionPath(rawItems.itemText)) {
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.itemText".`, breadcrumb, rawNode)
    }

    if (rawItems.itemText !== undefined && rawItems.itemType !== undefined) {
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}".`, breadcrumb, rawNode)
    }

    if (rawItems.itemText === undefined && rawItems.itemType !== 'scalar') {
      return enrichedInvalidLayout(
        `Page "${pageId}" has an invalid layout at "${path}": dynamic scalar collections must declare itemType: "scalar", and dynamic object collections must declare itemText.`,
        breadcrumb,
        rawNode,
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
    return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}".`, breadcrumb, rawNode)
  }

  if (!Array.isArray(rawItems.values)) {
    return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.values".`, breadcrumb, rawNode)
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
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.itemText".`, breadcrumb, rawNode)
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
  return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.values[${Math.max(invalidIndex, 0)}]".`, breadcrumb, rawNode)
}

export function mapLeafNodeIssue(
  pageId: string,
  path: string,
  issuePath: PropertyKey[],
  breadcrumb: BreadcrumbSegment[] = [],
  rawNode: Record<string, unknown> = {},
): { status: 'error'; error: RuntimeConfigError } {
  const layoutIssue = mapLayoutNodeIssue(pageId, path, issuePath, breadcrumb, rawNode)

  if (layoutIssue) {
    return layoutIssue
  }

  if (issuePath[0] === 'id') {
    return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.id".`, breadcrumb, rawNode)
  }

  if (issuePath[0] === 'props' && issuePath.length === 1) {
    return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props".`, breadcrumb, rawNode)
  }

  const formattedIssuePath = issuePath.map(formatPathSegment).join('')
  return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}${formattedIssuePath}".`, breadcrumb, rawNode)
}

export function mapLayoutNodeIssue(
  pageId: string,
  path: string,
  issuePath: PropertyKey[],
  breadcrumb: BreadcrumbSegment[] = [],
  rawNode: Record<string, unknown> = {},
): { status: 'error'; error: RuntimeConfigError } | null {
  if (issuePath[0] === 'layout' && issuePath.length === 1) {
    return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.layout".`, breadcrumb, rawNode)
  }

  if (issuePath[0] === 'layout' && issuePath[1] === 'span') {
    return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.layout.span".`, breadcrumb, rawNode)
  }

  return null
}

function validateModalNode(
  rawNode: Record<string, unknown>,
  path: string,
  pageId: string,
  breadcrumb: BreadcrumbSegment[] = [],
): { status: 'ready'; node: ModalLayoutNode } | { status: 'error'; error: RuntimeConfigError } {
  const parseResult = modalNodeSchema.safeParse(rawNode)

  if (!parseResult.success) {
    const issue = parseResult.error.issues[0]
    const issuePath = issue?.path ?? []

    const feedbackIssue = mapQueryStateFeedbackIssue(pageId, path, issue)
    if (feedbackIssue) return enrichErrorResult(feedbackIssue, breadcrumb, rawNode)

    const visibilityIssue = mapVisibilityIssue(pageId, path, issue)
    if (visibilityIssue) return enrichErrorResult(visibilityIssue, breadcrumb, rawNode)

    if (issuePath[0] === 'id') {
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.id".`, breadcrumb, rawNode)
    }

    if (issuePath[0] === 'props' && issuePath[1] === 'size') {
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.size".`, breadcrumb, rawNode)
    }

    if (issuePath[0] === 'props' && issuePath[1] === 'defaultOpen') {
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.defaultOpen".`, breadcrumb, rawNode)
    }

    if (issuePath[0] === 'props' && issuePath[1] === 'label') {
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.label".`, breadcrumb, rawNode)
    }

    const layoutIssue = mapLayoutNodeIssue(pageId, path, issuePath, breadcrumb, rawNode)
    if (layoutIssue) return enrichErrorResult(layoutIssue, breadcrumb, rawNode)

    return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}".`, breadcrumb, rawNode)
  }

  const feedbackResult = validateQueryStateFeedback(
    parseResult.data.queryStateFeedback as LayoutNodeFeedbackFields['queryStateFeedback'],
    `${path}.queryStateFeedback`,
    pageId,
    breadcrumb,
  )

  if (feedbackResult.status === 'error') return feedbackResult

  const visibilityResult = validateVisibility(
    parseResult.data.visibility as LayoutNodeFeedbackFields['visibility'],
    `${path}.visibility`,
    pageId,
  )

  if (visibilityResult.status === 'error') return enrichErrorResult(visibilityResult, breadcrumb, rawNode)

  let children: LayoutNodeCollection | undefined

  if (parseResult.data.children !== undefined) {
    for (let i = 0; i < parseResult.data.children.length; i += 1) {
      const child = parseResult.data.children[i]
      const childType = isRecord(child) ? String(child.type) : undefined

      if (!childType || !modalAllowedChildTypes.has(childType as LayoutNodeType)) {
        return enrichedInvalidLayout(
          `Page "${pageId}" has an invalid layout at "${path}.children[${i}]": modal children may only be container, form, heading, paragraph, list, image, table, button, repeater, accordion or fileManager nodes.`,
          breadcrumb, rawNode)
      }
    }

    const childrenResult = validateLayoutCollection(parseResult.data.children, `${path}.children`, pageId, breadcrumb)
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
  breadcrumb: BreadcrumbSegment[] = [],
): { status: 'ready'; node: TabsLayoutNode } | { status: 'error'; error: RuntimeConfigError } {
  const parseResult = tabsNodeSchema.safeParse(rawNode)

  if (!parseResult.success) {
    const issue = parseResult.error.issues[0]
    const issuePath = issue?.path ?? []

    const feedbackIssue = mapQueryStateFeedbackIssue(pageId, path, issue)
    if (feedbackIssue) return enrichErrorResult(feedbackIssue, breadcrumb, rawNode)

    const visibilityIssue = mapVisibilityIssue(pageId, path, issue)
    if (visibilityIssue) return enrichErrorResult(visibilityIssue, breadcrumb, rawNode)

    const layoutIssue = mapLayoutNodeIssue(pageId, path, issuePath, breadcrumb, rawNode)
    if (layoutIssue) return enrichErrorResult(layoutIssue, breadcrumb, rawNode)

    if (issuePath[0] === 'id') {
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.id".`, breadcrumb, rawNode)
    }

    if (issuePath[0] === 'props' && issuePath[1] === 'orientation') {
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.orientation".`, breadcrumb, rawNode)
    }

    if (issuePath[0] === 'props' && issuePath[1] === 'items' && typeof issuePath[2] === 'number' && issuePath[3] === 'label') {
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.items[${issuePath[2]}].label".`, breadcrumb, rawNode)
    }

    if (issuePath[0] === 'props' && issuePath[1] === 'items' && typeof issuePath[2] === 'number' && issuePath[3] === 'visibility') {
      const itemIndex = issuePath[2]
      const remainingSegments = issuePath.slice(3).map(formatPathSegment).join('')
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.items[${itemIndex}]${remainingSegments}".`, breadcrumb, rawNode)
    }

    if (issuePath[0] === 'props' && issuePath[1] === 'items') {
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.items".`, breadcrumb, rawNode)
    }

    if (issuePath[0] === 'props') {
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props".`, breadcrumb, rawNode)
    }

    return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}".`, breadcrumb, rawNode)
  }

  const feedbackResult = validateQueryStateFeedback(
    parseResult.data.queryStateFeedback as LayoutNodeFeedbackFields['queryStateFeedback'],
    `${path}.queryStateFeedback`,
    pageId,
    breadcrumb,
  )

  if (feedbackResult.status === 'error') return feedbackResult

  const visibilityResult = validateVisibility(
    parseResult.data.visibility as LayoutNodeFeedbackFields['visibility'],
    `${path}.visibility`,
    pageId,
  )

  if (visibilityResult.status === 'error') return enrichErrorResult(visibilityResult, breadcrumb, rawNode)

  const rawItems = (rawNode.props as Record<string, unknown>).items
  if (!Array.isArray(rawItems)) {
    return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.items".`, breadcrumb, rawNode)
  }

  const normalizedItems: TabsLayoutNode['props']['items'] = []

  for (let index = 0; index < rawItems.length; index += 1) {
    const rawItem = rawItems[index]

    if (!isRecord(rawItem)) {
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.items[${index}]".`, breadcrumb, rawNode)
    }

    if (typeof rawItem.label !== 'string') {
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.items[${index}].label".`, breadcrumb, rawNode)
    }

    const tabBreadcrumb: BreadcrumbSegment[] = [...breadcrumb, { label: `tab("${rawItem.label}")` }]

    const itemVisibilityResult = validateVisibility(
      rawItem.visibility as LayoutNodeFeedbackFields['visibility'],
      `${path}.props.items[${index}].visibility`,
      pageId,
    )

    if (itemVisibilityResult.status === 'error') return enrichErrorResult(itemVisibilityResult, tabBreadcrumb, rawNode)

    let children: LayoutNodeCollection | undefined

    if (rawItem.children !== undefined) {
      const childrenResult = validateLayoutCollection(rawItem.children, `${path}.props.items[${index}].children`, pageId, tabBreadcrumb)

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
  breadcrumb: BreadcrumbSegment[] = [],
): { status: 'ready'; node: ButtonLayoutNode } | { status: 'error'; error: RuntimeConfigError } {
  const parseResult = buttonNodeSchema.safeParse(rawNode)

  if (!parseResult.success) {
    const issue = parseResult.error.issues[0]
    const issuePath = issue?.path ?? []

    const feedbackIssue = mapQueryStateFeedbackIssue(pageId, path, issue)

    if (feedbackIssue) {
      return enrichErrorResult(feedbackIssue, breadcrumb, rawNode)
    }

    const visibilityIssue = mapVisibilityIssue(pageId, path, issue)

    if (visibilityIssue) {
      return enrichErrorResult(visibilityIssue, breadcrumb, rawNode)
    }

    if (issuePath[0] === 'id') {
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.id".`, breadcrumb, rawNode)
    }

    if (issuePath[0] === 'props' && issuePath.length === 1) {
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props".`, breadcrumb, rawNode)
    }

    if (issuePath[0] === 'props' && issuePath[1] === 'label') {
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.label".`, breadcrumb, rawNode)
    }

    if (issuePath[0] === 'props' && issuePath[1] === 'action') {
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.action".`, breadcrumb, rawNode)
    }

    if (issuePath[0] === 'props' && issuePath[1] === 'color') {
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.color".`, breadcrumb, rawNode)
    }

    if (issuePath[0] === 'props' && issuePath[1] === 'variant') {
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.variant".`, breadcrumb, rawNode)
    }

    if (issuePath[0] === 'props' && issuePath[1] === 'fullWidth') {
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.fullWidth".`, breadcrumb, rawNode)
    }

    if (issuePath[0] === 'props' && issuePath[1] === 'iconPosition') {
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.iconPosition".`, breadcrumb, rawNode)
    }

    const layoutIssue = mapLayoutNodeIssue(pageId, path, issuePath, breadcrumb, rawNode)

    if (layoutIssue) {
      return layoutIssue
    }

    return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props".`, breadcrumb, rawNode)
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

  let action: RuntimeUiAction | undefined

  if (parseResult.data.props.action !== undefined) {
    const actionResult = validateRuntimeUiAction(parseResult.data.props.action, `${path}.props.action`, pageId)

    if (actionResult.status === 'error') {
      return enrichErrorResult(actionResult, breadcrumb, rawNode)
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
  breadcrumb: BreadcrumbSegment[] = [],
): { status: 'ready'; node: LinkLayoutNode } | { status: 'error'; error: RuntimeConfigError } {
  const parseResult = linkNodeSchema.safeParse(rawNode)

  if (!parseResult.success) {
    const issue = parseResult.error.issues[0]
    const issuePath = issue?.path ?? []

    const feedbackIssue = mapQueryStateFeedbackIssue(pageId, path, issue)
    if (feedbackIssue) return enrichErrorResult(feedbackIssue, breadcrumb, rawNode)

    const visibilityIssue = mapVisibilityIssue(pageId, path, issue)
    if (visibilityIssue) return enrichErrorResult(visibilityIssue, breadcrumb, rawNode)

    const layoutIssue = mapLayoutNodeIssue(pageId, path, issuePath, breadcrumb, rawNode)
    if (layoutIssue) return enrichErrorResult(layoutIssue, breadcrumb, rawNode)

    if (issuePath[0] === 'id') {
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.id".`, breadcrumb, rawNode)
    }

    if (issuePath[0] === 'props' && issuePath.length === 1) {
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props".`, breadcrumb, rawNode)
    }

    if (issuePath[0] === 'props' && issuePath[1] === 'label') {
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.label".`, breadcrumb, rawNode)
    }

    if (issuePath[0] === 'props' && issuePath[1] === 'href') {
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.href".`, breadcrumb, rawNode)
    }

    if (issuePath[0] === 'props' && issuePath[1] === 'download') {
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.download".`, breadcrumb, rawNode)
    }

    if (issuePath[0] === 'props' && issuePath[1] === 'target') {
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.target".`, breadcrumb, rawNode)
    }

    if (issuePath[0] === 'props' && issuePath[1] === 'action') {
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.action".`, breadcrumb, rawNode)
    }

    if (issuePath[0] === 'props' && issuePath[1] === 'iconPosition') {
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.iconPosition".`, breadcrumb, rawNode)
    }

    return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props".`, breadcrumb, rawNode)
  }

  const feedbackResult = validateQueryStateFeedback(
    parseResult.data.queryStateFeedback as LayoutNodeFeedbackFields['queryStateFeedback'],
    `${path}.queryStateFeedback`,
    pageId,
    breadcrumb,
  )

  if (feedbackResult.status === 'error') return feedbackResult

  const visibilityResult = validateVisibility(
    parseResult.data.visibility as LayoutNodeFeedbackFields['visibility'],
    `${path}.visibility`,
    pageId,
  )

  if (visibilityResult.status === 'error') return enrichErrorResult(visibilityResult, breadcrumb, rawNode)

  const { href, download, target, action, label, icon, iconPosition } = parseResult.data.props
  const hasChildren = parseResult.data.children !== undefined
  const hasLabel = label !== undefined
  const hasIcon = icon !== undefined
  const hasIconPosition = iconPosition !== undefined
  const hasHref = href !== undefined
  const hasAction = action !== undefined

  // Cross-validation (1): children and props.label are mutually exclusive
  if (hasChildren && hasLabel) {
    return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}": link nodes cannot have both props.label and children.`, breadcrumb, rawNode)
  }

  // Cross-validation (2): children and props.icon are mutually exclusive
  if (hasChildren && hasIcon) {
    return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}": link nodes cannot have both props.icon and children.`, breadcrumb, rawNode)
  }

  // Cross-validation (2b): children and props.iconPosition are mutually exclusive
  if (hasChildren && hasIconPosition) {
    return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}": link nodes cannot have both props.icon and children.`, breadcrumb, rawNode)
  }

  // Cross-validation (3): must have either props.label or children
  if (!hasChildren && !hasLabel) {
    return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}": link nodes must have either props.label or children.`, breadcrumb, rawNode)
  }

  // Cross-validation (4): children cannot be empty
  if (hasChildren && parseResult.data.children!.length === 0) {
    return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.children": link children cannot be empty.`, breadcrumb, rawNode)
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
    const childrenResult = validateLayoutCollection(parseResult.data.children!, `${path}.children`, pageId, breadcrumb)

    if (childrenResult.status === 'error') {
      return childrenResult
    }

    children = childrenResult.nodes
  }

  // Cross-validation (7): href and action are mutually exclusive
  if (hasHref && hasAction) {
    return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}": link nodes cannot have both props.href and props.action.`, breadcrumb, rawNode)
  }

  // Cross-validation (7): must have either href or action
  if (!hasHref && !hasAction) {
    return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}": link nodes must have either props.href or props.action.`, breadcrumb, rawNode)
  }

  // Cross-validation (7): download requires href
  if (download !== undefined && !hasHref) {
    return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.download": download requires props.href.`, breadcrumb, rawNode)
  }

  // Cross-validation (7): target requires href
  if (target !== undefined && !hasHref) {
    return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.target": target requires props.href.`, breadcrumb, rawNode)
  }

  // Cross-validation (7): action.type must be navigateTo or goBack
  let validatedAction: LinkLayoutNode['props']['action'] | undefined
  if (hasAction) {
    const rawAction = action as Record<string, unknown>

    if (rawAction.type !== 'navigateTo' && rawAction.type !== 'goBack') {
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.action.type".`, breadcrumb, rawNode)
    }

    const linkActionResult = validateRuntimeUiAction(rawAction, `${path}.props.action`, pageId)

    if (linkActionResult.status === 'error') {
      return enrichErrorResult(linkActionResult, breadcrumb, rawNode)
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
  breadcrumb: BreadcrumbSegment[] = [],
): { status: 'ready' } | { status: 'error'; error: RuntimeConfigError } {
  for (let i = 0; i < children.length; i += 1) {
    const child = children[i]

    if (!isRecord(child)) {
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${basePath}[${i}]": link children may only be container, heading, paragraph, list, image, badge, alert, stat, divider or skeleton nodes.`, breadcrumb, isRecord(child) ? child : {})
    }

    const childType = typeof child.type === 'string' ? child.type : undefined

    if (!childType || !linkAllowedChildTypes.has(childType as LayoutNodeType)) {
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${basePath}[${i}]": link children may only be container, heading, paragraph, list, image, badge, alert, stat, divider or skeleton nodes.`, breadcrumb, isRecord(child) ? child : {})
    }

    // Recurse into container children
    if (childType === 'container' && child.children !== undefined) {
      const nestedCheck = checkLinkChildrenAllowedTypes(child.children as unknown[], `${basePath}[${i}].children`, pageId, breadcrumb)

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

  const sourceResult = validateCollectionSource(rawRows.source, `${path}.source`, pageId, { allowItemReference: true })

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

function validateAccordionNode(
  rawNode: Record<string, unknown>,
  path: string,
  pageId: string,
  breadcrumb: BreadcrumbSegment[] = [],
): { status: 'ready'; node: AccordionLayoutNode } | { status: 'error'; error: RuntimeConfigError } {
  const parseResult = accordionNodeSchema.safeParse(rawNode)

  if (!parseResult.success) {
    const issue = parseResult.error.issues[0]
    const issuePath = issue?.path ?? []

    const feedbackIssue = mapQueryStateFeedbackIssue(pageId, path, issue)
    if (feedbackIssue) return enrichErrorResult(feedbackIssue, breadcrumb, rawNode)

    const visibilityIssue = mapVisibilityIssue(pageId, path, issue)
    if (visibilityIssue) return enrichErrorResult(visibilityIssue, breadcrumb, rawNode)

    const layoutIssue = mapLayoutNodeIssue(pageId, path, issuePath, breadcrumb, rawNode)
    if (layoutIssue) return enrichErrorResult(layoutIssue, breadcrumb, rawNode)

    if (issuePath[0] === 'id') {
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.id".`, breadcrumb, rawNode)
    }

    if (issuePath[0] === 'props' && issuePath[1] === 'label') {
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.label".`, breadcrumb, rawNode)
    }

    if (issuePath[0] === 'props' && issuePath[1] === 'defaultOpen') {
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.defaultOpen".`, breadcrumb, rawNode)
    }

    if (issuePath[0] === 'props' && issuePath[1] === 'groupId') {
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.groupId".`, breadcrumb, rawNode)
    }

    if (issuePath[0] === 'props') {
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props".`, breadcrumb, rawNode)
    }

    return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}".`, breadcrumb, rawNode)
  }

  const feedbackResult = validateQueryStateFeedback(
    parseResult.data.queryStateFeedback as LayoutNodeFeedbackFields['queryStateFeedback'],
    `${path}.queryStateFeedback`,
    pageId,
    breadcrumb,
  )

  if (feedbackResult.status === 'error') return feedbackResult

  const visibilityResult = validateVisibility(
    parseResult.data.visibility as LayoutNodeFeedbackFields['visibility'],
    `${path}.visibility`,
    pageId,
  )

  if (visibilityResult.status === 'error') return enrichErrorResult(visibilityResult, breadcrumb, rawNode)

  let children: LayoutNodeCollection | undefined

  if (parseResult.data.children !== undefined) {
    const childrenResult = validateLayoutCollection(parseResult.data.children, `${path}.children`, pageId, breadcrumb)

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
  breadcrumb: BreadcrumbSegment[] = [],
): { status: 'ready'; node: BadgeLayoutNode } | { status: 'error'; error: RuntimeConfigError } {
  const parseResult = badgeNodeSchema.safeParse(rawNode)

  if (!parseResult.success) {
    const issue = parseResult.error.issues[0]
    const issuePath = issue?.path ?? []

    const feedbackIssue = mapQueryStateFeedbackIssue(pageId, path, issue)
    if (feedbackIssue) return enrichErrorResult(feedbackIssue, breadcrumb, rawNode)

    const visibilityIssue = mapVisibilityIssue(pageId, path, issue)
    if (visibilityIssue) return enrichErrorResult(visibilityIssue, breadcrumb, rawNode)

    const layoutIssue = mapLayoutNodeIssue(pageId, path, issuePath, breadcrumb, rawNode)
    if (layoutIssue) return enrichErrorResult(layoutIssue, breadcrumb, rawNode)

    if (issuePath[0] === 'id') {
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.id".`, breadcrumb, rawNode)
    }

    if (issuePath[0] === 'props' && issuePath[1] === 'label') {
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.label".`, breadcrumb, rawNode)
    }

    if (issuePath[0] === 'props' && issuePath[1] === 'variant') {
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.variant".`, breadcrumb, rawNode)
    }

    if (issuePath[0] === 'props' && issuePath[1] === 'color') {
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.color".`, breadcrumb, rawNode)
    }

    return mapLeafNodeIssue(pageId, path, issuePath, breadcrumb, rawNode)
  }

  const feedbackResult = validateQueryStateFeedback(
    parseResult.data.queryStateFeedback as LayoutNodeFeedbackFields['queryStateFeedback'],
    `${path}.queryStateFeedback`,
    pageId,
    breadcrumb,
  )

  if (feedbackResult.status === 'error') return feedbackResult

  const visibilityResult = validateVisibility(
    parseResult.data.visibility as LayoutNodeFeedbackFields['visibility'],
    `${path}.visibility`,
    pageId,
  )

  if (visibilityResult.status === 'error') return enrichErrorResult(visibilityResult, breadcrumb, rawNode)

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
  breadcrumb: BreadcrumbSegment[] = [],
): { status: 'ready'; node: AlertLayoutNode } | { status: 'error'; error: RuntimeConfigError } {
  const parseResult = alertNodeSchema.safeParse(rawNode)

  if (!parseResult.success) {
    const issue = parseResult.error.issues[0]
    const issuePath = issue?.path ?? []

    const feedbackIssue = mapQueryStateFeedbackIssue(pageId, path, issue)
    if (feedbackIssue) return enrichErrorResult(feedbackIssue, breadcrumb, rawNode)

    const visibilityIssue = mapVisibilityIssue(pageId, path, issue)
    if (visibilityIssue) return enrichErrorResult(visibilityIssue, breadcrumb, rawNode)

    const layoutIssue = mapLayoutNodeIssue(pageId, path, issuePath, breadcrumb, rawNode)
    if (layoutIssue) return enrichErrorResult(layoutIssue, breadcrumb, rawNode)

    if (issuePath[0] === 'id') {
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.id".`, breadcrumb, rawNode)
    }

    if (issuePath[0] === 'props' && issuePath[1] === 'message') {
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.message".`, breadcrumb, rawNode)
    }

    if (issuePath[0] === 'props' && issuePath[1] === 'type') {
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.type".`, breadcrumb, rawNode)
    }

    if (issuePath[0] === 'props' && issuePath[1] === 'title') {
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.title".`, breadcrumb, rawNode)
    }

    return mapLeafNodeIssue(pageId, path, issuePath, breadcrumb, rawNode)
  }

  const feedbackResult = validateQueryStateFeedback(
    parseResult.data.queryStateFeedback as LayoutNodeFeedbackFields['queryStateFeedback'],
    `${path}.queryStateFeedback`,
    pageId,
    breadcrumb,
  )

  if (feedbackResult.status === 'error') return feedbackResult

  const visibilityResult = validateVisibility(
    parseResult.data.visibility as LayoutNodeFeedbackFields['visibility'],
    `${path}.visibility`,
    pageId,
  )

  if (visibilityResult.status === 'error') return enrichErrorResult(visibilityResult, breadcrumb, rawNode)

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
  breadcrumb: BreadcrumbSegment[] = [],
): { status: 'ready'; node: StatLayoutNode } | { status: 'error'; error: RuntimeConfigError } {
  const parseResult = statNodeSchema.safeParse(rawNode)

  if (!parseResult.success) {
    const issue = parseResult.error.issues[0]
    const issuePath = issue?.path ?? []

    const feedbackIssue = mapQueryStateFeedbackIssue(pageId, path, issue)
    if (feedbackIssue) return enrichErrorResult(feedbackIssue, breadcrumb, rawNode)

    const visibilityIssue = mapVisibilityIssue(pageId, path, issue)
    if (visibilityIssue) return enrichErrorResult(visibilityIssue, breadcrumb, rawNode)

    const layoutIssue = mapLayoutNodeIssue(pageId, path, issuePath, breadcrumb, rawNode)
    if (layoutIssue) return enrichErrorResult(layoutIssue, breadcrumb, rawNode)

    if (issuePath[0] === 'id') {
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.id".`, breadcrumb, rawNode)
    }

    if (issuePath[0] === 'props' && issuePath[1] === 'label') {
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.label".`, breadcrumb, rawNode)
    }

    if (issuePath[0] === 'props' && issuePath[1] === 'value') {
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.value".`, breadcrumb, rawNode)
    }

    if (issuePath[0] === 'props' && issuePath[1] === 'variant') {
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.variant".`, breadcrumb, rawNode)
    }

    if (issuePath[0] === 'props' && issuePath[1] === 'color') {
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.color".`, breadcrumb, rawNode)
    }

    return mapLeafNodeIssue(pageId, path, issuePath, breadcrumb, rawNode)
  }

  const feedbackResult = validateQueryStateFeedback(
    parseResult.data.queryStateFeedback as LayoutNodeFeedbackFields['queryStateFeedback'],
    `${path}.queryStateFeedback`,
    pageId,
    breadcrumb,
  )

  if (feedbackResult.status === 'error') return feedbackResult

  const visibilityResult = validateVisibility(
    parseResult.data.visibility as LayoutNodeFeedbackFields['visibility'],
    `${path}.visibility`,
    pageId,
  )

  if (visibilityResult.status === 'error') return enrichErrorResult(visibilityResult, breadcrumb, rawNode)

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
  breadcrumb: BreadcrumbSegment[] = [],
): { status: 'ready'; node: DividerLayoutNode } | { status: 'error'; error: RuntimeConfigError } {
  const parseResult = dividerNodeSchema.safeParse(rawNode)

  if (!parseResult.success) {
    const issue = parseResult.error.issues[0]
    const issuePath = issue?.path ?? []

    const feedbackIssue = mapQueryStateFeedbackIssue(pageId, path, issue)
    if (feedbackIssue) return enrichErrorResult(feedbackIssue, breadcrumb, rawNode)

    const visibilityIssue = mapVisibilityIssue(pageId, path, issue)
    if (visibilityIssue) return enrichErrorResult(visibilityIssue, breadcrumb, rawNode)

    const layoutIssue = mapLayoutNodeIssue(pageId, path, issuePath, breadcrumb, rawNode)
    if (layoutIssue) return enrichErrorResult(layoutIssue, breadcrumb, rawNode)

    if (issuePath[0] === 'id') {
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.id".`, breadcrumb, rawNode)
    }

    if (issuePath[0] === 'props' && issuePath[1] === 'variant') {
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.variant".`, breadcrumb, rawNode)
    }

    return mapLeafNodeIssue(pageId, path, issuePath, breadcrumb, rawNode)
  }

  const feedbackResult = validateQueryStateFeedback(
    parseResult.data.queryStateFeedback as LayoutNodeFeedbackFields['queryStateFeedback'],
    `${path}.queryStateFeedback`,
    pageId,
    breadcrumb,
  )

  if (feedbackResult.status === 'error') return feedbackResult

  const visibilityResult = validateVisibility(
    parseResult.data.visibility as LayoutNodeFeedbackFields['visibility'],
    `${path}.visibility`,
    pageId,
  )

  if (visibilityResult.status === 'error') return enrichErrorResult(visibilityResult, breadcrumb, rawNode)

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
  breadcrumb: BreadcrumbSegment[] = [],
): { status: 'ready'; node: SkeletonLayoutNode } | { status: 'error'; error: RuntimeConfigError } {
  const parseResult = skeletonNodeSchema.safeParse(rawNode)

  if (!parseResult.success) {
    const issue = parseResult.error.issues[0]
    const issuePath = issue?.path ?? []

    const feedbackIssue = mapQueryStateFeedbackIssue(pageId, path, issue)
    if (feedbackIssue) return enrichErrorResult(feedbackIssue, breadcrumb, rawNode)

    const visibilityIssue = mapVisibilityIssue(pageId, path, issue)
    if (visibilityIssue) return enrichErrorResult(visibilityIssue, breadcrumb, rawNode)

    const layoutIssue = mapLayoutNodeIssue(pageId, path, issuePath, breadcrumb, rawNode)
    if (layoutIssue) return enrichErrorResult(layoutIssue, breadcrumb, rawNode)

    if (issuePath[0] === 'id') {
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.id".`, breadcrumb, rawNode)
    }

    if (issuePath[0] === 'props' && issuePath[1] === 'variant') {
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.variant".`, breadcrumb, rawNode)
    }

    if (issuePath[0] === 'props' && issuePath[1] === 'lines') {
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.lines".`, breadcrumb, rawNode)
    }

    if (issuePath[0] === 'props' && issuePath[1] === 'width') {
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.width".`, breadcrumb, rawNode)
    }

    if (issuePath[0] === 'props' && issuePath[1] === 'height') {
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.height".`, breadcrumb, rawNode)
    }

    if (issuePath[0] === 'props' && issuePath[1] === 'rounded') {
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.rounded".`, breadcrumb, rawNode)
    }

    if (issuePath[0] === 'props' && issuePath[1] === 'animate') {
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.animate".`, breadcrumb, rawNode)
    }

    return mapLeafNodeIssue(pageId, path, issuePath, breadcrumb, rawNode)
  }

  const feedbackResult = validateQueryStateFeedback(
    parseResult.data.queryStateFeedback as LayoutNodeFeedbackFields['queryStateFeedback'],
    `${path}.queryStateFeedback`,
    pageId,
    breadcrumb,
  )

  if (feedbackResult.status === 'error') return feedbackResult

  const visibilityResult = validateVisibility(
    parseResult.data.visibility as LayoutNodeFeedbackFields['visibility'],
    `${path}.visibility`,
    pageId,
  )

  if (visibilityResult.status === 'error') return enrichErrorResult(visibilityResult, breadcrumb, rawNode)

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
  breadcrumb: BreadcrumbSegment[] = [],
): { status: 'ready'; node: FileInputLayoutNode } | { status: 'error'; error: RuntimeConfigError } {
  const parseResult = fileInputNodeSchema.safeParse(rawNode)

  if (!parseResult.success) {
    const issue = parseResult.error.issues[0]
    const issuePath = issue?.path ?? []

    const feedbackIssue = mapQueryStateFeedbackIssue(pageId, path, issue)
    if (feedbackIssue) return enrichErrorResult(feedbackIssue, breadcrumb, rawNode)

    const visibilityIssue = mapVisibilityIssue(pageId, path, issue)
    if (visibilityIssue) return enrichErrorResult(visibilityIssue, breadcrumb, rawNode)

    const layoutIssue = mapLayoutNodeIssue(pageId, path, issuePath, breadcrumb, rawNode)
    if (layoutIssue) return enrichErrorResult(layoutIssue, breadcrumb, rawNode)

    if (issuePath[0] === 'id') {
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.id".`, breadcrumb, rawNode)
    }

    if (issuePath[0] === 'props' && issuePath[1] === 'fieldId') {
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.fieldId".`, breadcrumb, rawNode)
    }

    if (issuePath[0] === 'props' && issuePath[1] === 'label') {
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.label".`, breadcrumb, rawNode)
    }

    if (issuePath[0] === 'props' && issuePath[1] === 'multiple') {
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.multiple".`, breadcrumb, rawNode)
    }

    if (issuePath[0] === 'props' && issuePath[1] === 'capture') {
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.capture".`, breadcrumb, rawNode)
    }

    if (issuePath[0] === 'props' && issuePath[1] === 'validations') {
      const validationKey = issuePath[2]
      if (typeof validationKey === 'string') {
        return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.validations.${validationKey}".`, breadcrumb, rawNode)
      }
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.validations".`, breadcrumb, rawNode)
    }

    if (issuePath[0] === 'props') {
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props".`, breadcrumb, rawNode)
    }

    return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}".`, breadcrumb, rawNode)
  }

  const feedbackResult = validateQueryStateFeedback(
    parseResult.data.queryStateFeedback as LayoutNodeFeedbackFields['queryStateFeedback'],
    `${path}.queryStateFeedback`,
    pageId,
    breadcrumb,
  )

  if (feedbackResult.status === 'error') return feedbackResult

  const visibilityResult = validateVisibility(
    parseResult.data.visibility as LayoutNodeFeedbackFields['visibility'],
    `${path}.visibility`,
    pageId,
  )

  if (visibilityResult.status === 'error') return enrichErrorResult(visibilityResult, breadcrumb, rawNode)

  const rawProps = parseResult.data.props
  const props: FileInputLayoutNode['props'] = {
    fieldId: rawProps.fieldId,
    label: rawProps.label,
  }

  if (rawProps.tooltip !== undefined) {
    props.tooltip = rawProps.tooltip
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
  breadcrumb: BreadcrumbSegment[] = [],
): { status: 'ready'; node: FileManagerLayoutNode } | { status: 'error'; error: RuntimeConfigError } {
  const parseResult = fileManagerNodeSchema.safeParse(rawNode)

  if (!parseResult.success) {
    const issue = parseResult.error.issues[0]
    const issuePath = issue?.path ?? []

    const feedbackIssue = mapQueryStateFeedbackIssue(pageId, path, issue)
    if (feedbackIssue) return enrichErrorResult(feedbackIssue, breadcrumb, rawNode)

    const visibilityIssue = mapVisibilityIssue(pageId, path, issue)
    if (visibilityIssue) return enrichErrorResult(visibilityIssue, breadcrumb, rawNode)

    const layoutIssue = mapLayoutNodeIssue(pageId, path, issuePath, breadcrumb, rawNode)
    if (layoutIssue) return enrichErrorResult(layoutIssue, breadcrumb, rawNode)

    if (issuePath[0] === 'id') {
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.id".`, breadcrumb, rawNode)
    }

    if (issuePath[0] === 'props' && issuePath.length === 1) {
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props".`, breadcrumb, rawNode)
    }

    if (issuePath[0] === 'props' && issuePath[1] === 'multiple') {
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.multiple".`, breadcrumb, rawNode)
    }

    if (issuePath[0] === 'props' && issuePath[1] === 'getOperation') {
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.getOperation".`, breadcrumb, rawNode)
    }

    if (issuePath[0] === 'props' && issuePath[1] === 'uploadOperation') {
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.uploadOperation".`, breadcrumb, rawNode)
    }

    if (issuePath[0] === 'props' && issuePath[1] === 'deleteOperation') {
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.deleteOperation".`, breadcrumb, rawNode)
    }

    if (issuePath[0] === 'props' && issuePath[1] === 'viewOperation') {
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.viewOperation".`, breadcrumb, rawNode)
    }

    if (issuePath[0] === 'props' && issuePath[1] === 'downloadOperation') {
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.downloadOperation".`, breadcrumb, rawNode)
    }

    if (issuePath[0] === 'props' && issuePath[1] === 'pagination') {
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.pagination".`, breadcrumb, rawNode)
    }

    if (issuePath[0] === 'props' && issuePath[1] === 'validations') {
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.validations".`, breadcrumb, rawNode)
    }

    if (issuePath[0] === 'props' && issuePath[1] === 'labels') {
      if (issue.code === 'unrecognized_keys' && Array.isArray(issue.keys) && issue.keys.length > 0) {
        return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.labels.${issue.keys[0]}".`, breadcrumb, rawNode)
      }
      const labelKey = issuePath[2]
      const labelSuffix = typeof labelKey === 'string' ? `.${labelKey}` : ''
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.labels${labelSuffix}".`, breadcrumb, rawNode)
    }

    return mapLeafNodeIssue(pageId, path, issuePath, breadcrumb, rawNode)
  }

  const feedbackResult = validateQueryStateFeedback(
    parseResult.data.queryStateFeedback as LayoutNodeFeedbackFields['queryStateFeedback'],
    `${path}.queryStateFeedback`,
    pageId,
    breadcrumb,
  )

  if (feedbackResult.status === 'error') return feedbackResult

  const visibilityResult = validateVisibility(
    parseResult.data.visibility as LayoutNodeFeedbackFields['visibility'],
    `${path}.visibility`,
    pageId,
  )

  if (visibilityResult.status === 'error') return enrichErrorResult(visibilityResult, breadcrumb, rawNode)

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
