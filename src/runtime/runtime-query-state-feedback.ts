import type {
  QueryStateFeedbackConfig,
  QueryStateFeedbackRule,
  QueryStateFeedbackVisibleState,
} from '../config/runtime-config'
import type { RuntimeQueryState } from './runtime-state/runtime-state-types'

export type RuntimeQueryVisibleState = QueryStateFeedbackVisibleState

export type ResolvedQueryStateFeedback =
  | {
      visibleState: RuntimeQueryVisibleState
      mode: 'show' | 'hide'
    }
  | {
      visibleState: RuntimeQueryVisibleState
      mode: 'fallback'
      fallback: QueryStateFeedbackRule extends { mode: 'fallback'; fallback: infer T } ? T : never
    }

export function deriveQueryVisibleState(queryState: RuntimeQueryState | null): RuntimeQueryVisibleState {
  if (queryState === null || queryState.status === 'idle' || queryState.status === 'loading') {
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

function getDefaultQueryStateFeedbackRule(visibleState: RuntimeQueryVisibleState): QueryStateFeedbackRule {
  if (visibleState === 'success') {
    return {
      mode: 'show',
    }
  }

  return {
    mode: 'hide',
  }
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
