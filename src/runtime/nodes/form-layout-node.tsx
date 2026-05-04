import { useEffect, useMemo } from 'react'
import type { FormEvent, ReactNode } from 'react'
import type {
  FormLayoutNode,
  InputLayoutNode,
  LayoutNode,
  LayoutNodeCollection,
  SelectLayoutNode,
  TextareaLayoutNode,
} from '../../config/runtime-config'
import { FormContextProvider } from '../form-context'
import { isLayoutNodeVisible } from '../runtime-query-state-feedback'
import { resolveRuntimeValue } from '../runtime-references/runtime-reference-resolver'
import { getFormNodeClassName } from '../runtime-node-styling'
import { useRuntimeState, useRuntimeStateActions } from '../runtime-state/runtime-state-provider'
import { selectFormFieldState } from '../runtime-state/runtime-state-selectors'

interface FormNodeProps {
  node: FormLayoutNode
  children?: ReactNode
}

interface ResolvedFormFieldDefinition {
  fieldId: string
  type: 'input' | 'textarea' | 'select'
  required: boolean
  queryStateFeedback?: LayoutNode['queryStateFeedback']
  items?: SelectLayoutNode['props']['items']
  defaultValue: unknown
}

export function FormNode({ node, children }: FormNodeProps) {
  const state = useRuntimeState()
  const { executeQueryOperation, initializeForm, readRuntimeState, resetForm, setFormFieldError } =
    useRuntimeStateActions()

  const fieldDefinitions = useMemo(
    () => collectResolvedFormFieldDefinitions(node.children ?? [], state),
    [node.children, state],
  )
  const missingFieldDefinitions = useMemo(
    () =>
      fieldDefinitions.filter(
        (fieldDefinition) =>
          isLayoutNodeVisible(fieldDefinition.queryStateFeedback, state) &&
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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const snapshotState = readRuntimeState()
    const latestFieldDefinitions = collectResolvedFormFieldDefinitions(node.children ?? [], snapshotState)
    const visibleMissingFieldDefinitions = latestFieldDefinitions.filter(
      (fieldDefinition) =>
        isLayoutNodeVisible(fieldDefinition.queryStateFeedback, snapshotState) &&
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

    if (node.type === 'input' || node.type === 'textarea' || node.type === 'select') {
      fields.push({
        fieldId: node.props.fieldId,
        type: node.type,
        required: node.props.required ?? false,
        queryStateFeedback: node.queryStateFeedback,
        items: node.type === 'select' ? node.props.items : undefined,
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
    const currentValue = fieldState?.value ?? fieldDefinition.defaultValue
    const isVisible = isLayoutNodeVisible(fieldDefinition.queryStateFeedback, state)

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
  node: InputLayoutNode | TextareaLayoutNode | SelectLayoutNode,
  state: ReturnType<typeof useRuntimeState>,
) {
  const resolvedValue = resolveRuntimeValue(node.props.defaultValue, state)
  const fallbackValue = node.type === 'select' ? '' : ''

  if (resolvedValue.status !== 'resolved') {
    return fallbackValue
  }

  if (node.type === 'select') {
    return normalizeSelectValue(node.props.items, resolvedValue.value)
  }

  return typeof resolvedValue.value === 'string' ? resolvedValue.value : fallbackValue
}

function normalizeSelectValue(items: SelectLayoutNode['props']['items'], value: unknown) {
  const normalizedValue =
    typeof value === 'string' || typeof value === 'number'
      ? String(value)
      : ''

  if (normalizedValue.length === 0) {
    return ''
  }

  const availableValues = new Set(items.map((item) => String(item.value)))
  return availableValues.has(normalizedValue) ? normalizedValue : ''
}

function isFieldValueValid(fieldDefinition: ResolvedFormFieldDefinition, value: unknown) {
  if (fieldDefinition.type === 'select') {
    return value !== ''
  }

  return typeof value === 'string' && value.trim().length > 0
}
