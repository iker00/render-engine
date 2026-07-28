import type { ReactNode } from 'react'
// The context itself lives in `./runtime-layout-context-value` (not here) so this file's only
// export is the component `RuntimeLayoutContextProvider` — Fast Refresh requires component-only
// modules to preserve state across edits, and it also asks for React contexts to live in their
// own file.
import { RuntimeLayoutContext, type RuntimeLayoutContextValue } from './runtime-layout-context-value'

export function RuntimeLayoutContextProvider({
  value,
  children,
}: {
  value: RuntimeLayoutContextValue
  children: ReactNode
}) {
  return <RuntimeLayoutContext.Provider value={value}>{children}</RuntimeLayoutContext.Provider>
}
