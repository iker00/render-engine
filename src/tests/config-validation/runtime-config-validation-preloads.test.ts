import { describe, expect, it } from 'vitest'
import { validateRuntimeConfig } from '../../config/runtime-config'
import { createConfigWithPages } from './helpers'

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

  it('accepts pages without preloads', () => {
    const result = validateRuntimeConfig({
      api: {},
      pages: [
        {
          id: 'home',
          layout: [],
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
            layout: [],
          },
        ],
        initialPage: 'home',
      },
      page: {
        id: 'home',
        layout: [],
      },
    })
  })

  it('accepts pages with an empty preloads list', () => {
    const result = validateRuntimeConfig({
      api: {},
      pages: [
        {
          id: 'home',
          preloads: [],
          layout: [],
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
            preloads: [],
            layout: [],
          },
        ],
        initialPage: 'home',
      },
      page: {
        id: 'home',
        preloads: [],
        layout: [],
      },
    })
  })

  it('accepts pages with preloads in declared order', () => {
    const result = validateRuntimeConfig({
      api: {},
      pages: [
        {
          id: 'home',
          preloads: [{ searchUsers: {} }, { loadTeams: {} }],
          layout: [],
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
            preloads: [
              {
                operationName: 'searchUsers',
                requestParams: {},
              },
              {
                operationName: 'loadTeams',
                requestParams: {},
              },
            ],
            layout: [],
          },
        ],
        initialPage: 'home',
      },
      page: {
        id: 'home',
        preloads: [
          {
            operationName: 'searchUsers',
            requestParams: {},
          },
          {
            operationName: 'loadTeams',
            requestParams: {},
          },
        ],
        layout: [],
      },
    })
  })

  it('accepts preload request overrides and normalizes them to operationName plus requestParams', () => {
    const result = validateRuntimeConfig({
      api: {},
      pages: [
        {
          id: 'home',
          preloads: [
            {
              loadUser: {
                query: {
                  userId: 'params.userId',
                },
                headers: {
                  Authorization: 'forms.session.token',
                },
                body: {
                  filters: {
                    active: true,
                  },
                },
              },
            },
          ],
          layout: [],
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
            preloads: [
              {
                operationName: 'loadUser',
                requestParams: {
                  query: {
                    userId: 'params.userId',
                  },
                  headers: {
                    Authorization: 'forms.session.token',
                  },
                  body: {
                    filters: {
                      active: true,
                    },
                  },
                },
              },
            ],
            layout: [],
          },
        ],
        initialPage: 'home',
      },
      page: {
        id: 'home',
        preloads: [
          {
            operationName: 'loadUser',
            requestParams: {
              query: {
                userId: 'params.userId',
              },
              headers: {
                Authorization: 'forms.session.token',
              },
              body: {
                filters: {
                  active: true,
                },
              },
            },
          },
        ],
        layout: [],
      },
    })
  })

  it('rejects preloads when it is not an array', () => {
    const result = validateRuntimeConfig({
      api: {},
      pages: [
        {
          id: 'home',
          preloads: 'searchUsers',
          layout: [],
        },
      ],
      initialPage: 'home',
    })

    expect(result).toEqual({
      status: 'error',
      error: {
        code: 'invalid-layout',
        displayMode: 'development-only',
        message: 'The page at "pages[0].preloads" must be an array of preload objects.',
      },
    })
  })

  it('rejects the historical string preload shape and other invalid preload entries', () => {
    expect(
      validateRuntimeConfig({
        api: {},
        pages: [
          {
            id: 'home',
            preloads: ['searchUsers'],
            layout: [],
          },
        ],
        initialPage: 'home',
      }),
    ).toEqual({
      status: 'error',
      error: {
        code: 'invalid-layout',
        displayMode: 'development-only',
        message: 'The page at "pages[0].preloads[0]" must be an object with exactly one non-empty operationName key.',
      },
    })

    expect(
      validateRuntimeConfig({
        api: {},
        pages: [
          {
            id: 'home',
            preloads: [{}],
            layout: [],
          },
        ],
        initialPage: 'home',
      }),
    ).toEqual({
      status: 'error',
      error: {
        code: 'invalid-layout',
        displayMode: 'development-only',
        message: 'The page at "pages[0].preloads[0]" must be an object with exactly one non-empty operationName key.',
      },
    })

    expect(
      validateRuntimeConfig({
        api: {},
        pages: [
          {
            id: 'home',
            preloads: [{ '   ': {} }],
            layout: [],
          },
        ],
        initialPage: 'home',
      }),
    ).toEqual({
      status: 'error',
      error: {
        code: 'invalid-layout',
        displayMode: 'development-only',
        message: 'The page at "pages[0].preloads[0]" must be an object with exactly one non-empty operationName key.',
      },
    })

    expect(
      validateRuntimeConfig({
        api: {},
        pages: [
          {
            id: 'home',
            preloads: [{ searchUsers: {} }, { searchUsers: {} }],
            layout: [],
          },
        ],
        initialPage: 'home',
      }),
    ).toEqual({
      status: 'error',
      error: {
        code: 'invalid-layout',
        displayMode: 'development-only',
        message: 'The page at "pages[0].preloads" contains duplicate operationName "searchUsers".',
      },
    })

    expect(
      validateRuntimeConfig({
        api: {},
        pages: [
          {
            id: 'home',
            preloads: [{ searchUsers: {} }, { loadTeams: {}, loadUsers: {} }],
            layout: [],
          },
        ],
        initialPage: 'home',
      }),
    ).toEqual({
      status: 'error',
      error: {
        code: 'invalid-layout',
        displayMode: 'development-only',
        message: 'The page at "pages[0].preloads[1]" must be an object with exactly one non-empty operationName key.',
      },
    })
  })

  it('accepts a heading with props.icon as a string without rejecting in bootstrap', () => {
    const result = validateRuntimeConfig({
      api: {},
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'heading',
              props: {
                text: 'Hello',
                level: 1,
                icon: 'Search',
              },
            },
          ],
        },
      ],
      initialPage: 'home',
    })

    expect(result.status).toBe('ready')
    if (result.status === 'ready') {
      const node = result.config.pages[0].layout[0] as { props: { icon?: string } }
      expect(node.props.icon).toBe('Search')
    }
  })

  it('accepts a paragraph with props.icon as a string without rejecting in bootstrap', () => {
    const result = validateRuntimeConfig({
      api: {},
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'paragraph',
              props: {
                text: 'Hello',
                icon: 'Search',
              },
            },
          ],
        },
      ],
      initialPage: 'home',
    })

    expect(result.status).toBe('ready')
    if (result.status === 'ready') {
      const node = result.config.pages[0].layout[0] as { props: { icon?: string } }
      expect(node.props.icon).toBe('Search')
    }
  })

  it('keeps missing preload operations as runtime-recoverable instead of rejecting them in config validation', () => {
    const result = validateRuntimeConfig({
      api: {},
      pages: [
        {
          id: 'home',
          preloads: [{ missingOperation: {} }],
          layout: [],
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
            preloads: [
              {
                operationName: 'missingOperation',
                requestParams: {},
              },
            ],
            layout: [],
          },
        ],
        initialPage: 'home',
      },
      page: {
        id: 'home',
        preloads: [
          {
            operationName: 'missingOperation',
            requestParams: {},
          },
        ],
        layout: [],
      },
    })
  })
})
