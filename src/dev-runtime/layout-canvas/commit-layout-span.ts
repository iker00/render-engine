import type { LayoutNode, RuntimeResponsiveLayoutValue } from '../../config/runtime-config'
import type { LayoutNodePath } from '../../runtime/layout-node-path'
import type { CommitCanvasMutationResult } from './layout-canvas-commit'

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

// Kept out of `layout-canvas-properties-panel.tsx` (a pure function, no React dependency) so that
// file keeps exporting only its own component — required for Fast Refresh
// (`react-refresh/only-export-components`), the same convention `shell-tree-mutations.ts`
// established for `parseShellTreeDropZoneId`.
//
// T2 (0127): the commit half of `LayoutSpanWidgetContext`'s `commitSpan` — writes a new
// `layout.span` back through `onCommitNodeUpdate` at the given `path`, preserving every other key
// `layout` may declare (today only `span` itself, but the updater doesn't assume that), and
// returns whatever `onCommitNodeUpdate` returns, unchanged.
export function commitLayoutSpan(
  onCommitNodeUpdate: (path: LayoutNodePath, updater: (node: LayoutNode) => LayoutNode) => CommitCanvasMutationResult | void,
  path: LayoutNodePath,
  nextSpan: RuntimeResponsiveLayoutValue | undefined,
): CommitCanvasMutationResult | void {
  return onCommitNodeUpdate(path, (currentNode) => {
    const currentLayout = (currentNode as unknown as Record<string, unknown>).layout
    return {
      ...(currentNode as unknown as Record<string, unknown>),
      layout: {
        ...(isPlainObject(currentLayout) ? currentLayout : {}),
        span: nextSpan,
      },
    } as unknown as LayoutNode
  })
}
