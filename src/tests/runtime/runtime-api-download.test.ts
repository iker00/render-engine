import { describe, expect, it, vi } from 'vitest'
import { executeBuiltRuntimeApiDownloadRequest } from '../../queries/runtime-api-download'
import type { RuntimeApiRequest } from '../../queries/runtime-api-types'

function makeRequest(overrides: Partial<RuntimeApiRequest> = {}): RuntimeApiRequest {
  return {
    operationName: 'downloadReport',
    operation: {
      method: 'GET',
      endpoint: '/api/reports/1/download',
    },
    url: '/api/reports/1/download',
    init: { method: 'GET' },
    descriptor: {
      operationName: 'downloadReport',
      method: 'GET',
      endpoint: '/api/reports/1/download',
    },
    requestSignature: 'downloadReport:{}',
    ...overrides,
  }
}

describe('executeBuiltRuntimeApiDownloadRequest', () => {
  it('returns success with the blob and content-disposition header on a non-empty 2xx response', async () => {
    const bytes = new Uint8Array([1, 2, 3, 4])
    const blob = new Blob([bytes], { type: 'application/pdf' })
    const response = new Response(blob, {
      status: 200,
      headers: { 'content-disposition': 'attachment; filename="report.pdf"' },
    })
    const mockFetch = vi.fn().mockResolvedValue(response) as unknown as typeof fetch

    const request = makeRequest()
    const result = await executeBuiltRuntimeApiDownloadRequest({ request, fetch: mockFetch })

    expect(result.status).toBe('success')
    if (result.status === 'success') {
      expect(result.blob.size).toBeGreaterThan(0)
      expect(result.contentDisposition).toBe('attachment; filename="report.pdf"')
    }
  })

  it('returns success with null content-disposition when the header is absent', async () => {
    const blob = new Blob([new Uint8Array([1])], { type: 'application/pdf' })
    const response = new Response(blob, { status: 200 })
    const mockFetch = vi.fn().mockResolvedValue(response) as unknown as typeof fetch

    const request = makeRequest()
    const result = await executeBuiltRuntimeApiDownloadRequest({ request, fetch: mockFetch })

    expect(result.status).toBe('success')
    if (result.status === 'success') {
      expect(result.contentDisposition).toBeNull()
    }
  })

  it('treats an empty body on a 2xx response as a valid download, not an error', async () => {
    const response = new Response(null, { status: 200 })
    const mockFetch = vi.fn().mockResolvedValue(response) as unknown as typeof fetch

    const request = makeRequest()
    const result = await executeBuiltRuntimeApiDownloadRequest({ request, fetch: mockFetch })

    expect(result.status).toBe('success')
    if (result.status === 'success') {
      expect(result.blob.size).toBe(0)
    }
  })

  it('returns network-error when fetch rejects', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('Network failure')) as unknown as typeof fetch

    const request = makeRequest()
    const result = await executeBuiltRuntimeApiDownloadRequest({ request, fetch: mockFetch })

    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.code).toBe('network-error')
    }
  })

  it('returns http-error without reading the body when response.ok is false', async () => {
    const blobSpy = vi.fn()
    const response = {
      ok: false,
      status: 500,
      headers: new Headers(),
      blob: blobSpy,
    } as unknown as Response
    const mockFetch = vi.fn().mockResolvedValue(response) as unknown as typeof fetch

    const request = makeRequest()
    const result = await executeBuiltRuntimeApiDownloadRequest({ request, fetch: mockFetch })

    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.code).toBe('http-error')
    }
    expect(blobSpy).not.toHaveBeenCalled()
  })

  it('returns network-error when response.blob() rejects after an ok response', async () => {
    const response = {
      ok: true,
      status: 200,
      headers: new Headers(),
      blob: () => Promise.reject(new Error('blob failed')),
    } as unknown as Response
    const mockFetch = vi.fn().mockResolvedValue(response) as unknown as typeof fetch

    const request = makeRequest()
    const result = await executeBuiltRuntimeApiDownloadRequest({ request, fetch: mockFetch })

    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.code).toBe('network-error')
    }
  })

  it('calls fetch with exactly the url and init from the built request, without reconstruction', async () => {
    const blob = new Blob([new Uint8Array([1])], { type: 'application/pdf' })
    const response = new Response(blob, { status: 200 })
    const mockFetch = vi.fn().mockResolvedValue(response) as unknown as typeof fetch

    const init: RequestInit = { method: 'POST', headers: { authorization: 'Bearer xyz' }, body: '{"id":1}' }
    const request = makeRequest({ url: '/api/reports/download', init })
    await executeBuiltRuntimeApiDownloadRequest({ request, fetch: mockFetch })

    expect(mockFetch).toHaveBeenCalledWith('/api/reports/download', init)
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })
})
