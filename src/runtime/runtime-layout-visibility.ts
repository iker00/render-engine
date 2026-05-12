import type { LayoutNode, LayoutNodeFeedbackFields, RuntimeVisibilityConfig } from '../config/runtime-config'
import type { RuntimeIterationContext } from './runtime-references/runtime-reference-resolver'
import { resolveRuntimeReference } from './runtime-references/runtime-reference-resolver'
import type { RuntimeState } from './runtime-state/runtime-state-types'
import { resolveLayoutNodeFeedback } from './runtime-query-state-feedback'

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

  const resolvedReference = resolveRuntimeReference(visibility.reference, state, { iterationContext })

  if (visibility.operator === 'isTruthy') {
    return resolvedReference.status === 'resolved' && isTruthyValue(resolvedReference.value)
  }

  if (visibility.operator === 'isFalsy') {
    return resolvedReference.status !== 'resolved' || !isTruthyValue(resolvedReference.value)
  }

  if (resolvedReference.status !== 'resolved') {
    return false
  }

  if (visibility.operator === 'equals') {
    return Object.is(resolvedReference.value, visibility.value)
  }

  if (visibility.operator === 'notEquals') {
    return !Object.is(resolvedReference.value, visibility.value)
  }

  const comparableValue = normalizeComparableValue(resolvedReference.value)

  if (comparableValue === null || visibility.value === undefined) {
    return false
  }

  if (visibility.operator === 'greaterThan') {
    return comparableValue > visibility.value
  }

  return comparableValue < visibility.value
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
