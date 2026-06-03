export type RuntimeReferenceNamespace =
  | 'item'
  | 'forms'
  | 'queries'
  | 'navigation'
  | 'routeParams'
  | 'params'
  | 'translations'

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
  namespace: 'item' | 'forms' | 'queries' | 'params' | 'translations'
  path: string[]
  source: string
}

export interface RuntimeUnsupportedReference {
  kind: 'reference'
  status: 'unsupported'
  namespace: 'item' | 'navigation' | 'routeParams'
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

export type RuntimeReferenceResolutionResult =
  | RuntimeLiteralResolution
  | RuntimeResolvedReference
  | RuntimeMissingReference
  | RuntimeUnsupportedResolution
  | RuntimeInvalidResolution

export interface RuntimeLiteralResolution {
  status: 'literal'
  value: string
}

export interface RuntimeResolvedReference {
  status: 'resolved'
  value: unknown
  reference: RuntimeSupportedReference
}

export interface RuntimeMissingReference {
  status: 'missing'
  reference: RuntimeSupportedReference
}

export interface RuntimeUnsupportedResolution {
  status: 'unsupported'
  reference: RuntimeUnsupportedReference
}

export interface RuntimeInvalidResolution {
  status: 'invalid'
  reference: RuntimeInvalidReference
}
