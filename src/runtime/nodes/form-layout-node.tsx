import { useEffect, useMemo, useRef } from 'react'
import type { FormEvent, ReactNode } from 'react'
import type {
  FileInputLayoutNode,
  FormLayoutNode,
  FormOnErrorAction,
  FormOnSuccessAction,
  LayoutNodeCollection,
} from '../../config/runtime-config'
import { FormContextProvider } from '../form-context'
import { isLayoutNodeVisible, matchesVisibilityRule } from '../runtime-layout-visibility'
import type { RuntimeIterationContext } from '../runtime-references/runtime-reference-resolver'
import {
  resolveRuntimeValueWithOptions,
} from '../runtime-references/runtime-reference-resolver'
import { getFormNodeClassName } from '../runtime-node-styling'
import { normalizeChoiceFieldValue } from '../runtime-collection-sources'
import { type ResolvedFormFieldDefinition, validateFormFields } from '../runtime-form-validations'
import { useRuntimeState, useRuntimeStateActions } from '../runtime-state/use-runtime-state'
import { selectFormFieldState } from '../runtime-state/runtime-state-selectors'
import { executeRuntimeUiAction, type RuntimeUiActionHandlers } from '../runtime-actions/runtime-ui-action-executor'
import type {
  RuntimeApiEmptySubmitValues,
  RuntimeApiFileInputSources,
  RuntimeApiHiddenFormFields,
} from '../../queries/runtime-api-types'
import {
  getChoiceFieldSurface,
  resolveResolvedFormFieldDefinition,
  resolveToggleFieldDefinition,
} from './resolve-form-field-definition'

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

  const hiddenFieldDefs = useMemo(
    () => collectHiddenFieldDefinitions(node.children ?? [], state, iterationContext),
    [node.children, state, iterationContext],
  )
  const hiddenFieldsNeedingInitialization = useMemo(
    () =>
      hiddenFieldDefs.filter(
        (def) => selectFormFieldState(state, node.id, def.fieldId) === null,
      ),
    [hiddenFieldDefs, node.id, state],
  )

  useEffect(() => {
    const regularEntries = fieldsNeedingInitialization.map((fieldDefinition) => [
      fieldDefinition.fieldId,
      { defaultValue: fieldDefinition.defaultValue },
    ] as const)

    const hiddenEntries = hiddenFieldsNeedingInitialization.map((def) => [
      def.fieldId,
      { defaultValue: def.value },
    ] as const)

    const allEntries = [...regularEntries, ...hiddenEntries]

    if (allEntries.length === 0) {
      return
    }

    initializeForm(
      node.id,
      Object.fromEntries(allEntries),
    )
  }, [fieldsNeedingInitialization, hiddenFieldsNeedingInitialization, initializeForm, node.id])

  useEffect(() => {
    if (node.persistOnUnmount) {
      return
    }

    // Captured once per effect run (rather than reading `mountedPageEntryIdRef.current` inline
    // in the cleanup) so the comparison below always uses the entryId that was current when
    // this effect was scheduled, regardless of what the ref might point to by the time it runs.
    const mountedPageEntryId = mountedPageEntryIdRef.current

    return () => {
      if (readRuntimeState().pageEntry.entryId !== mountedPageEntryId) {
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
  }, [fieldDefinitions, iterationContext, node.id, setFormFieldValue, state])

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

    const visibleFieldIds = new Set(visibleFieldDefinitions.map((f) => f.fieldId))
    const hiddenTypeFieldIds = collectHiddenNodeFieldIds(node.children ?? [])
    const hiddenFieldIds = new Set(
      collectAllFormFieldIds(node.children ?? [])
        .filter((id) => !visibleFieldIds.has(id) && !hiddenTypeFieldIds.has(id)),
    )
    const hiddenFormFields: RuntimeApiHiddenFormFields = { formId: node.id, fieldIds: hiddenFieldIds }

    const emptySubmitValueByFieldId = collectSelectEmptySubmitValues(node.children ?? [])
    const emptySubmitValues: RuntimeApiEmptySubmitValues | undefined =
      emptySubmitValueByFieldId.size > 0
        ? { formId: node.id, valuesByFieldId: emptySubmitValueByFieldId }
        : undefined

    const fileInputSources = buildFileInputSources(node.id, visibleFieldDefinitions, snapshotState)

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
            hiddenFormFields,
            emptySubmitValues,
            fileInputSources,
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
      hiddenFormFields,
      emptySubmitValues,
      fileInputSources,
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

function collectResolvedFormFieldDefinitions(
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

    if (node.type === 'tabs') {
      for (const item of node.props.items) {
        if (!matchesVisibilityRule(item.visibility, state, iterationContext)) {
          continue
        }
        fields.push(...collectResolvedFormFieldDefinitions(item.children ?? [], state, iterationContext))
      }
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

    if (node.type === 'fileInput') {
      fields.push(resolveFileInputFieldDefinition(node))
    }

    if (node.type === 'toggle') {
      fields.push(resolveToggleFieldDefinition(node, state, iterationContext))
    }
  }

  return fields
}

/**
 * Collects all field IDs in a form tree regardless of node visibility.
 * Used by handleSubmit to compute the set of hidden fieldIds at submit time.
 */
function collectAllFormFieldIds(nodes: LayoutNodeCollection): string[] {
  const fieldIds: string[] = []

  for (const node of nodes) {
    if (node.type === 'container') {
      fieldIds.push(...collectAllFormFieldIds(node.children ?? []))
      continue
    }

    if (node.type === 'repeater') {
      fieldIds.push(...collectAllFormFieldIds(node.props.template))
      continue
    }

    if (node.type === 'tabs') {
      for (const item of node.props.items) {
        fieldIds.push(...collectAllFormFieldIds(item.children ?? []))
      }
      continue
    }

    if (
      node.type === 'input' ||
      node.type === 'textarea' ||
      node.type === 'select' ||
      node.type === 'radioGroup' ||
      node.type === 'checkboxGroup' ||
      node.type === 'fileInput' ||
      node.type === 'toggle' ||
      node.type === 'hidden'
    ) {
      fieldIds.push(node.props.fieldId)
    }
  }

  return fieldIds
}

/**
 * Builds the fileInputSources channel from the visible fileInput fields of a
 * form at submit time. Only visible fields with a File[] value are included;
 * an empty selection still contributes its (empty) entry as long as the field
 * is visible. Returns undefined when no visible fileInput field qualifies, so
 * callers never pass an empty-but-defined fileInputSources downstream.
 */
function buildFileInputSources(
  formId: string,
  visibleFieldDefinitions: ResolvedFormFieldDefinition[],
  state: ReturnType<typeof useRuntimeState>,
): RuntimeApiFileInputSources | undefined {
  const valuesByFieldId: Record<string, readonly File[]> = {}

  for (const fieldDefinition of visibleFieldDefinitions) {
    if (fieldDefinition.type !== 'fileInput') continue

    const fieldState = selectFormFieldState(state, formId, fieldDefinition.fieldId)
    const value = fieldState?.value ?? fieldDefinition.defaultValue

    if (!Array.isArray(value)) continue

    valuesByFieldId[fieldDefinition.fieldId] = value.filter((entry): entry is File => entry instanceof File)
  }

  if (Object.keys(valuesByFieldId).length === 0) {
    return undefined
  }

  return { formId, valuesByFieldId }
}

function resolveFileInputFieldDefinition(node: FileInputLayoutNode): ResolvedFormFieldDefinition {
  return {
    fieldId: node.props.fieldId,
    type: 'fileInput',
    fileValidations: node.props.validations,
    queryStateFeedback: node.queryStateFeedback,
    visibility: node.visibility,
    multiple: node.props.multiple ?? true,
    defaultValue: [],
  }
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

/**
 * Walks the form subtree ignoring parent visibility and collects hidden-type
 * nodes with their resolved values. Used to initialize hidden fields at form
 * mount independently of whether ancestor containers are visible.
 */
function collectHiddenFieldDefinitions(
  nodes: LayoutNodeCollection,
  state: ReturnType<typeof useRuntimeState>,
  iterationContext?: RuntimeIterationContext,
): Array<{ fieldId: string; value: unknown }> {
  const fields: Array<{ fieldId: string; value: unknown }> = []

  for (const node of nodes) {
    if (node.type === 'container') {
      fields.push(...collectHiddenFieldDefinitions(node.children ?? [], state, iterationContext))
      continue
    }

    if (node.type === 'repeater') {
      fields.push(...collectHiddenFieldDefinitions(node.props.template, state, iterationContext))
      continue
    }

    if (node.type === 'tabs') {
      for (const item of node.props.items) {
        fields.push(...collectHiddenFieldDefinitions(item.children ?? [], state, iterationContext))
      }
      continue
    }

    if (node.type === 'hidden') {
      const resolvedValue = resolveRuntimeValueWithOptions(node.props.value, state, { iterationContext })
      const value = resolvedValue.status === 'resolved' ? resolvedValue.value : node.props.value
      fields.push({ fieldId: node.props.fieldId, value })
    }
  }

  return fields
}

/**
 * Collects the field IDs of all hidden-type nodes in the form subtree.
 * These IDs must never be included in the "hidden fields" set that causes
 * payload omission at submit time.
 */
function collectHiddenNodeFieldIds(nodes: LayoutNodeCollection): Set<string> {
  const fieldIds = new Set<string>()

  for (const node of nodes) {
    if (node.type === 'container') {
      for (const id of collectHiddenNodeFieldIds(node.children ?? [])) {
        fieldIds.add(id)
      }
      continue
    }

    if (node.type === 'repeater') {
      for (const id of collectHiddenNodeFieldIds(node.props.template)) {
        fieldIds.add(id)
      }
      continue
    }

    if (node.type === 'tabs') {
      for (const item of node.props.items) {
        for (const id of collectHiddenNodeFieldIds(item.children ?? [])) {
          fieldIds.add(id)
        }
      }
      continue
    }

    if (node.type === 'hidden') {
      fieldIds.add(node.props.fieldId)
    }
  }

  return fieldIds
}

/**
 * Collects the configured `emptySubmitValue` for every simple-selection
 * `select` field in the form subtree, keyed by fieldId.
 */
function collectSelectEmptySubmitValues(nodes: LayoutNodeCollection): Map<string, string | number> {
  const valuesByFieldId = new Map<string, string | number>()

  for (const node of nodes) {
    if (node.type === 'container') {
      for (const [id, value] of collectSelectEmptySubmitValues(node.children ?? [])) {
        valuesByFieldId.set(id, value)
      }
      continue
    }

    if (node.type === 'repeater') {
      for (const [id, value] of collectSelectEmptySubmitValues(node.props.template)) {
        valuesByFieldId.set(id, value)
      }
      continue
    }

    if (node.type === 'tabs') {
      for (const item of node.props.items) {
        for (const [id, value] of collectSelectEmptySubmitValues(item.children ?? [])) {
          valuesByFieldId.set(id, value)
        }
      }
      continue
    }

    if (node.type === 'select' && node.props.multiple !== true && node.props.emptySubmitValue !== undefined) {
      valuesByFieldId.set(node.props.fieldId, node.props.emptySubmitValue)
    }
  }

  return valuesByFieldId
}
