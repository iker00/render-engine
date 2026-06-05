import type {
  RuntimeApiBodyValue,
  RuntimeApiHeaders,
  RuntimeApiOperation,
  RuntimeApiQuery,
  RuntimeApiRequestParams,
} from '../config/runtime-config'
import type {
  BuildRuntimeApiRequestOptions,
  RuntimeApiRequest,
  RuntimeApiRequestDescriptor,
  RuntimeApiRequestBuildResult,
} from './runtime-api-types'
import {
  resolvePayloadValue,
  resolveHeaders,
  resolveBody,
  isPlainObject,
} from './runtime-api-payload-resolver'
import {
  resolveRuntimeReference,
  RUNTIME_TEMPLATE_PLACEHOLDER_PATTERN,
} from '../runtime/runtime-references/runtime-reference-resolver'
import { reportRuntimeReferenceDiagnostic } from '../runtime/runtime-references/runtime-reference-diagnostics'

export function buildRuntimeApiRequest({
  config,
  operationName,
  state,
  requestParams,
  iterationContext,
}: BuildRuntimeApiRequestOptions): RuntimeApiRequestBuildResult {
  const operation = config.api[operationName]

  if (!operation) {
    return {
      status: 'error',
      error: {
        code: 'operation-not-found',
        message: `The api operation "${operationName}" does not exist.`,
      },
    }
  }

  const effectiveRequestParams = mergeRuntimeApiRequestParams(operation, requestParams)
  const resolveOptions = { state, iterationContext }
  const messagePrefix = `The api operation "${operationName}"`

  const endpointResult = resolveEndpoint(operationName, operation.endpoint, resolveOptions)

  if (endpointResult.status === 'error') {
    return endpointResult
  }

  const resolvedEndpoint = endpointResult.endpoint

  const queryResult = resolveQuery(operationName, effectiveRequestParams.query, resolveOptions)

  if (queryResult.status === 'error') {
    return queryResult
  }

  const bodyResult = resolveBody(effectiveRequestParams.body, messagePrefix, resolveOptions)

  if (bodyResult.status === 'error') {
    return bodyResult
  }

  const headersResult = resolveHeaders(effectiveRequestParams.headers, messagePrefix, resolveOptions)

  if (headersResult.status === 'error') {
    return headersResult
  }

  return {
    status: 'ready',
    request: createRuntimeApiRequest({
      operationName,
      operation,
      resolvedEndpoint,
      descriptor: {
        operationName,
        method: operation.method,
        endpoint: operation.endpoint,
        query: queryResult.query,
        body: bodyResult.body,
        headers: headersResult.headers,
      },
    }),
  }
}

function resolveEndpoint(
  operationName: string,
  endpoint: string,
  resolveOptions: Parameters<typeof resolvePayloadValue>[1],
): { status: 'ready'; endpoint: string } | { status: 'error'; error: { code: 'request-build-failed'; message: string } } {
  if (!endpoint.includes('{{')) {
    return { status: 'ready', endpoint }
  }

  const { state, iterationContext } = resolveOptions
  let failed = false
  let failedPlaceholder = ''

  // Reset lastIndex to ensure correct behavior with global regex
  RUNTIME_TEMPLATE_PLACEHOLDER_PATTERN.lastIndex = 0

  const resolved = endpoint.replace(RUNTIME_TEMPLATE_PLACEHOLDER_PATTERN, (_placeholder, rawReference) => {
    if (failed) {
      return ''
    }

    const referenceValue = rawReference.trim()

    if (referenceValue.length === 0) {
      failed = true
      failedPlaceholder = _placeholder
      return ''
    }

    const result = resolveRuntimeReference(referenceValue, state, { iterationContext })
    reportRuntimeReferenceDiagnostic(result, 'api.endpoint')

    if (result.status !== 'resolved') {
      failed = true
      failedPlaceholder = referenceValue
      return ''
    }

    const value = result.value

    if (typeof value === 'string') {
      return value
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value)
    }

    // Object, array, null, undefined — not representable as segment
    failed = true
    failedPlaceholder = referenceValue
    return ''
  })

  if (failed) {
    return {
      status: 'error',
      error: {
        code: 'request-build-failed',
        message: `The api operation "${operationName}" could not resolve "${failedPlaceholder}" for "endpoint".`,
      },
    }
  }

  return { status: 'ready', endpoint: resolved }
}

function resolveQuery(
  operationName: string,
  queryDefinition: RuntimeApiQuery | undefined,
  resolveOptions: Parameters<typeof resolvePayloadValue>[1],
) {
  if (!queryDefinition) {
    return {
      status: 'ready',
      query: undefined,
    } as const
  }
  const query: RuntimeApiQuery = {}

  for (const [key, rawValue] of Object.entries(queryDefinition)) {
    const resolvedValue = resolvePayloadValue(rawValue, resolveOptions)

    if (resolvedValue.status === 'error') {
      return {
        status: 'error',
        error: {
          code: 'request-build-failed',
          message: `The api operation "${operationName}" could not resolve "${rawValue}" for "query.${key}".`,
        },
      } as const
    }

    if (
      typeof resolvedValue.value !== 'string' &&
      typeof resolvedValue.value !== 'number' &&
      typeof resolvedValue.value !== 'boolean'
    ) {
      return {
        status: 'error',
        error: {
          code: 'request-build-failed',
          message: `The api operation "${operationName}" resolved "query.${key}" to an unsupported query value.`,
        },
      } as const
    }

    query[key] = resolvedValue.value
  }

  return {
    status: 'ready',
    query,
  } as const
}

function createRuntimeApiRequest({
  operationName,
  operation,
  resolvedEndpoint,
  descriptor,
}: {
  operationName: string
  operation: RuntimeApiOperation
  resolvedEndpoint: string
  descriptor: RuntimeApiRequestDescriptor
}): RuntimeApiRequest {
  const request = {
    operationName,
    operation,
    url: appendQueryString(resolvedEndpoint, descriptor.query),
    init: buildRequestInit(operation.method, descriptor.headers, descriptor.body),
  } as RuntimeApiRequest

  Object.defineProperties(request, {
    descriptor: {
      value: descriptor,
      enumerable: false,
      configurable: false,
      writable: false,
    },
    requestSignature: {
      value: createStableRequestSignature(descriptor),
      enumerable: false,
      configurable: false,
      writable: false,
    },
  })

  return request
}

function appendQueryString(endpoint: string, query: RuntimeApiQuery | undefined) {
  const serializedQuery = query ? new URLSearchParams(toQueryStringRecord(query)).toString() : ''

  if (!serializedQuery) {
    return endpoint
  }

  return `${endpoint}${endpoint.includes('?') ? '&' : '?'}${serializedQuery}`
}

function toQueryStringRecord(query: RuntimeApiQuery) {
  return Object.fromEntries(Object.entries(query).map(([key, value]) => [key, String(value)]))
}

function buildRequestInit(
  method: RuntimeApiOperation['method'],
  headers: RuntimeApiHeaders | undefined,
  body: RuntimeApiBodyValue | null | undefined,
): RequestInit {
  if (body === undefined || body === null) {
    if (!headers) {
      return {
        method,
      }
    }

    return {
      method,
      headers,
    }
  }

  const effectiveHeaders = {
    ...(headers ?? {}),
  }

  const hasExplicitContentType = Object.keys(effectiveHeaders).some((headerName) => headerName.toLowerCase() === 'content-type')

  if (!hasExplicitContentType) {
    effectiveHeaders['content-type'] = 'application/json'
  }

  return {
    method,
    headers: effectiveHeaders,
    body: JSON.stringify(body),
  }
}

function mergeRuntimeApiRequestParams(
  operation: RuntimeApiOperation,
  requestParams: RuntimeApiRequestParams | undefined,
): RuntimeApiRequestParams {
  return {
    query: mergeFlatRecord(operation.query, requestParams?.query),
    headers: mergeFlatRecord(operation.headers, requestParams?.headers),
    body: mergeRuntimeApiBody(operation.body, requestParams?.body),
  }
}

function mergeFlatRecord<TValue extends string | number | boolean>(
  baseRecord: Record<string, TValue> | undefined,
  overrideRecord: Record<string, TValue> | undefined,
) {
  if (!baseRecord) {
    return overrideRecord
  }

  if (!overrideRecord) {
    return baseRecord
  }

  return {
    ...baseRecord,
    ...overrideRecord,
  }
}

function mergeRuntimeApiBody(
  baseBody: RuntimeApiBodyValue | undefined,
  overrideBody: RuntimeApiBodyValue | undefined,
): RuntimeApiBodyValue | undefined {
  if (overrideBody === undefined) {
    return baseBody
  }

  if (baseBody === undefined) {
    return overrideBody
  }

  if (isPlainObject(baseBody) && isPlainObject(overrideBody)) {
    return {
      ...baseBody,
      ...overrideBody,
    }
  }

  return overrideBody
}

function createStableRequestSignature(descriptor: RuntimeApiRequestDescriptor) {
  return stableSerializeJsonValue(descriptor)
}

function stableSerializeJsonValue(value: unknown): string {
  return JSON.stringify(stabilizeJsonValue(value))
}

function stabilizeJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => stabilizeJsonValue(item))
  }

  if (!isPlainObject(value)) {
    return value
  }

  return Object.fromEntries(
    Object.entries(value)
      .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
      .map(([key, childValue]) => [key, stabilizeJsonValue(childValue)]),
  )
}
