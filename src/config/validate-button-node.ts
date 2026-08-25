import type { ButtonLayoutNode, LayoutNodeFeedbackFields, RuntimeConfigError, RuntimeUiAction } from './runtime-config-types'
import { buttonNodeSchema } from './runtime-config-zod'
import type { BreadcrumbSegment } from './validation-breadcrumb'
import { enrichedInvalidLayout, enrichErrorResult } from './validation-breadcrumb'
import { validateQueryStateFeedback } from './validate-layout-nodes-core'
import { mapLayoutNodeIssue } from './validate-layout-issue-mapping'
import {
  mapQueryStateFeedbackIssue,
  mapVisibilityIssue,
  validateRuntimeUiAction,
  validateRuntimeUiActionLifecycleBlocks,
  validateVisibility,
} from './validate-actions-visibility'
import { formatPathSegment } from './validate-node-shared-helpers'

export function validateButtonNode(
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
      const remainingSegments = issuePath.slice(2).map(formatPathSegment).join('')
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.action${remainingSegments}".`, breadcrumb, rawNode)
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

    const lifecycleResult = validateRuntimeUiActionLifecycleBlocks(
      parseResult.data.props.action as Record<string, unknown>,
      `${path}.props.action`,
      pageId,
    )

    if (lifecycleResult.status === 'error') {
      return enrichErrorResult(lifecycleResult, breadcrumb, rawNode)
    }

    action = {
      ...actionResult.action,
      ...(lifecycleResult.onSuccess !== undefined ? { onSuccess: lifecycleResult.onSuccess } : {}),
      ...(lifecycleResult.onError !== undefined ? { onError: lifecycleResult.onError } : {}),
    } as RuntimeUiAction
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
