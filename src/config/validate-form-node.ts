import type {
  ExecuteOperationRuntimeUiAction,
  ExecuteOperationsRuntimeUiAction,
  FormLayoutNode,
  LayoutNodeCollection,
  LayoutNodeFeedbackFields,
  RuntimeConfigError,
  RuntimeUiActionListEntry,
} from './runtime-config-types'
import { formNodeSchema } from './runtime-config-zod'
import type { BreadcrumbSegment } from './validation-breadcrumb'
import { enrichedInvalidLayout, enrichErrorResult } from './validation-breadcrumb'
import { validateLayoutCollection, validateQueryStateFeedback } from './validate-layout-nodes-core'
import { mapLayoutNodeIssue } from './validate-layout-issue-mapping'
import { mapQueryStateFeedbackIssue, mapVisibilityIssue, validateFormSubmitAction, validateVisibility } from './validate-actions-visibility'
import { formatPathSegment } from './validate-node-shared-helpers'

export function validateFormNode(
  rawNode: Record<string, unknown>,
  path: string,
  pageId: string,
  breadcrumb: BreadcrumbSegment[] = [],
): { status: 'ready'; node: FormLayoutNode } | { status: 'error'; error: RuntimeConfigError } {
  const parseResult = formNodeSchema.safeParse(rawNode)

  if (!parseResult.success) {
    const issue = parseResult.error.issues[0]
    const feedbackIssue = mapQueryStateFeedbackIssue(pageId, path, issue)

    if (feedbackIssue) {
      return enrichErrorResult(feedbackIssue, breadcrumb, rawNode)
    }

    const visibilityIssue = mapVisibilityIssue(pageId, path, issue)

    if (visibilityIssue) {
      return enrichErrorResult(visibilityIssue, breadcrumb, rawNode)
    }

    const issuePath = issue?.path ?? []

    if (issuePath[0] === 'id') {
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.id".`, breadcrumb, rawNode)
    }

    if (issuePath[0] === 'submitAction') {
      const remainingSegments = issuePath.slice(1).map(formatPathSegment).join('')
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.submitAction${remainingSegments}".`, breadcrumb, rawNode)
    }

    if (issuePath[0] === 'resetOnSuccess') {
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.resetOnSuccess".`, breadcrumb, rawNode)
    }

    if (issuePath[0] === 'persistOnUnmount') {
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.persistOnUnmount".`, breadcrumb, rawNode)
    }

    if (issuePath[0] === 'children') {
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.children".`, breadcrumb, rawNode)
    }

    const layoutIssue = mapLayoutNodeIssue(pageId, path, issuePath, breadcrumb, rawNode)

    if (layoutIssue) {
      return layoutIssue
    }

    return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}".`, breadcrumb, rawNode)
  }

  const feedbackResult = validateQueryStateFeedback(
    parseResult.data.queryStateFeedback as LayoutNodeFeedbackFields['queryStateFeedback'],
    `${path}.queryStateFeedback`,
    pageId,
  )

  if (feedbackResult.status === 'error') {
    return enrichErrorResult(feedbackResult, breadcrumb, rawNode)
  }

  const visibilityResult = validateVisibility(
    parseResult.data.visibility as LayoutNodeFeedbackFields['visibility'],
    `${path}.visibility`,
    pageId,
  )

  if (visibilityResult.status === 'error') {
    return enrichErrorResult(visibilityResult, breadcrumb, rawNode)
  }

  let children: LayoutNodeCollection | undefined
  let submitAction: ExecuteOperationRuntimeUiAction | ExecuteOperationsRuntimeUiAction | undefined
  let onSuccess: RuntimeUiActionListEntry[] | undefined
  let onError: RuntimeUiActionListEntry[] | undefined

  if (parseResult.data.submitAction !== undefined) {
    const submitActionResult = validateFormSubmitAction(parseResult.data.submitAction, `${path}.submitAction`, pageId)

    if (submitActionResult.status === 'error') {
      return enrichErrorResult(submitActionResult, breadcrumb, rawNode)
    }

    submitAction = submitActionResult.action
    onSuccess = submitActionResult.onSuccess
    onError = submitActionResult.onError
  }

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
      type: 'form',
      id: parseResult.data.id,
      queryStateFeedback: feedbackResult.queryStateFeedback,
      visibility: visibilityResult.visibility,
      layout: parseResult.data.layout,
      persistOnUnmount: parseResult.data.persistOnUnmount,
      submitAction,
      resetOnSuccess: parseResult.data.resetOnSuccess,
      onSuccess,
      onError,
      children,
    },
  }
}
