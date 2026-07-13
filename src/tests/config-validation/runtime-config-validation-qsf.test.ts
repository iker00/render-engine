import { describe, expect, it } from 'vitest'
import { validateRuntimeConfig } from '../../config/runtime-config'
import { createConfigWithPages } from './helpers'

describe('validateRuntimeConfig', () => {
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
        message: `Page "home" has an invalid layout at "layout[0].queryStateFeedback.states.pending".
  → paragraph("Users loaded")
  Node: {"type":"paragraph","props":{"text":"Users loaded"}}`,
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
        message: `Page "home" has an invalid layout at "layout[0].queryStateFeedback.states.idle.fallback".
  → paragraph("Users loaded")
  Node: {"type":"paragraph","props":{"text":"Users loaded"}}`,
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
        message: `Page "home" has an invalid layout at "layout[0].queryStateFeedback.states.loading.fallback".
  → paragraph("Users loaded")
  Node: {"type":"paragraph","props":{"text":"Users loaded"}}`,
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
        message: `Page "home" has an invalid layout at "layout[0].queryStateFeedback.states.loading.fallback[0].props.alt".
  → paragraph("Users loaded") > image[0]
  Node: {"type":"image"}`,
      },
    })
  })
})
