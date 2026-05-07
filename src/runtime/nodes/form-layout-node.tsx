import { useEffect, useMemo } from 'react'
import type { FormEvent, ReactNode } from 'react'
import type {
  CheckboxGroupLayoutNode,
  FormLayoutNode,
  InputLayoutNode,
  LayoutNode,
  LayoutNodeCollection,
  RadioGroupLayoutNode,
  SelectLayoutNode,
  TextareaLayoutNode,
} from '../../config/runtime-config'
import { FormContextProvider } from '../form-context'
import { isLayoutNodeVisible } from '../runtime-layout-visibility'
import { resolveRuntimeValue } from '../runtime-references/runtime-reference-resolver'
import { getFormNodeClassName } from '../runtime-node-styling'
import { normalizeChoiceFieldValue } from '../runtime-collection-sources'
import { useRuntimeState, useRuntimeStateActions } from '../runtime-state/runtime-state-provider'
import { selectFormFieldState } from '../runtime-state/runtime-state-selectors'

interface FormNodeProps {
  node: FormLayoutNode
  children?: ReactNode
}

interface ResolvedFormFieldDefinition {
  fieldId: string
  type: 'input' | 'textarea' | 'select' | 'radioGroup' | 'checkboxGroup'
  required: boolean
  queryStateFeedback?: LayoutNode['queryStateFeedback']
  visibility?: LayoutNode['visibility']
  items?: SelectLayoutNode['props']['items'] | RadioGroupLayoutNode['props']['items'] | CheckboxGroupLayoutNode['props']['items']
  multiple: boolean
  defaultValue: unknown
}

export function FormNode({ node, children }: FormNodeProps) {
  const state = useRuntimeState()
  const { executeQueryOperation, initializeForm, readRuntimeState, resetForm, setFormFieldError, setFormFieldValue } =
    useRuntimeStateActions()

  const fieldDefinitions = useMemo(
    () => collectResolvedFormFieldDefinitions(node.children ?? [], state),
    [node.children, state],
  )
  const missingFieldDefinitions = useMemo(
    () =>
      fieldDefinitions.filter(
        (fieldDefinition) =>
          isLayoutNodeVisible(fieldDefinition, state) &&
          selectFormFieldState(state, node.id, fieldDefinition.fieldId) === null,
      ),
    [fieldDefinitions, node.id, state],
  )

  useEffect(() => {
    if (missingFieldDefinitions.length === 0) {
      return
    }

    initializeForm(
      node.id,
      Object.fromEntries(
        missingFieldDefinitions.map((fieldDefinition) => [
          fieldDefinition.fieldId,
          {
            defaultValue: fieldDefinition.defaultValue,
          },
        ]),
      ),
    )
  }, [initializeForm, missingFieldDefinitions, node.id])

  useEffect(() => {
    for (const fieldDefinition of fieldDefinitions) {
      if (fieldDefinition.items === undefined) {
        continue
      }

      const fieldState = selectFormFieldState(state, node.id, fieldDefinition.fieldId)

      if (fieldState === null) {
        continue
      }

      const normalizedValue = normalizeChoiceFieldValue(fieldDefinition.items, state, fieldState.value, {
        multiple: fieldDefinition.multiple,
        surface: getChoiceFieldSurface(fieldDefinition.type),
      })

      if (!areFieldValuesEqual(fieldState.value, normalizedValue)) {
        setFormFieldValue(node.id, fieldDefinition.fieldId, normalizedValue)
      }
    }
  }, [fieldDefinitions, node.id, setFormFieldValue, state])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const snapshotState = readRuntimeState()
    const latestFieldDefinitions = collectResolvedFormFieldDefinitions(node.children ?? [], snapshotState)
    const visibleMissingFieldDefinitions = latestFieldDefinitions.filter(
      (fieldDefinition) =>
        isLayoutNodeVisible(fieldDefinition, snapshotState) &&
        selectFormFieldState(snapshotState, node.id, fieldDefinition.fieldId) === null,
    )

    if (visibleMissingFieldDefinitions.length > 0) {
      initializeForm(
        node.id,
        Object.fromEntries(
          visibleMissingFieldDefinitions.map((fieldDefinition) => [
            fieldDefinition.fieldId,
            {
              defaultValue: fieldDefinition.defaultValue,
            },
          ]),
        ),
      )
    }

    const validationResult = validateFormFields({
      formId: node.id,
      fieldDefinitions: latestFieldDefinitions,
      state: snapshotState,
    })
    const defaultValuesByFieldId = Object.fromEntries(
      latestFieldDefinitions.map((fieldDefinition) => [fieldDefinition.fieldId, fieldDefinition.defaultValue]),
    )

    for (const [fieldId, error] of Object.entries(validationResult.errorsByFieldId)) {
      setFormFieldError(node.id, fieldId, error, {
        defaultValue: defaultValuesByFieldId[fieldId],
      })
    }

    if (!validationResult.isValid || !node.submitAction) {
      return
    }

    const result = await executeQueryOperation(node.submitAction.operationName, {
      snapshotState: readRuntimeState(),
      requestParams: {
        query: node.submitAction.query,
        body: node.submitAction.body,
        headers: node.submitAction.headers,
      },
    })

    if (result.status === 'success' && node.resetOnSuccess) {
      resetForm(node.id)
    }
  }

  return (
    <FormContextProvider value={{ formId: node.id }}>
      <form className={getFormNodeClassName()} data-layout-node="form" noValidate onSubmit={(event) => void handleSubmit(event)}>
        {children}
      </form>
    </FormContextProvider>
  )
}

export function collectResolvedFormFieldDefinitions(nodes: LayoutNodeCollection, state: ReturnType<typeof useRuntimeState>) {
  const fields: ResolvedFormFieldDefinition[] = []

  for (const node of nodes) {
    if (node.type === 'container') {
      fields.push(...collectResolvedFormFieldDefinitions(node.children ?? [], state))
      continue
    }

    if (
      node.type === 'input' ||
      node.type === 'textarea' ||
      node.type === 'select' ||
      node.type === 'radioGroup' ||
      node.type === 'checkboxGroup'
    ) {
      fields.push({
        fieldId: node.props.fieldId,
        type: node.type,
        required: node.props.required ?? false,
        queryStateFeedback: node.queryStateFeedback,
        visibility: node.visibility,
        items: isChoiceFieldNode(node) ? node.props.items : undefined,
        multiple: isMultipleChoiceFieldNode(node),
        defaultValue: resolveFieldDefaultValue(node, state),
      })
    }
  }

  return fields
}

export function validateFormFields({
  formId,
  fieldDefinitions,
  state,
}: {
  formId: string
  fieldDefinitions: ResolvedFormFieldDefinition[]
  state: ReturnType<typeof useRuntimeState>
}) {
  const errorsByFieldId: Record<string, string | null> = {}
  let isValid = true

  for (const fieldDefinition of fieldDefinitions) {
    const fieldState = selectFormFieldState(state, formId, fieldDefinition.fieldId)
    const currentValue =
      fieldDefinition.items !== undefined
        ? normalizeChoiceFieldValue(fieldDefinition.items, state, fieldState?.value ?? fieldDefinition.defaultValue, {
            multiple: fieldDefinition.multiple,
            surface: getChoiceFieldSurface(fieldDefinition.type),
          })
        : fieldState?.value ?? fieldDefinition.defaultValue
    const isVisible = isLayoutNodeVisible(fieldDefinition, state)

    if (!isVisible) {
      errorsByFieldId[fieldDefinition.fieldId] = fieldState?.error ?? null
      continue
    }

    if (!fieldDefinition.required) {
      errorsByFieldId[fieldDefinition.fieldId] = null
      continue
    }

    if (isFieldValueValid(fieldDefinition, currentValue)) {
      errorsByFieldId[fieldDefinition.fieldId] = null
      continue
    }

    isValid = false
    errorsByFieldId[fieldDefinition.fieldId] = 'Required'
  }

  return {
    isValid,
    errorsByFieldId,
  }
}

export function resolveFieldDefaultValue(
  node: InputLayoutNode | TextareaLayoutNode | SelectLayoutNode | RadioGroupLayoutNode | CheckboxGroupLayoutNode,
  state: ReturnType<typeof useRuntimeState>,
) {
  const resolvedValue = resolveRuntimeValue(node.props.defaultValue, state)
  const fallbackValue = isMultipleChoiceFieldNode(node) ? [] : ''

  if (resolvedValue.status !== 'resolved') {
    return fallbackValue
  }

  if (isChoiceFieldNode(node)) {
    return normalizeChoiceFieldValue(node.props.items, state, resolvedValue.value, {
      multiple: isMultipleChoiceFieldNode(node),
      surface: getChoiceFieldSurface(node.type),
    })
  }

  if (typeof resolvedValue.value === 'string') {
    return resolvedValue.value
  }

  if (node.type === 'input' && typeof resolvedValue.value === 'number') {
    return String(resolvedValue.value)
  }

  return fallbackValue
}

function isFieldValueValid(fieldDefinition: ResolvedFormFieldDefinition, value: unknown) {
  if (fieldDefinition.multiple) {
    return Array.isArray(value) && value.length > 0
  }

  if (fieldDefinition.items !== undefined) {
    return value !== ''
  }

  return typeof value === 'string' && value.trim().length > 0
}

function isChoiceFieldNode(
  node: LayoutNode,
): node is SelectLayoutNode | RadioGroupLayoutNode | CheckboxGroupLayoutNode {
  return node.type === 'select' || node.type === 'radioGroup' || node.type === 'checkboxGroup'
}

function isMultipleChoiceFieldNode(
  node: Pick<ResolvedFormFieldDefinition, 'type' | 'multiple'> | SelectLayoutNode | CheckboxGroupLayoutNode | RadioGroupLayoutNode,
) {
  if ('multiple' in node && typeof node.multiple === 'boolean') {
    return node.multiple
  }

  return node.type === 'checkboxGroup' || (node.type === 'select' && node.props.multiple === true)
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

function areFieldValuesEqual(left: unknown, right: unknown) {
  if (Array.isArray(left) && Array.isArray(right)) {
    if (left.length !== right.length) {
      return false
    }

    return left.every((item, index) => Object.is(item, right[index]))
  }

  return Object.is(left, right)
}
