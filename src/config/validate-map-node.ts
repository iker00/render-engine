import type { LayoutNodeFeedbackFields, MapLayoutNode, MapMarkerSource, MapStaticMarker, RuntimeConfigError } from './runtime-config-types'
import { mapNodeSchema } from './runtime-config-zod'
import type { BreadcrumbSegment } from './validation-breadcrumb'
import { enrichedInvalidLayout, enrichErrorResult } from './validation-breadcrumb'
import { validateQueryStateFeedback } from './validate-layout-nodes-core'
import { mapLeafNodeIssue } from './validate-layout-issue-mapping'
import { mapQueryStateFeedbackIssue, mapVisibilityIssue, validateVisibility } from './validate-actions-visibility'
import { validateCollectionSource } from './validate-collection-source'
import { isValidCollectionItemPath, isValidCollectionProjectionPath } from './validate-node-shared-helpers'

export function validateMapNode(
  rawNode: Record<string, unknown>,
  path: string,
  pageId: string,
  breadcrumb: BreadcrumbSegment[] = [],
): { status: 'ready'; node: MapLayoutNode } | { status: 'error'; error: RuntimeConfigError } {
  const parseResult = mapNodeSchema.safeParse(rawNode)

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

    if (issuePath[0] === 'props' && issuePath[1] === 'markers' && typeof issuePath[2] === 'number') {
      const index = issuePath[2]
      const field = issuePath[3]

      if (field === 'lat' || field === 'lng' || field === 'label') {
        return enrichedInvalidLayout(
          `Page "${pageId}" has an invalid layout at "${path}.props.markers[${index}].${field}".`,
          breadcrumb,
          rawNode,
        )
      }
    }

    if (issuePath[0] === 'props' && issuePath[1] === 'markerSources' && typeof issuePath[2] === 'number') {
      const index = issuePath[2]

      if (issuePath[3] === 'source') {
        return enrichedInvalidLayout(
          `Page "${pageId}" has an invalid layout at "${path}.props.markerSources[${index}].source".`,
          breadcrumb,
          rawNode,
        )
      }

      if (issuePath[3] === 'position' && (issuePath[4] === 'lat' || issuePath[4] === 'lng')) {
        return enrichedInvalidLayout(
          `Page "${pageId}" has an invalid layout at "${path}.props.markerSources[${index}].position.${issuePath[4]}".`,
          breadcrumb,
          rawNode,
        )
      }

      if (issuePath[3] === 'label') {
        return enrichedInvalidLayout(
          `Page "${pageId}" has an invalid layout at "${path}.props.markerSources[${index}].label".`,
          breadcrumb,
          rawNode,
        )
      }

      if (issuePath[3] === 'color') {
        return enrichedInvalidLayout(
          `Page "${pageId}" has an invalid layout at "${path}.props.markerSources[${index}].color".`,
          breadcrumb,
          rawNode,
        )
      }
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

  const props = parseResult.data.props
  const rawMarkers = props?.markers
  const rawMarkerSources = props?.markerSources

  let normalizedMarkerSources: MapMarkerSource[] | undefined

  if (rawMarkerSources !== undefined) {
    const resolvedSources: MapMarkerSource[] = []

    for (let index = 0; index < rawMarkerSources.length; index += 1) {
      const entry = rawMarkerSources[index]

      const sourceResult = validateCollectionSource(entry.source, `${path}.props.markerSources[${index}].source`, pageId)

      if (sourceResult.status === 'error') {
        return enrichErrorResult(sourceResult, breadcrumb, rawNode)
      }

      if (!isValidCollectionItemPath(entry.position.lat)) {
        return enrichedInvalidLayout(
          `Page "${pageId}" has an invalid layout at "${path}.props.markerSources[${index}].position.lat".`,
          breadcrumb,
          rawNode,
        )
      }

      if (!isValidCollectionItemPath(entry.position.lng)) {
        return enrichedInvalidLayout(
          `Page "${pageId}" has an invalid layout at "${path}.props.markerSources[${index}].position.lng".`,
          breadcrumb,
          rawNode,
        )
      }

      if (!isValidCollectionProjectionPath(entry.label)) {
        return enrichedInvalidLayout(
          `Page "${pageId}" has an invalid layout at "${path}.props.markerSources[${index}].label".`,
          breadcrumb,
          rawNode,
        )
      }

      resolvedSources.push({
        source: sourceResult.source,
        position: { lat: entry.position.lat, lng: entry.position.lng },
        label: entry.label,
        color: entry.color,
      })
    }

    normalizedMarkerSources = resolvedSources
  }

  // markerSources takes precedence over markers when both are declared: the dynamic source
  // wins and the static list is dropped, rather than rejecting the config.
  const markers: MapStaticMarker[] | undefined =
    normalizedMarkerSources !== undefined ? undefined : rawMarkers !== undefined ? rawMarkers : []

  return {
    status: 'ready',
    node: {
      type: 'map',
      id: parseResult.data.id,
      queryStateFeedback: feedbackResult.queryStateFeedback,
      visibility: visibilityResult.visibility,
      layout: parseResult.data.layout,
      props: {
        center: props?.center,
        zoom: props?.zoom,
        height: props?.height,
        markers,
        markerSources: normalizedMarkerSources,
        autoFitMarkers: props?.autoFitMarkers,
      },
    },
  }
}
