import { describe, expect, it, vi } from 'vitest'
import {
  createCollectionPaginationModel,
  createCollectionScrollWindow,
  createNumberedPaginationWindow,
} from '../../runtime/runtime-collection-pagination'

describe('createCollectionPaginationModel', () => {
  it('derives empty pagination state without navigable pages', () => {
    const model = createCollectionPaginationModel([], 2)
    const page = model.getPage(1)

    expect(page).toEqual({
      totalItems: 0,
      totalPages: 0,
      currentPage: 0,
      canGoPrevious: false,
      canGoNext: false,
      visibleItems: [],
    })
  })

  it('derives a single page when the collection is smaller than pageSize', () => {
    const items = ['one', 'two']
    const model = createCollectionPaginationModel(items, 5)

    expect(model.getPage(1)).toEqual({
      totalItems: 2,
      totalPages: 1,
      currentPage: 1,
      canGoPrevious: false,
      canGoNext: false,
      visibleItems: ['one', 'two'],
    })
  })

  it('keeps original order across exact and partial pages', () => {
    const model = createCollectionPaginationModel(['one', 'two', 'three', 'four', 'five'], 2)

    expect(model.getPage(1).visibleItems).toEqual(['one', 'two'])
    expect(model.getPage(2)).toMatchObject({
      currentPage: 2,
      totalPages: 3,
      canGoPrevious: true,
      canGoNext: true,
      visibleItems: ['three', 'four'],
    })
    expect(model.getPage(3)).toMatchObject({
      currentPage: 3,
      totalPages: 3,
      canGoPrevious: true,
      canGoNext: false,
      visibleItems: ['five'],
    })
  })

  it('normalizes out-of-range pages to a valid visible page', () => {
    const model = createCollectionPaginationModel(['one', 'two', 'three'], 2)

    expect(model.getPage(-3)).toMatchObject({
      currentPage: 1,
      visibleItems: ['one', 'two'],
    })
    expect(model.getPage(99)).toMatchObject({
      currentPage: 2,
      visibleItems: ['three'],
    })
  })

  it('materializes page slices once for a model and reuses them across page reads', () => {
    const model = createCollectionPaginationModel(['one', 'two', 'three', 'four'], 2)
    const firstRead = model.getPage(2)
    const secondRead = model.getPage(2)

    expect(secondRead.visibleItems).toBe(firstRead.visibleItems)
    expect(model.getPage(1).visibleItems).toEqual(['one', 'two'])
  })

  it('does not recut the collection when reading different pages from the same model', () => {
    const model = createCollectionPaginationModel(['one', 'two', 'three', 'four'], 2)
    const sliceSpy = vi.spyOn(Array.prototype, 'slice')

    expect(model.getPage(1).visibleItems).toEqual(['one', 'two'])
    expect(model.getPage(2).visibleItems).toEqual(['three', 'four'])
    expect(model.getPage(1).visibleItems).toEqual(['one', 'two'])
    expect(sliceSpy).not.toHaveBeenCalled()

    sliceSpy.mockRestore()
  })

  it('does not mutate the collection origin', () => {
    const items = ['one', 'two', 'three']
    const model = createCollectionPaginationModel(items, 2)

    expect(model.getPage(1).visibleItems).toEqual(['one', 'two'])
    expect(items).toEqual(['one', 'two', 'three'])
  })
})

describe('createNumberedPaginationWindow', () => {
  it('returns every page when the total fits the compact window', () => {
    expect(createNumberedPaginationWindow({ currentPage: 1, totalPages: 0 })).toEqual([])
    expect(createNumberedPaginationWindow({ currentPage: 1, totalPages: 1 })).toEqual([1])
    expect(createNumberedPaginationWindow({ currentPage: 3, totalPages: 5 })).toEqual([1, 2, 3, 4, 5])
  })

  it('returns a five-page window centered on the current page when possible', () => {
    expect(createNumberedPaginationWindow({ currentPage: 6, totalPages: 12 })).toEqual([4, 5, 6, 7, 8])
  })

  it('clamps the five-page window near the start and end', () => {
    expect(createNumberedPaginationWindow({ currentPage: 1, totalPages: 12 })).toEqual([1, 2, 3, 4, 5])
    expect(createNumberedPaginationWindow({ currentPage: 2, totalPages: 12 })).toEqual([1, 2, 3, 4, 5])
    expect(createNumberedPaginationWindow({ currentPage: 11, totalPages: 12 })).toEqual([8, 9, 10, 11, 12])
    expect(createNumberedPaginationWindow({ currentPage: 12, totalPages: 12 })).toEqual([8, 9, 10, 11, 12])
  })

  it('normalizes requested pages outside the valid range before deriving the window', () => {
    expect(createNumberedPaginationWindow({ currentPage: Number.NaN, totalPages: 8 })).toEqual([1, 2, 3, 4, 5])
    expect(createNumberedPaginationWindow({ currentPage: -3, totalPages: 8 })).toEqual([1, 2, 3, 4, 5])
    expect(createNumberedPaginationWindow({ currentPage: 99, totalPages: 8 })).toEqual([4, 5, 6, 7, 8])
  })
})

describe('createCollectionScrollWindow', () => {
  it('derives the initial local scroll window from pageSize', () => {
    expect(createCollectionScrollWindow(['one', 'two', 'three', 'four', 'five'], 2, 2)).toEqual({
      totalItems: 5,
      pageSize: 2,
      visibleCount: 2,
      canShowMore: true,
      visibleItems: ['one', 'two'],
    })
  })

  it('derives accumulated increments by pageSize and clamps to the collection total', () => {
    const items = ['one', 'two', 'three', 'four', 'five']

    expect(createCollectionScrollWindow(items, 2, 4)).toMatchObject({
      visibleCount: 4,
      canShowMore: true,
      visibleItems: ['one', 'two', 'three', 'four'],
    })
    expect(createCollectionScrollWindow(items, 2, 6)).toMatchObject({
      visibleCount: 5,
      canShowMore: false,
      visibleItems: ['one', 'two', 'three', 'four', 'five'],
    })
  })

  it('returns zero visible items for empty collections', () => {
    expect(createCollectionScrollWindow([], 2, 2)).toEqual({
      totalItems: 0,
      pageSize: 2,
      visibleCount: 0,
      canShowMore: false,
      visibleItems: [],
    })
  })

  it('normalizes requested visible counts below pageSize to the first block', () => {
    expect(createCollectionScrollWindow(['one', 'two', 'three'], 2, -1)).toMatchObject({
      visibleCount: 2,
      visibleItems: ['one', 'two'],
    })
  })

  it('does not mutate the collection origin when deriving scroll windows', () => {
    const items = ['one', 'two', 'three']

    expect(createCollectionScrollWindow(items, 2, 4).visibleItems).toEqual(['one', 'two', 'three'])
    expect(items).toEqual(['one', 'two', 'three'])
  })
})
