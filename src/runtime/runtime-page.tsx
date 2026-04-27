import type { RuntimePageConfig } from '../config/runtime-config'
import { LayoutRenderer } from './layout-renderer'

export interface RuntimePageProps {
  page: RuntimePageConfig
}

export function RuntimePage({ page }: RuntimePageProps) {
  return (
    <section data-testid="runtime-page">
      <LayoutRenderer node={page.layout} />
    </section>
  )
}
