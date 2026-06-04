import type {
  RuntimeApiBodyValue,
  RuntimeApiHeaders,
  RuntimeApiOperation,
  RuntimeApiQuery,
  RuntimeApiRequestParams,
  RuntimeConfig,
} from '../config/runtime-config'
import type { RuntimeIterationContext } from '../runtime/runtime-references/runtime-reference-resolver'
import type { RuntimeState } from '../runtime/runtime-state/runtime-state-types'

export interface BuildRuntimeApiRequestOptions {
  config: RuntimeConfig
  operationName: string
  state: RuntimeState
  requestParams?: RuntimeApiRequestParams
  iterationContext?: RuntimeIterationContext
}

export interface RuntimeApiRequest {
  operationName: string
  operation: RuntimeApiOperation
  url: string
  init: RequestInit
  descriptor: RuntimeApiRequestDescriptor
  requestSignature: string
}

export interface RuntimeApiRequestDescriptor {
  operationName: string
  method: RuntimeApiOperation['method']
  endpoint: string
  query?: RuntimeApiQuery
  body?: RuntimeApiBodyValue | null
  headers?: RuntimeApiHeaders
}

export interface RuntimeApiError {
  code:
    | 'operation-not-found'
    | 'request-build-failed'
    | 'network-error'
    | 'http-error'
    | 'invalid-json-response'
    | 'business-error-condition'
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

export interface ExecuteBuiltRuntimeApiRequestOptions {
  request: RuntimeApiRequest
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
