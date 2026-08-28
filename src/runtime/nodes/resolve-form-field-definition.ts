import type {
  AutocompleteLayoutNode,
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

// `autocomplete` deliberately resolves its own `defaultValue` outside `resolveResolvedFormFieldDefinition`
// (design.md, decisión 6): the dynamic shape (`queries.*`/`item.*`) must never clear a stored value that
// no longer appears among currently resolved suggestions, unlike select/radioGroup/checkboxGroup.
export function resolveAutocompleteFieldDefinition(
  node: AutocompleteLayoutNode,
  state: ReturnType<typeof useRuntimeState>,
  iterationContext?: RuntimeIterationContext,
): ResolvedFormFieldDefinition {
  const isMultiple = node.props.multiple === true
  const fallbackValue: '' | [] = isMultiple ? [] : ''
  const resolvedValue = resolveRuntimeValueWithOptions(node.props.defaultValue, state, { iterationContext })

  const defaultValue = (() => {
    if (resolvedValue.status !== 'resolved') {
      return fallbackValue
    }

    if (node.props.allowFreeText === true) {
      return coerceAutocompleteFieldShape(resolvedValue.value, isMultiple, fallbackValue)
    }

    const isStaticShape = Array.isArray(node.props.items) || 'values' in node.props.items

    if (isStaticShape) {
      return normalizeChoiceFieldValue(node.props.items, state, resolvedValue.value, {
        multiple: isMultiple,
        surface: 'autocomplete.props.items',
        iterationContext,
      })
    }

    // shape dinámico (queries.* o item.*) sin allowFreeText: nunca se limpia aunque el valor
    // no esté entre las sugerencias actualmente resueltas (design.md, decisión 6).
    return coerceAutocompleteFieldShape(resolvedValue.value, isMultiple, fallbackValue)
  })()

  return {
    fieldId: node.props.fieldId,
    type: 'autocomplete',
    validations: node.props.validations,
    queryStateFeedback: node.queryStateFeedback,
    visibility: node.visibility,
    items: undefined,
    multiple: isMultiple,
    defaultValue,
  }
}

function coerceAutocompleteFieldShape(value: unknown, isMultiple: boolean, fallbackValue: '' | []) {
  if (isMultiple) {
    return Array.isArray(value) && value.every((item) => typeof item === 'string' || typeof item === 'number')
      ? value.map(String)
      : fallbackValue
  }

  if (typeof value === 'string') {
    return value
  }

  if (typeof value === 'number') {
    return String(value)
  }

  return fallbackValue
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
