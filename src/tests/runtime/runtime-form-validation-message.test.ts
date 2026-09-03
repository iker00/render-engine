import { describe, expect, it } from 'vitest'
import { formatValidationMessage } from '../../runtime/runtime-form-validations'
import type { RuntimeState } from '../../runtime/runtime-state/runtime-state-types'

const baseState: RuntimeState = {
  navigation: {
    currentPageId: 'home',
    history: [{ entryId: 0, pageId: 'home', params: {} }],
    currentEntryIndex: 0,
    lastError: null,
  },
  forms: {},
  queries: {},
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
  i18n: {
    translations: {},
    activeLanguage: 'en',
  },
  tokens: {},
}

const stateWithTranslations: RuntimeState = {
  ...baseState,
  i18n: {
    translations: {
      max_length_error: { en: 'Maximum length exceeded', es: 'Longitud máxima superada' },
      greeting: { en: 'Hello', es: 'Hola' },
    },
    activeLanguage: 'en',
  },
}

describe('formatValidationMessage', () => {
  it('returns defaultMessage when rule.message is undefined, without invoking the reference resolver', () => {
    const result = formatValidationMessage({
      rule: { value: 3 },
      defaultMessage: 'Must be at least 3 characters.',
      state: baseState,
    })

    expect(result).toBe('Must be at least 3 characters.')
  })

  it('returns empty string when rule.message is an explicit empty string', () => {
    const result = formatValidationMessage({
      rule: { value: 3, message: '' },
      defaultMessage: 'Must be at least 3 characters.',
      state: baseState,
    })

    expect(result).toBe('')
  })

  it('returns the literal message when it contains no placeholders', () => {
    const result = formatValidationMessage({
      rule: { value: true, message: 'Texto literal sin placeholders' },
      defaultMessage: 'Required',
      state: baseState,
    })

    expect(result).toBe('Texto literal sin placeholders')
  })

  it('substitutes {{value}} with string representation of a numeric rule.value', () => {
    const result = formatValidationMessage({
      rule: { value: 3, message: 'Mínimo {{value}} caracteres' },
      defaultMessage: 'Must be at least 3 characters.',
      state: baseState,
    })

    expect(result).toBe('Mínimo 3 caracteres')
  })

  it('substitutes {{ value }} (with internal spaces) with the numeric value', () => {
    const result = formatValidationMessage({
      rule: { value: 5, message: 'Mínimo {{ value }}' },
      defaultMessage: 'Must be at least 5 characters.',
      state: baseState,
    })

    expect(result).toBe('Mínimo 5')
  })

  it('substitutes all occurrences of {{value}} in a message with multiple placeholders', () => {
    const result = formatValidationMessage({
      rule: { value: 7, message: '{{value}} y {{value}}' },
      defaultMessage: 'Must be at least 7.',
      state: baseState,
    })

    expect(result).toBe('7 y 7')
  })

  it('substitutes {{value}} with "0" when rule.value is 0 (zero is not treated as empty)', () => {
    const result = formatValidationMessage({
      rule: { value: 0, message: '{{value}}' },
      defaultMessage: 'Must be at least 0.',
      state: baseState,
    })

    expect(result).toBe('0')
  })

  it('substitutes {{value}} with empty string when rule.value is true (boolean degrades to empty)', () => {
    const result = formatValidationMessage({
      rule: { value: true, message: '{{value}} es requerido' },
      defaultMessage: 'Required',
      state: baseState,
    })

    expect(result).toBe(' es requerido')
  })

  it('resolves {{t.key}} from the active language catalog', () => {
    const result = formatValidationMessage({
      rule: { value: 100, message: '{{t.max_length_error}}' },
      defaultMessage: 'Must be at most 100 characters.',
      state: stateWithTranslations,
    })

    expect(result).toBe('Maximum length exceeded')
  })

  it('returns fallback string when {{t.unknown_key}} has no entry in the catalog', () => {
    const result = formatValidationMessage({
      rule: { value: true, message: '{{t.unknown_key}}' },
      defaultMessage: 'Required',
      state: baseState,
    })

    // In DEV mode vitest runs, fallback is the key literal
    expect(result).toBe('unknown_key')
  })

  it('combines {{value}} and {{t.key}} interpolations in a single message', () => {
    const result = formatValidationMessage({
      rule: { value: 4, message: 'Hola {{t.greeting}}, mínimo {{value}}' },
      defaultMessage: 'Must be at least 4 characters.',
      state: stateWithTranslations,
    })

    expect(result).toBe('Hola Hello, mínimo 4')
  })

  it('degrades unsupported {{forms.someForm.someField}} placeholder to empty string, preserving surrounding text', () => {
    const result = formatValidationMessage({
      rule: { value: true, message: 'pre {{forms.someForm.someField}} post' },
      defaultMessage: 'Required',
      state: baseState,
    })

    expect(result).toBe('pre  post')
  })

  it('handles empty delimiter {{ }} without crashing and produces empty string for the placeholder', () => {
    const result = formatValidationMessage({
      rule: { value: true, message: 'pre {{ }} post' },
      defaultMessage: 'Required',
      state: baseState,
    })

    expect(result).toBe('pre  post')
  })
})
