import type { CheckboxGroupLayoutNode } from '../../config/runtime-config'
import { useOptionalFormContext } from '../form-context'
import {
  resolveRuntimeTextReference,
  type RuntimeIterationContext,
} from '../runtime-references/runtime-reference-resolver'
import { resolveResolvedFormFieldDefinition } from './form-layout-node'
import { normalizeChoiceFieldValue, resolveChoiceCollectionItems } from '../runtime-collection-sources'
import {
  getChoiceGroupClassName,
  getChoiceOptionClassName,
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
  const label = resolveRuntimeTextReference(node.props.label, state, 'checkboxGroup.props.label', { iterationContext })
  const defaultValue = fieldDefinition.defaultValue
  const items = resolveChoiceCollectionItems(node.props.items, state, 'checkboxGroup.props.items', { iterationContext })
  const value = normalizeChoiceFieldValue(node.props.items, state, fieldState?.value ?? defaultValue, {
    multiple: true,
    surface: 'checkboxGroup.props.items',
    iterationContext,
  })
  const selectedValues = new Set(value)
  const error = fieldState?.error ?? null
  const optionLayout = node.props.optionLayout ?? 'vertical'

  const errorId = `${formContext.formId}-${node.props.fieldId}-error`

  return (
    <fieldset
      className={getFieldWrapperClassName()}
      data-layout-node="checkbox-group"
      aria-describedby={error !== null ? errorId : undefined}
    >
      <legend className={getFieldLabelClassName()}>{label}</legend>
      <div className={getChoiceGroupClassName(optionLayout)}>
        {items.map((item, index) => (
          <label key={`${node.props.fieldId}-${index}-${item.value}`} className={getChoiceOptionClassName(optionLayout)}>
            <input
              type="checkbox"
              value={item.value}
              checked={selectedValues.has(item.value)}
              className="mt-1 h-4 w-4 rounded text-app-accent focus:ring-app-accent"
              onChange={(event) => {
                const currentValue = Array.isArray(value) ? value : []
                const nextUncheckedValues = event.currentTarget.checked
                  ? [...currentValue, item.value]
                  : currentValue.filter((entry) => entry !== item.value)
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
                      iterationContext,
                    }),
                  )
                }
              }}
            />
            <span>{item.label}</span>
          </label>
        ))}
      </div>
      {error ? <span id={errorId} className={getFieldErrorClassName()}>{error}</span> : null}
    </fieldset>
  )
}
