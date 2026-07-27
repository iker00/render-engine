import { describe, expect, it } from 'vitest'
import {
  hasFormatterSyntax,
  parseFormatterPlaceholder,
} from '../../runtime/runtime-references/runtime-formatter-parser'

describe('hasFormatterSyntax', () => {
  it('returns false when the placeholder has no |', () => {
    expect(hasFormatterSyntax('queries.total')).toBe(false)
  })

  it('returns true when a top-level | is present', () => {
    expect(hasFormatterSyntax('queries.total | number')).toBe(true)
  })

  it('returns true when the top-level | comes before a string that itself contains |', () => {
    expect(hasFormatterSyntax('queries.name | truncate:"a|b"')).toBe(true)
  })

  it('returns true even when a string is left unclosed after a top-level |', () => {
    expect(hasFormatterSyntax('queries.name | truncate:"ab')).toBe(true)
  })

  it('returns false when the only | is inside a string opened before any top-level |', () => {
    expect(hasFormatterSyntax('queries.name truncate:"a|b"')).toBe(false)
  })
})

describe('parseFormatterPlaceholder', () => {
  it('returns no-formatters for a bare reference', () => {
    expect(parseFormatterPlaceholder('queries.total')).toEqual({
      status: 'no-formatters',
      reference: 'queries.total',
    })
  })

  it('trims surrounding whitespace around the reference', () => {
    expect(parseFormatterPlaceholder(' queries.total ')).toEqual({
      status: 'no-formatters',
      reference: 'queries.total',
    })
  })

  it('parses a single formatter with no argument', () => {
    expect(parseFormatterPlaceholder('queries.total | number')).toEqual({
      status: 'ok',
      reference: 'queries.total',
      formatters: [{ name: 'number', argument: { kind: 'none' } }],
    })
  })

  it('parses an integer numeric argument', () => {
    expect(parseFormatterPlaceholder('queries.total | number:2')).toEqual({
      status: 'ok',
      reference: 'queries.total',
      formatters: [{ name: 'number', argument: { kind: 'number', value: 2 } }],
    })
  })

  it('parses a string argument in double quotes', () => {
    expect(parseFormatterPlaceholder('queries.price | currency:"USD"')).toEqual({
      status: 'ok',
      reference: 'queries.price',
      formatters: [{ name: 'currency', argument: { kind: 'string', value: 'USD' } }],
    })
  })

  it('parses a chain of formatters in the declared order', () => {
    expect(parseFormatterPlaceholder('x | uppercase | truncate:2')).toEqual({
      status: 'ok',
      reference: 'x',
      formatters: [
        { name: 'uppercase', argument: { kind: 'none' } },
        { name: 'truncate', argument: { kind: 'number', value: 2 } },
      ],
    })
  })

  it('normalizes variable whitespace around | and :', () => {
    expect(parseFormatterPlaceholder(' x  |  number : 2 ')).toEqual(
      parseFormatterPlaceholder('x | number:2'),
    )
  })

  it('preserves | characters inside a string argument', () => {
    expect(parseFormatterPlaceholder('x | truncate:"a|b"')).toEqual({
      status: 'ok',
      reference: 'x',
      formatters: [{ name: 'truncate', argument: { kind: 'string', value: 'a|b' } }],
    })
  })

  it('parses negative numeric arguments', () => {
    expect(parseFormatterPlaceholder('x | number:-1')).toEqual({
      status: 'ok',
      reference: 'x',
      formatters: [{ name: 'number', argument: { kind: 'number', value: -1 } }],
    })
  })

  it('parses decimal numeric arguments', () => {
    expect(parseFormatterPlaceholder('x | percent:1.5')).toEqual({
      status: 'ok',
      reference: 'x',
      formatters: [{ name: 'percent', argument: { kind: 'number', value: 1.5 } }],
    })
  })

  it('preserves : characters inside a string argument', () => {
    expect(parseFormatterPlaceholder('x | date:"dd/MM/yyyy HH:mm:ss"')).toEqual({
      status: 'ok',
      reference: 'x',
      formatters: [
        { name: 'date', argument: { kind: 'string', value: 'dd/MM/yyyy HH:mm:ss' } },
      ],
    })
  })

  describe('unresolvable-chain grammar rejections', () => {
    it('rejects a formatter name starting with a digit', () => {
      expect(parseFormatterPlaceholder('x | 1foo')).toEqual({ status: 'unresolvable-chain' })
    })

    it('rejects a formatter name with parentheses', () => {
      expect(parseFormatterPlaceholder('x | foo(1)')).toEqual({ status: 'unresolvable-chain' })
    })

    it('rejects : without a following argument', () => {
      expect(parseFormatterPlaceholder('x | truncate:')).toEqual({ status: 'unresolvable-chain' })
    })

    it('rejects an unquoted identifier as argument', () => {
      expect(parseFormatterPlaceholder('x | number:dos')).toEqual({ status: 'unresolvable-chain' })
    })

    it('rejects an unclosed string argument', () => {
      expect(parseFormatterPlaceholder('x | truncate:"ab')).toEqual({ status: 'unresolvable-chain' })
    })

    it('rejects an unexpected character after the formatter name', () => {
      expect(parseFormatterPlaceholder('x | number#2')).toEqual({ status: 'unresolvable-chain' })
    })

    it('rejects an empty reference before the first |', () => {
      expect(parseFormatterPlaceholder(' | number')).toEqual({ status: 'unresolvable-chain' })
    })

    it('rejects a fully empty placeholder', () => {
      expect(parseFormatterPlaceholder('')).toEqual({ status: 'unresolvable-chain' })
    })
  })
})
