import { describe, expect, it } from 'vitest'
import { resolveHeaders } from '../../queries/runtime-api-payload-resolver'
import type { RuntimeState } from '../../runtime/runtime-state/runtime-state-types'
import type { RuntimeApiHiddenFormFields } from '../../queries/runtime-api-types'

// Minimal RuntimeState for these unit tests — same pattern as runtime-api-payload-omission.test.ts
function makeState(
  overrides: Partial<RuntimeState> = {},
): RuntimeState {
  const base: RuntimeState = {
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
    modal: { activeModalId: null, activeIterationKey: null },
    i18n: { translations: {}, activeLanguage: 'es' },
    tokens: {},
  }
  return { ...base, ...overrides }
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

function makeStateWithParams(params: Record<string, string>): RuntimeState {
  return makeState({
    navigation: {
      currentPageId: 'home',
      history: [{ entryId: 0, pageId: 'home', params }],
      currentEntryIndex: 0,
      lastError: null,
    },
  })
}

function makeStateWithQuery(queryName: string, data: unknown): RuntimeState {
  return makeState({
    queries: {
      [queryName]: {
        status: 'success',
        data,
        error: null,
      },
    },
  })
}

function makeStateWithToken(tokenId: string, status: 'ready' | 'error', value?: string): RuntimeState {
  return makeState({
    tokens: {
      [tokenId]: status === 'ready'
        ? { status: 'ready', value: value ?? '' }
        : { status: 'error' },
    },
  })
}

const hiddenFormFields: RuntimeApiHiddenFormFields = {
  formId: 'myForm',
  fieldIds: new Set(['hiddenField', 'anotherHidden']),
}

// -----------------------------------------------------------------------
// Values without {{ — backward compatibility (routes via resolvePayloadValue)
// -----------------------------------------------------------------------
describe('resolveHeaders — values without {{...}} (backward compatibility)', () => {
  it('resolves a complete reference forms.f.field → ready with field value', () => {
    const state = makeState({ forms: makeFormState({ token: 'Bearer xyz' }) })
    const result = resolveHeaders(
      { Authorization: 'forms.myForm.token' },
      'op "test"',
      { state },
    )
    expect(result).toEqual({ status: 'ready', headers: { Authorization: 'Bearer xyz' } })
  })

  it('treats a static string without reference as literal → ready', () => {
    const state = makeState()
    const result = resolveHeaders(
      { 'Content-Type': 'application/json' },
      'op "test"',
      { state },
    )
    expect(result).toEqual({ status: 'ready', headers: { 'Content-Type': 'application/json' } })
  })

  it('omits the header when the value is a hidden-form-field reference (complete reference)', () => {
    const state = makeState({ forms: makeFormState({ hiddenField: 'secret' }) })
    const result = resolveHeaders(
      { 'X-Hidden': 'forms.myForm.hiddenField' },
      'op "test"',
      { state, hiddenFormFields },
    )
    expect(result).toEqual({ status: 'ready', headers: {} })
  })

  it('returns error when a complete reference is missing and not a hidden field', () => {
    const state = makeState()
    const result = resolveHeaders(
      { 'X-Missing': 'forms.myForm.unknownField' },
      'op "test"',
      { state },
    )
    expect(result).toEqual({
      status: 'error',
      error: {
        code: 'request-build-failed',
        message: expect.stringContaining('forms.myForm.unknownField'),
      },
    })
  })

  it('keeps visible header and omits hidden one when both are present (complete refs)', () => {
    const state = makeState({ forms: makeFormState({ token: 'tok', hiddenField: 'h' }) })
    const result = resolveHeaders(
      {
        Authorization: 'forms.myForm.token',
        'X-Hidden': 'forms.myForm.hiddenField',
      },
      'op "test"',
      { state, hiddenFormFields },
    )
    expect(result).toEqual({ status: 'ready', headers: { Authorization: 'tok' } })
  })
})

// -----------------------------------------------------------------------
// Single placeholder — "Bearer {{tokens.sede.value}}"
// -----------------------------------------------------------------------
describe('resolveHeaders — single placeholder interpolation', () => {
  it('resolves "Bearer {{tokens.sede.value}}" when token is ready', () => {
    const state = makeStateWithToken('sede', 'ready', 'XYZ')
    const result = resolveHeaders(
      { Authorization: 'Bearer {{tokens.sede.value}}' },
      'op "test"',
      { state },
    )
    expect(result).toEqual({ status: 'ready', headers: { Authorization: 'Bearer XYZ' } })
  })

  it('a value that is only one placeholder produces the same result as the complete reference', () => {
    const state = makeStateWithToken('sede', 'ready', 'tok-value')
    const result = resolveHeaders(
      { Authorization: '{{tokens.sede.value}}' },
      'op "test"',
      { state },
    )
    expect(result).toEqual({ status: 'ready', headers: { Authorization: 'tok-value' } })
  })

  it('ignores spaces around the reference inside the placeholder', () => {
    const state = makeStateWithToken('sede', 'ready', 'tok-value')
    const resultWithSpaces = resolveHeaders(
      { Authorization: '{{ tokens.sede.value }}' },
      'op "test"',
      { state },
    )
    const resultWithout = resolveHeaders(
      { Authorization: '{{tokens.sede.value}}' },
      'op "test"',
      { state },
    )
    expect(resultWithSpaces).toEqual(resultWithout)
    expect(resultWithSpaces).toEqual({ status: 'ready', headers: { Authorization: 'tok-value' } })
  })

  it('resolves placeholder with params reference', () => {
    const state = makeStateWithParams({ tenantId: 'acme' })
    const result = resolveHeaders(
      { 'X-Tenant': 'tenant-{{params.tenantId}}' },
      'op "test"',
      { state },
    )
    expect(result).toEqual({ status: 'ready', headers: { 'X-Tenant': 'tenant-acme' } })
  })

  it('resolves placeholder with queries reference', () => {
    const state = makeStateWithQuery('session', { userId: 'u-1' })
    const result = resolveHeaders(
      { 'X-User': '{{queries.session.data.userId}}' },
      'op "test"',
      { state },
    )
    expect(result).toEqual({ status: 'ready', headers: { 'X-User': 'u-1' } })
  })

  it('resolves placeholder with forms reference (non-hidden field)', () => {
    const state = makeState({ forms: makeFormState({ apiKey: 'key-123' }) })
    const result = resolveHeaders(
      { 'X-Api-Key': 'key-{{forms.myForm.apiKey}}' },
      'op "test"',
      { state },
    )
    expect(result).toEqual({ status: 'ready', headers: { 'X-Api-Key': 'key-key-123' } })
  })

  it('serializes number value from placeholder as string', () => {
    const state = makeStateWithQuery('stats', { count: 42 })
    const result = resolveHeaders(
      { 'X-Count': 'count-{{queries.stats.data.count}}' },
      'op "test"',
      { state },
    )
    expect(result).toEqual({ status: 'ready', headers: { 'X-Count': 'count-42' } })
  })

  it('serializes boolean value from placeholder as string', () => {
    const state = makeStateWithQuery('flags', { enabled: true })
    const result = resolveHeaders(
      { 'X-Enabled': '{{queries.flags.data.enabled}}-flag' },
      'op "test"',
      { state },
    )
    expect(result).toEqual({ status: 'ready', headers: { 'X-Enabled': 'true-flag' } })
  })
})

// -----------------------------------------------------------------------
// Multiple placeholders
// -----------------------------------------------------------------------
describe('resolveHeaders — multiple placeholders in one value', () => {
  it('combines two resolved placeholders with a separator', () => {
    const state = {
      ...makeStateWithParams({ tenantId: 'acme' }),
      queries: {
        session: {
          status: 'success' as const,
          data: { userId: 'u-1' },
          error: null,
        },
      },
    }
    const result = resolveHeaders(
      { 'X-Header': '{{params.tenantId}}-{{queries.session.data.userId}}' },
      'op "test"',
      { state },
    )
    expect(result).toEqual({ status: 'ready', headers: { 'X-Header': 'acme-u-1' } })
  })

  it('fails with request-build-failed when one placeholder resolves and another does not', () => {
    const state = makeStateWithParams({ tenantId: 'acme' })
    const result = resolveHeaders(
      { 'X-Header': '{{params.tenantId}}-{{params.missingParam}}' },
      'op "test"',
      { state },
    )
    expect(result).toEqual({
      status: 'error',
      error: {
        code: 'request-build-failed',
        message: expect.stringContaining('params.missingParam'),
      },
    })
  })

  it('does not produce a partial value when second placeholder fails', () => {
    const state = makeStateWithToken('sede', 'ready', 'XYZ')
    const result = resolveHeaders(
      { Authorization: 'Bearer {{tokens.sede.value}} {{params.missing}}' },
      'op "test"',
      { state },
    )
    expect(result.status).toBe('error')
    if (result.status !== 'error') return
    expect(result.error.code).toBe('request-build-failed')
  })
})

// -----------------------------------------------------------------------
// Error cases — unresolvable placeholder → request-build-failed
// -----------------------------------------------------------------------
describe('resolveHeaders — unresolvable placeholder produces request-build-failed', () => {
  it('fails when placeholder references a missing param', () => {
    const state = makeState()
    const result = resolveHeaders(
      { 'X-Header': '{{params.missingParam}}' },
      'op "test"',
      { state },
    )
    expect(result).toEqual({
      status: 'error',
      error: {
        code: 'request-build-failed',
        message: expect.stringContaining('params.missingParam'),
      },
    })
  })

  it('fails when placeholder references an invalid reference (too few segments)', () => {
    const state = makeState()
    const result = resolveHeaders(
      { 'X-Header': '{{forms.justOne}}' },
      'op "test"',
      { state },
    )
    expect(result.status).toBe('error')
    if (result.status !== 'error') return
    expect(result.error.code).toBe('request-build-failed')
  })

  it('fails when placeholder is the namespace only ({{params}})', () => {
    const state = makeState()
    const result = resolveHeaders(
      { 'X-Header': '{{params}}' },
      'op "test"',
      { state },
    )
    expect(result.status).toBe('error')
    if (result.status !== 'error') return
    expect(result.error.code).toBe('request-build-failed')
  })

  it('fails when placeholder references an unsupported namespace', () => {
    const state = makeState()
    const result = resolveHeaders(
      { 'X-Header': '{{navigation.currentPageId}}' },
      'op "test"',
      { state },
    )
    expect(result.status).toBe('error')
    if (result.status !== 'error') return
    expect(result.error.code).toBe('request-build-failed')
  })

  it('fails when placeholder content is empty ({{}})', () => {
    const state = makeState()
    const result = resolveHeaders(
      { 'X-Header': 'prefix-{{}}-suffix' },
      'op "test"',
      { state },
    )
    expect(result.status).toBe('error')
    if (result.status !== 'error') return
    expect(result.error.code).toBe('request-build-failed')
  })

  it('fails when placeholder content is only whitespace ({{   }})', () => {
    const state = makeState()
    const result = resolveHeaders(
      { 'X-Header': '{{   }}' },
      'op "test"',
      { state },
    )
    expect(result.status).toBe('error')
    if (result.status !== 'error') return
    expect(result.error.code).toBe('request-build-failed')
  })

  it('fails when placeholder resolves to null', () => {
    const state = makeStateWithQuery('data', { field: null })
    const result = resolveHeaders(
      { 'X-Header': 'prefix-{{queries.data.data.field}}' },
      'op "test"',
      { state },
    )
    expect(result.status).toBe('error')
    if (result.status !== 'error') return
    expect(result.error.code).toBe('request-build-failed')
  })

  it('fails when placeholder resolves to an object', () => {
    const state = makeStateWithQuery('data', { nested: { key: 'val' } })
    const result = resolveHeaders(
      { 'X-Header': '{{queries.data.data.nested}}' },
      'op "test"',
      { state },
    )
    expect(result.status).toBe('error')
    if (result.status !== 'error') return
    expect(result.error.code).toBe('request-build-failed')
  })

  it('fails when placeholder resolves to an array', () => {
    const state = makeStateWithQuery('data', { items: [1, 2, 3] })
    const result = resolveHeaders(
      { 'X-Header': '{{queries.data.data.items}}' },
      'op "test"',
      { state },
    )
    expect(result.status).toBe('error')
    if (result.status !== 'error') return
    expect(result.error.code).toBe('request-build-failed')
  })
})

// -----------------------------------------------------------------------
// Token error → token-refresh-failed
// -----------------------------------------------------------------------
describe('resolveHeaders — token error in placeholder produces token-refresh-failed', () => {
  it('fails with token-refresh-failed when the token is in error state', () => {
    const state = makeStateWithToken('sede', 'error')
    const result = resolveHeaders(
      { Authorization: 'Bearer {{tokens.sede.value}}' },
      'op "test"',
      { state },
    )
    expect(result).toEqual({
      status: 'error',
      error: {
        code: 'token-refresh-failed',
        message: expect.stringContaining('sede'),
      },
    })
  })

  it('propagates token-refresh-failed even when the token placeholder is not the first placeholder', () => {
    const state = {
      ...makeStateWithParams({ tenantId: 'acme' }),
      tokens: { sede: { status: 'error' as const } },
    }
    const result = resolveHeaders(
      { Authorization: '{{params.tenantId}}-{{tokens.sede.value}}' },
      'op "test"',
      { state },
    )
    expect(result).toEqual({
      status: 'error',
      error: {
        code: 'token-refresh-failed',
        message: expect.stringContaining('sede'),
      },
    })
  })
})

// -----------------------------------------------------------------------
// Hidden-form-field omission in interpolated values
// -----------------------------------------------------------------------
describe('resolveHeaders — hidden-form-field placeholder causes header omission', () => {
  it('omits the header when placeholder references the hidden field of the triggering form', () => {
    const state = makeState({ forms: makeFormState({ hiddenField: 'secret' }) })
    const result = resolveHeaders(
      { 'X-Hint': '{{forms.myForm.hiddenField}}' },
      'op "test"',
      { state, hiddenFormFields },
    )
    expect(result).toEqual({ status: 'ready', headers: {} })
  })

  it('omits the header when placeholder is mixed with literal prefix and the field is hidden', () => {
    const state = makeState({ forms: makeFormState({ hiddenField: 'secret' }) })
    const result = resolveHeaders(
      { 'X-Hint': 'prefix-{{forms.myForm.hiddenField}}' },
      'op "test"',
      { state, hiddenFormFields },
    )
    expect(result).toEqual({ status: 'ready', headers: {} })
  })

  it('omits the header when the hidden field is missing from the form store', () => {
    const state = makeState()
    const result = resolveHeaders(
      { 'X-Hint': '{{forms.myForm.hiddenField}}' },
      'op "test"',
      { state, hiddenFormFields },
    )
    expect(result).toEqual({ status: 'ready', headers: {} })
  })

  it('fails with request-build-failed when placeholder references a field from a different form', () => {
    const state = makeState()
    const result = resolveHeaders(
      { 'X-Hint': '{{forms.otherForm.someField}}' },
      'op "test"',
      { state, hiddenFormFields },
    )
    expect(result.status).toBe('error')
    if (result.status !== 'error') return
    expect(result.error.code).toBe('request-build-failed')
  })

  it('keeps visible headers and omits the one with the hidden-field placeholder', () => {
    const state = makeState({
      forms: makeFormState({ hiddenField: 'secret', token: 'tok' }),
    })
    const result = resolveHeaders(
      {
        Authorization: 'Bearer {{tokens.sede.value}}',
        'X-Hint': '{{forms.myForm.hiddenField}}',
      },
      'op "test"',
      {
        state: {
          ...state,
          tokens: { sede: { status: 'ready', value: 'tok-value' } },
        },
        hiddenFormFields,
      },
    )
    expect(result).toEqual({ status: 'ready', headers: { Authorization: 'Bearer tok-value' } })
  })
})

// -----------------------------------------------------------------------
// Non-interpolated strings that look similar to placeholders
// -----------------------------------------------------------------------
describe('resolveHeaders — strings with unmatched braces treated as literals', () => {
  it('treats "Bearer {token}" (single braces) as a literal string', () => {
    const state = makeState()
    const result = resolveHeaders(
      { Authorization: 'Bearer {token}' },
      'op "test"',
      { state },
    )
    expect(result).toEqual({ status: 'ready', headers: { Authorization: 'Bearer {token}' } })
  })

  it('treats "valor}raro" (unmatched closing brace) as a literal string', () => {
    const state = makeState()
    const result = resolveHeaders(
      { 'X-Header': 'valor}raro' },
      'op "test"',
      { state },
    )
    expect(result).toEqual({ status: 'ready', headers: { 'X-Header': 'valor}raro' } })
  })

  it('treats "prefix-queries.user.data.id" (no {{...}}) as a literal string', () => {
    const state = makeState()
    const result = resolveHeaders(
      { 'X-Id': 'prefix-queries.user.data.id' },
      'op "test"',
      { state },
    )
    expect(result).toEqual({ status: 'ready', headers: { 'X-Id': 'prefix-queries.user.data.id' } })
  })
})

// -----------------------------------------------------------------------
// Global regex state: multiple sequential calls must not interfere
// -----------------------------------------------------------------------
describe('resolveHeaders — global regex lastIndex does not leak between calls', () => {
  it('resolves the same interpolated header correctly on consecutive calls', () => {
    const state = makeStateWithToken('sede', 'ready', 'tok')
    const headers = { Authorization: 'Bearer {{tokens.sede.value}}' }

    const first = resolveHeaders(headers, 'op "test"', { state })
    const second = resolveHeaders(headers, 'op "test"', { state })

    expect(first).toEqual(second)
    expect(first).toEqual({ status: 'ready', headers: { Authorization: 'Bearer tok' } })
  })
})

// -----------------------------------------------------------------------
// Formatters in header placeholders (feature 0101, T4)
// -----------------------------------------------------------------------
describe('resolveHeaders — formatters in placeholders (success cases)', () => {
  it('applies uppercase to a token value inside "Bearer {{tokens.sede.value | uppercase}}"', () => {
    const state = makeStateWithToken('sede', 'ready', 'abc-xyz')
    const result = resolveHeaders(
      { Authorization: 'Bearer {{tokens.sede.value | uppercase}}' },
      'op "test"',
      { state },
    )
    expect(result).toEqual({
      status: 'ready',
      headers: { Authorization: 'Bearer ABC-XYZ' },
    })
  })

  it('applies number:2 to a query data value inside "X-Total: {{queries.total.data | number:2}}"', () => {
    const state = makeStateWithQuery('total', 1234.5)
    const result = resolveHeaders(
      { 'X-Total': 'X-Total: {{queries.total.data | number:2}}' },
      'op "test"',
      { state },
    )
    expect(result).toEqual({
      status: 'ready',
      headers: { 'X-Total': 'X-Total: 1.234,50' },
    })
  })
})

describe('resolveHeaders — formatter failures produce request-build-failed', () => {
  it('fails with request-build-failed when the formatter name is unknown', () => {
    const state = makeStateWithQuery('total', 1234.5)
    const result = resolveHeaders(
      { 'X-Fail': 'X-Fail: {{queries.total.data | doesNotExist}}' },
      'op "test"',
      { state },
    )
    expect(result.status).toBe('error')
    if (result.status !== 'error') return
    expect(result.error.code).toBe('request-build-failed')
  })

  it('fails with request-build-failed when input type is not compatible with the formatter (date on non-ISO string)', () => {
    const state = makeStateWithQuery('name', 'ana')
    const result = resolveHeaders(
      { 'X-Fail': 'X-Fail: {{queries.name.data | date:"dd/MM/yyyy"}}' },
      'op "test"',
      { state },
    )
    expect(result.status).toBe('error')
    if (result.status !== 'error') return
    expect(result.error.code).toBe('request-build-failed')
  })

  it('fails with request-build-failed when the argument grammar is invalid (truncate:)', () => {
    const state = makeStateWithQuery('total', 1234.5)
    const result = resolveHeaders(
      { 'X-Bad': 'X-Bad: {{queries.total.data | truncate:}}' },
      'op "test"',
      { state },
    )
    expect(result.status).toBe('error')
    if (result.status !== 'error') return
    expect(result.error.code).toBe('request-build-failed')
  })
})

describe('resolveHeaders — hidden-form-field omission preserved with formatter chain (D5)', () => {
  it('omits the header when placeholder targets a hidden field even when a formatter is present', () => {
    const state = makeState({ forms: makeFormState({ hiddenField: 'secret' }) })
    const result = resolveHeaders(
      { 'X-User': '{{forms.myForm.hiddenField | uppercase}}' },
      'op "test"',
      { state, hiddenFormFields },
    )
    expect(result).toEqual({ status: 'ready', headers: {} })
  })

  it('omits the header when placeholder targets a hidden field that is missing from the form store, even with a formatter', () => {
    const state = makeState()
    const result = resolveHeaders(
      { 'X-User': 'prefix-{{forms.myForm.hiddenField | uppercase}}' },
      'op "test"',
      { state, hiddenFormFields },
    )
    expect(result).toEqual({ status: 'ready', headers: {} })
  })
})

describe('resolveHeaders — placeholder without "|" behaves identically to pre-feature path', () => {
  it('a placeholder without any pipe follows the same code path and produces the same output', () => {
    const state = makeStateWithToken('sede', 'ready', 'plain-tok')
    const withoutFormatter = resolveHeaders(
      { Authorization: 'Bearer {{tokens.sede.value}}' },
      'op "test"',
      { state },
    )
    expect(withoutFormatter).toEqual({
      status: 'ready',
      headers: { Authorization: 'Bearer plain-tok' },
    })
  })
})
