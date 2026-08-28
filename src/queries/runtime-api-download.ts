import type {
  ExecuteBuiltRuntimeApiDownloadRequestOptions,
  RuntimeApiDownloadResult,
} from './runtime-api-download-types'

export type { ExecuteBuiltRuntimeApiDownloadRequestOptions, RuntimeApiDownloadResult } from './runtime-api-download-types'

/**
 * Executes an already built `RuntimeApiRequest` (from `buildRuntimeApiRequest`/
 * `buildInlineRuntimeApiRequest`) and interprets the response as a binary
 * download rather than JSON, mirroring `executeBuiltRuntimeApiRequest` for
 * network/HTTP error handling and `executeRuntimeBinaryFetch` for reading
 * `response.blob()`.
 *
 * Unlike `executeRuntimeBinaryFetch`, a 2xx response with an empty body is a
 * valid download (`blob.size === 0` is not an error): some download
 * endpoints legitimately return empty files.
 */
export async function executeBuiltRuntimeApiDownloadRequest({
  request,
  fetch: fetchImplementation = fetch,
}: ExecuteBuiltRuntimeApiDownloadRequestOptions): Promise<RuntimeApiDownloadResult> {
  let response: Response

  try {
    response = await fetchImplementation(request.url, request.init)
  } catch {
    return {
      status: 'error',
      error: {
        code: 'network-error',
        message: `The api operation "${request.operationName}" failed due to a network error.`,
      },
    }
  }

  if (!response.ok) {
    return {
      status: 'error',
      error: {
        code: 'http-error',
        message: `The api operation "${request.operationName}" failed with HTTP status ${response.status}.`,
      },
    }
  }

  let blob: Blob

  try {
    blob = await response.blob()
  } catch {
    return {
      status: 'error',
      error: {
        code: 'network-error',
        message: `The api operation "${request.operationName}" failed due to a network error while reading the response body.`,
      },
    }
  }

  return {
    status: 'success',
    blob,
    contentDisposition: response.headers.get('content-disposition'),
  }
}
