import { describe, expect, it } from 'vitest'
import { validateRuntimeConfig } from '../../config/runtime-config'

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

  // T2: when in preload entries (structural schema tests)

  it('accepts a preload entry with operationName key and a valid when key', () => {
    const result = validateRuntimeConfig({
      api: {},
      pages: [
        {
          id: 'home',
          preloads: [
            {
              searchUsers: {},
              when: { reference: 'queries.searchUsers.data.flag', operator: 'isTruthy' },
            },
          ],
          layout: [],
        },
      ],
      initialPage: 'home',
    })

    expect(result.status).toBe('ready')
    if (result.status !== 'ready') throw new Error('Expected ready')
    expect(result.config.pages[0].preloads?.[0]).toEqual({
      operationName: 'searchUsers',
      requestParams: {},
      when: { reference: 'queries.searchUsers.data.flag', operator: 'isTruthy' },
    })
  })

  it('rejects a preload entry with three keys (operationName + when + extra) with existing invalidPreloadEntry message', () => {
    const result = validateRuntimeConfig({
      api: {},
      pages: [
        {
          id: 'home',
          preloads: [
            {
              searchUsers: {},
              when: { reference: 'queries.x.data', operator: 'isTruthy' },
              extraKey: 'not-allowed',
            },
          ],
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
        message: 'The page at "pages[0].preloads[0]" must be an object with exactly one non-empty operationName key.',
      },
    })
  })

  it('rejects a preload entry with two keys where neither is "when" with existing invalidPreloadEntry message', () => {
    const result = validateRuntimeConfig({
      api: {},
      pages: [
        {
          id: 'home',
          preloads: [
            {
              searchUsers: {},
              anotherKey: { foo: 'bar' },
            },
          ],
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
        message: 'The page at "pages[0].preloads[0]" must be an object with exactly one non-empty operationName key.',
      },
    })
  })

  it('rejects a preload entry when when.operator is not a string with ruta pages[N].preloads[M].when.<segment>', () => {
    const result = validateRuntimeConfig({
      api: {},
      pages: [
        {
          id: 'home',
          preloads: [
            {
              searchUsers: {},
              when: { reference: 'queries.x.data', operator: 123 },
            },
          ],
          layout: [],
        },
      ],
      initialPage: 'home',
    })

    expect(result.status).toBe('error')
    if (result.status !== 'error') throw new Error('Expected error')
    expect(result.error.message).toContain('pages[0].preloads[0].when')
  })

  it('rejects a preload entry when when value is not an object', () => {
    const result = validateRuntimeConfig({
      api: {},
      pages: [
        {
          id: 'home',
          preloads: [
            {
              searchUsers: {},
              when: 'not-an-object',
            },
          ],
          layout: [],
        },
      ],
      initialPage: 'home',
    })

    expect(result.status).toBe('error')
    if (result.status !== 'error') throw new Error('Expected error')
    expect(result.error.message).toContain('pages[0].preloads[0].when')
  })

  // T3: semantic validation of when.reference in preloads

  it('accepts preload with when.reference using params.*', () => {
    const result = validateRuntimeConfig({
      api: {},
      pages: [
        {
          id: 'home',
          preloads: [
            {
              searchUsers: {},
              when: { reference: 'params.userId', operator: 'isTruthy' },
            },
          ],
          layout: [],
        },
      ],
      initialPage: 'home',
    })

    expect(result.status).toBe('ready')
    if (result.status !== 'ready') throw new Error('Expected ready')
    expect(result.config.pages[0].preloads?.[0]).toEqual({
      operationName: 'searchUsers',
      requestParams: {},
      when: { reference: 'params.userId', operator: 'isTruthy' },
    })
  })

  it('accepts preload with when.reference using forms.*', () => {
    const result = validateRuntimeConfig({
      api: {},
      pages: [
        {
          id: 'home',
          preloads: [
            {
              searchUsers: {},
              when: { reference: 'forms.f1.field1', operator: 'equals', value: 'x' },
            },
          ],
          layout: [],
        },
      ],
      initialPage: 'home',
    })

    expect(result.status).toBe('ready')
  })

  it('rejects preload with when.reference using item.* with exact error path', () => {
    const result = validateRuntimeConfig({
      api: {},
      pages: [
        {
          id: 'home',
          preloads: [
            {
              searchUsers: {},
              when: { reference: 'item.x', operator: 'isTruthy' },
            },
          ],
          layout: [],
        },
      ],
      initialPage: 'home',
    })

    expect(result.status).toBe('error')
    if (result.status !== 'error') throw new Error('Expected error')
    expect(result.error.message).toContain('pages[0].preloads[0]')
    expect(result.error.message).toContain('when.reference')
  })

  it('rejects preload with when.reference using unsupported namespace', () => {
    const result = validateRuntimeConfig({
      api: {},
      pages: [
        {
          id: 'home',
          preloads: [
            {
              searchUsers: {},
              when: { reference: 'navigation.currentPage', operator: 'isTruthy' },
            },
          ],
          layout: [],
        },
      ],
      initialPage: 'home',
    })

    expect(result.status).toBe('error')
    if (result.status !== 'error') throw new Error('Expected error')
    expect(result.error.message).toContain('pages[0].preloads[0]')
    expect(result.error.message).toContain('when.reference')
  })

  it('rejects preload when.value that is not scalar when operator is equals', () => {
    const result = validateRuntimeConfig({
      api: {},
      pages: [
        {
          id: 'home',
          preloads: [
            {
              searchUsers: {},
              when: { reference: 'params.userId', operator: 'equals', value: { nested: true } },
            },
          ],
          layout: [],
        },
      ],
      initialPage: 'home',
    })

    expect(result.status).toBe('error')
    if (result.status !== 'error') throw new Error('Expected error')
    expect(result.error.message).toContain('when')
  })

  it('rejects preload when operator is outside the supported catalog', () => {
    const result = validateRuntimeConfig({
      api: {},
      pages: [
        {
          id: 'home',
          preloads: [
            {
              searchUsers: {},
              when: { reference: 'params.userId', operator: 'contains' },
            },
          ],
          layout: [],
        },
      ],
      initialPage: 'home',
    })

    expect(result.status).toBe('error')
    if (result.status !== 'error') throw new Error('Expected error')
    expect(result.error.message).toContain('when')
  })

  describe('tokens.* gating in preloads', () => {
    it('accepts tokens.* in preloads[].headers', () => {
      const result = validateRuntimeConfig({
        api: {},
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

    it('rejects tokens.* in preloads[].query', () => {
      const result = validateRuntimeConfig({
        api: {},
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

    it('rejects tokens.* in preloads[].body', () => {
      const result = validateRuntimeConfig({
        api: {},
        pages: [
          {
            id: 'home',
            layout: [],
            preloads: [
              { loadUser: { body: { token: 'tokens.session.value' } } },
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
  })

  // T-3: semantic validation of composed groups in preloads[].when (allowItem: false)
  describe('preloads when semantics — composed groups', () => {
    it('accepts preload with when as a group of two valid conditions (params.* + queries.*)', () => {
      const result = validateRuntimeConfig({
        api: {},
        pages: [
          {
            id: 'home',
            preloads: [
              {
                searchUsers: {},
                when: {
                  operator: 'and',
                  conditions: [
                    { reference: 'params.userId', operator: 'isTruthy' },
                    { reference: 'queries.searchUsers.data.flag', operator: 'isTruthy' },
                  ],
                },
              },
            ],
            layout: [],
          },
        ],
        initialPage: 'home',
      })
      expect(result.status).toBe('ready')
    })

    it('rejects preload with when as a group whose interior condition has an invalid reference (path pages[0].preloads[0].when.conditions[0].reference)', () => {
      const result = validateRuntimeConfig({
        api: {},
        pages: [
          {
            id: 'home',
            preloads: [
              {
                searchUsers: {},
                when: {
                  operator: 'and',
                  conditions: [{ reference: 'navigation.currentPage', operator: 'isTruthy' }],
                },
              },
            ],
            layout: [],
          },
        ],
        initialPage: 'home',
      })
      expect(result.status).toBe('error')
      if (result.status !== 'error') throw new Error('Expected error')
      expect(result.error.message).toContain('pages[0].preloads[0].when.conditions[0].reference')
    })

    it('rejects preload with when as a group whose interior condition references item (allowItem: false)', () => {
      const result = validateRuntimeConfig({
        api: {},
        pages: [
          {
            id: 'home',
            preloads: [
              {
                searchUsers: {},
                when: {
                  operator: 'and',
                  conditions: [{ reference: 'item', operator: 'isTruthy' }],
                },
              },
            ],
            layout: [],
          },
        ],
        initialPage: 'home',
      })
      expect(result.status).toBe('error')
      if (result.status !== 'error') throw new Error('Expected error')
      expect(result.error.message).toContain('pages[0].preloads[0].when.conditions[0].reference')
    })

    it('rejects preload with when as a group whose interior condition references item.foo (allowItem: false)', () => {
      const result = validateRuntimeConfig({
        api: {},
        pages: [
          {
            id: 'home',
            preloads: [
              {
                searchUsers: {},
                when: {
                  operator: 'or',
                  conditions: [{ reference: 'item.foo', operator: 'isTruthy' }],
                },
              },
            ],
            layout: [],
          },
        ],
        initialPage: 'home',
      })
      expect(result.status).toBe('error')
      if (result.status !== 'error') throw new Error('Expected error')
      expect(result.error.message).toContain('pages[0].preloads[0].when.conditions[0].reference')
    })
  })

  // T1: blocking flag in pages[].preloads entries
  describe('preloads blocking flag', () => {
    it('accepts a preload entry with blocking: true and exposes it normalized', () => {
      const result = validateRuntimeConfig({
        api: {},
        pages: [
          {
            id: 'home',
            preloads: [{ searchUsers: {}, blocking: true }],
            layout: [],
          },
        ],
        initialPage: 'home',
      })

      expect(result.status).toBe('ready')
      if (result.status !== 'ready') throw new Error('Expected ready')
      expect(result.config.pages[0].preloads?.[0]).toEqual({
        operationName: 'searchUsers',
        requestParams: {},
        blocking: true,
      })
    })

    it('accepts a preload entry with blocking: false and exposes it normalized', () => {
      const result = validateRuntimeConfig({
        api: {},
        pages: [
          {
            id: 'home',
            preloads: [{ searchUsers: {}, blocking: false }],
            layout: [],
          },
        ],
        initialPage: 'home',
      })

      expect(result.status).toBe('ready')
      if (result.status !== 'ready') throw new Error('Expected ready')
      expect(result.config.pages[0].preloads?.[0]).toEqual({
        operationName: 'searchUsers',
        requestParams: {},
        blocking: false,
      })
    })

    it('accepts a preload entry without blocking and omits the key from the normalized config', () => {
      const result = validateRuntimeConfig({
        api: {},
        pages: [
          {
            id: 'home',
            preloads: [{ searchUsers: {} }],
            layout: [],
          },
        ],
        initialPage: 'home',
      })

      expect(result.status).toBe('ready')
      if (result.status !== 'ready') throw new Error('Expected ready')
      expect(Object.prototype.hasOwnProperty.call(result.config.pages[0].preloads?.[0] ?? {}, 'blocking')).toBe(false)
    })

    it.each([
      ['string', 'yes'],
      ['number', 1],
      ['null', null],
      ['object', { foo: 'bar' }],
    ])('rejects a preload entry with a non-boolean blocking value (%s)', (_label, invalidValue) => {
      const result = validateRuntimeConfig({
        api: {},
        pages: [
          {
            id: 'home',
            preloads: [{ searchUsers: {}, blocking: invalidValue }],
            layout: [],
          },
        ],
        initialPage: 'home',
      })

      expect(result.status).toBe('error')
      if (result.status !== 'error') throw new Error('Expected error')
      expect(result.error.message).toContain('pages[0].preloads[0].blocking')
      expect(result.error.message.startsWith('The page at')).toBe(true)
    })

    it('accepts the combination of getX, when and blocking together and exposes both keys normalized', () => {
      const result = validateRuntimeConfig({
        api: {},
        pages: [
          {
            id: 'home',
            preloads: [
              {
                searchUsers: {},
                when: { reference: 'params.userId', operator: 'isTruthy' },
                blocking: true,
              },
            ],
            layout: [],
          },
        ],
        initialPage: 'home',
      })

      expect(result.status).toBe('ready')
      if (result.status !== 'ready') throw new Error('Expected ready')
      expect(result.config.pages[0].preloads?.[0]).toEqual({
        operationName: 'searchUsers',
        requestParams: {},
        when: { reference: 'params.userId', operator: 'isTruthy' },
        blocking: true,
      })
    })

    it('still rejects a preload entry with an extra key distinct from "when" and "blocking"', () => {
      const result = validateRuntimeConfig({
        api: {},
        pages: [
          {
            id: 'home',
            preloads: [{ searchUsers: {}, foo: 'not-allowed' }],
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
          message: 'The page at "pages[0].preloads[0]" must be an object with exactly one non-empty operationName key.',
        },
      })
    })
  })
})
