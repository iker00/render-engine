import type { LayoutNode, LayoutNodeFeedbackFields, RuntimeVisibilityConfig } from '../config/runtime-config'
import type { RuntimeVisibilityCondition } from '../config/runtime-config-types'
import { isVisibilityGroup } from '../config/runtime-config-types'
import type { RuntimeIterationContext } from './runtime-references/runtime-reference-resolver'
import { resolveRuntimeReference } from './runtime-references/runtime-reference-resolver'
import type { RuntimeState } from './runtime-state/runtime-state-types'
import { resolveLayoutNodeFeedback } from './runtime-query-state-feedback'
import type { RuntimeQueryVisibleState } from './runtime-query-state-feedback'

export type ResolvedLayoutNodeVisibility =
  | {
      mode: 'show'
    }
  | {
      mode: 'hide'
    }
  | {
      mode: 'fallback'
      fallback: readonly LayoutNode[]
      visibleState: RuntimeQueryVisibleState
    }

export function resolveLayoutNodeVisibility(
  feedbackFields: Pick<LayoutNodeFeedbackFields, 'queryStateFeedback' | 'visibility'>,
  state: RuntimeState,
  iterationContext?: RuntimeIterationContext,
): ResolvedLayoutNodeVisibility {
  const resolvedFeedback = resolveLayoutNodeFeedback(feedbackFields.queryStateFeedback, state)

  if (resolvedFeedback?.mode === 'hide') {
    return {
      mode: 'hide',
    }
  }

  if (resolvedFeedback?.mode === 'fallback') {
    return {
      mode: 'fallback',
      fallback: resolvedFeedback.fallback,
      visibleState: resolvedFeedback.visibleState,
    }
  }

  if (!matchesVisibilityRule(feedbackFields.visibility, state, iterationContext)) {
    return {
      mode: 'hide',
    }
  }

  return {
    mode: 'show',
  }
}

export function isLayoutNodeVisible(
  feedbackFields: Pick<LayoutNodeFeedbackFields, 'queryStateFeedback' | 'visibility'>,
  state: RuntimeState,
  iterationContext?: RuntimeIterationContext,
) {
  return resolveLayoutNodeVisibility(feedbackFields, state, iterationContext).mode === 'show'
}

export function matchesVisibilityRule(
  visibility: RuntimeVisibilityConfig | undefined,
  state: RuntimeState,
  iterationContext?: RuntimeIterationContext,
) {
  if (!visibility) {
    return true
  }

  if (isVisibilityGroup(visibility)) {
    if (visibility.operator === 'and') {
      return visibility.conditions.every((condition) => evaluateCondition(condition, state, iterationContext))
    }

    return visibility.conditions.some((condition) => evaluateCondition(condition, state, iterationContext))
  }

  return evaluateCondition(visibility, state, iterationContext)
}

function evaluateCondition(
  condition: RuntimeVisibilityCondition,
  state: RuntimeState,
  iterationContext: RuntimeIterationContext | undefined,
) {
  const result = evaluateConditionMatch(condition, state, iterationContext)
  return condition.negate ? !result : result
}

function evaluateConditionMatch(
  condition: RuntimeVisibilityCondition,
  state: RuntimeState,
  iterationContext: RuntimeIterationContext | undefined,
) {
  const resolvedReference = resolveRuntimeReference(condition.reference, state, { iterationContext })

  if (condition.operator === 'isTruthy') {
    return resolvedReference.status === 'resolved' && isTruthyValue(resolvedReference.value)
  }

  if (condition.operator === 'isFalsy') {
    return resolvedReference.status !== 'resolved' || !isTruthyValue(resolvedReference.value)
  }

  if (condition.operator === 'arrayContains') {
    if (resolvedReference.status !== 'resolved' || !Array.isArray(resolvedReference.value)) {
      return false
    }

    return arrayContainsMatch(resolvedReference.value, condition)
  }

  if (resolvedReference.status !== 'resolved') {
    return false
  }

  if (condition.operator === 'equals') {
    return Object.is(resolvedReference.value, condition.value)
  }

  if (condition.operator === 'notEquals') {
    return !Object.is(resolvedReference.value, condition.value)
  }

  const comparableValue = normalizeComparableValue(resolvedReference.value)

  if (comparableValue === null || typeof condition.value !== 'number') {
    return false
  }

  if (condition.operator === 'greaterThan') {
    return comparableValue > condition.value
  }

  return comparableValue < condition.value
}

const ARRAY_ITEM_FIELD_NOT_FOUND = Symbol('array-item-field-not-found')

function arrayContainsMatch(value: unknown[], condition: RuntimeVisibilityCondition) {
  if (!condition.itemField) {
    return value.some((element) => Object.is(element, condition.value))
  }

  const segments = condition.itemField.split('.')

  return value.some((element) => {
    if (typeof element !== 'object' || element === null || Array.isArray(element)) {
      return false
    }

    const resolvedValue = resolveArrayItemFieldValue(element as Record<string, unknown>, segments)
    return resolvedValue !== ARRAY_ITEM_FIELD_NOT_FOUND && Object.is(resolvedValue, condition.value)
  })
}

function resolveArrayItemFieldValue(element: Record<string, unknown>, segments: readonly string[]) {
  let current: unknown = element

  for (const segment of segments) {
    if (segment === '' || typeof current !== 'object' || current === null || Array.isArray(current)) {
      return ARRAY_ITEM_FIELD_NOT_FOUND
    }

    const record = current as Record<string, unknown>

    if (!(segment in record)) {
      return ARRAY_ITEM_FIELD_NOT_FOUND
    }

    current = record[segment]
  }

  return current
}

function normalizeComparableValue(value: unknown) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }

  if (Array.isArray(value)) {
    return value.length
  }

  return null
}

function isTruthyValue(value: unknown) {
  return Boolean(value)
}
