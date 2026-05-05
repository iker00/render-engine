import type {
  LayoutNodeFeedbackFields,
  LayoutNode,
  QueryStateFeedbackConfig,
  QueryStateFeedbackRule,
  QueryStateFeedbackVisibleState,
} from '../config/runtime-config'
import type { RuntimeQueryState, RuntimeState } from './runtime-state/runtime-state-types'
import { selectQueryState } from './runtime-state/runtime-state-selectors'

export type RuntimeQueryVisibleState = QueryStateFeedbackVisibleState

export type ResolvedQueryStateFeedback =
  | {
      visibleState: RuntimeQueryVisibleState
      mode: 'show' | 'hide'
    }
  | {
      visibleState: RuntimeQueryVisibleState
      mode: 'fallback'
      fallback: readonly LayoutNode[]
    }

export function deriveQueryVisibleState(queryState: RuntimeQueryState | null): RuntimeQueryVisibleState {
  if (queryState === null || queryState.status === 'idle') {
    return 'idle'
  }

  if (queryState.status === 'loading') {
    return 'loading'
  }

  if (queryState.status === 'error') {
    return 'error'
  }

  return isEmptyQueryData(queryState.data) ? 'empty' : 'success'
}

export function resolveQueryStateFeedback(
  feedback: QueryStateFeedbackConfig,
  queryState: RuntimeQueryState | null,
): ResolvedQueryStateFeedback {
  const visibleState = deriveQueryVisibleState(queryState)
  const explicitRule = feedback.states?.[visibleState]
  const effectiveRule = explicitRule ?? getDefaultQueryStateFeedbackRule(visibleState)

  if (effectiveRule.mode === 'fallback') {
    return {
      visibleState,
      mode: 'fallback',
      fallback: effectiveRule.fallback,
    }
  }

  return {
    visibleState,
    mode: effectiveRule.mode,
  }
}

export function resolveLayoutNodeFeedback(
  feedback: LayoutNodeFeedbackFields['queryStateFeedback'],
  state: RuntimeState,
): ResolvedQueryStateFeedback | null {
  if (!feedback) {
    return null
  }

  return resolveQueryStateFeedback(feedback, selectQueryState(state, feedback.query))
}

export function isLayoutNodeVisible(
  feedback: LayoutNodeFeedbackFields['queryStateFeedback'],
  state: RuntimeState,
) {
  const resolvedFeedback = resolveLayoutNodeFeedback(feedback, state)

  if (!resolvedFeedback) {
    return true
  }

  return resolvedFeedback.mode === 'show'
}

function getDefaultQueryStateFeedbackRule(visibleState: RuntimeQueryVisibleState): Exclude<QueryStateFeedbackRule, { mode: 'fallback' }> {
  if (visibleState === 'success') {
    return {
      mode: 'show',
    } as const
  }

  return {
    mode: 'hide',
  } as const
}

function isEmptyQueryData(value: unknown): boolean {
  if (value == null) {
    return true
  }

  if (typeof value === 'string') {
    return value.length === 0
  }

  if (Array.isArray(value)) {
    return value.length === 0
  }

  if (typeof value === 'object') {
    return Object.keys(value).length === 0
  }

  return false
}
