import { createContext, useContext } from 'react'
import type { RuntimeResponsiveLayoutValue } from '../../../config/runtime-config'
import type { CommitCanvasMutationResult } from '../layout-canvas-commit'

// T2 (0127): context the `layout-span` widget (`WIDGET_REGISTRY['layout-span']`) reads from,
// provided by `LayoutCanvasPropertiesPanel` around the `layout` subsection whenever it renders
// (i.e. only when a `container` ancestor with `columns` exists — see
// `resolveAncestorContainerColumns`). `parentColumns` is the raw, unnormalized `columns` contract
// value of the nearest such ancestor; `spanValue` is `node.layout?.span` for the current render;
// `commitSpan` writes a new span value back through `onCommitNodeUpdate` (see
// `commitLayoutSpan` in `layout-canvas-properties-panel.tsx`) and returns whatever that call
// returns, unchanged.
export interface LayoutSpanWidgetContextValue {
  parentColumns: RuntimeResponsiveLayoutValue
  spanValue: RuntimeResponsiveLayoutValue | undefined
  commitSpan: (nextSpan: RuntimeResponsiveLayoutValue | undefined) => CommitCanvasMutationResult | void
}

export const LayoutSpanWidgetContext = createContext<LayoutSpanWidgetContextValue | null>(null)

// Deliberately throws rather than returning `null`/a default: a `layout-span` widget can only
// ever be mounted by the dispatcher's `x-widget` hook inside `LayoutCanvasPropertiesPanel`'s own
// `layout` subsection provider (the only place this context is provided). Any other mount point
// is a wiring bug, and failing loudly in tests/dev surfaces it immediately instead of rendering a
// silently broken widget.
export function useLayoutSpanWidgetContext(): LayoutSpanWidgetContextValue {
  const context = useContext(LayoutSpanWidgetContext)
  if (context === null) {
    throw new Error(
      'useLayoutSpanWidgetContext must be used within LayoutSpanWidgetContext.Provider — the layout-span widget was mounted outside LayoutCanvasPropertiesPanel\'s layout subsection.',
    )
  }
  return context
}
