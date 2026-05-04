import type { InputLayoutNode } from '../../config/runtime-config'
import { useOptionalFormContext } from '../form-context'
import { resolveFieldDefaultValue } from './form-layout-node'
import {
  getFieldControlClassName,
  getFieldErrorClassName,
  getFieldLabelClassName,
  getFieldWrapperClassName,
} from '../runtime-node-styling'
import { useRuntimeState, useRuntimeStateActions } from '../runtime-state/runtime-state-provider'
import { selectFormFieldState } from '../runtime-state/runtime-state-selectors'

interface InputNodeProps {
  node: InputLayoutNode
}

export function InputNode({ node }: InputNodeProps) {
  const formContext = useOptionalFormContext()
  const state = useRuntimeState()
  const { setFormFieldError, setFormFieldValue } = useRuntimeStateActions()

  if (!formContext) {
    return null
  }

  const fieldState = selectFormFieldState(state, formContext.formId, node.props.fieldId)
  const defaultValue = resolveFieldDefaultValue(node, state)
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

          if (error && nextValue.trim().length > 0) {
            setFormFieldError(formContext.formId, node.props.fieldId, null)
          }
        }}
      />
      {error ? <span className={getFieldErrorClassName()}>{error}</span> : null}
    </label>
  )
}
