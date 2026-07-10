import { describe, expect, it } from 'vitest'
import { validateRuntimeConfig } from '../../config/runtime-config'
import {
  createConfigWithPages,
  createConfigWithLayout,
} from './helpers'

describe('validateRuntimeConfig', () => {
  describe('container layout contract', () => {
    it('accepts the expanded container layout props and keeps direction alongside columns', () => {
      const result = validateRuntimeConfig(
        createConfigWithLayout([
          {
            type: 'container',
            layout: {
              span: 3,
            },
            props: {
              direction: 'row',
              gap: '2xl',
              columns: 4,
              variant: 'card',
              align: 'center',
              justify: 'between',
            },
            children: [
              {
                type: 'paragraph',
                props: {
                  text: 'First child',
                },
              },
            ],
          },
        ]),
      )

      expect(result.status).toBe('ready')

      if (result.status !== 'ready') {
        throw new Error('Expected ready result')
      }

      expect(result.config.pages[0].layout[0]).toMatchObject({
        type: 'container',
        layout: {
          span: 3,
        },
        props: {
          direction: 'row',
          gap: '2xl',
          columns: 4,
          variant: 'card',
          align: 'center',
          justify: 'between',
        },
        children: [
          {
            type: 'paragraph',
            props: {
              text: 'First child',
            },
          },
        ],
      })
    })

    it('accepts responsive container columns maps with supported breakpoints', () => {
      const result = validateRuntimeConfig(
        createConfigWithLayout([
          {
            type: 'container',
            props: {
              columns: {
                base: 1,
                sm: 2,
                md: 3,
                lg: 4,
                xl: 6,
                '2xl': 12,
              },
            },
            children: [
              {
                type: 'paragraph',
                props: {
                  text: 'Responsive grid',
                },
              },
            ],
          },
          {
            type: 'container',
            props: {
              columns: {
                md: 2,
                lg: 4,
              },
            },
          },
        ]),
      )

      expect(result.status).toBe('ready')

      if (result.status !== 'ready') {
        throw new Error('Expected ready result')
      }

      expect(result.config.pages[0].layout).toMatchObject([
        {
          type: 'container',
          props: {
            columns: {
              base: 1,
              sm: 2,
              md: 3,
              lg: 4,
              xl: 6,
              '2xl': 12,
            },
          },
        },
        {
          type: 'container',
          props: {
            columns: {
              md: 2,
              lg: 4,
            },
          },
        },
      ])
    })

    it('accepts arbitrary container gaps as a compatibility fallback', () => {
      const result = validateRuntimeConfig(
        createConfigWithLayout([
          {
            type: 'container',
            layout: {
              span: 2,
            },
            props: {
              gap: '18px',
              variant: 'default',
            },
            children: [
              {
                type: 'paragraph',
                props: {
                  text: 'Scoped gap fallback',
                },
              },
            ],
          },
        ]),
      )

      expect(result.status).toBe('ready')

      if (result.status !== 'ready') {
        throw new Error('Expected ready result')
      }

      expect(result.config.pages[0].layout[0]).toMatchObject({
        type: 'container',
        layout: {
          span: 2,
        },
        props: {
          gap: '18px',
          variant: 'default',
        },
        children: [
          {
            type: 'paragraph',
            props: {
              text: 'Scoped gap fallback',
            },
          },
        ],
      })
    })

    it('accepts only the supported align justify and wrap values', () => {
      const supportedProps = [
        { align: 'start' },
        { align: 'stretch' },
        { justify: 'center' },
        { justify: 'evenly' },
        { wrap: 'nowrap' },
        { wrap: 'wrap' },
        { wrap: 'wrap-reverse' },
      ]

      for (const props of supportedProps) {
        expect(
          validateRuntimeConfig(
            createConfigWithLayout([
              {
                type: 'container',
                props,
                children: [
                  {
                    type: 'paragraph',
                    props: {
                      text: 'Layout child',
                    },
                  },
                ],
              },
            ]),
          ),
        ).toMatchObject({
          status: 'ready',
        })
      }
    })

    it('rejects unsupported container columns and layout keywords with explicit prop paths', () => {
      expect(
        validateRuntimeConfig(
          createConfigWithLayout([
            {
              type: 'container',
              props: {
                columns: 0,
              },
            },
          ]),
        ),
      ).toEqual({
        status: 'error',
        error: {
          code: 'invalid-layout',
          displayMode: 'development-only',
          message: `Page "home" has an invalid layout at "layout[0].props.columns".
  → container[0]
  Node: {"type":"container"}`,
        },
      })

      expect(
        validateRuntimeConfig(
          createConfigWithLayout([
            {
              type: 'container',
              props: {
                align: 'baseline',
              },
            },
          ]),
        ),
      ).toEqual({
        status: 'error',
        error: {
          code: 'invalid-layout',
          displayMode: 'development-only',
          message: `Page "home" has an invalid layout at "layout[0].props.align".
  → container[0]
  Node: {"type":"container"}`,
        },
      })

      expect(
        validateRuntimeConfig(
          createConfigWithLayout([
            {
              type: 'container',
              props: {
                justify: 'space-between',
              },
            },
          ]),
        ),
      ).toEqual({
        status: 'error',
        error: {
          code: 'invalid-layout',
          displayMode: 'development-only',
          message: `Page "home" has an invalid layout at "layout[0].props.justify".
  → container[0]
  Node: {"type":"container"}`,
        },
      })

      expect(
        validateRuntimeConfig(
          createConfigWithLayout([
            {
              type: 'container',
              props: {
                wrap: 'balance',
              },
            },
          ]),
        ),
      ).toEqual({
        status: 'error',
        error: {
          code: 'invalid-layout',
          displayMode: 'development-only',
          message: `Page "home" has an invalid layout at "layout[0].props.wrap".
  → container[0]
  Node: {"type":"container"}`,
        },
      })
    })

    it('rejects containers that declare columns together with wrap', () => {
      expect(
        validateRuntimeConfig(
          createConfigWithLayout([
            {
              type: 'container',
              props: {
                columns: 3,
                wrap: 'wrap',
              },
            },
          ]),
        ),
      ).toEqual({
        status: 'error',
        error: {
          code: 'invalid-layout',
          displayMode: 'development-only',
          message: `Page "home" has an invalid layout at "layout[0].props.wrap": container nodes cannot declare "wrap" when "columns" is present.
  → container[0]
  Node: {"type":"container"}`,
        },
      })

      expect(
        validateRuntimeConfig(
          createConfigWithLayout([
            {
              type: 'container',
              props: {
                columns: {
                  base: 1,
                  md: 2,
                },
                wrap: 'wrap',
              },
            },
          ]),
        ),
      ).toEqual({
        status: 'error',
        error: {
          code: 'invalid-layout',
          displayMode: 'development-only',
          message: `Page "home" has an invalid layout at "layout[0].props.wrap": container nodes cannot declare "wrap" when "columns" is present.
  → container[0]
  Node: {"type":"container"}`,
        },
      })
    })

    it('keeps historical containers without the new props valid', () => {
      const result = validateRuntimeConfig(
        createConfigWithLayout([
          {
            type: 'container',
            children: [
              {
                type: 'list',
                props: {
                  items: ['One', 'Two'],
                },
              },
            ],
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
                  type: 'container',
                  children: [
                    {
                      type: 'list',
                      props: {
                        items: ['One', 'Two'],
                      },
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
              type: 'container',
              children: [
                {
                  type: 'list',
                  props: {
                    items: ['One', 'Two'],
                  },
                },
              ],
            },
          ],
        },
      })
    })

    it('accepts layout.span across leaf, composite, form and repeater nodes', () => {
      const result = validateRuntimeConfig(
        createConfigWithPages([
          {
            id: 'home',
            layout: [
              {
                type: 'heading',
                layout: {
                  span: 1,
                },
                props: {
                  text: 'Welcome',
                  level: 1,
                },
              },
              {
                type: 'container',
                layout: {
                  span: 2,
                },
                children: [
                  {
                    type: 'paragraph',
                    layout: {
                      span: 3,
                    },
                    props: {
                      text: 'Body copy',
                    },
                  },
                ],
              },
              {
                type: 'form',
                id: 'profile-form',
                layout: {
                  span: 4,
                },
                children: [
                  {
                    type: 'input',
                    layout: {
                      span: 5,
                    },
                    props: {
                      fieldId: 'name',
                      label: 'Name',
                    },
                  },
                ],
              },
              {
                type: 'repeater',
                layout: {
                  span: 6,
                },
                props: {
                  items: {
                    source: 'queries.posts.data',
                    key: 'id',
                  },
                  template: [
                    {
                      type: 'container',
                      layout: {
                        span: 7,
                      },
                      children: [
                        {
                          type: 'paragraph',
                          props: {
                            text: 'item.title',
                          },
                        },
                      ],
                    },
                  ],
                },
              },
            ],
          },
        ]),
      )

      expect(result.status).toBe('ready')

      if (result.status !== 'ready') {
        throw new Error('Expected ready result')
      }

      expect(result.config.pages[0].layout).toMatchObject([
        {
          type: 'heading',
          layout: {
            span: 1,
          },
          props: {
            text: 'Welcome',
            level: 1,
          },
        },
        {
          type: 'container',
          layout: {
            span: 2,
          },
          children: [
            {
              type: 'paragraph',
              layout: {
                span: 3,
              },
              props: {
                text: 'Body copy',
              },
            },
          ],
        },
        {
          type: 'form',
          id: 'profile-form',
          layout: {
            span: 4,
          },
          children: [
            {
              type: 'input',
              layout: {
                span: 5,
              },
              props: {
                fieldId: 'name',
                label: 'Name',
              },
            },
          ],
        },
        {
          type: 'repeater',
          layout: {
            span: 6,
          },
          props: {
            items: {
              source: 'queries.posts.data',
              key: 'id',
            },
            template: [
              {
                type: 'container',
                layout: {
                  span: 7,
                },
                children: [
                  {
                    type: 'paragraph',
                    props: {
                      text: 'item.title',
                    },
                  },
                ],
              },
            ],
          },
        },
      ])
    })

    it('accepts responsive layout.span across leaf, container, form and repeater nodes', () => {
      const result = validateRuntimeConfig(
        createConfigWithPages([
          {
            id: 'home',
            layout: [
              {
                type: 'heading',
                layout: {
                  span: {
                    base: 1,
                    md: 2,
                  },
                },
                props: {
                  text: 'Welcome',
                  level: 1,
                },
              },
              {
                type: 'container',
                layout: {
                  span: {
                    lg: 3,
                  },
                },
                children: [
                  {
                    type: 'paragraph',
                    layout: {
                      span: {
                        sm: 2,
                        xl: 4,
                      },
                    },
                    props: {
                      text: 'Body copy',
                    },
                  },
                ],
              },
              {
                type: 'form',
                id: 'profile-form',
                layout: {
                  span: {
                    base: 1,
                    lg: 6,
                  },
                },
                children: [
                  {
                    type: 'input',
                    layout: {
                      span: {
                        md: 5,
                      },
                    },
                    props: {
                      fieldId: 'name',
                      label: 'Name',
                    },
                  },
                ],
              },
              {
                type: 'repeater',
                layout: {
                  span: {
                    base: 1,
                    '2xl': 8,
                  },
                },
                props: {
                  items: {
                    source: 'queries.posts.data',
                    key: 'id',
                  },
                  template: [
                    {
                      type: 'container',
                      layout: {
                        span: {
                          md: 7,
                        },
                      },
                      children: [
                        {
                          type: 'paragraph',
                          props: {
                            text: 'item.title',
                          },
                        },
                      ],
                    },
                  ],
                },
              },
            ],
          },
        ]),
      )

      expect(result.status).toBe('ready')

      if (result.status !== 'ready') {
        throw new Error('Expected ready result')
      }

      expect(result.config.pages[0].layout).toMatchObject([
        {
          type: 'heading',
          layout: {
            span: {
              base: 1,
              md: 2,
            },
          },
        },
        {
          type: 'container',
          layout: {
            span: {
              lg: 3,
            },
          },
          children: [
            {
              type: 'paragraph',
              layout: {
                span: {
                  sm: 2,
                  xl: 4,
                },
              },
            },
          ],
        },
        {
          type: 'form',
          layout: {
            span: {
              base: 1,
              lg: 6,
            },
          },
          children: [
            {
              type: 'input',
              layout: {
                span: {
                  md: 5,
                },
              },
            },
          ],
        },
        {
          type: 'repeater',
          layout: {
            span: {
              base: 1,
              '2xl': 8,
            },
          },
          props: {
            template: [
              {
                type: 'container',
                layout: {
                  span: {
                    md: 7,
                  },
                },
              },
            ],
          },
        },
      ])
    })

    it('rejects invalid container variant and layout span paths explicitly', () => {
      expect(
        validateRuntimeConfig(
          createConfigWithLayout([
            {
              type: 'container',
              props: {
                variant: 'hero',
              },
            },
          ]),
        ),
      ).toEqual({
        status: 'error',
        error: {
          code: 'invalid-layout',
          displayMode: 'development-only',
          message: `Page "home" has an invalid layout at "layout[0].props.variant".
  → container[0]
  Node: {"type":"container"}`,
        },
      })

      expect(
        validateRuntimeConfig(
          createConfigWithLayout([
            {
              type: 'container',
              layout: {
                span: 0,
              },
            },
          ]),
        ),
      ).toEqual({
        status: 'error',
        error: {
          code: 'invalid-layout',
          displayMode: 'development-only',
          message: `Page "home" has an invalid layout at "layout[0].layout.span".
  → container[0]
  Node: {"type":"container"}`,
        },
      })

      expect(
        validateRuntimeConfig(
          createConfigWithLayout([
            {
              type: 'heading',
              layout: {
                span: '2',
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
          message: `Page "home" has an invalid layout at "layout[0].layout.span".
  → heading("Welcome")
  Node: {"type":"heading","props":{"text":"Welcome"}}`,
        },
      })

      expect(
        validateRuntimeConfig(
          createConfigWithLayout([
            {
              type: 'repeater',
              layout: {
                span: 13,
              },
              props: {
                items: {
                  source: 'queries.posts.data',
                  key: 'id',
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
          message: `Page "home" has an invalid layout at "layout[0].layout.span".
  → repeater[0]
  Node: {"type":"repeater"}`,
        },
      })
    })

    it('rejects unsupported breakpoints in responsive columns and layout.span maps', () => {
      expect(
        validateRuntimeConfig(
          createConfigWithLayout([
            {
              type: 'container',
              props: {
                columns: {
                  base: 1,
                  tablet: 2,
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
          message: `Page "home" has an invalid layout at "layout[0].props.columns".
  → container[0]
  Node: {"type":"container"}`,
        },
      })

      expect(
        validateRuntimeConfig(
          createConfigWithLayout([
            {
              type: 'heading',
              layout: {
                span: {
                  mobile: 1,
                  md: 2,
                },
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
          message: `Page "home" has an invalid layout at "layout[0].layout.span".
  → heading("Welcome")
  Node: {"type":"heading","props":{"text":"Welcome"}}`,
        },
      })
    })

    it('rejects out of range and non numeric responsive column and span values', () => {
      const invalidColumnMaps = [{ base: 0 }, { base: 13 }, { base: 1.5 }, { base: '1' }]

      for (const columns of invalidColumnMaps) {
        expect(
          validateRuntimeConfig(
            createConfigWithLayout([
              {
                type: 'container',
                props: {
                  columns,
                },
              },
            ]),
          ),
        ).toEqual({
          status: 'error',
          error: {
            code: 'invalid-layout',
            displayMode: 'development-only',
            message: `Page "home" has an invalid layout at "layout[0].props.columns".
  → container[0]
  Node: {"type":"container"}`,
          },
        })
      }

      const invalidSpanMaps = [{ md: 0 }, { md: 13 }, { md: 2.5 }, { md: '2' }]

      for (const span of invalidSpanMaps) {
        expect(
          validateRuntimeConfig(
            createConfigWithLayout([
              {
                type: 'heading',
                layout: {
                  span,
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
            message: `Page "home" has an invalid layout at "layout[0].layout.span".
  → heading("Welcome")
  Node: {"type":"heading","props":{"text":"Welcome"}}`,
          },
        })
      }
    })
  })
})
