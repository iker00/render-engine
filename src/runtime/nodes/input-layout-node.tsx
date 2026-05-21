import type { InputLayoutNode } from '../../config/runtime-config'
import { useOptionalFormContext } from '../form-context'
import type { RuntimeIterationContext } from '../runtime-references/runtime-reference-resolver'
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

interface InputNodeProps {
  node: InputLayoutNode
  iterationContext?: RuntimeIterationContext
}

export function InputNode({ node, iterationContext }: InputNodeProps) {
  const formContext = useOptionalFormContext()
  const state = useRuntimeState()
  const { setFormFieldError, setFormFieldValue } = useRuntimeStateActions()

  if (!formContext) {
    return null
  }

  const fieldState = selectFormFieldState(state, formContext.formId, node.props.fieldId)
  const fieldDefinition = resolveResolvedFormFieldDefinition(node, state, iterationContext)
  const defaultValue = fieldDefinition.defaultValue
  const value =
    typeof fieldState?.value === 'string'
      ? fieldState.value
      : typeof defaultValue === 'string'
        ? defaultValue
        : ''
  const error = fieldState?.error ?? null

  return (
    <label className={getFieldWrapperClassName()} data-layout-node="input">
      <span className={getFieldLabelClassName()}>{node.props.label}</span>
      <input
        type={node.props.inputType ?? 'text'}
        className={getFieldControlClassName(error !== null)}
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
                iterationContext,
              }),
            )
          }
        }}
      />
      {error ? <span className={getFieldErrorClassName()}>{error}</span> : null}
    </label>
  )
}
