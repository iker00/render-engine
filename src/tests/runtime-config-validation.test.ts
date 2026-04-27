import { describe, expect, it } from 'vitest'
import { validateRuntimeConfig } from '../config/runtime-config'

describe('validateRuntimeConfig', () => {
  it('accepts a page with multiple root layout nodes in order', () => {
    const result = validateRuntimeConfig({
      api: {},
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'heading',
              props: {
                text: 'Welcome',
                level: 1,
              },
            },
            {
              type: 'container',
              children: [
                {
                  type: 'list',
                  props: {
                    items: ['One', 'Two'],
                  },
                },
              ],
            },
          ],
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
            layout: [
              {
                type: 'heading',
                props: {
                  text: 'Welcome',
                  level: 1,
                },
              },
              {
                type: 'container',
                children: [
                  {
                    type: 'list',
                    props: {
                      items: ['One', 'Two'],
                    },
                  },
                ],
              },
            ],
          },
        ],
        initialPage: 'home',
      },
      page: {
        id: 'home',
        layout: [
          {
            type: 'heading',
            props: {
              text: 'Welcome',
              level: 1,
            },
          },
          {
            type: 'container',
            children: [
              {
                type: 'list',
                props: {
                  items: ['One', 'Two'],
                },
              },
            ],
          },
        ],
      },
    })
  })

  it('accepts an empty layout collection', () => {
    const result = validateRuntimeConfig({
      api: {},
      pages: [
        {
          id: 'empty-page',
          layout: [],
        },
      ],
      initialPage: 'empty-page',
    })

    expect(result).toEqual({
      status: 'ready',
      config: {
        api: {},
        pages: [
          {
            id: 'empty-page',
            layout: [],
          },
        ],
        initialPage: 'empty-page',
      },
      page: {
        id: 'empty-page',
        layout: [],
      },
    })
  })

  it('returns an explicit error when initialPage does not exist in pages', () => {
    const result = validateRuntimeConfig({
      api: {},
      pages: [
        {
          id: 'home',
          layout: [],
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

  it('rejects the old object root layout shape explicitly', () => {
    const result = validateRuntimeConfig({
      api: {},
      pages: [
        {
          id: 'home',
          layout: {
            type: 'container',
            children: [],
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
        message: 'Page "home" has an invalid layout at "layout".',
      },
    })
  })

  it('returns an explicit error when nested layout collections are invalid', () => {
    const result = validateRuntimeConfig({
      api: {},
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'container',
              children: 'not-an-array',
            },
          ],
        },
      ],
      initialPage: 'home',
    })

    expect(result).toEqual({
      status: 'error',
      error: {
        code: 'invalid-layout',
        displayMode: 'development-only',
        message: 'Page "home" has an invalid layout at "layout[0].children".',
      },
    })
  })

  it('classifies unsupported nodes explicitly for development and production handling', () => {
    const result = validateRuntimeConfig({
      api: {},
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'hero-banner',
            },
          ],
        },
      ],
      initialPage: 'home',
    })

    expect(result).toEqual({
      status: 'error',
      error: {
        code: 'unsupported-node-type',
        displayMode: 'development-only',
        message: 'Page "home" uses unsupported layout node type "hero-banner" at "layout[0]".',
      },
    })
  })

  it('rejects unsupported nested nodes inside container children', () => {
    const result = validateRuntimeConfig({
      api: {},
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'container',
              children: [
                {
                  type: 'list',
                  props: {
                    items: ['One', 'Two'],
                  },
                },
                {
                  type: 'hero-banner',
                },
              ],
            },
          ],
        },
      ],
      initialPage: 'home',
    })

    expect(result).toEqual({
      status: 'error',
      error: {
        code: 'unsupported-node-type',
        displayMode: 'development-only',
        message:
          'Page "home" uses unsupported layout node type "hero-banner" at "layout[0].children[1]".',
      },
    })
  })
})
