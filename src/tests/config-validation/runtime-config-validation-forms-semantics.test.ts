import { describe, expect, it } from 'vitest'
import { validateRuntimeConfig } from '../../config/runtime-config'
import {
  createConfigWithPages,
  createConfigWithFormLayout,
  createFormNode,
} from './helpers'

describe('validateRuntimeConfig', () => {
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
        message: `Page "home" has an invalid layout at "layout[0].children[0]": input nodes must be descendants of a form node.
  → container[0] > input(fieldId: "name")
  Node: {"type":"input","props":{"fieldId":"name","label":"Name"}}`,
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
        message: `Page "home" has an invalid layout at "layout[0]": textarea nodes must be descendants of a form node.
  → textarea(fieldId: "bio")
  Node: {"type":"textarea","props":{"fieldId":"bio","label":"Bio"}}`,
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
        message: `Page "home" has an invalid layout at "layout[0]": select nodes must be descendants of a form node.
  → select(fieldId: "role")
  Node: {"type":"select","props":{"fieldId":"role","label":"Role"}}`,
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
        message: `Page "home" has an invalid layout at "layout[0]": button nodes without an action must be descendants of a form node.
  → button("Broken submit")
  Node: {"type":"button","props":{"label":"Broken submit"}}`,
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
        message: `Page "home" has an invalid layout at "layout[0].children[0]": button nodes without an action must be descendants of a form node.
  → container[0] > button("Still broken")
  Node: {"type":"button","props":{"label":"Still broken"}}`,
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
        message: `Page "details" has an invalid layout at "layout[0].id": duplicate form id "user-form".
  → form("user-form")
  Node: {"type":"form","id":"user-form"}`,
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
        message: `Page "home" has an invalid layout at "layout[0].children[1].children[0].props.fieldId": duplicate fieldId "email" in form "user-form".
  → form("user-form") > container[1] > textarea(fieldId: "email")
  Node: {"type":"textarea","props":{"fieldId":"email","label":"Email duplicate"}}`,
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
        message: `Page "home" has an invalid layout at "layout[0].children[0]": form nodes only accept input, textarea, select, radioGroup, checkboxGroup, fileInput, toggle, hidden, button, heading, paragraph, image, table, container, accordion, divider and tabs descendants.
  → form("user-form") > list[0]
  Node: {"type":"list"}`,
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
        message: `Page "home" has an invalid layout at "layout[0].children[0]": form nodes only accept input, textarea, select, radioGroup, checkboxGroup, fileInput, toggle, hidden, button, heading, paragraph, image, table, container, accordion, divider and tabs descendants.
  → form("user-form") > repeater[0]
  Node: {"type":"repeater"}`,
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
        message: expect.stringContaining('layout[0].submitAction.type'),
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
        message: `Page "home" has an invalid layout at "layout[0].submitAction.operationName": unknown operation "missingOperation".
  → form("user-form")
  Node: {"type":"form","id":"user-form"}`,
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
        message: `Page "home" has an invalid layout at "layout[0].children[0].props.action.pageId": unknown page "missingPage".
  → form("user-form") > button("Broken auxiliary navigation")
  Node: {"type":"button","props":{"label":"Broken auxiliary navigation"}}`,
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
        message: `Page "home" has an invalid layout at "layout[0].children[0].children[0].props.action.operationName": unknown operation "missingNestedOperation".
  → form("user-form") > container[0] > button("Broken nested auxiliary submit")
  Node: {"type":"button","props":{"label":"Broken nested auxiliary submit"}}`,
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
        message: `Page "home" has an invalid layout at "layout[0].resetOnSuccess": resetOnSuccess requires submitAction.
  → form("user-form")
  Node: {"type":"form","id":"user-form"}`,
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
        message: expect.stringContaining('layout[0].persistOnUnmount'),
      },
    })
  })

  it('accepts form.submitAction with executeOperations and two valid entries', () => {
    const result = validateRuntimeConfig({
      api: {
        saveProfile: { method: 'POST', endpoint: '/api/profile' },
        logActivity: { method: 'POST', endpoint: '/api/activity' },
      },
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'form',
              id: 'user-form',
              submitAction: {
                type: 'executeOperations',
                operations: [
                  { operationName: 'saveProfile', body: { name: 'forms.user-form.name' } },
                  { operationName: 'logActivity' },
                ],
              },
              children: [],
            },
          ],
        },
      ],
      initialPage: 'home',
    })

    expect(result.status).toBe('ready')
  })

  it('rejects form.submitAction with executeOperations when operations is missing', () => {
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
                submitAction: {
                  type: 'executeOperations',
                },
                children: [],
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
        message: expect.stringContaining('submitAction.operations'),
      },
    })
  })

  it('rejects form.submitAction with executeOperations when operations is empty', () => {
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
                submitAction: {
                  type: 'executeOperations',
                  operations: [],
                },
                children: [],
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
        message: expect.stringContaining('submitAction.operations'),
      },
    })
  })

  it('rejects form.submitAction with executeOperations when an entry has no operationName', () => {
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
                submitAction: {
                  type: 'executeOperations',
                  operations: [{}],
                },
                children: [],
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
        message: expect.stringContaining('submitAction.operations[0].operationName'),
      },
    })
  })

  it('accepts form.submitAction with executeOperations and resetOnSuccess true (valid combination)', () => {
    const result = validateRuntimeConfig({
      api: {
        saveProfile: { method: 'POST', endpoint: '/api/profile' },
        logActivity: { method: 'POST', endpoint: '/api/activity' },
      },
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'form',
              id: 'user-form',
              submitAction: {
                type: 'executeOperations',
                operations: [
                  { operationName: 'saveProfile' },
                  { operationName: 'logActivity' },
                ],
              },
              resetOnSuccess: true,
              children: [],
            },
          ],
        },
      ],
      initialPage: 'home',
    })

    expect(result.status).toBe('ready')
  })

  it('accepts form.submitAction with executeOperations when an entry has an inexistent operationName (not pre-rejected)', () => {
    const result = validateRuntimeConfig({
      api: {},
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'form',
              id: 'user-form',
              submitAction: {
                type: 'executeOperations',
                operations: [{ operationName: 'nonExistentOp' }],
              },
              children: [],
            },
          ],
        },
      ],
      initialPage: 'home',
    })

    expect(result.status).toBe('ready')
  })

  it('rejects form.submitAction with executeOperations when an entry has body and the operation method is GET', () => {
    expect(
      validateRuntimeConfig({
        api: {
          searchUsers: { method: 'GET', endpoint: '/api/users' },
          logActivity: { method: 'POST', endpoint: '/api/activity' },
        },
        pages: [
          {
            id: 'home',
            layout: [
              {
                type: 'form',
                id: 'user-form',
                submitAction: {
                  type: 'executeOperations',
                  operations: [
                    { operationName: 'searchUsers', body: { search: 'Ada' } },
                    { operationName: 'logActivity' },
                  ],
                },
                children: [],
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
        message: expect.stringContaining('submitAction.operations[0].body'),
        message: expect.stringContaining('GET operations do not support body'),
      },
    })
  })

  it('rejects button.props.action with executeOperations when an entry has body and the operation method is GET', () => {
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
                  label: 'Search',
                  action: {
                    type: 'executeOperations',
                    operations: [
                      { operationName: 'searchUsers', body: { search: 'Ada' } },
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
        message: expect.stringContaining('props.action.operations[0].body'),
        message: expect.stringContaining('GET operations do not support body'),
      },
    })
  })

  it('accepts form.submitAction or button.props.action with executeOperations when entry has body but operationName is inexistent', () => {
    const formResult = validateRuntimeConfig({
      api: {},
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'form',
              id: 'user-form',
              submitAction: {
                type: 'executeOperations',
                operations: [{ operationName: 'nonExistentOp', body: { search: 'Ada' } }],
              },
              children: [],
            },
          ],
        },
      ],
      initialPage: 'home',
    })

    expect(formResult.status).toBe('ready')

    const buttonResult = validateRuntimeConfig({
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
                  operations: [{ operationName: 'nonExistentOp', body: { search: 'Ada' } }],
                },
              },
            },
          ],
        },
      ],
      initialPage: 'home',
    })

    expect(buttonResult.status).toBe('ready')
  })

  it('still rejects form.submitAction with executeOperation (singular) when operationName is inexistent (regression)', () => {
    expect(
      validateRuntimeConfig(
        createConfigWithFormLayout({
          submitAction: {
            type: 'executeOperation',
            operationName: 'missingOperation',
          },
        }),
      ),
    ).toMatchObject({
      status: 'error',
      error: {
        code: 'invalid-layout',
        message: expect.stringContaining('submitAction.operationName'),
      },
    })
  })

  it('still accepts form.submitAction with executeOperation (singular) and normalizes as before (regression)', () => {
    const result = validateRuntimeConfig(createConfigWithFormLayout())
    expect(result.status).toBe('ready')

    if (result.status !== 'ready') {
      throw new Error('Expected ready result')
    }

    expect((result.config.pages[0].layout[0] as { submitAction: { type: string } }).submitAction.type).toBe('executeOperation')
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
        message: expect.stringContaining('select item values must all be strings or all be numbers'),
      },
    })
  })

  // T2: when in executeOperations entries inside submitAction (structural schema tests)

  it('accepts form.submitAction executeOperations with operations[i].when valid shape', () => {
    const result = validateRuntimeConfig({
      api: {
        saveProfile: { method: 'POST', endpoint: '/api/profile' },
      },
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'form',
              id: 'user-form',
              submitAction: {
                type: 'executeOperations',
                operations: [
                  {
                    operationName: 'saveProfile',
                    when: { reference: 'queries.saveProfile.data.flag', operator: 'isTruthy' },
                  },
                ],
              },
              children: [],
            },
          ],
        },
      ],
      initialPage: 'home',
    })

    expect(result.status).toBe('ready')
    if (result.status !== 'ready') throw new Error('Expected ready')
    const form = result.config.pages[0].layout[0] as {
      submitAction: { operations: Array<{ operationName: string; when?: unknown }> }
    }
    expect(form.submitAction.operations[0]).toEqual({
      operationName: 'saveProfile',
      when: { reference: 'queries.saveProfile.data.flag', operator: 'isTruthy' },
    })
  })

  it('rejects form.submitAction executeOperations when operations[i].when.operator is not a string', () => {
    const result = validateRuntimeConfig({
      api: {},
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'form',
              id: 'user-form',
              submitAction: {
                type: 'executeOperations',
                operations: [
                  {
                    operationName: 'saveProfile',
                    when: { reference: 'queries.saveProfile.data.flag', operator: 123 },
                  },
                ],
              },
              children: [],
            },
          ],
        },
      ],
      initialPage: 'home',
    })

    expect(result.status).toBe('error')
    if (result.status !== 'error') throw new Error('Expected error')
    expect(result.error.message).toContain('submitAction.operations[0].when')
  })

  // T3: semantic validation of when.reference in submitAction.executeOperations entries

  it('accepts submitAction.executeOperations entry when with params.* reference', () => {
    const result = validateRuntimeConfig({
      api: {
        saveOp: { method: 'POST', endpoint: '/api/save' },
      },
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'form',
              id: 'my-form',
              submitAction: {
                type: 'executeOperations',
                operations: [
                  {
                    operationName: 'saveOp',
                    when: { reference: 'params.id', operator: 'isTruthy' },
                  },
                ],
              },
              children: [],
            },
          ],
        },
      ],
      initialPage: 'home',
    })

    expect(result.status).toBe('ready')
  })

  it('accepts submitAction.executeOperations entry when with item.* reference (inside repeater context)', () => {
    const result = validateRuntimeConfig({
      api: {
        saveOp: { method: 'POST', endpoint: '/api/save' },
      },
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'form',
              id: 'my-form',
              submitAction: {
                type: 'executeOperations',
                operations: [
                  {
                    operationName: 'saveOp',
                    when: { reference: 'item.status', operator: 'equals', value: 'active' },
                  },
                ],
              },
              children: [],
            },
          ],
        },
      ],
      initialPage: 'home',
    })

    expect(result.status).toBe('ready')
  })

  it('rejects submitAction.executeOperations entry when with operator outside catalog', () => {
    const result = validateRuntimeConfig({
      api: {},
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'form',
              id: 'my-form',
              submitAction: {
                type: 'executeOperations',
                operations: [
                  {
                    operationName: 'op1',
                    when: { reference: 'queries.x.data.flag', operator: 'contains' },
                  },
                ],
              },
              children: [],
            },
          ],
        },
      ],
      initialPage: 'home',
    })

    expect(result.status).toBe('error')
    if (result.status !== 'error') throw new Error('Expected error')
    expect(result.error.message).toContain('submitAction.operations[0].when')
  })

  it('rejects submitAction.executeOperations entry when isTruthy with value declared', () => {
    const result = validateRuntimeConfig({
      api: {},
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'form',
              id: 'my-form',
              submitAction: {
                type: 'executeOperations',
                operations: [
                  {
                    operationName: 'op1',
                    when: { reference: 'queries.x.data.flag', operator: 'isTruthy', value: 'bad' },
                  },
                ],
              },
              children: [],
            },
          ],
        },
      ],
      initialPage: 'home',
    })

    expect(result.status).toBe('error')
    if (result.status !== 'error') throw new Error('Expected error')
    expect(result.error.message).toContain('submitAction.operations[0].when')
  })

  // T4: cross-validation — form submitAction executeOperations with when field

  it('accepts form.submitAction executeOperations with valid when and inexistent operationName (not pre-rejected at bootstrap)', () => {
    const result = validateRuntimeConfig({
      api: {},
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'form',
              id: 'my-form',
              submitAction: {
                type: 'executeOperations',
                operations: [
                  {
                    operationName: 'nonExistentOp',
                    when: { reference: 'queries.x.data.flag', operator: 'isTruthy' },
                  },
                ],
              },
              children: [],
            },
          ],
        },
      ],
      initialPage: 'home',
    })

    // executeOperations operationName is not cross-checked at bootstrap per current contract
    expect(result.status).toBe('ready')
  })

  it('rejects form.submitAction executeOperations when entry has GET body with valid when (body error takes priority, not when)', () => {
    const result = validateRuntimeConfig({
      api: {
        searchUsers: { method: 'GET', endpoint: '/api/users' },
      },
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'form',
              id: 'my-form',
              submitAction: {
                type: 'executeOperations',
                operations: [
                  {
                    operationName: 'searchUsers',
                    body: { search: 'Ada' },
                    when: { reference: 'queries.x.data.flag', operator: 'isTruthy' },
                  },
                ],
              },
              children: [],
            },
          ],
        },
      ],
      initialPage: 'home',
    })

    expect(result.status).toBe('error')
    if (result.status !== 'error') throw new Error('Expected error')
    // Error is about body, not about when
    expect(result.error.message).toContain('submitAction.operations[0].body')
    expect(result.error.message).toContain('GET operations do not support body')
  })

  // T5: submitAction.onSuccess validation

  it('accepts submitAction.onSuccess as an empty array (valid no-op)', () => {
    const result = validateRuntimeConfig({
      api: {
        submitUserForm: { method: 'POST', endpoint: '/api/forms' },
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
                onSuccess: [],
              },
              children: [],
            },
          ],
        },
      ],
      initialPage: 'home',
    })

    expect(result.status).toBe('ready')
  })

  it('accepts submitAction.onSuccess with a valid navigateTo action referencing an existing page', () => {
    const result = validateRuntimeConfig({
      api: {
        submitUserForm: { method: 'POST', endpoint: '/api/forms' },
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
                onSuccess: [{ type: 'navigateTo', pageId: 'details' }],
              },
              children: [],
            },
          ],
        },
        {
          id: 'details',
          layout: [],
        },
      ],
      initialPage: 'home',
    })

    expect(result.status).toBe('ready')
  })

  it('accepts submitAction.onSuccess with a navigateTo action and valid when condition', () => {
    const result = validateRuntimeConfig({
      api: {
        submitUserForm: { method: 'POST', endpoint: '/api/forms' },
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
                onSuccess: [
                  {
                    type: 'navigateTo',
                    pageId: 'details',
                    when: { reference: 'queries.submitUserForm.data.status', operator: 'equals', value: 'ok' },
                  },
                ],
              },
              children: [],
            },
          ],
        },
        {
          id: 'details',
          layout: [],
        },
      ],
      initialPage: 'home',
    })

    expect(result.status).toBe('ready')
  })

  it('accepts submitAction.onSuccess with executeOperations that has operations[i].when', () => {
    const result = validateRuntimeConfig({
      api: {
        submitUserForm: { method: 'POST', endpoint: '/api/forms' },
        logActivity: { method: 'POST', endpoint: '/api/activity' },
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
                onSuccess: [
                  {
                    type: 'executeOperations',
                    operations: [
                      {
                        operationName: 'logActivity',
                        when: { reference: 'queries.submitUserForm.data.flag', operator: 'isTruthy' },
                      },
                    ],
                  },
                ],
              },
              children: [],
            },
          ],
        },
      ],
      initialPage: 'home',
    })

    expect(result.status).toBe('ready')
  })

  it('rejects submitAction.onSuccess when it is not an array', () => {
    const result = validateRuntimeConfig({
      api: {
        submitUserForm: { method: 'POST', endpoint: '/api/forms' },
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
                onSuccess: 'invalid',
              },
              children: [],
            },
          ],
        },
      ],
      initialPage: 'home',
    })

    expect(result.status).toBe('error')
    if (result.status !== 'error') throw new Error('Expected error')
    expect(result.error.message).toContain('submitAction.onSuccess')
  })

  it('rejects submitAction.onSuccess with a navigateTo action referencing an inexistent page', () => {
    const result = validateRuntimeConfig({
      api: {
        submitUserForm: { method: 'POST', endpoint: '/api/forms' },
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
                onSuccess: [{ type: 'navigateTo', pageId: 'missing-page' }],
              },
              children: [],
            },
          ],
        },
      ],
      initialPage: 'home',
    })

    expect(result.status).toBe('error')
    if (result.status !== 'error') throw new Error('Expected error')
    expect(result.error.message).toContain('submitAction.onSuccess[0].pageId')
    expect(result.error.message).toContain('missing-page')
  })

  it('rejects submitAction.onSuccess with executeOperation referencing an inexistent operationName', () => {
    const result = validateRuntimeConfig({
      api: {},
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'form',
              id: 'user-form',
              submitAction: {
                type: 'executeOperation',
                operationName: 'someOp',
                onSuccess: [{ type: 'executeOperation', operationName: 'nonExistentOp' }],
              },
              children: [],
            },
          ],
        },
      ],
      initialPage: 'home',
    })

    // submitAction.executeOperation is still cross-checked (known operation), but
    // onSuccess.executeOperation references should also be cross-checked
    // submitAction.executeOperation 'someOp' will fail first
    // Let's use an existing api so only onSuccess fails
    const result2 = validateRuntimeConfig({
      api: {
        someOp: { method: 'POST', endpoint: '/api/some' },
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
                operationName: 'someOp',
                onSuccess: [{ type: 'executeOperation', operationName: 'nonExistentOp' }],
              },
              children: [],
            },
          ],
        },
      ],
      initialPage: 'home',
    })

    expect(result2.status).toBe('error')
    if (result2.status !== 'error') throw new Error('Expected error')
    expect(result2.error.message).toContain('submitAction.onSuccess[0].operationName')
    expect(result2.error.message).toContain('nonExistentOp')
  })

  it('rejects submitAction.onSuccess with openModal referencing an inexistent modalId', () => {
    const result = validateRuntimeConfig({
      api: {
        submitUserForm: { method: 'POST', endpoint: '/api/forms' },
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
                onSuccess: [{ type: 'openModal', modalId: 'nonExistentModal' }],
              },
              children: [],
            },
          ],
        },
      ],
      initialPage: 'home',
    })

    expect(result.status).toBe('error')
    if (result.status !== 'error') throw new Error('Expected error')
    expect(result.error.message).toContain('submitAction.onSuccess[0].modalId')
    expect(result.error.message).toContain('nonExistentModal')
  })

  it('accepts submitAction.onSuccess with openModal referencing an existing modal node', () => {
    const result = validateRuntimeConfig({
      api: {
        submitUserForm: { method: 'POST', endpoint: '/api/forms' },
      },
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'modal',
              id: 'confirm-modal',
              children: [],
            },
            {
              type: 'form',
              id: 'user-form',
              submitAction: {
                type: 'executeOperation',
                operationName: 'submitUserForm',
                onSuccess: [{ type: 'openModal', modalId: 'confirm-modal' }],
              },
              children: [],
            },
          ],
        },
      ],
      initialPage: 'home',
    })

    expect(result.status).toBe('ready')
  })

  it('rejects submitAction.onSuccess[i].when with operator outside catalog', () => {
    const result = validateRuntimeConfig({
      api: {
        submitUserForm: { method: 'POST', endpoint: '/api/forms' },
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
                onSuccess: [
                  {
                    type: 'goBack',
                    when: { reference: 'queries.submitUserForm.data.flag', operator: 'contains' },
                  },
                ],
              },
              children: [],
            },
          ],
        },
      ],
      initialPage: 'home',
    })

    expect(result.status).toBe('error')
    if (result.status !== 'error') throw new Error('Expected error')
    expect(result.error.message).toContain('submitAction.onSuccess[0].when')
  })

  it('rejects submitAction.onSuccess[i] with GET + body, with exact path for body error', () => {
    const result = validateRuntimeConfig({
      api: {
        submitUserForm: { method: 'POST', endpoint: '/api/forms' },
        searchUsers: { method: 'GET', endpoint: '/api/users' },
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
                onSuccess: [
                  {
                    type: 'executeOperation',
                    operationName: 'searchUsers',
                    body: { search: 'Ada' },
                  },
                ],
              },
              children: [],
            },
          ],
        },
      ],
      initialPage: 'home',
    })

    expect(result.status).toBe('error')
    if (result.status !== 'error') throw new Error('Expected error')
    expect(result.error.message).toContain('submitAction.onSuccess[0].body')
    expect(result.error.message).toContain('GET operations do not support body')
  })

  it('accepts resetOnSuccess: true together with onSuccess actions', () => {
    const result = validateRuntimeConfig({
      api: {
        submitUserForm: { method: 'POST', endpoint: '/api/forms' },
      },
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'form',
              id: 'user-form',
              resetOnSuccess: true,
              submitAction: {
                type: 'executeOperation',
                operationName: 'submitUserForm',
                onSuccess: [{ type: 'goBack' }],
              },
              children: [],
            },
          ],
        },
      ],
      initialPage: 'home',
    })

    expect(result.status).toBe('ready')
  })

  it('silently discards onSuccess at root form node (without submitAction) per Zod .strip()', () => {
    // onSuccess at root of form node (not inside submitAction) is unknown to the schema
    // Zod strips it silently; no error is reported. This is a key invariant.
    const result = validateRuntimeConfig({
      api: {},
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'form',
              id: 'user-form',
              onSuccess: [{ type: 'goBack' }],
              children: [],
            },
          ],
        },
      ],
      initialPage: 'home',
    })

    // onSuccess at root is silently discarded — no error
    expect(result.status).toBe('ready')
  })

  // T2: submitAction.onError validation

  it('accepts submitAction.onError as an empty array (valid no-op)', () => {
    const result = validateRuntimeConfig({
      api: {
        submitUserForm: { method: 'POST', endpoint: '/api/forms' },
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
                onError: [],
              },
              children: [],
            },
          ],
        },
      ],
      initialPage: 'home',
    })

    expect(result.status).toBe('ready')
  })

  it('accepts submitAction.onError with a valid navigateTo action referencing an existing page', () => {
    const result = validateRuntimeConfig({
      api: {
        submitUserForm: { method: 'POST', endpoint: '/api/forms' },
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
                onError: [{ type: 'navigateTo', pageId: 'details' }],
              },
              children: [],
            },
          ],
        },
        {
          id: 'details',
          layout: [],
        },
      ],
      initialPage: 'home',
    })

    expect(result.status).toBe('ready')
  })

  it('accepts submitAction.onError with a navigateTo action and valid when condition referencing queries.*.error.message', () => {
    const result = validateRuntimeConfig({
      api: {
        submitUserForm: { method: 'POST', endpoint: '/api/forms' },
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
                onError: [
                  {
                    type: 'navigateTo',
                    pageId: 'details',
                    when: {
                      reference: 'queries.submitUserForm.error.message',
                      operator: 'equals',
                      value: 'forbidden',
                    },
                  },
                ],
              },
              children: [],
            },
          ],
        },
        {
          id: 'details',
          layout: [],
        },
      ],
      initialPage: 'home',
    })

    expect(result.status).toBe('ready')
  })

  it('accepts submitAction.onError with executeOperations that has operations[i].when', () => {
    const result = validateRuntimeConfig({
      api: {
        submitUserForm: { method: 'POST', endpoint: '/api/forms' },
        logError: { method: 'POST', endpoint: '/api/errors' },
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
                onError: [
                  {
                    type: 'executeOperations',
                    operations: [
                      {
                        operationName: 'logError',
                        when: { reference: 'queries.submitUserForm.error', operator: 'isTruthy' },
                      },
                    ],
                  },
                ],
              },
              children: [],
            },
          ],
        },
      ],
      initialPage: 'home',
    })

    expect(result.status).toBe('ready')
  })

  it('rejects submitAction.onError when it is not an array', () => {
    const result = validateRuntimeConfig({
      api: {
        submitUserForm: { method: 'POST', endpoint: '/api/forms' },
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
                onError: 'invalid',
              },
              children: [],
            },
          ],
        },
      ],
      initialPage: 'home',
    })

    expect(result.status).toBe('error')
    if (result.status !== 'error') throw new Error('Expected error')
    expect(result.error.message).toContain('submitAction.onError')
  })

  it('rejects submitAction.onError with a navigateTo action referencing an inexistent page', () => {
    const result = validateRuntimeConfig({
      api: {
        submitUserForm: { method: 'POST', endpoint: '/api/forms' },
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
                onError: [{ type: 'navigateTo', pageId: 'missing-page' }],
              },
              children: [],
            },
          ],
        },
      ],
      initialPage: 'home',
    })

    expect(result.status).toBe('error')
    if (result.status !== 'error') throw new Error('Expected error')
    expect(result.error.message).toContain('submitAction.onError[0].pageId')
    expect(result.error.message).toContain('missing-page')
  })

  it('rejects submitAction.onError with executeOperation referencing an inexistent operationName', () => {
    const result = validateRuntimeConfig({
      api: {
        submitUserForm: { method: 'POST', endpoint: '/api/forms' },
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
                onError: [{ type: 'executeOperation', operationName: 'nonExistentOp' }],
              },
              children: [],
            },
          ],
        },
      ],
      initialPage: 'home',
    })

    expect(result.status).toBe('error')
    if (result.status !== 'error') throw new Error('Expected error')
    expect(result.error.message).toContain('submitAction.onError[0].operationName')
    expect(result.error.message).toContain('nonExistentOp')
  })

  it('rejects submitAction.onError with openModal referencing an inexistent modalId', () => {
    const result = validateRuntimeConfig({
      api: {
        submitUserForm: { method: 'POST', endpoint: '/api/forms' },
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
                onError: [{ type: 'openModal', modalId: 'nonExistentModal' }],
              },
              children: [],
            },
          ],
        },
      ],
      initialPage: 'home',
    })

    expect(result.status).toBe('error')
    if (result.status !== 'error') throw new Error('Expected error')
    expect(result.error.message).toContain('submitAction.onError[0].modalId')
    expect(result.error.message).toContain('nonExistentModal')
  })

  it('rejects submitAction.onError with closeModal referencing an inexistent modalId', () => {
    const result = validateRuntimeConfig({
      api: {
        submitUserForm: { method: 'POST', endpoint: '/api/forms' },
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
                onError: [{ type: 'closeModal', modalId: 'nonExistentModal' }],
              },
              children: [],
            },
          ],
        },
      ],
      initialPage: 'home',
    })

    expect(result.status).toBe('error')
    if (result.status !== 'error') throw new Error('Expected error')
    expect(result.error.message).toContain('submitAction.onError[0].modalId')
    expect(result.error.message).toContain('nonExistentModal')
  })

  it('rejects submitAction.onError[i].when with operator outside catalog', () => {
    const result = validateRuntimeConfig({
      api: {
        submitUserForm: { method: 'POST', endpoint: '/api/forms' },
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
                onError: [
                  {
                    type: 'goBack',
                    when: { reference: 'queries.submitUserForm.error.message', operator: 'contains' },
                  },
                ],
              },
              children: [],
            },
          ],
        },
      ],
      initialPage: 'home',
    })

    expect(result.status).toBe('error')
    if (result.status !== 'error') throw new Error('Expected error')
    expect(result.error.message).toContain('submitAction.onError[0].when')
  })

  it('rejects submitAction.onError[i] with executeOperation GET + body, with exact path for body error', () => {
    const result = validateRuntimeConfig({
      api: {
        submitUserForm: { method: 'POST', endpoint: '/api/forms' },
        searchUsers: { method: 'GET', endpoint: '/api/users' },
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
                onError: [
                  {
                    type: 'executeOperation',
                    operationName: 'searchUsers',
                    body: { search: 'Ada' },
                  },
                ],
              },
              children: [],
            },
          ],
        },
      ],
      initialPage: 'home',
    })

    expect(result.status).toBe('error')
    if (result.status !== 'error') throw new Error('Expected error')
    expect(result.error.message).toContain('submitAction.onError[0].body')
    expect(result.error.message).toContain('GET operations do not support body')
  })

  it('rejects submitAction.onError[i] with executeOperations GET + body for inner operation, with exact path', () => {
    const result = validateRuntimeConfig({
      api: {
        submitUserForm: { method: 'POST', endpoint: '/api/forms' },
        searchUsers: { method: 'GET', endpoint: '/api/users' },
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
                onError: [
                  {
                    type: 'executeOperations',
                    operations: [
                      {
                        operationName: 'searchUsers',
                        body: { search: 'Ada' },
                      },
                    ],
                  },
                ],
              },
              children: [],
            },
          ],
        },
      ],
      initialPage: 'home',
    })

    expect(result.status).toBe('error')
    if (result.status !== 'error') throw new Error('Expected error')
    expect(result.error.message).toContain('submitAction.onError[0].operations[0].body')
    expect(result.error.message).toContain('GET operations do not support body')
  })

  it('accepts onSuccess and onError declared together in the same submitAction without interference', () => {
    const result = validateRuntimeConfig({
      api: {
        submitUserForm: { method: 'POST', endpoint: '/api/forms' },
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
                onSuccess: [{ type: 'goBack' }],
                onError: [{ type: 'goBack' }],
              },
              children: [],
            },
          ],
        },
      ],
      initialPage: 'home',
    })

    expect(result.status).toBe('ready')
    if (result.status !== 'ready') throw new Error('Expected ready')
    const form = result.config.pages[0].layout[0] as import('../../config/runtime-config-types').FormLayoutNode
    expect(form.onSuccess).toHaveLength(1)
    expect(form.onError).toHaveLength(1)
  })

  it('accepts resetOnSuccess: true coexisting with onError actions', () => {
    const result = validateRuntimeConfig({
      api: {
        submitUserForm: { method: 'POST', endpoint: '/api/forms' },
      },
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'form',
              id: 'user-form',
              resetOnSuccess: true,
              submitAction: {
                type: 'executeOperation',
                operationName: 'submitUserForm',
                onError: [{ type: 'goBack' }],
              },
              children: [],
            },
          ],
        },
      ],
      initialPage: 'home',
    })

    expect(result.status).toBe('ready')
  })

  it('accepts submitAction.onError when condition references params.userId', () => {
    const result = validateRuntimeConfig({
      api: {
        submitUserForm: { method: 'POST', endpoint: '/api/forms' },
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
                onError: [
                  {
                    type: 'goBack',
                    when: { reference: 'params.userId', operator: 'isTruthy' },
                  },
                ],
              },
              children: [],
            },
          ],
        },
      ],
      initialPage: 'home',
    })

    expect(result.status).toBe('ready')
  })

  it('silently discards onError at root form node (without submitAction) per Zod .strip()', () => {
    // onError at root of form node (not inside submitAction) is unknown to the schema
    // Zod strips it silently; no error is reported. This is the same invariant as onSuccess.
    const result = validateRuntimeConfig({
      api: {},
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'form',
              id: 'user-form',
              onError: [{ type: 'goBack' }],
              children: [],
            },
          ],
        },
      ],
      initialPage: 'home',
    })

    // onError at root is silently discarded — no error
    expect(result.status).toBe('ready')
  })

  describe('tokens.* gating in form submitAction', () => {
    it('accepts tokens.* in form.submitAction.headers', () => {
      const result = validateRuntimeConfig(
        createConfigWithFormLayout({
          submitAction: {
            type: 'executeOperation',
            operationName: 'submitUserForm',
            headers: { Authorization: 'tokens.session.value' },
          },
        }),
      )
      expect(result.status).toBe('ready')
    })

    it('accepts tokens.* in form.submitAction executeOperations.operations[].headers', () => {
      const result = validateRuntimeConfig({
        api: { submitUserForm: { method: 'POST', endpoint: '/api/forms' } },
        pages: [
          {
            id: 'home',
            layout: [
              {
                type: 'form',
                id: 'user-form',
                submitAction: {
                  type: 'executeOperations',
                  operations: [
                    { operationName: 'submitUserForm', headers: { Authorization: 'tokens.session.value' } },
                  ],
                },
                children: [],
              },
            ],
          },
        ],
        initialPage: 'home',
      })
      expect(result.status).toBe('ready')
    })

    it('rejects tokens.* in form.submitAction.query', () => {
      const result = validateRuntimeConfig(
        createConfigWithFormLayout({
          submitAction: {
            type: 'executeOperation',
            operationName: 'submitUserForm',
            query: { token: 'tokens.session.value' },
          },
        }),
      )
      expect(result.status).toBe('error')
      if (result.status === 'error') {
        expect(result.error.message).toContain('tokens.*')
      }
    })

    it('rejects tokens.* in form.submitAction.body', () => {
      const result = validateRuntimeConfig(
        createConfigWithFormLayout({
          submitAction: {
            type: 'executeOperation',
            operationName: 'submitUserForm',
            body: { token: 'tokens.session.value' },
          },
        }),
      )
      expect(result.status).toBe('error')
      if (result.status === 'error') {
        expect(result.error.message).toContain('tokens.*')
      }
    })

    it('rejects tokens.* in form.submitAction executeOperations.operations[].body', () => {
      const result = validateRuntimeConfig({
        api: { submitUserForm: { method: 'POST', endpoint: '/api/forms' } },
        pages: [
          {
            id: 'home',
            layout: [
              {
                type: 'form',
                id: 'user-form',
                submitAction: {
                  type: 'executeOperations',
                  operations: [
                    { operationName: 'submitUserForm', body: { token: 'tokens.session.value' } },
                  ],
                },
                children: [],
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
  })

  describe('tokens.* gating in form field defaultValue', () => {
    it('rejects tokens.* in input.props.defaultValue', () => {
      const result = validateRuntimeConfig(
        createConfigWithFormLayout({
          children: [
            {
              type: 'input',
              props: {
                fieldId: 'name',
                label: 'Name',
                defaultValue: 'tokens.session.value',
              },
            },
          ],
        }),
      )
      expect(result.status).toBe('error')
      if (result.status === 'error') {
        expect(result.error.message).toContain('tokens.*')
      }
    })

    it('rejects tokens.* in textarea.props.defaultValue', () => {
      const result = validateRuntimeConfig(
        createConfigWithFormLayout({
          children: [
            {
              type: 'textarea',
              props: {
                fieldId: 'bio',
                label: 'Bio',
                defaultValue: 'tokens.session.value',
              },
            },
          ],
        }),
      )
      expect(result.status).toBe('error')
      if (result.status === 'error') {
        expect(result.error.message).toContain('tokens.*')
      }
    })

    it('rejects tokens.* in select.props.defaultValue (single)', () => {
      const result = validateRuntimeConfig(
        createConfigWithFormLayout({
          children: [
            {
              type: 'select',
              props: {
                fieldId: 'role',
                label: 'Role',
                defaultValue: 'tokens.session.value',
                items: [{ label: 'Admin', value: 'admin' }],
              },
            },
          ],
        }),
      )
      expect(result.status).toBe('error')
      if (result.status === 'error') {
        expect(result.error.message).toContain('tokens.*')
      }
    })
  })

  it('admits toggle in the list of allowed form children', () => {
    const result = validateRuntimeConfig(
      createConfigWithFormLayout({
        children: [
          {
            type: 'toggle',
            props: {
              fieldId: 'agree',
              label: 'I agree',
            },
          },
        ],
      }),
    )
    expect(result.status).toBe('ready')
  })

  it('rejects toggle outside a form by the form-only check', () => {
    const result = validateRuntimeConfig(
      createConfigWithPages([
        {
          id: 'home',
          layout: [
            {
              type: 'toggle',
              props: {
                fieldId: 'agree',
                label: 'I agree',
              },
            },
          ],
        },
      ]),
    )
    expect(result).toEqual({
      status: 'error',
      error: {
        code: 'invalid-layout',
        displayMode: 'development-only',
        message: `Page "home" has an invalid layout at "layout[0]": toggle nodes must be descendants of a form node.
  → toggle(fieldId: "agree")
  Node: {"type":"toggle","props":{"fieldId":"agree","label":"I agree"}}`,
      },
    })
  })

  it('admits hidden in the list of allowed form children', () => {
    const result = validateRuntimeConfig(
      createConfigWithFormLayout({
        children: [
          {
            type: 'hidden',
            props: {
              fieldId: 'token',
              value: 'abc123',
            },
          },
        ],
      }),
    )
    expect(result.status).toBe('ready')
  })

  it('rejects hidden outside a form by the form-only check', () => {
    const result = validateRuntimeConfig(
      createConfigWithPages([
        {
          id: 'home',
          layout: [
            {
              type: 'hidden',
              props: {
                fieldId: 'token',
                value: 'abc123',
              },
            },
          ],
        },
      ]),
    )
    expect(result).toEqual({
      status: 'error',
      error: {
        code: 'invalid-layout',
        displayMode: 'development-only',
        message: `Page "home" has an invalid layout at "layout[0]": hidden nodes must be descendants of a form node.
  → hidden(fieldId: "token")
  Node: {"type":"hidden","props":{"fieldId":"token"}}`,
      },
    })
  })

  it('includes breadcrumb and excerpt for invalid form shape (missing id)', () => {
    const result = validateRuntimeConfig(
      createConfigWithPages([
        {
          id: 'home',
          layout: [
            {
              type: 'form',
              children: [],
            },
          ],
        },
      ]),
    )

    expect(result.status).toBe('error')
    if (result.status !== 'error') throw new Error('Expected error')
    expect(result.error.message).toContain('layout[0].id')
    expect(result.error.message).toContain('\n  → form[0]')
    expect(result.error.message).toContain('Node: {"type":"form"}')
  })

  // T-3: semantic validation of composed groups in submitAction.onSuccess[*].when (allowItem: true)
  describe('submitAction.onSuccess when semantics — composed groups', () => {
    it('accepts submitAction.onSuccess entry with a valid group of two conditions (params.* + queries.*)', () => {
      const result = validateRuntimeConfig({
        api: {
          submitUserForm: { method: 'POST', endpoint: '/api/forms' },
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
                  onSuccess: [
                    {
                      type: 'goBack',
                      when: {
                        operator: 'and',
                        conditions: [
                          { reference: 'params.mode', operator: 'equals', value: 'edit' },
                          { reference: 'queries.submitUserForm.data.flag', operator: 'isTruthy' },
                        ],
                      },
                    },
                  ],
                },
                children: [],
              },
            ],
          },
        ],
        initialPage: 'home',
      })
      expect(result.status).toBe('ready')
    })

    it('accepts submitAction.onSuccess entry with a group containing an item.* reference (allowItem: true)', () => {
      const result = validateRuntimeConfig({
        api: {
          submitUserForm: { method: 'POST', endpoint: '/api/forms' },
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
                  onSuccess: [
                    {
                      type: 'goBack',
                      when: {
                        operator: 'or',
                        conditions: [{ reference: 'item.foo', operator: 'isTruthy' }],
                      },
                    },
                  ],
                },
                children: [],
              },
            ],
          },
        ],
        initialPage: 'home',
      })
      expect(result.status).toBe('ready')
    })

    it('rejects submitAction.onSuccess entry with a group whose interior equals condition is missing value (path submitAction.onSuccess[0].when.conditions[0].value)', () => {
      const result = validateRuntimeConfig({
        api: {
          submitUserForm: { method: 'POST', endpoint: '/api/forms' },
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
                  onSuccess: [
                    {
                      type: 'goBack',
                      when: {
                        operator: 'and',
                        conditions: [{ reference: 'params.mode', operator: 'equals' }],
                      },
                    },
                  ],
                },
                children: [],
              },
            ],
          },
        ],
        initialPage: 'home',
      })
      expect(result.status).toBe('error')
      if (result.status !== 'error') throw new Error('Expected error')
      expect(result.error.message).toContain('submitAction.onSuccess[0].when.conditions[0].value')
    })
  })
})

// ─── Second-pass breadcrumb enrichment tests ─────────────────────────────────

describe('validateRuntimeConfig — second-pass form semantics include breadcrumb', () => {
  it('duplicate form id includes breadcrumb of the second form node', () => {
    const result = validateRuntimeConfig({
      api: {
        submitUserForm: { method: 'POST', endpoint: '/api/forms' },
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
    })
    expect(result.status).toBe('error')
    if (result.status !== 'error') throw new Error('Expected error')
    expect(result.error.message).toContain('duplicate form id "user-form"')
    expect(result.error.message).toContain('\n  → ')
    expect(result.error.message).toContain('form("user-form")')
    expect(result.error.message).toContain('\n  Node: ')
    expect(result.error.message).toContain('"type":"form"')
  })

  it('duplicate fieldId includes breadcrumb with form > input path', () => {
    const result = validateRuntimeConfig(
      createConfigWithFormLayout({
        children: [
          {
            type: 'input',
            props: {
              fieldId: 'name',
              label: 'Name',
            },
          },
          {
            type: 'container',
            children: [
              {
                type: 'input',
                props: {
                  fieldId: 'name',
                  label: 'Name duplicate',
                },
              },
            ],
          },
        ],
      }),
    )
    expect(result.status).toBe('error')
    if (result.status !== 'error') throw new Error('Expected error')
    expect(result.error.message).toContain('duplicate fieldId "name" in form "user-form"')
    expect(result.error.message).toContain('\n  → ')
    expect(result.error.message).toContain('form("user-form")')
    expect(result.error.message).toContain('input(fieldId: "name")')
    expect(result.error.message).toContain('\n  Node: ')
    expect(result.error.message).toContain('"type":"input"')
  })

  it('submitAction.operationName unknown includes breadcrumb of the form node', () => {
    const result = validateRuntimeConfig({
      api: {},
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'form',
              id: 'my-form',
              submitAction: { type: 'executeOperation', operationName: 'nonExistentOp' },
              children: [
                { type: 'input', props: { fieldId: 'x', label: 'X' } },
              ],
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
    expect(result.error.message).toContain('form("my-form")')
    expect(result.error.message).toContain('\n  Node: ')
  })

  it('fieldId duplicate inside tabs children includes correct breadcrumb ancestors', () => {
    const result = validateRuntimeConfig(
      createConfigWithFormLayout({
        children: [
          {
            type: 'input',
            props: { fieldId: 'email', label: 'Email' },
          },
          {
            type: 'tabs',
            props: {
              items: [
                {
                  label: 'Tab A',
                  children: [
                    {
                      type: 'input',
                      props: { fieldId: 'email', label: 'Email copy' },
                    },
                  ],
                },
              ],
            },
          },
        ],
      }),
    )
    expect(result.status).toBe('error')
    if (result.status !== 'error') throw new Error('Expected error')
    expect(result.error.message).toContain('duplicate fieldId "email"')
    expect(result.error.message).toContain('\n  → ')
    expect(result.error.message).toContain('form("user-form")')
    expect(result.error.message).toContain('input(fieldId: "email")')
    expect(result.error.message).toContain('\n  Node: ')
  })

  it('GET body error in executeExecutionRequestParams includes breadcrumb of the button', () => {
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
                label: 'Search',
                action: {
                  type: 'executeOperation',
                  operationName: 'searchUsers',
                  body: { filter: 'abc' },
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
    expect(result.error.message).toContain('GET operations do not support body')
    expect(result.error.message).toContain('\n  → ')
    expect(result.error.message).toContain('button("Search")')
    expect(result.error.message).toContain('\n  Node: ')
  })
})
