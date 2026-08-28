import { describe, expect, it } from 'vitest'
import { readRuntimeEndpointsConfig } from '../../app/bootstrap/read-runtime-endpoints-config'

const validEndpointsConfig = {
  baseUrl: 'https://pre-frontapi.example.com',
  operations: {
    searchTexts: { path: '/platages/buscartextos', tokenId: 'sessionToken' },
    getTranslationsBatch: { path: '/platages/obtenertextos', tokenId: 'sessionToken' },
    saveConfig: {
      path: '/platages/actualizarjsonconfiguracionenplatages',
      tokenId: 'sessionToken',
      idGestion: 123,
      idSeccion: 55,
      idObjetoOcurrencia: 267,
    },
  },
}

describe('readRuntimeEndpointsConfig', () => {
  it('returns the parsed attribute config when dataset.endpointsConfig is present and valid, taking priority over devEndpointsConfig', () => {
    const rootElement = document.createElement('div')
    rootElement.dataset.endpointsConfig = JSON.stringify(validEndpointsConfig)

    const result = readRuntimeEndpointsConfig({
      devEndpointsConfig: { baseUrl: 'https://from-dev-fallback.example.com' },
      rootElement,
    })

    expect(result).toEqual(validEndpointsConfig)
  })

  it('returns undefined when dataset.endpointsConfig is present but not valid JSON, without falling back to devEndpointsConfig', () => {
    const rootElement = document.createElement('div')
    rootElement.dataset.endpointsConfig = '{invalid json'

    const result = readRuntimeEndpointsConfig({
      devEndpointsConfig: validEndpointsConfig,
      rootElement,
    })

    expect(result).toBeUndefined()
  })

  it('returns undefined when dataset.endpointsConfig is present but its shape does not pass parseRuntimeEndpointsConfig', () => {
    const rootElement = document.createElement('div')
    rootElement.dataset.endpointsConfig = JSON.stringify({ operations: {} })

    const result = readRuntimeEndpointsConfig({
      devEndpointsConfig: validEndpointsConfig,
      rootElement,
    })

    expect(result).toBeUndefined()
  })

  it('returns the parsed devEndpointsConfig when the attribute is absent and devEndpointsConfig is valid', () => {
    const rootElement = document.createElement('div')

    const result = readRuntimeEndpointsConfig({
      devEndpointsConfig: validEndpointsConfig,
      rootElement,
    })

    expect(result).toEqual(validEndpointsConfig)
  })

  it('returns undefined when the attribute is absent and devEndpointsConfig is absent', () => {
    const rootElement = document.createElement('div')

    const result = readRuntimeEndpointsConfig({
      devEndpointsConfig: undefined,
      rootElement,
    })

    expect(result).toBeUndefined()
  })

  it('returns undefined when the attribute is absent and devEndpointsConfig has an invalid shape', () => {
    const rootElement = document.createElement('div')

    const result = readRuntimeEndpointsConfig({
      devEndpointsConfig: { operations: {} },
      rootElement,
    })

    expect(result).toBeUndefined()
  })

  it('behaves like "no attribute" when rootElement is null', () => {
    const result = readRuntimeEndpointsConfig({
      devEndpointsConfig: validEndpointsConfig,
      rootElement: null,
    })

    expect(result).toEqual(validEndpointsConfig)
  })

  it('returns undefined when rootElement is null and devEndpointsConfig is absent', () => {
    const result = readRuntimeEndpointsConfig({
      devEndpointsConfig: undefined,
      rootElement: null,
    })

    expect(result).toBeUndefined()
  })
})
