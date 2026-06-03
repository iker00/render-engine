import { describe, expect, it } from 'vitest'
import type { RuntimeConfig } from '../../config/runtime-config'
import { createRuntimeState, runtimeStateReducer } from '../../runtime/runtime-state/runtime-state-reducer'

const baseConfig: RuntimeConfig = {
  api: {},
  initialPage: 'home',
  pages: [{ id: 'home', layout: [] }],
}

const configWithTranslations: RuntimeConfig = {
  ...baseConfig,
  translations: {
    confirmBtn: { es: 'Confirmar', en: 'Confirm' },
    searchPlaceholder: { es: 'Busca aquí…', en: 'Search here…' },
  },
}

describe('Runtime state — i18n initialization', () => {
  it('produces i18n state with empty translations and default activeLanguage when config has no translations and no options', () => {
    const state = createRuntimeState(baseConfig)

    expect(state.i18n).toEqual({ translations: {}, activeLanguage: 'es' })
  })

  it('produces i18n state with empty translations and default activeLanguage when options.activeLanguage is absent', () => {
    const state = createRuntimeState(configWithTranslations)

    expect(state.i18n).toEqual({
      translations: configWithTranslations.translations,
      activeLanguage: 'es',
    })
  })

  it('produces i18n state with the given activeLanguage when options.activeLanguage is provided', () => {
    const state = createRuntimeState(configWithTranslations, { activeLanguage: 'en' })

    expect(state.i18n).toEqual({
      translations: configWithTranslations.translations,
      activeLanguage: 'en',
    })
  })

  it('reflects exactly the translations block from config in the i18n sub-state', () => {
    const state = createRuntimeState(configWithTranslations, { activeLanguage: 'en' })

    expect(state.i18n.translations).toBe(configWithTranslations.translations)
  })

  it('defaults activeLanguage to "es" when options.activeLanguage is not provided', () => {
    const state = createRuntimeState(configWithTranslations, {})

    expect(state.i18n.activeLanguage).toBe('es')
  })

  it('preserves an arbitrary lang slug without modification', () => {
    const state = createRuntimeState(configWithTranslations, { activeLanguage: 'fr' })

    expect(state.i18n.activeLanguage).toBe('fr')
  })

  it('keeps i18n intact after runtime/reset action with the same initialState', () => {
    const initialState = createRuntimeState(configWithTranslations, { activeLanguage: 'en' })
    const stateAfterReset = runtimeStateReducer(initialState, {
      type: 'runtime/reset',
      payload: { state: initialState },
    })

    expect(stateAfterReset.i18n).toEqual(initialState.i18n)
  })

  it('does not alter i18n after a navigation action', () => {
    const configWithPages: RuntimeConfig = {
      ...configWithTranslations,
      pages: [{ id: 'home', layout: [] }, { id: 'details', layout: [] }],
    }
    const state = createRuntimeState(configWithPages, { activeLanguage: 'en' })
    const stateAfterNav = runtimeStateReducer(state, {
      type: 'navigation/navigate',
      payload: { pageId: 'details' },
    })

    expect(stateAfterNav.i18n).toEqual(state.i18n)
  })

  it('does not alter i18n after a forms action', () => {
    const state = createRuntimeState(configWithTranslations, { activeLanguage: 'en' })
    const stateAfterForms = runtimeStateReducer(state, {
      type: 'forms/initialize',
      payload: { formId: 'myForm', fields: { name: { defaultValue: '' } } },
    })

    expect(stateAfterForms.i18n).toEqual(state.i18n)
  })

  it('does not alter i18n after a queries action', () => {
    const state = createRuntimeState(configWithTranslations, { activeLanguage: 'en' })
    const stateAfterQuery = runtimeStateReducer(state, {
      type: 'queries/initialize',
      payload: { queryName: 'myQuery' },
    })

    expect(stateAfterQuery.i18n).toEqual(state.i18n)
  })
})
