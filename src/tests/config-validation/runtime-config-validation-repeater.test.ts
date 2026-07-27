import { describe, expect, it } from 'vitest'
import { validateRuntimeConfig } from '../../config/runtime-config'
import {
  createConfigWithLayout,
  createRepeaterNode,
} from './helpers'

describe('validateRuntimeConfig', () => {
  describe('declarative api contract', () => {
    it('accepts repeater nodes with query collection source, relative key path and template', () => {
      expect(
        validateRuntimeConfig(
          createConfigWithLayout([
            createRepeaterNode({
              extra: 'drop-me',
              props: {
                items: {
                  source: 'queries.posts.data.results',
                  key: 'meta.slug',
                  extra: 'drop-me',
                },
                template: [
                  {
                    type: 'heading',
                    props: {
                      text: 'item.title',
                      level: 2,
                      extra: 'drop-me',
                    },
                  },
                  {
                    type: 'form',
                    id: 'post-actions',
                    children: [
                      {
                        type: 'input',
                        props: {
                          fieldId: 'note',
                          label: 'Note',
                        },
                      },
                    ],
                  },
                ],
                extra: 'drop-me',
              },
            }),
          ]),
        ),
      ).toEqual({
        status: 'ready',
        config: {
          api: {},
          pages: [
            {
              id: 'home',
              layout: [
                {
                  type: 'repeater',
                  props: {
                    items: {
                      source: 'queries.posts.data.results',
                      key: 'meta.slug',
                    },
                    template: [
                      {
                        type: 'heading',
                        props: {
                          text: 'item.title',
                          level: 2,
                        },
                      },
                      {
                        type: 'form',
                        id: 'post-actions',
                        children: [
                          {
                            type: 'input',
                            props: {
                              fieldId: 'note',
                              label: 'Note',
                            },
                          },
                        ],
                      },
                    ],
                  },
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
              type: 'repeater',
              props: {
                items: {
                  source: 'queries.posts.data.results',
                  key: 'meta.slug',
                },
                template: [
                  {
                    type: 'heading',
                    props: {
                      text: 'item.title',
                      level: 2,
                    },
                  },
                  {
                    type: 'form',
                    id: 'post-actions',
                    children: [
                      {
                        type: 'input',
                        props: {
                          fieldId: 'note',
                          label: 'Note',
                        },
                      },
                    ],
                  },
                ],
              },
            },
          ],
        },
      })
    })

    it('accepts repeater pagination with the closed local controls variant catalog', () => {
      for (const variant of ['previousNext', 'numbered', 'scroll']) {
        expect(
          validateRuntimeConfig(
            createConfigWithLayout([
              createRepeaterNode({
                queryStateFeedback: {
                  query: 'posts',
                },
                visibility: {
                  reference: 'queries.posts.status',
                  operator: 'equals',
                  value: 'success',
                },
                layout: {
                  span: 6,
                },
                props: {
                  items: {
                    source: 'queries.posts.data.results',
                    key: 'id',
                  },
                  pagination: {
                    enabled: true,
                    pageSize: 10,
                    controls: {
                      variant,
                    },
                  },
                  template: [
                    {
                      type: 'heading',
                      props: {
                        text: 'item.title',
                        level: 2,
                      },
                    },
                  ],
                },
              }),
            ]),
          ),
        ).toMatchObject({
          status: 'ready',
          page: {
            layout: [
              {
                type: 'repeater',
                queryStateFeedback: {
                  query: 'posts',
                },
                visibility: {
                  reference: 'queries.posts.status',
                  operator: 'equals',
                  value: 'success',
                },
                layout: {
                  span: 6,
                },
                props: {
                  items: {
                    source: 'queries.posts.data.results',
                    key: 'id',
                  },
                  pagination: {
                    enabled: true,
                    pageSize: 10,
                    controls: {
                      variant,
                    },
                  },
                },
              },
            ],
          },
        })
      }
    })

    it('accepts repeater pagination without controls or with empty controls for the runtime default', () => {
      for (const pagination of [
        {
          enabled: true,
          pageSize: 2,
        },
        {
          enabled: true,
          pageSize: 2,
          controls: {},
        },
      ]) {
        const result = validateRuntimeConfig(
          createConfigWithLayout([
            createRepeaterNode({
              props: {
                items: {
                  source: 'queries.posts.data',
                  key: 'id',
                },
                pagination,
                template: [],
              },
            }),
          ]),
        )

        expect(result).toMatchObject({
          status: 'ready',
          page: {
            layout: [
              {
                type: 'repeater',
                props: {
                  pagination,
                },
              },
            ],
          },
        })
      }
    })

    it('rejects invalid repeater pagination values with focused diagnostic paths', () => {
      const cases: Array<{ pagination: unknown; path: string }> = [
        { pagination: { enabled: false, pageSize: 2 }, path: 'props.pagination.enabled' },
        { pagination: { pageSize: 2 }, path: 'props.pagination.enabled' },
        { pagination: { enabled: true }, path: 'props.pagination.pageSize' },
        { pagination: { enabled: true, pageSize: 1.5 }, path: 'props.pagination.pageSize' },
        { pagination: { enabled: true, pageSize: 0 }, path: 'props.pagination.pageSize' },
        { pagination: { enabled: true, pageSize: Number.POSITIVE_INFINITY }, path: 'props.pagination.pageSize' },
        {
          pagination: { enabled: true, pageSize: 2, controls: { variant: 'numbers' } },
          path: 'props.pagination.controls.variant',
        },
        { pagination: { enabled: true, pageSize: 2, remote: true }, path: 'props.pagination.remote' },
        { pagination: { enabled: true, pageSize: 2, cursor: 'next' }, path: 'props.pagination.cursor' },
        { pagination: { enabled: true, pageSize: 2, total: 10 }, path: 'props.pagination.total' },
        { pagination: { enabled: true, pageSize: 2, page: 1 }, path: 'props.pagination.page' },
        { pagination: { enabled: true, pageSize: 2, limit: 2 }, path: 'props.pagination.limit' },
        { pagination: { enabled: true, pageSize: 2, offset: 0 }, path: 'props.pagination.offset' },
        { pagination: { enabled: true, pageSize: 2, hasNext: true }, path: 'props.pagination.hasNext' },
        {
          pagination: { enabled: true, pageSize: 2, controls: { remote: true } },
          path: 'props.pagination.controls.remote',
        },
        {
          pagination: { enabled: true, pageSize: 2, controls: { cursor: 'next' } },
          path: 'props.pagination.controls.cursor',
        },
        {
          pagination: { enabled: true, pageSize: 2, controls: { total: 10 } },
          path: 'props.pagination.controls.total',
        },
        {
          pagination: { enabled: true, pageSize: 2, controls: { page: 1 } },
          path: 'props.pagination.controls.page',
        },
        {
          pagination: { enabled: true, pageSize: 2, controls: { limit: 2 } },
          path: 'props.pagination.controls.limit',
        },
        {
          pagination: { enabled: true, pageSize: 2, controls: { offset: 0 } },
          path: 'props.pagination.controls.offset',
        },
        {
          pagination: { enabled: true, pageSize: 2, controls: { hasNext: true } },
          path: 'props.pagination.controls.hasNext',
        },
      ]

      for (const { pagination, path } of cases) {
        expect(
          validateRuntimeConfig(
            createConfigWithLayout([
              createRepeaterNode({
                props: {
                  items: {
                    source: 'queries.posts.data',
                    key: 'id',
                  },
                  pagination,
                  template: [],
                },
              }),
            ]),
          ),
        ).toEqual({
          status: 'error',
          error: {
            code: 'invalid-layout',
            displayMode: 'development-only',
            message: `Page "home" has an invalid layout at "layout[0].${path}".\n  → repeater[0]\n  Node: {"type":"repeater"}`,
          },
        })
      }
    })

    it('rejects repeater collection sources outside queries.{queryName}.data scope', () => {
      expect(
        validateRuntimeConfig(
          createConfigWithLayout([
            createRepeaterNode({
              props: {
                items: {
                  source: 'queries.posts.status',
                  key: 'id',
                },
                template: [],
              },
            }),
          ]),
        ),
      ).toEqual({
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

    it('rejects repeater keys that are empty, global references or malformed relative paths', () => {
      for (const key of ['', 'item.id', '{{item.id}}', 'queries.posts.data.0.id', 'author..id']) {
        expect(
          validateRuntimeConfig(
            createConfigWithLayout([
              createRepeaterNode({
                props: {
                  items: {
                    source: 'queries.posts.data',
                    key,
                  },
                  template: [],
                },
              }),
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
      }
    })

    it('accepts the reserved literal "$key" as a valid value for props.items.key', () => {
      const result = validateRuntimeConfig(
        createConfigWithLayout([
          createRepeaterNode({
            props: {
              items: {
                source: 'queries.posts.data',
                key: '$key',
              },
              template: [
                {
                  type: 'heading',
                  props: {
                    text: 'item.title',
                    level: 2,
                  },
                },
              ],
            },
          }),
        ]),
      )

      expect(result).toMatchObject({
        status: 'ready',
        page: {
          layout: [
            {
              type: 'repeater',
              props: {
                items: {
                  source: 'queries.posts.data',
                  key: '$key',
                },
              },
            },
          ],
        },
      })
    })

    it('accepts the reserved literal "$index" as a valid value for props.items.key', () => {
      const result = validateRuntimeConfig(
        createConfigWithLayout([
          createRepeaterNode({
            props: {
              items: {
                source: 'queries.posts.data',
                key: '$index',
              },
              template: [
                {
                  type: 'heading',
                  props: {
                    text: 'item.title',
                    level: 2,
                  },
                },
              ],
            },
          }),
        ]),
      )

      expect(result).toMatchObject({
        status: 'ready',
        page: {
          layout: [
            {
              type: 'repeater',
              props: {
                items: {
                  source: 'queries.posts.data',
                  key: '$index',
                },
              },
            },
          ],
        },
      })
    })

    it('rejects "$"-prefixed key values other than the exact literals "$key" and "$index"', () => {
      for (const key of ['$key.id', '$key.$key', 'meta.$key', '$index.algo', '$index.$key', 'meta.$index', '$other', '$']) {
        expect(
          validateRuntimeConfig(
            createConfigWithLayout([
              createRepeaterNode({
                props: {
                  items: {
                    source: 'queries.posts.data',
                    key,
                  },
                  template: [],
                },
              }),
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
      }
    })

    it('rejects repeater nodes without template, with non-array template, or with children', () => {
      expect(
        validateRuntimeConfig(
          createConfigWithLayout([
            {
              type: 'repeater',
              props: {
                items: {
                  source: 'queries.posts.data',
                  key: 'id',
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
          message: `Page "home" has an invalid layout at "layout[0].props.template".
  → repeater[0]
  Node: {"type":"repeater"}`,
        },
      })

      expect(
        validateRuntimeConfig(
          createConfigWithLayout([
            createRepeaterNode({
              props: {
                items: {
                  source: 'queries.posts.data',
                  key: 'id',
                },
                template: 'not-an-array',
              },
            }),
          ]),
        ),
      ).toEqual({
        status: 'error',
        error: {
          code: 'invalid-layout',
          displayMode: 'development-only',
          message: `Page "home" has an invalid layout at "layout[0].props.template".
  → repeater[0]
  Node: {"type":"repeater"}`,
        },
      })

      expect(
        validateRuntimeConfig(
          createConfigWithLayout([
            createRepeaterNode({
              children: [],
            }),
          ]),
        ),
      ).toEqual({
        status: 'error',
        error: {
          code: 'invalid-layout',
          displayMode: 'development-only',
          message: `Page "home" has an invalid layout at "layout[0].children".
  → repeater[0]
  Node: {"type":"repeater"}`,
        },
      })
    })
  })
})
