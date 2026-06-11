import { describe, expect, it } from 'vitest'
import { validateRuntimeConfig } from '../../config/runtime-config'
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
          message: 'Page "home" has an invalid layout at "layout[0].visibility.operator".',
        },
      })
    })

    it('rejects visibility references outside the supported forms and queries scope', () => {
      for (const reference of [
        'navigation.currentPageId',
        'routeParams.userId',
        'params.filter',
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
          message: 'Page "home" has an invalid layout at "layout[0].visibility.value": operator "isTruthy" does not accept value.',
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
          message: 'Page "home" has an invalid layout at "layout[0].visibility.value": operator "lessThan" requires value.',
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
          message: 'Page "home" has an invalid layout at "layout[0].visibility.value": operator "equals" only accepts string, number, boolean or null.',
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
          message: 'Page "home" has an invalid layout at "layout[0].visibility.value": operator "notEquals" only accepts string, number, boolean or null.',
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
          message: 'Page "home" has an invalid layout at "layout[0].visibility.value": operator "greaterThan" only accepts numeric thresholds.',
        },
      })
    })

    // T3: confirm that visibility still rejects params.* (not contaminated by when logic)
    it('rejects visibility references using params.* (params.* is only valid in when, not visibility)', () => {
      expect(
        validateRuntimeConfig(
          createConfigWithLayout([
            {
              type: 'heading',
              visibility: createVisibilityRule({
                reference: 'params.filter',
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
          message: expect.stringContaining('visibility.reference'),
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
})
