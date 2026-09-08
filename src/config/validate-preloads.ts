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

type ValidateRuntimeApiRequestParams = (
  requestParams: RuntimeApiRequestParams,
  path: string,
  pageId: string,
) => { status: 'error'; error: RuntimeConfigError } | null

type PreloadEntriesWhenPolicy =
  | { readonly kind: 'allow'; readonly allowItem: boolean }
  | { readonly kind: 'reject' }

interface PreloadEntriesModeConfig {
  // Base path used to build every error message for this mode, e.g. `pages[0].preloads` or `preloads`.
  readonly pathPrefix: string
  // Identifier forwarded to validateRuntimeApiRequestParams/validateWhenCondition and used to strip their
  // generic "Page "<pageId>" has an invalid layout at "..." prefix before applying messageLabel.
  readonly pageId: string
  // Text prepended to every message produced by this mode, e.g. `The page at` or `The runtime config at`.
  readonly messageLabel: string
  readonly when: PreloadEntriesWhenPolicy
  // When provided, every operationName is cross-checked against this catalog before its requestParams
  // are validated. Only the root `preloads` block uses this; pages[].preloads leaves it undefined.
  readonly operationNames?: ReadonlySet<string>
}

function validatePreloadEntries(
  rawPreloads: unknown[] | undefined,
  modeConfig: PreloadEntriesModeConfig,
  validateRuntimeApiRequestParams: ValidateRuntimeApiRequestParams,
): { status: 'ready'; preloads?: RuntimePreloadConfig[] } | { status: 'error'; error: RuntimeConfigError } {
  if (rawPreloads === undefined) {
    return {
      status: 'ready',
    }
  }

  const { pathPrefix, pageId, messageLabel, when: whenPolicy, operationNames } = modeConfig
  const preloads: RuntimePreloadConfig[] = []
  const seenOperationNames = new Set<string>()

  for (let preloadIndex = 0; preloadIndex < rawPreloads.length; preloadIndex += 1) {
    const rawPreload = rawPreloads[preloadIndex]

    if (!isRecord(rawPreload)) {
      return invalidPreloadEntry(pathPrefix, messageLabel, preloadIndex)
    }

    const entries = Object.entries(rawPreload)

    if (entries.length === 0 || entries.length > 3) {
      return invalidPreloadEntry(pathPrefix, messageLabel, preloadIndex)
    }

    const operationEntries = entries.filter(([key]) => key !== 'when' && key !== 'blocking')

    if (operationEntries.length !== 1) {
      return invalidPreloadEntry(pathPrefix, messageLabel, preloadIndex)
    }

    const [operationName, rawRequestParams] = operationEntries[0]
    const rawWhen = rawPreload['when']
    const rawBlocking = rawPreload['blocking']

    if (operationName.trim().length === 0) {
      return invalidPreloadEntry(pathPrefix, messageLabel, preloadIndex)
    }

    if (operationNames && !operationNames.has(operationName)) {
      return invalidLayout(
        `${messageLabel} "${getPreloadPath(pathPrefix, preloadIndex, operationName)}": unknown operation "${operationName}".`,
      )
    }

    const requestParamsResult = runtimeApiRequestParamsSchema.safeParse(rawRequestParams)

    if (!requestParamsResult.success) {
      const issuePath = requestParamsResult.error.issues[0]?.path ?? []

      if (issuePath[0] === 'query') {
        return mapPreloadRequestQueryIssue(pathPrefix, messageLabel, preloadIndex, operationName, rawRequestParams, issuePath.slice(1))
      }

      if (issuePath[0] === 'headers') {
        return mapPreloadRequestHeadersIssue(pathPrefix, messageLabel, preloadIndex, operationName, rawRequestParams, issuePath.slice(1))
      }

      if (issuePath[0] === 'body') {
        return mapPreloadRequestBodyIssue(pathPrefix, messageLabel, preloadIndex, operationName, rawRequestParams, issuePath.slice(1))
      }

      return invalidLayout(`${messageLabel} "${getPreloadPath(pathPrefix, preloadIndex, operationName)}" must be an object.`)
    }

    const requestParamsPath = getPreloadPath(pathPrefix, preloadIndex, operationName)
    const requestParamsIssue = validateRuntimeApiRequestParams(
      requestParamsResult.data as RuntimeApiRequestParams,
      requestParamsPath,
      pageId,
    )

    if (requestParamsIssue) {
      return normalizePreloadRequestParamsIssue(requestParamsIssue, pageId, messageLabel)
    }

    if (seenOperationNames.has(operationName)) {
      return invalidLayout(`${messageLabel} "${pathPrefix}" contains duplicate operationName "${operationName}".`)
    }

    seenOperationNames.add(operationName)

    const preloadConfig: RuntimePreloadConfig = {
      operationName,
      requestParams: requestParamsResult.data as RuntimeApiRequestParams,
    }

    if (rawWhen !== undefined) {
      const whenPath = `${pathPrefix}[${preloadIndex}].when`

      if (whenPolicy.kind === 'reject') {
        return invalidLayout(`${messageLabel} "${whenPath}" is not supported for this preloads block.`)
      }

      const whenResult = validateWhenCondition(rawWhen, whenPath, pageId, { allowItem: whenPolicy.allowItem })

      if (whenResult.status === 'error') {
        return normalizePreloadRequestParamsIssue(whenResult, pageId, messageLabel)
      }

      preloadConfig.when = whenResult.when
    }

    if (rawBlocking !== undefined) {
      const blockingPath = `${pathPrefix}[${preloadIndex}].blocking`

      if (typeof rawBlocking !== 'boolean') {
        return invalidLayout(`${messageLabel} "${blockingPath}" must be a boolean.`)
      }

      preloadConfig.blocking = rawBlocking
    }

    preloads.push(preloadConfig)
  }

  return {
    status: 'ready',
    preloads,
  }
}

export function validatePagePreloads(
  rawPreloads: unknown[] | undefined,
  pageIndex: number,
  validateRuntimeApiRequestParams: ValidateRuntimeApiRequestParams,
): { status: 'ready'; preloads?: RuntimePreloadConfig[] } | { status: 'error'; error: RuntimeConfigError } {
  return validatePreloadEntries(
    rawPreloads,
    {
      pathPrefix: `pages[${pageIndex}].preloads`,
      pageId: `pages[${pageIndex}]`,
      messageLabel: 'The page at',
      when: { kind: 'allow', allowItem: false },
    },
    validateRuntimeApiRequestParams,
  )
}

export function validateGlobalPreloads(
  rawPreloads: unknown[] | undefined,
  validateRuntimeApiRequestParams: ValidateRuntimeApiRequestParams,
  operationNames: ReadonlySet<string>,
): { status: 'ready'; preloads?: RuntimePreloadConfig[] } | { status: 'error'; error: RuntimeConfigError } {
  return validatePreloadEntries(
    rawPreloads,
    {
      pathPrefix: 'preloads',
      pageId: 'preloads',
      messageLabel: 'The runtime config has an invalid layout at',
      when: { kind: 'reject' },
      operationNames,
    },
    validateRuntimeApiRequestParams,
  )
}

function invalidPreloadEntry(
  pathPrefix: string,
  messageLabel: string,
  preloadIndex: number,
): { status: 'error'; error: RuntimeConfigError } {
  return invalidLayout(
    `${messageLabel} "${pathPrefix}[${preloadIndex}]" must be an object with exactly one non-empty operationName key.`,
  )
}

export function getPreloadPath(pathPrefix: string, preloadIndex: number, operationName: string): string {
  return `${pathPrefix}[${preloadIndex}].${operationName}`
}

function mapPreloadRequestQueryIssue(
  pathPrefix: string,
  messageLabel: string,
  preloadIndex: number,
  operationName: string,
  rawRequestParams: unknown,
  issuePath: PropertyKey[],
): { status: 'error'; error: RuntimeConfigError } {
  if (!isRecord(rawRequestParams) || !isRecord(rawRequestParams.query)) {
    return invalidLayout(`${messageLabel} "${getPreloadPath(pathPrefix, preloadIndex, operationName)}.query" must be an object.`)
  }

  if (typeof issuePath[0] === 'string') {
    return invalidLayout(
      `${messageLabel} "${getPreloadPath(pathPrefix, preloadIndex, operationName)}.query.${issuePath[0]}" must resolve to a string, number, or boolean.`,
    )
  }

  return invalidLayout(`${messageLabel} "${getPreloadPath(pathPrefix, preloadIndex, operationName)}.query" must be an object.`)
}

function mapPreloadRequestHeadersIssue(
  pathPrefix: string,
  messageLabel: string,
  preloadIndex: number,
  operationName: string,
  rawRequestParams: unknown,
  issuePath: PropertyKey[],
): { status: 'error'; error: RuntimeConfigError } {
  if (!isRecord(rawRequestParams) || !isRecord(rawRequestParams.headers)) {
    return invalidLayout(`${messageLabel} "${getPreloadPath(pathPrefix, preloadIndex, operationName)}.headers" must be an object.`)
  }

  if (typeof issuePath[0] === 'string') {
    return invalidLayout(
      `${messageLabel} "${getPreloadPath(pathPrefix, preloadIndex, operationName)}.headers.${issuePath[0]}" must resolve to a string.`,
    )
  }

  return invalidLayout(`${messageLabel} "${getPreloadPath(pathPrefix, preloadIndex, operationName)}.headers" must be an object.`)
}

function mapPreloadRequestBodyIssue(
  pathPrefix: string,
  messageLabel: string,
  preloadIndex: number,
  operationName: string,
  rawRequestParams: unknown,
  issuePath: PropertyKey[],
): { status: 'error'; error: RuntimeConfigError } {
  const rawBody = isRecord(rawRequestParams) ? rawRequestParams.body : undefined
  const bodyPath = findInvalidJsonBodyPath(rawBody, `${getPreloadPath(pathPrefix, preloadIndex, operationName)}.body`)

  if (bodyPath) {
    return invalidLayout(`${messageLabel} "${bodyPath}" must be valid JSON data.`)
  }

  const formattedPath = issuePath.map(formatPathSegment).join('')
  return invalidLayout(
    `${messageLabel} "${getPreloadPath(pathPrefix, preloadIndex, operationName)}.body${formattedPath}" must be valid JSON data.`,
  )
}

function normalizePreloadRequestParamsIssue(
  issue: { status: 'error'; error: RuntimeConfigError },
  pageId: string,
  messageLabel: string,
): { status: 'error'; error: RuntimeConfigError } {
  return invalidLayout(issue.error.message.replace(`Page "${pageId}" has an invalid layout at "`, `${messageLabel} "`))
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
