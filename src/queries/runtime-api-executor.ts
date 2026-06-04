import { buildRuntimeApiRequest } from './runtime-api-request'
import type {
  ExecuteBuiltRuntimeApiRequestOptions,
  ExecuteRuntimeApiOperationOptions,
  RuntimeApiExecutionResult,
} from './runtime-api-types'
import type { RuntimeApiOperation } from '../config/runtime-config'

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
    const parsed = JSON.parse(responseText) as unknown
    return evaluateErrorCondition(request.operation, parsed)
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

function resolveBodyPath(body: unknown, dotPath: string): { found: true; value: unknown } | { found: false } {
  const segments = dotPath.split('.')
  let current: unknown = body

  for (const segment of segments) {
    if (current == null) {
      return { found: false }
    }

    if (Array.isArray(current)) {
      if (!/^(0|[1-9]\d*)$/.test(segment)) {
        return { found: false }
      }
      const next = current[Number(segment)]
      if (typeof next === 'undefined') {
        return { found: false }
      }
      current = next
      continue
    }

    if (typeof current !== 'object') {
      return { found: false }
    }

    const obj = current as Record<string, unknown>
    if (!Object.hasOwn(obj, segment)) {
      return { found: false }
    }
    current = obj[segment]
  }

  return { found: true, value: current }
}

function evaluateErrorCondition(operation: RuntimeApiOperation, parsed: unknown): RuntimeApiExecutionResult {
  const { errorCondition } = operation

  if (errorCondition === undefined) {
    return { status: 'success', data: parsed }
  }

  const valueAtPath = resolveBodyPath(parsed, errorCondition.path)

  if (!valueAtPath.found) {
    return { status: 'success', data: parsed }
  }

  let conditionMet: boolean

  if (errorCondition.equals !== undefined) {
    conditionMet = valueAtPath.value === errorCondition.equals
  } else if (errorCondition.notEquals !== undefined) {
    conditionMet = valueAtPath.value !== errorCondition.notEquals
  } else {
    conditionMet = Boolean(valueAtPath.value)
  }

  if (!conditionMet) {
    return { status: 'success', data: parsed }
  }

  let message = 'Error en la respuesta del servidor'

  if (operation.errorMessagePath !== undefined) {
    const messageResult = resolveBodyPath(parsed, operation.errorMessagePath)
    if (messageResult.found && typeof messageResult.value === 'string' && messageResult.value.length > 0) {
      message = messageResult.value
    }
  }

  let code = 'business-error-condition'

  if (operation.errorCodePath !== undefined) {
    const codeResult = resolveBodyPath(parsed, operation.errorCodePath)
    if (codeResult.found && (typeof codeResult.value === 'string' || typeof codeResult.value === 'number')) {
      code = String(codeResult.value)
    }
  }

  return {
    status: 'error',
    error: { code, message },
  }
}
