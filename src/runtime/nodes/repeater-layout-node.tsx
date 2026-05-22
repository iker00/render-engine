import { useEffect, useMemo, useState } from 'react'
import type { RepeaterLayoutNode } from '../../config/runtime-config'
import { LayoutRenderer } from '../layout-renderer'
import { useRuntimeLayoutContext } from '../runtime-layout-context'
import { createCollectionPaginationModel } from '../runtime-collection-pagination'
import {
  getRepeaterPaginationButtonClassName,
  getRepeaterPaginationControlsClassName,
  getRepeaterPaginationIndicatorClassName,
} from '../runtime-node-styling'
import type { RuntimeIterationContext } from '../runtime-references/runtime-reference-resolver'
import { resolveRuntimeReference } from '../runtime-references/runtime-reference-resolver'
import { useRuntimeState } from '../runtime-state/runtime-state-provider'

interface RepeaterNodeProps {
  node: RepeaterLayoutNode
}

interface RepeaterIteration {
  key: string
  item: unknown
}

export function RepeaterNode({ node }: RepeaterNodeProps) {
  const state = useRuntimeState()
  const { parentGridColumns } = useRuntimeLayoutContext()
  const [activePage, setActivePage] = useState(1)
  const items = resolveRepeaterItems(node.props.items.source, state)
  const pageSize = node.props.pagination?.pageSize
  const iterations = useMemo(() => resolveRepeaterIterations(node, items), [node, items])
  const paginationModel = useMemo(
    () => (pageSize === undefined ? null : createCollectionPaginationModel(iterations, pageSize)),
    [iterations, pageSize],
  )
  const paginationPage = paginationModel?.getPage(activePage)
  const visibleIterations = paginationPage?.visibleItems ?? iterations

  useEffect(() => {
    setActivePage(1)
  }, [items, pageSize])

  if (visibleIterations.length === 0) {
    return null
  }

  return (
    <>
      {visibleIterations.map((iteration) => {
        const iterationContext: RuntimeIterationContext = { item: iteration.item }

        return <LayoutRenderer key={iteration.key} nodes={node.props.template} iterationContext={iterationContext} />
      })}
      {paginationPage && paginationPage.totalPages > 1 ? (
        <div className={getRepeaterPaginationControlsClassName(parentGridColumns)} data-layout-node="repeater-pagination">
          <button
            type="button"
            className={getRepeaterPaginationButtonClassName()}
            disabled={!paginationPage.canGoPrevious}
            onClick={() => setActivePage((currentPage) => Math.max(1, currentPage - 1))}
          >
            Anterior
          </button>
          <span className={getRepeaterPaginationIndicatorClassName()}>
            Página {paginationPage.currentPage} de {paginationPage.totalPages}
          </span>
          <button
            type="button"
            className={getRepeaterPaginationButtonClassName()}
            disabled={!paginationPage.canGoNext}
            onClick={() => setActivePage((currentPage) => Math.min(paginationPage.totalPages, currentPage + 1))}
          >
            Siguiente
          </button>
        </div>
      ) : null}
    </>
  )
}

function resolveRepeaterIterations(node: RepeaterLayoutNode, items: unknown[]): RepeaterIteration[] {
  const seenKeys = new Set<string>()
  const iterations: RepeaterIteration[] = []

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index]
    const resolvedKey = resolveRepeaterItemKey(item, node.props.items.key)

    if (resolvedKey === null) {
      reportRepeaterKeyDiagnostic(node, index, 'invalid')
      continue
    }

    const effectiveKey = String(resolvedKey)

    if (seenKeys.has(effectiveKey)) {
      reportRepeaterKeyDiagnostic(node, index, 'duplicate', effectiveKey)
      continue
    }

    seenKeys.add(effectiveKey)
    iterations.push({
      key: effectiveKey,
      item,
    })
  }

  return iterations
}

function resolveRepeaterItems(source: string, state: ReturnType<typeof useRuntimeState>) {
  const result = resolveRuntimeReference(source, state)

  if (result.status !== 'resolved' || !Array.isArray(result.value)) {
    return []
  }

  return result.value
}

function resolveRepeaterItemKey(item: unknown, path: string): string | number | null {
  const segments = path.split('.')
  let currentValue = item

  for (const segment of segments) {
    if (segment.length === 0) {
      return null
    }

    if (Array.isArray(currentValue)) {
      if (!/^(0|[1-9]\d*)$/.test(segment)) {
        return null
      }

      currentValue = currentValue[Number(segment)]
      continue
    }

    if (typeof currentValue !== 'object' || currentValue === null) {
      return null
    }

    const objectValue = currentValue as Record<string, unknown>

    if (!Object.hasOwn(objectValue, segment)) {
      return null
    }

    currentValue = objectValue[segment]
  }

  return typeof currentValue === 'string' || typeof currentValue === 'number' ? currentValue : null
}

function reportRepeaterKeyDiagnostic(
  node: RepeaterLayoutNode,
  index: number,
  reason: 'invalid' | 'duplicate',
  key?: string,
) {
  if (!import.meta.env.DEV) {
    return
  }

  if (reason === 'duplicate') {
    console.warn(
      `[runtime-repeater] Skipping duplicate iteration key "${key ?? ''}" at repeater "${node.id ?? node.type}" item index ${index}.`,
    )
    return
  }

  console.warn(
    `[runtime-repeater] Skipping iteration with non-scalar or missing key at repeater "${node.id ?? node.type}" item index ${index}.`,
  )
}
