import type { RuntimeConfig } from '../../config/runtime-config-types'

export interface TokenHeaderReferenceSource {
  label: string
  count: number
}

export interface TokenHeaderReferenceScan {
  totalCount: number
  sources: TokenHeaderReferenceSource[]
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function countHeaderValueMatches(headers: Record<string, unknown>, pattern: string): number {
  let count = 0
  for (const value of Object.values(headers)) {
    if (typeof value === 'string' && value.includes(pattern)) {
      count += 1
    }
  }
  return count
}

// Recorrido estructural genérico: no conoce nombres de campo concretos que contienen
// acciones (`props.action`, `submitAction`, `executeOperations`, `onSuccess`, `onError`, etc.),
// solo detecta cualquier propiedad literalmente llamada `headers` cuyo valor sea un objeto
// plano y cuenta las referencias por substring dentro de sus valores string.
function countTokenHeaderMatches(value: unknown, pattern: string): number {
  if (Array.isArray(value)) {
    return value.reduce((total, item) => total + countTokenHeaderMatches(item, pattern), 0)
  }

  if (!isPlainObject(value)) {
    return 0
  }

  let count = 0
  for (const [key, fieldValue] of Object.entries(value)) {
    if (key === 'headers' && isPlainObject(fieldValue)) {
      count += countHeaderValueMatches(fieldValue, pattern)
      continue
    }
    count += countTokenHeaderMatches(fieldValue, pattern)
  }

  return count
}

export function scanOrphanTokenHeaderReferences(
  config: RuntimeConfig,
  tokenId: string
): TokenHeaderReferenceScan {
  const pattern = `tokens.${tokenId}.value`
  const sources: TokenHeaderReferenceSource[] = []
  let totalCount = 0

  for (const [operationId, operation] of Object.entries(config.api)) {
    const count = countTokenHeaderMatches(operation, pattern)
    if (count > 0) {
      sources.push({ label: `en la operación «${operationId}»`, count })
      totalCount += count
    }
  }

  for (const page of config.pages) {
    const count = countTokenHeaderMatches(page.layout, pattern)
    if (count > 0) {
      sources.push({ label: `en la página «${page.id}»`, count })
      totalCount += count
    }
  }

  const globalPreloadsCount = countTokenHeaderMatches(config.preloads, pattern)
  if (globalPreloadsCount > 0) {
    sources.push({ label: 'en las precargas globales', count: globalPreloadsCount })
    totalCount += globalPreloadsCount
  }

  for (const page of config.pages) {
    const count = countTokenHeaderMatches(page.preloads, pattern)
    if (count > 0) {
      sources.push({ label: `en las precargas de la página «${page.id}»`, count })
      totalCount += count
    }
  }

  return { totalCount, sources }
}
