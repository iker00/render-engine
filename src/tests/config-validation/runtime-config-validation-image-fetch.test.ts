import { describe, expect, it } from 'vitest'
import { validateRuntimeConfig } from '../../config/runtime-config'
import {
  createConfigWithLayout,
  createRepeaterNode,
  createVisibilityRule,
} from './helpers'

describe('validateRuntimeConfig', () => {
  describe('image node with fetch block validation', () => {
    it('accepts a fetch image node with literal url and literal alt', () => {
      const result = validateRuntimeConfig(
        createConfigWithLayout([
          {
            type: 'image',
            props: {
              fetch: {
                url: '/media/hero.png',
              },
              alt: 'Hero image',
            },
          },
        ]),
      )

      expect(result).toMatchObject({
        status: 'ready',
        page: {
          layout: [
            {
              type: 'image',
              props: {
                fetch: {
                  url: '/media/hero.png',
                },
                alt: 'Hero image',
              },
            },
          ],
        },
      })
    })

    it('accepts a fetch image node with a full reference as url', () => {
      const result = validateRuntimeConfig(
        createConfigWithLayout([
          {
            type: 'image',
            props: {
              fetch: {
                url: 'queries.heroImage.data.url',
              },
              alt: 'Hero',
            },
          },
        ]),
      )

      expect(result).toMatchObject({
        status: 'ready',
        page: {
          layout: [
            {
              type: 'image',
              props: {
                fetch: {
                  url: 'queries.heroImage.data.url',
                },
                alt: 'Hero',
              },
            },
          ],
        },
      })
    })

    it('accepts a fetch image node with a partial interpolation in url', () => {
      const result = validateRuntimeConfig(
        createConfigWithLayout([
          {
            type: 'image',
            props: {
              fetch: {
                url: '/media/{{item.id}}.png',
              },
              alt: 'Item image',
            },
          },
        ]),
      )

      expect(result).toMatchObject({
        status: 'ready',
        page: {
          layout: [
            {
              type: 'image',
              props: {
                fetch: {
                  url: '/media/{{item.id}}.png',
                },
                alt: 'Item image',
              },
            },
          ],
        },
      })
    })

    it('accepts a fetch image node with method, headers, and body; the result preserves those fields', () => {
      const result = validateRuntimeConfig(
        createConfigWithLayout([
          {
            type: 'image',
            props: {
              fetch: {
                url: '/media/secure.png',
                method: 'POST',
                headers: { authorization: 'queries.token.data' },
                body: { id: 'item.id' },
              },
              alt: 'Secure image',
            },
          },
        ]),
      )

      expect(result).toMatchObject({
        status: 'ready',
        page: {
          layout: [
            {
              type: 'image',
              props: {
                fetch: {
                  url: '/media/secure.png',
                  method: 'POST',
                  headers: { authorization: 'queries.token.data' },
                  body: { id: 'item.id' },
                },
                alt: 'Secure image',
              },
            },
          ],
        },
      })
    })

    it('accepts a fetch image node without method; the validated object does not add a method key', () => {
      const result = validateRuntimeConfig(
        createConfigWithLayout([
          {
            type: 'image',
            props: {
              fetch: {
                url: '/media/hero.png',
              },
              alt: 'Hero',
            },
          },
        ]),
      )

      expect(result.status).toBe('ready')

      if (result.status === 'ready') {
        const node = result.page.layout[0] as { type: string; props: Record<string, unknown> }
        expect(node.props.fetch).not.toHaveProperty('method')
      }
    })

    it('accepts the existing src+alt contract; behavior unchanged by this feature', () => {
      const result = validateRuntimeConfig(
        createConfigWithLayout([
          {
            type: 'image',
            props: {
              src: '/hero.png',
              alt: 'Hero',
            },
          },
        ]),
      )

      expect(result).toMatchObject({
        status: 'ready',
        page: {
          layout: [
            {
              type: 'image',
              props: {
                src: '/hero.png',
                alt: 'Hero',
              },
            },
          ],
        },
      })
    })

    it('accepts queryStateFeedback and visibility on a fetch image node', () => {
      const result = validateRuntimeConfig(
        createConfigWithLayout([
          {
            type: 'image',
            queryStateFeedback: {
              query: 'heroImage',
            },
            visibility: createVisibilityRule(),
            props: {
              fetch: {
                url: '/media/hero.png',
              },
              alt: 'Hero',
            },
          },
        ]),
      )

      expect(result).toMatchObject({
        status: 'ready',
        page: {
          layout: [
            {
              type: 'image',
              queryStateFeedback: {
                query: 'heroImage',
              },
              visibility: createVisibilityRule(),
              props: {
                fetch: {
                  url: '/media/hero.png',
                },
                alt: 'Hero',
              },
            },
          ],
        },
      })
    })

    it('rejects a fetch image node that also declares src; the error path points to props', () => {
      const result = validateRuntimeConfig(
        createConfigWithLayout([
          {
            type: 'image',
            props: {
              src: '/hero.png',
              fetch: {
                url: '/media/hero.png',
              },
              alt: 'Hero',
            },
          },
        ]),
      )

      expect(result.status).toBe('error')

      if (result.status === 'error') {
        expect(result.error.code).toBe('invalid-layout')
        expect(result.error.message).toContain('layout[0].props')
      }
    })

    it('rejects a fetch image node without fetch.url; the error path points to fetch.url or props.fetch', () => {
      const result = validateRuntimeConfig(
        createConfigWithLayout([
          {
            type: 'image',
            props: {
              fetch: {},
              alt: 'Hero',
            },
          },
        ]),
      )

      expect(result.status).toBe('error')

      if (result.status === 'error') {
        expect(result.error.code).toBe('invalid-layout')
        expect(result.error.message).toContain('layout[0]')
      }
    })

    it('rejects an image node without src or fetch (pre-existing behavior extended to new shape)', () => {
      const result = validateRuntimeConfig(
        createConfigWithLayout([
          {
            type: 'image',
            props: {
              alt: 'Missing both',
            },
          },
        ]),
      )

      expect(result.status).toBe('error')

      if (result.status === 'error') {
        expect(result.error.code).toBe('invalid-layout')
        expect(result.error.message).toContain('layout[0]')
      }
    })

    it('rejects a fetch image node with an empty fetch.url string', () => {
      const result = validateRuntimeConfig(
        createConfigWithLayout([
          {
            type: 'image',
            props: {
              fetch: {
                url: '',
              },
              alt: 'Hero',
            },
          },
        ]),
      )

      expect(result.status).toBe('error')

      if (result.status === 'error') {
        expect(result.error.code).toBe('invalid-layout')
        expect(result.error.message).toContain('layout[0]')
      }
    })

    it('rejects a fetch image node with an unsupported method value', () => {
      const result = validateRuntimeConfig(
        createConfigWithLayout([
          {
            type: 'image',
            props: {
              fetch: {
                url: '/media/hero.png',
                method: 'OPTIONS',
              },
              alt: 'Hero',
            },
          },
        ]),
      )

      expect(result.status).toBe('error')

      if (result.status === 'error') {
        expect(result.error.code).toBe('invalid-layout')
        expect(result.error.message).toContain('layout[0]')
      }
    })

    it('rejects a fetch image node with a non-string header value', () => {
      const result = validateRuntimeConfig(
        createConfigWithLayout([
          {
            type: 'image',
            props: {
              fetch: {
                url: '/media/hero.png',
                headers: { authorization: 123 },
              },
              alt: 'Hero',
            },
          },
        ]),
      )

      expect(result.status).toBe('error')

      if (result.status === 'error') {
        expect(result.error.code).toBe('invalid-layout')
        expect(result.error.message).toContain('layout[0]')
      }
    })

    it('rejects a fetch image node without alt (alt remains mandatory)', () => {
      const result = validateRuntimeConfig(
        createConfigWithLayout([
          {
            type: 'image',
            props: {
              fetch: {
                url: '/media/hero.png',
              },
            },
          },
        ]),
      )

      expect(result.status).toBe('error')

      if (result.status === 'error') {
        expect(result.error.code).toBe('invalid-layout')
        expect(result.error.message).toContain('layout[0]')
      }
    })

    it('strips extra keys inside props.fetch without invalidating the config', () => {
      const result = validateRuntimeConfig(
        createConfigWithLayout([
          {
            type: 'image',
            props: {
              fetch: {
                url: '/media/hero.png',
                unknownKey: 'should be stripped',
              },
              alt: 'Hero',
            },
          },
        ]),
      )

      expect(result.status).toBe('ready')

      if (result.status === 'ready') {
        const node = result.page.layout[0] as { type: string; props: Record<string, unknown> }
        const fetchProp = node.props.fetch as Record<string, unknown>
        expect(fetchProp).not.toHaveProperty('unknownKey')
        expect(fetchProp.url).toBe('/media/hero.png')
      }
    })

    it('accepts a fetch image node inside a repeater template and preserves the expected shape', () => {
      const result = validateRuntimeConfig(
        createConfigWithLayout([
          createRepeaterNode({
            props: {
              items: {
                source: 'queries.images.data',
                key: 'id',
              },
              template: [
                {
                  type: 'image',
                  props: {
                    fetch: {
                      url: '/media/{{item.id}}.png',
                    },
                    alt: 'item.name',
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
                template: [
                  {
                    type: 'image',
                    props: {
                      fetch: {
                        url: '/media/{{item.id}}.png',
                      },
                      alt: 'item.name',
                    },
                  },
                ],
              },
            },
          ],
        },
      })
    })
  })
})
