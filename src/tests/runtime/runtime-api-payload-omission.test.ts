import { describe, expect, it } from 'vitest'
import {
  resolvePayloadValue,
  resolveJsonPayloadValue,
  resolveBody,
  resolveHeaders,
} from '../../queries/runtime-api-payload-resolver'
import { buildRuntimeApiRequest } from '../../queries/runtime-api-request'
import type { RuntimeConfig } from '../../config/runtime-config'
import type { RuntimeState } from '../../runtime/runtime-state/runtime-state-types'
import type { RuntimeApiHiddenFormFields } from '../../queries/runtime-api-types'

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

const hiddenFormFields: RuntimeApiHiddenFormFields = {
  formId: 'myForm',
  fieldIds: new Set(['hiddenField', 'anotherHidden']),
}

describe('resolvePayloadValue — omit terminal', () => {
  it('returns omit when reference is forms.{formId}.{fieldId} missing, formId matches and fieldId is in hiddenFieldIds', () => {
    const state = makeState()
    const result = resolvePayloadValue('forms.myForm.hiddenField', { state, hiddenFormFields })
    expect(result).toEqual({ status: 'omit' })
  })

  it('returns omit for a second hidden fieldId in the same form', () => {
    const state = makeState()
    const result = resolvePayloadValue('forms.myForm.anotherHidden', { state, hiddenFormFields })
    expect(result).toEqual({ status: 'omit' })
  })

  it('returns error (not omit) when formId in reference does not match hiddenFormFields.formId (another form)', () => {
    const state = makeState()
    const result = resolvePayloadValue('forms.otherForm.hiddenField', { state, hiddenFormFields })
    expect(result).toEqual({ status: 'error' })
  })

  it('returns error (not omit) when fieldId is not in hiddenFieldIds even though formId matches', () => {
    const state = makeState()
    const result = resolvePayloadValue('forms.myForm.visibleButMissing', { state, hiddenFormFields })
    expect(result).toEqual({ status: 'error' })
  })

  it('returns error (not omit) for params.* namespace missing (no hiddenFormFields fallback)', () => {
    const state = makeState()
    const result = resolvePayloadValue('params.missingParam', { state, hiddenFormFields })
    expect(result).toEqual({ status: 'error' })
  })

  it('returns error (not omit) for queries.* namespace missing', () => {
    const state = makeState()
    const result = resolvePayloadValue('queries.someQuery.data.field', { state, hiddenFormFields })
    expect(result).toEqual({ status: 'error' })
  })

  it('returns error (not omit) for item.* namespace when no iterationContext', () => {
    const state = makeState()
    const result = resolvePayloadValue('item.someField', { state, hiddenFormFields })
    expect(result).toEqual({ status: 'error' })
  })

  it('returns error (not omit) when hiddenFormFields is not provided (original behavior)', () => {
    const state = makeState()
    const result = resolvePayloadValue('forms.myForm.hiddenField', { state })
    expect(result).toEqual({ status: 'error' })
  })

  it('returns omit when the field IS in the form store but is declared hidden via hiddenFormFields (initialized-then-hidden case)', () => {
    const state = makeState(makeFormState({ hiddenField: 'some-value' }))
    const result = resolvePayloadValue('forms.myForm.hiddenField', { state, hiddenFormFields })
    expect(result).toEqual({ status: 'omit' })
  })

  it('returns ready for a visible field with empty string value', () => {
    const state = makeState(makeFormState({ visibleField: '' }))
    const result = resolvePayloadValue('forms.myForm.visibleField', { state, hiddenFormFields })
    expect(result).toEqual({ status: 'ready', value: '' })
  })
})

describe('resolveJsonPayloadValue — omit propagation in objects and arrays', () => {
  it('omits the key from a flat object when that key resolves to omit', () => {
    const state = makeState(makeFormState({ visible: 'Ada' }))
    const result = resolveJsonPayloadValue(
      { hidden: 'forms.myForm.hiddenField', visible: 'forms.myForm.visible' },
      { state, hiddenFormFields },
    )
    expect(result).toEqual({ status: 'ready', value: { visible: 'Ada' } })
  })

  it('keeps the container object as {} when all its children are omitted (no pruning)', () => {
    const state = makeState()
    const result = resolveJsonPayloadValue(
      { A: { B: 'forms.myForm.hiddenField', C: 'forms.myForm.anotherHidden' } },
      { state, hiddenFormFields },
    )
    expect(result).toEqual({ status: 'ready', value: { A: {} } })
  })

  it('keeps non-omitted sibling keys under the same nested object', () => {
    const state = makeState(makeFormState({ visible: 'hello' }))
    const result = resolveJsonPayloadValue(
      { A: { B: 'forms.myForm.hiddenField', C: 'forms.myForm.visible' } },
      { state, hiddenFormFields },
    )
    expect(result).toEqual({ status: 'ready', value: { A: { C: 'hello' } } })
  })

  it('returns error when an array entry resolves to omit', () => {
    const state = makeState()
    const result = resolveJsonPayloadValue(
      ['forms.myForm.hiddenField', 'literal-value'],
      { state, hiddenFormFields },
    )
    expect(result).toEqual({ status: 'error' })
  })
})

describe('resolveBody — omit handling at body root and nested', () => {
  it('returns {} body when all root keys are omitted', () => {
    const state = makeState()
    const result = resolveBody(
      { hidden1: 'forms.myForm.hiddenField', hidden2: 'forms.myForm.anotherHidden' },
      'op "test"',
      { state, hiddenFormFields },
    )
    expect(result).toEqual({ status: 'ready', body: {} })
  })

  it('returns body without omitted keys, keeping visible ones', () => {
    const state = makeState(makeFormState({ visible: 'Ada' }))
    const result = resolveBody(
      { hidden: 'forms.myForm.hiddenField', visible: 'forms.myForm.visible' },
      'op "test"',
      { state, hiddenFormFields },
    )
    expect(result).toEqual({ status: 'ready', body: { visible: 'Ada' } })
  })

  it('returns nested body with omitted inner key but container preserved', () => {
    const state = makeState(makeFormState({ visible: 'Grace' }))
    const result = resolveBody(
      { A: { hidden: 'forms.myForm.hiddenField', visible: 'forms.myForm.visible' } },
      'op "test"',
      { state, hiddenFormFields },
    )
    expect(result).toEqual({ status: 'ready', body: { A: { visible: 'Grace' } } })
  })

  it('returns error when array entry resolves to omit', () => {
    const state = makeState()
    const result = resolveBody(
      { items: ['forms.myForm.hiddenField'] },
      'op "test"',
      { state, hiddenFormFields },
    )
    expect(result).toEqual({
      status: 'error',
      error: { code: 'request-build-failed', message: 'op "test" could not build its JSON body.' },
    })
  })

  it('a visible field with empty string value still travels with ""', () => {
    const state = makeState(makeFormState({ emptyVisible: '' }))
    const result = resolveBody(
      { emptyVisible: 'forms.myForm.emptyVisible' },
      'op "test"',
      { state, hiddenFormFields },
    )
    expect(result).toEqual({ status: 'ready', body: { emptyVisible: '' } })
  })
})

describe('resolveHeaders — omit handling', () => {
  it('excludes from headers the key whose value resolves to omit', () => {
    const state = makeState(makeFormState({ token: 'Bearer xyz' }))
    const result = resolveHeaders(
      {
        authorization: 'forms.myForm.token',
        'x-hidden-header': 'forms.myForm.hiddenField',
      },
      'op "test"',
      { state, hiddenFormFields },
    )
    expect(result).toEqual({ status: 'ready', headers: { authorization: 'Bearer xyz' } })
  })

  it('returns empty headers object when all header values are omitted', () => {
    const state = makeState()
    const result = resolveHeaders(
      { 'x-a': 'forms.myForm.hiddenField', 'x-b': 'forms.myForm.anotherHidden' },
      'op "test"',
      { state, hiddenFormFields },
    )
    expect(result).toEqual({ status: 'ready', headers: {} })
  })
})

describe('resolveQuery — omit handling (via buildRuntimeApiRequest)', () => {
  const baseState = makeState(makeFormState({ visible: 'hello' }))

  const makeConfig = (query: Record<string, string>): RuntimeConfig => ({
    api: {
      searchOp: {
        method: 'GET',
        endpoint: '/api/search',
        query,
      },
    },
    initialPage: 'home',
    pages: [{ id: 'home', layout: [] }],
  })

  it('excludes from query the key whose reference resolves to omit', () => {
    const result = buildRuntimeApiRequest({
      config: makeConfig({
        hidden: 'forms.myForm.hiddenField',
        visible: 'forms.myForm.visible',
      }),
      operationName: 'searchOp',
      state: baseState,
      hiddenFormFields,
    })
    expect(result.status).toBe('ready')
    if (result.status !== 'ready') return
    expect(result.request.url).toBe('/api/search?visible=hello')
  })

  it('returns empty query when all keys are omitted', () => {
    const result = buildRuntimeApiRequest({
      config: makeConfig({
        hidden: 'forms.myForm.hiddenField',
        alsoHidden: 'forms.myForm.anotherHidden',
      }),
      operationName: 'searchOp',
      state: makeState(),
      hiddenFormFields,
    })
    expect(result.status).toBe('ready')
    if (result.status !== 'ready') return
    expect(result.request.url).toBe('/api/search')
  })

  it('still fails with request-build-failed when missing reference is not a hidden field', () => {
    const result = buildRuntimeApiRequest({
      config: makeConfig({
        missingParam: 'params.nonExistent',
      }),
      operationName: 'searchOp',
      state: makeState(),
      hiddenFormFields,
    })
    expect(result).toEqual({
      status: 'error',
      error: {
        code: 'request-build-failed',
        message: expect.stringContaining('params.nonExistent'),
      },
    })
  })

  it('endpoint still fails with request-build-failed when reference points to a hidden field (endpoint not affected)', () => {
    const state = makeState()
    const result = buildRuntimeApiRequest({
      config: {
        api: {
          getItem: {
            method: 'GET',
            endpoint: '/api/items/{{forms.myForm.hiddenField}}',
          },
        },
        initialPage: 'home',
        pages: [{ id: 'home', layout: [] }],
      },
      operationName: 'getItem',
      state,
      hiddenFormFields,
    })
    expect(result).toEqual({
      status: 'error',
      error: {
        code: 'request-build-failed',
        message: expect.stringContaining('endpoint'),
      },
    })
  })
})

describe('resolveHeaders — token regression (non-token references unaffected)', () => {
  it('resolves form reference in headers without token interference', () => {
    const state = makeState(makeFormState({ apiKey: 'key-from-form' }))
    const result = resolveHeaders(
      { 'X-Api-Key': 'forms.myForm.apiKey' },
      'The api operation "test"',
      { state },
    )
    expect(result).toEqual({
      status: 'ready',
      headers: { 'X-Api-Key': 'key-from-form' },
    })
  })

  it('resolves a params reference in headers without token interference', () => {
    const stateWithParams = makeState()
    const stateOverridden = {
      ...stateWithParams,
      navigation: {
        ...stateWithParams.navigation,
        history: [{ entryId: 0, pageId: 'home', params: { userId: 'u1' } }],
      },
    }
    const result = resolveHeaders(
      { 'X-User': 'params.userId' },
      'The api operation "test"',
      { state: stateOverridden },
    )
    expect(result).toEqual({
      status: 'ready',
      headers: { 'X-User': 'u1' },
    })
  })
})
