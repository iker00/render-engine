import type {
  RuntimePreloadConfig,
  RuntimeConfigError,
  RuntimeApiRequestParams,
} from './runtime-config-types'
import {
  runtimeApiRequestParamsSchema,
} from './runtime-config-zod'
import { invalidLayout } from './runtime-config-validation-errors'
import { validateWhenCondition } from './validate-actions-visibility'

export function validatePagePreloads(
  rawPreloads: unknown[] | undefined,
  pageIndex: number,
  validateRuntimeApiRequestParams: (
    requestParams: RuntimeApiRequestParams,
    path: string,
    pageId: string,
  ) => { status: 'error'; error: RuntimeConfigError } | null,
): { status: 'ready'; preloads?: RuntimePreloadConfig[] } | { status: 'error'; error: RuntimeConfigError } {
  if (rawPreloads === undefined) {
    return {
      status: 'ready',
    }
  }

  const preloads: RuntimePreloadConfig[] = []
  const seenOperationNames = new Set<string>()

  for (let preloadIndex = 0; preloadIndex < rawPreloads.length; preloadIndex += 1) {
    const rawPreload = rawPreloads[preloadIndex]

    if (!isRecord(rawPreload)) {
      return invalidPreloadEntry(pageIndex, preloadIndex)
    }

    const entries = Object.entries(rawPreload)

    if (entries.length === 0 || entries.length > 2) {
      return invalidPreloadEntry(pageIndex, preloadIndex)
    }

    if (entries.length === 2 && !entries.some(([key]) => key === 'when')) {
      return invalidPreloadEntry(pageIndex, preloadIndex)
    }

    const operationEntry = entries.find(([key]) => key !== 'when')

    if (!operationEntry) {
      return invalidPreloadEntry(pageIndex, preloadIndex)
    }

    const [operationName, rawRequestParams] = operationEntry
    const rawWhen = rawPreload['when']

    if (operationName.trim().length === 0) {
      return invalidPreloadEntry(pageIndex, preloadIndex)
    }

    const requestParamsResult = runtimeApiRequestParamsSchema.safeParse(rawRequestParams)

    if (!requestParamsResult.success) {
      const issuePath = requestParamsResult.error.issues[0]?.path ?? []

      if (issuePath[0] === 'query') {
        return mapPreloadRequestQueryIssue(pageIndex, preloadIndex, operationName, rawRequestParams, issuePath.slice(1))
      }

      if (issuePath[0] === 'headers') {
        return mapPreloadRequestHeadersIssue(pageIndex, preloadIndex, operationName, rawRequestParams, issuePath.slice(1))
      }

      if (issuePath[0] === 'body') {
        return mapPreloadRequestBodyIssue(pageIndex, preloadIndex, operationName, rawRequestParams, issuePath.slice(1))
      }

      return invalidLayout(`The page at "${getPreloadPath(pageIndex, preloadIndex, operationName)}" must be an object.`)
    }

    const requestParamsPath = getPreloadPath(pageIndex, preloadIndex, operationName)
    const requestParamsIssue = validateRuntimeApiRequestParams(
      requestParamsResult.data as RuntimeApiRequestParams,
      requestParamsPath,
      `pages[${pageIndex}]`,
    )

    if (requestParamsIssue) {
      return normalizePagePreloadRequestParamsIssue(requestParamsIssue, pageIndex)
    }

    if (seenOperationNames.has(operationName)) {
      return invalidLayout(`The page at "pages[${pageIndex}].preloads" contains duplicate operationName "${operationName}".`)
    }

    seenOperationNames.add(operationName)

    const preloadConfig: RuntimePreloadConfig = {
      operationName,
      requestParams: requestParamsResult.data as RuntimeApiRequestParams,
    }

    if (rawWhen !== undefined) {
      const whenPath = `pages[${pageIndex}].preloads[${preloadIndex}].when`
      const whenResult = validateWhenCondition(rawWhen, whenPath, `pages[${pageIndex}]`, { allowItem: false })

      if (whenResult.status === 'error') {
        return normalizePagePreloadRequestParamsIssue(whenResult, pageIndex)
      }

      preloadConfig.when = whenResult.when
    }

    preloads.push(preloadConfig)
  }

  return {
    status: 'ready',
    preloads,
  }
}

function invalidPreloadEntry(
  pageIndex: number,
  preloadIndex: number,
): { status: 'error'; error: RuntimeConfigError } {
  return invalidLayout(
    `The page at "pages[${pageIndex}].preloads[${preloadIndex}]" must be an object with exactly one non-empty operationName key.`,
  )
}

export function getPreloadPath(pageIndex: number, preloadIndex: number, operationName: string): string {
  return `pages[${pageIndex}].preloads[${preloadIndex}].${operationName}`
}

function mapPreloadRequestQueryIssue(
  pageIndex: number,
  preloadIndex: number,
  operationName: string,
  rawRequestParams: unknown,
  issuePath: PropertyKey[],
): { status: 'error'; error: RuntimeConfigError } {
  if (!isRecord(rawRequestParams) || !isRecord(rawRequestParams.query)) {
    return invalidLayout(`The page at "${getPreloadPath(pageIndex, preloadIndex, operationName)}.query" must be an object.`)
  }

  if (typeof issuePath[0] === 'string') {
    return invalidLayout(
      `The page at "${getPreloadPath(pageIndex, preloadIndex, operationName)}.query.${issuePath[0]}" must resolve to a string, number, or boolean.`,
    )
  }

  return invalidLayout(`The page at "${getPreloadPath(pageIndex, preloadIndex, operationName)}.query" must be an object.`)
}

function mapPreloadRequestHeadersIssue(
  pageIndex: number,
  preloadIndex: number,
  operationName: string,
  rawRequestParams: unknown,
  issuePath: PropertyKey[],
): { status: 'error'; error: RuntimeConfigError } {
  if (!isRecord(rawRequestParams) || !isRecord(rawRequestParams.headers)) {
    return invalidLayout(`The page at "${getPreloadPath(pageIndex, preloadIndex, operationName)}.headers" must be an object.`)
  }

  if (typeof issuePath[0] === 'string') {
    return invalidLayout(
      `The page at "${getPreloadPath(pageIndex, preloadIndex, operationName)}.headers.${issuePath[0]}" must resolve to a string.`,
    )
  }

  return invalidLayout(`The page at "${getPreloadPath(pageIndex, preloadIndex, operationName)}.headers" must be an object.`)
}

function mapPreloadRequestBodyIssue(
  pageIndex: number,
  preloadIndex: number,
  operationName: string,
  rawRequestParams: unknown,
  issuePath: PropertyKey[],
): { status: 'error'; error: RuntimeConfigError } {
  const rawBody = isRecord(rawRequestParams) ? rawRequestParams.body : undefined
  const bodyPath = findInvalidJsonBodyPath(rawBody, `${getPreloadPath(pageIndex, preloadIndex, operationName)}.body`)

  if (bodyPath) {
    return invalidLayout(`The page at "${bodyPath}" must be valid JSON data.`)
  }

  const formattedPath = issuePath.map(formatPathSegment).join('')
  return invalidLayout(
    `The page at "${getPreloadPath(pageIndex, preloadIndex, operationName)}.body${formattedPath}" must be valid JSON data.`,
  )
}

function normalizePagePreloadRequestParamsIssue(
  issue: { status: 'error'; error: RuntimeConfigError },
  pageIndex: number,
): { status: 'error'; error: RuntimeConfigError } {
  return invalidLayout(issue.error.message.replace(`Page "pages[${pageIndex}]" has an invalid layout at "`, 'The page at "'))
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
