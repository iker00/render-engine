import type { CheckboxGroupLayoutNode } from '../../config/runtime-config'
import { useOptionalFormContext } from '../form-context'
import type { RuntimeIterationContext } from '../runtime-references/runtime-reference-resolver'
import { resolveResolvedFormFieldDefinition } from './form-layout-node'
import { normalizeChoiceFieldValue, resolveChoiceCollectionItems } from '../runtime-collection-sources'
import {
  getFieldErrorClassName,
  getFieldLabelClassName,
  getFieldWrapperClassName,
} from '../runtime-node-styling'
import { getValidationErrorForEditedField } from '../runtime-form-validations'
import { useRuntimeState, useRuntimeStateActions } from '../runtime-state/runtime-state-provider'
import { selectFormFieldState } from '../runtime-state/runtime-state-selectors'

interface CheckboxGroupNodeProps {
  node: CheckboxGroupLayoutNode
  iterationContext?: RuntimeIterationContext
}

export function CheckboxGroupNode({ node, iterationContext }: CheckboxGroupNodeProps) {
  const formContext = useOptionalFormContext()
  const state = useRuntimeState()
  const { setFormFieldError, setFormFieldValue } = useRuntimeStateActions()

  if (!formContext) {
    return null
  }

  const fieldState = selectFormFieldState(state, formContext.formId, node.props.fieldId)
  const fieldDefinition = resolveResolvedFormFieldDefinition(node, state, iterationContext)
  const defaultValue = fieldDefinition.defaultValue
  const items = resolveChoiceCollectionItems(node.props.items, state, 'checkboxGroup.props.items', { iterationContext })
  const value = normalizeChoiceFieldValue(node.props.items, state, fieldState?.value ?? defaultValue, {
    multiple: true,
    surface: 'checkboxGroup.props.items',
    iterationContext,
  })
  const selectedValues = new Set(value)
  const error = fieldState?.error ?? null

  return (
    <fieldset className={getFieldWrapperClassName()} data-layout-node="checkbox-group">
      <legend className={getFieldLabelClassName()}>{node.props.label}</legend>
      {items.map((item, index) => (
        <label key={`${node.props.fieldId}-${index}-${item.value}`} className="flex items-center gap-2 text-sm text-slate-100">
          <input
            type="checkbox"
            value={item.value}
            checked={selectedValues.has(item.value)}
            onChange={(event) => {
              const nextUncheckedValues = event.currentTarget.checked
                ? [...value, item.value]
                : value.filter((entry) => entry !== item.value)
              const nextValue = normalizeChoiceFieldValue(node.props.items, state, nextUncheckedValues, {
                multiple: true,
                surface: 'checkboxGroup.props.items',
                iterationContext,
              })

              setFormFieldValue(formContext.formId, node.props.fieldId, nextValue)

              if (error) {
                setFormFieldError(
                  formContext.formId,
                  node.props.fieldId,
                  getValidationErrorForEditedField({
                    fieldDefinition,
                    formId: formContext.formId,
                    state,
                    nextValue,
                  }),
                )
              }
            }}
          />
          <span>{item.label}</span>
        </label>
      ))}
      {error ? <span className={getFieldErrorClassName()}>{error}</span> : null}
    </fieldset>
  )
}
