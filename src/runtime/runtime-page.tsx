import { useEffect, useRef } from 'react'
import { LayoutRenderer } from './layout-renderer'
import { getRuntimePageClassName } from './runtime-node-styling'
import { AccordionGroupProvider } from './runtime-accordion-group'
import { useRuntimeCurrentPage, useRuntimeState } from './runtime-state/runtime-state-provider'

export function RuntimePage() {
  const page = useRuntimeCurrentPage()
  const state = useRuntimeState()
  const activeEntryId = state.pageEntry.entryId
  const sectionRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (page === null) return
    sectionRef.current?.focus({ preventScroll: true })
  }, [page?.id, activeEntryId, page])

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
        <LayoutRenderer key={`${page.id}:${activeEntryId}`} nodes={page.layout} />
      </section>
    </AccordionGroupProvider>
  )
}
