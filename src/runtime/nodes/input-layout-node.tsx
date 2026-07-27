import type React from 'react'
import type { InputLayoutNode } from '../../config/runtime-config'
import { useOptionalFormContext } from '../use-optional-form-context'
import {
  resolveRuntimeTextReference,
  type RuntimeIterationContext,
} from '../runtime-references/runtime-reference-resolver'
import { resolveResolvedFormFieldDefinition } from './resolve-form-field-definition'
import {
  getFieldControlClassName,
  getFieldErrorClassName,
  getFieldLabelClassName,
  getFieldWrapperClassName,
  getInputIconHolderClassName,
  getInputIconClassName,
  getInputWithIconClassName,
  getInputIconWrapperClassName,
} from '../runtime-node-styling'
import { getValidationErrorForEditedField } from '../runtime-form-validations'
import { useRuntimeState, useRuntimeStateActions } from '../runtime-state/use-runtime-state'
import { selectFormFieldState } from '../runtime-state/runtime-state-selectors'
import * as LucideIcons from 'lucide-react'
import { IconNode } from './icon-node'
import { toPascalCase } from './icon-name-case'
import { FieldTooltip } from './field-tooltip'

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
  const tooltip = node.props.tooltip !== undefined
    ? resolveRuntimeTextReference(node.props.tooltip, state, 'input.props.tooltip', { iterationContext })
    : ''
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

  const iconName = node.props.icon
  const resolvedIconName = iconName ? toPascalCase(iconName) : undefined
  const iconResolved = Boolean(
    resolvedIconName &&
    (LucideIcons as Record<string, unknown>)[resolvedIconName] !== undefined,
  )
  const iconPosition = node.props.iconPosition ?? 'left'

  const hasError = error !== null

  const sharedInputProps = {
    id: `${formContext.formId}-${node.props.fieldId}`,
    type: node.props.inputType ?? 'text',
    'aria-describedby': hasError ? `${formContext.formId}-${node.props.fieldId}-error` : undefined,
    placeholder: placeholder !== '' ? placeholder : undefined,
    value,
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
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
    },
  }

  return (
    <label className={getFieldWrapperClassName()} data-layout-node="input">
      <span className={getFieldLabelClassName()}>{label}<FieldTooltip text={tooltip} /></span>
      {iconResolved ? (
        <span className={getInputIconWrapperClassName(hasError)}>
          {iconPosition === 'right' ? (
            <>
              <input
                {...sharedInputProps}
                className={getInputWithIconClassName()}
              />
              <span className={getInputIconHolderClassName('right')}>
                <IconNode name={iconName} className={getInputIconClassName()} />
              </span>
            </>
          ) : (
            <>
              <span className={getInputIconHolderClassName('left')}>
                <IconNode name={iconName} className={getInputIconClassName()} />
              </span>
              <input
                {...sharedInputProps}
                className={getInputWithIconClassName()}
              />
            </>
          )}
        </span>
      ) : (
        <input {...sharedInputProps} className={getFieldControlClassName(hasError)} />
      )}
      {hasError ? <span id={`${formContext.formId}-${node.props.fieldId}-error`} className={getFieldErrorClassName()}>{error}</span> : null}
    </label>
  )
}
