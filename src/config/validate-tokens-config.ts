import type { RuntimeTokensConfig, RuntimeConfigError } from './runtime-config-types'
import { runtimeTokensConfigSchema } from './runtime-config-zod'
import { invalidLayout } from './runtime-config-validation-errors'

type TokensValidationResult =
  | { status: 'ready'; tokens: RuntimeTokensConfig }
  | { status: 'error'; error: RuntimeConfigError }

export function validateTokensConfig(
  rawTokens: unknown,
  knownApiOperations: ReadonlySet<string>,
): TokensValidationResult {
  if (rawTokens === undefined) {
    return { status: 'ready', tokens: {} }
  }

  if (!isPlainObject(rawTokens)) {
    return invalidLayout('The runtime config field "tokens" must be a plain object.')
  }

  const parseResult = runtimeTokensConfigSchema.safeParse(rawTokens)

  if (!parseResult.success) {
    const issue = parseResult.error.issues[0]

    if (issue) {
      const path = issue.path

      // Empty key at path[0] level — z.record(nonEmptyStringSchema, ...) rejects empty keys
      if (path.length === 0) {
        return invalidLayout('The runtime config field "tokens" must be a plain object.')
      }

      // path[0] is the tokenId, path[1] is the field within the token
      const tokenId = String(path[0])

      if (path.length === 1) {
        // The key itself is invalid (empty string tokenId)
        return invalidLayout(
          `The runtime config field "tokens" keys must be non-empty strings. Found empty key.`,
        )
      }

      const field = String(path[1])

      if (field === 'value') {
        return invalidLayout(
          `The runtime config field "tokens.${tokenId}.value" must be a non-empty string.`,
        )
      }

      if (field === 'refresh' && path.length >= 3) {
        const refreshField = String(path[2])

        if (refreshField === 'responsePath') {
          return invalidLayout(
            `The runtime config field "tokens.${tokenId}.refresh.responsePath" must be a non-empty string.`,
          )
        }

        if (refreshField === 'intervalSeconds') {
          return invalidLayout(
            `The runtime config field "tokens.${tokenId}.refresh.intervalSeconds" must be a positive integer.`,
          )
        }

        if (refreshField === 'operation') {
          return invalidLayout(
            `The runtime config field "tokens.${tokenId}.refresh.operation" must be a non-empty string.`,
          )
        }
      }

      if (field === 'refresh' && path.length === 2) {
        // refresh itself is invalid — likely missing required sub-fields
        // Determine which required field is missing by inspecting rawTokens
        const rawToken = (rawTokens as Record<string, unknown>)[tokenId]
        const rawRefresh = isPlainObject(rawToken) ? (rawToken as Record<string, unknown>).refresh : undefined

        if (isPlainObject(rawRefresh)) {
          const refresh = rawRefresh as Record<string, unknown>
          if (!refresh.responsePath || typeof refresh.responsePath !== 'string' || String(refresh.responsePath).trim().length === 0) {
            return invalidLayout(
              `The runtime config field "tokens.${tokenId}.refresh.responsePath" must be a non-empty string.`,
            )
          }
          if (refresh.intervalSeconds === undefined || refresh.intervalSeconds === null) {
            return invalidLayout(
              `The runtime config field "tokens.${tokenId}.refresh.intervalSeconds" must be a positive integer.`,
            )
          }
        }

        return invalidLayout(
          `The runtime config field "tokens.${tokenId}.refresh.responsePath" must be a non-empty string.`,
        )
      }

      // Default: missing value (path.length === 2, field === 'value' possibly not matched)
      return invalidLayout(
        `The runtime config field "tokens.${tokenId}.value" must be a non-empty string.`,
      )
    }

    return invalidLayout('The runtime config field "tokens" must be a plain object.')
  }

  // Cross-check: validate refresh.operation against known api operations
  const tokens = parseResult.data

  for (const [tokenId, tokenConfig] of Object.entries(tokens)) {
    if (tokenConfig.refresh !== undefined) {
      const { operation } = tokenConfig.refresh

      if (!knownApiOperations.has(operation)) {
        return invalidLayout(
          `The runtime config field "tokens.${tokenId}.refresh.operation" references unknown api operation "${operation}".`,
        )
      }
    }
  }

  return { status: 'ready', tokens }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }

  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}
