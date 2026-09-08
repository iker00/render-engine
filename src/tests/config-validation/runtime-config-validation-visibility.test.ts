import { describe, expect, it } from 'vitest'
import { validateRuntimeConfig } from '../../config/runtime-config'
import { whenConditionSchema } from '../../config/runtime-config-zod'
import {
  createConfigWithPages,
  createConfigWithLayout,
  createVisibilityRule,
  createRepeaterNode,
} from './helpers'

describe('validateRuntimeConfig', () => {
  describe('declarative api contract', () => {
    it('accepts optional visibility across all supported node types without changing the normalized layout shape', () => {
      const result = validateRuntimeConfig(
        createConfigWithPages([
          {
            id: 'home',
            layout: [
              {
                type: 'heading',
                visibility: createVisibilityRule(),
                props: {
                  text: 'Visible heading',
                  level: 2,
                },
              },
              {
                type: 'paragraph',
                visibility: createVisibilityRule({
                  operator: 'notEquals',
                  value: 'guest',
                }),
                props: {
                  text: 'Visible paragraph',
                },
              },
              {
                type: 'list',
                visibility: createVisibilityRule({
                  reference: 'queries.searchUsers.data.results',
                  operator: 'greaterThan',
                  value: 0,
                }),
                props: {
                  items: ['One', 'Two'],
                },
              },
              {
                type: 'button',
                visibility: createVisibilityRule({
                  reference: 'queries.searchUsers.status',
                  operator: 'equals',
                  value: 'success',
                }),
                props: {
                  label: 'Standalone action',
                  action: {
                    type: 'navigateTo',
                    pageId: 'details',
                  },
                },
              },
              {
                type: 'container',
                visibility: createVisibilityRule({
                  reference: 'queries.searchUsers.error',
                  operator: 'isFalsy',
                }),
                children: [
                  {
                    type: 'paragraph',
                    props: {
                      text: 'Nested child',
                    },
                  },
                ],
              },
              {
                type: 'form',
                id: 'profile-form',
                visibility: createVisibilityRule({
                  reference: 'queries.searchUsers',
                  operator: 'isTruthy',
                }),
                children: [
                  {
                    type: 'input',
                    visibility: createVisibilityRule({
                      reference: 'forms.profile.role',
                      operator: 'equals',
                      value: 'admin',
                    }),
                    props: {
                      fieldId: 'name',
                      label: 'Name',
                    },
                  },
                  {
                    type: 'textarea',
                    visibility: createVisibilityRule({
                      reference: 'forms.profile.bio',
                      operator: 'isFalsy',
                    }),
                    props: {
                      fieldId: 'bio',
                      label: 'Bio',
                    },
                  },
                  {
                    type: 'select',
                    visibility: createVisibilityRule({
                      reference: 'queries.searchUsers.data',
                      operator: 'isTruthy',
                    }),
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
                    type: 'button',
                    visibility: createVisibilityRule({
                      reference: 'queries.searchUsers.data.results',
                      operator: 'lessThan',
                      value: 5,
                    }),
                    props: {
                      label: 'Submit',
                    },
                  },
                ],
              },
            ],
          },
          {
            id: 'details',
            layout: [],
          },
        ]),
      )
      if (result.status !== 'ready') {
        throw new Error('Expected ready result')
      }

      expect(result.config.pages[0].layout).toEqual([
        {
          type: 'heading',
          visibility: createVisibilityRule(),
          props: {
            text: 'Visible heading',
            level: 2,
          },
        },
        {
          type: 'paragraph',
          visibility: createVisibilityRule({
            operator: 'notEquals',
            value: 'guest',
          }),
          props: {
            text: 'Visible paragraph',
          },
        },
        {
          type: 'list',
          visibility: createVisibilityRule({
            reference: 'queries.searchUsers.data.results',
            operator: 'greaterThan',
            value: 0,
          }),
          props: {
            items: ['One', 'Two'],
          },
        },
        {
          type: 'button',
          visibility: createVisibilityRule({
            reference: 'queries.searchUsers.status',
            operator: 'equals',
            value: 'success',
          }),
          props: {
            label: 'Standalone action',
            action: {
              type: 'navigateTo',
              pageId: 'details',
            },
          },
        },
        {
          type: 'container',
          visibility: createVisibilityRule({
            reference: 'queries.searchUsers.error',
            operator: 'isFalsy',
          }),
          children: [
            {
              type: 'paragraph',
              props: {
                text: 'Nested child',
              },
            },
          ],
        },
        {
          type: 'form',
          id: 'profile-form',
          visibility: createVisibilityRule({
            reference: 'queries.searchUsers',
            operator: 'isTruthy',
          }),
          children: [
            {
              type: 'input',
              visibility: createVisibilityRule({
                reference: 'forms.profile.role',
                operator: 'equals',
                value: 'admin',
              }),
              props: {
                fieldId: 'name',
                label: 'Name',
              },
            },
            {
              type: 'textarea',
              visibility: createVisibilityRule({
                reference: 'forms.profile.bio',
                operator: 'isFalsy',
              }),
              props: {
                fieldId: 'bio',
                label: 'Bio',
              },
            },
            {
              type: 'select',
              visibility: createVisibilityRule({
                reference: 'queries.searchUsers.data',
                operator: 'isTruthy',
              }),
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
              type: 'button',
              visibility: createVisibilityRule({
                reference: 'queries.searchUsers.data.results',
                operator: 'lessThan',
                value: 5,
              }),
              props: {
                label: 'Submit',
              },
            },
          ],
        },
      ])
    })

    it('rejects visibility operators outside the supported catalog', () => {
      expect(
        validateRuntimeConfig(
          createConfigWithLayout([
            {
              type: 'heading',
              visibility: createVisibilityRule({
                operator: 'contains',
              }),
              props: {
                text: 'Welcome',
                level: 1,
              },
            },
          ]),
        ),
      ).toEqual({
        status: 'error',
        error: {
          code: 'invalid-layout',
          displayMode: 'development-only',
          message: `Page "home" has an invalid layout at "layout[0].visibility.operator".
  → heading("Welcome")
  Node: {"type":"heading","props":{"text":"Welcome"}}`,
        },
      })
    })

    it('rejects visibility references outside the supported forms and queries scope', () => {
      for (const reference of [
        'navigation.currentPageId',
        'routeParams.userId',
        '{{forms.profile.role}}',
        'queries.searchUsers.status.code',
        'queries.searchUsers.error.token',
        'queries.searchUsers.error.message.foo',
        'queries.searchUsers.error.code.bar',
      ]) {
        expect(
          validateRuntimeConfig(
            createConfigWithLayout([
              {
                type: 'heading',
                visibility: createVisibilityRule({
                  reference,
                }),
                props: {
                  text: 'Welcome',
                  level: 1,
                },
              },
            ]),
          ),
        ).toEqual({
          status: 'error',
          error: {
            code: 'invalid-layout',
            displayMode: 'development-only',
            message: expect.stringContaining('error.message'),
          },
        })
      }
    })

    it('accepts error.message and error.code as valid visibility references', () => {
      const resultMessage = validateRuntimeConfig(
        createConfigWithLayout([
          {
            type: 'heading',
            visibility: createVisibilityRule({
              reference: 'queries.searchUsers.error.message',
              operator: 'isTruthy',
            }),
            props: {
              text: 'Welcome',
              level: 1,
            },
          },
        ]),
      )
      expect(resultMessage.status).toBe('ready')

      const resultCode = validateRuntimeConfig(
        createConfigWithLayout([
          {
            type: 'heading',
            visibility: {
              reference: 'queries.searchUsers.error.code',
              operator: 'equals',
              value: 'UNAUTHORIZED',
            },
            props: {
              text: 'Welcome',
              level: 1,
            },
          },
        ]),
      )
      expect(resultCode.status).toBe('ready')
    })

    it('keeps error root and data references accepted as before (regression)', () => {
      const resultError = validateRuntimeConfig(
        createConfigWithLayout([
          {
            type: 'heading',
            visibility: createVisibilityRule({
              reference: 'queries.searchUsers.error',
              operator: 'isFalsy',
            }),
            props: {
              text: 'Welcome',
              level: 1,
            },
          },
        ]),
      )
      expect(resultError.status).toBe('ready')

      const resultStatus = validateRuntimeConfig(
        createConfigWithLayout([
          {
            type: 'heading',
            visibility: createVisibilityRule({
              reference: 'queries.searchUsers.status',
              operator: 'isTruthy',
            }),
            props: {
              text: 'Welcome',
              level: 1,
            },
          },
        ]),
      )
      expect(resultStatus.status).toBe('ready')

      const resultData = validateRuntimeConfig(
        createConfigWithLayout([
          {
            type: 'heading',
            visibility: createVisibilityRule({
              reference: 'queries.searchUsers.data.foo',
              operator: 'isTruthy',
            }),
            props: {
              text: 'Welcome',
              level: 1,
            },
          },
        ]),
      )
      expect(resultData.status).toBe('ready')
    })

    it('requires value only for comparison operators and rejects it for truthy operators', () => {
      expect(
        validateRuntimeConfig(
          createConfigWithLayout([
            {
              type: 'heading',
              visibility: createVisibilityRule({
                operator: 'isTruthy',
                value: true,
              }),
              props: {
                text: 'Welcome',
                level: 1,
              },
            },
          ]),
        ),
      ).toEqual({
        status: 'error',
        error: {
          code: 'invalid-layout',
          displayMode: 'development-only',
          message: `Page "home" has an invalid layout at "layout[0].visibility.value": operator "isTruthy" does not accept value.
  → heading("Welcome")
  Node: {"type":"heading","props":{"text":"Welcome"}}`,
        },
      })

      expect(
        validateRuntimeConfig(
          createConfigWithLayout([
            {
              type: 'heading',
              visibility: {
                reference: 'forms.profile.role',
                operator: 'lessThan',
              },
              props: {
                text: 'Welcome',
                level: 1,
              },
            },
          ]),
        ),
      ).toEqual({
        status: 'error',
        error: {
          code: 'invalid-layout',
          displayMode: 'development-only',
          message: `Page "home" has an invalid layout at "layout[0].visibility.value": operator "lessThan" requires value.
  → heading("Welcome")
  Node: {"type":"heading","props":{"text":"Welcome"}}`,
        },
      })
    })

    it('keeps strings that look like runtime references as literal visibility values', () => {
      const result = validateRuntimeConfig(
        createConfigWithLayout([
          {
            type: 'heading',
            visibility: {
              reference: 'queries.searchUsers.status',
              operator: 'equals',
              value: 'forms.profile.role',
            },
            props: {
              text: 'Welcome',
              level: 1,
            },
          },
        ]),
      )

      expect(result.status).toBe('ready')

      if (result.status !== 'ready') {
        throw new Error('Expected ready result')
      }

      expect(result.config.pages[0].layout[0]).toEqual({
        type: 'heading',
        visibility: {
          reference: 'queries.searchUsers.status',
          operator: 'equals',
          value: 'forms.profile.role',
        },
        props: {
          text: 'Welcome',
          level: 1,
        },
      })
    })

    it('restricts visibility comparison values to scalar literals and numeric thresholds', () => {
      expect(
        validateRuntimeConfig(
          createConfigWithLayout([
            {
              type: 'heading',
              visibility: createVisibilityRule({
                value: {
                  role: 'admin',
                },
              }),
              props: {
                text: 'Welcome',
                level: 1,
              },
            },
          ]),
        ),
      ).toEqual({
        status: 'error',
        error: {
          code: 'invalid-layout',
          displayMode: 'development-only',
          message: `Page "home" has an invalid layout at "layout[0].visibility.value": operator "equals" only accepts string, number, boolean or null.
  → heading("Welcome")
  Node: {"type":"heading","props":{"text":"Welcome"}}`,
        },
      })

      expect(
        validateRuntimeConfig(
          createConfigWithLayout([
            {
              type: 'heading',
              visibility: createVisibilityRule({
                operator: 'notEquals',
                value: ['admin'],
              }),
              props: {
                text: 'Welcome',
                level: 1,
              },
            },
          ]),
        ),
      ).toEqual({
        status: 'error',
        error: {
          code: 'invalid-layout',
          displayMode: 'development-only',
          message: `Page "home" has an invalid layout at "layout[0].visibility.value": operator "notEquals" only accepts string, number, boolean or null.
  → heading("Welcome")
  Node: {"type":"heading","props":{"text":"Welcome"}}`,
        },
      })

      expect(
        validateRuntimeConfig(
          createConfigWithLayout([
            {
              type: 'heading',
              visibility: createVisibilityRule({
                operator: 'greaterThan',
                value: '10',
              }),
              props: {
                text: 'Welcome',
                level: 1,
              },
            },
          ]),
        ),
      ).toEqual({
        status: 'error',
        error: {
          code: 'invalid-layout',
          displayMode: 'development-only',
          message: `Page "home" has an invalid layout at "layout[0].visibility.value": operator "greaterThan" only accepts numeric thresholds.
  → heading("Welcome")
  Node: {"type":"heading","props":{"text":"Welcome"}}`,
        },
      })
    })

    it('accepts arrayContains with itemField and a string value', () => {
      const result = validateRuntimeConfig(
        createConfigWithLayout([
          {
            type: 'heading',
            visibility: {
              reference: 'queries.x.data.permissions',
              operator: 'arrayContains',
              itemField: 'code',
              value: '3-1',
            },
            props: { text: 'Welcome', level: 1 },
          },
        ]),
      )
      expect(result.status).toBe('ready')
    })

    it('accepts arrayContains without itemField', () => {
      const result = validateRuntimeConfig(
        createConfigWithLayout([
          {
            type: 'heading',
            visibility: {
              reference: 'queries.x.data.tags',
              operator: 'arrayContains',
              value: 'b',
            },
            props: { text: 'Welcome', level: 1 },
          },
        ]),
      )
      expect(result.status).toBe('ready')
    })

    it('accepts arrayContains with null, numeric and boolean scalar values', () => {
      for (const value of [null, 3, true]) {
        const result = validateRuntimeConfig(
          createConfigWithLayout([
            {
              type: 'heading',
              visibility: {
                reference: 'queries.x.data.tags',
                operator: 'arrayContains',
                value,
              },
              props: { text: 'Welcome', level: 1 },
            },
          ]),
        )
        expect(result.status).toBe('ready')
      }
    })

    it('accepts arrayContains with negate: true', () => {
      const result = validateRuntimeConfig(
        createConfigWithLayout([
          {
            type: 'heading',
            visibility: {
              reference: 'queries.x.data.tags',
              operator: 'arrayContains',
              value: 'b',
              negate: true,
            },
            props: { text: 'Welcome', level: 1 },
          },
        ]),
      )
      expect(result.status).toBe('ready')
    })

    it('rejects arrayContains without value at visibility.value', () => {
      expect(
        validateRuntimeConfig(
          createConfigWithLayout([
            {
              type: 'heading',
              visibility: {
                reference: 'queries.x.data.tags',
                operator: 'arrayContains',
              },
              props: {
                text: 'Welcome',
                level: 1,
              },
            },
          ]),
        ),
      ).toEqual({
        status: 'error',
        error: {
          code: 'invalid-layout',
          displayMode: 'development-only',
          message: `Page "home" has an invalid layout at "layout[0].visibility.value": operator "arrayContains" requires value.
  → heading("Welcome")
  Node: {"type":"heading","props":{"text":"Welcome"}}`,
        },
      })
    })

    it('rejects arrayContains with a non-scalar value (object or array) at visibility.value', () => {
      for (const value of [{ role: 'admin' }, ['admin']]) {
        expect(
          validateRuntimeConfig(
            createConfigWithLayout([
              {
                type: 'heading',
                visibility: {
                  reference: 'queries.x.data.tags',
                  operator: 'arrayContains',
                  value,
                },
                props: {
                  text: 'Welcome',
                  level: 1,
                },
              },
            ]),
          ),
        ).toEqual({
          status: 'error',
          error: {
            code: 'invalid-layout',
            displayMode: 'development-only',
            message: `Page "home" has an invalid layout at "layout[0].visibility.value": operator "arrayContains" only accepts string, number, boolean or null.
  → heading("Welcome")
  Node: {"type":"heading","props":{"text":"Welcome"}}`,
          },
        })
      }
    })

    it('rejects arrayContains with a non-string itemField at visibility.itemField', () => {
      // node visibility is validated through the zod schema (itemField: z.string().optional()) before the
      // manual validator runs, so a type mismatch surfaces as the generic path-only invalid-layout message.
      for (const itemField of [123, true, null, { code: 1 }, ['code']]) {
        const result = validateRuntimeConfig(
          createConfigWithLayout([
            {
              type: 'heading',
              visibility: {
                reference: 'queries.x.data.permissions',
                operator: 'arrayContains',
                value: '3-1',
                itemField,
              },
              props: {
                text: 'Welcome',
                level: 1,
              },
            },
          ]),
        )
        expect(result.status).toBe('error')
        if (result.status !== 'error') throw new Error('Expected error')
        expect(result.error.message).toContain('layout[0].visibility.itemField')
      }
    })

    it('rejects arrayContains with a non-string itemField in pages[].preloads[*].when with the exact message', () => {
      // preloads[].when bypasses zod's whenConditionSchema (preloads entries are typed as z.unknown()), so this
      // is the context that actually exercises the manual "itemField must be a string." message.
      for (const itemField of [123, true, null, { code: 1 }, ['code']]) {
        const result = validateRuntimeConfig({
          api: {},
          pages: [
            {
              id: 'home',
              layout: [],
              preloads: [
                {
                  loadUser: {},
                  when: {
                    reference: 'params.mode',
                    operator: 'arrayContains',
                    value: 'admin',
                    itemField,
                  },
                },
              ],
            },
          ],
          initialPage: 'home',
        })
        expect(result.status).toBe('error')
        if (result.status !== 'error') throw new Error('Expected error')
        expect(result.error.message).toContain('pages[0].preloads[0].when.itemField')
        expect(result.error.message).toContain('itemField must be a string.')
      }
    })

    it('rejects itemField present when operator is not arrayContains at visibility.itemField', () => {
      const nonArrayContainsConditions: Array<Record<string, unknown>> = [
        { reference: 'forms.profile.role', operator: 'equals', value: 'admin', itemField: 'code' },
        { reference: 'forms.profile.role', operator: 'notEquals', value: 'admin', itemField: 'code' },
        { reference: 'forms.profile.role', operator: 'isTruthy', itemField: 'code' },
        { reference: 'forms.profile.role', operator: 'isFalsy', itemField: 'code' },
        { reference: 'queries.q.data.count', operator: 'greaterThan', value: 1, itemField: 'code' },
        { reference: 'queries.q.data.count', operator: 'lessThan', value: 1, itemField: 'code' },
      ]

      for (const visibility of nonArrayContainsConditions) {
        const result = validateRuntimeConfig(
          createConfigWithLayout([
            {
              type: 'heading',
              visibility,
              props: { text: 'Welcome', level: 1 },
            },
          ]),
        )
        expect(result.status).toBe('error')
        if (result.status !== 'error') throw new Error('Expected error')
        expect(result.error.message).toContain(
          'layout[0].visibility.itemField": itemField is only valid when operator is "arrayContains".',
        )
      }
    })

    it('rejects arrayContains with non-boolean negate at visibility.negate (regression, no new casuistry)', () => {
      const result = validateRuntimeConfig(
        createConfigWithLayout([
          {
            type: 'heading',
            visibility: {
              reference: 'queries.x.data.tags',
              operator: 'arrayContains',
              value: 'b',
              negate: 'yes',
            },
            props: { text: 'Welcome', level: 1 },
          },
        ]),
      )
      expect(result.status).toBe('error')
      if (result.status !== 'error') throw new Error('Expected error')
      expect(result.error.message).toContain('layout[0].visibility.negate')
    })

    // T3 (updated): params.{paramName} is now a valid visibility reference
    it('accepts params.{paramName} as a valid visibility reference with isTruthy operator', () => {
      const result = validateRuntimeConfig(
        createConfigWithLayout([
          {
            type: 'heading',
            visibility: createVisibilityRule({
              reference: 'params.userId',
              operator: 'isTruthy',
            }),
            props: {
              text: 'Welcome',
              level: 1,
            },
          },
        ]),
      )
      expect(result.status).toBe('ready')
    })

    it('accepts params.{paramName} with equals operator and string value', () => {
      const result = validateRuntimeConfig(
        createConfigWithLayout([
          {
            type: 'heading',
            visibility: {
              reference: 'params.mode',
              operator: 'equals',
              value: 'edit',
            },
            props: {
              text: 'Welcome',
              level: 1,
            },
          },
        ]),
      )
      expect(result.status).toBe('ready')

      if (result.status !== 'ready') {
        throw new Error('Expected ready result')
      }

      expect(result.config.pages[0].layout[0]).toEqual({
        type: 'heading',
        visibility: {
          reference: 'params.mode',
          operator: 'equals',
          value: 'edit',
        },
        props: {
          text: 'Welcome',
          level: 1,
        },
      })
    })

    it('accepts params.{paramName} with notEquals operator and string value', () => {
      const result = validateRuntimeConfig(
        createConfigWithLayout([
          {
            type: 'heading',
            visibility: {
              reference: 'params.mode',
              operator: 'notEquals',
              value: 'readonly',
            },
            props: {
              text: 'Welcome',
              level: 1,
            },
          },
        ]),
      )
      expect(result.status).toBe('ready')
    })

    it('accepts params.{paramName} with greaterThan operator and numeric threshold', () => {
      const result = validateRuntimeConfig(
        createConfigWithLayout([
          {
            type: 'heading',
            visibility: {
              reference: 'params.page',
              operator: 'greaterThan',
              value: 2,
            },
            props: {
              text: 'Welcome',
              level: 1,
            },
          },
        ]),
      )
      expect(result.status).toBe('ready')
    })

    it('rejects params (without segment) as a visibility reference', () => {
      expect(
        validateRuntimeConfig(
          createConfigWithLayout([
            {
              type: 'heading',
              visibility: createVisibilityRule({
                reference: 'params',
                operator: 'isTruthy',
              }),
              props: {
                text: 'Welcome',
                level: 1,
              },
            },
          ]),
        ),
      ).toEqual({
        status: 'error',
        error: {
          code: 'invalid-layout',
          displayMode: 'development-only',
          message: expect.stringContaining('layout[0].visibility.reference'),
        },
      })
    })

    it('rejects params.user.id (more than one dynamic segment) as a visibility reference', () => {
      expect(
        validateRuntimeConfig(
          createConfigWithLayout([
            {
              type: 'heading',
              visibility: createVisibilityRule({
                reference: 'params.user.id',
                operator: 'isTruthy',
              }),
              props: {
                text: 'Welcome',
                level: 1,
              },
            },
          ]),
        ),
      ).toEqual({
        status: 'error',
        error: {
          code: 'invalid-layout',
          displayMode: 'development-only',
          message: expect.stringContaining('layout[0].visibility.reference'),
        },
      })
    })

    it('rejects params.userId when operator is outside the supported catalog', () => {
      expect(
        validateRuntimeConfig(
          createConfigWithLayout([
            {
              type: 'heading',
              visibility: {
                reference: 'params.userId',
                operator: 'contains',
                value: 'abc',
              },
              props: {
                text: 'Welcome',
                level: 1,
              },
            },
          ]),
        ),
      ).toEqual({
        status: 'error',
        error: {
          code: 'invalid-layout',
          displayMode: 'development-only',
          message: expect.stringContaining('layout[0].visibility.operator'),
        },
      })
    })

    it('drops unsupported extra keys from visibility blocks without changing valid configs', () => {
      const result = validateRuntimeConfig(
        createConfigWithLayout([
          {
            type: 'heading',
            visibility: {
              reference: 'forms.profile.role',
              operator: 'equals',
              value: 'admin',
              ignored: true,
            },
            props: {
              text: 'Welcome',
              level: 1,
            },
          },
        ]),
      )

      expect(result.status).toBe('ready')

      if (result.status !== 'ready') {
        throw new Error('Expected ready result')
      }

      expect(result.config.pages[0].layout[0]).toEqual({
        type: 'heading',
        visibility: {
          reference: 'forms.profile.role',
          operator: 'equals',
          value: 'admin',
        },
        props: {
          text: 'Welcome',
          level: 1,
        },
      })
    })
  })

  describe('tokens.* gating in visibility and when', () => {
    it('rejects tokens.* in visibility.reference with exact message', () => {
      const result = validateRuntimeConfig(
        createConfigWithLayout([
          {
            type: 'heading',
            props: { text: 'Hello', level: 1 },
            visibility: { reference: 'tokens.session.value', operator: 'isTruthy' },
          },
        ]),
      )
      expect(result.status).toBe('error')
      if (result.status === 'error') {
        expect(result.error.message).toBe(
          `Page "home" has an invalid layout at "layout[0].visibility.reference": tokens.* references are not supported in visibility or when conditions.\n  → heading("Hello")\n  Node: {"type":"heading","props":{"text":"Hello"}}`,
        )
      }
    })

    it('rejects tokens.* in when.reference within preloads', () => {
      const result = validateRuntimeConfig({
        api: {},
        pages: [
          {
            id: 'home',
            layout: [],
            preloads: [
              {
                loadUser: {},
                when: { reference: 'tokens.session.value', operator: 'isTruthy' },
              },
            ],
          },
        ],
        initialPage: 'home',
      })
      expect(result.status).toBe('error')
      if (result.status === 'error') {
        expect(result.error.message).toContain('tokens.* references are not supported')
      }
    })
  })

  describe('visibility shape — composed groups', () => {
    it('accepts a group with operator "and" and a single simple condition', () => {
      const result = whenConditionSchema.safeParse({
        operator: 'and',
        conditions: [{ reference: 'params.mode', operator: 'isTruthy' }],
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual({
          operator: 'and',
          conditions: [{ reference: 'params.mode', operator: 'isTruthy' }],
        })
      }
    })

    it('accepts a group with operator "or" and two simple conditions', () => {
      const result = whenConditionSchema.safeParse({
        operator: 'or',
        conditions: [
          { reference: 'params.mode', operator: 'equals', value: 'edit' },
          { reference: 'forms.profile.role', operator: 'isTruthy' },
        ],
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual({
          operator: 'or',
          conditions: [
            { reference: 'params.mode', operator: 'equals', value: 'edit' },
            { reference: 'forms.profile.role', operator: 'isTruthy' },
          ],
        })
      }
    })

    it('accepts a group with an arrayContains condition alongside another simple condition', () => {
      const result = whenConditionSchema.safeParse({
        operator: 'and',
        conditions: [
          { reference: 'queries.x.data.tags', operator: 'arrayContains', itemField: 'code', value: '3-1' },
          { reference: 'params.mode', operator: 'isTruthy' },
        ],
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual({
          operator: 'and',
          conditions: [
            { reference: 'queries.x.data.tags', operator: 'arrayContains', itemField: 'code', value: '3-1' },
            { reference: 'params.mode', operator: 'isTruthy' },
          ],
        })
      }
    })

    it('accepts a simple condition with negate: true and preserves it after parsing', () => {
      const result = whenConditionSchema.safeParse({
        reference: 'params.mode',
        operator: 'isTruthy',
        negate: true,
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual({
          reference: 'params.mode',
          operator: 'isTruthy',
          negate: true,
        })
      }
    })

    it('accepts a simple condition with negate: false and preserves it after parsing', () => {
      const result = whenConditionSchema.safeParse({
        reference: 'params.mode',
        operator: 'isTruthy',
        negate: false,
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual({
          reference: 'params.mode',
          operator: 'isTruthy',
          negate: false,
        })
      }
    })

    it('rejects a simple condition with non-boolean negate (string) at visibility.negate', () => {
      const result = validateRuntimeConfig(
        createConfigWithLayout([
          {
            type: 'heading',
            visibility: { reference: 'params.mode', operator: 'isTruthy', negate: 'yes' },
            props: { text: 'Welcome', level: 1 },
          },
        ]),
      )
      expect(result.status).toBe('error')
      if (result.status === 'error') {
        expect(result.error.message).toContain('layout[0].visibility.negate')
      }
    })

    it('rejects a simple condition with non-boolean negate (number) at visibility.negate', () => {
      const result = validateRuntimeConfig(
        createConfigWithLayout([
          {
            type: 'heading',
            visibility: { reference: 'params.mode', operator: 'isTruthy', negate: 1 },
            props: { text: 'Welcome', level: 1 },
          },
        ]),
      )
      expect(result.status).toBe('error')
      if (result.status === 'error') {
        expect(result.error.message).toContain('layout[0].visibility.negate')
      }
    })

    it('rejects a group with an empty conditions array at visibility.conditions', () => {
      const result = validateRuntimeConfig(
        createConfigWithLayout([
          {
            type: 'heading',
            visibility: { operator: 'and', conditions: [] },
            props: { text: 'Welcome', level: 1 },
          },
        ]),
      )
      expect(result.status).toBe('error')
      if (result.status === 'error') {
        expect(result.error.message).toContain('layout[0].visibility.conditions')
      }
    })

    it('rejects a group with operator outside and|or and outside the simple catalog at visibility.operator', () => {
      const result = validateRuntimeConfig(
        createConfigWithLayout([
          {
            type: 'heading',
            visibility: {
              operator: 'xyz',
              conditions: [{ reference: 'params.mode', operator: 'isTruthy' }],
            },
            props: { text: 'Welcome', level: 1 },
          },
        ]),
      )
      expect(result.status).toBe('error')
      if (result.status === 'error') {
        expect(result.error.message).toContain('layout[0].visibility.operator')
      }
    })

    it('rejects a group without operator at visibility.operator', () => {
      const result = validateRuntimeConfig(
        createConfigWithLayout([
          {
            type: 'heading',
            visibility: {
              conditions: [{ reference: 'params.mode', operator: 'isTruthy' }],
            },
            props: { text: 'Welcome', level: 1 },
          },
        ]),
      )
      expect(result.status).toBe('error')
      if (result.status === 'error') {
        expect(result.error.message).toContain('layout[0].visibility.operator')
      }
    })

    it('rejects a nested group inside conditions at visibility.conditions[0]', () => {
      const result = validateRuntimeConfig(
        createConfigWithLayout([
          {
            type: 'heading',
            visibility: {
              operator: 'and',
              conditions: [
                {
                  operator: 'or',
                  conditions: [{ reference: 'params.mode', operator: 'isTruthy' }],
                },
              ],
            },
            props: { text: 'Welcome', level: 1 },
          },
        ]),
      )
      expect(result.status).toBe('error')
      if (result.status === 'error') {
        expect(result.error.message).toContain('layout[0].visibility.conditions[0]')
      }
    })

    it('rejects a condition inside conditions with operator outside the simple catalog at visibility.conditions[0].operator', () => {
      const result = validateRuntimeConfig(
        createConfigWithLayout([
          {
            type: 'heading',
            visibility: {
              operator: 'and',
              conditions: [{ reference: 'params.mode', operator: 'contains', value: 'x' }],
            },
            props: { text: 'Welcome', level: 1 },
          },
        ]),
      )
      expect(result.status).toBe('error')
      if (result.status === 'error') {
        expect(result.error.message).toContain('layout[0].visibility.conditions[0].operator')
      }
    })

    it('rejects a condition inside conditions with missing reference at visibility.conditions[0].reference', () => {
      const result = validateRuntimeConfig(
        createConfigWithLayout([
          {
            type: 'heading',
            visibility: {
              operator: 'and',
              conditions: [{ operator: 'isTruthy' }],
            },
            props: { text: 'Welcome', level: 1 },
          },
        ]),
      )
      expect(result.status).toBe('error')
      if (result.status === 'error') {
        expect(result.error.message).toContain('layout[0].visibility.conditions[0].reference')
      }
    })

    it('rejects a condition inside conditions with empty reference at visibility.conditions[0].reference', () => {
      const result = validateRuntimeConfig(
        createConfigWithLayout([
          {
            type: 'heading',
            visibility: {
              operator: 'and',
              conditions: [{ reference: '', operator: 'isTruthy' }],
            },
            props: { text: 'Welcome', level: 1 },
          },
        ]),
      )
      expect(result.status).toBe('error')
      if (result.status === 'error') {
        expect(result.error.message).toContain('layout[0].visibility.conditions[0].reference')
      }
    })

    it('rejects a condition inside conditions with non-boolean negate at visibility.conditions[0].negate', () => {
      const result = validateRuntimeConfig(
        createConfigWithLayout([
          {
            type: 'heading',
            visibility: {
              operator: 'and',
              conditions: [
                { reference: 'params.mode', operator: 'isTruthy', negate: 'yes' },
              ],
            },
            props: { text: 'Welcome', level: 1 },
          },
        ]),
      )
      expect(result.status).toBe('error')
      if (result.status === 'error') {
        expect(result.error.message).toContain('layout[0].visibility.conditions[0].negate')
      }
    })

    it('keeps a plain simple condition without negate or conditions accepted (retrocompat)', () => {
      const result = whenConditionSchema.safeParse({
        reference: 'forms.profile.role',
        operator: 'equals',
        value: 'admin',
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual({
          reference: 'forms.profile.role',
          operator: 'equals',
          value: 'admin',
        })
      }
    })
  })

  // T-3: semantic validation of composed groups in node.visibility
  describe('visibility semantics — composed groups', () => {
    it('rejects a group with an internal condition whose reference is unsupported (foo.bar) with path visibility.conditions[0].reference', () => {
      const result = validateRuntimeConfig(
        createConfigWithLayout([
          {
            type: 'heading',
            visibility: {
              operator: 'and',
              conditions: [{ reference: 'foo.bar', operator: 'isTruthy' }],
            },
            props: { text: 'Welcome', level: 1 },
          },
        ]),
      )
      expect(result.status).toBe('error')
      if (result.status !== 'error') throw new Error('Expected error')
      expect(result.error.message).toContain('layout[0].visibility.conditions[0].reference')
    })

    it('rejects a group with an internal condition whose reference is bare "params" with path visibility.conditions[0].reference', () => {
      const result = validateRuntimeConfig(
        createConfigWithLayout([
          {
            type: 'heading',
            visibility: {
              operator: 'and',
              conditions: [{ reference: 'params', operator: 'isTruthy' }],
            },
            props: { text: 'Welcome', level: 1 },
          },
        ]),
      )
      expect(result.status).toBe('error')
      if (result.status !== 'error') throw new Error('Expected error')
      expect(result.error.message).toContain('layout[0].visibility.conditions[0].reference')
    })

    it('rejects a group with an internal condition whose reference is params.user.id with path visibility.conditions[0].reference', () => {
      const result = validateRuntimeConfig(
        createConfigWithLayout([
          {
            type: 'heading',
            visibility: {
              operator: 'or',
              conditions: [{ reference: 'params.user.id', operator: 'isTruthy' }],
            },
            props: { text: 'Welcome', level: 1 },
          },
        ]),
      )
      expect(result.status).toBe('error')
      if (result.status !== 'error') throw new Error('Expected error')
      expect(result.error.message).toContain('layout[0].visibility.conditions[0].reference')
    })

    it('rejects a group with an internal equals condition missing value at visibility.conditions[0].value', () => {
      const result = validateRuntimeConfig(
        createConfigWithLayout([
          {
            type: 'heading',
            visibility: {
              operator: 'and',
              conditions: [{ reference: 'params.mode', operator: 'equals' }],
            },
            props: { text: 'Welcome', level: 1 },
          },
        ]),
      )
      expect(result.status).toBe('error')
      if (result.status !== 'error') throw new Error('Expected error')
      expect(result.error.message).toContain('layout[0].visibility.conditions[0].value')
    })

    it('rejects a group with an internal equals condition whose value is a non-scalar object at visibility.conditions[0].value', () => {
      const result = validateRuntimeConfig(
        createConfigWithLayout([
          {
            type: 'heading',
            visibility: {
              operator: 'and',
              conditions: [{ reference: 'params.mode', operator: 'equals', value: { role: 'admin' } }],
            },
            props: { text: 'Welcome', level: 1 },
          },
        ]),
      )
      expect(result.status).toBe('error')
      if (result.status !== 'error') throw new Error('Expected error')
      expect(result.error.message).toContain('layout[0].visibility.conditions[0].value')
    })

    it('rejects a group with an internal equals condition whose value is an array at visibility.conditions[0].value', () => {
      const result = validateRuntimeConfig(
        createConfigWithLayout([
          {
            type: 'heading',
            visibility: {
              operator: 'and',
              conditions: [{ reference: 'params.mode', operator: 'equals', value: ['admin'] }],
            },
            props: { text: 'Welcome', level: 1 },
          },
        ]),
      )
      expect(result.status).toBe('error')
      if (result.status !== 'error') throw new Error('Expected error')
      expect(result.error.message).toContain('layout[0].visibility.conditions[0].value')
    })

    it('rejects a group with an internal greaterThan condition whose value is non-numeric at visibility.conditions[0].value', () => {
      const result = validateRuntimeConfig(
        createConfigWithLayout([
          {
            type: 'heading',
            visibility: {
              operator: 'and',
              conditions: [{ reference: 'queries.q.data.count', operator: 'greaterThan', value: '10' }],
            },
            props: { text: 'Welcome', level: 1 },
          },
        ]),
      )
      expect(result.status).toBe('error')
      if (result.status !== 'error') throw new Error('Expected error')
      expect(result.error.message).toContain('layout[0].visibility.conditions[0].value')
    })

    it('rejects a group with an internal isTruthy condition that declares a value at visibility.conditions[0].value', () => {
      const result = validateRuntimeConfig(
        createConfigWithLayout([
          {
            type: 'heading',
            visibility: {
              operator: 'and',
              conditions: [{ reference: 'params.mode', operator: 'isTruthy', value: true }],
            },
            props: { text: 'Welcome', level: 1 },
          },
        ]),
      )
      expect(result.status).toBe('error')
      if (result.status !== 'error') throw new Error('Expected error')
      expect(result.error.message).toContain('layout[0].visibility.conditions[0].value')
    })

    it('rejects a group with an internal condition whose reference is tokens.* at visibility.conditions[0].reference', () => {
      const result = validateRuntimeConfig(
        createConfigWithLayout([
          {
            type: 'heading',
            visibility: {
              operator: 'and',
              conditions: [{ reference: 'tokens.session.value', operator: 'isTruthy' }],
            },
            props: { text: 'Welcome', level: 1 },
          },
        ]),
      )
      expect(result.status).toBe('error')
      if (result.status !== 'error') throw new Error('Expected error')
      expect(result.error.message).toContain('layout[0].visibility.conditions[0].reference')
      expect(result.error.message).toContain('tokens.* references are not supported')
    })

    it('accepts a group with two simple conditions using distinct families (params.* + queries.*.data.*)', () => {
      const result = validateRuntimeConfig(
        createConfigWithLayout([
          {
            type: 'heading',
            visibility: {
              operator: 'and',
              conditions: [
                { reference: 'params.mode', operator: 'equals', value: 'edit' },
                { reference: 'queries.searchUsers.data.count', operator: 'greaterThan', value: 0 },
              ],
            },
            props: { text: 'Welcome', level: 1 },
          },
        ]),
      )
      expect(result.status).toBe('ready')
    })
  })

  describe('arrayContains — reused across the four visibility/when contexts', () => {
    it('accepts arrayContains in submitAction.onSuccess[*].when', () => {
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
                        reference: 'queries.submitUserForm.data.tags',
                        operator: 'arrayContains',
                        itemField: 'code',
                        value: '3-1',
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

    it('accepts arrayContains in pages[].preloads[*].when', () => {
      const result = validateRuntimeConfig({
        api: {},
        pages: [
          {
            id: 'home',
            layout: [],
            preloads: [
              {
                loadUser: {},
                when: {
                  reference: 'params.mode',
                  operator: 'arrayContains',
                  value: 'admin',
                },
              },
            ],
          },
        ],
        initialPage: 'home',
      })
      expect(result.status).toBe('ready')
    })

    it('accepts arrayContains in button.props.action.operations[*].when (executeOperations)', () => {
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
                          reference: 'queries.op1.data.tags',
                          operator: 'arrayContains',
                          itemField: 'code',
                          value: '3-1',
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
  })

  describe('row.* references in visibility shape', () => {
    // These cases validate shape only (isValidVisibilityReference), not scope: the node is not
    // inside a `table` cell here. T2 introduces the "row.* only inside a table cell" restriction
    // (see 'row.* visibility scope' below); shape-invalid cases stay rejected here regardless of scope.
    it('rejects row.$index.algo (extra segment after the synthetic $index) at visibility.reference', () => {
      const result = validateRuntimeConfig(
        createConfigWithLayout([
          {
            type: 'heading',
            visibility: {
              reference: 'row.$index.algo',
              operator: 'isTruthy',
            },
            props: { text: 'Welcome', level: 1 },
          },
        ]),
      )
      expect(result.status).toBe('error')
      if (result.status !== 'error') throw new Error('Expected error')
      expect(result.error.message).toContain('layout[0].visibility.reference')
    })

    it('rejects row.algo.$index ($index not in the exact synthetic position) at visibility.reference', () => {
      const result = validateRuntimeConfig(
        createConfigWithLayout([
          {
            type: 'heading',
            visibility: {
              reference: 'row.algo.$index',
              operator: 'isTruthy',
            },
            props: { text: 'Welcome', level: 1 },
          },
        ]),
      )
      expect(result.status).toBe('error')
      if (result.status !== 'error') throw new Error('Expected error')
      expect(result.error.message).toContain('layout[0].visibility.reference')
    })

    it('rejects row.$key (no such synthetic segment for row) at visibility.reference', () => {
      const result = validateRuntimeConfig(
        createConfigWithLayout([
          {
            type: 'heading',
            visibility: {
              reference: 'row.$key',
              operator: 'isTruthy',
            },
            props: { text: 'Welcome', level: 1 },
          },
        ]),
      )
      expect(result.status).toBe('error')
      if (result.status !== 'error') throw new Error('Expected error')
      expect(result.error.message).toContain('layout[0].visibility.reference')
    })

    it('rejects row.$other (unrecognized synthetic segment) at visibility.reference', () => {
      const result = validateRuntimeConfig(
        createConfigWithLayout([
          {
            type: 'heading',
            visibility: {
              reference: 'row.$other',
              operator: 'isTruthy',
            },
            props: { text: 'Welcome', level: 1 },
          },
        ]),
      )
      expect(result.status).toBe('error')
      if (result.status !== 'error') throw new Error('Expected error')
      expect(result.error.message).toContain('layout[0].visibility.reference')
    })

    it('rejects a composed group whose single condition is row.$key.* (invalid shape) with the exact conditions path', () => {
      const result = validateRuntimeConfig(
        createConfigWithLayout([
          {
            type: 'heading',
            visibility: {
              operator: 'and',
              conditions: [{ reference: 'row.$key.name', operator: 'isTruthy' }],
            },
            props: { text: 'Welcome', level: 1 },
          },
        ]),
      )
      expect(result.status).toBe('error')
      if (result.status !== 'error') throw new Error('Expected error')
      expect(result.error.message).toContain('layout[0].visibility.conditions[0].reference')
    })
  })

  describe('row.* visibility scope', () => {
    it('rejects a node with visibility row.* outside any table cell subtree with the exact message (moved from T1 shape acceptance)', () => {
      const result = validateRuntimeConfig(
        createConfigWithLayout([
          {
            type: 'container',
            children: [
              {
                type: 'heading',
                visibility: { reference: 'row.status', operator: 'equals', value: 'active' },
                props: { text: 'Welcome', level: 1 },
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
          message: `Page "home" has an invalid layout at "layout[0].children[0].visibility.reference": row.* references are only supported inside a table cell subtree.
  → container[0] > heading("Welcome")
  Node: {"type":"heading","props":{"text":"Welcome"}}`,
        },
      })
    })

    it('rejects bare row (no segments) with isTruthy outside any table cell (moved from T1 shape acceptance)', () => {
      const result = validateRuntimeConfig(
        createConfigWithLayout([
          {
            type: 'heading',
            visibility: { reference: 'row', operator: 'isTruthy' },
            props: { text: 'Welcome', level: 1 },
          },
        ]),
      )
      expect(result.status).toBe('error')
      if (result.status !== 'error') throw new Error('Expected error')
      expect(result.error.message).toContain('layout[0].visibility.reference')
      expect(result.error.message).toContain('row.* references are only supported inside a table cell subtree.')
    })

    it('rejects row with nested segments (row.meta.author.name) outside any table cell (moved from T1 shape acceptance)', () => {
      const result = validateRuntimeConfig(
        createConfigWithLayout([
          {
            type: 'heading',
            visibility: { reference: 'row.meta.author.name', operator: 'equals', value: 'Ada' },
            props: { text: 'Welcome', level: 1 },
          },
        ]),
      )
      expect(result.status).toBe('error')
      if (result.status !== 'error') throw new Error('Expected error')
      expect(result.error.message).toContain('layout[0].visibility.reference')
    })

    it('rejects row with a numeric segment (row.tags.0) outside any table cell (moved from T1 shape acceptance)', () => {
      const result = validateRuntimeConfig(
        createConfigWithLayout([
          {
            type: 'heading',
            visibility: { reference: 'row.tags.0', operator: 'equals', value: 'x' },
            props: { text: 'Welcome', level: 1 },
          },
        ]),
      )
      expect(result.status).toBe('error')
      if (result.status !== 'error') throw new Error('Expected error')
      expect(result.error.message).toContain('layout[0].visibility.reference')
    })

    it('rejects row.$index outside any table cell (moved from T1 shape acceptance)', () => {
      const result = validateRuntimeConfig(
        createConfigWithLayout([
          {
            type: 'heading',
            visibility: { reference: 'row.$index', operator: 'lessThan', value: 4 },
            props: { text: 'Welcome', level: 1 },
          },
        ]),
      )
      expect(result.status).toBe('error')
      if (result.status !== 'error') throw new Error('Expected error')
      expect(result.error.message).toContain('layout[0].visibility.reference')
    })

    it('accepts visibility row.* on a dynamic table cell-node (table.props.rows.cells)', () => {
      const result = validateRuntimeConfig(
        createConfigWithLayout([
          {
            type: 'table',
            props: {
              headers: ['Name', 'Status'],
              rows: {
                source: 'queries.users.data.results',
                cells: [
                  'row.name',
                  {
                    type: 'button',
                    visibility: { reference: 'row.status', operator: 'equals', value: 'active' },
                    props: { label: 'Ver' },
                  },
                ],
              },
            },
          },
        ]),
      )
      expect(result.status).toBe('ready')
    })

    it('accepts visibility row.* on a deeply nested node inside a table cell-node subtree (container > container > button)', () => {
      const result = validateRuntimeConfig(
        createConfigWithLayout([
          {
            type: 'table',
            props: {
              headers: ['Name', 'Actions'],
              rows: {
                source: 'queries.users.data.results',
                cells: [
                  'row.name',
                  {
                    type: 'container',
                    children: [
                      {
                        type: 'container',
                        children: [
                          {
                            type: 'button',
                            visibility: { reference: 'row.status', operator: 'equals', value: 'active' },
                            props: { label: 'Ver' },
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            },
          },
        ]),
      )
      expect(result.status).toBe('ready')
    })

    it('accepts visibility row.$index on a manual table cell-node (table.props.rows[j][i])', () => {
      const result = validateRuntimeConfig(
        createConfigWithLayout([
          {
            type: 'table',
            props: {
              headers: ['Name', 'Actions'],
              rows: [
                [
                  'Ada',
                  {
                    type: 'button',
                    visibility: { reference: 'row.$index', operator: 'lessThan', value: 3 },
                    props: { label: 'Ver' },
                  },
                ],
              ],
            },
          },
        ]),
      )
      expect(result.status).toBe('ready')
    })

    it('does not evaluate visibility on primitive manual table cells, and still rejects a sibling node outside the table with row.*', () => {
      const result = validateRuntimeConfig(
        createConfigWithLayout([
          {
            type: 'table',
            props: {
              headers: ['Name', 'Score'],
              rows: [
                ['Ada', 10],
                ['Grace', 20],
              ],
            },
          },
          {
            type: 'heading',
            visibility: { reference: 'row.status', operator: 'equals', value: 'active' },
            props: { text: 'Welcome', level: 1 },
          },
        ]),
      )
      expect(result.status).toBe('error')
      if (result.status !== 'error') throw new Error('Expected error')
      expect(result.error.message).toContain('layout[1].visibility.reference')
    })

    it('accepts visibility row.* on a table cell-node nested inside a repeater template (insideTableCell survives the repeater)', () => {
      const result = validateRuntimeConfig(
        createConfigWithLayout([
          createRepeaterNode({
            props: {
              items: { source: 'queries.posts.data', key: 'id' },
              template: [
                {
                  type: 'table',
                  props: {
                    headers: ['Name', 'Status'],
                    rows: {
                      source: 'item.users',
                      cells: [
                        'row.name',
                        {
                          type: 'container',
                          visibility: { reference: 'row.status', operator: 'equals', value: 'active' },
                          children: [],
                        },
                      ],
                    },
                  },
                },
              ],
            },
          }),
        ]),
      )
      expect(result.status).toBe('ready')
    })

    it('rejects visibility row.* on a node inside a repeater template but outside any table cell (insideTableCell stays false)', () => {
      const result = validateRuntimeConfig(
        createConfigWithLayout([
          createRepeaterNode({
            props: {
              items: { source: 'queries.posts.data', key: 'id' },
              template: [
                {
                  type: 'heading',
                  visibility: { reference: 'row.status', operator: 'equals', value: 'active' },
                  props: { text: 'Item', level: 2 },
                },
              ],
            },
          }),
        ]),
      )
      expect(result.status).toBe('error')
      if (result.status !== 'error') throw new Error('Expected error')
      expect(result.error.message).toContain('layout[0].props.template[0].visibility.reference')
    })

    it('rejects a composed group with row.* as the first condition outside a table cell, pointing at conditions[0].reference', () => {
      const result = validateRuntimeConfig(
        createConfigWithLayout([
          {
            type: 'heading',
            visibility: {
              operator: 'and',
              conditions: [
                { reference: 'row.status', operator: 'equals', value: 'active' },
                { reference: 'forms.filters.active', operator: 'isTruthy' },
              ],
            },
            props: { text: 'Welcome', level: 1 },
          },
        ]),
      )
      expect(result.status).toBe('error')
      if (result.status !== 'error') throw new Error('Expected error')
      expect(result.error.message).toContain('layout[0].visibility.conditions[0].reference')
      expect(result.error.message).toContain('row.* references are only supported inside a table cell subtree.')
    })

    it('rejects a composed group with row.* as the second condition outside a table cell, pointing at conditions[1].reference', () => {
      const result = validateRuntimeConfig(
        createConfigWithLayout([
          {
            type: 'heading',
            visibility: {
              operator: 'and',
              conditions: [
                { reference: 'forms.filters.active', operator: 'isTruthy' },
                { reference: 'row.status', operator: 'equals', value: 'active' },
              ],
            },
            props: { text: 'Welcome', level: 1 },
          },
        ]),
      )
      expect(result.status).toBe('error')
      if (result.status !== 'error') throw new Error('Expected error')
      expect(result.error.message).toContain('layout[0].visibility.conditions[1].reference')
    })

    it('accepts a composed group inside a table cell-node with two row.* conditions', () => {
      const result = validateRuntimeConfig(
        createConfigWithLayout([
          {
            type: 'table',
            props: {
              headers: ['Name', 'Flag'],
              rows: {
                source: 'queries.users.data.results',
                cells: [
                  'row.name',
                  {
                    type: 'container',
                    visibility: {
                      operator: 'and',
                      conditions: [
                        { reference: 'row.status', operator: 'equals', value: 'active' },
                        { reference: 'row.priority', operator: 'greaterThan', value: 0 },
                      ],
                    },
                    children: [],
                  },
                ],
              },
            },
          },
        ]),
      )
      expect(result.status).toBe('ready')
    })

    it('rejects table.visibility itself with row.* (a table is not inside its own cell subtree)', () => {
      const result = validateRuntimeConfig(
        createConfigWithLayout([
          {
            type: 'table',
            visibility: { reference: 'row.status', operator: 'equals', value: 'active' },
            props: {
              headers: ['Name'],
              rows: [['Ada']],
            },
          },
        ]),
      )
      expect(result.status).toBe('error')
      if (result.status !== 'error') throw new Error('Expected error')
      expect(result.error.message).toContain('layout[0].visibility.reference')
      expect(result.error.message).toContain('row.* references are only supported inside a table cell subtree.')
    })

    it('rejects visibility row.* inside a queryStateFeedback fallback node outside any table cell', () => {
      const result = validateRuntimeConfig(
        createConfigWithLayout([
          {
            type: 'heading',
            queryStateFeedback: {
              query: 'searchUsers',
              states: {
                error: {
                  mode: 'fallback',
                  fallback: [
                    {
                      type: 'paragraph',
                      visibility: { reference: 'row.status', operator: 'equals', value: 'active' },
                      props: { text: 'Fallback text' },
                    },
                  ],
                },
              },
            },
            props: { text: 'Welcome', level: 1 },
          },
        ]),
      )
      expect(result.status).toBe('error')
      if (result.status !== 'error') throw new Error('Expected error')
      expect(result.error.message).toContain('layout[0].queryStateFeedback.states.error.fallback[0].visibility.reference')
    })

    it('accepts visibility row.* inside a queryStateFeedback fallback node nested inside a table cell', () => {
      const result = validateRuntimeConfig(
        createConfigWithLayout([
          {
            type: 'table',
            props: {
              headers: ['Name', 'Status'],
              rows: {
                source: 'queries.users.data.results',
                cells: [
                  'row.name',
                  {
                    type: 'container',
                    queryStateFeedback: {
                      query: 'searchUsers',
                      states: {
                        error: {
                          mode: 'fallback',
                          fallback: [
                            {
                              type: 'paragraph',
                              visibility: { reference: 'row.status', operator: 'equals', value: 'active' },
                              props: { text: 'Fallback text' },
                            },
                          ],
                        },
                      },
                    },
                    children: [],
                  },
                ],
              },
            },
          },
        ]),
      )
      expect(result.status).toBe('ready')
    })
  })
})
