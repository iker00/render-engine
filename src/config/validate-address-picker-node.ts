import type { AddressPickerLayoutNode, LayoutNodeFeedbackFields, RuntimeConfigError } from './runtime-config-types'
import { addressPickerNodeSchema } from './runtime-config-zod'
import type { BreadcrumbSegment } from './validation-breadcrumb'
import { enrichedInvalidLayout, enrichErrorResult } from './validation-breadcrumb'
import { validateQueryStateFeedback } from './validate-layout-nodes-core'
import { mapLeafNodeIssue } from './validate-layout-issue-mapping'
import { mapQueryStateFeedbackIssue, mapVisibilityIssue, validateVisibility } from './validate-actions-visibility'
import { validateFormFieldValidations } from './validate-form-field-validations'

export function validateAddressPickerNode(
  rawNode: Record<string, unknown>,
  path: string,
  pageId: string,
  breadcrumb: BreadcrumbSegment[] = [],
): { status: 'ready'; node: AddressPickerLayoutNode } | { status: 'error'; error: RuntimeConfigError } {
  const parseResult = addressPickerNodeSchema.safeParse(rawNode)

  if (!parseResult.success) {
    const issue = parseResult.error.issues[0]
    const issuePath = issue?.path ?? []

    const feedbackIssue = mapQueryStateFeedbackIssue(pageId, path, issue)
    if (feedbackIssue) return enrichErrorResult(feedbackIssue, breadcrumb, rawNode)

    const visibilityIssue = mapVisibilityIssue(pageId, path, issue)
    if (visibilityIssue) return enrichErrorResult(visibilityIssue, breadcrumb, rawNode)

    if (issuePath[0] === 'props' && issuePath[1] === 'center' && (issuePath[2] === 'lat' || issuePath[2] === 'lng')) {
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.center.${issuePath[2]}".`, breadcrumb, rawNode)
    }

    if (issuePath[0] === 'props' && issuePath[1] === 'zoom') {
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.zoom".`, breadcrumb, rawNode)
    }

    if (issuePath[0] === 'props' && issuePath[1] === 'height') {
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.height".`, breadcrumb, rawNode)
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

  const validationsResult = validateFormFieldValidations(
    rawNode.props,
    parseResult.data.props.validations,
    { type: 'addressPicker' },
    path,
    pageId,
    breadcrumb,
    rawNode,
  )

  if (validationsResult.status === 'error') return validationsResult

  return {
    status: 'ready',
    node: {
      type: 'addressPicker',
      id: parseResult.data.id,
      queryStateFeedback: feedbackResult.queryStateFeedback,
      visibility: visibilityResult.visibility,
      layout: parseResult.data.layout,
      props: {
        ...parseResult.data.props,
        validations: validationsResult.validations,
      },
    },
  }
}
