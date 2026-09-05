import type { TextareaLayoutNode } from '../../config/runtime-config'
import { useOptionalFormContext } from '../use-optional-form-context'
import {
  resolveRuntimeTextReference,
  type RuntimeIterationContext,
} from '../runtime-references/runtime-reference-resolver'
import { deriveScopedStateKey, EMPTY_INSTANCE_SCOPE } from '../runtime-references/runtime-instance-scope'
import { resolveResolvedFormFieldDefinition } from './resolve-form-field-definition'
import {
  getFieldControlClassName,
  getFieldErrorClassName,
  getFieldLabelClassName,
  getFieldWrapperClassName,
} from '../runtime-node-styling'
import { getValidationErrorForEditedField } from '../runtime-form-validations'
import { useRuntimeState, useRuntimeStateActions } from '../runtime-state/use-runtime-state'
import { selectFormFieldState } from '../runtime-state/runtime-state-selectors'
import { FieldTooltip } from './field-tooltip'

interface TextareaNodeProps {
  node: TextareaLayoutNode
  iterationContext?: RuntimeIterationContext
}

export function TextareaNode({ node, iterationContext }: TextareaNodeProps) {
  const formContext = useOptionalFormContext()
  const state = useRuntimeState()
  const { setFormFieldError, setFormFieldValue } = useRuntimeStateActions()

  if (!formContext) {
    return null
  }

  const scopeKey = deriveScopedStateKey(formContext.formId, formContext.scopeChain ?? EMPTY_INSTANCE_SCOPE)
  const fieldState = selectFormFieldState(state, scopeKey, node.props.fieldId)
  const fieldDefinition = resolveResolvedFormFieldDefinition(node, state, iterationContext)
  const label = resolveRuntimeTextReference(node.props.label, state, 'textarea.props.label', { iterationContext })
  const tooltip = node.props.tooltip !== undefined
    ? resolveRuntimeTextReference(node.props.tooltip, state, 'textarea.props.tooltip', { iterationContext })
    : ''
  const placeholder = node.props.placeholder !== undefined
    ? resolveRuntimeTextReference(node.props.placeholder, state, 'textarea.props.placeholder', { iterationContext })
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
    <label className={getFieldWrapperClassName()} data-layout-node="textarea">
      <span className={getFieldLabelClassName()}>{label}<FieldTooltip text={tooltip} /></span>
      <textarea
        id={`${formContext.formId}-${node.props.fieldId}`}
        className={`${getFieldControlClassName(error !== null)} min-h-28 resize-y sm:min-h-32`}
        aria-describedby={error !== null ? `${formContext.formId}-${node.props.fieldId}-error` : undefined}
        placeholder={placeholder !== '' ? placeholder : undefined}
        value={value}
        onChange={(event) => {
          const nextValue = event.currentTarget.value
          setFormFieldValue(formContext.formId, node.props.fieldId, nextValue, { scopeChain: formContext.scopeChain })

          if (error) {
            setFormFieldError(
              formContext.formId,
              node.props.fieldId,
              getValidationErrorForEditedField({
                fieldDefinition,
                formId: scopeKey,
                state,
                nextValue,
                iterationContext,
              }),
              { scopeChain: formContext.scopeChain },
            )
          }
        }}
      />
      {error ? <span id={`${formContext.formId}-${node.props.fieldId}-error`} className={getFieldErrorClassName()}>{error}</span> : null}
    </label>
  )
}
