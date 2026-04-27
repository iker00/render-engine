import { LayoutRenderer } from './layout-renderer'
import { useRuntimeCurrentPage } from './runtime-state/runtime-state-provider'

export function RuntimePage() {
  const page = useRuntimeCurrentPage()

  if (page === null) {
    return <section data-testid="runtime-page" />
  }

  return (
    <section data-runtime-page-id={page.id} data-testid="runtime-page">
      <LayoutRenderer nodes={page.layout} />
    </section>
  )
}
