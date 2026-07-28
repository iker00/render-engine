import { describe, expect, it } from 'vitest'
import type { RuntimeApiRequestParams, RuntimeConfig, RuntimePageConfig } from '../../config/runtime-config'
import type { RuntimeQueryState, RuntimeState } from '../../runtime/runtime-state/runtime-state-types'
import { createRuntimeState } from '../../runtime/runtime-state/runtime-state-reducer'
import { buildRuntimeApiRequest } from '../../queries/runtime-api-executor'
import {
  arePageParamsEqual,
  arePreloadNamesEqual,
  createPlannedPreloadBatchSignature,
  createPreloadPlanningSnapshot,
  deriveAggregatePageEntryStatus,
  evaluatePreloadExecution,
  isMatchingPageEntryState,
  planPagePreloadExecution,
} from '../../runtime/runtime-global-preloads'

function buildQueryState(
  status: RuntimeQueryState['status'],
  overrides: Partial<RuntimeQueryState> = {},
): RuntimeQueryState {
  return { status, data: null, error: null, requestSignature: null, ...overrides }
}

describe('deriveAggregatePageEntryStatus', () => {
  it('returns loading when at least one named query is loading, even if another is in error', () => {
    const queries: RuntimeState['queries'] = {
      first: buildQueryState('loading'),
      second: buildQueryState('error'),
    }

    expect(deriveAggregatePageEntryStatus(['first', 'second'], queries)).toBe('loading')
  })

  it('returns error when none is loading and at least one is in error', () => {
    const queries: RuntimeState['queries'] = {
      first: buildQueryState('success'),
      second: buildQueryState('error'),
    }

    expect(deriveAggregatePageEntryStatus(['first', 'second'], queries)).toBe('error')
  })

  it('returns success when all named queries are success', () => {
    const queries: RuntimeState['queries'] = {
      first: buildQueryState('success'),
      second: buildQueryState('success'),
    }

    expect(deriveAggregatePageEntryStatus(['first', 'second'], queries)).toBe('success')
  })

  it('returns success when a preloadNames entry does not exist in state.queries', () => {
    const queries: RuntimeState['queries'] = {
      first: buildQueryState('success'),
    }

    expect(deriveAggregatePageEntryStatus(['first', 'missing'], queries)).toBe('success')
  })

  it('returns success with an empty preloadNames list', () => {
    const queries: RuntimeState['queries'] = {
      first: buildQueryState('error'),
    }

    expect(deriveAggregatePageEntryStatus([], queries)).toBe('success')
  })
})

describe('evaluatePreloadExecution (successful compose)', () => {
  const api = { getCatalog: { method: 'GET' as const, endpoint: '/api/catalog' } }
  const config: RuntimeConfig = { api, initialPage: 'home', pages: [{ id: 'home', layout: [] }] }
  const preload = { operationName: 'getCatalog', requestParams: {} as RuntimeApiRequestParams }
  const requestState = createRuntimeState(config)

  function composeExpectedSignature(requestParams: RuntimeApiRequestParams) {
    const result = buildRuntimeApiRequest({
      config,
      operationName: 'getCatalog',
      state: requestState,
      requestParams,
    })

    expect(result.status).toBe('ready')
    return result.status === 'ready' ? result.request.requestSignature : null
  }

  it('does not reload when the current requestSignature already matches the composed one', () => {
    const expectedSignature = composeExpectedSignature(preload.requestParams)
    const currentState: RuntimeState = {
      ...requestState,
      queries: { getCatalog: buildQueryState('success', { requestSignature: expectedSignature }) },
    }

    const evaluation = evaluatePreloadExecution({ config, preload, requestState, currentState })

    expect(evaluation.shouldReload).toBe(false)
    expect(evaluation.requestSignature).toBe(expectedSignature)
  })

  it('reloads when the current requestSignature differs from the composed one', () => {
    const currentState: RuntimeState = {
      ...requestState,
      queries: { getCatalog: buildQueryState('success', { requestSignature: 'stale-signature' }) },
    }

    const evaluation = evaluatePreloadExecution({ config, preload, requestState, currentState })

    expect(evaluation.shouldReload).toBe(true)
  })

  it('reloads when the query does not exist yet in currentState.queries', () => {
    const currentState: RuntimeState = { ...requestState, queries: {} }

    const evaluation = evaluatePreloadExecution({ config, preload, requestState, currentState })

    expect(evaluation.shouldReload).toBe(true)
  })
})

describe('evaluatePreloadExecution (failed compose — unknown operationName)', () => {
  const api = { getCatalog: { method: 'GET' as const, endpoint: '/api/catalog' } }
  const config: RuntimeConfig = { api, initialPage: 'home', pages: [{ id: 'home', layout: [] }] }
  const preload = { operationName: 'unknownOperation', requestParams: {} as RuntimeApiRequestParams }
  const requestState = createRuntimeState(config)

  it('returns requestSignature null and propagates the compose error', () => {
    const currentState: RuntimeState = { ...requestState, queries: {} }

    const evaluation = evaluatePreloadExecution({ config, preload, requestState, currentState })

    expect(evaluation.requestSignature).toBeNull()
    expect(evaluation.error).toEqual({
      code: 'operation-not-found',
      message: 'The api operation "unknownOperation" does not exist.',
    })
  })

  it('reloads when the current state is not in error', () => {
    const currentState: RuntimeState = {
      ...requestState,
      queries: { unknownOperation: buildQueryState('idle') },
    }

    const evaluation = evaluatePreloadExecution({ config, preload, requestState, currentState })

    expect(evaluation.shouldReload).toBe(true)
  })

  it('does not reload when already in error with the same code and message', () => {
    const currentState: RuntimeState = {
      ...requestState,
      queries: {
        unknownOperation: buildQueryState('error', {
          error: { code: 'operation-not-found', message: 'The api operation "unknownOperation" does not exist.' },
        }),
      },
    }

    const evaluation = evaluatePreloadExecution({ config, preload, requestState, currentState })

    expect(evaluation.shouldReload).toBe(false)
  })

  it('reloads when already in error with a different code', () => {
    const currentState: RuntimeState = {
      ...requestState,
      queries: {
        unknownOperation: buildQueryState('error', {
          error: { code: 'other-code', message: 'The api operation "unknownOperation" does not exist.' },
        }),
      },
    }

    const evaluation = evaluatePreloadExecution({ config, preload, requestState, currentState })

    expect(evaluation.shouldReload).toBe(true)
  })

  it('reloads when already in error with a different message', () => {
    const currentState: RuntimeState = {
      ...requestState,
      queries: {
        unknownOperation: buildQueryState('error', {
          error: { code: 'operation-not-found', message: 'a different message' },
        }),
      },
    }

    const evaluation = evaluatePreloadExecution({ config, preload, requestState, currentState })

    expect(evaluation.shouldReload).toBe(true)
  })
})

describe('planPagePreloadExecution (empty case)', () => {
  const api = { getCatalog: { method: 'GET' as const, endpoint: '/api/catalog' } }

  it('returns an empty plan and the same state reference when the page has no preloads', () => {
    const config: RuntimeConfig = { api, initialPage: 'home', pages: [{ id: 'home', layout: [] }] }
    const page = config.pages[0]
    const state = createRuntimeState(config)

    const plan = planPagePreloadExecution({ config, page, entryId: 0, params: {}, state })

    expect(plan.preloadNames).toEqual([])
    expect(plan.reloadItems).toEqual([])
    expect(plan.aggregateStatus).toBe('idle')
    expect(plan.batchSignature).toBe('')
    expect(plan.snapshotState).toBe(state)
  })

  it('returns an empty plan when every preload is discarded by its when rule', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      preloads: [
        {
          operationName: 'getCatalog',
          requestParams: {},
          when: { reference: 'queries.flag.data', operator: 'isTruthy' },
        },
      ],
      layout: [],
    }
    const config: RuntimeConfig = { api, initialPage: 'home', pages: [page] }
    const baseState = createRuntimeState(config)
    const state: RuntimeState = {
      ...baseState,
      queries: { flag: buildQueryState('success', { data: false }) },
    }

    const plan = planPagePreloadExecution({ config, page, entryId: 0, params: {}, state })

    expect(plan.preloadNames).toEqual([])
    expect(plan.reloadItems).toEqual([])
    expect(plan.aggregateStatus).toBe('idle')
    expect(plan.batchSignature).toBe('')
    expect(plan.snapshotState).toBe(state)
  })
})

describe('planPagePreloadExecution (with preloads)', () => {
  const api = {
    getCatalog: { method: 'GET' as const, endpoint: '/api/catalog' },
    getOrders: { method: 'GET' as const, endpoint: '/api/orders' },
  }
  const page: RuntimePageConfig = {
    id: 'home',
    preloads: [
      { operationName: 'getCatalog', requestParams: {} },
      {
        operationName: 'getOrders',
        requestParams: {},
        when: { reference: 'queries.flag.data', operator: 'isTruthy' },
      },
    ],
    layout: [],
  }
  const config: RuntimeConfig = { api, initialPage: 'home', pages: [page] }
  const baseState = createRuntimeState(config)

  function composeExpectedSignature(operationName: string) {
    const result = buildRuntimeApiRequest({ config, operationName, state: baseState, requestParams: {} })

    expect(result.status).toBe('ready')
    return result.status === 'ready' ? result.request.requestSignature : null
  }

  it('includes only the preloads whose when rule matches, reloads only the stale ones and derives status from the input state', () => {
    const expectedCatalogSignature = composeExpectedSignature('getCatalog')
    const expectedOrdersSignature = composeExpectedSignature('getOrders')

    const state: RuntimeState = {
      ...baseState,
      queries: {
        flag: buildQueryState('success', { data: true }),
        getCatalog: buildQueryState('error', { requestSignature: expectedCatalogSignature }),
      },
    }

    const plan = planPagePreloadExecution({ config, page, entryId: 3, params: {}, state })

    expect(plan.preloadNames).toEqual(['getCatalog', 'getOrders'])
    expect(plan.reloadItems).toEqual([
      {
        operationName: 'getOrders',
        requestParams: {},
        requestSignature: expectedOrdersSignature,
      },
    ])
    expect(plan.aggregateStatus).toBe('error')
    expect(plan.batchSignature).not.toBe('')
  })
})

describe('createPreloadPlanningSnapshot', () => {
  it('resets named queries to idle/null, preserves untouched ones by identity and does not mutate the input', () => {
    const untouchedQuery = buildQueryState('success', { data: { a: 1 } })
    const targetQuery = buildQueryState('error', {
      data: 'stale',
      error: { code: 'boom', message: 'boom' },
      requestSignature: 'sig',
    })
    const state = {
      queries: { target: targetQuery, untouched: untouchedQuery },
    } as RuntimeState

    const snapshot = createPreloadPlanningSnapshot(state, ['target'])

    expect(snapshot.queries.target).toEqual({ status: 'idle', data: null, error: null, requestSignature: null })
    expect(snapshot.queries.untouched).toBe(untouchedQuery)
    expect(state.queries.target).toBe(targetQuery)
    expect(state.queries.target.status).toBe('error')
  })

  it('returns the same state reference when preloadNames is empty (no clone)', () => {
    const state = { queries: { existing: buildQueryState('success') } } as RuntimeState

    expect(createPreloadPlanningSnapshot(state, [])).toBe(state)
  })

  it('does not add a new key for a preloadNames entry missing from state.queries', () => {
    const state = { queries: { existing: buildQueryState('success') } } as RuntimeState

    const snapshot = createPreloadPlanningSnapshot(state, ['existing', 'missingName'])

    expect(Object.keys(snapshot.queries)).toEqual(['existing'])
  })
})

describe('isMatchingPageEntryState', () => {
  const pageEntry: RuntimeState['pageEntry'] = {
    entryId: 1,
    pageId: 'home',
    params: { id: '1' },
    preloadNames: ['getCatalog'],
    status: 'success',
  }

  it('returns true when entryId, pageId, status, params and preloadNames all match', () => {
    expect(isMatchingPageEntryState(pageEntry, 1, 'home', { id: '1' }, ['getCatalog'], 'success')).toBe(true)
  })

  it('returns false when entryId differs', () => {
    expect(isMatchingPageEntryState(pageEntry, 2, 'home', { id: '1' }, ['getCatalog'], 'success')).toBe(false)
  })

  it('returns false when pageId differs', () => {
    expect(isMatchingPageEntryState(pageEntry, 1, 'other', { id: '1' }, ['getCatalog'], 'success')).toBe(false)
  })

  it('returns false when status differs', () => {
    expect(isMatchingPageEntryState(pageEntry, 1, 'home', { id: '1' }, ['getCatalog'], 'loading')).toBe(false)
  })

  it('returns false when params differ', () => {
    expect(isMatchingPageEntryState(pageEntry, 1, 'home', { id: '2' }, ['getCatalog'], 'success')).toBe(false)
  })

  it('returns false when preloadNames differ', () => {
    expect(isMatchingPageEntryState(pageEntry, 1, 'home', { id: '1' }, ['getOrders'], 'success')).toBe(false)
  })
})

describe('arePageParamsEqual', () => {
  it('returns true for the same keys and values in a different insertion order', () => {
    expect(arePageParamsEqual({ a: 1, b: 'two' }, { b: 'two', a: 1 })).toBe(true)
  })

  it('returns true for two empty objects', () => {
    expect(arePageParamsEqual({}, {})).toBe(true)
  })

  it('returns false when the key count differs', () => {
    expect(arePageParamsEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false)
  })

  it('returns false when the same key has a different value', () => {
    expect(arePageParamsEqual({ a: 1 }, { a: 2 })).toBe(false)
  })

  it('returns false when a key exists only on one side with the same total key count', () => {
    expect(arePageParamsEqual({ a: 1 }, { b: 1 })).toBe(false)
  })
})

describe('arePreloadNamesEqual', () => {
  it('returns true with the same content and order', () => {
    expect(arePreloadNamesEqual(['a', 'b'], ['a', 'b'])).toBe(true)
  })

  it('returns true for two empty arrays', () => {
    expect(arePreloadNamesEqual([], [])).toBe(true)
  })

  it('returns false with the same content in a different order', () => {
    expect(arePreloadNamesEqual(['a', 'b'], ['b', 'a'])).toBe(false)
  })

  it('returns false with a different length', () => {
    expect(arePreloadNamesEqual(['a'], ['a', 'b'])).toBe(false)
  })
})

describe('createPlannedPreloadBatchSignature', () => {
  const baseInput = {
    entryId: 1,
    pageId: 'home',
    params: { id: '1' },
    preloadNames: ['getCatalog'],
    evaluations: [{ operationName: 'getCatalog', requestSignature: 'sig-1' }],
  }

  it('returns the exact same string for two calls with the same input', () => {
    expect(createPlannedPreloadBatchSignature(baseInput)).toBe(createPlannedPreloadBatchSignature(baseInput))
  })

  it('changes when entryId varies', () => {
    expect(createPlannedPreloadBatchSignature(baseInput)).not.toBe(
      createPlannedPreloadBatchSignature({ ...baseInput, entryId: 2 }),
    )
  })

  it('changes when pageId varies', () => {
    expect(createPlannedPreloadBatchSignature(baseInput)).not.toBe(
      createPlannedPreloadBatchSignature({ ...baseInput, pageId: 'other' }),
    )
  })

  it('changes when params varies', () => {
    expect(createPlannedPreloadBatchSignature(baseInput)).not.toBe(
      createPlannedPreloadBatchSignature({ ...baseInput, params: { id: '2' } }),
    )
  })

  it('changes when preloadNames varies', () => {
    expect(createPlannedPreloadBatchSignature(baseInput)).not.toBe(
      createPlannedPreloadBatchSignature({ ...baseInput, preloadNames: ['getOrders'] }),
    )
  })

  it('changes when an evaluation requestSignature varies', () => {
    expect(createPlannedPreloadBatchSignature(baseInput)).not.toBe(
      createPlannedPreloadBatchSignature({
        ...baseInput,
        evaluations: [{ operationName: 'getCatalog', requestSignature: 'sig-2' }],
      }),
    )
  })

  it('changes when an evaluation error varies', () => {
    const withError = createPlannedPreloadBatchSignature({
      ...baseInput,
      evaluations: [
        {
          operationName: 'getCatalog',
          requestSignature: null,
          error: { code: 'operation-not-found', message: 'boom' },
        },
      ],
    })
    const withDifferentError = createPlannedPreloadBatchSignature({
      ...baseInput,
      evaluations: [
        {
          operationName: 'getCatalog',
          requestSignature: null,
          error: { code: 'operation-not-found', message: 'a different message' },
        },
      ],
    })

    expect(withError).not.toBe(withDifferentError)
  })

  it('normalizes an evaluation without an error to error: null in the resulting string', () => {
    const signature = createPlannedPreloadBatchSignature(baseInput)

    expect(signature).toContain('"error":null')
  })
})
