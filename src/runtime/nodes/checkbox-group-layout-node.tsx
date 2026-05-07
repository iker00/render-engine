import type { CheckboxGroupLayoutNode } from '../../config/runtime-config'
import { useOptionalFormContext } from '../form-context'
import { resolveFieldDefaultValue } from './form-layout-node'
import { normalizeChoiceFieldValue, resolveChoiceCollectionItems } from '../runtime-collection-sources'
import {
  getFieldErrorClassName,
  getFieldLabelClassName,
  getFieldWrapperClassName,
} from '../runtime-node-styling'
import { useRuntimeState, useRuntimeStateActions } from '../runtime-state/runtime-state-provider'
import { selectFormFieldState } from '../runtime-state/runtime-state-selectors'

interface CheckboxGroupNodeProps {
  node: CheckboxGroupLayoutNode
}

export function CheckboxGroupNode({ node }: CheckboxGroupNodeProps) {
  const formContext = useOptionalFormContext()
  const state = useRuntimeState()
  const { setFormFieldError, setFormFieldValue } = useRuntimeStateActions()

  if (!formContext) {
    return null
  }

  const fieldState = selectFormFieldState(state, formContext.formId, node.props.fieldId)
  const defaultValue = resolveFieldDefaultValue(node, state)
  const items = resolveChoiceCollectionItems(node.props.items, state, 'checkboxGroup.props.items')
  const value = normalizeChoiceFieldValue(node.props.items, state, fieldState?.value ?? defaultValue, {
    multiple: true,
    surface: 'checkboxGroup.props.items',
  })
  const selectedValues = new Set(value)
  const error = fieldState?.error ?? null

  return (
    <fieldset className={getFieldWrapperClassName()} data-layout-node="checkbox-group">
      <legend className={getFieldLabelClassName()}>{node.props.label}</legend>
      {items.map((item, index) => (
        <label key={`${node.props.fieldId}-${index}-${item.value}`} className="flex items-center gap-2 text-sm text-slate-100">
          <input
            type="checkbox"
            value={item.value}
            checked={selectedValues.has(item.value)}
            onChange={(event) => {
              const nextUncheckedValues = event.currentTarget.checked
                ? [...value, item.value]
                : value.filter((entry) => entry !== item.value)
              const nextValue = normalizeChoiceFieldValue(node.props.items, state, nextUncheckedValues, {
                multiple: true,
                surface: 'checkboxGroup.props.items',
              })

              setFormFieldValue(formContext.formId, node.props.fieldId, nextValue)

              if (error && nextValue.length > 0) {
                setFormFieldError(formContext.formId, node.props.fieldId, null)
              }
            }}
          />
          <span>{item.label}</span>
        </label>
      ))}
      {error ? <span className={getFieldErrorClassName()}>{error}</span> : null}
    </fieldset>
  )
}
