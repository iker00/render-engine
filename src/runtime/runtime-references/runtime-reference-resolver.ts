import type { RuntimeState } from '../runtime-state/runtime-state-types'
import {
  selectCurrentPageParams,
  selectFormFieldState,
  selectFormFieldValue,
  selectNestedQueryDataValue,
  selectQueryState,
  selectQueryReferenceValue,
} from '../runtime-state/runtime-state-selectors'
import { reportRuntimeReferenceDiagnostic } from './runtime-reference-diagnostics'
import type { RuntimeReferenceSurface } from './runtime-reference-diagnostics'
import { parseRuntimeReference } from './runtime-reference-parser'
import type {
  RuntimeReferenceResolutionResult,
  RuntimeSupportedReference,
} from './runtime-reference-types'

export interface RuntimeIterationContext {
  item: unknown
}

interface ResolveRuntimeReferenceOptions {
  iterationContext?: RuntimeIterationContext
}

export function resolveRuntimeReference(
  value: string,
  state?: RuntimeState,
  options: ResolveRuntimeReferenceOptions = {},
): RuntimeReferenceResolutionResult {
  const parsedReference = parseRuntimeReference(value, {
    allowItemReference: options.iterationContext !== undefined,
  })

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
    const resolvedValue = resolveSupportedReferenceValue(parsedReference, state, options.iterationContext)

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
  options: ResolveRuntimeReferenceOptions = {},
) {
  return normalizeRuntimeTextValue(resolveRuntimeVisibleValue(value, state, surface, options))
}

export function resolveRuntimeVisibleValue(
  value: string | number | boolean,
  state: RuntimeState,
  surface: RuntimeReferenceSurface,
  options: ResolveRuntimeReferenceOptions = {},
) {
  if (typeof value !== 'string') {
    return value
  }

  const result = resolveRuntimeReference(value, state, options)
  reportRuntimeReferenceDiagnostic(result, surface)

  if (result.status === 'literal') {
    return result.value
  }

  if (result.status !== 'resolved') {
    return ''
  }

  if (typeof result.value === 'string' || typeof result.value === 'number' || typeof result.value === 'boolean') {
    return result.value
  }

  return ''
}

export function resolveRuntimeImageSource(
  value: string,
  state: RuntimeState,
  options: ResolveRuntimeReferenceOptions = {},
) {
  const resolvedValue = resolveRuntimeVisibleValue(value, state, 'image.props.src', options)

  if (typeof resolvedValue !== 'string' || resolvedValue.length === 0) {
    return null
  }

  return resolvedValue
}

export function resolveRuntimeImageAlt(
  value: string,
  state: RuntimeState,
  options: ResolveRuntimeReferenceOptions = {},
) {
  return normalizeRuntimeTextValue(resolveRuntimeVisibleValue(value, state, 'image.props.alt', options))
}

export function resolveRuntimeValue(value: unknown, state: RuntimeState) {
  return resolveRuntimeValueWithOptions(value, state)
}

export function resolveRuntimeValueWithOptions(
  value: unknown,
  state: RuntimeState,
  options: ResolveRuntimeReferenceOptions = {},
) {
  if (typeof value !== 'string') {
    return {
      status: 'resolved',
      value,
    } as const
  }

  const result = resolveRuntimeReference(value, state, options)

  if (result.status === 'literal') {
    return {
      status: 'resolved',
      value: result.value,
    } as const
  }

  if (result.status === 'resolved') {
    return result
  }

  return result
}

function resolveSupportedReferenceValue(
  reference: RuntimeSupportedReference,
  state: RuntimeState,
  iterationContext?: RuntimeIterationContext,
) {
  if (reference.namespace === 'item') {
    return resolveNestedReferenceValue(iterationContext?.item, reference.path)
  }

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

  if (reference.namespace === 'params') {
    const [paramName] = reference.path
    const params = selectCurrentPageParams(state)

    if (!Object.hasOwn(params, paramName)) {
      return {
        found: false,
      } as const
    }

    return {
      found: true,
      value: params[paramName],
    } as const
  }

  const [queryName, property, ...nestedDataPath] = reference.path as [
    string,
    ('data' | 'status' | 'error')?,
    ...string[],
  ]
  const queryState = selectQueryState(state, queryName)

  if (queryState === null) {
    return {
      found: false,
    } as const
  }

  if (property === 'data' && nestedDataPath.length > 0) {
    return selectNestedQueryDataValue(state, queryName, nestedDataPath)
  }

  return {
    found: true,
    value: selectQueryReferenceValue(state, queryName, property),
  } as const
}

function resolveNestedReferenceValue(rootValue: unknown, path: string[]) {
  if (typeof rootValue === 'undefined') {
    return {
      found: false,
    } as const
  }

  let currentValue = rootValue

  for (const segment of path) {
    if (currentValue == null) {
      return {
        found: false,
      } as const
    }

    if (Array.isArray(currentValue)) {
      if (!isArrayIndexSegment(segment)) {
        return {
          found: false,
        } as const
      }

      currentValue = currentValue[Number(segment)]

      if (typeof currentValue === 'undefined') {
        return {
          found: false,
        } as const
      }

      continue
    }

    if (typeof currentValue !== 'object') {
      return {
        found: false,
      } as const
    }

    const objectValue = currentValue as Record<string, unknown>

    if (!Object.hasOwn(objectValue, segment)) {
      return {
        found: false,
      } as const
    }

    currentValue = objectValue[segment]
  }

  return {
    found: true,
    value: currentValue,
  } as const
}

function isArrayIndexSegment(segment: string) {
  return /^(0|[1-9]\d*)$/.test(segment)
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
