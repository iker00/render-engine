import { describe, expect, it } from 'vitest'
import { validateRuntimeConfig } from '../../config/runtime-config'
import {
  createConfigWithPages,
  createConfigWithLayout,
  createConfigWithFormLayout,
} from './helpers'

describe('validateRuntimeConfig', () => {
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

    it('accepts template strings in closed collection projection fields', () => {
      const result = validateRuntimeConfig(
        createConfigWithFormLayout({
          children: [
            {
              type: 'select',
              props: {
                fieldId: 'dynamicUser',
                label: 'Dynamic user',
                items: {
                  source: 'queries.searchUsers.data.results',
                  label: '{{item.code}} - {{item.profile.name}}',
                  value: '{{item.type}}:{{item.id}}',
                },
              },
            },
            {
              type: 'radioGroup',
              props: {
                fieldId: 'manualUser',
                label: 'Manual user',
                items: {
                  values: [
                    { id: 'user-1', type: 'admin', code: 'A1', profile: { name: 'Ada' } },
                    { id: 'user-2', type: 'editor', code: 'G2', profile: { name: 'Grace' } },
                  ],
                  label: '{{item.code}} - {{item.profile.name}}',
                  value: '{{item.type}}:{{item.id}}',
                },
              },
            },
            {
              type: 'checkboxGroup',
              props: {
                fieldId: 'legacyUsers',
                label: 'Legacy users',
                items: [
                  { label: '{{queries.user.data.name}}', value: '{{queries.user.data.id}}' },
                  { label: 'Manual', value: 'manual' },
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
                    items: {
                      values: [
                        { code: 'A1', title: 'Alpha' },
                        { code: 'B2', title: 'Beta' },
                      ],
                      itemText: '{{item.code}} - {{item.title}}',
                    },
                  },
                },
                {
                  type: 'list',
                  props: {
                    items: {
                      source: 'queries.articles.data.results',
                      itemText: '{{ item.code }} - {{item.title}}',
                    },
                  },
                },
              ],
            },
          ],
        }),
      )

      expect(result.status).toBe('ready')
    })

    it('accepts unmatched template delimiters only in closed collection projection fields', () => {
      expect(
        validateRuntimeConfig(
          createConfigWithFormLayout({
            children: [
              {
                type: 'select',
                props: {
                  fieldId: 'dynamicUser',
                  label: 'Dynamic user',
                  items: {
                    source: 'queries.searchUsers.data.results',
                    label: 'Nombre }}',
                    value: '{{item.id',
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
                        values: [{ name: 'Ada' }],
                        itemText: '{{item.name',
                      },
                    },
                  },
                ],
              },
            ],
          }),
        ).status,
      ).toBe('ready')

      expect(
        validateRuntimeConfig(
          createConfigWithLayout([
            {
              type: 'repeater',
              props: {
                items: {
                  source: 'queries.posts.data.results',
                  key: '{{item.id}}',
                },
                template: [],
              },
            },
          ]),
        ),
      ).toEqual({
        status: 'error',
        error: {
          code: 'invalid-layout',
          displayMode: 'development-only',
          message:
            `Page "home" has an invalid layout at "layout[0].props.items.key": repeater item keys must use a non-empty relative item path.
  → repeater[0]
  Node: {"type":"repeater"}`,
        },
      })

      expect(
        validateRuntimeConfig(
          createConfigWithLayout([
            {
              type: 'list',
              props: {
                items: {
                  source: '{{queries.searchUsers.data.results}}',
                  itemType: 'scalar',
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
          message:
            'Page "home" has an invalid layout at "layout[0].props.items.source": collection sources must use queries.{queryName}.data, queries.{queryName}.data.* or item.*.',
        },
      })
    })

    it('keeps historical option value homogeneity when legacy options use template strings', () => {
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
                    { label: '{{queries.role.data.label}}', value: '{{queries.role.data.id}}' },
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
          message: expect.stringContaining('layout[0].children[0].props.items.value'),
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
          message: expect.stringContaining('layout[0].children[0].props.items'),
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
          message: 'Page "home" has an invalid layout at "layout[0].props.items.source": collection sources must use queries.{queryName}.data, queries.{queryName}.data.* or item.*.',
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
          message: expect.stringContaining('layout[0].children[0].props.items.source'),
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
          message: 'Page "home" has an invalid layout at "layout[0].props.items.source": collection sources must use queries.{queryName}.data, queries.{queryName}.data.* or item.*.',
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
          message: expect.stringContaining('layout[0].children[0].props.items.source'),
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
          message: expect.stringContaining('layout[0].children[0].props.items.value'),
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
          message: expect.stringContaining('dynamic scalar collections must declare itemType: "scalar", and dynamic object collections must declare label and value'),
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
          message: expect.stringContaining('select item values must all be strings or all be numbers'),
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
          message: expect.stringContaining('select item values must all be strings or all be numbers'),
        },
      })
    })
  })

  describe('tokens.* gating in collection sources', () => {
    it('rejects tokens.* in repeater.props.items.source', () => {
      const result = validateRuntimeConfig(
        createConfigWithLayout([
          {
            type: 'repeater',
            props: {
              items: { source: 'tokens.session.value', key: 'id' },
              template: [],
            },
          },
        ]),
      )
      expect(result.status).toBe('error')
    })

    it('rejects tokens.* in list.props.items.source', () => {
      const result = validateRuntimeConfig(
        createConfigWithLayout([
          {
            type: 'list',
            props: {
              items: { source: 'tokens.session.value' },
            },
          },
        ]),
      )
      expect(result.status).toBe('error')
    })

    it('rejects tokens.* in select.props.items.source inside a form', () => {
      const result = validateRuntimeConfig(
        createConfigWithFormLayout({
          children: [
            {
              type: 'select',
              props: {
                fieldId: 'role',
                label: 'Role',
                items: { source: 'tokens.session.value', itemText: 'label' },
              },
            },
          ],
        }),
      )
      expect(result.status).toBe('error')
    })

    it('rejects tokens.* in radioGroup.props.items.source inside a form', () => {
      const result = validateRuntimeConfig(
        createConfigWithFormLayout({
          children: [
            {
              type: 'radioGroup',
              props: {
                fieldId: 'role',
                label: 'Role',
                items: { source: 'tokens.session.value', itemText: 'label' },
              },
            },
          ],
        }),
      )
      expect(result.status).toBe('error')
    })

    it('rejects tokens.* in checkboxGroup.props.items.source inside a form', () => {
      const result = validateRuntimeConfig(
        createConfigWithFormLayout({
          children: [
            {
              type: 'checkboxGroup',
              props: {
                fieldId: 'roles',
                label: 'Roles',
                items: { source: 'tokens.session.value', itemText: 'label' },
              },
            },
          ],
        }),
      )
      expect(result.status).toBe('error')
    })
  })

  describe('breadcrumb enrichment', () => {
    it('includes breadcrumb and excerpt for collection source error in select', () => {
      const result = validateRuntimeConfig(
        createConfigWithFormLayout({
          children: [
            {
              type: 'select',
              props: {
                fieldId: 'roles',
                label: 'Roles',
                items: { source: 'invalid.ref' },
              },
            },
          ],
        }),
      )

      expect(result.status).toBe('error')
      if (result.status !== 'error') throw new Error('Expected error')
      expect(result.error.message).toContain('form("user-form") > select(fieldId: "roles")')
      expect(result.error.message).toContain('Node: ')
    })
  })
})
