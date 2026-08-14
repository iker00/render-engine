import { afterEach, describe, expect, it, vi } from 'vitest'
import { postToPlatages } from '../../dev-runtime/platages-http-client'

afterEach(() => {
  vi.unstubAllGlobals()
})

function makeOkResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Response
}

function makeErrorResponse(
  status: number,
  jsonMock: ReturnType<typeof vi.fn> = vi.fn(),
): Response {
  return {
    ok: false,
    status,
    json: jsonMock,
  } as unknown as Response
}

function stubFetch(response: Response) {
  const fetchMock = vi.fn().mockResolvedValue(response)
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function stubFetchRejecting(error: Error) {
  const fetchMock = vi.fn().mockRejectedValue(error)
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('postToPlatages — request shape', () => {
  it('invokes fetch with the exact url, method, headers and JSON-stringified body', async () => {
    const fetchMock = stubFetch(makeOkResponse({ foo: 'bar' }))

    await postToPlatages('https://custom.example/op', { a: 1 }, 'my-token')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://custom.example/op')
    expect(init.method).toBe('POST')
    expect(init.body).toBe(JSON.stringify({ a: 1 }))
    expect(init.headers).toEqual({
      'Content-Type': 'application/json',
      Authorization: 'Bearer my-token',
    })
  })

  it('resolves to status ok with the parsed JSON data on a 2xx response', async () => {
    stubFetch(makeOkResponse({ foo: 'bar' }))

    const result = await postToPlatages('https://custom.example/op', {}, 'token')

    expect(result).toEqual({ status: 'ok', data: { foo: 'bar' } })
  })
})

describe('postToPlatages — error mapping', () => {
  it('maps HTTP 401 to an auth error without reading the response body', async () => {
    const jsonMock = vi.fn()
    stubFetch(makeErrorResponse(401, jsonMock))

    const result = await postToPlatages('https://custom.example/op', {}, 'token')

    expect(result).toEqual({
      status: 'error',
      error: {
        kind: 'auth',
        message: 'La autenticación con el proveedor externo falló. Revisa el token seleccionado.',
      },
    })
    expect(jsonMock).not.toHaveBeenCalled()
  })

  it('maps HTTP 403 to the same auth error without reading the response body', async () => {
    const jsonMock = vi.fn()
    stubFetch(makeErrorResponse(403, jsonMock))

    const result = await postToPlatages('https://custom.example/op', {}, 'token')

    expect(result).toEqual({
      status: 'error',
      error: {
        kind: 'auth',
        message: 'La autenticación con el proveedor externo falló. Revisa el token seleccionado.',
      },
    })
    expect(jsonMock).not.toHaveBeenCalled()
  })

  it('maps a non-auth error with a non-empty message body to an integration error using that message', async () => {
    const jsonMock = vi.fn().mockResolvedValue({ code: 'X', message: 'algo fallo' })
    stubFetch(makeErrorResponse(500, jsonMock))

    const result = await postToPlatages('https://custom.example/op', {}, 'token')

    expect(result).toEqual({
      status: 'error',
      error: { kind: 'integration', message: 'algo fallo' },
    })
  })

  it('maps a non-auth error with no message field to a fallback integration message with the HTTP code', async () => {
    const jsonMock = vi.fn().mockResolvedValue({ code: 'X' })
    stubFetch(makeErrorResponse(500, jsonMock))

    const result = await postToPlatages('https://custom.example/op', {}, 'token')

    expect(result).toEqual({
      status: 'error',
      error: {
        kind: 'integration',
        message: 'La llamada al proveedor externo falló (HTTP 500).',
      },
    })
  })

  it('maps a non-auth error with an empty-string message to the same fallback integration message', async () => {
    const jsonMock = vi.fn().mockResolvedValue({ message: '   ' })
    stubFetch(makeErrorResponse(502, jsonMock))

    const result = await postToPlatages('https://custom.example/op', {}, 'token')

    expect(result).toEqual({
      status: 'error',
      error: {
        kind: 'integration',
        message: 'La llamada al proveedor externo falló (HTTP 502).',
      },
    })
  })

  it('maps a non-auth error with a non-JSON body to the same fallback integration message', async () => {
    const jsonMock = vi.fn().mockRejectedValue(new Error('Unexpected token'))
    stubFetch(makeErrorResponse(500, jsonMock))

    const result = await postToPlatages('https://custom.example/op', {}, 'token')

    expect(result).toEqual({
      status: 'error',
      error: {
        kind: 'integration',
        message: 'La llamada al proveedor externo falló (HTTP 500).',
      },
    })
  })

  it('maps a network failure (fetch throws) to a generic integration error', async () => {
    stubFetchRejecting(new Error('Network down'))

    const result = await postToPlatages('https://custom.example/op', {}, 'token')

    expect(result).toEqual({
      status: 'error',
      error: { kind: 'integration', message: 'No se pudo contactar con el proveedor externo.' },
    })
  })

  it('maps a 2xx response with a non-JSON body to a generic integration error', async () => {
    const response = {
      ok: true,
      status: 200,
      json: vi.fn().mockRejectedValue(new Error('Unexpected token')),
    } as unknown as Response
    stubFetch(response)

    const result = await postToPlatages('https://custom.example/op', {}, 'token')

    expect(result).toEqual({
      status: 'error',
      error: { kind: 'integration', message: 'No se pudo contactar con el proveedor externo.' },
    })
  })
})
