import type { FileInputLayoutNode, LayoutNodeCollection } from '../../config/runtime-config'
import { isLayoutNodeVisible, matchesVisibilityRule } from '../runtime-layout-visibility'
import type { RuntimeIterationContext } from '../runtime-references/runtime-reference-resolver'
import { resolveRuntimeValueWithOptions } from '../runtime-references/runtime-reference-resolver'
import { type ResolvedFormFieldDefinition } from '../runtime-form-validations'
import type { RuntimeState } from '../runtime-state/runtime-state-types'
import {
  resolveAutocompleteFieldDefinition,
  resolveResolvedFormFieldDefinition,
  resolveToggleFieldDefinition,
} from './resolve-form-field-definition'

export function collectResolvedFormFieldDefinitions(
  nodes: LayoutNodeCollection,
  state: RuntimeState,
  iterationContext?: RuntimeIterationContext,
): ResolvedFormFieldDefinition[] {
  const fields: ResolvedFormFieldDefinition[] = []

  for (const node of nodes) {
    if (!isLayoutNodeVisible(node, state, iterationContext)) {
      continue
    }

    if (node.type === 'container') {
      fields.push(...collectResolvedFormFieldDefinitions(node.children ?? [], state, iterationContext))
      continue
    }

    if (node.type === 'repeater') {
      fields.push(...collectResolvedFormFieldDefinitions(node.props.template, state, iterationContext))
      continue
    }

    if (node.type === 'tabs') {
      for (const item of node.props.items) {
        if (!matchesVisibilityRule(item.visibility, state, iterationContext)) {
          continue
        }
        fields.push(...collectResolvedFormFieldDefinitions(item.children ?? [], state, iterationContext))
      }
      continue
    }

    if (node.type === 'steps') {
      node.props.items.forEach((item, itemIndex) => {
        if (!matchesVisibilityRule(item.visibility, state, iterationContext)) {
          return
        }
        const itemFields = collectResolvedFormFieldDefinitions(item.children ?? [], state, iterationContext)
        for (const field of itemFields) {
          field.stepGroup = { nodeId: node.id ?? '', itemIndex }
        }
        fields.push(...itemFields)
      })
      continue
    }

    if (
      node.type === 'input' ||
      node.type === 'textarea' ||
      node.type === 'select' ||
      node.type === 'radioGroup' ||
      node.type === 'checkboxGroup'
    ) {
      fields.push(resolveResolvedFormFieldDefinition(node, state, iterationContext))
    }

    if (node.type === 'fileInput') {
      fields.push(resolveFileInputFieldDefinition(node))
    }

    if (node.type === 'toggle') {
      fields.push(resolveToggleFieldDefinition(node, state, iterationContext))
    }

    if (node.type === 'autocomplete') {
      fields.push(resolveAutocompleteFieldDefinition(node, state, iterationContext))
    }
  }

  return fields
}

function resolveFileInputFieldDefinition(node: FileInputLayoutNode): ResolvedFormFieldDefinition {
  return {
    fieldId: node.props.fieldId,
    type: 'fileInput',
    fileValidations: node.props.validations,
    queryStateFeedback: node.queryStateFeedback,
    visibility: node.visibility,
    multiple: node.props.multiple ?? true,
    defaultValue: [],
  }
}

/**
 * Collects all field IDs in a form tree regardless of node visibility.
 * Used by handleSubmit to compute the set of hidden fieldIds at submit time.
 */
export function collectAllFormFieldIds(nodes: LayoutNodeCollection): string[] {
  const fieldIds: string[] = []

  for (const node of nodes) {
    if (node.type === 'container') {
      fieldIds.push(...collectAllFormFieldIds(node.children ?? []))
      continue
    }

    if (node.type === 'repeater') {
      fieldIds.push(...collectAllFormFieldIds(node.props.template))
      continue
    }

    if (node.type === 'tabs') {
      for (const item of node.props.items) {
        fieldIds.push(...collectAllFormFieldIds(item.children ?? []))
      }
      continue
    }

    if (node.type === 'steps') {
      for (const item of node.props.items) {
        fieldIds.push(...collectAllFormFieldIds(item.children ?? []))
      }
      continue
    }

    if (
      node.type === 'input' ||
      node.type === 'textarea' ||
      node.type === 'select' ||
      node.type === 'radioGroup' ||
      node.type === 'checkboxGroup' ||
      node.type === 'fileInput' ||
      node.type === 'toggle' ||
      node.type === 'hidden' ||
      node.type === 'autocomplete'
    ) {
      fieldIds.push(node.props.fieldId)
    }
  }

  return fieldIds
}

/**
 * Walks the form subtree ignoring parent visibility and collects hidden-type
 * nodes with their resolved values. Used to initialize hidden fields at form
 * mount independently of whether ancestor containers are visible.
 */
export function collectHiddenFieldDefinitions(
  nodes: LayoutNodeCollection,
  state: RuntimeState,
  iterationContext?: RuntimeIterationContext,
): Array<{ fieldId: string; value: unknown }> {
  const fields: Array<{ fieldId: string; value: unknown }> = []

  for (const node of nodes) {
    if (node.type === 'container') {
      fields.push(...collectHiddenFieldDefinitions(node.children ?? [], state, iterationContext))
      continue
    }

    if (node.type === 'repeater') {
      fields.push(...collectHiddenFieldDefinitions(node.props.template, state, iterationContext))
      continue
    }

    if (node.type === 'tabs') {
      for (const item of node.props.items) {
        fields.push(...collectHiddenFieldDefinitions(item.children ?? [], state, iterationContext))
      }
      continue
    }

    if (node.type === 'steps') {
      for (const item of node.props.items) {
        fields.push(...collectHiddenFieldDefinitions(item.children ?? [], state, iterationContext))
      }
      continue
    }

    if (node.type === 'hidden') {
      const resolvedValue = resolveRuntimeValueWithOptions(node.props.value, state, { iterationContext })
      const value = resolvedValue.status === 'resolved' ? resolvedValue.value : node.props.value
      fields.push({ fieldId: node.props.fieldId, value })
    }
  }

  return fields
}

/**
 * Collects the field IDs of all hidden-type nodes in the form subtree.
 * These IDs must never be included in the "hidden fields" set that causes
 * payload omission at submit time.
 */
export function collectHiddenNodeFieldIds(nodes: LayoutNodeCollection): Set<string> {
  const fieldIds = new Set<string>()

  for (const node of nodes) {
    if (node.type === 'container') {
      for (const id of collectHiddenNodeFieldIds(node.children ?? [])) {
        fieldIds.add(id)
      }
      continue
    }

    if (node.type === 'repeater') {
      for (const id of collectHiddenNodeFieldIds(node.props.template)) {
        fieldIds.add(id)
      }
      continue
    }

    if (node.type === 'tabs') {
      for (const item of node.props.items) {
        for (const id of collectHiddenNodeFieldIds(item.children ?? [])) {
          fieldIds.add(id)
        }
      }
      continue
    }

    if (node.type === 'steps') {
      for (const item of node.props.items) {
        for (const id of collectHiddenNodeFieldIds(item.children ?? [])) {
          fieldIds.add(id)
        }
      }
      continue
    }

    if (node.type === 'hidden') {
      fieldIds.add(node.props.fieldId)
    }
  }

  return fieldIds
}

/**
 * Collects the configured `emptySubmitValue` for every simple-selection
 * `select` field in the form subtree, keyed by fieldId.
 */
export function collectSelectEmptySubmitValues(nodes: LayoutNodeCollection): Map<string, string | number> {
  const valuesByFieldId = new Map<string, string | number>()

  for (const node of nodes) {
    if (node.type === 'container') {
      for (const [id, value] of collectSelectEmptySubmitValues(node.children ?? [])) {
        valuesByFieldId.set(id, value)
      }
      continue
    }

    if (node.type === 'repeater') {
      for (const [id, value] of collectSelectEmptySubmitValues(node.props.template)) {
        valuesByFieldId.set(id, value)
      }
      continue
    }

    if (node.type === 'tabs') {
      for (const item of node.props.items) {
        for (const [id, value] of collectSelectEmptySubmitValues(item.children ?? [])) {
          valuesByFieldId.set(id, value)
        }
      }
      continue
    }

    if (node.type === 'steps') {
      for (const item of node.props.items) {
        for (const [id, value] of collectSelectEmptySubmitValues(item.children ?? [])) {
          valuesByFieldId.set(id, value)
        }
      }
      continue
    }

    if (node.type === 'select' && node.props.multiple !== true && node.props.emptySubmitValue !== undefined) {
      valuesByFieldId.set(node.props.fieldId, node.props.emptySubmitValue)
    }
  }

  return valuesByFieldId
}
