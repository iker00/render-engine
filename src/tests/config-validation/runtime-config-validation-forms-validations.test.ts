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

  it('accepts pattern as short form (string) in input textual', () => {
    const result = validateRuntimeConfig(
      createConfigWithFormLayout({
        children: [
          {
            type: 'input',
            props: {
              fieldId: 'code',
              label: 'Code',
              validations: {
                pattern: '^\\d{5}$',
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
        fieldId: 'code',
        validations: {
          pattern: { value: '^\\d{5}$' },
        },
      },
    })
  })

  it('accepts pattern as extended form { value, message } in input textual', () => {
    const result = validateRuntimeConfig(
      createConfigWithFormLayout({
        children: [
          {
            type: 'input',
            props: {
              fieldId: 'code',
              label: 'Code',
              validations: {
                pattern: { value: '^\\d{5}$', message: 'Must be 5 digits' },
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
        fieldId: 'code',
        validations: {
          pattern: { value: '^\\d{5}$', message: 'Must be 5 digits' },
        },
      },
    })
  })

  it('accepts pattern in textarea', () => {
    const result = validateRuntimeConfig(
      createConfigWithFormLayout({
        children: [
          {
            type: 'textarea',
            props: {
              fieldId: 'notes',
              label: 'Notes',
              validations: {
                pattern: '^[A-Z]',
              },
            },
          },
        ],
      }),
    )

    expect(result.status).toBe('ready')
  })

  it('rejects pattern with invalid regex', () => {
    expect(
      validateRuntimeConfig(
        createConfigWithFormLayout({
          children: [
            {
              type: 'input',
              props: {
                fieldId: 'code',
                label: 'Code',
                validations: {
                  pattern: '[invalid',
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
        message: 'Page "home" has an invalid layout at "layout[0].children[0].props.validations.pattern.value".',
      },
    })
  })

  it('rejects pattern with empty string', () => {
    expect(
      validateRuntimeConfig(
        createConfigWithFormLayout({
          children: [
            {
              type: 'input',
              props: {
                fieldId: 'code',
                label: 'Code',
                validations: {
                  pattern: '',
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
        message: 'Page "home" has an invalid layout at "layout[0].children[0].props.validations.pattern".',
      },
    })
  })

  it('rejects pattern in input with inputType number', () => {
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
                  pattern: '^\\d+$',
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
        message: 'Page "home" has an invalid layout at "layout[0].children[0].props.validations.pattern".',
      },
    })
  })

  it('rejects pattern in input with inputType date', () => {
    expect(
      validateRuntimeConfig(
        createConfigWithFormLayout({
          children: [
            {
              type: 'input',
              props: {
                fieldId: 'dob',
                label: 'Date of birth',
                inputType: 'date',
                validations: {
                  pattern: '^\\d{4}-\\d{2}-\\d{2}$',
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
        message: 'Page "home" has an invalid layout at "layout[0].children[0].props.validations.pattern".',
      },
    })
  })

  it('rejects pattern in input with inputType datetime-local', () => {
    expect(
      validateRuntimeConfig(
        createConfigWithFormLayout({
          children: [
            {
              type: 'input',
              props: {
                fieldId: 'ts',
                label: 'Timestamp',
                inputType: 'datetime-local',
                validations: {
                  pattern: '.*',
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
        message: 'Page "home" has an invalid layout at "layout[0].children[0].props.validations.pattern".',
      },
    })
  })

  it('rejects pattern in input with inputType time', () => {
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
                  pattern: '^\\d{2}:\\d{2}$',
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
        message: 'Page "home" has an invalid layout at "layout[0].children[0].props.validations.pattern".',
      },
    })
  })

  it('rejects pattern in select, radioGroup, checkboxGroup', () => {
    expect(
      validateRuntimeConfig(
        createConfigWithFormLayout({
          children: [
            {
              type: 'select',
              props: {
                fieldId: 'role',
                label: 'Role',
                items: [{ label: 'Admin', value: 'admin' }],
                validations: {
                  pattern: '.*',
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
        message: 'Page "home" has an invalid layout at "layout[0].children[0].props.validations.pattern".',
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
                  pattern: '.*',
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
        message: 'Page "home" has an invalid layout at "layout[0].children[0].props.validations.pattern".',
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
                  pattern: '.*',
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
        message: 'Page "home" has an invalid layout at "layout[0].children[0].props.validations.pattern".',
      },
    })
  })

  it('accepts email as true (short form) in input textual', () => {
    const result = validateRuntimeConfig(
      createConfigWithFormLayout({
        children: [
          {
            type: 'input',
            props: {
              fieldId: 'contact',
              label: 'Contact email',
              validations: {
                email: true,
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
        fieldId: 'contact',
        validations: {
          email: { value: true },
        },
      },
    })
  })

  it('accepts email as extended form { value: true, message }', () => {
    const result = validateRuntimeConfig(
      createConfigWithFormLayout({
        children: [
          {
            type: 'input',
            props: {
              fieldId: 'contact',
              label: 'Contact email',
              validations: {
                email: { value: true, message: 'Enter a valid email' },
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
        fieldId: 'contact',
        validations: {
          email: { value: true, message: 'Enter a valid email' },
        },
      },
    })
  })

  it('accepts email in textarea', () => {
    const result = validateRuntimeConfig(
      createConfigWithFormLayout({
        children: [
          {
            type: 'textarea',
            props: {
              fieldId: 'emails',
              label: 'Emails',
              validations: {
                email: true,
              },
            },
          },
        ],
      }),
    )

    expect(result.status).toBe('ready')
  })

  it('rejects email in input with inputType number, date, datetime-local, time', () => {
    for (const inputType of ['number', 'date', 'datetime-local', 'time'] as const) {
      expect(
        validateRuntimeConfig(
          createConfigWithFormLayout({
            children: [
              {
                type: 'input',
                props: {
                  fieldId: 'field',
                  label: 'Field',
                  inputType,
                  validations: {
                    email: true,
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
          message: `Page "home" has an invalid layout at "layout[0].children[0].props.validations.email".`,
        },
      })
    }
  })

  it('rejects email in select, radioGroup, checkboxGroup', () => {
    expect(
      validateRuntimeConfig(
        createConfigWithFormLayout({
          children: [
            {
              type: 'select',
              props: {
                fieldId: 'role',
                label: 'Role',
                items: [{ label: 'Admin', value: 'admin' }],
                validations: {
                  email: true,
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
        message: 'Page "home" has an invalid layout at "layout[0].children[0].props.validations.email".',
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
                  email: true,
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
        message: 'Page "home" has an invalid layout at "layout[0].children[0].props.validations.email".',
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
                  email: true,
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
        message: 'Page "home" has an invalid layout at "layout[0].children[0].props.validations.email".',
      },
    })
  })

  it('accepts url as true (short form) in input textual', () => {
    const result = validateRuntimeConfig(
      createConfigWithFormLayout({
        children: [
          {
            type: 'input',
            props: {
              fieldId: 'website',
              label: 'Website',
              validations: {
                url: true,
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
        fieldId: 'website',
        validations: {
          url: { value: true },
        },
      },
    })
  })

  it('accepts url as extended form { value: true, message }', () => {
    const result = validateRuntimeConfig(
      createConfigWithFormLayout({
        children: [
          {
            type: 'input',
            props: {
              fieldId: 'website',
              label: 'Website',
              validations: {
                url: { value: true, message: 'Enter a valid URL' },
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
        fieldId: 'website',
        validations: {
          url: { value: true, message: 'Enter a valid URL' },
        },
      },
    })
  })

  it('accepts url in textarea', () => {
    const result = validateRuntimeConfig(
      createConfigWithFormLayout({
        children: [
          {
            type: 'textarea',
            props: {
              fieldId: 'links',
              label: 'Links',
              validations: {
                url: true,
              },
            },
          },
        ],
      }),
    )

    expect(result.status).toBe('ready')
  })

  it('rejects url in input with inputType number, date, datetime-local, time', () => {
    for (const inputType of ['number', 'date', 'datetime-local', 'time'] as const) {
      expect(
        validateRuntimeConfig(
          createConfigWithFormLayout({
            children: [
              {
                type: 'input',
                props: {
                  fieldId: 'field',
                  label: 'Field',
                  inputType,
                  validations: {
                    url: true,
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
          message: `Page "home" has an invalid layout at "layout[0].children[0].props.validations.url".`,
        },
      })
    }
  })

  it('rejects url in select, radioGroup, checkboxGroup', () => {
    expect(
      validateRuntimeConfig(
        createConfigWithFormLayout({
          children: [
            {
              type: 'select',
              props: {
                fieldId: 'role',
                label: 'Role',
                items: [{ label: 'Admin', value: 'admin' }],
                validations: {
                  url: true,
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
        message: 'Page "home" has an invalid layout at "layout[0].children[0].props.validations.url".',
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
                  url: true,
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
        message: 'Page "home" has an invalid layout at "layout[0].children[0].props.validations.url".',
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
                  url: true,
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
        message: 'Page "home" has an invalid layout at "layout[0].children[0].props.validations.url".',
      },
    })
  })

  it('accepts required with when condition', () => {
    const result = validateRuntimeConfig(
      createConfigWithFormLayout({
        children: [
          {
            type: 'input',
            props: {
              fieldId: 'name',
              label: 'Name',
              validations: {
                required: { value: true, when: { reference: 'forms.user-form.x', operator: 'equals', value: 'a' } },
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
        fieldId: 'name',
        validations: {
          required: { value: true, when: { reference: 'forms.user-form.x', operator: 'equals', value: 'a' } },
        },
      },
    })
  })

  it('accepts minLength with when condition using isTruthy', () => {
    const result = validateRuntimeConfig(
      createConfigWithFormLayout({
        children: [
          {
            type: 'input',
            props: {
              fieldId: 'name',
              label: 'Name',
              validations: {
                minLength: { value: 5, when: { reference: 'forms.user-form.check', operator: 'isTruthy' } },
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
        fieldId: 'name',
        validations: {
          minLength: { value: 5, when: { reference: 'forms.user-form.check', operator: 'isTruthy' } },
        },
      },
    })
  })

  it('accepts pattern with when condition using isFalsy', () => {
    const result = validateRuntimeConfig(
      createConfigWithFormLayout({
        children: [
          {
            type: 'input',
            props: {
              fieldId: 'code',
              label: 'Code',
              validations: {
                pattern: { value: '^\\d+$', when: { reference: 'queries.q.data.flag', operator: 'isFalsy' } },
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
        fieldId: 'code',
        validations: {
          pattern: { value: '^\\d+$', when: { reference: 'queries.q.data.flag', operator: 'isFalsy' } },
        },
      },
    })
  })

  it('accepts email with when condition using params reference', () => {
    const result = validateRuntimeConfig(
      createConfigWithFormLayout({
        children: [
          {
            type: 'input',
            props: {
              fieldId: 'contact',
              label: 'Contact',
              validations: {
                email: { value: true, when: { reference: 'params.mode', operator: 'equals', value: 'strict' } },
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
        fieldId: 'contact',
        validations: {
          email: { value: true, when: { reference: 'params.mode', operator: 'equals', value: 'strict' } },
        },
      },
    })
  })

  it('accepts url with when condition using notEquals', () => {
    const result = validateRuntimeConfig(
      createConfigWithFormLayout({
        children: [
          {
            type: 'input',
            props: {
              fieldId: 'website',
              label: 'Website',
              validations: {
                url: { value: true, when: { reference: 'forms.user-form.x', operator: 'notEquals', value: 'none' } },
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
        fieldId: 'website',
        validations: {
          url: { value: true, when: { reference: 'forms.user-form.x', operator: 'notEquals', value: 'none' } },
        },
      },
    })
  })

  it('accepts max with when condition using greaterThan', () => {
    const result = validateRuntimeConfig(
      createConfigWithFormLayout({
        children: [
          {
            type: 'input',
            props: {
              fieldId: 'age',
              label: 'Age',
              inputType: 'number',
              validations: {
                max: { value: 100, when: { reference: 'forms.user-form.x', operator: 'greaterThan', value: 0 } },
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
        fieldId: 'age',
        validations: {
          max: { value: 100, when: { reference: 'forms.user-form.x', operator: 'greaterThan', value: 0 } },
        },
      },
    })
  })

  it('rejects when.reference outside supported scope', () => {
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
                  required: { value: true, when: { reference: 'invalid.ref', operator: 'equals', value: 'a' } },
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
        message: expect.stringContaining('layout[0].children[0].props.validations.required.when.reference'),
      },
    })
  })

  it('rejects when.operator outside the catalog', () => {
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
                  required: { value: true, when: { reference: 'forms.user-form.x', operator: 'startsWith', value: 'a' } },
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
        message: expect.stringContaining('layout[0].children[0].props.validations.required.when.operator'),
      },
    })
  })

  it('rejects when with isTruthy and value declared', () => {
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
                  required: { value: true, when: { reference: 'forms.user-form.x', operator: 'isTruthy', value: 'a' } },
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
        message: expect.stringContaining('layout[0].children[0].props.validations.required.when.value'),
      },
    })
  })

  it('rejects when with isFalsy and value declared', () => {
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
                  required: { value: true, when: { reference: 'forms.user-form.x', operator: 'isFalsy', value: 'a' } },
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
        message: expect.stringContaining('layout[0].children[0].props.validations.required.when.value'),
      },
    })
  })

  it('rejects when with equals without value', () => {
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
                  required: { value: true, when: { reference: 'forms.user-form.x', operator: 'equals' } },
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
        message: expect.stringContaining('layout[0].children[0].props.validations.required.when.value'),
      },
    })
  })

  it('rejects when with notEquals without value', () => {
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
                  minLength: { value: 3, when: { reference: 'forms.user-form.x', operator: 'notEquals' } },
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
        message: expect.stringContaining('layout[0].children[0].props.validations.minLength.when.value'),
      },
    })
  })

  it('rejects when with greaterThan and non-numeric value', () => {
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
                  max: { value: 100, when: { reference: 'forms.user-form.x', operator: 'greaterThan', value: 'abc' } },
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
        message: expect.stringContaining('layout[0].children[0].props.validations.max.when.value'),
      },
    })
  })

  it('rejects when with lessThan and non-numeric value', () => {
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
                  min: { value: 0, when: { reference: 'forms.user-form.x', operator: 'lessThan', value: 'abc' } },
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
        message: expect.stringContaining('layout[0].children[0].props.validations.min.when.value'),
      },
    })
  })

  it('rejects when with equals and non-scalar value (array)', () => {
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
                  required: { value: true, when: { reference: 'forms.user-form.x', operator: 'equals', value: ['a', 'b'] } },
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
        message: expect.stringContaining('layout[0].children[0].props.validations.required.when.value'),
      },
    })
  })

  it('short forms still work without when', () => {
    const result = validateRuntimeConfig(
      createConfigWithFormLayout({
        children: [
          {
            type: 'input',
            props: {
              fieldId: 'name',
              label: 'Name',
              validations: {
                required: true,
                minLength: 5,
                pattern: '^[A-Z]',
              },
            },
          },
          {
            type: 'input',
            props: {
              fieldId: 'contact',
              label: 'Contact',
              validations: {
                email: true,
              },
            },
          },
          {
            type: 'input',
            props: {
              fieldId: 'website',
              label: 'Website',
              validations: {
                url: true,
              },
            },
          },
        ],
      }),
    )

    expect(result.status).toBe('ready')
  })

  it('extended form without when validates exactly as before (retrocompatibility)', () => {
    const result = validateRuntimeConfig(
      createConfigWithFormLayout({
        children: [
          {
            type: 'input',
            props: {
              fieldId: 'name',
              label: 'Name',
              validations: {
                required: { value: true, message: 'Required field' },
                minLength: { value: 3, message: 'Too short' },
                pattern: { value: '^[A-Z]', message: 'Must start with uppercase' },
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
        fieldId: 'name',
        validations: {
          required: { value: true, message: 'Required field' },
          minLength: { value: 3, message: 'Too short' },
          pattern: { value: '^[A-Z]', message: 'Must start with uppercase' },
        },
      },
    })

    // Ensure no 'when' property exists in the output
    const validations = (formNode.children?.[0] as { props: { validations: Record<string, unknown> } }).props.validations
    expect(validations.required).not.toHaveProperty('when')
    expect(validations.minLength).not.toHaveProperty('when')
    expect(validations.pattern).not.toHaveProperty('when')
  })

  it('existing rules (required, minLength, maxLength, min, max, minSelections, maxSelections) still validate without changes', () => {
    const result = validateRuntimeConfig(
      createConfigWithFormLayout({
        children: [
          {
            type: 'input',
            props: {
              fieldId: 'name',
              label: 'Name',
              validations: {
                required: true,
                minLength: 2,
                maxLength: { value: 50, message: 'Too long' },
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
                min: 0,
                max: { value: 150, message: 'Too old' },
              },
            },
          },
          {
            type: 'checkboxGroup',
            props: {
              fieldId: 'tags',
              label: 'Tags',
              items: [
                { label: 'A', value: 'a' },
                { label: 'B', value: 'b' },
              ],
              validations: {
                minSelections: 1,
                maxSelections: 2,
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
        fieldId: 'name',
        validations: {
          required: { value: true },
          minLength: { value: 2 },
          maxLength: { value: 50, message: 'Too long' },
        },
      },
    })

    expect(formNode.children?.[1]).toMatchObject({
      type: 'input',
      props: {
        fieldId: 'age',
        validations: {
          min: { value: 0 },
          max: { value: 150, message: 'Too old' },
        },
      },
    })

    expect(formNode.children?.[2]).toMatchObject({
      type: 'checkboxGroup',
      props: {
        fieldId: 'tags',
        validations: {
          minSelections: { value: 1 },
          maxSelections: { value: 2 },
        },
      },
    })
  })
})
