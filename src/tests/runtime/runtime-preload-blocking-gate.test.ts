import { describe, expect, it } from 'vitest'
import type { RuntimePreloadConfig } from '../../config/runtime-config'
import type { RuntimeQueryState, RuntimeState } from '../../runtime/runtime-state/runtime-state-types'
import { deriveBlockingPreloadNames, isPreloadGateBlocked } from '../../runtime/runtime-global-preloads'

function buildPreload(overrides: Partial<RuntimePreloadConfig> & { operationName: string }): RuntimePreloadConfig {
  return { requestParams: {}, ...overrides }
}

function buildQueryState(
  status: RuntimeQueryState['status'],
  overrides: Partial<RuntimeQueryState> = {},
): RuntimeQueryState {
  return { status, data: null, error: null, requestSignature: null, ...overrides }
}

describe('deriveBlockingPreloadNames', () => {
  it('returns an empty array for an empty preload list', () => {
    expect(deriveBlockingPreloadNames([])).toEqual([])
  })

  it('returns an empty array when no entry is blocking', () => {
    const preloads = [
      buildPreload({ operationName: 'first', blocking: false }),
      buildPreload({ operationName: 'second' }),
    ]

    expect(deriveBlockingPreloadNames(preloads)).toEqual([])
  })

  it('returns only the operationName of blocking entries, preserving original order', () => {
    const preloads = [
      buildPreload({ operationName: 'first', blocking: true }),
      buildPreload({ operationName: 'second', blocking: false }),
      buildPreload({ operationName: 'third', blocking: true }),
    ]

    expect(deriveBlockingPreloadNames(preloads)).toEqual(['first', 'third'])
  })

  it('treats blocking: undefined and blocking: false as non-blocking', () => {
    const preloads = [
      buildPreload({ operationName: 'first', blocking: undefined }),
      buildPreload({ operationName: 'second', blocking: false }),
    ]

    expect(deriveBlockingPreloadNames(preloads)).toEqual([])
  })
})

describe('isPreloadGateBlocked', () => {
  it('returns false for an empty names list regardless of queries state', () => {
    const queries: RuntimeState['queries'] = { first: buildQueryState('loading') }

    expect(isPreloadGateBlocked([], queries)).toBe(false)
  })

  it('returns true when at least one named query is loading', () => {
    const queries: RuntimeState['queries'] = {
      first: buildQueryState('success'),
      second: buildQueryState('loading'),
    }

    expect(isPreloadGateBlocked(['first', 'second'], queries)).toBe(true)
  })

  it('returns false when all named queries are success', () => {
    const queries: RuntimeState['queries'] = {
      first: buildQueryState('success'),
      second: buildQueryState('success'),
    }

    expect(isPreloadGateBlocked(['first', 'second'], queries)).toBe(false)
  })

  it('returns false when all named queries are error', () => {
    const queries: RuntimeState['queries'] = {
      first: buildQueryState('error'),
      second: buildQueryState('error'),
    }

    expect(isPreloadGateBlocked(['first', 'second'], queries)).toBe(false)
  })

  it('returns false for a mix of success/error/idle without any loading', () => {
    const queries: RuntimeState['queries'] = {
      first: buildQueryState('success'),
      second: buildQueryState('error'),
      third: buildQueryState('idle'),
    }

    expect(isPreloadGateBlocked(['first', 'second', 'third'], queries)).toBe(false)
  })

  it('treats a name absent from queries as not loading', () => {
    const queries: RuntimeState['queries'] = {
      first: buildQueryState('success'),
    }

    expect(isPreloadGateBlocked(['first', 'missing'], queries)).toBe(false)
  })
})
