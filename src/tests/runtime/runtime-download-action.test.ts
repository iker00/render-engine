import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DownloadOperationRuntimeUiAction } from '../../config/runtime-config-types'
import { resolveDownloadFilename, runDownloadAction } from '../../runtime/runtime-actions/runtime-download-action'
import * as runtimeReferenceResolverModule from '../../runtime/runtime-references/runtime-reference-resolver'
import type { RuntimeUiActionHandlers } from '../../runtime/runtime-actions/runtime-ui-action-executor'
import type { RuntimeState } from '../../runtime/runtime-state/runtime-state-types'

// `vi.mock` calls are hoisted above every import in this file, so `runtime-download-action`
// already sees the spy-wrapped `resolveRuntimeTextReference` below.
vi.mock('../../runtime/runtime-references/runtime-reference-resolver', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../runtime/runtime-references/runtime-reference-resolver')>()
  return { ...actual, resolveRuntimeTextReference: vi.fn(actual.resolveRuntimeTextReference) }
})

function makeState(overrides: Partial<RuntimeState> = {}): RuntimeState {
  return {
    navigation: {
      currentPageId: 'home',
      history: [{ entryId: 0, pageId: 'home', params: {} }],
      lastError: null,
    },
    forms: {},
    queries: {
      report: {
        status: 'success',
        data: { name: 'nombre-informe.pdf' },
        error: null,
        requestSignature: null,
      },
    },
    pageEntry: {
      entryId: 0,
      pageId: 'home',
      params: {},
      preloadNames: [],
      status: 'idle',
    },
    ...overrides,
  } as RuntimeState
}

function makeHandlers(overrides: Partial<RuntimeUiActionHandlers> = {}): RuntimeUiActionHandlers {
  return {
    executeQueryOperation: vi.fn(),
    executeDownloadOperation: vi.fn(),
    goBackPage: vi.fn(),
    navigateToPage: vi.fn(),
    openModal: vi.fn(),
    closeModal: vi.fn(),
    resetForm: vi.fn(),
    ...overrides,
  }
}

function makeAction(overrides: Partial<DownloadOperationRuntimeUiAction> = {}): DownloadOperationRuntimeUiAction {
  return {
    type: 'downloadOperation',
    operationName: 'downloadReport',
    query: { format: 'pdf' },
    headers: { Authorization: 'Bearer token' },
    ...overrides,
  }
}

describe('resolveDownloadFilename', () => {
  const state = makeState()

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('resolves a quoted filename from Content-Disposition', () => {
    const result = resolveDownloadFilename({
      contentDisposition: 'attachment; filename="reporte.pdf"',
      actionFilename: undefined,
      state,
      surface: 'button.props.action.filename',
    })

    expect(result).toBe('reporte.pdf')
  })

  it('resolves an unquoted filename from Content-Disposition', () => {
    const result = resolveDownloadFilename({
      contentDisposition: 'attachment; filename=informe.pdf',
      actionFilename: undefined,
      state,
      surface: 'button.props.action.filename',
    })

    expect(result).toBe('informe.pdf')
  })

  it('falls back to actionFilename when Content-Disposition has no parseable filename', () => {
    const result = resolveDownloadFilename({
      contentDisposition: 'attachment',
      actionFilename: 'informe.pdf',
      state,
      surface: 'button.props.action.filename',
    })

    expect(result).toBe('informe.pdf')
  })

  it('falls back to the generic "download" literal without Content-Disposition and without actionFilename', () => {
    const result = resolveDownloadFilename({
      contentDisposition: null,
      actionFilename: undefined,
      state,
      surface: 'button.props.action.filename',
    })

    expect(result).toBe('download')
  })

  it('uses actionFilename resolved as a dynamic reference when it resolves to a non-empty string', () => {
    const result = resolveDownloadFilename({
      contentDisposition: null,
      actionFilename: 'queries.report.data.name',
      state,
      surface: 'link.props.action.filename',
    })

    expect(result).toBe('nombre-informe.pdf')
  })

  it('falls back to "download" when actionFilename resolves to an empty string (unavailable reference)', () => {
    const result = resolveDownloadFilename({
      contentDisposition: null,
      actionFilename: 'queries.missingReport.data.name',
      state,
      surface: 'button.props.action.filename',
    })

    expect(result).toBe('download')
  })

  it('forwards the received surface as-is to resolveRuntimeTextReference, never a fixed literal', () => {
    resolveDownloadFilename({
      contentDisposition: null,
      actionFilename: 'queries.report.data.name',
      state,
      surface: 'link.props.action.filename',
      iterationContext: { item: { id: 1 }, index: 0, key: '1' },
    })

    expect(runtimeReferenceResolverModule.resolveRuntimeTextReference).toHaveBeenCalledWith(
      'queries.report.data.name',
      state,
      'link.props.action.filename',
      { iterationContext: { item: { id: 1 }, index: 0, key: '1' } },
    )
  })
})

describe('runDownloadAction', () => {
  const state = makeState()
  let anchorClickSpy: ReturnType<typeof vi.fn>
  let createObjectUrlSpy: ReturnType<typeof vi.fn>
  let revokeObjectUrlSpy: ReturnType<typeof vi.fn>
  let createElementSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    anchorClickSpy = vi.fn()
    createObjectUrlSpy = vi.fn().mockReturnValue('blob:mock-url')
    revokeObjectUrlSpy = vi.fn()

    vi.stubGlobal('URL', { ...URL, createObjectURL: createObjectUrlSpy, revokeObjectURL: revokeObjectUrlSpy })

    const actualCreateElement = document.createElement.bind(document)
    createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      if (tagName === 'a') {
        return { href: '', download: '', click: anchorClickSpy } as unknown as HTMLAnchorElement
      }
      return actualCreateElement(tagName)
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('runs executeDownloadOperation with requestParams built from query/body/headers, triggers the browser download and returns success', async () => {
    const blob = new Blob(['content'])
    const executeDownloadOperation = vi
      .fn()
      .mockResolvedValue({ status: 'success', blob, contentDisposition: 'attachment; filename="reporte.pdf"' })
    const handlers = makeHandlers({ executeDownloadOperation })
    const action = makeAction({ body: { foo: 'bar' } })

    const result = await runDownloadAction(action, handlers, state, 'button.props.action.filename')

    expect(executeDownloadOperation).toHaveBeenCalledWith('downloadReport', {
      requestParams: {
        query: { format: 'pdf' },
        body: { foo: 'bar' },
        headers: { Authorization: 'Bearer token' },
      },
      iterationContext: undefined,
    })
    expect(createElementSpy).toHaveBeenCalledWith('a')
    expect(createObjectUrlSpy).toHaveBeenCalledWith(blob)
    expect(anchorClickSpy).toHaveBeenCalledTimes(1)
    expect(revokeObjectUrlSpy).toHaveBeenCalledWith('blob:mock-url')
    expect(result).toEqual({ status: 'success' })
  })

  it('does not trigger a download and returns error when executeDownloadOperation resolves to an error', async () => {
    const executeDownloadOperation = vi
      .fn()
      .mockResolvedValue({ status: 'error', error: { code: 'network', message: 'boom' } })
    const handlers = makeHandlers({ executeDownloadOperation })

    const result = await runDownloadAction(makeAction(), handlers, state, 'button.props.action.filename')

    expect(createObjectUrlSpy).not.toHaveBeenCalled()
    expect(anchorClickSpy).not.toHaveBeenCalled()
    expect(result).toEqual({ status: 'error' })
  })

  it('does not trigger a download and returns error when executeDownloadOperation is skipped (edit mode)', async () => {
    const executeDownloadOperation = vi.fn().mockResolvedValue({ status: 'skipped' })
    const handlers = makeHandlers({ executeDownloadOperation })

    const result = await runDownloadAction(makeAction(), handlers, state, 'button.props.action.filename')

    expect(createObjectUrlSpy).not.toHaveBeenCalled()
    expect(anchorClickSpy).not.toHaveBeenCalled()
    expect(result).toEqual({ status: 'error' })
  })

  it('revokes the blob URL after starting the download', async () => {
    const blob = new Blob(['content'])
    const executeDownloadOperation = vi
      .fn()
      .mockResolvedValue({ status: 'success', blob, contentDisposition: null })
    const handlers = makeHandlers({ executeDownloadOperation })

    await runDownloadAction(makeAction(), handlers, state, 'button.props.action.filename')

    const clickOrder = anchorClickSpy.mock.invocationCallOrder[0]
    const revokeOrder = revokeObjectUrlSpy.mock.invocationCallOrder[0]

    expect(revokeObjectUrlSpy).toHaveBeenCalledWith('blob:mock-url')
    expect(revokeOrder).toBeGreaterThan(clickOrder)
  })
})
