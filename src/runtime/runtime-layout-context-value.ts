import { createContext } from 'react'
import type { RuntimeResponsiveLayoutValue } from '../config/runtime-config'

export interface RuntimeLayoutContextValue {
  parentGridColumns: RuntimeResponsiveLayoutValue | null
}

export const RuntimeLayoutContext = createContext<RuntimeLayoutContextValue>({
  parentGridColumns: null,
})
