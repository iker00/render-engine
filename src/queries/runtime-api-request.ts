import type {
  RuntimeApiBodyValue,
  RuntimeApiHeaders,
  RuntimeApiOperation,
  RuntimeApiQuery,
  RuntimeApiRequestParams,
} from '../config/runtime-config'
import { resolveRuntimeReference } from '../runtime/runtime-references/runtime-reference-resolver'
import type {
  BuildRuntimeApiRequestOptions,
  RuntimeApiRequest,
  RuntimeApiRequestBuildResult,
} from './runtime-api-types'

export function buildRuntimeApiRequest({
  config,
  operationName,
  state,
  requestParams,
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

  const queryResult = resolveQuery(operationName, effectiveRequestParams.query, state)

  if (queryResult.status === 'error') {
    return queryResult
  }

  const bodyResult = resolveBody(operationName, effectiveRequestParams.body, state)

  if (bodyResult.status === 'error') {
    return bodyResult
  }

  const headersResult = resolveHeaders(operationName, effectiveRequestParams.headers, state)

  if (headersResult.status === 'error') {
    return headersResult
  }

  return {
    status: 'ready',
    request: {
      operationName,
      operation,
      url: appendQueryString(operation.endpoint, queryResult.query),
      init: buildRequestInit(operation.method, headersResult.headers, bodyResult.body),
    } satisfies RuntimeApiRequest,
  }
}

function resolveQuery(
  operationName: string,
  queryDefinition: RuntimeApiQuery | undefined,
  state: BuildRuntimeApiRequestOptions['state'],
) {
  if (!queryDefinition) {
    return {
      status: 'ready',
      query: undefined,
    } as const
  }

  const query = new URLSearchParams()

  for (const [key, rawValue] of Object.entries(queryDefinition)) {
    const resolvedValue = resolvePayloadValue(rawValue, state)

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

    query.set(key, String(resolvedValue.value))
  }

  return {
    status: 'ready',
    query,
  } as const
}

function resolveBody(
  operationName: string,
  bodyDefinition: RuntimeApiBodyValue | undefined,
  state: BuildRuntimeApiRequestOptions['state'],
) {
  if (bodyDefinition === undefined) {
    return {
      status: 'ready',
      body: undefined,
    } as const
  }

  if (bodyDefinition === null) {
    return {
      status: 'ready',
      body: null,
    } as const
  }

  const resolvedBody = resolveJsonPayloadValue(bodyDefinition, state)

  if (resolvedBody.status === 'error') {
    return {
      status: 'error',
      error: {
        code: 'request-build-failed',
        message: `The api operation "${operationName}" could not build its JSON body.`,
      },
    } as const
  }

  return {
    status: 'ready',
    body: resolvedBody.value,
  } as const
}

function resolveHeaders(
  operationName: string,
  headersDefinition: RuntimeApiHeaders | undefined,
  state: BuildRuntimeApiRequestOptions['state'],
) {
  if (!headersDefinition) {
    return {
      status: 'ready',
      headers: undefined,
    } as const
  }

  const headers: RuntimeApiHeaders = {}

  for (const [key, rawValue] of Object.entries(headersDefinition)) {
    const resolvedValue = resolvePayloadValue(rawValue, state)

    if (resolvedValue.status === 'error') {
      return {
        status: 'error',
        error: {
          code: 'request-build-failed',
          message: `The api operation "${operationName}" could not resolve "${rawValue}" for "headers.${key}".`,
        },
      } as const
    }

    if (typeof resolvedValue.value !== 'string') {
      return {
        status: 'error',
        error: {
          code: 'request-build-failed',
          message: `The api operation "${operationName}" resolved "headers.${key}" to an unsupported header value.`,
        },
      } as const
    }

    headers[key] = resolvedValue.value
  }

  return {
    status: 'ready',
    headers,
  } as const
}

function resolveJsonPayloadValue(value: RuntimeApiBodyValue, state: BuildRuntimeApiRequestOptions['state']) {
  if (value === null) {
    return {
      status: 'ready',
      value: null,
    } as const
  }

  if (typeof value === 'string') {
    const resolvedValue = resolvePayloadValue(value, state)

    if (resolvedValue.status === 'error' || !isRuntimeApiBodyRuntimeValue(resolvedValue.value)) {
      return {
        status: 'error',
      } as const
    }

    return resolvedValue
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
      const resolvedItem = resolveJsonPayloadValue(item, state)

      if (resolvedItem.status === 'error') {
        return resolvedItem
      }

      resolvedItems.push(resolvedItem.value as RuntimeApiBodyValue)
    }

    return {
      status: 'ready',
      value: resolvedItems,
    } as const
  }

  const resolvedObject: Record<string, RuntimeApiBodyValue> = {}

  for (const [key, childValue] of Object.entries(value)) {
    const resolvedChild = resolveJsonPayloadValue(childValue, state)

    if (resolvedChild.status === 'error') {
      return resolvedChild
    }

    resolvedObject[key] = resolvedChild.value as RuntimeApiBodyValue
  }

  return {
    status: 'ready',
    value: resolvedObject,
  } as const
}

function isRuntimeApiBodyRuntimeValue(value: unknown): value is RuntimeApiBodyValue {
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

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }

  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function resolvePayloadValue(value: string | number | boolean, state: BuildRuntimeApiRequestOptions['state']) {
  if (typeof value !== 'string') {
    return {
      status: 'ready',
      value,
    } as const
  }

  const resolvedReference = resolveRuntimeReference(value, state)

  if (resolvedReference.status === 'literal') {
    return {
      status: 'ready',
      value: resolvedReference.value,
    } as const
  }

  if (resolvedReference.status === 'resolved') {
    return {
      status: 'ready',
      value: resolvedReference.value,
    } as const
  }

  return {
    status: 'error',
  } as const
}

function appendQueryString(endpoint: string, query: URLSearchParams | undefined) {
  const serializedQuery = query?.toString()

  if (!serializedQuery) {
    return endpoint
  }

  return `${endpoint}${endpoint.includes('?') ? '&' : '?'}${serializedQuery}`
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
