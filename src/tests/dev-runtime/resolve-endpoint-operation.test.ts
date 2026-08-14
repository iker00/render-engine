import { describe, expect, it } from 'vitest'
import { resolveEndpointOperation } from '../../dev-runtime/endpoints-config/resolve-endpoint-operation'
import type { RuntimeEndpointsConfig } from '../../dev-runtime/endpoints-config/runtime-endpoints-config-schema'
import type { RuntimeTokensConfig } from '../../config/runtime-config-types'

const endpointsConfig: RuntimeEndpointsConfig = {
  baseUrl: 'https://pre-frontapi.example.com',
  operations: {
    searchTexts: { path: '/platages/buscartextos', tokenId: 'sessionToken' },
    getTranslationsBatch: { path: '/platages/obtenertextos', tokenId: 'otherToken' },
    saveConfig: {
      path: '/platages/actualizarjsonconfiguracionenplatages',
      tokenId: 'sessionToken',
      idGestion: 123,
      idSeccion: 55,
      idObjetoOcurrencia: 267,
    },
  },
}

const tokens: RuntimeTokensConfig = {
  sessionToken: { value: 'abc123' },
}

describe('resolveEndpointOperation', () => {
  it.each(['searchTexts', 'getTranslationsBatch', 'saveConfig'] as const)(
    'returns unavailable with operation-not-declared for %s when there is no endpoints config',
    (operationKey) => {
      expect(resolveEndpointOperation(undefined, operationKey, tokens)).toEqual({
        status: 'unavailable',
        reason: 'operation-not-declared',
      })
    },
  )

  it('returns unavailable with operation-not-declared when the operation key is missing from operations', () => {
    const config: RuntimeEndpointsConfig = { baseUrl: 'https://example.com', operations: {} }
    expect(resolveEndpointOperation(config, 'searchTexts', tokens)).toEqual({
      status: 'unavailable',
      reason: 'operation-not-declared',
    })
  })

  it('returns unavailable with operation-not-declared when operations block itself is absent', () => {
    const config: RuntimeEndpointsConfig = { baseUrl: 'https://example.com' }
    expect(resolveEndpointOperation(config, 'saveConfig', tokens)).toEqual({
      status: 'unavailable',
      reason: 'operation-not-declared',
    })
  })

  it('returns unavailable with token-not-resolvable when the referenced tokenId is absent from tokens', () => {
    expect(resolveEndpointOperation(endpointsConfig, 'searchTexts', {})).toEqual({
      status: 'unavailable',
      reason: 'token-not-resolvable',
    })
  })

  it('returns unavailable with token-not-resolvable when tokens is undefined', () => {
    expect(resolveEndpointOperation(endpointsConfig, 'searchTexts', undefined)).toEqual({
      status: 'unavailable',
      reason: 'token-not-resolvable',
    })
  })

  it('returns ready with the concatenated url and resolved token value when everything resolves', () => {
    expect(resolveEndpointOperation(endpointsConfig, 'searchTexts', tokens)).toEqual({
      status: 'ready',
      url: 'https://pre-frontapi.example.com/platages/buscartextos',
      token: 'abc123',
    })
  })

  it('concatenates baseUrl and path as-is, without normalizing slashes', () => {
    const config: RuntimeEndpointsConfig = {
      baseUrl: 'https://example.com/',
      operations: {
        searchTexts: { path: '/buscartextos', tokenId: 'sessionToken' },
      },
    }
    expect(resolveEndpointOperation(config, 'searchTexts', tokens)).toEqual({
      status: 'ready',
      url: 'https://example.com//buscartextos',
      token: 'abc123',
    })
  })

  it('resolves saveConfig independently from the other two operations', () => {
    const partialTokens: RuntimeTokensConfig = { sessionToken: { value: 'save-token' } }
    expect(resolveEndpointOperation(endpointsConfig, 'saveConfig', partialTokens)).toEqual({
      status: 'ready',
      url: 'https://pre-frontapi.example.com/platages/actualizarjsonconfiguracionenplatages',
      token: 'save-token',
    })
    expect(resolveEndpointOperation(endpointsConfig, 'getTranslationsBatch', partialTokens)).toEqual({
      status: 'unavailable',
      reason: 'token-not-resolvable',
    })
  })

  it('resolving one operation does not depend on the state of the other two', () => {
    const config: RuntimeEndpointsConfig = {
      baseUrl: 'https://example.com',
      operations: {
        getTranslationsBatch: { path: '/obtenertextos', tokenId: 'sessionToken' },
      },
    }
    expect(resolveEndpointOperation(config, 'getTranslationsBatch', tokens)).toEqual({
      status: 'ready',
      url: 'https://example.com/obtenertextos',
      token: 'abc123',
    })
    expect(resolveEndpointOperation(config, 'searchTexts', tokens)).toEqual({
      status: 'unavailable',
      reason: 'operation-not-declared',
    })
    expect(resolveEndpointOperation(config, 'saveConfig', tokens)).toEqual({
      status: 'unavailable',
      reason: 'operation-not-declared',
    })
  })
})
