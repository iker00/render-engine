import type {
  ChartCategoricalDynamicSource,
  ChartLayoutNode,
  ChartNumericDynamicSource,
  ChartStaticCategoricalPoint,
  ChartStaticNumericPoint,
  ChartVariant,
  LayoutNodeFeedbackFields,
  RuntimeConfigError,
} from './runtime-config-types'
import { chartNodeSchema } from './runtime-config-zod'
import type { BreadcrumbSegment } from './validation-breadcrumb'
import { enrichedInvalidLayout, enrichErrorResult } from './validation-breadcrumb'
import { validateQueryStateFeedback } from './validate-layout-nodes-core'
import { mapLeafNodeIssue } from './validate-layout-issue-mapping'
import { mapQueryStateFeedbackIssue, mapVisibilityIssue, validateVisibility } from './validate-actions-visibility'
import { validateCollectionSource } from './validate-collection-source'
import { isValidCollectionItemPath, isValidCollectionProjectionPath } from './validate-node-shared-helpers'

type ChartDataShapeFamily = 'categorical' | 'numeric'

// D2 of design.md: bar/line/area/pie/donut share the categorical { category, value } shape;
// scatter is the only numeric { x, y } variant.
const categoricalChartVariants: ChartVariant[] = ['bar', 'line', 'area', 'pie', 'donut']

function familyForVariant(variant: ChartVariant): ChartDataShapeFamily {
  return categoricalChartVariants.includes(variant) ? 'categorical' : 'numeric'
}

function familyForDataPoint(point: ChartStaticCategoricalPoint | ChartStaticNumericPoint): ChartDataShapeFamily {
  return 'category' in point ? 'categorical' : 'numeric'
}

function familyForSource(source: ChartCategoricalDynamicSource | ChartNumericDynamicSource): ChartDataShapeFamily {
  return 'category' in source ? 'categorical' : 'numeric'
}

export function validateChartNode(
  rawNode: Record<string, unknown>,
  path: string,
  pageId: string,
  breadcrumb: BreadcrumbSegment[] = [],
): { status: 'ready'; node: ChartLayoutNode } | { status: 'error'; error: RuntimeConfigError } {
  const parseResult = chartNodeSchema.safeParse(rawNode)

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
  const variant = props.variant
  const family = familyForVariant(variant)

  const hasData = props.data !== undefined
  const hasSource = props.source !== undefined

  // Mutual exclusion: exactly one of data/source must be declared.
  if (hasData === hasSource) {
    return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props".`, breadcrumb, rawNode)
  }

  if (hasData) {
    const data = props.data!

    for (let index = 0; index < data.length; index += 1) {
      if (familyForDataPoint(data[index]) !== family) {
        return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.data[${index}]".`, breadcrumb, rawNode)
      }
    }
  }

  if (hasSource && familyForSource(props.source!) !== family) {
    return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.source".`, breadcrumb, rawNode)
  }

  // pie/donut render a single series without axes: color/label/xAxisLabel/yAxisLabel are
  // meaningless for those variants and are rejected outright rather than silently ignored.
  if (variant === 'pie' || variant === 'donut') {
    if (props.color !== undefined) {
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.color".`, breadcrumb, rawNode)
    }

    if (props.label !== undefined) {
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.label".`, breadcrumb, rawNode)
    }

    if (props.xAxisLabel !== undefined) {
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.xAxisLabel".`, breadcrumb, rawNode)
    }

    if (props.yAxisLabel !== undefined) {
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.yAxisLabel".`, breadcrumb, rawNode)
    }
  }

  let normalizedSource: ChartCategoricalDynamicSource | ChartNumericDynamicSource | undefined

  if (hasSource) {
    const source = props.source!

    const sourceResult = validateCollectionSource(source.source, `${path}.props.source.source`, pageId, { allowPipeline: true })

    if (sourceResult.status === 'error') {
      return enrichErrorResult(sourceResult, breadcrumb, rawNode)
    }

    if ('category' in source) {
      // source.category is a projection path relative to the item and admits `{{...}}`
      // interpolation as an exception; source.value stays a pure relative path (same criterion
      // as map.markerSources.position.lat/.lng).
      if (!isValidCollectionProjectionPath(source.category)) {
        return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.source.category".`, breadcrumb, rawNode)
      }

      if (!isValidCollectionItemPath(source.value)) {
        return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.source.value".`, breadcrumb, rawNode)
      }

      normalizedSource = { source: sourceResult.source, category: source.category, value: source.value }
    } else {
      if (!isValidCollectionItemPath(source.x)) {
        return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.source.x".`, breadcrumb, rawNode)
      }

      if (!isValidCollectionItemPath(source.y)) {
        return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.source.y".`, breadcrumb, rawNode)
      }

      normalizedSource = { source: sourceResult.source, x: source.x, y: source.y }
    }
  }

  return {
    status: 'ready',
    node: {
      type: 'chart',
      queryStateFeedback: feedbackResult.queryStateFeedback,
      visibility: visibilityResult.visibility,
      layout: parseResult.data.layout,
      props: {
        variant,
        data: props.data,
        source: normalizedSource,
        color: props.color,
        label: props.label,
        xAxisLabel: props.xAxisLabel,
        yAxisLabel: props.yAxisLabel,
        height: props.height,
      },
    },
  }
}
