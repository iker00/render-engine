import type {
  HeadingLayoutNode,
  LayoutNodeFeedbackFields,
  ListLayoutNode,
  ParagraphLayoutNode,
  RuntimeCollectionObjectItem,
  RuntimeConfigError,
} from './runtime-config-types'
import { headingNodeSchema, listNodeSchema, paragraphNodeSchema } from './runtime-config-zod'
import type { BreadcrumbSegment } from './validation-breadcrumb'
import { enrichedInvalidLayout, enrichErrorResult } from './validation-breadcrumb'
import { validateQueryStateFeedback } from './validate-layout-nodes-core'
import { mapLeafNodeIssue } from './validate-layout-issue-mapping'
import { mapQueryStateFeedbackIssue, mapVisibilityIssue, validateVisibility } from './validate-actions-visibility'
import { validateCollectionSource } from './validate-collection-source'
import { isRecord, isValidCollectionProjectionPath } from './validate-node-shared-helpers'

export function validateHeadingNode(
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

export function validateParagraphNode(
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

export function validateListNode(
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

export function validateListItems(
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
    const sourceResult = validateCollectionSource(rawItems.source, `${path}.source`, pageId, { allowItemReference: true, allowPipeline: true })

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
