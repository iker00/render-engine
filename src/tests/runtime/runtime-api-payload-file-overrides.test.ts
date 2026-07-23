import { describe, expect, it } from 'vitest'
import { resolveBody, resolveHeaders } from '../../queries/runtime-api-payload-resolver'
import { buildRuntimeApiRequest } from '../../queries/runtime-api-request'
import type { RuntimeConfig, RuntimeApiBodyValue } from '../../config/runtime-config'
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

const photoEntries: RuntimeApiBodyValue[] = [
  { name: 'a.png', size: 10, mime: 'image/png', data: 'AAAA' },
  { name: 'b.png', size: 20, mime: 'image/png', data: 'BBBB' },
]

describe('resolveBody — fileValueOverrides absent (regression)', () => {
  it('serializes a body without file references exactly as before', () => {
    const state = makeState()
    const result = resolveBody(
      { title: 'literal-title', count: 2 },
      'op "test"',
      { state },
    )
    expect(result).toEqual({ status: 'ready', body: { title: 'literal-title', count: 2 } })
  })
})

describe('resolveBody — fileValueOverrides defined but key absent from body (regression)', () => {
  it('serializes a body untouched when the map does not contain a referenced key', () => {
    const state = makeState()
    const fileValueOverrides = new Map<string, RuntimeApiBodyValue[]>([['otherForm.otherField', photoEntries]])
    const result = resolveBody(
      { title: 'literal-title' },
      'op "test"',
      { state, fileValueOverrides },
    )
    expect(result).toEqual({ status: 'ready', body: { title: 'literal-title' } })
  })
})

describe('resolveBody — fileValueOverrides substitution', () => {
  it('substitutes a forms.{formId}.{fieldId} reference by the precomputed array', () => {
    const state = makeState()
    const fileValueOverrides = new Map<string, RuntimeApiBodyValue[]>([['uploadForm.photos', photoEntries]])
    const result = resolveBody(
      { files: 'forms.uploadForm.photos' },
      'op "test"',
      { state, fileValueOverrides },
    )
    expect(result).toEqual({ status: 'ready', body: { files: photoEntries } })
  })

  it('substitutes with an empty array when the map associates the key to []', () => {
    const state = makeState()
    const fileValueOverrides = new Map<string, RuntimeApiBodyValue[]>([['uploadForm.photos', []]])
    const result = resolveBody(
      { files: 'forms.uploadForm.photos' },
      'op "test"',
      { state, fileValueOverrides },
    )
    expect(result).toEqual({ status: 'ready', body: { files: [] } })
  })

  it('applies the override to every appearance of the same reference without duplication or mutation', () => {
    const state = makeState()
    const fileValueOverrides = new Map<string, RuntimeApiBodyValue[]>([['uploadForm.photos', photoEntries]])
    const result = resolveBody(
      { primary: 'forms.uploadForm.photos', backup: { nested: 'forms.uploadForm.photos' } },
      'op "test"',
      { state, fileValueOverrides },
    )
    expect(result).toEqual({
      status: 'ready',
      body: { primary: photoEntries, backup: { nested: photoEntries } },
    })
    // the map's array must not have been mutated by the substitution
    expect(fileValueOverrides.get('uploadForm.photos')).toEqual(photoEntries)
    expect(fileValueOverrides.get('uploadForm.photos')).toHaveLength(2)
  })
})

describe('resolveBody — hidden field omission takes priority over fileValueOverrides', () => {
  it('omits the key instead of inserting the override array when the fieldId is hidden', () => {
    const state = makeState()
    const fileValueOverrides = new Map<string, RuntimeApiBodyValue[]>([['uploadForm.photos', photoEntries]])
    const hiddenFormFields: RuntimeApiHiddenFormFields = {
      formId: 'uploadForm',
      fieldIds: new Set(['photos']),
    }
    const result = resolveBody(
      { files: 'forms.uploadForm.photos' },
      'op "test"',
      { state, fileValueOverrides, hiddenFormFields },
    )
    expect(result).toEqual({ status: 'ready', body: {} })
  })
})

describe('resolveBody — override only matches a complete, unsuffixed forms.{formId}.{fieldId} reference', () => {
  it('does not consume the override for an interpolated placeholder inside a longer string (body keeps {{...}} literal, unaffected by the override, matching current no-interpolation behavior)', () => {
    const state = makeState()
    const fileValueOverrides = new Map<string, RuntimeApiBodyValue[]>([['uploadForm.photos', photoEntries]])
    const result = resolveBody(
      { note: 'prefix-{{forms.uploadForm.photos}}' },
      'op "test"',
      { state, fileValueOverrides },
    )
    expect(result).toEqual({
      status: 'ready',
      body: { note: 'prefix-{{forms.uploadForm.photos}}' },
    })
  })

  it('does not consume the override for a reference with extra path segments', () => {
    const state = makeState()
    const fileValueOverrides = new Map<string, RuntimeApiBodyValue[]>([['uploadForm.photos', photoEntries]])
    const result = resolveBody(
      { name: 'forms.uploadForm.photos.0.name' },
      'op "test"',
      { state, fileValueOverrides },
    )
    expect(result).toEqual({
      status: 'error',
      error: { code: 'request-build-failed', message: 'op "test" could not build its JSON body.' },
    })
  })
})

describe('resolveHeaders — fileValueOverrides is not applied', () => {
  it('still fails to resolve a forms.{formId}.{fieldId} reference into a header value', () => {
    const state = makeState()
    const fileValueOverrides = new Map<string, RuntimeApiBodyValue[]>([['uploadForm.photos', photoEntries]])
    const result = resolveHeaders(
      { 'X-Photos': 'forms.uploadForm.photos' },
      'op "test"',
      { state, fileValueOverrides },
    )
    expect(result).toEqual({
      status: 'error',
      error: {
        code: 'request-build-failed',
        message: 'op "test" could not resolve "forms.uploadForm.photos" for "headers.X-Photos".',
      },
    })
  })
})

describe('resolveQuery — fileValueOverrides is not applied (via buildRuntimeApiRequest)', () => {
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

  it('still fails to resolve a forms.{formId}.{fieldId} reference into a query value', () => {
    const state = makeState()
    const fileValueOverrides = new Map<string, RuntimeApiBodyValue[]>([['uploadForm.photos', photoEntries]])
    const result = buildRuntimeApiRequest({
      config: makeConfig({ foo: 'forms.uploadForm.photos' }),
      operationName: 'searchOp',
      state,
      fileValueOverrides,
    })
    expect(result).toEqual({
      status: 'error',
      error: {
        code: 'request-build-failed',
        message: expect.stringContaining('query.foo'),
      },
    })
  })
})
