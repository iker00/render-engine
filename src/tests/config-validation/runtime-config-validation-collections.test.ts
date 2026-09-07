import { describe, expect, it } from 'vitest'
import { validateRuntimeConfig } from '../../config/runtime-config'
import {
  createConfigWithPages,
  createConfigWithLayout,
  createConfigWithFormLayout,
  createRepeaterNode,
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

    it('accepts dynamic object collection shapes for select when they declare the required consumer mappings', () => {
      const result = validateRuntimeConfig(
        createConfigWithFormLayout({
          children: [
            {
              type: 'select',
              props: {
                fieldId: 'role',
                label: 'Role',
                items: {
                  source: 'queries.searchUsers.data.results',
                  itemType: 'object',
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
                source: 'queries.searchUsers.data.results',
                itemType: 'object',
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

    it('accepts the four supported items shapes for select, radioGroup and checkboxGroup', () => {
      const result = validateRuntimeConfig(
        createConfigWithFormLayout({
          children: [
            {
              type: 'select',
              props: {
                fieldId: 'selectManualLiteral',
                label: 'Select (manual literal)',
                items: [
                  { label: 'Admin', value: 'admin' },
                  { label: 'Editor', value: 'editor' },
                ],
              },
            },
            {
              type: 'select',
              props: {
                fieldId: 'selectManualScalar',
                label: 'Select (manual scalar)',
                items: { values: ['admin', 'editor'] },
              },
            },
            {
              type: 'select',
              props: {
                fieldId: 'selectDynamicScalar',
                label: 'Select (dynamic scalar)',
                items: { source: 'queries.roles.data', itemType: 'scalar' },
              },
            },
            {
              type: 'select',
              props: {
                fieldId: 'selectDynamicObject',
                label: 'Select (dynamic object)',
                items: {
                  source: 'queries.roles.data.results',
                  itemType: 'object',
                  label: 'name',
                  value: 'id',
                },
              },
            },
            {
              type: 'radioGroup',
              props: {
                fieldId: 'radioManualLiteral',
                label: 'Radio (manual literal)',
                items: [{ label: 'Yes', value: 'yes' }],
              },
            },
            {
              type: 'radioGroup',
              props: {
                fieldId: 'radioManualScalar',
                label: 'Radio (manual scalar)',
                items: { values: [1, 2] },
              },
            },
            {
              type: 'radioGroup',
              props: {
                fieldId: 'radioDynamicScalar',
                label: 'Radio (dynamic scalar)',
                items: { source: 'queries.roles.data', itemType: 'scalar' },
              },
            },
            {
              type: 'radioGroup',
              props: {
                fieldId: 'radioDynamicObject',
                label: 'Radio (dynamic object)',
                items: {
                  source: 'queries.roles.data.results',
                  itemType: 'object',
                  label: '{{item.name}}',
                  value: 'id',
                },
              },
            },
            {
              type: 'checkboxGroup',
              props: {
                fieldId: 'checkboxManualLiteral',
                label: 'Checkbox (manual literal)',
                items: [{ label: 'A', value: 'a' }],
              },
            },
            {
              type: 'checkboxGroup',
              props: {
                fieldId: 'checkboxManualScalar',
                label: 'Checkbox (manual scalar)',
                items: { values: ['a', 'b'] },
              },
            },
            {
              type: 'checkboxGroup',
              props: {
                fieldId: 'checkboxDynamicScalar',
                label: 'Checkbox (dynamic scalar)',
                items: { source: 'queries.roles.data', itemType: 'scalar' },
              },
            },
            {
              type: 'checkboxGroup',
              props: {
                fieldId: 'checkboxDynamicObject',
                label: 'Checkbox (dynamic object)',
                items: {
                  source: 'queries.roles.data.results',
                  itemType: 'object',
                  label: 'name',
                  value: 'id',
                },
              },
            },
          ],
        }),
      )

      expect(result.status).toBe('ready')
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
                  itemType: 'object',
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
                  source: 'queries.searchAccounts.data.results',
                  itemType: 'object',
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
                    itemType: 'object',
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

    it('rejects manual object list collections when required mappings are missing', () => {
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
    })

    it('rejects retired and incomplete items shapes for select, radioGroup and checkboxGroup', () => {
      const invalidItemsShapes: Array<Record<string, unknown>> = [
        // manual object (retired shape, no compatibility adapter)
        {
          values: [
            { id: 'admin', name: 'Admin' },
            { id: 'editor', name: 'Editor' },
          ],
          label: 'name',
          value: 'id',
        },
        // dynamic without an explicit itemType discriminator
        { source: 'queries.roles.data.results' },
        { source: 'queries.roles.data.results', label: 'name', value: 'id' },
        // dynamic itemType: 'scalar' with label/value present
        { source: 'queries.roles.data', itemType: 'scalar', label: 'name' },
        { source: 'queries.roles.data', itemType: 'scalar', value: 'id' },
        // dynamic itemType: 'object' missing label and/or value
        { source: 'queries.roles.data.results', itemType: 'object', label: 'name' },
        { source: 'queries.roles.data.results', itemType: 'object', value: 'id' },
        { source: 'queries.roles.data.results', itemType: 'object' },
      ]

      for (const nodeType of ['select', 'radioGroup', 'checkboxGroup'] as const) {
        for (const items of invalidItemsShapes) {
          const result = validateRuntimeConfig(
            createConfigWithFormLayout({
              children: [
                {
                  type: nodeType,
                  props: {
                    fieldId: 'role',
                    label: 'Role',
                    items,
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
              message: expect.stringContaining('layout[0].children[0].props.items'),
            },
          })
        }
      }
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
                    source: 'queries.searchUsers.data.results',
                    itemType: 'object',
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

    it('rejects list dynamic collection sources that omit both the scalar discriminator and object mappings', () => {
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
                items: { source: 'tokens.session.value', itemType: 'scalar' },
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
                items: { source: 'tokens.session.value', itemType: 'scalar' },
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
                items: { source: 'tokens.session.value', itemType: 'scalar' },
              },
            },
          ],
        }),
      )
      expect(result.status).toBe('error')
    })
  })

  describe('collection pipeline source (allowPipeline opt-in)', () => {
    const invalidSourceMessage =
      'collection sources must use queries.{queryName}.data, queries.{queryName}.data.* or item.*.'

    function expectInvalidSourceAt(result: ReturnType<typeof validateRuntimeConfig>, path: string) {
      expect(result).toEqual({
        status: 'error',
        error: {
          code: 'invalid-layout',
          displayMode: 'development-only',
          message: expect.stringContaining(`"${path}": ${invalidSourceMessage}`),
        },
      })
    }

    const malformedPipelineCases: Array<[string, string]> = [
      ['unknown operation name', 'sort:price,asc'],
      ['invalid orderby dir', 'orderby:title,up'],
      ['wrong number of filter args', 'filter:status,eq'],
      ['unknown filter operator', 'filter:status,unknown-op,"x"'],
      ['list literal outside filter:in', 'filter:role,eq,["a","b"]'],
      ['malformed list literal', 'filter:role,in,['],
    ]

    describe('repeater.props.items.source', () => {
      it('keeps accepting a source without a pipeline (regression)', () => {
        const result = validateRuntimeConfig(
          createConfigWithLayout([
            createRepeaterNode({ props: { items: { source: 'queries.posts.data', key: 'id' }, template: [] } }),
          ]),
        )
        expect(result.status).toBe('ready')
      })

      it('accepts a well-formed pipeline', () => {
        const result = validateRuntimeConfig(
          createConfigWithLayout([
            createRepeaterNode({
              props: {
                items: { source: 'queries.posts.data | orderby:title,asc | slice:0,10', key: 'id' },
                template: [],
              },
            }),
          ]),
        )
        expect(result.status).toBe('ready')
        if (result.status === 'ready') {
          expect(result.page.layout[0]).toMatchObject({
            props: { items: { source: 'queries.posts.data | orderby:title,asc | slice:0,10' } },
          })
        }
      })

      it('rejects an invalid baseReference even with a well-formed pipeline', () => {
        const result = validateRuntimeConfig(
          createConfigWithLayout([
            createRepeaterNode({
              props: {
                items: { source: 'params.something | orderby:x,asc', key: 'id' },
                template: [],
              },
            }),
          ]),
        )
        expectInvalidSourceAt(result, 'layout[0].props.items.source')
      })

      it.each(malformedPipelineCases)('rejects a malformed pipeline stage: %s', (_label, stage) => {
        const result = validateRuntimeConfig(
          createConfigWithLayout([
            createRepeaterNode({
              props: {
                items: { source: `queries.posts.data | ${stage}`, key: 'id' },
                template: [],
              },
            }),
          ]),
        )
        expectInvalidSourceAt(result, 'layout[0].props.items.source')
      })
    })

    describe('list.props.items.source', () => {
      it('accepts a well-formed pipeline', () => {
        const result = validateRuntimeConfig(
          createConfigWithLayout([
            {
              type: 'list',
              props: {
                items: { source: 'queries.products.data | orderby:price,desc | slice:0,10', itemType: 'scalar' },
              },
            },
          ]),
        )
        expect(result.status).toBe('ready')
      })

      it('rejects an invalid baseReference even with a well-formed pipeline', () => {
        const result = validateRuntimeConfig(
          createConfigWithLayout([
            {
              type: 'list',
              props: {
                items: { source: 'params.something | orderby:x,asc', itemType: 'scalar' },
              },
            },
          ]),
        )
        expectInvalidSourceAt(result, 'layout[0].props.items.source')
      })

      it('rejects a malformed pipeline stage', () => {
        const result = validateRuntimeConfig(
          createConfigWithLayout([
            {
              type: 'list',
              props: {
                items: { source: 'queries.products.data | sort:price,asc', itemType: 'scalar' },
              },
            },
          ]),
        )
        expectInvalidSourceAt(result, 'layout[0].props.items.source')
      })
    })

    describe('table.props.rows.source (dynamic mode)', () => {
      it('accepts a well-formed pipeline', () => {
        const result = validateRuntimeConfig(
          createConfigWithLayout([
            {
              type: 'table',
              props: {
                headers: ['Name', 'Role'],
                rows: {
                  source: 'queries.users.data.items | orderby:name,asc | slice:0,5',
                  cells: ['item.name', 'item.role'],
                },
              },
            },
          ]),
        )
        expect(result.status).toBe('ready')
      })

      it('rejects an invalid baseReference even with a well-formed pipeline', () => {
        const result = validateRuntimeConfig(
          createConfigWithLayout([
            {
              type: 'table',
              props: {
                headers: ['Name', 'Role'],
                rows: {
                  source: 'params.something | orderby:x,asc',
                  cells: ['item.name', 'item.role'],
                },
              },
            },
          ]),
        )
        expectInvalidSourceAt(result, 'layout[0].props.rows.source')
      })

      it('rejects a malformed pipeline stage', () => {
        const result = validateRuntimeConfig(
          createConfigWithLayout([
            {
              type: 'table',
              props: {
                headers: ['Name', 'Role'],
                rows: {
                  source: 'queries.users.data.items | filter:status,eq',
                  cells: ['item.name', 'item.role'],
                },
              },
            },
          ]),
        )
        expectInvalidSourceAt(result, 'layout[0].props.rows.source')
      })
    })

    describe('select/radioGroup/checkboxGroup props.items.source', () => {
      it.each(['select', 'radioGroup', 'checkboxGroup'] as const)(
        'accepts a well-formed pipeline in %s',
        (nodeType) => {
          const result = validateRuntimeConfig(
            createConfigWithFormLayout({
              children: [
                {
                  type: nodeType,
                  props: {
                    fieldId: 'role',
                    label: 'Role',
                    items: { source: 'queries.roles.data | orderby:name,asc', itemType: 'scalar' },
                  },
                },
              ],
            }),
          )
          expect(result.status).toBe('ready')
        },
      )

      it('rejects an invalid baseReference even with a well-formed pipeline', () => {
        const result = validateRuntimeConfig(
          createConfigWithFormLayout({
            children: [
              {
                type: 'select',
                props: {
                  fieldId: 'role',
                  label: 'Role',
                  items: { source: 'params.something | orderby:x,asc', itemType: 'scalar' },
                },
              },
            ],
          }),
        )
        expectInvalidSourceAt(result, 'layout[0].children[0].props.items.source')
      })

      it('rejects a malformed pipeline stage', () => {
        const result = validateRuntimeConfig(
          createConfigWithFormLayout({
            children: [
              {
                type: 'select',
                props: {
                  fieldId: 'role',
                  label: 'Role',
                  items: { source: 'queries.roles.data | orderby:name,up', itemType: 'scalar' },
                },
              },
            ],
          }),
        )
        expectInvalidSourceAt(result, 'layout[0].children[0].props.items.source')
      })

      it.each([
        ['quoted scalar literal', 'filter:status,eq,"pending"'],
        ['numeric literal', 'filter:price,gt,10'],
        ['forms reference', 'filter:status,eq,forms.searchForm.status'],
        ['params reference', 'filter:status,eq,params.status'],
        ['queries reference', 'filter:status,eq,queries.filters.data.status'],
        ['item reference', 'filter:status,eq,item.currentStatus'],
        ['row reference', 'filter:status,eq,row.currentStatus'],
        ['list literal with in', 'filter:role,in,["admin","editor"]'],
        ['list reference with in', 'filter:role,in,forms.filters.selectedRoles'],
      ])('accepts a filter stage argument shape: %s', (_label, stage) => {
        const result = validateRuntimeConfig(
          createConfigWithFormLayout({
            children: [
              {
                type: 'select',
                props: {
                  fieldId: 'role',
                  label: 'Role',
                  items: { source: `queries.roles.data | ${stage}`, itemType: 'scalar' },
                },
              },
            ],
          }),
        )
        expect(result.status).toBe('ready')
      })
    })

    describe('surfaces outside pipeline scope (gallery, map, autocomplete)', () => {
      it('rejects a pipeline in gallery props.source.source', () => {
        const result = validateRuntimeConfig(
          createConfigWithLayout([
            {
              type: 'gallery',
              props: {
                source: {
                  source: 'queries.photos.data | orderby:name,asc',
                  key: 'id',
                  alt: 'name',
                  mode: 'src',
                  src: 'url',
                },
                display: { mode: 'paginated', pagination: { pageSize: 4 } },
              },
            },
          ]),
        )
        expectInvalidSourceAt(result, 'layout[0].props.source.source')
      })

      it('rejects a pipeline in map props.markerSources[].source', () => {
        const result = validateRuntimeConfig(
          createConfigWithLayout([
            {
              type: 'map',
              props: {
                markerSources: [
                  {
                    source: 'queries.posts.data | orderby:name,asc',
                    position: { lat: 'coords.lat', lng: 'coords.lng' },
                    label: 'name',
                  },
                ],
              },
            },
          ]),
        )
        expectInvalidSourceAt(result, 'layout[0].props.markerSources[0].source')
      })

      it('rejects a pipeline in autocomplete props.items.source', () => {
        const result = validateRuntimeConfig(
          createConfigWithFormLayout({
            children: [
              {
                type: 'autocomplete',
                props: {
                  fieldId: 'city',
                  label: 'City',
                  items: { source: 'queries.searchCities.data | orderby:name,asc', itemType: 'scalar' },
                },
              },
            ],
          }),
        )
        expectInvalidSourceAt(result, 'layout[0].children[0].props.items.source')
      })
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
                items: { source: 'invalid.ref', itemType: 'scalar' },
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
