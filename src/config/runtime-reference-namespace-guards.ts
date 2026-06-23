import { parseRuntimeReference } from '../runtime/runtime-references/runtime-reference-parser'

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
 * Returns true if any `{{...}}` placeholder in the given template string
 * contains a `tokens.*` reference.
 */
export function templateContainsTokensReference(value: string): boolean {
  if (!value.includes('{{')) {
    return false
  }

  const pattern = /\{\{([^}]+)\}\}/g
  let match: RegExpExecArray | null

  // eslint-disable-next-line no-cond-assign
  while ((match = pattern.exec(value)) !== null) {
    const rawReference = match[1].trim()

    if (rawReference.length > 0 && isTokensReference(rawReference)) {
      return true
    }
  }

  return false
}
