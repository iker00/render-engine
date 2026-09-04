import { describe, expect, it } from 'vitest'
import { evaluateCollectionPipeline } from '../../runtime/runtime-references/runtime-collection-pipeline'
import type { CollectionPipelineStage } from '../../config/runtime-collection-pipeline-syntax'
import type { RuntimeState } from '../../runtime/runtime-state/runtime-state-types'

function buildState(overrides: Partial<RuntimeState> = {}): RuntimeState {
  return {
    navigation: {
      currentPageId: 'home',
      history: [{ entryId: 0, pageId: 'home', params: {} }],
      lastError: null,
    },
    forms: {},
    queries: {},
    pageEntry: {
      entryId: 0,
      pageId: 'home',
      params: {},
      preloadNames: [],
      status: 'idle',
    },
    ...overrides,
  } as RuntimeState
}

describe('evaluateCollectionPipeline', () => {
  it('returns the same array reference when stages is empty', () => {
    const items = [{ id: 'a' }, { id: 'b' }]
    const result = evaluateCollectionPipeline(items, [], buildState())
    expect(result).toBe(items)
  })

  it('returns an empty array defensively for null or undefined input', () => {
    const state = buildState()
    expect(evaluateCollectionPipeline(null as unknown as unknown[], [], state)).toEqual([])
    expect(evaluateCollectionPipeline(undefined as unknown as unknown[], [], state)).toEqual([])
  })

  describe('orderby', () => {
    it('sorts numeric field ascending', () => {
      const items = [
        { id: 'a', price: 30 },
        { id: 'b', price: 10 },
        { id: 'c', price: 20 },
      ]
      const stages: CollectionPipelineStage[] = [{ op: 'orderby', path: 'price', dir: 'asc' }]
      const result = evaluateCollectionPipeline(items, stages, buildState())
      expect(result.map((item) => (item as { id: string }).id)).toEqual(['b', 'c', 'a'])
    })

    it('sorts numeric field descending', () => {
      const items = [
        { id: 'a', price: 30 },
        { id: 'b', price: 10 },
        { id: 'c', price: 20 },
      ]
      const stages: CollectionPipelineStage[] = [{ op: 'orderby', path: 'price', dir: 'desc' }]
      const result = evaluateCollectionPipeline(items, stages, buildState())
      expect(result.map((item) => (item as { id: string }).id)).toEqual(['a', 'c', 'b'])
    })

    it('navigates nested path segments', () => {
      const items = [
        { id: 'a', nested: { field: 3 } },
        { id: 'b', nested: { field: 1 } },
      ]
      const stages: CollectionPipelineStage[] = [{ op: 'orderby', path: 'nested.field', dir: 'asc' }]
      const result = evaluateCollectionPipeline(items, stages, buildState())
      expect(result.map((item) => (item as { id: string }).id)).toEqual(['b', 'a'])
    })

    it('treats missing field as minimum value, first in asc and last in desc, preserving relative order', () => {
      const items = [
        { id: 'a', x: 1 },
        { id: 'b' },
        { id: 'c', x: 2 },
        { id: 'd' },
      ]
      const ascStages: CollectionPipelineStage[] = [{ op: 'orderby', path: 'x', dir: 'asc' }]
      const ascResult = evaluateCollectionPipeline(items, ascStages, buildState())
      expect(ascResult.map((item) => (item as { id: string }).id)).toEqual(['b', 'd', 'a', 'c'])

      const descStages: CollectionPipelineStage[] = [{ op: 'orderby', path: 'x', dir: 'desc' }]
      const descResult = evaluateCollectionPipeline(items, descStages, buildState())
      expect(descResult.map((item) => (item as { id: string }).id)).toEqual(['c', 'a', 'b', 'd'])
    })

    it('treats an incompatible field type as minimum value, same as missing', () => {
      const items = [
        { id: 'a', x: 5 },
        { id: 'b', x: true },
        { id: 'c', x: 1 },
      ]
      const stages: CollectionPipelineStage[] = [{ op: 'orderby', path: 'x', dir: 'asc' }]
      const result = evaluateCollectionPipeline(items, stages, buildState())
      expect(result.map((item) => (item as { id: string }).id)).toEqual(['b', 'c', 'a'])
    })

    it('chains orderby stages as multi-key sort: last stage is primary, earlier stages are tiebreakers', () => {
      const items = [
        { id: 1, a: 'x', b: 5 },
        { id: 2, a: 'y', b: 5 },
        { id: 3, a: 'x', b: 10 },
        { id: 4, a: 'y', b: 10 },
      ]
      const stages: CollectionPipelineStage[] = [
        { op: 'orderby', path: 'a', dir: 'asc' },
        { op: 'orderby', path: 'b', dir: 'desc' },
      ]
      const result = evaluateCollectionPipeline(items, stages, buildState())
      expect(result.map((item) => (item as { id: number }).id)).toEqual([3, 4, 1, 2])
    })
  })

  describe('filter', () => {
    it('filters by eq with a string literal', () => {
      const items = [
        { id: 'a', status: 'pending' },
        { id: 'b', status: 'active' },
        { id: 'c', status: 'pending' },
      ]
      const stages: CollectionPipelineStage[] = [
        { op: 'filter', path: 'status', operator: 'eq', value: { kind: 'literal', value: 'pending' } },
      ]
      const result = evaluateCollectionPipeline(items, stages, buildState())
      expect(result.map((item) => (item as { id: string }).id)).toEqual(['a', 'c'])
    })

    it('filters by ne, lt and lte', () => {
      const items = [
        { id: 'a', status: 'pending', price: 5 },
        { id: 'b', status: 'active', price: 10 },
        { id: 'c', status: 'active', price: 15 },
      ]

      const neResult = evaluateCollectionPipeline(
        items,
        [{ op: 'filter', path: 'status', operator: 'ne', value: { kind: 'literal', value: 'pending' } }],
        buildState(),
      )
      expect(neResult.map((item) => (item as { id: string }).id)).toEqual(['b', 'c'])

      const ltResult = evaluateCollectionPipeline(
        items,
        [{ op: 'filter', path: 'price', operator: 'lt', value: { kind: 'literal', value: 10 } }],
        buildState(),
      )
      expect(ltResult.map((item) => (item as { id: string }).id)).toEqual(['a'])

      const lteResult = evaluateCollectionPipeline(
        items,
        [{ op: 'filter', path: 'price', operator: 'lte', value: { kind: 'literal', value: 10 } }],
        buildState(),
      )
      expect(lteResult.map((item) => (item as { id: string }).id)).toEqual(['a', 'b'])
    })

    it('filters by gt numerically and excludes non-numeric fields without throwing', () => {
      const items = [
        { id: 'a', price: 15 },
        { id: 'b', price: 5 },
        { id: 'c', price: 'oops' },
      ]
      const stages: CollectionPipelineStage[] = [
        { op: 'filter', path: 'price', operator: 'gt', value: { kind: 'literal', value: 10 } },
      ]
      expect(() => evaluateCollectionPipeline(items, stages, buildState())).not.toThrow()
      const result = evaluateCollectionPipeline(items, stages, buildState())
      expect(result.map((item) => (item as { id: string }).id)).toEqual(['a'])
    })

    it('matches contains on a string case- and tilde-insensitively via normalizeTableSearchText', () => {
      const items = [
        { id: 'a', name: 'Álvaro' },
        { id: 'b', name: 'alba' },
        { id: 'c', name: 'ALBERTO' },
        { id: 'd', name: 'Roberto' },
      ]
      const stages: CollectionPipelineStage[] = [
        { op: 'filter', path: 'name', operator: 'contains', value: { kind: 'literal', value: 'al' } },
      ]
      const result = evaluateCollectionPipeline(items, stages, buildState())
      expect(result.map((item) => (item as { id: string }).id)).toEqual(['a', 'b', 'c'])
    })

    it('matches contains on an array field by strict equality against elements', () => {
      const items = [
        { id: 'a', tags: ['sports', 'news'] },
        { id: 'b', tags: ['weather'] },
        { id: 'c', tags: ['news', 'local'] },
      ]
      const stages: CollectionPipelineStage[] = [
        { op: 'filter', path: 'tags', operator: 'contains', value: { kind: 'literal', value: 'news' } },
      ]
      const result = evaluateCollectionPipeline(items, stages, buildState())
      expect(result.map((item) => (item as { id: string }).id)).toEqual(['a', 'c'])
    })

    it('filters by in with a list-literal set', () => {
      const items = [
        { id: 'a', role: 'admin' },
        { id: 'b', role: 'viewer' },
        { id: 'c', role: 'editor' },
      ]
      const stages: CollectionPipelineStage[] = [
        { op: 'filter', path: 'role', operator: 'in', value: { kind: 'list-literal', values: ['admin', 'editor'] } },
      ]
      const result = evaluateCollectionPipeline(items, stages, buildState())
      expect(result.map((item) => (item as { id: string }).id)).toEqual(['a', 'c'])
    })

    it('filters by in with a list-reference resolved from state', () => {
      const items = [
        { id: 'a', role: 'admin' },
        { id: 'b', role: 'viewer' },
      ]
      const state = buildState({
        forms: { filters: { selectedRoles: { value: ['admin'], error: null, touched: false, dirty: false } } },
      })
      const stages: CollectionPipelineStage[] = [
        {
          op: 'filter',
          path: 'role',
          operator: 'in',
          value: { kind: 'list-reference', reference: 'forms.filters.selectedRoles' },
        },
      ]
      const result = evaluateCollectionPipeline(items, stages, state)
      expect(result.map((item) => (item as { id: string }).id)).toEqual(['a'])
    })

    it('treats an unresolved or non-array list-reference as an empty set, excluding all items', () => {
      const items = [
        { id: 'a', role: 'admin' },
        { id: 'b', role: 'viewer' },
      ]
      const stageUnresolved: CollectionPipelineStage[] = [
        {
          op: 'filter',
          path: 'role',
          operator: 'in',
          value: { kind: 'list-reference', reference: 'forms.filters.selectedRoles' },
        },
      ]
      const unresolvedResult = evaluateCollectionPipeline(items, stageUnresolved, buildState())
      expect(unresolvedResult).toEqual([])

      const nonArrayState = buildState({
        forms: { filters: { selectedRoles: { value: 'admin', error: null, touched: false, dirty: false } } },
      })
      const nonArrayResult = evaluateCollectionPipeline(items, stageUnresolved, nonArrayState)
      expect(nonArrayResult).toEqual([])
    })

    it('treats a scalar literal as a single-candidate set for in', () => {
      const items = [
        { id: 'a', role: 'admin' },
        { id: 'b', role: 'viewer' },
      ]
      const stages: CollectionPipelineStage[] = [
        { op: 'filter', path: 'role', operator: 'in', value: { kind: 'literal', value: 'admin' } },
      ]
      const result = evaluateCollectionPipeline(items, stages, buildState())
      expect(result.map((item) => (item as { id: string }).id)).toEqual(['a'])
    })

    it('does not apply the filter when the dynamic reference value is absent (empty string, undefined or unresolved)', () => {
      const items = [
        { id: 'a', status: 'pending' },
        { id: 'b', status: 'active' },
      ]
      const stages: CollectionPipelineStage[] = [
        { op: 'filter', path: 'status', operator: 'eq', value: { kind: 'reference', reference: 'forms.searchForm.status' } },
      ]

      const emptyStringState = buildState({
        forms: { searchForm: { status: { value: '', error: null, touched: false, dirty: false } } },
      })
      expect(evaluateCollectionPipeline(items, stages, emptyStringState).map((item) => (item as { id: string }).id)).toEqual(['a', 'b'])

      const undefinedState = buildState({
        forms: { searchForm: { status: { value: undefined, error: null, touched: false, dirty: false } } },
      })
      expect(evaluateCollectionPipeline(items, stages, undefinedState).map((item) => (item as { id: string }).id)).toEqual(['a', 'b'])

      const unresolvedState = buildState()
      expect(evaluateCollectionPipeline(items, stages, unresolvedState).map((item) => (item as { id: string }).id)).toEqual(['a', 'b'])
    })

    it('applies the filter using a resolved scalar reference value', () => {
      const items = [
        { id: 'a', status: 'pending' },
        { id: 'b', status: 'active' },
      ]
      const stages: CollectionPipelineStage[] = [
        { op: 'filter', path: 'status', operator: 'eq', value: { kind: 'reference', reference: 'forms.searchForm.status' } },
      ]
      const state = buildState({
        forms: { searchForm: { status: { value: 'pending', error: null, touched: false, dirty: false } } },
      })
      const result = evaluateCollectionPipeline(items, stages, state)
      expect(result.map((item) => (item as { id: string }).id)).toEqual(['a'])
    })

    it('does not apply the filter when the resolved scalar reference has an incompatible type', () => {
      const items = [
        { id: 'a', status: 'pending' },
        { id: 'b', status: 'active' },
      ]
      const stages: CollectionPipelineStage[] = [
        { op: 'filter', path: 'status', operator: 'eq', value: { kind: 'reference', reference: 'forms.searchForm.status' } },
      ]
      const state = buildState({
        forms: { searchForm: { status: { value: true, error: null, touched: false, dirty: false } } },
      })
      const result = evaluateCollectionPipeline(items, stages, state)
      expect(result.map((item) => (item as { id: string }).id)).toEqual(['a', 'b'])
    })

    it('treats an item.* reference value as unresolvable (blocked without iterationContext) and does not apply the filter', () => {
      const items = [
        { id: 'a', status: 'pending' },
        { id: 'b', status: 'active' },
      ]
      const stages: CollectionPipelineStage[] = [
        { op: 'filter', path: 'status', operator: 'eq', value: { kind: 'reference', reference: 'item.currentStatus' } },
      ]
      const result = evaluateCollectionPipeline(items, stages, buildState())
      expect(result.map((item) => (item as { id: string }).id)).toEqual(['a', 'b'])
    })

    it('excludes items whose path does not exist', () => {
      const items = [{ id: 'a' }, { id: 'b', missing: 'x' }]
      const stages: CollectionPipelineStage[] = [
        { op: 'filter', path: 'missing', operator: 'eq', value: { kind: 'literal', value: 'x' } },
      ]
      const result = evaluateCollectionPipeline(items, stages, buildState())
      expect(result.map((item) => (item as { id: string }).id)).toEqual(['b'])
    })

    it('combines several chained filters with AND semantics', () => {
      const items = [
        { id: 'a', status: 'pending', price: 20 },
        { id: 'b', status: 'pending', price: 5 },
        { id: 'c', status: 'active', price: 20 },
      ]
      const stages: CollectionPipelineStage[] = [
        { op: 'filter', path: 'status', operator: 'eq', value: { kind: 'literal', value: 'pending' } },
        { op: 'filter', path: 'price', operator: 'gt', value: { kind: 'literal', value: 10 } },
      ]
      const result = evaluateCollectionPipeline(items, stages, buildState())
      expect(result.map((item) => (item as { id: string }).id)).toEqual(['a'])
    })

    it('excludes an item when the numeric comparison value is not a finite number', () => {
      const items = [{ id: 'a', price: 20 }]
      const stages: CollectionPipelineStage[] = [
        { op: 'filter', path: 'price', operator: 'gt', value: { kind: 'literal', value: 'not-a-number' } },
      ]
      const result = evaluateCollectionPipeline(items, stages, buildState())
      expect(result).toEqual([])
    })

    it('excludes an item when contains targets a field that is neither a string nor an array', () => {
      const items = [{ id: 'a', tags: 42 }]
      const stages: CollectionPipelineStage[] = [
        { op: 'filter', path: 'tags', operator: 'contains', value: { kind: 'literal', value: 'news' } },
      ]
      const result = evaluateCollectionPipeline(items, stages, buildState())
      expect(result).toEqual([])
    })

    it('excludes items safely without throwing when a non-in operator is paired with a set-shaped value', () => {
      const items = [{ id: 'a', status: 'pending' }]
      const stages: CollectionPipelineStage[] = [
        { op: 'filter', path: 'status', operator: 'eq', value: { kind: 'list-literal', values: ['pending'] } },
      ]
      expect(() => evaluateCollectionPipeline(items, stages, buildState())).not.toThrow()
      const result = evaluateCollectionPipeline(items, stages, buildState())
      expect(result).toEqual([])
    })

    it('reads each item path exactly once per filter stage', () => {
      let readCount = 0
      const items = Array.from({ length: 4 }, (_, index) => {
        const item: { id: number; status?: string } = { id: index }
        Object.defineProperty(item, 'status', {
          enumerable: true,
          get() {
            readCount += 1
            return index % 2 === 0 ? 'pending' : 'active'
          },
        })
        return item
      })

      const stages: CollectionPipelineStage[] = [
        { op: 'filter', path: 'status', operator: 'eq', value: { kind: 'literal', value: 'pending' } },
      ]
      evaluateCollectionPipeline(items, stages, buildState())
      expect(readCount).toBe(items.length)
    })
  })

  describe('nested path navigation', () => {
    it('navigates a numeric segment as an array index when the current value is an array', () => {
      const items = [
        { id: 'a', scores: [10, 40] },
        { id: 'b', scores: [10, 20] },
      ]
      const stages: CollectionPipelineStage[] = [
        { op: 'filter', path: 'scores.1', operator: 'gte', value: { kind: 'literal', value: 30 } },
      ]
      const result = evaluateCollectionPipeline(items, stages, buildState())
      expect(result.map((item) => (item as { id: string }).id)).toEqual(['a'])
    })

    it('excludes an item when a segment on an array value is not a numeric index', () => {
      const items = [{ id: 'a', scores: [10, 40] }]
      const stages: CollectionPipelineStage[] = [
        { op: 'filter', path: 'scores.field', operator: 'eq', value: { kind: 'literal', value: 10 } },
      ]
      const result = evaluateCollectionPipeline(items, stages, buildState())
      expect(result).toEqual([])
    })

    it('excludes an item when a mid-path segment resolves to null before reaching the end of the path', () => {
      const items = [{ id: 'a', nested: null }]
      const stages: CollectionPipelineStage[] = [
        { op: 'filter', path: 'nested.field', operator: 'eq', value: { kind: 'literal', value: 10 } },
      ]
      const result = evaluateCollectionPipeline(items, stages, buildState())
      expect(result).toEqual([])
    })

    it('excludes an item when an array index segment is out of range', () => {
      const items = [{ id: 'a', scores: [10, 40] }]
      const stages: CollectionPipelineStage[] = [
        { op: 'filter', path: 'scores.5', operator: 'eq', value: { kind: 'literal', value: 10 } },
      ]
      const result = evaluateCollectionPipeline(items, stages, buildState())
      expect(result).toEqual([])
    })

    it('excludes an item when a numeric-looking segment reaches a non-object, non-array value', () => {
      const items = [{ id: 'a', scores: 40 }]
      const stages: CollectionPipelineStage[] = [
        { op: 'filter', path: 'scores.1', operator: 'eq', value: { kind: 'literal', value: 10 } },
      ]
      const result = evaluateCollectionPipeline(items, stages, buildState())
      expect(result).toEqual([])
    })
  })

  describe('slice', () => {
    it('slices the first N items and returns the whole collection when it has fewer items than requested', () => {
      const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
      const stages: CollectionPipelineStage[] = [{ op: 'slice', start: 0, end: 10 }]
      expect(() => evaluateCollectionPipeline(items, stages, buildState())).not.toThrow()
      const result = evaluateCollectionPipeline(items, stages, buildState())
      expect(result).toEqual(items)
    })

    it('slices with Array.prototype.slice semantics for negative indices', () => {
      const items = [1, 2, 3, 4, 5]
      const stages: CollectionPipelineStage[] = [{ op: 'slice', start: -3, end: -1 }]
      const result = evaluateCollectionPipeline(items, stages, buildState())
      expect(result).toEqual([3, 4])
    })

    it('returns an empty array for an out-of-range slice without throwing', () => {
      const items = [{ id: 'a' }, { id: 'b' }]
      const stages: CollectionPipelineStage[] = [{ op: 'slice', start: 100, end: 200 }]
      expect(() => evaluateCollectionPipeline(items, stages, buildState())).not.toThrow()
      const result = evaluateCollectionPipeline(items, stages, buildState())
      expect(result).toEqual([])
    })
  })

  it('applies a mixed chain of orderby, filter and slice in the declared order', () => {
    const items = [
      { id: 'a', status: 'pending', price: 10 },
      { id: 'b', status: 'active', price: 40 },
      { id: 'c', status: 'pending', price: 30 },
      { id: 'd', status: 'pending', price: 20 },
      { id: 'e', status: 'pending', price: 5 },
    ]
    const stages: CollectionPipelineStage[] = [
      { op: 'orderby', path: 'price', dir: 'desc' },
      { op: 'filter', path: 'status', operator: 'eq', value: { kind: 'literal', value: 'pending' } },
      { op: 'slice', start: 0, end: 2 },
    ]
    const result = evaluateCollectionPipeline(items, stages, buildState())
    expect(result.map((item) => (item as { id: string }).id)).toEqual(['c', 'd'])
  })

  it('does not mutate the input collection', () => {
    const items = [{ id: 'b' }, { id: 'a' }]
    const snapshot = [...items]
    const stages: CollectionPipelineStage[] = [{ op: 'orderby', path: 'id', dir: 'asc' }]
    evaluateCollectionPipeline(items, stages, buildState())
    expect(items).toEqual(snapshot)
  })
})
