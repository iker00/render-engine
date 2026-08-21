import type { RuntimeConfig } from '../../config/runtime-config-types'

export interface OrphanNavigateToReferenceSource {
  label: string
  count: number
}

export interface OrphanNavigateToReferenceScan {
  totalCount: number
  sources: OrphanNavigateToReferenceSource[]
}

// Recorrido estructural genérico: no conoce nombres de campo concretos de acción
// (`props.action`, `submitAction`, `onSuccess`, `onError`, `operations`, etc.), solo
// cuenta cualquier objeto con la forma exacta `{ type: 'navigateTo', pageId }`.
// Ver Decisión 3 de design.md.
function countNavigateToMatches(value: unknown, targetPageId: string): number {
  if (typeof value !== 'object' || value === null) {
    return 0
  }

  if (Array.isArray(value)) {
    return value.reduce((total, item) => total + countNavigateToMatches(item, targetPageId), 0)
  }

  const record = value as Record<string, unknown>
  let count = record.type === 'navigateTo' && record.pageId === targetPageId ? 1 : 0

  for (const key of Object.keys(record)) {
    count += countNavigateToMatches(record[key], targetPageId)
  }

  return count
}

export function scanOrphanNavigateToReferences(
  config: RuntimeConfig,
  targetPageId: string
): OrphanNavigateToReferenceScan {
  const sources: OrphanNavigateToReferenceSource[] = []
  let totalCount = 0

  for (const page of config.pages) {
    const count = countNavigateToMatches(page.layout, targetPageId)
    if (count > 0) {
      sources.push({ label: `en la página «${page.id}»`, count })
      totalCount += count
    }
  }

  const headerCount = countNavigateToMatches(config.shell?.header, targetPageId)
  if (headerCount > 0) {
    sources.push({ label: 'en el menú del header', count: headerCount })
    totalCount += headerCount
  }

  const sidebarCount = countNavigateToMatches(config.shell?.sidebar, targetPageId)
  if (sidebarCount > 0) {
    sources.push({ label: 'en el sidebar', count: sidebarCount })
    totalCount += sidebarCount
  }

  return { totalCount, sources }
}
