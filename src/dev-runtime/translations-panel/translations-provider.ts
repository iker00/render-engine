/**
 * HTTP client for the two read-only PlataGes operations consumed by the translations panel:
 * searching texts and fetching the translations of a batch of ids. Types and error mapping are
 * scoped to what the panel needs; the raw PlataGes wire shape stays private to this module.
 */

export interface TranslationsProviderSearchResult {
  idTexto: number
  texto: string
}

export interface TranslationsProviderBatchLanguage {
  idioma: number
  texto: string
}

export interface TranslationsProviderBatchResult {
  idTexto: number
  traducciones: TranslationsProviderBatchLanguage[]
}

export type TranslationsProviderError =
  | { kind: 'auth'; message: string }
  | { kind: 'integration'; message: string }

export type TranslationsProviderOutcome<T> =
  | { status: 'ok'; data: T }
  | { status: 'error'; error: TranslationsProviderError }

export interface TranslationsProvider {
  searchTexts(input: {
    text: string
    token: string
  }): Promise<TranslationsProviderOutcome<TranslationsProviderSearchResult[]>>
  getTranslationsBatch(input: {
    ids: number[]
    token: string
  }): Promise<TranslationsProviderOutcome<TranslationsProviderBatchResult[]>>
}

const DEFAULT_BASE_URL = 'https://pre-frontapi.pamplona.es'

const SEARCH_TEXTS_PATH =
  '/platages/platages/v1/operations/6C1F94A2-3D57-4B08-9E62-1A70C58D34B1/buscartextos'
const GET_TRANSLATIONS_BATCH_PATH =
  '/platages/platages/v1/operations/0B48D3E7-92AC-4F51-8D06-5E9B27A4C6F3/obtenertextos'

const AUTH_ERROR_MESSAGE =
  'La autenticación con el proveedor externo falló. Revisa el token seleccionado.'
const NETWORK_ERROR_MESSAGE = 'No se pudo contactar con el proveedor externo.'

interface RawSearchTextsResponse {
  BuscarTextosSalidaDTO?: {
    Textos?: Array<{ IdTexto: number; Texto: string }> | null
  }
}

interface RawBatchResponse {
  ObtenerTextosSalidaDTO?: {
    Textos?: Array<{
      IdTexto: number
      Traducciones: Array<{ Idioma: number; Texto: string }>
    }> | null
  }
}

interface RawErrorPayload {
  code?: string
  message?: string
}

function resolveBaseUrl(options?: { baseUrl?: string }): string {
  if (options?.baseUrl) {
    return options.baseUrl
  }
  return import.meta.env.VITE_PLATAGES_API_BASE_URL || DEFAULT_BASE_URL
}

async function mapErrorResponse(response: Response): Promise<TranslationsProviderError> {
  if (response.status === 401 || response.status === 403) {
    return { kind: 'auth', message: AUTH_ERROR_MESSAGE }
  }

  const fallbackMessage = `La llamada al proveedor externo falló (HTTP ${response.status}).`

  try {
    const body = (await response.json()) as RawErrorPayload | null
    if (body && typeof body.message === 'string' && body.message.trim() !== '') {
      return { kind: 'integration', message: body.message }
    }
    return { kind: 'integration', message: fallbackMessage }
  } catch {
    return { kind: 'integration', message: fallbackMessage }
  }
}

async function postToPlatages<TRaw>(
  url: string,
  body: unknown,
  token: string,
): Promise<TranslationsProviderOutcome<TRaw>> {
  let response: Response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    })
  } catch {
    return { status: 'error', error: { kind: 'integration', message: NETWORK_ERROR_MESSAGE } }
  }

  if (!response.ok) {
    return { status: 'error', error: await mapErrorResponse(response) }
  }

  try {
    const data = (await response.json()) as TRaw
    return { status: 'ok', data }
  } catch {
    return { status: 'error', error: { kind: 'integration', message: NETWORK_ERROR_MESSAGE } }
  }
}

export function createPlatagesTranslationsProvider(options?: {
  baseUrl?: string
}): TranslationsProvider {
  const baseUrl = resolveBaseUrl(options)

  return {
    async searchTexts({ text, token }) {
      const outcome = await postToPlatages<RawSearchTextsResponse>(
        `${baseUrl}${SEARCH_TEXTS_PATH}`,
        { BuscarTextosEntradaDTO: { ParteTexto: text } },
        token,
      )
      if (outcome.status === 'error') {
        return outcome
      }
      const textos = outcome.data.BuscarTextosSalidaDTO?.Textos ?? []
      return {
        status: 'ok',
        data: textos.map((item) => ({ idTexto: item.IdTexto, texto: item.Texto })),
      }
    },
    async getTranslationsBatch({ ids, token }) {
      const outcome = await postToPlatages<RawBatchResponse>(
        `${baseUrl}${GET_TRANSLATIONS_BATCH_PATH}`,
        { ObtenerTextosEntradaDTO: { IdTextos: ids } },
        token,
      )
      if (outcome.status === 'error') {
        return outcome
      }
      const textos = outcome.data.ObtenerTextosSalidaDTO?.Textos ?? []
      return {
        status: 'ok',
        data: textos.map((item) => ({
          idTexto: item.IdTexto,
          traducciones: item.Traducciones.map((traduccion) => ({
            idioma: traduccion.Idioma,
            texto: traduccion.Texto,
          })),
        })),
      }
    },
  }
}
