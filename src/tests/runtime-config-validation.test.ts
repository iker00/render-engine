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

function createConfigWithPages(pages: Array<Record<string, unknown>>, initialPage = 'home') {
  return {
    api: {},
    pages,
    initialPage,
  }
}

function createConfigWithLayout(layout: Array<Record<string, unknown>>) {
  return createConfigWithPages([
    {
      id: 'home',
      layout,
    },
  ])
}

function createRepeaterNode(overrides: Record<string, unknown> = {}) {
  return {
    type: 'repeater',
    props: {
      items: {
        source: 'queries.posts.data',
        key: 'id',
      },
      template: [
        {
          type: 'heading',
          props: {
            text: 'item.title',
            level: 2,
          },
        },
        {
          type: 'paragraph',
          props: {
            text: 'item.summary',
          },
        },
      ],
    },
    ...overrides,
  }
}

function createConfigWithNavigateToButtonAction(
  actionOverrides: Record<string, unknown> = {},
  options: { extraPages?: Array<Record<string, unknown>> } = {},
) {
  return createConfigWithPages(
    [
      {
        id: 'home',
        layout: [
          {
            type: 'button',
            props: {
              label: 'Open details',
              action: {
                type: 'navigateTo',
                pageId: 'details',
                ...actionOverrides,
              },
            },
          },
        ],
      },
      {
        id: 'details',
        layout: [],
      },
      ...(options.extraPages ?? []),
    ],
    'home',
  )
}

function createConfigWithExecuteOperationButtonAction(
  actionOverrides: Record<string, unknown> = {},
  options: { api?: Record<string, unknown> } = {},
) {
  return {
    api: {
      searchUsers: {
        method: 'GET',
        endpoint: '/api/users',
      },
      ...options.api,
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
                ...actionOverrides,
              },
            },
          },
        ],
      },
    ],
    initialPage: 'home',
  }
}

function createFormNode(overrides: Record<string, unknown> = {}) {
  return {
    type: 'form',
    id: 'user-form',
    submitAction: {
      type: 'executeOperation',
      operationName: 'submitUserForm',
    },
    resetOnSuccess: true,
    children: [
      {
        type: 'input',
        props: {
          fieldId: 'name',
          label: 'Name',
          defaultValue: 'Ada',
        },
      },
      {
        type: 'container',
        children: [
          {
            type: 'textarea',
            props: {
              fieldId: 'bio',
              label: 'Bio',
              defaultValue: 'Runtime builder',
            },
          },
          {
            type: 'select',
            props: {
              fieldId: 'role',
              label: 'Role',
              defaultValue: 'admin',
              items: [
                { label: 'Admin', value: 'admin' },
                { label: 'Editor', value: 'editor' },
              ],
            },
          },
          {
            type: 'button',
            props: {
              label: 'Submit',
            },
          },
        ],
      },
    ],
    ...overrides,
  }
}

function createConfigWithFormLayout(
  formOverrides: Record<string, unknown> = {},
  options: { api?: Record<string, unknown>; extraPages?: Array<Record<string, unknown>> } = {},
) {
  return {
    api: {
      submitUserForm: {
        method: 'POST',
        endpoint: '/api/forms',
      },
      ...options.api,
    },
    pages: [
      {
        id: 'home',
        layout: [createFormNode(formOverrides)],
      },
      ...(options.extraPages ?? []),
    ],
    initialPage: 'home',
  }
}

function createVisibilityRule(overrides: Record<string, unknown> = {}) {
  const rule = {
    reference: 'forms.profile.role',
    operator: 'equals',
    value: 'admin',
    ...overrides,
  }

  if (
    (rule.operator === 'isTruthy' || rule.operator === 'isFalsy') &&
    !Object.prototype.hasOwnProperty.call(overrides, 'value')
  ) {
    delete rule.value
  }

  return rule
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

  it('accepts a button node with a navigateTo action to an existing page', () => {
    const result = validateRuntimeConfig(
      createConfigWithPages([
        {
          id: 'home',
          layout: [
            {
              type: 'button',
              props: {
                label: 'Go to details',
                action: {
                  type: 'navigateTo',
                  pageId: 'details',
                },
              },
            },
          ],
        },
        {
          id: 'details',
          layout: [],
        },
      ]),
    )

    expect(result).toEqual({
      status: 'ready',
      config: {
        api: {},
        pages: [
          {
            id: 'home',
            layout: [
              {
                type: 'button',
                props: {
                  label: 'Go to details',
                  action: {
                    type: 'navigateTo',
                    pageId: 'details',
                  },
                },
              },
            ],
          },
          {
            id: 'details',
            layout: [],
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
              label: 'Go to details',
              action: {
                type: 'navigateTo',
                pageId: 'details',
              },
            },
          },
        ],
      },
    })
  })

  it('accepts a button node with a goBack action', () => {
    const result = validateRuntimeConfig(
      createConfigWithPages([
        {
          id: 'home',
          layout: [
            {
              type: 'button',
              props: {
                label: 'Back',
                action: {
                  type: 'goBack',
                },
              },
            },
          ],
        },
      ]),
    )

    expect(result).toEqual({
      status: 'ready',
      config: {
        api: {},
        pages: [
          {
            id: 'home',
            layout: [
              {
                type: 'button',
                props: {
                  label: 'Back',
                  action: {
                    type: 'goBack',
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
              label: 'Back',
              action: {
                type: 'goBack',
              },
            },
          },
        ],
      },
    })
  })

  it('accepts a button node with an executeOperation action', () => {
    const result = validateRuntimeConfig({
      api: {
        searchUsers: {
          method: 'GET',
          endpoint: '/api/users',
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
                },
              },
            },
          ],
        },
      ],
      initialPage: 'home',
    })

    expect(result).toEqual({
      status: 'ready',
      config: {
        api: {
          searchUsers: {
            method: 'GET',
            endpoint: '/api/users',
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
              },
            },
          },
        ],
      },
    })
  })

  it('accepts a button node with a resetForm action', () => {
    const result = validateRuntimeConfig(
      createConfigWithPages([
        {
          id: 'home',
          layout: [
            {
              type: 'button',
              props: {
                label: 'Clear form',
                action: {
                  type: 'resetForm',
                  formId: 'search-form',
                },
              },
            },
          ],
        },
      ]),
    )

    expect(result).toEqual({
      status: 'ready',
      config: {
        api: {},
        pages: [
          {
            id: 'home',
            layout: [
              {
                type: 'button',
                props: {
                  label: 'Clear form',
                  action: {
                    type: 'resetForm',
                    formId: 'search-form',
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
              label: 'Clear form',
              action: {
                type: 'resetForm',
                formId: 'search-form',
              },
            },
          },
        ],
      },
    })
  })

  it('accepts multiple buttons in the same layout in declared order', () => {
    const result = validateRuntimeConfig(
      createConfigWithPages([
        {
          id: 'home',
          layout: [
            {
              type: 'button',
              props: {
                label: 'Open details',
                action: {
                  type: 'navigateTo',
                  pageId: 'details',
                },
              },
            },
            {
              type: 'button',
              props: {
                label: 'Back',
                action: {
                  type: 'goBack',
                },
              },
            },
          ],
        },
        {
          id: 'details',
          layout: [],
        },
      ]),
    )

    expect(result.status).toBe('ready')

    if (result.status !== 'ready') {
      throw new Error('Expected ready result')
    }

    expect(result.config.pages[0].layout).toEqual([
      {
        type: 'button',
        props: {
          label: 'Open details',
          action: {
            type: 'navigateTo',
            pageId: 'details',
          },
        },
      },
      {
        type: 'button',
        props: {
          label: 'Back',
          action: {
            type: 'goBack',
          },
        },
      },
    ])
  })

  it('accepts queryStateFeedback with supported states including idle and fallback collections', () => {
    const result = validateRuntimeConfig(
      createConfigWithPages([
        {
          id: 'home',
          layout: [
            {
              type: 'heading',
              queryStateFeedback: {
                query: 'searchUsers',
                states: {
                  idle: {
                    mode: 'hide',
                  },
                  loading: {
                    mode: 'fallback',
                    fallback: [
                      {
                        type: 'paragraph',
                        props: {
                          text: 'Loading users...',
                        },
                      },
                      {
                        type: 'list',
                        props: {
                          items: ['Please wait'],
                        },
                      },
                    ],
                  },
                  error: {
                    mode: 'show',
                  },
                  empty: {
                    mode: 'hide',
                  },
                },
              },
              props: {
                text: 'Users',
                level: 2,
              },
            },
          ],
        },
      ]),
    )

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
                queryStateFeedback: {
                  query: 'searchUsers',
                  states: {
                    idle: {
                      mode: 'hide',
                    },
                    loading: {
                      mode: 'fallback',
                      fallback: [
                        {
                          type: 'paragraph',
                          props: {
                            text: 'Loading users...',
                          },
                        },
                        {
                          type: 'list',
                          props: {
                            items: ['Please wait'],
                          },
                        },
                      ],
                    },
                    error: {
                      mode: 'show',
                    },
                    empty: {
                      mode: 'hide',
                    },
                  },
                },
                props: {
                  text: 'Users',
                  level: 2,
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
            type: 'heading',
            queryStateFeedback: {
              query: 'searchUsers',
              states: {
                idle: {
                  mode: 'hide',
                },
                loading: {
                  mode: 'fallback',
                  fallback: [
                    {
                      type: 'paragraph',
                      props: {
                        text: 'Loading users...',
                      },
                    },
                    {
                      type: 'list',
                      props: {
                        items: ['Please wait'],
                      },
                    },
                  ],
                },
                error: {
                  mode: 'show',
                },
                empty: {
                  mode: 'hide',
                },
              },
            },
            props: {
              text: 'Users',
              level: 2,
            },
          },
        ],
      },
    })
  })

  it('accepts idle queryStateFeedback rules with show hide and fallback modes', () => {
    const result = validateRuntimeConfig(
      createConfigWithPages([
        {
          id: 'home',
          layout: [
            {
              type: 'container',
              props: {
                direction: 'column',
              },
              children: [
                {
                  type: 'paragraph',
                  queryStateFeedback: {
                    query: 'searchUsers',
                    states: {
                      idle: {
                        mode: 'show',
                      },
                    },
                  },
                  props: {
                    text: 'Visible while idle',
                  },
                },
                {
                  type: 'paragraph',
                  queryStateFeedback: {
                    query: 'searchUsers',
                    states: {
                      idle: {
                        mode: 'hide',
                      },
                    },
                  },
                  props: {
                    text: 'Hidden while idle',
                  },
                },
                {
                  type: 'paragraph',
                  queryStateFeedback: {
                    query: 'searchUsers',
                    states: {
                      idle: {
                        mode: 'fallback',
                        fallback: [
                          {
                            type: 'paragraph',
                            props: {
                              text: 'Run a search first',
                            },
                          },
                        ],
                      },
                    },
                  },
                  props: {
                    text: 'Users loaded',
                  },
                },
              ],
            },
          ],
        },
      ]),
    )

    expect(result.status).toBe('ready')

    if (result.status !== 'ready') {
      throw new Error('Expected ready result')
    }

    expect(result.config.pages[0].layout[0]).toEqual({
      type: 'container',
      props: {
        direction: 'column',
      },
      children: [
        {
          type: 'paragraph',
          queryStateFeedback: {
            query: 'searchUsers',
            states: {
              idle: {
                mode: 'show',
              },
            },
          },
          props: {
            text: 'Visible while idle',
          },
        },
        {
          type: 'paragraph',
          queryStateFeedback: {
            query: 'searchUsers',
            states: {
              idle: {
                mode: 'hide',
              },
            },
          },
          props: {
            text: 'Hidden while idle',
          },
        },
        {
          type: 'paragraph',
          queryStateFeedback: {
            query: 'searchUsers',
            states: {
              idle: {
                mode: 'fallback',
                fallback: [
                  {
                    type: 'paragraph',
                    props: {
                      text: 'Run a search first',
                    },
                  },
                ],
              },
            },
          },
          props: {
            text: 'Users loaded',
          },
        },
      ],
    })
  })

  it('drops unsupported extra keys from queryStateFeedback blocks and rules', () => {
    const result = validateRuntimeConfig(
      createConfigWithPages([
        {
          id: 'home',
          layout: [
            {
              type: 'paragraph',
              queryStateFeedback: {
                query: 'searchUsers',
                debug: true,
                states: {
                  success: {
                    mode: 'show',
                    tone: 'primary',
                  },
                },
              },
              props: {
                text: 'Users loaded',
              },
            },
          ],
        },
      ]),
    )

    expect(result.status).toBe('ready')

    if (result.status !== 'ready') {
      throw new Error('Expected ready result')
    }

    expect(result.config.pages[0].layout[0]).toEqual({
      type: 'paragraph',
      queryStateFeedback: {
        query: 'searchUsers',
        states: {
          success: {
            mode: 'show',
          },
        },
      },
      props: {
        text: 'Users loaded',
      },
    })
  })

  it('rejects queryStateFeedback states outside the supported idle loading error empty success set', () => {
    expect(
      validateRuntimeConfig(
        createConfigWithPages([
          {
            id: 'home',
            layout: [
              {
                type: 'paragraph',
                queryStateFeedback: {
                  query: 'searchUsers',
                  states: {
                    pending: {
                      mode: 'hide',
                    },
                  },
                },
                props: {
                  text: 'Users loaded',
                },
              },
            ],
          },
        ]),
      ),
    ).toEqual({
      status: 'error',
      error: {
        code: 'invalid-layout',
        displayMode: 'development-only',
        message: 'Page "home" has an invalid layout at "layout[0].queryStateFeedback.states.pending".',
      },
    })
  })

  it('rejects queryStateFeedback idle fallback mode when fallback is missing', () => {
    expect(
      validateRuntimeConfig(
        createConfigWithPages([
          {
            id: 'home',
            layout: [
              {
                type: 'paragraph',
                queryStateFeedback: {
                  query: 'searchUsers',
                  states: {
                    idle: {
                      mode: 'fallback',
                    },
                  },
                },
                props: {
                  text: 'Users loaded',
                },
              },
            ],
          },
        ]),
      ),
    ).toEqual({
      status: 'error',
      error: {
        code: 'invalid-layout',
        displayMode: 'development-only',
        message: 'Page "home" has an invalid layout at "layout[0].queryStateFeedback.states.idle.fallback".',
      },
    })
  })

  it('rejects queryStateFeedback fallback mode when fallback is missing', () => {
    expect(
      validateRuntimeConfig(
        createConfigWithPages([
          {
            id: 'home',
            layout: [
              {
                type: 'paragraph',
                queryStateFeedback: {
                  query: 'searchUsers',
                  states: {
                    loading: {
                      mode: 'fallback',
                    },
                  },
                },
                props: {
                  text: 'Users loaded',
                },
              },
            ],
          },
        ]),
      ),
    ).toEqual({
      status: 'error',
      error: {
        code: 'invalid-layout',
        displayMode: 'development-only',
        message: 'Page "home" has an invalid layout at "layout[0].queryStateFeedback.states.loading.fallback".',
      },
    })
  })

  it('rejects queryStateFeedback fallback collections with unsupported nodes', () => {
    expect(
      validateRuntimeConfig(
        createConfigWithPages([
          {
            id: 'home',
            layout: [
              {
                type: 'paragraph',
                queryStateFeedback: {
                  query: 'searchUsers',
                  states: {
                    loading: {
                      mode: 'fallback',
                      fallback: [
                        {
                          type: 'image',
                          props: {
                            src: '/users.png',
                          },
                        },
                      ],
                    },
                  },
                },
                props: {
                  text: 'Users loaded',
                },
              },
            ],
          },
        ]),
      ),
    ).toEqual({
      status: 'error',
      error: {
        code: 'invalid-layout',
        displayMode: 'development-only',
        message: 'Page "home" has an invalid layout at "layout[0].queryStateFeedback.states.loading.fallback[0].props.alt".',
      },
    })
  })

  it('drops unsupported extra keys from button props and action', () => {
    const result = validateRuntimeConfig(
      createConfigWithPages([
        {
          id: 'home',
          layout: [
            {
              type: 'button',
              props: {
                label: 'Go to details',
                tone: 'primary',
                action: {
                  type: 'navigateTo',
                  pageId: 'details',
                  replace: true,
                },
              },
            },
          ],
        },
        {
          id: 'details',
          layout: [],
        },
      ]),
    )

    expect(result.status).toBe('ready')

    if (result.status !== 'ready') {
      throw new Error('Expected ready result')
    }

    expect(result.config.pages[0].layout[0]).toEqual({
      type: 'button',
      props: {
        label: 'Go to details',
        action: {
          type: 'navigateTo',
          pageId: 'details',
        },
      },
    })
  })

  it('ignores button children and keeps the node as a leaf shape', () => {
    const result = validateRuntimeConfig(
      createConfigWithPages([
        {
          id: 'home',
          layout: [
            {
              type: 'button',
              props: {
                label: 'Back',
                action: {
                  type: 'goBack',
                },
              },
              children: [
                {
                  type: 'paragraph',
                  props: {
                    text: 'Ignored child',
                  },
                },
              ],
            },
          ],
        },
      ]),
    )

    expect(result.status).toBe('ready')

    if (result.status !== 'ready') {
      throw new Error('Expected ready result')
    }

    expect(result.config.pages[0].layout[0]).toEqual({
      type: 'button',
      props: {
        label: 'Back',
        action: {
          type: 'goBack',
        },
      },
    })
  })

  it('drops children from other leaf nodes instead of treating them as supported layout branches', () => {
    const result = validateRuntimeConfig(
      createConfigWithPages([
        {
          id: 'home',
          layout: [
            {
              type: 'paragraph',
              props: {
                text: 'Leaf node',
              },
              children: [
                {
                  type: 'heading',
                  props: {
                    text: 'Ignored',
                    level: 2,
                  },
                },
              ],
            },
          ],
        },
      ]),
    )

    expect(result.status).toBe('ready')

    if (result.status !== 'ready') {
      throw new Error('Expected ready result')
    }

    expect(result.config.pages[0].layout[0]).toEqual({
      type: 'paragraph',
      props: {
        text: 'Leaf node',
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

  it('rejects button nodes without props, without label, or with a non-string label', () => {
    expect(
      validateRuntimeConfig(
        createConfigWithPages([
          {
            id: 'home',
            layout: [
              {
                type: 'button',
              },
            ],
          },
        ]),
      ),
    ).toEqual({
      status: 'error',
      error: {
        code: 'invalid-layout',
        displayMode: 'development-only',
        message: 'Page "home" has an invalid layout at "layout[0].props".',
      },
    })

    expect(
      validateRuntimeConfig(
        createConfigWithPages([
          {
            id: 'home',
            layout: [
              {
                type: 'button',
                props: {
                  action: {
                    type: 'goBack',
                  },
                },
              },
            ],
          },
        ]),
      ),
    ).toEqual({
      status: 'error',
      error: {
        code: 'invalid-layout',
        displayMode: 'development-only',
        message: 'Page "home" has an invalid layout at "layout[0].props.label".',
      },
    })

    expect(
      validateRuntimeConfig(
        createConfigWithPages([
          {
            id: 'home',
            layout: [
              {
                type: 'button',
                props: {
                  label: 42,
                  action: {
                    type: 'goBack',
                  },
                },
              },
            ],
          },
        ]),
      ),
    ).toEqual({
      status: 'error',
      error: {
        code: 'invalid-layout',
        displayMode: 'development-only',
        message: 'Page "home" has an invalid layout at "layout[0].props.label".',
      },
    })
  })

  it('rejects button actions without a supported type', () => {
    expect(
      validateRuntimeConfig(
        createConfigWithPages([
          {
            id: 'home',
            layout: [
              {
                type: 'button',
                props: {
                  label: 'Broken',
                  action: {},
                },
              },
            ],
          },
        ]),
      ),
    ).toEqual({
      status: 'error',
      error: {
        code: 'invalid-layout',
        displayMode: 'development-only',
        message: 'Page "home" has an invalid layout at "layout[0].props.action.type".',
      },
    })

    expect(
      validateRuntimeConfig(
        createConfigWithPages([
          {
            id: 'home',
            layout: [
              {
                type: 'button',
                props: {
                  label: 'Broken',
                  action: {
                    type: 'openModal',
                  },
                },
              },
            ],
          },
        ]),
      ),
    ).toEqual({
      status: 'error',
      error: {
        code: 'invalid-layout',
        displayMode: 'development-only',
        message: 'Page "home" has an invalid layout at "layout[0].props.action.type".',
      },
    })
  })

  it('rejects button nodes without action when they are outside a form subtree', () => {
    expect(
      validateRuntimeConfig(
        createConfigWithPages([
          {
            id: 'home',
            layout: [
              {
                type: 'button',
                props: {
                  label: 'Broken',
                },
              },
            ],
          },
        ]),
      ),
    ).toEqual({
      status: 'error',
      error: {
        code: 'invalid-layout',
        displayMode: 'development-only',
        message: 'Page "home" has an invalid layout at "layout[0]": button nodes without an action must be descendants of a form node.',
      },
    })
  })

  it('rejects navigateTo actions without a valid existing pageId', () => {
    expect(
      validateRuntimeConfig(
        createConfigWithPages([
          {
            id: 'home',
            layout: [
              {
                type: 'button',
                props: {
                  label: 'Missing page',
                  action: {
                    type: 'navigateTo',
                  },
                },
              },
            ],
          },
          {
            id: 'details',
            layout: [],
          },
        ]),
      ),
    ).toEqual({
      status: 'error',
      error: {
        code: 'invalid-layout',
        displayMode: 'development-only',
        message: 'Page "home" has an invalid layout at "layout[0].props.action.pageId".',
      },
    })

    expect(
      validateRuntimeConfig(
        createConfigWithPages([
          {
            id: 'home',
            layout: [
              {
                type: 'button',
                props: {
                  label: 'Empty page',
                  action: {
                    type: 'navigateTo',
                    pageId: '   ',
                  },
                },
              },
            ],
          },
          {
            id: 'details',
            layout: [],
          },
        ]),
      ),
    ).toEqual({
      status: 'error',
      error: {
        code: 'invalid-layout',
        displayMode: 'development-only',
        message: 'Page "home" has an invalid layout at "layout[0].props.action.pageId".',
      },
    })

    expect(
      validateRuntimeConfig(
        createConfigWithPages([
          {
            id: 'home',
            layout: [
              {
                type: 'button',
                props: {
                  label: 'Unknown page',
                  action: {
                    type: 'navigateTo',
                    pageId: 'missing-page',
                  },
                },
              },
            ],
          },
          {
            id: 'details',
            layout: [],
          },
        ]),
      ),
    ).toEqual({
      status: 'error',
      error: {
        code: 'invalid-layout',
        displayMode: 'development-only',
        message: 'Page "home" has an invalid layout at "layout[0].props.action.pageId": unknown page "missing-page".',
      },
    })
  })

  it('rejects executeOperation actions without a valid existing operationName', () => {
    expect(
      validateRuntimeConfig({
        api: {
          searchUsers: {
            method: 'GET',
            endpoint: '/api/users',
          },
        },
        pages: [
          {
            id: 'home',
            layout: [
              {
                type: 'button',
                props: {
                  label: 'Broken',
                  action: {
                    type: 'executeOperation',
                  },
                },
              },
            ],
          },
        ],
        initialPage: 'home',
      }),
    ).toEqual({
      status: 'error',
      error: {
        code: 'invalid-layout',
        displayMode: 'development-only',
        message: 'Page "home" has an invalid layout at "layout[0].props.action.operationName".',
      },
    })

    expect(
      validateRuntimeConfig({
        api: {
          searchUsers: {
            method: 'GET',
            endpoint: '/api/users',
          },
        },
        pages: [
          {
            id: 'home',
            layout: [
              {
                type: 'button',
                props: {
                  label: 'Broken',
                  action: {
                    type: 'executeOperation',
                    operationName: '   ',
                  },
                },
              },
            ],
          },
        ],
        initialPage: 'home',
      }),
    ).toEqual({
      status: 'error',
      error: {
        code: 'invalid-layout',
        displayMode: 'development-only',
        message: 'Page "home" has an invalid layout at "layout[0].props.action.operationName".',
      },
    })

    expect(
      validateRuntimeConfig({
        api: {
          searchUsers: {
            method: 'GET',
            endpoint: '/api/users',
          },
        },
        pages: [
          {
            id: 'home',
            layout: [
              {
                type: 'button',
                props: {
                  label: 'Broken',
                  action: {
                    type: 'executeOperation',
                    operationName: 'missingOperation',
                  },
                },
              },
            ],
          },
        ],
        initialPage: 'home',
      }),
    ).toEqual({
      status: 'error',
      error: {
        code: 'invalid-layout',
        displayMode: 'development-only',
        message:
          'Page "home" has an invalid layout at "layout[0].props.action.operationName": unknown operation "missingOperation".',
      },
    })
  })

  it('rejects resetForm actions without a valid non-empty formId but does not require a form catalog', () => {
    expect(
      validateRuntimeConfig(
        createConfigWithPages([
          {
            id: 'home',
            layout: [
              {
                type: 'button',
                props: {
                  label: 'Broken',
                  action: {
                    type: 'resetForm',
                  },
                },
              },
            ],
          },
        ]),
      ),
    ).toEqual({
      status: 'error',
      error: {
        code: 'invalid-layout',
        displayMode: 'development-only',
        message: 'Page "home" has an invalid layout at "layout[0].props.action.formId".',
      },
    })

    expect(
      validateRuntimeConfig(
        createConfigWithPages([
          {
            id: 'home',
            layout: [
              {
                type: 'button',
                props: {
                  label: 'Broken',
                  action: {
                    type: 'resetForm',
                    formId: '   ',
                  },
                },
              },
            ],
          },
        ]),
      ),
    ).toEqual({
      status: 'error',
      error: {
        code: 'invalid-layout',
        displayMode: 'development-only',
        message: 'Page "home" has an invalid layout at "layout[0].props.action.formId".',
      },
    })

    expect(
      validateRuntimeConfig(
        createConfigWithPages([
          {
            id: 'home',
            layout: [
              {
                type: 'button',
                props: {
                  label: 'Reset unknown form',
                  action: {
                    type: 'resetForm',
                    formId: 'form-not-in-config',
                    ignored: 'extra',
                  },
                },
              },
            ],
          },
        ]),
      ),
    ).toEqual({
      status: 'ready',
      config: {
        api: {},
        pages: [
          {
            id: 'home',
            layout: [
              {
                type: 'button',
                props: {
                  label: 'Reset unknown form',
                  action: {
                    type: 'resetForm',
                    formId: 'form-not-in-config',
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
              label: 'Reset unknown form',
              action: {
                type: 'resetForm',
                formId: 'form-not-in-config',
              },
            },
          },
        ],
      },
    })
  })

  it('accepts the form catalog with nested fields, implicit submit button and queryStateFeedback', () => {
    const result = validateRuntimeConfig(
      createConfigWithFormLayout({
        queryStateFeedback: {
          query: 'submitUserForm',
          states: {
            loading: {
              mode: 'hide',
            },
          },
        },
        children: [
          {
            type: 'heading',
            props: {
              text: 'Profile',
              level: 2,
            },
          },
          {
            type: 'container',
            children: [
              {
                type: 'input',
                queryStateFeedback: {
                  query: 'submitUserForm',
                },
                props: {
                  fieldId: 'name',
                  label: 'Name',
                  validations: {
                    required: true,
                  },
                  defaultValue: 'Ada',
                },
              },
              {
                type: 'textarea',
                queryStateFeedback: {
                  query: 'submitUserForm',
                },
                props: {
                  fieldId: 'bio',
                  label: 'Bio',
                  defaultValue: 'queries.profile.data.summary',
                },
              },
              {
                type: 'select',
                queryStateFeedback: {
                  query: 'submitUserForm',
                },
                props: {
                  fieldId: 'role',
                  label: 'Role',
                  defaultValue: 2,
                  items: [
                    { label: '', value: '' },
                    { label: 'Editor', value: 2 },
                    { label: 'Admin', value: 3 },
                  ],
                },
              },
              {
                type: 'button',
                props: {
                  label: 'Submit',
                },
              },
            ],
          },
        ],
      }),
    )

    expect(result).toEqual({
      status: 'ready',
      config: {
        api: {
          submitUserForm: {
            method: 'POST',
            endpoint: '/api/forms',
          },
        },
        pages: [
          {
            id: 'home',
            layout: [
              {
                type: 'form',
                id: 'user-form',
                queryStateFeedback: {
                  query: 'submitUserForm',
                  states: {
                    loading: {
                      mode: 'hide',
                    },
                  },
                },
                submitAction: {
                  type: 'executeOperation',
                  operationName: 'submitUserForm',
                },
                resetOnSuccess: true,
                children: [
                  {
                    type: 'heading',
                    props: {
                      text: 'Profile',
                      level: 2,
                    },
                  },
                  {
                    type: 'container',
                    children: [
                      {
                        type: 'input',
                        queryStateFeedback: {
                          query: 'submitUserForm',
                        },
                        props: {
                          fieldId: 'name',
                          label: 'Name',
                          validations: {
                            required: {
                              value: true,
                            },
                          },
                          defaultValue: 'Ada',
                        },
                      },
                      {
                        type: 'textarea',
                        queryStateFeedback: {
                          query: 'submitUserForm',
                        },
                        props: {
                          fieldId: 'bio',
                          label: 'Bio',
                          defaultValue: 'queries.profile.data.summary',
                        },
                      },
                      {
                        type: 'select',
                        queryStateFeedback: {
                          query: 'submitUserForm',
                        },
                        props: {
                          fieldId: 'role',
                          label: 'Role',
                          defaultValue: 2,
                          items: [
                            { label: '', value: '' },
                            { label: 'Editor', value: 2 },
                            { label: 'Admin', value: 3 },
                          ],
                        },
                      },
                      {
                        type: 'button',
                        props: {
                          label: 'Submit',
                        },
                      },
                    ],
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
            type: 'form',
            id: 'user-form',
            queryStateFeedback: {
              query: 'submitUserForm',
              states: {
                loading: {
                  mode: 'hide',
                },
              },
            },
            submitAction: {
              type: 'executeOperation',
              operationName: 'submitUserForm',
            },
            resetOnSuccess: true,
            children: [
              {
                type: 'heading',
                props: {
                  text: 'Profile',
                  level: 2,
                },
              },
              {
                type: 'container',
                children: [
                  {
                    type: 'input',
                    queryStateFeedback: {
                      query: 'submitUserForm',
                    },
                    props: {
                      fieldId: 'name',
                      label: 'Name',
                      validations: {
                        required: {
                          value: true,
                        },
                      },
                      defaultValue: 'Ada',
                    },
                  },
                  {
                    type: 'textarea',
                    queryStateFeedback: {
                      query: 'submitUserForm',
                    },
                    props: {
                      fieldId: 'bio',
                      label: 'Bio',
                      defaultValue: 'queries.profile.data.summary',
                    },
                  },
                  {
                    type: 'select',
                    queryStateFeedback: {
                      query: 'submitUserForm',
                    },
                    props: {
                      fieldId: 'role',
                      label: 'Role',
                      defaultValue: 2,
                      items: [
                        { label: '', value: '' },
                        { label: 'Editor', value: 2 },
                        { label: 'Admin', value: 3 },
                      ],
                    },
                  },
                  {
                    type: 'button',
                    props: {
                      label: 'Submit',
                    },
                  },
                ],
              },
            ],
          },
        ],
      },
    })
  })

  it('keeps configs without forms valid and unchanged', () => {
    const result = validateRuntimeConfig(
      createConfigWithPages([
        {
          id: 'home',
          layout: [
            {
              type: 'heading',
              props: {
                text: 'Existing runtime',
                level: 1,
              },
            },
            {
              type: 'button',
              props: {
                label: 'Open details',
                action: {
                  type: 'goBack',
                },
              },
            },
          ],
        },
      ]),
    )

    expect(result.status).toBe('ready')
    if (result.status !== 'ready') {
      throw new Error('Expected runtime config validation to succeed.')
    }

    expect(result.page.layout).toEqual([
      {
        type: 'heading',
        props: {
          text: 'Existing runtime',
          level: 1,
        },
      },
      {
        type: 'button',
        props: {
          label: 'Open details',
          action: {
            type: 'goBack',
          },
        },
      },
    ])
  })

  it('accepts validations for form fields, normalizes brief rules, and preserves declaration order', () => {
    const result = validateRuntimeConfig(
      createConfigWithFormLayout({
        children: [
          {
            type: 'input',
            props: {
              fieldId: 'name',
              label: 'Name',
              validations: {
                maxLength: { value: 20, message: 'Too long' },
                required: true,
                minLength: 3,
              },
            },
          },
          {
            type: 'textarea',
            props: {
              fieldId: 'bio',
              label: 'Bio',
              validations: {
                minLength: { value: 10 },
                maxLength: 200,
              },
            },
          },
          {
            type: 'input',
            props: {
              fieldId: 'age',
              label: 'Age',
              inputType: 'number',
              validations: {
                min: 18,
                max: { value: 99, message: 'Too old' },
              },
            },
          },
          {
            type: 'select',
            props: {
              fieldId: 'tags',
              label: 'Tags',
              multiple: true,
              items: [
                { label: 'Alpha', value: 'alpha' },
                { label: 'Beta', value: 'beta' },
              ],
              validations: {
                minSelections: 1,
                maxSelections: { value: 2, message: 'Too many' },
              },
            },
          },
          {
            type: 'radioGroup',
            props: {
              fieldId: 'role',
              label: 'Role',
              items: [
                { label: 'Admin', value: 'admin' },
                { label: 'Editor', value: 'editor' },
              ],
              validations: {
                required: { value: true, message: 'Pick one' },
              },
            },
          },
          {
            type: 'checkboxGroup',
            props: {
              fieldId: 'scopes',
              label: 'Scopes',
              items: [
                { label: 'Read', value: 'read' },
                { label: 'Write', value: 'write' },
              ],
              validations: {
                required: true,
                minSelections: 1,
                maxSelections: 2,
              },
            },
          },
          {
            type: 'button',
            props: {
              label: 'Submit',
            },
          },
        ],
      }),
    )

    expect(result.status).toBe('ready')
    if (result.status !== 'ready') {
      throw new Error('Expected runtime config validation to succeed.')
    }

    const inputNode = result.page.layout[0]
    if (inputNode.type !== 'form') {
      throw new Error('Expected a form layout node.')
    }

    const normalizedField = inputNode.children?.[0]
    expect(normalizedField).toMatchObject({
      type: 'input',
      props: {
        fieldId: 'name',
        validations: {
          maxLength: { value: 20, message: 'Too long' },
          required: { value: true },
          minLength: { value: 3 },
        },
      },
    })
    expect(Object.keys((normalizedField as Extract<(typeof normalizedField), { props: { validations: object } }>).props.validations)).toEqual([
      'maxLength',
      'required',
      'minLength',
    ])
  })

  it('rejects legacy required props, invalid validation shapes, incompatible rules, and contradictory ranges', () => {
    expect(
      validateRuntimeConfig(
        createConfigWithFormLayout({
          children: [
            {
              type: 'input',
              props: {
                fieldId: 'name',
                label: 'Name',
                required: true,
              },
            },
          ],
        }),
      ),
    ).toEqual({
      status: 'error',
      error: {
        code: 'invalid-layout',
        displayMode: 'development-only',
        message: 'Page "home" has an invalid layout at "layout[0].children[0].props.required": use props.validations.required instead.',
      },
    })

    expect(
      validateRuntimeConfig(
        createConfigWithFormLayout({
          children: [
            {
              type: 'input',
              props: {
                fieldId: 'name',
                label: 'Name',
                validations: {
                  required: false,
                },
              },
            },
          ],
        }),
      ),
    ).toEqual({
      status: 'error',
      error: {
        code: 'invalid-layout',
        displayMode: 'development-only',
        message: 'Page "home" has an invalid layout at "layout[0].children[0].props.validations.required".',
      },
    })

    expect(
      validateRuntimeConfig(
        createConfigWithFormLayout({
          children: [
            {
              type: 'textarea',
              props: {
                fieldId: 'bio',
                label: 'Bio',
                validations: {
                  min: 2,
                },
              },
            },
          ],
        }),
      ),
    ).toEqual({
      status: 'error',
      error: {
        code: 'invalid-layout',
        displayMode: 'development-only',
        message: 'Page "home" has an invalid layout at "layout[0].children[0].props.validations.min".',
      },
    })

    expect(
      validateRuntimeConfig(
        createConfigWithFormLayout({
          children: [
            {
              type: 'radioGroup',
              props: {
                fieldId: 'role',
                label: 'Role',
                items: [{ label: 'Admin', value: 'admin' }],
                validations: {
                  maxSelections: 1,
                },
              },
            },
          ],
        }),
      ),
    ).toEqual({
      status: 'error',
      error: {
        code: 'invalid-layout',
        displayMode: 'development-only',
        message: 'Page "home" has an invalid layout at "layout[0].children[0].props.validations.maxSelections".',
      },
    })

    expect(
      validateRuntimeConfig(
        createConfigWithFormLayout({
          children: [
            {
              type: 'input',
              props: {
                fieldId: 'age',
                label: 'Age',
                inputType: 'number',
                validations: {
                  min: -1,
                },
              },
            },
          ],
        }),
      ),
    ).toEqual({
      status: 'error',
      error: {
        code: 'invalid-layout',
        displayMode: 'development-only',
        message: 'Page "home" has an invalid layout at "layout[0].children[0].props.validations.min".',
      },
    })

    expect(
      validateRuntimeConfig(
        createConfigWithFormLayout({
          children: [
            {
              type: 'checkboxGroup',
              props: {
                fieldId: 'scopes',
                label: 'Scopes',
                items: [{ label: 'Read', value: 'read' }],
                validations: {
                  minSelections: 2,
                  maxSelections: 1,
                },
              },
            },
          ],
        }),
      ),
    ).toEqual({
      status: 'error',
      error: {
        code: 'invalid-layout',
        displayMode: 'development-only',
        message: 'Page "home" has an invalid layout at "layout[0].children[0].props.validations": minSelections cannot be greater than maxSelections.',
      },
    })
  })

  it('rejects form fields outside a form subtree and accepts them under containers inside a form', () => {
    expect(
      validateRuntimeConfig(
        createConfigWithPages([
          {
            id: 'home',
            layout: [
              {
                type: 'container',
                children: [
                  {
                    type: 'input',
                    props: {
                      fieldId: 'name',
                      label: 'Name',
                    },
                  },
                ],
              },
            ],
          },
        ]),
      ),
    ).toEqual({
      status: 'error',
      error: {
        code: 'invalid-layout',
        displayMode: 'development-only',
        message: 'Page "home" has an invalid layout at "layout[0].children[0]": input nodes must be descendants of a form node.',
      },
    })

    expect(
      validateRuntimeConfig(
        createConfigWithPages([
          {
            id: 'home',
            layout: [
              {
                type: 'textarea',
                props: {
                  fieldId: 'bio',
                  label: 'Bio',
                },
              },
            ],
          },
        ]),
      ),
    ).toEqual({
      status: 'error',
      error: {
        code: 'invalid-layout',
        displayMode: 'development-only',
        message: 'Page "home" has an invalid layout at "layout[0]": textarea nodes must be descendants of a form node.',
      },
    })

    expect(
      validateRuntimeConfig(
        createConfigWithPages([
          {
            id: 'home',
            layout: [
              {
                type: 'select',
                props: {
                  fieldId: 'role',
                  label: 'Role',
                  items: [{ label: 'Admin', value: 'admin' }],
                },
              },
            ],
          },
        ]),
      ),
    ).toEqual({
      status: 'error',
      error: {
        code: 'invalid-layout',
        displayMode: 'development-only',
        message: 'Page "home" has an invalid layout at "layout[0]": select nodes must be descendants of a form node.',
      },
    })

    expect(validateRuntimeConfig(createConfigWithFormLayout()).status).toBe('ready')
  })

  it('rejects implicit submit buttons outside a form subtree and keeps explicit button actions valid', () => {
    expect(
      validateRuntimeConfig(
        createConfigWithPages([
          {
            id: 'home',
            layout: [
              {
                type: 'button',
                props: {
                  label: 'Broken submit',
                },
              },
            ],
          },
        ]),
      ),
    ).toEqual({
      status: 'error',
      error: {
        code: 'invalid-layout',
        displayMode: 'development-only',
        message: 'Page "home" has an invalid layout at "layout[0]": button nodes without an action must be descendants of a form node.',
      },
    })

    expect(
      validateRuntimeConfig(
        createConfigWithPages([
          {
            id: 'home',
            layout: [
              {
                type: 'container',
                children: [
                  {
                    type: 'button',
                    props: {
                      label: 'Still broken',
                    },
                  },
                ],
              },
            ],
          },
        ]),
      ),
    ).toEqual({
      status: 'error',
      error: {
        code: 'invalid-layout',
        displayMode: 'development-only',
        message:
          'Page "home" has an invalid layout at "layout[0].children[0]": button nodes without an action must be descendants of a form node.',
      },
    })

    expect(
      validateRuntimeConfig(
        createConfigWithPages([
          {
            id: 'home',
            layout: [
              {
                type: 'button',
                props: {
                  label: 'Go back',
                  action: {
                    type: 'goBack',
                  },
                },
              },
            ],
          },
        ]),
      ).status,
    ).toBe('ready')
  })

  it('rejects duplicate form ids and duplicate field ids within the same form', () => {
    expect(
      validateRuntimeConfig({
        api: {
          submitUserForm: {
            method: 'POST',
            endpoint: '/api/forms',
          },
        },
        pages: [
          {
            id: 'home',
            layout: [createFormNode()],
          },
          {
            id: 'details',
            layout: [createFormNode()],
          },
        ],
        initialPage: 'home',
      }),
    ).toEqual({
      status: 'error',
      error: {
        code: 'invalid-layout',
        displayMode: 'development-only',
        message: 'Page "details" has an invalid layout at "layout[0].id": duplicate form id "user-form".',
      },
    })

    expect(
      validateRuntimeConfig(
        createConfigWithFormLayout({
          children: [
            {
              type: 'input',
              props: {
                fieldId: 'email',
                label: 'Email',
              },
            },
            {
              type: 'container',
              children: [
                {
                  type: 'textarea',
                  props: {
                    fieldId: 'email',
                    label: 'Email duplicate',
                  },
                },
              ],
            },
          ],
        }),
      ),
    ).toEqual({
      status: 'error',
      error: {
        code: 'invalid-layout',
        displayMode: 'development-only',
        message: 'Page "home" has an invalid layout at "layout[0].children[1].children[0].props.fieldId": duplicate fieldId "email" in form "user-form".',
      },
    })
  })

  it('rejects unsupported form children and invalid submitAction or resetOnSuccess semantics', () => {
    expect(
      validateRuntimeConfig(
        createConfigWithFormLayout({
          children: [
            {
              type: 'list',
              props: {
                items: ['broken'],
              },
            },
          ],
        }),
      ),
    ).toEqual({
      status: 'error',
      error: {
        code: 'invalid-layout',
        displayMode: 'development-only',
        message:
          'Page "home" has an invalid layout at "layout[0].children[0]": form nodes only accept input, textarea, select, radioGroup, checkboxGroup, button, heading, paragraph, image, table and container descendants.',
      },
    })

    expect(
      validateRuntimeConfig(
        createConfigWithFormLayout({
          children: [
            {
              type: 'repeater',
              props: {
                items: {
                  source: 'queries.posts.data.results',
                  key: 'id',
                },
                template: [
                  {
                    type: 'input',
                    props: {
                      fieldId: 'title',
                      label: 'Title',
                    },
                  },
                ],
              },
            },
          ],
        }),
      ),
    ).toEqual({
      status: 'error',
      error: {
        code: 'invalid-layout',
        displayMode: 'development-only',
        message:
          'Page "home" has an invalid layout at "layout[0].children[0]": form nodes only accept input, textarea, select, radioGroup, checkboxGroup, button, heading, paragraph, image, table and container descendants.',
        },
      })

    expect(
      validateRuntimeConfig({
        api: {
          submitUserForm: {
            method: 'POST',
            endpoint: '/api/forms',
          },
        },
        pages: [
          {
            id: 'home',
            layout: [
              {
                type: 'form',
                id: 'user-form',
                submitAction: {
                  type: 'goBack',
                },
                children: [],
              },
            ],
          },
        ],
        initialPage: 'home',
      }),
    ).toEqual({
      status: 'error',
      error: {
        code: 'invalid-layout',
        displayMode: 'development-only',
        message: 'Page "home" has an invalid layout at "layout[0].submitAction.type".',
      },
    })

    expect(
      validateRuntimeConfig(
        createConfigWithFormLayout({
          submitAction: {
            type: 'executeOperation',
            operationName: 'missingOperation',
          },
        }),
      ),
    ).toEqual({
      status: 'error',
      error: {
        code: 'invalid-layout',
        displayMode: 'development-only',
        message: 'Page "home" has an invalid layout at "layout[0].submitAction.operationName": unknown operation "missingOperation".',
      },
    })

    expect(
      validateRuntimeConfig(
        createConfigWithFormLayout({
          children: [
            {
              type: 'button',
              props: {
                label: 'Broken auxiliary navigation',
                action: {
                  type: 'navigateTo',
                  pageId: 'missingPage',
                },
              },
            },
          ],
        }),
      ),
    ).toEqual({
      status: 'error',
      error: {
        code: 'invalid-layout',
        displayMode: 'development-only',
        message: 'Page "home" has an invalid layout at "layout[0].children[0].props.action.pageId": unknown page "missingPage".',
      },
    })

    expect(
      validateRuntimeConfig(
        createConfigWithFormLayout({
          children: [
            {
              type: 'container',
              children: [
                {
                  type: 'button',
                  props: {
                    label: 'Broken nested auxiliary submit',
                    action: {
                      type: 'executeOperation',
                      operationName: 'missingNestedOperation',
                    },
                  },
                },
              ],
            },
          ],
        }),
      ),
    ).toEqual({
      status: 'error',
      error: {
        code: 'invalid-layout',
        displayMode: 'development-only',
        message:
          'Page "home" has an invalid layout at "layout[0].children[0].children[0].props.action.operationName": unknown operation "missingNestedOperation".',
      },
    })

    expect(
      validateRuntimeConfig({
        api: {},
        pages: [
          {
            id: 'home',
            layout: [
              {
                type: 'form',
                id: 'user-form',
                resetOnSuccess: true,
                children: [],
              },
            ],
          },
        ],
        initialPage: 'home',
      }),
    ).toEqual({
      status: 'error',
      error: {
        code: 'invalid-layout',
        displayMode: 'development-only',
        message: 'Page "home" has an invalid layout at "layout[0].resetOnSuccess": resetOnSuccess requires submitAction.',
      },
    })
  })

  it('accepts form.persistOnUnmount as an optional boolean without changing historical form semantics', () => {
    expect(validateRuntimeConfig(createConfigWithFormLayout()).status).toBe('ready')

    expect(
      validateRuntimeConfig(createConfigWithFormLayout({
        persistOnUnmount: true,
      })),
    ).toEqual({
      status: 'ready',
      config: {
        api: {
          submitUserForm: {
            method: 'POST',
            endpoint: '/api/forms',
          },
        },
        pages: [
          {
            id: 'home',
            layout: [
              {
                type: 'form',
                id: 'user-form',
                persistOnUnmount: true,
                submitAction: {
                  type: 'executeOperation',
                  operationName: 'submitUserForm',
                },
                resetOnSuccess: true,
                children: [
                  {
                    type: 'input',
                    props: {
                      fieldId: 'name',
                      label: 'Name',
                      defaultValue: 'Ada',
                    },
                  },
                  {
                    type: 'container',
                    children: [
                      {
                        type: 'textarea',
                        props: {
                          fieldId: 'bio',
                          label: 'Bio',
                          defaultValue: 'Runtime builder',
                        },
                      },
                      {
                        type: 'select',
                        props: {
                          fieldId: 'role',
                          label: 'Role',
                          defaultValue: 'admin',
                          items: [
                            { label: 'Admin', value: 'admin' },
                            { label: 'Editor', value: 'editor' },
                          ],
                        },
                      },
                      {
                        type: 'button',
                        props: {
                          label: 'Submit',
                        },
                      },
                    ],
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
            type: 'form',
            id: 'user-form',
            persistOnUnmount: true,
            submitAction: {
              type: 'executeOperation',
              operationName: 'submitUserForm',
            },
            resetOnSuccess: true,
            children: [
              {
                type: 'input',
                props: {
                  fieldId: 'name',
                  label: 'Name',
                  defaultValue: 'Ada',
                },
              },
              {
                type: 'container',
                children: [
                  {
                    type: 'textarea',
                    props: {
                      fieldId: 'bio',
                      label: 'Bio',
                      defaultValue: 'Runtime builder',
                    },
                  },
                  {
                    type: 'select',
                    props: {
                      fieldId: 'role',
                      label: 'Role',
                      defaultValue: 'admin',
                      items: [
                        { label: 'Admin', value: 'admin' },
                        { label: 'Editor', value: 'editor' },
                      ],
                    },
                  },
                  {
                    type: 'button',
                    props: {
                      label: 'Submit',
                    },
                  },
                ],
              },
            ],
          },
        ],
      },
    })

    expect(
      validateRuntimeConfig(createConfigWithFormLayout({
        persistOnUnmount: false,
      })),
    ).toEqual({
      status: 'ready',
      config: {
        api: {
          submitUserForm: {
            method: 'POST',
            endpoint: '/api/forms',
          },
        },
        pages: [
          {
            id: 'home',
            layout: [
              {
                type: 'form',
                id: 'user-form',
                persistOnUnmount: false,
                submitAction: {
                  type: 'executeOperation',
                  operationName: 'submitUserForm',
                },
                resetOnSuccess: true,
                children: [
                  {
                    type: 'input',
                    props: {
                      fieldId: 'name',
                      label: 'Name',
                      defaultValue: 'Ada',
                    },
                  },
                  {
                    type: 'container',
                    children: [
                      {
                        type: 'textarea',
                        props: {
                          fieldId: 'bio',
                          label: 'Bio',
                          defaultValue: 'Runtime builder',
                        },
                      },
                      {
                        type: 'select',
                        props: {
                          fieldId: 'role',
                          label: 'Role',
                          defaultValue: 'admin',
                          items: [
                            { label: 'Admin', value: 'admin' },
                            { label: 'Editor', value: 'editor' },
                          ],
                        },
                      },
                      {
                        type: 'button',
                        props: {
                          label: 'Submit',
                        },
                      },
                    ],
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
            type: 'form',
            id: 'user-form',
            persistOnUnmount: false,
            submitAction: {
              type: 'executeOperation',
              operationName: 'submitUserForm',
            },
            resetOnSuccess: true,
            children: [
              {
                type: 'input',
                props: {
                  fieldId: 'name',
                  label: 'Name',
                  defaultValue: 'Ada',
                },
              },
              {
                type: 'container',
                children: [
                  {
                    type: 'textarea',
                    props: {
                      fieldId: 'bio',
                      label: 'Bio',
                      defaultValue: 'Runtime builder',
                    },
                  },
                  {
                    type: 'select',
                    props: {
                      fieldId: 'role',
                      label: 'Role',
                      defaultValue: 'admin',
                      items: [
                        { label: 'Admin', value: 'admin' },
                        { label: 'Editor', value: 'editor' },
                      ],
                    },
                  },
                  {
                    type: 'button',
                    props: {
                      label: 'Submit',
                    },
                  },
                ],
              },
            ],
          },
        ],
      },
    })
  })

  it.each([
    ['persist', 'yes'],
    ['persist', 1],
    ['persist', ['yes']],
    ['persist', { keep: true }],
  ])('rejects non-boolean values for form.persistOnUnmount: %s=%j', (_label, persistOnUnmount) => {
    expect(
      validateRuntimeConfig(createConfigWithFormLayout({
        persistOnUnmount,
      })),
    ).toEqual({
      status: 'error',
      error: {
        code: 'invalid-layout',
        displayMode: 'development-only',
        message: 'Page "home" has an invalid layout at "layout[0].persistOnUnmount".',
      },
    })
  })

  it('rejects select items with heterogeneous value types', () => {
    expect(
      validateRuntimeConfig(
        createConfigWithFormLayout({
          children: [
            {
              type: 'select',
              props: {
                fieldId: 'role',
                label: 'Role',
                items: [
                  { label: 'Admin', value: 'admin' },
                  { label: 'Editor', value: 2 },
                ],
              },
            },
          ],
        }),
      ),
    ).toEqual({
      status: 'error',
      error: {
        code: 'invalid-layout',
        displayMode: 'development-only',
        message:
          'Page "home" has an invalid layout at "layout[0].children[0].props.items": select item values must all be strings or all be numbers.',
      },
    })
  })

  describe('multi-value collection sources contract', () => {
    it('keeps historical manual list and select items valid and unchanged', () => {
      const result = validateRuntimeConfig(
        createConfigWithFormLayout({
          children: [
            {
              type: 'select',
              props: {
                fieldId: 'role',
                label: 'Role',
                defaultValue: 'admin',
                items: [
                  { label: 'Admin', value: 'admin' },
                  { label: 'Editor', value: 'editor' },
                ],
              },
            },
          ],
        }, {
          extraPages: [
            {
              id: 'catalog',
              layout: [
                {
                  type: 'list',
                  props: {
                    items: ['One', 'Two'],
                  },
                },
              ],
            },
          ],
        }),
      )

      if (result.status !== 'ready') {
        throw new Error('Expected ready result')
      }

      expect(result.page.layout).toEqual([
        {
          type: 'form',
          id: 'user-form',
          submitAction: {
            type: 'executeOperation',
            operationName: 'submitUserForm',
          },
          resetOnSuccess: true,
          children: [
            {
              type: 'select',
              props: {
                fieldId: 'role',
                label: 'Role',
                defaultValue: 'admin',
                items: [
                  { label: 'Admin', value: 'admin' },
                  { label: 'Editor', value: 'editor' },
                ],
              },
            },
          ],
        },
      ])

      expect(result.config.pages[1].layout).toEqual([
        {
          type: 'list',
          props: {
            items: ['One', 'Two'],
          },
        },
      ])
    })

    it('accepts dynamic list and select sources under queries.*.data and queries.*.data.*', () => {
      const result = validateRuntimeConfig(
        createConfigWithFormLayout({
          children: [
            {
              type: 'select',
              props: {
                fieldId: 'role',
                label: 'Role',
                items: {
                  source: 'queries.searchUsers.data',
                  itemType: 'scalar',
                },
              },
            },
          ],
        }, {
          extraPages: [
            {
              id: 'catalog',
              layout: [
                {
                  type: 'list',
                  props: {
                    items: {
                      source: 'queries.searchUsers.data.results',
                      itemType: 'scalar',
                    },
                  },
                },
              ],
            },
          ],
        }),
      )

      if (result.status !== 'ready') {
        throw new Error('Expected ready result')
      }

      expect(result.config.pages).toEqual([
        {
          id: 'home',
          layout: [
            {
              type: 'form',
              id: 'user-form',
              submitAction: {
                type: 'executeOperation',
                operationName: 'submitUserForm',
              },
              resetOnSuccess: true,
              children: [
                {
                  type: 'select',
                  props: {
                    fieldId: 'role',
                    label: 'Role',
                    items: {
                      source: 'queries.searchUsers.data',
                      itemType: 'scalar',
                    },
                  },
                },
              ],
            },
          ],
        },
        {
          id: 'catalog',
          layout: [
            {
              type: 'list',
              props: {
                items: {
                  source: 'queries.searchUsers.data.results',
                  itemType: 'scalar',
                },
              },
            },
          ],
        },
      ])
    })

    it('accepts object collection shapes when they declare the required consumer mappings', () => {
      const result = validateRuntimeConfig(
        createConfigWithFormLayout({
          children: [
            {
              type: 'select',
              props: {
                fieldId: 'role',
                label: 'Role',
                items: {
                  values: [
                    { id: 'admin', name: 'Admin', ignored: true },
                    { id: 'editor', name: 'Editor' },
                  ],
                  label: 'name',
                  value: 'id',
                  extra: 'drop-me',
                },
              },
            },
          ],
        }, {
          extraPages: [
            {
              id: 'catalog',
              layout: [
                {
                  type: 'list',
                  props: {
                    items: {
                      values: [
                        { name: 'Ada', ignored: true },
                        { name: 'Grace' },
                      ],
                      itemText: 'name',
                      extra: 'drop-me',
                    },
                  },
                },
              ],
            },
          ],
        }),
      )

      if (result.status !== 'ready') {
        throw new Error('Expected ready result')
      }

      expect(result.config.pages[0].layout[0]).toEqual({
        type: 'form',
        id: 'user-form',
        submitAction: {
          type: 'executeOperation',
          operationName: 'submitUserForm',
        },
        resetOnSuccess: true,
        children: [
          {
            type: 'select',
            props: {
              fieldId: 'role',
              label: 'Role',
              items: {
                values: [
                  { id: 'admin', name: 'Admin', ignored: true },
                  { id: 'editor', name: 'Editor' },
                ],
                label: 'name',
                value: 'id',
              },
            },
          },
        ],
      })

      expect(result.config.pages[1].layout[0]).toEqual({
        type: 'list',
        props: {
          items: {
            values: [
              { name: 'Ada', ignored: true },
              { name: 'Grace' },
            ],
            itemText: 'name',
          },
        },
      })
    })

    it('rejects manual object collections when required mappings are missing', () => {
      expect(
        validateRuntimeConfig(
          createConfigWithPages([
            {
              id: 'home',
              layout: [
                {
                  type: 'list',
                  props: {
                    items: {
                      values: [{ name: 'Ada' }],
                    },
                  },
                },
              ],
            },
          ]),
        ),
      ).toEqual({
        status: 'error',
        error: {
          code: 'invalid-layout',
          displayMode: 'development-only',
          message: 'Page "home" has an invalid layout at "layout[0].props.items.itemText".',
        },
      })

      expect(
        validateRuntimeConfig(
          createConfigWithFormLayout({
            children: [
              {
                type: 'select',
                props: {
                  fieldId: 'role',
                  label: 'Role',
                  items: {
                    values: [{ id: 'admin', name: 'Admin' }],
                    label: 'name',
                  },
                },
              },
            ],
          }),
        ),
      ).toEqual({
        status: 'error',
        error: {
          code: 'invalid-layout',
          displayMode: 'development-only',
          message: 'Page "home" has an invalid layout at "layout[0].children[0].props.items.value".',
        },
      })
    })

    it('rejects ambiguous list and select collection source shapes', () => {
      expect(
        validateRuntimeConfig(
          createConfigWithPages([
            {
              id: 'home',
              layout: [
                {
                  type: 'list',
                  props: {
                    items: {
                      source: 'queries.searchUsers.data.results',
                      values: ['Ada'],
                    },
                  },
                },
              ],
            },
          ]),
        ),
      ).toEqual({
        status: 'error',
        error: {
          code: 'invalid-layout',
          displayMode: 'development-only',
          message: 'Page "home" has an invalid layout at "layout[0].props.items".',
        },
      })

      expect(
        validateRuntimeConfig(
          createConfigWithFormLayout({
            children: [
              {
                type: 'select',
                props: {
                  fieldId: 'role',
                  label: 'Role',
                  items: {
                    source: 'queries.searchUsers.data.results',
                    values: ['admin'],
                  },
                },
              },
            ],
          }),
        ),
      ).toEqual({
        status: 'error',
        error: {
          code: 'invalid-layout',
          displayMode: 'development-only',
          message: 'Page "home" has an invalid layout at "layout[0].children[0].props.items".',
        },
      })
    })

    it('rejects dynamic sources outside queries.*.data.* with canonical paths', () => {
      expect(
        validateRuntimeConfig(
          createConfigWithPages([
            {
              id: 'home',
              layout: [
                {
                  type: 'list',
                  props: {
                    items: {
                      source: 'forms.user.role',
                    },
                  },
                },
              ],
            },
          ]),
        ),
      ).toEqual({
        status: 'error',
        error: {
          code: 'invalid-layout',
          displayMode: 'development-only',
          message: 'Page "home" has an invalid layout at "layout[0].props.items.source": collection sources must use queries.{queryName}.data, queries.{queryName}.data.* or item.*.',
        },
      })

      expect(
        validateRuntimeConfig(
          createConfigWithFormLayout({
            children: [
              {
                type: 'select',
                props: {
                  fieldId: 'role',
                  label: 'Role',
                  items: {
                    source: 'queries.searchUsers',
                  },
                },
              },
            ],
          }),
        ),
      ).toEqual({
        status: 'error',
        error: {
          code: 'invalid-layout',
          displayMode: 'development-only',
          message: 'Page "home" has an invalid layout at "layout[0].children[0].props.items.source": collection sources must use queries.{queryName}.data, queries.{queryName}.data.* or item.*.',
        },
      })
    })

    it('rejects malformed dynamic collection sources even when they start with queries.*.data', () => {
      expect(
        validateRuntimeConfig(
          createConfigWithPages([
            {
              id: 'home',
              layout: [
                {
                  type: 'list',
                  props: {
                    items: {
                      source: 'queries.searchUsers.data..results',
                      itemType: 'scalar',
                    },
                  },
                },
              ],
            },
          ]),
        ),
      ).toEqual({
        status: 'error',
        error: {
          code: 'invalid-layout',
          displayMode: 'development-only',
          message: 'Page "home" has an invalid layout at "layout[0].props.items.source": collection sources must use queries.{queryName}.data, queries.{queryName}.data.* or item.*.',
        },
      })

      expect(
        validateRuntimeConfig(
          createConfigWithFormLayout({
            children: [
              {
                type: 'select',
                props: {
                  fieldId: 'role',
                  label: 'Role',
                  items: {
                    source: 'queries.searchUsers.data.results[0]',
                    itemType: 'scalar',
                  },
                },
              },
            ],
          }),
        ),
      ).toEqual({
        status: 'error',
        error: {
          code: 'invalid-layout',
          displayMode: 'development-only',
          message: 'Page "home" has an invalid layout at "layout[0].children[0].props.items.source": collection sources must use queries.{queryName}.data, queries.{queryName}.data.* or item.*.',
        },
      })
    })

    it('rejects malformed relative mapping paths for collection objects', () => {
      expect(
        validateRuntimeConfig(
          createConfigWithPages([
            {
              id: 'home',
              layout: [
                {
                  type: 'list',
                  props: {
                    items: {
                      values: [{ profile: { name: 'Ada' } }],
                      itemText: 'profile..name',
                    },
                  },
                },
              ],
            },
          ]),
        ),
      ).toEqual({
        status: 'error',
        error: {
          code: 'invalid-layout',
          displayMode: 'development-only',
          message: 'Page "home" has an invalid layout at "layout[0].props.items.itemText".',
        },
      })

      expect(
        validateRuntimeConfig(
          createConfigWithFormLayout({
            children: [
              {
                type: 'select',
                props: {
                  fieldId: 'role',
                  label: 'Role',
                  items: {
                    values: [{ id: 'admin', profile: { name: 'Admin' } }],
                    label: 'profile.name',
                    value: 'profile[id]',
                  },
                },
              },
            ],
          }),
        ),
      ).toEqual({
        status: 'error',
        error: {
          code: 'invalid-layout',
          displayMode: 'development-only',
          message: 'Page "home" has an invalid layout at "layout[0].children[0].props.items.value".',
        },
      })
    })

    it('rejects dynamic collection sources that omit both the scalar discriminator and object mappings', () => {
      expect(
        validateRuntimeConfig(
          createConfigWithPages([
            {
              id: 'home',
              layout: [
                {
                  type: 'list',
                  props: {
                    items: {
                      source: 'queries.searchUsers.data.results',
                    },
                  },
                },
              ],
            },
          ]),
        ),
      ).toEqual({
        status: 'error',
        error: {
          code: 'invalid-layout',
          displayMode: 'development-only',
          message:
            'Page "home" has an invalid layout at "layout[0].props.items": dynamic scalar collections must declare itemType: "scalar", and dynamic object collections must declare itemText.',
        },
      })

      expect(
        validateRuntimeConfig(
          createConfigWithFormLayout({
            children: [
              {
                type: 'select',
                props: {
                  fieldId: 'role',
                  label: 'Role',
                  items: {
                    source: 'queries.searchUsers.data.results',
                  },
                },
              },
            ],
          }),
        ),
      ).toEqual({
        status: 'error',
        error: {
          code: 'invalid-layout',
          displayMode: 'development-only',
          message:
            'Page "home" has an invalid layout at "layout[0].children[0].props.items": dynamic scalar collections must declare itemType: "scalar", and dynamic object collections must declare label and value.',
        },
      })
    })

    it('rejects manual select values with heterogeneous scalar types in the new collection shape', () => {
      expect(
        validateRuntimeConfig(
          createConfigWithFormLayout({
            children: [
              {
                type: 'select',
                props: {
                  fieldId: 'role',
                  label: 'Role',
                  items: {
                    values: ['admin', 2],
                  },
                },
              },
            ],
          }),
        ),
      ).toEqual({
        status: 'error',
        error: {
          code: 'invalid-layout',
          displayMode: 'development-only',
          message:
            'Page "home" has an invalid layout at "layout[0].children[0].props.items.values": select item values must all be strings or all be numbers.',
        },
      })
    })

    it('rejects manual object select collections with heterogeneous projected value types', () => {
      expect(
        validateRuntimeConfig(
          createConfigWithFormLayout({
            children: [
              {
                type: 'select',
                props: {
                  fieldId: 'role',
                  label: 'Role',
                  items: {
                    values: [
                      { id: 'admin', name: 'Admin' },
                      { id: 2, name: 'Editor' },
                    ],
                    label: 'name',
                    value: 'id',
                  },
                },
              },
            ],
          }),
        ),
      ).toEqual({
        status: 'error',
        error: {
          code: 'invalid-layout',
          displayMode: 'development-only',
          message:
            'Page "home" has an invalid layout at "layout[0].children[0].props.items.values": select item values must all be strings or all be numbers.',
        },
      })
    })
  })

  describe('reusable form field expansion contract', () => {
    it('accepts the expanded inputType catalog', () => {
      const result = validateRuntimeConfig(
        createConfigWithFormLayout({
          children: [
            {
              type: 'input',
              props: {
                fieldId: 'age',
                label: 'Age',
                inputType: 'number',
              },
            },
            {
              type: 'input',
              props: {
                fieldId: 'birthDate',
                label: 'Birth date',
                inputType: 'date',
              },
            },
            {
              type: 'input',
              props: {
                fieldId: 'appointmentAt',
                label: 'Appointment',
                inputType: 'datetime-local',
              },
            },
          ],
        }),
      )

      expect(result.status).toBe('ready')
    })

    it('accepts radioGroup and checkboxGroup as form descendants, including nested containers', () => {
      const result = validateRuntimeConfig(
        createConfigWithFormLayout({
          children: [
            {
              type: 'container',
              children: [
                {
                  type: 'radioGroup',
                  props: {
                    fieldId: 'role',
                    label: 'Role',
                    items: [
                      { label: 'Admin', value: 'admin' },
                      { label: 'Editor', value: 'editor' },
                    ],
                  },
                },
                {
                  type: 'checkboxGroup',
                  props: {
                    fieldId: 'scopes',
                    label: 'Scopes',
                    defaultValue: ['read', 'write'],
                    items: {
                      values: ['read', 'write', 'publish'],
                    },
                  },
                },
              ],
            },
          ],
        }),
      )

      expect(result).toEqual({
        status: 'ready',
        config: {
          api: {
            submitUserForm: {
              method: 'POST',
              endpoint: '/api/forms',
            },
          },
          pages: [
            {
              id: 'home',
              layout: [
                {
                  type: 'form',
                  id: 'user-form',
                  submitAction: {
                    type: 'executeOperation',
                    operationName: 'submitUserForm',
                  },
                  resetOnSuccess: true,
                  children: [
                    {
                      type: 'container',
                      children: [
                        {
                          type: 'radioGroup',
                          props: {
                            fieldId: 'role',
                            label: 'Role',
                            items: [
                              { label: 'Admin', value: 'admin' },
                              { label: 'Editor', value: 'editor' },
                            ],
                          },
                        },
                        {
                          type: 'checkboxGroup',
                          props: {
                            fieldId: 'scopes',
                            label: 'Scopes',
                            defaultValue: ['read', 'write'],
                            items: {
                              values: ['read', 'write', 'publish'],
                            },
                          },
                        },
                      ],
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
              type: 'form',
              id: 'user-form',
              submitAction: {
                type: 'executeOperation',
                operationName: 'submitUserForm',
              },
              resetOnSuccess: true,
              children: [
                {
                  type: 'container',
                  children: [
                    {
                      type: 'radioGroup',
                      props: {
                        fieldId: 'role',
                        label: 'Role',
                        items: [
                          { label: 'Admin', value: 'admin' },
                          { label: 'Editor', value: 'editor' },
                        ],
                      },
                    },
                    {
                      type: 'checkboxGroup',
                      props: {
                        fieldId: 'scopes',
                        label: 'Scopes',
                        defaultValue: ['read', 'write'],
                        items: {
                          values: ['read', 'write', 'publish'],
                        },
                      },
                    },
                  ],
                },
              ],
            },
          ],
        },
      })
    })

    it('accepts supported optionLayout values for radioGroup and checkboxGroup and preserves omission as the vertical default', () => {
      const result = validateRuntimeConfig(
        createConfigWithFormLayout({
          children: [
            {
              type: 'radioGroup',
              props: {
                fieldId: 'role',
                label: 'Role',
                optionLayout: 'inline',
                defaultValue: 'admin',
                items: [
                  { label: 'Admin', value: 'admin' },
                  { label: 'Editor', value: 'editor' },
                ],
                validations: {
                  required: true,
                },
              },
            },
            {
              type: 'checkboxGroup',
              props: {
                fieldId: 'scopes',
                label: 'Scopes',
                optionLayout: 'vertical',
                defaultValue: ['read'],
                items: {
                  values: ['read', 'write', 'publish'],
                },
                validations: {
                  minSelections: 1,
                },
              },
            },
            {
              type: 'checkboxGroup',
              props: {
                fieldId: 'secondary-scopes',
                label: 'Secondary scopes',
                items: {
                  values: ['read', 'write'],
                },
              },
            },
          ],
        }),
      )

      expect(result.status).toBe('ready')
      if (result.status !== 'ready') {
        throw new Error('Expected runtime config validation to succeed.')
      }

      const formNode = result.page.layout[0]
      if (formNode.type !== 'form') {
        throw new Error('Expected a form layout node.')
      }

      expect(formNode.children).toMatchObject([
        {
          type: 'radioGroup',
          props: {
            fieldId: 'role',
            optionLayout: 'inline',
            defaultValue: 'admin',
            validations: {
              required: { value: true },
            },
          },
        },
        {
          type: 'checkboxGroup',
          props: {
            fieldId: 'scopes',
            optionLayout: 'vertical',
            defaultValue: ['read'],
            validations: {
              minSelections: { value: 1 },
            },
          },
        },
        {
          type: 'checkboxGroup',
          props: {
            fieldId: 'secondary-scopes',
          },
        },
      ])
      expect(formNode.children?.[2]).not.toHaveProperty('props.optionLayout')
    })

    it('rejects unsupported optionLayout values for choice groups with a diagnostic path in props.optionLayout', () => {
      expect(
        validateRuntimeConfig(
          createConfigWithFormLayout({
            children: [
              {
                type: 'radioGroup',
                props: {
                  fieldId: 'role',
                  label: 'Role',
                  optionLayout: 'stacked',
                  items: [{ label: 'Admin', value: 'admin' }],
                },
              },
            ],
          }),
        ),
      ).toEqual({
        status: 'error',
        error: {
          code: 'invalid-layout',
          displayMode: 'development-only',
          message: 'Page "home" has an invalid layout at "layout[0].children[0].props.optionLayout".',
        },
      })

      expect(
        validateRuntimeConfig(
          createConfigWithFormLayout({
            children: [
              {
                type: 'checkboxGroup',
                props: {
                  fieldId: 'scopes',
                  label: 'Scopes',
                  optionLayout: 'grid',
                  items: {
                    values: ['read', 'write'],
                  },
                },
              },
            ],
          }),
        ),
      ).toEqual({
        status: 'error',
        error: {
          code: 'invalid-layout',
          displayMode: 'development-only',
          message: 'Page "home" has an invalid layout at "layout[0].children[0].props.optionLayout".',
        },
      })
    })

    it('rejects radioGroup and checkboxGroup outside forms', () => {
      expect(
        validateRuntimeConfig(
          createConfigWithLayout([
            {
              type: 'radioGroup',
              props: {
                fieldId: 'role',
                label: 'Role',
                items: [{ label: 'Admin', value: 'admin' }],
              },
            },
          ]),
        ),
      ).toEqual({
        status: 'error',
        error: {
          code: 'invalid-layout',
          displayMode: 'development-only',
          message: 'Page "home" has an invalid layout at "layout[0]": radioGroup nodes must be descendants of a form node.',
        },
      })

      expect(
        validateRuntimeConfig(
          createConfigWithLayout([
            {
              type: 'checkboxGroup',
              props: {
                fieldId: 'scopes',
                label: 'Scopes',
                items: {
                  values: ['read', 'write'],
                },
              },
            },
          ]),
        ),
      ).toEqual({
        status: 'error',
        error: {
          code: 'invalid-layout',
          displayMode: 'development-only',
          message: 'Page "home" has an invalid layout at "layout[0]": checkboxGroup nodes must be descendants of a form node.',
        },
      })
    })

    it('rejects unsupported form descendants after adding radioGroup and checkboxGroup', () => {
      expect(
        validateRuntimeConfig(
          createConfigWithFormLayout({
            children: [
              {
                type: 'list',
                props: {
                  items: ['broken'],
                },
              },
            ],
          }),
        ),
      ).toEqual({
        status: 'error',
        error: {
          code: 'invalid-layout',
          displayMode: 'development-only',
          message:
            'Page "home" has an invalid layout at "layout[0].children[0]": form nodes only accept input, textarea, select, radioGroup, checkboxGroup, button, heading, paragraph, image, table and container descendants.',
        },
      })
    })

    it('accepts select.multiple as an optional boolean', () => {
      const result = validateRuntimeConfig(
        createConfigWithFormLayout({
          children: [
            {
              type: 'select',
              props: {
                fieldId: 'scopes',
                label: 'Scopes',
                multiple: true,
                defaultValue: ['write', 'read'],
                items: {
                  values: ['read', 'write'],
                },
              },
            },
            {
              type: 'select',
              props: {
                fieldId: 'role',
                label: 'Role',
                items: [{ label: 'Admin', value: 'admin' }],
              },
            },
          ],
        }),
      )

      expect(result.status).toBe('ready')
    })

    it('accepts the same item shapes for select, radioGroup and checkboxGroup', () => {
      const result = validateRuntimeConfig(
        createConfigWithFormLayout({
          children: [
            {
              type: 'select',
              props: {
                fieldId: 'role',
                label: 'Role',
                items: [
                  { label: 'Admin', value: 'admin' },
                  { label: 'Editor', value: 'editor' },
                ],
              },
            },
            {
              type: 'radioGroup',
              props: {
                fieldId: 'team',
                label: 'Team',
                items: {
                  values: ['alpha', 'beta'],
                },
              },
            },
            {
              type: 'checkboxGroup',
              props: {
                fieldId: 'assignees',
                label: 'Assignees',
                items: {
                  values: [
                    { id: 1, name: 'Ada' },
                    { id: 2, name: 'Grace' },
                  ],
                  label: 'name',
                  value: 'id',
                },
              },
            },
          ],
        }, {
          extraPages: [
            {
              id: 'catalog',
              layout: [
                {
                  type: 'form',
                  id: 'secondary-form',
                  children: [
                    {
                      type: 'radioGroup',
                      props: {
                        fieldId: 'dynamicRole',
                        label: 'Dynamic role',
                        items: {
                          source: 'queries.searchUsers.data',
                          itemType: 'scalar',
                        },
                      },
                    },
                    {
                      type: 'checkboxGroup',
                      props: {
                        fieldId: 'dynamicUsers',
                        label: 'Dynamic users',
                        items: {
                          source: 'queries.searchUsers.data.results',
                          label: 'profile.name',
                          value: 'id',
                        },
                      },
                    },
                    {
                      type: 'select',
                      props: {
                        fieldId: 'dynamicSelect',
                        label: 'Dynamic select',
                        items: {
                          source: 'queries.searchUsers.data.results',
                          label: 'profile.name',
                          value: 'id',
                        },
                      },
                    },
                  ],
                },
              ],
            },
          ],
        }),
      )

      expect(result.status).toBe('ready')
    })

    it('rejects heterogeneous manual item values for radioGroup and checkboxGroup', () => {
      expect(
        validateRuntimeConfig(
          createConfigWithFormLayout({
            children: [
              {
                type: 'radioGroup',
                props: {
                  fieldId: 'role',
                  label: 'Role',
                  items: {
                    values: ['admin', 2],
                  },
                },
              },
            ],
          }),
        ),
      ).toEqual({
        status: 'error',
        error: {
          code: 'invalid-layout',
          displayMode: 'development-only',
          message:
            'Page "home" has an invalid layout at "layout[0].children[0].props.items.values": select item values must all be strings or all be numbers.',
        },
      })

      expect(
        validateRuntimeConfig(
          createConfigWithFormLayout({
            children: [
              {
                type: 'checkboxGroup',
                props: {
                  fieldId: 'teamIds',
                  label: 'Teams',
                  items: [
                    { label: 'Alpha', value: 'alpha' },
                    { label: 'Beta', value: 2 },
                  ],
                },
              },
            ],
          }),
        ),
      ).toEqual({
        status: 'error',
        error: {
          code: 'invalid-layout',
          displayMode: 'development-only',
          message:
            'Page "home" has an invalid layout at "layout[0].children[0].props.items": select item values must all be strings or all be numbers.',
        },
      })
    })

    it('rejects scalar literal defaultValue on multiple choice fields but keeps dynamic references valid', () => {
      expect(
        validateRuntimeConfig(
          createConfigWithFormLayout({
            children: [
              {
                type: 'select',
                props: {
                  fieldId: 'scopes',
                  label: 'Scopes',
                  multiple: true,
                  defaultValue: 'read',
                  items: {
                    values: ['read', 'write'],
                  },
                },
              },
            ],
          }),
        ),
      ).toEqual({
        status: 'error',
        error: {
          code: 'invalid-layout',
          displayMode: 'development-only',
          message:
            'Page "home" has an invalid layout at "layout[0].children[0].props.defaultValue": multiple choice fields only accept array literals or supported runtime references.',
        },
      })

      expect(
        validateRuntimeConfig(
          createConfigWithFormLayout({
            children: [
              {
                type: 'checkboxGroup',
                props: {
                  fieldId: 'scopes',
                  label: 'Scopes',
                  defaultValue: 2,
                  items: {
                    values: [1, 2],
                  },
                },
              },
            ],
          }),
        ),
      ).toEqual({
        status: 'error',
        error: {
          code: 'invalid-layout',
          displayMode: 'development-only',
          message:
            'Page "home" has an invalid layout at "layout[0].children[0].props.defaultValue": multiple choice fields only accept array literals or supported runtime references.',
        },
      })

      expect(
        validateRuntimeConfig(
          createConfigWithFormLayout({
            children: [
              {
                type: 'select',
                props: {
                  fieldId: 'dynamicScopes',
                  label: 'Dynamic scopes',
                  multiple: true,
                  defaultValue: 'queries.profile.data.scopes',
                  items: {
                    values: ['read', 'write'],
                  },
                },
              },
            ],
          }),
        ).status,
      ).toBe('ready')
    })

    it('rejects array literal defaultValue on single choice fields', () => {
      expect(
        validateRuntimeConfig(
          createConfigWithFormLayout({
            children: [
              {
                type: 'radioGroup',
                props: {
                  fieldId: 'role',
                  label: 'Role',
                  defaultValue: ['admin'],
                  items: [{ label: 'Admin', value: 'admin' }],
                },
              },
            ],
          }),
        ),
      ).toEqual({
        status: 'error',
        error: {
          code: 'invalid-layout',
          displayMode: 'development-only',
          message:
            'Page "home" has an invalid layout at "layout[0].children[0].props.defaultValue": single choice fields do not accept array literal defaultValue.',
        },
      })

      expect(
        validateRuntimeConfig(
          createConfigWithFormLayout({
            children: [
              {
                type: 'select',
                props: {
                  fieldId: 'role',
                  label: 'Role',
                  defaultValue: ['admin'],
                  items: [{ label: 'Admin', value: 'admin' }],
                },
              },
            ],
          }),
        ),
      ).toEqual({
        status: 'error',
        error: {
          code: 'invalid-layout',
          displayMode: 'development-only',
          message:
            'Page "home" has an invalid layout at "layout[0].children[0].props.defaultValue": single choice fields do not accept array literal defaultValue.',
        },
      })
    })

    it('rejects array literal defaultValue on input and textarea fields', () => {
      expect(
        validateRuntimeConfig(
          createConfigWithFormLayout({
            children: [
              {
                type: 'input',
                props: {
                  fieldId: 'name',
                  label: 'Name',
                  defaultValue: ['Ada'],
                },
              },
            ],
          }),
        ),
      ).toEqual({
        status: 'error',
        error: {
          code: 'invalid-layout',
          displayMode: 'development-only',
          message:
            'Page "home" has an invalid layout at "layout[0].children[0].props.defaultValue": input fields do not accept array literal defaultValue.',
        },
      })

      expect(
        validateRuntimeConfig(
          createConfigWithFormLayout({
            children: [
              {
                type: 'textarea',
                props: {
                  fieldId: 'bio',
                  label: 'Bio',
                  defaultValue: ['first line'],
                },
              },
            ],
          }),
        ),
      ).toEqual({
        status: 'error',
        error: {
          code: 'invalid-layout',
          displayMode: 'development-only',
          message:
            'Page "home" has an invalid layout at "layout[0].children[0].props.defaultValue": textarea fields do not accept array literal defaultValue.',
        },
      })
    })

    it('rejects multiple literal defaultValue arrays with mixed scalar types or non-scalar members', () => {
      expect(
        validateRuntimeConfig(
          createConfigWithFormLayout({
            children: [
              {
                type: 'checkboxGroup',
                props: {
                  fieldId: 'teamIds',
                  label: 'Teams',
                  defaultValue: ['1', 2],
                  items: {
                    values: ['1', '2'],
                  },
                },
              },
            ],
          }),
        ),
      ).toEqual({
        status: 'error',
        error: {
          code: 'invalid-layout',
          displayMode: 'development-only',
          message:
            'Page "home" has an invalid layout at "layout[0].children[0].props.defaultValue": multiple choice defaultValue arrays must contain only strings or only numbers.',
        },
      })

      expect(
        validateRuntimeConfig(
          createConfigWithFormLayout({
            children: [
              {
                type: 'select',
                props: {
                  fieldId: 'teamIds',
                  label: 'Teams',
                  multiple: true,
                  defaultValue: [{ id: 'alpha' }],
                  items: {
                    values: ['alpha', 'beta'],
                  },
                },
              },
            ],
          }),
        ),
      ).toEqual({
        status: 'error',
        error: {
          code: 'invalid-layout',
          displayMode: 'development-only',
          message:
            'Page "home" has an invalid layout at "layout[0].children[0].props.defaultValue[0]": multiple choice defaultValue arrays only accept string or number members.',
        },
      })
    })
  })

  it('validates fallback trees with the same form semantics and action targets as the main layout tree', () => {
    expect(
      validateRuntimeConfig({
        api: {},
        pages: [
          {
            id: 'home',
            layout: [
              {
                type: 'heading',
                props: {
                  text: 'Title',
                  level: 1,
                },
                queryStateFeedback: {
                  query: 'users',
                  states: {
                    loading: {
                      mode: 'fallback',
                      fallback: [
                        {
                          type: 'input',
                          props: {
                            fieldId: 'name',
                            label: 'Name',
                          },
                        },
                      ],
                    },
                  },
                },
              },
            ],
          },
        ],
        initialPage: 'home',
      }),
    ).toEqual({
      status: 'error',
      error: {
        code: 'invalid-layout',
        displayMode: 'development-only',
        message:
          'Page "home" has an invalid layout at "layout[0].queryStateFeedback.states.loading.fallback[0]": input nodes must be descendants of a form node.',
      },
    })

    expect(
      validateRuntimeConfig(
        createConfigWithFormLayout({
          children: [
            {
              type: 'paragraph',
              props: {
                text: 'Profile',
              },
              queryStateFeedback: {
                query: 'submitUserForm',
                states: {
                  loading: {
                    mode: 'fallback',
                    fallback: [
                      {
                        type: 'button',
                        props: {
                          label: 'Broken fallback navigation',
                          action: {
                            type: 'navigateTo',
                            pageId: 'missingPage',
                          },
                        },
                      },
                    ],
                  },
                },
              },
            },
          ],
        }),
      ),
    ).toEqual({
      status: 'error',
      error: {
        code: 'invalid-layout',
        displayMode: 'development-only',
        message:
          'Page "home" has an invalid layout at "layout[0].children[0].queryStateFeedback.states.loading.fallback[0].props.action.pageId": unknown page "missingPage".',
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

  it('rejects whitespace-only page ids and initialPage values', () => {
    expect(
      validateRuntimeConfig({
        api: {},
        pages: [
          {
            id: '   ',
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
        message: 'The page at "pages[0].id" must be a non-empty string.',
      },
    })

    expect(
      validateRuntimeConfig({
        api: {},
        pages: [
          {
            id: 'home',
            layout: [],
          },
        ],
        initialPage: '   ',
      }),
    ).toEqual({
      status: 'error',
      error: {
        code: 'invalid-layout',
        displayMode: 'development-only',
        message: 'The runtime config field "initialPage" must be a non-empty string.',
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

  it('reports list item failures with canonical array paths', () => {
    expect(
      validateRuntimeConfig(
        createConfigWithPages([
          {
            id: 'home',
            layout: [
              {
                type: 'list',
                props: {
                  items: ['One', 2],
                },
              },
            ],
          },
        ]),
      ),
    ).toEqual({
      status: 'error',
      error: {
        code: 'invalid-layout',
        displayMode: 'development-only',
        message: 'Page "home" has an invalid layout at "layout[0].props.items[1]".',
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

    it('accepts optional visibility across all supported node types without changing the normalized layout shape', () => {
      const result = validateRuntimeConfig(
        createConfigWithPages([
          {
            id: 'home',
            layout: [
              {
                type: 'heading',
                visibility: createVisibilityRule(),
                props: {
                  text: 'Visible heading',
                  level: 2,
                },
              },
              {
                type: 'paragraph',
                visibility: createVisibilityRule({
                  operator: 'notEquals',
                  value: 'guest',
                }),
                props: {
                  text: 'Visible paragraph',
                },
              },
              {
                type: 'list',
                visibility: createVisibilityRule({
                  reference: 'queries.searchUsers.data.results',
                  operator: 'greaterThan',
                  value: 0,
                }),
                props: {
                  items: ['One', 'Two'],
                },
              },
              {
                type: 'button',
                visibility: createVisibilityRule({
                  reference: 'queries.searchUsers.status',
                  operator: 'equals',
                  value: 'success',
                }),
                props: {
                  label: 'Standalone action',
                  action: {
                    type: 'navigateTo',
                    pageId: 'details',
                  },
                },
              },
              {
                type: 'container',
                visibility: createVisibilityRule({
                  reference: 'queries.searchUsers.error',
                  operator: 'isFalsy',
                }),
                children: [
                  {
                    type: 'paragraph',
                    props: {
                      text: 'Nested child',
                    },
                  },
                ],
              },
              {
                type: 'form',
                id: 'profile-form',
                visibility: createVisibilityRule({
                  reference: 'queries.searchUsers',
                  operator: 'isTruthy',
                }),
                children: [
                  {
                    type: 'input',
                    visibility: createVisibilityRule({
                      reference: 'forms.profile.role',
                      operator: 'equals',
                      value: 'admin',
                    }),
                    props: {
                      fieldId: 'name',
                      label: 'Name',
                    },
                  },
                  {
                    type: 'textarea',
                    visibility: createVisibilityRule({
                      reference: 'forms.profile.bio',
                      operator: 'isFalsy',
                    }),
                    props: {
                      fieldId: 'bio',
                      label: 'Bio',
                    },
                  },
                  {
                    type: 'select',
                    visibility: createVisibilityRule({
                      reference: 'queries.searchUsers.data',
                      operator: 'isTruthy',
                    }),
                    props: {
                      fieldId: 'role',
                      label: 'Role',
                      items: [
                        { label: 'Admin', value: 'admin' },
                        { label: 'Editor', value: 'editor' },
                      ],
                    },
                  },
                  {
                    type: 'button',
                    visibility: createVisibilityRule({
                      reference: 'queries.searchUsers.data.results',
                      operator: 'lessThan',
                      value: 5,
                    }),
                    props: {
                      label: 'Submit',
                    },
                  },
                ],
              },
            ],
          },
          {
            id: 'details',
            layout: [],
          },
        ]),
      )
      if (result.status !== 'ready') {
        throw new Error('Expected ready result')
      }

      expect(result.config.pages[0].layout).toEqual([
        {
          type: 'heading',
          visibility: createVisibilityRule(),
          props: {
            text: 'Visible heading',
            level: 2,
          },
        },
        {
          type: 'paragraph',
          visibility: createVisibilityRule({
            operator: 'notEquals',
            value: 'guest',
          }),
          props: {
            text: 'Visible paragraph',
          },
        },
        {
          type: 'list',
          visibility: createVisibilityRule({
            reference: 'queries.searchUsers.data.results',
            operator: 'greaterThan',
            value: 0,
          }),
          props: {
            items: ['One', 'Two'],
          },
        },
        {
          type: 'button',
          visibility: createVisibilityRule({
            reference: 'queries.searchUsers.status',
            operator: 'equals',
            value: 'success',
          }),
          props: {
            label: 'Standalone action',
            action: {
              type: 'navigateTo',
              pageId: 'details',
            },
          },
        },
        {
          type: 'container',
          visibility: createVisibilityRule({
            reference: 'queries.searchUsers.error',
            operator: 'isFalsy',
          }),
          children: [
            {
              type: 'paragraph',
              props: {
                text: 'Nested child',
              },
            },
          ],
        },
        {
          type: 'form',
          id: 'profile-form',
          visibility: createVisibilityRule({
            reference: 'queries.searchUsers',
            operator: 'isTruthy',
          }),
          children: [
            {
              type: 'input',
              visibility: createVisibilityRule({
                reference: 'forms.profile.role',
                operator: 'equals',
                value: 'admin',
              }),
              props: {
                fieldId: 'name',
                label: 'Name',
              },
            },
            {
              type: 'textarea',
              visibility: createVisibilityRule({
                reference: 'forms.profile.bio',
                operator: 'isFalsy',
              }),
              props: {
                fieldId: 'bio',
                label: 'Bio',
              },
            },
            {
              type: 'select',
              visibility: createVisibilityRule({
                reference: 'queries.searchUsers.data',
                operator: 'isTruthy',
              }),
              props: {
                fieldId: 'role',
                label: 'Role',
                items: [
                  { label: 'Admin', value: 'admin' },
                  { label: 'Editor', value: 'editor' },
                ],
              },
            },
            {
              type: 'button',
              visibility: createVisibilityRule({
                reference: 'queries.searchUsers.data.results',
                operator: 'lessThan',
                value: 5,
              }),
              props: {
                label: 'Submit',
              },
            },
          ],
        },
      ])
    })

    it('rejects visibility operators outside the supported catalog', () => {
      expect(
        validateRuntimeConfig(
          createConfigWithLayout([
            {
              type: 'heading',
              visibility: createVisibilityRule({
                operator: 'contains',
              }),
              props: {
                text: 'Welcome',
                level: 1,
              },
            },
          ]),
        ),
      ).toEqual({
        status: 'error',
        error: {
          code: 'invalid-layout',
          displayMode: 'development-only',
          message: 'Page "home" has an invalid layout at "layout[0].visibility.operator".',
        },
      })
    })

    it('rejects visibility references outside the supported forms and queries scope', () => {
      for (const reference of [
        'navigation.currentPageId',
        'routeParams.userId',
        'params.filter',
        'queries.searchUsers.status.code',
        'queries.searchUsers.error.message',
      ]) {
        expect(
          validateRuntimeConfig(
            createConfigWithLayout([
              {
                type: 'heading',
                visibility: createVisibilityRule({
                  reference,
                }),
                props: {
                  text: 'Welcome',
                  level: 1,
                },
              },
            ]),
          ),
        ).toEqual({
          status: 'error',
          error: {
            code: 'invalid-layout',
            displayMode: 'development-only',
            message: 'Page "home" has an invalid layout at "layout[0].visibility.reference": visibility references must use item, item.*, forms.{formId}.{fieldId}, queries.{queryName}, queries.{queryName}.data, queries.{queryName}.data.*, queries.{queryName}.status or queries.{queryName}.error.',
          },
        })
      }
    })

    it('requires value only for comparison operators and rejects it for truthy operators', () => {
      expect(
        validateRuntimeConfig(
          createConfigWithLayout([
            {
              type: 'heading',
              visibility: createVisibilityRule({
                operator: 'isTruthy',
                value: true,
              }),
              props: {
                text: 'Welcome',
                level: 1,
              },
            },
          ]),
        ),
      ).toEqual({
        status: 'error',
        error: {
          code: 'invalid-layout',
          displayMode: 'development-only',
          message: 'Page "home" has an invalid layout at "layout[0].visibility.value": operator "isTruthy" does not accept value.',
        },
      })

      expect(
        validateRuntimeConfig(
          createConfigWithLayout([
            {
              type: 'heading',
              visibility: {
                reference: 'forms.profile.role',
                operator: 'lessThan',
              },
              props: {
                text: 'Welcome',
                level: 1,
              },
            },
          ]),
        ),
      ).toEqual({
        status: 'error',
        error: {
          code: 'invalid-layout',
          displayMode: 'development-only',
          message: 'Page "home" has an invalid layout at "layout[0].visibility.value": operator "lessThan" requires value.',
        },
      })
    })

    it('keeps strings that look like runtime references as literal visibility values', () => {
      const result = validateRuntimeConfig(
        createConfigWithLayout([
          {
            type: 'heading',
            visibility: {
              reference: 'queries.searchUsers.status',
              operator: 'equals',
              value: 'forms.profile.role',
            },
            props: {
              text: 'Welcome',
              level: 1,
            },
          },
        ]),
      )

      expect(result.status).toBe('ready')

      if (result.status !== 'ready') {
        throw new Error('Expected ready result')
      }

      expect(result.config.pages[0].layout[0]).toEqual({
        type: 'heading',
        visibility: {
          reference: 'queries.searchUsers.status',
          operator: 'equals',
          value: 'forms.profile.role',
        },
        props: {
          text: 'Welcome',
          level: 1,
        },
      })
    })

    it('restricts visibility comparison values to scalar literals and numeric thresholds', () => {
      expect(
        validateRuntimeConfig(
          createConfigWithLayout([
            {
              type: 'heading',
              visibility: createVisibilityRule({
                value: {
                  role: 'admin',
                },
              }),
              props: {
                text: 'Welcome',
                level: 1,
              },
            },
          ]),
        ),
      ).toEqual({
        status: 'error',
        error: {
          code: 'invalid-layout',
          displayMode: 'development-only',
          message: 'Page "home" has an invalid layout at "layout[0].visibility.value": operator "equals" only accepts string, number, boolean or null.',
        },
      })

      expect(
        validateRuntimeConfig(
          createConfigWithLayout([
            {
              type: 'heading',
              visibility: createVisibilityRule({
                operator: 'notEquals',
                value: ['admin'],
              }),
              props: {
                text: 'Welcome',
                level: 1,
              },
            },
          ]),
        ),
      ).toEqual({
        status: 'error',
        error: {
          code: 'invalid-layout',
          displayMode: 'development-only',
          message: 'Page "home" has an invalid layout at "layout[0].visibility.value": operator "notEquals" only accepts string, number, boolean or null.',
        },
      })

      expect(
        validateRuntimeConfig(
          createConfigWithLayout([
            {
              type: 'heading',
              visibility: createVisibilityRule({
                operator: 'greaterThan',
                value: '10',
              }),
              props: {
                text: 'Welcome',
                level: 1,
              },
            },
          ]),
        ),
      ).toEqual({
        status: 'error',
        error: {
          code: 'invalid-layout',
          displayMode: 'development-only',
          message: 'Page "home" has an invalid layout at "layout[0].visibility.value": operator "greaterThan" only accepts numeric thresholds.',
        },
      })
    })

    it('drops unsupported extra keys from visibility blocks without changing valid configs', () => {
      const result = validateRuntimeConfig(
        createConfigWithLayout([
          {
            type: 'heading',
            visibility: {
              reference: 'forms.profile.role',
              operator: 'equals',
              value: 'admin',
              ignored: true,
            },
            props: {
              text: 'Welcome',
              level: 1,
            },
          },
        ]),
      )

      expect(result.status).toBe('ready')

      if (result.status !== 'ready') {
        throw new Error('Expected ready result')
      }

      expect(result.config.pages[0].layout[0]).toEqual({
        type: 'heading',
        visibility: {
          reference: 'forms.profile.role',
          operator: 'equals',
          value: 'admin',
        },
        props: {
          text: 'Welcome',
          level: 1,
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

    it('accepts navigateTo without params and preserves the normalized action shape', () => {
      const result = validateRuntimeConfig(createConfigWithNavigateToButtonAction())

      expect(result.status).toBe('ready')

      if (result.status !== 'ready') {
        throw new Error('Expected ready result')
      }

      expect(result.config.pages[0].layout[0]).toEqual({
        type: 'button',
        props: {
          label: 'Open details',
          action: {
            type: 'navigateTo',
            pageId: 'details',
          },
        },
      })
    })

    it('accepts navigateTo.params as a flat scalar object', () => {
      const result = validateRuntimeConfig(
        createConfigWithNavigateToButtonAction({
          params: {
            userId: '42',
            count: 3,
            isEditing: true,
            parentId: null,
          },
        }),
      )

      expect(result.status).toBe('ready')

      if (result.status !== 'ready') {
        throw new Error('Expected ready result')
      }

      expect(result.config.pages[0].layout[0]).toEqual({
        type: 'button',
        props: {
          label: 'Open details',
          action: {
            type: 'navigateTo',
            pageId: 'details',
            params: {
              userId: '42',
              count: 3,
              isEditing: true,
              parentId: null,
            },
          },
        },
      })
    })

    it('rejects invalid navigateTo.params shapes and values', () => {
      expect(
        validateRuntimeConfig(
          createConfigWithNavigateToButtonAction({
            params: [],
          }),
        ),
      ).toEqual({
        status: 'error',
        error: {
          code: 'invalid-layout',
          displayMode: 'development-only',
          message: 'Page "home" has an invalid layout at "layout[0].props.action.params": navigateTo params must be a flat object with non-empty keys.',
        },
      })

      expect(
        validateRuntimeConfig(
          createConfigWithNavigateToButtonAction({
            params: {
              user: {
                id: '42',
              },
            },
          }),
        ),
      ).toEqual({
        status: 'error',
        error: {
          code: 'invalid-layout',
          displayMode: 'development-only',
          message: 'Page "home" has an invalid layout at "layout[0].props.action.params.user": navigateTo params only accept string, number, boolean or null.',
        },
      })

      expect(
        validateRuntimeConfig(
          createConfigWithNavigateToButtonAction({
            params: {
              '': '42',
            },
          }),
        ),
      ).toEqual({
        status: 'error',
        error: {
          code: 'invalid-layout',
          displayMode: 'development-only',
          message: 'Page "home" has an invalid layout at "layout[0].props.action.params": navigateTo params contain an empty key.',
        },
      })

      expect(
        validateRuntimeConfig(
          createConfigWithNavigateToButtonAction({
            params: {
              tags: ['admin'],
            },
          }),
        ),
      ).toEqual({
        status: 'error',
        error: {
          code: 'invalid-layout',
          displayMode: 'development-only',
          message: 'Page "home" has an invalid layout at "layout[0].props.action.params.tags": navigateTo params only accept string, number, boolean or null.',
        },
      })
    })

    it('rejects malformed params.* references inside navigateTo.params before render', () => {
      expect(
        validateRuntimeConfig(
          createConfigWithNavigateToButtonAction({
            params: {
              userId: 'params',
            },
          }),
        ),
      ).toEqual({
        status: 'error',
        error: {
          code: 'invalid-layout',
          displayMode: 'development-only',
          message:
            'Page "home" has an invalid layout at "layout[0].props.action.params.userId": navigateTo params must use params.{paramName} when referencing page params.',
        },
      })

      expect(
        validateRuntimeConfig(
          createConfigWithNavigateToButtonAction({
            params: {
              userId: 'params.user.id',
            },
          }),
        ),
      ).toEqual({
        status: 'error',
        error: {
          code: 'invalid-layout',
          displayMode: 'development-only',
          message:
            'Page "home" has an invalid layout at "layout[0].props.action.params.userId": navigateTo params must use params.{paramName} when referencing page params.',
        },
      })

      expect(
        validateRuntimeConfig(
          createConfigWithNavigateToButtonAction({
            params: {
              userId: 'params..id',
            },
          }),
        ),
      ).toEqual({
        status: 'error',
        error: {
          code: 'invalid-layout',
          displayMode: 'development-only',
          message:
            'Page "home" has an invalid layout at "layout[0].props.action.params.userId": navigateTo params must use params.{paramName} when referencing page params.',
        },
      })
    })

    it('still rejects unknown target pages when navigateTo.params is valid', () => {
      expect(
        validateRuntimeConfig(
          createConfigWithNavigateToButtonAction({
            pageId: 'missing-page',
            params: {
              userId: '42',
            },
          }),
        ),
      ).toEqual({
        status: 'error',
        error: {
          code: 'invalid-layout',
          displayMode: 'development-only',
          message: 'Page "home" has an invalid layout at "layout[0].props.action.pageId": unknown page "missing-page".',
        },
      })
    })

    it('rejects params references in visibility rules before render', () => {
      expect(
        validateRuntimeConfig(
          createConfigWithLayout([
            {
              type: 'heading',
              visibility: {
                reference: 'params.userId',
                operator: 'equals',
                value: '42',
              },
              props: {
                text: 'Welcome',
                level: 1,
              },
            },
          ]),
        ),
      ).toEqual({
        status: 'error',
        error: {
          code: 'invalid-layout',
          displayMode: 'development-only',
          message:
            'Page "home" has an invalid layout at "layout[0].visibility.reference": visibility references must use item, item.*, forms.{formId}.{fieldId}, queries.{queryName}, queries.{queryName}.data, queries.{queryName}.data.*, queries.{queryName}.status or queries.{queryName}.error.',
        },
      })
    })

    it('rejects params references in dynamic collection sources before render', () => {
      expect(
        validateRuntimeConfig(
          createConfigWithLayout([
            {
              type: 'list',
              props: {
                items: {
                  source: 'params.userId',
                  itemType: 'scalar',
                },
              },
            },
          ]),
        ),
      ).toEqual({
        status: 'error',
        error: {
          code: 'invalid-layout',
          displayMode: 'development-only',
          message:
            'Page "home" has an invalid layout at "layout[0].props.items.source": collection sources must use queries.{queryName}.data, queries.{queryName}.data.* or item.*.',
        },
      })

      expect(
        validateRuntimeConfig(
          createConfigWithLayout([
            {
              type: 'select',
              props: {
                fieldId: 'assignee',
                label: 'Assignee',
                items: {
                  source: 'params.userId',
                  itemType: 'scalar',
                },
              },
            },
          ]),
        ),
      ).toEqual({
        status: 'error',
        error: {
          code: 'invalid-layout',
          displayMode: 'development-only',
          message:
            'Page "home" has an invalid layout at "layout[0].props.items.source": collection sources must use queries.{queryName}.data, queries.{queryName}.data.* or item.*.',
        },
      })
    })

    it('accepts repeater nodes with query collection source, relative key path and template', () => {
      expect(
        validateRuntimeConfig(
          createConfigWithLayout([
            createRepeaterNode({
              extra: 'drop-me',
              props: {
                items: {
                  source: 'queries.posts.data.results',
                  key: 'meta.slug',
                  extra: 'drop-me',
                },
                template: [
                  {
                    type: 'heading',
                    props: {
                      text: 'item.title',
                      level: 2,
                      extra: 'drop-me',
                    },
                  },
                  {
                    type: 'form',
                    id: 'post-actions',
                    children: [
                      {
                        type: 'input',
                        props: {
                          fieldId: 'note',
                          label: 'Note',
                        },
                      },
                    ],
                  },
                ],
                extra: 'drop-me',
              },
            }),
          ]),
        ),
      ).toEqual({
        status: 'ready',
        config: {
          api: {},
          pages: [
            {
              id: 'home',
              layout: [
                {
                  type: 'repeater',
                  props: {
                    items: {
                      source: 'queries.posts.data.results',
                      key: 'meta.slug',
                    },
                    template: [
                      {
                        type: 'heading',
                        props: {
                          text: 'item.title',
                          level: 2,
                        },
                      },
                      {
                        type: 'form',
                        id: 'post-actions',
                        children: [
                          {
                            type: 'input',
                            props: {
                              fieldId: 'note',
                              label: 'Note',
                            },
                          },
                        ],
                      },
                    ],
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
              type: 'repeater',
              props: {
                items: {
                  source: 'queries.posts.data.results',
                  key: 'meta.slug',
                },
                template: [
                  {
                    type: 'heading',
                    props: {
                      text: 'item.title',
                      level: 2,
                    },
                  },
                  {
                    type: 'form',
                    id: 'post-actions',
                    children: [
                      {
                        type: 'input',
                        props: {
                          fieldId: 'note',
                          label: 'Note',
                        },
                      },
                    ],
                  },
                ],
              },
            },
          ],
        },
      })
    })

    it('accepts repeater pagination with the closed previousNext v1 contract', () => {
      expect(
        validateRuntimeConfig(
          createConfigWithLayout([
            createRepeaterNode({
              queryStateFeedback: {
                query: 'posts',
              },
              visibility: {
                reference: 'queries.posts.status',
                operator: 'equals',
                value: 'success',
              },
              layout: {
                span: 6,
              },
              props: {
                items: {
                  source: 'queries.posts.data.results',
                  key: 'id',
                },
                pagination: {
                  enabled: true,
                  pageSize: 10,
                  controls: {
                    variant: 'previousNext',
                  },
                },
                template: [
                  {
                    type: 'heading',
                    props: {
                      text: 'item.title',
                      level: 2,
                    },
                  },
                ],
              },
            }),
          ]),
        ),
      ).toMatchObject({
        status: 'ready',
        page: {
          layout: [
            {
              type: 'repeater',
              queryStateFeedback: {
                query: 'posts',
              },
              visibility: {
                reference: 'queries.posts.status',
                operator: 'equals',
                value: 'success',
              },
              layout: {
                span: 6,
              },
              props: {
                items: {
                  source: 'queries.posts.data.results',
                  key: 'id',
                },
                pagination: {
                  enabled: true,
                  pageSize: 10,
                  controls: {
                    variant: 'previousNext',
                  },
                },
              },
            },
          ],
        },
      })
    })

    it('accepts repeater pagination without controls or with empty controls for the runtime default', () => {
      for (const pagination of [
        {
          enabled: true,
          pageSize: 2,
        },
        {
          enabled: true,
          pageSize: 2,
          controls: {},
        },
      ]) {
        const result = validateRuntimeConfig(
          createConfigWithLayout([
            createRepeaterNode({
              props: {
                items: {
                  source: 'queries.posts.data',
                  key: 'id',
                },
                pagination,
                template: [],
              },
            }),
          ]),
        )

        expect(result).toMatchObject({
          status: 'ready',
          page: {
            layout: [
              {
                type: 'repeater',
                props: {
                  pagination,
                },
              },
            ],
          },
        })
      }
    })

    it('rejects invalid repeater pagination values with focused diagnostic paths', () => {
      const cases: Array<{ pagination: unknown; path: string }> = [
        { pagination: { enabled: false, pageSize: 2 }, path: 'props.pagination.enabled' },
        { pagination: { pageSize: 2 }, path: 'props.pagination.enabled' },
        { pagination: { enabled: true }, path: 'props.pagination.pageSize' },
        { pagination: { enabled: true, pageSize: 1.5 }, path: 'props.pagination.pageSize' },
        { pagination: { enabled: true, pageSize: 0 }, path: 'props.pagination.pageSize' },
        { pagination: { enabled: true, pageSize: Number.POSITIVE_INFINITY }, path: 'props.pagination.pageSize' },
        {
          pagination: { enabled: true, pageSize: 2, controls: { variant: 'numbers' } },
          path: 'props.pagination.controls.variant',
        },
        { pagination: { enabled: true, pageSize: 2, remote: true }, path: 'props.pagination.remote' },
        {
          pagination: { enabled: true, pageSize: 2, controls: { cursor: 'next' } },
          path: 'props.pagination.controls.cursor',
        },
      ]

      for (const { pagination, path } of cases) {
        expect(
          validateRuntimeConfig(
            createConfigWithLayout([
              createRepeaterNode({
                props: {
                  items: {
                    source: 'queries.posts.data',
                    key: 'id',
                  },
                  pagination,
                  template: [],
                },
              }),
            ]),
          ),
        ).toEqual({
          status: 'error',
          error: {
            code: 'invalid-layout',
            displayMode: 'development-only',
            message: `Page "home" has an invalid layout at "layout[0].${path}".`,
          },
        })
      }
    })

    it('rejects repeater collection sources outside queries.{queryName}.data scope', () => {
      expect(
        validateRuntimeConfig(
          createConfigWithLayout([
            createRepeaterNode({
              props: {
                items: {
                  source: 'queries.posts.status',
                  key: 'id',
                },
                template: [],
              },
            }),
          ]),
        ),
      ).toEqual({
        status: 'error',
        error: {
          code: 'invalid-layout',
          displayMode: 'development-only',
          message:
            'Page "home" has an invalid layout at "layout[0].props.items.source": collection sources must use queries.{queryName}.data, queries.{queryName}.data.* or item.*.',
        },
      })
    })

    it('rejects repeater keys that are empty, global references or malformed relative paths', () => {
      for (const key of ['', 'item.id', 'queries.posts.data.0.id', 'author..id']) {
        expect(
          validateRuntimeConfig(
            createConfigWithLayout([
              createRepeaterNode({
                props: {
                  items: {
                    source: 'queries.posts.data',
                    key,
                  },
                  template: [],
                },
              }),
            ]),
          ),
        ).toEqual({
          status: 'error',
          error: {
            code: 'invalid-layout',
            displayMode: 'development-only',
            message:
              'Page "home" has an invalid layout at "layout[0].props.items.key": repeater item keys must use a non-empty relative item path.',
          },
        })
      }
    })

    it('rejects repeater nodes without template, with non-array template, or with children', () => {
      expect(
        validateRuntimeConfig(
          createConfigWithLayout([
            {
              type: 'repeater',
              props: {
                items: {
                  source: 'queries.posts.data',
                  key: 'id',
                },
              },
            },
          ]),
        ),
      ).toEqual({
        status: 'error',
        error: {
          code: 'invalid-layout',
          displayMode: 'development-only',
          message: 'Page "home" has an invalid layout at "layout[0].props.template".',
        },
      })

      expect(
        validateRuntimeConfig(
          createConfigWithLayout([
            createRepeaterNode({
              props: {
                items: {
                  source: 'queries.posts.data',
                  key: 'id',
                },
                template: 'not-an-array',
              },
            }),
          ]),
        ),
      ).toEqual({
        status: 'error',
        error: {
          code: 'invalid-layout',
          displayMode: 'development-only',
          message: 'Page "home" has an invalid layout at "layout[0].props.template".',
        },
      })

      expect(
        validateRuntimeConfig(
          createConfigWithLayout([
            createRepeaterNode({
              children: [],
            }),
          ]),
        ),
      ).toEqual({
        status: 'error',
        error: {
          code: 'invalid-layout',
          displayMode: 'development-only',
          message: 'Page "home" has an invalid layout at "layout[0].children".',
        },
      })
    })
  })

  describe('container layout contract', () => {
    it('accepts the expanded container layout props and keeps direction alongside columns', () => {
      const result = validateRuntimeConfig(
        createConfigWithLayout([
          {
            type: 'container',
            layout: {
              span: 3,
            },
            props: {
              direction: 'row',
              gap: '2xl',
              columns: 4,
              variant: 'card',
              align: 'center',
              justify: 'between',
            },
            children: [
              {
                type: 'paragraph',
                props: {
                  text: 'First child',
                },
              },
            ],
          },
        ]),
      )

      expect(result.status).toBe('ready')

      if (result.status !== 'ready') {
        throw new Error('Expected ready result')
      }

      expect(result.config.pages[0].layout[0]).toMatchObject({
        type: 'container',
        layout: {
          span: 3,
        },
        props: {
          direction: 'row',
          gap: '2xl',
          columns: 4,
          variant: 'card',
          align: 'center',
          justify: 'between',
        },
        children: [
          {
            type: 'paragraph',
            props: {
              text: 'First child',
            },
          },
        ],
      })
    })

    it('accepts arbitrary container gaps as a compatibility fallback', () => {
      const result = validateRuntimeConfig(
        createConfigWithLayout([
          {
            type: 'container',
            layout: {
              span: 2,
            },
            props: {
              gap: '18px',
              variant: 'default',
            },
            children: [
              {
                type: 'paragraph',
                props: {
                  text: 'Scoped gap fallback',
                },
              },
            ],
          },
        ]),
      )

      expect(result.status).toBe('ready')

      if (result.status !== 'ready') {
        throw new Error('Expected ready result')
      }

      expect(result.config.pages[0].layout[0]).toMatchObject({
        type: 'container',
        layout: {
          span: 2,
        },
        props: {
          gap: '18px',
          variant: 'default',
        },
        children: [
          {
            type: 'paragraph',
            props: {
              text: 'Scoped gap fallback',
            },
          },
        ],
      })
    })

    it('accepts only the supported align justify and wrap values', () => {
      const supportedProps = [
        { align: 'start' },
        { align: 'stretch' },
        { justify: 'center' },
        { justify: 'evenly' },
        { wrap: 'nowrap' },
        { wrap: 'wrap' },
        { wrap: 'wrap-reverse' },
      ]

      for (const props of supportedProps) {
        expect(
          validateRuntimeConfig(
            createConfigWithLayout([
              {
                type: 'container',
                props,
                children: [
                  {
                    type: 'paragraph',
                    props: {
                      text: 'Layout child',
                    },
                  },
                ],
              },
            ]),
          ),
        ).toMatchObject({
          status: 'ready',
        })
      }
    })

    it('rejects unsupported container columns and layout keywords with explicit prop paths', () => {
      expect(
        validateRuntimeConfig(
          createConfigWithLayout([
            {
              type: 'container',
              props: {
                columns: 0,
              },
            },
          ]),
        ),
      ).toEqual({
        status: 'error',
        error: {
          code: 'invalid-layout',
          displayMode: 'development-only',
          message: 'Page "home" has an invalid layout at "layout[0].props.columns".',
        },
      })

      expect(
        validateRuntimeConfig(
          createConfigWithLayout([
            {
              type: 'container',
              props: {
                align: 'baseline',
              },
            },
          ]),
        ),
      ).toEqual({
        status: 'error',
        error: {
          code: 'invalid-layout',
          displayMode: 'development-only',
          message: 'Page "home" has an invalid layout at "layout[0].props.align".',
        },
      })

      expect(
        validateRuntimeConfig(
          createConfigWithLayout([
            {
              type: 'container',
              props: {
                justify: 'space-between',
              },
            },
          ]),
        ),
      ).toEqual({
        status: 'error',
        error: {
          code: 'invalid-layout',
          displayMode: 'development-only',
          message: 'Page "home" has an invalid layout at "layout[0].props.justify".',
        },
      })

      expect(
        validateRuntimeConfig(
          createConfigWithLayout([
            {
              type: 'container',
              props: {
                wrap: 'balance',
              },
            },
          ]),
        ),
      ).toEqual({
        status: 'error',
        error: {
          code: 'invalid-layout',
          displayMode: 'development-only',
          message: 'Page "home" has an invalid layout at "layout[0].props.wrap".',
        },
      })
    })

    it('rejects containers that declare columns together with wrap', () => {
      expect(
        validateRuntimeConfig(
          createConfigWithLayout([
            {
              type: 'container',
              props: {
                columns: 3,
                wrap: 'wrap',
              },
            },
          ]),
        ),
      ).toEqual({
        status: 'error',
        error: {
          code: 'invalid-layout',
          displayMode: 'development-only',
          message: 'Page "home" has an invalid layout at "layout[0].props.wrap": container nodes cannot declare "wrap" when "columns" is present.',
        },
      })
    })

    it('keeps historical containers without the new props valid', () => {
      const result = validateRuntimeConfig(
        createConfigWithLayout([
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
        ]),
      )

      expect(result).toEqual({
        status: 'ready',
        config: {
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

    it('accepts layout.span across leaf, composite, form and repeater nodes', () => {
      const result = validateRuntimeConfig(
        createConfigWithPages([
          {
            id: 'home',
            layout: [
              {
                type: 'heading',
                layout: {
                  span: 1,
                },
                props: {
                  text: 'Welcome',
                  level: 1,
                },
              },
              {
                type: 'container',
                layout: {
                  span: 2,
                },
                children: [
                  {
                    type: 'paragraph',
                    layout: {
                      span: 3,
                    },
                    props: {
                      text: 'Body copy',
                    },
                  },
                ],
              },
              {
                type: 'form',
                id: 'profile-form',
                layout: {
                  span: 4,
                },
                children: [
                  {
                    type: 'input',
                    layout: {
                      span: 5,
                    },
                    props: {
                      fieldId: 'name',
                      label: 'Name',
                    },
                  },
                ],
              },
              {
                type: 'repeater',
                layout: {
                  span: 6,
                },
                props: {
                  items: {
                    source: 'queries.posts.data',
                    key: 'id',
                  },
                  template: [
                    {
                      type: 'container',
                      layout: {
                        span: 7,
                      },
                      children: [
                        {
                          type: 'paragraph',
                          props: {
                            text: 'item.title',
                          },
                        },
                      ],
                    },
                  ],
                },
              },
            ],
          },
        ]),
      )

      expect(result.status).toBe('ready')

      if (result.status !== 'ready') {
        throw new Error('Expected ready result')
      }

      expect(result.config.pages[0].layout).toMatchObject([
        {
          type: 'heading',
          layout: {
            span: 1,
          },
          props: {
            text: 'Welcome',
            level: 1,
          },
        },
        {
          type: 'container',
          layout: {
            span: 2,
          },
          children: [
            {
              type: 'paragraph',
              layout: {
                span: 3,
              },
              props: {
                text: 'Body copy',
              },
            },
          ],
        },
        {
          type: 'form',
          id: 'profile-form',
          layout: {
            span: 4,
          },
          children: [
            {
              type: 'input',
              layout: {
                span: 5,
              },
              props: {
                fieldId: 'name',
                label: 'Name',
              },
            },
          ],
        },
        {
          type: 'repeater',
          layout: {
            span: 6,
          },
          props: {
            items: {
              source: 'queries.posts.data',
              key: 'id',
            },
            template: [
              {
                type: 'container',
                layout: {
                  span: 7,
                },
                children: [
                  {
                    type: 'paragraph',
                    props: {
                      text: 'item.title',
                    },
                  },
                ],
              },
            ],
          },
        },
      ])
    })

    it('rejects invalid container variant and layout span paths explicitly', () => {
      expect(
        validateRuntimeConfig(
          createConfigWithLayout([
            {
              type: 'container',
              props: {
                variant: 'hero',
              },
            },
          ]),
        ),
      ).toEqual({
        status: 'error',
        error: {
          code: 'invalid-layout',
          displayMode: 'development-only',
          message: 'Page "home" has an invalid layout at "layout[0].props.variant".',
        },
      })

      expect(
        validateRuntimeConfig(
          createConfigWithLayout([
            {
              type: 'container',
              layout: {
                span: 0,
              },
            },
          ]),
        ),
      ).toEqual({
        status: 'error',
        error: {
          code: 'invalid-layout',
          displayMode: 'development-only',
          message: 'Page "home" has an invalid layout at "layout[0].layout.span".',
        },
      })

      expect(
        validateRuntimeConfig(
          createConfigWithLayout([
            {
              type: 'heading',
              layout: {
                span: '2',
              },
              props: {
                text: 'Welcome',
                level: 1,
              },
            },
          ]),
        ),
      ).toEqual({
        status: 'error',
        error: {
          code: 'invalid-layout',
          displayMode: 'development-only',
          message: 'Page "home" has an invalid layout at "layout[0].layout.span".',
        },
      })

      expect(
        validateRuntimeConfig(
          createConfigWithLayout([
            {
              type: 'repeater',
              layout: {
                span: 13,
              },
              props: {
                items: {
                  source: 'queries.posts.data',
                  key: 'id',
                },
                template: [],
              },
            },
          ]),
        ),
      ).toEqual({
        status: 'error',
        error: {
          code: 'invalid-layout',
          displayMode: 'development-only',
          message: 'Page "home" has an invalid layout at "layout[0].layout.span".',
        },
      })
    })
  })

  describe('image and table node validation', () => {
    it('accepts image nodes with src and alt plus shared feedback fields', () => {
      const result = validateRuntimeConfig(
        createConfigWithLayout([
          {
            type: 'image',
            queryStateFeedback: {
              query: 'heroImage',
            },
            visibility: createVisibilityRule(),
            props: {
              src: 'queries.heroImage.data.url',
              alt: 'queries.heroImage.data.alt',
            },
          },
        ]),
      )

      expect(result).toEqual({
        status: 'ready',
        config: {
          api: {},
          pages: [
            {
              id: 'home',
              layout: [
                {
                  type: 'image',
                  queryStateFeedback: {
                    query: 'heroImage',
                  },
                  visibility: createVisibilityRule(),
                  props: {
                    src: 'queries.heroImage.data.url',
                    alt: 'queries.heroImage.data.alt',
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
              type: 'image',
              queryStateFeedback: {
                query: 'heroImage',
              },
              visibility: createVisibilityRule(),
              props: {
                src: 'queries.heroImage.data.url',
                alt: 'queries.heroImage.data.alt',
              },
            },
          ],
        },
      })
    })

    it('accepts table nodes with manual rows and scalar cells', () => {
      const result = validateRuntimeConfig(
        createConfigWithLayout([
          {
            type: 'table',
            props: {
              headers: ['Name', 'Active', 'Visits'],
              rows: [
                ['Ada', true, 12],
                ['Grace', false, 7],
              ],
            },
          },
        ]),
      )

      expect(result).toEqual({
        status: 'ready',
        config: {
          api: {},
          pages: [
            {
              id: 'home',
              layout: [
                {
                  type: 'table',
                  props: {
                    headers: ['Name', 'Active', 'Visits'],
                    rows: [
                      ['Ada', true, 12],
                      ['Grace', false, 7],
                    ],
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
              type: 'table',
              props: {
                headers: ['Name', 'Active', 'Visits'],
                rows: [
                  ['Ada', true, 12],
                  ['Grace', false, 7],
                ],
              },
            },
          ],
        },
      })
    })

    it('accepts table nodes with dynamic rows from queries and item references', () => {
      const result = validateRuntimeConfig(
        createConfigWithLayout([
          {
            type: 'table',
            queryStateFeedback: {
              query: 'users',
            },
            visibility: createVisibilityRule({
              reference: 'queries.users.status',
              operator: 'equals',
              value: 'success',
            }),
            props: {
              headers: ['Name', 'Role'],
              rows: {
                source: 'queries.users.data.items',
                cells: ['item.name', 'item.role'],
              },
            },
          },
        ]),
      )

      expect(result).toEqual({
        status: 'ready',
        config: {
          api: {},
          pages: [
            {
              id: 'home',
              layout: [
                {
                  type: 'table',
                  queryStateFeedback: {
                    query: 'users',
                  },
                  visibility: {
                    reference: 'queries.users.status',
                    operator: 'equals',
                    value: 'success',
                  },
                  props: {
                    headers: ['Name', 'Role'],
                    rows: {
                      source: 'queries.users.data.items',
                      cells: ['item.name', 'item.role'],
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
              type: 'table',
              queryStateFeedback: {
                query: 'users',
              },
              visibility: {
                reference: 'queries.users.status',
                operator: 'equals',
                value: 'success',
              },
              props: {
                headers: ['Name', 'Role'],
                rows: {
                  source: 'queries.users.data.items',
                  cells: ['item.name', 'item.role'],
                },
              },
            },
          ],
        },
      })
    })

    it('rejects image nodes without src or alt', () => {
      expect(
        validateRuntimeConfig(
          createConfigWithLayout([
            {
              type: 'image',
              props: {
                alt: 'Missing src',
              },
            },
          ]),
        ),
      ).toEqual({
        status: 'error',
        error: {
          code: 'invalid-layout',
          displayMode: 'development-only',
          message: 'Page "home" has an invalid layout at "layout[0].props.src".',
        },
      })

      expect(
        validateRuntimeConfig(
          createConfigWithLayout([
            {
              type: 'image',
              props: {
                src: '/hero.png',
              },
            },
          ]),
        ),
      ).toEqual({
        status: 'error',
        error: {
          code: 'invalid-layout',
          displayMode: 'development-only',
          message: 'Page "home" has an invalid layout at "layout[0].props.alt".',
        },
      })
    })

    it('rejects table nodes without headers rows or matching row lengths', () => {
      expect(
        validateRuntimeConfig(
          createConfigWithLayout([
            {
              type: 'table',
              props: {
                headers: [],
                rows: [['Ada']],
              },
            },
          ]),
        ),
      ).toEqual({
        status: 'error',
        error: {
          code: 'invalid-layout',
          displayMode: 'development-only',
          message: 'Page "home" has an invalid layout at "layout[0].props.headers".',
        },
      })

      expect(
        validateRuntimeConfig(
          createConfigWithLayout([
            {
              type: 'table',
              props: {
                headers: ['Name'],
              },
            },
          ]),
        ),
      ).toEqual({
        status: 'error',
        error: {
          code: 'invalid-layout',
          displayMode: 'development-only',
          message: 'Page "home" has an invalid layout at "layout[0].props.rows".',
        },
      })

      expect(
        validateRuntimeConfig(
          createConfigWithLayout([
            {
              type: 'table',
              props: {
                headers: ['Name', 'Role'],
                rows: [['Ada']],
              },
            },
          ]),
        ),
      ).toEqual({
        status: 'error',
        error: {
          code: 'invalid-layout',
          displayMode: 'development-only',
          message: 'Page "home" has an invalid layout at "layout[0].props.rows[0]": table rows must have exactly 2 cells to match headers.',
        },
      })
    })

    it('rejects table nodes that mix manual and dynamic row modes', () => {
      expect(
        validateRuntimeConfig(
          createConfigWithLayout([
            {
              type: 'table',
              props: {
                headers: ['Name'],
                rows: {
                  source: 'queries.users.data',
                  cells: ['item.name'],
                  values: [['Ada']],
                },
              },
            },
          ]),
        ),
      ).toEqual({
        status: 'error',
        error: {
          code: 'invalid-layout',
          displayMode: 'development-only',
          message: 'Page "home" has an invalid layout at "layout[0].props.rows": table rows must use either manual rows or a dynamic { source, cells } object.',
        },
      })
    })

    it('rejects table nodes with unsupported cell values or dynamic source shapes', () => {
      expect(
        validateRuntimeConfig(
          createConfigWithLayout([
            {
              type: 'table',
              props: {
                headers: ['Name'],
                rows: [[{ name: 'Ada' }]],
              },
            },
          ]),
        ),
      ).toEqual({
        status: 'error',
        error: {
          code: 'invalid-layout',
          displayMode: 'development-only',
          message: 'Page "home" has an invalid layout at "layout[0].props.rows[0][0]": table cells only accept string, number or boolean values.',
        },
      })

      expect(
        validateRuntimeConfig(
          createConfigWithLayout([
            {
              type: 'table',
              props: {
                headers: ['Name'],
                rows: {
                  source: 'forms.profile.roles',
                  cells: ['item.name'],
                },
              },
            },
          ]),
        ),
      ).toEqual({
        status: 'error',
        error: {
          code: 'invalid-layout',
          displayMode: 'development-only',
          message:
            'Page "home" has an invalid layout at "layout[0].props.rows.source": collection sources must use queries.{queryName}.data, queries.{queryName}.data.* or item.*.',
        },
      })
    })

    it('rejects table nodes with dynamic cells that do not match the headers length', () => {
      expect(
        validateRuntimeConfig(
          createConfigWithLayout([
            {
              type: 'table',
              props: {
                headers: ['Name', 'Role'],
                rows: {
                  source: 'queries.users.data',
                  cells: ['item.name'],
                },
              },
            },
          ]),
        ),
      ).toEqual({
        status: 'error',
        error: {
          code: 'invalid-layout',
          displayMode: 'development-only',
          message: 'Page "home" has an invalid layout at "layout[0].props.rows.cells": table dynamic cells must have exactly 2 entries to match headers.',
        },
      })
    })
  })
})
