import { useEffect, useMemo, useRef } from 'react'
import type { FormEvent, ReactNode } from 'react'
import type { FormLayoutNode } from '../../config/runtime-config'
import { FormContextProvider } from '../form-context'
import { isLayoutNodeVisible, matchesVisibilityRule } from '../runtime-layout-visibility'
import type { RuntimeIterationContext } from '../runtime-references/runtime-reference-resolver'
import type { RuntimeInstanceScope } from '../runtime-references/runtime-instance-scope'
import { deriveScopedStateKey, EMPTY_INSTANCE_SCOPE } from '../runtime-references/runtime-instance-scope'
import { getFormNodeClassName } from '../runtime-node-styling'
import { normalizeChoiceFieldValue } from '../runtime-collection-sources'
import { type ResolvedFormFieldDefinition, validateFormFields } from '../runtime-form-validations'
import { useRuntimeState, useRuntimeStateActions } from '../runtime-state/use-runtime-state'
import { selectFormFieldState } from '../runtime-state/runtime-state-selectors'
import type { RuntimeState } from '../runtime-state/runtime-state-types'
import {
  runActionOutcomeWithLifecycle,
  type RuntimeUiActionHandlers,
} from '../runtime-actions/runtime-ui-action-executor'
import type {
  RuntimeApiEmptySubmitValues,
  RuntimeApiFileInputSources,
  RuntimeApiHiddenFormFields,
} from '../../queries/runtime-api-types'
import { getChoiceFieldSurface } from './resolve-form-field-definition'
import {
  collectAllFormFieldIds,
  collectHiddenFieldDefinitions,
  collectHiddenNodeFieldIds,
  collectResolvedFormFieldDefinitions,
  collectSelectEmptySubmitValues,
} from './runtime-form-field-collection'

interface FormNodeProps {
  node: FormLayoutNode
  children?: ReactNode
  iterationContext?: RuntimeIterationContext
  scopeChain?: RuntimeInstanceScope
}

export function FormNode({ node, children, iterationContext, scopeChain }: FormNodeProps) {
  const resolvedScopeChain = scopeChain ?? EMPTY_INSTANCE_SCOPE
  // Effective store key (T05 / feature reusable-node-groups): `node.id` composed with the
  // ambient scope chain. Outside every repeater/group this equals `node.id` literally (cero
  // regresión); `node.id` itself keeps flowing to `FormContextProvider`, hiddenFormFields and
  // fileInputSources below, since those are matched against the literal `forms.{formId}.*`
  // references authored in config, not against the store key.
  const scopeKey = deriveScopedStateKey(node.id, resolvedScopeChain)
  const state = useRuntimeState()
  const {
    executeQueryOperation,
    executeDownloadOperation,
    goBackPage,
    initializeForm,
    navigateToPage,
    openModal,
    closeModal,
    readRuntimeState,
    removeForm,
    resetForm,
    setFormFieldError,
    setFormFieldValue,
  } = useRuntimeStateActions()
  const mountedPageEntryIdRef = useRef(state.pageEntry.entryId)

  const fieldDefinitions = useMemo(
    () => collectResolvedFormFieldDefinitions(node.children ?? [], state, iterationContext),
    [iterationContext, node.children, state],
  )
  const fieldsNeedingInitialization = useMemo(
    () =>
      fieldDefinitions.filter(
        (fieldDefinition) => {
          if (fieldDefinition.stepGroup !== undefined) {
            return false
          }

          if (!isLayoutNodeVisible(fieldDefinition, state, iterationContext)) {
            return false
          }

          const fieldState = selectFormFieldState(state, scopeKey, fieldDefinition.fieldId)

          if (fieldState === null) {
            return true
          }

          if (state.pageEntry.preloadNames.length === 0) {
            return false
          }

          return shouldRefreshPristineFieldDefault(fieldState, fieldDefinition)
        },
      ),
    [fieldDefinitions, iterationContext, scopeKey, state],
  )

  const hiddenFieldDefs = useMemo(
    () => collectHiddenFieldDefinitions(node.children ?? [], state, iterationContext),
    [node.children, state, iterationContext],
  )
  const hiddenFieldsNeedingInitialization = useMemo(
    () =>
      hiddenFieldDefs.filter(
        (def) => selectFormFieldState(state, scopeKey, def.fieldId) === null,
      ),
    [hiddenFieldDefs, scopeKey, state],
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
      { scopeChain: resolvedScopeChain },
    )
  }, [fieldsNeedingInitialization, hiddenFieldsNeedingInitialization, initializeForm, node.id, resolvedScopeChain])

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
        removeForm(node.id, { scopeChain: resolvedScopeChain })
      }
    }
  }, [node.id, node.persistOnUnmount, readRuntimeState, removeForm, resolvedScopeChain])

  useEffect(() => {
    for (const fieldDefinition of fieldDefinitions) {
      if (fieldDefinition.items === undefined) {
        continue
      }

      const fieldState = selectFormFieldState(state, scopeKey, fieldDefinition.fieldId)

      if (fieldState === null) {
        continue
      }

      const normalizedValue = normalizeChoiceFieldValue(fieldDefinition.items, state, fieldState.value, {
        multiple: fieldDefinition.multiple,
        surface: getChoiceFieldSurface(fieldDefinition.type),
        iterationContext,
      })

      if (!areFieldValuesEqual(fieldState.value, normalizedValue)) {
        setFormFieldValue(node.id, fieldDefinition.fieldId, normalizedValue, { scopeChain: resolvedScopeChain })
      }
    }
  }, [fieldDefinitions, iterationContext, node.id, resolvedScopeChain, scopeKey, setFormFieldValue, state])

  function buildHandlers(): RuntimeUiActionHandlers {
    return {
      executeQueryOperation: (operationName, options) =>
        executeQueryOperation(operationName, options),
      executeDownloadOperation,
      goBackPage,
      navigateToPage,
      openModal,
      closeModal,
      resetForm,
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
        selectFormFieldState(snapshotState, scopeKey, fieldDefinition.fieldId) === null,
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
        { scopeChain: resolvedScopeChain },
      )
    }

    const validationResult = validateFormFields({
      formId: scopeKey,
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
        scopeChain: resolvedScopeChain,
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

    const fileInputSources = buildFileInputSources(node.id, scopeKey, visibleFieldDefinitions, snapshotState)

    const submitAction = node.submitAction

    if (submitAction.type === 'executeOperations') {
      const outcome = await runActionOutcomeWithLifecycle(
        async () => {
          // The own form's fields are remapped from `scopeKey` back onto `node.id` (T05) so
          // that `submitAction.operations[].{query,body,headers}` — authored against the
          // literal `forms.{node.id}.{fieldId}` reference — resolves this iteration's values
          // instead of accidentally reading a sibling iteration stored under the same raw id.
          const submitSnapshotState = withFormScopedForSubmit(readRuntimeState(), node.id, scopeKey)
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
          const status = allSuccess ? 'success' : anyError ? 'error' : 'skipped'
          return { status }
        },
        node.onSuccess,
        node.onError,
        buildHandlers(),
        readRuntimeState,
        iterationContext,
        resolvedScopeChain,
      )

      if (outcome.status === 'success' && node.resetOnSuccess) {
        resetForm(node.id, { scopeChain: resolvedScopeChain })
      }

      return
    }

    // executeOperation branch (default for 'executeOperation' type)
    const outcome = await runActionOutcomeWithLifecycle(
      () =>
        executeQueryOperation(submitAction.operationName, {
          snapshotState: withFormScopedForSubmit(readRuntimeState(), node.id, scopeKey),
          requestParams: {
            query: submitAction.query,
            body: submitAction.body,
            headers: submitAction.headers,
          },
          iterationContext,
          hiddenFormFields,
          emptySubmitValues,
          fileInputSources,
        }),
      node.onSuccess,
      node.onError,
      buildHandlers(),
      readRuntimeState,
      iterationContext,
      resolvedScopeChain,
    )

    if (outcome.status === 'success' && node.resetOnSuccess) {
      resetForm(node.id, { scopeChain: resolvedScopeChain })
    }
  }

  return (
    <FormContextProvider value={{ formId: node.id, scopeChain: resolvedScopeChain }}>
      <form className={getFormNodeClassName()} data-layout-node="form" noValidate onSubmit={(event) => void handleSubmit(event)}>
        {children}
      </form>
    </FormContextProvider>
  )
}

/**
 * Remaps `state.forms[formId]` (the raw, literal id authored in config) onto the current
 * iteration's scoped entry (`state.forms[scopeKey]`) so that request-body/header resolvers in
 * `src/queries/` — which resolve `forms.{formId}.{fieldId}` against the full `state` without any
 * scope awareness — see this iteration's own field values under the id they already reference
 * (T05 / feature reusable-node-groups). A no-op outside every repeater/group, where
 * `scopeKey === formId` (cero regresión).
 */
function withFormScopedForSubmit(state: RuntimeState, formId: string, scopeKey: string): RuntimeState {
  if (scopeKey === formId) {
    return state
  }

  return {
    ...state,
    forms: {
      ...state.forms,
      [formId]: state.forms[scopeKey] ?? {},
    },
  }
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
  scopeKey: string,
  visibleFieldDefinitions: ResolvedFormFieldDefinition[],
  state: ReturnType<typeof useRuntimeState>,
): RuntimeApiFileInputSources | undefined {
  const valuesByFieldId: Record<string, readonly File[]> = {}

  for (const fieldDefinition of visibleFieldDefinitions) {
    if (fieldDefinition.type !== 'fileInput') continue

    const fieldState = selectFormFieldState(state, scopeKey, fieldDefinition.fieldId)
    const value = fieldState?.value ?? fieldDefinition.defaultValue

    if (!Array.isArray(value)) continue

    valuesByFieldId[fieldDefinition.fieldId] = value.filter((entry): entry is File => entry instanceof File)
  }

  if (Object.keys(valuesByFieldId).length === 0) {
    return undefined
  }

  return { formId, valuesByFieldId }
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
