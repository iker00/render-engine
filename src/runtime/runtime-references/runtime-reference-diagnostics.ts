import type { RuntimeReferenceResolutionResult } from './runtime-reference-types'

export type RuntimeReferenceSurface =
  | 'heading.props.text'
  | 'paragraph.props.text'
  | 'button.props.label'
  | 'input.props.label'
  | 'textarea.props.label'
  | 'select.props.label'
  | 'radioGroup.props.label'
  | 'checkboxGroup.props.label'
  | 'list.props.items'
  | 'select.props.items.label'
  | 'select.props.items.value'
  | 'radioGroup.props.items.label'
  | 'radioGroup.props.items.value'
  | 'checkboxGroup.props.items.label'
  | 'checkboxGroup.props.items.value'
  | 'image.props.src'
  | 'image.props.alt'
  | 'table.cell'
  | 'api.endpoint'
  | 'alert.props.message'
  | 'alert.props.title'
  | 'badge.props.label'
  | 'link.props.label'
  | 'link.props.href'
  | 'stat.props.label'
  | 'stat.props.value'
  | `accordion[${string}].props.label`
  | `tabs[${string}].props.items[${string}].label`

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
