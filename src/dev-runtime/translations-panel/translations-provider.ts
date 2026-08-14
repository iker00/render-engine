/**
 * Provider for the two read-only PlataGes operations consumed by the translations panel:
 * searching texts and fetching the translations of a batch of ids. The HTTP transport and error
 * mapping live in the shared `platages-http-client`; this module keeps the raw PlataGes wire
 * shape and the domain mapping specific to translations.
 */

import {
  postToPlatages,
  type PlatagesRequestError,
  type PlatagesRequestOutcome,
} from '../platages-http-client'

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

export type TranslationsProviderError = PlatagesRequestError

export type TranslationsProviderOutcome<T> = PlatagesRequestOutcome<T>

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

function resolveBaseUrl(options?: { baseUrl?: string }): string {
  if (options?.baseUrl) {
    return options.baseUrl
  }
  return import.meta.env.VITE_PLATAGES_API_BASE_URL || DEFAULT_BASE_URL
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
