import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RuntimeConfig } from '../../config/runtime-config'
import {
  buildRuntimeApiRequest,
  buildInlineRuntimeApiRequest,
  executeRuntimeApiOperation,
  executeInlineRuntimeApiOperation,
  executeBuiltRuntimeApiRequest,
} from '../../queries/runtime-api-executor'
import type { RuntimeState } from '../../runtime/runtime-state/runtime-state-types'

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
      scopes: {
        value: ['editor', 'admin'],
        error: null,
        touched: true,
        dirty: true,
        defaultValue: [],
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
    submitScopes: {
      method: 'POST',
      endpoint: '/api/scopes',
      body: {
        scopes: 'forms.userSearch.scopes',
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
        operationName: 'submitScopes',
        state: runtimeState,
      }),
    ).toEqual({
      status: 'ready',
      request: {
        operationName: 'submitScopes',
        operation: runtimeConfig.api.submitScopes,
        url: '/api/scopes',
        init: {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            scopes: ['editor', 'admin'],
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
        currentEntryIndex: 1,
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

  it('keeps partial template strings literal in api query and body while interpolating {{...}} in headers', () => {
    const configWithPartialTemplates: RuntimeConfig = {
      ...runtimeConfig,
      api: {
        ...runtimeConfig.api,
        partialTemplatePayload: {
          method: 'POST',
          endpoint: '/api/templates',
          query: {
            search: 'prefix-{{forms.userSearch.term}}',
          },
          headers: {
            authorization: 'Bearer {{forms.userSearch.term}}',
          },
          body: {
            name: 'prefix-{{forms.userSearch.term}}',
            profile: {
              nickname: 'nick-{{queries.selectedUser.data.profile.nickname}}',
            },
          },
        },
        completeMissingReference: {
          method: 'GET',
          endpoint: '/api/templates',
          query: {
            search: 'forms.userSearch.missingField',
          },
        },
      },
    }

    // query and body: {{...}} strings are treated as literals (no interpolation in those surfaces).
    // headers: {{...}} strings ARE interpolated — "Bearer {{forms.userSearch.term}}" resolves to "Bearer Ada".
    expect(
      buildRuntimeApiRequest({
        config: configWithPartialTemplates,
        operationName: 'partialTemplatePayload',
        state: runtimeState,
      }),
    ).toEqual({
      status: 'ready',
      request: {
        operationName: 'partialTemplatePayload',
        operation: configWithPartialTemplates.api.partialTemplatePayload,
        url: '/api/templates?search=prefix-%7B%7Bforms.userSearch.term%7D%7D',
        init: {
          method: 'POST',
          headers: {
            authorization: 'Bearer Ada',
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            name: 'prefix-{{forms.userSearch.term}}',
            profile: {
              nickname: 'nick-{{queries.selectedUser.data.profile.nickname}}',
            },
          }),
        },
      },
    })

    expect(
      buildRuntimeApiRequest({
        config: configWithPartialTemplates,
        operationName: 'completeMissingReference',
        state: runtimeState,
      }),
    ).toEqual({
      status: 'error',
      error: {
        code: 'request-build-failed',
        message:
          'The api operation "completeMissingReference" could not resolve "forms.userSearch.missingField" for "query.search".',
      },
    })
  })

  it('resolves item references in query, body, and headers when an iteration context is provided', () => {
    const configWithItemContext: RuntimeConfig = {
      ...runtimeConfig,
      api: {
        ...runtimeConfig.api,
        loadPost: {
          method: 'POST',
          endpoint: '/api/posts/load',
          query: {
            slug: 'item.slug',
          },
          headers: {
            authorization: 'item.token',
          },
          body: {
            id: 'item.id',
            mode: 'item.meta.mode',
          },
        },
      },
    }

    expect(
      buildRuntimeApiRequest({
        config: configWithItemContext,
        operationName: 'loadPost',
        state: runtimeState,
        iterationContext: {
          item: {
            id: 'post-1',
            slug: 'hello-world',
            token: 'token-1',
            meta: {
              mode: 'preview',
            },
          },
        },
      }),
    ).toEqual({
      status: 'ready',
      request: {
        operationName: 'loadPost',
        operation: configWithItemContext.api.loadPost,
        url: '/api/posts/load?slug=hello-world',
        init: {
          method: 'POST',
          headers: {
            authorization: 'token-1',
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            id: 'post-1',
            mode: 'preview',
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

  it('produces a stable request signature for functionally equivalent requests regardless of object key order', () => {
    const firstRequest = buildRuntimeApiRequest({
      config: {
        ...runtimeConfig,
        api: {
          mergeRequest: {
            method: 'POST',
            endpoint: '/api/users/search',
            query: {
              search: 'forms.userSearch.term',
              page: 1,
            },
            headers: {
              authorization: 'base-token',
              accept: 'application/json',
            },
            body: {
              filters: {
                active: false,
                role: 'editor',
              },
            },
          },
        },
      },
      operationName: 'mergeRequest',
      state: runtimeState,
      requestParams: {
        query: {
          active: 'forms.userSearch.active',
          page: 'forms.userSearch.page',
        },
        headers: {
          'x-trace-id': 'queries.selectedUser.data.id',
          authorization: 'override-token',
        },
        body: {
          profile: {
            nickname: 'queries.selectedUser.data.profile.nickname',
          },
          filters: {
            active: 'forms.userSearch.active',
          },
        },
      },
    })

    const secondRequest = buildRuntimeApiRequest({
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
              filters: {
                role: 'editor',
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

    expect(firstRequest.status).toBe('ready')
    expect(secondRequest.status).toBe('ready')

    if (firstRequest.status !== 'ready' || secondRequest.status !== 'ready') {
      return
    }

    expect(firstRequest.request.requestSignature).toBe(secondRequest.request.requestSignature)
  })

  it('changes the request signature when only query headers or body change', () => {
    const baseQueryRequest = buildRuntimeApiRequest({
      config: runtimeConfig,
      operationName: 'searchUsers',
      state: runtimeState,
    })

    const queryRequest = buildRuntimeApiRequest({
      config: runtimeConfig,
      operationName: 'searchUsers',
      state: runtimeState,
      requestParams: {
        query: {
          search: 'Grace',
        },
      },
    })

    const headersRequest = buildRuntimeApiRequest({
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
          authorization: 'token-a',
        },
      },
    })

    const changedHeadersRequest = buildRuntimeApiRequest({
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
          authorization: 'token-b',
        },
      },
    })

    const bodyRequest = buildRuntimeApiRequest({
      config: runtimeConfig,
      operationName: 'createUser',
      state: runtimeState,
    })

    const changedBodyRequest = buildRuntimeApiRequest({
      config: runtimeConfig,
      operationName: 'createUser',
      state: {
        ...runtimeState,
        forms: {
          ...runtimeState.forms,
          userSearch: {
            ...runtimeState.forms.userSearch,
            term: {
              ...runtimeState.forms.userSearch.term,
              value: 'Grace',
            },
          },
        },
      },
    })

    expect(queryRequest.status).toBe('ready')
    expect(headersRequest.status).toBe('ready')
    expect(changedHeadersRequest.status).toBe('ready')
    expect(bodyRequest.status).toBe('ready')
    expect(changedBodyRequest.status).toBe('ready')

    if (
      baseQueryRequest.status !== 'ready' ||
      queryRequest.status !== 'ready' ||
      headersRequest.status !== 'ready' ||
      changedHeadersRequest.status !== 'ready' ||
      bodyRequest.status !== 'ready' ||
      changedBodyRequest.status !== 'ready'
    ) {
      return
    }

    expect(queryRequest.request.requestSignature).not.toBe(baseQueryRequest.request.requestSignature)
    expect(headersRequest.request.requestSignature).not.toBe(changedHeadersRequest.request.requestSignature)
    expect(bodyRequest.request.requestSignature).not.toBe(changedBodyRequest.request.requestSignature)
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

  it('normalizes a rejected response.text() to network-error instead of propagating the rejection (executeRuntimeApiOperation)', async () => {
    const failingResponse = {
      ok: true,
      status: 200,
      text: () => Promise.reject(new Error('stream cut off')),
    } as unknown as Response

    await expect(
      executeRuntimeApiOperation({
        config: runtimeConfig,
        operationName: 'searchUsers',
        state: runtimeState,
        fetch: vi.fn().mockResolvedValue(failingResponse),
      }),
    ).resolves.toEqual({
      status: 'error',
      error: {
        code: 'network-error',
        message: 'The api operation "searchUsers" failed due to a network error while reading the response body.',
      },
    })
  })

  it('normalizes a rejected response.text() to network-error instead of propagating the rejection (executeInlineRuntimeApiOperation)', async () => {
    const failingResponse = {
      ok: true,
      status: 200,
      text: () => Promise.reject(new Error('stream cut off')),
    } as unknown as Response

    await expect(
      executeInlineRuntimeApiOperation({
        operation: runtimeConfig.api.searchUsers,
        operationName: 'searchUsers',
        state: runtimeState,
        fetch: vi.fn().mockResolvedValue(failingResponse),
      }),
    ).resolves.toEqual({
      status: 'error',
      error: {
        code: 'network-error',
        message: 'The api operation "searchUsers" failed due to a network error while reading the response body.',
      },
    })
  })

  it('normalizes a rejected response.text() to network-error instead of propagating the rejection (executeBuiltRuntimeApiRequest)', async () => {
    const failingResponse = {
      ok: true,
      status: 200,
      text: () => Promise.reject(new Error('stream cut off')),
    } as unknown as Response

    const requestResult = buildRuntimeApiRequest({
      config: runtimeConfig,
      operationName: 'searchUsers',
      state: runtimeState,
    })

    expect(requestResult.status).toBe('ready')
    if (requestResult.status !== 'ready') return

    await expect(
      executeBuiltRuntimeApiRequest({
        request: requestResult.request,
        fetch: vi.fn().mockResolvedValue(failingResponse),
      }),
    ).resolves.toEqual({
      status: 'error',
      error: {
        code: 'network-error',
        message: 'The api operation "searchUsers" failed due to a network error while reading the response body.',
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

  it('two independent executeRuntimeApiOperation calls resolve to independent results and an error in one does not affect the other', async () => {
    const [errorResult, successResult] = await Promise.all([
      executeRuntimeApiOperation({
        config: runtimeConfig,
        operationName: 'nonExistent',
        state: runtimeState,
        fetch: vi.fn(),
      }),
      executeRuntimeApiOperation({
        config: runtimeConfig,
        operationName: 'searchUsers',
        state: runtimeState,
        fetch: vi.fn().mockResolvedValue(
          new Response(JSON.stringify({ results: [] }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
        ),
      }),
    ])

    expect(errorResult).toEqual({
      status: 'error',
      error: {
        code: 'operation-not-found',
        message: 'The api operation "nonExistent" does not exist.',
      },
    })

    expect(successResult).toEqual({
      status: 'success',
      data: { results: [] },
    })
  })
})

describe('Runtime api endpoint interpolation', () => {
  const stateWithParams: RuntimeState = {
    ...runtimeState,
    navigation: {
      currentPageId: 'details',
      history: [
        { entryId: 0, pageId: 'home', params: {} },
        { entryId: 1, pageId: 'details', params: { itemId: '42' } },
      ],
      currentEntryIndex: 1,
      lastError: null,
    },
    pageEntry: {
      entryId: 1,
      pageId: 'details',
      params: { itemId: '42' },
      preloadNames: [],
      status: 'idle',
    },
  }

  it('leaves a literal endpoint without placeholders unchanged (regression)', () => {
    const result = buildRuntimeApiRequest({
      config: runtimeConfig,
      operationName: 'searchUsers',
      state: runtimeState,
    })

    expect(result).toEqual({
      status: 'ready',
      request: expect.objectContaining({
        url: '/api/users?search=Ada&page=2&active=true',
      }),
    })
  })

  it('interpolates {{params.itemId}} with the current page param value', () => {
    const config: RuntimeConfig = {
      ...runtimeConfig,
      api: {
        getItem: {
          method: 'GET',
          endpoint: '/api/items/{{params.itemId}}/detail',
        },
      },
    }

    const result = buildRuntimeApiRequest({
      config,
      operationName: 'getItem',
      state: stateWithParams,
    })

    expect(result).toEqual({
      status: 'ready',
      request: expect.objectContaining({
        url: '/api/items/42/detail',
      }),
    })
  })

  it('interpolates {{forms.itemForm.id}} from form store value', () => {
    const stateWithForm: RuntimeState = {
      ...runtimeState,
      forms: {
        ...runtimeState.forms,
        itemForm: {
          id: {
            value: 'abc',
            error: null,
            touched: false,
            dirty: false,
            defaultValue: '',
          },
        },
      },
    }

    const config: RuntimeConfig = {
      ...runtimeConfig,
      api: {
        updateItem: {
          method: 'PUT',
          endpoint: '/api/items/{{forms.itemForm.id}}',
        },
      },
    }

    const result = buildRuntimeApiRequest({
      config,
      operationName: 'updateItem',
      state: stateWithForm,
    })

    expect(result).toEqual({
      status: 'ready',
      request: expect.objectContaining({
        url: '/api/items/abc',
      }),
    })
  })

  it('interpolates {{queries.previous.data.id}} with numeric query data value (number → string)', () => {
    const stateWithQuery: RuntimeState = {
      ...runtimeState,
      queries: {
        ...runtimeState.queries,
        previous: {
          status: 'success',
          data: { id: 7 },
          error: null,
        },
      },
    }

    const config: RuntimeConfig = {
      ...runtimeConfig,
      api: {
        loadRelated: {
          method: 'GET',
          endpoint: '/api/items/{{queries.previous.data.id}}/related',
        },
      },
    }

    const result = buildRuntimeApiRequest({
      config,
      operationName: 'loadRelated',
      state: stateWithQuery,
    })

    expect(result).toEqual({
      status: 'ready',
      request: expect.objectContaining({
        url: '/api/items/7/related',
      }),
    })
  })

  it('interpolates {{queries.x.data.enabled}} with boolean false as string "false"', () => {
    const stateWithBool: RuntimeState = {
      ...runtimeState,
      queries: {
        ...runtimeState.queries,
        x: {
          status: 'success',
          data: { enabled: false },
          error: null,
        },
      },
    }

    const config: RuntimeConfig = {
      ...runtimeConfig,
      api: {
        checkFeature: {
          method: 'GET',
          endpoint: '/api/features/{{queries.x.data.enabled}}/check',
        },
      },
    }

    const result = buildRuntimeApiRequest({
      config,
      operationName: 'checkFeature',
      state: stateWithBool,
    })

    expect(result).toEqual({
      status: 'ready',
      request: expect.objectContaining({
        url: '/api/features/false/check',
      }),
    })
  })

  it('interpolates {{item.id}} from iterationContext inside a repeater', () => {
    const config: RuntimeConfig = {
      ...runtimeConfig,
      api: {
        deleteRow: {
          method: 'DELETE',
          endpoint: '/api/rows/{{item.id}}',
        },
      },
    }

    const result = buildRuntimeApiRequest({
      config,
      operationName: 'deleteRow',
      state: runtimeState,
      iterationContext: {
        item: { id: 'row-3' },
        key: '2',
      },
    })

    expect(result).toEqual({
      status: 'ready',
      request: expect.objectContaining({
        url: '/api/rows/row-3',
      }),
    })
  })

  it('returns request-build-failed when {{params.missing}} is not in current page params', () => {
    const config: RuntimeConfig = {
      ...runtimeConfig,
      api: {
        getItem: {
          method: 'GET',
          endpoint: '/api/items/{{params.missing}}/detail',
        },
      },
    }

    const fetchMock = vi.fn()

    const result = buildRuntimeApiRequest({
      config,
      operationName: 'getItem',
      state: runtimeState,
    })

    expect(result).toEqual({
      status: 'error',
      error: {
        code: 'request-build-failed',
        message: expect.stringContaining('params.missing'),
      },
    })

    expect(result).toEqual({
      status: 'error',
      error: {
        code: 'request-build-failed',
        message: expect.stringContaining('endpoint'),
      },
    })

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns request-build-failed when {{forms.foo.bar}} references a non-existent form', () => {
    const config: RuntimeConfig = {
      ...runtimeConfig,
      api: {
        update: {
          method: 'PUT',
          endpoint: '/api/items/{{forms.foo.bar}}',
        },
      },
    }

    const result = buildRuntimeApiRequest({
      config,
      operationName: 'update',
      state: runtimeState,
    })

    expect(result).toEqual({
      status: 'error',
      error: {
        code: 'request-build-failed',
        message: expect.stringContaining('forms.foo.bar'),
      },
    })
  })

  it('returns request-build-failed when {{queries.x.data.user}} resolves to an object', () => {
    const stateWithObj: RuntimeState = {
      ...runtimeState,
      queries: {
        ...runtimeState.queries,
        x: {
          status: 'success',
          data: { user: { name: 'Ada' } },
          error: null,
        },
      },
    }

    const config: RuntimeConfig = {
      ...runtimeConfig,
      api: {
        getUser: {
          method: 'GET',
          endpoint: '/api/users/{{queries.x.data.user}}',
        },
      },
    }

    const result = buildRuntimeApiRequest({
      config,
      operationName: 'getUser',
      state: stateWithObj,
    })

    expect(result).toEqual({
      status: 'error',
      error: {
        code: 'request-build-failed',
        message: expect.stringContaining('endpoint'),
      },
    })
  })

  it('returns request-build-failed when {{item.tags}} resolves to an array', () => {
    const config: RuntimeConfig = {
      ...runtimeConfig,
      api: {
        getTags: {
          method: 'GET',
          endpoint: '/api/{{item.tags}}',
        },
      },
    }

    const result = buildRuntimeApiRequest({
      config,
      operationName: 'getTags',
      state: runtimeState,
      iterationContext: {
        item: { tags: ['a', 'b'] },
        key: '0',
      },
    })

    expect(result).toEqual({
      status: 'error',
      error: {
        code: 'request-build-failed',
        message: expect.stringContaining('endpoint'),
      },
    })
  })

  it('returns request-build-failed when {{item.id}} is used outside a repeater (no iterationContext)', () => {
    const config: RuntimeConfig = {
      ...runtimeConfig,
      api: {
        getRow: {
          method: 'GET',
          endpoint: '/api/rows/{{item.id}}',
        },
      },
    }

    const result = buildRuntimeApiRequest({
      config,
      operationName: 'getRow',
      state: runtimeState,
    })

    expect(result).toEqual({
      status: 'error',
      error: {
        code: 'request-build-failed',
        message: expect.stringContaining('endpoint'),
      },
    })
  })

  it('interpolates two placeholders in order when both are resolvable', () => {
    const stateWithMulti: RuntimeState = {
      ...stateWithParams,
      forms: {
        ...runtimeState.forms,
        itemForm: {
          section: {
            value: 'config',
            error: null,
            touched: false,
            dirty: false,
            defaultValue: '',
          },
        },
      },
    }

    const config: RuntimeConfig = {
      ...runtimeConfig,
      api: {
        getSection: {
          method: 'GET',
          endpoint: '/api/{{forms.itemForm.section}}/{{params.itemId}}',
        },
      },
    }

    const result = buildRuntimeApiRequest({
      config,
      operationName: 'getSection',
      state: stateWithMulti,
    })

    expect(result).toEqual({
      status: 'ready',
      request: expect.objectContaining({
        url: '/api/config/42',
      }),
    })
  })

  it('returns request-build-failed when the first placeholder resolves but the second fails', () => {
    const stateWithForm: RuntimeState = {
      ...runtimeState,
      forms: {
        ...runtimeState.forms,
        itemForm: {
          id: {
            value: 'abc',
            error: null,
            touched: false,
            dirty: false,
            defaultValue: '',
          },
        },
      },
    }

    const config: RuntimeConfig = {
      ...runtimeConfig,
      api: {
        action: {
          method: 'POST',
          endpoint: '/api/items/{{forms.itemForm.id}}/{{params.missing}}',
        },
      },
    }

    const result = buildRuntimeApiRequest({
      config,
      operationName: 'action',
      state: stateWithForm,
    })

    expect(result).toEqual({
      status: 'error',
      error: {
        code: 'request-build-failed',
        message: expect.stringContaining('endpoint'),
      },
    })
  })

  it('trims spaces around reference in placeholder {{ params.itemId }} like {{params.itemId}}', () => {
    const config: RuntimeConfig = {
      ...runtimeConfig,
      api: {
        getItem: {
          method: 'GET',
          endpoint: '/api/items/{{ params.itemId }}/detail',
        },
      },
    }

    const result = buildRuntimeApiRequest({
      config,
      operationName: 'getItem',
      state: stateWithParams,
    })

    expect(result).toEqual({
      status: 'ready',
      request: expect.objectContaining({
        url: '/api/items/42/detail',
      }),
    })
  })

  it('correctly appends query string after endpoint interpolation', () => {
    const config: RuntimeConfig = {
      ...runtimeConfig,
      api: {
        listItems: {
          method: 'GET',
          endpoint: '/api/collections/{{params.itemId}}/items',
          query: {
            page: 1,
          },
        },
      },
    }

    const result = buildRuntimeApiRequest({
      config,
      operationName: 'listItems',
      state: stateWithParams,
    })

    expect(result).toEqual({
      status: 'ready',
      request: expect.objectContaining({
        url: '/api/collections/42/items?page=1',
      }),
    })
  })

  describe('formatters in endpoint interpolation (feature 0101)', () => {
    const stateWithFormatterQueries: RuntimeState = {
      ...runtimeState,
      queries: {
        ...runtimeState.queries,
        userId: {
          status: 'success',
          data: 'abc',
          error: null,
        },
        total: {
          status: 'success',
          data: 1234,
          error: null,
        },
        name: {
          status: 'success',
          data: 'ana',
          error: null,
        },
      },
    }

    let consoleWarnSpy: ReturnType<typeof vi.spyOn>

    beforeEach(() => {
      consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    })

    afterEach(() => {
      consoleWarnSpy.mockRestore()
    })

    it('applies uppercase formatter to a resolved string reference', () => {
      const config: RuntimeConfig = {
        ...runtimeConfig,
        api: {
          getUser: {
            method: 'GET',
            endpoint: '/users/{{queries.userId.data | uppercase}}',
          },
        },
      }

      const result = buildRuntimeApiRequest({
        config,
        operationName: 'getUser',
        state: stateWithFormatterQueries,
      })

      expect(result).toEqual({
        status: 'ready',
        request: expect.objectContaining({
          url: '/users/ABC',
        }),
      })
    })

    it('applies number:0 formatter to a numeric reference (es-ES thousand separator)', () => {
      const config: RuntimeConfig = {
        ...runtimeConfig,
        api: {
          getByTotal: {
            method: 'GET',
            endpoint: '/n/{{queries.total.data | number:0}}',
          },
        },
      }

      const result = buildRuntimeApiRequest({
        config,
        operationName: 'getByTotal',
        state: stateWithFormatterQueries,
      })

      expect(result).toEqual({
        status: 'ready',
        request: expect.objectContaining({
          url: '/n/1.234',
        }),
      })
    })

    it('returns request-build-failed when the formatter name is not in the catalog', () => {
      const config: RuntimeConfig = {
        ...runtimeConfig,
        api: {
          brokenChain: {
            method: 'GET',
            endpoint: '/x/{{queries.total.data | doesNotExist}}',
          },
        },
      }

      const fetchMock = vi.fn()

      const result = buildRuntimeApiRequest({
        config,
        operationName: 'brokenChain',
        state: stateWithFormatterQueries,
      })

      expect(result).toEqual({
        status: 'error',
        error: {
          code: 'request-build-failed',
          message: expect.stringContaining('endpoint'),
        },
      })

      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('returns request-build-failed when a formatter cannot handle the resolved value', () => {
      const config: RuntimeConfig = {
        ...runtimeConfig,
        api: {
          badDate: {
            method: 'GET',
            endpoint: '/x/{{queries.name.data | date:"dd/MM/yyyy"}}',
          },
        },
      }

      const result = buildRuntimeApiRequest({
        config,
        operationName: 'badDate',
        state: stateWithFormatterQueries,
      })

      expect(result).toEqual({
        status: 'error',
        error: {
          code: 'request-build-failed',
          message: expect.stringContaining('endpoint'),
        },
      })
    })

    it('returns request-build-failed when the formatter argument grammar is invalid', () => {
      const config: RuntimeConfig = {
        ...runtimeConfig,
        api: {
          badGrammar: {
            method: 'GET',
            endpoint: '/x/{{queries.total.data | truncate:}}',
          },
        },
      }

      const result = buildRuntimeApiRequest({
        config,
        operationName: 'badGrammar',
        state: stateWithFormatterQueries,
      })

      expect(result).toEqual({
        status: 'error',
        error: {
          code: 'request-build-failed',
          message: expect.stringContaining('endpoint'),
        },
      })
    })
  })
})

describe('Runtime api errorCondition evaluation', () => {
  it('returns success with parsed data when no errorCondition is declared (regression)', async () => {
    await expect(
      executeRuntimeApiOperation({
        config: runtimeConfig,
        operationName: 'searchUsers',
        state: runtimeState,
        fetch: vi.fn().mockResolvedValue(
          new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
        ),
      }),
    ).resolves.toEqual({
      status: 'success',
      data: { ok: true },
    })
  })

  it('triggers error when notEquals condition is met and extracts message and code from body', async () => {
    const config: RuntimeConfig = {
      ...runtimeConfig,
      api: {
        checkStatus: {
          method: 'GET',
          endpoint: '/api/check',
          errorCondition: { path: 'code', notEquals: 200 },
          errorMessagePath: 'message',
          errorCodePath: 'code',
        },
      },
    }

    await expect(
      executeRuntimeApiOperation({
        config,
        operationName: 'checkStatus',
        state: runtimeState,
        fetch: vi.fn().mockResolvedValue(
          new Response(JSON.stringify({ code: 500, message: 'Error interno' }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
        ),
      }),
    ).resolves.toEqual({
      status: 'error',
      error: { code: '500', message: 'Error interno' },
    })
  })

  it('triggers error when equals condition is met with nested errorMessagePath and errorCodePath', async () => {
    const config: RuntimeConfig = {
      ...runtimeConfig,
      api: {
        search: {
          method: 'POST',
          endpoint: '/api/search',
          errorCondition: { path: 'success', equals: false },
          errorMessagePath: 'error.message',
          errorCodePath: 'error.code',
        },
      },
    }

    await expect(
      executeRuntimeApiOperation({
        config,
        operationName: 'search',
        state: runtimeState,
        fetch: vi.fn().mockResolvedValue(
          new Response(JSON.stringify({ success: false, error: { message: 'No autorizado', code: 'UNAUTHORIZED' } }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
        ),
      }),
    ).resolves.toEqual({
      status: 'error',
      error: { code: 'UNAUTHORIZED', message: 'No autorizado' },
    })
  })

  it('triggers error when equals null condition is met and uses defaults when paths are absent', async () => {
    const config: RuntimeConfig = {
      ...runtimeConfig,
      api: {
        checkNull: {
          method: 'GET',
          endpoint: '/api/check',
          errorCondition: { path: 'code', equals: null },
        },
      },
    }

    await expect(
      executeRuntimeApiOperation({
        config,
        operationName: 'checkNull',
        state: runtimeState,
        fetch: vi.fn().mockResolvedValue(
          new Response(JSON.stringify({ code: null }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
        ),
      }),
    ).resolves.toEqual({
      status: 'error',
      error: { code: 'business-error-condition', message: 'Error en la respuesta del servidor' },
    })
  })

  it('triggers error when truthiness condition is met with truthy value', async () => {
    const config: RuntimeConfig = {
      ...runtimeConfig,
      api: {
        checkOk: {
          method: 'GET',
          endpoint: '/api/check',
          errorCondition: { path: 'ok' },
        },
      },
    }

    await expect(
      executeRuntimeApiOperation({
        config,
        operationName: 'checkOk',
        state: runtimeState,
        fetch: vi.fn().mockResolvedValue(
          new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
        ),
      }),
    ).resolves.toEqual({
      status: 'error',
      error: { code: 'business-error-condition', message: 'Error en la respuesta del servidor' },
    })
  })

  it('returns success when truthiness condition is not met with false value', async () => {
    const config: RuntimeConfig = {
      ...runtimeConfig,
      api: {
        checkOk: {
          method: 'GET',
          endpoint: '/api/check',
          errorCondition: { path: 'ok' },
        },
      },
    }

    await expect(
      executeRuntimeApiOperation({
        config,
        operationName: 'checkOk',
        state: runtimeState,
        fetch: vi.fn().mockResolvedValue(
          new Response(JSON.stringify({ ok: false }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
        ),
      }),
    ).resolves.toEqual({
      status: 'success',
      data: { ok: false },
    })
  })

  it('returns success when truthiness condition is not met with 0', async () => {
    const config: RuntimeConfig = {
      ...runtimeConfig,
      api: {
        checkOk: {
          method: 'GET',
          endpoint: '/api/check',
          errorCondition: { path: 'ok' },
        },
      },
    }

    await expect(
      executeRuntimeApiOperation({
        config,
        operationName: 'checkOk',
        state: runtimeState,
        fetch: vi.fn().mockResolvedValue(
          new Response(JSON.stringify({ ok: 0 }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
        ),
      }),
    ).resolves.toEqual({
      status: 'success',
      data: { ok: 0 },
    })
  })

  it('returns success when truthiness condition is not met with empty string', async () => {
    const config: RuntimeConfig = {
      ...runtimeConfig,
      api: {
        checkOk: {
          method: 'GET',
          endpoint: '/api/check',
          errorCondition: { path: 'ok' },
        },
      },
    }

    await expect(
      executeRuntimeApiOperation({
        config,
        operationName: 'checkOk',
        state: runtimeState,
        fetch: vi.fn().mockResolvedValue(
          new Response(JSON.stringify({ ok: '' }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
        ),
      }),
    ).resolves.toEqual({
      status: 'success',
      data: { ok: '' },
    })
  })

  it('triggers error when deeply nested path condition is met', async () => {
    const config: RuntimeConfig = {
      ...runtimeConfig,
      api: {
        checkDeep: {
          method: 'GET',
          endpoint: '/api/check',
          errorCondition: { path: 'deeply.nested.flag', equals: true },
        },
      },
    }

    await expect(
      executeRuntimeApiOperation({
        config,
        operationName: 'checkDeep',
        state: runtimeState,
        fetch: vi.fn().mockResolvedValue(
          new Response(JSON.stringify({ deeply: { nested: { flag: true } } }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
        ),
      }),
    ).resolves.toEqual({
      status: 'error',
      error: { code: 'business-error-condition', message: 'Error en la respuesta del servidor' },
    })
  })

  it('triggers error when array index path condition is met', async () => {
    const config: RuntimeConfig = {
      ...runtimeConfig,
      api: {
        checkItems: {
          method: 'GET',
          endpoint: '/api/check',
          errorCondition: { path: 'items.0.broken', equals: true },
        },
      },
    }

    await expect(
      executeRuntimeApiOperation({
        config,
        operationName: 'checkItems',
        state: runtimeState,
        fetch: vi.fn().mockResolvedValue(
          new Response(JSON.stringify({ items: [{ broken: true }] }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
        ),
      }),
    ).resolves.toEqual({
      status: 'error',
      error: { code: 'business-error-condition', message: 'Error en la respuesta del servidor' },
    })
  })

  it('returns success when path is missing in body (condition not met)', async () => {
    const config: RuntimeConfig = {
      ...runtimeConfig,
      api: {
        checkMissing: {
          method: 'GET',
          endpoint: '/api/check',
          errorCondition: { path: 'missing.deep' },
        },
      },
    }

    await expect(
      executeRuntimeApiOperation({
        config,
        operationName: 'checkMissing',
        state: runtimeState,
        fetch: vi.fn().mockResolvedValue(
          new Response(JSON.stringify({}), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
        ),
      }),
    ).resolves.toEqual({
      status: 'success',
      data: {},
    })
  })

  it('returns success when notEquals condition is not met', async () => {
    const config: RuntimeConfig = {
      ...runtimeConfig,
      api: {
        checkCode: {
          method: 'GET',
          endpoint: '/api/check',
          errorCondition: { path: 'code', notEquals: 200 },
        },
      },
    }

    await expect(
      executeRuntimeApiOperation({
        config,
        operationName: 'checkCode',
        state: runtimeState,
        fetch: vi.fn().mockResolvedValue(
          new Response(JSON.stringify({ code: 200 }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
        ),
      }),
    ).resolves.toEqual({
      status: 'success',
      data: { code: 200 },
    })
  })

  it('uses default error message when errorMessagePath is absent and condition is met', async () => {
    const config: RuntimeConfig = {
      ...runtimeConfig,
      api: {
        checkCode: {
          method: 'GET',
          endpoint: '/api/check',
          errorCondition: { path: 'code', notEquals: 200 },
        },
      },
    }

    const result = await executeRuntimeApiOperation({
      config,
      operationName: 'checkCode',
      state: runtimeState,
      fetch: vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ code: 500 }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    })

    expect(result).toEqual({
      status: 'error',
      error: { code: 'business-error-condition', message: 'Error en la respuesta del servidor' },
    })
  })

  it('uses default error message when errorMessagePath field is absent in body', async () => {
    const config: RuntimeConfig = {
      ...runtimeConfig,
      api: {
        checkCode: {
          method: 'GET',
          endpoint: '/api/check',
          errorCondition: { path: 'code', notEquals: 200 },
          errorMessagePath: 'message',
        },
      },
    }

    const result = await executeRuntimeApiOperation({
      config,
      operationName: 'checkCode',
      state: runtimeState,
      fetch: vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ code: 500 }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    })

    expect(result).toEqual({
      status: 'error',
      error: { code: 'business-error-condition', message: 'Error en la respuesta del servidor' },
    })
  })

  it('uses default error message when errorMessagePath resolves to empty string', async () => {
    const config: RuntimeConfig = {
      ...runtimeConfig,
      api: {
        checkCode: {
          method: 'GET',
          endpoint: '/api/check',
          errorCondition: { path: 'code', notEquals: 200 },
          errorMessagePath: 'message',
        },
      },
    }

    const result = await executeRuntimeApiOperation({
      config,
      operationName: 'checkCode',
      state: runtimeState,
      fetch: vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ code: 500, message: '' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    })

    expect(result).toEqual({
      status: 'error',
      error: { code: 'business-error-condition', message: 'Error en la respuesta del servidor' },
    })
  })

  it('uses default error message when errorMessagePath resolves to a non-string value', async () => {
    const config: RuntimeConfig = {
      ...runtimeConfig,
      api: {
        checkCode: {
          method: 'GET',
          endpoint: '/api/check',
          errorCondition: { path: 'code', notEquals: 200 },
          errorMessagePath: 'message',
        },
      },
    }

    const result = await executeRuntimeApiOperation({
      config,
      operationName: 'checkCode',
      state: runtimeState,
      fetch: vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ code: 500, message: 42 }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    })

    expect(result).toEqual({
      status: 'error',
      error: { code: 'business-error-condition', message: 'Error en la respuesta del servidor' },
    })
  })

  it('coerces numeric errorCodePath value to string', async () => {
    const config: RuntimeConfig = {
      ...runtimeConfig,
      api: {
        checkCode: {
          method: 'GET',
          endpoint: '/api/check',
          errorCondition: { path: 'code', notEquals: 200 },
          errorCodePath: 'code',
        },
      },
    }

    const result = await executeRuntimeApiOperation({
      config,
      operationName: 'checkCode',
      state: runtimeState,
      fetch: vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ code: 500 }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    })

    expect(result).toEqual({
      status: 'error',
      error: { code: '500', message: 'Error en la respuesta del servidor' },
    })
  })

  it('uses default error code when errorCodePath is absent in body', async () => {
    const config: RuntimeConfig = {
      ...runtimeConfig,
      api: {
        checkCode: {
          method: 'GET',
          endpoint: '/api/check',
          errorCondition: { path: 'code', notEquals: 200 },
          errorCodePath: 'missing',
        },
      },
    }

    const result = await executeRuntimeApiOperation({
      config,
      operationName: 'checkCode',
      state: runtimeState,
      fetch: vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ code: 500 }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    })

    expect(result).toEqual({
      status: 'error',
      error: { code: 'business-error-condition', message: 'Error en la respuesta del servidor' },
    })
  })

  it('uses default error code when errorCodePath resolves to a non-string non-number value', async () => {
    const config: RuntimeConfig = {
      ...runtimeConfig,
      api: {
        checkCode: {
          method: 'GET',
          endpoint: '/api/check',
          errorCondition: { path: 'code', notEquals: 200 },
          errorCodePath: 'customCode',
        },
      },
    }

    const result = await executeRuntimeApiOperation({
      config,
      operationName: 'checkCode',
      state: runtimeState,
      fetch: vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ code: 500, customCode: { nested: true } }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    })

    expect(result).toEqual({
      status: 'error',
      error: { code: 'business-error-condition', message: 'Error en la respuesta del servidor' },
    })
  })

  it('uses default error code when errorCodePath is not declared', async () => {
    const config: RuntimeConfig = {
      ...runtimeConfig,
      api: {
        checkCode: {
          method: 'GET',
          endpoint: '/api/check',
          errorCondition: { path: 'code', notEquals: 200 },
        },
      },
    }

    const result = await executeRuntimeApiOperation({
      config,
      operationName: 'checkCode',
      state: runtimeState,
      fetch: vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ code: 500 }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    })

    expect(result).toEqual({
      status: 'error',
      error: { code: 'business-error-condition', message: 'Error en la respuesta del servidor' },
    })
  })

  it('still produces http-error when response is not ok even if errorCondition is declared', async () => {
    const config: RuntimeConfig = {
      ...runtimeConfig,
      api: {
        checkCode: {
          method: 'GET',
          endpoint: '/api/check',
          errorCondition: { path: 'code', notEquals: 200 },
          errorMessagePath: 'message',
          errorCodePath: 'code',
        },
      },
    }

    await expect(
      executeRuntimeApiOperation({
        config,
        operationName: 'checkCode',
        state: runtimeState,
        fetch: vi.fn().mockResolvedValue(
          new Response(JSON.stringify({ code: 500, message: 'Server error' }), {
            status: 500,
            headers: { 'content-type': 'application/json' },
          }),
        ),
      }),
    ).resolves.toEqual({
      status: 'error',
      error: {
        code: 'http-error',
        message: 'The api operation "checkCode" failed with HTTP status 500.',
      },
    })
  })

  it('returns success with null data for 204 response even if errorCondition is declared', async () => {
    const config: RuntimeConfig = {
      ...runtimeConfig,
      api: {
        deleteItem: {
          method: 'DELETE',
          endpoint: '/api/items',
          errorCondition: { path: 'code', notEquals: 200 },
        },
      },
    }

    await expect(
      executeRuntimeApiOperation({
        config,
        operationName: 'deleteItem',
        state: runtimeState,
        fetch: vi.fn().mockResolvedValue(
          new Response(null, { status: 204 }),
        ),
      }),
    ).resolves.toEqual({
      status: 'success',
      data: null,
    })
  })

  it('returns success with null data for empty body even if errorCondition is declared', async () => {
    const config: RuntimeConfig = {
      ...runtimeConfig,
      api: {
        emptyResponse: {
          method: 'GET',
          endpoint: '/api/empty',
          errorCondition: { path: 'code', notEquals: 200 },
        },
      },
    }

    await expect(
      executeRuntimeApiOperation({
        config,
        operationName: 'emptyResponse',
        state: runtimeState,
        fetch: vi.fn().mockResolvedValue(
          new Response('', { status: 200 }),
        ),
      }),
    ).resolves.toEqual({
      status: 'success',
      data: null,
    })
  })

  it('still produces invalid-json-response when json is invalid even if errorCondition is declared', async () => {
    const config: RuntimeConfig = {
      ...runtimeConfig,
      api: {
        brokenJson: {
          method: 'GET',
          endpoint: '/api/broken',
          errorCondition: { path: 'code', notEquals: 200 },
        },
      },
    }

    await expect(
      executeRuntimeApiOperation({
        config,
        operationName: 'brokenJson',
        state: runtimeState,
        fetch: vi.fn().mockResolvedValue(
          new Response('{"broken"', {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
        ),
      }),
    ).resolves.toEqual({
      status: 'error',
      error: {
        code: 'invalid-json-response',
        message: 'The api operation "brokenJson" returned invalid JSON.',
      },
    })
  })

  it('leaves data null after errorCondition triggers error (T04 integration)', async () => {
    const config: RuntimeConfig = {
      ...runtimeConfig,
      api: {
        searchUsers: {
          method: 'GET',
          endpoint: '/api/users',
          query: {
            search: 'forms.userSearch.term',
          },
          errorCondition: { path: 'ok', equals: false },
          errorMessagePath: 'msg',
          errorCodePath: 'errCode',
        },
      },
    }

    const result = await executeRuntimeApiOperation({
      config,
      operationName: 'searchUsers',
      state: runtimeState,
      fetch: vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ ok: false, msg: 'Fallo', errCode: 'FAIL' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    })

    expect(result).toEqual({
      status: 'error',
      error: { code: 'FAIL', message: 'Fallo' },
    })
  })
})

describe('Runtime api header interpolation — api.headers surface (T2 integration)', () => {
  function makeStateWithToken(
    tokenId: string,
    status: 'ready' | 'error',
    value = '',
  ): RuntimeState {
    return {
      ...runtimeState,
      tokens: {
        [tokenId]: status === 'ready' ? { status: 'ready', value, failedAttempts: 0 } : { status: 'error' },
      },
    }
  }

  it('resolves "Bearer {{tokens.sede.value}}" in api.headers when token is ready', () => {
    const state = makeStateWithToken('sede', 'ready', 'XYZ')
    const result = buildRuntimeApiRequest({
      config: {
        ...runtimeConfig,
        api: {
          secureGet: {
            method: 'GET',
            endpoint: '/api/secure',
            headers: {
              Authorization: 'Bearer {{tokens.sede.value}}',
            },
          },
        },
      },
      operationName: 'secureGet',
      state,
    })

    expect(result).toEqual({
      status: 'ready',
      request: expect.objectContaining({
        init: expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer XYZ',
          }),
        }),
      }),
    })
  })

  it('resolves multi-placeholder "{{params.tenantId}}-{{queries.session.data.userId}}" in api.headers', () => {
    const state: RuntimeState = {
      ...runtimeState,
      navigation: {
        currentPageId: 'details',
        history: [
          { entryId: 0, pageId: 'home', params: {} },
          { entryId: 1, pageId: 'details', params: { tenantId: 'acme' } },
        ],
        currentEntryIndex: 1,
        lastError: null,
      },
      pageEntry: {
        entryId: 1,
        pageId: 'details',
        params: { tenantId: 'acme' },
        preloadNames: [],
        status: 'idle',
      },
      queries: {
        ...runtimeState.queries,
        session: {
          status: 'success',
          data: { userId: 'u-1' },
          error: null,
        },
      },
    }

    const result = buildRuntimeApiRequest({
      config: {
        ...runtimeConfig,
        api: {
          multiHeader: {
            method: 'GET',
            endpoint: '/api/multi',
            headers: {
              'X-Header': '{{params.tenantId}}-{{queries.session.data.userId}}',
            },
          },
        },
      },
      operationName: 'multiHeader',
      state,
    })

    expect(result.status).toBe('ready')
    if (result.status !== 'ready') return
    expect((result.request.init.headers as Record<string, string>)['X-Header']).toBe('acme-u-1')
  })

  it('api.headers with placeholder whose token is in error produces token-refresh-failed', () => {
    const state = makeStateWithToken('sede', 'error')
    const result = buildRuntimeApiRequest({
      config: {
        ...runtimeConfig,
        api: {
          secureGet: {
            method: 'GET',
            endpoint: '/api/secure',
            headers: {
              Authorization: 'Bearer {{tokens.sede.value}}',
            },
          },
        },
      },
      operationName: 'secureGet',
      state,
    })

    expect(result).toEqual({
      status: 'error',
      error: {
        code: 'token-refresh-failed',
        message: expect.stringContaining('sede'),
      },
    })
  })

  it('api.headers with placeholder whose reference is missing produces request-build-failed', () => {
    const result = buildRuntimeApiRequest({
      config: {
        ...runtimeConfig,
        api: {
          secureGet: {
            method: 'GET',
            endpoint: '/api/secure',
            headers: {
              'X-Custom': '{{params.nonExistentParam}}',
            },
          },
        },
      },
      operationName: 'secureGet',
      state: runtimeState,
    })

    expect(result).toEqual({
      status: 'error',
      error: {
        code: 'request-build-failed',
        message: expect.stringContaining('params.nonExistentParam'),
      },
    })
  })
})

describe('Runtime api inline builder/executor (T2)', () => {
  const inlineOperation = runtimeConfig.api.searchUsers

  it('buildInlineRuntimeApiRequest produces the same url and init as buildRuntimeApiRequest with the same operation in config', () => {
    const viaConfig = buildRuntimeApiRequest({
      config: runtimeConfig,
      operationName: 'searchUsers',
      state: runtimeState,
    })

    const viaInline = buildInlineRuntimeApiRequest({
      operation: inlineOperation,
      operationName: 'searchUsers',
      state: runtimeState,
    })

    expect(viaConfig.status).toBe('ready')
    expect(viaInline.status).toBe('ready')

    if (viaConfig.status !== 'ready' || viaInline.status !== 'ready') return

    expect(viaInline.request.url).toBe(viaConfig.request.url)
    expect(viaInline.request.init).toEqual(viaConfig.request.init)
  })

  it('buildInlineRuntimeApiRequest with requestParams.files activates the multipart path (T1 regression via inline)', () => {
    const docFile = new File(['content'], 'doc.pdf', { type: 'application/pdf' })
    // Use replaceUser which has a flat scalar body { name: 'Ada Lovelace' } — safe for multipart
    const uploadOperation = runtimeConfig.api.replaceUser

    const result = buildInlineRuntimeApiRequest({
      operation: uploadOperation,
      operationName: 'replaceUser',
      state: runtimeState,
      requestParams: {
        files: [{ name: 'file', file: docFile }],
      },
    })

    expect(result.status).toBe('ready')

    if (result.status !== 'ready') return

    expect(result.request.init.body).toBeInstanceOf(FormData)
  })

  it('executeInlineRuntimeApiOperation returns the same status and data as executeRuntimeApiOperation with the same operation', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ results: ['Ada'] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )

    const viaOperation = await executeRuntimeApiOperation({
      config: runtimeConfig,
      operationName: 'searchUsers',
      state: runtimeState,
      fetch: fetchMock,
    })

    const fetchMock2 = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ results: ['Ada'] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )

    const viaInline = await executeInlineRuntimeApiOperation({
      operation: inlineOperation,
      operationName: 'searchUsers',
      state: runtimeState,
      fetch: fetchMock2,
    })

    expect(viaOperation).toEqual(viaInline)
    expect(viaInline).toEqual({ status: 'success', data: { results: ['Ada'] } })
  })

  it('buildRuntimeApiRequest still returns operation-not-found with the literal message when operationName does not exist in config', () => {
    const result = buildRuntimeApiRequest({
      config: runtimeConfig,
      operationName: 'ghostOperation',
      state: runtimeState,
    })

    expect(result).toEqual({
      status: 'error',
      error: {
        code: 'operation-not-found',
        message: 'The api operation "ghostOperation" does not exist.',
      },
    })
  })

  it('existing runtime-api-execution tests are unaffected by the refactor (regression sanity)', () => {
    const result = buildRuntimeApiRequest({
      config: runtimeConfig,
      operationName: 'createUser',
      state: runtimeState,
    })

    expect(result).toEqual({
      status: 'ready',
      request: {
        operationName: 'createUser',
        operation: runtimeConfig.api.createUser,
        url: '/api/users',
        init: {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name: 'Ada', profile: { nickname: 'Countess' } }),
        },
      },
    })
  })
})
