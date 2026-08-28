import { buildRuntimeApiRequest, buildInlineRuntimeApiRequest } from './runtime-api-request'
import { encodeFilesToBase64Entries } from './runtime-file-base64-encoder'
import type {
  ExecuteBuiltRuntimeApiRequestOptions,
  ExecuteInlineRuntimeApiOperationOptions,
  ExecuteRuntimeApiOperationOptions,
  RuntimeApiExecutionResult,
  RuntimeApiFileInputSources,
} from './runtime-api-types'
import type { RuntimeApiBodyValue, RuntimeApiOperation } from '../config/runtime-config'
import type { RuntimeApiError } from './runtime-api-types'

export { buildRuntimeApiRequest, buildInlineRuntimeApiRequest } from './runtime-api-request'
export type {
  BuildInlineRuntimeApiRequestOptions,
  ExecuteBuiltRuntimeApiRequestOptions,
  ExecuteInlineRuntimeApiOperationOptions,
  ExecuteRuntimeApiOperationOptions,
  RuntimeApiError,
  RuntimeApiExecutionResult,
  RuntimeApiFileInputSources,
  RuntimeApiRequest,
  RuntimeApiRequestBuildResult,
} from './runtime-api-types'

type ResolveFileValueOverridesResult =
  | { status: 'ready'; fileValueOverrides: ReadonlyMap<string, RuntimeApiBodyValue[]> | undefined }
  | { status: 'error'; error: RuntimeApiError }

/**
 * Cheap synchronous guard checked before awaiting the encoding preflight.
 * Callers (this module and `runtime-state-provider`) must branch on this
 * first so that the no-files path never awaits anything — awaiting an async
 * function always defers to a microtask even when it resolves immediately,
 * which would otherwise push the `queries/set-loading` dispatch one tick
 * later than today for every operation, not just ones with files.
 */
export function hasEncodableFileInputSources(
  fileInputSources: RuntimeApiFileInputSources | undefined,
): fileInputSources is RuntimeApiFileInputSources {
  return fileInputSources !== undefined && Object.keys(fileInputSources.valuesByFieldId).length > 0
}

/**
 * Preflight step shared by the async executor entry points and by
 * `runtime-state-provider`'s query execution path: encodes every `File[]`
 * carried by `fileInputSources` to base64 (T1) and maps the result to the
 * `"${formId}.${fieldId}"` keyed overrides consumed by the builder (T2).
 *
 * Runs before `buildRuntimeApiRequest`/`buildInlineRuntimeApiRequest` — the
 * builder itself stays synchronous and never sees raw `File` values. Callers
 * should only await this after checking `hasEncodableFileInputSources`.
 */
export async function resolveFileInputSourcesOverrides(
  fileInputSources: RuntimeApiFileInputSources | undefined,
): Promise<ResolveFileValueOverridesResult> {
  if (!hasEncodableFileInputSources(fileInputSources)) {
    return { status: 'ready', fileValueOverrides: undefined }
  }

  const fieldEntries = Object.entries(fileInputSources.valuesByFieldId)

  const encodedFields = await Promise.all(
    fieldEntries.map(async ([fieldId, files]) => ({
      fieldId,
      encodeResult: await encodeFilesToBase64Entries(files),
    })),
  )

  const fileValueOverrides = new Map<string, RuntimeApiBodyValue[]>()

  for (const { fieldId, encodeResult } of encodedFields) {
    if (encodeResult.status === 'error') {
      return {
        status: 'error',
        error: {
          code: 'request-build-failed',
          message: `Could not encode the selected files for field "${fieldId}" in form "${fileInputSources.formId}".`,
        },
      }
    }

    fileValueOverrides.set(
      `${fileInputSources.formId}.${fieldId}`,
      encodeResult.entries as unknown as RuntimeApiBodyValue[],
    )
  }

  return { status: 'ready', fileValueOverrides }
}

export async function executeRuntimeApiOperation({
  config,
  operationName,
  state,
  requestParams,
  iterationContext,
  hiddenFormFields,
  fileInputSources,
  fetch: fetchImplementation = fetch,
}: ExecuteRuntimeApiOperationOptions): Promise<RuntimeApiExecutionResult> {
  let fileValueOverrides: ReadonlyMap<string, RuntimeApiBodyValue[]> | undefined

  if (hasEncodableFileInputSources(fileInputSources)) {
    const overridesResult = await resolveFileInputSourcesOverrides(fileInputSources)

    if (overridesResult.status === 'error') {
      return overridesResult
    }

    fileValueOverrides = overridesResult.fileValueOverrides
  }

  const requestResult = buildRuntimeApiRequest({
    config,
    operationName,
    state,
    requestParams,
    iterationContext,
    hiddenFormFields,
    fileValueOverrides,
  })

  if (requestResult.status === 'error') {
    return requestResult
  }

  return executeBuiltRuntimeApiRequest({
    request: requestResult.request,
    fetch: fetchImplementation,
  })
}

export async function executeInlineRuntimeApiOperation({
  operation,
  operationName,
  state,
  requestParams,
  iterationContext,
  hiddenFormFields,
  fileInputSources,
  fetch: fetchImplementation = fetch,
}: ExecuteInlineRuntimeApiOperationOptions): Promise<RuntimeApiExecutionResult> {
  let fileValueOverrides: ReadonlyMap<string, RuntimeApiBodyValue[]> | undefined

  if (hasEncodableFileInputSources(fileInputSources)) {
    const overridesResult = await resolveFileInputSourcesOverrides(fileInputSources)

    if (overridesResult.status === 'error') {
      return overridesResult
    }

    fileValueOverrides = overridesResult.fileValueOverrides
  }

  const requestResult = buildInlineRuntimeApiRequest({
    operation,
    operationName,
    state,
    requestParams,
    iterationContext,
    hiddenFormFields,
    fileValueOverrides,
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

  let responseText: string

  try {
    responseText = await response.text()
  } catch {
    return {
      status: 'error',
      error: {
        code: 'network-error',
        message: `The api operation "${request.operationName}" failed due to a network error while reading the response body.`,
      },
    }
  }

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

export function resolveBodyPath(body: unknown, dotPath: string): { found: true; value: unknown } | { found: false } {
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

  let code: RuntimeApiError['code'] = 'business-error-condition'

  if (operation.errorCodePath !== undefined) {
    const codeResult = resolveBodyPath(parsed, operation.errorCodePath)
    if (codeResult.found && (typeof codeResult.value === 'string' || typeof codeResult.value === 'number')) {
      code = String(codeResult.value) as RuntimeApiError['code']
    }
  }

  return {
    status: 'error',
    error: { code, message },
  }
}
