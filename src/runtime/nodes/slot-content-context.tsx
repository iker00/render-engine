import { createContext } from 'react'
import type { ReactNode } from 'react'

/**
 * Contenido de slot ya renderizado por `GroupLayoutNode` (T12) para la posición actual del nodo
 * `slot` dentro del `template` de un grupo en curso. Fuera de cualquier `group`, o cuando la
 * instancia del grupo no aporta contenido para ese slot, el valor por defecto es `null` y
 * `SlotLayoutNode` no pinta nada — la rama de "slot vacío" soportada por spec.
 */
export type RuntimeSlotContent = ReactNode | null

export const SlotContentProvider = createContext<RuntimeSlotContent>(null)
