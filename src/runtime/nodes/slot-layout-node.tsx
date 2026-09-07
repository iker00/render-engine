import { useContext } from 'react'
import type { RuntimeSlotNode } from '../../config/runtime-config-types'
import { SlotContentProvider } from './slot-content-context'

/**
 * Nodo mínimo: no tiene props ni children propios, no recurse sobre nada. Pinta el contenido de
 * slot que `GroupLayoutNode` (T12) haya provisto vía `SlotContentProvider` para la posición
 * actual del `template` del grupo. Sin proveedor ancestro no renderiza nada — slot vacío.
 */
export function SlotLayoutNode({ node: _node }: { node: RuntimeSlotNode }) {
  const content = useContext(SlotContentProvider)
  return <>{content}</>
}
