import { describe, expect, it } from 'vitest'
import { validateRuntimeConfig } from '../../config/runtime-config'
import { createConfigWithLayout } from './helpers'

function createGalleryNode(overrides: Record<string, unknown> = {}) {
  return {
    type: 'gallery',
    ...overrides,
  }
}

const paginatedDisplay = { mode: 'paginated', pagination: { pageSize: 4 } }
const carouselDisplay = { mode: 'carousel', visibleCount: 2 }

describe('validateRuntimeConfig — gallery node: acceptance', () => {
  it('accepts a static gallery (images) with paginated display', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        createGalleryNode({
          props: {
            images: [{ src: 'https://example.com/1.jpg', alt: 'Photo 1' }],
            display: paginatedDisplay,
          },
        }),
      ]),
    )
    expect(result.status).toBe('ready')
    if (result.status === 'ready') {
      expect(result.page.layout[0]).toMatchObject({
        type: 'gallery',
        props: {
          images: [{ src: 'https://example.com/1.jpg', alt: 'Photo 1' }],
          display: { mode: 'paginated', pagination: { pageSize: 4 } },
        },
      })
    }
  })

  it('accepts a dynamic gallery (source, queries.*) in mode src', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        createGalleryNode({
          props: {
            source: { source: 'queries.photos.data', key: 'id', alt: 'name', mode: 'src', src: 'url' },
            display: carouselDisplay,
          },
        }),
      ]),
    )
    expect(result.status).toBe('ready')
    if (result.status === 'ready') {
      expect(result.page.layout[0]).toMatchObject({
        props: {
          source: { source: 'queries.photos.data', key: 'id', alt: 'name', mode: 'src', src: 'url' },
        },
      })
    }
  })

  it('accepts a dynamic gallery (source, queries.*) in mode fetch', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        createGalleryNode({
          props: {
            source: {
              source: 'queries.photos.data',
              key: 'id',
              alt: 'name',
              mode: 'fetch',
              fetch: { url: 'https://api.example.com/photos' },
            },
            display: carouselDisplay,
          },
        }),
      ]),
    )
    expect(result.status).toBe('ready')
    if (result.status === 'ready') {
      expect(result.page.layout[0]).toMatchObject({
        props: {
          source: {
            source: 'queries.photos.data',
            key: 'id',
            alt: 'name',
            mode: 'fetch',
            fetch: { url: 'https://api.example.com/photos' },
          },
        },
      })
    }
  })

  it('accepts a dynamic gallery (source, item.*) — syntactically valid via allowItemReference', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        createGalleryNode({
          props: {
            source: { source: 'item.photos', key: 'id', alt: 'name', mode: 'src', src: 'url' },
            display: paginatedDisplay,
          },
        }),
      ]),
    )
    expect(result.status).toBe('ready')
  })

  it.each(['$key', '$index', 'id'])('accepts source.key: "%s"', (key) => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        createGalleryNode({
          props: {
            source: { source: 'queries.photos.data', key, alt: 'name', mode: 'src', src: 'url' },
            display: paginatedDisplay,
          },
        }),
      ]),
    )
    expect(result.status).toBe('ready')
  })

  it.each([1, 2, 3])('accepts carousel display with visibleCount: %i', (visibleCount) => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        createGalleryNode({
          props: {
            images: [{ src: 'https://example.com/1.jpg', alt: 'Photo 1' }],
            display: { mode: 'carousel', visibleCount },
          },
        }),
      ]),
    )
    expect(result.status).toBe('ready')
  })

  it('accepts carousel display without autoplay/loop declared', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        createGalleryNode({
          props: {
            images: [{ src: 'https://example.com/1.jpg', alt: 'Photo 1' }],
            display: { mode: 'carousel', visibleCount: 2 },
          },
        }),
      ]),
    )
    expect(result.status).toBe('ready')
  })

  it('accepts carousel display with autoplay and loop declared', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        createGalleryNode({
          props: {
            images: [{ src: 'https://example.com/1.jpg', alt: 'Photo 1' }],
            display: { mode: 'carousel', visibleCount: 2, autoplay: { enabled: true, intervalMs: 3000 }, loop: true },
          },
        }),
      ]),
    )
    expect(result.status).toBe('ready')
  })

  it('accepts source.idField as a valid relative path when mode: "fetch"', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        createGalleryNode({
          props: {
            source: {
              source: 'queries.photos.data',
              key: 'id',
              alt: 'name',
              mode: 'fetch',
              fetch: { url: 'https://api.example.com/photos' },
              idField: 'id',
            },
            display: paginatedDisplay,
          },
        }),
      ]),
    )
    expect(result.status).toBe('ready')
    if (result.status === 'ready') {
      expect(result.page.layout[0]).toMatchObject({
        props: { source: { mode: 'fetch', idField: 'id' } },
      })
    }
  })

  it('accepts mode: "fetch" without source.idField declared', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        createGalleryNode({
          props: {
            source: {
              source: 'queries.photos.data',
              key: 'id',
              alt: 'name',
              mode: 'fetch',
              fetch: { url: 'https://api.example.com/photos' },
            },
            display: paginatedDisplay,
          },
        }),
      ]),
    )
    expect(result.status).toBe('ready')
  })

  it('accepts gallery with visibility, queryStateFeedback and layout.span declared', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        createGalleryNode({
          props: { images: [{ src: 'https://example.com/1.jpg', alt: 'Photo 1' }], display: paginatedDisplay },
          visibility: { reference: 'queries.q.status', operator: 'equals', value: 'success' },
          queryStateFeedback: { query: 'q' },
          layout: { span: 6 },
        }),
      ]),
    )
    expect(result.status).toBe('ready')
  })
})

describe('validateRuntimeConfig — gallery node: rejection', () => {
  it('rejects a gallery that declares both images and source', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        createGalleryNode({
          props: {
            images: [{ src: 'https://example.com/1.jpg', alt: 'Photo 1' }],
            source: { source: 'queries.photos.data', key: 'id', alt: 'name', mode: 'src', src: 'url' },
            display: paginatedDisplay,
          },
        }),
      ]),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('props')
    }
  })

  it('rejects a gallery that declares neither images nor source', () => {
    const result = validateRuntimeConfig(createConfigWithLayout([createGalleryNode({ props: { display: paginatedDisplay } })]))
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('props')
    }
  })

  it('rejects source.mode: "src" with source.fetch declared', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        createGalleryNode({
          props: {
            source: {
              source: 'queries.photos.data',
              key: 'id',
              alt: 'name',
              mode: 'src',
              src: 'url',
              fetch: { url: 'https://api.example.com/photos' },
            },
            display: paginatedDisplay,
          },
        }),
      ]),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('props.source.fetch')
    }
  })

  it('rejects source.mode: "src" without source.src', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        createGalleryNode({
          props: {
            source: { source: 'queries.photos.data', key: 'id', alt: 'name', mode: 'src' },
            display: paginatedDisplay,
          },
        }),
      ]),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('props.source.src')
    }
  })

  it('rejects source.mode: "fetch" with source.src declared', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        createGalleryNode({
          props: {
            source: {
              source: 'queries.photos.data',
              key: 'id',
              alt: 'name',
              mode: 'fetch',
              src: 'url',
              fetch: { url: 'https://api.example.com/photos' },
            },
            display: paginatedDisplay,
          },
        }),
      ]),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('props.source.src')
    }
  })

  it('rejects source.mode: "fetch" without source.fetch', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        createGalleryNode({
          props: {
            source: { source: 'queries.photos.data', key: 'id', alt: 'name', mode: 'fetch' },
            display: paginatedDisplay,
          },
        }),
      ]),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('props.source.fetch')
    }
  })

  it('rejects an empty source.key', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        createGalleryNode({
          props: {
            source: { source: 'queries.photos.data', key: '', alt: 'name', mode: 'src', src: 'url' },
            display: paginatedDisplay,
          },
        }),
      ]),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('props.source.key')
    }
  })

  it.each(['item.foo', 'queries.foo'])('rejects source.key with a reserved prefix (%s)', (key) => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        createGalleryNode({
          props: {
            source: { source: 'queries.photos.data', key, alt: 'name', mode: 'src', src: 'url' },
            display: paginatedDisplay,
          },
        }),
      ]),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('props.source.key')
    }
  })

  it('rejects a malformed source.key ("$index.algo")', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        createGalleryNode({
          props: {
            source: { source: 'queries.photos.data', key: '$index.algo', alt: 'name', mode: 'src', src: 'url' },
            display: paginatedDisplay,
          },
        }),
      ]),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('props.source.key')
    }
  })

  it('rejects source.alt when it is neither a relative path nor an interpolation', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        createGalleryNode({
          props: {
            source: { source: 'queries.photos.data', key: 'id', alt: 'na me', mode: 'src', src: 'url' },
            display: paginatedDisplay,
          },
        }),
      ]),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('props.source.alt')
    }
  })

  it('rejects source.src when it is neither a relative path nor an interpolation', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        createGalleryNode({
          props: {
            source: { source: 'queries.photos.data', key: 'id', alt: 'name', mode: 'src', src: 'in valid' },
            display: paginatedDisplay,
          },
        }),
      ]),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('props.source.src')
    }
  })

  it('rejects source.idField when it is neither a relative path nor an interpolation', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        createGalleryNode({
          props: {
            source: {
              source: 'queries.photos.data',
              key: 'id',
              alt: 'name',
              mode: 'fetch',
              fetch: { url: 'https://api.example.com/photos' },
              idField: 'id field',
            },
            display: paginatedDisplay,
          },
        }),
      ]),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('props.source.idField')
    }
  })

  it('rejects source.idField declared when mode: "src"', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        createGalleryNode({
          props: {
            source: {
              source: 'queries.photos.data',
              key: 'id',
              alt: 'name',
              mode: 'src',
              src: 'url',
              idField: 'id',
            },
            display: paginatedDisplay,
          },
        }),
      ]),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('props.source.idField')
    }
  })

  it('rejects a gallery without display', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        createGalleryNode({ props: { images: [{ src: 'https://example.com/1.jpg', alt: 'Photo 1' }] } }),
      ]),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('props.display')
    }
  })

  it('rejects a gallery with display.mode outside paginated/carousel', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        createGalleryNode({
          props: {
            images: [{ src: 'https://example.com/1.jpg', alt: 'Photo 1' }],
            display: { mode: 'slideshow' },
          },
        }),
      ]),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('props.display')
    }
  })

  it('rejects paginated display.pagination without pageSize', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        createGalleryNode({
          props: {
            images: [{ src: 'https://example.com/1.jpg', alt: 'Photo 1' }],
            display: { mode: 'paginated', pagination: {} },
          },
        }),
      ]),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('props.display.pagination.pageSize')
    }
  })

  it.each([0, -1, 1.5])('rejects paginated display.pagination.pageSize when invalid (%s)', (pageSize) => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        createGalleryNode({
          props: {
            images: [{ src: 'https://example.com/1.jpg', alt: 'Photo 1' }],
            display: { mode: 'paginated', pagination: { pageSize } },
          },
        }),
      ]),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('props.display.pagination.pageSize')
    }
  })

  it('rejects paginated display.pagination.controls.variant outside the catalog', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        createGalleryNode({
          props: {
            images: [{ src: 'https://example.com/1.jpg', alt: 'Photo 1' }],
            display: { mode: 'paginated', pagination: { pageSize: 4, controls: { variant: 'notAVariant' } } },
          },
        }),
      ]),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('props.display.pagination.controls.variant')
    }
  })

  it('rejects extra keys in display.pagination', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        createGalleryNode({
          props: {
            images: [{ src: 'https://example.com/1.jpg', alt: 'Photo 1' }],
            display: { mode: 'paginated', pagination: { pageSize: 4, extra: true } },
          },
        }),
      ]),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('props.display.pagination')
    }
  })

  it('rejects extra keys in display.pagination.controls', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        createGalleryNode({
          props: {
            images: [{ src: 'https://example.com/1.jpg', alt: 'Photo 1' }],
            display: { mode: 'paginated', pagination: { pageSize: 4, controls: { variant: 'numbered', extra: true } } },
          },
        }),
      ]),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('props.display.pagination.controls')
    }
  })

  it('rejects display.pagination.enabled — not part of the gallery contract unlike repeater', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        createGalleryNode({
          props: {
            images: [{ src: 'https://example.com/1.jpg', alt: 'Photo 1' }],
            display: { mode: 'paginated', pagination: { pageSize: 4, enabled: true } },
          },
        }),
      ]),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('props.display.pagination')
    }
  })

  it.each([0, 4, 1.5])('rejects carousel display.visibleCount outside [1,3] or non-integer (%s)', (visibleCount) => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        createGalleryNode({
          props: {
            images: [{ src: 'https://example.com/1.jpg', alt: 'Photo 1' }],
            display: { mode: 'carousel', visibleCount },
          },
        }),
      ]),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('props.display.visibleCount')
    }
  })

  it('rejects carousel display without visibleCount', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        createGalleryNode({
          props: {
            images: [{ src: 'https://example.com/1.jpg', alt: 'Photo 1' }],
            display: { mode: 'carousel' },
          },
        }),
      ]),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('props.display.visibleCount')
    }
  })

  it('rejects carousel display.autoplay.intervalMs when not positive', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        createGalleryNode({
          props: {
            images: [{ src: 'https://example.com/1.jpg', alt: 'Photo 1' }],
            display: { mode: 'carousel', visibleCount: 2, autoplay: { enabled: true, intervalMs: 0 } },
          },
        }),
      ]),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('props.display.autoplay.intervalMs')
    }
  })

  it('rejects a gallery node that declares children — leaf nodes cannot declare children', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        createGalleryNode({
          props: { images: [{ src: 'https://example.com/1.jpg', alt: 'Photo 1' }], display: paginatedDisplay },
          children: [{ type: 'paragraph', props: { text: 'ignored' } }],
        }),
      ]),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('.children')
    }
  })

  it('rejects gallery with an invalid visibility operator — error follows the shared visibility contract', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        createGalleryNode({
          props: { images: [{ src: 'https://example.com/1.jpg', alt: 'Photo 1' }], display: paginatedDisplay },
          visibility: { reference: 'queries.q.status', operator: 'notAnOperator' },
        }),
      ]),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('visibility')
    }
  })

  it('rejects gallery with an unsupported queryStateFeedback state key — error follows the shared qsf contract', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        createGalleryNode({
          props: { images: [{ src: 'https://example.com/1.jpg', alt: 'Photo 1' }], display: paginatedDisplay },
          queryStateFeedback: { query: 'q', states: { notAState: { mode: 'show' } } },
        }),
      ]),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('queryStateFeedback.states.notAState')
    }
  })
})
