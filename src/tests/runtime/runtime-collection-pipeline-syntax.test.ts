import { describe, expect, it } from 'vitest'
import { parseCollectionPipelineSource } from '../../config/runtime-collection-pipeline-syntax'

describe('parseCollectionPipelineSource', () => {
  it('returns no-pipeline verbatim when raw has no |', () => {
    expect(parseCollectionPipelineSource('queries.products.data')).toEqual({
      status: 'no-pipeline',
      baseReference: 'queries.products.data',
    })
  })

  it('does not trim whitespace in the no-pipeline base reference', () => {
    expect(parseCollectionPipelineSource('  queries.foo  ')).toEqual({
      status: 'no-pipeline',
      baseReference: '  queries.foo  ',
    })
  })

  it('parses a single orderby stage', () => {
    expect(parseCollectionPipelineSource('queries.products.data | orderby:price,desc')).toEqual({
      status: 'ok',
      baseReference: 'queries.products.data',
      stages: [{ op: 'orderby', path: 'price', dir: 'desc' }],
    })
  })

  it('accepts orderby asc', () => {
    const result = parseCollectionPipelineSource('queries.products.data | orderby:price,asc')
    expect(result).toEqual({
      status: 'ok',
      baseReference: 'queries.products.data',
      stages: [{ op: 'orderby', path: 'price', dir: 'asc' }],
    })
  })

  it.each(['ASC', 'up', ''])('rejects orderby with invalid dir %s', (dir) => {
    const raw = dir === ''
      ? 'queries.products.data | orderby:price'
      : `queries.products.data | orderby:price,${dir}`
    expect(parseCollectionPipelineSource(raw)).toEqual({ status: 'malformed' })
  })

  it('parses filter with a quoted string literal', () => {
    const result = parseCollectionPipelineSource('queries.products.data | filter:status,eq,"pending"')
    expect(result).toEqual({
      status: 'ok',
      baseReference: 'queries.products.data',
      stages: [
        { op: 'filter', path: 'status', operator: 'eq', value: { kind: 'literal', value: 'pending' } },
      ],
    })
  })

  it('parses filter with a numeric literal', () => {
    const result = parseCollectionPipelineSource('queries.products.data | filter:price,gt,10')
    expect(result).toEqual({
      status: 'ok',
      baseReference: 'queries.products.data',
      stages: [
        { op: 'filter', path: 'price', operator: 'gt', value: { kind: 'literal', value: 10 } },
      ],
    })
  })

  it('parses filter with a reference value', () => {
    const result = parseCollectionPipelineSource('queries.products.data | filter:status,eq,forms.searchForm.status')
    expect(result).toEqual({
      status: 'ok',
      baseReference: 'queries.products.data',
      stages: [
        {
          op: 'filter',
          path: 'status',
          operator: 'eq',
          value: { kind: 'reference', reference: 'forms.searchForm.status' },
        },
      ],
    })
  })

  it('parses filter "in" with a string list literal', () => {
    const result = parseCollectionPipelineSource('queries.products.data | filter:role,in,["admin","editor"]')
    expect(result).toEqual({
      status: 'ok',
      baseReference: 'queries.products.data',
      stages: [
        {
          op: 'filter',
          path: 'role',
          operator: 'in',
          value: { kind: 'list-literal', values: ['admin', 'editor'] },
        },
      ],
    })
  })

  it('parses filter "in" with a numeric list literal', () => {
    const result = parseCollectionPipelineSource('queries.products.data | filter:priority,in,[1,2,3]')
    expect(result).toEqual({
      status: 'ok',
      baseReference: 'queries.products.data',
      stages: [
        {
          op: 'filter',
          path: 'priority',
          operator: 'in',
          value: { kind: 'list-literal', values: [1, 2, 3] },
        },
      ],
    })
  })

  it('parses filter "in" with a list reference', () => {
    const result = parseCollectionPipelineSource('queries.products.data | filter:role,in,forms.filters.selectedRoles')
    expect(result).toEqual({
      status: 'ok',
      baseReference: 'queries.products.data',
      stages: [
        {
          op: 'filter',
          path: 'role',
          operator: 'in',
          value: { kind: 'list-reference', reference: 'forms.filters.selectedRoles' },
        },
      ],
    })
  })

  it.each(['eq', 'ne', 'gt', 'lt', 'gte', 'lte', 'contains', 'in'] as const)(
    'recognizes filter operator %s',
    (operator) => {
      const result = parseCollectionPipelineSource(`queries.products.data | filter:field,${operator},"x"`)
      expect(result.status).toBe('ok')
      if (result.status === 'ok') {
        expect(result.stages[0]).toEqual({
          op: 'filter',
          path: 'field',
          operator,
          value: { kind: 'literal', value: 'x' },
        })
      }
    },
  )

  it.each(['equals', '==', 'like', 'regex'])('rejects unknown filter operator %s', (operator) => {
    expect(parseCollectionPipelineSource(`queries.products.data | filter:field,${operator},"x"`)).toEqual({
      status: 'malformed',
    })
  })

  it('parses a slice stage', () => {
    const result = parseCollectionPipelineSource('queries.products.data | slice:0,10')
    expect(result).toEqual({
      status: 'ok',
      baseReference: 'queries.products.data',
      stages: [{ op: 'slice', start: 0, end: 10 }],
    })
  })

  it('accepts negative slice indices', () => {
    const result = parseCollectionPipelineSource('queries.products.data | slice:-5,-1')
    expect(result).toEqual({
      status: 'ok',
      baseReference: 'queries.products.data',
      stages: [{ op: 'slice', start: -5, end: -1 }],
    })
  })

  it('parses multiple stages in declared order', () => {
    const raw = 'queries.products.data | orderby:price,desc | slice:0,10 | filter:status,eq,"pending"'
    const result = parseCollectionPipelineSource(raw)
    expect(result).toEqual({
      status: 'ok',
      baseReference: 'queries.products.data',
      stages: [
        { op: 'orderby', path: 'price', dir: 'desc' },
        { op: 'slice', start: 0, end: 10 },
        { op: 'filter', path: 'status', operator: 'eq', value: { kind: 'literal', value: 'pending' } },
      ],
    })
  })

  it('ignores whitespace around | and , outside quoted literals', () => {
    const raw = 'queries.products.data  |  orderby : price , desc  |  slice : 0 , 10 '
    const result = parseCollectionPipelineSource(raw)
    expect(result).toEqual({
      status: 'ok',
      baseReference: 'queries.products.data',
      stages: [
        { op: 'orderby', path: 'price', dir: 'desc' },
        { op: 'slice', start: 0, end: 10 },
      ],
    })
  })

  it('does not split on | or , inside a quoted string literal', () => {
    const result = parseCollectionPipelineSource('queries.products.data | filter:name,eq,"a|b,c"')
    expect(result).toEqual({
      status: 'ok',
      baseReference: 'queries.products.data',
      stages: [
        { op: 'filter', path: 'name', operator: 'eq', value: { kind: 'literal', value: 'a|b,c' } },
      ],
    })
  })

  it('does not split on | or , inside a list literal', () => {
    const result = parseCollectionPipelineSource('queries.products.data | filter:role,in,["a|b","c,d"]')
    expect(result).toEqual({
      status: 'ok',
      baseReference: 'queries.products.data',
      stages: [
        {
          op: 'filter',
          path: 'role',
          operator: 'in',
          value: { kind: 'list-literal', values: ['a|b', 'c,d'] },
        },
      ],
    })
  })

  it('rejects a list literal value for an operator other than in', () => {
    expect(parseCollectionPipelineSource('queries.products.data | filter:role,eq,["a","b"]')).toEqual({
      status: 'malformed',
    })
  })

  it('treats a quoted string as a literal candidate for "in" without a list', () => {
    const result = parseCollectionPipelineSource('queries.products.data | filter:role,in,"admin"')
    expect(result).toEqual({
      status: 'ok',
      baseReference: 'queries.products.data',
      stages: [
        { op: 'filter', path: 'role', operator: 'in', value: { kind: 'literal', value: 'admin' } },
      ],
    })
  })

  it.each([
    'queries.products.data | filter:role,in,[',
    'queries.products.data | filter:role,in,["a",]',
    'queries.products.data | filter:role,in,[,]',
  ])('rejects a malformed list literal: %s', (raw) => {
    expect(parseCollectionPipelineSource(raw)).toEqual({ status: 'malformed' })
  })

  it.each(['sort:price,asc', 'where:status,eq,"x"'])('rejects an unknown operation name: %s', (stage) => {
    expect(parseCollectionPipelineSource(`queries.products.data | ${stage}`)).toEqual({ status: 'malformed' })
  })

  it.each([
    'queries.products.data | orderby:price',
    'queries.products.data | filter:status,eq',
    'queries.products.data | slice:0',
    'queries.products.data | slice:0,10,20',
  ])('rejects an incorrect number of arguments: %s', (raw) => {
    expect(parseCollectionPipelineSource(raw)).toEqual({ status: 'malformed' })
  })

  it('rejects an argument with an unclosed quote', () => {
    expect(parseCollectionPipelineSource('queries.products.data | filter:name,eq,"unfinished')).toEqual({
      status: 'malformed',
    })
  })

  it.each([
    'queries.products.data | slice:a,b',
    'queries.products.data | slice:"0","10"',
  ])('rejects slice with non-numeric arguments: %s', (raw) => {
    expect(parseCollectionPipelineSource(raw)).toEqual({ status: 'malformed' })
  })

  it('rejects a raw starting directly with |', () => {
    expect(parseCollectionPipelineSource('| orderby:price,asc')).toEqual({ status: 'malformed' })
  })

  it.each(['', '   '])('rejects an empty or whitespace-only raw: %s', (raw) => {
    expect(parseCollectionPipelineSource(raw)).toEqual({ status: 'malformed' })
  })
})
