import type { ImageLayoutNode, LayoutNodeFeedbackFields, RuntimeConfigError } from './runtime-config-types'
import { imageNodeSchema } from './runtime-config-zod'
import type { BreadcrumbSegment } from './validation-breadcrumb'
import { enrichedInvalidLayout, enrichErrorResult } from './validation-breadcrumb'
import { validateQueryStateFeedback } from './validate-layout-nodes-core'
import { mapLeafNodeIssue } from './validate-layout-issue-mapping'
import { mapQueryStateFeedbackIssue, mapVisibilityIssue, validateVisibility } from './validate-actions-visibility'

export function validateImageNode(
  rawNode: Record<string, unknown>,
  path: string,
  pageId: string,
  breadcrumb: BreadcrumbSegment[] = [],
): { status: 'ready'; node: ImageLayoutNode } | { status: 'error'; error: RuntimeConfigError } {
  const parseResult = imageNodeSchema.safeParse(rawNode)

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

    return mapLeafNodeIssue(pageId, path, issue?.path ?? [], breadcrumb, rawNode)
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

  const parsedProps = parseResult.data.props as { src?: string; fetch?: { url: string; method?: string; headers?: Record<string, string>; body?: unknown }; alt: string }
  const hasSrc = parsedProps.src !== undefined
  const hasFetch = parsedProps.fetch !== undefined

  // Mutual exclusion: src and fetch cannot both be present
  if (hasSrc && hasFetch) {
    return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props".`, breadcrumb, rawNode)
  }

  // At least one of src or fetch must be present
  if (!hasSrc && !hasFetch) {
    return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.src".`, breadcrumb, rawNode)
  }

  // fetch mode: validate that fetch.url is present (should already be validated by schema, but alt check)
  if (hasFetch) {
    return {
      status: 'ready',
      node: {
        ...parseResult.data,
        props: {
          fetch: parsedProps.fetch!,
          alt: parsedProps.alt,
        } as ImageLayoutNode['props'],
        queryStateFeedback: feedbackResult.queryStateFeedback,
        visibility: visibilityResult.visibility,
      },
    }
  }

  // src mode
  return {
    status: 'ready',
    node: {
      ...parseResult.data,
      props: {
        src: parsedProps.src!,
        alt: parsedProps.alt,
      } as ImageLayoutNode['props'],
      queryStateFeedback: feedbackResult.queryStateFeedback,
      visibility: visibilityResult.visibility,
    },
  }
}
