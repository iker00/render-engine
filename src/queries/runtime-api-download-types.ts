import type { RuntimeApiError, RuntimeApiRequest } from './runtime-api-types'

export interface ExecuteBuiltRuntimeApiDownloadRequestOptions {
  request: RuntimeApiRequest
  fetch?: typeof fetch
}

export type RuntimeApiDownloadResult =
  | { status: 'success'; blob: Blob; contentDisposition: string | null }
  | { status: 'error'; error: RuntimeApiError }
