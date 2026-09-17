import type { LayoutNode, RuntimeConfigError } from './runtime-config-types'

export interface BreadcrumbSegment {
  label: string
}

const MAX_IDENTIFIER_LENGTH = 30

const fieldIdTypes = new Set([
  'input',
  'textarea',
  'select',
  'radioGroup',
  'checkboxGroup',
  'toggle',
  'fileInput',
  'hidden',
  'addressPicker',
])

const labelTypes = new Set(['button', 'accordion', 'badge', 'link'])

const textTypes = new Set(['heading', 'paragraph'])

const operationNameTypes = new Set(['fileManager'])

function truncate(value: string): string {
  if (value.length <= MAX_IDENTIFIER_LENGTH) return value
  return value.slice(0, MAX_IDENTIFIER_LENGTH) + '...'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function getIdentifier(
  type: string,
  id: unknown,
  props: Record<string, unknown>,
): { kind: 'named'; key?: string; value: string } | null {
  if (typeof id === 'string' && id.length > 0) {
    return { kind: 'named', value: id }
  }

  if (fieldIdTypes.has(type) && typeof props.fieldId === 'string') {
    return { kind: 'named', key: 'fieldId', value: props.fieldId }
  }

  if (labelTypes.has(type) && typeof props.label === 'string') {
    return { kind: 'named', value: props.label }
  }

  if (textTypes.has(type) && typeof props.text === 'string') {
    return { kind: 'named', value: props.text }
  }

  if (operationNameTypes.has(type) && typeof props.operationName === 'string') {
    return { kind: 'named', key: 'operationName', value: props.operationName }
  }

  if (operationNameTypes.has(type) && typeof props.fieldName === 'string') {
    return { kind: 'named', key: 'fieldName', value: props.fieldName }
  }

  return null
}

function formatSegmentLabel(type: string, identifier: { kind: 'named'; key?: string; value: string } | null, index: number): string {
  if (identifier === null) {
    return `${type}[${index}]`
  }

  const truncated = truncate(identifier.value)

  if (identifier.key) {
    return `${type}(${identifier.key}: "${truncated}")`
  }

  return `${type}("${truncated}")`
}

export function buildBreadcrumbSegment(
  rawNode: Record<string, unknown>,
  index: number,
): BreadcrumbSegment {
  const type = typeof rawNode.type === 'string' ? rawNode.type : 'unknown'
  const props = isRecord(rawNode.props) ? rawNode.props : {}
  const identifier = getIdentifier(type, rawNode.id, props)

  return { label: formatSegmentLabel(type, identifier, index) }
}

export function buildBreadcrumbSegmentFromNode(
  node: LayoutNode,
  index: number,
): BreadcrumbSegment {
  const rawNode: Record<string, unknown> = { type: node.type }

  if ('id' in node && typeof node.id === 'string') {
    rawNode.id = node.id
  }

  if ('props' in node && node.props !== undefined) {
    rawNode.props = node.props
  }

  return buildBreadcrumbSegment(rawNode, index)
}

export function formatBreadcrumb(segments: BreadcrumbSegment[]): string {
  return segments.map(s => s.label).join(' > ')
}

const excerptIdentifyingProps = new Set(['fieldId', 'label', 'text', 'operationName', 'fieldName'])

export function buildNodeExcerpt(rawNode: Record<string, unknown> | undefined): string {
  const excerpt: Record<string, unknown> = {}

  if (rawNode === undefined) {
    return JSON.stringify(excerpt)
  }

  if (typeof rawNode.type === 'string') {
    excerpt.type = rawNode.type
  }

  if (typeof rawNode.id === 'string') {
    excerpt.id = rawNode.id
  }

  const props = isRecord(rawNode.props) ? rawNode.props : null
  if (props) {
    const excerptProps: Record<string, unknown> = {}

    for (const key of excerptIdentifyingProps) {
      if (typeof props[key] === 'string') {
        excerptProps[key] = props[key]
      }
    }

    if (Object.keys(excerptProps).length > 0) {
      excerpt.props = excerptProps
    }
  }

  return JSON.stringify(excerpt)
}

export function buildNodeExcerptFromNode(node: LayoutNode): string {
  const rawNode: Record<string, unknown> = { type: node.type }

  if ('id' in node && typeof node.id === 'string') {
    rawNode.id = node.id
  }

  if ('props' in node && node.props !== undefined) {
    rawNode.props = node.props
  }

  return buildNodeExcerpt(rawNode)
}

export function enrichErrorMessage(
  message: string,
  breadcrumb: string,
  excerpt: string,
): string {
  if (!breadcrumb) return message
  return `${message}\n  → ${breadcrumb}\n  Node: ${excerpt}`
}

export function enrichedInvalidLayout(
  message: string,
  breadcrumb: BreadcrumbSegment[],
  rawNode: Record<string, unknown> | undefined,
): { status: 'error'; error: RuntimeConfigError } {
  const bc = formatBreadcrumb(breadcrumb)
  const excerpt = buildNodeExcerpt(rawNode)
  const enriched = enrichErrorMessage(message, bc, excerpt)

  return {
    status: 'error',
    error: {
      code: 'invalid-layout',
      displayMode: 'development-only',
      message: enriched,
    },
  }
}

export function enrichErrorResult(
  result: { status: 'error'; error: RuntimeConfigError },
  breadcrumb: BreadcrumbSegment[],
  rawNode: Record<string, unknown> | undefined,
): { status: 'error'; error: RuntimeConfigError } {
  const bc = formatBreadcrumb(breadcrumb)
  const excerpt = buildNodeExcerpt(rawNode)

  return {
    ...result,
    error: {
      ...result.error,
      message: enrichErrorMessage(result.error.message, bc, excerpt),
    },
  }
}

export function enrichedInvalidLayoutFromNode(
  message: string,
  breadcrumb: BreadcrumbSegment[],
  node: LayoutNode,
): { status: 'error'; error: RuntimeConfigError } {
  const bc = formatBreadcrumb(breadcrumb)
  const excerpt = buildNodeExcerptFromNode(node)
  const enriched = enrichErrorMessage(message, bc, excerpt)

  return {
    status: 'error',
    error: {
      code: 'invalid-layout',
      displayMode: 'development-only',
      message: enriched,
    },
  }
}
