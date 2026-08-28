export type RuntimeReferenceNamespace =
  | 'item'
  | 'row'
  | 'forms'
  | 'queries'
  | 'navigation'
  | 'routeParams'
  | 'params'
  | 'translations'
  | 'tokens'

export type RuntimeReferenceParseResult =
  | RuntimeLiteralReference
  | RuntimeSupportedReference
  | RuntimeUnsupportedReference
  | RuntimeInvalidReference

export interface RuntimeLiteralReference {
  kind: 'literal'
  value: string
}

export interface RuntimeSupportedReference {
  kind: 'reference'
  status: 'supported'
  namespace: 'item' | 'row' | 'forms' | 'queries' | 'params' | 'translations' | 'tokens'
  path: string[]
  source: string
}

export interface RuntimeUnsupportedReference {
  kind: 'reference'
  status: 'unsupported'
  namespace: 'item' | 'row' | 'navigation' | 'routeParams'
  path: string[]
  source: string
}

export interface RuntimeInvalidReference {
  kind: 'reference'
  status: 'invalid'
  namespace: RuntimeReferenceNamespace
  path: string[]
  source: string
}

const SUPPORTED_NAMESPACES = new Set(['forms', 'queries', 'params', 'translations', 'tokens'] as const)
const RESERVED_NAMESPACES = new Set(['navigation', 'routeParams'] as const)
const REFERENCE_PATTERN = /^(item|row|forms|queries|navigation|routeParams|params|translations|tokens)(\.[A-Za-z0-9_-]+)*$/
const REFERENCE_SEGMENT_PATTERN = /^[A-Za-z0-9_-]+$/
const ITEM_KEY_SYNTHETIC_SEGMENT = '$key'
const ITEM_INDEX_SYNTHETIC_SEGMENT = '$index'
const ROW_INDEX_SYNTHETIC_SEGMENT = '$index'

interface ParseRuntimeReferenceOptions {
  allowItemReference?: boolean
  allowRowReference?: boolean
}

export function parseRuntimeReference(value: string, options: ParseRuntimeReferenceOptions = {}): RuntimeReferenceParseResult {
  if (value.startsWith('\\') && REFERENCE_PATTERN.test(value.slice(1))) {
    return {
      kind: 'literal',
      value: value.slice(1),
    }
  }

  if (!hasRecognizedNamespace(value)) {
    return {
      kind: 'literal',
      value,
    }
  }

  const parts = value.split('.')
  const [namespace, ...path] = parts as [RuntimeReferenceNamespace, ...string[]]

  if (!hasValidReferenceShape(namespace, path)) {
    return createInvalidReference(namespace, path, value)
  }

  if (namespace === 'item') {
    if (options.allowItemReference) {
      return {
        kind: 'reference',
        status: 'supported',
        namespace,
        path,
        source: value,
      } satisfies RuntimeSupportedReference
    }

    return {
      kind: 'reference',
      status: 'unsupported',
      namespace,
      path,
      source: value,
    } satisfies RuntimeUnsupportedReference
  }

  if (namespace === 'row') {
    if (options.allowRowReference) {
      return {
        kind: 'reference',
        status: 'supported',
        namespace,
        path,
        source: value,
      } satisfies RuntimeSupportedReference
    }

    return {
      kind: 'reference',
      status: 'unsupported',
      namespace,
      path,
      source: value,
    } satisfies RuntimeUnsupportedReference
  }

  if (isSupportedNamespace(namespace)) {
    return {
      kind: 'reference',
      status: 'supported',
      namespace,
      path,
      source: value,
    } satisfies RuntimeSupportedReference
  }

  if (isReservedNamespace(namespace)) {
    return {
      kind: 'reference',
      status: 'unsupported',
      namespace,
      path,
      source: value,
    } satisfies RuntimeUnsupportedReference
  }

  return {
    kind: 'literal',
    value,
  }
}

function isSupportedNamespace(namespace: RuntimeReferenceNamespace): namespace is Exclude<RuntimeSupportedReference['namespace'], 'item' | 'row'> {
  return SUPPORTED_NAMESPACES.has(namespace as Exclude<RuntimeSupportedReference['namespace'], 'item' | 'row'>)
}

function isReservedNamespace(namespace: RuntimeReferenceNamespace): namespace is 'navigation' | 'routeParams' {
  return RESERVED_NAMESPACES.has(namespace as 'navigation' | 'routeParams')
}

export function hasRuntimeTemplateDelimiter(value: string) {
  return value.includes('{{') || value.includes('}}')
}

function hasRecognizedNamespace(value: string): boolean {
  const namespace = value.split('.')[0]

  return (
    namespace === 'item' ||
    namespace === 'row' ||
    namespace === 'forms' ||
    namespace === 'queries' ||
    namespace === 'navigation' ||
    namespace === 'routeParams' ||
    namespace === 'params' ||
    namespace === 'translations' ||
    namespace === 'tokens'
  )
}

function hasValidReferenceShape(namespace: RuntimeReferenceNamespace, path: string[]) {
  if (namespace === 'item' && path.length === 1 && (path[0] === ITEM_KEY_SYNTHETIC_SEGMENT || path[0] === ITEM_INDEX_SYNTHETIC_SEGMENT)) {
    return true
  }

  if (namespace === 'row' && path.length === 1 && path[0] === ROW_INDEX_SYNTHETIC_SEGMENT) {
    return true
  }

  if (path.some((segment) => segment.length === 0 || !REFERENCE_SEGMENT_PATTERN.test(segment))) {
    return false
  }

  switch (namespace) {
    case 'item':
      return path.length >= 0
    case 'row':
      return path.length >= 0
    case 'forms':
      if (path.length === 0) {
        return false
      }

      return path.length === 2
    case 'queries':
      if (path.length === 0) {
        return false
      }

      return hasValidQueryReferencePath(path)
    case 'params':
      if (path.length === 0) {
        return false
      }

      return path.length === 1
    case 'translations':
      return path.length === 1
    case 'tokens':
      return path.length === 2 && path[1] === 'value'
    case 'navigation':
    case 'routeParams':
      if (path.length === 0) {
        return false
      }

      return path.length >= 1
  }
}

function isSupportedQueryProperty(segment: string) {
  return segment === 'data' || segment === 'status' || segment === 'error'
}

function hasValidQueryReferencePath(path: string[]) {
  if (path.length === 1) {
    return true
  }

  if (path.length === 2) {
    return isSupportedQueryProperty(path[1])
  }

  if (path.length === 3 && path[1] === 'error') {
    return path[2] === 'message' || path[2] === 'code'
  }

  return path[1] === 'data'
}

function createInvalidReference(
  namespace: RuntimeReferenceNamespace,
  path: string[],
  source: string,
): RuntimeInvalidReference {
  return {
    kind: 'reference',
    status: 'invalid',
    namespace,
    path,
    source,
  }
}
