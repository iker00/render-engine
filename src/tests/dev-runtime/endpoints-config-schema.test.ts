import { describe, expect, it } from 'vitest'
import { parseRuntimeEndpointsConfig } from '../../dev-runtime/endpoints-config/runtime-endpoints-config-schema'

const fullConfig = {
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

describe('parseRuntimeEndpointsConfig', () => {
  it('accepts a config with all three operations declared', () => {
    const parsed = parseRuntimeEndpointsConfig(fullConfig)
    expect(parsed).toEqual(fullConfig)
  })

  it('accepts a config with zero operations declared (operations block absent)', () => {
    const parsed = parseRuntimeEndpointsConfig({ baseUrl: 'https://example.com' })
    expect(parsed).toEqual({ baseUrl: 'https://example.com' })
  })

  it('accepts a config with zero operations declared (operations block empty)', () => {
    const parsed = parseRuntimeEndpointsConfig({ baseUrl: 'https://example.com', operations: {} })
    expect(parsed).toEqual({ baseUrl: 'https://example.com', operations: {} })
  })

  it('accepts a config with exactly one operation declared', () => {
    const raw = {
      baseUrl: 'https://example.com',
      operations: {
        searchTexts: { path: '/buscartextos', tokenId: 'sessionToken' },
      },
    }
    expect(parseRuntimeEndpointsConfig(raw)).toEqual(raw)
  })

  it('accepts a config with exactly two operations declared', () => {
    const raw = {
      baseUrl: 'https://example.com',
      operations: {
        searchTexts: { path: '/buscartextos', tokenId: 'sessionToken' },
        getTranslationsBatch: { path: '/obtenertextos', tokenId: 'sessionToken' },
      },
    }
    expect(parseRuntimeEndpointsConfig(raw)).toEqual(raw)
  })

  it('rejects a config with an absent baseUrl', () => {
    const raw = { operations: fullConfig.operations }
    expect(parseRuntimeEndpointsConfig(raw)).toBeUndefined()
  })

  it('rejects a config with a non-string baseUrl', () => {
    const raw = { ...fullConfig, baseUrl: 123 }
    expect(parseRuntimeEndpointsConfig(raw)).toBeUndefined()
  })

  it('rejects an operation with an absent path', () => {
    const raw = {
      baseUrl: 'https://example.com',
      operations: { searchTexts: { tokenId: 'sessionToken' } },
    }
    expect(parseRuntimeEndpointsConfig(raw)).toBeUndefined()
  })

  it('rejects an operation with a non-string path', () => {
    const raw = {
      baseUrl: 'https://example.com',
      operations: { searchTexts: { path: 42, tokenId: 'sessionToken' } },
    }
    expect(parseRuntimeEndpointsConfig(raw)).toBeUndefined()
  })

  it('rejects an operation with an absent tokenId', () => {
    const raw = {
      baseUrl: 'https://example.com',
      operations: { searchTexts: { path: '/buscartextos' } },
    }
    expect(parseRuntimeEndpointsConfig(raw)).toBeUndefined()
  })

  it('rejects an operation with a non-string tokenId', () => {
    const raw = {
      baseUrl: 'https://example.com',
      operations: { searchTexts: { path: '/buscartextos', tokenId: 7 } },
    }
    expect(parseRuntimeEndpointsConfig(raw)).toBeUndefined()
  })

  it.each(['idGestion', 'idSeccion', 'idObjetoOcurrencia'] as const)(
    'rejects saveConfig with a non-integer %s (float)',
    (field) => {
      const raw = {
        baseUrl: 'https://example.com',
        operations: {
          saveConfig: { ...fullConfig.operations.saveConfig, [field]: 1.5 },
        },
      }
      expect(parseRuntimeEndpointsConfig(raw)).toBeUndefined()
    },
  )

  it.each(['idGestion', 'idSeccion', 'idObjetoOcurrencia'] as const)(
    'rejects saveConfig with a non-integer %s (string)',
    (field) => {
      const raw = {
        baseUrl: 'https://example.com',
        operations: {
          saveConfig: { ...fullConfig.operations.saveConfig, [field]: '267' },
        },
      }
      expect(parseRuntimeEndpointsConfig(raw)).toBeUndefined()
    },
  )

  it.each([
    ['a string', 'not-an-object'],
    ['an array', ['not-an-object']],
    ['null', null],
  ] as const)('rejects a raw value that is %s instead of a plain object', (_label, raw) => {
    expect(parseRuntimeEndpointsConfig(raw)).toBeUndefined()
  })

  it('returns undefined for undefined without throwing', () => {
    expect(() => parseRuntimeEndpointsConfig(undefined)).not.toThrow()
    expect(parseRuntimeEndpointsConfig(undefined)).toBeUndefined()
  })

  it('returns undefined for null without throwing', () => {
    expect(() => parseRuntimeEndpointsConfig(null)).not.toThrow()
    expect(parseRuntimeEndpointsConfig(null)).toBeUndefined()
  })

  it('silently ignores an extra key at the root level', () => {
    const raw = { ...fullConfig, unexpectedRootKey: 'should be stripped' }
    const parsed = parseRuntimeEndpointsConfig(raw)
    expect(parsed).toEqual(fullConfig)
    expect(parsed).not.toHaveProperty('unexpectedRootKey')
  })

  it('silently ignores an extra key inside operations.saveConfig', () => {
    const raw = {
      baseUrl: 'https://example.com',
      operations: {
        saveConfig: { ...fullConfig.operations.saveConfig, unexpectedKey: 'should be stripped' },
      },
    }
    const parsed = parseRuntimeEndpointsConfig(raw)
    expect(parsed).toEqual({
      baseUrl: 'https://example.com',
      operations: { saveConfig: fullConfig.operations.saveConfig },
    })
    expect(parsed?.operations?.saveConfig).not.toHaveProperty('unexpectedKey')
  })
})
