import { LayoutRenderer } from './layout-renderer'
import { getRuntimePageClassName } from './runtime-node-styling'
import { useRuntimeCurrentPage, useRuntimeState } from './runtime-state/runtime-state-provider'

export function RuntimePage() {
  const page = useRuntimeCurrentPage()
  const state = useRuntimeState()
  const activeEntryId = state.pageEntry.entryId

  if (page === null) {
    return <section data-testid="runtime-page" />
  }

  return (
    <section className={getRuntimePageClassName()} data-runtime-page-id={page.id} data-testid="runtime-page">
      <LayoutRenderer key={`${page.id}:${activeEntryId}`} nodes={page.layout} />
    </section>
  )
}
