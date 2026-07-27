import type { ReactNode } from 'react'
// The context itself lives in `./layout-edit-mode-context-value` (not here) so this file's only
// export is the component `LayoutEditModeProvider` — Fast Refresh requires component-only
// modules to preserve state across edits, and it also asks for React contexts to live in their
// own file.
import { LayoutEditModeContext, type LayoutEditModeContextValue } from './layout-edit-mode-context-value'

export function LayoutEditModeProvider({
  value,
  children,
}: {
  value: LayoutEditModeContextValue | null
  children: ReactNode
}) {
  return <LayoutEditModeContext.Provider value={value}>{children}</LayoutEditModeContext.Provider>
}
