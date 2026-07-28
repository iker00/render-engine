import type { FileManagerLayoutNode, LayoutNodeFeedbackFields, RuntimeConfigError } from './runtime-config-types'
import { fileManagerNodeSchema } from './runtime-config-zod'
import type { BreadcrumbSegment } from './validation-breadcrumb'
import { enrichedInvalidLayout, enrichErrorResult } from './validation-breadcrumb'
import { validateQueryStateFeedback } from './validate-layout-nodes-core'
import { mapLeafNodeIssue, mapLayoutNodeIssue } from './validate-layout-issue-mapping'
import { mapQueryStateFeedbackIssue, mapVisibilityIssue, validateVisibility } from './validate-actions-visibility'

export function validateFileManagerNode(
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
