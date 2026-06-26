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

  it('rejects a link node without props.label and without children', () => {
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
        message: 'Page "home" has an invalid layout at "layout[0]": link nodes must have either props.label or children.',
      },
    })
  })

  it('rejects a link node with empty props (no label, no children)', () => {
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
        message: 'Page "home" has an invalid layout at "layout[0]": link nodes must have either props.label or children.',
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

  it('propagates children when link has valid children and no props.label', () => {
    const result = validateRuntimeConfig(
      createConfigWithPages([
        {
          id: 'home',
          layout: [
            {
              type: 'link',
              props: { href: 'https://example.com' },
              children: [{ type: 'paragraph', props: { text: 'Click me' } }],
            },
          ],
        },
      ]),
    )
    expect(result.status).toBe('ready')
    if (result.status === 'ready') {
      const node = result.config.pages[0].layout[0] as Record<string, unknown>
      expect(Array.isArray(node.children)).toBe(true)
    }
  })

  it('does not include children key when link uses props.label and no children', () => {
    const result = validateRuntimeConfig(
      createConfigWithPages([
        {
          id: 'home',
          layout: [
            {
              type: 'link',
              props: { label: 'Go', href: 'https://example.com' },
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

  it('accepts a link with children containing a single paragraph and props.href', () => {
    const result = validateRuntimeConfig(
      createConfigWithPages([
        {
          id: 'home',
          layout: [
            {
              type: 'link',
              props: { href: 'https://example.com' },
              children: [{ type: 'paragraph', props: { text: 'Click me' } }],
            },
          ],
        },
      ]),
    )
    expect(result.status).toBe('ready')
    if (result.status === 'ready') {
      const node = result.config.pages[0].layout[0] as { type: string; props: Record<string, unknown>; children: unknown[] }
      expect(node.type).toBe('link')
      expect(Array.isArray(node.children)).toBe(true)
      expect(node.children).toHaveLength(1)
      expect((node.children[0] as { type: string }).type).toBe('paragraph')
      expect(node.props.label).toBeUndefined()
    }
  })

  it('accepts a link with children containing container wrapping heading and paragraph, with navigateTo action', () => {
    const result = validateRuntimeConfig(
      createConfigWithPages([
        {
          id: 'home',
          layout: [
            {
              type: 'link',
              props: { action: { type: 'navigateTo', pageId: 'details' } },
              children: [
                {
                  type: 'container',
                  children: [
                    { type: 'heading', props: { text: 'Title', level: 2 } },
                    { type: 'paragraph', props: { text: 'Body' } },
                  ],
                },
              ],
            },
          ],
        },
        { id: 'details', layout: [] },
      ]),
    )
    expect(result.status).toBe('ready')
    if (result.status === 'ready') {
      const node = result.config.pages[0].layout[0] as { type: string; children: unknown[] }
      expect(node.type).toBe('link')
      expect(Array.isArray(node.children)).toBe(true)
      expect(node.children).toHaveLength(1)
    }
  })

  it('accepts a link with children containing a single divider', () => {
    const result = validateRuntimeConfig(
      createConfigWithPages([
        {
          id: 'home',
          layout: [
            {
              type: 'link',
              props: { href: 'https://example.com' },
              children: [{ type: 'divider' }],
            },
          ],
        },
      ]),
    )
    expect(result.status).toBe('ready')
  })

  it('accepts a link with children containing a container without its own children', () => {
    const result = validateRuntimeConfig(
      createConfigWithPages([
        {
          id: 'home',
          layout: [
            {
              type: 'link',
              props: { href: 'https://example.com' },
              children: [{ type: 'container' }],
            },
          ],
        },
      ]),
    )
    expect(result.status).toBe('ready')
  })

  it('accepts a link with children, props.target "_blank" and props.href', () => {
    const result = validateRuntimeConfig(
      createConfigWithPages([
        {
          id: 'home',
          layout: [
            {
              type: 'link',
              props: { href: 'https://example.com', target: '_blank' },
              children: [{ type: 'paragraph', props: { text: 'Open' } }],
            },
          ],
        },
      ]),
    )
    expect(result.status).toBe('ready')
  })

  it('accepts a link with children, props.download and props.href', () => {
    const result = validateRuntimeConfig(
      createConfigWithPages([
        {
          id: 'home',
          layout: [
            {
              type: 'link',
              props: { href: 'https://example.com/file.pdf', download: 'file.pdf' },
              children: [{ type: 'paragraph', props: { text: 'Download' } }],
            },
          ],
        },
      ]),
    )
    expect(result.status).toBe('ready')
  })

  it('accepts a link with props.label and props.icon without children (no regression)', () => {
    const result = validateRuntimeConfig(
      createConfigWithPages([
        {
          id: 'home',
          layout: [
            {
              type: 'link',
              props: { label: 'Visit', href: 'https://example.com', icon: 'ExternalLink' },
            },
          ],
        },
      ]),
    )
    expect(result.status).toBe('ready')
    if (result.status === 'ready') {
      const node = result.config.pages[0].layout[0] as { props: { label: string; icon?: string } }
      expect(node.props.label).toBe('Visit')
      expect(node.props.icon).toBe('ExternalLink')
    }
  })

  it('rejects a link with both children and props.label', () => {
    expect(
      validateRuntimeConfig(
        createConfigWithPages([
          {
            id: 'home',
            layout: [
              {
                type: 'link',
                props: { label: 'Go', href: 'https://example.com' },
                children: [{ type: 'paragraph', props: { text: 'Click' } }],
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
        message: 'Page "home" has an invalid layout at "layout[0]": link nodes cannot have both props.label and children.',
      },
    })
  })

  it('rejects a link with both children and props.icon', () => {
    expect(
      validateRuntimeConfig(
        createConfigWithPages([
          {
            id: 'home',
            layout: [
              {
                type: 'link',
                props: { icon: 'Star', href: 'https://example.com' },
                children: [{ type: 'paragraph', props: { text: 'Click' } }],
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
        message: 'Page "home" has an invalid layout at "layout[0]": link nodes cannot have both props.icon and children.',
      },
    })
  })

  it('rejects a link without children and without props.label', () => {
    expect(
      validateRuntimeConfig(
        createConfigWithPages([
          {
            id: 'home',
            layout: [
              {
                type: 'link',
                props: { href: 'https://example.com' },
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
        message: 'Page "home" has an invalid layout at "layout[0]": link nodes must have either props.label or children.',
      },
    })
  })

  it('rejects a link with empty children array', () => {
    expect(
      validateRuntimeConfig(
        createConfigWithPages([
          {
            id: 'home',
            layout: [
              {
                type: 'link',
                props: { href: 'https://example.com' },
                children: [],
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
        message: 'Page "home" has an invalid layout at "layout[0].children": link children cannot be empty.',
      },
    })
  })

  it('rejects a link with children containing a directly prohibited type (button)', () => {
    expect(
      validateRuntimeConfig(
        createConfigWithPages([
          {
            id: 'home',
            layout: [
              {
                type: 'link',
                props: { href: 'https://example.com' },
                children: [{ type: 'button', props: { label: 'Click' } }],
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
          'Page "home" has an invalid layout at "layout[0].children[0]": link children may only be container, heading, paragraph, list, image, badge, alert, stat, divider or skeleton nodes.',
      },
    })
  })

  it('rejects a link with children containing a container whose children include a button (deep validation)', () => {
    expect(
      validateRuntimeConfig(
        createConfigWithPages([
          {
            id: 'home',
            layout: [
              {
                type: 'link',
                props: { href: 'https://example.com' },
                children: [
                  {
                    type: 'container',
                    children: [
                      { type: 'paragraph', props: { text: 'OK' } },
                      { type: 'button', props: { label: 'Nope' } },
                    ],
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
          'Page "home" has an invalid layout at "layout[0].children[0].children[1]": link children may only be container, heading, paragraph, list, image, badge, alert, stat, divider or skeleton nodes.',
      },
    })
  })

  it('rejects a link with a nested link inside children', () => {
    expect(
      validateRuntimeConfig(
        createConfigWithPages([
          {
            id: 'home',
            layout: [
              {
                type: 'link',
                props: { href: 'https://example.com' },
                children: [{ type: 'link', props: { label: 'Inner', href: 'https://inner.com' } }],
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
          'Page "home" has an invalid layout at "layout[0].children[0]": link children may only be container, heading, paragraph, list, image, badge, alert, stat, divider or skeleton nodes.',
      },
    })
  })

  it('rejects a link with a repeater inside children', () => {
    expect(
      validateRuntimeConfig(
        createConfigWithPages([
          {
            id: 'home',
            layout: [
              {
                type: 'link',
                props: { href: 'https://example.com' },
                children: [
                  {
                    type: 'repeater',
                    props: {
                      items: { source: 'queries.list.data', key: 'id' },
                      template: [{ type: 'paragraph', props: { text: 'item.name' } }],
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
          'Page "home" has an invalid layout at "layout[0].children[0]": link children may only be container, heading, paragraph, list, image, badge, alert, stat, divider or skeleton nodes.',
      },
    })
  })

  it('rejects a link with children and props.action: navigateTo when props.download is also present', () => {
    expect(
      validateRuntimeConfig(
        createConfigWithPages([
          {
            id: 'home',
            layout: [
              {
                type: 'link',
                props: {
                  action: { type: 'navigateTo', pageId: 'details' },
                  download: 'file.pdf',
                },
                children: [{ type: 'paragraph', props: { text: 'Click' } }],
              },
            ],
          },
          { id: 'details', layout: [] },
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

  it('rejects a link with children and props.action: navigateTo when props.target is also present', () => {
    expect(
      validateRuntimeConfig(
        createConfigWithPages([
          {
            id: 'home',
            layout: [
              {
                type: 'link',
                props: {
                  action: { type: 'navigateTo', pageId: 'details' },
                  target: '_blank',
                },
                children: [{ type: 'paragraph', props: { text: 'Click' } }],
              },
            ],
          },
          { id: 'details', layout: [] },
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

  // T2: when in executeOperations entries (structural schema tests)

  it('accepts button.props.action executeOperations entry with valid when shape', () => {
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
                  operations: [
                    {
                      operationName: 'reloadList',
                      when: { reference: 'queries.reloadList.data.flag', operator: 'isTruthy' },
                    },
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
    if (result.status !== 'ready') throw new Error('Expected ready')
    const action = (result.config.pages[0].layout[0] as { props: { action: { operations: unknown[] } } }).props.action
    expect(action.operations[0]).toEqual({
      operationName: 'reloadList',
      when: { reference: 'queries.reloadList.data.flag', operator: 'isTruthy' },
    })
  })

  it('rejects button.props.action executeOperations entry when when.operator is not a string', () => {
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
                  operations: [
                    {
                      operationName: 'op1',
                      when: { reference: 'queries.op1.data.flag', operator: 123 },
                    },
                  ],
                },
              },
            },
          ],
        },
      ],
      initialPage: 'home',
    })

    expect(result.status).toBe('error')
    if (result.status !== 'error') throw new Error('Expected error')
    expect(result.error.message).toContain('layout[0].props.action.operations[0].when')
  })

  it('rejects button.props.action navigateTo with when at root level (when not accepted at action root)', () => {
    const result = validateRuntimeConfig({
      api: {},
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'button',
              props: {
                label: 'Go somewhere',
                action: {
                  type: 'navigateTo',
                  pageId: 'home',
                  when: { reference: 'queries.x.data.flag', operator: 'isTruthy' },
                },
              },
            },
          ],
        },
      ],
      initialPage: 'home',
    })

    // navigateTo action schema uses .strip(), so when is silently dropped (not an error)
    // but the when key is NOT part of navigateTo contract - it is stripped silently
    expect(result.status).toBe('ready')
    if (result.status !== 'ready') throw new Error('Expected ready')
    const action = (result.config.pages[0].layout[0] as { props: { action: Record<string, unknown> } }).props.action
    // when key should have been stripped
    expect(action.when).toBeUndefined()
  })

  // T3: semantic validation of when.reference in executeOperations entries

  it('accepts button executeOperations entry when with params.* reference', () => {
    const result = validateRuntimeConfig({
      api: {},
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'button',
              props: {
                label: 'Run',
                action: {
                  type: 'executeOperations',
                  operations: [
                    {
                      operationName: 'op1',
                      when: { reference: 'params.id', operator: 'isTruthy' },
                    },
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
  })

  it('accepts button executeOperations entry when with item.* reference', () => {
    const result = validateRuntimeConfig({
      api: {},
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'repeater',
              props: {
                items: { source: 'queries.posts.data', key: 'id' },
                template: [
                  {
                    type: 'button',
                    props: {
                      label: 'Run',
                      action: {
                        type: 'executeOperations',
                        operations: [
                          {
                            operationName: 'op1',
                            when: { reference: 'item.x', operator: 'isTruthy' },
                          },
                        ],
                      },
                    },
                  },
                ],
              },
            },
          ],
        },
      ],
      initialPage: 'home',
    })

    expect(result.status).toBe('ready')
  })

  it('accepts button executeOperations entry when with queries.* reference', () => {
    const result = validateRuntimeConfig({
      api: {},
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'button',
              props: {
                label: 'Run',
                action: {
                  type: 'executeOperations',
                  operations: [
                    {
                      operationName: 'op1',
                      when: { reference: 'queries.x.data.flag', operator: 'isTruthy' },
                    },
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
  })

  it('rejects button executeOperations entry when with operator outside catalog', () => {
    const result = validateRuntimeConfig({
      api: {},
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'button',
              props: {
                label: 'Run',
                action: {
                  type: 'executeOperations',
                  operations: [
                    {
                      operationName: 'op1',
                      when: { reference: 'queries.x.data.flag', operator: 'contains' },
                    },
                  ],
                },
              },
            },
          ],
        },
      ],
      initialPage: 'home',
    })

    expect(result.status).toBe('error')
    if (result.status !== 'error') throw new Error('Expected error')
    expect(result.error.message).toContain('layout[0].props.action.operations[0].when')
  })

  it('rejects button executeOperations entry when isTruthy with a value declared', () => {
    const result = validateRuntimeConfig({
      api: {},
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'button',
              props: {
                label: 'Run',
                action: {
                  type: 'executeOperations',
                  operations: [
                    {
                      operationName: 'op1',
                      when: { reference: 'queries.x.data.flag', operator: 'isTruthy', value: 'bad' },
                    },
                  ],
                },
              },
            },
          ],
        },
      ],
      initialPage: 'home',
    })

    expect(result.status).toBe('error')
    if (result.status !== 'error') throw new Error('Expected error')
    expect(result.error.message).toContain('layout[0].props.action.operations[0].when')
  })

  // T4: cross-validation — button executeOperations with when and non-existent operationName

  it('accepts button.props.action executeOperations with valid when and inexistent operationName (not pre-rejected at bootstrap)', () => {
    const result = validateRuntimeConfig({
      api: {},
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'button',
              props: {
                label: 'Run',
                action: {
                  type: 'executeOperations',
                  operations: [
                    {
                      operationName: 'nonExistentOp',
                      when: { reference: 'queries.x.data.flag', operator: 'isTruthy' },
                    },
                  ],
                },
              },
            },
          ],
        },
      ],
      initialPage: 'home',
    })

    // executeOperations operationName is not cross-checked at bootstrap per current contract
    expect(result.status).toBe('ready')
  })

  describe('tokens.* gating in button actions', () => {
    it('accepts tokens.* in button.props.action.headers for executeOperation', () => {
      const result = validateRuntimeConfig({
        api: { op: { method: 'GET', endpoint: '/api/x' } },
        pages: [
          {
            id: 'home',
            layout: [
              {
                type: 'button',
                props: {
                  label: 'Load',
                  action: {
                    type: 'executeOperation',
                    operationName: 'op',
                    headers: { Authorization: 'tokens.session.value' },
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

    it('rejects tokens.* in button.props.action.query for executeOperation', () => {
      const result = validateRuntimeConfig({
        api: { op: { method: 'GET', endpoint: '/api/x' } },
        pages: [
          {
            id: 'home',
            layout: [
              {
                type: 'button',
                props: {
                  label: 'Load',
                  action: {
                    type: 'executeOperation',
                    operationName: 'op',
                    query: { token: 'tokens.session.value' },
                  },
                },
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

    it('rejects tokens.* in button.props.action.body for executeOperation', () => {
      const result = validateRuntimeConfig({
        api: { op: { method: 'POST', endpoint: '/api/x' } },
        pages: [
          {
            id: 'home',
            layout: [
              {
                type: 'button',
                props: {
                  label: 'Save',
                  action: {
                    type: 'executeOperation',
                    operationName: 'op',
                    body: { token: 'tokens.session.value' },
                  },
                },
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

    it('accepts tokens.* in executeOperations.operations[].headers', () => {
      const result = validateRuntimeConfig({
        api: { op: { method: 'GET', endpoint: '/api/x' } },
        pages: [
          {
            id: 'home',
            layout: [
              {
                type: 'button',
                props: {
                  label: 'Run',
                  action: {
                    type: 'executeOperations',
                    operations: [
                      { operationName: 'op', headers: { Authorization: 'tokens.session.value' } },
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
    })

    it('rejects tokens.* in executeOperations.operations[].query', () => {
      const result = validateRuntimeConfig({
        api: { op: { method: 'GET', endpoint: '/api/x' } },
        pages: [
          {
            id: 'home',
            layout: [
              {
                type: 'button',
                props: {
                  label: 'Run',
                  action: {
                    type: 'executeOperations',
                    operations: [
                      { operationName: 'op', query: { token: 'tokens.session.value' } },
                    ],
                  },
                },
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

    it('rejects tokens.* in button.props.action.params for navigateTo', () => {
      const result = validateRuntimeConfig({
        api: {},
        pages: [
          {
            id: 'home',
            layout: [
              {
                type: 'button',
                props: {
                  label: 'Go',
                  action: {
                    type: 'navigateTo',
                    pageId: 'details',
                    params: { token: 'tokens.session.value' },
                  },
                },
              },
            ],
          },
          { id: 'details', layout: [] },
        ],
        initialPage: 'home',
      })
      expect(result.status).toBe('error')
      if (result.status === 'error') {
        expect(result.error.message).toContain('tokens.*')
      }
    })
  })
})
