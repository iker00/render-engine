import type { RuntimeReferenceResolutionResult } from './runtime-reference-types'

export type RuntimeReferenceSurface = 'heading.props.text' | 'paragraph.props.text'

export function reportRuntimeReferenceDiagnostic(
  result: RuntimeReferenceResolutionResult,
  surface: RuntimeReferenceSurface,
) {
  if (!import.meta.env.DEV) {
    return
  }

  if (result.status === 'missing' || result.status === 'unsupported' || result.status === 'invalid') {
    console.warn(
      `[runtime-references] Could not resolve "${result.reference.source}" for ${surface} (${result.status}).`,
    )
  }
}
