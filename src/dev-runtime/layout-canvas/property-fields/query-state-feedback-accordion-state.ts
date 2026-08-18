import type {
  QueryStateFeedbackConfig,
  QueryStateFeedbackRule,
  QueryStateFeedbackVisibleState,
} from '../../../config/runtime-config'
import { getDefaultQueryStateFeedbackRule } from '../../../runtime/runtime-query-state-feedback'

export { getDefaultQueryStateFeedbackRule }

type QueryStateFeedbackStates = QueryStateFeedbackConfig['states']

export const QUERY_STATE_FEEDBACK_STATE_ORDER: readonly QueryStateFeedbackVisibleState[] = [
  'idle',
  'loading',
  'error',
  'empty',
  'success',
]

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function getPresentQueryStateFeedbackStates(
  states: QueryStateFeedbackStates,
): QueryStateFeedbackVisibleState[] {
  if (!isPlainObject(states)) {
    return []
  }

  return QUERY_STATE_FEEDBACK_STATE_ORDER.filter((state) => state in states)
}

export function getAvailableQueryStateFeedbackStatesToAdd(
  states: QueryStateFeedbackStates,
): QueryStateFeedbackVisibleState[] {
  const present = new Set(getPresentQueryStateFeedbackStates(states))
  return QUERY_STATE_FEEDBACK_STATE_ORDER.filter((state) => !present.has(state))
}

export function addQueryStateFeedbackStateRow(
  states: QueryStateFeedbackStates,
  state: QueryStateFeedbackVisibleState,
): QueryStateFeedbackStates {
  const base = isPlainObject(states) ? (states as NonNullable<QueryStateFeedbackStates>) : {}

  return {
    ...base,
    [state]: getDefaultQueryStateFeedbackRule(state),
  }
}

export function removeQueryStateFeedbackStateRow(
  states: QueryStateFeedbackStates,
  state: QueryStateFeedbackVisibleState,
): QueryStateFeedbackStates {
  const base = isPlainObject(states) ? (states as NonNullable<QueryStateFeedbackStates>) : {}
  const next = { ...base }
  delete next[state]

  return Object.keys(next).length === 0 ? undefined : next
}

export function setQueryStateFeedbackStateRuleMode(
  states: QueryStateFeedbackStates,
  state: QueryStateFeedbackVisibleState,
  nextMode: QueryStateFeedbackRule['mode'],
  cachedFallback: unknown[] | undefined,
): QueryStateFeedbackStates {
  const base = isPlainObject(states) ? (states as NonNullable<QueryStateFeedbackStates>) : {}
  const currentRule = base[state]

  const nextRule: QueryStateFeedbackRule =
    nextMode === 'fallback'
      ? // Config `fallback` values (LayoutNode[]) are treated as opaque data here, same as the
        // rest of the panel widgets — this module only reshapes `states`, it never inspects the
        // fallback content, hence the cast from the caller's `unknown[]` cache.
        ({
          mode: 'fallback',
          fallback: currentRule?.mode === 'fallback' ? currentRule.fallback : (cachedFallback ?? []),
        } as QueryStateFeedbackRule)
      : { mode: nextMode }

  return {
    ...base,
    [state]: nextRule,
  }
}

export function buildInitialQueryStateFeedbackFallbackCache(
  states: QueryStateFeedbackStates,
): Partial<Record<QueryStateFeedbackVisibleState, unknown[]>> {
  const cache: Partial<Record<QueryStateFeedbackVisibleState, unknown[]>> = {}

  if (!isPlainObject(states)) {
    return cache
  }

  for (const state of getPresentQueryStateFeedbackStates(states)) {
    const rule = states[state]
    if (rule?.mode === 'fallback') {
      cache[state] = rule.fallback as unknown[]
    }
  }

  return cache
}
