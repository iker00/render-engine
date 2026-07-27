import { describe, expect, it } from 'vitest'
import { validateRuntimeConfig } from '../../config/runtime-config'
import { whenConditionSchema } from '../../config/runtime-config-zod'
import {
  createConfigWithPages,
  createConfigWithLayout,
  createVisibilityRule,
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
})
