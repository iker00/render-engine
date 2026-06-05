import { describe, expect, it } from 'vitest'
import { validateRuntimeConfig } from '../../config/runtime-config'
import {
  createConfigWithPages,
  createConfigWithLayout,
  createConfigWithFormLayout,
} from './helpers'

describe('validateRuntimeConfig', () => {
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
            'Page "home" has an invalid layout at "layout[0].children[0]": form nodes only accept input, textarea, select, radioGroup, checkboxGroup, button, heading, paragraph, image, table, container, accordion and divider descendants.',
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

    describe('placeholder field on input, textarea and select nodes', () => {
      it('accepts input with props.placeholder as a string and exposes it in the normalized node', () => {
        const result = validateRuntimeConfig(
          createConfigWithFormLayout({
            children: [
              {
                type: 'input',
                props: {
                  fieldId: 'name',
                  label: 'Name',
                  placeholder: 'Introduce tu nombre',
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
          props: { fieldId: 'name', placeholder: 'Introduce tu nombre' },
        })
      })

      it('accepts input without props.placeholder and the normalized node does not include it', () => {
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
            ],
          }),
        )

        expect(result.status).toBe('ready')
        if (result.status !== 'ready') throw new Error('Expected ready')

        const formNode = result.page.layout[0]
        if (formNode.type !== 'form') throw new Error('Expected form')

        expect(formNode.children?.[0]).not.toHaveProperty('props.placeholder')
      })

      it('accepts input with props.placeholder as empty string and preserves it', () => {
        const result = validateRuntimeConfig(
          createConfigWithFormLayout({
            children: [
              {
                type: 'input',
                props: {
                  fieldId: 'name',
                  label: 'Name',
                  placeholder: '',
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
          props: { placeholder: '' },
        })
      })

      it('rejects input with props.placeholder as a non-string value', () => {
        const result = validateRuntimeConfig(
          createConfigWithFormLayout({
            children: [
              {
                type: 'input',
                props: {
                  fieldId: 'name',
                  label: 'Name',
                  placeholder: 123,
                },
              },
            ],
          }),
        )

        expect(result).toEqual({
          status: 'error',
          error: {
            code: 'invalid-layout',
            displayMode: 'development-only',
            message: 'Page "home" has an invalid layout at "layout[0].children[0].props.placeholder".',
          },
        })
      })

      it('accepts textarea with props.placeholder as a string and exposes it in the normalized node', () => {
        const result = validateRuntimeConfig(
          createConfigWithFormLayout({
            children: [
              {
                type: 'textarea',
                props: {
                  fieldId: 'bio',
                  label: 'Bio',
                  placeholder: 'Escribe aquí...',
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
          type: 'textarea',
          props: { fieldId: 'bio', placeholder: 'Escribe aquí...' },
        })
      })

      it('rejects textarea with props.placeholder as a non-string value', () => {
        const result = validateRuntimeConfig(
          createConfigWithFormLayout({
            children: [
              {
                type: 'textarea',
                props: {
                  fieldId: 'bio',
                  label: 'Bio',
                  placeholder: true,
                },
              },
            ],
          }),
        )

        expect(result).toEqual({
          status: 'error',
          error: {
            code: 'invalid-layout',
            displayMode: 'development-only',
            message: 'Page "home" has an invalid layout at "layout[0].children[0].props.placeholder".',
          },
        })
      })

      it('accepts select simple with props.placeholder and exposes it in the normalized node', () => {
        const result = validateRuntimeConfig(
          createConfigWithFormLayout({
            children: [
              {
                type: 'select',
                props: {
                  fieldId: 'role',
                  label: 'Role',
                  placeholder: 'Selecciona una opción',
                  items: [{ label: 'Admin', value: 'admin' }],
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
          type: 'select',
          props: { fieldId: 'role', placeholder: 'Selecciona una opción' },
        })
      })

      it('accepts select.multiple with props.placeholder declared (not rejected, runtime ignores it silently)', () => {
        const result = validateRuntimeConfig(
          createConfigWithFormLayout({
            children: [
              {
                type: 'select',
                props: {
                  fieldId: 'scopes',
                  label: 'Scopes',
                  multiple: true,
                  placeholder: 'Selecciona varias',
                  items: { values: ['read', 'write'] },
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
          type: 'select',
          props: { fieldId: 'scopes', multiple: true, placeholder: 'Selecciona varias' },
        })
      })

      it('rejects select with props.placeholder as a non-string value', () => {
        const result = validateRuntimeConfig(
          createConfigWithFormLayout({
            children: [
              {
                type: 'select',
                props: {
                  fieldId: 'role',
                  label: 'Role',
                  placeholder: 99,
                  items: [{ label: 'Admin', value: 'admin' }],
                },
              },
            ],
          }),
        )

        expect(result).toEqual({
          status: 'error',
          error: {
            code: 'invalid-layout',
            displayMode: 'development-only',
            message: 'Page "home" has an invalid layout at "layout[0].children[0].props.placeholder".',
          },
        })
      })

      it('strips props.placeholder from radioGroup (not in scope) without error', () => {
        const result = validateRuntimeConfig(
          createConfigWithFormLayout({
            children: [
              {
                type: 'radioGroup',
                props: {
                  fieldId: 'role',
                  label: 'Role',
                  placeholder: 'Should be stripped',
                  items: [{ label: 'Admin', value: 'admin' }],
                },
              },
            ],
          }),
        )

        expect(result.status).toBe('ready')
        if (result.status !== 'ready') throw new Error('Expected ready')

        const formNode = result.page.layout[0]
        if (formNode.type !== 'form') throw new Error('Expected form')

        expect(formNode.children?.[0]).not.toHaveProperty('props.placeholder')
      })

      it('strips props.placeholder from checkboxGroup (not in scope) without error', () => {
        const result = validateRuntimeConfig(
          createConfigWithFormLayout({
            children: [
              {
                type: 'checkboxGroup',
                props: {
                  fieldId: 'scopes',
                  label: 'Scopes',
                  placeholder: 'Should be stripped',
                  items: { values: ['read', 'write'] },
                },
              },
            ],
          }),
        )

        expect(result.status).toBe('ready')
        if (result.status !== 'ready') throw new Error('Expected ready')

        const formNode = result.page.layout[0]
        if (formNode.type !== 'form') throw new Error('Expected form')

        expect(formNode.children?.[0]).not.toHaveProperty('props.placeholder')
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
})
