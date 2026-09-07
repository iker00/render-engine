import type {
  LayoutNodeCollection,
  LayoutNodeFeedbackFields,
  LayoutNodeType,
  LinkLayoutNode,
  RuntimeConfigError,
} from './runtime-config-types'
import { linkNodeSchema } from './runtime-config-zod'
import type { BreadcrumbSegment } from './validation-breadcrumb'
import { enrichedInvalidLayout, enrichErrorResult } from './validation-breadcrumb'
import type { LayoutValidationCtx } from './validate-layout-nodes-core'
import { defaultLayoutValidationCtx, validateLayoutCollection, validateQueryStateFeedback } from './validate-layout-nodes-core'
import { mapLayoutNodeIssue } from './validate-layout-issue-mapping'
import {
  mapQueryStateFeedbackIssue,
  mapVisibilityIssue,
  validateDownloadOperationAction,
  validateRuntimeUiAction,
  validateVisibility,
} from './validate-actions-visibility'
import { isRecord, formatPathSegment } from './validate-node-shared-helpers'
import { LINK_ALLOWED_CHILD_TYPES } from './layout-placement-rules'

export function validateLinkNode(
  rawNode: Record<string, unknown>,
  path: string,
  pageId: string,
  breadcrumb: BreadcrumbSegment[] = [],
  ctx: LayoutValidationCtx = defaultLayoutValidationCtx,
): { status: 'ready'; node: LinkLayoutNode } | { status: 'error'; error: RuntimeConfigError } {
  const parseResult = linkNodeSchema.safeParse(rawNode)

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

    if (issuePath[0] === 'props' && issuePath[1] === 'label') {
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.label".`, breadcrumb, rawNode)
    }

    if (issuePath[0] === 'props' && issuePath[1] === 'href') {
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.href".`, breadcrumb, rawNode)
    }

    if (issuePath[0] === 'props' && issuePath[1] === 'download') {
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.download".`, breadcrumb, rawNode)
    }

    if (issuePath[0] === 'props' && issuePath[1] === 'target') {
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.target".`, breadcrumb, rawNode)
    }

    if (issuePath[0] === 'props' && issuePath[1] === 'action') {
      const remainingSegments = issuePath.slice(2).map(formatPathSegment).join('')
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.action${remainingSegments}".`, breadcrumb, rawNode)
    }

    if (issuePath[0] === 'props' && issuePath[1] === 'iconPosition') {
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.iconPosition".`, breadcrumb, rawNode)
    }

    return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props".`, breadcrumb, rawNode)
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

  const { href, download, target, action, label, icon, iconPosition } = parseResult.data.props
  const hasChildren = parseResult.data.children !== undefined
  const hasLabel = label !== undefined
  const hasIcon = icon !== undefined
  const hasIconPosition = iconPosition !== undefined
  const hasHref = href !== undefined
  const hasAction = action !== undefined

  // Cross-validation (1): children and props.label are mutually exclusive
  if (hasChildren && hasLabel) {
    return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}": link nodes cannot have both props.label and children.`, breadcrumb, rawNode)
  }

  // Cross-validation (2): children and props.icon are mutually exclusive
  if (hasChildren && hasIcon) {
    return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}": link nodes cannot have both props.icon and children.`, breadcrumb, rawNode)
  }

  // Cross-validation (2b): children and props.iconPosition are mutually exclusive
  if (hasChildren && hasIconPosition) {
    return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}": link nodes cannot have both props.icon and children.`, breadcrumb, rawNode)
  }

  // Cross-validation (3): must have either props.label or children
  if (!hasChildren && !hasLabel) {
    return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}": link nodes must have either props.label or children.`, breadcrumb, rawNode)
  }

  // Cross-validation (5 & 6): validate children types (direct and recursive)
  let children: LayoutNodeCollection | undefined

  if (hasChildren) {
    // Check direct type restriction before full validation
    const directTypeCheck = checkLinkChildrenAllowedTypes(parseResult.data.children!, `${path}.children`, pageId)

    if (directTypeCheck.status === 'error') {
      return directTypeCheck
    }

    // Full validation of children
    const childrenResult = validateLayoutCollection(parseResult.data.children!, `${path}.children`, pageId, breadcrumb, ctx)

    if (childrenResult.status === 'error') {
      return childrenResult
    }

    children = childrenResult.nodes
  }

  // Cross-validation (7): href and action are mutually exclusive
  if (hasHref && hasAction) {
    return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}": link nodes cannot have both props.href and props.action.`, breadcrumb, rawNode)
  }

  // Cross-validation (7): must have either href or action
  if (!hasHref && !hasAction) {
    return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}": link nodes must have either props.href or props.action.`, breadcrumb, rawNode)
  }

  // Cross-validation (7): download requires href
  if (download !== undefined && !hasHref) {
    return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.download": download requires props.href.`, breadcrumb, rawNode)
  }

  // Cross-validation (7): target requires href
  if (target !== undefined && !hasHref) {
    return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.target": target requires props.href.`, breadcrumb, rawNode)
  }

  // Cross-validation (7): action.type must be navigateTo, goBack or downloadOperation
  let validatedAction: LinkLayoutNode['props']['action'] | undefined
  if (hasAction) {
    const rawAction = action as Record<string, unknown>

    if (rawAction.type !== 'navigateTo' && rawAction.type !== 'goBack' && rawAction.type !== 'downloadOperation') {
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.action.type".`, breadcrumb, rawNode)
    }

    if (rawAction.type === 'downloadOperation') {
      const downloadResult = validateDownloadOperationAction(rawAction, `${path}.props.action`, pageId)

      if (downloadResult.status === 'error') {
        return enrichErrorResult(downloadResult, breadcrumb, rawNode)
      }

      validatedAction = downloadResult.action
    } else {
      const linkActionResult = validateRuntimeUiAction(rawAction, `${path}.props.action`, pageId)

      if (linkActionResult.status === 'error') {
        return enrichErrorResult(linkActionResult, breadcrumb, rawNode)
      }

      validatedAction = linkActionResult.action as LinkLayoutNode['props']['action']
    }
  }

  const props: LinkLayoutNode['props'] = {}

  if (label !== undefined) props.label = label
  if (href !== undefined) props.href = href
  if (download !== undefined) props.download = download
  if (target !== undefined) props.target = target
  if (validatedAction !== undefined) props.action = validatedAction
  if (icon !== undefined) props.icon = icon
  if (iconPosition !== undefined) props.iconPosition = iconPosition

  const node: LinkLayoutNode = {
    type: 'link',
    id: parseResult.data.id,
    queryStateFeedback: feedbackResult.queryStateFeedback,
    visibility: visibilityResult.visibility,
    layout: parseResult.data.layout,
    props,
  }

  if (children !== undefined) {
    node.children = children
  }

  return {
    status: 'ready',
    node,
  }
}

function checkLinkChildrenAllowedTypes(
  children: unknown[],
  basePath: string,
  pageId: string,
  breadcrumb: BreadcrumbSegment[] = [],
): { status: 'ready' } | { status: 'error'; error: RuntimeConfigError } {
  for (let i = 0; i < children.length; i += 1) {
    const child = children[i]

    if (!isRecord(child)) {
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${basePath}[${i}]": link children may only be container, heading, paragraph, list, image, badge, alert, stat, divider or skeleton nodes.`, breadcrumb, isRecord(child) ? child : {})
    }

    const childType = typeof child.type === 'string' ? child.type : undefined

    if (!childType || !LINK_ALLOWED_CHILD_TYPES.has(childType as LayoutNodeType)) {
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${basePath}[${i}]": link children may only be container, heading, paragraph, list, image, badge, alert, stat, divider or skeleton nodes.`, breadcrumb, isRecord(child) ? child : {})
    }

    // Recurse into container children
    if (childType === 'container' && child.children !== undefined) {
      const nestedCheck = checkLinkChildrenAllowedTypes(child.children as unknown[], `${basePath}[${i}].children`, pageId, breadcrumb)

      if (nestedCheck.status === 'error') {
        return nestedCheck
      }
    }
  }

  return { status: 'ready' }
}
