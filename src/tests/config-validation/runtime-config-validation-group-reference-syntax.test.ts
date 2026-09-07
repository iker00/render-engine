import { describe, expect, it } from 'vitest'
import { validateRuntimeConfig } from '../../config/runtime-config'
import { parseRuntimeReference } from '../../config/runtime-reference-syntax'
import { parseGroupReference } from '../../config/runtime-reference-namespace-guards'
import {
  createConfigWithApi,
  createConfigWithFormLayout,
  createConfigWithLayout,
  createRepeaterNode,
  createVisibilityRule,
} from './helpers'

describe('group.* reference syntax', () => {
  describe('parseRuntimeReference', () => {
    it('parses group.{paramName} as a supported reference with a single path segment', () => {
      expect(parseRuntimeReference('group.title')).toEqual({
        kind: 'reference',
        status: 'supported',
        namespace: 'group',
        path: ['title'],
        source: 'group.title',
      })

      expect(parseRuntimeReference('group.userId')).toEqual({
        kind: 'reference',
        status: 'supported',
        namespace: 'group',
        path: ['userId'],
        source: 'group.userId',
      })
    })

    it.each(['group', 'group.', 'group.a.b', 'group..x', 'group.$key'])(
      'does not parse "%s" as a valid group reference',
      (value) => {
        const result = parseRuntimeReference(value)

        expect(result.kind).toBe('reference')
        if (result.kind === 'reference') {
          expect(result.status).toBe('invalid')
        }
      },
    )
  })

  describe('parseGroupReference', () => {
    it('returns the paramName for a valid group.{paramName} reference', () => {
      expect(parseGroupReference('group.title')).toEqual({ paramName: 'title' })
      expect(parseGroupReference('group.userId')).toEqual({ paramName: 'userId' })
    })

    it.each(['group', 'group.', 'group.a.b', 'group..x', 'group.$key', 'params.title', 'not-a-reference'])(
      'returns null for "%s"',
      (value) => {
        expect(parseGroupReference(value)).toBeNull()
      },
    )
  })
})

describe('validateRuntimeConfig', () => {
  describe('group.* surface acceptance (same boundary as params.*)', () => {
    it('accepts group.* interpolation in a visible text surface without rejecting the config', () => {
      const result = validateRuntimeConfig(
        createConfigWithLayout([
          {
            type: 'heading',
            props: {
              text: 'Group: {{group.title}}',
              level: 1,
            },
          },
        ]),
      )

      expect(result.status).toBe('ready')
    })

    it('accepts group.* in api.query, api.body and api.headers', () => {
      const result = validateRuntimeConfig(
        createConfigWithApi({
          createEntry: {
            method: 'POST',
            endpoint: '/api/entries',
            query: { ownerId: 'group.ownerId' },
            body: { title: 'group.title' },
            headers: { 'X-Group': 'group.title' },
          },
        }),
      )

      expect(result.status).toBe('ready')
    })

    it('accepts group.* in button.props.action.query, .body and .headers for executeOperation', () => {
      const result = validateRuntimeConfig({
        api: { op: { method: 'POST', endpoint: '/api/x' } },
        pages: [
          {
            id: 'home',
            layout: [
              {
                type: 'button',
                props: {
                  label: 'Save',
                  action: {
                    type: 'executeOperation',
                    operationName: 'op',
                    query: { ownerId: 'group.ownerId' },
                    body: { title: 'group.title' },
                    headers: { 'X-Group': 'group.title' },
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

    it('accepts group.* in form.submitAction.query, .body and .headers', () => {
      const result = validateRuntimeConfig(
        createConfigWithFormLayout({
          submitAction: {
            type: 'executeOperation',
            operationName: 'submitUserForm',
            query: { ownerId: 'group.ownerId' },
            body: { title: 'group.title' },
            headers: { 'X-Group': 'group.title' },
          },
        }),
      )

      expect(result.status).toBe('ready')
    })

    it('accepts group.{paramName} as a valid visibility.reference with isTruthy operator', () => {
      const result = validateRuntimeConfig(
        createConfigWithLayout([
          {
            type: 'heading',
            visibility: createVisibilityRule({
              reference: 'group.ownerId',
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

    it('accepts group.* as a supported reference for multiple choice defaultValue', () => {
      const result = validateRuntimeConfig(
        createConfigWithFormLayout({
          children: [
            {
              type: 'select',
              props: {
                fieldId: 'dynamicScopes',
                label: 'Dynamic scopes',
                multiple: true,
                defaultValue: 'group.scopes',
                items: {
                  values: ['read', 'write'],
                },
              },
            },
          ],
        }),
      )

      expect(result.status).toBe('ready')
    })

    it('rejects group.* in repeater.props.items.source with the same message as params.*', () => {
      const result = validateRuntimeConfig(
        createConfigWithLayout([
          createRepeaterNode({
            props: {
              items: {
                source: 'group.title',
                key: 'id',
              },
              template: [],
            },
          }),
        ]),
      )

      expect(result).toEqual({
        status: 'error',
        error: {
          code: 'invalid-layout',
          displayMode: 'development-only',
          message:
            `Page "home" has an invalid layout at "layout[0].props.items.source": collection sources must use queries.{queryName}.data, queries.{queryName}.data.* or item.*.
  → repeater[0]
  Node: {"type":"repeater"}`,
        },
      })
    })
  })
})
