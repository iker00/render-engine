import type { FileManagerLabelKey, FileManagerLabels } from '../../../config/runtime-config-types'
import type { RuntimeIterationContext } from '../../runtime-references/runtime-reference-resolver'
import { resolveRuntimeTextReference } from '../../runtime-references/runtime-reference-resolver'
import type { RuntimeState } from '../../runtime-state/runtime-state-types'

export function resolveFileManagerLabel({
  labels,
  key,
  defaultText,
  placeholders,
  state,
  iterationContext,
}: {
  labels: FileManagerLabels | undefined
  key: FileManagerLabelKey
  defaultText: string
  placeholders?: Record<string, string>
  state: RuntimeState
  iterationContext?: RuntimeIterationContext
}): string {
  const rawLabel = labels?.[key]

  if (rawLabel === undefined) {
    return defaultText
  }

  if (rawLabel === '') {
    return ''
  }

  return resolveRuntimeTextReference(rawLabel, state, `fileManager.props.labels.${key}`, {
    iterationContext,
    localPlaceholders: placeholders,
  })
}
