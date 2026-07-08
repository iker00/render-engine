import { describe, expect, it, vi } from 'vitest'
import type { ImageFetchConfig } from '../../config/runtime-config-types'
import { executeRuntimeBinaryFetch } from '../../queries/runtime-binary-fetch'
import type { RuntimeState } from '../../runtime/runtime-state/runtime-state-types'

const baseState: RuntimeState = {
  navigation: {
    currentPageId: 'home',
    currentEntryIndex: 0,
    history: [{ entryId: 0, pageId: 'home', params: {} }],
    lastError: null,
  },
  forms: {},
  queries: {
    heroImage: {
      status: 'success',
      data: { url: '/cdn/x.png' },
      error: null,
      requestSignature: null,
    },
    token: {
      status: 'success',
      data: 'Bearer xyz',
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
  modal: {
    activeModalId: null,
    activeIterationKey: null,
  },
}

function makeSuccessResponse(blob: Blob): typeof fetch {
  return vi.fn().mockResolvedValue(
    new Response(blob, { status: 200 }),
  ) as unknown as typeof fetch
}

function makeNetworkErrorFetch(): typeof fetch {
  return vi.fn().mockRejectedValue(new Error('Network failure')) as unknown as typeof fetch
}

function makeHttpErrorFetch(status: number): typeof fetch {
  return vi.fn().mockResolvedValue(new Response(null, { status })) as unknown as typeof fetch
}

describe('executeRuntimeBinaryFetch', () => {
  it('calls fetch with a literal URL and method GET by default, returns success blob', async () => {
    const bytes = new Uint8Array([137, 80, 78, 71])
    const blob = new Blob([bytes], { type: 'image/png' })
    const mockFetch = makeSuccessResponse(blob)

    const fetchConfig: ImageFetchConfig = { url: '/media/hero.png' }
    const result = await executeRuntimeBinaryFetch({
      fetchConfig,
      state: baseState,
      fetch: mockFetch,
    })

    expect(mockFetch).toHaveBeenCalledWith('/media/hero.png', { method: 'GET' })
    expect(result.status).toBe('success')
    if (result.status === 'success') {
      expect(result.blob.size).toBeGreaterThan(0)
    }
  })

  it('resolves a full reference in fetch.url from state', async () => {
    const blob = new Blob([new Uint8Array([1])], { type: 'image/png' })
    const mockFetch = makeSuccessResponse(blob)

    const fetchConfig: ImageFetchConfig = { url: 'queries.heroImage.data.url' }
    const result = await executeRuntimeBinaryFetch({
      fetchConfig,
      state: baseState,
      fetch: mockFetch,
    })

    expect(mockFetch).toHaveBeenCalledWith('/cdn/x.png', expect.anything())
    expect(result.status).toBe('success')
  })

  it('resolves a partial interpolation in fetch.url using iterationContext', async () => {
    const blob = new Blob([new Uint8Array([1])], { type: 'image/png' })
    const mockFetch = makeSuccessResponse(blob)

    const fetchConfig: ImageFetchConfig = { url: '/media/{{item.id}}.png' }
    const result = await executeRuntimeBinaryFetch({
      fetchConfig,
      state: baseState,
      iterationContext: { item: { id: '42' }, key: '42', itemIndex: 0 },
      fetch: mockFetch,
    })

    expect(mockFetch).toHaveBeenCalledWith('/media/42.png', expect.anything())
    expect(result.status).toBe('success')
  })

  it('sends POST with resolved headers and body, adds content-type when absent', async () => {
    const blob = new Blob([new Uint8Array([1])], { type: 'image/png' })
    const mockFetch = makeSuccessResponse(blob)

    const fetchConfig: ImageFetchConfig = {
      method: 'POST',
      url: '/media/upload',
      headers: { authorization: 'queries.token.data' },
      body: { id: 'item.id' },
    }
    const result = await executeRuntimeBinaryFetch({
      fetchConfig,
      state: baseState,
      iterationContext: { item: { id: '42' }, key: '42', itemIndex: 0 },
      fetch: mockFetch,
    })

    expect(mockFetch).toHaveBeenCalledWith('/media/upload', {
      method: 'POST',
      headers: {
        authorization: 'Bearer xyz',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ id: '42' }),
    })
    expect(result.status).toBe('success')
  })

  it('does not overwrite content-type when already declared in headers (any casing)', async () => {
    const blob = new Blob([new Uint8Array([1])], { type: 'image/png' })
    const mockFetch = makeSuccessResponse(blob)

    const fetchConfig: ImageFetchConfig = {
      method: 'POST',
      url: '/media/upload',
      headers: { 'Content-Type': 'application/octet-stream', authorization: 'queries.token.data' },
      body: { id: '42' },
    }
    await executeRuntimeBinaryFetch({
      fetchConfig,
      state: baseState,
      fetch: mockFetch,
    })

    const init = (mockFetch as ReturnType<typeof vi.fn>).mock.calls[0][1] as RequestInit
    const headers = init.headers as Record<string, string>
    const allKeys = Object.keys(headers)
    const contentTypeKeys = allKeys.filter((k) => k.toLowerCase() === 'content-type')
    expect(contentTypeKeys).toHaveLength(1)
    expect(headers[contentTypeKeys[0]]).toBe('application/octet-stream')
  })

  it('returns request-build-failed when url resolves to empty string', async () => {
    const mockFetch = vi.fn() as unknown as typeof fetch

    const fetchConfig: ImageFetchConfig = { url: 'queries.nonexistent.data.url' }
    const result = await executeRuntimeBinaryFetch({
      fetchConfig,
      state: baseState,
      fetch: mockFetch,
    })

    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.code).toBe('request-build-failed')
    }
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('returns request-build-failed when a header value does not resolve to string', async () => {
    const mockFetch = vi.fn() as unknown as typeof fetch

    const fetchConfig: ImageFetchConfig = {
      url: '/media/hero.png',
      headers: { authorization: 'queries.nonexistent.token' },
    }
    const result = await executeRuntimeBinaryFetch({
      fetchConfig,
      state: baseState,
      fetch: mockFetch,
    })

    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.code).toBe('request-build-failed')
    }
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('returns request-build-failed when a body string node does not resolve to a valid JSON value', async () => {
    const mockFetch = vi.fn() as unknown as typeof fetch

    const fetchConfig: ImageFetchConfig = {
      url: '/media/hero.png',
      body: { id: 'queries.nonexistent.data' },
    }
    const result = await executeRuntimeBinaryFetch({
      fetchConfig,
      state: baseState,
      fetch: mockFetch,
    })

    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.code).toBe('request-build-failed')
    }
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('returns network-error when fetch rejects', async () => {
    const mockFetch = makeNetworkErrorFetch()

    const fetchConfig: ImageFetchConfig = { url: '/media/hero.png' }
    const result = await executeRuntimeBinaryFetch({
      fetchConfig,
      state: baseState,
      fetch: mockFetch,
    })

    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.code).toBe('network-error')
    }
  })

  it('returns http-error when response.ok is false', async () => {
    const mockFetch = makeHttpErrorFetch(500)

    const fetchConfig: ImageFetchConfig = { url: '/media/hero.png' }
    const result = await executeRuntimeBinaryFetch({
      fetchConfig,
      state: baseState,
      fetch: mockFetch,
    })

    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.code).toBe('http-error')
    }
  })

  it('returns invalid-binary-response when blob has size 0', async () => {
    const emptyBlob = new Blob([], { type: 'image/png' })
    const mockResponse = {
      ok: true,
      blob: () => Promise.resolve(emptyBlob),
    } as unknown as Response
    const mockFetch = vi.fn().mockResolvedValue(mockResponse) as unknown as typeof fetch

    const fetchConfig: ImageFetchConfig = { url: '/media/hero.png' }
    const result = await executeRuntimeBinaryFetch({
      fetchConfig,
      state: baseState,
      fetch: mockFetch,
    })

    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.code).toBe('invalid-binary-response')
    }
  })

  it('returns invalid-binary-response when response.blob() rejects', async () => {
    const failingResponse = {
      ok: true,
      blob: () => Promise.reject(new Error('blob failed')),
    } as unknown as Response
    const mockFetch = vi.fn().mockResolvedValue(failingResponse) as unknown as typeof fetch

    const fetchConfig: ImageFetchConfig = { url: '/media/hero.png' }
    const result = await executeRuntimeBinaryFetch({
      fetchConfig,
      state: baseState,
      fetch: mockFetch,
    })

    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.code).toBe('invalid-binary-response')
    }
  })

  it('does not mutate the state object', async () => {
    const blob = new Blob([new Uint8Array([1])], { type: 'image/png' })
    const mockFetch = makeSuccessResponse(blob)

    const stateBefore = JSON.parse(JSON.stringify({ queries: baseState.queries, forms: baseState.forms, navigation: baseState.navigation }))

    const fetchConfig: ImageFetchConfig = { url: '/media/hero.png' }
    await executeRuntimeBinaryFetch({
      fetchConfig,
      state: baseState,
      fetch: mockFetch,
    })

    expect(JSON.stringify({ queries: baseState.queries, forms: baseState.forms, navigation: baseState.navigation })).toBe(
      JSON.stringify(stateBefore),
    )
  })
})
