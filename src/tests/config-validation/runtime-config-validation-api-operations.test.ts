import { describe, expect, it } from 'vitest'
import { validateRuntimeConfig } from '../../config/runtime-config'
import {
  createConfigWithApi,
  createConfigWithExecuteOperationButtonAction,
  createConfigWithFormLayout,
} from './helpers'

describe('validateRuntimeConfig', () => {
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

    it('drops unsupported extra keys from api operations while preserving the supported contract', () => {
      const result = validateRuntimeConfig(
        createConfigWithApi({
          createUser: {
            method: 'POST',
            endpoint: '/api/users',
            timeout: 5000,
            query: {
              active: true,
            },
            body: {
              name: 'Ada',
            },
          },
        }),
      )

      if (result.status !== 'ready') {
        throw new Error('Expected ready result')
      }

      expect(result.config.api.createUser).toEqual({
        method: 'POST',
        endpoint: '/api/users',
        query: {
          active: true,
        },
        body: {
          name: 'Ada',
        },
      })
    })

    it('accepts api headers and execution-level query body and headers for executeOperation and submitAction', () => {
      const buttonResult = validateRuntimeConfig(
        createConfigWithExecuteOperationButtonAction(
          {
            query: {
              search: 'forms.user-form.name',
              page: 2,
            },
            body: {
              profile: {
                role: 'admin',
              },
            },
            headers: {
              authorization: 'queries.session.data.token',
              'x-static': 'enabled',
            },
          },
          {
            api: {
              searchUsers: {
                method: 'POST',
                endpoint: '/api/users/search',
                headers: {
                  accept: 'application/json',
                },
              },
            },
          },
        ),
      )

      expect(buttonResult).toEqual({
        status: 'ready',
        config: {
          api: {
            searchUsers: {
              method: 'POST',
              endpoint: '/api/users/search',
              headers: {
                accept: 'application/json',
              },
            },
          },
          pages: [
            {
              id: 'home',
              layout: [
                {
                  type: 'button',
                  props: {
                    label: 'Load users',
                    action: {
                      type: 'executeOperation',
                      operationName: 'searchUsers',
                      query: {
                        search: 'forms.user-form.name',
                        page: 2,
                      },
                      body: {
                        profile: {
                          role: 'admin',
                        },
                      },
                      headers: {
                        authorization: 'queries.session.data.token',
                        'x-static': 'enabled',
                      },
                    },
                  },
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
              type: 'button',
              props: {
                label: 'Load users',
                action: {
                  type: 'executeOperation',
                  operationName: 'searchUsers',
                  query: {
                    search: 'forms.user-form.name',
                    page: 2,
                  },
                  body: {
                    profile: {
                      role: 'admin',
                    },
                  },
                  headers: {
                    authorization: 'queries.session.data.token',
                    'x-static': 'enabled',
                  },
                },
              },
            },
          ],
        },
      })

      const formResult = validateRuntimeConfig(
        createConfigWithFormLayout(
          {
            submitAction: {
              type: 'executeOperation',
              operationName: 'submitUserForm',
              query: {
                draft: true,
              },
              body: {
                profile: {
                  name: 'forms.user-form.name',
                },
              },
              headers: {
                authorization: 'queries.session.data.token',
              },
            },
          },
          {
            api: {
              submitUserForm: {
                method: 'POST',
                endpoint: '/api/forms',
                headers: {
                  accept: 'application/json',
                },
              },
            },
          },
        ),
      )

      expect(formResult.status).toBe('ready')

      if (formResult.status !== 'ready') {
        throw new Error('Expected ready result')
      }

      expect(formResult.config.api.submitUserForm).toEqual({
        method: 'POST',
        endpoint: '/api/forms',
        headers: {
          accept: 'application/json',
        },
      })

      expect(formResult.config.pages[0].layout[0]).toMatchObject({
        type: 'form',
        submitAction: {
          type: 'executeOperation',
          operationName: 'submitUserForm',
          query: {
            draft: true,
          },
          body: {
            profile: {
              name: 'forms.user-form.name',
            },
          },
          headers: {
            authorization: 'queries.session.data.token',
          },
        },
      })
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

    it('rejects invalid headers shapes and non-string header values in api actions and submitAction', () => {
      expect(
        validateRuntimeConfig(
          createConfigWithApi({
            searchUsers: {
              method: 'GET',
              endpoint: '/api/users',
              headers: [],
            },
          }),
        ),
      ).toEqual({
        status: 'error',
        error: {
          code: 'invalid-layout',
          displayMode: 'development-only',
          message: 'The api operation "searchUsers.headers" must be an object with non-empty keys.',
        },
      })

      expect(
        validateRuntimeConfig(
          createConfigWithApi({
            searchUsers: {
              method: 'GET',
              endpoint: '/api/users',
              headers: {
                authorization: true,
              },
            },
          }),
        ),
      ).toEqual({
        status: 'error',
        error: {
          code: 'invalid-layout',
          displayMode: 'development-only',
          message: 'The api operation "searchUsers.headers.authorization" must resolve to a string.',
        },
      })

      expect(
        validateRuntimeConfig(
          createConfigWithExecuteOperationButtonAction({
            headers: {
              authorization: 123,
            },
          }),
        ),
      ).toEqual({
        status: 'error',
        error: {
          code: 'invalid-layout',
          displayMode: 'development-only',
          message: 'Page "home" has an invalid layout at "layout[0].props.action.headers.authorization".',
        },
      })

      expect(
        validateRuntimeConfig(
          createConfigWithFormLayout({
            submitAction: {
              type: 'executeOperation',
              operationName: 'submitUserForm',
              headers: {
                authorization: false,
              },
            },
          }),
        ),
      ).toEqual({
        status: 'error',
        error: {
          code: 'invalid-layout',
          displayMode: 'development-only',
          message: 'Page "home" has an invalid layout at "layout[0].submitAction.headers.authorization".',
        },
      })
    })

    it('rejects empty keys and unsupported values in action and submit query and headers', () => {
      expect(
        validateRuntimeConfig(
          createConfigWithExecuteOperationButtonAction({
            query: {
              '': 'Ada',
            },
          }),
        ),
      ).toEqual({
        status: 'error',
        error: {
          code: 'invalid-layout',
          displayMode: 'development-only',
          message: 'Page "home" has an invalid layout at "layout[0].props.action.query": contains an empty key.',
        },
      })

      expect(
        validateRuntimeConfig(
          createConfigWithExecuteOperationButtonAction({
            query: {
              filters: {
                active: true,
              },
            },
          }),
        ),
      ).toEqual({
        status: 'error',
        error: {
          code: 'invalid-layout',
          displayMode: 'development-only',
          message: 'Page "home" has an invalid layout at "layout[0].props.action.query.filters".',
        },
      })

      expect(
        validateRuntimeConfig(
          createConfigWithFormLayout({
            submitAction: {
              type: 'executeOperation',
              operationName: 'submitUserForm',
              headers: {
                '': 'token',
              },
            },
          }),
        ),
      ).toEqual({
        status: 'error',
        error: {
          code: 'invalid-layout',
          displayMode: 'development-only',
          message: 'Page "home" has an invalid layout at "layout[0].submitAction.headers": contains an empty key.',
        },
      })
    })

    it('rejects body in GET operations both in api and in execution-level overrides', () => {
      expect(
        validateRuntimeConfig(
          createConfigWithExecuteOperationButtonAction({
            body: {
              search: 'Ada',
            },
          }),
        ),
      ).toEqual({
        status: 'error',
        error: {
          code: 'invalid-layout',
          displayMode: 'development-only',
          message: 'Page "home" has an invalid layout at "layout[0].props.action.body": GET operations do not support body.',
        },
      })

      expect(
        validateRuntimeConfig(
          createConfigWithFormLayout({
            submitAction: {
              type: 'executeOperation',
              operationName: 'submitUserForm',
              body: {
                draft: true,
              },
            },
          }, {
            api: {
              submitUserForm: {
                method: 'GET',
                endpoint: '/api/forms',
              },
            },
          }),
        ),
      ).toEqual({
        status: 'error',
        error: {
          code: 'invalid-layout',
          displayMode: 'development-only',
          message: 'Page "home" has an invalid layout at "layout[0].submitAction.body": GET operations do not support body.',
        },
      })
    })

    it('drops unsupported extra keys from api headers and executeOperation request params without changing existing valid configs', () => {
      const result = validateRuntimeConfig(
        createConfigWithExecuteOperationButtonAction(
          {
            query: {
              search: 'Ada',
            },
            headers: {
              accept: 'application/json',
            },
            ignored: 'nope',
          },
          {
            api: {
              searchUsers: {
                method: 'GET',
                endpoint: '/api/users',
                headers: {
                  accept: 'application/json',
                },
                ignored: true,
              },
            },
          },
        ),
      )

      expect(result.status).toBe('ready')

      if (result.status !== 'ready') {
        throw new Error('Expected ready result')
      }

      expect(result.config.api.searchUsers).toEqual({
        method: 'GET',
        endpoint: '/api/users',
        headers: {
          accept: 'application/json',
        },
      })

      expect(result.config.pages[0].layout[0]).toEqual({
        type: 'button',
        props: {
          label: 'Load users',
          action: {
            type: 'executeOperation',
            operationName: 'searchUsers',
            query: {
              search: 'Ada',
            },
            headers: {
              accept: 'application/json',
            },
          },
        },
      })
    })

    it('accepts a config with both executeOperation and executeOperations buttons and valid request params', () => {
      const result = validateRuntimeConfig({
        api: {
          searchUsers: { method: 'GET', endpoint: '/api/users' },
          deleteItem: { method: 'DELETE', endpoint: '/api/items/1' },
          reloadList: { method: 'GET', endpoint: '/api/items' },
        },
        pages: [
          {
            id: 'home',
            layout: [
              {
                type: 'button',
                props: {
                  label: 'Search',
                  action: {
                    type: 'executeOperation',
                    operationName: 'searchUsers',
                    query: { search: 'Ada' },
                  },
                },
              },
              {
                type: 'button',
                props: {
                  label: 'Delete and reload',
                  action: {
                    type: 'executeOperations',
                    operations: [
                      { operationName: 'deleteItem', headers: { 'x-custom': 'value' } },
                      { operationName: 'reloadList', query: { page: 1 } },
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

      if (result.status !== 'ready') {
        throw new Error('Expected ready result')
      }

      const executeOpsAction = (result.config.pages[0].layout[1] as { props: { action: Record<string, unknown> } }).props.action as {
        type: string
        operations: Array<{ operationName: string; query?: Record<string, unknown>; headers?: Record<string, unknown> }>
      }
      expect(executeOpsAction.type).toBe('executeOperations')
      expect(executeOpsAction.operations).toHaveLength(2)
      expect(executeOpsAction.operations[0]).toEqual({ operationName: 'deleteItem', headers: { 'x-custom': 'value' } })
      expect(executeOpsAction.operations[1]).toEqual({ operationName: 'reloadList', query: { page: 1 } })
    })

    it('rejects executeOperations when an entry has invalid query/headers/body producing paths with operations[N]', () => {
      expect(
        validateRuntimeConfig({
          api: { myOp: { method: 'GET', endpoint: '/api/items' } },
          pages: [
            {
              id: 'home',
              layout: [
                {
                  type: 'button',
                  props: {
                    label: 'Broken',
                    action: {
                      type: 'executeOperations',
                      operations: [
                        { operationName: 'myOp' },
                        { operationName: 'myOp', query: { filters: { active: true } } },
                      ],
                    },
                  },
                },
              ],
            },
          ],
          initialPage: 'home',
        }),
      ).toMatchObject({
        status: 'error',
        error: {
          code: 'invalid-layout',
          message: expect.stringContaining('props.action.operations[1].query'),
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

    describe('errorCondition, errorMessagePath and errorCodePath validation', () => {
      it('accepts an operation without errorCondition, errorMessagePath or errorCodePath (regression)', () => {
        const result = validateRuntimeConfig(
          createConfigWithApi({
            getUser: {
              method: 'GET',
              endpoint: '/api/user',
            },
          }),
        )

        expect(result.status).toBe('ready')
      })

      it('accepts errorCondition with only path (truthiness mode)', () => {
        const result = validateRuntimeConfig(
          createConfigWithApi({
            getUser: {
              method: 'GET',
              endpoint: '/api/user',
              errorCondition: { path: 'code' },
            },
          }),
        )

        expect(result.status).toBe('ready')
      })

      it('accepts errorCondition with path and equals and propagates to normalized operation', () => {
        const result = validateRuntimeConfig(
          createConfigWithApi({
            getUser: {
              method: 'GET',
              endpoint: '/api/user',
              errorCondition: { path: 'code', equals: 200 },
            },
          }),
        )

        expect(result.status).toBe('ready')

        if (result.status !== 'ready') {
          throw new Error('Expected ready result')
        }

        expect(result.config.api.getUser).toMatchObject({
          errorCondition: { path: 'code', equals: 200 },
        })
      })

      it('accepts errorCondition with path and notEquals and propagates to normalized operation', () => {
        const result = validateRuntimeConfig(
          createConfigWithApi({
            getUser: {
              method: 'GET',
              endpoint: '/api/user',
              errorCondition: { path: 'code', notEquals: 200 },
            },
          }),
        )

        expect(result.status).toBe('ready')

        if (result.status !== 'ready') {
          throw new Error('Expected ready result')
        }

        expect(result.config.api.getUser).toMatchObject({
          errorCondition: { path: 'code', notEquals: 200 },
        })
      })

      it('accepts errorCondition with all four scalar equals types', () => {
        expect(
          validateRuntimeConfig(
            createConfigWithApi({
              a: { method: 'GET', endpoint: '/api/a', errorCondition: { path: 'ok', equals: true } },
            }),
          ).status,
        ).toBe('ready')

        expect(
          validateRuntimeConfig(
            createConfigWithApi({
              b: { method: 'GET', endpoint: '/api/b', errorCondition: { path: 'ok', equals: false } },
            }),
          ).status,
        ).toBe('ready')

        expect(
          validateRuntimeConfig(
            createConfigWithApi({
              c: { method: 'GET', endpoint: '/api/c', errorCondition: { path: 'ok', equals: null } },
            }),
          ).status,
        ).toBe('ready')

        expect(
          validateRuntimeConfig(
            createConfigWithApi({
              d: { method: 'GET', endpoint: '/api/d', errorCondition: { path: 'msg', equals: 'FATAL' } },
            }),
          ).status,
        ).toBe('ready')
      })

      it('rejects errorCondition when both equals and notEquals are declared', () => {
        expect(
          validateRuntimeConfig(
            createConfigWithApi({
              getUser: {
                method: 'GET',
                endpoint: '/api/user',
                errorCondition: { path: 'code', equals: 200, notEquals: 500 },
              },
            }),
          ),
        ).toEqual({
          status: 'error',
          error: {
            code: 'invalid-layout',
            displayMode: 'development-only',
            message: 'The api operation "getUser.errorCondition" cannot declare both "equals" and "notEquals".',
          },
        })
      })

      it('rejects errorCondition with missing path', () => {
        expect(
          validateRuntimeConfig(
            createConfigWithApi({
              getUser: {
                method: 'GET',
                endpoint: '/api/user',
                errorCondition: {},
              },
            }),
          ),
        ).toEqual({
          status: 'error',
          error: {
            code: 'invalid-layout',
            displayMode: 'development-only',
            message: 'The api operation "getUser.errorCondition.path" must be a non-empty string.',
          },
        })
      })

      it('rejects errorCondition with empty path', () => {
        expect(
          validateRuntimeConfig(
            createConfigWithApi({
              getUser: {
                method: 'GET',
                endpoint: '/api/user',
                errorCondition: { path: '' },
              },
            }),
          ),
        ).toEqual({
          status: 'error',
          error: {
            code: 'invalid-layout',
            displayMode: 'development-only',
            message: 'The api operation "getUser.errorCondition.path" must be a non-empty string.',
          },
        })
      })

      it('rejects errorCondition with invalid equals type (object)', () => {
        expect(
          validateRuntimeConfig(
            createConfigWithApi({
              getUser: {
                method: 'GET',
                endpoint: '/api/user',
                errorCondition: { path: 'code', equals: { nested: true } },
              },
            }),
          ),
        ).toEqual({
          status: 'error',
          error: {
            code: 'invalid-layout',
            displayMode: 'development-only',
            message: 'The api operation "getUser.errorCondition.equals" must be a string, number, boolean or null.',
          },
        })
      })

      it('rejects errorCondition with invalid notEquals type (array)', () => {
        expect(
          validateRuntimeConfig(
            createConfigWithApi({
              getUser: {
                method: 'GET',
                endpoint: '/api/user',
                errorCondition: { path: 'code', notEquals: [1, 2] },
              },
            }),
          ),
        ).toEqual({
          status: 'error',
          error: {
            code: 'invalid-layout',
            displayMode: 'development-only',
            message: 'The api operation "getUser.errorCondition.notEquals" must be a string, number, boolean or null.',
          },
        })
      })

      it('rejects errorCondition declared as non-object (string, array, null)', () => {
        expect(
          validateRuntimeConfig(
            createConfigWithApi({
              getUser: {
                method: 'GET',
                endpoint: '/api/user',
                errorCondition: 'not-an-object',
              },
            }),
          ),
        ).toMatchObject({
          status: 'error',
          error: {
            code: 'invalid-layout',
            message: expect.stringContaining('errorCondition'),
          },
        })

        expect(
          validateRuntimeConfig(
            createConfigWithApi({
              getUser: {
                method: 'GET',
                endpoint: '/api/user',
                errorCondition: ['path', 'code'],
              },
            }),
          ),
        ).toMatchObject({
          status: 'error',
          error: {
            code: 'invalid-layout',
            message: expect.stringContaining('errorCondition'),
          },
        })

        expect(
          validateRuntimeConfig(
            createConfigWithApi({
              getUser: {
                method: 'GET',
                endpoint: '/api/user',
                errorCondition: null,
              },
            }),
          ),
        ).toMatchObject({
          status: 'error',
          error: {
            code: 'invalid-layout',
            message: expect.stringContaining('errorCondition'),
          },
        })
      })

      it('accepts both errorMessagePath and errorCodePath as valid non-empty strings and propagates them', () => {
        const result = validateRuntimeConfig(
          createConfigWithApi({
            getUser: {
              method: 'GET',
              endpoint: '/api/user',
              errorCondition: { path: 'code', notEquals: 200 },
              errorMessagePath: 'message',
              errorCodePath: 'code',
            },
          }),
        )

        expect(result.status).toBe('ready')

        if (result.status !== 'ready') {
          throw new Error('Expected ready result')
        }

        expect(result.config.api.getUser).toMatchObject({
          errorCondition: { path: 'code', notEquals: 200 },
          errorMessagePath: 'message',
          errorCodePath: 'code',
        })
      })

      it('rejects errorMessagePath as empty string', () => {
        expect(
          validateRuntimeConfig(
            createConfigWithApi({
              getUser: {
                method: 'GET',
                endpoint: '/api/user',
                errorMessagePath: '',
              },
            }),
          ),
        ).toEqual({
          status: 'error',
          error: {
            code: 'invalid-layout',
            displayMode: 'development-only',
            message: 'The api operation "getUser.errorMessagePath" must be a non-empty string.',
          },
        })
      })

      it('rejects errorCodePath as empty string', () => {
        expect(
          validateRuntimeConfig(
            createConfigWithApi({
              getUser: {
                method: 'GET',
                endpoint: '/api/user',
                errorCodePath: '',
              },
            }),
          ),
        ).toEqual({
          status: 'error',
          error: {
            code: 'invalid-layout',
            displayMode: 'development-only',
            message: 'The api operation "getUser.errorCodePath" must be a non-empty string.',
          },
        })
      })

      it('rejects errorMessagePath as non-string (number)', () => {
        expect(
          validateRuntimeConfig(
            createConfigWithApi({
              getUser: {
                method: 'GET',
                endpoint: '/api/user',
                errorMessagePath: 123,
              },
            }),
          ),
        ).toEqual({
          status: 'error',
          error: {
            code: 'invalid-layout',
            displayMode: 'development-only',
            message: 'The api operation "getUser.errorMessagePath" must be a non-empty string.',
          },
        })
      })

      it('rejects errorCodePath as non-string (object)', () => {
        expect(
          validateRuntimeConfig(
            createConfigWithApi({
              getUser: {
                method: 'GET',
                endpoint: '/api/user',
                errorCodePath: { nested: true },
              },
            }),
          ),
        ).toEqual({
          status: 'error',
          error: {
            code: 'invalid-layout',
            displayMode: 'development-only',
            message: 'The api operation "getUser.errorCodePath" must be a non-empty string.',
          },
        })
      })

      it('accepts errorMessagePath and errorCodePath without errorCondition', () => {
        const result = validateRuntimeConfig(
          createConfigWithApi({
            getUser: {
              method: 'GET',
              endpoint: '/api/user',
              errorMessagePath: 'message',
              errorCodePath: 'code',
            },
          }),
        )

        expect(result.status).toBe('ready')
      })

      it('discards extra keys inside errorCondition silently', () => {
        const result = validateRuntimeConfig(
          createConfigWithApi({
            getUser: {
              method: 'GET',
              endpoint: '/api/user',
              errorCondition: { path: 'code', equals: 200, extraKey: 'ignored' },
            },
          }),
        )

        expect(result.status).toBe('ready')

        if (result.status !== 'ready') {
          throw new Error('Expected ready result')
        }

        expect(result.config.api.getUser).toEqual({
          method: 'GET',
          endpoint: '/api/user',
          errorCondition: { path: 'code', equals: 200 },
        })
      })
    })

    describe('reserved prefix __fileManager__', () => {
      it('rejects an operation whose name starts with __fileManager__: (full slot form)', () => {
        expect(
          validateRuntimeConfig(
            createConfigWithApi({
              '__fileManager__:foo:upload': {
                method: 'POST',
                endpoint: '/x',
              },
            }),
          ),
        ).toEqual({
          status: 'error',
          error: {
            code: 'invalid-layout',
            displayMode: 'development-only',
            message: 'The api operation "__fileManager__:foo:upload" uses the reserved prefix "__fileManager__:".',
          },
        })
      })

      it('rejects an operation whose name starts with __fileManager__: (short form without op suffix)', () => {
        expect(
          validateRuntimeConfig(
            createConfigWithApi({
              '__fileManager__:bar': {
                method: 'GET',
                endpoint: '/x',
              },
            }),
          ),
        ).toEqual({
          status: 'error',
          error: {
            code: 'invalid-layout',
            displayMode: 'development-only',
            message: 'The api operation "__fileManager__:bar" uses the reserved prefix "__fileManager__:".',
          },
        })
      })

      it('accepts an operation whose name starts with fileManager__ (no leading underscores before word)', () => {
        expect(
          validateRuntimeConfig(
            createConfigWithApi({
              'fileManager__foo': {
                method: 'GET',
                endpoint: '/api/files',
              },
            }),
          ).status,
        ).toBe('ready')
      })

      it('accepts an ordinary operation that has nothing to do with the reserved prefix', () => {
        expect(
          validateRuntimeConfig(
            createConfigWithApi({
              uploadDocuments: {
                method: 'POST',
                endpoint: '/api/docs',
              },
            }),
          ).status,
        ).toBe('ready')
      })
    })
  })
})
