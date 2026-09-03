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
        message: `Page "home" has an invalid layout at "layout[0].props".
  → button[0]
  Node: {"type":"button"}`,
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
        message: `Page "home" has an invalid layout at "layout[0].props.label".
  → button[0]
  Node: {"type":"button"}`,
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
        message: `Page "home" has an invalid layout at "layout[0].props.label".
  → button[0]
  Node: {"type":"button"}`,
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
        message: `Page "home" has an invalid layout at "layout[0].props.action.type".
  → button("Broken")
  Node: {"type":"button","props":{"label":"Broken"}}`,
      },
    })
  })

  it('rejects a button action with an unrecognized type value at the Zod discriminated union level', () => {
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
                    type: 'doSomethingUnsupported',
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
        message: `Page "home" has an invalid layout at "layout[0].props.action.type".
  → button("Broken")
  Node: {"type":"button","props":{"label":"Broken"}}`,
      },
    })
  })

  it('accepts a button node without props.action when it is a descendant of a form node', () => {
    const result = validateRuntimeConfig(
      createConfigWithPages([
        {
          id: 'home',
          layout: [
            {
              type: 'form',
              id: 'my-form',
              children: [
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
      ]),
    )

    expect(result.status).toBe('ready')
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
        message: `Page "home" has an invalid layout at "layout[0].props.action.modalId".
  → button("Broken")
  Node: {"type":"button","props":{"label":"Broken"}}`,
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
        message: `Page "home" has an invalid layout at "layout[0].props.action.modalId".
  → button("Broken")
  Node: {"type":"button","props":{"label":"Broken"}}`,
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
        message: `Page "home" has an invalid layout at "layout[0].props.action.modalId".
  → button("Broken")
  Node: {"type":"button","props":{"label":"Broken"}}`,
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
        message: `Page "home" has an invalid layout at "layout[0].props.action.modalId".
  → button("Broken")
  Node: {"type":"button","props":{"label":"Broken"}}`,
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
        message: `Page "home" has an invalid layout at "layout[0]": button nodes without an action must be descendants of a form node.
  → button("Broken")
  Node: {"type":"button","props":{"label":"Broken"}}`,
      },
    })
  })

  it('rejects a switch button without props.action', () => {
    expect(
      validateRuntimeConfig(
        createConfigWithPages([
          {
            id: 'home',
            layout: [
              {
                type: 'button',
                props: {
                  label: 'Enabled',
                  variant: 'switch',
                  checked: true,
                },
              },
            ],
          },
        ]),
      ),
    ).toMatchObject({
      status: 'error',
      error: {
        code: 'invalid-layout',
        message: expect.stringContaining('props.action'),
      },
    })
  })

  it('rejects a switch button without props.action outside a form via the switch-specific rule, not the generic form rule', () => {
    const result = validateRuntimeConfig(
      createConfigWithPages([
        {
          id: 'home',
          layout: [
            {
              type: 'button',
              props: {
                label: 'Enabled',
                variant: 'switch',
                checked: true,
              },
            },
          ],
        },
      ]),
    )

    expect(result.status).toBe('error')

    if (result.status !== 'error') {
      throw new Error('Expected error result')
    }

    expect(result.error.message).not.toContain('must be descendants of a form node')
    expect(result.error.message).toContain('variant "switch"')
  })

  it('accepts a switch button with props.action present outside a form (does not trigger the generic action-required rule)', () => {
    const result = validateRuntimeConfig(
      createConfigWithPages([
        {
          id: 'home',
          layout: [
            {
              type: 'button',
              props: {
                label: 'Enabled',
                variant: 'switch',
                checked: true,
                action: { type: 'goBack' },
              },
            },
          ],
        },
      ]),
    )

    expect(result.status).toBe('ready')
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
        message: `Page "home" has an invalid layout at "layout[0].props.action.pageId".
  → button("Missing page")
  Node: {"type":"button","props":{"label":"Missing page"}}`,
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
        message: `Page "home" has an invalid layout at "layout[0].props.action.pageId".
  → button("Empty page")
  Node: {"type":"button","props":{"label":"Empty page"}}`,
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
        message: `Page "home" has an invalid layout at "layout[0].props.action.pageId": unknown page "missing-page".
  → button("Unknown page")
  Node: {"type":"button","props":{"label":"Unknown page"}}`,
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
        message: `Page "home" has an invalid layout at "layout[0].props.action.operationName".
  → button("Broken")
  Node: {"type":"button","props":{"label":"Broken"}}`,
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
        message: `Page "home" has an invalid layout at "layout[0].props.action.operationName".
  → button("Broken")
  Node: {"type":"button","props":{"label":"Broken"}}`,
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
          `Page "home" has an invalid layout at "layout[0].props.action.operationName": unknown operation "missingOperation".
  → button("Broken")
  Node: {"type":"button","props":{"label":"Broken"}}`,
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
        message: `Page "home" has an invalid layout at "layout[0]": link nodes must have either props.label or children.
  → link[0]
  Node: {"type":"link"}`,
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
        message: `Page "home" has an invalid layout at "layout[0]": link nodes must have either props.label or children.
  → link[0]
  Node: {"type":"link"}`,
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
        message: `Page "home" has an invalid layout at "layout[0]": link nodes must have either props.href or props.action.
  → link("Broken")
  Node: {"type":"link","props":{"label":"Broken"}}`,
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
        message: `Page "home" has an invalid layout at "layout[0]": link nodes cannot have both props.href and props.action.
  → link("Broken")
  Node: {"type":"link","props":{"label":"Broken"}}`,
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
        message: `Page "home" has an invalid layout at "layout[0].props.download": download requires props.href.
  → link("Broken")
  Node: {"type":"link","props":{"label":"Broken"}}`,
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
        message: `Page "home" has an invalid layout at "layout[0].props.target": target requires props.href.
  → link("Broken")
  Node: {"type":"link","props":{"label":"Broken"}}`,
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
        message: `Page "home" has an invalid layout at "layout[0].props.action.type".
  → link("Broken")
  Node: {"type":"link","props":{"label":"Broken"}}`,
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
        message: `Page "home" has an invalid layout at "layout[0].props.action.pageId": unknown page "missing-page".
  → link("Broken")
  Node: {"type":"link","props":{"label":"Broken"}}`,
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
        message: `Page "home" has an invalid layout at "layout[0].props.action.pageId".
  → link("Broken")
  Node: {"type":"link","props":{"label":"Broken"}}`,
      },
    })
  })

  it('rejects a link action with an unrecognized type value at the Zod discriminated union level', () => {
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
                  action: { type: 'doSomethingUnsupported' },
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
        message: `Page "home" has an invalid layout at "layout[0].props.action.type".
  → link("Broken")
  Node: {"type":"link","props":{"label":"Broken"}}`,
      },
    })
  })

  it('accepts a link node without props.action when props.href is present (mutually exclusive fields, no crash)', () => {
    const result = validateRuntimeConfig(
      createConfigWithPages([
        {
          id: 'home',
          layout: [
            {
              type: 'link',
              props: {
                label: 'Docs',
                href: 'https://example.com',
              },
            },
          ],
        },
      ]),
    )

    expect(result.status).toBe('ready')
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
        message: `Page "home" has an invalid layout at "layout[0]": link nodes cannot have both props.label and children.
  → link("Go")
  Node: {"type":"link","props":{"label":"Go"}}`,
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
        message: `Page "home" has an invalid layout at "layout[0]": link nodes cannot have both props.icon and children.
  → link[0]
  Node: {"type":"link"}`,
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
        message: `Page "home" has an invalid layout at "layout[0]": link nodes must have either props.label or children.
  → link[0]
  Node: {"type":"link"}`,
      },
    })
  })

  it('accepts a link node with props.href and an empty children array (no props.label)', () => {
    const result = validateRuntimeConfig(
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
    )
    expect(result.status).toBe('ready')
    if (result.status === 'ready') {
      const node = result.config.pages[0].layout[0] as { type: string; children: unknown[] }
      expect(node.type).toBe('link')
      expect(Array.isArray(node.children)).toBe(true)
      expect(node.children).toHaveLength(0)
    }
  })

  it('accepts a link node with props.href and an empty children array when nested inside a container', () => {
    const result = validateRuntimeConfig(
      createConfigWithPages([
        {
          id: 'home',
          layout: [
            {
              type: 'container',
              children: [
                {
                  type: 'link',
                  props: { href: 'https://example.com' },
                  children: [],
                },
              ],
            },
          ],
        },
      ]),
    )
    expect(result.status).toBe('ready')
    if (result.status === 'ready') {
      const containerNode = result.config.pages[0].layout[0] as { children: Array<{ type: string; children: unknown[] }> }
      const linkNode = containerNode.children[0]
      expect(linkNode.type).toBe('link')
      expect(Array.isArray(linkNode.children)).toBe(true)
      expect(linkNode.children).toHaveLength(0)
    }
  })

  it('rejects a link with both props.label and an empty children array (mutual exclusion, not the removed empty-children rule)', () => {
    expect(
      validateRuntimeConfig(
        createConfigWithPages([
          {
            id: 'home',
            layout: [
              {
                type: 'link',
                props: { label: 'Go', href: 'https://example.com' },
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
        message: `Page "home" has an invalid layout at "layout[0]": link nodes cannot have both props.label and children.
  → link("Go")
  Node: {"type":"link","props":{"label":"Go"}}`,
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
        message: `Page "home" has an invalid layout at "layout[0].props.download": download requires props.href.
  → link[0]
  Node: {"type":"link"}`,
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
        message: `Page "home" has an invalid layout at "layout[0].props.target": target requires props.href.
  → link[0]
  Node: {"type":"link"}`,
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
        message: `Page "home" has an invalid layout at "layout[0].props.action.formId".
  → button("Broken")
  Node: {"type":"button","props":{"label":"Broken"}}`,
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
        message: `Page "home" has an invalid layout at "layout[0].props.action.formId".
  → button("Broken")
  Node: {"type":"button","props":{"label":"Broken"}}`,
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

  // T-3: semantic validation of composed groups in executeOperations[*].when
  describe('button executeOperations when semantics — composed groups', () => {
    it('accepts button executeOperations entry with a valid group of two conditions', () => {
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
                        when: {
                          operator: 'and',
                          conditions: [
                            { reference: 'params.id', operator: 'isTruthy' },
                            { reference: 'queries.q.data.flag', operator: 'isTruthy' },
                          ],
                        },
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

    it('rejects button executeOperations entry with a group whose interior condition has an invalid reference (path .operations[0].when.conditions[0].reference)', () => {
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
                        when: {
                          operator: 'or',
                          conditions: [{ reference: 'navigation.currentPage', operator: 'isTruthy' }],
                        },
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
      expect(result.error.message).toContain('layout[0].props.action.operations[0].when.conditions[0].reference')
    })
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

  describe('switch.next gating in button actions', () => {
    it('accepts switch.next in props.action.query, body and headers for a switch button', () => {
      const result = validateRuntimeConfig({
        api: { toggle: { method: 'POST', endpoint: '/api/toggle' } },
        pages: [
          {
            id: 'home',
            layout: [
              {
                type: 'button',
                props: {
                  label: 'Toggle',
                  variant: 'switch',
                  checked: true,
                  action: {
                    type: 'executeOperation',
                    operationName: 'toggle',
                    query: { next: 'switch.next' },
                    body: { next: 'switch.next' },
                    headers: { 'X-Next': 'switch.next' },
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

    it('accepts switch.next in executeOperations operations[].query, body and headers for a switch button', () => {
      const result = validateRuntimeConfig({
        api: { toggle: { method: 'POST', endpoint: '/api/toggle' } },
        pages: [
          {
            id: 'home',
            layout: [
              {
                type: 'button',
                props: {
                  label: 'Toggle',
                  variant: 'switch',
                  checked: true,
                  action: {
                    type: 'executeOperations',
                    operations: [
                      {
                        operationName: 'toggle',
                        query: { next: 'switch.next' },
                        body: { next: 'switch.next' },
                        headers: { 'X-Next': 'switch.next' },
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

    it('rejects switch.next in props.action.query, body or headers when the button variant is not "switch" (including variant absent)', () => {
      const withoutVariant = validateRuntimeConfig({
        api: { toggle: { method: 'POST', endpoint: '/api/toggle' } },
        pages: [
          {
            id: 'home',
            layout: [
              {
                type: 'button',
                props: {
                  label: 'Toggle',
                  action: {
                    type: 'executeOperation',
                    operationName: 'toggle',
                    query: { next: 'switch.next' },
                  },
                },
              },
            ],
          },
        ],
        initialPage: 'home',
      })
      expect(withoutVariant.status).toBe('error')
      if (withoutVariant.status === 'error') {
        expect(withoutVariant.error.message).toContain('switch.next')
      }

      const withSolidVariant = validateRuntimeConfig({
        api: { toggle: { method: 'POST', endpoint: '/api/toggle' } },
        pages: [
          {
            id: 'home',
            layout: [
              {
                type: 'button',
                props: {
                  label: 'Toggle',
                  variant: 'solid',
                  action: {
                    type: 'executeOperation',
                    operationName: 'toggle',
                    body: { next: 'switch.next' },
                  },
                },
              },
            ],
          },
        ],
        initialPage: 'home',
      })
      expect(withSolidVariant.status).toBe('error')
      if (withSolidVariant.status === 'error') {
        expect(withSolidVariant.error.message).toContain('switch.next')
      }

      const withHeadersReference = validateRuntimeConfig({
        api: { toggle: { method: 'POST', endpoint: '/api/toggle' } },
        pages: [
          {
            id: 'home',
            layout: [
              {
                type: 'button',
                props: {
                  label: 'Toggle',
                  action: {
                    type: 'executeOperation',
                    operationName: 'toggle',
                    headers: { 'X-Next': 'switch.next' },
                  },
                },
              },
            ],
          },
        ],
        initialPage: 'home',
      })
      expect(withHeadersReference.status).toBe('error')
      if (withHeadersReference.status === 'error') {
        expect(withHeadersReference.error.message).toContain('switch.next')
      }
    })

    it('rejects switch.next referenced in props.checked of a switch button', () => {
      const result = validateRuntimeConfig({
        api: {},
        pages: [
          {
            id: 'home',
            layout: [
              {
                type: 'button',
                props: {
                  label: 'Toggle',
                  variant: 'switch',
                  checked: 'switch.next',
                  action: { type: 'goBack' },
                },
              },
            ],
          },
        ],
        initialPage: 'home',
      })
      expect(result.status).toBe('error')
      if (result.status === 'error') {
        expect(result.error.message).toContain('switch.next')
      }
    })

    it('rejects switch.next referenced in node.visibility.reference of a switch button', () => {
      const result = validateRuntimeConfig({
        api: {},
        pages: [
          {
            id: 'home',
            layout: [
              {
                type: 'button',
                props: {
                  label: 'Toggle',
                  variant: 'switch',
                  checked: true,
                  action: { type: 'goBack' },
                },
                visibility: { reference: 'switch.next', operator: 'isTruthy' },
              },
            ],
          },
        ],
        initialPage: 'home',
      })
      expect(result.status).toBe('error')
      if (result.status === 'error') {
        expect(result.error.message).toContain('.visibility.reference')
      }
    })

    it('rejects switch.next referenced in the action of another button node that is not itself a switch', () => {
      const result = validateRuntimeConfig({
        api: { toggle: { method: 'POST', endpoint: '/api/toggle' } },
        pages: [
          {
            id: 'home',
            layout: [
              {
                type: 'button',
                props: {
                  label: 'Toggle',
                  variant: 'switch',
                  checked: true,
                  action: {
                    type: 'executeOperation',
                    operationName: 'toggle',
                    query: { next: 'switch.next' },
                  },
                },
              },
              {
                type: 'button',
                props: {
                  label: 'Broken',
                  action: {
                    type: 'executeOperation',
                    operationName: 'toggle',
                    query: { next: 'switch.next' },
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
        expect(result.error.message).toContain('switch.next')
      }
    })
  })

  describe('button props.iconPosition', () => {
    it('accepts iconPosition: "left" and the normalized node preserves it', () => {
      const result = validateRuntimeConfig(
        createConfigWithPages([
          {
            id: 'home',
            layout: [
              {
                type: 'button',
                props: {
                  label: 'Search',
                  action: { type: 'goBack' },
                  icon: 'Search',
                  iconPosition: 'left',
                },
              },
            ],
          },
        ]),
      )

      expect(result.status).toBe('ready')
      if (result.status !== 'ready') throw new Error('Expected ready')

      expect(result.page.layout[0]).toMatchObject({
        type: 'button',
        props: { label: 'Search', iconPosition: 'left' },
      })
    })

    it('accepts iconPosition: "right" and the normalized node preserves it', () => {
      const result = validateRuntimeConfig(
        createConfigWithPages([
          {
            id: 'home',
            layout: [
              {
                type: 'button',
                props: {
                  label: 'Next',
                  action: { type: 'goBack' },
                  icon: 'ArrowRight',
                  iconPosition: 'right',
                },
              },
            ],
          },
        ]),
      )

      expect(result.status).toBe('ready')
      if (result.status !== 'ready') throw new Error('Expected ready')

      expect(result.page.layout[0]).toMatchObject({
        type: 'button',
        props: { label: 'Next', iconPosition: 'right' },
      })
    })

    it('without iconPosition, the normalized node does not include the iconPosition key', () => {
      const result = validateRuntimeConfig(
        createConfigWithPages([
          {
            id: 'home',
            layout: [
              {
                type: 'button',
                props: {
                  label: 'Search',
                  action: { type: 'goBack' },
                  icon: 'Search',
                },
              },
            ],
          },
        ]),
      )

      expect(result.status).toBe('ready')
      if (result.status !== 'ready') throw new Error('Expected ready')

      expect(result.page.layout[0]).not.toHaveProperty('props.iconPosition')
    })

    it('rejects iconPosition with a value outside the enum with code invalid-layout and the exact path', () => {
      const result = validateRuntimeConfig(
        createConfigWithPages([
          {
            id: 'home',
            layout: [
              {
                type: 'button',
                props: {
                  label: 'Broken',
                  action: { type: 'goBack' },
                  iconPosition: 'center',
                },
              },
            ],
          },
        ]),
      )

      expect(result.status).toBe('error')
      if (result.status !== 'error') throw new Error('Expected error')

      expect(result.error.code).toBe('invalid-layout')
      expect(result.error.message).toContain('layout[0].props.iconPosition')
    })

    it('accepts iconPosition declared without icon and the normalized node preserves iconPosition', () => {
      const result = validateRuntimeConfig(
        createConfigWithPages([
          {
            id: 'home',
            layout: [
              {
                type: 'button',
                props: {
                  label: 'Next',
                  action: { type: 'goBack' },
                  iconPosition: 'right',
                },
              },
            ],
          },
        ]),
      )

      expect(result.status).toBe('ready')
      if (result.status !== 'ready') throw new Error('Expected ready')

      expect(result.page.layout[0]).toMatchObject({
        type: 'button',
        props: { label: 'Next', iconPosition: 'right' },
      })
    })
  })

  describe('link props.iconPosition', () => {
    it('accepts props.label and iconPosition: "right" and the normalized node preserves iconPosition', () => {
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
                  iconPosition: 'right',
                },
              },
            ],
          },
        ]),
      )

      expect(result.status).toBe('ready')
      if (result.status !== 'ready') throw new Error('Expected ready')

      expect(result.page.layout[0]).toMatchObject({
        type: 'link',
        props: { label: 'Visit', iconPosition: 'right' },
      })
    })

    it('without iconPosition, the normalized node does not include the iconPosition key', () => {
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
                },
              },
            ],
          },
        ]),
      )

      expect(result.status).toBe('ready')
      if (result.status !== 'ready') throw new Error('Expected ready')

      expect(result.page.layout[0]).not.toHaveProperty('props.iconPosition')
    })

    it('rejects iconPosition with a value outside the enum with code invalid-layout and the exact path', () => {
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
                  iconPosition: 'center',
                },
              },
            ],
          },
        ]),
      )

      expect(result.status).toBe('error')
      if (result.status !== 'error') throw new Error('Expected error')

      expect(result.error.code).toBe('invalid-layout')
      expect(result.error.message).toContain('layout[0].props.iconPosition')
    })

    it('rejects link with children and iconPosition declared with the icon+children diagnostic message', () => {
      const result = validateRuntimeConfig(
        createConfigWithPages([
          {
            id: 'home',
            layout: [
              {
                type: 'link',
                props: {
                  href: 'https://example.com',
                  iconPosition: 'right',
                },
                children: [
                  {
                    type: 'paragraph',
                    props: { text: 'Click here' },
                  },
                ],
              },
            ],
          },
        ]),
      )

      expect(result.status).toBe('error')
      if (result.status !== 'error') throw new Error('Expected error')

      expect(result.error.code).toBe('invalid-layout')
      expect(result.error.message).toContain('link nodes cannot have both props.icon and children.')
    })

    it('accepts props.label and iconPosition declared without icon and the normalized node preserves iconPosition', () => {
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
                  iconPosition: 'right',
                },
              },
            ],
          },
        ]),
      )

      expect(result.status).toBe('ready')
      if (result.status !== 'ready') throw new Error('Expected ready')

      expect(result.page.layout[0]).toMatchObject({
        type: 'link',
        props: { label: 'Visit', iconPosition: 'right' },
      })
    })
  })
})

// ─── Second-pass breadcrumb enrichment tests ─────────────────────────────────

describe('validateRuntimeConfig — second-pass action target errors include breadcrumb', () => {
  it('navigateTo to unknown page in button nested inside container > form includes breadcrumb with full ancestors', () => {
    const result = validateRuntimeConfig(
      createConfigWithPages([
        {
          id: 'home',
          layout: [
            {
              type: 'container',
              children: [
                {
                  type: 'form',
                  id: 'user',
                  children: [
                    {
                      type: 'button',
                      props: {
                        label: 'Go nowhere',
                        action: {
                          type: 'navigateTo',
                          pageId: 'non-existent-page',
                        },
                      },
                    },
                  ],
                },
              ],
            },
          ],
        },
      ]),
    )
    expect(result.status).toBe('error')
    if (result.status !== 'error') throw new Error('Expected error')
    expect(result.error.message).toContain('unknown page "non-existent-page"')
    expect(result.error.message).toContain('\n  → ')
    expect(result.error.message).toContain('container[0]')
    expect(result.error.message).toContain('form("user")')
    expect(result.error.message).toContain('button("Go nowhere")')
    expect(result.error.message).toContain('\n  Node: ')
    expect(result.error.message).toContain('"type":"button"')
  })

  it('executeOperation to unknown operation includes breadcrumb and excerpt of the button', () => {
    const result = validateRuntimeConfig({
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
                label: 'Run missing',
                action: {
                  type: 'executeOperation',
                  operationName: 'nonExistentOp',
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
    expect(result.error.message).toContain('unknown operation "nonExistentOp"')
    expect(result.error.message).toContain('\n  → ')
    expect(result.error.message).toContain('button("Run missing")')
    expect(result.error.message).toContain('\n  Node: ')
    expect(result.error.message).toContain('"type":"button"')
    expect(result.error.message).toContain('"label":"Run missing"')
  })

  it('link navigateTo to unknown page includes breadcrumb with link node', () => {
    const result = validateRuntimeConfig(
      createConfigWithPages([
        {
          id: 'home',
          layout: [
            {
              type: 'link',
              props: {
                label: 'Broken link',
                action: { type: 'navigateTo', pageId: 'missing-page' },
              },
            },
          ],
        },
      ]),
    )
    expect(result.status).toBe('error')
    if (result.status !== 'error') throw new Error('Expected error')
    expect(result.error.message).toContain('unknown page "missing-page"')
    expect(result.error.message).toContain('\n  → ')
    expect(result.error.message).toContain('link("Broken link")')
    expect(result.error.message).toContain('\n  Node: ')
  })

  it('navigateTo to unknown page inside repeater template includes breadcrumb with repeater ancestor', () => {
    const result = validateRuntimeConfig(
      createConfigWithPages([
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
                      label: 'View',
                      action: { type: 'navigateTo', pageId: 'ghost-page' },
                    },
                  },
                ],
              },
            },
          ],
        },
      ]),
    )
    expect(result.status).toBe('error')
    if (result.status !== 'error') throw new Error('Expected error')
    expect(result.error.message).toContain('unknown page "ghost-page"')
    expect(result.error.message).toContain('repeater[0]')
    expect(result.error.message).toContain('button("View")')
  })
})

// T2: button.props.action.onSuccess/onError shape and when validation

describe('validateRuntimeConfig — button.props.action.onSuccess/onError', () => {
  it('accepts an executeOperation action with onSuccess containing a valid executeOperation entry', () => {
    const result = validateRuntimeConfig({
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
                label: 'Load users',
                action: {
                  type: 'executeOperation',
                  operationName: 'searchUsers',
                  onSuccess: [{ type: 'executeOperation', operationName: 'searchUsers' }],
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

    const action = (result.config.pages[0].layout[0] as { props: { action: Record<string, unknown> } }).props.action
    expect(action.onSuccess).toEqual([{ type: 'executeOperation', operationName: 'searchUsers' }])
  })

  it('accepts an executeOperation action with onError containing a valid executeOperation entry', () => {
    const result = validateRuntimeConfig({
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
                label: 'Load users',
                action: {
                  type: 'executeOperation',
                  operationName: 'searchUsers',
                  onError: [{ type: 'executeOperation', operationName: 'searchUsers' }],
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

    const action = (result.config.pages[0].layout[0] as { props: { action: Record<string, unknown> } }).props.action
    expect(action.onError).toEqual([{ type: 'executeOperation', operationName: 'searchUsers' }])
  })

  it('accepts onSuccess/onError entries with a valid when referencing queries.{op}.status', () => {
    const result = validateRuntimeConfig({
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
                label: 'Load users',
                action: {
                  type: 'executeOperation',
                  operationName: 'searchUsers',
                  onSuccess: [
                    {
                      type: 'executeOperation',
                      operationName: 'searchUsers',
                      when: { reference: 'queries.searchUsers.status', operator: 'equals', value: 'success' },
                    },
                  ],
                  onError: [
                    {
                      type: 'executeOperation',
                      operationName: 'searchUsers',
                      when: { reference: 'queries.searchUsers.status', operator: 'equals', value: 'success' },
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

    const action = (result.config.pages[0].layout[0] as { props: { action: Record<string, unknown> } }).props.action
    expect(action.onSuccess).toEqual([
      {
        type: 'executeOperation',
        operationName: 'searchUsers',
        when: { reference: 'queries.searchUsers.status', operator: 'equals', value: 'success' },
      },
    ])
    expect(action.onError).toEqual([
      {
        type: 'executeOperation',
        operationName: 'searchUsers',
        when: { reference: 'queries.searchUsers.status', operator: 'equals', value: 'success' },
      },
    ])
  })

  it('rejects an onSuccess/onError entry with an invalid when.reference', () => {
    const onSuccessResult = validateRuntimeConfig({
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
                label: 'Load users',
                action: {
                  type: 'executeOperation',
                  operationName: 'searchUsers',
                  onSuccess: [
                    {
                      type: 'executeOperation',
                      operationName: 'searchUsers',
                      when: { reference: 'tokens.foo', operator: 'isTruthy' },
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

    expect(onSuccessResult.status).toBe('error')
    if (onSuccessResult.status !== 'error') throw new Error('Expected error')
    expect(onSuccessResult.error.message).toContain('layout[0].props.action.onSuccess[0].when')

    const onErrorResult = validateRuntimeConfig({
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
                label: 'Load users',
                action: {
                  type: 'executeOperation',
                  operationName: 'searchUsers',
                  onError: [
                    {
                      type: 'executeOperation',
                      operationName: 'searchUsers',
                      when: { reference: 'tokens.foo', operator: 'isTruthy' },
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

    expect(onErrorResult.status).toBe('error')
    if (onErrorResult.status !== 'error') throw new Error('Expected error')
    expect(onErrorResult.error.message).toContain('layout[0].props.action.onError[0].when')
  })

  it('rejects onSuccess/onError when not an array', () => {
    const onSuccessResult = validateRuntimeConfig({
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
                label: 'Load users',
                action: {
                  type: 'executeOperation',
                  operationName: 'searchUsers',
                  onSuccess: { type: 'executeOperation', operationName: 'searchUsers' },
                },
              },
            },
          ],
        },
      ],
      initialPage: 'home',
    })

    expect(onSuccessResult.status).toBe('error')

    const onErrorResult = validateRuntimeConfig({
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
                label: 'Load users',
                action: {
                  type: 'executeOperation',
                  operationName: 'searchUsers',
                  onError: { type: 'executeOperation', operationName: 'searchUsers' },
                },
              },
            },
          ],
        },
      ],
      initialPage: 'home',
    })

    expect(onErrorResult.status).toBe('error')
  })

  it('accepts an executeOperations action with onSuccess/onError at the action level (not per-operation)', () => {
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
                  operations: [{ operationName: 'deleteItem' }, { operationName: 'reloadList' }],
                  onSuccess: [{ type: 'navigateTo', pageId: 'home' }],
                  onError: [{ type: 'goBack' }],
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

    const action = (result.config.pages[0].layout[0] as { props: { action: Record<string, unknown> } }).props.action
    expect(action.onSuccess).toEqual([{ type: 'navigateTo', pageId: 'home' }])
    expect(action.onError).toEqual([{ type: 'goBack' }])
  })

  it('accepts a navigateTo action with an extra onSuccess key that is silently dropped (.strip())', () => {
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
                  onSuccess: [{ type: 'goBack' }],
                },
              },
            },
          ],
        },
        { id: 'details', layout: [] },
      ]),
    )

    expect(result.status).toBe('ready')
    if (result.status !== 'ready') throw new Error('Expected ready')

    const action = (result.config.pages[0].layout[0] as { props: { action: Record<string, unknown> } }).props.action
    expect(action).toEqual({ type: 'navigateTo', pageId: 'details' })
    expect(action.onSuccess).toBeUndefined()
  })

  it('regression: a button action without onSuccess/onError produces the same node as before', () => {
    const result = validateRuntimeConfig({
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

    expect(result.status).toBe('ready')
    if (result.status !== 'ready') throw new Error('Expected ready')

    expect(result.config.pages[0].layout[0]).toEqual({
      type: 'button',
      props: {
        label: 'Load users',
        action: {
          type: 'executeOperation',
          operationName: 'searchUsers',
        },
      },
    })
  })
})

// T3: button.props.action.onSuccess/onError target references and GET+body validation

describe('validateRuntimeConfig — button.props.action.onSuccess/onError target validation', () => {
  it('rejects onSuccess executeOperation entry with an inexistent operationName', () => {
    const result = validateRuntimeConfig({
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
                label: 'Load users',
                action: {
                  type: 'executeOperation',
                  operationName: 'searchUsers',
                  onSuccess: [{ type: 'executeOperation', operationName: 'nonExistentOp' }],
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
    expect(result.error.message).toContain('layout[0].props.action.onSuccess[0].operationName')
    expect(result.error.message).toContain('unknown operation "nonExistentOp"')
  })

  it('rejects onError navigateTo entry with an inexistent pageId', () => {
    const result = validateRuntimeConfig({
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
                label: 'Load users',
                action: {
                  type: 'executeOperation',
                  operationName: 'searchUsers',
                  onError: [{ type: 'navigateTo', pageId: 'missing-page' }],
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
    expect(result.error.message).toContain('layout[0].props.action.onError[0].pageId')
    expect(result.error.message).toContain('unknown page "missing-page"')
  })

  it('rejects onSuccess openModal entry with an inexistent modalId', () => {
    const result = validateRuntimeConfig({
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
                label: 'Load users',
                action: {
                  type: 'executeOperation',
                  operationName: 'searchUsers',
                  onSuccess: [{ type: 'openModal', modalId: 'nonExistentModal' }],
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
    expect(result.error.message).toContain('layout[0].props.action.onSuccess[0].modalId')
    expect(result.error.message).toContain('unknown modal "nonExistentModal"')
  })

  it('rejects onSuccess closeModal entry with an inexistent modalId', () => {
    const result = validateRuntimeConfig({
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
                label: 'Load users',
                action: {
                  type: 'executeOperation',
                  operationName: 'searchUsers',
                  onSuccess: [{ type: 'closeModal', modalId: 'nonExistentModal' }],
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
    expect(result.error.message).toContain('layout[0].props.action.onSuccess[0].modalId')
    expect(result.error.message).toContain('unknown modal "nonExistentModal"')
  })

  it('rejects onSuccess executeOperation entry resolving to a GET operation with body', () => {
    const result = validateRuntimeConfig({
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
                label: 'Load users',
                action: {
                  type: 'executeOperation',
                  operationName: 'searchUsers',
                  onSuccess: [{ type: 'executeOperation', operationName: 'searchUsers', body: { search: 'Ada' } }],
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
    expect(result.error.message).toContain('layout[0].props.action.onSuccess[0].body')
    expect(result.error.message).toContain('GET operations do not support body.')
  })

  it('rejects onError executeOperation entry resolving to a GET operation with body', () => {
    const result = validateRuntimeConfig({
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
                label: 'Load users',
                action: {
                  type: 'executeOperation',
                  operationName: 'searchUsers',
                  onError: [{ type: 'executeOperation', operationName: 'searchUsers', body: { search: 'Ada' } }],
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
    expect(result.error.message).toContain('layout[0].props.action.onError[0].body')
    expect(result.error.message).toContain('GET operations do not support body.')
  })

  it('accepts onSuccess/onError referencing existing operationName, pageId and modalId (happy path)', () => {
    const result = validateRuntimeConfig({
      api: {
        searchUsers: { method: 'GET', endpoint: '/api/users' },
        logActivity: { method: 'POST', endpoint: '/api/activity' },
      },
      pages: [
        {
          id: 'home',
          layout: [
            { type: 'modal', id: 'confirm-modal', children: [] },
            {
              type: 'button',
              props: {
                label: 'Load users',
                action: {
                  type: 'executeOperation',
                  operationName: 'searchUsers',
                  onSuccess: [
                    { type: 'navigateTo', pageId: 'details' },
                    { type: 'executeOperation', operationName: 'logActivity' },
                    { type: 'openModal', modalId: 'confirm-modal' },
                  ],
                  onError: [{ type: 'closeModal', modalId: 'confirm-modal' }],
                },
              },
            },
          ],
        },
        { id: 'details', layout: [] },
      ],
      initialPage: 'home',
    })

    expect(result.status).toBe('ready')
  })

  // T4: cross-repeater modal target validation

  function createModalNode(overrides: Record<string, unknown> = {}) {
    return {
      type: 'modal',
      id: 'my-modal',
      children: [],
      ...overrides,
    }
  }

  it('rejects onSuccess openModal targeting a modal that belongs to a sibling repeater', () => {
    const result = validateRuntimeConfig({
      api: {
        searchUsers: { method: 'GET', endpoint: '/api/users' },
      },
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'repeater',
              props: {
                items: { source: 'queries.listA.data', key: 'id' },
                template: [
                  {
                    type: 'button',
                    props: {
                      label: 'Load users',
                      action: {
                        type: 'executeOperation',
                        operationName: 'searchUsers',
                        onSuccess: [{ type: 'openModal', modalId: 'modalInRepeaterB' }],
                      },
                    },
                  },
                ],
              },
            },
            {
              type: 'repeater',
              props: {
                items: { source: 'queries.listB.data', key: 'id' },
                template: [createModalNode({ id: 'modalInRepeaterB' })],
              },
            },
          ],
        },
      ],
      initialPage: 'home',
    })

    expect(result.status).toBe('error')
    if (result.status !== 'error') throw new Error('Expected error')
    expect(result.error.message).toContain('layout[0].props.template[0].props.action.onSuccess[0].modalId')
    expect(result.error.message).toContain('modal "modalInRepeaterB" belongs to a different repeater.')
  })

  it('rejects onError closeModal targeting a modal that belongs to a sibling repeater', () => {
    const result = validateRuntimeConfig({
      api: {
        searchUsers: { method: 'GET', endpoint: '/api/users' },
      },
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'repeater',
              props: {
                items: { source: 'queries.listA.data', key: 'id' },
                template: [
                  {
                    type: 'button',
                    props: {
                      label: 'Load users',
                      action: {
                        type: 'executeOperation',
                        operationName: 'searchUsers',
                        onError: [{ type: 'closeModal', modalId: 'modalInRepeaterB' }],
                      },
                    },
                  },
                ],
              },
            },
            {
              type: 'repeater',
              props: {
                items: { source: 'queries.listB.data', key: 'id' },
                template: [createModalNode({ id: 'modalInRepeaterB' })],
              },
            },
          ],
        },
      ],
      initialPage: 'home',
    })

    expect(result.status).toBe('error')
    if (result.status !== 'error') throw new Error('Expected error')
    expect(result.error.message).toContain('layout[0].props.template[0].props.action.onError[0].modalId')
    expect(result.error.message).toContain('modal "modalInRepeaterB" belongs to a different repeater.')
  })

  it('accepts onSuccess openModal targeting a modal declared in the same repeater (regression)', () => {
    const result = validateRuntimeConfig({
      api: {
        searchUsers: { method: 'GET', endpoint: '/api/users' },
      },
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'repeater',
              props: {
                items: { source: 'queries.listA.data', key: 'id' },
                template: [
                  createModalNode({ id: 'sameRepeaterModal' }),
                  {
                    type: 'button',
                    props: {
                      label: 'Load users',
                      action: {
                        type: 'executeOperation',
                        operationName: 'searchUsers',
                        onSuccess: [{ type: 'openModal', modalId: 'sameRepeaterModal' }],
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

  it('accepts onSuccess openModal from outside any repeater targeting a modal declared inside a repeater (inert, out of scope)', () => {
    const result = validateRuntimeConfig({
      api: {
        searchUsers: { method: 'GET', endpoint: '/api/users' },
      },
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'repeater',
              props: {
                items: { source: 'queries.listA.data', key: 'id' },
                template: [createModalNode({ id: 'rep-modal' })],
              },
            },
            {
              type: 'button',
              props: {
                label: 'Load users',
                action: {
                  type: 'executeOperation',
                  operationName: 'searchUsers',
                  onSuccess: [{ type: 'openModal', modalId: 'rep-modal' }],
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
})

// T1: button.props.action.type "downloadOperation" and link.props.action.type "downloadOperation"

describe('validateRuntimeConfig — downloadOperation action', () => {
  it('accepts a button downloadOperation action with only operationName', () => {
    const result = validateRuntimeConfig({
      api: {
        downloadReport: { method: 'GET', endpoint: '/api/reports/1' },
      },
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'button',
              props: {
                label: 'Download report',
                action: { type: 'downloadOperation', operationName: 'downloadReport' },
              },
            },
          ],
        },
      ],
      initialPage: 'home',
    })

    expect(result.status).toBe('ready')
    if (result.status !== 'ready') throw new Error('Expected ready')

    expect(result.config.pages[0].layout[0]).toEqual({
      type: 'button',
      props: {
        label: 'Download report',
        action: { type: 'downloadOperation', operationName: 'downloadReport' },
      },
    })
  })

  it('accepts a button downloadOperation action with query, body, headers and filename', () => {
    const result = validateRuntimeConfig({
      api: {
        downloadReport: { method: 'POST', endpoint: '/api/reports' },
      },
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'button',
              props: {
                label: 'Download report',
                action: {
                  type: 'downloadOperation',
                  operationName: 'downloadReport',
                  query: { format: 'pdf' },
                  body: { reportId: 42 },
                  headers: { Authorization: 'Bearer token' },
                  filename: 'report.pdf',
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

    expect(result.config.pages[0].layout[0]).toEqual({
      type: 'button',
      props: {
        label: 'Download report',
        action: {
          type: 'downloadOperation',
          operationName: 'downloadReport',
          query: { format: 'pdf' },
          body: { reportId: 42 },
          headers: { Authorization: 'Bearer token' },
          filename: 'report.pdf',
        },
      },
    })
  })

  it('accepts a link downloadOperation action with the same shape as button', () => {
    const result = validateRuntimeConfig({
      api: {
        downloadReport: { method: 'POST', endpoint: '/api/reports' },
      },
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'link',
              props: {
                label: 'Download report',
                action: {
                  type: 'downloadOperation',
                  operationName: 'downloadReport',
                  query: { format: 'pdf' },
                  body: { reportId: 42 },
                  headers: { Authorization: 'Bearer token' },
                  filename: 'report.pdf',
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

    expect(result.config.pages[0].layout[0]).toEqual({
      type: 'link',
      props: {
        label: 'Download report',
        action: {
          type: 'downloadOperation',
          operationName: 'downloadReport',
          query: { format: 'pdf' },
          body: { reportId: 42 },
          headers: { Authorization: 'Bearer token' },
          filename: 'report.pdf',
        },
      },
    })
  })

  it('accepts a button downloadOperation action with onSuccess/onError lists including a "when" condition', () => {
    const result = validateRuntimeConfig({
      api: {
        downloadReport: { method: 'GET', endpoint: '/api/reports/1' },
        logActivity: { method: 'POST', endpoint: '/api/activity' },
      },
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'button',
              props: {
                label: 'Download report',
                action: {
                  type: 'downloadOperation',
                  operationName: 'downloadReport',
                  onSuccess: [
                    {
                      type: 'executeOperation',
                      operationName: 'logActivity',
                      when: { reference: 'queries.downloadReport.status', operator: 'equals', value: 'success' },
                    },
                    { type: 'navigateTo', pageId: 'details' },
                  ],
                  onError: [{ type: 'goBack' }],
                },
              },
            },
          ],
        },
        { id: 'details', layout: [] },
      ],
      initialPage: 'home',
    })

    expect(result.status).toBe('ready')
    if (result.status !== 'ready') throw new Error('Expected ready')

    const action = (result.config.pages[0].layout[0] as { props: { action: Record<string, unknown> } }).props.action
    expect(action.onSuccess).toEqual([
      {
        type: 'executeOperation',
        operationName: 'logActivity',
        when: { reference: 'queries.downloadReport.status', operator: 'equals', value: 'success' },
      },
      { type: 'navigateTo', pageId: 'details' },
    ])
    expect(action.onError).toEqual([{ type: 'goBack' }])
  })

  it('accepts a link downloadOperation action with onSuccess/onError lists', () => {
    const result = validateRuntimeConfig({
      api: {
        downloadReport: { method: 'GET', endpoint: '/api/reports/1' },
      },
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'link',
              props: {
                label: 'Download report',
                action: {
                  type: 'downloadOperation',
                  operationName: 'downloadReport',
                  onSuccess: [{ type: 'navigateTo', pageId: 'details' }],
                  onError: [{ type: 'goBack' }],
                },
              },
            },
          ],
        },
        { id: 'details', layout: [] },
      ],
      initialPage: 'home',
    })

    expect(result.status).toBe('ready')
    if (result.status !== 'ready') throw new Error('Expected ready')

    const action = (result.config.pages[0].layout[0] as { props: { action: Record<string, unknown> } }).props.action
    expect(action.onSuccess).toEqual([{ type: 'navigateTo', pageId: 'details' }])
    expect(action.onError).toEqual([{ type: 'goBack' }])
  })

  it('rejects a button downloadOperation action with an inexistent operationName', () => {
    const result = validateRuntimeConfig({
      api: {
        downloadReport: { method: 'GET', endpoint: '/api/reports/1' },
      },
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'button',
              props: {
                label: 'Broken',
                action: { type: 'downloadOperation', operationName: 'missingOperation' },
              },
            },
          ],
        },
      ],
      initialPage: 'home',
    })

    expect(result.status).toBe('error')
    if (result.status !== 'error') throw new Error('Expected error')
    expect(result.error.message).toContain('layout[0].props.action.operationName')
    expect(result.error.message).toContain('unknown operation "missingOperation"')
  })

  it('rejects a link downloadOperation action with an inexistent operationName', () => {
    const result = validateRuntimeConfig({
      api: {
        downloadReport: { method: 'GET', endpoint: '/api/reports/1' },
      },
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'link',
              props: {
                label: 'Broken',
                action: { type: 'downloadOperation', operationName: 'missingOperation' },
              },
            },
          ],
        },
      ],
      initialPage: 'home',
    })

    expect(result.status).toBe('error')
    if (result.status !== 'error') throw new Error('Expected error')
    expect(result.error.message).toContain('layout[0].props.action.operationName')
    expect(result.error.message).toContain('unknown operation "missingOperation"')
  })

  it('rejects a button downloadOperation action targeting a GET operation with body', () => {
    const result = validateRuntimeConfig({
      api: {
        downloadReport: { method: 'GET', endpoint: '/api/reports/1' },
      },
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'button',
              props: {
                label: 'Broken',
                action: { type: 'downloadOperation', operationName: 'downloadReport', body: { id: 1 } },
              },
            },
          ],
        },
      ],
      initialPage: 'home',
    })

    expect(result.status).toBe('error')
    if (result.status !== 'error') throw new Error('Expected error')
    expect(result.error.message).toContain('layout[0].props.action.body')
    expect(result.error.message).toContain('GET operations do not support body.')
  })

  it('rejects a link downloadOperation action targeting a GET operation with body', () => {
    const result = validateRuntimeConfig({
      api: {
        downloadReport: { method: 'GET', endpoint: '/api/reports/1' },
      },
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'link',
              props: {
                label: 'Broken',
                action: { type: 'downloadOperation', operationName: 'downloadReport', body: { id: 1 } },
              },
            },
          ],
        },
      ],
      initialPage: 'home',
    })

    expect(result.status).toBe('error')
    if (result.status !== 'error') throw new Error('Expected error')
    expect(result.error.message).toContain('layout[0].props.action.body')
    expect(result.error.message).toContain('GET operations do not support body.')
  })

  it('rejects a button downloadOperation onSuccess entry resolving to a GET operation with body', () => {
    const result = validateRuntimeConfig({
      api: {
        downloadReport: { method: 'POST', endpoint: '/api/reports' },
        searchUsers: { method: 'GET', endpoint: '/api/users' },
      },
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'button',
              props: {
                label: 'Download report',
                action: {
                  type: 'downloadOperation',
                  operationName: 'downloadReport',
                  onSuccess: [{ type: 'executeOperation', operationName: 'searchUsers', body: { search: 'Ada' } }],
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
    expect(result.error.message).toContain('layout[0].props.action.onSuccess[0].body')
    expect(result.error.message).toContain('GET operations do not support body.')
  })

  it('rejects a link downloadOperation onError entry resolving to a GET operation with body', () => {
    const result = validateRuntimeConfig({
      api: {
        downloadReport: { method: 'POST', endpoint: '/api/reports' },
        searchUsers: { method: 'GET', endpoint: '/api/users' },
      },
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'link',
              props: {
                label: 'Download report',
                action: {
                  type: 'downloadOperation',
                  operationName: 'downloadReport',
                  onError: [{ type: 'executeOperation', operationName: 'searchUsers', body: { search: 'Ada' } }],
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
    expect(result.error.message).toContain('layout[0].props.action.onError[0].body')
    expect(result.error.message).toContain('GET operations do not support body.')
  })

  it('rejects a downloadOperation entry nested inside another action\'s onSuccess/onError list (D7)', () => {
    const api = {
      downloadReport: { method: 'GET', endpoint: '/api/reports/1' },
      searchUsers: { method: 'GET', endpoint: '/api/users' },
    }

    const insideExecuteOperation = validateRuntimeConfig({
      api,
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
                  operationName: 'searchUsers',
                  onSuccess: [{ type: 'downloadOperation', operationName: 'downloadReport' }],
                },
              },
            },
          ],
        },
      ],
      initialPage: 'home',
    })
    expect(insideExecuteOperation.status).toBe('error')

    const insideExecuteOperations = validateRuntimeConfig({
      api,
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
                  operations: [{ operationName: 'searchUsers' }],
                  onError: [{ type: 'downloadOperation', operationName: 'downloadReport' }],
                },
              },
            },
          ],
        },
      ],
      initialPage: 'home',
    })
    expect(insideExecuteOperations.status).toBe('error')

    const insideDownloadOperationItself = validateRuntimeConfig({
      api,
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'button',
              props: {
                label: 'Broken',
                action: {
                  type: 'downloadOperation',
                  operationName: 'downloadReport',
                  onSuccess: [{ type: 'downloadOperation', operationName: 'downloadReport' }],
                },
              },
            },
          ],
        },
      ],
      initialPage: 'home',
    })
    expect(insideDownloadOperationItself.status).toBe('error')
  })

  it('rejects a downloadOperation action with a missing or empty operationName', () => {
    const missing = validateRuntimeConfig({
      api: {},
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'button',
              props: { label: 'Broken', action: { type: 'downloadOperation' } },
            },
          ],
        },
      ],
      initialPage: 'home',
    })
    expect(missing.status).toBe('error')
    if (missing.status !== 'error') throw new Error('Expected error')
    expect(missing.error.message).toContain('layout[0].props.action.operationName')

    const empty = validateRuntimeConfig({
      api: {},
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'button',
              props: { label: 'Broken', action: { type: 'downloadOperation', operationName: '   ' } },
            },
          ],
        },
      ],
      initialPage: 'home',
    })
    expect(empty.status).toBe('error')
    if (empty.status !== 'error') throw new Error('Expected error')
    expect(empty.error.message).toContain('layout[0].props.action.operationName')
  })

  it('accepts a link downloadOperation action without href (mutually exclusive with action, no regression)', () => {
    const result = validateRuntimeConfig({
      api: {
        downloadReport: { method: 'GET', endpoint: '/api/reports/1' },
      },
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'link',
              props: {
                label: 'Download report',
                action: { type: 'downloadOperation', operationName: 'downloadReport' },
              },
            },
          ],
        },
      ],
      initialPage: 'home',
    })

    expect(result.status).toBe('ready')
    if (result.status !== 'ready') throw new Error('Expected ready')

    const node = result.config.pages[0].layout[0] as { props: { href?: string; action?: unknown } }
    expect(node.props.href).toBeUndefined()
    expect(node.props.action).toEqual({ type: 'downloadOperation', operationName: 'downloadReport' })
  })
})
