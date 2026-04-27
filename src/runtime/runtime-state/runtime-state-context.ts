import { createContext } from 'react'
import type { RuntimeStateContextValue } from './runtime-state-types'

export const RuntimeStateContext = createContext<RuntimeStateContextValue | null>(null)
