import { describe, expect, it } from 'vitest'
import { validateRuntimeConfig } from '../../config/runtime-config'
import { createConfigWithLayout } from './helpers'

function createMapNode(overrides: Record<string, unknown> = {}) {
  return {
    type: 'map',
    ...overrides,
  }
}

describe('validateRuntimeConfig — map node: acceptance', () => {
  it('accepts a minimal map with only type and no props — normalizes to props.markers: []', () => {
    const result = validateRuntimeConfig(createConfigWithLayout([createMapNode()]))
    expect(result.status).toBe('ready')
    if (result.status === 'ready') {
      expect(result.page.layout[0]).toMatchObject({ type: 'map', props: { markers: [] } })
    }
  })

  it('accepts map with a valid props.center (lat/lng within range)', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([createMapNode({ props: { center: { lat: 42.8125, lng: -1.6458 } } })]),
    )
    expect(result.status).toBe('ready')
    if (result.status === 'ready') {
      expect(result.page.layout[0]).toMatchObject({ props: { center: { lat: 42.8125, lng: -1.6458 } } })
    }
  })

  it('accepts map with a valid props.zoom', () => {
    const result = validateRuntimeConfig(createConfigWithLayout([createMapNode({ props: { zoom: 13 } })]))
    expect(result.status).toBe('ready')
  })

  it.each(['sm', 'md', 'lg', 'xl'])('accepts map with props.height: "%s"', (height) => {
    const result = validateRuntimeConfig(createConfigWithLayout([createMapNode({ props: { height } })]))
    expect(result.status).toBe('ready')
  })

  it('accepts map with a valid props.markers array', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        createMapNode({
          props: { markers: [{ lat: 40.4168, lng: -3.7038, label: 'Madrid' }] },
        }),
      ]),
    )
    expect(result.status).toBe('ready')
    if (result.status === 'ready') {
      expect(result.page.layout[0]).toMatchObject({
        props: { markers: [{ lat: 40.4168, lng: -3.7038, label: 'Madrid' }] },
      })
    }
  })

  it('accepts map with props.markers explicitly declared as an empty array', () => {
    const result = validateRuntimeConfig(createConfigWithLayout([createMapNode({ props: { markers: [] } })]))
    expect(result.status).toBe('ready')
    if (result.status === 'ready') {
      expect(result.page.layout[0]).toMatchObject({ props: { markers: [] } })
    }
  })

  it('accepts map with a valid props.markerSources array', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        createMapNode({
          props: {
            markerSources: [
              {
                source: 'queries.posts.data',
                position: { lat: 'coords.lat', lng: 'coords.lng' },
                label: 'name',
              },
            ],
          },
        }),
      ]),
    )
    expect(result.status).toBe('ready')
    if (result.status === 'ready') {
      expect(result.page.layout[0]).toMatchObject({
        props: {
          markerSources: [
            {
              source: 'queries.posts.data',
              position: { lat: 'coords.lat', lng: 'coords.lng' },
              label: 'name',
            },
          ],
        },
      })
      const node = result.page.layout[0] as { props: { markers?: unknown } }
      expect(node.props.markers).toBeUndefined()
    }
  })

  it('accepts markerSources[i].label as a relative item path', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        createMapNode({
          props: {
            markerSources: [
              {
                source: 'queries.posts.data',
                position: { lat: 'coords.lat', lng: 'coords.lng' },
                label: 'name',
              },
            ],
          },
        }),
      ]),
    )
    expect(result.status).toBe('ready')
  })

  it('accepts markerSources[i].label as a partial interpolation', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        createMapNode({
          props: {
            markerSources: [
              {
                source: 'queries.posts.data',
                position: { lat: 'coords.lat', lng: 'coords.lng' },
                label: '{{item.name}} ({{item.city}})',
              },
            ],
          },
        }),
      ]),
    )
    expect(result.status).toBe('ready')
  })

  it.each(['neutral', 'primary', 'success', 'warning', 'danger', 'info'])(
    'accepts markerSources[i].color: "%s"',
    (color) => {
      const result = validateRuntimeConfig(
        createConfigWithLayout([
          createMapNode({
            props: {
              markerSources: [
                {
                  source: 'queries.posts.data',
                  position: { lat: 'coords.lat', lng: 'coords.lng' },
                  label: 'name',
                  color,
                },
              ],
            },
          }),
        ]),
      )
      expect(result.status).toBe('ready')
    },
  )

  it('accepts map with visibility, queryStateFeedback and layout.span declared', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        createMapNode({
          visibility: { reference: 'queries.q.status', operator: 'equals', value: 'success' },
          queryStateFeedback: { query: 'q' },
          layout: { span: 6 },
        }),
      ]),
    )
    expect(result.status).toBe('ready')
  })
})

describe('validateRuntimeConfig — map node: rejection', () => {
  it('rejects map with props.center.lat out of range [-90, 90] — error contains props.center.lat', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([createMapNode({ props: { center: { lat: 91, lng: 0 } } })]),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('props.center.lat')
    }
  })

  it('rejects map with props.center.lng out of range [-180, 180] — error contains props.center.lng', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([createMapNode({ props: { center: { lat: 0, lng: -181 } } })]),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('props.center.lng')
    }
  })

  it.each([1.5, -1, 20])('rejects map with an invalid props.zoom (%s) — error contains props.zoom', (zoom) => {
    const result = validateRuntimeConfig(createConfigWithLayout([createMapNode({ props: { zoom } })]))
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('props.zoom')
    }
  })

  it('rejects map with props.height outside the catalog — error contains props.height', () => {
    const result = validateRuntimeConfig(createConfigWithLayout([createMapNode({ props: { height: 'huge' } })]))
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('props.height')
    }
  })

  it('rejects map with props.markers[i].lat out of range — error contains the exact index path', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        createMapNode({ props: { markers: [{ lat: 190, lng: 0, label: 'Fuera de rango' }] } }),
      ]),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('props.markers[0].lat')
    }
  })

  it('rejects map with props.markers[i].lng out of range — error contains the exact index path', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        createMapNode({ props: { markers: [{ lat: 0, lng: -190, label: 'Fuera de rango' }] } }),
      ]),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('props.markers[0].lng')
    }
  })

  it('rejects map with markerSources[i].source outside the queries.{queryName}.data pattern', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        createMapNode({
          props: {
            markerSources: [
              {
                source: 'queries.posts.status',
                position: { lat: 'coords.lat', lng: 'coords.lng' },
                label: 'name',
              },
            ],
          },
        }),
      ]),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('props.markerSources[0].source')
    }
  })

  it.each(['', 'queries.*', 'item.*', 'coords..lat'])(
    'rejects markerSources[i].position.lat when it is not a valid relative path (%s)',
    (lat) => {
      const result = validateRuntimeConfig(
        createConfigWithLayout([
          createMapNode({
            props: {
              markerSources: [
                {
                  source: 'queries.posts.data',
                  position: { lat, lng: 'coords.lng' },
                  label: 'name',
                },
              ],
            },
          }),
        ]),
      )
      expect(result.status).toBe('error')
      if (result.status === 'error') {
        expect(result.error.message).toContain('props.markerSources[0].position.lat')
      }
    },
  )

  it.each(['', 'queries.*', 'item.*', 'coords..lng'])(
    'rejects markerSources[i].position.lng when it is not a valid relative path (%s)',
    (lng) => {
      const result = validateRuntimeConfig(
        createConfigWithLayout([
          createMapNode({
            props: {
              markerSources: [
                {
                  source: 'queries.posts.data',
                  position: { lat: 'coords.lat', lng },
                  label: 'name',
                },
              ],
            },
          }),
        ]),
      )
      expect(result.status).toBe('error')
      if (result.status === 'error') {
        expect(result.error.message).toContain('props.markerSources[0].position.lng')
      }
    },
  )

  it('rejects markerSources[i].label when it is neither a relative path nor an interpolation', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        createMapNode({
          props: {
            markerSources: [
              {
                source: 'queries.posts.data',
                position: { lat: 'coords.lat', lng: 'coords.lng' },
                label: 'na me',
              },
            ],
          },
        }),
      ]),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('props.markerSources[0].label')
    }
  })

  it('rejects markerSources[i].color outside the six-color catalog', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        createMapNode({
          props: {
            markerSources: [
              {
                source: 'queries.posts.data',
                position: { lat: 'coords.lat', lng: 'coords.lng' },
                label: 'name',
                color: 'purple',
              },
            ],
          },
        }),
      ]),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('props.markerSources[0].color')
    }
  })

  it('accepts a map that declares both props.markers and props.markerSources at the same time, with markerSources taking precedence', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        createMapNode({
          props: {
            markers: [{ lat: 0, lng: 0, label: 'Origen' }],
            markerSources: [
              {
                source: 'queries.posts.data',
                position: { lat: 'coords.lat', lng: 'coords.lng' },
                label: 'name',
              },
            ],
          },
        }),
      ]),
    )
    expect(result.status).toBe('ready')
    if (result.status === 'ready') {
      const mapNode = result.page.layout[0] as { props?: { markers?: unknown; markerSources?: unknown } }
      expect(mapNode.props?.markers).toBeUndefined()
      expect(mapNode.props?.markerSources).toEqual([
        {
          source: 'queries.posts.data',
          position: { lat: 'coords.lat', lng: 'coords.lng' },
          label: 'name',
          color: undefined,
        },
      ])
    }
  })

  it('rejects a map node that declares children — leaf nodes cannot declare children', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        createMapNode({ children: [{ type: 'paragraph', props: { text: 'ignored' } }] }),
      ]),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('.children')
    }
  })

  it('rejects map with an invalid visibility operator — error follows the shared visibility contract', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        createMapNode({ visibility: { reference: 'queries.q.status', operator: 'notAnOperator' } }),
      ]),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('visibility')
    }
  })

  it('rejects map with an unsupported queryStateFeedback state key — error follows the shared qsf contract', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        createMapNode({ queryStateFeedback: { query: 'q', states: { notAState: { mode: 'show' } } } }),
      ]),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('queryStateFeedback.states.notAState')
    }
  })
})
