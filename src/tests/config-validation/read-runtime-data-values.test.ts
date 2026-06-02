import { describe, expect, it } from 'vitest'
import { readRuntimeDataValues } from '../../app/bootstrap/read-runtime-data-values'

describe('readRuntimeDataValues', () => {
  it('returns ready with source data-values when rootElement.dataset.values is a valid JSON object', () => {
    const rootElement = document.createElement('div')
    rootElement.dataset.values = '{"searchUsers":[{"id":"1","name":"Juan"}]}'

    const result = readRuntimeDataValues({
      devDataValues: {},
      isDevelopment: false,
      rootElement,
    })

    expect(result).toEqual({
      status: 'ready',
      source: 'data-values',
      dataValues: { searchUsers: [{ id: '1', name: 'Juan' }] },
    })
  })

  it('returns ready with source dev-data-values when no dataset.values and isDevelopment is true and devDataValues is non-empty', () => {
    const rootElement = document.createElement('div')

    const result = readRuntimeDataValues({
      devDataValues: { searchUsers: [] },
      isDevelopment: true,
      rootElement,
    })

    expect(result).toEqual({
      status: 'ready',
      source: 'dev-data-values',
      dataValues: { searchUsers: [] },
    })
  })

  it('returns ready with source none when no dataset.values and isDevelopment is false', () => {
    const rootElement = document.createElement('div')

    const result = readRuntimeDataValues({
      devDataValues: { searchUsers: [] },
      isDevelopment: false,
      rootElement,
    })

    expect(result).toEqual({
      status: 'ready',
      source: 'none',
      dataValues: {},
    })
  })

  it('returns ready with source none when no dataset.values, isDevelopment is true, and devDataValues is empty', () => {
    const rootElement = document.createElement('div')

    const result = readRuntimeDataValues({
      devDataValues: {},
      isDevelopment: true,
      rootElement,
    })

    expect(result).toEqual({
      status: 'ready',
      source: 'none',
      dataValues: {},
    })
  })

  it('prefers dataset.values over devDataValues when both are present in development', () => {
    const rootElement = document.createElement('div')
    rootElement.dataset.values = '{"fromAttr":true}'

    const result = readRuntimeDataValues({
      devDataValues: { fromDev: true },
      isDevelopment: true,
      rootElement,
    })

    expect(result).toEqual({
      status: 'ready',
      source: 'data-values',
      dataValues: { fromAttr: true },
    })
  })

  it('returns an error with code invalid-data-values-json when dataset.values is not valid JSON', () => {
    const rootElement = document.createElement('div')
    rootElement.dataset.values = '{invalid json'

    const result = readRuntimeDataValues({
      devDataValues: {},
      isDevelopment: false,
      rootElement,
    })

    expect(result).toEqual({
      status: 'error',
      error: {
        code: 'invalid-data-values-json',
        displayMode: 'always',
        message: expect.stringMatching(/data-values/),
      },
    })
  })

  it('returns an error with code invalid-data-values-shape when the root parsed value is an array', () => {
    const rootElement = document.createElement('div')
    rootElement.dataset.values = '[1,2,3]'

    const result = readRuntimeDataValues({
      devDataValues: {},
      isDevelopment: false,
      rootElement,
    })

    expect(result).toEqual({
      status: 'error',
      error: {
        code: 'invalid-data-values-shape',
        displayMode: 'always',
        message: expect.any(String),
      },
    })

    if (result.status === 'error') {
      expect(result.error.message.length).toBeGreaterThan(0)
    }
  })

  it('returns an error with code invalid-data-values-shape when the root parsed value is a string primitive', () => {
    const rootElement = document.createElement('div')
    rootElement.dataset.values = '"hello"'

    const result = readRuntimeDataValues({
      devDataValues: {},
      isDevelopment: false,
      rootElement,
    })

    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.code).toBe('invalid-data-values-shape')
      expect(result.error.displayMode).toBe('always')
      expect(result.error.message.length).toBeGreaterThan(0)
    }
  })

  it('returns an error with code invalid-data-values-shape when the root parsed value is a number primitive', () => {
    const rootElement = document.createElement('div')
    rootElement.dataset.values = '42'

    const result = readRuntimeDataValues({
      devDataValues: {},
      isDevelopment: false,
      rootElement,
    })

    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.code).toBe('invalid-data-values-shape')
    }
  })

  it('returns an error with code invalid-data-values-shape when the root parsed value is a boolean primitive', () => {
    const rootElement = document.createElement('div')
    rootElement.dataset.values = 'true'

    const result = readRuntimeDataValues({
      devDataValues: {},
      isDevelopment: false,
      rootElement,
    })

    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.code).toBe('invalid-data-values-shape')
    }
  })

  it('returns an error with code invalid-data-values-shape when the root parsed value is null', () => {
    const rootElement = document.createElement('div')
    rootElement.dataset.values = 'null'

    const result = readRuntimeDataValues({
      devDataValues: {},
      isDevelopment: false,
      rootElement,
    })

    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.code).toBe('invalid-data-values-shape')
    }
  })

  it('returns ready with source data-values and empty dataValues when dataset.values is an empty object', () => {
    const rootElement = document.createElement('div')
    rootElement.dataset.values = '{}'

    const result = readRuntimeDataValues({
      devDataValues: {},
      isDevelopment: false,
      rootElement,
    })

    expect(result).toEqual({
      status: 'ready',
      source: 'data-values',
      dataValues: {},
    })
  })

  it('accepts a null entry value and preserves it in dataValues', () => {
    const rootElement = document.createElement('div')
    rootElement.dataset.values = '{"a":null}'

    const result = readRuntimeDataValues({
      devDataValues: {},
      isDevelopment: false,
      rootElement,
    })

    expect(result).toEqual({
      status: 'ready',
      source: 'data-values',
      dataValues: { a: null },
    })
  })

  it('accepts a string primitive entry value and preserves it in dataValues', () => {
    const rootElement = document.createElement('div')
    rootElement.dataset.values = '{"a":"x"}'

    const result = readRuntimeDataValues({
      devDataValues: {},
      isDevelopment: false,
      rootElement,
    })

    expect(result).toEqual({
      status: 'ready',
      source: 'data-values',
      dataValues: { a: 'x' },
    })
  })

  it('accepts a number primitive entry value and preserves it in dataValues', () => {
    const rootElement = document.createElement('div')
    rootElement.dataset.values = '{"b":3}'

    const result = readRuntimeDataValues({
      devDataValues: {},
      isDevelopment: false,
      rootElement,
    })

    expect(result).toEqual({
      status: 'ready',
      source: 'data-values',
      dataValues: { b: 3 },
    })
  })

  it('accepts a boolean primitive entry value and preserves it in dataValues', () => {
    const rootElement = document.createElement('div')
    rootElement.dataset.values = '{"c":true}'

    const result = readRuntimeDataValues({
      devDataValues: {},
      isDevelopment: false,
      rootElement,
    })

    expect(result).toEqual({
      status: 'ready',
      source: 'data-values',
      dataValues: { c: true },
    })
  })

  it('does not modify the parsed dataValues object — structural equality with the parsed result', () => {
    const payload = { key1: [1, 2, 3], key2: { nested: true } }
    const rootElement = document.createElement('div')
    rootElement.dataset.values = JSON.stringify(payload)

    const result = readRuntimeDataValues({
      devDataValues: {},
      isDevelopment: false,
      rootElement,
    })

    expect(result.status).toBe('ready')
    if (result.status === 'ready') {
      expect(result.dataValues).toEqual(payload)
    }
  })
})
