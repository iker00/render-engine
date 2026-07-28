import type { RuntimeInvalidReference, RuntimeSupportedReference, RuntimeUnsupportedReference } from '../../config/runtime-reference-syntax'

export type RuntimeReferenceResolutionResult =
  | RuntimeLiteralResolution
  | RuntimeResolvedReference
  | RuntimeMissingReference
  | RuntimeUnsupportedResolution
  | RuntimeInvalidResolution
  | RuntimeTokenErrorResolution

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

export interface RuntimeTokenErrorResolution {
  status: 'token-error'
  reference: RuntimeSupportedReference
}
