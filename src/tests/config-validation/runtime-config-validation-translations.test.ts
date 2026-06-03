import { describe, expect, it } from 'vitest'
import { validateRuntimeConfig } from '../../config/runtime-config'
import { createConfigWithLayout } from './helpers'

function createConfigWithTranslations(translations: unknown) {
  return {
    ...createConfigWithLayout([]),
    translations,
  }
}

describe('validateRuntimeConfig — translations block', () => {
  it('accepts a config without a translations key', () => {
    const result = validateRuntimeConfig(createConfigWithLayout([]))
    expect(result.status).toBe('ready')
    if (result.status === 'ready') {
      expect(result.config.translations).toBeUndefined()
    }
  })

  it('accepts a config with translations: {} and normalizes it to an empty object', () => {
    const result = validateRuntimeConfig(createConfigWithTranslations({}))
    expect(result.status).toBe('ready')
    if (result.status === 'ready') {
      expect(result.config.translations).toEqual({})
    }
  })

  it('accepts a config with valid translations (multiple keys, multiple languages)', () => {
    const result = validateRuntimeConfig(
      createConfigWithTranslations({
        confirmBtn: { es: 'Confirmar', en: 'Confirm' },
        searchPlaceholder: { es: 'Busca aquí…', en: 'Search here…' },
      }),
    )
    expect(result.status).toBe('ready')
    if (result.status === 'ready') {
      expect(result.config.translations).toEqual({
        confirmBtn: { es: 'Confirmar', en: 'Confirm' },
        searchPlaceholder: { es: 'Busca aquí…', en: 'Search here…' },
      })
    }
  })

  it('preserves leaf strings without trimming or transforming', () => {
    const result = validateRuntimeConfig(
      createConfigWithTranslations({
        greeting: { es: '  Hola  ', en: '  Hello  ' },
      }),
    )
    expect(result.status).toBe('ready')
    if (result.status === 'ready') {
      expect(result.config.translations).toEqual({
        greeting: { es: '  Hola  ', en: '  Hello  ' },
      })
    }
  })

  it('accepts an entry with an empty language map (key with no translations)', () => {
    const result = validateRuntimeConfig(
      createConfigWithTranslations({
        confirmBtn: {},
      }),
    )
    expect(result.status).toBe('ready')
    if (result.status === 'ready') {
      expect(result.config.translations).toEqual({ confirmBtn: {} })
    }
  })

  it('rejects a non-string leaf value with invalid-layout citing the canonical path', () => {
    const result = validateRuntimeConfig(
      createConfigWithTranslations({
        confirmBtn: { es: 42 },
      }),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.code).toBe('invalid-layout')
      expect(result.error.message).toContain('translations.confirmBtn.es')
    }
  })

  it('rejects an empty language slug with invalid-layout citing the canonical path', () => {
    const result = validateRuntimeConfig(
      createConfigWithTranslations({
        confirmBtn: { '': 'Confirmar' },
      }),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.code).toBe('invalid-layout')
      expect(result.error.message).toContain('translations.confirmBtn')
    }
  })

  it('rejects translations that is not a plain object (array) with invalid-layout citing translations', () => {
    const result = validateRuntimeConfig(createConfigWithTranslations([]))
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.code).toBe('invalid-layout')
      expect(result.error.message).toContain('translations')
    }
  })

  it('rejects translations that is not a plain object (string) with invalid-layout citing translations', () => {
    const result = validateRuntimeConfig(createConfigWithTranslations('invalid'))
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.code).toBe('invalid-layout')
      expect(result.error.message).toContain('translations')
    }
  })

  it('rejects translations that is not a plain object (number) with invalid-layout citing translations', () => {
    const result = validateRuntimeConfig(createConfigWithTranslations(42))
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.code).toBe('invalid-layout')
      expect(result.error.message).toContain('translations')
    }
  })

  it('rejects an entry value that is not a plain object (string instead of language map) citing translations.<key>', () => {
    const result = validateRuntimeConfig(
      createConfigWithTranslations({
        confirmBtn: 'Confirmar',
      }),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.code).toBe('invalid-layout')
      expect(result.error.message).toContain('translations.confirmBtn')
    }
  })
})
