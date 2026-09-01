import type {
  ButtonLayoutNode,
  LayoutNodeFeedbackFields,
  RuntimeApiBodyValue,
  RuntimeApiHeaders,
  RuntimeApiQuery,
  RuntimeConfigError,
  RuntimeUiAction,
} from './runtime-config-types'
import { buttonNodeSchema } from './runtime-config-zod'
import type { BreadcrumbSegment } from './validation-breadcrumb'
import { enrichedInvalidLayout, enrichErrorResult } from './validation-breadcrumb'
import { validateQueryStateFeedback } from './validate-layout-nodes-core'
import { mapLayoutNodeIssue } from './validate-layout-issue-mapping'
import {
  mapQueryStateFeedbackIssue,
  mapVisibilityIssue,
  validateDownloadOperationAction,
  validateRuntimeUiAction,
  validateRuntimeUiActionLifecycleBlocks,
  validateVisibility,
} from './validate-actions-visibility'
import { formatPathSegment } from './validate-node-shared-helpers'
import { parseRuntimeReference } from './runtime-reference-syntax'

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

  const isSwitchVariant = parseResult.data.props.variant === 'switch'

  if (isSwitchVariant && parseResult.data.props.checked === undefined) {
    return enrichedInvalidLayout(
      `Page "${pageId}" has an invalid layout at "${path}": button nodes with variant "switch" must declare props.checked.`,
      breadcrumb,
      rawNode,
    )
  }

  if (!isSwitchVariant && parseResult.data.props.checked !== undefined) {
    return enrichedInvalidLayout(
      `Page "${pageId}" has an invalid layout at "${path}.props.checked": props.checked is only supported when props.variant is "switch".`,
      breadcrumb,
      rawNode,
    )
  }

  if (!isSwitchVariant && parseResult.data.props.labelVisible !== undefined) {
    return enrichedInvalidLayout(
      `Page "${pageId}" has an invalid layout at "${path}.props.labelVisible": props.labelVisible is only supported when props.variant is "switch".`,
      breadcrumb,
      rawNode,
    )
  }

  if (isSwitchVariant && parseResult.data.props.icon !== undefined) {
    return enrichedInvalidLayout(
      `Page "${pageId}" has an invalid layout at "${path}.props.icon": button nodes with variant "switch" cannot declare props.icon.`,
      breadcrumb,
      rawNode,
    )
  }

  if (isSwitchVariant && parseResult.data.props.action === undefined) {
    return enrichedInvalidLayout(
      `Page "${pageId}" has an invalid layout at "${path}": button nodes with variant "switch" must declare props.action.`,
      breadcrumb,
      rawNode,
    )
  }

  let action: ButtonLayoutNode['props']['action']

  if (parseResult.data.props.action !== undefined) {
    const rawAction = parseResult.data.props.action as Record<string, unknown>

    if (rawAction.type === 'downloadOperation') {
      const downloadResult = validateDownloadOperationAction(rawAction, `${path}.props.action`, pageId)

      if (downloadResult.status === 'error') {
        return enrichErrorResult(downloadResult, breadcrumb, rawNode)
      }

      action = downloadResult.action
    } else {
      const actionResult = validateRuntimeUiAction(parseResult.data.props.action, `${path}.props.action`, pageId)

      if (actionResult.status === 'error') {
        return enrichErrorResult(actionResult, breadcrumb, rawNode)
      }

      const lifecycleResult = validateRuntimeUiActionLifecycleBlocks(rawAction, `${path}.props.action`, pageId)

      if (lifecycleResult.status === 'error') {
        return enrichErrorResult(lifecycleResult, breadcrumb, rawNode)
      }

      action = {
        ...actionResult.action,
        ...(lifecycleResult.onSuccess !== undefined ? { onSuccess: lifecycleResult.onSuccess } : {}),
        ...(lifecycleResult.onError !== undefined ? { onError: lifecycleResult.onError } : {}),
      } as RuntimeUiAction
    }
  }

  // node.visibility.reference is not scanned here for switch.next: validateVisibility above already
  // rejects any reference outside params/item/forms/queries shapes, so a switch.next reference there
  // is already caught before this point is reached.
  if (isSwitchNextReference(parseResult.data.props.checked)) {
    return enrichedInvalidLayout(
      `Page "${pageId}" has an invalid layout at "${path}.props.checked": switch.next is only supported in props.action query, body or headers of a button with variant "switch".`,
      breadcrumb,
      rawNode,
    )
  }

  if (actionRequestSurfaceHasSwitchNextReference(action) && !isSwitchVariant) {
    return enrichedInvalidLayout(
      `Page "${pageId}" has an invalid layout at "${path}.props.action": switch.next is only supported in props.action query, body or headers of a button with variant "switch".`,
      breadcrumb,
      rawNode,
    )
  }

  const buttonProps: ButtonLayoutNode['props'] = {
    label: parseResult.data.props.label,
    action,
    color: parseResult.data.props.color,
    variant: parseResult.data.props.variant,
    fullWidth: parseResult.data.props.fullWidth,
    icon: parseResult.data.props.icon,
    checked: parseResult.data.props.checked,
    labelVisible: parseResult.data.props.labelVisible,
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

// switch.next is a synthetic reference only meaningful as the "toggled value" of the switch
// button that declares it (resolved live in T3). Its bootstrap frontier is intentionally narrow:
// accepted only inside the request surface (query/body/headers, including operations[] entries)
// of a button's own props.action when that button is variant "switch"; rejected everywhere else,
// including props.checked, visibility.reference, or the action of a non-switch button.
function isSwitchNextReference(value: unknown): boolean {
  if (typeof value !== 'string') {
    return false
  }

  const parsed = parseRuntimeReference(value, { allowSwitchNextReference: true })
  return parsed.kind === 'reference' && parsed.namespace === 'switch'
}

function bodyHasSwitchNextReference(value: RuntimeApiBodyValue | undefined): boolean {
  if (value === undefined || value === null) {
    return false
  }

  if (isSwitchNextReference(value)) {
    return true
  }

  if (Array.isArray(value)) {
    return value.some(bodyHasSwitchNextReference)
  }

  if (typeof value === 'object') {
    return Object.values(value).some(bodyHasSwitchNextReference)
  }

  return false
}

function requestParamsHaveSwitchNextReference(requestParams: {
  query?: RuntimeApiQuery
  body?: RuntimeApiBodyValue
  headers?: RuntimeApiHeaders
}): boolean {
  if (requestParams.query && Object.values(requestParams.query).some(isSwitchNextReference)) {
    return true
  }

  if (requestParams.headers && Object.values(requestParams.headers).some(isSwitchNextReference)) {
    return true
  }

  return bodyHasSwitchNextReference(requestParams.body)
}

function actionRequestSurfaceHasSwitchNextReference(action: ButtonLayoutNode['props']['action']): boolean {
  if (!action) {
    return false
  }

  if (action.type === 'executeOperations') {
    return action.operations.some((entry) => requestParamsHaveSwitchNextReference(entry))
  }

  if (action.type === 'executeOperation' || action.type === 'downloadOperation') {
    return requestParamsHaveSwitchNextReference(action)
  }

  return false
}
