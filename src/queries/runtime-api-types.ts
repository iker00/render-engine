import type { RuntimeApiOperation, RuntimeConfig } from '../config/runtime-config'
import type { RuntimeState } from '../runtime/runtime-state/runtime-state-types'

export interface BuildRuntimeApiRequestOptions {
  config: RuntimeConfig
  operationName: string
  state: RuntimeState
}

export interface RuntimeApiRequest {
  operationName: string
  operation: RuntimeApiOperation
  url: string
  init: RequestInit
}

export interface RuntimeApiError {
  code:
    | 'operation-not-found'
    | 'request-build-failed'
    | 'network-error'
    | 'http-error'
    | 'invalid-json-response'
  message: string
}

export type RuntimeApiRequestBuildResult =
  | {
      status: 'ready'
      request: RuntimeApiRequest
    }
  | {
      status: 'error'
      error: RuntimeApiError
    }

export interface ExecuteRuntimeApiOperationOptions extends BuildRuntimeApiRequestOptions {
  fetch?: typeof fetch
}

export type RuntimeApiExecutionResult =
  | {
      status: 'success'
      data: unknown
    }
  | {
      status: 'error'
      error: RuntimeApiError
    }
