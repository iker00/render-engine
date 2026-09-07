import type { LayoutNode } from '../../config/runtime-config'
import type { RuntimeGroupsConfig } from '../../config/runtime-config-types'
import { getNodeAtPath, type LayoutNodePath } from '../../runtime/layout-node-path'
import { LayoutCanvasPropertiesPanel } from '../layout-canvas/layout-canvas-properties-panel'

export interface FloatingSelectionOverlayProps {
  pageLayout: readonly LayoutNode[]
  // T15 (feature reusable-node-groups): forwarded to `LayoutCanvasPropertiesPanel` so the
  // `group` instance widget can list existing group ids. Optional — omitted by callers with no
  // real `groups` block (e.g. `DevEditorGroupsCanvas`'s own template canvas, where a `group`
  // instance can never legitimately be selected — see `validate-groups.ts`'s
  // `insideGroupTemplate` rejection).
  groups?: RuntimeGroupsConfig
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
 * FR9 / Decisión 6 (0103), rediseñado en 0104: panel lateral derecho fijo que aloja el panel de
 * propiedades. A diferencia del diseño anclado original, no depende de `data-node-path` ni mide
 * ningún elemento del DOM: se acopla al borde derecho del viewport (misma familia visual que
 * FloatingMonacoPanel) con scroll interno propio cuando su contenido excede la altura disponible.
 *
 * T3 (0133): es un contenedor puramente posicional. La cabecera propia (breadcrumb, titular,
 * botones de borrar/cerrar) y la fila de identidad viven dentro de `LayoutCanvasPropertiesPanel`
 * — este componente solo le delega `pageLayout`, `onClose` (que limpia la selección) y
 * `onSelectAncestor` (que navega el breadcrumb).
 */
export function FloatingSelectionOverlay({
  pageLayout,
  groups,
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
      <div className={CONTENT_CLASSES}>
        <LayoutCanvasPropertiesPanel
          node={selectedNode}
          path={selectedPath}
          pageLayout={pageLayout}
          groups={groups}
          onCommitNodeUpdate={onCommitNodeUpdate}
          onDeleteNode={onDeleteNode}
          onClose={() => onSelectNode(null)}
          onSelectAncestor={onSelectNode}
        />
      </div>
    </div>
  )
}
