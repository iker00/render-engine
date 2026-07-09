import type { ToggleLayoutNode } from '../../config/runtime-config'
import { useOptionalFormContext } from '../form-context'
import {
  resolveRuntimeTextReference,
  type RuntimeIterationContext,
} from '../runtime-references/runtime-reference-resolver'
import { resolveToggleFieldDefinition } from './form-layout-node'
import {
  getFieldWrapperClassName,
  getFieldLabelClassName,
  getFieldErrorClassName,
} from '../runtime-node-styling'
import { getValidationErrorForEditedField } from '../runtime-form-validations'
import { useRuntimeState, useRuntimeStateActions } from '../runtime-state/runtime-state-provider'
import { selectFormFieldState } from '../runtime-state/runtime-state-selectors'
import { FieldTooltip } from './field-tooltip'

interface ToggleNodeProps {
  node: ToggleLayoutNode
  iterationContext?: RuntimeIterationContext
}

export function ToggleNode({ node, iterationContext }: ToggleNodeProps) {
  const formContext = useOptionalFormContext()
  const state = useRuntimeState()
  const { setFormFieldError, setFormFieldValue } = useRuntimeStateActions()

  if (!formContext) {
    return null
  }

  const fieldState = selectFormFieldState(state, formContext.formId, node.props.fieldId)
  const fieldDefinition = resolveToggleFieldDefinition(node, state, iterationContext)
  const label = resolveRuntimeTextReference(node.props.label, state, 'toggle.props.label', { iterationContext })
  const tooltip = node.props.tooltip !== undefined
    ? resolveRuntimeTextReference(node.props.tooltip, state, 'toggle.props.tooltip', { iterationContext })
    : ''
  const defaultValue = fieldDefinition.defaultValue
  const value =
    typeof fieldState?.value === 'boolean'
      ? fieldState.value
      : typeof defaultValue === 'boolean'
        ? defaultValue
        : false

  const error = fieldState?.error ?? null
  const hasError = error !== null
  const isInline = node.props.labelPosition === 'inline'

  function handleClick() {
    const nextValue = !value
    setFormFieldValue(formContext!.formId, node.props.fieldId, nextValue)
    if (error) {
      setFormFieldError(
        formContext!.formId,
        node.props.fieldId,
        getValidationErrorForEditedField({
          fieldDefinition,
          formId: formContext!.formId,
          state,
          nextValue,
          iterationContext,
        }),
      )
    }
  }

  const toggleButton = (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      aria-describedby={hasError ? `${formContext.formId}-${node.props.fieldId}-error` : undefined}
      onClick={handleClick}
      className={getToggleButtonClassName(value)}
    >
      <span className={getToggleKnobClassName(value)} />
    </button>
  )

  return (
    <div className={getFieldWrapperClassName()} data-layout-node="toggle">
      {isInline ? (
        <div className="flex flex-row items-center gap-3">
          {toggleButton}
          <span className={getFieldLabelClassName()}>{label}<FieldTooltip text={tooltip} /></span>
        </div>
      ) : (
        <>
          <span className={getFieldLabelClassName()}>{label}<FieldTooltip text={tooltip} /></span>
          {toggleButton}
        </>
      )}
      {hasError ? (
        <span
          id={`${formContext.formId}-${node.props.fieldId}-error`}
          className={getFieldErrorClassName()}
        >
          {error}
        </span>
      ) : null}
    </div>
  )
}

function getToggleButtonClassName(checked: boolean) {
  return [
    'relative',
    'inline-flex',
    'h-6',
    'w-11',
    'shrink-0',
    'cursor-pointer',
    'rounded-full',
    'border-2',
    'border-transparent',
    'transition-colors',
    'duration-200',
    'ease-in-out',
    'focus-visible:outline-none',
    'focus-visible:ring-2',
    'focus-visible:ring-app-accent',
    checked ? 'bg-app-accent' : 'bg-app-border-soft',
  ].join(' ')
}

function getToggleKnobClassName(checked: boolean) {
  return [
    'pointer-events-none',
    'inline-block',
    'h-5',
    'w-5',
    'rounded-full',
    'bg-white',
    'shadow',
    'ring-0',
    'transition',
    'duration-200',
    'ease-in-out',
    checked ? 'translate-x-5' : 'translate-x-0',
  ].join(' ')
}
