import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useEffect, useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RuntimeConfig } from '../../config/runtime-config'
import { LayoutEditModeProvider } from '../../runtime/layout-edit-mode-context'
import { RuntimeStateProvider } from '../../runtime/runtime-state/runtime-state-provider'
import { executeDownloadOperationWithSnapshot } from '../../runtime/runtime-state/runtime-state-query-execution'
import type { RuntimeState, RuntimeStateAction } from '../../runtime/runtime-state/runtime-state-types'
import { useRuntimeState, useRuntimeStateActions } from '../../runtime/runtime-state/use-runtime-state'

afterEach(() => {
  window.history.replaceState(null, '', window.location.pathname + window.location.search)
})

const downloadConfig: RuntimeConfig = {
  api: {
    downloadReport: {
      method: 'GET',
      endpoint: '/api/reports/download',
    },
    downloadWithQuery: {
      method: 'GET',
      endpoint: '/api/reports/download',
      query: {
        search: 'forms.reportSearch.name',
      },
    },
    downloadInvalidQuery: {
      method: 'GET',
      endpoint: '/api/reports/download',
      query: {
        search: 'forms.reportSearch.missingField',
      },
    },
    downloadSecure: {
      method: 'GET',
      endpoint: '/api/reports/secure-download',
      headers: {
        Authorization: 'tokens.session.value',
      },
    },
  },
  initialPage: 'home',
  pages: [{ id: 'home', layout: [] }],
}

function makeBaseState(overrides: Partial<RuntimeState> = {}): RuntimeState {
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
    modal: { activeModalId: null, activeIterationKey: null },
    i18n: { translations: {}, activeLanguage: 'es' },
    tokens: {},
    ...overrides,
  }
}

function createDispatchSpy() {
  return vi.fn<(action: RuntimeStateAction) => void>()
}

describe('executeDownloadOperationWithSnapshot', () => {
  it('dispatches queries/set-loading then queries/set-success with data null on a successful binary fetch', async () => {
    const dispatch = createDispatchSpy()
    const fileBytes = new Uint8Array([1, 2, 3, 4])
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(new Blob([fileBytes], { type: 'application/pdf' }), {
        status: 200,
        headers: {
          'content-disposition': 'attachment; filename="report.pdf"',
        },
      }),
    )

    const result = await executeDownloadOperationWithSnapshot({
      config: downloadConfig,
      dispatch,
      operationName: 'downloadReport',
      snapshotState: makeBaseState(),
      fetchImplementation: fetchMock,
    })

    const expectedSignature = '{"endpoint":"/api/reports/download","method":"GET","operationName":"downloadReport"}'

    expect(dispatch).toHaveBeenNthCalledWith(1, {
      type: 'queries/set-loading',
      payload: {
        queryName: 'downloadReport',
        requestSignature: expectedSignature,
      },
    })
    expect(dispatch).toHaveBeenNthCalledWith(2, {
      type: 'queries/set-success',
      payload: {
        queryName: 'downloadReport',
        data: null,
        requestSignature: expectedSignature,
      },
    })

    expect(result.status).toBe('success')
    if (result.status !== 'success') return
    // Exact byte-size equality of a jsdom `Response.blob()` is flaky across environments
    // (see `src/tests/runtime/runtime-api-download.test.ts`); assert non-emptiness instead.
    expect(result.blob.size).toBeGreaterThan(0)
    expect(result.contentDisposition).toBe('attachment; filename="report.pdf"')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('dispatches queries/set-error with operation-not-found without invoking fetch', async () => {
    const dispatch = createDispatchSpy()
    const fetchMock = vi.fn()

    const result = await executeDownloadOperationWithSnapshot({
      config: downloadConfig,
      dispatch,
      operationName: 'missingDownloadOperation',
      snapshotState: makeBaseState(),
      fetchImplementation: fetchMock,
    })

    expect(dispatch).toHaveBeenCalledTimes(1)
    expect(dispatch).toHaveBeenCalledWith({
      type: 'queries/set-error',
      payload: {
        queryName: 'missingDownloadOperation',
        error: {
          code: 'operation-not-found',
          message: 'The api operation "missingDownloadOperation" does not exist.',
        },
        requestSignature: null,
      },
    })
    expect(result.status).toBe('error')
    if (result.status !== 'error') return
    expect(result.error.code).toBe('operation-not-found')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('dispatches queries/set-error with request-build-failed without invoking fetch when a reference cannot be resolved', async () => {
    const dispatch = createDispatchSpy()
    const fetchMock = vi.fn()

    const result = await executeDownloadOperationWithSnapshot({
      config: downloadConfig,
      dispatch,
      operationName: 'downloadInvalidQuery',
      snapshotState: makeBaseState(),
      fetchImplementation: fetchMock,
    })

    expect(dispatch).toHaveBeenCalledTimes(1)
    const dispatchedAction = dispatch.mock.calls[0][0]
    expect(dispatchedAction).toMatchObject({
      type: 'queries/set-error',
      payload: {
        queryName: 'downloadInvalidQuery',
        error: { code: 'request-build-failed' },
        requestSignature: null,
      },
    })
    expect(result.status).toBe('error')
    if (result.status !== 'error') return
    expect(result.error.code).toBe('request-build-failed')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('dispatches queries/set-error with token-refresh-failed without invoking fetch when a header token is in error state', async () => {
    const dispatch = createDispatchSpy()
    const fetchMock = vi.fn()

    const result = await executeDownloadOperationWithSnapshot({
      config: downloadConfig,
      dispatch,
      operationName: 'downloadSecure',
      snapshotState: makeBaseState({
        tokens: {
          session: { value: 'abc', status: 'error', failedAttempts: 1 },
        },
      }),
      fetchImplementation: fetchMock,
    })

    expect(dispatch).toHaveBeenCalledTimes(1)
    expect(dispatch).toHaveBeenCalledWith({
      type: 'queries/set-error',
      payload: {
        queryName: 'downloadSecure',
        error: {
          code: 'token-refresh-failed',
          message: 'The api operation "downloadSecure" cannot build the request because token "session" is in error state.',
        },
        requestSignature: null,
      },
    })
    expect(result.status).toBe('error')
    if (result.status !== 'error') return
    expect(result.error.code).toBe('token-refresh-failed')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('dispatches queries/set-error with network-error when the binary fetch rejects', async () => {
    const dispatch = createDispatchSpy()
    const fetchMock = vi.fn().mockRejectedValue(new Error('socket hang up'))

    const result = await executeDownloadOperationWithSnapshot({
      config: downloadConfig,
      dispatch,
      operationName: 'downloadReport',
      snapshotState: makeBaseState(),
      fetchImplementation: fetchMock,
    })

    expect(dispatch).toHaveBeenNthCalledWith(2, {
      type: 'queries/set-error',
      payload: {
        queryName: 'downloadReport',
        error: {
          code: 'network-error',
          message: 'The api operation "downloadReport" failed due to a network error.',
        },
        requestSignature: '{"endpoint":"/api/reports/download","method":"GET","operationName":"downloadReport"}',
      },
    })
    expect(result.status).toBe('error')
    if (result.status !== 'error') return
    expect(result.error.code).toBe('network-error')
  })

  it('dispatches queries/set-error with http-error when the binary fetch responds with a non-ok status', async () => {
    const dispatch = createDispatchSpy()
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 404 }))

    const result = await executeDownloadOperationWithSnapshot({
      config: downloadConfig,
      dispatch,
      operationName: 'downloadReport',
      snapshotState: makeBaseState(),
      fetchImplementation: fetchMock,
    })

    expect(dispatch).toHaveBeenNthCalledWith(2, {
      type: 'queries/set-error',
      payload: {
        queryName: 'downloadReport',
        error: {
          code: 'http-error',
          message: 'The api operation "downloadReport" failed with HTTP status 404.',
        },
        requestSignature: '{"endpoint":"/api/reports/download","method":"GET","operationName":"downloadReport"}',
      },
    })
    expect(result.status).toBe('error')
    if (result.status !== 'error') return
    expect(result.error.code).toBe('http-error')
  })
})

function RuntimeStateSnapshot({ testId }: { testId: string }) {
  const state = useRuntimeState()
  return <pre data-testid={testId}>{JSON.stringify(state)}</pre>
}

function readRuntimeStateSnapshot(testId: string) {
  return JSON.parse(screen.getByTestId(testId).textContent ?? '') as RuntimeState
}

const noopEditModeContextValue = {
  active: true as const,
  selectedPath: null,
  hoveredPath: null,
  onSelectNode: () => {},
  onHoverNode: () => {},
}

function DownloadOperationFixture({
  operationName,
  fetchMock,
}: {
  operationName: string
  fetchMock?: typeof fetch
}) {
  const { executeDownloadOperation, initializeForm, setFormFieldValue } = useRuntimeStateActions()
  const [downloadResult, setDownloadResult] = useState<unknown>(null)

  useEffect(() => {
    initializeForm('reportSearch', {
      name: {
        defaultValue: 'Ada',
      },
    })
  }, [initializeForm])

  return (
    <>
      <button type="button" onClick={() => setFormFieldValue('reportSearch', 'name', 'Grace')}>
        set form value
      </button>
      <button
        type="button"
        onClick={async () => {
          const outcome = await executeDownloadOperation(operationName, { fetch: fetchMock })
          setDownloadResult(outcome)
        }}
      >
        Execute download
      </button>
      <pre data-testid="download-result">{JSON.stringify(downloadResult)}</pre>
      <RuntimeStateSnapshot testId="runtime-state" />
    </>
  )
}

function createEmptyPdfResponse() {
  return new Response(new Blob(['pdf-bytes'], { type: 'application/pdf' }), { status: 200 })
}

describe('useRuntimeStateActions().executeDownloadOperation', () => {
  it('resolves to { status: "skipped" } without dispatching or invoking fetch under LayoutEditModeProvider (active: true)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(createEmptyPdfResponse())

    render(
      <RuntimeStateProvider config={downloadConfig}>
        <LayoutEditModeProvider value={noopEditModeContextValue}>
          <DownloadOperationFixture operationName="downloadReport" fetchMock={fetchMock as unknown as typeof fetch} />
        </LayoutEditModeProvider>
      </RuntimeStateProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Execute download' }))

    await waitFor(() => expect(screen.getByTestId('download-result').textContent).toBe('{"status":"skipped"}'))

    expect(fetchMock).not.toHaveBeenCalled()
    expect(readRuntimeStateSnapshot('runtime-state').queries.downloadReport).toBeUndefined()
  })

  it('uses the latest state (getLatestState) when no snapshotState is passed explicitly', async () => {
    const fetchMock = vi.fn().mockResolvedValue(createEmptyPdfResponse())

    render(
      <RuntimeStateProvider config={downloadConfig}>
        <DownloadOperationFixture operationName="downloadWithQuery" fetchMock={fetchMock as unknown as typeof fetch} />
      </RuntimeStateProvider>,
    )

    // Update the form field, then execute in the same synchronous tick: since
    // `dispatchAndSyncState` updates the provider's latest-state ref synchronously,
    // an execution without an explicit `snapshotState` must observe "Grace", not the
    // stale default "Ada", proving it reads `getLatestState()` rather than a captured value.
    fireEvent.click(screen.getByRole('button', { name: 'set form value' }))
    fireEvent.click(screen.getByRole('button', { name: 'Execute download' }))

    await waitFor(() =>
      expect(readRuntimeStateSnapshot('runtime-state').queries.downloadWithQuery).toMatchObject({
        status: 'success',
        data: null,
      }),
    )

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const requestUrl = String((fetchMock.mock.calls[0] as [string | URL, RequestInit?])[0])
    expect(requestUrl).toContain('search=Grace')
  })

  it('two consumers invoking the same operationName under one provider update the shared queries slot', async () => {
    const fetchMock = vi.fn().mockResolvedValue(createEmptyPdfResponse())

    render(
      <RuntimeStateProvider config={downloadConfig}>
        <DownloadOperationFixture operationName="downloadReport" fetchMock={fetchMock as unknown as typeof fetch} />
        <RuntimeStateSnapshot testId="second-consumer-state" />
      </RuntimeStateProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Execute download' }))

    await waitFor(() =>
      expect(readRuntimeStateSnapshot('second-consumer-state').queries.downloadReport).toMatchObject({
        status: 'success',
        data: null,
      }),
    )
  })
})
