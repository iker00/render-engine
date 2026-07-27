import type {
  RuntimeFormatterArgument,
  RuntimeFormatterInvocation,
} from './runtime-formatter-parser'

export type RuntimeFormatterName =
  | 'number'
  | 'currency'
  | 'date'
  | 'percent'
  | 'uppercase'
  | 'lowercase'
  | 'capitalize'
  | 'truncate'

export type RuntimeFormatterChainResult =
  | { status: 'ok'; value: string | number | boolean }
  | { status: 'unresolvable' }

export interface RuntimeFormatterEntry {
  argument: 'none' | 'string' | 'number' | 'optional-number' | 'optional-string'
  apply(value: unknown, argument: RuntimeFormatterArgument): RuntimeFormatterChainResult
}

const UNRESOLVABLE: RuntimeFormatterChainResult = { status: 'unresolvable' }

const NUMERIC_STRING_PATTERN = /^-?\d+(\.\d+)?$/
const ISO_DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const ISO_DATE_TIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?$/

const numberFormatCache = new Map<string, Intl.NumberFormat>()

function getNumberFormat(key: string, options: Intl.NumberFormatOptions): Intl.NumberFormat {
  const cached = numberFormatCache.get(key)
  if (cached) return cached
  const instance = new Intl.NumberFormat('es-ES', options)
  numberFormatCache.set(key, instance)
  return instance
}

function coerceToFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }
  if (typeof value === 'string') {
    if (!NUMERIC_STRING_PATTERN.test(value)) return null
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function coerceToScalarString(value: unknown): string | null {
  if (typeof value === 'string') return value
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : null
  }
  if (typeof value === 'boolean') return String(value)
  return null
}

function argumentIsNone(argument: RuntimeFormatterArgument): boolean {
  return argument.kind === 'none'
}

function applyNumber(value: unknown, argument: RuntimeFormatterArgument): RuntimeFormatterChainResult {
  let decimals: number | null = null
  if (argument.kind === 'number') {
    decimals = argument.value
  } else if (argument.kind !== 'none') {
    return UNRESOLVABLE
  }

  const parsed = coerceToFiniteNumber(value)
  if (parsed === null) return UNRESOLVABLE

  const options: Intl.NumberFormatOptions = { useGrouping: true }
  let key = 'num'
  if (decimals !== null) {
    options.minimumFractionDigits = decimals
    options.maximumFractionDigits = decimals
    key = `num:${decimals}`
  }

  const formatter = getNumberFormat(key, options)
  return { status: 'ok', value: formatter.format(parsed) }
}

function applyCurrency(value: unknown, argument: RuntimeFormatterArgument): RuntimeFormatterChainResult {
  let currency = 'EUR'
  if (argument.kind === 'string') {
    currency = argument.value
  } else if (argument.kind !== 'none') {
    return UNRESOLVABLE
  }

  const parsed = coerceToFiniteNumber(value)
  if (parsed === null) return UNRESOLVABLE

  const key = `cur:${currency}`
  const formatter = getNumberFormat(key, {
    style: 'currency',
    currency,
    useGrouping: true,
  })
  return { status: 'ok', value: formatter.format(parsed) }
}

function applyPercent(value: unknown, argument: RuntimeFormatterArgument): RuntimeFormatterChainResult {
  let decimals = 0
  if (argument.kind === 'number') {
    decimals = argument.value
  } else if (argument.kind !== 'none') {
    return UNRESOLVABLE
  }

  const parsed = coerceToFiniteNumber(value)
  if (parsed === null) return UNRESOLVABLE

  const key = `pct:${decimals}`
  const formatter = getNumberFormat(key, {
    style: 'percent',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    useGrouping: true,
  })
  return { status: 'ok', value: formatter.format(parsed) }
}

function applyDate(value: unknown, argument: RuntimeFormatterArgument): RuntimeFormatterChainResult {
  if (argument.kind !== 'string') return UNRESOLVABLE
  if (typeof value !== 'string' || value.length === 0) return UNRESOLVABLE

  const isDateOnly = ISO_DATE_ONLY_PATTERN.test(value)
  const isDateTime = !isDateOnly && ISO_DATE_TIME_PATTERN.test(value)
  if (!isDateOnly && !isDateTime) return UNRESOLVABLE

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return UNRESOLVABLE

  const useUtc = isDateOnly
  const year = useUtc ? date.getUTCFullYear() : date.getFullYear()
  const month = (useUtc ? date.getUTCMonth() : date.getMonth()) + 1
  const day = useUtc ? date.getUTCDate() : date.getDate()
  const hours = useUtc ? date.getUTCHours() : date.getHours()
  const minutes = useUtc ? date.getUTCMinutes() : date.getMinutes()
  const seconds = useUtc ? date.getUTCSeconds() : date.getSeconds()

  const formatted = argument.value
    .replace(/dd/g, pad2(day))
    .replace(/MM/g, pad2(month))
    .replace(/yyyy/g, String(year).padStart(4, '0'))
    .replace(/HH/g, pad2(hours))
    .replace(/mm/g, pad2(minutes))
    .replace(/ss/g, pad2(seconds))

  return { status: 'ok', value: formatted }
}

function pad2(value: number): string {
  return value < 10 ? `0${value}` : String(value)
}

function applyUppercase(value: unknown, argument: RuntimeFormatterArgument): RuntimeFormatterChainResult {
  if (!argumentIsNone(argument)) return UNRESOLVABLE
  const text = coerceToScalarString(value)
  if (text === null) return UNRESOLVABLE
  return { status: 'ok', value: text.toUpperCase() }
}

function applyLowercase(value: unknown, argument: RuntimeFormatterArgument): RuntimeFormatterChainResult {
  if (!argumentIsNone(argument)) return UNRESOLVABLE
  const text = coerceToScalarString(value)
  if (text === null) return UNRESOLVABLE
  return { status: 'ok', value: text.toLowerCase() }
}

function applyCapitalize(value: unknown, argument: RuntimeFormatterArgument): RuntimeFormatterChainResult {
  if (!argumentIsNone(argument)) return UNRESOLVABLE
  const text = coerceToScalarString(value)
  if (text === null) return UNRESOLVABLE
  if (text.length === 0) return { status: 'ok', value: '' }
  return { status: 'ok', value: text[0].toUpperCase() + text.slice(1) }
}

function applyTruncate(value: unknown, argument: RuntimeFormatterArgument): RuntimeFormatterChainResult {
  if (argument.kind !== 'number') return UNRESOLVABLE
  const limit = argument.value
  if (!Number.isFinite(limit) || limit < 0 || !Number.isInteger(limit)) return UNRESOLVABLE
  const text = coerceToScalarString(value)
  if (text === null) return UNRESOLVABLE
  if (text.length === 0) return { status: 'ok', value: '' }
  if (text.length <= limit) return { status: 'ok', value: text }
  return { status: 'ok', value: `${text.slice(0, limit)}…` }
}

export const RUNTIME_FORMATTER_REGISTRY: Record<RuntimeFormatterName, RuntimeFormatterEntry> = {
  number: { argument: 'optional-number', apply: applyNumber },
  currency: { argument: 'optional-string', apply: applyCurrency },
  date: { argument: 'string', apply: applyDate },
  percent: { argument: 'optional-number', apply: applyPercent },
  uppercase: { argument: 'none', apply: applyUppercase },
  lowercase: { argument: 'none', apply: applyLowercase },
  capitalize: { argument: 'none', apply: applyCapitalize },
  truncate: { argument: 'number', apply: applyTruncate },
}

const REGISTRY_KEYS = new Set<string>(Object.keys(RUNTIME_FORMATTER_REGISTRY))

export function applyFormatterChain(
  input: unknown,
  invocations: readonly RuntimeFormatterInvocation[],
): RuntimeFormatterChainResult {
  let current: unknown = input

  for (const invocation of invocations) {
    if (!REGISTRY_KEYS.has(invocation.name)) return UNRESOLVABLE
    const entry = RUNTIME_FORMATTER_REGISTRY[invocation.name as RuntimeFormatterName]
    const result = entry.apply(current, invocation.argument)
    if (result.status !== 'ok') return UNRESOLVABLE
    current = result.value
  }

  if (typeof current === 'string' || typeof current === 'number' || typeof current === 'boolean') {
    return { status: 'ok', value: current }
  }

  return UNRESOLVABLE
}

export function findFirstFailingFormatterName(
  input: unknown,
  invocations: readonly RuntimeFormatterInvocation[],
): string | null {
  let current: unknown = input

  for (const invocation of invocations) {
    if (!REGISTRY_KEYS.has(invocation.name)) return invocation.name
    const entry = RUNTIME_FORMATTER_REGISTRY[invocation.name as RuntimeFormatterName]
    const result = entry.apply(current, invocation.argument)
    if (result.status !== 'ok') return invocation.name
    current = result.value
  }

  return null
}
