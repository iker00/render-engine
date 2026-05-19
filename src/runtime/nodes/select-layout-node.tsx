import type { SelectLayoutNode } from '../../config/runtime-config'
import { useOptionalFormContext } from '../form-context'
import { resolveResolvedFormFieldDefinition } from './form-layout-node'
import type { RuntimeIterationContext } from '../runtime-references/runtime-reference-resolver'
import { normalizeChoiceFieldValue, resolveSelectCollectionItems } from '../runtime-collection-sources'
import {
  getFieldControlClassName,
  getFieldErrorClassName,
  getFieldLabelClassName,
  getFieldWrapperClassName,
} from '../runtime-node-styling'
import { getValidationErrorForEditedField } from '../runtime-form-validations'
import { useRuntimeState, useRuntimeStateActions } from '../runtime-state/runtime-state-provider'
import { selectFormFieldState } from '../runtime-state/runtime-state-selectors'

interface SelectNodeProps {
  node: SelectLayoutNode
  iterationContext?: RuntimeIterationContext
}

export function SelectNode({ node, iterationContext }: SelectNodeProps) {
  const formContext = useOptionalFormContext()
  const state = useRuntimeState()
  const { setFormFieldError, setFormFieldValue } = useRuntimeStateActions()

  if (!formContext) {
    return null
  }

  const fieldState = selectFormFieldState(state, formContext.formId, node.props.fieldId)
  const fieldDefinition = resolveResolvedFormFieldDefinition(node, state, iterationContext)
  const defaultValue = fieldDefinition.defaultValue
  const resolvedItems = resolveSelectCollectionItems(node.props.items, state, { iterationContext })
  const isMultiple = node.props.multiple === true
  const value = normalizeChoiceFieldValue(
    node.props.items,
    state,
    fieldState?.value ?? defaultValue,
    {
      multiple: isMultiple,
      surface: 'select.props.items',
      iterationContext,
    },
  )
  const error = fieldState?.error ?? null
  const items =
    !isMultiple &&
    value === '' &&
    !resolvedItems.some((item) => item.value === '')
      ? [{ label: '', value: '' }, ...resolvedItems]
      : resolvedItems

  return (
    <label className={getFieldWrapperClassName()} data-layout-node="select">
      <span className={getFieldLabelClassName()}>{node.props.label}</span>
      <div className="relative">
        <select
          aria-label={node.props.label}
          className={`${getFieldControlClassName(error !== null)} ${isMultiple ? 'min-h-32 sm:min-h-36' : 'appearance-none pr-12'}`.trim()}
          multiple={isMultiple}
          value={value}
          onChange={(event) => {
            const nextValue = isMultiple
              ? Array.from(event.currentTarget.selectedOptions, (option) => option.value)
              : event.currentTarget.value
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
        >
          {items.map((item, index) => (
            <option key={`${node.props.fieldId}-${index}-${String(item.value)}`} value={String(item.value)}>
              {item.label}
            </option>
          ))}
        </select>
        {isMultiple ? null : (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-base text-app-text-muted"
          >
            <span className="-translate-y-px">▾</span>
          </span>
        )}
      </div>
      {error ? <span className={getFieldErrorClassName()}>{error}</span> : null}
    </label>
  )
}
