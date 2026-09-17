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
  | 'autocomplete.props.label'
  | 'addressPicker.props.label'
  | 'list.props.items'
  | 'select.props.items.label'
  | 'select.props.items.value'
  | 'radioGroup.props.items.label'
  | 'radioGroup.props.items.value'
  | 'checkboxGroup.props.items.label'
  | 'checkboxGroup.props.items.value'
  | 'autocomplete.props.items.label'
  | 'autocomplete.props.items.value'
  | 'image.props.src'
  | 'image.props.alt'
  | 'table.cell'
  | 'api.endpoint'
  | `api.headers[${string}]`
  | 'alert.props.message'
  | 'alert.props.title'
  | 'badge.props.label'
  | 'link.props.label'
  | 'link.props.href'
  | 'stat.props.label'
  | 'stat.props.value'
  | `accordion[${string}].props.label`
  | `tabs[${string}].props.items[${string}].label`
  | `steps[${string}].props.items[${string}].label`
  | `steps[${string}].props.backLabel`
  | `steps[${string}].props.nextLabel`
  | `steps[${string}].props.submitLabel`
  | 'input.props.placeholder'
  | 'textarea.props.placeholder'
  | 'select.props.placeholder'
  | 'autocomplete.props.placeholder'
  | 'form.validation.message'
  | `fileManager.props.labels.${string}`
  | 'fileManager.props.validations.message'
  | 'toggle.props.label'
  | 'input.props.tooltip'
  | 'textarea.props.tooltip'
  | 'select.props.tooltip'
  | 'radioGroup.props.tooltip'
  | 'checkboxGroup.props.tooltip'
  | 'toggle.props.tooltip'
  | 'fileInput.props.tooltip'
  | 'autocomplete.props.tooltip'
  | 'shell.header.title'
  | 'shell.header.menu.item.label'
  | 'shell.header.menu.item.href'
  | 'shell.sidebar.item.label'
  | 'shell.sidebar.item.href'
  | 'map.props.markerSources.label'
  | 'chart.props.source.category'
  | 'gallery.props.images.src'
  | 'gallery.props.images.alt'
  | 'button.props.action.filename'
  | 'link.props.action.filename'

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

export function reportRuntimeFormatterChainDiagnostic(
  rawPlaceholder: string,
  firstFailingFormatterName: string | null,
  surface: RuntimeReferenceSurface,
) {
  if (!import.meta.env.DEV) {
    return
  }

  const formatterLabel = firstFailingFormatterName ?? 'unknown'
  console.warn(
    `[runtime-formatters] Chain unresolvable for "${rawPlaceholder}" (formatter: ${formatterLabel}) at ${surface}.`,
  )
}
