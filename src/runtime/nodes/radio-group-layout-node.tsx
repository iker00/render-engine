import type { RadioGroupLayoutNode } from '../../config/runtime-config'
import { useOptionalFormContext } from '../form-context'
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

interface RadioGroupNodeProps {
  node: RadioGroupLayoutNode
}

export function RadioGroupNode({ node }: RadioGroupNodeProps) {
  const formContext = useOptionalFormContext()
  const state = useRuntimeState()
  const { setFormFieldError, setFormFieldValue } = useRuntimeStateActions()

  if (!formContext) {
    return null
  }

  const fieldState = selectFormFieldState(state, formContext.formId, node.props.fieldId)
  const fieldDefinition = resolveResolvedFormFieldDefinition(node, state)
  const defaultValue = fieldDefinition.defaultValue
  const items = resolveChoiceCollectionItems(node.props.items, state, 'radioGroup.props.items')
  const value = normalizeChoiceFieldValue(node.props.items, state, fieldState?.value ?? defaultValue, {
    multiple: false,
    surface: 'radioGroup.props.items',
  })
  const error = fieldState?.error ?? null

  return (
    <fieldset className={getFieldWrapperClassName()} data-layout-node="radio-group">
      <legend className={getFieldLabelClassName()}>{node.props.label}</legend>
      {items.map((item, index) => (
        <label key={`${node.props.fieldId}-${index}-${item.value}`} className="flex items-center gap-2 text-sm text-slate-100">
          <input
            type="radio"
            name={`${formContext.formId}-${node.props.fieldId}`}
            value={item.value}
            checked={value === item.value}
            onChange={(event) => {
              const nextValue = event.currentTarget.value
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
