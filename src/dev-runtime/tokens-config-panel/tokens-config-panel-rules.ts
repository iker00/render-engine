import type { RuntimeTokensConfig } from '../../config/runtime-config-types'

export function normalizeTokenId(rawId: string): string {
  return rawId.trim()
}

export function isDuplicateTokenId(normalizedId: string, tokens: RuntimeTokensConfig): boolean {
  if (normalizedId === '') {
    return false
  }

  return normalizedId in tokens
}
