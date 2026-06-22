import type { RuntimeApiBodyValue, RuntimeApiHeaders } from '../config/runtime-config'
import { resolveRuntimeReference } from '../runtime/runtime-references/runtime-reference-resolver'
import type { RuntimeIterationContext } from '../runtime/runtime-references/runtime-reference-resolver'
import type { RuntimeState } from '../runtime/runtime-state/runtime-state-types'
import type { RuntimeApiHiddenFormFields } from './runtime-api-types'

interface ResolvePayloadValueOptions {
  state: RuntimeState
  iterationContext?: RuntimeIterationContext
  hiddenFormFields?: RuntimeApiHiddenFormFields
}

export function resolvePayloadValue(
  value: string | number | boolean,
  options: ResolvePayloadValueOptions,
) {
  const { state, iterationContext, hiddenFormFields } = options

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

    return {
      status: 'ready',
      value: resolvedReference.value,
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

export function resolveJsonPayloadValue(
  value: RuntimeApiBodyValue,
  options: ResolvePayloadValueOptions,
): { status: 'ready'; value: RuntimeApiBodyValue } | { status: 'omit' } | { status: 'error' } {
  if (value === null) {
    return {
      status: 'ready',
      value: null,
    } as const
  }

  if (typeof value === 'string') {
    const resolvedValue = resolvePayloadValue(value, options)

    if (resolvedValue.status === 'omit') {
      return { status: 'omit' } as const
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
    code: 'request-build-failed'
    message: string
  }
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
    const resolvedValue = resolvePayloadValue(rawValue, options)

    if (resolvedValue.status === 'omit') {
      // Skip this header key
      continue
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

  if (resolvedBody.status === 'error') {
    return {
      status: 'error',
      error: {
        code: 'request-build-failed',
        message: `${messagePrefix} could not build its JSON body.`,
      },
    }
  }

  return {
    status: 'ready',
    body: resolvedBody.value,
  }
}
