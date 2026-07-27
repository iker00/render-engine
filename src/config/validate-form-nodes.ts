import type {
  CheckboxGroupLayoutNode,
  ExecuteOperationRuntimeUiAction,
  ExecuteOperationsRuntimeUiAction,
  FormLayoutNode,
  FormOnErrorAction,
  HiddenLayoutNode,
  InputLayoutNode, LayoutNode,
  LayoutNodeCollection,
  LayoutNodeFeedbackFields,
  RadioGroupLayoutNode,
  RuntimeBooleanFlagValidationRule,
  RuntimeConfigError,
  RuntimeFormFieldValidations,
  RuntimeFormValidationRuleName,
  RuntimeNumericValidationRule,
  RuntimePatternValidationRule,
  RuntimeRequiredValidationRule,
  SelectLayoutNode,
  TextareaLayoutNode,
  ToggleLayoutNode,
} from './runtime-config-types'
import {
  checkboxGroupNodeSchema,
  formNodeSchema,
  hiddenNodeSchema,
  inputNodeSchema,
  radioGroupNodeSchema,
  selectItemsSchema,
  selectNodeSchema,
  textareaNodeSchema,
  toggleNodeSchema,
} from './runtime-config-zod'
import { invalidLayout } from './runtime-config-validation-errors'
import { buttonRequiresFormAncestor, FORM_ALLOWED_DESCENDANT_TYPES, FORM_ONLY_LEAF_NODE_TYPES } from './layout-placement-rules'
import type { BreadcrumbSegment } from './validation-breadcrumb'
import { enrichedInvalidLayout, enrichedInvalidLayoutFromNode, enrichErrorResult, buildBreadcrumbSegmentFromNode } from './validation-breadcrumb'
import { hasRuntimeTemplateDelimiter, parseRuntimeReference } from '../runtime/runtime-references/runtime-reference-parser'
import { isTokensReference } from './runtime-reference-namespace-guards'
import {
  validateLayoutCollection,
  validateQueryStateFeedback,
  validateVisibility,
  mapLeafNodeIssue,
  mapLayoutNodeIssue,
} from './validate-layout-nodes'
import { mapQueryStateFeedbackIssue, mapVisibilityIssue, validateFormSubmitAction, validateWhenCondition } from './validate-actions-visibility'

const collectionPathSegmentPattern = /^[A-Za-z0-9_-]+$/
const supportedFormValidationRuleNames = new Set<RuntimeFormValidationRuleName>([
  'required',
  'minLength',
  'maxLength',
  'min',
  'max',
  'minSelections',
  'maxSelections',
  'pattern',
  'email',
  'url',
])

type FormFieldValidationTarget =
  | { type: 'input'; inputType?: InputLayoutNode['props']['inputType'] }
  | { type: 'textarea' }
  | { type: 'select'; multiple: boolean }
  | { type: 'radioGroup' }
  | { type: 'checkboxGroup' }
  | { type: 'toggle' }

export function validateFormNode(
  rawNode: Record<string, unknown>,
  path: string,
  pageId: string,
  breadcrumb: BreadcrumbSegment[] = [],
): { status: 'ready'; node: FormLayoutNode } | { status: 'error'; error: RuntimeConfigError } {
  const parseResult = formNodeSchema.safeParse(rawNode)

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

    const issuePath = issue?.path ?? []

    if (issuePath[0] === 'id') {
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.id".`, breadcrumb, rawNode)
    }

    if (issuePath[0] === 'submitAction') {
      const remainingSegments = issuePath.slice(1).map(formatPathSegment).join('')
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.submitAction${remainingSegments}".`, breadcrumb, rawNode)
    }

    if (issuePath[0] === 'resetOnSuccess') {
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.resetOnSuccess".`, breadcrumb, rawNode)
    }

    if (issuePath[0] === 'persistOnUnmount') {
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.persistOnUnmount".`, breadcrumb, rawNode)
    }

    if (issuePath[0] === 'children') {
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.children".`, breadcrumb, rawNode)
    }

    const layoutIssue = mapLayoutNodeIssue(pageId, path, issuePath, breadcrumb, rawNode)

    if (layoutIssue) {
      return layoutIssue
    }

    return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}".`, breadcrumb, rawNode)
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

  let children: LayoutNodeCollection | undefined
  let submitAction: ExecuteOperationRuntimeUiAction | ExecuteOperationsRuntimeUiAction | undefined
  let onSuccess: import('./runtime-config-types').FormOnSuccessAction[] | undefined
  let onError: FormOnErrorAction[] | undefined

  if (parseResult.data.submitAction !== undefined) {
    const submitActionResult = validateFormSubmitAction(parseResult.data.submitAction, `${path}.submitAction`, pageId)

    if (submitActionResult.status === 'error') {
      return enrichErrorResult(submitActionResult, breadcrumb, rawNode)
    }

    submitAction = submitActionResult.action
    onSuccess = submitActionResult.onSuccess
    onError = submitActionResult.onError
  }

  if (parseResult.data.children !== undefined) {
    const childrenResult = validateLayoutCollection(parseResult.data.children, `${path}.children`, pageId, breadcrumb)

    if (childrenResult.status === 'error') {
      return childrenResult
    }

    children = childrenResult.nodes
  }

  return {
    status: 'ready',
    node: {
      type: 'form',
      id: parseResult.data.id,
      queryStateFeedback: feedbackResult.queryStateFeedback,
      visibility: visibilityResult.visibility,
      layout: parseResult.data.layout,
      persistOnUnmount: parseResult.data.persistOnUnmount,
      submitAction,
      resetOnSuccess: parseResult.data.resetOnSuccess,
      onSuccess,
      onError,
      children,
    },
  }
}

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

export function validateFormFieldValidations(
  rawProps: unknown,
  rawValidations: unknown,
  target: FormFieldValidationTarget,
  path: string,
  pageId: string,
  breadcrumb: BreadcrumbSegment[] = [],
  rawNode?: Record<string, unknown>,
): { status: 'ready'; validations: RuntimeFormFieldValidations | undefined } | { status: 'error'; error: RuntimeConfigError } {
  if (isRecord(rawProps) && Object.hasOwn(rawProps, 'required')) {
    return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.required": use props.validations.required instead.`, breadcrumb, rawNode)
  }

  if (typeof rawValidations === 'undefined') {
    return {
      status: 'ready',
      validations: undefined,
    }
  }

  if (!isRecord(rawValidations)) {
    return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.validations".`, breadcrumb, rawNode)
  }

  const validations: RuntimeFormFieldValidations = {}

  for (const [ruleName, rawRule] of Object.entries(rawValidations)) {
    if (!supportedFormValidationRuleNames.has(ruleName as RuntimeFormValidationRuleName)) {
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.validations.${ruleName}".`, breadcrumb, rawNode)
    }

    const rulePath = `${path}.props.validations.${ruleName}`

    let validationResult:
      | { status: 'ready'; rule: RuntimeRequiredValidationRule | RuntimeNumericValidationRule | RuntimePatternValidationRule | RuntimeBooleanFlagValidationRule }
      | { status: 'error'; error: RuntimeConfigError }

    if (ruleName === 'required') {
      validationResult = validateRequiredRule(rawRule, rulePath, pageId, breadcrumb, rawNode)
    } else if (ruleName === 'pattern') {
      validationResult = validatePatternRule(rawRule, rulePath, pageId, breadcrumb, rawNode)
    } else if (ruleName === 'email' || ruleName === 'url') {
      validationResult = validateBooleanFlagRule(rawRule, rulePath, pageId, breadcrumb, rawNode)
    } else {
      validationResult = validateNumericRule(rawRule, rulePath, pageId, breadcrumb, rawNode)
    }

    if (validationResult.status === 'error') {
      return validationResult
    }

    const compatibilityError = validateValidationCompatibility(ruleName as RuntimeFormValidationRuleName, validationResult.rule, target, path, pageId, breadcrumb, rawNode)

    if (compatibilityError) {
      return compatibilityError
    }

    switch (ruleName) {
      case 'required':
        validations.required = validationResult.rule as RuntimeRequiredValidationRule
        break
      case 'minLength':
        validations.minLength = validationResult.rule as RuntimeNumericValidationRule
        break
      case 'maxLength':
        validations.maxLength = validationResult.rule as RuntimeNumericValidationRule
        break
      case 'min':
        validations.min = validationResult.rule as RuntimeNumericValidationRule
        break
      case 'max':
        validations.max = validationResult.rule as RuntimeNumericValidationRule
        break
      case 'minSelections':
        validations.minSelections = validationResult.rule as RuntimeNumericValidationRule
        break
      case 'maxSelections':
        validations.maxSelections = validationResult.rule as RuntimeNumericValidationRule
        break
      case 'pattern':
        validations.pattern = validationResult.rule as RuntimePatternValidationRule
        break
      case 'email':
        validations.email = validationResult.rule as RuntimeBooleanFlagValidationRule
        break
      case 'url':
        validations.url = validationResult.rule as RuntimeBooleanFlagValidationRule
        break
    }
  }

  const rangesError = validateValidationRanges(validations, `${path}.props.validations`, pageId, breadcrumb, rawNode)

  if (rangesError) {
    return rangesError
  }

  return {
    status: 'ready',
    validations,
  }
}

function validateRequiredRule(
  rawRule: unknown,
  path: string,
  pageId: string,
  breadcrumb: BreadcrumbSegment[] = [],
  rawNode?: Record<string, unknown>,
): { status: 'ready'; rule: RuntimeRequiredValidationRule } | { status: 'error'; error: RuntimeConfigError } {
  if (rawRule === true) {
    return {
      status: 'ready',
      rule: { value: true },
    }
  }

  if (!isRecord(rawRule)) {
    return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}".`, breadcrumb, rawNode)
  }

  if (rawRule.value !== true) {
    return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.value".`, breadcrumb, rawNode)
  }

  if (typeof rawRule.message !== 'undefined' && typeof rawRule.message !== 'string') {
    return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.message".`, breadcrumb, rawNode)
  }

  const whenResult = validateWhenCondition(rawRule.when, `${path}.when`, pageId, { allowItem: true })

  if (whenResult.status === 'error') {
    return enrichErrorResult(whenResult, breadcrumb, rawNode)
  }

  const rule: RuntimeRequiredValidationRule = typeof rawRule.message === 'string' ? { value: true, message: rawRule.message } : { value: true }

  if (whenResult.when) {
    rule.when = whenResult.when
  }

  return {
    status: 'ready',
    rule,
  }
}

function validateNumericRule(
  rawRule: unknown,
  path: string,
  pageId: string,
  breadcrumb: BreadcrumbSegment[] = [],
  rawNode?: Record<string, unknown>,
): { status: 'ready'; rule: RuntimeNumericValidationRule } | { status: 'error'; error: RuntimeConfigError } {
  if (typeof rawRule === 'number') {
    if (!Number.isFinite(rawRule) || rawRule < 0) {
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}".`, breadcrumb, rawNode)
    }

    return {
      status: 'ready',
      rule: { value: rawRule },
    }
  }

  if (!isRecord(rawRule)) {
    return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}".`, breadcrumb, rawNode)
  }

  if (typeof rawRule.value !== 'number' || !Number.isFinite(rawRule.value) || rawRule.value < 0) {
    return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.value".`, breadcrumb, rawNode)
  }

  if (typeof rawRule.message !== 'undefined' && typeof rawRule.message !== 'string') {
    return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.message".`, breadcrumb, rawNode)
  }

  const whenResult = validateWhenCondition(rawRule.when, `${path}.when`, pageId, { allowItem: true })

  if (whenResult.status === 'error') {
    return enrichErrorResult(whenResult, breadcrumb, rawNode)
  }

  const rule: RuntimeNumericValidationRule = typeof rawRule.message === 'string' ? { value: rawRule.value, message: rawRule.message } : { value: rawRule.value }

  if (whenResult.when) {
    rule.when = whenResult.when
  }

  return {
    status: 'ready',
    rule,
  }
}

function validatePatternRule(
  rawRule: unknown,
  path: string,
  pageId: string,
  breadcrumb: BreadcrumbSegment[] = [],
  rawNode?: Record<string, unknown>,
): { status: 'ready'; rule: RuntimePatternValidationRule } | { status: 'error'; error: RuntimeConfigError } {
  if (typeof rawRule === 'string') {
    if (rawRule.length === 0) {
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}".`, breadcrumb, rawNode)
    }

    try {
      new RegExp(rawRule)
    } catch {
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.value".`, breadcrumb, rawNode)
    }

    return {
      status: 'ready',
      rule: { value: rawRule },
    }
  }

  if (!isRecord(rawRule)) {
    return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}".`, breadcrumb, rawNode)
  }

  if (typeof rawRule.value !== 'string' || rawRule.value.length === 0) {
    return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.value".`, breadcrumb, rawNode)
  }

  try {
    new RegExp(rawRule.value)
  } catch {
    return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.value".`, breadcrumb, rawNode)
  }

  if (typeof rawRule.message !== 'undefined' && typeof rawRule.message !== 'string') {
    return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.message".`, breadcrumb, rawNode)
  }

  const whenResult = validateWhenCondition(rawRule.when, `${path}.when`, pageId, { allowItem: true })

  if (whenResult.status === 'error') {
    return enrichErrorResult(whenResult, breadcrumb, rawNode)
  }

  const rule: RuntimePatternValidationRule = typeof rawRule.message === 'string' ? { value: rawRule.value, message: rawRule.message } : { value: rawRule.value }

  if (whenResult.when) {
    rule.when = whenResult.when
  }

  return {
    status: 'ready',
    rule,
  }
}

function validateBooleanFlagRule(
  rawRule: unknown,
  path: string,
  pageId: string,
  breadcrumb: BreadcrumbSegment[] = [],
  rawNode?: Record<string, unknown>,
): { status: 'ready'; rule: RuntimeBooleanFlagValidationRule } | { status: 'error'; error: RuntimeConfigError } {
  if (rawRule === true) {
    return {
      status: 'ready',
      rule: { value: true },
    }
  }

  if (!isRecord(rawRule)) {
    return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}".`, breadcrumb, rawNode)
  }

  if (rawRule.value !== true) {
    return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.value".`, breadcrumb, rawNode)
  }

  if (typeof rawRule.message !== 'undefined' && typeof rawRule.message !== 'string') {
    return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.message".`, breadcrumb, rawNode)
  }

  const whenResult = validateWhenCondition(rawRule.when, `${path}.when`, pageId, { allowItem: true })

  if (whenResult.status === 'error') {
    return enrichErrorResult(whenResult, breadcrumb, rawNode)
  }

  const rule: RuntimeBooleanFlagValidationRule = typeof rawRule.message === 'string' ? { value: true, message: rawRule.message } : { value: true }

  if (whenResult.when) {
    rule.when = whenResult.when
  }

  return {
    status: 'ready',
    rule,
  }
}

function validateValidationCompatibility(
  ruleName: RuntimeFormValidationRuleName,
  rule: RuntimeRequiredValidationRule | RuntimeNumericValidationRule | RuntimePatternValidationRule | RuntimeBooleanFlagValidationRule,
  target: FormFieldValidationTarget,
  path: string,
  pageId: string,
  breadcrumb: BreadcrumbSegment[] = [],
  rawNode?: Record<string, unknown>,
) {
  if (ruleName === 'required') {
    return null
  }

  if ((ruleName === 'minLength' || ruleName === 'maxLength') && supportsTextLengthValidations(target)) {
    if (!Number.isInteger((rule as RuntimeNumericValidationRule).value)) {
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.validations.${ruleName}.value".`, breadcrumb, rawNode)
    }

    return null
  }

  if ((ruleName === 'min' || ruleName === 'max') && target.type === 'input' && target.inputType === 'number') {
    return null
  }

  if ((ruleName === 'minSelections' || ruleName === 'maxSelections') && supportsSelectionCardinalityValidations(target)) {
    if (!Number.isInteger((rule as RuntimeNumericValidationRule).value)) {
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.validations.${ruleName}.value".`, breadcrumb, rawNode)
    }

    return null
  }

  if ((ruleName === 'pattern' || ruleName === 'email' || ruleName === 'url') && supportsTextualValidations(target)) {
    return null
  }

  return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.validations.${ruleName}".`, breadcrumb, rawNode)
}

function validateValidationRanges(
  validations: RuntimeFormFieldValidations,
  path: string,
  pageId: string,
  breadcrumb: BreadcrumbSegment[] = [],
  rawNode?: Record<string, unknown>,
) {
  if (
    validations.minLength &&
    validations.maxLength &&
    validations.minLength.value > validations.maxLength.value
  ) {
    return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}": minLength cannot be greater than maxLength.`, breadcrumb, rawNode)
  }

  if (validations.min && validations.max && validations.min.value > validations.max.value) {
    return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}": min cannot be greater than max.`, breadcrumb, rawNode)
  }

  if (
    validations.minSelections &&
    validations.maxSelections &&
    validations.minSelections.value > validations.maxSelections.value
  ) {
    return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}": minSelections cannot be greater than maxSelections.`, breadcrumb, rawNode)
  }

  return null
}

function supportsTextLengthValidations(target: FormFieldValidationTarget) {
  if (target.type === 'textarea') {
    return true
  }

  return (
    target.type === 'input' &&
    target.inputType !== 'number' &&
    target.inputType !== 'date' &&
    target.inputType !== 'datetime-local' &&
    target.inputType !== 'time'
  )
}

function supportsSelectionCardinalityValidations(target: FormFieldValidationTarget) {
  return target.type === 'checkboxGroup' || (target.type === 'select' && target.multiple)
}

function supportsTextualValidations(target: FormFieldValidationTarget) {
  if (target.type === 'textarea') {
    return true
  }

  return (
    target.type === 'input' &&
    target.inputType !== 'number' &&
    target.inputType !== 'date' &&
    target.inputType !== 'datetime-local' &&
    target.inputType !== 'time'
  )
}

export function validateSelectItemsContract(
  rawItems: unknown,
  path: string,
  pageId: string,
  breadcrumb: BreadcrumbSegment[] = [],
  rawNode?: Record<string, unknown>,
): { status: 'ready'; items: SelectLayoutNode['props']['items'] } | { status: 'error'; error: RuntimeConfigError } {
  const parseResult = selectItemsSchema.safeParse(rawItems)

  if (!parseResult.success) {
    const issuePath = parseResult.error.issues[0]?.path ?? []
    const formattedPath = issuePath.map(formatPathSegment).join('')
    return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}${formattedPath}".`, breadcrumb, rawNode)
  }

  const items = parseResult.data

  if (Array.isArray(items)) {
    const scalarValuesIssue = validateSelectScalarValues(items.map((item) => item.value), path, pageId, breadcrumb, rawNode)

    if (scalarValuesIssue) {
      return scalarValuesIssue
    }

    return {
      status: 'ready',
      items,
    }
  }

  if ('values' in items) {
    const scalarValuesIssue = validateSelectScalarValues(items.values, `${path}.values`, pageId, breadcrumb, rawNode)

    if (scalarValuesIssue) {
      return scalarValuesIssue
    }

    return {
      status: 'ready',
      items,
    }
  }

  const sourceResult = validateCollectionSource(items.source, `${path}.source`, pageId, { allowItemReference: true })

  if (sourceResult.status === 'error') {
    return enrichErrorResult(sourceResult, breadcrumb, rawNode)
  }

  if (items.itemType === 'scalar') {
    return {
      status: 'ready',
      items: {
        source: sourceResult.source,
        itemType: 'scalar',
      },
    }
  }

  if (!isValidCollectionProjectionPath(items.label)) {
    return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.label".`, breadcrumb, rawNode)
  }

  if (!isValidCollectionProjectionPath(items.value)) {
    return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.value".`, breadcrumb, rawNode)
  }

  return {
    status: 'ready',
    items: {
      source: sourceResult.source,
      itemType: 'object',
      label: items.label,
      value: items.value,
    },
  }
}

export function validateCollectionSource(
  rawSource: unknown,
  path: string,
  pageId: string,
  options: { allowItemReference?: boolean } = {},
): { status: 'ready'; source: string } | { status: 'error'; error: RuntimeConfigError } {
  if (!isNonEmptyString(rawSource)) {
    return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}".`)
  }

  if (!isValidCollectionSourceReference(rawSource, options)) {
    return invalidLayout(
      `Page "${pageId}" has an invalid layout at "${path}": collection sources must use queries.{queryName}.data, queries.{queryName}.data.* or item.*.`,
    )
  }

  return {
    status: 'ready',
    source: rawSource,
  }
}

export function validateChoiceFieldDefaultValue(
  defaultValue: unknown,
  path: string,
  pageId: string,
  isMultiple: boolean,
  breadcrumb: BreadcrumbSegment[] = [],
  rawNode?: Record<string, unknown>,
): { status: 'error'; error: RuntimeConfigError } | null {
  if (typeof defaultValue === 'undefined') {
    return null
  }

  if (Array.isArray(defaultValue)) {
    if (!isMultiple) {
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}": single choice fields do not accept array literal defaultValue.`, breadcrumb, rawNode)
    }

    return validateMultipleChoiceDefaultValue(defaultValue, path, pageId, breadcrumb, rawNode)
  }

  if (!isMultiple) {
    if (typeof defaultValue === 'string' && isTokensReference(defaultValue)) {
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}": tokens.* references are not supported in defaultValue.`, breadcrumb, rawNode)
    }

    return null
  }

  if (typeof defaultValue === 'string') {
    const parsedReference = parseRuntimeReference(defaultValue, { allowItemReference: true })

    if (parsedReference.kind === 'reference' && parsedReference.status === 'supported') {
      return null
    }
  }

  return enrichedInvalidLayout(
    `Page "${pageId}" has an invalid layout at "${path}": multiple choice fields only accept array literals or supported runtime references.`,
    breadcrumb,
    rawNode,
  )
}

function validateMultipleChoiceDefaultValue(
  defaultValue: unknown[],
  path: string,
  pageId: string,
  breadcrumb: BreadcrumbSegment[] = [],
  rawNode?: Record<string, unknown>,
): { status: 'error'; error: RuntimeConfigError } | null {
  let valueType: 'string' | 'number' | null = null

  for (let index = 0; index < defaultValue.length; index += 1) {
    const item = defaultValue[index]

    if (typeof item !== 'string' && typeof item !== 'number') {
      return enrichedInvalidLayout(
        `Page "${pageId}" has an invalid layout at "${path}[${index}]": multiple choice defaultValue arrays only accept string or number members.`,
        breadcrumb,
        rawNode,
      )
    }

    const currentType = typeof item as 'string' | 'number'

    if (valueType === null) {
      valueType = currentType
      continue
    }

    if (valueType !== currentType) {
      return enrichedInvalidLayout(
        `Page "${pageId}" has an invalid layout at "${path}": multiple choice defaultValue arrays must contain only strings or only numbers.`,
        breadcrumb,
        rawNode,
      )
    }
  }

  return null
}

export function validateFormSemantics(
  config: import('./runtime-config-types').RuntimeConfig,
): { status: 'error'; error: RuntimeConfigError } | null {
  const formIds = new Set<string>()
  const operationNames = new Set(Object.keys(config.api))
  const pageIds = new Set(config.pages.map((page) => page.id))
  const modalIds = collectModalIds(config.pages.flatMap((page) => page.layout))

  for (const page of config.pages) {
    const error = validateFormNodesInCollection(page.layout, 'layout', page.id, {
      inForm: false,
      pageId: page.id,
      formIds,
      currentFormId: null,
      fieldIds: null,
      operationNames,
      pageIds,
      modalIds,
      breadcrumb: [],
    })

    if (error) {
      return error
    }
  }

  return null
}

function collectModalIds(nodes: LayoutNodeCollection): ReadonlySet<string> {
  const ids = new Set<string>()

  for (const node of nodes) {
    if (node.type === 'modal' && node.id) {
      ids.add(node.id)
    }

    if ((node.type === 'container' || node.type === 'form' || node.type === 'modal') && node.children) {
      for (const id of collectModalIds(node.children)) {
        ids.add(id)
      }
    }

    if (node.type === 'repeater') {
      for (const id of collectModalIds(node.props.template)) {
        ids.add(id)
      }
    }
  }

  return ids
}

export function validateExecutionRequestParams(
  config: import('./runtime-config-types').RuntimeConfig,
): { status: 'error'; error: RuntimeConfigError } | null {
  for (const page of config.pages) {
    const error = validateExecutionRequestParamsInCollection(page.layout, 'layout', page.id, config.api, [])

    if (error) {
      return error
    }
  }

  return null
}

interface FormValidationContext {
  inForm: boolean
  pageId: string
  formIds: Set<string>
  currentFormId: string | null
  fieldIds: Set<string> | null
  operationNames: ReadonlySet<string>
  pageIds: ReadonlySet<string>
  modalIds: ReadonlySet<string>
  breadcrumb: BreadcrumbSegment[]
}

// Structural narrowing companion for FORM_ONLY_LEAF_NODE_TYPES: TypeScript does not
// narrow a discriminated union via ReadonlySet#has, so this type guard reuses the
// shared set for the runtime check while still giving downstream code a narrowed
// `node.props.fieldId` access.
function isFormOnlyLeafNode(node: LayoutNode): node is Extract<LayoutNode, { props: { fieldId: string } }> {
  return FORM_ONLY_LEAF_NODE_TYPES.has(node.type)
}

function validateFormNodesInCollection(
  nodes: LayoutNodeCollection,
  path: string,
  pageId: string,
  context: FormValidationContext,
): { status: 'error'; error: RuntimeConfigError } | null {
  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index]
    const nodePath = `${path}[${index}]`
    const nodeSegment = buildBreadcrumbSegmentFromNode(node, index)
    const nodeBreadcrumb = [...context.breadcrumb, nodeSegment]
    const fallbackError = validateFallbackCollections(node, nodePath, (fallbackNodes, fallbackPath) =>
      validateFormNodesInCollection(fallbackNodes, fallbackPath, pageId, { ...context, breadcrumb: nodeBreadcrumb }),
    )

    if (fallbackError) {
      return fallbackError
    }

    if (node.type === 'form') {
      if (context.formIds.has(node.id)) {
        return enrichedInvalidLayoutFromNode(`Page "${pageId}" has an invalid layout at "${nodePath}.id": duplicate form id "${node.id}".`, nodeBreadcrumb, node)
      }

      context.formIds.add(node.id)

      if (node.resetOnSuccess === true && node.submitAction === undefined) {
        return enrichedInvalidLayoutFromNode(`Page "${pageId}" has an invalid layout at "${nodePath}.resetOnSuccess": resetOnSuccess requires submitAction.`, nodeBreadcrumb, node)
      }

      if (node.submitAction?.type === 'executeOperation' && !context.operationNames.has(node.submitAction.operationName)) {
        return enrichedInvalidLayoutFromNode(
          `Page "${pageId}" has an invalid layout at "${nodePath}.submitAction.operationName": unknown operation "${node.submitAction.operationName}".`,
          nodeBreadcrumb,
          node,
        )
      }

      if (node.onSuccess) {
        const onSuccessError = validateOnSuccessActionTargets(
          node.onSuccess,
          `${nodePath}.submitAction.onSuccess`,
          pageId,
          context.pageIds,
          context.operationNames,
          context.modalIds,
        )

        if (onSuccessError) {
          return onSuccessError
        }
      }

      if (node.onError) {
        const onErrorError = validateOnErrorActionTargets(
          node.onError,
          `${nodePath}.submitAction.onError`,
          pageId,
          context.pageIds,
          context.operationNames,
          context.modalIds,
        )

        if (onErrorError) {
          return onErrorError
        }
      }

      const childrenError = validateFormChildren(node.children ?? [], `${nodePath}.children`, pageId, {
        ...context,
        inForm: true,
        currentFormId: node.id,
        fieldIds: new Set<string>(),
        breadcrumb: nodeBreadcrumb,
      })

      if (childrenError) {
        return childrenError
      }

      continue
    }

    if (node.type === 'container' && node.children) {
      const childrenError = validateFormNodesInCollection(node.children, `${nodePath}.children`, pageId, { ...context, breadcrumb: nodeBreadcrumb })

      if (childrenError) {
        return childrenError
      }

      continue
    }

    if (node.type === 'modal' && node.children) {
      const childrenError = validateFormNodesInCollection(node.children, `${nodePath}.children`, pageId, { ...context, breadcrumb: nodeBreadcrumb })

      if (childrenError) {
        return childrenError
      }

      continue
    }

    if (node.type === 'repeater') {
      const templateError = validateFormNodesInCollection(node.props.template, `${nodePath}.props.template`, pageId, { ...context, breadcrumb: nodeBreadcrumb })

      if (templateError) {
        return templateError
      }

      continue
    }

    if (node.type === 'tabs') {
      for (let itemIndex = 0; itemIndex < node.props.items.length; itemIndex += 1) {
        const item = node.props.items[itemIndex]
        if (item.children && item.children.length > 0) {
          const itemChildrenError = validateFormNodesInCollection(
            item.children,
            `${nodePath}.props.items[${itemIndex}].children`,
            pageId,
            { ...context, breadcrumb: nodeBreadcrumb },
          )

          if (itemChildrenError) {
            return itemChildrenError
          }
        }
      }

      continue
    }

    if (isFormOnlyLeafNode(node)) {
      if (!context.inForm || !context.currentFormId || !context.fieldIds) {
        return enrichedInvalidLayoutFromNode(`Page "${pageId}" has an invalid layout at "${nodePath}": ${node.type} nodes must be descendants of a form node.`, nodeBreadcrumb, node)
      }

      if (context.fieldIds.has(node.props.fieldId)) {
        return enrichedInvalidLayoutFromNode(
          `Page "${pageId}" has an invalid layout at "${nodePath}.props.fieldId": duplicate fieldId "${node.props.fieldId}" in form "${context.currentFormId}".`,
          nodeBreadcrumb,
          node,
        )
      }

      context.fieldIds.add(node.props.fieldId)

      continue
    }

    if (node.type === 'button' && buttonRequiresFormAncestor(node) && !context.inForm) {
      return enrichedInvalidLayoutFromNode(
        `Page "${pageId}" has an invalid layout at "${nodePath}": button nodes without an action must be descendants of a form node.`,
        nodeBreadcrumb,
        node,
      )
    }
  }

  return null
}

function validateFormChildren(
  nodes: LayoutNodeCollection,
  path: string,
  pageId: string,
  context: FormValidationContext,
): { status: 'error'; error: RuntimeConfigError } | null {
  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index]
    const nodePath = `${path}[${index}]`
    const nodeSegment = buildBreadcrumbSegmentFromNode(node, index)
    const nodeBreadcrumb = [...context.breadcrumb, nodeSegment]
    const fallbackError = validateFallbackCollections(node, nodePath, (fallbackNodes, fallbackPath) =>
      validateFormChildren(fallbackNodes, fallbackPath, pageId, { ...context, breadcrumb: nodeBreadcrumb }),
    )

    if (fallbackError) {
      return fallbackError
    }

    if (node.type === 'fileManager') {
      return enrichedInvalidLayoutFromNode(
        `Page "${pageId}" has an invalid layout at "${nodePath}": "fileManager" is not allowed inside a form.`,
        nodeBreadcrumb,
        node,
      )
    }

    if (!FORM_ALLOWED_DESCENDANT_TYPES.has(node.type)) {
      return enrichedInvalidLayoutFromNode(
        `Page "${pageId}" has an invalid layout at "${nodePath}": form nodes only accept input, textarea, select, radioGroup, checkboxGroup, fileInput, toggle, hidden, button, heading, paragraph, image, table, container, accordion, divider and tabs descendants.`,
        nodeBreadcrumb,
        node,
      )
    }

    if (node.type === 'container' && node.children) {
      const childrenError = validateFormChildren(node.children, `${nodePath}.children`, pageId, { ...context, breadcrumb: nodeBreadcrumb })

      if (childrenError) {
        return childrenError
      }

      continue
    }

    if (node.type === 'accordion' && node.children) {
      const childrenError = validateFormChildren(node.children, `${nodePath}.children`, pageId, { ...context, breadcrumb: nodeBreadcrumb })

      if (childrenError) {
        return childrenError
      }

      continue
    }

    if (node.type === 'tabs') {
      for (let itemIndex = 0; itemIndex < node.props.items.length; itemIndex += 1) {
        const item = node.props.items[itemIndex]

        if (item.children && item.children.length > 0) {
          const itemChildrenError = validateFormChildren(
            item.children,
            `${nodePath}.props.items[${itemIndex}].children`,
            pageId,
            { ...context, breadcrumb: nodeBreadcrumb },
          )

          if (itemChildrenError) {
            return itemChildrenError
          }
        }
      }

      continue
    }

    if (isFormOnlyLeafNode(node)) {
      if (!context.currentFormId || !context.fieldIds) {
        return enrichedInvalidLayoutFromNode(`Page "${pageId}" has an invalid layout at "${nodePath}": ${node.type} nodes must be descendants of a form node.`, nodeBreadcrumb, node)
      }

      if (context.fieldIds.has(node.props.fieldId)) {
        return enrichedInvalidLayoutFromNode(
          `Page "${pageId}" has an invalid layout at "${nodePath}.props.fieldId": duplicate fieldId "${node.props.fieldId}" in form "${context.currentFormId}".`,
          nodeBreadcrumb,
          node,
        )
      }

      context.fieldIds.add(node.props.fieldId)
    }
  }

  return null
}

function validateSelectScalarValues(
  items: Array<string | number>,
  path: string,
  pageId: string,
  breadcrumb: BreadcrumbSegment[] = [],
  rawNode?: Record<string, unknown>,
): { status: 'error'; error: RuntimeConfigError } | null {
  let valueType: 'string' | 'number' | null = null

  for (const item of items) {
    if (item === '') {
      continue
    }

    const currentType = typeof item as 'string' | 'number'

    if (valueType === null) {
      valueType = currentType
      continue
    }

    if (valueType !== currentType) {
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}": select item values must all be strings or all be numbers.`, breadcrumb, rawNode)
    }
  }

  return null
}

function validateExecutionRequestParamsInCollection(
  nodes: LayoutNodeCollection,
  path: string,
  pageId: string,
  api: import('./runtime-config-types').RuntimeApiConfig,
  breadcrumb: BreadcrumbSegment[],
): { status: 'error'; error: RuntimeConfigError } | null {
  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index]
    const nodePath = `${path}[${index}]`
    const nodeSegment = buildBreadcrumbSegmentFromNode(node, index)
    const nodeBreadcrumb = [...breadcrumb, nodeSegment]

    if (node.type === 'button' && node.props.action?.type === 'executeOperation') {
      const operation = api[node.props.action.operationName]

      if (operation?.method === 'GET' && node.props.action.body !== undefined) {
        return enrichedInvalidLayoutFromNode(`Page "${pageId}" has an invalid layout at "${nodePath}.props.action.body": GET operations do not support body.`, nodeBreadcrumb, node)
      }
    }

    if (node.type === 'button' && node.props.action?.type === 'executeOperations') {
      for (let entryIndex = 0; entryIndex < node.props.action.operations.length; entryIndex += 1) {
        const entry = node.props.action.operations[entryIndex]
        const operation = api[entry.operationName]

        if (operation?.method === 'GET' && entry.body !== undefined) {
          return enrichedInvalidLayoutFromNode(`Page "${pageId}" has an invalid layout at "${nodePath}.props.action.operations[${entryIndex}].body": GET operations do not support body.`, nodeBreadcrumb, node)
        }
      }
    }

    if (node.type === 'form' && node.submitAction?.type === 'executeOperation') {
      const operation = api[node.submitAction.operationName]

      if (operation?.method === 'GET' && node.submitAction.body !== undefined) {
        return enrichedInvalidLayoutFromNode(`Page "${pageId}" has an invalid layout at "${nodePath}.submitAction.body": GET operations do not support body.`, nodeBreadcrumb, node)
      }
    }

    if (node.type === 'form' && node.submitAction?.type === 'executeOperations') {
      for (let entryIndex = 0; entryIndex < node.submitAction.operations.length; entryIndex += 1) {
        const entry = node.submitAction.operations[entryIndex]
        const operation = api[entry.operationName]

        if (operation?.method === 'GET' && entry.body !== undefined) {
          return enrichedInvalidLayoutFromNode(`Page "${pageId}" has an invalid layout at "${nodePath}.submitAction.operations[${entryIndex}].body": GET operations do not support body.`, nodeBreadcrumb, node)
        }
      }
    }

    if (node.type === 'form' && node.onSuccess) {
      for (let actionIndex = 0; actionIndex < node.onSuccess.length; actionIndex += 1) {
        const action = node.onSuccess[actionIndex]
        const actionPath = `${nodePath}.submitAction.onSuccess[${actionIndex}]`

        if (action.type === 'executeOperation') {
          const operation = api[action.operationName]

          if (operation?.method === 'GET' && action.body !== undefined) {
            return enrichedInvalidLayoutFromNode(`Page "${pageId}" has an invalid layout at "${actionPath}.body": GET operations do not support body.`, nodeBreadcrumb, node)
          }
        }

        if (action.type === 'executeOperations') {
          for (let entryIndex = 0; entryIndex < action.operations.length; entryIndex += 1) {
            const entry = action.operations[entryIndex]
            const operation = api[entry.operationName]

            if (operation?.method === 'GET' && entry.body !== undefined) {
              return enrichedInvalidLayoutFromNode(`Page "${pageId}" has an invalid layout at "${actionPath}.operations[${entryIndex}].body": GET operations do not support body.`, nodeBreadcrumb, node)
            }
          }
        }
      }
    }

    if (node.type === 'form' && node.onError) {
      for (let actionIndex = 0; actionIndex < node.onError.length; actionIndex += 1) {
        const action = node.onError[actionIndex]
        const actionPath = `${nodePath}.submitAction.onError[${actionIndex}]`

        if (action.type === 'executeOperation') {
          const operation = api[action.operationName]

          if (operation?.method === 'GET' && action.body !== undefined) {
            return enrichedInvalidLayoutFromNode(`Page "${pageId}" has an invalid layout at "${actionPath}.body": GET operations do not support body.`, nodeBreadcrumb, node)
          }
        }

        if (action.type === 'executeOperations') {
          for (let entryIndex = 0; entryIndex < action.operations.length; entryIndex += 1) {
            const entry = action.operations[entryIndex]
            const operation = api[entry.operationName]

            if (operation?.method === 'GET' && entry.body !== undefined) {
              return enrichedInvalidLayoutFromNode(`Page "${pageId}" has an invalid layout at "${actionPath}.operations[${entryIndex}].body": GET operations do not support body.`, nodeBreadcrumb, node)
            }
          }
        }
      }
    }

    if ((node.type === 'container' || node.type === 'form' || node.type === 'modal') && node.children) {
      const childError = validateExecutionRequestParamsInCollection(node.children, `${nodePath}.children`, pageId, api, nodeBreadcrumb)

      if (childError) {
        return childError
      }
    }

    if (node.type === 'repeater') {
      const childError = validateExecutionRequestParamsInCollection(node.props.template, `${nodePath}.props.template`, pageId, api, nodeBreadcrumb)

      if (childError) {
        return childError
      }
    }

    if (node.type === 'tabs') {
      for (let itemIndex = 0; itemIndex < node.props.items.length; itemIndex += 1) {
        const item = node.props.items[itemIndex]

        if (item.children && item.children.length > 0) {
          const childError = validateExecutionRequestParamsInCollection(
            item.children,
            `${nodePath}.props.items[${itemIndex}].children`,
            pageId,
            api,
            nodeBreadcrumb,
          )

          if (childError) {
            return childError
          }
        }
      }
    }
  }

  return null
}

function validateOnSuccessActionTargets(
  actions: import('./runtime-config-types').FormOnSuccessAction[],
  basePath: string,
  pageId: string,
  pageIds: ReadonlySet<string>,
  operationNames: ReadonlySet<string>,
  modalIds: ReadonlySet<string>,
): { status: 'error'; error: RuntimeConfigError } | null {
  for (let index = 0; index < actions.length; index += 1) {
    const action = actions[index]
    const actionPath = `${basePath}[${index}]`

    if (action.type === 'navigateTo' && !pageIds.has(action.pageId)) {
      return invalidLayout(
        `Page "${pageId}" has an invalid layout at "${actionPath}.pageId": unknown page "${action.pageId}".`,
      )
    }

    if (action.type === 'executeOperation' && !operationNames.has(action.operationName)) {
      return invalidLayout(
        `Page "${pageId}" has an invalid layout at "${actionPath}.operationName": unknown operation "${action.operationName}".`,
      )
    }

    if (action.type === 'openModal' && !modalIds.has(action.modalId)) {
      return invalidLayout(
        `Page "${pageId}" has an invalid layout at "${actionPath}.modalId": unknown modal "${action.modalId}".`,
      )
    }

    if (action.type === 'closeModal' && !modalIds.has(action.modalId)) {
      return invalidLayout(
        `Page "${pageId}" has an invalid layout at "${actionPath}.modalId": unknown modal "${action.modalId}".`,
      )
    }
  }

  return null
}

function validateOnErrorActionTargets(
  actions: FormOnErrorAction[],
  basePath: string,
  pageId: string,
  pageIds: ReadonlySet<string>,
  operationNames: ReadonlySet<string>,
  modalIds: ReadonlySet<string>,
): { status: 'error'; error: RuntimeConfigError } | null {
  for (let index = 0; index < actions.length; index += 1) {
    const action = actions[index]
    const actionPath = `${basePath}[${index}]`

    if (action.type === 'navigateTo' && !pageIds.has(action.pageId)) {
      return invalidLayout(
        `Page "${pageId}" has an invalid layout at "${actionPath}.pageId": unknown page "${action.pageId}".`,
      )
    }

    if (action.type === 'executeOperation' && !operationNames.has(action.operationName)) {
      return invalidLayout(
        `Page "${pageId}" has an invalid layout at "${actionPath}.operationName": unknown operation "${action.operationName}".`,
      )
    }

    if (action.type === 'openModal' && !modalIds.has(action.modalId)) {
      return invalidLayout(
        `Page "${pageId}" has an invalid layout at "${actionPath}.modalId": unknown modal "${action.modalId}".`,
      )
    }

    if (action.type === 'closeModal' && !modalIds.has(action.modalId)) {
      return invalidLayout(
        `Page "${pageId}" has an invalid layout at "${actionPath}.modalId": unknown modal "${action.modalId}".`,
      )
    }
  }

  return null
}

function validateFallbackCollections<TError>(
  node: LayoutNode,
  nodePath: string,
  validateCollection: (nodes: LayoutNodeCollection, path: string) => TError | null,
) {
  if (!node.queryStateFeedback) {
    return null
  }

  for (const [stateName, rule] of Object.entries(node.queryStateFeedback.states ?? {})) {
    if (!rule || rule.mode !== 'fallback') {
      continue
    }

    const fallbackPath = `${nodePath}.queryStateFeedback.states.${stateName}.fallback`
    const error = validateCollection([...rule.fallback], fallbackPath)

    if (error) {
      return error
    }
  }

  return null
}

function isValidCollectionSourceReference(value: string, options: { allowItemReference?: boolean } = {}) {
  if (options.allowItemReference && (value === 'item' || value.startsWith('item.'))) {
    const parsedReference = parseRuntimeReference(value, { allowItemReference: true })
    return parsedReference.kind === 'reference' && parsedReference.status === 'supported'
  }

  return isValidQueryCollectionSource(value)
}

function isValidQueryCollectionSource(value: string) {
  const parts = value.split('.')

  if (parts.length < 3) {
    return false
  }

  const [namespace, queryName, property, ...nestedPath] = parts

  if (namespace !== 'queries' || property !== 'data' || !isValidCollectionPathSegment(queryName)) {
    return false
  }

  return nestedPath.every(isValidCollectionPathSegment)
}

function isValidCollectionItemPath(value: unknown): value is string {
  if (!isNonEmptyString(value)) {
    return false
  }

  return value.split('.').every(isValidCollectionPathSegment)
}

function isValidCollectionProjectionPath(value: unknown): value is string {
  return isNonEmptyString(value) && (hasRuntimeTemplateDelimiter(value) || isValidCollectionItemPath(value))
}

function isValidCollectionPathSegment(segment: string) {
  return segment.length > 0 && collectionPathSegmentPattern.test(segment)
}

function formatPathSegment(segment: PropertyKey): string {
  if (typeof segment === 'number') {
    return `[${segment}]`
  }

  return `.${String(segment)}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }

  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}
