import { afterEach, describe, expect, it, vi } from 'vitest'
import { createPlatagesSaveConfigProvider } from '../../dev-runtime/endpoints-config/save-config-provider'

afterEach(() => {
  vi.unstubAllGlobals()
})

const SAVE_INPUT = {
  url: 'https://custom.example/platages/actualizar',
  token: 'my-token',
  idGestion: 10,
  idSeccion: 20,
  idObjetoOcurrencia: 267,
  configJson: '{"pages":[]}',
}

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

describe('createPlatagesSaveConfigProvider — request shape', () => {
  it('invokes fetch at the given url with the exact payload, integer fields and bearer token', async () => {
    const fetchMock = stubFetch(
      makeOkResponse({ ActualizarJsonConfiguracionSalidaDTO: { Resultado: true } }),
    )

    const provider = createPlatagesSaveConfigProvider()
    await provider.save(SAVE_INPUT)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe(SAVE_INPUT.url)
    expect(init.method).toBe('POST')
    expect(init.headers).toEqual({
      'Content-Type': 'application/json',
      Authorization: 'Bearer my-token',
    })
    expect(init.body).toBe(
      JSON.stringify({
        ActualizarJsonConfiguracionEntradaDTO: {
          IdGestion: 10,
          IdSeccion: 20,
          IdObjetoOcurrencia: 267,
          Json: '{"pages":[]}',
        },
      }),
    )
  })

  it('transmits configJson as-is inside Json without parsing it', async () => {
    const fetchMock = stubFetch(
      makeOkResponse({ ActualizarJsonConfiguracionSalidaDTO: { Resultado: true } }),
    )

    const provider = createPlatagesSaveConfigProvider()
    await provider.save({ ...SAVE_INPUT, configJson: '{"a":1,"b":[1,2]}' })

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    const sentBody = JSON.parse(init.body as string) as {
      ActualizarJsonConfiguracionEntradaDTO: { Json: string }
    }
    expect(sentBody.ActualizarJsonConfiguracionEntradaDTO.Json).toBe('{"a":1,"b":[1,2]}')
    expect(typeof sentBody.ActualizarJsonConfiguracionEntradaDTO.Json).toBe('string')
  })
})

describe('createPlatagesSaveConfigProvider — success and business-result mapping', () => {
  it('resolves to status ok when the response is 200 with Resultado: true', async () => {
    stubFetch(makeOkResponse({ ActualizarJsonConfiguracionSalidaDTO: { Resultado: true } }))

    const provider = createPlatagesSaveConfigProvider()
    const result = await provider.save(SAVE_INPUT)

    expect(result).toEqual({ status: 'ok' })
  })

  it('resolves to an integration error when the response is 200 with Resultado: false', async () => {
    stubFetch(makeOkResponse({ ActualizarJsonConfiguracionSalidaDTO: { Resultado: false } }))

    const provider = createPlatagesSaveConfigProvider()
    const result = await provider.save(SAVE_INPUT)

    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.kind).toBe('integration')
      expect(result.error.message.length).toBeGreaterThan(0)
    }
  })

  it('resolves to an integration error when the response is 200 without ActualizarJsonConfiguracionSalidaDTO', async () => {
    stubFetch(makeOkResponse({}))

    const provider = createPlatagesSaveConfigProvider()
    const result = await provider.save(SAVE_INPUT)

    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.kind).toBe('integration')
    }
  })

  it('resolves to an integration error when the response is 200 with ActualizarJsonConfiguracionSalidaDTO but no Resultado', async () => {
    stubFetch(makeOkResponse({ ActualizarJsonConfiguracionSalidaDTO: {} }))

    const provider = createPlatagesSaveConfigProvider()
    const result = await provider.save(SAVE_INPUT)

    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.kind).toBe('integration')
    }
  })
})

describe('createPlatagesSaveConfigProvider — HTTP error mapping (delegated to postToPlatages)', () => {
  it('maps HTTP 401 to an auth error without reading the response body', async () => {
    const jsonMock = vi.fn()
    stubFetch(makeErrorResponse(401, jsonMock))

    const provider = createPlatagesSaveConfigProvider()
    const result = await provider.save(SAVE_INPUT)

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

    const provider = createPlatagesSaveConfigProvider()
    const result = await provider.save(SAVE_INPUT)

    expect(result).toEqual({
      status: 'error',
      error: {
        kind: 'auth',
        message: 'La autenticación con el proveedor externo falló. Revisa el token seleccionado.',
      },
    })
    expect(jsonMock).not.toHaveBeenCalled()
  })

  it('maps another HTTP error with a message body to an integration error using that message', async () => {
    const jsonMock = vi.fn().mockResolvedValue({ code: 'X', message: 'algo fallo' })
    stubFetch(makeErrorResponse(400, jsonMock))

    const provider = createPlatagesSaveConfigProvider()
    const result = await provider.save(SAVE_INPUT)

    expect(result).toEqual({
      status: 'error',
      error: { kind: 'integration', message: 'algo fallo' },
    })
  })

  it('maps another HTTP error without a message body to a fallback integration message', async () => {
    const jsonMock = vi.fn().mockResolvedValue({ code: 'X' })
    stubFetch(makeErrorResponse(500, jsonMock))

    const provider = createPlatagesSaveConfigProvider()
    const result = await provider.save(SAVE_INPUT)

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

    const provider = createPlatagesSaveConfigProvider()
    const result = await provider.save(SAVE_INPUT)

    expect(result).toEqual({
      status: 'error',
      error: { kind: 'integration', message: 'No se pudo contactar con el proveedor externo.' },
    })
  })
})
