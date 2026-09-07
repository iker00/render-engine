export type CollectionPipelineFilterOperator =
  | 'eq'
  | 'ne'
  | 'gt'
  | 'lt'
  | 'gte'
  | 'lte'
  | 'contains'
  | 'in'

export type CollectionPipelineFilterArgument =
  | { kind: 'literal'; value: string | number }
  | { kind: 'reference'; reference: string }
  | { kind: 'list-literal'; values: Array<string | number | boolean> }
  | { kind: 'list-reference'; reference: string }

export type CollectionPipelineStage =
  | { op: 'orderby'; path: string; dir: 'asc' | 'desc' }
  | { op: 'filter'; path: string; operator: CollectionPipelineFilterOperator; value: CollectionPipelineFilterArgument }
  | { op: 'slice'; start: number; end: number }

export type ParsedCollectionPipelineSource =
  | { status: 'no-pipeline'; baseReference: string }
  | { status: 'ok'; baseReference: string; stages: CollectionPipelineStage[] }
  | { status: 'malformed' }

const MALFORMED: ParsedCollectionPipelineSource = { status: 'malformed' }

const FILTER_OPERATORS = new Set<CollectionPipelineFilterOperator>([
  'eq',
  'ne',
  'gt',
  'lt',
  'gte',
  'lte',
  'contains',
  'in',
])

const NUMBER_PATTERN = /^-?\d+(\.\d+)?$/
const INTEGER_PATTERN = /^-?\d+$/

export function parseCollectionPipelineSource(raw: string): ParsedCollectionPipelineSource {
  if (raw.trim().length === 0) {
    return MALFORMED
  }

  const topLevelSplit = splitTopLevel(raw, '|')
  if (topLevelSplit === null) {
    return MALFORMED
  }

  if (topLevelSplit.length === 1) {
    return { status: 'no-pipeline', baseReference: raw }
  }

  const baseReference = topLevelSplit[0].trim()
  if (baseReference.length === 0) {
    return MALFORMED
  }

  const stages: CollectionPipelineStage[] = []

  for (const stageText of topLevelSplit.slice(1)) {
    const stage = parseStage(stageText.trim())
    if (stage === null) {
      return MALFORMED
    }
    stages.push(stage)
  }

  return { status: 'ok', baseReference, stages }
}

function parseStage(stageText: string): CollectionPipelineStage | null {
  const colonIndex = stageText.indexOf(':')
  if (colonIndex === -1) {
    return null
  }

  const opName = stageText.slice(0, colonIndex).trim()
  const argsText = stageText.slice(colonIndex + 1)

  const rawArgs = splitTopLevel(argsText, ',')
  if (rawArgs === null) {
    return null
  }
  const args = rawArgs.map((arg) => arg.trim())

  switch (opName) {
    case 'orderby':
      return parseOrderByStage(args)
    case 'slice':
      return parseSliceStage(args)
    case 'filter':
      return parseFilterStage(args)
    default:
      return null
  }
}

function parseOrderByStage(args: string[]): CollectionPipelineStage | null {
  if (args.length !== 2) {
    return null
  }

  const [path, dir] = args
  if (path.length === 0) {
    return null
  }
  if (dir !== 'asc' && dir !== 'desc') {
    return null
  }

  return { op: 'orderby', path, dir }
}

function parseSliceStage(args: string[]): CollectionPipelineStage | null {
  if (args.length !== 2) {
    return null
  }

  const [startText, endText] = args
  if (!INTEGER_PATTERN.test(startText) || !INTEGER_PATTERN.test(endText)) {
    return null
  }

  return { op: 'slice', start: Number(startText), end: Number(endText) }
}

function parseFilterStage(args: string[]): CollectionPipelineStage | null {
  if (args.length !== 3) {
    return null
  }

  const [path, operatorText, valueText] = args
  if (path.length === 0) {
    return null
  }
  if (!FILTER_OPERATORS.has(operatorText as CollectionPipelineFilterOperator)) {
    return null
  }
  const operator = operatorText as CollectionPipelineFilterOperator

  const value = parseFilterValue(valueText, operator)
  if (value === null) {
    return null
  }

  return { op: 'filter', path, operator, value }
}

function parseFilterValue(valueText: string, operator: CollectionPipelineFilterOperator): CollectionPipelineFilterArgument | null {
  if (valueText.length === 0) {
    return null
  }

  if (valueText.startsWith('[')) {
    if (operator !== 'in') {
      return null
    }
    return parseListLiteral(valueText)
  }

  if (valueText.startsWith('"')) {
    if (valueText.length < 2 || !valueText.endsWith('"')) {
      return null
    }
    return { kind: 'literal', value: valueText.slice(1, -1) }
  }

  if (NUMBER_PATTERN.test(valueText)) {
    return { kind: 'literal', value: Number(valueText) }
  }

  if (operator === 'in') {
    return { kind: 'list-reference', reference: valueText }
  }

  return { kind: 'reference', reference: valueText }
}

function parseListLiteral(valueText: string): CollectionPipelineFilterArgument | null {
  if (!valueText.endsWith(']')) {
    return null
  }

  const inner = valueText.slice(1, -1)
  if (inner.trim().length === 0) {
    return { kind: 'list-literal', values: [] }
  }

  const rawElements = splitTopLevel(inner, ',')
  if (rawElements === null) {
    return null
  }

  const values: Array<string | number | boolean> = []

  for (const rawElement of rawElements) {
    const element = rawElement.trim()
    if (element.length === 0) {
      return null
    }

    if (element.startsWith('"')) {
      if (element.length < 2 || !element.endsWith('"')) {
        return null
      }
      values.push(element.slice(1, -1))
      continue
    }

    if (element === 'true' || element === 'false') {
      values.push(element === 'true')
      continue
    }

    if (NUMBER_PATTERN.test(element)) {
      values.push(Number(element))
      continue
    }

    return null
  }

  return { kind: 'list-literal', values }
}

function splitTopLevel(text: string, delimiter: string): string[] | null {
  const parts: string[] = []
  let current = ''
  let inString = false
  let bracketDepth = 0

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]

    if (inString) {
      current += ch
      if (ch === '"') {
        inString = false
      }
      continue
    }

    if (ch === '"') {
      inString = true
      current += ch
      continue
    }

    if (ch === '[') {
      bracketDepth++
      current += ch
      continue
    }

    if (ch === ']') {
      bracketDepth--
      if (bracketDepth < 0) {
        return null
      }
      current += ch
      continue
    }

    if (ch === delimiter && bracketDepth === 0) {
      parts.push(current)
      current = ''
      continue
    }

    current += ch
  }

  if (inString || bracketDepth !== 0) {
    return null
  }

  parts.push(current)
  return parts
}
