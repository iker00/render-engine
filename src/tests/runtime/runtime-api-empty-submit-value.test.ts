import { describe, expect, it } from 'vitest'
import {
  resolvePayloadValue,
  resolveBody,
  resolveHeaders,
} from '../../queries/runtime-api-payload-resolver'
import { buildRuntimeApiRequest } from '../../queries/runtime-api-request'
import type { RuntimeConfig } from '../../config/runtime-config'
import type { RuntimeState } from '../../runtime/runtime-state/runtime-state-types'
import type { RuntimeApiEmptySubmitValues, RuntimeApiHiddenFormFields } from '../../queries/runtime-api-types'

// Minimal RuntimeState for these unit tests — only what the resolver inspects
function makeState(forms: RuntimeState['forms'] = {}): RuntimeState {
  return {
    navigation: {
      currentPageId: 'home',
      history: [{ entryId: 0, pageId: 'home', params: {} }],
      currentEntryIndex: 0,
      lastError: null,
    },
    forms,
    queries: {},
    pageEntry: {
      entryId: 0,
      pageId: 'home',
      params: {},
      preloadNames: [],
      status: 'idle',
    },
    modal: { activeModalId: null, activeIterationKey: null },
    i18n: { translations: {}, activeLanguage: 'es' },
    tokens: {},
  }
}

function makeFormState(fields: Record<string, unknown>): RuntimeState['forms'] {
  return {
    myForm: Object.fromEntries(
      Object.entries(fields).map(([fieldId, value]) => [
        fieldId,
        { value, error: null, touched: false, dirty: false, defaultValue: '' },
      ]),
    ),
  }
}

const emptySubmitValues: RuntimeApiEmptySubmitValues = {
  formId: 'myForm',
  valuesByFieldId: new Map([['field', 'N/A']]),
}

describe('resolvePayloadValue — emptySubmitValues substitution', () => {
  it('substitutes "" with the configured string replacement', () => {
    const state = makeState(makeFormState({ field: '' }))
    const result = resolvePayloadValue('forms.myForm.field', { state, emptySubmitValues })
    expect(result).toEqual({ status: 'ready', value: 'N/A' })
  })

  it('normalizes a numeric replacement value to a string ("0"), not falsy/omitted', () => {
    const state = makeState(makeFormState({ field: '' }))
    const numericEmptySubmitValues: RuntimeApiEmptySubmitValues = {
      formId: 'myForm',
      valuesByFieldId: new Map([['field', 0]]),
    }
    const result = resolvePayloadValue('forms.myForm.field', {
      state,
      emptySubmitValues: numericEmptySubmitValues,
    })
    expect(result).toEqual({ status: 'ready', value: '0' })
  })

  it('substituting with an empty-string replacement yields "" — no observable difference', () => {
    const state = makeState(makeFormState({ field: '' }))
    const emptyReplacement: RuntimeApiEmptySubmitValues = {
      formId: 'myForm',
      valuesByFieldId: new Map([['field', '']]),
    }
    const result = resolvePayloadValue('forms.myForm.field', {
      state,
      emptySubmitValues: emptyReplacement,
    })
    expect(result).toEqual({ status: 'ready', value: '' })
  })

  it('does not substitute when the effective value is non-empty', () => {
    const state = makeState(makeFormState({ field: 'realValue' }))
    const result = resolvePayloadValue('forms.myForm.field', { state, emptySubmitValues })
    expect(result).toEqual({ status: 'ready', value: 'realValue' })
  })

  it('leaves "" as "" when emptySubmitValues is not provided (unchanged behavior)', () => {
    const state = makeState(makeFormState({ field: '' }))
    const result = resolvePayloadValue('forms.myForm.field', { state })
    expect(result).toEqual({ status: 'ready', value: '' })
  })

  it('does not substitute when emptySubmitValues.formId does not match the referenced form', () => {
    const state = makeState(makeFormState({ field: '' }))
    const otherForm: RuntimeApiEmptySubmitValues = {
      formId: 'otherForm',
      valuesByFieldId: new Map([['field', 'N/A']]),
    }
    const result = resolvePayloadValue('forms.myForm.field', { state, emptySubmitValues: otherForm })
    expect(result).toEqual({ status: 'ready', value: '' })
  })

  it('does not substitute when valuesByFieldId has no entry for the referenced fieldId', () => {
    const state = makeState(makeFormState({ field: '' }))
    const noEntry: RuntimeApiEmptySubmitValues = {
      formId: 'myForm',
      valuesByFieldId: new Map([['otherField', 'N/A']]),
    }
    const result = resolvePayloadValue('forms.myForm.field', { state, emptySubmitValues: noEntry })
    expect(result).toEqual({ status: 'ready', value: '' })
  })

  it('hidden-field omission takes precedence over the substitution for the same field', () => {
    const state = makeState(makeFormState({ field: '' }))
    const hiddenFormFields: RuntimeApiHiddenFormFields = {
      formId: 'myForm',
      fieldIds: new Set(['field']),
    }
    const result = resolvePayloadValue('forms.myForm.field', {
      state,
      hiddenFormFields,
      emptySubmitValues,
    })
    expect(result).toEqual({ status: 'omit' })
  })
})

describe('resolveBody — emptySubmitValues substitution', () => {
  it('substitutes "" in the body', () => {
    const state = makeState(makeFormState({ field: '' }))
    const result = resolveBody({ field: 'forms.myForm.field' }, 'op "test"', { state, emptySubmitValues })
    expect(result).toEqual({ status: 'ready', body: { field: 'N/A' } })
  })
})

describe('resolveHeaders — emptySubmitValues substitution (no interpolation)', () => {
  it('substitutes "" for a plain header reference', () => {
    const state = makeState(makeFormState({ field: '' }))
    const result = resolveHeaders(
      { 'X-Field': 'forms.myForm.field' },
      'op "test"',
      { state, emptySubmitValues },
    )
    expect(result).toEqual({ status: 'ready', headers: { 'X-Field': 'N/A' } })
  })

  it('hidden-field omission still wins over substitution without interpolation', () => {
    const state = makeState(makeFormState({ field: '' }))
    const hiddenFormFields: RuntimeApiHiddenFormFields = {
      formId: 'myForm',
      fieldIds: new Set(['field']),
    }
    const result = resolveHeaders(
      { 'X-Field': 'forms.myForm.field' },
      'op "test"',
      { state, hiddenFormFields, emptySubmitValues },
    )
    expect(result).toEqual({ status: 'ready', headers: {} })
  })
})

describe('resolveHeaders — emptySubmitValues substitution (with interpolation)', () => {
  it('substitutes "" inside an interpolated header template', () => {
    const state = makeState(makeFormState({ field: '' }))
    const result = resolveHeaders(
      { authorization: 'Bearer {{forms.myForm.field}}' },
      'op "test"',
      { state, emptySubmitValues },
    )
    expect(result).toEqual({ status: 'ready', headers: { authorization: 'Bearer N/A' } })
  })

  it('hidden-field omission still wins over substitution inside an interpolated header', () => {
    const state = makeState(makeFormState({ field: '' }))
    const hiddenFormFields: RuntimeApiHiddenFormFields = {
      formId: 'myForm',
      fieldIds: new Set(['field']),
    }
    const result = resolveHeaders(
      { authorization: 'Bearer {{forms.myForm.field}}' },
      'op "test"',
      { state, hiddenFormFields, emptySubmitValues },
    )
    expect(result).toEqual({ status: 'ready', headers: {} })
  })
})

describe('buildRuntimeApiRequest — emptySubmitValues substitution in query', () => {
  it('substitutes "" for a query parameter', () => {
    const state = makeState(makeFormState({ field: '' }))
    const config: RuntimeConfig = {
      api: {
        searchOp: {
          method: 'GET',
          endpoint: '/api/search',
          query: { field: 'forms.myForm.field' },
        },
      },
      initialPage: 'home',
      pages: [{ id: 'home', layout: [] }],
    }
    const result = buildRuntimeApiRequest({
      config,
      operationName: 'searchOp',
      state,
      emptySubmitValues,
    })
    expect(result.status).toBe('ready')
    if (result.status !== 'ready') return
    expect(result.request.url).toBe('/api/search?field=N%2FA')
  })
})
