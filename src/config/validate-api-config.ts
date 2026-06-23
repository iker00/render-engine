import type {
  RuntimeApiConfig,
  RuntimeApiOperation,
  RuntimeApiMethod,
  RuntimeApiBodyValue,
  RuntimeApiHeaders,
  RuntimeApiErrorCondition,
  RuntimeConfigError,
} from './runtime-config-types'
import {
  runtimeApiOperationShellSchema,
  runtimeApiQuerySchema,
  runtimeApiHeadersSchema,
} from './runtime-config-zod'
import { invalidLayout } from './runtime-config-validation-errors'
import { isTokensReference, templateContainsTokensReference } from './runtime-reference-namespace-guards'

export function validateApiConfig(
  rawApiConfig: Record<string, unknown>,
): { status: 'ready'; api: RuntimeApiConfig } | { status: 'error'; error: RuntimeConfigError } {
  const api: RuntimeApiConfig = {}

  for (const [operationName, rawOperation] of Object.entries(rawApiConfig)) {
    if (operationName.startsWith('__fileManager__:')) {
      return invalidLayout(`The api operation "${operationName}" uses the reserved prefix "__fileManager__:".`)
    }

    if (!isRecord(rawOperation)) {
      return invalidLayout(`The api operation "${operationName}" must be an object.`)
    }

    const operationResult = validateApiOperation(operationName, rawOperation)

    if (operationResult.status === 'error') {
      return operationResult
    }

    api[operationName] = operationResult.operation
  }

  return {
    status: 'ready',
    api,
  }
}

function validateApiOperation(
  operationName: string,
  rawOperation: Record<string, unknown>,
): { status: 'ready'; operation: RuntimeApiOperation } | { status: 'error'; error: RuntimeConfigError } {
  const shellResult = runtimeApiOperationShellSchema.safeParse(rawOperation)

  if (!shellResult.success) {
    const issue = shellResult.error.issues[0]
    const path = issue?.path[0]

    if (path === 'method') {
      return invalidLayout(`The api operation "${operationName}" uses unsupported method "${String(rawOperation.method)}".`)
    }

    if (path === 'endpoint') {
      return invalidLayout(`The api operation "${operationName}" must declare a non-empty endpoint.`)
    }

    if (path === 'query') {
      return mapApiQueryIssue(operationName, rawOperation.query, issue.path)
    }

    if (path === 'body') {
      return mapApiBodyIssue(operationName, rawOperation.body, issue.path)
    }

    if (path === 'headers') {
      return mapApiHeadersIssue(operationName, rawOperation.headers, issue.path)
    }

    if (path === 'errorCondition') {
      const subPath = issue?.path[1]

      if (subPath === 'path') {
        return invalidLayout(`The api operation "${operationName}.errorCondition.path" must be a non-empty string.`)
      }

      if (subPath === 'equals') {
        return invalidLayout(`The api operation "${operationName}.errorCondition.equals" must be a string, number, boolean or null.`)
      }

      if (subPath === 'notEquals') {
        return invalidLayout(`The api operation "${operationName}.errorCondition.notEquals" must be a string, number, boolean or null.`)
      }

      return invalidLayout(`The api operation "${operationName}.errorCondition" must be an object with a non-empty "path".`)
    }

    if (path === 'errorMessagePath') {
      return invalidLayout(`The api operation "${operationName}.errorMessagePath" must be a non-empty string.`)
    }

    if (path === 'errorCodePath') {
      return invalidLayout(`The api operation "${operationName}.errorCodePath" must be a non-empty string.`)
    }

    return invalidLayout(`The api operation "${operationName}" must be an object.`)
  }

  if (shellResult.data.query !== undefined) {
    const queryIssue = validateApiQueryKeys(operationName, shellResult.data.query)

    if (queryIssue) {
      return queryIssue
    }

    const queryTokensIssue = rejectTokensInApiQuery(operationName, shellResult.data.query)

    if (queryTokensIssue) {
      return queryTokensIssue
    }
  }

  if (shellResult.data.body !== undefined && shellResult.data.method === 'GET') {
    return invalidLayout(`The api operation "${operationName}" uses method "GET" but declares an unsupported body.`)
  }

  if (shellResult.data.body !== undefined) {
    const bodyTokensIssue = rejectTokensInApiBody(operationName, shellResult.data.body)

    if (bodyTokensIssue) {
      return bodyTokensIssue
    }
  }

  if (templateContainsTokensReference(shellResult.data.endpoint)) {
    return invalidLayout(`The api operation "${operationName}.endpoint" contains tokens.* references, which are not supported in endpoint placeholders.`)
  }

  if (shellResult.data.headers !== undefined) {
    const headersIssue = validateApiHeadersKeys(operationName, shellResult.data.headers)

    if (headersIssue) {
      return headersIssue
    }
  }

  if (
    shellResult.data.errorCondition !== undefined &&
    shellResult.data.errorCondition.equals !== undefined &&
    shellResult.data.errorCondition.notEquals !== undefined
  ) {
    return invalidLayout(`The api operation "${operationName}.errorCondition" cannot declare both "equals" and "notEquals".`)
  }

  const operation: RuntimeApiOperation = {
    method: shellResult.data.method as RuntimeApiMethod,
    endpoint: shellResult.data.endpoint,
  }

  if (shellResult.data.query !== undefined) {
    operation.query = shellResult.data.query as RuntimeApiOperation['query']
  }

  if (shellResult.data.body !== undefined) {
    operation.body = shellResult.data.body as RuntimeApiBodyValue
  }

  if (shellResult.data.headers !== undefined) {
    operation.headers = shellResult.data.headers as RuntimeApiHeaders
  }

  if (shellResult.data.errorCondition !== undefined) {
    operation.errorCondition = shellResult.data.errorCondition as RuntimeApiErrorCondition
  }

  if (shellResult.data.errorMessagePath !== undefined) {
    operation.errorMessagePath = shellResult.data.errorMessagePath
  }

  if (shellResult.data.errorCodePath !== undefined) {
    operation.errorCodePath = shellResult.data.errorCodePath
  }

  return {
    status: 'ready',
    operation,
  }
}

function rejectTokensInApiQuery(
  operationName: string,
  query: RuntimeApiOperation['query'],
): { status: 'error'; error: RuntimeConfigError } | null {
  if (query === undefined) {
    return null
  }

  for (const [key, value] of Object.entries(query)) {
    if (typeof value === 'string' && isTokensReference(value)) {
      return invalidLayout(
        `The api operation "${operationName}.query.${key}" contains tokens.* references, which are not supported in query parameters.`,
      )
    }
  }

  return null
}

function rejectTokensInApiBody(
  operationName: string,
  body: unknown,
): { status: 'error'; error: RuntimeConfigError } | null {
  return rejectTokensInApiBodyAtPath(operationName, `${operationName}.body`, body)
}

function rejectTokensInApiBodyAtPath(
  operationName: string,
  path: string,
  value: unknown,
): { status: 'error'; error: RuntimeConfigError } | null {
  if (typeof value === 'string') {
    if (isTokensReference(value)) {
      return invalidLayout(
        `The api operation "${path}" contains tokens.* references, which are not supported in body values.`,
      )
    }

    return null
  }

  if (value === null || value === undefined || typeof value === 'number' || typeof value === 'boolean') {
    return null
  }

  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const childIssue = rejectTokensInApiBodyAtPath(operationName, `${path}[${index}]`, value[index])

      if (childIssue) {
        return childIssue
      }
    }

    return null
  }

  if (isRecord(value)) {
    for (const [key, childValue] of Object.entries(value)) {
      const childIssue = rejectTokensInApiBodyAtPath(operationName, `${path}.${key}`, childValue)

      if (childIssue) {
        return childIssue
      }
    }
  }

  return null
}

function mapApiQueryIssue(
  operationName: string,
  rawQuery: unknown,
  path: PropertyKey[],
): { status: 'error'; error: RuntimeConfigError } {
  if (!isRecord(rawQuery)) {
    return invalidLayout(`The api operation "${operationName}.query" must be an object with non-empty keys.`)
  }

  if (typeof path[1] === 'string') {
    return invalidLayout(
      `The api operation "${operationName}.query.${path[1]}" must resolve to a string, number, or boolean.`,
    )
  }

  return invalidLayout(`The api operation "${operationName}.query" must be an object with non-empty keys.`)
}

function validateApiQueryKeys(
  operationName: string,
  query: RuntimeApiOperation['query'],
): { status: 'error'; error: RuntimeConfigError } | null {
  if (query === undefined) {
    return null
  }

  const queryResult = runtimeApiQuerySchema.safeParse(query)

  if (!queryResult.success) {
    return mapApiQueryIssue(operationName, query, queryResult.error.issues[0]?.path ?? [])
  }

  for (const key of Object.keys(query)) {
    if (key.length === 0) {
      return invalidLayout(`The api operation "${operationName}.query" contains an empty key.`)
    }
  }

  return null
}

function mapApiHeadersIssue(
  operationName: string,
  rawHeaders: unknown,
  path: PropertyKey[],
): { status: 'error'; error: RuntimeConfigError } {
  if (!isRecord(rawHeaders)) {
    return invalidLayout(`The api operation "${operationName}.headers" must be an object with non-empty keys.`)
  }

  if (typeof path[1] === 'string') {
    return invalidLayout(`The api operation "${operationName}.headers.${path[1]}" must resolve to a string.`)
  }

  return invalidLayout(`The api operation "${operationName}.headers" must be an object with non-empty keys.`)
}

function validateApiHeadersKeys(
  operationName: string,
  headers: RuntimeApiHeaders | undefined,
): { status: 'error'; error: RuntimeConfigError } | null {
  if (headers === undefined) {
    return null
  }

  const headersResult = runtimeApiHeadersSchema.safeParse(headers)

  if (!headersResult.success) {
    return mapApiHeadersIssue(operationName, headers, headersResult.error.issues[0]?.path ?? [])
  }

  for (const key of Object.keys(headers)) {
    if (key.length === 0) {
      return invalidLayout(`The api operation "${operationName}.headers" contains an empty key.`)
    }
  }

  return null
}

function mapApiBodyIssue(
  operationName: string,
  rawBody: unknown,
  path: PropertyKey[],
): { status: 'error'; error: RuntimeConfigError } {
  const bodyPath = findInvalidJsonBodyPath(rawBody, `${operationName}.body`)

  if (bodyPath) {
    return invalidLayout(`The api operation "${bodyPath}" must be valid JSON data.`)
  }

  const formattedPath = path.slice(1).map(formatPathSegment).join('')
  return invalidLayout(`The api operation "${operationName}.body${formattedPath}" must be valid JSON data.`)
}

function formatPathSegment(segment: PropertyKey): string {
  if (typeof segment === 'number') {
    return `[${segment}]`
  }

  return `.${String(segment)}`
}

function findInvalidJsonBodyPath(value: unknown, path: string): string | null {
  if (value === null) {
    return null
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return null
  }

  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const invalidChildPath = findInvalidJsonBodyPath(value[index], `${path}[${index}]`)

      if (invalidChildPath) {
        return invalidChildPath
      }
    }

    return null
  }

  if (!isRecord(value)) {
    return path
  }

  for (const [key, childValue] of Object.entries(value)) {
    if (key.length === 0) {
      return `${path}.${key}`
    }

    const invalidChildPath = findInvalidJsonBodyPath(childValue, `${path}.${key}`)

    if (invalidChildPath) {
      return invalidChildPath
    }
  }

  return null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }

  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}
