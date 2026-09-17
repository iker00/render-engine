export type RuntimeReferenceNamespace =
  | 'item'
  | 'row'
  | 'switch'
  | 'forms'
  | 'queries'
  | 'navigation'
  | 'routeParams'
  | 'params'
  | 'group'
  | 't'
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
  namespace: 'item' | 'row' | 'switch' | 'forms' | 'queries' | 'params' | 'group' | 't' | 'tokens'
  path: string[]
  source: string
}

export interface RuntimeUnsupportedReference {
  kind: 'reference'
  status: 'unsupported'
  namespace: 'item' | 'row' | 'switch' | 'navigation' | 'routeParams'
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

const SUPPORTED_NAMESPACES = new Set(['forms', 'queries', 'params', 'group', 't', 'tokens'] as const)
const RESERVED_NAMESPACES = new Set(['navigation', 'routeParams'] as const)
const REFERENCE_PATTERN = /^(item|row|switch|forms|queries|navigation|routeParams|params|group|t|tokens)(\.[A-Za-z0-9_-]+|\.\$lat|\.\$lng)*$/
const REFERENCE_SEGMENT_PATTERN = /^[A-Za-z0-9_-]+$/
const ITEM_KEY_SYNTHETIC_SEGMENT = '$key'
const ITEM_INDEX_SYNTHETIC_SEGMENT = '$index'
const ROW_INDEX_SYNTHETIC_SEGMENT = '$index'
const SWITCH_NEXT_SYNTHETIC_SEGMENT = 'next'
const FORM_LAT_SYNTHETIC_SEGMENT = '$lat'
const FORM_LNG_SYNTHETIC_SEGMENT = '$lng'

interface ParseRuntimeReferenceOptions {
  allowItemReference?: boolean
  allowRowReference?: boolean
  allowSwitchNextReference?: boolean
  allowFormCoordinateReference?: boolean
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

  if (!hasValidReferenceShape(namespace, path, options)) {
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

  if (namespace === 'switch') {
    if (options.allowSwitchNextReference) {
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

function isSupportedNamespace(namespace: RuntimeReferenceNamespace): namespace is Exclude<RuntimeSupportedReference['namespace'], 'item' | 'row' | 'switch'> {
  return SUPPORTED_NAMESPACES.has(namespace as Exclude<RuntimeSupportedReference['namespace'], 'item' | 'row' | 'switch'>)
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
    namespace === 'switch' ||
    namespace === 'forms' ||
    namespace === 'queries' ||
    namespace === 'navigation' ||
    namespace === 'routeParams' ||
    namespace === 'params' ||
    namespace === 'group' ||
    namespace === 't' ||
    namespace === 'tokens'
  )
}

function hasValidReferenceShape(namespace: RuntimeReferenceNamespace, path: string[], options: ParseRuntimeReferenceOptions) {
  if (namespace === 'item' && path.length === 1 && (path[0] === ITEM_KEY_SYNTHETIC_SEGMENT || path[0] === ITEM_INDEX_SYNTHETIC_SEGMENT)) {
    return true
  }

  if (namespace === 'row' && path.length === 1 && path[0] === ROW_INDEX_SYNTHETIC_SEGMENT) {
    return true
  }

  if (namespace === 'switch' && path.length === 1 && path[0] === SWITCH_NEXT_SYNTHETIC_SEGMENT) {
    return true
  }

  if (
    namespace === 'forms' &&
    path.length === 3 &&
    (path[2] === FORM_LAT_SYNTHETIC_SEGMENT || path[2] === FORM_LNG_SYNTHETIC_SEGMENT) &&
    options.allowFormCoordinateReference
  ) {
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
    case 'switch':
      return false
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
    case 'group':
      if (path.length === 0) {
        return false
      }

      return path.length === 1
    case 't':
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
