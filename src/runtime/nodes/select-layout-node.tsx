import type { SelectLayoutNode } from '../../config/runtime-config'
import { useOptionalFormContext } from '../form-context'
import { resolveFieldDefaultValue } from './form-layout-node'
import { normalizeSelectFieldValue, resolveSelectCollectionItems } from '../runtime-collection-sources'
import {
  getFieldControlClassName,
  getFieldErrorClassName,
  getFieldLabelClassName,
  getFieldWrapperClassName,
} from '../runtime-node-styling'
import { useRuntimeState, useRuntimeStateActions } from '../runtime-state/runtime-state-provider'
import { selectFormFieldState } from '../runtime-state/runtime-state-selectors'

interface SelectNodeProps {
  node: SelectLayoutNode
}

export function SelectNode({ node }: SelectNodeProps) {
  const formContext = useOptionalFormContext()
  const state = useRuntimeState()
  const { setFormFieldError, setFormFieldValue } = useRuntimeStateActions()

  if (!formContext) {
    return null
  }

  const fieldState = selectFormFieldState(state, formContext.formId, node.props.fieldId)
  const defaultValue = resolveFieldDefaultValue(node, state)
  const resolvedItems = resolveSelectCollectionItems(node.props.items, state)
  const value =
    typeof fieldState?.value === 'string' || typeof fieldState?.value === 'number'
      ? normalizeSelectFieldValue(node.props.items, state, fieldState.value)
      : typeof defaultValue === 'string'
        ? defaultValue
        : ''
  const error = fieldState?.error ?? null
  const items =
    value === '' && !resolvedItems.some((item) => item.value === '')
      ? [{ label: '', value: '' }, ...resolvedItems]
      : resolvedItems

  return (
    <label className={getFieldWrapperClassName()} data-layout-node="select">
      <span className={getFieldLabelClassName()}>{node.props.label}</span>
      <select
        className={getFieldControlClassName(error !== null)}
        value={value}
        onChange={(event) => {
          const nextValue = event.currentTarget.value
          setFormFieldValue(formContext.formId, node.props.fieldId, nextValue)

          if (error && nextValue !== '') {
            setFormFieldError(formContext.formId, node.props.fieldId, null)
          }
        }}
      >
        {items.map((item, index) => (
          <option key={`${node.props.fieldId}-${index}-${String(item.value)}`} value={String(item.value)}>
            {item.label}
          </option>
        ))}
      </select>
      {error ? <span className={getFieldErrorClassName()}>{error}</span> : null}
    </label>
  )
}
