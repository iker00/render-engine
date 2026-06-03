import type { RuntimeApiBodyValue } from '../config/runtime-config'
import { resolveRuntimeImageSource } from '../runtime/runtime-references/runtime-reference-resolver'
import { resolveHeaders, resolveBody } from './runtime-api-payload-resolver'
import type {
  ExecuteRuntimeBinaryFetchOptions,
  RuntimeBinaryFetchResult,
} from './runtime-binary-fetch-types'

export type { ExecuteRuntimeBinaryFetchOptions, RuntimeBinaryFetchResult } from './runtime-binary-fetch-types'
export type { RuntimeBinaryFetchError } from './runtime-binary-fetch-types'

const MESSAGE_PREFIX = 'The image fetch'

export async function executeRuntimeBinaryFetch({
  fetchConfig,
  state,
  iterationContext,
  fetch: fetchImplementation = fetch,
}: ExecuteRuntimeBinaryFetchOptions): Promise<RuntimeBinaryFetchResult> {
  const resolveOptions = { state, iterationContext }

  const resolvedUrl = resolveRuntimeImageSource(fetchConfig.url, state, { iterationContext })

  if (resolvedUrl === null) {
    return {
      status: 'error',
      error: {
        code: 'request-build-failed',
        message: `${MESSAGE_PREFIX} could not resolve the URL "${fetchConfig.url}".`,
      },
    }
  }

  const headersResult = resolveHeaders(fetchConfig.headers, MESSAGE_PREFIX, resolveOptions)

  if (headersResult.status === 'error') {
    return headersResult
  }

  const bodyResult = resolveBody(
    fetchConfig.body as RuntimeApiBodyValue | undefined,
    MESSAGE_PREFIX,
    resolveOptions,
  )

  if (bodyResult.status === 'error') {
    return bodyResult
  }

  const init = buildRequestInit(
    fetchConfig.method ?? 'GET',
    headersResult.headers,
    bodyResult.body,
  )

  let response: Response

  try {
    response = await fetchImplementation(resolvedUrl, init)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return {
      status: 'error',
      error: {
        code: 'network-error',
        message: `${MESSAGE_PREFIX} failed due to a network error: ${message}`,
      },
    }
  }

  if (!response.ok) {
    return {
      status: 'error',
      error: {
        code: 'http-error',
        message: `${MESSAGE_PREFIX} failed with HTTP status ${response.status}.`,
      },
    }
  }

  let blob: Blob

  try {
    blob = await response.blob()
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return {
      status: 'error',
      error: {
        code: 'invalid-binary-response',
        message: `${MESSAGE_PREFIX} could not read binary response: ${message}`,
      },
    }
  }

  if (blob.size === 0) {
    return {
      status: 'error',
      error: {
        code: 'invalid-binary-response',
        message: `${MESSAGE_PREFIX} returned an empty binary response.`,
      },
    }
  }

  return {
    status: 'success',
    blob,
  }
}

function buildRequestInit(
  method: string,
  headers: Record<string, string> | undefined,
  body: RuntimeApiBodyValue | null | undefined,
): RequestInit {
  if (body === undefined || body === null) {
    if (!headers) {
      return { method }
    }
    return { method, headers }
  }

  const effectiveHeaders = { ...(headers ?? {}) }

  const hasExplicitContentType = Object.keys(effectiveHeaders).some(
    (headerName) => headerName.toLowerCase() === 'content-type',
  )

  if (!hasExplicitContentType) {
    effectiveHeaders['content-type'] = 'application/json'
  }

  return {
    method,
    headers: effectiveHeaders,
    body: JSON.stringify(body),
  }
}
