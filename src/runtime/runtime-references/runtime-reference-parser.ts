import type {
  RuntimeInvalidReference,
  RuntimeReferenceNamespace,
  RuntimeReferenceParseResult,
  RuntimeSupportedReference,
  RuntimeUnsupportedReference,
} from './runtime-reference-types'

const SUPPORTED_NAMESPACES = new Set<RuntimeReferenceNamespace>(['forms', 'queries', 'params'])
const RESERVED_NAMESPACES = new Set<RuntimeReferenceNamespace>(['navigation', 'routeParams'])
const REFERENCE_PATTERN = /^(forms|queries|navigation|routeParams|params)(\.[A-Za-z0-9_-]+)+$/
const REFERENCE_SEGMENT_PATTERN = /^[A-Za-z0-9_-]+$/

export function parseRuntimeReference(value: string): RuntimeReferenceParseResult {
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

  if (SUPPORTED_NAMESPACES.has(namespace)) {
    return {
      kind: 'reference',
      status: 'supported',
      namespace,
      path,
      source: value,
    } satisfies RuntimeSupportedReference
  }

  if (RESERVED_NAMESPACES.has(namespace)) {
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

function hasRecognizedNamespace(value: string): boolean {
  const namespace = value.split('.')[0]

  return (
    namespace === 'forms' ||
    namespace === 'queries' ||
    namespace === 'navigation' ||
    namespace === 'routeParams' ||
    namespace === 'params'
  )
}

function hasValidReferenceShape(namespace: RuntimeReferenceNamespace, path: string[]) {
  if (
    path.length === 0 ||
    path.some((segment) => segment.length === 0 || !REFERENCE_SEGMENT_PATTERN.test(segment))
  ) {
    return false
  }

  switch (namespace) {
    case 'forms':
      return path.length === 2
    case 'queries':
      return hasValidQueryReferencePath(path)
    case 'params':
      return path.length === 1
    case 'navigation':
    case 'routeParams':
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
