import { useCallback, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { RuntimeInstanceScope } from './runtime-references/runtime-instance-scope'
import { deriveScopedStateKey } from './runtime-references/runtime-instance-scope'
// The context itself lives in `./runtime-accordion-group-value` (not here) so this file's only
// export is the component `AccordionGroupProvider` — Fast Refresh requires component-only
// modules to preserve state across edits, and it also asks for React contexts to live in their
// own file.
import { AccordionGroupContext } from './runtime-accordion-group-value'

export function AccordionGroupProvider({ children }: { children: ReactNode }) {
  // Map from scoped groupId key (T04 / feature reusable-node-groups) to instanceId of the
  // currently open accordion in that scoped group. Scoping the map key — instead of the raw
  // groupId — is what isolates coordination per scope chain (e.g. distinct repeater iterations).
  const [activeMap, setActiveMap] = useState<Map<string, string | null>>(new Map())

  // Track which scoped groups already have a default-open accordion claimed
  const defaultOpenClaimedRef = useRef<Set<string>>(new Set())

  const getActiveInstanceId = useCallback(
    (groupId: string, scope: RuntimeInstanceScope): string | null => {
      return activeMap.get(deriveScopedStateKey(groupId, scope)) ?? null
    },
    [activeMap],
  )

  const claimDefaultOpen = useCallback(
    (groupId: string, instanceId: string, scope: RuntimeInstanceScope): boolean => {
      const scopedKey = deriveScopedStateKey(groupId, scope)

      if (defaultOpenClaimedRef.current.has(scopedKey)) {
        return false
      }

      defaultOpenClaimedRef.current.add(scopedKey)

      setActiveMap((prev) => {
        const next = new Map(prev)
        next.set(scopedKey, instanceId)
        return next
      })

      return true
    },
    [],
  )

  const openInGroup = useCallback((groupId: string, instanceId: string, scope: RuntimeInstanceScope) => {
    const scopedKey = deriveScopedStateKey(groupId, scope)
    setActiveMap((prev) => {
      const next = new Map(prev)
      next.set(scopedKey, instanceId)
      return next
    })
  }, [])

  const closeInGroup = useCallback((groupId: string, scope: RuntimeInstanceScope) => {
    const scopedKey = deriveScopedStateKey(groupId, scope)
    setActiveMap((prev) => {
      const next = new Map(prev)
      next.set(scopedKey, null)
      return next
    })
  }, [])

  const value = useMemo(
    () => ({ getActiveInstanceId, claimDefaultOpen, openInGroup, closeInGroup }),
    [getActiveInstanceId, claimDefaultOpen, openInGroup, closeInGroup],
  )

  return <AccordionGroupContext.Provider value={value}>{children}</AccordionGroupContext.Provider>
}
