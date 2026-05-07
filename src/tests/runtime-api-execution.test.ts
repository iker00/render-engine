import { describe, expect, it, vi } from 'vitest'
import type { RuntimeConfig } from '../config/runtime-config'
import {
  buildRuntimeApiRequest,
  executeRuntimeApiOperation,
} from '../queries/runtime-api-executor'
import type { RuntimeState } from '../runtime/runtime-state/runtime-state-types'

const runtimeState: RuntimeState = {
  navigation: {
    currentPageId: 'home',
    history: [{ entryId: 0, pageId: 'home', params: {} }],
    lastError: null,
  },
  forms: {
    userSearch: {
      term: {
        value: 'Ada',
        error: null,
        touched: true,
        dirty: true,
        defaultValue: '',
      },
      page: {
        value: 2,
        error: null,
        touched: true,
        dirty: true,
        defaultValue: 1,
      },
      active: {
        value: true,
        error: null,
        touched: true,
        dirty: true,
        defaultValue: false,
      },
      nullable: {
        value: null,
        error: null,
        touched: true,
        dirty: false,
        defaultValue: null,
      },
      callback: {
        value: () => 'not-json',
        error: null,
        touched: true,
        dirty: true,
        defaultValue: null,
      },
    },
  },
  queries: {
    selectedUser: {
      status: 'success',
      data: {
        id: 'user-1',
        profile: {
          nickname: 'Countess',
        },
        tags: ['math', 'logic'],
      },
      error: null,
    },
  },
  pageEntry: {
    entryId: 0,
    pageId: 'home',
    params: {},
    preloadNames: [],
    status: 'idle',
  },
}

const runtimeConfig: RuntimeConfig = {
  api: {
    searchUsers: {
      method: 'GET',
      endpoint: '/api/users',
      query: {
        search: 'forms.userSearch.term',
        page: 'forms.userSearch.page',
        active: 'forms.userSearch.active',
      },
    },
    createUser: {
      method: 'POST',
      endpoint: '/api/users',
      body: {
        name: 'forms.userSearch.term',
        profile: {
          nickname: 'queries.selectedUser.data.profile.nickname',
        },
      },
    },
    replaceUser: {
      method: 'PUT',
      endpoint: '/api/users/user-1',
      body: {
        name: 'Ada Lovelace',
      },
    },
    patchUser: {
      method: 'PATCH',
      endpoint: '/api/users/user-1',
      body: {
        active: 'forms.userSearch.active',
      },
    },
    deleteUser: {
      method: 'DELETE',
      endpoint: '/api/users/user-1',
      query: {
        hard: false,
      },
    },
    clearUser: {
      method: 'PATCH',
      endpoint: '/api/users/user-1',
      body: null,
    },
    escapedQuery: {
      method: 'GET',
      endpoint: '/api/literals',
      query: {
        literal: '\\forms.userSearch.term',
      },
    },
    mixedBody: {
      method: 'POST',
      endpoint: '/api/mixed',
      body: {
        literal: 'plain text',
        escaped: '\\queries.selectedUser.data.profile.nickname',
        derivedId: 'queries.selectedUser.data.id',
        tags: 'queries.selectedUser.data.tags',
      },
    },
    missingQueryValue: {
      method: 'GET',
      endpoint: '/api/users',
      query: {
        search: 'forms.userSearch.missingField',
      },
    },
    invalidQueryValue: {
      method: 'GET',
      endpoint: '/api/users',
      query: {
        search: 'forms.userSearch.nullable',
      },
    },
    invalidBodyReference: {
      method: 'POST',
      endpoint: '/api/users',
      body: {
        callback: 'forms.userSearch.callback',
      },
    },
  },
  initialPage: 'home',
  pages: [
    {
      id: 'home',
      layout: [],
    },
  ],
}

describe('Runtime api execution', () => {
  it('builds a GET request with flat query string values and no body', () => {
    const result = buildRuntimeApiRequest({
      config: runtimeConfig,
      operationName: 'searchUsers',
      state: runtimeState,
    })

    expect(result).toEqual({
      status: 'ready',
      request: {
        operationName: 'searchUsers',
        operation: runtimeConfig.api.searchUsers,
        url: '/api/users?search=Ada&page=2&active=true',
        init: {
          method: 'GET',
        },
      },
    })
  })

  it('builds POST, PUT, PATCH and DELETE requests with the supported payload channel', () => {
    expect(
      buildRuntimeApiRequest({
        config: runtimeConfig,
        operationName: 'createUser',
        state: runtimeState,
      }),
    ).toEqual({
      status: 'ready',
      request: {
        operationName: 'createUser',
        operation: runtimeConfig.api.createUser,
        url: '/api/users',
        init: {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            name: 'Ada',
            profile: {
              nickname: 'Countess',
            },
          }),
        },
      },
    })

    expect(
      buildRuntimeApiRequest({
        config: runtimeConfig,
        operationName: 'replaceUser',
        state: runtimeState,
      }),
    ).toEqual({
      status: 'ready',
      request: {
        operationName: 'replaceUser',
        operation: runtimeConfig.api.replaceUser,
        url: '/api/users/user-1',
        init: {
          method: 'PUT',
          headers: {
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            name: 'Ada Lovelace',
          }),
        },
      },
    })

    expect(
      buildRuntimeApiRequest({
        config: runtimeConfig,
        operationName: 'patchUser',
        state: runtimeState,
      }),
    ).toEqual({
      status: 'ready',
      request: {
        operationName: 'patchUser',
        operation: runtimeConfig.api.patchUser,
        url: '/api/users/user-1',
        init: {
          method: 'PATCH',
          headers: {
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            active: true,
          }),
        },
      },
    })

    expect(
      buildRuntimeApiRequest({
        config: runtimeConfig,
        operationName: 'deleteUser',
        state: runtimeState,
      }),
    ).toEqual({
      status: 'ready',
      request: {
        operationName: 'deleteUser',
        operation: runtimeConfig.api.deleteUser,
        url: '/api/users/user-1?hard=false',
        init: {
          method: 'DELETE',
        },
      },
    })
  })

  it('treats body null as an explicit request without serialized json body', () => {
    const result = buildRuntimeApiRequest({
      config: runtimeConfig,
      operationName: 'clearUser',
      state: runtimeState,
    })

    expect(result).toEqual({
      status: 'ready',
      request: {
        operationName: 'clearUser',
        operation: runtimeConfig.api.clearUser,
        url: '/api/users/user-1',
        init: {
          method: 'PATCH',
        },
      },
    })
  })

  it('resolves params references in query, body, and headers from the active navigation entry', () => {
    const stateWithParams: RuntimeState = {
      ...runtimeState,
      navigation: {
        currentPageId: 'details',
        history: [
          { entryId: 0, pageId: 'home', params: {} },
          { entryId: 1, pageId: 'details', params: { userId: 'user-7', mode: 'edit' } },
        ],
        lastError: null,
      },
      pageEntry: {
        entryId: 1,
        pageId: 'details',
        params: { userId: 'user-7', mode: 'edit' },
        preloadNames: [],
        status: 'idle',
      },
    }
    const configWithParams: RuntimeConfig = {
      ...runtimeConfig,
      api: {
        ...runtimeConfig.api,
        loadEditor: {
          method: 'POST',
          endpoint: '/api/editor',
          query: {
            id: 'params.userId',
          },
          headers: {
            'x-mode': 'params.mode',
          },
          body: {
            userId: 'params.userId',
          },
        },
      },
    }

    expect(
      buildRuntimeApiRequest({
        config: configWithParams,
        operationName: 'loadEditor',
        state: stateWithParams,
      }),
    ).toEqual({
      status: 'ready',
      request: {
        operationName: 'loadEditor',
        operation: configWithParams.api.loadEditor,
        url: '/api/editor?id=user-7',
        init: {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-mode': 'edit',
          },
          body: JSON.stringify({
            userId: 'user-7',
          }),
        },
      },
    })
  })

  it('keeps literal strings, escaped references and supported references distinct in query and body payloads', () => {
    expect(
      buildRuntimeApiRequest({
        config: runtimeConfig,
        operationName: 'escapedQuery',
        state: runtimeState,
      }),
    ).toEqual({
      status: 'ready',
      request: {
        operationName: 'escapedQuery',
        operation: runtimeConfig.api.escapedQuery,
        url: '/api/literals?literal=forms.userSearch.term',
        init: {
          method: 'GET',
        },
      },
    })

    expect(
      buildRuntimeApiRequest({
        config: runtimeConfig,
        operationName: 'mixedBody',
        state: runtimeState,
      }),
    ).toEqual({
      status: 'ready',
      request: {
        operationName: 'mixedBody',
        operation: runtimeConfig.api.mixedBody,
        url: '/api/mixed',
        init: {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            literal: 'plain text',
            escaped: 'queries.selectedUser.data.profile.nickname',
            derivedId: 'user-1',
            tags: ['math', 'logic'],
          }),
        },
      },
    })
  })

  it('rejects missing or unsupported final query values before emitting a request', () => {
    expect(
      buildRuntimeApiRequest({
        config: runtimeConfig,
        operationName: 'missingQueryValue',
        state: runtimeState,
      }),
    ).toEqual({
      status: 'error',
      error: {
        code: 'request-build-failed',
        message:
          'The api operation "missingQueryValue" could not resolve "forms.userSearch.missingField" for "query.search".',
      },
    })

    expect(
      buildRuntimeApiRequest({
        config: runtimeConfig,
        operationName: 'invalidQueryValue',
        state: runtimeState,
      }),
    ).toEqual({
      status: 'error',
      error: {
        code: 'request-build-failed',
        message:
          'The api operation "invalidQueryValue" resolved "query.search" to an unsupported query value.',
      },
    })
  })

  it('rejects resolved body references that do not produce valid json data', () => {
    expect(
      buildRuntimeApiRequest({
        config: runtimeConfig,
        operationName: 'invalidBodyReference',
        state: runtimeState,
      }),
    ).toEqual({
      status: 'error',
      error: {
        code: 'request-build-failed',
        message: 'The api operation "invalidBodyReference" could not build its JSON body.',
      },
    })
  })

  it('merges requestParams with the base api operation across query headers and body', () => {
    const result = buildRuntimeApiRequest({
      config: {
        ...runtimeConfig,
        api: {
          mergeRequest: {
            method: 'POST',
            endpoint: '/api/users/search',
            query: {
              page: 1,
              search: 'forms.userSearch.term',
            },
            headers: {
              accept: 'application/json',
              authorization: 'base-token',
            },
            body: {
              page: 1,
              filters: {
                active: false,
              },
            },
          },
        },
      },
      operationName: 'mergeRequest',
      state: runtimeState,
      requestParams: {
        query: {
          page: 'forms.userSearch.page',
          active: 'forms.userSearch.active',
        },
        headers: {
          authorization: 'override-token',
          'x-trace-id': 'queries.selectedUser.data.id',
        },
        body: {
          filters: {
            active: 'forms.userSearch.active',
          },
          profile: {
            nickname: 'queries.selectedUser.data.profile.nickname',
          },
        },
      },
    })

    expect(result).toEqual({
      status: 'ready',
      request: {
        operationName: 'mergeRequest',
        operation: {
          method: 'POST',
          endpoint: '/api/users/search',
          query: {
            page: 1,
            search: 'forms.userSearch.term',
          },
          headers: {
            accept: 'application/json',
            authorization: 'base-token',
          },
          body: {
            page: 1,
            filters: {
              active: false,
            },
          },
        },
        url: '/api/users/search?page=2&search=Ada&active=true',
        init: {
          method: 'POST',
          headers: {
            accept: 'application/json',
            authorization: 'override-token',
            'x-trace-id': 'user-1',
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            page: 1,
            filters: {
              active: true,
            },
            profile: {
              nickname: 'Countess',
            },
          }),
        },
      },
    })
  })

  it('replaces the whole body when either layer uses a non-object root value', () => {
    expect(
      buildRuntimeApiRequest({
        config: {
          ...runtimeConfig,
          api: {
            replaceBody: {
              method: 'POST',
              endpoint: '/api/replace',
              body: {
                name: 'Ada',
              },
            },
          },
        },
        operationName: 'replaceBody',
        state: runtimeState,
        requestParams: {
          body: 'queries.selectedUser.data.id',
        },
      }),
    ).toEqual({
      status: 'ready',
      request: {
        operationName: 'replaceBody',
        operation: {
          method: 'POST',
          endpoint: '/api/replace',
          body: {
            name: 'Ada',
          },
        },
        url: '/api/replace',
        init: {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
          },
          body: JSON.stringify('user-1'),
        },
      },
    })

    expect(
      buildRuntimeApiRequest({
        config: {
          ...runtimeConfig,
          api: {
            replaceBody: {
              method: 'POST',
              endpoint: '/api/replace',
              body: 'queries.selectedUser.data.id',
            },
          },
        },
        operationName: 'replaceBody',
        state: runtimeState,
        requestParams: {
          body: {
            active: 'forms.userSearch.active',
          },
        },
      }),
    ).toEqual({
      status: 'ready',
      request: {
        operationName: 'replaceBody',
        operation: {
          method: 'POST',
          endpoint: '/api/replace',
          body: 'queries.selectedUser.data.id',
        },
        url: '/api/replace',
        init: {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            active: true,
          }),
        },
      },
    })
  })

  it('only injects content-type when needed and preserves explicit casing from base or override headers', () => {
    expect(
      buildRuntimeApiRequest({
        config: {
          ...runtimeConfig,
          api: {
            explicitBaseContentType: {
              method: 'POST',
              endpoint: '/api/users',
              headers: {
                'Content-Type': 'application/merge-patch+json',
              },
              body: {
                active: true,
              },
            },
          },
        },
        operationName: 'explicitBaseContentType',
        state: runtimeState,
      }),
    ).toEqual({
      status: 'ready',
      request: {
        operationName: 'explicitBaseContentType',
        operation: {
          method: 'POST',
          endpoint: '/api/users',
          headers: {
            'Content-Type': 'application/merge-patch+json',
          },
          body: {
            active: true,
          },
        },
        url: '/api/users',
        init: {
          method: 'POST',
          headers: {
            'Content-Type': 'application/merge-patch+json',
          },
          body: JSON.stringify({
            active: true,
          }),
        },
      },
    })

    expect(
      buildRuntimeApiRequest({
        config: {
          ...runtimeConfig,
          api: {
            explicitOverrideContentType: {
              method: 'POST',
              endpoint: '/api/users',
              body: {
                active: true,
              },
            },
          },
        },
        operationName: 'explicitOverrideContentType',
        state: runtimeState,
        requestParams: {
          headers: {
            'content-type': 'application/vnd.api+json',
          },
        },
      }),
    ).toEqual({
      status: 'ready',
      request: {
        operationName: 'explicitOverrideContentType',
        operation: {
          method: 'POST',
          endpoint: '/api/users',
          body: {
            active: true,
          },
        },
        url: '/api/users',
        init: {
          method: 'POST',
          headers: {
            'content-type': 'application/vnd.api+json',
          },
          body: JSON.stringify({
            active: true,
          }),
        },
      },
    })
  })

  it('fails request building for unresolved or non-string effective headers before any network call', async () => {
    expect(
      buildRuntimeApiRequest({
        config: {
          ...runtimeConfig,
          api: {
            invalidHeaderReference: {
              method: 'GET',
              endpoint: '/api/users',
            },
          },
        },
        operationName: 'invalidHeaderReference',
        state: runtimeState,
        requestParams: {
          headers: {
            authorization: 'forms.userSearch.missingField',
          },
        },
      }),
    ).toEqual({
      status: 'error',
      error: {
        code: 'request-build-failed',
        message:
          'The api operation "invalidHeaderReference" could not resolve "forms.userSearch.missingField" for "headers.authorization".',
      },
    })

    expect(
      buildRuntimeApiRequest({
        config: {
          ...runtimeConfig,
          api: {
            invalidHeaderType: {
              method: 'GET',
              endpoint: '/api/users',
            },
          },
        },
        operationName: 'invalidHeaderType',
        state: runtimeState,
        requestParams: {
          headers: {
            authorization: 'forms.userSearch.page',
          },
        },
      }),
    ).toEqual({
      status: 'error',
      error: {
        code: 'request-build-failed',
        message: 'The api operation "invalidHeaderType" resolved "headers.authorization" to an unsupported header value.',
      },
    })

    const fetchMock = vi.fn()

    await expect(
      executeRuntimeApiOperation({
        config: {
          ...runtimeConfig,
          api: {
            invalidHeaderType: {
              method: 'GET',
              endpoint: '/api/users',
            },
          },
        },
        operationName: 'invalidHeaderType',
        state: runtimeState,
        requestParams: {
          headers: {
            authorization: 'forms.userSearch.page',
          },
        },
        fetch: fetchMock,
      }),
    ).resolves.toEqual({
      status: 'error',
      error: {
        code: 'request-build-failed',
        message: 'The api operation "invalidHeaderType" resolved "headers.authorization" to an unsupported header value.',
      },
    })

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('fails fast when the requested operation does not exist', async () => {
    const fetchMock = vi.fn()

    await expect(
      executeRuntimeApiOperation({
        config: runtimeConfig,
        operationName: 'missingOperation',
        state: runtimeState,
        fetch: fetchMock,
      }),
    ).resolves.toEqual({
      status: 'error',
      error: {
        code: 'operation-not-found',
        message: 'The api operation "missingOperation" does not exist.',
      },
    })

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('normalizes fetch failures, http errors and invalid json responses with stable error codes', async () => {
    await expect(
      executeRuntimeApiOperation({
        config: runtimeConfig,
        operationName: 'searchUsers',
        state: runtimeState,
        fetch: vi.fn().mockRejectedValue(new Error('socket hang up')),
      }),
    ).resolves.toEqual({
      status: 'error',
      error: {
        code: 'network-error',
        message: 'The api operation "searchUsers" failed due to a network error.',
      },
    })

    await expect(
      executeRuntimeApiOperation({
        config: runtimeConfig,
        operationName: 'searchUsers',
        state: runtimeState,
        fetch: vi.fn().mockResolvedValue(
          new Response(JSON.stringify({ message: 'Forbidden' }), {
            status: 403,
            headers: {
              'content-type': 'application/json',
            },
          }),
        ),
      }),
    ).resolves.toEqual({
      status: 'error',
      error: {
        code: 'http-error',
        message: 'The api operation "searchUsers" failed with HTTP status 403.',
      },
    })

    await expect(
      executeRuntimeApiOperation({
        config: runtimeConfig,
        operationName: 'searchUsers',
        state: runtimeState,
        fetch: vi.fn().mockResolvedValue(
          new Response('{"broken"', {
            status: 200,
            headers: {
              'content-type': 'application/json',
            },
          }),
        ),
      }),
    ).resolves.toEqual({
      status: 'error',
      error: {
        code: 'invalid-json-response',
        message: 'The api operation "searchUsers" returned invalid JSON.',
      },
    })
  })

  it('returns success with parsed data for valid json and data null for empty successful responses', async () => {
    await expect(
      executeRuntimeApiOperation({
        config: runtimeConfig,
        operationName: 'searchUsers',
        state: runtimeState,
        fetch: vi.fn().mockResolvedValue(
          new Response(JSON.stringify({ results: ['Ada', 'Grace'] }), {
            status: 200,
            headers: {
              'content-type': 'application/json',
            },
          }),
        ),
      }),
    ).resolves.toEqual({
      status: 'success',
      data: {
        results: ['Ada', 'Grace'],
      },
    })

    await expect(
      executeRuntimeApiOperation({
        config: runtimeConfig,
        operationName: 'deleteUser',
        state: runtimeState,
        fetch: vi.fn().mockResolvedValue(
          new Response(null, {
            status: 204,
          }),
        ),
      }),
    ).resolves.toEqual({
      status: 'success',
      data: null,
    })
  })
})
