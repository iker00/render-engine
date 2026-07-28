import type {
  CheckboxGroupLayoutNode,
  InputLayoutNode,
  LayoutNodeFeedbackFields,
  RadioGroupLayoutNode,
  RuntimeConfigError,
  SelectLayoutNode,
  TextareaLayoutNode,
  ToggleLayoutNode,
} from './runtime-config-types'
import {
  checkboxGroupNodeSchema,
  inputNodeSchema,
  radioGroupNodeSchema,
  selectNodeSchema,
  textareaNodeSchema,
  toggleNodeSchema,
} from './runtime-config-zod'
import type { BreadcrumbSegment } from './validation-breadcrumb'
import { enrichedInvalidLayout, enrichErrorResult } from './validation-breadcrumb'
import { parseRuntimeReference } from '../runtime/runtime-references/runtime-reference-parser'
import { isTokensReference } from './runtime-reference-namespace-guards'
import { validateQueryStateFeedback } from './validate-layout-nodes-core'
import { mapLeafNodeIssue } from './validate-layout-issue-mapping'
import { mapQueryStateFeedbackIssue, mapVisibilityIssue, validateVisibility } from './validate-actions-visibility'
import { validateFormFieldValidations } from './validate-form-field-validations'
import { validateChoiceFieldDefaultValue, validateSelectItemsContract } from './validate-form-choice-items'

export function validateInputNode(
  rawNode: Record<string, unknown>,
  path: string,
  pageId: string,
  breadcrumb: BreadcrumbSegment[] = [],
): { status: 'ready'; node: InputLayoutNode } | { status: 'error'; error: RuntimeConfigError } {
  const parseResult = inputNodeSchema.safeParse(rawNode)

  if (!parseResult.success) {
    const feedbackIssue = mapQueryStateFeedbackIssue(pageId, path, parseResult.error.issues[0])

    if (feedbackIssue) {
      return enrichErrorResult(feedbackIssue, breadcrumb, rawNode)
    }

    const visibilityIssue = mapVisibilityIssue(pageId, path, parseResult.error.issues[0])

    if (visibilityIssue) {
      return enrichErrorResult(visibilityIssue, breadcrumb, rawNode)
    }

    return mapLeafNodeIssue(pageId, path, parseResult.error.issues[0]?.path ?? [], breadcrumb, rawNode)
  }

  const feedbackResult = validateQueryStateFeedback(
    parseResult.data.queryStateFeedback as LayoutNodeFeedbackFields['queryStateFeedback'],
    `${path}.queryStateFeedback`,
    pageId,
  )

  if (feedbackResult.status === 'error') {
    return enrichErrorResult(feedbackResult, breadcrumb, rawNode)
  }

  const visibilityResult = validateVisibility(
    parseResult.data.visibility as LayoutNodeFeedbackFields['visibility'],
    `${path}.visibility`,
    pageId,
  )

  if (visibilityResult.status === 'error') {
    return enrichErrorResult(visibilityResult, breadcrumb, rawNode)
  }

  if (Array.isArray(parseResult.data.props.defaultValue)) {
    return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.defaultValue": input fields do not accept array literal defaultValue.`, breadcrumb, rawNode)
  }

  if (typeof parseResult.data.props.defaultValue === 'string' && isTokensReference(parseResult.data.props.defaultValue)) {
    return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.defaultValue": tokens.* references are not supported in defaultValue.`, breadcrumb, rawNode)
  }

  const validationsResult = validateFormFieldValidations(
    rawNode.props,
    parseResult.data.props.validations,
    {
      type: 'input',
      inputType: parseResult.data.props.inputType,
    },
    path,
    pageId,
    breadcrumb,
    rawNode,
  )

  if (validationsResult.status === 'error') {
    return validationsResult
  }

  return {
    status: 'ready',
    node: {
      type: 'input',
      layout: parseResult.data.layout,
      props: {
        ...parseResult.data.props,
        validations: validationsResult.validations,
      },
      queryStateFeedback: feedbackResult.queryStateFeedback,
      visibility: visibilityResult.visibility,
    },
  }
}

export function validateTextareaNode(
  rawNode: Record<string, unknown>,
  path: string,
  pageId: string,
  breadcrumb: BreadcrumbSegment[] = [],
): { status: 'ready'; node: TextareaLayoutNode } | { status: 'error'; error: RuntimeConfigError } {
  const parseResult = textareaNodeSchema.safeParse(rawNode)

  if (!parseResult.success) {
    const feedbackIssue = mapQueryStateFeedbackIssue(pageId, path, parseResult.error.issues[0])

    if (feedbackIssue) {
      return enrichErrorResult(feedbackIssue, breadcrumb, rawNode)
    }

    const visibilityIssue = mapVisibilityIssue(pageId, path, parseResult.error.issues[0])

    if (visibilityIssue) {
      return enrichErrorResult(visibilityIssue, breadcrumb, rawNode)
    }

    return mapLeafNodeIssue(pageId, path, parseResult.error.issues[0]?.path ?? [], breadcrumb, rawNode)
  }

  const feedbackResult = validateQueryStateFeedback(
    parseResult.data.queryStateFeedback as LayoutNodeFeedbackFields['queryStateFeedback'],
    `${path}.queryStateFeedback`,
    pageId,
  )

  if (feedbackResult.status === 'error') {
    return enrichErrorResult(feedbackResult, breadcrumb, rawNode)
  }

  const visibilityResult = validateVisibility(
    parseResult.data.visibility as LayoutNodeFeedbackFields['visibility'],
    `${path}.visibility`,
    pageId,
  )

  if (visibilityResult.status === 'error') {
    return enrichErrorResult(visibilityResult, breadcrumb, rawNode)
  }

  if (Array.isArray(parseResult.data.props.defaultValue)) {
    return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.defaultValue": textarea fields do not accept array literal defaultValue.`, breadcrumb, rawNode)
  }

  if (typeof parseResult.data.props.defaultValue === 'string' && isTokensReference(parseResult.data.props.defaultValue)) {
    return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.defaultValue": tokens.* references are not supported in defaultValue.`, breadcrumb, rawNode)
  }

  const validationsResult = validateFormFieldValidations(rawNode.props, parseResult.data.props.validations, { type: 'textarea' }, path, pageId, breadcrumb, rawNode)

  if (validationsResult.status === 'error') {
    return validationsResult
  }

  return {
    status: 'ready',
    node: {
      type: 'textarea',
      layout: parseResult.data.layout,
      props: {
        ...parseResult.data.props,
        validations: validationsResult.validations,
      },
      queryStateFeedback: feedbackResult.queryStateFeedback,
      visibility: visibilityResult.visibility,
    },
  }
}

export function validateSelectNode(
  rawNode: Record<string, unknown>,
  path: string,
  pageId: string,
  breadcrumb: BreadcrumbSegment[] = [],
): { status: 'ready'; node: SelectLayoutNode } | { status: 'error'; error: RuntimeConfigError } {
  const parseResult = selectNodeSchema.safeParse(rawNode)

  if (!parseResult.success) {
    const feedbackIssue = mapQueryStateFeedbackIssue(pageId, path, parseResult.error.issues[0])

    if (feedbackIssue) {
      return enrichErrorResult(feedbackIssue, breadcrumb, rawNode)
    }

    const visibilityIssue = mapVisibilityIssue(pageId, path, parseResult.error.issues[0])

    if (visibilityIssue) {
      return enrichErrorResult(visibilityIssue, breadcrumb, rawNode)
    }

    return mapLeafNodeIssue(pageId, path, parseResult.error.issues[0]?.path ?? [], breadcrumb, rawNode)
  }

  const feedbackResult = validateQueryStateFeedback(
    parseResult.data.queryStateFeedback as LayoutNodeFeedbackFields['queryStateFeedback'],
    `${path}.queryStateFeedback`,
    pageId,
  )

  if (feedbackResult.status === 'error') {
    return enrichErrorResult(feedbackResult, breadcrumb, rawNode)
  }

  const visibilityResult = validateVisibility(
    parseResult.data.visibility as LayoutNodeFeedbackFields['visibility'],
    `${path}.visibility`,
    pageId,
  )

  if (visibilityResult.status === 'error') {
    return enrichErrorResult(visibilityResult, breadcrumb, rawNode)
  }

  const itemsResult = validateSelectItemsContract(parseResult.data.props.items, `${path}.props.items`, pageId, breadcrumb, rawNode)

  if (itemsResult.status === 'error') {
    return itemsResult
  }

  const defaultValueIssue = validateChoiceFieldDefaultValue(
    parseResult.data.props.defaultValue,
    `${path}.props.defaultValue`,
    pageId,
    parseResult.data.props.multiple === true,
    breadcrumb,
    rawNode,
  )

  if (defaultValueIssue) {
    return defaultValueIssue
  }

  const validationsResult = validateFormFieldValidations(
    rawNode.props,
    parseResult.data.props.validations,
    {
      type: 'select',
      multiple: parseResult.data.props.multiple === true,
    },
    path,
    pageId,
    breadcrumb,
    rawNode,
  )

  if (validationsResult.status === 'error') {
    return validationsResult
  }

  return {
    status: 'ready',
    node: {
      layout: parseResult.data.layout,
      type: 'select',
      queryStateFeedback: feedbackResult.queryStateFeedback,
      visibility: visibilityResult.visibility,
      props: {
        ...parseResult.data.props,
        items: itemsResult.items,
        validations: validationsResult.validations,
      },
    },
  }
}

export function validateRadioGroupNode(
  rawNode: Record<string, unknown>,
  path: string,
  pageId: string,
  breadcrumb: BreadcrumbSegment[] = [],
): { status: 'ready'; node: RadioGroupLayoutNode } | { status: 'error'; error: RuntimeConfigError } {
  const parseResult = radioGroupNodeSchema.safeParse(rawNode)

  if (!parseResult.success) {
    const feedbackIssue = mapQueryStateFeedbackIssue(pageId, path, parseResult.error.issues[0])

    if (feedbackIssue) {
      return enrichErrorResult(feedbackIssue, breadcrumb, rawNode)
    }

    const visibilityIssue = mapVisibilityIssue(pageId, path, parseResult.error.issues[0])

    if (visibilityIssue) {
      return enrichErrorResult(visibilityIssue, breadcrumb, rawNode)
    }

    return mapLeafNodeIssue(pageId, path, parseResult.error.issues[0]?.path ?? [], breadcrumb, rawNode)
  }

  const feedbackResult = validateQueryStateFeedback(
    parseResult.data.queryStateFeedback as LayoutNodeFeedbackFields['queryStateFeedback'],
    `${path}.queryStateFeedback`,
    pageId,
  )

  if (feedbackResult.status === 'error') {
    return enrichErrorResult(feedbackResult, breadcrumb, rawNode)
  }

  const visibilityResult = validateVisibility(
    parseResult.data.visibility as LayoutNodeFeedbackFields['visibility'],
    `${path}.visibility`,
    pageId,
  )

  if (visibilityResult.status === 'error') {
    return enrichErrorResult(visibilityResult, breadcrumb, rawNode)
  }

  const itemsResult = validateSelectItemsContract(parseResult.data.props.items, `${path}.props.items`, pageId, breadcrumb, rawNode)

  if (itemsResult.status === 'error') {
    return itemsResult
  }

  const defaultValueIssue = validateChoiceFieldDefaultValue(
    parseResult.data.props.defaultValue,
    `${path}.props.defaultValue`,
    pageId,
    false,
    breadcrumb,
    rawNode,
  )

  if (defaultValueIssue) {
    return defaultValueIssue
  }

  const validationsResult = validateFormFieldValidations(
    rawNode.props,
    parseResult.data.props.validations,
    {
      type: 'radioGroup',
    },
    path,
    pageId,
    breadcrumb,
    rawNode,
  )

  if (validationsResult.status === 'error') {
    return validationsResult
  }

  return {
    status: 'ready',
    node: {
      layout: parseResult.data.layout,
      type: 'radioGroup',
      queryStateFeedback: feedbackResult.queryStateFeedback,
      visibility: visibilityResult.visibility,
      props: {
        ...parseResult.data.props,
        items: itemsResult.items,
        validations: validationsResult.validations,
      },
    },
  }
}

export function validateCheckboxGroupNode(
  rawNode: Record<string, unknown>,
  path: string,
  pageId: string,
  breadcrumb: BreadcrumbSegment[] = [],
): { status: 'ready'; node: CheckboxGroupLayoutNode } | { status: 'error'; error: RuntimeConfigError } {
  const parseResult = checkboxGroupNodeSchema.safeParse(rawNode)

  if (!parseResult.success) {
    const feedbackIssue = mapQueryStateFeedbackIssue(pageId, path, parseResult.error.issues[0])

    if (feedbackIssue) {
      return enrichErrorResult(feedbackIssue, breadcrumb, rawNode)
    }

    const visibilityIssue = mapVisibilityIssue(pageId, path, parseResult.error.issues[0])

    if (visibilityIssue) {
      return enrichErrorResult(visibilityIssue, breadcrumb, rawNode)
    }

    return mapLeafNodeIssue(pageId, path, parseResult.error.issues[0]?.path ?? [], breadcrumb, rawNode)
  }

  const feedbackResult = validateQueryStateFeedback(
    parseResult.data.queryStateFeedback as LayoutNodeFeedbackFields['queryStateFeedback'],
    `${path}.queryStateFeedback`,
    pageId,
  )

  if (feedbackResult.status === 'error') {
    return enrichErrorResult(feedbackResult, breadcrumb, rawNode)
  }

  const visibilityResult = validateVisibility(
    parseResult.data.visibility as LayoutNodeFeedbackFields['visibility'],
    `${path}.visibility`,
    pageId,
  )

  if (visibilityResult.status === 'error') {
    return enrichErrorResult(visibilityResult, breadcrumb, rawNode)
  }

  const itemsResult = validateSelectItemsContract(parseResult.data.props.items, `${path}.props.items`, pageId, breadcrumb, rawNode)

  if (itemsResult.status === 'error') {
    return itemsResult
  }

  const defaultValueIssue = validateChoiceFieldDefaultValue(
    parseResult.data.props.defaultValue,
    `${path}.props.defaultValue`,
    pageId,
    true,
    breadcrumb,
    rawNode,
  )

  if (defaultValueIssue) {
    return defaultValueIssue
  }

  const validationsResult = validateFormFieldValidations(
    rawNode.props,
    parseResult.data.props.validations,
    {
      type: 'checkboxGroup',
    },
    path,
    pageId,
    breadcrumb,
    rawNode,
  )

  if (validationsResult.status === 'error') {
    return validationsResult
  }

  return {
    status: 'ready',
    node: {
      layout: parseResult.data.layout,
      type: 'checkboxGroup',
      queryStateFeedback: feedbackResult.queryStateFeedback,
      visibility: visibilityResult.visibility,
      props: {
        ...parseResult.data.props,
        items: itemsResult.items,
        validations: validationsResult.validations,
      },
    },
  }
}

export function validateToggleNode(
  rawNode: Record<string, unknown>,
  path: string,
  pageId: string,
  breadcrumb: BreadcrumbSegment[] = [],
): { status: 'ready'; node: ToggleLayoutNode } | { status: 'error'; error: RuntimeConfigError } {
  const parseResult = toggleNodeSchema.safeParse(rawNode)

  if (!parseResult.success) {
    const feedbackIssue = mapQueryStateFeedbackIssue(pageId, path, parseResult.error.issues[0])

    if (feedbackIssue) {
      return enrichErrorResult(feedbackIssue, breadcrumb, rawNode)
    }

    const visibilityIssue = mapVisibilityIssue(pageId, path, parseResult.error.issues[0])

    if (visibilityIssue) {
      return enrichErrorResult(visibilityIssue, breadcrumb, rawNode)
    }

    return mapLeafNodeIssue(pageId, path, parseResult.error.issues[0]?.path ?? [], breadcrumb, rawNode)
  }

  const feedbackResult = validateQueryStateFeedback(
    parseResult.data.queryStateFeedback as LayoutNodeFeedbackFields['queryStateFeedback'],
    `${path}.queryStateFeedback`,
    pageId,
  )

  if (feedbackResult.status === 'error') {
    return enrichErrorResult(feedbackResult, breadcrumb, rawNode)
  }

  const visibilityResult = validateVisibility(
    parseResult.data.visibility as LayoutNodeFeedbackFields['visibility'],
    `${path}.visibility`,
    pageId,
  )

  if (visibilityResult.status === 'error') {
    return enrichErrorResult(visibilityResult, breadcrumb, rawNode)
  }

  if (typeof parseResult.data.props.defaultValue === 'string') {
    const ref = parseRuntimeReference(parseResult.data.props.defaultValue, { allowItemReference: true })

    if (ref.kind !== 'reference' || ref.status !== 'supported') {
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.defaultValue".`, breadcrumb, rawNode)
    }
  }

  const validationsResult = validateFormFieldValidations(rawNode.props, parseResult.data.props.validations, { type: 'toggle' }, path, pageId, breadcrumb, rawNode)

  if (validationsResult.status === 'error') {
    return validationsResult
  }

  return {
    status: 'ready',
    node: {
      type: 'toggle',
      layout: parseResult.data.layout,
      props: {
        ...parseResult.data.props,
        validations: validationsResult.validations,
      },
      queryStateFeedback: feedbackResult.queryStateFeedback,
      visibility: visibilityResult.visibility,
    },
  }
}
