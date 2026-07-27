import type { RuntimeConfigError } from './runtime-config-types'
import type { BreadcrumbSegment } from './validation-breadcrumb'
import { enrichedInvalidLayout } from './validation-breadcrumb'
import { formatPathSegment } from './validate-node-shared-helpers'

export function mapLeafNodeIssue(
  pageId: string,
  path: string,
  issuePath: PropertyKey[],
  breadcrumb: BreadcrumbSegment[] = [],
  rawNode: Record<string, unknown> = {},
): { status: 'error'; error: RuntimeConfigError } {
  const layoutIssue = mapLayoutNodeIssue(pageId, path, issuePath, breadcrumb, rawNode)

  if (layoutIssue) {
    return layoutIssue
  }

  if (issuePath[0] === 'id') {
    return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.id".`, breadcrumb, rawNode)
  }

  if (issuePath[0] === 'props' && issuePath.length === 1) {
    return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props".`, breadcrumb, rawNode)
  }

  const formattedIssuePath = issuePath.map(formatPathSegment).join('')
  return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}${formattedIssuePath}".`, breadcrumb, rawNode)
}

export function mapLayoutNodeIssue(
  pageId: string,
  path: string,
  issuePath: PropertyKey[],
  breadcrumb: BreadcrumbSegment[] = [],
  rawNode: Record<string, unknown> = {},
): { status: 'error'; error: RuntimeConfigError } | null {
  if (issuePath[0] === 'layout' && issuePath.length === 1) {
    return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.layout".`, breadcrumb, rawNode)
  }

  if (issuePath[0] === 'layout' && issuePath[1] === 'span') {
    return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.layout.span".`, breadcrumb, rawNode)
  }

  return null
}
