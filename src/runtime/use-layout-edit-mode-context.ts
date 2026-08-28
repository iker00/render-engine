import { useContext } from 'react'
import { LayoutEditModeContext } from './layout-edit-mode-context-value'

export function useLayoutEditModeContext() {
  return useContext(LayoutEditModeContext)
}
