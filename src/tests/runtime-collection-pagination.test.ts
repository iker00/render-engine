import { describe, expect, it, vi } from 'vitest'
import { createCollectionPaginationModel } from '../runtime/runtime-collection-pagination'

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
