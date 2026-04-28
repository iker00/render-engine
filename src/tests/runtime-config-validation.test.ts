import { describe, expect, it } from 'vitest'
import { validateRuntimeConfig } from '../config/runtime-config'

function createConfigWithApi(api: Record<string, unknown>) {
  return {
    api,
    pages: [
      {
        id: 'home',
        layout: [],
      },
    ],
    initialPage: 'home',
  }
}

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

  describe('declarative api contract', () => {
    it('accepts a GET operation with endpoint and flat query parameters', () => {
      const result = validateRuntimeConfig(
        createConfigWithApi({
          searchUsers: {
            method: 'GET',
            endpoint: '/api/users',
            query: {
              search: 'Ada',
              page: 2,
              active: true,
            },
          },
        }),
      )

      expect(result.status).toBe('ready')
    })

    it('accepts POST, PUT, PATCH and DELETE operations with their supported payload channels', () => {
      const result = validateRuntimeConfig(
        createConfigWithApi({
          createUser: {
            method: 'POST',
            endpoint: '/api/users',
            body: {
              name: 'Ada',
              tags: ['admin'],
            },
          },
          replaceUser: {
            method: 'PUT',
            endpoint: '/api/users/ada',
            body: {
              name: 'Ada Lovelace',
              active: true,
            },
          },
          updateUser: {
            method: 'PATCH',
            endpoint: '/api/users/ada',
            body: {
              nickname: 'Ada',
            },
          },
          deleteUser: {
            method: 'DELETE',
            endpoint: '/api/users/ada',
            query: {
              hard: false,
            },
          },
        }),
      )

      expect(result.status).toBe('ready')
    })

    it('accepts body null only for methods that admit body', () => {
      expect(
        validateRuntimeConfig(
          createConfigWithApi({
            clearUser: {
              method: 'PATCH',
              endpoint: '/api/users/ada',
              body: null,
            },
          }),
        ).status,
      ).toBe('ready')

      expect(
        validateRuntimeConfig(
          createConfigWithApi({
            searchUsers: {
              method: 'GET',
              endpoint: '/api/users',
              body: null,
            },
          }),
        ),
      ).toEqual({
        status: 'error',
        error: {
          code: 'invalid-layout',
          displayMode: 'development-only',
          message: 'The api operation "searchUsers" uses method "GET" but declares an unsupported body.',
        },
      })
    })

    it('rejects operations with unsupported methods or empty endpoints', () => {
      expect(
        validateRuntimeConfig(
          createConfigWithApi({
            searchUsers: {
              method: 'HEAD',
              endpoint: '/api/users',
            },
          }),
        ),
      ).toEqual({
        status: 'error',
        error: {
          code: 'invalid-layout',
          displayMode: 'development-only',
          message: 'The api operation "searchUsers" uses unsupported method "HEAD".',
        },
      })

      expect(
        validateRuntimeConfig(
          createConfigWithApi({
            searchUsers: {
              method: 'GET',
              endpoint: '',
            },
          }),
        ),
      ).toEqual({
        status: 'error',
        error: {
          code: 'invalid-layout',
          displayMode: 'development-only',
          message: 'The api operation "searchUsers" must declare a non-empty endpoint.',
        },
      })
    })

    it('rejects query shapes outside the supported flat scalar contract', () => {
      expect(
        validateRuntimeConfig(
          createConfigWithApi({
            searchUsers: {
              method: 'GET',
              endpoint: '/api/users',
              query: [],
            },
          }),
        ),
      ).toEqual({
        status: 'error',
        error: {
          code: 'invalid-layout',
          displayMode: 'development-only',
          message: 'The api operation "searchUsers.query" must be an object with non-empty keys.',
        },
      })

      expect(
        validateRuntimeConfig({
          ...createConfigWithApi({}),
          api: {
            searchUsers: {
              method: 'GET',
              endpoint: '/api/users',
              query: {
                '': 'Ada',
              },
            },
          },
        }),
      ).toEqual({
        status: 'error',
        error: {
          code: 'invalid-layout',
          displayMode: 'development-only',
          message: 'The api operation "searchUsers.query" contains an empty key.',
        },
      })

      expect(
        validateRuntimeConfig(
          createConfigWithApi({
            searchUsers: {
              method: 'GET',
              endpoint: '/api/users',
              query: {
                filters: {
                  active: true,
                },
              },
            },
          }),
        ),
      ).toEqual({
        status: 'error',
        error: {
          code: 'invalid-layout',
          displayMode: 'development-only',
          message:
            'The api operation "searchUsers.query.filters" must resolve to a string, number, or boolean.',
        },
      })
    })

    it('rejects body trees with non-json values or incompatible shapes', () => {
      expect(
        validateRuntimeConfig(
          createConfigWithApi({
            createUser: {
              method: 'POST',
              endpoint: '/api/users',
              body: {
                createdAt: new Date('2024-01-01T00:00:00.000Z'),
              },
            },
          }),
        ),
      ).toEqual({
        status: 'error',
        error: {
          code: 'invalid-layout',
          displayMode: 'development-only',
          message: 'The api operation "createUser.body.createdAt" must be valid JSON data.',
        },
      })

      expect(
        validateRuntimeConfig(
          createConfigWithApi({
            createUser: {
              method: 'POST',
              endpoint: '/api/users',
              body: {
                tags: [undefined],
              },
            },
          }),
        ),
      ).toEqual({
        status: 'error',
        error: {
          code: 'invalid-layout',
          displayMode: 'development-only',
          message: 'The api operation "createUser.body.tags[0]" must be valid JSON data.',
        },
      })
    })
  })
})
