import type { RuntimeConfigError } from './runtime-config-types'
import { isNonEmptyString, isValidCollectionPathSegment } from './validate-node-shared-helpers'
import { parseRuntimeReference } from './runtime-reference-syntax'
import { invalidLayout } from './runtime-config-validation-errors'

export function validateCollectionSource(
  rawSource: unknown,
  path: string,
  pageId: string,
  options: { allowItemReference?: boolean } = {},
): { status: 'ready'; source: string } | { status: 'error'; error: RuntimeConfigError } {
  if (!isNonEmptyString(rawSource)) {
    return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}".`)
  }

  if (!isValidCollectionSourceReference(rawSource, options)) {
    return invalidLayout(
      `Page "${pageId}" has an invalid layout at "${path}": collection sources must use queries.{queryName}.data, queries.{queryName}.data.* or item.*.`,
    )
  }

  return {
    status: 'ready',
    source: rawSource,
  }
}

function isValidCollectionSourceReference(value: string, options: { allowItemReference?: boolean } = {}) {
  if (options.allowItemReference && (value === 'item' || value.startsWith('item.'))) {
    const parsedReference = parseRuntimeReference(value, { allowItemReference: true })
    return parsedReference.kind === 'reference' && parsedReference.status === 'supported'
  }

  return isValidQueryCollectionSource(value)
}

function isValidQueryCollectionSource(value: string) {
  const parts = value.split('.')

  if (parts.length < 3) {
    return false
  }

  const [namespace, queryName, property, ...nestedPath] = parts

  if (namespace !== 'queries' || property !== 'data' || !isValidCollectionPathSegment(queryName)) {
    return false
  }

  return nestedPath.every(isValidCollectionPathSegment)
}
