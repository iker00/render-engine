import type {
  InputLayoutNode,
  RuntimeBooleanFlagValidationRule,
  RuntimeConfigError,
  RuntimeFormFieldValidations,
  RuntimeFormValidationRuleName,
  RuntimeNumericValidationRule,
  RuntimePatternValidationRule,
  RuntimeRequiredValidationRule,
} from './runtime-config-types'
import type { BreadcrumbSegment } from './validation-breadcrumb'
import { enrichedInvalidLayout, enrichErrorResult } from './validation-breadcrumb'
import { isRecord } from './validate-node-shared-helpers'
import { validateWhenCondition } from './validate-actions-visibility'

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
