import { buildRuntimeApiRequest } from './runtime-api-request'
import type {
  ExecuteBuiltRuntimeApiRequestOptions,
  ExecuteRuntimeApiOperationOptions,
  RuntimeApiExecutionResult,
} from './runtime-api-types'

export { buildRuntimeApiRequest } from './runtime-api-request'
export type {
  ExecuteBuiltRuntimeApiRequestOptions,
  ExecuteRuntimeApiOperationOptions,
  RuntimeApiError,
  RuntimeApiExecutionResult,
  RuntimeApiRequest,
  RuntimeApiRequestBuildResult,
} from './runtime-api-types'

export async function executeRuntimeApiOperation({
  config,
  operationName,
  state,
  requestParams,
  iterationContext,
  fetch: fetchImplementation = fetch,
}: ExecuteRuntimeApiOperationOptions): Promise<RuntimeApiExecutionResult> {
  const requestResult = buildRuntimeApiRequest({
    config,
    operationName,
    state,
    requestParams,
    iterationContext,
  })

  if (requestResult.status === 'error') {
    return requestResult
  }

  return executeBuiltRuntimeApiRequest({
    request: requestResult.request,
    fetch: fetchImplementation,
  })
}

export async function executeBuiltRuntimeApiRequest({
  request,
  fetch: fetchImplementation = fetch,
}: ExecuteBuiltRuntimeApiRequestOptions): Promise<RuntimeApiExecutionResult> {
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

  if (response.status === 204) {
    return {
      status: 'success',
      data: null,
    }
  }

  const responseText = await response.text()

  if (responseText.length === 0) {
    return {
      status: 'success',
      data: null,
    }
  }

  try {
    return {
      status: 'success',
      data: JSON.parse(responseText) as unknown,
    }
  } catch {
    return {
      status: 'error',
      error: {
        code: 'invalid-json-response',
        message: `The api operation "${request.operationName}" returned invalid JSON.`,
      },
    }
  }
}
