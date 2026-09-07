import type { LayoutNodeCollection, LayoutNodeFeedbackFields, RuntimeConfigError, StepsLayoutNode } from './runtime-config-types'
import { stepsNodeSchema } from './runtime-config-zod'
import type { BreadcrumbSegment } from './validation-breadcrumb'
import { enrichedInvalidLayout, enrichErrorResult } from './validation-breadcrumb'
import type { LayoutValidationCtx } from './validate-layout-nodes-core'
import { defaultLayoutValidationCtx, validateLayoutCollection, validateQueryStateFeedback } from './validate-layout-nodes-core'
import { mapLayoutNodeIssue } from './validate-layout-issue-mapping'
import { mapQueryStateFeedbackIssue, mapVisibilityIssue, validateVisibility } from './validate-actions-visibility'
import { formatPathSegment, isRecord } from './validate-node-shared-helpers'

export function validateStepsNode(
  rawNode: Record<string, unknown>,
  path: string,
  pageId: string,
  breadcrumb: BreadcrumbSegment[] = [],
  ctx: LayoutValidationCtx = defaultLayoutValidationCtx,
): { status: 'ready'; node: StepsLayoutNode } | { status: 'error'; error: RuntimeConfigError } {
  const parseResult = stepsNodeSchema.safeParse(rawNode)

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

    if (issuePath[0] === 'props' && issuePath[1] === 'items' && typeof issuePath[2] === 'number' && issuePath[3] === 'label') {
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.items[${issuePath[2]}].label".`, breadcrumb, rawNode)
    }

    if (issuePath[0] === 'props' && issuePath[1] === 'items' && typeof issuePath[2] === 'number' && issuePath[3] === 'visibility') {
      const itemIndex = issuePath[2]
      const remainingSegments = issuePath.slice(3).map(formatPathSegment).join('')
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.items[${itemIndex}]${remainingSegments}".`, breadcrumb, rawNode)
    }

    if (issuePath[0] === 'props' && issuePath[1] === 'items' && typeof issuePath[2] === 'number' && issuePath[3] === 'onNext') {
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

  const normalizedItems: StepsLayoutNode['props']['items'] = []

  for (let index = 0; index < rawItems.length; index += 1) {
    const rawItem = rawItems[index]

    if (!isRecord(rawItem)) {
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.items[${index}]".`, breadcrumb, rawNode)
    }

    if (typeof rawItem.label !== 'string') {
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.items[${index}].label".`, breadcrumb, rawNode)
    }

    const stepBreadcrumb: BreadcrumbSegment[] = [...breadcrumb, { label: `step("${rawItem.label}")` }]

    const itemVisibilityResult = validateVisibility(
      rawItem.visibility as LayoutNodeFeedbackFields['visibility'],
      `${path}.props.items[${index}].visibility`,
      pageId,
    )

    if (itemVisibilityResult.status === 'error') return enrichErrorResult(itemVisibilityResult, stepBreadcrumb, rawNode)

    let children: LayoutNodeCollection | undefined

    if (rawItem.children !== undefined) {
      const childrenResult = validateLayoutCollection(rawItem.children, `${path}.props.items[${index}].children`, pageId, stepBreadcrumb, ctx)

      if (childrenResult.status === 'error') return childrenResult

      children = childrenResult.nodes
    }

    normalizedItems.push({
      label: rawItem.label,
      children,
      visibility: itemVisibilityResult.visibility,
      onNext: parseResult.data.props.items[index]?.onNext,
    })
  }

  return {
    status: 'ready',
    node: {
      type: 'steps',
      id: parseResult.data.id,
      queryStateFeedback: feedbackResult.queryStateFeedback,
      visibility: visibilityResult.visibility,
      layout: parseResult.data.layout,
      props: {
        variant: parseResult.data.props.variant,
        backLabel: parseResult.data.props.backLabel,
        nextLabel: parseResult.data.props.nextLabel,
        submitLabel: parseResult.data.props.submitLabel,
        items: normalizedItems,
      },
    },
  }
}
