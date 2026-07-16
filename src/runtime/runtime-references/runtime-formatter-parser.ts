export type RuntimeFormatterArgument =
  | { kind: 'none' }
  | { kind: 'string'; value: string }
  | { kind: 'number'; value: number }

export interface RuntimeFormatterInvocation {
  name: string
  argument: RuntimeFormatterArgument
}

export type RuntimeFormatterParseResult =
  | { status: 'no-formatters'; reference: string }
  | { status: 'ok'; reference: string; formatters: RuntimeFormatterInvocation[] }
  | { status: 'unresolvable-chain' }

const UNRESOLVABLE: RuntimeFormatterParseResult = { status: 'unresolvable-chain' }

export function hasFormatterSyntax(rawPlaceholderContent: string): boolean {
  const length = rawPlaceholderContent.length
  let inString = false

  for (let i = 0; i < length; i++) {
    const ch = rawPlaceholderContent[i]

    if (inString) {
      if (ch === '"') {
        inString = false
      }
      continue
    }

    if (ch === '"') {
      inString = true
      continue
    }

    if (ch === '|') {
      return true
    }
  }

  return false
}

export function parseFormatterPlaceholder(rawPlaceholderContent: string): RuntimeFormatterParseResult {
  const raw = rawPlaceholderContent
  const length = raw.length

  const firstPipeIndex = findTopLevelPipe(raw)

  if (firstPipeIndex === -1) {
    const reference = raw.trim()
    if (reference.length === 0) {
      return UNRESOLVABLE
    }
    return { status: 'no-formatters', reference }
  }

  const reference = raw.slice(0, firstPipeIndex).trim()
  if (reference.length === 0) {
    return UNRESOLVABLE
  }

  let cursor = firstPipeIndex + 1
  const formatters: RuntimeFormatterInvocation[] = []

  while (true) {
    cursor = skipWhitespace(raw, cursor)

    const nameStart = cursor
    while (cursor < length && isNameChar(raw[cursor])) {
      cursor++
    }
    if (cursor === nameStart) {
      return UNRESOLVABLE
    }
    const name = raw.slice(nameStart, cursor)

    cursor = skipWhitespace(raw, cursor)

    let argument: RuntimeFormatterArgument = { kind: 'none' }

    if (cursor < length && raw[cursor] === ':') {
      cursor++
      cursor = skipWhitespace(raw, cursor)
      if (cursor >= length) {
        return UNRESOLVABLE
      }

      const parsedArgument = parseArgument(raw, cursor)
      if (parsedArgument === null) {
        return UNRESOLVABLE
      }
      argument = parsedArgument.argument
      cursor = parsedArgument.nextCursor
    }

    formatters.push({ name, argument })

    cursor = skipWhitespace(raw, cursor)
    if (cursor >= length) {
      break
    }
    if (raw[cursor] !== '|') {
      return UNRESOLVABLE
    }
    cursor++
  }

  return { status: 'ok', reference, formatters }
}

function findTopLevelPipe(raw: string): number {
  const length = raw.length
  let inString = false

  for (let i = 0; i < length; i++) {
    const ch = raw[i]
    if (inString) {
      if (ch === '"') {
        inString = false
      }
      continue
    }
    if (ch === '"') {
      inString = true
      continue
    }
    if (ch === '|') {
      return i
    }
  }

  return -1
}

function parseArgument(
  raw: string,
  start: number,
): { argument: RuntimeFormatterArgument; nextCursor: number } | null {
  const length = raw.length
  const first = raw[start]

  if (first === '"') {
    let cursor = start + 1
    const stringStart = cursor
    while (cursor < length && raw[cursor] !== '"') {
      cursor++
    }
    if (cursor >= length) {
      return null
    }
    const value = raw.slice(stringStart, cursor)
    return { argument: { kind: 'string', value }, nextCursor: cursor + 1 }
  }

  if (first === '-' || isDigit(first)) {
    let cursor = start
    if (raw[cursor] === '-') {
      cursor++
    }
    if (cursor >= length || !isDigit(raw[cursor])) {
      return null
    }
    while (cursor < length && isDigit(raw[cursor])) {
      cursor++
    }
    if (cursor < length && raw[cursor] === '.') {
      cursor++
      if (cursor >= length || !isDigit(raw[cursor])) {
        return null
      }
      while (cursor < length && isDigit(raw[cursor])) {
        cursor++
      }
    }
    const numericText = raw.slice(start, cursor)
    const value = Number(numericText)
    if (Number.isNaN(value)) {
      return null
    }
    return { argument: { kind: 'number', value }, nextCursor: cursor }
  }

  return null
}

function skipWhitespace(raw: string, start: number): number {
  let cursor = start
  while (cursor < raw.length && isWhitespace(raw[cursor])) {
    cursor++
  }
  return cursor
}

function isWhitespace(ch: string): boolean {
  return ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r'
}

function isNameChar(ch: string): boolean {
  return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z')
}

function isDigit(ch: string): boolean {
  return ch >= '0' && ch <= '9'
}
