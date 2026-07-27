import type { LayoutNode } from '../../config/runtime-config'
import { getNodeAtPath, type LayoutNodePath } from '../../runtime/layout-node-path'
import { LayoutCanvasBreadcrumb } from '../layout-canvas/layout-canvas-breadcrumb'
import { LayoutCanvasPropertiesPanel } from '../layout-canvas/layout-canvas-properties-panel'

export interface FloatingSelectionOverlayProps {
  pageLayout: readonly LayoutNode[]
  selectedPath: LayoutNodePath | null
  onSelectNode: (path: LayoutNodePath | null) => void
  onCommitNodeUpdate: (path: LayoutNodePath, updater: (node: LayoutNode) => LayoutNode) => void
  onDeleteNode: () => void
}

const PANEL_CLASSES = [
  'fixed',
  'inset-y-0',
  'right-0',
  'z-[9999]',
  'flex',
  'w-full',
  'max-w-sm',
  'max-h-screen',
  'flex-col',
  'border-l',
  'bg-white',
  'shadow-2xl',
].join(' ')

const CONTENT_CLASSES = 'min-h-0 flex-1 overflow-y-auto'

/**
 * FR9 / Decisión 6 (0103), rediseñado en 0104: panel lateral derecho fijo que combina el
 * breadcrumb y el panel de propiedades reutilizados sin cambios desde 0102. A diferencia del
 * diseño anclado original, no depende de `data-node-path` ni mide ningún elemento del DOM: se
 * acopla al borde derecho del viewport (misma familia visual que FloatingMonacoPanel) con scroll
 * interno propio cuando su contenido excede la altura disponible.
 */
export function FloatingSelectionOverlay({
  pageLayout,
  selectedPath,
  onSelectNode,
  onCommitNodeUpdate,
  onDeleteNode,
}: FloatingSelectionOverlayProps) {
  const selectedNode = selectedPath === null ? null : getNodeAtPath(pageLayout, selectedPath)

  if (selectedPath === null || selectedNode === null) {
    return null
  }

  return (
    <div data-testid="dev-editor-selection-overlay" className={PANEL_CLASSES}>
      <div className="flex items-center justify-between border-b px-4 py-3">
        <span className="text-sm font-semibold">Selección</span>
        <button
          type="button"
          data-testid="dev-editor-selection-overlay-close"
          onClick={() => onSelectNode(null)}
          className="rounded p-1 hover:bg-gray-100"
          aria-label="Cerrar panel de selección"
        >
          ✕
        </button>
      </div>

      <div className={CONTENT_CLASSES}>
        <LayoutCanvasBreadcrumb
          pageLayout={pageLayout}
          selectedPath={selectedPath}
          onSelectNode={onSelectNode}
        />
        <LayoutCanvasPropertiesPanel
          node={selectedNode}
          path={selectedPath}
          onCommitNodeUpdate={onCommitNodeUpdate}
          onDeleteNode={onDeleteNode}
        />
      </div>
    </div>
  )
}
