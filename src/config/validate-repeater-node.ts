import type {
  LayoutNodeFeedbackFields,
  RepeaterLayoutNode,
  RuntimeCollectionPaginationConfig,
  RuntimeConfigError,
} from './runtime-config-types'
import { repeaterNodeSchema } from './runtime-config-zod'
import type { BreadcrumbSegment } from './validation-breadcrumb'
import { enrichedInvalidLayout, enrichErrorResult } from './validation-breadcrumb'
import type { LayoutValidationCtx } from './validate-layout-nodes-core'
import { defaultLayoutValidationCtx, validateLayoutCollection, validateQueryStateFeedback } from './validate-layout-nodes-core'
import { mapGridLayoutIssue, mapLayoutNodeIssue } from './validate-layout-issue-mapping'
import { mapQueryStateFeedbackIssue, mapVisibilityIssue, validateVisibility } from './validate-actions-visibility'
import { validateCollectionSource } from './validate-collection-source'
import { isValidCollectionItemPath } from './validate-node-shared-helpers'

export function validateRepeaterNode(
  rawNode: Record<string, unknown>,
  path: string,
  pageId: string,
  breadcrumb: BreadcrumbSegment[] = [],
  ctx: LayoutValidationCtx = defaultLayoutValidationCtx,
): { status: 'ready'; node: RepeaterLayoutNode } | { status: 'error'; error: RuntimeConfigError } {
  const parseResult = repeaterNodeSchema.safeParse(rawNode)

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

    if (issuePath[0] === 'children') {
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.children".`, breadcrumb, rawNode)
    }

    const layoutIssue = mapLayoutNodeIssue(pageId, path, issuePath, breadcrumb, rawNode)

    if (layoutIssue) {
      return layoutIssue
    }

    const gridLayoutIssue = mapGridLayoutIssue(pageId, path, issuePath, breadcrumb, rawNode)

    if (gridLayoutIssue) {
      return gridLayoutIssue
    }

    if (issuePath[0] === 'props' && issuePath[1] === 'template') {
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.template".`, breadcrumb, rawNode)
    }

    if (issuePath[0] === 'props' && issuePath[1] === 'items' && issuePath[2] === 'source') {
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.items.source".`, breadcrumb, rawNode)
    }

    if (issuePath[0] === 'props' && issuePath[1] === 'items' && issuePath[2] === 'key') {
      return enrichedInvalidLayout(
        `Page "${pageId}" has an invalid layout at "${path}.props.items.key": repeater item keys must use a non-empty relative item path.`,
        breadcrumb, rawNode)
    }

    const paginationIssue = mapCollectionPaginationIssue(pageId, path, issue, breadcrumb, rawNode)

    if (paginationIssue) {
      return paginationIssue
    }

    if (issuePath[0] === 'props' && issuePath.length === 1) {
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

  const itemsSourceResult = validateCollectionSource(parseResult.data.props.items.source, `${path}.props.items.source`, pageId)

  if (itemsSourceResult.status === 'error') {
    return enrichErrorResult(itemsSourceResult, breadcrumb, rawNode)
  }

  if (!isValidRepeaterItemKeyPath(parseResult.data.props.items.key)) {
    return enrichedInvalidLayout(
      `Page "${pageId}" has an invalid layout at "${path}.props.items.key": repeater item keys must use a non-empty relative item path.`,
      breadcrumb, rawNode)
  }

  const templateResult = validateLayoutCollection(parseResult.data.props.template, `${path}.props.template`, pageId, breadcrumb, ctx)

  if (templateResult.status === 'error') {
    return templateResult
  }

  return {
    status: 'ready',
    node: {
      type: 'repeater',
      id: parseResult.data.id,
      queryStateFeedback: feedbackResult.queryStateFeedback,
      visibility: visibilityResult.visibility,
      layout: parseResult.data.layout,
      props: {
        items: {
          source: itemsSourceResult.source,
          key: parseResult.data.props.items.key,
        },
        pagination: parseResult.data.props.pagination as RuntimeCollectionPaginationConfig | undefined,
        columns: parseResult.data.props.columns,
        gap: parseResult.data.props.gap,
        align: parseResult.data.props.align,
        justify: parseResult.data.props.justify,
        template: templateResult.nodes,
      },
    },
  }
}

export function mapCollectionPaginationIssue(
  pageId: string,
  path: string,
  issue: { path: PropertyKey[]; code?: string; keys?: string[] },
  breadcrumb: BreadcrumbSegment[] = [],
  rawNode: Record<string, unknown> = {},
): { status: 'error'; error: RuntimeConfigError } | null {
  const issuePath = issue.path

  if (issuePath[0] !== 'props' || issuePath[1] !== 'pagination') {
    return null
  }

  if (issuePath[2] === 'controls') {
    if (issue.code === 'unrecognized_keys' && Array.isArray(issue.keys) && issue.keys.length > 0) {
      return enrichedInvalidLayout(
        `Page "${pageId}" has an invalid layout at "${path}.props.pagination.controls.${issue.keys[0]}".`,
        breadcrumb,
        rawNode,
      )
    }

    if (issuePath[3] === 'variant') {
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.pagination.controls.variant".`, breadcrumb, rawNode)
    }

    return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.pagination.controls".`, breadcrumb, rawNode)
  }

  if (issue.code === 'unrecognized_keys' && Array.isArray(issue.keys) && issue.keys.length > 0) {
    return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.pagination.${issue.keys[0]}".`, breadcrumb, rawNode)
  }

  if (issuePath[2] === 'enabled') {
    return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.pagination.enabled".`, breadcrumb, rawNode)
  }

  if (issuePath[2] === 'pageSize') {
    return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.pagination.pageSize".`, breadcrumb, rawNode)
  }

  return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.pagination".`, breadcrumb, rawNode)
}

function isValidRepeaterItemKeyPath(value: unknown): value is string {
  if (value === '$key' || value === '$index') {
    return true
  }

  if (!isValidCollectionItemPath(value)) {
    return false
  }

  const [firstSegment] = value.split('.')

  return (
    firstSegment !== 'item' &&
    firstSegment !== 'queries' &&
    firstSegment !== 'forms' &&
    firstSegment !== 'params' &&
    firstSegment !== 'navigation' &&
    firstSegment !== 'routeParams'
  )
}
