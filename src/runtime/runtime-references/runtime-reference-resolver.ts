import type { RuntimeState } from '../runtime-state/runtime-state-types'
import {
  selectFormFieldState,
  selectFormFieldValue,
  selectQueryState,
  selectQueryReferenceValue,
} from '../runtime-state/runtime-state-selectors'
import { reportRuntimeReferenceDiagnostic } from './runtime-reference-diagnostics'
import { parseRuntimeReference } from './runtime-reference-parser'
import type {
  RuntimeReferenceResolutionResult,
  RuntimeSupportedReference,
} from './runtime-reference-types'

export function resolveRuntimeReference(
  value: string,
  state?: RuntimeState,
): RuntimeReferenceResolutionResult {
  const parsedReference = parseRuntimeReference(value)

  if (parsedReference.kind === 'literal') {
    return {
      status: 'literal',
      value: parsedReference.value,
    }
  }

  if (parsedReference.status === 'unsupported') {
    return {
      status: 'unsupported',
      reference: parsedReference,
    }
  }

  if (parsedReference.status === 'invalid') {
    return {
      status: 'invalid',
      reference: parsedReference,
    }
  }

  if (state) {
    const resolvedValue = resolveSupportedReferenceValue(parsedReference, state)

    if (resolvedValue.found) {
      return {
        status: 'resolved',
        value: resolvedValue.value,
        reference: parsedReference,
      }
    }
  }

  return {
    status: 'missing',
    reference: parsedReference,
  }
}

export function resolveRuntimeTextReference(
  value: string,
  state: RuntimeState,
  surface: 'heading.props.text' | 'paragraph.props.text',
) {
  const result = resolveRuntimeReference(value, state)
  reportRuntimeReferenceDiagnostic(result, surface)

  if (result.status === 'literal') {
    return result.value
  }

  if (result.status !== 'resolved') {
    return ''
  }

  return normalizeRuntimeTextValue(result.value)
}

function resolveSupportedReferenceValue(reference: RuntimeSupportedReference, state: RuntimeState) {
  if (reference.namespace === 'forms') {
    const [formId, fieldId] = reference.path
    const fieldState = selectFormFieldState(state, formId, fieldId)

    if (fieldState === null) {
      return {
        found: false,
      } as const
    }

    return {
      found: true,
      value: selectFormFieldValue(state, formId, fieldId),
    } as const
  }

  const [queryName, property] = reference.path as [string, ('data' | 'status' | 'error')?]
  const queryState = selectQueryState(state, queryName)

  if (queryState === null) {
    return {
      found: false,
    } as const
  }

  return {
    found: true,
    value: selectQueryReferenceValue(state, queryName, property),
  } as const
}

function normalizeRuntimeTextValue(value: unknown) {
  if (typeof value === 'string') {
    return value
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }

  return ''
}
