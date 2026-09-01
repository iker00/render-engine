import { describe, expect, it, vi } from 'vitest'
import {
  RUNTIME_FORMATTER_REGISTRY,
  applyFormatterChain,
  type RuntimeFormatterName,
} from '../../runtime/runtime-references/runtime-formatter-registry'
import type {
  RuntimeFormatterArgument,
  RuntimeFormatterInvocation,
} from '../../runtime/runtime-references/runtime-formatter-parser'

const noArg: RuntimeFormatterArgument = { kind: 'none' }
const stringArg = (value: string): RuntimeFormatterArgument => ({ kind: 'string', value })
const numberArg = (value: number): RuntimeFormatterArgument => ({ kind: 'number', value })

function apply(name: RuntimeFormatterName, input: unknown, argument: RuntimeFormatterArgument = noArg) {
  return RUNTIME_FORMATTER_REGISTRY[name].apply(input, argument)
}

function expectOk(
  result: ReturnType<typeof apply>,
): { status: 'ok'; value: string | number | boolean } {
  if (result.status !== 'ok') {
    throw new Error(`Expected ok result, got unresolvable`)
  }
  return result
}

// Normalize non-breaking / narrow-no-break spaces that Intl may emit.
function normalizeSpaces(text: string): string {
  return text.replace(/\u00A0/g, ' ').replace(/\u202F/g, ' ')
}

describe('RUNTIME_FORMATTER_REGISTRY.number', () => {
  it('formats a finite number without argument using es-ES grouping', () => {
    const result = expectOk(apply('number', 1234.5))
    expect(result.value).toBe('1.234,5')
  })

  it('formats with a fixed number of decimals when argument is a number', () => {
    const result = expectOk(apply('number', 1234.5, numberArg(2)))
    expect(result.value).toBe('1.234,50')
  })

  it('accepts numeric strings matching /^-?\\d+(\\.\\d+)?$/', () => {
    expect(expectOk(apply('number', '42')).value).toBe('42')
    expect(expectOk(apply('number', '42.5')).value).toBe('42,5')
  })

  it('rejects non-numeric or ambiguous inputs as unresolvable', () => {
    const rejected: unknown[] = [
      '',
      '   ',
      '12,3',
      '1,000',
      'abc',
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
      null,
      undefined,
      true,
      {},
      [],
    ]
    for (const value of rejected) {
      expect(apply('number', value).status).toBe('unresolvable')
    }
  })

  it('rejects string argument for number', () => {
    expect(apply('number', 1, stringArg('2')).status).toBe('unresolvable')
  })
})

describe('RUNTIME_FORMATTER_REGISTRY.currency', () => {
  it('formats using EUR by default in es-ES', () => {
    const result = expectOk(apply('currency', 19.9))
    const normalized = normalizeSpaces(String(result.value))
    expect(normalized).toContain('19,90')
    expect(normalized).toContain('€')
  })

  it('formats using the ISO code provided as string argument', () => {
    const usd = expectOk(apply('currency', 19.9, stringArg('USD')))
    const eur = expectOk(apply('currency', 19.9))
    const normalizedUsd = normalizeSpaces(String(usd.value))
    expect(normalizedUsd).toContain('19,90')
    expect(normalizedUsd).not.toBe(normalizeSpaces(String(eur.value)))
    expect(normalizedUsd).toMatch(/US\$|USD|\$/)
  })

  it('rejects numeric argument for currency', () => {
    expect(apply('currency', 19.9, numberArg(1)).status).toBe('unresolvable')
  })

  it('rejects non-numeric inputs', () => {
    expect(apply('currency', 'abc').status).toBe('unresolvable')
    expect(apply('currency', null).status).toBe('unresolvable')
  })
})

describe('RUNTIME_FORMATTER_REGISTRY.date', () => {
  it('formats a date-only ISO string using UTC getters with dd/MM/yyyy', () => {
    const result = expectOk(apply('date', '2026-07-16', stringArg('dd/MM/yyyy')))
    expect(result.value).toBe('16/07/2026')
  })

  it('formats an ISO datetime constructed from a local Date using local getters', () => {
    const reference = new Date(2026, 6, 16, 10, 30, 45)
    const iso = reference.toISOString()
    const result = expectOk(apply('date', iso, stringArg('dd/MM/yyyy HH:mm:ss')))
    expect(result.value).toBe('16/07/2026 10:30:45')
  })

  it('rejects invalid date inputs as unresolvable', () => {
    const rejected: unknown[] = ['ana', '', null, 123, false]
    for (const value of rejected) {
      expect(apply('date', value, stringArg('dd/MM/yyyy')).status).toBe('unresolvable')
    }
  })

  it('rejects date without argument (kind none)', () => {
    expect(apply('date', '2026-07-16', noArg).status).toBe('unresolvable')
  })

  it('rejects numeric argument for date', () => {
    expect(apply('date', '2026-07-16', numberArg(1)).status).toBe('unresolvable')
  })

  it('leaves unknown tokens literal in the pattern', () => {
    const result = expectOk(apply('date', '2026-07-16', stringArg('YYYY/MM/dd')))
    expect(result.value).toBe('YYYY/07/16')
  })
})

describe('RUNTIME_FORMATTER_REGISTRY.percent', () => {
  it('formats a ratio to a rounded integer percent by default', () => {
    const result = expectOk(apply('percent', 0.4256))
    const stripped = normalizeSpaces(String(result.value)).replace(/\s+/g, '')
    expect(stripped).toBe('43%')
  })

  it('respects a decimals argument', () => {
    const result = expectOk(apply('percent', 0.4256, numberArg(1)))
    const stripped = normalizeSpaces(String(result.value)).replace(/\s+/g, '')
    expect(stripped).toBe('42,6%')
  })

  it('accepts numeric strings', () => {
    const result = expectOk(apply('percent', '0.5'))
    const stripped = normalizeSpaces(String(result.value)).replace(/\s+/g, '')
    expect(stripped).toBe('50%')
  })

  it('rejects non-numeric inputs like number does', () => {
    const rejected: unknown[] = ['', 'abc', 'null', Number.NaN, null, undefined, {}, []]
    for (const value of rejected) {
      expect(apply('percent', value).status).toBe('unresolvable')
    }
  })
})

describe('RUNTIME_FORMATTER_REGISTRY.uppercase', () => {
  it('uppercases strings', () => {
    expect(expectOk(apply('uppercase', 'ana')).value).toBe('ANA')
  })

  it('coerces number and boolean to string then uppercases', () => {
    expect(expectOk(apply('uppercase', 42)).value).toBe('42')
    expect(expectOk(apply('uppercase', true)).value).toBe('TRUE')
  })

  it('rejects null, undefined, non-finite numbers and non-scalar values', () => {
    const rejected: unknown[] = [null, undefined, Number.NaN, Number.POSITIVE_INFINITY, {}, []]
    for (const value of rejected) {
      expect(apply('uppercase', value).status).toBe('unresolvable')
    }
  })

  it('rejects any argument (none-arg formatter)', () => {
    expect(apply('uppercase', 'foo', stringArg('foo')).status).toBe('unresolvable')
    expect(apply('uppercase', 'foo', numberArg(1)).status).toBe('unresolvable')
  })
})

describe('RUNTIME_FORMATTER_REGISTRY.lowercase', () => {
  it('lowercases strings', () => {
    expect(expectOk(apply('lowercase', 'ANA')).value).toBe('ana')
  })
})

describe('RUNTIME_FORMATTER_REGISTRY.capitalize', () => {
  it('capitalizes only the first character', () => {
    expect(expectOk(apply('capitalize', 'ana pérez')).value).toBe('Ana pérez')
  })

  it('returns empty string when the input is empty', () => {
    expect(expectOk(apply('capitalize', '')).value).toBe('')
  })
})

describe('RUNTIME_FORMATTER_REGISTRY.truncate', () => {
  it('leaves text untouched when it does not exceed the limit', () => {
    expect(expectOk(apply('truncate', 'hola', numberArg(20))).value).toBe('hola')
  })

  it('truncates and appends the ellipsis when text exceeds the limit', () => {
    expect(expectOk(apply('truncate', 'hola', numberArg(2))).value).toBe('ho…')
  })

  it('returns just the ellipsis when limit is 0 and text is non-empty', () => {
    expect(expectOk(apply('truncate', 'hola', numberArg(0))).value).toBe('…')
  })

  it('returns empty string when text is empty even for limit 0', () => {
    expect(expectOk(apply('truncate', '', numberArg(0))).value).toBe('')
  })

  it('rejects negative limits', () => {
    expect(apply('truncate', 'hola', numberArg(-1)).status).toBe('unresolvable')
  })

  it('rejects when argument is missing or a string', () => {
    expect(apply('truncate', 'hola', noArg).status).toBe('unresolvable')
    expect(apply('truncate', 'hola', stringArg('2')).status).toBe('unresolvable')
  })
})

describe('RUNTIME_FORMATTER_REGISTRY.length', () => {
  it('counts elements of an array', () => {
    expect(expectOk(apply('length', [1, 2, 3, 4, 5])).value).toBe(5)
  })

  it('counts zero elements for an empty array', () => {
    expect(expectOk(apply('length', [])).value).toBe(0)
  })

  it('counts characters of a string', () => {
    expect(expectOk(apply('length', 'hola')).value).toBe(4)
  })

  it('counts zero characters for an empty string', () => {
    expect(expectOk(apply('length', '')).value).toBe(0)
  })

  it('counts UTF-16 code units, not grapheme clusters, for a composed emoji', () => {
    expect(expectOk(apply('length', '😀')).value).toBe('😀'.length)
  })

  it('rejects number, boolean, null, undefined, NaN, Infinity and plain objects as unresolvable', () => {
    const rejected: unknown[] = [
      42,
      true,
      null,
      undefined,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      {},
    ]
    for (const value of rejected) {
      expect(apply('length', value).status).toBe('unresolvable')
    }
  })

  it('rejects any argument (none-arg formatter)', () => {
    expect(apply('length', 'foo', stringArg('foo')).status).toBe('unresolvable')
    expect(apply('length', 'foo', numberArg(2)).status).toBe('unresolvable')
  })
})

describe('applyFormatterChain', () => {
  it('returns ok with the formatted value for a single formatter', () => {
    const invocations: RuntimeFormatterInvocation[] = [{ name: 'number', argument: noArg }]
    expect(applyFormatterChain(1234.5, invocations)).toEqual({ status: 'ok', value: '1.234,5' })
  })

  it('applies formatters left to right passing the result forward', () => {
    const invocations: RuntimeFormatterInvocation[] = [
      { name: 'uppercase', argument: noArg },
      { name: 'truncate', argument: numberArg(2) },
    ]
    expect(applyFormatterChain('ana', invocations)).toEqual({ status: 'ok', value: 'AN…' })
  })

  it('short-circuits with unresolvable when a formatter cannot handle the input', () => {
    const invocations: RuntimeFormatterInvocation[] = [
      { name: 'uppercase', argument: noArg },
      { name: 'date', argument: stringArg('dd/MM/yyyy') },
    ]
    expect(applyFormatterChain('ana', invocations)).toEqual({ status: 'unresolvable' })
  })

  it('returns unresolvable when a formatter name is not in the closed catalog', () => {
    const invocations: RuntimeFormatterInvocation[] = [
      { name: 'doesNotExist' as RuntimeFormatterName, argument: noArg },
    ]
    expect(applyFormatterChain('ana', invocations)).toEqual({ status: 'unresolvable' })
  })

  it('caches Intl.NumberFormat instances across repeated calls with the same argument', () => {
    const spy = vi.spyOn(Intl, 'NumberFormat')
    spy.mockClear()

    const invocations: RuntimeFormatterInvocation[] = [
      { name: 'number', argument: numberArg(7) },
    ]
    applyFormatterChain(1, invocations)
    applyFormatterChain(2, invocations)

    expect(spy).toHaveBeenCalledTimes(1)
    spy.mockRestore()
  })

  it('chains length with number to format an element count with grouping', () => {
    const invocations: RuntimeFormatterInvocation[] = [
      { name: 'length', argument: noArg },
      { name: 'number', argument: noArg },
    ]
    const bigArray = Array.from({ length: 1500 }, (_, index) => index)
    expect(applyFormatterChain(bigArray, invocations)).toEqual({ status: 'ok', value: '1.500' })
  })

  it('chains uppercase with length to count characters of the uppercased string', () => {
    const invocations: RuntimeFormatterInvocation[] = [
      { name: 'uppercase', argument: noArg },
      { name: 'length', argument: noArg },
    ]
    expect(applyFormatterChain('ana', invocations)).toEqual({ status: 'ok', value: 3 })
  })

  it('chains length with uppercase producing an unchanged numeric string', () => {
    const invocations: RuntimeFormatterInvocation[] = [
      { name: 'length', argument: noArg },
      { name: 'uppercase', argument: noArg },
    ]
    expect(applyFormatterChain([1, 2, 3, 4, 5], invocations)).toEqual({ status: 'ok', value: '5' })
  })
})
