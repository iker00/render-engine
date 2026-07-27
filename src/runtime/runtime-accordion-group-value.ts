import { createContext } from 'react'

export interface AccordionGroupContextValue {
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

export const AccordionGroupContext = createContext<AccordionGroupContextValue | null>(null)
