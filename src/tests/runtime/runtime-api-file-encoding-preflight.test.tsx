import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { RuntimeConfig } from '../../config/runtime-config'
import {
  buildRuntimeApiRequest,
  executeInlineRuntimeApiOperation,
  executeRuntimeApiOperation,
  resolveFileInputSourcesOverrides,
} from '../../queries/runtime-api-executor'
import {
  RuntimeStateProvider,
  useRuntimeState,
  useRuntimeStateActions,
} from '../../runtime/runtime-state/runtime-state-provider'
import type { RuntimeState } from '../../runtime/runtime-state/runtime-state-types'

const runtimeState: RuntimeState = {
  navigation: {
    currentPageId: 'home',
    history: [{ entryId: 0, pageId: 'home', params: {} }],
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
}

const runtimeConfig: RuntimeConfig = {
  api: {
    plainOperation: {
      method: 'POST',
      endpoint: '/api/plain',
      body: { name: 'literal' },
    },
    uploadPhotos: {
      method: 'POST',
      endpoint: '/api/upload',
      body: { photos: 'forms.uploadForm.photos' },
    },
    uploadUnrelatedBody: {
      method: 'POST',
      endpoint: '/api/upload',
      body: { note: 'literal note' },
    },
    uploadMultipartLegacy: {
      method: 'POST',
      endpoint: '/api/upload',
    },
  },
  initialPage: 'home',
  pages: [
    {
      id: 'home',
      layout: [],
    },
  ],
}

function successResponse() {
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

describe('executor', () => {
  it('produces the same request/JSON body as today when fileInputSources is not passed (regression)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(successResponse())

    const result = await executeRuntimeApiOperation({
      config: runtimeConfig,
      operationName: 'plainOperation',
      state: runtimeState,
      fetch: fetchMock,
    })

    expect(result.status).toBe('success')

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(init.body).toBe(JSON.stringify({ name: 'literal' }))
    expect((init.headers as Record<string, string>)['content-type']).toBe('application/json')
  })

  it('treats fileInputSources with an empty valuesByFieldId as equivalent to not passing it', async () => {
    const fetchMock = vi.fn().mockResolvedValue(successResponse())

    const result = await executeRuntimeApiOperation({
      config: runtimeConfig,
      operationName: 'plainOperation',
      state: runtimeState,
      fileInputSources: { formId: 'uploadForm', valuesByFieldId: {} },
      fetch: fetchMock,
    })

    expect(result.status).toBe('success')

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(init.body).toBe(JSON.stringify({ name: 'literal' }))
    expect((init.headers as Record<string, string>)['content-type']).toBe('application/json')
  })

  it('encodes referenced files to base64 entries and injects them at the referenced body key', async () => {
    const fileA = new File([new Uint8Array([1, 2, 3])], 'a.png', { type: 'image/png' })
    const fileB = new File([new Uint8Array([4, 5, 6, 7])], 'b.png', { type: 'image/png' })
    const fetchMock = vi.fn().mockResolvedValue(successResponse())

    const result = await executeRuntimeApiOperation({
      config: runtimeConfig,
      operationName: 'uploadPhotos',
      state: runtimeState,
      fileInputSources: { formId: 'uploadForm', valuesByFieldId: { photos: [fileA, fileB] } },
      fetch: fetchMock,
    })

    expect(result.status).toBe('success')

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect((init.headers as Record<string, string>)['content-type']).toBe('application/json')

    const parsedBody = JSON.parse(init.body as string) as { photos: unknown }
    expect(parsedBody.photos).toEqual([
      { name: 'a.png', size: 3, mime: 'image/png', data: expect.any(String) },
      { name: 'b.png', size: 4, mime: 'image/png', data: expect.any(String) },
    ])
  })

  it('does not add a body key for files that are not referenced by the body tree', async () => {
    const fileA = new File([new Uint8Array([1, 2, 3])], 'a.png', { type: 'image/png' })
    const fetchMock = vi.fn().mockResolvedValue(successResponse())

    const result = await executeRuntimeApiOperation({
      config: runtimeConfig,
      operationName: 'uploadUnrelatedBody',
      state: runtimeState,
      fileInputSources: { formId: 'uploadForm', valuesByFieldId: { photos: [fileA] } },
      fetch: fetchMock,
    })

    expect(result.status).toBe('success')

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    const parsedBody = JSON.parse(init.body as string) as Record<string, unknown>
    expect(parsedBody).toEqual({ note: 'literal note' })
    expect(parsedBody.photos).toBeUndefined()
  })

  it('serializes an empty file selection as an empty array at the referenced body key', async () => {
    const fetchMock = vi.fn().mockResolvedValue(successResponse())

    const result = await executeRuntimeApiOperation({
      config: runtimeConfig,
      operationName: 'uploadPhotos',
      state: runtimeState,
      fileInputSources: { formId: 'uploadForm', valuesByFieldId: { photos: [] } },
      fetch: fetchMock,
    })

    expect(result.status).toBe('success')

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(init.body).toBe(JSON.stringify({ photos: [] }))
  })

  it('returns request-build-failed without calling fetch when at least one file fails to encode', async () => {
    const goodFile = new File([new Uint8Array([1, 2, 3])], 'good.png', { type: 'image/png' })
    const badFile = new File([new Uint8Array([4, 5, 6])], 'bad.png', { type: 'image/png' })

    const original = FileReader.prototype.readAsArrayBuffer
    const spy = vi.spyOn(FileReader.prototype, 'readAsArrayBuffer').mockImplementation(function (
      this: FileReader,
      blob: Blob,
    ) {
      if (blob === badFile) {
        queueMicrotask(() => this.dispatchEvent(new Event('error')))
        return
      }
      original.call(this, blob)
    })

    const fetchMock = vi.fn()

    const result = await executeRuntimeApiOperation({
      config: runtimeConfig,
      operationName: 'uploadPhotos',
      state: runtimeState,
      fileInputSources: { formId: 'uploadForm', valuesByFieldId: { photos: [goodFile, badFile] } },
      fetch: fetchMock,
    })

    expect(result).toEqual({
      status: 'error',
      error: {
        code: 'request-build-failed',
        message: expect.any(String),
      },
    })
    expect(fetchMock).not.toHaveBeenCalled()

    spy.mockRestore()
  })

  it('keeps the legacy multipart branch in control when requestParams.files coexists with fileInputSources', async () => {
    const docFile = new File(['content'], 'doc.pdf', { type: 'application/pdf' })
    const photoFile = new File([new Uint8Array([1, 2, 3])], 'photo.png', { type: 'image/png' })
    const fetchMock = vi.fn().mockResolvedValue(successResponse())

    const result = await executeRuntimeApiOperation({
      config: runtimeConfig,
      operationName: 'uploadMultipartLegacy',
      state: runtimeState,
      requestParams: {
        files: [{ name: 'file', file: docFile }],
      },
      fileInputSources: { formId: 'uploadForm', valuesByFieldId: { photos: [photoFile] } },
      fetch: fetchMock,
    })

    expect(result.status).toBe('success')

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(init.body).toBeInstanceOf(FormData)

    const formData = init.body as FormData
    expect(formData.get('file')).toBeInstanceOf(File)
    // fileInputSources is still encoded (no error), but has no observable effect
    // on the multipart body since nothing references it.
    expect(formData.get('photos')).toBeNull()
  })

  it('produces a stable requestSignature across two successive encodings of the same fileInputSources', async () => {
    const fileA = new File([new Uint8Array([1, 2, 3])], 'a.png', { type: 'image/png' })
    const fileInputSources = { formId: 'uploadForm', valuesByFieldId: { photos: [fileA] } }

    const overrides1 = await resolveFileInputSourcesOverrides(fileInputSources)
    const overrides2 = await resolveFileInputSourcesOverrides(fileInputSources)

    expect(overrides1.status).toBe('ready')
    expect(overrides2.status).toBe('ready')
    if (overrides1.status !== 'ready' || overrides2.status !== 'ready') return

    const request1 = buildRuntimeApiRequest({
      config: runtimeConfig,
      operationName: 'uploadPhotos',
      state: runtimeState,
      fileValueOverrides: overrides1.fileValueOverrides,
    })
    const request2 = buildRuntimeApiRequest({
      config: runtimeConfig,
      operationName: 'uploadPhotos',
      state: runtimeState,
      fileValueOverrides: overrides2.fileValueOverrides,
    })

    expect(request1.status).toBe('ready')
    expect(request2.status).toBe('ready')
    if (request1.status !== 'ready' || request2.status !== 'ready') return

    expect(request1.request.requestSignature).toBe(request2.request.requestSignature)
  })

  it('applies the same preflight encoding in executeInlineRuntimeApiOperation', async () => {
    const fileA = new File([new Uint8Array([1, 2, 3])], 'a.png', { type: 'image/png' })
    const fetchMock = vi.fn().mockResolvedValue(successResponse())

    const result = await executeInlineRuntimeApiOperation({
      operation: runtimeConfig.api.uploadPhotos,
      operationName: 'uploadPhotos',
      state: runtimeState,
      fileInputSources: { formId: 'uploadForm', valuesByFieldId: { photos: [fileA] } },
      fetch: fetchMock,
    })

    expect(result.status).toBe('success')

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    const parsedBody = JSON.parse(init.body as string) as { photos: unknown }
    expect(parsedBody.photos).toEqual([{ name: 'a.png', size: 3, mime: 'image/png', data: expect.any(String) }])
  })

  it('returns request-build-failed without calling fetch in executeInlineRuntimeApiOperation when encoding fails', async () => {
    const badFile = new File([new Uint8Array([1, 2, 3])], 'bad.png', { type: 'image/png' })
    const spy = vi.spyOn(FileReader.prototype, 'readAsArrayBuffer').mockImplementation(function (this: FileReader) {
      queueMicrotask(() => this.dispatchEvent(new Event('error')))
    })

    const fetchMock = vi.fn()

    const result = await executeInlineRuntimeApiOperation({
      operation: runtimeConfig.api.uploadPhotos,
      operationName: 'uploadPhotos',
      state: runtimeState,
      fileInputSources: { formId: 'uploadForm', valuesByFieldId: { photos: [badFile] } },
      fetch: fetchMock,
    })

    expect(result).toEqual({
      status: 'error',
      error: {
        code: 'request-build-failed',
        message: expect.any(String),
      },
    })
    expect(fetchMock).not.toHaveBeenCalled()

    spy.mockRestore()
  })
})

describe('provider wiring', () => {
  const providerConfig: RuntimeConfig = {
    api: {
      uploadOp: {
        method: 'POST',
        endpoint: '/api/upload',
        body: { photos: 'forms.uploadForm.photos' },
      },
    },
    initialPage: 'home',
    pages: [
      {
        id: 'home',
        layout: [],
      },
    ],
  }

  function RuntimeStateSnapshot({ testId }: { testId: string }) {
    const state = useRuntimeState()
    return <pre data-testid={testId}>{JSON.stringify(state)}</pre>
  }

  function readRuntimeStateSnapshot(testId: string) {
    return JSON.parse(screen.getByTestId(testId).textContent ?? '') as RuntimeState
  }

  function UploadOperationFixture({ files, fetchMock }: { files: File[]; fetchMock: typeof fetch }) {
    const { executeQueryOperation } = useRuntimeStateActions()

    return (
      <>
        <button
          type="button"
          onClick={() =>
            void executeQueryOperation('uploadOp', {
              fetch: fetchMock,
              fileInputSources: { formId: 'uploadForm', valuesByFieldId: { photos: files } },
            })
          }
        >
          Execute upload
        </button>
        <RuntimeStateSnapshot testId="runtime-state" />
      </>
    )
  }

  it('propagates fileInputSources to the executor and produces the expected base64 JSON body', async () => {
    const file = new File([new Uint8Array([1, 2, 3])], 'a.png', { type: 'image/png' })
    const fetchMock = vi.fn().mockResolvedValue(successResponse())

    render(
      <RuntimeStateProvider config={providerConfig}>
        <UploadOperationFixture files={[file]} fetchMock={fetchMock} />
      </RuntimeStateProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Execute upload' }))

    await waitFor(() =>
      expect(readRuntimeStateSnapshot('runtime-state').queries.uploadOp).toMatchObject({
        status: 'success',
      }),
    )

    expect(fetchMock).toHaveBeenCalledOnce()
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    const parsedBody = JSON.parse(init.body as string) as { photos: unknown }
    expect(parsedBody.photos).toEqual([{ name: 'a.png', size: 3, mime: 'image/png', data: expect.any(String) }])
  })

  it('transitions the query to error with code request-build-failed and never dispatches success when encoding fails', async () => {
    const brokenFile = new File([new Uint8Array([9, 9, 9])], 'broken.png', { type: 'image/png' })
    const spy = vi.spyOn(FileReader.prototype, 'readAsArrayBuffer').mockImplementation(function (this: FileReader) {
      queueMicrotask(() => this.dispatchEvent(new Event('error')))
    })

    const fetchMock = vi.fn()

    render(
      <RuntimeStateProvider config={providerConfig}>
        <UploadOperationFixture files={[brokenFile]} fetchMock={fetchMock} />
      </RuntimeStateProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Execute upload' }))

    await waitFor(() =>
      expect(readRuntimeStateSnapshot('runtime-state').queries.uploadOp).toMatchObject({
        status: 'error',
        error: { code: 'request-build-failed' },
      }),
    )

    expect(fetchMock).not.toHaveBeenCalled()

    spy.mockRestore()
  })
})
