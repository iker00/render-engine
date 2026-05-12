import { useEffect, useMemo, useRef } from 'react'
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
import type { RuntimeIterationContext } from '../runtime-references/runtime-reference-resolver'
import { resolveRuntimeValueWithOptions } from '../runtime-references/runtime-reference-resolver'
import { getFormNodeClassName } from '../runtime-node-styling'
import { normalizeChoiceFieldValue } from '../runtime-collection-sources'
import { type ResolvedFormFieldDefinition, validateFormFields } from '../runtime-form-validations'
import { useRuntimeState, useRuntimeStateActions } from '../runtime-state/runtime-state-provider'
import { selectFormFieldState } from '../runtime-state/runtime-state-selectors'

interface FormNodeProps {
  node: FormLayoutNode
  children?: ReactNode
  iterationContext?: RuntimeIterationContext
}

export function FormNode({ node, children, iterationContext }: FormNodeProps) {
  const state = useRuntimeState()
  const { executeQueryOperation, initializeForm, readRuntimeState, removeForm, resetForm, setFormFieldError, setFormFieldValue } =
    useRuntimeStateActions()
  const mountedPageIdRef = useRef(state.navigation.currentPageId)

  const fieldDefinitions = useMemo(
    () => collectResolvedFormFieldDefinitions(node.children ?? [], state, iterationContext),
    [iterationContext, node.children, state],
  )
  const missingFieldDefinitions = useMemo(
    () =>
      fieldDefinitions.filter(
        (fieldDefinition) =>
          isLayoutNodeVisible(fieldDefinition, state, iterationContext) &&
          selectFormFieldState(state, node.id, fieldDefinition.fieldId) === null,
      ),
    [fieldDefinitions, iterationContext, node.id, state],
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
    if (node.persistOnUnmount) {
      return
    }

    return () => {
      if (readRuntimeState().navigation.currentPageId !== mountedPageIdRef.current) {
        removeForm(node.id)
      }
    }
  }, [node.id, node.persistOnUnmount, readRuntimeState, removeForm])

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
        iterationContext,
      })

      if (!areFieldValuesEqual(fieldState.value, normalizedValue)) {
        setFormFieldValue(node.id, fieldDefinition.fieldId, normalizedValue)
      }
    }
  }, [fieldDefinitions, node.id, setFormFieldValue, state])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const snapshotState = readRuntimeState()
    const latestFieldDefinitions = collectResolvedFormFieldDefinitions(node.children ?? [], snapshotState, iterationContext)
    const visibleMissingFieldDefinitions = latestFieldDefinitions.filter(
      (fieldDefinition) =>
        isLayoutNodeVisible(fieldDefinition, snapshotState, iterationContext) &&
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
      iterationContext,
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

export function collectResolvedFormFieldDefinitions(
  nodes: LayoutNodeCollection,
  state: ReturnType<typeof useRuntimeState>,
  iterationContext?: RuntimeIterationContext,
) {
  const fields: ResolvedFormFieldDefinition[] = []

  for (const node of nodes) {
    if (node.type === 'container') {
      fields.push(...collectResolvedFormFieldDefinitions(node.children ?? [], state, iterationContext))
      continue
    }

    if (node.type === 'repeater') {
      fields.push(...collectResolvedFormFieldDefinitions(node.props.template, state, iterationContext))
      continue
    }

    if (
      node.type === 'input' ||
      node.type === 'textarea' ||
      node.type === 'select' ||
      node.type === 'radioGroup' ||
      node.type === 'checkboxGroup'
    ) {
      fields.push(resolveResolvedFormFieldDefinition(node, state, iterationContext))
    }
  }

  return fields
}

export function resolveResolvedFormFieldDefinition(
  node: InputLayoutNode | TextareaLayoutNode | SelectLayoutNode | RadioGroupLayoutNode | CheckboxGroupLayoutNode,
  state: ReturnType<typeof useRuntimeState>,
  iterationContext?: RuntimeIterationContext,
): ResolvedFormFieldDefinition {
  return {
    fieldId: node.props.fieldId,
    type: node.type,
    validations: node.props.validations,
    queryStateFeedback: node.queryStateFeedback,
    visibility: node.visibility,
    items: isChoiceFieldNode(node) ? node.props.items : undefined,
    multiple: isMultipleChoiceFieldNode(node),
    defaultValue: resolveFieldDefaultValue(node, state, iterationContext),
    inputType: node.type === 'input' ? node.props.inputType : undefined,
  }
}
export function resolveFieldDefaultValue(
  node: InputLayoutNode | TextareaLayoutNode | SelectLayoutNode | RadioGroupLayoutNode | CheckboxGroupLayoutNode,
  state: ReturnType<typeof useRuntimeState>,
  iterationContext?: RuntimeIterationContext,
) {
  const resolvedValue = resolveRuntimeValueWithOptions(node.props.defaultValue, state, { iterationContext })
  const fallbackValue = isMultipleChoiceFieldNode(node) ? [] : ''

  if (resolvedValue.status !== 'resolved') {
    return fallbackValue
  }

  if (isChoiceFieldNode(node)) {
    return normalizeChoiceFieldValue(node.props.items, state, resolvedValue.value, {
      multiple: isMultipleChoiceFieldNode(node),
      surface: getChoiceFieldSurface(node.type),
      iterationContext,
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
