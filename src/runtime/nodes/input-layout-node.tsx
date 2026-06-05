import type { InputLayoutNode } from '../../config/runtime-config'
import { useOptionalFormContext } from '../form-context'
import {
  resolveRuntimeTextReference,
  type RuntimeIterationContext,
} from '../runtime-references/runtime-reference-resolver'
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
  const label = resolveRuntimeTextReference(node.props.label, state, 'input.props.label', { iterationContext })
  const placeholder = node.props.placeholder !== undefined
    ? resolveRuntimeTextReference(node.props.placeholder, state, 'input.props.placeholder', { iterationContext })
    : ''
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
      <span className={getFieldLabelClassName()}>{label}</span>
      <input
        id={`${formContext.formId}-${node.props.fieldId}`}
        type={node.props.inputType ?? 'text'}
        className={getFieldControlClassName(error !== null)}
        aria-describedby={error !== null ? `${formContext.formId}-${node.props.fieldId}-error` : undefined}
        placeholder={placeholder !== '' ? placeholder : undefined}
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
      {error ? <span id={`${formContext.formId}-${node.props.fieldId}-error`} className={getFieldErrorClassName()}>{error}</span> : null}
    </label>
  )
}
