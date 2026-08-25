import { useDraggable } from '@dnd-kit/core'
import type { LayoutNodeType } from '../../config/runtime-config'
import { getSupportedNodeTypesCatalog } from './layout-canvas-node-schema'
// Non-component drag-id helpers live in their own module (rather than here) so this file only
// exports components — Fast Refresh requires component-only modules to preserve state across
// edits.
import { serializePaletteDragId } from './layout-canvas-palette-drag-id'

const NODE_TYPE_LABELS: Record<LayoutNodeType, string> = {
  container: 'Contenedor',
  repeater: 'Repetidor',
  heading: 'Título',
  paragraph: 'Párrafo',
  list: 'Lista',
  image: 'Imagen',
  table: 'Tabla',
  button: 'Botón',
  link: 'Enlace',
  form: 'Formulario',
  input: 'Campo de texto',
  textarea: 'Área de texto',
  select: 'Selector',
  radioGroup: 'Grupo de radio',
  checkboxGroup: 'Grupo de checkboxes',
  modal: 'Modal',
  tabs: 'Pestañas',
  steps: 'Pasos',
  accordion: 'Acordeón',
  badge: 'Insignia',
  alert: 'Alerta',
  stat: 'Estadística',
  divider: 'Separador',
  skeleton: 'Esqueleto',
  fileManager: 'Gestor de archivos',
  fileInput: 'Campo de archivo',
  toggle: 'Interruptor',
  hidden: 'Campo oculto',
  map: 'Mapa',
}

interface LayoutCanvasNodePaletteEntryProps {
  type: LayoutNodeType
}

function LayoutCanvasNodePaletteEntry({ type }: LayoutCanvasNodePaletteEntryProps) {
  const { setNodeRef, listeners, attributes } = useDraggable({ id: serializePaletteDragId(type) })

  return (
    <button
      ref={setNodeRef}
      type="button"
      data-testid={`layout-canvas-palette-item-${type}`}
      className="cursor-grab rounded border px-2 py-1 text-left text-xs hover:bg-gray-50 active:cursor-grabbing"
      {...listeners}
      {...attributes}
    >
      {NODE_TYPE_LABELS[type]}
    </button>
  )
}

/**
 * Lists every node type from `getSupportedNodeTypesCatalog()` (T7) as a draggable palette entry
 * (FR8). Dragging an entry onto a valid drop target inserts a fresh
 * `buildDefaultNodeInstance(type)` there — see `LayoutCanvas`'s `handleDropAttempt`, which tells
 * a palette-originated drag apart from an existing-node drag by decoding the drag id via
 * `parsePaletteDragId`. Always rendered inside the Visual tab, not conditioned on a selection.
 */
export function LayoutCanvasNodePalette() {
  const nodeTypes = getSupportedNodeTypesCatalog()

  return (
    <div
      data-testid="layout-canvas-node-palette"
      aria-label="Paleta de nodos"
      className="flex flex-col gap-1 overflow-y-auto p-2"
    >
      {nodeTypes.map((type) => (
        <LayoutCanvasNodePaletteEntry key={type} type={type} />
      ))}
    </div>
  )
}
