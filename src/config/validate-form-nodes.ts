import type {
  CheckboxGroupLayoutNode,
  ExecuteOperationRuntimeUiAction,
  ExecuteOperationsRuntimeUiAction,
  FormLayoutNode,
  FormOnErrorAction,
  InputLayoutNode, LayoutNode,
  LayoutNodeCollection,
  LayoutNodeFeedbackFields,
  RadioGroupLayoutNode,
  RuntimeCollectionObjectItem,
  RuntimeConfigError,
  RuntimeFormFieldValidations,
  RuntimeFormValidationRuleName,
  RuntimeNumericValidationRule,
  RuntimeRequiredValidationRule,
  SelectLayoutNode,
  TextareaLayoutNode,
} from './runtime-config-types'
import {
  checkboxGroupNodeSchema,
  formNodeSchema,
  inputNodeSchema,
  radioGroupNodeSchema,
  selectItemSchema,
  selectNodeSchema,
  textareaNodeSchema,
} from './runtime-config-zod'
import { invalidLayout } from './runtime-config-validation-errors'
import { hasRuntimeTemplateDelimiter, parseRuntimeReference } from '../runtime/runtime-references/runtime-reference-parser'
import { isTokensReference } from './runtime-reference-namespace-guards'
import {
  validateLayoutCollection,
  validateQueryStateFeedback,
  validateVisibility,
  mapLeafNodeIssue,
  mapLayoutNodeIssue,
} from './validate-layout-nodes'
import { mapQueryStateFeedbackIssue, mapVisibilityIssue, validateFormSubmitAction } from './validate-actions-visibility'

const collectionPathSegmentPattern = /^[A-Za-z0-9_-]+$/
const supportedFormValidationRuleNames = new Set<RuntimeFormValidationRuleName>([
  'required',
  'minLength',
  'maxLength',
  'min',
  'max',
  'minSelections',
  'maxSelections',
])

type FormFieldValidationTarget =
  | { type: 'input'; inputType?: InputLayoutNode['props']['inputType'] }
  | { type: 'textarea' }
  | { type: 'select'; multiple: boolean }
  | { type: 'radioGroup' }
  | { type: 'checkboxGroup' }

export function validateFormNode(
  rawNode: Record<string, unknown>,
  path: string,
  pageId: string,
): { status: 'ready'; node: FormLayoutNode } | { status: 'error'; error: RuntimeConfigError } {
  const parseResult = formNodeSchema.safeParse(rawNode)

  if (!parseResult.success) {
    const issue = parseResult.error.issues[0]
    const feedbackIssue = mapQueryStateFeedbackIssue(pageId, path, issue)

    if (feedbackIssue) {
      return feedbackIssue
    }

    const visibilityIssue = mapVisibilityIssue(pageId, path, issue)

    if (visibilityIssue) {
      return visibilityIssue
    }

    const issuePath = issue?.path ?? []

    if (issuePath[0] === 'id') {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.id".`)
    }

    if (issuePath[0] === 'submitAction') {
      const field = issuePath[1]
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.submitAction${field ? `.${String(field)}` : ''}".`)
    }

    if (issuePath[0] === 'resetOnSuccess') {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.resetOnSuccess".`)
    }

    if (issuePath[0] === 'persistOnUnmount') {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.persistOnUnmount".`)
    }

    if (issuePath[0] === 'children') {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.children".`)
    }

    const layoutIssue = mapLayoutNodeIssue(pageId, path, issuePath)

    if (layoutIssue) {
      return layoutIssue
    }

    return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}".`)
  }

  const feedbackResult = validateQueryStateFeedback(
    parseResult.data.queryStateFeedback as LayoutNodeFeedbackFields['queryStateFeedback'],
    `${path}.queryStateFeedback`,
    pageId,
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
    return visibilityResult
  }

  let children: LayoutNodeCollection | undefined
  let submitAction: ExecuteOperationRuntimeUiAction | ExecuteOperationsRuntimeUiAction | undefined
  let onSuccess: import('./runtime-config-types').FormOnSuccessAction[] | undefined
  let onError: FormOnErrorAction[] | undefined

  if (parseResult.data.submitAction !== undefined) {
    const submitActionResult = validateFormSubmitAction(parseResult.data.submitAction, `${path}.submitAction`, pageId)

    if (submitActionResult.status === 'error') {
      return submitActionResult
    }

    submitAction = submitActionResult.action
    onSuccess = submitActionResult.onSuccess
    onError = submitActionResult.onError
  }

  if (parseResult.data.children !== undefined) {
    const childrenResult = validateLayoutCollection(parseResult.data.children, `${path}.children`, pageId)

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
): { status: 'ready'; node: InputLayoutNode } | { status: 'error'; error: RuntimeConfigError } {
  const parseResult = inputNodeSchema.safeParse(rawNode)

  if (!parseResult.success) {
    const feedbackIssue = mapQueryStateFeedbackIssue(pageId, path, parseResult.error.issues[0])

    if (feedbackIssue) {
      return feedbackIssue
    }

    const visibilityIssue = mapVisibilityIssue(pageId, path, parseResult.error.issues[0])

    if (visibilityIssue) {
      return visibilityIssue
    }

    return mapLeafNodeIssue(pageId, path, parseResult.error.issues[0]?.path ?? [])
  }

  const feedbackResult = validateQueryStateFeedback(
    parseResult.data.queryStateFeedback as LayoutNodeFeedbackFields['queryStateFeedback'],
    `${path}.queryStateFeedback`,
    pageId,
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
    return visibilityResult
  }

  if (Array.isArray(parseResult.data.props.defaultValue)) {
    return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.defaultValue": input fields do not accept array literal defaultValue.`)
  }

  if (typeof parseResult.data.props.defaultValue === 'string' && isTokensReference(parseResult.data.props.defaultValue)) {
    return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.defaultValue": tokens.* references are not supported in defaultValue.`)
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
): { status: 'ready'; node: TextareaLayoutNode } | { status: 'error'; error: RuntimeConfigError } {
  const parseResult = textareaNodeSchema.safeParse(rawNode)

  if (!parseResult.success) {
    const feedbackIssue = mapQueryStateFeedbackIssue(pageId, path, parseResult.error.issues[0])

    if (feedbackIssue) {
      return feedbackIssue
    }

    const visibilityIssue = mapVisibilityIssue(pageId, path, parseResult.error.issues[0])

    if (visibilityIssue) {
      return visibilityIssue
    }

    return mapLeafNodeIssue(pageId, path, parseResult.error.issues[0]?.path ?? [])
  }

  const feedbackResult = validateQueryStateFeedback(
    parseResult.data.queryStateFeedback as LayoutNodeFeedbackFields['queryStateFeedback'],
    `${path}.queryStateFeedback`,
    pageId,
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
    return visibilityResult
  }

  if (Array.isArray(parseResult.data.props.defaultValue)) {
    return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.defaultValue": textarea fields do not accept array literal defaultValue.`)
  }

  if (typeof parseResult.data.props.defaultValue === 'string' && isTokensReference(parseResult.data.props.defaultValue)) {
    return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.defaultValue": tokens.* references are not supported in defaultValue.`)
  }

  const validationsResult = validateFormFieldValidations(rawNode.props, parseResult.data.props.validations, { type: 'textarea' }, path, pageId)

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
): { status: 'ready'; node: SelectLayoutNode } | { status: 'error'; error: RuntimeConfigError } {
  const parseResult = selectNodeSchema.safeParse(rawNode)

  if (!parseResult.success) {
    const feedbackIssue = mapQueryStateFeedbackIssue(pageId, path, parseResult.error.issues[0])

    if (feedbackIssue) {
      return feedbackIssue
    }

    const visibilityIssue = mapVisibilityIssue(pageId, path, parseResult.error.issues[0])

    if (visibilityIssue) {
      return visibilityIssue
    }

    return mapLeafNodeIssue(pageId, path, parseResult.error.issues[0]?.path ?? [])
  }

  const feedbackResult = validateQueryStateFeedback(
    parseResult.data.queryStateFeedback as LayoutNodeFeedbackFields['queryStateFeedback'],
    `${path}.queryStateFeedback`,
    pageId,
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
    return visibilityResult
  }

  const itemsResult = validateSelectItemsContract(parseResult.data.props.items, `${path}.props.items`, pageId)

  if (itemsResult.status === 'error') {
    return itemsResult
  }

  const defaultValueIssue = validateChoiceFieldDefaultValue(
    parseResult.data.props.defaultValue,
    `${path}.props.defaultValue`,
    pageId,
    parseResult.data.props.multiple === true,
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
): { status: 'ready'; node: RadioGroupLayoutNode } | { status: 'error'; error: RuntimeConfigError } {
  const parseResult = radioGroupNodeSchema.safeParse(rawNode)

  if (!parseResult.success) {
    const feedbackIssue = mapQueryStateFeedbackIssue(pageId, path, parseResult.error.issues[0])

    if (feedbackIssue) {
      return feedbackIssue
    }

    const visibilityIssue = mapVisibilityIssue(pageId, path, parseResult.error.issues[0])

    if (visibilityIssue) {
      return visibilityIssue
    }

    return mapLeafNodeIssue(pageId, path, parseResult.error.issues[0]?.path ?? [])
  }

  const feedbackResult = validateQueryStateFeedback(
    parseResult.data.queryStateFeedback as LayoutNodeFeedbackFields['queryStateFeedback'],
    `${path}.queryStateFeedback`,
    pageId,
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
    return visibilityResult
  }

  const itemsResult = validateSelectItemsContract(parseResult.data.props.items, `${path}.props.items`, pageId)

  if (itemsResult.status === 'error') {
    return itemsResult
  }

  const defaultValueIssue = validateChoiceFieldDefaultValue(
    parseResult.data.props.defaultValue,
    `${path}.props.defaultValue`,
    pageId,
    false,
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
): { status: 'ready'; node: CheckboxGroupLayoutNode } | { status: 'error'; error: RuntimeConfigError } {
  const parseResult = checkboxGroupNodeSchema.safeParse(rawNode)

  if (!parseResult.success) {
    const feedbackIssue = mapQueryStateFeedbackIssue(pageId, path, parseResult.error.issues[0])

    if (feedbackIssue) {
      return feedbackIssue
    }

    const visibilityIssue = mapVisibilityIssue(pageId, path, parseResult.error.issues[0])

    if (visibilityIssue) {
      return visibilityIssue
    }

    return mapLeafNodeIssue(pageId, path, parseResult.error.issues[0]?.path ?? [])
  }

  const feedbackResult = validateQueryStateFeedback(
    parseResult.data.queryStateFeedback as LayoutNodeFeedbackFields['queryStateFeedback'],
    `${path}.queryStateFeedback`,
    pageId,
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
    return visibilityResult
  }

  const itemsResult = validateSelectItemsContract(parseResult.data.props.items, `${path}.props.items`, pageId)

  if (itemsResult.status === 'error') {
    return itemsResult
  }

  const defaultValueIssue = validateChoiceFieldDefaultValue(
    parseResult.data.props.defaultValue,
    `${path}.props.defaultValue`,
    pageId,
    true,
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

export function validateFormFieldValidations(
  rawProps: unknown,
  rawValidations: unknown,
  target: FormFieldValidationTarget,
  path: string,
  pageId: string,
): { status: 'ready'; validations: RuntimeFormFieldValidations | undefined } | { status: 'error'; error: RuntimeConfigError } {
  if (isRecord(rawProps) && Object.hasOwn(rawProps, 'required')) {
    return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.required": use props.validations.required instead.`)
  }

  if (typeof rawValidations === 'undefined') {
    return {
      status: 'ready',
      validations: undefined,
    }
  }

  if (!isRecord(rawValidations)) {
    return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.validations".`)
  }

  const validations: RuntimeFormFieldValidations = {}

  for (const [ruleName, rawRule] of Object.entries(rawValidations)) {
    if (!supportedFormValidationRuleNames.has(ruleName as RuntimeFormValidationRuleName)) {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.validations.${ruleName}".`)
    }

    const validationResult =
      ruleName === 'required'
        ? validateRequiredRule(rawRule, `${path}.props.validations.${ruleName}`, pageId)
        : validateNumericRule(rawRule, `${path}.props.validations.${ruleName}`, pageId)

    if (validationResult.status === 'error') {
      return validationResult
    }

    const compatibilityError = validateValidationCompatibility(ruleName as RuntimeFormValidationRuleName, validationResult.rule, target, path, pageId)

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
    }
  }

  const rangesError = validateValidationRanges(validations, `${path}.props.validations`, pageId)

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
): { status: 'ready'; rule: RuntimeRequiredValidationRule } | { status: 'error'; error: RuntimeConfigError } {
  if (rawRule === true) {
    return {
      status: 'ready',
      rule: { value: true },
    }
  }

  if (!isRecord(rawRule)) {
    return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}".`)
  }

  if (rawRule.value !== true) {
    return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.value".`)
  }

  if (typeof rawRule.message !== 'undefined' && typeof rawRule.message !== 'string') {
    return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.message".`)
  }

  return {
    status: 'ready',
    rule: typeof rawRule.message === 'string' ? { value: true, message: rawRule.message } : { value: true },
  }
}

function validateNumericRule(
  rawRule: unknown,
  path: string,
  pageId: string,
): { status: 'ready'; rule: RuntimeNumericValidationRule } | { status: 'error'; error: RuntimeConfigError } {
  if (typeof rawRule === 'number') {
    if (!Number.isFinite(rawRule) || rawRule < 0) {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}".`)
    }

    return {
      status: 'ready',
      rule: { value: rawRule },
    }
  }

  if (!isRecord(rawRule)) {
    return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}".`)
  }

  if (typeof rawRule.value !== 'number' || !Number.isFinite(rawRule.value) || rawRule.value < 0) {
    return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.value".`)
  }

  if (typeof rawRule.message !== 'undefined' && typeof rawRule.message !== 'string') {
    return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.message".`)
  }

  return {
    status: 'ready',
    rule: typeof rawRule.message === 'string' ? { value: rawRule.value, message: rawRule.message } : { value: rawRule.value },
  }
}

function validateValidationCompatibility(
  ruleName: RuntimeFormValidationRuleName,
  rule: RuntimeRequiredValidationRule | RuntimeNumericValidationRule,
  target: FormFieldValidationTarget,
  path: string,
  pageId: string,
) {
  if (ruleName === 'required') {
    return null
  }

  if ((ruleName === 'minLength' || ruleName === 'maxLength') && supportsTextLengthValidations(target)) {
    if (!Number.isInteger((rule as RuntimeNumericValidationRule).value)) {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.validations.${ruleName}.value".`)
    }

    return null
  }

  if ((ruleName === 'min' || ruleName === 'max') && target.type === 'input' && target.inputType === 'number') {
    return null
  }

  if ((ruleName === 'minSelections' || ruleName === 'maxSelections') && supportsSelectionCardinalityValidations(target)) {
    if (!Number.isInteger((rule as RuntimeNumericValidationRule).value)) {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.validations.${ruleName}.value".`)
    }

    return null
  }

  return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.validations.${ruleName}".`)
}

function validateValidationRanges(
  validations: RuntimeFormFieldValidations,
  path: string,
  pageId: string,
) {
  if (
    validations.minLength &&
    validations.maxLength &&
    validations.minLength.value > validations.maxLength.value
  ) {
    return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}": minLength cannot be greater than maxLength.`)
  }

  if (validations.min && validations.max && validations.min.value > validations.max.value) {
    return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}": min cannot be greater than max.`)
  }

  if (
    validations.minSelections &&
    validations.maxSelections &&
    validations.minSelections.value > validations.maxSelections.value
  ) {
    return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}": minSelections cannot be greater than maxSelections.`)
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
    target.inputType !== 'datetime-local'
  )
}

function supportsSelectionCardinalityValidations(target: FormFieldValidationTarget) {
  return target.type === 'checkboxGroup' || (target.type === 'select' && target.multiple)
}

export function validateSelectItemsContract(
  rawItems: unknown,
  path: string,
  pageId: string,
): { status: 'ready'; items: SelectLayoutNode['props']['items'] } | { status: 'error'; error: RuntimeConfigError } {
  if (Array.isArray(rawItems)) {
    const items: SelectLayoutNode['props']['items'] = []

    for (let index = 0; index < rawItems.length; index += 1) {
      const itemResult = selectItemSchema.safeParse(rawItems[index])

      if (!itemResult.success) {
        const issuePath = itemResult.error.issues[0]?.path ?? []
        const formattedPath = issuePath.map(formatPathSegment).join('')
        return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}[${index}]${formattedPath}".`)
      }

      items.push(itemResult.data)
    }

    const scalarValuesIssue = validateSelectScalarValues(
      (items as Array<{ label: string; value: string | number }>).map((item) => item.value),
      path,
      pageId,
    )

    if (scalarValuesIssue) {
      return scalarValuesIssue
    }

    return {
      status: 'ready',
      items,
    }
  }

  if (!isRecord(rawItems)) {
    return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}".`)
  }

  const hasSource = 'source' in rawItems
  const hasValues = 'values' in rawItems

  if (hasSource && hasValues) {
    return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}".`)
  }

  if (hasSource) {
    const sourceResult = validateCollectionSource(rawItems.source, `${path}.source`, pageId, { allowItemReference: true })

    if (sourceResult.status === 'error') {
      return sourceResult
    }

    if (rawItems.itemType !== undefined && rawItems.itemType !== 'scalar') {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.itemType".`)
    }

    if ((rawItems.label === undefined) !== (rawItems.value === undefined)) {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}".`)
    }

    if (rawItems.label === undefined && rawItems.value === undefined) {
      if (rawItems.itemType !== 'scalar') {
        return invalidLayout(
          `Page "${pageId}" has an invalid layout at "${path}": dynamic scalar collections must declare itemType: "scalar", and dynamic object collections must declare label and value.`,
        )
      }

      return {
        status: 'ready',
        items: {
          source: sourceResult.source,
          itemType: 'scalar',
        },
      }
    }

    if (!isValidCollectionProjectionPath(rawItems.label)) {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.label".`)
    }

    if (!isValidCollectionProjectionPath(rawItems.value)) {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.value".`)
    }

    if (rawItems.itemType !== undefined) {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}".`)
    }

    return {
      status: 'ready',
      items: {
        source: sourceResult.source,
        label: rawItems.label,
        value: rawItems.value,
      },
    }
  }

  if (!hasValues) {
    return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}".`)
  }

  if (!Array.isArray(rawItems.values)) {
    return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.values".`)
  }

  const values = rawItems.values

  if (values.every((value) => typeof value === 'string' || typeof value === 'number')) {
    const scalarValuesIssue = validateSelectScalarValues(values, `${path}.values`, pageId)

    if (scalarValuesIssue) {
      return scalarValuesIssue
    }

    return {
      status: 'ready',
      items: {
        values,
      },
    }
  }

  if (values.every((value) => isRecord(value))) {
    if (!isValidCollectionProjectionPath(rawItems.label)) {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.label".`)
    }

    if (!isValidCollectionProjectionPath(rawItems.value)) {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.value".`)
    }

    const projectedValueTypeIssue = hasRuntimeTemplateDelimiter(rawItems.value)
      ? null
      : validateManualSelectObjectValueTypes(values as RuntimeCollectionObjectItem[], rawItems.value, `${path}.values`, pageId)

    if (projectedValueTypeIssue) {
      return projectedValueTypeIssue
    }

    return {
      status: 'ready',
      items: {
        values: values as RuntimeCollectionObjectItem[],
        label: rawItems.label,
        value: rawItems.value,
      },
    }
  }

  const invalidIndex = values.findIndex((value) => !isRecord(value) && typeof value !== 'string' && typeof value !== 'number')
  return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.values[${Math.max(invalidIndex, 0)}]".`)
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
): { status: 'error'; error: RuntimeConfigError } | null {
  if (typeof defaultValue === 'undefined') {
    return null
  }

  if (Array.isArray(defaultValue)) {
    if (!isMultiple) {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}": single choice fields do not accept array literal defaultValue.`)
    }

    return validateMultipleChoiceDefaultValue(defaultValue, path, pageId)
  }

  if (!isMultiple) {
    if (typeof defaultValue === 'string' && isTokensReference(defaultValue)) {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}": tokens.* references are not supported in defaultValue.`)
    }

    return null
  }

  if (typeof defaultValue === 'string') {
    const parsedReference = parseRuntimeReference(defaultValue, { allowItemReference: true })

    if (parsedReference.kind === 'reference' && parsedReference.status === 'supported') {
      return null
    }
  }

  return invalidLayout(
    `Page "${pageId}" has an invalid layout at "${path}": multiple choice fields only accept array literals or supported runtime references.`,
  )
}

function validateMultipleChoiceDefaultValue(
  defaultValue: unknown[],
  path: string,
  pageId: string,
): { status: 'error'; error: RuntimeConfigError } | null {
  let valueType: 'string' | 'number' | null = null

  for (let index = 0; index < defaultValue.length; index += 1) {
    const item = defaultValue[index]

    if (typeof item !== 'string' && typeof item !== 'number') {
      return invalidLayout(
        `Page "${pageId}" has an invalid layout at "${path}[${index}]": multiple choice defaultValue arrays only accept string or number members.`,
      )
    }

    const currentType = typeof item as 'string' | 'number'

    if (valueType === null) {
      valueType = currentType
      continue
    }

    if (valueType !== currentType) {
      return invalidLayout(
        `Page "${pageId}" has an invalid layout at "${path}": multiple choice defaultValue arrays must contain only strings or only numbers.`,
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
    const error = validateExecutionRequestParamsInCollection(page.layout, 'layout', page.id, config.api)

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
    const fallbackError = validateFallbackCollections(node, nodePath, (fallbackNodes, fallbackPath) =>
      validateFormNodesInCollection(fallbackNodes, fallbackPath, pageId, context),
    )

    if (fallbackError) {
      return fallbackError
    }

    if (node.type === 'form') {
      if (context.formIds.has(node.id)) {
        return invalidLayout(`Page "${pageId}" has an invalid layout at "${nodePath}.id": duplicate form id "${node.id}".`)
      }

      context.formIds.add(node.id)

      if (node.resetOnSuccess === true && node.submitAction === undefined) {
        return invalidLayout(`Page "${pageId}" has an invalid layout at "${nodePath}.resetOnSuccess": resetOnSuccess requires submitAction.`)
      }

      if (node.submitAction?.type === 'executeOperation' && !context.operationNames.has(node.submitAction.operationName)) {
        return invalidLayout(
          `Page "${pageId}" has an invalid layout at "${nodePath}.submitAction.operationName": unknown operation "${node.submitAction.operationName}".`,
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
      })

      if (childrenError) {
        return childrenError
      }

      continue
    }

    if (node.type === 'container' && node.children) {
      const childrenError = validateFormNodesInCollection(node.children, `${nodePath}.children`, pageId, context)

      if (childrenError) {
        return childrenError
      }

      continue
    }

    if (node.type === 'modal' && node.children) {
      const childrenError = validateFormNodesInCollection(node.children, `${nodePath}.children`, pageId, context)

      if (childrenError) {
        return childrenError
      }

      continue
    }

    if (node.type === 'repeater') {
      const templateError = validateFormNodesInCollection(node.props.template, `${nodePath}.props.template`, pageId, context)

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
            context,
          )

          if (itemChildrenError) {
            return itemChildrenError
          }
        }
      }

      continue
    }

    if (
      node.type === 'input' ||
      node.type === 'textarea' ||
      node.type === 'select' ||
      node.type === 'radioGroup' ||
      node.type === 'checkboxGroup' ||
      node.type === 'fileInput'
    ) {
      if (!context.inForm || !context.currentFormId || !context.fieldIds) {
        return invalidLayout(`Page "${pageId}" has an invalid layout at "${nodePath}": ${node.type} nodes must be descendants of a form node.`)
      }

      if (context.fieldIds.has(node.props.fieldId)) {
        return invalidLayout(
          `Page "${pageId}" has an invalid layout at "${nodePath}.props.fieldId": duplicate fieldId "${node.props.fieldId}" in form "${context.currentFormId}".`,
        )
      }

      context.fieldIds.add(node.props.fieldId)

      continue
    }

    if (node.type === 'button' && node.props.action === undefined && !context.inForm) {
      return invalidLayout(
        `Page "${pageId}" has an invalid layout at "${nodePath}": button nodes without an action must be descendants of a form node.`,
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
    const fallbackError = validateFallbackCollections(node, nodePath, (fallbackNodes, fallbackPath) =>
      validateFormChildren(fallbackNodes, fallbackPath, pageId, context),
    )

    if (fallbackError) {
      return fallbackError
    }

    if (node.type === 'fileManager') {
      return invalidLayout(
        `Page "${pageId}" has an invalid layout at "${nodePath}": "fileManager" is not allowed inside a form.`,
      )
    }

    if (
      node.type !== 'input' &&
      node.type !== 'textarea' &&
      node.type !== 'select' &&
      node.type !== 'radioGroup' &&
      node.type !== 'checkboxGroup' &&
      node.type !== 'fileInput' &&
      node.type !== 'button' &&
      node.type !== 'heading' &&
      node.type !== 'paragraph' &&
      node.type !== 'image' &&
      node.type !== 'table' &&
      node.type !== 'container' &&
      node.type !== 'accordion' &&
      node.type !== 'divider' &&
      node.type !== 'tabs'
    ) {
      return invalidLayout(
        `Page "${pageId}" has an invalid layout at "${nodePath}": form nodes only accept input, textarea, select, radioGroup, checkboxGroup, fileInput, button, heading, paragraph, image, table, container, accordion, divider and tabs descendants.`,
      )
    }

    if (node.type === 'container' && node.children) {
      const childrenError = validateFormChildren(node.children, `${nodePath}.children`, pageId, context)

      if (childrenError) {
        return childrenError
      }

      continue
    }

    if (node.type === 'accordion' && node.children) {
      const childrenError = validateFormChildren(node.children, `${nodePath}.children`, pageId, context)

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
            context,
          )

          if (itemChildrenError) {
            return itemChildrenError
          }
        }
      }

      continue
    }

    if (
      node.type === 'input' ||
      node.type === 'textarea' ||
      node.type === 'select' ||
      node.type === 'radioGroup' ||
      node.type === 'checkboxGroup' ||
      node.type === 'fileInput'
    ) {
      if (!context.currentFormId || !context.fieldIds) {
        return invalidLayout(`Page "${pageId}" has an invalid layout at "${nodePath}": ${node.type} nodes must be descendants of a form node.`)
      }

      if (context.fieldIds.has(node.props.fieldId)) {
        return invalidLayout(
          `Page "${pageId}" has an invalid layout at "${nodePath}.props.fieldId": duplicate fieldId "${node.props.fieldId}" in form "${context.currentFormId}".`,
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
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}": select item values must all be strings or all be numbers.`)
    }
  }

  return null
}

function validateManualSelectObjectValueTypes(
  items: RuntimeCollectionObjectItem[],
  valuePath: string,
  path: string,
  pageId: string,
): { status: 'error'; error: RuntimeConfigError } | null {
  let valueType: 'string' | 'number' | null = null

  for (const item of items) {
    const resolvedValue = resolveCollectionItemPathValue(item, valuePath)

    if (!resolvedValue.found || (typeof resolvedValue.value !== 'string' && typeof resolvedValue.value !== 'number')) {
      continue
    }

    if (resolvedValue.value === '') {
      continue
    }

    const currentType = typeof resolvedValue.value as 'string' | 'number'

    if (valueType === null) {
      valueType = currentType
      continue
    }

    if (valueType !== currentType) {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}": select item values must all be strings or all be numbers.`)
    }
  }

  return null
}

function validateExecutionRequestParamsInCollection(
  nodes: LayoutNodeCollection,
  path: string,
  pageId: string,
  api: import('./runtime-config-types').RuntimeApiConfig,
): { status: 'error'; error: RuntimeConfigError } | null {
  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index]
    const nodePath = `${path}[${index}]`

    if (node.type === 'button' && node.props.action?.type === 'executeOperation') {
      const operation = api[node.props.action.operationName]

      if (operation?.method === 'GET' && node.props.action.body !== undefined) {
        return invalidLayout(`Page "${pageId}" has an invalid layout at "${nodePath}.props.action.body": GET operations do not support body.`)
      }
    }

    if (node.type === 'button' && node.props.action?.type === 'executeOperations') {
      for (let entryIndex = 0; entryIndex < node.props.action.operations.length; entryIndex += 1) {
        const entry = node.props.action.operations[entryIndex]
        const operation = api[entry.operationName]

        if (operation?.method === 'GET' && entry.body !== undefined) {
          return invalidLayout(`Page "${pageId}" has an invalid layout at "${nodePath}.props.action.operations[${entryIndex}].body": GET operations do not support body.`)
        }
      }
    }

    if (node.type === 'form' && node.submitAction?.type === 'executeOperation') {
      const operation = api[node.submitAction.operationName]

      if (operation?.method === 'GET' && node.submitAction.body !== undefined) {
        return invalidLayout(`Page "${pageId}" has an invalid layout at "${nodePath}.submitAction.body": GET operations do not support body.`)
      }
    }

    if (node.type === 'form' && node.submitAction?.type === 'executeOperations') {
      for (let entryIndex = 0; entryIndex < node.submitAction.operations.length; entryIndex += 1) {
        const entry = node.submitAction.operations[entryIndex]
        const operation = api[entry.operationName]

        if (operation?.method === 'GET' && entry.body !== undefined) {
          return invalidLayout(`Page "${pageId}" has an invalid layout at "${nodePath}.submitAction.operations[${entryIndex}].body": GET operations do not support body.`)
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
            return invalidLayout(`Page "${pageId}" has an invalid layout at "${actionPath}.body": GET operations do not support body.`)
          }
        }

        if (action.type === 'executeOperations') {
          for (let entryIndex = 0; entryIndex < action.operations.length; entryIndex += 1) {
            const entry = action.operations[entryIndex]
            const operation = api[entry.operationName]

            if (operation?.method === 'GET' && entry.body !== undefined) {
              return invalidLayout(`Page "${pageId}" has an invalid layout at "${actionPath}.operations[${entryIndex}].body": GET operations do not support body.`)
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
            return invalidLayout(`Page "${pageId}" has an invalid layout at "${actionPath}.body": GET operations do not support body.`)
          }
        }

        if (action.type === 'executeOperations') {
          for (let entryIndex = 0; entryIndex < action.operations.length; entryIndex += 1) {
            const entry = action.operations[entryIndex]
            const operation = api[entry.operationName]

            if (operation?.method === 'GET' && entry.body !== undefined) {
              return invalidLayout(`Page "${pageId}" has an invalid layout at "${actionPath}.operations[${entryIndex}].body": GET operations do not support body.`)
            }
          }
        }
      }
    }

    if ((node.type === 'container' || node.type === 'form' || node.type === 'modal') && node.children) {
      const childError = validateExecutionRequestParamsInCollection(node.children, `${nodePath}.children`, pageId, api)

      if (childError) {
        return childError
      }
    }

    if (node.type === 'repeater') {
      const childError = validateExecutionRequestParamsInCollection(node.props.template, `${nodePath}.props.template`, pageId, api)

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

function resolveCollectionItemPathValue(item: unknown, path: string) {
  const pathSegments = path.split('.')
  let currentValue: unknown = item

  for (const segment of pathSegments) {
    if (Array.isArray(currentValue)) {
      if (!/^(0|[1-9]\d*)$/.test(segment)) {
        return {
          found: false,
        } as const
      }

      currentValue = currentValue[Number(segment)]

      if (typeof currentValue === 'undefined') {
        return {
          found: false,
        } as const
      }

      continue
    }

    if (!isRecord(currentValue) || !Object.hasOwn(currentValue, segment)) {
      return {
        found: false,
      } as const
    }

    currentValue = currentValue[segment]
  }

  return {
    found: true,
    value: currentValue,
  } as const
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
