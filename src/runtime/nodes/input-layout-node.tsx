import type React from 'react'
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
import * as LucideIcons from 'lucide-react'
import { IconNode, toPascalCase } from './icon-node'

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

  const iconName = node.props.icon
  const resolvedIconName = iconName ? toPascalCase(iconName) : undefined
  const iconResolved = Boolean(
    resolvedIconName &&
    (LucideIcons as Record<string, unknown>)[resolvedIconName] !== undefined,
  )

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
      <span className={getFieldLabelClassName()}>{label}</span>
      {iconResolved ? (
        <span className={[
          'flex items-stretch rounded-control border overflow-hidden',
          hasError
            ? 'border-app-danger focus-within:border-app-danger focus-within:ring-app-danger'
            : 'border-app-border-soft focus-within:border-app-accent focus-within:ring-app-accent',
          'focus-within:ring-2',
        ].join(' ')}>
          <span className="flex items-center justify-center px-3 bg-gray-50 border-r border-app-border-soft shrink-0">
            <IconNode name={iconName} className="text-gray-400 size-4 pointer-events-none" />
          </span>
          <input
            {...sharedInputProps}
            className="flex-1 min-w-0 bg-white px-4 py-3 sm:px-3.5 sm:py-2.5 text-sm leading-6 sm:leading-5 text-app-text placeholder:text-app-text-muted focus-visible:outline-none"
          />
        </span>
      ) : (
        <input {...sharedInputProps} className={getFieldControlClassName(hasError)} />
      )}
      {hasError ? <span id={`${formContext.formId}-${node.props.fieldId}-error`} className={getFieldErrorClassName()}>{error}</span> : null}
    </label>
  )
}
