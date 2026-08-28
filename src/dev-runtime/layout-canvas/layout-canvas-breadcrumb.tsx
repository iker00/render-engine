import type { LayoutNode } from '../../config/runtime-config'
import { getNodeAtPath, serializeLayoutNodePath, type LayoutNodePath } from '../../runtime/layout-node-path'

interface LayoutCanvasBreadcrumbProps {
  pageLayout: readonly LayoutNode[]
  selectedPath: LayoutNodePath | null
  onSelectNode: (path: LayoutNodePath) => void
}

interface BreadcrumbSegment {
  path: LayoutNodePath
  label: string
}

function buildBreadcrumbLabel(node: LayoutNode): string {
  // `hidden` is the only node type with no `id` field at all; every other
  // node type declares it (optional or required), so a plain "in" check is
  // enough to read it safely across the full LayoutNode union.
  const nodeId = 'id' in node ? node.id : undefined
  return nodeId ? `${node.type} (${nodeId})` : node.type
}

// Walks every prefix of selectedPath (from length 1 up to the full path) and
// resolves the ancestor chain via getNodeAtPath. The empty prefix has no
// corresponding node and is intentionally skipped.
function buildBreadcrumbSegments(
  pageLayout: readonly LayoutNode[],
  selectedPath: LayoutNodePath,
): BreadcrumbSegment[] {
  const segments: BreadcrumbSegment[] = []

  for (let length = 1; length <= selectedPath.length; length++) {
    const prefix = selectedPath.slice(0, length)
    const node = getNodeAtPath(pageLayout, prefix)
    if (node === null) continue
    segments.push({ path: prefix, label: buildBreadcrumbLabel(node) })
  }

  return segments
}

export function LayoutCanvasBreadcrumb({ pageLayout, selectedPath, onSelectNode }: LayoutCanvasBreadcrumbProps) {
  if (selectedPath === null) return null

  const segments = buildBreadcrumbSegments(pageLayout, selectedPath)

  return (
    <nav
      data-testid="layout-canvas-breadcrumb"
      aria-label="Ruta del nodo seleccionado"
      className="flex flex-wrap items-center gap-1 text-xs"
    >
      {segments.map((segment, index) => {
        const isLast = index === segments.length - 1
        return (
          <span key={serializeLayoutNodePath(segment.path)} className="flex items-center gap-1">
            {index > 0 && (
              <span aria-hidden="true" className="text-gray-300">
                &gt;
              </span>
            )}
            {isLast ? (
              <span className="font-medium text-gray-900">{segment.label}</span>
            ) : (
              <button
                type="button"
                onClick={() => onSelectNode(segment.path)}
                className="text-gray-400 hover:text-gray-600 hover:underline"
              >
                {segment.label}
              </button>
            )}
          </span>
        )
      })}
    </nav>
  )
}
