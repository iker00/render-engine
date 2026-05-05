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
          preloads: ['searchUsers', 'loadTeams'],
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
            preloads: ['searchUsers', 'loadTeams'],
            layout: [],
          },
        ],
        initialPage: 'home',
      },
      page: {
        id: 'home',
        preloads: ['searchUsers', 'loadTeams'],
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
        code: 'unsupported-node-type',
        displayMode: 'development-only',
        message: 'Page "home" uses unsupported layout node type "image" at "layout[0].queryStateFeedback.states.loading.fallback[0]".',
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
        message: 'The page at "pages[0].preloads" must be an array of non-empty strings.',
      },
    })
  })

  it('rejects preloads entries that are empty, whitespace-only, or not strings', () => {
    expect(
      validateRuntimeConfig({
        api: {},
        pages: [
          {
            id: 'home',
            preloads: ['searchUsers', '', 'loadTeams'],
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
        message: 'The page at "pages[0].preloads[1]" must be a non-empty string.',
      },
    })

    expect(
      validateRuntimeConfig({
        api: {},
        pages: [
          {
            id: 'home',
            preloads: ['searchUsers', '   '],
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
        message: 'The page at "pages[0].preloads[1]" must be a non-empty string.',
      },
    })

    expect(
      validateRuntimeConfig({
        api: {},
        pages: [
          {
            id: 'home',
            preloads: ['searchUsers', 42],
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
        message: 'The page at "pages[0].preloads[1]" must be a non-empty string.',
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
                  required: true,
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
                          required: true,
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
                      required: true,
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
          'Page "home" has an invalid layout at "layout[0].children[0]": form nodes only accept input, textarea, select, button, heading, paragraph and container descendants.',
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

      expect(result.status).toBe('ready')

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

      expect(result.status).toBe('ready')

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

      expect(result.status).toBe('ready')

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
          message: 'Page "home" has an invalid layout at "layout[0].props.items.source": collection sources must use queries.{queryName}.data or queries.{queryName}.data.*.',
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
          message: 'Page "home" has an invalid layout at "layout[0].children[0].props.items.source": collection sources must use queries.{queryName}.data or queries.{queryName}.data.*.',
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
          message: 'Page "home" has an invalid layout at "layout[0].props.items.source": collection sources must use queries.{queryName}.data or queries.{queryName}.data.*.',
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
          message: 'Page "home" has an invalid layout at "layout[0].children[0].props.items.source": collection sources must use queries.{queryName}.data or queries.{queryName}.data.*.',
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

      expect(result.status).toBe('ready')

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
