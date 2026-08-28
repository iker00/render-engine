import type {
  GalleryCarouselDisplay,
  GalleryDynamicSource,
  GalleryLayoutNode,
  GalleryPaginatedDisplay,
  LayoutNodeFeedbackFields,
  RuntimeConfigError,
} from './runtime-config-types'
import { galleryNodeSchema } from './runtime-config-zod'
import type { BreadcrumbSegment } from './validation-breadcrumb'
import { enrichedInvalidLayout, enrichErrorResult } from './validation-breadcrumb'
import { validateQueryStateFeedback } from './validate-layout-nodes-core'
import { mapLeafNodeIssue } from './validate-layout-issue-mapping'
import { mapQueryStateFeedbackIssue, mapVisibilityIssue, validateVisibility } from './validate-actions-visibility'
import { validateCollectionSource } from './validate-collection-source'
import { isValidCollectionItemPath, isValidCollectionProjectionPath } from './validate-node-shared-helpers'

export function validateGalleryNode(
  rawNode: Record<string, unknown>,
  path: string,
  pageId: string,
  breadcrumb: BreadcrumbSegment[] = [],
): { status: 'ready'; node: GalleryLayoutNode } | { status: 'error'; error: RuntimeConfigError } {
  const parseResult = galleryNodeSchema.safeParse(rawNode)

  if (!parseResult.success) {
    const issue = parseResult.error.issues[0]

    const feedbackIssue = mapQueryStateFeedbackIssue(pageId, path, issue)
    if (feedbackIssue) return enrichErrorResult(feedbackIssue, breadcrumb, rawNode)

    const visibilityIssue = mapVisibilityIssue(pageId, path, issue)
    if (visibilityIssue) return enrichErrorResult(visibilityIssue, breadcrumb, rawNode)

    return mapLeafNodeIssue(pageId, path, issue?.path ?? [], breadcrumb, rawNode)
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

  const props = parseResult.data.props
  const hasImages = props.images !== undefined
  const hasSource = props.source !== undefined

  // Mutual exclusion: exactly one of images/source must be declared.
  if (hasImages === hasSource) {
    return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props".`, breadcrumb, rawNode)
  }

  const rawDisplay = props.display
  const normalizedDisplay: GalleryPaginatedDisplay | GalleryCarouselDisplay =
    rawDisplay.mode === 'paginated'
      ? { mode: 'paginated', pagination: rawDisplay.pagination }
      : { mode: 'carousel', visibleCount: rawDisplay.visibleCount, autoplay: rawDisplay.autoplay, loop: rawDisplay.loop }

  if (hasImages) {
    return {
      status: 'ready',
      node: {
        type: 'gallery',
        id: parseResult.data.id,
        queryStateFeedback: feedbackResult.queryStateFeedback,
        visibility: visibilityResult.visibility,
        layout: parseResult.data.layout,
        props: { images: props.images!, display: normalizedDisplay },
      },
    }
  }

  const entry = props.source!

  const sourceResult = validateCollectionSource(entry.source, `${path}.props.source.source`, pageId, { allowItemReference: true })

  if (sourceResult.status === 'error') {
    return enrichErrorResult(sourceResult, breadcrumb, rawNode)
  }

  if (!isValidCollectionProjectionPath(entry.alt)) {
    return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.source.alt".`, breadcrumb, rawNode)
  }

  if (!isValidGalleryItemKeyPath(entry.key)) {
    return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.source.key".`, breadcrumb, rawNode)
  }

  let normalizedSource: GalleryDynamicSource

  if (entry.mode === 'src') {
    if (entry.fetch !== undefined) {
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.source.fetch".`, breadcrumb, rawNode)
    }

    if (entry.idField !== undefined) {
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.source.idField".`, breadcrumb, rawNode)
    }

    if (entry.src === undefined || !isValidCollectionProjectionPath(entry.src)) {
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.source.src".`, breadcrumb, rawNode)
    }

    normalizedSource = { mode: 'src', source: sourceResult.source, key: entry.key, alt: entry.alt, src: entry.src }
  } else {
    if (entry.src !== undefined) {
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.source.src".`, breadcrumb, rawNode)
    }

    if (entry.fetch === undefined) {
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.source.fetch".`, breadcrumb, rawNode)
    }

    if (entry.idField !== undefined && !isValidCollectionProjectionPath(entry.idField)) {
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.source.idField".`, breadcrumb, rawNode)
    }

    normalizedSource = {
      mode: 'fetch',
      source: sourceResult.source,
      key: entry.key,
      alt: entry.alt,
      fetch: entry.fetch,
      idField: entry.idField,
    }
  }

  return {
    status: 'ready',
    node: {
      type: 'gallery',
      id: parseResult.data.id,
      queryStateFeedback: feedbackResult.queryStateFeedback,
      visibility: visibilityResult.visibility,
      layout: parseResult.data.layout,
      props: { source: normalizedSource, display: normalizedDisplay },
    },
  }
}

// Local replica of validate-repeater-node.ts's private isValidRepeaterItemKeyPath: accepts
// "$key", "$index" or a non-empty relative item path without reserved prefixes. Kept as a
// separate, non-exported function per D3 of design.md instead of importing the private helper.
function isValidGalleryItemKeyPath(value: unknown): value is string {
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
