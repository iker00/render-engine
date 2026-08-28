import { useEffect, useMemo, useRef, useState } from 'react'
import type {
  LayoutNode,
  RepeaterLayoutNode,
  RuntimeCollectionPaginationControlsVariant,
  RuntimeResponsiveLayoutValue,
} from '../../config/runtime-config'
import { LayoutRenderer } from '../layout-renderer'
import { useRuntimeLayoutContext } from '../use-runtime-layout-context'
import { RuntimeLayoutContextProvider } from '../runtime-layout-context'
import {
  createCollectionPaginationModel,
  createCollectionScrollWindow,
} from '../runtime-collection-pagination'
import {
  getRepeaterGridClassName,
  getRepeaterPaginationButtonClassName,
  getRepeaterPaginationControlsClassName,
  getRepeaterPaginationCurrentButtonClassName,
} from '../runtime-node-styling'
import { CollectionPaginationControls } from './collection-pagination-controls'
import type { RuntimeIterationContext } from '../runtime-references/runtime-reference-resolver'
import { resolveRuntimeReference } from '../runtime-references/runtime-reference-resolver'
import { useRuntimeState, useRuntimeStateActions } from '../runtime-state/use-runtime-state'
import { selectActiveModal } from '../runtime-state/runtime-state-selectors'
import { useLayoutEditModeContext } from '../use-layout-edit-mode-context'
import type { LayoutNodePath } from '../layout-node-path'

interface RepeaterNodeProps {
  node: RepeaterLayoutNode
  path?: LayoutNodePath
}

const EDIT_MODE_ITERATION_KEY = '__edit-mode-instance__'

interface RepeaterIteration {
  key: string
  item: unknown
  itemKey?: string
  itemIndex: number
}

export function RepeaterNode({ node, path }: RepeaterNodeProps) {
  const state = useRuntimeState()
  const { closeModal } = useRuntimeStateActions()
  const { parentGridColumns } = useRuntimeLayoutContext()
  const editModeContext = useLayoutEditModeContext()
  const isEditMode = editModeContext !== null && editModeContext.active
  const sourceItems = resolveRepeaterSourceItems(node.props.items.source, state)
  const pageSize = node.props.pagination?.pageSize
  const paginationControlsVariant = node.props.pagination?.controls?.variant ?? 'previousNext'
  // In edit mode we never expand the collection into N iterations (Decisión 10), so skip the
  // key-resolution/diagnostics pass entirely rather than computing and discarding it.
  const iterations = useMemo(
    () => (isEditMode ? [] : resolveRepeaterIterations(node, sourceItems)),
    [isEditMode, node, sourceItems],
  )
  const templateModalIds = useMemo(() => collectModalIdsFromTemplate(node.props.template), [node.props.template])
  const paginationStateKey = useMemo(
    () => `${paginationControlsVariant}:${pageSize ?? 'all'}:${iterations.map((iteration) => iteration.key).join('|')}`,
    [iterations, pageSize, paginationControlsVariant],
  )
  const activeModal = selectActiveModal(state)

  useEffect(() => {
    if (isEditMode) return
    if (!activeModal.activeModalId || !activeModal.activeIterationKey) return
    if (!templateModalIds.has(activeModal.activeModalId)) return
    const iterationKeys = new Set(iterations.map((iter) => iter.key))
    if (!iterationKeys.has(activeModal.activeIterationKey)) {
      closeModal(activeModal.activeModalId, {
        iterationContext: { item: null, key: activeModal.activeIterationKey, itemIndex: -1 },
      })
    }
  }, [isEditMode, iterations, activeModal, closeModal, templateModalIds])

  if (isEditMode) {
    const basePath = path ?? []
    const editModeIterationContext: RuntimeIterationContext = {
      item: sourceItems.entries[0]?.value ?? {},
      key: EDIT_MODE_ITERATION_KEY,
      itemIndex: 0,
    }
    const editModeLayoutRenderer = (
      <LayoutRenderer
        nodes={node.props.template}
        iterationContext={editModeIterationContext}
        path={basePath}
        buildChildPath={(index) => [...basePath, { field: 'template', index }]}
      />
    )

    if (node.props.columns === undefined) {
      return editModeLayoutRenderer
    }

    const gridStyling = getRepeaterGridClassName({
      columns: node.props.columns,
      gap: node.props.gap,
      align: node.props.align,
      justify: node.props.justify,
    })

    return (
      <div className={gridStyling.className} style={gridStyling.style}>
        <RuntimeLayoutContextProvider value={{ parentGridColumns: node.props.columns }}>
          {editModeLayoutRenderer}
        </RuntimeLayoutContextProvider>
      </div>
    )
  }

  return (
    <RepeaterNodeContent
      key={paginationStateKey}
      node={node}
      iterations={iterations}
      pageSize={pageSize}
      paginationControlsVariant={paginationControlsVariant}
      parentGridColumns={parentGridColumns}
    />
  )
}

interface RepeaterNodeContentProps {
  node: RepeaterLayoutNode
  iterations: RepeaterIteration[]
  pageSize?: number
  paginationControlsVariant: RuntimeCollectionPaginationControlsVariant
  parentGridColumns?: RuntimeResponsiveLayoutValue | null
}

function RepeaterNodeContent({
  node,
  iterations,
  pageSize,
  paginationControlsVariant,
  parentGridColumns,
}: RepeaterNodeContentProps) {
  const [activePage, setActivePage] = useState(1)
  const [scrollVisibleCount, setScrollVisibleCount] = useState(pageSize ?? 0)
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

  if (visibleIterations.length === 0 && node.props.columns === undefined) {
    return null
  }

  const iterationsMarkup = visibleIterations.map((iteration) => {
    const iterationContext: RuntimeIterationContext = {
      item: iteration.item,
      key: iteration.key,
      itemKey: iteration.itemKey,
      itemIndex: iteration.itemIndex,
    }

    return <LayoutRenderer key={iteration.key} nodes={node.props.template} iterationContext={iterationContext} />
  })

  const gridStyling =
    node.props.columns === undefined
      ? null
      : getRepeaterGridClassName({
          columns: node.props.columns,
          gap: node.props.gap,
          align: node.props.align,
          justify: node.props.justify,
        })

  return (
    <>
      {gridStyling ? (
        <div className={gridStyling.className} style={gridStyling.style}>
          <RuntimeLayoutContextProvider value={{ parentGridColumns: node.props.columns ?? null }}>
            {iterationsMarkup}
          </RuntimeLayoutContextProvider>
        </div>
      ) : (
        iterationsMarkup
      )}
      {paginationPage && paginationPage.totalPages > 1 ? (
        <CollectionPaginationControls
          variant={paginationControlsVariant}
          currentPage={paginationPage.currentPage}
          totalPages={paginationPage.totalPages}
          canGoPrevious={paginationPage.canGoPrevious}
          canGoNext={paginationPage.canGoNext}
          setActivePage={setActivePage}
          dataLayoutNode="repeater-pagination"
          containerClassName={() => getRepeaterPaginationControlsClassName(parentGridColumns)}
          buttonClassName={getRepeaterPaginationButtonClassName}
          currentButtonClassName={getRepeaterPaginationCurrentButtonClassName}
        />
      ) : null}
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

interface RepeaterSourceItems {
  entries: Array<{ value: unknown; dictKey?: string }>
}

function resolveRepeaterSourceItems(source: string, state: ReturnType<typeof useRuntimeState>): RepeaterSourceItems {
  const result = resolveRuntimeReference(source, state)

  if (result.status !== 'resolved') {
    return { entries: [] }
  }

  if (Array.isArray(result.value)) {
    return { entries: result.value.map((value) => ({ value })) }
  }

  if (result.value !== null && typeof result.value === 'object') {
    return {
      entries: Object.keys(result.value as Record<string, unknown>).map((dictKey) => ({
        value: (result.value as Record<string, unknown>)[dictKey],
        dictKey,
      })),
    }
  }

  return { entries: [] }
}

function resolveRepeaterIterations(node: RepeaterLayoutNode, sourceItems: RepeaterSourceItems): RepeaterIteration[] {
  const seenKeys = new Set<string>()
  const iterations: RepeaterIteration[] = []
  const keyPath = node.props.items.key

  for (let index = 0; index < sourceItems.entries.length; index += 1) {
    const entry = sourceItems.entries[index]
    let effectiveKey: string | null = null

    if (keyPath === '$index') {
      effectiveKey = String(index)
    } else if (keyPath === '$key') {
      if (entry.dictKey === undefined) {
        reportRepeaterKeyDiagnostic(node, index, 'invalid')
        continue
      }

      effectiveKey = entry.dictKey
    } else {
      const resolvedKey = resolveRepeaterItemKey(entry.value, keyPath)

      if (resolvedKey === null) {
        reportRepeaterKeyDiagnostic(node, index, 'invalid')
        continue
      }

      effectiveKey = String(resolvedKey)
    }

    if (keyPath !== '$index' && seenKeys.has(effectiveKey)) {
      reportRepeaterKeyDiagnostic(node, index, 'duplicate', effectiveKey)
      continue
    }

    seenKeys.add(effectiveKey)
    iterations.push({
      key: effectiveKey,
      item: entry.value,
      itemKey: entry.dictKey,
      itemIndex: index,
    })
  }

  return iterations
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

function collectModalIdsFromTemplate(template: readonly LayoutNode[]): Set<string> {
  const ids = new Set<string>()
  for (const node of template) {
    if (node.type === 'modal') {
      ids.add(node.id)
    }
    if ('children' in node && Array.isArray(node.children)) {
      for (const id of collectModalIdsFromTemplate(node.children as LayoutNode[])) {
        ids.add(id)
      }
    }
    if (node.type === 'repeater') {
      for (const id of collectModalIdsFromTemplate(node.props.template)) {
        ids.add(id)
      }
    }
  }
  return ids
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
