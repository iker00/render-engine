import { describe, expect, it } from 'vitest'
import { validateRuntimeConfig } from '../../config/runtime-config'
import { createConfigWithPages, createConfigWithFormLayout } from './helpers'

describe('validateRuntimeConfig', () => {
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

  it('accepts inputType time with validations.required', () => {
    const result = validateRuntimeConfig(
      createConfigWithFormLayout({
        children: [
          {
            type: 'input',
            props: {
              fieldId: 'startTime',
              label: 'Start time',
              inputType: 'time',
              validations: {
                required: true,
              },
            },
          },
        ],
      }),
    )

    expect(result.status).toBe('ready')
    if (result.status !== 'ready') throw new Error('Expected ready')

    const formNode = result.page.layout[0]
    if (formNode.type !== 'form') throw new Error('Expected form')

    expect(formNode.children?.[0]).toMatchObject({
      type: 'input',
      props: {
        fieldId: 'startTime',
        inputType: 'time',
        validations: {
          required: { value: true },
        },
      },
    })
  })

  it('rejects inputType time with validations.minLength', () => {
    expect(
      validateRuntimeConfig(
        createConfigWithFormLayout({
          children: [
            {
              type: 'input',
              props: {
                fieldId: 'startTime',
                label: 'Start time',
                inputType: 'time',
                validations: {
                  minLength: 3,
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
        message: 'Page "home" has an invalid layout at "layout[0].children[0].props.validations.minLength".',
      },
    })
  })

  it('rejects inputType time with validations.maxLength', () => {
    expect(
      validateRuntimeConfig(
        createConfigWithFormLayout({
          children: [
            {
              type: 'input',
              props: {
                fieldId: 'startTime',
                label: 'Start time',
                inputType: 'time',
                validations: {
                  maxLength: 10,
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
        message: 'Page "home" has an invalid layout at "layout[0].children[0].props.validations.maxLength".',
      },
    })
  })

  it('rejects inputType time with validations.min', () => {
    expect(
      validateRuntimeConfig(
        createConfigWithFormLayout({
          children: [
            {
              type: 'input',
              props: {
                fieldId: 'startTime',
                label: 'Start time',
                inputType: 'time',
                validations: {
                  min: 5,
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
  })

  it('rejects inputType time with validations.max', () => {
    expect(
      validateRuntimeConfig(
        createConfigWithFormLayout({
          children: [
            {
              type: 'input',
              props: {
                fieldId: 'startTime',
                label: 'Start time',
                inputType: 'time',
                validations: {
                  max: 10,
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
        message: 'Page "home" has an invalid layout at "layout[0].children[0].props.validations.max".',
      },
    })
  })
})
