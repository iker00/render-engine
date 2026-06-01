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
})
