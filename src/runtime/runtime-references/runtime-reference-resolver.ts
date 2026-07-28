import type { RuntimeState } from '../runtime-state/runtime-state-types'
import {
  selectCurrentPageParams,
  selectFormFieldState,
  selectFormFieldValue,
  selectNestedQueryDataValue,
  selectQueryState,
  selectQueryReferenceValue,
} from '../runtime-state/runtime-state-selectors'
import {
  reportRuntimeFormatterChainDiagnostic,
  reportRuntimeReferenceDiagnostic,
} from './runtime-reference-diagnostics'
import type { RuntimeReferenceSurface } from './runtime-reference-diagnostics'
import { hasFormatterSyntax, parseFormatterPlaceholder } from './runtime-formatter-parser'
import { applyFormatterChain, findFirstFailingFormatterName } from './runtime-formatter-registry'
import { parseRuntimeReference } from '../../config/runtime-reference-syntax'
import type {
  RuntimeReferenceResolutionResult,
  RuntimeTokenErrorResolution,
} from './runtime-reference-types'
import type { RuntimeSupportedReference } from '../../config/runtime-reference-syntax'

export interface RuntimeIterationContext {
  item: unknown
  key: string
  itemKey?: string
  itemIndex: number
}

interface ResolveRuntimeReferenceOptions {
  iterationContext?: RuntimeIterationContext
  localPlaceholders?: Record<string, string>
}

const RUNTIME_TEMPLATE_PLACEHOLDER_DETECTOR = /\{\{[\s\S]*?\}\}/
export const RUNTIME_TEMPLATE_PLACEHOLDER_PATTERN = /\{\{([\s\S]*?)\}\}/g

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

    if ('tokenError' in resolvedValue) {
      return {
        status: 'token-error',
        reference: parsedReference,
      } satisfies RuntimeTokenErrorResolution
    }

    if ('found' in resolvedValue && resolvedValue.found) {
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
  surface: RuntimeReferenceSurface,
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

  if (hasRuntimeVisibleStringInterpolation(value)) {
    return resolveRuntimeInterpolatedVisibleValue(value, state, surface, options)
  }

  const result = resolveRuntimeReference(value, state, options)
  reportRuntimeReferenceDiagnostic(result, surface)

  if (result.status === 'literal') {
    return result.value
  }

  if (result.status === 'token-error' || result.status !== 'resolved') {
    return ''
  }

  if (typeof result.value === 'string' || typeof result.value === 'number' || typeof result.value === 'boolean') {
    return result.value
  }

  return ''
}

function hasRuntimeVisibleStringInterpolation(value: string) {
  return RUNTIME_TEMPLATE_PLACEHOLDER_DETECTOR.test(value)
}

function resolveRuntimeInterpolatedVisibleValue(
  value: string,
  state: RuntimeState,
  surface: RuntimeReferenceSurface,
  options: ResolveRuntimeReferenceOptions,
) {
  return value.replace(RUNTIME_TEMPLATE_PLACEHOLDER_PATTERN, (placeholder, rawReference) => {
    const referenceValue = rawReference.trim()

    if (referenceValue.length === 0) {
      return ''
    }

    if (options.localPlaceholders && Object.hasOwn(options.localPlaceholders, referenceValue)) {
      return options.localPlaceholders[referenceValue]
    }

    if (!hasFormatterSyntax(rawReference)) {
      return resolveVisiblePlaceholderReference(referenceValue, state, surface, options)
    }

    const parseResult = parseFormatterPlaceholder(rawReference)

    if (parseResult.status === 'unresolvable-chain') {
      return ''
    }

    if (parseResult.status === 'no-formatters') {
      return resolveVisiblePlaceholderReference(parseResult.reference, state, surface, options)
    }

    const result = resolveRuntimeReference(parseResult.reference, state, options)

    if (result.status === 'literal') {
      return ''
    }

    reportRuntimeReferenceDiagnostic(result, surface)

    if (result.status !== 'resolved') {
      return ''
    }

    const chainResult = applyFormatterChain(result.value, parseResult.formatters)

    if (chainResult.status !== 'ok') {
      const failingName = findFirstFailingFormatterName(result.value, parseResult.formatters)
      reportRuntimeFormatterChainDiagnostic(placeholder, failingName, surface)
      return ''
    }

    return normalizeRuntimeTextValue(chainResult.value)
  })
}

function resolveVisiblePlaceholderReference(
  referenceValue: string,
  state: RuntimeState,
  surface: RuntimeReferenceSurface,
  options: ResolveRuntimeReferenceOptions,
) {
  const result = resolveRuntimeReference(referenceValue, state, options)

  if (result.status === 'literal') {
    return ''
  }

  reportRuntimeReferenceDiagnostic(result, surface)

  if (result.status !== 'resolved') {
    return ''
  }

  return normalizeRuntimeTextValue(result.value)
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
): { found: true; value: unknown } | { found: false } | { tokenError: true } {
  if (reference.namespace === 'tokens') {
    const [tokenId] = reference.path
    const tokenState = (state.tokens ?? {})[tokenId]

    if (tokenState === undefined) {
      return { found: false }
    }

    if (tokenState.status === 'error') {
      return { tokenError: true }
    }

    return { found: true, value: tokenState.value }
  }

  if (reference.namespace === 'translations') {
    const key = reference.path[0]
    const { translations, activeLanguage } = state.i18n
    const entry = translations[key]

    if (entry) {
      if (typeof entry[activeLanguage] === 'string') {
        return { found: true, value: entry[activeLanguage] } as const
      }

      if (activeLanguage !== 'es' && typeof entry['es'] === 'string') {
        return { found: true, value: entry['es'] } as const
      }
    }

    const fallbackValue = import.meta.env.DEV ? key : ''
    return { found: true, value: fallbackValue } as const
  }

  if (reference.namespace === 'item') {
    if (reference.path.length === 1 && reference.path[0] === '$key') {
      if (iterationContext?.itemKey !== undefined) {
        return {
          found: true,
          value: iterationContext.itemKey,
        } as const
      }

      return {
        found: false,
      } as const
    }

    if (reference.path.length === 1 && reference.path[0] === '$index') {
      if (iterationContext?.itemIndex !== undefined) {
        return {
          found: true,
          value: iterationContext.itemIndex,
        } as const
      }

      return {
        found: false,
      } as const
    }

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

  if (property === 'error' && nestedDataPath.length === 1 && (nestedDataPath[0] === 'message' || nestedDataPath[0] === 'code')) {
    const errorState = queryState.error

    if (errorState === null) {
      return { found: false } as const
    }

    const subValue = errorState[nestedDataPath[0] as 'message' | 'code']

    if (typeof subValue !== 'string') {
      return { found: false } as const
    }

    return { found: true, value: subValue } as const
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

  let currentValue: unknown = rootValue

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
