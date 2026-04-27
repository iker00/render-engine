import { describe, expect, it } from 'vitest'
import { validateRuntimeConfig } from '../config/runtime-config'

describe('validateRuntimeConfig', () => {
  it('accepts a page with id and layout without title or description', () => {
    const result = validateRuntimeConfig({
      api: {},
      pages: [
        {
          id: 'home',
          layout: {
            type: 'container',
            children: [
              {
                type: 'heading',
                props: {
                  text: 'Welcome',
                  level: 1,
                },
              },
              {
                type: 'list',
                props: {
                  items: ['One', 'Two'],
                },
              },
            ],
          },
        },
      ],
      initialPage: 'home',
    })

    expect(result).toEqual({
      status: 'ready',
      config: {
        api: {},
        pages: [
          {
            id: 'home',
            layout: {
              type: 'container',
              children: [
                {
                  type: 'heading',
                  props: {
                    text: 'Welcome',
                    level: 1,
                  },
                },
                {
                  type: 'list',
                  props: {
                    items: ['One', 'Two'],
                  },
                },
              ],
            },
          },
        ],
        initialPage: 'home',
      },
      page: {
        id: 'home',
        layout: {
          type: 'container',
          children: [
            {
              type: 'heading',
              props: {
                text: 'Welcome',
                level: 1,
              },
            },
            {
              type: 'list',
              props: {
                items: ['One', 'Two'],
              },
            },
          ],
        },
      },
    })
  })

  it('returns an explicit error when initialPage does not exist in pages', () => {
    const result = validateRuntimeConfig({
      api: {},
      pages: [
        {
          id: 'home',
          layout: {
            type: 'container',
          },
        },
      ],
      initialPage: 'missing-page',
    })

    expect(result).toEqual({
      status: 'error',
      error: {
        code: 'initial-page-not-found',
        displayMode: 'always',
        message: 'The initialPage "missing-page" does not match any page id.',
      },
    })
  })

  it('returns an explicit error when layout shape is invalid', () => {
    const result = validateRuntimeConfig({
      api: {},
      pages: [
        {
          id: 'home',
          layout: {
            type: 'container',
            children: 'not-an-array',
          },
        },
      ],
      initialPage: 'home',
    })

    expect(result).toEqual({
      status: 'error',
      error: {
        code: 'invalid-layout',
        displayMode: 'development-only',
        message: 'Page "home" has an invalid layout at "layout.children".',
      },
    })
  })

  it('classifies unsupported nodes explicitly for development and production handling', () => {
    const result = validateRuntimeConfig({
      api: {},
      pages: [
        {
          id: 'home',
          layout: {
            type: 'hero-banner',
          },
        },
      ],
      initialPage: 'home',
    })

    expect(result).toEqual({
      status: 'error',
      error: {
        code: 'unsupported-node-type',
        displayMode: 'development-only',
        message: 'Page "home" uses unsupported layout node type "hero-banner" at "layout".',
      },
    })
  })
})
