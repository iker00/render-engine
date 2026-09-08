import { useEffect, useMemo, useRef, useState } from 'react'
import { LayoutRenderer } from './layout-renderer'
import { getRuntimePageClassName } from './runtime-node-styling'
import { AccordionGroupProvider } from './runtime-accordion-group'
import { RuntimeBlockingLoadingIndicator } from './runtime-blocking-loading-indicator'
import { deriveBlockingPreloadNames, isPreloadGateBlocked } from './runtime-global-preloads'
import { useRuntimeCurrentPage, useRuntimeState } from './runtime-state/use-runtime-state'

export function RuntimePage() {
  const page = useRuntimeCurrentPage()
  const state = useRuntimeState()
  const activeEntryId = state.pageEntry.entryId
  const sectionRef = useRef<HTMLElement | null>(null)
  // Entry id for which the blocking gate has already been lifted. Once it matches the active
  // entry id, the gate never blocks again for that entry, even if a blocking query transitions
  // back to "loading" afterwards. A fresh navigation always produces a new entry id, so the
  // comparison below naturally resets without any explicit bookkeeping.
  const [liftedGateEntryId, setLiftedGateEntryId] = useState<number | null>(null)

  // Deliberately keyed on page?.id, not the page object itself: selectCurrentPage returns a new
  // object reference on every config change (e.g. an edit-mode commit), which would otherwise
  // steal focus away from whatever the user is interacting with on every keystroke.
  useEffect(() => {
    if (page === null) return
    sectionRef.current?.focus({ preventScroll: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page?.id, activeEntryId])

  const blockingPreloadNames = useMemo(() => {
    if (page === null) return []

    const preloadNamesForEntry = new Set(state.pageEntry.preloadNames)
    const effectivePreloadsForEntry = (page.preloads ?? []).filter((preload) =>
      preloadNamesForEntry.has(preload.operationName),
    )

    return deriveBlockingPreloadNames(effectivePreloadsForEntry)
  }, [page, state.pageEntry.preloadNames])

  const gateAlreadyLifted = liftedGateEntryId === activeEntryId
  const isGateBlocking =
    !gateAlreadyLifted &&
    blockingPreloadNames.length > 0 &&
    isPreloadGateBlocked(blockingPreloadNames, state.queries)

  // Adjusting state directly during render (see "You Might Not Need an Effect" in the React
  // docs): guarded by a condition that becomes false as soon as it runs, so it cannot cascade
  // into an infinite render loop, and it avoids the extra render pass an effect would add.
  if (!isGateBlocking && !gateAlreadyLifted) {
    setLiftedGateEntryId(activeEntryId)
  }

  if (page === null) {
    return <section data-testid="runtime-page" />
  }

  return (
    <AccordionGroupProvider>
      <section
        ref={sectionRef}
        tabIndex={-1}
        className={`${getRuntimePageClassName()} focus:outline-none`}
        data-runtime-page-id={page.id}
        data-testid="runtime-page"
      >
        {isGateBlocking ? (
          <RuntimeBlockingLoadingIndicator />
        ) : (
          <LayoutRenderer key={`${page.id}:${activeEntryId}`} nodes={page.layout} />
        )}
      </section>
    </AccordionGroupProvider>
  )
}
