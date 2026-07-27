import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { RuntimeConfig } from '../../config/runtime-config'
import type { RuntimeState } from '../../runtime/runtime-state/runtime-state-types'
import { createRuntimeState } from '../../runtime/runtime-state/runtime-state-reducer'
import { buildRuntimeApiRequest } from '../../queries/runtime-api-executor'
import { planGlobalPreloads } from '../../runtime/runtime-global-preloads'
import { RuntimeStateProvider } from '../../runtime/runtime-state/runtime-state-provider'
import { useRuntimeState } from '../../runtime/runtime-state/use-runtime-state'

afterEach(() => {
  window.history.replaceState(null, '', window.location.pathname + window.location.search)
})

function RuntimeStateSnapshot({ testId }: { testId: string }) {
  const state = useRuntimeState()
  return <pre data-testid={testId}>{JSON.stringify(state)}</pre>
}

function readRuntimeStateSnapshot(testId: string) {
  return JSON.parse(screen.getByTestId(testId).textContent ?? '') as RuntimeState
}

const api = {
  getCatalog: {
    method: 'GET' as const,
    endpoint: '/api/catalog',
  },
}

const noPreloadsConfig: RuntimeConfig = {
  api,
  initialPage: 'home',
  pages: [
    {
      id: 'home',
      layout: [],
    },
  ],
}

const emptyPreloadsConfig: RuntimeConfig = {
  ...noPreloadsConfig,
  preloads: [],
}

const globalPreloadConfig: RuntimeConfig = {
  ...noPreloadsConfig,
  preloads: [{ operationName: 'getCatalog', requestParams: {} }],
}

const globalPreloadWithQueryConfig: RuntimeConfig = {
  ...noPreloadsConfig,
  preloads: [{ operationName: 'getCatalog', requestParams: { query: { locale: 'es' } } }],
}

const unknownOperationPreloadConfig: RuntimeConfig = {
  ...noPreloadsConfig,
  preloads: [{ operationName: 'unknownOperation', requestParams: {} }],
}

const rootAndPagePreloadConfig: RuntimeConfig = {
  api,
  initialPage: 'home',
  preloads: [{ operationName: 'getCatalog', requestParams: {} }],
  pages: [
    {
      id: 'home',
      preloads: [{ operationName: 'getCatalog', requestParams: {} }],
      layout: [],
    },
  ],
}

describe('createRuntimeStateFromBrowserHash global preloads seeding', () => {
  it('leaves queries untouched when config has no preloads block (regression)', () => {
    render(
      <RuntimeStateProvider config={noPreloadsConfig}>
        <RuntimeStateSnapshot testId="runtime-state" />
      </RuntimeStateProvider>,
    )

    const state = readRuntimeStateSnapshot('runtime-state')
    expect(state.queries).toEqual({})
  })

  it('leaves queries untouched when config has an empty preloads array', () => {
    render(
      <RuntimeStateProvider config={emptyPreloadsConfig}>
        <RuntimeStateSnapshot testId="runtime-state" />
      </RuntimeStateProvider>,
    )

    const state = readRuntimeStateSnapshot('runtime-state')
    expect(state.queries).toEqual({})
  })

  it('seeds a loading marker with the effective requestSignature for a resolvable global preload', () => {
    render(
      <RuntimeStateProvider config={globalPreloadConfig}>
        <RuntimeStateSnapshot testId="runtime-state" />
      </RuntimeStateProvider>,
    )

    const state = readRuntimeStateSnapshot('runtime-state')
    const expectedState = createRuntimeState(globalPreloadConfig)
    const expectedRequest = buildRuntimeApiRequest({
      config: globalPreloadConfig,
      operationName: 'getCatalog',
      state: expectedState,
      requestParams: {},
    })

    expect(expectedRequest.status).toBe('ready')
    const expectedSignature = expectedRequest.status === 'ready' ? expectedRequest.request.requestSignature : null

    expect(state.queries.getCatalog).toEqual({
      status: 'loading',
      data: null,
      error: null,
      requestSignature: expectedSignature,
    })
    expect(expectedSignature).toBeTruthy()
  })

  it('seeds a loading marker with requestSignature null when the operation does not exist, without writing an error yet', () => {
    render(
      <RuntimeStateProvider config={unknownOperationPreloadConfig}>
        <RuntimeStateSnapshot testId="runtime-state" />
      </RuntimeStateProvider>,
    )

    const state = readRuntimeStateSnapshot('runtime-state')

    expect(state.queries.unknownOperation).toEqual({
      status: 'loading',
      data: null,
      error: null,
      requestSignature: null,
    })
    expect(state.queries.unknownOperation.status).not.toBe('error')
  })

  it('produces different requestSignatures for global preloads with different effective query params', () => {
    render(
      <RuntimeStateProvider config={globalPreloadConfig}>
        <RuntimeStateSnapshot testId="runtime-state-plain" />
      </RuntimeStateProvider>,
    )
    const plainState = readRuntimeStateSnapshot('runtime-state-plain')

    render(
      <RuntimeStateProvider config={globalPreloadWithQueryConfig}>
        <RuntimeStateSnapshot testId="runtime-state-query" />
      </RuntimeStateProvider>,
    )
    const queryState = readRuntimeStateSnapshot('runtime-state-query')

    expect(plainState.queries.getCatalog.requestSignature).not.toBeNull()
    expect(queryState.queries.getCatalog.requestSignature).not.toBeNull()
    expect(plainState.queries.getCatalog.requestSignature).not.toBe(queryState.queries.getCatalog.requestSignature)
  })

  it('does not overwrite a query already seeded via dataValues (latest-only, no collision)', () => {
    render(
      <RuntimeStateProvider config={globalPreloadConfig} dataValues={{ getCatalog: { pre: true } }}>
        <RuntimeStateSnapshot testId="runtime-state" />
      </RuntimeStateProvider>,
    )

    const state = readRuntimeStateSnapshot('runtime-state')

    expect(state.queries.getCatalog).toEqual({
      status: 'success',
      data: { pre: true },
      error: null,
      requestSignature: null,
    })
  })

  it('seeds a non-colliding preload with loading while a colliding one keeps its dataValues seed', () => {
    const mixedConfig: RuntimeConfig = {
      api: {
        ...api,
        getOtherCatalog: {
          method: 'GET',
          endpoint: '/api/other-catalog',
        },
      },
      initialPage: 'home',
      preloads: [
        { operationName: 'getCatalog', requestParams: {} },
        { operationName: 'getOtherCatalog', requestParams: {} },
      ],
      pages: [
        {
          id: 'home',
          layout: [],
        },
      ],
    }

    render(
      <RuntimeStateProvider config={mixedConfig} dataValues={{ getCatalog: { pre: true } }}>
        <RuntimeStateSnapshot testId="runtime-state" />
      </RuntimeStateProvider>,
    )

    const state = readRuntimeStateSnapshot('runtime-state')

    expect(state.queries.getCatalog).toEqual({
      status: 'success',
      data: { pre: true },
      error: null,
      requestSignature: null,
    })
    expect(state.queries.getOtherCatalog.status).toBe('loading')
    expect(state.queries.getOtherCatalog.requestSignature).not.toBeNull()
  })
})

describe('planGlobalPreloads purity', () => {
  it('returns the same operationName, requestSignature and composeError in the same order across repeated calls', () => {
    const config: RuntimeConfig = {
      api,
      initialPage: 'home',
      preloads: [
        { operationName: 'getCatalog', requestParams: {} },
        { operationName: 'unknownOperation', requestParams: {} },
      ],
      pages: [{ id: 'home', layout: [] }],
    }
    const state = createRuntimeState(config)

    const firstResult = planGlobalPreloads({ config, state })
    const secondResult = planGlobalPreloads({ config, state })

    expect(secondResult.items.map((item) => item.operationName)).toEqual(
      firstResult.items.map((item) => item.operationName),
    )
    expect(secondResult.items.map((item) => item.requestSignature)).toEqual(
      firstResult.items.map((item) => item.requestSignature),
    )
    expect(secondResult.items.map((item) => item.composeError)).toEqual(
      firstResult.items.map((item) => item.composeError),
    )
  })

  it('produces an error item with composeError set and requestSignature null for an unknown operation', () => {
    const config: RuntimeConfig = {
      api,
      initialPage: 'home',
      preloads: [{ operationName: 'unknownOperation', requestParams: {} }],
      pages: [{ id: 'home', layout: [] }],
    }
    const state = createRuntimeState(config)

    const result = planGlobalPreloads({ config, state })

    expect(result.items).toEqual([
      {
        operationName: 'unknownOperation',
        requestParams: {},
        requestSignature: null,
        composeError: {
          code: 'operation-not-found',
          message: 'The api operation "unknownOperation" does not exist.',
        },
      },
    ])
  })
})

describe('requestSignature parity between root preloads and pages[].preloads', () => {
  it('computes the same requestSignature for the same operation and equivalent request params in both blocks', () => {
    const state = createRuntimeState(rootAndPagePreloadConfig)

    const rootPlan = planGlobalPreloads({ config: rootAndPagePreloadConfig, state })
    const pagePreload = rootAndPagePreloadConfig.pages[0].preloads?.[0]
    const pageRequestResult = buildRuntimeApiRequest({
      config: rootAndPagePreloadConfig,
      operationName: pagePreload!.operationName,
      state,
      requestParams: pagePreload!.requestParams,
    })

    expect(rootPlan.items[0].requestSignature).not.toBeNull()
    expect(pageRequestResult.status).toBe('ready')
    const pageSignature = pageRequestResult.status === 'ready' ? pageRequestResult.request.requestSignature : null

    expect(rootPlan.items[0].requestSignature).toBe(pageSignature)
  })
})
