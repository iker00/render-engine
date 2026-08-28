import type { LayoutNodeFeedbackFields, RuntimeConfigError, SkeletonLayoutNode } from './runtime-config-types'
import { skeletonNodeSchema } from './runtime-config-zod'
import type { BreadcrumbSegment } from './validation-breadcrumb'
import { enrichedInvalidLayout, enrichErrorResult } from './validation-breadcrumb'
import { validateQueryStateFeedback } from './validate-layout-nodes-core'
import { mapLeafNodeIssue, mapLayoutNodeIssue } from './validate-layout-issue-mapping'
import { mapQueryStateFeedbackIssue, mapVisibilityIssue, validateVisibility } from './validate-actions-visibility'

export function validateSkeletonNode(
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
