import type {
  LayoutNodeCollection,
  LayoutNodeFeedbackFields,
  LayoutNodeType,
  ModalLayoutNode,
  RuntimeConfigError,
} from './runtime-config-types'
import { modalNodeSchema } from './runtime-config-zod'
import type { BreadcrumbSegment } from './validation-breadcrumb'
import { enrichedInvalidLayout, enrichErrorResult } from './validation-breadcrumb'
import type { LayoutValidationCtx } from './validate-layout-nodes-core'
import { defaultLayoutValidationCtx, validateLayoutCollection, validateQueryStateFeedback } from './validate-layout-nodes-core'
import { mapLayoutNodeIssue } from './validate-layout-issue-mapping'
import { mapQueryStateFeedbackIssue, mapVisibilityIssue, validateVisibility } from './validate-actions-visibility'
import { MODAL_ALLOWED_CHILD_TYPES } from './layout-placement-rules'
import { isRecord } from './validate-node-shared-helpers'

export function validateModalNode(
  rawNode: Record<string, unknown>,
  path: string,
  pageId: string,
  breadcrumb: BreadcrumbSegment[] = [],
  ctx: LayoutValidationCtx = defaultLayoutValidationCtx,
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

      if (!childType || !MODAL_ALLOWED_CHILD_TYPES.has(childType as LayoutNodeType)) {
        return enrichedInvalidLayout(
          `Page "${pageId}" has an invalid layout at "${path}.children[${i}]": modal children may only be container, form, heading, paragraph, list, image, table, button, repeater, accordion or fileManager nodes.`,
          breadcrumb, rawNode)
      }
    }

    const childrenResult = validateLayoutCollection(parseResult.data.children, `${path}.children`, pageId, breadcrumb, ctx)
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
