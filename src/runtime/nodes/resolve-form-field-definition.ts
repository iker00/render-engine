import type {
  CheckboxGroupLayoutNode,
  InputLayoutNode,
  LayoutNode,
  RadioGroupLayoutNode,
  SelectLayoutNode,
  TextareaLayoutNode,
  ToggleLayoutNode,
} from '../../config/runtime-config'
import { normalizeChoiceFieldValue } from '../runtime-collection-sources'
import type { RuntimeIterationContext } from '../runtime-references/runtime-reference-resolver'
import { resolveRuntimeValueWithOptions } from '../runtime-references/runtime-reference-resolver'
import type { ResolvedFormFieldDefinition } from '../runtime-form-validations'
import type { useRuntimeState } from '../runtime-state/use-runtime-state'

// Non-component helpers shared by the choice/toggle field nodes (select, radioGroup,
// checkboxGroup, input, textarea, toggle) and by FormNode's own field-collection pass. Kept in
// their own module (rather than alongside the `FormNode` component) so this file only exports
// non-component values — Fast Refresh requires component-only modules to preserve state across
// edits, and `getChoiceFieldSurface` is also consumed directly by `form-layout-node.tsx`.

export function resolveToggleFieldDefinition(
  node: ToggleLayoutNode,
  state: ReturnType<typeof useRuntimeState>,
  iterationContext?: RuntimeIterationContext,
): ResolvedFormFieldDefinition {
  const resolvedValue = resolveRuntimeValueWithOptions(node.props.defaultValue, state, { iterationContext })
  const defaultValue =
    resolvedValue.status === 'resolved' && typeof resolvedValue.value === 'boolean'
      ? resolvedValue.value
      : false

  return {
    fieldId: node.props.fieldId,
    type: 'toggle',
    validations: node.props.validations,
    queryStateFeedback: node.queryStateFeedback,
    visibility: node.visibility,
    multiple: false,
    defaultValue,
  }
}

export function resolveResolvedFormFieldDefinition(
  node: InputLayoutNode | TextareaLayoutNode | SelectLayoutNode | RadioGroupLayoutNode | CheckboxGroupLayoutNode,
  state: ReturnType<typeof useRuntimeState>,
  iterationContext?: RuntimeIterationContext,
): ResolvedFormFieldDefinition {
  return {
    fieldId: node.props.fieldId,
    type: node.type,
    validations: node.props.validations,
    queryStateFeedback: node.queryStateFeedback,
    visibility: node.visibility,
    items: isChoiceFieldNode(node) ? node.props.items : undefined,
    multiple: isMultipleChoiceFieldNode(node),
    defaultValue: resolveFieldDefaultValue(node, state, iterationContext),
    inputType: node.type === 'input' ? node.props.inputType : undefined,
  }
}

function resolveFieldDefaultValue(
  node: InputLayoutNode | TextareaLayoutNode | SelectLayoutNode | RadioGroupLayoutNode | CheckboxGroupLayoutNode,
  state: ReturnType<typeof useRuntimeState>,
  iterationContext?: RuntimeIterationContext,
) {
  const resolvedValue = resolveRuntimeValueWithOptions(node.props.defaultValue, state, { iterationContext })
  const fallbackValue = isMultipleChoiceFieldNode(node) ? [] : ''

  if (resolvedValue.status !== 'resolved') {
    return fallbackValue
  }

  if (isChoiceFieldNode(node)) {
    return normalizeChoiceFieldValue(node.props.items, state, resolvedValue.value, {
      multiple: isMultipleChoiceFieldNode(node),
      surface: getChoiceFieldSurface(node.type),
      iterationContext,
    })
  }

  if (typeof resolvedValue.value === 'string') {
    return resolvedValue.value
  }

  if (node.type === 'input' && typeof resolvedValue.value === 'number') {
    return String(resolvedValue.value)
  }

  return fallbackValue
}

function isChoiceFieldNode(
  node: LayoutNode,
): node is SelectLayoutNode | RadioGroupLayoutNode | CheckboxGroupLayoutNode {
  return node.type === 'select' || node.type === 'radioGroup' || node.type === 'checkboxGroup'
}

function isMultipleChoiceFieldNode(
  node:
    | Pick<ResolvedFormFieldDefinition, 'type' | 'multiple'>
    | InputLayoutNode
    | TextareaLayoutNode
    | SelectLayoutNode
    | CheckboxGroupLayoutNode
    | RadioGroupLayoutNode,
) {
  if ('multiple' in node && typeof node.multiple === 'boolean') {
    return node.multiple
  }

  return node.type === 'checkboxGroup' || (node.type === 'select' && 'props' in node && node.props.multiple === true)
}

export function getChoiceFieldSurface(type: ResolvedFormFieldDefinition['type']) {
  if (type === 'radioGroup') {
    return 'radioGroup.props.items' as const
  }

  if (type === 'checkboxGroup') {
    return 'checkboxGroup.props.items' as const
  }

  return 'select.props.items' as const
}
