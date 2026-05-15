import type { TextareaLayoutNode } from '../../config/runtime-config'
import { useOptionalFormContext } from '../form-context'
import { resolveResolvedFormFieldDefinition } from './form-layout-node'
import {
  getFieldControlClassName,
  getFieldErrorClassName,
  getFieldLabelClassName,
  getFieldWrapperClassName,
} from '../runtime-node-styling'
import { getValidationErrorForEditedField } from '../runtime-form-validations'
import { useRuntimeState, useRuntimeStateActions } from '../runtime-state/runtime-state-provider'
import { selectFormFieldState } from '../runtime-state/runtime-state-selectors'

interface TextareaNodeProps {
  node: TextareaLayoutNode
}

export function TextareaNode({ node }: TextareaNodeProps) {
  const formContext = useOptionalFormContext()
  const state = useRuntimeState()
  const { setFormFieldError, setFormFieldValue } = useRuntimeStateActions()

  if (!formContext) {
    return null
  }

  const fieldState = selectFormFieldState(state, formContext.formId, node.props.fieldId)
  const fieldDefinition = resolveResolvedFormFieldDefinition(node, state)
  const defaultValue = fieldDefinition.defaultValue
  const value =
    typeof fieldState?.value === 'string'
      ? fieldState.value
      : typeof defaultValue === 'string'
        ? defaultValue
        : ''
  const error = fieldState?.error ?? null

  return (
    <label className={getFieldWrapperClassName()} data-layout-node="textarea">
      <span className={getFieldLabelClassName()}>{node.props.label}</span>
      <textarea
        className={`${getFieldControlClassName(error !== null)} min-h-32 resize-y`}
        value={value}
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
      {error ? <span className={getFieldErrorClassName()}>{error}</span> : null}
    </label>
  )
}
