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
} from './runtime-config-types'
import { supportedNodeTypes } from './runtime-config-zod'
import { invalidLayout, unsupportedNodeType } from './runtime-config-validation-errors'
import type { BreadcrumbSegment } from './validation-breadcrumb'
import { buildBreadcrumbSegment, enrichedInvalidLayout } from './validation-breadcrumb'
import { isRecord } from './validate-node-shared-helpers'
import { validateContainerNode } from './validate-container-node'
import { validateRepeaterNode } from './validate-repeater-node'
import { validateHeadingNode, validateParagraphNode, validateListNode } from './validate-heading-paragraph-list-nodes'
import { validateImageNode } from './validate-image-node'
import { validateTableNode } from './validate-table-node'
import { validateButtonNode } from './validate-button-node'
import { validateLinkNode } from './validate-link-node'
import { validateModalNode } from './validate-modal-node'
import { validateTabsNode } from './validate-tabs-node'
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

export function validateLayoutCollection(
  rawNodes: unknown,
  path: string,
  pageId: string,
  breadcrumb: BreadcrumbSegment[] = [],
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
    const nodeResult = validateLayoutNode(rawItem, `${path}[${index}]`, pageId, nodeBreadcrumb)

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
): { status: 'ready'; node: LayoutNode } | { status: 'error'; error: RuntimeConfigError } {
  if (!isRecord(rawNode)) {
    return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}".`, breadcrumb, {} as Record<string, unknown>)
  }

  if (typeof rawNode.type !== 'string') {
    return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.type".`, breadcrumb, rawNode)
  }

  if (!supportedNodeTypes.includes(rawNode.type as LayoutNodeType)) {
    return unsupportedNodeType(pageId, path, rawNode.type)
  }

  switch (rawNode.type) {
    case 'container':
      return validateContainerNode(rawNode, path, pageId, breadcrumb)
    case 'repeater':
      return validateRepeaterNode(rawNode, path, pageId, breadcrumb)
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
      return validateLinkNode(rawNode, path, pageId, breadcrumb)
    case 'form':
      return validateFormNode(rawNode, path, pageId, breadcrumb)
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
      return validateModalNode(rawNode, path, pageId, breadcrumb)
    case 'tabs':
      return validateTabsNode(rawNode, path, pageId, breadcrumb)
    case 'accordion':
      return validateAccordionNode(rawNode, path, pageId, breadcrumb)
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
  }

  return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.type".`, breadcrumb, rawNode)
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
