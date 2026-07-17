import { createContext, useContext, type ReactNode } from 'react'
import type { LayoutNodePath } from './layout-node-path'

export interface LayoutEditModeContextValue {
  selectedPath: LayoutNodePath | null
  hoveredPath: LayoutNodePath | null
  onSelectNode: (path: LayoutNodePath) => void
  onHoverNode: (path: LayoutNodePath | null) => void
}

const LayoutEditModeContext = createContext<LayoutEditModeContextValue | null>(null)

export function LayoutEditModeProvider({
  value,
  children,
}: {
  value: LayoutEditModeContextValue
  children: ReactNode
}) {
  return <LayoutEditModeContext.Provider value={value}>{children}</LayoutEditModeContext.Provider>
}

export function useLayoutEditModeContext() {
  return useContext(LayoutEditModeContext)
}
