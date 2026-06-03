import { describe, expect, it } from 'vitest'
import { validateRuntimeConfig } from '../../config/runtime-config'
import {
  createConfigWithLayout,
  createVisibilityRule,
} from './helpers'

describe('validateRuntimeConfig', () => {
  describe('image and table node validation', () => {
    it('accepts image nodes with src and alt plus shared feedback fields', () => {
      const result = validateRuntimeConfig(
        createConfigWithLayout([
          {
            type: 'image',
            queryStateFeedback: {
              query: 'heroImage',
            },
            visibility: createVisibilityRule(),
            props: {
              src: 'queries.heroImage.data.url',
              alt: 'queries.heroImage.data.alt',
            },
          },
        ]),
      )

      expect(result).toEqual({
        status: 'ready',
        config: {
          api: {},
          pages: [
            {
              id: 'home',
              layout: [
                {
                  type: 'image',
                  queryStateFeedback: {
                    query: 'heroImage',
                  },
                  visibility: createVisibilityRule(),
                  props: {
                    src: 'queries.heroImage.data.url',
                    alt: 'queries.heroImage.data.alt',
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
              type: 'image',
              queryStateFeedback: {
                query: 'heroImage',
              },
              visibility: createVisibilityRule(),
              props: {
                src: 'queries.heroImage.data.url',
                alt: 'queries.heroImage.data.alt',
              },
            },
          ],
        },
      })
    })

    it('accepts table nodes with manual rows and scalar cells', () => {
      const result = validateRuntimeConfig(
        createConfigWithLayout([
          {
            type: 'table',
            props: {
              headers: ['Name', 'Active', 'Visits'],
              rows: [
                ['Ada', true, 12],
                ['Grace', false, 7],
              ],
            },
          },
        ]),
      )

      expect(result).toEqual({
        status: 'ready',
        config: {
          api: {},
          pages: [
            {
              id: 'home',
              layout: [
                {
                  type: 'table',
                  props: {
                    headers: ['Name', 'Active', 'Visits'],
                    rows: [
                      ['Ada', true, 12],
                      ['Grace', false, 7],
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
              type: 'table',
              props: {
                headers: ['Name', 'Active', 'Visits'],
                rows: [
                  ['Ada', true, 12],
                  ['Grace', false, 7],
                ],
              },
            },
          ],
        },
      })
    })

    it('accepts table nodes with dynamic rows from queries and item references', () => {
      const result = validateRuntimeConfig(
        createConfigWithLayout([
          {
            type: 'table',
            queryStateFeedback: {
              query: 'users',
            },
            visibility: createVisibilityRule({
              reference: 'queries.users.status',
              operator: 'equals',
              value: 'success',
            }),
            props: {
              headers: ['Name', 'Role'],
              rows: {
                source: 'queries.users.data.items',
                cells: ['item.name', 'item.role'],
              },
            },
          },
        ]),
      )

      expect(result).toEqual({
        status: 'ready',
        config: {
          api: {},
          pages: [
            {
              id: 'home',
              layout: [
                {
                  type: 'table',
                  queryStateFeedback: {
                    query: 'users',
                  },
                  visibility: {
                    reference: 'queries.users.status',
                    operator: 'equals',
                    value: 'success',
                  },
                  props: {
                    headers: ['Name', 'Role'],
                    rows: {
                      source: 'queries.users.data.items',
                      cells: ['item.name', 'item.role'],
                    },
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
              type: 'table',
              queryStateFeedback: {
                query: 'users',
              },
              visibility: {
                reference: 'queries.users.status',
                operator: 'equals',
                value: 'success',
              },
              props: {
                headers: ['Name', 'Role'],
                rows: {
                  source: 'queries.users.data.items',
                  cells: ['item.name', 'item.role'],
                },
              },
            },
          ],
        },
      })
    })

    it('accepts table columns as partial local capability metadata without changing passive headers', () => {
      const columns = [
        { id: 'Name', filterable: true, filterPlaceholder: 'Buscar nombre' },
        { id: 'Role', sortable: true },
        { id: 'Visits', filterable: true, sortable: true },
      ]
      const result = validateRuntimeConfig(
        createConfigWithLayout([
          {
            type: 'table',
            props: {
              headers: ['Name', 'Role', 'Visits', 'Active'],
              columns,
              rows: [
                ['Ada', 'Admin', 12, true],
                ['Grace', 'Editor', 7, false],
              ],
            },
          },
        ]),
      )

      expect(result).toMatchObject({
        status: 'ready',
        page: {
          layout: [
            {
              type: 'table',
              props: {
                headers: ['Name', 'Role', 'Visits', 'Active'],
                columns,
                rows: [
                  ['Ada', 'Admin', 12, true],
                  ['Grace', 'Editor', 7, false],
                ],
              },
            },
          ],
        },
      })
    })

    it('rejects invalid table column local capability metadata with focused diagnostic paths', () => {
      const cases: Array<{ headers?: string[]; columns: unknown; path: string }> = [
        { columns: [{ id: '', filterable: true }], path: 'props.columns[0].id' },
        { columns: [{ id: 'Missing', filterable: true }], path: 'props.columns[0].id' },
        { columns: [{ id: 'Name', filterable: true }, { id: 'Name', sortable: true }], path: 'props.columns[1].id' },
        {
          headers: ['Name', 'Name'],
          columns: [{ id: 'Name', filterable: true }],
          path: 'props.columns[0].id',
        },
        { columns: [{ id: 'Name', filterable: false }], path: 'props.columns[0].filterable' },
        { columns: [{ id: 'Name', filterable: true, filterPlaceholder: '' }], path: 'props.columns[0].filterPlaceholder' },
        { columns: [{ id: 'Name', sortable: true, filterPlaceholder: 'Buscar nombre' }], path: 'props.columns[0].filterPlaceholder' },
        { columns: [{ id: 'Name', sortable: false }], path: 'props.columns[0].sortable' },
        { columns: [{ id: 'Name' }], path: 'props.columns[0]' },
      ]

      for (const { headers = ['Name', 'Role'], columns, path } of cases) {

        expect(
          validateRuntimeConfig(
            createConfigWithLayout([
              {
                type: 'table',
                props: {
                  headers,
                  columns,
                  rows: [['Ada', 'Admin']],
                },
              },
            ]),
          ),
        ).toEqual({
          status: 'error',
          error: {
            code: 'invalid-layout',
            displayMode: 'development-only',
            message: `Page "home" has an invalid layout at "layout[0].${path}".`,
          },
        })
      }

      for (const key of ['mode', 'remote', 'query', 'params', 'request', 'sort', 'order', 'filters', 'total', 'cursor', 'limit', 'offset', 'page', 'hasNext']) {
        expect(
          validateRuntimeConfig(
            createConfigWithLayout([
              {
                type: 'table',
                props: {
                  headers: ['Name'],
                  columns: [{ id: 'Name', filterable: true, [key]: true }],
                  rows: [['Ada']],
                },
              },
            ]),
          ),
        ).toEqual({
          status: 'error',
          error: {
            code: 'invalid-layout',
            displayMode: 'development-only',
            message: `Page "home" has an invalid layout at "layout[0].props.columns[0].${key}".`,
          },
        })
      }
    })

    it('accepts table pagination with the local collection pagination variants and defaults', () => {
      for (const pagination of [
        { enabled: true, pageSize: 2, controls: { variant: 'previousNext' } },
        { enabled: true, pageSize: 2, controls: { variant: 'numbered' } },
        { enabled: true, pageSize: 2, controls: { variant: 'scroll' } },
        { enabled: true, pageSize: 2 },
        { enabled: true, pageSize: 2, controls: {} },
      ]) {
        expect(
          validateRuntimeConfig(
            createConfigWithLayout([
              {
                type: 'table',
                props: {
                  headers: ['Name'],
                  rows: [['Ada']],
                  pagination,
                },
              },
            ]),
          ),
        ).toMatchObject({
          status: 'ready',
          page: {
            layout: [
              {
                type: 'table',
                props: {
                  pagination,
                },
              },
            ],
          },
        })
      }
    })

    it('rejects invalid table pagination values with focused diagnostic paths', () => {
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
              {
                type: 'table',
                props: {
                  headers: ['Name'],
                  rows: [['Ada']],
                  pagination,
                },
              },
            ]),
          ),
        ).toEqual({
          status: 'error',
          error: {
            code: 'invalid-layout',
            displayMode: 'development-only',
            message: `Page "home" has an invalid layout at "layout[0].${path}".`,
          },
        })
      }
    })

    it('rejects image nodes without src or alt', () => {
      expect(
        validateRuntimeConfig(
          createConfigWithLayout([
            {
              type: 'image',
              props: {
                alt: 'Missing src',
              },
            },
          ]),
        ),
      ).toEqual({
        status: 'error',
        error: {
          code: 'invalid-layout',
          displayMode: 'development-only',
          message: 'Page "home" has an invalid layout at "layout[0].props.src".',
        },
      })

      expect(
        validateRuntimeConfig(
          createConfigWithLayout([
            {
              type: 'image',
              props: {
                src: '/hero.png',
              },
            },
          ]),
        ),
      ).toEqual({
        status: 'error',
        error: {
          code: 'invalid-layout',
          displayMode: 'development-only',
          message: 'Page "home" has an invalid layout at "layout[0].props.alt".',
        },
      })
    })

    it('rejects table nodes without headers rows or matching row lengths', () => {
      expect(
        validateRuntimeConfig(
          createConfigWithLayout([
            {
              type: 'table',
              props: {
                headers: [],
                rows: [['Ada']],
              },
            },
          ]),
        ),
      ).toEqual({
        status: 'error',
        error: {
          code: 'invalid-layout',
          displayMode: 'development-only',
          message: 'Page "home" has an invalid layout at "layout[0].props.headers".',
        },
      })

      expect(
        validateRuntimeConfig(
          createConfigWithLayout([
            {
              type: 'table',
              props: {
                headers: ['Name'],
              },
            },
          ]),
        ),
      ).toEqual({
        status: 'error',
        error: {
          code: 'invalid-layout',
          displayMode: 'development-only',
          message: 'Page "home" has an invalid layout at "layout[0].props.rows".',
        },
      })

      expect(
        validateRuntimeConfig(
          createConfigWithLayout([
            {
              type: 'table',
              props: {
                headers: ['Name', 'Role'],
                rows: [['Ada']],
              },
            },
          ]),
        ),
      ).toEqual({
        status: 'error',
        error: {
          code: 'invalid-layout',
          displayMode: 'development-only',
          message: 'Page "home" has an invalid layout at "layout[0].props.rows[0]": table rows must have exactly 2 cells to match headers.',
        },
      })
    })

    it('rejects table nodes that mix manual and dynamic row modes', () => {
      expect(
        validateRuntimeConfig(
          createConfigWithLayout([
            {
              type: 'table',
              props: {
                headers: ['Name'],
                rows: {
                  source: 'queries.users.data',
                  cells: ['item.name'],
                  values: [['Ada']],
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
          message: 'Page "home" has an invalid layout at "layout[0].props.rows": table rows must use either manual rows or a dynamic { source, cells } object.',
        },
      })
    })

    it('rejects table nodes with unsupported cell values or dynamic source shapes', () => {
      expect(
        validateRuntimeConfig(
          createConfigWithLayout([
            {
              type: 'table',
              props: {
                headers: ['Name'],
                rows: [[{ name: 'Ada' }]],
              },
            },
          ]),
        ),
      ).toEqual({
        status: 'error',
        error: {
          code: 'invalid-layout',
          displayMode: 'development-only',
          message: 'Page "home" has an invalid layout at "layout[0].props.rows[0][0].type".',
        },
      })

      expect(
        validateRuntimeConfig(
          createConfigWithLayout([
            {
              type: 'table',
              props: {
                headers: ['Name'],
                rows: {
                  source: 'forms.profile.roles',
                  cells: ['item.name'],
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
            'Page "home" has an invalid layout at "layout[0].props.rows.source": collection sources must use queries.{queryName}.data, queries.{queryName}.data.* or item.*.',
        },
      })
    })

    it('rejects table nodes with dynamic cells that do not match the headers length', () => {
      expect(
        validateRuntimeConfig(
          createConfigWithLayout([
            {
              type: 'table',
              props: {
                headers: ['Name', 'Role'],
                rows: {
                  source: 'queries.users.data',
                  cells: ['item.name'],
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
          message: 'Page "home" has an invalid layout at "layout[0].props.rows.cells": table dynamic cells must have exactly 2 entries to match headers.',
        },
      })
    })

    describe('manual rows with NodeObject cells', () => {
      it('accepts a manual row with a valid image NodeObject in one cell and primitives in the rest', () => {
        const result = validateRuntimeConfig(
          createConfigWithLayout([
            {
              type: 'table',
              props: {
                headers: ['Avatar', 'Name'],
                rows: [
                  [
                    { type: 'image', props: { src: 'item.avatar', alt: 'item.name' } },
                    'Ada',
                  ],
                ],
              },
            },
          ]),
        )

        expect(result).toMatchObject({
          status: 'ready',
          page: {
            layout: [
              {
                type: 'table',
                props: {
                  headers: ['Avatar', 'Name'],
                  rows: [
                    [
                      { type: 'image', props: { src: 'item.avatar', alt: 'item.name' } },
                      'Ada',
                    ],
                  ],
                },
              },
            ],
          },
        })
      })

      it('accepts a manual row with a valid button NodeObject using navigateTo action', () => {
        const result = validateRuntimeConfig(
          createConfigWithLayout([
            {
              type: 'table',
              props: {
                headers: ['Name', 'Action'],
                rows: [
                  [
                    'Ada',
                    {
                      type: 'button',
                      props: {
                        label: 'Ver',
                        action: { type: 'navigateTo', pageId: 'detail', params: { id: 'item.id' } },
                      },
                    },
                  ],
                ],
              },
            },
            { type: 'heading', props: { text: 'Detail', level: 1 } },
          ]),
        )

        expect(result).toMatchObject({ status: 'ready' })
      })

      it('accepts a manual row with a container NodeObject whose children are in the allowed subset (including nested container)', () => {
        const result = validateRuntimeConfig(
          createConfigWithLayout([
            {
              type: 'table',
              props: {
                headers: ['Content'],
                rows: [
                  [
                    {
                      type: 'container',
                      props: {},
                      children: [
                        { type: 'image', props: { src: '/img.png', alt: 'img' } },
                        {
                          type: 'container',
                          props: {},
                          children: [
                            { type: 'paragraph', props: { text: 'nested' } },
                          ],
                        },
                      ],
                    },
                  ],
                ],
              },
            },
          ]),
        )

        expect(result).toMatchObject({ status: 'ready' })
      })

      it('accepts mixed rows with both primitives and NodeObjects in different columns', () => {
        const result = validateRuntimeConfig(
          createConfigWithLayout([
            {
              type: 'table',
              props: {
                headers: ['Name', 'Avatar', 'Active'],
                rows: [
                  [
                    'Ada',
                    { type: 'image', props: { src: '/ada.png', alt: 'Ada' } },
                    true,
                  ],
                  [
                    'Grace',
                    { type: 'image', props: { src: '/grace.png', alt: 'Grace' } },
                    false,
                  ],
                ],
              },
            },
          ]),
        )

        expect(result).toMatchObject({ status: 'ready' })
      })

      it('rejects a manual cell with { type: "modal", ... } with diagnostic at rows[r][c].type', () => {
        expect(
          validateRuntimeConfig(
            createConfigWithLayout([
              {
                type: 'table',
                props: {
                  headers: ['Name', 'Cell'],
                  rows: [
                    ['Ada', { type: 'modal', id: 'my-modal', props: {} }],
                  ],
                },
              },
            ]),
          ),
        ).toEqual({
          status: 'error',
          error: {
            code: 'invalid-layout',
            displayMode: 'development-only',
            message: 'Page "home" has an invalid layout at "layout[0].props.rows[0][1].type".',
          },
        })
      })

      it('rejects a manual cell with { type: "input", ... } with diagnostic at rows[r][c].type', () => {
        expect(
          validateRuntimeConfig(
            createConfigWithLayout([
              {
                type: 'table',
                props: {
                  headers: ['Name', 'Cell'],
                  rows: [
                    [
                      'Ada',
                      { type: 'input', props: { fieldId: 'name', label: 'Name' } },
                    ],
                  ],
                },
              },
            ]),
          ),
        ).toEqual({
          status: 'error',
          error: {
            code: 'invalid-layout',
            displayMode: 'development-only',
            message: 'Page "home" has an invalid layout at "layout[0].props.rows[0][1].type".',
          },
        })
      })

      it('rejects a manual cell with { type: "repeater", ... } and { type: "table", ... }', () => {
        for (const forbiddenType of ['repeater', 'table']) {
          expect(
            validateRuntimeConfig(
              createConfigWithLayout([
                {
                  type: 'table',
                  props: {
                    headers: ['Cell'],
                    rows: [[{ type: forbiddenType, props: {} }]],
                  },
                },
              ]),
            ),
          ).toEqual({
            status: 'error',
            error: {
              code: 'invalid-layout',
              displayMode: 'development-only',
              message: `Page "home" has an invalid layout at "layout[0].props.rows[0][0].type".`,
            },
          })
        }
      })

      it('rejects a manual cell with { type: "form", ... }', () => {
        expect(
          validateRuntimeConfig(
            createConfigWithLayout([
              {
                type: 'table',
                props: {
                  headers: ['Cell'],
                  rows: [[{ type: 'form', id: 'my-form' }]],
                },
              },
            ]),
          ),
        ).toEqual({
          status: 'error',
          error: {
            code: 'invalid-layout',
            displayMode: 'development-only',
            message: 'Page "home" has an invalid layout at "layout[0].props.rows[0][0].type".',
          },
        })
      })

      it('rejects a manual cell with empty or absent type', () => {
        expect(
          validateRuntimeConfig(
            createConfigWithLayout([
              {
                type: 'table',
                props: {
                  headers: ['Cell'],
                  rows: [[{ type: '', props: {} }]],
                },
              },
            ]),
          ),
        ).toEqual({
          status: 'error',
          error: {
            code: 'invalid-layout',
            displayMode: 'development-only',
            message: 'Page "home" has an invalid layout at "layout[0].props.rows[0][0].type".',
          },
        })

        expect(
          validateRuntimeConfig(
            createConfigWithLayout([
              {
                type: 'table',
                props: {
                  headers: ['Cell'],
                  rows: [[{ props: {} }]],
                },
              },
            ]),
          ),
        ).toEqual({
          status: 'error',
          error: {
            code: 'invalid-layout',
            displayMode: 'development-only',
            message: 'Page "home" has an invalid layout at "layout[0].props.rows[0][0].type".',
          },
        })
      })

      it('rejects a container cell whose children[i] declares a type outside the allowed subset', () => {
        expect(
          validateRuntimeConfig(
            createConfigWithLayout([
              {
                type: 'table',
                props: {
                  headers: ['Cell'],
                  rows: [
                    [
                      {
                        type: 'container',
                        props: {},
                        children: [
                          { type: 'modal', id: 'bad', props: {} },
                        ],
                      },
                    ],
                  ],
                },
              },
            ]),
          ),
        ).toEqual({
          status: 'error',
          error: {
            code: 'invalid-layout',
            displayMode: 'development-only',
            message: 'Page "home" has an invalid layout at "layout[0].props.rows[0][0].children[0].type".',
          },
        })
      })

      it('rejects a container cell with deeply nested children that break the allowed subset', () => {
        expect(
          validateRuntimeConfig(
            createConfigWithLayout([
              {
                type: 'table',
                props: {
                  headers: ['Cell'],
                  rows: [
                    [
                      {
                        type: 'container',
                        props: {},
                        children: [
                          {
                            type: 'container',
                            props: {},
                            children: [
                              { type: 'input', props: { fieldId: 'f', label: 'F' } },
                            ],
                          },
                        ],
                      },
                    ],
                  ],
                },
              },
            ]),
          ),
        ).toEqual({
          status: 'error',
          error: {
            code: 'invalid-layout',
            displayMode: 'development-only',
            message: 'Page "home" has an invalid layout at "layout[0].props.rows[0][0].children[0].children[0].type".',
          },
        })
      })

      it('rejects a manual cell NodeObject that breaks the contract of its own node type (image without src or fetch)', () => {
        expect(
          validateRuntimeConfig(
            createConfigWithLayout([
              {
                type: 'table',
                props: {
                  headers: ['Cell'],
                  rows: [
                    [
                      { type: 'image', props: { alt: 'missing src' } },
                    ],
                  ],
                },
              },
            ]),
          ),
        ).toEqual({
          status: 'error',
          error: {
            code: 'invalid-layout',
            displayMode: 'development-only',
            message: 'Page "home" has an invalid layout at "layout[0].props.rows[0][0].props.src".',
          },
        })
      })

      it('rejects a manual row whose number of cells (primitives + nodes) does not match headers', () => {
        expect(
          validateRuntimeConfig(
            createConfigWithLayout([
              {
                type: 'table',
                props: {
                  headers: ['Name', 'Avatar', 'Active'],
                  rows: [
                    [
                      'Ada',
                      { type: 'image', props: { src: '/ada.png', alt: 'Ada' } },
                    ],
                  ],
                },
              },
            ]),
          ),
        ).toEqual({
          status: 'error',
          error: {
            code: 'invalid-layout',
            displayMode: 'development-only',
            message: 'Page "home" has an invalid layout at "layout[0].props.rows[0]": table rows must have exactly 3 cells to match headers.',
          },
        })
      })
    })

    describe('dynamic rows with NodeObject cells', () => {
      it('accepts cells with a NodeObject image whose src is item.avatar mixed with string reference cells', () => {
        const result = validateRuntimeConfig(
          createConfigWithLayout([
            {
              type: 'table',
              props: {
                headers: ['Avatar', 'Name'],
                rows: {
                  source: 'queries.users.data.items',
                  cells: [
                    { type: 'image', props: { src: 'item.avatar', alt: 'item.name' } },
                    'item.name',
                  ],
                },
              },
            },
          ]),
        )

        expect(result).toMatchObject({
          status: 'ready',
          page: {
            layout: [
              {
                type: 'table',
                props: {
                  headers: ['Avatar', 'Name'],
                  rows: {
                    source: 'queries.users.data.items',
                    cells: [
                      { type: 'image', props: { src: 'item.avatar', alt: 'item.name' } },
                      'item.name',
                    ],
                  },
                },
              },
            ],
          },
        })
      })

      it('accepts dynamic cells with a NodeObject button whose action.navigateTo.params.id references item.id', () => {
        const result = validateRuntimeConfig(
          createConfigWithLayout([
            {
              type: 'table',
              props: {
                headers: ['Name', 'Action'],
                rows: {
                  source: 'queries.users.data.items',
                  cells: [
                    'item.name',
                    {
                      type: 'button',
                      props: {
                        label: 'Ver',
                        action: { type: 'navigateTo', pageId: 'detail', params: { id: 'item.id' } },
                      },
                    },
                  ],
                },
              },
            },
            { type: 'heading', props: { text: 'Detail', level: 1 } },
          ]),
        )

        expect(result).toMatchObject({ status: 'ready' })
      })

      it('accepts dynamic cells with a NodeObject container whose children declare only allowed subset types', () => {
        const result = validateRuntimeConfig(
          createConfigWithLayout([
            {
              type: 'table',
              props: {
                headers: ['Content', 'Name'],
                rows: {
                  source: 'queries.users.data.items',
                  cells: [
                    {
                      type: 'container',
                      props: {},
                      children: [
                        { type: 'image', props: { src: 'item.avatar', alt: 'item.name' } },
                        { type: 'paragraph', props: { text: 'item.role' } },
                      ],
                    },
                    'item.name',
                  ],
                },
              },
            },
          ]),
        )

        expect(result).toMatchObject({ status: 'ready' })
      })

      it('rejects dynamic cells with a NodeObject modal with diagnostic at rows.cells[i].type', () => {
        expect(
          validateRuntimeConfig(
            createConfigWithLayout([
              {
                type: 'table',
                props: {
                  headers: ['Name', 'Cell'],
                  rows: {
                    source: 'queries.users.data.items',
                    cells: [
                      'item.name',
                      { type: 'modal', id: 'my-modal', props: {} },
                    ],
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
            message: 'Page "home" has an invalid layout at "layout[0].props.rows.cells[1].type".',
          },
        })
      })

      it('rejects dynamic cells with a NodeObject input with diagnostic at rows.cells[i].type', () => {
        expect(
          validateRuntimeConfig(
            createConfigWithLayout([
              {
                type: 'table',
                props: {
                  headers: ['Name', 'Cell'],
                  rows: {
                    source: 'queries.users.data.items',
                    cells: [
                      'item.name',
                      { type: 'input', props: { fieldId: 'name', label: 'Name' } },
                    ],
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
            message: 'Page "home" has an invalid layout at "layout[0].props.rows.cells[1].type".',
          },
        })
      })

      it('rejects dynamic cells with NodeObject repeater and NodeObject table', () => {
        for (const forbiddenType of ['repeater', 'table']) {
          expect(
            validateRuntimeConfig(
              createConfigWithLayout([
                {
                  type: 'table',
                  props: {
                    headers: ['Cell'],
                    rows: {
                      source: 'queries.users.data.items',
                      cells: [{ type: forbiddenType, props: {} }],
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
              message: `Page "home" has an invalid layout at "layout[0].props.rows.cells[0].type".`,
            },
          })
        }
      })

      it('rejects dynamic cells with a NodeObject whose type is empty string or absent', () => {
        expect(
          validateRuntimeConfig(
            createConfigWithLayout([
              {
                type: 'table',
                props: {
                  headers: ['Cell'],
                  rows: {
                    source: 'queries.users.data.items',
                    cells: [{ type: '', props: {} }],
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
            message: 'Page "home" has an invalid layout at "layout[0].props.rows.cells[0].type".',
          },
        })

        expect(
          validateRuntimeConfig(
            createConfigWithLayout([
              {
                type: 'table',
                props: {
                  headers: ['Cell'],
                  rows: {
                    source: 'queries.users.data.items',
                    cells: [{ props: {} }],
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
            message: 'Page "home" has an invalid layout at "layout[0].props.rows.cells[0].type".',
          },
        })
      })

      it('rejects dynamic cells with an empty string entry (regression: current contract)', () => {
        expect(
          validateRuntimeConfig(
            createConfigWithLayout([
              {
                type: 'table',
                props: {
                  headers: ['Name', 'Cell'],
                  rows: {
                    source: 'queries.users.data.items',
                    cells: ['item.name', ''],
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
            message: 'Page "home" has an invalid layout at "layout[0].props.rows.cells[1]".',
          },
        })
      })

      it('rejects dynamic cells whose total count (strings + NodeObjects) does not match headers', () => {
        expect(
          validateRuntimeConfig(
            createConfigWithLayout([
              {
                type: 'table',
                props: {
                  headers: ['Name', 'Avatar', 'Role'],
                  rows: {
                    source: 'queries.users.data.items',
                    cells: [
                      'item.name',
                      { type: 'image', props: { src: 'item.avatar', alt: 'item.name' } },
                    ],
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
            message: 'Page "home" has an invalid layout at "layout[0].props.rows.cells": table dynamic cells must have exactly 3 entries to match headers.',
          },
        })
      })

      it('rejects dynamic cells where a container NodeObject has children outside the subset at any depth', () => {
        expect(
          validateRuntimeConfig(
            createConfigWithLayout([
              {
                type: 'table',
                props: {
                  headers: ['Cell'],
                  rows: {
                    source: 'queries.users.data.items',
                    cells: [
                      {
                        type: 'container',
                        props: {},
                        children: [
                          {
                            type: 'container',
                            props: {},
                            children: [
                              { type: 'input', props: { fieldId: 'f', label: 'F' } },
                            ],
                          },
                        ],
                      },
                    ],
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
            message: 'Page "home" has an invalid layout at "layout[0].props.rows.cells[0].children[0].children[0].type".',
          },
        })
      })
    })
  })
})
