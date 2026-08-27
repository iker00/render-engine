import type {
  RuntimeApiBodyValue,
  RuntimeApiFileField,
  RuntimeApiHeaders,
  RuntimeApiOperation,
  RuntimeApiQuery,
  RuntimeApiRequestParams,
} from '../config/runtime-config'
import type {
  BuildInlineRuntimeApiRequestOptions,
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
import {
  reportRuntimeFormatterChainDiagnostic,
  reportRuntimeReferenceDiagnostic,
} from '../runtime/runtime-references/runtime-reference-diagnostics'
import {
  hasFormatterSyntax,
  parseFormatterPlaceholder,
} from '../runtime/runtime-references/runtime-formatter-parser'
import type { RuntimeFormatterInvocation } from '../runtime/runtime-references/runtime-formatter-parser'
import {
  applyFormatterChain,
  findFirstFailingFormatterName,
} from '../runtime/runtime-references/runtime-formatter-registry'

export function buildRuntimeApiRequest({
  config,
  operationName,
  state,
  requestParams,
  iterationContext,
  hiddenFormFields,
  emptySubmitValues,
  fileValueOverrides,
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

  return buildInlineRuntimeApiRequest({
    operation,
    operationName,
    state,
    requestParams,
    iterationContext,
    hiddenFormFields,
    emptySubmitValues,
    fileValueOverrides,
  })
}

export function buildInlineRuntimeApiRequest({
  operation,
  operationName,
  state,
  requestParams,
  iterationContext,
  hiddenFormFields,
  emptySubmitValues,
  fileValueOverrides,
}: BuildInlineRuntimeApiRequestOptions): RuntimeApiRequestBuildResult {
  const effectiveRequestParams = mergeRuntimeApiRequestParams(operation, requestParams)
  const resolveOptions = { state, iterationContext, hiddenFormFields, emptySubmitValues }
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

  const bodyResult = resolveBody(effectiveRequestParams.body, messagePrefix, {
    ...resolveOptions,
    fileValueOverrides,
  })

  if (bodyResult.status === 'error') {
    return bodyResult
  }

  const headersResult = resolveHeaders(effectiveRequestParams.headers, messagePrefix, resolveOptions)

  if (headersResult.status === 'error') {
    return headersResult
  }

  const effectiveFiles = effectiveRequestParams.files

  if (effectiveFiles && effectiveFiles.length > 0) {
    const multipartResult = buildMultipartRequestInit(
      operationName,
      operation.method,
      headersResult.headers,
      bodyResult.body,
      effectiveFiles,
    )

    if (multipartResult.status === 'error') {
      return multipartResult
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
        filesSignature: effectiveFiles.map((field) => ({
          name: field.name,
          fileName: field.file.name,
          size: field.file.size,
          type: field.file.type,
        })),
        multipartInit: multipartResult.init,
      }),
    }
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

    // Formatters (feature 0101, T5) reuse the same parser used by the visible
    // surfaces (T3) and headers (T4). `api.endpoint` inherits the header-style
    // failure semantics (D5/D6): a non-resoluble chain or a formatter failure
    // escalates the placeholder to `request-build-failed` for the whole
    // operation, mirroring what already happens when the raw reference itself
    // is not resolvable.
    let referenceValue: string
    let formatters: readonly RuntimeFormatterInvocation[] = []

    if (!hasFormatterSyntax(rawReference)) {
      referenceValue = rawReference.trim()

      if (referenceValue.length === 0) {
        failed = true
        failedPlaceholder = _placeholder
        return ''
      }
    } else {
      const parseResult = parseFormatterPlaceholder(rawReference)

      if (parseResult.status === 'unresolvable-chain') {
        failed = true
        failedPlaceholder = _placeholder
        return ''
      }

      referenceValue = parseResult.reference
      if (parseResult.status === 'ok') {
        formatters = parseResult.formatters
      }
    }

    const result = resolveRuntimeReference(referenceValue, state, { iterationContext })
    reportRuntimeReferenceDiagnostic(result, 'api.endpoint')

    if (result.status !== 'resolved') {
      failed = true
      failedPlaceholder = referenceValue
      return ''
    }

    let value: unknown = result.value

    if (formatters.length > 0) {
      const chainResult = applyFormatterChain(result.value, formatters)

      if (chainResult.status !== 'ok') {
        const failingName = findFirstFailingFormatterName(result.value, formatters)
        reportRuntimeFormatterChainDiagnostic(_placeholder, failingName, 'api.endpoint')
        failed = true
        failedPlaceholder = referenceValue
        return ''
      }

      value = chainResult.value
    }

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

    if (resolvedValue.status === 'omit') {
      // Skip this query key
      continue
    }

    if (resolvedValue.status === 'error') {
      return {
        status: 'error',
        error: {
          code: 'request-build-failed',
          message: `The api operation "${operationName}" could not resolve "${rawValue}" for "query.${key}".`,
        },
      } as const
    }

    if (resolvedValue.status === 'token-error') {
      return {
        status: 'error',
        error: {
          code: 'request-build-failed',
          message: `The api operation "${operationName}" could not resolve "${rawValue}" for "query.${key}" because token "${resolvedValue.tokenId}" is in error state.`,
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

type MultipartBuildResult =
  | { status: 'ready'; init: RequestInit }
  | { status: 'error'; error: { code: 'request-build-failed'; message: string } }

function buildMultipartRequestInit(
  operationName: string,
  method: RuntimeApiOperation['method'],
  headers: RuntimeApiHeaders | undefined,
  body: RuntimeApiBodyValue | null | undefined,
  files: RuntimeApiFileField[],
): MultipartBuildResult {
  const formData = new FormData()

  for (const field of files) {
    formData.append(field.name, field.file, field.file.name)
  }

  if (body !== null && body !== undefined) {
    if (!isPlainObject(body)) {
      return {
        status: 'error',
        error: {
          code: 'request-build-failed',
          message: `The api operation "${operationName}" cannot serialize body root for multipart payload (only scalar values are allowed).`,
        },
      }
    }

    for (const [key, value] of Object.entries(body)) {
      if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') {
        return {
          status: 'error',
          error: {
            code: 'request-build-failed',
            message: `The api operation "${operationName}" cannot serialize "body.${key}" for multipart payload (only scalar values are allowed).`,
          },
        }
      }
      formData.append(key, String(value))
    }
  }

  const requestInit: RequestInit = { method, body: formData }

  if (headers) {
    requestInit.headers = headers
  }

  return { status: 'ready', init: requestInit }
}

function createRuntimeApiRequest({
  operationName,
  operation,
  resolvedEndpoint,
  descriptor,
  filesSignature,
  multipartInit,
}: {
  operationName: string
  operation: RuntimeApiOperation
  resolvedEndpoint: string
  descriptor: RuntimeApiRequestDescriptor
  filesSignature?: Array<{ name: string; fileName: string; size: number; type: string }>
  multipartInit?: RequestInit
}): RuntimeApiRequest {
  const request = {
    operationName,
    operation,
    url: appendQueryString(resolvedEndpoint, descriptor.query),
    init: multipartInit ?? buildRequestInit(operation.method, descriptor.headers, descriptor.body),
  } as RuntimeApiRequest

  const signatureDescriptor = filesSignature !== undefined
    ? { ...descriptor, filesSignature }
    : descriptor

  Object.defineProperties(request, {
    descriptor: {
      value: descriptor,
      enumerable: false,
      configurable: false,
      writable: false,
    },
    requestSignature: {
      value: createStableRequestSignature(signatureDescriptor),
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
  // Native `fetch` throws synchronously ("Request with GET/HEAD method cannot have body") for a
  // GET request carrying a body — a caller merging in `requestParams.body` (e.g. autocomplete's
  // dynamic search, T10) has no way to know the operation's method, so the merge can produce a
  // body for a GET operation. That throw happens before any network activity and is swallowed by
  // the executor's error handling, making the whole request silently vanish. GET has no body over
  // HTTP anyway, so dropping it here is always correct, not just an autocomplete-specific workaround.
  const effectiveBody = method === 'GET' ? undefined : body

  if (effectiveBody === undefined || effectiveBody === null) {
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
    files: requestParams?.files,
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
