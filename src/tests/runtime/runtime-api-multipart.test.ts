import { describe, expect, it, vi } from 'vitest'
import type { RuntimeConfig } from '../../config/runtime-config'
import {
  buildRuntimeApiRequest,
  executeBuiltRuntimeApiRequest,
} from '../../queries/runtime-api-executor'
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
    uploadDocuments: {
      method: 'POST',
      endpoint: '/api/upload',
    },
    uploadWithBody: {
      method: 'POST',
      endpoint: '/api/upload',
    },
    uploadWithNestedBody: {
      method: 'POST',
      endpoint: '/api/upload',
    },
    uploadWithArrayBody: {
      method: 'POST',
      endpoint: '/api/upload',
    },
    uploadWithExplicitContentType: {
      method: 'POST',
      endpoint: '/api/upload',
    },
    getDocuments: {
      method: 'GET',
      endpoint: '/api/documents',
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

describe('Runtime api multipart (files)', () => {
  it('produces FormData body with a single file entry and no content-type when files is provided without body', () => {
    const docFile = new File(['pdf content'], 'doc.pdf', { type: 'application/pdf' })

    const result = buildRuntimeApiRequest({
      config: runtimeConfig,
      operationName: 'uploadDocuments',
      state: runtimeState,
      requestParams: {
        files: [{ name: 'file', file: docFile }],
      },
    })

    expect(result.status).toBe('ready')

    if (result.status !== 'ready') return

    const { init } = result.request
    expect(init.body).toBeInstanceOf(FormData)

    const formData = init.body as FormData
    const gotFile = formData.get('file') as File
    expect(gotFile).toBeInstanceOf(File)
    expect(gotFile.name).toBe('doc.pdf')
    expect(gotFile.type).toBe('application/pdf')

    // No content-type should be auto-injected
    const headers = init.headers as Record<string, string> | undefined
    if (headers) {
      const keys = Object.keys(headers).map((k) => k.toLowerCase())
      expect(keys).not.toContain('content-type')
    }
  })

  it('produces FormData with both the file entry and scalar body fields as text entries', () => {
    const docFile = new File(['content'], 'doc.pdf', { type: 'application/pdf' })

    const result = buildRuntimeApiRequest({
      config: runtimeConfig,
      operationName: 'uploadWithBody',
      state: runtimeState,
      requestParams: {
        files: [{ name: 'file', file: docFile }],
        body: { upload_multiple_field_name: 'documentos' },
      },
    })

    expect(result.status).toBe('ready')

    if (result.status !== 'ready') return

    const formData = result.request.init.body as FormData
    const gotFile = formData.get('file') as File
    expect(gotFile).toBeInstanceOf(File)
    expect(gotFile.name).toBe('doc.pdf')
    expect(formData.get('upload_multiple_field_name')).toBe('documentos')
  })

  it('returns request-build-failed when body contains a nested object in multipart mode', () => {
    const docFile = new File(['content'], 'doc.pdf', { type: 'application/pdf' })

    const result = buildRuntimeApiRequest({
      config: runtimeConfig,
      operationName: 'uploadWithNestedBody',
      state: runtimeState,
      requestParams: {
        files: [{ name: 'file', file: docFile }],
        body: { nested: { key: 'value' } },
      },
    })

    expect(result).toEqual({
      status: 'error',
      error: {
        code: 'request-build-failed',
        message: 'The api operation "uploadWithNestedBody" cannot serialize "body.nested" for multipart payload (only scalar values are allowed).',
      },
    })
  })

  it('returns request-build-failed when body contains an array in multipart mode', () => {
    const docFile = new File(['content'], 'items.pdf', { type: 'application/pdf' })

    const result = buildRuntimeApiRequest({
      config: runtimeConfig,
      operationName: 'uploadWithArrayBody',
      state: runtimeState,
      requestParams: {
        files: [{ name: 'file', file: docFile }],
        body: { items: [1, 2] },
      },
    })

    expect(result).toEqual({
      status: 'error',
      error: {
        code: 'request-build-failed',
        message: 'The api operation "uploadWithArrayBody" cannot serialize "body.items" for multipart payload (only scalar values are allowed).',
      },
    })
  })

  it('preserves an explicit content-type header and does not overwrite it in multipart mode', () => {
    const docFile = new File(['content'], 'doc.pdf', { type: 'application/pdf' })

    const result = buildRuntimeApiRequest({
      config: runtimeConfig,
      operationName: 'uploadDocuments',
      state: runtimeState,
      requestParams: {
        files: [{ name: 'file', file: docFile }],
        headers: { 'content-type': 'multipart/form-data; boundary=abc' },
      },
    })

    expect(result.status).toBe('ready')

    if (result.status !== 'ready') return

    const headers = result.request.init.headers as Record<string, string>
    expect(headers['content-type']).toBe('multipart/form-data; boundary=abc')
  })

  it('falls back to JSON path when files array is empty (behaves as if files is absent)', () => {
    const result = buildRuntimeApiRequest({
      config: runtimeConfig,
      operationName: 'uploadDocuments',
      state: runtimeState,
      requestParams: {
        files: [],
        body: { fieldName: 'docs' },
      },
    })

    expect(result.status).toBe('ready')

    if (result.status !== 'ready') return

    const { init } = result.request
    // Should use JSON path, not FormData
    expect(init.body).not.toBeInstanceOf(FormData)
    expect(init.body).toBe(JSON.stringify({ fieldName: 'docs' }))
  })

  it('produces a stable requestSignature for two calls with files having identical metadata but different File instances', () => {
    // Same name, content size, and type — different object references
    const file1 = new File(['content'], 'doc.pdf', { type: 'application/pdf' })
    const file2 = new File(['content'], 'doc.pdf', { type: 'application/pdf' })

    const result1 = buildRuntimeApiRequest({
      config: runtimeConfig,
      operationName: 'uploadDocuments',
      state: runtimeState,
      requestParams: {
        files: [{ name: 'file', file: file1 }],
      },
    })

    const result2 = buildRuntimeApiRequest({
      config: runtimeConfig,
      operationName: 'uploadDocuments',
      state: runtimeState,
      requestParams: {
        files: [{ name: 'file', file: file2 }],
      },
    })

    expect(result1.status).toBe('ready')
    expect(result2.status).toBe('ready')

    if (result1.status !== 'ready' || result2.status !== 'ready') return

    expect(result1.request.requestSignature).toBe(result2.request.requestSignature)
  })

  it('changes requestSignature when file size changes', () => {
    const smallFile = new File(['hi'], 'doc.pdf', { type: 'application/pdf' })
    const largeFile = new File(['much larger content here'], 'doc.pdf', { type: 'application/pdf' })

    const result1 = buildRuntimeApiRequest({
      config: runtimeConfig,
      operationName: 'uploadDocuments',
      state: runtimeState,
      requestParams: {
        files: [{ name: 'file', file: smallFile }],
      },
    })

    const result2 = buildRuntimeApiRequest({
      config: runtimeConfig,
      operationName: 'uploadDocuments',
      state: runtimeState,
      requestParams: {
        files: [{ name: 'file', file: largeFile }],
      },
    })

    expect(result1.status).toBe('ready')
    expect(result2.status).toBe('ready')

    if (result1.status !== 'ready' || result2.status !== 'ready') return

    expect(result1.request.requestSignature).not.toBe(result2.request.requestSignature)
  })

  it('changes requestSignature when file type changes', () => {
    const pdfFile = new File(['content'], 'doc.pdf', { type: 'application/pdf' })
    const jpgFile = new File(['content'], 'doc.pdf', { type: 'image/jpeg' })

    const result1 = buildRuntimeApiRequest({
      config: runtimeConfig,
      operationName: 'uploadDocuments',
      state: runtimeState,
      requestParams: {
        files: [{ name: 'file', file: pdfFile }],
      },
    })

    const result2 = buildRuntimeApiRequest({
      config: runtimeConfig,
      operationName: 'uploadDocuments',
      state: runtimeState,
      requestParams: {
        files: [{ name: 'file', file: jpgFile }],
      },
    })

    expect(result1.status).toBe('ready')
    expect(result2.status).toBe('ready')

    if (result1.status !== 'ready' || result2.status !== 'ready') return

    expect(result1.request.requestSignature).not.toBe(result2.request.requestSignature)
  })

  it('produces identical requestSignature for a pure JSON request as without files (regression)', () => {
    const jsonResult = buildRuntimeApiRequest({
      config: runtimeConfig,
      operationName: 'getDocuments',
      state: runtimeState,
    })

    const jsonResultWithEmptyFiles = buildRuntimeApiRequest({
      config: runtimeConfig,
      operationName: 'getDocuments',
      state: runtimeState,
      requestParams: {
        files: [],
      },
    })

    expect(jsonResult.status).toBe('ready')
    expect(jsonResultWithEmptyFiles.status).toBe('ready')

    if (jsonResult.status !== 'ready' || jsonResultWithEmptyFiles.status !== 'ready') return

    expect(jsonResult.request.requestSignature).toBe(jsonResultWithEmptyFiles.request.requestSignature)
  })

  it('passes FormData as init.body to fetch and preserves method and url in executeBuiltRuntimeApiRequest', async () => {
    const docFile = new File(['content'], 'doc.pdf', { type: 'application/pdf' })

    const buildResult = buildRuntimeApiRequest({
      config: runtimeConfig,
      operationName: 'uploadDocuments',
      state: runtimeState,
      requestParams: {
        files: [{ name: 'file', file: docFile }],
      },
    })

    expect(buildResult.status).toBe('ready')

    if (buildResult.status !== 'ready') return

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ status: 'OK' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )

    await executeBuiltRuntimeApiRequest({
      request: buildResult.request,
      fetch: fetchMock,
    })

    expect(fetchMock).toHaveBeenCalledOnce()
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/upload')
    expect(init.method).toBe('POST')
    expect(init.body).toBeInstanceOf(FormData)
  })
})
