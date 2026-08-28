import type { HiddenLayoutNode, RuntimeConfigError } from './runtime-config-types'
import { hiddenNodeSchema } from './runtime-config-zod'
import type { BreadcrumbSegment } from './validation-breadcrumb'
import { enrichedInvalidLayout } from './validation-breadcrumb'
import { mapLeafNodeIssue } from './validate-layout-issue-mapping'
import { isRecord } from './validate-node-shared-helpers'

const hiddenProhibitedProps = ['label', 'validations', 'defaultValue', 'placeholder', 'icon', 'iconPosition'] as const

export function validateHiddenNode(
  rawNode: Record<string, unknown>,
  path: string,
  pageId: string,
  breadcrumb: BreadcrumbSegment[] = [],
): { status: 'ready'; node: HiddenLayoutNode } | { status: 'error'; error: RuntimeConfigError } {
  // Reject prohibited transversals on the node itself
  if (Object.hasOwn(rawNode, 'visibility')) {
    return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.visibility": hidden nodes do not support visibility.`, breadcrumb, rawNode)
  }

  if (Object.hasOwn(rawNode, 'queryStateFeedback')) {
    return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.queryStateFeedback": hidden nodes do not support queryStateFeedback.`, breadcrumb, rawNode)
  }

  // Reject prohibited props
  const rawProps = rawNode.props
  if (isRecord(rawProps)) {
    for (const prop of hiddenProhibitedProps) {
      if (Object.hasOwn(rawProps, prop)) {
        return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.${prop}": hidden nodes do not support ${prop}.`, breadcrumb, rawNode)
      }
    }
  }

  const parseResult = hiddenNodeSchema.safeParse(rawNode)

  if (!parseResult.success) {
    return mapLeafNodeIssue(pageId, path, parseResult.error.issues[0]?.path ?? [], breadcrumb, rawNode)
  }

  return {
    status: 'ready',
    node: {
      type: 'hidden',
      props: {
        fieldId: parseResult.data.props.fieldId,
        value: parseResult.data.props.value,
      },
    },
  }
}
