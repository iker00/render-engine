import { useContext } from 'react'
import { RuntimeLayoutContext } from './runtime-layout-context-value'

export function useRuntimeLayoutContext() {
  return useContext(RuntimeLayoutContext)
}
