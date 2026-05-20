import { createContext, useContext, type ReactNode } from 'react'

interface RuntimeLayoutContextValue {
  parentGridColumns: number | null
}

const RuntimeLayoutContext = createContext<RuntimeLayoutContextValue>({
  parentGridColumns: null,
})

export function RuntimeLayoutContextProvider({
  value,
  children,
}: {
  value: RuntimeLayoutContextValue
  children: ReactNode
}) {
  return <RuntimeLayoutContext.Provider value={value}>{children}</RuntimeLayoutContext.Provider>
}

export function useRuntimeLayoutContext() {
  return useContext(RuntimeLayoutContext)
}
