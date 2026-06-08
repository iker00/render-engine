import { describe, expect, it } from 'vitest'
import { validateRuntimeConfig } from '../../config/runtime-config'
import { createConfigWithPages } from './helpers'

describe('validateRuntimeConfig', () => {
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
  })

  it('accepts a button with an openModal action referencing a declared modal', () => {
    const result = validateRuntimeConfig(
      createConfigWithPages([
        {
          id: 'home',
          layout: [
            { type: 'modal', id: 'dialog' },
            {
              type: 'button',
              props: { label: 'Open', action: { type: 'openModal', modalId: 'dialog' } },
            },
          ],
        },
      ]),
    )
    expect(result.status).toBe('ready')
    if (result.status === 'ready') {
      const button = result.config.pages[0].layout[1]
      expect(button).toEqual({
        type: 'button',
        props: { label: 'Open', action: { type: 'openModal', modalId: 'dialog' } },
      })
    }
  })

  it('accepts a button with a closeModal action referencing a declared modal', () => {
    const result = validateRuntimeConfig(
      createConfigWithPages([
        {
          id: 'home',
          layout: [
            { type: 'modal', id: 'dialog' },
            {
              type: 'button',
              props: { label: 'Close', action: { type: 'closeModal', modalId: 'dialog' } },
            },
          ],
        },
      ]),
    )
    expect(result.status).toBe('ready')
    if (result.status === 'ready') {
      const button = result.config.pages[0].layout[1]
      expect(button).toEqual({
        type: 'button',
        props: { label: 'Close', action: { type: 'closeModal', modalId: 'dialog' } },
      })
    }
  })

  it('rejects openModal action without modalId', () => {
    expect(
      validateRuntimeConfig(
        createConfigWithPages([
          {
            id: 'home',
            layout: [
              {
                type: 'button',
                props: { label: 'Broken', action: { type: 'openModal' } },
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
        message: 'Page "home" has an invalid layout at "layout[0].props.action.modalId".',
      },
    })
  })

  it('rejects openModal action with empty modalId', () => {
    expect(
      validateRuntimeConfig(
        createConfigWithPages([
          {
            id: 'home',
            layout: [
              {
                type: 'button',
                props: { label: 'Broken', action: { type: 'openModal', modalId: '   ' } },
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
        message: 'Page "home" has an invalid layout at "layout[0].props.action.modalId".',
      },
    })
  })

  it('rejects closeModal action without modalId', () => {
    expect(
      validateRuntimeConfig(
        createConfigWithPages([
          {
            id: 'home',
            layout: [
              {
                type: 'button',
                props: { label: 'Broken', action: { type: 'closeModal' } },
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
        message: 'Page "home" has an invalid layout at "layout[0].props.action.modalId".',
      },
    })
  })

  it('rejects closeModal action with empty modalId', () => {
    expect(
      validateRuntimeConfig(
        createConfigWithPages([
          {
            id: 'home',
            layout: [
              {
                type: 'button',
                props: { label: 'Broken', action: { type: 'closeModal', modalId: '' } },
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
        message: 'Page "home" has an invalid layout at "layout[0].props.action.modalId".',
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

  it('accepts a link node with props.href and props.label', () => {
    const result = validateRuntimeConfig(
      createConfigWithPages([
        {
          id: 'home',
          layout: [
            {
              type: 'link',
              props: {
                label: 'Go',
                href: 'https://example.com',
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
      type: 'link',
      props: {
        label: 'Go',
        href: 'https://example.com',
      },
    })
  })

  it('rejects a link node without props.label', () => {
    expect(
      validateRuntimeConfig(
        createConfigWithPages([
          {
            id: 'home',
            layout: [
              {
                type: 'link',
                props: {
                  href: 'https://example.com',
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

  it('rejects a link node with empty props (no label)', () => {
    expect(
      validateRuntimeConfig(
        createConfigWithPages([
          {
            id: 'home',
            layout: [
              {
                type: 'link',
                props: {},
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

  it('accepts a link node with navigateTo action to an existing page', () => {
    const result = validateRuntimeConfig(
      createConfigWithPages([
        {
          id: 'home',
          layout: [
            {
              type: 'link',
              props: {
                label: 'Go to details',
                action: { type: 'navigateTo', pageId: 'details' },
              },
            },
          ],
        },
        { id: 'details', layout: [] },
      ]),
    )
    expect(result.status).toBe('ready')
    if (result.status === 'ready') {
      expect(result.config.pages[0].layout[0]).toEqual({
        type: 'link',
        props: { label: 'Go to details', action: { type: 'navigateTo', pageId: 'details' } },
      })
    }
  })

  it('accepts a link node with goBack action', () => {
    const result = validateRuntimeConfig(
      createConfigWithPages([
        {
          id: 'home',
          layout: [
            {
              type: 'link',
              props: {
                label: 'Back',
                action: { type: 'goBack' },
              },
            },
          ],
        },
      ]),
    )
    expect(result.status).toBe('ready')
    if (result.status === 'ready') {
      expect(result.config.pages[0].layout[0]).toEqual({
        type: 'link',
        props: { label: 'Back', action: { type: 'goBack' } },
      })
    }
  })

  it('accepts a link node with download and href', () => {
    const result = validateRuntimeConfig(
      createConfigWithPages([
        {
          id: 'home',
          layout: [
            {
              type: 'link',
              props: {
                label: 'Download',
                href: 'https://example.com/file.pdf',
                download: 'file.pdf',
              },
            },
          ],
        },
      ]),
    )
    expect(result.status).toBe('ready')
    if (result.status === 'ready') {
      expect(result.config.pages[0].layout[0]).toEqual({
        type: 'link',
        props: {
          label: 'Download',
          href: 'https://example.com/file.pdf',
          download: 'file.pdf',
        },
      })
    }
  })

  it('accepts a link node with target "_blank" and href', () => {
    const result = validateRuntimeConfig(
      createConfigWithPages([
        {
          id: 'home',
          layout: [
            {
              type: 'link',
              props: {
                label: 'Open',
                href: 'https://example.com',
                target: '_blank',
              },
            },
          ],
        },
      ]),
    )
    expect(result.status).toBe('ready')
    if (result.status === 'ready') {
      expect(result.config.pages[0].layout[0]).toEqual({
        type: 'link',
        props: { label: 'Open', href: 'https://example.com', target: '_blank' },
      })
    }
  })

  it('rejects a link node without href nor action', () => {
    expect(
      validateRuntimeConfig(
        createConfigWithPages([
          {
            id: 'home',
            layout: [
              {
                type: 'link',
                props: { label: 'Broken' },
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
        message: 'Page "home" has an invalid layout at "layout[0]": link nodes must have either props.href or props.action.',
      },
    })
  })

  it('rejects a link node with both href and action', () => {
    expect(
      validateRuntimeConfig(
        createConfigWithPages([
          {
            id: 'home',
            layout: [
              {
                type: 'link',
                props: {
                  label: 'Broken',
                  href: 'https://example.com',
                  action: { type: 'goBack' },
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
        message: 'Page "home" has an invalid layout at "layout[0]": link nodes cannot have both props.href and props.action.',
      },
    })
  })

  it('rejects a link node with download but no href', () => {
    expect(
      validateRuntimeConfig(
        createConfigWithPages([
          {
            id: 'home',
            layout: [
              {
                type: 'link',
                props: {
                  label: 'Broken',
                  action: { type: 'goBack' },
                  download: 'file.pdf',
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
        message: 'Page "home" has an invalid layout at "layout[0].props.download": download requires props.href.',
      },
    })
  })

  it('rejects a link node with target but no href', () => {
    expect(
      validateRuntimeConfig(
        createConfigWithPages([
          {
            id: 'home',
            layout: [
              {
                type: 'link',
                props: {
                  label: 'Broken',
                  action: { type: 'goBack' },
                  target: '_blank',
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
        message: 'Page "home" has an invalid layout at "layout[0].props.target": target requires props.href.',
      },
    })
  })

  it('rejects a link node with action type executeOperation', () => {
    expect(
      validateRuntimeConfig(
        createConfigWithPages([
          {
            id: 'home',
            layout: [
              {
                type: 'link',
                props: {
                  label: 'Broken',
                  action: { type: 'executeOperation', operationName: 'foo' },
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

  it('rejects a link node with navigateTo action pointing to an unknown page', () => {
    expect(
      validateRuntimeConfig(
        createConfigWithPages([
          {
            id: 'home',
            layout: [
              {
                type: 'link',
                props: {
                  label: 'Broken',
                  action: { type: 'navigateTo', pageId: 'missing-page' },
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
        message: 'Page "home" has an invalid layout at "layout[0].props.action.pageId": unknown page "missing-page".',
      },
    })
  })

  it('rejects a link node with navigateTo action without pageId', () => {
    expect(
      validateRuntimeConfig(
        createConfigWithPages([
          {
            id: 'home',
            layout: [
              {
                type: 'link',
                props: {
                  label: 'Broken',
                  action: { type: 'navigateTo' },
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
        message: 'Page "home" has an invalid layout at "layout[0].props.action.pageId".',
      },
    })
  })

  it('accepts a link node with visibility, queryStateFeedback and layout.span', () => {
    const result = validateRuntimeConfig(
      createConfigWithPages([
        {
          id: 'home',
          layout: [
            {
              type: 'link',
              props: {
                label: 'Go',
                href: 'https://example.com',
              },
              visibility: { reference: 'queries.q.data', operator: 'isTruthy' },
              queryStateFeedback: { query: 'queries.q' },
              layout: { span: 6 },
            },
          ],
        },
      ]),
    )
    expect(result.status).toBe('ready')
    if (result.status === 'ready') {
      const node = result.config.pages[0].layout[0] as { type: string; visibility?: unknown; queryStateFeedback?: unknown; layout?: unknown }
      expect(node.type).toBe('link')
      expect(node.visibility).toEqual({ reference: 'queries.q.data', operator: 'isTruthy' })
      expect(node.queryStateFeedback).toEqual({ query: 'queries.q' })
      expect(node.layout).toEqual({ span: 6 })
    }
  })

  it('does not propagate children from a link node', () => {
    const result = validateRuntimeConfig(
      createConfigWithPages([
        {
          id: 'home',
          layout: [
            {
              type: 'link',
              props: { label: 'Go', href: 'https://example.com' },
              children: [{ type: 'paragraph', props: { text: 'Ignored' } }],
            },
          ],
        },
      ]),
    )
    expect(result.status).toBe('ready')
    if (result.status === 'ready') {
      const node = result.config.pages[0].layout[0] as Record<string, unknown>
      expect(node.children).toBeUndefined()
    }
  })

  it('accepts a button node with an executeOperations action with two valid entries', () => {
    const result = validateRuntimeConfig({
      api: {
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
                label: 'Delete and reload',
                action: {
                  type: 'executeOperations',
                  operations: [
                    { operationName: 'deleteItem' },
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

    expect(result.config.pages[0].layout[0]).toEqual({
      type: 'button',
      props: {
        label: 'Delete and reload',
        action: {
          type: 'executeOperations',
          operations: [
            { operationName: 'deleteItem' },
            { operationName: 'reloadList', query: { page: 1 } },
          ],
        },
      },
    })
  })

  it('accepts a button node with an executeOperations action with a single entry', () => {
    const result = validateRuntimeConfig({
      api: {
        reloadList: { method: 'GET', endpoint: '/api/items' },
      },
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'button',
              props: {
                label: 'Reload',
                action: {
                  type: 'executeOperations',
                  operations: [{ operationName: 'reloadList' }],
                },
              },
            },
          ],
        },
      ],
      initialPage: 'home',
    })

    expect(result.status).toBe('ready')
  })

  it('rejects executeOperations without operations field', () => {
    expect(
      validateRuntimeConfig({
        api: {},
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
        message: expect.stringContaining('props.action.operations'),
      },
    })
  })

  it('rejects executeOperations with an empty operations array', () => {
    expect(
      validateRuntimeConfig({
        api: {},
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
                    operations: [],
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
        message: expect.stringContaining('props.action.operations'),
      },
    })
  })

  it('rejects executeOperations when an entry does not declare operationName', () => {
    expect(
      validateRuntimeConfig({
        api: {},
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
                    operations: [{}],
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
        message: expect.stringContaining('props.action.operations[0].operationName'),
      },
    })
  })

  it('rejects executeOperations when an entry declares an empty operationName', () => {
    expect(
      validateRuntimeConfig({
        api: {},
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
                    operations: [{ operationName: '   ' }],
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
        message: expect.stringContaining('props.action.operations[0].operationName'),
      },
    })
  })

  it('rejects executeOperations when an entry has invalid query value', () => {
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
                    operations: [{ operationName: 'myOp', query: { filters: { active: true } } }],
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
        message: expect.stringContaining('props.action.operations[0].query'),
      },
    })
  })

  it('rejects executeOperations when an entry has invalid headers value', () => {
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
                    operations: [{ operationName: 'myOp', headers: { authorization: 123 } }],
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
        message: expect.stringContaining('props.action.operations[0].headers'),
      },
    })
  })

  it('rejects executeOperations when an entry has invalid body value', () => {
    expect(
      validateRuntimeConfig({
        api: { myOp: { method: 'POST', endpoint: '/api/items' } },
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
                    operations: [{ operationName: 'myOp', body: { date: new Date() } }],
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
        message: expect.stringContaining('props.action.operations[0].body'),
      },
    })
  })

  it('discards extra keys in executeOperations entries silently (.strip())', () => {
    const result = validateRuntimeConfig({
      api: { myOp: { method: 'GET', endpoint: '/api/items' } },
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'button',
              props: {
                label: 'Load',
                action: {
                  type: 'executeOperations',
                  operations: [{ operationName: 'myOp', unknownKey: 'ignored' }],
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

    const action = (result.config.pages[0].layout[0] as { props: { action: Record<string, unknown> } }).props.action as { operations: Record<string, unknown>[] }
    expect(action.operations[0]).not.toHaveProperty('unknownKey')
    expect(action.operations[0]).toEqual({ operationName: 'myOp' })
  })

  it('accepts executeOperations with an inexistent operationName (not pre-rejected)', () => {
    const result = validateRuntimeConfig({
      api: {},
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'button',
              props: {
                label: 'Load',
                action: {
                  type: 'executeOperations',
                  operations: [{ operationName: 'nonExistentOperation' }],
                },
              },
            },
          ],
        },
      ],
      initialPage: 'home',
    })

    expect(result.status).toBe('ready')
  })

  it('accepts a button node with props.icon as an arbitrary string without rejection', () => {
    const result = validateRuntimeConfig(
      createConfigWithPages([
        {
          id: 'home',
          layout: [
            {
              type: 'button',
              props: {
                label: 'Search',
                icon: 'Search',
                action: { type: 'goBack' },
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

    expect((result.config.pages[0].layout[0] as { props: { icon?: string } }).props.icon).toBe('Search')
  })

  it('accepts a button node with an unknown props.icon string without rejection', () => {
    const result = validateRuntimeConfig(
      createConfigWithPages([
        {
          id: 'home',
          layout: [
            {
              type: 'button',
              props: {
                label: 'Go',
                icon: 'SomeArbitraryIconName123',
                action: { type: 'goBack' },
              },
            },
          ],
        },
      ]),
    )

    expect(result.status).toBe('ready')
  })

  it('still rejects executeOperation (singular) with inexistent operationName (regression)', () => {
    expect(
      validateRuntimeConfig({
        api: {
          searchUsers: { method: 'GET', endpoint: '/api/users' },
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
    ).toMatchObject({
      status: 'error',
      error: {
        code: 'invalid-layout',
        message: expect.stringContaining('unknown operation "missingOperation"'),
      },
    })
  })

  it('accepts a link node with props.icon as an arbitrary string without rejection', () => {
    const result = validateRuntimeConfig(
      createConfigWithPages([
        {
          id: 'home',
          layout: [
            {
              type: 'link',
              props: {
                label: 'Visit',
                href: 'https://example.com',
                icon: 'ExternalLink',
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

    expect((result.config.pages[0].layout[0] as { props: { icon?: string } }).props.icon).toBe('ExternalLink')
  })

  it('accepts a link node with an unknown props.icon string without rejection', () => {
    const result = validateRuntimeConfig(
      createConfigWithPages([
        {
          id: 'home',
          layout: [
            {
              type: 'link',
              props: {
                label: 'Visit',
                href: 'https://example.com',
                icon: 'SomeArbitraryIconName123',
              },
            },
          ],
        },
      ]),
    )

    expect(result.status).toBe('ready')
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
})
