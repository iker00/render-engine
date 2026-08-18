import { describe, expect, it } from 'vitest'
import type { QueryStateFeedbackConfig } from '../../config/runtime-config'
import {
  QUERY_STATE_FEEDBACK_STATE_ORDER,
  addQueryStateFeedbackStateRow,
  buildInitialQueryStateFeedbackFallbackCache,
  getAvailableQueryStateFeedbackStatesToAdd,
  getDefaultQueryStateFeedbackRule,
  getPresentQueryStateFeedbackStates,
  removeQueryStateFeedbackStateRow,
  setQueryStateFeedbackStateRuleMode,
} from '../../dev-runtime/layout-canvas/property-fields/query-state-feedback-accordion-state'

type States = QueryStateFeedbackConfig['states']

describe('QUERY_STATE_FEEDBACK_STATE_ORDER', () => {
  it('has the fixed catalog order', () => {
    expect(QUERY_STATE_FEEDBACK_STATE_ORDER).toEqual(['idle', 'loading', 'error', 'empty', 'success'])
  })
})

describe('getDefaultQueryStateFeedbackRule (reexported)', () => {
  it('returns show for success', () => {
    expect(getDefaultQueryStateFeedbackRule('success')).toEqual({ mode: 'show' })
  })

  it.each(['idle', 'loading', 'error', 'empty'] as const)('returns hide for %s', (state) => {
    expect(getDefaultQueryStateFeedbackRule(state)).toEqual({ mode: 'hide' })
  })
})

describe('getPresentQueryStateFeedbackStates', () => {
  it('returns an empty array for undefined', () => {
    expect(getPresentQueryStateFeedbackStates(undefined)).toEqual([])
  })

  it('returns an empty array for an empty object', () => {
    expect(getPresentQueryStateFeedbackStates({})).toEqual([])
  })

  it('orders present keys by the fixed catalog order regardless of declaration order', () => {
    const states = {
      success: { mode: 'show' },
      idle: { mode: 'hide' },
    } as States
    expect(getPresentQueryStateFeedbackStates(states)).toEqual(['idle', 'success'])
  })

  it('ignores keys outside the closed catalog without throwing', () => {
    const states = {
      idle: { mode: 'hide' },
      bogus: { mode: 'hide' },
    } as unknown as States
    expect(getPresentQueryStateFeedbackStates(states)).toEqual(['idle'])
  })

  it.each([null, ['idle']])('returns an empty array without throwing when states is not a plain object (%j)', (value) => {
    expect(getPresentQueryStateFeedbackStates(value as unknown as States)).toEqual([])
  })
})

describe('getAvailableQueryStateFeedbackStatesToAdd', () => {
  it('returns all five states in the fixed order for undefined', () => {
    expect(getAvailableQueryStateFeedbackStatesToAdd(undefined)).toEqual([
      'idle',
      'loading',
      'error',
      'empty',
      'success',
    ])
  })

  it('returns an empty array when all five states are present', () => {
    const states = {
      idle: { mode: 'hide' },
      loading: { mode: 'hide' },
      error: { mode: 'hide' },
      empty: { mode: 'hide' },
      success: { mode: 'show' },
    } as States
    expect(getAvailableQueryStateFeedbackStatesToAdd(states)).toEqual([])
  })

  it('returns the complement in the fixed order for a subset', () => {
    const states = {
      success: { mode: 'show' },
      idle: { mode: 'hide' },
    } as States
    expect(getAvailableQueryStateFeedbackStatesToAdd(states)).toEqual(['loading', 'error', 'empty'])
  })
})

describe('addQueryStateFeedbackStateRow', () => {
  it('adds error to undefined states using the default rule', () => {
    expect(addQueryStateFeedbackStateRow(undefined, 'error')).toEqual({ error: { mode: 'hide' } })
  })

  it('adds success to an existing states object without mutating it', () => {
    const existing = { idle: { mode: 'hide' } } as States
    const result = addQueryStateFeedbackStateRow(existing, 'success')

    expect(result).toEqual({ idle: { mode: 'hide' }, success: { mode: 'show' } })
    expect(existing).toEqual({ idle: { mode: 'hide' } })
  })
})

describe('removeQueryStateFeedbackStateRow', () => {
  it('returns undefined when removing the only present key', () => {
    const states = { idle: { mode: 'hide' } } as States
    expect(removeQueryStateFeedbackStateRow(states, 'idle')).toBeUndefined()
  })

  it('returns the rest without mutating the received object when removing one of several keys', () => {
    const states = { idle: { mode: 'hide' }, success: { mode: 'show' } } as States
    const result = removeQueryStateFeedbackStateRow(states, 'idle')

    expect(result).toEqual({ success: { mode: 'show' } })
    expect(states).toEqual({ idle: { mode: 'hide' }, success: { mode: 'show' } })
  })

  it('returns an equivalent object without throwing when removing a key not present', () => {
    const states = { idle: { mode: 'hide' } } as States
    expect(removeQueryStateFeedbackStateRow(states, 'success')).toEqual({ idle: { mode: 'hide' } })
  })
})

describe('setQueryStateFeedbackStateRuleMode', () => {
  it('produces exactly { mode: "show" } from any previous mode, including fallback with a previous fallback', () => {
    const states = { error: { mode: 'fallback', fallback: [{ type: 'text' }] } } as States
    const result = setQueryStateFeedbackStateRuleMode(states, 'error', 'show', undefined)
    expect(result?.error).toEqual({ mode: 'show' })
  })

  it('produces exactly { mode: "hide" } from any previous mode, including fallback with a previous fallback', () => {
    const states = { error: { mode: 'fallback', fallback: [{ type: 'text' }] } } as States
    const result = setQueryStateFeedbackStateRuleMode(states, 'error', 'hide', undefined)
    expect(result?.error).toEqual({ mode: 'hide' })
  })

  it('produces { mode: "fallback", fallback: [] } when there is no previous fallback rule and no cachedFallback', () => {
    const states = { error: { mode: 'hide' } } as States
    const result = setQueryStateFeedbackStateRuleMode(states, 'error', 'fallback', undefined)
    expect(result?.error).toEqual({ mode: 'fallback', fallback: [] })
  })

  it('uses the same cachedFallback array (not a copy) when there is no previous fallback rule', () => {
    const states = { error: { mode: 'hide' } } as States
    const cachedFallback: unknown[] = [{ type: 'text' }]
    const result = setQueryStateFeedbackStateRuleMode(states, 'error', 'fallback', cachedFallback)

    expect(result?.error).toEqual({ mode: 'fallback', fallback: cachedFallback })
    expect((result?.error as { fallback: unknown[] }).fallback).toBe(cachedFallback)
  })

  it('keeps the current fallback rule fallback array over a different cachedFallback', () => {
    const currentFallback = [{ type: 'text', id: 'current' }]
    const states = { error: { mode: 'fallback', fallback: currentFallback } } as States
    const otherCachedFallback: unknown[] = [{ type: 'text', id: 'other' }]
    const result = setQueryStateFeedbackStateRuleMode(states, 'error', 'fallback', otherCachedFallback)

    expect((result?.error as { fallback: unknown[] }).fallback).toBe(currentFallback)
  })

  it('does not touch any other key of states when changing one row mode', () => {
    const states = {
      idle: { mode: 'hide' },
      error: { mode: 'hide' },
    } as States
    const result = setQueryStateFeedbackStateRuleMode(states, 'error', 'show', undefined)

    expect(result?.idle).toEqual({ mode: 'hide' })
  })
})

describe('buildInitialQueryStateFeedbackFallbackCache', () => {
  it('returns an empty object for undefined', () => {
    expect(buildInitialQueryStateFeedbackFallbackCache(undefined)).toEqual({})
  })

  it('returns an empty object when no row is in fallback mode', () => {
    const states = { idle: { mode: 'hide' }, success: { mode: 'show' } } as States
    expect(buildInitialQueryStateFeedbackFallbackCache(states)).toEqual({})
  })

  it('returns one entry per fallback row with its fallback array as-is', () => {
    const errorFallback = [{ type: 'text', id: 'error-fallback' }]
    const emptyFallback = [{ type: 'text', id: 'empty-fallback' }]
    const states = {
      idle: { mode: 'hide' },
      error: { mode: 'fallback', fallback: errorFallback },
      empty: { mode: 'fallback', fallback: emptyFallback },
    } as States
    const cache = buildInitialQueryStateFeedbackFallbackCache(states)

    expect(cache).toEqual({ error: errorFallback, empty: emptyFallback })
    expect(cache.error).toBe(errorFallback)
    expect(cache.empty).toBe(emptyFallback)
  })

  it('does not generate an entry for a show/hide row even with a residual out-of-contract fallback property', () => {
    const states = {
      idle: { mode: 'hide', fallback: [{ type: 'text' }] },
    } as unknown as States
    expect(buildInitialQueryStateFeedbackFallbackCache(states)).toEqual({})
  })
})
