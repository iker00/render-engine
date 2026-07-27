import type { FileInputLayoutNode, LayoutNodeFeedbackFields, RuntimeConfigError } from './runtime-config-types'
import { fileInputNodeSchema } from './runtime-config-zod'
import type { BreadcrumbSegment } from './validation-breadcrumb'
import { enrichedInvalidLayout, enrichErrorResult } from './validation-breadcrumb'
import { validateQueryStateFeedback } from './validate-layout-nodes-core'
import { mapLayoutNodeIssue } from './validate-layout-issue-mapping'
import { mapQueryStateFeedbackIssue, mapVisibilityIssue, validateVisibility } from './validate-actions-visibility'

export function validateFileInputNode(
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
