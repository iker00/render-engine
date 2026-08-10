import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createPlatagesTranslationsProvider,
  type TranslationsProvider,
  type TranslationsProviderOutcome,
} from '../../dev-runtime/translations-panel/translations-provider'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

const SEARCH_TEXTS_PATH_SUFFIX =
  '/platages/platages/v1/operations/6C1F94A2-3D57-4B08-9E62-1A70C58D34B1/buscartextos'
const GET_TRANSLATIONS_BATCH_PATH_SUFFIX =
  '/platages/platages/v1/operations/0B48D3E7-92AC-4F51-8D06-5E9B27A4C6F3/obtenertextos'

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

describe('createPlatagesTranslationsProvider — baseUrl resolution', () => {
  it('resolves to the default PlataGes host without options and without VITE_PLATAGES_API_BASE_URL', async () => {
    const fetchMock = stubFetch(
      makeOkResponse({ BuscarTextosSalidaDTO: { Textos: [] } }),
    )

    const provider = createPlatagesTranslationsProvider()
    await provider.searchTexts({ text: 'foo', token: 'abc' })

    const url = fetchMock.mock.calls[0][0] as string
    expect(url).toBe(`https://pre-frontapi.pamplona.es${SEARCH_TEXTS_PATH_SUFFIX}`)
  })

  it('uses the provided baseUrl for both operations', async () => {
    const fetchMock = stubFetch(
      makeOkResponse({ BuscarTextosSalidaDTO: { Textos: [] } }),
    )

    const provider = createPlatagesTranslationsProvider({ baseUrl: 'https://custom.example' })
    await provider.searchTexts({ text: 'foo', token: 'abc' })
    expect(fetchMock.mock.calls[0][0]).toBe(`https://custom.example${SEARCH_TEXTS_PATH_SUFFIX}`)

    fetchMock.mockResolvedValue(
      makeOkResponse({ ObtenerTextosSalidaDTO: { Textos: [] } }),
    )
    await provider.getTranslationsBatch({ ids: [1], token: 'abc' })
    expect(fetchMock.mock.calls[1][0]).toBe(
      `https://custom.example${GET_TRANSLATIONS_BATCH_PATH_SUFFIX}`,
    )
  })
})

describe('createPlatagesTranslationsProvider — searchTexts', () => {
  it('invokes fetch with the exact URL, body and headers', async () => {
    const fetchMock = stubFetch(
      makeOkResponse({ BuscarTextosSalidaDTO: { Textos: [] } }),
    )

    const provider = createPlatagesTranslationsProvider({ baseUrl: 'https://custom.example' })
    await provider.searchTexts({ text: 'foo', token: 'abc' })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url.endsWith(SEARCH_TEXTS_PATH_SUFFIX)).toBe(true)
    expect(init.method).toBe('POST')
    expect(init.body).toBe(JSON.stringify({ BuscarTextosEntradaDTO: { ParteTexto: 'foo' } }))
    expect(init.headers).toEqual({
      'Content-Type': 'application/json',
      Authorization: 'Bearer abc',
    })
  })

  it('maps a successful response with results to idTexto/texto', async () => {
    stubFetch(
      makeOkResponse({
        BuscarTextosSalidaDTO: { Textos: [{ IdTexto: 42, Texto: 'Hola' }] },
      }),
    )

    const provider = createPlatagesTranslationsProvider()
    const result = await provider.searchTexts({ text: 'foo', token: 'abc' })

    expect(result).toEqual({ status: 'ok', data: [{ idTexto: 42, texto: 'Hola' }] })
  })

  it('maps an empty Textos to an empty array', async () => {
    stubFetch(makeOkResponse({ BuscarTextosSalidaDTO: {} }))

    const provider = createPlatagesTranslationsProvider()
    const result = await provider.searchTexts({ text: 'foo', token: 'abc' })

    expect(result).toEqual({ status: 'ok', data: [] })
  })

  it('maps a null Textos to an empty array', async () => {
    stubFetch(makeOkResponse({ BuscarTextosSalidaDTO: { Textos: null } }))

    const provider = createPlatagesTranslationsProvider()
    const result = await provider.searchTexts({ text: 'foo', token: 'abc' })

    expect(result).toEqual({ status: 'ok', data: [] })
  })
})

describe('createPlatagesTranslationsProvider — getTranslationsBatch', () => {
  it('invokes fetch with the exact URL and body', async () => {
    const fetchMock = stubFetch(
      makeOkResponse({ ObtenerTextosSalidaDTO: { Textos: [] } }),
    )

    const provider = createPlatagesTranslationsProvider({ baseUrl: 'https://custom.example' })
    await provider.getTranslationsBatch({ ids: [1, 2], token: 'abc' })

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url.endsWith(GET_TRANSLATIONS_BATCH_PATH_SUFFIX)).toBe(true)
    expect(init.body).toBe(JSON.stringify({ ObtenerTextosEntradaDTO: { IdTextos: [1, 2] } }))
  })

  it('maps a successful response with results to idTexto/traducciones', async () => {
    stubFetch(
      makeOkResponse({
        ObtenerTextosSalidaDTO: {
          Textos: [
            {
              IdTexto: 1,
              Traducciones: [
                { Idioma: 1, Texto: 'Hola' },
                { Idioma: 2, Texto: 'Kaixo' },
              ],
            },
          ],
        },
      }),
    )

    const provider = createPlatagesTranslationsProvider()
    const result = await provider.getTranslationsBatch({ ids: [1, 2], token: 'abc' })

    expect(result).toEqual({
      status: 'ok',
      data: [
        {
          idTexto: 1,
          traducciones: [
            { idioma: 1, texto: 'Hola' },
            { idioma: 2, texto: 'Kaixo' },
          ],
        },
      ],
    })
  })

  it('maps an empty Textos to an empty array', async () => {
    stubFetch(makeOkResponse({ ObtenerTextosSalidaDTO: {} }))

    const provider = createPlatagesTranslationsProvider()
    const result = await provider.getTranslationsBatch({ ids: [1, 2], token: 'abc' })

    expect(result).toEqual({ status: 'ok', data: [] })
  })
})

type MethodCase = {
  name: string
  invoke: (
    provider: TranslationsProvider,
  ) => Promise<TranslationsProviderOutcome<unknown>>
}

const methodCases: MethodCase[] = [
  {
    name: 'searchTexts',
    invoke: (provider) => provider.searchTexts({ text: 'foo', token: 'abc' }),
  },
  {
    name: 'getTranslationsBatch',
    invoke: (provider) => provider.getTranslationsBatch({ ids: [1, 2], token: 'abc' }),
  },
]

describe.each(methodCases)('$name — error mapping', ({ invoke }) => {
  it('maps HTTP 401 to an auth error without reading the response body', async () => {
    const jsonMock = vi.fn()
    stubFetch(makeErrorResponse(401, jsonMock))

    const provider = createPlatagesTranslationsProvider()
    const result = await invoke(provider)

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

    const provider = createPlatagesTranslationsProvider()
    const result = await invoke(provider)

    expect(result).toEqual({
      status: 'error',
      error: {
        kind: 'auth',
        message: 'La autenticación con el proveedor externo falló. Revisa el token seleccionado.',
      },
    })
    expect(jsonMock).not.toHaveBeenCalled()
  })

  it('maps a non-auth error with a message body to an integration error using that message', async () => {
    const jsonMock = vi.fn().mockResolvedValue({ code: 'X', message: 'algo fallo' })
    stubFetch(makeErrorResponse(500, jsonMock))

    const provider = createPlatagesTranslationsProvider()
    const result = await invoke(provider)

    expect(result).toEqual({
      status: 'error',
      error: { kind: 'integration', message: 'algo fallo' },
    })
  })

  it('maps a non-auth error without a message body to a fallback integration message', async () => {
    const jsonMock = vi.fn().mockResolvedValue({ code: 'X' })
    stubFetch(makeErrorResponse(500, jsonMock))

    const provider = createPlatagesTranslationsProvider()
    const result = await invoke(provider)

    expect(result).toEqual({
      status: 'error',
      error: {
        kind: 'integration',
        message: 'La llamada al proveedor externo falló (HTTP 500).',
      },
    })
  })

  it('maps a non-auth error with a non-JSON body to the same fallback integration message', async () => {
    const jsonMock = vi.fn().mockRejectedValue(new Error('Unexpected token'))
    stubFetch(makeErrorResponse(500, jsonMock))

    const provider = createPlatagesTranslationsProvider()
    const result = await invoke(provider)

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

    const provider = createPlatagesTranslationsProvider()
    const result = await invoke(provider)

    expect(result).toEqual({
      status: 'error',
      error: { kind: 'integration', message: 'No se pudo contactar con el proveedor externo.' },
    })
  })
})
