import { useEffect, useMemo, useRef, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type {
  RepeaterLayoutNode,
  RuntimeCollectionPaginationControlsVariant,
  RuntimeResponsiveLayoutValue,
} from '../../config/runtime-config'
import { LayoutRenderer } from '../layout-renderer'
import { useRuntimeLayoutContext } from '../runtime-layout-context'
import {
  createCollectionPaginationModel,
  createCollectionScrollWindow,
  createNumberedPaginationWindow,
} from '../runtime-collection-pagination'
import {
  getRepeaterPaginationButtonClassName,
  getRepeaterPaginationControlsClassName,
  getRepeaterPaginationCurrentButtonClassName,
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
  const [scrollVisibleCount, setScrollVisibleCount] = useState(node.props.pagination?.pageSize ?? 0)
  const items = resolveRepeaterItems(node.props.items.source, state)
  const pageSize = node.props.pagination?.pageSize
  const paginationControlsVariant = node.props.pagination?.controls?.variant ?? 'previousNext'
  const iterations = useMemo(() => resolveRepeaterIterations(node, items), [node, items])
  const paginationModel = useMemo(
    () => (pageSize === undefined ? null : createCollectionPaginationModel(iterations, pageSize)),
    [iterations, pageSize],
  )
  const paginationPage = paginationControlsVariant === 'scroll' ? null : paginationModel?.getPage(activePage)
  const scrollWindow =
    paginationControlsVariant === 'scroll' && pageSize !== undefined
      ? createCollectionScrollWindow(iterations, pageSize, scrollVisibleCount)
      : null
  const visibleIterations = scrollWindow?.visibleItems ?? paginationPage?.visibleItems ?? iterations

  useEffect(() => {
    setActivePage(1)
    setScrollVisibleCount(pageSize ?? 0)
  }, [items, pageSize, paginationControlsVariant])

  if (visibleIterations.length === 0) {
    return null
  }

  return (
    <>
      {visibleIterations.map((iteration) => {
        const iterationContext: RuntimeIterationContext = { item: iteration.item }

        return <LayoutRenderer key={iteration.key} nodes={node.props.template} iterationContext={iterationContext} />
      })}
      {paginationPage && paginationPage.totalPages > 1
        ? renderPaginationControls({
            variant: paginationControlsVariant,
            currentPage: paginationPage.currentPage,
            totalPages: paginationPage.totalPages,
            canGoPrevious: paginationPage.canGoPrevious,
            canGoNext: paginationPage.canGoNext,
            parentGridColumns,
            setActivePage,
          })
        : null}
      {scrollWindow?.canShowMore && pageSize !== undefined ? (
        <RepeaterScrollControls
          pageSize={pageSize}
          parentGridColumns={parentGridColumns}
          onShowMore={() => setScrollVisibleCount((visibleCount) => visibleCount + pageSize)}
        />
      ) : null}
    </>
  )
}

interface RepeaterPaginationControlsProps {
  variant: RuntimeCollectionPaginationControlsVariant
  currentPage: number
  totalPages: number
  canGoPrevious: boolean
  canGoNext: boolean
  parentGridColumns?: RuntimeResponsiveLayoutValue | null
  setActivePage: Dispatch<SetStateAction<number>>
}

function renderPaginationControls({
  variant,
  currentPage,
  totalPages,
  canGoPrevious,
  canGoNext,
  parentGridColumns,
  setActivePage,
}: RepeaterPaginationControlsProps) {
  if (variant === 'numbered') {
    const pageWindow = createNumberedPaginationWindow({ currentPage, totalPages })

    return (
      <div className={getRepeaterPaginationControlsClassName(parentGridColumns)} data-layout-node="repeater-pagination">
        <button
          type="button"
          className={getRepeaterPaginationButtonClassName()}
          disabled={!canGoPrevious}
          onClick={() => setActivePage(1)}
        >
          Primera
        </button>
        <button
          type="button"
          className={getRepeaterPaginationButtonClassName()}
          disabled={!canGoPrevious}
          onClick={() => setActivePage((page) => Math.max(1, page - 1))}
        >
          Anterior
        </button>
        {pageWindow.map((page) => (
          <button
            key={page}
            type="button"
            className={page === currentPage ? getRepeaterPaginationCurrentButtonClassName() : getRepeaterPaginationButtonClassName()}
            aria-current={page === currentPage ? 'page' : undefined}
            onClick={() => setActivePage(page)}
          >
            {page}
          </button>
        ))}
        <button
          type="button"
          className={getRepeaterPaginationButtonClassName()}
          disabled={!canGoNext}
          onClick={() => setActivePage((page) => Math.min(totalPages, page + 1))}
        >
          Siguiente
        </button>
        <button
          type="button"
          className={getRepeaterPaginationButtonClassName()}
          disabled={!canGoNext}
          onClick={() => setActivePage(totalPages)}
        >
          Última
        </button>
      </div>
    )
  }

  return (
    <div className={getRepeaterPaginationControlsClassName(parentGridColumns)} data-layout-node="repeater-pagination">
      <button
        type="button"
        className={getRepeaterPaginationButtonClassName()}
        disabled={!canGoPrevious}
        onClick={() => setActivePage((page) => Math.max(1, page - 1))}
      >
        Anterior
      </button>
      <button
        type="button"
        className={getRepeaterPaginationButtonClassName()}
        disabled={!canGoNext}
        onClick={() => setActivePage((page) => Math.min(totalPages, page + 1))}
      >
        Siguiente
      </button>
    </div>
  )
}

interface RepeaterScrollControlsProps {
  pageSize: number
  parentGridColumns?: RuntimeResponsiveLayoutValue | null
  onShowMore: () => void
}

function RepeaterScrollControls({ pageSize, parentGridColumns, onShowMore }: RepeaterScrollControlsProps) {
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const hasIntersectionObserver = typeof globalThis.IntersectionObserver === 'function'

  useEffect(() => {
    const sentinel = sentinelRef.current

    if (!hasIntersectionObserver || !sentinel) {
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          onShowMore()
        }
      },
      {
        threshold: 0.75,
      },
    )

    observer.observe(sentinel)

    return () => {
      observer.disconnect()
    }
  }, [hasIntersectionObserver, onShowMore, pageSize])

  if (!hasIntersectionObserver) {
    return (
      <div className={getRepeaterPaginationControlsClassName(parentGridColumns)} data-layout-node="repeater-pagination">
        <button type="button" className={getRepeaterPaginationButtonClassName()} onClick={onShowMore}>
          Mostrar más
        </button>
      </div>
    )
  }

  return (
    <div
      ref={sentinelRef}
      className={getRepeaterPaginationControlsClassName(parentGridColumns)}
      data-layout-node="repeater-scroll-sentinel"
      aria-hidden="true"
    />
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
