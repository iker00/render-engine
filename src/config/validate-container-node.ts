import type {
  ContainerLayoutNode,
  LayoutNodeCollection,
  LayoutNodeFeedbackFields,
  RuntimeConfigError,
} from './runtime-config-types'
import { containerNodeSchema } from './runtime-config-zod'
import type { BreadcrumbSegment } from './validation-breadcrumb'
import { enrichedInvalidLayout, enrichErrorResult } from './validation-breadcrumb'
import { validateLayoutCollection, validateQueryStateFeedback } from './validate-layout-nodes-core'
import { mapLayoutNodeIssue } from './validate-layout-issue-mapping'
import { mapQueryStateFeedbackIssue, mapVisibilityIssue, validateVisibility } from './validate-actions-visibility'

export function validateContainerNode(
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
