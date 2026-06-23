import { describe, expect, it } from 'vitest'
import { runtimeTokenConfigSchema, runtimeTokensConfigSchema } from '../../config/runtime-config-zod'
import { validateTokensConfig } from '../../config/validate-tokens-config'
import { validateRuntimeConfig } from '../../config/runtime-config'
import { createConfigWithApi } from './helpers'

function createConfigWithTokens(tokens: unknown, api: Record<string, unknown> = {}) {
  return {
    ...createConfigWithApi(api),
    tokens,
  }
}

describe('runtimeTokenConfigSchema', () => {
  it('accepts { value: "abc" } without refresh', () => {
    const result = runtimeTokenConfigSchema.safeParse({ value: 'abc' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toEqual({ value: 'abc' })
    }
  })

  it('accepts a token with a complete refresh block', () => {
    const result = runtimeTokenConfigSchema.safeParse({
      value: 'abc',
      refresh: { operation: 'op', responsePath: 'data.token', intervalSeconds: 30 },
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toEqual({
        value: 'abc',
        refresh: { operation: 'op', responsePath: 'data.token', intervalSeconds: 30 },
      })
    }
  })

  it('rejects value: "" (empty string)', () => {
    const result = runtimeTokenConfigSchema.safeParse({ value: '' })
    expect(result.success).toBe(false)
  })

  it('rejects value: 123', () => {
    const result = runtimeTokenConfigSchema.safeParse({ value: 123 })
    expect(result.success).toBe(false)
  })

  it('rejects value: null', () => {
    const result = runtimeTokenConfigSchema.safeParse({ value: null })
    expect(result.success).toBe(false)
  })

  it('rejects {} (missing value)', () => {
    const result = runtimeTokenConfigSchema.safeParse({})
    expect(result.success).toBe(false)
  })

  it('rejects refresh: {} (empty refresh object)', () => {
    const result = runtimeTokenConfigSchema.safeParse({ value: 'abc', refresh: {} })
    expect(result.success).toBe(false)
  })

  it('rejects refresh with only operation (missing responsePath and intervalSeconds)', () => {
    const result = runtimeTokenConfigSchema.safeParse({ value: 'abc', refresh: { operation: 'op' } })
    expect(result.success).toBe(false)
  })

  it('rejects refresh missing intervalSeconds', () => {
    const result = runtimeTokenConfigSchema.safeParse({ value: 'abc', refresh: { operation: 'op', responsePath: 'x' } })
    expect(result.success).toBe(false)
  })

  it('rejects refresh with empty operation', () => {
    const result = runtimeTokenConfigSchema.safeParse({
      value: 'abc',
      refresh: { operation: '', responsePath: 'x', intervalSeconds: 1 },
    })
    expect(result.success).toBe(false)
  })

  it('rejects refresh with empty responsePath', () => {
    const result = runtimeTokenConfigSchema.safeParse({
      value: 'abc',
      refresh: { operation: 'op', responsePath: '', intervalSeconds: 1 },
    })
    expect(result.success).toBe(false)
  })

  it('rejects intervalSeconds: 0', () => {
    const result = runtimeTokenConfigSchema.safeParse({
      value: 'abc',
      refresh: { operation: 'op', responsePath: 'x', intervalSeconds: 0 },
    })
    expect(result.success).toBe(false)
  })

  it('rejects intervalSeconds: -1', () => {
    const result = runtimeTokenConfigSchema.safeParse({
      value: 'abc',
      refresh: { operation: 'op', responsePath: 'x', intervalSeconds: -1 },
    })
    expect(result.success).toBe(false)
  })

  it('rejects intervalSeconds: 1.5 (non-integer)', () => {
    const result = runtimeTokenConfigSchema.safeParse({
      value: 'abc',
      refresh: { operation: 'op', responsePath: 'x', intervalSeconds: 1.5 },
    })
    expect(result.success).toBe(false)
  })

  it('rejects intervalSeconds: "5" (string)', () => {
    const result = runtimeTokenConfigSchema.safeParse({
      value: 'abc',
      refresh: { operation: 'op', responsePath: 'x', intervalSeconds: '5' },
    })
    expect(result.success).toBe(false)
  })

  it('accepts intervalSeconds: 1 (minimum positive integer)', () => {
    const result = runtimeTokenConfigSchema.safeParse({
      value: 'abc',
      refresh: { operation: 'op', responsePath: 'x', intervalSeconds: 1 },
    })
    expect(result.success).toBe(true)
  })

  it('strips extra keys in the token body silently', () => {
    const result = runtimeTokenConfigSchema.safeParse({ value: 'x', foo: 'bar' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).not.toHaveProperty('foo')
    }
  })

  it('strips extra keys in refresh silently', () => {
    const result = runtimeTokenConfigSchema.safeParse({
      value: 'x',
      refresh: { operation: 'op', responsePath: 'x', intervalSeconds: 1, extra: true },
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.refresh).not.toHaveProperty('extra')
    }
  })
})

describe('runtimeTokensConfigSchema', () => {
  it('accepts an empty record {}', () => {
    const result = runtimeTokensConfigSchema.safeParse({})
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toEqual({})
    }
  })

  it('accepts a record with a single valid token', () => {
    const result = runtimeTokensConfigSchema.safeParse({ token1: { value: 'abc' } })
    expect(result.success).toBe(true)
  })

  it('accepts a record with multiple valid tokens', () => {
    const result = runtimeTokensConfigSchema.safeParse({
      token1: { value: 'abc' },
      token2: { value: 'def', refresh: { operation: 'op', responsePath: 'data.token', intervalSeconds: 60 } },
    })
    expect(result.success).toBe(true)
  })

  it('rejects a key that is an empty string', () => {
    const result = runtimeTokensConfigSchema.safeParse({ '': { value: 'abc' } })
    expect(result.success).toBe(false)
  })
})

describe('validateTokensConfig', () => {
  it('returns ready with empty tokens when rawTokens is undefined', () => {
    const result = validateTokensConfig(undefined, new Set())
    expect(result.status).toBe('ready')
    if (result.status === 'ready') {
      expect(result.tokens).toEqual({})
    }
  })

  it('returns ready with empty tokens when rawTokens is {}', () => {
    const result = validateTokensConfig({}, new Set())
    expect(result.status).toBe('ready')
    if (result.status === 'ready') {
      expect(result.tokens).toEqual({})
    }
  })

  it('returns invalidLayout when rawTokens is null', () => {
    const result = validateTokensConfig(null, new Set())
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toBe('The runtime config field "tokens" must be a plain object.')
    }
  })

  it('returns invalidLayout when rawTokens is an array', () => {
    const result = validateTokensConfig([], new Set())
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toBe('The runtime config field "tokens" must be a plain object.')
    }
  })

  it('returns invalidLayout when rawTokens is a string', () => {
    const result = validateTokensConfig('foo', new Set())
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toBe('The runtime config field "tokens" must be a plain object.')
    }
  })

  it('returns ready with normalized token when value is present and no refresh', () => {
    const result = validateTokensConfig({ session: { value: 'abc' } }, new Set())
    expect(result.status).toBe('ready')
    if (result.status === 'ready') {
      expect(result.tokens).toEqual({ session: { value: 'abc' } })
    }
  })

  it('returns invalidLayout with path when value is empty string', () => {
    const result = validateTokensConfig({ session: { value: '' } }, new Set())
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toBe('The runtime config field "tokens.session.value" must be a non-empty string.')
    }
  })

  it('returns invalidLayout with path when value is missing', () => {
    const result = validateTokensConfig({ session: {} }, new Set())
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toBe('The runtime config field "tokens.session.value" must be a non-empty string.')
    }
  })

  it('returns invalidLayout for missing responsePath when refresh has only operation', () => {
    const result = validateTokensConfig(
      { session: { value: 'abc', refresh: { operation: 'refreshToken' } } },
      new Set(['refreshToken']),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toBe(
        'The runtime config field "tokens.session.refresh.responsePath" must be a non-empty string.',
      )
    }
  })

  it('returns invalidLayout for intervalSeconds: 0', () => {
    const result = validateTokensConfig(
      { session: { value: 'a', refresh: { operation: 'op', responsePath: 'data.token', intervalSeconds: 0 } } },
      new Set(['op']),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toBe(
        'The runtime config field "tokens.session.refresh.intervalSeconds" must be a positive integer.',
      )
    }
  })

  it('returns invalidLayout for intervalSeconds: 1.5 (non-integer)', () => {
    const result = validateTokensConfig(
      { session: { value: 'a', refresh: { operation: 'op', responsePath: 'data.token', intervalSeconds: 1.5 } } },
      new Set(['op']),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toBe(
        'The runtime config field "tokens.session.refresh.intervalSeconds" must be a positive integer.',
      )
    }
  })

  it('returns invalidLayout when refresh.operation does not exist in knownApiOperations', () => {
    const result = validateTokensConfig(
      { session: { value: 'a', refresh: { operation: 'missing', responsePath: 'data.token', intervalSeconds: 30 } } },
      new Set(['someOtherOp']),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toBe(
        'The runtime config field "tokens.session.refresh.operation" references unknown api operation "missing".',
      )
    }
  })

  it('returns ready with full token when all fields are valid and operation exists', () => {
    const result = validateTokensConfig(
      { session: { value: 'a', refresh: { operation: 'op', responsePath: 'data.token', intervalSeconds: 30 } } },
      new Set(['op']),
    )
    expect(result.status).toBe('ready')
    if (result.status === 'ready') {
      expect(result.tokens).toEqual({
        session: { value: 'a', refresh: { operation: 'op', responsePath: 'data.token', intervalSeconds: 30 } },
      })
    }
  })

  it('strips extra keys in token body and refresh silently', () => {
    const result = validateTokensConfig(
      {
        session: {
          value: 'x',
          extraField: 'ignored',
          refresh: { operation: 'op', responsePath: 'x', intervalSeconds: 1, extra: true },
        },
      },
      new Set(['op']),
    )
    expect(result.status).toBe('ready')
    if (result.status === 'ready') {
      expect(result.tokens.session).not.toHaveProperty('extraField')
      expect(result.tokens.session.refresh).not.toHaveProperty('extra')
    }
  })

  it('returns error pointing to the second token when the first is valid but the second is invalid', () => {
    const result = validateTokensConfig(
      {
        first: { value: 'abc' },
        second: { value: '' },
      },
      new Set(),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toBe('The runtime config field "tokens.second.value" must be a non-empty string.')
    }
  })

  it('returns invalidLayout when a token key is an empty string', () => {
    const result = validateTokensConfig({ '': { value: 'a' } }, new Set())
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('tokens')
      expect(result.error.message).toContain('non-empty')
    }
  })
})

describe('tokens.* surface gating', () => {
  // Accepted surfaces
  it('accepts tokens.* in api.{op}.headers', () => {
    const result = validateRuntimeConfig({
      ...createConfigWithApi({ getUser: { method: 'GET', endpoint: '/api/user', headers: { Authorization: 'tokens.session.value' } } }),
      tokens: { session: { value: 'abc' } },
    })
    expect(result.status).toBe('ready')
  })

  it('accepts tokens.* in preloads[].headers', () => {
    const result = validateRuntimeConfig({
      api: {},
      tokens: { session: { value: 'abc' } },
      pages: [
        {
          id: 'home',
          layout: [],
          preloads: [
            { loadUser: { headers: { Authorization: 'tokens.session.value' } } },
          ],
        },
      ],
      initialPage: 'home',
    })
    expect(result.status).toBe('ready')
  })

  it('accepts tokens.* in button.props.action.headers for executeOperation', () => {
    const result = validateRuntimeConfig({
      api: { searchUsers: { method: 'GET', endpoint: '/api/users' } },
      tokens: { session: { value: 'abc' } },
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'button',
              props: {
                label: 'Load',
                action: {
                  type: 'executeOperation',
                  operationName: 'searchUsers',
                  headers: { Authorization: 'tokens.session.value' },
                },
              },
            },
          ],
        },
      ],
      initialPage: 'home',
    })
    expect(result.status).toBe('ready')
  })

  it('accepts tokens.* in executeOperations.operations[].headers', () => {
    const result = validateRuntimeConfig({
      api: { op1: { method: 'GET', endpoint: '/api/x' } },
      tokens: { session: { value: 'abc' } },
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'button',
              props: {
                label: 'Run',
                action: {
                  type: 'executeOperations',
                  operations: [
                    { operationName: 'op1', headers: { Authorization: 'tokens.session.value' } },
                  ],
                },
              },
            },
          ],
        },
      ],
      initialPage: 'home',
    })
    expect(result.status).toBe('ready')
  })

  it('accepts tokens.* in form.submitAction.headers', () => {
    const result = validateRuntimeConfig({
      api: { saveUser: { method: 'POST', endpoint: '/api/user' } },
      tokens: { session: { value: 'abc' } },
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'form',
              id: 'user-form',
              submitAction: {
                type: 'executeOperation',
                operationName: 'saveUser',
                headers: { Authorization: 'tokens.session.value' },
              },
              children: [],
            },
          ],
        },
      ],
      initialPage: 'home',
    })
    expect(result.status).toBe('ready')
  })

  it('accepts tokens.* in form.submitAction executeOperations.operations[].headers', () => {
    const result = validateRuntimeConfig({
      api: { op1: { method: 'POST', endpoint: '/api/x' } },
      tokens: { session: { value: 'abc' } },
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'form',
              id: 'user-form',
              submitAction: {
                type: 'executeOperations',
                operations: [
                  { operationName: 'op1', headers: { Authorization: 'tokens.session.value' } },
                ],
              },
              children: [],
            },
          ],
        },
      ],
      initialPage: 'home',
    })
    expect(result.status).toBe('ready')
  })

  // Rejected surfaces
  it('rejects tokens.* in visibility.reference', () => {
    const result = validateRuntimeConfig({
      api: {},
      tokens: { session: { value: 'abc' } },
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'heading',
              props: { text: 'Hello', level: 1 },
              visibility: { reference: 'tokens.session.value', operator: 'isTruthy' },
            },
          ],
        },
      ],
      initialPage: 'home',
    })
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('tokens.* references are not supported in visibility')
    }
  })

  it('rejects tokens.* in api.{op}.query', () => {
    const result = validateRuntimeConfig({
      api: {
        getUser: { method: 'GET', endpoint: '/api/user', query: { token: 'tokens.session.value' } },
      },
      tokens: { session: { value: 'abc' } },
      pages: [{ id: 'home', layout: [] }],
      initialPage: 'home',
    })
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('tokens.*')
    }
  })

  it('rejects tokens.* in api.{op}.body', () => {
    const result = validateRuntimeConfig({
      api: {
        saveUser: { method: 'POST', endpoint: '/api/user', body: { token: 'tokens.session.value' } },
      },
      tokens: { session: { value: 'abc' } },
      pages: [{ id: 'home', layout: [] }],
      initialPage: 'home',
    })
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('tokens.*')
    }
  })

  it('rejects tokens.* in api.{op}.endpoint placeholder', () => {
    const result = validateRuntimeConfig({
      api: {
        getUser: { method: 'GET', endpoint: '/api/{{tokens.session.value}}/data' },
      },
      tokens: { session: { value: 'abc' } },
      pages: [{ id: 'home', layout: [] }],
      initialPage: 'home',
    })
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('tokens.*')
    }
  })

  it('rejects tokens.* in preloads[].query', () => {
    const result = validateRuntimeConfig({
      api: {},
      tokens: { session: { value: 'abc' } },
      pages: [
        {
          id: 'home',
          layout: [],
          preloads: [
            { loadUser: { query: { token: 'tokens.session.value' } } },
          ],
        },
      ],
      initialPage: 'home',
    })
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('tokens.*')
    }
  })

  it('rejects tokens.* in preloads[].when.reference', () => {
    const result = validateRuntimeConfig({
      api: {},
      tokens: { session: { value: 'abc' } },
      pages: [
        {
          id: 'home',
          layout: [],
          preloads: [
            {
              loadUser: {},
              when: { reference: 'tokens.session.value', operator: 'isTruthy' },
            },
          ],
        },
      ],
      initialPage: 'home',
    })
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('tokens.*')
    }
  })

  it('rejects tokens.* in button.props.action.query', () => {
    const result = validateRuntimeConfig({
      api: { searchUsers: { method: 'GET', endpoint: '/api/users' } },
      tokens: { session: { value: 'abc' } },
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'button',
              props: {
                label: 'Load',
                action: {
                  type: 'executeOperation',
                  operationName: 'searchUsers',
                  query: { token: 'tokens.session.value' },
                },
              },
            },
          ],
        },
      ],
      initialPage: 'home',
    })
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('tokens.*')
    }
  })

  it('rejects tokens.* in form.submitAction.query', () => {
    const result = validateRuntimeConfig({
      api: { saveUser: { method: 'POST', endpoint: '/api/user' } },
      tokens: { session: { value: 'abc' } },
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'form',
              id: 'user-form',
              submitAction: {
                type: 'executeOperation',
                operationName: 'saveUser',
                query: { token: 'tokens.session.value' },
              },
              children: [],
            },
          ],
        },
      ],
      initialPage: 'home',
    })
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('tokens.*')
    }
  })

  it('rejects tokens.* in repeater.props.items.source', () => {
    const result = validateRuntimeConfig({
      api: {},
      tokens: { session: { value: 'abc' } },
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'repeater',
              props: {
                items: {
                  source: 'tokens.session.value',
                  key: 'id',
                },
                template: [],
              },
            },
          ],
        },
      ],
      initialPage: 'home',
    })
    expect(result.status).toBe('error')
  })

  it('rejects tokens.* in input.props.defaultValue', () => {
    const result = validateRuntimeConfig({
      api: { submitUserForm: { method: 'POST', endpoint: '/api/forms' } },
      tokens: { session: { value: 'abc' } },
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'form',
              id: 'user-form',
              submitAction: { type: 'executeOperation', operationName: 'submitUserForm' },
              children: [
                {
                  type: 'input',
                  props: {
                    fieldId: 'name',
                    label: 'Name',
                    defaultValue: 'tokens.session.value',
                  },
                },
              ],
            },
          ],
        },
      ],
      initialPage: 'home',
    })
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('tokens.*')
    }
  })

  it('does not reject queryStateFeedback.query literal that looks like a namespace (regression)', () => {
    const result = validateRuntimeConfig({
      api: { tokens: { method: 'GET', endpoint: '/api/tokens' } },
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'heading',
              props: { text: 'Hello', level: 1 },
              queryStateFeedback: {
                query: 'tokens',
                states: { loading: { mode: 'hide' } },
              },
            },
          ],
        },
      ],
      initialPage: 'home',
    })
    expect(result.status).toBe('ready')
  })
})

describe('validateRuntimeConfig (tokens wiring)', () => {
  it('accepts a config with tokens: { session: { value: "abc" } } and exposes config.tokens', () => {
    const result = validateRuntimeConfig(createConfigWithTokens({ session: { value: 'abc' } }))
    expect(result.status).toBe('ready')
    if (result.status === 'ready') {
      expect(result.config.tokens).toEqual({ session: { value: 'abc' } })
    }
  })

  it('accepts a config with tokens and valid refresh pointing to an existing api operation', () => {
    const result = validateRuntimeConfig(
      createConfigWithTokens(
        {
          session: {
            value: 'abc',
            refresh: { operation: 'refreshToken', responsePath: 'data.token', intervalSeconds: 30 },
          },
        },
        { refreshToken: { method: 'POST', endpoint: '/refresh' } },
      ),
    )
    expect(result.status).toBe('ready')
    if (result.status === 'ready') {
      expect(result.config.tokens).toEqual({
        session: {
          value: 'abc',
          refresh: { operation: 'refreshToken', responsePath: 'data.token', intervalSeconds: 30 },
        },
      })
    }
  })

  it('rejects a config where tokens.session.refresh.operation references an unknown api operation', () => {
    const result = validateRuntimeConfig(
      createConfigWithTokens(
        {
          session: {
            value: 'abc',
            refresh: { operation: 'unknown', responsePath: 'data.token', intervalSeconds: 30 },
          },
        },
        { someOtherOp: { method: 'GET', endpoint: '/other' } },
      ),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('tokens.session.refresh.operation')
      expect(result.error.message).toContain('"unknown"')
    }
  })

  it('accepts a config with tokens: {} and does not expose config.tokens', () => {
    const result = validateRuntimeConfig(createConfigWithTokens({}))
    expect(result.status).toBe('ready')
    if (result.status === 'ready') {
      expect(result.config.tokens).toBeUndefined()
    }
  })

  it('accepts a config where tokens is omitted and config.tokens is undefined (regression: no tokens block)', () => {
    const result = validateRuntimeConfig(createConfigWithApi({}))
    expect(result.status).toBe('ready')
    if (result.status === 'ready') {
      expect(result.config.tokens).toBeUndefined()
    }
  })

  it('rejects a config with tokens: null with a plain object error', () => {
    const result = validateRuntimeConfig(createConfigWithTokens(null))
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toBe('The runtime config field "tokens" must be a plain object.')
    }
  })

  it('reports api error first when api is invalid even if tokens also references an unknown operation', () => {
    const result = validateRuntimeConfig({
      api: { invalidOp: { method: 'INVALID_METHOD', endpoint: '/x' } },
      pages: [{ id: 'home', layout: [] }],
      initialPage: 'home',
      tokens: {
        session: {
          value: 'abc',
          refresh: { operation: 'nonExistent', responsePath: 'data.token', intervalSeconds: 30 },
        },
      },
    })
    expect(result.status).toBe('error')
    // The error should not mention tokens — it should be the api error
    if (result.status === 'error') {
      expect(result.error.message).not.toContain('tokens')
    }
  })
})
