import type { RuntimeApiBodyValue, RuntimeApiHeaders } from '../config/runtime-config'
import {
  resolveRuntimeReference,
  RUNTIME_TEMPLATE_PLACEHOLDER_PATTERN,
} from '../runtime/runtime-references/runtime-reference-resolver'
import type { RuntimeIterationContext } from '../runtime/runtime-references/runtime-reference-resolver'
import { reportRuntimeFormatterChainDiagnostic } from '../runtime/runtime-references/runtime-reference-diagnostics'
import {
  hasFormatterSyntax,
  parseFormatterPlaceholder,
} from '../runtime/runtime-references/runtime-formatter-parser'
import type { RuntimeFormatterInvocation } from '../runtime/runtime-references/runtime-formatter-parser'
import {
  applyFormatterChain,
  findFirstFailingFormatterName,
} from '../runtime/runtime-references/runtime-formatter-registry'
import type { RuntimeState } from '../runtime/runtime-state/runtime-state-types'
import type { RuntimeApiEmptySubmitValues, RuntimeApiHiddenFormFields } from './runtime-api-types'

interface ResolvePayloadValueOptions {
  state: RuntimeState
  iterationContext?: RuntimeIterationContext
  hiddenFormFields?: RuntimeApiHiddenFormFields
  emptySubmitValues?: RuntimeApiEmptySubmitValues
  fileValueOverrides?: ReadonlyMap<string, RuntimeApiBodyValue[]>
}

export function resolvePayloadValue(
  value: string | number | boolean,
  options: ResolvePayloadValueOptions,
):
  | { status: 'ready'; value: string | number | boolean }
  | { status: 'omit' }
  | { status: 'error' }
  | { status: 'token-error'; tokenId: string } {
  const { state, iterationContext, hiddenFormFields, emptySubmitValues } = options

  if (typeof value !== 'string') {
    return {
      status: 'ready',
      value,
    } as const
  }

  const resolvedReference = resolveRuntimeReference(value, state, { iterationContext })

  if (resolvedReference.status === 'literal') {
    return {
      status: 'ready',
      value: resolvedReference.value,
    } as const
  }

  if (resolvedReference.status === 'token-error') {
    return {
      status: 'token-error',
      tokenId: resolvedReference.reference.path[0],
    } as const
  }

  if (resolvedReference.status === 'resolved') {
    if (
      hiddenFormFields !== undefined &&
      resolvedReference.reference.namespace === 'forms' &&
      resolvedReference.reference.path.length === 2 &&
      resolvedReference.reference.path[0] === hiddenFormFields.formId &&
      hiddenFormFields.fieldIds.has(resolvedReference.reference.path[1])
    ) {
      return {
        status: 'omit',
      } as const
    }

    if (
      resolvedReference.value === '' &&
      emptySubmitValues !== undefined &&
      resolvedReference.reference.namespace === 'forms' &&
      resolvedReference.reference.path.length === 2 &&
      resolvedReference.reference.path[0] === emptySubmitValues.formId &&
      emptySubmitValues.valuesByFieldId.has(resolvedReference.reference.path[1])
    ) {
      return {
        status: 'ready',
        value: String(emptySubmitValues.valuesByFieldId.get(resolvedReference.reference.path[1])),
      } as const
    }

    return {
      status: 'ready',
      value: resolvedReference.value as string | number | boolean,
    } as const
  }

  if (
    resolvedReference.status === 'missing' &&
    hiddenFormFields !== undefined &&
    resolvedReference.reference.namespace === 'forms' &&
    resolvedReference.reference.path.length === 2 &&
    resolvedReference.reference.path[0] === hiddenFormFields.formId &&
    hiddenFormFields.fieldIds.has(resolvedReference.reference.path[1])
  ) {
    return {
      status: 'omit',
    } as const
  }

  return {
    status: 'error',
  } as const
}

/**
 * Body-only substitution channel: when a body string is a complete, unsuffixed
 * `forms.{formId}.{fieldId}` reference and `fileValueOverrides` carries a
 * precomputed array for `"${formId}.${fieldId}"`, that array replaces the
 * resolved value — used by file inputs to inject their base64-encoded
 * selection instead of the unresolvable `File`/`File[]` form value.
 *
 * Hidden-field omission still takes priority over the override. Returns
 * `null` when `value` is not a candidate (no overrides configured, not a
 * complete two-segment `forms.*` reference, or no matching override key) so
 * the caller falls back to the existing resolution flow unchanged.
 */
function resolveFileValueOverride(
  value: string,
  options: ResolvePayloadValueOptions,
): { status: 'ready'; value: RuntimeApiBodyValue[] } | { status: 'omit' } | null {
  const { state, iterationContext, hiddenFormFields, fileValueOverrides } = options

  if (fileValueOverrides === undefined) {
    return null
  }

  const resolvedReference = resolveRuntimeReference(value, state, { iterationContext })

  const reference =
    resolvedReference.status === 'resolved' || resolvedReference.status === 'missing'
      ? resolvedReference.reference
      : null

  if (reference === null || reference.namespace !== 'forms' || reference.path.length !== 2) {
    return null
  }

  const [formId, fieldId] = reference.path

  if (
    hiddenFormFields !== undefined &&
    hiddenFormFields.formId === formId &&
    hiddenFormFields.fieldIds.has(fieldId)
  ) {
    return { status: 'omit' } as const
  }

  const overrideKey = `${formId}.${fieldId}`

  if (!fileValueOverrides.has(overrideKey)) {
    return null
  }

  return {
    status: 'ready',
    value: fileValueOverrides.get(overrideKey) as RuntimeApiBodyValue[],
  } as const
}

export function resolveJsonPayloadValue(
  value: RuntimeApiBodyValue,
  options: ResolvePayloadValueOptions,
): { status: 'ready'; value: RuntimeApiBodyValue } | { status: 'omit' } | { status: 'error' } | { status: 'token-error'; tokenId: string } {
  if (value === null) {
    return {
      status: 'ready',
      value: null,
    } as const
  }

  if (typeof value === 'string') {
    const fileValueOverrideResult = resolveFileValueOverride(value, options)

    if (fileValueOverrideResult !== null) {
      return fileValueOverrideResult
    }

    const resolvedValue = resolvePayloadValue(value, options)

    if (resolvedValue.status === 'omit') {
      return { status: 'omit' } as const
    }

    if (resolvedValue.status === 'token-error') {
      return resolvedValue
    }

    if (resolvedValue.status === 'error' || !isRuntimeApiBodyRuntimeValue(resolvedValue.value)) {
      return {
        status: 'error',
      } as const
    }

    return {
      status: 'ready',
      value: resolvedValue.value,
    }
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return {
      status: 'ready',
      value,
    } as const
  }

  if (Array.isArray(value)) {
    const resolvedItems: RuntimeApiBodyValue[] = []

    for (const item of value) {
      const resolvedItem = resolveJsonPayloadValue(item, options)

      if (resolvedItem.status === 'omit') {
        // Arrays cannot have entries silently removed — treat as error
        return { status: 'error' } as const
      }

      if (resolvedItem.status === 'token-error') {
        return resolvedItem
      }

      if (resolvedItem.status === 'error') {
        return resolvedItem
      }

      resolvedItems.push(resolvedItem.value)
    }

    return {
      status: 'ready',
      value: resolvedItems,
    } as const
  }

  const resolvedObject: Record<string, RuntimeApiBodyValue> = {}

  for (const [key, childValue] of Object.entries(value)) {
    const resolvedChild = resolveJsonPayloadValue(childValue, options)

    if (resolvedChild.status === 'omit') {
      // Skip this key — omission at object level
      continue
    }

    if (resolvedChild.status === 'token-error') {
      return resolvedChild
    }

    if (resolvedChild.status === 'error') {
      return resolvedChild
    }

    resolvedObject[key] = resolvedChild.value
  }

  return {
    status: 'ready',
    value: resolvedObject,
  } as const
}

export function isRuntimeApiBodyRuntimeValue(value: unknown): value is RuntimeApiBodyValue {
  if (value === null) {
    return true
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return true
  }

  if (Array.isArray(value)) {
    return value.every((item) => isRuntimeApiBodyRuntimeValue(item))
  }

  if (!isPlainObject(value)) {
    return false
  }

  return Object.values(value).every((item) => isRuntimeApiBodyRuntimeValue(item))
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }

  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

export interface ResolveHeadersResult {
  status: 'ready'
  headers: RuntimeApiHeaders | undefined
}

export interface ResolveBodyResult {
  status: 'ready'
  body: RuntimeApiBodyValue | null | undefined
}

export interface ResolveFieldErrorResult {
  status: 'error'
  error: {
    code: 'request-build-failed' | 'token-refresh-failed'
    message: string
  }
}

type ResolveHeaderValueResult =
  | { status: 'ready'; value: string | number | boolean }
  | { status: 'omit' }
  | { status: 'error' }
  | { status: 'token-error'; tokenId: string }

/**
 * Resolves a single header value, supporting both plain references and
 * interpolated strings with `{{...}}` placeholders.
 *
 * If the value does not contain `{{`, it delegates to `resolvePayloadValue`
 * preserving the exact existing behavior (complete reference, literal, omit,
 * token-error, error).
 *
 * If the value contains `{{`, each placeholder is resolved individually and
 * the fragments are concatenated into the final string. The semantics for each
 * placeholder match D3 from the design:
 *   - empty/whitespace placeholder → error (request-build-failed)
 *   - token-error state → token-error propagation (cuts further processing)
 *   - hidden-form-field condition → omit (the whole header is omitted)
 *   - resolved string/number/boolean → inserted as string
 *   - resolved null/object/array, missing (non-omittable), invalid, unsupported,
 *     or literal → error (request-build-failed)
 */
function resolveHeaderTemplateValue(
  rawValue: string,
  headerKey: string,
  options: ResolvePayloadValueOptions,
): ResolveHeaderValueResult {
  if (!rawValue.includes('{{')) {
    // Delegate entirely to the existing resolver — no behavior change.
    // Non-string `ready` values are passed through so that `resolveHeaders`
    // can emit the original "unsupported header value" diagnostic message.
    return resolvePayloadValue(rawValue, options)
  }

  // Interpolation path
  const { state, iterationContext, hiddenFormFields, emptySubmitValues } = options

  let failed = false
  let tokenError: { tokenId: string } | null = null
  let shouldOmit = false

  // Reset lastIndex before iterating (global regex retains state between calls)
  RUNTIME_TEMPLATE_PLACEHOLDER_PATTERN.lastIndex = 0

  const resolved = rawValue.replace(RUNTIME_TEMPLATE_PLACEHOLDER_PATTERN, (_placeholder, rawReference: string) => {
    // Stop processing further placeholders once we've already hit an error
    if (failed || tokenError !== null || shouldOmit) {
      return ''
    }

    // Determine the reference to resolve and the formatter chain to apply.
    // Formatters (feature 0101, T4) reuse the same parser used by the visible
    // surfaces (T3) so that headers get the same semantics — with the
    // header-specific twist that unresolvable-chain / unresolvable formatter
    // application projects to failed=true instead of the visible "empty
    // placeholder" fallback. See design D5.
    let referenceValue: string
    let formatters: readonly RuntimeFormatterInvocation[] = []

    if (!hasFormatterSyntax(rawReference)) {
      referenceValue = rawReference.trim()

      if (referenceValue.length === 0) {
        failed = true
        return ''
      }
    } else {
      const parseResult = parseFormatterPlaceholder(rawReference)

      if (parseResult.status === 'unresolvable-chain') {
        failed = true
        return ''
      }

      referenceValue = parseResult.reference
      if (parseResult.status === 'ok') {
        formatters = parseResult.formatters
      }
    }

    const result = resolveRuntimeReference(referenceValue, state, { iterationContext })

    if (result.status === 'token-error') {
      tokenError = { tokenId: result.reference.path[0] }
      return ''
    }

    if (result.status === 'missing') {
      // Check hidden-form-field omission condition (same logic as resolvePayloadValue).
      // This check runs against the resolved reference, not the formatted value —
      // omission by hidden field is decided before applying any formatter (D5).
      if (
        hiddenFormFields !== undefined &&
        result.reference.namespace === 'forms' &&
        result.reference.path.length === 2 &&
        result.reference.path[0] === hiddenFormFields.formId &&
        hiddenFormFields.fieldIds.has(result.reference.path[1])
      ) {
        shouldOmit = true
        return ''
      }

      failed = true
      return ''
    }

    if (result.status === 'resolved') {
      // Check hidden-form-field omission condition for resolved references too.
      // Applied BEFORE the formatter chain (D5): a hidden field still omits the
      // header even if the placeholder carries a formatter chain.
      if (
        hiddenFormFields !== undefined &&
        result.reference.namespace === 'forms' &&
        result.reference.path.length === 2 &&
        result.reference.path[0] === hiddenFormFields.formId &&
        hiddenFormFields.fieldIds.has(result.reference.path[1])
      ) {
        shouldOmit = true
        return ''
      }

      let finalValue: unknown =
        result.value === '' &&
        emptySubmitValues !== undefined &&
        result.reference.namespace === 'forms' &&
        result.reference.path.length === 2 &&
        result.reference.path[0] === emptySubmitValues.formId &&
        emptySubmitValues.valuesByFieldId.has(result.reference.path[1])
          ? String(emptySubmitValues.valuesByFieldId.get(result.reference.path[1]))
          : result.value

      if (formatters.length > 0) {
        const chainResult = applyFormatterChain(result.value, formatters)

        if (chainResult.status !== 'ok') {
          const failingName = findFirstFailingFormatterName(result.value, formatters)
          reportRuntimeFormatterChainDiagnostic(
            _placeholder,
            failingName,
            `api.headers[${headerKey}]`,
          )
          failed = true
          return ''
        }

        finalValue = chainResult.value
      }

      if (typeof finalValue === 'string') {
        return finalValue
      }

      if (typeof finalValue === 'number' || typeof finalValue === 'boolean') {
        return String(finalValue)
      }

      // null, object, array — not serializable as header value
      failed = true
      return ''
    }

    // literal, invalid, unsupported — all produce request-build-failed
    failed = true
    return ''
  })

  if (tokenError !== null) {
    return { status: 'token-error', tokenId: (tokenError as { tokenId: string }).tokenId }
  }

  if (shouldOmit) {
    return { status: 'omit' }
  }

  if (failed) {
    return { status: 'error' }
  }

  return { status: 'ready', value: resolved }
}

export function resolveHeaders(
  headersDefinition: RuntimeApiHeaders | undefined,
  messagePrefix: string,
  options: ResolvePayloadValueOptions,
): ResolveHeadersResult | ResolveFieldErrorResult {
  if (!headersDefinition) {
    return {
      status: 'ready',
      headers: undefined,
    }
  }

  const headers: RuntimeApiHeaders = {}

  for (const [key, rawValue] of Object.entries(headersDefinition)) {
    const resolvedValue = resolveHeaderTemplateValue(rawValue, key, options)

    if (resolvedValue.status === 'omit') {
      // Skip this header key
      continue
    }

    if (resolvedValue.status === 'token-error') {
      return {
        status: 'error',
        error: {
          code: 'token-refresh-failed',
          message: `${messagePrefix} cannot build the request because token "${resolvedValue.tokenId}" is in error state.`,
        },
      }
    }

    if (resolvedValue.status === 'error') {
      return {
        status: 'error',
        error: {
          code: 'request-build-failed',
          message: `${messagePrefix} could not resolve "${rawValue}" for "headers.${key}".`,
        },
      }
    }

    if (typeof resolvedValue.value !== 'string') {
      return {
        status: 'error',
        error: {
          code: 'request-build-failed',
          message: `${messagePrefix} resolved "headers.${key}" to an unsupported header value.`,
        },
      }
    }

    headers[key] = resolvedValue.value
  }

  return {
    status: 'ready',
    headers,
  }
}

export function resolveBody(
  bodyDefinition: RuntimeApiBodyValue | undefined,
  messagePrefix: string,
  options: ResolvePayloadValueOptions,
): ResolveBodyResult | ResolveFieldErrorResult {
  if (bodyDefinition === undefined) {
    return {
      status: 'ready',
      body: undefined,
    }
  }

  if (bodyDefinition === null) {
    return {
      status: 'ready',
      body: null,
    }
  }

  const resolvedBody = resolveJsonPayloadValue(bodyDefinition, options)

  if (resolvedBody.status === 'token-error') {
    return {
      status: 'error',
      error: {
        code: 'token-refresh-failed',
        message: `${messagePrefix} cannot build the request because token "${resolvedBody.tokenId}" is in error state.`,
      },
    }
  }

  if (resolvedBody.status === 'error') {
    return {
      status: 'error',
      error: {
        code: 'request-build-failed',
        message: `${messagePrefix} could not build its JSON body.`,
      },
    }
  }

  if (resolvedBody.status === 'omit') {
    return {
      status: 'ready',
      body: undefined,
    }
  }

  return {
    status: 'ready',
    body: resolvedBody.value,
  }
}
