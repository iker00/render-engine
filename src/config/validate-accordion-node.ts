import type { AccordionLayoutNode, LayoutNodeCollection, LayoutNodeFeedbackFields, RuntimeConfigError } from './runtime-config-types'
import { accordionNodeSchema } from './runtime-config-zod'
import type { BreadcrumbSegment } from './validation-breadcrumb'
import { enrichedInvalidLayout, enrichErrorResult } from './validation-breadcrumb'
import { validateLayoutCollection, validateQueryStateFeedback } from './validate-layout-nodes-core'
import { mapLayoutNodeIssue } from './validate-layout-issue-mapping'
import { mapQueryStateFeedbackIssue, mapVisibilityIssue, validateVisibility } from './validate-actions-visibility'

export function validateAccordionNode(
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
