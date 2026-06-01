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
