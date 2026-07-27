import { LayoutCanvasNodePalette } from '../layout-canvas/layout-canvas-node-palette'

export interface FloatingNodePaletteProps {
  open: boolean
  onClose: () => void
}

// Fixed side panel that hosts the existing LayoutCanvasNodePalette (0102, T7) so the toolbar
// (T4) can show/hide the whole palette on demand without reflowing the rendered page
// (FR4 de 0103). `position: fixed` is a spec requirement: the panel must never contribute
// to the layout of the real content underneath. The DnD wiring the palette relies on comes
// from the ambient `LayoutCanvasDndContext` mounted higher up by `DevRuntimeReady` (T8);
// this component does not re-declare it, matching the "reutilizado sin cambios" contract.
const CONTAINER_CLASSES = [
  'fixed',
  'left-4',
  'top-4',
  'bottom-24',
  'z-[9998]',
  'flex',
  'w-56',
  'flex-col',
  'overflow-hidden',
  'rounded-lg',
  'border',
  'border-gray-200',
  'bg-white',
  'shadow-lg',
].join(' ')

const HEADER_CLASSES =
  'flex items-center justify-between border-b border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-800'

const CLOSE_BUTTON_CLASSES =
  'flex h-6 items-center justify-center rounded px-2 text-xs text-gray-700 hover:bg-gray-200'

export function FloatingNodePalette({ open, onClose }: FloatingNodePaletteProps) {
  if (!open) return null

  return (
    <div
      data-testid="dev-editor-floating-palette"
      className={CONTAINER_CLASSES}
      role="dialog"
      aria-label="Paleta de nodos"
    >
      <div className={HEADER_CLASSES}>
        <span>Añadir elemento</span>
        <button
          type="button"
          data-testid="dev-editor-floating-palette-close"
          className={CLOSE_BUTTON_CLASSES}
          onClick={onClose}
        >
          Cerrar
        </button>
      </div>
      <LayoutCanvasNodePalette />
    </div>
  )
}
