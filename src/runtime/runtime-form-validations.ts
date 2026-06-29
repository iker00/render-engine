import type {
  CheckboxGroupLayoutNode,
  InputLayoutNode,
  LayoutNode,
  RadioGroupLayoutNode,
  RuntimeFileManagerValidations,
  RuntimeFormFieldValidations,
  SelectLayoutNode,
} from '../config/runtime-config'
import { isLayoutNodeVisible } from './runtime-layout-visibility'
import { normalizeChoiceFieldValue } from './runtime-collection-sources'
import type { RuntimeIterationContext } from './runtime-references/runtime-reference-resolver'
import { resolveRuntimeTextReference } from './runtime-references/runtime-reference-resolver'
import { selectFormFieldState } from './runtime-state/runtime-state-selectors'
import type { RuntimeState } from './runtime-state/runtime-state-types'

const VALUE_PLACEHOLDER_PATTERN = /\{\{\s*value\s*\}\}/g

export function formatValidationMessage({
  rule,
  defaultMessage,
  state,
  iterationContext,
}: {
  rule: { value: number | true; message?: string }
  defaultMessage: string
  state: RuntimeState
  iterationContext?: RuntimeIterationContext
}): string {
  if (rule.message === undefined) {
    return defaultMessage
  }

  if (rule.message === '') {
    return ''
  }

  const valueStr = typeof rule.value === 'number' ? String(rule.value) : ''
  const substituted = rule.message.replace(VALUE_PLACEHOLDER_PATTERN, valueStr)

  return resolveRuntimeTextReference(substituted, state, 'form.validation.message', { iterationContext })
}

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
  iterationContext,
}: {
  formId: string
  fieldDefinitions: ResolvedFormFieldDefinition[]
  state: RuntimeState
  iterationContext?: RuntimeIterationContext
}) {
  const errorsByFieldId: Record<string, string | null> = {}
  let isValid = true

  for (const fieldDefinition of fieldDefinitions) {
    const fieldState = selectFormFieldState(state, formId, fieldDefinition.fieldId)
    const currentValue = resolveFormFieldValue(fieldDefinition, formId, state)
    const isVisible = isLayoutNodeVisible(fieldDefinition, state, iterationContext)

    if (!isVisible) {
      errorsByFieldId[fieldDefinition.fieldId] = fieldState?.error ?? null
      continue
    }

    const errorResult = getFirstVisibleValidationError(fieldDefinition, currentValue)

    if (errorResult !== null) {
      errorsByFieldId[fieldDefinition.fieldId] = formatValidationMessage({
        rule: errorResult.rule,
        defaultMessage: errorResult.defaultMessage,
        state,
        iterationContext,
      })
      isValid = false
    } else {
      errorsByFieldId[fieldDefinition.fieldId] = null
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

export interface ValidationErrorResult {
  ruleName: string
  rule: { value: number | true; message?: string }
  defaultMessage: string
}

export function getFirstVisibleValidationError(
  fieldDefinition: ResolvedFormFieldDefinition,
  value: unknown,
): ValidationErrorResult | null {
  for (const [ruleName, rule] of Object.entries(fieldDefinition.validations ?? {})) {
    switch (ruleName) {
      case 'required':
        if (!passesRequiredValidation(fieldDefinition, value)) {
          return { ruleName, rule, defaultMessage: 'Required' }
        }
        break
      case 'minLength':
        if (typeof value === 'string' && value.length < rule.value) {
          return { ruleName, rule, defaultMessage: `Must be at least ${rule.value} characters.` }
        }
        break
      case 'maxLength':
        if (typeof value === 'string' && value.length > rule.value) {
          return { ruleName, rule, defaultMessage: `Must be at most ${rule.value} characters.` }
        }
        break
      case 'min': {
        const numericValue = parseNumericFieldValue(value)
        if (numericValue !== null && numericValue < rule.value) {
          return { ruleName, rule, defaultMessage: `Must be at least ${formatNumericRuleValue(rule.value)}.` }
        }
        break
      }
      case 'max': {
        const numericValue = parseNumericFieldValue(value)
        if (numericValue !== null && numericValue > rule.value) {
          return { ruleName, rule, defaultMessage: `Must be at most ${formatNumericRuleValue(rule.value)}.` }
        }
        break
      }
      case 'minSelections':
        if (Array.isArray(value) && value.length < rule.value) {
          return { ruleName, rule, defaultMessage: `Select at least ${rule.value} options.` }
        }
        break
      case 'maxSelections':
        if (Array.isArray(value) && value.length > rule.value) {
          return { ruleName, rule, defaultMessage: `Select no more than ${rule.value} options.` }
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
  iterationContext,
}: {
  fieldDefinition: ResolvedFormFieldDefinition
  formId: string
  state: RuntimeState
  nextValue: unknown
  iterationContext?: RuntimeIterationContext
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

  if (!isLayoutNodeVisible(fieldDefinition, nextState, iterationContext)) {
    return nextFieldState?.error ?? null
  }

  const nextResolvedValue = resolveFormFieldValue(fieldDefinition, formId, nextState)
  const errorResult = getFirstVisibleValidationError(fieldDefinition, nextResolvedValue)

  if (errorResult === null) {
    return null
  }

  return formatValidationMessage({
    rule: errorResult.rule,
    defaultMessage: errorResult.defaultMessage,
    state: nextState,
    iterationContext,
  })
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

export interface FileManagerRejectionPerFile {
  scope: 'per-file'
  file: File
  ruleName: string
  message: string
}

export interface FileManagerRejectionBatch {
  scope: 'batch'
  ruleName: string
  message: string
}

export type FileManagerRejection = FileManagerRejectionPerFile | FileManagerRejectionBatch

export interface FileManagerValidationResult {
  acceptedFiles: File[]
  rejection?: FileManagerRejection
}

export function evaluateFileManagerBatch(
  validations: RuntimeFileManagerValidations | undefined,
  existingFiles: File[],
  incomingBatch: File[],
): FileManagerValidationResult {
  const acceptedFiles: File[] = []
  let firstPerFileRejection: FileManagerRejectionPerFile | undefined

  // Build the set of names already present (existing + previously accepted in this batch)
  const acceptedNames = new Set(existingFiles.map((f) => f.name))

  // Step 1: per-file evaluation
  for (const file of incomingBatch) {
    const rejection = evaluatePerFileRules(validations, file, acceptedNames)
    if (rejection !== undefined) {
      if (firstPerFileRejection === undefined) {
        firstPerFileRejection = rejection
      }
      // rejected files are excluded from acceptedFiles but batch continues
    } else {
      acceptedFiles.push(file)
      acceptedNames.add(file.name)
    }
  }

  // Step 2: batch rules over existingFiles ∪ acceptedFiles
  const allFiles = [...existingFiles, ...acceptedFiles]

  if (validations?.maxFiles !== undefined) {
    const { value, message } = validations.maxFiles
    if (allFiles.length > value) {
      return {
        acceptedFiles: [],
        rejection: {
          scope: 'batch',
          ruleName: 'maxFiles',
          message: message ?? `Se ha superado el número máximo de ficheros permitidos (${value}).`,
        },
      }
    }
  }

  if (validations?.maxTotalSize !== undefined) {
    const { value, message } = validations.maxTotalSize
    const limitBytes = value * 1024 * 1024
    const totalSize = allFiles.reduce((sum, f) => sum + f.size, 0)
    if (totalSize > limitBytes) {
      return {
        acceptedFiles: [],
        rejection: {
          scope: 'batch',
          ruleName: 'maxTotalSize',
          message: message ?? `El tamaño total del lote supera el límite (${value} MB).`,
        },
      }
    }
  }

  return {
    acceptedFiles,
    rejection: firstPerFileRejection,
  }
}

function evaluatePerFileRules(
  validations: RuntimeFileManagerValidations | undefined,
  file: File,
  existingNames: Set<string>,
): FileManagerRejectionPerFile | undefined {
  const fileName = file.name

  // 1. Zero bytes
  if (file.size === 0) {
    return {
      scope: 'per-file',
      file,
      ruleName: 'zero-bytes',
      message: `El fichero "${fileName}" tiene 0 bytes.`,
    }
  }

  // 2. Duplicate name
  if (existingNames.has(fileName)) {
    return {
      scope: 'per-file',
      file,
      ruleName: 'duplicate-name',
      message: `Ya se ha subido un fichero con el nombre "${fileName}".`,
    }
  }

  if (validations === undefined) {
    return undefined
  }

  // 3. accept (MIME type)
  if (validations.accept !== undefined) {
    const { value, message } = validations.accept
    if (!value.includes(file.type)) {
      return {
        scope: 'per-file',
        file,
        ruleName: 'accept',
        message: message ?? `El fichero "${fileName}" no es de un tipo válido.`,
      }
    }
  }

  // 4. maxFileSize
  if (validations.maxFileSize !== undefined) {
    const { value, message } = validations.maxFileSize
    const limitBytes = value * 1024 * 1024
    if (file.size > limitBytes) {
      return {
        scope: 'per-file',
        file,
        ruleName: 'maxFileSize',
        message: message ?? `El fichero "${fileName}" supera el tamaño máximo permitido (${value} MB).`,
      }
    }
  }

  // 5. validFileNames
  if (validations.validFileNames !== undefined) {
    const { value, message } = validations.validFileNames
    const matches = value.some((pattern) => new RegExp(pattern).test(fileName))
    if (!matches) {
      return {
        scope: 'per-file',
        file,
        ruleName: 'validFileNames',
        message: message ?? `El nombre del fichero "${fileName}" no coincide con los patrones permitidos.`,
      }
    }
  }

  return undefined
}
