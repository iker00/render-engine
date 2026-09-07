import { parseRuntimeReference } from './runtime-reference-syntax'

/**
 * Returns true if the given string value is a `tokens.*` reference
 * (i.e. it parses as a supported reference in the `tokens` namespace).
 * Used by surface validators to reject `tokens.*` in unsupported positions.
 */
export function isTokensReference(value: string): boolean {
  const parsed = parseRuntimeReference(value)
  return parsed.kind === 'reference' && parsed.namespace === 'tokens'
}

/**
 * Parses a `group.{paramName}` reference into its `paramName`, or returns `null` when the
 * given string is not a valid `group.*` reference. Neutral parsing only: it does not check
 * whether `paramName` is declared by any `groups` entry, nor whether the reference sits inside
 * a group template — those cross-checks are resolved elsewhere (validate-groups.ts, runtime).
 */
export function parseGroupReference(value: string): { paramName: string } | null {
  const parsed = parseRuntimeReference(value)

  if (parsed.kind === 'reference' && parsed.status === 'supported' && parsed.namespace === 'group') {
    return { paramName: parsed.path[0] }
  }

  return null
}

/**
 * Returns true if any `{{...}}` placeholder in the given template string
 * contains a `tokens.*` reference.
 */
export function templateContainsTokensReference(value: string): boolean {
  if (!value.includes('{{')) {
    return false
  }

  const pattern = /\{\{([^}]+)\}\}/g
  let match: RegExpExecArray | null

  while ((match = pattern.exec(value)) !== null) {
    const rawReference = match[1].trim()

    if (rawReference.length > 0 && isTokensReference(rawReference)) {
      return true
    }
  }

  return false
}
