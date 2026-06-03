import { createContext, useCallback, useContext, useId, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'

interface AccordionGroupContextValue {
  /**
   * Returns the currently-open instanceId for the given groupId.
   * Returns null when no accordion in the group is open.
   */
  getActiveInstanceId: (groupId: string) => string | null

  /**
   * Register interest in a group + instanceId combination.
   * For groups: the first accordion with defaultOpen:true that claims the group wins.
   * Returns true if the accordion should start open (it was the first to claim the group).
   */
  claimDefaultOpen: (groupId: string, instanceId: string) => boolean

  /**
   * Called when an accordion header is clicked to open it.
   * Sets the instanceId as active in its group.
   */
  openInGroup: (groupId: string, instanceId: string) => void

  /**
   * Called when an accordion header is clicked to close it.
   * Clears the active instanceId for its group.
   */
  closeInGroup: (groupId: string) => void
}

const AccordionGroupContext = createContext<AccordionGroupContextValue | null>(null)

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

export function useAccordionGroup() {
  const ctx = useContext(AccordionGroupContext)

  if (!ctx) {
    throw new Error('useAccordionGroup must be used within AccordionGroupProvider')
  }

  return { ...ctx, useId }
}
