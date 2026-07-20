import { useCallback, useLayoutEffect, useState } from 'react'
import type { LayoutNode } from '../../config/runtime-config'
import { getNodeAtPath, serializeLayoutNodePath, type LayoutNodePath } from '../../runtime/layout-node-path'
import { LayoutCanvasBreadcrumb } from '../layout-canvas/layout-canvas-breadcrumb'
import { LayoutCanvasPropertiesPanel } from '../layout-canvas/layout-canvas-properties-panel'
import { type OverlaySize, useAnchoredPosition } from './overlay-anchor-position'

export interface FloatingSelectionOverlayProps {
  pageLayout: readonly LayoutNode[]
  selectedPath: LayoutNodePath | null
  onSelectNode: (path: LayoutNodePath | null) => void
  onCommitNodeUpdate: (path: LayoutNodePath, updater: (node: LayoutNode) => LayoutNode) => void
  onDeleteNode: () => void
}

const CONTAINER_CLASSES = 'fixed z-[9999] rounded-md border bg-white shadow-lg'

/**
 * FR9 / Decisión 6 (0103): overlay flotante anclado al nodo seleccionado que
 * combina el breadcrumb y el panel de propiedades reutilizados sin cambios
 * desde 0102. Se apoya en `position: fixed` para no alterar el ancho ni el
 * layout del contenido real, y se ubica junto al elemento que expone
 * `data-node-path` — el mismo atributo que la infraestructura de edición ya
 * usa para el hover/selección y para las drop zones del canvas.
 */
export function FloatingSelectionOverlay({
  pageLayout,
  selectedPath,
  onSelectNode,
  onCommitNodeUpdate,
  onDeleteNode,
}: FloatingSelectionOverlayProps) {
  const [anchorElement, setAnchorElement] = useState<HTMLElement | null>(null)
  const [overlaySize, setOverlaySize] = useState<OverlaySize | null>(null)

  const serializedPath = selectedPath === null ? null : serializeLayoutNodePath(selectedPath)
  const selectedNode = selectedPath === null ? null : getNodeAtPath(pageLayout, selectedPath)

  // Look up the anchor after each commit that changes the selection. Runs in a
  // layout effect so that the resolved element is available before the next
  // paint; if it isn't mounted yet (concurrent edit / stale path), we simply
  // keep the overlay unrendered until the next selection change reconciles.
  useLayoutEffect(() => {
    if (serializedPath === null) {
      setAnchorElement(null)
      return
    }
    const element = document.querySelector(`[data-node-path="${serializedPath}"]`)
    setAnchorElement(element instanceof HTMLElement ? element : null)
  }, [serializedPath])

  // Callback ref so the observer only attaches to the concrete DOM node that
  // this render actually produced (returning null above unmounts the div and
  // triggers the cleanup here, avoiding stale ResizeObserver subscriptions).
  const overlayRef = useCallback((node: HTMLDivElement | null) => {
    if (!node) return
    if (typeof ResizeObserver === 'undefined') {
      const rect = node.getBoundingClientRect()
      setOverlaySize({ width: rect.width, height: rect.height })
      return
    }
    const observer = new ResizeObserver((entries) => {
      const entry = entries[entries.length - 1]
      if (!entry) return
      const { width, height } = entry.contentRect
      setOverlaySize({ width, height })
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  const position = useAnchoredPosition(anchorElement, overlaySize)

  if (selectedPath === null || selectedNode === null || anchorElement === null) {
    return null
  }

  // `position` starts null until the first ResizeObserver callback runs and
  // useAnchoredPosition catches up. Rendering the div anyway on that first
  // paint is intentional: the overlay needs to be in the DOM to be measured
  // in the first place. It reaches its final coordinates on the very next
  // render, without a visible flash for the user (both updates land inside
  // the same layout-effect flush).
  const style = position === null ? { top: 0, left: 0 } : { top: position.top, left: position.left }

  return (
    <div
      ref={overlayRef}
      data-testid="dev-editor-selection-overlay"
      className={CONTAINER_CLASSES}
      style={style}
    >
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
  )
}
