import { createContext } from 'react'
import type { RuntimeInstanceScope } from './runtime-references/runtime-instance-scope'

export interface AccordionGroupContextValue {
  /**
   * Returns the currently-open instanceId for the given groupId, scoped to `scope`
   * (T04 / feature reusable-node-groups). Two accordions sharing `groupId` under different
   * scope chains (e.g. distinct repeater iterations) never observe each other's state.
   * Returns null when no accordion in that scoped group is open.
   */
  getActiveInstanceId: (groupId: string, scope: RuntimeInstanceScope) => string | null

  /**
   * Register interest in a scoped group + instanceId combination.
   * For groups: the first accordion with defaultOpen:true that claims the scoped group wins.
   * Returns true if the accordion should start open (it was the first to claim the group).
   */
  claimDefaultOpen: (groupId: string, instanceId: string, scope: RuntimeInstanceScope) => boolean

  /**
   * Called when an accordion header is clicked to open it.
   * Sets the instanceId as active in its scoped group.
   */
  openInGroup: (groupId: string, instanceId: string, scope: RuntimeInstanceScope) => void

  /**
   * Called when an accordion header is clicked to close it.
   * Clears the active instanceId for its scoped group.
   */
  closeInGroup: (groupId: string, scope: RuntimeInstanceScope) => void
}

export const AccordionGroupContext = createContext<AccordionGroupContextValue | null>(null)
