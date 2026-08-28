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
