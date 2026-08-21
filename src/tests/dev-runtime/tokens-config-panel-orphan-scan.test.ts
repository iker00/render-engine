import { describe, expect, it } from 'vitest'
import type { RuntimeConfig } from '../../config/runtime-config-types'
import { scanOrphanTokenHeaderReferences } from '../../dev-runtime/tokens-config-panel/scan-orphan-token-header-references'

function buildConfig(overrides: Partial<RuntimeConfig> = {}): RuntimeConfig {
  return {
    api: {},
    initialPage: 'home',
    pages: [
      {
        id: 'home',
        layout: [],
      },
    ],
    ...overrides,
  }
}

describe('scanOrphanTokenHeaderReferences', () => {
  it('returns totalCount 0 and empty sources when there are no references anywhere', () => {
    const config = buildConfig()

    const result = scanOrphanTokenHeaderReferences(config, 'sessionToken')

    expect(result).toEqual({ totalCount: 0, sources: [] })
  })

  it('detects a reference inside a header of api.{op}.headers as substring of a wider template', () => {
    const config = buildConfig({
      api: {
        fetchUser: {
          method: 'GET',
          endpoint: '/user',
          headers: {
            Authorization: 'Bearer {{tokens.sessionToken.value}}',
          },
        },
      },
    })

    const result = scanOrphanTokenHeaderReferences(config, 'sessionToken')

    expect(result).toEqual({
      totalCount: 1,
      sources: [{ label: 'en la operación «fetchUser»', count: 1 }],
    })
  })

  it('detects a reference in button.props.action.headers nested in the layout of a page', () => {
    const config = buildConfig({
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'button',
              props: {
                label: 'Ir',
                action: {
                  type: 'executeOperation',
                  operationName: 'save',
                  headers: {
                    'X-Token': '{{tokens.sessionToken.value}}',
                  },
                },
              },
            },
          ],
        },
      ],
    })

    const result = scanOrphanTokenHeaderReferences(config, 'sessionToken')

    expect(result).toEqual({
      totalCount: 1,
      sources: [{ label: 'en la página «home»', count: 1 }],
    })
  })

  it('detects a reference in form.submitAction.headers nested in the layout of a page', () => {
    const config = buildConfig({
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'form',
              id: 'my-form',
              submitAction: {
                type: 'executeOperation',
                operationName: 'save',
                headers: {
                  'X-Token': '{{tokens.sessionToken.value}}',
                },
              },
            },
          ],
        },
      ],
    })

    const result = scanOrphanTokenHeaderReferences(config, 'sessionToken')

    expect(result).toEqual({
      totalCount: 1,
      sources: [{ label: 'en la página «home»', count: 1 }],
    })
  })

  it('detects a reference in executeOperations[].headers nested in onSuccess/onError', () => {
    const config = buildConfig({
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'form',
              id: 'my-form',
              submitAction: { type: 'executeOperation', operationName: 'save' },
              onSuccess: [
                {
                  type: 'executeOperation',
                  operationName: 'refresh',
                  headers: {
                    'X-Token': '{{tokens.sessionToken.value}}',
                  },
                },
              ],
              onError: [
                {
                  type: 'executeOperation',
                  operationName: 'log',
                  headers: {
                    'X-Token': '{{tokens.sessionToken.value}}',
                  },
                },
              ],
            },
          ],
        },
      ],
    })

    const result = scanOrphanTokenHeaderReferences(config, 'sessionToken')

    expect(result).toEqual({
      totalCount: 2,
      sources: [{ label: 'en la página «home»', count: 2 }],
    })
  })

  it('detects a reference in preloads[].headers in global preloads and in page preloads with correct labels', () => {
    const config = buildConfig({
      preloads: [
        {
          operationName: 'fetchUser',
          requestParams: {
            headers: {
              Authorization: 'Bearer {{tokens.sessionToken.value}}',
            },
          },
        },
      ],
      pages: [
        {
          id: 'home',
          layout: [],
          preloads: [
            {
              operationName: 'fetchDetails',
              requestParams: {
                headers: {
                  Authorization: 'Bearer {{tokens.sessionToken.value}}',
                },
              },
            },
          ],
        },
      ],
    })

    const result = scanOrphanTokenHeaderReferences(config, 'sessionToken')

    expect(result).toEqual({
      totalCount: 2,
      sources: [
        { label: 'en las precargas globales', count: 1 },
        { label: 'en las precargas de la página «home»', count: 1 },
      ],
    })
  })

  it('counts multiple references within the same source summed into a single sources entry', () => {
    const config = buildConfig({
      api: {
        fetchUser: {
          method: 'GET',
          endpoint: '/user',
          headers: {
            Authorization: 'Bearer {{tokens.sessionToken.value}}',
            'X-Extra': 'also {{tokens.sessionToken.value}}',
          },
        },
      },
    })

    const result = scanOrphanTokenHeaderReferences(config, 'sessionToken')

    expect(result).toEqual({
      totalCount: 2,
      sources: [{ label: 'en la operación «fetchUser»', count: 2 }],
    })
  })

  it('does not count a reference to tokens.otherId.value when searching a different tokenId', () => {
    const config = buildConfig({
      api: {
        fetchUser: {
          method: 'GET',
          endpoint: '/user',
          headers: {
            Authorization: 'Bearer {{tokens.a.value}}',
          },
        },
      },
    })

    const result = scanOrphanTokenHeaderReferences(config, 'ab')

    expect(result).toEqual({ totalCount: 0, sources: [] })
  })

  it('does not throw when a headers row has a non-string value', () => {
    const config = buildConfig({
      api: {
        fetchUser: {
          method: 'GET',
          endpoint: '/user',
          headers: {
            'X-Count': 42 as unknown as string,
            'X-Enabled': true as unknown as string,
            'X-Nothing': null as unknown as string,
          },
        },
      },
    })

    expect(() => scanOrphanTokenHeaderReferences(config, 'sessionToken')).not.toThrow()
    const result = scanOrphanTokenHeaderReferences(config, 'sessionToken')
    expect(result).toEqual({ totalCount: 0, sources: [] })
  })

  it('does not throw when config.preloads or a page preloads are undefined', () => {
    const config = buildConfig()
    expect(config.preloads).toBeUndefined()
    expect(config.pages[0].preloads).toBeUndefined()

    expect(() => scanOrphanTokenHeaderReferences(config, 'sessionToken')).not.toThrow()
    const result = scanOrphanTokenHeaderReferences(config, 'sessionToken')
    expect(result).toEqual({ totalCount: 0, sources: [] })
  })

  it('orders sources as operations, then pages, then global preloads, then page preloads', () => {
    const config = buildConfig({
      api: {
        opB: {
          method: 'GET',
          endpoint: '/b',
          headers: { Authorization: '{{tokens.sessionToken.value}}' },
        },
        opA: {
          method: 'GET',
          endpoint: '/a',
          headers: { Authorization: '{{tokens.sessionToken.value}}' },
        },
      },
      preloads: [
        {
          operationName: 'opB',
          requestParams: { headers: { Authorization: '{{tokens.sessionToken.value}}' } },
        },
      ],
      pages: [
        {
          id: 'page-b',
          layout: [
            {
              type: 'button',
              props: {
                label: 'B',
                action: {
                  type: 'executeOperation',
                  operationName: 'opB',
                  headers: { Authorization: '{{tokens.sessionToken.value}}' },
                },
              },
            },
          ],
          preloads: [
            {
              operationName: 'opB',
              requestParams: { headers: { Authorization: '{{tokens.sessionToken.value}}' } },
            },
          ],
        },
        {
          id: 'page-a',
          layout: [
            {
              type: 'button',
              props: {
                label: 'A',
                action: {
                  type: 'executeOperation',
                  operationName: 'opA',
                  headers: { Authorization: '{{tokens.sessionToken.value}}' },
                },
              },
            },
          ],
          preloads: [
            {
              operationName: 'opA',
              requestParams: { headers: { Authorization: '{{tokens.sessionToken.value}}' } },
            },
          ],
        },
      ],
    })

    const result = scanOrphanTokenHeaderReferences(config, 'sessionToken')

    expect(result).toEqual({
      totalCount: 7,
      sources: [
        { label: 'en la operación «opB»', count: 1 },
        { label: 'en la operación «opA»', count: 1 },
        { label: 'en la página «page-b»', count: 1 },
        { label: 'en la página «page-a»', count: 1 },
        { label: 'en las precargas globales', count: 1 },
        { label: 'en las precargas de la página «page-b»', count: 1 },
        { label: 'en las precargas de la página «page-a»', count: 1 },
      ],
    })
  })
})
