import { useCallback, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
// The context itself lives in `./runtime-accordion-group-value` (not here) so this file's only
// export is the component `AccordionGroupProvider` — Fast Refresh requires component-only
// modules to preserve state across edits, and it also asks for React contexts to live in their
// own file.
import { AccordionGroupContext } from './runtime-accordion-group-value'

export function AccordionGroupProvider({ children }: { children: ReactNode }) {
  // Map from groupId to instanceId of the currently open accordion in that group
  const [activeMap, setActiveMap] = useState<Map<string, string | null>>(new Map())

  // Track which groups already have a default-open accordion claimed
  const defaultOpenClaimedRef = useRef<Set<string>>(new Set())

  const getActiveInstanceId = useCallback(
    (groupId: string): string | null => {
      return activeMap.get(groupId) ?? null
    },
    [activeMap],
  )

  const claimDefaultOpen = useCallback((groupId: string, instanceId: string): boolean => {
    if (defaultOpenClaimedRef.current.has(groupId)) {
      return false
    }

    defaultOpenClaimedRef.current.add(groupId)

    setActiveMap((prev) => {
      const next = new Map(prev)
      next.set(groupId, instanceId)
      return next
    })

    return true
  }, [])

  const openInGroup = useCallback((groupId: string, instanceId: string) => {
    setActiveMap((prev) => {
      const next = new Map(prev)
      next.set(groupId, instanceId)
      return next
    })
  }, [])

  const closeInGroup = useCallback((groupId: string) => {
    setActiveMap((prev) => {
      const next = new Map(prev)
      next.set(groupId, null)
      return next
    })
  }, [])

  const value = useMemo(
    () => ({ getActiveInstanceId, claimDefaultOpen, openInGroup, closeInGroup }),
    [getActiveInstanceId, claimDefaultOpen, openInGroup, closeInGroup],
  )

  return <AccordionGroupContext.Provider value={value}>{children}</AccordionGroupContext.Provider>
}
