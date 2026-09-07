import { createContext } from 'react'
import type { RuntimeGroupContext } from './runtime-reference-types'

/**
 * Contexto de React que transporta el `RuntimeGroupContext` ambiente (T10 / feature
 * reusable-node-groups) mientras se recorre el `template` de un `group` en curso.
 * `GroupLayoutNode` (T12) lo provee con los `paramValues` resueltos de la instancia; fuera de
 * cualquier `group` el valor por defecto es `null`. Es puramente de render: no persiste nada y
 * no debe consultarse contra el store global.
 */
export const RuntimeGroupContextProvider = createContext<RuntimeGroupContext>(null)
