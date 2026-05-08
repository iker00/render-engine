import type {
  CheckboxGroupLayoutNode,
  InputLayoutNode,
  LayoutNode,
  RadioGroupLayoutNode,
  RuntimeFormFieldValidations,
  SelectLayoutNode,
} from '../config/runtime-config'
import { isLayoutNodeVisible } from './runtime-layout-visibility'
import { normalizeChoiceFieldValue } from './runtime-collection-sources'
import { selectFormFieldState } from './runtime-state/runtime-state-selectors'
import type { RuntimeState } from './runtime-state/runtime-state-types'

export interface ResolvedFormFieldDefinition {
  fieldId: string
  type: 'input' | 'textarea' | 'select' | 'radioGroup' | 'checkboxGroup'
  validations?: RuntimeFormFieldValidations
  queryStateFeedback?: LayoutNode['queryStateFeedback']
  visibility?: LayoutNode['visibility']
  items?: SelectLayoutNode['props']['items'] | RadioGroupLayoutNode['props']['items'] | CheckboxGroupLayoutNode['props']['items']
  multiple: boolean
  defaultValue: unknown
  inputType?: InputLayoutNode['props']['inputType']
}

export function validateFormFields({
  formId,
  fieldDefinitions,
  state,
}: {
  formId: string
  fieldDefinitions: ResolvedFormFieldDefinition[]
  state: RuntimeState
}) {
  const errorsByFieldId: Record<string, string | null> = {}
  let isValid = true

  for (const fieldDefinition of fieldDefinitions) {
    const fieldState = selectFormFieldState(state, formId, fieldDefinition.fieldId)
    const currentValue = resolveFormFieldValue(fieldDefinition, formId, state)
    const isVisible = isLayoutNodeVisible(fieldDefinition, state)

    if (!isVisible) {
      errorsByFieldId[fieldDefinition.fieldId] = fieldState?.error ?? null
      continue
    }

    const error = getFirstVisibleValidationError(fieldDefinition, currentValue)
    errorsByFieldId[fieldDefinition.fieldId] = error

    if (error !== null) {
      isValid = false
    }
  }

  return {
    isValid,
    errorsByFieldId,
  }
}

export function resolveFormFieldValue(fieldDefinition: ResolvedFormFieldDefinition, formId: string, state: RuntimeState) {
  const fieldState = selectFormFieldState(state, formId, fieldDefinition.fieldId)

  if (fieldDefinition.items !== undefined) {
    return normalizeChoiceFieldValue(fieldDefinition.items, state, fieldState?.value ?? fieldDefinition.defaultValue, {
      multiple: fieldDefinition.multiple,
      surface: getChoiceFieldSurface(fieldDefinition.type),
    })
  }

  return fieldState?.value ?? fieldDefinition.defaultValue
}

export function getFirstVisibleValidationError(fieldDefinition: ResolvedFormFieldDefinition, value: unknown): string | null {
  for (const [ruleName, rule] of Object.entries(fieldDefinition.validations ?? {})) {
    switch (ruleName) {
      case 'required':
        if (!passesRequiredValidation(fieldDefinition, value)) {
          return 'Required'
        }
        break
      case 'minLength':
        if (typeof value === 'string' && value.length < rule.value) {
          return `Must be at least ${rule.value} characters.`
        }
        break
      case 'maxLength':
        if (typeof value === 'string' && value.length > rule.value) {
          return `Must be at most ${rule.value} characters.`
        }
        break
      case 'min': {
        const numericValue = parseNumericFieldValue(value)
        if (numericValue !== null && numericValue < rule.value) {
          return `Must be at least ${formatNumericRuleValue(rule.value)}.`
        }
        break
      }
      case 'max': {
        const numericValue = parseNumericFieldValue(value)
        if (numericValue !== null && numericValue > rule.value) {
          return `Must be at most ${formatNumericRuleValue(rule.value)}.`
        }
        break
      }
      case 'minSelections':
        if (Array.isArray(value) && value.length < rule.value) {
          return `Select at least ${rule.value} options.`
        }
        break
      case 'maxSelections':
        if (Array.isArray(value) && value.length > rule.value) {
          return `Select no more than ${rule.value} options.`
        }
        break
    }
  }

  return null
}

export function getValidationErrorForEditedField({
  fieldDefinition,
  formId,
  state,
  nextValue,
}: {
  fieldDefinition: ResolvedFormFieldDefinition
  formId: string
  state: RuntimeState
  nextValue: unknown
}) {
  const nextState = {
    ...state,
    forms: {
      ...state.forms,
      [formId]: {
        ...(state.forms[formId] ?? {}),
        [fieldDefinition.fieldId]: {
          ...(selectFormFieldState(state, formId, fieldDefinition.fieldId) ?? {
            error: null,
            touched: false,
            dirty: false,
            defaultValue: fieldDefinition.defaultValue,
          }),
          value: nextValue,
        },
      },
    },
  }

  const nextFieldState = selectFormFieldState(nextState, formId, fieldDefinition.fieldId)

  if (!isLayoutNodeVisible(fieldDefinition, nextState)) {
    return nextFieldState?.error ?? null
  }

  const nextResolvedValue = resolveFormFieldValue(fieldDefinition, formId, nextState)
  return getFirstVisibleValidationError(fieldDefinition, nextResolvedValue)
}

function passesRequiredValidation(fieldDefinition: ResolvedFormFieldDefinition, value: unknown) {
  if (fieldDefinition.multiple) {
    return Array.isArray(value) && value.length > 0
  }

  if (fieldDefinition.items !== undefined) {
    return value !== ''
  }

  return typeof value === 'string' && value.trim().length > 0
}

function parseNumericFieldValue(value: unknown) {
  if (typeof value !== 'string' || value.trim() === '') {
    return null
  }

  const numericValue = Number(value)
  return Number.isFinite(numericValue) ? numericValue : null
}

function formatNumericRuleValue(value: number) {
  return Number.isInteger(value) ? String(value) : String(value)
}

function getChoiceFieldSurface(type: ResolvedFormFieldDefinition['type']) {
  if (type === 'radioGroup') {
    return 'radioGroup.props.items' as const
  }

  if (type === 'checkboxGroup') {
    return 'checkboxGroup.props.items' as const
  }

  return 'select.props.items' as const
}
