import { useDraggable } from '@dnd-kit/core'
import type { LayoutNodeType } from '../../config/runtime-config'
import { getSupportedNodeTypesCatalog } from './layout-canvas-node-schema'

// Distinguishes a drag originated in the palette from a drag of an existing canvas node
// (`serializeLayoutNodePath`, T12): a palette id always starts with this prefix, which never
// overlaps a serialized `LayoutNodePath` (those only ever contain "children"/"template"/
// "tabItem" tokens and digits joined by ".").
const PALETTE_DRAG_ID_PREFIX = 'palette:'

export function serializePaletteDragId(type: LayoutNodeType): string {
  return `${PALETTE_DRAG_ID_PREFIX}${type}`
}

const SUPPORTED_NODE_TYPES = new Set<string>(getSupportedNodeTypesCatalog())

/** Inverse of `serializePaletteDragId`. Returns `null` for any id that isn't a palette id, or
 * whose encoded type isn't a currently-supported node type. */
export function parsePaletteDragId(id: string): LayoutNodeType | null {
  if (!id.startsWith(PALETTE_DRAG_ID_PREFIX)) return null
  const type = id.slice(PALETTE_DRAG_ID_PREFIX.length)
  return SUPPORTED_NODE_TYPES.has(type) ? (type as LayoutNodeType) : null
}

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
      className="flex w-40 shrink-0 flex-col gap-1 overflow-y-auto border-r p-2"
    >
      {nodeTypes.map((type) => (
        <LayoutCanvasNodePaletteEntry key={type} type={type} />
      ))}
    </div>
  )
}
