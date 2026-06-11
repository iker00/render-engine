import { describe, expect, it } from 'vitest'
import { validateRuntimeConfig } from '../../config/runtime-config'
import {
  createConfigWithLayout,
  createConfigWithNavigateToButtonAction,
} from './helpers'

describe('validateRuntimeConfig', () => {
  describe('declarative api contract', () => {
    it('accepts navigateTo without params and preserves the normalized action shape', () => {
      const result = validateRuntimeConfig(createConfigWithNavigateToButtonAction())

      expect(result.status).toBe('ready')

      if (result.status !== 'ready') {
        throw new Error('Expected ready result')
      }

      expect(result.config.pages[0].layout[0]).toEqual({
        type: 'button',
        props: {
          label: 'Open details',
          action: {
            type: 'navigateTo',
            pageId: 'details',
          },
        },
      })
    })

    it('accepts navigateTo.params as a flat scalar object', () => {
      const result = validateRuntimeConfig(
        createConfigWithNavigateToButtonAction({
          params: {
            userId: '42',
            count: 3,
            isEditing: true,
            parentId: null,
          },
        }),
      )

      expect(result.status).toBe('ready')

      if (result.status !== 'ready') {
        throw new Error('Expected ready result')
      }

      expect(result.config.pages[0].layout[0]).toEqual({
        type: 'button',
        props: {
          label: 'Open details',
          action: {
            type: 'navigateTo',
            pageId: 'details',
            params: {
              userId: '42',
              count: 3,
              isEditing: true,
              parentId: null,
            },
          },
        },
      })
    })

    it('rejects invalid navigateTo.params shapes and values', () => {
      expect(
        validateRuntimeConfig(
          createConfigWithNavigateToButtonAction({
            params: [],
          }),
        ),
      ).toEqual({
        status: 'error',
        error: {
          code: 'invalid-layout',
          displayMode: 'development-only',
          message: 'Page "home" has an invalid layout at "layout[0].props.action.params": navigateTo params must be a flat object with non-empty keys.',
        },
      })

      expect(
        validateRuntimeConfig(
          createConfigWithNavigateToButtonAction({
            params: {
              user: {
                id: '42',
              },
            },
          }),
        ),
      ).toEqual({
        status: 'error',
        error: {
          code: 'invalid-layout',
          displayMode: 'development-only',
          message: 'Page "home" has an invalid layout at "layout[0].props.action.params.user": navigateTo params only accept string, number, boolean or null.',
        },
      })

      expect(
        validateRuntimeConfig(
          createConfigWithNavigateToButtonAction({
            params: {
              '': '42',
            },
          }),
        ),
      ).toEqual({
        status: 'error',
        error: {
          code: 'invalid-layout',
          displayMode: 'development-only',
          message: 'Page "home" has an invalid layout at "layout[0].props.action.params": navigateTo params contain an empty key.',
        },
      })

      expect(
        validateRuntimeConfig(
          createConfigWithNavigateToButtonAction({
            params: {
              tags: ['admin'],
            },
          }),
        ),
      ).toEqual({
        status: 'error',
        error: {
          code: 'invalid-layout',
          displayMode: 'development-only',
          message: 'Page "home" has an invalid layout at "layout[0].props.action.params.tags": navigateTo params only accept string, number, boolean or null.',
        },
      })
    })

    it('rejects malformed params.* references inside navigateTo.params before render', () => {
      expect(
        validateRuntimeConfig(
          createConfigWithNavigateToButtonAction({
            params: {
              userId: 'params',
            },
          }),
        ),
      ).toEqual({
        status: 'error',
        error: {
          code: 'invalid-layout',
          displayMode: 'development-only',
          message:
            'Page "home" has an invalid layout at "layout[0].props.action.params.userId": navigateTo params must use params.{paramName} when referencing page params.',
        },
      })

      expect(
        validateRuntimeConfig(
          createConfigWithNavigateToButtonAction({
            params: {
              userId: 'params.user.id',
            },
          }),
        ),
      ).toEqual({
        status: 'error',
        error: {
          code: 'invalid-layout',
          displayMode: 'development-only',
          message:
            'Page "home" has an invalid layout at "layout[0].props.action.params.userId": navigateTo params must use params.{paramName} when referencing page params.',
        },
      })

      expect(
        validateRuntimeConfig(
          createConfigWithNavigateToButtonAction({
            params: {
              userId: 'params..id',
            },
          }),
        ),
      ).toEqual({
        status: 'error',
        error: {
          code: 'invalid-layout',
          displayMode: 'development-only',
          message:
            'Page "home" has an invalid layout at "layout[0].props.action.params.userId": navigateTo params must use params.{paramName} when referencing page params.',
        },
      })
    })

    it('still rejects unknown target pages when navigateTo.params is valid', () => {
      expect(
        validateRuntimeConfig(
          createConfigWithNavigateToButtonAction({
            pageId: 'missing-page',
            params: {
              userId: '42',
            },
          }),
        ),
      ).toEqual({
        status: 'error',
        error: {
          code: 'invalid-layout',
          displayMode: 'development-only',
          message: 'Page "home" has an invalid layout at "layout[0].props.action.pageId": unknown page "missing-page".',
        },
      })
    })

    it('accepts params.{paramName} references in visibility rules before render', () => {
      expect(
        validateRuntimeConfig(
          createConfigWithLayout([
            {
              type: 'heading',
              visibility: {
                reference: 'params.userId',
                operator: 'equals',
                value: '42',
              },
              props: {
                text: 'Welcome',
                level: 1,
              },
            },
          ]),
        ),
      ).toMatchObject({ status: 'ready' })
    })

    it('rejects params references and templates in dynamic collection sources before render', () => {
      for (const source of ['params.userId', '{{queries.searchUsers.data}}']) {
        expect(
          validateRuntimeConfig(
            createConfigWithLayout([
              {
                type: 'list',
                props: {
                  items: {
                    source,
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

        expect(
          validateRuntimeConfig(
            createConfigWithLayout([
              {
                type: 'select',
                props: {
                  fieldId: 'assignee',
                  label: 'Assignee',
                  items: {
                    source,
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
      }
    })
  })
})
