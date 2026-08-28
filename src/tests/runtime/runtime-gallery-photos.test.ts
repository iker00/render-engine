import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resolveGalleryPhotos } from '../../runtime/runtime-gallery-photos'
import type { GalleryLayoutNode } from '../../config/runtime-config'
import type { RuntimeState } from '../../runtime/runtime-state/runtime-state-types'

const paginatedDisplay: GalleryLayoutNode['props']['display'] = {
  mode: 'paginated',
  pagination: { pageSize: 6 },
}

const runtimeState: RuntimeState = {
  navigation: {
    currentPageId: 'home',
    history: [{ entryId: 0, pageId: 'home', params: {} }],
    lastError: null,
  },
  forms: {},
  queries: {
    photos: {
      status: 'success',
      data: [
        { id: 'p1', title: 'Sunset', image: { url: 'https://cdn.test/sunset.jpg' } },
        { id: 'p2', title: 'Mountain', image: { url: 'https://cdn.test/mountain.jpg' } },
      ],
      error: null,
    },
    photosWithGaps: {
      status: 'success',
      data: [
        { id: 'p1', title: 'Sunset', image: { url: 'https://cdn.test/sunset.jpg' } },
        { id: 'p2', title: 'No source' },
        { id: 'p3', title: 'Mountain', image: { url: 'https://cdn.test/mountain.jpg' } },
      ],
      error: null,
    },
    photosDuplicateKeys: {
      status: 'success',
      data: [
        { id: 'dup', title: 'First' },
        { id: 'dup', title: 'Second' },
        { id: 'unique', title: 'Third' },
      ],
      error: null,
    },
    photosMissingIds: {
      status: 'success',
      data: [
        { id: 'p1', title: 'Sunset' },
        { title: 'No id' },
      ],
      error: null,
    },
    emptyPhotos: {
      status: 'success',
      data: [],
      error: null,
    },
    idlePhotos: {
      status: 'idle',
      data: null,
      error: null,
    },
    scalarPhotos: {
      status: 'success',
      data: 'not-a-collection',
      error: null,
    },
  },
  pageEntry: {
    entryId: 0,
    pageId: 'home',
    params: {},
    preloadNames: [],
    status: 'idle',
  },
}

describe('resolveGalleryPhotos', () => {
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  })

  afterEach(() => {
    consoleWarnSpy.mockRestore()
  })

  describe('static source (props.images)', () => {
    it('resolves one entry per image with src and alt', () => {
      const node: GalleryLayoutNode = {
        type: 'gallery',
        props: {
          images: [
            { src: 'https://cdn.test/a.jpg', alt: 'Photo A' },
            { src: 'https://cdn.test/b.jpg', alt: 'Photo B' },
          ],
          display: paginatedDisplay,
        },
      }

      expect(resolveGalleryPhotos(node, runtimeState)).toEqual([
        { key: '0', alt: 'Photo A', source: { mode: 'src', src: 'https://cdn.test/a.jpg' } },
        { key: '1', alt: 'Photo B', source: { mode: 'src', src: 'https://cdn.test/b.jpg' } },
      ])
    })

    it('omits an entry whose src does not resolve to a non-empty string', () => {
      const node: GalleryLayoutNode = {
        type: 'gallery',
        props: {
          images: [
            { src: '', alt: 'Empty source' },
            { src: 'https://cdn.test/b.jpg', alt: 'Photo B' },
          ],
          display: paginatedDisplay,
        },
      }

      expect(resolveGalleryPhotos(node, runtimeState)).toEqual([
        { key: '1', alt: 'Photo B', source: { mode: 'src', src: 'https://cdn.test/b.jpg' } },
      ])
    })

    it('resolves an empty [] images array to an empty list', () => {
      const node: GalleryLayoutNode = {
        type: 'gallery',
        props: { images: [], display: paginatedDisplay },
      }

      expect(resolveGalleryPhotos(node, runtimeState)).toEqual([])
    })
  })

  describe('dynamic source, mode src', () => {
    it('resolves key/alt/src for each item of queries.{q}.data', () => {
      const node: GalleryLayoutNode = {
        type: 'gallery',
        props: {
          source: { source: 'queries.photos.data', key: 'id', alt: 'title', mode: 'src', src: 'image.url' },
          display: paginatedDisplay,
        },
      }

      expect(resolveGalleryPhotos(node, runtimeState)).toEqual([
        { key: 'p1', alt: 'Sunset', source: { mode: 'src', src: 'https://cdn.test/sunset.jpg' } },
        { key: 'p2', alt: 'Mountain', source: { mode: 'src', src: 'https://cdn.test/mountain.jpg' } },
      ])
    })

    it('omits entries whose src path does not resolve to a non-empty string and keeps the rest', () => {
      const node: GalleryLayoutNode = {
        type: 'gallery',
        props: {
          source: { source: 'queries.photosWithGaps.data', key: 'id', alt: 'title', mode: 'src', src: 'image.url' },
          display: paginatedDisplay,
        },
      }

      expect(resolveGalleryPhotos(node, runtimeState)).toEqual([
        { key: 'p1', alt: 'Sunset', source: { mode: 'src', src: 'https://cdn.test/sunset.jpg' } },
        { key: 'p3', alt: 'Mountain', source: { mode: 'src', src: 'https://cdn.test/mountain.jpg' } },
      ])
    })
  })

  describe('dynamic source, mode fetch', () => {
    it('produces one entry per item with a valid key without omitting by fetch result', () => {
      const node: GalleryLayoutNode = {
        type: 'gallery',
        props: {
          source: {
            source: 'queries.photos.data',
            key: 'id',
            alt: 'title',
            mode: 'fetch',
            fetch: { url: '/photos/{{item.id}}' },
            idField: 'id',
          },
          display: paginatedDisplay,
        },
      }

      expect(resolveGalleryPhotos(node, runtimeState)).toEqual([
        {
          key: 'p1',
          alt: 'Sunset',
          source: {
            mode: 'fetch',
            fetch: { url: '/photos/{{item.id}}' },
            iterationContext: { item: runtimeState.queries.photos.data[0], key: 'p1', itemIndex: 0 },
          },
        },
        {
          key: 'p2',
          alt: 'Mountain',
          source: {
            mode: 'fetch',
            fetch: { url: '/photos/{{item.id}}' },
            iterationContext: { item: runtimeState.queries.photos.data[1], key: 'p2', itemIndex: 1 },
          },
        },
      ])
    })
  })

  describe('dynamic source, mode fetch, source.idField contract (FR7)', () => {
    it('omits an entry whose idField does not resolve, without affecting entries where it does', () => {
      const node: GalleryLayoutNode = {
        type: 'gallery',
        props: {
          source: {
            source: 'queries.photosMissingIds.data',
            key: '$index',
            alt: 'title',
            mode: 'fetch',
            fetch: { url: '/photos/{{item.id}}' },
            idField: 'id',
          },
          display: paginatedDisplay,
        },
      }

      const result = resolveGalleryPhotos(node, runtimeState)
      expect(result.map((photo) => photo.key)).toEqual(['0'])
    })

    it('omits an entry whose idField resolves to an empty string or a non-scalar value', () => {
      const node: GalleryLayoutNode = {
        type: 'gallery',
        props: {
          source: {
            source: 'item.photos',
            key: '$index',
            alt: 'title',
            mode: 'fetch',
            fetch: { url: '/photos/{{item.id}}' },
            idField: 'id',
          },
          display: paginatedDisplay,
        },
      }

      const result = resolveGalleryPhotos(node, runtimeState, {
        iterationContext: {
          item: {
            photos: [
              { id: '', title: 'Empty id' },
              { id: { nested: true }, title: 'Non scalar id' },
              { id: 'valid-id', title: 'Valid id' },
            ],
          },
          key: '0',
          itemIndex: 0,
        },
      })

      expect(result.map((photo) => photo.key)).toEqual(['2'])
    })

    it('produces an entry for a primitive item (string/number) when idField is not declared', () => {
      const node: GalleryLayoutNode = {
        type: 'gallery',
        props: {
          source: {
            source: 'item.photoIds',
            key: '$index',
            alt: 'title',
            mode: 'fetch',
            fetch: { url: '/photos/{{item}}' },
          },
          display: paginatedDisplay,
        },
      }

      const result = resolveGalleryPhotos(node, runtimeState, {
        iterationContext: { item: { photoIds: ['p1', 42] }, key: '0', itemIndex: 0 },
      })

      expect(result.map((photo) => photo.key)).toEqual(['0', '1'])
    })

    it('regression: omits an entry whose item is an object when idField is not declared', () => {
      const node: GalleryLayoutNode = {
        type: 'gallery',
        props: {
          source: {
            source: 'queries.photos.data',
            key: 'id',
            alt: 'title',
            mode: 'fetch',
            fetch: { url: '/photos/{{item.id}}' },
          },
          display: paginatedDisplay,
        },
      }

      expect(resolveGalleryPhotos(node, runtimeState)).toEqual([])
    })
  })

  describe('source.key contract', () => {
    it('"$index" uses the iteration index as key regardless of item shape', () => {
      const node: GalleryLayoutNode = {
        type: 'gallery',
        props: {
          source: { source: 'queries.photos.data', key: '$index', alt: 'title', mode: 'src', src: 'image.url' },
          display: paginatedDisplay,
        },
      }

      const result = resolveGalleryPhotos(node, runtimeState)
      expect(result.map((photo) => photo.key)).toEqual(['0', '1'])
    })

    it('"$key" always omits every iteration because the source is always an array', () => {
      const node: GalleryLayoutNode = {
        type: 'gallery',
        props: {
          source: { source: 'queries.photos.data', key: '$key', alt: 'title', mode: 'src', src: 'image.url' },
          display: paginatedDisplay,
        },
      }

      expect(resolveGalleryPhotos(node, runtimeState)).toEqual([])
    })

    it('a relative path resolves against the item and omits entries where it is missing', () => {
      const node: GalleryLayoutNode = {
        type: 'gallery',
        props: {
          source: { source: 'queries.photosMissingIds.data', key: 'id', alt: 'title', mode: 'src', src: 'title' },
          display: paginatedDisplay,
        },
      }

      const result = resolveGalleryPhotos(node, runtimeState)
      expect(result).toEqual([{ key: 'p1', alt: 'Sunset', source: { mode: 'src', src: 'Sunset' } }])
    })

    it('omits an item whose relative-path key duplicates a previously resolved key', () => {
      const node: GalleryLayoutNode = {
        type: 'gallery',
        props: {
          source: { source: 'queries.photosDuplicateKeys.data', key: 'id', alt: 'title', mode: 'src', src: 'title' },
          display: paginatedDisplay,
        },
      }

      const result = resolveGalleryPhotos(node, runtimeState)
      expect(result).toEqual([
        { key: 'dup', alt: 'First', source: { mode: 'src', src: 'First' } },
        { key: 'unique', alt: 'Third', source: { mode: 'src', src: 'Third' } },
      ])
    })
  })

  describe('item.* iteration context', () => {
    it('resolves an alt interpolated with item.* when inside a simulated iteration context', () => {
      const node: GalleryLayoutNode = {
        type: 'gallery',
        props: {
          source: { source: 'item.albums', key: '$index', alt: '{{item.label}}', mode: 'src', src: 'url' },
          display: paginatedDisplay,
        },
      }

      const result = resolveGalleryPhotos(node, runtimeState, {
        iterationContext: {
          item: { albums: [{ label: 'Trip', url: 'https://cdn.test/trip.jpg' }] },
          key: '0',
          itemIndex: 0,
        },
      })

      expect(result).toEqual([{ key: '0', alt: 'Trip', source: { mode: 'src', src: 'https://cdn.test/trip.jpg' } }])
    })

    it('degrades to zero photos when item.* is used outside any iteration context', () => {
      const node: GalleryLayoutNode = {
        type: 'gallery',
        props: {
          source: { source: 'item.albums', key: '$index', alt: '{{item.label}}', mode: 'src', src: 'url' },
          display: paginatedDisplay,
        },
      }

      expect(resolveGalleryPhotos(node, runtimeState)).toEqual([])
    })
  })

  describe('alt resolution strategy', () => {
    it('resolves {{...}} interpolation against item.* rather than treating it as a relative path', () => {
      const node: GalleryLayoutNode = {
        type: 'gallery',
        props: {
          source: {
            source: 'queries.photos.data',
            key: 'id',
            alt: '{{item.title}} ({{item.id}})',
            mode: 'src',
            src: 'image.url',
          },
          display: paginatedDisplay,
        },
      }

      const result = resolveGalleryPhotos(node, runtimeState)
      expect(result.map((photo) => photo.alt)).toEqual(['Sunset (p1)', 'Mountain (p2)'])
    })

    it('navigates a plain relative path directly against the item without treating it as a global reference', () => {
      const node: GalleryLayoutNode = {
        type: 'gallery',
        props: {
          source: { source: 'queries.photos.data', key: 'id', alt: 'title', mode: 'src', src: 'image.url' },
          display: paginatedDisplay,
        },
      }

      const result = resolveGalleryPhotos(node, runtimeState)
      expect(result.map((photo) => photo.alt)).toEqual(['Sunset', 'Mountain'])
    })
  })

  describe('empty and not-yet-executed queries', () => {
    it('resolves to an empty list when the query resolves to an empty array', () => {
      const node: GalleryLayoutNode = {
        type: 'gallery',
        props: {
          source: { source: 'queries.emptyPhotos.data', key: 'id', alt: 'title', mode: 'src', src: 'image.url' },
          display: paginatedDisplay,
        },
      }

      expect(resolveGalleryPhotos(node, runtimeState)).toEqual([])
    })

    it('resolves to an empty list without error when the query has not executed yet', () => {
      const node: GalleryLayoutNode = {
        type: 'gallery',
        props: {
          source: { source: 'queries.idlePhotos.data', key: 'id', alt: 'title', mode: 'src', src: 'image.url' },
          display: paginatedDisplay,
        },
      }

      expect(resolveGalleryPhotos(node, runtimeState)).toEqual([])
    })

    it('resolves to an empty list without error when the source resolves to a non-collection value', () => {
      const node: GalleryLayoutNode = {
        type: 'gallery',
        props: {
          source: { source: 'queries.scalarPhotos.data', key: 'id', alt: 'title', mode: 'src', src: 'image.url' },
          display: paginatedDisplay,
        },
      }

      expect(resolveGalleryPhotos(node, runtimeState)).toEqual([])
    })
  })
})
