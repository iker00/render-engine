import { describe, expect, it } from 'vitest'
import { validateRuntimeConfig } from '../../config/runtime-config'

const baseApi = {
  getCatalog: {
    method: 'GET',
    endpoint: '/catalog',
  },
}

describe('validateRuntimeConfig — root preloads block', () => {
  it('accepts a config without a root preloads block and does not add the key', () => {
    const result = validateRuntimeConfig({
      api: baseApi,
      pages: [{ id: 'home', layout: [] }],
      initialPage: 'home',
    })

    expect(result.status).toBe('ready')
    if (result.status !== 'ready') throw new Error('Expected ready')
    expect(Object.prototype.hasOwnProperty.call(result.config, 'preloads')).toBe(false)
  })

  it('accepts a config with an empty root preloads array and does not add the key', () => {
    const result = validateRuntimeConfig({
      api: baseApi,
      pages: [{ id: 'home', layout: [] }],
      initialPage: 'home',
      preloads: [],
    })

    expect(result.status).toBe('ready')
    if (result.status !== 'ready') throw new Error('Expected ready')
    expect(Object.prototype.hasOwnProperty.call(result.config, 'preloads')).toBe(false)
  })

  it('accepts a root preload entry referencing a known api operation and exposes it as operationName/requestParams', () => {
    const result = validateRuntimeConfig({
      api: baseApi,
      pages: [{ id: 'home', layout: [] }],
      initialPage: 'home',
      preloads: [{ getCatalog: {} }],
    })

    expect(result).toEqual({
      status: 'ready',
      config: {
        api: baseApi,
        pages: [{ id: 'home', layout: [] }],
        initialPage: 'home',
        preloads: [
          {
            operationName: 'getCatalog',
            requestParams: {},
          },
        ],
      },
      page: { id: 'home', layout: [] },
    })
  })

  it('accepts a root preload entry with query/headers overrides and carries requestParams through untouched', () => {
    const result = validateRuntimeConfig({
      api: baseApi,
      pages: [{ id: 'home', layout: [] }],
      initialPage: 'home',
      preloads: [
        {
          getCatalog: {
            query: { locale: 'es' },
            headers: { 'x-a': 'b' },
          },
        },
      ],
    })

    expect(result.status).toBe('ready')
    if (result.status !== 'ready') throw new Error('Expected ready')
    expect(result.config.preloads).toEqual([
      {
        operationName: 'getCatalog',
        requestParams: {
          query: { locale: 'es' },
          headers: { 'x-a': 'b' },
        },
      },
    ])
  })

  it('rejects a root preload entry referencing an unknown api operation', () => {
    const result = validateRuntimeConfig({
      api: baseApi,
      pages: [{ id: 'home', layout: [] }],
      initialPage: 'home',
      preloads: [{ unknownOperation: {} }],
    })

    expect(result.status).toBe('error')
    if (result.status !== 'error') throw new Error('Expected error')
    expect(result.error.code).toBe('invalid-layout')
    expect(result.error.message.startsWith('The runtime config has an invalid layout at "preloads[0].unknownOperation"')).toBe(true)
  })

  it('rejects "when" inside a root preload entry as unsupported for this block', () => {
    const result = validateRuntimeConfig({
      api: baseApi,
      pages: [{ id: 'home', layout: [] }],
      initialPage: 'home',
      preloads: [
        {
          getCatalog: {},
          when: { reference: 'queries.x', operator: 'isTruthy' },
        },
      ],
    })

    expect(result.status).toBe('error')
    if (result.status !== 'error') throw new Error('Expected error')
    expect(result.error.code).toBe('invalid-layout')
    expect(result.error.message).toContain('preloads[0].when')
    expect(result.error.message.toLowerCase()).toContain('not supported')
  })

  it('rejects duplicate operationName entries within the root preloads block', () => {
    const result = validateRuntimeConfig({
      api: baseApi,
      pages: [{ id: 'home', layout: [] }],
      initialPage: 'home',
      preloads: [{ getCatalog: {} }, { getCatalog: { query: { locale: 'en' } } }],
    })

    expect(result.status).toBe('error')
    if (result.status !== 'error') throw new Error('Expected error')
    expect(result.error.code).toBe('invalid-layout')
    expect(result.error.message).toContain('preloads')
    expect(result.error.message).toContain('duplicate operationName "getCatalog"')
  })

  it('rejects a nested-object query value with the deepest exact path', () => {
    const result = validateRuntimeConfig({
      api: baseApi,
      pages: [{ id: 'home', layout: [] }],
      initialPage: 'home',
      preloads: [{ getCatalog: { query: { locale: { nested: true } } } }],
    })

    expect(result.status).toBe('error')
    if (result.status !== 'error') throw new Error('Expected error')
    expect(result.error.code).toBe('invalid-layout')
    expect(result.error.message).toContain('preloads[0].getCatalog.query.locale')
  })

  it('rejects a non-serializable body value with the deepest exact path', () => {
    const result = validateRuntimeConfig({
      api: baseApi,
      pages: [{ id: 'home', layout: [] }],
      initialPage: 'home',
      preloads: [{ getCatalog: { body: { a: () => 0 } } }],
    })

    expect(result.status).toBe('error')
    if (result.status !== 'error') throw new Error('Expected error')
    expect(result.error.code).toBe('invalid-layout')
    expect(result.error.message).toContain('preloads[0].getCatalog.body')
  })

  it('rejects a non-array root preloads value', () => {
    const result = validateRuntimeConfig({
      api: baseApi,
      pages: [{ id: 'home', layout: [] }],
      initialPage: 'home',
      preloads: 'oops',
    })

    expect(result).toEqual({
      status: 'error',
      error: {
        code: 'invalid-layout',
        displayMode: 'development-only',
        message: 'The runtime config field "preloads" must be an array.',
      },
    })
  })

  it('rejects malformed root preload entries (empty object or blank operationName key)', () => {
    const emptyObjectResult = validateRuntimeConfig({
      api: baseApi,
      pages: [{ id: 'home', layout: [] }],
      initialPage: 'home',
      preloads: [{}],
    })

    expect(emptyObjectResult.status).toBe('error')
    if (emptyObjectResult.status !== 'error') throw new Error('Expected error')
    expect(emptyObjectResult.error.code).toBe('invalid-layout')
    expect(emptyObjectResult.error.message).toContain('preloads[0]')

    const blankKeyResult = validateRuntimeConfig({
      api: baseApi,
      pages: [{ id: 'home', layout: [] }],
      initialPage: 'home',
      preloads: [{ '': {} }],
    })

    expect(blankKeyResult.status).toBe('error')
    if (blankKeyResult.status !== 'error') throw new Error('Expected error')
    expect(blankKeyResult.error.code).toBe('invalid-layout')
    expect(blankKeyResult.error.message).toContain('preloads[0]')
  })
})
