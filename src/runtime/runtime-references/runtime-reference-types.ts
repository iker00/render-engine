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

/**
 * Contexto de grupo ambiente (T10 / feature reusable-node-groups): los valores de parámetro
 * (`paramValues`) del `group` que envuelve el punto de render en curso, usados para resolver
 * `group.{paramName}` sin acceder al store global. `null` fuera de cualquier `group` degrada
 * `group.*` al mismo criterio de "no encontrado" que el resto de referencias sin dato.
 */
export type RuntimeGroupContext = {
  paramValues: Record<string, unknown>
} | null
