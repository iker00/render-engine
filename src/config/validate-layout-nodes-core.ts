import type {
  LayoutNode,
  LayoutNodeCollection,
  LayoutNodeFeedbackFields,
  LayoutNodeType,
  QueryStateFeedbackConfig,
  QueryStateFeedbackFallbackRule,
  QueryStateFeedbackRule,
  QueryStateFeedbackVisibleState,
  RuntimeConfigError,
  RuntimeGroupInstanceNode,
} from './runtime-config-types'
import { groupInstanceNodeSchema, supportedNodeTypes } from './runtime-config-zod'
import { invalidLayout, unsupportedNodeType } from './runtime-config-validation-errors'
import type { BreadcrumbSegment } from './validation-breadcrumb'
import { buildBreadcrumbSegment, enrichedInvalidLayout, enrichErrorResult } from './validation-breadcrumb'
import { isRecord } from './validate-node-shared-helpers'
import { validateVisibility } from './validate-actions-visibility'
import { validateContainerNode } from './validate-container-node'
import { validateRepeaterNode } from './validate-repeater-node'
import { validateHeadingNode, validateParagraphNode, validateListNode } from './validate-heading-paragraph-list-nodes'
import { validateImageNode } from './validate-image-node'
import { validateTableNode } from './validate-table-node'
import { validateButtonNode } from './validate-button-node'
import { validateLinkNode } from './validate-link-node'
import { validateModalNode } from './validate-modal-node'
import { validateTabsNode } from './validate-tabs-node'
import { validateStepsNode } from './validate-steps-node'
import { validateAccordionNode } from './validate-accordion-node'
import { validateBadgeNode } from './validate-badge-node'
import { validateAlertNode } from './validate-alert-node'
import { validateStatNode } from './validate-stat-node'
import { validateDividerNode } from './validate-divider-node'
import { validateSkeletonNode } from './validate-skeleton-node'
import { validateFileInputNode } from './validate-file-input-node'
import { validateFileManagerNode } from './validate-file-manager-node'
import { validateFormNode } from './validate-form-node'
import {
  validateInputNode,
  validateTextareaNode,
  validateSelectNode,
  validateRadioGroupNode,
  validateCheckboxGroupNode,
  validateToggleNode,
} from './validate-form-field-nodes'
import { validateHiddenNode } from './validate-hidden-node'
import { validateMapNode } from './validate-map-node'
import { validateGalleryNode } from './validate-gallery-node'
import { validateAutocompleteNode } from './validate-autocomplete-node'

// Context threaded through the recursive layout validator. `insideGroupTemplate` tracks whether
// the current structural position is inside `groups.{groupId}.template`: it flips which of the
// reserved catalog entries (`slot`/`group`) are valid discriminants at that position. It must be
// forwarded unchanged into every node-type validator that itself recurses into a `LayoutNode[]`
// collection (container/repeater/form/modal/tabs/steps/accordion/link), so a `slot` nested at any
// structural depth inside a group template is still recognized as being inside that template.
export interface LayoutValidationCtx {
  insideGroupTemplate: boolean
}

export const defaultLayoutValidationCtx: LayoutValidationCtx = { insideGroupTemplate: false }

export function validateLayoutCollection(
  rawNodes: unknown,
  path: string,
  pageId: string,
  breadcrumb: BreadcrumbSegment[] = [],
  ctx: LayoutValidationCtx = defaultLayoutValidationCtx,
): { status: 'ready'; nodes: LayoutNodeCollection } | { status: 'error'; error: RuntimeConfigError } {
  if (!Array.isArray(rawNodes)) {
    return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}".`)
  }

  const nodes: LayoutNode[] = []

  for (let index = 0; index < rawNodes.length; index += 1) {
    const rawItem = rawNodes[index]
    const segment = isRecord(rawItem)
      ? buildBreadcrumbSegment(rawItem, index)
      : { label: `[${index}]` }
    const nodeBreadcrumb = [...breadcrumb, segment]
    const nodeResult = validateLayoutNode(rawItem, `${path}[${index}]`, pageId, nodeBreadcrumb, ctx)

    if (nodeResult.status === 'error') {
      return nodeResult
    }

    nodes.push(nodeResult.node)
  }

  return {
    status: 'ready',
    nodes,
  }
}

export function validateLayoutNode(
  rawNode: unknown,
  path: string,
  pageId: string,
  breadcrumb: BreadcrumbSegment[] = [],
  ctx: LayoutValidationCtx = defaultLayoutValidationCtx,
): { status: 'ready'; node: LayoutNode } | { status: 'error'; error: RuntimeConfigError } {
  if (!isRecord(rawNode)) {
    return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}".`, breadcrumb, {} as Record<string, unknown>)
  }

  if (typeof rawNode.type !== 'string') {
    return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.type".`, breadcrumb, rawNode)
  }

  // `slot` is only a valid discriminant inside a group template; everywhere else it is rejected
  // the same way an unrecognized type would be, even though it is part of `supportedNodeTypes`.
  if (rawNode.type === 'slot' && !ctx.insideGroupTemplate) {
    return unsupportedNodeType(pageId, path, rawNode.type)
  }

  // Nested `group` instances inside a group template are out of scope for v1 (no group nesting).
  if (rawNode.type === 'group' && ctx.insideGroupTemplate) {
    return enrichedInvalidLayout(
      `Page "${pageId}" has an invalid layout at "${path}": nested "group" nodes are not supported inside a group template.`,
      breadcrumb,
      rawNode,
    )
  }

  if (!supportedNodeTypes.includes(rawNode.type as LayoutNodeType)) {
    return unsupportedNodeType(pageId, path, rawNode.type)
  }

  switch (rawNode.type) {
    case 'container':
      return validateContainerNode(rawNode, path, pageId, breadcrumb, ctx)
    case 'repeater':
      return validateRepeaterNode(rawNode, path, pageId, breadcrumb, ctx)
    case 'heading':
      return validateHeadingNode(rawNode, path, pageId, breadcrumb)
    case 'paragraph':
      return validateParagraphNode(rawNode, path, pageId, breadcrumb)
    case 'list':
      return validateListNode(rawNode, path, pageId, breadcrumb)
    case 'image':
      return validateImageNode(rawNode, path, pageId, breadcrumb)
    case 'table':
      return validateTableNode(rawNode, path, pageId, breadcrumb)
    case 'button':
      return validateButtonNode(rawNode, path, pageId, breadcrumb)
    case 'link':
      return validateLinkNode(rawNode, path, pageId, breadcrumb, ctx)
    case 'form':
      return validateFormNode(rawNode, path, pageId, breadcrumb, ctx)
    case 'input':
      return validateInputNode(rawNode, path, pageId, breadcrumb)
    case 'textarea':
      return validateTextareaNode(rawNode, path, pageId, breadcrumb)
    case 'select':
      return validateSelectNode(rawNode, path, pageId, breadcrumb)
    case 'radioGroup':
      return validateRadioGroupNode(rawNode, path, pageId, breadcrumb)
    case 'checkboxGroup':
      return validateCheckboxGroupNode(rawNode, path, pageId, breadcrumb)
    case 'modal':
      return validateModalNode(rawNode, path, pageId, breadcrumb, ctx)
    case 'tabs':
      return validateTabsNode(rawNode, path, pageId, breadcrumb, ctx)
    case 'steps':
      return validateStepsNode(rawNode, path, pageId, breadcrumb, ctx)
    case 'accordion':
      return validateAccordionNode(rawNode, path, pageId, breadcrumb, ctx)
    case 'badge':
      return validateBadgeNode(rawNode, path, pageId, breadcrumb)
    case 'alert':
      return validateAlertNode(rawNode, path, pageId, breadcrumb)
    case 'stat':
      return validateStatNode(rawNode, path, pageId, breadcrumb)
    case 'divider':
      return validateDividerNode(rawNode, path, pageId, breadcrumb)
    case 'skeleton':
      return validateSkeletonNode(rawNode, path, pageId, breadcrumb)
    case 'fileInput':
      return validateFileInputNode(rawNode, path, pageId, breadcrumb)
    case 'fileManager':
      return validateFileManagerNode(rawNode, path, pageId, breadcrumb)
    case 'toggle':
      return validateToggleNode(rawNode, path, pageId, breadcrumb)
    case 'hidden':
      return validateHiddenNode(rawNode, path, pageId, breadcrumb)
    case 'map':
      return validateMapNode(rawNode, path, pageId, breadcrumb)
    case 'gallery':
      return validateGalleryNode(rawNode, path, pageId, breadcrumb)
    case 'autocomplete':
      return validateAutocompleteNode(rawNode, path, pageId, breadcrumb)
    case 'slot':
      return { status: 'ready', node: { type: 'slot' } }
    case 'group':
      return validateGroupInstanceNode(rawNode, path, pageId, breadcrumb, ctx)
  }

  return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.type".`, breadcrumb, rawNode)
}

function validateGroupInstanceNode(
  rawNode: Record<string, unknown>,
  path: string,
  pageId: string,
  breadcrumb: BreadcrumbSegment[],
  ctx: LayoutValidationCtx,
): { status: 'ready'; node: RuntimeGroupInstanceNode } | { status: 'error'; error: RuntimeConfigError } {
  const parseResult = groupInstanceNodeSchema.safeParse(rawNode)

  if (!parseResult.success) {
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

  let children: LayoutNodeCollection | undefined

  if (parseResult.data.children !== undefined) {
    // `children` on a `group` instance is the content passed into the group's `slot`, not the
    // group's own template — it is validated with a fresh (non-template) context.
    const childrenResult = validateLayoutCollection(parseResult.data.children, `${path}.children`, pageId, breadcrumb, ctx)

    if (childrenResult.status === 'error') {
      return childrenResult
    }

    children = childrenResult.nodes
  }

  return {
    status: 'ready',
    node: {
      type: 'group',
      id: parseResult.data.id,
      queryStateFeedback: feedbackResult.queryStateFeedback,
      visibility: visibilityResult.visibility,
      layout: parseResult.data.layout,
      props: parseResult.data.props,
      children,
    },
  }
}

export function validateQueryStateFeedback(
  rawQueryStateFeedback: LayoutNodeFeedbackFields['queryStateFeedback'],
  path: string,
  pageId: string,
  breadcrumb: BreadcrumbSegment[] = [],
):
  | { status: 'ready'; queryStateFeedback: QueryStateFeedbackConfig | undefined }
  | { status: 'error'; error: RuntimeConfigError } {
  if (rawQueryStateFeedback === undefined) {
    return {
      status: 'ready',
      queryStateFeedback: undefined,
    }
  }

  if (rawQueryStateFeedback.states === undefined) {
    return {
      status: 'ready',
      queryStateFeedback: rawQueryStateFeedback,
    }
  }

  const normalizedStates: Partial<Record<QueryStateFeedbackVisibleState, QueryStateFeedbackRule>> = {}

  for (const state of Object.keys(rawQueryStateFeedback.states) as QueryStateFeedbackVisibleState[]) {
    const rule = rawQueryStateFeedback.states[state]

    if (rule === undefined) {
      continue
    }

    if (rule.mode !== 'fallback') {
      normalizedStates[state] = rule
      continue
    }

    const fallbackResult = validateLayoutCollection(rule.fallback, `${path}.states.${state}.fallback`, pageId, breadcrumb)

    if (fallbackResult.status === 'error') {
      return fallbackResult
    }

    normalizedStates[state] = {
      mode: 'fallback',
      fallback: fallbackResult.nodes,
    } satisfies QueryStateFeedbackFallbackRule
  }

  return {
    status: 'ready',
    queryStateFeedback: {
      query: rawQueryStateFeedback.query,
      states: normalizedStates,
    },
  }
}
