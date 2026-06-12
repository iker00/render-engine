import { useEffect, useMemo, useRef } from 'react'
import type { FormEvent, ReactNode } from 'react'
import type {
  CheckboxGroupLayoutNode,
  FormLayoutNode,
  FormOnErrorAction,
  FormOnSuccessAction,
  InputLayoutNode,
  LayoutNode,
  LayoutNodeCollection,
  RadioGroupLayoutNode,
  SelectLayoutNode,
  TextareaLayoutNode,
} from '../../config/runtime-config'
import { FormContextProvider } from '../form-context'
import { isLayoutNodeVisible, matchesVisibilityRule } from '../runtime-layout-visibility'
import type { RuntimeIterationContext } from '../runtime-references/runtime-reference-resolver'
import { resolveRuntimeValueWithOptions } from '../runtime-references/runtime-reference-resolver'
import { getFormNodeClassName } from '../runtime-node-styling'
import { normalizeChoiceFieldValue } from '../runtime-collection-sources'
import { type ResolvedFormFieldDefinition, validateFormFields } from '../runtime-form-validations'
import { useRuntimeState, useRuntimeStateActions } from '../runtime-state/runtime-state-provider'
import { selectFormFieldState } from '../runtime-state/runtime-state-selectors'
import { executeRuntimeUiAction, type RuntimeUiActionHandlers } from '../runtime-actions/runtime-ui-action-executor'

interface FormNodeProps {
  node: FormLayoutNode
  children?: ReactNode
  iterationContext?: RuntimeIterationContext
}

export function FormNode({ node, children, iterationContext }: FormNodeProps) {
  const state = useRuntimeState()
  const { executeQueryOperation, goBackPage, initializeForm, navigateToPage, openModal, closeModal, readRuntimeState, removeForm, resetForm, setFormFieldError, setFormFieldValue } =
    useRuntimeStateActions()
  const mountedPageEntryIdRef = useRef(state.pageEntry.entryId)

  const fieldDefinitions = useMemo(
    () => collectResolvedFormFieldDefinitions(node.children ?? [], state, iterationContext),
    [iterationContext, node.children, state],
  )
  const fieldsNeedingInitialization = useMemo(
    () =>
      fieldDefinitions.filter(
        (fieldDefinition) => {
          if (!isLayoutNodeVisible(fieldDefinition, state, iterationContext)) {
            return false
          }

          const fieldState = selectFormFieldState(state, node.id, fieldDefinition.fieldId)

          if (fieldState === null) {
            return true
          }

          if (state.pageEntry.preloadNames.length === 0) {
            return false
          }

          return shouldRefreshPristineFieldDefault(fieldState, fieldDefinition)
        },
      ),
    [fieldDefinitions, iterationContext, node.id, state],
  )

  useEffect(() => {
    if (fieldsNeedingInitialization.length === 0) {
      return
    }

    initializeForm(
      node.id,
      Object.fromEntries(
        fieldsNeedingInitialization.map((fieldDefinition) => [
          fieldDefinition.fieldId,
          {
            defaultValue: fieldDefinition.defaultValue,
          },
        ]),
      ),
    )
  }, [fieldsNeedingInitialization, initializeForm, node.id])

  useEffect(() => {
    if (node.persistOnUnmount) {
      return
    }

    return () => {
      if (readRuntimeState().pageEntry.entryId !== mountedPageEntryIdRef.current) {
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

  function buildHandlers(): RuntimeUiActionHandlers {
    return {
      executeQueryOperation: (operationName, options) =>
        executeQueryOperation(operationName, options),
      goBackPage,
      navigateToPage,
      openModal,
      closeModal,
      resetForm,
    }
  }

  function runOnSuccessActions(actions: FormOnSuccessAction[] | undefined) {
    if (!actions || actions.length === 0) {
      return
    }

    const handlers = buildHandlers()

    for (const action of actions) {
      const snapshot = readRuntimeState()

      if (!matchesVisibilityRule(action.when, snapshot, iterationContext)) {
        continue
      }

      // Strip 'when' before passing to executor since RuntimeUiAction doesn't have 'when'
      const { when: _when, ...baseAction } = action as FormOnSuccessAction & { when?: unknown }
      executeRuntimeUiAction(baseAction as Parameters<typeof executeRuntimeUiAction>[0], handlers, {
        state: snapshot,
        iterationContext,
      })
    }
  }

  function runOnErrorActions(actions: FormOnErrorAction[] | undefined) {
    if (!actions || actions.length === 0) {
      return
    }

    const handlers = buildHandlers()

    for (const action of actions) {
      const snapshot = readRuntimeState()

      if (!matchesVisibilityRule(action.when, snapshot, iterationContext)) {
        continue
      }

      // Strip 'when' before passing to executor since RuntimeUiAction doesn't have 'when'
      const { when: _when, ...baseAction } = action as FormOnErrorAction & { when?: unknown }
      executeRuntimeUiAction(baseAction as Parameters<typeof executeRuntimeUiAction>[0], handlers, {
        state: snapshot,
        iterationContext,
      })
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const snapshotState = readRuntimeState()
    const latestFieldDefinitions = collectResolvedFormFieldDefinitions(node.children ?? [], snapshotState, iterationContext)
    const visibleFieldDefinitions = latestFieldDefinitions.filter((fieldDefinition) =>
      isLayoutNodeVisible(fieldDefinition, snapshotState, iterationContext),
    )
    const visibleMissingFieldDefinitions = visibleFieldDefinitions.filter(
      (fieldDefinition) =>
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
      fieldDefinitions: visibleFieldDefinitions,
      state: snapshotState,
      iterationContext,
    })
    const defaultValuesByFieldId = Object.fromEntries(
      visibleFieldDefinitions.map((fieldDefinition) => [fieldDefinition.fieldId, fieldDefinition.defaultValue]),
    )

    for (const [fieldId, error] of Object.entries(validationResult.errorsByFieldId)) {
      setFormFieldError(node.id, fieldId, error, {
        defaultValue: defaultValuesByFieldId[fieldId],
      })
    }

    if (!validationResult.isValid || !node.submitAction) {
      return
    }

    const submitAction = node.submitAction

    if (submitAction.type === 'executeOperations') {
      const submitSnapshotState = readRuntimeState()
      const filteredOperations = submitAction.operations.filter((entry) =>
        matchesVisibilityRule(entry.when, submitSnapshotState, iterationContext),
      )
      const results = await Promise.all(
        filteredOperations.map((entry) =>
          executeQueryOperation(entry.operationName, {
            snapshotState: submitSnapshotState,
            requestParams: {
              query: entry.query,
              body: entry.body,
              headers: entry.headers,
            },
            iterationContext,
          }),
        ),
      )

      const allSuccess = results.every((r) => r.status === 'success')
      const anyError = results.some((r) => r.status === 'error')

      if (allSuccess) {
        runOnSuccessActions(node.onSuccess)

        if (node.resetOnSuccess) {
          resetForm(node.id)
        }
      } else if (anyError) {
        runOnErrorActions(node.onError)
      }

      return
    }

    // executeOperation branch (default for 'executeOperation' type)
    const result = await executeQueryOperation(submitAction.operationName, {
      snapshotState: readRuntimeState(),
      requestParams: {
        query: submitAction.query,
        body: submitAction.body,
        headers: submitAction.headers,
      },
      iterationContext,
    })

    if (result.status === 'success') {
      runOnSuccessActions(node.onSuccess)

      if (node.resetOnSuccess) {
        resetForm(node.id)
      }
    } else if (result.status === 'error') {
      runOnErrorActions(node.onError)
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
    if (!isLayoutNodeVisible(node, state, iterationContext)) {
      continue
    }

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
  node:
    | Pick<ResolvedFormFieldDefinition, 'type' | 'multiple'>
    | InputLayoutNode
    | TextareaLayoutNode
    | SelectLayoutNode
    | CheckboxGroupLayoutNode
    | RadioGroupLayoutNode,
) {
  if ('multiple' in node && typeof node.multiple === 'boolean') {
    return node.multiple
  }

  return node.type === 'checkboxGroup' || (node.type === 'select' && 'props' in node && node.props.multiple === true)
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

function shouldRefreshPristineFieldDefault(
  fieldState: NonNullable<ReturnType<typeof selectFormFieldState>>,
  fieldDefinition: Pick<ResolvedFormFieldDefinition, 'defaultValue' | 'type'>,
) {
  if (fieldDefinition.type !== 'input' && fieldDefinition.type !== 'textarea') {
    return false
  }

  if (fieldState.touched || fieldState.dirty || fieldState.error !== null) {
    return false
  }

  if (!areFieldValuesEqual(fieldState.value, fieldState.defaultValue)) {
    return false
  }

  if (!isPlaceholderFieldDefault(fieldState.defaultValue)) {
    return false
  }

  return !areFieldValuesEqual(fieldState.defaultValue, fieldDefinition.defaultValue)
}

function isPlaceholderFieldDefault(value: unknown) {
  if (value === '' || typeof value === 'undefined') {
    return true
  }

  return Array.isArray(value) && value.length === 0
}
