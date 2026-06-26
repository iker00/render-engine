import { describe, expect, it } from 'vitest'
import { validateRuntimeConfig } from '../../config/runtime-config'
import { createConfigWithPages } from './helpers'

describe('validateRuntimeConfig — page title field', () => {
  it('accepts a page without title and does not include the title key in the resulting RuntimePageConfig', () => {
    const result = validateRuntimeConfig(
      createConfigWithPages([{ id: 'home', layout: [] }]),
    )

    expect(result.status).toBe('ready')
    if (result.status !== 'ready') throw new Error('Expected ready')
    expect(Object.hasOwn(result.config.pages[0], 'title')).toBe(false)
    expect(Object.hasOwn(result.page, 'title')).toBe(false)
  })

  it('accepts a page with a non-empty title string and propagates it to RuntimePageConfig', () => {
    const result = validateRuntimeConfig(
      createConfigWithPages([{ id: 'home', title: 'Alta de usuario', layout: [] }]),
    )

    expect(result.status).toBe('ready')
    if (result.status !== 'ready') throw new Error('Expected ready')
    expect(result.config.pages[0].title).toBe('Alta de usuario')
    expect(result.page.title).toBe('Alta de usuario')
  })

  it('accepts a page with title as empty string and propagates it without error', () => {
    const result = validateRuntimeConfig(
      createConfigWithPages([{ id: 'home', title: '', layout: [] }]),
    )

    expect(result.status).toBe('ready')
    if (result.status !== 'ready') throw new Error('Expected ready')
    expect(result.config.pages[0].title).toBe('')
    expect(result.page.title).toBe('')
  })

  it('rejects a page where title is a number with code invalid-layout and message citing pages[N].title', () => {
    const result = validateRuntimeConfig(
      createConfigWithPages([{ id: 'home', title: 42, layout: [] }]),
    )

    expect(result.status).toBe('error')
    if (result.status !== 'error') throw new Error('Expected error')
    expect(result.error.code).toBe('invalid-layout')
    expect(result.error.message).toContain('pages[0].title')
    expect(result.error.message).toContain('must be a string')
  })

  it('rejects a page where title is null with code invalid-layout and message citing pages[N].title', () => {
    const result = validateRuntimeConfig(
      createConfigWithPages([{ id: 'home', title: null, layout: [] }]),
    )

    expect(result.status).toBe('error')
    if (result.status !== 'error') throw new Error('Expected error')
    expect(result.error.code).toBe('invalid-layout')
    expect(result.error.message).toContain('pages[0].title')
    expect(result.error.message).toContain('must be a string')
  })

  it('rejects a page where title is an array with code invalid-layout and message citing pages[N].title', () => {
    const result = validateRuntimeConfig(
      createConfigWithPages([{ id: 'home', title: ['x'], layout: [] }]),
    )

    expect(result.status).toBe('error')
    if (result.status !== 'error') throw new Error('Expected error')
    expect(result.error.code).toBe('invalid-layout')
    expect(result.error.message).toContain('pages[0].title')
    expect(result.error.message).toContain('must be a string')
  })

  it('an invalid id error takes precedence over an invalid title error (order: id → title)', () => {
    const result = validateRuntimeConfig(
      createConfigWithPages([{ id: '', title: 42, layout: [] }]),
    )

    expect(result.status).toBe('error')
    if (result.status !== 'error') throw new Error('Expected error')
    expect(result.error.code).toBe('invalid-layout')
    expect(result.error.message).toContain('pages[0].id')
    expect(result.error.message).not.toContain('pages[0].title')
  })

  it('accepts a page with both title and preloads and propagates both correctly', () => {
    const result = validateRuntimeConfig({
      api: {},
      pages: [
        {
          id: 'home',
          title: 'Dashboard',
          preloads: [{ loadUsers: {} }],
          layout: [],
        },
      ],
      initialPage: 'home',
    })

    expect(result.status).toBe('ready')
    if (result.status !== 'ready') throw new Error('Expected ready')
    const page = result.config.pages[0]
    expect(page.title).toBe('Dashboard')
    expect(page.preloads).toEqual([{ operationName: 'loadUsers', requestParams: {} }])
  })

  it('silently discards an unsupported extra key (e.g. description) without affecting title acceptance', () => {
    const result = validateRuntimeConfig(
      createConfigWithPages([
        { id: 'home', title: 'Home Page', description: 'some extra key', layout: [] },
      ]),
    )

    expect(result.status).toBe('ready')
    if (result.status !== 'ready') throw new Error('Expected ready')
    expect(result.config.pages[0].title).toBe('Home Page')
    expect(Object.hasOwn(result.config.pages[0], 'description')).toBe(false)
  })

  it('handles title error on the second page (correct index in message)', () => {
    const result = validateRuntimeConfig(
      createConfigWithPages(
        [
          { id: 'home', layout: [] },
          { id: 'details', title: 99, layout: [] },
        ],
        'home',
      ),
    )

    expect(result.status).toBe('error')
    if (result.status !== 'error') throw new Error('Expected error')
    expect(result.error.message).toContain('pages[1].title')
  })
})
