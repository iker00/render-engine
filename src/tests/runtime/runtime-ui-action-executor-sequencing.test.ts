import { describe, expect, it, vi } from 'vitest'
import type { RuntimeUiActionListEntry } from '../../config/runtime-config'
import {
  runActionOutcomeWithLifecycle,
  runRuntimeUiActionLifecycleList,
  type RuntimeUiActionHandlers,
} from '../../runtime/runtime-actions/runtime-ui-action-executor'
import type { RuntimeQueryState, RuntimeState } from '../../runtime/runtime-state/runtime-state-types'

/**
 * Low-level sequencing tests for `runRuntimeUiActionLifecycleList` and
 * `runActionOutcomeWithLifecycle`, exercised directly against mocked handlers
 * with deferred promises built by hand (no component mounting, no Testing
 * Library) so the resolution order of a lifecycle list can be controlled
 * deterministically.
 */

function createDeferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

function createBaseState(): RuntimeState {
  return {
    navigation: {
      currentPageId: 'home',
      history: [{ entryId: 0, pageId: 'home', params: {} }],
      currentEntryIndex: 0,
      lastError: null,
    },
    forms: {},
    queries: {},
    pageEntry: {
      entryId: 0,
      pageId: 'home',
      params: {},
      preloadNames: [],
      status: 'idle',
    },
    modal: {
      activeModalId: null,
      activeIterationKey: null,
    },
    i18n: {
      translations: {},
      activeLanguage: 'en',
    },
    tokens: {},
  }
}

function createHandlers(overrides: Partial<RuntimeUiActionHandlers> = {}): RuntimeUiActionHandlers {
  return {
    executeQueryOperation: vi.fn().mockResolvedValue({ status: 'success' }),
    executeDownloadOperation: vi.fn(),
    goBackPage: vi.fn(),
    navigateToPage: vi.fn(),
    openModal: vi.fn(),
    closeModal: vi.fn(),
    resetForm: vi.fn(),
    ...overrides,
  }
}

function successQueryState(data: unknown): RuntimeQueryState {
  return { status: 'success', data, error: null, requestSignature: null }
}

describe('runRuntimeUiActionLifecycleList sequencing', () => {
  it('waits for the first executeOperation entry to resolve before invoking the second', async () => {
    const firstDeferred = createDeferred<{ status: string }>()
    const executeQueryOperation = vi.fn().mockImplementation((operationName: string) => {
      if (operationName === 'first') {
        return firstDeferred.promise
      }
      return Promise.resolve({ status: 'success' })
    })
    const handlers = createHandlers({ executeQueryOperation })
    const state = createBaseState()

    const actions: RuntimeUiActionListEntry[] = [
      { type: 'executeOperation', operationName: 'first' },
      { type: 'executeOperation', operationName: 'second' },
    ]

    const runPromise = runRuntimeUiActionLifecycleList(actions, handlers, () => state)

    await Promise.resolve()
    await Promise.resolve()

    expect(executeQueryOperation).toHaveBeenCalledTimes(1)
    expect(executeQueryOperation).toHaveBeenCalledWith('first', expect.anything())

    firstDeferred.resolve({ status: 'success' })
    await runPromise

    expect(executeQueryOperation).toHaveBeenCalledTimes(2)
    expect(executeQueryOperation).toHaveBeenNthCalledWith(2, 'second', expect.anything())
  })

  it('resolves entries in declared order even when a later entry would settle faster than an earlier one', async () => {
    const order: string[] = []
    const firstDeferred = createDeferred<{ status: string }>()
    const secondDeferred = createDeferred<{ status: string }>()

    const executeQueryOperation = vi.fn().mockImplementation((operationName: string) => {
      const deferred = operationName === 'first' ? firstDeferred : secondDeferred
      return deferred.promise.then((result) => {
        order.push(operationName)
        return result
      })
    })
    const handlers = createHandlers({ executeQueryOperation })
    const state = createBaseState()

    const actions: RuntimeUiActionListEntry[] = [
      { type: 'executeOperation', operationName: 'first' },
      { type: 'executeOperation', operationName: 'second' },
    ]

    const runPromise = runRuntimeUiActionLifecycleList(actions, handlers, () => state)

    // 'second' is resolved first, but it hasn't even started yet: it only
    // starts once 'first' has finished, so this resolve is a no-op for now.
    secondDeferred.resolve({ status: 'success' })
    await Promise.resolve()
    await Promise.resolve()
    expect(order).toEqual([])

    firstDeferred.resolve({ status: 'success' })
    await runPromise

    expect(order).toEqual(['first', 'second'])
  })

  it('blocks the next list entry until every operation of an intermediate executeOperations entry has resolved', async () => {
    const opADeferred = createDeferred<{ status: string }>()
    const opBDeferred = createDeferred<{ status: string }>()

    const executeQueryOperation = vi.fn().mockImplementation((operationName: string) => {
      if (operationName === 'opA') return opADeferred.promise
      if (operationName === 'opB') return opBDeferred.promise
      return Promise.resolve({ status: 'success' })
    })
    const handlers = createHandlers({ executeQueryOperation })
    const state = createBaseState()

    const actions: RuntimeUiActionListEntry[] = [
      {
        type: 'executeOperations',
        operations: [{ operationName: 'opA' }, { operationName: 'opB' }],
      },
      { type: 'executeOperation', operationName: 'afterBoth' },
    ]

    const runPromise = runRuntimeUiActionLifecycleList(actions, handlers, () => state)

    await Promise.resolve()
    await Promise.resolve()

    expect(executeQueryOperation).toHaveBeenCalledTimes(2)
    expect(executeQueryOperation).not.toHaveBeenCalledWith('afterBoth', expect.anything())

    opADeferred.resolve({ status: 'success' })
    await Promise.resolve()
    await Promise.resolve()
    expect(executeQueryOperation).not.toHaveBeenCalledWith('afterBoth', expect.anything())

    opBDeferred.resolve({ status: 'success' })
    await runPromise

    expect(executeQueryOperation).toHaveBeenCalledTimes(3)
    expect(executeQueryOperation).toHaveBeenNthCalledWith(3, 'afterBoth', expect.anything())
  })

  it('evaluates the entry right after a synchronous entry on the next microtask, without an extra promise wait', async () => {
    const executeQueryOperation = vi.fn().mockResolvedValue({ status: 'success' })
    const navigateToPage = vi.fn()
    const handlers = createHandlers({ executeQueryOperation, navigateToPage })
    const state = createBaseState()

    const actions: RuntimeUiActionListEntry[] = [
      { type: 'navigateTo', pageId: 'next' },
      { type: 'executeOperation', operationName: 'afterNavigate' },
    ]

    const runPromise = runRuntimeUiActionLifecycleList(actions, handlers, () => state)

    // The synchronous entry has already run before this call returns.
    expect(navigateToPage).toHaveBeenCalledWith('next', undefined, expect.anything())
    expect(executeQueryOperation).not.toHaveBeenCalled()

    await Promise.resolve()

    expect(executeQueryOperation).toHaveBeenCalledWith('afterNavigate', expect.anything())

    await runPromise
  })

  it('lets a later entry\'s when reference queries.<op>.status/.data as resolved by an earlier entry of the same list', async () => {
    const state = createBaseState()
    const deferred = createDeferred<{ status: string }>()

    const executeQueryOperation = vi.fn().mockImplementation((operationName: string) => {
      if (operationName === 'checkFlag') {
        return deferred.promise.then((result) => {
          state.queries = {
            ...state.queries,
            checkFlag: successQueryState({ shouldNotify: true }),
          }
          return result
        })
      }
      return Promise.resolve({ status: 'success' })
    })
    const handlers = createHandlers({ executeQueryOperation })

    const actions: RuntimeUiActionListEntry[] = [
      { type: 'executeOperation', operationName: 'checkFlag' },
      {
        type: 'executeOperation',
        operationName: 'notify',
        when: { reference: 'queries.checkFlag.data.shouldNotify', operator: 'isTruthy' },
      },
    ]

    const runPromise = runRuntimeUiActionLifecycleList(actions, handlers, () => state)

    await Promise.resolve()
    expect(executeQueryOperation).toHaveBeenCalledTimes(1)

    deferred.resolve({ status: 'success' })
    await runPromise

    expect(executeQueryOperation).toHaveBeenCalledTimes(2)
    expect(executeQueryOperation).toHaveBeenNthCalledWith(2, 'notify', expect.anything())
  })
})

describe('runActionOutcomeWithLifecycle sequencing', () => {
  it('does not resolve until the awaited onSuccess lifecycle list has fully resolved', async () => {
    const deferred = createDeferred<{ status: string }>()
    const executeQueryOperation = vi.fn().mockImplementation(() => deferred.promise)
    const handlers = createHandlers({ executeQueryOperation })
    const state = createBaseState()

    let lifecycleResolved = false
    const onSuccess: RuntimeUiActionListEntry[] = [{ type: 'executeOperation', operationName: 'chained' }]

    const outcomePromise = runActionOutcomeWithLifecycle(
      () => Promise.resolve({ status: 'success' }),
      onSuccess,
      undefined,
      handlers,
      () => state,
    ).then((result) => {
      lifecycleResolved = true
      return result
    })

    await Promise.resolve()
    await Promise.resolve()

    expect(executeQueryOperation).toHaveBeenCalledWith('chained', expect.anything())
    expect(lifecycleResolved).toBe(false)

    deferred.resolve({ status: 'success' })
    const result = await outcomePromise

    expect(lifecycleResolved).toBe(true)
    expect(result).toEqual({ status: 'success' })
  })
})
